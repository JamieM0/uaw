// WorkSpec Studio 2.2 - general two-pane project editor
(function () {
    'use strict';

    const TABS = [
        ['starting-state', 'Starting State', 'json'],
        ['changes', 'Changes', 'javascript'],
        ['generator', 'Generator', 'javascript'],
        ['custom-constraints', 'Custom Constraints', 'javascript'],
        ['constraint-library', 'Constraint Library', 'json']
    ];
    const CHANGES_TYPES = `
interface WorkSpecEffectOptions { temporary?: boolean; }
interface WorkSpecTaskContext { readonly taskId: string; readonly phase: 'start' | 'completion'; set: typeof set; change: typeof change; move: typeof move; create: typeof create; remove: typeof remove; }
interface WorkSpecTaskHandle { onStart(handler: (context: WorkSpecTaskContext) => void): WorkSpecTaskHandle; onComplete(handler: (context: WorkSpecTaskContext) => void): WorkSpecTaskHandle; }
declare const WorkSpec: { task(id: string, configure?: (task: WorkSpecTaskHandle) => void): WorkSpecTaskHandle; };
declare function set(targetId: string, property: string, value: unknown, options?: WorkSpecEffectOptions): void;
declare function change(targetId: string, property: string, amount: number, options?: WorkSpecEffectOptions): void;
declare function move(targetId: string, locationId: string, options?: WorkSpecEffectOptions): void;
declare function create(object: Record<string, unknown>): void;
declare function remove(targetId: string): void;
`;
    const GENERATOR_TYPES = `
interface WorkSpecGeneratorState { readonly objects: Readonly<Record<string, unknown>>; readonly locations: Readonly<Record<string, unknown>>; }
interface WorkSpecGeneratorContext { readonly time: number; readonly delta: number; readonly state: WorkSpecGeneratorState; random(): number; get(targetId: string, property: string): unknown; set(targetId: string, property: string, value: unknown): void; change(targetId: string, property: string, amount: number): void; move(targetId: string, locationId: string): void; create(object: Record<string, unknown>): void; remove(targetId: string): void; }
declare const WorkSpec: { onStart(handler: (context: WorkSpecGeneratorContext) => void): void; onUpdate(handler: (context: WorkSpecGeneratorContext) => void): void; generator(definition: { onStart?: (context: WorkSpecGeneratorContext) => void; onUpdate?: (context: WorkSpecGeneratorContext) => void }): void; };
`;

    class WorkSpecEditor {
        constructor() {
            this.editors = [];
            this.models = new Map();
            this.selections = ['starting-state', 'generator'];
            this.sourceSelection = 'starting-state';
            this.initializing = false;
            this.analysis = { taskReferences: [], handlers: [], targetReferences: [], diagnostics: [] };
            this.paneStates = {};
            this.persistTimer = null;
        }

        initialize() {
            if (this.editors.length || this.initializing) return;
            const host = document.getElementById('uaw-editor-panes');
            if (!host || !window.monaco?.editor || !window.monacoEditor?.getModel?.()) return;
            this.initializing = true;
            window.monaco.languages?.typescript?.javascriptDefaults?.addExtraLib?.(CHANGES_TYPES, 'workspec-changes.d.ts');
            window.monaco.languages?.typescript?.javascriptDefaults?.addExtraLib?.(GENERATOR_TYPES, 'workspec-generator.d.ts');
            const project = window.UAWProjectStore?.getCurrent?.();
            const saved = project?.settings?.workspace?.editorPanes;
            if (Array.isArray(saved) && saved.length === 2 && saved.every((id) => TABS.some(([tab]) => tab === id))) this.selections = saved;

            try {
                const sessionSaved = JSON.parse(sessionStorage.getItem('uaw:editor-scroll-positions') || 'null');
                if (sessionSaved) this.loadSavedScrollPositions(sessionSaved);
            } catch (_e) {}
            const savedScroll = project?.settings?.workspace?.editorScrollPositions;
            if (savedScroll) this.loadSavedScrollPositions(savedScroll);

            this.models.set('starting-state', window.monacoEditor.getModel());
            this.models.set('changes', window.monaco.editor.createModel(project?.changesDraft || '', 'javascript'));
            this.models.set('generator', window.monaco.editor.createModel(project?.generatorDraft || '', 'javascript'));
            this.models.set('custom-constraints', window.monaco.editor.createModel(project?.settings?.customMetrics?.validator || '', 'javascript'));
            this.models.set('constraint-library', window.monaco.editor.createModel(project?.settings?.customMetrics?.catalog || '[]', 'json'));
            host.innerHTML = [0, 1].map((index) => `<section class="uaw-editor-pane" data-editor-pane="${index}"><div class="uaw-editor-tabs" role="tablist" aria-label="Editor ${index + 1}">${TABS.map(([id, label]) => `<button type="button" role="tab" data-editor-tab="${id}">${label}</button>`).join('')}</div><div class="uaw-editor-host" data-editor-host="${index}"></div></section>`).join('');
            host.querySelectorAll('[data-editor-pane]').forEach((pane, index) => {
                const editor = window.monaco.editor.create(pane.querySelector('[data-editor-host]'), {
                    model: this.models.get(this.selections[index]),
                    theme: document.documentElement.dataset.theme === 'dark' || document.body.dataset.theme === 'dark' ? 'vs-dark' : 'vs',
                    automaticLayout: true, minimap: { enabled: false }, scrollBeyondLastLine: false,
                    fontSize: 13, lineNumbers: 'on', folding: true, bracketMatching: 'always',
                    formatOnPaste: true, formatOnType: true, tabSize: 4, insertSpaces: true, wordWrap: 'off'
                });
                this.editors[index] = editor;
                this.bindScrollTracking(editor, `pane-${index}`, () => this.selections[index]);
                pane.querySelectorAll('[data-editor-tab]').forEach((button) => button.addEventListener('click', () => this.select(index, button.dataset.editorTab)));
                this.updateTabs(index);
                this.restoreState(editor, this.selections[index]);
            });
            this.initializeSourcePane();
            this.models.get('changes').onDidChangeContent(() => { this.refreshAnalysis(); this.scheduleExecutionRefresh(); });
            this.models.get('generator').onDidChangeContent(() => this.scheduleExecutionRefresh());
            for (const id of ['custom-constraints', 'constraint-library']) this.models.get(id).onDidChangeContent(() => this.saveConstraintSource());
            window.workSpecChangesEditor = this.models.get('changes');
            window.workSpecGeneratorEditor = this.models.get('generator');
            window.dispatchEvent(new CustomEvent('uaw:changes-editor-ready', { detail: { editor: this.models.get('changes') } }));
            window.dispatchEvent(new CustomEvent('uaw:generator-editor-ready', { detail: { editor: this.models.get('generator') } }));
            this.installStartingStateCodeActions();
            this.moveValidationPanel(host);
            this.refreshAnalysis();
            this.initializing = false;
        }

        // The docked Starting State view deliberately uses the same editor pane
        // component as the Editor workspace.  Keeping it here means new tabs or
        // editor options automatically arrive in both places.
        initializeSourcePane() {
            if (this.sourceEditor) return;
            const sourcePane = document.getElementById('uaw-source-pane');
            if (!sourcePane) return;

            // The original Monaco host remains mounted for the legacy canvas
            // integrations, but is no longer the split editor surface.
            const legacyPanel = sourcePane.querySelector('.json-editor-panel');
            const legacyHost = document.getElementById('uaw-legacy-host');
            if (legacyPanel && legacyHost) legacyHost.appendChild(legacyPanel);

            sourcePane.insertAdjacentHTML('beforeend', `<section class="uaw-editor-pane uaw-editor-pane--source" data-source-editor-pane>
                <div class="uaw-editor-tabs" role="tablist" aria-label="Starting State editor">${TABS.map(([id, label]) => `<button type="button" role="tab" data-source-editor-tab="${id}">${label}</button>`).join('')}</div>
                <div class="uaw-source-lip" data-source-editor-lip></div>
                <div class="uaw-editor-host" data-source-editor-host></div>
            </section>`);
            const pane = sourcePane.querySelector('[data-source-editor-pane]');
            this.sourceSelection = 'starting-state';
            this.sourceEditor = window.monaco.editor.create(pane.querySelector('[data-source-editor-host]'), {
                model: this.models.get(this.sourceSelection),
                theme: document.documentElement.dataset.theme === 'dark' || document.body.dataset.theme === 'dark' ? 'vs-dark' : 'vs',
                automaticLayout: true, minimap: { enabled: false }, scrollBeyondLastLine: false,
                fontSize: 13, lineNumbers: 'on', folding: true, bracketMatching: 'always',
                formatOnPaste: true, formatOnType: true, tabSize: 4, insertSpaces: true, wordWrap: 'off'
            });
            this.bindScrollTracking(this.sourceEditor, 'source', () => this.sourceSelection);
            pane.querySelectorAll('[data-source-editor-tab]').forEach((button) => button.addEventListener('click', () => this.selectSource(button.dataset.sourceEditorTab)));
            this.updateSourceTabs();
            this.restoreState(this.sourceEditor, this.sourceSelection);
            window.dispatchEvent(new CustomEvent('uaw:source-editor-ready', { detail: { editor: this.sourceEditor } }));
        }

        saveState(editor, tabId) {
            if (!editor || !tabId) return;
            const key = editor._uawPaneKey;
            if (!key) return;
            const dom = editor.getDomNode?.();
            if (!dom || dom.clientHeight === 0) return;
            if (!this.paneStates[key]) this.paneStates[key] = {};
            this.paneStates[key][tabId] = {
                viewState: editor.saveViewState?.() || null,
                scrollTop: editor.getScrollTop?.() ?? 0,
                scrollLeft: editor.getScrollLeft?.() ?? 0
            };
            this.schedulePersistScrollPositions();
        }

        restoreState(editor, tabId) {
            if (!editor || !tabId) return;
            const key = editor._uawPaneKey;
            if (!key) return;
            const state = this.paneStates[key]?.[tabId];
            if (!state) return;
            editor._uawIgnoreScroll = true;
            try {
                if (state.viewState) {
                    try {
                        editor.restoreViewState(state.viewState);
                    } catch (_e) {}
                }
                if (typeof state.scrollTop === 'number') {
                    editor.setScrollTop(state.scrollTop);
                }
                if (typeof state.scrollLeft === 'number') {
                    editor.setScrollLeft(state.scrollLeft);
                }
            } finally {
                editor._uawIgnoreScroll = false;
            }
            requestAnimationFrame(() => {
                if (typeof state.scrollTop === 'number' && Math.abs((editor.getScrollTop?.() ?? 0) - state.scrollTop) > 1) {
                    editor._uawIgnoreScroll = true;
                    try {
                        editor.setScrollTop?.(state.scrollTop);
                    } finally {
                        editor._uawIgnoreScroll = false;
                    }
                }
                if (typeof state.scrollLeft === 'number' && Math.abs((editor.getScrollLeft?.() ?? 0) - state.scrollLeft) > 1) {
                    editor._uawIgnoreScroll = true;
                    try {
                        editor.setScrollLeft?.(state.scrollLeft);
                    } finally {
                        editor._uawIgnoreScroll = false;
                    }
                }
            });
        }

        bindScrollTracking(editor, key, getTabId) {
            editor._uawPaneKey = key;
            editor.onDidScrollChange((event) => {
                if (editor._uawIgnoreScroll) return;
                const dom = editor.getDomNode?.();
                if (!dom || dom.clientHeight === 0) return;
                const tabId = getTabId();
                if (!tabId) return;
                if (!this.paneStates[key]) this.paneStates[key] = {};
                this.paneStates[key][tabId] = {
                    viewState: editor.saveViewState?.() || null,
                    scrollTop: event.scrollTop,
                    scrollLeft: event.scrollLeft
                };
                this.schedulePersistScrollPositions();
            });
            editor.onDidBlurEditorText?.(() => {
                if (editor._uawIgnoreScroll) return;
                const tabId = getTabId();
                if (tabId) this.saveState(editor, tabId);
            });
        }

        saveActiveStates() {
            this.editors.forEach((editor, index) => {
                const tabId = this.selections[index];
                if (tabId) this.saveState(editor, tabId);
            });
            if (this.sourceEditor && this.sourceSelection) {
                this.saveState(this.sourceEditor, this.sourceSelection);
            }
        }

        restoreVisibleScrollPositions() {
            this.editors.forEach((editor, index) => {
                const dom = editor.getDomNode?.();
                const tabId = this.selections[index];
                if (dom && dom.clientHeight > 0 && tabId) {
                    const state = this.paneStates[editor._uawPaneKey]?.[tabId];
                    if (state) {
                        this.restoreState(editor, tabId);
                    }
                }
            });
            if (this.sourceEditor) {
                const dom = this.sourceEditor.getDomNode?.();
                const tabId = this.sourceSelection;
                if (dom && dom.clientHeight > 0 && tabId) {
                    const state = this.paneStates[this.sourceEditor._uawPaneKey]?.[tabId];
                    if (state) {
                        this.restoreState(this.sourceEditor, tabId);
                    }
                }
            }
        }

        serializeScrollPositions() {
            const result = {};
            for (const [key, tabs] of Object.entries(this.paneStates)) {
                result[key] = {};
                for (const [tabId, state] of Object.entries(tabs)) {
                    if (!state) continue;
                    result[key][tabId] = {
                        scrollTop: Math.round(state.scrollTop || 0),
                        scrollLeft: Math.round(state.scrollLeft || 0),
                        viewState: state.viewState || null
                    };
                }
            }
            return result;
        }

        loadSavedScrollPositions(saved) {
            if (!saved || typeof saved !== 'object') return;
            for (const [key, tabs] of Object.entries(saved)) {
                if (!tabs || typeof tabs !== 'object') continue;
                if (!this.paneStates[key]) this.paneStates[key] = {};
                for (const [tabId, state] of Object.entries(tabs)) {
                    if (!state || typeof state !== 'object') continue;
                    this.paneStates[key][tabId] = {
                        scrollTop: typeof state.scrollTop === 'number' ? state.scrollTop : 0,
                        scrollLeft: typeof state.scrollLeft === 'number' ? state.scrollLeft : 0,
                        viewState: state.viewState || null
                    };
                }
            }
        }

        schedulePersistScrollPositions() {
            clearTimeout(this.persistTimer);
            this.persistTimer = setTimeout(() => {
                this.persistSelections();
            }, 300);
        }

        selectSource(id) {
            if (!this.models.has(id) || !this.sourceEditor) return;
            if (this.sourceSelection === id) {
                this.sourceEditor.focus();
                return;
            }
            const prevTab = this.sourceSelection;
            if (prevTab) {
                this.saveState(this.sourceEditor, prevTab);
            }
            this.sourceSelection = id;
            this.sourceEditor._uawIgnoreScroll = true;
            this.sourceEditor.setModel(this.models.get(id));
            this.sourceEditor._uawIgnoreScroll = false;
            this.restoreState(this.sourceEditor, id);
            this.updateSourceTabs();
            this.persistSelections();
            this.sourceEditor.focus();
            window.dispatchEvent(new CustomEvent('uaw:source-editor-model-changed', { detail: { editor: this.sourceEditor, tab: id } }));
        }

        updateSourceTabs() {
            document.querySelectorAll('[data-source-editor-tab]').forEach((button) => {
                const selected = button.dataset.sourceEditorTab === this.sourceSelection;
                button.classList.toggle('active', selected);
                button.setAttribute('aria-selected', String(selected));
            });
        }

        moveValidationPanel(host) {
            const panel = document.querySelector('.playground-bottom');
            if (!panel || panel.parentElement === host.parentElement) return;
            panel.classList.add('uaw-editor-validation');
            host.parentElement.appendChild(panel);
        }

        select(index, id) {
            const editor = this.editors[index];
            if (!this.models.has(id) || !editor) return;
            if (this.selections[index] === id) {
                editor.focus();
                return;
            }
            const prevTab = this.selections[index];
            if (prevTab) {
                this.saveState(editor, prevTab);
            }
            this.selections[index] = id;
            editor._uawIgnoreScroll = true;
            editor.setModel(this.models.get(id));
            editor._uawIgnoreScroll = false;
            this.restoreState(editor, id);
            this.updateTabs(index);
            this.persistSelections();
            editor.focus();
        }

        updateTabs(index) {
            const pane = document.querySelector(`[data-editor-pane="${index}"]`);
            pane?.querySelectorAll('[data-editor-tab]').forEach((button) => {
                const selected = button.dataset.editorTab === this.selections[index];
                button.classList.toggle('active', selected);
                button.setAttribute('aria-selected', String(selected));
            });
        }

        persistSelections() {
            const serialized = this.serializeScrollPositions();
            try {
                sessionStorage.setItem('uaw:editor-scroll-positions', JSON.stringify(serialized));
            } catch (_e) {}
            const project = window.UAWProjectStore?.getCurrent?.();
            if (!project) return;
            project.settings = {
                ...(project.settings || {}),
                workspace: {
                    ...(project.settings?.workspace || {}),
                    editorPanes: [...this.selections],
                    editorScrollPositions: serialized
                }
            };
            window.UAWProjectStore?.scheduleSave?.();
        }

        saveConstraintSource() {
            const project = window.UAWProjectStore?.getCurrent?.();
            if (!project) return;
            project.settings = { ...(project.settings || {}), customMetrics: { ...(project.settings?.customMetrics || {}), validator: this.models.get('custom-constraints').getValue(), catalog: this.models.get('constraint-library').getValue() } };
            window.UAWProjectStore?.scheduleSave?.();
        }

        scheduleExecutionRefresh() {
            clearTimeout(this.executionRefreshTimer);
            this.executionRefreshTimer = setTimeout(() => {
                window.validateJSON?.();
                if (typeof autoRender !== 'undefined' && autoRender && !window.simulationPlayerActive) window.renderSimulation?.();
            }, 500);
        }

        activeEditor() { return this.editors.find((candidate) => candidate.hasTextFocus()) || this.editors[0]; }
        format() { this.activeEditor()?.getAction?.('editor.action.formatDocument')?.run(); }
        undo() { this.activeEditor()?.trigger?.('workspec-editor', 'undo', null); }
        layout() {
            this.editors.forEach((editor) => editor.layout());
            this.sourceEditor?.layout();
            this.restoreVisibleScrollPositions();
        }

        taskIds() {
            try {
                const documentValue = JSON.parse(this.models.get('starting-state').getValue());
                return (documentValue.simulation?.process?.tasks || []).map((task) => task?.id).filter(Boolean);
            } catch (_error) { return []; }
        }

        refreshAnalysis() {
            if (!this.models.has('changes') || !window.WorkSpecRuntime?.analyzeChanges) return this.analysis;
            this.analysis = window.WorkSpecRuntime.analyzeChanges(this.models.get('changes').getValue(), { taskIds: this.taskIds() });
            const severity = window.monaco?.MarkerSeverity || {};
            window.monaco.editor.setModelMarkers(this.models.get('changes'), 'workspec-changes', this.analysis.diagnostics.map((diagnostic) => ({
                severity: diagnostic.severity === 'error' ? severity.Error : severity.Info,
                message: diagnostic.message.replace(/Script/g, 'Changes'), startLineNumber: diagnostic.line, startColumn: diagnostic.column,
                endLineNumber: diagnostic.line, endColumn: diagnostic.column + Math.max(1, diagnostic.endOffset - diagnostic.offset), code: diagnostic.code, source: 'WorkSpec Changes'
            })));
            return this.analysis;
        }

        revealReference(kind, id) {
            const references = kind === 'task' ? this.refreshAnalysis().handlers.filter((item) => item.taskId === id) : this.refreshAnalysis().targetReferences.filter((item) => item.targetId === id);
            const reference = references[0];
            if (!reference) return false;
            this.select(0, 'changes');
            const position = this.models.get('changes').getPositionAt(reference.offset);
            this.editors[0].setPosition(position); this.editors[0].revealPositionInCenter(position); this.editors[0].focus();
            return true;
        }

        correctionEdit(problem) {
            const correction = problem?.context?.correction;
            const taskId = problem?.context?.task_id;
            if (!correction || !taskId) return null;
            const model = this.models.get('starting-state');
            const source = model.getValue();
            const escapedId = String(taskId).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const idMatch = new RegExp(`"id"\\s*:\\s*"${escapedId}"`).exec(source);
            if (!idMatch) return null;
            const tail = source.slice(idMatch.index + idMatch[0].length);
            const nextId = tail.search(/\n\s*\{\s*"id"\s*:/);
            const taskEnd = nextId < 0 ? source.length : idMatch.index + idMatch[0].length + nextId;
            const startPattern = /"start"\s*:\s*("(?:\\.|[^"\\])*"|\{[^{}]*\})/g;
            startPattern.lastIndex = idMatch.index;
            const match = startPattern.exec(source);
            if (!match || match.index >= taskEnd) return null;
            const valueOffset = match.index + match[0].lastIndexOf(match[1]);
            return { range: window.monaco.Range.fromPositions(model.getPositionAt(valueOffset), model.getPositionAt(valueOffset + match[1].length)), text: JSON.stringify(correction.value) };
        }

        applyCorrection(problem) {
            const edit = this.correctionEdit(problem);
            if (!edit) return false;
            this.select(0, 'starting-state');
            this.editors[0].executeEdits('workspec-timing-correction', [edit]);
            this.editors[0].focus();
            return true;
        }

        installStartingStateCodeActions() {
            if (WorkSpecEditor.codeActionsInstalled) return;
            WorkSpecEditor.codeActionsInstalled = true;
            window.monaco.languages.registerCodeActionProvider('json', {
                provideCodeActions: (model) => {
                    if (model !== this.models.get('starting-state')) return { actions: [], dispose() {} };
                    let problems = [];
                    try {
                        const source = typeof stripJsonComments === 'function' ? stripJsonComments(model.getValue()) : model.getValue();
                        problems = window.WorkSpecValidator?.validate?.(JSON.parse(source))?.problems || [];
                    } catch (_error) { /* Monaco owns syntax errors. */ }
                    const actions = problems.filter((problem) => problem.metric_id === 'temporal.scheduling.dependency_violation').map((problem) => {
                        const edit = this.correctionEdit(problem);
                        return edit ? { title: `Set explicit start to ${JSON.stringify(problem.context.suggested_start)}`, kind: 'quickfix', isPreferred: true, edit: { edits: [{ resource: model.uri, textEdit: edit }] } } : null;
                    }).filter(Boolean);
                    return { actions, dispose() {} };
                }
            });
        }
    }

    const controller = new WorkSpecEditor();
    window.UAWWorkSpecEditor = controller;
    window.addEventListener('uaw:shell-ready', () => controller.initialize());
    window.addEventListener('uaw:editor-ready', () => controller.initialize());
    window.addEventListener('uaw:workspace-changed', (event) => {
        if (event.detail?.workspace === 'editor') {
            controller.initialize();
            requestAnimationFrame(() => {
                controller.layout();
                controller.restoreVisibleScrollPositions();
            });
        } else {
            requestAnimationFrame(() => {
                controller.layout();
                controller.restoreVisibleScrollPositions();
            });
        }
    });
    window.addEventListener('uaw:project-opened', () => {
        const project = window.UAWProjectStore?.getCurrent?.();
        const savedScroll = project?.settings?.workspace?.editorScrollPositions;
        if (savedScroll) controller.loadSavedScrollPositions(savedScroll);
        controller.refreshAnalysis();
    });
    document.addEventListener('DOMContentLoaded', () => controller.initialize());
}());
