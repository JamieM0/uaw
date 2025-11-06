// Playground Utils - General helper functions and utilities
// Universal Automation Wiki - Simulation Playground

// Time conversion utilities
function parseTimeToMinutes(timeStr) {
    // Input validation
    if (!timeStr || typeof timeStr !== 'string') {
        return 0;
    }

    // Trim whitespace
    const trimmedTime = timeStr.trim();
    if (!trimmedTime) {
        return 0;
    }

    // Validate format (HH:MM or H:MM)
    const timePattern = /^(\d{1,2}):(\d{2})$/;
    const match = trimmedTime.match(timePattern);

    if (!match) {
        console.warn(`Invalid time format: "${timeStr}". Expected HH:MM format.`);
        return 0;
    }

    const hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);

    // Validate ranges
    if (isNaN(hours) || isNaN(minutes) || hours < 0 || minutes < 0 || minutes >= 60) {
        console.warn(`Invalid time values in "${timeStr}". Hours: ${hours}, Minutes: ${minutes}`);
        return 0;
    }

    return hours * 60 + minutes;
}

// Display name cleaning
function cleanDisplayName(name) {
    // Input validation
    if (!name || typeof name !== 'string') {
        return '';
    }

    const trimmedName = name.trim();
    if (!trimmedName) {
        return '';
    }

    return trimmedName
        .split("-")
        .map((word) => {
            if (!word) return '';
            return word.charAt(0).toUpperCase() + word.slice(1);
        })
        .filter(word => word) // Remove empty strings
        .join(" ");
}

// Get current simulation data
function getCurrentSimulationData() {
    try {
        // Check if editor exists
        if (typeof editor === 'undefined' || !editor) {
            console.warn('Editor is not initialized');
            return null;
        }

        // Check if getValue method exists
        if (typeof editor.getValue !== 'function') {
            console.warn('Editor does not have getValue method');
            return null;
        }

        const jsonText = editor.getValue();

        // Validate jsonText
        if (!jsonText || typeof jsonText !== 'string') {
            return null;
        }

        const trimmedText = jsonText.trim();
        if (!trimmedText) {
            return null;
        }

        return JSON.parse(trimmedText);
    } catch (e) {
        console.warn('Failed to parse simulation JSON:', e.message);
        // Update UI to show parse error if possible
        if (typeof updateJsonStatus === 'function') {
            updateJsonStatus(false, e.message);
        }
        return null;
    }
}

// Find object state modifier at time
function findObjectStateModifierAtTime(objectId, timeInMinutes) {
    // Input validation
    if (!objectId || typeof objectId !== 'string') {
        console.warn('Invalid objectId provided to findObjectStateModifierAtTime');
        return null;
    }

    if (typeof timeInMinutes !== 'number' || isNaN(timeInMinutes) || timeInMinutes < 0) {
        console.warn('Invalid timeInMinutes provided to findObjectStateModifierAtTime');
        return null;
    }

    if (!currentSimulationData || !currentSimulationData.tasks) {
        return null;
    }

    // Validate tasks is an array
    if (!Array.isArray(currentSimulationData.tasks)) {
        console.warn('currentSimulationData.tasks is not an array');
        return null;
    }

    const sortedTasks = [...currentSimulationData.tasks].sort((a, b) => {
        const aStart = (a && typeof a.start_minutes === 'number') ? a.start_minutes : 0;
        const bStart = (b && typeof b.start_minutes === 'number') ? b.start_minutes : 0;
        return aStart - bStart;
    });
    let currentModifier = null;

    for (const task of sortedTasks) {
        // Validate task object
        if (!task || typeof task !== 'object') {
            continue;
        }

        if (typeof task.start_minutes !== 'number' || task.start_minutes > timeInMinutes) {
            break;
        }

        const endMinutes = typeof task.end_minutes === 'number' ? task.end_minutes : task.start_minutes;
        const isTaskActive = timeInMinutes >= task.start_minutes && timeInMinutes < endMinutes;
        const isTaskCompleted = timeInMinutes >= endMinutes;

        // Check equipment_interactions (old style)
        if (Array.isArray(task.equipment_interactions)) {
            task.equipment_interactions.forEach(interaction => {
                if (interaction && interaction.id === objectId) {
                    if (isTaskActive) {
                        currentModifier = task.id;
                    } else if (isTaskCompleted && !interaction.revert_after) {
                        currentModifier = task.id;
                    }
                }
            });
        }

        // Check interactions (new style)
        if (Array.isArray(task.interactions)) {
            task.interactions.forEach(interaction => {
                if (interaction && interaction.object_id === objectId && interaction.state) {
                    if (isTaskActive) {
                        currentModifier = task.id;
                    } else if (isTaskCompleted && !interaction.revert_after) {
                        currentModifier = task.id;
                    }
                }
            });
        }
    }

    return currentModifier;
}

// Handle object click for navigation
function handleObjectClick(objectId, currentTime) {
    // Input validation
    if (!objectId || typeof objectId !== 'string') {
        console.warn('Invalid objectId provided to handleObjectClick');
        return;
    }

    if (typeof currentTime !== 'number' || isNaN(currentTime) || currentTime < 0) {
        console.warn('Invalid currentTime provided to handleObjectClick');
        return;
    }

    // Check if required functions exist
    if (typeof scrollToObjectInJSON !== 'function') {
        console.warn('scrollToObjectInJSON function not available');
        return;
    }

    if (currentTime === 0 || currentTime === currentSimulationData?.start_time_minutes) {
        // At time=0, go to object definition
        scrollToObjectInJSON(objectId);
    } else {
        // Find what's currently modifying this object
        const modifyingTaskId = findObjectStateModifierAtTime(objectId, currentTime);
        if (modifyingTaskId) {
            if (typeof scrollToTaskInJSON === 'function') {
                scrollToTaskInJSON(modifyingTaskId);
            } else {
                console.warn('scrollToTaskInJSON function not available');
                scrollToObjectInJSON(objectId);
            }
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
    // Input validation
    if (text === null || text === undefined) {
        return '';
    }

    // Convert to string if not already
    const textStr = String(text);

    const div = document.createElement('div');
    div.textContent = textStr;
    return div.innerHTML;
}

// Debounce function
function debounce(func, wait) {
    // Input validation
    if (typeof func !== 'function') {
        throw new TypeError('First argument must be a function');
    }

    const waitTime = typeof wait === 'number' && wait >= 0 ? wait : 300;

    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func.apply(this, args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, waitTime);
    };
}

// Generate unique ID with prefix
function generateUniqueId(prefix = 'id') {
    // Input validation and sanitization
    let safePrefix = 'id';
    if (prefix && typeof prefix === 'string') {
        // Remove invalid characters for IDs (allow alphanumeric, underscore, hyphen)
        safePrefix = prefix.replace(/[^a-zA-Z0-9_-]/g, '') || 'id';
    }

    return `${safePrefix}_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

// Format duration in minutes to human readable
function formatDuration(minutes) {
    // Input validation
    if (typeof minutes !== 'number' || isNaN(minutes)) {
        return '0min';
    }

    // Handle negative values
    const absMinutes = Math.abs(minutes);
    const roundedMinutes = Math.round(absMinutes);

    if (roundedMinutes < 60) {
        return `${roundedMinutes}min`;
    }

    const hours = Math.floor(roundedMinutes / 60);
    const mins = roundedMinutes % 60;
    return mins > 0 ? `${hours}h ${mins}min` : `${hours}h`;
}

// Format time string
function formatTime(timeStr) {
    // Input validation
    if (!timeStr || typeof timeStr !== 'string') {
        return '';
    }

    const trimmedTime = timeStr.trim();
    if (!trimmedTime) {
        return '';
    }

    // Split and validate
    const parts = trimmedTime.split(':');
    if (parts.length !== 2) {
        console.warn(`Invalid time format: "${timeStr}". Expected HH:MM format.`);
        return '';
    }

    const [hours, minutes] = parts;

    // Validate hours and minutes exist and are not empty
    if (!hours || !minutes) {
        console.warn(`Invalid time format: "${timeStr}". Missing hours or minutes.`);
        return '';
    }

    // Ensure they can be padded (are strings or convertible to strings)
    const hoursStr = String(hours).trim();
    const minutesStr = String(minutes).trim();

    if (!hoursStr || !minutesStr) {
        console.warn(`Invalid time format: "${timeStr}". Empty hours or minutes after trimming.`);
        return '';
    }

    return `${hoursStr.padStart(2, '0')}:${minutesStr.padStart(2, '0')}`;
}

// Convert minutes to time string
function minutesToTimeString(totalMinutes) {
    // Input validation
    if (typeof totalMinutes !== 'number' || isNaN(totalMinutes)) {
        console.warn('Invalid totalMinutes provided to minutesToTimeString');
        return '00:00';
    }

    // Handle negative values
    const absTotalMinutes = Math.abs(totalMinutes);
    const roundedMinutes = Math.round(absTotalMinutes);

    const hours = Math.floor(roundedMinutes / 60);
    const minutes = roundedMinutes % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

// Deep clone object
function deepClone(obj) {
    // Handle null and primitives
    if (obj === null || typeof obj !== 'object') {
        return obj;
    }

    // Handle Date objects
    if (obj instanceof Date) {
        return new Date(obj.getTime());
    }

    // Handle RegExp objects
    if (obj instanceof RegExp) {
        return new RegExp(obj.source, obj.flags);
    }

    // Handle Arrays
    if (Array.isArray(obj)) {
        return obj.map(item => deepClone(item));
    }

    // Handle plain objects
    if (Object.prototype.toString.call(obj) === '[object Object]') {
        const copy = {};
        Object.keys(obj).forEach(key => {
            copy[key] = deepClone(obj[key]);
        });
        return copy;
    }

    // For other object types (Map, Set, etc.), return as-is or throw
    // This prevents issues with DOM nodes, functions, etc.
    console.warn('Attempting to clone unsupported object type:', obj.constructor.name);
    return obj;
}

// Check if object is empty
function isEmpty(obj) {
    // Null or undefined
    if (obj == null) {
        return true;
    }

    // String
    if (typeof obj === 'string') {
        return obj.trim().length === 0;
    }

    // Array
    if (Array.isArray(obj)) {
        return obj.length === 0;
    }

    // Object
    if (typeof obj === 'object') {
        return Object.keys(obj).length === 0;
    }

    // Other types (numbers, booleans, etc.) are not considered "empty"
    return false;
}

// Get element position relative to document
function getElementPosition(element) {
    // Input validation
    if (!element || !(element instanceof Element)) {
        console.warn('Invalid element provided to getElementPosition');
        return { x: 0, y: 0 };
    }

    let xPosition = 0;
    let yPosition = 0;
    let currentElement = element;

    while (currentElement) {
        xPosition += (currentElement.offsetLeft - currentElement.scrollLeft + currentElement.clientLeft);
        yPosition += (currentElement.offsetTop - currentElement.scrollTop + currentElement.clientTop);
        currentElement = currentElement.offsetParent;
    }

    return { x: xPosition, y: yPosition };
}

// Check if element is in viewport
function isElementInViewport(element) {
    // Input validation
    if (!element || !(element instanceof Element)) {
        console.warn('Invalid element provided to isElementInViewport');
        return false;
    }

    try {
        const rect = element.getBoundingClientRect();
        return (
            rect.top >= 0 &&
            rect.left >= 0 &&
            rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
            rect.right <= (window.innerWidth || document.documentElement.clientWidth)
        );
    } catch (e) {
        console.warn('Error checking element viewport status:', e);
        return false;
    }
}

// Smooth scroll to element
function smoothScrollToElement(element, offset = 0) {
    // Input validation
    if (!element || !(element instanceof Element)) {
        console.warn('Invalid element provided to smoothScrollToElement');
        return;
    }

    const validOffset = typeof offset === 'number' && !isNaN(offset) ? offset : 0;

    try {
        const elementPosition = element.getBoundingClientRect().top + window.pageYOffset;
        const offsetPosition = elementPosition - validOffset;

        window.scrollTo({
            top: Math.max(0, offsetPosition), // Ensure non-negative scroll position
            behavior: 'smooth'
        });
    } catch (e) {
        console.warn('Error scrolling to element:', e);
    }
}

// Get current timeline context for adding objects/tasks
function getCurrentTimelineContext() {
    try {
        // Use the effective editor (day type wrapper if active, otherwise Monaco editor)
        const effectiveEditor = window.activeDayTypeEditor || editor;

        // Validate editor exists and has getValue method
        if (!effectiveEditor || typeof effectiveEditor.getValue !== 'function') {
            throw new Error('Editor not available or does not have getValue method');
        }

        // When in multi-period day view, editor.getValue() returns just the day type definition
        // wrapped in { simulation: {...} }. Otherwise it returns the full simulation.
        const editorValue = effectiveEditor.getValue();
        if (!editorValue || typeof editorValue !== 'string') {
            throw new Error('Editor value is invalid');
        }

        const simulation = JSON.parse(editorValue);
        const sim = simulation.simulation || simulation;

        // Validate sim is an object
        if (!sim || typeof sim !== 'object') {
            throw new Error('Simulation data is not an object');
        }

        // Extract locations for dropdown (from current context only)
        const locations = Array.isArray(sim.layout?.locations)
            ? sim.layout.locations.map(loc => ({
                id: loc?.id || '',
                name: loc?.name || loc?.id || ''
            })).filter(loc => loc.id) // Remove invalid entries
            : [];

        // Extract existing objects by type for reference (from current context only)
        const objects = Array.isArray(sim.objects) ? sim.objects : [];
        const objectsByType = {};
        objects.forEach(obj => {
            if (obj && typeof obj === 'object' && obj.type) {
                if (!objectsByType[obj.type]) {
                    objectsByType[obj.type] = [];
                }
                objectsByType[obj.type].push(obj);
            }
        });

        // Get digital locations (from current context only)
        // Support both new (nested) and old (root-level) formats for backward compatibility
        const digitalSpace = sim.digital_space || simulation.digital_space;
        const digitalLocations = Array.isArray(digitalSpace?.digital_locations)
            ? digitalSpace.digital_locations
            : [];

        // Get digital objects (from current context only)
        const digitalObjects = Array.isArray(digitalSpace?.digital_objects)
            ? digitalSpace.digital_objects
            : [];

        // Get displays (from current context only)
        // Support both new (nested) and old (root-level) formats for backward compatibility
        const displays = Array.isArray(sim.displays)
            ? sim.displays
            : (Array.isArray(simulation.displays) ? simulation.displays : []);

        // Get display elements from all displays (from current context only)
        const displayElements = [];
        if (Array.isArray(displays)) {
            displays.forEach(display => {
                if (display && Array.isArray(display.rectangles)) {
                    display.rectangles.forEach(element => {
                        if (element && typeof element === 'object') {
                            displayElements.push({
                                ...element,
                                display_id: display.id,
                                display_name: display.name
                            });
                        }
                    });
                }
            });
        }

        // Get time range info
        const config = sim.config || {};
        const startTime = (typeof config.start_time === 'string' && config.start_time) ? config.start_time : "06:00";
        const endTime = (typeof config.end_time === 'string' && config.end_time) ? config.end_time : "18:00";

        return {
            locations,
            objectsByType,
            digitalLocations,
            digitalObjects,
            displays,
            displayElements,
            startTime,
            endTime,
            timeUnit: (typeof config.time_unit === 'string' && config.time_unit) ? config.time_unit : "minute"
        };
    } catch (e) {
        console.warn('Could not get timeline context:', e.message || e);
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
    // Input validation
    if (!simulation || typeof simulation !== 'object') {
        return { valid: false, reason: "Invalid simulation data" };
    }

    if (!objectIdToDelete || typeof objectIdToDelete !== 'string') {
        return { valid: false, reason: "Invalid object ID" };
    }

    if (!taskStartTime || typeof taskStartTime !== 'string') {
        return { valid: false, reason: "Invalid task start time" };
    }

    // Validate simulation structure
    const sim = simulation.simulation || simulation;
    if (!sim || typeof sim !== 'object') {
        return { valid: false, reason: "Invalid simulation structure" };
    }

    const objectsArray = Array.isArray(sim.objects) ? sim.objects : [];
    const tasksArray = Array.isArray(sim.tasks) ? sim.tasks : [];

    // Find the object
    const objectIndex = objectsArray.findIndex(obj => obj && obj.id === objectIdToDelete);
    if (objectIndex === -1) {
        return { valid: false, reason: "Object not found" };
    }

    const object = objectsArray[objectIndex];
    const taskStartMinutes = parseTimeToMinutes(taskStartTime);

    // Check if object is referenced in tasks that start before the new task
    const referencingTasks = tasksArray.filter(task => {
        if (!task || typeof task !== 'object') return false;

        const taskTime = parseTimeToMinutes(task.start || "00:00");

        // Only check tasks that start before our new task
        if (taskTime >= taskStartMinutes) return false;

        // Check if task references this object
        if (task.actor_id === objectIdToDelete) return true;
        if (task.location === objectIdToDelete) return true;

        // Check interactions array
        if (Array.isArray(task.interactions)) {
            if (task.interactions.some(i => i && i.object_id === objectIdToDelete)) {
                return true;
            }
        }

        // Check equipment_interactions array
        if (Array.isArray(task.equipment_interactions)) {
            if (task.equipment_interactions.some(i => i && i.id === objectIdToDelete)) {
                return true;
            }
        }

        return false;
    });

    if (referencingTasks.length > 0) {
        const taskNames = referencingTasks
            .map(t => (t && t.id) ? t.id : 'unnamed')
            .join(', ');
        const objectName = (object && object.name) ? object.name : objectIdToDelete;
        return {
            valid: false,
            reason: `Object "${objectName}" is referenced by earlier tasks: ${taskNames}`
        };
    }

    return { valid: true };
}

// Get next available ID for object type
function getNextAvailableId(objectType, existingObjects) {
    // Input validation
    if (!objectType || typeof objectType !== 'string') {
        console.warn('Invalid objectType provided to getNextAvailableId');
        return 'object_1';
    }

    if (!Array.isArray(existingObjects)) {
        console.warn('Invalid existingObjects array provided to getNextAvailableId');
        existingObjects = [];
    }

    // Sanitize object type (remove invalid characters)
    const safeObjectType = objectType.replace(/[^a-zA-Z0-9_-]/g, '') || 'object';

    let counter = 1;
    let candidateId = `${safeObjectType}_${counter}`;

    // Safety limit to prevent infinite loops
    const maxIterations = 10000;
    let iterations = 0;

    while (existingObjects.some(obj => obj && obj.id === candidateId) && iterations < maxIterations) {
        counter++;
        candidateId = `${safeObjectType}_${counter}`;
        iterations++;
    }

    if (iterations >= maxIterations) {
        console.warn('Reached maximum iterations in getNextAvailableId');
        // Fallback to timestamp-based ID
        return `${safeObjectType}_${Date.now()}`;
    }

    return candidateId;
}

// Non-blocking progress indicator - doesn't prevent user interaction
function showProgressIndicator(message = 'Processing...') {
    try {
        // Validate and sanitize message
        const safeMessage = (message && typeof message === 'string')
            ? message.trim()
            : 'Processing...';

        // Create or update existing indicator
        let indicator = document.getElementById('uaw-progress-indicator');

        if (!indicator) {
            indicator = document.createElement('div');
            indicator.id = 'uaw-progress-indicator';
            indicator.style.cssText = `
                position: fixed;
                bottom: 20px;
                right: 20px;
                background: var(--primary-color, #4a90e2);
                color: white;
                padding: 12px 20px;
                border-radius: 8px;
                font-size: 14px;
                font-weight: 500;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                z-index: 9999;
                display: flex;
                align-items: center;
                gap: 10px;
                pointer-events: none;
                opacity: 0;
                transition: opacity 0.2s ease-in-out;
            `;

            // Add spinner
            const spinner = document.createElement('div');
            spinner.className = 'progress-spinner';
            spinner.style.cssText = `
                width: 16px;
                height: 16px;
                border: 2px solid rgba(255, 255, 255, 0.3);
                border-top-color: white;
                border-radius: 50%;
                animation: spin 0.8s linear infinite;
            `;
            indicator.appendChild(spinner);

            // Add message span
            const messageSpan = document.createElement('span');
            messageSpan.className = 'progress-message';
            indicator.appendChild(messageSpan);

            // Add CSS animation if not already present
            if (!document.getElementById('uaw-progress-styles')) {
                const style = document.createElement('style');
                style.id = 'uaw-progress-styles';
                style.textContent = `
                    @keyframes spin {
                        to { transform: rotate(360deg); }
                    }
                `;
                document.head.appendChild(style);
            }

            // Ensure document.body exists
            if (!document.body) {
                console.warn('document.body not available for progress indicator');
                return;
            }

            document.body.appendChild(indicator);

            // Trigger reflow to enable transition
            void indicator.offsetHeight;
        }

        // Update message
        const messageSpan = indicator.querySelector('.progress-message');
        if (messageSpan) {
            messageSpan.textContent = safeMessage;
        }

        // Show indicator
        indicator.style.opacity = '1';
    } catch (e) {
        console.warn('Error showing progress indicator:', e);
    }
}

function hideProgressIndicator() {
    try {
        const indicator = document.getElementById('uaw-progress-indicator');
        if (indicator) {
            indicator.style.opacity = '0';

            // Remove after transition completes
            setTimeout(() => {
                try {
                    if (indicator && indicator.parentNode) {
                        indicator.parentNode.removeChild(indicator);
                    }
                } catch (e) {
                    console.warn('Error removing progress indicator:', e);
                }
            }, 200);
        }
    } catch (e) {
        console.warn('Error hiding progress indicator:', e);
    }
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
        getNextAvailableId,
        showProgressIndicator,
        hideProgressIndicator
    };
}