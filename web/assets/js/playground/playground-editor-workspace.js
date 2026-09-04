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
            this.initializing = false;
            this.analysis = { taskReferences: [], handlers: [], targetReferences: [], diagnostics: [] };
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
                pane.querySelectorAll('[data-editor-tab]').forEach((button) => button.addEventListener('click', () => this.select(index, button.dataset.editorTab)));
                this.updateTabs(index);
            });
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

        moveValidationPanel(host) {
            const panel = document.querySelector('.playground-bottom');
            if (!panel || panel.parentElement === host.parentElement) return;
            panel.classList.add('uaw-editor-validation');
            host.parentElement.appendChild(panel);
        }

        select(index, id) {
            if (!this.models.has(id) || !this.editors[index]) return;
            this.selections[index] = id;
            this.editors[index].setModel(this.models.get(id));
            this.updateTabs(index);
            this.persistSelections();
            this.editors[index].focus();
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
            const project = window.UAWProjectStore?.getCurrent?.();
            if (!project) return;
            project.settings = { ...(project.settings || {}), workspace: { ...(project.settings?.workspace || {}), editorPanes: [...this.selections] } };
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
        layout() { this.editors.forEach((editor) => editor.layout()); }

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
    window.addEventListener('uaw:workspace-changed', (event) => { if (event.detail?.workspace === 'editor') { controller.initialize(); requestAnimationFrame(() => controller.layout()); } });
    window.addEventListener('uaw:project-opened', () => controller.refreshAnalysis());
    document.addEventListener('DOMContentLoaded', () => controller.initialize());
}());
