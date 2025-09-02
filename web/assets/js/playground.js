// Playground JavaScript for Universal Automation Wiki
// Main application logic for the simulation playground

document.addEventListener('DOMContentLoaded', () => {
    const welcomeOverlay = document.getElementById('welcome-overlay');
    const continueBtn = document.getElementById('welcome-continue-btn');
    const dontShowAgainCheckbox = document.getElementById('dont-show-again');

    if (localStorage.getItem('uaw-playground-welcome-seen')) {
        welcomeOverlay.style.display = 'none';
    }

    continueBtn.addEventListener('click', () => {
        welcomeOverlay.style.display = 'none';
        if (dontShowAgainCheckbox.checked) {
            localStorage.setItem('uaw-playground-welcome-seen', 'true');
        }
    });
});

let editor;
let tutorialManager, player, spaceEditor, emojiPicker;
let tutorialData = null;
let isPlaygroundInitialized = false; // Flag to prevent double-initialization
let autoRender = true;

// Metrics Editor Variables
let metricsEditor = null;
let isMetricsMode = false;

// --- DATA FETCHING ---
Promise.all([
    fetch('/assets/static/tutorial-content.json').then(res => {
        if (!res.ok) throw new Error(`Fetch failed for tutorial-content.json: ${res.statusText}`);
        return res.json();
    }),
    fetch('/assets/static/metrics-catalog.json').then(res => {
        if (!res.ok) throw new Error(`Fetch failed for metrics-catalog.json: ${res.statusText}`);
        return res.json();
    }),
    fetch('/assets/static/simulation-library.json').then(res => {
        if (!res.ok) throw new Error(`Fetch failed for simulation-library.json: ${res.statusText}`);
        return res.json();
    })
]).then(([tutData, metData, simLibData]) => {
    tutorialData = tutData;
    window.metricsCatalog = metData;
    window.simulationLibrary = simLibData;
    // Populate simulation library dropdown
    populateSimulationLibrary();
    // Now that data is ready, try to initialize.
    // If the editor isn't ready, this will do nothing. The editor's callback will handle it.
    attemptInitializePlayground();
}).catch(error => {
    console.error("FETCH FAILED: Critical error loading initial data.", error);
});

// --- CORE INITIALIZATION FUNCTION ---
function initializePlayground() {
    setupTabs();
    updateAutoRenderUI();
    initializeResizeHandles();
    initializeDragAndDrop();
    setupSaveLoadButtons();
    setupMetricsMode();

    const canvas = document.getElementById('space-canvas');
    const propsPanel = document.getElementById('properties-panel-content');
    if (canvas && propsPanel) {
        spaceEditor = new SpaceEditor(canvas, propsPanel, editor);
    } else {
        console.error("INIT ERROR: Canvas or Properties Panel element not found!");
    }
    
    initializeEmojiPicker();
    initializeTutorial();
    initializeExperimentalLLM();

    renderSimulation();
    validateJSON();
}

// --- SIMULATION LIBRARY FUNCTIONALITY ---
function populateSimulationLibrary() {
    const dropdown = document.getElementById('simulation-library-dropdown');
    if (!dropdown || !window.simulationLibrary) return;
    
    dropdown.innerHTML = ''; // Clear existing options
    
    window.simulationLibrary.simulations.forEach(simulation => {
        const option = document.createElement('a');
        option.href = '#';
        option.textContent = simulation.name;
        option.title = `${simulation.description} (${simulation.complexity})`;
        option.dataset.simulationId = simulation.id;
        
        option.addEventListener('click', (e) => {
            e.preventDefault();
            loadSimulationFromLibrary(simulation.id);
        });
        
        dropdown.appendChild(option);
    });
}

function loadSimulationFromLibrary(simulationId) {
    const simulation = window.simulationLibrary.simulations.find(s => s.id === simulationId);
    if (!simulation) {
        console.error(`Simulation with ID ${simulationId} not found`);
        return;
    }
    
    if (spaceEditor) {
        spaceEditor.hasInitiallyLoaded = false;
    }
    
    // Load the simulation data into the editor
    const simulationData = { simulation: simulation.simulation };
    editor.setValue(JSON.stringify(simulationData, null, 2));
    
    if (autoRender) {
        renderSimulation();
    }
}

// --- SINGLE POINT OF ENTRY FOR INITIALIZATION ---
function attemptInitializePlayground() {
    // This function can be called from either async operation (fetch or monaco).
    // It will only run the actual initialization once all conditions are met.
    if (isPlaygroundInitialized) return; // Already done, do nothing.
    if (editor && tutorialData && window.metricsCatalog && window.simulationLibrary) {
        isPlaygroundInitialized = true; // Set flag to prevent re-entry
        initializePlayground();
    }
}

// --- MONACO EDITOR INITIALIZATION ---
require.config({
    paths: { vs: "https://unpkg.com/monaco-editor@0.44.0/min/vs" },
});
require(["vs/editor/editor.main"], function () {
    // Try to load saved content from localStorage first
    const savedContent = localStorage.getItem('uaw-json-editor-content');
    let initialData;
    
    if (savedContent) {
        try {
            // Validate that saved content is valid JSON
            JSON.parse(savedContent);
            initialData = savedContent;
            console.log('✅ Loaded saved JSON editor content from localStorage');
        } catch (e) {
            console.warn('⚠️ Invalid saved JSON content, using default');
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

    // --- EVENT HANDLERS ---
    editor.onDidChangeModelContent(() => {
        if (autoRender) { debounceRender(); }

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
                localStorage.setItem('uaw-json-editor-content', currentContent);
            } catch (e) {
                // Don't save invalid JSON
            }
        }, 1000);
    });

    // Now that the editor is ready, try to initialize the playground.
    attemptInitializePlayground();
});

function setupTabs() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetTab = button.dataset.tab;

            tabButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');

            tabContents.forEach(content => {
                content.classList.remove('active');
            });

            // Map tab names to content IDs correctly
            if (targetTab === 'timeline') {
                document.getElementById('simulation-tab').classList.add('active');
            } else if (targetTab === 'space-editor') {
                document.getElementById('space-editor-tab').classList.add('active');
                // Load current simulation data into space editor when tab is opened
                if (spaceEditor) {
                    try {
                        const currentJson = JSON.parse(editor.getValue());
                        // Force zoom to fit when switching to space editor tab
                        spaceEditor.loadLayout(currentJson.simulation.layout, true);
                    } catch(e) {
                    }
                }
            }
        });
    });
}

// History system for undo functionality
let history = [];
let historyIndex = -1;
const MAX_HISTORY = 50;

// Drag and drop state
let isDragging = false;
let draggedTask = null;
let dragStartX = 0;
let dragStartY = 0;
let originalTaskData = null;

// Resize state
let isResizing = false;
let resizeType = null; // 'left' or 'right'
let resizeHandle = null;
let originalDuration = 0;
let originalStartTime = null;
let durationPreview = null;

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
            { id: "baker", type: "actor", name: "Baker", properties: { role: "Baker", cost_per_hour: 25, location: "prep_area" } },
            { id: "assistant", type: "actor", name: "Assistant", properties: { role: "Assistant Baker", cost_per_hour: 18, location: "prep_area" } },
            // --- EQUIPMENT ---
            { id: "mixer", type: "equipment", name: "Stand Mixer", emoji: "🌀", properties: { state: "clean", capacity: 1, location: "prep_area" } },
            { id: "oven", type: "equipment", name: "Commercial Oven", emoji: "🔥", properties: { state: "available", capacity: 4, location: "oven_area" } },
            { id: "workspace", type: "equipment", name: "Prep Counter", emoji: "🏢", properties: { state: "clean", capacity: 2, location: "prep_area" } },
            { id: "mixing_bowl", type: "equipment", name: "Mixing Bowl", emoji: "🥣", properties: { state: "clean", capacity: 1, location: "prep_area" } },
            // --- RESOURCES (CONSUMABLES) ---
            { id: "flour", type: "resource", name: "Flour", emoji: "🌾", properties: { unit: "kg", quantity: 50, location: "prep_area" } },
            { id: "water", type: "resource", name: "Water", emoji: "💧", properties: { unit: "liter", quantity: 20, location: "prep_area" } },
            { id: "yeast", type: "resource", name: "Yeast", emoji: "🦠", properties: { unit: "g", quantity: 500, location: "prep_area" } },
            // --- PRODUCTS (INTERMEDIATE & FINAL) ---
            { id: "mixed_dough", type: "product", name: "Mixed Dough", emoji: "덩", properties: { unit: "batch", quantity: 0, location: "prep_area" } },
            { id: "risen_dough", type: "product", name: "Risen Dough", emoji: "🍞", properties: { unit: "batch", quantity: 0, location: "prep_area" } },
            { id: "shaped_loaves", type: "product", name: "Shaped Loaves", emoji: "🥖", properties: { unit: "loaves", quantity: 0, location: "oven_area" } },
            { id: "baked_bread", type: "product", name: "Baked Bread", emoji: "🍞", properties: { unit: "loaves", quantity: 0, location: "oven_area" } }
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

// History management
function saveToHistory() {
    const currentValue = editor.getValue();
    if (
        history.length > 0 &&
        history[historyIndex] === currentValue
    ) {
        return;
    }

    if (historyIndex < history.length - 1) {
        history = history.slice(0, historyIndex + 1);
    }

    history.push(currentValue);

    if (history.length > MAX_HISTORY) {
        history.shift();
    } else {
        historyIndex++;
    }

    updateUndoButton();
}

function undo() {
    if (historyIndex > 0) {
        historyIndex--;
        const previousValue = history[historyIndex];
        editor.setValue(previousValue);
        updateUndoButton();

        if (autoRender) {
            debounceRender();
        }
        validateJSON();
    }
}

function updateUndoButton() {
    const undoBtn = document.getElementById("undo-btn");
    undoBtn.disabled = historyIndex <= 0;
}

async function initializeEmojiPicker() {
    try {
        // Create and initialize emoji picker
        emojiPicker = new EmojiPicker({
            theme: 'uaw',
            searchPlaceholder: 'Search workplace emojis...',
            maxRecentEmojis: 24
        });
        
        const initialized = await emojiPicker.initialize();
        
        if (initialized) {
            // Attach to existing emoji input fields by ID
            const taskEmojiInput = document.getElementById('task-emoji-input');
            const objectEmojiInput = document.getElementById('object-emoji-input');
            
            if (taskEmojiInput) {
                emojiPicker.attachToInput(taskEmojiInput, { autoOpen: true });
            }
            
            if (objectEmojiInput) {
                emojiPicker.attachToInput(objectEmojiInput, { autoOpen: true });
            }
            
            // Attach to all emoji input fields by class
            const emojiFields = document.querySelectorAll('.object-emoji, input[maxlength="2"]');
            emojiFields.forEach(field => {
                // Skip if already attached by ID
                if (field.id === 'task-emoji-input' || field.id === 'object-emoji-input') {
                    return;
                }
                
                emojiPicker.attachToInput(field, { autoOpen: true });
            });
            
            // Attach to Monaco editor if available
            if (editor) {
                emojiPicker.attachToMonaco(editor);
            }
            
            // Make emoji picker globally accessible for dynamic field attachment
            window.emojiPicker = emojiPicker;
        } else {
            console.warn("INIT: Emoji picker failed to initialize");
        }
    } catch (error) {
        console.error("INIT: Emoji picker initialization error:", error);
    }
}

function initializeTutorial() {
    if (!tutorialData || !editor) return;

    const playgroundElements = {
        panel: document.getElementById('tutorial-panel'),
        title: document.getElementById('tutorial-title'),
        instructions: document.getElementById('tutorial-instructions'),
        status: document.getElementById('tutorial-status'),
        nextBtn: document.getElementById('tutorial-next-btn'),
        prevBtn: document.getElementById('tutorial-prev-btn'),
        exitBtn: document.getElementById('tutorial-exit-btn')
    };

    tutorialManager = new TutorialManager(tutorialData, editor, playgroundElements);

    document.getElementById('start-tutorial-btn').addEventListener('click', (e) => {
        e.preventDefault();
        document.querySelector('.dropdown-content').style.display = 'none'; // Hide dropdown
        tutorialManager.start();
    });
}

// Task click to scroll functionality
function scrollToTaskInJSON(taskId) {
    const jsonText = editor.getValue();
    const lines = jsonText.split("\n");

    let targetLine = -1;
    for (let i = 0; i < lines.length; i++) {
        if (
            lines[i].includes(taskId) &&
            lines[i].includes('"id"')
        ) {
            targetLine = i + 1;
            break;
        }
    }

    if (targetLine > 0) {
        editor.revealLineInCenter(targetLine);

        const range = new monaco.Range(
            targetLine,
            1,
            targetLine,
            1,
        );
        const decoration = editor.createDecorationsCollection([
            {
                range: range,
                options: {
                    isWholeLine: true,
                    className: "json-highlight",
                },
            },
        ]);

        setTimeout(() => {
            decoration.clear();
        }, 1000);
    }
}

function scrollToObjectInJSON(objectId) {
    const jsonText = editor.getValue();
    const lines = jsonText.split("\n");
    let targetLine = -1;
    
    // Search in equipment, resources, actors, products arrays
    for (let i = 0; i < lines.length; i++) {
        if (
            lines[i].includes(objectId) &&
            lines[i].includes('"id"')
        ) {
            targetLine = i + 1;
            break;
        }
    }
    
    if (targetLine > 0) {
        editor.revealLineInCenter(targetLine);
        const range = new monaco.Range(
            targetLine,
            1,
            targetLine,
            1,
        );
        const decoration = editor.createDecorationsCollection([
            {
                range: range,
                options: {
                    isWholeLine: true,
                    className: "json-highlight",
                },
            },
        ]);
        setTimeout(() => {
            decoration.clear();
        }, 1000);
    }
}

function findObjectStateModifierAtTime(objectId, timeInMinutes) {
    if (!currentSimulationData || !currentSimulationData.tasks) {
        return null;
    }
    
    const sortedTasks = [...currentSimulationData.tasks].sort((a,b) => a.start_minutes - b.start_minutes);
    let currentModifier = null;
    
    for (const task of sortedTasks) {
        if (task.start_minutes > timeInMinutes) break;
        
        const isTaskActive = timeInMinutes >= task.start_minutes && timeInMinutes < task.end_minutes;
        const isTaskCompleted = timeInMinutes >= task.end_minutes;
        
        // Check equipment_interactions (old style)
        (task.equipment_interactions || []).forEach(interaction => {
            if (interaction.id === objectId) {
                if (isTaskActive) {
                    currentModifier = task.id;
                } else if (isTaskCompleted && !interaction.revert_after) {
                    currentModifier = task.id;
                }
            }
        });
        
        // Check interactions (new style)
        (task.interactions || []).forEach(interaction => {
            if (interaction.object_id === objectId && interaction.state) {
                if (isTaskActive) {
                    currentModifier = task.id;
                } else if (isTaskCompleted && !interaction.revert_after) {
                    currentModifier = task.id;
                }
            }
        });
    }
    
    return currentModifier;
}

function handleObjectClick(objectId, currentTime) {
    if (currentTime === 0 || currentTime === currentSimulationData?.start_time_minutes) {
        // At time=0, go to object definition
        scrollToObjectInJSON(objectId);
    } else {
        // Find what's currently modifying this object
        const modifyingTaskId = findObjectStateModifierAtTime(objectId, currentTime);
        if (modifyingTaskId) {
            scrollToTaskInJSON(modifyingTaskId);
        } else {
            // No modifier found, go to object definition
            scrollToObjectInJSON(objectId);
        }
    }
}

// Make function available globally for simulation-player.js
window.handleObjectClick = handleObjectClick;

// Drag and drop functionality
function initializeDragAndDrop() {
    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
}

function handleMouseDown(e) {
    const taskBlock = e.target.closest(".task-block");
    if (!taskBlock || !taskBlock.dataset.taskId) return;

    // Check if this is a resize operation
    const rect = taskBlock.getBoundingClientRect();
    const relativeX = e.clientX - rect.left;
    const isLeftEdge = relativeX <= 8;
    const isRightEdge = relativeX >= rect.width - 8;

    if (isLeftEdge || isRightEdge) {
        // Start resize operation
        isResizing = true;
        resizeType = isLeftEdge ? "left" : "right";
        resizeHandle = taskBlock;
        dragStartX = e.clientX;

        originalTaskData = {
            taskId: taskBlock.dataset.taskId,
            actorId: taskBlock.dataset.actorId,
            start: taskBlock.dataset.start,
            duration: parseInt(taskBlock.dataset.duration),
        };

        originalDuration = originalTaskData.duration;
        originalStartTime = originalTaskData.start;

        // Add resize class
        taskBlock.classList.add("resizing");

        // Create duration preview
        durationPreview = document.createElement("div");
        durationPreview.className = "duration-preview";
        durationPreview.textContent = `${originalDuration} min`;
        taskBlock.appendChild(durationPreview);
    } else {
        // Set up potential drag but don't commit to dragging yet
        draggedTask = taskBlock;
        dragStartX = e.clientX;
        dragStartY = e.clientY;

        originalTaskData = {
            taskId: taskBlock.dataset.taskId,
            actorId: taskBlock.dataset.actorId,
            start: taskBlock.dataset.start,
            duration: parseInt(taskBlock.dataset.duration),
        };
    }

    e.preventDefault();
}

function handleMouseMove(e) {
    if (isResizing && resizeHandle) {
        // Handle resize operation
        const deltaX = e.clientX - dragStartX;
        const track = resizeHandle.closest(".task-track");
        const trackRect = track.getBoundingClientRect();
        const totalMinutes =
            currentSimulationData.total_duration_minutes;

        let newDuration = originalDuration;
        let newStartTime = originalStartTime;

        if (resizeType === "right") {
            // Resize from right edge - change duration
            const deltaMinutes = Math.round(
                (deltaX / trackRect.width) * totalMinutes,
            );
            newDuration = Math.max(
                15,
                originalDuration + deltaMinutes,
            ); // Minimum 15 minutes
        } else if (resizeType === "left") {
            // Resize from left edge - change start time and duration
            const deltaMinutes = Math.round(
                (deltaX / trackRect.width) * totalMinutes,
            );
            const [hours, mins] = originalStartTime
                .split(":")
                .map(Number);
            const originalStartMinutes = hours * 60 + mins;
            const newStartMinutes = Math.max(
                currentSimulationData.start_time_minutes,
                originalStartMinutes + deltaMinutes,
            );

            newDuration = Math.max(
                15,
                originalDuration - deltaMinutes,
            );
            const newHours = Math.floor(newStartMinutes / 60);
            const newMins = newStartMinutes % 60;
            newStartTime = `${newHours.toString().padStart(2, "0")}:${newMins.toString().padStart(2, "0")}`;

            // Update visual position for left resize
            const startPercentage =
                ((newStartMinutes -
                    currentSimulationData.start_time_minutes) /
                    totalMinutes) *
                100;
            resizeHandle.style.left = startPercentage + "%";
        }

        // Update preview
        if (durationPreview) {
            durationPreview.textContent = `${newDuration} min`;
        }

        // Update visual size
        const newPercentage = (newDuration / totalMinutes) * 100;
        resizeHandle.style.width = newPercentage + "%";

        return;
    }

    if (!draggedTask) return;

    e.preventDefault();
    const deltaX = e.clientX - dragStartX;
    const deltaY = e.clientY - dragStartY;

    if (Math.abs(deltaX) > 2 || Math.abs(deltaY) > 2) {
        // Now we're actually dragging
        if (!isDragging) {
            isDragging = true;
            e.preventDefault();
        }

        if (!draggedTask.classList.contains("dragging")) {
            // Store original dimensions only when we start dragging
            const rect = draggedTask.getBoundingClientRect();
            draggedTask.classList.add("dragging");
            draggedTask.style.position = "fixed";
            draggedTask.style.width = rect.width + "px";
            draggedTask.style.height = rect.height + "px";
            draggedTask.style.zIndex = "1000";
        }

        draggedTask.style.left =
            e.clientX -
            parseInt(draggedTask.style.width) / 2 +
            "px";
        draggedTask.style.top =
            e.clientY -
            parseInt(draggedTask.style.height) / 2 +
            "px";

        // Highlight drop zones only during actual drag
        const taskTracks = document.querySelectorAll(".task-track");
        taskTracks.forEach((track) => {
            const rect = track.getBoundingClientRect();
            if (
                e.clientX >= rect.left &&
                e.clientX <= rect.right &&
                e.clientY >= rect.top &&
                e.clientY <= rect.bottom
            ) {
                track.classList.add("drop-zone");
            } else {
                track.classList.remove("drop-zone", "invalid");
            }
        });
    }
}

function handleMouseUp(e) {
    if (isResizing && resizeHandle) {
        // Handle resize completion
        const deltaX = e.clientX - dragStartX;
        const track = resizeHandle.closest(".task-track");
        const trackRect = track.getBoundingClientRect();
        const totalMinutes =
            currentSimulationData.total_duration_minutes;

        let newDuration = originalDuration;
        let newStartTime = originalStartTime;

        if (resizeType === "right") {
            const deltaMinutes = Math.round(
                (deltaX / trackRect.width) * totalMinutes,
            );
            newDuration = Math.max(
                15,
                originalDuration + deltaMinutes,
            );
        } else if (resizeType === "left") {
            const deltaMinutes = Math.round(
                (deltaX / trackRect.width) * totalMinutes,
            );
            const [hours, mins] = originalStartTime
                .split(":")
                .map(Number);
            const originalStartMinutes = hours * 60 + mins;
            const newStartMinutes = Math.max(
                currentSimulationData.start_time_minutes,
                originalStartMinutes + deltaMinutes,
            );

            newDuration = Math.max(
                15,
                originalDuration - deltaMinutes,
            );
            const newHours = Math.floor(newStartMinutes / 60);
            const newMins = newStartMinutes % 60;
            newStartTime = `${newHours.toString().padStart(2, "0")}:${newMins.toString().padStart(2, "0")}`;
        }

        // Update JSON with new duration and/or start time
        updateTaskDurationInJSON(
            originalTaskData.taskId,
            newDuration,
            newStartTime,
        );

        // Clean up resize state
        resizeHandle.classList.remove("resizing");
        if (durationPreview) {
            durationPreview.remove();
            durationPreview = null;
        }

        isResizing = false;
        resizeType = null;
        resizeHandle = null;
        originalTaskData = null;
        return;
    }

    if (!draggedTask) return;

    const taskTracks = document.querySelectorAll(".task-track");
    taskTracks.forEach((track) =>
        track.classList.remove("drop-zone", "invalid"),
    );

    if (isDragging && draggedTask.classList.contains("dragging")) {
        // This was a drag operation
        const targetTrack = document
            .elementFromPoint(e.clientX, e.clientY)
            ?.closest(".task-track");
        if (targetTrack && targetTrack.dataset.actorId) {
            const newActorId = targetTrack.dataset.actorId;
            // Adjust cursor position to account for block center being at cursor
            const blockWidth =
                parseInt(draggedTask.style.width) || 0;
            const adjustedX = e.clientX - blockWidth / 2;
            const newTime = calculateNewTimeFromPosition(
                adjustedX,
                targetTrack,
            );

            // Always update the JSON - remove overlap prevention
            updateTaskInJSON(
                originalTaskData.taskId,
                newActorId,
                newTime,
            );
        }

        // Reset drag state
        draggedTask.classList.remove("dragging");
        draggedTask.style.position = "";
        draggedTask.style.left = "";
        draggedTask.style.top = "";
        draggedTask.style.width = "";
        draggedTask.style.height = "";
        draggedTask.style.zIndex = "";
    } else if (!isDragging) {
        // This was a click - handle the jump to JSON
        scrollToTaskInJSON(originalTaskData.taskId);
    }

    isDragging = false;
    draggedTask = null;
    originalTaskData = null;
}

function calculateNewTimeFromPosition(clientX, trackElement) {
    const rect = trackElement.getBoundingClientRect();
    const percentage = (clientX - rect.left) / rect.width;

    if (currentSimulationData) {
        const totalMinutes =
            currentSimulationData.total_duration_minutes;
        const minutesFromStart = Math.round(
            percentage * totalMinutes,
        );
        const actualStartTime =
            currentSimulationData.start_time_minutes +
            minutesFromStart;

        const hours = Math.floor(actualStartTime / 60);
        const mins = actualStartTime % 60;
        return `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`;
    }
    return "06:00";
}

function updateTaskInJSON(taskId, newActorId, newTime) {
    try {
        const simulation = JSON.parse(editor.getValue());
        const task = simulation.simulation.tasks.find(
            (t) => t.id === taskId,
        );
        if (task) {
            saveToHistory();
            task.actor_id = newActorId;
            task.start = newTime;
            editor.setValue(JSON.stringify(simulation, null, 2));
            debounceRender();
        }
    } catch (e) {
        console.error("Error updating task:", e);
    }
}

function updateTaskDurationInJSON(
    taskId,
    newDuration,
    newStartTime,
) {
    try {
        const simulation = JSON.parse(editor.getValue());
        const task = simulation.simulation.tasks.find(
            (t) => t.id === taskId,
        );
        if (task) {
            saveToHistory();
            task.duration = newDuration;
            if (newStartTime !== null) {
                task.start = newStartTime;
            }
            editor.setValue(JSON.stringify(simulation, null, 2));
            debounceRender();
        }
    } catch (e) {
        console.error("Error updating task duration:", e);
    }
}

// Dialog management functions
function openDialog(title, content) {
    const overlay = document.getElementById("dialog-overlay");
    const dialogContent = document.getElementById("dialog-content");

    dialogContent.innerHTML = `
        <h3>${title}</h3>
        ${content}
    `;

    overlay.style.display = "flex";
    
    // Attach emoji pickers to any new emoji fields in the dialog
    if (window.emojiPicker) {
        window.emojiPicker.attachToDynamicFields(dialogContent);
    }
}

function closeDialog() {
    const overlay = document.getElementById("dialog-overlay");
    overlay.style.display = "none";
}

function generateId(prefix) {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function openAddTaskDialog() {
    // Try to get existing data, fallback to empty arrays
    let actors = [];
    let resources = [];

    try {
        const simulation = JSON.parse(editor.getValue());
        actors = simulation.simulation?.actors || [];
        resources = simulation.simulation?.resources || [];
    } catch (e) {
        // If JSON is invalid or empty, use empty arrays
    }

    const actorOptions = actors
        .map(
            (actor) =>
                `<option value="${actor.id}">${actor.role}</option>`,
        )
        .join("");

    const resourceCheckboxes = resources
        .map(
            (resource) =>
                `<label style="display: flex; align-items: center; gap: 0.5rem;">
            <input type="checkbox" value="${resource.id}" name="uses_resources">
            ${resource.emoji} ${resource.name}
        </label>`,
        )
        .join("");

    const content = `
        <form class="dialog-form" onsubmit="addTask(event)">
            <div class="dialog-field">
                <label>Task Name</label>
                <input type="text" name="task_name" required placeholder="e.g., Mix dough">
            </div>
            <div class="dialog-field">
                <label>Emoji</label>
                <input type="text" name="emoji" placeholder="🥄" maxlength="2">
            </div>
            <div class="dialog-field">
                <label>Assigned Actor</label>
                <select name="actor_id" required>
                    <option value="">Select an actor...</option>
                    ${actorOptions}
                </select>
            </div>
            <div class="dialog-field">
                <label>Start Time</label>
                <input type="time" name="start_time" required value="06:00">
            </div>
            <div class="dialog-field">
                <label>Duration (minutes)</label>
                <input type="number" name="duration" required min="1" value="30">
            </div>
            <div class="dialog-field">
                <label>Uses Resources</label>
                <div style="display: flex; flex-direction: column; gap: 0.5rem; max-height: 150px; overflow-y: auto;">
                    ${resourceCheckboxes}
                </div>
            </div>
            <div class="dialog-buttons">
                <button type="button" class="btn-secondary" onclick="closeDialog()">Cancel</button>
                <button type="submit" class="btn-primary">Add Task</button>
            </div>
        </form>
    `;

    openDialog("Add New Task", content);
}

function openAddActorDialog() {
    const content = `
        <form class="dialog-form" onsubmit="addActor(event)">
            <div class="dialog-field">
                <label>Actor ID</label>
                <input type="text" name="actor_id" required placeholder="e.g., chef, assistant" pattern="[a-z_]+" title="Use lowercase letters and underscores only">
            </div>
            <div class="dialog-field">
                <label>Role/Title</label>
                <input type="text" name="role" required placeholder="e.g., Head Chef">
            </div>
            <div class="dialog-field">
                <label>Cost per Hour ($)</label>
                <input type="number" name="cost_per_hour" required min="0" step="0.01" value="25.00">
            </div>
            <div class="dialog-buttons">
                <button type="button" class="btn-secondary" onclick="closeDialog()">Cancel</button>
                <button type="submit" class="btn-primary">Add Actor</button>
            </div>
        </form>
    `;

    openDialog("Add New Actor", content);
}

function openAddResourceDialog() {
    const content = `
        <form class="dialog-form" onsubmit="addResource(event)">
            <div class="dialog-field">
                <label>Resource ID</label>
                <input type="text" name="resource_id" required placeholder="e.g., mixer, oven" pattern="[a-z_]+" title="Use lowercase letters and underscores only">
            </div>
            <div class="dialog-field">
                <label>Display Name</label>
                <input type="text" name="name" required placeholder="e.g., Stand Mixer">
            </div>
            <div class="dialog-field">
                <label>Emoji</label>
                <input type="text" name="emoji" required placeholder="🥄" maxlength="2">
            </div>
            <div class="dialog-field">
                <label>Initial State</label>
                <select name="state" required>
                    <option value="clean">Clean</option>
                    <option value="dirty">Dirty</option>
                    <option value="available">Available</option>
                    <option value="in-use">In Use</option>
                    <option value="maintenance">Maintenance</option>
                </select>
            </div>
            <div class="dialog-field">
                <label>Capacity</label>
                <input type="number" name="capacity" required min="1" value="1">
            </div>
            <div class="dialog-buttons">
                <button type="button" class="btn-secondary" onclick="closeDialog()">Cancel</button>
                <button type="submit" class="btn-primary">Add Resource</button>
            </div>
        </form>
    `;

    openDialog("Add New Resource", content);
}

function addTask(event) {
    event.preventDefault();
    const form = event.target;
    const formData = new FormData(form);

    const taskName = formData.get("task_name");
    const emoji = formData.get("emoji") || "📝";
    const taskId = `${taskName.toLowerCase().replace(/\s+/g, "_")} 🔸 ${emoji}`;

    const usesResources = Array.from(
        form.querySelectorAll(
            'input[name="uses_resources"]:checked',
        ),
    ).map((cb) => cb.value);

    const newTask = {
        id: taskId,
        actor_id: formData.get("actor_id"),
        start: formData.get("start_time"),
        duration: parseInt(formData.get("duration")),
        uses_resources: usesResources,
    };

    try {
        let simulation;
        const jsonText = editor.getValue().trim();

        if (!jsonText) {
            // Create a new simulation if editor is empty
            simulation = {
                simulation: {
                    time_unit: "minute",
                    start_time: "06:00",
                    end_time: "18:00",
                    actors: [],
                    resources: [],
                    tasks: [],
                },
            };
        } else {
            simulation = JSON.parse(jsonText);
            if (!simulation.simulation) {
                simulation.simulation = {};
            }
            if (!simulation.simulation.tasks) {
                simulation.simulation.tasks = [];
            }
        }

        simulation.simulation.tasks.push(newTask);

        saveToHistory();
        editor.setValue(JSON.stringify(simulation, null, 2));
        debounceRender();
        closeDialog();
    } catch (e) {
        alert("Error adding task: " + e.message);
    }
}

function addActor(event) {
    event.preventDefault();
    const form = event.target;
    const formData = new FormData(form);

    const newActor = {
        id: formData.get("actor_id"),
        role: formData.get("role"),
        cost_per_hour: parseFloat(formData.get("cost_per_hour")),
    };

    try {
        let simulation;
        const jsonText = editor.getValue().trim();

        if (!jsonText) {
            // Create a new simulation if editor is empty
            simulation = {
                simulation: {
                    time_unit: "minute",
                    start_time: "06:00",
                    end_time: "18:00",
                    actors: [],
                    resources: [],
                    tasks: [],
                },
            };
        } else {
            simulation = JSON.parse(jsonText);
            if (!simulation.simulation) {
                simulation.simulation = {};
            }
            if (!simulation.simulation.actors) {
                simulation.simulation.actors = [];
            }
        }

        simulation.simulation.actors.push(newActor);

        saveToHistory();
        editor.setValue(JSON.stringify(simulation, null, 2));
        debounceRender();
        closeDialog();
    } catch (e) {
        alert("Error adding actor: " + e.message);
    }
}

function addResource(event) {
    event.preventDefault();
    const form = event.target;
    const formData = new FormData(form);

    const newResource = {
        id: formData.get("resource_id"),
        name: formData.get("name"),
        emoji: formData.get("emoji"),
        state: formData.get("state"),
        capacity: parseInt(formData.get("capacity")),
        current_usage: 0,
    };

    try {
        let simulation;
        const jsonText = editor.getValue().trim();

        if (!jsonText) {
            // Create a new simulation if editor is empty
            simulation = {
                simulation: {
                    time_unit: "minute",
                    start_time: "06:00",
                    end_time: "18:00",
                    actors: [],
                    resources: [],
                    tasks: [],
                },
            };
        } else {
            simulation = JSON.parse(jsonText);
            if (!simulation.simulation) {
                simulation.simulation = {};
            }
            if (!simulation.simulation.resources) {
                simulation.simulation.resources = [];
            }
        }

        simulation.simulation.resources.push(newResource);

        saveToHistory();
        editor.setValue(JSON.stringify(simulation, null, 2));
        debounceRender();
        closeDialog();
    } catch (e) {
        alert("Error adding resource: " + e.message);
    }
}

function toggleFullscreen() {
    const jsonPanel = document.querySelector(".json-editor-panel");
    const simulationPanel =
        document.querySelector(".simulation-panel");
    const fullscreenBtn = document.getElementById("fullscreen-btn");

    if (jsonPanel.classList.contains("hidden")) {
        jsonPanel.classList.remove("hidden");
        simulationPanel.classList.remove("fullscreen");
        fullscreenBtn.innerHTML = "⛶";
        fullscreenBtn.title = "Toggle fullscreen simulation view";
    } else {
        jsonPanel.classList.add("hidden");
        simulationPanel.classList.add("fullscreen");
        fullscreenBtn.innerHTML = "⛗";
        fullscreenBtn.title = "Show JSON editor";
    }
}

// Static page structure from structure.txt file
async function fetchPageStructure() {
    try {
        const response = await fetch("/assets/data/structure.txt");
        if (!response.ok) {
            throw new Error("Failed to fetch structure.txt");
        }

        const text = await response.text();
        const lines = text.trim().split("\n");
        const structure = {};

        lines.forEach((line) => {
            const parts = line.trim().split("/");
            if (parts.length === 3) {
                const [domain, subcategory, page] = parts;

                if (!structure[domain]) {
                    structure[domain] = {};
                }
                if (!structure[domain][subcategory]) {
                    structure[domain][subcategory] = [];
                }
                structure[domain][subcategory].push(page);
            }
        });

        return structure;
    } catch (e) {
        console.error("Failed to load page structure:", e);
        // Basic fallback
        return {
            "food-production": {
                baking: ["breadmaking", "breadmaking-alpha"],
            },
        };
    }
}

function cleanDisplayName(name) {
    return name
        .split("-")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
}

function openSubmitDialog() {
    const content = `
        <div class="submit-dialog">
            <form class="dialog-form" onsubmit="handleSubmit(event)">
                <div class="cascade-container">
                    <div class="dialog-field">
                        <label>Domain</label>
                        <select name="domain" id="domain-select" onchange="updateSubcategories()" required>
                            <option value="">Select a domain...</option>
                            <option value="entertainment">Entertainment</option>
                            <option value="food-production">Food Production</option>
                            <option value="healthcare">Healthcare</option>
                            <option value="manufacturing">Manufacturing</option>
                            <option value="technology">Technology</option>
                            <option value="transportation">Transportation</option>
                        </select>
                    </div>

                    <div class="dialog-field cascade-dropdown" id="subcategory-field">
                        <label>Subcategory</label>
                        <select name="subcategory" id="subcategory-select" onchange="updatePages()" required>
                            <option value="">Select a subcategory...</option>
                        </select>
                    </div>

                    <div class="dialog-field cascade-dropdown" id="page-field">
                        <label>Page</label>
                        <select name="page" id="page-select" onchange="updatePreview()" required>
                            <option value="">Select a page...</option>
                        </select>
                    </div>

                    <div id="path-preview" class="page-path-preview" style="display: none;">
                        <strong>Target:</strong> <span id="preview-path"></span>
                    </div>
                </div>

                <div class="dialog-buttons">
                    <button type="button" class="btn-secondary" onclick="closeDialog()">Cancel</button>
                    <button type="submit" class="btn-primary" disabled id="submit-confirm-btn">Submit</button>
                </div>
            </form>
        </div>
    `;

    openDialog("Submit Simulation", content);

    // Load page structure from static file
    fetchPageStructure()
        .then((structure) => {
            window.pageStructure = structure;
        })
        .catch((e) => {
            console.error("Failed to load page structure:", e);
            window.pageStructure = {
                "food-production": {
                    baking: ["breadmaking", "breadmaking-alpha"],
                },
            };
        });
}

function updateSubcategories() {
    const domainSelect = document.getElementById("domain-select");
    const subcategoryField =
        document.getElementById("subcategory-field");
    const subcategorySelect =
        document.getElementById("subcategory-select");
    const pageField = document.getElementById("page-field");

    const selectedDomain = domainSelect.value;

    // Clear subcategory options
    subcategorySelect.innerHTML =
        '<option value="">Select a subcategory...</option>';

    if (
        selectedDomain &&
        window.pageStructure &&
        window.pageStructure[selectedDomain]
    ) {
        const subcategories = Object.keys(
            window.pageStructure[selectedDomain],
        );
        subcategories.sort().forEach((subcat) => {
            const option = document.createElement("option");
            option.value = subcat;
            option.textContent = cleanDisplayName(subcat);
            subcategorySelect.appendChild(option);
        });

        subcategoryField.classList.add("visible");
    } else {
        subcategoryField.classList.remove("visible");
    }

    // Hide page field
    pageField.classList.remove("visible");
    updatePreview();
}

function updatePages() {
    const domainSelect = document.getElementById("domain-select");
    const subcategorySelect =
        document.getElementById("subcategory-select");
    const pageField = document.getElementById("page-field");
    const pageSelect = document.getElementById("page-select");

    const selectedDomain = domainSelect.value;
    const selectedSubcategory = subcategorySelect.value;

    // Clear page options
    pageSelect.innerHTML =
        '<option value="">Select a page...</option>';

    if (
        selectedDomain &&
        selectedSubcategory &&
        window.pageStructure &&
        window.pageStructure[selectedDomain] &&
        window.pageStructure[selectedDomain][selectedSubcategory]
    ) {
        const pages =
            window.pageStructure[selectedDomain][
                selectedSubcategory
            ];
        pages.sort().forEach((page) => {
            const option = document.createElement("option");
            option.value = page;
            option.textContent = cleanDisplayName(page);
            pageSelect.appendChild(option);
        });

        if (pages.length > 0) {
            pageField.classList.add("visible");

            // Auto-select if there's a good match for the current simulation
            const simulationData = getCurrentSimulationData();
            if (
                simulationData &&
                selectedDomain === "food-production" &&
                selectedSubcategory === "baking"
            ) {
                const breadmakingOption = pageSelect.querySelector(
                    'option[value="breadmaking"]',
                );
                if (breadmakingOption) {
                    pageSelect.value = "breadmaking";
                    updatePreview();
                }
            }
        }
    } else {
        pageField.classList.remove("visible");
    }

    updatePreview();
}

function updatePreview() {
    const domainSelect = document.getElementById("domain-select");
    const subcategorySelect =
        document.getElementById("subcategory-select");
    const pageSelect = document.getElementById("page-select");
    const previewDiv = document.getElementById("path-preview");
    const previewPath = document.getElementById("preview-path");
    const submitBtn = document.getElementById("submit-confirm-btn");

    const domain = domainSelect.value;
    const subcategory = subcategorySelect.value;
    const page = pageSelect.value;

    if (domain && subcategory && page) {
        const fullPath = `${domain}/${subcategory}/${page}`;
        previewPath.textContent = fullPath;
        previewDiv.style.display = "block";
        submitBtn.disabled = false;
    } else {
        previewDiv.style.display = "none";
        submitBtn.disabled = true;
    }
}

function handleSubmit(event) {
    event.preventDefault();
    const formData = new FormData(event.target);
    const domain = formData.get("domain");
    const subcategory = formData.get("subcategory");
    const page = formData.get("page");

    const targetPath = `${domain}/${subcategory}/${page}`;

    // For now, just show an alert - actual submission logic would go here
    alert(
        `Simulation would be submitted to: ${targetPath}\n\n(Submission functionality not implemented yet)`,
    );

    closeDialog();
}

function getCurrentSimulationData() {
    try {
        const jsonText = editor.getValue().trim();
        if (jsonText) {
            return JSON.parse(jsonText);
        }
    } catch (e) {
        // Invalid JSON
    }
    return null;
}

function processSimulationData(simulationData) {
    const sim = simulationData.simulation;
    const config = sim.config || {};
    const startTime = config.start_time || "06:00";
    const [startHour, startMin] = startTime.split(":").map(Number);
    const startTimeMinutes = startHour * 60 + startMin;

    let actualLastTaskEnd = startTimeMinutes;

    const allObjects = sim.objects || [];
    const actors = allObjects.filter(o => o.type === 'actor');
    const equipment = allObjects.filter(o => o.type === 'equipment');
    const resources = allObjects.filter(o => o.type === 'resource');
    const products = allObjects.filter(o => o.type === 'product');

    const tasksWithMinutes = (sim.tasks || []).map(task => {
        let taskStartMinutes;
        try {
            const [taskHour, taskMin] = (task.start || "00:00").split(":").map(Number);
            taskStartMinutes = taskHour * 60 + taskMin;
        } catch {
            taskStartMinutes = startTimeMinutes;
        }
        const taskDuration = task.duration || 0;
        const taskEndMinutes = taskStartMinutes + taskDuration;
        actualLastTaskEnd = Math.max(actualLastTaskEnd, taskEndMinutes);
        return { ...task, start_minutes: taskStartMinutes, end_minutes: taskEndMinutes };
    });
    
    // --- START OF THE UNIFIED SCALING FIX ---

    // 1. Determine the logical end time, including a small buffer for visuals.
    const logicalEndTime = actualLastTaskEnd + 30;

    // 2. Calculate a visually clean, rounded-up total duration for the timeline.
    // This becomes the single source of truth for all rendering.
    const logicalTotalDuration = logicalEndTime - startTimeMinutes;
    const visualTotalDuration = Math.ceil(logicalTotalDuration / 60) * 60; // Round up to the next full hour.

    // 3. Calculate the end time string based on this visual duration.
    const visualEndTimeMinutes = startTimeMinutes + visualTotalDuration;
    const visualEndHour = Math.floor(visualEndTimeMinutes / 60);
    const visualEndMin = visualEndTimeMinutes % 60;
    const visualEndTimeStr = `${String(visualEndHour).padStart(2, "0")}:${String(visualEndMin).padStart(2, "0")}`;

    // --- END OF THE UNIFIED SCALING FIX ---

    const processedTasks = tasksWithMinutes.map(task => {
        const taskId = task.id || "";
        let displayName = taskId, emoji = "[TASK]";
        
        // Check for new emoji field first
        if (task.emoji) {
            emoji = task.emoji;
            displayName = taskId;
        } else if (taskId.includes("🔸")) {
            // Fallback to old format for backwards compatibility
            const parts = taskId.split("🔸");
            displayName = parts[0].trim();
            emoji = parts[1].trim();
        }
        
        return {
            ...task,
            display_name: displayName,
            emoji: emoji,
            // All percentages now use the same, consistent denominator.
            start_percentage: ((task.start_minutes - startTimeMinutes) / visualTotalDuration) * 100,
            duration_percentage: (task.duration / visualTotalDuration) * 100
        };
    });
    
    const actorWorkloads = {};
    processedTasks.forEach(task => {
        actorWorkloads[task.actor_id] = (actorWorkloads[task.actor_id] || 0) + (task.duration || 0);
    });

    const processedActors = actors.map(actor => {
        const workload = actorWorkloads[actor.id] || 0;
        // Utilization should also be based on the visual duration of the workday shown.
        const utilization = visualTotalDuration > 0 ? (workload / visualTotalDuration) * 100 : 0;
        return { ...actor, utilization_percentage: Math.round(utilization * 10) / 10 };
    });

    return {
        start_time: startTime,
        end_time: visualEndTimeStr, // Use the new visual end time
        start_time_minutes: startTimeMinutes,
        end_time_minutes: visualEndTimeMinutes, // Use the new visual end time
        total_duration_minutes: visualTotalDuration, // This is now the unified duration
        actors: processedActors,
        equipment: equipment,
        resources: resources,
        products: products,
        tasks: processedTasks,
        article_title: sim.meta?.article_title || "Process Simulation",
        domain: sim.meta?.domain || "General",
    };
}

// Render simulation with resources display
function renderSimulation() {
    const simulationContent =
        document.getElementById("simulation-content");
    const loadingOverlay =
        document.getElementById("simulation-loading");

    // Clean up any existing resize state
    if (isResizing && resizeHandle) {
        resizeHandle.classList.remove("resizing");
        if (durationPreview) {
            durationPreview.remove();
        }
    }
    isResizing = false;
    resizeType = null;
    resizeHandle = null;
    durationPreview = null;
    isDragging = false;
    draggedTask = null;

    if (!validateJSON()) {
        simulationContent.innerHTML =
            '<p style="color: var(--error-color); text-align: center; margin-top: 2rem;">Cannot render: JSON validation failed</p>';
        return;
    }

    try {
        loadingOverlay.style.display = "flex";
        const jsonText = editor.getValue();
        const simulationData = JSON.parse(jsonText);
        currentSimulationData =
            processSimulationData(simulationData);

        if (spaceEditor) {
            spaceEditor.loadLayout(simulationData.simulation.layout);
        }

        simulationContent.innerHTML = "";
        const container = document.createElement("div");
        container.className = "simulation-container";

        const header = document.createElement("div");
        header.className = "simulation-header";
        header.innerHTML = `
            <h4>${currentSimulationData.article_title}</h4>
            <p>${currentSimulationData.domain} • ${currentSimulationData.start_time} - ${currentSimulationData.end_time} (${currentSimulationData.total_duration_minutes} minutes)</p>
        `;
        container.appendChild(header);

        const timeline = document.createElement("div");
        timeline.className = "simulation-timeline";
        timeline.style.cssText =
            "position: relative; min-height: 300px; background: #fff; border: 1px solid var(--border-color); border-radius: var(--border-radius-md); margin: 1rem 0; width: 100%; box-sizing: border-box;";

        const timeMarkers = document.createElement("div");
        timeMarkers.className = "timeline-time-markers";
        timeMarkers.style.cssText =
            "position: relative; height: 30px; border-bottom: 1px solid var(--border-color); background: #f8f9fa;";

         const totalMinutes =
            currentSimulationData.total_duration_minutes;
        const markerInterval = totalMinutes <= 120 ? 30 : 60; // use 30m for short sims, 60m for long

        for (
            let minutes = 0;
            minutes <= totalMinutes;
            minutes += markerInterval
        ) {
            const marker = document.createElement("div");
            marker.className = "time-marker";
            marker.style.cssText = `position: absolute; left: ${(minutes / totalMinutes) * 100}%; top: 5px; font-size: 0.75rem; color: var(--text-light); transform: translateX(-50%);`;

            const totalMinutesFromStart =
                currentSimulationData.start_time_minutes + minutes;
            const hours = Math.floor(totalMinutesFromStart / 60);
            const mins = totalMinutesFromStart % 60;
            marker.textContent = `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`;

            timeMarkers.appendChild(marker);
        }
        
        timeline.appendChild(timeMarkers);

        
        const playhead = document.createElement("div");
        playhead.id = "simulation-playhead";
        playhead.className = "simulation-playhead";
        
        const scrubHandle = document.createElement("div");
        scrubHandle.className = "scrub-handle";
        playhead.appendChild(scrubHandle);

        // Append the playhead to the main timeline, not the marker bar
        //timeMarkers.appendChild(playhead);

        const actorLanes = document.createElement("div");
        actorLanes.className = "actor-lanes";
        actorLanes.style.cssText =
            "padding: 1rem; width: 100%; box-sizing: border-box;";

        for (const actor of currentSimulationData.actors) {
            const lane = document.createElement("div");
            lane.className = "actor-lane";
            lane.style.cssText =
                "display: flex; margin-bottom: 1rem; min-height: 60px; width: 100%; box-sizing: border-box;";

            const actorLabel = document.createElement("div");
            actorLabel.className = "actor-label";
            actorLabel.style.cssText =
                "width: 150px; padding: 0.5rem; background: var(--bg-light); border-radius: var(--border-radius-sm); margin-right: 1rem; flex-shrink: 0;";
            actorLabel.innerHTML = `
                <strong>${actor.properties.role || actor.name}</strong><br>
                <small>Utilization: ${actor.utilization_percentage}%</small>
            `;
            lane.appendChild(actorLabel);

            const taskTrack = document.createElement("div");
            taskTrack.className = "task-track";
            taskTrack.dataset.actorId = actor.id;
            taskTrack.style.cssText =
                "flex: 1; position: relative; background: #f8f9fa; border: 1px solid var(--border-color); border-radius: var(--border-radius-sm); min-height: 40px; width: 100%; box-sizing: border-box;";

            const actorTasks = currentSimulationData.tasks.filter(
                (task) => task.actor_id === actor.id,
            );
            for (const task of actorTasks) {
                const taskElement = document.createElement("div");
                taskElement.className = "task-block";
                taskElement.dataset.taskId = task.id;
                taskElement.dataset.actorId = task.actor_id;
                taskElement.dataset.start = task.start;
                taskElement.dataset.duration = task.duration;

                taskElement.style.cssText = `position: absolute; left: ${task.start_percentage}%; width: ${task.duration_percentage}%; height: 30px; top: 5px; background: white; color: black; border: 2px solid var(--primary-color); border-radius: var(--border-radius-sm); font-size: 0.75rem; overflow: hidden; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 0.25rem; padding: 0.25rem 0.5rem; user-select: none;`;

                taskElement.innerHTML = `<span class="task-emoji">${task.emoji}</span>`;
                taskElement.title = `${task.display_name} (${task.duration} minutes)`;

                // Add click event listener as backup for jump functionality
                taskElement.addEventListener("click", (e) => {
                    // Only handle click if no drag occurred
                    if (!isDragging) {
                        scrollToTaskInJSON(task.id);
                    }
                });

                // Add mousemove event listener for cursor changes on edges
                taskElement.addEventListener("mousemove", (e) => {
                    if (isResizing || isDragging) return;

                    const rect =
                        taskElement.getBoundingClientRect();
                    const relativeX = e.clientX - rect.left;
                    const isLeftEdge = relativeX <= 8;
                    const isRightEdge = relativeX >= rect.width - 8;

                    if (isLeftEdge || isRightEdge) {
                        taskElement.style.cursor = "ew-resize";
                    } else {
                        taskElement.style.cursor = "pointer";
                    }
                });

                // Reset cursor when leaving task block
                taskElement.addEventListener("mouseleave", () => {
                    if (!isResizing) {
                        taskElement.style.cursor = "pointer";
                    }
                });
                taskTrack.appendChild(taskElement);
            }

            lane.appendChild(taskTrack);
            actorLanes.appendChild(lane);
        }

        timeline.appendChild(actorLanes);
        container.appendChild(timeline);

        const equipmentAndResourcesContainer =
            document.createElement("div");
        // **NEW** Equipment Panel

        if (currentSimulationData.equipment && currentSimulationData.equipment.length > 0) {
            // Calculate final equipment states chronologically
            const finalEquipmentStates = {};
            currentSimulationData.equipment.forEach(e => {
                finalEquipmentStates[e.id] = e.state || 'available';
            });

            const sortedTasks = [...(currentSimulationData.tasks || [])].sort((a,b) => (a.start || "00:00").localeCompare(b.start || "00:00"));
            
            sortedTasks.forEach(task => {
                // Handle old-style equipment_interactions
                (task.equipment_interactions || []).forEach(interaction => {
                    // If the equipment is in the correct starting state...
                    if(finalEquipmentStates[interaction.id] === interaction.from_state) {
                        //...its new state is the 'to_state', unless it reverts.
                        finalEquipmentStates[interaction.id] = interaction.revert_after === true ? interaction.from_state : interaction.to_state;
                    }
                });
                
                // Handle new-style interactions
                (task.interactions || []).forEach(interaction => {
                    const stateChanges = interaction.property_changes?.state;
                    if (stateChanges && finalEquipmentStates[interaction.object_id] === stateChanges.from) {
                        finalEquipmentStates[interaction.object_id] = interaction.revert_after === true ? stateChanges.from : stateChanges.to;
                    }
                });
            });

            const equipmentPanel = document.createElement("div");
            equipmentPanel.className = "resources-panel";
            equipmentPanel.innerHTML = `
                <h5>⚙️ Equipment (Final States)</h5>
                <div class="resource-grid">
                    ${currentSimulationData.equipment
                        .map(
                            (item) => `
                        <div class="resource-item">
                            <div class="resource-emoji">${item.emoji || "❓"}</div>
                            <div class="resource-info">
                                <div class="resource-name">${item.name || item.id}</div>
                                <div class="resource-state ${finalEquipmentStates[item.id]}">${finalEquipmentStates[item.id]}</div>
                            </div>
                        </div>
                    `,
                        )
                        .join("")}
                </div>
            `;
            equipmentAndResourcesContainer.appendChild(
                equipmentPanel,
            );
        }

        // **UPDATED** Resources (Consumables) Panel
        if (
            currentSimulationData.resources &&
            currentSimulationData.resources.length > 0
        ) {
            const resourcesPanel = document.createElement("div");
            resourcesPanel.className = "resources-panel";
            resourcesPanel.innerHTML = `
                <h5>📦 Resources (Consumables)</h5>
                <div class="resource-grid">
                    ${currentSimulationData.resources
                        .map(
                            (resource) => `
                        <div class="resource-item">
                            <div class="resource-emoji">${resource.emoji || "❓"}</div>
                            <div class="resource-info">
                                <div class="resource-name">${resource.id}</div>
                                <div class="resource-state available">Stock: ${resource.properties.quantity} ${resource.properties.unit}</div>
                            </div>
                        </div>
                    `,
                        )
                        .join("")}
                </div>
            `;
            equipmentAndResourcesContainer.appendChild(
                resourcesPanel,
            );
        }

        // --- Dynamic State Panels ---
        const liveStateContainer = document.createElement('div');
        liveStateContainer.id = 'live-state-container';
        liveStateContainer.style.display = 'flex';
        liveStateContainer.style.gap = '1rem';
        liveStateContainer.style.marginTop = '1rem';

        // Create panels dynamically based on object types in simulation data
        const detectedTypes = new Set();
        
        // Add types that have existing objects
        ['equipment', 'resources', 'actors', 'products'].forEach(type => {
            if (currentSimulationData[type] && currentSimulationData[type].length > 0) {
                detectedTypes.add(type);
            }
        });
        
        // Also check for objects that will be created during tasks
        (currentSimulationData.tasks || []).forEach(task => {
            (task.interactions || []).forEach(interaction => {
                if (interaction.add_objects) {
                    interaction.add_objects.forEach(obj => {
                        if (obj.type) {
                            detectedTypes.add(obj.type);
                        }
                    });
                }
            });
        });
        
        const availableTypes = Array.from(detectedTypes);

        availableTypes.forEach(objectType => {
            const panel = document.createElement("div");
            panel.id = `live-${objectType}-panel`;
            panel.className = "resources-panel";
            panel.innerHTML = `<h5>${objectType} (at <span class="live-time">00:00</span>)</h5><div class="resource-grid"></div>`;
            liveStateContainer.appendChild(panel);
        });

        container.appendChild(liveStateContainer);

        const stats = document.createElement("div");
        stats.className = "simulation-stats";
        stats.style.cssText =
            "display: flex; gap: 2rem; padding: 1rem; background: var(--bg-light); border-radius: var(--border-radius-md); margin-top: 1rem;";
        stats.innerHTML = `
            <div class="stat-item"><strong>Total Duration:</strong> ${currentSimulationData.total_duration_minutes} minutes</div>
            <div class="stat-item"><strong>Actors:</strong> ${currentSimulationData.actors.length}</div>
            <div class="stat-item"><strong>Tasks:</strong> ${currentSimulationData.tasks.length}</div>
            ${currentSimulationData.resources ? `<div class="stat-item"><strong>Resources:</strong> ${currentSimulationData.resources.length}</div>` : ""}
        `;
        container.appendChild(stats);

        simulationContent.appendChild(container);

        if (player && typeof player.destroy == 'function') {
            player.destroy();
        }
        player = new SimulationPlayer(currentSimulationData);
    } catch (e) {
        simulationContent.innerHTML = `<p style="color: var(--error-color); text-align: center; margin-top: 2rem;">Render Error: ${e.message}</p>`;
        console.error("Render error:", e);
    } finally {
        loadingOverlay.style.display = "none";
    }
}

// Validation functions
let renderTimeout;
function debounceRender() {
    clearTimeout(renderTimeout);
    renderTimeout = setTimeout(renderSimulation, 500);
}

function updateAutoRenderUI() {
    const renderBtn = document.getElementById(
        "render-simulation-btn",
    );
    const toggleBtn = document.getElementById("auto-render-toggle");

    if (autoRender) {
        renderBtn.classList.add("hidden");
        toggleBtn.textContent = "Auto-render: ON";
    } else {
        renderBtn.classList.remove("hidden");
        toggleBtn.textContent = "Auto-render: OFF";
    }
}

function validateJSON() {
    const jsonStatus = document.getElementById("json-status");
    const jsonText = editor.getValue();

    if (!jsonText.trim()) {
        jsonStatus.className = "validation-indicator warning";
        jsonStatus.textContent = "⚠ Empty Editor";
        jsonStatus.title = "Editor is empty";
        return false;
    }

    try {
        const parsed = JSON.parse(jsonText);
        jsonStatus.className = "validation-indicator success";
        jsonStatus.textContent = "✓ Valid JSON";
        jsonStatus.title = "JSON syntax is valid";

        // Get merged catalog (built-in + custom metrics)
        const mergedCatalog = getMergedMetricsCatalog();
        
        if (mergedCatalog && mergedCatalog.length > 0) {
            const validator = new SimulationValidator(parsed);
            const customValidator = getCustomValidatorCode();
            const validationResults = validator.runChecks(mergedCatalog, customValidator);
            displayValidationResults(validationResults); // Call the display function
        }

        return true;
    } catch (e) {
        jsonStatus.className = "validation-indicator error";
        jsonStatus.textContent = `✗ Invalid JSON: ${e.message}`;
        jsonStatus.title = `JSON Parse Error: ${e.message}`;
        return false;
    }
}

function displayValidationResults(results) {
    // Use the new grouped validation display
    displayGroupedValidationResults(results);
}

function displayGroupedValidationResults(results) {
    const compactContainer = document.getElementById("validation-compact");
    if (!compactContainer) return;

    // Calculate stats for each category
    const stats = {
        total: results.length,
        errors: results.filter(r => r.status === 'error').length,
        warnings: results.filter(r => r.status === 'warning').length,
        suggestions: results.filter(r => r.status === 'suggestion').length,
        success: results.filter(r => r.status === 'success').length
    };

    // Update stat counters
    updateValidationStats(stats);

    // Group results by status
    const grouped = {
        errors: results.filter(r => r.status === 'error'),
        warnings: results.filter(r => r.status === 'warning'), 
        suggestions: results.filter(r => r.status === 'suggestion'),
        success: results.filter(r => r.status === 'success')
    };

    // Display grouped results
    displayValidationGroup('errors', grouped.errors, '❌');
    displayValidationGroup('warnings', grouped.warnings, '⚠️');
    displayValidationGroup('suggestions', grouped.suggestions, '💡');
    displayValidationGroup('passed', grouped.success, '✅', true); // collapsed by default

    // Apply current filter
    applyValidationFilter();

    // Setup interactive elements if not already done
    if (!compactContainer.hasAttribute('data-initialized')) {
        setupValidationInteractions();
        compactContainer.setAttribute('data-initialized', 'true');
    }
}

function updateValidationStats(stats) {
    const elements = {
        total: document.getElementById('total-metrics-count'),
        errors: document.getElementById('error-metrics-count'),
        warnings: document.getElementById('warning-metrics-count'),
        suggestions: document.getElementById('suggestion-metrics-count'),
        success: document.getElementById('success-metrics-count')
    };

    if (elements.total) elements.total.textContent = stats.total;
    if (elements.errors) elements.errors.textContent = stats.errors;
    if (elements.warnings) elements.warnings.textContent = stats.warnings;
    if (elements.suggestions) elements.suggestions.textContent = stats.suggestions;
    if (elements.success) elements.success.textContent = stats.success;
}

function displayValidationGroup(groupId, results, icon, collapsedByDefault = false) {
    const groupElement = document.getElementById(`${groupId}-group`);
    const contentElement = document.getElementById(`${groupId}-group-content`);

    if (!groupElement || !contentElement) return;

    // Show/hide group based on whether it has results
    if (results.length > 0) {
        groupElement.style.display = 'block';

        // Sort results to float custom metrics to the top
        const mergedCatalog = getMergedMetricsCatalog();
        const sortedResults = [...results].sort((a, b) => {
            const metricA = mergedCatalog.find(m => m.id === a.metricId);
            const metricB = mergedCatalog.find(m => m.id === b.metricId);
            
            const isCustomA = metricA?.source === 'custom';
            const isCustomB = metricB?.source === 'custom';
            
            // Custom metrics first
            if (isCustomA && !isCustomB) return -1;
            if (!isCustomA && isCustomB) return 1;
            
            // Within same type (custom/built-in), sort alphabetically by metric name
            const nameA = metricA?.name || a.metricId;
            const nameB = metricB?.name || b.metricId;
            return nameA.localeCompare(nameB);
        });

        // Generate HTML for results
        const html = sortedResults.map(result => {
            const statusIcon = getStatusIcon(result.status);
            const metricName = getMetricDisplayName(result.metricId);
            
            return `
                <div class="validation-result-item ${result.status}" data-metric-id="${result.metricId}">
                    <div class="validation-result-status ${result.status}">
                        ${statusIcon}
                    </div>
                    <div class="validation-result-details">
                        <div class="validation-result-name">${metricName}</div>
                        <div class="validation-result-message">${result.message}</div>
                    </div>
                </div>
            `;
        }).join('');

        contentElement.innerHTML = html;

        // Handle collapsed state for passed group
        if (collapsedByDefault) {
            contentElement.classList.add('collapsed');
        } else {
            contentElement.classList.remove('collapsed');
        }
    } else {
        groupElement.style.display = 'none';
    }
}

function getStatusIcon(status) {
    const icons = {
        error: '❌',
        warning: '⚠️', 
        suggestion: '💡',
        success: '✅'
    };
    return icons[status] || '❓';
}

function getMetricDisplayName(metricId) {
    // Try to get a more friendly name from the merged metrics catalog
    const mergedCatalog = getMergedMetricsCatalog();
    const metric = mergedCatalog.find(m => m.id === metricId);
    return metric?.name || metricId;
}

function setupValidationInteractions() {
    // Setup clickable stat items for filtering
    document.querySelectorAll('.stat-item.clickable').forEach(item => {
        item.addEventListener('click', () => {
            const filterValue = item.dataset.filter;
            const filterSelect = document.getElementById('validation-filter');
            if (filterSelect) {
                filterSelect.value = filterValue;
                applyValidationFilter();
                
                // Update visual state
                document.querySelectorAll('.stat-item.clickable').forEach(s => s.classList.remove('active'));
                item.classList.add('active');
            }
        });
    });

    // Setup filter dropdown
    const filterSelect = document.getElementById('validation-filter');
    if (filterSelect) {
        filterSelect.addEventListener('change', applyValidationFilter);
    }

    // Setup collapsible passed group (click directly on passed group)
    const passedGroup = document.getElementById('passed-group');
    if (passedGroup) {
        passedGroup.addEventListener('click', () => {
            const content = document.getElementById('passed-group-content');
            if (content) {
                const isCollapsed = content.classList.contains('collapsed');
                if (isCollapsed) {
                    content.classList.remove('collapsed');
                } else {
                    content.classList.add('collapsed');
                }
            }
        });
    }
}

function applyValidationFilter() {
    const filterSelect = document.getElementById('validation-filter');
    const filterValue = filterSelect?.value || 'all';

    // Get all validation groups
    const groups = {
        errors: document.getElementById('errors-group'),
        warnings: document.getElementById('warnings-group'),
        suggestions: document.getElementById('suggestions-group'),
        passed: document.getElementById('passed-group')
    };

    // Update stat item visual states
    document.querySelectorAll('.stat-item.clickable').forEach(item => {
        item.classList.remove('active');
    });
    
    const activeStatItem = document.querySelector(`[data-filter="${filterValue}"]`);
    if (activeStatItem) {
        activeStatItem.classList.add('active');
    }

    // Apply filter logic
    switch (filterValue) {
        case 'all':
            // Reset all groups and items to their original state
            Object.values(groups).forEach(group => {
                if (!group) return;
                
                // Show group if it has any items
                const hasItems = group.querySelector('.validation-result-item');
                group.style.display = hasItems ? 'block' : 'none';
                
                // Show all items within groups
                const items = group.querySelectorAll('.validation-result-item');
                items.forEach(item => item.style.display = 'flex');
                
                // Reset group counts to original values
                const countElement = group.querySelector('.group-count');
                if (countElement) {
                    countElement.textContent = items.length;
                }
            });
            break;
            
        case 'errors':
            showOnlyGroup('errors', groups);
            break;
            
        case 'warnings':
            showOnlyGroup('warnings', groups);
            break;
            
        case 'suggestions':
            showOnlyGroup('suggestions', groups);
            break;
            
        case 'passed':
            showOnlyGroup('passed', groups);
            // Auto-expand passed group when filtering to it
            const passedGroup = groups.passed;
            const passedContent = document.getElementById('passed-group-content');
            if (passedGroup && passedContent) {
                passedContent.classList.remove('collapsed');
                passedGroup.classList.add('expanded');
            }
            break;
            
        case 'custom':
            filterBySource('custom', groups);
            break;
            
        case 'builtin':
            filterBySource('builtin', groups);
            break;
    }
}

function showOnlyGroup(targetGroupId, groups) {
    Object.entries(groups).forEach(([groupId, group]) => {
        if (group) {
            if (groupId === targetGroupId) {
                // Only show if it has content
                const hasContent = group.querySelector('.validation-result-item');
                group.style.display = hasContent ? 'block' : 'none';
            } else {
                group.style.display = 'none';
            }
        }
    });
}

function filterBySource(source, groups) {
    // Show all groups but filter their content by source
    Object.values(groups).forEach(group => {
        if (!group) return;
        
        const items = group.querySelectorAll('.validation-result-item');
        let visibleCount = 0;
        
        items.forEach(item => {
            const metricId = item.dataset.metricId;
            const isCustomMetric = metricId && metricId.startsWith('custom.');
            const shouldShow = (source === 'custom') ? isCustomMetric : !isCustomMetric;
            
            item.style.display = shouldShow ? 'flex' : 'none';
            if (shouldShow) visibleCount++;
        });
        
        // Show/hide group based on visible items
        group.style.display = visibleCount > 0 ? 'block' : 'none';
        
        // Update group count
        const countElement = group.querySelector('.group-count');
        if (countElement) {
            countElement.textContent = visibleCount;
        }
    });
}

function initializeExperimentalLLM() {
    const startBtn = document.getElementById('start-llm-btn');
    
    const infoOverlay = document.getElementById('llm-info-overlay');
    const proceedBtn = document.getElementById('llm-proceed-btn');
    const cancelBtn = document.getElementById('llm-cancel-btn');

    const chatOverlay = document.getElementById('llm-chat-overlay');
    const chatTitle = document.getElementById('llm-chat-title');
    const chatHistory = document.getElementById('llm-chat-history');
    const chatForm = document.getElementById('llm-chat-form');
    const chatInput = document.getElementById('llm-chat-input');
    const thinkingIndicator = document.getElementById('llm-thinking-indicator');
    const chatCloseBtn = document.getElementById('llm-chat-close-btn');

    let llmSession = null;

    // --- Event Listeners ---
    startBtn.addEventListener('click', (e) => {
        e.preventDefault();
        infoOverlay.style.display = 'flex';
    });

    cancelBtn.addEventListener('click', () => infoOverlay.style.display = 'none');
    chatCloseBtn.addEventListener('click', () => {
        if (llmSession && llmSession.destroy) {
            llmSession.destroy();
        }
        llmSession = null;
        chatOverlay.style.display = 'none';
    });

    proceedBtn.addEventListener('click', async () => {
        infoOverlay.style.display = 'none';

        // The new check is for 'LanguageModel'
        if (!('LanguageModel' in window)) {
            alert("The Prompt API ('LanguageModel') is not available in your browser. Please ensure you are using Google Chrome Canary and have enabled the required features.");
            return;
        }

        try {
            // Check availability first, as recommended
            const availability = await LanguageModel.availability();
            if (availability === 'unavailable') {
                 alert("The built-in AI is unavailable on your device. It may not be supported or may have been disabled.");
                 return;
            }
            if (availability !== 'available') {
                alert(`The AI model is currently ${availability}. Please wait for the download to complete and try again.`);
                return;
            }

            // The new API for creating a session
            llmSession = await LanguageModel.create();
            
            chatHistory.innerHTML = `<p style="color: var(--text-light);">Session started. You can now chat with the built-in AI about your current simulation.</p>`;
            chatOverlay.style.display = 'flex';
        } catch (err) {
            alert(`Error initializing AI session: ${err.message}.`);
            console.error(err);
        }
    });

    chatForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const userInput = chatInput.value.trim();
        if (!userInput || !llmSession) return;

        appendChatMessage(userInput, 'user');
        chatInput.value = '';
        thinkingIndicator.style.display = 'block';
        chatInput.disabled = true;

        try {
            const simulationContext = `The user is editing a JSON simulation for the Universal Automation Wiki. Here is the current simulation data:\n\n${editor.getValue()}`;
            
            // The new API uses promptStreaming on the session object
            const stream = llmSession.promptStreaming(
                `Context:\n${simulationContext}\n\nUser Question:\n${userInput}`
            );
            
            const aiMessageBubble = appendChatMessage('', 'ai');
            
            // The README provides this exact pattern for streaming
            for await (const chunk of stream) {
                aiMessageBubble.textContent += chunk;
                chatHistory.scrollTop = chatHistory.scrollHeight;
            }

        } catch (err) {
            appendChatMessage(`Error: ${err.message}`, 'error');
            console.error(err);
        } finally {
            thinkingIndicator.style.display = 'none';
            chatInput.disabled = false;
            chatInput.focus();
        }
    });

    function appendChatMessage(text, sender) {
        const messageDiv = document.createElement('div');
        messageDiv.style.marginBottom = '0.75rem';
        
        const bubble = document.createElement('p');
        bubble.textContent = text;
        bubble.style.padding = '0.5rem 1rem';
        bubble.style.borderRadius = '12px';
        bubble.style.maxWidth = '80%';
        bubble.style.display = 'inline-block';
        bubble.style.wordWrap = 'break-word';
        
        if (sender === 'user') {
            messageDiv.style.textAlign = 'right';
            bubble.style.backgroundColor = 'var(--primary-color)';
            bubble.style.color = 'white';
        } else if (sender === 'ai') {
            bubble.style.backgroundColor = 'var(--bg-light)';
            bubble.style.color = 'var(--text-color)';
        } else { // error
             bubble.style.backgroundColor = 'var(--error-color)';
             bubble.style.color = 'white';
        }
        
        messageDiv.appendChild(bubble);
        chatHistory.appendChild(messageDiv);
        chatHistory.scrollTop = chatHistory.scrollHeight;
        return bubble;
    }
}

// Event listeners
document.getElementById("undo-btn").addEventListener("click", undo);

// Simulation library dropdown functionality is now handled in populateSimulationLibrary()

document
    .getElementById("format-json-btn")
    .addEventListener("click", () => {
        try {
            const parsed = JSON.parse(editor.getValue());
            editor.setValue(JSON.stringify(parsed, null, 2));
        } catch (e) {
            alert("Cannot format: Invalid JSON");
        }
    });

document
    .getElementById("clear-editor-btn")
    .addEventListener("click", () => {
        if (confirm("Clear the editor?")) {
            editor.setValue("");
        }
    });

document
    .getElementById("render-simulation-btn")
    .addEventListener("click", renderSimulation);

document
    .getElementById("auto-render-toggle")
    .addEventListener("click", (e) => {
        autoRender = !autoRender;
        updateAutoRenderUI();
        if (autoRender) {
            renderSimulation();
        }
    });

// New action button event listeners
document
    .getElementById("add-object-btn")
    .addEventListener("click", openAddObjectModal);

document
    .getElementById("add-task-btn")
    .addEventListener("click", openAddTaskModal);

document
    .getElementById("fullscreen-btn")
    .addEventListener("click", toggleFullscreen);

document
    .getElementById("submit-btn")
    .addEventListener("click", openSubmitDialog);

// Setup save/load button event listeners
function setupSaveLoadButtons() {
    
    const saveBtn = document.getElementById("save-simulation-btn");
    const loadBtn = document.getElementById("load-simulation-btn");
    
    if (saveBtn) {
        saveBtn.addEventListener("click", openSaveDialog);
    } else {
    }
    
    if (loadBtn) {
        loadBtn.addEventListener("click", openLoadDialog);
    } else {
    }
    
    // Setup copy save code button
    const copyBtn = document.getElementById("copy-save-code-btn");
    if (copyBtn) {
        copyBtn.addEventListener("click", function() {
            const input = document.getElementById('save-code-result');
            if (input && input.value) {
                input.select();
                input.setSelectionRange(0, 99999);
                
                // Try modern clipboard API first, fall back to execCommand
                if (navigator.clipboard) {
                    navigator.clipboard.writeText(input.value).then(() => {
                        this.textContent = 'Copied!';
                        setTimeout(() => {
                            this.textContent = 'Copy';
                        }, 2000);
                    }).catch(err => {
                        console.error('Clipboard API failed:', err);
                        // Fallback to execCommand
                        try {
                            document.execCommand('copy');
                            this.textContent = 'Copied!';
                            setTimeout(() => {
                                this.textContent = 'Copy';
                            }, 2000);
                        } catch (e) {
                            console.error('Copy fallback failed:', e);
                            alert('Copy failed - please select and copy manually');
                        }
                    });
                } else {
                    // Fallback for older browsers
                    try {
                        document.execCommand('copy');
                        this.textContent = 'Copied!';
                        setTimeout(() => {
                            this.textContent = 'Copy';
                        }, 2000);
                    } catch (e) {
                        console.error('Copy fallback failed:', e);
                        alert('Copy failed - please select and copy manually');
                    }
                }
            }
        });
    } else {
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
        localStorage.setItem('uaw-metrics-mode', isMetricsMode.toString());
        updateMetricsMode();
    });
}

function updateMetricsMode() {
    const toggleBtn = document.getElementById("metrics-mode-toggle");
    const playgroundTop = document.querySelector(".playground-top");
    const specialTitle = document.querySelector("h1.special-title");
    
    if (isMetricsMode) {
        // Switch to metrics mode
        toggleBtn.textContent = "Close Metrics Editor";
        toggleBtn.classList.add("metrics-active");
        playgroundTop.classList.add("metrics-mode");
        if (specialTitle) specialTitle.textContent = "Metrics Editor";
        
        // Setup left panel tabs for metrics mode
        setupLeftPanelTabs();
        
        // Initialize metrics components with delay to ensure Monaco is ready
        setTimeout(() => {
            // Copy JSON editor content to metrics mode editor
            if (editor && !window.metricsJsonEditor) {
                createMetricsJsonEditor();
            }
            
            // Initialize metrics editor if not already done
            if (!metricsEditor) {
                initializeMetricsEditor();
            }
            
            // Trigger layout updates for all editors after everything is initialized
            setTimeout(() => {
                
                if (window.metricsJsonEditor) {
                    window.metricsJsonEditor.layout();
                }
                
                if (metricsEditor) {
                    if (metricsEditor.catalogEditor) {
                        metricsEditor.catalogEditor.layout();
                    }
                    if (metricsEditor.validatorEditor) {
                        metricsEditor.validatorEditor.layout();
                    }
                }
                
                // Move existing components to metrics mode layout
                moveComponentsToMetricsMode();
                
                // Setup validation panel for metrics mode
                setupMetricsValidationPanel();
            }, 300);
        }, 200);
    } else {
        // Switch to standard mode
        toggleBtn.textContent = "Open Metrics Editor";
        toggleBtn.classList.remove("metrics-active");
        playgroundTop.classList.remove("metrics-mode");
        if (specialTitle) specialTitle.textContent = "Playground";
        
        // Move components back to standard mode layout
        moveComponentsToStandardMode();
        
        // Reset validation panel to standard mode
        resetValidationPanelToStandard();
        
        // Reset any custom flex sizing that might have been applied in metrics mode
        setTimeout(() => {
            const leftPanel = document.querySelector('.playground-left');
            const metricsPanel = document.querySelector('.metrics-editor-panel');
            if (leftPanel) {
                leftPanel.style.flex = '';
                leftPanel.style.width = '';
            }
            if (metricsPanel) {
                metricsPanel.style.flex = '';
                metricsPanel.style.width = '';
            }
        }, 100);
    }
}

function setupLeftPanelTabs() {
    
    const leftTabButtons = document.querySelectorAll('.left-tab-btn');
    const leftTabContents = document.querySelectorAll('.left-tab-content');
    
    // Remove existing listeners
    leftTabButtons.forEach(btn => {
        btn.replaceWith(btn.cloneNode(true));
    });
    
    // Re-query after clone
    const newLeftTabButtons = document.querySelectorAll('.left-tab-btn');
    
    newLeftTabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetTab = button.dataset.tab;
            switchLeftTab(targetTab);
        });
    });
}

function switchLeftTab(targetTab) {
    
    const leftTabButtons = document.querySelectorAll('.left-tab-btn');
    const leftTabContents = document.querySelectorAll('.left-tab-content');
    
    // Update button states
    leftTabButtons.forEach(btn => btn.classList.remove('active'));
    leftTabContents.forEach(content => content.classList.remove('active'));
    
    // Activate selected tab
    const activeButton = document.querySelector(`.left-tab-btn[data-tab="${targetTab}"]`);
    const activeContent = document.getElementById(`${targetTab}-left-tab`);
    
    if (activeButton) activeButton.classList.add('active');
    if (activeContent) activeContent.classList.add('active');
    
    // Handle specific tab actions
    if (targetTab === 'json-editor' && window.metricsJsonEditor) {
        setTimeout(() => window.metricsJsonEditor.layout(), 100);
    } else if (targetTab === 'space-editor') {
        // Refresh space editor when switching to this tab
        setTimeout(() => refreshSpaceEditor(), 100);
    }
    // No special handling needed for simulation-render tab
    // since it uses the same DOM elements that were moved
}

function createMetricsJsonEditor() {
    
    const container = document.getElementById('json-editor-metrics');
    if (!container) {
        console.error("METRICS: json-editor-metrics container not found");
        return;
    }
    
    if (window.metricsJsonEditor) {
        return;
    }
    
    // Wait for Monaco to be available
    if (typeof monaco === 'undefined') {
        setTimeout(createMetricsJsonEditor, 100);
        return;
    }
    
    try {
        window.metricsJsonEditor = monaco.editor.create(container, {
            value: editor ? editor.getValue() : '{\n  "simulation": {\n    "tasks": [],\n    "objects": [],\n    "locations": []\n  }\n}',
            language: 'json',
            theme: 'vs',
            fontSize: 14,
            lineNumbers: 'on',
            wordWrap: 'on',
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            automaticLayout: true
        });
        
        // Sync changes from metrics editor to main editor
        let syncInProgress = false;
        window.metricsJsonEditor.onDidChangeModelContent(() => {
            if (!syncInProgress && editor) {
                syncInProgress = true;
                editor.setValue(window.metricsJsonEditor.getValue());
                syncInProgress = false;
            }
        });
        
        // Sync changes from main editor to metrics editor
        if (editor) {
            const originalListener = editor.onDidChangeModelContent;
            editor.onDidChangeModelContent(() => {
                if (!syncInProgress && window.metricsJsonEditor) {
                    syncInProgress = true;
                    window.metricsJsonEditor.setValue(editor.getValue());
                    syncInProgress = false;
                }
                // Call original validation/render logic
                if (autoRender) { debounceRender(); }
                // Also call validateJSON if it exists
                if (typeof validateJSON === 'function') {
                    validateJSON();
                }
            });
        }
        
    } catch (error) {
        console.error("METRICS: Error creating JSON editor:", error);
    }
}

function moveComponentsToMetricsMode() {
    
    // Move simulation content
    const simulationTab = document.getElementById('simulation-tab');
    const simulationRenderLeftTab = document.getElementById('simulation-render-left-tab');
    
    if (simulationTab && simulationRenderLeftTab) {
        // Move all children from simulation-tab to simulation-render-left-tab
        while (simulationTab.firstChild) {
            simulationRenderLeftTab.appendChild(simulationTab.firstChild);
        }
    }
    
    // Move space editor content
    const spaceEditorTab = document.getElementById('space-editor-tab');
    const spaceEditorLeftTab = document.getElementById('space-editor-left-tab');
    
    if (spaceEditorTab && spaceEditorLeftTab) {
        // Move all children from space-editor-tab to space-editor-left-tab
        while (spaceEditorTab.firstChild) {
            spaceEditorLeftTab.appendChild(spaceEditorTab.firstChild);
        }
        
        // Refresh space editor after moving
        setTimeout(() => refreshSpaceEditor(), 100);
    }
}

function moveComponentsToStandardMode() {
    
    // Move simulation content back
    const simulationTab = document.getElementById('simulation-tab');
    const simulationRenderLeftTab = document.getElementById('simulation-render-left-tab');
    
    if (simulationTab && simulationRenderLeftTab) {
        // Move all children back from simulation-render-left-tab to simulation-tab
        while (simulationRenderLeftTab.firstChild) {
            simulationTab.appendChild(simulationRenderLeftTab.firstChild);
        }
    }
    
    // Move space editor content back
    const spaceEditorTab = document.getElementById('space-editor-tab');
    const spaceEditorLeftTab = document.getElementById('space-editor-left-tab');
    
    if (spaceEditorTab && spaceEditorLeftTab) {
        // Move all children back from space-editor-left-tab to space-editor-tab
        while (spaceEditorLeftTab.firstChild) {
            spaceEditorTab.appendChild(spaceEditorLeftTab.firstChild);
        }
        
        // Refresh space editor after moving back
        setTimeout(() => refreshSpaceEditor(), 100);
    }
}

function refreshSpaceEditor() {
    
    if (spaceEditor) {
        try {
            // Update view transform to recalculate positioning
            if (typeof spaceEditor.updateViewTransform === 'function') {
                spaceEditor.updateViewTransform();
            }
            
            // Apply layer filtering
            if (typeof spaceEditor.applyLayerFilter === 'function') {
                spaceEditor.applyLayerFilter();
            }
            
            // Update hierarchical display
            if (typeof spaceEditor.updateHierarchicalDisplay === 'function') {
                spaceEditor.updateHierarchicalDisplay();
            }
            
            // Re-render properties panel
            if (typeof spaceEditor.renderPropertiesPanel === 'function') {
                spaceEditor.renderPropertiesPanel();
            }
            
            // Zoom to fit if there are locations
            if (spaceEditor.locations && spaceEditor.locations.length > 0 && typeof spaceEditor.zoomToFit === 'function') {
                setTimeout(() => spaceEditor.zoomToFit(), 50);
            }
            
        } catch (error) {
            console.error("METRICS: Error refreshing space editor:", error);
        }
    } else {
        console.error("METRICS: Space editor not found for refresh");
    }
}

function initializeMetricsEditor() {
    
    if (!window.MetricsEditor) {
        console.error("METRICS: MetricsEditor class not found!");
        return;
    }
    
    try {
        metricsEditor = new MetricsEditor();
        metricsEditor.initialize().then(success => {
            if (success) {
            } else {
                console.error("METRICS: Failed to initialize metrics editor");
            }
        });
    } catch (error) {
        console.error("METRICS: Error creating metrics editor:", error);
    }
}

function setupMetricsValidationPanel() {
    console.log("METRICS: Setting up validation panel for metrics mode");
    
    const metricsControls = document.getElementById("metrics-mode-controls");
    const runValidationBtn = document.getElementById("run-custom-validation");
    
    // Show metrics-specific validation controls
    if (metricsControls) metricsControls.style.display = 'flex';
    
    // Setup custom validation button
    if (runValidationBtn) {
        runValidationBtn.addEventListener('click', runCustomValidation);
    }
    
    // Setup add metric modal
    setupAddMetricModal();
    
    // Run initial validation with custom metrics
    runCustomValidation();
}

function resetValidationPanelToStandard() {
    console.log("METRICS: Resetting validation panel to standard mode");
    
    const metricsControls = document.getElementById("metrics-mode-controls");
    
    // Hide metrics-specific controls
    if (metricsControls) metricsControls.style.display = 'none';
}

function runCustomValidation() {
    console.log("METRICS: Running custom validation");
    
    try {
        const simulationData = getCurrentSimulationData();
        if (!simulationData) {
            console.warn("METRICS: No simulation data available");
            return;
        }
        
        // Get merged metrics catalog (built-in + custom)
        const mergedCatalog = getMergedMetricsCatalog();
        const customValidator = getCustomValidatorCode();
        
        // Run validation with merged catalog and custom code
        const validator = new SimulationValidator(simulationData);
        const results = validator.runChecks(mergedCatalog, customValidator);
        
        // Display results in compact format
        displayCompactValidationResults(results);
        
    } catch (error) {
        console.error("METRICS: Error running custom validation:", error);
        displayValidationError(error.message);
    }
}

function getCustomMetricsCatalog() {
    // First try to get from metrics editor if available
    if (metricsEditor && metricsEditor.catalogEditor) {
        try {
            const catalogContent = metricsEditor.catalogEditor.getValue();
            return JSON.parse(catalogContent) || [];
        } catch (error) {
            console.warn("METRICS: Invalid JSON in custom catalog from editor:", error);
        }
    }
    
    // Fallback to localStorage
    try {
        const storedCatalog = localStorage.getItem('uaw-metrics-catalog-custom');
        if (storedCatalog) {
            return JSON.parse(storedCatalog) || [];
        }
    } catch (error) {
        console.warn("METRICS: Invalid JSON in stored custom catalog:", error);
    }
    
    return [];
}

function getMergedMetricsCatalog() {
    const builtInCatalog = window.metricsCatalog || [];
    const customCatalog = getCustomMetricsCatalog();
    
    // Create a map to handle duplicates (custom metrics override built-in ones with same ID)
    const mergedMap = new Map();
    
    // Add built-in metrics first
    builtInCatalog.forEach(metric => {
        mergedMap.set(metric.id, { ...metric, source: 'builtin' });
    });
    
    // Add custom metrics (will override built-in if same ID)
    customCatalog.forEach(metric => {
        mergedMap.set(metric.id, { ...metric, source: 'custom' });
    });
    
    return Array.from(mergedMap.values());
}

function getCustomValidatorCode() {
    // First try to get from metrics editor if available
    if (metricsEditor && metricsEditor.validatorEditor) {
        return metricsEditor.validatorEditor.getValue();
    }
    
    // Fallback to localStorage
    return localStorage.getItem('uaw-metrics-validator-custom') || '';
}

function displayCompactValidationResults(results) {
    // Use the new grouped validation display
    displayGroupedValidationResults(results);
}

function filterValidationResults() {
    // Legacy function - now handled by applyValidationFilter
    applyValidationFilter();
}

function displayValidationError(message) {
    // Display error as a single error result
    const errorResult = [{
        metricId: 'validation.error',
        status: 'error',
        message: message
    }];
    
    displayGroupedValidationResults(errorResult);
}

// Metric Management Modal Functions
function setupAddMetricModal() {
    const addMetricBtn = document.getElementById("add-metric-btn");
    const modal = document.getElementById("add-metric-modal");
    const form = document.getElementById("add-metric-form");
    const cancelBtn = document.getElementById("metric-cancel-btn");
    const confirmBtn = document.getElementById("metric-add-btn");
    
    // Open modal
    if (addMetricBtn) {
        addMetricBtn.addEventListener('click', openAddMetricModal);
    }
    
    // Close modal
    if (cancelBtn) {
        cancelBtn.addEventListener('click', closeAddMetricModal);
    }
    
    // Add metric
    if (confirmBtn) {
        confirmBtn.addEventListener('click', addCustomMetric);
    }
    
    // Setup form handlers
    setupMetricFormHandlers();
}

function openAddMetricModal() {
    const modal = document.getElementById("add-metric-modal");
    if (modal) {
        modal.style.display = 'flex';
        
        // Reset form
        const form = document.getElementById("add-metric-form");
        if (form) form.reset();
        
        // Focus on first input
        const nameInput = document.getElementById("metric-name-input");
        if (nameInput) setTimeout(() => nameInput.focus(), 100);
    }
}

function closeAddMetricModal() {
    const modal = document.getElementById("add-metric-modal");
    if (modal) modal.style.display = 'none';
}

function setupMetricFormHandlers() {
    const nameInput = document.getElementById("metric-name-input");
    const categoryInput = document.getElementById("metric-category-input");
    const idInput = document.getElementById("metric-id-input");
    const functionInput = document.getElementById("metric-function-input");
    const hasParamsCheckbox = document.getElementById("metric-has-params");
    const paramsSection = document.getElementById("metric-params-section");
    
    // Auto-generate ID and function name when name or category changes
    if (nameInput && categoryInput && idInput && functionInput) {
        nameInput.addEventListener('input', updateGeneratedFields);
        categoryInput.addEventListener('change', updateGeneratedFields);
    }
    
    // Toggle parameters section
    if (hasParamsCheckbox && paramsSection) {
        hasParamsCheckbox.addEventListener('change', () => {
            paramsSection.style.display = hasParamsCheckbox.checked ? 'block' : 'none';
        });
    }
}

function updateGeneratedFields() {
    const nameInput = document.getElementById("metric-name-input");
    const categoryInput = document.getElementById("metric-category-input");
    const idInput = document.getElementById("metric-id-input");
    const functionInput = document.getElementById("metric-function-input");
    const idStatus = document.getElementById("metric-id-status");
    const functionStatus = document.getElementById("metric-function-status");
    
    const name = nameInput?.value.trim();
    const category = categoryInput?.value;
    
    if (name && category) {
        // Generate ID: category.name (lowercase, underscores)
        const categorySlug = category.toLowerCase().replace(/\s+/g, '_');
        const nameSlug = name.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, '_');
        const generatedId = `custom.${categorySlug}.${nameSlug}`;
        
        // Generate function name: validateCamelCase
        const camelCaseName = name
            .replace(/[^a-z0-9\s]/gi, '')
            .replace(/\s+(.)/g, (match, char) => char.toUpperCase())
            .replace(/^./, char => char.toUpperCase());
        const generatedFunction = `validate${camelCaseName}`;
        
        if (idInput) idInput.value = generatedId;
        if (functionInput) functionInput.value = generatedFunction;
        
        // Check for duplicates
        checkForDuplicates(generatedId, generatedFunction, idStatus, functionStatus);
    } else {
        // Clear fields if name or category is empty
        if (idInput) idInput.value = '';
        if (functionInput) functionInput.value = '';
        if (idStatus) idStatus.textContent = 'Auto-generated based on category and name';
        if (functionStatus) functionStatus.textContent = 'Auto-generated JavaScript function name';
    }
}

function checkForDuplicates(generatedId, generatedFunction, idStatus, functionStatus) {
    // Check existing metrics catalog for duplicate IDs
    const existingMetrics = [...(window.metricsCatalog || [])];
    
    // Add custom metrics from editor if available
    if (metricsEditor && metricsEditor.catalogEditor) {
        try {
            const customMetrics = JSON.parse(metricsEditor.catalogEditor.getValue());
            existingMetrics.push(...customMetrics);
        } catch (e) {
            // Ignore parse errors
        }
    }
    
    // Check for duplicate ID
    const idExists = existingMetrics.some(m => m.id === generatedId);
    if (idStatus) {
        if (idExists) {
            idStatus.textContent = '⚠️ This ID already exists - please change name or category';
            idStatus.style.color = '#856404';
        } else {
            idStatus.textContent = '✓ ID is available';
            idStatus.style.color = '#28a745';
        }
    }
    
    // Check for duplicate function name
    let functionExists = false;
    if (metricsEditor && metricsEditor.validatorEditor) {
        const validatorCode = metricsEditor.validatorEditor.getValue();
        functionExists = validatorCode.includes(`function ${generatedFunction}(`);
    }
    
    if (functionStatus) {
        if (functionExists) {
            functionStatus.textContent = '⚠️ This function name already exists';
            functionStatus.style.color = '#856404';
        } else {
            functionStatus.textContent = '✓ Function name is available';
            functionStatus.style.color = '#28a745';
        }
    }
}

function addCustomMetric() {
    const form = document.getElementById("add-metric-form");
    const formData = new FormData(form);
    
    // Collect form data
    const metricData = {
        id: document.getElementById("metric-id-input").value,
        name: document.getElementById("metric-name-input").value,
        emoji: document.getElementById("metric-emoji-input").value,
        category: document.getElementById("metric-category-input").value,
        severity: document.getElementById("metric-severity-input").value,
        description: document.getElementById("metric-description-input").value,
        function: document.getElementById("metric-function-input").value,
        validationLogic: document.getElementById("metric-validation-logic").value,
        hasParams: document.getElementById("metric-has-params").checked,
        params: document.getElementById("metric-params-input").value
    };
    
    // Validate required fields
    const requiredFields = ['id', 'name', 'emoji', 'category', 'severity', 'description', 'function'];
    const missingFields = requiredFields.filter(field => !metricData[field]);
    
    if (missingFields.length > 0) {
        alert(`Please fill in all required fields: ${missingFields.join(', ')}`);
        return;
    }
    
    // Validate parameters JSON if provided
    let parsedParams = null;
    if (metricData.hasParams && metricData.params) {
        try {
            parsedParams = JSON.parse(metricData.params);
        } catch (error) {
            alert('Invalid JSON in parameters field. Please check your syntax.');
            return;
        }
    }
    
    try {
        // Generate metric catalog entry
        const catalogEntry = generateMetricCatalogEntry(metricData, parsedParams);
        
        // Generate validator function
        const validatorFunction = generateValidatorFunction(metricData);
        
        // Insert into editors
        insertMetricIntoCatalog(catalogEntry);
        insertFunctionIntoValidator(validatorFunction);
        
        // Close modal and show success
        closeAddMetricModal();
        showNotification(`✅ Custom metric "${metricData.name}" added successfully!`);
        
        // Re-run validation to include new metric
        if (isMetricsMode) {
            setTimeout(runCustomValidation, 500);
        }
        
    } catch (error) {
        console.error('Error adding custom metric:', error);
        alert('Failed to add metric: ' + error.message);
    }
}

function generateMetricCatalogEntry(metricData, parsedParams) {
    const entry = {
        id: metricData.id,
        name: metricData.name,
        emoji: metricData.emoji,
        category: metricData.category,
        severity: metricData.severity,
        source: "custom",
        function: metricData.function,
        description: metricData.description,
        validation_type: "computational"
    };
    
    if (parsedParams) {
        entry.params = parsedParams;
    }
    
    return entry;
}

function generateValidatorFunction(metricData) {
    const functionName = metricData.function;
    const template = getValidationTemplate(metricData.validationLogic);
    
    return `
// ${metricData.name} - ${metricData.description}
function ${functionName}(metric) {
    const simulation = this.simulation;
    const tasks = simulation.tasks || [];
    const objects = simulation.objects || [];
    
    // Get parameters from metric definition
    const params = metric.params || {};
    
    ${template}
}
`;
}

function getValidationTemplate(logicType) {
    const templates = {
        basic: `
    // Basic validation template
    let hasIssue = false;
    let issueMessage = '';
    
    // Add your validation logic here
    if (tasks.length === 0) {
        hasIssue = true;
        issueMessage = 'No tasks found in simulation';
    }
    
    this.addResult({
        metricId: metric.id,
        status: hasIssue ? 'warning' : 'success',
        message: hasIssue ? issueMessage : 'Validation passed'
    });`,
        
        resource: `
    // Resource validation template
    const resources = objects.filter(obj => obj.type === 'resource' || obj.type === 'product');
    
    for (const resource of resources) {
        const quantity = resource.properties?.quantity || 0;
        
        // Example: Check for negative quantities
        if (quantity < 0) {
            this.addResult({
                metricId: metric.id,
                status: 'error',
                message: \`Resource '\${resource.id}' has negative quantity: \${quantity}\`
            });
            return;
        }
    }
    
    this.addResult({
        metricId: metric.id,
        status: 'success',
        message: \`Validated \${resources.length} resources\`
    });`,
        
        timing: `
    // Timing validation template
    for (const task of tasks) {
        const startTime = task.start || "00:00";
        const duration = task.duration || 0;
        
        // Example: Check for extremely long tasks
        if (duration > 480) { // More than 8 hours
            this.addResult({
                metricId: metric.id,
                status: 'warning',
                message: \`Task '\${task.id}' has unusually long duration: \${duration} minutes\`
            });
        }
    }
    
    this.addResult({
        metricId: metric.id,
        status: 'success',
        message: 'Task timing validation completed'
    });`,
        
        dependency: `
    // Dependency validation template
    for (const task of tasks) {
        const dependencies = task.depends_on || [];
        
        // Check if all dependencies exist
        for (const depId of dependencies) {
            const depTask = tasks.find(t => t.id === depId);
            if (!depTask) {
                this.addResult({
                    metricId: metric.id,
                    status: 'error',
                    message: \`Task '\${task.id}' depends on missing task: \${depId}\`
                });
                return;
            }
        }
    }
    
    this.addResult({
        metricId: metric.id,
        status: 'success',
        message: 'Task dependencies validated'
    });`,
        
        custom: `
    // Custom validation logic
    // TODO: Implement your custom validation logic here
    
    // Example structure:
    // 1. Analyze simulation data
    // 2. Check for issues or conditions
    // 3. Report results using this.addResult()
    
    this.addResult({
        metricId: metric.id,
        status: 'info',
        message: 'Custom validation function - please implement your logic'
    });`
    };
    
    return templates[logicType] || templates.custom;
}

function insertMetricIntoCatalog(catalogEntry) {
    if (!metricsEditor || !metricsEditor.catalogEditor) {
        throw new Error('Metrics catalog editor not available');
    }
    
    try {
        const currentContent = metricsEditor.catalogEditor.getValue();
        const currentCatalog = JSON.parse(currentContent);
        
        // Add new metric to catalog
        currentCatalog.push(catalogEntry);
        
        // Update editor with formatted JSON
        const updatedContent = JSON.stringify(currentCatalog, null, 2);
        metricsEditor.catalogEditor.setValue(updatedContent);
        
    } catch (error) {
        throw new Error('Failed to insert metric into catalog: ' + error.message);
    }
}

function insertFunctionIntoValidator(functionCode) {
    if (!metricsEditor || !metricsEditor.validatorEditor) {
        throw new Error('Metrics validator editor not available');
    }
    
    try {
        const currentContent = metricsEditor.validatorEditor.getValue();
        
        // Insert at the end of the file, before any existing footer
        const newContent = currentContent + '\n' + functionCode;
        metricsEditor.validatorEditor.setValue(newContent);
        
    } catch (error) {
        throw new Error('Failed to insert function into validator: ' + error.message);
    }
}

// Close dialog when clicking outside
document
    .getElementById("dialog-overlay")
    .addEventListener("click", (e) => {
        if (e.target.id === "dialog-overlay") {
            closeDialog();
        }
    });

// Keyboard shortcuts
document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
    }
});

// Initialize resize handles
function initializeResizeHandles() {
    const verticalHandle = document.querySelector(
        ".resize-handle-vertical",
    );
    const horizontalHandle = document.querySelector(
        ".resize-handle-horizontal",
    );
    const jsonPanel = document.querySelector(".json-editor-panel");
    const simulationPanel =
        document.querySelector(".simulation-panel");
    const playgroundTop = document.querySelector(".playground-top");
    const playgroundBottom =
        document.querySelector(".playground-bottom");
    const playgroundMain =
        document.querySelector(".playground-main");

    let isDragging = false;
    let dragType = "";

    verticalHandle.addEventListener("mousedown", (e) => {
        isDragging = true;
        dragType = "vertical";
        document.body.style.cursor = "col-resize";
        e.preventDefault();
    });

    horizontalHandle.addEventListener("mousedown", (e) => {
        isDragging = true;
        dragType = "horizontal";
        document.body.style.cursor = "row-resize";
        e.preventDefault();
    });

    document.addEventListener("mousemove", (e) => {
        if (!isDragging) return;
        e.preventDefault();

        if (dragType === "vertical") {
            const containerRect =
                playgroundTop.getBoundingClientRect();
            const newWidth =
                ((e.clientX - containerRect.left) /
                    containerRect.width) *
                100;

            // This logic for vertical resizing is fine
            if (newWidth >= 20 && newWidth <= 80) {
                jsonPanel.style.width = newWidth + "%";
                simulationPanel.style.width = 100 - newWidth + "%";
            }
        } else if (dragType === "horizontal") {
            const mainRect = playgroundMain.getBoundingClientRect();
            const newTopHeight = e.clientY - mainRect.top;

            // Apply new heights in pixels to forcefully override flex properties.
            // This also removes the resizing limits as you requested.
            playgroundTop.style.height = newTopHeight + "px";
            playgroundBottom.style.height =
                mainRect.height - newTopHeight + "px";
        }
    });

    document.addEventListener("mouseup", () => {
        if (isDragging) {
            isDragging = false;
            dragType = "";
            document.body.style.cursor = "default";
        }
    });
}

// Save/Load simulation functionality
let loadedSaveCode = null; // Track the save code we loaded (for lineage)
let hasShownDisclaimer = false; // Track if user has seen disclaimer this session

// Simple file download function
function downloadSimulationFile(data, filename) {
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function hasCustomMetrics() {
    // Check if there are any custom metrics in localStorage
    const customCatalog = localStorage.getItem('uaw-metrics-catalog-custom');
    const customValidator = localStorage.getItem('uaw-metrics-validator-custom');
    
    if (!customCatalog || !customValidator) return false;
    
    // Check if catalog has meaningful content (not just empty array)
    try {
        const catalog = JSON.parse(customCatalog);
        return Array.isArray(catalog) && catalog.length > 0;
    } catch {
        return false;
    }
}

async function downloadSimulationWithMetrics(simulationData, baseName) {
    // Simple check with brief wait for JSZip
    let attempts = 0;
    while (!window.JSZip && !window.JSZipFailed && attempts < 20) {
        if (attempts === 0) console.log('⏳ Waiting for JSZip...');
        await new Promise(resolve => setTimeout(resolve, 250));
        attempts++;
    }

    if (!window.JSZip) {
        console.error('JSZip not available - falling back to JSON save');
        alert('ZIP file creation is not available. Saving as JSON instead.');
        downloadSimulationFile(simulationData, `${baseName}.json`);
        return;
    }
    
    console.log('✅ JSZip ready, creating zip file...');

    try {
        const zip = new JSZip();
    
    // Add simulation data
    zip.file('simulation.json', simulationData);
    
        // Add custom metrics (create empty/default files if none exist)
        const customCatalog = localStorage.getItem('uaw-metrics-catalog-custom');
        const customValidator = localStorage.getItem('uaw-metrics-validator-custom');
        
        // Add metrics catalog (empty array if no custom metrics exist)
        const catalogData = customCatalog || '[]';
        zip.file('metrics-catalog-custom.json', catalogData);
        
        // Add validator (basic template if no custom validator exists)
        const validatorData = customValidator || `// Custom Simulation Validator
// This file contains custom validation functions for your simulation

// Example custom validation function:
// function validateCustomRule(simulation, params = {}) {
//     // Your custom validation logic here
//     return { passed: true, message: "Custom validation passed" };
// }

// Add your custom validation functions here
`;
        zip.file('simulation-validator-custom.js', validatorData);
    
    // Add README for the zip contents
    const readmeContent = `# UAW Simulation Package

This package contains:

## Files
- **simulation.json**: The main simulation data
- **metrics-catalog-custom.json**: Custom metrics definitions
- **simulation-validator-custom.js**: Custom validation functions

## Usage
1. Open UAW Playground (${window.location.origin})
2. Use "Load Simulation" and select this zip file
3. Switch to Metrics Mode to see your custom metrics
4. Custom metrics will be automatically loaded and integrated

Generated on: ${new Date().toISOString()}
UAW Version: Metrics Editor Mode
`;
    
    zip.file('README.md', readmeContent);
    
        // Generate and download zip
        const content = await zip.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(content);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${baseName || 'uaw-simulation'}.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    } catch (error) {
        console.error('Error creating zip file:', error);
        // Fallback to regular JSON save
        downloadSimulationFile(simulationData, `${baseName}.json`);
    }
}

// Simple file upload function
function loadSimulationFromFileInput() {
    return new Promise((resolve, reject) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json,.uaw,.zip';
        
        input.onchange = async function(e) {
            const file = e.target.files[0];
            if (!file) {
                reject(new Error('No file selected'));
                return;
            }
            
            try {
                if (file.name.endsWith('.zip')) {
                    // Handle zip file with custom metrics
                    await loadSimulationFromZip(file, resolve, reject);
                } else {
                    // Handle regular JSON file
                    const reader = new FileReader();
                    reader.onload = function(e) {
                        try {
                            const contents = e.target.result;
                            JSON.parse(contents); // Validate JSON
                            resolve({ success: true, data: contents, filename: file.name });
                        } catch (error) {
                            reject(new Error('Invalid JSON file'));
                        }
                    };
                    reader.onerror = function() {
                        reject(new Error('Failed to read file'));
                    };
                    reader.readAsText(file);
                }
            } catch (error) {
                reject(new Error('Failed to process file: ' + error.message));
            }
        };
        
        input.click();
    });
}

async function loadSimulationFromZip(file, resolve, reject) {
    // Simple check with brief wait for JSZip
    let attempts = 0;
    while (!window.JSZip && !window.JSZipFailed && attempts < 20) {
        if (attempts === 0) console.log('⏳ Waiting for JSZip for zip loading...');
        await new Promise(resolve => setTimeout(resolve, 250));
        attempts++;
    }

    if (!window.JSZip) {
        reject(new Error('ZIP file support not available. Please use a JSON file instead.'));
        return;
    }

    try {
        const zip = new JSZip();
        const zipContent = await zip.loadAsync(file);
        
        // Look for simulation.json in the zip
        const simulationFile = zipContent.file('simulation.json');
        if (!simulationFile) {
            reject(new Error('No simulation.json found in ZIP file'));
            return;
        }
        
        // Extract simulation data
        const simulationData = await simulationFile.async('string');
        
        // Validate simulation JSON
        let parsedSimulation;
        try {
            parsedSimulation = JSON.parse(simulationData);
        } catch (error) {
            reject(new Error('Invalid JSON in simulation.json'));
            return;
        }
        
        // Extract custom metrics if they exist
        const customCatalogFile = zipContent.file('metrics-catalog-custom.json');
        const customValidatorFile = zipContent.file('simulation-validator-custom.js');
        
        let customCatalog = null;
        let customValidator = null;
        
        if (customCatalogFile) {
            try {
                const catalogData = await customCatalogFile.async('string');
                customCatalog = JSON.parse(catalogData);
            } catch (error) {
                console.warn('Failed to parse custom metrics catalog:', error);
            }
        }
        
        if (customValidatorFile) {
            try {
                customValidator = await customValidatorFile.async('string');
            } catch (error) {
                console.warn('Failed to read custom validator:', error);
            }
        }
        
        // Don't apply custom metrics yet - they will be applied when Load button is clicked
        
        resolve({ 
            success: true, 
            data: simulationData, 
            filename: file.name,
            hasCustomMetrics: !!(customCatalog || customValidator),
            customMetricsCount: Array.isArray(customCatalog) ? customCatalog.length : 0,
            customCatalog: customCatalog,
            customValidator: customValidator
        });
        
    } catch (error) {
        console.error('Error loading ZIP file:', error);
        reject(new Error('Failed to read ZIP file: ' + error.message));
    }
}

// Check if user has accepted disclaimer this session
function hasAcceptedDisclaimer() {
    return hasShownDisclaimer || localStorage.getItem('uaw_playground_disclaimer_accepted') === 'true';
}

function setDisclaimerAccepted() {
    hasShownDisclaimer = true;
    localStorage.setItem('uaw_playground_disclaimer_accepted', 'true');
}

function clearSaveState() {
    loadedSaveCode = null;
}

function openSaveDialog() {
    const modal = document.getElementById('save-modal');
    const checkbox = document.getElementById('privacy-consent-checkbox');
    const confirmBtn = document.getElementById('save-confirm-btn');
    const successDiv = document.getElementById('save-success');
    const warningDiv = document.getElementById('cloud-privacy-warning');
    const loadingDiv = document.getElementById('save-loading');
    const localRadio = document.getElementById('save-local-radio');
    const cloudRadio = document.getElementById('save-cloud-radio');
    const localSaveNameDiv = document.getElementById('local-save-name');
    const localFileNameInput = document.getElementById('local-file-name');

    // Reset modal state
    successDiv.style.display = 'none';
    loadingDiv.style.display = 'none';
    checkbox.checked = false;
    localFileNameInput.value = '';

    // Enable local save option
    const localOption = localRadio.parentElement;
    localOption.classList.remove('disabled');
    localRadio.disabled = false;

    // Set up radio button change handlers
    function updateSaveUI() {
        if (localRadio.checked && !localRadio.disabled) {
            warningDiv.style.display = 'none';
            localSaveNameDiv.style.display = 'block';
            confirmBtn.disabled = false;
            confirmBtn.textContent = 'Save to File';
            
            // Show/hide custom metrics option - visible whenever in metrics editor mode
            const customMetricsOption = document.getElementById('custom-metrics-save-option');
            if (customMetricsOption) {
                const shouldShow = isMetricsMode;
                customMetricsOption.style.display = shouldShow ? 'block' : 'none';
                
                // Auto-check if user is in metrics mode with custom metrics
                const checkbox = document.getElementById('include-custom-metrics-checkbox');
                if (checkbox && shouldShow && hasCustomMetrics()) {
                    checkbox.checked = true;
                }
            }
        } else {
            localSaveNameDiv.style.display = 'none';
            if (hasAcceptedDisclaimer()) {
                warningDiv.style.display = 'none';
                confirmBtn.disabled = false;
            } else {
                warningDiv.style.display = 'block';
                confirmBtn.disabled = true;
            }
            confirmBtn.textContent = 'Save to Cloud';
        }
    }

    localRadio.addEventListener('change', updateSaveUI);
    cloudRadio.addEventListener('change', updateSaveUI);
    
    // Initial UI update
    updateSaveUI();

    modal.style.display = 'flex';

    // Handle checkbox change (only if disclaimer not previously accepted)
    if (!hasAcceptedDisclaimer()) {
        checkbox.addEventListener('change', function() {
            confirmBtn.disabled = !this.checked;
        });
    }

    // Handle cancel
    document.getElementById('save-cancel-btn').addEventListener('click', function() {
        modal.style.display = 'none';
    });

    // Handle save
    confirmBtn.addEventListener('click', async function() {
        const simulationData = editor.getValue();
        
        try {
            JSON.parse(simulationData); // Validate JSON
        } catch (e) {
            alert('Please fix JSON errors before saving');
            return;
        }

        const isLocalSave = localRadio.checked && !localRadio.disabled;

        if (isLocalSave) {
            // Local file save
            const fileName = localFileNameInput.value.trim();
            if (!fileName) {
                alert('Please enter a file name');
                localFileNameInput.focus();
                return;
            }

            // Check if custom metrics should be included
            const includeCustomMetrics = document.getElementById('include-custom-metrics-checkbox')?.checked || false;

            // Show loading
            localSaveNameDiv.style.display = 'none';
            loadingDiv.style.display = 'block';
            confirmBtn.disabled = true;

            try {
                // Create clean filename
                const cleanName = fileName.replace(/[<>:"/\\|?*]/g, '-').trim().substring(0, 50);
                
                if (includeCustomMetrics) {
                    // Create zip file with simulation + custom metrics (even if empty)
                    await downloadSimulationWithMetrics(simulationData, cleanName);
                } else {
                    // Standard JSON file download
                    const downloadFileName = `${cleanName || 'uaw-simulation'}.json`;
                    downloadSimulationFile(simulationData, downloadFileName);
                }
                
                loadingDiv.style.display = 'none';
                successDiv.style.display = 'block';
                document.getElementById('cloud-save-result').style.display = 'none';
                document.getElementById('local-save-result').style.display = 'block';
                
                const finalFileName = includeCustomMetrics ? 
                    `${cleanName || 'uaw-simulation'}.zip` : 
                    `${cleanName || 'uaw-simulation'}.json`;
                document.getElementById('saved-filename').textContent = finalFileName;
                
                // Clear save code since we're not using cloud
                loadedSaveCode = null;
                
                showNotification('Simulation downloaded successfully!');
            } catch (error) {
                loadingDiv.style.display = 'none';
                localSaveNameDiv.style.display = 'block';
                confirmBtn.disabled = false;
                alert('Local save failed: ' + error.message);
            }
        } else {
            // Cloud save
            // Show loading
            warningDiv.style.display = 'none';
            loadingDiv.style.display = 'block';
            confirmBtn.disabled = true;

            try {
                const response = await saveSimulation(simulationData, loadedSaveCode);
                
                if (response.success) {
                    // Set disclaimer as accepted for this session
                    setDisclaimerAccepted();
                    
                    // Store the new save code for potential future lineage
                    loadedSaveCode = response.saveCode;
                    document.getElementById('save-code-result').value = response.saveCode;
                    
                    loadingDiv.style.display = 'none';
                    successDiv.style.display = 'block';
                    document.getElementById('cloud-save-result').style.display = 'block';
                    document.getElementById('local-save-result').style.display = 'none';
                } else if (response.saveCode) {
                    // Save was actually successful despite error - log warning but show success
                    console.warn('Save warning (but successful):', response.error);
                    
                    // Set disclaimer as accepted for this session
                    setDisclaimerAccepted();
                    
                    // Store the new save code for potential future lineage
                    loadedSaveCode = response.saveCode;
                    document.getElementById('save-code-result').value = response.saveCode;
                    
                    loadingDiv.style.display = 'none';
                    successDiv.style.display = 'block';
                    document.getElementById('cloud-save-result').style.display = 'block';
                    document.getElementById('local-save-result').style.display = 'none';
                } else {
                    throw new Error(response.error || 'Save failed');
                }
            } catch (error) {
                loadingDiv.style.display = 'none';
                warningDiv.style.display = hasAcceptedDisclaimer() ? 'none' : 'block';
                confirmBtn.disabled = hasAcceptedDisclaimer() ? false : !checkbox.checked;
                alert('Cloud save failed: ' + error.message);
            }
        }
    });

}

function openLoadDialog() {
    const modal = document.getElementById('load-modal');
    const input = document.getElementById('load-code-input');
    const errorDiv = document.getElementById('load-error');
    const loadingDiv = document.getElementById('load-loading');
    const confirmBtn = document.getElementById('load-confirm-btn');
    const localRadio = document.getElementById('load-local-radio');
    const cloudRadio = document.getElementById('load-cloud-radio');
    const cloudSection = document.getElementById('cloud-load-section');
    const localSection = document.getElementById('local-load-section');
    const browseBtn = document.getElementById('browse-local-file-btn');
    const fileInfo = document.getElementById('selected-file-info');
    const fileName = document.getElementById('selected-file-name');

    let selectedFileData = null;

    // Reset modal state
    input.value = '';
    errorDiv.style.display = 'none';
    loadingDiv.style.display = 'none';
    confirmBtn.disabled = false;
    selectedFileData = null;
    fileInfo.style.display = 'none';

    // Enable local load option
    const localOption = localRadio.parentElement;
    localOption.classList.remove('disabled');
    localRadio.disabled = false;

    // Set up radio button change handlers
    function updateLoadUI() {
        if (localRadio.checked && !localRadio.disabled) {
            cloudSection.style.display = 'none';
            localSection.style.display = 'block';
            confirmBtn.textContent = 'Load from File';
            confirmBtn.disabled = !selectedFileData;
        } else {
            localSection.style.display = 'none';
            cloudSection.style.display = 'block';
            confirmBtn.textContent = 'Load from Cloud';
            confirmBtn.disabled = false;
        }
    }

    localRadio.addEventListener('change', updateLoadUI);
    cloudRadio.addEventListener('change', updateLoadUI);
    
    // Initial UI update
    updateLoadUI();

    modal.style.display = 'flex';

    // Variables to store ZIP custom metrics data
    let pendingCustomCatalog = null;
    let pendingCustomValidator = null;

    // Handle file browse
    browseBtn.addEventListener('click', async function() {
        try {
            const result = await loadSimulationFromFileInput();
            selectedFileData = result.data;
            fileName.textContent = result.filename;
            fileInfo.style.display = 'block';
            confirmBtn.disabled = false;
            errorDiv.style.display = 'none';
            
            // Store custom metrics data for later processing
            pendingCustomCatalog = result.customCatalog || null;
            pendingCustomValidator = result.customValidator || null;
            
            // Show indication if custom metrics are present
            if (result.hasCustomMetrics) {
                fileName.textContent += ` (includes ${result.customMetricsCount} custom metrics)`;
            }
        } catch (error) {
            showLoadError(error.message);
            selectedFileData = null;
            pendingCustomCatalog = null;
            pendingCustomValidator = null;
            fileInfo.style.display = 'none';
            confirmBtn.disabled = true;
        }
    });

    // Handle cancel
    document.getElementById('load-cancel-btn').addEventListener('click', function() {
        modal.style.display = 'none';
    });

    // Handle load
    confirmBtn.addEventListener('click', async function() {
        const isLocalLoad = localRadio.checked && !localRadio.disabled;

        if (isLocalLoad) {
            // Local file load
            if (!selectedFileData) {
                showLoadError('Please select a file first');
                return;
            }

            try {
                // Load the simulation into the editor
                editor.setValue(selectedFileData);
                loadedSaveCode = null; // Clear cloud save code
                
                // Apply custom metrics if they exist
                if (pendingCustomCatalog || pendingCustomValidator) {
                    console.log('📦 Applying custom metrics from ZIP file...');
                    
                    // Store custom metrics in localStorage
                    if (pendingCustomCatalog) {
                        localStorage.setItem('uaw-metrics-catalog-custom', JSON.stringify(pendingCustomCatalog, null, 2));
                    }
                    
                    if (pendingCustomValidator) {
                        localStorage.setItem('uaw-metrics-validator-custom', pendingCustomValidator);
                    }
                    
                    // Save current JSON editor content before refresh to prevent loss
                    if (editor) {
                        try {
                            const currentContent = editor.getValue();
                            localStorage.setItem('uaw-json-editor-content', currentContent);
                            console.log('✅ Saved current JSON editor content before refresh');
                        } catch (e) {
                            console.warn('⚠️ Could not save editor content before refresh:', e);
                        }
                    }
                    
                    // Close modal
                    modal.style.display = 'none';
                    
                    // Show notification and refresh
                    const metricsCount = Array.isArray(pendingCustomCatalog) ? pendingCustomCatalog.length : 0;
                    showNotification(
                        `📦 Loaded simulation with custom metrics! (${metricsCount} custom metrics imported). Page will refresh to apply changes...`
                    );
                    
                    // Refresh the page after a brief delay
                    setTimeout(() => {
                        console.log('🔄 Refreshing page to apply loaded custom metrics...');
                        window.location.reload();
                    }, 2000);
                } else {
                    // Close modal
                    modal.style.display = 'none';
                    
                    // Show success message
                    showNotification('Simulation loaded from file successfully!');
                }
            } catch (error) {
                showLoadError('Failed to load simulation: ' + error.message);
            }
        } else {
            // Cloud load
            const saveCode = input.value.trim();
            
            if (saveCode.length !== 16) {
                showLoadError('Save code must be exactly 16 characters');
                return;
            }

            // Show loading
            loadingDiv.style.display = 'block';
            confirmBtn.disabled = true;
            errorDiv.style.display = 'none';

            try {
                const response = await loadSimulation(saveCode);
                
                if (response.success) {
                    // Load the simulation into the editor
                    editor.setValue(response.data);
                    loadedSaveCode = saveCode;
                    
                    // Close modal
                    modal.style.display = 'none';
                    
                    // Show success message briefly
                    showNotification('Simulation loaded from cloud successfully!');
                } else {
                    throw new Error(response.error || 'Load failed');
                }
            } catch (error) {
                showLoadError(error.message);
            } finally {
                loadingDiv.style.display = 'none';
                confirmBtn.disabled = false;
            }
        }
    });

    // Auto-format input (uppercase, alphanumeric only)
    input.addEventListener('input', function() {
        this.value = this.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    });
}

function showLoadError(message) {
    const errorDiv = document.getElementById('load-error');
    const errorMessage = document.getElementById('load-error-message');
    errorMessage.textContent = message;
    errorDiv.style.display = 'block';
}

function showNotification(message) {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #4caf50;
        color: white;
        padding: 12px 20px;
        border-radius: 4px;
        z-index: 10000;
        font-family: Inter, sans-serif;
    `;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 3000);
}

async function saveSimulation(data, previousSaveCode = null) {
    const API_BASE = 'https://api.universalautomation.wiki';
    
    const payload = {
        action: 'create', // Always create new entries
        data: data,
        previousSaveCode: previousSaveCode || undefined
    };

    const response = await fetch(`${API_BASE}/playground/save`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
    });

    return await response.json();
}

async function loadSimulation(saveCode) {
    const API_BASE = 'https://api.universalautomation.wiki';
    
    const response = await fetch(`${API_BASE}/playground/load`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ saveCode })
    });

    return await response.json();
}


// New Modal Functions
let interactionCounter = 0;

function openAddObjectModal() {
    const modal = document.getElementById('add-object-modal');
    const typeSelect = document.getElementById('object-type-select');
    const typeSpecificFields = document.getElementById('object-type-specific-fields');
    
    // Clear form
    modal.querySelectorAll('input, select').forEach(input => input.value = '');
    typeSpecificFields.innerHTML = '';
    
    // Handle type change
    typeSelect.addEventListener('change', function() {
        updateObjectTypeFields(this.value, typeSpecificFields);
    });
    
    modal.style.display = 'flex';
}

function updateObjectTypeFields(type, container) {
    let html = '';
    
    switch(type) {
        case 'actor':
            html = `
                <div class="form-group">
                    <label for="object-role-input">Role:</label>
                    <input type="text" id="object-role-input" placeholder="Head Chef">
                </div>
                <div class="form-group">
                    <label for="object-cost-input">Cost per Hour ($):</label>
                    <input type="number" id="object-cost-input" placeholder="25.00" step="0.01" min="0">
                </div>
            `;
            break;
        case 'equipment':
            html = `
                <div class="form-group">
                    <label for="object-state-input">Initial State:</label>
                    <select id="object-state-input">
                        <option value="clean">Clean</option>
                        <option value="dirty">Dirty</option>
                        <option value="available">Available</option>
                        <option value="in-use">In Use</option>
                        <option value="maintenance">Maintenance</option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="object-capacity-input">Capacity:</label>
                    <input type="number" id="object-capacity-input" placeholder="1" min="1">
                </div>
            `;
            break;
        case 'resource':
            html = `
                <div class="form-group">
                    <label for="object-unit-input">Unit:</label>
                    <input type="text" id="object-unit-input" placeholder="kg, liter, g">
                </div>
                <div class="form-group">
                    <label for="object-quantity-input">Initial Quantity:</label>
                    <input type="number" id="object-quantity-input" placeholder="50" min="0" step="0.01">
                </div>
            `;
            break;
        case 'product':
            html = `
                <div class="form-group">
                    <label for="object-unit-input">Unit:</label>
                    <input type="text" id="object-unit-input" placeholder="batch, loaves, items">
                </div>
                <div class="form-group">
                    <label for="object-quantity-input">Initial Quantity:</label>
                    <input type="number" id="object-quantity-input" placeholder="0" min="0" step="0.01">
                </div>
            `;
            break;
    }
    
    container.innerHTML = html;
}

// Get current timeline context for task creation
function getCurrentTimelineContext() {
    let context = {
        currentTime: null,
        currentTimeFormatted: null,
        activeActors: [],
        availableLocations: [],
        objectStates: {}
    };

    // Get current time from simulation player
    if (player && player.playheadTime !== undefined) {
        context.currentTime = player.playheadTime;
        const hours = Math.floor(player.playheadTime / 60);
        const minutes = Math.floor(player.playheadTime % 60);
        context.currentTimeFormatted = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    }

    // Get simulation data and extract context
    try {
        const simulation = JSON.parse(editor.getValue());
        const simulationData = simulation.simulation;
        
        if (!simulationData) return context;

        // Get available locations
        if (simulationData.layout?.locations) {
            context.availableLocations = simulationData.layout.locations.map(loc => ({
                id: loc.id,
                name: loc.name || loc.id
            }));
        }

        // Get all objects as potential actors (Phase 4: Extended Actors)
        const allObjects = simulationData.objects || [];
        
        if (context.currentTime !== null) {
            // Find objects that are active (not busy) at current time
            allObjects.forEach(obj => {
                const isObjectBusy = simulationData.tasks?.some(task => 
                    task.actor_id === obj.id && 
                    task.start_minutes <= context.currentTime && 
                    task.end_minutes > context.currentTime
                );
                
                // Get object's current location (from their last completed task or initial location)
                let currentLocation = obj.location || obj.properties?.location;
                const objectTasks = simulationData.tasks?.filter(task => task.actor_id === obj.id)
                    .sort((a, b) => a.start_minutes - b.start_minutes) || [];
                
                for (const task of objectTasks) {
                    if (task.end_minutes <= context.currentTime && task.location) {
                        currentLocation = task.location;
                    }
                }
                
                // Determine display role based on object type
                let displayRole;
                if (obj.type === 'actor') {
                    displayRole = obj.properties?.role || 'Actor';
                } else if (obj.type === 'equipment') {
                    displayRole = 'Equipment (Self-Operating)';
                } else if (obj.type === 'resource') {
                    displayRole = 'Resource (Autonomous)';
                } else if (obj.type === 'product') {
                    displayRole = 'Product (Self-Processing)';
                } else {
                    displayRole = obj.type || 'Unknown';
                }
                
                context.activeActors.push({
                    id: obj.id,
                    name: obj.name,
                    type: obj.type,
                    role: displayRole,
                    isBusy: isObjectBusy,
                    currentLocation: currentLocation,
                    isTraditionalActor: obj.type === 'actor'
                });
            });
        } else {
            // No timeline position available, just list all objects as potential actors
            context.activeActors = allObjects.map(obj => {
                let displayRole;
                if (obj.type === 'actor') {
                    displayRole = obj.properties?.role || 'Actor';
                } else if (obj.type === 'equipment') {
                    displayRole = 'Equipment (Self-Operating)';
                } else if (obj.type === 'resource') {
                    displayRole = 'Resource (Autonomous)';
                } else if (obj.type === 'product') {
                    displayRole = 'Product (Self-Processing)';
                } else {
                    displayRole = obj.type || 'Unknown';
                }
                
                return {
                    id: obj.id,
                    name: obj.name,
                    type: obj.type,
                    role: displayRole,
                    isBusy: false,
                    currentLocation: obj.location || obj.properties?.location,
                    isTraditionalActor: obj.type === 'actor'
                };
            });
        }

    } catch (e) {
        console.warn('Error extracting timeline context:', e);
    }

    return context;
}

// Validate object dependencies before deletion
function validateObjectDeletion(simulation, objectIdToDelete, taskStartTime) {
    const warnings = [];
    const errors = [];
    
    if (!simulation.simulation?.tasks) {
        return { valid: true, warnings, errors };
    }
    
    // Find tasks that reference this object and start after the deletion task
    const futureTasks = simulation.simulation.tasks.filter(task => {
        const taskStartMinutes = parseTimeToMinutes(task.start);
        return taskStartMinutes >= taskStartTime;
    });
    
    futureTasks.forEach(task => {
        // Check if task uses this object in old-style interactions
        if (task.equipment_interactions) {
            const hasReference = task.equipment_interactions.some(interaction => 
                interaction.id === objectIdToDelete
            );
            if (hasReference) {
                errors.push(`Task "${task.id}" references deleted object "${objectIdToDelete}" in equipment_interactions`);
            }
        }
        
        // Check if task uses this object in new-style interactions
        if (task.interactions) {
            const hasReference = task.interactions.some(interaction => 
                interaction.object_id === objectIdToDelete
            );
            if (hasReference) {
                errors.push(`Task "${task.id}" references deleted object "${objectIdToDelete}" in interactions`);
            }
        }
        
        // Check if task consumes/produces this object (old-style)
        if (task.consumes && task.consumes[objectIdToDelete]) {
            errors.push(`Task "${task.id}" consumes deleted object "${objectIdToDelete}"`);
        }
        
        if (task.produces && task.produces[objectIdToDelete]) {
            warnings.push(`Task "${task.id}" produces to deleted object "${objectIdToDelete}" - this may be intentional`);
        }
        
        // Check if actor is assigned to this task
        if (task.actor_id === objectIdToDelete) {
            errors.push(`Task "${task.id}" is assigned to deleted actor "${objectIdToDelete}"`);
        }
    });
    
    return {
        valid: errors.length === 0,
        warnings,
        errors
    };
}

// Helper function to parse time string to minutes
function parseTimeToMinutes(timeStr) {
    if (!timeStr) return 0;
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + (minutes || 0);
}

function openAddTaskModal() {
    const modal = document.getElementById('add-task-modal');
    const actorSelect = document.getElementById('task-actor-select');
    const locationSelect = document.getElementById('task-location-select');
    const startTimeInput = document.getElementById('task-start-input');
    
    // Clear form
    modal.querySelectorAll('input, select').forEach(input => {
        if (input.type === 'checkbox') input.checked = false;
        else if (input.type === 'radio') {
            if (input.value === 'duration') input.checked = true;
            else input.checked = false;
        } else {
            input.value = '';
        }
    });
    document.getElementById('interactions-container').innerHTML = '';
    interactionCounter = 0;
    
    // Reset duration/end-time toggle display
    document.getElementById('duration-input-group').style.display = 'block';
    document.getElementById('end-time-input-group').style.display = 'none';
    
    // Get timeline context
    const context = getCurrentTimelineContext();
    
    // Auto-populate start time from timeline position
    if (context.currentTimeFormatted) {
        startTimeInput.value = context.currentTimeFormatted;
        startTimeInput.style.backgroundColor = '#e8f4f8';
        startTimeInput.title = 'Auto-populated from timeline position';
    }
    
    // Populate location dropdown
    locationSelect.innerHTML = '<option value="">Select location...</option>';
    if (context.availableLocations.length > 0) {
        context.availableLocations.forEach(location => {
            const option = document.createElement('option');
            option.value = location.id;
            option.textContent = location.name;
            locationSelect.appendChild(option);
        });
    }
    
    // Populate actors from current simulation
    actorSelect.innerHTML = '<option value="">Select actor...</option>';
    
    if (context.activeActors.length > 0) {
        // Group actors by type for better organization
        const actorsByType = {
            actor: [],
            equipment: [],
            resource: [],
            product: []
        };
        
        context.activeActors.forEach(actor => {
            if (actorsByType[actor.type]) {
                actorsByType[actor.type].push(actor);
            }
        });
        
        // Add grouped options to select
        Object.entries(actorsByType).forEach(([type, actors]) => {
            if (actors.length > 0) {
                // Add optgroup for each type
                const optgroup = document.createElement('optgroup');
                optgroup.label = type === 'actor' ? '👤 Traditional Actors' : 
                               type === 'equipment' ? '⚙️ Equipment (Self-Operating)' :
                               type === 'resource' ? '📦 Resources (Autonomous)' :
                               type === 'product' ? '📋 Products (Self-Processing)' : type;
                
                // Sort actors within group: non-busy first, then by name
                const sortedActors = [...actors].sort((a, b) => {
                    if (a.isBusy !== b.isBusy) return a.isBusy ? 1 : -1;
                    return a.name.localeCompare(b.name);
                });
                
                sortedActors.forEach(actor => {
                    const option = document.createElement('option');
                    option.value = actor.id;
                    option.textContent = `${actor.name}${actor.isBusy ? ' - BUSY' : ''}`;
                    if (actor.isBusy) {
                        option.style.color = '#999';
                        option.disabled = true;
                    }
                    optgroup.appendChild(option);
                });
                
                actorSelect.appendChild(optgroup);
            }
        });
        
        // If only one available actor, select it automatically (prioritize traditional actors)
        const availableActors = context.activeActors.filter(a => !a.isBusy);
        const traditionalActors = availableActors.filter(a => a.isTraditionalActor);
        
        if (traditionalActors.length === 1 && availableActors.length === 1) {
            // Only one traditional actor available
            actorSelect.value = traditionalActors[0].id;
            
            // Auto-populate location from selected actor's current location
            if (traditionalActors[0].currentLocation && locationSelect) {
                locationSelect.value = traditionalActors[0].currentLocation;
                locationSelect.style.backgroundColor = '#e8f4f8';
                locationSelect.title = 'Auto-populated from actor location';
            }
        } else if (availableActors.length === 1) {
            // Only one actor of any type available
            actorSelect.value = availableActors[0].id;
            
            // Auto-populate location from selected actor's current location
            if (availableActors[0].currentLocation && locationSelect) {
                locationSelect.value = availableActors[0].currentLocation;
                locationSelect.style.backgroundColor = '#e8f4f8';
                locationSelect.title = 'Auto-populated from object location';
            }
        }
    } else {
        actorSelect.innerHTML = '<option value="">No objects available as actors</option>';
    }
    
    // Setup time input toggle handlers
    setupTimeInputToggle();
    
    modal.style.display = 'flex';
}

// Handle duration/end-time toggle functionality
function setupTimeInputToggle() {
    const durationRadio = document.querySelector('input[name="time-input-mode"][value="duration"]');
    const endTimeRadio = document.querySelector('input[name="time-input-mode"][value="end-time"]');
    const durationGroup = document.getElementById('duration-input-group');
    const endTimeGroup = document.getElementById('end-time-input-group');
    const durationInput = document.getElementById('task-duration-input');
    const endTimeInput = document.getElementById('task-end-time-input');
    const startTimeInput = document.getElementById('task-start-input');

    function toggleInputMode() {
        if (durationRadio.checked) {
            durationGroup.style.display = 'block';
            endTimeGroup.style.display = 'none';
        } else {
            durationGroup.style.display = 'none';
            endTimeGroup.style.display = 'block';
        }
    }

    function calculateEndTime() {
        const startTime = startTimeInput.value;
        const duration = parseInt(durationInput.value);
        
        if (startTime && duration) {
            const [hours, minutes] = startTime.split(':').map(Number);
            const startMinutes = hours * 60 + minutes;
            const endMinutes = startMinutes + duration;
            const endHours = Math.floor(endMinutes / 60);
            const endMins = endMinutes % 60;
            
            endTimeInput.value = `${String(endHours).padStart(2, '0')}:${String(endMins).padStart(2, '0')}`;
        }
    }

    function calculateDuration() {
        const startTime = startTimeInput.value;
        const endTime = endTimeInput.value;
        
        if (startTime && endTime) {
            const [startHours, startMinutes] = startTime.split(':').map(Number);
            const [endHours, endMinutes] = endTime.split(':').map(Number);
            const startTotalMinutes = startHours * 60 + startMinutes;
            const endTotalMinutes = endHours * 60 + endMinutes;
            const duration = endTotalMinutes - startTotalMinutes;
            
            if (duration > 0) {
                durationInput.value = duration;
            }
        }
    }

    // Event listeners
    durationRadio.addEventListener('change', toggleInputMode);
    endTimeRadio.addEventListener('change', toggleInputMode);
    
    // Auto-calculate values when inputs change
    durationInput.addEventListener('input', calculateEndTime);
    startTimeInput.addEventListener('input', () => {
        if (durationRadio.checked) calculateEndTime();
        else calculateDuration();
    });
    endTimeInput.addEventListener('input', calculateDuration);

    // Initial setup
    toggleInputMode();
}

function addInteraction() {
    const container = document.getElementById('interactions-container');
    const interactionId = ++interactionCounter;
    
    // Get available objects from current simulation for object selection
    let objects = [];
    try {
        const simulation = JSON.parse(editor.getValue());
        objects = simulation.simulation?.objects || [];
    } catch (e) {
        // Empty simulation
    }
    
    const objectOptions = [
        '<option value="self">🔄 Self (Actor performs action on itself)</option>',
        ...objects.map(obj => 
            `<option value="${obj.id}">${obj.name} (${obj.type})</option>`
        )
    ].join('');
    
    const interactionDiv = document.createElement('div');
    interactionDiv.className = 'interaction-item';
    interactionDiv.innerHTML = `
        <div class="interaction-header">
            <h5>Interaction ${interactionId}</h5>
            <button type="button" class="remove-interaction-btn" onclick="removeInteraction(this)">Remove</button>
        </div>
        <div class="property-changes-container">
            <div class="property-changes-list"></div>
        </div>
    `;
    
    container.appendChild(interactionDiv);
    
    // Automatically add the first property change with object options
    addPropertyChange(interactionDiv.querySelector('.property-changes-container'), objectOptions);
}

function removeInteraction(button) {
    button.closest('.interaction-item').remove();
}

function addPropertyChange(buttonOrContainer, objectOptions = null) {
    // Handle both button click and direct container call
    let container;
    if (buttonOrContainer.classList && buttonOrContainer.classList.contains('property-changes-container')) {
        container = buttonOrContainer.querySelector('.property-changes-list');
    } else {
        container = buttonOrContainer.parentElement.parentElement.querySelector('.property-changes-list');
    }
    
    // Get available objects if not provided
    if (!objectOptions) {
        let objects = [];
        try {
            const simulation = JSON.parse(editor.getValue());
            objects = simulation.simulation?.objects || [];
        } catch (e) {
            // Empty simulation
        }
        objectOptions = [
            '<option value="self">🔄 Self (Actor performs action on itself)</option>',
            ...objects.map(obj => 
                `<option value="${obj.id}">${obj.name} (${obj.type})</option>`
            )
        ].join('');
    }
    const changeDiv = document.createElement('div');
    changeDiv.className = 'property-change-group';
    changeDiv.innerHTML = `
        <div class="form-row">
            <div class="form-group">
                <label>Change Type:</label>
                <select class="property-change-type">
                    <option value="from_to">From/To</option>
                    <option value="delta">Delta</option>
                    <option value="add_object">Add Object</option>
                    <option value="remove_object">Remove Object</option>
                </select>
            </div>
        </div>
        
        <!-- Object selection for property changes (from_to, delta) -->
        <div class="object-selection-fields">
            <div class="form-row">
                <div class="form-group">
                    <label>Object:</label>
                    <select class="interaction-object-select">
                        <option value="">Select object...</option>
                        ${objectOptions}
                    </select>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Property:</label>
                    <input type="text" class="property-name" placeholder="state, quantity, etc.">
                </div>
            </div>
        </div>
        
        <!-- From/To fields -->
        <div class="property-from-to-fields">
            <div class="form-row">
                <div class="form-group">
                    <label>From:</label>
                    <input type="text" class="property-from" placeholder="current value">
                </div>
                <div class="form-group">
                    <label>To:</label>
                    <input type="text" class="property-to" placeholder="new value">
                </div>
            </div>
        </div>
        
        <!-- Delta fields -->
        <div class="property-delta-fields" style="display: none;">
            <div class="form-row">
                <div class="form-group">
                    <label>Delta:</label>
                    <input type="number" class="property-delta" placeholder="0" step="0.01">
                </div>
            </div>
        </div>
        
        <!-- Add Object fields -->
        <div class="property-add-object-fields" style="display: none;">
            <div class="form-row">
                <div class="form-group">
                    <label>Object Type:</label>
                    <select class="object-type">
                        <option value="">Select type...</option>
                        <option value="actor">Actor (People, AI agents)</option>
                        <option value="equipment">Equipment (Tools, machines)</option>
                        <option value="resource">Resource (Materials, consumables)</option>
                        <option value="product">Product (Outputs, deliverables)</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Object ID:</label>
                    <input type="text" class="object-id" placeholder="unique_id">
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Name:</label>
                    <input type="text" class="object-name" placeholder="Display name">
                </div>
                <div class="form-group">
                    <label>Emoji:</label>
                    <input type="text" class="object-emoji" placeholder="🔧" maxlength="2">
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Location:</label>
                    <input type="text" class="object-location" placeholder="location_id">
                </div>
                <div class="form-group">
                    <label>Created at time:</label>
                    <select class="creation-timing">
                        <option value="start">Task start</option>
                        <option value="end">Task completion</option>
                    </select>
                </div>
            </div>
        </div>
        
        <!-- Remove Object fields -->
        <div class="property-remove-object-fields" style="display: none;">
            <div class="form-row">
                <div class="form-group">
                    <label>Target Object:</label>
                    <select class="remove-object-id">
                        <option value="">Select object to remove...</option>
                        ${objectOptions}
                    </select>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label style="display: flex; align-items: center; gap: 0.5rem; width: auto;">
                        <input type="checkbox" class="store-deleted-state">
                        <span>Store state for potential restoration</span>
                    </label>
                    <small style="color: #666; font-size: 0.8rem;">Recommended for objects that might be recreated later</small>
                </div>
            </div>
        </div>
        
        <!-- Revert checkbox -->
        <div class="form-row">
            <div class="form-group">
                <label style="display: flex; align-items: center; gap: 0.5rem; width: auto;">
                    <input type="checkbox" class="revert-after-checkbox">
                    <span>Revert After Task</span>
                </label>
            </div>
        </div>
    `;
    
    container.appendChild(changeDiv);
    
    // Handle change type toggle
    const changeTypeSelect = changeDiv.querySelector('.property-change-type');
    changeTypeSelect.addEventListener('change', function() {
        const objectSelectionFields = changeDiv.querySelector('.object-selection-fields');
        const fromToFields = changeDiv.querySelector('.property-from-to-fields');
        const deltaFields = changeDiv.querySelector('.property-delta-fields');
        const addObjectFields = changeDiv.querySelector('.property-add-object-fields');
        const removeObjectFields = changeDiv.querySelector('.property-remove-object-fields');
        
        // Hide all fields first
        objectSelectionFields.style.display = 'none';
        fromToFields.style.display = 'none';
        deltaFields.style.display = 'none';
        addObjectFields.style.display = 'none';
        removeObjectFields.style.display = 'none';
        
        // Show appropriate fields based on selection
        if (this.value === 'from_to') {
            objectSelectionFields.style.display = 'block';
            fromToFields.style.display = 'block';
        } else if (this.value === 'delta') {
            objectSelectionFields.style.display = 'block';
            deltaFields.style.display = 'block';
        } else if (this.value === 'add_object') {
            addObjectFields.style.display = 'block';
        } else if (this.value === 'remove_object') {
            removeObjectFields.style.display = 'block';
        }
        
        // Attach emoji pickers to any new emoji fields
        if (window.emojiPicker) {
            window.emojiPicker.attachToDynamicFields(changeDiv);
        }
    });
    
    // Attach emoji pickers to initial fields
    if (window.emojiPicker) {
        window.emojiPicker.attachToDynamicFields(changeDiv);
    }
}

function removePropertyChange(button) {
    button.closest('.property-change-group').remove();
}

// Modal event handlers
document.getElementById('object-cancel-btn').addEventListener('click', function() {
    document.getElementById('add-object-modal').style.display = 'none';
});

document.getElementById('object-add-btn').addEventListener('click', function() {
    addObjectToSimulation();
});

document.getElementById('task-cancel-btn').addEventListener('click', function() {
    document.getElementById('add-task-modal').style.display = 'none';
});

document.getElementById('task-add-btn').addEventListener('click', function() {
    addTaskToSimulation();
});

// Clear validation styling when user starts typing/selecting
['task-id-input', 'task-emoji-input', 'task-actor-select', 'task-start-input', 'task-duration-input', 'task-end-time-input'].forEach(id => {
    const element = document.getElementById(id);
    if (element) {
        element.addEventListener('input', function() {
            this.classList.remove('required-missing');
        });
        element.addEventListener('change', function() {
            this.classList.remove('required-missing');
        });
    }
});

document.getElementById('add-interaction-btn').addEventListener('click', function() {
    addInteraction();
});

function addObjectToSimulation() {
    const type = document.getElementById('object-type-select').value;
    const id = document.getElementById('object-id-input').value.trim();
    const name = document.getElementById('object-name-input').value.trim();
    const emoji = document.getElementById('object-emoji-input').value.trim();
    const location = document.getElementById('object-location-input').value.trim();
    
    if (!type || !id || !name) {
        alert('Please fill in all required fields');
        return;
    }
    
    const newObject = {
        id: id,
        type: type,
        name: name,
        properties: { location: location }
    };
    
    if (emoji) {
        newObject.emoji = emoji;
    }
    
    // Add type-specific properties
    switch(type) {
        case 'actor':
            const role = document.getElementById('object-role-input')?.value.trim();
            const cost = parseFloat(document.getElementById('object-cost-input')?.value);
            if (role) newObject.properties.role = role;
            if (cost) newObject.properties.cost_per_hour = cost;
            break;
        case 'equipment':
            const state = document.getElementById('object-state-input')?.value;
            const capacity = parseInt(document.getElementById('object-capacity-input')?.value);
            if (state) newObject.properties.state = state;
            if (capacity) newObject.properties.capacity = capacity;
            break;
        case 'resource':
        case 'product':
            const unit = document.getElementById('object-unit-input')?.value.trim();
            const quantity = parseFloat(document.getElementById('object-quantity-input')?.value);
            if (unit) newObject.properties.unit = unit;
            if (!isNaN(quantity)) newObject.properties.quantity = quantity;
            break;
    }
    
    try {
        let simulation;
        const jsonText = editor.getValue().trim();
        
        if (!jsonText) {
            simulation = {
                simulation: {
                    meta: {
                        id: "new_simulation",
                        article_title: "New Simulation",
                        domain: "General"
                    },
                    config: {
                        time_unit: "minute",
                        start_time: "06:00",
                        end_time: "18:00"
                    },
                    objects: [],
                    tasks: []
                }
            };
        } else {
            simulation = JSON.parse(jsonText);
            if (!simulation.simulation) simulation.simulation = {};
            if (!simulation.simulation.objects) simulation.simulation.objects = [];
        }
        
        simulation.simulation.objects.push(newObject);
        
        saveToHistory();
        editor.setValue(JSON.stringify(simulation, null, 2));
        debounceRender();
        document.getElementById('add-object-modal').style.display = 'none';
        
    } catch (e) {
        alert('Error adding object: ' + e.message);
    }
}

function addTaskToSimulation() {
    const taskId = document.getElementById('task-id-input').value.trim();
    const emoji = document.getElementById('task-emoji-input').value.trim();
    const actorId = document.getElementById('task-actor-select').value;
    const location = document.getElementById('task-location-select').value;
    const startTime = document.getElementById('task-start-input').value;
    const dependsInput = document.getElementById('task-depends-input').value.trim();
    
    // Get duration based on current input mode
    const durationRadio = document.querySelector('input[name="time-input-mode"][value="duration"]');
    let duration;
    
    if (durationRadio.checked) {
        duration = parseInt(document.getElementById('task-duration-input').value);
    } else {
        // Calculate duration from start and end time
        const endTime = document.getElementById('task-end-time-input').value;
        if (startTime && endTime) {
            const [startHours, startMinutes] = startTime.split(':').map(Number);
            const [endHours, endMinutes] = endTime.split(':').map(Number);
            const startTotalMinutes = startHours * 60 + startMinutes;
            const endTotalMinutes = endHours * 60 + endMinutes;
            duration = endTotalMinutes - startTotalMinutes;
        }
    }
    
    // Clear any previous validation styling
    document.querySelectorAll('.required-missing').forEach(el => el.classList.remove('required-missing'));
    
    let hasErrors = false;
    const requiredFields = [
        { value: taskId, element: document.getElementById('task-id-input'), name: 'Task ID' },
        { value: emoji, element: document.getElementById('task-emoji-input'), name: 'Emoji' },
        { value: actorId, element: document.getElementById('task-actor-select'), name: 'Actor' },
        { value: startTime, element: document.getElementById('task-start-input'), name: 'Start Time' },
    ];
    
    // Check duration field based on current input mode
    const durationElement = durationRadio.checked 
        ? document.getElementById('task-duration-input')
        : document.getElementById('task-end-time-input');
    const durationFieldName = durationRadio.checked ? 'Duration' : 'End Time';
    
    if (!duration || duration <= 0) {
        durationElement.classList.add('required-missing');
        hasErrors = true;
    }
    
    // Check other required fields
    requiredFields.forEach(field => {
        if (!field.value) {
            field.element.classList.add('required-missing');
            hasErrors = true;
        }
    });
    
    if (hasErrors) {
        alert('Please fill in all required fields with valid values');
        return;
    }
    
    const depends_on = dependsInput ? dependsInput.split(',').map(s => s.trim()).filter(s => s) : [];
    
    const newTask = {
        id: taskId,
        emoji: emoji,
        actor_id: actorId,
        start: startTime,
        duration: duration,
        location: location,
        depends_on: depends_on,
        interactions: []
    };
    
    // Process interactions - each property change group is now independent
    const propertyGroups = document.querySelectorAll('#interactions-container .property-change-group');
    propertyGroups.forEach(group => {
        const changeType = group.querySelector('.property-change-type').value;
        const revertAfter = group.querySelector('.revert-after-checkbox').checked;
        
        if (changeType === 'add_object') {
            const objectType = group.querySelector('.object-type').value;
            const objectId = group.querySelector('.object-id').value.trim();
            const objectName = group.querySelector('.object-name').value.trim();
            const objectEmoji = group.querySelector('.object-emoji')?.value.trim();
            const objectLocation = group.querySelector('.object-location').value.trim();
            
            if (objectType && objectId && objectName) {
                const newObject = {
                    type: objectType,
                    id: objectId,
                    name: objectName,
                    properties: { location: objectLocation || '' }
                };
                
                if (objectEmoji) {
                    newObject.emoji = objectEmoji;
                }
                
                const interaction = {
                    add_objects: [newObject]
                };
                if (revertAfter) interaction.revert_after = true;
                newTask.interactions.push(interaction);
            }
        } else if (changeType === 'remove_object') {
            const removeObjectId = group.querySelector('.remove-object-id').value.trim();
            if (removeObjectId) {
                // Validate object deletion dependencies
                const taskStartMinutes = parseTimeToMinutes(startTime);
                const validation = validateObjectDeletion(simulation, removeObjectId, taskStartMinutes);
                
                if (!validation.valid && !revertAfter) {
                    // Show validation errors and warnings
                    let message = `Warning: Deleting object "${removeObjectId}" may cause issues:\n\n`;
                    
                    if (validation.errors.length > 0) {
                        message += 'ERRORS:\n' + validation.errors.join('\n') + '\n\n';
                    }
                    
                    if (validation.warnings.length > 0) {
                        message += 'WARNINGS:\n' + validation.warnings.join('\n') + '\n\n';
                    }
                    
                    message += 'Do you want to proceed anyway? Consider using "Revert After Task" to temporarily remove the object.';
                    
                    if (!confirm(message)) {
                        return; // Don't add the interaction
                    }
                }
                
                const interaction = {
                    remove_objects: [removeObjectId]
                };
                if (revertAfter) interaction.revert_after = true;
                newTask.interactions.push(interaction);
            }
        } else {
            // Property changes (from_to, delta)
            const rawObjectId = group.querySelector('.interaction-object-select')?.value;
            const propertyName = group.querySelector('.property-name')?.value.trim();
            
            if (!rawObjectId || !propertyName) return;
            
            // Handle self-interactions by using the actor's ID
            const objectId = rawObjectId === 'self' ? actorId : rawObjectId;
            
            const interaction = {
                object_id: objectId,
                property_changes: {}
            };
            
            if (changeType === 'delta') {
                const delta = parseFloat(group.querySelector('.property-delta').value);
                if (!isNaN(delta)) {
                    interaction.property_changes[propertyName] = { delta: delta };
                }
            } else {
                const from = group.querySelector('.property-from').value.trim();
                const to = group.querySelector('.property-to').value.trim();
                if (from && to) {
                    interaction.property_changes[propertyName] = { from: from, to: to };
                }
            }
            
            if (Object.keys(interaction.property_changes).length > 0) {
                if (revertAfter) interaction.revert_after = true;
                newTask.interactions.push(interaction);
            }
        }
    });
    
    try {
        let simulation;
        const jsonText = editor.getValue().trim();
        
        if (!jsonText) {
            simulation = {
                simulation: {
                    meta: {
                        id: "new_simulation",
                        article_title: "New Simulation",
                        domain: "General"
                    },
                    config: {
                        time_unit: "minute",
                        start_time: "06:00",
                        end_time: "18:00"
                    },
                    objects: [],
                    tasks: []
                }
            };
        } else {
            simulation = JSON.parse(jsonText);
            if (!simulation.simulation) simulation.simulation = {};
            if (!simulation.simulation.tasks) simulation.simulation.tasks = [];
        }
        
        simulation.simulation.tasks.push(newTask);
        
        saveToHistory();
        editor.setValue(JSON.stringify(simulation, null, 2));
        debounceRender();
        document.getElementById('add-task-modal').style.display = 'none';
        
    } catch (e) {
        alert('Error adding task: ' + e.message);
    }
}

// === FEEDBACK FUNCTIONALITY ===
function initializeFeedbackModal() {
    const feedbackBtn = document.getElementById('feedback-btn');
    const feedbackModal = document.getElementById('feedback-modal');
    const feedbackForm = document.getElementById('feedback-form');
    const cancelBtn = document.getElementById('cancel-feedback');
    const feedbackMessage = document.getElementById('feedback-message');
    
    // Open feedback modal
    if (feedbackBtn) {
        feedbackBtn.addEventListener('click', () => {
            feedbackModal.style.display = 'flex';
            feedbackForm.reset();
            feedbackMessage.style.display = 'none';
        });
    }
    
    // Close feedback modal
    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
            feedbackModal.style.display = 'none';
        });
    }
    
    // Close modal when clicking outside
    feedbackModal.addEventListener('click', (e) => {
        if (e.target === feedbackModal) {
            feedbackModal.style.display = 'none';
        }
    });
    
    // Handle form submission
    if (feedbackForm) {
        feedbackForm.addEventListener('submit', handleFeedbackSubmit);
    }
}

async function handleFeedbackSubmit(event) {
    event.preventDefault();
    
    const form = event.target;
    const submitBtn = document.getElementById('send-feedback');
    const feedbackMessage = document.getElementById('feedback-message');
    const originalSubmitText = submitBtn.textContent;
    
    // Disable submit button and show loading state
    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending...';
    feedbackMessage.style.display = 'none';
    
    try {
        const formData = new FormData(form);
        
        // Add page context
        formData.append('page', 'simulation-playground');
        formData.append('url', window.location.href);
        formData.append('timestamp', new Date().toISOString());
        
        // Prepare data for Lambda function (matching feedback.js format)
        const feedbackData = {
            name: formData.get('name') || 'Anonymous',
            email: formData.get('email') || '',
            message: `${formData.get('subject')}\n\n${formData.get('message')}`,
            pageUrl: formData.get('url')
        };
        
        // AWS Lambda endpoint (same as feedback.js)
        const apiUrl = 'https://4hmwnax7r1.execute-api.us-east-1.amazonaws.com/default/uaw-feedback-handler';
        
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(feedbackData),
            mode: 'cors'
        });
        
        if (response.ok) {
            feedbackMessage.innerHTML = '<div class="feedback-success">✅ Thank you for your feedback! Your message has been sent successfully.</div>';
            feedbackMessage.style.display = 'block';
            form.reset();
            
            // Close modal after 2 seconds
            setTimeout(() => {
                document.getElementById('feedback-modal').style.display = 'none';
            }, 2000);
        } else {
            throw new Error('Failed to send feedback');
        }
    } catch (error) {
        console.error('Feedback submission error:', error);
        feedbackMessage.innerHTML = '<div class="feedback-error">❌ Sorry, there was an error sending your feedback. Please try again later.</div>';
        feedbackMessage.style.display = 'block';
    } finally {
        // Re-enable submit button
        submitBtn.disabled = false;
        submitBtn.textContent = originalSubmitText;
    }
}

// Global ESC key handler to close any open modal
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        // List all possible modals and overlays
        const modals = [
            'dialog-overlay',
            'welcome-overlay', 
            'save-modal',
            'load-modal',
            'add-task-modal',
            'add-object-modal',
            'llm-info-overlay',
            'llm-chat-overlay',
            'feedback-modal'
        ];
        
        // Find and close the first visible modal
        for (const modalId of modals) {
            const modal = document.getElementById(modalId);
            if (modal && (modal.style.display === 'flex' || modal.style.display === 'block')) {
                // Handle special cases that have close functions or cleanup
                if (modalId === 'dialog-overlay') {
                    closeDialog();
                } else if (modalId === 'llm-chat-overlay') {
                    // Clean up LLM session if exists
                    if (typeof llmSession !== 'undefined' && llmSession && llmSession.destroy) {
                        llmSession.destroy();
                    }
                    if (typeof llmSession !== 'undefined') {
                        llmSession = null;
                    }
                    modal.style.display = 'none';
                } else {
                    // For all other modals, simply hide them
                    modal.style.display = 'none';
                }
                break; // Only close the first visible modal
            }
        }
    }
});

// Initialize feedback modal when the page loads
document.addEventListener('DOMContentLoaded', () => {
    initializeFeedbackModal();
});
