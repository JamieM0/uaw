// WorkSpec v2 state-driven visual resolution
// Shared by Node consumers and WorkSpec Studio's physical renderer.

(function() {
    'use strict';

    const playbackState = typeof module !== 'undefined' && module.exports
        ? require('./playback-state.js')
        : (typeof window !== 'undefined' ? window.WorkSpecPlaybackState : null);
    const runtime = typeof module !== 'undefined' && module.exports
        ? require('./workspec-runtime.js')
        : (typeof window !== 'undefined' ? window.WorkSpecRuntime : null);

    function isPlainObject(value) {
        return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
    }

    function getSimulation(documentValue) {
        if (!isPlainObject(documentValue)) return null;
        return isPlainObject(documentValue.simulation) ? documentValue.simulation : documentValue;
    }

    function getStateLibrary(documentValue, object) {
        const simulation = getSimulation(documentValue);
        if (!simulation || !isPlainObject(object)) return null;
        const libraryId = typeof object.state_library === 'string' ? object.state_library.trim() : '';
        const library = simulation.state_libraries?.[libraryId];
        return libraryId && isPlainObject(library) ? library : null;
    }

    function assetIdFromFilename(filename) {
        if (typeof filename !== 'string') return '';
        return filename
            .replace(/\.[^.]+$/, '')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '_')
            .replace(/^_+|_+$/g, '')
            .slice(0, 250);
    }

    function resolveStateVisualAssetId(documentValue, object, state = object?.properties?.state) {
        const library = getStateLibrary(documentValue, object);
        const appearanceId = typeof object?.appearance === 'string' ? object.appearance.trim() : '';
        const stateId = typeof state === 'string' ? state.trim() : '';
        if (!library || !appearanceId || !stateId) return null;

        const appearance = library.appearances?.[appearanceId];
        if (!isPlainObject(appearance)) return null;
        const assetId = appearance[stateId];
        return typeof assetId === 'string' && assetId.trim() ? assetId.trim() : null;
    }

    function resolveObjectStateAtTime(object, tasks, time) {
        if (!object?.id || !playbackState) return object?.properties?.state || '';
        return playbackState.getObjectStateAtTime({ objects: [object], tasks, simulation: {} }, object.id, time)
            ?? object?.properties?.state
            ?? '';
    }

    function calculateLocationObjectSlots(bounds, objectIds, options = {}) {
        if (!isPlainObject(bounds) || !Array.isArray(objectIds)) return new Map();
        const ids = [...new Set(objectIds.filter(id => typeof id === 'string' && id))].sort();
        if (!ids.length) return new Map();

        const margin = Number.isFinite(options.margin) ? Math.max(0, options.margin) : 8;
        const gap = Number.isFinite(options.gap) ? Math.max(0, options.gap) : 4;
        const maxSize = Number.isFinite(options.maxSize) ? Math.max(8, options.maxSize) : 32;
        const width = Math.max(1, Number(bounds.width) || 1);
        const height = Math.max(1, Number(bounds.height) || 1);
        const innerWidth = Math.max(1, width - (margin * 2));
        const innerHeight = Math.max(1, height - (margin * 2));
        const aspectRatio = innerWidth / innerHeight;
        const columns = Math.min(ids.length, Math.max(1, Math.ceil(Math.sqrt(ids.length * aspectRatio))));
        const rows = Math.ceil(ids.length / columns);
        const cellWidth = innerWidth / columns;
        const cellHeight = innerHeight / rows;
        const size = Math.max(8, Math.min(maxSize, cellWidth - gap, cellHeight - gap));
        const x = Number(bounds.x) || 0;
        const y = Number(bounds.y) || 0;
        const slots = new Map();

        ids.forEach((id, index) => {
            const column = index % columns;
            const row = Math.floor(index / columns);
            slots.set(id, {
                x: x + margin + (column * cellWidth) + ((cellWidth - size) / 2),
                y: y + margin + (row * cellHeight) + ((cellHeight - size) / 2),
                size
            });
        });
        return slots;
    }

    function finiteNumber(value, fallback) {
        const number = Number(value);
        return Number.isFinite(number) ? number : fallback;
    }

    function escapeXml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
    }

    function normalizeLocations(documentValue, snapshot, options = {}) {
        const simulation = getSimulation(documentValue) || {};
        const layout = simulation.world?.layout || simulation.layout || {};
        const snapshotLocations = isPlainObject(snapshot?.locations) ? snapshot.locations : {};
        const sourceLocations = Array.isArray(layout.locations) && layout.locations.length
            ? layout.locations
            : Object.values(snapshotLocations);
        const pixelsPerUnit = Math.max(1, finiteNumber(layout.meta?.pixels_per_unit, 20));
        const defaultWidth = Math.max(80, finiteNumber(options.defaultLocationWidth, pixelsPerUnit * 8));
        const defaultHeight = Math.max(60, finiteNumber(options.defaultLocationHeight, pixelsPerUnit * 5));
        const gap = Math.max(10, finiteNumber(options.locationGap, 24));

        return sourceLocations.map((location, index) => {
            const input = isPlainObject(location) ? location : {};
            const resolved = isPlainObject(snapshotLocations[input.id]) ? snapshotLocations[input.id] : {};
            const shape = isPlainObject(input.shape) ? input.shape : {};
            const coordinates = isPlainObject(input.coordinates) ? input.coordinates : {};
            const width = Math.max(1, finiteNumber(shape.width, finiteNumber(coordinates.width, defaultWidth)));
            const height = Math.max(1, finiteNumber(shape.height, finiteNumber(coordinates.height, defaultHeight)));
            return {
                ...input,
                ...resolved,
                id: String(input.id || resolved.id || `location_${index + 1}`),
                name: String(input.name || resolved.name || input.id || resolved.id || `Location ${index + 1}`),
                x: finiteNumber(shape.x, finiteNumber(coordinates.x, (index % 4) * (defaultWidth + gap))),
                y: finiteNumber(shape.y, finiteNumber(coordinates.z, Math.floor(index / 4) * (defaultHeight + gap))),
                width,
                height
            };
        }).sort((left, right) => left.id.localeCompare(right.id));
    }

    function objectSubtitle(object) {
        const properties = isPlainObject(object?.properties) ? object.properties : {};
        const details = [];
        if (properties.state !== undefined && properties.state !== '') details.push(String(properties.state));
        if (properties.quantity !== undefined) details.push(`qty ${properties.quantity}`);
        return details.join(' · ');
    }

    function objectGlyph(object) {
        if (typeof object?.emoji === 'string' && object.emoji.trim()) return object.emoji.trim();
        return ({
            actor: '●',
            equipment: '◆',
            resource: '■',
            product: '▲',
            service: '✦',
            display: '▣',
            screen_element: '▤',
            digital_object: '⬡'
        })[object?.type] || '●';
    }

    /**
     * Render an already-resolved WorkSpec snapshot as deterministic, standalone SVG.
     * This function is deliberately presentation-only: it never advances or mutates state.
     */
    function renderSnapshotToSvg(documentValue, snapshot, options = {}) {
        if (!isPlainObject(snapshot) || !isPlainObject(snapshot.objects)) {
            throw new TypeError('renderSnapshotToSvg requires a resolved WorkSpec snapshot.');
        }
        const padding = Math.max(0, finiteNumber(options.padding, 28));
        const locations = normalizeLocations(documentValue, snapshot, options);
        const objects = Object.values(snapshot.objects)
            .filter(isPlainObject)
            .sort((left, right) => String(left.id || '').localeCompare(String(right.id || '')));
        const locationIds = new Set(locations.map((location) => location.id));
        const unplaced = objects.filter((object) => !locationIds.has(object.location));
        const minLeft = locations.length ? Math.min(0, ...locations.map((location) => location.x)) : 0;
        const minTop = locations.length ? Math.min(0, ...locations.map((location) => location.y)) : 0;
        const maxRight = locations.length ? Math.max(...locations.map((location) => location.x + location.width)) : 520;
        const maxBottom = locations.length ? Math.max(...locations.map((location) => location.y + location.height)) : 240;
        const unplacedHeight = unplaced.length ? 92 : 0;
        const width = Math.max(360, finiteNumber(options.width, maxRight - minLeft + (padding * 2)));
        const height = Math.max(220, finiteNumber(options.height, maxBottom - minTop + (padding * 2) + unplacedHeight));
        const locationMarkup = [];

        for (const location of locations) {
            const memberIds = objects.filter((object) => object.location === location.id).map((object) => object.id);
            const slots = calculateLocationObjectSlots(location, memberIds, { margin: 28, gap: 6, maxSize: 42 });
            const objectMarkup = memberIds.map((id) => {
                const object = snapshot.objects[id];
                const slot = slots.get(id);
                const label = object.name || object.id;
                const subtitle = objectSubtitle(object);
                const centreX = slot.x + (slot.size / 2);
                const assetId = resolveStateVisualAssetId(documentValue, object);
                const assetHref = assetId && typeof options.assetResolver === 'function'
                    ? options.assetResolver(assetId, object)
                    : null;
                const visual = typeof assetHref === 'string' && assetHref
                    ? `<image href="${escapeXml(assetHref)}" x="${slot.x + 3}" y="${slot.y + 3}" width="${slot.size - 6}" height="${slot.size - 6}" preserveAspectRatio="xMidYMid meet"/>`
                    : `<text x="${centreX}" y="${slot.y + (slot.size * .68)}" text-anchor="middle" class="object-glyph">${escapeXml(objectGlyph(object))}</text>`;
                return `<g data-object-id="${escapeXml(id)}"${assetId ? ` data-asset-id="${escapeXml(assetId)}"` : ''}><rect x="${slot.x}" y="${slot.y}" width="${slot.size}" height="${slot.size}" rx="8" fill="#ffffff" stroke="#526173"/>${visual}<text x="${centreX}" y="${slot.y + slot.size + 14}" text-anchor="middle" class="object-label">${escapeXml(label)}</text>${subtitle ? `<text x="${centreX}" y="${slot.y + slot.size + 27}" text-anchor="middle" class="object-detail">${escapeXml(subtitle)}</text>` : ''}</g>`;
            }).join('');
            locationMarkup.push(`<g data-location-id="${escapeXml(location.id)}"><rect x="${location.x}" y="${location.y}" width="${location.width}" height="${location.height}" rx="12" fill="#eef4f7" stroke="#8293a5" stroke-width="1.5"/><text x="${location.x + 12}" y="${location.y + 20}" class="location-label">${escapeXml(location.emoji ? `${location.emoji} ${location.name}` : location.name)}</text>${objectMarkup}</g>`);
        }

        const unplacedY = maxBottom + padding + 20;
        const unplacedMarkup = unplaced.length
            ? `<g data-location-id="__unplaced__"><text x="${minLeft + padding}" y="${unplacedY}" class="location-label">Unplaced objects</text>${unplaced.map((object, index) => `<text x="${minLeft + padding + (index % 4) * 150}" y="${unplacedY + 24 + Math.floor(index / 4) * 18}" class="object-label" data-object-id="${escapeXml(object.id)}">${escapeXml(object.name || object.id)}${objectSubtitle(object) ? ` — ${escapeXml(objectSubtitle(object))}` : ''}</text>`).join('')}</g>`
            : '';
        const title = options.title || getSimulation(documentValue)?.meta?.title || 'WorkSpec world state';
        const timeLabel = options.timeLabel === undefined ? '' : ` at ${options.timeLabel}`;
        return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${minLeft - padding} ${minTop - padding} ${width} ${height}" width="${width}" height="${height}" role="img" aria-labelledby="workspec-svg-title"><title id="workspec-svg-title">${escapeXml(title + timeLabel)}</title><style>.location-label{font:600 13px ui-sans-serif,system-ui,sans-serif;fill:#263746}.object-label{font:11px ui-sans-serif,system-ui,sans-serif;fill:#263746}.object-detail{font:9px ui-sans-serif,system-ui,sans-serif;fill:#657587}.object-glyph{font:700 20px ui-sans-serif,system-ui,sans-serif;fill:#2c5f65}</style><rect x="${minLeft - padding}" y="${minTop - padding}" width="${width}" height="${height}" fill="#f8fafb"/>${locationMarkup.join('')}${unplacedMarkup}</svg>`;
    }

    /** Resolve one authoritative run through time, then render that immutable snapshot. */
    function renderProjectToSvg(documentValue, time, options = {}) {
        if (!runtime) throw new Error('WorkSpec runtime is required to render a project.');
        const parsed = typeof time === 'number' ? { ok: Number.isFinite(time), startMinutes: time } : runtime.parseTaskStart(time);
        if (!parsed?.ok || !Number.isFinite(parsed.startMinutes)) throw new TypeError('Render time must be finite minutes or a valid WorkSpec task start.');
        const seed = options.seed ?? 1;
        const run = runtime.runProject(documentValue, options.changesSource || '', options.generatorSource || '', {
            seed,
            until: parsed.startMinutes,
            ...(options.maxEvents === undefined ? {} : { maxEvents: options.maxEvents })
        });
        const snapshot = runtime.snapshotRunAt(run, time);
        return {
            svg: renderSnapshotToSvg(documentValue, snapshot, { ...options, timeLabel: options.timeLabel ?? String(time) }),
            snapshot,
            run,
            time: parsed.startMinutes,
            seed
        };
    }

    const api = {
        assetIdFromFilename,
        getStateLibrary,
        resolveStateVisualAssetId,
        resolveObjectStateAtTime,
        calculateLocationObjectSlots,
        renderSnapshotToSvg,
        renderProjectToSvg
    };

    if (typeof window !== 'undefined') window.WorkSpecStateVisuals = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
