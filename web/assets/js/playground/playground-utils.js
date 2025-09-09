// Playground Utils - General helper functions and utilities
// Universal Automation Wiki - Simulation Playground

// Time conversion utilities
function parseTimeToMinutes(timeStr) {
    if (!timeStr) return 0;
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + (minutes || 0);
}

// Display name cleaning
function cleanDisplayName(name) {
    return name
        .split("-")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
}

// Get current simulation data
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

// Find object state modifier at time
function findObjectStateModifierAtTime(objectId, timeInMinutes) {
    if (!currentSimulationData || !currentSimulationData.tasks) {
        return null;
    }
    
    const sortedTasks = [...(currentSimulationData.tasks || [])].sort((a,b) => a.start_minutes - b.start_minutes);
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

// Handle object click for navigation
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

// HTML escaping
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Debounce function
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Generate unique ID with prefix
function generateUniqueId(prefix = 'id') {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

// Format duration in minutes to human readable
function formatDuration(minutes) {
    if (minutes < 60) {
        return `${minutes}min`;
    }
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}min` : `${hours}h`;
}

// Format time string
function formatTime(timeStr) {
    if (!timeStr) return '';
    const [hours, minutes] = timeStr.split(':');
    return `${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}`;
}

// Convert minutes to time string
function minutesToTimeString(totalMinutes) {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

// Deep clone object
function deepClone(obj) {
    if (obj === null || typeof obj !== 'object') return obj;
    if (obj instanceof Date) return new Date(obj.getTime());
    if (obj instanceof Array) return obj.map(item => deepClone(item));
    if (typeof obj === 'object') {
        const copy = {};
        Object.keys(obj).forEach(key => {
            copy[key] = deepClone(obj[key]);
        });
        return copy;
    }
}

// Check if object is empty
function isEmpty(obj) {
    if (obj == null) return true;
    if (Array.isArray(obj)) return obj.length === 0;
    if (typeof obj === 'object') return Object.keys(obj).length === 0;
    return false;
}

// Get element position relative to document
function getElementPosition(element) {
    let xPosition = 0;
    let yPosition = 0;

    while (element) {
        xPosition += (element.offsetLeft - element.scrollLeft + element.clientLeft);
        yPosition += (element.offsetTop - element.scrollTop + element.clientTop);
        element = element.offsetParent;
    }

    return { x: xPosition, y: yPosition };
}

// Check if element is in viewport
function isElementInViewport(element) {
    const rect = element.getBoundingClientRect();
    return (
        rect.top >= 0 &&
        rect.left >= 0 &&
        rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
        rect.right <= (window.innerWidth || document.documentElement.clientWidth)
    );
}

// Smooth scroll to element
function smoothScrollToElement(element, offset = 0) {
    if (!element) return;
    
    const elementPosition = element.getBoundingClientRect().top + window.pageYOffset;
    const offsetPosition = elementPosition - offset;

    window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
    });
}

// Get current timeline context for adding objects/tasks
function getCurrentTimelineContext() {
    try {
        const simulation = JSON.parse(editor.getValue());
        const sim = simulation.simulation;
        
        // Extract locations for dropdown
        const locations = (sim.layout?.locations || []).map(loc => ({
            id: loc.id,
            name: loc.name || loc.id
        }));
        
        // Extract existing objects by type for reference
        const objects = sim.objects || [];
        const objectsByType = {};
        objects.forEach(obj => {
            if (!objectsByType[obj.type]) {
                objectsByType[obj.type] = [];
            }
            objectsByType[obj.type].push(obj);
        });
        
        // Get digital locations
        const digitalLocations = simulation.digital_space?.digital_locations || [];
        
        // Get digital objects
        const digitalObjects = simulation.digital_space?.digital_objects || [];
        
        // Get displays
        const displays = simulation.displays || [];
        
        // Get display elements from all displays
        const displayElements = [];
        displays.forEach(display => {
            if (display.rectangles) {
                display.rectangles.forEach(element => {
                    displayElements.push({
                        ...element,
                        display_id: display.id,
                        display_name: display.name
                    });
                });
            }
        });
        
        // Get time range info
        const config = sim.config || {};
        const startTime = config.start_time || "06:00";
        const endTime = config.end_time || "18:00";
        
        return {
            locations,
            objectsByType,
            digitalLocations,
            digitalObjects,
            displays,
            displayElements,
            startTime,
            endTime,
            timeUnit: config.time_unit || "minute"
        };
    } catch (e) {
        console.warn('Could not get timeline context:', e);
        return {
            locations: [],
            objectsByType: {},
            digitalLocations: [],
            digitalObjects: [],
            displays: [],
            displayElements: [],
            startTime: "06:00",
            endTime: "18:00",
            timeUnit: "minute"
        };
    }
}

// Validate object deletion
function validateObjectDeletion(simulation, objectIdToDelete, taskStartTime) {
    const objectsArray = simulation.simulation.objects;
    const tasksArray = simulation.simulation.tasks || [];
    
    // Find the object
    const objectIndex = objectsArray.findIndex(obj => obj.id === objectIdToDelete);
    if (objectIndex === -1) {
        return { valid: false, reason: "Object not found" };
    }
    
    const object = objectsArray[objectIndex];
    const taskStartMinutes = parseTimeToMinutes(taskStartTime);
    
    // Check if object is referenced in tasks that start before the new task
    const referencingTasks = tasksArray.filter(task => {
        if (!task) return false;
        const taskTime = parseTimeToMinutes(task.start || "00:00");
        
        // Only check tasks that start before our new task
        if (taskTime >= taskStartMinutes) return false;
        
        // Check if task references this object
        if (task.actor_id === objectIdToDelete) return true;
        if (task.location === objectIdToDelete) return true;
        if ((task.interactions || []).some(i => i.object_id === objectIdToDelete)) return true;
        if ((task.equipment_interactions || []).some(i => i.id === objectIdToDelete)) return true;
        
        return false;
    });
    
    if (referencingTasks.length > 0) {
        const taskNames = referencingTasks.map(t => t.id || 'unnamed').join(', ');
        return { 
            valid: false, 
            reason: `Object "${object.name}" is referenced by earlier tasks: ${taskNames}` 
        };
    }
    
    return { valid: true };
}

// Get next available ID for object type
function getNextAvailableId(objectType, existingObjects) {
    let counter = 1;
    let candidateId = `${objectType}_${counter}`;
    
    while (existingObjects.some(obj => obj.id === candidateId)) {
        counter++;
        candidateId = `${objectType}_${counter}`;
    }
    
    return candidateId;
}

// Export utility functions to global scope if needed
if (typeof window !== 'undefined') {
    window.playgroundUtils = {
        parseTimeToMinutes,
        cleanDisplayName,
        getCurrentSimulationData,
        findObjectStateModifierAtTime,
        handleObjectClick,
        escapeHtml,
        debounce,
        generateUniqueId,
        formatDuration,
        formatTime,
        minutesToTimeString,
        deepClone,
        isEmpty,
        getElementPosition,
        isElementInViewport,
        smoothScrollToElement,
        getCurrentTimelineContext,
        validateObjectDeletion,
        getNextAvailableId
    };
}