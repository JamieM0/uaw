#!/usr/bin/env node
'use strict';

const assert = require('assert/strict');
const workspec = require('..');

function startingState(objects, tasks, additions = {}) {
    return {
        simulation: {
            schema_version: '2.2',
            meta: { title: 'Authoritative run', description: 'Single resolved execution regression', domain: 'qa' },
            config: { time_unit: 'minutes', start_time: '09:00', end_time: '11:00', currency: 'GBP', locale: 'en-GB', timezone: 'UTC' },
            world: { layout: { locations: [{ id: 'room', name: 'Room' }] }, objects },
            process: { tasks },
            ...additions
        }
    };
}

const worker = (id = 'worker') => ({ id, type: 'actor', name: id, location: 'room', properties: { state: 'idle' } });
const resource = (id = 'stock', quantity = 0) => ({ id, type: 'resource', name: id, location: 'room', properties: { quantity } });
const task = (id = 'work', actorId = 'worker', start = '09:01', duration = '1m') => ({ id, actor_id: actorId, start, duration });
const hasMetric = (problems, id) => problems.some((entry) => entry.metric_id === id);
const historyValues = (run, objectId, property) => run.history.map((entry) => ({
    time: entry.time,
    value: entry.state.objects.get(objectId)?.properties?.[property]
}));

// A finite horizon is a valid execution prefix. Future and active work stays
// pending/active without dependency or contention failures.
{
    const future = startingState([worker()], [
        task('predecessor', 'worker', '10:00', '10m'),
        { id: 'dependent', actor_id: 'worker', duration: '1m', depends_on: ['predecessor'] }
    ]);
    const futureRun = workspec.runtime.runProject(future, '', '', { until: 570 });
    assert.equal(workspec.runtime.serialiseState(futureRun).task_statuses.predecessor, 'pending');
    assert.equal(workspec.runtime.serialiseState(futureRun).task_statuses.dependent, 'pending');
    assert.equal(hasMetric(futureRun.problems, 'timing.resolution.dependency_unresolved'), false);

    const active = startingState([worker()], [
        task('predecessor', 'worker', '09:00', '60m'),
        { id: 'dependent', actor_id: 'worker', duration: '1m', depends_on: ['predecessor'] }
    ]);
    const activeRun = workspec.runtime.runProject(active, '', '', { until: 570 });
    assert.equal(workspec.runtime.serialiseState(activeRun).task_statuses.predecessor, 'active');
    assert.equal(workspec.runtime.serialiseState(activeRun).task_statuses.dependent, 'pending');
    assert.equal(hasMetric(activeRun.problems, 'timing.resolution.dependency_unresolved'), false);
}

// Authored schedules do not masquerade as observed contention when work is
// skipped or lies beyond the horizon.
{
    const skipped = startingState([worker()], [
        { ...task('a', 'worker', '09:00', '10m'), when: false },
        { ...task('b', 'worker', '09:00', '10m'), when: false }
    ]);
    const skippedRun = workspec.runtime.runProject(skipped, '', '', { until: 551 });
    assert.equal(skippedRun.problems.some((entry) => entry.metric_id.includes('actor_overlap')), false);

    const future = startingState([worker()], [
        task('a', 'worker', '10:00', '10m'),
        task('b', 'worker', '10:00', '10m')
    ]);
    const futureRun = workspec.runtime.runProject(future, '', '', { until: 570 });
    assert.equal(futureRun.problems.some((entry) => entry.metric_id.includes('actor_overlap') || entry.metric_id.startsWith('reservation.conflict')), false);
}

// Declarative expression syntax belongs to Starting State/document validation,
// even though runtime remains defensive.
{
    const document = startingState([worker()], [{ ...task(), when: { mystery_operator: [1, 2] } }]);
    const project = workspec.validateProject(document, { until: 542 });
    const syntax = project.problems.filter((entry) => entry.metric_id === 'condition.operator.invalid');
    assert.equal(syntax.length, 1);
    assert.equal(syntax[0].scope, 'document');
    assert.equal(syntax[0].provenance.source, 'start.workspec.json');

    const malformedReservation = startingState([worker()], [{ ...task(), reservations: {} }]);
    const reservationProject = workspec.validateProject(malformedReservation, { until: 542 });
    const reservationSyntax = reservationProject.problems.find((entry) => entry.metric_id === 'reservation.declaration.shape.invalid');
    assert.equal(reservationSyntax.scope, 'document');
    assert.equal(hasMetric(workspec.runtime.runProject(malformedReservation, '', '', { until: 542 }).problems, 'reservation.declaration.shape.invalid'), true);
}

// Runtime-created objects must name an existing State Library and start in one
// of its declared states.
{
    const base = startingState([worker()], [task('make', 'worker', '09:00')], {
        state_libraries: { machine_states: { states: ['idle', 'working'] } }
    });
    const unknownLibrary = workspec.runtime.runProject(base,
        `WorkSpec.task('make').onComplete(() => create({
            id: 'machine', type: 'equipment', name: 'Machine', location: 'room',
            state_library: 'missing_states', properties: { state: 'idle' }
        }));`, '', { until: 542 });
    assert.equal(hasMetric(unknownLibrary.problems, 'state_visuals.reference.unknown_library'), true);
    assert.equal(workspec.runtime.serialiseState(unknownLibrary).objects.machine, undefined);

    const invalidState = workspec.runtime.runProject(base,
        `WorkSpec.task('make').onComplete(() => create({
            id: 'machine', type: 'equipment', name: 'Machine', location: 'room',
            state_library: 'machine_states', properties: { state: 'broken' }
        }));`, '', { until: 542 });
    assert.equal(hasMetric(invalidState.problems, 'state_visuals.reference.invalid_runtime_state'), true);
    assert.equal(workspec.runtime.serialiseState(invalidState).objects.machine, undefined);
}

// Read-only expression access is deliberate resource use through the horizon.
{
    const document = startingState([worker(), resource('stock', 1)], [{
        ...task(),
        when: { '>': ['@stock.quantity', 0] }
    }]);
    const project = workspec.validateProject(document, { until: 542 });
    assert.equal(hasMetric(project.problems, 'object.optimization.unused_resource'), false);

    const generatorRead = workspec.validateProject(startingState([resource('stock', 1)], []), {
        generatorSource: 'WorkSpec.onStart(({ get }) => get("stock", "quantity"));',
        until: 540
    });
    assert.equal(hasMetric(generatorRead.problems, 'object.optimization.unused_resource'), false);
}

// A task whose transactional completion effect fails is not reported as an
// unqualified successful completion.
{
    const document = startingState([worker(), resource()], [task()]);
    const changes = `WorkSpec.task('work').onComplete(() => {
        remove('stock');
        set('stock', 'quantity', 99);
    });`;
    const run = workspec.runtime.runProject(document, changes, '', { until: 542 });
    assert.equal(hasMetric(run.problems, 'interaction.write.conflict'), true);
    assert.equal(workspec.runtime.serialiseState(run).task_statuses.work, 'failed');

    const removed = startingState([worker(), resource()], [
        task('remove_stock', 'worker', '09:00'),
        task('use_stock', 'worker', '09:02')
    ]);
    const removedChanges = `
        WorkSpec.task('remove_stock').onComplete(() => remove('stock'));
        WorkSpec.task('use_stock').onComplete(() => set('stock', 'quantity', 99));
    `;
    const removedRun = workspec.runtime.runProject(removed, removedChanges, '', { until: 544 });
    assert.equal(hasMetric(removedRun.problems, 'object.lifecycle.target_not_live'), true);
    assert.equal(workspec.runtime.serialiseState(removedRun).task_statuses.use_stock, 'failed');
}

// Minute-driven Generators and event-heavy projects fail closed at a bounded,
// configurable event count instead of allocating through an enormous horizon.
{
    const run = workspec.runtime.runProject(
        startingState([resource()], []),
        '',
        'WorkSpec.onUpdate(() => {});',
        { until: 1_000_000_000, maxEvents: 3 }
    );
    assert.equal(hasMetric(run.problems, 'runtime.execution.event_limit'), true);
    assert.ok(run.history.length <= 3);

    const exact = workspec.runtime.runProject(
        startingState([resource()], []),
        '',
        'WorkSpec.onStart(() => {});',
        { until: 540, maxEvents: 1 }
    );
    assert.equal(hasMetric(exact.problems, 'runtime.execution.event_limit'), false);
}

// Generator state participates in the execution observed by later task
// conditions and Changes, rather than being overlaid after task replay.
{
    const document = startingState([worker(), resource()], [{
        ...task(),
        when: { '>': ['@stock.quantity', 0] }
    }]);
    const changes = 'WorkSpec.task("work").onComplete(() => change("stock", "quantity", -1));';
    const generator = 'WorkSpec.onStart(({ set }) => set("stock", "quantity", 10));';
    const run = workspec.runtime.runProject(document, changes, generator, { seed: 7, until: 542 });
    const state = workspec.runtime.serialiseState(run);
    assert.equal(state.task_statuses.work, 'completed');
    assert.equal(state.objects.stock.properties.quantity, 9);
    assert.equal(hasMetric(run.problems, 'generator.changes.conflict'), false);
}

// Generator-created performers are live inputs to later actor binding.
{
    const document = startingState([resource()], [task('work', 'generated_worker')]);
    const generator = `WorkSpec.onStart(({ create }) => create({
        id: 'generated_worker', type: 'actor', name: 'Generated Worker',
        location: 'room', properties: { state: 'idle' }
    }));`;
    const run = workspec.runtime.runProject(document, '', generator, { seed: 1, until: 542 });
    assert.equal(workspec.runtime.serialiseState(run).task_statuses.work, 'completed');
    assert.equal(hasMetric(run.problems, 'task.reference.invalid_actor'), false);
}

// Generator owns same-time conflicts, but task decisions still observe the
// generated value and non-conflicting Changes remain effective.
{
    const document = startingState([worker(), resource()], [task('work', 'worker', '09:00')]);
    const changes = 'WorkSpec.task("work").onStart(() => set("stock", "quantity", -1));';
    const generator = 'WorkSpec.onStart(({ set }) => set("stock", "quantity", 10));';
    const run = workspec.runtime.runProject(document, changes, generator, { seed: 9, until: 541 });
    assert.equal(workspec.runtime.serialiseState(run).objects.stock.properties.quantity, 10);
    assert.equal(hasMetric(run.problems, 'generator.changes.conflict'), true);
}

// Seeded executions have deterministic full histories, not merely matching
// final overlays.
{
    const document = startingState([worker(), { ...resource(), properties: { quantity: 0, roll: 0 } }], []);
    const generator = 'WorkSpec.onUpdate(({ set, random }) => set("stock", "roll", random()));';
    const first = workspec.runtime.runProject(document, '', generator, { seed: 42, until: 543 });
    const second = workspec.runtime.runProject(document, '', generator, { seed: 42, until: 543 });
    const other = workspec.runtime.runProject(document, '', generator, { seed: 43, until: 543 });
    assert.deepEqual(historyValues(first, 'stock', 'roll'), historyValues(second, 'stock', 'roll'));
    assert.notDeepEqual(historyValues(first, 'stock', 'roll'), historyValues(other, 'stock', 'roll'));
}

// Constraints and historical snapshots consume one existing authoritative run.
{
    const counterName = '__workspec_authoritative_run_count__';
    globalThis[counterName] = 0;
    const document = startingState([resource()], []);
    const generator = `globalThis.${counterName} += 1;
        WorkSpec.onStart(({ set }) => set('stock', 'quantity', globalThis.${counterName}));`;
    const constraints = `module.exports = {
        'test.same_execution': (context) => ({
            message: 'execution evidence', observed: context.get('stock', 'quantity')
        }),
        'test.snapshot_agrees': (context) => ({
            message: 'snapshot evidence', observed: context.getAt(540, 'stock', 'quantity')
        })
    };`;
    try {
        const project = workspec.validateProject(document, {
            generatorSource: generator,
            constraintsSource: constraints,
            seed: 3,
            until: 541
        });
        assert.equal(globalThis[counterName], 1, 'project/Generator executed more than once');
        assert.equal(project.state.objects.stock.properties.quantity, 1);
        assert.deepEqual(project.violations.map((entry) => entry.observed), [1, 1]);
        assert.equal(workspec.runtime.snapshotRunAt(project.run, 540).objects.stock.properties.quantity, 1);
    } finally {
        delete globalThis[counterName];
    }
}

process.stdout.write('✓ WorkSpec 2.2 single authoritative run\n');
