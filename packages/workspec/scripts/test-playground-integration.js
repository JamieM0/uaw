#!/usr/bin/env node
'use strict';

const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const repoRoot = path.resolve(__dirname, '..', '..', '..');

const packageValidatorPath = path.join(repoRoot, 'packages', 'workspec', 'workspec-validator.js');
const packageRuntimePath = path.join(repoRoot, 'packages', 'workspec', 'workspec-runtime.js');
const packageProjectValidatorPath = path.join(repoRoot, 'packages', 'workspec', 'workspec-project-validator.js');
const packageMigratorPath = path.join(repoRoot, 'packages', 'workspec', 'workspec-migrate-v1-to-v2.js');
const packageStateVisualsPath = path.join(repoRoot, 'packages', 'workspec', 'state-visuals.js');
const packagePlaybackStatePath = path.join(repoRoot, 'packages', 'workspec', 'playback-state.js');
const webValidatorPath = path.join(repoRoot, 'web', 'packages', 'workspec', 'workspec-validator.js');
const webRuntimePath = path.join(repoRoot, 'web', 'packages', 'workspec', 'workspec-runtime.js');
const webProjectValidatorPath = path.join(repoRoot, 'web', 'packages', 'workspec', 'workspec-project-validator.js');
const webMigratorPath = path.join(repoRoot, 'web', 'packages', 'workspec', 'workspec-migrate-v1-to-v2.js');
const webStateVisualsPath = path.join(repoRoot, 'web', 'packages', 'workspec', 'state-visuals.js');
const webPlaybackStatePath = path.join(repoRoot, 'web', 'packages', 'workspec', 'playback-state.js');
const declarationNames = ['workspec-changes.d.ts', 'workspec-constraints.d.ts', 'workspec-generator.d.ts'];
const playgroundHtmlPath = path.join(repoRoot, 'web', 'playground.html');
const playgroundShellPath = path.join(repoRoot, 'web', 'assets', 'js', 'playground', 'playground-shell-v2.js');
const playgroundProjectsPath = path.join(repoRoot, 'web', 'assets', 'js', 'playground', 'playground-projects-v2.js');
const playgroundScriptEditorPath = path.join(repoRoot, 'web', 'assets', 'js', 'playground', 'playground-editor-workspace.js');
const playgroundLegacyEditorPath = path.join(repoRoot, 'web', 'assets', 'js', 'playground', 'playground-editor.js');
const playgroundMetricsEditorPath = path.join(repoRoot, 'web', 'assets', 'js', 'playground', 'playground-metrics-editor.js');
const playgroundValidationPath = path.join(repoRoot, 'web', 'assets', 'js', 'playground', 'playground-validation.js');
const playgroundObjectsPath = path.join(repoRoot, 'web', 'assets', 'js', 'playground', 'playground-objects.js');
const tutorialContentPath = path.join(repoRoot, 'web', 'assets', 'static', 'tutorial-content.json');
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

function loadBrowserProjectValidator() {
    const sandbox = { console };
    sandbox.window = sandbox;
    vm.createContext(sandbox);
    for (const filePath of [webRuntimePath, webValidatorPath, webProjectValidatorPath]) {
        vm.runInContext(readText(filePath), sandbox, { filename: filePath });
    }
    assert.equal(typeof sandbox.WorkSpecProjectValidator?.validateProject, 'function', 'Browser project validator did not expose validateProject');
    return sandbox.WorkSpecProjectValidator;
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

function assertPlaybackValidationObserverIsNonReentrant() {
    const source = readText(playgroundLegacyEditorPath);
    const start = source.indexOf('function updatePlaybackControlState');
    const end = source.indexOf('// JSON validation function', start);
    assert.ok(start >= 0 && end > start, 'Playback validation functions are not present');

    let observerCallback;
    let playerUpdates = 0;
    const sandbox = {
        window: {
            player: { update: () => { playerUpdates += 1; } },
            dispatchEvent() {}
        },
        document: {
            body: { classList: { toggle() {} } },
            querySelectorAll: () => []
        },
        MutationObserver: class {
            constructor(callback) { observerCallback = callback; }
            observe() {}
        },
        cancelAnimationFrame() {},
        CustomEvent: class {},
        console
    };

    vm.createContext(sandbox);
    vm.runInContext(source.slice(start, end), sandbox, { filename: playgroundLegacyEditorPath });
    sandbox.setPlaybackValidationBlocked([{
        metric_id: 'temporal.scheduling.dependency_violation',
        severity: 'error'
    }]);
    assert.equal(playerUpdates, 1, 'initial validation should update playback once');

    observerCallback();
    assert.equal(playerUpdates, 1, 'observer callback must not re-enter player.update');
}

function run() {
    const playgroundHtml = readText(playgroundHtmlPath);
    assert.match(
        playgroundHtml,
        /<script src="\/packages\/workspec\/workspec-runtime\.js(?:\?v=[^"]+)?" defer><\/script>/,
        'Playground is not loading the WorkSpec 2 runtime'
    );
    assert.match(
        playgroundHtml,
        /<script src="\/packages\/workspec\/playback-state\.js" defer><\/script>/,
        'Playground is not loading the shared playback-state resolver'
    );
    assert.match(
        playgroundHtml,
        /<script src="\/packages\/workspec\/workspec-validator\.js(?:\?v=[^"]+)?" defer><\/script>/,
        'Playground is not loading the package-backed validator script'
    );
    assert.match(
        playgroundHtml,
        /<script src="\/packages\/workspec\/workspec-project-validator\.js(?:\?v=[^"]+)?" defer><\/script>/,
        'Playground is not loading the project validation orchestrator'
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
    assert.match(
        playgroundHtml,
        /<script src="\/assets\/js\/playground\/playground-editor-workspace\.js\?v=[^"]+" defer><\/script>/,
        'Playground is not loading the WorkSpec Editor'
    );

    const studioShell = readText(playgroundShellPath);
    const projectStore = readText(playgroundProjectsPath);
    const scriptEditor = readText(playgroundScriptEditorPath);
    const legacyEditor = readText(playgroundLegacyEditorPath);
    const metricsEditor = readText(playgroundMetricsEditorPath);
    const validationPanel = readText(playgroundValidationPath);
    const objectEditor = readText(playgroundObjectsPath);
    for (const workspace of ['Projects', 'Model', 'Editor', 'Simulate', 'Assets']) {
        assert.match(studioShell, new RegExp(`workspaceButton\\([^\\n]+['"]${workspace}['"]`), `Studio is missing the ${workspace} workspace`);
    }
    assert.match(studioShell, /aria-label="Model views"/, 'Visual views are not grouped under Model');
    for (const [viewId, viewLabel] of [['process', 'Process'], ['objects', 'Objects'], ['physical', 'Physical'], ['digital', 'Digital'], ['displays', 'Displays']]) {
        assert.match(studioShell, new RegExp(`\\['${viewId}',`), `Model is missing its ${viewLabel} view`);
    }
    for (const file of ['start.workspec.json', 'changes.workspec.js', 'constraints.workspec.js', 'generator.workspec.js']) assert.match(projectStore, new RegExp(file.replace(/\./g, '\\.')), `Project persistence is missing ${file}`);
    for (const label of ['Starting State', 'Changes', 'Generator', 'Constraints', 'Constraint Library']) assert.match(scriptEditor, new RegExp(`'${label}'`), `Editor is missing ${label}`);
    assert.match(scriptEditor, /workSpecChangesEditor/, 'Changes are not project-backed');
    assert.match(scriptEditor, /workSpecGeneratorEditor/, 'Generator is not project-backed');
    assert.match(scriptEditor, /constraintSource/, 'Runtime constraint source is not available to Studio');
    declarationNames.forEach((name) => {
        assert.match(scriptEditor, new RegExp(name.replace(/\./g, '\\.')), `Studio is not loading ${name}`);
        assertMirrored(
            path.join(repoRoot, 'packages', 'workspec', name),
            path.join(repoRoot, 'web', 'packages', 'workspec', name)
        );
    });
    assert.doesNotMatch(scriptEditor, /const (?:CHANGES|GENERATOR|CONSTRAINTS)_TYPES/, 'Studio still embeds WorkSpec declarations');
    assert.ok((legacyEditor.match(/WorkSpecProjectValidator\.validateProject/g) || []).length >= 2, 'Automatic and manual Studio validation do not share project orchestration');
    assert.doesNotMatch(legacyEditor, /runtime\.problems\.filter\([^\n]+startsWith/, 'Studio still filters runtime problems by metric prefix');
    assert.match(metricsEditor, /Legacy built-in Metrics Catalog checks are not authoritative for WorkSpec 2\.2/, 'Metrics Editor does not identify its legacy 2.2 limitation');
    assert.match(metricsEditor, /metric\.source === 'custom'/, 'Metrics Editor still runs legacy built-in metrics for WorkSpec 2.2');
    assert.match(validationPanel, /workSpecTimeController\?\.setTime/, 'Runtime violations cannot move the Studio playback clock');
    assert.match(validationPanel, /violation\.objects/, 'Runtime violations cannot identify affected Studio objects');
    assert.match(scriptEditor, /registerCodeActionProvider/, 'Starting State corrections are not exposed as code actions');
    assert.match(studioShell, /data-open-changes-task/, 'Process view does not expose Changes handler references');
    assert.match(studioShell, /data-open-changes-object/, 'Object view does not expose Changes helper references');
    assert.match(studioShell, /help\.tutorial/, 'The current Studio shell does not expose the guided tutorial');
    assert.doesNotMatch(scriptEditor, /new Function|\beval\s*\(/, 'Studio must not execute authored JavaScript directly');
    assert.doesNotMatch(playgroundHtml, />Interactions</, 'Model must not expose legacy task interactions');
    assert.doesNotMatch(playgroundHtml, /task-add-interaction-btn/, 'Task editor must not offer legacy interactions in Starting State');
    assert.match(objectEditor, /depends_on: document\.getElementById\('task-depends-input'\)\.value/, 'Task dependencies are not persisted from Model');
    assertPlaybackValidationObserverIsNonReentrant();

    const tutorial = JSON.parse(readText(tutorialContentPath));
    assert.equal(tutorial.steps.length, 8, 'The first-run tutorial should remain a short progressive path');
    assert.deepEqual(tutorial.steps.map(step => step.id), [
        'starting_state', 'edit_starting_state', 'validate_starting_state', 'add_change',
        'simulate', 'inspect_constraint', 'violate_constraint', 'generator_optional'
    ]);
    assert.equal(tutorial.steps[0].initial_json.simulation.schema_version, '2.2', 'Tutorial is not WorkSpec 2');
    assert.doesNotMatch(JSON.stringify(tutorial), /\"interactions\"\s*:/, 'Tutorial teaches legacy task interactions');
    assert.match(tutorial.steps.at(-1).instructions, /Generator[\s\S]*optional|optional[\s\S]*Generator/, 'Tutorial does not explain that Generator is optional');

    const migrateCli = readText(migrateCliPath);
    assert.match(
        migrateCli,
        /require\('\.\.\/\.\.\/packages\/workspec\/workspec-migrate-v1-to-v2\.js'\)/,
        'web/scripts/workspec-migrate.js is not wired to the canonical workspec package'
    );

    assertMirrored(packageValidatorPath, webValidatorPath);
    assertMirrored(packageRuntimePath, webRuntimePath);
    assertMirrored(packageProjectValidatorPath, webProjectValidatorPath);
    assertMirrored(packageMigratorPath, webMigratorPath);
    assertMirrored(packageStateVisualsPath, webStateVisualsPath);
    assertMirrored(packagePlaybackStatePath, webPlaybackStatePath);

    const nodeValidator = require(packageValidatorPath);
    const browserValidator = loadBrowserValidator(webValidatorPath);
    const nodeRuntime = require(packageRuntimePath);
    const browserProjectValidator = loadBrowserProjectValidator();
    assert.equal(typeof nodeRuntime.analyzeChanges, 'function', 'Package runtime does not expose Changes analysis');
    assert.equal(typeof nodeRuntime.compileGenerator, 'function', 'Package runtime does not expose Generator compilation');
    assert.equal(typeof nodeRuntime.runConstraints, 'function', 'Package runtime does not expose runtime constraints');
    assert.equal(typeof browserProjectValidator.validateProject, 'function', 'Browser project validator does not expose project validation');
    assert.equal(nodeRuntime.analyzeChanges('WorkSpec.task("task_1").onStart(() => {});').handlers[0].taskId, 'task_1');

    const validDoc = baseDoc();
    const invalidDoc = baseDoc();
    invalidDoc.simulation.process.tasks[0].actor_id = 'missing_actor';

    const nodeValid = normalizeResult(nodeValidator.validate(clone(validDoc)));
    const browserValid = normalizeResult(browserValidator.validate(clone(validDoc)));
    assert.deepEqual(browserValid, nodeValid, 'Validator mismatch on valid document');

    const nodeInvalid = normalizeResult(nodeValidator.validate(clone(invalidDoc)));
    const browserInvalid = normalizeResult(browserValidator.validate(clone(invalidDoc)));
    assert.deepEqual(browserInvalid, nodeInvalid, 'Validator mismatch on invalid document');

    const capacityDoc = baseDoc();
    capacityDoc.simulation.schema_version = '2.2';
    capacityDoc.simulation.world.objects = [
        { id: 'actor_a', type: 'actor', name: 'Actor A', properties: { state: 'idle' } },
        { id: 'actor_b', type: 'actor', name: 'Actor B', properties: { state: 'idle' } },
        { id: 'station', type: 'equipment', name: 'Station', properties: { state: 'idle', capacity: 1 } }
    ];
    capacityDoc.simulation.process.tasks = [
        { id: 'task_a', actor_id: 'actor_a', start: '08:30', duration: 30, reservations: [{ resource: 'station', mode: 'capacity', amount: 1 }] },
        { id: 'task_b', actor_id: 'actor_b', start: '08:30', duration: 30, reservations: [{ resource: 'station', mode: 'capacity', amount: 1 }] }
    ];
    const browserCapacity = normalizeResult(browserProjectValidator.validateProject(capacityDoc));
    assert.equal(browserCapacity.problems.some((problem) => problem.metric_id === 'reservation.capacity.exceeded' && problem.scope === 'runtime'), true, 'Browser project validation lost reservation capacity diagnostics');

    const templateLibrary = JSON.parse(readText(path.join(repoRoot, 'web', 'assets', 'static', 'simulation-library.json')));
    assert.equal(templateLibrary.simulations.length, 7, 'Studio template inventory changed unexpectedly');
    templateLibrary.simulations.forEach(template => {
        assert.equal(template.simulation.schema_version, '2.2', `${template.id} is not WorkSpec 2`);
        assert.equal(nodeValidator.validate({ simulation: template.simulation }).ok, true, `${template.id} Starting State is not WorkSpec-valid`);
        assert.equal(typeof template.changes, 'string', `${template.id} has no Changes`);
        assert.equal(typeof template.constraints, 'string', `${template.id} has no Constraints`);
    });
    const sterilisation = templateLibrary.simulations.find(template => template.id === 'steam_sterilisation');
    assert.ok(sterilisation, 'steam_sterilisation template is missing');
    assert.equal(typeof sterilisation.generator, 'string', 'steam_sterilisation has no Generator');
    assert.match(sterilisation.generator, /WorkSpec\.onUpdate/, 'steam_sterilisation Generator is not computational');

    process.stdout.write('✓ playground integration uses package-backed WorkSpec runtime\n');
}

run();
