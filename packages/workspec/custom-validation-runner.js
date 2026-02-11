'use strict';

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const WORKSPEC_NAMESPACE = 'https://universalautomation.wiki/workspec';
const EXECUTION_TIMEOUT_MS = 5000;
const SUBPROCESS_GRACE_MS = 1000;
const MAX_SUBPROCESS_OUTPUT_BYTES = 1024 * 1024;
const FUNCTION_NAME_RE = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
const ALLOWED_VALIDATE_FUNCTION_RE = /^validate[A-Za-z0-9_$]*$/;
const VALIDATOR_EXTENSIONS = new Set(['.js', '.cjs']);
const CATALOG_EXTENSIONS = new Set(['.json']);

function isPlainObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function ensureString(value) {
    return (typeof value === 'string') ? value : '';
}

function safeTrim(value) {
    return ensureString(value).trim();
}

function mapSeverity(value) {
    const raw = safeTrim(value).toLowerCase();
    if (raw === 'error' || raw === 'warning' || raw === 'info') return raw;
    if (raw === 'suggestion') return 'info';
    if (raw === 'success') return null;
    return 'error';
}

function buildProblem(metricId, severity, title, detail, instance, context, suggestions, docUri) {
    const safeMetricId = safeTrim(metricId) || 'custom.validation.error';
    const safeSeverity = (severity === 'warning' || severity === 'info') ? severity : 'error';
    const safeTitle = safeTrim(title) || 'Custom Validation';
    const safeDetail = safeTrim(detail) || safeTitle;
    const safeInstance = safeTrim(instance) || '/simulation';
    const safeContext = isPlainObject(context) ? context : {};
    const safeSuggestions = Array.isArray(suggestions)
        ? suggestions.filter((s) => typeof s === 'string' && s.trim()).map((s) => s.trim())
        : [];

    const result = {
        type: `${WORKSPEC_NAMESPACE}/errors/${safeMetricId}`,
        title: safeTitle,
        severity: safeSeverity,
        detail: safeDetail,
        instance: safeInstance,
        metric_id: safeMetricId,
        context: safeContext,
        suggestions: safeSuggestions
    };

    if (safeTrim(docUri)) {
        result.doc_uri = safeTrim(docUri);
    }

    return result;
}

function normalizeProblem(result, fallbackMetricId) {
    if (result === null || result === undefined) return null;

    if (typeof result === 'string' || typeof result === 'number' || typeof result === 'boolean') {
        return buildProblem(
            fallbackMetricId || 'custom.validation.result',
            'error',
            'Custom Validation Result',
            String(result),
            '/simulation'
        );
    }

    if (!isPlainObject(result)) {
        return buildProblem(
            fallbackMetricId || 'custom.validation.result',
            'error',
            'Custom Validation Result',
            `Unsupported custom validation result type: ${typeof result}`,
            '/simulation'
        );
    }

    const metricId = safeTrim(result.metric_id || result.metricId || fallbackMetricId || 'custom.validation.result');
    const severity = mapSeverity(result.severity || result.status);
    if (!severity) return null;

    const detail = safeTrim(result.detail || result.message || result.title || metricId);
    const title = safeTrim(result.title) || 'Custom Validation';
    const instance = safeTrim(result.instance) || '/simulation';
    const context = isPlainObject(result.context) ? result.context : {};
    const suggestions = Array.isArray(result.suggestions) ? result.suggestions : [];
    const docUri = safeTrim(result.doc_uri || result.docUri);
    const type = safeTrim(result.type);

    const normalized = buildProblem(
        metricId,
        severity,
        title,
        detail,
        instance,
        context,
        suggestions,
        docUri
    );

    if (type) {
        normalized.type = type;
    }

    return normalized;
}

function normalizeProblems(value, fallbackMetricId) {
    if (value === null || value === undefined) return [];

    if (Array.isArray(value)) {
        return value
            .map((entry) => normalizeProblem(entry, fallbackMetricId))
            .filter(Boolean);
    }

    if (isPlainObject(value) && Array.isArray(value.problems)) {
        return normalizeProblems(value.problems, fallbackMetricId);
    }

    if (isPlainObject(value) && Array.isArray(value.results)) {
        return normalizeProblems(value.results, fallbackMetricId);
    }

    const single = normalizeProblem(value, fallbackMetricId);
    return single ? [single] : [];
}

function getSimulation(documentValue) {
    if (!isPlainObject(documentValue)) return {};
    return isPlainObject(documentValue.simulation) ? documentValue.simulation : documentValue;
}

function timeToMinutes(timeStr) {
    if (typeof timeStr !== 'string') return null;
    const trimmed = timeStr.trim();
    if (!/^\d{2}:\d{2}$/.test(trimmed)) return null;
    const [hours, minutes] = trimmed.split(':').map(Number);
    if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return null;
    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
    return (hours * 60) + minutes;
}

function unwrapDefaultExport(value) {
    if (value && typeof value === 'object' && value.default) return value.default;
    return value;
}

function discoverValidationFunctions(sourceCode) {
    const names = new Set();
    const patterns = [
        /\bfunction\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*\(/g,
        /\b(?:const|let|var)\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*=\s*(?:async\s*)?function\b/g,
        /\b(?:const|let|var)\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>/g
    ];

    for (const re of patterns) {
        let match;
        while ((match = re.exec(sourceCode)) !== null) {
            const name = safeTrim(match[1]);
            if (name && ALLOWED_VALIDATE_FUNCTION_RE.test(name)) {
                names.add(name);
            }
        }
    }

    return [...names];
}

function metricIdFromFunctionName(functionName) {
    const trimmed = safeTrim(functionName);
    if (!trimmed) return 'custom.validation.metric';
    const lowered = trimmed.replace(/^validate/, '');
    const metricStem = lowered
        .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
        .replace(/[^A-Za-z0-9_]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .toLowerCase();
    return metricStem ? `custom.${metricStem}` : `custom.${trimmed.toLowerCase()}`;
}

function parseCatalog(catalogRawText, catalogPath) {
    let parsed;
    try {
        parsed = JSON.parse(catalogRawText);
    } catch (error) {
        throw new Error(`Failed to parse custom metrics catalog (${catalogPath}): ${error.message}`);
    }

    if (!Array.isArray(parsed)) {
        throw new Error(`Custom metrics catalog must be an array (${catalogPath}).`);
    }

    return parsed
        .filter((item) => isPlainObject(item) && !Object.prototype.hasOwnProperty.call(item, 'disabled_metrics'))
        .map((item) => {
            const functionName = safeTrim(item.function || item.computation?.function_name);
            const metricId = safeTrim(item.id);
            return {
                id: metricId || metricIdFromFunctionName(functionName),
                functionName,
                params: isPlainObject(item.params) ? item.params : {}
            };
        })
        .filter((entry) => entry.functionName);
}

function loadMetricsCatalog(customValidatorPath, explicitCatalogPath) {
    if (explicitCatalogPath) {
        const raw = fs.readFileSync(explicitCatalogPath, 'utf8');
        return parseCatalog(raw, explicitCatalogPath);
    }

    const sidecarPath = path.join(path.dirname(customValidatorPath), 'metrics-catalog-custom.json');
    if (!fs.existsSync(sidecarPath)) return [];
    const raw = fs.readFileSync(sidecarPath, 'utf8');
    return parseCatalog(raw, sidecarPath);
}

function createHelpers(documentValue, problems) {
    const simulation = getSimulation(documentValue);
    return {
        document: documentValue,
        simulation,
        _timeToMinutes: timeToMinutes,
        buildProblem,
        addProblem(problem) {
            const normalized = normalizeProblems(problem, 'custom.validation.result');
            problems.push(...normalized);
        },
        addResult(result) {
            const normalized = normalizeProblems(result, 'custom.validation.result');
            problems.push(...normalized);
        }
    };
}

async function runExportedValidation(exportedValue, helpers, problems) {
    const exported = unwrapDefaultExport(exportedValue);
    let handled = false;

    async function invoke(fn, args, metricId) {
        handled = true;
        const output = await fn.apply(helpers, args);
        problems.push(...normalizeProblems(output, metricId));
    }

    if (typeof exported === 'function') {
        await invoke(exported, [helpers.document, helpers], 'custom.validation.exported');
    } else if (isPlainObject(exported)) {
        if (typeof exported.validate === 'function') {
            await invoke(exported.validate, [helpers.document, helpers], 'custom.validation.exported');
        }

        if (Array.isArray(exported.constraints)) {
            for (let i = 0; i < exported.constraints.length; i += 1) {
                const fn = exported.constraints[i];
                if (typeof fn === 'function') {
                    await invoke(fn, [helpers.document, helpers], `custom.constraint.${i + 1}`);
                }
            }
        }

        if (Array.isArray(exported.validators)) {
            for (let i = 0; i < exported.validators.length; i += 1) {
                const fn = exported.validators[i];
                if (typeof fn === 'function') {
                    await invoke(fn, [helpers.document, helpers], `custom.validator.${i + 1}`);
                }
            }
        }
    }

    return handled;
}

function buildInstrumentedSource(sourceCode, captureFunctionNames) {
    const lines = [
        '"use strict";',
        'const __workspecModule = { exports: {} };',
        'const __workspecExports = __workspecModule.exports;',
        'const __workspecConsole = { log: () => {}, warn: () => {}, error: () => {} };',
        'const __workspecRuntime = (function(require, process, Buffer, global, globalThis, module, exports, console) {',
        '    "use strict";'
    ];

    lines.push(sourceCode);

    lines.push('    return {');
    lines.push('        exported: module.exports,');
    lines.push('        functions: {');

    if (captureFunctionNames.length > 0) {
        captureFunctionNames.forEach((functionName, index) => {
            const trailing = (index === captureFunctionNames.length - 1) ? '' : ',';
            lines.push(`            ${JSON.stringify(functionName)}: (typeof ${functionName} === "function" ? ${functionName} : undefined)${trailing}`);
        });
    }

    lines.push('        }');
    lines.push('    };');
    lines.push('})(undefined, undefined, undefined, undefined, undefined, __workspecModule, __workspecExports, __workspecConsole);');
    lines.push('module.exports = {');
    lines.push('    __workspec_exported: __workspecRuntime.exported,');
    lines.push('    __workspec_functions: __workspecRuntime.functions');
    lines.push('};');

    return lines.join('\n');
}

function loadInstrumentedValidator(sourceCode, captureFunctionNames) {
    const instrumentedSource = buildInstrumentedSource(sourceCode, captureFunctionNames);
    const loader = new Function('module', 'exports', instrumentedSource); // eslint-disable-line no-new-func
    const localModule = { exports: {} };
    loader(localModule, localModule.exports);

    const payload = isPlainObject(localModule.exports) ? localModule.exports : {};
    const exported = payload.__workspec_exported;
    const functionMap = isPlainObject(payload.__workspec_functions) ? payload.__workspec_functions : {};

    return {
        exported,
        functionMap
    };
}

async function runAllowlistedValidation(functionMap, metrics, discoveredFunctions, helpers, problems) {
    const allowedFunctions = new Set(discoveredFunctions);
    const thisArg = {
        simulation: helpers.simulation,
        addResult: helpers.addResult,
        addProblem: helpers.addProblem,
        _timeToMinutes: helpers._timeToMinutes
    };

    for (const metric of metrics) {
        const functionName = safeTrim(metric.functionName);
        if (!FUNCTION_NAME_RE.test(functionName) || !ALLOWED_VALIDATE_FUNCTION_RE.test(functionName)) {
            problems.push(buildProblem(
                metric.id || 'custom.validation.function_name',
                'error',
                'Invalid Custom Function Name',
                `Invalid custom validation function name '${functionName}'.`,
                '/simulation'
            ));
            continue;
        }

        if (!allowedFunctions.has(functionName)) {
            problems.push(buildProblem(
                metric.id || metricIdFromFunctionName(functionName),
                'error',
                'Disallowed Custom Validation Function',
                `Function '${functionName}' is not in the allowlisted validate* entry points.`,
                '/simulation',
                { function: functionName, metric_id: metric.id || metricIdFromFunctionName(functionName) }
            ));
            continue;
        }

        const fn = functionMap[functionName];
        const metricPayload = {
            id: metric.id || metricIdFromFunctionName(functionName),
            params: isPlainObject(metric.params) ? metric.params : {}
        };

        if (typeof fn !== 'function') {
            problems.push(buildProblem(
                metricPayload.id,
                'error',
                'Missing Custom Validation Function',
                `Function '${functionName}' was not found in custom validation code.`,
                '/simulation',
                { function: functionName, metric_id: metricPayload.id }
            ));
            continue;
        }

        const result = await fn.call(thisArg, metricPayload);
        problems.push(...normalizeProblems(result, metricPayload.id));
    }
}

function withTrailingSeparator(value) {
    return value.endsWith(path.sep) ? value : `${value}${path.sep}`;
}

function isPathInside(candidate, parent) {
    if (candidate === parent) return true;
    return candidate.startsWith(withTrailingSeparator(parent));
}

function hasRelativeTraversal(inputPath) {
    const normalized = path.normalize(inputPath);
    if (normalized === '..') return true;
    return normalized.startsWith(`..${path.sep}`) || normalized.includes(`${path.sep}..${path.sep}`);
}

function resolveAndValidateFilePath(inputPath, label, allowedExtensions) {
    const trimmed = safeTrim(inputPath);
    if (!trimmed) return '';

    if (trimmed.includes('\0')) {
        throw new Error(`${label} contains unsupported null bytes.`);
    }

    const isAbsolute = path.isAbsolute(trimmed);
    if (!isAbsolute && hasRelativeTraversal(trimmed)) {
        throw new Error(`${label} contains path traversal segments: '${trimmed}'.`);
    }

    const resolvedPath = isAbsolute
        ? path.resolve(trimmed)
        : path.resolve(process.cwd(), trimmed);

    let stats;
    try {
        stats = fs.statSync(resolvedPath);
    } catch (error) {
        throw new Error(`Failed to read ${label} (${resolvedPath}): ${error.message}`);
    }

    if (!stats.isFile()) {
        throw new Error(`${label} must reference a file: ${resolvedPath}`);
    }

    let realPath;
    try {
        realPath = fs.realpathSync(resolvedPath);
    } catch (error) {
        throw new Error(`Failed to resolve ${label} (${resolvedPath}): ${error.message}`);
    }

    if (!isAbsolute) {
        const cwdReal = fs.realpathSync(process.cwd());
        if (!isPathInside(realPath, cwdReal)) {
            throw new Error(`${label} resolves outside the current working directory: '${trimmed}'.`);
        }
    }

    const extension = path.extname(realPath).toLowerCase();
    if (!allowedExtensions.has(extension)) {
        throw new Error(`${label} must use one of: ${[...allowedExtensions].join(', ')}.`);
    }

    return realPath;
}

function resolveExecutionOptions(options = {}) {
    const customValidatorPath = resolveAndValidateFilePath(
        options.customValidatorPath || options.path || options.customPath,
        'Custom validator path',
        VALIDATOR_EXTENSIONS
    );

    const customCatalogPath = resolveAndValidateFilePath(
        options.customCatalogPath || options.catalogPath,
        'Custom catalog path',
        CATALOG_EXTENSIONS
    );

    if (!customValidatorPath) {
        throw new Error('Missing custom validator path.');
    }

    return {
        customValidatorPath,
        customCatalogPath
    };
}

async function runCustomValidationInProcess(documentValue, options = {}) {
    const { customValidatorPath, customCatalogPath } = resolveExecutionOptions(options);

    let sourceCode;
    try {
        sourceCode = fs.readFileSync(customValidatorPath, 'utf8');
    } catch (error) {
        throw new Error(`Failed to read custom validator file (${customValidatorPath}): ${error.message}`);
    }

    const discoveredFunctions = discoverValidationFunctions(sourceCode);
    const candidateCaptureNames = [...new Set(discoveredFunctions)];

    let instrumented;
    try {
        instrumented = loadInstrumentedValidator(sourceCode, candidateCaptureNames);
    } catch (error) {
        throw new Error(`Failed to evaluate custom validator (${customValidatorPath}): ${error.message}`);
    }

    const problems = [];
    const helpers = createHelpers(documentValue, problems);

    const handled = await runExportedValidation(instrumented.exported, helpers, problems);
    if (handled) {
        return problems;
    }

    let metrics = loadMetricsCatalog(customValidatorPath, customCatalogPath);
    if (metrics.length === 0) {
        metrics = discoveredFunctions.map((functionName) => ({
            id: metricIdFromFunctionName(functionName),
            functionName,
            params: {}
        }));
    }

    if (metrics.length === 0) {
        throw new Error(
            `No custom validation entry points found in ${customValidatorPath}. ` +
            'Export a validate() function, or declare validate* functions in the file.'
        );
    }

    try {
        await runAllowlistedValidation(
            instrumented.functionMap,
            metrics,
            discoveredFunctions,
            helpers,
            problems
        );
    } catch (error) {
        throw new Error(`Custom validation execution failed (${customValidatorPath}): ${error.message}`);
    }

    return problems;
}

function runCustomValidationSubprocess(payload, timeoutMs) {
    return new Promise((resolve, reject) => {
        const workerPath = path.join(__dirname, 'custom-validation-worker.js');
        const child = spawn(process.execPath, [workerPath], {
            cwd: process.cwd(),
            stdio: ['pipe', 'pipe', 'pipe'],
            env: {
                PATH: process.env.PATH || '',
                NODE_ENV: 'production',
                NODE_OPTIONS: ''
            }
        });

        let stdout = '';
        let stderr = '';
        let stdoutBytes = 0;
        let stderrBytes = 0;
        let settled = false;

        function fail(error) {
            if (settled) return;
            settled = true;
            reject(error);
        }

        const timer = setTimeout(() => {
            if (settled) return;
            settled = true;
            child.kill('SIGKILL');
            reject(new Error(`Custom validation timed out after ${timeoutMs}ms.`));
        }, timeoutMs + SUBPROCESS_GRACE_MS);

        child.on('error', (error) => {
            clearTimeout(timer);
            fail(new Error(`Failed to start custom validation worker: ${error.message}`));
        });

        child.stdout.on('data', (chunk) => {
            if (settled) return;
            stdoutBytes += chunk.length;
            if (stdoutBytes > MAX_SUBPROCESS_OUTPUT_BYTES) {
                child.kill('SIGKILL');
                clearTimeout(timer);
                fail(new Error('Custom validation worker output exceeded the allowed limit.'));
                return;
            }
            stdout += chunk.toString('utf8');
        });

        child.stderr.on('data', (chunk) => {
            if (settled) return;
            stderrBytes += chunk.length;
            if (stderrBytes > MAX_SUBPROCESS_OUTPUT_BYTES) {
                child.kill('SIGKILL');
                clearTimeout(timer);
                fail(new Error('Custom validation worker error output exceeded the allowed limit.'));
                return;
            }
            stderr += chunk.toString('utf8');
        });

        child.on('close', (code, signal) => {
            clearTimeout(timer);
            if (settled) return;

            if (signal && signal !== 'SIGTERM') {
                fail(new Error(`Custom validation worker exited with signal ${signal}.`));
                return;
            }

            let parsed;
            try {
                parsed = JSON.parse(stdout || '{}');
            } catch (error) {
                const details = stderr.trim() || `Invalid worker output: ${error.message}`;
                fail(new Error(`Custom validation worker returned unreadable output. ${details}`));
                return;
            }

            if (code !== 0 || !parsed.ok) {
                const message = safeTrim(parsed.error) || safeTrim(stderr) || `Worker exited with code ${code}.`;
                fail(new Error(message));
                return;
            }

            if (!Array.isArray(parsed.problems)) {
                fail(new Error('Custom validation worker returned an invalid payload.'));
                return;
            }

            settled = true;
            resolve(parsed.problems);
        });

        child.stdin.on('error', (error) => {
            clearTimeout(timer);
            fail(new Error(`Failed to send input to custom validation worker: ${error.message}`));
        });

        child.stdin.end(JSON.stringify(payload));
    });
}

async function runCustomValidation(documentValue, options = {}) {
    const executionOptions = resolveExecutionOptions(options);
    return runCustomValidationSubprocess(
        {
            documentValue,
            options: executionOptions
        },
        EXECUTION_TIMEOUT_MS
    );
}

module.exports = {
    runCustomValidation,
    runCustomValidationInProcess
};
