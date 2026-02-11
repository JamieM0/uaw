#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const validator = require(path.join(__dirname, '..', 'workspec-validator.js'));
const migrator = require(path.join(__dirname, '..', 'workspec-migrate-v1-to-v2.js'));
const customValidationRunner = require(path.join(__dirname, '..', 'custom-validation-runner.js'));

function printHelp(exitCode = 0) {
    const lines = [
        'workspec - WorkSpec v1.1.0 CLI',
        '',
        'Usage:',
        '  workspec validate <file.workspec.json> [-custom <validator.js>] [--custom-catalog <catalog.json>] [--json]',
        '  workspec migrate <file.json> --out <output.json> [--schema]',
        '  workspec format <file.json> [--write] [--out <output.json>]',
        '',
        'Commands:',
        '  validate   Validate a WorkSpec document (RFC 7807 output model).',
        '  migrate    Previous UAW Syntax -> WorkSpec v1.0.0.',
        '  format     Pretty-print JSON (2-space).',
        '',
        'Flags:',
        '  -custom <path>  Run custom validator code (Metrics Editor compatible).',
        '  --custom <path> Same as -custom.',
        '  --custom-catalog <path> Optional metrics-catalog JSON for custom metrics.',
        '  --json          Print machine-readable problems JSON (validate only).',
        '  --out <path>    Output path (migrate/format).',
        '  --write         Write output (format only; defaults to stdout).',
        '  --schema        Add top-level $schema on migrate (default: off).',
        '  -h, --help      Show help.',
        ''
    ];
    process.stdout.write(lines.join('\n') + '\n');
    process.exitCode = exitCode;
}

function readStdin() {
    return new Promise((resolve, reject) => {
        let data = '';
        process.stdin.setEncoding('utf8');
        process.stdin.on('data', (chunk) => { data += chunk; });
        process.stdin.on('end', () => resolve(data));
        process.stdin.on('error', reject);
    });
}

function parseArgs(argv) {
    const result = {
        command: null,
        positionals: [],
        flags: {}
    };

    const args = [...argv];
    result.command = args.shift() || null;

    while (args.length > 0) {
        const arg = args.shift();
        if (arg === '--') {
            result.positionals.push(...args);
            break;
        }
        if (arg === '--help' || arg === '-h') {
            result.flags.help = true;
            continue;
        }
        if (arg === '--json') {
            result.flags.json = true;
            continue;
        }
        if (arg === '--custom' || arg === '-custom') {
            result.flags.custom = args.shift() || '';
            continue;
        }
        if (arg === '--custom-catalog') {
            result.flags.customCatalog = args.shift() || '';
            continue;
        }
        if (arg === '--write') {
            result.flags.write = true;
            continue;
        }
        if (arg === '--schema') {
            result.flags.schema = true;
            continue;
        }
        if (arg === '--out') {
            result.flags.out = args.shift() || '';
            continue;
        }
        if (arg === '-') {
            result.positionals.push(arg);
            continue;
        }
        if (arg.startsWith('-')) {
            result.flags.unknown = (result.flags.unknown || []).concat([arg]);
            continue;
        }
        result.positionals.push(arg);
    }

    return result;
}

function resolvePath(inputPath) {
    if (!inputPath) return '';
    if (path.isAbsolute(inputPath)) return inputPath;
    return path.resolve(process.cwd(), inputPath);
}

function toPrettyJson(value) {
    return JSON.stringify(value, null, 2) + '\n';
}

function hasErrors(problems) {
    return problems.some((p) => p && p.severity === 'error');
}

async function readInput(filePath) {
    if (!filePath || filePath === '-') {
        return readStdin();
    }
    return fs.readFileSync(resolvePath(filePath), 'utf8');
}

async function handleValidate(filePath, flags) {
    if (Object.prototype.hasOwnProperty.call(flags, 'custom') && !flags.custom) {
        process.stderr.write('Missing custom validator path after -custom/--custom.\n');
        printHelp(2);
        return;
    }

    if (Object.prototype.hasOwnProperty.call(flags, 'customCatalog') && !flags.customCatalog) {
        process.stderr.write('Missing path after --custom-catalog.\n');
        printHelp(2);
        return;
    }

    if (!filePath) {
        process.stderr.write('Missing file path.\n');
        printHelp(2);
        return;
    }

    let raw;
    try {
        raw = await readInput(filePath);
    } catch (error) {
        process.stderr.write(`Failed to read input: ${error.message}\n`);
        process.exitCode = 2;
        return;
    }

    let parsed;
    try {
        parsed = JSON.parse(raw);
    } catch (error) {
        process.stderr.write(`Invalid JSON: ${error.message}\n`);
        process.exitCode = 2;
        return;
    }

    const result = validator.validate(parsed);
    const builtinProblems = Array.isArray(result?.problems) ? result.problems : [];

    let customProblems = [];
    if (flags.custom) {
        try {
            customProblems = await customValidationRunner.runCustomValidation(parsed, {
                customValidatorPath: flags.custom,
                customCatalogPath: flags.customCatalog
            });
        } catch (error) {
            process.stderr.write(`Custom validation failed: ${error.message}\n`);
            process.exitCode = 2;
            return;
        }
    }

    const problems = [...builtinProblems, ...customProblems];

    if (flags.json) {
        process.stdout.write(toPrettyJson(problems));
    } else {
        for (const problem of problems) {
            const severity = problem.severity || 'error';
            const metricId = problem.metric_id || 'system.error';
            const instance = problem.instance || '/';
            const detail = problem.detail || problem.title || metricId;
            process.stdout.write(`${filePath}:${instance} - ${severity}: ${detail} (${metricId})\n`);
            if (Array.isArray(problem.suggestions) && problem.suggestions.length > 0) {
                for (const suggestion of problem.suggestions) {
                    process.stdout.write(`  - ${suggestion}\n`);
                }
            }
        }
        const counts = problems.reduce((acc, p) => {
            const s = p && p.severity ? p.severity : 'error';
            acc[s] = (acc[s] || 0) + 1;
            return acc;
        }, {});

        const total = problems.length;
        if (total === 0) {
            process.stdout.write('✓ No problems found\n');
        } else {
            const e = counts.error || 0;
            const w = counts.warning || 0;
            const i = counts.info || 0;
            process.stdout.write(`\n✖ ${total} problems (${e} errors, ${w} warnings, ${i} info)\n`);
        }
    }

    process.exitCode = hasErrors(problems) ? 1 : 0;
}

async function handleMigrate(filePath, flags) {
    if (!filePath) {
        process.stderr.write('Missing file path.\n');
        printHelp(2);
        return;
    }

    if (!flags.out) {
        process.stderr.write('Missing --out <path>.\n');
        printHelp(2);
        return;
    }

    const inputPath = resolvePath(filePath);
    const outPath = resolvePath(flags.out);

    let parsed;
    try {
        parsed = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
    } catch (error) {
        process.stderr.write(`Failed to read/parse JSON: ${error.message}\n`);
        process.exitCode = 2;
        return;
    }

    let migrated;
    try {
        migrated = migrator.migrate(parsed, {
            addSchema: Boolean(flags.schema),
            defaultCurrency: 'USD',
            defaultLocale: 'en-US',
            defaultTimezone: 'UTC'
        });
    } catch (error) {
        process.stderr.write(`Migration failed: ${error.message}\n`);
        process.exitCode = 1;
        return;
    }

    fs.writeFileSync(outPath, toPrettyJson(migrated), 'utf8');
    process.stdout.write(`✓ Migrated to ${outPath}\n`);
    process.exitCode = 0;
}

async function handleFormat(filePath, flags) {
    if (!filePath) {
        process.stderr.write('Missing file path.\n');
        printHelp(2);
        return;
    }

    const inputPath = resolvePath(filePath);
    const outPath = flags.out ? resolvePath(flags.out) : inputPath;

    let parsed;
    try {
        parsed = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
    } catch (error) {
        process.stderr.write(`Failed to read/parse JSON: ${error.message}\n`);
        process.exitCode = 2;
        return;
    }

    const formatted = toPrettyJson(parsed);

    if (flags.write || flags.out) {
        fs.writeFileSync(outPath, formatted, 'utf8');
        process.stdout.write(`✓ Wrote ${outPath}\n`);
    } else {
        process.stdout.write(formatted);
    }

    process.exitCode = 0;
}

async function main() {
    const { command, positionals, flags } = parseArgs(process.argv.slice(2));

    if (command === '--help' || command === '-h') {
        printHelp(0);
        return;
    }

    if (flags.help || !command) {
        printHelp(flags.help ? 0 : 2);
        return;
    }

    if (Array.isArray(flags.unknown) && flags.unknown.length > 0) {
        process.stderr.write(`Unknown flags: ${flags.unknown.join(', ')}\n`);
        process.exitCode = 2;
        return;
    }

    switch (command) {
        case 'validate':
            await handleValidate(positionals[0], flags);
            return;
        case 'migrate':
            await handleMigrate(positionals[0], flags);
            return;
        case 'format':
            await handleFormat(positionals[0], flags);
            return;
        default:
            process.stderr.write(`Unknown command: ${command}\n`);
            printHelp(2);
    }
}

main().catch((error) => {
    process.stderr.write(`Unexpected error: ${error && error.message ? error.message : String(error)}\n`);
    process.exitCode = 1;
});
