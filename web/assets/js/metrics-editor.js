// Metrics Editor Component for Universal Automation Wiki
// Handles custom metrics catalog and validation function editing

class MetricsEditor {
    constructor() {
        this.catalogEditor = null;
        this.validatorEditor = null;
        this.currentTab = 'catalog';
        this.isInitialized = false;
        
        // Default content templates
        this.catalogTemplate = this.getDefaultCatalog();
        this.validatorTemplate = this.getDefaultValidator();
        
        // Load saved content from localStorage
        this.loadSavedContent();
    }
    
    async initialize() {
        console.log('MetricsEditor: Initializing...');
        
        try {
            // Setup tab switching
            this.setupTabs();
            
            // Initialize Monaco editors
            await this.initializeMonacoEditors();
            
            // Setup resize handling
            this.setupResizeHandles();
            
            this.isInitialized = true;
            console.log('MetricsEditor: Initialization complete');
            return true;
        } catch (error) {
            console.error('MetricsEditor: Initialization failed', error);
            return false;
        }
    }
    
    setupTabs() {
        const tabButtons = document.querySelectorAll('.metrics-tab-btn');
        const tabContents = document.querySelectorAll('.metrics-tab-content');
        
        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                const targetTab = button.dataset.tab;
                this.switchTab(targetTab);
            });
        });
    }
    
    switchTab(targetTab) {
        console.log('MetricsEditor: Switching to tab:', targetTab);
        
        // Update button states
        const tabButtons = document.querySelectorAll('.metrics-tab-btn');
        const tabContents = document.querySelectorAll('.metrics-tab-content');
        
        tabButtons.forEach(btn => btn.classList.remove('active'));
        tabContents.forEach(content => content.classList.remove('active'));
        
        // Activate selected tab
        const activeButton = document.querySelector(`[data-tab="${targetTab}"]`);
        const activeContent = document.getElementById(`metrics-${targetTab}-tab`);
        
        if (activeButton) activeButton.classList.add('active');
        if (activeContent) activeContent.classList.add('active');
        
        this.currentTab = targetTab;
        
        // Trigger resize for Monaco editors
        setTimeout(() => {
            if (targetTab === 'catalog' && this.catalogEditor) {
                console.log('MetricsEditor: Triggering catalog editor layout');
                this.catalogEditor.layout();
            } else if (targetTab === 'validator' && this.validatorEditor) {
                console.log('MetricsEditor: Triggering validator editor layout');
                this.validatorEditor.layout();
            }
        }, 100);
    }
    
    async initializeMonacoEditors() {
        console.log('MetricsEditor: Setting up Monaco editors...');
        
        // Wait for Monaco to be available
        if (typeof monaco === 'undefined') {
            console.log('MetricsEditor: Monaco not yet available, waiting...');
            await new Promise(resolve => {
                const checkMonaco = () => {
                    if (typeof monaco !== 'undefined') {
                        console.log('MetricsEditor: Monaco is now available');
                        resolve();
                    } else {
                        setTimeout(checkMonaco, 100);
                    }
                };
                checkMonaco();
            });
        } else {
            console.log('MetricsEditor: Monaco is already available');
        }
        
        // Initialize catalog editor (JSON)
        const catalogContainer = document.getElementById('metrics-catalog-editor');
        console.log('MetricsEditor: Looking for catalog container...', catalogContainer);
        if (catalogContainer) {
            try {
                console.log('MetricsEditor: Creating catalog editor...');
                this.catalogEditor = monaco.editor.create(catalogContainer, {
                    value: this.savedCatalog || this.catalogTemplate,
                    language: 'json',
                    theme: 'vs',
                    fontSize: 14,
                    lineNumbers: 'on',
                    wordWrap: 'on',
                    minimap: { enabled: false },
                    scrollBeyondLastLine: false,
                    automaticLayout: true
                });
                
                // Auto-save on change
                this.catalogEditor.onDidChangeModelContent(() => {
                    this.saveCatalogContent();
                });
                
                console.log('MetricsEditor: Catalog editor initialized successfully');
                
                // Force layout after creation
                setTimeout(() => {
                    this.catalogEditor.layout();
                }, 100);
            } catch (error) {
                console.error('MetricsEditor: Error creating catalog editor:', error);
            }
        } else {
            console.error('MetricsEditor: Catalog container not found - #metrics-catalog-editor');
        }
        
        // Initialize validator editor (JavaScript)
        const validatorContainer = document.getElementById('metrics-validator-editor');
        console.log('MetricsEditor: Looking for validator container...', validatorContainer);
        if (validatorContainer) {
            try {
                console.log('MetricsEditor: Creating validator editor...');
                this.validatorEditor = monaco.editor.create(validatorContainer, {
                    value: this.savedValidator || this.validatorTemplate,
                    language: 'javascript',
                    theme: 'vs',
                    fontSize: 14,
                    lineNumbers: 'on',
                    wordWrap: 'on',
                    minimap: { enabled: false },
                    scrollBeyondLastLine: false,
                    automaticLayout: true
                });
                
                // Auto-save on change
                this.validatorEditor.onDidChangeModelContent(() => {
                    this.saveValidatorContent();
                });
                
                console.log('MetricsEditor: Validator editor initialized successfully');
                
                // Force layout after creation
                setTimeout(() => {
                    this.validatorEditor.layout();
                }, 100);
            } catch (error) {
                console.error('MetricsEditor: Error creating validator editor:', error);
            }
        } else {
            console.error('MetricsEditor: Validator container not found - #metrics-validator-editor');
        }
    }
    
    setupResizeHandles() {
        const resizeHandle = document.querySelector('.metrics-resize');
        if (!resizeHandle) return;
        
        let isResizing = false;
        
        resizeHandle.addEventListener('mousedown', (e) => {
            isResizing = true;
            document.body.style.cursor = 'ew-resize';
            e.preventDefault();
        });
        
        document.addEventListener('mousemove', (e) => {
            if (!isResizing) return;
            e.preventDefault();
            
            const playgroundTop = document.querySelector('.playground-top');
            const rect = playgroundTop.getBoundingClientRect();
            const newLeftWidth = ((e.clientX - rect.left) / rect.width) * 100;
            
            // Constrain to reasonable bounds (20% - 80%)
            const leftWidth = Math.max(20, Math.min(80, newLeftWidth));
            const rightWidth = 100 - leftWidth;
            
            const leftPanel = document.querySelector('.playground-left');
            const metricsPanel = document.querySelector('.metrics-editor-panel');
            
            if (leftPanel && metricsPanel) {
                // Force flex values with multiple approaches
                leftPanel.style.setProperty('flex', `0 0 ${leftWidth}%`, 'important');
                leftPanel.style.setProperty('width', `${leftWidth}%`, 'important');
                
                metricsPanel.style.setProperty('flex', `0 0 ${rightWidth}%`, 'important');
                metricsPanel.style.setProperty('width', `${rightWidth}%`, 'important');
                
                // Force immediate layout update for Monaco editors
                requestAnimationFrame(() => {
                    // Update right panel editors
                    if (this.catalogEditor) {
                        this.catalogEditor.layout();
                    }
                    if (this.validatorEditor) {
                        this.validatorEditor.layout();
                    }
                    
                    // Update left panel editor - check which tab is active
                    const activeLeftTab = document.querySelector('.left-tab-btn.active');
                    if (activeLeftTab && activeLeftTab.dataset.tab === 'json-editor') {
                        // JSON Editor tab is active - force container resize
                        const jsonEditorContainer = document.getElementById('json-editor-metrics-container');
                        
                        if (jsonEditorContainer) {
                            // Force DOM reflow before getting dimensions
                            leftPanel.offsetHeight; // Trigger reflow
                            
                            // Get dimensions and update container
                            const parentRect = leftPanel.getBoundingClientRect();
                            jsonEditorContainer.style.width = parentRect.width + 'px';
                            jsonEditorContainer.style.height = parentRect.height + 'px';
                            
                            // Reset after Monaco has had a chance to measure
                            setTimeout(() => {
                                jsonEditorContainer.style.width = '100%';
                                jsonEditorContainer.style.height = '100%';
                            }, 50);
                        }
                        
                        // Force layout update on the Monaco editor
                        if (window.metricsJsonEditor) {
                            window.metricsJsonEditor.layout();
                        }
                    }
                    
                    // Also trigger layout on the main editor if it exists (for standard mode)
                    if (window.editor) {
                        window.editor.layout();
                    }
                });
            }
        });
        
        document.addEventListener('mouseup', () => {
            if (isResizing) {
                console.log('🔧 RESIZE: Mouseup - ending resize operation');
                isResizing = false;
                document.body.style.cursor = '';
            }
        });
    }
    
    loadSavedContent() {
        this.savedCatalog = localStorage.getItem('uaw-metrics-catalog-custom');
        this.savedValidator = localStorage.getItem('uaw-metrics-validator-custom');
    }
    
    saveCatalogContent() {
        if (this.catalogEditor) {
            const content = this.catalogEditor.getValue();
            localStorage.setItem('uaw-metrics-catalog-custom', content);
        }
    }
    
    saveValidatorContent() {
        if (this.validatorEditor) {
            const content = this.validatorEditor.getValue();
            localStorage.setItem('uaw-metrics-validator-custom', content);
        }
    }
    
    getCatalogContent() {
        return this.catalogEditor ? this.catalogEditor.getValue() : this.savedCatalog || this.catalogTemplate;
    }
    
    getValidatorContent() {
        return this.validatorEditor ? this.validatorEditor.getValue() : this.savedValidator || this.validatorTemplate;
    }
    
    setCatalogContent(content) {
        if (this.catalogEditor) {
            this.catalogEditor.setValue(content);
        }
        localStorage.setItem('uaw-metrics-catalog-custom', content);
    }
    
    setValidatorContent(content) {
        if (this.validatorEditor) {
            this.validatorEditor.setValue(content);
        }
        localStorage.setItem('uaw-metrics-validator-custom', content);
    }
    
    getDefaultCatalog() {
        return JSON.stringify([
            {
                "id": "custom.example.sample_check",
                "name": "Sample Custom Metric",
                "emoji": "🔧",
                "category": "Custom Validation",
                "severity": "info",
                "source": "custom",
                "function": "validateSampleCheck",
                "description": "This is an example custom metric. Replace with your own validation logic.",
                "params": {
                    "example_parameter": "default_value"
                }
            }
        ], null, 2);
    }
    
    getDefaultValidator() {
        return `/**
 * Custom Validation Functions for Metrics Editor
 * 
 * Available context:
 * - this.simulation: The current simulation object
 * - this.addResult(result): Method to report validation results
 * - metric.params: Custom parameters from the catalog
 * 
 * Example result format:
 * {
 *   metricId: 'metric.id',
 *   status: 'success|warning|error',
 *   message: 'Descriptive message about the validation result'
 * }
 */

// Example custom validation function
function validateSampleCheck(metric) {
    // Access simulation data
    const simulation = this.simulation;
    const tasks = simulation.tasks || [];
    const objects = simulation.objects || [];
    
    // Get parameters from metric definition
    const exampleParam = metric.params?.example_parameter || "default_value";
    
    // Perform validation logic
    if (tasks.length === 0) {
        this.addResult({
            metricId: metric.id,
            status: 'warning',
            message: 'No tasks found in simulation. This is just an example check.'
        });
    } else {
        this.addResult({
            metricId: metric.id,
            status: 'success',
            message: \`Found \${tasks.length} tasks in simulation. Parameter: \${exampleParam}\`
        });
    }
}

// Add your custom validation functions here
// Each function should match the function name specified in your metrics catalog
`;
    }
    
    // Method to add a new metric via modal (placeholder for future implementation)
    addNewMetric(metricData) {
        console.log('MetricsEditor: Adding new metric:', metricData);
        // This will be implemented in a later phase
    }
}

// Export for use in playground.js
window.MetricsEditor = MetricsEditor;