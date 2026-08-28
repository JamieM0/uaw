#!/usr/bin/env node
'use strict';

const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const repoRoot = path.resolve(__dirname, '..', '..', '..');

const packageValidatorPath = path.join(repoRoot, 'packages', 'workspec', 'workspec-validator.js');
const packageRuntimePath = path.join(repoRoot, 'packages', 'workspec', 'workspec-runtime.js');
const packageMigratorPath = path.join(repoRoot, 'packages', 'workspec', 'workspec-migrate-v1-to-v2.js');
const packageStateVisualsPath = path.join(repoRoot, 'packages', 'workspec', 'state-visuals.js');
const webValidatorPath = path.join(repoRoot, 'web', 'packages', 'workspec', 'workspec-validator.js');
const webRuntimePath = path.join(repoRoot, 'web', 'packages', 'workspec', 'workspec-runtime.js');
const webMigratorPath = path.join(repoRoot, 'web', 'packages', 'workspec', 'workspec-migrate-v1-to-v2.js');
const webStateVisualsPath = path.join(repoRoot, 'web', 'packages', 'workspec', 'state-visuals.js');
const playgroundHtmlPath = path.join(repoRoot, 'web', 'playground.html');
const playgroundObjectsPath = path.join(repoRoot, 'web', 'assets', 'js', 'playground', 'playground-objects.js');
const playgroundEditorPath = path.join(repoRoot, 'web', 'assets', 'js', 'playground', 'playground-editor.js');
const playgroundTimelinePath = path.join(repoRoot, 'web', 'assets', 'js', 'playground', 'playground-timeline.js');
const playgroundTimeControllerPath = path.join(repoRoot, 'web', 'assets', 'js', 'playground', 'playground-time-controller.js');
const playgroundTimelineExtensionsPath = path.join(repoRoot, 'web', 'assets', 'js', 'playground', 'playground-timeline-extensions.js');
const playgroundDisplayEditorPath = path.join(repoRoot, 'web', 'assets', 'js', 'playground', 'playground-display-editor.js');
const playgroundUtilsPath = path.join(repoRoot, 'web', 'assets', 'js', 'playground', 'playground-utils.js');
const actorAnimationPath = path.join(repoRoot, 'web', 'assets', 'js', 'space-editor-actor-animation.js');
const migrateCliPath = path.join(repoRoot, 'web', 'scripts', 'workspec-migrate.js');

function readText(filePath) {
    return fs.readFileSync(filePath, 'utf8');
}

function assertMirrored(sourcePath, mirrorPath) {
    const source = readText(sourcePath);
    const mirror = readText(mirrorPath);
    assert.equal(mirror, source, `Mirror file is out of sync: ${path.relative(repoRoot, mirrorPath)}`);
}

function loadBrowserValidator(runtimePath, filePath) {
    const runtimeSource = readText(runtimePath);
    const source = readText(filePath);
    const sandbox = { window: {}, console };
    sandbox.globalThis = sandbox.window;
    vm.createContext(sandbox);
    vm.runInContext(runtimeSource, sandbox, { filename: runtimePath });
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
                    { id: 'actor_a', type: 'actor', name: 'Actor A', properties: { state: 'idle' } },
                    { id: 'machine', type: 'equipment', name: 'Machine', properties: { state: 'ready' } }
                ]
            },
            process: {
                tasks: [
                    { id: 'task_1', actor_id: 'actor_a', start: '08:30', duration: 30, requires: { all: [
                        { '==': ['@machine.state', 'ready'] },
                        { '==': ['@@machine.state', '@@machine.state'] }
                    ] } }
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

function loadStudioTaskHelpers(runtime) {
    const sandbox = {
        window: { WorkSpecRuntime: runtime },
        document: { addEventListener() {} },
        console
    };
    vm.createContext(sandbox);
    vm.runInContext(readText(playgroundObjectsPath), sandbox, { filename: playgroundObjectsPath });
    return sandbox;
}

function run() {
    const playgroundHtml = readText(playgroundHtmlPath);
    assert.match(
        playgroundHtml,
        /<script src="\/packages\/workspec\/workspec-runtime\.js" defer><\/script>/,
        'Playground is not loading the package-backed runtime script'
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

    const playgroundObjects = readText(playgroundObjectsPath);
    const playgroundEditor = readText(playgroundEditorPath);
    assert.match(
        playgroundObjects,
        /\.\.\.\(existingTask \|\| \{\}\)/,
        'Studio task editing does not preserve WorkSpec 2.1 task-level fields'
    );
    assert.match(
        playgroundObjects,
        /dataset\.originalInteraction = JSON\.stringify\(interaction\)/,
        'Studio does not retain the original JSON for advanced interactions'
    );
    assert.match(
        playgroundObjects,
        /dataset\.preserveJson === 'true'/,
        'Studio does not restore preserved advanced interactions on save'
    );
    assert.match(playgroundObjects, /preserveDerivedStart/, 'Studio does not preserve an omitted derived start on unrelated edits');
    assert.match(playgroundObjects, /delete newTask\.start/, 'Studio cannot keep or restore derived-start mode');
    assert.match(playgroundHtml, /id="task-start-source"/, 'Studio does not label explicit versus derived starts');
    assert.match(playgroundHtml, /id="task-while-input"/, 'Studio does not edit active while invariants');
    assert.match(playgroundHtml, /id="task-progress-input"/, 'Studio does not edit progress references');
    assert.match(playgroundHtml, /id="task-continues-input"/, 'Studio does not edit continuation links');
    assert.match(playgroundObjects, /progressReference/, 'Studio does not save progress references');
    assert.match(playgroundObjects, /continuesTask/, 'Studio does not save continuation links');
    assert.match(playgroundObjects, /dataset\.originalActorId = JSON\.stringify\(task\.actor_id\)/, 'Studio does not retain dynamic actor selection JSON');
    assert.match(playgroundObjects, /interactionNeedsJsonPreservation/, 'Studio does not classify advanced interactions through a lossless preservation boundary');
    assert.match(playgroundEditor, /WorkSpecReferenceAuthoring/, 'Studio does not expose the compact-reference picker adapter');
    assert.match(playgroundEditor, /formatCompactReference/, 'Studio reference pickers do not use package-owned compact formatting');
    assert.match(playgroundEditor, /"@material\.quantity"/, 'Studio sample output does not use compact references');
    assert.doesNotMatch(playgroundEditor, /\{\s*"object"\s*:\s*"material"\s*,\s*"property"/, 'Studio sample output still emits structured references');

    const compactRoundTrip = { value: '@item.quantity', escaped: '@@item.quantity', description: '@item.quantity' };
    assert.deepEqual(JSON.parse(JSON.stringify(compactRoundTrip)), compactRoundTrip, 'Studio JSON round-trip changes compact or escaped strings');

    const playgroundTimeline = readText(playgroundTimelinePath);
    const playgroundTimeController = readText(playgroundTimeControllerPath);
    const playgroundTimelineExtensions = readText(playgroundTimelineExtensionsPath);
    const playgroundDisplayEditor = readText(playgroundDisplayEditorPath);
    const playgroundUtils = readText(playgroundUtilsPath);
    const actorAnimation = readText(actorAnimationPath);
    assert.match(playgroundTimeline, /WorkSpecRuntime\?\.replay/, 'Timeline does not consume authoritative resolved timings');
    assert.match(playgroundTimeline, /start_is_derived/, 'Timeline does not retain timing provenance');
    assert.match(playgroundTimeline, /task-block--interrupted/, 'Timeline does not render interrupted task intervals');
    assert.match(playgroundTimeline, /actual_end_minutes/, 'Timeline does not expose actual interruption endpoints');
    assert.match(playgroundTimeline, /captured_progress/, 'Timeline does not expose captured progress');
    assert.match(playgroundTimeController, /WorkSpecRuntime\?\.replay/, 'Time controller derives task timings independently');
    assert.match(playgroundTimeController, /WorkSpecRuntime\?\.snapshotAt/, 'Playback infers task lifecycle from geometry instead of authoritative snapshots');
    assert.match(playgroundTimelineExtensions, /authoritativeStatus/, 'Timeline extensions infer lifecycle from planned geometry');
    assert.match(playgroundDisplayEditor, /snapshot\.task_statuses/, 'Display playback infers active state from planned geometry');
    assert.match(playgroundUtils, /authoritativeStatus/, 'Object playback utilities infer lifecycle from planned geometry');
    assert.match(actorAnimation, /actual_end_minutes/, 'Actor animation assumes every active task reaches its planned end');

    assertMirrored(packageValidatorPath, webValidatorPath);
    assertMirrored(packageRuntimePath, webRuntimePath);
    assertMirrored(packageMigratorPath, webMigratorPath);
    assertMirrored(packageStateVisualsPath, webStateVisualsPath);

    const nodeValidator = require(packageValidatorPath);
    const nodeRuntime = require(packageRuntimePath);
    const stateVisuals = require(packageStateVisualsPath);
    const browserValidator = loadBrowserValidator(webRuntimePath, webValidatorPath);

    const validDoc = baseDoc();
    const invalidDoc = baseDoc();
    invalidDoc.simulation.process.tasks[0].actor_id = 'missing_actor';

    const nodeValid = normalizeResult(nodeValidator.validate(clone(validDoc)));
    const browserValid = normalizeResult(browserValidator.validate(clone(validDoc)));
    assert.deepEqual(browserValid, nodeValid, 'Validator mismatch on valid document');

    const nodeInvalid = normalizeResult(nodeValidator.validate(clone(invalidDoc)));
    const browserInvalid = normalizeResult(browserValidator.validate(clone(invalidDoc)));
    assert.deepEqual(browserInvalid, nodeInvalid, 'Validator mismatch on invalid document');

    const studioHelpers = loadStudioTaskHelpers(nodeRuntime);
    assert.equal(studioHelpers.interactionNeedsJsonPreservation({
        target_id: '@selected_file.id',
        property_changes: { quantity: { delta: { '+': ['@batch.amount', 1] } } }
    }), true, 'Studio would coerce a compact-reference/arithmetic interaction');
    assert.equal(studioHelpers.interactionNeedsJsonPreservation({
        target_id: 'item',
        description: 'Retain this valid unrepresented field.',
        property_changes: { quantity: { delta: -1 } }
    }), true, 'Studio would drop an unrepresented valid interaction field');
    assert.equal(studioHelpers.interactionNeedsJsonPreservation({
        action: 'create',
        object: { id: 'created', type: 'resource', name: 'Created', properties: { custom_value: 1 } }
    }), true, 'Studio would rewrite a created object it cannot represent losslessly');

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

    process.stdout.write('✓ playground integration uses package-backed WorkSpec validator\n');
}

run();
