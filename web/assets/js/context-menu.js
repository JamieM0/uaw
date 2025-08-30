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
            console.log('=== RIGHT CLICK DEBUG ===');
            console.log('Event target:', e.target);
            console.log('Event target classes:', e.target.className);
            console.log('Event target parent:', e.target.parentElement);
            
            // Check if right-click is on a task element in simulation render
            const taskElement = e.target.closest('.task-block');
            console.log('Task element found:', taskElement);
            
            if (taskElement) {
                console.log('Task element dataset:', taskElement.dataset);
                console.log('Task element closest simulation-content:', taskElement.closest('#simulation-content'));
            }
            
            if (taskElement && taskElement.closest('#simulation-content')) {
                console.log('SHOWING TASK CONTEXT MENU');
                e.preventDefault();
                this.showContextMenu(e, taskElement, 'task');
                return;
            }

            // Check if right-click is on a location rectangle in space editor
            const rectElement = e.target.closest('.location-rect');
            console.log('Rect element found:', rectElement);
            
            if (rectElement) {
                console.log('Rect element dataset:', rectElement.dataset);
                console.log('Rect element closest space-canvas:', rectElement.closest('#space-canvas'));
            }
            
            if (rectElement && rectElement.closest('#space-canvas')) {
                console.log('SHOWING LOCATION CONTEXT MENU');
                e.preventDefault();
                this.showContextMenu(e, rectElement, 'location');
                return;
            }

            console.log('No context menu target found');
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
        console.log('=== DELETE DEBUG ===');
        console.log('Current target:', this.currentTarget);
        console.log('Current target type:', this.currentTargetType);
        
        if (!this.currentTarget || !this.currentTargetType) {
            console.log('ERROR: No current target or target type');
            return;
        }

        if (this.currentTargetType === 'task') {
            console.log('Deleting task...');
            this.deleteTask();
        } else if (this.currentTargetType === 'location') {
            console.log('Deleting location...');
            this.deleteLocation();
        }
    }

    deleteTask() {
        console.log('=== DELETE TASK DEBUG ===');
        const taskElement = this.currentTarget;
        console.log('Task element:', taskElement);
        console.log('Task element dataset:', taskElement.dataset);
        const taskId = taskElement.dataset.taskId;
        console.log('Task ID:', taskId);

        if (!taskId) {
            console.error('ERROR: No task ID found for deletion');
            return;
        }

        try {
            console.log('Getting editor value...');
            // Get current simulation data from Monaco editor
            const currentJson = JSON.parse(editor.getValue());
            console.log('Current JSON structure:', currentJson);
            console.log('Tasks available:', currentJson.simulation?.tasks);
            
            // Find and remove the task from the simulation data
            if (currentJson.simulation && currentJson.simulation.tasks) {
                const taskIndex = currentJson.simulation.tasks.findIndex(task => task.id === taskId);
                console.log('Task index found:', taskIndex);
                
                if (taskIndex !== -1) {
                    console.log('Removing task at index:', taskIndex);
                    currentJson.simulation.tasks.splice(taskIndex, 1);
                    
                    // Update the Monaco editor with the new JSON
                    console.log('Updating editor...');
                    editor.setValue(JSON.stringify(currentJson, null, 2));
                    
                    // Trigger re-validation and re-rendering
                    console.log('Validating and re-rendering...');
                    validateJSON();
                    renderSimulation();
                    
                    console.log(`SUCCESS: Task ${taskId} deleted successfully`);
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
        console.log('=== DELETE LOCATION DEBUG ===');
        const rectElement = this.currentTarget;
        console.log('Rect element:', rectElement);
        console.log('Rect element dataset:', rectElement.dataset);
        const locationId = rectElement.dataset.id;
        console.log('Location ID:', locationId);

        if (!locationId) {
            console.error('ERROR: No location ID found for deletion');
            return;
        }

        try {
            console.log('Checking spaceEditor:', typeof spaceEditor);
            console.log('SpaceEditor object:', spaceEditor);
            // Use the space editor's method to delete the location
            if (typeof spaceEditor !== 'undefined' && spaceEditor) {
                console.log('SpaceEditor locations:', spaceEditor.locations);
                // Find the location in the space editor's locations array
                const locationIndex = spaceEditor.locations.findIndex(loc => loc.id === locationId);
                console.log('Location index found:', locationIndex);
                
                if (locationIndex !== -1) {
                    console.log('Removing from spaceEditor locations...');
                    // Remove from locations array
                    spaceEditor.locations.splice(locationIndex, 1);
                    
                    console.log('Removing visual element...');
                    // Remove the visual element
                    rectElement.remove();
                    
                    console.log('Getting editor JSON...');
                    // Update the JSON in Monaco editor
                    const currentJson = JSON.parse(editor.getValue());
                    console.log('Current JSON structure:', currentJson);
                    console.log('Layout locations:', currentJson.simulation?.layout?.locations);
                    
                    if (currentJson.simulation && currentJson.simulation.layout && currentJson.simulation.layout.locations) {
                        const layoutLocationIndex = currentJson.simulation.layout.locations.findIndex(loc => loc.id === locationId);
                        console.log('Layout location index:', layoutLocationIndex);
                        
                        if (layoutLocationIndex !== -1) {
                            console.log('Removing from layout locations...');
                            currentJson.simulation.layout.locations.splice(layoutLocationIndex, 1);
                            console.log('Updating editor...');
                            editor.setValue(JSON.stringify(currentJson, null, 2));
                        }
                    }
                    
                    console.log('Updating spaceEditor UI...');
                    // Update space editor UI
                    spaceEditor.updateLayerDropdown();
                    spaceEditor.deselectAll();
                    
                    console.log('Validating...');
                    // Trigger validation
                    validateJSON();
                    
                    console.log(`SUCCESS: Location ${locationId} deleted successfully`);
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
    console.log('=== CONTEXT MENU INITIALIZATION ===');
    console.log('DOM ready, initializing context menu...');
    console.log('Editor available:', typeof editor);
    console.log('SpaceEditor available:', typeof spaceEditor);
    console.log('validateJSON available:', typeof validateJSON);
    console.log('renderSimulation available:', typeof renderSimulation);
    
    window.contextMenuManager = new ContextMenuManager();
    console.log('Context menu manager initialized');
    
    // Debug: Check for existing task elements
    setTimeout(() => {
        const taskElements = document.querySelectorAll('.task-block');
        console.log('Found task elements:', taskElements.length, taskElements);
        
        const simulationContent = document.getElementById('simulation-content');
        console.log('Simulation content element:', simulationContent);
        
        if (simulationContent) {
            console.log('Simulation content children:', simulationContent.children);
        }
    }, 2000);
});