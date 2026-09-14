#!/usr/bin/env node
'use strict';

const assert = require('assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const workspec = require('..');
const goldens = require('../reliability/2.2/authoritative-run-goldens.js');

for (const golden of goldens) {
    const run = workspec.runtime.runProject(golden.startingState, golden.changes || '', golden.generator || '', golden.options);
    const state = workspec.runtime.serialiseState(run);
    if (golden.expected.status) assert.equal(state.task_statuses[golden.expected.status[0]], golden.expected.status[1], golden.id);
    if (golden.expected.statuses) assert.deepEqual(state.task_statuses, golden.expected.statuses, golden.id);
    if (golden.expected.quantity !== undefined) assert.equal(state.objects.stock.properties.quantity, golden.expected.quantity, golden.id);
    for (const metric of golden.expected.metrics) assert.ok(run.problems.some((entry) => entry.metric_id === metric), `${golden.id}: missing ${metric}`);
    if (golden.constraints) {
        const constraints = workspec.runtime.runConstraintsOnResult(run, golden.constraints, { time: golden.options.until });
        assert.equal(constraints.violations.length, golden.expected.violations, golden.id);
    }
}

// The CLI snapshot consumes the same package semantics for the causal golden.
{
    const golden = goldens.find((entry) => entry.id === 'generator-causal-execution');
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'workspec-authoritative-golden-'));
    const startPath = path.join(directory, 'start.workspec.json');
    const changesPath = path.join(directory, 'changes.workspec.js');
    const generatorPath = path.join(directory, 'generator.workspec.js');
    fs.writeFileSync(startPath, JSON.stringify(golden.startingState), 'utf8');
    fs.writeFileSync(changesPath, golden.changes, 'utf8');
    fs.writeFileSync(generatorPath, golden.generator, 'utf8');
    const cliPath = path.join(__dirname, '..', 'bin', 'workspec.js');
    const result = spawnSync(process.execPath, [cliPath, 'snapshot', startPath, '--changes', changesPath, '--generator', generatorPath, '--time', String(golden.options.until), '--seed', String(golden.options.seed), '--json'], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.equal(JSON.parse(result.stdout).state.objects.stock.properties.quantity, golden.expected.quantity);

    const projectValidation = spawnSync(process.execPath, [cliPath, 'validate', startPath, '--changes', changesPath, '--generator', generatorPath, '--time', String(golden.options.until), '--seed', String(golden.options.seed)], { encoding: 'utf8' });
    assert.equal(projectValidation.status, 0, projectValidation.stderr || projectValidation.stdout);
    assert.match(projectValidation.stdout, /Validation mode: project \| seed: 17 \| horizon: requested through 542 minutes; resolved through 542/);

    const documentValidation = spawnSync(process.execPath, [cliPath, 'validate', startPath], { encoding: 'utf8' });
    assert.equal(documentValidation.status, 0, documentValidation.stderr || documentValidation.stdout);
    assert.match(documentValidation.stdout, /Validation mode: document/);
}

process.stdout.write(`✓ ${goldens.length} WorkSpec 2.2 authoritative-run goldens\n`);
