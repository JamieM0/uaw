// Playground Metrics Editor - Custom metrics creation and management
// Universal Automation Wiki - Simulation Playground

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
        
        // Auto-dismiss after 10 seconds
        setTimeout(() => {
            if (warningBanner.parentNode) {
                warningBanner.remove();
            }
        }, 10000);
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
    const savedMode = localStorage.getItem('uaw-metrics-mode');
    isMetricsMode = savedMode === 'true';
    
    // Apply initial mode
    updateMetricsMode();
    
    // Add click event listener
    toggleBtn.addEventListener("click", () => {
        isMetricsMode = !isMetricsMode;
        safeSetItem('uaw-metrics-mode', isMetricsMode.toString());
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
                // Ignore parse errors
            }
        } else if (targetTab === 'digital-space' && digitalSpaceEditor) {
            try {
                const currentJson = JSON.parse(editor.getValue());
                digitalSpaceEditor.loadLayout(currentJson.simulation.digital_space || {}, true);
            } catch(e) {
                // Ignore parse errors
            }
        } else if (targetTab === 'display-editor' && displayEditor) {
            try {
                const currentJson = JSON.parse(editor.getValue());
                displayEditor.loadLayout(currentJson.simulation.displays || {}, true);
            } catch(e) {
                // Ignore parse errors
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
        
        // Sync changes between editors
        if (editor) {
            // Sync from main editor to metrics editor
            editor.onDidChangeModelContent(() => {
                if (window.metricsJsonEditor && editor.getValue() !== window.metricsJsonEditor.getValue()) {
                    window.metricsJsonEditor.setValue(editor.getValue());
                }
            });
            
            // Sync from metrics editor to main editor
            window.metricsJsonEditor.onDidChangeModelContent(() => {
                if (editor && window.metricsJsonEditor.getValue() !== editor.getValue()) {
                    editor.setValue(window.metricsJsonEditor.getValue());
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
    if (!catalogEditorContainer) return;
    
    if (window.metricsCatalogEditor) return;
    
    const customCatalog = localStorage.getItem('uaw-metrics-catalog-custom') || `[
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
    "disabled_metrics": []
  }
]`;
    
    require(['vs/editor/editor.main'], function() {
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
            safeSetItem('uaw-metrics-catalog-custom', content);
        });
    });
}

function initializeMetricsValidatorEditor() {
    const validatorEditorContainer = document.getElementById('metrics-validator-editor');
    if (!validatorEditorContainer) return;
    
    if (window.metricsValidatorEditor) return;
    
    const customValidator = localStorage.getItem('uaw-metrics-validator-custom') || `/**
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
    
    require(['vs/editor/editor.main'], function() {
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
            safeSetItem('uaw-metrics-validator-custom', content);
        });
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
            // Ignore JSON parse errors
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
            digitalSpaceEditor.loadLayout(currentJson.simulation.digital_space || {});
        }
        
        if (displayEditor) {
            displayEditor.loadLayout(currentJson.simulation.displays || {});
        }
    } catch(e) {
        // Ignore JSON parse errors
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

function runCustomValidation() {
    try {
        const simulationData = getCurrentSimulationData();
        if (!simulationData) {
            displayValidationError('No simulation data available');
            return;
        }
        
        const mergedCatalog = getMergedMetricsCatalog();
        const customValidator = getCustomValidatorCode();
        
        if (mergedCatalog && mergedCatalog.length > 0) {
            const validator = new SimulationValidator(simulationData);
            const results = validator.runChecks(mergedCatalog, customValidator);
            displayCompactValidationResults(results);
        } else {
            displayValidationError('No metrics catalog available');
        }
    } catch (error) {
        console.error('Custom validation error:', error);
        displayValidationError(`Validation error: ${error.message}`);
    }
}

// Get custom metrics catalog from localStorage
function getCustomMetricsCatalog() {
    try {
        let customCatalogText;
        if (window.metricsCatalogEditor) {
            customCatalogText = window.metricsCatalogEditor.getValue();
        } else {
            customCatalogText = localStorage.getItem('uaw-metrics-catalog-custom');
        }
        return customCatalogText ? JSON.parse(customCatalogText) : [];
    } catch (e) {
        console.warn('Error parsing custom metrics catalog:', e);
        return [];
    }
}

// Get merged catalog (built-in + custom)
function getMergedMetricsCatalog() {
    const customCatalog = getCustomMetricsCatalog();
    
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

// Get custom validator code
function getCustomValidatorCode() {
    if (window.metricsValidatorEditor) {
        return window.metricsValidatorEditor.getValue();
    }
    return localStorage.getItem('uaw-metrics-validator-custom') || '';
}

// Compact validation display for metrics mode
function displayCompactValidationResults(results) {
    // Use the same grouped display for compact view
    displayGroupedValidationResults(results);
}

function filterValidationResults() {
    // Legacy function - now handled by applyValidationFilter
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
    const nameInput = document.getElementById('metric-name');
    if (nameInput) {
        nameInput.addEventListener('input', updateGeneratedFields);
    }
    
    // Form submission
    form.addEventListener('submit', addCustomMetric);
}

function updateGeneratedFields() {
    const nameInput = document.getElementById('metric-name');
    const idOutput = document.getElementById('generated-metric-id');
    const functionOutput = document.getElementById('generated-function-name');
    const idStatus = document.getElementById('id-status');
    const functionStatus = document.getElementById('function-status');
    
    if (!nameInput || !idOutput || !functionOutput) return;
    
    const name = nameInput.value.trim();
    if (!name) {
        idOutput.textContent = '';
        functionOutput.textContent = '';
        if (idStatus) idStatus.textContent = '';
        if (functionStatus) functionStatus.textContent = '';
        return;
    }
    
    // Generate ID and function name
    const generatedId = `custom.${name.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
    const generatedFunction = `validate${name.replace(/[^a-zA-Z0-9]/g, '')}`;
    
    idOutput.textContent = generatedId;
    functionOutput.textContent = generatedFunction;
    
    // Check for duplicates
    checkForDuplicates(generatedId, generatedFunction, idStatus, functionStatus);
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
    
    // Check function name
    const functionExists = customValidator.includes(`function ${generatedFunction}`);
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

function addCustomMetric() {
    // This would add a custom metric to the catalog
    // Implementation depends on form structure
    console.log('Adding custom metric');
}

// Generate metric catalog entry
function generateMetricCatalogEntry(metricData, parsedParams) {
    return {
        id: metricData.id,
        name: metricData.name,
        description: metricData.description,
        category: metricData.category,
        parameters: parsedParams,
        source: 'custom',
        created: new Date().toISOString()
    };
}

// Generate validator function
function generateValidatorFunction(metricData) {
    const functionName = metricData.functionName;
    const logicType = metricData.logicType;
    
    return getValidationTemplate(logicType).replace(/\$\{functionName\}/g, functionName);
}

function getValidationTemplate(logicType) {
    const templates = {
        'count': `
function \${functionName}(metric) {
    // Count-based validation
    const simulation = metric.simulation;
    const threshold = metric.parameters.threshold || 1;
    
    // Add your counting logic here
    const count = 0; // Replace with actual count
    
    return {
        status: count >= threshold ? 'success' : 'warning',
        message: \`Count: \${count} (threshold: \${threshold})\`,
        value: count
    };
}`,
        'boolean': `
function \${functionName}(metric) {
    // Boolean validation  
    const simulation = metric.simulation;
    
    // Add your boolean logic here
    const isValid = true; // Replace with actual logic
    
    return {
        status: isValid ? 'success' : 'error',
        message: isValid ? 'Validation passed' : 'Validation failed',
        value: isValid
    };
}`,
        'comparison': `
function \${functionName}(metric) {
    // Comparison validation
    const simulation = metric.simulation;
    const expected = metric.parameters.expected;
    const actual = null; // Calculate actual value
    
    const matches = actual === expected;
    
    return {
        status: matches ? 'success' : 'warning',
        message: \`Expected: \${expected}, Actual: \${actual}\`,
        value: { expected, actual, matches }
    };
}`
    };
    
    return templates[logicType] || templates.boolean;
}

function insertMetricIntoCatalog(catalogEntry) {
    const customCatalog = getCustomMetricsCatalog();
    customCatalog.push(catalogEntry);
    safeSetItem('uaw-metrics-catalog-custom', JSON.stringify(customCatalog, null, 2));
}

function insertFunctionIntoValidator(functionCode) {
    const currentValidator = getCustomValidatorCode();
    const newValidator = currentValidator + '\n\n' + functionCode;
    safeSetItem('uaw-metrics-validator-custom', newValidator);
}