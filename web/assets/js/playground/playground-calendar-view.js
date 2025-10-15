// Playground Calendar View - Renders calendar grid for multi-period simulations
// Universal Automation Wiki - Simulation Playground

/**
 * Get brightness of a color (0-255)
 */
function getColorBrightness(color) {
    // Handle hex colors
    if (color.startsWith('#')) {
        const hex = color.substring(1);
        const r = parseInt(hex.substr(0, 2), 16);
        const g = parseInt(hex.substr(2, 2), 16);
        const b = parseInt(hex.substr(4, 2), 16);
        return (r * 299 + g * 587 + b * 114) / 1000;
    }

    // Handle HSL colors
    if (color.startsWith('hsl')) {
        const match = color.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
        if (match) {
            const l = parseInt(match[3]);
            return l * 2.55; // Convert lightness (0-100) to brightness (0-255)
        }
    }

    // Handle rgb colors
    if (color.startsWith('rgb')) {
        const match = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
        if (match) {
            const r = parseInt(match[1]);
            const g = parseInt(match[2]);
            const b = parseInt(match[3]);
            return (r * 299 + g * 587 + b * 114) / 1000;
        }
    }

    return 128; // Default to medium brightness
}

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
        <button class="month-nav-btn" id="prev-month-btn">◀ ${prevMonth.toLocaleDateString('en-GB', { month: 'short' })}</button>
        <div class="month-title">
            <h3>${monthName}</h3>
        </div>
        <button class="month-nav-btn" id="next-month-btn">${nextMonth.toLocaleDateString('en-GB', { month: 'short' })} ▶</button>
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

        // Get day type and simulate
        const dayType = simulator.getDayTypeForDay(dayNumber);
        const dayDefinition = simulator.getDayTypeDefinition(dayType);
        const metrics = simulator.simulateDay(dayDefinition);

        daysInMonth.push({
            day: dayNumber,
            date: date,
            dayOfWeek: dayOfWeek,
            dayType: dayType,
            dayTypeName: simulator.getDayTypeName(dayType),
            metrics: metrics
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
                dayCell.dataset.dayType = dayData.dayType;

                // Apply color
                const bgColor = colorMap[dayData.dayType] || '#ccc';
                dayCell.style.backgroundColor = bgColor;

                // Determine text color based on background brightness
                const brightness = getColorBrightness(bgColor);
                const textColor = brightness < 128 ? 'white' : 'black';
                dayCell.style.color = textColor;

                // Format date nicely (14 Oct format)
                const dateStr = dayData.date.toLocaleDateString('en-GB', {
                    day: 'numeric',
                    month: 'short'
                });

                // Content
                dayCell.innerHTML = `
                    <div class="day-number">${dateStr}</div>
                    <div class="day-metrics">
                        <span class="metric-value ${dayData.metrics.profit >= 0 ? 'positive' : 'negative'}">
                            $${dayData.metrics.profit.toFixed(0)}
                        </span>
                        <span class="metric-value">
                            ${dayData.metrics.tasks}
                        </span>
                    </div>
                `;

                // Add click handlers
                dayCell.addEventListener('click', () => {
                    viewController.goToDay(dayData.day);
                });

                dayCell.title = `${dayData.dayTypeName}\nClick to view details`;

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
    const overallMetrics = daysInMonth.reduce((acc, day) => ({
        revenue: acc.revenue + day.metrics.revenue,
        costs: acc.costs + day.metrics.costs,
        profit: acc.profit + day.metrics.profit,
        tasks: acc.tasks + day.metrics.tasks
    }), { revenue: 0, costs: 0, profit: 0, tasks: 0 });

    // Calculate day type breakdown
    const dayTypeBreakdown = {};
    daysInMonth.forEach(day => {
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
        <h5>Simulation Summary</h5>
        <div class="summary-metrics">
            <div class="summary-item">
                <strong>Total Revenue:</strong> $${overallMetrics.revenue.toFixed(2)}
            </div>
            <div class="summary-item">
                <strong>Total Costs:</strong> $${overallMetrics.costs.toFixed(2)}
            </div>
            <div class="summary-item ${overallMetrics.profit >= 0 ? 'positive' : 'negative'}">
                <strong>Total Profit:</strong> $${overallMetrics.profit.toFixed(2)}
                ${overallMetrics.revenue > 0 ? `(${((overallMetrics.profit / overallMetrics.revenue) * 100).toFixed(1)}%)` : ''}
            </div>
            <div class="summary-item">
                <strong>Total Tasks:</strong> ${overallMetrics.tasks}
            </div>
        </div>

        <h5 style="margin-top: 1rem;">Day Type Breakdown</h5>
        <div class="day-type-breakdown">
            ${Object.entries(dayTypeBreakdown).map(([dayType, breakdown]) => {
                const color = colorMap[dayType] || '#ccc';
                const brightness = getColorBrightness(color);
                const textColor = brightness < 128 ? 'white' : 'black';
                const dayTypeName = simulator.getDayTypeName(dayType);
                return `
                    <div class="breakdown-item" style="background-color: ${color}; color: ${textColor};">
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
