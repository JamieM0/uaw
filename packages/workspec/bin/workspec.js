#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const validator = require(path.join(__dirname, '..', 'workspec-validator.js'));
const projectValidator = require(path.join(__dirname, '..', 'workspec-project-validator.js'));
const migrator = require(path.join(__dirname, '..', 'workspec-migrate-v1-to-v2.js'));
const customValidationRunner = require(path.join(__dirname, '..', 'custom-validation-runner.js'));
const runtime = require(path.join(__dirname, '..', 'workspec-runtime.js'));

function printHelp(exitCode = 0) {
    const lines = [
        'workspec - WorkSpec 2 CLI',
        '',
        'Usage:',
        '  workspec validate <start.workspec.json> [--changes <changes.workspec.js>] [--generator <generator.workspec.js>] [--constraints <constraints.workspec.js>] [--time <time>] [--seed <seed>] [--max-events <count>] [-custom <validator.js>] [--custom-catalog <catalog.json>] [--json] [--fail-on-warning] [-y]',
        '  workspec snapshot <start.workspec.json> [--changes <changes.workspec.js>] [--generator <generator.workspec.js>] --time <time> [--seed <seed>] [--max-events <count>] [--json]',
        '  workspec constraints <start.workspec.json> --constraints <constraints.workspec.js> [--changes <changes.workspec.js>] [--generator <generator.workspec.js>] [--time <time>] [--seed <seed>] [--max-events <count>] [--json] [-y]',
        '  workspec migrate <file.json> --out <output.json> [--schema]',
        '  workspec format <file.json> [--write] [--out <output.json>]',
        '',
        'Commands:',
        '  validate   Validate a Starting State document, or a full project when project-source flags are supplied.',
        '  snapshot   Run a project and resolve its observable world state at a time.',
        '  constraints Run a project and execute runtime constraints over resolved state.',
        '  migrate    Previous UAW Syntax -> WorkSpec 2.1.',
        '  format     Pretty-print JSON (2-space).',
        '',
        'Flags:',
        '  -custom <path>  Run custom validator code (Metrics Editor compatible).',
        '  --custom <path> Same as -custom.',
        '  --custom-catalog <path> Optional metrics-catalog JSON for custom metrics.',
        '  -y, --yes      Acknowledge trusted custom validation/constraint JavaScript.',
        '  --json          Print machine-readable JSON (validate/snapshot/constraints).',
        '  --changes <path> Optional WorkSpec Changes source (validate/snapshot/constraints).',
        '  --generator <path> Optional WorkSpec Generator source (validate/snapshot/constraints).',
        '  --constraints <path> Runtime constraint functions (validate/constraints).',
        '  --time <time>   Runtime time as minutes, HH:MM, day/time JSON, or ISO date-time.',
        '  --seed <seed>   Deterministic integer Generator seed (default: 1).',
        '  --max-events <count> Maximum runtime work units (default: 10000; maximum: 1000000).',
        '  --fail-on-warning Exit with status 1 when validation returns a warning.',
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
        if (arg === '--fail-on-warning') {
            result.flags.failOnWarning = true;
            continue;
        }
        if (arg === '--yes' || arg === '-y') {
            result.flags.yes = true;
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
        if (arg === '--changes') {
            result.flags.changes = args.shift() || '';
            continue;
        }
        if (arg === '--generator') {
            result.flags.generator = args.shift() || '';
            continue;
        }
        if (arg === '--constraints') {
            result.flags.constraints = args.shift() || '';
            continue;
        }
        if (arg === '--time') {
            result.flags.time = args.shift() || '';
            continue;
        }
        if (arg === '--seed') {
            result.flags.seed = args.shift() || '';
            continue;
        }
        if (arg === '--max-events') {
            result.flags.maxEvents = args.shift() || '';
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

function hasWarnings(problems) {
    return problems.some((p) => p && p.severity === 'warning');
}

function parseMaxEvents(flags) {
    if (!Object.prototype.hasOwnProperty.call(flags, 'maxEvents')) return { ok: true, value: undefined };
    const value = Number(flags.maxEvents);
    return { ok: Number.isSafeInteger(value), value };
}

function runMetadata(run, fallback = {}) {
    if (!run) {
        return {
            executed: false,
            seed: fallback.seed ?? 1,
            requested_horizon: fallback.requestedHorizon ?? null,
            resolved_through: null,
            complete: false,
            max_events: fallback.maxEvents ?? 10000,
            processed_work_units: 0
        };
    }
    return {
        executed: true,
        seed: run.seed ?? fallback.seed ?? 1,
        requested_horizon: run.requestedHorizon ?? fallback.requestedHorizon ?? null,
        resolved_through: Number.isFinite(run.resolvedThrough) ? run.resolvedThrough : null,
        complete: run.complete !== false,
        max_events: run.maxEvents ?? fallback.maxEvents ?? 10000,
        processed_work_units: run.processedWorkUnits ?? 0
    };
}

function promptConfirm(message) {
    return new Promise((resolve) => {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        rl.question(message, (answer) => {
            rl.close();
            resolve(String(answer || '').trim());
        });
    });
}

async function confirmCustomValidation(flags) {
    if (!flags.custom || flags.yes) {
        return true;
    }

    const warning = [
        'Custom validation runs JavaScript from the provided script.',
        'Only continue if you trust the author of this custom validation file.',
        'Continue custom validation? [Y/N] '
    ].join('\n');

    if (!process.stdin.isTTY || !process.stdout.isTTY) {
        process.stderr.write(
            'Custom validation confirmation is required in interactive mode. ' +
            'Re-run with -y/--yes to skip confirmation.\n'
        );
        process.exitCode = 2;
        return false;
    }

    const response = await promptConfirm(warning);
    if (response.toUpperCase() !== 'Y') {
        process.stderr.write('Custom validation cancelled.\n');
        process.exitCode = 2;
        return false;
    }

    return true;
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

    for (const [flag, label] of [['changes', '--changes'], ['generator', '--generator'], ['constraints', '--constraints']]) {
        if (Object.prototype.hasOwnProperty.call(flags, flag) && !flags[flag]) {
            process.stderr.write(`Missing path after ${label}.\n`);
            printHelp(2);
            return;
        }
    }

    if (Object.prototype.hasOwnProperty.call(flags, 'time') && !flags.time) {
        process.stderr.write('Missing value after --time.\n');
        process.exitCode = 2;
        return;
    }

    if (flags.constraints && !flags.yes) {
        process.stderr.write('Runtime constraints execute JavaScript. Re-run with -y/--yes after reviewing the constraint source.\n');
        process.exitCode = 2;
        return;
    }

    if (!filePath) {
        process.stderr.write('Missing file path.\n');
        printHelp(2);
        return;
    }

    if (!(await confirmCustomValidation(flags))) {
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

    const projectMode = ['changes', 'generator', 'constraints', 'time', 'seed', 'maxEvents'].some((flag) => Object.prototype.hasOwnProperty.call(flags, flag));
    const time = flags.time === undefined ? null : parseSnapshotTime(flags.time);
    if (time && !time.ok) {
        process.stderr.write(`Invalid validation time: ${flags.time}\n`);
        process.exitCode = 2;
        return;
    }
    const seed = flags.seed === undefined ? 1 : Number(flags.seed);
    if (!Number.isSafeInteger(seed)) {
        process.stderr.write(`Invalid seed: ${flags.seed}. Expected a safe integer.\n`);
        process.exitCode = 2;
        return;
    }
    const maxEvents = parseMaxEvents(flags);
    if (!maxEvents.ok) {
        process.stderr.write(`Invalid --max-events value: ${flags.maxEvents}. Expected an integer.\n`);
        process.exitCode = 2;
        return;
    }

    let result;
    try {
        result = projectMode
            ? projectValidator.validateProject(parsed, {
                changesSource: readOptionalSource(flags.changes, 'Changes source'),
                generatorSource: readOptionalSource(flags.generator, 'Generator source'),
                constraintsSource: readOptionalSource(flags.constraints, 'constraint source'),
                seed,
                ...(maxEvents.value === undefined ? {} : { maxEvents: maxEvents.value }),
                ...(time ? { until: time.minutes } : {})
            })
            : validator.validate(parsed);
    } catch (error) {
        process.stderr.write(`Failed to validate project: ${error.message}\n`);
        process.exitCode = 2;
        return;
    }
    const builtinProblems = Array.isArray(result?.problems)
        ? result.problems.map((problem) => projectMode ? problem : ({
            ...problem,
            scope: problem.scope || 'document',
            provenance: { layer: 'document', source: 'start.workspec.json', ...(problem.provenance || {}), validation_mode: 'document' }
        }))
        : [];

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
        process.stdout.write(toPrettyJson({
            validation: {
                mode: projectMode ? 'project' : 'document',
                source: filePath,
                custom: Boolean(flags.custom)
            },
            run: projectMode ? runMetadata(result.run, { seed, requestedHorizon: time?.minutes, maxEvents: maxEvents.value }) : null,
            problems
        }));
    } else {
        const horizonLabel = projectMode
            ? (Number.isFinite(result?.horizon?.until)
                ? `requested through ${result.horizon.until} minutes; resolved through ${result.run?.resolvedThrough}`
                : `through natural end; resolved through ${result.run?.resolvedThrough}`)
            : 'not applicable';
        process.stdout.write(`Validation mode: ${projectMode ? 'project' : 'document'}${projectMode ? ` | seed: ${seed} | horizon: ${horizonLabel}` : ''}\n`);
        for (const problem of problems) {
            const severity = problem.severity || 'error';
            const metricId = problem.metric_id || 'system.error';
            const instance = problem.instance || '/';
            const detail = problem.detail || problem.title || metricId;
            const provenance = problem.scope || problem.provenance?.layer;
            const source = problem.provenance?.source;
            const provenanceLabel = provenance ? ` [${provenance}${source ? `:${source}` : ''}]` : '';
            process.stdout.write(`${filePath}:${instance} - ${severity}: ${detail} (${metricId})${provenanceLabel}\n`);
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

    process.exitCode = hasErrors(problems) || (flags.failOnWarning && hasWarnings(problems)) ? 1 : 0;
}

function parseSnapshotTime(value) {
    if (typeof value !== 'string' || !value) return { ok: false };
    if (/^-?(?:\d+\.?\d*|\.\d+)$/.test(value)) {
        const minutes = Number(value);
        return { ok: Number.isFinite(minutes), value: minutes, minutes };
    }
    if (value.startsWith('{')) {
        try {
            const parsed = JSON.parse(value);
            const result = runtime.parseTaskStart(parsed);
            return result.ok ? { ok: true, value: parsed, minutes: result.startMinutes } : { ok: false };
        } catch (_error) {
            return { ok: false };
        }
    }
    const result = runtime.parseTaskStart(value);
    return result.ok ? { ok: true, value, minutes: result.startMinutes } : { ok: false };
}

function readOptionalSource(sourcePath, label) {
    if (!sourcePath) return '';
    try {
        return fs.readFileSync(resolvePath(sourcePath), 'utf8');
    } catch (error) {
        throw new Error(`Failed to read ${label}: ${error.message}`);
    }
}

async function handleSnapshot(filePath, flags) {
    if (!filePath) {
        process.stderr.write('Missing Starting State file path.\n');
        printHelp(2);
        return;
    }
    if (!flags.time) {
        process.stderr.write('Missing --time <time>.\n');
        printHelp(2);
        return;
    }
    if (Object.prototype.hasOwnProperty.call(flags, 'changes') && !flags.changes) {
        process.stderr.write('Missing path after --changes.\n');
        printHelp(2);
        return;
    }
    if (Object.prototype.hasOwnProperty.call(flags, 'generator') && !flags.generator) {
        process.stderr.write('Missing path after --generator.\n');
        printHelp(2);
        return;
    }
    if (Object.prototype.hasOwnProperty.call(flags, 'seed') && !flags.seed) {
        process.stderr.write('Missing value after --seed.\n');
        printHelp(2);
        return;
    }

    const time = parseSnapshotTime(flags.time);
    if (!time.ok) {
        process.stderr.write(`Invalid snapshot time: ${flags.time}\n`);
        process.exitCode = 2;
        return;
    }
    const seed = flags.seed === undefined ? 1 : Number(flags.seed);
    if (!Number.isSafeInteger(seed)) {
        process.stderr.write(`Invalid seed: ${flags.seed}. Expected a safe integer.\n`);
        process.exitCode = 2;
        return;
    }
    const maxEvents = parseMaxEvents(flags);
    if (!maxEvents.ok) {
        process.stderr.write(`Invalid --max-events value: ${flags.maxEvents}. Expected an integer.\n`);
        process.exitCode = 2;
        return;
    }

    let documentValue;
    let changesSource;
    let generatorSource;
    try {
        documentValue = JSON.parse(await readInput(filePath));
        changesSource = readOptionalSource(flags.changes, 'Changes source');
        generatorSource = readOptionalSource(flags.generator, 'Generator source');
    } catch (error) {
        process.stderr.write(`Failed to read project: ${error.message}\n`);
        process.exitCode = 2;
        return;
    }

    const run = runtime.runProject(documentValue, changesSource, generatorSource, {
        seed,
        until: time.minutes,
        ...(maxEvents.value === undefined ? {} : { maxEvents: maxEvents.value })
    });
    let state = null;
    let problems = [...run.problems];
    try {
        const snapshot = runtime.snapshotRunAt(run, time.value);
        ({ problems = [], ...state } = snapshot);
    } catch (error) {
        problems.push({
            type: 'https://universalautomation.wiki/workspec/errors/snapshot.time.unresolved',
            title: 'snapshot time unresolved',
            severity: 'error',
            detail: error.message,
            instance: '/snapshot/time',
            metric_id: 'snapshot.time.unresolved',
            scope: 'runtime',
            provenance: { layer: 'runtime', source: 'resolved-history' },
            context: { requested_time: time.minutes, resolved_through: run.resolvedThrough },
            suggestions: ['Use a time at or before resolved_through, or raise --max-events for a trusted project.']
        });
    }
    const output = {
        time: flags.time,
        time_minutes: time.minutes,
        seed,
        run: runMetadata(run, { seed, requestedHorizon: time.minutes, maxEvents: maxEvents.value }),
        state,
        problems
    };

    if (flags.json) {
        process.stdout.write(toPrettyJson(output));
    } else {
        const objectCount = Object.keys(state?.objects || {}).length;
        const errorCount = problems.filter((entry) => entry?.severity === 'error').length;
        process.stdout.write(`Snapshot ${flags.time} (seed ${seed}, resolved through ${run.resolvedThrough}): ${objectCount} objects, ${problems.length} problems (${errorCount} errors)\n`);
    }
    process.exitCode = hasErrors(problems) ? 1 : 0;
}

async function handleConstraints(filePath, flags) {
    if (!filePath || !flags.constraints) {
        process.stderr.write(!filePath ? 'Missing Starting State file path.\n' : 'Missing --constraints <path>.\n');
        printHelp(2);
        return;
    }
    if (!flags.yes) {
        process.stderr.write('Runtime constraints execute JavaScript. Re-run with -y/--yes after reviewing the constraint source.\n');
        process.exitCode = 2;
        return;
    }
    if (Object.prototype.hasOwnProperty.call(flags, 'time') && !flags.time) {
        process.stderr.write('Missing value after --time.\n');
        process.exitCode = 2;
        return;
    }
    const time = flags.time === undefined ? null : parseSnapshotTime(flags.time);
    if (time && !time.ok) {
        process.stderr.write(`Invalid constraint time: ${flags.time}\n`);
        process.exitCode = 2;
        return;
    }
    const seed = flags.seed === undefined ? 1 : Number(flags.seed);
    if (!Number.isSafeInteger(seed)) {
        process.stderr.write(`Invalid seed: ${flags.seed}. Expected a safe integer.\n`);
        process.exitCode = 2;
        return;
    }
    const maxEvents = parseMaxEvents(flags);
    if (!maxEvents.ok) {
        process.stderr.write(`Invalid --max-events value: ${flags.maxEvents}. Expected an integer.\n`);
        process.exitCode = 2;
        return;
    }

    let documentValue;
    let changesSource;
    let generatorSource;
    let constraintSource;
    try {
        documentValue = JSON.parse(await readInput(filePath));
        changesSource = readOptionalSource(flags.changes, 'Changes source');
        generatorSource = readOptionalSource(flags.generator, 'Generator source');
        constraintSource = readOptionalSource(flags.constraints, 'constraint source');
    } catch (error) {
        process.stderr.write(`Failed to read project: ${error.message}\n`);
        process.exitCode = 2;
        return;
    }

    const result = projectValidator.validateProject(documentValue, {
        changesSource,
        generatorSource,
        constraintsSource: constraintSource,
        seed,
        ...(maxEvents.value === undefined ? {} : { maxEvents: maxEvents.value }),
        ...(time ? { until: time.minutes } : {})
    });
    const constraintProblems = result.problems.filter((problem) => !problem.violation);
    const output = {
        time: result.time,
        seed,
        run: runMetadata(result.run, { seed, requestedHorizon: time?.minutes, maxEvents: maxEvents.value }),
        violations: result.violations,
        problems: constraintProblems
    };
    if (flags.json) process.stdout.write(toPrettyJson(output));
    else {
        const errors = result.violations.filter((entry) => entry.severity === 'error').length;
        process.stdout.write(`Runtime constraints at ${output.time} (resolved through ${result.run?.resolvedThrough}): ${result.violations.length} violations (${errors} errors), ${constraintProblems.length} validation problems\n`);
    }
    process.exitCode = hasErrors(constraintProblems) || result.violations.some((entry) => entry.severity === 'error') ? 1 : 0;
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
        case 'snapshot':
            await handleSnapshot(positionals[0], flags);
            return;
        case 'constraints':
            await handleConstraints(positionals[0], flags);
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

if (require.main === module) {
    main().catch((error) => {
        process.stderr.write(`Unexpected error: ${error && error.message ? error.message : String(error)}\n`);
        process.exitCode = 1;
    });
}

module.exports = { parseArgs, printHelp, handleValidate, handleSnapshot, handleConstraints, handleMigrate, handleFormat, main, hasErrors, hasWarnings };
