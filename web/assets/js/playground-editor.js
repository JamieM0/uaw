/**
 * Playground Editor Module
 * Handles Monaco editor integration and JSON editing functionality
 */

import { PlaygroundConfig, ConfigManager } from './playground-config.js';

export class PlaygroundEditor {
    constructor(core) {
        this.core = core;
        this.editor = null;
        this.changeTimeout = null;
        this.debounceRender = ConfigManager.debounce(() => this.handleContentChange(), PlaygroundConfig.DEBOUNCE_DELAY);
    }
    
    /**
     * Initialize Monaco Editor
     */
    async initMonacoEditor() {
        console.log("MONACO: Starting initialization.");
        
        return new Promise((resolve, reject) => {
            // Configure Monaco paths
            require.config(ConfigManager.getMonacoConfig());
            
            require(["vs/editor/editor.main"], () => {
                try {
                    console.log("MONACO-CALLBACK: Monaco editor is ready.");
                    
                    const editorElement = document.getElementById("json-editor");
                    if (!editorElement) {
                        throw new Error("JSON editor element not found");
                    }
                    
                    // Create editor with sample simulation
                    const sampleData = ConfigManager.getSampleSimulation();
                    const editorSettings = ConfigManager.getEditorSettings(
                        JSON.stringify(sampleData, null, 2)
                    );
                    
                    this.editor = monaco.editor.create(editorElement, editorSettings);
                    this.core.editor = this.editor;
                    
                    // Set up event handlers
                    this.setupEventHandlers();
                    
                    console.log("MONACO-CALLBACK: Editor created and configured.");
                    resolve(this.editor);
                    
                    // Attempt to initialize playground now that editor is ready
                    this.core.attemptInitializePlayground();
                    
                } catch (error) {
                    console.error("MONACO: Failed to initialize editor", error);
                    reject(error);
                }
            });
        });
    }
    
    /**
     * Set up event handlers for the editor
     */
    setupEventHandlers() {
        // Auto-render on content change
        this.editor.onDidChangeModelContent(() => {
            if (this.core.autoRender) {
                this.debounceRender();
            }
        });
        
        // History saving with debounce
        this.editor.onDidChangeModelContent(() => {
            clearTimeout(this.changeTimeout);
            this.changeTimeout = setTimeout(() => {
                this.core.history.saveToHistory();
            }, PlaygroundConfig.HISTORY_SAVE_DELAY);
        });
        
        console.log("MONACO: Event handlers configured.");
    }
    
    /**
     * Handle content change (render and validate)
     */
    handleContentChange() {
        console.log("EDITOR: Content changed, updating simulation");
        
        // Run validation
        if (this.core.tutorialManager && this.core.tutorialManager.isActive) {
            this.core.tutorialManager.runStepValidation();
        } else {
            this.core.validation.validateJSON();
        }
        
        // Update space editor if not currently being manipulated
        if (this.core.spaceEditor && 
            !this.core.spaceEditor.isDrawing && 
            !this.core.spaceEditor.isDragging && 
            !this.core.spaceEditor.isUpdatingJson) {
            try {
                const currentJson = JSON.parse(this.editor.getValue());
                this.core.spaceEditor.loadLayout(currentJson.simulation.layout);
            } catch(e) {
                // Ignore parse errors during typing
                console.log("EDITOR: Ignoring parse error during typing");
            }
        }
        
        // Render simulation
        this.core.renderSimulation();
    }
    
    /**
     * Load sample simulation data
     */
    loadSample() {
        console.log("EDITOR: Loading sample simulation");
        
        const sampleData = ConfigManager.getSampleSimulation();
        this.editor.setValue(JSON.stringify(sampleData, null, 2));
        
        // Trigger immediate render and validation
        this.handleContentChange();
    }
    
    /**
     * Format JSON content
     */
    formatJSON() {
        console.log("EDITOR: Formatting JSON");
        
        try {
            const currentValue = this.editor.getValue();
            const parsed = JSON.parse(currentValue);
            const formatted = JSON.stringify(parsed, null, 2);
            
            this.editor.setValue(formatted);
            
            // Show success message
            this.showNotification("JSON formatted successfully", "success");
            
        } catch (error) {
            console.error("EDITOR: Failed to format JSON", error);
            this.showNotification("Invalid JSON - cannot format", "error");
        }
    }
    
    /**
     * Clear editor content
     */
    clearEditor() {
        console.log("EDITOR: Clearing editor content");
        
        if (confirm("Are you sure you want to clear all content?")) {
            this.editor.setValue("");
            this.showNotification("Editor cleared", "info");
        }
    }
    
    /**
     * Get current editor value
     */
    getValue() {
        return this.editor ? this.editor.getValue() : "";
    }
    
    /**
     * Set editor value
     */
    setValue(value) {
        if (this.editor) {
            this.editor.setValue(value);
        }
    }
    
    /**
     * Get current JSON as parsed object
     */
    getCurrentJSON() {
        try {
            const value = this.getValue().trim();
            return value ? JSON.parse(value) : null;
        } catch (error) {
            console.warn("EDITOR: Failed to parse current JSON", error);
            return null;
        }
    }
    
    /**
     * Update a specific task in the JSON
     */
    updateTaskInJSON(taskId, newActorId, newTime) {
        console.log("EDITOR: Updating task in JSON", { taskId, newActorId, newTime });
        
        try {
            const simulationData = this.getCurrentJSON();
            if (!simulationData || !simulationData.simulation || !simulationData.simulation.tasks) {
                console.error("EDITOR: Invalid simulation data structure");
                return;
            }
            
            const task = simulationData.simulation.tasks.find(t => t.id === taskId);
            if (!task) {
                console.error("EDITOR: Task not found", taskId);
                return;
            }
            
            // Update task properties
            if (newActorId) task.actor_id = newActorId;
            if (newTime) task.start_time = newTime;
            
            // Update editor with modified data
            this.setValue(JSON.stringify(simulationData, null, 2));
            this.handleContentChange();
            
            console.log("EDITOR: Task updated successfully");
            
        } catch (error) {
            console.error("EDITOR: Failed to update task", error);
            this.showNotification("Failed to update task", "error");
        }
    }
    
    /**
     * Update task duration in JSON
     */
    updateTaskDurationInJSON(taskId, newDuration) {
        console.log("EDITOR: Updating task duration", { taskId, newDuration });
        
        try {
            const simulationData = this.getCurrentJSON();
            if (!simulationData || !simulationData.simulation || !simulationData.simulation.tasks) {
                return;
            }
            
            const task = simulationData.simulation.tasks.find(t => t.id === taskId);
            if (!task) {
                console.error("EDITOR: Task not found for duration update", taskId);
                return;
            }
            
            task.duration = newDuration;
            
            this.setValue(JSON.stringify(simulationData, null, 2));
            this.handleContentChange();
            
            console.log("EDITOR: Task duration updated successfully");
            
        } catch (error) {
            console.error("EDITOR: Failed to update task duration", error);
        }
    }
    
    /**
     * Scroll to a specific task in the JSON editor
     */
    scrollToTaskInJSON(taskId) {
        console.log("EDITOR: Scrolling to task", taskId);
        
        try {
            const model = this.editor.getModel();
            const value = model.getValue();
            
            // Find the task in the JSON text
            const taskPattern = new RegExp(`"id":\\s*"${taskId}"`, 'g');
            const match = taskPattern.exec(value);
            
            if (match) {
                const position = model.getPositionAt(match.index);
                this.editor.setPosition(position);
                this.editor.revealPositionInCenter(position);
                
                // Highlight the line briefly
                const decoration = this.editor.deltaDecorations([], [{
                    range: new monaco.Range(position.lineNumber, 1, position.lineNumber, 1),
                    options: {
                        isWholeLine: true,
                        className: 'json-highlight'
                    }
                }]);
                
                // Remove highlight after 2 seconds
                setTimeout(() => {
                    this.editor.deltaDecorations(decoration, []);
                }, 2000);
                
                console.log("EDITOR: Scrolled to task successfully");
            } else {
                console.warn("EDITOR: Task not found in JSON", taskId);
            }
            
        } catch (error) {
            console.error("EDITOR: Failed to scroll to task", error);
        }
    }
    
    /**
     * Add a new task to the simulation
     */
    addTask(taskData) {
        console.log("EDITOR: Adding new task", taskData);
        
        try {
            const simulationData = this.getCurrentJSON() || { simulation: { tasks: [] } };
            
            if (!simulationData.simulation) {
                simulationData.simulation = {};
            }
            if (!simulationData.simulation.tasks) {
                simulationData.simulation.tasks = [];
            }
            
            simulationData.simulation.tasks.push(taskData);
            
            this.setValue(JSON.stringify(simulationData, null, 2));
            this.handleContentChange();
            
            this.showNotification("Task added successfully", "success");
            
        } catch (error) {
            console.error("EDITOR: Failed to add task", error);
            this.showNotification("Failed to add task", "error");
        }
    }
    
    /**
     * Add a new actor to the simulation
     */
    addActor(actorData) {
        console.log("EDITOR: Adding new actor", actorData);
        
        try {
            const simulationData = this.getCurrentJSON() || { simulation: { actors: [] } };
            
            if (!simulationData.simulation) {
                simulationData.simulation = {};
            }
            if (!simulationData.simulation.actors) {
                simulationData.simulation.actors = [];
            }
            
            simulationData.simulation.actors.push(actorData);
            
            this.setValue(JSON.stringify(simulationData, null, 2));
            this.handleContentChange();
            
            this.showNotification("Actor added successfully", "success");
            
        } catch (error) {
            console.error("EDITOR: Failed to add actor", error);
            this.showNotification("Failed to add actor", "error");
        }
    }
    
    /**
     * Add a new resource to the simulation
     */
    addResource(resourceData) {
        console.log("EDITOR: Adding new resource", resourceData);
        
        try {
            const simulationData = this.getCurrentJSON() || { simulation: { resources: [] } };
            
            if (!simulationData.simulation) {
                simulationData.simulation = {};
            }
            if (!simulationData.simulation.resources) {
                simulationData.simulation.resources = [];
            }
            
            simulationData.simulation.resources.push(resourceData);
            
            this.setValue(JSON.stringify(simulationData, null, 2));
            this.handleContentChange();
            
            this.showNotification("Resource added successfully", "success");
            
        } catch (error) {
            console.error("EDITOR: Failed to add resource", error);
            this.showNotification("Failed to add resource", "error");
        }
    }
    
    /**
     * Show notification message
     */
    showNotification(message, type = "info") {
        console.log(`EDITOR NOTIFICATION [${type}]: ${message}`);
        
        // Create notification element
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 16px;
            border-radius: 4px;
            color: white;
            font-size: 14px;
            z-index: 10000;
            max-width: 300px;
            box-shadow: 0 4px 8px rgba(0,0,0,0.1);
        `;
        
        // Set background color based on type
        const colors = {
            success: '#28a745',
            error: '#dc3545',
            warning: '#ffc107',
            info: '#17a2b8'
        };
        notification.style.backgroundColor = colors[type] || colors.info;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        // Auto-remove after 3 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 3000);
    }
    
    /**
     * Dispose of the editor
     */
    dispose() {
        if (this.editor) {
            this.editor.dispose();
            this.editor = null;
        }
        
        if (this.changeTimeout) {
            clearTimeout(this.changeTimeout);
            this.changeTimeout = null;
        }
    }
}