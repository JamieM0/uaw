// UAW Playground v2 - pragmatic desktop application shell
(function () {
    'use strict';

    const SETTINGS_KEY = 'uaw-playground-v2-settings';
    const DEFAULT_SETTINGS = {
        lastWorkspace: 'projects',
        sourceDock: 'hidden',
        explorerOpen: true,
        inspectorOpen: false,
        problemsOpen: false,
        onboardingDismissed: false,
        modelView: 'process',
        reviewView: 'problems',
        layoutVersion: 3
    };

    const WORKSPACE_META = {
        projects: { title: 'Projects', description: 'Local WorkSpec projects' },
        build: { title: 'Model', description: 'Author the process and its environment' },
        run: { title: 'Simulate', description: 'Run and inspect the current model' },
        validate: { title: 'Review', description: 'Resolve problems and define quality rules' },
        assets: { title: 'Assets', description: 'Project files and embedded media' },
        settings: { title: 'Settings', description: 'Workspace preferences and integrations' },
        source: { title: 'Source', description: 'Edit the WorkSpec document directly' }
    };

    const ICONS = {
        projects: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 6.5h6l1.7 2H20.5v10H3.5z"/><path d="M3.5 6.5v-2h6l1.7 2"/></svg>',
        build: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5h5v5H5zM14 14h5v5h-5zM14 5h5v5h-5zM10 7.5h4M16.5 10v4M10 8v8h4"/></svg>',
        run: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 5 11 7-11 7z"/></svg>',
        validate: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5 20 7v5c0 4.5-3 7.4-8 9-5-1.6-8-4.5-8-9V7z"/><path d="m8.5 12 2.3 2.3 4.8-5"/></svg>',
        assets: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5.5h16v13H4z"/><path d="m4 15 4.5-4.5 3.5 3 2.5-2 5.5 5M15.5 9h.01"/></svg>',
        settings: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z"/><path d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.4-2.4 1a8 8 0 0 0-1.8-1L14.4 3h-4.8l-.4 3.1a8 8 0 0 0-1.8 1l-2.4-1-2 3.4L5.1 11a7 7 0 0 0 0 2l-2 1.5 2 3.4 2.4-1a8 8 0 0 0 1.8 1l.4 3.1h4.8l.4-3.1a8 8 0 0 0 1.8-1l2.4 1 2-3.4-2.1-1.5a7 7 0 0 0 .1-1z"/></svg>',
        source: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6-6 6 6 6M15 6l6 6-6 6M13.5 4l-3 16"/></svg>',
        agent: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7.5h14v10H5zM9 17.5v2M15 17.5v2M9 11h.01M15 11h.01M9 14h6M12 7.5V4M10.5 4h3"/></svg>',
        search: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5"/></svg>',
        panel: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 4.5h17v15h-17zM15 4.5v15"/></svg>',
        chevron: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>',
        close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>'
    };

    const escapeHTML = (value) => String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');

    class PlaygroundShell {
        constructor() {
            this.settings = this.loadSettings();
            this.workspace = this.settings.lastWorkspace;
            this.commands = new Map();
            this.shell = null;
            this.legacyMain = null;
            this.legacyHeader = null;
            this.activeCanvas = 'timeline';
            this.modelView = this.settings.modelView;
            this.reviewView = this.settings.reviewView;
            this.projectStore = window.UAWProjectStore;
            this.projectRenderToken = 0;
        }

        loadSettings() {
            try {
                const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
                if (saved.layoutVersion !== DEFAULT_SETTINGS.layoutVersion) {
                    return { ...DEFAULT_SETTINGS, onboardingDismissed: Boolean(saved.onboardingDismissed) };
                }
                return { ...DEFAULT_SETTINGS, ...saved };
            } catch (_error) {
                return { ...DEFAULT_SETTINGS };
            }
        }

        saveSettings() {
            localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings));
        }

        icon(name) {
            return `<span class="uaw-icon">${ICONS[name] || ''}</span>`;
        }

        initialize() {
            if (document.getElementById('uaw-app-shell')) return;
            // Metrics/Rules is a Review subview, never a global display mode.
            localStorage.setItem('uaw-metrics-mode', 'false');
            this.legacyHeader = document.querySelector('.playground-header');
            this.legacyMain = document.querySelector('.playground-main');
            if (!this.legacyHeader || !this.legacyMain) return;

            document.body.classList.add('uaw-v2');
            document.body.dataset.uawWorkspace = this.workspace;
            this.createShell();
            this.rehomeLegacyComponents();
            this.prepareEnvironmentTabs();
            this.prepareInspector();
            this.registerCommands();
            this.bindEvents();
            this.applySettings();
            this.setWorkspace(this.workspace, { animate: false, persist: false });
            this.renderProjectOutline();
            this.renderProjects();
            this.updateDocumentSummary();
            window.dispatchEvent(new CustomEvent('uaw:shell-ready', { detail: { shell: this } }));
        }

        createShell() {
            const shell = document.createElement('div');
            shell.id = 'uaw-app-shell';
            shell.className = 'uaw-app-shell';
            shell.innerHTML = `
                <header class="uaw-titlebar">
                    <a class="uaw-brand" href="/" aria-label="Universal Automation Wiki home">
                        <img src="/assets/images/logomark.png" alt="" />
                        <span>UAW</span>
                    </a>
                    <div class="uaw-titlebar__divider"></div>
                    <button class="uaw-project-title" id="uaw-project-title" type="button" title="Switch project" aria-haspopup="menu" aria-expanded="false">
                        <span id="uaw-project-name">My first project</span>
                        ${this.icon('chevron')}
                    </button>
                    <span class="uaw-save-state" id="uaw-save-state" aria-live="polite">Saved locally</span>
                    <div class="uaw-titlebar__spacer"></div>
                    <button class="uaw-quiet-button uaw-command-trigger" id="uaw-command-trigger" type="button">
                        ${this.icon('search')}<span>Search commands</span><kbd>⌘ K</kbd>
                    </button>
                    <button class="uaw-icon-button" id="uaw-toggle-inspector" type="button" title="Toggle inspector">
                        ${this.icon('panel')}<span class="sr-only">Toggle inspector</span>
                    </button>
                    <button class="uaw-agent-button" id="uaw-agent-button" type="button">
                        ${this.icon('agent')}<span>Agent</span><span class="uaw-agent-dot" aria-hidden="true"></span>
                    </button>
                </header>

                <div class="uaw-project-menu" id="uaw-project-menu" role="menu" hidden></div>

                <div class="uaw-app-body">
                    <nav class="uaw-rail" aria-label="Playground workspaces">
                        <div class="uaw-rail__primary">
                            ${this.workspaceButton('projects', 'Projects', '1')}
                            ${this.workspaceButton('build', 'Model', '2')}
                            ${this.workspaceButton('run', 'Simulate', '3')}
                            ${this.workspaceButton('validate', 'Review', '4')}
                            ${this.workspaceButton('assets', 'Assets', '5')}
                        </div>
                        <div class="uaw-rail__secondary">
                            ${this.workspaceButton('settings', 'Settings', '6')}
                        </div>
                    </nav>

                    <div class="uaw-workarea">
                        <div class="uaw-commandbar" id="uaw-commandbar" aria-label="Contextual commands">
                            <div class="uaw-commandbar__identity">
                                <strong id="uaw-workspace-title">Build</strong>
                                <span id="uaw-workspace-description"></span>
                            </div>
                            <div class="uaw-commandbar__commands uaw-commandbar__commands--primary" id="uaw-primary-commands"></div>
                            <div class="uaw-commandbar__commands" id="uaw-playback-commands"></div>
                            <div class="uaw-commandbar__commands uaw-commandbar__commands--end" id="uaw-context-commands"></div>
                        </div>

                        <div class="uaw-workspace-grid">
                            <aside class="uaw-explorer" id="uaw-explorer" aria-label="Project outline">
                                <div class="uaw-pane-header">
                                    <span>Project</span>
                                    <button class="uaw-icon-button uaw-icon-button--small" id="uaw-close-explorer" type="button" title="Close project outline">${this.icon('close')}</button>
                                </div>
                                <div class="uaw-explorer__content" id="uaw-project-outline"></div>
                            </aside>

                            <section class="uaw-stage" id="uaw-stage">
                                <section class="uaw-product-view" id="uaw-projects-view" aria-label="Projects"></section>
                                <section class="uaw-product-view" id="uaw-process-view" aria-label="Process definition"></section>
                                <section class="uaw-product-view" id="uaw-assets-view" aria-label="Assets"></section>
                                <section class="uaw-product-view" id="uaw-settings-view" aria-label="Settings"></section>
                                <div id="uaw-legacy-host" class="uaw-legacy-host"></div>
                            </section>

                            <aside class="uaw-inspector" id="uaw-inspector" aria-label="Inspector">
                                <div class="uaw-pane-header">
                                    <span id="uaw-inspector-title">Inspector</span>
                                    <button class="uaw-icon-button uaw-icon-button--small" id="uaw-close-inspector" type="button" title="Close inspector">${this.icon('close')}</button>
                                </div>
                                <div class="uaw-inspector__content" id="uaw-inspector-content">
                                    <div id="uaw-inspector-context" class="uaw-inspector-context"></div>
                                    <div id="uaw-inspector-live"></div>
                                </div>
                            </aside>
                        </div>
                    </div>
                </div>

                <div class="uaw-command-palette" id="uaw-command-palette" hidden>
                    <div class="uaw-command-palette__backdrop" data-close-palette></div>
                    <section class="uaw-command-palette__dialog" role="dialog" aria-modal="true" aria-labelledby="uaw-command-palette-title">
                        <h2 id="uaw-command-palette-title" class="sr-only">Commands</h2>
                        <label class="uaw-command-search">
                            ${this.icon('search')}
                            <input id="uaw-command-search" type="search" autocomplete="off" placeholder="Type a command or project entity…" />
                            <kbd>Esc</kbd>
                        </label>
                        <div id="uaw-command-results" class="uaw-command-results" role="listbox"></div>
                    </section>
                </div>

                <div class="uaw-shortcuts-dialog" id="uaw-shortcuts-dialog" hidden>
                    <div class="uaw-command-palette__backdrop" data-close-shortcuts></div>
                    <section class="uaw-shortcuts-card" role="dialog" aria-modal="true" aria-labelledby="uaw-shortcuts-title">
                        <div class="uaw-pane-header"><h2 id="uaw-shortcuts-title">Keyboard shortcuts</h2><button class="uaw-icon-button" data-close-shortcuts>${this.icon('close')}</button></div>
                        <div class="uaw-shortcuts-grid" id="uaw-shortcuts-grid"></div>
                    </section>
                </div>

                <div class="uaw-agent-drawer" id="uaw-agent-drawer" aria-hidden="true"></div>
                <div class="uaw-toast-region" id="uaw-toast-region" aria-live="polite" aria-atomic="true"></div>
            `;

            document.body.insertBefore(shell, this.legacyHeader);
            this.shell = shell;
        }

        workspaceButton(id, label, shortcut) {
            return `<button class="uaw-rail-button" type="button" data-workspace="${id}" title="${label} (${shortcut})">
                ${this.icon(id)}<span>${label}</span><kbd>${shortcut}</kbd>
            </button>`;
        }

        rehomeLegacyComponents() {
            const host = this.shell.querySelector('#uaw-legacy-host');
            host.appendChild(this.legacyMain);
            this.legacyHeader.classList.add('uaw-legacy-header');

            const playback = this.legacyHeader.querySelector('.playback-controls-group');
            const playbackSlot = this.shell.querySelector('#uaw-playback-commands');
            if (playback && playbackSlot) playbackSlot.appendChild(playback);

            const logo = this.legacyHeader.querySelector('.logo');
            const title = this.legacyHeader.querySelector('h1');
            if (logo) logo.remove();
            if (title) title.remove();

            const smartActions = document.getElementById('smart-actions-dropdown');
            const experimentalAI = document.getElementById('start-llm-btn');
            if (smartActions) smartActions.hidden = true;
            if (experimentalAI) experimentalAI.hidden = true;
        }

        prepareEnvironmentTabs() {
            const labels = {
                timeline: 'Timeline',
                'space-editor': 'Physical',
                'digital-space': 'Digital',
                'display-editor': 'Displays'
            };
            document.querySelectorAll('.simulation-panel .tab-btn').forEach((button) => {
                if (labels[button.dataset.tab]) button.textContent = labels[button.dataset.tab];
                button.addEventListener('click', () => {
                    this.activeCanvas = button.dataset.tab;
                    this.updateInspectorContext();
                    window.dispatchEvent(new CustomEvent('uaw:canvas-changed', {
                        detail: { canvas: this.activeCanvas }
                    }));
                });
            });
            const catalogTab = document.querySelector('.metrics-tab-btn[data-tab="catalog"]');
            const validatorTab = document.querySelector('.metrics-tab-btn[data-tab="validator"]');
            if (catalogTab) catalogTab.textContent = 'Rule catalogue';
            if (validatorTab) validatorTab.textContent = 'Rule logic';
        }

        prepareInspector() {
            const live = this.shell.querySelector('#uaw-inspector-live');
            const panels = [
                ['space-editor', document.querySelector('#space-editor-tab .properties-panel-container')],
                ['digital-space', document.querySelector('#digital-space-tab .properties-panel-container')],
                ['display-editor', document.querySelector('#display-editor-tab .properties-panel-container')]
            ];
            panels.forEach(([view, panel]) => {
                if (!panel) return;
                panel.dataset.inspectorFor = view;
                panel.classList.add('uaw-live-inspector-panel');
                live.appendChild(panel);
            });
            this.updateInspectorContext();
        }

        updateInspectorContext() {
            const title = this.shell.querySelector('#uaw-inspector-title');
            const context = this.shell.querySelector('#uaw-inspector-context');
            if (!title || !context) return;

            const copy = {
                timeline: ['Timeline inspector', 'Select a task, actor or event to inspect it.'],
                'space-editor': ['Physical properties', 'Location, layer and canvas options.'],
                'digital-space': ['Digital properties', 'Storage, objects and connection options.'],
                'display-editor': ['Display properties', 'Display, element and layout options.']
            };
            const [heading, description] = copy[this.activeCanvas] || copy.timeline;
            title.textContent = heading;
            context.innerHTML = `<p>${escapeHTML(description)}</p>`;
            this.shell.querySelectorAll('[data-inspector-for]').forEach((panel) => {
                panel.hidden = panel.dataset.inspectorFor !== this.activeCanvas;
            });
        }

        registerCommand(command) {
            this.commands.set(command.id, command);
        }

        registerCommands() {
            const click = (id) => document.getElementById(id)?.click();
            const workspace = (id) => this.setWorkspace(id);

            [
                { id: 'workspace.projects', label: 'Go to Projects', shortcut: '1', run: () => workspace('projects') },
                { id: 'workspace.build', label: 'Go to Model', shortcut: '2', run: () => workspace('build') },
                { id: 'workspace.run', label: 'Go to Simulate', shortcut: '3', run: () => workspace('run') },
                { id: 'workspace.validate', label: 'Go to Review', shortcut: '4', run: () => workspace('validate') },
                { id: 'workspace.assets', label: 'Go to Assets', shortcut: '5', run: () => workspace('assets') },
                { id: 'workspace.settings', label: 'Go to Settings', shortcut: '6', run: () => workspace('settings') },
                { id: 'workspace.source', label: 'Open Source as a dedicated pane', shortcut: '⌘ `', run: () => workspace('source') },
                { id: 'project.new', label: 'New project', run: () => this.createProject() },
                { id: 'project.templates', label: 'New project from template', run: () => click('simulation-library-btn') },
                { id: 'project.import', label: 'Import WorkSpec', run: () => click('load-simulation-btn') },
                { id: 'project.export', label: 'Export WorkSpec', run: () => click('save-simulation-btn') },
                { id: 'project.checkpoint', label: 'Save local checkpoint', shortcut: '⌘ S', run: () => this.saveCheckpoint() },
                { id: 'edit.undo', label: 'Undo last change', shortcut: '⌘ Z', run: () => click('undo-btn') },
                { id: 'edit.task', label: 'New task', run: () => click('add-task-btn') },
                { id: 'edit.object', label: 'New object', run: () => click('add-object-btn') },
                { id: 'model.process', label: 'Model the process', run: () => this.setModelView('process') },
                { id: 'view.timeline', label: 'Model the process', run: () => this.setModelView('process') },
                { id: 'view.physical', label: 'Model the physical environment', run: () => this.setModelView('physical') },
                { id: 'view.digital', label: 'Model the digital environment', run: () => this.setModelView('digital') },
                { id: 'view.displays', label: 'Model display interfaces', run: () => this.setModelView('displays') },
                { id: 'model.source', label: 'Edit WorkSpec source', run: () => this.setModelView('source') },
                { id: 'model.add-location', label: 'Add physical location', run: () => click('add-location-btn') },
                { id: 'model.add-digital-location', label: 'Add digital location', run: () => click('add-digital-location-btn') },
                { id: 'model.add-digital-object', label: 'Add digital object', run: () => click('add-digital-object-btn') },
                { id: 'model.add-display', label: 'Add display', run: () => click('add-display-btn') },
                { id: 'model.add-display-element', label: 'Add display element', run: () => click('add-display-element-btn') },
                { id: 'source.format', label: 'Format WorkSpec source', run: () => click('format-json-btn') },
                { id: 'view.source-left', label: 'Dock Source on the left', run: () => { this.setSourceDock('split-left'); this.setModelView('process'); } },
                { id: 'view.source-right', label: 'Dock Source on the right', run: () => { this.setSourceDock('split-right'); this.setModelView('process'); } },
                { id: 'view.source-bottom', label: 'Dock Source below the canvas', run: () => { this.setSourceDock('split-bottom'); this.setModelView('process'); } },
                { id: 'view.source-dedicated', label: 'Open Source in a dedicated pane', run: () => { this.setSourceDock('dedicated'); this.setModelView('source'); } },
                { id: 'view.source-hidden', label: 'Hide Source while modelling', run: () => { this.setSourceDock('hidden'); this.setModelView('process'); } },
                { id: 'view.explorer', label: 'Toggle project outline', run: () => this.toggleExplorer() },
                { id: 'view.inspector', label: 'Toggle inspector', run: () => this.toggleInspector() },
                { id: 'run.toggle', label: 'Play or pause simulation', shortcut: 'Space', run: () => click('player-play-pause-btn') },
                { id: 'validate.run', label: 'Validate WorkSpec', shortcut: '⌘ Enter', run: () => window.runManualValidation?.() || window.validateJSON?.() },
                { id: 'review.problems', label: 'Review problems', run: () => this.setReviewView('problems') },
                { id: 'review.rules', label: 'Edit validation rules', run: () => this.setReviewView('rules') },
                { id: 'review.add-rule', label: 'Add validation rule', run: () => click('add-metric-btn') },
                { id: 'review.run-custom', label: 'Run custom validation', run: () => click('run-custom-validation') },
                { id: 'agent.open', label: 'Open Agent', run: () => this.toggleAgent(true) },
                { id: 'help.shortcuts', label: 'Show keyboard shortcuts', shortcut: '?', run: () => this.openShortcuts() }
            ].forEach((command) => this.registerCommand(command));
        }

        bindEvents() {
            this.shell.querySelectorAll('[data-workspace]').forEach((button) => {
                button.addEventListener('click', () => this.setWorkspace(button.dataset.workspace));
            });

            this.shell.querySelector('#uaw-command-trigger')?.addEventListener('click', () => this.openCommandPalette());
            this.shell.querySelector('#uaw-command-search')?.addEventListener('input', (event) => this.renderCommandResults(event.target.value));
            this.shell.querySelector('#uaw-command-search')?.addEventListener('keydown', (event) => this.handleCommandPaletteKey(event));
            this.shell.querySelector('[data-close-palette]')?.addEventListener('click', () => this.closeCommandPalette());
            this.shell.querySelectorAll('[data-close-shortcuts]').forEach((button) => button.addEventListener('click', () => this.closeShortcuts()));
            this.shell.querySelector('#uaw-toggle-inspector')?.addEventListener('click', () => this.toggleInspector());
            this.shell.querySelector('#uaw-close-inspector')?.addEventListener('click', () => this.toggleInspector(false));
            this.shell.querySelector('#uaw-close-explorer')?.addEventListener('click', () => this.toggleExplorer(false));
            this.shell.querySelector('#uaw-agent-button')?.addEventListener('click', () => this.toggleAgent());
            this.shell.querySelector('#uaw-project-title')?.addEventListener('click', () => this.toggleProjectMenu());

            window.addEventListener('uaw:project-opened', (event) => {
                this.updateProjectIdentity(event.detail.project);
                this.renderProjectOutline();
                this.renderProjects();
                this.updateDocumentSummary();
            });
            window.addEventListener('uaw:projects-changed', () => {
                this.renderProjects();
                if (!this.shell.querySelector('#uaw-project-menu')?.hidden) this.renderProjectMenu();
            });
            window.addEventListener('uaw:metrics-ready', () => {
                if (this.workspace === 'validate' && this.reviewView === 'rules') {
                    this.ensureMetricsMode(true);
                    this.layoutEditors();
                }
            });
            window.addEventListener('uaw:playground-ready', () => {
                // Core initialization renders the timeline and initializes the
                // editors. Reassert the product route once those legacy
                // components are actually ready so the selected view and the
                // visible surface can never disagree after a reload.
                this.setWorkspace(this.workspace, { persist: false, animate: false, fromSubview: true });
                if (this.workspace === 'build') this.setModelView(this.modelView, { persist: false, animate: false });
            });
            window.addEventListener('uaw:project-saving', () => this.setSaveState('Saving…', 'working'));
            window.addEventListener('uaw:project-saved', () => {
                this.setSaveState('Saved locally', 'saved');
                this.updateDocumentSummary();
            });
            window.addEventListener('uaw:editor-ready', (event) => {
                event.detail.editor.onDidChangeModelContent(() => this.updateDocumentSummary());
                this.updateDocumentSummary();
            });

            const validationCounts = ['error-metrics-count', 'warning-metrics-count', 'suggestion-metrics-count']
                .map((id) => document.getElementById(id))
                .filter(Boolean);
            const validationObserver = new MutationObserver(() => this.updateProblemCount());
            validationCounts.forEach((element) => validationObserver.observe(element, { childList: true, characterData: true, subtree: true }));

            document.getElementById('json-status')?.addEventListener('click', () => this.setWorkspace('validate'));
            document.querySelector('.validation-header')?.addEventListener('click', (event) => {
                if (this.workspace !== 'build' || event.target.closest('button, input, select, textarea, a')) return;
                this.toggleProblems();
            });
            document.addEventListener('keydown', (event) => this.handleShortcut(event), true);
            document.addEventListener('click', (event) => {
                const action = event.target.closest('[data-uaw-command]');
                if (action) this.runCommand(action.dataset.uawCommand);
                if (!event.target.closest('#uaw-project-menu, #uaw-project-title')) this.toggleProjectMenu(false);
            });
        }

        applySettings() {
            this.setSourceDock(this.settings.sourceDock, { persist: false, navigate: false });
            this.toggleExplorer(this.settings.explorerOpen, { persist: false });
            this.toggleInspector(this.settings.inspectorOpen, { persist: false });
            document.body.classList.toggle('uaw-problems-open', Boolean(this.settings.problemsOpen));
            document.body.dataset.modelView = this.modelView;
            document.body.dataset.reviewView = this.reviewView;
        }

        commandButton(command, label, options = {}) {
            return `<button type="button" class="uaw-product-command ${options.primary ? 'primary' : ''} ${options.active ? 'active' : ''}" data-uaw-command="${command}" ${options.pressed !== undefined ? `aria-pressed="${options.pressed}"` : ''}>${escapeHTML(label)}</button>`;
        }

        renderCommandbar() {
            const primary = this.shell?.querySelector('#uaw-primary-commands');
            const context = this.shell?.querySelector('#uaw-context-commands');
            const playback = this.shell?.querySelector('#uaw-playback-commands');
            if (!primary || !context || !playback) return;

            primary.innerHTML = '';
            context.innerHTML = '';
            playback.hidden = this.workspace !== 'run';

            if (this.workspace === 'projects') {
                primary.innerHTML = this.commandButton('project.new', 'New blank', { primary: true })
                    + this.commandButton('project.templates', 'New from template…')
                    + this.commandButton('project.import', 'Import WorkSpec…');
                return;
            }

            if (this.workspace === 'build' || this.workspace === 'source') {
                const views = [
                    ['process', 'Process', 'model.process'],
                    ['physical', 'Physical', 'view.physical'],
                    ['digital', 'Digital', 'view.digital'],
                    ['displays', 'Displays', 'view.displays'],
                    ['source', 'Source', 'model.source']
                ];
                primary.innerHTML = `<div class="uaw-segmented" role="tablist" aria-label="Model views">${views.map(([id, label, command]) => this.commandButton(command, label, { active: this.modelView === id, pressed: this.modelView === id })).join('')}</div>`;
                const actions = {
                    process: this.commandButton('edit.task', 'New task', { primary: true }) + this.commandButton('edit.object', 'New object'),
                    physical: this.commandButton('model.add-location', 'New location', { primary: true }),
                    digital: this.commandButton('model.add-digital-location', 'New location', { primary: true }) + this.commandButton('model.add-digital-object', 'New object'),
                    displays: this.commandButton('model.add-display', 'New display', { primary: true }) + this.commandButton('model.add-display-element', 'New element'),
                    source: this.commandButton('source.format', 'Format') + this.commandButton('edit.undo', 'Undo')
                };
                context.innerHTML = `<div class="uaw-context-actions">${actions[this.modelView] || ''}</div>${this.commandButton('project.export', 'Export…')}`;
                return;
            }

            if (this.workspace === 'run') {
                primary.innerHTML = '<span class="uaw-mode-label">Timeline simulation</span>';
                context.innerHTML = this.commandButton('review.problems', 'Review results');
                return;
            }

            if (this.workspace === 'validate') {
                primary.innerHTML = `<div class="uaw-segmented" role="tablist" aria-label="Review views">${this.commandButton('review.problems', 'Problems', { active: this.reviewView === 'problems', pressed: this.reviewView === 'problems' })}${this.commandButton('review.rules', 'Rules', { active: this.reviewView === 'rules', pressed: this.reviewView === 'rules' })}</div>`;
                context.innerHTML = this.reviewView === 'rules'
                    ? this.commandButton('review.add-rule', 'New rule', { primary: true }) + this.commandButton('review.run-custom', 'Run rules')
                    : this.commandButton('validate.run', 'Run validation', { primary: true });
                return;
            }

            if (this.workspace === 'assets') {
                primary.innerHTML = this.commandButton('project.import', 'Import WorkSpec…');
            }
        }

        ensureMetricsMode(active) {
            const top = document.querySelector('.playground-top');
            const toggle = document.getElementById('metrics-mode-toggle');
            if (!top || !toggle || toggle.dataset.metricsReady !== 'true') return;
            if (top.classList.contains('metrics-mode') !== active) toggle.click();
        }

        setModelView(view, options = {}) {
            const allowed = ['process', 'physical', 'digital', 'displays', 'source'];
            if (!allowed.includes(view)) view = 'process';
            this.modelView = view;
            this.settings.modelView = view;
            document.body.dataset.modelView = view;
            if (options.persist !== false) this.saveSettings();

            if (view === 'source') {
                this.setWorkspace('source', { ...options, fromSubview: true });
                return;
            }

            const tabs = {
                process: 'timeline',
                physical: 'space-editor',
                digital: 'digital-space',
                displays: 'display-editor'
            };
            this.setWorkspace('build', { ...options, fromSubview: true });
            document.querySelector(`.simulation-panel .tab-btn[data-tab="${tabs[view]}"]`)?.click();
            this.renderCommandbar();
        }

        setReviewView(view, options = {}) {
            this.reviewView = view === 'rules' ? 'rules' : 'problems';
            this.settings.reviewView = this.reviewView;
            document.body.dataset.reviewView = this.reviewView;
            if (options.persist !== false) this.saveSettings();
            this.setWorkspace('validate', { ...options, fromSubview: true });
        }

        setWorkspace(workspace, options = {}) {
            if (!WORKSPACE_META[workspace]) workspace = 'build';
            if (workspace === 'build' && !options.fromSubview && this.modelView === 'source') workspace = 'source';
            this.workspace = workspace;
            document.body.dataset.uawWorkspace = workspace;
            this.shell.querySelectorAll('.uaw-rail-button').forEach((button) => {
                const selected = button.dataset.workspace === workspace || (workspace === 'source' && button.dataset.workspace === 'build');
                button.classList.toggle('active', selected);
                button.setAttribute('aria-current', selected ? 'page' : 'false');
            });

            const meta = WORKSPACE_META[workspace];
            this.shell.querySelector('#uaw-workspace-title').textContent = meta.title;
            this.shell.querySelector('#uaw-workspace-description').textContent = meta.description;

            if (workspace === 'projects') this.renderProjects();
            if (workspace === 'build' && this.modelView === 'process') this.renderProcessModel();
            if (workspace === 'assets') this.renderAssets();
            if (workspace === 'settings') this.renderSettings();
            if (workspace === 'run') {
                this.ensureMetricsMode(false);
                document.querySelector('.simulation-panel .tab-btn[data-tab="timeline"]')?.click();
            }
            if (workspace === 'build' || workspace === 'source' || workspace === 'projects' || workspace === 'assets' || workspace === 'settings') {
                this.ensureMetricsMode(false);
            }
            if (workspace === 'build' && !options.fromSubview) {
                const tabs = { process: 'timeline', physical: 'space-editor', digital: 'digital-space', displays: 'display-editor' };
                document.querySelector(`.simulation-panel .tab-btn[data-tab="${tabs[this.modelView] || 'timeline'}"]`)?.click();
            }
            if (workspace === 'validate') {
                this.ensureMetricsMode(this.reviewView === 'rules');
                if (this.reviewView === 'rules') requestAnimationFrame(() => this.ensureMetricsMode(true));
            }

            this.renderCommandbar();

            if (options.persist !== false) {
                this.settings.lastWorkspace = workspace;
                this.saveSettings();
            }
            if (options.animate !== false) window.UAWMotion?.workspaceChange?.();
            this.layoutEditors();
            window.dispatchEvent(new CustomEvent('uaw:workspace-changed', { detail: { workspace } }));
        }

        layoutEditors() {
            const layout = () => {
                window.monacoEditor?.layout?.();
                window.metricsJsonEditor?.layout?.();
                window.metricsCatalogEditor?.layout?.();
                window.metricsValidatorEditor?.layout?.();
            };
            requestAnimationFrame(() => {
                layout();
                requestAnimationFrame(layout);
            });
            // Monaco editors created while their view is hidden need a layout
            // after the workspace transition has established final dimensions.
            clearTimeout(this.editorLayoutTimer);
            this.editorLayoutTimer = setTimeout(layout, 180);
        }

        setSourceDock(mode, options = {}) {
            const allowed = ['split-left', 'split-right', 'split-bottom', 'dedicated', 'hidden'];
            if (!allowed.includes(mode)) mode = 'split-left';
            this.settings.sourceDock = mode;
            document.body.dataset.sourceDock = mode;
            if (options.persist !== false) this.saveSettings();
            this.syncSourceDockInputs();
            this.layoutEditors();
        }

        toggleExplorer(force, options = {}) {
            const open = typeof force === 'boolean' ? force : !document.body.classList.contains('uaw-explorer-open');
            document.body.classList.toggle('uaw-explorer-open', open);
            this.settings.explorerOpen = open;
            if (options.persist !== false) this.saveSettings();
            window.UAWMotion?.panelChange?.('#uaw-explorer', open);
            this.layoutEditors();
        }

        toggleInspector(force, options = {}) {
            const open = typeof force === 'boolean' ? force : !document.body.classList.contains('uaw-inspector-open');
            document.body.classList.toggle('uaw-inspector-open', open);
            this.settings.inspectorOpen = open;
            if (options.persist !== false) this.saveSettings();
            window.UAWMotion?.panelChange?.('#uaw-inspector', open);
            this.layoutEditors();
        }

        toggleAgent(force) {
            const drawer = this.shell.querySelector('#uaw-agent-drawer');
            const open = typeof force === 'boolean' ? force : !document.body.classList.contains('uaw-agent-open');
            document.body.classList.toggle('uaw-agent-open', open);
            drawer?.setAttribute('aria-hidden', String(!open));
            window.UAWMotion?.panelChange?.('#uaw-agent-drawer', open);
            if (open) window.dispatchEvent(new CustomEvent('uaw:agent-opened'));
        }

        renderProjectOutline() {
            const container = this.shell?.querySelector('#uaw-project-outline');
            if (!container) return;
            const summary = this.readDocumentSummary();
            container.innerHTML = `
                <div class="uaw-tree-section">
                    <button class="uaw-tree-section__title" type="button"><span>WORKSPEC</span><span>${summary.tasks + summary.objects}</span></button>
                    <button class="uaw-tree-item" type="button" data-uaw-command="model.source">${this.icon('source')}<span>Source</span><small>v${escapeHTML(summary.version)}</small></button>
                    <button class="uaw-tree-item" type="button" data-uaw-command="model.process"><span class="uaw-tree-dot uaw-tree-dot--task"></span><span>Tasks</span><small>${summary.tasks}</small></button>
                    <button class="uaw-tree-item" type="button" data-uaw-command="model.process"><span class="uaw-tree-dot uaw-tree-dot--object"></span><span>Objects</span><small>${summary.objects}</small></button>
                </div>
                <div class="uaw-tree-section">
                    <button class="uaw-tree-section__title" type="button"><span>ENVIRONMENT</span></button>
                    <button class="uaw-tree-item" type="button" data-uaw-command="view.physical"><span class="uaw-tree-dot"></span><span>Physical</span><small>${summary.locations}</small></button>
                    <button class="uaw-tree-item" type="button" data-uaw-command="view.digital"><span class="uaw-tree-dot"></span><span>Digital</span><small>${summary.digitalLocations}</small></button>
                    <button class="uaw-tree-item" type="button" data-uaw-command="view.displays"><span class="uaw-tree-dot"></span><span>Displays</span><small>${summary.displays}</small></button>
                </div>
                <div class="uaw-tree-section">
                    <button class="uaw-tree-section__title" type="button"><span>QUALITY</span></button>
                    <button class="uaw-tree-item" type="button" data-uaw-command="review.problems">${this.icon('validate')}<span>Problems</span><small id="uaw-outline-problem-count">—</small></button>
                    <button class="uaw-tree-item" type="button" data-uaw-command="review.rules"><span class="uaw-tree-dot"></span><span>Rules</span></button>
                </div>
            `;
            this.updateProblemCount();
        }

        updateProblemCount() {
            const outlineCount = this.shell?.querySelector('#uaw-outline-problem-count');
            if (!outlineCount) return;
            const read = (id) => Number.parseInt(document.getElementById(id)?.textContent || '0', 10) || 0;
            const errors = read('error-metrics-count');
            const warnings = read('warning-metrics-count');
            const suggestions = read('suggestion-metrics-count');
            const total = errors + warnings + suggestions;
            outlineCount.textContent = String(total);
            outlineCount.dataset.severity = errors ? 'error' : warnings ? 'warning' : suggestions ? 'suggestion' : 'clear';
            outlineCount.title = `${errors} errors, ${warnings} warnings, ${suggestions} suggestions`;
        }

        readDocumentSummary() {
            const value = window.monacoEditor?.getValue?.() || window.editor?.getValue?.() || '';
            try {
                const root = JSON.parse(value);
                const simulation = root.simulation || root;
                const dayTypes = Object.values(simulation.day_types || {});
                const uniqueAcrossDayTypes = (key) => {
                    const items = dayTypes.flatMap(dayType => dayType?.[key] || []);
                    return new Set(items.map((item, index) => item?.id || `${key}-${index}-${JSON.stringify(item)}`)).size;
                };
                const canonicalObjects = simulation.world?.objects;
                const legacyObjectArrays = ['actors', 'resources', 'equipment', 'objects', 'tools', 'products'];
                const objects = Array.isArray(canonicalObjects) && canonicalObjects.length
                    ? canonicalObjects.length
                    : dayTypes.length
                        ? uniqueAcrossDayTypes('objects')
                    : legacyObjectArrays.reduce((total, key) => total + (Array.isArray(simulation[key]) ? simulation[key].length : 0), 0);
                const tasks = simulation.process?.tasks || simulation.tasks;
                return {
                    valid: true,
                    version: simulation.schema_version || root.workspec_version || root.version || '2.0',
                    tasks: Array.isArray(tasks) && tasks.length ? tasks.length : uniqueAcrossDayTypes('tasks'),
                    objects,
                    locations: simulation.world?.layout?.locations?.length || simulation.locations?.length || uniqueAcrossDayTypes('locations'),
                    digitalLocations: simulation.digital_space?.digital_locations?.length || 0,
                    displays: simulation.displays?.length || simulation.world?.displays?.length || 0,
                    assets: root.assets ? Object.keys(root.assets).length : 0
                };
            } catch (_error) {
                return { valid: false, version: '—', tasks: 0, objects: 0, locations: 0, digitalLocations: 0, displays: 0, assets: 0 };
            }
        }

        updateDocumentSummary() {
            clearTimeout(this.summaryTimer);
            this.summaryTimer = setTimeout(() => {
                this.renderProjectOutline();
                if (this.workspace === 'build' && this.modelView === 'process') this.renderProcessModel();
                if (this.workspace === 'assets') this.renderAssets();
            }, 250);
        }

        readProcessDocument() {
            try {
                const root = JSON.parse(window.monacoEditor?.getValue?.() || window.editor?.getValue?.() || '{}');
                const simulation = root.simulation || root;
                const canonicalTasks = simulation.process?.tasks || simulation.tasks || [];
                const periodTasks = Object.entries(simulation.day_types || {}).flatMap(([period, value]) =>
                    (value?.tasks || []).map(task => ({ ...task, __period: period }))
                );
                const tasks = canonicalTasks.length ? canonicalTasks : periodTasks;
                const canonicalObjects = simulation.world?.objects || [];
                const legacyObjects = ['actors', 'resources', 'equipment', 'objects', 'tools', 'products']
                    .flatMap(key => Array.isArray(simulation[key]) ? simulation[key] : []);
                const periodObjects = Object.entries(simulation.day_types || {}).flatMap(([period, value]) =>
                    (value?.objects || []).map(object => ({ ...object, __period: period }))
                );
                const objectList = canonicalObjects.length ? canonicalObjects : legacyObjects.length ? legacyObjects : periodObjects;
                const objects = [...new Map(objectList.map((object, index) => [object?.id || `object-${index}`, object])).values()];
                return { root, simulation, tasks, objects };
            } catch (_error) {
                return null;
            }
        }

        renderProcessModel() {
            const view = this.shell?.querySelector('#uaw-process-view');
            if (!view) return;
            const documentModel = this.readProcessDocument();
            if (!documentModel) {
                view.innerHTML = `<div class="uaw-process-empty"><strong>The WorkSpec source is not valid JSON.</strong><p>Repair it in Source, then return here to continue modelling.</p><button type="button" data-uaw-command="model.source">Open Source</button></div>`;
                return;
            }

            const { simulation, tasks, objects } = documentModel;
            this.processTasksCache = tasks;
            const title = simulation.meta?.title || this.projectStore?.getCurrent()?.name || 'Untitled process';
            const description = simulation.meta?.description || 'No process description has been written yet.';
            const actors = objects.filter(object => object?.type === 'actor');
            const objectById = new Map(objects.map(object => [object.id, object]));
            const rows = tasks.map((task, index) => {
                const actor = objectById.get(task.actor_id);
                const dependencies = Array.isArray(task.depends_on) ? task.depends_on.join(', ') : '—';
                const period = task.__period ? `<span class="uaw-process-period">${escapeHTML(task.__period)}</span>` : '';
                return `<tr>
                    <td><div class="uaw-process-task-name"><strong>${escapeHTML(task.name || task.id || `Task ${index + 1}`)}</strong><code>${escapeHTML(task.id || 'No ID')}</code>${period}</div></td>
                    <td>${escapeHTML(actor?.name || task.actor_id || 'Unassigned')}</td>
                    <td><span class="uaw-process-time">${escapeHTML(task.start || task.start_time || '—')}</span></td>
                    <td>${escapeHTML(task.duration ?? '—')} ${task.duration != null ? escapeHTML(simulation.config?.time_unit || 'min') : ''}</td>
                    <td>${escapeHTML(task.location || task.location_id || '—')}</td>
                    <td class="uaw-process-dependencies">${escapeHTML(dependencies)}</td>
                    <td><button class="uaw-row-action" type="button" data-edit-process-task="${index}">${task.__period ? 'View source' : 'Edit'}</button></td>
                </tr>`;
            }).join('');

            view.innerHTML = `
                <header class="uaw-process-heading">
                    <div><p class="uaw-eyebrow">PROCESS DEFINITION</p><h1>${escapeHTML(title)}</h1><p>${escapeHTML(description)}</p></div>
                    <dl><div><dt>Tasks</dt><dd>${tasks.length}</dd></div><div><dt>Actors</dt><dd>${actors.length}</dd></div><div><dt>Objects</dt><dd>${objects.length}</dd></div></dl>
                </header>
                <section class="uaw-process-register" aria-labelledby="uaw-task-register-heading">
                    <div class="uaw-process-section-heading"><div><h2 id="uaw-task-register-heading">Task register</h2><p>The authored sequence, assignments and dependencies. Run it from Simulate.</p></div><button type="button" data-uaw-command="edit.task">New task</button></div>
                    ${rows ? `<div class="uaw-process-table-wrap"><table class="uaw-process-table"><thead><tr><th>Task</th><th>Actor</th><th>Start</th><th>Duration</th><th>Location</th><th>Depends on</th><th><span class="sr-only">Actions</span></th></tr></thead><tbody>${rows}</tbody></table></div>` : `<div class="uaw-process-empty"><strong>No tasks yet</strong><p>Add the first task to establish this process.</p><button type="button" data-uaw-command="edit.task">Create first task</button></div>`}
                </section>
            `;

            view.querySelectorAll('[data-edit-process-task]').forEach(button => button.addEventListener('click', () => {
                const task = this.processTasksCache?.[Number(button.dataset.editProcessTask)];
                if (!task) return;
                if (task.__period || typeof window.openEditTaskModal !== 'function') {
                    this.setModelView('source');
                    window.UAWPlaygroundShell?.toast?.('This task belongs to a day type; edit it in Source.');
                    return;
                }
                window.openEditTaskModal(task);
            }));
            window.UAWMotion?.listEnter?.('.uaw-process-table tbody tr');
        }

        async toggleProjectMenu(force) {
            const menu = this.shell?.querySelector('#uaw-project-menu');
            const trigger = this.shell?.querySelector('#uaw-project-title');
            if (!menu || !trigger) return;
            const open = typeof force === 'boolean' ? force : menu.hidden;
            menu.hidden = !open;
            trigger.setAttribute('aria-expanded', String(open));
            if (open) {
                await this.renderProjectMenu();
                window.UAWMotion?.dialogEnter?.('#uaw-project-menu');
                requestAnimationFrame(() => menu.querySelector('[role="menuitem"], button')?.focus());
            }
        }

        async renderProjectMenu() {
            const menu = this.shell?.querySelector('#uaw-project-menu');
            if (!menu || !this.projectStore) return;
            const current = this.projectStore.getCurrent();
            const projects = await this.projectStore.list();
            menu.innerHTML = `
                <div class="uaw-project-menu__heading">Switch project</div>
                <div class="uaw-project-menu__list">
                    ${projects.map(project => `<button type="button" role="menuitem" data-switch-project="${escapeHTML(project.id)}" class="${project.id === current?.id ? 'active' : ''}"><span class="uaw-project-menu__mark">WS</span><span><strong>${escapeHTML(project.name)}</strong><small>${project.id === current?.id ? 'Current project' : 'Open project'}</small></span>${project.id === current?.id ? '<span class="uaw-project-menu__check">✓</span>' : ''}</button>`).join('')}
                </div>
                <div class="uaw-project-menu__actions">
                    <button type="button" data-project-menu-action="new">New blank project</button>
                    <button type="button" data-project-menu-action="template">New from template…</button>
                    <button type="button" data-project-menu-action="rename">Rename current project</button>
                </div>
            `;
            menu.querySelectorAll('[data-switch-project]').forEach(button => button.addEventListener('click', async () => {
                await this.projectStore.open(button.dataset.switchProject);
                this.toggleProjectMenu(false);
                this.setWorkspace('build');
            }));
            menu.querySelector('[data-project-menu-action="new"]')?.addEventListener('click', async () => {
                this.toggleProjectMenu(false);
                await this.createProject();
            });
            menu.querySelector('[data-project-menu-action="template"]')?.addEventListener('click', () => {
                this.toggleProjectMenu(false);
                document.getElementById('simulation-library-btn')?.click();
            });
            menu.querySelector('[data-project-menu-action="rename"]')?.addEventListener('click', () => {
                this.toggleProjectMenu(false);
                this.renameCurrentProject();
            });
        }

        async renderProjects() {
            const view = this.shell?.querySelector('#uaw-projects-view');
            if (!view || !this.projectStore) return;
            const token = ++this.projectRenderToken;
            const projects = await this.projectStore.list();
            if (token !== this.projectRenderToken) return;

            const cards = projects.map((project) => {
                const isCurrent = project.id === this.projectStore.getCurrent()?.id;
                const date = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(project.updatedAt));
                return `<article class="uaw-project-card ${isCurrent ? 'active' : ''}" data-project-id="${escapeHTML(project.id)}">
                    <button class="uaw-project-card__open" type="button" data-open-project="${escapeHTML(project.id)}">
                        <span class="uaw-project-card__mark">WS</span>
                        <span class="uaw-project-card__body"><strong>${escapeHTML(project.name)}</strong><small>Updated ${escapeHTML(date)}</small></span>
                        <span class="uaw-project-card__status">${isCurrent ? 'Open' : ''}</span>
                    </button>
                    <div class="uaw-project-card__actions">
                        <button type="button" data-duplicate-project="${escapeHTML(project.id)}">Duplicate</button>
                        <button type="button" data-archive-project="${escapeHTML(project.id)}">Archive</button>
                    </div>
                </article>`;
            }).join('');

            view.innerHTML = `
                <div class="uaw-view-heading">
                    <div><p class="uaw-eyebrow">LOCAL WORKSPACE</p><h1>Projects</h1><p>Build, validate and run WorkSpec automations. Everything stays in this browser.</p></div>
                    <button class="btn-primary" type="button" data-uaw-command="project.new">New project</button>
                </div>
                ${!this.settings.onboardingDismissed ? this.onboardingMarkup() : ''}
                <div class="uaw-project-actions">
                    <button type="button" data-uaw-command="project.templates"><strong>Start from a template</strong><span>Open a working process and adapt it.</span></button>
                    <button type="button" data-uaw-command="project.import"><strong>Import WorkSpec</strong><span>Open a file or an existing save code.</span></button>
                    <button type="button" data-uaw-command="agent.open"><strong>Draft with Agent</strong><span>Connect Codex and describe the process.</span></button>
                </div>
                <div class="uaw-section-heading"><h2>Recent projects</h2><span>${projects.length}</span></div>
                <div class="uaw-project-grid">${cards || '<div class="uaw-empty-state"><strong>No projects yet</strong><p>Create a project or import a WorkSpec to begin.</p></div>'}</div>
            `;

            view.querySelectorAll('[data-open-project]').forEach((button) => button.addEventListener('click', async () => {
                await this.projectStore.open(button.dataset.openProject);
                this.setWorkspace('build');
            }));
            view.querySelectorAll('[data-duplicate-project]').forEach((button) => button.addEventListener('click', () => this.projectStore.duplicate(button.dataset.duplicateProject)));
            view.querySelectorAll('[data-archive-project]').forEach((button) => button.addEventListener('click', async () => {
                await this.projectStore.archive(button.dataset.archiveProject);
                this.toast('Project archived');
            }));
            view.querySelector('[data-dismiss-onboarding]')?.addEventListener('click', () => {
                this.settings.onboardingDismissed = true;
                this.saveSettings();
                this.renderProjects();
            });
            window.UAWMotion?.listEnter?.('.uaw-project-card');
        }

        onboardingMarkup() {
            return `<section class="uaw-onboarding">
                <div><p class="uaw-eyebrow">FIRST USE</p><h2>From definition to a verified run</h2></div>
                <ol><li class="done"><span>1</span>Open a project</li><li><span>2</span>Define tasks and objects</li><li><span>3</span>Run and resolve problems</li></ol>
                <button class="uaw-icon-button" type="button" data-dismiss-onboarding title="Dismiss">${this.icon('close')}</button>
            </section>`;
        }

        renderAssets() {
            const view = this.shell?.querySelector('#uaw-assets-view');
            if (!view) return;
            const value = window.monacoEditor?.getValue?.() || '';
            let assets = [];
            try {
                const parsed = JSON.parse(value);
                assets = Object.entries(parsed.assets || {});
            } catch (_error) {
                // Invalid source is represented by the empty/error state below.
            }
            view.innerHTML = `
                <div class="uaw-view-heading"><div><p class="uaw-eyebrow">PROJECT CONTENT</p><h1>Assets</h1><p>Embedded images, audio and files referenced by this WorkSpec.</p></div></div>
                <div class="uaw-asset-grid">${assets.map(([id, data]) => {
                    const kind = String(data).startsWith('data:image') ? 'Image' : String(data).startsWith('data:audio') ? 'Audio' : 'File';
                    return `<article class="uaw-asset-card"><div class="uaw-asset-preview">${kind === 'Image' ? `<img src="${escapeHTML(data)}" alt="" />` : this.icon('assets')}</div><strong>${escapeHTML(id)}</strong><span>${kind}</span></article>`;
                }).join('') || '<div class="uaw-empty-state"><strong>No embedded assets</strong><p>Add media from the Display editor or import a WorkSpec containing assets.</p></div>'}</div>
            `;
            window.UAWMotion?.listEnter?.('.uaw-asset-card');
        }

        renderSettings() {
            const view = this.shell?.querySelector('#uaw-settings-view');
            if (!view) return;
            view.innerHTML = `
                <div class="uaw-view-heading"><div><p class="uaw-eyebrow">PLAYGROUND</p><h1>Settings</h1><p>Preferences are stored locally in this browser.</p></div></div>
                <div class="uaw-settings-layout">
                    <section class="uaw-settings-section">
                        <div><h2>Source layout</h2><p>Choose where the WorkSpec source appears while modelling. Source also remains available as its own Model view.</p></div>
                        <fieldset class="uaw-choice-grid" id="uaw-source-dock-choices">
                            ${this.sourceChoice('split-left', 'Split left', 'Source beside the canvas')}
                            ${this.sourceChoice('split-right', 'Split right', 'Canvas before Source')}
                            ${this.sourceChoice('split-bottom', 'Split below', 'Source below the canvas')}
                            ${this.sourceChoice('dedicated', 'Dedicated pane', 'Source uses the full stage')}
                            ${this.sourceChoice('hidden', 'Hidden in Model', 'Open Source only when needed')}
                        </fieldset>
                    </section>
                    <section class="uaw-settings-section">
                        <div><h2>Workspace panes</h2><p>These choices are remembered between sessions.</p></div>
                        <label class="uaw-switch-row"><span><strong>Project outline</strong><small>Show the document and environment tree.</small></span><input type="checkbox" id="uaw-setting-explorer" ${this.settings.explorerOpen ? 'checked' : ''}></label>
                        <label class="uaw-switch-row"><span><strong>Inspector</strong><small>Show contextual properties on the right.</small></span><input type="checkbox" id="uaw-setting-inspector" ${this.settings.inspectorOpen ? 'checked' : ''}></label>
                    </section>
                    <section class="uaw-settings-section">
                        <div><h2>Codex Agent</h2><p>The optional agent connects to a local bridge. The static Playground remains fully usable without it.</p></div>
                        <div class="uaw-connection-card"><span class="uaw-connection-indicator"></span><div><strong id="uaw-settings-agent-state">Checking local bridge…</strong><small>Default: http://127.0.0.1:4317</small></div><button type="button" data-uaw-command="agent.open">Configure</button></div>
                    </section>
                </div>
            `;
            view.querySelectorAll('input[name="source-dock"]').forEach((input) => input.addEventListener('change', () => this.setSourceDock(input.value)));
            view.querySelector('#uaw-setting-explorer')?.addEventListener('change', (event) => this.toggleExplorer(event.target.checked));
            view.querySelector('#uaw-setting-inspector')?.addEventListener('change', (event) => this.toggleInspector(event.target.checked));
            this.syncSourceDockInputs();
            window.dispatchEvent(new CustomEvent('uaw:settings-rendered'));
        }

        sourceChoice(value, title, description) {
            return `<label class="uaw-choice"><input type="radio" name="source-dock" value="${value}" ${this.settings.sourceDock === value ? 'checked' : ''}><span><strong>${title}</strong><small>${description}</small></span></label>`;
        }

        syncSourceDockInputs() {
            this.shell?.querySelectorAll('input[name="source-dock"]').forEach((input) => {
                input.checked = input.value === this.settings.sourceDock;
            });
        }

        updateProjectIdentity(project) {
            const name = this.shell?.querySelector('#uaw-project-name');
            if (name && project) name.textContent = project.name;
        }

        setSaveState(label, state) {
            const element = this.shell?.querySelector('#uaw-save-state');
            if (!element) return;
            element.textContent = label;
            element.dataset.state = state;
            if (state === 'saved') window.UAWMotion?.saved?.(element);
        }

        async createProject() {
            const project = await this.projectStore?.createBlank();
            if (project) {
                this.setWorkspace('build');
                this.renameCurrentProject();
            }
        }

        async renameCurrentProject() {
            const current = this.projectStore?.getCurrent();
            if (!current) return;
            const input = document.createElement('input');
            input.className = 'uaw-inline-project-name';
            input.value = current.name;
            input.setAttribute('aria-label', 'Project name');
            const button = this.shell.querySelector('#uaw-project-title');
            button.hidden = true;
            button.parentNode.insertBefore(input, button.nextSibling);
            input.focus();
            input.select();
            const commit = async () => {
                if (!input.isConnected) return;
                await this.projectStore.rename(current.id, input.value);
                input.remove();
                button.hidden = false;
            };
            input.addEventListener('blur', commit, { once: true });
            input.addEventListener('keydown', (event) => {
                if (event.key === 'Enter') input.blur();
                if (event.key === 'Escape') {
                    input.value = current.name;
                    input.blur();
                }
            });
        }

        async saveCheckpoint() {
            await this.projectStore?.saveCurrent();
            await this.projectStore?.createCheckpoint('Manual checkpoint');
            this.toast('Checkpoint saved locally', {
                action: 'Export',
                onAction: () => document.getElementById('save-simulation-btn')?.click()
            });
        }

        openCommandPalette(query = '') {
            const palette = this.shell.querySelector('#uaw-command-palette');
            palette.hidden = false;
            const input = this.shell.querySelector('#uaw-command-search');
            input.value = query;
            this.renderCommandResults(query);
            requestAnimationFrame(() => {
                input.focus();
                window.UAWMotion?.dialogEnter?.('.uaw-command-palette__dialog');
            });
        }

        closeCommandPalette() {
            const palette = this.shell.querySelector('#uaw-command-palette');
            if (!palette || palette.hidden) return;
            palette.hidden = true;
            this.shell.querySelector('#uaw-command-trigger')?.focus();
        }

        handleCommandPaletteKey(event) {
            const results = Array.from(this.shell.querySelectorAll('#uaw-command-results [data-command-id]'));
            if (!results.length) return;
            const current = Math.max(0, results.findIndex((button) => button.classList.contains('active')));
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                event.preventDefault();
                const delta = event.key === 'ArrowDown' ? 1 : -1;
                const next = (current + delta + results.length) % results.length;
                results.forEach((button, index) => button.classList.toggle('active', index === next));
                results[next].scrollIntoView({ block: 'nearest' });
                return;
            }
            if (event.key === 'Enter') {
                event.preventDefault();
                const active = results[current];
                this.closeCommandPalette();
                this.runCommand(active.dataset.commandId);
            }
        }

        renderCommandResults(query = '') {
            const results = this.shell.querySelector('#uaw-command-results');
            const normalized = query.trim().toLowerCase();
            const commands = Array.from(this.commands.values())
                .filter((command) => !normalized || command.label.toLowerCase().includes(normalized) || command.id.includes(normalized))
                .slice(0, 12);
            results.innerHTML = commands.map((command, index) => `<button type="button" class="uaw-command-result ${index === 0 ? 'active' : ''}" data-command-id="${escapeHTML(command.id)}" role="option"><span>${escapeHTML(command.label)}</span>${command.shortcut ? `<kbd>${escapeHTML(command.shortcut)}</kbd>` : ''}</button>`).join('') || '<div class="uaw-empty-command">No matching command</div>';
            results.querySelectorAll('[data-command-id]').forEach((button) => button.addEventListener('click', () => {
                this.closeCommandPalette();
                this.runCommand(button.dataset.commandId);
            }));
        }

        runCommand(id) {
            const command = this.commands.get(id);
            if (!command || command.enabled?.() === false) return false;
            command.run();
            return true;
        }

        toggleProblems(force) {
            const open = force ?? !document.body.classList.contains('uaw-problems-open');
            document.body.classList.toggle('uaw-problems-open', open);
            this.settings.problemsOpen = open;
            this.saveSettings();
            window.UAWMotion?.panelToggle?.('.playground-bottom', open);
        }

        openShortcuts() {
            const dialog = this.shell.querySelector('#uaw-shortcuts-dialog');
            const grid = this.shell.querySelector('#uaw-shortcuts-grid');
            grid.innerHTML = Array.from(this.commands.values()).filter((command) => command.shortcut).map((command) => `<div><span>${escapeHTML(command.label)}</span><kbd>${escapeHTML(command.shortcut)}</kbd></div>`).join('');
            dialog.hidden = false;
            window.UAWMotion?.dialogEnter?.('.uaw-shortcuts-card');
        }

        closeShortcuts() {
            this.shell.querySelector('#uaw-shortcuts-dialog').hidden = true;
        }

        handleShortcut(event) {
            const target = event.target;
            const typing = target.matches?.('input, textarea, select') || target.closest?.('.monaco-editor, [contenteditable="true"]');
            const modifier = event.metaKey || event.ctrlKey;

            if (modifier && event.key.toLowerCase() === 'k') {
                event.preventDefault();
                this.openCommandPalette();
                return;
            }
            if (modifier && event.key.toLowerCase() === 'p') {
                event.preventDefault();
                this.openCommandPalette();
                return;
            }
            if (event.key === 'Escape') {
                this.toggleProjectMenu(false);
                this.closeCommandPalette();
                this.closeShortcuts();
                return;
            }
            if (typing) return;

            if (modifier && event.key.toLowerCase() === 's') {
                event.preventDefault();
                this.saveCheckpoint();
                return;
            }
            if (modifier && event.key === '`') {
                event.preventDefault();
                this.setWorkspace('source');
                return;
            }
            if (modifier && event.key === 'Enter') {
                event.preventDefault();
                if (this.workspace === 'run') this.runCommand('run.toggle');
                else this.runCommand('validate.run');
                return;
            }
            if (/^[1-6]$/.test(event.key) && !event.altKey && !modifier) {
                const ids = ['projects', 'build', 'run', 'validate', 'assets', 'settings'];
                event.preventDefault();
                this.setWorkspace(ids[Number(event.key) - 1]);
                return;
            }
            if (event.key === '?' && !modifier) {
                event.preventDefault();
                this.openShortcuts();
                return;
            }
            if (event.code === 'Space' && this.workspace === 'run' && !this.isCanvasEventTarget(target)) {
                event.preventDefault();
                this.runCommand('run.toggle');
            }
        }

        isCanvasEventTarget(target) {
            return Boolean(target.closest?.('.space-canvas, #space-canvas, #digital-space-canvas, #display-canvas'));
        }

        toast(message, options = {}) {
            const region = this.shell.querySelector('#uaw-toast-region');
            const toast = document.createElement('div');
            toast.className = 'uaw-toast';
            const label = document.createElement('span');
            label.textContent = message;
            toast.appendChild(label);
            if (options.action) {
                const action = document.createElement('button');
                action.type = 'button';
                action.textContent = options.action;
                action.addEventListener('click', () => {
                    options.onAction?.();
                    toast.remove();
                });
                toast.appendChild(action);
            }
            region.appendChild(toast);
            window.UAWMotion?.toastEnter?.(toast);
            setTimeout(() => {
                window.UAWMotion?.toastExit?.(toast, () => toast.remove());
            }, options.duration || 4000);
        }
    }

    const shell = new PlaygroundShell();
    window.UAWPlaygroundShell = shell;
    document.addEventListener('DOMContentLoaded', () => shell.initialize());
})();
