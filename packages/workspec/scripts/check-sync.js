#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..', '..', '..');

const pairs = [
    {
        a: path.join(repoRoot, 'packages', 'workspec', 'workspec-validator.js'),
        b: path.join(repoRoot, 'web', 'packages', 'workspec', 'workspec-validator.js'),
        label: 'workspec-validator.js'
    },
    {
        a: path.join(repoRoot, 'packages', 'workspec', 'workspec-migrate-v1-to-v2.js'),
        b: path.join(repoRoot, 'web', 'packages', 'workspec', 'workspec-migrate-v1-to-v2.js'),
        label: 'workspec-migrate-v1-to-v2.js'
    },
    {
        a: path.join(repoRoot, 'packages', 'workspec', 'v2.0.schema.json'),
        b: path.join(repoRoot, 'web', 'packages', 'workspec', 'v2.0.schema.json'),
        label: 'packages/workspec/v2.0.schema.json'
    },
    {
        a: path.join(repoRoot, 'packages', 'workspec', 'v2.0.schema.json'),
        b: path.join(repoRoot, 'web', 'workspec', 'v2.0.schema.json'),
        label: 'workspec/v2.0.schema.json'
    }
];

function main() {
    const mismatches = [];

    for (const pair of pairs) {
        const aText = fs.readFileSync(pair.a, 'utf8');
        const bText = fs.readFileSync(pair.b, 'utf8');
        if (aText !== bText) {
            mismatches.push(pair.label);
        }
    }

    if (mismatches.length > 0) {
        process.stderr.write('WorkSpec web assets are out of sync with packages/workspec.\n');
        for (const label of mismatches) {
            process.stderr.write(`- ${label}\n`);
        }
        process.stderr.write('\nRun: node packages/workspec/scripts/sync-web-assets.js\n');
        process.exitCode = 1;
        return;
    }

    process.stdout.write('✓ WorkSpec web assets are in sync\n');
}

main();
