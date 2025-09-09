// Universal Automation Wiki - Playground App Bootstrap
// Main initialization and coordination for the simulation playground

(function() {
    'use strict';
    
    if (!window.UAW) {
        console.error('UAW namespace not found! Make sure core modules are loaded first.');
        return;
    }
    
    /**
     * Playground application bootstrap
     */
    class PlaygroundApp {
        constructor() {
            this.initialized = false;
            this.editor = null;
            this.currentSimulation = null;
            this.isMetricsMode = false;
            
            // Modular editors
            this.spaceEditor = null;
            this.timelineEditor = null;
            
            // Initialize when DOM is ready
            window.UAW.whenReady(() => this.initialize());
        }
        
        /**
         * Initialize the playground application
         */
        async initialize() {
            if (this.initialized) return;
            
            try {
                console.log('UAW: Initializing Playground App...');
                // Ensure Monaco is loadable when using AMD loader only
                if (typeof window.require === 'function' && !window.__uawMonacoConfigured) {
                    try {
                        window.require.config({ paths: { vs: 'https://unpkg.com/monaco-editor@0.44.0/min/vs' } });
                        window.__uawMonacoConfigured = true;
                    } catch (e) {
                        console.warn('UAW: Unable to configure Monaco loader (non-fatal):', e);
                    }
                }
                
                // Load required data
                await this.loadInitialData();
                
                // Initialize Monaco editor
                await this.initializeEditor();
                
                // Initialize UI components
                this.initializeUI();
                
                // Initialize modular editors
                this.initializeEditors();
                
                // Set up event handlers
                this.setupEventHandlers();
                
                // Load sample data if available
                this.loadDefaultSample();
                
                this.initialized = true;
                window.UAW._initialized = true;
                
                console.log('UAW: Playground App initialized successfully');
                
                // Emit ready event
                window.UAW.Events.emit('app:ready');
                
            } catch (error) {
                console.error('Failed to initialize Playground App:', error);
            }
        }
        
        /**
         * Load initial data (metrics, tutorial, simulation library)
         */
        async loadInitialData() {
            try {
                console.log('UAW: Loading initial data...');
                
                // Load data in parallel
                const loadPromises = [
                    this.loadMetricsCatalog(),
                    this.loadTutorialData(),
                    this.loadSimulationLibrary()
                ];
                
                await Promise.all(loadPromises);
                
                console.log('UAW: Initial data loaded');
                
            } catch (error) {
                console.error('Failed to load initial data:', error);
                throw error;
            }
        }
        
        /**
         * Load metrics catalog
         */
        async loadMetricsCatalog() {
            try {
                await window.UAW.Metrics.loadCatalog();
                return true;
            } catch (error) {
                console.error('Failed to load metrics catalog:', error);
                return false;
            }
        }
        
        /**
         * Load tutorial data
         */
        async loadTutorialData() {
            try {
                const response = await fetch('/assets/static/tutorial-content.json');
                if (!response.ok) {
                    throw new Error(`Failed to fetch tutorial content: ${response.statusText}`);
                }
                
                const tutorialData = await response.json();
                window.UAW.compatibility.tutorialData = tutorialData;
                
                // Set global for compatibility with legacy components
                if (!window.tutorialData) {
                    window.tutorialData = tutorialData;
                }
                
                console.log('UAW: Tutorial data loaded');
                return tutorialData;
                
            } catch (error) {
                console.error('Failed to load tutorial data:', error);
                return null;
            }
        }
        
        /**
         * Load simulation library
         */
        async loadSimulationLibrary() {
            try {
                const response = await fetch('/assets/static/simulation-library.json');
                if (!response.ok) {
                    throw new Error(`Failed to fetch simulation library: ${response.statusText}`);
                }
                
                const libraryData = await response.json();
                window.UAW.compatibility.simulationLibrary = libraryData;
                
                // Set global for compatibility with legacy components
                if (!window.simulationLibrary) {
                    window.simulationLibrary = libraryData;
                }
                
                // Populate simulation library dropdown
                this.populateSimulationLibrary(libraryData);
                
                console.log('UAW: Simulation library loaded');
                return libraryData;
                
            } catch (error) {
                console.error('Failed to load simulation library:', error);
                return null;
            }
        }
        
        /**
         * Populate simulation library dropdown
         */
        populateSimulationLibrary(libraryData) {
            const dropdown = window.UAW.DOM.byId('simulation-library-dropdown');
            if (!dropdown || !libraryData) return;
            
            window.UAW.DOM.clear(dropdown);
            
            libraryData.simulations.forEach(simulation => {
                const option = window.UAW.DOM.create('a', {
                    href: '#',
                    textContent: simulation.name,
                    title: `${simulation.description} (${simulation.complexity})`
                });
                
                window.UAW.DOM.on(option, 'click', (e) => {
                    e.preventDefault();
                    this.loadSimulationFromLibrary(simulation.id);
                });
                
                dropdown.appendChild(option);
            });
        }
        
        /**
         * Load simulation from library
         */
        loadSimulationFromLibrary(simulationId) {
            const sampleData = window.UAW.Storage.loadSample(simulationId);
            if (sampleData) {
                this.loadSimulation(sampleData);
            }
        }
        
        /**
         * Initialize Monaco editor
         */
        async initializeEditor() {
            return new Promise((resolve, reject) => {
                const attemptCreate = () => this.createEditor().then(resolve).catch(reject);
                if (typeof monaco !== 'undefined') {
                    attemptCreate();
                    return;
                }
                const start = Date.now();
                const fallbackAfterMs = 4000;
                // If AMD loader is present, request monaco explicitly
                if (typeof window.require === 'function') {
                    try {
                        window.require(['vs/editor/editor.main'], () => {
                            attemptCreate();
                        }, (err) => {
                            console.error('UAW: Monaco AMD load error', err);
                            // Fallback to polling in case monaco is exposed later
                            const poll = () => {
                                if (typeof monaco !== 'undefined') return attemptCreate();
                                if (Date.now() - start > fallbackAfterMs) {
                                    console.warn('UAW: Monaco not available, using fallback editor');
                                    this.createFallbackEditor();
                                    resolve(this.editor);
                                    return;
                                }
                                setTimeout(poll, 100);
                            };
                            poll();
                        });
                        return;
                    } catch (e) {
                        console.warn('UAW: require() call for Monaco failed, will poll:', e);
                    }
                }
                // Final fallback: poll
                const checkMonaco = () => {
                    if (typeof monaco !== 'undefined') {
                        attemptCreate();
                    } else {
                        if (Date.now() - start > fallbackAfterMs) {
                            console.warn('UAW: Monaco not available, using fallback editor');
                            this.createFallbackEditor();
                            resolve(this.editor);
                            return;
                        }
                        setTimeout(checkMonaco, 100);
                    }
                };
                checkMonaco();
            });
        }
        
        /**
         * Create Monaco editor instance
         */
        async createEditor() {
            const editorContainer = window.UAW.DOM.byId('json-editor');
            if (!editorContainer) {
                throw new Error('Editor container not found');
            }
            
            this.editor = monaco.editor.create(editorContainer, {
                value: '{\n  "simulation": {\n    "meta": {\n      "id": "new_simulation",\n      "article_title": "New Simulation"\n    },\n    "objects": [],\n    "tasks": []\n  }\n}',
                language: 'json',
                theme: 'vs-light',
                automaticLayout: true,
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                wordWrap: 'on'
            });
            
            // Set global for compatibility with legacy components
            if (!window.editor) {
                window.editor = this.editor;
            }
            
            // Set up editor change handler with debouncing
            const debouncedValidation = window.UAW.Util.debounce(() => {
                this.validateCurrentData();
            }, 500);
            
            this.editor.onDidChangeModelContent(debouncedValidation);
            
            console.log('UAW: Monaco editor initialized');
            return this.editor;
        }

        /**
         * Create a minimal fallback editor when Monaco isn't available
         */
        createFallbackEditor() {
            const editorContainer = window.UAW.DOM.byId('json-editor');
            if (!editorContainer) return null;
            // Clear container
            editorContainer.innerHTML = '';
            const textarea = document.createElement('textarea');
            textarea.style.width = '100%';
            textarea.style.height = '100%';
            textarea.style.border = 'none';
            textarea.style.outline = 'none';
            textarea.style.fontFamily = 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';
            textarea.style.fontSize = '12px';
            textarea.value = '{\n  "simulation": {\n    "meta": {\n      "id": "new_simulation",\n      "article_title": "New Simulation"\n    },\n    "objects": [],\n    "tasks": []\n  }\n}';
            editorContainer.appendChild(textarea);
            const listeners = [];
            const wrapper = {
                getValue: () => textarea.value,
                setValue: (v) => { textarea.value = v; },
                onDidChangeModelContent: (handler) => {
                    const h = () => handler();
                    textarea.addEventListener('input', h);
                    listeners.push(() => textarea.removeEventListener('input', h));
                    return { dispose: () => textarea.removeEventListener('input', h) };
                },
                focus: () => textarea.focus()
            };
            this.editor = wrapper;
            // Expose global for compatibility
            if (!window.editor) window.editor = this.editor;
            console.warn('UAW: Fallback editor initialized');
            return this.editor;
        }
        
        /**
         * Initialize UI components
         */
        initializeUI() {
            this.setupTabs();
            this.setupButtons();
            this.setupWelcomeOverlay();
        }
        
        /**
         * Initialize modular editors
         */
        initializeEditors() {
            try {
                // Initialize Space Editor
                const spaceCanvas = window.UAW.DOM.byId('space-canvas');
                const propsPanel = window.UAW.DOM.byId('properties-panel-content');
                
                if (spaceCanvas && propsPanel && this.editor) {
                    this.spaceEditor = new window.UAW.SpaceEditor(spaceCanvas, propsPanel, this.editor);
                    console.log('UAW PlaygroundApp: Space editor initialized');
                } else {
                    console.warn('UAW PlaygroundApp: Space editor elements not found');
                }
                
                // Initialize Timeline Editor
                this.timelineEditor = new window.UAW.TimelineEditor();
                console.log('UAW PlaygroundApp: Timeline editor initialized');
                
            } catch (error) {
                console.error('Failed to initialize modular editors:', error);
            }
        }
        
        /**
         * Set up tab switching functionality
         */
        setupTabs() {
            const tabButtons = window.UAW.DOM.selectAll('.tab-btn');
            const tabContents = window.UAW.DOM.selectAll('.tab-content');
            
            tabButtons.forEach(button => {
                window.UAW.DOM.on(button, 'click', () => {
                    const targetTab = button.dataset.tab;
                    
                    // Remove active class from all
                    tabButtons.forEach(btn => window.UAW.DOM.removeClass(btn, 'active'));
                    tabContents.forEach(content => window.UAW.DOM.removeClass(content, 'active'));
                    
                    // Add active class to current
                    window.UAW.DOM.addClass(button, 'active');
                    const targetContent = window.UAW.DOM.byId(`${targetTab}-tab`) || window.UAW.DOM.byId(`${targetTab}`);
                    if (targetContent) {
                        window.UAW.DOM.addClass(targetContent, 'active');
                    }
                });
            });
        }
        
        /**
         * Set up button event handlers
         */
        setupButtons() {
            // Format JSON button
            const formatBtn = window.UAW.DOM.byId('format-json-btn');
            if (formatBtn) {
                window.UAW.DOM.on(formatBtn, 'click', () => this.formatJSON());
            }
            
            // Clear editor button
            const clearBtn = window.UAW.DOM.byId('clear-editor-btn');
            if (clearBtn) {
                window.UAW.DOM.on(clearBtn, 'click', () => this.clearEditor());
            }
        }
        
        /**
         * Set up welcome overlay
         */
        setupWelcomeOverlay() {
            const overlay = window.UAW.DOM.byId('welcome-overlay');
            const continueBtn = window.UAW.DOM.byId('welcome-continue-btn');
            const dontShowAgain = window.UAW.DOM.byId('dont-show-again');
            
            if (overlay && continueBtn) {
                // Check if user has seen welcome before
                if (window.UAW.Storage.loadLocal('uaw-playground-welcome-seen')) {
                    window.UAW.DOM.hide(overlay);
                }
                const close = () => {
                    window.UAW.DOM.hide(overlay);
                    if (dontShowAgain && dontShowAgain.checked) {
                        window.UAW.Storage.saveLocal('uaw-playground-welcome-seen', true);
                    }
                };
                // Primary close button
                window.UAW.DOM.on(continueBtn, 'click', close);
                // Close on overlay click outside the dialog
                window.UAW.DOM.on(overlay, 'click', (e) => {
                    if (e.target === overlay) close();
                });
                // Close on Escape
                window.UAW.DOM.on(document, 'keydown', (e) => {
                    if (e.key === 'Escape' && overlay.style.display !== 'none') close();
                });
            }
        }
        
        /**
         * Set up global event handlers
         */
        setupEventHandlers() {
            // Listen for model changes
            window.UAW.Events.on('model:loaded', (data) => {
                this.currentSimulation = data;
                this.updateEditorFromModel();
            });
            
            // Listen for validation events
            window.UAW.Events.on('validation:complete', (results) => {
                this.updateValidationUI(results);
            });
        }
        
        /**
         * Load simulation data
         */
        loadSimulation(simulationData) {
            try {
                window.UAW.Model.loadData(simulationData);
                this.currentSimulation = simulationData;
                this.updateEditorFromModel();
                this.validateCurrentData();
                
                console.log('UAW: Simulation loaded');
                
            } catch (error) {
                console.error('Failed to load simulation:', error);
            }
        }
        
        /**
         * Load default sample
         */
        loadDefaultSample() {
            // Try to load the breadmaking sample as default
            const sampleData = window.UAW.Storage.loadSample('breadmaking');
            if (sampleData) {
                this.loadSimulation(sampleData);
            }
        }
        
        /**
         * Validate current data
         */
        async validateCurrentData() {
            try {
                const editorValue = this.editor.getValue();
                const simulationData = window.UAW.Util.safeParseJSON(editorValue);
                
                if (simulationData) {
                    const results = await window.UAW.Validation.validate(simulationData);
                    window.UAW.Events.emit('validation:complete', results);
                } else {
                    // Show JSON parse error
                    window.UAW.Events.emit('validation:complete', {
                        isValid: false,
                        errors: [{
                            metricId: 'json.parse.error',
                            status: 'error',
                            message: 'Invalid JSON syntax',
                            category: 'JSON'
                        }],
                        warnings: [],
                        suggestions: [],
                        passed: [],
                        summary: { total: 1, errors: 1, warnings: 0, suggestions: 0, passed: 0 }
                    });
                }
                
            } catch (error) {
                console.error('Validation failed:', error);
            }
        }
        
        /**
         * Update editor from model
         */
        updateEditorFromModel() {
            if (this.editor && this.currentSimulation) {
                const wrappedData = { simulation: this.currentSimulation };
                const jsonString = window.UAW.Util.stableStringify(wrappedData);
                this.editor.setValue(jsonString);
            }
        }
        
        /**
         * Update validation UI
         */
        updateValidationUI(results) {
            const statusIndicator = window.UAW.DOM.byId('json-status');
            if (statusIndicator) {
                if (results.isValid) {
                    statusIndicator.textContent = '✓ Valid JSON';
                    statusIndicator.className = 'validation-indicator success';
                } else {
                    statusIndicator.textContent = `✗ ${results.summary.errors} Error(s)`;
                    statusIndicator.className = 'validation-indicator error';
                }
            }
            
            // Update stats
            this.updateValidationStats(results);
        }
        
        /**
         * Update validation statistics
         */
        updateValidationStats(results) {
            const stats = [
                { id: 'total-metrics-count', value: results.summary.total },
                { id: 'error-metrics-count', value: results.summary.errors },
                { id: 'warning-metrics-count', value: results.summary.warnings },
                { id: 'suggestion-metrics-count', value: results.summary.suggestions },
                { id: 'success-metrics-count', value: results.summary.passed }
            ];
            
            stats.forEach(stat => {
                const element = window.UAW.DOM.byId(stat.id);
                if (element) {
                    element.textContent = stat.value;
                }
            });
        }
        
        /**
         * Format JSON in editor
         */
        formatJSON() {
            if (this.editor) {
                try {
                    const value = this.editor.getValue();
                    const parsed = JSON.parse(value);
                    const formatted = window.UAW.Util.stableStringify(parsed);
                    this.editor.setValue(formatted);
                } catch (error) {
                    console.error('Cannot format invalid JSON:', error);
                }
            }
        }
        
        /**
         * Clear editor content
         */
        clearEditor() {
            if (this.editor) {
                this.editor.setValue('{\n  "simulation": {\n    "objects": [],\n    "tasks": []\n  }\n}');
            }
        }
    }
    
    // Create and start the playground app
    const playgroundApp = new PlaygroundApp();
    
    // Register the app instance
    window.UAW.registerModule('PlaygroundApp', playgroundApp);
    
    console.log('UAW: Playground App bootstrap loaded');
})();