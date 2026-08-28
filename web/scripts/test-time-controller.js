const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
global.WorkSpecRuntime = require('../../packages/workspec/workspec-runtime.js');
const {
    DAY_MINUTES,
    normalizeDocument,
    buildSnapshot,
    dateForMinutes,
    durationMinutes,
    SCALES,
    SCALE_RATES,
    PLAYBACK_MINUTES_PER_SECOND,
    WorkSpecTimeController
} = require('../assets/js/playground/playground-time-controller.js');

assert.deepEqual(SCALES, ['day', 'week', 'month']);
assert.equal(PLAYBACK_MINUTES_PER_SECOND, 5);
assert.deepEqual(SCALE_RATES, { day: 5, week: 5, month: 5 });

const defaultRateController = new WorkSpecTimeController();
assert.equal(defaultRateController.getMinutesPerSecond(), 5);
defaultRateController.scale = 'week';
assert.equal(defaultRateController.getMinutesPerSecond(), 5);
defaultRateController.scale = 'month';
assert.equal(defaultRateController.getMinutesPerSecond(), 5);

const documentValue = {
    simulation: {
        config: {
            time_unit: 'minutes',
            start_time: '2027-03-14T08:00:00Z',
            end_time: '2027-05-01T18:00:00Z',
            locale: 'en-GB',
            timezone: 'UTC'
        },
        world: {
            objects: [
                { id: 'machine', type: 'equipment', name: 'Machine' },
                { id: 'operator', type: 'actor', name: 'Operator' },
                { id: 'report', type: 'digital', name: 'Report' }
            ],
            layout: { locations: [{ id: 'line', name: 'Line' }] }
        },
        process: {
            tasks: [
                {
                    id: 'setup', actor_id: 'operator', start: '2027-03-14T08:30:00Z', duration: 60,
                    location: 'line', interactions: [{ target_id: 'machine' }]
                },
                {
                    id: 'monthly_report', actor_id: 'operator', start: '2027-04-15T10:32:00Z', duration: '2h',
                    interactions: [{ target_id: 'report', action: 'create', object: { id: 'generated_invoice', type: 'digital', name: 'Generated invoice' } }]
                }
            ]
        }
    }
};

const model = normalizeDocument(documentValue, { now: new Date('2026-01-01T00:00:00Z') });
assert.equal(model.tasks.length, 2);
assert.equal(model.tasks[0].start_minutes, 8 * 60 + 30);
assert.equal(model.tasks[1].start_minutes, (32 * DAY_MINUTES) + (10 * 60) + 32);
assert.equal(model.tasks[1].duration_minutes, 120);
assert.equal(dateForMinutes(model.clock, model.tasks[1].start_minutes).toISOString(), '2027-04-15T10:32:00.000Z');

const duringSetup = buildSnapshot(model, 9 * 60);
assert.equal(duringSetup.taskStates.get('setup'), 'active');
assert.equal(duringSetup.taskStates.get('monthly_report'), 'upcoming');
assert.equal(duringSetup.objectStates.get('machine'), 'active');
assert.equal(duringSetup.objectStates.get('report'), 'upcoming');
assert.equal(duringSetup.objectStates.get('generated_invoice'), 'upcoming');
assert.equal(duringSetup.locationStates.get('line'), 'active');

const afterSetup = buildSnapshot(model, 12 * 60);
assert.equal(afterSetup.taskStates.get('setup'), 'completed');
assert.equal(afterSetup.objectStates.get('machine'), 'completed');
assert.equal(afterSetup.objectStates.get('operator'), 'inactive');

const dayTimeModel = normalizeDocument({
    simulation: {
        config: { time_unit: 'hours', start_time: '06:00', end_time: '18:00' },
        world: { objects: [] },
        process: { tasks: [{ id: 'day_three', actor_id: 'crew', start: { day: 3, time: '07:15' }, duration: 2 }] }
    }
}, { now: new Date('2027-01-10T12:00:00') });
assert.equal(dayTimeModel.tasks[0].start_minutes, (2 * DAY_MINUTES) + 435);
assert.equal(dayTimeModel.tasks[0].duration_minutes, 120);
assert.equal(durationMinutes('P1M'), 30 * DAY_MINUTES);
assert.equal(durationMinutes('2w'), 14 * DAY_MINUTES);

const selectionFixture = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../packages/workspec/reliability/06-deterministic-selection.valid.workspec.json'), 'utf8'));
const selectionModel = normalizeDocument(selectionFixture, { now: new Date('2027-01-10T12:00:00Z') });
assert.equal(selectionModel.tasks[0].actor_id, 'worker_a');
assert.ok(selectionModel.tasks[0].object_ids.includes('worker_a'));
assert.equal(selectionModel.tasks[0].runtime_status, 'completed');

const runtimeWorkFixture = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../packages/workspec/reliability/07-runtime-work.valid.workspec.json'), 'utf8'));
const runtimeWorkModel = normalizeDocument(runtimeWorkFixture, { now: new Date('2027-01-10T12:00:00Z') });
assert.equal(runtimeWorkModel.tasks.length, 1);
assert.equal(runtimeWorkModel.tasks[0].__runtime_instance, true);
assert.equal(runtimeWorkModel.tasks[0].__definition_id, 'process_file');
assert.equal(runtimeWorkModel.tasks[0].__correlation_id, 'file_a');

const priorDocument = global.document;
global.document = {
    createDocumentFragment() {
        return { children: [], appendChild(node) { this.children.push(node); } };
    }
};
const temporalNodes = ['inactive', 'active', 'active', 'completed'].map((state, index) => ({ id: index, dataset: { temporalState: state } }));
const temporalContainer = {
    children: [...temporalNodes],
    querySelectorAll() { return this.children; },
    appendChild(fragment) { this.children = [...fragment.children]; }
};
const controller = new WorkSpecTimeController();
controller.promoteContainer(temporalContainer, ':scope > *');
assert.deepEqual(temporalContainer.children.map(node => node.id), [1, 2, 0, 3]);
temporalNodes.forEach((node, index) => { node.dataset.temporalState = index === 0 ? 'active' : 'inactive'; });
controller.promoteContainer(temporalContainer, ':scope > *');
assert.deepEqual(temporalContainer.children.map(node => node.id), [0, 1, 2, 3]);
global.document = priorDocument;

console.log('WorkSpec time controller tests passed.');
