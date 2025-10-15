// Playground Multi-Period - Multi-day simulation engine
// Universal Automation Wiki - Simulation Playground

/**
 * Pre-process JSON to convert date expressions outside of strings into quoted strings
 * Example: { "date": date.today + 5 } => { "date": "date.today + 5" }
 */
function preprocessDateExpressions(jsonString) {
    // Pattern to match date expressions that are NOT already in quotes
    // Matches patterns like: date.today, date.start, date.today + 5, date.start - 3
    const dateExprPattern = /:\s*(date\.(today|start)(?:\s*[+\-]\s*\d+)?)\s*([,\}])/g;

    // Replace unquoted date expressions with quoted versions
    return jsonString.replace(dateExprPattern, ': "$1"$3');
}

/**
 * Parse date expressions like "date.today", "date.start", "date.today + 5", "date.start + 3", "2025-01-15"
 */
function parseDateExpression(expr, baseDate = null, startDate = null) {
    if (!expr) return null;

    // If it's already a Date object, return it
    if (expr instanceof Date) return expr;

    // If it's a string in YYYY-MM-DD format, parse it directly
    if (typeof expr === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(expr)) {
        return new Date(expr + 'T00:00:00');
    }

    // If it's a string with date.start (refers to start_date from simulation_config)
    if (typeof expr === 'string' && expr.includes('date.start')) {
        const start = startDate || baseDate || new Date();
        start.setHours(0, 0, 0, 0);

        // Check for arithmetic operations (date.start + 5, date.start - 3)
        const match = expr.match(/date\.start\s*([+\-])\s*(\d+)/);
        if (match) {
            const operator = match[1];
            const days = parseInt(match[2]);
            const result = new Date(start);
            if (operator === '+') {
                result.setDate(result.getDate() + days);
            } else {
                result.setDate(result.getDate() - days);
            }
            return result;
        }

        // Just "date.start"
        return start;
    }

    // If it's a string with date.today
    if (typeof expr === 'string' && expr.includes('date.today')) {
        const today = baseDate || new Date();
        today.setHours(0, 0, 0, 0);

        // Check for arithmetic operations (date.today + 5, date.today - 3)
        const match = expr.match(/date\.today\s*([+\-])\s*(\d+)/);
        if (match) {
            const operator = match[1];
            const days = parseInt(match[2]);
            const result = new Date(today);
            if (operator === '+') {
                result.setDate(result.getDate() + days);
            } else {
                result.setDate(result.getDate() - days);
            }
            return result;
        }

        // Just "date.today"
        return today;
    }

    return null;
}

/**
 * Format a Date object to YYYY-MM-DD
 */
function formatDate(date) {
    if (!date || !(date instanceof Date)) return null;
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * Get day of week from a date (0 = Monday, 6 = Sunday)
 */
function getDayOfWeek(date) {
    if (!date || !(date instanceof Date)) return 0;
    const day = date.getDay();
    // Convert Sunday (0) to 6, and shift others down by 1
    return day === 0 ? 6 : day - 1;
}

/**
 * MultiDaySimulator - Core class for handling multi-period simulations
 * Manages day types, patterns, and simulation day resolution
 */
class MultiDaySimulator {
    constructor(simulationData) {
        this.simulationData = simulationData;
        this.simulation = simulationData?.simulation;
        this.dayTypes = this.simulation?.day_types || {};
        this.calendar = this.simulation?.calendar || null;
        this.simulationConfig = this.simulation?.simulation_config || {};
        this.colorCache = new Map(); // Cache generated colors for day types

        // Parse start date
        this.startDate = this.parseStartDate();
    }

    /**
     * Parse the start_date from simulation_config
     */
    parseStartDate() {
        const startDateExpr = this.simulationConfig.start_date;
        if (!startDateExpr) {
            // Default to today if not specified
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            return today;
        }

        // For start_date, we don't have a startDate yet, so use baseDate (today) as reference
        return parseDateExpression(startDateExpr, new Date(), null) || new Date();
    }

    /**
     * Get the actual calendar date for a simulation day
     */
    getDateForDay(dayNumber) {
        if (!this.startDate) return null;
        const date = new Date(this.startDate);
        date.setDate(date.getDate() + (dayNumber - 1));
        return date;
    }

    /**
     * Get simulation day number from a calendar date
     */
    getDayNumberFromDate(date) {
        if (!this.startDate || !date) return null;
        const diffTime = date.getTime() - this.startDate.getTime();
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        return diffDays + 1;
    }

    /**
     * Detect if this is a multi-period simulation
     */
    isMultiPeriod() {
        return !!(this.simulation?.day_types && this.simulation?.calendar);
    }

    /**
     * Get the total number of simulation days
     * If no duration_days specified, calculate days to end of current month from start_date
     */
    getTotalDays() {
        if (this.simulationConfig.duration_days) {
            return this.simulationConfig.duration_days;
        }

        // Calculate days to end of current month
        if (this.startDate) {
            const endOfMonth = new Date(this.startDate.getFullYear(), this.startDate.getMonth() + 1, 0);
            const diffTime = endOfMonth.getTime() - this.startDate.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
            return diffDays;
        }

        return 30; // Default fallback
    }

    /**
     * Get the day type for a specific simulation day (1-indexed)
     */
    getDayTypeForDay(dayNumber) {
        if (!this.calendar || !this.calendar.pattern) {
            return null;
        }

        // Check overrides first (supports both day numbers and dates)
        if (this.calendar.overrides) {
            for (const override of this.calendar.overrides) {
                // Check if override uses date format
                if (override.date) {
                    const overrideDate = parseDateExpression(override.date, this.startDate, this.startDate);
                    const dayDate = this.getDateForDay(dayNumber);
                    if (overrideDate && dayDate &&
                        formatDate(overrideDate) === formatDate(dayDate)) {
                        return override.type;
                    }
                }
                // Check if override uses day number (legacy support)
                else if (override.day === dayNumber) {
                    return override.type;
                }
            }
        }

        // Calculate based on cycle pattern
        const cycleLength = this.calendar.cycle_length || 7;
        const cyclePosition = ((dayNumber - 1) % cycleLength) + 1; // 1-indexed within cycle

        const patternEntry = this.calendar.pattern.find(p => p.day === cyclePosition);
        return patternEntry ? patternEntry.type : null;
    }

    /**
     * Get the definition (full single-day simulation) for a day type
     */
    getDayTypeDefinition(dayType) {
        if (!dayType || !this.dayTypes[dayType]) {
            return null;
        }

        const dayTypeData = this.dayTypes[dayType];

        // If there's a nested "definition" key, use it
        if (dayTypeData.definition) {
            return dayTypeData.definition;
        }

        // Otherwise, the day type data IS the definition
        // Extract everything except the "name" field
        const { name, ...definition } = dayTypeData;
        return definition;
    }

    /**
     * Get day type name for display
     */
    getDayTypeName(dayType) {
        if (!dayType || !this.dayTypes[dayType]) {
            return dayType || 'Unknown';
        }
        return this.dayTypes[dayType].name || dayType;
    }

    /**
     * Simulate a single day and return metrics
     */
    simulateDay(dayDefinition) {
        if (!dayDefinition) {
            return { revenue: 0, costs: 0, profit: 0, tasks: 0 };
        }

        const tasks = dayDefinition.tasks || [];
        const objects = dayDefinition.objects || [];
        const actors = objects.filter(o => o.type === 'actor');
        const resources = objects.filter(o => o.type === 'resource' || o.type === 'product');

        // Calculate labor costs
        let totalLaborCost = 0;
        const actorCostMap = new Map(actors.map(a => [a.id, a.properties?.cost_per_hour || 0]));

        for (const task of tasks) {
            const costPerHour = actorCostMap.get(task.actor_id) || 0;
            const durationHours = (task.duration || 0) / 60;
            totalLaborCost += costPerHour * durationHours;
        }

        // Calculate resource costs and revenue
        let totalResourceCost = 0;
        let totalRevenue = 0;
        const resourceMap = new Map(resources.map(r => [r.id, r.properties]));

        for (const task of tasks) {
            // Old-style consumes/produces
            for (const [resId, amount] of Object.entries(task.consumes || {})) {
                const props = resourceMap.get(resId);
                const cost = props?.cost_per_unit || props?.unit_cost || 0;
                totalResourceCost += cost * amount;
            }
            for (const [resId, amount] of Object.entries(task.produces || {})) {
                const props = resourceMap.get(resId);
                const revenue = props?.revenue_per_unit || props?.sale_price || 0;
                totalRevenue += revenue * amount;
            }

            // New-style interactions
            for (const interaction of (task.interactions || [])) {
                const obj = resources.find(r => r.id === interaction.object_id);
                if (obj && (obj.type === 'resource' || obj.type === 'product')) {
                    // Handle interaction_type format (consume/create/produce)
                    if (interaction.interaction_type && interaction.quantity) {
                        const quantity = interaction.quantity;
                        if (interaction.interaction_type === 'consume') {
                            const cost = obj.properties?.cost_per_unit || obj.properties?.unit_cost || 0;
                            totalResourceCost += cost * quantity;
                        } else if (interaction.interaction_type === 'create' || interaction.interaction_type === 'produce') {
                            const revenue = obj.properties?.revenue_per_unit || obj.properties?.sale_price || 0;
                            totalRevenue += revenue * quantity;
                        }
                    }
                    // Handle property_changes format (legacy)
                    else if (interaction.property_changes?.quantity) {
                        const deltaAmount = interaction.property_changes.quantity.delta || 0;
                        if (deltaAmount < 0) {
                            const cost = obj.properties?.cost_per_unit || obj.properties?.unit_cost || 0;
                            totalResourceCost += cost * Math.abs(deltaAmount);
                        } else if (deltaAmount > 0) {
                            const revenue = obj.properties?.revenue_per_unit || obj.properties?.sale_price || 0;
                            totalRevenue += revenue * deltaAmount;
                        }
                    }
                }
            }
        }

        const totalCosts = totalLaborCost + totalResourceCost;
        const profit = totalRevenue - totalCosts;

        return {
            revenue: totalRevenue,
            costs: totalCosts,
            profit: profit,
            tasks: tasks.length,
            laborCost: totalLaborCost,
            resourceCost: totalResourceCost
        };
    }

    /**
     * Simulate a range of days and return results
     */
    simulateRange(startDay, numDays) {
        const results = [];

        for (let i = 0; i < numDays; i++) {
            const currentDay = startDay + i;
            const dayType = this.getDayTypeForDay(currentDay);
            const dayDefinition = this.getDayTypeDefinition(dayType);

            const metrics = this.simulateDay(dayDefinition);

            results.push({
                day: currentDay,
                dayType: dayType,
                dayTypeName: this.getDayTypeName(dayType),
                metrics: metrics
            });
        }

        return results;
    }

    /**
     * Aggregate metrics by week
     */
    aggregateByWeek(dailyResults) {
        const weeks = [];
        let currentWeek = [];
        let weekNumber = 1;

        for (const dayResult of dailyResults) {
            currentWeek.push(dayResult);

            if (currentWeek.length === 7 || dayResult === dailyResults[dailyResults.length - 1]) {
                // Calculate week totals
                const weekMetrics = currentWeek.reduce((acc, day) => ({
                    revenue: acc.revenue + day.metrics.revenue,
                    costs: acc.costs + day.metrics.costs,
                    profit: acc.profit + day.metrics.profit,
                    tasks: acc.tasks + day.metrics.tasks
                }), { revenue: 0, costs: 0, profit: 0, tasks: 0 });

                weeks.push({
                    weekNumber: weekNumber,
                    startDay: currentWeek[0].day,
                    endDay: currentWeek[currentWeek.length - 1].day,
                    days: currentWeek,
                    metrics: weekMetrics
                });

                currentWeek = [];
                weekNumber++;
            }
        }

        return weeks;
    }

    /**
     * Get all unique day types used in the simulation
     */
    getAllDayTypes() {
        const types = new Set();
        const totalDays = this.getTotalDays();

        for (let day = 1; day <= totalDays; day++) {
            const dayType = this.getDayTypeForDay(day);
            if (dayType) {
                types.add(dayType);
            }
        }

        return Array.from(types);
    }

    /**
     * Calculate color distance in LAB color space for perceptual difference
     */
    calculateColorDistance(color1, color2) {
        // Convert hex/hsl to RGB
        const getRGB = (color) => {
            if (color.startsWith('#')) {
                const hex = color.substring(1);
                const r = parseInt(hex.substr(0, 2), 16);
                const g = parseInt(hex.substr(2, 2), 16);
                const b = parseInt(hex.substr(4, 2), 16);
                return [r, g, b];
            } else if (color.startsWith('hsl')) {
                const match = color.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
                if (match) {
                    const h = parseInt(match[1]) / 360;
                    const s = parseInt(match[2]) / 100;
                    const l = parseInt(match[3]) / 100;
                    // HSL to RGB conversion
                    let r, g, b;
                    if (s === 0) {
                        r = g = b = l;
                    } else {
                        const hue2rgb = (p, q, t) => {
                            if (t < 0) t += 1;
                            if (t > 1) t -= 1;
                            if (t < 1/6) return p + (q - p) * 6 * t;
                            if (t < 1/2) return q;
                            if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
                            return p;
                        };
                        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
                        const p = 2 * l - q;
                        r = hue2rgb(p, q, h + 1/3);
                        g = hue2rgb(p, q, h);
                        b = hue2rgb(p, q, h - 1/3);
                    }
                    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
                }
            }
            return [128, 128, 128]; // default gray
        };

        const [r1, g1, b1] = getRGB(color1);
        const [r2, g2, b2] = getRGB(color2);

        // Simple Euclidean distance in RGB space (good enough for our purposes)
        return Math.sqrt(Math.pow(r2 - r1, 2) + Math.pow(g2 - g1, 2) + Math.pow(b2 - b1, 2));
    }

    /**
     * Generate a visually distinct color for a day type
     * Dynamically generates colors that are maximally distinct from existing ones
     */
    generateColorForDayType(dayType, allDayTypes) {
        // Check cache first
        if (this.colorCache.has(dayType)) {
            return this.colorCache.get(dayType);
        }

        const index = allDayTypes.indexOf(dayType);
        const existingColors = Array.from(this.colorCache.values());

        let color;

        if (index === 0) {
            // First color - pick a random vibrant color
            const hue = Math.floor(Math.random() * 360);
            color = `hsl(${hue}, 70%, 55%)`;
        } else {
            // Find the most distinct color from existing ones
            let bestColor = null;
            let maxMinDistance = 0;

            // Try multiple candidate colors
            for (let attempt = 0; attempt < 50; attempt++) {
                // Generate candidate using golden ratio and some randomness
                const goldenRatio = 0.618033988749895;
                const baseHue = (index * goldenRatio * 360) % 360;
                const hue = (baseHue + (attempt * 17)) % 360; // Spread attempts
                const saturation = 60 + (attempt % 3) * 10; // 60%, 70%, 80%
                const lightness = 45 + ((attempt / 3) % 3) * 10; // 45%, 55%, 65%

                const candidate = `hsl(${Math.floor(hue)}, ${saturation}%, ${lightness}%)`;

                // Find minimum distance to existing colors
                let minDistance = Infinity;
                for (const existing of existingColors) {
                    const distance = this.calculateColorDistance(candidate, existing);
                    minDistance = Math.min(minDistance, distance);
                }

                // Keep the candidate with the maximum minimum distance
                if (minDistance > maxMinDistance) {
                    maxMinDistance = minDistance;
                    bestColor = candidate;
                }
            }

            color = bestColor;
        }

        this.colorCache.set(dayType, color);
        return color;
    }

    /**
     * Get color map for all day types in the simulation
     */
    getDayTypeColors() {
        const allTypes = this.getAllDayTypes();
        const colorMap = {};

        for (const dayType of allTypes) {
            colorMap[dayType] = this.generateColorForDayType(dayType, allTypes);
        }

        return colorMap;
    }

    /**
     * Get week info for a specific day
     */
    getWeekForDay(dayNumber) {
        const weekNumber = Math.ceil(dayNumber / 7);
        const startDay = (weekNumber - 1) * 7 + 1;
        const endDay = Math.min(startDay + 6, this.getTotalDays());

        return {
            weekNumber: weekNumber,
            startDay: startDay,
            endDay: endDay,
            daysInWeek: endDay - startDay + 1
        };
    }
}

// Export to global scope
window.MultiDaySimulator = MultiDaySimulator;
window.preprocessDateExpressions = preprocessDateExpressions;
