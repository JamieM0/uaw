// WorkSpec v2.0 Validator (RFC 7807 Problem Details)
// Universal Automation Wiki
//
// Single-source validator intended to run in both:
// - Browser (UAW Playground) via `window.WorkSpecValidator`
// - Node.js (CLI / npm package) via `require()`
//
// NOTE: This validator is intentionally dependency-free.

(function() {
    'use strict';

    const WORKSPEC_NAMESPACE = 'https://universalautomation.wiki/workspec';
    const SUPPORTED_SCHEMA_VERSIONS = Object.freeze(['2.0']);

    const BUILTIN_TYPES = Object.freeze([
        'actor',
        'equipment',
        'resource',
        'product',
        'service',
        'display',
        'screen_element',
        'digital_object'
    ]);

    const DISALLOWED_TYPE_ALIASES = Object.freeze({
        material: 'resource',
        ingredient: 'resource',
        tool: 'equipment'
    });

    const RESERVED_TYPE_NAMES = Object.freeze([
        'timeline_actors',
        'any',
        'unknown'
    ]);

    const PLAIN_ID_RE = /^[a-z][a-z0-9_]{0,249}$/;
    const OBJECT_ID_RE = /^[a-z][a-z0-9_]*:[a-z][a-z0-9_]{0,249}$/;
    const TIME_HHMM_RE = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;
    const TIME_HHMMSS_RE = /^([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/;
    const ISO_DURATION_RE = /^P(?!$)(?:\d+Y)?(?:\d+M)?(?:\d+D)?(?:T(?:\d+H)?(?:\d+M)?(?:\d+S)?)?$/i;
    const SHORTHAND_DURATION_RE = /^([0-9]+(?:\.[0-9]+)?)([smhdwWM])$/;

    function isPlainObject(value) {
        return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
    }

    function ensureString(value) {
        return (typeof value === 'string') ? value : '';
    }

    function safeTrim(value) {
        return ensureString(value).trim();
    }

    function toJsonPointer(parts) {
        if (!Array.isArray(parts)) return '';
        return parts
            .map((part) => String(part).replace(/~/g, '~0').replace(/\//g, '~1'))
            .join('/')
            .replace(/^/, '/');
    }

    function buildProblem(metricId, severity, title, detail, instance, context, suggestions, docUri) {
        const safeMetricId = safeTrim(metricId) || 'system.error';
        const safeSeverity = (severity === 'warning' || severity === 'info') ? severity : 'error';
        const safeTitle = safeTrim(title) || safeMetricId;
        const safeDetail = safeTrim(detail) || safeTitle;
        const safeInstance = safeTrim(instance) || '/';
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

    function getSimFromDocument(documentValue) {
        if (!isPlainObject(documentValue)) return null;
        if (isPlainObject(documentValue.simulation)) return documentValue.simulation;

        // Support legacy "flat" root with simulation fields (playground convenience).
        if (isPlainObject(documentValue.meta) || isPlainObject(documentValue.config) || Array.isArray(documentValue.tasks) || Array.isArray(documentValue.objects)) {
            return documentValue;
        }

        return null;
    }

    function normalizeTimeUnit(rawValue) {
        const value = safeTrim(rawValue).toLowerCase();
        if (value === 'seconds') return 'seconds';
        if (value === 'minutes') return 'minutes';
        if (value === 'hours') return 'hours';
        return '';
    }

    function durationToMinutesByUnit(amount, timeUnit) {
        if (typeof amount !== 'number' || !Number.isFinite(amount)) return null;
        if (timeUnit === 'seconds') return amount / 60;
        if (timeUnit === 'minutes') return amount;
        if (timeUnit === 'hours') return amount * 60;
        return null;
    }

    function parseIso8601DurationToMinutes(value) {
        if (typeof value !== 'string' || !ISO_DURATION_RE.test(value)) return null;
        const upper = value.toUpperCase();

        // Very small ISO8601 subset parser (PnYnMnDTnHnMnS)
        // WorkSpec v2 only requires common cases (PT30M, PT1H, P2D, etc.)
        const match = upper.match(/^P(?:(\d+)Y)?(?:(\d+)M)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/);
        if (!match) return null;

        const years = match[1] ? Number(match[1]) : 0;
        const months = match[2] ? Number(match[2]) : 0;
        const days = match[3] ? Number(match[3]) : 0;
        const hours = match[4] ? Number(match[4]) : 0;
        const minutes = match[5] ? Number(match[5]) : 0;
        const seconds = match[6] ? Number(match[6]) : 0;

        if (![years, months, days, hours, minutes, seconds].every((n) => Number.isFinite(n) && n >= 0)) return null;

        // Approximation for calendar units: 1 month = 30 days, 1 year = 365 days
        const totalMinutes = (years * 365 * 24 * 60)
            + (months * 30 * 24 * 60)
            + (days * 24 * 60)
            + (hours * 60)
            + minutes
            + (seconds / 60);

        return totalMinutes;
    }

    function parseShorthandDurationToMinutes(value) {
        if (typeof value !== 'string') return null;
        const match = value.match(SHORTHAND_DURATION_RE);
        if (!match) return null;

        const amount = Number(match[1]);
        const unit = match[2];

        if (!Number.isFinite(amount) || amount <= 0) return null;

        switch (unit) {
            case 's':
                return amount / 60;
            case 'm':
                return amount;
            case 'h':
                return amount * 60;
            case 'd':
                return amount * 24 * 60;
            case 'w':
            case 'W':
                return amount * 7 * 24 * 60;
            case 'M':
                return amount * 30 * 24 * 60;
            default:
                return null;
        }
    }

    function parseDurationToMinutes(value, timeUnit) {
        if (typeof value === 'number') {
            if (!Number.isFinite(value)) return { ok: false, minutes: null, kind: 'number' };
            if (!Number.isInteger(value)) return { ok: false, minutes: null, kind: 'number' };
            if (value <= 0) return { ok: false, minutes: null, kind: 'number' };

            const minutes = durationToMinutesByUnit(value, timeUnit);
            if (minutes === null) return { ok: false, minutes: null, kind: 'number' };
            return { ok: true, minutes, kind: 'number' };
        }

        if (typeof value === 'string') {
            const trimmed = value.trim();
            if (!trimmed) return { ok: false, minutes: null, kind: 'string' };

            const iso = parseIso8601DurationToMinutes(trimmed);
            if (iso !== null) return { ok: true, minutes: iso, kind: 'iso8601' };

            const shorthand = parseShorthandDurationToMinutes(trimmed);
            if (shorthand !== null) return { ok: true, minutes: shorthand, kind: 'shorthand' };

            return { ok: false, minutes: null, kind: 'string' };
        }

        return { ok: false, minutes: null, kind: typeof value };
    }

    function parseStrictTimeStringToMinutes(value) {
        if (typeof value !== 'string') return { ok: false, minutes: null, kind: 'non-string' };
        const trimmed = value.trim();
        if (TIME_HHMM_RE.test(trimmed)) {
            const [h, m] = trimmed.split(':').map(Number);
            return { ok: true, minutes: (h * 60) + m, kind: 'hhmm' };
        }
        if (TIME_HHMMSS_RE.test(trimmed)) {
            const [h, m, s] = trimmed.split(':').map(Number);
            return { ok: true, minutes: (h * 60) + m + (s / 60), kind: 'hhmmss' };
        }
        return { ok: false, minutes: null, kind: 'invalid' };
    }

    function isIsoDateTimeString(value) {
        if (typeof value !== 'string') return false;
        const trimmed = value.trim();
        if (!trimmed) return false;
        const date = new Date(trimmed);
        return !Number.isNaN(date.getTime());
    }

    function parseTaskStart(value) {
        if (typeof value === 'string') {
            const trimmed = value.trim();

            const strictTime = parseStrictTimeStringToMinutes(trimmed);
            if (strictTime.ok) {
                return { ok: true, kind: 'time', startMinutes: strictTime.minutes, raw: trimmed };
            }

            if (isIsoDateTimeString(trimmed)) {
                const ms = new Date(trimmed).getTime();
                return { ok: true, kind: 'datetime', startMillis: ms, raw: trimmed };
            }

            return { ok: false, kind: 'string', raw: trimmed };
        }

        if (isPlainObject(value)) {
            const day = value.day;
            const time = value.time;

            if (!Number.isInteger(day) || day < 1) {
                return { ok: false, kind: 'daytime', raw: value, reason: 'invalid_day' };
            }

            if (typeof time !== 'string') {
                return { ok: false, kind: 'daytime', raw: value, reason: 'invalid_time' };
            }

            const strictTime = parseStrictTimeStringToMinutes(time.trim());
            if (!strictTime.ok) {
                return { ok: false, kind: 'daytime', raw: value, reason: 'invalid_time_format' };
            }

            return { ok: true, kind: 'daytime', day, time: time.trim(), startMinutes: ((day - 1) * 1440) + strictTime.minutes, raw: value };
        }

        return { ok: false, kind: typeof value, raw: value };
    }

    function parseObjectIdParts(objectId) {
        const id = ensureString(objectId);
        if (!id) return { ok: false, kind: 'empty' };
        if (id.length > 250) return { ok: false, kind: 'too_long' };

        if (PLAIN_ID_RE.test(id)) return { ok: true, kind: 'plain', id };

        if (OBJECT_ID_RE.test(id)) {
            const [namespace, local] = id.split(':');
            return { ok: true, kind: 'namespaced', id, namespace, local };
        }

        return { ok: false, kind: 'format' };
    }

    function getBuiltInBaseType(type, typeDefinitions, seen = new Set()) {
        const raw = safeTrim(type);
        if (!raw) return '';
        if (BUILTIN_TYPES.includes(raw)) return raw;
        if (!typeDefinitions || !isPlainObject(typeDefinitions)) return '';
        if (seen.has(raw)) return '';
        seen.add(raw);
        const def = typeDefinitions[raw];
        if (!isPlainObject(def)) return '';
        const extendsType = safeTrim(def.extends);
        if (!extendsType) return '';
        return getBuiltInBaseType(extendsType, typeDefinitions, seen);
    }

    function isPerformerType(type, typeDefinitions) {
        const base = getBuiltInBaseType(type, typeDefinitions) || safeTrim(type);
        return base === 'actor' || base === 'equipment' || base === 'service';
    }

    function isQuantifiableType(type, typeDefinitions) {
        const base = getBuiltInBaseType(type, typeDefinitions) || safeTrim(type);
        return base === 'resource' || base === 'product' || base === 'digital_object';
    }

    function isStatefulType(type, typeDefinitions) {
        const base = getBuiltInBaseType(type, typeDefinitions) || safeTrim(type);
        return base === 'actor' || base === 'equipment' || base === 'service' || base === 'display' || base === 'screen_element' || base === 'digital_object';
    }

    function validatePropertyOperator(metricBase, operatorValue, instanceParts, problems, contextBase) {
        if (!isPlainObject(operatorValue)) {
            problems.push(buildProblem(
                `${metricBase}.invalid_operator`,
                'error',
                'Invalid Property Change Operator',
                'Property change operator must be an object.',
                toJsonPointer(instanceParts),
                { ...contextBase, operator: operatorValue },
                ['Replace this operator with a valid object like { "set": ... } or { "delta": ... }.']
            ));
            return;
        }

        const hasFrom = Object.prototype.hasOwnProperty.call(operatorValue, 'from');
        const hasTo = Object.prototype.hasOwnProperty.call(operatorValue, 'to');
        const hasDelta = Object.prototype.hasOwnProperty.call(operatorValue, 'delta');
        const hasSet = Object.prototype.hasOwnProperty.call(operatorValue, 'set');
        const hasMultiply = Object.prototype.hasOwnProperty.call(operatorValue, 'multiply');
        const hasAppend = Object.prototype.hasOwnProperty.call(operatorValue, 'append');
        const hasRemove = Object.prototype.hasOwnProperty.call(operatorValue, 'remove');
        const hasIncrement = Object.prototype.hasOwnProperty.call(operatorValue, 'increment');
        const hasDecrement = Object.prototype.hasOwnProperty.call(operatorValue, 'decrement');

        const keys = Object.keys(operatorValue);
        const allowedKeys = ['from', 'to', 'delta', 'set', 'multiply', 'append', 'remove', 'increment', 'decrement'];
        const unknownKeys = keys.filter((k) => !allowedKeys.includes(k));

        if (unknownKeys.length > 0) {
            problems.push(buildProblem(
                `${metricBase}.unknown_operator`,
                'warning',
                'Unknown Property Change Operator',
                `Property change operator includes unknown keys: ${unknownKeys.join(', ')}.`,
                toJsonPointer(instanceParts),
                { ...contextBase, unknown_keys: unknownKeys },
                ['Remove unknown keys or replace them with supported operators (from/to, delta, set, multiply, append, remove, increment, decrement).']
            ));
        }

        // Cannot combine from/to with delta (or multiply) for same property
        if ((hasFrom || hasTo) && (hasDelta || hasMultiply || hasIncrement || hasDecrement)) {
            problems.push(buildProblem(
                `${metricBase}.conflicting_operator`,
                'error',
                'Conflicting Property Change Operators',
                'Cannot combine from/to with delta/multiply/increment/decrement for the same property.',
                toJsonPointer(instanceParts),
                { ...contextBase, operator: operatorValue },
                ['Use either { "from": ..., "to": ... } for transitions, or use { "delta": ... } / { "set": ... } for direct changes.']
            ));
        }

        if ((hasFrom || hasTo) && !(hasFrom && hasTo)) {
            problems.push(buildProblem(
                `${metricBase}.incomplete_transition`,
                'error',
                'Incomplete State Transition',
                'from/to transitions require both "from" and "to".',
                toJsonPointer(instanceParts),
                { ...contextBase, operator: operatorValue },
                ['Provide both "from" and "to", or use { "set": ... } instead.']
            ));
        }

        if (hasDelta && typeof operatorValue.delta !== 'number') {
            problems.push(buildProblem(
                `${metricBase}.invalid_delta`,
                'error',
                'Invalid Delta',
                'delta must be a number.',
                toJsonPointer(instanceParts.concat(['delta'])),
                { ...contextBase, delta: operatorValue.delta },
                ['Use a numeric delta like { "delta": -1 } or { "delta": 2.5 }.']
            ));
        }

        if (hasMultiply && typeof operatorValue.multiply !== 'number') {
            problems.push(buildProblem(
                `${metricBase}.invalid_multiply`,
                'error',
                'Invalid Multiply',
                'multiply must be a number.',
                toJsonPointer(instanceParts.concat(['multiply'])),
                { ...contextBase, multiply: operatorValue.multiply },
                ['Use a numeric multiplier like { "multiply": 1.1 }.']
            ));
        }

        if (hasIncrement && operatorValue.increment !== true) {
            problems.push(buildProblem(
                `${metricBase}.invalid_increment`,
                'error',
                'Invalid Increment',
                'increment must be true when present.',
                toJsonPointer(instanceParts.concat(['increment'])),
                { ...contextBase, increment: operatorValue.increment },
                ['Use { "increment": true } or remove this operator.']
            ));
        }

        if (hasDecrement && operatorValue.decrement !== true) {
            problems.push(buildProblem(
                `${metricBase}.invalid_decrement`,
                'error',
                'Invalid Decrement',
                'decrement must be true when present.',
                toJsonPointer(instanceParts.concat(['decrement'])),
                { ...contextBase, decrement: operatorValue.decrement },
                ['Use { "decrement": true } or remove this operator.']
            ));
        }

        if (hasSet && (hasDelta || hasMultiply || hasAppend || hasRemove || hasIncrement || hasDecrement || hasFrom || hasTo)) {
            problems.push(buildProblem(
                `${metricBase}.conflicting_set`,
                'warning',
                'Conflicting Set Operator',
                'set is typically used alone; combining it with other operators is unusual.',
                toJsonPointer(instanceParts),
                { ...contextBase, operator: operatorValue },
                ['Prefer a single operator per property (use set alone, or remove set if delta/from-to is intended).']
            ));
        }
    }

    function validate(documentValue, options = {}) {
        const problems = [];

        const root = isPlainObject(documentValue) ? documentValue : null;
        const simulation = getSimFromDocument(root);

        if (!simulation) {
            problems.push(buildProblem(
                'schema.integrity.missing_root',
                'error',
                'Missing Simulation Root',
                "The root 'simulation' object is missing.",
                '/simulation',
                { expected: 'simulation' },
                ['Wrap the document in { "simulation": { ... } }.', 'If this is a v1 document, run the migration tool first.']
            ));
            return { ok: false, problems };
        }

        const schemaVersion = safeTrim(simulation.schema_version);
        if (!schemaVersion) {
            problems.push(buildProblem(
                'schema.integrity.missing_version',
                'error',
                'Missing Schema Version',
                "Missing required field 'simulation.schema_version'. Documents without schema_version are treated as WorkSpec v1.0 and are rejected.",
                '/simulation/schema_version',
                { field: 'schema_version' },
                [
                    "Add \"schema_version\": \"2.0\" under simulation.",
                    'Run the migration tool (Playground: Tools → Migrate v1 → v2) or CLI: workspec migrate <file> --out <output>.'
                ]
            ));
            return { ok: false, problems };
        }

        if (!/^[0-9]+\.[0-9]+$/.test(schemaVersion)) {
            problems.push(buildProblem(
                'schema.integrity.invalid_version',
                'error',
                'Invalid Schema Version',
                `simulation.schema_version must be in Major.Minor format (example: "2.0"). Received "${schemaVersion}".`,
                '/simulation/schema_version',
                { value: schemaVersion },
                ['Change schema_version to "2.0".']
            ));
            return { ok: false, problems };
        }

        if (!SUPPORTED_SCHEMA_VERSIONS.includes(schemaVersion)) {
            problems.push(buildProblem(
                'schema.integrity.unsupported_version',
                'error',
                'Unsupported Schema Version',
                `WorkSpec schema_version "${schemaVersion}" is not supported by this validator. Supported versions: ${SUPPORTED_SCHEMA_VERSIONS.join(', ')}.`,
                '/simulation/schema_version',
                { value: schemaVersion, supported: [...SUPPORTED_SCHEMA_VERSIONS] },
                ['Use the supported schema version "2.0".']
            ));
            return { ok: false, problems };
        }

        // Required top-level sections
        if (!isPlainObject(simulation.meta)) {
            problems.push(buildProblem(
                'schema.integrity.missing_meta',
                'error',
                'Missing Meta Section',
                "Missing required object 'simulation.meta'.",
                '/simulation/meta',
                { field: 'meta' },
                ['Add simulation.meta with required fields: title, description, domain.']
            ));
        } else {
            const meta = simulation.meta;
            const missingFields = [];
            for (const key of ['title', 'description', 'domain']) {
                if (!safeTrim(meta[key])) missingFields.push(key);
            }

            if (missingFields.length > 0) {
                problems.push(buildProblem(
                    'schema.integrity.missing_meta_fields',
                    'error',
                    'Missing Meta Fields',
                    `simulation.meta is missing required field(s): ${missingFields.join(', ')}.`,
                    '/simulation/meta',
                    { missing: missingFields },
                    ['Add the missing meta fields: title, description, domain.']
                ));
            }

            if (Object.prototype.hasOwnProperty.call(meta, 'article_title')) {
                problems.push(buildProblem(
                    'schema.integrity.disallowed_meta_field',
                    'error',
                    'Disallowed Meta Field',
                    "Legacy field 'meta.article_title' is not allowed in WorkSpec v2.0. Use 'meta.title' instead.",
                    '/simulation/meta/article_title',
                    { field: 'article_title' },
                    ['Remove meta.article_title.', 'Rename meta.article_title to meta.title.']
                ));
            }
        }

        if (!isPlainObject(simulation.config)) {
            problems.push(buildProblem(
                'schema.integrity.missing_config',
                'error',
                'Missing Config Section',
                "Missing required object 'simulation.config'.",
                '/simulation/config',
                { field: 'config' },
                ['Add simulation.config with required fields: time_unit, start_time, end_time, currency, locale.']
            ));
        }

        const config = isPlainObject(simulation.config) ? simulation.config : {};
        const normalizedTimeUnit = normalizeTimeUnit(config.time_unit);
        if (!normalizedTimeUnit) {
            problems.push(buildProblem(
                'schema.integrity.invalid_time_unit',
                'error',
                'Invalid Time Unit',
                "simulation.config.time_unit must be one of: seconds, minutes, hours.",
                '/simulation/config/time_unit',
                { value: config.time_unit },
                ['Set time_unit to "seconds", "minutes", or "hours".']
            ));
        }

        for (const key of ['start_time', 'end_time']) {
            const raw = config[key];
            if (typeof raw !== 'string' || !safeTrim(raw)) {
                problems.push(buildProblem(
                    'schema.integrity.missing_config_field',
                    'error',
                    'Missing Config Field',
                    `simulation.config.${key} is required.`,
                    toJsonPointer(['simulation', 'config', key]),
                    { field: key },
                    [`Add ${key} in HH:MM (or ISO 8601) format.`]
                ));
            }
        }

        for (const key of ['currency', 'locale']) {
            const raw = config[key];
            if (typeof raw !== 'string' || !safeTrim(raw)) {
                problems.push(buildProblem(
                    'schema.integrity.missing_config_field',
                    'error',
                    'Missing Config Field',
                    `simulation.config.${key} is required.`,
                    toJsonPointer(['simulation', 'config', key]),
                    { field: key },
                    [`Add ${key} (currency: ISO 4217, locale: BCP 47).`]
                ));
            }
        }

        // world/process structure
        if (!isPlainObject(simulation.world)) {
            problems.push(buildProblem(
                'schema.integrity.missing_world',
                'error',
                'Missing World Section',
                "Missing required object 'simulation.world'.",
                '/simulation/world',
                { field: 'world' },
                ['Add simulation.world with required world.objects and optional world.layout.']
            ));
        }

        if (!isPlainObject(simulation.process)) {
            problems.push(buildProblem(
                'schema.integrity.missing_process',
                'error',
                'Missing Process Section',
                "Missing required object 'simulation.process'.",
                '/simulation/process',
                { field: 'process' },
                ['Add simulation.process with required process.tasks and optional process.recipes.']
            ));
        }

        const world = isPlainObject(simulation.world) ? simulation.world : {};
        const process = isPlainObject(simulation.process) ? simulation.process : {};

        const legacyLayout = isPlainObject(simulation.layout) ? simulation.layout : null;
        const legacyObjects = Array.isArray(simulation.objects) ? simulation.objects : null;
        const legacyTasks = Array.isArray(simulation.tasks) ? simulation.tasks : null;
        const legacyRecipes = isPlainObject(simulation.recipes) ? simulation.recipes : null;

        const objectsFromWorld = Array.isArray(world.objects) ? world.objects : null;
        const tasksFromProcess = Array.isArray(process.tasks) ? process.tasks : null;
        const layoutForLocations = isPlainObject(world.layout) ? world.layout : (legacyLayout || {});

        const objects = (objectsFromWorld && objectsFromWorld.length > 0)
            ? objectsFromWorld
            : (legacyObjects || objectsFromWorld);
        const tasks = (tasksFromProcess && tasksFromProcess.length > 0)
            ? tasksFromProcess
            : (legacyTasks || tasksFromProcess);

        const objectsBasePtr = (objects === objectsFromWorld)
            ? ['simulation', 'world', 'objects']
            : ['simulation', 'objects'];
        const tasksBasePtr = (tasks === tasksFromProcess)
            ? ['simulation', 'process', 'tasks']
            : ['simulation', 'tasks'];
        const tasksBaseInstance = toJsonPointer(tasksBasePtr);

        if (!objectsFromWorld) {
            problems.push(buildProblem(
                'schema.integrity.invalid_world_objects',
                'error',
                'Invalid World Objects',
                "simulation.world.objects must be an array.",
                '/simulation/world/objects',
                { field: 'world.objects', value_type: typeof world.objects },
                ['Set simulation.world.objects to an array (use [] if empty).']
            ));
        }

        if (!tasksFromProcess) {
            problems.push(buildProblem(
                'schema.integrity.invalid_process_tasks',
                'error',
                'Invalid Process Tasks',
                "simulation.process.tasks must be an array.",
                '/simulation/process/tasks',
                { field: 'process.tasks', value_type: typeof process.tasks },
                ['Set simulation.process.tasks to an array (use [] if empty).']
            ));
        }

        // Stop early if basic structure is invalid
        if (!objects || !tasks || !normalizedTimeUnit) {
            return { ok: problems.every((p) => p.severity !== 'error'), problems };
        }

        const typeDefinitions = isPlainObject(simulation.type_definitions) ? simulation.type_definitions : null;
        const locationIds = new Set();
        const locations = layoutForLocations?.locations;
        if (Array.isArray(locations)) {
            for (let i = 0; i < locations.length; i += 1) {
                const loc = locations[i];
                if (isPlainObject(loc) && safeTrim(loc.id)) {
                    locationIds.add(safeTrim(loc.id));
                }
            }
        }

        const objectIds = new Set();
        const objectTypeById = new Map();
        const objectById = new Map();

        for (let i = 0; i < objects.length; i += 1) {
            const obj = objects[i];
            const objPtr = objectsBasePtr.concat([i]);

            if (!isPlainObject(obj)) {
                problems.push(buildProblem(
                    'object.integrity.invalid_object',
                    'error',
                    'Invalid Object',
                    `Object at index ${i} must be an object.`,
                    toJsonPointer(objPtr),
                    { index: i },
                    ['Replace this entry with a valid object containing id, type, and name.']
                ));
                continue;
            }

            const rawId = ensureString(obj.id);
            const rawType = safeTrim(obj.type);
            const rawName = safeTrim(obj.name);

            if (!rawId || !rawType || !rawName) {
                const missing = [];
                if (!rawId) missing.push('id');
                if (!rawType) missing.push('type');
                if (!rawName) missing.push('name');
                problems.push(buildProblem(
                    'object.integrity.missing_required_fields',
                    'error',
                    'Missing Object Fields',
                    `Object is missing required field(s): ${missing.join(', ')}.`,
                    toJsonPointer(objPtr),
                    { object_index: i, missing },
                    ['Ensure each object includes: id, type, name.']
                ));
                continue;
            }

            if (rawType.startsWith('_') || RESERVED_TYPE_NAMES.includes(rawType)) {
                problems.push(buildProblem(
                    'schema.integrity.disallowed_types',
                    'error',
                    'Disallowed Object Type',
                    `Object '${rawId}' uses reserved type '${rawType}', which is not allowed.`,
                    toJsonPointer(objPtr.concat(['type'])),
                    { object_id: rawId, type: rawType },
                    ['Use a non-reserved type name.', 'Avoid types: timeline_actors, any, unknown, and any type starting with underscore.']
                ));
            }

            if (Object.prototype.hasOwnProperty.call(DISALLOWED_TYPE_ALIASES, rawType)) {
                problems.push(buildProblem(
                    'object.integrity.disallowed_type_alias',
                    'error',
                    'Disallowed Type Alias',
                    `Object '${rawId}' uses legacy type alias '${rawType}'.`,
                    toJsonPointer(objPtr.concat(['type'])),
                    { object_id: rawId, type: rawType, suggested_type: DISALLOWED_TYPE_ALIASES[rawType] },
                    [`Use canonical type '${DISALLOWED_TYPE_ALIASES[rawType]}' instead of '${rawType}'.`]
                ));
            }

            const idParts = parseObjectIdParts(rawId);
            if (!idParts.ok) {
                problems.push(buildProblem(
                    'object.integrity.invalid_object_id',
                    'error',
                    'Invalid Object ID',
                    `Object id '${rawId}' is invalid. IDs must be snake_case, optionally namespaced as '{type}:{id}', max 250 chars.`,
                    toJsonPointer(objPtr.concat(['id'])),
                    { object_id: rawId },
                    ['Use snake_case IDs like "head_baker".', 'Optional namespacing is allowed: "actor:head_baker".']
                ));
            } else if (idParts.kind === 'namespaced' && idParts.namespace !== rawType) {
                problems.push(buildProblem(
                    'object.integrity.namespace_mismatch',
                    'error',
                    'Namespaced ID Type Mismatch',
                    `Object id '${rawId}' is namespaced as '${idParts.namespace}', but object.type is '${rawType}'. Namespace must match type exactly.`,
                    toJsonPointer(objPtr.concat(['id'])),
                    { object_id: rawId, namespace: idParts.namespace, type: rawType },
                    [`Change id to '${rawType}:${idParts.local}'.`, `Or change type to '${idParts.namespace}'.`]
                ));
            }

            if (objectIds.has(rawId)) {
                problems.push(buildProblem(
                    'object.integrity.duplicate_object_id',
                    'error',
                    'Duplicate Object ID',
                    `Duplicate object id '${rawId}'. Object IDs must be unique.`,
                    toJsonPointer(objPtr.concat(['id'])),
                    { object_id: rawId },
                    ['Rename one of the duplicate objects to a unique id.']
                ));
            } else {
                objectIds.add(rawId);
            }

            if (!BUILTIN_TYPES.includes(rawType) && (!typeDefinitions || !isPlainObject(typeDefinitions[rawType]))) {
                problems.push(buildProblem(
                    'object.integrity.missing_type_definition',
                    'error',
                    'Missing Type Definition',
                    `Object '${rawId}' uses custom type '${rawType}' but no corresponding simulation.type_definitions['${rawType}'] entry exists.`,
                    toJsonPointer(objPtr.concat(['type'])),
                    { object_id: rawId, type: rawType },
                    ['Add a type definition under simulation.type_definitions.', `Or change object.type to a built-in type: ${BUILTIN_TYPES.join(', ')}.`]
                ));
            }

            if (typeDefinitions && isPlainObject(typeDefinitions[rawType])) {
                const def = typeDefinitions[rawType];
                const extendsType = safeTrim(def.extends);
                if (!extendsType) {
                    problems.push(buildProblem(
                        'object.integrity.invalid_type_definition',
                        'error',
                        'Invalid Type Definition',
                        `Type definition '${rawType}' is missing required field 'extends'.`,
                        toJsonPointer(['simulation', 'type_definitions', rawType]),
                        { type: rawType },
                        ['Add "extends" (actor|equipment|resource|product|service|display|screen_element|digital_object).']
                    ));
                }
            }

            if (safeTrim(obj.location) && locationIds.size > 0 && !locationIds.has(safeTrim(obj.location))) {
                problems.push(buildProblem(
                    'object.reference.invalid_location',
                    'error',
                    'Invalid Location Reference',
                    `Object '${rawId}' references unknown location '${obj.location}'.`,
                    toJsonPointer(objPtr.concat(['location'])),
                    { object_id: rawId, location: obj.location },
                    ['Fix the location id to one defined in simulation.world.layout.locations.', 'Or add this location to the layout.']
                ));
            }

            const props = isPlainObject(obj.properties) ? obj.properties : {};
            if (isQuantifiableType(rawType, typeDefinitions)) {
                const q = props.quantity;
                if (typeof q !== 'number' || !Number.isFinite(q) || q < 0) {
                    problems.push(buildProblem(
                        'object.integrity.missing_required_properties',
                        'error',
                        'Missing Required Properties',
                        `Quantifiable object '${rawId}' must have numeric properties.quantity >= 0.`,
                        toJsonPointer(objPtr.concat(['properties', 'quantity'])),
                        { object_id: rawId, type: rawType, quantity: q },
                        ['Add properties.quantity as a non-negative number.']
                    ));
                }
            }

            if (isStatefulType(rawType, typeDefinitions)) {
                const state = props.state;
                if (typeof state !== 'string' || !safeTrim(state)) {
                    problems.push(buildProblem(
                        'object.integrity.missing_required_properties',
                        'error',
                        'Missing Required Properties',
                        `Stateful object '${rawId}' must have string properties.state.`,
                        toJsonPointer(objPtr.concat(['properties', 'state'])),
                        { object_id: rawId, type: rawType },
                        ['Add properties.state (example: "available", "running", "clean").']
                    ));
                }
            }

            objectTypeById.set(rawId, rawType);
            objectById.set(rawId, obj);
        }

        const taskIds = new Set();
        const taskById = new Map();
        const taskIndexById = new Map();
        const taskTiming = new Map(); // id -> { startMinutes, endMinutes } (for time/daytime tasks)
        const taskMillis = new Map(); // id -> { startMillis, endMillis } (for datetime tasks)

        const referencedObjectIds = new Set();
        const recipeDefinitions = isPlainObject(process.recipes)
            ? process.recipes
            : (legacyRecipes || null);

        // Object lifecycle (create/delete): allow references to objects created via action:create.
        // Temporal existence checks are performed later using chronological replay.
        const createdObjectIds = new Set();
        for (let i = 0; i < tasks.length; i += 1) {
            const task = tasks[i];
            if (!isPlainObject(task) || !Array.isArray(task.interactions)) continue;
            for (let j = 0; j < task.interactions.length; j += 1) {
                const interaction = task.interactions[j];
                if (!isPlainObject(interaction)) continue;
                if (safeTrim(interaction.action) !== 'create') continue;
                if (!isPlainObject(interaction.object)) continue;
                const createdId = safeTrim(interaction.object.id);
                if (createdId) createdObjectIds.add(createdId);
            }
        }
        const knownObjectIds = new Set([...objectIds, ...createdObjectIds]);

        for (let i = 0; i < tasks.length; i += 1) {
            const task = tasks[i];
            const taskPtr = tasksBasePtr.concat([i]);

            if (!isPlainObject(task)) {
                problems.push(buildProblem(
                    'task.integrity.invalid_task',
                    'error',
                    'Invalid Task',
                    `Task at index ${i} must be an object.`,
                    toJsonPointer(taskPtr),
                    { index: i },
                    ['Replace this entry with a valid task containing id, actor_id, start, duration.']
                ));
                continue;
            }

            const rawId = safeTrim(task.id);
            const rawActorId = ensureString(task.actor_id);

            if (!rawId) {
                problems.push(buildProblem(
                    'task.integrity.invalid_task_id',
                    'error',
                    'Invalid Task ID',
                    `Task at index ${i} is missing id.`,
                    toJsonPointer(taskPtr.concat(['id'])),
                    { task_index: i },
                    ['Add a unique snake_case id to this task.']
                ));
                continue;
            }

            if (!PLAIN_ID_RE.test(rawId)) {
                problems.push(buildProblem(
                    'task.integrity.invalid_task_id',
                    'error',
                    'Invalid Task ID',
                    `Task id '${rawId}' is invalid. Task IDs must be snake_case (no namespaces).`,
                    toJsonPointer(taskPtr.concat(['id'])),
                    { task_id: rawId },
                    ['Use snake_case IDs like "mix_dough".']
                ));
            }

            if (taskIds.has(rawId)) {
                problems.push(buildProblem(
                    'task.integrity.duplicate_task_id',
                    'error',
                    'Duplicate Task ID',
                    `Duplicate task id '${rawId}'. Task IDs must be unique.`,
                    toJsonPointer(taskPtr.concat(['id'])),
                    { task_id: rawId },
                    ['Rename one of the duplicate tasks to a unique id.']
                ));
            } else {
                taskIds.add(rawId);
            }

            taskById.set(rawId, task);
            taskIndexById.set(rawId, i);

            if (!rawActorId) {
                problems.push(buildProblem(
                    'task.reference.invalid_actor',
                    'error',
                    'Invalid Actor Reference',
                    `Task '${rawId}' is missing actor_id.`,
                    toJsonPointer(taskPtr.concat(['actor_id'])),
                    { task_id: rawId },
                    ['Set actor_id to an existing performer object id (actor, equipment, or service).']
                ));
            } else if (!knownObjectIds.has(rawActorId)) {
                problems.push(buildProblem(
                    'task.reference.invalid_actor',
                    'error',
                    'Invalid Actor Reference',
                    `Task '${rawId}' references unknown actor_id '${rawActorId}'.`,
                    toJsonPointer(taskPtr.concat(['actor_id'])),
                    { task_id: rawId, actor_id: rawActorId },
                    ['Fix the actor_id to match an object id in simulation.world.objects.', 'Add the missing object to world.objects.', 'Or create the object earlier via action:create.']
                ));
            } else if (objectTypeById.has(rawActorId) && !isPerformerType(objectTypeById.get(rawActorId), typeDefinitions)) {
                problems.push(buildProblem(
                    'task.reference.invalid_actor',
                    'error',
                    'Invalid Actor Reference',
                    `Task '${rawId}' actor_id '${rawActorId}' references an object that cannot perform tasks (type: '${objectTypeById.get(rawActorId)}').`,
                    toJsonPointer(taskPtr.concat(['actor_id'])),
                    { task_id: rawId, actor_id: rawActorId, type: objectTypeById.get(rawActorId) },
                    ['Use actor/equipment/service objects as actor_id.', 'Change the referenced object type to a performer type if appropriate.']
                ));
            }

            const startParse = parseTaskStart(task.start);
            if (!startParse.ok) {
                const suggestions = [
                    'Use strict time strings like "09:30" (zero-padded).',
                    'Use "HH:MM:SS" if you need seconds.',
                    'Use ISO 8601 date-time strings (e.g., "2026-02-03T09:30:00Z").',
                    'For multi-day: use { "day": 2, "time": "09:30" }.'
                ];
                problems.push(buildProblem(
                    'task.integrity.invalid_start_time',
                    'error',
                    'Invalid Start Time Format',
                    `Task '${rawId}' has invalid start value.`,
                    toJsonPointer(taskPtr.concat(['start'])),
                    { task_id: rawId, value: task.start, reason: startParse.reason || startParse.kind },
                    suggestions
                ));
            }

            const durationParse = parseDurationToMinutes(task.duration, normalizedTimeUnit);
            if (!durationParse.ok) {
                problems.push(buildProblem(
                    'task.integrity.invalid_duration',
                    'error',
                    'Invalid Task Duration',
                    `Task '${rawId}' has invalid duration '${task.duration}'. Duration must be a positive integer (uses config.time_unit), ISO 8601 (PT30M), or shorthand (30m, 1h, 1d, 10s, 1w, 1M).`,
                    toJsonPointer(taskPtr.concat(['duration'])),
                    { task_id: rawId, duration: task.duration },
                    ['Use a positive integer for duration (e.g., 30).', 'Or use "PT30M" / "30m" / "1h".']
                ));
            }

            if (startParse.ok && durationParse.ok) {
                if (startParse.kind === 'datetime') {
                    const endMillis = startParse.startMillis + (durationParse.minutes * 60 * 1000);
                    taskMillis.set(rawId, { startMillis: startParse.startMillis, endMillis, index: i });
                } else {
                    const startMinutes = startParse.startMinutes;
                    const endMinutes = startMinutes + durationParse.minutes;
                    taskTiming.set(rawId, { startMinutes, endMinutes, index: i });
                }
            }

            if (safeTrim(task.location) && locationIds.size > 0 && !locationIds.has(safeTrim(task.location))) {
                problems.push(buildProblem(
                    'object.reference.invalid_location',
                    'error',
                    'Invalid Location Reference',
                    `Task '${rawId}' references unknown location '${task.location}'.`,
                    toJsonPointer(taskPtr.concat(['location'])),
                    { task_id: rawId, location: task.location },
                    ['Fix the task location id to one defined in simulation.world.layout.locations.', 'Or add this location to the layout.']
                ));
            }

            // depends_on validation (array or {all, any})
            const depends = task.depends_on;
            const depIds = [];
            if (Array.isArray(depends)) {
                depIds.push(...depends);
            } else if (isPlainObject(depends)) {
                if (Array.isArray(depends.all)) depIds.push(...depends.all);
                if (Array.isArray(depends.any)) depIds.push(...depends.any);
            } else if (depends !== undefined && depends !== null) {
                problems.push(buildProblem(
                    'task.reference.invalid_dependency',
                    'error',
                    'Invalid Dependency Format',
                    `Task '${rawId}' depends_on must be an array of task ids or an object with "all"/"any" arrays.`,
                    toJsonPointer(taskPtr.concat(['depends_on'])),
                    { task_id: rawId, depends_on: depends },
                    ['Use "depends_on": ["task_a", "task_b"] or { "all": [...], "any": [...] }.']
                ));
            }

            for (const dep of depIds) {
                if (typeof dep !== 'string' || !safeTrim(dep)) {
                    problems.push(buildProblem(
                        'task.reference.invalid_dependency',
                        'error',
                        'Invalid Dependency Reference',
                        `Task '${rawId}' has a depends_on entry that is not a string id.`,
                        toJsonPointer(taskPtr.concat(['depends_on'])),
                        { task_id: rawId, dependency: dep },
                        ['Replace this dependency entry with a valid task id string.']
                    ));
                    continue;
                }

                if (safeTrim(dep) === rawId) {
                    problems.push(buildProblem(
                        'task.reference.invalid_dependency',
                        'error',
                        'Self-Referencing Dependency',
                        `Task '${rawId}' cannot depend on itself.`,
                        toJsonPointer(taskPtr.concat(['depends_on'])),
                        { task_id: rawId, dependency: dep },
                        ['Remove the self-reference from depends_on.']
                    ));
                }
            }

            // Interactions validation
            const interactions = task.interactions;
            if (interactions !== undefined && !Array.isArray(interactions)) {
                problems.push(buildProblem(
                    'task.integrity.invalid_interactions',
                    'error',
                    'Invalid Interactions',
                    `Task '${rawId}' interactions must be an array.`,
                    toJsonPointer(taskPtr.concat(['interactions'])),
                    { task_id: rawId },
                    ['Set interactions to an array (use [] if none).']
                ));
            }

            if (Array.isArray(interactions)) {
                for (let j = 0; j < interactions.length; j += 1) {
                    const interaction = interactions[j];
                    const interactionPtr = taskPtr.concat(['interactions', j]);

                    if (!isPlainObject(interaction)) {
                        problems.push(buildProblem(
                            'task.integrity.invalid_interaction',
                            'error',
                            'Invalid Interaction',
                            `Task '${rawId}' has an interaction at index ${j} that is not an object.`,
                            toJsonPointer(interactionPtr),
                            { task_id: rawId, interaction_index: j },
                            ['Replace this entry with a valid interaction object.']
                        ));
                        continue;
                    }

                    if (Object.prototype.hasOwnProperty.call(interaction, 'object_id')) {
                        problems.push(buildProblem(
                            'task.integrity.legacy_field',
                            'error',
                            'Legacy Interaction Field',
                            `Task '${rawId}' uses legacy field 'object_id'. WorkSpec v2 requires 'target_id'.`,
                            toJsonPointer(interactionPtr.concat(['object_id'])),
                            { task_id: rawId, legacy_field: 'object_id' },
                            ['Rename object_id to target_id.']
                        ));
                    }

                    if (Object.prototype.hasOwnProperty.call(interaction, 'revert_after')) {
                        problems.push(buildProblem(
                            'task.integrity.legacy_field',
                            'error',
                            'Legacy Interaction Field',
                            `Task '${rawId}' uses legacy field 'revert_after'. WorkSpec v2 requires 'temporary'.`,
                            toJsonPointer(interactionPtr.concat(['revert_after'])),
                            { task_id: rawId, legacy_field: 'revert_after' },
                            ['Rename revert_after to temporary.']
                        ));
                    }

                    const action = safeTrim(interaction.action);
                    const targetId = ensureString(interaction.target_id);

                    if (action) {
                        if (action !== 'create' && action !== 'delete') {
                            problems.push(buildProblem(
                                'task.integrity.invalid_interaction_action',
                                'error',
                                'Invalid Interaction Action',
                                `Task '${rawId}' has invalid interaction.action '${action}'. Supported actions: create, delete.`,
                                toJsonPointer(interactionPtr.concat(['action'])),
                                { task_id: rawId, action },
                                ['Use action "create" or "delete".', 'Remove action to use property_changes interactions.']
                            ));
                        }

                        if (action === 'create') {
                            if (!isPlainObject(interaction.object)) {
                                problems.push(buildProblem(
                                    'task.integrity.invalid_interaction',
                                    'error',
                                    'Invalid Create Interaction',
                                    `Task '${rawId}' create interaction requires an 'object' field.`,
                                    toJsonPointer(interactionPtr),
                                    { task_id: rawId, action },
                                    ['Add an object field containing the new object definition.']
                                ));
                            }
                        }

                        if (action === 'delete') {
                            if (!safeTrim(targetId)) {
                                problems.push(buildProblem(
                                    'task.integrity.invalid_interaction',
                                    'error',
                                    'Invalid Delete Interaction',
                                    `Task '${rawId}' delete interaction requires 'target_id'.`,
                                    toJsonPointer(interactionPtr),
                                    { task_id: rawId, action },
                                    ['Add target_id to indicate which object is deleted.']
                                ));
                            }
                        }
                    } else {
                        // Property change interaction
                        if (!safeTrim(targetId)) {
                            problems.push(buildProblem(
                                'task.integrity.invalid_interaction',
                                'error',
                                'Invalid Interaction',
                                `Task '${rawId}' interaction is missing target_id.`,
                                toJsonPointer(interactionPtr.concat(['target_id'])),
                                { task_id: rawId, interaction_index: j },
                                ['Add target_id referencing an existing object.']
                            ));
                        }

                        if (!isPlainObject(interaction.property_changes)) {
                            problems.push(buildProblem(
                                'task.integrity.invalid_interaction',
                                'error',
                                'Invalid Interaction',
                                `Task '${rawId}' property-change interaction requires property_changes object.`,
                                toJsonPointer(interactionPtr.concat(['property_changes'])),
                                { task_id: rawId, interaction_index: j },
                                ['Add property_changes with one or more property operations.']
                            ));
                        }
                    }

                    if (safeTrim(targetId)) {
                        referencedObjectIds.add(targetId);
                        if (!knownObjectIds.has(targetId)) {
                            problems.push(buildProblem(
                                'task.integrity.invalid_object_reference',
                                'error',
                                'Invalid Object Reference',
                                `Task '${rawId}' references unknown object '${targetId}'.`,
                                toJsonPointer(interactionPtr.concat(['target_id'])),
                                { task_id: rawId, target_id: targetId },
                                ['Fix target_id to match an existing object id in simulation.world.objects.', 'Or create the object earlier via action:create.']
                            ));
                        }
                    }

                    if (isPlainObject(interaction.property_changes)) {
                        for (const [propertyName, op] of Object.entries(interaction.property_changes)) {
                            const operatorPtr = interactionPtr.concat(['property_changes', propertyName]);
                            validatePropertyOperator(
                                'interaction.operator',
                                op,
                                operatorPtr,
                                problems,
                                { task_id: rawId, target_id: targetId, property: propertyName }
                            );
                        }
                    }
                }
            }

            // Track actor_id as object reference for unused-resource detection
            if (rawActorId) referencedObjectIds.add(rawActorId);
        }

        // Validate dependency references now that we have taskIds
        for (let i = 0; i < tasks.length; i += 1) {
            const task = tasks[i];
            if (!isPlainObject(task)) continue;
            const rawId = safeTrim(task.id);
            if (!rawId) continue;
            const depends = task.depends_on;

            const collect = [];
            if (Array.isArray(depends)) collect.push(...depends);
            if (isPlainObject(depends)) {
                if (Array.isArray(depends.all)) collect.push(...depends.all);
                if (Array.isArray(depends.any)) collect.push(...depends.any);
            }

            for (const dep of collect) {
                const depId = safeTrim(dep);
                if (!depId) continue;
                if (!taskIds.has(depId)) {
                    problems.push(buildProblem(
                        'task.reference.invalid_dependency',
                        'error',
                        'Invalid Dependency Reference',
                        `Task '${rawId}' depends_on references unknown task '${depId}'.`,
                        toJsonPointer(tasksBasePtr.concat([i, 'depends_on'])),
                        { task_id: rawId, dependency_id: depId },
                        ['Fix the dependency id (typo), or add the missing task.']
                    ));
                }
            }
        }

        // Circular dependency detection (graph on ALL dependencies; any/all are both edges)
        const graph = new Map(); // taskId -> Set(depId)
        for (const id of taskIds) {
            graph.set(id, new Set());
        }
        for (let i = 0; i < tasks.length; i += 1) {
            const task = tasks[i];
            if (!isPlainObject(task)) continue;
            const id = safeTrim(task.id);
            if (!id) continue;
            const deps = new Set();
            const depends = task.depends_on;
            if (Array.isArray(depends)) {
                depends.forEach((d) => { if (safeTrim(d)) deps.add(safeTrim(d)); });
            } else if (isPlainObject(depends)) {
                if (Array.isArray(depends.all)) depends.all.forEach((d) => { if (safeTrim(d)) deps.add(safeTrim(d)); });
                if (Array.isArray(depends.any)) depends.any.forEach((d) => { if (safeTrim(d)) deps.add(safeTrim(d)); });
            }
            graph.set(id, deps);
        }

        const visitState = new Map(); // id -> 0 unvisited, 1 visiting, 2 done
        const stack = [];

        function dfs(node) {
            visitState.set(node, 1);
            stack.push(node);

            const deps = graph.get(node) || new Set();
            for (const dep of deps) {
                if (!graph.has(dep)) continue; // already reported missing
                const state = visitState.get(dep) || 0;
                if (state === 1) {
                    const cycleStartIndex = stack.indexOf(dep);
                    const cycle = stack.slice(cycleStartIndex).concat([dep]);
                    problems.push(buildProblem(
                        'temporal.scheduling.circular_dependency',
                        'error',
                        'Circular Dependencies',
                        `Circular dependency detected: ${cycle.join(' -> ')}`,
                        tasksBaseInstance,
                        { cycle },
                        ['Break the cycle by removing or rewriting one of the depends_on references.']
                    ));
                } else if (state === 0) {
                    dfs(dep);
                }
            }

            stack.pop();
            visitState.set(node, 2);
        }

        for (const id of taskIds) {
            if ((visitState.get(id) || 0) === 0) dfs(id);
        }

        // Object lifecycle semantics (best-effort):
        // - Objects created via action:create become valid targets after the create interaction runs.
        // - References to objects after action:delete must error.
        //
        // Evaluated by replaying create/delete interactions in chronological order (task start time).
        try {
            const tasksInOrderForLifecycle = [...taskTiming.entries()]
                .map(([taskId, timing]) => ({ taskId, ...timing }))
                .sort((a, b) => (a.startMinutes - b.startMinutes) || (a.index - b.index));

            const existing = new Set(objectIds); // objects currently "alive" at this point in time
            const everDefined = new Set(objectIds); // enforce unique IDs across the whole simulation
            const deletedBy = new Map(); // objectId -> { task_id, start_minutes }
            let pendingEndEvents = []; // { time, kind: 'create'|'delete', object_id, task_id, order }

            function applyEndEvents(upToTime) {
                if (pendingEndEvents.length === 0) return;
                const due = pendingEndEvents.filter((e) => typeof e.time === 'number' && e.time <= upToTime);
                if (due.length === 0) return;
                pendingEndEvents = pendingEndEvents.filter((e) => !(typeof e.time === 'number' && e.time <= upToTime));

                due.sort((a, b) => (a.time - b.time) || (a.order - b.order));
                for (const event of due) {
                    if (event.kind === 'create') {
                        existing.add(event.object_id);
                        deletedBy.delete(event.object_id);
                    } else if (event.kind === 'delete') {
                        existing.delete(event.object_id);
                        deletedBy.set(event.object_id, { task_id: event.task_id, start_minutes: event.time });
                    }
                }
            }

            for (const entry of tasksInOrderForLifecycle) {
                applyEndEvents(entry.startMinutes);

                const task = taskById.get(entry.taskId);
                if (!task) continue;
                const taskIndex = taskIndexById.get(entry.taskId);
                const taskPtr = tasksBasePtr.concat([typeof taskIndex === 'number' ? taskIndex : entry.index]);

                const actorId = safeTrim(task.actor_id);
                if (actorId && knownObjectIds.has(actorId) && !existing.has(actorId)) {
                    const lastDelete = deletedBy.get(actorId);
                    const detail = lastDelete
                        ? `Task '${entry.taskId}' references '${actorId}' after it was deleted by task '${lastDelete.task_id}'.`
                        : `Task '${entry.taskId}' references '${actorId}' before it is created.`;

                    problems.push(buildProblem(
                        'object.reference.lifecycle_violation',
                        'error',
                        'Object Lifecycle Violation',
                        detail,
                        toJsonPointer(taskPtr.concat(['actor_id'])),
                        { task_id: entry.taskId, object_id: actorId, reference: 'actor_id', deleted_by: lastDelete ? lastDelete.task_id : null },
                        ['Move the reference to after the object is created.', 'Or remove/replace the reference.', 'If this is meant to be permanent, remove temporary from the create/delete interaction.']
                    ));
                }

                if (!Array.isArray(task.interactions)) continue;
                for (let j = 0; j < task.interactions.length; j += 1) {
                    const interaction = task.interactions[j];
                    if (!isPlainObject(interaction)) continue;
                    const interactionPtr = taskPtr.concat(['interactions', j]);

                    const action = safeTrim(interaction.action);
                    const isTemporary = interaction.temporary === true;

                    if (action === 'create') {
                        if (!isPlainObject(interaction.object)) continue;
                        const createdId = safeTrim(interaction.object.id);
                        if (!createdId) continue;

                        if (everDefined.has(createdId)) {
                            problems.push(buildProblem(
                                'object.integrity.duplicate_object_id',
                                'error',
                                'Duplicate Object ID',
                                `Task '${entry.taskId}' creates object id '${createdId}', but that id is already defined.`,
                                toJsonPointer(interactionPtr.concat(['object', 'id'])),
                                { task_id: entry.taskId, object_id: createdId },
                                ['Use a unique id for the created object.', 'If you meant to modify an existing object, remove action:create and use property_changes.']
                            ));
                        } else {
                            everDefined.add(createdId);
                        }

                        existing.add(createdId);
                        deletedBy.delete(createdId);

                        if (isTemporary && typeof entry.endMinutes === 'number' && Number.isFinite(entry.endMinutes)) {
                            pendingEndEvents.push({
                                time: entry.endMinutes,
                                kind: 'delete',
                                object_id: createdId,
                                task_id: entry.taskId,
                                order: (entry.index * 1000) + j
                            });
                        }

                        continue;
                    }

                    const targetId = safeTrim(interaction.target_id);
                    if (!targetId) continue;

                    if (knownObjectIds.has(targetId) && !existing.has(targetId)) {
                        const lastDelete = deletedBy.get(targetId);
                        const detail = lastDelete
                            ? `Task '${entry.taskId}' references '${targetId}' after it was deleted by task '${lastDelete.task_id}'.`
                            : `Task '${entry.taskId}' references '${targetId}' before it is created.`;

                        problems.push(buildProblem(
                            'object.reference.lifecycle_violation',
                            'error',
                            'Object Lifecycle Violation',
                            detail,
                            toJsonPointer(interactionPtr.concat(['target_id'])),
                            { task_id: entry.taskId, object_id: targetId, reference: 'target_id', deleted_by: lastDelete ? lastDelete.task_id : null },
                            ['Move the reference to after the object is created.', 'Or remove/replace the reference.', 'If this is meant to be permanent, remove temporary from the create/delete interaction.']
                        ));
                    }

                    if (action === 'delete') {
                        if (existing.has(targetId)) {
                            existing.delete(targetId);
                            deletedBy.set(targetId, { task_id: entry.taskId, start_minutes: entry.startMinutes });

                            if (isTemporary && typeof entry.endMinutes === 'number' && Number.isFinite(entry.endMinutes)) {
                                pendingEndEvents.push({
                                    time: entry.endMinutes,
                                    kind: 'create',
                                    object_id: targetId,
                                    task_id: entry.taskId,
                                    order: (entry.index * 1000) + j
                                });
                            }
                        }
                    }
                }
            }
        } catch (error) {
            problems.push(buildProblem(
                'object.reference.lifecycle_validation_error',
                'warning',
                'Lifecycle Validation Error',
                `Lifecycle validation encountered an internal error: ${error.message}`,
                tasksBaseInstance,
                { error: error.message },
                ['Retry validation.', 'If this persists, simplify create/delete interactions or report a bug.']
            ));
        }

        // Temporal scheduling checks (only for time/daytime tasks where we have minutes)
        // 1) actor overlap
        const tasksByActor = new Map(); // actorId -> [{taskId, start, end}]
        for (const [taskId, timing] of taskTiming.entries()) {
            const task = taskById.get(taskId);
            if (!task) continue;
            const actorId = ensureString(task.actor_id);
            if (!safeTrim(actorId)) continue;
            if (!tasksByActor.has(actorId)) tasksByActor.set(actorId, []);
            tasksByActor.get(actorId).push({ taskId, start: timing.startMinutes, end: timing.endMinutes, index: timing.index });
        }

        for (const [actorId, items] of tasksByActor.entries()) {
            items.sort((a, b) => (a.start - b.start) || (a.index - b.index));
            for (let i = 1; i < items.length; i += 1) {
                const prev = items[i - 1];
                const cur = items[i];
                if (cur.start < prev.end) {
                    problems.push(buildProblem(
                        'temporal.scheduling.actor_overlap',
                        'error',
                        'Actor Overlap',
                        `Actor '${actorId}' has overlapping tasks: '${prev.taskId}' overlaps '${cur.taskId}'.`,
                        tasksBaseInstance,
                        { actor_id: actorId, task_a: prev.taskId, task_b: cur.taskId },
                        ['Adjust start times/durations to remove the overlap.', 'Assign one task to a different performer object.']
                    ));
                }
            }
        }

        // 2) dependency timing violations (best-effort)
        for (let i = 0; i < tasks.length; i += 1) {
            const task = tasks[i];
            if (!isPlainObject(task)) continue;
            const id = safeTrim(task.id);
            if (!id) continue;
            const timing = taskTiming.get(id);
            if (!timing) continue;

            const depends = task.depends_on;
            const allDeps = [];
            const anyDeps = [];
            if (Array.isArray(depends)) {
                allDeps.push(...depends.map((d) => safeTrim(d)).filter(Boolean));
            } else if (isPlainObject(depends)) {
                if (Array.isArray(depends.all)) allDeps.push(...depends.all.map((d) => safeTrim(d)).filter(Boolean));
                if (Array.isArray(depends.any)) anyDeps.push(...depends.any.map((d) => safeTrim(d)).filter(Boolean));
            }

            if (allDeps.length === 0 && anyDeps.length === 0) continue;

            let requiredEnd = 0;
            if (allDeps.length > 0) {
                const ends = allDeps.map((depId) => taskTiming.get(depId)?.endMinutes).filter((v) => typeof v === 'number');
                if (ends.length > 0) requiredEnd = Math.max(requiredEnd, Math.max(...ends));
            }
            if (anyDeps.length > 0) {
                const ends = anyDeps.map((depId) => taskTiming.get(depId)?.endMinutes).filter((v) => typeof v === 'number');
                if (ends.length > 0) requiredEnd = Math.max(requiredEnd, Math.min(...ends));
            }

            if (timing.startMinutes < requiredEnd) {
                problems.push(buildProblem(
                    'temporal.scheduling.dependency_violation',
                    'error',
                    'Dependency Violation',
                    `Task '${id}' starts before its dependency condition is satisfied.`,
                    toJsonPointer(tasksBasePtr.concat([i, 'start'])),
                    { task_id: id, start_minutes: timing.startMinutes, required_end_minutes: requiredEnd },
                    ['Move the task start time later.', 'Shorten dependency durations or adjust dependencies.']
                ));
            }
        }

        // Recipe validation (optional warnings)
        if (recipeDefinitions) {
            for (let i = 0; i < tasks.length; i += 1) {
                const task = tasks[i];
                if (!isPlainObject(task)) continue;
                const taskId = safeTrim(task.id);
                if (!taskId) continue;
                if (!Array.isArray(task.interactions)) continue;

                const produced = new Map(); // productId -> producedQuantity
                const consumed = new Map(); // resourceId -> consumedQuantity (positive number)

                for (const interaction of task.interactions) {
                    if (!isPlainObject(interaction) || safeTrim(interaction.action)) continue;
                    const targetId = safeTrim(interaction.target_id);
                    if (!targetId) continue;
                    if (!isPlainObject(interaction.property_changes)) continue;
                    const qChange = interaction.property_changes.quantity;
                    if (!isPlainObject(qChange)) continue;
                    if (Object.prototype.hasOwnProperty.call(qChange, 'delta') && typeof qChange.delta === 'number') {
                        if (qChange.delta > 0) {
                            produced.set(targetId, (produced.get(targetId) || 0) + qChange.delta);
                        } else if (qChange.delta < 0) {
                            consumed.set(targetId, (consumed.get(targetId) || 0) + Math.abs(qChange.delta));
                        }
                    }
                }

                for (const [productId] of produced.entries()) {
                    const recipe = recipeDefinitions[productId];
                    if (!isPlainObject(recipe) || !isPlainObject(recipe.inputs)) continue;
                    const missing = [];
                    for (const [inputId, requiredQty] of Object.entries(recipe.inputs)) {
                        const req = typeof requiredQty === 'number' ? requiredQty : null;
                        if (req === null || req <= 0) continue;
                        const used = consumed.get(inputId) || 0;
                        if (used < req) missing.push(inputId);
                    }
                    if (missing.length > 0) {
                        problems.push(buildProblem(
                            'recipe.compliance.missing_inputs',
                            'warning',
                            'Recipe Violation',
                            `Task '${taskId}' produces '${productId}' but is missing required recipe inputs: ${missing.join(', ')}.`,
                            toJsonPointer(tasksBasePtr.concat([i])),
                            { task_id: taskId, product_id: productId, missing_inputs: missing },
                            ['Add consumption interactions for the missing inputs.', 'Or update/remove the recipe if it does not apply.']
                        ));
                    }
                }
            }
        }

        // Resource flow: negative stock (best-effort sequential application by start time)
        const quantities = new Map(); // objectId -> quantity
        for (let i = 0; i < objects.length; i += 1) {
            const obj = objects[i];
            if (!isPlainObject(obj)) continue;
            const id = safeTrim(obj.id);
            if (!id) continue;
            const type = safeTrim(obj.type);
            const props = isPlainObject(obj.properties) ? obj.properties : {};
            if (type === 'resource' || type === 'product') {
                if (typeof props.quantity === 'number' && Number.isFinite(props.quantity)) {
                    quantities.set(id, props.quantity);
                }
            }
        }

        const tasksInOrder = [...taskTiming.entries()]
            .map(([taskId, timing]) => ({ taskId, ...timing }))
            .sort((a, b) => (a.startMinutes - b.startMinutes) || (a.index - b.index));

        for (const entry of tasksInOrder) {
            const task = taskById.get(entry.taskId);
            if (!task || !Array.isArray(task.interactions)) continue;

            for (const interaction of task.interactions) {
                if (!isPlainObject(interaction) || safeTrim(interaction.action)) continue;
                const targetId = safeTrim(interaction.target_id);
                if (!targetId) continue;
                if (!isPlainObject(interaction.property_changes)) continue;
                const qOp = interaction.property_changes.quantity;
                if (!isPlainObject(qOp)) continue;

                let delta = null;
                if (Object.prototype.hasOwnProperty.call(qOp, 'delta') && typeof qOp.delta === 'number' && Number.isFinite(qOp.delta)) {
                    delta = qOp.delta;
                } else if (qOp.increment === true) {
                    delta = 1;
                } else if (qOp.decrement === true) {
                    delta = -1;
                }

                if (delta === null) continue;

                if (!quantities.has(targetId)) continue;
                const before = quantities.get(targetId);
                const after = before + delta;
                quantities.set(targetId, after);

                if (after < 0) {
                    problems.push(buildProblem(
                        'resource.flow.negative_stock',
                        'error',
                        'Negative Stock',
                        `Resource '${targetId}' goes negative (${before} -> ${after}) in task '${entry.taskId}'.`,
                        tasksBaseInstance,
                        { task_id: entry.taskId, object_id: targetId, before, delta, after },
                        ['Increase the starting quantity for this resource.', 'Reduce consumption deltas, or add production earlier.']
                    ));
                }
            }
        }

        // Economic: negative margin (warning)
        try {
            let totalLaborCost = 0;
            let totalMaterialCost = 0;
            let totalRevenue = 0;

            for (let i = 0; i < tasksInOrder.length; i += 1) {
                const entry = tasksInOrder[i];
                const task = taskById.get(entry.taskId);
                if (!task) continue;

                const durationMinutes = taskTiming.get(entry.taskId)?.endMinutes - taskTiming.get(entry.taskId)?.startMinutes;
                const hours = (typeof durationMinutes === 'number' && Number.isFinite(durationMinutes)) ? (durationMinutes / 60) : 0;

                const actorId = safeTrim(task.actor_id);
                if (actorId && objectById.has(actorId)) {
                    const performer = objectById.get(actorId);
                    const props = isPlainObject(performer.properties) ? performer.properties : {};
                    const costPerHour = typeof props.cost_per_hour === 'number' ? props.cost_per_hour : 0;
                    const overheadRate = typeof props.overhead_rate === 'number' ? props.overhead_rate : 0;
                    const effectiveCostPerHour = costPerHour * (1 + (Number.isFinite(overheadRate) ? overheadRate : 0));
                    totalLaborCost += effectiveCostPerHour * hours;

                    const depreciationPerHour = typeof props.depreciation_per_hour === 'number' ? props.depreciation_per_hour : 0;
                    totalLaborCost += depreciationPerHour * hours;
                }

                if (!Array.isArray(task.interactions)) continue;
                for (const interaction of task.interactions) {
                    if (!isPlainObject(interaction) || safeTrim(interaction.action)) continue;
                    const targetId = safeTrim(interaction.target_id);
                    if (!targetId || !objectById.has(targetId)) continue;
                    const obj = objectById.get(targetId);
                    const type = safeTrim(obj.type);
                    const props = isPlainObject(obj.properties) ? obj.properties : {};
                    const qOp = interaction.property_changes?.quantity;
                    if (!isPlainObject(qOp) || typeof qOp.delta !== 'number') continue;

                    if (qOp.delta < 0 && type === 'resource') {
                        const unitCost = typeof props.cost_per_unit === 'number' ? props.cost_per_unit : 0;
                        totalMaterialCost += Math.abs(qOp.delta) * unitCost;
                    }

                    if (qOp.delta > 0 && type === 'product') {
                        const unitRevenue = typeof props.revenue_per_unit === 'number' ? props.revenue_per_unit : 0;
                        totalRevenue += qOp.delta * unitRevenue;
                    }
                }
            }

            const grossProfit = totalRevenue - totalLaborCost - totalMaterialCost;
            if (Number.isFinite(grossProfit) && grossProfit < 0) {
                problems.push(buildProblem(
                    'economic.profitability.negative_margin',
                    'warning',
                    'Negative Profitability',
                    `Simulation gross profit is negative (${grossProfit.toFixed(2)}).`,
                    '/simulation',
                    { total_labor_cost: totalLaborCost, total_material_cost: totalMaterialCost, total_revenue: totalRevenue, gross_profit: grossProfit },
                    ['Adjust costs/revenue on objects, reduce task durations, or reduce resource consumption.', 'Confirm the units/currency settings are correct.']
                ));
            }
        } catch (error) {
            problems.push(buildProblem(
                'system.error',
                'warning',
                'Economic Validation Error',
                `Economic validation failed: ${error && error.message ? error.message : String(error)}`,
                '/simulation',
                { error: error && error.message ? error.message : String(error) },
                ['Fix validation errors first, then re-run.', 'If this persists, simplify the document and try again.']
            ));
        }

        // Unused resources (info)
        const allInteractionTargets = new Set([...referencedObjectIds]);
        if (recipeDefinitions) {
            for (const recipe of Object.values(recipeDefinitions)) {
                if (!isPlainObject(recipe) || !isPlainObject(recipe.inputs)) continue;
                for (const inputId of Object.keys(recipe.inputs)) {
                    allInteractionTargets.add(inputId);
                }
            }
        }

        for (let i = 0; i < objects.length; i += 1) {
            const obj = objects[i];
            if (!isPlainObject(obj)) continue;
            const id = safeTrim(obj.id);
            const type = safeTrim(obj.type);
            if (!id || type !== 'resource') continue;
            if (!allInteractionTargets.has(id)) {
                problems.push(buildProblem(
                    'object.optimization.unused_resource',
                    'info',
                    'Unused Resource',
                    `Resource '${id}' is defined but never used by any task.`,
                    toJsonPointer(objectsBasePtr.concat([i])),
                    { object_id: id },
                    ['Remove the unused resource, or add tasks/interactions that consume it.']
                ));
            }
        }

        const ok = problems.every((p) => p.severity !== 'error');
        return { ok, problems };
    }

    const api = {
        validate,
        parseDurationToMinutes,
        parseTaskStart,
        parseStrictTimeStringToMinutes,
        SUPPORTED_SCHEMA_VERSIONS,
        WORKSPEC_NAMESPACE
    };

    if (typeof window !== 'undefined') {
        window.WorkSpecValidator = api;
    }

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }
})();
