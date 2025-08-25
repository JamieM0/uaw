// Playground JavaScript for Universal Automation Wiki
// Main application logic for the simulation playground

console.log("SCRIPT START: Initializing global variables.");
let editor;
let tutorialManager, player, spaceEditor;
let tutorialData = null;
let isPlaygroundInitialized = false; // Flag to prevent double-initialization
let autoRender = true;

// --- DATA FETCHING ---
console.log("FETCH: Initiating fetch for tutorial, metrics, and simulation library catalogs.");
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
    console.log("FETCH SUCCESS: Catalogs loaded.");
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
    console.log("INIT: Running initializePlayground().");

    console.log("INIT: 1. Setting up UI components.");
    setupTabs();
    updateAutoRenderUI();
    initializeResizeHandles();
    initializeDragAndDrop();
    setupSaveLoadButtons();

    console.log("INIT: 2. Instantiating controllers.");
    const canvas = document.getElementById('space-canvas');
    const propsPanel = document.getElementById('properties-panel-content');
    if (canvas && propsPanel) {
        spaceEditor = new SpaceEditor(canvas, propsPanel, editor);
        console.log("INIT: SpaceEditor instantiated successfully.");
    } else {
        console.error("INIT ERROR: Canvas or Properties Panel element not found!");
    }
    
    initializeTutorial();
    initializeExperimentalLLM();

    console.log("INIT: 3. Performing initial render and validation.");
    renderSimulation();
    validateJSON();
    console.log("INIT: initializePlayground() completed successfully.");
}

// --- SIMULATION LIBRARY FUNCTIONALITY ---
function populateSimulationLibrary() {
    console.log("LIBRARY: Populating simulation library dropdown.");
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
    console.log(`LIBRARY: Loading simulation ${simulationId}`);
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
    
    console.log(`LIBRARY: Successfully loaded ${simulation.name}`);
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
console.log("MONACO: Starting initialization.");
require.config({
    paths: { vs: "https://unpkg.com/monaco-editor@0.44.0/min/vs" },
});
require(["vs/editor/editor.main"], function () {
    console.log("MONACO-CALLBACK: Monaco editor is ready.");
    // Load the breadmaking simulation from the library as default
    const defaultSimulation = window.simulationLibrary ? 
        window.simulationLibrary.simulations.find(s => s.id === 'breadmaking') : 
        null;
    const defaultSimulationData = defaultSimulation ? 
        { simulation: defaultSimulation.simulation } : 
        sampleSimulation;

    editor = monaco.editor.create(
        document.getElementById("json-editor"),
        {
            value: JSON.stringify(defaultSimulationData, null, 2),
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
        changeTimeout = setTimeout(() => { saveToHistory(); }, 1000);
    });

    // Now that the editor is ready, try to initialize the playground.
    console.log("MONACO-CALLBACK: Attempting to initialize playground.");
    attemptInitializePlayground();
});

function setupTabs() {
    console.log("UI: Setting up tabs.");
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
                        console.log("No valid JSON to load into space editor");
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
        }, 2000);
    }
}

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
            console.log("Page structure loaded successfully");
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
    const resources = allObjects.filter(o => o.type === 'resource_pile' || o.type === 'product');

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

        // --- NEW Dynamic State Panels ---
        const liveStateContainer = document.createElement('div');
        liveStateContainer.id = 'live-state-container';
        liveStateContainer.style.display = 'flex';
        liveStateContainer.style.gap = '1rem';
        liveStateContainer.style.marginTop = '1rem';

        // Panel for live equipment state
        const liveEquipmentPanel = document.createElement("div");
        liveEquipmentPanel.id = 'live-equipment-panel';
        liveEquipmentPanel.className = "resources-panel";
        liveEquipmentPanel.innerHTML = `<h5>⚙️ Equipment State (at <span class="live-time">00:00</span>)</h5><div class="resource-grid"></div>`;
        
        // Panel for live resource stock
        const liveResourcesPanel = document.createElement("div");
        liveResourcesPanel.id = 'live-resources-panel';
        liveResourcesPanel.className = "resources-panel";
        liveResourcesPanel.innerHTML = `<h5>📦 Resource Stock (at <span class="live-time">00:00</span>)</h5><div class="resource-grid"></div>`;

        liveStateContainer.appendChild(liveEquipmentPanel);
        liveStateContainer.appendChild(liveResourcesPanel);
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

        if (
            window.metricsCatalog &&
            window.metricsCatalog.length > 0
        ) {
            const validator = new SimulationValidator(parsed);
            const validationResults = validator.runChecks(
                window.metricsCatalog,
            );
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
    const categoriesContainer = document.getElementById(
        "validation-categories",
    );

    // Check for a clean run (only success messages)
    const hasIssues = results.some((r) => r.status !== "success");

    if (!hasIssues) {
        categoriesContainer.innerHTML =
            '<div class="validation-success" style="text-align: center; padding: 2rem;">🎉 Perfect! No validation issues found.</div>';
        return;
    }

    // Prepare categories for grouping issues
    const categories = {
        "Structural Integrity": {
            id: "critical-errors",
            results: [],
        },
        "Resource Flow": { id: "resource-issues", results: [] },
        Scheduling: { id: "scheduling-conflicts", results: [] },
        Optimization: {
            id: "optimization-suggestions",
            results: [],
        },
    };

    // Create a map for quick metric lookup
    const metricMap = new Map(
        window.metricsCatalog.map((m) => [m.id, m]),
    );

    // Group results by category
    results.forEach((result) => {
        if (result.status === "success") return; // Don't display success messages in the detailed view

        const metric = metricMap.get(result.metricId);
        if (metric && categories[metric.category]) {
            categories[metric.category].results.push({
                ...result,
                severity: metric.severity, // Pass severity for UI styling
            });
        }
    });

    let html = "";
    for (const [categoryName, categoryData] of Object.entries(
        categories,
    )) {
        if (categoryData.results.length > 0) {
            html += `
                <div class="validation-category ${categoryData.id}">
                    <h4>${categoryName} (${categoryData.results.length})</h4>
                    ${categoryData.results
                        .map(
                            (result) => `
                        <div class="validation-issue ${result.severity || "warning"}">
                            ${result.message}
                        </div>
                    `,
                        )
                        .join("")}
                </div>
            `;
        }
    }
    categoriesContainer.innerHTML = html;
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
    console.log("INIT: Setting up save/load buttons.");
    
    const saveBtn = document.getElementById("save-simulation-btn");
    const loadBtn = document.getElementById("load-simulation-btn");
    
    if (saveBtn) {
        saveBtn.addEventListener("click", openSaveDialog);
        console.log("INIT: Save button event listener attached.");
    } else {
        console.error("INIT: Save button not found!");
    }
    
    if (loadBtn) {
        loadBtn.addEventListener("click", openLoadDialog);
        console.log("INIT: Load button event listener attached.");
    } else {
        console.error("INIT: Load button not found!");
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
        console.log("INIT: Copy save code button event listener attached.");
    } else {
        console.log("INIT: Copy save code button not found (will be available when save modal opens).");
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
    const warningDiv = modal.querySelector('.save-warning');
    const loadingDiv = document.getElementById('save-loading');

    // Reset modal state
    successDiv.style.display = 'none';
    loadingDiv.style.display = 'none';
    checkbox.checked = false;

    // Always save as new entry - show disclaimer only if not previously accepted
    if (hasAcceptedDisclaimer()) {
        warningDiv.style.display = 'none';
        confirmBtn.disabled = false;
    } else {
        warningDiv.style.display = 'block';
        confirmBtn.disabled = true;
    }
    
    confirmBtn.textContent = 'Save Simulation';

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
            } else {
                throw new Error(response.error || 'Save failed');
            }
        } catch (error) {
            loadingDiv.style.display = 'none';
            warningDiv.style.display = hasAcceptedDisclaimer() ? 'none' : 'block';
            confirmBtn.disabled = hasAcceptedDisclaimer() ? false : !checkbox.checked;
            alert('Save failed: ' + error.message);
        }
    });

}

function openLoadDialog() {
    const modal = document.getElementById('load-modal');
    const input = document.getElementById('load-code-input');
    const errorDiv = document.getElementById('load-error');
    const loadingDiv = document.getElementById('load-loading');
    const confirmBtn = document.getElementById('load-confirm-btn');

    // Reset modal state
    input.value = '';
    errorDiv.style.display = 'none';
    loadingDiv.style.display = 'none';
    confirmBtn.disabled = false;

    modal.style.display = 'flex';

    // Handle cancel
    document.getElementById('load-cancel-btn').addEventListener('click', function() {
        modal.style.display = 'none';
    });

    // Handle load
    confirmBtn.addEventListener('click', async function() {
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
                showNotification('Simulation loaded successfully!');
            } else {
                throw new Error(response.error || 'Load failed');
            }
        } catch (error) {
            showLoadError(error.message);
        } finally {
            loadingDiv.style.display = 'none';
            confirmBtn.disabled = false;
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

function openAddTaskModal() {
    const modal = document.getElementById('add-task-modal');
    const actorSelect = document.getElementById('task-actor-select');
    
    // Clear form
    modal.querySelectorAll('input, select').forEach(input => {
        if (input.type === 'checkbox') input.checked = false;
        else input.value = '';
    });
    document.getElementById('interactions-container').innerHTML = '';
    interactionCounter = 0;
    
    // Populate actors from current simulation
    try {
        const simulation = JSON.parse(editor.getValue());
        const actors = simulation.simulation?.objects?.filter(obj => obj.type === 'actor') || [];
        
        actorSelect.innerHTML = '<option value="">Select actor...</option>';
        actors.forEach(actor => {
            const option = document.createElement('option');
            option.value = actor.id;
            option.textContent = `${actor.name} (${actor.properties?.role || actor.id})`;
            actorSelect.appendChild(option);
        });
    } catch (e) {
        actorSelect.innerHTML = '<option value="">Select actor... (No valid simulation loaded)</option>';
    }
    
    modal.style.display = 'flex';
}

function addInteraction() {
    const container = document.getElementById('interactions-container');
    const interactionId = ++interactionCounter;
    
    // Get available objects from current simulation
    let objects = [];
    try {
        const simulation = JSON.parse(editor.getValue());
        objects = simulation.simulation?.objects || [];
    } catch (e) {
        // Empty simulation
    }
    
    const objectOptions = objects.map(obj => 
        `<option value="${obj.id}">${obj.name} (${obj.type})</option>`
    ).join('');
    
    const interactionDiv = document.createElement('div');
    interactionDiv.className = 'interaction-item';
    interactionDiv.innerHTML = `
        <div class="interaction-header">
            <h5>Interaction ${interactionId}</h5>
            <button type="button" class="remove-interaction-btn" onclick="removeInteraction(this)">Remove</button>
        </div>
        <div class="form-row">
            <div class="form-group">
                <label>Object:</label>
                <select class="interaction-object-select">
                    <option value="">Select object...</option>
                    ${objectOptions}
                </select>
            </div>
        </div>
        <div class="property-changes-container">
            <div class="property-changes-header">
                <h6>Property Changes:</h6>
                <button type="button" class="btn-secondary" onclick="addPropertyChange(this)">+ Add Property Change</button>
            </div>
            <div class="property-changes-list"></div>
        </div>
        <div class="form-row">
            <div class="form-group">
                <label>
                    <input type="checkbox" class="revert-after-checkbox"> Revert After Task
                </label>
            </div>
        </div>
    `;
    
    container.appendChild(interactionDiv);
}

function removeInteraction(button) {
    button.closest('.interaction-item').remove();
}

function addPropertyChange(button) {
    const container = button.parentElement.parentElement.querySelector('.property-changes-list');
    const changeDiv = document.createElement('div');
    changeDiv.className = 'property-change-group';
    changeDiv.innerHTML = `
        <div class="form-row">
            <div class="form-group">
                <label>Property:</label>
                <input type="text" class="property-name" placeholder="state, quantity, etc.">
            </div>
            <div class="form-group">
                <label>Change Type:</label>
                <select class="property-change-type">
                    <option value="from_to">From/To</option>
                    <option value="delta">Delta</option>
                </select>
            </div>
        </div>
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
        <div class="property-delta-fields" style="display: none;">
            <div class="form-row">
                <div class="form-group">
                    <label>Delta:</label>
                    <input type="number" class="property-delta" placeholder="0" step="0.01">
                </div>
            </div>
        </div>
        <button type="button" class="btn-secondary" onclick="removePropertyChange(this)">Remove Property</button>
    `;
    
    container.appendChild(changeDiv);
    
    // Handle change type toggle
    const changeTypeSelect = changeDiv.querySelector('.property-change-type');
    changeTypeSelect.addEventListener('change', function() {
        const fromToFields = changeDiv.querySelector('.property-from-to-fields');
        const deltaFields = changeDiv.querySelector('.property-delta-fields');
        
        if (this.value === 'delta') {
            fromToFields.style.display = 'none';
            deltaFields.style.display = 'block';
        } else {
            fromToFields.style.display = 'block';
            deltaFields.style.display = 'none';
        }
    });
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
    const location = document.getElementById('task-location-input').value.trim();
    const startTime = document.getElementById('task-start-input').value;
    const duration = parseInt(document.getElementById('task-duration-input').value);
    const dependsInput = document.getElementById('task-depends-input').value.trim();
    
    if (!taskId || !emoji || !actorId || !startTime || !duration) {
        alert('Please fill in all required fields');
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
    
    // Process interactions
    const interactionItems = document.querySelectorAll('#interactions-container .interaction-item');
    interactionItems.forEach(item => {
        const objectId = item.querySelector('.interaction-object-select').value;
        if (!objectId) return;
        
        const interaction = {
            object_id: objectId,
            property_changes: {}
        };
        
        const revertAfter = item.querySelector('.revert-after-checkbox').checked;
        if (revertAfter) {
            interaction.revert_after = true;
        }
        
        // Process property changes
        const propertyGroups = item.querySelectorAll('.property-change-group');
        propertyGroups.forEach(group => {
            const propertyName = group.querySelector('.property-name').value.trim();
            const changeType = group.querySelector('.property-change-type').value;
            
            if (!propertyName) return;
            
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
        });
        
        if (Object.keys(interaction.property_changes).length > 0) {
            newTask.interactions.push(interaction);
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
