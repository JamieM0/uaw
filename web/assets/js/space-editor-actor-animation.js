// Space Editor Actor Animation - RimWorld-style actor movement visualization
// Universal Automation Wiki - Simulation Playground

/**
 * ActorAnimationManager
 *
 * Manages animated actor visualization on the Space Editor canvas during simulation playback.
 * Actors appear as emoji characters and move at constant speed between locations based on task transitions.
 */
class ActorAnimationManager {
    constructor(spaceEditor) {
        this.spaceEditor = spaceEditor;
        this.enabled = false;
        this.simulationData = null;
        this.actors = new Map(); // Map<actorId, ActorState>
        this.transitions = new Map(); // Map<actorId, Transition[]>
        this.actorElements = new Map(); // Map<actorId, HTMLElement>
        this.locationCache = new Map(); // Map<locationId, {x, y, width, height}>
        this.animationFrameId = null;
        this.currentTime = 0; // Current simulation time in minutes
        this.isPlaying = false;

        // Constants
        this.EMOJI_SIZE = 24; // Font size in pixels
        this.MIN_TRANSITION_DURATION = 3; // Minimum seconds for fast transitions
        this.ACTOR_MARGIN = 8; // Margin from the top-left corner of locations
        this.ACTOR_SPACING = 28; // Spacing between actors in the same location

        this.init();
    }

    init() {
        // Listen to checkbox state
        const checkbox = document.getElementById('show-actors-during-playback');
        if (checkbox) {
            // Restore saved state from localStorage
            const savedState = localStorage.getItem('showActorsDuringPlayback');
            if (savedState === 'true') {
                checkbox.checked = true;
                this.enabled = true;
                // Delay enabling to ensure everything is loaded
                setTimeout(() => this.onEnable(), 500);
            }

            checkbox.addEventListener('change', (e) => {
                this.enabled = e.target.checked;
                // Save state to localStorage
                localStorage.setItem('showActorsDuringPlayback', this.enabled);

                if (this.enabled) {
                    this.onEnable();
                } else {
                    this.onDisable();
                }
            });
        }

        // Listen to playback events from SimulationPlayer
        this.setupPlaybackListeners();

        // Listen for tab changes to show/hide actors when Space Editor tab is active
        this.setupTabListener();
    }

    setupTabListener() {
        // Monitor when the Space Editor tab becomes active/inactive
        const spaceEditorTab = document.getElementById('space-editor-tab');
        if (!spaceEditorTab) return;

        const observer = new MutationObserver(() => {
            const isActive = spaceEditorTab.classList.contains('active');
            if (isActive && this.enabled) {
                // Tab just became active - ensure actors are visible
                this.updateActorPositions();
            }
        });

        observer.observe(spaceEditorTab, {
            attributes: true,
            attributeFilter: ['class']
        });
    }

    setupPlaybackListeners() {
        // Listen for when the player is created/updated
        document.addEventListener('simulation-rendered', () => {
            if (this.enabled) {
                this._loadAttempted = false; // Reset so we reload data
                this.loadSimulationData();
                this.startAnimationLoop();
            }
        });

        // Also listen for editor content changes to reload simulation data
        const checkEditorInterval = setInterval(() => {
            if (window.editor) {
                clearInterval(checkEditorInterval);
                window.editor.onDidChangeModelContent(() => {
                    if (this.enabled) {
                        // Debounce the reload
                        clearTimeout(this.reloadTimeout);
                        this.reloadTimeout = setTimeout(() => {
                            this._loadAttempted = false;
                            this.loadSimulationData();
                        }, 500);
                    }
                });
            }
        }, 100);
    }

    onEnable() {
        if (!this.spaceEditor) {
            // Try to get from window
            if (window.spaceEditor) {
                this.spaceEditor = window.spaceEditor;
            }
        }

        // Reset load attempted flag
        this._loadAttempted = false;

        // Load simulation data and prepare actors
        this.loadSimulationData();

        // Always start the animation loop - it will wait for player if needed
        this.startAnimationLoop();

        // If player exists and we have actors, update positions immediately
        if (window.player && this.actors.size > 0) {
            this.updateActorPositions();
        }
    }

    onDisable() {
        // Remove all actor elements
        this.clearActors();

        // Stop animation loop
        this.stopAnimationLoop();
    }

    loadSimulationData() {
        try {
            // Get simulation data from Monaco editor
            if (!window.editor) {
                return false;
            }

            const jsonText = window.editor.getValue();
            if (!jsonText || jsonText.trim() === '') {
                return false;
            }

            const data = JSON.parse(stripJsonComments(jsonText));

            if (!data.simulation) {
                return false;
            }

            this.simulationData = data.simulation;

            // Pre-compute transitions for all actors
            this.precomputeTransitions();

            // Initialize actor visual elements
            this.initializeActorElements();

            return this.actors.size > 0;
        } catch (e) {
            console.warn('ActorAnimation: Failed to load simulation data', e);
            return false;
        }
    }

    precomputeTransitions() {
        if (!this.simulationData || !this.simulationData.objects || !this.simulationData.tasks) {
            return;
        }

        this.actors.clear();
        this.transitions.clear();

        const objects = this.simulationData.objects;
        const tasks = this.simulationData.tasks;

        // Find all actors (objects that have tasks)
        const actorsInTasks = new Set();
        tasks.forEach(task => {
            if (task.actor_id) {
                actorsInTasks.add(task.actor_id);
            }
        });

        // Initialize actor states
        actorsInTasks.forEach(actorId => {
            const actorObj = objects.find(obj => obj.id === actorId);
            if (actorObj) {
                // Get initial location from object properties or first task
                const initialLocation = actorObj.properties?.location || null;

                this.actors.set(actorId, {
                    id: actorId,
                    name: actorObj.name || actorId,
                    emoji: actorObj.properties?.emoji || this.getDefaultEmoji(actorObj.type),
                    currentLocation: initialLocation,
                    currentPosition: null, // Will be set when location is resolved
                    type: actorObj.type
                });
            }
        });

        // Compute transitions for each actor
        this.actors.forEach((actor, actorId) => {
            const actorTransitions = this.computeActorTransitions(actorId, tasks);
            this.transitions.set(actorId, actorTransitions);
        });
    }

    computeActorTransitions(actorId, tasks) {
        const transitions = [];

        // Get all tasks for this actor, sorted by start time
        const actorTasks = tasks
            .filter(task => task.actor_id === actorId)
            .sort((a, b) => this.parseTime(a.start) - this.parseTime(b.start));

        if (actorTasks.length === 0) {
            return transitions;
        }

        // Compute transitions between consecutive tasks
        for (let i = 0; i < actorTasks.length; i++) {
            const currentTask = actorTasks[i];
            const currentStartTime = this.parseTime(currentTask.start);
            const currentEndTime = currentStartTime + (currentTask.duration || 0);
            const currentLocation = currentTask.location;

            // If there's a next task, create transition
            if (i < actorTasks.length - 1) {
                const nextTask = actorTasks[i + 1];
                const nextStartTime = this.parseTime(nextTask.start);
                const nextLocation = nextTask.location;

                // Only create transition if locations differ
                if (currentLocation !== nextLocation) {
                    const transitionDuration = nextStartTime - currentEndTime;

                    transitions.push({
                        fromLocation: currentLocation,
                        toLocation: nextLocation,
                        startTime: currentEndTime,
                        endTime: nextStartTime,
                        duration: transitionDuration,
                        fromPosition: null, // Will be computed when canvas positions are resolved
                        toPosition: null,
                        speed: null // pixels per minute
                    });
                }
            }
        }

        return transitions;
    }

    parseTime(timeStr) {
        if (typeof timeStr === 'number') {
            return timeStr;
        }

        // Parse HH:MM format
        const parts = timeStr.split(':');
        if (parts.length === 2) {
            const hours = parseInt(parts[0], 10);
            const minutes = parseInt(parts[1], 10);
            return hours * 60 + minutes;
        }

        return 0;
    }

    getDefaultEmoji(objectType) {
        const defaults = {
            'actor': '👤',
            'equipment': '⚙️',
            'resource': '📦',
            'product': '📦'
        };
        return defaults[objectType] || '👤';
    }

    initializeActorElements() {
        // Clear existing elements
        this.clearActors();

        // Check if space editor and world exist
        if (!this.spaceEditor) {
            // Try to get spaceEditor from window
            if (window.spaceEditor) {
                this.spaceEditor = window.spaceEditor;
            } else {
                console.warn('ActorAnimation: No spaceEditor available');
                return;
            }
        }

        if (!this.spaceEditor.world) {
            console.warn('ActorAnimation: No spaceEditor.world available');
            return;
        }

        // Create DOM elements for each actor
        this.actors.forEach((actor, actorId) => {
            const element = document.createElement('div');
            element.className = 'actor-emoji';
            element.textContent = actor.emoji;
            element.style.cssText = `
                font-size: ${this.EMOJI_SIZE}px;
                position: absolute;
                pointer-events: none;
                z-index: 1000;
                transition: none;
                display: none;
            `;
            element.title = actor.name;

            // Add to space world (the transformable container)
            this.spaceEditor.world.appendChild(element);
            this.actorElements.set(actorId, element);
        });

        console.log(`ActorAnimation: Initialized ${this.actorElements.size} actor elements`);
    }

    clearActors() {
        this.actorElements.forEach(element => {
            if (element.parentNode) {
                element.parentNode.removeChild(element);
            }
        });
        this.actorElements.clear();
    }

    startAnimationLoop() {
        // Don't start a new loop if one is already running
        if (this.animationFrameId) {
            return;
        }

        let lastUpdateTime = null;

        const animate = (timestamp) => {
            // Stop the loop if disabled
            if (!this.enabled) {
                this.animationFrameId = null;
                return;
            }

            // Get current time from player if available
            if (window.player && typeof window.player.playheadTime === 'number') {
                const newTime = window.player.playheadTime;
                this.isPlaying = window.player.isPlaying;

                // Only update if time has changed (prevents unnecessary updates when paused)
                if (newTime !== lastUpdateTime) {
                    lastUpdateTime = newTime;
                    this.currentTime = newTime;
                    this.updateActorPositions();
                }
            }

            // Continue loop using requestAnimationFrame for smooth animation
            this.animationFrameId = requestAnimationFrame(animate);
        };

        // Start the animation loop
        this.animationFrameId = requestAnimationFrame(animate);
    }

    stopAnimationLoop() {
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
        // Clear any pending reload timeout
        if (this.reloadTimeout) {
            clearTimeout(this.reloadTimeout);
            this.reloadTimeout = null;
        }
    }

    updateActorPositions() {
        if (!this.enabled) {
            return;
        }

        // If we don't have actors yet, try to load them (but only once per animation cycle)
        if (this.actors.size === 0 && !this._loadAttempted) {
            this._loadAttempted = true;
            const loaded = this.loadSimulationData();
            if (this.actors.size === 0) {
                return; // Still no actors, nothing to do
            }
        }

        // If we still don't have actor elements, skip
        if (this.actorElements.size === 0) {
            return;
        }

        // Check if actor elements were removed from DOM (e.g., by loadLayout clearing world)
        // If so, reinitialize them
        let elementsInDOM = 0;
        this.actorElements.forEach(element => {
            if (element.parentNode) {
                elementsInDOM++;
            }
        });

        if (elementsInDOM === 0 && this.actorElements.size > 0) {
            // All elements were removed - reinitialize
            this.initializeActorElements();
        }

        // Resolve canvas positions for locations
        this.resolveCanvasPositions();

        // Track actors at each location for stacking
        const actorsAtLocation = new Map();
        const transitingActors = [];

        // First pass: categorize all actors
        this.actors.forEach((actor, actorId) => {
            const element = this.actorElements.get(actorId);
            if (!element) {
                return;
            }

            // Ensure element is in the DOM
            if (!element.parentNode) {
                if (this.spaceEditor && this.spaceEditor.world) {
                    this.spaceEditor.world.appendChild(element);
                } else {
                    return;
                }
            }

            // Determine actor's current state at this time
            const state = this.getActorStateAtTime(actorId, this.currentTime);

            // DEBUG: Log when state is null or has no position
            if (!state || !state.position) {
                console.log(`ActorAnimation DEBUG: Actor ${actorId} at time ${this.currentTime} - state:`, state, 'position:', state?.position);
                element.style.display = 'none';
                return;
            }

            if (state.isTransitioning) {
                transitingActors.push({ actorId, element, actor, state });
            } else {
                const locationId = state.currentLocationId || 'unknown';
                if (!actorsAtLocation.has(locationId)) {
                    actorsAtLocation.set(locationId, { actors: [], basePosition: state.position });
                }
                actorsAtLocation.get(locationId).actors.push({ actorId, element, actor, state });
            }
        });

        // Position transiting actors (moving between locations)
        transitingActors.forEach(({ element, state }) => {
            element.style.display = 'block';
            element.style.left = `${state.position.x}px`;
            element.style.top = `${state.position.y}px`;
            element.style.transform = 'none';
        });

        // Position stationary actors with stacking
        actorsAtLocation.forEach(({ actors, basePosition }) => {
            actors.forEach(({ element }, index) => {
                element.style.display = 'block';
                const offsetY = index * this.ACTOR_SPACING;
                element.style.left = `${basePosition.x}px`;
                element.style.top = `${basePosition.y + offsetY}px`;
                element.style.transform = 'none';
            });
        });
    }

    resolveCanvasPositions() {
        if (!this.simulationData || !this.simulationData.layout) {
            return;
        }

        const locations = this.simulationData.layout.locations || [];

        // Clear and rebuild location cache
        this.locationCache.clear();

        locations.forEach(loc => {
            if (loc.shape && loc.shape.type === 'rect') {
                // Store full location bounds for positioning actors in top-left
                this.locationCache.set(loc.id, {
                    x: loc.shape.x,
                    y: loc.shape.y,
                    width: loc.shape.width,
                    height: loc.shape.height
                });
            }
        });

        // Update transition positions - use top-left corners for start/end of transitions
        this.transitions.forEach((actorTransitions, actorId) => {
            actorTransitions.forEach(transition => {
                if (!transition.fromPosition && transition.fromLocation) {
                    const fromPos = this.getLocationPosition(transition.fromLocation);
                    if (fromPos) {
                        transition.fromPosition = { x: fromPos.x, y: fromPos.y };
                    }
                }

                if (!transition.toPosition && transition.toLocation) {
                    const toPos = this.getLocationPosition(transition.toLocation);
                    if (toPos) {
                        transition.toPosition = { x: toPos.x, y: toPos.y };
                    }
                }

                // Calculate speed if positions are available
                if (transition.fromPosition && transition.toPosition && !transition.speed) {
                    const dx = transition.toPosition.x - transition.fromPosition.x;
                    const dy = transition.toPosition.y - transition.fromPosition.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);

                    // Speed in pixels per minute
                    const durationMinutes = transition.duration;
                    if (durationMinutes > 0) {
                        transition.speed = distance / durationMinutes;
                    } else {
                        // Instant transition - use minimum duration
                        const minDurationMinutes = this.MIN_TRANSITION_DURATION / 60;
                        transition.speed = distance / minDurationMinutes;
                        transition.duration = minDurationMinutes;
                        transition.endTime = transition.startTime + minDurationMinutes;
                    }
                }
            });
        });
    }

    getActorStateAtTime(actorId, time) {
        const actor = this.actors.get(actorId);
        const actorTransitions = this.transitions.get(actorId);

        if (!actor || !actorTransitions || !this.simulationData) {
            console.log(`ActorAnimation DEBUG: getActorStateAtTime - Missing data for ${actorId}:`, {
                hasActor: !!actor,
                hasTransitions: !!actorTransitions,
                hasSimData: !!this.simulationData
            });
            return null;
        }

        // Check if actor is in a transition
        for (const transition of actorTransitions) {
            if (time >= transition.startTime && time <= transition.endTime) {
                // Actor is transitioning
                if (!transition.fromPosition || !transition.toPosition) {
                    console.log(`ActorAnimation DEBUG: Transition has no positions for ${actorId} at ${time}:`, transition);
                    continue; // Skip if positions not resolved
                }

                // Calculate progress (0 to 1)
                const progress = (time - transition.startTime) / transition.duration;

                // Linear interpolation for constant speed movement
                const x = transition.fromPosition.x + (transition.toPosition.x - transition.fromPosition.x) * progress;
                const y = transition.fromPosition.y + (transition.toPosition.y - transition.fromPosition.y) * progress;

                console.log(`ActorAnimation DEBUG: Actor ${actorId} transitioning at ${time}, progress: ${progress.toFixed(2)}`);
                return {
                    position: { x, y },
                    isTransitioning: true,
                    currentLocationId: null // Actor is between locations
                };
            }
        }

        // Not transitioning - find current location from tasks
        const tasks = this.simulationData.tasks || [];
        const actorTasks = tasks
            .filter(task => task.actor_id === actorId)
            .sort((a, b) => this.parseTime(a.start) - this.parseTime(b.start));

        console.log(`ActorAnimation DEBUG: Checking ${actorTasks.length} tasks for ${actorId} at time ${time}`);

        // Find the task that contains current time
        for (const task of actorTasks) {
            const taskStart = this.parseTime(task.start);
            const taskEnd = taskStart + (task.duration || 0);

            if (time >= taskStart && time < taskEnd) {
                // Actor is performing this task
                const location = task.location;
                const position = this.getLocationPosition(location);

                if (position) {
                    console.log(`ActorAnimation DEBUG: Actor ${actorId} performing task at ${location}`);
                    return {
                        position,
                        isTransitioning: false,
                        currentLocationId: location,
                        currentTask: task
                    };
                } else {
                    console.log(`ActorAnimation DEBUG: No position found for location ${location}`);
                }
            }
        }

        // If no current task, use the location from the last completed task
        for (let i = actorTasks.length - 1; i >= 0; i--) {
            const task = actorTasks[i];
            const taskEnd = this.parseTime(task.start) + (task.duration || 0);

            if (time >= taskEnd) {
                const location = task.location;
                const position = this.getLocationPosition(location);

                if (position) {
                    console.log(`ActorAnimation DEBUG: Actor ${actorId} at last completed task location ${location}`);
                    return {
                        position,
                        isTransitioning: false,
                        currentLocationId: location
                    };
                } else {
                    console.log(`ActorAnimation DEBUG: No position for last task location ${location}`);
                }
            }
        }

        // Actor hasn't started any tasks yet - use initial location
        const initialLocation = actor.currentLocation;
        if (initialLocation) {
            const position = this.getLocationPosition(initialLocation);
            if (position) {
                console.log(`ActorAnimation DEBUG: Actor ${actorId} at initial location ${initialLocation}`);
                return {
                    position,
                    isTransitioning: false,
                    currentLocationId: initialLocation
                };
            } else {
                console.log(`ActorAnimation DEBUG: No position for initial location ${initialLocation}`);
            }
        }

        console.log(`ActorAnimation DEBUG: No state found for actor ${actorId} at time ${time}`);
        return null;
    }

    getLocationPosition(locationId) {
        if (!locationId) {
            return null;
        }

        // First check the cache for exact match
        const cached = this.locationCache.get(locationId);
        if (cached) {
            // Return top-left corner with margin
            return {
                x: cached.x + this.ACTOR_MARGIN,
                y: cached.y + this.ACTOR_MARGIN
            };
        }

        // Try partial matching (e.g., "warehouse" matches "warehouse_floor")
        for (const [locId, locData] of this.locationCache.entries()) {
            if (locId.includes(locationId) || locationId.includes(locId)) {
                return {
                    x: locData.x + this.ACTOR_MARGIN,
                    y: locData.y + this.ACTOR_MARGIN
                };
            }
        }

        // Fallback to reading from simulation data
        if (!this.simulationData || !this.simulationData.layout) {
            return null;
        }

        const locations = this.simulationData.layout.locations || [];
        
        // Try exact match first
        let location = locations.find(loc => loc.id === locationId);
        
        // Try partial match if exact match fails
        if (!location) {
            location = locations.find(loc => 
                loc.id.includes(locationId) || locationId.includes(loc.id)
            );
        }

        if (location && location.shape && location.shape.type === 'rect') {
            // Return top-left corner with margin
            return {
                x: location.shape.x + this.ACTOR_MARGIN,
                y: location.shape.y + this.ACTOR_MARGIN
            };
        }

        return null;
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {

    // Wait for spaceEditor to be initialized
    const initInterval = setInterval(() => {
        if (window.spaceEditor) {
            window.actorAnimationManager = new ActorAnimationManager(window.spaceEditor);
            clearInterval(initInterval);
        }
    }, 100);
});
