// Playground Editor - Monaco editor initialization and management
// Universal Automation Wiki - Simulation Playground

// LocalStorage quota checking utility
function canStoreInLocalStorage(key, value) {
    try {
        // Check if localStorage is available
        if (!window.localStorage) return false;
        
        // Calculate size of the data
        const dataSize = new Blob([JSON.stringify(value)]).size;
        const keySize = new Blob([key]).size;
        const totalSize = dataSize + keySize;
        
        // Rough localStorage quota check (most browsers have 5-10MB)
        // We'll be conservative and warn if storing more than 4MB total
        const currentUsage = JSON.stringify(localStorage).length;
        const maxSafeSize = 4 * 1024 * 1024; // 4MB
        
        return (currentUsage + totalSize) < maxSafeSize;
    } catch (e) {
        return false;
    }
}

// Safe localStorage wrapper with error handling
function safeSetItem(key, value) {
    try {
        if (!canStoreInLocalStorage(key, value)) {
            console.warn(`Cannot save to localStorage: quota would be exceeded for key "${key}"`);
            showStorageQuotaWarning();
            return false;
        }
        localStorage.setItem(key, value);
        return true;
    } catch (e) {
        if (e.name === 'QuotaExceededError') {
            console.error('LocalStorage quota exceeded when saving key:', key);
            showStorageQuotaWarning();
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

// Sample simulation data with resources
const sampleSimulation = {
    simulation: {
        meta: {
            id: "sim_breadmaking_v3_full",
            article_title: "Artisan Bread Making Process",
            domain: "Bakery Operations",
        },
        config: {
            time_unit: "minute",
            start_time: "06:00",
            end_time: "18:00",
        },
        layout: {
            meta: {
                units: "meters",
                pixels_per_unit: 20
            },
            locations: [
                {
                    id: "prep_area", name: "Prep Area",
                    shape: { type: "rect", x: 50, y: 50, width: 300, height: 150 }
                },
                {
                    id: "oven_area", name: "Oven Area",
                    shape: { type: "rect", x: 400, y: 50, width: 150, height: 150 }
                }
            ]
        },
        objects: [
            // --- ACTORS ---
            { id: "baker", type: "actor", name: "Baker", properties: { role: "Baker", cost_per_hour: 25, location: "prep_area" }, indicator_property: ["state"] },
            { id: "assistant", type: "actor", name: "Assistant", properties: { role: "Assistant Baker", cost_per_hour: 18, location: "prep_area" }, indicator_property: ["state"] },
            // --- EQUIPMENT ---
            { id: "mixer", type: "equipment", name: "Stand Mixer", properties: { emoji: "🌀", state: "clean", capacity: 1, location: "prep_area" }, indicator_property: ["state"] },
            { id: "oven", type: "equipment", name: "Commercial Oven", properties: { emoji: "🔥", state: "available", capacity: 4, location: "oven_area" }, indicator_property: ["state", "capacity"] },
            { id: "workspace", type: "equipment", name: "Prep Counter", properties: { emoji: "🏢", state: "clean", capacity: 2, location: "prep_area" }, indicator_property: ["state"] },
            { id: "mixing_bowl", type: "equipment", name: "Mixing Bowl", properties: { emoji: "🥣", state: "clean", capacity: 1, location: "prep_area" }, indicator_property: ["state"] },
            // --- RESOURCES (CONSUMABLES) ---
            { id: "flour", type: "resource", name: "Flour", properties: { emoji: "🌾", unit: "kg", quantity: 50, location: "prep_area" }, indicator_property: ["quantity"] },
            { id: "water", type: "resource", name: "Water", properties: { emoji: "💧", unit: "liter", quantity: 20, location: "prep_area" }, indicator_property: ["quantity"] },
            { id: "yeast", type: "resource", name: "Yeast", properties: { emoji: "🦠", unit: "g", quantity: 500, location: "prep_area" }, indicator_property: ["quantity"] },
            // --- PRODUCTS (INTERMEDIATE & FINAL) ---
            { id: "mixed_dough", type: "product", name: "Mixed Dough", properties: { emoji: "🥖", unit: "batch", quantity: 0, location: "prep_area" }, indicator_property: ["quantity"] },
            { id: "risen_dough", type: "product", name: "Risen Dough", properties: { emoji: "🍞", unit: "batch", quantity: 0, location: "prep_area" }, indicator_property: ["quantity"] },
            { id: "shaped_loaves", type: "product", name: "Shaped Loaves", properties: { emoji: "🥖", unit: "loaves", quantity: 0, location: "oven_area" }, indicator_property: ["quantity"] },
            { id: "baked_bread", type: "product", name: "Baked Bread", properties: { emoji: "🍞", unit: "loaves", quantity: 0, location: "oven_area" }, indicator_property: ["quantity"] }
        ],
        tasks: [
            {
                id: "prepare_ingredients", emoji: "🔧", actor_id: "baker", start: "06:15", duration: 30, location: "prep_area",
                depends_on: [],
                interactions: [
                    {
                        object_id: "workspace",
                        property_changes: {
                            state: { from: "clean", to: "in-use" }
                        }
                    }
                ]
            },
            {
                id: "measure_flour", emoji: "⚖️", actor_id: "baker", start: "06:45", duration: 10, location: "prep_area",
                depends_on: ["prepare_ingredients"]
            },
            {
                id: "activate_yeast", emoji: "🦠", actor_id: "assistant", start: "06:45", duration: 10, location: "prep_area",
                depends_on: [],
                interactions: [
                    {
                        object_id: "yeast",
                        property_changes: {
                            quantity: { delta: -15 }
                        }
                    }
                ]
            },
            {
                id: "mix_dough", emoji: "🥄", actor_id: "baker", start: "06:55", duration: 20, location: "prep_area",
                depends_on: ["measure_flour", "activate_yeast"],
                interactions: [
                    {
                        object_id: "flour",
                        property_changes: {
                            quantity: { delta: -1 }
                        }
                    },
                    {
                        object_id: "water",
                        property_changes: {
                            quantity: { delta: -0.7 }
                        }
                    },
                    {
                        object_id: "mixed_dough",
                        property_changes: {
                            quantity: { delta: 1 }
                        }
                    },
                    {
                        object_id: "mixer",
                        property_changes: {
                            state: { from: "clean", to: "dirty" }
                        }
                    },
                    {
                        object_id: "mixing_bowl",
                        property_changes: {
                            state: { from: "clean", to: "dirty" }
                        }
                    }
                ]
            },
            {
                id: "knead_dough", emoji: "👋", actor_id: "baker", start: "07:15", duration: 15, location: "prep_area",
                depends_on: ["mix_dough"],
                interactions: [
                    {
                        object_id: "mixed_dough",
                        property_changes: {
                            quantity: { delta: -1 }
                        }
                    },
                    {
                        object_id: "risen_dough",
                        property_changes: {
                            quantity: { delta: 1 }
                        }
                    },
                    {
                        object_id: "workspace",
                        property_changes: {
                            state: { from: "in-use", to: "dirty" }
                        }
                    }
                ]
            },
            {
                id: "first_rise", emoji: "⏰", actor_id: "baker", start: "07:30", duration: 90, location: "prep_area",
                depends_on: ["knead_dough"],
                interactions: [
                    {
                        object_id: "risen_dough",
                        property_changes: {
                            quantity: { delta: -1 }
                        }
                    },
                    {
                        object_id: "risen_dough",
                        property_changes: {
                            quantity: { delta: 1 }
                        }
                    },
                    {
                        object_id: "workspace",
                        property_changes: {
                            state: { from: "dirty", to: "occupied" }
                        },
                        revert_after: true
                    }
                ]
            },
            {
                id: "clean_mixing_bowls", emoji: "🧼", actor_id: "assistant", start: "07:30", duration: 20, location: "prep_area",
                depends_on: [],
                interactions: [
                    {
                        object_id: "mixing_bowl",
                        property_changes: {
                            state: { from: "dirty", to: "clean" }
                        }
                    }
                ]
            },
            {
                id: "shape_loaves", emoji: "👐", actor_id: "baker", start: "09:00", duration: 25, location: "prep_area",
                depends_on: ["first_rise"],
                interactions: [
                    {
                        object_id: "risen_dough",
                        property_changes: {
                            quantity: { delta: -1 }
                        }
                    },
                    {
                        object_id: "shaped_loaves",
                        property_changes: {
                            quantity: { delta: 1 }
                        }
                    },
                    {
                        object_id: "workspace",
                        property_changes: {
                            state: { from: "dirty", to: "dirty" }
                        }
                    }
                ]
            },
            {
                id: "prepare_baking_sheets", emoji: "🍞", actor_id: "assistant", start: "09:00", duration: 10, location: "prep_area",
                depends_on: []
            },
            {
                id: "preheat_oven", emoji: "🔥", actor_id: "assistant", start: "09:05", duration: 15, location: "oven_area",
                depends_on: ["prepare_baking_sheets"],
                interactions: [
                    {
                        object_id: "oven",
                        property_changes: {
                            state: { from: "available", to: "in-use" }
                        }
                    }
                ]
            },
            {
                id: "second_rise", emoji: "⏳", actor_id: "baker", start: "09:25", duration: 45, location: "prep_area",
                depends_on: ["shape_loaves"],
                interactions: [
                    {
                        object_id: "shaped_loaves",
                        property_changes: {
                            quantity: { delta: -1 }
                        }
                    },
                    {
                        object_id: "shaped_loaves",
                        property_changes: {
                            quantity: { delta: 1 }
                        }
                    }
                ]
            },
            {
                id: "bake_bread", emoji: "🍞", actor_id: "baker", start: "10:10", duration: 35, location: "oven_area",
                depends_on: ["second_rise"],
                interactions: [
                    {
                        object_id: "shaped_loaves",
                        property_changes: {
                            quantity: { delta: -1 }
                        }
                    },
                    {
                        object_id: "baked_bread",
                        property_changes: {
                            quantity: { delta: 1 }
                        }
                    },
                    {
                        object_id: "oven",
                        property_changes: {
                            state: { from: "in-use", to: "available" }
                        }
                    }
                ]
            },
            {
                id: "wash_equipment", emoji: "🧽", actor_id: "assistant", start: "10:10", duration: 35, location: "prep_area",
                depends_on: [],
                interactions: [
                    {
                        object_id: "mixer",
                        property_changes: {
                            state: { from: "dirty", to: "clean" }
                        }
                    }
                ]
            }
        ]
    }
};

// Monaco editor initialization with timeout and error handling
require.config({
    paths: { vs: "https://unpkg.com/monaco-editor@0.44.0/min/vs" },
});

// Set a timeout for Monaco loading
const monacoTimeout = setTimeout(() => {
    console.error('Monaco editor loading timed out');
    if (typeof initState !== 'undefined') {
        initState.monacoLoadFailed = true;
        if (typeof attemptInitializePlayground === 'function') {
            attemptInitializePlayground();
        }
    }
}, 10000); // 10 second timeout

// Handle require.js errors
if (typeof require !== 'undefined' && require.onError) {
    require.onError = function (err) {
        console.error('RequireJS loading error:', err);
        clearTimeout(monacoTimeout);
        if (typeof initState !== 'undefined') {
            initState.monacoLoadFailed = true;
            if (typeof attemptInitializePlayground === 'function') {
                attemptInitializePlayground();
            }
        }
    };
}

require(["vs/editor/editor.main"], function () {
    // Clear the timeout since Monaco loaded successfully
    clearTimeout(monacoTimeout);
    
    // Try to load saved content from localStorage first
    const savedContent = localStorage.getItem('uaw-json-editor-content');
    let initialData;
    
    if (savedContent) {
        try {
            // Validate that saved content is valid JSON
            JSON.parse(savedContent);
            initialData = savedContent;
        } catch (e) {
            console.warn('Corrupted localStorage data detected, clearing:', e.message);
            localStorage.removeItem('uaw-json-editor-content');
            initialData = null;
        }
    }
    
    // If no saved content or invalid, use default
    if (!initialData) {
        const defaultSimulation = window.simulationLibrary ? 
            window.simulationLibrary.simulations.find(s => s.id === 'breadmaking') : 
            null;
        const defaultSimulationData = defaultSimulation ? 
            { simulation: defaultSimulation.simulation } : 
            sampleSimulation;
        initialData = JSON.stringify(defaultSimulationData, null, 2);
    }

    editor = monaco.editor.create(
        document.getElementById("json-editor"),
        {
            value: initialData,
            language: "json",
            theme: "vs",
            automaticLayout: true,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            fontSize: 14,
            lineNumbers: "on",
            roundedSelection: false,
            scrollbar: { vertical: "visible", horizontal: "visible" },
            folding: true,
            bracketMatching: "always",
            formatOnPaste: true,
            formatOnType: true
        }
    );

    // Editor event handlers
    editor.onDidChangeModelContent(() => {
        if (autoRender) { 
            debounceRender(); 
        } else {
            // Even if auto-render is off, we still want to create new panels immediately
            updateDynamicPanels();
        }

        if (tutorialManager && tutorialManager.isActive) {
            tutorialManager.runStepValidation();
        } else {
            validateJSON();
        }

        if (spaceEditor && !spaceEditor.isDrawing && !spaceEditor.isDragging && !spaceEditor.isUpdatingJson) {
            try {
                const currentJson = JSON.parse(editor.getValue());
                spaceEditor.loadLayout(currentJson.simulation.layout);
            } catch(e) { /* Ignore parse errors during typing */ }
        }
    });

    let changeTimeout;
    editor.onDidChangeModelContent(() => {
        clearTimeout(changeTimeout);
        changeTimeout = setTimeout(() => { 
            saveToHistory(); 
            // Save current content to localStorage
            try {
                const currentContent = editor.getValue();
                JSON.parse(currentContent); // Validate JSON before saving
                safeSetItem('uaw-json-editor-content', currentContent);
            } catch (e) {
                // Don't save invalid JSON
            }
        }, 1000);
    });

    // Mark editor as ready and try to initialize the playground
    if (typeof initState !== 'undefined') {
        initState.editorReady = true;
    }
    attemptInitializePlayground();
});

// JSON validation function
function validateJSON() {
    const jsonStatus = document.getElementById("json-status");
    const jsonText = editor.getValue();

    if (!jsonText.trim()) {
        if (jsonStatus) {
            jsonStatus.className = "validation-indicator warning";
            jsonStatus.textContent = "⚠ Empty Editor";
            jsonStatus.title = "Editor is empty";
        }
        return false;
    }

    try {
        const parsed = JSON.parse(jsonText);
        if (jsonStatus) {
            jsonStatus.className = "validation-indicator success";
            jsonStatus.textContent = "✓ Valid JSON";
            jsonStatus.title = "JSON syntax is valid";
        }

        // Get merged catalog (built-in + custom metrics)
        const mergedCatalog = getMergedMetricsCatalog();
        
        // Only run simulation metrics validation if auto-validation is enabled
        if (window.autoValidationEnabled !== false && mergedCatalog && mergedCatalog.length > 0 && window.SimulationValidator) {
            const validator = new window.SimulationValidator(parsed);
            const customValidator = getCustomValidatorCode();
            const validationResults = validator.runChecks(mergedCatalog, customValidator);
            displayValidationResults(validationResults);
        } else if (window.autoValidationEnabled === false) {
            // Clear validation results when auto-validation is disabled
            displayValidationResults([]);
        }

        // Clear any syntax error highlighting
        if (monaco && monaco.editor && editor && editor.getModel) {
            monaco.editor.setModelMarkers(editor.getModel(), 'json-syntax', []);
        }

        return true;
    } catch (e) {
        if (jsonStatus) {
            jsonStatus.className = "validation-indicator error";
            jsonStatus.textContent = `✗ Invalid JSON: ${e.message}`;
            jsonStatus.title = `JSON Parse Error: ${e.message}`;
        }
        
        // Show JSON syntax errors in editor
        if (monaco && monaco.editor && editor && editor.getModel) {
            const errorLine = getErrorLine(e.message);
            if (errorLine > 0) {
                monaco.editor.setModelMarkers(editor.getModel(), 'json-syntax', [{
                    severity: monaco.MarkerSeverity.Error,
                    message: e.message,
                    startLineNumber: errorLine,
                    endLineNumber: errorLine,
                    startColumn: 1,
                    endColumn: 1
                }]);
            }
        }
        
        return false;
    }
}

// Manual validation function for when auto-validation is disabled
function runManualValidation() {
    const jsonText = editor.getValue();

    if (!jsonText.trim()) {
        return false;
    }

    try {
        const parsed = JSON.parse(jsonText);
        
        // Get merged catalog (built-in + custom metrics)
        const mergedCatalog = getMergedMetricsCatalog();
        
        if (mergedCatalog && mergedCatalog.length > 0 && window.SimulationValidator) {
            const validator = new window.SimulationValidator(parsed);
            const customValidator = getCustomValidatorCode();
            const validationResults = validator.runChecks(mergedCatalog, customValidator);
            displayValidationResults(validationResults);
        }
        
        return true;
    } catch (e) {
        // JSON is invalid, don't run simulation validation
        return false;
    }
}

function getErrorLine(errorMessage) {
    const match = errorMessage.match(/line (\d+)/i);
    return match ? parseInt(match[1]) : 0;
}

// Editor utility functions
function scrollToTaskInJSON(taskId) {
    if (!editor) return;
    
    try {
        const editorValue = editor.getValue();
        const lines = editorValue.split('\n');
        
        // Find the line containing the task ID
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes(`"id": "${taskId}"`)) {
                // Navigate to the line and column
                editor.revealLineInCenter(i + 1);
                editor.setPosition({ lineNumber: i + 1, column: 1 });
                
                // Highlight the line temporarily
                const decoration = editor.deltaDecorations([], [
                    {
                        range: new monaco.Range(i + 1, 1, i + 1, lines[i].length + 1),
                        options: {
                            className: 'highlighted-line',
                            isWholeLine: true
                        }
                    }
                ]);
                
                // Remove highlighting after 2 seconds
                setTimeout(() => {
                    editor.deltaDecorations(decoration, []);
                }, 2000);
                
                break;
            }
        }
    } catch (e) {
        console.warn('Could not scroll to task in JSON:', e);
    }
}

function scrollToObjectInJSON(objectId) {
    if (!editor) return;
    
    try {
        const editorValue = editor.getValue();
        const lines = editorValue.split('\n');
        
        // Find the line containing the object ID
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes(`"id": "${objectId}"`)) {
                // Navigate to the line and column
                editor.revealLineInCenter(i + 1);
                editor.setPosition({ lineNumber: i + 1, column: 1 });
                
                // Highlight the line temporarily
                const decoration = editor.deltaDecorations([], [
                    {
                        range: new monaco.Range(i + 1, 1, i + 1, lines[i].length + 1),
                        options: {
                            className: 'highlighted-line',
                            isWholeLine: true
                        }
                    }
                ]);
                
                // Remove highlighting after 2 seconds
                setTimeout(() => {
                    editor.deltaDecorations(decoration, []);
                }, 2000);
                
                break;
            }
        }
    } catch (e) {
        console.warn('Could not scroll to object in JSON:', e);
    }
}