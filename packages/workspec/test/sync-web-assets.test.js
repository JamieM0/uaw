'use strict';

const test = require('node:test');
const assert = require('assert/strict');

const syncWebAssets = require('../scripts/sync-web-assets.js');

test('sync-web-assets exports mappings and sync helpers', () => {
    assert.equal(Array.isArray(syncWebAssets.mappings), true);
    assert.equal(syncWebAssets.mappings.length > 0, true);
    assert.equal(typeof syncWebAssets.syncFile, 'function');
    assert.equal(typeof syncWebAssets.main, 'function');
});
