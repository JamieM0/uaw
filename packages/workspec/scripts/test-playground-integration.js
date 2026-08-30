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
const packagePlaybackStatePath = path.join(repoRoot, 'packages', 'workspec', 'playback-state.js');
const webValidatorPath = path.join(repoRoot, 'web', 'packages', 'workspec', 'workspec-validator.js');
const webRuntimePath = path.join(repoRoot, 'web', 'packages', 'workspec', 'workspec-runtime.js');
const webMigratorPath = path.join(repoRoot, 'web', 'packages', 'workspec', 'workspec-migrate-v1-to-v2.js');
const webStateVisualsPath = path.join(repoRoot, 'web', 'packages', 'workspec', 'state-visuals.js');
const webPlaybackStatePath = path.join(repoRoot, 'web', 'packages', 'workspec', 'playback-state.js');
const playgroundHtmlPath = path.join(repoRoot, 'web', 'playground.html');
const playgroundShellPath = path.join(repoRoot, 'web', 'assets', 'js', 'playground', 'playground-shell-v2.js');
const playgroundProjectsPath = path.join(repoRoot, 'web', 'assets', 'js', 'playground', 'playground-projects-v2.js');
const playgroundScriptEditorPath = path.join(repoRoot, 'web', 'assets', 'js', 'playground', 'playground-script-editor.js');
const playgroundObjectsPath = path.join(repoRoot, 'web', 'assets', 'js', 'playground', 'playground-objects.js');
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
        /<script src="\/packages\/workspec\/workspec-runtime\.js" defer><\/script>/,
        'Playground is not loading the WorkSpec 2.1 runtime'
    );
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
    assert.match(
        playgroundHtml,
        /<script src="\/assets\/js\/playground\/playground-script-editor\.js\?v=[^"]+" defer><\/script>/,
        'Playground is not loading the WorkSpec Script editor'
    );

    const studioShell = readText(playgroundShellPath);
    const projectStore = readText(playgroundProjectsPath);
    const scriptEditor = readText(playgroundScriptEditorPath);
    const objectEditor = readText(playgroundObjectsPath);
    for (const workspace of ['Projects', 'Define', 'Script', 'Simulate', 'Validation', 'Assets']) {
        assert.match(studioShell, new RegExp(`workspaceButton\\([^\\n]+['"]${workspace}['"]`), `Studio is missing the ${workspace} workspace`);
    }
    assert.match(studioShell, /aria-label="Define views"/, 'Define views are not grouped under Define');
    for (const view of ['Process', 'Objects', 'Physical', 'Digital', 'Displays', 'Source']) {
        assert.match(studioShell, new RegExp(`\\['[^']+', '${view}',`), `Define is missing its ${view} view`);
    }
    assert.match(projectStore, /const SCRIPT_FILE = 'project\.workspec\.js'/, 'Project persistence does not define a Script file');
    assert.match(projectStore, /await this\.writeText\(project\.directoryHandle, SCRIPT_FILE,/, 'Project persistence does not write Script');
    assert.match(projectStore, /scriptDraft: scriptDraft === null/, 'Project persistence does not load Script');
    assert.match(projectStore, /createFromTemplate\(name, workSpec, directoryHandle = null, script = null\)/, 'Template creation does not accept Script content');
    assert.match(scriptEditor, /language: 'javascript'/, 'Script editor is not configured for JavaScript');
    assert.doesNotMatch(scriptEditor, /new Function|\beval\s*\(/, 'Studio must not execute Script behaviour directly');
    assert.doesNotMatch(playgroundHtml, />Interactions</, 'Define must not expose legacy task interactions');
    assert.match(objectEditor, /depends_on: document\.getElementById\('task-depends-input'\)\.value/, 'Task dependencies are not persisted from Define');
    assert.match(objectEditor, /delete newTask\.interactions/, 'Editing a task does not remove legacy behaviour from Define');

    const migrateCli = readText(migrateCliPath);
    assert.match(
        migrateCli,
        /require\('\.\.\/\.\.\/packages\/workspec\/workspec-migrate-v1-to-v2\.js'\)/,
        'web/scripts/workspec-migrate.js is not wired to the canonical workspec package'
    );

    assertMirrored(packageValidatorPath, webValidatorPath);
    assertMirrored(packageRuntimePath, webRuntimePath);
    assertMirrored(packageMigratorPath, webMigratorPath);
    assertMirrored(packageStateVisualsPath, webStateVisualsPath);
    assertMirrored(packagePlaybackStatePath, webPlaybackStatePath);

    const nodeValidator = require(packageValidatorPath);
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
    assert.equal(templateLibrary.simulations.length, 6, 'Studio template inventory changed unexpectedly');
    templateLibrary.simulations.forEach(template => {
        assert.equal(template.simulation.schema_version, '2.1', `${template.id} is not WorkSpec 2.1`);
        assert.equal(nodeValidator.validate({ simulation: template.simulation }).ok, true, `${template.id} Define is not WorkSpec-valid`);
        assert.equal(typeof template.script, 'string', `${template.id} has no Script`);
    });

    process.stdout.write('✓ playground integration uses package-backed WorkSpec runtime\n');
}

run();
