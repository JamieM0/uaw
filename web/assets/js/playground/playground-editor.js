// Playground Editor - Monaco editor initialization and management
// Universal Automation Wiki - Simulation Playground

// Helper function to strip comments from a JSON string
// Safely handles comments while preserving strings that might contain // or /*
function stripJsonComments(jsonString) {
    let result = '';
    let inString = false;
    let inSingleLineComment = false;
    let inMultiLineComment = false;
    let escapeNext = false;

    for (let i = 0; i < jsonString.length; i++) {
        const char = jsonString[i];
        const nextChar = jsonString[i + 1];

        // Handle escape sequences in strings
        if (inString && escapeNext) {
            result += char;
            escapeNext = false;
            continue;
        }

        if (inString && char === '\\') {
            result += char;
            escapeNext = true;
            continue;
        }

        // Toggle string state
        if (char === '"' && !inSingleLineComment && !inMultiLineComment && !escapeNext) {
            inString = !inString;
            result += char;
            continue;
        }

        // If we're in a string, just add the character
        if (inString) {
            result += char;
            continue;
        }

        // Handle multi-line comment end
        if (inMultiLineComment) {
            if (char === '*' && nextChar === '/') {
                inMultiLineComment = false;
                i++; // Skip the '/'
            }
            continue;
        }

        // Handle single-line comment end
        if (inSingleLineComment) {
            if (char === '\n') {
                inSingleLineComment = false;
                result += char; // Keep the newline
            }
            continue;
        }

        // Check for comment starts (only when not in string)
        if (char === '/' && nextChar === '/') {
            inSingleLineComment = true;
            i++; // Skip the second '/'
            continue;
        }

        if (char === '/' && nextChar === '*') {
            inMultiLineComment = true;
            i++; // Skip the '*'
            continue;
        }

        // Regular character outside of comments
        result += char;
    }

    return result;
}

// LocalStorage quota checking utility
function canStoreInLocalStorage(key, value) {
    try {
        // Check if localStorage is available
        if (!window.localStorage) return false;

        // Calculate size of the new data
        const dataSize = new Blob([JSON.stringify(value)]).size;
        const keySize = new Blob([key]).size;
        const totalSize = dataSize + keySize;

        // Calculate current usage more efficiently without stringifying entire localStorage
        let currentUsage = 0;
        for (let i = 0; i < localStorage.length; i++) {
            const currentKey = localStorage.key(i);
            if (currentKey) {
                const item = localStorage.getItem(currentKey);
                if (item) {
                    currentUsage += currentKey.length + item.length;
                }
            }
        }

        // Rough localStorage quota check (most browsers have 5-10MB)
        // We'll be conservative and warn if storing more than 4MB total
        const maxSafeSize = 4 * 1024 * 1024; // 4MB

        return (currentUsage + totalSize) < maxSafeSize;
    } catch (e) {
        console.warn('Error checking localStorage capacity:', e.message);
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

// Show visual warning to user about storage issues with recovery options
function showStorageQuotaWarning() {
    // Create or show a warning banner
    let warningBanner = document.getElementById('storage-quota-warning');
    if (!warningBanner) {
        warningBanner = document.createElement('div');
        warningBanner.id = 'storage-quota-warning';
        warningBanner.innerHTML = `
            <div style="background: #ff6b35; color: white; padding: 15px; text-align: center; font-weight: bold; position: fixed; top: 0; left: 0; right: 0; z-index: 10000; box-shadow: 0 2px 4px rgba(0,0,0,0.2);">
                <div style="margin-bottom: 10px;">⚠️ Storage Full: Your work cannot be automatically saved.</div>
                <div style="font-weight: normal; margin-bottom: 10px;">Recovery Options:</div>
                <div style="display: flex; gap: 10px; justify-content: center; flex-wrap: wrap;">
                    <button onclick="clearOldSimulations()" style="background: white; color: #ff6b35; border: none; padding: 5px 10px; border-radius: 3px; cursor: pointer; font-size: 12px;">Clear Old Saves</button>
                    <button onclick="downloadCurrentWork()" style="background: white; color: #ff6b35; border: none; padding: 5px 10px; border-radius: 3px; cursor: pointer; font-size: 12px;">Download Work</button>
                    <button onclick="showStorageUsage()" style="background: white; color: #ff6b35; border: none; padding: 5px 10px; border-radius: 3px; cursor: pointer; font-size: 12px;">View Usage</button>
                    <button onclick="document.getElementById('storage-quota-warning').remove()" style="background: rgba(255,255,255,0.3); color: white; border: none; padding: 5px 10px; border-radius: 3px; cursor: pointer; font-size: 12px;">Dismiss</button>
                </div>
            </div>
        `;
        document.body.appendChild(warningBanner);

        // Don't auto-dismiss since users need time to choose recovery options
    }
}

// Recovery functions for localStorage quota issues
function clearOldSimulations() {
    const keysToRemove = [];

    // Collect keys to remove (iterate carefully as localStorage.key(i) can return null)
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('uaw-') || key.startsWith('simulation-'))) {
            keysToRemove.push(key);
        }
    }

    if (keysToRemove.length === 0) {
        alert('No old simulations found to clear.');
        return;
    }

    if (confirm(`Found ${keysToRemove.length} saved simulation(s). Clear them to free up space?`)) {
        let cleared = 0;
        keysToRemove.forEach(key => {
            try {
                localStorage.removeItem(key);
                cleared++;
            } catch (e) {
                console.warn(`Failed to remove key ${key}:`, e.message);
            }
        });
        alert(`Cleared ${cleared} saved simulation(s). Try saving again.`);
        document.getElementById('storage-quota-warning')?.remove();
    }
}

function downloadCurrentWork() {
    try {
        const editor = getMonacoEditor();
        if (!editor) {
            alert('No editor content found to download.');
            return;
        }

        const content = editor.getValue();
        if (!content || content.trim().length === 0) {
            alert('Editor is empty - nothing to download.');
            return;
        }

        const blob = new Blob([content], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `uaw-simulation-${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        alert('Work downloaded successfully. You can now clear storage or continue without auto-save.');
    } catch (e) {
        console.error('Failed to download work:', e.message);
        alert('Failed to download work: ' + e.message);
    }
}

function showStorageUsage() {
    try {
        let totalSize = 0;
        const keys = [];

        // Calculate total size more efficiently
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key) {
                const item = localStorage.getItem(key);
                const size = item ? (key.length + item.length) : 0;
                totalSize += size;
                if (size > 0) {
                    keys.push({ key, size });
                }
            }
        }

        keys.sort((a, b) => b.size - a.size);

        let message = `Total localStorage usage: ${Math.round(totalSize / 1024)}KB\n\nLargest items:\n`;
        keys.slice(0, 5).forEach(item => {
            message += `• ${item.key}: ${Math.round(item.size / 1024)}KB\n`;
        });

        message += `\nConsider clearing old simulations or downloading current work.`;
        alert(message);
    } catch (e) {
        console.error('Failed to calculate storage usage:', e.message);
        alert('Failed to calculate storage usage: ' + e.message);
    }
}

// Helper function to get Monaco editor instance
function getMonacoEditor() {
    return window.monacoEditor || null;
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
    },
    assets: {
        "image1": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
        "document1": "data:text/plain;base64,SGVsbG8gV29ybGQ="
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

    monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
        validate: true,
        allowComments: true
    });

    const editorElement = document.getElementById("json-editor");
    if (!editorElement) {
        console.error('Critical error: json-editor element not found in DOM');
        if (typeof initState !== 'undefined') {
            initState.editorReady = false;
            initState.monacoLoadFailed = true;
        }
        return;
    }

    editor = monaco.editor.create(
        editorElement,
        {
            value: initialData,
            language: "json",
            theme: isDarkMode ? "vs-dark" : "vs",
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
            formatOnType: true,
            wordWrap: "off",
            wordWrapColumn: 80,
            wordWrapMinified: false
        }
    );

    // Add word wrap toggle to context menu
    editor.addAction({
        id: 'toggle-word-wrap',
        label: 'Toggle Word Wrap',
        contextMenuGroupId: 'navigation',
        contextMenuOrder: 1.5,
        run: function() {
            // Get current word wrap setting using the correct API
            const model = editor.getModel();
            const currentOptions = editor.getOptions();
            const currentWrap = currentOptions.get(monaco.editor.EditorOption.wordWrap);
            const newWrap = (currentWrap === 'off') ? 'bounded' : 'off';

            // Update the editor options with multiple methods to ensure it takes effect
            editor.updateOptions({
                wordWrap: newWrap
            });

            // Try multiple approaches to force the change
            setTimeout(() => {
                editor.layout();

                const model = editor.getModel();
                if (model) {
                    const currentValue = model.getValue();
                    model.setValue(currentValue);
                }

                editor.layout();
            }, 10);

            // Verify the change took effect
            setTimeout(() => {
                const updatedWrap = editor.getOptions().get(monaco.editor.EditorOption.wordWrap);
                const editorDom = editor.getDomNode();
                const viewLines = editorDom.querySelectorAll('.view-line');
            }, 100);
        }
    });

    window.monacoEditor = editor;

    // Restore day type wrapper if it's active, otherwise use Monaco editor
    if (window.activeDayTypeEditor) {
        window.editor = window.activeDayTypeEditor;
    } else {
        window.editor = editor;
    }

    // Auto-collapse 'assets' object if it exists
    setTimeout(async () => {
        await autoCollapseAssetsObject(true); // Move cursor to top on page load
    }, 100); // Small delay to ensure editor is fully initialized

    // Debounced auto-collapse for assets object
    let autoCollapseTimeout;
    let changeTimeout;
    let validationTimeout; // Separate timeout for validation

    const debounceAutoCollapse = () => {
        clearTimeout(autoCollapseTimeout);
        autoCollapseTimeout = setTimeout(async () => {
            try {
                const content = editor.getValue();
                // Only auto-collapse if content contains assets object
                if (content.includes('"assets"')) {
                    await autoCollapseAssetsObject(false); // Preserve cursor position on programmatic updates
                }
            } catch (e) {
                // Ignore errors during typing - user may be mid-edit
                console.debug('Auto-collapse skipped due to error:', e.message);
            }
        }, 1000); // 1 second delay to avoid conflicts with user typing
    };

    // Separate debounced validation with longer delay
    const debounceValidation = () => {
        clearTimeout(validationTimeout);
        validationTimeout = setTimeout(() => {
            validateJSON();
        }, 500); // 500ms delay - longer than render to be less intrusive
    };

    // Editor event handlers
    editor.onDidChangeModelContent(() => {
        if (autoRender) {
            // Skip auto-render if the simulation player is updating the editor
            if (!window.simulationPlayerUpdatingEditor) {
                debounceRender();
            }
        } else {
            // Even if auto-render is off, we still want to create new panels immediately
            updateDynamicPanels();
        }

        // Use separate debounced validation instead of immediate validation
        if (tutorialManager && tutorialManager.isActive) {
            tutorialManager.runStepValidation();
        } else {
            debounceValidation(); // Changed from immediate validateJSON()
        }

        if (spaceEditor && !spaceEditor.isDrawing && !spaceEditor.isDragging && !spaceEditor.isUpdatingJson) {
            try {
                const currentJson = JSON.parse(stripJsonComments(editor.getValue()));
                spaceEditor.loadLayout(currentJson.simulation.layout);
            } catch(e) {
                // Ignore parse errors during typing - user may be mid-edit
                console.debug('Space editor sync skipped due to invalid JSON during editing');
            }
        } else if (spaceEditor) {
            // Mark that sync is needed when interaction prevents update
            spaceEditor.pendingSyncNeeded = true;
        }

        // Auto-collapse assets object after content changes (debounced)
        debounceAutoCollapse();

        // Handle history and localStorage saving
        clearTimeout(changeTimeout);
        changeTimeout = setTimeout(() => {
            saveToHistory();
            // Save current content to localStorage
            try {
                const currentContent = editor.getValue();
                JSON.parse(currentContent); // Validate JSON before saving
                safeSetItem('uaw-json-editor-content', currentContent);
            } catch (e) {
                // Don't save invalid JSON - user may be mid-edit
                console.debug('Skipping localStorage save due to invalid JSON');
            }
        }, 1000);
    });

    // Save initial state to history
    if (typeof saveToHistory === 'function') {
        saveToHistory();
    }

    // Mark editor as ready and try to initialize the playground
    if (typeof initState !== 'undefined') {
        initState.editorReady = true;
    }
    attemptInitializePlayground();
});

// Flag to track programmatic content changes
let isProgrammaticChange = false;

// Store current highlight decorations to prevent memory leaks
let currentHighlightDecorations = [];

// Function to automatically collapse the 'assets' object
async function autoCollapseAssetsObject(moveToTop = false) {
    if (!editor || !monaco) return;

    try {
        const model = editor.getModel();
        if (!model) return;

        // Save current state if we don't want to move to top
        const currentPosition = moveToTop ? null : editor.getPosition();
        const currentScrollTop = moveToTop ? null : editor.getScrollTop();
        const currentScrollLeft = moveToTop ? null : editor.getScrollLeft();

        // Use Monaco's findNextMatch to locate the "assets" property
        const assetsMatch = model.findNextMatch('"assets"\\s*:', { lineNumber: 1, column: 1 }, true, false, null, false);

        if (!assetsMatch) {
            // No assets object found
            return;
        }

        const startLine = assetsMatch.range.startLineNumber;

        // Find the opening brace after "assets":
        let openBraceLine = startLine;
        let openBraceFound = false;
        const content = stripJsonComments(model.getValue());
        const lines = content.split('\n');

        // Look for the opening brace on the same line or subsequent lines
        for (let i = startLine - 1; i < lines.length; i++) {
            const line = lines[i];
            if (line.includes('{')) {
                openBraceLine = i + 1;
                openBraceFound = true;
                break;
            }
        }

        if (!openBraceFound) return;

        // Find the matching closing brace
        let braceCount = 0;
        let endLine = openBraceLine;

        for (let i = openBraceLine - 1; i < lines.length; i++) {
            const line = lines[i];
            for (let j = 0; j < line.length; j++) {
                const char = line[j];
                if (char === '{') {
                    braceCount++;
                } else if (char === '}') {
                    braceCount--;
                    if (braceCount === 0) {
                        endLine = i + 1;
                        break;
                    }
                }
            }
            if (braceCount === 0) break;
        }

        // Create a selection for the entire assets object
        if (endLine > startLine) {
            const selection = new monaco.Selection(startLine, 1, endLine, 1);

            // Set the selection
            editor.setSelections([selection]);

            // Use the createFoldingRangeFromSelection action
            const foldAction = editor.getAction('editor.createFoldingRangeFromSelection');
            if (foldAction) {
                await foldAction.run();
                console.log('Successfully collapsed assets object');
            } else {
                console.warn('createFoldingRangeFromSelection action not available');
            }

            // Clear selection and restore state
            setTimeout(() => {
                // Always clear selection first
                editor.setSelection(new monaco.Selection(1, 1, 1, 1));

                if (moveToTop) {
                    // Move cursor to top of file (page load behavior)
                    editor.setPosition({ lineNumber: 1, column: 1 });
                    editor.revealLine(1);
                } else if (currentPosition) {
                    // Restore complete previous state (programmatic update behavior)
                    editor.setPosition(currentPosition);
                    editor.setScrollTop(currentScrollTop);
                    editor.setScrollLeft(currentScrollLeft);
                }
            }, 50);
        }
    } catch (e) {
        console.warn('Could not auto-collapse assets object:', e);
    }
}

// JSON validation function
function validateJSON() {
    if (!editor) {
        console.warn('Cannot validate JSON: editor not initialized');
        return false;
    }

    const jsonStatus = document.getElementById("json-status");
    const jsonText = editor.getValue();
    const strippedJson = stripJsonComments(jsonText);

    if (!strippedJson.trim()) {
        if (jsonStatus) {
            jsonStatus.className = "validation-indicator warning";
            jsonStatus.textContent = "⚠ Empty Editor";
            jsonStatus.title = "Editor is empty";
        }
        return false;
    }

    try {
        const parsed = JSON.parse(strippedJson);
        if (jsonStatus) {
            jsonStatus.className = "validation-indicator success";
            jsonStatus.textContent = "✓ Valid JSON";
            jsonStatus.title = "JSON syntax is valid";
        }

        // Check if simulation content currently shows any error state and re-render if needed
        const simulationContent = document.getElementById("simulation-content");
        if (simulationContent && (
            simulationContent.innerHTML.includes("Cannot render:") ||
            simulationContent.innerHTML.includes("Render Error:") ||
            simulationContent.innerHTML.includes("var(--error-color)")
        )) {
            // JSON is now valid after being in an error state, trigger a re-render
            if (typeof window.renderSimulation === 'function') {
                window.renderSimulation(true); // Skip JSON validation since we already validated
            } else if (typeof renderSimulation === 'function') {
                renderSimulation(true); // Skip JSON validation since we already validated
            }
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
            const model = editor.getModel();
            if (model) {
                const errorLine = getErrorLine(e.message);
                // Only add marker if we found a valid line number
                if (errorLine > 0 && errorLine <= model.getLineCount()) {
                    monaco.editor.setModelMarkers(model, 'json-syntax', [{
                        severity: monaco.MarkerSeverity.Error,
                        message: e.message,
                        startLineNumber: errorLine,
                        endLineNumber: errorLine,
                        startColumn: 1,
                        endColumn: 1
                    }]);
                } else {
                    // Clear any existing markers if we can't determine the line
                    monaco.editor.setModelMarkers(model, 'json-syntax', []);
                }
            }
        }
        
        return false;
    }
}

// Manual validation function for when auto-validation is disabled
function runManualValidation() {
    if (!editor) {
        console.warn('Cannot run manual validation: editor not initialized');
        return false;
    }

    const jsonText = editor.getValue();
    const strippedJson = stripJsonComments(jsonText);

    if (!strippedJson.trim()) {
        return false;
    }

    try {
        const parsed = JSON.parse(strippedJson);
        
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
    if (!errorMessage || typeof errorMessage !== 'string') {
        return -1; // Return -1 instead of 0 to indicate no valid line number
    }
    const match = errorMessage.match(/line (\d+)/i);
    return match ? parseInt(match[1], 10) : -1; // Return -1 if no match found
}

// Editor utility functions
// Consolidated function to scroll to an item in JSON (task or object)
function scrollToItemInJSON(itemId, itemType = 'item') {
    if (!editor) {
        console.warn(`Cannot scroll to ${itemType}: editor not initialized`);
        return;
    }

    try {
        const editorValue = editor.getValue();
        const lines = editorValue.split('\n');

        // Find the line containing the item ID
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes(`"id": "${itemId}"`)) {
                // Navigate to the line and column
                editor.revealLineInCenter(i + 1);
                editor.setPosition({ lineNumber: i + 1, column: 1 });

                // Clear any existing highlight decorations to prevent memory leaks
                if (currentHighlightDecorations.length > 0) {
                    currentHighlightDecorations = editor.deltaDecorations(currentHighlightDecorations, []);
                }

                // Highlight the line temporarily
                currentHighlightDecorations = editor.deltaDecorations([], [
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
                    if (currentHighlightDecorations.length > 0) {
                        currentHighlightDecorations = editor.deltaDecorations(currentHighlightDecorations, []);
                    }
                }, 2000);

                break;
            }
        }
    } catch (e) {
        console.warn(`Could not scroll to ${itemType} in JSON:`, e.message);
    }
}

// Wrapper functions for backward compatibility
function scrollToTaskInJSON(taskId) {
    scrollToItemInJSON(taskId, 'task');
}

function scrollToObjectInJSON(objectId) {
    scrollToItemInJSON(objectId, 'object');
}
