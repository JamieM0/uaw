class SimulationPlayer {
    constructor(simulationData) {
        this.simData = simulationData;
        this.playheadTime = simulationData.start_time_minutes || 0;
        this.isPlaying = false;
        this.playbackSpeed = 1;
        this.animationFrameId = null;
        this.hasPropertyChanges = false;
        this.isUpdatingEditor = false;
        this.isScrubbing = false;
        this.trackedEventListeners = [];
        this.currentObjectStates = new Map();
        this.sortedTasks = [...(simulationData.tasks || [])].sort((a, b) => a.start_minutes - b.start_minutes);
        this.playbackModel = simulationData._workspec_document?.simulation?.schema_version === '2.1'
            ? null
            : window.WorkSpecPlaybackState?.createPlaybackModel?.(simulationData);

        // Cache for optimized state calculations
        this.lastStateCalculationTime = -1;
        this.stateCalculationThreshold = 0.5; // Only recalculate if moved > 0.5 minutes
        this.lastStateRefreshTimestamp = 0;
        this.lastStateBoundaryIndex = -1;
        this.taskTracks = [];
        this.playheads = [];

        this.ui = {
            playPauseBtn: document.getElementById('player-play-pause-btn'),
            speedSelect: document.getElementById('player-speed-select'),
            currentTimeDisplay: document.getElementById('player-current-time'),
            playhead: document.getElementById('simulation-playhead'),
            timeMarkers: document.querySelector('.timeline-time-markers'),
            liveTimeSpans: document.querySelectorAll('.live-time'),
            livePanels: this.findLivePanels(),
        };

        this.init();
        window.workSpecTimeController?.attachPlayer?.(this);
    }

    destroy() {
        this.isPlaying = false;
        window.simulationPlayerActive = false;
        cancelAnimationFrame(this.animationFrameId);
        this.animationFrameId = null;

        this.trackedEventListeners.forEach(({ element, event, handler }) => {
            element.removeEventListener(event, handler);
        });
        this.trackedEventListeners = [];
        window.workSpecTimeController?.detachPlayer?.(this);

        if (this.ui.playPauseBtn) {
            this.ui.playPauseBtn.removeEventListener('click', () => this.togglePlay());
        }
        if (this.ui.speedSelect) {
            this.ui.speedSelect.removeEventListener('change', () => this.setSpeed());
        }
        if (this.ui.playPauseBtn) {
            this.ui.playPauseBtn.innerHTML = '<span class="player-control-icon" aria-hidden="true">▶</span><span class="player-control-label">Play</span>';
            this.ui.playPauseBtn.setAttribute('aria-label', 'Play or pause simulation');
        }
    }

    trackEventListener(element, event, handler) {
        element.addEventListener(event, handler);
        this.trackedEventListeners.push({ element, event, handler });
    }

    findLivePanels() {
        const panels = {};
        document.querySelectorAll('[id^="live-"][id$="-panel"]').forEach(panel => {
            const match = panel.id.match(/^live-(.+)-panel$/);
            if (match) {
                const objectType = match[1];
                const resourceGrid = panel.querySelector('.resource-grid');
                if (resourceGrid) {
                    panels[objectType] = resourceGrid;
                }
            }
        });
        return panels;
    }

    init() {
        if (this.ui.playPauseBtn) {
            this.trackEventListener(this.ui.playPauseBtn, 'click', () => this.togglePlay());
        }
        if (this.ui.speedSelect) {
            this.trackEventListener(this.ui.speedSelect, 'change', (e) => this.setSpeed(e.target.value));
        }
        this.initScrubbing();
        this.update(this.playheadTime);

        // Initialize spacebar functionality globally (only once)
        SimulationPlayer.initGlobalSpacebarPlayPause();
    }

    static initGlobalSpacebarPlayPause() {
        // Prevent multiple initializations
        if (SimulationPlayer.spacebarInitialized) {
            return;
        }
        SimulationPlayer.spacebarInitialized = true;
        
        let spacebarPressed = false;
        
        // Add global keydown listener for spacebar play/pause
        document.addEventListener('keydown', (e) => {
            // Only trigger on spacebar (key code 32 or ' ')
            if (e.code !== 'Space' && e.key !== ' ') {
                return;
            }
            
            // Prevent multiple triggers from key repeat
            if (spacebarPressed) {
                e.preventDefault();
                return;
            }
            spacebarPressed = true;
            
            // Don't trigger if user is typing in input fields
            const activeElement = document.activeElement;
            if (activeElement && (
                activeElement.tagName === 'INPUT' || 
                activeElement.tagName === 'TEXTAREA' || 
                activeElement.contentEditable === 'true' ||
                activeElement.closest('.monaco-editor') // Monaco editor
            )) {
                spacebarPressed = false; // Reset flag
                return;
            }
            
            // Playback is application-wide. Canvas and editor controls still keep
            // their normal spacebar behaviour via the input checks above.
            const playbackAvailable = document.querySelector('.playback-controls-group')?.offsetParent !== null;

            if (playbackAvailable) {
                e.preventDefault(); // Prevent page scroll
                
                // Find the current player instance and call togglePlay on it
                if (window.player && typeof window.player.togglePlay === 'function') {
                    window.player.togglePlay();
                }
            }
            
            spacebarPressed = false; // Reset flag after processing
        });
        
        // Reset flag on keyup to handle key repeat properly
        document.addEventListener('keyup', (e) => {
            if (e.code === 'Space' || e.key === ' ') {
                spacebarPressed = false;
            }
        });
    }

    formatTime(minutes) {
        const safeMinutes = (typeof minutes === 'number' && Number.isFinite(minutes)) ? minutes : 0;
        const day = Math.floor(safeMinutes / 1440) + 1;
        const minutesInDay = ((safeMinutes % 1440) + 1440) % 1440;
        const h = Math.floor(minutesInDay / 60);
        const m = Math.floor(minutesInDay % 60);
        const time = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
        return day > 1 ? `Day ${day} ${time}` : time;
    }

    togglePlay() {
        this.isPlaying = !this.isPlaying;
        
        // CRITICAL FIX: Set global flag to prevent renderSimulation during playback
        window.simulationPlayerActive = this.isPlaying;
        
        if (this.ui.playPauseBtn) {
            this.ui.playPauseBtn.innerHTML = this.isPlaying
                ? '<span class="player-control-icon" aria-hidden="true">Ⅱ</span><span class="player-control-label">Pause</span>'
                : '<span class="player-control-icon" aria-hidden="true">▶</span><span class="player-control-label">Play</span>';
            this.ui.playPauseBtn.setAttribute('aria-label', this.isPlaying ? 'Pause simulation' : 'Play simulation');
        }

        if (this.isPlaying) {
            const firstTaskStart = (this.simData.tasks || [])
                .map(task => Number(task.start_minutes))
                .filter(Number.isFinite)
                .reduce((earliest, start) => Math.min(earliest, start), this.simData.start_time_minutes);
            // Restart only after reaching the end. Pausing and resuming must
            // preserve the application's one selected moment.
            if (this.playheadTime >= this.simData.end_time_minutes || this.playheadTime < firstTaskStart) {
                this.update(firstTaskStart);
            }

            // Initialize lastFrameTime immediately before starting the loop.
            this.lastFrameTime = performance.now();
            this.animationFrameId = requestAnimationFrame((t) => this.gameLoop(t));
        } else {
            cancelAnimationFrame(this.animationFrameId);
        }

    }

    setSpeed(speed) {
        this.playbackSpeed = Number(speed);
    }

    gameLoop(timestamp) {
        if (!this.isPlaying) return;

        const deltaTime = (timestamp - this.lastFrameTime) / 1000; // time in seconds
        this.lastFrameTime = timestamp;

        // Calendar scale only changes navigation granularity. Playback speed is
        // controlled exclusively by the base rate and the visible speed selector.
        const minutesPerSecond = window.workSpecTimeController?.getMinutesPerSecond?.() || 5;
        let timeIncrement = deltaTime * minutesPerSecond * this.playbackSpeed;
        
        let newTime = this.playheadTime + timeIncrement;

        if (newTime >= this.simData.end_time_minutes) {
            newTime = this.simData.end_time_minutes;
            this.togglePlay(); // Stop playback at the end
        }

        this.update(newTime, { force: newTime >= this.simData.end_time_minutes });

        if (this.isPlaying) {
            this.animationFrameId = requestAnimationFrame((t) => this.gameLoop(t));
        }
    }

    update(timeInMinutes, options = {}) {
        this.playheadTime = timeInMinutes;

        // 1. Update Playhead Position (always fast, no optimization needed)
        const percentage = (this.playheadTime - this.simData.start_time_minutes) / this.simData.total_duration_minutes;

        // Create playheads if they don't exist or track count changed, otherwise just reposition them
        if (!this.taskTracks.length || this.taskTracks.some(track => !track.isConnected)) {
            this.taskTracks = Array.from(document.querySelectorAll('.task-track'));
        }
        let existingPlayheads = this.playheads.filter(playhead => playhead.isConnected);
        const taskTracks = this.taskTracks;
        let playheadsChanged = false;

        if (existingPlayheads.length === 0 || existingPlayheads.length !== taskTracks.length) {
            playheadsChanged = true;
            // Remove any existing playheads before creating new ones
            existingPlayheads.forEach(el => el.remove());

            // Create playheads for each task track
            taskTracks.forEach(track => {
                const playheadClone = document.createElement('div');
                playheadClone.className = 'timeline-playhead';
                playheadClone.style.cssText = `
                    position: absolute;
                    left: ${percentage * 100}%;
                    top: 0;
                    bottom: 0;
                    width: 2px;
                    background: #FF0000;
                    z-index: 1000;
                    pointer-events: all;
                    box-shadow: 0 0 4px rgba(255, 0, 0, 0.5);
                    cursor: ew-resize;
                `;
                track.appendChild(playheadClone);
            });
            existingPlayheads = Array.from(document.querySelectorAll('.timeline-playhead'));
            this.playheads = existingPlayheads;
        } else {
            // Just reposition existing playheads
            existingPlayheads.forEach(playhead => {
                playhead.style.left = `${percentage * 100}%`;
            });
        }

        // Only attach scrubbing handlers if we're not currently scrubbing
        // This prevents duplicate playheads during drag operations
        if (playheadsChanged && this.attachScrubbing && !this.isScrubbing) {
            this.attachScrubbing();
        }

        // 2. Update Time Displays (always fast)
        if (window.workSpecTimeController?.model) {
            window.workSpecTimeController.setTime(this.playheadTime, { source: 'player', ...options });
        } else {
            const formattedTime = this.formatTime(this.playheadTime);
            if (this.ui.currentTimeDisplay) this.ui.currentTimeDisplay.textContent = formattedTime;
            if (this.ui.liveTimeSpans) this.ui.liveTimeSpans.forEach(span => span.textContent = formattedTime);
        }

        // Keep the visual timeline legible as a player: past, current and future
        // tasks should be obvious without opening a detail panel.
        if (!window.workSpecTimeController?.model) {
            taskTracks.forEach(track => {
                track.querySelectorAll('.task-block').forEach(taskBlock => {
                    const start = Number(taskBlock.dataset.startMinutes);
                    const duration = Number(taskBlock.dataset.duration);
                    const end = start + duration;
                    const active = Number.isFinite(start) && Number.isFinite(end) && this.playheadTime >= start && this.playheadTime < end;
                    const completed = Number.isFinite(end) && this.playheadTime >= end;
                    taskBlock.classList.toggle('active', active);
                    taskBlock.classList.toggle('completed', completed);
                    taskBlock.setAttribute('aria-current', active ? 'step' : 'false');
                });
            });
        }

        // 3-5. Optimize expensive state calculations - only recalculate if significant movement
        const timeDelta = Math.abs(this.playheadTime - this.lastStateCalculationTime);
        const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
        const boundaryIndex = window.workSpecTimeController?.getBoundaryIndex?.(this.playheadTime) ?? -1;
        const boundaryChanged = boundaryIndex !== this.lastStateBoundaryIndex;
        const refreshIntervalElapsed = (now - this.lastStateRefreshTimestamp) >= 80;
        const shouldRecalculateStates = (
            this.lastStateCalculationTime === -1 || // First run
            options.force === true ||
            !this.isPlaying || // Direct click/scrub while paused
            (boundaryChanged && refreshIntervalElapsed) ||
            (!window.workSpecTimeController?.model && timeDelta >= this.stateCalculationThreshold && refreshIntervalElapsed)
        );

        if (shouldRecalculateStates) {
            // 3. Calculate live object states (including created/deleted objects)
            this.updateLiveObjectState();

            // 4. Calculate and Render Live States
            this.updateAllObjectStates();

            // Cache this calculation time
            this.lastStateCalculationTime = this.playheadTime;
            this.lastStateRefreshTimestamp = now;
            this.lastStateBoundaryIndex = boundaryIndex;
        }

    }

    updateLiveObjectState() {
        if (this.simData._workspec_document?.simulation?.schema_version === '2.1' && window.WorkSpecRuntime?.snapshotProjectAt) {
            const snapshot = window.WorkSpecRuntime.snapshotProjectAt(
                this.simData._workspec_document,
                this.simData._workspec_script || '',
                this.playheadTime
            );
            const initial = this.simData._workspec_document.simulation.world?.objects || [];
            const initialIds = new Set(initial.map(object => object.id));
            const objects = Object.values(snapshot.objects || {});
            this.worldSnapshot = { runtime: true };
            this.liveObjects = { created: [], deleted: [] };
            objects.forEach(object => {
                if (!Array.isArray(this.liveObjects[object.type])) this.liveObjects[object.type] = [];
                this.liveObjects[object.type].push(object);
                if (!initialIds.has(object.id)) this.liveObjects.created.push(object);
            });
            initial.forEach(object => {
                if (!snapshot.objects?.[object.id]) this.liveObjects.deleted.push(object);
            });
            this.liveObjectMap = new Map(objects.map(object => [object.id, object]));
            return;
        }
        this.worldSnapshot = window.WorkSpecPlaybackState?.resolveWorldStateAtTime?.(this.playbackModel, this.playheadTime);
        if (!this.worldSnapshot) return;
        this.liveObjects = {
            ...this.worldSnapshot.objectsByType,
            created: this.worldSnapshot.created.map(entry => entry.object),
            deleted: this.worldSnapshot.deleted.map(entry => ({
                ...entry.object,
                deletedAt: entry.time,
                deletedBy: entry.taskId
            }))
        };
        this.liveObjectMap = this.worldSnapshot.objectsById;
    }

    findObjectById(objectId) {
        // Search through all object types dynamically
        for (const [key, objects] of Object.entries(this.simData)) {
            if (Array.isArray(objects)) {
                const found = objects.find(obj => obj && obj.id === objectId);
                if (found) return found;
            }
        }
        
        // Search in layout locations
        if (this.simData.layout?.locations) {
            const found = this.simData.layout.locations.find(obj => obj && obj.id === objectId);
            if (found) return found;
        }

        // Search in digital_space.digital_locations (simulation level)
        if (this.simData.digital_space && this.simData.digital_space.digital_locations) {
            const found = this.simData.digital_space.digital_locations.find(obj => obj && obj.id === objectId);
            if (found) return found;
        }

        // Search in digital_space.digital_objects (simulation level)
        if (this.simData.digital_space && this.simData.digital_space.digital_objects) {
            const found = this.simData.digital_space.digital_objects.find(obj => obj && obj.id === objectId);
            if (found) return found;
        }

        // Display elements are nested inside displays rather than stored in a
        // top-level object array, but they participate in the same clock.
        for (const display of (this.simData.displays || [])) {
            if (display?.id === objectId) return display;
            const found = (display?.rectangles || []).find(element => element && element.id === objectId);
            if (found) return found;
        }
        
        // Also check created objects
        return (this.liveObjects?.created || []).find(obj => obj.id === objectId);
    }

    findDigitalObjectById(objectId) {
        // Check if digital_space exists in simData (keeping for backward compatibility)
        if (this.simData.digital_space && this.simData.digital_space.digital_objects) {
            return this.simData.digital_space.digital_objects.find(obj => obj.id === objectId);
        }
        return null;
    }

    findAndMoveDisplayElement(elementId, fromDisplayId, toDisplayId, shouldMove, shouldRevert) {
        // Check if displays exist - they're at the root level, not in simData
        const displays = this.allData?.displays || this.simData.displays;
        if (!displays) {
            return null;
        }
        
        // Find source and target displays
        const fromDisplay = displays.find(d => d.id === fromDisplayId);
        const toDisplay = displays.find(d => d.id === toDisplayId);
        
        if (!fromDisplay || !toDisplay) {
            return null;
        }

        // Find the element in the source display
        const elementIndex = fromDisplay.rectangles?.findIndex(el => el.id === elementId);
        
        if (elementIndex === undefined || elementIndex === -1) {
            return null;
        }

        const element = fromDisplay.rectangles[elementIndex];

        if (shouldMove && !element.moved_to_display) {
            // Store original display for potential revert
            element.original_display_id = fromDisplayId;
            element.moved_to_display = toDisplayId;
            
            // Remove from source display
            fromDisplay.rectangles.splice(elementIndex, 1);
            
            // Add to target display
            if (!toDisplay.rectangles) {
                toDisplay.rectangles = [];
            }
            toDisplay.rectangles.push(element);
            
            return element;
        } else if (shouldRevert && element.original_display_id) {
            // Find element in current display and move back
            const currentDisplay = this.simData.displays.find(d => d.id === element.moved_to_display);
            if (currentDisplay && currentDisplay.rectangles) {
                const currentIndex = currentDisplay.rectangles.findIndex(el => el.id === elementId);
                if (currentIndex !== -1) {
                    // Remove from current display
                    currentDisplay.rectangles.splice(currentIndex, 1);
                    
                    // Add back to original display
                    const originalDisplay = this.simData.displays.find(d => d.id === element.original_display_id);
                    if (originalDisplay) {
                        if (!originalDisplay.rectangles) {
                            originalDisplay.rectangles = [];
                        }
                        originalDisplay.rectangles.push(element);
                        
                        // Clean up tracking properties
                        delete element.original_display_id;
                        delete element.moved_to_display;
                    }
                }
            }
            
            return element;
        }

        return null;
    }

    updateMonacoEditorAndNotifyEditors() {
        try {
            // Check if we have changes that need to be written back to the Monaco editor
            const hasChanges = this.hasSimulationChanges();
            
            if (hasChanges) {
                this.updateMonacoEditor();
            }
            
            // Then notify editors to refresh from the updated Monaco content
            this.updateDigitalSpaceAndDisplays();
        } catch (error) {
            console.error('SIMULATION-PLAYER: Error in updateMonacoEditorAndNotifyEditors:', error);
            // Don't let editor update errors crash the simulation player
        }
    }

    hasSimulationChanges() {
        // Check if we have property changes flag
        if (this.hasPropertyChanges) {
            return true;
        }
        
        // Check if any digital objects or display elements have been modified
        // by looking for our tracking properties
        if (this.simData.digital_space && this.simData.digital_space.digital_objects) {
            for (const obj of this.simData.digital_space.digital_objects) {
                if (obj.original_location_id) {
                    return true; // Digital object has been moved
                }
            }
        }
        
        if (this.simData.displays) {
            for (const display of this.simData.displays) {
                if (display.rectangles) {
                    for (const element of display.rectangles) {
                        if (element.original_display_id) {
                            return true; // Display element has been moved
                        }
                    }
                }
            }
        }
        
        return false;
    }

    updateMonacoEditor() {
        this.hasPropertyChanges = false; // Reset flag to prevent repeated attempts
        
        // Get reference to the Monaco editor
        const editor = window.playgroundCore?.monacoEditor || window.editor;
        if (!editor) {
            console.warn('SIMULATION-PLAYER: Monaco editor not found for updating');
            return;
        }
        
        try {
            // Set a flag to prevent infinite loops when the editor updates
            this.isUpdatingEditor = true;
            
            // Update the Monaco editor with the current simulation data
            // Wrap simData in the proper root structure that the editor expects
            const wrappedSimData = { simulation: this.simData };
            const updatedJson = JSON.stringify(wrappedSimData, null, 2);
            editor.setValue(updatedJson);
            
            // Reset the changes flag since we've updated the editor
            this.hasPropertyChanges = false;
            
            // Reset the updating flag after a short delay
            setTimeout(() => {
                this.isUpdatingEditor = false;
            }, 100);
        } catch (error) {
            console.error('SIMULATION-PLAYER: Error updating Monaco editor:', error);
            this.isUpdatingEditor = false;
        }
    }

    updateDigitalSpaceAndDisplays() {
        // Skip if we're currently updating the editor to avoid conflicts
        if (this.isUpdatingEditor) {
            return;
        }
        
        // Notify digital space editor to refresh its visualization
        if (window.digitalSpaceEditor && typeof window.digitalSpaceEditor.refreshFromSimulation === 'function') {
            window.digitalSpaceEditor.refreshFromSimulation();
        }
        
        // Notify display editor to refresh its visualization
        if (window.displayEditor && typeof window.displayEditor.refreshFromSimulation === 'function') {
            window.displayEditor.refreshFromSimulation();
        }
        
        // Update digital space properties panel if an object is selected
        if (window.digitalSpaceEditor && window.digitalSpaceEditor.selectedRectId) {
            window.digitalSpaceEditor.renderPropertiesPanel();
        }
        
        // Update display editor properties panel if an element is selected
        if (window.displayEditor && window.displayEditor.selectedRectId) {
            window.displayEditor.renderPropertiesPanel();
        }
    }

    updateObjectProperty(targetObject, property, newValue, originalValue, revertAfter, isTaskActive) {
        
        // Handle nested property paths like "properties.capacity_gb"
        const propertyPath = property.split('.');
        let current = targetObject;
        
        // Navigate to the parent object
        for (let i = 0; i < propertyPath.length - 1; i++) {
            if (!current[propertyPath[i]]) {
                current[propertyPath[i]] = {};
            }
            current = current[propertyPath[i]];
        }
        
        const finalProperty = propertyPath[propertyPath.length - 1];
        
        // Store original value for revert if not already stored
        const originalPropertyKey = `__original_${finalProperty}`;
        if (current[originalPropertyKey] === undefined && originalValue !== undefined) {
            current[originalPropertyKey] = originalValue;
        } else if (current[originalPropertyKey] === undefined) {
            current[originalPropertyKey] = current[finalProperty];
        }
        
        // Apply the property change
        let appliedValue = newValue;
        if (revertAfter && !isTaskActive) {
            // Revert to original value
            if (current[originalPropertyKey] !== undefined) {
                current[finalProperty] = current[originalPropertyKey];
                delete current[originalPropertyKey]; // Clean up tracking property
                appliedValue = current[finalProperty];
            }
        } else {
            // Apply new value
            current[finalProperty] = newValue;
            appliedValue = newValue;
        }
        
        
        // Instead of marking for Monaco overwrite, apply changes directly to Monaco editor
        this.updateMonacoProperty(targetObject.id, property, appliedValue);
    }

    updateMonacoProperty(objectId, property, newValue) {
        // Get reference to the Monaco editor
        const editor = window.playgroundCore?.monacoEditor || window.editor;
        if (!editor) {
            console.log(`SIMULATION-PLAYER: Monaco editor not found - cannot update ${property} for ${objectId}`);
            return;
        }

        try {
            // Get current JSON from Monaco editor
            const currentJson = JSON.parse(editor.getValue());
            
            // Find and update the specific object property
            let objectFound = false;
            
            // Search in digital_space.digital_locations (both at root level and under simulation)
            if (currentJson.digital_space?.digital_locations) {
                const obj = currentJson.digital_space.digital_locations.find(obj => obj.id === objectId);
                if (obj) {
                    obj[property] = newValue;
                    objectFound = true;
                }
            }
            
            // Also check under simulation.digital_space for backward compatibility
            if (!objectFound && currentJson.simulation?.digital_space?.digital_locations) {
                const obj = currentJson.simulation.digital_space.digital_locations.find(obj => obj.id === objectId);
                if (obj) {
                    obj[property] = newValue;
                    objectFound = true;
                }
            }
            
            // Search all arrays in simulation object dynamically
            if (!objectFound && currentJson.simulation) {
                Object.entries(currentJson.simulation).forEach(([arrayName, arrayValue]) => {
                    // Skip non-array properties and known non-object arrays
                    if (!Array.isArray(arrayValue) || ['tasks'].includes(arrayName)) {
                        return;
                    }

                    const obj = arrayValue.find(obj => obj && obj.id === objectId);
                    if (obj) {
                        // Handle nested properties like "properties.emoji"
                        const propertyPath = property.split('.');
                        if (propertyPath.length > 1) {
                            let current = obj;
                            for (let i = 0; i < propertyPath.length - 1; i++) {
                                if (!current[propertyPath[i]]) {
                                    current[propertyPath[i]] = {};
                                }
                                current = current[propertyPath[i]];
                            }
                            current[propertyPath[propertyPath.length - 1]] = newValue;
                        } else {
                            obj[property] = newValue;
                        }
                        objectFound = true;
                    }
                });
            }

            // WorkSpec v2: search in simulation.world.objects
            if (!objectFound && Array.isArray(currentJson.simulation?.world?.objects)) {
                const obj = currentJson.simulation.world.objects.find(obj => obj && obj.id === objectId);
                if (obj) {
                    // Handle nested properties like "properties.emoji"
                    const propertyPath = property.split('.');
                    if (propertyPath.length > 1) {
                        let current = obj;
                        for (let i = 0; i < propertyPath.length - 1; i++) {
                            const key = propertyPath[i];
                            if (key === "__proto__" || key === "prototype" || key === "constructor") {
                                // Skip dangerous keys to prevent prototype pollution
                                break;
                            }
                            if (!current[key]) {
                                current[key] = {};
                            }
                            current = current[key];
                        }
                        current[propertyPath[propertyPath.length - 1]] = newValue;
                    } else {
                        obj[property] = newValue;
                    }
                    objectFound = true;
                }
            }

            // Search in layout.locations
            if (!objectFound && currentJson.simulation?.layout?.locations) {
                const obj = currentJson.simulation.layout.locations.find(obj => obj.id === objectId);
                if (obj) {
                    const propertyPath = property.split('.');
                    if (propertyPath.length > 1) {
                        let current = obj;
                        for (let i = 0; i < propertyPath.length - 1; i++) {
                            const key = propertyPath[i];
                            if (key === "__proto__" || key === "prototype" || key === "constructor") {
                                // Skip dangerous keys to prevent prototype pollution
                                break;
                            }
                            if (!current[key]) {
                                current[key] = {};
                            }
                            current = current[key];
                        }
                        current[propertyPath[propertyPath.length - 1]] = newValue;
                    } else {
                        obj[property] = newValue;
                    }
                    objectFound = true;
                }
            }

            // WorkSpec v2: search in simulation.world.layout.locations
            if (!objectFound && currentJson.simulation?.world?.layout?.locations) {
                const obj = currentJson.simulation.world.layout.locations.find(obj => obj.id === objectId);
                if (obj) {
                    const propertyPath = property.split('.');
                    if (propertyPath.length > 1) {
                        let current = obj;
                        for (let i = 0; i < propertyPath.length - 1; i++) {
                            const key = propertyPath[i];
                            if (key === "__proto__" || key === "prototype" || key === "constructor") {
                                // Skip dangerous keys to prevent prototype pollution
                                break;
                            }
                            if (!current[key]) {
                                current[key] = {};
                            }
                            current = current[key];
                        }
                        current[propertyPath[propertyPath.length - 1]] = newValue;
                    } else {
                        obj[property] = newValue;
                    }
                    objectFound = true;
                }
            }

            // Search in canonical and legacy displays for display elements.
            const documentDisplays = currentJson.simulation?.world?.displays
                || currentJson.simulation?.displays
                || currentJson.displays
                || [];
            if (!objectFound && documentDisplays.length) {
                for (const display of documentDisplays) {
                    if (display.rectangles) {
                        const element = display.rectangles.find(el => el.id === objectId);
                        if (element) {
                            // Handle nested properties like "properties.border"
                            const propertyPath = property.split('.');
                            if (propertyPath.length > 1) {
                                let current = element;
                                for (let i = 0; i < propertyPath.length - 1; i++) {
                                    const key = propertyPath[i];
                                    if (key === "__proto__" || key === "prototype" || key === "constructor") {
                                        // Skip dangerous keys to prevent prototype pollution
                                        break;
                                    }
                                    if (!current[key]) {
                                        current[key] = {};
                                    }
                                    current = current[key];
                                }
                                current[propertyPath[propertyPath.length - 1]] = newValue;
                            } else {
                                element[property] = newValue;
                            }
                            objectFound = true;
                            break;
                        }
                    }
                }
            }

            // Search in digital_space.digital_objects
            if (!objectFound && currentJson.simulation?.digital_space?.digital_objects) {
                const obj = currentJson.simulation.digital_space.digital_objects.find(obj => obj.id === objectId);
                if (obj) {
                    // Handle nested properties like "properties.capacity_gb"
                    const propertyPath = property.split('.');
                    if (propertyPath.length > 1) {
                        let current = obj;
                        for (let i = 0; i < propertyPath.length - 1; i++) {
                            if (!current[propertyPath[i]]) {
                                current[propertyPath[i]] = {};
                            }
                            current = current[propertyPath[i]];
                        }
                        current[propertyPath[propertyPath.length - 1]] = newValue;
                    } else {
                        obj[property] = newValue;
                    }
                    objectFound = true;
                }
            }

            // Also check root level digital_space for consistency
            if (!objectFound && currentJson.digital_space?.digital_objects) {
                const obj = currentJson.digital_space.digital_objects.find(obj => obj.id === objectId);
                if (obj) {
                    const propertyPath = property.split('.');
                    if (propertyPath.length > 1) {
                        let current = obj;
                        for (let i = 0; i < propertyPath.length - 1; i++) {
                            if (!current[propertyPath[i]]) {
                                current[propertyPath[i]] = {};
                            }
                            current = current[propertyPath[i]];
                        }
                        current[propertyPath[propertyPath.length - 1]] = newValue;
                    } else {
                        obj[property] = newValue;
                    }
                    objectFound = true;
                }
            }

            if (objectFound) {
                // CRITICAL: Set flag to prevent timeline re-render
                this.isUpdatingEditor = true;
                window.simulationPlayerUpdatingEditor = true; // Global flag for timeline to check
                
                // Update Monaco editor with the modified JSON
                editor.setValue(JSON.stringify(currentJson, null, 2));
                
                // Reset flags after a delay
                setTimeout(() => {
                    this.isUpdatingEditor = false;
                    window.simulationPlayerUpdatingEditor = false;
                }, 200);
            } else {
                console.warn(`SIMULATION-PLAYER: Object ${objectId} not found in Monaco JSON for property update`);
            }
        } catch (error) {
            console.error('SIMULATION-PLAYER: Error updating Monaco property:', error);
        }
    }

    updateAllObjectStates() {
        this.currentObjectStates.clear();
        Object.entries(this.ui.livePanels).forEach(([objectType, panel]) => {
            this.updateObjectTypeState(objectType, panel);
        });
    }

    getCurrentObjectState(objectId) {
        return this.currentObjectStates.get(objectId);
    }

    updateObjectTypeState(objectType, panel) {
        if (!panel) return;

        const liveObjects = this.worldSnapshot
            ? (this.liveObjects?.[objectType] || [])
            : (this.simData[objectType] || []);
        
        // All object types now use the generic handler for full flexibility
        this.updateGenericObjectTypeState(objectType, panel, liveObjects);
    }


    updateGenericObjectTypeState(objectType, panel, liveObjects) {
        const states = {};
        const propertyOverrides = {};
        const stocks = {};
        
        liveObjects.forEach(obj => { 
            states[obj.id] = obj.properties?.state || 'available';
            propertyOverrides[obj.id] = { ...obj.properties, emoji: obj.emoji, location: obj.location };
            if (obj.properties?.quantity !== undefined) {
                stocks[obj.id] = obj.properties.quantity;
            }
        });

        // Sort objects chronologically by their creation time, then by their id
        const sortedObjects = [...liveObjects].sort((a, b) => {
            const aCreated = this.liveObjects?.created?.find(obj => obj.id === a.id);
            const bCreated = this.liveObjects?.created?.find(obj => obj.id === b.id);
            const aTime = aCreated?.createdAt || 0;
            const bTime = bCreated?.createdAt || 0;
            if (aTime !== bTime) return aTime - bTime;
            return a.id.localeCompare(b.id);
        });

        Object.entries(states).forEach(([objectId, state]) => {
            this.currentObjectStates.set(objectId, state);
        });

        panel.innerHTML = sortedObjects.map(item => {
            const isCreated = this.liveObjects?.created?.find(obj => obj.id === item.id);
            const createdClass = isCreated ? 'created-object' : '';
            const createdTitle = isCreated ? `Created by ${isCreated.createdBy}` : '';
            
            // Apply property overrides from interactions
            const emojiValue = propertyOverrides[item.id]?.emoji ?? item.emoji ?? item.properties?.emoji;
            const currentEmoji = typeof emojiValue === 'string' ? emojiValue.trim() : '';
            const emojiMarkup = currentEmoji ? `<div class="resource-emoji">${currentEmoji}</div>` : '';
            
            // Handle different display formats based on indicator_property
            let stateDisplay;
            const indicatorProperty = item.indicator_property || item.properties?.indicator_property;
            
            if (indicatorProperty) {
                if (Array.isArray(indicatorProperty)) {
                    // Multiple properties to display
                    stateDisplay = indicatorProperty.map(prop => {
                        if (prop === 'quantity' && stocks[item.id] !== undefined) {
                            const unit = item.properties?.unit || '';
                            return `${stocks[item.id].toFixed(2)} ${unit}`;
                        } else if (prop === 'state') {
                            return states[item.id];
                        } else if (propertyOverrides[item.id][prop] !== undefined) {
                            return propertyOverrides[item.id][prop];
                        } else {
                            return item.properties?.[prop] || '';
                        }
                    }).filter(val => val).join(' • ');
                } else {
                    // Single property to display
                    if (indicatorProperty === 'quantity' && stocks[item.id] !== undefined) {
                        const unit = item.properties?.unit || '';
                        stateDisplay = `Stock: ${stocks[item.id].toFixed(2)} ${unit}`;
                    } else if (indicatorProperty === 'state') {
                        stateDisplay = states[item.id];
                    } else if (propertyOverrides[item.id][indicatorProperty] !== undefined) {
                        stateDisplay = propertyOverrides[item.id][indicatorProperty];
                    } else {
                        stateDisplay = item.properties?.[indicatorProperty] || '';
                    }
                }
            } else {
                // Fallback to legacy behavior
                if (stocks[item.id] !== undefined) {
                    // Resource-like objects with quantities
                    const unit = item.properties?.unit || '';
                    stateDisplay = `Stock: ${stocks[item.id].toFixed(2)} ${unit}`;
                } else {
                    // State-based objects (equipment, actors, products, etc.)
                    stateDisplay = states[item.id];
                }
            }
            
            return `
            <div class="resource-item ${createdClass}" title="${createdTitle}" data-object-id="${item.id}" style="cursor: pointer;">
                ${emojiMarkup}
                <div class="resource-info">
                    <div class="resource-name">${item.name || item.id}${isCreated ? ' ✨' : ''}</div>
                    <div class="resource-state ${stocks[item.id] !== undefined ? 'available' : states[item.id]}">${stateDisplay}</div>
                </div>
            </div>
            `;
        }).join("");
        
        // Add click event listeners to generic object items
        panel.querySelectorAll('.resource-item[data-object-id]').forEach(item => {
            item.addEventListener('click', () => {
                const objectId = item.dataset.objectId;
                if (window.handleObjectClick && typeof window.handleObjectClick === 'function') {
                    window.handleObjectClick(objectId, this.playheadTime);
                }
            });
        });
    }

    initScrubbing() {
        let currentScrubTrack = null;
        let rafId = null; // RequestAnimationFrame ID for throttling
        let pendingUpdate = null; // Store pending update data

        const onScrub = (e) => {
            if (!this.isScrubbing || !currentScrubTrack) return;

            // Calculate new time but don't update immediately
            const rect = currentScrubTrack.getBoundingClientRect();
            const percentage = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
            const newTime = this.simData.start_time_minutes + (percentage * this.simData.total_duration_minutes);

            // Store pending update
            pendingUpdate = newTime;

            // Only schedule update if one isn't already pending
            if (!rafId) {
                rafId = requestAnimationFrame(() => {
                    if (pendingUpdate !== null) {
                        this.update(pendingUpdate);
                        pendingUpdate = null;
                    }
                    rafId = null; // Clear ID so next mousemove can schedule
                });
            }
        };

        const startScrubbing = (e, track) => {
            this.isScrubbing = true;
            currentScrubTrack = track;

            // CRITICAL FIX: Set global flag to prevent renderSimulation during scrubbing
            window.simulationPlayerActive = true;

            if (this.isPlaying) this.togglePlay();
            onScrub(e);

            document.addEventListener('mousemove', onScrub);
            document.addEventListener('mouseup', () => {
                this.isScrubbing = false;
                currentScrubTrack = null;

                // Cancel any pending RAF
                if (rafId) {
                    cancelAnimationFrame(rafId);
                    rafId = null;
                }

                // CRITICAL FIX: Clear global flag when scrubbing ends
                window.simulationPlayerActive = false;

                document.removeEventListener('mousemove', onScrub);
            }, { once: true });
        };

        // Add scrubbing to all existing task tracks
        this.attachScrubbing = () => {
            document.querySelectorAll('.task-track').forEach(track => {
                // Remove existing listeners to prevent duplicates
                track.removeEventListener('mousedown', track._scrubHandler);

                // Create and store the handler - only respond to left-clicks on track background
                track._scrubHandler = (e) => {
                    if (e.button === 0 && !e.target.closest('.task-block')) { // Only left-click on background
                        startScrubbing(e, track);
                    }
                };
                track.addEventListener('mousedown', track._scrubHandler);

                // Also make playheads draggable
                const playhead = track.querySelector('.timeline-playhead');
                if (playhead) {
                    playhead.removeEventListener('mousedown', playhead._scrubHandler);
                    playhead._scrubHandler = (e) => {
                        if (e.button === 0) { // Only left-click
                            e.stopPropagation(); // Prevent event bubbling
                            startScrubbing(e, track);
                        }
                    };
                    playhead.addEventListener('mousedown', playhead._scrubHandler);
                    playhead.style.pointerEvents = 'all'; // Make sure playhead is clickable
                }
            });
        };

        // Initial attachment
        this.attachScrubbing();
    }
}
