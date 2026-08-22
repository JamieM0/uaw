#!/usr/bin/env node
'use strict';

const assert = require('assert/strict');
const {
    parseJsonTree,
    findEntityPath,
    diffPaths,
    getAtPath
} = require('../assets/js/playground/playground-source-context.js');

const documentValue = {
    simulation: {
        world: {
            objects: [
                { id: 'worker', type: 'actor', properties: { state: 'idle' } },
                { id: 'oven', type: 'equipment', properties: { temperature: 180 } }
            ],
            layout: {
                locations: [{ id: 'prep', name: 'Preparation' }]
            }
        },
        process: {
            tasks: [{ id: 'mix', duration: 15 }]
        }
    },
    assets: {
        hero: { mimeType: 'image/png' }
    }
};

const source = JSON.stringify(documentValue, null, 2);
const tree = parseJsonTree(source);

assert.deepEqual(findEntityPath(documentValue, 'oven'), ['simulation', 'world', 'objects', 1]);
assert.deepEqual(findEntityPath(documentValue, 'prep'), ['simulation', 'world', 'layout', 'locations', 0]);
assert.deepEqual(findEntityPath(documentValue, 'hero'), ['assets', 'hero']);
assert.equal(getAtPath(documentValue, ['simulation', 'process', 'tasks', 0, 'id']), 'mix');

const ovenNode = tree.nodes.find(node => node.path.join('.') === 'simulation.world.objects.1');
assert.ok(ovenNode, 'JSON tree should index the selected object');
assert.match(source.slice(ovenNode.start, ovenNode.end), /"temperature": 180/);

const changed = JSON.parse(source);
changed.simulation.world.objects[1].properties.temperature = 210;
changed.simulation.world.objects.push({ id: 'tray', type: 'equipment' });
assert.deepEqual(diffPaths(documentValue, changed), [
    ['simulation', 'world', 'objects', 1, 'properties', 'temperature'],
    ['simulation', 'world', 'objects', 2]
]);

process.stdout.write('✓ contextual source paths, entity mapping and structural diffs\n');
