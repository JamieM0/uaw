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
    const OBJECT_FIELDS = new Set(['id', 'type', 'name', 'emoji', 'location', 'state_library', 'appearance']);
    const TASK_FIELDS = new Set(['id', 'actor_id', 'start', 'end', 'duration', 'location', 'description', 'priority', 'tags']);
    const LOCATION_FIELDS = new Set(['id', 'name', 'parent_id', 'shape', 'coordinates', 'position', 'emoji']);

    const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
    const plain = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
    const clone = (value) => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
    const ptrEscape = (value) => String(value).replace(/~/g, '~0').replace(/\//g, '~1');
    const pointer = (parts) => '/' + parts.map(ptrEscape).join('/');
    const simOf = (documentValue) => plain(documentValue && documentValue.simulation) ? documentValue.simulation : documentValue;

    function problem(metricId, detail, instance, context, severity) {
        return {
            type: `${NS}/errors/${metricId}`,
            title: metricId.split('.').map((part) => part.replace(/_/g, ' ')).join(' '),
            severity: severity || 'error',
            detail,
            instance: instance || '/',
            metric_id: metricId,
            context: context || {},
            suggestions: []
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
    function failure(metricId, detail, instance, context) { return { ok: false, problem: problem(metricId, detail, instance, context) }; }

    function isValueReference(value) {
        if (!plain(value)) return false;
        const keys = Object.keys(value);
        if (keys.length === 1 && (own(value, 'clock') || own(value, 'literal'))) return true;
        if (keys.length !== 2) return false;
        return (own(value, 'object') || own(value, 'task') || own(value, 'location'))
            && (own(value, 'field') || own(value, 'property'));
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
            reservations: clone(state.reservations), temporary: new Map([...state.temporary].map(([id, value]) => [id, clone(value)]))
        };
    }

    function entityFor(reference, context) {
        if (own(reference, 'object')) {
            let id = reference.object;
            if (id === 'current') {
                if (!context.currentTask) return failure('reference.current.unavailable', "'object: current' requires a current task.", context.instance);
                id = context.currentTask.actor_id;
            }
            const entity = context.state.objects.get(id);
            return entity ? { ok: true, entity, id, kind: 'object', allowlist: OBJECT_FIELDS } : failure('reference.object.missing', `Object '${id}' is not live.`, context.instance, { object_id: id });
        }
        if (own(reference, 'location')) {
            const entity = context.state.locations.get(reference.location);
            return entity ? { ok: true, entity, id: reference.location, kind: 'location', allowlist: LOCATION_FIELDS } : failure('reference.location.missing', `Location '${reference.location}' does not exist.`, context.instance);
        }
        let id = reference.task;
        if (id === 'current') id = context.currentTask && context.currentTask.id;
        const entity = context.index.tasks.get(id);
        return entity ? { ok: true, entity, id, kind: 'task', allowlist: TASK_FIELDS } : failure('reference.task.missing', `Task '${id}' does not exist.`, context.instance);
    }

    function evaluateValue(expression, context) {
        if (!isValueReference(expression)) {
            if (plain(expression) && ['object', 'task', 'location', 'clock', 'field', 'property'].some((key) => own(expression, key))) {
                return failure('reference.shape.invalid', 'This object resembles a value reference but is not a valid WorkSpec 2.1 reference. Wrap it in {literal: ...} to use it as data.', context.instance);
            }
            return result(expression);
        }
        if (own(expression, 'literal')) return result(expression.literal);
        if (own(expression, 'clock')) return expression.clock === 'now'
            ? result(context.now, 'instant')
            : failure('reference.clock.invalid', "The only clock reference is {clock:'now'}.", context.instance);
        const selected = entityFor(expression, context);
        if (!selected.ok) return selected;
        if (own(expression, 'field')) {
            if (!selected.allowlist.has(expression.field)) return failure('reference.field.invalid', `Field '${expression.field}' is not referenceable on ${selected.kind}.`, context.instance, { field: expression.field, kind: selected.kind });
            if (selected.kind === 'task') {
                const timing = context.timings.get(selected.id);
                if (expression.field === 'end') return result(timing && timing.end, 'instant');
                if (expression.field === 'start') return result(timing && timing.start, 'instant');
                if (expression.field === 'duration') return result(timing && timing.duration, 'duration');
            }
            if (!own(selected.entity, expression.field)) return failure('reference.field.missing', `${selected.kind} '${selected.id}' has no field '${expression.field}'.`, context.instance);
            return result(selected.entity[expression.field]);
        }
        if (selected.kind === 'task') return failure('reference.property.invalid_kind', 'Task references do not have a properties bag.', context.instance);
        const properties = plain(selected.entity.properties) ? selected.entity.properties : {};
        if (!own(properties, expression.property)) return failure('reference.property.missing', `${selected.kind} '${selected.id}' has no property '${expression.property}'.`, context.instance, { property: expression.property });
        const propertyKind = context.state.kinds.get(`${selected.kind}:${selected.id}:${expression.property}`);
        if (!propertyKind && typeof properties[expression.property] === 'string') {
            const instant = parseTime(properties[expression.property]);
            if (instant !== null) return result(instant, 'instant');
        }
        return result(properties[expression.property], propertyKind);
    }

    function equalValues(left, right) {
        if (left.kind !== right.kind) return null;
        if (left.kind === 'object' || left.kind === 'array') return JSON.stringify(left.value) === JSON.stringify(right.value);
        return left.value === right.value;
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

    function taskTimingReference(reference) {
        if (!plain(reference) || typeof reference.task !== 'string' || typeof reference.field !== 'string') return null;
        if (!['start', 'end'].includes(reference.field)) return null;
        return { task: reference.task, field: reference.field };
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
        if (!isValueReference(reference) || own(reference, 'literal')) {
            [literal, reference] = [reference, literal];
        }
        if (!isValueReference(reference) || own(reference, 'literal') || isValueReference(literal)) return null;
        return { key: JSON.stringify(reference), operator, value: clone(literal) };
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
        const entries = [...index.tasks.entries()];
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

    function resolveTimingGraph(documentValue, options) {
        const index = options && options.index ? options.index : buildIndex(documentValue);
        const statuses = options && options.statuses instanceof Map ? options.statuses : null;
        const unit = index.sim.config && index.sim.config.time_unit;
        const timings = new Map(); const problems = []; const taskIndexes = new Map();
        [...index.tasks.entries()].forEach(([id, task], taskIndex) => {
            taskIndexes.set(id, taskIndex);
            const duration = parseDurationToMinutes(task.duration, unit);
            const authored = own(task, 'start'); const parsedStart = authored ? parseTaskStart(task.start) : null;
            const timing = {
                task_id: id,
                start: parsedStart && parsedStart.ok ? parsedStart.startMinutes : null,
                end: null,
                completion: null,
                duration: duration.ok ? duration.minutes : null,
                source: authored ? 'explicit' : 'derived',
                start_source: authored ? 'explicit' : 'derived',
                explicit: authored,
                derived: !authored,
                resolved: Boolean(parsedStart && parsedStart.ok && duration.ok),
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
            const taskRef = taskTimingReference(reference);
            if (!taskRef) return null;
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
                (task.timing || []).forEach((constraint, constraintIndex) => {
                    if (!plain(constraint) || constraint.relation !== 'offset') return;
                    const reference = taskTimingReference(constraint.relative_to);
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
                        timing.lower_bounds.push({ value, kind: 'timing', task: taskTimingReference(constraint.relative_to)?.task, field: taskTimingReference(constraint.relative_to)?.field, constraint: constraintIndex });
                    }
                }
                if (max && max.ok) timing.upper_bounds.push({ value: base + max.minutes - (constraint.event === 'completion' ? timing.duration : 0), kind: 'timing', task: taskTimingReference(constraint.relative_to)?.task, field: taskTimingReference(constraint.relative_to)?.field, constraint: constraintIndex });
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
                    const ref = taskTimingReference(constraint.relative_to); if (ref) edges.push(ref.task);
                }
            });
            return [...new Set(edges)].filter((edge) => timings.get(edge) && !timings.get(edge).resolved);
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
        timings.forEach((timing, id) => { if (!timing.resolved && timing.derived && timing.duration !== null) visit(id); });

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

    function validateExpressionShape(expression, index, instance) {
        const problems = [];
        if (!plain(expression)) return problems;
        const selectorLike = ['object', 'task', 'location', 'clock', 'field', 'property', 'literal'].some((key) => own(expression, key));
        if (!selectorLike) return problems;
        if (!isValueReference(expression)) {
            problems.push(problem('reference.shape.invalid', 'Invalid WorkSpec 2.1 value reference shape; wrap reference-shaped data in {literal: value}.', instance));
            return problems;
        }
        if (own(expression, 'literal')) return problems;
        if (own(expression, 'clock')) {
            if (expression.clock !== 'now') problems.push(problem('reference.clock.invalid', "The only clock reference is {clock:'now'}.", instance));
            return problems;
        }
        const selector = own(expression, 'object') ? 'object' : own(expression, 'task') ? 'task' : 'location';
        const id = expression[selector];
        const allowlist = selector === 'object' ? OBJECT_FIELDS : selector === 'task' ? TASK_FIELDS : LOCATION_FIELDS;
        if (own(expression, 'field') && !allowlist.has(expression.field)) problems.push(problem('reference.field.invalid', `Field '${expression.field}' is not referenceable on ${selector}.`, instance));
        if (own(expression, 'property') && (selector === 'task' || typeof expression.property !== 'string' || !expression.property || expression.property.includes('.'))) problems.push(problem('reference.property.invalid', `Invalid direct property reference on ${selector}.`, instance));
        if (selector === 'location' && id === 'current') problems.push(problem('reference.location.current_invalid', "'current' is only valid for object and task selectors.", instance));
        if (id !== 'current') {
            const declared = index.ids.get(id);
            const acceptable = selector === 'object' ? declared?.kind === 'object' : selector === 'task' ? declared?.kind === 'task' : declared?.kind === 'location';
            if (!acceptable) problems.push(problem(`reference.${selector}.missing`, `${selector} '${id}' is not declared as a ${selector}.`, instance));
        }
        return problems;
    }

    function validateConditionShape(condition, index, instance) {
        const problems = [];
        if (typeof condition === 'boolean') return problems;
        if (!plain(condition) || Object.keys(condition).length !== 1) return [problem('condition.shape.invalid', 'A condition must be a boolean or contain exactly one operator.', instance)];
        const operator = Object.keys(condition)[0]; const operands = condition[operator];
        if (COMPARISONS.has(operator) || operator === 'contains') {
            if (!Array.isArray(operands) || operands.length !== 2) return [problem('condition.operator.arity', `Operator '${operator}' requires exactly two operands.`, instance)];
            operands.forEach((operand, i) => problems.push(...validateExpressionShape(operand, index, `${instance}/${operator}/${i}`)));
            const literalKinds = operands.map((operand) => isValueReference(operand) && !own(operand, 'literal') ? null : kindOf(isValueReference(operand) ? operand.literal : operand));
            if (literalKinds[0] && literalKinds[1]) {
                if (operator === 'contains') {
                    const compatible = (literalKinds[0] === 'array') || (literalKinds[0] === 'string' && literalKinds[1] === 'string');
                    if (!compatible) problems.push(problem('condition.type.incompatible', "'contains' requires an array/member or string/string pair.", instance));
                } else if (literalKinds[0] !== literalKinds[1] || (!['==', '!='].includes(operator) && literalKinds[0] !== 'number')) {
                    problems.push(problem('condition.type.incompatible', `Operator '${operator}' has incompatible literal operand types.`, instance));
                }
            }
            return problems;
        }
        if (operator === 'all' || operator === 'any') {
            if (!Array.isArray(operands) || operands.length === 0) return [problem('condition.operator.arity', `Operator '${operator}' requires a non-empty array.`, instance)];
            operands.forEach((entry, i) => problems.push(...validateConditionShape(entry, index, `${instance}/${operator}/${i}`)));
            return problems;
        }
        if (operator === 'not') return validateConditionShape(operands, index, `${instance}/not`);
        if (operator === 'held_for') {
            if (!plain(operands) || !own(operands, 'condition') || !own(operands, 'duration') || Object.keys(operands).some((key) => !['condition', 'duration'].includes(key))) return [problem('condition.held_for.shape', "'held_for' requires only condition and duration.", instance)];
            if (!parseDurationToMinutes(operands.duration, (index.sim.config || {}).time_unit).ok) problems.push(problem('condition.held_for.duration', "'held_for' has an invalid duration.", `${instance}/held_for/duration`));
            problems.push(...validateConditionShape(operands.condition, index, `${instance}/held_for/condition`));
            return problems;
        }
        return [problem('condition.operator.invalid', `Unknown condition operator '${operator}'.`, instance)];
    }

    function validateStatic(index) {
        const problems = []; const unit = (index.sim.config || {}).time_unit;
        [...index.tasks.values()].forEach((task, taskIndex) => {
            const base = `${index.tasksBase}/${taskIndex}`;
            if (task.when !== undefined) problems.push(...validateConditionShape(task.when, index, `${base}/when`));
            if (task.requires !== undefined) problems.push(...validateConditionShape(task.requires, index, `${base}/requires`));
            (task.timing || []).forEach((constraint, i) => {
                const at = `${base}/timing/${i}`;
                if (!plain(constraint) || !['offset', 'not_overlap'].includes(constraint.relation)) { problems.push(problem('timing.constraint.invalid', 'Unknown or malformed timing constraint.', at)); return; }
                if (constraint.relation === 'offset') {
                    if (!['start', 'completion'].includes(constraint.event)) problems.push(problem('timing.event.invalid', "Offset event must be 'start' or 'completion'.", `${at}/event`));
                    problems.push(...validateExpressionShape(constraint.relative_to, index, `${at}/relative_to`));
                    if (!own(constraint, 'min_offset') && !own(constraint, 'max_offset')) problems.push(problem('timing.offset.bounds_missing', 'An offset constraint requires min_offset or max_offset.', at));
                    const min = own(constraint, 'min_offset') ? parseOffset(constraint.min_offset, unit) : null; const max = own(constraint, 'max_offset') ? parseOffset(constraint.max_offset, unit) : null;
                    if ((min && !min.ok) || (max && !max.ok)) problems.push(problem('timing.offset.invalid', 'Invalid relative time offset.', at));
                    if (min?.ok && max?.ok && min.minutes > max.minutes) problems.push(problem('timing.offset.range_invalid', 'min_offset cannot exceed max_offset.', at));
                } else if (!plain(constraint.with) || typeof constraint.with.task !== 'string' || !index.tasks.has(constraint.with.task)) problems.push(problem('timing.not_overlap.reference', 'not_overlap requires an existing task reference.', `${at}/with`));
            });
            (task.reservations || []).forEach((reservation, i) => {
                const at = `${base}/reservations/${i}`;
                if (!plain(reservation) || !['exclusive', 'capacity'].includes(reservation.mode)) { problems.push(problem('reservation.shape.invalid', 'Reservation mode must be exclusive or capacity.', at)); return; }
                problems.push(...validateExpressionShape(reservation.resource, index, `${at}/resource`));
                if (reservation.mode === 'capacity') {
                    if (!own(reservation, 'amount')) problems.push(problem('reservation.amount.missing', 'Capacity reservation requires amount.', `${at}/amount`));
                    else problems.push(...validateExpressionShape(reservation.amount, index, `${at}/amount`));
                } else if (own(reservation, 'amount')) problems.push(problem('reservation.amount.invalid', 'Exclusive reservation does not use amount.', `${at}/amount`));
            });
            (task.interactions || []).forEach((interaction, i) => {
                const at = `${base}/interactions/${i}`; if (!plain(interaction)) return;
                if (interaction.when !== undefined) problems.push(...validateConditionShape(interaction.when, index, `${at}/when`));
                if (interaction.at !== undefined && !['start', 'completion'].includes(interaction.at)) problems.push(problem('interaction.timing.invalid', "Interaction at must be 'start' or 'completion'.", `${at}/at`));
                if (interaction.temporary === true && interaction.action) problems.push(problem('interaction.temporary.lifecycle_invalid', 'Temporary create and delete interactions are invalid in WorkSpec 2.1.', at));
                if (interaction.temporary === true && interaction.at === 'completion') problems.push(problem('interaction.temporary.timing_invalid', "A temporary interaction cannot use at:'completion'.", at));
                if (interaction.action === 'create') {
                    Object.entries((interaction.object || {}).properties || {}).forEach(([name, value]) => problems.push(...validateExpressionShape(value, index, `${at}/object/properties/${ptrEscape(name)}`)));
                    if (interaction.object && own(interaction.object, 'location')) problems.push(...validateExpressionShape(interaction.object.location, index, `${at}/object/location`));
                } else {
                    problems.push(...validateExpressionShape(interaction.target_id, index, `${at}/target_id`));
                    Object.entries(interaction.property_changes || {}).forEach(([name, operator]) => {
                        if (!plain(operator)) return;
                        ['from', 'to', 'set', 'delta', 'multiply', 'append', 'remove'].forEach((key) => { if (own(operator, key)) problems.push(...validateExpressionShape(operator[key], index, `${at}/property_changes/${ptrEscape(name)}/${key}`)); });
                    });
                }
            });
        });
        problems.push(...boundedDependencyProblems(index));
        return problems;
    }

    function expressionContext(index, state, timings, task, now, history, instance) {
        const parsedStart = parseTaskStart((index.sim.config || {}).start_time);
        return { index, state, timings, currentTask: task, now, history, instance: instance || '/', timeUnit: (index.sim.config || {}).time_unit, simulationStart: parsedStart.ok ? parsedStart.startMinutes : -Infinity };
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
            const instance = `/simulation/process/tasks/${task.__index}/interactions/${index}`;
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
        const claims = [{ task: task.id, resource: task.actor_id, mode: 'exclusive', amount: 1, implicit: true }];
        (task.reservations || []).forEach((reservation, index) => {
            const local = { ...context, instance: `/simulation/process/tasks/${task.__index}/reservations/${index}/resource` };
            const evaluated = evaluateValue(reservation.resource, local);
            if (!evaluated.ok) { runtimeProblems.push(evaluated.problem); return; }
            if (typeof evaluated.value !== 'string') { runtimeProblems.push(problem('reservation.resource.type', 'A reservation resource must resolve to an id string.', local.instance)); return; }
            const amount = reservation.mode === 'capacity' ? evaluateValue(reservation.amount, local) : result(1);
            if (!amount.ok) { runtimeProblems.push(amount.problem); return; }
            claims.push({ task: task.id, resource: evaluated.value, mode: reservation.mode, amount: amount.value, instance: local.instance });
        });
        return claims;
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

    function replayWithTimings(index, timings, until, timingProblems) {
        const runtimeProblems = [];
        const state = makeInitialState(index); const history = [];
        const tasks = [...index.tasks.values()].map((task, indexValue) => ({ ...task, __index: indexValue })).filter((task) => timings.get(task.id)?.resolved);
        tasks.forEach((task) => index.tasks.set(task.id, task));
        const times = [...new Set(tasks.flatMap((task) => [timings.get(task.id).start, timings.get(task.id).end]))].sort((a, b) => a - b);
        const invalidTimingTasks = new Set((timingProblems || [])
            .filter((entry) => ['temporal.scheduling.dependency_violation', 'timing.offset.violation'].includes(entry.metric_id))
            .map((entry) => entry.context && entry.context.task_id)
            .filter(Boolean));
        const initialStart = parseTaskStart((index.sim.config || {}).start_time);
        history.push({ time: initialStart.ok ? initialStart.startMinutes : -Infinity, state: cloneState(state) });
        for (const time of times) {
            if (time > until) break;
            const finishing = tasks.filter((task) => state.statuses.get(task.id) === 'active' && timings.get(task.id).end === time);
            finishing.forEach((task) => {
                const captures = state.temporary.get(task.id) || [];
                captures.forEach((capture) => { const entity = state.objects.get(capture.id); if (entity) restoreProperty(entity, capture); });
                state.temporary.delete(task.id);
            });
            const finishSnapshot = cloneState(state);
            const finishWrites = finishing.flatMap((task) => prepareInteractions(task, 'completion', expressionContext(index, finishSnapshot, timings, task, time, history), runtimeProblems, false));
            commitWrites(state, finishWrites, runtimeProblems);
            finishing.forEach((task) => { state.statuses.set(task.id, 'completed'); state.active.delete(task.id); state.reservations = state.reservations.filter((claim) => claim.task !== task.id); });

            const scheduled = tasks.filter((task) => state.statuses.get(task.id) === 'pending' && timings.get(task.id).start === time);
            const candidates = [];
            scheduled.forEach((task) => {
                if (!dependencyReady(task, state.statuses)) { state.statuses.set(task.id, 'blocked'); runtimeProblems.push(problem('temporal.scheduling.dependency_violation', `Dependencies for task '${task.id}' are not completed at its scheduled start.`, `${index.tasksBase}/${task.__index}/start`, { task_id: task.id })); return; }
                const context = expressionContext(index, state, timings, task, time, history, `/simulation/process/tasks/${task.__index}`);
                if (task.when !== undefined) { const condition = evaluateCondition(task.when, context); if (!condition.ok) { runtimeProblems.push(condition.problem); state.statuses.set(task.id, 'blocked'); return; } if (!condition.value) { state.statuses.set(task.id, 'skipped'); return; } }
                if (task.requires !== undefined) { const condition = evaluateCondition(task.requires, context); if (!condition.ok || !condition.value) { runtimeProblems.push(condition.ok ? problem('task.requires.failed', `Required condition for task '${task.id}' is false.`, context.instance) : condition.problem); state.statuses.set(task.id, 'blocked'); return; } }
                if (invalidTimingTasks.has(task.id)) { state.statuses.set(task.id, 'blocked'); return; }
                candidates.push(task);
            });
            const claimMap = new Map(candidates.map((task) => [task.id, reservationClaims(task, expressionContext(index, state, timings, task, time, history), runtimeProblems)]));
            const blocked = validateClaims(candidates, claimMap, state, runtimeProblems);
            const starting = candidates.filter((task) => !blocked.has(task.id));
            candidates.filter((task) => blocked.has(task.id)).forEach((task) => state.statuses.set(task.id, 'blocked'));
            const startSnapshot = cloneState(state);
            const startWrites = starting.flatMap((task) => prepareInteractions(task, 'start', expressionContext(index, startSnapshot, timings, task, time, history), runtimeProblems, false).concat(prepareInteractions(task, 'start', expressionContext(index, startSnapshot, timings, task, time, history), runtimeProblems, true)));
            commitWrites(state, startWrites, runtimeProblems);
            starting.forEach((task) => { state.statuses.set(task.id, 'active'); state.active.set(task.id, timings.get(task.id)); state.reservations.push(...(claimMap.get(task.id) || [])); });
            history.push({ time, state: cloneState(state) });
        }
        // not_overlap applies only to tasks that actually ran.
        tasks.forEach((task) => (task.timing || []).forEach((constraint, indexValue) => {
            if (!plain(constraint) || constraint.relation !== 'not_overlap') return;
            const otherId = constraint.with && constraint.with.task; const other = index.tasks.get(otherId);
            if (!other || !['active', 'completed'].includes(state.statuses.get(task.id)) || !['active', 'completed'].includes(state.statuses.get(otherId))) return;
            const a = timings.get(task.id); const b = timings.get(otherId);
            if (a.start < b.end && b.start < a.end) runtimeProblems.push(problem('timing.not_overlap.violation', `Tasks '${task.id}' and '${otherId}' overlap.`, `/simulation/process/tasks/${task.__index}/timing/${indexValue}`));
        }));
        return { index, timings, state, problems: runtimeProblems, history };
    }

    function timingSignature(timings) {
        return JSON.stringify([...timings].map(([id, timing]) => [id, timing.resolved ? timing.start : null, timing.error && timing.error.metric_id]));
    }

    function replay(documentValue, options) {
        const index = buildIndex(documentValue);
        let resolution = resolveTimingGraph(documentValue, { index });
        let fullRun = replayWithTimings(index, resolution.timings, Infinity, resolution.problems);
        let stable = false;
        for (let pass = 0; pass <= index.tasks.size + 1; pass += 1) {
            const next = resolveTimingGraph(documentValue, { index, statuses: fullRun.state.statuses });
            if (timingSignature(next.timings) === timingSignature(resolution.timings)) {
                resolution = next; stable = true; break;
            }
            resolution = next;
            fullRun = replayWithTimings(index, resolution.timings, Infinity, resolution.problems);
        }
        const until = options && Number.isFinite(options.until) ? options.until : Infinity;
        const selectedRun = until === Infinity ? replayWithTimings(index, resolution.timings, Infinity, resolution.problems) : replayWithTimings(index, resolution.timings, until, resolution.problems);
        const runtimeProblems = [...index.problems, ...validateStatic(index), ...resolution.problems, ...selectedRun.problems];
        if (!stable) runtimeProblems.push(problem('timing.resolution.non_deterministic', 'Task timing did not converge to one deterministic branch-aware result.', index.tasksBase));
        const seenProblems = new Set();
        const uniqueProblems = runtimeProblems.filter((entry) => {
            const key = `${entry.metric_id}|${entry.instance}|${entry.detail}`;
            if (seenProblems.has(key)) return false;
            seenProblems.add(key);
            return true;
        });
        return { index, timings: resolution.timings, state: selectedRun.state, problems: uniqueProblems, history: selectedRun.history };
    }

    function serialiseState(run) {
        return {
            objects: Object.fromEntries([...run.state.objects].map(([id, value]) => [id, clone(value)])),
            locations: Object.fromEntries([...run.state.locations].map(([id, value]) => [id, clone(value)])),
            task_statuses: Object.fromEntries(run.state.statuses), problems: run.problems
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

    return { parseDurationToMinutes, parseTaskStart, parseOffset, isValueReference, evaluateValue, evaluateCondition, buildIndex, resolveTimings, replay, snapshotAt, validate, OBJECT_FIELDS: [...OBJECT_FIELDS], TASK_FIELDS: [...TASK_FIELDS], LOCATION_FIELDS: [...LOCATION_FIELDS] };
}));
