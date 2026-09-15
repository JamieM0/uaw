'use strict';

const test = require('node:test');
const assert = require('assert/strict');

const workspec = require('../index.js');

test('package index re-exports validator, migrator, and custom validation APIs', () => {
    assert.equal(typeof workspec.validate, 'function');
    assert.equal(typeof workspec.validateProject, 'function');
    assert.equal(typeof workspec.migrate, 'function');
    assert.equal(typeof workspec.runCustomValidation, 'function');
    assert.equal(typeof workspec.runCustomValidationInProcess, 'function');
    assert.equal(typeof workspec.renderSnapshotToSvg, 'function');
    assert.equal(typeof workspec.renderProjectToSvg, 'function');
});
