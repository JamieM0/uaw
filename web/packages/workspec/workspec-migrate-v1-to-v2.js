// WorkSpec v1.0 → v2.0 Migration Utilities
// Universal Automation Wiki

(function() {
    'use strict';

    const WORKSPEC_V2_SCHEMA_URL = 'https://universalautomation.wiki/workspec/v2.0.schema.json';

    const DEFAULTS = Object.freeze({
        currency: 'USD',
        locale: 'en-US',
        timezone: 'UTC',
        time_unit: 'minutes'
    });

    const TYPE_ALIASES = Object.freeze({
        // People
        person: 'actor',
        human: 'actor',
        worker: 'actor',
        employee: 'actor',
        staff: 'actor',
        operator: 'actor',

        // Equipment
        tool: 'equipment',
        machine: 'equipment',
        device: 'equipment',
        robot: 'equipment',

        // Materials / goods
        material: 'resource',
        ingredient: 'resource',
        consumable: 'resource',
        input: 'resource',

        output: 'product',
        item: 'product',
        good: 'product'
    });

    function isPlainObject(value) {
        return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
    }

    function cloneJson(value) {
        return JSON.parse(JSON.stringify(value));
    }

    function normalizeTimeUnit(rawValue, fallback) {
        const defaultUnit = fallback || DEFAULTS.time_unit;
        if (typeof rawValue !== 'string' || !rawValue.trim()) return defaultUnit;

        const normalized = rawValue.trim().toLowerCase();
        if (['second', 'seconds', 'sec', 'secs', 's'].includes(normalized)) return 'seconds';
        if (['minute', 'minutes', 'min', 'mins', 'm'].includes(normalized)) return 'minutes';
        if (['hour', 'hours', 'hr', 'hrs', 'h'].includes(normalized)) return 'hours';

        return defaultUnit;
    }

    function ensureString(value) {
        return (typeof value === 'string') ? value : '';
    }

    function safeTrim(value) {
        return ensureString(value).trim();
    }

    function toSnakeCase(rawValue) {
        if (typeof rawValue !== 'string') return '';

        const value = rawValue
            .normalize('NFKD')
            .replace(/[\u0300-\u036F]/g, '');

        return value
            .trim()
            .replace(/['’]/g, '')
            .replace(/[^A-Za-z0-9]+/g, '_')
            .replace(/_{2,}/g, '_')
            .replace(/^_+|_+$/g, '')
            .toLowerCase();
    }

    function isEmojiCapable() {
        try {
            // Unicode property escapes are required for robust emoji detection.
            // Browsers without support will throw here.
            void new RegExp('\\p{Extended_Pictographic}', 'u');
            return true;
        } catch (e) {
            return false;
        }
    }

    const EMOJI_REGEX = isEmojiCapable()
        ? /(\p{Extended_Pictographic}(?:\uFE0F|\u200D\p{Extended_Pictographic})*)/gu
        : null;

    function extractEmojiClusters(text) {
        if (!EMOJI_REGEX || typeof text !== 'string') return [];
        const matches = text.match(EMOJI_REGEX);
        return Array.isArray(matches) ? matches : [];
    }

    function removeEmoji(text) {
        if (!EMOJI_REGEX || typeof text !== 'string') return text;
        return text.replace(EMOJI_REGEX, ' ').replace(/\s{2,}/g, ' ').trim();
    }

    function normalizePlainId(rawId, prefixIfNeeded) {
        const snake = toSnakeCase(removeEmoji(ensureString(rawId)));

        let candidate = snake;
        if (!candidate) {
            candidate = safeTrim(prefixIfNeeded) ? `${toSnakeCase(prefixIfNeeded)}_${Date.now()}` : `id_${Date.now()}`;
        }

        if (!/^[a-z]/.test(candidate)) {
            candidate = `${toSnakeCase(prefixIfNeeded || 'id')}_${candidate}`;
        }

        return candidate.slice(0, 250);
    }

    function normalizeObjectId(rawId, fallbackType) {
        const id = ensureString(rawId);
        if (!id) return normalizePlainId('', fallbackType || 'object');

        const colonIndex = id.indexOf(':');
        if (colonIndex === -1) {
            return normalizePlainId(id, fallbackType || 'object');
        }

        const left = id.slice(0, colonIndex);
        const right = id.slice(colonIndex + 1);
        const normalizedLeft = normalizePlainId(left, 'type');
        const normalizedRight = normalizePlainId(right, fallbackType || normalizedLeft || 'object');
        return `${normalizedLeft}:${normalizedRight}`.slice(0, 250);
    }

    function ensureUniqueId(desiredId, usedIds) {
        let candidate = desiredId;
        if (!usedIds.has(candidate)) {
            usedIds.add(candidate);
            return candidate;
        }

        let counter = 2;
        while (usedIds.has(`${candidate}_${counter}`)) {
            counter += 1;
        }
        const unique = `${candidate}_${counter}`;
        usedIds.add(unique);
        return unique;
    }

    function canonicalizeObjectType(rawType) {
        const type = safeTrim(rawType).toLowerCase();
        if (!type) return 'object';
        return TYPE_ALIASES[type] || type;
    }

    function coerceMeta(simulation, options) {
        const meta = isPlainObject(simulation.meta) ? simulation.meta : {};

        const articleTitle = safeTrim(meta.article_title);
        if (!safeTrim(meta.title) && articleTitle) {
            meta.title = articleTitle;
        }

        if (!safeTrim(meta.title)) {
            const fromSimName = safeTrim(simulation.name);
            const fromFallback = safeTrim(options.fallbackMetaTitle);
            meta.title = fromSimName || fromFallback || 'Migrated Simulation';
        }

        if (!safeTrim(meta.description)) {
            const fromSimDescription = safeTrim(simulation.description);
            const fromFallback = safeTrim(options.fallbackMetaDescription);
            meta.description = fromSimDescription || fromFallback || 'Migrated from WorkSpec v1.0 to v2.0.';
        }

        if (!safeTrim(meta.domain)) {
            const fromSimDomain = safeTrim(simulation.domain);
            const fromFallback = safeTrim(options.fallbackMetaDomain);
            meta.domain = fromSimDomain || fromFallback || 'General';
        }

        if (meta.article_title !== undefined) {
            delete meta.article_title;
        }

        simulation.meta = meta;
    }

    function coerceConfig(simulation, options) {
        const existingConfig = isPlainObject(simulation.config) ? simulation.config : {};
        const config = { ...existingConfig };

        config.time_unit = normalizeTimeUnit(
            config.time_unit || simulation.time_unit || simulation.simulation_config?.time_unit,
            options.defaultTimeUnit || DEFAULTS.time_unit
        );

        const dayTypeConfig = (() => {
            if (!isPlainObject(simulation.day_types)) return null;
            const dayTypeKeys = Object.keys(simulation.day_types);
            for (const key of dayTypeKeys) {
                const dayType = simulation.day_types[key];
                const dtConfig = dayType?.config;
                if (isPlainObject(dtConfig) && (dtConfig.start_time || dtConfig.end_time)) return dtConfig;
            }
            return null;
        })();

        config.start_time = config.start_time
            || existingConfig.start_time
            || simulation.start_time
            || dayTypeConfig?.start_time
            || '00:00';
        config.end_time = config.end_time
            || existingConfig.end_time
            || simulation.end_time
            || dayTypeConfig?.end_time
            || '23:59';

        config.currency = safeTrim(config.currency) || safeTrim(options.defaultCurrency) || DEFAULTS.currency;
        config.locale = safeTrim(config.locale) || safeTrim(options.defaultLocale) || DEFAULTS.locale;

        if (!safeTrim(config.timezone) && safeTrim(options.defaultTimezone)) {
            config.timezone = options.defaultTimezone;
        }

        simulation.config = config;

        // Prefer v2 config; remove obvious legacy duplicates if present
        if (simulation.time_unit !== undefined) delete simulation.time_unit;
        if (simulation.start_time !== undefined) delete simulation.start_time;
        if (simulation.end_time !== undefined) delete simulation.end_time;
    }

    function moveFlatStructureToWorldProcess(simulation) {
        if (!isPlainObject(simulation.world)) simulation.world = {};
        if (!isPlainObject(simulation.process)) simulation.process = {};

        if (!simulation.world.layout && isPlainObject(simulation.layout)) {
            simulation.world.layout = simulation.layout;
        }
        if (!Array.isArray(simulation.world.objects) && Array.isArray(simulation.objects)) {
            simulation.world.objects = simulation.objects;
        }
        if (!Array.isArray(simulation.process.tasks) && Array.isArray(simulation.tasks)) {
            simulation.process.tasks = simulation.tasks;
        }

        if (!isPlainObject(simulation.process.recipes) && isPlainObject(simulation.recipes)) {
            simulation.process.recipes = simulation.recipes;
        }

        // Ensure required arrays exist
        if (!Array.isArray(simulation.world.objects)) simulation.world.objects = [];
        if (!Array.isArray(simulation.process.tasks)) simulation.process.tasks = [];

        // Remove legacy flat keys once moved
        if (simulation.layout !== undefined) delete simulation.layout;
        if (simulation.objects !== undefined) delete simulation.objects;
        if (simulation.tasks !== undefined) delete simulation.tasks;
        if (simulation.recipes !== undefined) delete simulation.recipes;
    }

    function normalizeObjects(simulation) {
        const objects = Array.isArray(simulation.world?.objects) ? simulation.world.objects : [];

        const usedIds = new Set();
        const idMap = new Map();

        for (const obj of objects) {
            if (!isPlainObject(obj)) continue;
            const oldId = ensureString(obj.id);
            const oldType = ensureString(obj.type);

            obj.type = canonicalizeObjectType(oldType);

            if (!safeTrim(obj.emoji) && safeTrim(obj.properties?.emoji)) {
                obj.emoji = safeTrim(obj.properties.emoji);
                delete obj.properties.emoji;
            }

            if (!safeTrim(obj.location) && safeTrim(obj.properties?.location)) {
                obj.location = safeTrim(obj.properties.location);
                delete obj.properties.location;
            }

            if (!safeTrim(obj.name)) {
                obj.name = safeTrim(obj.properties?.role) || safeTrim(obj.properties?.name) || oldId || 'Object';
            }

            if (!isPlainObject(obj.properties)) obj.properties = {};

            const normalizedId = ensureUniqueId(normalizeObjectId(oldId, obj.type), usedIds);
            if (oldId && normalizedId !== oldId) {
                idMap.set(oldId, normalizedId);
            }
            obj.id = normalizedId;
        }

        return idMap;
    }

    function normalizeLocations(simulation) {
        const locations = simulation.world?.layout?.locations;
        if (!Array.isArray(locations)) return new Map();

        const usedIds = new Set();
        const idMap = new Map();

        for (const loc of locations) {
            if (!isPlainObject(loc)) continue;
            const oldId = ensureString(loc.id);
            const normalizedId = ensureUniqueId(normalizePlainId(oldId, 'location'), usedIds);
            if (oldId && normalizedId !== oldId) {
                idMap.set(oldId, normalizedId);
            }
            loc.id = normalizedId;
            if (!safeTrim(loc.name)) loc.name = oldId || normalizedId;
        }

        return idMap;
    }

    function normalizeTaskIds(simulation) {
        const tasks = Array.isArray(simulation.process?.tasks) ? simulation.process.tasks : [];

        const usedIds = new Set();
        const idMap = new Map();

        for (const task of tasks) {
            if (!isPlainObject(task)) continue;
            const oldId = ensureString(task.id);
            const emojis = extractEmojiClusters(oldId);
            if (!safeTrim(task.emoji) && emojis.length > 0) {
                // Heuristic: prefer the last emoji cluster (often the "main" one after separators).
                task.emoji = emojis[emojis.length - 1];
            }

            const cleaned = removeEmoji(oldId);
            const normalizedId = ensureUniqueId(normalizePlainId(cleaned, 'task'), usedIds);
            if (oldId && normalizedId !== oldId) {
                idMap.set(oldId, normalizedId);
            }
            task.id = normalizedId;
        }

        return idMap;
    }

    function migrateInteraction(interaction, objectIdMap) {
        if (!isPlainObject(interaction)) return interaction;

        if (interaction.object_id !== undefined && interaction.target_id === undefined) {
            interaction.target_id = interaction.object_id;
            delete interaction.object_id;
        }

        if (interaction.revert_after !== undefined && interaction.temporary === undefined) {
            interaction.temporary = Boolean(interaction.revert_after);
            delete interaction.revert_after;
        }

        if (safeTrim(interaction.target_id) && objectIdMap.has(interaction.target_id)) {
            interaction.target_id = objectIdMap.get(interaction.target_id);
        }

        if (interaction.action === 'create' && isPlainObject(interaction.object)) {
            const created = interaction.object;
            created.type = canonicalizeObjectType(created.type);

            if (!safeTrim(created.emoji) && safeTrim(created.properties?.emoji)) {
                created.emoji = safeTrim(created.properties.emoji);
                delete created.properties.emoji;
            }

            if (!safeTrim(created.location) && safeTrim(created.properties?.location)) {
                created.location = safeTrim(created.properties.location);
                delete created.properties.location;
            }

            if (!safeTrim(created.name)) {
                created.name = safeTrim(created.properties?.role) || safeTrim(created.properties?.name) || created.id || 'Object';
            }

            if (safeTrim(created.id) && objectIdMap.has(created.id)) {
                created.id = objectIdMap.get(created.id);
            } else if (safeTrim(created.id)) {
                created.id = normalizeObjectId(created.id, created.type);
            }
        }

        return interaction;
    }

    function addDeltaInteraction(targetId, delta, description) {
        if (!safeTrim(targetId) || typeof delta !== 'number' || !Number.isFinite(delta) || delta === 0) return null;
        const interaction = {
            target_id: targetId,
            property_changes: {
                quantity: { delta }
            }
        };
        if (safeTrim(description)) interaction.description = description;
        return interaction;
    }

    function migrateTask(task, maps) {
        const { objectIdMap, locationIdMap, taskIdMap } = maps;
        if (!isPlainObject(task)) return;

        if (!safeTrim(task.actor_id) && safeTrim(task.assigned_to)) {
            task.actor_id = task.assigned_to;
        }

        if (!safeTrim(task.location) && safeTrim(task.location_id)) {
            task.location = task.location_id;
        }

        if (safeTrim(task.actor_id) && objectIdMap.has(task.actor_id)) {
            task.actor_id = objectIdMap.get(task.actor_id);
        }

        if (safeTrim(task.location) && locationIdMap.has(task.location)) {
            task.location = locationIdMap.get(task.location);
        }

        if (task.location_id !== undefined && locationIdMap.has(task.location_id)) {
            task.location_id = locationIdMap.get(task.location_id);
        }

        // depends_on mapping (supports array, or {all/any})
        if (Array.isArray(task.depends_on)) {
            task.depends_on = task.depends_on.map((dep) => taskIdMap.get(dep) || dep);
        } else if (isPlainObject(task.depends_on)) {
            if (Array.isArray(task.depends_on.all)) {
                task.depends_on.all = task.depends_on.all.map((dep) => taskIdMap.get(dep) || dep);
            }
            if (Array.isArray(task.depends_on.any)) {
                task.depends_on.any = task.depends_on.any.map((dep) => taskIdMap.get(dep) || dep);
            }
        }

        const interactions = Array.isArray(task.interactions) ? task.interactions : [];

        // consumes/produces -> delta interactions
        const consumes = isPlainObject(task.consumes) ? task.consumes : null;
        if (consumes) {
            for (const [rawId, amount] of Object.entries(consumes)) {
                const numeric = Number(amount);
                if (!Number.isFinite(numeric) || numeric === 0) continue;
                const target = objectIdMap.get(rawId) || rawId;
                const created = addDeltaInteraction(target, -numeric, 'Migrated from task.consumes');
                if (created) interactions.push(created);
            }
            delete task.consumes;
        }

        const produces = isPlainObject(task.produces) ? task.produces : null;
        if (produces) {
            for (const [rawId, amount] of Object.entries(produces)) {
                const numeric = Number(amount);
                if (!Number.isFinite(numeric) || numeric === 0) continue;
                const target = objectIdMap.get(rawId) || rawId;
                const created = addDeltaInteraction(target, numeric, 'Migrated from task.produces');
                if (created) interactions.push(created);
            }
            delete task.produces;
        }

        // equipment_interactions / equipment_state_changes -> interactions with from/to
        const equipmentStateChanges = isPlainObject(task.equipment_state_changes) ? task.equipment_state_changes : null;
        if (equipmentStateChanges) {
            for (const [rawEquipId, stateChange] of Object.entries(equipmentStateChanges)) {
                if (!isPlainObject(stateChange)) continue;
                const target = objectIdMap.get(rawEquipId) || rawEquipId;
                interactions.push({
                    target_id: target,
                    property_changes: {
                        state: { from: stateChange.from, to: stateChange.to }
                    },
                    description: 'Migrated from task.equipment_state_changes'
                });
            }
            delete task.equipment_state_changes;
        }

        const equipmentInteractions = Array.isArray(task.equipment_interactions) ? task.equipment_interactions : null;
        if (equipmentInteractions) {
            for (const entry of equipmentInteractions) {
                if (!isPlainObject(entry)) continue;
                const rawTarget = entry.equipment_id || entry.object_id || entry.target_id || entry.id;
                const target = objectIdMap.get(rawTarget) || rawTarget;
                const from = entry.from ?? entry.state_from;
                const to = entry.to ?? entry.state_to;
                if (!safeTrim(target) || (from === undefined && to === undefined)) continue;
                interactions.push({
                    target_id: target,
                    property_changes: {
                        state: { from, to }
                    },
                    temporary: entry.temporary !== undefined ? Boolean(entry.temporary) : (entry.revert_after !== undefined ? Boolean(entry.revert_after) : undefined),
                    description: 'Migrated from task.equipment_interactions'
                });
            }
            delete task.equipment_interactions;
        }

        // Normalize existing interactions object_id -> target_id, revert_after -> temporary
        for (const interaction of interactions) {
            migrateInteraction(interaction, objectIdMap);
        }

        if (interactions.length > 0) {
            task.interactions = interactions;
        }
    }

    function migrateTasks(simulation, objectIdMap, locationIdMap) {
        const tasks = Array.isArray(simulation.process?.tasks) ? simulation.process.tasks : [];
        const taskIdMap = normalizeTaskIds(simulation);

        for (const task of tasks) {
            migrateTask(task, { objectIdMap, locationIdMap, taskIdMap });
        }

        return taskIdMap;
    }

    function migrateDayTypes(simulation, objectIdMap) {
        if (!isPlainObject(simulation.day_types)) return;

        for (const dayType of Object.values(simulation.day_types)) {
            if (!isPlainObject(dayType)) continue;

            // Keep legacy day type structure, but normalize interactions to v2 naming where safe.
            const tasks = Array.isArray(dayType.tasks) ? dayType.tasks : null;
            if (tasks) {
                const taskIdMap = new Map();
                for (const task of tasks) {
                    if (!isPlainObject(task)) continue;
                    const oldId = ensureString(task.id);
                    const emojis = extractEmojiClusters(oldId);
                    if (!safeTrim(task.emoji) && emojis.length > 0) {
                        task.emoji = emojis[emojis.length - 1];
                    }
                    const cleaned = removeEmoji(oldId);
                    const normalizedId = normalizePlainId(cleaned, 'task');
                    if (oldId && normalizedId !== oldId) taskIdMap.set(oldId, normalizedId);
                    task.id = normalizedId;
                }

                for (const task of tasks) {
                    migrateTask(task, {
                        objectIdMap,
                        locationIdMap: new Map(),
                        taskIdMap
                    });
                }
            }
        }
    }

    function migrateLegacyEntityArrays(simulation) {
        const alreadyHasObjects = Array.isArray(simulation?.world?.objects) || Array.isArray(simulation?.objects);
        if (alreadyHasObjects) return;

        const hasLegacyEntityArrays = Array.isArray(simulation.actors)
            || Array.isArray(simulation.resources)
            || Array.isArray(simulation.equipment)
            || Array.isArray(simulation.products);

        if (!hasLegacyEntityArrays) return;
        if (!isPlainObject(simulation.world)) simulation.world = {};
        if (!Array.isArray(simulation.world.objects)) simulation.world.objects = [];

        const objects = simulation.world.objects;

        const pushIfValid = (obj) => {
            if (!isPlainObject(obj)) return;
            if (!safeTrim(obj.id) || !safeTrim(obj.type) || !safeTrim(obj.name)) return;
            objects.push(obj);
        };

        if (Array.isArray(simulation.actors)) {
            for (const actor of simulation.actors) {
                if (!isPlainObject(actor)) continue;
                const id = ensureString(actor.id);
                pushIfValid({
                    id,
                    type: 'actor',
                    name: safeTrim(actor.role) || id,
                    properties: { ...actor }
                });
            }
            delete simulation.actors;
        }

        if (Array.isArray(simulation.equipment)) {
            for (const equipment of simulation.equipment) {
                if (!isPlainObject(equipment)) continue;
                const id = ensureString(equipment.id);
                pushIfValid({
                    id,
                    type: 'equipment',
                    name: safeTrim(equipment.name) || id,
                    properties: { ...equipment, state: equipment.initial_state || equipment.state }
                });
            }
            delete simulation.equipment;
        }

        if (Array.isArray(simulation.resources)) {
            for (const resource of simulation.resources) {
                if (!isPlainObject(resource)) continue;
                const id = ensureString(resource.id);
                pushIfValid({
                    id,
                    type: 'resource',
                    name: safeTrim(resource.name) || id,
                    properties: {
                        ...resource,
                        quantity: resource.starting_stock ?? resource.quantity
                    }
                });
            }
            delete simulation.resources;
        }

        if (Array.isArray(simulation.products)) {
            for (const product of simulation.products) {
                if (!isPlainObject(product)) continue;
                const id = ensureString(product.id);
                pushIfValid({
                    id,
                    type: 'product',
                    name: safeTrim(product.name) || id,
                    properties: { ...product }
                });
            }
            delete simulation.products;
        }
    }

    function migrateWorkSpecDocumentV1ToV2(inputDocument, options = {}) {
        const opts = {
            addSchema: options.addSchema !== false,
            defaultCurrency: options.defaultCurrency || DEFAULTS.currency,
            defaultLocale: options.defaultLocale || DEFAULTS.locale,
            defaultTimezone: options.defaultTimezone || DEFAULTS.timezone,
            defaultTimeUnit: options.defaultTimeUnit || DEFAULTS.time_unit,
            fallbackMetaTitle: options.fallbackMetaTitle,
            fallbackMetaDescription: options.fallbackMetaDescription,
            fallbackMetaDomain: options.fallbackMetaDomain
        };

        const root = (isPlainObject(inputDocument) && isPlainObject(inputDocument.simulation))
            ? cloneJson(inputDocument)
            : { simulation: isPlainObject(inputDocument) ? cloneJson(inputDocument) : {} };

        const simulation = root.simulation;

        // Always declare v2
        simulation.schema_version = '2.0';

        // Convert truly legacy entity arrays (actors/resources/equipment/products) into world.objects
        migrateLegacyEntityArrays(simulation);

        // Ensure v2 structure exists
        coerceMeta(simulation, opts);
        coerceConfig(simulation, opts);
        moveFlatStructureToWorldProcess(simulation);

        // ID + shape normalization
        const objectIdMap = normalizeObjects(simulation);
        const locationIdMap = normalizeLocations(simulation);
        migrateTasks(simulation, objectIdMap, locationIdMap);

        // Multi-period: migrate day_type tasks interactions best-effort
        migrateDayTypes(simulation, objectIdMap);

        // Apply object id remaps in other common locations
        if (safeTrim(simulation.process?.recipes)) {
            // noop: recipes is expected to be an object, handled elsewhere
        }

        if (opts.addSchema && !safeTrim(root.$schema)) {
            root.$schema = WORKSPEC_V2_SCHEMA_URL;
        }

        return root;
    }

    const api = {
        WORKSPEC_V2_SCHEMA_URL,
        migrate: migrateWorkSpecDocumentV1ToV2
    };

    if (typeof window !== 'undefined') {
        window.WorkSpecMigration = api;
    }

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }
})();
