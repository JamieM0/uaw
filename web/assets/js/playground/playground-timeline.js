// Playground Timeline - Timeline rendering and interactions
// Universal Automation Wiki - Simulation Playground

// Constants
const EDGE_DETECTION_THRESHOLD = 8; // pixels for resize edge detection
const THROTTLE_DELAY = 16; // ~60fps for mousemove throttling
const MIN_TASK_DURATION = 1; // minimum task duration in minutes

// Timeline rendering variables
let renderTimeout;
let currentSimulationData = null;

// Multi-period view controller
let multiPeriodViewController = null;

// Drag and drop variables
let isDragging = false;
let draggedTask = null;
let dragStartX = 0;
let dragStartY = 0;
let dragOffsetX = 0; // Offset from left edge of task to cursor
let originalTaskData = null;

// Resize variables
let isResizing = false;
let resizeType = null; // 'left' or 'right'
let resizeHandle = null;
let originalDuration = 0;
let originalStartTime = null;
let durationPreview = null;

// Drag time preview variable
let timePreview = null;

// Event listener cleanup tracking
let eventListeners = [];

// Utility Functions

/**
 * Throttle function to limit execution rate
 * @param {Function} func - Function to throttle
 * @param {number} delay - Delay in milliseconds
 * @returns {Function} Throttled function
 */
function throttle(func, delay) {
    let lastCall = 0;
    return function(...args) {
        const now = Date.now();
        if (now - lastCall >= delay) {
            lastCall = now;
            return func.apply(this, args);
        }
    };
}

/**
 * Format time in minutes to HH:MM string
 * @param {number} minutes - Total minutes
 * @returns {string} Formatted time string
 */
function formatTimeFromMinutes(minutes) {
    const hours = Math.floor(minutes / 60);
    const mins = Math.floor(minutes % 60);
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

/**
 * Clean up drag/resize state
 */
function cleanupDragResizeState() {
    if (isResizing) {
        document.body.classList.remove('resizing-active');
        if (resizeHandle) {
            resizeHandle.classList.remove('resizing');
        }
        if (durationPreview) {
            durationPreview.remove();
            durationPreview = null;
        }
        isResizing = false;
        resizeType = null;
        resizeHandle = null;
    }

    if (isDragging) {
        document.body.classList.remove('dragging-active');
        if (draggedTask) {
            draggedTask.style.opacity = '';
            draggedTask.style.zIndex = '';
            draggedTask.style.transform = '';
            draggedTask.style.overflow = '';
        }
        if (timePreview) {
            timePreview.remove();
            timePreview = null;
        }
        // Clear timeline highlights
        document.querySelectorAll('.task-track').forEach(track => {
            track.classList.remove('drag-target', 'drag-invalid');
        });
        isDragging = false;
        draggedTask = null;
        originalTaskData = null;
    }
}

/**
 * Remove all tracked event listeners and clean up
 */
function cleanupEventListeners() {
    eventListeners.forEach(({ element, event, handler }) => {
        element.removeEventListener(event, handler);
    });
    eventListeners = [];
}

// Process simulation data with timeline calculations
function processSimulationData(simulationData) {
    if (!simulationData) {
        console.error('TIMELINE: simulationData is undefined');
        return { tasks: [], start_time_minutes: 360, end_time_minutes: 1080, total_duration_minutes: 720 };
    }
    
    const sim = simulationData.simulation;
    if (!sim) {
        console.error('TIMELINE: simulationData.simulation is undefined');
        return { tasks: [], start_time_minutes: 360, end_time_minutes: 1080, total_duration_minutes: 720 };
    }
    
    const config = sim.config || {};
    const startTime = config.start_time || "06:00";
    const [startHour, startMin] = startTime.split(":").map(Number);
    const startTimeMinutes = startHour * 60 + startMin;

    let actualLastTaskEnd = startTimeMinutes;
    let actualFirstTaskStart = startTimeMinutes; // Track earliest task start

    const allObjects = sim.objects || [];

    // Include digital locations from the simulation structure
    // Support both new (nested) and old (root-level) formats for backward compatibility
    const digitalSpace = (simulationData.simulation && simulationData.simulation.digital_space) || simulationData.digital_space;
    if (digitalSpace && digitalSpace.digital_locations) {
        allObjects.push(...digitalSpace.digital_locations);
    }
    
    // Group objects by type dynamically (no hardcoded filtering)
    const objectsByType = {};
    allObjects.forEach(obj => {
        if (!obj || !obj.type) return; // Skip invalid objects
        if (!objectsByType[obj.type]) {
            objectsByType[obj.type] = [];
        }
        objectsByType[obj.type].push(obj);
    });

    const tasksWithMinutes = (sim.tasks || []).map(task => {
        if (!task) return null;
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
        actualFirstTaskStart = Math.min(actualFirstTaskStart, taskStartMinutes); // Track earliest start
        return { ...task, start_minutes: taskStartMinutes, end_minutes: taskEndMinutes };
    }).filter(task => task !== null);
    
    // --- START OF THE UNIFIED SCALING FIX ---

    // 1. Determine the actual visual start time (earliest task or config start)
    const visualStartTimeMinutes = actualFirstTaskStart;
    const visualStartHour = Math.floor(visualStartTimeMinutes / 60);
    const visualStartMin = visualStartTimeMinutes % 60;
    const visualStartTimeStr = `${String(visualStartHour).padStart(2, "0")}:${String(visualStartMin).padStart(2, "0")}`;

    // 2. Determine the logical end time, including a small buffer for visuals.
    const logicalEndTime = actualLastTaskEnd + 30;

    // 3. Calculate a visually clean, rounded-up total duration for the timeline.
    // This becomes the single source of truth for all rendering.
    const logicalTotalDuration = logicalEndTime - visualStartTimeMinutes;
    const visualTotalDuration = Math.ceil(logicalTotalDuration / 60) * 60; // Round up to the next full hour.

    // 4. Calculate the end time string based on this visual duration.
    const visualEndTimeMinutes = visualStartTimeMinutes + visualTotalDuration;
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
            // All percentages now use the same, consistent denominator and dynamic start time.
            start_percentage: ((task.start_minutes - visualStartTimeMinutes) / visualTotalDuration) * 100,
            duration_percentage: (task.duration / visualTotalDuration) * 100
        };
    });
    
    const actorWorkloads = {};
    processedTasks.forEach(task => {
        actorWorkloads[task.actor_id] = (actorWorkloads[task.actor_id] || 0) + (task.duration || 0);
    });

    // Calculate utilization for all objects that have tasks
    const objectsWithTasks = [];
    allObjects.forEach(obj => {
        if (!obj) return;
        const workload = actorWorkloads[obj.id] || 0;
        if (workload > 0) { // Only include objects that have tasks
            // Utilization should also be based on the visual duration of the workday shown.
            const utilization = visualTotalDuration > 0 ? (workload / visualTotalDuration) * 100 : 0;
            objectsWithTasks.push({ ...obj, utilization_percentage: Math.round(utilization * 10) / 10 });
        }
    });

    const result = {
        start_time: visualStartTimeStr, // Use the dynamic visual start time
        end_time: visualEndTimeStr, // Use the new visual end time
        start_time_minutes: visualStartTimeMinutes, // Use the dynamic start time
        end_time_minutes: visualEndTimeMinutes, // Use the new visual end time
        total_duration_minutes: visualTotalDuration, // This is now the unified duration
        tasks: processedTasks,
        article_title: sim.meta?.article_title || "Process Simulation",
        domain: sim.meta?.domain || "General",
    };
    
    // Add objects with tasks to a special "timeline_actors" group for timeline rendering
    result.timeline_actors = objectsWithTasks;
    
    // Add all object types dynamically
    Object.entries(objectsByType).forEach(([type, objects]) => {
        result[type] = objects;
    });
    
    return result;
}

// Render simulation with resources display
function renderSimulation(skipJsonValidation = false) {
    // Prevent recursive rendering loops
    if (window.simulationPlayerActive || window.renderingInProgress) {
        console.log('TIMELINE: Skipping renderSimulation() - already in progress');
        return;
    }

    window.renderingInProgress = true;

    const simulationContent =
        document.getElementById("simulation-content");
    const loadingOverlay =
        document.getElementById("simulation-loading");

    // Show non-blocking progress indicator
    showProgressIndicator('Processing simulation...');

    // Clean up any existing drag/resize state
    cleanupDragResizeState();

    try {
        loadingOverlay.style.display = "flex";

        // Use window.editor if available (for custom editor wrappers), otherwise fall back to global editor
        const editorToUse = window.editor || editor;

        // Basic JSON syntax validation (skip if already validated)
        let jsonText = editorToUse.getValue();

        // Pre-process date expressions (convert unquoted date.today/date.start to quoted strings)
        if (typeof window.preprocessDateExpressions === 'function') {
            jsonText = window.preprocessDateExpressions(jsonText);
        }

        if (!skipJsonValidation) {
            try {
                JSON.parse(stripJsonComments(jsonText));
            } catch (e) {
                simulationContent.innerHTML =
                    '<p style="color: var(--error-color); text-align: center; margin-top: 2rem;">Cannot render: Invalid JSON syntax</p>';
                loadingOverlay.style.display = "none";
                window.renderingInProgress = false;
                return;
            }
        }
        const simulationData = JSON.parse(stripJsonComments(jsonText));

        let dataToProcess = simulationData;

        if (simulationData.simulation) {
        } else {
            console.warn('TIMELINE: No simulation key found. Trying to adapt structure...');

            // If the JSON doesn't have a 'simulation' wrapper, try to adapt it
            if (simulationData.config || simulationData.tasks || simulationData.objects) {
                // The JSON is already in the 'simulation' format, wrap it
                dataToProcess = {
                    simulation: simulationData
                };
                console.log('TIMELINE: Wrapped flat JSON structure');
            } else {
                console.error('TIMELINE: Invalid simulation data structure:', simulationData);
                simulationContent.innerHTML = '<p style="color: var(--error-color); text-align: center; margin-top: 2rem;">Cannot render: Invalid simulation data structure. Please check your JSON format.</p>';
                return;
            }
        }

        // Check if this is a multi-period simulation (but not if we're rendering a single day from within multi-period view)
        const isMultiPeriod = dataToProcess.simulation?.day_types && dataToProcess.simulation?.calendar;

        if (isMultiPeriod && !window.renderingSingleDayFromMultiPeriod) {
            // Initialize or update view controller for multi-period simulation
            if (!multiPeriodViewController) {
                multiPeriodViewController = new MultiPeriodViewController();
                window.multiPeriodViewController = multiPeriodViewController; // Make globally accessible
            }

            multiPeriodViewController.initialize(dataToProcess);

            // Add UI elements for multi-period views
            ensureMultiPeriodUI();

            // Delegate rendering to view controller
            multiPeriodViewController.render();

            loadingOverlay.style.display = "none";
            window.renderingInProgress = false;
            return;
        }

        // Single-day simulation - continue with existing logic
        // Hide multi-period UI elements ONLY if we're not rendering a day view from multi-period
        if (!window.renderingSingleDayFromMultiPeriod) {
            hideMultiPeriodUI();
        }

        currentSimulationData = processSimulationData(dataToProcess);

        if (spaceEditor && dataToProcess.simulation && dataToProcess.simulation.layout) {
            spaceEditor.loadLayout(dataToProcess.simulation.layout);
        }

        simulationContent.innerHTML = "";
        const container = document.createElement("div");
        container.className = "simulation-container";

        const header = document.createElement("div");
        header.className = "simulation-header";
        header.innerHTML = `
            <div class="simulation-header-content">
                <h4>${sanitizeHTML(currentSimulationData.article_title)}</h4>
                <p>${sanitizeHTML(currentSimulationData.domain)} • ${sanitizeHTML(currentSimulationData.start_time)} - ${sanitizeHTML(currentSimulationData.end_time)} (${sanitizeHTML(currentSimulationData.total_duration_minutes)} minutes)</p>
            </div>
        `;

        // Add View dropdown controls
        const viewControls = document.createElement('div');
        viewControls.className = 'view-controls';
        viewControls.style.cssText = 'margin-left: auto; position: relative;';

        const viewDropdown = document.createElement('div');
        viewDropdown.className = 'dropdown';
        viewDropdown.innerHTML = `
            <button class="action-btn dropdown-toggle">View ▼</button>
            <div class="dropdown-content" style="right: 0; left: auto; min-width: 180px;">
                <label class="dropdown-checkbox-item">
                    <input type="checkbox" id="view-toggle-timeline" checked>
                    <span>Timeline</span>
                </label>
                <label class="dropdown-checkbox-item">
                    <input type="checkbox" id="view-toggle-objects" checked>
                    <span>Objects</span>
                </label>
                <label class="dropdown-checkbox-item">
                    <input type="checkbox" id="view-toggle-digital-objects" checked>
                    <span>Digital Objects</span>
                </label>
                <label class="dropdown-checkbox-item">
                    <input type="checkbox" id="view-toggle-statistics" checked>
                    <span>Statistics</span>
                </label>
            </div>
        `;

        viewControls.appendChild(viewDropdown);
        header.appendChild(viewControls);

        container.appendChild(header);

        // Add event listeners for view toggles
        setTimeout(() => {
            document.getElementById('view-toggle-timeline')?.addEventListener('change', (e) => {
                const timelineElement = document.querySelector('.simulation-timeline');
                if (timelineElement) {
                    timelineElement.style.display = e.target.checked ? '' : 'none';
                }
            });

            document.getElementById('view-toggle-objects')?.addEventListener('change', (e) => {
                const objectsPanels = document.querySelectorAll('.resources-panel');
                objectsPanels.forEach(panel => {
                    // Only hide panels that are NOT for digital objects
                    if (!panel.id.includes('digital')) {
                        panel.style.display = e.target.checked ? '' : 'none';
                    }
                });
            });

            document.getElementById('view-toggle-digital-objects')?.addEventListener('change', (e) => {
                // Find panels specifically for digital object types (digital_object, digital_location, etc.)
                const digitalPanels = document.querySelectorAll('.resources-panel');
                digitalPanels.forEach(panel => {
                    // Check if panel ID matches digital object type patterns
                    const panelId = panel.id;
                    const isDigitalPanel = panelId.match(/live-digital[_-]/i);
                    if (isDigitalPanel) {
                        panel.style.display = e.target.checked ? '' : 'none';
                    }
                });
            });

            document.getElementById('view-toggle-statistics')?.addEventListener('change', (e) => {
                const statsSection = document.querySelector('.simulation-stats');
                if (statsSection) {
                    // Use 'flex' explicitly to maintain the horizontal layout
                    statsSection.style.display = e.target.checked ? 'flex' : 'none';
                }
            });
        }, 0);

        const timeline = document.createElement("div");
        timeline.className = "simulation-timeline";
        timeline.style.cssText =
            "position: relative; min-height: 300px; background: var(--bg-color); border: 1px solid var(--border-color); border-radius: var(--border-radius-md); margin: 1rem 0; width: 100%; box-sizing: border-box;";

        const timeMarkers = document.createElement("div");
        timeMarkers.className = "timeline-time-markers";
        timeMarkers.setAttribute('role', 'presentation');
        timeMarkers.setAttribute('aria-label', 'Timeline time markers');
        timeMarkers.style.cssText =
            "position: relative; height: 30px; border-bottom: 1px solid var(--border-color); background: #f8f9fa;";

         // Use the same scaling values as tasks (from processSimulationData unified scaling)
        const visualTotalDuration = currentSimulationData.total_duration_minutes;
        const visualStartTimeMinutes = currentSimulationData.start_time_minutes;

        const markerInterval = visualTotalDuration <= 120 ? 30 : 60; // use 30m for short sims, 60m for long

        // Use DocumentFragment for efficient DOM batching
        const markerFragment = document.createDocumentFragment();

        for (
            let minutes = 0;
            minutes <= visualTotalDuration;
            minutes += markerInterval
        ) {
            const marker = document.createElement("div");
            marker.className = "time-marker";
            marker.setAttribute('role', 'presentation');
            // Use same scaling logic as tasks: relative position within visual duration
            marker.style.cssText = `position: absolute; left: ${(minutes / visualTotalDuration) * 100}%; top: 5px; font-size: 0.75rem; color: var(--text-light); transform: translateX(-50%);`;

            const totalMinutesFromStart = visualStartTimeMinutes + minutes;
            marker.textContent = formatTimeFromMinutes(totalMinutesFromStart);

            markerFragment.appendChild(marker);
        }

        // Batch append all markers at once
        timeMarkers.appendChild(markerFragment);

        timeline.appendChild(timeMarkers);

        const actorLanes = document.createElement("div");
        actorLanes.className = "actor-lanes";
        actorLanes.setAttribute('role', 'list');
        actorLanes.setAttribute('aria-label', 'Actor timelines');
        actorLanes.style.cssText =
            "padding: 1rem; width: 100%; box-sizing: border-box;";

        // Use objects that have tasks (regardless of type)
        const actors = currentSimulationData.timeline_actors || [];

        // Use DocumentFragment for efficient DOM batching
        const lanesFragment = document.createDocumentFragment();

        for (const actor of actors) {
            const lane = document.createElement("div");
            lane.className = "actor-lane";
            lane.setAttribute('role', 'listitem');
            lane.style.cssText =
                "display: flex; margin-bottom: 1rem; min-height: 60px; width: 100%; box-sizing: border-box;";

            const actorLabel = document.createElement("div");
            actorLabel.className = "actor-label";
            actorLabel.style.cssText =
                "width: 150px; padding: 0.5rem; background: var(--bg-light); border-radius: var(--border-radius-sm); margin-right: 1rem; flex-shrink: 0;";
            // Determine display role based on object type
            let displayRole;
            if (actor.type === 'actor') {
                displayRole = actor.properties?.role || actor.name;
            } else if (actor.type === 'equipment') {
                displayRole = `${actor.name} (Equipment)`;
            } else if (actor.type === 'resource') {
                displayRole = `${actor.name} (Resource)`;
            } else if (actor.type === 'product') {
                displayRole = `${actor.name} (Product)`;
            } else {
                displayRole = `${actor.name} (${actor.type})`;
            }

            actorLabel.innerHTML = `
                <strong>${sanitizeHTML(displayRole)}</strong><br>
                <small>Utilization: ${sanitizeHTML(actor.utilization_percentage)}%</small>
            `;
            lane.appendChild(actorLabel);

            const taskTrack = document.createElement("div");
            taskTrack.className = "task-track";
            taskTrack.dataset.actorId = actor.id;
            taskTrack.setAttribute('role', 'group');
            taskTrack.setAttribute('aria-label', `Tasks for ${displayRole}`);
            taskTrack.style.cssText =
                "flex: 1; position: relative; background: #f8f9fa; border: 1px solid var(--border-color); border-radius: var(--border-radius-sm); min-height: 40px; width: 100%; box-sizing: border-box;";

            const actorTasks = currentSimulationData.tasks.filter(
                (task) => task.actor_id === actor.id,
            );

            // Use DocumentFragment for task batching
            const tasksFragment = document.createDocumentFragment();

            for (const task of actorTasks) {
                const taskElement = document.createElement("div");
                taskElement.className = "task-block";
                taskElement.dataset.taskId = task.id;
                taskElement.dataset.actorId = task.actor_id;
                taskElement.dataset.start = task.start;
                taskElement.dataset.duration = task.duration;
                taskElement.setAttribute('role', 'button');
                taskElement.setAttribute('aria-label', `Task: ${task.display_name}, ${task.duration} minutes, starts at ${task.start}`);
                taskElement.setAttribute('tabindex', '0');

                taskElement.style.cssText = `position: absolute; left: ${task.start_percentage}%; width: ${task.duration_percentage}%; height: 30px; top: 5px; background: var(--bg-color); color: var(--text-color); border: 2px solid var(--primary-color); border-radius: var(--border-radius-sm); font-size: 0.75rem; overflow: hidden; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 0.25rem; padding: 0.25rem 0.5rem; user-select: none;`;

                // Gracefully scale emoji down for tasks under 10 minutes
                let emojiStyle = '';
                if (task.duration < 10) {
                    // Linear scale from 16px (at 10 minutes) down to 10px (at 1 minute)
                    const normalSize = 16;
                    const minSize = 10;
                    const scaleFactor = Math.max(0, (task.duration - 1) / 9); // 0 at 1 minute, 1 at 10 minutes
                    const emojiSize = minSize + (normalSize - minSize) * scaleFactor;
                    emojiStyle = `style="font-size: ${emojiSize}px; line-height: 1;"`;
                }

                taskElement.innerHTML = `<span class="task-emoji" ${emojiStyle}>${sanitizeHTML(task.emoji)}</span>`;
                taskElement.title = `${sanitizeHTML(task.display_name)} (${sanitizeHTML(task.duration)} minutes)`;

                // Add click event listener as backup for jump functionality
                taskElement.addEventListener("click", (e) => {
                    // Only handle click if no drag occurred
                    if (!isDragging) {
                        e.stopPropagation(); // Prevent bubbling to track scrubbing handler
                        scrollToTaskInJSON(task.id);
                    }
                });

                // Add throttled mousemove event listener for cursor changes on edges
                const throttledMouseMove = throttle((e) => {
                    if (isResizing || isDragging) return;

                    const rect = taskElement.getBoundingClientRect();
                    const relativeX = e.clientX - rect.left;
                    const isLeftEdge = relativeX <= EDGE_DETECTION_THRESHOLD;
                    const isRightEdge = relativeX >= rect.width - EDGE_DETECTION_THRESHOLD;

                    if (isLeftEdge || isRightEdge) {
                        taskElement.style.cursor = "ew-resize";
                    } else {
                        taskElement.style.cursor = "pointer";
                    }
                }, THROTTLE_DELAY);

                taskElement.addEventListener("mousemove", throttledMouseMove);

                // Reset cursor when leaving task block
                taskElement.addEventListener("mouseleave", () => {
                    if (!isResizing) {
                        taskElement.style.cursor = "pointer";
                    }
                });

                tasksFragment.appendChild(taskElement);
            }

            // Batch append all tasks
            taskTrack.appendChild(tasksFragment);

            lane.appendChild(taskTrack);
            lanesFragment.appendChild(lane);
        }

        // Batch append all lanes
        actorLanes.appendChild(lanesFragment);

        timeline.appendChild(actorLanes);
        container.appendChild(timeline);


        // --- Dynamic State Panels ---
        const liveStateContainer = document.createElement('div');
        liveStateContainer.id = 'live-state-container';
        liveStateContainer.style.display = 'flex';
        liveStateContainer.style.gap = '1rem';
        liveStateContainer.style.marginTop = '1rem';

        // Create panels dynamically based on object types in simulation data
        const detectedTypes = new Set();
        
        // Add types that have existing objects (both standard and custom types)
        Object.keys(currentSimulationData).forEach(key => {
            // Skip non-object-type keys
            if (['tasks', 'start_time', 'end_time', 'start_time_minutes', 'end_time_minutes', 'total_duration_minutes', 'article_title', 'domain', 'timeline_actors'].includes(key)) {
                return;
            }
            
            // Check if this key represents an object type (arrays of objects)
            if (Array.isArray(currentSimulationData[key]) && currentSimulationData[key].length > 0) {
                // Verify it's actually an object type by checking if items have typical object properties
                const firstItem = currentSimulationData[key][0];
                if (firstItem && (firstItem.id || firstItem.type)) {
                    detectedTypes.add(key);
                }
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
        // Generate stats dynamically based on available object types
        const objectStats = Object.entries(currentSimulationData)
            .filter(([key, value]) => Array.isArray(value) && !['tasks'].includes(key) && !['start_time', 'end_time', 'start_time_minutes', 'end_time_minutes', 'total_duration_minutes', 'article_title', 'domain'].includes(key))
            .map(([type, objects]) => `<div class="stat-item"><strong>${type.charAt(0).toUpperCase() + type.slice(1)}:</strong> ${objects.length}</div>`)
            .join('');
        
        stats.innerHTML = `
            <div class="stat-item"><strong>Total Duration:</strong> ${currentSimulationData.total_duration_minutes} minutes</div>
            <div class="stat-item"><strong>Tasks:</strong> ${currentSimulationData.tasks.length}</div>
            ${objectStats}
        `;
        container.appendChild(stats);

        simulationContent.appendChild(container);

        // Preserve current playhead time across re-renders
        const previousPlayhead = (window.player && typeof window.player.playheadTime === 'number')
            ? window.player.playheadTime
            : currentSimulationData.start_time_minutes;

        if (player && typeof player.destroy == 'function') {
            player.destroy();
        }
        player = new SimulationPlayer(currentSimulationData);
        // Restore playhead position immediately after creating the player
        if (typeof previousPlayhead === 'number') {
            try { player.update(previousPlayhead); } catch (e) { /* noop */ }
        }
        window.player = player; // Make globally accessible for spacebar functionality
    } catch (e) {
        simulationContent.innerHTML = `<p style="color: var(--error-color); text-align: center; margin-top: 2rem;">Render Error: ${e.message}</p>`;
        console.error("Render error:", e);
    } finally {
        loadingOverlay.style.display = "none";
        window.renderingInProgress = false;

        // Hide progress indicator
        hideProgressIndicator();

        // If we're in day view within multi-period, re-render breadcrumbs
        if (window.renderingSingleDayFromMultiPeriod && window.multiPeriodViewController) {
            window.multiPeriodViewController.renderBreadcrumbs();
        }
    }
}

// Make renderSimulation globally accessible
window.renderSimulation = renderSimulation;

// Debounced rendering
function debounceRender() {
    // Avoid scheduling renders during active scrubbing/playback or while the
    // simulation player is writing back to the editor.
    if (window.simulationPlayerActive || window.simulationPlayerUpdatingEditor) {
        return;
    }
    clearTimeout(renderTimeout);
    renderTimeout = setTimeout(renderSimulation, 300); // Wait 300ms for user to finish typing
}

// Drag and drop functionality
function initializeDragAndDrop() {
    // Clean up any existing listeners first
    cleanupEventListeners();

    // Create throttled version of handleMouseMove
    const throttledMouseMove = throttle(handleMouseMove, THROTTLE_DELAY);

    // Store event listener references for cleanup
    const mouseDownHandler = handleMouseDown;
    const mouseUpHandler = handleMouseUp;

    document.addEventListener('mousedown', mouseDownHandler);
    document.addEventListener('mousemove', throttledMouseMove);
    document.addEventListener('mouseup', mouseUpHandler);

    // Track listeners for cleanup
    eventListeners.push(
        { element: document, event: 'mousedown', handler: mouseDownHandler },
        { element: document, event: 'mousemove', handler: throttledMouseMove },
        { element: document, event: 'mouseup', handler: mouseUpHandler }
    );
}

function handleMouseDown(e) {
    try {
        // Check if simulation data is available
        if (!currentSimulationData) {
            console.warn('Cannot start drag/drop: No simulation data loaded');
            return;
        }

        const taskElement = e.target.closest('.task-block');
        if (!taskElement) return;

        // Stop the event from bubbling up to the track, which would trigger scrubbing
        e.stopPropagation();

        const rect = taskElement.getBoundingClientRect();
        const relativeX = e.clientX - rect.left;
        const isLeftEdge = relativeX <= EDGE_DETECTION_THRESHOLD;
        const isRightEdge = relativeX >= rect.width - EDGE_DETECTION_THRESHOLD;

        if (isLeftEdge || isRightEdge) {
            // Start resizing
            isResizing = true;
            resizeType = isLeftEdge ? 'left' : 'right';
            resizeHandle = taskElement;
            originalDuration = parseInt(taskElement.dataset.duration);
            originalStartTime = taskElement.dataset.start;
            
            document.body.classList.add('resizing-active');
            resizeHandle.classList.add('resizing');
            
            // Create duration preview overlay
            durationPreview = document.createElement('div');
            durationPreview.className = 'duration-preview';
            durationPreview.style.cssText = `
                position: fixed;
                background: rgba(0, 0, 0, 0.8);
                color: white;
                padding: 0.5rem;
                border-radius: 4px;
                font-size: 0.75rem;
                pointer-events: none;
                z-index: 10000;
                left: ${e.clientX + 10}px;
                top: ${e.clientY - 10}px;
            `;
            durationPreview.textContent = `${originalDuration} minutes`;
            document.body.appendChild(durationPreview);
            
            e.preventDefault();
        } else {
            // Start dragging
            document.body.classList.add('dragging-active');
            isDragging = true;
            draggedTask = taskElement;
            dragStartX = e.clientX;
            dragStartY = e.clientY;

            // Calculate offset from left edge of task to cursor position
            const rect = taskElement.getBoundingClientRect();
            dragOffsetX = e.clientX - rect.left;

            originalTaskData = {
                taskId: taskElement.dataset.taskId,
                actorId: taskElement.dataset.actorId,
                start: taskElement.dataset.start,
                duration: parseInt(taskElement.dataset.duration)
            };

            taskElement.style.opacity = '0.7';
            taskElement.style.zIndex = '1000';
            taskElement.style.overflow = 'visible'; // Allow overlay to show above

            // Create time preview overlay
            timePreview = document.createElement('div');
            timePreview.className = 'duration-preview';
            timePreview.style.cssText = `
                position: absolute;
                top: -25px;
                left: 50%;
                transform: translateX(-50%);
                background: var(--primary-color);
                color: white;
                padding: 2px 6px;
                border-radius: 3px;
                font-size: 0.7rem;
                white-space: nowrap;
                z-index: 1001;
                pointer-events: none;
            `;
            timePreview.textContent = originalTaskData.start;
            taskElement.appendChild(timePreview);

            e.preventDefault();
        }
    } catch (error) {
        console.error('Error in handleMouseDown:', error);
        // Clean up any partial state
        cleanupDragResizeState();
    }
}

function handleMouseMove(e) {
    try {
        if (isResizing && resizeHandle && durationPreview) {
            // Check if simulation data is available
            if (!currentSimulationData || typeof currentSimulationData.total_duration_minutes === 'undefined' ||
                typeof currentSimulationData.start_time_minutes === 'undefined') {
                console.warn('Cannot resize: Invalid simulation data');
                return;
            }

            const trackElement = resizeHandle.closest('.task-track');
            if (!trackElement) return;

            const trackRect = trackElement.getBoundingClientRect();
            const newPosition = calculateNewTimeFromPosition(e.clientX, trackElement);
            if (newPosition === null) return; // Invalid simulation data
            const taskStartMinutes = parseTimeToMinutes(originalStartTime);

            let newDuration, newStartMinutes = taskStartMinutes;
            if (resizeType === 'left') {
                // Resizing from the left edge
                newStartMinutes = newPosition;
                const originalEndMinutes = taskStartMinutes + originalDuration;
                newDuration = originalEndMinutes - newStartMinutes;
            } else {
                // Resizing from the right edge
                newDuration = newPosition - taskStartMinutes;
            }

            // Minimum duration constraint
            newDuration = Math.max(MIN_TASK_DURATION, Math.round(newDuration));

            // Update preview tooltip
            durationPreview.textContent = `${newDuration} minutes`;
            durationPreview.style.left = `${e.clientX + 10}px`;
            durationPreview.style.top = `${e.clientY - 10}px`;

            // Apply immediate visual feedback to the task block
            const totalDurationMinutes = currentSimulationData.total_duration_minutes;
            const startTimeMinutes = currentSimulationData.start_time_minutes;

            if (resizeType === 'left') {
                // Update both position and width for left edge resize
                const newStartPercentage = ((newStartMinutes - startTimeMinutes) / totalDurationMinutes) * 100;
                const newDurationPercentage = (newDuration / totalDurationMinutes) * 100;
                resizeHandle.style.left = `${newStartPercentage}%`;
                resizeHandle.style.width = `${newDurationPercentage}%`;
            } else {
                // Update only width for right edge resize
                const newDurationPercentage = (newDuration / totalDurationMinutes) * 100;
                resizeHandle.style.width = `${newDurationPercentage}%`;
            }

        } else if (isDragging && draggedTask && timePreview) {
            // Clear previous timeline highlights
            document.querySelectorAll('.task-track').forEach(track => {
                track.classList.remove('drag-target', 'drag-invalid');
            });

            // Find the timeline track under the cursor
            const elementBelow = document.elementFromPoint(e.clientX, e.clientY);
            const targetTrack = elementBelow?.closest('.task-track');
            const currentTrack = draggedTask.closest('.task-track');

            // Highlight the target timeline
            if (targetTrack) {
                if (targetTrack !== currentTrack) {
                    // Cross-timeline move - highlight target
                    targetTrack.classList.add('drag-target');
                    // Update time preview to show the target actor
                    const targetActorId = targetTrack.dataset.actorId;
                    const newTime = calculateNewTimeFromPosition(e.clientX - dragOffsetX, targetTrack);
                    if (newTime !== null) {
                        const timeString = formatTimeFromMinutes(newTime);
                        timePreview.textContent = `→ ${targetActorId} at ${timeString}`;
                    }
                } else {
                    // Same timeline move - show just the time
                    const newTime = calculateNewTimeFromPosition(e.clientX - dragOffsetX, targetTrack);
                    if (newTime !== null) {
                        const timeString = formatTimeFromMinutes(newTime);
                        timePreview.textContent = timeString;
                    }
                }
            } else {
                // Not over a valid drop target
                timePreview.textContent = 'Invalid drop zone';
            }

            // Calculate the new position of the left edge of the task in the original timeline
            const trackElement = draggedTask.closest('.task-track');
            if (!trackElement) return;

            const newLeftX = e.clientX - dragOffsetX;
            const trackRect = trackElement.getBoundingClientRect();
            const relativeX = newLeftX - trackRect.left;
            let newStartPercentage = (relativeX / trackRect.width) * 100;

            // Clamp the value between 0 and (100 - task_width)
            const taskWidthPercentage = parseFloat(draggedTask.style.width);
            newStartPercentage = Math.max(0, Math.min(newStartPercentage, 100 - taskWidthPercentage));

            // Apply the new position directly to the 'left' property
            draggedTask.style.left = `${newStartPercentage}%`;
        }
    } catch (error) {
        console.error('Error in handleMouseMove:', error);
        // Clean up any problematic state
        cleanupDragResizeState();
    }
}

function handleMouseUp(e) {
    try {
        if (isResizing && resizeHandle) {
            const trackElement = resizeHandle.closest('.task-track');
            if (trackElement && currentSimulationData) {
                const newPosition = calculateNewTimeFromPosition(e.clientX, trackElement);
                if (newPosition === null) return; // Invalid simulation data
                const taskId = resizeHandle.dataset.taskId;
                const taskStartMinutes = parseTimeToMinutes(originalStartTime);
                
                let newDuration, newStartTime = originalStartTime;

                if (resizeType === 'left') {
                    // Resizing from the left edge
                    const newStartMinutes = newPosition;
                    const originalEndMinutes = taskStartMinutes + originalDuration;
                    newDuration = originalEndMinutes - newStartMinutes;

                    // Update start time
                    newStartTime = formatTimeFromMinutes(newStartMinutes);
                } else {
                    // Resizing from the right edge
                    newDuration = newPosition - taskStartMinutes;
                }

                // Minimum duration constraint
                newDuration = Math.max(MIN_TASK_DURATION, Math.round(newDuration));
                
                updateTaskDurationInJSON(taskId, newDuration, newStartTime);
            }
            
            // Clean up resize state but don't reset styles immediately to avoid visual jump
            document.body.classList.remove('resizing-active');
            resizeHandle.classList.remove('resizing');
            if (durationPreview) {
                durationPreview.remove();
            }
            isResizing = false;
            resizeType = null;
            resizeHandle = null;
            durationPreview = null;
            
        } else if (isDragging && draggedTask) {
            const elementBelow = document.elementFromPoint(e.clientX, e.clientY);
            const newTrack = elementBelow?.closest('.task-track');
            const currentTrack = draggedTask.closest('.task-track');

            if (newTrack && originalTaskData) {
                const newActorId = newTrack.dataset.actorId;
                // Account for the drag offset when calculating final position
                const newTime = calculateNewTimeFromPosition(e.clientX - dragOffsetX, newTrack);

                if (newActorId && newTime !== null) {
                    // Check if position actually changed (either different track or different time)
                    const originalTimeMinutes = parseTimeToMinutes(originalTaskData.start);
                    if (newTrack !== currentTrack || Math.abs(newTime - originalTimeMinutes) > 1) {
                        updateTaskInJSON(originalTaskData.taskId, newActorId, newTime);
                    }
                }
            }

            // Reset task appearance and clear transform immediately
            if (draggedTask) {
                draggedTask.style.opacity = '';
                draggedTask.style.zIndex = '';
                draggedTask.style.transform = '';
                draggedTask.style.overflow = ''; // Restore original overflow
            }

            // Clean up time preview
            if (timePreview) {
                timePreview.remove();
            }

            // Clear timeline highlights
            document.querySelectorAll('.task-track').forEach(track => {
                track.classList.remove('drag-target', 'drag-invalid');
            });

            // Clean up drag state immediately
            document.body.classList.remove('dragging-active');
            isDragging = false;
            draggedTask = null;
            timePreview = null;
            originalTaskData = null;
        }
    } catch (error) {
        console.error('Error in handleMouseUp:', error);
        // Clean up all drag/resize state
        cleanupDragResizeState();
    }
}

function calculateNewTimeFromPosition(clientX, trackElement) {
    try {
        // Check if simulation data is available
        if (!currentSimulationData || 
            typeof currentSimulationData.total_duration_minutes === 'undefined' || 
            typeof currentSimulationData.start_time_minutes === 'undefined') {
            console.warn('Cannot calculate time position: Invalid simulation data');
            return null;
        }

        const trackRect = trackElement.getBoundingClientRect();
        const relativeX = clientX - trackRect.left;
        const percentage = (relativeX / trackRect.width) * 100;
        const clampedPercentage = Math.max(0, Math.min(100, percentage));
        
        const totalMinutes = currentSimulationData.total_duration_minutes;
        const startTimeMinutes = currentSimulationData.start_time_minutes;
        const newTime = startTimeMinutes + (clampedPercentage / 100) * totalMinutes;
        
        return Math.round(newTime);
    } catch (error) {
        console.error('Error in calculateNewTimeFromPosition:', error);
        return null;
    }
}

function updateTaskInJSON(taskId, newActorId, newTimeMinutes) {
    try {
        // Use window.editor if available (for custom editor wrappers), otherwise fall back to global editor
        const editorToUse = window.editor || editor;

        const currentJson = JSON.parse(stripJsonComments(editorToUse.getValue()));

        // Handle both formats: day type wrapper and full multi-period JSON
        const tasks = currentJson.simulation?.tasks || [];
        const task = tasks.find(t => t.id === taskId);

        if (task) {
            // Update actor
            task.actor_id = newActorId;

            // Update time
            task.start = formatTimeFromMinutes(newTimeMinutes);

            editorToUse.setValue(JSON.stringify(currentJson, null, 2));
        }
    } catch (e) {
        console.error('Error updating task in JSON:', e);
    }
}

function updateTaskDurationInJSON(taskId, newDuration, newStartTime) {
    try {
        // Use window.editor if available (for custom editor wrappers), otherwise fall back to global editor
        const editorToUse = window.editor || editor;

        const currentJson = JSON.parse(stripJsonComments(editorToUse.getValue()));
        const task = currentJson.simulation.tasks.find(t => t.id === taskId);

        if (task) {
            task.duration = newDuration;
            if (newStartTime !== task.start) {
                task.start = newStartTime;
            }

            editorToUse.setValue(JSON.stringify(currentJson, null, 2));
        }
    } catch (e) {
        console.error('Error updating task duration in JSON:', e);
    }
}

// Dynamic panels update
function updateDynamicPanels() {
    try {
        const jsonText = editor.getValue();
        const simulationData = JSON.parse(stripJsonComments(jsonText));
        const processedData = processSimulationData(simulationData);
        
        // Check if live state container exists
        const liveStateContainer = document.getElementById('live-state-container');
        if (!liveStateContainer) return;
        
        // Update existing panels or create new ones as needed
        const detectedTypes = new Set();
        
        // Add types that have existing objects
        Object.keys(processedData).forEach(key => {
            // Skip non-object-type keys
            if (['tasks', 'start_time', 'end_time', 'start_time_minutes', 'end_time_minutes', 'total_duration_minutes', 'article_title', 'domain', 'timeline_actors'].includes(key)) {
                return;
            }
            
            // If there's no container yet, we'll let renderSimulation create it
            if (Array.isArray(processedData[key]) && processedData[key].length > 0) {
                const firstItem = processedData[key][0];
                if (firstItem && (firstItem.id || firstItem.type)) {
                    detectedTypes.add(key);
                }
            }
        });
        
        // Check for objects that will be created during tasks
        (processedData.tasks || []).forEach(task => {
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
        
        // Create panels for new types
        detectedTypes.forEach(objectType => {
            const existingPanel = document.getElementById(`live-${objectType}-panel`);
            if (!existingPanel) {
                const panel = document.createElement("div");
                panel.id = `live-${objectType}-panel`;
                panel.className = "resources-panel";
                panel.innerHTML = `<h5>${objectType} (at <span class="live-time">00:00</span>)</h5><div class="resource-grid"></div>`;
                liveStateContainer.appendChild(panel);
            }
        });
        
    } catch (e) {
        // JSON might be invalid during typing, ignore errors
    }
}

// Multi-period UI management functions
function ensureMultiPeriodUI() {
    const simulationContent = document.getElementById('simulation-content');
    if (!simulationContent) return;

    // Add breadcrumb container if it doesn't exist
    let breadcrumbsContainer = document.getElementById('multi-period-breadcrumbs');
    if (!breadcrumbsContainer) {
        breadcrumbsContainer = document.createElement('div');
        breadcrumbsContainer.id = 'multi-period-breadcrumbs';
        breadcrumbsContainer.className = 'multi-period-breadcrumbs';
        simulationContent.parentElement.insertBefore(breadcrumbsContainer, simulationContent);
    }

    breadcrumbsContainer.style.display = 'flex';
}

function hideMultiPeriodUI() {
    const breadcrumbsContainer = document.getElementById('multi-period-breadcrumbs');
    if (breadcrumbsContainer) {
        breadcrumbsContainer.style.display = 'none';
    }
}

// Helper function for parseTimeToMinutes (if not already defined)
function parseTimeToMinutes(timeStr) {
    if (typeof timeStr !== 'string' || !timeStr.match(/^\d{1,2}:\d{2}$/)) return null;
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
}
