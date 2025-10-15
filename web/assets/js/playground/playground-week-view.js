// Playground Week View - Renders 7-day compressed timeline
// Universal Automation Wiki - Simulation Playground

/**
 * Render week view showing 7 days side-by-side with compressed activity bars
 */
function renderWeekView(simulator, viewController, weekNumber) {
    const simulationContent = document.getElementById('simulation-content');
    if (!simulationContent) return;

    simulationContent.innerHTML = '';

    const container = document.createElement('div');
    container.className = 'multi-period-week-container';

    // Calculate week range
    const startDay = (weekNumber - 1) * 7 + 1;
    const totalDays = simulator.getTotalDays();
    const endDay = Math.min(startDay + 6, totalDays);
    const daysInWeek = endDay - startDay + 1;

    // Header with navigation
    const header = document.createElement('div');
    header.className = 'week-header';

    const totalWeeks = Math.ceil(totalDays / 7);
    const prevDisabled = weekNumber <= 1;
    const nextDisabled = weekNumber >= totalWeeks;

    // Get date range for the week
    const startDate = simulator.getDateForDay(startDay);
    const endDate = simulator.getDateForDay(endDay);
    const startDateStr = startDate ? startDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : `Day ${startDay}`;
    const endDateStr = endDate ? endDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : `Day ${endDay}`;

    header.innerHTML = `
        <button class="week-nav-btn" id="prev-week-btn" ${prevDisabled ? 'disabled' : ''}>◀ Previous Week</button>
        <div class="week-title">
            <h4>Week ${weekNumber}</h4>
            <p>${startDateStr} - ${endDateStr}</p>
        </div>
        <button class="week-nav-btn" id="next-week-btn" ${nextDisabled ? 'disabled' : ''}>Next Week ▶</button>
    `;
    container.appendChild(header);

    // Add navigation handlers
    setTimeout(() => {
        const prevBtn = document.getElementById('prev-week-btn');
        const nextBtn = document.getElementById('next-week-btn');

        if (prevBtn) {
            prevBtn.addEventListener('click', () => viewController.prevWeek());
        }
        if (nextBtn) {
            nextBtn.addEventListener('click', () => viewController.nextWeek());
        }
    }, 0);

    // Get simulation data for this week
    const dailyResults = simulator.simulateRange(startDay, daysInWeek);
    const colorMap = simulator.getDayTypeColors();

    // Collect all actors across all days in the week
    const allActors = new Map(); // actorId -> actor object

    dailyResults.forEach(dayResult => {
        const dayDefinition = simulator.getDayTypeDefinition(dayResult.dayType);
        if (!dayDefinition) return;

        const objects = dayDefinition.objects || [];
        const tasks = dayDefinition.tasks || [];

        // Find all objects that have tasks
        objects.forEach(obj => {
            const hasTasks = tasks.some(t => t.actor_id === obj.id);
            if (hasTasks) {
                allActors.set(obj.id, obj);
            }
        });
    });

    // Week grid
    const weekGrid = document.createElement('div');
    weekGrid.className = 'week-grid';

    // Day headers
    const dayHeaders = document.createElement('div');
    dayHeaders.className = 'week-day-headers';

    // Empty cell for actor labels
    const emptyHeader = document.createElement('div');
    emptyHeader.className = 'week-actor-label-header';
    dayHeaders.appendChild(emptyHeader);

    // Day header cells
    dailyResults.forEach((dayResult, index) => {
        const dayHeader = document.createElement('div');
        dayHeader.className = 'week-day-header';
        dayHeader.dataset.day = dayResult.day;

        const bgColor = colorMap[dayResult.dayType] || '#ccc';
        dayHeader.style.backgroundColor = bgColor;
        dayHeader.style.color = getContrastColor(bgColor);

        // Get actual date for this day
        const dayDate = simulator.getDateForDay(dayResult.day);
        const dayDateStr = dayDate ? dayDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : `Day ${dayResult.day}`;

        dayHeader.innerHTML = `
            <div class="day-name">${dayDateStr}</div>
            <div class="day-type-badge">${sanitizeHTML(dayResult.dayTypeName)}</div>
        `;

        dayHeader.addEventListener('click', () => {
            viewController.goToDay(dayResult.day);
        });

        dayHeader.style.cursor = 'pointer';
        dayHeader.title = `Click to view ${dayDateStr} details`;

        dayHeaders.appendChild(dayHeader);
    });

    weekGrid.appendChild(dayHeaders);

    // Actor rows
    allActors.forEach((actor, actorId) => {
        const actorRow = document.createElement('div');
        actorRow.className = 'week-actor-row';

        // Actor label
        const actorLabel = document.createElement('div');
        actorLabel.className = 'week-actor-label';

        let displayName;
        if (actor.type === 'actor') {
            displayName = actor.properties?.role || actor.name || actorId;
        } else {
            displayName = `${actor.name || actorId} (${actor.type})`;
        }

        actorLabel.innerHTML = `<strong>${sanitizeHTML(displayName)}</strong>`;
        actorRow.appendChild(actorLabel);

        // Day columns for this actor
        dailyResults.forEach(dayResult => {
            const dayDefinition = simulator.getDayTypeDefinition(dayResult.dayType);
            const dayColumn = document.createElement('div');
            dayColumn.className = 'week-day-column';
            dayColumn.dataset.day = dayResult.day;

            if (!dayDefinition) {
                dayColumn.classList.add('no-data');
                actorRow.appendChild(dayColumn);
                return;
            }

            const tasks = (dayDefinition.tasks || []).filter(t => t.actor_id === actorId);

            if (tasks.length === 0) {
                dayColumn.classList.add('no-activity');
                dayColumn.innerHTML = '<span class="no-activity-marker">—</span>';
            } else {
                // Calculate utilization
                const totalTaskDuration = tasks.reduce((sum, t) => sum + (t.duration || 0), 0);
                const config = dayDefinition.config || {};
                const startTime = config.start_time || "06:00";
                const endTime = config.end_time || "18:00";

                const [startHour, startMin] = startTime.split(":").map(Number);
                const [endHour, endMin] = endTime.split(":").map(Number);
                const dayDuration = (endHour * 60 + endMin) - (startHour * 60 + startMin);

                const utilizationPercent = dayDuration > 0 ? (totalTaskDuration / dayDuration) * 100 : 0;

                dayColumn.innerHTML = `
                    <div class="activity-bar" style="height: ${Math.min(utilizationPercent, 100)}%;" title="${tasks.length} tasks (${totalTaskDuration} min)">
                        <span class="activity-count">${tasks.length}</span>
                    </div>
                `;
            }

            dayColumn.addEventListener('click', () => {
                viewController.goToDay(dayResult.day);
            });

            dayColumn.style.cursor = 'pointer';
            dayColumn.title = `Click to view Day ${dayResult.day} details`;

            actorRow.appendChild(dayColumn);
        });

        weekGrid.appendChild(actorRow);
    });

    container.appendChild(weekGrid);

    // Week summary
    const summary = document.createElement('div');
    summary.className = 'week-summary';

    const weekMetrics = dailyResults.reduce((acc, day) => ({
        revenue: acc.revenue + day.metrics.revenue,
        costs: acc.costs + day.metrics.costs,
        profit: acc.profit + day.metrics.profit,
        tasks: acc.tasks + day.metrics.tasks
    }), { revenue: 0, costs: 0, profit: 0, tasks: 0 });

    summary.innerHTML = `
        <h5>Week ${weekNumber} Summary</h5>
        <div class="week-summary-metrics">
            <div class="summary-metric">
                <span class="metric-icon">💰</span>
                <div class="metric-content">
                    <div class="metric-label">Revenue</div>
                    <div class="metric-value">$${weekMetrics.revenue.toFixed(2)}</div>
                </div>
            </div>
            <div class="summary-metric">
                <span class="metric-icon">💸</span>
                <div class="metric-content">
                    <div class="metric-label">Costs</div>
                    <div class="metric-value">$${weekMetrics.costs.toFixed(2)}</div>
                </div>
            </div>
            <div class="summary-metric ${weekMetrics.profit >= 0 ? 'positive' : 'negative'}">
                <span class="metric-icon">${weekMetrics.profit >= 0 ? '📈' : '📉'}</span>
                <div class="metric-content">
                    <div class="metric-label">Profit</div>
                    <div class="metric-value">$${weekMetrics.profit.toFixed(2)}</div>
                </div>
            </div>
            <div class="summary-metric">
                <span class="metric-icon">📋</span>
                <div class="metric-content">
                    <div class="metric-label">Tasks</div>
                    <div class="metric-value">${weekMetrics.tasks}</div>
                </div>
            </div>
        </div>
    `;

    container.appendChild(summary);

    // Legend
    const legend = document.createElement('div');
    legend.className = 'week-legend';
    legend.innerHTML = `
        <h5>Day Types</h5>
        <div class="legend-items">
            ${Array.from(new Set(dailyResults.map(d => d.dayType))).map(dayType => {
                const color = colorMap[dayType] || '#ccc';
                const dayTypeName = simulator.getDayTypeName(dayType);
                return `
                    <div class="legend-item">
                        <div class="legend-color" style="background-color: ${color};"></div>
                        <span class="legend-label">${sanitizeHTML(dayTypeName)}</span>
                    </div>
                `;
            }).join('')}
        </div>
    `;

    container.appendChild(legend);

    simulationContent.appendChild(container);
}

/**
 * Calculate contrast color (black or white) for a background color
 */
function getContrastColor(bgColor) {
    // Convert color to RGB
    let r, g, b;

    if (bgColor.startsWith('#')) {
        const hex = bgColor.replace('#', '');
        r = parseInt(hex.substr(0, 2), 16);
        g = parseInt(hex.substr(2, 2), 16);
        b = parseInt(hex.substr(4, 2), 16);
    } else if (bgColor.startsWith('rgb')) {
        const match = bgColor.match(/\d+/g);
        r = parseInt(match[0]);
        g = parseInt(match[1]);
        b = parseInt(match[2]);
    } else if (bgColor.startsWith('hsl')) {
        // For HSL, we'll use a simple approximation
        const match = bgColor.match(/\d+/g);
        const l = parseInt(match[2]);
        return l > 50 ? '#000000' : '#ffffff';
    } else {
        return '#000000';
    }

    // Calculate relative luminance
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

    return luminance > 0.5 ? '#000000' : '#ffffff';
}

// Export to global scope
window.renderWeekView = renderWeekView;
