'use strict'; // Run with Node's built-in test runner.

const test = require('node:test');
const assert = require('assert/strict');
const runtime = require('../workspec-runtime.js');
const validator = require('../workspec-validator.js');
const g008GroundedFixtures = require('./fixtures/g008-grounded-fixtures.js');

function documentWith(tasks = []) {
    return {
        simulation: {
            schema_version: '2.1',
            meta: { title: 'WorkSpec 2.1 semantics', description: 'Runtime regression fixture.', domain: 'qa' },
            config: { time_unit: 'minutes', start_time: '08:00', end_time: '12:00', currency: 'USD', locale: 'en-GB', timezone: 'UTC' },
            type_definitions: {},
            world: {
                layout: { locations: [
                    { id: 'bay', name: 'Bay', properties: { capacity: 3, access_level: 2 } },
                    { id: 'store', name: 'Store', properties: { capacity: 1 } }
                ] },
                objects: [
                    { id: 'actor_a', type: 'actor', name: 'Actor A', properties: { state: 'idle', permissions: ['run'] } },
                    { id: 'actor_b', type: 'actor', name: 'Actor B', properties: { state: 'idle' } },
                    { id: 'equipment_a', type: 'equipment', name: 'Equipment A', properties: { state: 'idle', permissions: ['run'] } },
                    { id: 'service_a', type: 'service', name: 'Service A', properties: { state: 'idle', permissions: ['run'] } },
                    { id: 'item', type: 'resource', name: 'Item', properties: { quantity: 10, receipt_verified: false, temperature: 4, flag: true } },
                    { id: 'machine', type: 'equipment', name: 'Machine', properties: { state: 'idle', capacity: 2 } }
                ]
            },
            process: { tasks }
        }
    };
}

function task(id, actorId, start, extras = {}) {
    return { id, actor_id: actorId, ...(start === undefined ? {} : { start }), duration: 30, ...extras };
}

function has(problems, metricId) {
    return problems.some((entry) => entry.metric_id === metricId);
}

test('entity IDs are document-wide, current is reserved, and definition keys stay separate', () => {
    const duplicate = documentWith([task('bay', 'actor_a', '09:00')]);
    assert.equal(has(validator.validate(duplicate).problems, 'reference.id.duplicate'), true);

    const reserved = documentWith([task('current', 'actor_a', '09:00')]);
    assert.equal(has(validator.validate(reserved).problems, 'reference.id.reserved_current'), true);

    const separateNamespace = documentWith();
    separateNamespace.simulation.type_definitions.item = { extends: 'resource' };
    const result = validator.validate(separateNamespace);
    assert.equal(has(result.problems, 'reference.id.duplicate'), false);
});

test('field, property, task, location, clock and literal references evaluate with strict types', () => {
    const conditions = {
        all: [
            { '==': [{ object: 'item', field: 'id' }, 'item'] },
            { '==': [{ object: 'item', property: 'quantity' }, 10] },
            { '==': [{ task: 'check', field: 'actor_id' }, 'actor_a'] },
            { '==': [{ location: 'bay', property: 'access_level' }, 2] },
            { '==': [{ task: 'current', field: 'start' }, { clock: 'now' }] },
            { '==': [{ literal: { object: 'item', property: 'quantity' } }, { literal: { object: 'item', property: 'quantity' } }] },
            { contains: [{ object: 'actor_a', property: 'permissions' }, 'run'] },
            { not: { '==': [1, 2] } },
            { any: [{ '<': [1, 2] }, { '>': [1, 2] }] },
            { '<=': [2, 2] },
            { '>=': [2, 2] },
            { '!=': [2, 3] },
            { held_for: { condition: { '==': [{ object: 'item', property: 'flag' }, true] }, duration: '30m' } }
        ]
    };
    const doc = documentWith([task('check', 'actor_a', '09:00', { requires: conditions })]);
    const run = runtime.replay(doc);
    assert.equal(run.state.statuses.get('check'), 'completed');
    assert.equal(run.problems.length, 0);

    const wrongType = documentWith([task('wrong_type', 'actor_a', '09:00', { requires: { '==': ['5', 5] } })]);
    assert.equal(has(runtime.validate(wrongType).problems, 'condition.type.incompatible'), true);
});

test('invalid references, fields and missing properties are evaluation errors', () => {
    const cases = [
        [{ '==': [{ object: 'item' }, 'actor_a'] }, 'reference.structured.malformed'],
        [{ '==': [{ object: 'item', field: 'bogus' }, 1] }, 'reference.member.unknown'],
        [{ '==': [{ object: 'item', property: 'missing' }, 1] }, 'reference.member.unknown'],
        [{ '==': [1] }, 'condition.operator.arity']
    ];
    cases.forEach(([requires, metric], index) => {
        const doc = documentWith([task(`case_${index}`, 'actor_a', '09:00', { requires })]);
        assert.equal(has(runtime.validate(doc).problems, metric), true, metric);
    });
});

test('compact references resolve object fields/properties, task fields, locations, current performer, and now', () => {
    const doc = documentWith([task('inspect', 'actor_a', '09:00', { requires: { all: [
        { '==': ['@item.id', 'item'] },
        { '==': ['@item.temperature', 4] },
        { '==': ['@inspect.actor_id', 'actor_a'] },
        { '==': ['@bay.name', 'Bay'] },
        { '==': ['@bay.access_level', 2] },
        { contains: ['@current.permissions', 'run'] },
        { '==': ['@inspect.start', '@now'] }
    ] } })]);
    const run = runtime.replay(doc);
    assert.equal(run.state.statuses.get('inspect'), 'completed');
    assert.equal(run.problems.length, 0);
});

test('literal ValueExpression strings and leading-at escapes follow the exact one-character rule', () => {
    assert.equal(runtime.normalizeValueExpression('@@machine.state').value, '@machine.state');
    assert.equal(runtime.normalizeValueExpression('@@@machine.state').value, '@@machine.state');
    const doc = documentWith([task('strings', 'actor_a', '09:00', { requires: { all: [
        { '==': ['approved', 'approved'] },
        { '==': ['@@machine.state', '@@machine.state'] },
        { '==': ['@@@machine.state', '@@@machine.state'] }
    ] } })]);
    assert.equal(runtime.replay(doc).state.statuses.get('strings'), 'completed');

    doc.simulation.meta.description = '@machine.state';
    doc.simulation.process.tasks[0].description = '@@machine.state';
    const snapshot = runtime.snapshotAt(doc, '09:30');
    assert.equal(doc.simulation.meta.description, '@machine.state');
    assert.equal(doc.simulation.process.tasks[0].description, '@@machine.state');
    assert.equal(snapshot.task_statuses.strings, 'completed');
});

test('unknown, malformed, nested, and invalid clock compact references fail clearly', () => {
    const cases = [
        ['@missing.state', 'reference.entity.unknown'],
        ['@item.missing', 'reference.member.unknown'],
        ['@machine.sensor.temperature', 'reference.compact.grammar'],
        ['@entity.', 'reference.compact.grammar'],
        ['@.field', 'reference.compact.grammar'],
        ['@now.value', 'reference.clock.invalid']
    ];
    cases.forEach(([operand, metric], index) => {
        const doc = documentWith([task(`compact_bad_${index}`, 'actor_a', '09:00', { requires: { '==': [operand, true] } })]);
        const problems = validator.validate(doc).problems;
        assert.equal(has(problems, metric), true, `${operand}: ${metric}`);
        assert.equal(problems.find((entry) => entry.metric_id === metric).suggestions.some((value) => value.includes('@')), true);
    });
});

test('resolved compact values retain strict types', () => {
    const doc = documentWith([task('resolved_type_error', 'actor_a', '09:00', { requires: { '==': ['@item.quantity', '10'] } })]);
    assert.equal(has(validator.validate(doc).problems, 'condition.type.incompatible'), true);
});

test('@now is rejected where an instant is not the required resolved type', () => {
    const reservation = documentWith([task('bad_clock_resource', 'actor_a', '09:00', { reservations: [{ resource: '@now', mode: 'exclusive' }] })]);
    assert.equal(has(validator.validate(reservation).problems, 'reservation.resource.type'), true);

    const timing = documentWith([task('bad_clock_timing', 'actor_a', '09:00', {
        timing: [{ relation: 'offset', event: 'start', relative_to: '@now', min_offset: 0 }]
    })]);
    assert.equal(has(validator.validate(timing).problems, 'timing.relative_to.invalid'), true);
});

test('dotted properties and built-in shadowing are rejected in objects, locations, effects, and custom types', () => {
    const doc = documentWith([task('bad_properties', 'actor_a', '09:00', {
        requires: { '==': ['@item.name', 'Item'] },
        interactions: [{ target_id: 'item', property_changes: { 'quality.result': { set: true } } }]
    })]);
    doc.simulation.world.objects.find((object) => object.id === 'item').properties['sensor.temperature'] = 4;
    doc.simulation.world.objects.find((object) => object.id === 'item').properties.name = 'shadow';
    doc.simulation.world.layout.locations[0].properties['access.level'] = 2;
    doc.simulation.type_definitions.custom_machine = {
        extends: 'equipment',
        additional_properties: { 'quality.result': { type: 'string' }, id: { type: 'string' } }
    };
    const problems = validator.validate(doc).problems;
    assert.equal(problems.filter((entry) => entry.metric_id === 'reference.property.dotted').length >= 4, true);
    assert.equal(has(problems, 'reference.property.shadows_builtin'), true);
    assert.equal(problems.some((entry) => entry.suggestions.some((suggestion) => suggestion.includes('sensor_temperature') || suggestion.includes('quality_result'))), true);
    assert.equal(runtime.replay(doc).state.statuses.get('bad_properties'), 'completed', 'built-in fields must take precedence over colliding properties');
});

test('structured compatibility references share compact semantics and exact reference-shaped literals stay escapable', () => {
    const compact = documentWith([task('compact', 'actor_a', '09:00', { requires: { '==': ['@item.quantity', 10] } })]);
    const structured = documentWith([task('structured', 'actor_a', '09:00', { requires: { '==': [{ object: 'item', property: 'quantity' }, 10] } })]);
    assert.equal(runtime.replay(compact).state.statuses.get('compact'), 'completed');
    assert.equal(runtime.replay(structured).state.statuses.get('structured'), 'completed');

    const literalShape = { object: 'item', property: 'quantity' };
    const literals = documentWith([task('literal_shapes', 'actor_a', '09:00', { requires: { all: [
        { '==': [{ literal: literalShape }, { literal: literalShape }] },
        { '==': [{ object: 'item', property: 'quantity', note: 'example' }, { object: 'item', property: 'quantity', note: 'example' }] }
    ] } })]);
    assert.equal(runtime.replay(literals).state.statuses.get('literal_shapes'), 'completed');
});

test('compact expressions work in effects, created objects, interaction targets, reservations, and timing', () => {
    const doc = documentWith([
        task('prepare', 'actor_a', '08:00', { interactions: [
            { target_id: 'machine', property_changes: { capacity: { set: '@item.temperature' } } },
            { action: 'create', object: { id: 'copy', type: 'resource', name: 'Copy', location: '@bay.id', properties: { quantity: '@item.quantity' } } }
        ] }),
        task('use_copy', 'actor_b', undefined, {
            depends_on: ['prepare'],
            timing: [{ relation: 'offset', event: 'start', relative_to: '@prepare.end', min_offset: 0 }],
            reservations: [{ resource: '@current.id', mode: 'exclusive' }],
            interactions: [{ target_id: '@copy.id', property_changes: { quantity: { delta: -1 } } }]
        })
    ]);
    const run = runtime.replay(doc);
    assert.equal(run.timings.get('use_copy').start, 8 * 60 + 30);
    assert.equal(run.state.objects.get('machine').properties.capacity, 4);
    assert.equal(run.state.objects.get('copy').properties.quantity, 9);
    assert.equal(run.problems.length, 0);
});

test('expressions are evaluated only in expression-enabled positions', () => {
    const doc = documentWith();
    doc.simulation.world.objects.find((object) => object.id === 'item').properties.reference_shaped_data = { object: 'item', property: 'quantity' };
    const snapshot = runtime.snapshotAt(doc, '09:00');
    assert.deepEqual(snapshot.objects.item.properties.reference_shaped_data, { object: 'item', property: 'quantity' });
});

test('when skips, requires blocks, and skipped tasks do not satisfy dependencies', () => {
    const doc = documentWith([
        task('optional', 'actor_a', '09:00', { when: { '==': [false, true] } }),
        task('dependent', 'actor_b', '09:30', { depends_on: ['optional'] }),
        task('mandatory', 'equipment_a', '10:00', { requires: { '==': [false, true] } })
    ]);
    const run = runtime.replay(doc);
    assert.equal(run.state.statuses.get('optional'), 'skipped');
    assert.equal(run.state.statuses.get('dependent'), 'blocked');
    assert.equal(run.state.statuses.get('mandatory'), 'blocked');
    assert.equal(has(run.problems, 'task.requires.failed'), true);
    assert.equal(has(run.problems, 'temporal.scheduling.dependency_violation'), true);
});

test('task actor references express same-actor and different-actor constraints', () => {
    const doc = documentWith([
        task('origin', 'actor_a', '08:00'),
        task('same_actor', 'actor_a', '08:30', {
            requires: { '==': [{ task: 'current', field: 'actor_id' }, { task: 'origin', field: 'actor_id' }] }
        }),
        task('different_actor', 'actor_b', '09:00', {
            requires: { '!=': [{ task: 'current', field: 'actor_id' }, { task: 'origin', field: 'actor_id' }] }
        }),
        task('wrong_actor', 'actor_a', '09:30', {
            requires: { '!=': [{ task: 'current', field: 'actor_id' }, { task: 'origin', field: 'actor_id' }] }
        })
    ]);
    const run = runtime.replay(doc);
    assert.equal(run.state.statuses.get('same_actor'), 'completed');
    assert.equal(run.state.statuses.get('different_actor'), 'completed');
    assert.equal(run.state.statuses.get('wrong_actor'), 'blocked');
});

test('interaction when, start, default completion, and temporary restoration are phased', () => {
    const doc = documentWith([
        task('prepare', 'actor_a', '08:00', { interactions: [
            { target_id: 'item', at: 'completion', property_changes: { receipt_verified: { set: true } } },
            { target_id: 'machine', property_changes: { state: { set: 'ready' } } }
        ] }),
        task('work', 'equipment_a', '09:00', { interactions: [
            { target_id: 'item', when: { '==': [false, true] }, property_changes: { quantity: { delta: -9 } } },
            { target_id: 'machine', temporary: true, property_changes: { state: { set: 'working' } } },
            { target_id: 'item', property_changes: { quantity: { delta: -1 } } }
        ] })
    ]);
    assert.equal(runtime.snapshotAt(doc, '08:15').objects.item.properties.receipt_verified, false);
    assert.equal(runtime.snapshotAt(doc, '08:30').objects.item.properties.receipt_verified, true);
    assert.equal(runtime.snapshotAt(doc, '09:15').objects.machine.properties.state, 'working');
    const completed = runtime.snapshotAt(doc, '09:30');
    assert.equal(completed.objects.machine.properties.state, 'ready');
    assert.equal(completed.objects.item.properties.quantity, 9);
});

test('temporary lifecycle and completion-timed temporary effects are invalid', () => {
    const created = { id: 'created', type: 'resource', name: 'Created', properties: { quantity: 1 } };
    const doc = documentWith([task('bad', 'actor_a', '09:00', { interactions: [
        { action: 'create', object: created, temporary: true },
        { target_id: 'item', temporary: true, at: 'completion', property_changes: { quantity: { set: 1 } } }
    ] })]);
    const result = runtime.validate(doc);
    assert.equal(has(result.problems, 'interaction.temporary.lifecycle_invalid'), true);
    assert.equal(has(result.problems, 'interaction.temporary.timing_invalid'), true);
});

test('completion effects are visible to same-time starts; same-time starts share a pre-start snapshot', () => {
    const visible = documentWith([
        task('verify', 'actor_a', '08:30', { interactions: [{ target_id: 'item', property_changes: { receipt_verified: { set: true } } }] }),
        task('archive', 'actor_b', '09:00', { requires: { '==': [{ object: 'item', property: 'receipt_verified' }, true] } })
    ]);
    assert.equal(runtime.replay(visible).state.statuses.get('archive'), 'completed');

    const isolated = documentWith([
        task('make_ready', 'actor_a', '09:00', { interactions: [{ target_id: 'item', at: 'start', property_changes: { receipt_verified: { set: true } } }] }),
        task('observe', 'actor_b', '09:00', { requires: { '==': [{ object: 'item', property: 'receipt_verified' }, true] } })
    ]);
    assert.equal(runtime.replay(isolated).state.statuses.get('observe'), 'blocked');
});

test('one event commits cross-object effects before a later condition is evaluated', () => {
    const doc = documentWith([
        task('update_pair', 'actor_a', '09:00', { interactions: [
            { target_id: 'item', property_changes: { receipt_verified: { set: true } } },
            { target_id: 'machine', property_changes: { state: { set: 'ready' } } }
        ] }),
        task('observe_pair', 'actor_b', '09:30', { requires: { all: [
            { '==': [{ object: 'item', property: 'receipt_verified' }, true] },
            { '==': [{ object: 'machine', property: 'state' }, 'ready'] }
        ] } })
    ]);
    const run = runtime.replay(doc);
    const eventSamples = run.history.filter((entry) => entry.time === 9 * 60 + 30);

    assert.equal(run.state.statuses.get('observe_pair'), 'completed');
    assert.equal(eventSamples.length, 1);
    assert.equal(eventSamples[0].state.objects.get('item').properties.receipt_verified, true);
    assert.equal(eventSamples[0].state.objects.get('machine').properties.state, 'ready');
});

test('non-conflicting effects in one event resolve operands from the same pre-event snapshot', () => {
    const doc = documentWith([task('swap_values', 'actor_a', '09:00', { interactions: [
        { target_id: 'item', property_changes: { temperature: { set: { object: 'machine', property: 'capacity' } } } },
        { target_id: 'machine', property_changes: { capacity: { set: { object: 'item', property: 'temperature' } } } }
    ] })]);
    const completed = runtime.snapshotAt(doc, '09:30');

    assert.equal(completed.objects.item.properties.temperature, 2);
    assert.equal(completed.objects.machine.properties.capacity, 4);
});

test('conflicting writes in one event fail under the WorkSpec 2.1 conflict rules', () => {
    const conflict = documentWith([
        task('set_value', 'actor_a', '09:00', { interactions: [{ target_id: 'item', property_changes: { quantity: { set: 4 } } }] }),
        task('change_value', 'actor_b', '09:00', { interactions: [{ target_id: 'item', property_changes: { quantity: { delta: -1 } } }] })
    ]);

    assert.equal(has(runtime.validate(conflict).problems, 'interaction.write.conflict'), true);
});

test('co-timed numeric deltas aggregate from the pre-event value', () => {
    const aggregate = documentWith([
        task('use_a', 'actor_a', '09:00', { interactions: [{ target_id: 'item', property_changes: { quantity: { delta: -2 } } }] }),
        task('use_b', 'actor_b', '09:00', { interactions: [{ target_id: 'item', property_changes: { quantity: { delta: -3 } } }] })
    ]);
    assert.equal(runtime.snapshotAt(aggregate, '09:30').objects.item.properties.quantity, 5);
});

test('offset and half-open non-overlap constraints validate authored schedules', () => {
    const valid = documentWith([
        task('prepare', 'actor_a', '08:30'),
        task('follow', 'actor_b', '09:30', { timing: [{ relation: 'offset', event: 'start', relative_to: { task: 'prepare', field: 'end' }, min_offset: '30m', max_offset: '2h' }] }),
        task('touching', 'equipment_a', '09:00', { timing: [{ relation: 'not_overlap', with: { task: 'prepare' } }] })
    ]);
    assert.equal(has(runtime.validate(valid).problems, 'timing.offset.violation'), false);
    assert.equal(has(runtime.validate(valid).problems, 'timing.not_overlap.violation'), false);

    const invalid = documentWith([
        task('prepare', 'actor_a', '08:30'),
        task('too_soon', 'actor_b', '09:10', { timing: [{ relation: 'offset', event: 'start', relative_to: { task: 'prepare', field: 'end' }, min_offset: '30m' }] }),
        task('overlap', 'equipment_a', '08:45', { timing: [{ relation: 'not_overlap', with: { task: 'prepare' } }] })
    ]);
    const result = runtime.validate(invalid);
    assert.equal(has(result.problems, 'timing.offset.violation'), true);
    assert.equal(has(result.problems, 'timing.not_overlap.violation'), true);
});

test('exclusive, capacity, implicit actor, and reference-valued reservations are enforced', () => {
    const exclusive = documentWith([
        task('first', 'actor_a', '09:00', { reservations: [{ resource: 'machine', mode: 'exclusive' }] }),
        task('second', 'actor_b', '09:00', { reservations: [{ resource: 'machine', mode: 'exclusive' }] })
    ]);
    assert.equal(has(runtime.validate(exclusive).problems, 'reservation.exclusive.conflict'), true);

    const capacity = documentWith([
        task('first', 'actor_a', '09:00', { reservations: [{ resource: 'bay', mode: 'capacity', amount: 2 }] }),
        task('second', 'actor_b', '09:00', { reservations: [{ resource: 'bay', mode: 'capacity', amount: 2 }] })
    ]);
    assert.equal(has(runtime.validate(capacity).problems, 'reservation.capacity.exceeded'), true);

    const actorOverlap = documentWith([task('first', 'actor_a', '09:00'), task('second', 'actor_a', '09:00')]);
    assert.equal(has(runtime.validate(actorOverlap).problems, 'reservation.exclusive.conflict'), true);

    const referenceResource = documentWith([task('reference', 'actor_a', '09:00', {
        reservations: [{ resource: { task: 'current', field: 'actor_id' }, mode: 'exclusive' }]
    })]);
    assert.equal(runtime.validate(referenceResource).valid, true);
});

test('current performer works for actor, equipment and service performers', () => {
    const doc = documentWith([
        task('actor_task', 'actor_a', '09:00', { requires: { contains: [{ object: 'current', property: 'permissions' }, 'run'] } }),
        task('equipment_task', 'equipment_a', '09:30', { requires: { contains: [{ object: 'current', property: 'permissions' }, 'run'] } }),
        task('service_task', 'service_a', '10:00', { requires: { contains: [{ object: 'current', property: 'permissions' }, 'run'] } })
    ]);
    const run = runtime.replay(doc);
    ['actor_task', 'equipment_task', 'service_task'].forEach((id) => assert.equal(run.state.statuses.get(id), 'completed'));
});

test('a missing start derives from dependency completion and records provenance', () => {
    const doc = documentWith([
        task('prepare', 'actor_a', '09:00', { duration: 20 }),
        task('approve', 'actor_b', undefined, { duration: 10, depends_on: ['prepare'] })
    ]);
    const run = runtime.replay(doc);
    assert.equal(run.timings.get('approve').start, 9 * 60 + 20);
    assert.equal(run.timings.get('approve').end, 9 * 60 + 30);
    assert.equal(run.timings.get('approve').source, 'derived');
    assert.equal(run.timings.get('approve').explicit, false);
    assert.equal(run.problems.length, 0);
    assert.equal(runtime.resolveTimings(doc).timings.get('approve').start, 9 * 60 + 20);
    assert.equal(validator.validate(doc).ok, true);
});

test('all dependencies derive from the latest predecessor completion', () => {
    const doc = documentWith([
        task('left', 'actor_a', '09:00', { duration: 20 }),
        task('right', 'actor_b', '09:05', { duration: 30 }),
        task('join', 'service_a', undefined, { duration: 5, depends_on: ['left', 'right'] })
    ]);
    assert.equal(runtime.replay(doc).timings.get('join').start, 9 * 60 + 35);
});

test('lower timing bounds contribute to the derived earliest start', () => {
    const doc = documentWith([
        task('prepare', 'actor_a', '09:00', { duration: 20 }),
        task('approve', 'actor_b', undefined, {
            duration: 10,
            depends_on: ['prepare'],
            timing: [{ relation: 'offset', event: 'start', relative_to: { task: 'prepare', field: 'end' }, min_offset: '30m' }]
        })
    ]);
    assert.equal(runtime.replay(doc).timings.get('approve').start, 9 * 60 + 50);
});

test('upper bounds validate the derived earliest start without moving it', () => {
    const doc = documentWith([
        task('anchor', 'actor_a', '09:00', { duration: 10 }),
        task('dependency', 'actor_b', '09:00', { duration: 40 }),
        task('bounded', 'service_a', undefined, {
            duration: 5,
            depends_on: ['dependency'],
            timing: [{ relation: 'offset', event: 'start', relative_to: { task: 'anchor', field: 'end' }, max_offset: '20m' }]
        })
    ]);
    const run = runtime.replay(doc);
    assert.equal(run.timings.get('bounded').start, 9 * 60 + 40);
    assert.equal(has(run.problems, 'timing.offset.violation'), true);
});

test('explicit starts remain authoritative and are validated rather than moved', () => {
    const valid = documentWith([
        task('prepare', 'actor_a', '09:00', { duration: 20 }),
        task('approve', 'actor_b', '09:30', { duration: 10, depends_on: ['prepare'] })
    ]);
    const validRun = runtime.replay(valid);
    assert.equal(validRun.timings.get('approve').start, 9 * 60 + 30);
    assert.equal(validRun.timings.get('approve').source, 'explicit');
    assert.equal(has(validRun.problems, 'temporal.scheduling.dependency_violation'), false);

    valid.simulation.process.tasks[1].start = '09:10';
    const invalidRun = runtime.replay(valid);
    assert.equal(invalidRun.timings.get('approve').start, 9 * 60 + 10);
    assert.equal(has(invalidRun.problems, 'temporal.scheduling.dependency_violation'), true);
});

test('depends_on.any ignores a skipped branch and uses the completed alternative', () => {
    const doc = documentWith([
        task('success_path', 'actor_a', '09:00', { duration: 10, when: false }),
        task('recovery_path', 'actor_b', '09:05', { duration: 25 }),
        task('continue', 'service_a', undefined, { duration: 5, depends_on: { any: ['success_path', 'recovery_path'] } })
    ]);
    const run = runtime.replay(doc);
    assert.equal(run.state.statuses.get('success_path'), 'skipped');
    assert.equal(run.timings.get('continue').start, 9 * 60 + 30);
    assert.equal(run.state.statuses.get('continue'), 'completed');
});

test('an any join with every alternative skipped remains unresolved', () => {
    const doc = documentWith([
        task('left', 'actor_a', '09:00', { when: false }),
        task('right', 'actor_b', '09:00', { when: false }),
        task('join', 'service_a', undefined, { depends_on: { any: ['left', 'right'] } })
    ]);
    const run = runtime.replay(doc);
    assert.equal(run.timings.get('join').resolved, false);
    assert.equal(has(run.problems, 'timing.resolution.any_unsatisfied'), true);
});

test('a direct dependency on a skipped task remains unsatisfied', () => {
    const doc = documentWith([
        task('optional', 'actor_a', '09:00', { when: false }),
        task('downstream', 'actor_b', undefined, { depends_on: ['optional'] })
    ]);
    const run = runtime.replay(doc);
    assert.equal(run.timings.get('downstream').resolved, false);
    assert.equal(has(run.problems, 'timing.resolution.dependency_unresolved'), true);
});

test('cycles and missing anchors produce canonical resolution errors', () => {
    const cycle = documentWith([
        task('one', 'actor_a', undefined, { depends_on: ['two'] }),
        task('two', 'actor_b', undefined, { depends_on: ['one'] })
    ]);
    assert.equal(has(runtime.replay(cycle).problems, 'timing.resolution.cycle'), true);

    const orphan = documentWith([task('orphan', 'actor_a', undefined)]);
    assert.equal(has(validator.validate(orphan).problems, 'timing.resolution.missing_anchor'), true);
});

test('not_overlap never invents an ordering for startless tasks', () => {
    const doc = documentWith([
        task('one', 'actor_a', undefined),
        task('two', 'actor_b', undefined, { timing: [{ relation: 'not_overlap', with: { task: 'one' } }] })
    ]);
    const run = runtime.replay(doc);
    assert.equal(run.timings.get('two').resolved, false);
    assert.equal(has(run.problems, 'timing.resolution.ambiguous_not_overlap'), true);
});

test('reservation conflicts invalidate a derived schedule without delaying it', () => {
    const doc = documentWith([
        task('prepare', 'actor_a', '09:00', { duration: 10 }),
        task('occupy', 'actor_b', '09:00', { duration: 30, reservations: [{ resource: 'machine', mode: 'exclusive' }] }),
        task('derived', 'service_a', undefined, { duration: 5, depends_on: ['prepare'], reservations: [{ resource: 'machine', mode: 'exclusive' }] })
    ]);
    const run = runtime.replay(doc);
    assert.equal(run.timings.get('derived').start, 9 * 60 + 10);
    assert.equal(has(run.problems, 'reservation.exclusive.conflict'), true);
});

test('a derived same-timestamp start sees predecessor completion effects', () => {
    const doc = documentWith([
        task('set_ready', 'actor_a', '09:00', {
            duration: 10,
            interactions: [{ target_id: 'item', property_changes: { receipt_verified: { set: true } } }]
        }),
        task('use_ready', 'actor_b', undefined, {
            duration: 5,
            depends_on: ['set_ready'],
            requires: { '==': [{ object: 'item', property: 'receipt_verified' }, true] }
        })
    ]);
    const run = runtime.replay(doc);
    assert.equal(run.timings.get('use_ready').start, 9 * 60 + 10);
    assert.equal(run.state.statuses.get('use_ready'), 'completed');
});

test('VG001 checks intrinsic timing on inactive alternatives without false positives', () => {
    const invalid = documentWith([
        task('anchor', 'actor_a', '09:00', { duration: 10 }),
        task('inactive', 'actor_b', '09:20', {
            duration: 5,
            when: false,
            timing: [{ relation: 'offset', event: 'start', relative_to: { task: 'anchor', field: 'end' }, max_offset: '5m' }]
        })
    ]);
    assert.equal(has(runtime.replay(invalid).problems, 'timing.offset.violation'), true);
    invalid.simulation.process.tasks[1].start = '09:15';
    assert.equal(has(runtime.replay(invalid).problems, 'timing.offset.violation'), false);
});

test('VG003 rejects empty and provably impossible all dependency groups', () => {
    const empty = documentWith([task('empty', 'actor_a', '09:00', { depends_on: [] })]);
    assert.equal(has(runtime.replay(empty).problems, 'dependency.group.empty'), true);

    const impossible = documentWith([
        task('left', 'actor_a', '09:00', { when: { '==': [{ object: 'item', property: 'flag' }, true] } }),
        task('right', 'actor_b', '09:00', { when: { '==': [{ object: 'item', property: 'flag' }, false] } }),
        task('join', 'service_a', undefined, { depends_on: ['left', 'right'] })
    ]);
    assert.equal(has(runtime.replay(impossible).problems, 'dependency.all.mutually_exclusive'), true);
});

test('G008 blocks a false initial while and interrupts active work only at modeled event boundaries', () => {
    const doc = documentWith([
        task('already_unsafe', 'actor_b', '08:30', { while: { '==': ['@item.flag', false] } }),
        task('infuse', 'actor_a', '09:00', {
            duration: 60,
            while: { '==': ['@item.flag', true] },
            progress: '@item.quantity',
            reservations: [{ resource: 'machine', mode: 'exclusive' }],
            interactions: [
                { target_id: 'machine', at: 'start', property_changes: { capacity: { set: 7 } } },
                { target_id: 'machine', temporary: true, property_changes: { state: { set: 'running' } } },
                { target_id: 'item', property_changes: { quantity: { set: 0 } } }
            ]
        }),
        task('reaction', 'equipment_a', '09:10', { duration: 10, interactions: [
            { target_id: 'item', property_changes: { flag: { set: false }, quantity: { set: 6 } } }
        ] })
    ]);
    const beforeBoundary = runtime.snapshotAt(doc, '09:19');
    assert.equal(beforeBoundary.task_statuses.infuse, 'active');
    assert.equal(beforeBoundary.objects.machine.properties.state, 'running');
    const run = runtime.replay(doc);
    assert.equal(run.state.statuses.get('already_unsafe'), 'blocked');
    assert.equal(run.state.statuses.get('infuse'), 'interrupted');
    assert.equal(run.state.taskRuntime.get('infuse').actual_end, 9 * 60 + 20);
    assert.equal(run.state.taskRuntime.get('infuse').progress, 6);
    assert.equal(run.state.objects.get('machine').properties.capacity, 7, 'permanent start effects remain');
    assert.equal(run.state.objects.get('machine').properties.state, 'idle', 'temporary effects restore');
    assert.equal(run.state.objects.get('item').properties.quantity, 6, 'completion effects are suppressed');
    assert.equal(run.state.reservations.some((claim) => claim.task === 'infuse'), false);
    assert.equal(run.history.some((entry) => entry.time === 10 * 60 && entry.state.statuses.get('infuse') === 'completed'), false, 'stale planned completion is suppressed');
});

test('G008 task status, actual_end and captured progress are stable compact runtime references', () => {
    const doc = documentWith([
        task('source', 'actor_a', '09:00', { duration: 30, progress: '@item.quantity' }),
        task('mutate_later', 'actor_b', '09:30', { duration: 10, interactions: [{ target_id: 'item', property_changes: { quantity: { set: 2 } } }] }),
        task('observe', 'equipment_a', '09:40', { requires: { all: [
            { '==': ['@source.status', 'completed'] },
            { '==': ['@source.actual_end', '@source.end'] },
            { '==': ['@source.progress', 10] }
        ] } })
    ]);
    const run = runtime.replay(doc);
    assert.equal(run.state.statuses.get('observe'), 'completed');
    assert.equal(run.state.taskRuntime.get('source').progress, 10);
    const undeclared = documentWith([task('plain', 'actor_a', '09:00'), task('bad_ref', 'actor_b', '09:30', { when: { '==': ['@plain.progress', 1] } })]);
    assert.equal(has(validator.validate(undeclared).problems, 'reference.task.progress.undeclared'), true);
});

test('G008 resolves actual_end through G013 and starts authored recovery at the same timestamp', () => {
    const doc = documentWith([
        task('work', 'actor_a', '09:00', { duration: 60, while: { '==': ['@item.flag', true] }, progress: '@item.quantity' }),
        task('fault', 'actor_b', '09:10', { duration: 10, interactions: [{ target_id: 'item', property_changes: { flag: { set: false } } }] }),
        task('recovery', 'equipment_a', undefined, {
            duration: 10,
            when: { '==': ['@work.status', 'interrupted'] },
            timing: [{ relation: 'offset', event: 'start', relative_to: '@work.actual_end', min_offset: '0m' }],
            continues: { task: 'work' }
        })
    ]);
    const run = runtime.replay(doc);
    assert.equal(run.timings.get('recovery').start, 9 * 60 + 20);
    assert.equal(run.state.statuses.get('recovery'), 'completed');
    assert.equal(run.problems.length, 0);

    const normal = documentWith([
        task('work', 'actor_a', '09:00'),
        task('recovery', 'actor_b', undefined, { when: { '==': ['@work.status', 'interrupted'] }, timing: [{ relation: 'offset', event: 'start', relative_to: '@work.actual_end', min_offset: 0 }] })
    ]);
    assert.equal(runtime.replay(normal).state.statuses.get('recovery'), 'skipped');
});

test('G008 continuation validation rejects unknown, self, cyclic, and non-interrupted sources', () => {
    const self = documentWith([task('one', 'actor_a', '09:00', { continues: { task: 'one' } })]);
    assert.equal(has(validator.validate(self).problems, 'task.continues.self'), true);
    const cycle = documentWith([
        task('one', 'actor_a', '09:00', { continues: { task: 'two' } }),
        task('two', 'actor_b', '09:30', { continues: { task: 'one' } })
    ]);
    assert.equal(has(validator.validate(cycle).problems, 'task.continues.cycle'), true);
    const unknown = documentWith([task('one', 'actor_a', '09:00', { continues: { task: 'missing' } })]);
    assert.equal(has(validator.validate(unknown).problems, 'task.continues.unknown'), true);
    const notInterrupted = documentWith([
        task('one', 'actor_a', '09:00'),
        task('two', 'actor_b', '09:30', { continues: { task: 'one' } })
    ]);
    const run = runtime.replay(notInterrupted);
    assert.equal(run.state.statuses.get('two'), 'blocked');
    assert.equal(has(run.problems, 'task.continues.source_not_interrupted'), true);
});

test('G008 completion wins the half-open planned-end race', () => {
    const doc = documentWith([
        task('work', 'actor_a', '09:00', { duration: 30, while: { '==': ['@item.flag', true] } }),
        task('boundary_change', 'actor_b', '09:00', { duration: 30, interactions: [{ target_id: 'item', property_changes: { flag: { set: false } } }] })
    ]);
    const run = runtime.replay(doc);
    assert.equal(run.state.statuses.get('work'), 'completed');
    assert.equal(run.state.taskRuntime.get('work').actual_end, 9 * 60 + 30);
});

test('G008 post-start stabilization interrupts simultaneous failures before same-time recovery acquires resources', () => {
    const doc = documentWith([
        task('left', 'actor_a', '09:00', { duration: 60, while: { '==': ['@item.flag', true] }, reservations: [{ resource: 'machine', mode: 'exclusive' }] }),
        task('right', 'actor_b', '09:00', { duration: 60, while: { '==': ['@item.flag', true] } }),
        task('invalidate', 'equipment_a', '09:20', { duration: 10, interactions: [{ at: 'start', target_id: 'item', property_changes: { flag: { set: false } } }] }),
        task('recover', 'service_a', undefined, {
            duration: 10,
            when: { '==': ['@left.status', 'interrupted'] },
            timing: [{ relation: 'offset', event: 'start', relative_to: '@left.actual_end', min_offset: 0 }],
            reservations: [{ resource: 'machine', mode: 'exclusive' }]
        })
    ]);
    const run = runtime.replay(doc);
    assert.equal(run.state.statuses.get('left'), 'interrupted');
    assert.equal(run.state.statuses.get('right'), 'interrupted');
    assert.equal(run.state.taskRuntime.get('left').actual_end, 9 * 60 + 20);
    assert.equal(run.state.statuses.get('recover'), 'completed');
    assert.equal(has(run.problems, 'reservation.exclusive.conflict'), false);
});

test('G008 interruption cleanup repeats invariant stabilization until cascading failures settle', () => {
    const doc = documentWith([
        task('provider', 'actor_a', '08:50', {
            duration: 70,
            while: { '==': ['@item.flag', true] },
            interactions: [{ target_id: 'machine', temporary: true, property_changes: { state: { set: 'ready' } } }]
        }),
        task('consumer', 'actor_b', '09:00', { duration: 60, while: { '==': ['@machine.state', 'ready'] } }),
        task('fault', 'equipment_a', '09:10', { duration: 10, interactions: [{ target_id: 'item', property_changes: { flag: { set: false } } }] })
    ]);
    const run = runtime.replay(doc);
    assert.equal(run.state.statuses.get('provider'), 'interrupted');
    assert.equal(run.state.statuses.get('consumer'), 'interrupted');
    assert.equal(run.state.taskRuntime.get('provider').actual_end, 9 * 60 + 20);
    assert.equal(run.state.taskRuntime.get('consumer').actual_end, 9 * 60 + 20);
});

test('G008 focused Batch 1 fixtures validate and exercise only authored interruption/recovery', () => {
    for (const [scenarioId, doc] of Object.entries(g008GroundedFixtures)) {
        const validation = validator.validate(doc);
        assert.equal(validation.ok, true, `${scenarioId}: ${validation.problems.map(problem => problem.metric_id).join(', ')}`);
        const run = runtime.replay(doc);
        const source = doc.simulation.process.tasks[0];
        const recoveryTask = doc.simulation.process.tasks[2];
        assert.equal(run.state.statuses.get(source.id), 'interrupted', `${scenarioId} source`);
        assert.equal(run.state.statuses.get(recoveryTask.id), 'completed', `${scenarioId} recovery`);
        assert.equal(run.state.taskRuntime.get(source.id).actual_end, 9 * 60 + 20, `${scenarioId} actual_end`);
        assert.notEqual(run.state.taskRuntime.get(source.id).progress, undefined, `${scenarioId} progress`);
    }
});
