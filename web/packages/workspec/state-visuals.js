// WorkSpec 2.1 state-driven visual resolution
// Shared by Node consumers and WorkSpec Studio's physical renderer.

(function() {
    'use strict';

    const runtime = (typeof module !== 'undefined' && module.exports)
        ? require('./workspec-runtime.js')
        : (typeof globalThis !== 'undefined' ? globalThis.WorkSpecRuntime : null);

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

    function resolveObjectStateAtTime(object, tasks, time, documentValue) {
        if (documentValue && runtime && typeof runtime.snapshotAt === 'function') {
            const snapshot = runtime.snapshotAt(documentValue, time);
            return snapshot.objects?.[object?.id]?.properties?.state || object?.properties?.state || '';
        }
        return typeof object?.properties?.state === 'string' ? object.properties.state : '';
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

    const api = {
        assetIdFromFilename,
        getStateLibrary,
        resolveStateVisualAssetId,
        resolveObjectStateAtTime,
        calculateLocationObjectSlots
    };

    if (typeof window !== 'undefined') window.WorkSpecStateVisuals = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
