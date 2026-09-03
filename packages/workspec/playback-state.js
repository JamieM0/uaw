// WorkSpec v2 observable playback state resolution.
// This is the authoritative semantic replay layer shared by Node and browser consumers.

(function() {
    'use strict';

    const MODEL_MARKER = '__workSpecPlaybackModel';
    const NON_OBJECT_ARRAY_KEYS = new Set([
        'tasks', 'timeline_actors', 'locations', 'created', 'deleted'
    ]);

    function isPlainObject(value) {
        return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
    }

    function parseTimeToMinutes(value) {
        if (typeof value === 'number' && Number.isFinite(value)) return value;
        if (typeof value !== 'string') return null;
        const match = value.trim().match(/^(?:\d{4}-\d{2}-\d{2}T)?(\d{1,2}):(\d{2})(?::\d{2}(?:\.\d+)?)?/);
        if (!match) return null;
        return (Number(match[1]) * 60) + Number(match[2]);
    }

    function durationToMinutes(value, unit) {
        if (typeof value === 'number' && Number.isFinite(value)) {
            if (unit === 'seconds') return value / 60;
            if (unit === 'hours') return value * 60;
            return value;
        }
        if (typeof value !== 'string') return 0;
        const shorthand = value.trim().match(/^(\d+(?:\.\d+)?)\s*([smhdwM])$/);
        if (shorthand) {
            return Number(shorthand[1]) * ({ s: 1 / 60, m: 1, h: 60, d: 1440, w: 10080, M: 43200 }[shorthand[2]] || 1);
        }
        const iso = value.trim().toUpperCase().match(/^P(?:(\d+)Y)?(?:(\d+)M)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/);
        if (!iso) return 0;
        return (Number(iso[1] || 0) * 525600) + (Number(iso[2] || 0) * 43200)
            + (Number(iso[3] || 0) * 1440) + (Number(iso[4] || 0) * 60)
            + Number(iso[5] || 0) + (Number(iso[6] || 0) / 60);
    }

    function taskTiming(task, unit) {
        const start = Number.isFinite(task?.start_minutes)
            ? task.start_minutes
            : parseTimeToMinutes(task?.start);
        if (!Number.isFinite(start)) return null;
        const duration = Number.isFinite(task?.duration_minutes)
            ? task.duration_minutes
            : durationToMinutes(task?.duration, unit);
        const end = Number.isFinite(task?.end_minutes) ? task.end_minutes : start + duration;
        return { start, end };
    }

    function addObject(target, object, category) {
        if (!isPlainObject(object) || !object.id || target.has(object.id)) return;
        target.set(object.id, { object, category: category || object.type || '' });
    }

    function collectObjects(input, simulation) {
        const objects = new Map();
        if (Array.isArray(input?.objects) && input?.simulation) {
            input.objects.forEach(object => addObject(objects, object, object?.type));
            return objects;
        }

        const hasCanonicalObjects = Array.isArray(simulation.world?.objects);
        const canonicalObjects = hasCanonicalObjects ? simulation.world.objects : [];
        canonicalObjects.forEach(object => addObject(objects, object, object?.type));
        if (!hasCanonicalObjects) {
            ['objects', 'actors', 'resources', 'equipment', 'tools', 'products'].forEach(key => {
                (simulation[key] || []).forEach(object => addObject(objects, object, object?.type || key.replace(/s$/, '')));
            });
        }
        (simulation.digital_space?.digital_locations || []).forEach(object => addObject(objects, object, object?.type));
        (simulation.digital_space?.digital_objects || []).forEach(object => addObject(objects, object, object?.type));
        (simulation.displays || simulation.world?.displays || []).forEach(display => {
            addObject(objects, display, display?.type);
            (display?.rectangles || []).forEach(object => addObject(objects, {
                ...object,
                display_id: object.display_id || display.id
            }, object?.type));
        });

        // SimulationPlayer receives an already-normalized flat object-type map.
        if (!simulation.world && !simulation.process) {
            Object.entries(simulation).forEach(([key, values]) => {
                if (NON_OBJECT_ARRAY_KEYS.has(key) || !Array.isArray(values)) return;
                values.forEach(object => {
                    if (object?.id && object?.type) addObject(objects, object, key);
                });
            });
        }
        return objects;
    }

    function createPlaybackModel(documentValue) {
        if (documentValue?.[MODEL_MARKER]) return documentValue;
        const simulation = documentValue?.simulation || documentValue || {};
        const rawTasks = Array.isArray(documentValue?.tasks) && documentValue?.simulation
            ? documentValue.tasks
            : Array.isArray(simulation.process?.tasks)
                ? simulation.process.tasks
                : (Array.isArray(simulation.tasks) ? simulation.tasks : []);
        const unit = simulation.config?.time_unit || 'minutes';
        const tasks = rawTasks
            .map((task, index) => ({ task, index, timing: taskTiming(task, unit) }))
            .filter(entry => entry.timing)
            .sort((left, right) => left.timing.start - right.timing.start || left.index - right.index);
        const initialObjects = collectObjects(documentValue, simulation);
        return {
            [MODEL_MARKER]: true,
            simulation,
            tasks,
            initialObjects
        };
    }

    function cloneObject(object) {
        return {
            ...object,
            properties: isPlainObject(object?.properties) ? { ...object.properties } : {}
        };
    }

    function propertyPath(property) {
        if (property === 'location' || property === 'emoji' || property.startsWith('properties.')) return property;
        return `properties.${property}`;
    }

    function readPath(object, path) {
        return String(path).split('.').reduce((value, key) => isPlainObject(value) ? value[key] : undefined, object);
    }

    function writePath(object, path, value) {
        const parts = String(path).split('.').filter(part => !['__proto__', 'prototype', 'constructor'].includes(part));
        if (!parts.length) return;
        let target = object;
        for (let index = 0; index < parts.length - 1; index += 1) {
            if (!isPlainObject(target[parts[index]])) target[parts[index]] = {};
            target = target[parts[index]];
        }
        target[parts[parts.length - 1]] = value;
    }

    function assignmentValue(change) {
        if (!isPlainObject(change)) return { found: false };
        if (Object.prototype.hasOwnProperty.call(change, 'to')) return { found: true, value: change.to };
        if (Object.prototype.hasOwnProperty.call(change, 'set')) return { found: true, value: change.set };
        return { found: false };
    }

    function applyOperator(object, property, change) {
        const path = propertyPath(property);
        const current = readPath(object, path);
        const hasDelta = change.delta !== undefined;
        const hasMultiply = change.multiply !== undefined;
        const hasIncrement = change.increment === true;
        const hasDecrement = change.decrement === true;
        if (hasDelta || hasMultiply || hasIncrement || hasDecrement) {
            let next = Number(current);
            if (!Number.isFinite(next)) next = 0;
            const delta = hasDelta ? Number(change.delta) : (hasIncrement ? 1 : (hasDecrement ? -1 : null));
            const multiplier = hasMultiply ? Number(change.multiply) : null;
            if (delta !== null && Number.isFinite(delta)) next += delta;
            if (multiplier !== null && Number.isFinite(multiplier)) next *= multiplier;
            writePath(object, path, next);
            return;
        }
        if (change.append !== undefined || change.remove !== undefined) {
            const next = Array.isArray(current) ? [...current] : [];
            if (change.append !== undefined) next.push(change.append);
            if (change.remove !== undefined) {
                for (let index = next.length - 1; index >= 0; index -= 1) {
                    if (next[index] === change.remove) next.splice(index, 1);
                }
            }
            writePath(object, path, next);
        }
    }

    function interactionCreatedObjects(interaction) {
        if (interaction?.action === 'create' && isPlainObject(interaction.object)) return [interaction.object];
        return Array.isArray(interaction?.add_objects)
            ? interaction.add_objects.filter(isPlainObject)
            : [];
    }

    function interactionDeletedIds(interaction) {
        if (interaction?.action === 'delete') return [interaction.target_id || interaction.object_id].filter(Boolean);
        return Array.isArray(interaction?.remove_objects)
            ? interaction.remove_objects.map(value => typeof value === 'string' ? value : value?.id).filter(Boolean)
            : [];
    }

    function taskLocationAtTime(model, objectId, time, fallback) {
        const actorTasks = model.tasks.filter(({ task }) => task.actor_id === objectId && (task.location_id || task.location));
        if (!actorTasks.length) return fallback;
        const active = actorTasks.find(({ timing }) => time >= timing.start && time < timing.end);
        if (active) return active.task.location_id || active.task.location;
        let completed = null;
        for (const entry of actorTasks) {
            if (time >= entry.timing.end) completed = entry;
            else break;
        }
        return completed ? (completed.task.location_id || completed.task.location) : fallback;
    }

    function resolveWorldStateAtTime(documentOrModel, time) {
        const model = createPlaybackModel(documentOrModel);
        const resolvedTime = Number(time);
        const live = new Map();
        const categories = new Map();
        const creation = new Map();
        const deletion = new Map();
        model.initialObjects.forEach(({ object, category }, id) => {
            live.set(id, cloneObject(object));
            categories.set(id, category || object.type || '');
        });

        if (Number.isFinite(resolvedTime)) {
            for (const { task, timing } of model.tasks) {
                if (timing.start > resolvedTime) break;
                const active = resolvedTime >= timing.start && resolvedTime < timing.end;
                const completed = resolvedTime >= timing.end;

                for (const interaction of task.interactions || []) {
                    if (!isPlainObject(interaction)) continue;
                    const temporary = interaction.temporary === true || interaction.revert_after === true;
                    const lifecycleApplies = active || (completed && !temporary);

                    if (lifecycleApplies) {
                        interactionCreatedObjects(interaction).forEach(source => {
                            const object = cloneObject(source);
                            object.createdAt = timing.start;
                            object.createdBy = task.id;
                            if (!live.has(object.id)) live.set(object.id, object);
                            categories.set(object.id, object.type || categories.get(object.id) || '');
                            creation.set(object.id, { object, time: timing.start, taskId: task.id });
                            deletion.delete(object.id);
                        });
                        interactionDeletedIds(interaction).forEach(id => {
                            const object = live.get(id);
                            if (!object) return;
                            live.delete(id);
                            creation.delete(id);
                            deletion.set(id, { object, time: timing.start, taskId: task.id });
                        });
                    }

                    if (interaction.move_digital_object && lifecycleApplies) {
                        const move = interaction.move_digital_object;
                        const target = live.get(move.object_id);
                        if (target) {
                            target.location_id = move.to_location_id;
                            if (isPlainObject(target.properties) && target.properties.location_id !== undefined) {
                                target.properties.location_id = move.to_location_id;
                            }
                        }
                    }
                    if (interaction.move_display_element && lifecycleApplies) {
                        const move = interaction.move_display_element;
                        const target = live.get(move.element_id);
                        if (target) target.display_id = move.to_display_id;
                    }

                    const targetId = interaction.target_id || interaction.object_id;
                    const target = live.get(targetId);
                    if (!target || !isPlainObject(interaction.property_changes)) continue;
                    Object.entries(interaction.property_changes).forEach(([property, change]) => {
                        if (!isPlainObject(change)) return;
                        const assignment = assignmentValue(change);
                        if (assignment.found) {
                            if (active || !temporary) writePath(target, propertyPath(property), assignment.value);
                        } else if ((temporary && active) || (!temporary && completed)) {
                            applyOperator(target, property, change);
                        }
                    });
                }

                // Existing pre-v2 Studio compatibility: equipment state aliases and resource stock maps.
                for (const interaction of task.equipment_interactions || []) {
                    const target = live.get(interaction?.id);
                    if (!target) continue;
                    if (active) writePath(target, 'properties.state', interaction.to_state);
                    else if (completed && interaction.revert_after !== true) writePath(target, 'properties.state', interaction.to_state);
                }
                if (completed) {
                    Object.entries(task.consumes || {}).forEach(([id, amount]) => {
                        const target = live.get(id);
                        if (target) applyOperator(target, 'quantity', { delta: -Number(amount) });
                    });
                    Object.entries(task.produces || {}).forEach(([id, amount]) => {
                        const target = live.get(id);
                        if (target) applyOperator(target, 'quantity', { delta: Number(amount) });
                    });
                }
            }
        }

        live.forEach((object, id) => {
            const location = taskLocationAtTime(
                model,
                id,
                resolvedTime,
                object.location || object.location_id || object.properties?.location || object.properties?.location_id
            );
            if (location) object.location = location;
        });

        const objects = [...live.values()];
        const objectsByType = {};
        categories.forEach(type => {
            if (type && !objectsByType[type]) objectsByType[type] = [];
        });
        objects.forEach(object => {
            const type = object.type || categories.get(object.id);
            if (!type) return;
            if (!objectsByType[type]) objectsByType[type] = [];
            objectsByType[type].push(object);
        });
        return {
            time: resolvedTime,
            objects,
            objectsById: live,
            objectsByType,
            created: [...creation.values()],
            deleted: [...deletion.values()]
        };
    }

    function getObjectAtTime(documentOrModel, objectId, time) {
        return resolveWorldStateAtTime(documentOrModel, time).objectsById.get(objectId) || null;
    }

    function getObjectStateAtTime(documentOrModel, objectId, time) {
        return getObjectAtTime(documentOrModel, objectId, time)?.properties?.state;
    }

    function getObjectLocationAtTime(documentOrModel, objectId, time) {
        const object = getObjectAtTime(documentOrModel, objectId, time);
        return object
            ? (object.location || object.location_id || object.properties?.location || object.properties?.location_id || null)
            : null;
    }

    const api = {
        createPlaybackModel,
        resolveWorldStateAtTime,
        getObjectAtTime,
        getObjectStateAtTime,
        getObjectLocationAtTime
    };

    if (typeof window !== 'undefined') window.WorkSpecPlaybackState = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
