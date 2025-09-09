class SimulationPlayer {
    constructor(simulationData) {
        this.simData = simulationData;
        this.playheadTime = simulationData.start_time_minutes;
        this.isPlaying = false;
        this.playbackSpeed = 1;
        this.animationFrameId = null;

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
            this.ui.playPauseBtn.addEventListener('click', () => this.togglePlay());
        }
        if (this.ui.speedSelect) {
            this.ui.speedSelect.addEventListener('change', (e) => this.setSpeed(e.target.value));
        }
        this.initScrubbing();
        this.update(this.playheadTime);
    }

    formatTime(minutes) {
        const h = Math.floor(minutes / 60);
        const m = Math.floor(minutes % 60);
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }

    togglePlay() {
        this.isPlaying = !this.isPlaying;
        if (this.ui.playPauseBtn) {
            this.ui.playPauseBtn.textContent = this.isPlaying ? '⏸️' : '▶️';
        }

        if (this.isPlaying) {
            // --- START OF FIX ---
            // If playback is at the end, reset to the beginning.
            if (this.playheadTime >= this.simData.end_time_minutes) {
                this.playheadTime = this.simData.start_time_minutes;
            }
            // Initialize lastFrameTime HERE, right before starting the loop.
            this.lastFrameTime = performance.now();
            // --- END OF FIX ---
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

        // Advance playhead time by simulation minutes (60 sim minutes per real second at 1x speed)
        let timeIncrement = deltaTime * 60 * this.playbackSpeed;
        
        let newTime = this.playheadTime + timeIncrement;

        if (newTime >= this.simData.end_time_minutes) {
            newTime = this.simData.end_time_minutes;
            this.togglePlay(); // Stop playback at the end
        }

        this.update(newTime);
        
        this.animationFrameId = requestAnimationFrame((t) => this.gameLoop(t));
    }

    update(timeInMinutes) {
        this.playheadTime = timeInMinutes;

        // 1. Update Playhead Position
        const percentage = (this.playheadTime - this.simData.start_time_minutes) / this.simData.total_duration_minutes;

        //Remove existing playheads
        document.querySelectorAll('.timeline-playhead').forEach(el => el.remove());

        // Add playhead to each task track                                                                                  │
        document.querySelectorAll('.task-track').forEach(track => {
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

        if (this.attachScrubbing) {
            this.attachScrubbing();
        }

        // 2. Update Time Displays
        const formattedTime = this.formatTime(this.playheadTime);
        if (this.ui.currentTimeDisplay) {
            this.ui.currentTimeDisplay.textContent = formattedTime;
        }
        if (this.ui.liveTimeSpans) {
            this.ui.liveTimeSpans.forEach(span => span.textContent = formattedTime);
        }
        
        // 3. Calculate live object states (including created/deleted objects)
        this.updateLiveObjectState();
        
        // 4. Calculate and Render Live States  
        this.updateAllObjectStates();
    }

    updateLiveObjectState() {
        // Track objects that have been created or deleted at current timeline position
        // Initialize live objects dynamically based on available object types
        this.liveObjects = {
            created: [], // Objects created during simulation
            deleted: [] // Objects deleted during simulation (with their stored state)
        };
        
        // Add all object types dynamically
        Object.keys(this.simData).forEach(key => {
            // Skip non-object-type keys
            if (['tasks', 'start_time', 'end_time', 'start_time_minutes', 'end_time_minutes', 'total_duration_minutes', 'article_title', 'domain'].includes(key)) {
                return;
            }
            
            // Check if this key represents an object type (arrays of objects)
            if (Array.isArray(this.simData[key]) && this.simData[key].length > 0) {
                // Verify it's actually an object type by checking if items have typical object properties
                const firstItem = this.simData[key][0];
                if (firstItem && (firstItem.id || firstItem.type)) {
                    this.liveObjects[key] = [...(this.simData[key] || [])];
                }
            }
        });

        const sortedTasks = [...(this.simData.tasks || [])].sort((a,b) => a.start_minutes - b.start_minutes);
        
        for (const task of sortedTasks) {
            if (task.start_minutes > this.playheadTime) break; // Stop if task hasn't started
            
            const isTaskActive = this.playheadTime >= task.start_minutes && this.playheadTime < task.end_minutes;
            const isTaskCompleted = this.playheadTime >= task.end_minutes;
            
            (task.interactions || []).forEach(interaction => {
                // Handle object creation
                if (interaction.add_objects) {
                    interaction.add_objects.forEach(newObj => {
                        const shouldCreate = isTaskActive || (isTaskCompleted && !interaction.revert_after);
                        
                        if (shouldCreate && !this.liveObjects.created.find(obj => obj.id === newObj.id)) {
                            // Create the object
                            const createdObject = {
                                ...newObj,
                                createdAt: task.start_minutes,
                                createdBy: task.id,
                                emoji: newObj.properties?.emoji || this.getDefaultEmojiForType(newObj.type)
                            };
                            this.liveObjects.created.push(createdObject);
                            
                            // Add to appropriate category dynamically
                            if (newObj.type && this.liveObjects[newObj.type]) {
                                this.liveObjects[newObj.type].push(createdObject);
                            }
                        } else if (!shouldCreate && this.liveObjects.created.find(obj => obj.id === newObj.id)) {
                            // Remove the object (revert creation)
                            this.liveObjects.created = this.liveObjects.created.filter(obj => obj.id !== newObj.id);
                            
                            // Remove from all object type arrays dynamically
                            Object.keys(this.liveObjects).forEach(type => {
                                if (Array.isArray(this.liveObjects[type])) {
                                    this.liveObjects[type] = this.liveObjects[type].filter(obj => obj.id !== newObj.id);
                                }
                            });
                        }
                    });
                }
                
                // Handle object deletion
                if (interaction.remove_objects) {
                    interaction.remove_objects.forEach(objectId => {
                        const shouldDelete = isTaskActive || (isTaskCompleted && !interaction.revert_after);
                        
                        if (shouldDelete && !this.liveObjects.deleted.find(obj => obj.id === objectId)) {
                            // Find and store the object before deletion
                            const toDelete = this.findObjectById(objectId);
                            if (toDelete) {
                                this.liveObjects.deleted.push({
                                    ...toDelete,
                                    deletedAt: task.start_minutes,
                                    deletedBy: task.id
                                });
                                
                                // Remove from live arrays dynamically
                                Object.keys(this.liveObjects).forEach(type => {
                                    if (Array.isArray(this.liveObjects[type])) {
                                        this.liveObjects[type] = this.liveObjects[type].filter(obj => obj.id !== objectId);
                                    }
                                });
                            }
                        } else if (!shouldDelete && this.liveObjects.deleted.find(obj => obj.id === objectId)) {
                            // Restore the object (revert deletion)
                            const deletedObj = this.liveObjects.deleted.find(obj => obj.id === objectId);
                            if (deletedObj) {
                                this.liveObjects.deleted = this.liveObjects.deleted.filter(obj => obj.id !== objectId);
                                
                                // Restore to appropriate category dynamically
                                if (deletedObj.type && this.liveObjects[deletedObj.type]) {
                                    this.liveObjects[deletedObj.type].push(deletedObj);
                                }
                            }
                        }
                    });
                }
            });
        }
    }

    findObjectById(objectId) {
        // Search through all object types dynamically
        for (const [key, objects] of Object.entries(this.simData)) {
            if (Array.isArray(objects)) {
                const found = objects.find(obj => obj && obj.id === objectId);
                if (found) return found;
            }
        }
        
        // Also check created objects
        return (this.liveObjects?.created || []).find(obj => obj.id === objectId);
    }

    getDefaultEmojiForType(type) {
        const defaults = {
            'equipment': '⚙️',
            'resource': '📦',
            'actor': '👤',
            'product': '📋'
        };
        return defaults[type] || '❓';
    }

    updateAllObjectStates() {
        Object.entries(this.ui.livePanels).forEach(([objectType, panel]) => {
            this.updateObjectTypeState(objectType, panel);
        });
    }

    updateObjectTypeState(objectType, panel) {
        if (!panel) return;

        const liveObjects = this.liveObjects?.[objectType] || this.simData[objectType] || [];
        
        // All object types now use the generic handler for full flexibility
        this.updateGenericObjectTypeState(objectType, panel, liveObjects);
    }


    updateGenericObjectTypeState(objectType, panel, liveObjects) {
        // Universal method to handle all object types with backward compatibility
        const states = {};
        const propertyOverrides = {}; // Track all property changes, not just state
        const stocks = {}; // For resource quantity tracking
        
        liveObjects.forEach(obj => { 
            states[obj.id] = obj.properties?.state || (objectType === 'equipment' ? 'undefined' : 'available');
            propertyOverrides[obj.id] = {};
            // Initialize quantities for resource-like objects
            if (obj.properties?.quantity !== undefined) {
                stocks[obj.id] = obj.properties.quantity;
            }
        });

        const sortedTasks = [...(this.simData.tasks || [])].sort((a,b) => a.start_minutes - b.start_minutes);
        
        for (const task of sortedTasks) {
            if (task.start_minutes > this.playheadTime) break; // No need to process future tasks
            
            // Handle old-style equipment_interactions (backward compatibility)
            if (objectType === 'equipment') {
                (task.equipment_interactions || []).forEach(interaction => {
                    const isTaskActive = this.playheadTime >= task.start_minutes && this.playheadTime < task.end_minutes;
                    if (isTaskActive) {
                        states[interaction.id] = interaction.to_state;
                    } else { // Task is finished
                        states[interaction.id] = interaction.revert_after === true ? interaction.from_state : interaction.to_state;
                    }
                });
            }
            
            // Handle old-style consumes/produces (backward compatibility for resources)
            if (objectType === 'resource' && task.end_minutes <= this.playheadTime) {
                // Only account for tasks that have fully completed
                Object.entries(task.consumes || {}).forEach(([resId, amount]) => { 
                    if (stocks[resId] !== undefined) stocks[resId] -= amount; 
                });
                Object.entries(task.produces || {}).forEach(([resId, amount]) => { 
                    if (stocks[resId] !== undefined) stocks[resId] += amount; 
                });
            }
            
            // Handle new-style interactions for all object types
            (task.interactions || []).forEach(interaction => {
                const targetObject = liveObjects?.find(obj => obj.id === interaction.object_id);
                if (targetObject && interaction.property_changes) {
                    const isTaskActive = this.playheadTime >= task.start_minutes && this.playheadTime < task.end_minutes;
                    
                    // Process all property changes
                    Object.entries(interaction.property_changes).forEach(([property, changes]) => {
                        if (changes.to !== undefined) {
                            let newValue;
                            if (isTaskActive) {
                                newValue = changes.to;
                            } else { // Task is finished
                                newValue = interaction.revert_after === true ? changes.from : changes.to;
                            }
                            
                            if (property === 'state') {
                                states[interaction.object_id] = newValue;
                            } else {
                                propertyOverrides[interaction.object_id][property] = newValue;
                            }
                        } else if (changes.delta !== undefined && property === 'quantity') {
                            // Handle delta changes for quantities (only for completed tasks)
                            if (task.end_minutes <= this.playheadTime && stocks[interaction.object_id] !== undefined) {
                                stocks[interaction.object_id] += changes.delta;
                            }
                        }
                    });
                }
            });
        }

        // Sort objects chronologically by their creation time, then by their id
        const sortedObjects = [...liveObjects].sort((a, b) => {
            const aCreated = this.liveObjects?.created?.find(obj => obj.id === a.id);
            const bCreated = this.liveObjects?.created?.find(obj => obj.id === b.id);
            const aTime = aCreated?.createdAt || 0;
            const bTime = bCreated?.createdAt || 0;
            if (aTime !== bTime) return aTime - bTime;
            return a.id.localeCompare(b.id);
        });

        panel.innerHTML = sortedObjects.map(item => {
            const isCreated = this.liveObjects?.created?.find(obj => obj.id === item.id);
            const createdClass = isCreated ? 'created-object' : '';
            const createdTitle = isCreated ? `Created by ${isCreated.createdBy}` : '';
            
            // Apply property overrides from interactions
            const currentEmoji = propertyOverrides[item.id]?.emoji || item.properties?.emoji || item.emoji || "❓";
            
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
                <div class="resource-emoji">${currentEmoji}</div>
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
        let isScrubbing = false;
        let currentScrubTrack = null;

        const onScrub = (e) => {
            if (!isScrubbing || !currentScrubTrack) return;

            const rect = currentScrubTrack.getBoundingClientRect();
            const percentage = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
            const newTime = this.simData.start_time_minutes + (percentage * this.simData.total_duration_minutes);
            this.update(newTime);
        };

        const startScrubbing = (e, track) => {
            isScrubbing = true;
            currentScrubTrack = track;
            if (this.isPlaying) this.togglePlay();
            onScrub(e);

            document.addEventListener('mousemove', onScrub);
            document.addEventListener('mouseup', () => {
                isScrubbing = false;
                currentScrubTrack = null;
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