#!/usr/bin/env node
'use strict';

const assert = require('assert/strict');
const playbackState = require('../playback-state.js');
const experiment = require('../direct-movie-experiment.js');

function state(model, id, time) {
    const object = playbackState.getObjectAtTime(model, id, time);
    return object && {
        location: playbackState.getObjectLocationAtTime(model, id, time),
        state: playbackState.getObjectStateAtTime(model, id, time)
    };
}

function run() {
    const fixture = experiment.fixture;
    assert.deepEqual(fixture.tasks, []);
    assert.equal(JSON.stringify(fixture).includes('interactions'), false);

    const model = playbackState.createPlaybackModel(experiment.createSource(fixture));
    assert.deepEqual(state(model, 'movie_worker', 0), { location: 'Left Bay', state: 'idle' });
    assert.deepEqual(state(model, 'movie_worker', 10), { location: 'Left Bay', state: 'working' });
    assert.deepEqual(state(model, 'movie_worker', 20), { location: 'Right Bay', state: 'working' });
    assert.deepEqual(state(model, 'movie_worker', 30), { location: 'Right Bay', state: 'idle' });

    assert.deepEqual([0, 10, 20, 30].map(time => playbackState.getObjectStateAtTime(model, 'movie_machine', time)), [
        'off', 'running', 'running', 'off'
    ]);
    assert.equal(playbackState.getObjectAtTime(model, 'movie_box', 0), null);
    assert.equal(playbackState.getObjectAtTime(model, 'movie_box', 10), null);
    assert.deepEqual(state(model, 'movie_box', 20), { location: 'Right Bay', state: 'present' });
    assert.equal(playbackState.getObjectAtTime(model, 'movie_box', 30), null);

    assert.equal(playbackState.getObjectAtTime(model, 'movie_box', 20)?.id, 'movie_box');
    assert.deepEqual(state(model, 'movie_worker', 0), { location: 'Left Bay', state: 'idle' });
    assert.deepEqual(playbackState.getPlaybackBoundaries(model), [0, 10, 20, 30]);
    assert.deepEqual(playbackState.getObservableObjects(model).map(object => object.id), [
        'movie_worker', 'movie_machine', 'movie_box'
    ]);

    assert.equal(experiment.isActive('?movieExperiment=1'), true);
    assert.equal(experiment.isActive(''), false);
    assert.equal(experiment.isActive('?movieExperiment=true'), false);
    assert.equal(experiment.isActive('?movieExperiment=0'), false);

    process.stdout.write('✓ direct movie playback experiment\n');
}

run();
