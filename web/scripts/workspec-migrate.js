#!/usr/bin/env node
// WorkSpec v1.0 → v2.0 Migration CLI
// Universal Automation Wiki

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const childProcess = require('child_process');

const migrator = require('../../packages/workspec/workspec-migrate-v1-to-v2.js');

function printHelp() {
    const lines = [
        'Usage:',
        '  node web/scripts/workspec-migrate.js <input.json> [--write] [--out <output.json>]',
        '',
        'Options:',
        '  --write              Write output (in-place unless --out is provided)',
        '  --out <path>         Write output to a new file',
        '  --no-diff            Do not print diff preview',
        '  --no-schema          Do not add top-level $schema (non-library files only)',
        '  --currency <CODE>    Default currency (default: USD)',
        '  --locale <LOCALE>    Default locale (default: en-US)',
        '  --timezone <TZ>      Default timezone (default: UTC)',
        '  --help               Show help'
    ];
    process.stdout.write(lines.join('\n') + '\n');
}

function parseArgs(argv) {
    const args = {
        inputPath: null,
        write: false,
        outPath: null,
        diff: true,
        addSchema: true,
        currency: 'USD',
        locale: 'en-US',
        timezone: 'UTC'
    };

    const positionals = [];
    for (let i = 0; i < argv.length; i += 1) {
        const arg = argv[i];
        if (arg === '--help' || arg === '-h') {
            args.help = true;
            continue;
        }
        if (arg === '--write' || arg === '-w') {
            args.write = true;
            continue;
        }
        if (arg === '--no-diff') {
            args.diff = false;
            continue;
        }
        if (arg === '--no-schema') {
            args.addSchema = false;
            continue;
        }
        if (arg === '--out') {
            args.outPath = argv[i + 1];
            i += 1;
            continue;
        }
        if (arg === '--currency') {
            args.currency = argv[i + 1];
            i += 1;
            continue;
        }
        if (arg === '--locale') {
            args.locale = argv[i + 1];
            i += 1;
            continue;
        }
        if (arg === '--timezone') {
            args.timezone = argv[i + 1];
            i += 1;
            continue;
        }

        if (arg.startsWith('--')) {
            throw new Error(`Unknown flag: ${arg}`);
        }
        positionals.push(arg);
    }

    args.inputPath = positionals[0] || null;
    return args;
}

function readJsonFile(filePath) {
    const raw = fs.readFileSync(filePath, 'utf8');
    return { raw, parsed: JSON.parse(raw) };
}

function toPrettyJson(value) {
    return JSON.stringify(value, null, 2) + '\n';
}

function runDiff(oldText, newText, labelA, labelB) {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'workspec-migrate-'));
    const aPath = path.join(tmpDir, labelA);
    const bPath = path.join(tmpDir, labelB);

    fs.writeFileSync(aPath, oldText, 'utf8');
    fs.writeFileSync(bPath, newText, 'utf8');

    const result = childProcess.spawnSync(
        'git',
        ['diff', '--no-index', '--', aPath, bPath],
        { encoding: 'utf8' }
    );

    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
}

function migrateAnyJson(parsed, args) {
    if (Array.isArray(parsed?.simulations)) {
        const migratedLibrary = { ...parsed, simulations: [...parsed.simulations] };

        migratedLibrary.simulations = migratedLibrary.simulations.map((entry) => {
            if (!entry || typeof entry !== 'object' || !entry.simulation) return entry;

            const migratedDoc = migrator.migrate(
                { simulation: entry.simulation },
                {
                    addSchema: false,
                    defaultCurrency: args.currency,
                    defaultLocale: args.locale,
                    defaultTimezone: args.timezone,
                    fallbackMetaTitle: entry.name,
                    fallbackMetaDescription: entry.description,
                    fallbackMetaDomain: entry.domain
                }
            );

            return { ...entry, simulation: migratedDoc.simulation };
        });

        return migratedLibrary;
    }

    return migrator.migrate(parsed, {
        addSchema: args.addSchema,
        defaultCurrency: args.currency,
        defaultLocale: args.locale,
        defaultTimezone: args.timezone
    });
}

function main() {
    let args;
    try {
        args = parseArgs(process.argv.slice(2));
    } catch (error) {
        process.stderr.write((error && error.message ? error.message : String(error)) + '\n');
        printHelp();
        process.exitCode = 2;
        return;
    }

    if (args.help || !args.inputPath) {
        printHelp();
        process.exitCode = args.help ? 0 : 2;
        return;
    }

    const inputPath = path.resolve(process.cwd(), args.inputPath);
    const outputPath = args.outPath ? path.resolve(process.cwd(), args.outPath) : inputPath;

    const { parsed } = readJsonFile(inputPath);
    const migrated = migrateAnyJson(parsed, args);

    const oldPretty = toPrettyJson(parsed);
    const newPretty = toPrettyJson(migrated);

    if (args.diff) {
        runDiff(oldPretty, newPretty, 'before.json', 'after.json');
    }

    if (args.write) {
        fs.writeFileSync(outputPath, newPretty, 'utf8');
    }
}

main();
