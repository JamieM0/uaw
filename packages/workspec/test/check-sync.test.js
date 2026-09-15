'use strict';

const test = require('node:test');
const assert = require('assert/strict');

const checkSync = require('../scripts/check-sync.js');

test('check-sync exports pairs and a main entrypoint', () => {
    assert.equal(Array.isArray(checkSync.pairs), true);
    assert.equal(checkSync.pairs.length > 0, true);
    assert.equal(typeof checkSync.main, 'function');
});
