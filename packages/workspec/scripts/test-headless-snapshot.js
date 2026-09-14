#!/usr/bin/env node
'use strict';

const test = require('node:test');
const assert = require('assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const packageRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(packageRoot, '..', '..');
const cliPath = path.join(packageRoot, 'bin', 'workspec.js');
const runtime = require(path.join(packageRoot, 'workspec-runtime.js'));
const library = require(path.join(repoRoot, 'web', 'assets', 'static', 'simulation-library.json')).simulations;

const quantityConstraintSource = `
WorkSpec.constraint('inventory.non_negative', (ctx) => {
    const violations = [];
    for (const time of ctx.times()) {
        for (const [objectId, object] of Object.entries(ctx.stateAt(time).objects)) {
            const quantity = object.properties?.quantity;
            if (typeof quantity === 'number' && quantity < 0) violations.push({
                time, objects: [objectId], property: 'quantity', observed: quantity,
                expected: { min: 0 }, message: 'Inventory cannot be negative.'
            });
        }
    }
    return violations;
});
`;

function fixtureDir() {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'workspec-headless-'));
}

function writeJson(filePath, value) {
    fs.writeFileSync(filePath, JSON.stringify(value, null, 2), 'utf8');
}

function runCli(args) {
    return spawnSync(process.execPath, [cliPath, ...args], { encoding: 'utf8' });
}

function assertNoErrors(problems, message) {
    assert.equal(problems.some((problem) => problem.severity === 'error'), false, message);
}

test('snapshot CLI combines Starting State, Changes, and seeded Generator through the requested time', () => {
    const directory = fixtureDir();
    const startPath = path.join(directory, 'start.workspec.json');
    const changesPath = path.join(directory, 'changes.workspec.js');
    const generatorPath = path.join(directory, 'generator.workspec.js');
    writeJson(startPath, {
        simulation: {
            schema_version: '2.2',
            meta: { title: 'Headless CLI', description: 'Snapshot integration', domain: 'Tests' },
            config: { time_unit: 'minutes', start_time: '09:00', end_time: '18:00', currency: 'USD', locale: 'en-US', timezone: 'UTC' },
            world: {
                objects: [
                    { id: 'worker', type: 'actor', name: 'Worker', properties: { state: 'available' } },
                    { id: 'item', type: 'resource', name: 'Item', properties: { quantity: 0, ticks: 0 } }
                ]
            },
            process: { tasks: [{ id: 'produce', actor_id: 'worker', start: '09:00', duration: 2 }] }
        }
    });
    fs.writeFileSync(changesPath, 'WorkSpec.task("produce").onComplete(() => set("item", "quantity", 10));\n', 'utf8');
    fs.writeFileSync(generatorPath, [
        'WorkSpec.onUpdate(({ set, change, random }) => {',
        '    set("item", "sample", random());',
        '    change("item", "ticks", 1);',
        '});',
        ''
    ].join('\n'), 'utf8');

    const args = ['snapshot', startPath, '--changes', changesPath, '--generator', generatorPath, '--time', '09:04', '--seed', '7', '--json'];
    const first = runCli(args);
    const second = runCli(args);
    assert.equal(first.status, 0, first.stderr || first.stdout);
    assert.deepEqual(JSON.parse(first.stdout), JSON.parse(second.stdout));

    const output = JSON.parse(first.stdout);
    assert.deepEqual({ time: output.time, minutes: output.time_minutes, seed: output.seed }, { time: '09:04', minutes: 544, seed: 7 });
    assert.equal(output.state.objects.item.properties.quantity, 10);
    assert.equal(output.state.objects.item.properties.ticks, 4);
    assert.equal(typeof output.state.objects.item.properties.sample, 'number');
    assert.deepEqual(output.problems, []);
});

const dogfoodCases = {
    breadmaking: {
        time: 645, healthy: ['baked_bread', 4], broken: ['flour', -1],
        mutate(project) { project.simulation.world.objects.find((object) => object.id === 'flour').properties.quantity = 2; }
    },
    ecommerce_order: {
        time: 665, healthy: ['packed_order', 1], broken: ['inventory_stock', -1],
        mutate(project) { project.simulation.world.objects.find((object) => object.id === 'inventory_stock').properties.quantity = 0; }
    },
    electronics_assembly: {
        time: 805, healthy: ['finished_phones', 12], broken: ['processors', -4],
        mutate(project) { project.simulation.world.objects.find((object) => object.id === 'processors').properties.quantity = 10; }
    },
    pharmaceutical_production: {
        time: 1365, healthy: ['finished_drug_product', 380], broken: ['coating_solution', -2],
        mutate(project) { project.simulation.world.objects.find((object) => object.id === 'coating_solution').properties.quantity = 10; }
    },
    restaurant_kitchen: {
        time: 1320, healthy: ['finished_entrees', 21], broken: ['artisanal_greens', -0.5],
        mutate(project) { project.simulation.world.objects.find((object) => object.id === 'artisanal_greens').properties.quantity = 1; }
    },
    steam_sterilisation: {
        time: 630, healthy: ['released_sterile_trays', 2], broken: ['contaminated_trays', -1],
        mutate(project) { project.simulation.world.objects.find((object) => object.id === 'contaminated_trays').properties.quantity = 1; }
    },
    'coffee-shop-multiperiod': {
        time: 18180, healthy: ['coffee_beans', 10], broken: ['coffee_beans', -70],
        mutateChanges(changes) {
            const markerIndex = changes.indexOf('WorkSpec.task("day_13_weekend_service").onComplete(() => {');
            const oldDemand = 'change("coffee_beans", "quantity", -40);';
            const demandIndex = changes.indexOf(oldDemand, markerIndex);
            assert.notEqual(markerIndex, -1, 'day 13 demand handler is missing');
            assert.notEqual(demandIndex, -1, 'day 13 coffee demand is missing');
            return changes.slice(0, demandIndex) + 'change("coffee_beans", "quantity", -120);' + changes.slice(demandIndex + oldDemand.length);
        }
    }
};

function assertQuantity(output, expectation, message) {
    const [objectId, quantity] = expectation;
    assert.equal(output.state.objects[objectId].properties.quantity, quantity, message);
}

test('all simulation-library projects expose healthy and deliberately broken state through the CLI', () => {
    assert.deepEqual(library.map((entry) => entry.id).sort(), Object.keys(dogfoodCases).sort());

    for (const entry of library) {
        const directory = fixtureDir();
        const startPath = path.join(directory, 'start.workspec.json');
        const changesPath = path.join(directory, 'changes.workspec.js');
        const constraintsPath = path.join(directory, 'constraints.workspec.js');
        const brokenStartPath = path.join(directory, 'broken.start.workspec.json');
        const brokenChangesPath = path.join(directory, 'broken.changes.workspec.js');
        const scenario = dogfoodCases[entry.id];
        const project = { simulation: structuredClone(entry.simulation) };

        writeJson(startPath, project);
        fs.writeFileSync(changesPath, entry.changes, 'utf8');
        fs.writeFileSync(constraintsPath, quantityConstraintSource, 'utf8');
        const validation = runCli(['validate', startPath, '--json']);
        assert.equal(validation.status, 0, `${entry.id} should validate: ${validation.stderr || validation.stdout}`);
        assertNoErrors(JSON.parse(validation.stdout).problems, `${entry.id} validation should have no errors`);

        const snapshot = runCli(['snapshot', startPath, '--changes', changesPath, '--time', String(scenario.time), '--seed', '1', '--json']);
        assert.equal(snapshot.status, 0, `${entry.id} should run: ${snapshot.stderr || snapshot.stdout}`);
        const output = JSON.parse(snapshot.stdout);
        assertNoErrors(output.problems, `${entry.id} should have no runtime errors`);
        assertQuantity(output, scenario.healthy, `${entry.id} healthy outcome changed`);
        const healthyConstraints = runCli(['constraints', startPath, '--changes', changesPath, '--constraints', constraintsPath, '--time', String(scenario.time), '--seed', '1', '--json', '--yes']);
        assert.equal(healthyConstraints.status, 0, `${entry.id} healthy constraints should pass: ${healthyConstraints.stderr || healthyConstraints.stdout}`);
        assert.deepEqual(JSON.parse(healthyConstraints.stdout).violations, []);

        const brokenProject = structuredClone(project);
        scenario.mutate?.(brokenProject);
        const brokenChanges = scenario.mutateChanges ? scenario.mutateChanges(entry.changes) : entry.changes;
        writeJson(brokenStartPath, brokenProject);
        fs.writeFileSync(brokenChangesPath, brokenChanges, 'utf8');
        const brokenValidation = runCli(['validate', brokenStartPath, '--json']);
        assert.equal(brokenValidation.status, 0, `${entry.id} broken variant should remain structurally valid`);
        assertNoErrors(JSON.parse(brokenValidation.stdout).problems, `${entry.id} broken validation should have no errors`);

        const brokenSnapshot = runCli(['snapshot', brokenStartPath, '--changes', brokenChangesPath, '--time', String(scenario.time), '--seed', '1', '--json']);
        assert.equal(brokenSnapshot.status, 0, `${entry.id} broken variant should execute`);
        const brokenOutput = JSON.parse(brokenSnapshot.stdout);
        assertNoErrors(brokenOutput.problems, `${entry.id} broken variant should have no runtime errors`);
        assertQuantity(brokenOutput, scenario.broken, `${entry.id} bad world state was not observable`);
        const brokenConstraints = runCli(['constraints', brokenStartPath, '--changes', brokenChangesPath, '--constraints', constraintsPath, '--time', String(scenario.time), '--seed', '1', '--json', '--yes']);
        assert.equal(brokenConstraints.status, 1, `${entry.id} broken constraints should fail: ${brokenConstraints.stderr || brokenConstraints.stdout}`);
        const violations = JSON.parse(brokenConstraints.stdout).violations;
        assert.equal(violations.some((violation) => violation.objects.includes(scenario.broken[0])
            && violation.property === 'quantity' && violation.observed === scenario.broken[1]), true,
        `${entry.id} should identify the bad object and observed quantity`);
    }
});

test('runtime constraint context supports arbitrary read-only temporal queries and structured evidence', () => {
    const project = {
        simulation: {
            schema_version: '2.2',
            meta: { title: 'Constraint context', description: 'Runtime query coverage', domain: 'Tests' },
            config: { time_unit: 'minutes', start_time: '09:00', end_time: '09:03', currency: 'USD', locale: 'en-US', timezone: 'UTC' },
            world: {
                layout: { locations: [{ id: 'line_a', name: 'Line A' }, { id: 'line_b', name: 'Line B' }] },
                objects: [
                    { id: 'vessel', type: 'equipment', name: 'Vessel', properties: { quantity: 0, capacity: 2, temperature: 20 } },
                    { id: 'operator', type: 'actor', name: 'Operator', location: 'line_a', properties: { assigned_location: 'line_a', state: 'idle' } }
                ]
            },
            process: { tasks: [] }
        }
    };
    const generator = `WorkSpec.onUpdate(({ time, set, move }) => {
        if (time === 541) {
            set('vessel', 'quantity', 3);
            set('vessel', 'temperature', 150);
            set('operator', 'state', 'completed');
            move('operator', 'line_b');
        }
        if (time === 542) set('vessel', 'temperature', 20);
    });`;
    const constraints = `
module.exports = {
    'vessel.capacity': (ctx) => ctx.getAt(541, 'vessel', 'quantity') > ctx.getAt(541, 'vessel', 'capacity')
        ? { time: 541, objects: ['vessel'], property: 'quantity', observed: 3, expected: { max: 2 }, message: 'Capacity exceeded.' } : null,
    'vessel.temperature': (ctx) => ctx.getAt(541, 'vessel', 'temperature') > 100
        ? { time: 541, objects: ['vessel'], property: 'temperature', observed: 150, expected: { max: 100 }, message: 'Temperature out of range.' } : null,
    'operator.transition': (ctx) => ctx.getAt(540, 'operator', 'state') === 'idle' && ctx.getAt(541, 'operator', 'state') === 'completed'
        ? { time: 541, objects: ['operator'], property: 'state', observed: 'idle -> completed', message: 'Impossible state transition.' } : null,
    'operator.location': (ctx) => ctx.getAt(541, 'operator', 'location') !== ctx.getAt(541, 'operator', 'assigned_location')
        ? { time: 541, objects: ['operator'], property: 'location', observed: 'line_b', expected: 'line_a', message: 'Operator is in an incompatible place.' } : null,
    'vessel.safe_period': (ctx) => ctx.times().filter((time) => time >= 540 && time <= 542).some((time) => ctx.getAt(time, 'vessel', 'temperature') > 100)
        ? { time: 541, objects: ['vessel'], property: 'temperature', message: 'Safe temperature must hold throughout the period.' } : null
};`;

    const result = runtime.runConstraints(project, '', generator, constraints, { time: 542, seed: 1 });
    assert.deepEqual(result.problems, []);
    assert.deepEqual(result.violations.map((violation) => violation.constraint_id), [
        'vessel.capacity', 'vessel.temperature', 'operator.transition', 'operator.location', 'vessel.safe_period'
    ]);
    assert.equal(result.violations.every((violation) => violation.time === 541), true);
    const state = runtime.runConstraints(project, '', generator, 'module.exports = ctx => { ctx.state().objects.vessel.properties.quantity = 0; };', { time: 542 });
    assert.equal(state.problems[0].metric_id, 'constraint.execution.failed');
});
