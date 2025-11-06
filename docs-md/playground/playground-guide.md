# Simulation Playground Guide

The Simulation Playground is an interactive, web-based tool for creating, editing, visualizing, and validating real-world process simulations. It serves as a complete Integrated Development Environment (IDE) for the Universal Automation Wiki's simulation data.

## Overview

The Playground is designed to give you immediate feedback on your simulation design. You can edit the underlying JSON data and see the changes reflected in a visual timeline in real-time. This tight feedback loop allows for rapid prototyping and refinement of process models.

## Layout

The Playground interface is divided into three main panels:

1.  **JSON Editor Panel (Left):** This panel contains the raw `simulation.json` data for your process. It uses the Monaco editor, providing features like syntax highlighting, auto-formatting, and error checking for the JSON format.
2.  **Simulation Panel (Right):** This is where the simulation is visualized. It has multiple tabs:
    *   **Simulation Render:** Displays an interactive timeline of the process, showing actors, tasks, and their durations.
    *   **Space Editor:** Provides a 2D canvas for defining the physical layout and locations used in the simulation.
    *   **Digital Space:** Advanced 3D editor for digital locations and digital objects with spatial manipulation capabilities.
    *   **Display Editor:** Interface for creating and managing digital displays and screen elements.
3.  **Validation Panel (Bottom):** This panel displays the results of running the simulation against the project's metrics catalog. It shows a summary of errors, warnings, suggestions, and passed checks, helping you identify issues and areas for improvement in your simulation.

## Interacting with the Simulation

The Playground offers several ways to interact with and modify your simulation directly from the UI, which will automatically update the JSON data.

### Timeline Interaction

*   **Move Task:** Click and drag a task block on the timeline to a different actor's lane or to a different time slot. This will update the task's `actor_id` and `start` time.
*   **Resize Task:** Hover over the left or right edge of a task block until the cursor changes to a resize icon. Click and drag to change the task's `duration`.
*   **Jump to Definition:** Clicking on a task block will highlight the corresponding task object in the JSON editor, allowing you to quickly find and edit its details.

### Adding Objects and Tasks

You can use the `+ Object` and `+ Task` buttons in the header to open modals for adding new elements to your simulation. These modals provide a user-friendly form for entering the required data, which is then inserted into the `simulation.json` file.

## Digital Space Editor

The Digital Space Editor provides a way to model digital locations and digital objects. This is essential for simulating modern digital processes.

### Accessing the Digital Space Editor

1. Click the **Digital Space** tab in the Simulation Panel
2. The environment will initialize with your current simulation objects
3. Drag and Drop to create and re-arrange digital locations

### Digital Space Features

#### Object Placement and Management
- **Drag and Drop:** Select digital objects from the object palette and place them in the space
- **Snapping:** X and Z axis snapping for precise positioning
- **Layer Organization:** Organize objects into layers for complex scenes

#### Navigation Controls
- **Pan:** Hold space and move the mouse, or click and hold outside a location while moving the mouse to pan
- **Zoom:** Mouse wheel to zoom in and out (or use the zoom buttons) - zoom sensitivity can be adjusted
- **Zoom-to-fit:** Tap the space bar to zoom-to-fit. Or use the 3rd zoom button.

#### Digital Object Types

**Digital Location**
Digital locations represent virtual spaces that exist within digital systems:

```json
{
  "id": "virtual_warehouse",
  "type": "digital_location",
  "name": "Virtual Warehouse Environment",
  "properties": {
    "environment_type": "warehouse_simulation",
    "coordinate_system": "cartesian_3d",
    "bounds": {
      "x": { "min": -50, "max": 50 },
      "y": { "min": 0, "max": 20 },
      "z": { "min": -50, "max": 50 }
    },
    "lighting": "industrial",
    "physics_enabled": true
  }
}
```

**Digital Object**
Digital objects are virtual items that exist and interact within digital spaces:

```json
{
  "id": "inventory_scanner",
  "type": "digital_object",
  "name": "Digital Inventory Scanner",
  "properties": {
    "digital_type": "scanner_interface",
    "position": { "x": 10, "y": 5, "z": -15 },
    "rotation": { "x": 0, "y": 45, "z": 0 },
    "scale": { "x": 1, "y": 1, "z": 1 },
    "interactive": true,
    "scan_radius": 5.0,
    "digital_location": "virtual_warehouse"
  }
}
```

### Digital Space Workflow Example

```json
{
  "simulation": {
    "objects": [
      {
        "id": "virtual_warehouse",
        "type": "digital_location",
        "name": "Warehouse Management System",
        "properties": {
          "environment_type": "logistics_hub",
          "coordinate_system": "cartesian_3d"
        }
      },
      {
        "id": "inventory_bot",
        "type": "digital_object",
        "name": "Automated Inventory Bot",
        "properties": {
          "digital_type": "autonomous_agent",
          "position": { "x": 0, "y": 0, "z": 0 },
          "movement_speed": 2.5,
          "digital_location": "virtual_warehouse"
        }
      }
    ],
    "tasks": [
      {
        "id": "scan_inventory",
        "actor_id": "inventory_bot",
        "start": "08:00",
        "duration": 30,
        "location": "virtual_warehouse",
        "interactions": [
          {
            "object_id": "inventory_bot",
            "property_changes": {
              "position": {
                "from": { "x": 0, "y": 0, "z": 0 },
                "to": { "x": 25, "y": 0, "z": 10 }
              }
            }
          }
        ]
      }
    ]
  }
}
```

## Display Editor

The Display Editor allows you to create and manage digital displays and screen elements within your simulation. This is crucial for modeling modern digital interfaces and human-computer interaction workflows.

### Display Object Type

Displays represent screens, monitors, or any digital interface elements:

```json
{
  "id": "control_monitor",
  "type": "display",
  "name": "Production Control Monitor",
  "properties": {
    "display_type": "control_interface",
    "resolution": { "width": 1920, "height": 1080 },
    "location": "control_room",
    "viewport": {
      "x": 0, "y": 0, "width": 1920, "height": 1080
    },
    "active": true
  }
}
```

### Screen Element Object Type

Screen elements are interactive components that exist within displays:

```json
{
  "id": "temperature_gauge",
  "type": "screen_element",
  "name": "Oven Temperature Display",
  "properties": {
    "element_type": "label",
    "display_id": "control_monitor",
    "position": { "x": 100, "y": 50 },
    "dimensions": { "width": 200, "height": 30 },
    "text": "Temperature: 180°C",
    "font_size": 16,
    "color": "red",
    "visible": true
  }
}
```

### Display Editor Features

#### Screen Element Types
- **Window:** Container elements that represent application windows or main interface areas
- **Button:** Interactive clickable elements for user input and actions
- **Textbox:** Input fields for text entry and editing
- **Label:** Static text elements for displaying information and field labels
- **Panel:** Container elements for grouping related interface components
- **Menu:** Navigation elements including menu bars, context menus, and dropdown menus
- **Dialog:** Modal windows for user interactions, confirmations, and data entry

#### Display Management
- **Element Positioning:** Drag and drop elements within display boundaries
- **Layering:** Z-index management for overlapping elements
- **Responsive Layout:** Automatic scaling for different display resolutions
- **Animation Timeline:** Sync screen element changes with task timeline

### Complete Display Example

```json
{
  "simulation": {
    "objects": [
      {
        "id": "production_dashboard",
        "type": "display",
        "name": "Production Line Dashboard",
        "properties": {
          "display_type": "dashboard",
          "resolution": { "width": 1920, "height": 1080 },
          "location": "control_room",
          "active": true
        }
      },
      {
        "id": "production_counter",
        "type": "screen_element",
        "name": "Units Produced Counter",
        "properties": {
          "element_type": "label",
          "display_id": "production_dashboard",
          "position": { "x": 50, "y": 50 },
          "dimensions": { "width": 300, "height": 80 },
          "text": "0 units",
          "font_size": 24,
          "color": "green",
          "visible": true
        }
      }
    ],
    "tasks": [
      {
        "id": "update_production_count",
        "actor_id": "system",
        "start": "09:30",
        "duration": 1,
        "interactions": [
          {
            "object_id": "production_counter",
            "property_changes": {
              "text": { "from": "0 units", "to": "1 unit" },
              "color": { "from": "green", "to": "blue" }
            }
          }
        ]
      }
    ]
  }
}
```

## The `simulation.json` Schema: A Deep Dive

The core of every simulation is a single JSON object. Understanding its structure is key to building effective and realistic process models. The root of your JSON must contain a single key, `"simulation"`, which holds all the data for the process.

```json
{
  "simulation": {
    "meta": { ... },
    "config": { ... },
    "layout": { ... },
    "objects": [ ... ],
    "tasks": [ ... ]
  }
}
```

### High-Level Structure

*   `meta`: Contains descriptive information about the simulation.
*   `config`: Defines the overall timing and units for the simulation.
*   `layout`: (Optional) Defines the physical spaces for the simulation. See the [Space Editor Guide](./space-editor-guide.md) for details.
*   `objects`: An array of all the people, equipment, and materials involved in the process.
*   `tasks`: An array of all the actions and steps that make up the process.

---

### Defining Objects

The `objects` array is where you define every person, piece of equipment, raw material, and product in your simulation. Each object is a dictionary with a set of base properties and a `properties` object for type-specific data.

#### Base Object Properties

| Property | Type   | Description                                             |
| -------- | ------ | ------------------------------------------------------- |
| `id`     | string | A unique identifier for the object (e.g., `baker`, `oven`). |
| `type`   | string | The type of the object (e.g., `actor`, `equipment`).      |
| `name`   | string | A human-readable name for display (e.g., "Head Chef").  |
| `emoji`  | string | (Optional) An emoji to represent the object visually.     |

#### Standard Object Types

The system supports multiple object types, each with its own recommended `properties`.

**1. `actor`**
An `actor` is a person or agent that performs tasks.

*Example:*
```json
{
  "id": "baker",
  "type": "actor",
  "name": "Baker",
  "properties": {
    "role": "Head Baker",
    "cost_per_hour": 25,
    "location": "prep_area"
  }
}
```
*   `role`: The actor's job title or function.
*   `cost_per_hour`: A numerical value used for cost analysis metrics.
*   `location`: The initial physical location of the actor, corresponding to an ID in the `layout` object.

**2. `equipment`**
`equipment` represents tools, machinery, or other non-consumable items.

*Example:*
```json
{
  "id": "oven",
  "type": "equipment",
  "name": "Commercial Oven",
  "emoji": "🔥",
  "properties": {
    "state": "available",
    "capacity": 4,
    "location": "oven_area"
  }
}
```
*   `state`: The initial state of the equipment (e.g., `clean`, `dirty`, `in-use`). This is a crucial property that can be changed by tasks.
*   `capacity`: A number indicating how many items the equipment can handle at once.
*   `location`: The equipment's physical location.

**3. `resource`**
A `resource` is a consumable material used in the process.

*Example:*
```json
{
  "id": "flour",
  "type": "resource",
  "name": "Flour",
  "emoji": "🌾",
  "properties": {
    "unit": "kg",
    "quantity": 50,
    "cost_per_unit": 0.50,
    "location": "prep_area"
  }
}
```
*   `unit`: The unit of measurement (e.g., `kg`, `liter`, `g`).
*   `quantity`: The starting amount of the resource. This can be modified by tasks.
*   `cost_per_unit`: Cost per unit for economic analysis.
*   `location`: The resource's storage location.

**4. `product`**
A `product` is the output or an intermediate item created during the process.

*Example:*
```json
{
  "id": "mixed_dough",
  "type": "product",
  "name": "Mixed Dough",
  "emoji": "🍞",
  "properties": {
    "unit": "batch",
    "quantity": 0,
    "revenue_per_unit": 5.50,
    "location": "prep_area"
  }
}
```
*   `unit`: The unit of measurement for the product.
*   `quantity`: The initial quantity, which is typically `0`. Tasks will increase this value.
*   `revenue_per_unit`: Revenue per unit for economic analysis.

**5. `digital_location`**
A `digital_location` represents virtual spaces within digital systems.

*Example:*
```json
{
  "id": "virtual_control_room",
  "type": "digital_location",
  "name": "Virtual Control Center",
  "properties": {
    "environment_type": "control_interface",
    "coordinate_system": "cartesian_3d",
    "bounds": {
      "x": { "min": -10, "max": 10 },
      "y": { "min": 0, "max": 5 },
      "z": { "min": -10, "max": 10 }
    }
  }
}
```

**6. `digital_object`**
A `digital_object` represents virtual items that exist within digital spaces.

*Example:*
```json
{
  "id": "data_processor",
  "type": "digital_object",
  "name": "Real-time Data Processor",
  "properties": {
    "digital_type": "processing_unit",
    "position": { "x": 0, "y": 2, "z": 0 },
    "processing_capacity": 1000,
    "digital_location": "virtual_control_room"
  }
}
```

**7. `display`**
A `display` represents screens, monitors, or digital interface elements.

*Example:*
```json
{
  "id": "main_dashboard",
  "type": "display",
  "name": "Production Dashboard",
  "properties": {
    "display_type": "dashboard",
    "resolution": { "width": 1920, "height": 1080 },
    "location": "control_room",
    "active": true
  }
}
```

**8. `screen_element`**
A `screen_element` represents interactive components within displays.

*Example:*
```json
{
  "id": "status_indicator",
  "type": "screen_element",
  "name": "System Status Light",
  "properties": {
    "element_type": "indicator",
    "display_id": "main_dashboard",
    "position": { "x": 100, "y": 100 },
    "dimensions": { "width": 50, "height": 50 },
    "color": "green",
    "visible": true
  }
}
```

#### Custom Object Types

You are not limited to the standard types. The system is flexible, allowing you to define your own object types. This is useful for creating more specialized and realistic simulations.

**Why create a custom type?**
Imagine you are simulating a delivery service. You could create a `vehicle` type with properties like `fuel_level` and `max_speed`.

*Example of a custom `vehicle` type:*
```json
{
  "id": "delivery_van_1",
  "type": "vehicle",
  "name": "Main Delivery Van",
  "emoji": "🚚",
  "properties": {
    "fuel_level_percent": 100,
    "max_payload_kg": 500,
    "state": "idle",
    "location": "depot"
  }
}
```
The simulation will render this custom object and its properties, and you can create tasks that interact with its custom properties (e.g., a "drive_route" task that decreases `fuel_level_percent`).

---

### Defining Tasks

The `tasks` array defines the sequence of actions that make up your process. Each task is an object with several key properties.

| Property | Type | Description |
|---|---|---|
| `id` | string | A unique identifier for the task (e.g., `mix_dough`). |
| `emoji` | string | (Optional) An emoji to represent the task on the timeline. |
| `actor_id` | string | The `id` of the object performing the task. This can be an `actor`, but also `equipment` for self-operating tasks. |
| `start` | string | The start time of the task in `HH:MM` format. |
| `duration` | number | The duration of the task in minutes. |
| `location` | string | The `id` of the location where the task takes place. |
| `depends_on` | array | (Optional) A list of task `id`s that must be completed before this task can begin. |
| `interactions`| array | (Optional) A list of actions this task performs on objects in the simulation. |

*Example Task:*
```json
{
  "id": "mix_dough",
  "emoji": "🥄",
  "actor_id": "baker",
  "start": "06:55",
  "duration": 20,
  "location": "prep_area",
  "depends_on": ["measure_flour", "activate_yeast"],
  "interactions": [ ... ]
}
```

---

### Task Interactions: The Engine of the Simulation

The `interactions` array is the most powerful part of a task definition. It's how you make your simulation dynamic by changing the state of objects. An interaction is an object that describes a change.

#### 1. `property_changes`

This is the most common interaction type. It allows you to change the value of any property of any object.

**A) Changing State (From/To)**
Use this to change a text-based property, like an equipment's `state`.

*Example:* A task that makes a mixer dirty.
```json
"interactions": [
  {
    "object_id": "mixer",
    "property_changes": {
      "state": { "from": "clean", "to": "dirty" }
    }
  }
]
```
The `from` value is used by the validation engine to ensure the simulation is realistic (e.g., you can't make a mixer dirty if it's already dirty).

**B) Changing a Numerical Value (Delta)**
Use this to increase or decrease a number, like a resource's `quantity`.

*Example:* A task that uses up 15g of yeast.
```json
"interactions": [
  {
    "object_id": "yeast",
    "property_changes": {
      "quantity": { "delta": -15 }
    }
  }
]
```

**C) Changing Position (3D Coordinates)**
For digital objects, you can change their position in 3D space:

*Example:* Moving a digital object in virtual space.
```json
"interactions": [
  {
    "object_id": "inventory_bot",
    "property_changes": {
      "position": {
        "from": { "x": 0, "y": 0, "z": 0 },
        "to": { "x": 25, "y": 0, "z": 10 }
      }
    }
  }
]
```

**D) Changing Physical Location**
For actors moving between physical locations, you can track their movement:

*Example:* Worker moving to a different area.
```json
"interactions": [
  {
    "object_id": "warehouse_worker",
    "property_changes": {
      "location": {
        "from": "loading_dock",
        "to": "storage_area"
      }
    }
  }
]
```

This updates the actor's location, which is tracked by the validation system to ensure subsequent tasks have the actor in the correct location.

#### 2. `add_objects`

This interaction allows a task to create one or more new objects and add them to the simulation. This is perfect for tasks that produce something new.

*Example:* A "receive_shipment" task that adds new resources to the inventory.
```json
"interactions": [
  {
    "add_objects": [
      {
        "type": "resource",
        "id": "new_flour_shipment",
        "name": "Fresh Flour",
        "emoji": "🌾",
        "properties": { "quantity": 1000, "unit": "kg", "location": "storage_room" }
      }
    ]
  }
]
```

#### 3. `remove_objects`

This interaction allows a task to remove an object from the simulation. This is useful for representing items that are fully consumed, discarded, or delivered.

*Example:* A "deliver_order" task that removes the final product from the simulation.
```json
"interactions": [
  {
    "remove_objects": ["baked_bread_order_123"]
  }
]
```

---

### Movement Tasks

The Playground supports two methods for modeling actor movement between physical locations. Understanding when and how to use each method is key to creating realistic, validated simulations.

#### Method 1: Movement Task Type

Use a dedicated movement task to explicitly show travel time as a distinct activity on the timeline.

**Structure:**
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
- `type`: Must be set to `"movement"` to identify this as a movement task
- `from_location`: Starting location (must match actor's current location at task start)
- `to_location`: Destination location (must exist in layout)
- `movement_speed`: (Optional) Speed in meters/second for realistic duration calculation

**When to use:**
- Movement is the primary purpose of the task
- You want to explicitly show travel time in the timeline
- You need to track movement speed or distance
- The movement should be visible as a distinct activity

**Timeline Behavior:**
The validation system tracks the actor's location throughout the timeline:
1. At task start, validates that actor is in `from_location`
2. At task completion, updates actor's location to `to_location`
3. Subsequent tasks can use the updated location

#### Method 2: Property Changes

Use property_changes within a task's interactions to update location as part of a larger action.

**Structure:**
```json
{
  "id": "retrieve_supplies",
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
    }
  ]
}
```

**When to use:**
- Movement is incidental to the task's primary purpose
- You want to combine location change with other property updates
- The task duration already includes travel time
- Movement doesn't need to be shown as a separate timeline activity

**Timeline Behavior:**
Location is updated when the task completes, just like other property changes.

#### Complete Movement Example

This example shows a warehouse workflow with both movement methods:

```json
{
  "simulation": {
    "meta": {
      "title": "Warehouse Fulfillment Process"
    },
    "config": {
      "time_unit": "minutes",
      "start_time": "08:00",
      "end_time": "12:00"
    },
    "layout": {
      "areas": {
        "receiving_dock": {
          "name": "Receiving Dock",
          "type": "physical",
          "coordinates": { "x": 0, "y": 0, "width": 15, "height": 10 }
        },
        "storage_area": {
          "name": "Storage Area",
          "type": "physical",
          "coordinates": { "x": 20, "y": 0, "width": 30, "height": 20 }
        },
        "shipping_dock": {
          "name": "Shipping Dock",
          "type": "physical",
          "coordinates": { "x": 55, "y": 0, "width": 15, "height": 10 }
        }
      }
    },
    "objects": [
      {
        "id": "warehouse_worker",
        "type": "actor",
        "name": "Warehouse Worker",
        "properties": {
          "location": "receiving_dock",
          "cost_per_hour": 18.50
        }
      },
      {
        "id": "forklift",
        "type": "equipment",
        "name": "Electric Forklift",
        "properties": {
          "location": "storage_area",
          "state": "available"
        }
      },
      {
        "id": "inventory",
        "type": "resource",
        "name": "Warehouse Inventory",
        "properties": {
          "quantity": 100,
          "unit": "pallets",
          "location": "storage_area"
        }
      }
    ],
    "tasks": [
      {
        "id": "receive_delivery",
        "actor_id": "warehouse_worker",
        "start": "08:00",
        "duration": 15,
        "location": "receiving_dock",
        "interactions": [
          {
            "object_id": "inventory",
            "property_changes": {
              "quantity": { "delta": 10 }
            }
          }
        ]
      },
      {
        "id": "walk_to_storage",
        "type": "movement",
        "actor_id": "warehouse_worker",
        "start": "08:15",
        "duration": 3,
        "from_location": "receiving_dock",
        "to_location": "storage_area"
      },
      {
        "id": "organize_inventory",
        "actor_id": "warehouse_worker",
        "start": "08:18",
        "duration": 25,
        "location": "storage_area",
        "interactions": [
          {
            "object_id": "forklift",
            "property_changes": {
              "state": { "from": "available", "to": "in_use" }
            }
          }
        ]
      },
      {
        "id": "return_forklift_and_move",
        "actor_id": "warehouse_worker",
        "start": "08:43",
        "duration": 5,
        "location": "storage_area",
        "interactions": [
          {
            "object_id": "forklift",
            "property_changes": {
              "state": { "from": "in_use", "to": "available" }
            }
          },
          {
            "object_id": "warehouse_worker",
            "property_changes": {
              "location": {
                "from": "storage_area",
                "to": "shipping_dock"
              }
            }
          }
        ]
      },
      {
        "id": "prepare_shipment",
        "actor_id": "warehouse_worker",
        "start": "08:48",
        "duration": 20,
        "location": "shipping_dock",
        "interactions": [
          {
            "object_id": "inventory",
            "property_changes": {
              "quantity": { "delta": -5 }
            }
          }
        ]
      }
    ]
  }
}
```

**Key Points in This Example:**

1. **Explicit Movement (08:15-08:18)**: The worker uses a dedicated movement task to walk from receiving_dock to storage_area. This shows the 3-minute travel time clearly on the timeline.

2. **Incidental Movement (08:43-08:48)**: The worker returns the forklift and moves to shipping_dock within the same task. Since the movement is combined with another action, we use property_changes instead of a separate movement task.

3. **Timeline Validation**: The validation system tracks:
   - Worker starts at receiving_dock (initial property)
   - After walk_to_storage completes (08:18), worker is in storage_area
   - After return_forklift_and_move completes (08:48), worker is in shipping_dock
   - Each task validates that the worker is in the correct location at its start time

4. **Common Pattern**: Move to a location, work there for a period, then move elsewhere. This reflects realistic workflows where travel and work are distinct phases.

#### Best Practices for Movement

1. **Realistic Duration**: Movement tasks should have durations based on actual walking/travel time
   - Typical walking speed: 1.4 m/s (5 km/h)
   - Calculate duration based on layout coordinates if available
   - Include time for any obstacles or delays

2. **Timing Gaps**: Ensure movement completes before the next task starts
   ```json
   // Movement completes at 09:05
   { "start": "09:00", "duration": 5, "type": "movement" }
   // Next task must start at or after 09:05
   { "start": "09:05", "duration": 10 }
   ```

3. **Location Consistency**: The from_location must match where the actor actually is
   - The validator simulates the timeline to track current location
   - If mismatch occurs, you'll get a validation error
   - Check earlier tasks to see where the actor was moved

4. **Choose the Right Method**:
   - **Dedicated Movement Task**: Use when travel time is significant and should be visible
   - **Property Changes**: Use when movement is quick or combined with other actions

By combining these different object and task definitions, including proper movement modeling, you can create rich, dynamic, and realistic simulations of almost any process.