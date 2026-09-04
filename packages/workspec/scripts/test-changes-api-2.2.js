#!/usr/bin/env node
'use strict';

const assert = require('assert/strict');
const { runtime } = require('..');

function documentValue() {
    return {
        simulation: {
            schema_version: '2.2',
            meta: { title: 'Changes API test', description: 'Exercises Changes handlers.', domain: 'qa' },
            world: {
                objects: [
                    { id: 'worker', type: 'actor', name: 'Worker', properties: { state: 'idle' } },
                    { id: 'item', type: 'resource', name: 'Item', location: 'store', properties: { state: 'ready', quantity: 5 } }
                ],
                layout: { locations: [{ id: 'store', name: 'Store' }, { id: 'bench', name: 'Bench' }] },
                digital_locations: [],
                displays: []
            },
            process: {
                tasks: [
                    { id: 'first', actor_id: 'worker', start: '09:00', duration: '10m' },
                    { id: 'second', actor_id: 'worker', start: '09:20', duration: '10m' }
                ]
            }
        }
    };
}

const changes = `
const firstTask = WorkSpec.task("first");
firstTask.onStart(() => {
    set("worker", "state", "working", { temporary: true });
    move("item", "bench");
});
firstTask.onComplete(() => {
    change("item", "quantity", -2);
    create({ id: "result", type: "product", name: "Result", properties: { quantity: 1 } });
});

WorkSpec.task("second", task => {
    task.onStart(context => {
        if (context.taskId !== "second" || context.phase !== "start") throw new Error("wrong callback context");
        set("worker", "state", "busy", { temporary: true });
    });
    task.onComplete(() => {
        remove("result");
        set("item", "state", "finished");
    });
});
`;

const compiled = runtime.compileChanges(changes);
assert.equal(compiled.get('first:start').length, 2, 'ambient set and move were not captured');
assert.equal(compiled.get('first:completion').length, 2, 'ambient change and create were not captured');
assert.equal(compiled.get('second:start').length, 1, 'grouped start handler was not captured');
assert.equal(compiled.get('second:completion').length, 2, 'grouped completion handler was not captured');
assert.equal(compiled.get('first:start')[0].temporary, true, 'temporary start effect was not preserved');

const run = runtime.runProject(documentValue(), changes, '', { seed: 1 });
assert.equal(run.problems.some(problem => problem.severity === 'error'), false, 'Changes project did not execute cleanly');
const state = runtime.serialiseState(run);
assert.equal(state.objects.item.properties.quantity, 3, 'ambient change did not execute');
assert.equal(state.objects.item.location, 'bench', 'ambient move did not execute');
assert.equal(state.objects.item.properties.state, 'finished', 'ambient set did not execute');
assert.equal(state.objects.worker.properties.state, 'idle', 'temporary effects did not restore initial state');
assert.equal(state.objects.result, undefined, 'ambient remove did not execute after ambient create');

const handles = runtime.compileChanges(`
const task = WorkSpec.task("first");
if (task !== WorkSpec.task("first")) throw new Error("task handles are not reusable");
let groupedHandle;
const returnedHandle = WorkSpec.task("second", handle => { groupedHandle = handle; });
if (returnedHandle !== groupedHandle || returnedHandle !== WorkSpec.task("second")) throw new Error("grouped form uses a different task handle");
task.onStart(() => set("worker", "state", "one", { temporary: true }));
task.onStart(() => set("item", "state", "two", { temporary: true }));
WorkSpec.task("first").onComplete(() => set("item", "state", "three"));
`);
assert.equal(handles.get('first:start').length, 2, 'multiple handlers on one reusable handle were not retained');
assert.equal(handles.get('first:completion').length, 1, 'chained handler was not retained');

assert.throws(() => runtime.compileChanges(`
let escaped;
WorkSpec.task("first").onStart(() => { escaped = () => set("worker", "state", "leaked"); });
escaped();
`), /only be used inside a task handler/, 'a helper leaked beyond its active handler context');

const rebound = runtime.compileChanges(`
let firstHelper;
WorkSpec.task("first").onStart(() => { firstHelper = set; });
WorkSpec.task("second").onStart(() => { firstHelper("worker", "state", "second-context"); });
`);
assert.equal(rebound.get('first:start'), undefined, 'capturing an ambient helper unexpectedly created an effect');
assert.equal(rebound.get('second:start')[0].property_changes.state.set, 'second-context', 'ambient helper did not resolve the currently active handler');

runtime.compileChanges('WorkSpec.task("first").onStart(() => { globalThis.__workspecTestHelper = set; });');
try {
    assert.throws(() => runtime.compileChanges('WorkSpec.task("second").onStart(() => globalThis.__workspecTestHelper("worker", "state", "leaked"));'), /only be used inside a task handler/, 'helpers leaked execution context between WorkSpec runs');
} finally {
    delete globalThis.__workspecTestHelper;
}

const analysisSource = `
WorkSpec.task("first").onStart(() => set("worker", "state", "working"));
const secondTask = WorkSpec.task("second");
secondTask.onComplete(() => change("item", "quantity", -1));
WorkSpec.task("third", task => { task.onStart(() => move("item", "bench")); });
WorkSpec.task(getTaskId()).onComplete(() => {});
`;
const analysis = runtime.analyzeChanges(analysisSource, { taskIds: ['first', 'second'] });
assert.deepEqual(analysis.taskReferences.map(reference => [reference.taskId, reference.form]), [
    ['first', 'chained'], ['second', 'stored'], ['third', 'grouped']
]);
assert.deepEqual(analysis.handlers.map(handler => [handler.taskId, handler.phase, handler.form]), [
    ['first', 'start', 'chained'], ['second', 'completion', 'stored'], ['third', 'start', 'grouped']
]);
assert.deepEqual(analysis.targetReferences.map(reference => reference.targetId).sort(), ['item', 'item', 'worker']);
assert.equal(analysis.diagnostics.some(diagnostic => diagnostic.code === 'changes.task.unknown' && diagnostic.taskId === 'third'), true);
assert.equal(analysis.diagnostics.some(diagnostic => diagnostic.code === 'changes.task.dynamic'), true);
const reassignedAnalysis = runtime.analyzeChanges('let task = WorkSpec.task("first"); task = chooseTask(); task.onStart(() => {});');
assert.equal(reassignedAnalysis.handlers.length, 0, 'analysis guessed through a reassigned task handle');
assert.equal(reassignedAnalysis.diagnostics.some(diagnostic => diagnostic.code === 'changes.task.alias_dynamic'), true);
assert.equal(runtime.analyzeChanges('WorkSpec.task("first", task => task.onStart(() => {}));').handlers[0].form, 'grouped', 'expression-bodied grouped form was not indexed');
const unknownRun = runtime.runProject(documentValue(), 'WorkSpec.task("missing").onComplete(() => set("item", "state", "wrong"));', '', { seed: 1 });
assert.equal(unknownRun.problems.some(problem => problem.metric_id === 'changes.task.unknown'), true, 'runtime did not report a Changes handler for an unknown Starting State task');

// Existing destructured callbacks remain source-compatible, but ambient helpers are canonical.
const legacy = runtime.compileChanges('WorkSpec.task("first").onComplete(({ set }) => set("item", "state", "legacy"));');
assert.equal(legacy.get('first:completion').length, 1);

process.stdout.write('✓ WorkSpec 2.2 ambient Changes API and analysis\n');
