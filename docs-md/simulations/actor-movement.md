# Actor Movement in UAW Simulations

This guide explains how to model actor movement between physical locations in UAW simulations. The system provides two distinct methods for tracking actor movement, each suited to different use cases.

## Overview

Actor movement is critical for realistic process simulations. Whether modeling warehouse operations, manufacturing workflows, or service processes, actors need to move between locations to perform their tasks. The UAW validation system now includes **timeline-aware location tracking** that simulates actor positions throughout the entire process.

## Two Methods for Movement

### Method 1: Property Changes (Timeline-Aware)

Use `property_changes` to track location changes within a task's interactions. This method is ideal when movement is incidental to the task's primary purpose.

**Example:**
```json
{
  "id": "retrieve_and_move",
  "actor_id": "warehouse_worker",
  "start": "10:00",
  "duration": 8,
  "location": "storage_area",
  "interactions": [
    {
      "object_id": "warehouse_worker",
      "property_changes": {
        "location": {
          "from": "loading_dock",
          "to": "storage_area"
        }
      }
    },
    {
      "object_id": "inventory",
      "property_changes": {
        "quantity": { "delta": 5 }
      }
    }
  ]
}
```

**When to use:**
- Movement is part of a larger action
- You want to combine location change with other property updates
- Task duration already includes travel time
- Movement doesn't need to be shown as a distinct timeline activity

**Timeline behavior:**
- Actor location updates when the task **completes**
- Validation checks location at task **start time** against simulated position
- Location change is combined with other property updates in one task

### Method 2: Movement Task Type

Use the dedicated `type: "movement"` task to explicitly show travel as a distinct activity on the timeline.

**Example:**
```json
{
  "id": "walk_to_warehouse",
  "type": "movement",
  "actor_id": "forklift_operator",
  "start": "09:00",
  "duration": 5,
  "from_location": "loading_dock",
  "to_location": "warehouse",
  "movement_speed": 1.5
}
```

**Fields:**
- `type`: Must be `"movement"` to identify this as a movement task
- `from_location`: Starting location (must match actor's current location)
- `to_location`: Destination location (must exist in layout)
- `movement_speed`: (Optional) Speed in meters/second for duration calculation

**When to use:**
- Movement is the primary purpose of the task
- You want to explicitly show travel time in the timeline
- You need to track movement speed or distance
- Movement should be visible as a distinct activity

**Timeline behavior:**
- Actor location updates when the movement task **completes**
- Validation checks that actor is in `from_location` at task start
- Movement appears as a distinct task on the timeline

## Timeline Simulation

The validation system simulates the entire timeline to track actor locations:

1. **Initialization**: Each actor starts at their initial `location` property
2. **Simulation**: As the timeline progresses, the system tracks location changes
3. **Updates**: When a task with location changes completes, actor position updates
4. **Validation**: Each task validates that the actor is in the correct location at its start time

### Timeline Flow Example

```
Timeline Simulation:
┌─────────────────────────────────────────────────────────────┐
│ 09:00 - Actor "baker" starts at "prep_area" (initial)       │
│ 09:00-09:20 - Task "prep_dough" at prep_area (✓ valid)     │
│ 09:20 - Task completes, actor still at "prep_area"          │
│ 09:20-09:22 - Movement task to "oven_area" (✓ valid)       │
│ 09:22 - Movement completes, actor now at "oven_area"        │
│ 09:22-09:52 - Task "bake_bread" at oven_area (✓ valid)     │
└─────────────────────────────────────────────────────────────┘
```

## Complete Examples

### Example 1: Manufacturing Process

This example shows a manufacturing process with explicit movement between workstations:

```json
{
  "simulation": {
    "layout": {
      "areas": {
        "assembly_station": {
          "name": "Assembly Station",
          "type": "physical",
          "coordinates": { "x": 0, "y": 0, "width": 10, "height": 10 }
        },
        "quality_check": {
          "name": "Quality Check Station",
          "type": "physical",
          "coordinates": { "x": 15, "y": 0, "width": 8, "height": 8 }
        },
        "packaging_area": {
          "name": "Packaging Area",
          "type": "physical",
          "coordinates": { "x": 28, "y": 0, "width": 12, "height": 10 }
        }
      }
    },
    "objects": [
      {
        "id": "technician",
        "type": "actor",
        "name": "Assembly Technician",
        "properties": {
          "location": "assembly_station",
          "cost_per_hour": 22.50
        }
      },
      {
        "id": "assembly_tools",
        "type": "equipment",
        "name": "Assembly Tools",
        "properties": {
          "location": "assembly_station",
          "state": "ready"
        }
      },
      {
        "id": "quality_scanner",
        "type": "equipment",
        "name": "Quality Scanner",
        "properties": {
          "location": "quality_check",
          "state": "ready"
        }
      }
    ],
    "tasks": [
      {
        "id": "assemble_unit",
        "actor_id": "technician",
        "start": "09:00",
        "duration": 15,
        "location": "assembly_station",
        "interactions": [
          {
            "object_id": "assembly_tools",
            "property_changes": {
              "state": { "from": "ready", "to": "in_use" }
            }
          }
        ]
      },
      {
        "id": "walk_to_quality_check",
        "type": "movement",
        "actor_id": "technician",
        "start": "09:15",
        "duration": 2,
        "from_location": "assembly_station",
        "to_location": "quality_check",
        "movement_speed": 1.4
      },
      {
        "id": "inspect_unit",
        "actor_id": "technician",
        "start": "09:17",
        "duration": 8,
        "location": "quality_check",
        "interactions": [
          {
            "object_id": "quality_scanner",
            "property_changes": {
              "state": { "from": "ready", "to": "scanning" }
            }
          }
        ]
      },
      {
        "id": "walk_to_packaging",
        "type": "movement",
        "actor_id": "technician",
        "start": "09:25",
        "duration": 2,
        "from_location": "quality_check",
        "to_location": "packaging_area"
      },
      {
        "id": "package_unit",
        "actor_id": "technician",
        "start": "09:27",
        "duration": 10,
        "location": "packaging_area"
      }
    ]
  }
}
```

**Key Points:**
- Technician moves through three stations
- Each movement is shown as a distinct task with realistic duration
- Validation ensures technician is in correct location for each work task
- Movement speed is tracked for realistic timing

### Example 2: Combined Movement and Actions

This example shows movement combined with other property changes:

```json
{
  "simulation": {
    "layout": {
      "areas": {
        "office": {
          "name": "Office",
          "type": "physical"
        },
        "server_room": {
          "name": "Server Room",
          "type": "physical"
        }
      }
    },
    "objects": [
      {
        "id": "it_admin",
        "type": "actor",
        "name": "IT Administrator",
        "properties": {
          "location": "office",
          "access_level": "standard"
        }
      },
      {
        "id": "server",
        "type": "equipment",
        "name": "Production Server",
        "properties": {
          "location": "server_room",
          "state": "running"
        }
      }
    ],
    "tasks": [
      {
        "id": "prepare_and_move_to_server_room",
        "actor_id": "it_admin",
        "start": "14:00",
        "duration": 5,
        "location": "server_room",
        "interactions": [
          {
            "object_id": "it_admin",
            "property_changes": {
              "access_level": { "from": "standard", "to": "elevated" },
              "location": { "from": "office", "to": "server_room" }
            }
          }
        ]
      },
      {
        "id": "perform_maintenance",
        "actor_id": "it_admin",
        "start": "14:05",
        "duration": 20,
        "location": "server_room",
        "interactions": [
          {
            "object_id": "server",
            "property_changes": {
              "state": { "from": "running", "to": "maintenance" }
            }
          }
        ]
      },
      {
        "id": "complete_and_return",
        "actor_id": "it_admin",
        "start": "14:25",
        "duration": 3,
        "location": "server_room",
        "interactions": [
          {
            "object_id": "server",
            "property_changes": {
              "state": { "from": "maintenance", "to": "running" }
            }
          },
          {
            "object_id": "it_admin",
            "property_changes": {
              "access_level": { "from": "elevated", "to": "standard" },
              "location": { "from": "server_room", "to": "office" }
            }
          }
        ]
      }
    ]
  }
}
```

**Key Points:**
- Movement is combined with permission changes
- Both properties update when task completes
- Useful when movement is part of a larger workflow step
- Reduces number of separate tasks needed

### Example 3: Multi-Actor Movement

This example shows multiple actors moving through a shared workspace:

```json
{
  "simulation": {
    "layout": {
      "areas": {
        "prep_station_a": { "name": "Prep Station A", "type": "physical" },
        "prep_station_b": { "name": "Prep Station B", "type": "physical" },
        "oven": { "name": "Commercial Oven", "type": "physical" },
        "plating_area": { "name": "Plating Area", "type": "physical" }
      }
    },
    "objects": [
      {
        "id": "chef_1",
        "type": "actor",
        "name": "Head Chef",
        "properties": { "location": "prep_station_a" }
      },
      {
        "id": "chef_2",
        "type": "actor",
        "name": "Sous Chef",
        "properties": { "location": "prep_station_b" }
      }
    ],
    "tasks": [
      {
        "id": "chef1_prep",
        "actor_id": "chef_1",
        "start": "12:00",
        "duration": 20,
        "location": "prep_station_a"
      },
      {
        "id": "chef2_prep",
        "actor_id": "chef_2",
        "start": "12:00",
        "duration": 15,
        "location": "prep_station_b"
      },
      {
        "id": "chef1_to_oven",
        "type": "movement",
        "actor_id": "chef_1",
        "start": "12:20",
        "duration": 1,
        "from_location": "prep_station_a",
        "to_location": "oven"
      },
      {
        "id": "chef2_to_oven",
        "type": "movement",
        "actor_id": "chef_2",
        "start": "12:15",
        "duration": 1,
        "from_location": "prep_station_b",
        "to_location": "oven"
      },
      {
        "id": "chef2_cook",
        "actor_id": "chef_2",
        "start": "12:16",
        "duration": 10,
        "location": "oven"
      },
      {
        "id": "chef1_cook",
        "actor_id": "chef_1",
        "start": "12:21",
        "duration": 12,
        "location": "oven"
      }
    ]
  }
}
```

**Key Points:**
- Each actor's location is tracked independently
- Actors can move to same location at different times
- Timeline simulation handles multiple concurrent movements
- Validation ensures each actor is in correct location for their tasks

## Validation Rules

### Task Proximity Validation

The `task.spatial.unmet_proximity_requirement` rule validates:

1. **Initial Location Check**: Actor starts in a valid location from their properties
2. **Movement Tracking**: All location changes are tracked chronologically
3. **Task Validation**: At each task's start time, validates actor is in required location
4. **Equipment Proximity**: Validates equipment/resources are in same location as task

### Common Validation Errors

#### Error: "Actor not in required location"
```
Task 'bake_bread' requires actor 'baker' to be in 'oven_area',
but actor is currently in 'prep_area'
```

**Causes:**
- No movement task to transport actor
- Movement task starts/completes after work task starts
- Incorrect from_location in movement task
- Missing location property change

**Solutions:**
- Add movement task before the work task
- Adjust timing: ensure movement completes before work starts
- Verify from_location matches actor's simulated location
- Add location property_change in preceding task

#### Error: "Movement from_location mismatch"
```
Movement task 'walk_to_storage' has from_location 'loading_dock',
but actor 'worker' is currently in 'office'
```

**Causes:**
- Previous task changed location but movement task wasn't updated
- Initial location property is incorrect
- Missing intermediate movement task

**Solutions:**
- Check earlier tasks for location changes
- Update from_location to match actual simulated position
- Add intermediate movement tasks to connect locations
- Verify initial actor location property

#### Error: "Task starts before movement completes"
```
Task 'assemble_part' starts at 09:15, but movement to required
location completes at 09:17
```

**Causes:**
- Task scheduled too early
- Movement duration is too long
- Timing miscalculation

**Solutions:**
- Adjust task start time to be ≥ movement end time
- Reduce movement duration if realistic
- Add buffer time between movement and task

## Best Practices

### 1. Realistic Movement Duration

Calculate movement time based on distance and speed:

```
Duration (minutes) = Distance (meters) / Speed (m/s) / 60

Example:
- Distance: 20 meters
- Walking speed: 1.4 m/s (typical)
- Duration: 20 / 1.4 / 60 ≈ 0.24 minutes (round to 1 minute minimum)
```

### 2. Consistent Timing

Ensure no timing gaps or overlaps:

```json
// Correct timing
{
  "tasks": [
    { "id": "work_1", "start": "09:00", "duration": 15 },      // Ends 09:15
    { "id": "move", "start": "09:15", "duration": 2 },         // Ends 09:17
    { "id": "work_2", "start": "09:17", "duration": 10 }       // Can start
  ]
}

// Incorrect timing
{
  "tasks": [
    { "id": "work_1", "start": "09:00", "duration": 15 },      // Ends 09:15
    { "id": "move", "start": "09:15", "duration": 2 },         // Ends 09:17
    { "id": "work_2", "start": "09:16", "duration": 10 }       // ERROR!
  ]
}
```

### 3. Use Dependencies

Add `depends_on` to enforce sequential execution:

```json
{
  "tasks": [
    {
      "id": "prep_work",
      "start": "09:00",
      "duration": 15
    },
    {
      "id": "move_to_next_station",
      "type": "movement",
      "start": "09:15",
      "duration": 2,
      "depends_on": ["prep_work"]
    },
    {
      "id": "assembly_work",
      "start": "09:17",
      "duration": 20,
      "depends_on": ["move_to_next_station"]
    }
  ]
}
```

### 4. Choose the Right Method

**Use Movement Task Type when:**
- Movement takes significant time (> 1 minute)
- Movement should be visible on timeline
- Tracking movement speed/distance is important
- Movement is the task's primary purpose

**Use Property Changes when:**
- Movement is quick (< 1 minute)
- Movement is combined with other actions
- You want to reduce task count
- Movement is incidental to main action

### 5. Document Movement Patterns

Use clear task IDs and add comments in your simulation JSON:

```json
{
  "tasks": [
    {
      "id": "walk_from_prep_to_oven",
      "type": "movement",
      "actor_id": "baker",
      "start": "09:20",
      "duration": 2,
      "from_location": "prep_area",
      "to_location": "oven_area",
      "movement_speed": 1.4
    }
  ]
}
```

## Troubleshooting

### Location Tracking Issues

**Problem**: "I added a movement task but validation still fails"

**Debugging steps:**
1. Check movement task completes before next task starts
2. Verify from_location matches actor's previous location
3. Ensure to_location exists in layout
4. Check for typos in location IDs
5. Review timeline chronologically to track location changes

**Solution**: Use the playground's validation panel to see detailed error messages showing:
- Actor's expected location
- Actor's actual simulated location
- Task timing information

### Performance Considerations

For very large simulations with many actors and movements:

1. **Consolidate movements** where possible using property_changes
2. **Use movement tasks** only when movement needs to be visible
3. **Group related actions** in single tasks when realistic
4. **Optimize task count** without sacrificing accuracy

## Summary

Actor movement in UAW simulations provides:

- **Timeline-aware tracking** of actor positions throughout the process
- **Two flexible methods** for modeling movement (dedicated tasks vs property changes)
- **Validation rules** that ensure spatial consistency
- **Realistic process modeling** that accounts for travel time and location constraints

By following these guidelines and using the appropriate movement method for your use case, you can create accurate, validated simulations that realistically model real-world processes with actor movement.
