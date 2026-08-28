#!/usr/bin/env node
'use strict';

const assert = require('assert/strict');
const playbackState = require('../playback-state.js');
const stateVisuals = require('../state-visuals.js');

function fixture() {
    return {
        simulation: {
            schema_version: '2.0',
            state_libraries: {
                actor: {
                    states: ['idle', 'working', 'done'],
                    appearances: { main: { idle: 'actor_idle', working: 'actor_working', done: 'actor_done' } }
                }
            },
            world: {
                objects: [
                    {
                        id: 'worker', type: 'actor', name: 'Worker', location: 'prep',
                        state_library: 'actor', appearance: 'main', properties: { state: 'idle' }
                    },
                    { id: 'tool', type: 'equipment', name: 'Tool', location: 'prep', properties: { state: 'clean', uses: 1 } }
                ]
            },
            process: {
                tasks: [
                    {
                        id: 'temporary-work', actor_id: 'worker', start: '09:00', duration: 30, location: 'prep',
                        interactions: [{
                            target_id: 'worker', temporary: true,
                            property_changes: { state: { from: 'idle', to: 'working' } }
                        }]
                    },
                    {
                        id: 'finish', actor_id: 'worker', start: '09:30', duration: 10, location: 'oven',
                        interactions: [
                            { target_id: 'worker', property_changes: { state: { set: 'done' } } },
                            { target_id: 'tool', property_changes: { location: { set: 'oven' }, uses: { increment: true } } }
                        ]
                    },
                    {
                        id: 'create-output', actor_id: 'worker', start: '10:00', duration: 10, location: 'oven',
                        interactions: [{
                            action: 'create',
                            object: { id: 'loaf', type: 'product', name: 'Loaf', location: 'oven', properties: { state: 'hot' } }
                        }]
                    },
                    {
                        id: 'discard-tool', actor_id: 'worker', start: '10:30', duration: 10, location: 'oven',
                        interactions: [{ action: 'delete', target_id: 'tool' }]
                    }
                ]
            }
        }
    };
}

function run() {
    const documentValue = fixture();
    const model = playbackState.createPlaybackModel(documentValue);

    // Initial state and location before any task.
    assert.equal(playbackState.getObjectStateAtTime(model, 'worker', 8 * 60), 'idle');
    assert.equal(playbackState.getObjectLocationAtTime(model, 'worker', 8 * 60), 'prep');

    // Temporary state applies only while the task is active.
    assert.equal(playbackState.getObjectStateAtTime(model, 'worker', 9 * 60 + 10), 'working');
    assert.equal(playbackState.getObjectStateAtTime(model, 'worker', 9 * 60 + 30), 'done');

    // Permanent assignment remains after its task.
    assert.equal(playbackState.getObjectStateAtTime(model, 'worker', 11 * 60), 'done');
    assert.equal(playbackState.getObjectLocationAtTime(model, 'tool', 9 * 60 + 35), 'oven');
    assert.equal(playbackState.getObjectAtTime(model, 'tool', 9 * 60 + 39)?.properties.uses, 1);
    assert.equal(playbackState.getObjectAtTime(model, 'tool', 9 * 60 + 40)?.properties.uses, 2);

    // Scrubbing backwards recomputes the earlier semantic state.
    assert.equal(playbackState.getObjectStateAtTime(model, 'worker', 9 * 60 + 5), 'working');
    assert.equal(playbackState.getObjectStateAtTime(model, 'worker', 8 * 60 + 55), 'idle');

    // Creation starts with the task and persists afterwards.
    assert.equal(playbackState.getObjectAtTime(model, 'loaf', 9 * 60 + 59), null);
    assert.equal(playbackState.getObjectAtTime(model, 'loaf', 10 * 60)?.properties.state, 'hot');
    assert.equal(playbackState.getObjectAtTime(model, 'loaf', 10 * 60 + 11)?.properties.state, 'hot');

    // Deletion starts with the task and persists afterwards.
    assert.equal(playbackState.getObjectAtTime(model, 'tool', 10 * 60 + 29)?.id, 'tool');
    assert.equal(playbackState.getObjectAtTime(model, 'tool', 10 * 60 + 30), null);
    assert.equal(playbackState.getObjectAtTime(model, 'tool', 10 * 60 + 41), null);
    assert.deepEqual(playbackState.resolveWorldStateAtTime(model, 10 * 60 + 41).objectsByType.equipment, []);

    // Task-driven actor location is observable without renderer-owned task replay.
    assert.equal(playbackState.getObjectLocationAtTime(model, 'worker', 9 * 60 + 10), 'prep');
    assert.equal(playbackState.getObjectLocationAtTime(model, 'worker', 9 * 60 + 35), 'oven');
    assert.equal(playbackState.getObjectLocationAtTime(model, 'worker', 10 * 60 + 20), 'oven');

    // State Library visual resolution consumes the same semantic state.
    const activeWorker = playbackState.getObjectAtTime(model, 'worker', 9 * 60 + 10);
    assert.equal(stateVisuals.resolveStateVisualAssetId(documentValue, activeWorker), 'actor_working');
    assert.equal(stateVisuals.resolveObjectStateAtTime(documentValue.simulation.world.objects[0], documentValue.simulation.process.tasks, 9 * 60 + 10), 'working');

    process.stdout.write('✓ WorkSpec playback-state resolution\n');
}

run();
