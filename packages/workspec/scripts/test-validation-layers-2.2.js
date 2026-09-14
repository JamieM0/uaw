#!/usr/bin/env node
'use strict';

const assert = require('assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const workspec = require('..');

const hasMetric = (problems, id) => problems.some((problem) => problem.metric_id === id);

function startingState(objects, tasks, additions = {}) {
    return {
        simulation: {
            schema_version: '2.2',
            meta: { title: 'Validation layers', description: 'WorkSpec 2.2 regression fixture', domain: 'qa' },
            config: { time_unit: 'minutes', start_time: '09:00', end_time: '11:00', currency: 'GBP', locale: 'en-GB', timezone: 'UTC' },
            world: { layout: { locations: [{ id: 'room', name: 'Room' }] }, objects },
            process: { tasks },
            ...additions
        }
    };
}

function worker(id = 'worker') {
    return { id, type: 'actor', name: id, location: 'room', properties: { state: 'idle' } };
}

function resource(id = 'material', quantity = 1) {
    return { id, type: 'resource', name: id, properties: { quantity } };
}

function task(id = 'work', actorId = 'worker', start = '09:00', duration = '1m') {
    return { id, actor_id: actorId, start, duration };
}

// Document validation never makes the unbounded 2.2 unused-resource claim.
{
    const document = startingState([worker(), resource()], [task()]);
    assert.equal(hasMetric(workspec.validate(document).problems, 'object.optimization.unused_resource'), false);
    assert.equal(hasMetric(workspec.validateProject(document).problems, 'object.optimization.unused_resource'), false);
    const bounded = workspec.validateProject(document, { until: 542 });
    const unused = bounded.problems.find((problem) => problem.metric_id === 'object.optimization.unused_resource');
    assert.ok(unused, 'bounded project validation did not report a genuinely unused resource');
    assert.equal(unused.scope, 'runtime');
    assert.equal(unused.context.horizon_minutes, 542);
    assert.doesNotMatch(unused.detail, /remove/i, 'bounded diagnostic should not infer removal policy');
}

// Changes effects and authored reservations both count as actual runtime use.
{
    const changesDocument = startingState([worker(), resource()], [task()]);
    const changes = 'WorkSpec.task("work").onComplete(() => change("material", "quantity", -1));';
    const changesResult = workspec.validateProject(changesDocument, { changesSource: changes, until: 542 });
    assert.equal(hasMetric(changesResult.problems, 'object.optimization.unused_resource'), false);
    assert.equal(changesResult.state.objects.material.properties.quantity, 0);

    const reservedTask = { ...task(), reservations: [{ resource: 'material', mode: 'exclusive' }] };
    const reservationResult = workspec.validateProject(startingState([worker(), resource()], [reservedTask]), { until: 542 });
    assert.equal(hasMetric(reservationResult.problems, 'object.optimization.unused_resource'), false);
}

// Starting State cannot compute asymmetric 2.2 profitability.
{
    const objects = [
        { ...worker(), properties: { state: 'idle', cost_per_hour: 60 } },
        { ...resource(), properties: { quantity: 1, cost_per_unit: 10 } },
        { id: 'goods', type: 'product', name: 'Goods', properties: { quantity: 0, revenue_per_unit: 100 } }
    ];
    const document = startingState(objects, [task('work', 'worker', '09:00', '60m')]);
    const changes = 'WorkSpec.task("work").onComplete(() => { change("material", "quantity", -1); change("goods", "quantity", 1); });';
    assert.equal(hasMetric(workspec.validate(document).problems, 'economic.profitability.negative_margin'), false);
    const project = workspec.validateProject(document, { changesSource: changes, until: 601 });
    assert.equal(hasMetric(project.problems, 'economic.profitability.negative_margin'), false);
    assert.equal(project.state.objects.goods.properties.quantity, 1);
}

// Mutually exclusive conditional tasks do not produce an execution conflict.
{
    const flag = { id: 'flag', type: 'digital_object', name: 'Flag', properties: { state: 'a', quantity: 0 } };
    const tasks = [
        { ...task('a', 'worker', '09:00', '10m'), when: { '==': ['@flag.state', 'a'] } },
        { ...task('b', 'worker', '09:00', '10m'), when: { '==': ['@flag.state', 'b'] } }
    ];
    const document = startingState([worker(), flag], tasks);
    assert.equal(hasMetric(workspec.validate(document).problems, 'temporal.scheduling.actor_overlap'), false);
    assert.equal(workspec.validateProject(document).problems.some((problem) => problem.metric_id.startsWith('temporal.scheduling.actor_overlap')), false);
}

// A performer may be created before the task that binds it.
{
    const document = startingState([worker('starter')], [
        task('make', 'starter', '09:00', '1m'),
        { ...task('use', 'future_worker', '09:02', '1m'), depends_on: ['make'] }
    ]);
    const changes = 'WorkSpec.task("make").onComplete(() => create({ id: "future_worker", type: "actor", name: "Future Worker", properties: { state: "idle" } }));';
    assert.equal(hasMetric(workspec.validate(document).problems, 'task.reference.invalid_actor'), false);
    const project = workspec.validateProject(document, { changesSource: changes, until: 544 });
    assert.equal(hasMetric(project.problems, 'task.reference.invalid_actor'), false);
    assert.equal(project.state.task_statuses.use, 'completed');
}

// Missing/malformed performer expressions remain document-local errors, while
// unknown literal performers are deferred to runtime liveness.
{
    const malformed = startingState([worker()], [{ ...task(), actor_id: {} }]);
    const missing = startingState([worker()], [{ ...task(), actor_id: '' }]);
    assert.equal(hasMetric(workspec.validate(malformed).problems, 'task.reference.invalid_actor'), true);
    assert.equal(hasMetric(workspec.validate(missing).problems, 'task.reference.invalid_actor'), true);
}

// Canonical and runtime performer semantics both honor can_be_actor_id traits.
{
    const document = startingState(
        [{ id: 'robot', type: 'robot', name: 'Robot', properties: { quantity: 1 } }],
        [task('work', 'robot')],
        {
            type_traits: { performer: { can_be_actor_id: true } },
            type_definitions: { robot: { extends: 'resource', traits: ['performer'] } }
        }
    );
    assert.equal(hasMetric(workspec.validate(document).problems, 'task.reference.invalid_actor'), false);
    assert.equal(hasMetric(workspec.validateProject(document, { until: 542 }).problems, 'task.reference.invalid_actor'), false);
}

// Generator precedence is evaluated before bounded project conclusions.
{
    const document = startingState([worker(), resource('stock', 0)], [task()]);
    const changes = 'WorkSpec.task("work").onStart(() => change("stock", "quantity", -1));';
    const generator = 'WorkSpec.onStart(({ set }) => set("stock", "quantity", 10));';
    const project = workspec.validateProject(document, { changesSource: changes, generatorSource: generator, seed: 7, until: 542 });
    assert.equal(project.state.objects.stock.properties.quantity, 10);
    assert.equal(hasMetric(project.problems, 'generator.changes.conflict'), true);
    assert.equal(hasMetric(project.problems, 'object.optimization.unused_resource'), false);
}

// Runtime writes preserve declared location and State Library invariants.
{
    const moved = workspec.validateProject(startingState([worker()], [task()]), {
        changesSource: 'WorkSpec.task("work").onComplete(() => move("worker", "missing"));',
        until: 542
    });
    assert.equal(hasMetric(moved.problems, 'object.reference.invalid_location'), true);
    assert.equal(moved.state.objects.worker.location, 'room');

    const machine = { id: 'machine', type: 'equipment', name: 'Machine', properties: { state: 'idle' }, state_library: 'machine_states' };
    const document = startingState([worker(), machine], [task()], {
        state_libraries: { machine_states: { states: ['idle', 'working'] } }
    });
    const changed = workspec.validateProject(document, {
        changesSource: 'WorkSpec.task("work").onComplete(() => set("machine", "state", "teleported"));',
        until: 542
    });
    assert.equal(hasMetric(changed.problems, 'state_visuals.reference.invalid_runtime_state'), true);
    assert.equal(changed.state.objects.machine.properties.state, 'idle');
}

// Capacity diagnostics keep runtime provenance and reach the project result.
{
    const equipment = { id: 'station', type: 'equipment', name: 'Station', properties: { state: 'idle', capacity: 1 } };
    const tasks = ['a', 'b'].map((id, index) => ({
        ...task(id, `worker_${index + 1}`, '09:00', '10m'),
        reservations: [{ resource: 'station', mode: 'capacity', amount: 1 }]
    }));
    const project = workspec.validateProject(startingState([worker('worker_1'), worker('worker_2'), equipment], tasks));
    assert.equal(hasMetric(project.problems, 'reservation.conflict.authored'), false);
    assert.equal(hasMetric(project.problems, 'reservation.capacity.exceeded'), true);
    assert.ok(project.problems.filter((problem) => problem.metric_id.startsWith('reservation.')).every((problem) => problem.scope === 'runtime'));
}

// Cross-file task references and source compilation failures are source-scoped.
{
    const document = startingState([worker()], [task()]);
    const unknown = workspec.validateProject(document, { changesSource: 'WorkSpec.task("missing").onComplete(() => {});' });
    const unknownProblem = unknown.problems.find((problem) => problem.metric_id === 'changes.task.unknown');
    assert.equal(unknownProblem.scope, 'source');

    const invalid = workspec.validateProject(document, { changesSource: 'WorkSpec.task("work").onComplete(() => {' });
    const compileProblem = invalid.problems.find((problem) => problem.metric_id === 'changes.compile.failed');
    assert.equal(compileProblem.scope, 'source');
}

// Constraints remain a distinct provenance layer.
{
    const document = startingState([worker()], [task()]);
    const project = workspec.validateProject(document, {
        constraintsSource: 'module.exports = { "domain.always": () => ({ message: "Expected test violation." }) };',
        until: 542
    });
    const violation = project.problems.find((problem) => problem.metric_id === 'domain.always');
    assert.equal(violation.scope, 'constraint');
}

// Legacy 2.0/2.1 inline-interaction checks remain enabled.
for (const version of ['2.0', '2.1']) {
    const document = startingState([worker(), resource('stock', 0), resource('spare', 1)], [
        {
            ...task(),
            interactions: [{ target_id: 'stock', property_changes: { quantity: { delta: -1 } } }]
        },
        task('overlap', 'worker', '09:00', '1m')
    ]);
    document.simulation.schema_version = version;
    const problems = workspec.validate(document).problems;
    assert.equal(hasMetric(problems, 'resource.flow.negative_stock'), true, `${version} lost legacy negative-stock validation`);
    assert.equal(hasMetric(problems, 'temporal.scheduling.actor_overlap'), true, `${version} lost legacy overlap validation`);
    assert.equal(hasMetric(problems, 'object.optimization.unused_resource'), true, `${version} lost legacy unused-resource validation`);
}

// User-facing CLI project validation uses the same seam and exposes provenance.
{
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'workspec-validation-layer-'));
    const startPath = path.join(directory, 'start.workspec.json');
    const changesPath = path.join(directory, 'changes.workspec.js');
    fs.writeFileSync(startPath, JSON.stringify(startingState([worker(), resource()], [task()])), 'utf8');
    fs.writeFileSync(changesPath, 'WorkSpec.task("work").onComplete(() => change("material", "quantity", -1));', 'utf8');
    const cliPath = path.join(__dirname, '..', 'bin', 'workspec.js');
    const result = spawnSync(process.execPath, [cliPath, 'validate', startPath, '--changes', changesPath, '--time', '09:02', '--json'], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const { problems } = JSON.parse(result.stdout);
    assert.equal(hasMetric(problems, 'object.optimization.unused_resource'), false);
    assert.ok(problems.every((problem) => problem.scope && problem.provenance));
}

process.stdout.write('✓ WorkSpec 2.2 validation layers\n');
