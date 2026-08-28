#!/usr/bin/env node
'use strict';

const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const repoRoot = path.resolve(__dirname, '..', '..', '..');

const packageValidatorPath = path.join(repoRoot, 'packages', 'workspec', 'workspec-validator.js');
const packageMigratorPath = path.join(repoRoot, 'packages', 'workspec', 'workspec-migrate-v1-to-v2.js');
const packageStateVisualsPath = path.join(repoRoot, 'packages', 'workspec', 'state-visuals.js');
const packagePlaybackStatePath = path.join(repoRoot, 'packages', 'workspec', 'playback-state.js');
const webValidatorPath = path.join(repoRoot, 'web', 'packages', 'workspec', 'workspec-validator.js');
const webMigratorPath = path.join(repoRoot, 'web', 'packages', 'workspec', 'workspec-migrate-v1-to-v2.js');
const webStateVisualsPath = path.join(repoRoot, 'web', 'packages', 'workspec', 'state-visuals.js');
const webPlaybackStatePath = path.join(repoRoot, 'web', 'packages', 'workspec', 'playback-state.js');
const playgroundHtmlPath = path.join(repoRoot, 'web', 'playground.html');
const migrateCliPath = path.join(repoRoot, 'web', 'scripts', 'workspec-migrate.js');

function readText(filePath) {
    return fs.readFileSync(filePath, 'utf8');
}

function assertMirrored(sourcePath, mirrorPath) {
    const source = readText(sourcePath);
    const mirror = readText(mirrorPath);
    assert.equal(mirror, source, `Mirror file is out of sync: ${path.relative(repoRoot, mirrorPath)}`);
}

function loadBrowserValidator(filePath) {
    const source = readText(filePath);
    const sandbox = { window: {}, console };
    vm.createContext(sandbox);
    vm.runInContext(source, sandbox, { filename: filePath });

    assert.ok(
        sandbox.window.WorkSpecValidator && typeof sandbox.window.WorkSpecValidator.validate === 'function',
        'Browser validator failed to expose window.WorkSpecValidator.validate'
    );

    return sandbox.window.WorkSpecValidator;
}

function baseDoc() {
    return {
        simulation: {
            schema_version: '2.0',
            meta: {
                title: 'Integration Smoke Test',
                description: 'Validates package + playground parity.',
                domain: 'qa'
            },
            config: {
                time_unit: 'minutes',
                start_time: '08:00',
                end_time: '10:00',
                currency: 'USD',
                locale: 'en-US',
                timezone: 'UTC'
            },
            world: {
                objects: [
                    { id: 'actor_a', type: 'actor', name: 'Actor A', properties: { state: 'idle' } }
                ]
            },
            process: {
                tasks: [
                    { id: 'task_1', actor_id: 'actor_a', start: '08:30', duration: 30 }
                ]
            }
        }
    };
}

function clone(value) {
    return JSON.parse(JSON.stringify(value));
}

function normalizeResult(value) {
    return JSON.parse(JSON.stringify(value));
}

function run() {
    const playgroundHtml = readText(playgroundHtmlPath);
    assert.match(
        playgroundHtml,
        /<script src="\/packages\/workspec\/playback-state\.js" defer><\/script>/,
        'Playground is not loading the shared playback-state resolver'
    );
    assert.match(
        playgroundHtml,
        /<script src="\/packages\/workspec\/workspec-validator\.js" defer><\/script>/,
        'Playground is not loading the package-backed validator script'
    );
    assert.match(
        playgroundHtml,
        /<script src="\/packages\/workspec\/workspec-migrate-v1-to-v2\.js" defer><\/script>/,
        'Playground is not loading the package-backed migrator script'
    );
    assert.match(
        playgroundHtml,
        /<script src="\/packages\/workspec\/state-visuals\.js" defer><\/script>/,
        'Playground is not loading the shared state visual resolver'
    );

    const migrateCli = readText(migrateCliPath);
    assert.match(
        migrateCli,
        /require\('\.\.\/\.\.\/packages\/workspec\/workspec-migrate-v1-to-v2\.js'\)/,
        'web/scripts/workspec-migrate.js is not wired to the canonical workspec package'
    );

    assertMirrored(packageValidatorPath, webValidatorPath);
    assertMirrored(packageMigratorPath, webMigratorPath);
    assertMirrored(packageStateVisualsPath, webStateVisualsPath);
    assertMirrored(packagePlaybackStatePath, webPlaybackStatePath);

    const nodeValidator = require(packageValidatorPath);
    const stateVisuals = require(packageStateVisualsPath);
    const playbackState = require(packagePlaybackStatePath);
    const browserValidator = loadBrowserValidator(webValidatorPath);

    const validDoc = baseDoc();
    const invalidDoc = baseDoc();
    invalidDoc.simulation.process.tasks[0].actor_id = 'missing_actor';

    const nodeValid = normalizeResult(nodeValidator.validate(clone(validDoc)));
    const browserValid = normalizeResult(browserValidator.validate(clone(validDoc)));
    assert.deepEqual(browserValid, nodeValid, 'Validator mismatch on valid document');

    const nodeInvalid = normalizeResult(nodeValidator.validate(clone(invalidDoc)));
    const browserInvalid = normalizeResult(browserValidator.validate(clone(invalidDoc)));
    assert.deepEqual(browserInvalid, nodeInvalid, 'Validator mismatch on invalid document');

    const templateLibrary = JSON.parse(readText(path.join(repoRoot, 'web', 'assets', 'static', 'simulation-library.json')));
    const breadmaking = templateLibrary.simulations.find(item => item.id === 'breadmaking')?.simulation;
    assert.ok(breadmaking, 'Breadmaking template is missing');
    assert.equal(nodeValidator.validate({ simulation: breadmaking }).ok, true, 'Breadmaking template is not WorkSpec-valid');
    assert.equal(Object.keys(breadmaking.state_libraries || {}).length, 4, 'Breadmaking template should exercise reusable State Libraries');
    breadmaking.world.objects.forEach(object => {
        assert.ok(object.state_library, `${object.id} is missing a State Library`);
        assert.ok(object.appearance, `${object.id} is missing an appearance`);
        assert.equal(typeof stateVisuals.resolveStateVisualAssetId(breadmaking, object), 'string', `${object.id} has no initial visual mapping`);
    });
    const bakeryModel = playbackState.createPlaybackModel({ simulation: breadmaking });
    assert.equal(playbackState.getObjectLocationAtTime(bakeryModel, 'assistant', 9 * 60 + 10), 'oven_area');
    assert.equal(playbackState.getObjectStateAtTime(bakeryModel, 'oven', 9 * 60 + 10), 'preheating');

    process.stdout.write('✓ playground integration uses package-backed WorkSpec runtime\n');
}

run();
