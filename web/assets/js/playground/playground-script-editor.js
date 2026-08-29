// WorkSpec Studio - WorkSpec 2.1 Script authoring surface
(function () {
    'use strict';

    const DEFAULT_SCRIPT = `// WorkSpec 2.1 Script
// Add behaviour here using the API provided by the WorkSpec runtime.
`;

    class WorkSpecScriptEditor {
        constructor() {
            this.editor = null;
            this.initializing = false;
        }

        initialize() {
            if (this.editor || this.initializing) return;
            const host = document.getElementById('uaw-script-editor');
            if (!host || !window.monaco?.editor) return;
            this.initializing = true;
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
    }

    const controller = new WorkSpecScriptEditor();
    window.UAWWorkSpecScript = controller;
    window.addEventListener('uaw:shell-ready', () => controller.initialize());
    window.addEventListener('uaw:editor-ready', () => controller.initialize());
    window.addEventListener('uaw:workspace-changed', (event) => {
        if (event.detail?.workspace !== 'script') return;
        controller.initialize();
        requestAnimationFrame(() => controller.layout());
    });
    document.addEventListener('DOMContentLoaded', () => controller.initialize());
})();
