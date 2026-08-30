#!/usr/bin/env node
'use strict';

const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { validate, runtime } = require('..');

const repoRoot = path.resolve(__dirname, '..', '..', '..');
const library = JSON.parse(fs.readFileSync(path.join(repoRoot, 'web', 'assets', 'static', 'simulation-library.json'), 'utf8'));

class MemoryFile {
    constructor(name) { this.name = name; this.textValue = ''; }
    async getFile() { return { text: async () => this.textValue }; }
    async createWritable() {
        return {
            write: async (value) => { this.textValue = String(value); },
            close: async () => {},
            abort: async () => {}
        };
    }
}

class MemoryDirectory {
    constructor(name) { this.name = name; this.directories = new Map(); this.files = new Map(); }
    async queryPermission() { return 'granted'; }
    async requestPermission() { return 'granted'; }
    async getDirectoryHandle(name, options = {}) {
        if (!this.directories.has(name)) {
            if (!options.create) { const error = new Error(name); error.name = 'NotFoundError'; throw error; }
            this.directories.set(name, new MemoryDirectory(name));
        }
        return this.directories.get(name);
    }
    async getFileHandle(name, options = {}) {
        if (!this.files.has(name)) {
            if (!options.create) { const error = new Error(name); error.name = 'NotFoundError'; throw error; }
            this.files.set(name, new MemoryFile(name));
        }
        return this.files.get(name);
    }
}

function loadProjectStore() {
    const listeners = new Map();
    const window = {
        crypto: { randomUUID: (() => { let id = 0; return () => `test-project-${++id}`; })() },
        addEventListener(name, listener) { listeners.set(name, listener); },
        dispatchEvent() {},
        indexedDB: null
    };
    const context = vm.createContext({
        window,
        document: { addEventListener() {} },
        CustomEvent: class CustomEvent { constructor(name, options) { this.type = name; this.detail = options?.detail; } },
        console,
        setTimeout,
        clearTimeout,
        setInterval: () => 0,
        clearInterval() {},
        queueMicrotask
    });
    vm.runInContext(fs.readFileSync(path.join(repoRoot, 'web', 'assets', 'js', 'playground', 'playground-projects-v2.js'), 'utf8'), context);
    return window.UAWProjectStore;
}

function forbiddenKey(value, keys, location = '') {
    if (!value || typeof value !== 'object') return null;
    for (const [key, child] of Object.entries(value)) {
        const next = `${location}/${key}`;
        if (keys.has(key)) return next;
        const nested = forbiddenKey(child, keys, next);
        if (nested) return nested;
    }
    return null;
}

async function run() {
    assert.ok(Array.isArray(library.simulations) && library.simulations.length > 0, 'Built-in template library is empty');
    const store = loadProjectStore();
    const root = new MemoryDirectory('templates');
    const forbidden = new Set(['config', 'state_libraries', 'recipes', 'methods', 'interactions', 'equipment_interactions']);
    const observableOutcomes = {
        breadmaking: ['baked_bread', 'quantity', 4],
        ecommerce_order: ['packed_order', 'quantity', 1],
        electronics_assembly: ['finished_phones', 'quantity', 12],
        pharmaceutical_production: ['finished_drug_product', 'quantity', 380],
        restaurant_kitchen: ['finished_entrees', 'quantity', 21],
        'coffee-shop-multiperiod': ['latte', 'quantity', 35]
    };

    for (const template of library.simulations) {
        const documentValue = { simulation: template.simulation };
        assert.equal(template.simulation.schema_version, '2.1', `${template.id} is not WorkSpec 2.1`);
        assert.equal(forbiddenKey(documentValue, forbidden), null, `${template.id} Define contains legacy behaviour/configuration`);
        for (const task of template.simulation.process.tasks) {
            assert.match(String(task.duration), /^[0-9]+(?:\.[0-9]+)?[smhdwM]$/, `${template.id}/${task.id} duration is not self-describing`);
            if (task.depends_on !== undefined) assert.ok(Array.isArray(task.depends_on), `${template.id}/${task.id} depends_on is not a plain array`);
            if (task.depends_on?.length) assert.equal(task.start, undefined, `${template.id}/${task.id} has a redundant dependent start`);
        }
        assert.equal(validate(documentValue).ok, true, `${template.id} Define is invalid`);
        assert.equal(typeof template.script, 'string', `${template.id} has no Script content`);
        const runtimeRun = runtime.runProject(documentValue, template.script);
        assert.equal(runtimeRun.problems.some(problem => problem.severity === 'error'), false, `${template.id} does not run through WorkSpec 2.1`);
        assert.ok(runtimeRun.history.length > 0, `${template.id} generated no change history`);
        const [objectId, property, expected] = observableOutcomes[template.id];
        assert.equal(runtime.serialiseState(runtimeRun).objects[objectId].properties[property], expected, `${template.id} did not preserve its observable outcome`);

        const defineText = JSON.stringify(documentValue, null, 2);
        const created = await store.createFromTemplate(template.name, defineText, root, template.script);
        assert.ok(created, `${template.id} could not be created`);
        const reloaded = await store.readProjectFromDirectory(created.directoryHandle, { id: created.id, name: created.name });
        assert.deepEqual(JSON.parse(reloaded.workSpecDraft), documentValue, `${template.id} Define did not reload intact`);
        assert.equal(reloaded.scriptDraft, template.script, `${template.id} Script did not reload intact`);
    }
    process.stdout.write(`✓ ${library.simulations.length} WorkSpec 2.1 Studio templates\n`);
}

run().catch(error => { console.error(error); process.exitCode = 1; });
