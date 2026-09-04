// Context-aware Starting State navigation for the Studio editor system.
(function () {
    'use strict';

    const CONTEXTS = {
        process: {
            label: 'Process',
            paths: [['simulation', 'process'], ['process'], ['simulation', 'tasks'], ['tasks']]
        },
        objects: {
            label: 'Objects',
            paths: [['simulation', 'world', 'objects'], ['world', 'objects'], ['simulation', 'objects'], ['objects']]
        },
        physical: {
            label: 'Physical',
            paths: [['simulation', 'world', 'layout'], ['world', 'layout'], ['simulation', 'layout'], ['layout']]
        },
        digital: {
            label: 'Digital',
            paths: [['simulation', 'digital_space'], ['digital_space']]
        },
        displays: {
            label: 'Displays',
            paths: [['simulation', 'displays'], ['simulation', 'world', 'displays'], ['displays'], ['world', 'displays']]
        },
        simulate: { label: 'Simulation', paths: [['simulation'], []] },
        validation: { label: 'Full WorkSpec', paths: [[]] },
        assets: { label: 'Assets', paths: [['assets'], ['simulation', 'assets']] },
        source: { label: 'Full WorkSpec', paths: [[]] }
    };

    const samePath = (left, right) => left.length === right.length && left.every((part, index) => part === right[index]);
    const pathLabel = (path) => path.length ? path.map(part => typeof part === 'number' ? `[${part}]` : part).join('.').replace('.[', '[') : 'WorkSpec';

    function parseJsonTree(text) {
        let index = 0;
        const nodes = [];
        const skipWhitespace = () => { while (/\s/.test(text[index] || '')) index += 1; };
        const parseString = () => {
            const start = index;
            index += 1;
            let escaped = false;
            while (index < text.length) {
                const character = text[index++];
                if (escaped) escaped = false;
                else if (character === '\\') escaped = true;
                else if (character === '"') break;
            }
            return { start, end: index, value: JSON.parse(text.slice(start, index)) };
        };
        const parseValue = (path, parent = null) => {
            skipWhitespace();
            const start = index;
            const node = { path, start, end: start, parent, children: [], value: undefined, type: 'primitive' };
            nodes.push(node);
            if (text[index] === '{') {
                node.type = 'object';
                index += 1;
                skipWhitespace();
                while (index < text.length && text[index] !== '}') {
                    const key = parseString();
                    skipWhitespace();
                    if (text[index] !== ':') throw new Error('Expected colon');
                    index += 1;
                    const child = parseValue(path.concat(key.value), node);
                    child.keyStart = key.start;
                    node.children.push(child);
                    skipWhitespace();
                    if (text[index] === ',') { index += 1; skipWhitespace(); }
                    else break;
                }
                if (text[index] !== '}') throw new Error('Unclosed object');
                index += 1;
            } else if (text[index] === '[') {
                node.type = 'array';
                index += 1;
                skipWhitespace();
                let itemIndex = 0;
                while (index < text.length && text[index] !== ']') {
                    const child = parseValue(path.concat(itemIndex++), node);
                    node.children.push(child);
                    skipWhitespace();
                    if (text[index] === ',') { index += 1; skipWhitespace(); }
                    else break;
                }
                if (text[index] !== ']') throw new Error('Unclosed array');
                index += 1;
            } else if (text[index] === '"') {
                node.type = 'string';
                const parsed = parseString();
                node.value = parsed.value;
            } else {
                while (index < text.length && !/[\s,}\]]/.test(text[index])) index += 1;
                const raw = text.slice(start, index);
                node.value = JSON.parse(raw);
            }
            node.end = index;
            return node;
        };
        const root = parseValue([]);
        skipWhitespace();
        if (index !== text.length) throw new Error('Unexpected content');
        return { root, nodes };
    }

    function getAtPath(value, path) {
        return path.reduce((current, part) => current == null ? undefined : current[part], value);
    }

    function findEntityPath(value, id, path = []) {
        if (!value || typeof value !== 'object') return null;
        if (!Array.isArray(value) && String(value.id ?? '') === String(id)) return path;
        if (!Array.isArray(value) && Object.prototype.hasOwnProperty.call(value, id) && path[path.length - 1] === 'assets') {
            return path.concat(id);
        }
        const entries = Array.isArray(value) ? value.entries() : Object.entries(value);
        for (const [key, child] of entries) {
            const match = findEntityPath(child, id, path.concat(key));
            if (match) return match;
        }
        return null;
    }

    function diffPaths(previous, next, path = [], changes = []) {
        if (Object.is(previous, next)) return changes;
        if (!previous || !next || typeof previous !== 'object' || typeof next !== 'object' || Array.isArray(previous) !== Array.isArray(next)) {
            changes.push(path);
            return changes;
        }
        if (Array.isArray(next)) {
            const length = Math.max(previous.length, next.length);
            for (let index = 0; index < length; index += 1) {
                if (index >= previous.length || index >= next.length) changes.push(path.concat(index));
                else diffPaths(previous[index], next[index], path.concat(index), changes);
            }
            return changes;
        }
        const keys = new Set([...Object.keys(previous), ...Object.keys(next)]);
        keys.forEach(key => {
            if (!Object.prototype.hasOwnProperty.call(previous, key) || !Object.prototype.hasOwnProperty.call(next, key)) changes.push(path.concat(key));
            else diffPaths(previous[key], next[key], path.concat(key), changes);
        });
        return changes;
    }

    class SourceContextController {
        constructor() {
            this.editor = null;
            this.scope = 'context';
            this.contextKey = 'process';
            this.previousValue = null;
            this.decorations = [];
            this.linkedElements = [];
            this.ready = false;
        }

        initialize() {
            if (this.ready) return;
            this.ready = true;
            this.buildCommandbar();
            this.bindEvents();
            this.attachEditor(window.UAWWorkSpecEditor?.sourceEditor || window.monacoEditor || window.editor);
            this.updateContext();
        }

        buildCommandbar() {
            const lip = document.querySelector('#uaw-source-pane [data-source-editor-lip]');
            if (!lip || lip.querySelector('#uaw-source-commandbar')) return;
            lip.insertAdjacentHTML('beforeend', `<div class="uaw-source-scope" id="uaw-source-commandbar" role="group" aria-label="Starting State scope">
                <code id="uaw-source-path">WorkSpec</code>
                <div class="uaw-segmented">
                    <button type="button" class="uaw-product-command active" data-source-scope="context" aria-pressed="true">Context</button>
                    <button type="button" class="uaw-product-command" data-source-scope="full" aria-pressed="false">Full JSON</button>
                </div>
            </div>`);
            lip.querySelectorAll('[data-source-scope]').forEach(button => {
                button.addEventListener('click', () => this.setScope(button.dataset.sourceScope));
            });
        }

        bindEvents() {
            // Prefer the reusable docked pane once it exists; the legacy editor
            // can announce readiness later because it is retained for canvas
            // integrations.
            window.addEventListener('uaw:editor-ready', event => this.attachEditor(window.UAWWorkSpecEditor?.sourceEditor || event.detail?.editor));
            window.addEventListener('uaw:source-editor-ready', event => { this.buildCommandbar(); this.attachEditor(event.detail?.editor); });
            window.addEventListener('uaw:source-editor-model-changed', () => this.applyScope());
            window.addEventListener('uaw:workspace-changed', () => this.updateContext());
            window.addEventListener('uaw:canvas-changed', () => this.updateContext());
            window.addEventListener('uaw:canvas-selection-changed', event => {
                if (event.detail?.selection) this.revealEntity(event.detail.selection, { flash: true, source: 'visual selection' });
            });
            document.addEventListener('click', event => {
                if (event.target.closest('#uaw-source-pane')) return;
                const target = event.target.closest('[data-context-object-id], [data-object-id], [data-task-id], [data-context-task-id], [data-location-id], .location-rect[data-id], [data-element-id], [data-display-id], [data-asset-id]');
                if (!target) return;
                const id = target.dataset.contextObjectId || target.dataset.objectId || target.dataset.taskId || target.dataset.contextTaskId
                    || target.dataset.locationId || target.dataset.elementId || target.dataset.displayId || target.dataset.assetId || target.dataset.id;
                if (id) this.revealEntity(id, { flash: false, source: 'visual selection' });
            }, true);
        }

        attachEditor(editor) {
            if (!editor?.getModel || editor === this.editor) return;
            this.editor = editor;
            this.previousValue = this.parseValue();
            editor.onDidChangeModelContent?.(() => this.handleDocumentChange());
            editor.onDidChangeCursorSelection?.(() => this.handleSourceSelection());
            this.applyScope();
        }

        parseValue() {
            try { return JSON.parse(this.editor?.getValue?.() || '{}'); }
            catch (_error) { return null; }
        }

        currentContext() {
            const workspace = document.body.dataset.uawWorkspace;
            if (workspace === 'build') return CONTEXTS[document.body.dataset.modelView] || CONTEXTS.process;
            if (workspace === 'run') return ['problems', 'rules'].includes(document.body.dataset.runView) ? CONTEXTS.validation : CONTEXTS.simulate;
            return CONTEXTS[workspace] || CONTEXTS.source;
        }

        updateContext() {
            const workspace = document.body.dataset.uawWorkspace;
            this.contextKey = workspace === 'build' ? (document.body.dataset.modelView || 'process')
                : workspace === 'run' ? (['problems', 'rules'].includes(document.body.dataset.runView) ? 'validation' : 'simulate')
                : workspace;
            const context = this.currentContext();
            const button = document.querySelector('[data-source-scope="context"]');
            if (button) button.textContent = context.label === 'Full WorkSpec' ? 'Context' : context.label;
            this.applyScope();
        }

        setScope(scope) {
            this.scope = scope === 'full' ? 'full' : 'context';
            document.querySelectorAll('[data-source-scope]').forEach(button => {
                const selected = button.dataset.sourceScope === this.scope;
                button.setAttribute('aria-pressed', String(selected));
                button.classList.toggle('active', selected);
            });
            this.applyScope({ reveal: true });
        }

        resolveContextPath(value = this.parseValue()) {
            if (!value) return [];
            return this.currentContext().paths.find(path => getAtPath(value, path) !== undefined) || [];
        }

        tree() {
            try { return parseJsonTree(this.editor.getValue()); }
            catch (_error) { return null; }
        }

        nodeForPath(path, tree = this.tree()) {
            if (!tree) return null;
            return tree.nodes.find(node => samePath(node.path, path)) || null;
        }

        applyScope(options = {}) {
            if (!this.editor?.getModel) return;
            const model = this.editor.getModel();
            // Context filtering only has meaning for the Starting State model.
            // Other tabs remain fully editable in the same shared pane.
            if (model !== window.monacoEditor?.getModel?.()) {
                this.editor.setHiddenAreas?.([]);
                const pathElement = document.getElementById('uaw-source-path');
                if (pathElement) pathElement.textContent = 'WorkSpec';
                return;
            }
            const path = this.resolveContextPath();
            const node = this.nodeForPath(path);
            const contextual = this.scope === 'context' && path.length && node;
            const hidden = [];
            if (contextual) {
                const start = model.getPositionAt(node.keyStart ?? node.start).lineNumber;
                const end = model.getPositionAt(node.end).lineNumber;
                if (start > 1) hidden.push(new monaco.Range(1, 1, start - 1, model.getLineMaxColumn(start - 1)));
                if (end < model.getLineCount()) hidden.push(new monaco.Range(end + 1, 1, model.getLineCount(), model.getLineMaxColumn(model.getLineCount())));
                if (options.reveal) this.editor.revealLineInCenter(start);
            }
            this.editor.setHiddenAreas?.(hidden);
            const pathElement = document.getElementById('uaw-source-path');
            if (pathElement) pathElement.textContent = contextual ? pathLabel(path) : 'WorkSpec';
            this.editor.layout?.();
        }

        handleDocumentChange() {
            clearTimeout(this.changeTimer);
            this.changeTimer = setTimeout(() => {
                const next = this.parseValue();
                if (!next) return;
                const changes = this.previousValue ? diffPaths(this.previousValue, next).slice(0, 8) : [];
                this.previousValue = next;
                this.applyScope();
                if (changes.length) this.revealPaths(changes, { flash: true, source: changes.length === 1 ? 'WorkSpec updated' : `${changes.length} WorkSpec changes` });
            }, 80);
        }

        revealEntity(id, options = {}) {
            const value = this.parseValue();
            const path = value ? findEntityPath(value, id) : null;
            if (!path) return false;
            this.revealPaths([path], options);
            return true;
        }

        revealPath(path, options = {}) {
            this.revealPaths([path], options);
        }

        revealPaths(paths, options = {}) {
            if (!this.editor?.getModel) return;
            const tree = this.tree();
            const model = this.editor.getModel();
            const nodes = paths.map(path => this.nodeForPath(path, tree)).filter(Boolean);
            if (!nodes.length) return;
            const first = nodes[0];
            const firstLine = model.getPositionAt(first.keyStart ?? first.start).lineNumber;
            const lastLine = model.getPositionAt(first.end).lineNumber;
            this.editor.revealRangeInCenter?.(new monaco.Range(firstLine, 1, lastLine, 1));
            if (options.flash) {
                const decorations = nodes.map(node => {
                    const start = model.getPositionAt(node.keyStart ?? node.start).lineNumber;
                    const end = model.getPositionAt(node.end).lineNumber;
                    return { range: new monaco.Range(start, 1, end, model.getLineMaxColumn(end)), options: { isWholeLine: true, className: 'uaw-source-change-line', linesDecorationsClassName: 'uaw-source-change-gutter' } };
                });
                this.decorations = this.editor.deltaDecorations?.(this.decorations, decorations) || [];
                clearTimeout(this.decorationTimer);
                this.decorationTimer = setTimeout(() => { this.decorations = this.editor.deltaDecorations?.(this.decorations, []) || []; }, 2200);
            }
            const pathElement = document.getElementById('uaw-source-path');
            if (pathElement) pathElement.textContent = pathLabel(paths[0]);
        }

        handleSourceSelection() {
            if (!this.editor?.getModel) return;
            clearTimeout(this.selectionTimer);
            this.selectionTimer = setTimeout(() => {
                const position = this.editor.getPosition?.();
                const tree = this.tree();
                if (!position || !tree) return;
                const offset = this.editor.getModel().getOffsetAt(position);
                const node = tree.nodes.filter(candidate => candidate.start <= offset && candidate.end >= offset)
                    .sort((left, right) => right.path.length - left.path.length)[0];
                if (!node) return;
                let owner = node;
                let id = null;
                while (owner) {
                    const idNode = owner.type === 'object' && owner.children.find(child => child.path[child.path.length - 1] === 'id');
                    if (idNode?.value != null) { id = String(idNode.value); break; }
                    owner = owner.parent;
                }
                this.linkedElements.forEach(element => element.classList.remove('uaw-source-linked'));
                this.linkedElements = [];
                if (id) {
                    const escaped = window.CSS?.escape ? CSS.escape(id) : id.replace(/["\\]/g, '\\$&');
                    this.linkedElements = [...document.querySelectorAll(`[data-object-id="${escaped}"], [data-context-object-id="${escaped}"], [data-task-id="${escaped}"], [data-context-task-id="${escaped}"], [data-location-id="${escaped}"], .location-rect[data-id="${escaped}"], [data-element-id="${escaped}"], [data-display-id="${escaped}"], [data-asset-id="${escaped}"]`)];
                    this.linkedElements.forEach(element => element.classList.add('uaw-source-linked'));
                }
                const pathElement = document.getElementById('uaw-source-path');
                if (pathElement) pathElement.textContent = pathLabel(node.path);
                window.dispatchEvent(new CustomEvent('uaw:source-selection', { detail: { path: node.path, id } }));
            }, 40);
        }
    }

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = { parseJsonTree, findEntityPath, diffPaths, getAtPath };
    }
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    const controller = new SourceContextController();
    window.UAWSourceContext = controller;
    document.addEventListener('DOMContentLoaded', () => controller.initialize());
})();
