// Playground Core - Main initialization logic and global state management
// Universal Automation Wiki - Simulation Playground

// Global state variables
let editor;
let tutorialManager, player, spaceEditor, emojiPicker;
let tutorialData = null;
let isPlaygroundInitialized = false; // Flag to prevent double-initialization
let autoRender = true;

// Metrics Editor Variables
let metricsEditor = null;
let isMetricsMode = false;

// Welcome overlay handling
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

// Data fetching and initialization
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

// Core initialization function
function initializePlayground() {
    setupTabs();
    updateAutoRenderUI();
    initializeResizeHandles();
    initializeDragAndDrop();
    setupSaveLoadButtons();
    setupMetricsMode();
    setupRenderButton();

    const canvas = document.getElementById('space-canvas');
    const propsPanel = document.getElementById('properties-panel-content');
    if (canvas && propsPanel) {
        spaceEditor = new SpaceEditor(canvas, propsPanel, editor);
    } else {
        console.error("INIT ERROR: Canvas or Properties Panel element not found!");
    }
    
    initializeTutorial();
    initializeExperimentalLLM();

    renderSimulation();
    validateJSON();
    
    // Setup validation interactions after everything is initialized
    setTimeout(() => {
        if (typeof setupValidationInteractions === 'function') {
            setupValidationInteractions();
        }
    }, 100);
}

// Single point of entry for initialization
function attemptInitializePlayground() {
    // This function can be called from either async operation (fetch or monaco).
    // It will only run the actual initialization once all conditions are met.
    if (isPlaygroundInitialized) return; // Already done, do nothing.
    if (editor && tutorialData && window.metricsCatalog && window.simulationLibrary) {
        isPlaygroundInitialized = true; // Set flag to prevent re-entry
        initializePlayground();
    }
}

// Simulation library functionality
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


// Setup render and auto-render buttons
function setupRenderButton() {
    const renderBtn = document.getElementById('render-simulation-btn');
    const autoRenderToggle = document.getElementById('auto-render-toggle');
    
    if (renderBtn) {
        renderBtn.addEventListener('click', renderSimulation);
    }
    
    if (autoRenderToggle) {
        autoRenderToggle.addEventListener('click', () => {
            autoRender = !autoRender;
            updateAutoRenderUI();
            if (autoRender) {
                renderSimulation();
            }
        });
    }
}

