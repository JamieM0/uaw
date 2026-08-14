// Playground Calendar View - Renders calendar grid for multi-period simulations
// Universal Automation Wiki - Simulation Playground

/**
 * Render calendar view showing all simulation days in a grid
 * currentMonthOffset: 0 = start month, 1 = next month, -1 = prev month, etc.
 */
function renderCalendarView(simulator, viewController, currentMonthOffset = 0) {
    const simulationContent = document.getElementById('simulation-content');
    if (!simulationContent) return;

    simulationContent.innerHTML = '';

    const container = document.createElement('div');
    container.className = 'multi-period-calendar-container';

    // Get color mapping
    const colorMap = simulator.getDayTypeColors();
    const totalSimulationDays = simulator.getTotalDays();

    // Build calendar by actual months
    const startDate = simulator.startDate;

    // Calculate the month to display (with offset)
    const displayMonth = new Date(startDate.getFullYear(), startDate.getMonth() + currentMonthOffset, 1);
    const displayYear = displayMonth.getFullYear();
    const displayMonthIndex = displayMonth.getMonth();

    // Calculate first and last day of the display month
    const firstDayOfMonth = new Date(displayYear, displayMonthIndex, 1);
    const lastDayOfMonth = new Date(displayYear, displayMonthIndex + 1, 0);

    // Calculate previous and next months
    const prevMonth = new Date(displayYear, displayMonthIndex - 1, 1);
    const nextMonth = new Date(displayYear, displayMonthIndex + 1, 1);

    // Buttons always enabled for infinite scrolling
    const hasPrevMonth = true;
    const hasNextMonth = true;

    // Month header with navigation
    const monthHeader = document.createElement('div');
    monthHeader.className = 'calendar-month-header';

    const monthName = displayMonth.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

    monthHeader.innerHTML = `
        <button class="month-nav-btn" id="prev-month-btn"><span aria-hidden="true">‹</span> ${prevMonth.toLocaleDateString('en-GB', { month: 'short' })}</button>
        <div class="month-title">
            <h3>${monthName}</h3>
            <span>${simulator.getTotalDays()} configured days</span>
        </div>
        <button class="month-nav-btn" id="next-month-btn">${nextMonth.toLocaleDateString('en-GB', { month: 'short' })} <span aria-hidden="true">›</span></button>
    `;
    container.appendChild(monthHeader);

    // Add month navigation handlers
    setTimeout(() => {
        const prevBtn = document.getElementById('prev-month-btn');
        const nextBtn = document.getElementById('next-month-btn');

        if (prevBtn) {
            prevBtn.addEventListener('click', () => {
                viewController.currentMonthOffset = currentMonthOffset - 1;
                renderCalendarView(simulator, viewController, currentMonthOffset - 1);
            });
        }
        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                viewController.currentMonthOffset = currentMonthOffset + 1;
                renderCalendarView(simulator, viewController, currentMonthOffset + 1);
            });
        }
    }, 0);

    // Calendar grid
    const calendarGrid = document.createElement('div');
    calendarGrid.className = 'calendar-grid';

    // Day headers (no "Week" column)
    const dayHeaders = document.createElement('div');
    dayHeaders.className = 'calendar-day-headers';
    const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    dayNames.forEach(dayName => {
        const header = document.createElement('div');
        header.className = 'calendar-day-header';
        header.textContent = dayName;
        dayHeaders.appendChild(header);
    });
    calendarGrid.appendChild(dayHeaders);

    // Generate all days in the display month
    const daysInMonth = [];
    for (let day = 1; day <= lastDayOfMonth.getDate(); day++) {
        const date = new Date(displayYear, displayMonthIndex, day);
        const dayOfWeek = getDayOfWeek(date); // 0 = Monday, 6 = Sunday

        // Calculate day number relative to start date
        const dayNumber = simulator.getDayNumberFromDate(date);

        const isWithinSimulation = dayNumber >= 1 && dayNumber <= totalSimulationDays;

        // Dates outside the configured simulation range remain visible for calendar
        // context, but must not be presented as unknown zero-activity simulation days.
        const dayType = isWithinSimulation ? simulator.getDayTypeForDay(dayNumber) : null;
        const dayDefinition = isWithinSimulation ? simulator.getDayTypeDefinition(dayType) : null;
        const metrics = isWithinSimulation
            ? simulator.simulateDay(dayDefinition)
            : { revenue: 0, costs: 0, profit: 0, tasks: 0 };

        daysInMonth.push({
            day: dayNumber,
            date: date,
            dayOfWeek: dayOfWeek,
            dayType: dayType,
            dayTypeName: simulator.getDayTypeName(dayType),
            metrics: metrics,
            isWithinSimulation: isWithinSimulation
        });
    }

    // Group days by week for rendering
    const weeks = [];
    let currentWeek = [];

    // Add empty cells for days before the 1st of the month
    const firstDayOfWeek = getDayOfWeek(firstDayOfMonth);
    for (let i = 0; i < firstDayOfWeek; i++) {
        currentWeek.push(null);
    }

    // Add all days in the month
    daysInMonth.forEach((dayData, index) => {
        currentWeek.push(dayData);

        // End of week or last day
        if (dayData.dayOfWeek === 6 || index === daysInMonth.length - 1) {
            weeks.push(currentWeek);
            currentWeek = [];
        }
    });

    // Render weeks
    weeks.forEach((week, weekIndex) => {
        const weekRow = document.createElement('div');
        weekRow.className = 'calendar-week-row';

        // Create cells for each day of the week (Mon-Sun)
        week.forEach(dayData => {
            if (dayData) {
                const dayCell = document.createElement('div');
                dayCell.className = 'calendar-day-cell';
                dayCell.dataset.day = dayData.day;
                if (dayData.dayType) {
                    dayCell.dataset.dayType = dayData.dayType;
                }

                // Day types are semantic accents, not saturated tile backgrounds.
                const dayTypeColor = dayData.isWithinSimulation
                    ? (colorMap[dayData.dayType] || '#607d8b')
                    : '#c8d0d5';
                dayCell.style.setProperty('--day-type-color', dayTypeColor);

                // Format date nicely (14 Oct format)
                const dateStr = dayData.date.toLocaleDateString('en-GB', {
                    day: 'numeric',
                    month: 'short'
                });

                // Content
                dayCell.innerHTML = dayData.isWithinSimulation
                    ? `
                        <div class="day-cell-heading">
                            <div class="day-number">${dateStr}</div>
                            <span class="day-type-label">${sanitizeHTML(dayData.dayTypeName)}</span>
                        </div>
                        <div class="day-metrics">
                            <span><small>Profit</small><strong class="metric-value ${dayData.metrics.profit >= 0 ? 'positive' : 'negative'}">$${dayData.metrics.profit.toFixed(0)}</strong></span>
                            <span><small>Tasks</small><strong class="metric-value">${dayData.metrics.tasks}</strong></span>
                        </div>
                    `
                    : `<div class="day-number">${dateStr}</div>`;

                // Add click handlers
                if (dayData.isWithinSimulation) {
                    const openDay = () => viewController.goToDay(dayData.day);
                    dayCell.setAttribute('role', 'button');
                    dayCell.setAttribute('tabindex', '0');
                    dayCell.setAttribute('aria-label', `${dateStr}, ${dayData.dayTypeName}, ${dayData.metrics.tasks} tasks`);
                    dayCell.addEventListener('click', openDay);
                    dayCell.addEventListener('keydown', event => {
                        if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            openDay();
                        }
                    });
                    dayCell.title = `${dayData.dayTypeName}\nClick to view details`;
                } else {
                    dayCell.classList.add('outside-simulation');
                    dayCell.setAttribute('aria-disabled', 'true');
                    dayCell.title = 'Outside simulation range';
                }

                weekRow.appendChild(dayCell);
            } else {
                // Empty cell (before start or after end)
                const emptyCell = document.createElement('div');
                emptyCell.className = 'calendar-day-cell empty';
                weekRow.appendChild(emptyCell);
            }
        });

        calendarGrid.appendChild(weekRow);
    });

    container.appendChild(calendarGrid);

    // Summary statistics
    const summary = document.createElement('div');
    summary.className = 'calendar-summary';

    // Calculate overall totals
    const simulatedDaysInMonth = daysInMonth.filter(day => day.isWithinSimulation);
    const overallMetrics = simulatedDaysInMonth.reduce((acc, day) => ({
        revenue: acc.revenue + day.metrics.revenue,
        costs: acc.costs + day.metrics.costs,
        profit: acc.profit + day.metrics.profit,
        tasks: acc.tasks + day.metrics.tasks
    }), { revenue: 0, costs: 0, profit: 0, tasks: 0 });

    // Calculate day type breakdown
    const dayTypeBreakdown = {};
    simulatedDaysInMonth.forEach(day => {
        if (!dayTypeBreakdown[day.dayType]) {
            dayTypeBreakdown[day.dayType] = {
                count: 0,
                revenue: 0,
                costs: 0,
                profit: 0,
                tasks: 0
            };
        }
        dayTypeBreakdown[day.dayType].count++;
        dayTypeBreakdown[day.dayType].revenue += day.metrics.revenue;
        dayTypeBreakdown[day.dayType].costs += day.metrics.costs;
        dayTypeBreakdown[day.dayType].profit += day.metrics.profit;
        dayTypeBreakdown[day.dayType].tasks += day.metrics.tasks;
    });

    summary.innerHTML = `
        <h5>Month summary</h5>
        <div class="summary-metrics">
            <div class="summary-item">
                <span>Revenue</span><strong>$${overallMetrics.revenue.toFixed(2)}</strong>
            </div>
            <div class="summary-item">
                <span>Costs</span><strong>$${overallMetrics.costs.toFixed(2)}</strong>
            </div>
            <div class="summary-item ${overallMetrics.profit >= 0 ? 'positive' : 'negative'}">
                <span>Profit</span><strong>$${overallMetrics.profit.toFixed(2)}</strong>
                <small>${overallMetrics.revenue > 0 ? `${((overallMetrics.profit / overallMetrics.revenue) * 100).toFixed(1)}% margin` : 'No revenue'}</small>
            </div>
            <div class="summary-item">
                <span>Tasks</span><strong>${overallMetrics.tasks}</strong>
            </div>
        </div>

        <h5 class="summary-subheading">Day type breakdown</h5>
        <div class="day-type-breakdown">
            ${Object.entries(dayTypeBreakdown).map(([dayType, breakdown]) => {
                const color = colorMap[dayType] || '#ccc';
                const dayTypeName = simulator.getDayTypeName(dayType);
                return `
                    <div class="breakdown-item" style="--day-type-color: ${color};">
                        <div class="breakdown-content">
                            <strong>${sanitizeHTML(dayTypeName)}</strong>
                            <span class="breakdown-count">${breakdown.count}</span>
                        </div>
                        <div class="breakdown-values">
                            <span class="${breakdown.profit >= 0 ? 'positive' : 'negative'}">$${breakdown.profit.toFixed(0)}</span>
                            <span>${breakdown.tasks}</span>
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    `;

    container.appendChild(summary);

    simulationContent.appendChild(container);
}

// Export to global scope
window.renderCalendarView = renderCalendarView;
