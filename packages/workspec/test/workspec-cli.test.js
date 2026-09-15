'use strict';

const test = require('node:test');
const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');

const cli = require('../bin/workspec.js');
const { baseDoc, createFixtureDir, runCli, writeJson } = require('./helpers.js');

test('CLI exports stay import-safe and parse arguments consistently', () => {
    const parsed = cli.parseArgs(['validate', '--json', '--yes', 'sample.workspec.json']);
    assert.equal(parsed.command, 'validate');
    assert.deepEqual(parsed.positionals, ['sample.workspec.json']);
    assert.equal(parsed.flags.json, true);
    assert.equal(parsed.flags.yes, true);
});

test('CLI custom validation supports explicit metrics catalogs', () => {
    const fixtureDir = createFixtureDir();
    const docPath = path.join(fixtureDir, 'sample.workspec.json');
    const customPath = path.join(fixtureDir, 'simulation-validator-custom.js');
    const catalogPath = path.join(fixtureDir, 'metrics-catalog-custom.json');

    const doc = baseDoc();
    doc.simulation.world.objects = [
        { id: 'a', type: 'actor', name: 'A', properties: { state: 'idle' } }
    ];

    writeJson(docPath, doc);
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
        '    }',
        '}',
        ''
    ].join('\n'), 'utf8');
    writeJson(catalogPath, [
        {
            id: 'custom.minimum_task_count',
            function: 'validateMinimumTaskCount',
            params: { min_count: 1 },
            validation_type: 'computational'
        }
    ]);

    const result = runCli([
        'validate',
        '-custom',
        customPath,
        '--custom-catalog',
        catalogPath,
        docPath,
        '--json',
        '-y'
    ]);

    assert.equal(result.status, 1);
    assert.equal(JSON.parse(result.stdout).problems.some((problem) => problem.metric_id === 'custom.minimum_task_count'), true);
});

test('CLI auto-discovers validate* custom functions without a catalog', () => {
    const fixtureDir = createFixtureDir();
    const docPath = path.join(fixtureDir, 'sample.workspec.json');
    const customPath = path.join(fixtureDir, 'custom-validator.js');

    const doc = baseDoc();
    doc.simulation.world.objects = [
        { id: 'a', type: 'actor', name: 'A', properties: { state: 'idle' } }
    ];
    doc.simulation.process.tasks = [
        { id: 't1', actor_id: 'a', start: '09:00', duration: 30 }
    ];

    writeJson(docPath, doc);
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

    const result = runCli([
        'validate',
        '--custom',
        customPath,
        docPath,
        '--json',
        '-y'
    ]);

    assert.equal(result.status, 0);
    assert.equal(JSON.parse(result.stdout).problems.some((problem) => problem.metric_id === 'custom.task_limit' && problem.severity === 'warning'), true);
});

test('CLI accepts exported constraint arrays for custom validation', () => {
    const fixtureDir = createFixtureDir();
    const docPath = path.join(fixtureDir, 'sample.workspec.json');
    const customPath = path.join(fixtureDir, 'constraint-validator.js');

    const doc = baseDoc();
    doc.simulation.world.objects = [
        { id: 'a', type: 'actor', name: 'A', properties: { state: 'idle' } }
    ];
    doc.simulation.process.tasks = [
        { id: 't1', actor_id: 'a', start: '09:00', duration: 30 }
    ];
    doc.simulation.config.timezone = 'America/New_York';

    writeJson(docPath, doc);
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

    const result = runCli([
        'validate',
        '--custom',
        customPath,
        docPath,
        '--json',
        '-y'
    ]);

    assert.equal(result.status, 1);
    assert.equal(JSON.parse(result.stdout).problems.some((problem) => problem.metric_id === 'custom.constraint.utc_timezone' && problem.severity === 'error'), true);
});

test('CLI isolates malicious validators that call process.exit', () => {
    const fixtureDir = createFixtureDir();
    const docPath = path.join(fixtureDir, 'sample.workspec.json');
    const customPath = path.join(fixtureDir, 'malicious-exit.js');

    writeJson(docPath, baseDoc());
    fs.writeFileSync(customPath, [
        'function validateEvil(metric) {',
        '    process.exit(42);',
        '}',
        ''
    ].join('\n'), 'utf8');

    const result = runCli([
        'validate',
        '--custom',
        customPath,
        docPath,
        '--json',
        '-y'
    ]);

    assert.equal(result.status, 2);
    assert.equal(result.stderr.includes('Custom validation failed:'), true);
});

test('CLI requires explicit confirmation when custom validators run non-interactively', () => {
    const fixtureDir = createFixtureDir();
    const docPath = path.join(fixtureDir, 'sample.workspec.json');
    const customPath = path.join(fixtureDir, 'safe-custom.js');

    writeJson(docPath, baseDoc());
    fs.writeFileSync(customPath, 'function validateOk(metric) { return []; }\n', 'utf8');

    const result = runCli([
        'validate',
        '--custom',
        customPath,
        docPath,
        '--json'
    ]);

    assert.equal(result.status, 2);
    assert.equal(result.stderr.includes('Re-run with -y/--yes to skip confirmation'), true);
});

test('CLI rejects custom catalogs that name non-validate functions', () => {
    const fixtureDir = createFixtureDir();
    const docPath = path.join(fixtureDir, 'sample.workspec.json');
    const customPath = path.join(fixtureDir, 'catalog-function-name.js');
    const catalogPath = path.join(fixtureDir, 'metrics-catalog-custom.json');

    writeJson(docPath, baseDoc());
    fs.writeFileSync(customPath, [
        'function anythingGoes(metric) {',
        '    return [];',
        '}',
        ''
    ].join('\n'), 'utf8');
    writeJson(catalogPath, [
        {
            id: 'custom.bad_function_name',
            function: 'anythingGoes',
            params: {}
        }
    ]);

    const result = runCli([
        'validate',
        '--custom',
        customPath,
        '--custom-catalog',
        catalogPath,
        docPath,
        '--json',
        '-y'
    ]);

    assert.equal(result.status, 1);
    assert.equal(JSON.parse(result.stdout).problems.some((problem) => {
        return problem.metric_id === 'custom.bad_function_name'
            && problem.detail.includes('Invalid custom validation function name');
    }), true);
});

test('CLI blocks relative path traversal for custom validator inputs', () => {
    const fixtureDir = createFixtureDir();
    const subdir = path.join(fixtureDir, 'sandbox');
    const docPath = path.join(subdir, 'sample.workspec.json');
    const customPath = path.join(fixtureDir, 'outside-custom.js');
    const catalogPath = path.join(fixtureDir, 'outside-catalog.json');

    fs.mkdirSync(subdir);
    writeJson(docPath, baseDoc());
    fs.writeFileSync(customPath, 'function validateAllowed() { return []; }\n', 'utf8');
    fs.writeFileSync(catalogPath, '[]\n', 'utf8');

    const customResult = runCli([
        'validate',
        '--custom',
        '../outside-custom.js',
        'sample.workspec.json',
        '--json',
        '-y'
    ], {
        cwd: subdir
    });
    assert.equal(customResult.status, 2);
    assert.equal(customResult.stderr.includes('path traversal segments'), true);

    const catalogResult = runCli([
        'validate',
        '--custom',
        customPath,
        '--custom-catalog',
        '../outside-catalog.json',
        docPath,
        '--json',
        '-y'
    ], {
        cwd: subdir
    });
    assert.equal(catalogResult.status, 2);
    assert.equal(catalogResult.stderr.includes('path traversal segments'), true);
});
