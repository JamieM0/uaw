'use strict';

const test = require('node:test');
const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const worker = require('../custom-validation-worker.js');
const { baseDoc } = require('./helpers.js');

test('custom validation worker exposes helpers for import-safe testing', () => {
    assert.equal(typeof worker.readStdin, 'function');
    assert.equal(typeof worker.main, 'function');
    assert.equal(worker.MAX_INPUT_BYTES > 0, true);
});

test('custom validation worker returns JSON results for valid payloads', () => {
    const fixtureDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'workspec-worker-'));
    const customPath = path.join(fixtureDir, 'validator.js');

    fs.writeFileSync(customPath, [
        'module.exports = function validateExported() {',
        '    return [{',
        "        metricId: 'custom.worker.smoke',",
        "        severity: 'warning',",
        "        title: 'Worker Smoke',",
        "        detail: 'worker executed'",
        '    }];',
        '};',
        ''
    ].join('\n'), 'utf8');

    const result = spawnSync(process.execPath, [path.join(__dirname, '..', 'custom-validation-worker.js')], {
        encoding: 'utf8',
        input: JSON.stringify({
            documentValue: baseDoc(),
            options: { customValidatorPath: customPath }
        })
    });

    assert.equal(result.status, 0);
    const payload = JSON.parse(result.stdout);
    assert.equal(payload.ok, true);
    assert.equal(payload.problems.some((problem) => problem.metric_id === 'custom.worker.smoke'), true);
});
