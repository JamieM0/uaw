'use strict';

const test = require('node:test');
const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');

const customValidationRunner = require('../custom-validation-runner.js');
const { baseDoc, createFixtureDir } = require('./helpers.js');

test('custom validation runner executes exported validators in-process and in subprocess mode', async () => {
    const fixtureDir = createFixtureDir();
    const customPath = path.join(fixtureDir, 'exported-validator.js');
    const doc = baseDoc();

    fs.writeFileSync(customPath, [
        'module.exports = function validateExported(documentValue, helpers) {',
        '    const timezone = helpers.simulation?.config?.timezone;',
        '    return [{',
        "        metricId: 'custom.exported.timezone',",
        "        severity: 'warning',",
        "        title: 'Timezone Warning',",
        "        detail: `Timezone is ${timezone}`",
        '    }];',
        '};',
        ''
    ].join('\n'), 'utf8');

    const inProcessProblems = await customValidationRunner.runCustomValidationInProcess(doc, {
        customValidatorPath: customPath
    });
    assert.equal(inProcessProblems.some((problem) => problem.metric_id === 'custom.exported.timezone' && problem.severity === 'warning'), true);

    const subprocessProblems = await customValidationRunner.runCustomValidation(doc, {
        customValidatorPath: customPath
    });
    assert.equal(subprocessProblems.some((problem) => problem.metric_id === 'custom.exported.timezone' && problem.severity === 'warning'), true);
});
