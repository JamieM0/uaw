// Playground Timeline - Timeline rendering and interactions
// Universal Automation Wiki - Simulation Playground

// Timeline rendering variables
let renderTimeout;
let currentSimulationData = null;

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
    
    // Include digital locations from the raw simulationData structure
    if (simulationData.digital_space && simulationData.digital_space.digital_locations) {
        allObjects.push(...simulationData.digital_space.digital_locations);
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
function renderSimulation() {
    // CRITICAL FIX: Prevent re-rendering during active playback or scrubbing
    if (window.simulationPlayerActive) {
        console.log('TIMELINE: Skipping renderSimulation() during active playback/scrubbing');
        return;
    }
    
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

    // Basic JSON syntax validation
    try {
        JSON.parse(editor.getValue());
    } catch (e) {
        simulationContent.innerHTML =
            '<p style="color: var(--error-color); text-align: center; margin-top: 2rem;">Cannot render: Invalid JSON syntax</p>';
        return;
    }

    try {
        loadingOverlay.style.display = "flex";
        const jsonText = editor.getValue();
        const simulationData = JSON.parse(jsonText);
        
        // Debug: Log the structure to understand what we're getting
        console.log('TIMELINE: simulationData structure:', Object.keys(simulationData));
        
        let dataToProcess = simulationData;
        
        if (simulationData.simulation) {
            console.log('TIMELINE: simulationData.simulation keys:', Object.keys(simulationData.simulation));
        } else {
            console.log('TIMELINE: No simulation key found. Trying to adapt structure...');
            
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

        // Use objects that have tasks (regardless of type)
        const actors = currentSimulationData.timeline_actors || [];
        for (const actor of actors) {
            const lane = document.createElement("div");
            lane.className = "actor-lane";
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
                <strong>${displayRole}</strong><br>
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
                        e.stopPropagation(); // Prevent bubbling to track scrubbing handler
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

        if (player && typeof player.destroy == 'function') {
            player.destroy();
        }
        player = new SimulationPlayer(currentSimulationData);
        window.player = player; // Make globally accessible for spacebar functionality
    } catch (e) {
        simulationContent.innerHTML = `<p style="color: var(--error-color); text-align: center; margin-top: 2rem;">Render Error: ${e.message}</p>`;
        console.error("Render error:", e);
    } finally {
        loadingOverlay.style.display = "none";
    }
}

// Debounced rendering
function debounceRender() {
    clearTimeout(renderTimeout);
    renderTimeout = setTimeout(renderSimulation, 300); // Wait 300ms for user to finish typing
}

// Drag and drop functionality
function initializeDragAndDrop() {
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
}

function handleMouseDown(e) {
    const taskElement = e.target.closest('.task-block');
    if (!taskElement) return;

    // Stop the event from bubbling up to the track, which would trigger scrubbing
    e.stopPropagation();

    const rect = taskElement.getBoundingClientRect();
    const relativeX = e.clientX - rect.left;
    const isLeftEdge = relativeX <= 8;
    const isRightEdge = relativeX >= rect.width - 8;

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
        
        e.preventDefault();
    }
}

function handleMouseMove(e) {
    if (isResizing && resizeHandle && durationPreview) {
        const trackElement = resizeHandle.closest('.task-track');
        if (!trackElement) return;

        const trackRect = trackElement.getBoundingClientRect();
        const newPosition = calculateNewTimeFromPosition(e.clientX, trackElement);
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
        newDuration = Math.max(1, Math.round(newDuration));
        
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
        
    } else if (isDragging && draggedTask) {
        // --- START OF DRAG FIX ---
        const trackElement = draggedTask.closest('.task-track');
        if (!trackElement) return;

        // Calculate the new position of the left edge of the task
        const newLeftX = e.clientX - dragOffsetX;

        // Convert this pixel position to a percentage of the track width
        const trackRect = trackElement.getBoundingClientRect();
        const relativeX = newLeftX - trackRect.left;
        let newStartPercentage = (relativeX / trackRect.width) * 100;

        // Clamp the value between 0 and (100 - task_width)
        const taskWidthPercentage = parseFloat(draggedTask.style.width);
        newStartPercentage = Math.max(0, Math.min(newStartPercentage, 100 - taskWidthPercentage));

        // Apply the new position directly to the 'left' property
        draggedTask.style.left = `${newStartPercentage}%`;
        // --- END OF DRAG FIX ---
    }
}

function handleMouseUp(e) {
    if (isResizing && resizeHandle) {
        const trackElement = resizeHandle.closest('.task-track');
        if (trackElement) {
            const newPosition = calculateNewTimeFromPosition(e.clientX, trackElement);
            const taskId = resizeHandle.dataset.taskId;
            const taskStartMinutes = parseTimeToMinutes(originalStartTime);
            
            let newDuration, newStartTime = originalStartTime;
            
            if (resizeType === 'left') {
                // Resizing from the left edge
                const newStartMinutes = newPosition;
                const originalEndMinutes = taskStartMinutes + originalDuration;
                newDuration = originalEndMinutes - newStartMinutes;
                
                // Update start time
                const hours = Math.floor(newStartMinutes / 60);
                const mins = newStartMinutes % 60;
                newStartTime = `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
            } else {
                // Resizing from the right edge
                newDuration = newPosition - taskStartMinutes;
            }
            
            // Minimum duration constraint
            newDuration = Math.max(1, Math.round(newDuration));
            
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
        
        if (newTrack) {
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
        draggedTask.style.opacity = '';
        draggedTask.style.zIndex = '';
        draggedTask.style.transform = '';
        
        // Clean up drag state immediately
        document.body.classList.remove('dragging-active');
        isDragging = false;
        draggedTask = null;
        originalTaskData = null;
    }
}

function calculateNewTimeFromPosition(clientX, trackElement) {
    const trackRect = trackElement.getBoundingClientRect();
    const relativeX = clientX - trackRect.left;
    const percentage = (relativeX / trackRect.width) * 100;
    const clampedPercentage = Math.max(0, Math.min(100, percentage));
    
    const totalMinutes = currentSimulationData.total_duration_minutes;
    const startTimeMinutes = currentSimulationData.start_time_minutes;
    const newTime = startTimeMinutes + (clampedPercentage / 100) * totalMinutes;
    
    return Math.round(newTime);
}

function updateTaskInJSON(taskId, newActorId, newTimeMinutes) {
    try {
        const currentJson = JSON.parse(editor.getValue());
        const task = currentJson.simulation.tasks.find(t => t.id === taskId);
        
        if (task) {
            // Update actor
            task.actor_id = newActorId;
            
            // Update time
            const hours = Math.floor(newTimeMinutes / 60);
            const mins = newTimeMinutes % 60;
            task.start = `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
            
            editor.setValue(JSON.stringify(currentJson, null, 2));
        }
    } catch (e) {
        console.error('Error updating task in JSON:', e);
    }
}

function updateTaskDurationInJSON(taskId, newDuration, newStartTime) {
    try {
        const currentJson = JSON.parse(editor.getValue());
        const task = currentJson.simulation.tasks.find(t => t.id === taskId);
        
        if (task) {
            task.duration = newDuration;
            if (newStartTime !== task.start) {
                task.start = newStartTime;
            }
            
            editor.setValue(JSON.stringify(currentJson, null, 2));
        }
    } catch (e) {
        console.error('Error updating task duration in JSON:', e);
    }
}

// Dynamic panels update
function updateDynamicPanels() {
    try {
        const jsonText = editor.getValue();
        const simulationData = JSON.parse(jsonText);
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