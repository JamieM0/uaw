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
    
    // Helper function to escape HTML to prevent XSS
    escapeHtml(text) {
        if (typeof text !== 'string') {
            return text;
        }
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, function(m) { return map[m]; });
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
                // Scale the speed so that 1x on the slider equals the old 0.2x speed
                const sliderValue = parseFloat(e.target.value);
                this.speed = sliderValue * 0.2;
                
                const speedDisplay = document.getElementById('speed-display');
                if (speedDisplay) {
                    speedDisplay.textContent = `${sliderValue}x`;
                }
            });
            
            // Initialize speed display
            const speedDisplay = document.getElementById('speed-display');
            if (speedDisplay) {
                speedDisplay.textContent = `${speedSlider.value}x`;
            }
            
            // Set initial playback speed (1x on slider = 0.2x actual speed)
            this.speed = parseFloat(speedSlider.value) * 0.2;
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
        
        // Initialize the time indicator
        this.updateTimeIndicator(this.getCurrentTimeMinutes());
    }
    
    renderTimeline() {
        const container = document.getElementById('timeline-actors-container');
        if (!container) return;

        const { actors, tasks, start_time_minutes, end_time_minutes } = this.simulationData;
        const totalDuration = end_time_minutes - start_time_minutes;

        // Clear existing content
        container.innerHTML = '';

        // Create time axis markers
        const timeAxisContainer = document.querySelector('.timeline-time-axis');
        if (timeAxisContainer) {
            timeAxisContainer.innerHTML = '';
            const markersDiv = document.createElement('div');
            markersDiv.className = 'timeline-time-markers';
            
            // Add time markers (every 2 hours)
            for (let i = 0; i <= totalDuration; i += 120) {
                const timeMinutes = start_time_minutes + i;
                const hours = Math.floor(timeMinutes / 60);
                const minutes = timeMinutes % 60;
                const timeStr = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
                
                const marker = document.createElement('span');
                marker.textContent = timeStr;
                marker.style.position = 'absolute';
                marker.style.left = `${(i / totalDuration) * 100}%`;
                marker.style.transform = 'translateX(-50%)';
                markersDiv.appendChild(marker);
            }
            
            timeAxisContainer.appendChild(markersDiv);
        }

        // Group tasks by actor
        const tasksByActor = {};
        actors.forEach(actor => {
            tasksByActor[actor.id] = {
                actor: actor,
                tasks: tasks.filter(task => task.actor_id === actor.id)
            };
        });

        // Create timeline row for each actor
        Object.values(tasksByActor).forEach(({ actor, tasks: actorTasks }) => {
            const rowDiv = document.createElement('div');
            rowDiv.className = 'actor-timeline-row';
            rowDiv.setAttribute('data-actor', actor.id);

            // Actor label
            const labelDiv = document.createElement('div');
            labelDiv.className = 'actor-label';
            labelDiv.textContent = actor.role || actor.id;
            rowDiv.appendChild(labelDiv);

            // Tasks container
            const tasksContainer = document.createElement('div');
            tasksContainer.className = 'actor-tasks-container';

            // Add tasks for this actor
            actorTasks.forEach(task => {
                const taskDiv = document.createElement('div');
                taskDiv.className = 'task-block';
                taskDiv.setAttribute('data-task-id', task.id);

                // Calculate position and width
                const startPercent = ((task.start_minutes - start_time_minutes) / totalDuration) * 100;
                const widthPercent = (task.duration / totalDuration) * 100;

                taskDiv.style.left = `${startPercent}%`;
                taskDiv.style.width = `${widthPercent}%`;

                // Task content - use emoji if available, otherwise formatted task name
                let taskDisplayContent;
                if (task.emoji) {
                    taskDisplayContent = task.emoji;
                    taskDiv.title = task.display_name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                } else {
                    taskDisplayContent = task.id.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                }
                taskDiv.textContent = taskDisplayContent;

                // Set task state based on current time
                if (this.currentTime >= task.end_minutes) {
                    taskDiv.classList.add('completed');
                } else if (this.currentTime >= task.start_minutes && this.currentTime < task.end_minutes) {
                    taskDiv.classList.add('active');
                }

                // Add tooltip on hover
                taskDiv.addEventListener('mouseenter', (e) => {
                    this.showTaskTooltip(e, task);
                });

                taskDiv.addEventListener('mouseleave', this.hideTaskTooltip);

                tasksContainer.appendChild(taskDiv);
            });

            rowDiv.appendChild(tasksContainer);
            container.appendChild(rowDiv);
        });
    }

    showTaskTooltip(event, task) {
        const tooltip = document.createElement('div');
        tooltip.className = 'task-tooltip show';
        
        const startTime = this.formatTime(task.start_minutes);
        const endTime = this.formatTime(task.end_minutes);
        const duration = task.duration;
        
        // Escape all user-controlled data to prevent XSS
        // Use display_name if available (without emoji), otherwise use full id
        const taskDisplayName = task.display_name ? task.display_name.replace(/_/g, ' ') : task.id.replace(/_/g, ' ');
        const escTaskId = this.escapeHtml(taskDisplayName);
        const escStartTime = this.escapeHtml(startTime);
        const escEndTime = this.escapeHtml(endTime);
        const escDuration = this.escapeHtml(duration);
        const escLocation = this.escapeHtml(task.location || 'N/A');
        
        tooltip.innerHTML = `
            <strong>${escTaskId}</strong><br>
            Time: ${escStartTime} - ${escEndTime}<br>
            Duration: ${escDuration} minutes<br>
            Location: ${escLocation}
        `;
        
        document.body.appendChild(tooltip);
        
        const rect = event.target.getBoundingClientRect();
        tooltip.style.left = `${rect.left + (rect.width / 2)}px`;
        tooltip.style.top = `${rect.top - tooltip.offsetHeight - 5}px`;
        tooltip.style.transform = 'translateX(-50%)';
        
        // Store reference for cleanup
        event.target._tooltip = tooltip;
    }

    hideTaskTooltip(event) {
        if (event.target._tooltip) {
            event.target._tooltip.remove();
            delete event.target._tooltip;
        }
    }
    
    renderActors() {
        const container = document.getElementById('actors-container');
        if (!container || !this.simulationData.actors) return;
        
        const html = this.simulationData.actors.map(actor => {
            // Escape all user-controlled data to prevent XSS
            const escActorId = this.escapeHtml(actor.id);
            const escRole = this.escapeHtml(actor.role);
            const escCostPerHour = this.escapeHtml(actor.cost_per_hour || 0);
            const escUtilization = this.escapeHtml(actor.utilization_percentage || 0);
            
            return `
                <div class="actor-card" data-actor-id="${escActorId}">
                    <div class="actor-header">
                        <h5>${escRole}</h5>
                        <span class="actor-status" id="status-${escActorId}">Idle</span>
                    </div>
                    <div class="actor-details">
                        <div>Cost: $${escCostPerHour}/hr</div>
                        <div>Utilization: ${escUtilization}%</div>
                        <div class="current-task" id="task-${escActorId}">No active task</div>
                    </div>
                </div>
            `;
        }).join('');
        
        container.innerHTML = html;
    }
    
    renderResources() {
        const container = document.getElementById('resources-container');
        if (!container || !this.simulationData.resources) return;
        
        // Calculate resource consumption over time
        this.calculateResourceUsage();
        
        const html = this.simulationData.resources.map(resource => {
            // Escape all user-controlled data to prevent XSS
            const escResourceId = this.escapeHtml(resource.id);
            const escResourceName = this.escapeHtml(resource.id.replace(/_/g, ' '));
            const escUnit = this.escapeHtml(resource.unit);
            const escStartingStock = this.escapeHtml(resource.starting_stock);
            
            return `
                <div class="resource-card" data-resource-id="${escResourceId}">
                    <div class="resource-header">
                        <h5>${escResourceName}</h5>
                        <span class="resource-unit">${escUnit}</span>
                    </div>
                    <div class="resource-bar">
                        <div class="resource-fill" id="fill-${escResourceId}"></div>
                        <span class="resource-amount" id="amount-${escResourceId}">
                            ${escStartingStock} ${escUnit}
                        </span>
                    </div>
                    <div class="resource-starting">
                        Starting: ${escStartingStock} ${escUnit}
                    </div>
                </div>
            `;
        }).join('');
        
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
        // Round minutes to prevent excessive decimal places
        const roundedMinutes = Math.round(minutes);
        const hours = Math.floor(roundedMinutes / 60);
        const mins = roundedMinutes % 60;
        return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
    }
    
    getCurrentTimeMinutes() {
        return this.startTimeMinutes + (this.currentTime / 100) * this.totalDurationMinutes;
    }
      updateSimulation() {
        if (!this.simulationData) return;
        
        const totalDuration = this.simulationData.end_time_minutes - this.simulationData.start_time_minutes;
        const progress = this.currentTime / 100;
        // Round the current time calculation to prevent excessive decimal places
        const currentTime = Math.round(this.simulationData.start_time_minutes + (progress * totalDuration));
        
        // Update timeline with playhead
        this.renderTimeline(currentTime);
        
        // Update actors status
        this.updateActorsStatus(currentTime);
        
        // Update resources display
        this.updateResourcesDisplay(currentTime);
        
        // Update time display
        const timeDisplay = document.getElementById('time-display');
        if (timeDisplay) {
            timeDisplay.textContent = this.formatTime(currentTime);
        }
        
        // Update time slider
        const timeSlider = document.getElementById('time-slider');
        if (timeSlider && timeSlider.value != this.currentTime) {
            timeSlider.value = this.currentTime;
        }
    }

    renderTimeline(currentTime) {
        const container = document.getElementById('timeline-actors-container');
        if (!container) return;

        const { actors, tasks, start_time_minutes, end_time_minutes } = this.simulationData;
        const totalDuration = end_time_minutes - start_time_minutes;

        // Clear existing content
        container.innerHTML = '';

        // Create time axis markers
        const timeAxisContainer = document.querySelector('.timeline-time-axis');
        if (timeAxisContainer) {
            timeAxisContainer.innerHTML = '';
            const markersDiv = document.createElement('div');
            markersDiv.className = 'timeline-time-markers';
            
            // Add time markers (every 2 hours)
            for (let i = 0; i <= totalDuration; i += 120) {
                const timeMinutes = start_time_minutes + i;
                const hours = Math.floor(timeMinutes / 60);
                const minutes = timeMinutes % 60;
                const timeStr = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
                
                const marker = document.createElement('span');
                marker.textContent = timeStr;
                marker.style.position = 'absolute';
                marker.style.left = `${(i / totalDuration) * 100}%`;
                marker.style.transform = 'translateX(-50%)';
                markersDiv.appendChild(marker);
            }
            
            timeAxisContainer.appendChild(markersDiv);
        }

        // Group tasks by actor
        const tasksByActor = {};
        actors.forEach(actor => {
            tasksByActor[actor.id] = {
                actor: actor,
                tasks: tasks.filter(task => task.actor_id === actor.id)
            };
        });

        // Create timeline row for each actor
        Object.values(tasksByActor).forEach(({ actor, tasks: actorTasks }) => {
            const rowDiv = document.createElement('div');
            rowDiv.className = 'actor-timeline-row';
            rowDiv.setAttribute('data-actor', actor.id);

            // Actor label
            const labelDiv = document.createElement('div');
            labelDiv.className = 'actor-label';
            labelDiv.textContent = actor.role || actor.id;
            rowDiv.appendChild(labelDiv);

            // Tasks container
            const tasksContainer = document.createElement('div');
            tasksContainer.className = 'actor-tasks-container';

            // Add tasks for this actor
            actorTasks.forEach(task => {
                const taskDiv = document.createElement('div');
                taskDiv.className = 'task-block';
                taskDiv.setAttribute('data-task-id', task.id);

                // Calculate position and width
                const startPercent = ((task.start_minutes - start_time_minutes) / totalDuration) * 100;
                const widthPercent = (task.duration / totalDuration) * 100;

                taskDiv.style.left = `${startPercent}%`;
                taskDiv.style.width = `${widthPercent}%`;

                // Task content - use emoji if available, otherwise formatted task name
                let taskDisplayContent;
                if (task.emoji) {
                    taskDisplayContent = task.emoji;
                    taskDiv.title = task.display_name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                } else {
                    taskDisplayContent = task.id.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                }
                taskDiv.textContent = taskDisplayContent;                // Set task state based on current time
                if (currentTime >= task.end_minutes) {
                    taskDiv.classList.add('completed');
                } else if (currentTime >= task.start_minutes && currentTime < task.end_minutes) {
                    taskDiv.classList.add('active');
                }

                // Add tooltip on hover
                taskDiv.addEventListener('mouseenter', (e) => {
                    this.showTaskTooltip(e, task);
                });

                taskDiv.addEventListener('mouseleave', this.hideTaskTooltip);

                // Add click functionality to jump to task start time
                taskDiv.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.jumpToTime(task.start_minutes);
                });

                tasksContainer.appendChild(taskDiv);
            });

            rowDiv.appendChild(tasksContainer);
            container.appendChild(rowDiv);
        });

        // Add the red time indicator line
        this.updateTimeIndicator(currentTime);
    }    updateTimeIndicator(currentTime) {
        // Remove existing time indicators from all task containers
        const existingIndicators = document.querySelectorAll('.time-indicator');
        existingIndicators.forEach(indicator => indicator.remove());

        const { start_time_minutes, end_time_minutes } = this.simulationData;
        const totalDuration = end_time_minutes - start_time_minutes;

        // Calculate position of current time
        const timePercent = ((currentTime - start_time_minutes) / totalDuration) * 100;
        
        // Only show indicator if time is within range
        if (timePercent >= 0 && timePercent <= 100) {
            // Add time indicator to each task container row
            const taskContainers = document.querySelectorAll('.actor-tasks-container');
            taskContainers.forEach(container => {
                const indicator = document.createElement('div');
                indicator.className = 'time-indicator';
                indicator.style.left = `${timePercent}%`;
                container.appendChild(indicator);
            });            // Also add to the time axis header
            const timeAxisContainer = document.querySelector('.timeline-time-axis');
            if (timeAxisContainer) {
                const headerIndicator = document.createElement('div');
                headerIndicator.className = 'time-indicator';
                // Position with offset for actor label area (130px) + percentage of remaining width
                const offsetPosition = 130 + (timePercent / 100) * (timeAxisContainer.offsetWidth - 130);
                headerIndicator.style.left = `${offsetPosition}px`;
                headerIndicator.style.height = '100%';
                timeAxisContainer.appendChild(headerIndicator);
            }
        }
    }
    
    updateActorsStatus(currentTime) {
        if (!this.simulationData.actors || !this.simulationData.tasks) return;
        
        this.simulationData.actors.forEach(actor => {
            const statusElement = document.getElementById(`status-${actor.id}`);
            const taskElement = document.getElementById(`task-${actor.id}`);
            
            // Find current task for this actor
            const currentTask = this.simulationData.tasks.find(task => 
                task.actor_id === actor.id && 
                currentTime >= task.start_minutes && 
                currentTime <= task.end_minutes
            );
            
            if (currentTask) {
                if (statusElement) {
                    statusElement.textContent = 'Working';
                    statusElement.className = 'actor-status working';
                }
                if (taskElement) {
                    // Use emoji and display name if available, otherwise format the full id
                    let taskDisplay;
                    if (currentTask.emoji && currentTask.display_name) {
                        taskDisplay = `${currentTask.emoji} ${currentTask.display_name.replace(/_/g, ' ')}`;
                    } else {
                        taskDisplay = currentTask.id.replace(/_/g, ' ');
                    }
                    taskElement.textContent = `Task: ${this.escapeHtml(taskDisplay)}`;
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
    
    updateResourcesDisplay(currentTime) {
        if (!this.simulationData.resources) return;
        
        this.simulationData.resources.forEach(resource => {
            let currentStock = resource.starting_stock;
            
            // Apply all usage changes up to current time
            if (resource.usageHistory) {
                resource.usageHistory.forEach(change => {
                    if (change.time <= currentTime) {
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
    
    reset() {
        this.pause();
        this.currentTime = 0;
        this.updateSimulation();
        
        const btn = document.getElementById('play-pause-btn');
        if (btn) btn.textContent = '▶️ Play';
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
    
    jumpToTime(targetTimeMinutes) {
        // Pause the simulation if it's playing
        this.pause();
        
        // Convert the target time to percentage
        const { start_time_minutes, end_time_minutes } = this.simulationData;
        const totalDuration = end_time_minutes - start_time_minutes;
        const timePercent = ((targetTimeMinutes - start_time_minutes) / totalDuration) * 100;
        
        // Clamp the percentage to valid range
        this.currentTime = Math.max(0, Math.min(100, timePercent));
        
        // Update the simulation display
        this.updateSimulation();
        
        // Update the play/pause button
        const btn = document.getElementById('play-pause-btn');
        if (btn) btn.textContent = '▶️ Play';
    }
}

// Initialize simulation viewer when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Only initialize if simulation container exists
    if (document.getElementById('simulation-container')) {
        new SimulationViewer();
    }
});

