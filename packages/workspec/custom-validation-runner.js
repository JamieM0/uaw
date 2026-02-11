'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const WORKSPEC_NAMESPACE = 'https://universalautomation.wiki/workspec';
const EXECUTION_TIMEOUT_MS = 5000;
const FUNCTION_NAME_RE = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

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

function resolvePath(inputPath) {
    if (!inputPath) return '';
    if (path.isAbsolute(inputPath)) return inputPath;
    return path.resolve(process.cwd(), inputPath);
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
            if (name && /^validate[A-Za-z0-9_$]*/.test(name)) {
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
    const resolvedExplicit = resolvePath(explicitCatalogPath);
    if (resolvedExplicit) {
        const raw = fs.readFileSync(resolvedExplicit, 'utf8');
        return parseCatalog(raw, resolvedExplicit);
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

function runBrowserStyleValidation(sourceCode, metrics, helpers, customValidatorPath, problems) {
    const sandbox = {
        simulation: helpers.simulation,
        addResult: helpers.addResult,
        addProblem: helpers.addProblem,
        _timeToMinutes: helpers._timeToMinutes,
        console: {
            log: (...args) => console.log('[workspec custom]', ...args),
            warn: (...args) => console.warn('[workspec custom]', ...args),
            error: (...args) => console.error('[workspec custom]', ...args)
        },
        require: undefined,
        process: undefined,
        module: undefined,
        exports: undefined,
        Buffer: undefined
    };

    const thisArg = {
        simulation: helpers.simulation,
        addResult: helpers.addResult,
        addProblem: helpers.addProblem,
        _timeToMinutes: helpers._timeToMinutes
    };

    const context = vm.createContext(sandbox);
    const script = new vm.Script(sourceCode, { filename: customValidatorPath });
    script.runInContext(context, { timeout: EXECUTION_TIMEOUT_MS });

    for (const metric of metrics) {
        const functionName = safeTrim(metric.functionName);
        if (!FUNCTION_NAME_RE.test(functionName)) {
            problems.push(buildProblem(
                metric.id || 'custom.validation.function_name',
                'error',
                'Invalid Custom Function Name',
                `Invalid custom validation function name '${functionName}'.`,
                '/simulation'
            ));
            continue;
        }

        context.__metric = {
            id: metric.id || metricIdFromFunctionName(functionName),
            params: isPlainObject(metric.params) ? metric.params : {}
        };
        context.__thisArg = thisArg;

        const invocation = new vm.Script(
            `(typeof ${functionName} === 'function') ? ${functionName}.call(__thisArg, __metric) : "__MISSING_FUNCTION__"`
        );

        const result = invocation.runInContext(context, { timeout: EXECUTION_TIMEOUT_MS });
        if (result === '__MISSING_FUNCTION__') {
            problems.push(buildProblem(
                context.__metric.id,
                'error',
                'Missing Custom Validation Function',
                `Function '${functionName}' was not found in custom validation code.`,
                '/simulation',
                { function: functionName, metric_id: context.__metric.id }
            ));
        } else {
            problems.push(...normalizeProblems(result, context.__metric.id));
        }
    }
}

async function runCustomValidation(documentValue, options = {}) {
    const customValidatorPath = resolvePath(options.customValidatorPath || options.path || options.customPath);
    const customCatalogPath = resolvePath(options.customCatalogPath || options.catalogPath);

    if (!customValidatorPath) {
        throw new Error('Missing custom validator path.');
    }

    let sourceCode;
    try {
        sourceCode = fs.readFileSync(customValidatorPath, 'utf8');
    } catch (error) {
        throw new Error(`Failed to read custom validator file (${customValidatorPath}): ${error.message}`);
    }

    const problems = [];
    const helpers = createHelpers(documentValue, problems);

    let exported = null;
    let exportedLoaded = false;
    try {
        const resolved = require.resolve(customValidatorPath);
        delete require.cache[resolved];
        exported = require(resolved);
        exportedLoaded = true;
    } catch (_error) {
        exportedLoaded = false;
    }

    if (exportedLoaded) {
        const handled = await runExportedValidation(exported, helpers, problems);
        if (handled) {
            return problems;
        }
    }

    let metrics = loadMetricsCatalog(customValidatorPath, customCatalogPath);
    if (metrics.length === 0) {
        metrics = discoverValidationFunctions(sourceCode).map((functionName) => ({
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
        runBrowserStyleValidation(sourceCode, metrics, helpers, customValidatorPath, problems);
    } catch (error) {
        throw new Error(`Custom validation execution failed (${customValidatorPath}): ${error.message}`);
    }

    return problems;
}

module.exports = {
    runCustomValidation
};
