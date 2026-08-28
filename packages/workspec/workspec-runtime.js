// WorkSpec 2.1 authoritative evaluator/runtime.
// Dependency-free UMD module shared by Node, the CLI, Studio, playback and State Visuals.
(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root) root.WorkSpecRuntime = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    const NS = 'https://universalautomation.wiki/workspec';
    const COMPARISONS = new Set(['==', '!=', '<', '<=', '>', '>=']);
    const ARITHMETIC = new Set(['+', '-', '*', '/', 'min', 'max']);
    const MEMBER_QUANTIFIERS = new Set(['all_members', 'any_members', 'no_members']);
    const OBJECT_FIELDS = new Set(['id', 'type', 'name', 'emoji', 'location', 'state_library', 'appearance']);
    const TASK_FIELDS = new Set(['id', 'actor_id', 'start', 'end', 'duration', 'location', 'description', 'priority', 'tags', 'status', 'actual_end', 'progress']);
    const TERMINAL_TASK_STATES = new Set(['completed', 'skipped', 'blocked', 'interrupted', 'cancelled']);
    const LOCATION_FIELDS = new Set(['id', 'name', 'parent_id', 'shape', 'coordinates', 'position', 'emoji']);
    const COMPACT_ENTITY_ID = /^[a-z][a-z0-9_]*(?::[a-z][a-z0-9_]*)?$/;

    const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
    const plain = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
    const clone = (value) => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
    const ptrEscape = (value) => String(value).replace(/~/g, '~0').replace(/\//g, '~1');
    const pointer = (parts) => '/' + parts.map(ptrEscape).join('/');
    const simOf = (documentValue) => plain(documentValue && documentValue.simulation) ? documentValue.simulation : documentValue;

    function problem(metricId, detail, instance, context, severity, suggestions) {
        return {
            type: `${NS}/errors/${metricId}`,
            title: metricId.split('.').map((part) => part.replace(/_/g, ' ')).join(' '),
            severity: severity || 'error',
            detail,
            instance: instance || '/',
            metric_id: metricId,
            context: context || {},
            suggestions: Array.isArray(suggestions) ? suggestions : []
        };
    }

    function parseDurationToMinutes(value, unit) {
        if (typeof value === 'number') {
            if (!Number.isInteger(value) || value <= 0) return { ok: false, minutes: null };
            const factor = unit === 'seconds' ? 1 / 60 : unit === 'hours' ? 60 : unit === 'minutes' ? 1 : null;
            return factor === null ? { ok: false, minutes: null } : { ok: true, minutes: value * factor };
        }
        if (typeof value !== 'string') return { ok: false, minutes: null };
        const shorthand = value.match(/^([0-9]+(?:\.[0-9]+)?)([smhdwWM])$/);
        if (shorthand) {
            const amount = Number(shorthand[1]);
            const factors = { s: 1 / 60, m: 1, h: 60, d: 1440, w: 10080, W: 10080, M: 43200 };
            return amount > 0 ? { ok: true, minutes: amount * factors[shorthand[2]] } : { ok: false, minutes: null };
        }
        const iso = value.toUpperCase().match(/^P(?:(\d+)Y)?(?:(\d+)M)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/);
        if (!iso) return { ok: false, minutes: null };
        const parts = iso.slice(1).map((v) => Number(v || 0));
        const minutes = parts[0] * 525600 + parts[1] * 43200 + parts[2] * 1440 + parts[3] * 60 + parts[4] + parts[5] / 60;
        return minutes > 0 ? { ok: true, minutes } : { ok: false, minutes: null };
    }

    function parseTime(value) {
        if (typeof value !== 'string') return null;
        const match = value.match(/^([01][0-9]|2[0-3]):([0-5][0-9])(?::([0-5][0-9]))?$/);
        if (match) return Number(match[1]) * 60 + Number(match[2]) + Number(match[3] || 0) / 60;
        const ms = Date.parse(value);
        return Number.isFinite(ms) ? ms / 60000 : null;
    }

    function parseTaskStart(value) {
        if (plain(value) && Number.isInteger(value.day) && value.day > 0) {
            const base = parseTime(value.time);
            return base === null ? { ok: false } : { ok: true, startMinutes: (value.day - 1) * 1440 + base, kind: 'daytime' };
        }
        const minutes = parseTime(value);
        return minutes === null ? { ok: false } : { ok: true, startMinutes: minutes, kind: String(value).includes('T') ? 'datetime' : 'time' };
    }

    function parseOffset(value, unit) {
        if (value === 0 || value === '0m' || value === 'PT0M') return { ok: true, minutes: 0 };
        if (typeof value === 'number') {
            if (!Number.isInteger(value)) return { ok: false, minutes: null };
            const factor = unit === 'seconds' ? 1 / 60 : unit === 'hours' ? 60 : unit === 'minutes' ? 1 : null;
            return factor === null ? { ok: false, minutes: null } : { ok: true, minutes: value * factor };
        }
        const negative = typeof value === 'string' && value.startsWith('-');
        const parsed = parseDurationToMinutes(negative ? value.slice(1) : value, unit);
        return parsed.ok ? { ok: true, minutes: negative ? -parsed.minutes : parsed.minutes } : { ok: false, minutes: null };
    }

    function kindOf(value) {
        if (value === null) return 'null';
        if (Array.isArray(value)) return 'array';
        return typeof value === 'object' ? 'object' : typeof value;
    }

    function result(value, kind) { return { ok: true, value: clone(value), kind: kind || kindOf(value) }; }
    function failure(metricId, detail, instance, context, suggestions) { return { ok: false, problem: problem(metricId, detail, instance, context, undefined, suggestions) }; }

    const STRUCTURED_REFERENCE_KEYS = new Set(['object', 'task', 'location', 'clock', 'field', 'property', 'literal']);

    function compactReference(entity, member) { return `@${entity}.${member}`; }

    function formatCompactReference(entity, member) {
        if (typeof entity !== 'string' || !COMPACT_ENTITY_ID.test(entity) || entity === 'now') throw new TypeError('Compact reference entity must be a valid entity ID other than now.');
        if (typeof member !== 'string' || !member || member.includes('.') || member.includes('@')) throw new TypeError('Compact reference member must be a non-empty direct member without dots.');
        return compactReference(entity, member);
    }

    // Every ValueExpression consumer calls this normalizer. Compact and legacy
    // structured forms therefore share one evaluator and one semantic shape.
    function normalizeValueExpression(value) {
        if (typeof value === 'string') {
            if (value.startsWith('@@')) return { ok: true, kind: 'literal', value: value.slice(1), escaped: true };
            if (!value.startsWith('@')) return { ok: true, kind: 'literal', value };
            if (value === '@now') return { ok: true, kind: 'reference', reference: { clock: 'now', syntax: 'compact' } };
            if (value.startsWith('@now.')) {
                return { ok: false, metric_id: 'reference.clock.invalid', detail: "'@now' is the only clock form; it cannot have a member.", suggestions: ['Use "@now".'] };
            }
            const body = value.slice(1);
            const firstDot = body.indexOf('.');
            if (firstDot <= 0 || firstDot !== body.lastIndexOf('.') || firstDot === body.length - 1) {
                return {
                    ok: false,
                    metric_id: 'reference.compact.grammar',
                    detail: `Invalid compact reference '${value}'. Compact references contain exactly one dot: @entity.member.`,
                    suggestions: ['Use compact syntax such as "@shipment.temperature". Nested paths are not supported.']
                };
            }
            const entity = body.slice(0, firstDot); const member = body.slice(firstDot + 1);
            if (!COMPACT_ENTITY_ID.test(entity) || member.includes('@') || !member) {
                return {
                    ok: false,
                    metric_id: 'reference.compact.grammar',
                    detail: `Invalid compact reference '${value}'.`,
                    suggestions: ['Use compact syntax such as "@shipment.temperature".']
                };
            }
            return { ok: true, kind: 'reference', reference: { entity, member, mode: 'auto', syntax: 'compact' } };
        }

        if (!plain(value)) return { ok: true, kind: 'literal', value };
        const keys = Object.keys(value);
        if (keys.length === 1 && ARITHMETIC.has(keys[0])) {
            return { ok: true, kind: 'derived', operator: keys[0], operands: value[keys[0]] };
        }
        if (keys.length === 1 && own(value, 'count_members')) {
            return { ok: true, kind: 'count_members', specification: value.count_members };
        }
        if (keys.length === 1 && own(value, 'select_member')) {
            return { ok: true, kind: 'select_member', specification: value.select_member };
        }
        if (keys.length === 1 && own(value, 'literal')) return { ok: true, kind: 'literal', value: value.literal, wrapped: true };
        if (keys.length === 1 && own(value, 'clock')) {
            if (value.clock === 'now') return { ok: true, kind: 'reference', reference: { clock: 'now', syntax: 'structured' } };
            return { ok: false, metric_id: 'reference.clock.invalid', detail: "The only clock reference is '@now'.", suggestions: ['Use "@now".'] };
        }

        const selectorKeys = ['object', 'task', 'location'].filter((key) => own(value, key));
        const memberKeys = ['field', 'property'].filter((key) => own(value, key));
        if (keys.length === 2 && selectorKeys.length === 1 && memberKeys.length === 1) {
            const selector = selectorKeys[0]; const mode = memberKeys[0];
            const entity = value[selector]; const member = value[mode];
            const validKinds = selector !== 'task' || mode === 'field';
            if (validKinds && typeof entity === 'string' && entity && typeof member === 'string' && member && !member.includes('.')) {
                return { ok: true, kind: 'reference', reference: { entity, member, mode, selector, syntax: 'structured' } };
            }
        }

        // An object with an unrelated extra key is an ordinary object literal,
        // even if two of its keys happen to resemble a compatibility reference.
        const allKeysAreReferenceKeys = keys.length > 0 && keys.every((key) => STRUCTURED_REFERENCE_KEYS.has(key));
        if (allKeysAreReferenceKeys && keys.some((key) => key !== 'literal')) {
            return {
                ok: false,
                metric_id: 'reference.structured.malformed',
                detail: 'Malformed structured compatibility reference.',
                suggestions: ['Use compact syntax such as "@shipment.temperature".']
            };
        }
        return { ok: true, kind: 'literal', value };
    }

    function isValueReference(value) {
        const normalized = normalizeValueExpression(value);
        return normalized.ok && normalized.kind === 'reference';
    }

    function referenceIdentity(reference) {
        if (reference.clock) return '@now';
        if (reference.entity === 'current' && reference.syntax === 'structured' && reference.selector === 'task') return '@$current_task.' + reference.member;
        return compactReference(reference.entity, reference.member);
    }

    function collectEntities(documentValue) {
        const sim = simOf(documentValue) || {};
        const entities = [];
        const add = (entity, kind, parts) => {
            if (plain(entity) && typeof entity.id === 'string' && entity.id) entities.push({ entity, kind, parts });
        };
        add(sim.meta, 'simulation', ['simulation', 'meta']);
        const world = sim.world || {};
        const mainLocations = (world.layout && world.layout.locations) || ((sim.layout && sim.layout.locations) || []);
        const mainObjects = (world.objects && world.objects.length ? world.objects : (sim.objects || []));
        mainLocations.forEach((e, i) => add(e, 'location', ['simulation', 'world', 'layout', 'locations', i]));
        mainObjects.forEach((e, i) => add(e, 'object', ['simulation', 'world', 'objects', i]));
        const tasks = ((sim.process && sim.process.tasks) && sim.process.tasks.length ? sim.process.tasks : (sim.tasks || []));
        tasks.forEach((e, i) => {
            add(e, 'task', ['simulation', 'process', 'tasks', i]);
            (e.interactions || []).forEach((interaction, j) => {
                if (interaction && interaction.action === 'create') add(interaction.object, 'object', ['simulation', 'process', 'tasks', i, 'interactions', j, 'object']);
            });
        });
        Object.entries(sim.day_types || {}).forEach(([key, dayType]) => {
            (dayType.locations || []).forEach((e, i) => add(e, 'location', ['simulation', 'day_types', key, 'locations', i]));
            (dayType.objects || []).forEach((e, i) => add(e, 'object', ['simulation', 'day_types', key, 'objects', i]));
            (dayType.tasks || []).forEach((e, i) => add(e, 'task', ['simulation', 'day_types', key, 'tasks', i]));
        });
        const digital = sim.digital_space || {};
        (digital.digital_locations || digital.locations || []).forEach((e, i) => add(e, 'digital_location', ['simulation', 'digital_space', 'digital_locations', i]));
        (digital.digital_objects || digital.objects || []).forEach((e, i) => add(e, 'digital_object', ['simulation', 'digital_space', 'digital_objects', i]));
        (digital.connections || []).forEach((e, i) => add(e, 'connection', ['simulation', 'digital_space', 'connections', i]));
        (digital.data_flows || []).forEach((e, i) => add(e, 'data_flow', ['simulation', 'digital_space', 'data_flows', i]));
        (sim.displays || world.displays || []).forEach((display, i) => {
            add(display, 'display', ['simulation', 'displays', i]);
            (display.rectangles || display.elements || []).forEach((e, j) => add(e, 'display_element', ['simulation', 'displays', i, 'rectangles', j]));
            (((display.navigation || {}).screens) || display.navigation_screens || []).forEach((e, j) => add(e, 'display_screen', ['simulation', 'displays', i, 'navigation', 'screens', j]));
        });
        return entities;
    }

    function buildIndex(documentValue) {
        const sim = simOf(documentValue) || {};
        const problems = [];
        const ids = new Map();
        collectEntities(documentValue).forEach((entry) => {
            if (entry.entity.id === 'current') {
                problems.push(problem('reference.id.reserved_current', "The exact entity id 'current' is reserved.", pointer(entry.parts.concat('id')), { id: 'current', kind: entry.kind }));
            }
            if (ids.has(entry.entity.id)) {
                const first = ids.get(entry.entity.id);
                problems.push(problem('reference.id.duplicate', `Entity id '${entry.entity.id}' is used by both a ${first.kind} and a ${entry.kind}.`, pointer(entry.parts.concat('id')), { id: entry.entity.id, first_kind: first.kind, second_kind: entry.kind }));
            } else ids.set(entry.entity.id, entry);
        });
        const world = sim.world || {};
        const objectList = world.objects && world.objects.length ? world.objects : (sim.objects || []);
        const locationList = (world.layout && world.layout.locations) || ((sim.layout && sim.layout.locations) || []);
        const taskList = (sim.process && sim.process.tasks && sim.process.tasks.length) ? sim.process.tasks : (sim.tasks || []);
        const objects = new Map(objectList.map((entity) => [entity.id, clone(entity)]));
        const locations = new Map(locationList.map((entity) => [entity.id, clone(entity)]));
        const tasks = new Map(taskList.map((entity) => [entity.id, entity]));
        const tasksBase = (sim.process && sim.process.tasks && sim.process.tasks.length)
            ? '/simulation/process/tasks'
            : '/simulation/tasks';
        return { sim, ids, objects, locations, tasks, tasksBase, problems };
    }

    function makeInitialState(index) {
        return {
            objects: new Map([...index.objects].map(([id, value]) => [id, clone(value)])),
            locations: new Map([...index.locations].map(([id, value]) => [id, clone(value)])),
            kinds: new Map(),
            statuses: new Map([...index.tasks.keys()].map((id) => [id, 'pending'])),
            taskRuntime: new Map([...index.tasks.keys()].map((id) => [id, { actual_end: undefined, progress: undefined }])),
            active: new Map(),
            reservations: [],
            temporary: new Map()
        };
    }

    function cloneState(state) {
        return {
            objects: new Map([...state.objects].map(([id, value]) => [id, clone(value)])),
            locations: new Map([...state.locations].map(([id, value]) => [id, clone(value)])),
            kinds: new Map(state.kinds), statuses: new Map(state.statuses), active: new Map(state.active),
            taskRuntime: new Map([...state.taskRuntime].map(([id, value]) => [id, clone(value)])),
            reservations: clone(state.reservations), temporary: new Map([...state.temporary].map(([id, value]) => [id, clone(value)]))
        };
    }

    function entityFor(reference, context) {
        let id = reference.entity;
        let kind = reference.selector;
        const bound = context.bindings && context.bindings[id];
        if (bound) {
            id = typeof bound === 'string' ? bound : bound.id;
            kind = typeof bound === 'string' ? undefined : bound.kind;
        }
        if (id === 'current') {
            if (!context.currentTask) return failure('reference.current.unavailable', "'@current' requires a current task performer.", context.instance, {}, ['Use "@current.member" only inside a task expression.']);
            if (reference.syntax === 'structured' && reference.selector === 'task') {
                id = context.currentTask.id; kind = 'task';
            } else {
                id = context.currentTask.__selected_actor_id || context.currentTask.actor_id; kind = 'object';
            }
        }

        if (!kind) {
            const declared = context.index.ids.get(id);
            if (!declared) return failure('reference.entity.unknown', `Unknown entity '${id}'.`, context.instance, { entity_id: id }, [`Declare '${id}' or use a reference such as "${compactReference(id, reference.member)}" with an existing entity ID.`]);
            kind = declared.kind;
        }

        let entity = null; let allowlist = null;
        if (kind === 'object') { entity = context.state.objects.get(id); allowlist = OBJECT_FIELDS; }
        else if (kind === 'location') { entity = context.state.locations.get(id); allowlist = LOCATION_FIELDS; }
        else if (kind === 'task') { entity = context.index.tasks.get(id); allowlist = TASK_FIELDS; }
        else return failure('reference.entity.unsupported', `Entity '${id}' is a ${kind}, which is not referenceable in ValueExpression positions.`, context.instance, { entity_id: id, kind });

        if (!entity) {
            const declared = context.index.ids.get(id);
            const detail = declared
                ? `Entity '${id}' is not available at this point in the simulation.`
                : `Unknown entity '${id}'.`;
            return failure(declared ? 'reference.entity.unavailable' : 'reference.entity.unknown', detail, context.instance, { entity_id: id });
        }
        return { ok: true, entity, id, kind, allowlist };
    }

    function evaluateValue(expression, context) {
        const normalized = normalizeValueExpression(expression);
        if (!normalized.ok) return failure(normalized.metric_id, normalized.detail, context.instance, {}, normalized.suggestions);
        if (normalized.kind === 'literal') return result(normalized.value);
        if (normalized.kind === 'derived') {
            if (!Array.isArray(normalized.operands) || normalized.operands.length < 2) return failure('value.arithmetic.arity', `Arithmetic operator '${normalized.operator}' requires at least two operands.`, context.instance);
            const values = normalized.operands.map((operand, index) => evaluateValue(operand, { ...context, instance: `${context.instance}/${normalized.operator}/${index}` }));
            const failed = values.find((entry) => !entry.ok); if (failed) return failed;
            if (values.some((entry) => entry.kind !== 'number' || !Number.isFinite(entry.value))) return failure('value.arithmetic.type', `Arithmetic operator '${normalized.operator}' requires finite numeric operands.`, context.instance);
            if (normalized.operator === '/' && values.slice(1).some((entry) => entry.value === 0)) return failure('value.arithmetic.division_by_zero', 'Division by zero is not allowed.', context.instance);
            let computed;
            if (normalized.operator === '+') computed = values.reduce((sum, entry) => sum + entry.value, 0);
            else if (normalized.operator === '-') computed = values.slice(1).reduce((value, entry) => value - entry.value, values[0].value);
            else if (normalized.operator === '*') computed = values.reduce((value, entry) => value * entry.value, 1);
            else if (normalized.operator === '/') computed = values.slice(1).reduce((value, entry) => value / entry.value, values[0].value);
            else if (normalized.operator === 'min') computed = Math.min(...values.map((entry) => entry.value));
            else computed = Math.max(...values.map((entry) => entry.value));
            return Number.isFinite(computed) ? result(computed, 'number') : failure('value.arithmetic.non_finite', 'Arithmetic result must be finite.', context.instance);
        }
        if (normalized.kind === 'count_members') {
            const members = evaluateCollectionPredicate(normalized.specification, context, 'where');
            return members.ok ? result(members.matches.length, 'number') : members;
        }
        if (normalized.kind === 'select_member') return selectCollectionMember(normalized.specification, context);
        const reference = normalized.reference;
        if (reference.clock === 'now') return result(context.now, 'instant');
        const selected = entityFor(reference, context);
        if (!selected.ok) return selected;
        const member = reference.member;
        const useBuiltIn = reference.mode === 'field' || (reference.mode === 'auto' && selected.allowlist.has(member));
        if (useBuiltIn) {
            if (!selected.allowlist.has(member)) return failure('reference.member.unknown', `Unknown member '${member}' on ${selected.kind} '${selected.id}'.`, context.instance, { member, kind: selected.kind }, [`Use "${compactReference(selected.id, member)}" with an allowed built-in field or direct property.`]);
            if (selected.kind === 'task') {
                const timing = context.timings.get(selected.id);
                if (member === 'end') return result(timing && timing.end, 'instant');
                if (member === 'start') return result(timing && timing.start, 'instant');
                if (member === 'duration') return result(timing && timing.duration, 'duration');
                if (member === 'actor_id') return result(selected.entity.__selected_actor_id || selected.entity.actor_id, 'string');
                if (member === 'status') return result(context.state.statuses.get(selected.id), 'string');
                if (member === 'actual_end') {
                    const value = context.state.taskRuntime.get(selected.id)?.actual_end;
                    return value === undefined ? failure('reference.task.actual_end.unresolved', `Task '${selected.id}' has not terminated, so actual_end is unresolved.`, context.instance, { task_id: selected.id }) : result(value, 'instant');
                }
                if (member === 'progress') {
                    if (!own(selected.entity, 'progress')) return failure('reference.task.progress.undeclared', `Task '${selected.id}' has no progress declaration.`, context.instance, { task_id: selected.id });
                    const value = context.state.taskRuntime.get(selected.id)?.progress;
                    return value === undefined ? failure('reference.task.progress.unresolved', `Task '${selected.id}' has not terminated, so progress is unresolved.`, context.instance, { task_id: selected.id }) : result(value);
                }
            }
            if (!own(selected.entity, member)) return failure('reference.member.missing', `${selected.kind} '${selected.id}' has no built-in field '${member}' value.`, context.instance, { member, kind: selected.kind });
            return result(selected.entity[member]);
        }
        if (selected.kind === 'task') return failure('reference.member.unknown', `Unknown member '${member}' on task '${selected.id}'.`, context.instance, { member, kind: selected.kind }, [`Use an allowed task field such as "${compactReference(selected.id, 'end')}".`]);
        const properties = plain(selected.entity.properties) ? selected.entity.properties : {};
        if (!own(properties, member)) return failure('reference.member.unknown', `Unknown member '${member}' on ${selected.kind} '${selected.id}'.`, context.instance, { member, kind: selected.kind }, [`Use "${compactReference(selected.id, member)}" with an existing direct property.`]);
        const propertyKind = context.state.kinds.get(`${selected.kind}:${selected.id}:${member}`);
        if (!propertyKind && typeof properties[member] === 'string') {
            const instant = parseTime(properties[member]);
            if (instant !== null) return result(instant, 'instant');
        }
        return result(properties[member], propertyKind);
    }

    function equalValues(left, right) {
        if (left.kind !== right.kind) return null;
        if (left.kind === 'object' || left.kind === 'array') return JSON.stringify(left.value) === JSON.stringify(right.value);
        return left.value === right.value;
    }

    function collectionDefinition(index, collectionId) {
        const collections = plain(index.sim.collections) ? index.sim.collections : {};
        return plain(collections[collectionId]) ? collections[collectionId] : null;
    }

    function collectionMembers(collectionId, context) {
        const definition = collectionDefinition(context.index, collectionId);
        if (!definition) return failure('collection.reference.unknown', `Unknown runtime collection '${collectionId}'.`, context.instance, { collection: collectionId });
        if (!['objects', 'locations'].includes(definition.from)) return failure('collection.source.invalid', `Collection '${collectionId}' has invalid source '${definition.from}'.`, context.instance, { collection: collectionId });
        if (definition.open === true) {
            const close = parseTaskStart(definition.closes_at);
            if (!close.ok) return failure('collection.cutoff.invalid', `Open collection '${collectionId}' requires a valid closes_at boundary.`, context.instance, { collection: collectionId });
        }
        const source = definition.from === 'objects' ? context.state.objects : context.state.locations;
        const kind = definition.from === 'objects' ? 'object' : 'location';
        const snapshot = [...source.keys()].sort().map((id) => ({ id, kind }));
        if (definition.where === undefined) return { ok: true, members: snapshot };
        const alias = definition.as;
        if (typeof alias !== 'string' || !alias || alias === 'current') return failure('collection.binding.invalid', `Collection '${collectionId}' requires a non-current member alias.`, context.instance, { collection: collectionId });
        const matches = [];
        for (const member of snapshot) {
            const local = { ...context, bindings: { ...(context.bindings || {}), [alias]: member } };
            const condition = evaluateCondition(definition.where, local);
            if (!condition.ok) return condition;
            if (condition.value) matches.push(member);
        }
        return { ok: true, members: matches };
    }

    function evaluateCollectionPredicate(specification, context, predicateKey) {
        if (!plain(specification)) return failure('collection.predicate.shape', 'A collection predicate must be an object.', context.instance);
        const collectionId = specification.collection; const alias = specification.as;
        if (typeof collectionId !== 'string' || !collectionId) return failure('collection.reference.invalid', 'A collection predicate requires collection.', context.instance);
        if (typeof alias !== 'string' || !alias || alias === 'current') return failure('collection.binding.invalid', 'A collection predicate requires a distinct member alias.', context.instance);
        const snapshot = collectionMembers(collectionId, context);
        if (!snapshot.ok) return snapshot;
        const predicate = specification[predicateKey];
        const matches = [];
        for (const member of snapshot.members) {
            if (predicate === undefined) { matches.push(member); continue; }
            const local = { ...context, bindings: { ...(context.bindings || {}), [alias]: member } };
            const condition = evaluateCondition(predicate, local);
            if (!condition.ok) return condition;
            if (condition.value) matches.push(member);
        }
        return { ok: true, members: snapshot.members, matches };
    }

    function selectCollectionMember(specification, context) {
        if (!plain(specification)) return failure('actor.selection.shape', 'select_member must be an object.', context.instance);
        const policy = specification.policy;
        if (!['first_by_id', 'lowest', 'highest'].includes(policy)) return failure('actor.selection.policy.invalid', `Unknown deterministic selection policy '${policy}'.`, context.instance);
        if ((policy === 'lowest' || policy === 'highest') && !own(specification, 'by')) return failure('actor.selection.by.missing', `Selection policy '${policy}' requires by.`, context.instance);
        const eligible = evaluateCollectionPredicate(specification, context, 'where');
        if (!eligible.ok) return eligible;
        if (!eligible.matches.length) return failure('actor.selection.empty', `Collection '${specification.collection}' has no eligible member.`, context.instance, { collection: specification.collection });
        if (policy === 'first_by_id') return result(eligible.matches.map((entry) => entry.id).sort()[0], 'string');
        const ranked = [];
        for (const member of eligible.matches) {
            const local = { ...context, bindings: { ...(context.bindings || {}), [specification.as]: member } };
            const value = evaluateValue(specification.by, local);
            if (!value.ok) return value;
            if (value.kind !== 'number' || !Number.isFinite(value.value)) return failure('actor.selection.by.type', `Selection policy '${policy}' requires a finite numeric by value.`, context.instance);
            ranked.push({ member, value: value.value });
        }
        ranked.sort((left, right) => (policy === 'lowest' ? left.value - right.value : right.value - left.value) || left.member.id.localeCompare(right.member.id));
        const tied = ranked.filter((entry) => entry.value === ranked[0].value);
        if (tied.length > 1 && specification.tie_break !== 'stable_id') return failure('actor.selection.tie', `Selection policy '${policy}' has an unresolved tie.`, context.instance, { candidate_ids: tied.map((entry) => entry.member.id) }, ['Declare "tie_break": "stable_id".']);
        return result(ranked[0].member.id, 'string');
    }

    function evaluateCondition(condition, context) {
        if (typeof condition === 'boolean') return result(condition, 'boolean');
        if (!plain(condition)) return failure('condition.shape.invalid', 'A condition must be a boolean or operator object.', context.instance);
        const keys = Object.keys(condition);
        if (keys.length !== 1) return failure('condition.operator.count', 'A condition must contain exactly one operator.', context.instance);
        const operator = keys[0];
        const operands = condition[operator];
        if (COMPARISONS.has(operator) || operator === 'contains') {
            if (!Array.isArray(operands) || operands.length !== 2) return failure('condition.operator.arity', `Operator '${operator}' requires exactly two operands.`, context.instance);
            const left = evaluateValue(operands[0], context); const right = evaluateValue(operands[1], context);
            if (!left.ok) return left; if (!right.ok) return right;
            if (operator === 'contains') {
                if (left.kind === 'array') return result(left.value.some((item) => kindOf(item) === right.kind && JSON.stringify(item) === JSON.stringify(right.value)), 'boolean');
                if (left.kind === 'string' && right.kind === 'string') return result(left.value.includes(right.value), 'boolean');
                return failure('condition.type.incompatible', "'contains' requires an array/member or string/string pair.", context.instance);
            }
            const equality = equalValues(left, right);
            if (equality === null) return failure('condition.type.incompatible', `Cannot compare ${left.kind} with ${right.kind}.`, context.instance);
            if (operator === '==') return result(equality, 'boolean');
            if (operator === '!=') return result(!equality, 'boolean');
            if (!['number', 'instant', 'duration'].includes(left.kind)) return failure('condition.type.incompatible', `Operator '${operator}' requires numbers, instants, or durations of the same type.`, context.instance);
            return result(operator === '<' ? left.value < right.value : operator === '<=' ? left.value <= right.value : operator === '>' ? left.value > right.value : left.value >= right.value, 'boolean');
        }
        if (operator === 'all' || operator === 'any') {
            if (!Array.isArray(operands) || operands.length === 0) return failure('condition.operator.arity', `Operator '${operator}' requires a non-empty array.`, context.instance);
            const values = operands.map((entry) => evaluateCondition(entry, context));
            const failed = values.find((entry) => !entry.ok); if (failed) return failed;
            return result(operator === 'all' ? values.every((entry) => entry.value) : values.some((entry) => entry.value), 'boolean');
        }
        if (MEMBER_QUANTIFIERS.has(operator)) {
            const evaluated = evaluateCollectionPredicate(operands, context, 'satisfy');
            if (!evaluated.ok) return evaluated;
            if (operands.satisfy === undefined) return failure('collection.predicate.missing', `Condition '${operator}' requires satisfy.`, context.instance);
            if (operator === 'all_members') return result(evaluated.matches.length === evaluated.members.length, 'boolean');
            if (operator === 'any_members') return result(evaluated.matches.length > 0, 'boolean');
            return result(evaluated.matches.length === 0, 'boolean');
        }
        if (operator === 'not') {
            const value = evaluateCondition(operands, context); return value.ok ? result(!value.value, 'boolean') : value;
        }
        if (operator === 'held_for') {
            if (!plain(operands) || !own(operands, 'condition') || !own(operands, 'duration')) return failure('condition.held_for.shape', "'held_for' requires condition and duration.", context.instance);
            const duration = parseDurationToMinutes(operands.duration, context.timeUnit);
            if (!duration.ok) return failure('condition.held_for.duration', "'held_for' has an invalid duration.", context.instance);
            const since = context.now - duration.minutes;
            if (since < context.simulationStart) return failure('condition.held_for.history', "'held_for' reaches before available simulation history.", context.instance);
            const samples = (context.history || []).filter((entry) => entry.time >= since && entry.time <= context.now);
            const boundary = [...(context.history || [])].reverse().find((entry) => entry.time <= since);
            if (boundary && !samples.includes(boundary)) samples.unshift(boundary);
            for (const sample of samples) {
                const value = evaluateCondition(operands.condition, { ...context, state: sample.state, now: Math.max(since, sample.time) });
                if (!value.ok || !value.value) return value.ok ? result(false, 'boolean') : value;
            }
            return evaluateCondition(operands.condition, context);
        }
        return failure('condition.operator.invalid', `Unknown condition operator '${operator}'.`, context.instance);
    }

    function dependencyGroups(task) {
        const value = task && task.depends_on;
        if (value === undefined || value === null) return { all: [], any: [], present: false };
        if (Array.isArray(value)) return { all: value, any: [], present: true };
        if (plain(value)) return {
            all: Array.isArray(value.all) ? value.all : [],
            any: Array.isArray(value.any) ? value.any : [],
            present: true
        };
        return { all: [], any: [], present: true };
    }

    function taskTimingReference(expression, index) {
        const normalized = normalizeValueExpression(expression);
        if (!normalized.ok || normalized.kind !== 'reference' || normalized.reference.clock) return null;
        const reference = normalized.reference;
        if (!['start', 'end', 'actual_end'].includes(reference.member)) return null;
        if (reference.member === 'actual_end' && reference.syntax !== 'compact') return null;
        if (reference.entity === 'current') return null;
        if (reference.selector && reference.selector !== 'task') return null;
        const declared = index && index.ids.get(reference.entity);
        if (!declared || declared.kind !== 'task') return null;
        if (reference.mode === 'property') return null;
        return { task: reference.entity, field: reference.member };
    }

    function simpleGuard(condition) {
        if (condition === true || condition === false) return { key: '$literal', operator: '==', value: condition };
        if (!plain(condition) || Object.keys(condition).length !== 1) return null;
        if (own(condition, 'not')) {
            const nested = simpleGuard(condition.not);
            if (!nested) return null;
            return { ...nested, operator: nested.operator === '==' ? '!=' : nested.operator === '!=' ? '==' : nested.operator };
        }
        const operator = Object.keys(condition)[0];
        if (!['==', '!='].includes(operator) || !Array.isArray(condition[operator]) || condition[operator].length !== 2) return null;
        let [reference, literal] = condition[operator];
        let normalizedReference = normalizeValueExpression(reference);
        if (!normalizedReference.ok || normalizedReference.kind !== 'reference') {
            [literal, reference] = [reference, literal];
            normalizedReference = normalizeValueExpression(reference);
        }
        const normalizedLiteral = normalizeValueExpression(literal);
        if (!normalizedReference.ok || normalizedReference.kind !== 'reference' || !normalizedLiteral.ok || normalizedLiteral.kind === 'reference') return null;
        return { key: referenceIdentity(normalizedReference.reference), operator, value: clone(normalizedLiteral.value) };
    }

    function guardsConflict(leftCondition, rightCondition) {
        const left = simpleGuard(leftCondition); const right = simpleGuard(rightCondition);
        if (!left || !right || left.key !== right.key) return false;
        const same = JSON.stringify(left.value) === JSON.stringify(right.value);
        if (left.operator === '==' && right.operator === '==') return !same;
        if (left.operator !== right.operator) return same;
        return false;
    }

    function boundedDependencyProblems(index) {
        const problems = [];
        const entries = [...index.tasks.entries()].filter(([, task]) => !task.__runtime_instance);
        entries.forEach(([id, task], taskIndex) => {
            const groups = dependencyGroups(task); const base = `${index.tasksBase}/${taskIndex}/depends_on`;
            if (Array.isArray(task.depends_on) && task.depends_on.length === 0) {
                problems.push(problem('dependency.group.empty', `Task '${id}' has an empty dependency group. Remove it or add a predecessor.`, base, { task_id: id, group: 'all' }));
            }
            if (plain(task.depends_on)) {
                if (Object.keys(task.depends_on).length === 0) {
                    problems.push(problem('dependency.group.empty', `Task '${id}' has an empty dependency object.`, base, { task_id: id }));
                }
                ['all', 'any'].forEach((group) => {
                    if (own(task.depends_on, group) && Array.isArray(task.depends_on[group]) && task.depends_on[group].length === 0) {
                        problems.push(problem('dependency.group.empty', `Task '${id}' has an empty depends_on.${group} group.`, `${base}/${group}`, { task_id: id, group }));
                    }
                });
            }
            for (let i = 0; i < groups.all.length; i += 1) {
                for (let j = i + 1; j < groups.all.length; j += 1) {
                    const left = index.tasks.get(groups.all[i]); const right = index.tasks.get(groups.all[j]);
                    if (left && right && guardsConflict(left.when, right.when)) {
                        problems.push(problem('dependency.all.mutually_exclusive', `Task '${id}' requires mutually exclusive predecessors '${groups.all[i]}' and '${groups.all[j]}' to both complete. Use depends_on.any when converging alternative branches.`, base, { task_id: id, predecessors: [groups.all[i], groups.all[j]] }));
                    }
                }
            }
            if (groups.all.length === 1 && groups.any.length === 0 && task.when !== undefined) {
                const predecessor = index.tasks.get(groups.all[0]);
                if (predecessor && predecessor.when !== undefined && guardsConflict(task.when, predecessor.when)) {
                    problems.push(problem('dependency.guard.predecessor_skipped', `Task '${id}' can run only when its sole predecessor '${groups.all[0]}' is skipped.`, base, { task_id: id, predecessor: groups.all[0] }));
                }
            }
        });
        return problems;
    }

    function boundedClaimProblems(index) {
        const problems = [];
        const resolution = resolveTimingGraph(index.sim, { index });
        const initial = makeInitialState(index);
        const entries = [...index.tasks.entries()].filter(([, task]) => !task.__runtime_instance);
        const claimsFor = (task, taskIndex, timing) => {
            const claims = [];
            const actor = normalizeValueExpression(task.actor_id);
            if (actor.ok && actor.kind === 'literal' && typeof actor.value === 'string') claims.push({ resource: actor.value, mode: 'exclusive', amount: 1, kind: 'actor', instance: `${index.tasksBase}/${taskIndex}/actor_id` });
            (task.reservations || []).forEach((reservation, reservationIndex) => {
                const context = expressionContext(index, initial, resolution.timings, { ...task, __selected_actor_id: typeof task.actor_id === 'string' ? task.actor_id : undefined }, timing.start, [], `${index.tasksBase}/${taskIndex}/reservations/${reservationIndex}`);
                const resource = evaluateValue(reservation.resource, context);
                const amount = reservation.mode === 'capacity' ? evaluateValue(reservation.amount, context) : result(1, 'number');
                if (resource.ok && resource.kind === 'string' && amount.ok && amount.kind === 'number') claims.push({ resource: resource.value, mode: reservation.mode, amount: amount.value, kind: 'reservation', instance: context.instance });
            });
            return claims;
        };
        for (let leftIndex = 0; leftIndex < entries.length; leftIndex += 1) {
            const [leftId, leftTask] = entries[leftIndex]; const leftTiming = resolution.timings.get(leftId);
            if (!leftTiming?.resolved) continue;
            for (let rightIndex = leftIndex + 1; rightIndex < entries.length; rightIndex += 1) {
                const [rightId, rightTask] = entries[rightIndex]; const rightTiming = resolution.timings.get(rightId);
                if (!rightTiming?.resolved || !(leftTiming.start < rightTiming.end && rightTiming.start < leftTiming.end)) continue;
                if (guardsConflict(leftTask.when, rightTask.when)) continue;
                const leftActor = normalizeValueExpression(leftTask.actor_id); const rightActor = normalizeValueExpression(rightTask.actor_id);
                const leftActorKnown = leftActor.ok && leftActor.kind === 'literal' && typeof leftActor.value === 'string';
                const rightActorKnown = rightActor.ok && rightActor.kind === 'literal' && typeof rightActor.value === 'string';
                if (!leftActorKnown || !rightActorKnown) {
                    problems.push(problem('temporal.scheduling.actor_overlap_possible', `Potentially co-timed tasks '${leftId}' and '${rightId}' use runtime actor bindings whose distinctness cannot be proven statically.`, `${index.tasksBase}/${rightIndex}/actor_id`, { task_a: leftId, task_b: rightId }, 'warning', ['Use mutually exclusive when guards or candidate collections that make the assignments observably distinct.']));
                }
                const claimsLeft = claimsFor(leftTask, leftIndex, leftTiming); const claimsRight = claimsFor(rightTask, rightIndex, rightTiming);
                claimsLeft.forEach((left) => claimsRight.forEach((right) => {
                    if (left.resource !== right.resource) return;
                    const entity = initial.objects.get(left.resource) || initial.locations.get(left.resource);
                    const capacity = entity?.properties?.capacity;
                    const conflicts = left.mode === 'exclusive' || right.mode === 'exclusive' || (left.mode === 'capacity' && right.mode === 'capacity' && typeof capacity === 'number' && left.amount + right.amount > capacity);
                    if (!conflicts) return;
                    const definite = (leftTask.when === undefined || leftTask.when === true) && (rightTask.when === undefined || rightTask.when === true);
                    const actorConflict = left.kind === 'actor' && right.kind === 'actor';
                    const metric = actorConflict ? (definite ? 'temporal.scheduling.actor_overlap' : 'temporal.scheduling.actor_overlap_possible') : (definite ? 'reservation.conflict.authored' : 'reservation.conflict.possible');
                    problems.push(problem(metric, `${definite ? 'Co-timed' : 'Potentially co-timed'} tasks '${leftId}' and '${rightId}' claim '${left.resource}' and are not provably mutually exclusive.`, right.instance, { resource: left.resource, task_a: leftId, task_b: rightId }, definite ? 'error' : 'warning', definite ? [] : ['Use simple mutually exclusive when guards when these tasks are authored alternatives.']));
                }));
            }
        }
        return problems;
    }

    function resolveTimingGraph(documentValue, options) {
        const index = options && options.index ? options.index : buildIndex(documentValue);
        const statuses = options && options.statuses instanceof Map ? options.statuses : null;
        const taskRuntime = options && options.taskRuntime instanceof Map ? options.taskRuntime : null;
        const unit = index.sim.config && index.sim.config.time_unit;
        const timings = new Map(); const problems = []; const taskIndexes = new Map();
        [...index.tasks.entries()].forEach(([id, task], taskIndex) => {
            taskIndexes.set(id, taskIndex);
            const duration = parseDurationToMinutes(task.duration, unit);
            const runtimeStart = Number.isFinite(task.__runtime_start) ? task.__runtime_start : null;
            const authored = own(task, 'start');
            const parsedStart = authored ? parseTaskStart(task.start) : null;
            const timing = {
                task_id: id,
                start: parsedStart && parsedStart.ok ? parsedStart.startMinutes : null,
                end: null,
                completion: null,
                duration: duration.ok ? duration.minutes : null,
                source: runtimeStart !== null ? 'runtime_instance' : authored ? 'explicit' : 'derived',
                start_source: runtimeStart !== null ? 'runtime_instance' : authored ? 'explicit' : 'derived',
                explicit: authored,
                derived: !authored,
                resolved: Boolean(authored && parsedStart && parsedStart.ok && duration.ok),
                lower_bounds: [],
                upper_bounds: [],
                error: null
            };
            if (!duration.ok) timing.error = { metric_id: 'task.integrity.invalid_duration', detail: `Task '${id}' has an invalid duration.` };
            else if (authored && !parsedStart.ok) timing.error = { metric_id: 'task.integrity.invalid_start_time', detail: `Task '${id}' has an invalid explicit start.` };
            if (timing.resolved) timing.end = timing.completion = timing.start + timing.duration;
            timings.set(id, timing);
        });

        const boundFor = (reference, includeInactive = false) => {
            const taskRef = taskTimingReference(reference, index);
            if (!taskRef) return null;
            if (taskRef.field === 'actual_end') {
                const value = taskRuntime && taskRuntime.get(taskRef.task)?.actual_end;
                return value === undefined ? null : value;
            }
            const target = timings.get(taskRef.task);
            if (!target || !target.resolved) return null;
            if (statuses && !includeInactive && statuses.get(taskRef.task) !== 'completed') return null;
            return target[taskRef.field];
        };
        const dependencyBounds = (task) => {
            const groups = dependencyGroups(task); const values = []; const waiting = [];
            for (const id of groups.all) {
                const timing = timings.get(id); const status = statuses && statuses.get(id);
                if (!timing || !timing.resolved || (statuses && status !== 'completed')) waiting.push(id);
                else values.push({ value: timing.end, kind: 'dependency', task: id, group: 'all' });
            }
            if (groups.any.length) {
                const eligible = groups.any
                    .map((id) => ({ id, timing: timings.get(id), status: statuses && statuses.get(id) }))
                    .filter((entry) => entry.timing && entry.timing.resolved && (!statuses || entry.status === 'completed'));
                if (!eligible.length) waiting.push({ any: groups.any });
                else {
                    const earliest = eligible.reduce((best, entry) => entry.timing.end < best.timing.end ? entry : best);
                    values.push({ value: earliest.timing.end, kind: 'dependency', task: earliest.id, group: 'any' });
                }
            }
            return { values, waiting };
        };

        let changed = true;
        for (let pass = 0; changed && pass <= timings.size; pass += 1) {
            changed = false;
            index.tasks.forEach((task, id) => {
                const timing = timings.get(id);
                if (!timing || timing.duration === null) return;
                const deps = dependencyBounds(task); const lower = [...deps.values]; let unresolvedLower = false;
                if (Number.isFinite(task.__runtime_start)) lower.push({ value: task.__runtime_start, kind: 'appearance', correlation_id: task.__correlation_id });
                (task.timing || []).forEach((constraint, constraintIndex) => {
                    if (!plain(constraint) || constraint.relation !== 'offset') return;
                    const reference = taskTimingReference(constraint.relative_to, index);
                    if (!reference) return;
                    const base = boundFor(constraint.relative_to);
                    if (own(constraint, 'min_offset')) {
                        const offset = parseOffset(constraint.min_offset, unit);
                        if (base === null || !offset.ok) unresolvedLower = true;
                        else lower.push({
                            value: base + offset.minutes - (constraint.event === 'completion' ? timing.duration : 0),
                            kind: 'timing', task: reference.task, field: reference.field, constraint: constraintIndex
                        });
                    }
                });
                timing.lower_bounds = lower;
                if (timing.explicit || timing.resolved || deps.waiting.length || unresolvedLower || lower.length === 0) return;
                timing.start = Math.max(...lower.map((entry) => entry.value));
                timing.end = timing.completion = timing.start + timing.duration;
                timing.resolved = true;
                changed = true;
            });
        }

        // Record and validate every statically resolvable bound, including inactive alternatives (VG001).
        index.tasks.forEach((task, id) => {
            const timing = timings.get(id); const taskIndex = taskIndexes.get(id); const groups = dependencyGroups(task);
            if (!timing) return;
            const deps = dependencyBounds(task);
            if (timing.resolved && deps.values.length) {
                const required = Math.max(...deps.values.map((entry) => entry.value));
                if (timing.start < required) {
                    timing.error = { metric_id: 'temporal.scheduling.dependency_violation', detail: `Task '${id}' starts before its dependency condition is satisfied.` };
                    problems.push(problem('temporal.scheduling.dependency_violation', timing.error.detail, `${index.tasksBase}/${taskIndex}/start`, { task_id: id, start_minutes: timing.start, required_end_minutes: required }));
                }
            }
            (task.timing || []).forEach((constraint, constraintIndex) => {
                if (!plain(constraint) || constraint.relation !== 'offset') return;
                const base = boundFor(constraint.relative_to, true);
                if (base === null || !timing.resolved) return;
                const eventTime = constraint.event === 'completion' ? timing.end : timing.start;
                const offsetValue = eventTime - base;
                const min = own(constraint, 'min_offset') ? parseOffset(constraint.min_offset, unit) : null;
                const max = own(constraint, 'max_offset') ? parseOffset(constraint.max_offset, unit) : null;
                if (min && min.ok) {
                    const value = base + min.minutes - (constraint.event === 'completion' ? timing.duration : 0);
                    if (!timing.lower_bounds.some((entry) => entry.kind === 'timing' && entry.constraint === constraintIndex && entry.value === value)) {
                        timing.lower_bounds.push({ value, kind: 'timing', task: taskTimingReference(constraint.relative_to, index)?.task, field: taskTimingReference(constraint.relative_to, index)?.field, constraint: constraintIndex });
                    }
                }
                if (max && max.ok) timing.upper_bounds.push({ value: base + max.minutes - (constraint.event === 'completion' ? timing.duration : 0), kind: 'timing', task: taskTimingReference(constraint.relative_to, index)?.task, field: taskTimingReference(constraint.relative_to, index)?.field, constraint: constraintIndex });
                if ((min && min.ok && offsetValue < min.minutes) || (max && max.ok && offsetValue > max.minutes)) {
                    timing.error = { metric_id: 'timing.offset.violation', detail: `Task '${id}' violates its offset timing constraint.` };
                    problems.push(problem('timing.offset.violation', timing.error.detail, `${index.tasksBase}/${taskIndex}/timing/${constraintIndex}`, { task_id: id, offset_minutes: offsetValue }));
                }
            });
            if (timing.resolved || timing.duration === null || timing.explicit) return;
            let metricId = 'timing.resolution.missing_anchor';
            let detail = `Task '${id}' omits start but has no deterministic dependency or lower timing anchor.`;
            if ((task.timing || []).some((constraint) => constraint && constraint.relation === 'not_overlap') && !groups.all.length && !groups.any.length) {
                metricId = 'timing.resolution.ambiguous_not_overlap';
                detail = `Task '${id}' cannot derive a unique start from not_overlap; that constraint does not choose an ordering.`;
            } else if (groups.any.length && (!statuses || !groups.any.some((depId) => statuses.get(depId) === 'completed'))) {
                metricId = 'timing.resolution.any_unsatisfied';
                detail = `Task '${id}' cannot derive a start because no depends_on.any alternative completed.`;
            } else if (groups.all.length || groups.any.length) {
                metricId = 'timing.resolution.dependency_unresolved';
                detail = `Task '${id}' cannot derive a start because a required predecessor is unresolved, skipped, or blocked.`;
            } else if ((task.timing || []).some((constraint) => taskTimingReference(constraint && constraint.relative_to, index)?.field === 'actual_end')) {
                timing.runtime_unresolved = true;
                timing.error = null;
                return;
            } else if ((task.timing || []).some((constraint) => constraint && constraint.relation === 'offset' && own(constraint, 'min_offset'))) {
                metricId = 'timing.resolution.reference_unresolved';
                detail = `Task '${id}' cannot derive a start because its lower timing anchor is unresolved.`;
            }
            timing.error = { metric_id: metricId, detail };
            problems.push(problem(metricId, detail, `${index.tasksBase}/${taskIndex}/start`, { task_id: id }));
        });

        // Identify the unresolved strongly connected portion without attempting fixed-point scheduling.
        const visiting = new Set(); const visited = new Set(); const stack = [];
        const unresolvedEdges = (id) => {
            const task = index.tasks.get(id); if (!task) return [];
            const deps = dependencyGroups(task); const edges = [...deps.all, ...deps.any];
            (task.timing || []).forEach((constraint) => {
                if (constraint && constraint.relation === 'offset' && own(constraint, 'min_offset')) {
                    const ref = taskTimingReference(constraint.relative_to, index); if (ref) edges.push(ref.task);
                }
            });
            return [...new Set(edges)].filter((edge) => timings.get(edge) && !timings.get(edge).resolved && !timings.get(edge).runtime_unresolved);
        };
        const cycleKeys = new Set();
        function visit(id) {
            if (visiting.has(id)) {
                const offset = stack.indexOf(id); const cycle = stack.slice(offset).concat(id); const key = [...new Set(cycle)].sort().join('|');
                if (!cycleKeys.has(key)) {
                    cycleKeys.add(key);
                    const taskIds = [...new Set(cycle)];
                    const detail = `Timing cannot be resolved because tasks ${taskIds.map((value) => `'${value}'`).join(', ')} form a cycle.`;
                    taskIds.forEach((taskId) => { timings.get(taskId).error = { metric_id: 'timing.resolution.cycle', detail }; });
                    problems.push(problem('timing.resolution.cycle', detail, `${index.tasksBase}/${taskIndexes.get(id)}/start`, { task_ids: taskIds }));
                }
                return;
            }
            if (visited.has(id)) return;
            visiting.add(id); stack.push(id);
            unresolvedEdges(id).forEach(visit);
            stack.pop(); visiting.delete(id); visited.add(id);
        }
        timings.forEach((timing, id) => { if (!timing.resolved && !timing.runtime_unresolved && timing.derived && timing.duration !== null) visit(id); });

        const seen = new Set();
        return {
            index,
            timings,
            problems: problems.filter((entry) => {
                const key = `${entry.metric_id}|${entry.instance}|${entry.detail}`;
                if (seen.has(key)) return false;
                seen.add(key); return true;
            })
        };
    }

    function referenceableFields(kind) {
        return kind === 'object' ? OBJECT_FIELDS : kind === 'task' ? TASK_FIELDS : kind === 'location' ? LOCATION_FIELDS : null;
    }

    function bindingForCollection(index, collectionId) {
        const definition = collectionDefinition(index, collectionId);
        if (!definition || !['objects', 'locations'].includes(definition.from)) return null;
        const kind = definition.from === 'objects' ? 'object' : 'location';
        const source = kind === 'object' ? index.objects : index.locations;
        const properties = {};
        source.forEach((entity) => Object.keys(entity.properties || {}).forEach((name) => { properties[name] = null; }));
        if (kind === 'object') Object.values(index.sim.type_definitions || {}).forEach((type) => Object.keys(type.additional_properties || {}).forEach((name) => { properties[name] = null; }));
        return { id: `$${collectionId}`, kind, collection_id: collectionId, entity: { id: `$${collectionId}`, properties } };
    }

    const BUILTIN_KINDS = {
        object: { id: 'string', type: 'string', name: 'string', emoji: 'string', location: 'string', state_library: 'string', appearance: 'string' },
        task: { id: 'string', actor_id: 'string', start: 'instant', end: 'instant', duration: 'duration', location: 'string', description: 'string', priority: 'string', tags: 'array', status: 'string', actual_end: 'instant' },
        location: { id: 'string', name: 'string', parent_id: 'string', shape: 'object', coordinates: 'object', position: 'object', emoji: 'string' }
    };

    function declaredPropertyKind(index, selected, member) {
        const normalize = (kind) => kind === 'integer' ? 'number' : kind;
        if (selected.collection_id) {
            const kinds = new Set();
            if (selected.kind === 'object') Object.values(index.sim.type_definitions || {}).forEach((definition) => {
                const declared = definition?.additional_properties?.[member]?.type;
                if (declared) kinds.add(normalize(declared));
            });
            const source = selected.kind === 'location' ? index.locations : index.objects;
            source.forEach((entity) => { if (own(entity.properties || {}, member)) kinds.add(kindOf(entity.properties[member])); });
            return kinds.size === 1 ? [...kinds][0] : null;
        }
        if (selected.kind !== 'object') return null;
        const definition = (index.sim.type_definitions || {})[selected.entity.type];
        return normalize(definition?.additional_properties?.[member]?.type) || null;
    }

    function propertyMayChangeType(index, id, member) {
        let uncertain = false;
        const visit = (task) => (task.interactions || []).forEach((interaction) => {
            if (!plain(interaction) || !plain(interaction.property_changes) || !own(interaction.property_changes, member)) return;
            const target = normalizeValueExpression(interaction.target_id);
            if (!target.ok || target.kind !== 'literal' || typeof target.value !== 'string' || target.value === id) uncertain = true;
        });
        index.tasks.forEach(visit);
        (index.sim.process?.work_definitions || []).forEach((definition) => visit(definition.task || {}));
        return uncertain;
    }

    function staticExpressionKind(expression, index, currentTask, bindings) {
        const normalized = normalizeValueExpression(expression);
        if (!normalized.ok) return null;
        if (normalized.kind === 'derived' || normalized.kind === 'count_members') return 'number';
        if (normalized.kind === 'select_member') return 'string';
        if (normalized.kind === 'literal') return kindOf(normalized.value);
        if (normalized.reference.clock) return 'instant';
        const selected = staticReferenceEntity(normalized.reference, index, currentTask, bindings);
        if (!selected) return null;
        const builtIn = normalized.reference.mode === 'field' || (normalized.reference.mode === 'auto' && referenceableFields(selected.kind)?.has(normalized.reference.member));
        if (builtIn) return BUILTIN_KINDS[selected.kind]?.[normalized.reference.member] || null;
        const declared = declaredPropertyKind(index, selected, normalized.reference.member);
        if (declared) return declared;
        if (selected.collection_id) return null;
        const value = selected.entity.properties?.[normalized.reference.member];
        if (value === undefined || propertyMayChangeType(index, selected.id, normalized.reference.member)) return null;
        if (typeof value === 'string' && parseTime(value) !== null) return 'instant';
        return kindOf(value);
    }

    function staticReferenceEntity(reference, index, currentTask, bindings) {
        let id = reference.entity; let kind = reference.selector; let entry = null;
        if (bindings && bindings[id]) return bindings[id];
        if (id === 'current') {
            if (!currentTask) return null;
            if (reference.syntax === 'structured' && reference.selector === 'task') {
                id = currentTask.id; kind = 'task'; entry = { entity: currentTask, kind };
            } else {
                id = currentTask.__selected_actor_id || currentTask.actor_id; kind = 'object'; entry = typeof id === 'string' ? index.ids.get(id) : null;
                if (!entry) {
                    const properties = {};
                    index.objects.forEach((entity) => Object.keys(entity.properties || {}).forEach((name) => { properties[name] = null; }));
                    Object.values(index.sim.type_definitions || {}).forEach((type) => Object.keys(type.additional_properties || {}).forEach((name) => { properties[name] = null; }));
                    return { id: '$current', kind: 'object', collection_id: '$all_objects', entity: { id: '$current', properties } };
                }
            }
        } else entry = index.ids.get(id);
        if (!entry) return null;
        if (kind && entry.kind !== kind) return null;
        return { id, kind: entry.kind, entity: entry.entity };
    }

    function validateExpressionShape(expression, index, instance, currentTask, bindings) {
        const normalized = normalizeValueExpression(expression);
        if (!normalized.ok) return [problem(normalized.metric_id, normalized.detail, instance, {}, undefined, normalized.suggestions)];
        if (normalized.kind === 'derived') {
            if (!Array.isArray(normalized.operands) || normalized.operands.length < 2) return [problem('value.arithmetic.arity', `Arithmetic operator '${normalized.operator}' requires at least two operands.`, instance)];
            const problems = normalized.operands.flatMap((operand, i) => validateExpressionShape(operand, index, `${instance}/${normalized.operator}/${i}`, currentTask, bindings));
            normalized.operands.forEach((operand, i) => {
                const kind = staticExpressionKind(operand, index, currentTask, bindings);
                if (kind && kind !== 'number') problems.push(problem('value.arithmetic.type', `Arithmetic operator '${normalized.operator}' requires numeric operands; operand ${i + 1} is ${kind}.`, `${instance}/${normalized.operator}/${i}`));
            });
            if (normalized.operator === '/') normalized.operands.slice(1).forEach((operand, i) => {
                const value = normalizeValueExpression(operand);
                if (value.ok && value.kind === 'literal' && value.value === 0) problems.push(problem('value.arithmetic.division_by_zero', 'Division by zero is not allowed.', `${instance}/${normalized.operator}/${i + 1}`));
            });
            return problems;
        }
        if (normalized.kind === 'count_members') return validateCollectionPredicateShape(normalized.specification, index, `${instance}/count_members`, currentTask, bindings, 'where');
        if (normalized.kind === 'select_member') return validateSelectionShape(normalized.specification, index, `${instance}/select_member`, currentTask, bindings);
        if (normalized.kind !== 'reference' || normalized.reference.clock) return [];
        const reference = normalized.reference;
        if (['status', 'actual_end', 'progress'].includes(reference.member) && reference.syntax !== 'compact') {
            return [problem('reference.task.runtime_field.compact_required', `Task runtime field '${reference.member}' must use compact reference syntax.`, instance, { member: reference.member }, undefined, [`Use "@${reference.entity}.${reference.member}".`])];
        }
        const selected = staticReferenceEntity(reference, index, currentTask, bindings);
        if (!selected) {
            return [problem('reference.entity.unknown', `Unknown entity '${reference.entity}'.`, instance, { entity_id: reference.entity }, undefined, [`Use "${compactReference(reference.entity, reference.member)}" with an existing entity ID.`])];
        }
        const allowlist = referenceableFields(selected.kind);
        if (!allowlist) return [problem('reference.entity.unsupported', `Entity '${selected.id}' is not referenceable in a ValueExpression.`, instance, { entity_id: selected.id, kind: selected.kind })];
        const properties = plain(selected.entity.properties) ? selected.entity.properties : {};
        const builtIn = allowlist.has(reference.member);
        const directProperty = own(properties, reference.member);
        const valid = reference.mode === 'field' ? builtIn : reference.mode === 'property' ? directProperty : builtIn || directProperty;
        if (!valid) {
            return [problem('reference.member.unknown', `Unknown member '${reference.member}' on ${selected.kind} '${selected.id}'.`, instance, { entity_id: selected.id, member: reference.member }, undefined, [`Use "${compactReference(selected.id, reference.member)}" with an allowed built-in field or existing direct property.`])];
        }
        if (selected.kind === 'task' && reference.member === 'progress' && !own(selected.entity, 'progress')) {
            return [problem('reference.task.progress.undeclared', `Task '${selected.id}' has no progress declaration.`, instance, { task_id: selected.id })];
        }
        return [];
    }

    function validateCollectionPredicateShape(specification, index, instance, currentTask, bindings, predicateKey, extraAllowed) {
        if (!plain(specification)) return [problem('collection.predicate.shape', 'A collection predicate must be an object.', instance)];
        const allowed = new Set(['collection', 'as', predicateKey, ...(extraAllowed || [])]);
        const problems = [];
        if (Object.keys(specification).some((key) => !allowed.has(key))) problems.push(problem('collection.predicate.shape', 'A collection predicate contains unsupported fields.', instance));
        const descriptor = bindingForCollection(index, specification.collection);
        if (!descriptor) problems.push(problem('collection.reference.unknown', `Unknown runtime collection '${specification.collection}'.`, `${instance}/collection`, { collection: specification.collection }));
        if (typeof specification.as !== 'string' || !COMPACT_ENTITY_ID.test(specification.as) || specification.as === 'current') problems.push(problem('collection.binding.invalid', 'Collection member alias must be a plain id other than current.', `${instance}/as`));
        if (descriptor && specification[predicateKey] !== undefined) {
            const localBindings = { ...(bindings || {}), [specification.as]: descriptor };
            problems.push(...validateConditionShape(specification[predicateKey], index, `${instance}/${predicateKey}`, currentTask, localBindings));
        }
        return problems;
    }

    function validateSelectionShape(specification, index, instance, currentTask, bindings) {
        const problems = validateCollectionPredicateShape(specification, index, instance, currentTask, bindings, 'where', ['policy', 'by', 'tie_break']);
        if (!plain(specification)) return problems;
        if (!['first_by_id', 'lowest', 'highest'].includes(specification.policy)) problems.push(problem('actor.selection.policy.invalid', `Unknown deterministic selection policy '${specification.policy}'.`, `${instance}/policy`));
        const descriptor = bindingForCollection(index, specification.collection);
        const localBindings = descriptor ? { ...(bindings || {}), [specification.as]: descriptor } : bindings;
        if (['lowest', 'highest'].includes(specification.policy)) {
            if (!own(specification, 'by')) problems.push(problem('actor.selection.by.missing', `Selection policy '${specification.policy}' requires by.`, `${instance}/by`));
            else {
                problems.push(...validateExpressionShape(specification.by, index, `${instance}/by`, currentTask, localBindings));
                const kind = staticExpressionKind(specification.by, index, currentTask, localBindings);
                if (kind && kind !== 'number') problems.push(problem('actor.selection.by.type', `Selection policy '${specification.policy}' requires numeric by.`, `${instance}/by`));
            }
        } else if (own(specification, 'by')) problems.push(problem('actor.selection.by.invalid', "Selection policy 'first_by_id' does not use by.", `${instance}/by`));
        if (specification.tie_break !== undefined && specification.tie_break !== 'stable_id') problems.push(problem('actor.selection.tie_break.invalid', "The only supported tie_break is 'stable_id'.", `${instance}/tie_break`));
        return problems;
    }

    function continuationProblems(index) {
        const problems = []; const edges = new Map(); const taskEntries = [...index.tasks.entries()].filter(([, task]) => !task.__runtime_instance);
        taskEntries.forEach(([id, task], taskIndex) => {
            if (task.continues === undefined) return;
            const at = `${index.tasksBase}/${taskIndex}/continues`;
            if (!plain(task.continues) || Object.keys(task.continues).length !== 1 || typeof task.continues.task !== 'string' || !task.continues.task) {
                problems.push(problem('task.continues.invalid', 'continues must contain exactly one task id.', at)); return;
            }
            const target = task.continues.task;
            if (!index.tasks.has(target)) problems.push(problem('task.continues.unknown', `Continuation target '${target}' does not exist.`, `${at}/task`, { task_id: id, target_task_id: target }));
            if (target === id) problems.push(problem('task.continues.self', `Task '${id}' cannot continue itself.`, `${at}/task`, { task_id: id }));
            if (target !== id && index.tasks.has(target) && index.tasks.get(target).while === undefined) problems.push(problem('task.continues.source_not_interruptible', `Continuation source '${target}' has no modeled while rule that can interrupt it.`, `${at}/task`, { task_id: id, source_task_id: target }, 'warning'));
            edges.set(id, target);
        });
        const visited = new Set(); const visiting = new Set(); const stack = [];
        function visit(id) {
            if (visiting.has(id)) {
                const start = stack.indexOf(id); const cycle = stack.slice(start).concat(id);
                problems.push(problem('task.continues.cycle', `Continuation cycle detected: ${cycle.join(' -> ')}.`, index.tasksBase, { task_ids: [...new Set(cycle)] })); return;
            }
            if (visited.has(id)) return;
            visiting.add(id); stack.push(id);
            const target = edges.get(id); if (target && edges.has(target)) visit(target);
            stack.pop(); visiting.delete(id); visited.add(id);
        }
        edges.forEach((_target, id) => visit(id));
        return problems;
    }

    function validateReferenceablePropertyNames(index) {
        const problems = [];
        collectEntities(index.sim).forEach((entry) => {
            if (!plain(entry.entity.properties)) return;
            const builtIns = referenceableFields(entry.kind);
            Object.keys(entry.entity.properties).forEach((name) => {
                const instance = pointer(entry.parts.concat(['properties', name]));
                if (name.includes('.')) {
                    problems.push(problem('reference.property.dotted', `Property name '${name}' contains '.', which is reserved for compact references.`, instance, { entity_id: entry.entity.id, property: name }, undefined, [`Rename it to '${name.replace(/\./g, '_')}'.`]));
                }
                if (builtIns && builtIns.has(name)) {
                    problems.push(problem('reference.property.shadows_builtin', `Property '${name}' on ${entry.kind} '${entry.entity.id}' shadows a referenceable built-in field.`, instance, { entity_id: entry.entity.id, property: name, kind: entry.kind }, undefined, [`Rename the property; "${compactReference(entry.entity.id, name)}" always resolves to the built-in field.`]));
                }
            });
        });
        Object.entries(index.sim.type_definitions || {}).forEach(([typeName, definition]) => {
            Object.keys((definition && definition.additional_properties) || {}).forEach((name) => {
                const instance = pointer(['simulation', 'type_definitions', typeName, 'additional_properties', name]);
                if (name.includes('.')) problems.push(problem('reference.property.dotted', `Custom property name '${name}' contains '.', which is reserved for compact references.`, instance, { type: typeName, property: name }, undefined, [`Rename it to '${name.replace(/\./g, '_')}'.`]));
                if (OBJECT_FIELDS.has(name)) problems.push(problem('reference.property.shadows_builtin', `Custom property '${name}' shadows a referenceable object field.`, instance, { type: typeName, property: name }, undefined, [`Rename the property; compact references to '.${name}' select the built-in field.`]));
            });
        });
        return problems;
    }

    function validateDeclaredPropertyTypes(index) {
        const problems = [];
        index.objects.forEach((entity) => {
            const definition = (index.sim.type_definitions || {})[entity.type];
            Object.entries(definition?.additional_properties || {}).forEach(([member, declaration]) => {
                if (!own(entity.properties || {}, member)) return;
                const value = entity.properties[member]; const expected = declaration.type;
                const valid = expected === 'integer' ? Number.isInteger(value)
                    : expected === 'number' ? typeof value === 'number' && Number.isFinite(value)
                        : expected === 'array' ? Array.isArray(value)
                            : expected === 'object' ? plain(value)
                                : typeof value === expected;
                if (!valid) problems.push(problem('object.property.type.declared', `Property '${member}' on '${entity.id}' is ${kindOf(value)} but custom type '${entity.type}' declares ${expected}.`, `/simulation/world/objects/${[...index.objects.keys()].indexOf(entity.id)}/properties/${ptrEscape(member)}`, { object_id: entity.id, property: member, expected, actual: kindOf(value) }));
            });
        });
        return problems;
    }

    function validateConditionShape(condition, index, instance, currentTask, bindings) {
        const problems = [];
        if (typeof condition === 'boolean') return problems;
        if (!plain(condition) || Object.keys(condition).length !== 1) return [problem('condition.shape.invalid', 'A condition must be a boolean or contain exactly one operator.', instance)];
        const operator = Object.keys(condition)[0]; const operands = condition[operator];
        if (COMPARISONS.has(operator) || operator === 'contains') {
            if (!Array.isArray(operands) || operands.length !== 2) return [problem('condition.operator.arity', `Operator '${operator}' requires exactly two operands.`, instance)];
            operands.forEach((operand, i) => problems.push(...validateExpressionShape(operand, index, `${instance}/${operator}/${i}`, currentTask, bindings)));
            const operandKinds = operands.map((operand) => staticExpressionKind(operand, index, currentTask, bindings));
            if (operandKinds[0] && operandKinds[1]) {
                if (operator === 'contains') {
                    const compatible = (operandKinds[0] === 'array') || (operandKinds[0] === 'string' && operandKinds[1] === 'string');
                    if (!compatible) problems.push(problem('condition.type.incompatible', "'contains' requires an array/member or string/string pair.", instance));
                } else if (operandKinds[0] !== operandKinds[1] || (!['==', '!='].includes(operator) && !['number', 'instant', 'duration'].includes(operandKinds[0]))) {
                    problems.push(problem('condition.type.incompatible', `Operator '${operator}' has incompatible operand types ${operandKinds[0]} and ${operandKinds[1]}.`, instance));
                }
            }
            return problems;
        }
        if (operator === 'all' || operator === 'any') {
            if (!Array.isArray(operands) || operands.length === 0) return [problem('condition.operator.arity', `Operator '${operator}' requires a non-empty array.`, instance)];
            operands.forEach((entry, i) => problems.push(...validateConditionShape(entry, index, `${instance}/${operator}/${i}`, currentTask, bindings)));
            return problems;
        }
        if (MEMBER_QUANTIFIERS.has(operator)) return validateCollectionPredicateShape(operands, index, `${instance}/${operator}`, currentTask, bindings, 'satisfy');
        if (operator === 'not') return validateConditionShape(operands, index, `${instance}/not`, currentTask, bindings);
        if (operator === 'held_for') {
            if (!plain(operands) || !own(operands, 'condition') || !own(operands, 'duration') || Object.keys(operands).some((key) => !['condition', 'duration'].includes(key))) return [problem('condition.held_for.shape', "'held_for' requires only condition and duration.", instance)];
            if (!parseDurationToMinutes(operands.duration, (index.sim.config || {}).time_unit).ok) problems.push(problem('condition.held_for.duration', "'held_for' has an invalid duration.", `${instance}/held_for/duration`));
            problems.push(...validateConditionShape(operands.condition, index, `${instance}/held_for/condition`, currentTask, bindings));
            return problems;
        }
        return [problem('condition.operator.invalid', `Unknown condition operator '${operator}'.`, instance)];
    }

    function validateStatic(index) {
        const problems = []; const unit = (index.sim.config || {}).time_unit;
        [...index.tasks.values()].forEach((task, taskIndex) => {
            if (task.__runtime_instance) return;
            const base = `${index.tasksBase}/${taskIndex}`;
            problems.push(...validateExpressionShape(task.actor_id, index, `${base}/actor_id`, task));
            const actorKind = staticExpressionKind(task.actor_id, index, task);
            if (actorKind && actorKind !== 'string') problems.push(problem('task.actor.type', `Task '${task.id}' actor_id is definitely ${actorKind}, not an object id string.`, `${base}/actor_id`, { task_id: task.id }));
            const actorExpression = normalizeValueExpression(task.actor_id);
            if (actorExpression.ok && actorExpression.kind === 'select_member' && bindingForCollection(index, actorExpression.specification.collection)?.kind !== 'object') problems.push(problem('task.actor.collection.type', `Task '${task.id}' actor selection must use an object collection.`, `${base}/actor_id/select_member/collection`, { task_id: task.id }));
            if (task.when !== undefined) problems.push(...validateConditionShape(task.when, index, `${base}/when`, task));
            if (task.requires !== undefined) problems.push(...validateConditionShape(task.requires, index, `${base}/requires`, task));
            if (task.while !== undefined) problems.push(...validateConditionShape(task.while, index, `${base}/while`, task));
            if (task.progress !== undefined) {
                const normalized = normalizeValueExpression(task.progress);
                problems.push(...validateExpressionShape(task.progress, index, `${base}/progress`, task));
                const selected = normalized.ok && normalized.kind === 'reference' && !normalized.reference.clock ? staticReferenceEntity(normalized.reference, index, task) : null;
                if (typeof task.progress !== 'string' || !task.progress.startsWith('@') || !selected || !['object', 'location'].includes(selected.kind)) {
                    problems.push(problem('task.progress.invalid', 'progress must be one compact reference to a world object or location member.', `${base}/progress`, { task_id: task.id }, undefined, ['Use compact syntax such as "@blood_unit_42.infused_ml".']));
                }
            }
            (task.timing || []).forEach((constraint, i) => {
                const at = `${base}/timing/${i}`;
                if (!plain(constraint) || !['offset', 'not_overlap'].includes(constraint.relation)) { problems.push(problem('timing.constraint.invalid', 'Unknown or malformed timing constraint.', at)); return; }
                if (constraint.relation === 'offset') {
                    if (!['start', 'completion'].includes(constraint.event)) problems.push(problem('timing.event.invalid', "Offset event must be 'start' or 'completion'.", `${at}/event`));
                    problems.push(...validateExpressionShape(constraint.relative_to, index, `${at}/relative_to`, task));
                    if (!taskTimingReference(constraint.relative_to, index)) problems.push(problem('timing.relative_to.invalid', 'relative_to must be a task start, end, or actual_end reference.', `${at}/relative_to`, {}, undefined, ['Use compact syntax such as "@inspect.end" or "@inspect.actual_end".']));
                    if (!own(constraint, 'min_offset') && !own(constraint, 'max_offset')) problems.push(problem('timing.offset.bounds_missing', 'An offset constraint requires min_offset or max_offset.', at));
                    const min = own(constraint, 'min_offset') ? parseOffset(constraint.min_offset, unit) : null; const max = own(constraint, 'max_offset') ? parseOffset(constraint.max_offset, unit) : null;
                    if ((min && !min.ok) || (max && !max.ok)) problems.push(problem('timing.offset.invalid', 'Invalid relative time offset.', at));
                    if (min?.ok && max?.ok && min.minutes > max.minutes) problems.push(problem('timing.offset.range_invalid', 'min_offset cannot exceed max_offset.', at));
                } else if (!plain(constraint.with) || typeof constraint.with.task !== 'string' || !index.tasks.has(constraint.with.task)) problems.push(problem('timing.not_overlap.reference', 'not_overlap requires an existing task reference.', `${at}/with`));
            });
            (task.reservations || []).forEach((reservation, i) => {
                const at = `${base}/reservations/${i}`;
                if (!plain(reservation) || !['exclusive', 'capacity'].includes(reservation.mode)) { problems.push(problem('reservation.shape.invalid', 'Reservation mode must be exclusive or capacity.', at)); return; }
                problems.push(...validateExpressionShape(reservation.resource, index, `${at}/resource`, task));
                if (reservation.mode === 'capacity') {
                    if (!own(reservation, 'amount')) problems.push(problem('reservation.amount.missing', 'Capacity reservation requires amount.', `${at}/amount`));
                    else {
                        problems.push(...validateExpressionShape(reservation.amount, index, `${at}/amount`, task));
                        const amountKind = staticExpressionKind(reservation.amount, index, task);
                        if (amountKind && amountKind !== 'number') problems.push(problem('reservation.amount.type', `Capacity reservation amount is definitely ${amountKind}, not number.`, `${at}/amount`));
                    }
                } else if (own(reservation, 'amount')) problems.push(problem('reservation.amount.invalid', 'Exclusive reservation does not use amount.', `${at}/amount`));
            });
            (task.interactions || []).forEach((interaction, i) => {
                const at = `${base}/interactions/${i}`; if (!plain(interaction)) return;
                if (interaction.when !== undefined) problems.push(...validateConditionShape(interaction.when, index, `${at}/when`, task));
                if (interaction.at !== undefined && !['start', 'completion'].includes(interaction.at)) problems.push(problem('interaction.timing.invalid', "Interaction at must be 'start' or 'completion'.", `${at}/at`));
                if (interaction.temporary === true && interaction.action) problems.push(problem('interaction.temporary.lifecycle_invalid', 'Temporary create and delete interactions are invalid in WorkSpec 2.1.', at));
                if (interaction.temporary === true && interaction.at === 'completion') problems.push(problem('interaction.temporary.timing_invalid', "A temporary interaction cannot use at:'completion'.", at));
                if (interaction.action === 'create') {
                    Object.entries((interaction.object || {}).properties || {}).forEach(([name, value]) => problems.push(...validateExpressionShape(value, index, `${at}/object/properties/${ptrEscape(name)}`, task)));
                    if (interaction.object && own(interaction.object, 'location')) problems.push(...validateExpressionShape(interaction.object.location, index, `${at}/object/location`, task));
                } else {
                    problems.push(...validateExpressionShape(interaction.target_id, index, `${at}/target_id`, task));
                    Object.entries(interaction.property_changes || {}).forEach(([name, operator]) => {
                        if (name.includes('.')) problems.push(problem('reference.property.dotted', `Property name '${name}' contains '.', which is reserved for compact references.`, `${at}/property_changes/${ptrEscape(name)}`, { property: name }, undefined, [`Rename it to '${name.replace(/\./g, '_')}'.`]));
                        if (!plain(operator)) return;
                        ['from', 'to', 'set', 'delta', 'multiply', 'append', 'remove'].forEach((key) => { if (own(operator, key)) problems.push(...validateExpressionShape(operator[key], index, `${at}/property_changes/${ptrEscape(name)}/${key}`, task)); });
                    });
                }
            });
        });
        const collections = plain(index.sim.collections) ? index.sim.collections : {};
        Object.entries(collections).forEach(([collectionId, definition]) => {
            const base = `/simulation/collections/${ptrEscape(collectionId)}`;
            if (!COMPACT_ENTITY_ID.test(collectionId) || collectionId.includes(':')) problems.push(problem('collection.id.invalid', `Collection id '${collectionId}' must be a plain id.`, base));
            if (!plain(definition) || !['objects', 'locations'].includes(definition.from)) { problems.push(problem('collection.source.invalid', `Collection '${collectionId}' must select from objects or locations.`, base)); return; }
            if (typeof definition.as !== 'string' || !COMPACT_ENTITY_ID.test(definition.as) || definition.as === 'current') problems.push(problem('collection.binding.invalid', `Collection '${collectionId}' requires a plain member alias other than current.`, `${base}/as`));
            const descriptor = bindingForCollection(index, collectionId);
            if (definition.where !== undefined && descriptor) problems.push(...validateConditionShape(definition.where, index, `${base}/where`, null, { [definition.as]: descriptor }));
            if (definition.open === true && !parseTaskStart(definition.closes_at).ok) problems.push(problem('collection.cutoff.invalid', `Open collection '${collectionId}' requires a valid closes_at boundary.`, `${base}/closes_at`));
        });
        const definitions = Array.isArray(index.sim.process?.work_definitions) ? index.sim.process.work_definitions : [];
        const definitionIds = new Set();
        definitions.forEach((definition, definitionIndex) => {
            const base = `/simulation/process/work_definitions/${definitionIndex}`;
            if (!plain(definition) || typeof definition.id !== 'string' || !COMPACT_ENTITY_ID.test(definition.id) || definition.id.includes(':')) { problems.push(problem('work_definition.id.invalid', 'A work definition requires a unique plain id.', `${base}/id`)); return; }
            if (definitionIds.has(definition.id)) problems.push(problem('work_definition.id.duplicate', `Duplicate work definition id '${definition.id}'.`, `${base}/id`, { definition_id: definition.id }));
            definitionIds.add(definition.id);
            if (!plain(definition.instantiate) || !plain(definition.task)) { problems.push(problem('work_definition.shape.invalid', `Work definition '${definition.id}' requires instantiate and task objects.`, base)); return; }
            const trigger = definition.instantiate; const descriptor = bindingForCollection(index, trigger.for_each);
            if (!descriptor) problems.push(problem('instance.trigger.collection.invalid', `Work definition '${definition.id}' references unknown collection '${trigger.for_each}'.`, `${base}/instantiate/for_each`));
            if (typeof trigger.as !== 'string' || !COMPACT_ENTITY_ID.test(trigger.as) || trigger.as === 'current') problems.push(problem('instance.trigger.binding.invalid', `Work definition '${definition.id}' requires a distinct member alias.`, `${base}/instantiate/as`));
            if (trigger.start !== undefined && trigger.start !== 'on_appearance') problems.push(problem('instance.trigger.start.invalid', "The only runtime instantiation start is 'on_appearance'.", `${base}/instantiate/start`));
            if (own(trigger, 'offset') && !parseOffset(trigger.offset, unit).ok) problems.push(problem('instance.trigger.offset.invalid', `Work definition '${definition.id}' has invalid offset.`, `${base}/instantiate/offset`));
            if (own(definition.task, 'id') || own(definition.task, 'start')) problems.push(problem('work_definition.task.identity.invalid', 'A reusable task template cannot declare id or start; runtime supplies deterministic identity and appearance timing.', `${base}/task`));
            const template = { ...definition.task, id: `${definition.id}:runtime` };
            const bindings = descriptor ? { [trigger.as]: descriptor } : {};
            if (!parseDurationToMinutes(template.duration, unit).ok) problems.push(problem('task.integrity.invalid_duration', `Work definition '${definition.id}' has invalid task duration.`, `${base}/task/duration`));
            problems.push(...validateExpressionShape(template.actor_id, index, `${base}/task/actor_id`, template, bindings));
            const templateActorKind = staticExpressionKind(template.actor_id, index, template, bindings);
            if (templateActorKind && templateActorKind !== 'string') problems.push(problem('task.actor.type', `Work definition '${definition.id}' actor_id is definitely ${templateActorKind}, not string.`, `${base}/task/actor_id`));
            const templateActorExpression = normalizeValueExpression(template.actor_id);
            if (templateActorExpression.ok && templateActorExpression.kind === 'select_member' && bindingForCollection(index, templateActorExpression.specification.collection)?.kind !== 'object') problems.push(problem('task.actor.collection.type', `Work definition '${definition.id}' actor selection must use an object collection.`, `${base}/task/actor_id/select_member/collection`, { definition_id: definition.id }));
            if (template.when !== undefined) problems.push(...validateConditionShape(template.when, index, `${base}/task/when`, template, bindings));
            if (template.requires !== undefined) problems.push(...validateConditionShape(template.requires, index, `${base}/task/requires`, template, bindings));
            if (template.while !== undefined) problems.push(...validateConditionShape(template.while, index, `${base}/task/while`, template, bindings));
            if (template.progress !== undefined) problems.push(...validateExpressionShape(template.progress, index, `${base}/task/progress`, template, bindings));
            const dependencies = dependencyGroups(template);
            [...dependencies.all, ...dependencies.any].forEach((dependencyId) => {
                if (!index.tasks.has(dependencyId)) problems.push(problem('dependency.reference.unknown', `Work definition '${definition.id}' references unknown dependency '${dependencyId}'.`, `${base}/task/depends_on`, { definition_id: definition.id, dependency_id: dependencyId }));
            });
            if (template.continues !== undefined) {
                const sourceId = template.continues?.task; const source = index.tasks.get(sourceId);
                if (typeof sourceId !== 'string' || !source) problems.push(problem('task.continues.unknown', `Work definition '${definition.id}' references unknown continuation source '${sourceId}'.`, `${base}/task/continues/task`));
                else if (source.while === undefined) problems.push(problem('task.continues.source_not_interruptible', `Continuation source '${sourceId}' has no modeled while rule that can interrupt it.`, `${base}/task/continues/task`, { source_task_id: sourceId }, 'warning'));
            }
            (template.timing || []).forEach((constraint, i) => {
                const at = `${base}/task/timing/${i}`;
                if (!plain(constraint) || !['offset', 'not_overlap'].includes(constraint.relation)) { problems.push(problem('timing.constraint.invalid', 'Unknown or malformed timing constraint.', at)); return; }
                if (constraint.relation === 'offset') {
                    problems.push(...validateExpressionShape(constraint.relative_to, index, `${at}/relative_to`, template, bindings));
                    if (!taskTimingReference(constraint.relative_to, index)) problems.push(problem('timing.relative_to.invalid', 'Runtime work timing relative_to must name an authored task start, end, or actual_end.', `${at}/relative_to`));
                    if (own(constraint, 'min_offset') && !parseOffset(constraint.min_offset, unit).ok) problems.push(problem('timing.offset.invalid', 'Invalid minimum timing offset.', `${at}/min_offset`));
                    if (own(constraint, 'max_offset') && !parseOffset(constraint.max_offset, unit).ok) problems.push(problem('timing.offset.invalid', 'Invalid maximum timing offset.', `${at}/max_offset`));
                } else if (!index.tasks.has(constraint.with?.task)) problems.push(problem('timing.not_overlap.reference', 'not_overlap requires an existing authored task reference.', `${at}/with/task`));
            });
            (template.reservations || []).forEach((reservation, i) => {
                problems.push(...validateExpressionShape(reservation.resource, index, `${base}/task/reservations/${i}/resource`, template, bindings));
                if (reservation.mode === 'capacity') {
                    problems.push(...validateExpressionShape(reservation.amount, index, `${base}/task/reservations/${i}/amount`, template, bindings));
                    const amountKind = staticExpressionKind(reservation.amount, index, template, bindings);
                    if (amountKind && amountKind !== 'number') problems.push(problem('reservation.amount.type', `Capacity reservation amount is definitely ${amountKind}, not number.`, `${base}/task/reservations/${i}/amount`));
                }
            });
            (template.interactions || []).forEach((interaction, i) => {
                const at = `${base}/task/interactions/${i}`;
                if (interaction.when !== undefined) problems.push(...validateConditionShape(interaction.when, index, `${at}/when`, template, bindings));
                if (interaction.action === 'create') {
                    Object.entries(interaction.object?.properties || {}).forEach(([name, value]) => problems.push(...validateExpressionShape(value, index, `${at}/object/properties/${ptrEscape(name)}`, template, bindings)));
                    if (interaction.object && own(interaction.object, 'location')) problems.push(...validateExpressionShape(interaction.object.location, index, `${at}/object/location`, template, bindings));
                } else {
                    problems.push(...validateExpressionShape(interaction.target_id, index, `${at}/target_id`, template, bindings));
                    Object.entries(interaction.property_changes || {}).forEach(([name, change]) => Object.entries(change || {}).forEach(([operation, value]) => problems.push(...validateExpressionShape(value, index, `${at}/property_changes/${ptrEscape(name)}/${operation}`, template, bindings))));
                }
            });
        });
        problems.push(...validateReferenceablePropertyNames(index));
        problems.push(...validateDeclaredPropertyTypes(index));
        problems.push(...boundedDependencyProblems(index));
        problems.push(...boundedClaimProblems(index));
        problems.push(...continuationProblems(index));
        return problems;
    }

    function expressionContext(index, state, timings, task, now, history, instance) {
        const parsedStart = parseTaskStart((index.sim.config || {}).start_time);
        return { index, state, timings, currentTask: task, bindings: task && task.__bindings ? task.__bindings : {}, now, history, instance: instance || '/', timeUnit: (index.sim.config || {}).time_unit, simulationStart: parsedStart.ok ? parsedStart.startMinutes : -Infinity };
    }

    function resolveTarget(target, context) {
        const value = evaluateValue(target, context);
        if (!value.ok) return value;
        if (typeof value.value !== 'string') return failure('interaction.target.type', 'An interaction target must resolve to an object id string.', context.instance);
        return result(value.value, 'string');
    }

    function operationOf(change) {
        if (own(change, 'from') && own(change, 'to')) return 'to';
        return ['set', 'delta', 'multiply', 'append', 'remove', 'increment', 'decrement'].find((key) => own(change, key));
    }

    function prepareInteractions(task, at, context, runtimeProblems, temporaryOnly) {
        const writes = [];
        (task.interactions || []).forEach((interaction, index) => {
            const instance = `${task.__instance || `/simulation/process/tasks/${task.__index}`}/interactions/${index}`;
            if (!plain(interaction)) return;
            const isTemporary = interaction.temporary === true;
            if (Boolean(temporaryOnly) !== isTemporary) return;
            if (isTemporary && interaction.action) {
                runtimeProblems.push(problem('interaction.temporary.lifecycle_invalid', 'Temporary create and delete interactions are invalid in WorkSpec 2.1.', instance));
                return;
            }
            if (isTemporary && interaction.at === 'completion') {
                runtimeProblems.push(problem('interaction.temporary.timing_invalid', "A temporary property interaction cannot use at:'completion'.", instance));
                return;
            }
            const phase = isTemporary ? 'start' : (interaction.at || 'completion');
            if (phase !== at) return;
            const local = { ...context, instance };
            if (interaction.when !== undefined) {
                const condition = evaluateCondition(interaction.when, local);
                if (!condition.ok) { runtimeProblems.push(condition.problem); return; }
                if (!condition.value) return;
            }
            if (interaction.action === 'create') {
                const entity = clone(interaction.object || {});
                if (context.state.objects.has(entity.id)) { runtimeProblems.push(problem('object.lifecycle.create_existing', `Object '${entity.id}' is already live.`, instance)); return; }
                const properties = {};
                Object.entries(entity.properties || {}).forEach(([key, expression]) => {
                    const evaluated = evaluateValue(expression, local);
                    if (!evaluated.ok) runtimeProblems.push(evaluated.problem); else properties[key] = evaluated.value;
                });
                entity.properties = properties;
                if (own(entity, 'location')) {
                    const evaluated = evaluateValue(entity.location, local);
                    if (!evaluated.ok) runtimeProblems.push(evaluated.problem); else entity.location = evaluated.value;
                }
                writes.push({ kind: 'create', id: entity.id, entity, task: task.id, instance });
                return;
            }
            const target = resolveTarget(interaction.target_id, local);
            if (!target.ok) { runtimeProblems.push(target.problem); return; }
            if (!context.state.objects.has(target.value)) { runtimeProblems.push(problem('object.lifecycle.target_not_live', `Object '${target.value}' is not live.`, instance)); return; }
            if (interaction.action === 'delete') { writes.push({ kind: 'delete', id: target.value, task: task.id, instance }); return; }
            Object.entries(interaction.property_changes || {}).forEach(([propertyName, change]) => {
                const operation = operationOf(change || {});
                let operand;
                if (operation === 'increment') operand = result(1, 'number');
                else if (operation === 'decrement') operand = result(-1, 'number');
                else operand = evaluateValue(change[operation], local);
                if (!operand || !operand.ok) { runtimeProblems.push((operand && operand.problem) || problem('interaction.operator.invalid', `Property '${propertyName}' has no supported operator.`, instance)); return; }
                let from;
                if (own(change, 'from')) { from = evaluateValue(change.from, local); if (!from.ok) { runtimeProblems.push(from.problem); return; } }
                writes.push({ kind: 'property', id: target.value, property: propertyName, operation: operation === 'increment' || operation === 'decrement' ? 'delta' : operation, value: operand.value, valueKind: operand.kind, from, task: task.id, instance, temporary: isTemporary });
            });
        });
        return writes;
    }

    function readProperty(entity, propertyName) {
        return propertyName === 'location' || propertyName === 'emoji' ? entity[propertyName] : (entity.properties || {})[propertyName];
    }
    function writeProperty(entity, propertyName, value) {
        if (propertyName === 'location' || propertyName === 'emoji') entity[propertyName] = clone(value);
        else { if (!plain(entity.properties)) entity.properties = {}; entity.properties[propertyName] = clone(value); }
    }
    function restoreProperty(entity, capture) {
        if (capture.existed) { writeProperty(entity, capture.property, capture.value); return; }
        if (capture.property === 'location' || capture.property === 'emoji') delete entity[capture.property];
        else if (plain(entity.properties)) delete entity.properties[capture.property];
    }

    function commitWrites(state, writes, runtimeProblems) {
        const groups = new Map();
        const lifecycleIds = new Set(writes.filter((write) => write.kind === 'create' || write.kind === 'delete').map((write) => write.id));
        const lifecycleConflicts = new Set(writes.filter((write) => write.kind === 'property' && lifecycleIds.has(write.id)).map((write) => write.id));
        lifecycleConflicts.forEach((id) => {
            const conflicting = writes.filter((write) => write.id === id);
            conflicting.forEach((write) => runtimeProblems.push(problem('interaction.write.conflict', `A lifecycle action and property write conflict on '${id}'.`, write.instance, { object_id: id, writers: conflicting.map((entry) => entry.task) })));
        });
        writes.filter((write) => !lifecycleConflicts.has(write.id)).forEach((write) => {
            const key = write.kind === 'property' ? `${write.id}:property:${write.property}` : `${write.id}:lifecycle`;
            if (!groups.has(key)) groups.set(key, []); groups.get(key).push(write);
        });
        groups.forEach((group) => {
            if (group.length > 1 && !(group.every((write) => write.kind === 'property' && write.operation === 'delta'))) {
                group.forEach((write) => runtimeProblems.push(problem('interaction.write.conflict', `Simultaneous writes conflict on '${write.id}'.`, write.instance, { object_id: write.id, writers: group.map((entry) => entry.task) })));
                return;
            }
            const first = group[0];
            if (first.kind === 'create') { state.objects.set(first.id, clone(first.entity)); return; }
            if (first.kind === 'delete') { state.objects.delete(first.id); return; }
            const entity = state.objects.get(first.id); if (!entity) return;
            const before = readProperty(entity, first.property);
            const hasActiveTemporary = [...state.temporary.entries()].some(([taskId, captures]) => taskId !== first.task && captures.some((capture) => capture.id === first.id && capture.property === first.property));
            if (group.some((write) => write.temporary) && hasActiveTemporary) { runtimeProblems.push(problem('interaction.temporary.overlap', `Temporary writes overlap on '${first.property}'.`, first.instance)); return; }
            if (group.every((write) => write.operation === 'delta')) {
                if (typeof before !== 'number' || group.some((write) => typeof write.value !== 'number')) { runtimeProblems.push(problem('interaction.operator.type', `Delta on '${first.property}' requires numeric values.`, first.instance)); return; }
                const temporaryDeltas = group.filter((write) => write.temporary);
                if (temporaryDeltas.length > 1) { temporaryDeltas.forEach((write) => runtimeProblems.push(problem('interaction.temporary.overlap', `Temporary writes overlap on '${first.property}'.`, write.instance))); return; }
                if (temporaryDeltas.length === 1) {
                    const write = temporaryDeltas[0]; const captures = state.temporary.get(write.task) || [];
                    captures.push({ id: write.id, property: write.property, value: clone(before), existed: before !== undefined });
                    state.temporary.set(write.task, captures);
                }
                writeProperty(entity, first.property, before + group.reduce((sum, write) => sum + write.value, 0));
                return;
            }
            if (first.from && equalValues(result(before), first.from) !== true) { runtimeProblems.push(problem('interaction.from.mismatch', `Property '${first.property}' does not equal the required from value.`, first.instance)); return; }
            if (first.temporary) {
                const captures = state.temporary.get(first.task) || [];
                captures.push({ id: first.id, property: first.property, value: clone(before), existed: before !== undefined });
                state.temporary.set(first.task, captures);
            }
            let after = first.value;
            if (first.operation === 'delta') after = typeof before === 'number' && typeof first.value === 'number' ? before + first.value : undefined;
            if (first.operation === 'multiply') after = typeof before === 'number' && typeof first.value === 'number' ? before * first.value : undefined;
            if (first.operation === 'append') after = Array.isArray(before) ? before.concat([clone(first.value)]) : typeof before === 'string' && typeof first.value === 'string' ? before + first.value : undefined;
            if (first.operation === 'remove') after = Array.isArray(before) ? before.filter((entry) => JSON.stringify(entry) !== JSON.stringify(first.value)) : undefined;
            if (after === undefined && first.operation !== 'set' && first.operation !== 'to') { runtimeProblems.push(problem('interaction.operator.type', `Operator '${first.operation}' is incompatible with '${first.property}'.`, first.instance)); return; }
            writeProperty(entity, first.property, after);
            state.kinds.set(`object:${first.id}:${first.property}`, first.valueKind);
        });
    }

    function dependencyReady(task, statuses) {
        const deps = task.depends_on;
        if (!deps) return true;
        if (Array.isArray(deps)) return deps.every((id) => statuses.get(id) === 'completed');
        const all = !Array.isArray(deps.all) || deps.all.every((id) => statuses.get(id) === 'completed');
        const any = !Array.isArray(deps.any) || deps.any.length === 0 || deps.any.some((id) => statuses.get(id) === 'completed');
        return all && any;
    }

    function reservationClaims(task, context, runtimeProblems) {
        const claims = [{ task: task.id, resource: task.__selected_actor_id, mode: 'exclusive', amount: 1, implicit: true, instance: `${context.instance}/actor_id` }];
        (task.reservations || []).forEach((reservation, index) => {
            const local = { ...context, instance: `${task.__instance || `/simulation/process/tasks/${task.__index}`}/reservations/${index}/resource` };
            const evaluated = evaluateValue(reservation.resource, local);
            if (!evaluated.ok) { runtimeProblems.push(evaluated.problem); return; }
            if (typeof evaluated.value !== 'string') { runtimeProblems.push(problem('reservation.resource.type', 'A reservation resource must resolve to an id string.', local.instance)); return; }
            const amount = reservation.mode === 'capacity' ? evaluateValue(reservation.amount, local) : result(1);
            if (!amount.ok) { runtimeProblems.push(amount.problem); return; }
            claims.push({ task: task.id, resource: evaluated.value, mode: reservation.mode, amount: amount.value, instance: local.instance });
        });
        return claims;
    }

    function performerType(type, index) {
        if (['actor', 'equipment', 'service'].includes(type)) return true;
        const definition = (index.sim.type_definitions || {})[type];
        if (!definition) return false;
        if (['actor', 'equipment', 'service'].includes(definition.extends)) return true;
        return (definition.traits || []).some((trait) => index.sim.type_traits?.[trait]?.can_be_actor_id === true);
    }

    function bindTaskActor(task, context, runtimeProblems) {
        const local = { ...context, instance: `${context.instance}/actor_id` };
        const selected = evaluateValue(task.actor_id, local);
        if (!selected.ok) { runtimeProblems.push(selected.problem); return false; }
        if (selected.kind !== 'string' || !selected.value) {
            runtimeProblems.push(problem('task.actor.type', `Task '${task.id}' actor_id must resolve to an object id string.`, local.instance, { task_id: task.id })); return false;
        }
        const actor = context.state.objects.get(selected.value);
        if (!actor || !performerType(actor.type, context.index)) {
            runtimeProblems.push(problem('task.reference.invalid_actor', `Task '${task.id}' selected '${selected.value}', which is not a live performer object.`, local.instance, { task_id: task.id, actor_id: selected.value })); return false;
        }
        task.__selected_actor_id = selected.value;
        const record = context.state.taskRuntime.get(task.id) || {};
        const selection = normalizeValueExpression(task.actor_id);
        const policy = selection.ok && selection.kind === 'select_member' ? selection.specification.policy : 'value';
        record.selected_actor_id = selected.value;
        record.assignment_history = (record.assignment_history || []).concat([{ actor_id: selected.value, selected_at: context.now, policy }]);
        context.state.taskRuntime.set(task.id, record);
        return true;
    }

    function validateClaims(candidateTasks, claimMap, state, runtimeProblems) {
        const blocked = new Set();
        const allNew = candidateTasks.flatMap((task) => claimMap.get(task.id) || []);
        allNew.forEach((claim) => {
            const entity = state.objects.get(claim.resource) || state.locations.get(claim.resource);
            if (!entity) { runtimeProblems.push(problem('reservation.resource.invalid', `Reservation target '${claim.resource}' is not a live world object or location.`, claim.instance, { resource: claim.resource })); blocked.add(claim.task); return; }
            const active = state.reservations.filter((entry) => entry.resource === claim.resource);
            const peers = allNew.filter((entry) => entry.resource === claim.resource && entry.task !== claim.task);
            if (claim.mode === 'exclusive') {
                if (active.length || peers.length) { runtimeProblems.push(problem('reservation.exclusive.conflict', `Exclusive reservation '${claim.resource}' conflicts.`, claim.instance, { resource: claim.resource })); blocked.add(claim.task); peers.forEach((entry) => blocked.add(entry.task)); }
                return;
            }
            const capacity = entity.properties && entity.properties.capacity;
            if (typeof capacity !== 'number' || capacity < 0 || typeof claim.amount !== 'number' || claim.amount <= 0) { runtimeProblems.push(problem('reservation.capacity.invalid', `Capacity reservation '${claim.resource}' requires positive numeric amount and numeric non-negative properties.capacity.`, claim.instance)); blocked.add(claim.task); return; }
            const used = active.reduce((sum, entry) => sum + entry.amount, 0) + allNew.filter((entry) => entry.resource === claim.resource && entry.mode === 'capacity').reduce((sum, entry) => sum + entry.amount, 0);
            if (used > capacity) { runtimeProblems.push(problem('reservation.capacity.exceeded', `Reservations for '${claim.resource}' exceed capacity ${capacity}.`, claim.instance, { resource: claim.resource, capacity, used })); blocked.add(claim.task); peers.forEach((entry) => blocked.add(entry.task)); }
            if (active.some((entry) => entry.mode === 'exclusive') || peers.some((entry) => entry.mode === 'exclusive')) { blocked.add(claim.task); }
        });
        return blocked;
    }

    function stableInstanceToken(value) {
        let hash = 2166136261;
        for (const character of String(value)) {
            hash ^= character.charCodeAt(0);
            hash = Math.imul(hash, 16777619);
        }
        return (hash >>> 0).toString(36);
    }

    function taskInstance(task, index, suffix) {
        const base = task.__instance || `${index.tasksBase}/${task.__index}`;
        return suffix ? `${base}/${suffix}` : base;
    }

    function replayWithTimings(index, initialTimings, until, timingProblems) {
        const runtimeProblems = [];
        const state = makeInitialState(index); const history = [];
        const tasks = [...index.tasks.values()].map((task, indexValue) => ({ ...task, __index: indexValue }));
        tasks.forEach((task) => index.tasks.set(task.id, task));
        const instancesByPair = new Map();
        let timings = initialTimings;
        const initialStart = parseTaskStart((index.sim.config || {}).start_time);
        history.push({ time: initialStart.ok ? initialStart.startMinutes : -Infinity, state: cloneState(state) });

        function transition(task, next, time) {
            const current = state.statuses.get(task.id);
            const allowed = (current === 'pending' && ['skipped', 'blocked', 'active', 'cancelled'].includes(next)) || (current === 'active' && ['completed', 'interrupted'].includes(next));
            if (!allowed) {
                runtimeProblems.push(problem('task.lifecycle.transition.invalid', `Illegal task lifecycle transition '${current}' to '${next}' for '${task.id}'.`, taskInstance(task, index), { task_id: task.id, from: current, to: next, time }));
                return false;
            }
            state.statuses.set(task.id, next); return true;
        }

        function restoreTemporary(tasksToClean) {
            tasksToClean.forEach((task) => {
                const captures = state.temporary.get(task.id) || [];
                captures.forEach((capture) => { const entity = state.objects.get(capture.id); if (entity) restoreProperty(entity, capture); });
                state.temporary.delete(task.id);
            });
        }

        function captureProgress(task, time, snapshot) {
            const record = state.taskRuntime.get(task.id) || {};
            record.actual_end = time;
            if (task.progress !== undefined) {
                const captured = evaluateValue(task.progress, expressionContext(index, snapshot || state, timings, task, time, history, taskInstance(task, index, 'progress')));
                if (captured.ok) record.progress = clone(captured.value); else runtimeProblems.push(captured.problem);
            }
            state.taskRuntime.set(task.id, record);
        }

        function interruptUntilStable(time) {
            let changed = false;
            for (let pass = 0; pass <= tasks.length; pass += 1) {
                const snapshot = cloneState(state); const failing = [];
                tasks.forEach((task) => {
                    if (state.statuses.get(task.id) !== 'active' || task.while === undefined) return;
                    const condition = evaluateCondition(task.while, expressionContext(index, snapshot, timings, task, time, history, taskInstance(task, index, 'while')));
                    if (!condition.ok) { runtimeProblems.push(condition.problem); failing.push(task); }
                    else if (!condition.value) failing.push(task);
                });
                if (!failing.length) return changed;
                failing.forEach((task) => captureProgress(task, time, snapshot));
                failing.forEach((task) => {
                    transition(task, 'interrupted', time); state.active.delete(task.id);
                    state.reservations = state.reservations.filter((claim) => claim.task !== task.id);
                });
                restoreTemporary(failing); changed = true;
            }
            runtimeProblems.push(problem('task.while.stabilization.failed', `Active invariants did not stabilize at ${time}.`, index.tasksBase, { time }));
            return changed;
        }

        function refreshTimings() {
            const resolution = resolveTimingGraph(index.sim, { index, statuses: state.statuses, taskRuntime: state.taskRuntime });
            timings = resolution.timings;
            return resolution;
        }

        function synchronizeInstances(time) {
            const definitions = Array.isArray(index.sim.process?.work_definitions) ? index.sim.process.work_definitions : [];
            definitions.forEach((definition, definitionIndex) => {
                if (!plain(definition) || !plain(definition.instantiate) || !plain(definition.task)) return;
                const trigger = definition.instantiate;
                const definitionBase = `/simulation/process/work_definitions/${definitionIndex}`;
                const context = expressionContext(index, state, timings, null, time, history, `${definitionBase}/instantiate`);
                const evaluated = collectionMembers(trigger.for_each, context);
                if (!evaluated.ok) { runtimeProblems.push(evaluated.problem); return; }
                const sourceDefinition = collectionDefinition(index, trigger.for_each);
                const cutoff = sourceDefinition?.open === true ? parseTaskStart(sourceDefinition.closes_at) : null;
                const accepting = !cutoff?.ok || time < cutoff.startMinutes;
                const liveIds = new Set(evaluated.members.map((entry) => entry.id));
                evaluated.members.forEach((member) => {
                    if (!accepting) return;
                    const pair = `${definition.id}\u0000${member.id}`;
                    if (instancesByPair.has(pair)) return;
                    const offset = own(trigger, 'offset') ? parseOffset(trigger.offset, (index.sim.config || {}).time_unit) : { ok: true, minutes: 0 };
                    if (!offset.ok) { runtimeProblems.push(problem('instance.trigger.offset.invalid', `Work definition '${definition.id}' has invalid instantiation offset.`, `${definitionBase}/instantiate/offset`)); return; }
                    const id = `${definition.id}:${stableInstanceToken(member.id)}`;
                    if (index.tasks.has(id)) { runtimeProblems.push(problem('instance.identity.collision', `Runtime instance id '${id}' collides with another task.`, definitionBase, { definition_id: definition.id, correlation_id: member.id, instance_id: id })); return; }
                    const instance = {
                        ...clone(definition.task), id,
                        __index: tasks.length,
                        __instance: `${definitionBase}/task`,
                        __runtime_instance: true,
                        __definition_id: definition.id,
                        __correlation_id: member.id,
                        __correlation_collection: trigger.for_each,
                        __bindings: { [trigger.as]: member },
                        __runtime_start: time + offset.minutes
                    };
                    tasks.push(instance); index.tasks.set(id, instance);
                    index.ids.set(id, { entity: instance, kind: 'task', parts: ['simulation', 'process', 'work_definitions', definitionIndex, 'task'] });
                    state.statuses.set(id, 'pending');
                    state.taskRuntime.set(id, {
                        actual_end: undefined, progress: undefined,
                        definition_id: definition.id, correlation_id: member.id,
                        correlation_collection: trigger.for_each, instantiated_at: time,
                        assignment_history: []
                    });
                    instancesByPair.set(pair, instance);
                });
                if (trigger.cancel_pending_on_exit === true) {
                    instancesByPair.forEach((instance, pair) => {
                        if (instance.__definition_id !== definition.id || liveIds.has(instance.__correlation_id) || state.statuses.get(instance.id) !== 'pending') return;
                        transition(instance, 'cancelled', time);
                        const record = state.taskRuntime.get(instance.id) || {};
                        record.actual_end = time; record.cancelled_reason = 'collection_exit';
                        state.taskRuntime.set(instance.id, record);
                    });
                }
            });
        }

        let currentTime = -Infinity;
        synchronizeInstances(initialStart.ok ? initialStart.startMinutes : 0);
        for (let eventCount = 0; eventCount <= tasks.length * 4 + Object.keys(index.sim.collections || {}).length + 4; eventCount += 1) {
            const resolution = refreshTimings();
            const invalidTimingTasks = new Set([...(timingProblems || []), ...resolution.problems]
                .filter((entry) => ['temporal.scheduling.dependency_violation', 'timing.offset.violation'].includes(entry.metric_id))
                .map((entry) => entry.context && entry.context.task_id).filter(Boolean));
            const nextCompletion = tasks
                .filter((task) => state.statuses.get(task.id) === 'active')
                .map((task) => timings.get(task.id)?.end).filter((time) => Number.isFinite(time) && time >= currentTime);
            const nextStart = tasks
                .filter((task) => state.statuses.get(task.id) === 'pending' && timings.get(task.id)?.resolved)
                .map((task) => timings.get(task.id).start).filter((time) => Number.isFinite(time) && time >= currentTime);
            const nextCutoff = Object.values(index.sim.collections || {})
                .filter((definition) => definition?.open === true)
                .map((definition) => parseTaskStart(definition.closes_at))
                .filter((parsed) => parsed.ok && parsed.startMinutes > currentTime)
                .map((parsed) => parsed.startMinutes);
            const next = Math.min(...nextCompletion, ...nextStart, ...nextCutoff);
            if (!Number.isFinite(next) || next > until) break;
            currentTime = next;

            // A. Planned completions. Completion wins over any same-time invariant change.
            const finishing = tasks.filter((task) => state.statuses.get(task.id) === 'active' && timings.get(task.id)?.end === currentTime);
            restoreTemporary(finishing);
            const finishSnapshot = cloneState(state);
            const finishWrites = finishing.flatMap((task) => prepareInteractions(task, 'completion', expressionContext(index, finishSnapshot, timings, task, currentTime, history), runtimeProblems, false));
            commitWrites(state, finishWrites, runtimeProblems);
            const postCompletion = cloneState(state);
            finishing.forEach((task) => {
                transition(task, 'completed', currentTime); captureProgress(task, currentTime, postCompletion);
                state.active.delete(task.id); state.reservations = state.reservations.filter((claim) => claim.task !== task.id);
            });

            // B-D can expose a same-time actual_end anchor, start recovery work,
            // and then interrupt more work. Iterate without inventing a new time.
            interruptUntilStable(currentTime);
            synchronizeInstances(currentTime);
            for (let sameTimePass = 0; sameTimePass <= tasks.length + 1; sameTimePass += 1) {
                const sameResolution = refreshTimings();
                const scheduled = tasks.filter((task) => state.statuses.get(task.id) === 'pending' && timings.get(task.id)?.resolved && timings.get(task.id).start === currentTime);
                if (!scheduled.length) break;
                const candidates = [];
                scheduled.forEach((task) => {
                    const base = taskInstance(task, index);
                    if (!dependencyReady(task, state.statuses)) { transition(task, 'blocked', currentTime); runtimeProblems.push(problem('temporal.scheduling.dependency_violation', `Dependencies for task '${task.id}' are not completed at its scheduled start.`, `${base}/start`, { task_id: task.id })); return; }
                    const context = expressionContext(index, state, timings, task, currentTime, history, base);
                    if (!bindTaskActor(task, context, runtimeProblems)) { transition(task, 'blocked', currentTime); return; }
                    if (task.when !== undefined) { const condition = evaluateCondition(task.when, context); if (!condition.ok) { runtimeProblems.push(condition.problem); transition(task, 'blocked', currentTime); return; } if (!condition.value) { transition(task, 'skipped', currentTime); return; } }
                    if (task.requires !== undefined) { const condition = evaluateCondition(task.requires, context); if (!condition.ok || !condition.value) { runtimeProblems.push(condition.ok ? problem('task.requires.failed', `Required condition for task '${task.id}' is false.`, context.instance) : condition.problem); transition(task, 'blocked', currentTime); return; } }
                    if (task.while !== undefined) { const condition = evaluateCondition(task.while, context); if (!condition.ok || !condition.value) { if (!condition.ok) runtimeProblems.push(condition.problem); else runtimeProblems.push(problem('task.while.failed_at_start', `Active invariant for task '${task.id}' is false before activation.`, `${base}/while`, { task_id: task.id })); transition(task, 'blocked', currentTime); return; } }
                    if (task.continues && state.statuses.get(task.continues.task) !== 'interrupted') { runtimeProblems.push(problem('task.continues.source_not_interrupted', `Task '${task.id}' can start only after '${task.continues.task}' is interrupted.`, `${base}/continues/task`, { task_id: task.id, source_task_id: task.continues.task })); transition(task, 'blocked', currentTime); return; }
                    if (invalidTimingTasks.has(task.id) || sameResolution.problems.some((entry) => ['temporal.scheduling.dependency_violation', 'timing.offset.violation'].includes(entry.metric_id) && entry.context?.task_id === task.id)) { transition(task, 'blocked', currentTime); return; }
                    candidates.push(task);
                });
                const claimMap = new Map(candidates.map((task) => [task.id, reservationClaims(task, expressionContext(index, state, timings, task, currentTime, history), runtimeProblems)]));
                const blocked = validateClaims(candidates, claimMap, state, runtimeProblems);
                const starting = candidates.filter((task) => !blocked.has(task.id));
                candidates.filter((task) => blocked.has(task.id)).forEach((task) => transition(task, 'blocked', currentTime));
                const startSnapshot = cloneState(state);
                const startWrites = starting.flatMap((task) => prepareInteractions(task, 'start', expressionContext(index, startSnapshot, timings, task, currentTime, history), runtimeProblems, false).concat(prepareInteractions(task, 'start', expressionContext(index, startSnapshot, timings, task, currentTime, history), runtimeProblems, true)));
                commitWrites(state, startWrites, runtimeProblems);
                starting.forEach((task) => { transition(task, 'active', currentTime); state.active.set(task.id, clone(timings.get(task.id))); state.reservations.push(...(claimMap.get(task.id) || [])); });
                interruptUntilStable(currentTime);
                synchronizeInstances(currentTime);
            }
            history.push({ time: currentTime, state: cloneState(state) });
        }
        // not_overlap applies only to tasks that actually ran.
        tasks.forEach((task) => (task.timing || []).forEach((constraint, indexValue) => {
            if (!plain(constraint) || constraint.relation !== 'not_overlap') return;
            const otherId = constraint.with && constraint.with.task; const other = index.tasks.get(otherId);
            if (!other || !['active', 'completed', 'interrupted'].includes(state.statuses.get(task.id)) || !['active', 'completed', 'interrupted'].includes(state.statuses.get(otherId))) return;
            const a = timings.get(task.id); const b = timings.get(otherId);
            const aEnd = state.taskRuntime.get(task.id)?.actual_end ?? a.end;
            const bEnd = state.taskRuntime.get(otherId)?.actual_end ?? b.end;
            if (a.start < bEnd && b.start < aEnd) runtimeProblems.push(problem('timing.not_overlap.violation', `Tasks '${task.id}' and '${otherId}' overlap.`, taskInstance(task, index, `timing/${indexValue}`)));
        }));
        return { index, timings, state, problems: runtimeProblems, history };
    }

    function timingSignature(timings) {
        return JSON.stringify([...timings].map(([id, timing]) => [id, timing.resolved ? timing.start : null, timing.error && timing.error.metric_id]));
    }

    function replay(documentValue, options) {
        const index = buildIndex(documentValue);
        const resolution = resolveTimingGraph(documentValue, { index });
        const until = options && Number.isFinite(options.until) ? options.until : Infinity;
        const selectedRun = replayWithTimings(index, resolution.timings, until, resolution.problems);
        const finalResolution = resolveTimingGraph(documentValue, { index, statuses: selectedRun.state.statuses, taskRuntime: selectedRun.state.taskRuntime });
        selectedRun.timings = finalResolution.timings;
        const runtimeProblems = [...index.problems, ...validateStatic(index), ...finalResolution.problems, ...selectedRun.problems];
        const seenProblems = new Set();
        const uniqueProblems = runtimeProblems.filter((entry) => {
            const key = `${entry.metric_id}|${entry.instance}|${entry.detail}`;
            if (seenProblems.has(key)) return false;
            seenProblems.add(key);
            return true;
        });
        return { index, timings: finalResolution.timings, state: selectedRun.state, problems: uniqueProblems, history: selectedRun.history };
    }

    function serialiseState(run) {
        const now = run.history.length ? run.history[run.history.length - 1].time : Infinity;
        const collectionSnapshot = {};
        const collectionBoundaries = {};
        Object.keys(run.index.sim.collections || {}).forEach((collectionId) => {
            const evaluated = collectionMembers(collectionId, expressionContext(run.index, run.state, run.timings, null, now, run.history, `/simulation/collections/${ptrEscape(collectionId)}`));
            collectionSnapshot[collectionId] = evaluated.ok ? evaluated.members.map((member) => member.id) : [];
            const definition = collectionDefinition(run.index, collectionId);
            const cutoff = definition?.open === true ? parseTaskStart(definition.closes_at) : null;
            collectionBoundaries[collectionId] = cutoff?.ok ? { open: now < cutoff.startMinutes, closes_at: cutoff.startMinutes } : { open: false };
        });
        const taskInstances = [...run.index.tasks.values()].filter((task) => task.__runtime_instance).map((task) => ({
            id: task.id,
            definition_id: task.__definition_id,
            correlation_id: task.__correlation_id,
            correlation_collection: task.__correlation_collection,
            selected_actor_id: run.state.taskRuntime.get(task.id)?.selected_actor_id,
            status: run.state.statuses.get(task.id),
            timing: clone(run.timings.get(task.id)),
            assignment_history: clone(run.state.taskRuntime.get(task.id)?.assignment_history || [])
        }));
        return {
            objects: Object.fromEntries([...run.state.objects].map(([id, value]) => [id, clone(value)])),
            locations: Object.fromEntries([...run.state.locations].map(([id, value]) => [id, clone(value)])),
            task_statuses: Object.fromEntries(run.state.statuses),
            task_runtime: Object.fromEntries([...run.state.taskRuntime].map(([id, value]) => [id, clone(value)])),
            active_tasks: Object.fromEntries([...run.state.active].map(([id, value]) => [id, clone(value)])),
            reservations: clone(run.state.reservations),
            collections: collectionSnapshot,
            collection_boundaries: collectionBoundaries,
            work_definitions: clone(run.index.sim.process?.work_definitions || []),
            task_instances: taskInstances,
            problems: run.problems
        };
    }

    function snapshotAt(documentValue, time) {
        const parsed = typeof time === 'number' ? time : parseTaskStart(time);
        const until = typeof parsed === 'number' ? parsed : parsed && parsed.ok ? parsed.startMinutes : Infinity;
        return serialiseState(replay(documentValue, { until }));
    }

    function resolveTimings(documentValue) {
        const run = replay(documentValue);
        return { index: run.index, timings: run.timings, problems: run.problems.filter((entry) => /^(timing|temporal\.scheduling|dependency)\./.test(entry.metric_id)) };
    }

    function validate(documentValue) { const run = replay(documentValue); return { valid: run.problems.every((entry) => entry.severity !== 'error'), problems: run.problems, state: serialiseState(run), timings: run.timings }; }

    return { parseDurationToMinutes, parseTaskStart, parseOffset, formatCompactReference, normalizeValueExpression, isValueReference, evaluateValue, evaluateCondition, buildIndex, resolveTimings, replay, serialiseState, snapshotAt, validate, OBJECT_FIELDS: [...OBJECT_FIELDS], TASK_FIELDS: [...TASK_FIELDS], LOCATION_FIELDS: [...LOCATION_FIELDS] };
}));
