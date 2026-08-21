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
        alert('Work downloaded successfully.');
    } catch (e) {
        console.error('Failed to download work:', e.message);
        alert('Failed to download work: ' + e.message);
    }
}

// Helper function to get Monaco editor instance
function getMonacoEditor() {
    return window.monacoEditor || null;
}

// Sample simulation data with resources
const legacySampleSimulation = {
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

// Sample WorkSpec v2.0 document (fallback when library isn't loaded)
const sampleSimulation = {
    "$schema": "https://universalautomation.wiki/workspec/v2.0.schema.json",
    "simulation": {
        "schema_version": "2.0",
        "meta": {
            "title": "WorkSpec v2.0 Sample",
            "description": "A minimal WorkSpec v2.0 simulation used as a WorkSpec Studio fallback.",
            "domain": "Example"
        },
        "config": {
            "time_unit": "minutes",
            "start_time": "06:00",
            "end_time": "18:00",
            "timezone": "UTC",
            "currency": "USD",
            "locale": "en-US"
        },
        "world": {
            "layout": {
                "meta": {
                    "units": "meters",
                    "pixels_per_unit": 20
                },
                "locations": [
                    {
                        "id": "work_area",
                        "name": "Work Area",
                        "shape": { "type": "rect", "x": 0, "y": 0, "width": 10, "height": 5 }
                    }
                ]
            },
            "objects": [
                {
                    "id": "worker",
                    "type": "actor",
                    "name": "Worker",
                    "emoji": "🧑‍🏭",
                    "location": "work_area",
                    "properties": {
                        "role": "Operator",
                        "cost_per_hour": 25,
                        "state": "available"
                    }
                },
                {
                    "id": "material",
                    "type": "resource",
                    "name": "Material",
                    "emoji": "📦",
                    "location": "work_area",
                    "properties": {
                        "unit": "units",
                        "quantity": 10,
                        "cost_per_unit": 1
                    }
                },
                {
                    "id": "output",
                    "type": "product",
                    "name": "Output",
                    "emoji": "✅",
                    "location": "work_area",
                    "properties": {
                        "unit": "units",
                        "quantity": 0,
                        "revenue_per_unit": 5
                    }
                }
            ]
        },
        "process": {
            "tasks": [
                {
                    "id": "do_work",
                    "emoji": "🛠️",
                    "actor_id": "worker",
                    "start": "06:00",
                    "duration": 30,
                    "location": "work_area",
                    "depends_on": [],
                    "interactions": [
                        {
                            "target_id": "material",
                            "property_changes": { "quantity": { "delta": -1 } }
                        },
                        {
                            "target_id": "output",
                            "property_changes": { "quantity": { "delta": 1 } }
                        }
                    ]
                }
            ],
            "recipes": {}
        }
    },
    "assets": {
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
    
    // Folder-backed ProjectStore replaces this placeholder as soon as a project
    // is opened. Legacy browser drafts are handled by its explicit migration UI.
    const initialData = JSON.stringify(sampleSimulation, null, 2);

    monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
        validate: true,
        allowComments: true
    });

    // Best-effort: wire WorkSpec v2 JSON Schema for autocomplete + validation.
    // Prefer the package mirror path, with legacy fallback.
    const schemaCandidates = [
        '/packages/workspec/v2.0.schema.json',
        '/workspec/v2.0.schema.json'
    ];

    function fetchFirstSchema(urls) {
        if (!Array.isArray(urls) || urls.length === 0) {
            return Promise.resolve(null);
        }

        const [first, ...rest] = urls;
        return fetch(first)
            .then((res) => (res && res.ok) ? res.json() : null)
            .then((schema) => {
                if (schema) return schema;
                return fetchFirstSchema(rest);
            })
            .catch(() => fetchFirstSchema(rest));
    }

    fetchFirstSchema(schemaCandidates)
        .then((schema) => {
            if (!schema) return;
            monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
                validate: true,
                allowComments: true,
                schemas: [
                    {
                        uri: 'https://universalautomation.wiki/workspec/v2.0.schema.json',
                        fileMatch: ['*'],
                        schema: schema
                    }
                ]
            });
        })
        .catch((error) => {
            console.warn('Failed to load WorkSpec v2 schema:', error);
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

    // Reassert the model language and theme after construction.  Monaco can
    // retain a plain-text model when another integration replaces or restores
    // editor content during startup, which removes JSON token colours while
    // leaving the editor otherwise usable.
    const editorModel = editor.getModel();
    if (editorModel && monaco.editor.setModelLanguage) {
        monaco.editor.setModelLanguage(editorModel, "json");
    }
    monaco.editor.setTheme(isDarkMode ? "vs-dark" : "vs");

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
                const sim = currentJson.simulation || currentJson;
                const layout = sim?.world?.layout || sim?.layout;
                if (layout) {
                    spaceEditor.loadLayout(layout);
                }
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

        // Editor history is in-memory. Durable writes are owned by ProjectStore.
        clearTimeout(changeTimeout);
        changeTimeout = setTimeout(() => {
            saveToHistory();
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
    window.dispatchEvent(new CustomEvent('uaw:editor-ready', {
        detail: { editor }
    }));
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

        // Only run validation if auto-validation is enabled
        if (window.autoValidationEnabled !== false) {
            // Prefer WorkSpec v2 validator (RFC 7807 Problem Details)
            if (window.WorkSpecValidator && typeof window.WorkSpecValidator.validate === 'function') {
                const result = window.WorkSpecValidator.validate(parsed);
                const problems = Array.isArray(result?.problems) ? result.problems : [];
                const mapped = problems.map((problem) => ({
                    metricId: problem.metric_id || 'system.error',
                    status: problem.severity === 'warning' ? 'warning' : problem.severity === 'info' ? 'suggestion' : 'error',
                    message: problem.detail || problem.title || problem.metric_id || 'Validation error',
                    problem
                }));

                if (mapped.length === 0) {
                    displayValidationResults([{
                        metricId: 'workspec.validation.ok',
                        status: 'success',
                        message: 'No problems found.'
                    }]);
                } else {
                    displayValidationResults(mapped);
                }
            } else if (mergedCatalog && mergedCatalog.length > 0 && window.SimulationValidator) {
                // Fallback: legacy metrics validator
                const validator = new window.SimulationValidator(parsed);
                // Custom validators run asynchronously from the Metrics Editor.
                // Auto-validation must remain synchronous, so only execute
                // built-in checks here instead of reporting a false error for
                // every custom metric.
                const validationResults = validator.runChecks(mergedCatalog);
                displayValidationResults(validationResults);
            } else {
                displayValidationResults([]);
            }
        } else {
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

        if (typeof displayValidationResults === 'function') {
            displayValidationResults([{
                metricId: 'json.syntax',
                status: 'error',
                message: e.message
            }]);
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
        
        // Prefer WorkSpec v2 validator (RFC 7807 Problem Details)
        if (window.WorkSpecValidator && typeof window.WorkSpecValidator.validate === 'function') {
            const result = window.WorkSpecValidator.validate(parsed);
            const problems = Array.isArray(result?.problems) ? result.problems : [];
            const mapped = problems.map((problem) => ({
                metricId: problem.metric_id || 'system.error',
                status: problem.severity === 'warning' ? 'warning' : problem.severity === 'info' ? 'suggestion' : 'error',
                message: problem.detail || problem.title || problem.metric_id || 'Validation error',
                problem
            }));

            if (mapped.length === 0) {
                displayValidationResults([{
                    metricId: 'workspec.validation.ok',
                    status: 'success',
                    message: 'No problems found.'
                }]);
            } else {
                displayValidationResults(mapped);
            }
        } else {
            // Fallback: legacy metrics validator
            const mergedCatalog = getMergedMetricsCatalog();
            if (mergedCatalog && mergedCatalog.length > 0 && window.SimulationValidator) {
                const validator = new window.SimulationValidator(parsed);
                // See the auto-validation fallback above: custom checks use
                // the asynchronous Metrics Editor workflow.
                const validationResults = validator.runChecks(mergedCatalog);
                displayValidationResults(validationResults);
            }
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
