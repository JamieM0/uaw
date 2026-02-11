#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..', '..', '..');

const mappings = [
    {
        source: path.join(repoRoot, 'packages', 'workspec', 'workspec-validator.js'),
        destination: path.join(repoRoot, 'web', 'packages', 'workspec', 'workspec-validator.js')
    },
    {
        source: path.join(repoRoot, 'packages', 'workspec', 'workspec-migrate-v1-to-v2.js'),
        destination: path.join(repoRoot, 'web', 'packages', 'workspec', 'workspec-migrate-v1-to-v2.js')
    },
    {
        source: path.join(repoRoot, 'packages', 'workspec', 'v2.0.schema.json'),
        destination: path.join(repoRoot, 'web', 'packages', 'workspec', 'v2.0.schema.json')
    },
    {
        source: path.join(repoRoot, 'packages', 'workspec', 'v2.0.schema.json'),
        destination: path.join(repoRoot, 'web', 'workspec', 'v2.0.schema.json')
    }
];

function syncFile({ source, destination }) {
    const srcText = fs.readFileSync(source, 'utf8');

    let destText = null;
    try {
        destText = fs.readFileSync(destination, 'utf8');
    } catch {
        // Destination may not exist yet.
    }

    if (destText === srcText) {
        process.stdout.write(`✓ Up-to-date: ${path.relative(repoRoot, destination)}\n`);
        return;
    }

    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, srcText, 'utf8');
    process.stdout.write(`→ Synced: ${path.relative(repoRoot, destination)}\n`);
}

function main() {
    for (const mapping of mappings) {
        syncFile(mapping);
    }
}

main();
