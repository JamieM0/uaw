#!/usr/bin/env node
'use strict';

const assert = require('assert/strict');
const { runtime, validate } = require('..');

function startingState(tasks = [{ id: 'work', actor_id: 'worker', start: '09:00', duration: '2m' }]) {
    return {
        simulation: {
            schema_version: '2.2',
            meta: { title: 'Generator test', description: 'Runtime contract', domain: 'Tests' },
            config: { time_unit: 'minutes', start_time: '09:00' },
            world: {
                layout: { locations: [{ id: 'bench', name: 'Bench', shape: { type: 'rect', x: 0, y: 0, width: 1, height: 1 } }] },
                objects: [
                    { id: 'worker', type: 'actor', name: 'Worker', location: 'bench', properties: { state: 'idle' } },
                    { id: 'item', type: 'resource', name: 'Item', location: 'bench', properties: { quantity: 0, roll: 0 } }
                ]
            },
            process: { tasks }
        }
    };
}

const changes = `WorkSpec.task('work').onStart(() => set('item', 'quantity', 10));`;
const generator = `
WorkSpec.onStart(({ set }) => set('item', 'quantity', 20));
WorkSpec.onUpdate(({ set, random }) => set('item', 'roll', random()));
`;
const first = runtime.runProject(startingState(), changes, generator, { seed: 42 });
const second = runtime.runProject(startingState(), changes, generator, { seed: 42 });
assert.equal(runtime.serialiseState(first).objects.item.properties.quantity, 20, 'Generator did not take precedence');
assert.ok(first.problems.some((problem) => problem.metric_id === 'generator.changes.conflict' && problem.severity === 'warning' && problem.context.target === 'item' && problem.context.property === 'quantity' && problem.context.time === 540), 'Generator conflict warning is incomplete');
assert.equal(first.history.filter((entry) => Number.isFinite(entry.time)).length, 3, 'Generator tick rule should produce start, 09:01 and 09:02 states');
assert.equal(runtime.serialiseState(first).objects.item.properties.roll, runtime.serialiseState(second).objects.item.properties.roll, 'Seeded generator is not deterministic');
assert.notEqual(runtime.serialiseState(first).objects.item.properties.roll, runtime.serialiseState(runtime.runProject(startingState(), changes, generator, { seed: 43 })).objects.item.properties.roll, 'Different seeds should vary generator output');

const conflictState = startingState([
    { id: 'a', actor_id: 'worker', start: '09:00', duration: '10m' },
    { id: 'b', actor_id: 'worker', start: '09:05', duration: '5m', depends_on: ['a'] }
]);
const validation = validate(conflictState);
const timingProblem = validation.problems.find((problem) => problem.metric_id === 'temporal.scheduling.dependency_violation');
assert.equal(validation.ok, false, 'Explicit dependency conflict must block validation');
assert.equal(timingProblem.context.suggested_start, '09:10');
assert.deepEqual(timingProblem.context.correction, { pointer: '/simulation/process/tasks/1/start', value: '09:10' });
assert.equal(runtime.resolveTimings(conflictState).timings.get('b').start, 545, 'Runtime mutated the explicit start');

const declarative = startingState();
declarative.simulation.process.tasks[0].interactions = [];
assert.ok(validate(declarative).problems.some((problem) => problem.metric_id === 'starting_state.behaviour.disallowed'), 'Starting State accepted executable behaviour');

process.stdout.write('✓ WorkSpec 2.2 Generator and timing contracts\n');
