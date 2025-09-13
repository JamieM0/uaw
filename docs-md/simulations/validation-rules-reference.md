# Validation Rules Reference

This comprehensive guide covers all validation rules in the UAW system. Each rule is automatically checked when you edit your simulation in the playground, helping ensure your process models are structurally sound, logically consistent, and ready for business analysis.

## Validation Categories

The validation system organizes rules into logical categories:

- **Structural Integrity**: Basic schema and data consistency checks
- **Resource Flow**: Resource consumption and production validation
- **Scheduling**: Task timing, dependencies, and actor assignments
- **Economic**: Financial analysis and profitability checks
- **Optimization**: Performance improvement suggestions

## Structural Integrity

These rules ensure your simulation data is properly formatted and internally consistent.

### Simulation Root Check
**Rule ID**: `schema.integrity.missing_root`
**Severity**: Error

Ensures the top-level 'simulation' object exists in your JSON.

**What it checks:**
- Root JSON contains a "simulation" key
- Simulation object is properly structured

**Common failure:**
```json
{
  "meta": { ... },
  "objects": [ ... ]
}
```

**Correct format:**
```json
{
  "simulation": {
    "meta": { ... },
    "objects": [ ... ]
  }
}
```

### Unassigned Task Actor
**Rule ID**: `task.integrity.unassigned_actor`
**Severity**: Error

Ensures every task is assigned to a valid, defined actor.

**What it checks:**
- All tasks have an `actor_id` property
- Each `actor_id` corresponds to an existing object
- The referenced object exists in the simulation

**Example failure:**
```json
{
  "tasks": [
    {
      "id": "bake_bread",
      "actor_id": "missing_baker",
      "start": "09:00",
      "duration": 60
    }
  ],
  "objects": [
    {
      "id": "actual_baker",
      "type": "actor",
      "name": "Real Baker"
    }
  ]
}
```

**How to fix:**
- Ensure `actor_id` matches an existing object ID
- Add the missing actor object
- Check for typos in actor IDs

### Unreachable Task Dependency
**Rule ID**: `task.dependency.unreachable`
**Severity**: Error

Ensures every task listed in a 'depends_on' array corresponds to a valid, defined task ID.

**What it checks:**
- All dependency references point to existing tasks
- No circular dependencies exist
- Dependency graph is resolvable

**Example failure:**
```json
{
  "tasks": [
    {
      "id": "mix_dough",
      "depends_on": ["nonexistent_task"],
      "actor_id": "baker"
    }
  ]
}
```

**How to fix:**
- Verify all task IDs in `depends_on` arrays exist
- Remove invalid dependencies
- Check for typos in task names

### Undefined Location
**Rule ID**: `object.spatial.location_undefined`
**Severity**: Error

Ensures every object with a location property is assigned to a valid, defined location from the layout.

**What it checks:**
- Objects with `location` properties reference valid layout locations
- Layout contains all referenced locations
- Location IDs match exactly

**Example failure:**
```json
{
  "layout": {
    "areas": {
      "kitchen": { ... }
    }
  },
  "objects": [
    {
      "id": "baker",
      "type": "actor",
      "properties": {
        "location": "prep_area"
      }
    }
  ]
}
```

**How to fix:**
- Add missing locations to the layout
- Correct location ID spelling
- Remove invalid location references

### Disallowed Object Types
**Rule ID**: `schema.integrity.disallowed_types`
**Severity**: Error

Ensures no objects use internally reserved types that could cause system conflicts.

**What it checks:**
- Objects don't use reserved type names
- Custom types don't conflict with system types
- Type names follow conventions

**Reserved types:**
- `timeline_actors` (used internally by the system)

**Example failure:**
```json
{
  "objects": [
    {
      "id": "special_object",
      "type": "timeline_actors",
      "name": "Invalid Type"
    }
  ]
}
```

**How to fix:**
- Use standard types: `actor`, `equipment`, `resource`, `product`
- Create custom types that don't conflict with reserved names
- Choose descriptive, unique type names

### Invalid Task Duration
**Rule ID**: `task.integrity.invalid_duration`
**Severity**: Error

Ensures all task durations are positive integers.

**What it checks:**
- Duration values are numbers
- Duration is greater than 0
- Duration is a reasonable value

**Example failures:**
```json
{
  "tasks": [
    {
      "id": "invalid_task_1",
      "duration": -30
    },
    {
      "id": "invalid_task_2",
      "duration": "sixty minutes"
    },
    {
      "id": "invalid_task_3",
      "duration": 0
    }
  ]
}
```

**How to fix:**
- Use positive numbers for duration
- Duration should be in minutes
- Remove or correct invalid duration values

### Invalid Start Time Format
**Rule ID**: `task.integrity.invalid_start_time`
**Severity**: Error

Ensures all task start times follow HH:MM string format.

**What it checks:**
- Start times are in "HH:MM" format
- Hours are 00-23, minutes are 00-59
- Values are properly zero-padded

**Example failures:**
```json
{
  "tasks": [
    {
      "id": "bad_time_1",
      "start": "9:30"
    },
    {
      "id": "bad_time_2",
      "start": "25:00"
    },
    {
      "id": "bad_time_3",
      "start": 930
    }
  ]
}
```

**Correct format:**
```json
{
  "tasks": [
    {
      "id": "good_time",
      "start": "09:30"
    }
  ]
}
```

### Invalid Object Reference
**Rule ID**: `task.integrity.invalid_object_reference`
**Severity**: Error

Ensures all tasks reference valid object IDs that exist in the simulation.

**What it checks:**
- Task interactions reference existing objects
- Consumes/produces reference existing resources
- Equipment interactions reference existing equipment

**Example failure:**
```json
{
  "tasks": [
    {
      "id": "mix_dough",
      "consumes": { "nonexistent_flour": 2 },
      "interactions": [
        {
          "object_id": "missing_mixer",
          "property_changes": { ... }
        }
      ]
    }
  ]
}
```

**How to fix:**
- Verify all object IDs exist in the objects array
- Check for typos in object references
- Add missing objects to the simulation

### Display Elements Outside Bounds
**Rule ID**: `display.spatial.elements_outside_bounds`
**Severity**: Warning

Checks if any display elements extend beyond the viewport boundaries of their display.

**What it checks:**
- Screen elements fit within their display's viewport
- Position + dimensions don't exceed display bounds
- Elements are properly positioned

**Example failure:**
```json
{
  "objects": [
    {
      "id": "small_display",
      "type": "display",
      "properties": {
        "resolution": { "width": 800, "height": 600 }
      }
    },
    {
      "id": "oversized_button",
      "type": "screen_element",
      "properties": {
        "display_id": "small_display",
        "position": { "x": 700, "y": 500 },
        "dimensions": { "width": 200, "height": 200 }
      }
    }
  ]
}
```

**How to fix:**
- Resize elements to fit within display bounds
- Adjust element positions
- Increase display resolution if needed

## Resource Flow

These rules validate resource consumption, production, and recipe compliance.

### Negative Stock Check
**Rule ID**: `resource.flow.negative_stock`
**Severity**: Error

Verifies that no consumable resource stock level drops below zero during simulation execution.

**What it checks:**
- Resource quantities remain non-negative throughout
- Consumption tasks don't exceed available stock
- Production and consumption are balanced

**Example failure scenario:**
```json
{
  "objects": [
    {
      "id": "flour",
      "type": "resource",
      "properties": { "quantity": 10 }
    }
  ],
  "tasks": [
    {
      "id": "big_batch",
      "consumes": { "flour": 15 }
    }
  ]
}
```

**How to fix:**
- Increase initial resource quantities
- Reduce consumption amounts
- Add production tasks to replenish resources
- Reorder tasks to produce before consuming

### Recipe Ingredients Check
**Rule ID**: `resource.flow.recipe_violation`
**Severity**: Warning

Checks if tasks producing a composite resource consume all the ingredients defined in the simulation's 'production_recipes' section.

**What it checks:**
- Production tasks follow defined recipes
- All required ingredients are consumed
- Recipe ratios are maintained

**Example recipe definition:**
```json
{
  "simulation": {
    "production_recipes": {
      "bread": {
        "ingredients": {
          "flour": 2,
          "water": 1.5,
          "yeast": 0.1
        }
      }
    },
    "tasks": [
      {
        "id": "make_bread",
        "produces": { "bread": 1 },
        "consumes": { "flour": 2 }
      }
    ]
  }
}
```

**Issue**: Missing water and yeast consumption

**How to fix:**
- Include all recipe ingredients in task consumption
- Update recipe definitions to match actual processes
- Add separate tasks for ingredient preparation

### Unused Resource
**Rule ID**: `resource.definition.unused`
**Severity**: Info

Flags consumable resources that are defined in the simulation but are never consumed or produced by any task.

**What it checks:**
- All defined resources are used in at least one task
- Resources appear in consumes, produces, or interactions
- No orphaned resource definitions exist

**Example warning:**
```json
{
  "objects": [
    {
      "id": "salt",
      "type": "resource",
      "properties": { "quantity": 5 }
    },
    {
      "id": "flour",
      "type": "resource",
      "properties": { "quantity": 10 }
    }
  ],
  "tasks": [
    {
      "id": "bake_bread",
      "consumes": { "flour": 2 }
    }
  ]
}
```

**Issue**: Salt is defined but never used

**How to fix:**
- Remove unused resource definitions
- Add tasks that use the resource
- Include in existing task consumption

## Scheduling

These rules ensure tasks are properly scheduled and don't conflict with each other.

### Actor Task Overlap
**Rule ID**: `actor.scheduling.overlap`
**Severity**: Error

Checks if any single actor is assigned to multiple tasks that overlap in time.

**What it checks:**
- Actors aren't double-booked
- Task time ranges don't overlap for the same actor
- Schedule conflicts are identified

**Example failure:**
```json
{
  "tasks": [
    {
      "id": "task_1",
      "actor_id": "worker",
      "start": "09:00",
      "duration": 60
    },
    {
      "id": "task_2",
      "actor_id": "worker",
      "start": "09:30",
      "duration": 45
    }
  ]
}
```

**Issue**: Worker has overlapping tasks from 09:30-10:00

**How to fix:**
- Adjust task start times to prevent overlap
- Assign tasks to different actors
- Reduce task durations
- Add task dependencies to sequence properly

### Task Dependency Timing
**Rule ID**: `temporal.dependency.violation`
**Severity**: Warning

Ensures that no task starts before its declared dependencies have finished.

**What it checks:**
- Dependent tasks start after prerequisites complete
- Dependency timing is logically consistent
- No temporal paradoxes exist

**Example failure:**
```json
{
  "tasks": [
    {
      "id": "prep_ingredients",
      "start": "09:00",
      "duration": 30
    },
    {
      "id": "mix_dough",
      "depends_on": ["prep_ingredients"],
      "start": "09:15",
      "duration": 20
    }
  ]
}
```

**Issue**: mix_dough starts before prep_ingredients finishes

**How to fix:**
- Adjust start times to respect dependencies
- Update dependency relationships
- Modify task durations appropriately

### Task Proximity Check
**Rule ID**: `task.spatial.unmet_proximity_requirement`
**Severity**: Error

Checks if the actor and all required equipment/resources for a task are in the same location as the task itself.

**What it checks:**
- Task location matches actor location
- Required equipment is in the same location
- Resources are accessible from task location
- Spatial consistency is maintained

**Example failure:**
```json
{
  "objects": [
    {
      "id": "baker",
      "type": "actor",
      "properties": { "location": "prep_area" }
    },
    {
      "id": "oven",
      "type": "equipment",
      "properties": { "location": "oven_area" }
    }
  ],
  "tasks": [
    {
      "id": "bake_bread",
      "actor_id": "baker",
      "location": "oven_area",
      "interactions": [
        {
          "object_id": "oven",
          "property_changes": { ... }
        }
      ]
    }
  ]
}
```

**Issue**: Baker is in prep_area but task is in oven_area

**How to fix:**
- Move actor to correct location
- Add movement tasks to transport actor
- Adjust task location to match actor
- Update object locations as needed

### Missing Buffer Time
**Rule ID**: `scheduling.optimization.missing_buffer`
**Severity**: Info

Suggests adding a small buffer between consecutive tasks for the same actor to improve realism.

**What it checks:**
- Time gaps between consecutive actor tasks
- Minimum buffer time (default: 5 minutes)
- Realistic scheduling practices

**Example suggestion:**
```json
{
  "tasks": [
    {
      "id": "task_1",
      "actor_id": "worker",
      "start": "09:00",
      "duration": 30
    },
    {
      "id": "task_2",
      "actor_id": "worker",
      "start": "09:30",
      "duration": 20
    }
  ]
}
```

**Suggestion**: Add 5-minute buffer between tasks

**How to improve:**
- Add buffer time between consecutive tasks
- Account for setup/cleanup time
- Include travel time between locations
- Make scheduling more realistic

## Equipment State Logic

### Equipment State Logic
**Rule ID**: `equipment.state.logic`
**Severity**: Error

Checks for logical consistency in equipment usage, such as using a 'dirty' mixer or equipment that is already in use.

**What it checks:**
- Equipment state transitions are logical
- Equipment isn't used in impossible states
- State changes follow realistic patterns
- No conflicting equipment usage

**Example failure:**
```json
{
  "objects": [
    {
      "id": "mixer",
      "type": "equipment",
      "properties": { "state": "dirty" }
    }
  ],
  "tasks": [
    {
      "id": "mix_ingredients",
      "interactions": [
        {
          "object_id": "mixer",
          "property_changes": {
            "state": { "from": "clean", "to": "in_use" }
          }
        }
      ]
    }
  ]
}
```

**Issue**: Trying to use mixer as "clean" when it's actually "dirty"

**How to fix:**
- Add cleaning tasks before use
- Update initial equipment states
- Correct state transition logic
- Add maintenance workflows

## Economic

Economic validation ensures your simulation is financially realistic and profitable.

### Negative Profitability
**Rule ID**: `economic.profitability.negative_margin`
**Severity**: Warning

Calculates total revenue from final products and subtracts total costs of labor and consumed resources. Flags if the result is negative.

**What it checks:**
- Total revenue from products with `revenue_per_unit`
- Labor costs from actor `cost_per_hour`
- Resource costs from `cost_per_unit`
- Overall profitability calculation

**Calculation:**
- **Revenue**: Σ(product_quantity × revenue_per_unit) for final products
- **Labor Cost**: Σ(task_duration_hours × actor_cost_per_hour)
- **Resource Cost**: Σ(consumed_quantity × resource_cost_per_unit)
- **Profit**: Revenue - (Labor Cost + Resource Cost)

**Example profitable setup:**
```json
{
  "objects": [
    {
      "id": "baker",
      "type": "actor",
      "properties": { "cost_per_hour": 20 }
    },
    {
      "id": "flour",
      "type": "resource",
      "properties": { "cost_per_unit": 0.50 }
    },
    {
      "id": "bread",
      "type": "product",
      "properties": { "revenue_per_unit": 8.00 }
    }
  ],
  "tasks": [
    {
      "id": "bake_bread",
      "actor_id": "baker",
      "duration": 60,
      "consumes": { "flour": 2 },
      "produces": { "bread": 4 }
    }
  ]
}
```

**Analysis:**
- Revenue: 4 × $8.00 = $32.00
- Labor: 1 hour × $20.00 = $20.00
- Materials: 2 × $0.50 = $1.00
- **Profit: $32.00 - $21.00 = $11.00** ✓

**How to improve profitability:**
- Increase product prices (`revenue_per_unit`)
- Reduce labor costs or improve efficiency
- Find cheaper material suppliers
- Optimize production processes
- Increase production volume

## Validation Best Practices

### Regular Validation
- Run validation frequently during simulation development
- Address errors before warnings
- Use info-level suggestions to improve realism

### Error Resolution Priority
1. **Structural Integrity Errors**: Fix data format issues first
2. **Resource Flow Errors**: Ensure resource balance
3. **Scheduling Errors**: Resolve timing conflicts
4. **Equipment Logic Errors**: Fix state inconsistencies
5. **Warnings and Info**: Improve optimization and realism

### Common Validation Workflows

#### Starting a New Simulation
1. Create basic structure and validate schema
2. Add objects and check for invalid references
3. Add tasks and resolve scheduling conflicts
4. Balance resource flow
5. Optimize for economic viability

#### Debugging Validation Errors
1. Read the specific error message carefully
2. Locate the problematic object or task
3. Check for typos in IDs and references
4. Verify data types and formats
5. Test incremental changes

#### Performance Optimization
1. Address all error-level issues first
2. Review warning-level suggestions
3. Implement info-level optimizations
4. Test economic viability
5. Validate realistic scheduling

The validation system is designed to guide you toward creating accurate, realistic, and business-ready process simulations. Use these rules as a checklist to ensure your simulations meet professional standards.