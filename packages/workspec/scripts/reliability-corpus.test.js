'use strict';

const test = require('node:test');
const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { spawnSync } = require('child_process');

const packageRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(packageRoot, '..', '..');
const runtime = require('../workspec-runtime.js');
const validator = require('../workspec-validator.js');
const stateVisuals = require('../state-visuals.js');
const corpusDirectory = path.join(packageRoot, 'reliability');
const manifest = JSON.parse(fs.readFileSync(path.join(corpusDirectory, 'manifest.json'), 'utf8'));
const browserRuntimePath = path.join(repoRoot, 'web', 'packages', 'workspec', 'workspec-runtime.js');
const cliPath = path.join(packageRoot, 'bin', 'workspec.js');

function readCase(entry) {
    return JSON.parse(fs.readFileSync(path.join(corpusDirectory, entry.file), 'utf8'));
}

function loadBrowserRuntime() {
    const sandbox = { console };
    vm.createContext(sandbox);
    vm.runInContext(fs.readFileSync(browserRuntimePath, 'utf8'), sandbox, { filename: browserRuntimePath });
    return sandbox.WorkSpecRuntime;
}

function normalizeRun(api, documentValue) {
    const run = api.replay(JSON.parse(JSON.stringify(documentValue)));
    return JSON.parse(JSON.stringify({
        state: api.serialiseState(run),
        timings: [...run.timings].map(([id, timing]) => [id, timing])
    }));
}

function runCli(filePath) {
    return spawnSync(process.execPath, [cliPath, 'validate', filePath, '--json'], { encoding: 'utf8' });
}

test('golden reliability corpus has focused valid and intentionally invalid cases', () => {
    assert.ok(manifest.cases.length >= 10 && manifest.cases.length <= 15);
    assert.ok(manifest.cases.some(entry => entry.valid));
    assert.ok(manifest.cases.some(entry => !entry.valid));
    for (const entry of manifest.cases) {
        const result = validator.validate(readCase(entry));
        assert.equal(result.ok, entry.valid, `${entry.file}: ${JSON.stringify(result.problems, null, 2)}`);
        if (!entry.valid) assert.ok(result.problems.some(problem => problem.metric_id === entry.metric_id), `${entry.file}: missing ${entry.metric_id}`);
    }
});

test('package, browser runtime, and CLI agree across the golden corpus', () => {
    const browser = loadBrowserRuntime();
    for (const entry of manifest.cases) {
        const documentValue = readCase(entry);
        const direct = validator.validate(documentValue);
        const cli = runCli(path.join(corpusDirectory, entry.file));
        assert.equal(cli.status, entry.valid ? 0 : 1, entry.file);
        assert.deepEqual(JSON.parse(cli.stdout), direct.problems, entry.file);
        if (entry.valid) assert.deepEqual(normalizeRun(browser, documentValue), normalizeRun(runtime, documentValue), entry.file);
    }
});

test('State Visuals resolves object state through the authoritative runtime', () => {
    const entry = manifest.cases.find(item => item.file.startsWith('08-state-visuals'));
    const documentValue = readCase(entry);
    const machine = documentValue.simulation.world.objects.find(object => object.id === 'machine');
    assert.equal(stateVisuals.resolveObjectStateAtTime(machine, [], '08:00', documentValue), 'running');
    assert.equal(stateVisuals.resolveStateVisualAssetId(documentValue, machine, 'running'), 'machine_running');
});

test('all current first-party examples are canonically valid and executable', () => {
    const examplesDirectory = path.join(packageRoot, 'examples');
    for (const name of fs.readdirSync(examplesDirectory).filter(name => name.endsWith('.workspec.json')).sort()) {
        const documentValue = JSON.parse(fs.readFileSync(path.join(examplesDirectory, name), 'utf8'));
        const result = validator.validate(documentValue);
        assert.equal(result.ok, true, `${name}: ${JSON.stringify(result.problems, null, 2)}`);
        assert.ok(result.runtime, `${name}: missing authoritative runtime result`);
    }
    const library = JSON.parse(fs.readFileSync(path.join(repoRoot, 'web', 'assets', 'static', 'simulation-library.json'), 'utf8'));
    for (const entry of library.simulations.filter(item => item?.simulation?.schema_version === '2.1')) {
        const result = validator.validate({ simulation: entry.simulation });
        assert.equal(result.ok, true, `${entry.id}: ${JSON.stringify(result.problems, null, 2)}`);
        assert.ok(result.runtime, `${entry.id}: missing authoritative runtime result`);
    }
});
