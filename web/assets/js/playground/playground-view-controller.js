// Playground View Controller - Manages multi-period view states and navigation
// Universal Automation Wiki - Simulation Playground

/**
 * MultiPeriodViewController - Manages view state, switching, and navigation
 */
class MultiPeriodViewController {
    constructor() {
        this.currentView = 'calendar'; // 'calendar', 'week', or 'day'
        this.currentDay = 1;
        this.currentWeek = 1;
        this.currentMonthOffset = 0; // Track which month we're viewing
        this.currentDayType = null; // Track which day type we're editing
        this.simulator = null;
        this.simulationData = null;

        // Load persisted state
        this.loadState();
    }

    /**
     * Initialize with simulation data
     */
    initialize(simulationData) {
        this.simulationData = simulationData;
        this.simulator = new MultiDaySimulator(simulationData);

        // Validate current day is within range
        const totalDays = this.simulator.getTotalDays();
        if (this.currentDay > totalDays) {
            this.currentDay = 1;
        }

        // Update current week based on current day
        const weekInfo = this.simulator.getWeekForDay(this.currentDay);
        this.currentWeek = weekInfo.weekNumber;
    }

    /**
     * Check if current simulation is multi-period
     */
    isMultiPeriod() {
        return this.simulator ? this.simulator.isMultiPeriod() : false;
    }

    /**
     * Switch to a specific view
     */
    switchToView(viewName, options = {}) {
        // Restore original editor if switching away from day view
        if (this.currentView === 'day' && viewName !== 'day' && this.originalEditor) {
            window.editor = this.originalEditor;
            window.activeDayTypeEditor = null; // Clear the wrapper reference
            this.originalEditor = null;
            this.currentDayType = null; // Clear day type when leaving day view
        }

        this.currentView = viewName;

        if (options.day !== undefined) {
            this.currentDay = options.day;
            const weekInfo = this.simulator.getWeekForDay(this.currentDay);
            this.currentWeek = weekInfo.weekNumber;
        }

        if (options.week !== undefined) {
            this.currentWeek = options.week;
        }

        this.saveState();
        this.render();
    }

    /**
     * Navigate to a specific day (shows the day type template for editing)
     */
    goToDay(dayNumber) {
        // Determine the day type for this day
        const dayType = this.simulator.getDayTypeForDay(dayNumber);
        this.currentDayType = dayType;
        this.switchToView('day', { day: dayNumber });
    }

    /**
     * Navigate to a specific week
     */
    goToWeek(weekNumber) {
        this.currentWeek = weekNumber;
        this.switchToView('week', { week: weekNumber });
    }

    /**
     * Navigate to calendar view
     */
    goToCalendar() {
        this.switchToView('calendar');
    }

    /**
     * Navigate to next week
     */
    nextWeek() {
        const totalDays = this.simulator.getTotalDays();
        const totalWeeks = Math.ceil(totalDays / 7);

        if (this.currentWeek < totalWeeks) {
            this.currentWeek++;
            this.switchToView('week', { week: this.currentWeek });
        }
    }

    /**
     * Navigate to previous week
     */
    prevWeek() {
        if (this.currentWeek > 1) {
            this.currentWeek--;
            this.switchToView('week', { week: this.currentWeek });
        }
    }

    /**
     * Get breadcrumb data for current view
     */
    getBreadcrumbs() {
        const breadcrumbs = [];

        // Always show calendar breadcrumb if we have a multi-period simulation
        if (!this.isMultiPeriod()) {
            return breadcrumbs;
        }

        if (this.currentView === 'calendar') {
            breadcrumbs.push({ label: 'Calendar', view: 'calendar', active: true });
        } else if (this.currentView === 'week') {
            breadcrumbs.push({ label: 'Calendar', view: 'calendar', active: false });

            const weekInfo = this.simulator.getWeekForDay((this.currentWeek - 1) * 7 + 1);
            breadcrumbs.push({
                label: `Week ${this.currentWeek} (Days ${weekInfo.startDay}-${weekInfo.endDay})`,
                view: 'week',
                week: this.currentWeek,
                active: true
            });
        } else if (this.currentView === 'day') {
            breadcrumbs.push({ label: 'Calendar', view: 'calendar', active: false });

            // Show which day type template we're editing
            const dayType = this.currentDayType || this.simulator.getDayTypeForDay(this.currentDay);
            const dayTypeName = this.simulator.getDayTypeName(dayType);
            breadcrumbs.push({
                label: `Editing: ${dayTypeName}`,
                view: 'day',
                day: this.currentDay,
                active: true
            });
        }

        return breadcrumbs;
    }

    /**
     * Render the current view
     */
    render() {
        // Update breadcrumbs
        this.renderBreadcrumbs();

        // Show/hide object panels based on view
        this.updateObjectPanelsVisibility();

        // Render the appropriate view
        if (!this.isMultiPeriod()) {
            // Single-day simulation - use existing renderer
            this.renderSingleDay();
        } else {
            // Multi-period simulation
            switch (this.currentView) {
                case 'calendar':
                    this.renderCalendarView();
                    break;
                case 'week':
                    this.renderWeekView();
                    break;
                case 'day':
                    this.renderDayView();
                    break;
            }
        }
    }

    /**
     * Render breadcrumb navigation
     */
    renderBreadcrumbs() {
        const breadcrumbs = this.getBreadcrumbs();
        const container = document.getElementById('multi-period-breadcrumbs');

        if (!container) return;

        if (breadcrumbs.length === 0 || !this.isMultiPeriod()) {
            container.style.display = 'none';
            return;
        }

        container.style.display = 'flex';
        container.innerHTML = breadcrumbs.map((bc, index) => {
            const isLast = index === breadcrumbs.length - 1;
            const separator = isLast ? '' : '<span class="breadcrumb-separator">›</span>';

            if (bc.active) {
                return `<span class="breadcrumb-item active">${sanitizeHTML(bc.label)}</span>${separator}`;
            } else {
                return `<a href="#" class="breadcrumb-item" data-view="${bc.view}" data-day="${bc.day || ''}" data-week="${bc.week || ''}">${sanitizeHTML(bc.label)}</a>${separator}`;
            }
        }).join('');

        // Add click handlers to breadcrumb links
        container.querySelectorAll('a.breadcrumb-item').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const view = link.dataset.view;
                const day = parseInt(link.dataset.day) || undefined;
                const week = parseInt(link.dataset.week) || undefined;

                this.switchToView(view, { day, week });
            });
        });
    }

    /**
     * Update object panels visibility (only visible in Day View)
     */
    updateObjectPanelsVisibility() {
        const container = document.getElementById('live-state-container');
        if (container) {
            if (this.currentView === 'day' || !this.isMultiPeriod()) {
                container.style.display = 'flex';
            } else {
                container.style.display = 'none';
            }
        }
    }

    /**
     * Render single-day simulation (backward compatibility)
     */
    renderSingleDay() {
        // Hide multi-period controls
        const viewSelector = document.getElementById('multi-period-view-selector');
        if (viewSelector) {
            viewSelector.style.display = 'none';
        }

        // Call existing render function
        if (typeof window.renderSimulation === 'function') {
            window.renderSimulation(true); // Skip JSON validation
        }
    }

    /**
     * Render calendar view
     */
    renderCalendarView() {
        const simulationContent = document.getElementById('simulation-content');
        if (!simulationContent) return;

        // Render calendar (implementation in separate module)
        if (typeof window.renderCalendarView === 'function') {
            window.renderCalendarView(this.simulator, this, this.currentMonthOffset);
        }
    }

    /**
     * Render week view
     */
    renderWeekView() {
        const simulationContent = document.getElementById('simulation-content');
        if (!simulationContent) return;

        // Render week (implementation in separate module)
        if (typeof window.renderWeekView === 'function') {
            window.renderWeekView(this.simulator, this, this.currentWeek);
        }
    }

    /**
     * Render day view - shows the day type template for editing
     */
    renderDayView() {
        const simulationContent = document.getElementById('simulation-content');
        if (!simulationContent) return;

        // Get the day type for the current day
        const dayType = this.currentDayType || this.simulator.getDayTypeForDay(this.currentDay);
        const dayDefinition = this.simulator.getDayTypeDefinition(dayType);

        if (!dayDefinition) {
            simulationContent.innerHTML = '<p style="color: var(--error-color); text-align: center; margin-top: 2rem;">No definition found for this day type.</p>';
            return;
        }

        // Store reference to original editor (only once)
        if (!this.originalEditor) {
            this.originalEditor = window.editor;
        }
        const originalEditor = this.originalEditor;

        // Create a wrapper that allows editing the day type directly
        const dayTypeEditWrapper = {
            simulation: dayDefinition
        };

        // Store the current day type for use in the wrapper
        const currentDayType = dayType;

        // Create a custom editor that reads from and writes to the day type in the original JSON
        const dayTypeEditor = {
            getValue: () => {
                // Return the current state of this day type from the original JSON
                // IMPORTANT: Use getDayTypeDefinition() to get merged global + day-type objects
                const currentJsonStr = originalEditor.getValue();

                const currentJson = JSON.parse(stripJsonComments(currentJsonStr));

                // Re-create simulator with current data to get merged definition
                const currentSimulator = new MultiDaySimulator({ simulation: currentJson.simulation });
                const mergedDefinition = currentSimulator.getDayTypeDefinition(currentDayType);

                if (!mergedDefinition) {
                    return JSON.stringify(dayTypeEditWrapper, null, 2);
                }

                // Return the merged definition (includes global objects + day-type objects)
                return JSON.stringify({ simulation: mergedDefinition }, null, 2);
            },
            setValue: (newValue) => {
                // Parse the edited day type definition
                try {
                    const edited = JSON.parse(newValue);
                    const editedDefinition = edited.simulation;

                    // Update the day type in the original JSON
                    const currentJson = JSON.parse(stripJsonComments(originalEditor.getValue()));
                    if (currentJson.simulation && currentJson.simulation.day_types && currentJson.simulation.day_types[currentDayType]) {
                        // Preserve the name, update everything else
                        const name = currentJson.simulation.day_types[currentDayType].name;

                        // Separate global objects from day-type specific objects
                        const globalObjects = currentJson.simulation.objects || [];
                        const globalObjectIds = new Set(globalObjects.map(o => o.id));

                        // Filter out global objects from the edited definition
                        // Only keep objects that are day-type specific (not in global list)
                        const dayTypeOnlyObjects = (editedDefinition.objects || []).filter(
                            obj => !globalObjectIds.has(obj.id)
                        );

                        // Update the day type with only day-type specific data
                        currentJson.simulation.day_types[currentDayType] = {
                            name: name,
                            ...editedDefinition,
                            objects: dayTypeOnlyObjects  // Only store day-type specific objects
                        };

                        // Write back to the actual editor
                        originalEditor.setValue(JSON.stringify(currentJson, null, 2));
                    }
                } catch (e) {
                    console.error('Error updating day type:', e);
                }
            }
        };

        // Replace the window.editor with our custom wrapper
        // Store it so other code can detect it's active
        window.editor = dayTypeEditor;
        window.editor.isDayTypeWrapper = true; // Mark it as a wrapper
        window.activeDayTypeEditor = dayTypeEditor; // Keep a reference

        // Set flag to prevent re-triggering multi-period rendering
        window.renderingSingleDayFromMultiPeriod = true;

        // Clear any rendering locks before calling renderSimulation
        window.renderingInProgress = false;
        window.simulationPlayerActive = false;

        // Ensure breadcrumbs container exists (but don't call ensureMultiPeriodUI which shows it)
        const breadcrumbsContainer = document.getElementById('multi-period-breadcrumbs');
        if (!breadcrumbsContainer) {
            const newContainer = document.createElement('div');
            newContainer.id = 'multi-period-breadcrumbs';
            newContainer.className = 'multi-period-breadcrumbs';
            const parent = simulationContent.parentElement;
            if (parent) {
                parent.insertBefore(newContainer, simulationContent);
            }
        }

        // Render using existing timeline renderer
        if (typeof window.renderSimulation === 'function') {
            window.renderSimulation(true); // Skip JSON validation
        }

        // Clear flag after rendering
        window.renderingSingleDayFromMultiPeriod = false;

        // Show breadcrumbs after rendering (renderSimulation calls hideMultiPeriodUI)
        this.renderBreadcrumbs();

        // Note: DO NOT restore window.editor here - keep it active until view switches
    }

    /**
     * Save state to localStorage
     */
    saveState() {
        try {
            localStorage.setItem('uaw-multi-period-view', this.currentView);
            localStorage.setItem('uaw-multi-period-day', this.currentDay.toString());
            localStorage.setItem('uaw-multi-period-week', this.currentWeek.toString());
            if (this.currentDayType) {
                localStorage.setItem('uaw-multi-period-daytype', this.currentDayType);
            } else {
                localStorage.removeItem('uaw-multi-period-daytype');
            }
        } catch (e) {
            console.warn('Could not save multi-period state:', e.message);
        }
    }

    /**
     * Load state from localStorage
     */
    loadState() {
        try {
            const savedView = localStorage.getItem('uaw-multi-period-view');
            const savedDay = localStorage.getItem('uaw-multi-period-day');
            const savedWeek = localStorage.getItem('uaw-multi-period-week');
            const savedDayType = localStorage.getItem('uaw-multi-period-daytype');

            if (savedView) {
                this.currentView = savedView;
            }
            if (savedDay) {
                this.currentDay = parseInt(savedDay) || 1;
            }
            if (savedWeek) {
                this.currentWeek = parseInt(savedWeek) || 1;
            }
            if (savedDayType) {
                this.currentDayType = savedDayType;
            }
        } catch (e) {
            console.warn('Could not load multi-period state:', e.message);
        }
    }
}

// Export to global scope
window.MultiPeriodViewController = MultiPeriodViewController;
