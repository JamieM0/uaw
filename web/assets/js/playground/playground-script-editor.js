// WorkSpec Studio - WorkSpec 2.1 Script authoring surface
(function () {
    'use strict';

    const DEFAULT_SCRIPT = `// WorkSpec 2.1 Script
// Register task behaviour with WorkSpec.task(...).
// set, change, move, create and remove are available inside handlers.
`;
    const SCRIPT_API_TYPES = `
interface WorkSpecEffectOptions { temporary?: boolean; }
interface WorkSpecTaskContext {
    readonly taskId: string;
    readonly phase: 'start' | 'completion';
    set: typeof set;
    change: typeof change;
    move: typeof move;
    create: typeof create;
    remove: typeof remove;
}
interface WorkSpecTaskHandle {
    onStart(handler: (context: WorkSpecTaskContext) => void): WorkSpecTaskHandle;
    onComplete(handler: (context: WorkSpecTaskContext) => void): WorkSpecTaskHandle;
}
declare const WorkSpec: {
    task(id: string, configure?: (task: WorkSpecTaskHandle) => void): WorkSpecTaskHandle;
};
declare function set(targetId: string, property: string, value: unknown, options?: WorkSpecEffectOptions): void;
declare function change(targetId: string, property: string, amount: number, options?: WorkSpecEffectOptions): void;
declare function move(targetId: string, locationId: string, options?: WorkSpecEffectOptions): void;
declare function create(object: Record<string, unknown>): void;
declare function remove(targetId: string): void;
`;

    class WorkSpecScriptEditor {
        constructor() {
            this.editor = null;
            this.defineEditor = null;
            this.initializing = false;
            this.analysis = { taskReferences: [], handlers: [], targetReferences: [], diagnostics: [] };
        }

        initialize() {
            if (this.editor || this.initializing) return;
            const host = document.getElementById('uaw-script-editor');
            if (!host || !window.monaco?.editor) return;
            this.initializing = true;
            window.monaco.languages?.typescript?.javascriptDefaults?.addExtraLib?.(SCRIPT_API_TYPES, 'workspec-script-api.d.ts');
            const current = window.UAWProjectStore?.getCurrent?.();
            this.editor = window.monaco.editor.create(host, {
                value: current?.scriptDraft ?? DEFAULT_SCRIPT,
                language: 'javascript',
                theme: document.documentElement.dataset.theme === 'dark' || document.body.dataset.theme === 'dark' ? 'vs-dark' : 'vs',
                automaticLayout: true,
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                fontSize: 14,
                lineNumbers: 'on',
                roundedSelection: false,
                scrollbar: { vertical: 'visible', horizontal: 'visible' },
                folding: true,
                bracketMatching: 'always',
                formatOnPaste: true,
                formatOnType: true,
                tabSize: 4,
                insertSpaces: true,
                wordWrap: 'off'
            });
            this.initializing = false;
            this.editor.onDidChangeModelContent(() => this.refreshAnalysis());
            this.refreshAnalysis();
            window.workSpecScriptEditor = this.editor;
            window.dispatchEvent(new CustomEvent('uaw:script-editor-ready', { detail: { editor: this.editor } }));
        }

        format() {
            this.editor?.getAction?.('editor.action.formatDocument')?.run();
            this.editor?.focus?.();
        }

        undo() {
            this.editor?.trigger?.('workspec-script', 'undo', null);
            this.editor?.focus?.();
        }

        layout() {
            this.editor?.layout?.();
        }

        defineTaskIds() {
            try {
                const source = this.defineEditor?.getValue?.() || window.UAWProjectStore?.getCurrent?.()?.workSpecDraft || '';
                const documentValue = JSON.parse(source);
                const simulation = documentValue.simulation || documentValue;
                return (simulation.process?.tasks || simulation.tasks || []).map(task => task?.id).filter(Boolean);
            } catch (_error) {
                return [];
            }
        }

        refreshAnalysis() {
            if (!this.editor || typeof window.WorkSpecRuntime?.analyzeScript !== 'function') return this.analysis;
            this.analysis = window.WorkSpecRuntime.analyzeScript(this.editor.getValue(), { taskIds: this.defineTaskIds() });
            const markerSeverity = window.monaco?.MarkerSeverity || {};
            const markers = this.analysis.diagnostics.map(diagnostic => ({
                severity: diagnostic.severity === 'error' ? markerSeverity.Error : markerSeverity.Info,
                message: diagnostic.message,
                startLineNumber: diagnostic.line,
                startColumn: diagnostic.column,
                endLineNumber: diagnostic.line,
                endColumn: diagnostic.column + Math.max(1, diagnostic.endOffset - diagnostic.offset),
                code: diagnostic.code,
                source: 'WorkSpec Script'
            }));
            window.monaco?.editor?.setModelMarkers?.(this.editor.getModel(), 'workspec-script', markers);
            window.dispatchEvent(new CustomEvent('uaw:script-analysis', { detail: this.analysis }));
            return this.analysis;
        }

        referencesFor(kind, id) {
            const analysis = this.refreshAnalysis();
            if (kind === 'task') return analysis.handlers.filter(handler => handler.taskId === id);
            if (kind === 'object') return analysis.targetReferences.filter(reference => reference.targetId === id);
            return [];
        }

        revealReference(kind, id) {
            const reference = this.referencesFor(kind, id)[0];
            if (!reference || !this.editor) return false;
            window.UAWPlaygroundShell?.setWorkspace?.('script');
            const position = this.editor.getModel().getPositionAt(reference.offset);
            this.editor.setPosition(position);
            this.editor.revealPositionInCenter(position);
            this.editor.focus();
            return true;
        }
    }

    const controller = new WorkSpecScriptEditor();
    window.UAWWorkSpecScript = controller;
    window.addEventListener('uaw:shell-ready', () => controller.initialize());
    window.addEventListener('uaw:editor-ready', (event) => {
        controller.initialize();
        controller.defineEditor = event.detail?.editor || null;
        event.detail?.editor?.onDidChangeModelContent?.(() => controller.refreshAnalysis());
    });
    window.addEventListener('uaw:workspace-changed', (event) => {
        if (event.detail?.workspace !== 'script') return;
        controller.initialize();
        requestAnimationFrame(() => controller.layout());
    });
    window.addEventListener('uaw:project-opened', () => controller.refreshAnalysis());
    document.addEventListener('DOMContentLoaded', () => controller.initialize());
})();
