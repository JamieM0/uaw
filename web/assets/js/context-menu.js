// Context Menu for Playground - Universal Automation Wiki

// All context-menu mutations must use the same editor and document shape as the
// rest of the Playground. WorkSpec documents may be either wrapped in
// { simulation: ... } or be the simulation itself, and multi-period editing
// writes through a day-type editor rather than the global Monaco instance.
function getContextMenuEditor() {
    return window.activeDayTypeEditor || window.editor || (typeof editor !== 'undefined' ? editor : null);
}

function getContextMenuDocument(editorToUse) {
    if (!editorToUse || typeof editorToUse.getValue !== 'function') {
        throw new Error('Editor is not available');
    }
    return JSON.parse(stripJsonComments(editorToUse.getValue()));
}

function getContextMenuSimulation(documentData) {
    if (!documentData || typeof documentData !== 'object') return null;
    return documentData.simulation && typeof documentData.simulation === 'object'
        ? documentData.simulation
        : documentData;
}

function getContextMenuTasks(simulation) {
    if (!simulation || typeof simulation !== 'object') return [];
    if (Array.isArray(simulation.process?.tasks)) return simulation.process.tasks;
    if (Array.isArray(simulation.tasks)) return simulation.tasks;
    return [];
}

function saveContextMenuDocument(editorToUse, documentData) {
    if (!editorToUse || typeof editorToUse.setValue !== 'function') {
        throw new Error('Editor cannot save changes');
    }
    editorToUse.setValue(JSON.stringify(documentData, null, 2));
}

class ContextMenuManager {
    constructor() {
        this.contextMenu = document.getElementById('context-menu');
        this.editMenuItem = document.getElementById('context-menu-edit');
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

        // Handle edit menu item click
        this.editMenuItem.addEventListener('click', () => {
            this.handleEdit();
            this.hideContextMenu();
        });

        // Handle delete menu item click
        this.deleteMenuItem.addEventListener('click', () => {
            this.handleDelete();
            this.hideContextMenu();
        });

        this.contextMenu.addEventListener('keydown', (e) => {
            const items = [this.editMenuItem, this.deleteMenuItem];
            const currentIndex = items.indexOf(document.activeElement);

            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                e.preventDefault();
                const direction = e.key === 'ArrowDown' ? 1 : -1;
                const nextIndex = (currentIndex + direction + items.length) % items.length;
                items[nextIndex].focus();
            } else if (e.key === 'Home' || e.key === 'End') {
                e.preventDefault();
                items[e.key === 'Home' ? 0 : items.length - 1].focus();
            } else if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                document.activeElement.click();
            }
        });

        // Add right-click listeners to simulation content and space editor
        this.addSimulationRightClickListeners();
        this.addSpaceEditorRightClickListeners();
    }

    addSimulationRightClickListeners() {
        // Use event delegation for simulation, space editor, digital space, and display editor elements
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

            // Check if right-click is on a digital location rectangle in digital space editor
            const digitalLocationElement = e.target.closest('.digital-location-rect');
            
            if (digitalLocationElement && digitalLocationElement.closest('#digital-space-canvas')) {
                e.preventDefault();
                this.showContextMenu(e, digitalLocationElement, 'digital-location');
                return;
            }

            // Check if right-click is on a display element in display editor
            const displayElement = e.target.closest('.display-element-rect');
            
            if (displayElement && displayElement.closest('#display-canvas')) {
                e.preventDefault();
                this.showContextMenu(e, displayElement, 'display-element');
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
        this.editMenuItem.focus();
    }

    hideContextMenu() {
        this.contextMenu.style.display = 'none';
        this.currentTarget = null;
        this.currentTargetType = null;
    }

    handleEdit() {
        if (!this.currentTarget || !this.currentTargetType) {
            return;
        }

        if (this.currentTargetType === 'task') {
            this.editTask();
        } else if (this.currentTargetType === 'location') {
            this.editLocation();
        } else if (this.currentTargetType === 'digital-location') {
            this.editDigitalLocation();
        } else if (this.currentTargetType === 'display-element') {
            this.editDisplayElement();
        }
    }

    editTask() {
        const taskElement = this.currentTarget;
        const taskId = taskElement.dataset.taskId;

        if (!taskId) {
            console.error('ERROR: No task ID found for editing');
            return;
        }

        try {
            const editorToUse = getContextMenuEditor();
            const currentJson = getContextMenuDocument(editorToUse);
            const simulation = getContextMenuSimulation(currentJson);
            const tasks = getContextMenuTasks(simulation);

            if (Array.isArray(tasks)) {
                const task = tasks.find(t => t.id === taskId);
                if (task) {
                    if (typeof openEditTaskModal === 'function') {
                        openEditTaskModal(task);
                    } else {
                        console.error('ERROR: openEditTaskModal function not found');
                    }
                } else {
                    console.error(`ERROR: Task ${taskId} not found in simulation data`);
                }
            } else {
                console.error('ERROR: No simulation.process.tasks (or legacy simulation.tasks) found in JSON');
            }
        } catch (error) {
            console.error('ERROR editing task:', error);
        }
    }

    async editLocation() {
        const rectElement = this.currentTarget;
        const locationId = rectElement.dataset.id;

        if (!locationId) {
            console.error('ERROR: No location ID found for editing');
            return;
        }

        try {
            const tabButton = document.querySelector('[data-tab="space-editor"]');
            if (tabButton) {
                tabButton.click();
                await new Promise(resolve => setTimeout(resolve, 100));
            }

            if (typeof spaceEditor !== 'undefined' && spaceEditor) {
                spaceEditor.selectRect(locationId);
            } else {
                console.error('ERROR: spaceEditor is not available');
            }
        } catch (error) {
            console.error('ERROR editing location:', error);
        }
    }

    async editDigitalLocation() {
        const rectElement = this.currentTarget;
        const locationId = rectElement.dataset.locationId;

        if (!locationId) {
            console.error('ERROR: No digital location ID found for editing');
            return;
        }

        try {
            const tabButton = document.querySelector('[data-tab="digital-space"]');
            if (tabButton) {
                tabButton.click();
                await new Promise(resolve => setTimeout(resolve, 100));
            }

            if (typeof digitalSpaceEditor !== 'undefined' && digitalSpaceEditor) {
                digitalSpaceEditor.selectLocation(locationId);
            } else {
                console.error('ERROR: digitalSpaceEditor is not available');
            }
        } catch (error) {
            console.error('ERROR editing digital location:', error);
        }
    }

    async editDisplayElement() {
        const rectElement = this.currentTarget;
        const elementId = rectElement.dataset.elementId;

        if (!elementId) {
            console.error('ERROR: No display element ID found for editing');
            return;
        }

        try {
            const tabButton = document.querySelector('[data-tab="display-editor"]');
            if (tabButton) {
                tabButton.click();
                await new Promise(resolve => setTimeout(resolve, 100));
            }

            if (typeof displayEditor !== 'undefined' && displayEditor) {
                displayEditor.selectElement(elementId);
            } else {
                console.error('ERROR: displayEditor is not available');
            }
        } catch (error) {
            console.error('ERROR editing display element:', error);
        }
    }

    handleDelete() {
        if (!this.currentTarget || !this.currentTargetType) {
            return;
        }

        if (this.currentTargetType === 'task') {
            this.deleteTask();
        } else if (this.currentTargetType === 'location') {
            this.deleteLocation();
        } else if (this.currentTargetType === 'digital-location') {
            this.deleteDigitalLocation();
        } else if (this.currentTargetType === 'display-element') {
            this.deleteDisplayElement();
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
            const editorToUse = getContextMenuEditor();
            const currentJson = getContextMenuDocument(editorToUse);
            const simulation = getContextMenuSimulation(currentJson);
            const tasks = getContextMenuTasks(simulation);

            if (Array.isArray(tasks)) {
                const taskIndex = tasks.findIndex(task => task.id === taskId);
                
                if (taskIndex !== -1) {
                    tasks.splice(taskIndex, 1);
                    
                    saveContextMenuDocument(editorToUse, currentJson);
                    
                    // Trigger re-validation and re-rendering
                    validateJSON();
                    renderSimulation();
                } else {
                    console.error(`ERROR: Task ${taskId} not found in simulation data`);
                }
            } else {
                console.error('ERROR: No simulation.process.tasks (or legacy simulation.tasks) found in JSON');
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
                    const editorToUse = getContextMenuEditor();
                    const currentJson = getContextMenuDocument(editorToUse);
                    const simulation = getContextMenuSimulation(currentJson);
                    const layout = simulation?.world?.layout || simulation?.layout;
                    const locations = layout?.locations;

                    if (simulation && Array.isArray(locations)) {
                        const layoutLocationIndex = locations.findIndex(loc => loc.id === locationId);
                        
                        if (layoutLocationIndex !== -1) {
                            locations.splice(layoutLocationIndex, 1);
                            saveContextMenuDocument(editorToUse, currentJson);
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

    deleteDigitalLocation() {
        const rectElement = this.currentTarget;
        const locationId = rectElement.dataset.locationId;

        if (!locationId) {
            console.error('ERROR: No digital location ID found for deletion');
            return;
        }

        try {
            // Use the digital space editor's delete method to properly handle deletion
            if (typeof digitalSpaceEditor !== 'undefined' && digitalSpaceEditor && typeof digitalSpaceEditor.deleteLocation === 'function') {
                digitalSpaceEditor.deleteLocation(locationId);
                // Trigger validation after deletion
                validateJSON();
            } else {
                console.error('ERROR: digitalSpaceEditor is not available or deleteLocation method not found');
            }
        } catch (error) {
            console.error('ERROR deleting digital location:', error);
        }
    }

    deleteDisplayElement() {
        const rectElement = this.currentTarget;
        const elementId = rectElement.dataset.elementId;

        if (!elementId) {
            console.error('ERROR: No display element ID found for deletion');
            return;
        }

        try {
            // Use the display editor's method to delete the element
            if (typeof displayEditor !== 'undefined' && displayEditor) {
                // Get the active display using the editor's method
                const activeDisplay = displayEditor.getActiveDisplay();
                
                if (activeDisplay) {
                    const elementIndex = activeDisplay.rectangles.findIndex(element => element.id === elementId);
                    
                    if (elementIndex !== -1) {
                        // Remove from rectangles array
                        activeDisplay.rectangles.splice(elementIndex, 1);
                        
                        // Remove the visual element
                        rectElement.remove();
                        
                        // Update the JSON in Monaco editor
                        const editorToUse = getContextMenuEditor();
                        const currentJson = getContextMenuDocument(editorToUse);
                        const simulation = getContextMenuSimulation(currentJson);
                        const displays = Array.isArray(simulation?.displays)
                            ? simulation.displays
                            : Array.isArray(currentJson.displays)
                                ? currentJson.displays
                                : [];

                        if (Array.isArray(displays)) {
                            const displayIndex = displays.findIndex(disp => disp.id === activeDisplay.id);

                            if (displayIndex !== -1 && displays[displayIndex].rectangles) {
                                const jsonElementIndex = displays[displayIndex].rectangles.findIndex(element => element.id === elementId);

                                if (jsonElementIndex !== -1) {
                                    displays[displayIndex].rectangles.splice(jsonElementIndex, 1);
                                    saveContextMenuDocument(editorToUse, currentJson);
                                }
                            }
                        }
                        
                        // Update display editor UI
                        displayEditor.renderPropertiesPanel();
                        displayEditor.deselectAll();
                        
                        // Trigger validation
                        validateJSON();
                    } else {
                        console.error(`ERROR: Display element ${elementId} not found in active display`);
                    }
                } else {
                    console.error('ERROR: No active display found in display editor');
                }
            } else {
                console.error('ERROR: displayEditor is not available or not initialized yet');
            }
        } catch (error) {
            console.error('ERROR deleting display element:', error);
        }
    }
}

// Initialize context menu when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.contextMenuManager = new ContextMenuManager();
});
