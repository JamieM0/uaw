'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..', '..');
const Ajv = require(path.join(repoRoot, 'web', 'workspec', 'benchmarks', 'node_modules', 'ajv'));
const addFormats = require(path.join(repoRoot, 'web', 'workspec', 'benchmarks', 'node_modules', 'ajv-formats'));
const schema = require(path.join(repoRoot, 'packages', 'workspec', 'v2.1.schema.json'));

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);
const validateSchema = ajv.compile(schema);

function readJson(filePath) {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function assertSchema(documentValue, expected, label) {
    assert.equal(validateSchema(documentValue), expected, `${label}: ${JSON.stringify(validateSchema.errors)}`);
}

const packageRoot = path.join(repoRoot, 'packages', 'workspec');
const examplesDirectory = path.join(packageRoot, 'examples');
for (const name of fs.readdirSync(examplesDirectory).filter(name => name.endsWith('.workspec.json')).sort()) {
    assertSchema(readJson(path.join(examplesDirectory, name)), true, name);
}

const corpusDirectory = path.join(packageRoot, 'reliability');
const manifest = readJson(path.join(corpusDirectory, 'manifest.json'));
for (const entry of manifest.cases) {
    assertSchema(readJson(path.join(corpusDirectory, entry.file)), entry.schema_valid !== false, entry.file);
}

const library = readJson(path.join(repoRoot, 'web', 'assets', 'static', 'simulation-library.json'));
for (const entry of library.simulations.filter(item => item?.simulation?.schema_version === '2.1')) {
    assertSchema({ simulation: entry.simulation }, true, entry.id);
}

console.log(`WorkSpec schema corpus passed (${manifest.cases.length} golden cases).`);
