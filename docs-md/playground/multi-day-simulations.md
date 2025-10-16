# Multi-Day Simulations

Multi-day simulations allow you to model processes that span multiple days with varying operational patterns. This feature enables you to simulate realistic business operations with weekdays, weekends, maintenance days, delivery days, and custom day types.

## Overview

The multi-day simulation system introduces several powerful concepts:

- **Day Types**: Templates that define what happens during a specific type of day
- **Calendar**: Defines which day type is used for each simulation day
- **Patterns**: Repeating cycles of day types (e.g., weekly patterns)
- **Overrides**: Special dates that use different day types than the pattern suggests
- **Date Expressions**: Flexible date referencing system using shortcuts

## Key Concepts

### Day Types

Day types are templates that define a complete single-day simulation. Each day type can have:

- **Configuration**: Time ranges and settings specific to that day type
- **Locations**: Physical or logical spaces used during that day
- **Objects**: Actors, equipment, resources, and products for that day
- **Tasks**: The activities that occur during that day type

Example day type structure:

```json
{
  "day_types": {
    "weekday": {
      "name": "Weekday Operations",
      "config": {
        "start_time": "06:00",
        "end_time": "18:00"
      },
      "locations": [...],
      "objects": [...],
      "tasks": [...]
    },
    "weekend": {
      "name": "Weekend Service",
      "config": {
        "start_time": "08:00",
        "end_time": "16:00"
      },
      "locations": [...],
      "objects": [...],
      "tasks": [...]
    }
  }
}
```

### Calendar System

The calendar system determines which day type is used for each simulation day. It consists of:

#### Pattern

A repeating cycle that defines the default day types. Most commonly used for weekly patterns:

```json
{
  "calendar": {
    "cycle_length": 7,
    "pattern": [
      { "day": 1, "type": "weekday" },
      { "day": 2, "type": "weekday" },
      { "day": 3, "type": "weekday" },
      { "day": 4, "type": "weekday" },
      { "day": 5, "type": "weekday" },
      { "day": 6, "type": "weekend" },
      { "day": 7, "type": "closed" }
    ]
  }
}
```

#### Overrides

Specific dates that deviate from the pattern (holidays, maintenance days, special events):

```json
{
  "calendar": {
    "cycle_length": 7,
    "pattern": [...],
    "overrides": [
      { "date": "date.start + 7", "type": "maintenance" },
      { "date": "date.start + 10", "type": "delivery" },
      { "date": "2025-12-25", "type": "closed" }
    ]
  }
}
```

### Date Expressions

Multi-day simulations support flexible date expressions for easy date referencing:

#### Date Shortcuts

- `date.today` - Resolves to the current date (today)
- `date.start` - Resolves to the simulation start date
- `date.today + n` - n days after today
- `date.today - n` - n days before today
- `date.start + n` - n days after the simulation start date
- `date.start - n` - n days before the simulation start date

#### Explicit Dates

You can also use explicit ISO date format:

- `2025-12-25` - Christmas Day 2025
- `2026-01-01` - New Year's Day 2026

#### Examples

```json
{
  "simulation_config": {
    "start_date": "date.today"
  },
  "calendar": {
    "overrides": [
      { "date": "date.start + 14", "type": "maintenance" },
      { "date": "2025-12-25", "type": "holiday" },
      { "date": "date.today + 30", "type": "special_event" }
    ]
  }
}
```

## Simulation Configuration

Multi-day simulations use a `simulation_config` object to define overall settings:

```json
{
  "simulation_config": {
    "start_date": "date.today",
    "duration_days": 30
  }
}
```

### Configuration Options

- **start_date**: When the simulation begins (supports date expressions)
- **duration_days**: Total number of days to simulate (optional)

## Visualization Views

Multi-day simulations can be viewed in multiple ways in the playground:

### Calendar View

A month-by-month calendar showing all simulation days with:
- Color-coded day types
- Daily profit/revenue at a glance
- Task counts per day
- Navigation between months
- Click any day to view detailed timeline

### Timeline View

Traditional single-day timeline showing:
- Detailed task execution for selected day
- Object interactions
- Resource flows
- Time-based visualization

## View Controller

Multi-day simulations use a view controller to manage navigation between different views and days:

```javascript
const viewController = {
  currentView: 'calendar',  // 'calendar', 'week', or 'timeline'
  currentDay: 1,
  currentWeek: 1,
  currentMonthOffset: 0,

  goToDay(dayNumber) {
    // Switch to timeline view for specific day
  },

  goToWeek(weekNumber) {
    // Switch to week view
  },

  goToCalendar() {
    // Switch to calendar view
  }
}
```

## Color Coding

The playground automatically generates visually distinct colors for each day type using a sophisticated color generation algorithm that:

1. Maximizes perceptual distance between colors
2. Ensures good readability (automatic text color selection)
3. Uses HSL color space for vibrant, consistent colors
4. Caches generated colors for performance

## Financial Metrics

Multi-day simulations automatically calculate financial metrics for each day:

- **Revenue**: Total income from products sold
- **Costs**: Total expenses (labor + resources)
- **Profit**: Revenue minus costs
- **Task Count**: Number of tasks executed

These metrics are aggregated:
- Per day
- Per week
- Per month
- Per day type (averages and totals)

## Best Practices

### Designing Day Types

1. **Start Simple**: Create 2-3 basic day types first (e.g., open, closed)
2. **Reuse Objects**: Common objects can appear in multiple day types
3. **Vary Intensity**: Different day types should reflect realistic workload variations
4. **Consider Dependencies**: Tasks within a day should have proper dependencies

### Calendar Planning

1. **Use Patterns**: Weekly patterns work well for most businesses
2. **Strategic Overrides**: Use overrides for holidays, maintenance, special events
3. **Realistic Duration**: 14-30 days provides good balance of detail and overview
4. **Test Patterns**: Verify pattern repeats correctly across weeks

### Performance Considerations

1. **Day Type Complexity**: Keep individual day types focused and efficient
2. **Duration Limits**: Very long simulations (100+ days) may impact performance
3. **Object Reuse**: Reusing object definitions across day types reduces memory

### Financial Accuracy

1. **Consistent Pricing**: Ensure product prices are consistent across day types
2. **Labor Costs**: Account for different staffing levels on different day types
3. **Resource Consumption**: Track inventory properly across multi-day spans
4. **Overhead Costs**: Consider fixed costs vs. variable costs per day type

## Loading Sample Simulations

The playground includes a sample multi-day simulation:

1. Open the playground
2. Click "Load Sample"
3. Select "Coffee Shop (Multi-Period)"
4. Explore the calendar, week, and timeline views

## Technical Implementation

Multi-day simulations are powered by the `MultiDaySimulator` class (`playground-multi-period.js`), which:

- Resolves day types for any simulation day
- Calculates financial metrics per day
- Generates color schemes automatically
- Converts calendar dates to simulation days and vice versa
- Handles date expression parsing

The system is integrated with existing playground components:
- **playground-calendar-view.js**: Month grid calendar rendering
- **playground-week-view.js**: Weekly breakdown views
- **playground-timeline.js**: Enhanced to support multi-day context
- **playground-view-controller.js**: Coordinates view switching and navigation

## Limitations

Current limitations of multi-day simulations:

1. **No Cross-Day Dependencies**: Tasks cannot span multiple days
2. **No State Persistence**: Object states don't carry over between days (yet)
3. **Memory Constraints**: Very large simulations (100+ days with complex day types) may impact browser performance
4. **Date Ranges**: Infinite scrolling works, but only current month's data is calculated at once

## Future Enhancements

Planned improvements:

- Cross-day task dependencies
- Object state persistence between days
- Inventory tracking across multiple days
- More sophisticated financial modeling
- Export/import of calendar templates
- Seasonal pattern support
