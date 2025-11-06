// Playground Metrics Editor - Custom metrics creation and management
// Universal Automation Wiki - Simulation Playground

// Constants for localStorage keys
const STORAGE_KEYS = {
    METRICS_MODE: 'uaw-metrics-mode',
    METRICS_CATALOG: 'uaw-metrics-catalog-custom',
    METRICS_VALIDATOR: 'uaw-metrics-validator-custom'
};

// Constants for timeouts and delays
const STORAGE_WARNING_DISMISS_DELAY_MS = 10000;
const MONACO_LOAD_TIMEOUT_MS = 5000;
const VALIDATION_DEBOUNCE_MS = 100;

// Helper functions for user notifications
function showUserError(message) {
    console.error('User Error:', message);
    alert('Error: ' + message);
}

function showUserSuccess(message) {
    console.log('Success:', message);
    if (typeof showNotification === 'function') {
        showNotification(message);
    } else {
        alert(message);
    }
}

// Safe localStorage wrapper with user notification
function safeSetItem(key, value) {
    try {
        localStorage.setItem(key, value);
        return true;
    } catch (e) {
        if (e.name === 'QuotaExceededError') {
            showStorageQuotaWarning();
            console.error('LocalStorage quota exceeded when saving key:', key);
        } else {
            console.error('Error saving to localStorage:', e.message);
        }
        return false;
    }
}

// Show visual warning to user about storage issues
function showStorageQuotaWarning() {
    // Create or show a warning banner
    let warningBanner = document.getElementById('storage-quota-warning');
    if (!warningBanner) {
        warningBanner = document.createElement('div');
        warningBanner.id = 'storage-quota-warning';
        warningBanner.innerHTML = `
            <div style="background: #ff6b35; color: white; padding: 10px; text-align: center; font-weight: bold; position: fixed; top: 0; left: 0; right: 0; z-index: 10000; box-shadow: 0 2px 4px rgba(0,0,0,0.2);">
                ⚠️ Storage Full: Your work cannot be automatically saved. Consider clearing browser data or reducing file size.
                <button onclick="document.getElementById('storage-quota-warning').remove()" style="margin-left: 15px; background: white; color: #ff6b35; border: none; padding: 5px 10px; border-radius: 3px; cursor: pointer;">Dismiss</button>
            </div>
        `;
        document.body.appendChild(warningBanner);

        // Auto-dismiss after configured delay
        setTimeout(() => {
            if (warningBanner.parentNode) {
                warningBanner.remove();
            }
        }, STORAGE_WARNING_DISMISS_DELAY_MS);
    }
}

// Setup metrics mode toggle functionality
function setupMetricsMode() {
    
    const toggleBtn = document.getElementById("metrics-mode-toggle");
    const playgroundTop = document.querySelector(".playground-top");
    
    if (!toggleBtn) {
        return;
    }

    // Load saved mode preference
    const savedMode = localStorage.getItem(STORAGE_KEYS.METRICS_MODE);
    isMetricsMode = savedMode === 'true';
    
    // Apply initial mode
    updateMetricsMode();
    
    // Add click event listener
    toggleBtn.addEventListener("click", () => {
        isMetricsMode = !isMetricsMode;
        if (!safeSetItem(STORAGE_KEYS.METRICS_MODE, isMetricsMode.toString())) {
            console.error('Failed to save metrics mode preference');
        }
        updateMetricsMode();
    });
}

function updateMetricsMode() {
    const toggleBtn = document.getElementById("metrics-mode-toggle");
    const playgroundTop = document.querySelector(".playground-top");
    const specialTitle = document.querySelector("h1.special-title");
    const fullscreenBtn = document.getElementById("fullscreen-btn");
    
    if (isMetricsMode) {
        // Switch to metrics mode
        toggleBtn.textContent = "Close Metrics Editor";
        toggleBtn.classList.add("metrics-active");
        playgroundTop.classList.add("metrics-mode");
        
        if (specialTitle) {
            specialTitle.textContent = "Metrics Editor";
        }
        
        // Hide fullscreen button in metrics mode
        if (fullscreenBtn) {
            fullscreenBtn.classList.add("hidden");
        }
        
        // Move components to metrics mode layout
        moveComponentsToMetricsMode();
        
        // Create/initialize metrics JSON editor if needed
        createMetricsJsonEditor();
        
        // Setup left panel tabs for metrics mode
        setupLeftPanelTabs();
        
        // Setup metrics editor tabs
        setupMetricsEditorTabs();
        
        // Show metrics mode controls
        const metricsControls = document.getElementById('metrics-mode-controls');
        if (metricsControls) {
            metricsControls.style.display = 'block';
        }
        
        // Initialize metrics editor component
        initializeMetricsEditor();
        
        // Re-initialize resize handles since metrics mode handles are now visible
        if (typeof initializeResizeHandles === 'function') {
            initializeResizeHandles();
        }
        
        // Refresh validation display to show example/disable buttons
        refreshValidationDisplay();
        
    } else {
        // Switch back to standard mode
        toggleBtn.textContent = "Metrics Editor";
        toggleBtn.classList.remove("metrics-active");
        playgroundTop.classList.remove("metrics-mode");
        
        if (specialTitle) {
            specialTitle.textContent = "Playground";
        }
        
        // Show fullscreen button in standard mode
        if (fullscreenBtn) {
            fullscreenBtn.classList.remove("hidden");
        }
        
        // Move components back to standard layout
        moveComponentsToStandardMode();
        
        // Reset validation panel to standard
        resetValidationPanelToStandard();
        
        // Hide metrics mode controls
        const metricsControls = document.getElementById('metrics-mode-controls');
        if (metricsControls) {
            metricsControls.style.display = 'none';
        }
        
        // Refresh all editors since layout may have changed
        refreshAllEditors();
        
        // Refresh validation display to hide example/disable buttons
        refreshValidationDisplay();
    }
}

function setupLeftPanelTabs() {
    const tabButtons = document.querySelectorAll('[data-left-tab]');
    const tabContents = document.querySelectorAll('.left-tab-content');
    
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetTab = button.dataset.leftTab;
            switchLeftTab(targetTab);
        });
    });
}

function switchLeftTab(targetTab) {
    // Update button states
    const tabButtons = document.querySelectorAll('[data-left-tab]');
    const tabContents = document.querySelectorAll('.left-tab-content');

    tabButtons.forEach(btn => btn.classList.remove('active'));
    tabContents.forEach(content => content.classList.remove('active'));

    // Activate target button and content
    const targetButton = document.querySelector(`[data-left-tab="${targetTab}"]`);
    const targetContent = document.getElementById(`${targetTab}-left-tab`);

    if (targetButton && targetContent) {
        targetButton.classList.add('active');
        targetContent.classList.add('active');

        // Handle special cases for different tabs
        if (targetTab === 'space-editor' && spaceEditor) {
            try {
                const currentJson = JSON.parse(editor.getValue());
                spaceEditor.loadLayout(currentJson.simulation.layout, true);
            } catch(e) {
                console.warn('Failed to parse JSON for space editor:', e.message);
                // Show subtle indicator in UI
                if (targetButton) {
                    targetButton.style.color = '#ff6b35';
                    targetButton.title = 'Invalid JSON - fix syntax errors first';
                }
            }
        } else if (targetTab === 'digital-space' && digitalSpaceEditor) {
            try {
                const currentJson = JSON.parse(editor.getValue());
                // Support both new (nested) and old (root-level) formats for backward compatibility
                const digitalSpace = currentJson.simulation?.digital_space || currentJson.digital_space || {};
                digitalSpaceEditor.loadLayout(digitalSpace, true);
            } catch(e) {
                console.warn('Failed to parse JSON for digital space editor:', e.message);
                if (targetButton) {
                    targetButton.style.color = '#ff6b35';
                    targetButton.title = 'Invalid JSON - fix syntax errors first';
                }
            }
        } else if (targetTab === 'display-editor' && displayEditor) {
            try {
                const currentJson = JSON.parse(editor.getValue());
                // Support both new (nested) and old (root-level) formats for backward compatibility
                const displays = currentJson.simulation?.displays || currentJson.displays || {};
                displayEditor.loadLayout(displays, true);
            } catch(e) {
                console.warn('Failed to parse JSON for display editor:', e.message);
                if (targetButton) {
                    targetButton.style.color = '#ff6b35';
                    targetButton.title = 'Invalid JSON - fix syntax errors first';
                }
            }
        }
    }
}

function setupMetricsEditorTabs() {
    const metricTabButtons = document.querySelectorAll('.metrics-tab-btn');
    const metricTabContents = document.querySelectorAll('.metrics-tab-content');
    
    metricTabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetTab = button.dataset.tab;
            switchMetricsTab(targetTab);
        });
    });
    
    // Setup the Run Custom Validation button
    const runCustomValidationBtn = document.getElementById('run-custom-validation');
    if (runCustomValidationBtn) {
        runCustomValidationBtn.addEventListener('click', runCustomValidation);
    }
}

function switchMetricsTab(targetTab) {
    const tabButtons = document.querySelectorAll('.metrics-tab-btn');
    const tabContents = document.querySelectorAll('.metrics-tab-content');
    
    tabButtons.forEach(btn => btn.classList.remove('active'));
    tabContents.forEach(content => content.classList.remove('active'));
    
    // Activate target button and content
    const targetButton = document.querySelector(`[data-tab="${targetTab}"]`);
    const targetContent = document.getElementById(`metrics-${targetTab}-tab`);
    
    if (targetButton && targetContent) {
        targetButton.classList.add('active');
        targetContent.classList.add('active');
    }
}

function createMetricsJsonEditor() {
    const metricsEditorContainer = document.getElementById('json-editor-metrics');
    if (!metricsEditorContainer) {
        console.warn('JSON editor container not found for metrics mode');
        return;
    }
    
    // Check if editor already exists
    if (window.metricsJsonEditor) return;

    // Create a secondary Monaco editor instance for the left tab
    require(['vs/editor/editor.main'], function() {
        window.metricsJsonEditor = monaco.editor.create(metricsEditorContainer, {
            value: editor ? editor.getValue() : '',
            language: 'json',
            theme: isDarkMode ? 'vs-dark' : 'vs',
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
            formatOnType: true
        });

        // Use a flag to prevent recursive updates
        let isSyncing = false;

        // Sync changes between editors
        if (editor) {
            // Sync from main editor to metrics editor
            editor.onDidChangeModelContent(() => {
                if (isSyncing) return;

                if (window.metricsJsonEditor && editor.getValue() !== window.metricsJsonEditor.getValue()) {
                    isSyncing = true;
                    window.metricsJsonEditor.setValue(editor.getValue());
                    isSyncing = false;
                }
            });

            // Sync from metrics editor to main editor
            window.metricsJsonEditor.onDidChangeModelContent(() => {
                if (isSyncing) return;

                if (editor && window.metricsJsonEditor.getValue() !== editor.getValue()) {
                    isSyncing = true;
                    editor.setValue(window.metricsJsonEditor.getValue());
                    isSyncing = false;
                }
            });
        }
    });
    
    // Initialize the metrics catalog and validator editors
    initializeMetricsCatalogEditor();
    initializeMetricsValidatorEditor();
}

function initializeMetricsCatalogEditor() {
    const catalogEditorContainer = document.getElementById('metrics-catalog-editor');
    if (!catalogEditorContainer) {
        console.error('Metrics catalog editor container missing - check HTML structure');
        return;
    }

    if (window.metricsCatalogEditor) return;

    const customCatalog = localStorage.getItem(STORAGE_KEYS.METRICS_CATALOG) || JSON.stringify([
        {
            "id": "custom.example.sample_check",
            "name": "Sample Custom Metric",
            "emoji": "🔧",
            "category": "Custom Validation",
            "severity": "info",
            "source": "custom",
            "function": "validateSampleCheck",
            "description": "This is an example custom metric. Replace with your own validation logic.",
            "validation_type": "computational",
            "params": {
                "example_parameter": "default_value"
            }
        },
        {
            "_comment": "The disabled_metrics array lists IDs of built-in metrics to hide",
            "disabled_metrics": []
        }
    ], null, 2);

    // Add timeout and error handling
    const monacoTimeout = setTimeout(() => {
        if (!window.metricsCatalogEditor) {
            console.error('Monaco catalog editor timed out');
            showMonacoLoadError(catalogEditorContainer);
        }
    }, MONACO_LOAD_TIMEOUT_MS);

    require(['vs/editor/editor.main'], function() {
        clearTimeout(monacoTimeout);
        try {
            window.metricsCatalogEditor = monaco.editor.create(catalogEditorContainer, {
                value: customCatalog,
                language: 'json',
                theme: isDarkMode ? 'vs-dark' : 'vs',
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
                formatOnType: true
            });

            window.metricsCatalogEditor.onDidChangeModelContent(() => {
                const content = window.metricsCatalogEditor.getValue();
                if (!safeSetItem(STORAGE_KEYS.METRICS_CATALOG, content)) {
                    console.error('Failed to save metrics catalog changes');
                }
            });
        } catch (error) {
            clearTimeout(monacoTimeout);
            console.error('Failed to create Monaco catalog editor:', error);
            showMonacoLoadError(catalogEditorContainer);
        }
    }, function(error) {
        clearTimeout(monacoTimeout);
        console.error('Failed to load Monaco for catalog editor:', error);
        showMonacoLoadError(catalogEditorContainer);
    });
}

/**
 * Shows an error message when Monaco editor fails to load.
 *
 * @param {HTMLElement} container - The container element
 */
function showMonacoLoadError(container) {
    container.innerHTML = `
        <div style="padding: 2rem; text-align: center; color: #ff6b35;">
            <p><strong>⚠️ Editor failed to load</strong></p>
            <p>Monaco editor could not be initialized. Check your internet connection.</p>
            <p><a href="#" onclick="location.reload()">Reload page</a></p>
        </div>
    `;
}

function initializeMetricsValidatorEditor() {
    const validatorEditorContainer = document.getElementById('metrics-validator-editor');
    if (!validatorEditorContainer) {
        console.error('Metrics validator editor container missing - check HTML structure');
        return;
    }

    if (window.metricsValidatorEditor) return;

    const customValidator = localStorage.getItem(STORAGE_KEYS.METRICS_VALIDATOR) || `/**
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

    // Add timeout and error handling
    const monacoTimeout = setTimeout(() => {
        if (!window.metricsValidatorEditor) {
            console.error('Monaco validator editor timed out');
            showMonacoLoadError(validatorEditorContainer);
        }
    }, MONACO_LOAD_TIMEOUT_MS);

    require(['vs/editor/editor.main'], function() {
        clearTimeout(monacoTimeout);
        try {
            window.metricsValidatorEditor = monaco.editor.create(validatorEditorContainer, {
                value: customValidator,
                language: 'javascript',
                theme: isDarkMode ? 'vs-dark' : 'vs',
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
                formatOnType: true
            });

            window.metricsValidatorEditor.onDidChangeModelContent(() => {
                const content = window.metricsValidatorEditor.getValue();

                // Attempt to validate syntax
                try {
                    // Try to parse as function (basic syntax check)
                    new Function(content);

                    // Clear any previous error indicators
                    const validatorTab = document.querySelector('[data-tab="validator"]');
                    if (validatorTab) {
                        validatorTab.style.color = '';
                        validatorTab.title = 'simulation-validator-custom.js';
                    }

                    if (!safeSetItem(STORAGE_KEYS.METRICS_VALIDATOR, content)) {
                        console.error('Failed to save validator changes');
                    }
                } catch (error) {
                    console.warn('Syntax error in custom validator:', error.message);

                    // Show error indicator on tab
                    const validatorTab = document.querySelector('[data-tab="validator"]');
                    if (validatorTab) {
                        validatorTab.style.color = '#ff6b35';
                        validatorTab.title = `Syntax error: ${error.message}`;
                    }

                    // Still save so user doesn't lose work, but warn them
                    if (!safeSetItem(STORAGE_KEYS.METRICS_VALIDATOR, content)) {
                        console.error('Failed to save validator changes');
                    }
                }
            });
        } catch (error) {
            clearTimeout(monacoTimeout);
            console.error('Failed to create Monaco validator editor:', error);
            showMonacoLoadError(validatorEditorContainer);
        }
    }, function(error) {
        clearTimeout(monacoTimeout);
        console.error('Failed to load Monaco for validator editor:', error);
        showMonacoLoadError(validatorEditorContainer);
    });
}

function moveComponentsToMetricsMode() {
    const standardLayout = document.querySelector('.standard-mode-layout');
    const metricsLayout = document.querySelector('.metrics-mode-layout');
    const metricsPanel = document.getElementById('metrics-editor-panel');
    
    if (!standardLayout || !metricsLayout || !metricsPanel) return;
    
    // Hide standard layout, show metrics layout
    standardLayout.style.display = 'none';
    metricsLayout.style.display = 'flex';
    metricsPanel.style.display = 'flex';
    
    // Move simulation content to left panel tab
    const simulationContent = document.getElementById('simulation-content');
    const simulationLoading = document.getElementById('simulation-loading');
    const simulationLeftTab = document.getElementById('simulation-render-left-tab');
    
    if (simulationContent && simulationLeftTab) {
        // Create container if it doesn't exist
        let container = simulationLeftTab.querySelector('.simulation-content');
        if (!container) {
            container = document.createElement('div');
            container.className = 'simulation-content';
            simulationLeftTab.appendChild(container);
        }
        container.appendChild(simulationContent);
        if (simulationLoading) {
            container.appendChild(simulationLoading);
        }
    }
    
    // Move space editor to left panel tab
    const spaceEditorContainer = document.querySelector('#space-editor-tab .space-editor-container');
    const spaceEditorLeftTab = document.getElementById('space-editor-left-tab');
    
    if (spaceEditorContainer && spaceEditorLeftTab) {
        spaceEditorLeftTab.appendChild(spaceEditorContainer);
    }
    
    // Move digital space editor to left panel tab
    const digitalSpaceContainer = document.querySelector('#digital-space-tab .space-editor-container');
    const digitalSpaceLeftTab = document.getElementById('digital-space-left-tab');
    
    if (digitalSpaceContainer && digitalSpaceLeftTab) {
        digitalSpaceLeftTab.appendChild(digitalSpaceContainer);
    }
    
    // Move display editor to left panel tab
    const displayEditorContainer = document.querySelector('#display-editor-tab .space-editor-container');
    const displayEditorLeftTab = document.getElementById('display-editor-left-tab');
    
    if (displayEditorContainer && displayEditorLeftTab) {
        displayEditorLeftTab.appendChild(displayEditorContainer);
    }
    
    // Create secondary JSON editor for metrics mode
    createMetricsJsonEditor();
}

function moveComponentsToStandardMode() {
    const standardLayout = document.querySelector('.standard-mode-layout');
    const metricsLayout = document.querySelector('.metrics-mode-layout');
    const metricsPanel = document.getElementById('metrics-editor-panel');
    
    if (!standardLayout || !metricsLayout || !metricsPanel) return;
    
    // Show standard layout, hide metrics layout
    standardLayout.style.display = 'flex';
    metricsLayout.style.display = 'none';
    metricsPanel.style.display = 'none';
    
    // Move simulation content back to standard tab
    const simulationContent = document.getElementById('simulation-content');
    const simulationLoading = document.getElementById('simulation-loading');
    const simulationTab = document.getElementById('simulation-tab');
    
    if (simulationContent && simulationTab) {
        simulationTab.appendChild(simulationContent);
        if (simulationLoading) {
            simulationTab.appendChild(simulationLoading);
        }
    }
    
    // Move space editor back to standard tab
    const spaceEditorContainer = document.querySelector('#space-editor-left-tab .space-editor-container');
    const spaceEditorTab = document.getElementById('space-editor-tab');
    
    if (spaceEditorContainer && spaceEditorTab) {
        spaceEditorTab.appendChild(spaceEditorContainer);
    }
    
    // Move digital space editor back to standard tab
    const digitalSpaceContainer = document.querySelector('#digital-space-left-tab .space-editor-container');
    const digitalSpaceTab = document.getElementById('digital-space-tab');
    
    if (digitalSpaceContainer && digitalSpaceTab) {
        digitalSpaceTab.appendChild(digitalSpaceContainer);
    }
    
    // Move display editor back to standard tab
    const displayEditorContainer = document.querySelector('#display-editor-left-tab .space-editor-container');
    const displayEditorTab = document.getElementById('display-editor-tab');
    
    if (displayEditorContainer && displayEditorTab) {
        displayEditorTab.appendChild(displayEditorContainer);
    }
}

function refreshSpaceEditor() {
    if (spaceEditor) {
        try {
            const currentJson = JSON.parse(editor.getValue());
            spaceEditor.loadLayout(currentJson.simulation.layout);
        } catch(e) {
            console.warn('Cannot refresh space editor - invalid JSON:', e.message);
        }
    }
}

function refreshAllEditors() {
    try {
        const currentJson = JSON.parse(editor.getValue());

        if (spaceEditor) {
            spaceEditor.loadLayout(currentJson.simulation.layout);
        }

        if (digitalSpaceEditor) {
            // Support both new (nested) and old (root-level) formats for backward compatibility
            const digitalSpace = currentJson.simulation?.digital_space || currentJson.digital_space || {};
            digitalSpaceEditor.loadLayout(digitalSpace);
        }

        if (displayEditor) {
            // Support both new (nested) and old (root-level) formats for backward compatibility
            const displays = currentJson.simulation?.displays || currentJson.displays || {};
            displayEditor.loadLayout(displays);
        }
    } catch(e) {
        console.warn('Cannot refresh editors - invalid JSON:', e.message);
    }
}

function initializeMetricsEditor() {
    // Initialize metrics editor component if available
    if (typeof MetricsEditor !== 'undefined' && !window.metricsEditorInstance) {
        const container = document.getElementById('metrics-editor-container');
        if (container) {
            window.metricsEditorInstance = new MetricsEditor(container, {
                catalog: getMergedMetricsCatalog(),
                validator: getCustomValidatorCode()
            });
        }
    }
}

function setupMetricsValidationPanel() {
    // Setup the validation panel for metrics mode
    const validationPanel = document.getElementById('metrics-validation-panel');
    if (validationPanel) {
        // Setup custom validation runner
        const runBtn = document.getElementById('run-custom-validation-btn');
        if (runBtn) {
            runBtn.addEventListener('click', runCustomValidation);
        }
    }
}

function resetValidationPanelToStandard() {
    // Reset validation panel back to standard simulation validation
    const validationPanel = document.querySelector('.validation-panel');
    if (validationPanel) {
        validationPanel.classList.remove('metrics-mode');
    }
}

/**
 * Runs custom validation with loading state and feedback.
 */
function runCustomValidation() {
    // Show loading state
    const runBtn = document.getElementById('run-custom-validation');
    if (runBtn) {
        runBtn.disabled = true;
        runBtn.textContent = '⏳ Running...';
    }

    const validationContent = document.querySelector('.validation-content');
    if (validationContent) {
        validationContent.innerHTML = `
            <div style="text-align: center; padding: 2rem;">
                <div class="spinner"></div>
                <p>Running custom validation...</p>
            </div>
        `;
    }

    // Use setTimeout to allow UI to update
    setTimeout(() => {
        try {
            const simulationData = getCurrentSimulationData();
            if (!simulationData) {
                displayValidationError('No simulation data available');
                return;
            }

            const mergedCatalog = getMergedMetricsCatalog();
            const customValidator = getCustomValidatorCode();

            if (mergedCatalog && mergedCatalog.length > 0) {
                const startTime = performance.now();
                const validator = new SimulationValidator(simulationData);
                const results = validator.runChecks(mergedCatalog, customValidator);
                const duration = Math.round(performance.now() - startTime);

                displayCompactValidationResults(results);

                // Show success message
                console.log(`✅ Validation completed in ${duration}ms - ${results.length} checks`);
            } else {
                displayValidationError('No metrics catalog available');
            }
        } catch (error) {
            console.error('Custom validation error:', error);
            displayValidationError(`Validation error: ${error.message}\n\nCheck browser console for details.`);
        } finally {
            // Restore button state
            if (runBtn) {
                runBtn.disabled = false;
                runBtn.textContent = '▶ Run Custom Validation';
            }
        }
    }, VALIDATION_DEBOUNCE_MS);
}

/**
 * Validates the structure of a metrics catalog.
 *
 * @param {Array} catalog - The catalog to validate
 * @returns {Object} Validation result with valid flag and error message
 */
function validateMetricsCatalog(catalog) {
    if (!Array.isArray(catalog)) {
        return { valid: false, error: 'Catalog must be an array' };
    }

    for (const item of catalog) {
        // Check for disabled_metrics entry
        if (item.disabled_metrics) {
            if (!Array.isArray(item.disabled_metrics)) {
                return { valid: false, error: 'disabled_metrics must be an array' };
            }
            continue;
        }

        // Validate metric structure
        const required = ['id', 'name', 'category', 'function'];
        for (const field of required) {
            if (!item[field]) {
                return { valid: false, error: `Metric missing required field: ${field}` };
            }
        }

        // Validate ID format
        if (!/^[a-z0-9._-]+$/i.test(item.id)) {
            return { valid: false, error: `Invalid metric ID format: ${item.id}` };
        }

        // Validate function name format
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(item.function)) {
            return { valid: false, error: `Invalid function name: ${item.function}` };
        }
    }

    return { valid: true };
}

/**
 * Gets custom metrics catalog from localStorage or editor.
 * Returns empty array on error.
 *
 * @returns {Array} The custom metrics catalog
 */
function getCustomMetricsCatalog() {
    try {
        let customCatalogText;
        if (window.metricsCatalogEditor) {
            customCatalogText = window.metricsCatalogEditor.getValue();
        } else {
            customCatalogText = localStorage.getItem(STORAGE_KEYS.METRICS_CATALOG);
        }

        if (!customCatalogText) {
            console.info('No custom metrics catalog found, using defaults');
            return [];
        }

        const parsed = JSON.parse(customCatalogText);

        if (!Array.isArray(parsed)) {
            console.error('Custom metrics catalog is not an array');
            return [];
        }

        return parsed;
    } catch (e) {
        console.error('Error parsing custom metrics catalog:', e);
        displayValidationError(`Metrics catalog error: ${e.message}. Fix the JSON in the Metrics Editor.`);
        return [];
    }
}

/**
 * Gets merged catalog (built-in + custom) with validation.
 * Filters out disabled built-in metrics.
 *
 * @returns {Array} The merged metrics catalog
 */
function getMergedMetricsCatalog() {
    const customCatalog = getCustomMetricsCatalog();

    // Validate catalog structure
    const validation = validateMetricsCatalog(customCatalog);
    if (!validation.valid) {
        console.error('Invalid metrics catalog:', validation.error);
        displayValidationError(`Metrics catalog error: ${validation.error}`);
        return window.metricsCatalog || []; // Fall back to built-in only
    }

    // Get IDs of disabled builtin metrics from disabled_metrics array
    const disabledMetricsEntry = customCatalog.find(item => item.disabled_metrics);
    const disabledMetricIds = new Set(disabledMetricsEntry ? disabledMetricsEntry.disabled_metrics : []);

    // Filter out disabled builtin metrics
    const builtInCatalog = (window.metricsCatalog || [])
        .filter(metric => !disabledMetricIds.has(metric.id))
        .map(metric => ({
            ...metric,
            source: 'builtin'
        }));

    // Only include actual custom metrics (not the disabled_metrics entry)
    const activeCatalog = customCatalog
        .filter(metric => !metric.disabled_metrics) // Exclude disabled_metrics entries
        .map(metric => ({
            ...metric,
            source: 'custom'
        }));

    return [...builtInCatalog, ...activeCatalog];
}

/**
 * Gets custom validator code from editor or localStorage.
 *
 * @returns {string} The custom validator code
 */
function getCustomValidatorCode() {
    if (window.metricsValidatorEditor) {
        return window.metricsValidatorEditor.getValue();
    }
    return localStorage.getItem(STORAGE_KEYS.METRICS_VALIDATOR) || '';
}

/**
 * Displays validation results in compact format for metrics mode.
 *
 * @param {Array} results - The validation results
 */
function displayCompactValidationResults(results) {
    // Use the same grouped display for compact view
    displayGroupedValidationResults(results);
}

function displayValidationError(message) {
    const errorResult = [
        {
            metricId: 'validation-error',
            status: 'error',
            message: message
        }
    ];
    displayGroupedValidationResults(errorResult);
}

// Setup add metric modal
function setupAddMetricModal() {
    const addMetricBtn = document.getElementById('add-metric-btn');
    const modal = document.getElementById('add-metric-modal');
    const closeBtn = document.getElementById('close-add-metric-modal');
    
    if (addMetricBtn && modal) {
        addMetricBtn.addEventListener('click', openAddMetricModal);
    }
    
    if (closeBtn && modal) {
        closeBtn.addEventListener('click', closeAddMetricModal);
    }
    
    setupMetricFormHandlers();
}

function openAddMetricModal() {
    const modal = document.getElementById('add-metric-modal');
    if (modal) {
        modal.style.display = 'flex';
        
        // Reset form
        const form = document.getElementById('add-metric-form');
        if (form) {
            form.reset();
            updateGeneratedFields();
        }
    }
}

function closeAddMetricModal() {
    const modal = document.getElementById('add-metric-modal');
    if (modal) {
        modal.style.display = 'none';
    }
}

function setupMetricFormHandlers() {
    const form = document.getElementById('add-metric-form');
    if (!form) return;

    // Auto-update generated fields when name changes
    const nameInput = document.getElementById('metric-name-input');
    if (nameInput) {
        nameInput.addEventListener('input', updateGeneratedFields);
    }

    // Show/hide parameters section
    const hasParamsCheckbox = document.getElementById('metric-has-params');
    const paramsSection = document.getElementById('metric-params-section');
    if (hasParamsCheckbox && paramsSection) {
        hasParamsCheckbox.addEventListener('change', (e) => {
            paramsSection.style.display = e.target.checked ? 'block' : 'none';
        });
    }

    // Form submission
    form.addEventListener('submit', addCustomMetric);
}

function updateGeneratedFields() {
    const nameInput = document.getElementById('metric-name-input');
    const idOutput = document.getElementById('metric-id-input');
    const functionOutput = document.getElementById('metric-function-input');
    const idStatus = document.getElementById('metric-id-status');
    const functionStatus = document.getElementById('metric-function-status');

    if (!nameInput || !idOutput || !functionOutput) return;

    const name = nameInput.value.trim();
    if (!name) {
        idOutput.value = '';
        functionOutput.value = '';
        if (idStatus) idStatus.textContent = 'Auto-generated based on category and name';
        if (functionStatus) functionStatus.textContent = 'Auto-generated JavaScript function name';
        return;
    }

    // Generate ID and function name using improved functions
    const generatedId = generateMetricId(name);
    const generatedFunction = generateFunctionName(name);

    idOutput.value = generatedId;
    functionOutput.value = generatedFunction;

    // Check for duplicates
    checkForDuplicates(generatedId, generatedFunction, idStatus, functionStatus);
}

/**
 * Generates a unique metric ID based on the metric name.
 * Handles collisions by appending a counter suffix.
 *
 * @param {string} name - The human-readable metric name
 * @returns {string} A unique metric ID in format "custom.metric_name"
 */
function generateMetricId(name) {
    // Convert to lowercase and replace non-alphanumeric with single underscore
    let id = name.toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, ''); // Remove leading/trailing underscores

    // Handle edge case: name with no valid characters
    if (!id) {
        id = 'unnamed_metric';
    }

    const baseId = `custom.${id}`;
    return baseId; // Return without uniqueness check for now, will check in checkForDuplicates
}

/**
 * Generates a valid JavaScript function name from a metric name.
 * Ensures the result is a valid identifier.
 *
 * @param {string} metricName - The metric name
 * @returns {string} A valid JavaScript function name
 */
function generateFunctionName(metricName) {
    // Remove special characters and convert to PascalCase
    let cleanName = metricName
        .split(/[^a-zA-Z0-9]+/)
        .filter(part => part.length > 0)
        .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
        .join('');

    // Handle edge cases
    if (!cleanName) {
        cleanName = 'CustomMetric';
    }

    // Ensure it doesn't start with a number
    if (/^[0-9]/.test(cleanName)) {
        cleanName = 'Metric' + cleanName;
    }

    return 'validate' + cleanName;
}

/**
 * Checks if a function exists in the validator code using proper regex matching.
 *
 * @param {string} code - The validator code to search
 * @param {string} functionName - The function name to find
 * @returns {boolean} True if function exists
 */
function checkFunctionExists(code, functionName) {
    // Use regex to match actual function declarations
    const patterns = [
        new RegExp(`^\\s*function\\s+${functionName}\\s*\\(`, 'm'),
        new RegExp(`^\\s*const\\s+${functionName}\\s*=\\s*function\\s*\\(`, 'm'),
        new RegExp(`^\\s*const\\s+${functionName}\\s*=\\s*\\(.*\\)\\s*=>`, 'm'),
    ];

    return patterns.some(pattern => pattern.test(code));
}

function checkForDuplicates(generatedId, generatedFunction, idStatus, functionStatus) {
    const mergedCatalog = getMergedMetricsCatalog();
    const customValidator = getCustomValidatorCode();

    // Check ID
    const idExists = mergedCatalog.some(metric => metric.id === generatedId);
    if (idStatus) {
        if (idExists) {
            idStatus.textContent = '⚠️ ID already exists';
            idStatus.className = 'status-warning';
        } else {
            idStatus.textContent = '✅ Available';
            idStatus.className = 'status-success';
        }
    }

    // Check function name using improved function existence check
    const functionExists = checkFunctionExists(customValidator, generatedFunction);
    if (functionStatus) {
        if (functionExists) {
            functionStatus.textContent = '⚠️ Function already exists';
            functionStatus.className = 'status-warning';
        } else {
            functionStatus.textContent = '✅ Available';
            functionStatus.className = 'status-success';
        }
    }
}

/**
 * Adds a custom metric to the catalog based on form data.
 * Validates inputs, generates catalog entry and validator function, and saves to localStorage.
 *
 * @param {Event} e - The form submit event
 */
function addCustomMetric(e) {
    e.preventDefault();

    try {
        // Gather form data
        const name = document.getElementById('metric-name-input').value.trim();
        const emoji = document.getElementById('metric-emoji-input').value.trim();
        const category = document.getElementById('metric-category-input').value;
        const severity = document.getElementById('metric-severity-input').value;
        const description = document.getElementById('metric-description-input').value.trim();
        const validationLogic = document.getElementById('metric-validation-logic').value;

        // Validate inputs
        if (!name || !emoji || !category || !description) {
            showUserError('Please fill in all required fields');
            return;
        }

        if (name.length < 3) {
            showUserError('Metric name must be at least 3 characters');
            return;
        }

        if (description.length < 10) {
            showUserError('Description must be at least 10 characters');
            return;
        }

        // Generate IDs
        const metricId = generateMetricId(name);
        const functionName = generateFunctionName(name);

        // Check for duplicates
        const mergedCatalog = getMergedMetricsCatalog();
        if (mergedCatalog.some(m => m.id === metricId)) {
            showUserError(`Metric ID "${metricId}" already exists. Please use a different name.`);
            return;
        }

        // Parse parameters if provided
        let params = {};
        const hasParams = document.getElementById('metric-has-params').checked;
        if (hasParams) {
            const paramsInput = document.getElementById('metric-params-input').value.trim();
            if (paramsInput) {
                try {
                    params = JSON.parse(paramsInput);
                    if (typeof params !== 'object' || Array.isArray(params)) {
                        showUserError('Parameters must be a JSON object (not array)');
                        return;
                    }
                } catch (e) {
                    showUserError('Invalid JSON in parameters field: ' + e.message);
                    return;
                }
            }
        }

        // Create catalog entry
        const catalogEntry = {
            id: metricId,
            name: name,
            emoji: emoji,
            category: category,
            severity: severity,
            source: 'custom',
            function: functionName,
            description: description,
            validation_type: 'computational',
            params: params
        };

        // Generate function code based on template
        const functionCode = generateValidatorFunctionFromTemplate(
            functionName,
            validationLogic,
            description
        );

        // Insert into catalog and validator
        if (!insertMetricIntoCatalog(catalogEntry)) {
            showUserError('Failed to save metric to catalog. Storage may be full.');
            return;
        }

        if (!insertFunctionIntoValidator(functionCode)) {
            showUserError('Failed to save validation function. Storage may be full.');
            return;
        }

        // Reload editors to show changes
        if (window.metricsCatalogEditor) {
            window.metricsCatalogEditor.setValue(
                localStorage.getItem(STORAGE_KEYS.METRICS_CATALOG)
            );
        }

        if (window.metricsValidatorEditor) {
            window.metricsValidatorEditor.setValue(
                localStorage.getItem(STORAGE_KEYS.METRICS_VALIDATOR)
            );
        }

        // Show success and close modal
        showUserSuccess(`Metric "${name}" added successfully!`);
        closeAddMetricModal();

        // Run validation to show new metric
        if (isMetricsMode) {
            runCustomValidation();
        }

    } catch (error) {
        console.error('Error adding custom metric:', error);
        showUserError(`Failed to add metric: ${error.message}`);
    }
}

/**
 * Generates validator function code from a template.
 *
 * @param {string} functionName - The name of the function
 * @param {string} logicType - The type of validation logic (count, boolean, comparison)
 * @param {string} description - Description of what the function validates
 * @returns {string} The generated function code
 */
function generateValidatorFunctionFromTemplate(functionName, logicType, description) {
    const templates = {
        'count': `
/**
 * ${description}
 */
function ${functionName}(metric) {
    // Count-based validation
    const simulation = this.simulation;
    const threshold = metric.params?.threshold || 1;

    // Add your counting logic here
    const count = 0; // TODO: Replace with actual count

    this.addResult({
        metricId: metric.id,
        status: count >= threshold ? 'success' : 'warning',
        message: \`Count: \${count} (threshold: \${threshold})\`
    });
}`,
        'boolean': `
/**
 * ${description}
 */
function ${functionName}(metric) {
    // Boolean validation
    const simulation = this.simulation;

    // Add your boolean logic here
    const isValid = true; // TODO: Replace with actual logic

    this.addResult({
        metricId: metric.id,
        status: isValid ? 'success' : 'error',
        message: isValid ? 'Validation passed' : 'Validation failed'
    });
}`,
        'comparison': `
/**
 * ${description}
 */
function ${functionName}(metric) {
    // Comparison validation
    const simulation = this.simulation;
    const expected = metric.params?.expected;
    const actual = null; // TODO: Calculate actual value

    const matches = actual === expected;

    this.addResult({
        metricId: metric.id,
        status: matches ? 'success' : 'warning',
        message: \`Expected: \${expected}, Actual: \${actual}\`
    });
}`
    };

    return templates[logicType] || templates.boolean;
}


/**
 * Inserts a metric into the custom catalog, checking for duplicates.
 *
 * @param {Object} catalogEntry - The metric catalog entry to insert
 * @returns {boolean} True if insertion succeeded, false otherwise
 */
function insertMetricIntoCatalog(catalogEntry) {
    const customCatalog = getCustomMetricsCatalog();

    // Check for duplicate ID
    const existingIndex = customCatalog.findIndex(m => m.id === catalogEntry.id);
    if (existingIndex !== -1) {
        // Replace existing metric
        console.warn(`Replacing existing metric: ${catalogEntry.id}`);
        customCatalog[existingIndex] = catalogEntry;
    } else {
        customCatalog.push(catalogEntry);
    }

    const newCatalogJson = JSON.stringify(customCatalog, null, 2);
    if (!safeSetItem(STORAGE_KEYS.METRICS_CATALOG, newCatalogJson)) {
        return false;
    }

    // Reload editor if it exists
    if (window.metricsCatalogEditor) {
        window.metricsCatalogEditor.setValue(newCatalogJson);
    }

    return true;
}

/**
 * Inserts a function into the custom validator code.
 *
 * @param {string} functionCode - The function code to insert
 * @returns {boolean} True if insertion succeeded, false otherwise
 */
function insertFunctionIntoValidator(functionCode) {
    const currentValidator = getCustomValidatorCode();
    const newValidator = currentValidator + '\n\n' + functionCode;

    if (!safeSetItem(STORAGE_KEYS.METRICS_VALIDATOR, newValidator)) {
        return false;
    }

    // Reload editor if it exists
    if (window.metricsValidatorEditor) {
        window.metricsValidatorEditor.setValue(newValidator);
    }

    return true;
}