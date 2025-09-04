// Context Menu for Playground - Universal Automation Wiki

class ContextMenuManager {
    constructor() {
        this.contextMenu = document.getElementById('context-menu');
        this.deleteMenuItem = document.getElementById('context-menu-delete');
        this.currentTarget = null;
        this.currentTargetType = null;
        
        this.init();
    }

    init() {
        // Hide context menu when clicking elsewhere
        document.addEventListener('click', (e) => {
            if (!this.contextMenu.contains(e.target)) {
                this.hideContextMenu();
            }
        });

        // Handle ESC key to hide context menu
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.hideContextMenu();
            }
        });

        // Handle delete menu item click
        this.deleteMenuItem.addEventListener('click', () => {
            this.handleDelete();
            this.hideContextMenu();
        });

        // Add right-click listeners to simulation content and space editor
        this.addSimulationRightClickListeners();
        this.addSpaceEditorRightClickListeners();
    }

    addSimulationRightClickListeners() {
        // Use event delegation for both simulation and space editor elements
        document.addEventListener('contextmenu', (e) => {
            // Check if right-click is on a task element in simulation render
            const taskElement = e.target.closest('.task-block');
            
            if (taskElement && taskElement.closest('#simulation-content')) {
                e.preventDefault();
                this.showContextMenu(e, taskElement, 'task');
                return;
            }

            // Check if right-click is on a location rectangle in space editor
            const rectElement = e.target.closest('.location-rect');
            
            if (rectElement && rectElement.closest('#space-canvas')) {
                e.preventDefault();
                this.showContextMenu(e, rectElement, 'location');
                return;
            }
        });
    }

    addSpaceEditorRightClickListeners() {
        // This is handled in the same event listener as simulation render to avoid conflicts
        // The main contextmenu event listener above handles both cases
    }

    showContextMenu(event, targetElement, targetType) {
        this.currentTarget = targetElement;
        this.currentTargetType = targetType;

        // Position the context menu at the mouse location
        const x = event.clientX;
        const y = event.clientY;

        // First show the menu to measure its size
        this.contextMenu.style.display = 'block';
        this.contextMenu.style.visibility = 'hidden';

        // Ensure the menu doesn't go off-screen
        const menuRect = this.contextMenu.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        let adjustedX = x;
        let adjustedY = y;

        // If menu would go off the right edge, position it to the left of the cursor
        if (x + menuRect.width > viewportWidth) {
            adjustedX = x - menuRect.width;
        }

        // If menu would go off the bottom edge, position it above the cursor
        if (y + menuRect.height > viewportHeight) {
            adjustedY = y - menuRect.height;
        }

        this.contextMenu.style.left = adjustedX + 'px';
        this.contextMenu.style.top = adjustedY + 'px';
        this.contextMenu.style.visibility = 'visible';
    }

    hideContextMenu() {
        this.contextMenu.style.display = 'none';
        this.currentTarget = null;
        this.currentTargetType = null;
    }

    handleDelete() {
        if (!this.currentTarget || !this.currentTargetType) {
            return;
        }

        if (this.currentTargetType === 'task') {
            this.deleteTask();
        } else if (this.currentTargetType === 'location') {
            this.deleteLocation();
        }
    }

    deleteTask() {
        const taskElement = this.currentTarget;
        const taskId = taskElement.dataset.taskId;

        if (!taskId) {
            console.error('ERROR: No task ID found for deletion');
            return;
        }

        try {
            // Get current simulation data from Monaco editor
            const currentJson = JSON.parse(editor.getValue());
            
            // Find and remove the task from the simulation data
            if (currentJson.simulation && currentJson.simulation.tasks) {
                const taskIndex = currentJson.simulation.tasks.findIndex(task => task.id === taskId);
                
                if (taskIndex !== -1) {
                    currentJson.simulation.tasks.splice(taskIndex, 1);
                    
                    // Update the Monaco editor with the new JSON
                    editor.setValue(JSON.stringify(currentJson, null, 2));
                    
                    // Trigger re-validation and re-rendering
                    validateJSON();
                    renderSimulation();
                } else {
                    console.error(`ERROR: Task ${taskId} not found in simulation data`);
                }
            } else {
                console.error('ERROR: No simulation.tasks found in JSON');
            }
        } catch (error) {
            console.error('ERROR deleting task:', error);
        }
    }

    deleteLocation() {
        const rectElement = this.currentTarget;
        const locationId = rectElement.dataset.id;

        if (!locationId) {
            console.error('ERROR: No location ID found for deletion');
            return;
        }

        try {
            // Use the space editor's method to delete the location
            if (typeof spaceEditor !== 'undefined' && spaceEditor) {
                // Find the location in the space editor's locations array
                const locationIndex = spaceEditor.locations.findIndex(loc => loc.id === locationId);
                
                if (locationIndex !== -1) {
                    // Remove from locations array
                    spaceEditor.locations.splice(locationIndex, 1);
                    
                    // Remove the visual element
                    rectElement.remove();
                    
                    // Update the JSON in Monaco editor
                    const currentJson = JSON.parse(editor.getValue());
                    
                    if (currentJson.simulation && currentJson.simulation.layout && currentJson.simulation.layout.locations) {
                        const layoutLocationIndex = currentJson.simulation.layout.locations.findIndex(loc => loc.id === locationId);
                        
                        if (layoutLocationIndex !== -1) {
                            currentJson.simulation.layout.locations.splice(layoutLocationIndex, 1);
                            editor.setValue(JSON.stringify(currentJson, null, 2));
                        }
                    }
                    
                    // Update space editor UI
                    spaceEditor.updateLayerDropdown();
                    spaceEditor.deselectAll();
                    
                    // Trigger validation
                    validateJSON();
                } else {
                    console.error(`ERROR: Location ${locationId} not found in space editor`);
                }
            } else {
                console.error('ERROR: spaceEditor is not available or not initialized yet');
            }
        } catch (error) {
            console.error('ERROR deleting location:', error);
        }
    }
}

// Initialize context menu when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.contextMenuManager = new ContextMenuManager();
});