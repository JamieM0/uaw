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
            liveEquipmentPanel: document.querySelector('#live-equipment-panel .resource-grid'),
            liveResourcesPanel: document.querySelector('#live-resources-panel .resource-grid'),
            liveTimeSpans: document.querySelectorAll('.live-time'),
        };

        this.init();
    }

    init() {
        this.ui.playPauseBtn.addEventListener('click', () => this.togglePlay());
        this.ui.speedSelect.addEventListener('change', (e) => this.setSpeed(e.target.value));
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
        this.ui.playPauseBtn.textContent = this.isPlaying ? '⏸️' : '▶️';

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
        this.ui.currentTimeDisplay.textContent = formattedTime;
        this.ui.liveTimeSpans.forEach(span => span.textContent = formattedTime);
        
        // 3. Calculate and Render Live States
        this.updateEquipmentState();
        this.updateResourceState();
    }

    updateEquipmentState() {
        const states = {};
        this.simData.equipment.forEach(e => { states[e.id] = e.state || 'available'; });

        const sortedTasks = [...(this.simData.tasks || [])].sort((a,b) => a.start_minutes - b.start_minutes);
        
        for (const task of sortedTasks) {
            if (task.start_minutes > this.playheadTime) break; // No need to process future tasks

            (task.equipment_interactions || []).forEach(interaction => {
                const isTaskActive = this.playheadTime >= task.start_minutes && this.playheadTime < task.end_minutes;
                if (isTaskActive) {
                    states[interaction.id] = interaction.to_state;
                } else { // Task is finished
                    states[interaction.id] = interaction.revert_after === true ? interaction.from_state : interaction.to_state;
                }
            });
        }

        this.ui.liveEquipmentPanel.innerHTML = this.simData.equipment.map(item => `
            <div class="resource-item">
                <div class="resource-emoji">${item.emoji || "❓"}</div>
                <div class="resource-info">
                    <div class="resource-name">${item.name || item.id}</div>
                    <div class="resource-state ${states[item.id]}">${states[item.id]}</div>
                </div>
            </div>
        `).join("");
    }

    updateResourceState() {
        if (!this.ui.liveResourcesPanel) return; // Defensive check
        
        const stocks = {};
        // Correctly initialize stock from the new object structure
        this.simData.resources.forEach(r => { 
            stocks[r.id] = r.properties.quantity || 0; 
        });

        const sortedTasks = [...(this.simData.tasks || [])].sort((a,b) => a.start_minutes - b.start_minutes);

        for (const task of sortedTasks) {
            // Stop processing if the task hasn't started yet.
            if (task.start_minutes > this.playheadTime) break;
            
            // Only account for tasks that have fully completed.
            if (task.end_minutes <= this.playheadTime) {
                Object.entries(task.consumes || {}).forEach(([resId, amount]) => { 
                    if (stocks[resId] !== undefined) stocks[resId] -= amount; 
                });
                Object.entries(task.produces || {}).forEach(([resId, amount]) => { 
                    if (stocks[resId] !== undefined) stocks[resId] += amount; 
                });
            }
        }

        // Correctly render the live state using the new object structure
        this.ui.liveResourcesPanel.innerHTML = this.simData.resources.map(resource => `
            <div class="resource-item">
                <div class="resource-emoji">${resource.emoji || "❓"}</div>
                <div class="resource-info">
                    <div class="resource-name">${resource.id}</div>
                    <div class="resource-state available">Stock: ${stocks[resource.id].toFixed(2)} ${resource.properties.unit}</div>
                </div>
            </div>
        `).join("");
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

                // Create and store the handler
                track._scrubHandler = (e) => startScrubbing(e, track);
                track.addEventListener('mousedown', track._scrubHandler);

                // Also make playheads draggable
                const playhead = track.querySelector('.timeline-playhead');
                if (playhead) {
                    playhead.removeEventListener('mousedown', playhead._scrubHandler);
                    playhead._scrubHandler = (e) => {
                        e.stopPropagation(); // Prevent event bubbling
                        startScrubbing(e, track);
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