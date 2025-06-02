class SimulationViewer {
    constructor() {
        this.simulationData = null;
        this.currentTime = 0;
        this.isPlaying = false;
        this.speed = 1;
        this.maxTime = 100;
        this.startTimeMinutes = 0;
        this.endTimeMinutes = 0;
        this.totalDurationMinutes = 0;
        this.animationId = null;
        
        this.init();
    }
    
    init() {
        // Load simulation data from script tag
        this.loadSimulationData();
        
        if (!this.simulationData) {
            console.warn('No simulation data available');
            return;
        }
        
        // Setup time calculations
        this.setupTimeCalculations();
        
        // Initialize UI components
        this.initializeControls();
        this.initializeDisplay();
        
        // Start the simulation at time 0
        this.updateSimulation();
    }
    
    loadSimulationData() {
        const scriptTag = document.getElementById('simulation-data');
        if (scriptTag) {
            try {
                this.simulationData = JSON.parse(scriptTag.textContent);
                console.log('Simulation data loaded:', this.simulationData);
            } catch (e) {
                console.error('Failed to parse simulation data:', e);
            }
        }
    }
    
    setupTimeCalculations() {
        if (!this.simulationData) return;
        
        const startTime = this.simulationData.start_time || "07:00";
        const endTime = this.simulationData.end_time || "18:00";
        
        // Convert times to minutes
        const [startHour, startMin] = startTime.split(':').map(Number);
        const [endHour, endMin] = endTime.split(':').map(Number);
        
        this.startTimeMinutes = startHour * 60 + startMin;
        this.endTimeMinutes = endHour * 60 + endMin;
        this.totalDurationMinutes = this.endTimeMinutes - this.startTimeMinutes;
        
        // Calculate task timings
        if (this.simulationData.tasks) {
            this.simulationData.tasks.forEach(task => {
                const [taskHour, taskMin] = task.start.split(':').map(Number);
                task.start_minutes = taskHour * 60 + taskMin;
                task.end_minutes = task.start_minutes + task.duration;
                task.start_percentage = ((task.start_minutes - this.startTimeMinutes) / this.totalDurationMinutes) * 100;
                task.duration_percentage = (task.duration / this.totalDurationMinutes) * 100;
            });
        }
    }
    
    initializeControls() {
        const playPauseBtn = document.getElementById('play-pause-btn');
        const resetBtn = document.getElementById('reset-btn');
        const speedSlider = document.getElementById('speed-slider');
        const timeSlider = document.getElementById('time-slider');
        
        if (playPauseBtn) {
            playPauseBtn.addEventListener('click', () => this.togglePlayPause());
        }
        
        if (resetBtn) {
            resetBtn.addEventListener('click', () => this.reset());
        }
        
        if (speedSlider) {
            speedSlider.addEventListener('input', (e) => {
                this.speed = parseFloat(e.target.value);
                document.getElementById('speed-display').textContent = `${this.speed}x`;
            });
        }
        
        if (timeSlider) {
            timeSlider.addEventListener('input', (e) => {
                this.currentTime = parseFloat(e.target.value);
                this.updateSimulation();
            });
        }
    }
    
    initializeDisplay() {
        this.renderTimeline();
        this.renderActors();
        this.renderResources();
    }
    
    renderTimeline() {
        const container = document.getElementById('timeline-container');
        if (!container || !this.simulationData.tasks) return;
        
        const html = `
            <div class="timeline-track">
                ${this.simulationData.tasks.map(task => `
                    <div class="timeline-task" 
                         data-task-id="${task.id}"
                         style="left: ${task.start_percentage}%; width: ${task.duration_percentage}%;"
                         title="${task.id}: ${task.start} - ${this.formatTime(task.end_minutes)} (${task.duration}min)">
                        <span class="task-label">${task.id}</span>
                    </div>
                `).join('')}
                <div class="timeline-cursor" id="timeline-cursor"></div>
            </div>
            <div class="timeline-axis">
                ${this.generateTimeMarkers()}
            </div>
        `;
        
        container.innerHTML = html;
    }
    
    renderActors() {
        const container = document.getElementById('actors-container');
        if (!container || !this.simulationData.actors) return;
        
        const html = this.simulationData.actors.map(actor => `
            <div class="actor-card" data-actor-id="${actor.id}">
                <div class="actor-header">
                    <h5>${actor.role}</h5>
                    <span class="actor-status" id="status-${actor.id}">Idle</span>
                </div>
                <div class="actor-details">
                    <div>Cost: $${actor.cost_per_hour}/hr</div>
                    <div>Utilization: ${actor.utilization_percentage || 0}%</div>
                    <div class="current-task" id="task-${actor.id}">No active task</div>
                </div>
            </div>
        `).join('');
        
        container.innerHTML = html;
    }
    
    renderResources() {
        const container = document.getElementById('resources-container');
        if (!container || !this.simulationData.resources) return;
        
        // Calculate resource consumption over time
        this.calculateResourceUsage();
        
        const html = this.simulationData.resources.map(resource => `
            <div class="resource-card" data-resource-id="${resource.id}">
                <div class="resource-header">
                    <h5>${resource.id.replace(/_/g, ' ')}</h5>
                    <span class="resource-unit">${resource.unit}</span>
                </div>
                <div class="resource-bar">
                    <div class="resource-fill" id="fill-${resource.id}"></div>
                    <span class="resource-amount" id="amount-${resource.id}">
                        ${resource.starting_stock} ${resource.unit}
                    </span>
                </div>
                <div class="resource-starting">
                    Starting: ${resource.starting_stock} ${resource.unit}
                </div>
            </div>
        `).join('');
        
        container.innerHTML = html;
    }
    
    calculateResourceUsage() {
        if (!this.simulationData.resources || !this.simulationData.tasks) return;
        
        // Initialize tracking for each resource
        this.simulationData.resources.forEach(resource => {
            resource.currentStock = resource.starting_stock;
            resource.usageHistory = [];
        });
        
        // Process tasks chronologically to track resource changes
        const sortedTasks = [...this.simulationData.tasks].sort((a, b) => a.start_minutes - b.start_minutes);
        
        sortedTasks.forEach(task => {
            // Process consumed resources
            if (task.consumes) {
                Object.entries(task.consumes).forEach(([resourceId, amount]) => {
                    const resource = this.simulationData.resources.find(r => r.id === resourceId);
                    if (resource) {
                        resource.usageHistory.push({
                            time: task.start_minutes,
                            change: -amount,
                            taskId: task.id
                        });
                    }
                });
            }
            
            // Process produced resources
            if (task.produces) {
                Object.entries(task.produces).forEach(([resourceId, amount]) => {
                    const resource = this.simulationData.resources.find(r => r.id === resourceId);
                    if (resource) {
                        resource.usageHistory.push({
                            time: task.end_minutes,
                            change: amount,
                            taskId: task.id
                        });
                    }
                });
            }
        });
    }
    
    generateTimeMarkers() {
        const markers = [];
        const intervalMinutes = Math.max(60, Math.floor(this.totalDurationMinutes / 8)); // Show ~8 markers
        
        for (let minutes = this.startTimeMinutes; minutes <= this.endTimeMinutes; minutes += intervalMinutes) {
            const percentage = ((minutes - this.startTimeMinutes) / this.totalDurationMinutes) * 100;
            const timeStr = this.formatTime(minutes);
            markers.push(`<div class="time-marker" style="left: ${percentage}%;">${timeStr}</div>`);
        }
        
        return markers.join('');
    }
    
    formatTime(minutes) {
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
    }
    
    getCurrentTimeMinutes() {
        return this.startTimeMinutes + (this.currentTime / 100) * this.totalDurationMinutes;
    }
    
    updateSimulation() {
        const currentMinutes = this.getCurrentTimeMinutes();
        
        // Update time display
        const timeDisplay = document.getElementById('time-display');
        if (timeDisplay) {
            timeDisplay.textContent = this.formatTime(Math.floor(currentMinutes));
        }
        
        // Update time slider
        const timeSlider = document.getElementById('time-slider');
        if (timeSlider && !timeSlider.matches(':focus')) {
            timeSlider.value = this.currentTime;
        }
        
        // Update timeline cursor
        const cursor = document.getElementById('timeline-cursor');
        if (cursor) {
            cursor.style.left = `${this.currentTime}%`;
        }
        
        // Update actor statuses
        this.updateActorStatuses(currentMinutes);
        
        // Update resource levels
        this.updateResourceLevels(currentMinutes);
        
        // Update task highlights
        this.updateTaskHighlights(currentMinutes);
    }
    
    updateActorStatuses(currentMinutes) {
        if (!this.simulationData.actors || !this.simulationData.tasks) return;
        
        this.simulationData.actors.forEach(actor => {
            const statusElement = document.getElementById(`status-${actor.id}`);
            const taskElement = document.getElementById(`task-${actor.id}`);
            
            // Find current task for this actor
            const currentTask = this.simulationData.tasks.find(task => 
                task.actor_id === actor.id && 
                currentMinutes >= task.start_minutes && 
                currentMinutes <= task.end_minutes
            );
            
            if (currentTask) {
                if (statusElement) {
                    statusElement.textContent = 'Working';
                    statusElement.className = 'actor-status working';
                }
                if (taskElement) {
                    taskElement.textContent = `Task: ${currentTask.id}`;
                }
            } else {
                if (statusElement) {
                    statusElement.textContent = 'Idle';
                    statusElement.className = 'actor-status idle';
                }
                if (taskElement) {
                    taskElement.textContent = 'No active task';
                }
            }
        });
    }
    
    updateResourceLevels(currentMinutes) {
        if (!this.simulationData.resources) return;
        
        this.simulationData.resources.forEach(resource => {
            let currentStock = resource.starting_stock;
            
            // Apply all usage changes up to current time
            if (resource.usageHistory) {
                resource.usageHistory.forEach(change => {
                    if (change.time <= currentMinutes) {
                        currentStock += change.change;
                    }
                });
            }
            
            // Ensure stock doesn't go negative
            currentStock = Math.max(0, currentStock);
            
            // Update UI
            const fillElement = document.getElementById(`fill-${resource.id}`);
            const amountElement = document.getElementById(`amount-${resource.id}`);
            
            if (fillElement) {
                const percentage = (currentStock / resource.starting_stock) * 100;
                fillElement.style.width = `${Math.max(0, percentage)}%`;
                
                // Color coding
                if (percentage > 50) {
                    fillElement.className = 'resource-fill high';
                } else if (percentage > 20) {
                    fillElement.className = 'resource-fill medium';
                } else {
                    fillElement.className = 'resource-fill low';
                }
            }
            
            if (amountElement) {
                amountElement.textContent = `${currentStock.toFixed(1)} ${resource.unit}`;
            }
        });
    }
    
    updateTaskHighlights(currentMinutes) {
        if (!this.simulationData.tasks) return;
        
        this.simulationData.tasks.forEach(task => {
            const taskElement = document.querySelector(`[data-task-id="${task.id}"]`);
            if (taskElement) {
                const isActive = currentMinutes >= task.start_minutes && currentMinutes <= task.end_minutes;
                const isCompleted = currentMinutes > task.end_minutes;
                
                taskElement.className = 'timeline-task';
                if (isActive) {
                    taskElement.classList.add('active');
                } else if (isCompleted) {
                    taskElement.classList.add('completed');
                }
            }
        });
    }
    
    togglePlayPause() {
        const btn = document.getElementById('play-pause-btn');
        
        if (this.isPlaying) {
            this.pause();
            if (btn) btn.textContent = '▶️ Play';
        } else {
            this.play();
            if (btn) btn.textContent = '⏸️ Pause';
        }
    }
    
    play() {
        this.isPlaying = true;
        this.animate();
    }
    
    pause() {
        this.isPlaying = false;
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }
    }
    
    reset() {
        this.pause();
        this.currentTime = 0;
        this.updateSimulation();
        
        const btn = document.getElementById('play-pause-btn');
        if (btn) btn.textContent = '▶️ Play';
    }
    
    animate() {
        if (!this.isPlaying) return;
        
        // Advance time based on speed
        this.currentTime += this.speed * 0.5; // Adjust speed factor as needed
        
        if (this.currentTime >= 100) {
            this.currentTime = 100;
            this.pause();
            const btn = document.getElementById('play-pause-btn');
            if (btn) btn.textContent = '▶️ Play';
        }
        
        this.updateSimulation();
        
        if (this.isPlaying) {
            this.animationId = requestAnimationFrame(() => this.animate());
        }
    }
}

// Initialize simulation viewer when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Only initialize if simulation container exists
    if (document.getElementById('simulation-container')) {
        new SimulationViewer();
    }
});
