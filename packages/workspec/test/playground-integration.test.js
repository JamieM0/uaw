'use strict';

const test = require('node:test');
const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const { repoRoot } = require('./helpers.js');

const packageValidatorPath = path.join(repoRoot, 'packages', 'workspec', 'workspec-validator.js');
const packageRuntimePath = path.join(repoRoot, 'packages', 'workspec', 'workspec-runtime.js');
const packageMigratorPath = path.join(repoRoot, 'packages', 'workspec', 'workspec-migrate-v1-to-v2.js');
const webValidatorPath = path.join(repoRoot, 'web', 'packages', 'workspec', 'workspec-validator.js');
const webRuntimePath = path.join(repoRoot, 'web', 'packages', 'workspec', 'workspec-runtime.js');
const webMigratorPath = path.join(repoRoot, 'web', 'packages', 'workspec', 'workspec-migrate-v1-to-v2.js');
const playgroundHtmlPath = path.join(repoRoot, 'web', 'playground.html');
const migrateCliPath = path.join(repoRoot, 'web', 'scripts', 'workspec-migrate.js');
const studioTaskEditorPath = path.join(repoRoot, 'web', 'assets', 'js', 'playground', 'playground-objects.js');

function readText(filePath) {
    return fs.readFileSync(filePath, 'utf8');
}

function assertMirrored(sourcePath, mirrorPath) {
    assert.equal(
        readText(mirrorPath),
        readText(sourcePath),
        `Mirror file is out of sync: ${path.relative(repoRoot, mirrorPath)}`
    );
}

function loadBrowserValidator(runtimePath, filePath) {
    const sandbox = { window: {}, console };
    sandbox.globalThis = sandbox.window;
    vm.createContext(sandbox);
    vm.runInContext(readText(runtimePath), sandbox, { filename: runtimePath });
    vm.runInContext(readText(filePath), sandbox, { filename: filePath });

    assert.ok(
        sandbox.window.WorkSpecValidator && typeof sandbox.window.WorkSpecValidator.validate === 'function',
        'Browser validator failed to expose window.WorkSpecValidator.validate'
    );

    return sandbox.window.WorkSpecValidator;
}

function clone(value) {
    return JSON.parse(JSON.stringify(value));
}

function normalizeResult(value) {
    return JSON.parse(JSON.stringify(value));
}

function baseDoc() {
    return {
        simulation: {
            schema_version: '2.1',
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

test('playground wiring uses package-backed WorkSpec assets and preserves validator parity', () => {
    const playgroundHtml = readText(playgroundHtmlPath);
    // Script tags carry an optional cache-busting ?v= query; parity is about
    // loading the package-backed asset, not the exact URL.
    const packageScript = (file) => new RegExp(`<script src="/packages/workspec/${file}(\\?v=[^"]*)?" defer></script>`);
    assert.match(
        playgroundHtml,
        packageScript('workspec-runtime\\.js'),
        'Playground is not loading the package-backed runtime script'
    );
    assert.match(
        playgroundHtml,
        packageScript('workspec-validator\\.js'),
        'Playground is not loading the package-backed validator script'
    );
    assert.match(
        playgroundHtml,
        /<script src="\/packages\/workspec\/workspec-migrate-v1-to-v2\.js" defer><\/script>/,
        'Playground is not loading the package-backed migrator script'
    );

    assert.match(
        readText(migrateCliPath),
        /require\('\.\.\/\.\.\/packages\/workspec\/workspec-migrate-v1-to-v2\.js'\)/,
        'web/scripts/workspec-migrate.js is not wired to the canonical workspec package'
    );

    assertMirrored(packageValidatorPath, webValidatorPath);
    assertMirrored(packageRuntimePath, webRuntimePath);
    assertMirrored(packageMigratorPath, webMigratorPath);

    const nodeValidator = require(packageValidatorPath);
    const browserValidator = loadBrowserValidator(webRuntimePath, webValidatorPath);

    const validDoc = baseDoc();
    const invalidDoc = baseDoc();
    invalidDoc.simulation.process.tasks[0].actor_id = 'missing_actor';

    assert.deepEqual(
        normalizeResult(browserValidator.validate(clone(validDoc))),
        normalizeResult(nodeValidator.validate(clone(validDoc))),
        'Validator mismatch on valid document'
    );
    assert.deepEqual(
        normalizeResult(browserValidator.validate(clone(invalidDoc))),
        normalizeResult(nodeValidator.validate(clone(invalidDoc))),
        'Validator mismatch on invalid document'
    );
});

test('Studio task editing preserves WorkSpec 2.1 JSON-only structures', () => {
    const source = readText(studioTaskEditorPath);
    assert.match(source, /\.\.\.\(existingTask \|\| \{\}\)/, 'Task save must retain task-level when/requires/timing/reservations');
    assert.match(source, /dataset\.originalInteraction = JSON\.stringify\(interaction\)/, 'Interaction JSON is not captured for lossless editing');
    assert.match(source, /dataset\.preserveJson === 'true'/, 'Advanced interactions are not preserved on save');
    assert.match(source, /interaction\.at !== undefined \|\| interaction\.when !== undefined/, 'at/when interactions are not classified as JSON-preserved structures');
});

test('Studio preserves compact expression interactions and dynamic actor bindings', () => {
    const runtime = require(packageRuntimePath);
    const sandbox = {
        window: { WorkSpecRuntime: runtime },
        document: { addEventListener() {} },
        console
    };
    vm.createContext(sandbox);
    vm.runInContext(readText(studioTaskEditorPath), sandbox, { filename: studioTaskEditorPath });

    assert.equal(typeof sandbox.interactionNeedsJsonPreservation, 'function');
    assert.equal(sandbox.interactionNeedsJsonPreservation({
        target_id: '@selected_file.id',
        property_changes: { quantity: { delta: { '+': ['@batch.amount', 1] } } }
    }), true);
    assert.equal(sandbox.interactionNeedsJsonPreservation({
        target_id: 'item',
        description: 'Retain this valid unrepresented field.',
        property_changes: { quantity: { delta: -1 } }
    }), true);
    assert.equal(sandbox.interactionNeedsJsonPreservation({
        action: 'create',
        object: { id: 'created', type: 'resource', name: 'Created', properties: { custom_value: 1 } }
    }), true);

    const source = readText(studioTaskEditorPath);
    assert.match(source, /dataset\.originalActorId = JSON\.stringify\(task\.actor_id\)/);
    assert.match(source, /actor_id: preserveActorJson \? JSON\.parse\(actorSelect\.dataset\.originalActorId\) : actorId/);
});
