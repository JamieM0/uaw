'use strict';

const test = require('node:test');
const assert = require('assert/strict');

const validator = require('../workspec-validator.js');
const { baseDoc, getMetric, hasMetric } = require('./helpers.js');

test('validator reports dependency violations for v2 world/process docs', () => {
    const doc = baseDoc();
    doc.simulation.world.objects = [
        { id: 'a', type: 'actor', name: 'A', properties: { state: 'idle' } },
        { id: 'b', type: 'actor', name: 'B', properties: { state: 'idle' } }
    ];
    doc.simulation.process.tasks = [
        { id: 't1', actor_id: 'a', start: '09:00', duration: 60 },
        { id: 't2', actor_id: 'b', start: '09:30', duration: 30, depends_on: ['t1'] }
    ];

    const result = validator.validate(doc);
    assert.equal(result.ok, false);
    assert.equal(hasMetric(result.problems, 'temporal.scheduling.dependency_violation'), true);
    assert.equal(getMetric(result.problems, 'temporal.scheduling.dependency_violation').instance, '/simulation/process/tasks/1/start');
});

test('validator ignores stale legacy aliases when canonical v2 arrays are present', () => {
    const doc = baseDoc();
    doc.simulation.objects = [
        { id: 'a', type: 'actor', name: 'A', properties: { state: 'idle' } },
        { id: 'b', type: 'actor', name: 'B', properties: { state: 'idle' } }
    ];
    doc.simulation.tasks = [
        { id: 't1', actor_id: 'a', start: '09:00', duration: 60 },
        { id: 't2', actor_id: 'b', start: '09:30', duration: 30, depends_on: ['t1'] }
    ];

    const result = validator.validate(doc);
    assert.equal(result.ok, true);
    assert.equal(hasMetric(result.problems, 'temporal.scheduling.dependency_violation'), false);
});

test('validator accepts tasks that start when their dependency ends', () => {
    const doc = baseDoc();
    doc.simulation.world.objects = [
        { id: 'a', type: 'actor', name: 'A', properties: { state: 'idle' } },
        { id: 'b', type: 'actor', name: 'B', properties: { state: 'idle' } }
    ];
    doc.simulation.process.tasks = [
        { id: 't1', actor_id: 'a', start: '09:00', duration: 30 },
        { id: 't2', actor_id: 'b', start: '09:30', duration: 30, depends_on: ['t1'] }
    ];

    const result = validator.validate(doc);
    assert.equal(hasMetric(result.problems, 'temporal.scheduling.dependency_violation'), false);
});
