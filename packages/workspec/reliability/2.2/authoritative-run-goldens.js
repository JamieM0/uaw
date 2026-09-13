'use strict';

function project(objects, tasks) {
    return {
        simulation: {
            schema_version: '2.2',
            meta: { title: 'Authoritative run golden', description: 'Tracked WorkSpec 2.2 reliability case', domain: 'qa' },
            config: { time_unit: 'minutes', start_time: '09:00', end_time: '11:00', currency: 'GBP', locale: 'en-GB', timezone: 'UTC' },
            world: {
                layout: { locations: [{ id: 'room', name: 'Room' }] },
                objects
            },
            process: { tasks }
        }
    };
}

const actor = (id = 'worker') => ({ id, type: 'actor', name: id, location: 'room', properties: { state: 'idle' } });
const stock = (quantity = 0) => ({ id: 'stock', type: 'resource', name: 'Stock', location: 'room', properties: { quantity } });
const task = (id, actorId, start, duration = '1m') => ({ id, actor_id: actorId, start, duration });

module.exports = [
    {
        id: 'pure-starting-state-and-changes',
        startingState: project([actor(), stock(2)], [task('consume', 'worker', '09:00')]),
        changes: 'WorkSpec.task("consume").onComplete(() => change("stock", "quantity", -1));',
        options: { until: 542, seed: 1 },
        expected: { status: ['consume', 'completed'], quantity: 1, metrics: [] }
    },
    {
        id: 'generator-causal-execution',
        startingState: project([actor(), stock(0)], [{ ...task('consume', 'worker', '09:01'), when: { '>': ['@stock.quantity', 0] } }]),
        changes: 'WorkSpec.task("consume").onComplete(() => change("stock", "quantity", -1));',
        generator: 'WorkSpec.onStart(({ set }) => set("stock", "quantity", 10));',
        options: { until: 542, seed: 17 },
        expected: { status: ['consume', 'completed'], quantity: 9, metrics: [] }
    },
    {
        id: 'generator-and-constraints',
        startingState: project([stock(0)], []),
        generator: 'WorkSpec.onStart(({ set }) => set("stock", "quantity", 4));',
        constraints: 'module.exports = { "golden.quantity": ({ get }) => get("stock", "quantity") === 4 ? null : { observed: get("stock", "quantity") } };',
        options: { until: 540, seed: 2 },
        expected: { quantity: 4, violations: 0, metrics: [] }
    },
    {
        id: 'conditional-work',
        startingState: project([actor(), stock(1)], [
            { ...task('runs', 'worker', '09:00'), when: { '>': ['@stock.quantity', 0] } },
            { ...task('skips', 'worker', '09:02'), when: false }
        ]),
        options: { until: 544, seed: 1 },
        expected: { statuses: { runs: 'completed', skips: 'skipped' }, quantity: 1, metrics: [] }
    },
    {
        id: 'reservation-conflict',
        startingState: project([
            actor('worker_a'), actor('worker_b'),
            { id: 'station', type: 'equipment', name: 'Station', location: 'room', properties: { state: 'idle', capacity: 1 } }
        ], [
            { ...task('a', 'worker_a', '09:00', '10m'), reservations: [{ resource: 'station', mode: 'capacity', amount: 1 }] },
            { ...task('b', 'worker_b', '09:00', '10m'), reservations: [{ resource: 'station', mode: 'capacity', amount: 1 }] }
        ]),
        options: { until: 551, seed: 1 },
        expected: { statuses: { a: 'blocked', b: 'blocked' }, metrics: ['reservation.capacity.exceeded'] }
    },
    {
        id: 'bounded-horizon',
        startingState: project([actor()], [
            task('active', 'worker', '09:00', '60m'),
            { id: 'later', actor_id: 'worker', duration: '1m', depends_on: ['active'] }
        ]),
        options: { until: 570, seed: 1 },
        expected: { statuses: { active: 'active', later: 'pending' }, metrics: [] }
    }
];
