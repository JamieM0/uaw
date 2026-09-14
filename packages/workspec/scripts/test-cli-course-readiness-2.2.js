#!/usr/bin/env node
'use strict';

const assert = require('assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const workspec = require('..');

function startingState(objects = [], tasks = [], additions = {}) {
    return {
        simulation: {
            schema_version: '2.2',
            meta: { title: 'CLI course readiness', description: 'Course-facing runtime regression', domain: 'qa' },
            config: { time_unit: 'minutes', start_time: '09:00', end_time: '11:00', currency: 'GBP', locale: 'en-GB', timezone: 'UTC' },
            world: { layout: { locations: [{ id: 'room', name: 'Room' }] }, objects },
            process: { tasks },
            ...additions
        }
    };
}

const actor = (id = 'worker') => ({ id, type: 'actor', name: id, location: 'room', properties: { state: 'idle' } });
const resource = (id = 'stock', quantity = 1) => ({ id, type: 'resource', name: id, location: 'room', properties: { quantity } });
const task = (id = 'work', actorId = 'worker', start = '09:00', duration = '1m') => ({ id, actor_id: actorId, start, duration });
const hasMetric = (problems, id) => problems.some((entry) => entry.metric_id === id);

// An exhausted run reports how far it really resolved and refuses later snapshots.
{
    const run = workspec.runtime.runProject(
        startingState([resource()], []),
        '',
        'WorkSpec.onUpdate(() => {});',
        { until: 1000, maxEvents: 2 }
    );
    assert.equal(run.requestedHorizon, 1000);
    assert.ok(run.resolvedThrough < 1000);
    assert.equal(run.resolvedThrough, run.history.at(-1).time);
    assert.throws(() => workspec.runtime.snapshotRunAt(run, 1000), /not resolved|resolved only through/i);
    globalThis.__workspec_unresolved_constraint_count__ = 0;
    const constrained = workspec.runtime.runConstraintsOnResult(run, `module.exports = {
        'test.must_not_run': () => { globalThis.__workspec_unresolved_constraint_count__ += 1; return null; }
    };`, { time: 1000 });
    assert.equal(globalThis.__workspec_unresolved_constraint_count__, 0);
    assert.equal(hasMetric(constrained.problems, 'runtime.execution.unresolved_time'), true);
    delete globalThis.__workspec_unresolved_constraint_count__;

    const beforeStart = workspec.runtime.runProject(startingState([resource()], []), '', '', { until: 539 });
    assert.equal(beforeStart.requestedHorizon, 539);
    assert.equal(beforeStart.resolvedThrough, 539);
    assert.ok(beforeStart.history.every((entry) => entry.time <= 539));
}

// A false when guard skips work before actor lookup or selection has side effects.
{
    const run = workspec.runtime.runProject(
        startingState([], [{ ...task('never', 'missing'), when: false }]),
        '', '', { until: 541 }
    );
    const state = workspec.runtime.serialiseState(run);
    assert.equal(state.task_statuses.never, 'skipped');
    assert.equal(hasMetric(run.problems, 'task.reference.invalid_actor'), false);
    assert.deepEqual(state.task_runtime.never.assignment_history, []);

    const dynamicDocument = startingState([actor(), resource()], [{
        ...task('dynamic_never'),
        actor_id: {
            select_member: {
                collection: 'performers',
                as: 'candidate',
                policy: 'lowest',
                by: '@room.score',
                tie_break: 'stable_id'
            }
        },
        when: false
    }], {
        collections: {
            performers: { from: 'objects', as: 'candidate', where: { '==': ['@candidate.type', 'actor'] } }
        }
    });
    dynamicDocument.simulation.world.layout.locations[0].properties = { score: 1 };
    const dynamicRun = workspec.runtime.runProject(dynamicDocument, '', '', { until: 541 });
    assert.equal(workspec.runtime.serialiseState(dynamicRun).task_statuses.dynamic_never, 'skipped');
    assert.deepEqual(workspec.runtime.serialiseState(dynamicRun).task_runtime.dynamic_never.assignment_history, []);
    assert.equal(dynamicRun.state.usage.has('room'), false);
}

// Historical snapshots contain only runtime task instances instantiated by that time.
{
    const document = startingState([actor()], [], {
        collections: {
            things: { from: 'objects', as: 'thing', open: true, closes_at: '10:00' }
        },
        process: {
            tasks: [],
            work_definitions: [{
                id: 'inspect',
                instantiate: { for_each: 'things', as: 'thing', start: 'on_appearance' },
                task: { actor_id: 'worker', duration: '1m' }
            }]
        }
    });
    const generator = `WorkSpec.onUpdate(({ time, create }) => {
        if (time === 541) create({ id: 'future_item', type: 'resource', name: 'Future Item', location: 'room', properties: { quantity: 1 } });
    });`;
    const run = workspec.runtime.runProject(document, '', generator, { until: 542 });
    const earlier = workspec.runtime.snapshotRunAt(run, 540);
    const later = workspec.runtime.snapshotRunAt(run, 541);
    assert.equal(Object.values(earlier.task_instances).some((entry) => entry.correlation_id === 'future_item'), false);
    assert.equal(Object.values(later.task_instances).some((entry) => entry.correlation_id === 'future_item'), true);
}

// Runtime-created objects obey authored-object identity and property contracts,
// and invalid creations never partially enter live state.
for (const collision of ['room', 'work', 'current']) {
    const document = startingState([actor()], [task()]);
    const generator = `WorkSpec.onStart(({ create }) => create({
        id: '${collision}', type: 'resource', name: 'Invalid', location: 'room', properties: { quantity: 1 }
    }));`;
    const run = workspec.runtime.runProject(document, '', generator, { until: 541 });
    assert.equal(workspec.runtime.serialiseState(run).objects[collision], undefined, `created colliding object ${collision}`);
    const expectedMetric = collision === 'current' ? 'reference.id.reserved_current' : 'reference.id.duplicate';
    assert.equal(hasMetric(run.problems, expectedMetric), true, `missing collision problem for ${collision}`);
}
{
    const document = startingState([actor()], [task()], {
        type_definitions: {
            vehicle: {
                extends: 'equipment',
                additional_properties: { speed: { type: 'number' } }
            }
        }
    });
    const generator = `WorkSpec.onStart(({ create }) => create({
        id: 'van', type: 'vehicle', name: 'Van', location: 'room', properties: { state: 'idle', speed: 'fast' }
    }));`;
    const run = workspec.runtime.runProject(document, '', generator, { until: 541 });
    assert.equal(workspec.runtime.serialiseState(run).objects.van, undefined);
    assert.equal(hasMetric(run.problems, 'object.property.type.declared'), true);
}

// maxEvents bounds processed work, including many tasks at one timestamp, and
// invalid/clamped API values are never silent.
{
    const objects = Array.from({ length: 3 }, (_, index) => actor(`worker_${index}`));
    const tasks = objects.map((entry, index) => task(`work_${index}`, entry.id, '09:00', '10m'));
    const run = workspec.runtime.runProject(startingState(objects, tasks), '', '', { until: 551, maxEvents: 1 });
    assert.equal(hasMetric(run.problems, 'runtime.execution.event_limit'), true);
    assert.ok([...run.state.statuses.values()].filter((status) => status === 'active' || status === 'completed').length <= 1);

    const invalid = workspec.runtime.runProject(startingState(), '', '', { until: 540, maxEvents: 0 });
    assert.equal(hasMetric(invalid.problems, 'runtime.configuration.max_events_invalid'), true);

    const clamped = workspec.runtime.runProject(startingState(), '', '', { until: 540, maxEvents: 1_000_001 });
    assert.equal(hasMetric(clamped.problems, 'runtime.configuration.max_events_clamped'), true);
}

// Boolean expressions short-circuit usage reads, while a failed reservation
// still counts as a real attempted use of its target.
{
    const shortCircuited = workspec.validateProject(startingState([actor(), resource()], [
        { ...task(), when: { all: [false, { '>': ['@stock.quantity', 0] }] } }
    ]), { until: 541 });
    assert.equal(hasMetric(shortCircuited.problems, 'object.optimization.unused_resource'), true);
    const shortCircuitedAny = workspec.validateProject(startingState([actor(), resource()], [
        { ...task(), when: { any: [true, { '>': ['@stock.quantity', 0] }] } }
    ]), { until: 541 });
    assert.equal(hasMetric(shortCircuitedAny.problems, 'object.optimization.unused_resource'), true);

    const station = { id: 'station', type: 'equipment', name: 'Station', location: 'room', properties: { state: 'idle', capacity: 1 } };
    const contenders = ['a', 'b'].map((id, index) => ({
        ...task(id, `worker_${index}`, '09:00', '10m'),
        reservations: [{ resource: 'station', mode: 'capacity', amount: 1 }]
    }));
    const attempted = workspec.validateProject(startingState([actor('worker_0'), actor('worker_1'), station], contenders), { until: 541 });
    assert.equal(hasMetric(attempted.problems, 'reservation.capacity.exceeded'), true);
    assert.equal(attempted.problems.some((entry) => entry.metric_id === 'object.optimization.unused_resource' && entry.context?.object_id === 'station'), false);
}

// Clean JSON validation always carries mode and authoritative-run provenance.
{
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'workspec-course-ready-'));
    const startPath = path.join(directory, 'start.workspec.json');
    fs.writeFileSync(startPath, JSON.stringify(startingState()), 'utf8');
    const cliPath = path.join(__dirname, '..', 'bin', 'workspec.js');
    const result = spawnSync(process.execPath, [cliPath, 'validate', startPath, '--time', '09:00', '--seed', '17', '--json'], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const output = JSON.parse(result.stdout);
    assert.equal(output.validation.mode, 'project');
    assert.equal(output.run.seed, 17);
    assert.equal(output.run.requested_horizon, 540);
    assert.equal(output.run.resolved_through, 540);
    assert.deepEqual(output.problems, []);

    const documentOnly = spawnSync(process.execPath, [cliPath, 'validate', startPath, '--json'], { encoding: 'utf8' });
    assert.equal(documentOnly.status, 0, documentOnly.stderr || documentOnly.stdout);
    const documentOutput = JSON.parse(documentOnly.stdout);
    assert.equal(documentOutput.validation.mode, 'document');
    assert.equal(documentOutput.run, null);
    assert.deepEqual(documentOutput.problems, []);

    const invalidBudget = spawnSync(process.execPath, [cliPath, 'validate', startPath, '--time', '09:00', '--max-events', '0', '--json'], { encoding: 'utf8' });
    assert.equal(invalidBudget.status, 1);
    const invalidBudgetOutput = JSON.parse(invalidBudget.stdout);
    assert.equal(hasMetric(invalidBudgetOutput.problems, 'runtime.configuration.max_events_invalid'), true);
    assert.equal(invalidBudgetOutput.run.max_events, 10000);

    const invalidStartPath = path.join(directory, 'invalid.start.workspec.json');
    const invalidDocument = startingState();
    delete invalidDocument.simulation.meta.title;
    fs.writeFileSync(invalidStartPath, JSON.stringify(invalidDocument), 'utf8');
    const invalidProject = spawnSync(process.execPath, [cliPath, 'validate', invalidStartPath, '--time', '09:00', '--seed', '23', '--json'], { encoding: 'utf8' });
    assert.equal(invalidProject.status, 1);
    const invalidProjectOutput = JSON.parse(invalidProject.stdout);
    assert.equal(invalidProjectOutput.validation.mode, 'project');
    assert.equal(invalidProjectOutput.run.executed, false);
    assert.equal(invalidProjectOutput.run.seed, 23);
    assert.equal(invalidProjectOutput.run.requested_horizon, 540);
    assert.equal(invalidProjectOutput.run.resolved_through, null);
}

// CLI validation, snapshots, and Constraints each execute a stateful Generator
// once and report metadata/state from that same run.
{
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'workspec-cli-authority-'));
    const startPath = path.join(directory, 'start.workspec.json');
    const generatorPath = path.join(directory, 'generator.workspec.js');
    const constraintsPath = path.join(directory, 'constraints.workspec.js');
    fs.writeFileSync(startPath, JSON.stringify(startingState([resource('stock', 0)])), 'utf8');
    fs.writeFileSync(generatorPath, `globalThis.__workspec_cli_run_count__ = (globalThis.__workspec_cli_run_count__ || 0) + 1;
        const runNumber = globalThis.__workspec_cli_run_count__;
        WorkSpec.onStart(({ set }) => set('stock', 'quantity', runNumber));`, 'utf8');
    fs.writeFileSync(constraintsPath, `module.exports = {
        'test.same_run': (context) => ({ message: 'same run', observed: context.get('stock', 'quantity') })
    };`, 'utf8');
    const cliPath = path.join(__dirname, '..', 'bin', 'workspec.js');

    const validation = spawnSync(process.execPath, [cliPath, 'validate', startPath, '--generator', generatorPath, '--constraints', constraintsPath, '--time', '09:00', '--seed', '9', '--json', '--yes'], { encoding: 'utf8' });
    assert.equal(validation.status, 1, validation.stderr || validation.stdout);
    const validationOutput = JSON.parse(validation.stdout);
    assert.equal(validationOutput.problems.find((entry) => entry.metric_id === 'test.same_run').context.observed, 1);
    assert.equal(validationOutput.run.resolved_through, 540);

    const snapshot = spawnSync(process.execPath, [cliPath, 'snapshot', startPath, '--generator', generatorPath, '--time', '09:00', '--seed', '9', '--json'], { encoding: 'utf8' });
    assert.equal(snapshot.status, 0, snapshot.stderr || snapshot.stdout);
    const snapshotOutput = JSON.parse(snapshot.stdout);
    assert.equal(snapshotOutput.state.objects.stock.properties.quantity, 1);
    assert.equal(snapshotOutput.run.resolved_through, 540);
}

process.stdout.write('✓ WorkSpec 2.2 CLI course readiness\n');
