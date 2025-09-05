# Simulation Playground Guide

The Simulation Playground is an interactive, web-based tool for creating, editing, visualizing, and validating real-world process simulations. It serves as a complete Integrated Development Environment (IDE) for the Universal Automation Wiki's simulation data.

## Overview

The Playground is designed to give you immediate feedback on your simulation design. You can edit the underlying JSON data and see the changes reflected in a visual timeline in real-time. This tight feedback loop allows for rapid prototyping and refinement of process models.

## Layout

The Playground interface is divided into three main panels:

1.  **JSON Editor Panel (Left):** This panel contains the raw `simulation.json` data for your process. It uses the Monaco editor, providing features like syntax highlighting, auto-formatting, and error checking for the JSON format.
2.  **Simulation Panel (Right):** This is where the simulation is visualized. It has two tabs:
    *   **Simulation Render:** Displays an interactive timeline of the process, showing actors, tasks, and their durations.
    *   **Space Editor:** Provides a 2D canvas for defining the physical layout and locations used in the simulation.
3.  **Validation Panel (Bottom):** This panel displays the results of running the simulation against the project's metrics catalog. It shows a summary of errors, warnings, suggestions, and passed checks, helping you identify issues and areas for improvement in your simulation.

## Interacting with the Simulation

The Playground offers several ways to interact with and modify your simulation directly from the UI, which will automatically update the JSON data.

### Timeline Interaction

*   **Move Task:** Click and drag a task block on the timeline to a different actor's lane or to a different time slot. This will update the task's `actor_id` and `start` time.
*   **Resize Task:** Hover over the left or right edge of a task block until the cursor changes to a resize icon. Click and drag to change the task's `duration`.
*   **Jump to Definition:** Clicking on a task block will highlight the corresponding task object in the JSON editor, allowing you to quickly find and edit its details.

### Adding Objects and Tasks

You can use the `+ Object` and `+ Task` buttons in the header to open modals for adding new elements to your simulation. These modals provide a user-friendly form for entering the required data, which is then inserted into the `simulation.json` file.

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

The system has four standard object types, each with its own recommended `properties`.

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
    "location": "prep_area"
  }
}
```
*   `unit`: The unit of measurement (e.g., `kg`, `liter`, `g`).
*   `quantity`: The starting amount of the resource. This can be modified by tasks.
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
    "location": "prep_area"
  }
}
```
*   `unit`: The unit of measurement for the product.
*   `quantity`: The initial quantity, which is typically `0`. Tasks will increase this value.

#### Custom Object Types

You are not limited to the four standard types. The system is flexible, allowing you to define your own object types. This is useful for creating more specialized and realistic simulations.

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
This is more flexible than `from`/`to` for numerical values, as you don't need to know the starting quantity.

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

By combining these different object and task definitions, you can create rich, dynamic, and realistic simulations of almost any process.
