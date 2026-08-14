// Shared canvas contract for physical, digital and display environments.
(function () {
    'use strict';

    const definitions = {
        physical: {
            tab: 'space-editor',
            canvas: '#space-canvas',
            editor: () => window.spaceEditor,
            selection: editor => editor?.selectedRectId || null
        },
        digital: {
            tab: 'digital-space',
            canvas: '#digital-space-canvas',
            editor: () => window.digitalSpaceEditor,
            selection: editor => editor?.selectedRectId || editor?.selectedConnectionId || null
        },
        displays: {
            tab: 'display-editor',
            canvas: '#display-canvas',
            editor: () => window.displayEditor,
            selection: editor => editor?.selectedRectId || editor?.selectedDisplayId || null
        }
    };

    class CanvasWorkspace {
        constructor() {
            this.active = 'physical';
            this.selectionByEnvironment = new Map();
        }

        initialize() {
            document.querySelectorAll('.simulation-panel .tab-btn[data-tab]').forEach(button => {
                button.addEventListener('click', () => {
                    const environment = Object.entries(definitions).find(([, definition]) => definition.tab === button.dataset.tab)?.[0];
                    if (!environment) return;
                    this.captureSelection(this.active);
                    this.active = environment;
                    requestAnimationFrame(() => {
                        definitions[environment].editor()?.updateTransform?.();
                        document.querySelector(definitions[environment].canvas)?.focus?.({ preventScroll: true });
                        window.dispatchEvent(new CustomEvent('uaw:canvas-environment-changed', {
                            detail: { environment, selection: this.getSelection() }
                        }));
                    });
                });
            });

            const observer = new MutationObserver(() => {
                const selection = this.getSelection();
                if (selection === this.selectionByEnvironment.get(this.active)) return;
                this.selectionByEnvironment.set(this.active, selection);
                window.dispatchEvent(new CustomEvent('uaw:canvas-selection-changed', {
                    detail: { environment: this.active, selection }
                }));
            });
            Object.values(definitions).forEach(definition => {
                const canvas = document.querySelector(definition.canvas);
                if (canvas) observer.observe(canvas, { subtree: true, attributes: true, attributeFilter: ['class', 'aria-selected'] });
            });
        }

        getEditor(environment = this.active) {
            return definitions[environment]?.editor() || null;
        }

        getSelection(environment = this.active) {
            const definition = definitions[environment];
            return definition ? definition.selection(definition.editor()) : null;
        }

        captureSelection(environment = this.active) {
            this.selectionByEnvironment.set(environment, this.getSelection(environment));
        }

        switchTo(environment) {
            const definition = definitions[environment];
            if (!definition) return false;
            document.querySelector(`.simulation-panel .tab-btn[data-tab="${definition.tab}"]`)?.click();
            return true;
        }

        fitSelection() {
            this.getEditor()?.zoomToFit?.();
        }
    }

    const workspace = new CanvasWorkspace();
    window.UAWCanvasWorkspace = workspace;
    document.addEventListener('DOMContentLoaded', () => workspace.initialize());
})();
