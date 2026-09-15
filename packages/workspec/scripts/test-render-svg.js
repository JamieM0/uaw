#!/usr/bin/env node
'use strict';

const assert = require('assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const workspec = require('..');

const documentValue = {
    simulation: {
        schema_version: '2.2',
        meta: { title: 'Bakery & café', description: 'SVG rendering fixture.', domain: 'bakery' },
        config: { time_unit: 'minutes', start_time: '08:00', end_time: '18:00', currency: 'GBP', locale: 'en-GB', timezone: 'Europe/London' },
        state_libraries: {
            bread_states: { states: ['fresh'], appearances: { main: { fresh: 'bread_fresh' } } }
        },
        world: {
            layout: {
                locations: [
                    { id: 'counter', name: 'Front <counter>', shape: { type: 'rect', x: 10, y: 20, width: 260, height: 150 } },
                    { id: 'kitchen', name: 'Kitchen', shape: { type: 'rect', x: 300, y: 20, width: 240, height: 150 } }
                ]
            },
            objects: [
                { id: 'baker', type: 'actor', name: 'Baker', location: 'kitchen', properties: { state: 'idle' } },
                { id: 'bread', type: 'product', name: 'Bread', location: 'kitchen', state_library: 'bread_states', appearance: 'main', properties: { state: 'fresh', quantity: 4 } }
            ]
        },
        process: { tasks: [{ id: 'display_bread', actor_id: 'baker', start: '09:00', duration: '5m' }] }
    }
};
const changes = 'WorkSpec.task("display_bread").onComplete(() => move("bread", "counter"));';

const first = workspec.renderProjectToSvg(documentValue, '09:05', { changesSource: changes, seed: 1 });
const second = workspec.renderProjectToSvg(documentValue, '09:05', { changesSource: changes, seed: 1 });
assert.equal(first.svg, second.svg, 'rendering the same resolved state must be deterministic');
assert.match(first.svg, /^<svg /);
assert.match(first.svg, /data-location-id="counter"/);
assert.match(first.svg, /data-object-id="bread"/);
assert.match(first.svg, /Front &lt;counter&gt;/, 'SVG text was not escaped');
assert.equal(first.snapshot.objects.bread.location, 'counter', 'renderer did not use the authoritative state at time T');
assert.equal(typeof workspec.renderSnapshotToSvg, 'function', 'snapshot renderer is not exported by the package');
const withAsset = workspec.renderProjectToSvg(documentValue, '09:05', {
    changesSource: changes,
    seed: 1,
    assetResolver: (assetId) => assetId === 'bread_fresh' ? 'data:image/png;base64,AAAA' : null
});
assert.match(withAsset.svg, /data-asset-id="bread_fresh"/);
assert.match(withAsset.svg, /<image href="data:image\/png;base64,AAAA"/);

const fixtureDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'workspec-render-'));
const assetDirectory = path.join(fixtureDirectory, 'assets');
const startPath = path.join(fixtureDirectory, 'start.workspec.json');
const changesPath = path.join(fixtureDirectory, 'changes.workspec.js');
const outputPath = path.join(fixtureDirectory, 'world.svg');
fs.mkdirSync(assetDirectory);
fs.writeFileSync(path.join(assetDirectory, 'Bread Fresh.png'), Buffer.from('iVBORw0KGgo=', 'base64'));
fs.writeFileSync(startPath, JSON.stringify(documentValue), 'utf8');
fs.writeFileSync(changesPath, changes, 'utf8');
const cliPath = path.resolve(__dirname, '..', 'bin', 'workspec.js');
const cli = spawnSync(process.execPath, [cliPath, 'render', startPath, '--changes', changesPath, '--time', '09:05', '--assets', assetDirectory, '--out', outputPath], { encoding: 'utf8' });
assert.equal(cli.status, 0, cli.stderr || cli.stdout);
const cliSvg = fs.readFileSync(outputPath, 'utf8');
assert.match(cliSvg, /<svg /);
assert.match(cliSvg, /data:image\/png;base64,/);
assert.match(cli.stdout, /Rendered 09:05/);

const failed = spawnSync(process.execPath, [cliPath, 'render', path.join(fixtureDirectory, 'missing.json'), '--time', '09:05', '--json'], { encoding: 'utf8' });
assert.equal(failed.status, 2);
assert.equal(failed.stderr, '');
const failedOutput = JSON.parse(failed.stdout);
assert.equal(failedOutput.svg, null);
assert.equal(failedOutput.problems[0].metric_id, 'render.failed');

const version = spawnSync(process.execPath, [cliPath, '--version'], { encoding: 'utf8' });
assert.equal(version.status, 0);
assert.equal(version.stdout.trim(), require('../package.json').version);

process.stdout.write('✓ deterministic WorkSpec SVG library and CLI rendering\n');
