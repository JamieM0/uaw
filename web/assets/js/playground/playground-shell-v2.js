// UAW Playground v2 - pragmatic desktop application shell
(function () {
    'use strict';

    const DEFAULT_SETTINGS = {
        lastWorkspace: 'projects',
        sourceDock: 'split-left',
        inspectorOpen: false,
        problemsOpen: false,
        onboardingDismissed: false,
        modelView: 'process',
        runView: 'timeline',
        sourceSplit: 52,
        agentWidth: 312,
        sidebarCollapsed: false,
        layoutVersion: 4
    };

    const WORKSPACE_META = {
        projects: { title: 'Projects', description: 'Local WorkSpec projects' },
        build: { title: 'Define', description: 'Author the declarative WorkSpec model' },
        script: { title: 'Script', description: 'Author JavaScript behaviour for this WorkSpec' },
        run: { title: 'Simulate', description: 'Run and inspect the current WorkSpec' },
        validate: { title: 'Validation', description: 'Inspect problems and manage rules' },
        assets: { title: 'Assets', description: 'Project media stored outside WorkSpec source' },
        settings: { title: 'Settings', description: 'Workspace preferences and integrations' },
        source: { title: 'Source', description: 'Edit the WorkSpec document directly' }
    };

    const PERSISTENT_INSPECTOR_MODEL_VIEWS = new Set(['physical', 'digital', 'displays']);

    const ICONS = {
        projects: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 6.5h6l1.7 2H20.5v10H3.5z"/><path d="M3.5 6.5v-2h6l1.7 2"/></svg>',
        build: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5h5v5H5zM14 14h5v5h-5zM14 5h5v5h-5zM10 7.5h4M16.5 10v4M10 8v8h4"/></svg>',
        script: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8.5 6-5 6 5 6M15.5 6l5 6-5 6M13.5 4l-3 16"/></svg>',
        run: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 5 11 7-11 7z"/></svg>',
        validate: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5 20 7v5c0 4.5-3 7.4-8 9-5-1.6-8-4.5-8-9V7z"/><path d="m8.5 12 2.3 2.3 4.8-5"/></svg>',
        assets: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5.5h16v13H4z"/><path d="m4 15 4.5-4.5 3.5 3 2.5-2 5.5 5M15.5 9h.01"/></svg>',
        settings: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z"/><path d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.4-2.4 1a8 8 0 0 0-1.8-1L14.4 3h-4.8l-.4 3.1a8 8 0 0 0-1.8 1l-2.4-1-2 3.4L5.1 11a7 7 0 0 0 0 2l-2 1.5 2 3.4 2.4-1a8 8 0 0 0 1.8 1l.4 3.1h4.8l.4-3.1a8 8 0 0 0 1.8-1l2.4 1 2-3.4-2.1-1.5a7 7 0 0 0 .1-1z"/></svg>',
        source: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6-6 6 6 6M15 6l6 6-6 6M13.5 4l-3 16"/></svg>',
        problems: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4 21 20H3z"/><path d="M12 9v5M12 17h.01"/></svg>',
        rules: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14M5 12h14M5 17h14"/><circle cx="9" cy="7" r="2"/><circle cx="15" cy="12" r="2"/><circle cx="11" cy="17" r="2"/></svg>',
        agent: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7.5h14v10H5zM9 17.5v2M15 17.5v2M9 11h.01M15 11h.01M9 14h6M12 7.5V4M10.5 4h3"/></svg>',
        search: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5"/></svg>',
        panel: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 4.5h17v15h-17zM15 4.5v15"/></svg>',
        chevron: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>',
        close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>',
        collapse: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14 6-6 6 6 6M19 6v12"/></svg>'
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
            this.runView = this.settings.runView || 'timeline';
            this.projectStore = window.UAWProjectStore;
            this.projectRenderToken = 0;
            this.assetsRenderToken = 0;
            this.assetVisibleCount = 60;
            this.assetPreviewObserver = null;
            this.assetsRenderTimer = null;
        }

        loadSettings() {
            let onboardingDismissed = false;
            try { onboardingDismissed = localStorage.getItem('uaw:onboarding-dismissed') === 'true'; }
            catch (_error) { /* Browser privacy settings may disable local storage. */ }
            return { ...DEFAULT_SETTINGS, onboardingDismissed };
        }

        saveSettings() {
            try { localStorage.setItem('uaw:onboarding-dismissed', String(Boolean(this.settings.onboardingDismissed))); }
            catch (_error) { /* Project settings remain the durable fallback. */ }
            const project = this.projectStore?.getCurrent();
            if (!project) return;
            project.settings = { ...(project.settings || {}), workspace: { ...this.settings } };
            this.projectStore.put(project).catch((error) => this.toast(`Could not save project settings: ${error.message}`));
        }

        icon(name) {
            return `<span class="uaw-icon">${ICONS[name] || ''}</span>`;
        }

        initialize() {
            if (document.getElementById('uaw-app-shell')) return;
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
                    <a class="uaw-brand" href="/" aria-label="WorkSpec Studio home">
                        <span class="uaw-brand__asset" aria-hidden="true">
                            <img class="uaw-brand__wordmark" src="/assets/images/workspec-logomark-wordmark.png" alt="" />
                            <img class="uaw-brand__mark" src="/assets/images/workspec-logo.cleaned.png" alt="" />
                        </span>
                    </a>
                    <div class="uaw-titlebar__divider"></div>
                    <button class="uaw-project-title" id="uaw-project-title" type="button" title="Switch project" aria-haspopup="menu" aria-expanded="false">
                        <span id="uaw-project-name">No project</span>
                        ${this.icon('chevron')}
                    </button>
                    <span class="uaw-save-state" id="uaw-save-state" aria-live="polite">Choose a project folder</span>
                    <div class="uaw-titlebar__spacer"></div>
                    <button class="uaw-agent-button" id="uaw-agent-button" type="button">
                        ${this.icon('agent')}<span>Agent</span><span class="uaw-agent-dot" aria-hidden="true"></span>
                    </button>
                </header>

                <div class="uaw-project-menu" id="uaw-project-menu" role="menu" hidden></div>

                <div class="uaw-app-body">
                    <nav class="uaw-rail" id="uaw-sidebar" aria-label="WorkSpec Studio workspaces">
                        <div class="uaw-rail__primary">
                            <p class="uaw-rail__section-label">Workspace</p>
                            ${this.workspaceButton('projects', 'Projects', '1')}
                            ${this.workspaceButton('build', 'Define', '2')}
                            ${this.workspaceButton('script', 'Script', '3')}
                            ${this.workspaceButton('run', 'Simulate', '4')}
                            ${this.workspaceButton('validate', 'Validation')}
                            ${this.workspaceButton('assets', 'Assets', '5')}
                        </div>
                        <div class="uaw-rail__secondary">
                            <div class="uaw-rail__system-actions">
                                ${this.workspaceButton('settings', 'Settings')}
                                <button class="uaw-sidebar-toggle" id="uaw-sidebar-toggle" type="button" aria-expanded="true" aria-controls="uaw-sidebar" title="Collapse sidebar">
                                    ${this.icon('collapse')}
                                </button>
                            </div>
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
                            <section class="uaw-stage" id="uaw-stage">
                                <section class="uaw-product-view" id="uaw-projects-view" aria-label="Projects"></section>
                                <section class="uaw-product-view" id="uaw-process-view" aria-label="Process definition"></section>
                                <section class="uaw-product-view" id="uaw-objects-view" aria-label="Object catalogue"></section>
                                <section class="uaw-product-view uaw-script-view" id="uaw-script-view" aria-label="WorkSpec Script">
                                    <header class="uaw-script-heading"><div><span>JavaScript</span><strong>Project behaviour</strong></div><small>Runs through the WorkSpec runtime</small></header>
                                    <div class="uaw-script-editor" id="uaw-script-editor" aria-label="JavaScript editor"></div>
                                </section>
                                <section class="uaw-product-view" id="uaw-assets-view" aria-label="Assets"></section>
                                <section class="uaw-product-view" id="uaw-settings-view" aria-label="Settings"></section>
                                <div id="uaw-legacy-host" class="uaw-legacy-host"></div>
                                <aside id="uaw-source-pane" class="uaw-source-pane" aria-label="WorkSpec source"></aside>
                                <div class="uaw-source-resizer" id="uaw-source-resizer" role="separator" tabindex="0" aria-label="Resize Source pane"></div>
                            </section>

                            <aside class="uaw-inspector" id="uaw-inspector" aria-label="Inspector">
                                <div class="uaw-pane-header">
                                    <span id="uaw-inspector-title">Inspector</span>
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

                <div class="uaw-confirm-dialog" id="uaw-confirm-dialog" hidden>
                    <div class="uaw-command-palette__backdrop" data-cancel-confirm></div>
                    <section class="uaw-confirm-card" role="alertdialog" aria-modal="true" aria-labelledby="uaw-confirm-title" aria-describedby="uaw-confirm-copy">
                        <p class="uaw-eyebrow">PROJECT REGISTRY</p><h2 id="uaw-confirm-title">Remove from Projects?</h2><p id="uaw-confirm-copy"></p>
                        <div><button type="button" data-cancel-confirm>Cancel</button><button class="uaw-danger-button" type="button" data-confirm-delete>Remove Project</button></div>
                    </section>
                </div>

                <div class="uaw-confirm-dialog" id="uaw-object-type-dialog" hidden>
                    <div class="uaw-command-palette__backdrop" data-cancel-object-type></div>
                    <form class="uaw-confirm-card uaw-object-type-card" id="uaw-object-type-form">
                        <p class="uaw-eyebrow">OBJECT PRESET</p><h2>Define custom object type</h2><p>Create an optional shortcut for objects your domain uses repeatedly.</p>
                        <label>Type name<input id="uaw-object-type-name" type="text" required placeholder="e.g. Vehicle"></label>
                        <label>Start from<select id="uaw-object-type-base"><option value="custom">Blank custom object</option><option value="actor">Actor</option><option value="equipment">Equipment</option><option value="resource">Resource</option><option value="product">Product</option></select></label>
                        <div><button type="button" data-cancel-object-type>Cancel</button><button class="uaw-product-command primary" type="submit">Save preset</button></div>
                    </form>
                </div>

                <div class="uaw-confirm-dialog" id="uaw-project-setup-dialog" hidden>
                    <div class="uaw-command-palette__backdrop" data-cancel-project-setup></div>
                    <form class="uaw-project-setup-card" id="uaw-project-setup-form" role="dialog" aria-modal="true" aria-labelledby="uaw-project-setup-title">
                        <header><p class="uaw-eyebrow">NEW PROJECT</p><h2 id="uaw-project-setup-title">Set up project</h2><p>Name the project now. You will choose its parent folder in the next step.</p></header>
                        <label class="uaw-project-setup-name">Project name<input id="uaw-project-setup-name" type="text" required maxlength="120" autocomplete="off" placeholder="Untitled project"></label>
                        <div class="uaw-project-setup-summary">
                            <span>Starting point</span><strong id="uaw-project-setup-source">Blank WorkSpec</strong><small>A dedicated project folder will be created inside the location you choose.</small>
                        </div>
                        <footer><button type="button" data-cancel-project-setup>Cancel</button><button class="uaw-product-command primary" type="submit">Choose location…</button></footer>
                    </form>
                </div>

                <div class="uaw-agent-resizer" id="uaw-agent-resizer" role="separator" tabindex="0" aria-label="Resize Agent pane" aria-orientation="vertical"></div>
                <div class="uaw-agent-drawer" id="uaw-agent-drawer" aria-hidden="true"></div>
                <div class="uaw-toast-region" id="uaw-toast-region" aria-live="polite" aria-atomic="true"></div>
            `;

            document.body.insertBefore(shell, this.legacyHeader);
            this.shell = shell;
        }

        workspaceButton(id, label, shortcut) {
            const descriptions = {
                projects: 'Project files',
                build: 'Declarative model',
                script: 'JavaScript behaviour',
                run: 'Run WorkSpec',
                validate: 'Inspect problems and manage rules',
                assets: 'Project media',
                settings: 'Preferences'
            };
            const description = id === 'settings' ? '' : (descriptions[id] || '');
            const shortcutMarkup = shortcut ? `<kbd>${shortcut}</kbd>` : '';
            const title = shortcut ? `${label} (${shortcut})` : label;
            const buttonClass = id === 'settings' ? 'uaw-rail-button uaw-rail-button--settings' : 'uaw-rail-button';
            return `<button class="${buttonClass}" type="button" data-workspace="${id}" title="${title}">
                <span class="uaw-rail-button__icon">${this.icon(id)}</span>
                <span class="uaw-rail-button__copy"><strong>${label}</strong><small>${description}</small></span>
                ${shortcutMarkup}
            </button>`;
        }

        rehomeLegacyComponents() {
            const host = this.shell.querySelector('#uaw-legacy-host');
            host.appendChild(this.legacyMain);
            const sourcePane = this.shell.querySelector('#uaw-source-pane');
            const sourcePanel = this.legacyMain.querySelector('.json-editor-panel');
            if (sourcePane && sourcePanel) sourcePane.appendChild(sourcePanel);
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
            if (catalogTab) catalogTab.textContent = 'Rule catalog';
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
                { id: 'workspace.build', label: 'Go to Define', shortcut: '2', run: () => workspace('build') },
                { id: 'workspace.script', label: 'Go to Script', shortcut: '3', run: () => workspace('script') },
                { id: 'workspace.run', label: 'Go to Simulate', shortcut: '4', run: () => workspace('run') },
                { id: 'workspace.assets', label: 'Go to Assets', shortcut: '5', run: () => workspace('assets') },
                { id: 'workspace.settings', label: 'Go to Settings', run: () => workspace('settings') },
                { id: 'workspace.source', label: 'Open Source as a dedicated pane', shortcut: '⌘ `', run: () => workspace('source') },
                { id: 'project.new', label: 'New project', run: () => this.createProject() },
                { id: 'project.open-folder', label: 'Open project folder', run: () => this.openProjectFolder() },
                { id: 'project.templates', label: 'New project from template', run: () => click('simulation-library-btn') },
                { id: 'project.import', label: 'Import WorkSpec', run: () => click('load-simulation-btn') },
                { id: 'project.export', label: 'Export WorkSpec', run: () => click('save-simulation-btn') },
                { id: 'project.checkpoint', label: 'Save local checkpoint', shortcut: '⌘ S', run: () => this.saveCheckpoint() },
                { id: 'edit.undo', label: 'Undo last change', shortcut: '⌘ Z', run: () => click('undo-btn') },
                { id: 'edit.task', label: 'New task', run: () => click('add-task-btn') },
                { id: 'edit.object', label: 'New object', run: () => { this.setModelView('objects'); requestAnimationFrame(() => this.shell.querySelector('[data-object-menu-toggle]')?.click()); } },
                { id: 'model.process', label: 'Define the process', run: () => this.setModelView('process') },
                { id: 'model.objects', label: 'Open object catalogue', run: () => this.setModelView('objects') },
                { id: 'view.timeline', label: 'Define the process', run: () => this.setModelView('process') },
                { id: 'view.physical', label: 'Define the physical environment', run: () => this.setModelView('physical') },
                { id: 'view.digital', label: 'Define the digital environment', run: () => this.setModelView('digital') },
                { id: 'view.displays', label: 'Define display interfaces', run: () => this.setModelView('displays') },
                { id: 'model.source', label: 'Edit WorkSpec source', run: () => this.setModelView('source') },
                { id: 'model.add-location', label: 'Add physical location', run: () => click('add-location-btn') },
                { id: 'model.add-digital-location', label: 'Add digital location', run: () => click('add-digital-location-btn') },
                { id: 'model.add-digital-object', label: 'Add digital object', run: () => click('add-digital-object-btn') },
                { id: 'model.add-display', label: 'Add display', run: () => click('add-display-btn') },
                { id: 'model.add-display-element', label: 'Add display element', run: () => click('add-display-element-btn') },
                { id: 'source.format', label: 'Format WorkSpec source', run: () => click('format-json-btn') },
                { id: 'script.format', label: 'Format Script', run: () => window.UAWWorkSpecScript?.format?.() },
                { id: 'script.undo', label: 'Undo Script edit', run: () => window.UAWWorkSpecScript?.undo?.() },
                { id: 'view.source-left', label: 'Dock Source on the left', run: () => { this.setSourceDock('split-left'); this.setModelView('process'); } },
                { id: 'view.source-right', label: 'Dock Source on the right', run: () => { this.setSourceDock('split-right'); this.setModelView('process'); } },
                { id: 'view.source-bottom', label: 'Dock Source below the canvas', run: () => { this.setSourceDock('split-bottom'); this.setModelView('process'); } },
                { id: 'view.source-dedicated', label: 'Open Source in a dedicated pane', run: () => { this.setSourceDock('dedicated'); this.setModelView('source'); } },
                { id: 'view.source-hidden', label: 'Hide Source while modelling', run: () => { this.setSourceDock('hidden'); this.setModelView('process'); } },
                { id: 'run.toggle', label: 'Play or pause simulation', shortcut: 'Space', run: () => click('player-play-pause-btn') },
                { id: 'validate.run', label: 'Validate WorkSpec', shortcut: '⌘ Enter', run: () => window.runManualValidation?.() || window.validateJSON?.() },
                { id: 'run.timeline', label: 'Open simulation timeline', run: () => this.setRunView('timeline') },
                { id: 'run.period.day', label: 'Show simulation by day', run: () => this.setSimulationPeriod('day') },
                { id: 'run.period.week', label: 'Show simulation by week', run: () => this.setSimulationPeriod('week') },
                { id: 'run.period.month', label: 'Show simulation by month', run: () => this.setSimulationPeriod('month') },
                { id: 'review.problems', label: 'Review problems', run: () => this.setRunView('problems') },
                { id: 'review.rules', label: 'Edit validation rules', run: () => this.setRunView('rules') },
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

            this.shell.querySelector('#uaw-command-search')?.addEventListener('input', (event) => this.renderCommandResults(event.target.value));
            this.shell.querySelector('#uaw-command-search')?.addEventListener('keydown', (event) => this.handleCommandPaletteKey(event));
            this.shell.querySelector('[data-close-palette]')?.addEventListener('click', () => this.closeCommandPalette());
            this.shell.querySelectorAll('[data-close-shortcuts]').forEach((button) => button.addEventListener('click', () => this.closeShortcuts()));
            this.shell.querySelectorAll('[data-cancel-confirm]').forEach((button) => button.addEventListener('click', () => this.closeDeleteConfirmation()));
            this.shell.querySelectorAll('[data-cancel-object-type]').forEach((button) => button.addEventListener('click', () => this.closeCustomObjectTypeDialog()));
            this.shell.querySelector('#uaw-object-type-form')?.addEventListener('submit', (event) => this.saveCustomObjectType(event));
            this.shell.querySelectorAll('[data-cancel-project-setup]').forEach((button) => button.addEventListener('click', () => this.closeProjectSetup()));
            this.shell.querySelector('#uaw-project-setup-form')?.addEventListener('submit', (event) => this.submitProjectSetup(event));
            this.shell.querySelector('#uaw-toggle-inspector')?.addEventListener('click', () => this.toggleInspector());
            this.shell.querySelector('#uaw-close-inspector')?.addEventListener('click', () => this.toggleInspector(false));
            this.shell.querySelector('#uaw-agent-button')?.addEventListener('click', () => this.toggleAgent());
            this.shell.querySelector('#uaw-sidebar-toggle')?.addEventListener('click', () => this.toggleSidebar());
            this.shell.querySelector('#uaw-project-title')?.addEventListener('click', () => this.toggleProjectMenu());
            this.bindAgentResizer();

            window.addEventListener('uaw:project-opened', (event) => {
                this.assetVisibleCount = 60;
                const projectSettings = event.detail.project?.settings?.workspace;
                if (projectSettings?.layoutVersion === DEFAULT_SETTINGS.layoutVersion) {
                    const globalOnboardingDismissed = this.settings.onboardingDismissed;
                    this.settings = { ...DEFAULT_SETTINGS, ...projectSettings, onboardingDismissed: globalOnboardingDismissed || Boolean(projectSettings.onboardingDismissed) };
                    this.workspace = this.settings.lastWorkspace;
                    this.modelView = this.settings.modelView;
                    this.runView = this.settings.runView;
                    this.applySettings();
                    this.setWorkspace(this.workspace, { persist: false, animate: false });
                }
                this.updateProjectIdentity(event.detail.project);
                this.renderProjects();
                if (this.modelView === 'objects') this.renderObjectsModel();
                this.updateDocumentSummary();
            });
            window.addEventListener('uaw:projects-changed', () => {
                this.renderProjects();
                if (!this.shell.querySelector('#uaw-project-menu')?.hidden) this.renderProjectMenu();
            });
            window.addEventListener('uaw:legacy-projects-found', () => this.renderProjects());
            window.addEventListener('uaw:legacy-project-migrated', () => this.renderProjects());
            window.addEventListener('uaw:legacy-project-deleted', () => this.renderProjects());
            window.addEventListener('uaw:assets-changed', () => {
                if (this.workspace === 'assets') this.scheduleAssetsRender();
            });
            window.addEventListener('uaw:metrics-ready', () => {
                if (this.workspace === 'run' && this.runView === 'rules') {
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
            document.addEventListener('simulation-rendered', () => this.renderCommandbar());
            window.addEventListener('uaw:project-saving', () => this.setSaveState('Saving…', 'working'));
            window.addEventListener('uaw:project-saved', () => {
                this.setSaveState('Saved to folder', 'saved');
                this.updateDocumentSummary();
            });
            window.addEventListener('uaw:project-save-error', (event) => {
                this.setSaveState('Save failed', 'error');
                this.toast(`Could not save to the project folder: ${event.detail.error?.message || 'Unknown error'}`);
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

            document.getElementById('json-status')?.addEventListener('click', () => this.setRunView('problems'));
            document.querySelector('.validation-header')?.addEventListener('click', (event) => {
                if (this.workspace !== 'build' || event.target.closest('button, input, select, textarea, a')) return;
                this.toggleProblems();
            });
            document.addEventListener('keydown', (event) => this.handleShortcut(event), true);
            this.bindSourceResizer();
            document.addEventListener('click', (event) => {
                const action = event.target.closest('[data-uaw-command]');
                if (action) this.runCommand(action.dataset.uawCommand);
                const objectType = event.target.closest('[data-add-object-type]');
                if (objectType) {
                    this.closeObjectMenu();
                    window.openAddObjectModalWithType?.(objectType.dataset.addObjectType, objectType.dataset.customObjectLabel || '', objectType.dataset.customObjectId || '');
                }
                const menuToggle = event.target.closest('[data-object-menu-toggle]');
                if (menuToggle) {
                    event.preventDefault();
                    event.stopPropagation();
                    this.toggleObjectMenu(menuToggle);
                } else if (!event.target.closest('.uaw-object-add-menu')) {
                    this.closeObjectMenu();
                }
                if (!event.target.closest('#uaw-project-menu, #uaw-project-title')) this.toggleProjectMenu(false);
            });
        }

        applySettings() {
            this.setSourceDock(this.settings.sourceDock, { persist: false, navigate: false });
            this.toggleInspector(this.settings.inspectorOpen, { persist: false });
            document.body.classList.toggle('uaw-problems-open', Boolean(this.settings.problemsOpen));
            this.toggleSidebar(this.settings.sidebarCollapsed, { persist: false, focus: false });
            document.body.dataset.modelView = this.modelView;
            document.body.dataset.runView = this.runView;
            document.documentElement.style.setProperty('--uaw-source-split', `${this.settings.sourceSplit || 52}%`);
            document.documentElement.style.setProperty('--uaw-agent-width', `${this.settings.agentWidth || 312}px`);
        }

        commandButton(command, label, options = {}) {
            return `<button type="button" class="uaw-product-command ${options.primary ? 'primary' : ''} ${options.active ? 'active' : ''}" data-uaw-command="${command}" ${options.pressed !== undefined ? `aria-pressed="${options.pressed}"` : ''}>${escapeHTML(label)}</button>`;
        }

        getCustomObjectTypes() {
            const types = this.projectStore?.getCurrent()?.settings?.customObjectTypes;
            return (Array.isArray(types) ? types : []).filter(type => type && type.id && type.label);
        }

        objectAddMenuButton() {
            return `<div class="uaw-object-add-control"><button type="button" class="uaw-product-command primary" data-object-menu-toggle aria-haspopup="menu" aria-expanded="false">Add object <span aria-hidden="true">▾</span></button><div class="uaw-object-add-menu" role="menu" hidden></div></div>`;
        }

        toggleObjectMenu(toggle) {
            const menu = toggle.parentElement?.querySelector('.uaw-object-add-menu');
            if (!menu) return;
            const willOpen = menu.hidden;
            document.querySelectorAll('.uaw-object-add-menu').forEach(candidate => { candidate.hidden = true; });
            document.querySelectorAll('[data-object-menu-toggle]').forEach(candidate => candidate.setAttribute('aria-expanded', 'false'));
            if (!willOpen) return;
            const presets = [
                ['actor', 'Actor', 'People, agents and responsible roles'],
                ['equipment', 'Equipment', 'Machines, tools and durable systems'],
                ['resource', 'Resource', 'Materials, capacity and consumables'],
                ['product', 'Product', 'Outputs, deliverables and work in progress']
            ];
            const custom = this.getCustomObjectTypes();
            menu.innerHTML = `${presets.map(([id, label, help]) => `<button role="menuitem" type="button" data-add-object-type="${id}"><span><strong>Add ${label}</strong><small>${help}</small></span></button>`).join('')}${custom.length ? `<div class="uaw-menu-separator"><span>Custom object types</span></div>${custom.map(type => `<button role="menuitem" type="button" data-add-object-type="${escapeHTML(type.baseType || 'custom')}" data-custom-object-id="${escapeHTML(type.id)}" data-custom-object-label="${escapeHTML(type.label)}"><span><strong>Add ${escapeHTML(type.label)}</strong><small>Custom type based on ${escapeHTML(type.baseType || 'object')}</small></span></button>`).join('')}` : ''}<div class="uaw-menu-separator"></div><button role="menuitem" type="button" data-create-object-type><span><strong>Define custom type…</strong><small>Create a reusable project preset</small></span></button>`;
            menu.hidden = false;
            // The register clips its rounded table edges; an active menu must be
            // allowed to extend outside that container.
            menu.closest('.uaw-process-register')?.classList.add('uaw-object-menu-open');
            toggle.setAttribute('aria-expanded', 'true');
            menu.querySelector('[data-create-object-type]')?.addEventListener('click', () => this.defineCustomObjectType());
            window.UAWMotion?.dialogEnter?.('.uaw-object-add-menu:not([hidden])');
        }

        closeObjectMenu() {
            document.querySelectorAll('.uaw-object-add-menu').forEach(menu => { menu.hidden = true; });
            document.querySelectorAll('[data-object-menu-toggle]').forEach(toggle => toggle.setAttribute('aria-expanded', 'false'));
            document.querySelectorAll('.uaw-process-register.uaw-object-menu-open').forEach(register => register.classList.remove('uaw-object-menu-open'));
        }

        defineCustomObjectType() {
            this.closeObjectMenu();
            const dialog = this.shell?.querySelector('#uaw-object-type-dialog');
            if (!dialog) return;
            dialog.hidden = false;
            const input = dialog.querySelector('#uaw-object-type-name');
            input.value = '';
            requestAnimationFrame(() => input.focus());
            window.UAWMotion?.dialogEnter?.('.uaw-object-type-card');
        }

        async saveCustomObjectType(event) {
            event.preventDefault();
            const label = this.shell.querySelector('#uaw-object-type-name')?.value;
            const baseType = this.shell.querySelector('#uaw-object-type-base')?.value || 'custom';
            if (!label?.trim()) return;
            const types = this.getCustomObjectTypes();
            const id = label.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
            if (!id) return;
            if (!types.some(type => type.id === id)) types.push({ id, label: label.trim(), baseType });
            const project = this.projectStore?.getCurrent();
            if (!project) return;
            project.settings = { ...(project.settings || {}), customObjectTypes: types };
            await this.projectStore.put(project);
            this.closeCustomObjectTypeDialog();
            this.renderObjectsModel();
            this.renderCommandbar();
            this.toast(`${label.trim()} added to object presets`);
        }

        closeCustomObjectTypeDialog() {
            const dialog = this.shell?.querySelector('#uaw-object-type-dialog');
            if (dialog) dialog.hidden = true;
        }

        renderCommandbar() {
            const primary = this.shell?.querySelector('#uaw-primary-commands');
            const context = this.shell?.querySelector('#uaw-context-commands');
            const playback = this.shell?.querySelector('#uaw-playback-commands');
            if (!primary || !context || !playback) return;

            primary.innerHTML = '';
            context.innerHTML = '';
            // The WorkSpec has one application clock. Keep transport available
            // while authoring and inspecting every model surface, not only on
            // the simulation timeline.
            playback.hidden = !['build', 'source', 'run'].includes(this.workspace);

            if (this.workspace === 'projects') {
                primary.innerHTML = this.commandButton('project.new', 'New project', { primary: true })
                    + this.commandButton('project.templates', 'From template')
                    + this.commandButton('project.import', 'Import WorkSpec')
                    + this.commandButton('project.open-folder', 'Open project folder');
                return;
            }

            if (this.workspace === 'build' || this.workspace === 'source') {
                const views = [
                    ['process', 'Process', 'model.process'],
                    ['objects', 'Objects', 'model.objects'],
                    ['physical', 'Physical', 'view.physical'],
                    ['digital', 'Digital', 'view.digital'],
                    ['displays', 'Displays', 'view.displays'],
                    ['source', 'Source', 'model.source']
                ];
                primary.innerHTML = `<div class="uaw-segmented" role="tablist" aria-label="Define views">${views.map(([id, label, command]) => this.commandButton(command, label, { active: this.modelView === id, pressed: this.modelView === id })).join('')}</div>`;
                const actions = {
                    process: this.commandButton('edit.task', 'New task', { primary: true }),
                    objects: this.objectAddMenuButton(),
                    physical: this.commandButton('model.add-location', 'New location', { primary: true }),
                    digital: this.commandButton('model.add-digital-location', 'New location', { primary: true }) + this.commandButton('model.add-digital-object', 'New object'),
                    displays: this.commandButton('model.add-display', 'New display', { primary: true }) + this.commandButton('model.add-display-element', 'New element'),
                    source: this.commandButton('source.format', 'Format') + this.commandButton('edit.undo', 'Undo')
                };
                context.innerHTML = `<div class="uaw-context-actions">${actions[this.modelView] || ''}</div>${this.commandButton('project.export', 'Export WorkSpec')}`;
                return;
            }

            if (this.workspace === 'script') {
                primary.innerHTML = '<span class="uaw-mode-label">JavaScript</span>';
                context.innerHTML = this.commandButton('script.format', 'Format') + this.commandButton('script.undo', 'Undo');
                return;
            }

            if (this.workspace === 'run') {
                const periodViews = this.runView === 'timeline' && this.isMultiPeriodSimulation()
                    ? `<div class="uaw-segmented uaw-period-commands" role="tablist" aria-label="Simulation period">${[
                        ['day', 'Day', 'run.period.day'],
                        ['week', 'Week', 'run.period.week'],
                        ['month', 'Month', 'run.period.month']
                    ].map(([id, label, command]) => this.commandButton(command, label, { active: this.getSimulationPeriodView() === id, pressed: this.getSimulationPeriodView() === id })).join('')}</div>`
                    : '';
                const validationViews = ['problems', 'rules'].includes(this.runView)
                    ? `<div class="uaw-segmented uaw-validation-commands" role="tablist" aria-label="Validation views">${this.commandButton('review.problems', 'Problems', { active: this.runView === 'problems', pressed: this.runView === 'problems' })}${this.commandButton('review.rules', 'Rules', { active: this.runView === 'rules', pressed: this.runView === 'rules' })}</div>`
                    : '';
                primary.innerHTML = this.runView === 'timeline'
                    ? this.commandButton('run.timeline', 'Timeline', { active: true, pressed: true }) + periodViews
                    : validationViews;
                context.innerHTML = this.runView === 'rules'
                    ? this.commandButton('review.add-rule', 'New rule', { primary: true }) + this.commandButton('review.run-custom', 'Run rules')
                    : this.runView === 'problems' ? this.commandButton('validate.run', 'Run validation', { primary: true }) : '';
                return;
            }

            if (this.workspace === 'assets') {
                primary.innerHTML = this.commandButton('project.import', 'Import WorkSpec');
            }
        }

        ensureMetricsMode(active) {
            const top = document.querySelector('.playground-top');
            const toggle = document.getElementById('metrics-mode-toggle');
            if (!top || !toggle || toggle.dataset.metricsReady !== 'true') return;
            if (top.classList.contains('metrics-mode') !== active) toggle.click();
        }

        isMultiPeriodSimulation() {
            return Boolean(window.multiPeriodViewController?.isMultiPeriod?.());
        }

        getSimulationPeriodView() {
            const view = window.multiPeriodViewController?.currentView;
            return view === 'calendar' ? 'month' : (view || 'day');
        }

        setSimulationPeriod(period) {
            const controller = window.multiPeriodViewController;
            if (!controller?.isMultiPeriod?.()) return;
            if (period === 'day') controller.goToDay(controller.currentDay || 1);
            if (period === 'week') controller.goToWeek(controller.currentWeek || 1);
            if (period === 'month') controller.goToCalendar();
            this.renderCommandbar();
        }

        setModelView(view, options = {}) {
            const allowed = ['process', 'objects', 'physical', 'digital', 'displays', 'source'];
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
            if (view === 'objects') this.renderObjectsModel();
            document.querySelector(`.simulation-panel .tab-btn[data-tab="${tabs[view]}"]`)?.click();
            this.renderCommandbar();
        }

        setRunView(view, options = {}) {
            this.runView = ['timeline', 'problems', 'rules'].includes(view) ? view : 'timeline';
            this.settings.runView = this.runView;
            document.body.dataset.runView = this.runView;
            if (options.persist !== false) this.saveSettings();
            this.setWorkspace('run', { ...options, fromSubview: true });
        }

        setWorkspace(workspace, options = {}) {
            if (workspace === 'validate') {
                workspace = 'run';
                if (!options.fromSubview) {
                    this.runView = 'problems';
                    this.settings.runView = this.runView;
                    document.body.dataset.runView = this.runView;
                }
            } else if (workspace === 'run' && !options.fromSubview && this.runView !== 'timeline') {
                // Simulate is the timeline destination. Validation keeps its
                // own Problems/Rules subviews and must not remain selected when
                // the user returns to Simulate.
                this.runView = 'timeline';
                this.settings.runView = this.runView;
                document.body.dataset.runView = this.runView;
            }
            if (!WORKSPACE_META[workspace]) workspace = 'build';
            if (workspace === 'build' && !options.fromSubview && this.modelView === 'source') workspace = 'source';
            this.workspace = workspace;
            document.body.dataset.uawWorkspace = workspace;
            // Environment editors always need their properties panel available.
            // Keep the preference toggle for other views, but never allow it to
            // hide the panel while modelling a physical, digital, or display
            // environment.
            this.toggleInspector(this.hasPersistentInspector(), { persist: false });
            this.shell.querySelectorAll('.uaw-rail-button').forEach((button) => {
                const selected = (button.dataset.workspace === workspace && !(workspace === 'run' && ['problems', 'rules'].includes(this.runView)))
                    || (workspace === 'source' && button.dataset.workspace === 'build')
                    || (workspace === 'run' && button.dataset.workspace === 'validate' && ['problems', 'rules'].includes(this.runView));
                button.classList.toggle('active', selected);
                button.setAttribute('aria-current', selected ? 'page' : 'false');
            });

            const meta = workspace === 'run' && ['problems', 'rules'].includes(this.runView)
                ? WORKSPACE_META.validate
                : WORKSPACE_META[workspace];
            this.shell.querySelector('#uaw-workspace-title').textContent = meta.title;
            this.shell.querySelector('#uaw-workspace-description').textContent = meta.description;

            if (workspace === 'projects') this.renderProjects();
            if (workspace === 'build' && this.modelView === 'process') this.renderProcessModel();
            if (workspace === 'build' && this.modelView === 'objects') this.renderObjectsModel();
            if (workspace === 'assets') this.renderAssets();
            if (workspace === 'settings') this.renderSettings();
            if (workspace === 'script') window.UAWWorkSpecScript?.initialize?.();
            if (workspace === 'run') {
                const rules = this.runView === 'rules';
                this.ensureMetricsMode(rules);
                if (!rules) document.querySelector('.simulation-panel .tab-btn[data-tab="timeline"]')?.click();
                if (rules) requestAnimationFrame(() => {
                    this.ensureMetricsMode(true);
                    this.prepareRulesWorkspace();
                });
                if (this.runView === 'problems') requestAnimationFrame(() => this.prepareProblemsWorkspace());
            }
            if (workspace === 'build' || workspace === 'source' || workspace === 'script' || workspace === 'projects' || workspace === 'assets' || workspace === 'settings') {
                this.ensureMetricsMode(false);
            }
            if (workspace === 'build' && !options.fromSubview) {
                const tabs = { process: 'timeline', physical: 'space-editor', digital: 'digital-space', displays: 'display-editor' };
                document.querySelector(`.simulation-panel .tab-btn[data-tab="${tabs[this.modelView] || 'timeline'}"]`)?.click();
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

        prepareProblemsWorkspace() {
            const panel = document.querySelector('.validation-panel');
            if (!panel || panel.querySelector('.uaw-problems-overview')) return;
            panel.insertAdjacentHTML('afterbegin', `<header class="uaw-problems-overview"><div><h1>Problems</h1><p>Validation errors, warnings, suggestions and passed checks for the current WorkSpec.</p></div><span>WorkSpec health</span></header>`);
        }

        prepareRulesWorkspace() {
            const content = document.querySelector('#metrics-editor-panel > .panel-content');
            if (!content) return;
            if (!content.querySelector('.uaw-rules-overview')) {
                content.insertAdjacentHTML('afterbegin', `<header class="uaw-rules-overview"><div><h1>Rules</h1><p>Define project-specific checks without exposing unrelated WorkSpec source.</p></div><span>Custom validation</span></header>`);
            }
            const tabs = content.querySelectorAll('.metrics-tab-btn');
            if (tabs[0]) tabs[0].textContent = 'Rule catalog';
            if (tabs[1]) tabs[1].textContent = 'Rule logic';
        }

        layoutEditors() {
            const layout = () => {
                window.monacoEditor?.layout?.();
                window.metricsJsonEditor?.layout?.();
                window.metricsCatalogEditor?.layout?.();
                window.metricsValidatorEditor?.layout?.();
                window.UAWWorkSpecScript?.layout?.();
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

        bindSourceResizer() {
            const handle = this.shell?.querySelector('#uaw-source-resizer');
            const stage = this.shell?.querySelector('#uaw-stage');
            if (!handle || !stage) return;
            const update = (event) => {
                const rect = stage.getBoundingClientRect();
                const vertical = this.settings.sourceDock === 'split-bottom';
                const raw = vertical ? ((event.clientY - rect.top) / rect.height) * 100 : ((event.clientX - rect.left) / rect.width) * 100;
                const value = Math.min(75, Math.max(25, Math.round(raw * 10) / 10));
                this.settings.sourceSplit = value;
                document.documentElement.style.setProperty('--uaw-source-split', `${value}%`);
                this.layoutEditors();
            };
            handle.addEventListener('pointerdown', (event) => {
                event.preventDefault();
                handle.setPointerCapture(event.pointerId);
                document.body.classList.add('uaw-resizing-source');
            });
            handle.addEventListener('pointermove', (event) => {
                if (!handle.hasPointerCapture(event.pointerId)) return;
                update(event);
            });
            const finish = (event) => {
                if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId);
                document.body.classList.remove('uaw-resizing-source');
                this.saveSettings();
            };
            handle.addEventListener('pointerup', finish);
            handle.addEventListener('pointercancel', finish);
            handle.addEventListener('keydown', (event) => {
                if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
                event.preventDefault();
                const delta = ['ArrowRight', 'ArrowDown'].includes(event.key) ? 2 : -2;
                this.settings.sourceSplit = Math.min(75, Math.max(25, (this.settings.sourceSplit || 52) + delta));
                document.documentElement.style.setProperty('--uaw-source-split', `${this.settings.sourceSplit}%`);
                this.saveSettings();
                this.layoutEditors();
            });
        }

        toggleExplorer(force, options = {}) {
            const open = typeof force === 'boolean' ? force : !document.body.classList.contains('uaw-explorer-open');
            document.body.classList.toggle('uaw-explorer-open', open);
            this.settings.explorerOpen = open;
            if (options.persist !== false) this.saveSettings();
            window.UAWMotion?.panelChange?.('#uaw-explorer', open);
            this.layoutEditors();
        }

        hasPersistentInspector() {
            return this.workspace === 'build' && PERSISTENT_INSPECTOR_MODEL_VIEWS.has(this.modelView);
        }

        toggleInspector(force, options = {}) {
            const open = this.hasPersistentInspector();
            document.body.classList.toggle('uaw-inspector-open', open);
            window.UAWMotion?.panelChange?.('#uaw-inspector', open);
            this.layoutEditors();
        }

        toggleSidebar(force, options = {}) {
            const collapsed = typeof force === 'boolean'
                ? force
                : !document.body.classList.contains('uaw-sidebar-collapsed');
            document.body.classList.toggle('uaw-sidebar-collapsed', collapsed);
            this.settings.sidebarCollapsed = collapsed;
            const toggle = this.shell?.querySelector('#uaw-sidebar-toggle');
            if (toggle) {
                toggle.setAttribute('aria-expanded', String(!collapsed));
                toggle.setAttribute('title', collapsed ? 'Expand sidebar' : 'Collapse sidebar');
                toggle.querySelector('span').textContent = collapsed ? 'Expand sidebar' : 'Collapse sidebar';
                toggle.querySelector('.uaw-icon').innerHTML = collapsed ? ICONS.chevron : ICONS.collapse;
            }
            if (options.persist !== false) this.saveSettings();
            if (options.focus !== false) toggle?.focus();
            this.layoutEditors();
        }

        toggleAgent(force) {
            const drawer = this.shell.querySelector('#uaw-agent-drawer');
            const open = typeof force === 'boolean' ? force : !document.body.classList.contains('uaw-agent-open');
            document.body.classList.toggle('uaw-agent-open', open);
            drawer?.setAttribute('aria-hidden', String(!open));
            document.documentElement.style.setProperty('--uaw-agent-width', `${this.settings.agentWidth || 312}px`);
            window.UAWMotion?.panelChange?.('#uaw-agent-drawer', open);
            if (open) window.dispatchEvent(new CustomEvent('uaw:agent-opened'));
        }

        bindAgentResizer() {
            const handle = this.shell?.querySelector('#uaw-agent-resizer');
            if (!handle) return;
            const applyWidth = (value, persist = false) => {
                const maximum = Math.max(280, Math.min(520, window.innerWidth - 760));
                this.settings.agentWidth = Math.round(Math.min(maximum, Math.max(280, value)));
                document.documentElement.style.setProperty('--uaw-agent-width', `${this.settings.agentWidth}px`);
                if (persist) this.saveSettings();
                this.layoutEditors();
            };
            handle.addEventListener('pointerdown', (event) => {
                event.preventDefault();
                handle.setPointerCapture(event.pointerId);
                document.body.classList.add('uaw-resizing-agent');
            });
            handle.addEventListener('pointermove', (event) => {
                if (handle.hasPointerCapture(event.pointerId)) applyWidth(window.innerWidth - event.clientX);
            });
            const finish = (event) => {
                if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId);
                document.body.classList.remove('uaw-resizing-agent');
                applyWidth(this.settings.agentWidth, true);
            };
            handle.addEventListener('pointerup', finish);
            handle.addEventListener('pointercancel', finish);
            handle.addEventListener('keydown', (event) => {
                if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
                event.preventDefault();
                applyWidth((this.settings.agentWidth || 312) + (event.key === 'ArrowLeft' ? 16 : -16), true);
            });
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
                if (this.workspace === 'build' && this.modelView === 'process') this.renderProcessModel();
                if (this.workspace === 'build' && this.modelView === 'objects') this.renderObjectsModel();
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
                const lifecycleObjects = [...canonicalTasks, ...periodTasks].flatMap(task => (task?.interactions || []).flatMap(interaction => [
                    interaction?.object,
                    ...((interaction?.add_objects || []).filter(item => item && typeof item === 'object'))
                ])).filter(object => object?.id).map(object => ({ ...object, __lifecycle: 'Created by process' }));
                const baseObjects = canonicalObjects.length ? canonicalObjects : legacyObjects.length ? legacyObjects : periodObjects;
                const objectList = [...baseObjects, ...lifecycleObjects];
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
                return `<tr data-context-task-id="${escapeHTML(task.id || '')}">
                    <td><div class="uaw-process-task-name"><strong>${escapeHTML(task.name || task.id || `Task ${index + 1}`)}</strong><code>${escapeHTML(task.id || 'No ID')}</code>${period}</div></td>
                    <td>${escapeHTML(actor?.name || task.actor_id || 'Unassigned')}</td>
                    <td><span class="uaw-process-time">${escapeHTML(task.start || task.start_time || '—')}</span></td>
                    <td>${escapeHTML(task.duration ?? '—')} ${task.duration != null ? escapeHTML(simulation.config?.time_unit || 'min') : ''}</td>
                    <td>${escapeHTML(task.location || task.location_id || '—')}</td>
                    <td class="uaw-process-dependencies">${escapeHTML(dependencies)}</td>
                    <td><span class="uaw-temporal-badge">Upcoming</span></td>
                    <td><button class="uaw-row-action" type="button" data-edit-process-task="${index}">${task.__period ? 'View source' : 'Edit'}</button></td>
                </tr>`;
            }).join('');

            view.innerHTML = `
                <header class="uaw-process-heading">
                    <div><h1>${escapeHTML(title)}</h1><p>${escapeHTML(description)}</p></div>
                    <dl><div><dt>Tasks</dt><dd>${tasks.length}</dd></div><div><dt>Actors</dt><dd>${actors.length}</dd></div><div><dt>Objects</dt><dd>${objects.length}</dd></div></dl>
                </header>
                <section class="uaw-process-register" aria-labelledby="uaw-task-register-heading">
                    <div class="uaw-process-section-heading"><div><h2 id="uaw-task-register-heading">Task register</h2><p>The authored sequence, assignments and dependencies. Run it from Simulate.</p></div></div>
                    ${rows ? `<div class="uaw-process-table-wrap"><table class="uaw-process-table"><thead><tr><th>Task</th><th>Actor</th><th>Start</th><th>Duration</th><th>Location</th><th>Depends on</th><th>Moment</th><th><span class="sr-only">Actions</span></th></tr></thead><tbody>${rows}</tbody></table></div>` : `<div class="uaw-process-empty"><strong>No tasks yet</strong><p>Add the first task to establish this process.</p><button type="button" data-uaw-command="edit.task">Create first task</button></div>`}
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
        }

        renderObjectsModel() {
            const view = this.shell?.querySelector('#uaw-objects-view');
            if (!view) return;
            const documentModel = this.readProcessDocument();
            if (!documentModel) {
                view.innerHTML = `<div class="uaw-process-empty"><strong>The WorkSpec source is not valid JSON.</strong><p>Repair it in Source before editing objects.</p><button type="button" data-uaw-command="model.source">Open Source</button></div>`;
                return;
            }
            const objects = documentModel.objects || [];
            const groups = [...new Set(objects.map(object => object?.type || 'custom'))].sort();
            const rows = objects.map((object, index) => {
                const type = object?.type || 'custom';
                const details = object?.properties || {};
                const state = details.state ?? details.quantity ?? details.role ?? '—';
                return `<tr data-object-row data-context-object-id="${escapeHTML(object?.id || '')}" data-object-search="${escapeHTML(`${object?.name || ''} ${object?.id || ''} ${type}`.toLowerCase())}" data-object-type="${escapeHTML(type)}"><td><div class="uaw-object-name"><span><strong>${escapeHTML(object?.name || object?.id || `Object ${index + 1}`)}</strong><code>${escapeHTML(object?.id || 'No ID')}</code></span></div></td><td><span class="uaw-type-pill">${escapeHTML(type)}</span></td><td>${escapeHTML(state)}</td><td><span class="uaw-temporal-badge">Inactive</span></td><td>${escapeHTML(object?.__lifecycle || object?.__period || 'Global')}</td><td><button class="uaw-row-action" type="button" data-edit-object-index="${index}">${object?.__period || object?.__lifecycle ? 'View source' : 'Edit'}</button></td></tr>`;
            }).join('');
            view.innerHTML = `<header class="uaw-process-heading uaw-objects-heading"><div><h1>Objects</h1><p>Actors, resources, equipment and outputs available to this process.</p></div><dl><div><dt>Objects</dt><dd>${objects.length}</dd></div><div><dt>Types</dt><dd>${groups.length}</dd></div></dl></header><section class="uaw-process-register"><div class="uaw-process-section-heading"><div><h2>Object register</h2><p>Reusable entities referenced by tasks and environment layouts.</p></div></div><div class="uaw-object-toolbar"><label><span class="sr-only">Search objects</span><input type="search" data-object-search-input placeholder="Search objects…"></label><select data-object-filter aria-label="Filter object type"><option value="">All types</option>${groups.map(type => `<option value="${escapeHTML(type)}">${escapeHTML(type)}</option>`).join('')}</select></div>${rows ? `<div class="uaw-process-table-wrap"><table class="uaw-process-table uaw-object-table"><thead><tr><th>Object</th><th>Type</th><th>State / quantity</th><th>Moment</th><th>Scope</th><th><span class="sr-only">Actions</span></th></tr></thead><tbody>${rows}</tbody></table></div>` : `<div class="uaw-process-empty"><strong>No objects yet</strong><p>Use Add object in the command bar to create an actor, resource, equipment item or product.</p></div>`}</section>`;
            const filter = () => {
                const query = view.querySelector('[data-object-search-input]')?.value.trim().toLowerCase() || '';
                const type = view.querySelector('[data-object-filter]')?.value || '';
                view.querySelectorAll('[data-object-row]').forEach(row => { row.hidden = Boolean((query && !row.dataset.objectSearch.includes(query)) || (type && row.dataset.objectType !== type)); });
            };
            view.querySelector('[data-object-search-input]')?.addEventListener('input', filter);
            view.querySelector('[data-object-filter]')?.addEventListener('change', filter);
            view.querySelectorAll('[data-edit-object-index]').forEach(button => button.addEventListener('click', () => {
                const object = objects[Number(button.dataset.editObjectIndex)];
                if (!object) return;
                if (object.__period || object.__lifecycle || typeof window.openEditObjectModal !== 'function') this.setModelView('source');
                else window.openEditObjectModal(object);
            }));
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
                    <button type="button" data-project-menu-action="manage">Manage projects</button>
                    ${current ? '<button type="button" data-project-menu-action="rename">Rename current project</button>' : ''}
                </div>
            `;
            menu.querySelectorAll('[data-switch-project]').forEach(button => button.addEventListener('click', async () => {
                await this.projectStore.open(button.dataset.switchProject, { requestPermission: true });
                this.toggleProjectMenu(false);
                this.setWorkspace('build');
            }));
            menu.querySelector('[data-project-menu-action="manage"]')?.addEventListener('click', () => {
                this.toggleProjectMenu(false);
                this.setWorkspace('projects');
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
            const legacyProjects = this.projectStore.getLegacyProjects?.() || [];
            if (token !== this.projectRenderToken) return;

            const projectIcons = {
                template: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4.5h6.5v6.5H4zM13.5 4.5H20V11h-6.5zM4 14h6.5v5.5H4zM13.5 14H20v5.5h-6.5z"/></svg>',
                import: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5v11M7.5 10l4.5 4.5 4.5-4.5M4 17v2.5h16V17"/></svg>',
                folder: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 6.5h6l1.7 2H20.5v10H3.5z"/><path d="M3.5 6.5v-2h6l1.7 2"/></svg>',
                agent: ICONS.agent,
                document: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3.5h8l4 4v13H6z"/><path d="M14 3.5v4h4M9 12h6M9 15.5h6"/></svg>',
                arrow: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>'
            };

            const cards = projects.map((project) => {
                const date = project.updatedAt
                    ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(project.updatedAt))
                    : null;
                const secondary = project.accessRequired ? 'Click to restore folder access'
                    : project.unavailable ? (project.error || 'Project folder is unavailable')
                    : `Updated ${date}`;
                return `<article class="uaw-project-card" data-project-id="${escapeHTML(project.id)}">
                    <button class="uaw-project-card__open" type="button" data-open-project="${escapeHTML(project.id)}">
                        <span class="uaw-project-card__mark">${projectIcons.document}</span>
                        <span class="uaw-project-card__body"><strong>${escapeHTML(project.name)}</strong><small>${escapeHTML(secondary)}</small></span>
                        <span class="uaw-project-card__arrow">${projectIcons.arrow}</span>
                    </button>
                    <div class="uaw-project-card__actions">
                        <button type="button" data-duplicate-project="${escapeHTML(project.id)}">Duplicate</button>
                        <button type="button" data-delete-project="${escapeHTML(project.id)}" class="uaw-project-delete">Remove Project</button>
                    </div>
                </article>`;
            }).join('');

            const migration = legacyProjects.length ? `<section class="uaw-onboarding uaw-storage-migration">
                <div><p class="uaw-eyebrow">ONE-TIME MIGRATION</p><h2>Move browser projects into folders</h2><p>${legacyProjects.length} saved ${legacyProjects.length === 1 ? 'project was' : 'projects were'} found in browser storage. Choose a parent location for each project; UAW creates its dedicated folder and removes the browser copy only after the write succeeds.</p></div>
                <div class="uaw-migration-list">${legacyProjects.map(project => `<div class="uaw-migration-item">
                    <button type="button" class="uaw-migration-project" data-migrate-project="${escapeHTML(project.id)}"><strong>${escapeHTML(project.name || 'Recovered project')}</strong><small>Choose parent location…</small></button>
                    <button type="button" class="uaw-migration-delete" data-delete-legacy-project="${escapeHTML(project.id)}" aria-label="Delete ${escapeHTML(project.name || 'Recovered project')}">Delete</button>
                </div>`).join('')}</div>
            </section>` : '';

            view.innerHTML = `<div class="uaw-projects-shell">
                <header class="uaw-projects-hero">
                    <div class="uaw-projects-hero__copy">
                        <h1>Projects</h1>
                        <p>Create, reconnect and manage folder-backed WorkSpec projects. Your project files stay in locations you choose.</p>
                    </div>
                </header>
                ${migration}
                ${!projects.length && !this.settings.onboardingDismissed ? this.onboardingMarkup() : ''}
                <section class="uaw-projects-section uaw-projects-section--recent" aria-labelledby="uaw-recent-projects-title">
                    <div class="uaw-projects-section__heading"><div><p>Your workspace</p><h2 id="uaw-recent-projects-title">Recent projects</h2></div></div>
                    <div class="uaw-project-grid">${cards || `<div class="uaw-empty-state"><span class="uaw-empty-state__mark">${projectIcons.document}</span><span><strong>No projects yet</strong><p>Use the command bar to create, import or reconnect a project.</p></span></div>`}</div>
                </section>
            </div>`;

            view.querySelectorAll('[data-open-project]').forEach((button) => button.addEventListener('click', async () => {
                const project = await this.projectStore.open(button.dataset.openProject, { requestPermission: true });
                if (project) this.setWorkspace('build');
            }));
            view.querySelectorAll('[data-duplicate-project]').forEach((button) => button.addEventListener('click', () => this.projectStore.duplicate(button.dataset.duplicateProject)));
            view.querySelectorAll('[data-delete-project]').forEach((button) => button.addEventListener('click', () => this.confirmDeleteProject(button.dataset.deleteProject)));
            view.querySelectorAll('[data-migrate-project]').forEach((button) => button.addEventListener('click', async () => {
                button.disabled = true;
                try {
                    const project = await this.projectStore.migrateLegacyProject(button.dataset.migrateProject);
                    if (project) { this.toast(`${project.name} moved to its folder`); this.setWorkspace('build'); }
                } catch (error) { this.toast(`Migration failed: ${error.message}`); }
                finally { button.disabled = false; }
            }));
            view.querySelectorAll('[data-delete-legacy-project]').forEach((button) => button.addEventListener('click', () => {
                const project = legacyProjects.find((item) => item.id === button.dataset.deleteLegacyProject);
                if (project) this.confirmLegacyDelete(project);
            }));
            view.querySelector('[data-dismiss-onboarding]')?.addEventListener('click', () => {
                this.settings.onboardingDismissed = true;
                this.saveSettings();
                this.renderProjects();
            });
        }

        onboardingMarkup() {
            return `<section class="uaw-project-journey">
                <div class="uaw-project-journey__intro"><p>Your workflow</p><h2>From project to verified run</h2></div>
                <ol><li class="done"><span>1</span><div><small>Project</small><strong>Create or open</strong></div></li><li><span>2</span><div><small>Define</small><strong>Describe the process</strong></div></li><li><span>3</span><div><small>Script</small><strong>Add behaviour</strong></div></li><li><span>4</span><div><small>Simulate</small><strong>Run and validate</strong></div></li></ol>
                <button class="uaw-icon-button" type="button" data-dismiss-onboarding title="Dismiss">${this.icon('close')}</button>
            </section>`;
        }

        async confirmDeleteProject(projectId) {
            const project = await this.projectStore?.getRegistryRecord?.(projectId);
            const dialog = this.shell?.querySelector('#uaw-confirm-dialog');
            if (!project || !dialog) return;
            dialog.querySelector('#uaw-confirm-title').textContent = 'Remove from Projects?';
            dialog.querySelector('#uaw-confirm-copy').textContent = `Remove “${project.name}” from this browser’s project list? Its folder and files will stay on disk and can be opened again later.`;
            dialog.hidden = false;
            const confirm = dialog.querySelector('[data-confirm-delete]');
            confirm.textContent = 'Remove Project';
            confirm.onclick = async () => {
                confirm.disabled = true;
                await this.projectStore.delete(projectId);
                confirm.disabled = false;
                this.closeDeleteConfirmation();
                this.toast('Project removed from this browser; local files were kept');
            };
            requestAnimationFrame(() => confirm.focus());
            window.UAWMotion?.dialogEnter?.('.uaw-confirm-card');
        }

        confirmLegacyDelete(project) {
            const dialog = this.shell?.querySelector('#uaw-confirm-dialog');
            if (!dialog || !project) return;
            dialog.querySelector('#uaw-confirm-title').textContent = 'Delete browser copy?';
            dialog.querySelector('#uaw-confirm-copy').textContent = `Delete “${project.name || 'Recovered project'}” from legacy browser storage? This copy cannot be restored unless it was exported elsewhere.`;
            const confirm = dialog.querySelector('[data-confirm-delete]');
            confirm.textContent = 'Delete browser copy';
            dialog.hidden = false;
            confirm.onclick = async () => {
                confirm.disabled = true;
                try {
                    const deleted = await this.projectStore.deleteLegacyProject(project.id);
                    if (deleted) this.toast(`${project.name || 'Project'} deleted from browser storage`);
                    this.closeDeleteConfirmation();
                } catch (error) { this.toast(`Delete failed: ${error.message}`); }
                finally { confirm.disabled = false; }
            };
            requestAnimationFrame(() => confirm.focus());
            window.UAWMotion?.dialogEnter?.('.uaw-confirm-card');
        }

        closeDeleteConfirmation() {
            const dialog = this.shell?.querySelector('#uaw-confirm-dialog');
            if (dialog) dialog.hidden = true;
        }

        readStateVisualDocument() {
            const activeEditor = window.monacoEditor || window.editor;
            try {
                const root = JSON.parse(activeEditor?.getValue?.() || '{}');
                const simulation = root.simulation || root;
                return { root, simulation, editor: activeEditor };
            } catch (_error) {
                return null;
            }
        }

        updateStateVisualDocument(mutator) {
            const documentState = this.readStateVisualDocument();
            if (!documentState?.simulation || !documentState.editor) return false;
            if (!documentState.simulation.state_libraries || Array.isArray(documentState.simulation.state_libraries)) {
                documentState.simulation.state_libraries = {};
            }
            mutator(documentState.simulation);
            documentState.editor.setValue(JSON.stringify(documentState.root, null, 2));
            window.dispatchEvent(new CustomEvent('uaw:state-visuals-changed'));
            return true;
        }

        usedStatesForLibrary(simulation, libraryId) {
            const used = new Set();
            const objects = simulation.world?.objects || simulation.objects || [];
            const objectIds = new Set(objects.filter(object => object?.state_library === libraryId).map(object => object.id));
            objects.forEach(object => {
                if (object?.state_library === libraryId && typeof object.properties?.state === 'string') used.add(object.properties.state);
            });
            const tasks = simulation.process?.tasks || simulation.tasks || [];
            tasks.forEach(task => (task.interactions || []).forEach(interaction => {
                if (!objectIds.has(interaction?.target_id || interaction?.object_id)) return;
                const operation = interaction.property_changes?.state;
                ['from', 'to', 'set'].forEach(key => {
                    if (typeof operation?.[key] === 'string') used.add(operation[key]);
                });
            }));
            return used;
        }

        scheduleAssetsRender() {
            clearTimeout(this.assetsRenderTimer);
            this.assetsRenderTimer = setTimeout(() => this.renderAssets(), 80);
        }

        hydrateAssetPreviews(container) {
            const images = [...(container?.querySelectorAll?.('img[data-asset-preview]') || [])];
            if (!images.length) return;
            const load = async image => {
                if (!image?.isConnected || image.dataset.assetLoaded === 'true') return;
                image.dataset.assetLoaded = 'true';
                const source = await window.AssetManager?.ensureAssetThumbnail?.(image.dataset.assetPreview, 256);
                if (source && image.isConnected) image.src = source;
            };
            if (!('IntersectionObserver' in window)) {
                images.forEach(load);
                return;
            }
            if (!this.assetPreviewObserver) {
                this.assetPreviewObserver = new IntersectionObserver(entries => entries.forEach(entry => {
                    if (!entry.isIntersecting) return;
                    this.assetPreviewObserver?.unobserve(entry.target);
                    load(entry.target);
                }), { rootMargin: '160px' });
            }
            images.forEach(image => this.assetPreviewObserver.observe(image));
        }

        async uploadStateVisualAssets(files) {
            for (const file of Array.from(files || [])) {
                if (!file.type.startsWith('image/')) continue;
                const data = await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result);
                    reader.onerror = () => reject(reader.error);
                    reader.readAsDataURL(file);
                });
                const filenameId = window.WorkSpecStateVisuals?.assetIdFromFilename?.(file.name) || '';
                const id = filenameId || window.AssetManager?.generateUUID?.() || `asset_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
                await this.projectStore?.putAsset?.({ id, name: file.name, mimeType: file.type, data });
            }
        }

        async renderAssets() {
            const view = this.shell?.querySelector('#uaw-assets-view');
            if (!view) return;
            clearTimeout(this.assetsRenderTimer);
            const renderToken = ++this.assetsRenderToken;
            const assets = await this.projectStore?.listAssetMetadata?.() || [];
            if (renderToken !== this.assetsRenderToken || this.workspace !== 'assets') return;
            this.assetPreviewObserver?.disconnect();
            this.assetPreviewObserver = null;
            const imageAssets = assets.filter(asset => String(asset.mimeType || '').startsWith('image/'));
            const displayedAssets = assets.slice(0, this.assetVisibleCount);
            const documentState = this.readStateVisualDocument();
            const libraries = documentState?.simulation?.state_libraries || {};
            const libraryIds = Object.keys(libraries).sort();
            if (!libraryIds.includes(this.selectedStateLibraryId)) this.selectedStateLibraryId = libraryIds[0] || '';
            const selectedLibrary = libraries[this.selectedStateLibraryId];
            const appearanceIds = Object.keys(selectedLibrary?.appearances || {}).sort();
            if (!appearanceIds.includes(this.selectedStateAppearanceId)) this.selectedStateAppearanceId = appearanceIds[0] || '';
            const selectedAppearance = selectedLibrary?.appearances?.[this.selectedStateAppearanceId] || {};
            const states = Array.isArray(selectedLibrary?.states) ? selectedLibrary.states : [];
            const assetById = new Map(assets.map(asset => [asset.id, asset]));

            const stateRows = states.map(state => {
                const configuredAssetId = selectedAppearance[state] || '';
                const assetId = window.AssetManager?.normalizeId?.(configuredAssetId) || configuredAssetId;
                const asset = assetById.get(assetId);
                return `
                    <div class="uaw-state-mapping" data-state="${escapeHTML(state)}">
                        <code>${escapeHTML(state)}</code>
                        <div class="uaw-state-mapping__asset">
                            ${asset ? `<img data-asset-preview="${escapeHTML(asset.id)}" loading="lazy" decoding="async" alt="" /><span>${escapeHTML(asset.name || asset.id)}</span>` : `<span class="${assetId ? 'is-missing' : ''}">${assetId ? `Missing · ${escapeHTML(assetId)}` : 'Emoji fallback'}</span>`}
                        </div>
                        <button type="button" data-pick-state-asset="${escapeHTML(state)}">${configuredAssetId ? 'Change' : 'Choose'}</button>
                        ${configuredAssetId ? `<button type="button" class="uaw-button-quiet" data-clear-state-asset="${escapeHTML(state)}">Clear</button>` : ''}
                    </div>
                `;
            }).join('');

            const libraryItems = libraryIds.map(id => {
                const library = libraries[id];
                const appearanceCount = Object.keys(library?.appearances || {}).length;
                return `<button type="button" class="uaw-state-library-item ${id === this.selectedStateLibraryId ? 'is-active' : ''}" data-state-library-item="${escapeHTML(id)}"><code>${escapeHTML(id)}</code><span>${library?.states?.length || 0} states · ${appearanceCount}</span></button>`;
            }).join('');
            const appearanceItems = appearanceIds.map(id => `<button type="button" class="uaw-state-appearance-item ${id === this.selectedStateAppearanceId ? 'is-active' : ''}" data-state-appearance-item="${escapeHTML(id)}">${escapeHTML(id)}</button>`).join('');

            view.innerHTML = `
                <div class="uaw-view-heading"><div><p class="uaw-eyebrow">PROJECT CONTENT</p><h1>Assets</h1><p>Media is stored with this local project and referenced from WorkSpec by ID. File bytes never enter the JSON.</p></div><div><button type="button" data-upload-assets>Upload images</button><input type="file" accept="image/*" multiple hidden data-asset-file-input /></div></div>
                <section class="uaw-state-visuals" aria-labelledby="uaw-state-visuals-title">
                    <header class="uaw-state-visuals__bar"><h2 id="uaw-state-visuals-title">State visuals</h2></header>
                    <div class="uaw-state-workbench">
                        <aside class="uaw-state-library-rail">
                            <div class="uaw-state-pane-heading"><strong>Libraries</strong><button type="button" data-show-new-state-library aria-label="New library" title="New library">+</button></div>
                            <div class="uaw-state-library-list">
                                ${libraryItems}
                                <form class="uaw-state-library-create" data-new-state-library-form hidden><input name="library_id" required pattern="[a-z][a-z0-9_]{0,249}" placeholder="library_id" aria-label="Library ID" /><div><button type="submit">Create</button><button type="button" class="uaw-button-quiet" data-cancel-new-state-library>Cancel</button></div></form>
                                ${libraryItems ? '' : '<p>No libraries</p>'}
                            </div>
                        </aside>
                        <div class="uaw-state-library-editor">
                            ${selectedLibrary ? `
                                <div class="uaw-state-library-editor__top"><strong><code>${escapeHTML(this.selectedStateLibraryId)}</code></strong><label><span>States</span><input type="text" data-state-list value="${escapeHTML(states.join(', '))}" placeholder="available, working, break" /></label></div>
                                <div class="uaw-state-appearance-bar"><strong>Appearances in <code>${escapeHTML(this.selectedStateLibraryId)}</code></strong><div class="uaw-state-appearance-list">${appearanceItems}<button type="button" data-new-state-appearance>+ Appearance</button></div></div>
                                <form class="uaw-state-appearance-create" data-new-state-appearance-form hidden><label>New in <code>${escapeHTML(this.selectedStateLibraryId)}</code><input name="appearance_id" required pattern="[a-z][a-z0-9_]{0,249}" placeholder="appearance_id" /></label><button type="submit">Create</button><button type="button" class="uaw-button-quiet" data-cancel-new-state-appearance>Cancel</button></form>
                                <div class="uaw-state-mapping-head"><span>State</span><span>Asset</span><span>Mapping</span></div>
                                <div class="uaw-state-mappings">${this.selectedStateAppearanceId ? stateRows : '<div class="uaw-state-editor-empty"><strong>No appearance selected</strong><span>Create one inside this library.</span></div>'}</div>
                            ` : '<div class="uaw-state-editor-empty"><strong>Select or add a library</strong><span>Libraries are peers; appearances live inside them.</span></div>'}
                        </div>
                    </div>
                </section>
                <div class="uaw-asset-section-heading"><div><p class="uaw-eyebrow">UPLOADED FILES</p><h2>Project assets</h2></div><span>${assets.length} file${assets.length === 1 ? '' : 's'}</span></div>
                <div class="uaw-asset-grid">${displayedAssets.map(asset => {
                    const kind = String(asset.mimeType || '').startsWith('image/') ? 'Image' : String(asset.mimeType || '').startsWith('audio/') ? 'Audio' : 'File';
                    return `<article class="uaw-asset-card" data-asset-id="${escapeHTML(asset.id)}"><div class="uaw-asset-preview">${kind === 'Image' ? `<img data-asset-preview="${escapeHTML(asset.id)}" loading="lazy" decoding="async" alt="" />` : this.icon('assets')}</div><strong>${escapeHTML(asset.name || asset.id)}</strong><span>${kind} · ID ${escapeHTML(asset.id)}</span><button type="button" data-remove-asset="${escapeHTML(asset.id)}">Remove</button></article>`;
                }).join('') || '<div class="uaw-empty-state"><strong>No project assets</strong><p>Upload images here or add media from Displays. WorkSpec stores only the asset ID.</p></div>'}</div>
                ${displayedAssets.length < assets.length ? `<div class="uaw-asset-load-more"><button type="button" data-load-more-assets>Load ${Math.min(60, assets.length - displayedAssets.length)} more</button><span>${displayedAssets.length} of ${assets.length} shown</span></div>` : ''}
                <div class="uaw-state-asset-picker" hidden role="dialog" aria-modal="true" aria-label="Choose an uploaded image"><div class="uaw-state-asset-picker__panel"><div><strong>Choose an uploaded image</strong><input type="search" data-asset-picker-search placeholder="Search assets" aria-label="Search uploaded images" /><button type="button" data-close-state-asset-picker aria-label="Close">×</button></div><div class="uaw-state-asset-picker__grid"></div></div></div>
            `;

            this.hydrateAssetPreviews(view);

            const fileInput = view.querySelector('[data-asset-file-input]');
            view.querySelector('[data-upload-assets]')?.addEventListener('click', () => fileInput?.click());
            fileInput?.addEventListener('change', async () => {
                await this.uploadStateVisualAssets(fileInput.files);
                await this.renderAssets();
            });
            view.querySelectorAll('[data-state-library-item]').forEach(button => button.addEventListener('click', () => {
                this.selectedStateLibraryId = button.dataset.stateLibraryItem;
                this.selectedStateAppearanceId = '';
                this.renderAssets();
            }));
            const newLibraryForm = view.querySelector('[data-new-state-library-form]');
            view.querySelector('[data-show-new-state-library]')?.addEventListener('click', () => {
                newLibraryForm.hidden = false;
                newLibraryForm.querySelector('input')?.focus();
            });
            view.querySelector('[data-cancel-new-state-library]')?.addEventListener('click', () => { newLibraryForm.hidden = true; });
            newLibraryForm?.addEventListener('submit', event => {
                event.preventDefault();
                const id = String(new FormData(newLibraryForm).get('library_id') || '').trim();
                if (!/^[a-z][a-z0-9_]{0,249}$/.test(id) || libraries[id]) return this.toast('Use a unique snake_case State Library ID');
                this.updateStateVisualDocument(simulation => { simulation.state_libraries[id] = { states: ['available'], appearances: {} }; });
                this.selectedStateLibraryId = id;
                this.selectedStateAppearanceId = '';
                this.renderAssets();
            });
            view.querySelector('[data-state-list]')?.addEventListener('change', event => {
                const nextStates = [...new Set(event.target.value.split(',').map(value => value.trim()).filter(Boolean))];
                if (!nextStates.length) return this.toast('A State Library needs at least one state');
                const usedStates = this.usedStatesForLibrary(documentState.simulation, this.selectedStateLibraryId);
                const removedInUse = [...usedStates].filter(state => !nextStates.includes(state));
                if (removedInUse.length) {
                    this.toast(`Cannot remove states currently in use: ${removedInUse.join(', ')}`);
                    return this.renderAssets();
                }
                this.updateStateVisualDocument(simulation => {
                    const library = simulation.state_libraries[this.selectedStateLibraryId];
                    library.states = nextStates;
                    Object.values(library.appearances || {}).forEach(mapping => Object.keys(mapping).forEach(state => {
                        if (!nextStates.includes(state)) delete mapping[state];
                    }));
                });
                this.renderAssets();
            });
            view.querySelectorAll('[data-state-appearance-item]').forEach(button => button.addEventListener('click', () => {
                this.selectedStateAppearanceId = button.dataset.stateAppearanceItem;
                this.renderAssets();
            }));
            const newAppearanceForm = view.querySelector('[data-new-state-appearance-form]');
            view.querySelector('[data-new-state-appearance]')?.addEventListener('click', () => {
                newAppearanceForm.hidden = false;
                newAppearanceForm.querySelector('input')?.focus();
            });
            view.querySelector('[data-cancel-new-state-appearance]')?.addEventListener('click', () => { newAppearanceForm.hidden = true; });
            newAppearanceForm?.addEventListener('submit', event => {
                event.preventDefault();
                const id = String(new FormData(newAppearanceForm).get('appearance_id') || '').trim();
                if (!/^[a-z][a-z0-9_]{0,249}$/.test(id) || selectedLibrary?.appearances?.[id]) return this.toast('Use a unique snake_case appearance ID');
                this.updateStateVisualDocument(simulation => {
                    const library = simulation.state_libraries[this.selectedStateLibraryId];
                    if (!library.appearances) library.appearances = {};
                    library.appearances[id] = {};
                });
                this.selectedStateAppearanceId = id;
                this.renderAssets();
            });
            const picker = view.querySelector('.uaw-state-asset-picker');
            const pickerGrid = picker?.querySelector('.uaw-state-asset-picker__grid');
            const pickerSearch = picker?.querySelector('[data-asset-picker-search]');
            const renderPickerItems = (query = '') => {
                const normalizedQuery = String(query).trim().toLowerCase();
                const matches = imageAssets.filter(asset => !normalizedQuery || `${asset.name || ''} ${asset.id}`.toLowerCase().includes(normalizedQuery));
                const visibleMatches = matches.slice(0, 80);
                pickerGrid.innerHTML = visibleMatches.map(asset => `<button type="button" data-state-asset-id="${escapeHTML(asset.id)}"><img data-asset-preview="${escapeHTML(asset.id)}" loading="lazy" decoding="async" alt="" /><span>${escapeHTML(asset.name || asset.id)}</span></button>`).join('')
                    || '<p>No matching uploaded images.</p>';
                if (matches.length > visibleMatches.length) pickerGrid.insertAdjacentHTML('beforeend', `<p class="uaw-state-asset-picker__limit">Showing 80 of ${matches.length}. Search to narrow the list.</p>`);
                this.hydrateAssetPreviews(pickerGrid);
            };
            view.querySelectorAll('[data-pick-state-asset]').forEach(button => button.addEventListener('click', () => {
                this.stateVisualPickerState = button.dataset.pickStateAsset;
                renderPickerItems(pickerSearch?.value);
                picker.hidden = false;
                pickerSearch?.focus();
            }));
            view.querySelector('[data-close-state-asset-picker]')?.addEventListener('click', () => { picker.hidden = true; });
            pickerSearch?.addEventListener('input', event => renderPickerItems(event.target.value));
            pickerGrid?.addEventListener('click', event => {
                const button = event.target.closest('[data-state-asset-id]');
                if (!button) return;
                this.updateStateVisualDocument(simulation => {
                    simulation.state_libraries[this.selectedStateLibraryId].appearances[this.selectedStateAppearanceId][this.stateVisualPickerState] = button.dataset.stateAssetId;
                });
                this.renderAssets();
            });
            view.querySelectorAll('[data-clear-state-asset]').forEach(button => button.addEventListener('click', () => {
                this.updateStateVisualDocument(simulation => {
                    delete simulation.state_libraries[this.selectedStateLibraryId].appearances[this.selectedStateAppearanceId][button.dataset.clearStateAsset];
                });
                this.renderAssets();
            }));
            view.querySelectorAll('[data-remove-asset]').forEach(button => button.addEventListener('click', async () => {
                await this.projectStore.removeAsset(button.dataset.removeAsset);
                window.AssetManager?.releaseAsset?.(button.dataset.removeAsset);
            }));
            view.querySelector('[data-load-more-assets]')?.addEventListener('click', () => {
                this.assetVisibleCount += 60;
                this.renderAssets();
            });
            window.UAWMotion?.listEnter?.('.uaw-asset-card');
        }

        renderSettings() {
            const view = this.shell?.querySelector('#uaw-settings-view');
            if (!view) return;
            view.innerHTML = `
                <header class="uaw-settings-heading"><div><h1>Settings</h1><p>Preferences for this browser and local workspace.</p></div></header>
                <div class="uaw-settings-layout">
                    <div class="uaw-settings-surface">
                        <section class="uaw-settings-section" aria-labelledby="uaw-source-layout-heading">
                            <div><h2 id="uaw-source-layout-heading">Define Source layout</h2><p>Choose how declarative WorkSpec JSON appears beside Define views. These settings do not affect the Script editor.</p></div>
                            <fieldset class="uaw-choice-grid" id="uaw-source-dock-choices" aria-label="Source layout">
                                ${this.sourceChoice('split-left', 'Split left', 'Source beside the canvas')}
                                ${this.sourceChoice('split-right', 'Split right', 'Canvas before source')}
                                ${this.sourceChoice('split-bottom', 'Split below', 'Source below the canvas')}
                                ${this.sourceChoice('dedicated', 'Dedicated pane', 'Source uses the full stage')}
                                ${this.sourceChoice('hidden', 'Hidden in Define', 'Open source only when needed')}
                            </fieldset>
                        </section>
                        <section class="uaw-settings-section" aria-labelledby="uaw-agent-heading">
                            <div><h2 id="uaw-agent-heading">Codex Agent</h2><p>Connect the optional Agent to a bridge running on this machine.</p></div>
                            <div class="uaw-connection-card"><div><strong>Local bridge</strong><small>http://127.0.0.1:4317</small></div><button type="button" data-uaw-command="agent.open">Configure</button></div>
                        </section>
                    </div>
                </div>
            `;
            view.querySelectorAll('input[name="source-dock"]').forEach((input) => input.addEventListener('change', () => this.setSourceDock(input.value)));
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
            this.requestProjectCreation({ kind: 'blank', name: 'Untitled project', sourceLabel: 'Blank WorkSpec' });
        }

        requestProjectCreation(options = {}) {
            const dialog = this.shell?.querySelector('#uaw-project-setup-dialog');
            if (!dialog) return false;
            this.closeProjectSetup();
            return new Promise((resolve) => {
                this.pendingProjectSetup = {
                    kind: options.kind === 'template' ? 'template' : 'blank',
                    name: String(options.name || 'Untitled project'),
                    workSpec: options.workSpec || '',
                    resolve
                };
                dialog.querySelector('#uaw-project-setup-name').value = this.pendingProjectSetup.name;
                dialog.querySelector('#uaw-project-setup-source').textContent = options.sourceLabel || (this.pendingProjectSetup.kind === 'template' ? 'Template' : 'Blank WorkSpec');
                dialog.hidden = false;
                requestAnimationFrame(() => {
                    const input = dialog.querySelector('#uaw-project-setup-name');
                    input.focus();
                    input.select();
                    window.UAWMotion?.dialogEnter?.('.uaw-project-setup-card');
                });
            });
        }

        closeProjectSetup() {
            const dialog = this.shell?.querySelector('#uaw-project-setup-dialog');
            if (dialog) dialog.hidden = true;
            this.pendingProjectSetup?.resolve?.(null);
            this.pendingProjectSetup = null;
        }

        async submitProjectSetup(event) {
            event.preventDefault();
            const pending = this.pendingProjectSetup;
            const name = this.shell?.querySelector('#uaw-project-setup-name')?.value.trim();
            if (!pending || !name) return;
            const submit = event.submitter || event.currentTarget.querySelector('[type="submit"]');
            submit.disabled = true;
            submit.textContent = 'Choose location…';
            try {
                const project = pending.kind === 'template'
                    ? await this.projectStore?.createFromTemplate(name, pending.workSpec)
                    : await this.projectStore?.createBlank(name);
                if (!project) return;
                this.shell.querySelector('#uaw-project-setup-dialog').hidden = true;
                this.pendingProjectSetup = null;
                pending.resolve?.(project);
                this.setWorkspace('build');
            } catch (error) {
                this.toast(`Could not create project: ${error.message}`);
            } finally {
                submit.disabled = false;
                submit.textContent = 'Choose location…';
            }
        }

        async openProjectFolder() {
            try {
                const project = await this.projectStore?.openFolder();
                if (project) this.setWorkspace('build');
            } catch (error) { this.toast(`Could not open folder: ${error.message}`); }
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
                this.closeObjectMenu();
                this.closeDeleteConfirmation();
                this.closeCustomObjectTypeDialog();
                this.closeProjectSetup();
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
            if (/^[1-5]$/.test(event.key) && !event.altKey && !modifier) {
                const ids = ['projects', 'build', 'script', 'run', 'assets'];
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
