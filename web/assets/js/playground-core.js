/**
 * Playground Core Module
 * Handles initialization logic and application lifecycle
 */

import { PlaygroundConfig, ConfigManager } from './playground-config.js';
import { PlaygroundUI } from './playground-ui.js';
import { PlaygroundEditor } from './playground-editor.js';
import { PlaygroundValidation } from './playground-validation.js';
import { PlaygroundHistory } from './playground-history.js';

export class PlaygroundCore {
    constructor() {
        this.isInitialized = false;
        this.editor = null;
        this.tutorialManager = null;
        this.player = null;
        this.spaceEditor = null;
        this.tutorialData = null;
        this.autoRender = true;
        
        this.ui = new PlaygroundUI(this);
        this.editorManager = new PlaygroundEditor(this);
        this.validation = new PlaygroundValidation(this);
        this.history = new PlaygroundHistory(this);
        
        console.log("SCRIPT START: Initializing Playground Core.");
    }
    
    /**
     * Initialize the playground application
     */
    async init() {
        try {
            console.log("CORE: Starting playground initialization");
            
            // Load external data first
            await this.loadExternalData();
            
            // Initialize Monaco editor
            await this.editorManager.initMonacoEditor();
            
            // Attempt full initialization
            this.attemptInitializePlayground();
            
        } catch (error) {
            console.error("CORE: Failed to initialize playground", error);
            this.handleInitializationError(error);
        }
    }
    
    /**
     * Load external data (tutorial content, metrics catalog)
     */
    async loadExternalData() {
        console.log("FETCH: Initiating fetch for tutorial and metrics catalogs.");
        
        try {
            const [tutorialData, metricsData] = await Promise.all([
                fetch(PlaygroundConfig.API.TUTORIAL_CONTENT).then(res => {
                    if (!res.ok) throw new Error(`Fetch failed for tutorial-content.json: ${res.statusText}`);
                    return res.json();
                }),
                fetch(PlaygroundConfig.API.METRICS_CATALOG).then(res => {
                    if (!res.ok) throw new Error(`Fetch failed for metrics-catalog.json: ${res.statusText}`);
                    return res.json();
                })
            ]);
            
            this.tutorialData = tutorialData;
            window.metricsCatalog = metricsData;
            console.log("FETCH SUCCESS: Catalogs loaded.");
            
        } catch (error) {
            console.error(PlaygroundConfig.ERRORS.FETCH_FAILED, error);
            throw error;
        }
    }
    
    /**
     * Attempt to initialize playground (called from multiple places)
     */
    attemptInitializePlayground() {
        console.log("CORE: Attempting playground initialization");
        
        // This function can be called from either async operation (fetch or monaco).
        // It will only run the actual initialization once all conditions are met.
        if (this.isInitialized) {
            console.log("CORE: Already initialized, skipping");
            return;
        }
        
        if (this.editor && this.tutorialData && window.metricsCatalog) {
            console.log("CORE: All dependencies ready, initializing playground");
            this.isInitialized = true;
            this.initializePlayground();
        } else {
            console.log("CORE: Dependencies not ready yet", {
                hasEditor: !!this.editor,
                hasTutorialData: !!this.tutorialData,
                hasMetricsCatalog: !!window.metricsCatalog
            });
        }
    }
    
    /**
     * Main initialization function
     */
    initializePlayground() {
        console.log("INIT: Running initializePlayground().");
        
        try {
            console.log("INIT: 1. Setting up UI components.");
            this.ui.setupTabs();
            this.ui.updateAutoRenderUI();
            this.ui.initializeResizeHandles();
            this.ui.initializeDragAndDrop();
            
            console.log("INIT: 2. Instantiating controllers.");
            this.initializeSpaceEditor();
            
            console.log("INIT: 3. Initializing subsystems.");
            this.initializeTutorial();
            this.initializeExperimentalLLM();
            
            console.log("INIT: 4. Performing initial render and validation.");
            this.renderSimulation();
            this.validation.validateJSON();
            
            console.log("INIT: initializePlayground() completed successfully.");
            
        } catch (error) {
            console.error("INIT ERROR: Failed to initialize playground", error);
            this.handleInitializationError(error);
        }
    }
    
    /**
     * Initialize the space editor component
     */
    initializeSpaceEditor() {
        const canvas = document.getElementById('space-canvas');
        const propsPanel = document.getElementById('properties-panel-content');
        
        if (canvas && propsPanel) {
            this.spaceEditor = new SpaceEditor(canvas, propsPanel, this.editor);
            console.log("INIT: SpaceEditor instantiated successfully.");
        } else {
            console.error(PlaygroundConfig.ERRORS.CANVAS_NOT_FOUND);
        }
    }
    
    /**
     * Initialize tutorial system
     */
    initializeTutorial() {
        console.log("INIT: Setting up tutorial system.");
        
        const playgroundElements = {
            jsonEditor: this.editor,
            simulationContent: document.querySelector('.simulation-content'),
            validationPanel: document.querySelector('.validation-panel'),
            buttons: {
                addTask: document.getElementById('add-task-btn'),
                addActor: document.getElementById('add-actor-btn'),
                render: document.getElementById('render-simulation-btn'),
                submit: document.getElementById('submit-btn')
            }
        };
        
        if (window.TutorialManager && this.tutorialData) {
            this.tutorialManager = new TutorialManager(this.tutorialData, playgroundElements);
            console.log("INIT: Tutorial manager initialized successfully.");
        } else {
            console.log("INIT: Tutorial manager not available or data missing.");
        }
    }
    
    /**
     * Initialize experimental LLM features
     */
    initializeExperimentalLLM() {
        console.log("INIT: Initializing experimental LLM features.");
        // Placeholder for future LLM integration
    }
    
    /**
     * Render the simulation
     */
    renderSimulation() {
        try {
            const jsonText = this.editor.getValue().trim();
            if (!jsonText) {
                console.log("RENDER: No JSON content to render");
                return;
            }
            
            const simulationData = JSON.parse(jsonText);
            
            // Use the simulation viewer to render
            if (window.renderSimulation) {
                window.renderSimulation(simulationData, document.querySelector('.simulation-content'));
            } else {
                console.warn("RENDER: Simulation renderer not available");
            }
            
        } catch (error) {
            console.error("RENDER: Failed to render simulation", error);
        }
    }
    
    /**
     * Handle initialization errors
     */
    handleInitializationError(error) {
        console.error("PLAYGROUND INITIALIZATION FAILED:", error);
        
        // Show user-friendly error message
        const errorMessage = document.createElement('div');
        errorMessage.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #f8d7da;
            color: #721c24;
            padding: 15px;
            border: 1px solid #f5c6cb;
            border-radius: 5px;
            z-index: 10000;
            max-width: 400px;
        `;
        errorMessage.innerHTML = `
            <strong>Initialization Error</strong><br>
            Failed to load the playground. Please refresh the page and try again.
            <br><small>Error: ${error.message}</small>
        `;
        
        document.body.appendChild(errorMessage);
        
        // Auto-remove after 10 seconds
        setTimeout(() => {
            if (errorMessage.parentNode) {
                errorMessage.parentNode.removeChild(errorMessage);
            }
        }, 10000);
    }
    
    /**
     * Get current simulation data
     */
    getCurrentSimulationData() {
        try {
            const jsonText = this.editor.getValue().trim();
            if (jsonText) {
                return JSON.parse(jsonText);
            }
        } catch (e) {
            console.warn("Failed to parse current simulation data:", e);
        }
        return null;
    }
    
    /**
     * Toggle auto-render functionality
     */
    toggleAutoRender() {
        this.autoRender = !this.autoRender;
        this.ui.updateAutoRenderUI();
        console.log(`Auto-render ${this.autoRender ? 'enabled' : 'disabled'}`);
    }
    
    /**
     * Cleanup resources
     */
    destroy() {
        console.log("CORE: Cleaning up playground resources");
        
        if (this.editor) {
            this.editor.dispose();
        }
        
        if (this.tutorialManager) {
            this.tutorialManager.cleanup();
        }
        
        this.isInitialized = false;
    }
}

// Global instance
let playgroundCore = null;

/**
 * Initialize the playground application
 */
export function initPlayground() {
    if (!playgroundCore) {
        playgroundCore = new PlaygroundCore();
        playgroundCore.init();
    }
    return playgroundCore;
}

/**
 * Get the current playground instance
 */
export function getPlaygroundCore() {
    return playgroundCore;
}