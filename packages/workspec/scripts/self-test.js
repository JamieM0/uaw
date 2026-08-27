#!/usr/bin/env node
'use strict';

const assert = require('assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const validator = require('../workspec-validator.js');
const stateVisuals = require('../state-visuals.js');
const schema = require('../v2.1.schema.json');

function baseDoc() {
    return {
        simulation: {
            schema_version: '2.1',
            meta: { title: 't', description: 'd', domain: 'x' },
            config: {
                time_unit: 'minutes',
                start_time: '08:00',
                end_time: '18:00',
                currency: 'USD',
                locale: 'en-US',
                timezone: 'UTC'
            },
            world: { objects: [] },
            process: { tasks: [] }
        }
    };
}

function hasMetric(problems, metricId) {
    return problems.some((p) => p && p.metric_id === metricId);
}

function getMetric(problems, metricId) {
    return problems.find((p) => p && p.metric_id === metricId) || null;
}

function run() {
    // Canonical schema exposes every first-class WorkSpec v2 subsystem and has no broken internal refs.
    {
        const simulationProperties = schema.definitions?.Simulation?.properties || {};
        for (const property of [
            'schema_version', 'meta', 'config', 'world', 'process',
            'type_definitions', 'type_traits', 'state_libraries',
            'simulation_config', 'calendar', 'day_types', 'digital_space', 'displays'
        ]) {
            assert.ok(simulationProperties[property], `Canonical schema is missing simulation.${property}`);
        }

        for (const definition of [
            'Object', 'Task', 'Interaction', 'StateLibrary', 'TypeDefinition', 'TypeTrait',
            'Calendar', 'DayType', 'DigitalSpace', 'DigitalLocation', 'DigitalObject',
            'DigitalConnection', 'DataFlow', 'Display', 'DisplayElement'
        ]) {
            assert.ok(schema.definitions?.[definition], `Canonical schema is missing ${definition}`);
        }

        const refs = [];
        const visit = (value) => {
            if (!value || typeof value !== 'object') return;
            if (typeof value.$ref === 'string' && value.$ref.startsWith('#/')) refs.push(value.$ref);
            Object.values(value).forEach(visit);
        };
        visit(schema);
        for (const ref of refs) {
            const target = ref.slice(2).split('/').reduce((value, segment) => value?.[segment.replace(/~1/g, '/').replace(/~0/g, '~')], schema);
            assert.ok(target, `Canonical schema has unresolved reference ${ref}`);
        }

        assert.equal(validator.parseDurationToMinutes('PT', 'minutes').ok, false);
        assert.equal(validator.parseDurationToMinutes('P0D', 'minutes').ok, false);
        assert.equal(validator.parseDurationToMinutes('1.5h', 'minutes').minutes, 90);

        const embeddedAssetDoc = baseDoc();
        embeddedAssetDoc.assets = { sprite: 'data:image/png;base64,AAAA' };
        const embeddedAssetResult = validator.validate(embeddedAssetDoc);
        assert.equal(embeddedAssetResult.ok, false);
        assert.equal(hasMetric(embeddedAssetResult.problems, 'schema.integrity.embedded_assets'), true);
    }

    // State Libraries validate references and resolve current-state visuals.
    {
        const doc = baseDoc();
        doc.simulation.state_libraries = {
            actor_basic: {
                states: ['available', 'working', 'break'],
                appearances: {
                    female: {
                        available: 'asset_idle',
                        working: 'asset_working'
                    }
                }
            }
        };
        const actor = {
            id: 'worker_1',
            type: 'actor',
            name: 'Worker 1',
            state_library: 'actor_basic',
            appearance: 'female',
            properties: { state: 'available' }
        };
        doc.simulation.world.objects = [actor];
        doc.simulation.process.tasks = [
            { id: 'prepare', actor_id: 'worker_1', start: '09:00', duration: 5 },
            {
                id: 'work',
                actor_id: 'worker_1',
                duration: 30,
                depends_on: ['prepare'],
                interactions: [{
                    target_id: 'worker_1',
                    temporary: true,
                    property_changes: { state: { from: 'available', to: 'working' } }
                }]
            }
        ];

        assert.equal(validator.validate(doc).ok, true);
        assert.equal(stateVisuals.resolveStateVisualAssetId(doc, actor), 'asset_idle');
        assert.equal(stateVisuals.resolveObjectStateAtTime(actor, doc.simulation.process.tasks, 9 * 60 + 10, doc), 'working');
        assert.equal(stateVisuals.resolveObjectStateAtTime(actor, doc.simulation.process.tasks, 9 * 60 + 36, doc), 'available');
        assert.equal(
            stateVisuals.resolveStateVisualAssetId(doc, actor, stateVisuals.resolveObjectStateAtTime(actor, doc.simulation.process.tasks, 9 * 60 + 10, doc)),
            'asset_working'
        );
        assert.equal(stateVisuals.assetIdFromFilename('Baker Working.PNG'), 'baker_working');
    }

    // Physical visuals receive deterministic, non-overlapping slots inside a location.
    {
        const bounds = { x: 50, y: 50, width: 300, height: 150 };
        const ids = Array.from({ length: 13 }, (_, index) => `object_${index + 1}`);
        const slots = stateVisuals.calculateLocationObjectSlots(bounds, ids.reverse());
        assert.equal(slots.size, 13);
        for (const slot of slots.values()) {
            assert.equal(slot.x >= bounds.x && slot.y >= bounds.y, true);
            assert.equal(slot.x + slot.size <= bounds.x + bounds.width, true);
            assert.equal(slot.y + slot.size <= bounds.y + bounds.height, true);
        }
        const values = [...slots.values()];
        for (let a = 0; a < values.length; a++) {
            for (let b = a + 1; b < values.length; b++) {
                const left = values[a];
                const right = values[b];
                const overlaps = left.x < right.x + right.size
                    && left.x + left.size > right.x
                    && left.y < right.y + right.size
                    && left.y + left.size > right.y;
                assert.equal(overlaps, false);
            }
        }
    }

    // Invalid initial and interaction states are rejected for referenced libraries.
    {
        const doc = baseDoc();
        doc.simulation.state_libraries = {
            actor_basic: { states: ['available'], appearances: { main: { available: 'asset_idle' } } }
        };
        doc.simulation.world.objects = [{
            id: 'worker_1', type: 'actor', name: 'Worker 1', state_library: 'actor_basic', appearance: 'missing', properties: { state: 'unknown' }
        }];
        doc.simulation.process.tasks = [{
            id: 'work', actor_id: 'worker_1', start: '09:00', duration: 30,
            interactions: [{ target_id: 'worker_1', property_changes: { state: { set: 'working' } } }]
        }];
        const result = validator.validate(doc);
        assert.equal(result.ok, false);
        assert.equal(hasMetric(result.problems, 'state_visuals.reference.invalid_state'), true);
        assert.equal(hasMetric(result.problems, 'state_visuals.reference.unknown_appearance'), true);
        assert.equal(hasMetric(result.problems, 'state_visuals.reference.invalid_interaction_state'), true);
    }

    // 1) Standard v2 path: simulation.world/process
    {
        const doc = baseDoc();
        doc.simulation.world.objects = [
            { id: 'a', type: 'actor', name: 'A', properties: { state: 'idle' } },
            { id: 'b', type: 'actor', name: 'B', properties: { state: 'idle' } }
        ];
        doc.simulation.process.tasks = [
            { id: 't1', actor_id: 'a', start: '09:00', duration: 60 },
            { id: 't2', actor_id: 'b', start: '09:30', duration: 30, depends_on: ['t1'] }
        ];

        const res = validator.validate(doc);
        assert.equal(res.ok, false);
        assert.equal(hasMetric(res.problems, 'temporal.scheduling.dependency_violation'), true);
        const problem = getMetric(res.problems, 'temporal.scheduling.dependency_violation');
        assert.equal(problem.instance, '/simulation/process/tasks/1/start');
    }

    // 2) Legacy alias path: simulation.objects/tasks/layout while world/process exist but are empty arrays
    {
        const doc = baseDoc();
        doc.simulation.objects = [
            { id: 'a', type: 'actor', name: 'A', properties: { state: 'idle' } },
            { id: 'b', type: 'actor', name: 'B', properties: { state: 'idle' } }
        ];
        doc.simulation.tasks = [
            { id: 't1', actor_id: 'a', start: '09:00', duration: 60 },
            { id: 't2', actor_id: 'b', start: '09:30', duration: 30, depends_on: ['t1'] }
        ];

        const res = validator.validate(doc);
        assert.equal(res.ok, false);
        assert.equal(hasMetric(res.problems, 'temporal.scheduling.dependency_violation'), true);
        const problem = getMetric(res.problems, 'temporal.scheduling.dependency_violation');
        assert.equal(problem.instance, '/simulation/tasks/1/start');
    }

    // 3) Control: no dependency violation when start == dependency end
    {
        const doc = baseDoc();
        doc.simulation.world.objects = [
            { id: 'a', type: 'actor', name: 'A', properties: { state: 'idle' } },
            { id: 'b', type: 'actor', name: 'B', properties: { state: 'idle' } }
        ];
        doc.simulation.process.tasks = [
            { id: 't1', actor_id: 'a', start: '09:00', duration: 30 },
            { id: 't2', actor_id: 'b', start: '09:30', duration: 30, depends_on: ['t1'] }
        ];

        const res = validator.validate(doc);
        assert.equal(hasMetric(res.problems, 'temporal.scheduling.dependency_violation'), false);
    }

    // 4) CLI custom validation (Metrics Editor style + explicit catalog)
    {
        const fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), 'workspec-selftest-'));
        const docPath = path.join(fixtureDir, 'sample.workspec.json');
        const customPath = path.join(fixtureDir, 'simulation-validator-custom.js');
        const catalogPath = path.join(fixtureDir, 'metrics-catalog-custom.json');
        const cliPath = path.join(__dirname, '..', 'bin', 'workspec.js');

        const doc = baseDoc();
        doc.simulation.world.objects = [
            { id: 'a', type: 'actor', name: 'A', properties: { state: 'idle' } }
        ];
        doc.simulation.process.tasks = [];

        fs.writeFileSync(docPath, JSON.stringify(doc, null, 2), 'utf8');
        fs.writeFileSync(customPath, [
            'function validateMinimumTaskCount(metric) {',
            '    const tasks = this.simulation.process?.tasks || [];',
            '    const minCount = metric.params?.min_count ?? 1;',
            '    if (tasks.length < minCount) {',
            '        this.addResult({',
            '            metricId: metric.id,',
            "            status: 'error',",
            "            message: `Expected at least ${minCount} task(s), found ${tasks.length}.`",
            '        });',
            '    } else {',
            '        this.addResult({',
            '            metricId: metric.id,',
            "            status: 'success',",
            "            message: 'Task count is valid.'",
            '        });',
            '    }',
            '}',
            ''
        ].join('\n'), 'utf8');
        fs.writeFileSync(catalogPath, JSON.stringify([
            {
                id: 'custom.minimum_task_count',
                function: 'validateMinimumTaskCount',
                params: { min_count: 1 },
                validation_type: 'computational'
            }
        ], null, 2), 'utf8');

        const result = spawnSync(process.execPath, [
            cliPath,
            'validate',
            '-custom',
            customPath,
            '--custom-catalog',
            catalogPath,
            docPath,
            '--json',
            '-y'
        ], { encoding: 'utf8' });

        assert.equal(result.status, 1);
        const output = JSON.parse(result.stdout);
        assert.equal(output.some((p) => p.metric_id === 'custom.minimum_task_count'), true);
    }

    // 5) CLI custom validation (auto-discovered validate* function; no catalog)
    {
        const fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), 'workspec-selftest-'));
        const docPath = path.join(fixtureDir, 'sample.workspec.json');
        const customPath = path.join(fixtureDir, 'custom-validator.js');
        const cliPath = path.join(__dirname, '..', 'bin', 'workspec.js');

        const doc = baseDoc();
        doc.simulation.world.objects = [
            { id: 'a', type: 'actor', name: 'A', properties: { state: 'idle' } }
        ];
        doc.simulation.process.tasks = [
            { id: 't1', actor_id: 'a', start: '09:00', duration: 30 }
        ];

        fs.writeFileSync(docPath, JSON.stringify(doc, null, 2), 'utf8');
        fs.writeFileSync(customPath, [
            'function validateTaskLimit(metric) {',
            '    const tasks = this.simulation.process?.tasks || [];',
            '    if (tasks.length > 0) {',
            '        this.addResult({',
            '            metricId: metric.id,',
            "            status: 'warning',",
            "            message: 'This is an expected custom warning.'",
            '        });',
            '    }',
            '}',
            ''
        ].join('\n'), 'utf8');

        const result = spawnSync(process.execPath, [
            cliPath,
            'validate',
            '--custom',
            customPath,
            docPath,
            '--json',
            '-y'
        ], { encoding: 'utf8' });

        assert.equal(result.status, 0);
        const output = JSON.parse(result.stdout);
        assert.equal(output.some((p) => p.metric_id === 'custom.task_limit' && p.severity === 'warning'), true);
    }

    // 6) CLI custom validation (exported constraints API)
    {
        const fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), 'workspec-selftest-'));
        const docPath = path.join(fixtureDir, 'sample.workspec.json');
        const customPath = path.join(fixtureDir, 'constraint-validator.js');
        const cliPath = path.join(__dirname, '..', 'bin', 'workspec.js');

        const doc = baseDoc();
        doc.simulation.world.objects = [
            { id: 'a', type: 'actor', name: 'A', properties: { state: 'idle' } }
        ];
        doc.simulation.process.tasks = [
            { id: 't1', actor_id: 'a', start: '09:00', duration: 30 }
        ];
        doc.simulation.config.timezone = 'America/New_York';

        fs.writeFileSync(docPath, JSON.stringify(doc, null, 2), 'utf8');
        fs.writeFileSync(customPath, [
            'module.exports = {',
            '  constraints: [',
            '    function requireUtcTimezone(documentValue, helpers) {',
            '      const timezone = helpers.simulation?.config?.timezone;',
            '      if (timezone !== "UTC") {',
            '        return {',
            '          metric_id: "custom.constraint.utc_timezone",',
            '          severity: "error",',
            '          title: "Timezone Constraint",',
            '          detail: `Expected timezone UTC, received ${timezone}.`,',
            '          instance: "/simulation/config/timezone"',
            '        };',
            '      }',
            '      return [];',
            '    }',
            '  ]',
            '};',
            ''
        ].join('\n'), 'utf8');

        const result = spawnSync(process.execPath, [
            cliPath,
            'validate',
            '--custom',
            customPath,
            docPath,
            '--json',
            '-y'
        ], { encoding: 'utf8' });

        assert.equal(result.status, 1);
        const output = JSON.parse(result.stdout);
        assert.equal(output.some((p) => p.metric_id === 'custom.constraint.utc_timezone' && p.severity === 'error'), true);
    }

    // 7) Security: malicious custom code calling process.exit() must not kill parent process
    {
        const fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), 'workspec-selftest-'));
        const docPath = path.join(fixtureDir, 'sample.workspec.json');
        const customPath = path.join(fixtureDir, 'malicious-exit.js');
        const cliPath = path.join(__dirname, '..', 'bin', 'workspec.js');

        const doc = baseDoc();
        fs.writeFileSync(docPath, JSON.stringify(doc, null, 2), 'utf8');
        fs.writeFileSync(customPath, [
            'function validateEvil(metric) {',
            '    process.exit(42);',
            '}',
            ''
        ].join('\n'), 'utf8');

        const result = spawnSync(process.execPath, [
            cliPath,
            'validate',
            '--custom',
            customPath,
            docPath,
            '--json',
            '-y'
        ], { encoding: 'utf8' });

        assert.equal(result.status, 2);
        assert.equal(result.stderr.includes('Custom validation failed:'), true);
    }

    // 8) Security: require explicit confirmation for custom validators in non-interactive mode
    {
        const fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), 'workspec-selftest-'));
        const docPath = path.join(fixtureDir, 'sample.workspec.json');
        const customPath = path.join(fixtureDir, 'safe-custom.js');
        const cliPath = path.join(__dirname, '..', 'bin', 'workspec.js');

        const doc = baseDoc();
        fs.writeFileSync(docPath, JSON.stringify(doc, null, 2), 'utf8');
        fs.writeFileSync(customPath, 'function validateOk(metric) { return []; }\\n', 'utf8');

        const result = spawnSync(process.execPath, [
            cliPath,
            'validate',
            '--custom',
            customPath,
            docPath,
            '--json'
        ], { encoding: 'utf8' });

        assert.equal(result.status, 2);
        assert.equal(result.stderr.includes('Re-run with -y/--yes to skip confirmation'), true);
    }

    // 9) Security: enforce validate* allowlist for catalog function names
    {
        const fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), 'workspec-selftest-'));
        const docPath = path.join(fixtureDir, 'sample.workspec.json');
        const customPath = path.join(fixtureDir, 'catalog-function-name.js');
        const catalogPath = path.join(fixtureDir, 'metrics-catalog-custom.json');
        const cliPath = path.join(__dirname, '..', 'bin', 'workspec.js');

        const doc = baseDoc();
        fs.writeFileSync(docPath, JSON.stringify(doc, null, 2), 'utf8');
        fs.writeFileSync(customPath, [
            'function anythingGoes(metric) {',
            '    return [];',
            '}',
            ''
        ].join('\n'), 'utf8');
        fs.writeFileSync(catalogPath, JSON.stringify([
            {
                id: 'custom.bad_function_name',
                function: 'anythingGoes',
                params: {}
            }
        ], null, 2), 'utf8');

        const result = spawnSync(process.execPath, [
            cliPath,
            'validate',
            '--custom',
            customPath,
            '--custom-catalog',
            catalogPath,
            docPath,
            '--json',
            '-y'
        ], { encoding: 'utf8' });

        assert.equal(result.status, 1);
        const output = JSON.parse(result.stdout);
        assert.equal(output.some((p) => p.metric_id === 'custom.bad_function_name' && p.detail.includes('Invalid custom validation function name')), true);
    }

    // 10) Security: reject relative path traversal in --custom and --custom-catalog
    {
        const fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), 'workspec-selftest-'));
        const subdir = path.join(fixtureDir, 'sandbox');
        fs.mkdirSync(subdir);

        const docPath = path.join(subdir, 'sample.workspec.json');
        const customPath = path.join(fixtureDir, 'outside-custom.js');
        const catalogPath = path.join(fixtureDir, 'outside-catalog.json');
        const cliPath = path.join(__dirname, '..', 'bin', 'workspec.js');

        const doc = baseDoc();
        fs.writeFileSync(docPath, JSON.stringify(doc, null, 2), 'utf8');
        fs.writeFileSync(customPath, 'function validateAllowed() { return []; }\n', 'utf8');
        fs.writeFileSync(catalogPath, '[]\n', 'utf8');

        const resultCustom = spawnSync(process.execPath, [
            cliPath,
            'validate',
            '--custom',
            '../outside-custom.js',
            'sample.workspec.json',
            '--json',
            '-y'
        ], {
            cwd: subdir,
            encoding: 'utf8'
        });
        assert.equal(resultCustom.status, 2);
        assert.equal(resultCustom.stderr.includes('path traversal segments'), true);

        const resultCatalog = spawnSync(process.execPath, [
            cliPath,
            'validate',
            '--custom',
            customPath,
            '--custom-catalog',
            '../outside-catalog.json',
            docPath,
            '--json',
            '-y'
        ], {
            cwd: subdir,
            encoding: 'utf8'
        });
        assert.equal(resultCatalog.status, 2);
        assert.equal(resultCatalog.stderr.includes('path traversal segments'), true);
    }

    process.stdout.write('✓ workspec-validator self-test passed\n');
}

run();
