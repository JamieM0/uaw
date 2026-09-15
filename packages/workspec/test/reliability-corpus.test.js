'use strict';

const test = require('node:test');
const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const runtime = require('../workspec-runtime.js');
const goldens = require('../reliability/2.2/authoritative-run-goldens.js');
const { createFixtureDir, repoRoot, runCli, writeJson } = require('./helpers.js');

const browserRuntimePath = path.join(repoRoot, 'web', 'packages', 'workspec', 'workspec-runtime.js');

function browserRuntime() {
    const sandbox = { console };
    vm.createContext(sandbox);
    vm.runInContext(fs.readFileSync(browserRuntimePath, 'utf8'), sandbox, { filename: browserRuntimePath });
    return sandbox.WorkSpecRuntime;
}

function observableRun(api, entry) {
    const run = api.runProject(
        JSON.parse(JSON.stringify(entry.startingState)),
        entry.changes || '',
        entry.generator || '',
        entry.options
    );
    return JSON.parse(JSON.stringify({
        state: api.serialiseState(run),
        resolvedThrough: run.resolvedThrough,
        complete: run.complete,
        problems: run.problems
    }));
}

test('current reliability corpus covers focused authoritative-run behaviours', () => {
    assert.ok(goldens.length >= 6);
    assert.ok(goldens.some((entry) => entry.changes));
    assert.ok(goldens.some((entry) => entry.generator));
    assert.ok(goldens.some((entry) => entry.constraints));
    assert.ok(goldens.some((entry) => entry.expected?.metrics?.length));
    assert.equal(new Set(goldens.map((entry) => entry.id)).size, goldens.length);
});

test('package and browser runtimes agree on every current golden', () => {
    const browser = browserRuntime();
    for (const entry of goldens) {
        assert.deepEqual(observableRun(browser, entry), observableRun(runtime, entry), entry.id);
    }
});

test('CLI project validation agrees with every current golden run', () => {
    for (const entry of goldens) {
        const directory = createFixtureDir();
        const startPath = path.join(directory, 'start.workspec.json');
        const changesPath = path.join(directory, 'changes.workspec.js');
        const generatorPath = path.join(directory, 'generator.workspec.js');
        writeJson(startPath, entry.startingState);
        fs.writeFileSync(changesPath, entry.changes || '', 'utf8');
        fs.writeFileSync(generatorPath, entry.generator || '', 'utf8');
        const args = [
            'validate', startPath,
            '--changes', changesPath,
            '--generator', generatorPath,
            '--time', String(entry.options.until),
            '--seed', String(entry.options.seed),
            '--json'
        ];
        const cli = runCli(args);
        const direct = runtime.runProject(entry.startingState, entry.changes || '', entry.generator || '', entry.options);
        const output = JSON.parse(cli.stdout);
        assert.equal(cli.status, direct.problems.some((problem) => problem.severity === 'error') ? 1 : 0, entry.id);
        assert.equal(output.run.resolved_through, direct.resolvedThrough, entry.id);
        assert.deepEqual(
            output.problems.filter((problem) => problem.scope === 'runtime').map((problem) => problem.metric_id).sort(),
            direct.problems.map((problem) => problem.metric_id).sort(),
            entry.id
        );
    }
});
