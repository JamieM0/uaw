# WorkSpec v2.0 Specification

> **Status:** Final Draft  
> **Version:** 2.0  
> **Last Updated:** 2026-02-03  
> **Namespace:** https://universalautomation.wiki/workspec/

---

## Table of Contents

1. [Overview](#1-overview)
2. [Document Structure](#2-document-structure)
3. [Object Model](#3-object-model)
4. [Task Model](#4-task-model)
5. [Interaction System](#5-interaction-system)
6. [Type System](#6-type-system)
7. [Temporal Model](#7-temporal-model)
8. [Spatial Model](#8-spatial-model)
9. [Economic Model](#9-economic-model)
10. [Recipe System](#10-recipe-system)
11. [Validation & Errors](#11-validation--errors)
12. [Complete Example](#12-complete-example)

---

## 1. Overview

### 1.1 What is WorkSpec?

WorkSpec is a JSON-based specification language for defining work activities, processes, and simulations. It is designed to be:

- **AI-Native:** Optimized for generation and consumption by Large Language Models
- **Human-Readable:** Clear, consistent syntax that's easy to author and review
- **Validation-First:** Rich constraint system catches errors before execution
- **Platform-Agnostic:** Usable in any environment, not tied to UAW Playground

### 1.2 File Format

| Property | Value |
|----------|-------|
| **Extension** | `.workspec.json` |
| **MIME Type** | `application/json` |
| **Encoding** | UTF-8 |
| **Schema URL** | `https://universalautomation.wiki/workspec/v2.0.schema.json` |

### 1.3 Versioning

WorkSpec uses **Major.Minor** versioning:
- **Major:** Breaking changes (e.g., 1.0 → 2.0)
- **Minor:** Additive features, non-breaking (e.g., 2.0 → 2.1)

Only the latest version is officially supported. Legacy versions are archived.

### 1.4 Version Detection

Documents **MUST** include version information:

```json
{
  "$schema": "https://universalautomation.wiki/workspec/v2.0.schema.json",
  "simulation": {
    "schema_version": "2.0"
  }
}
```

Documents without a `schema_version` field are assumed to be v1.0 and will be rejected with an error directing users to the migration tool.

---

## 2. Document Structure

### 2.1 Root Structure

```json
{
  "$schema": "https://universalautomation.wiki/workspec/v2.0.schema.json",
  "simulation": {
    "schema_version": "2.0",
    "meta": { },
    "config": { },
    "world": {
      "layout": { },
      "objects": [ ]
    },
    "process": {
      "tasks": [ ],
      "recipes": { }
    }
  }
}
```

| Section | Required | Description |
|---------|----------|-------------|
| `$schema` | Recommended | JSON Schema URL for tooling |
| `simulation` | **Required** | Root container |
| `simulation.schema_version` | **Required** | WorkSpec version ("2.0") |
| `simulation.meta` | **Required** | Document metadata |
| `simulation.config` | **Required** | Simulation configuration |
| `simulation.world` | **Required** | Physical/digital environment |
| `simulation.world.layout` | Optional | Spatial configuration |
| `simulation.world.objects` | **Required** | All entities |
| `simulation.process` | **Required** | Workflow definition |
| `simulation.process.tasks` | **Required** | Task list |
| `simulation.process.recipes` | Optional | Production recipes |

### 2.2 Meta Section

Contains document metadata.

```json
{
  "meta": {
    "title": "Artisan Bakery Morning Shift",
    "description": "Simulation of bread production during morning operations",
    "domain": "Food Manufacturing",
    "version": "1.0",
    "author": "Process Engineer",
    "created_at": "2026-02-03T10:00:00Z",
    "updated_at": "2026-02-03T14:30:00Z",
    "tags": ["bakery", "bread", "morning-shift"]
  }
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `title` | string | **Required** | Human-readable title |
| `description` | string | **Required** | Detailed description |
| `domain` | string | **Required** | Industry/domain category |
| `version` | string | Optional | Document version (not schema version) |
| `author` | string | Optional | Document creator |
| `created_at` | ISO 8601 | Optional | Creation timestamp |
| `updated_at` | ISO 8601 | Optional | Last modification timestamp |
| `tags` | string[] | Optional | Searchable tags |

### 2.3 Config Section

Defines simulation parameters.

```json
{
  "config": {
    "time_unit": "minutes",
    "start_time": "06:00",
    "end_time": "18:00",
    "timezone": "UTC",
    "currency": "USD",
    "locale": "en-US"
  }
}
```

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `time_unit` | enum | **Required** | - | `seconds` \| `minutes` \| `hours` |
| `start_time` | string | **Required** | - | Start time (HH:MM or ISO 8601) |
| `end_time` | string | **Required** | - | End time (HH:MM or ISO 8601) |
| `timezone` | string | Optional | `"UTC"` | IANA timezone identifier |
| `currency` | string | **Required** | - | ISO 4217 currency code |
| `locale` | string | **Required** | - | BCP 47 language tag |

---

## 3. Object Model

### 3.1 Object Structure

All entities in a WorkSpec simulation are **objects**. Every object has the following structure:

```json
{
  "id": "head_baker",
  "type": "actor",
  "name": "Head Baker",
  "emoji": "👨‍🍳",
  "location": "prep_area",
  "properties": {
    "role": "Lead Baker",
    "cost_per_hour": 25.00
  }
}
```

#### Top-Level Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | **Required** | Unique identifier |
| `type` | string | **Required** | Object type |
| `name` | string | **Required** | Display name |
| `emoji` | string | Optional | Visual representation (single emoji) |
| `location` | string | Optional | Reference to location ID |
| `properties` | object | Optional | Type-specific and custom properties |

### 3.2 Object ID Format

Object IDs must follow these rules:

| Rule | Valid | Invalid |
|------|-------|---------|
| Snake_case | `head_baker` | `headBaker`, `Head-Baker` |
| Start with letter | `baker_1` | `1_baker` |
| Lowercase only | `main_oven` | `Main_Oven` |
| No special chars | `prep_area` | `prep-area`, `prep area` |
| Max 250 chars | - | - |

**Regex:** `^[a-z][a-z0-9_]{0,249}$`

#### Optional Namespacing

IDs may optionally include a type namespace prefix:

```json
{ "id": "actor:head_baker", "type": "actor" }
{ "id": "equipment:industrial_mixer", "type": "equipment" }
```

**Rules:**
- Namespace prefix must match `type` field exactly
- If namespace is provided but doesn't match type → validation error
- Namespacing is optional; plain IDs are valid

### 3.3 Standard Object Types

#### Core Types

| Type | Description | Can Perform Tasks | Has Quantity | Has State |
|------|-------------|-------------------|--------------|-----------|
| `actor` | Human workers | ✅ | ❌ | ✅ |
| `equipment` | Tools, machines | ✅ (self-operating) | ❌ | ✅ |
| `resource` | Consumable materials | ❌ | ✅ | ❌ |
| `product` | Produced outputs | ❌ | ✅ | ❌ |
| `service` | Automated/background processes | ✅ | ❌ | ✅ |

#### Digital Types

| Type | Description | Key Properties |
|------|-------------|----------------|
| `display` | Digital screens | `resolution`, `active` |
| `screen_element` | UI components | `display_id`, `position` |
| `digital_object` | Virtual entities (servers, storage) | `state`, `capacity`, `utilization` |

### 3.4 Standard Properties by Type

#### `actor` Properties

```json
{
  "properties": {
    "role": "Lead Baker",
    "cost_per_hour": 25.00,
    "state": "available"
  }
}
```

| Property | Type | Description |
|----------|------|-------------|
| `role` | string | Job title or function |
| `cost_per_hour` | number | Labor cost per hour |
| `state` | string | Current state (available, busy, break) |

#### `equipment` Properties

```json
{
  "properties": {
    "state": "clean",
    "capacity": 1,
    "cost_per_hour": 5.00,
    "depreciation_per_hour": 0.50
  }
}
```

| Property | Type | Description |
|----------|------|-------------|
| `state` | string | Current state (clean, dirty, in_use, maintenance) |
| `capacity` | integer | Concurrent usage capacity |
| `cost_per_hour` | number | Operating cost |
| `depreciation_per_hour` | number | Depreciation rate |

#### `resource` Properties

```json
{
  "properties": {
    "quantity": 50,
    "unit": "kg",
    "cost_per_unit": 1.20
  }
}
```

| Property | Type | Description |
|----------|------|-------------|
| `quantity` | number | Current stock level |
| `unit` | string | Unit of measurement |
| `cost_per_unit` | number | Cost per unit |

#### `product` Properties

```json
{
  "properties": {
    "quantity": 0,
    "unit": "loaves",
    "revenue_per_unit": 5.00,
    "cost_per_unit": 2.50
  }
}
```

| Property | Type | Description |
|----------|------|-------------|
| `quantity` | number | Current stock level |
| `unit` | string | Unit of measurement |
| `revenue_per_unit` | number | Sale price per unit |
| `cost_per_unit` | number | Production cost per unit |

#### `service` Properties

```json
{
  "properties": {
    "state": "running",
    "interval": "5m",
    "last_run": "2026-02-03T08:00:00Z"
  }
}
```

| Property | Type | Description |
|----------|------|-------------|
| `state` | string | Current state (running, stopped, error) |
| `interval` | duration | Execution interval |
| `last_run` | ISO 8601 | Last execution time |

#### `digital_object` Properties

```json
{
  "properties": {
    "state": "running",
    "capacity": 100,
    "utilization": 0.45,
    "ip_address": "192.168.1.10",
    "storage_gb": 500,
    "cpu_cores": 8
  }
}
```

| Property | Type | Description |
|----------|------|-------------|
| `state` | string | Current state (running, stopped, maintenance, error) |
| `capacity` | number | Maximum capacity |
| `utilization` | number | Current utilization (0.0 - 1.0) |
| `ip_address` | string | Network address (optional) |
| `storage_gb` | number | Storage capacity (optional) |
| `cpu_cores` | integer | Compute cores (optional) |

### 3.5 Reserved Type Names

The following type names are reserved and cannot be used:

- `timeline_actors` - Internal rendering
- `_internal` - Any type starting with underscore
- `any` - Reserved for type wildcards
- `unknown` - Reserved for untyped objects

---

## 4. Task Model

### 4.1 Task Structure

Tasks are the fundamental units of work in a WorkSpec simulation.

```json
{
  "id": "mix_dough",
  "emoji": "🥄",
  "actor_id": "head_baker",
  "start": "06:30",
  "duration": 20,
  "location": "prep_area",
  "depends_on": ["measure_ingredients"],
  "interactions": [ ],
  "description": "Mix all ingredients in industrial mixer",
  "priority": "high",
  "tags": ["preparation", "mixing"]
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | **Required** | Unique identifier (same rules as object IDs) |
| `emoji` | string | Optional | Visual representation |
| `actor_id` | string | **Required** | ID of object performing the task |
| `start` | string/ISO 8601 | **Required** | Start time |
| `duration` | number/string | **Required** | Task duration |
| `location` | string | Optional | Location ID where task occurs |
| `depends_on` | array/object | Optional | Task dependencies |
| `interactions` | array | Optional | Object interactions |
| `description` | string | Optional | Human-readable description |
| `priority` | enum | Optional | `low` \| `medium` \| `high` \| `critical` |
| `tags` | string[] | Optional | Categorization tags |

### 4.2 Duration Format

Duration can be specified in multiple formats:

| Format | Example | Meaning |
|--------|---------|---------|
| Integer | `30` | 30 × config.time_unit |
| ISO 8601 | `"PT30M"` | 30 minutes |
| Shorthand | `"30m"` | 30 minutes |
| Shorthand | `"1h"` | 1 hour |
| Shorthand | `"1d"` | 1 day |
| Shorthand | `"10s"` | 10 seconds |
| Shorthand | `"1w"` or `"1W"` | 1 week |
| Shorthand | `"1M"` | 1 month |

### 4.3 Dependencies

#### Simple Dependencies (Implicit AND)

```json
{
  "depends_on": ["task_a", "task_b"]
}
```

Waits for **all** listed tasks to complete.

#### Explicit Operators

```json
{
  "depends_on": {
    "all": ["prep_complete", "equipment_ready"],
    "any": ["manager_approval", "auto_approval"]
  }
}
```

| Operator | Behavior |
|----------|----------|
| `all` | Wait for ALL listed tasks (AND-join) |
| `any` | Wait for ANY listed task (OR-join, first to complete) |

When both operators are present, the task waits for: `(ALL of "all") AND (ANY of "any")`

### 4.4 Multi-Day Tasks

For simulations spanning multiple days:

```json
{
  "start": { "day": 2, "time": "09:30" },
  "duration": "4h"
}
```

| Field | Description |
|-------|-------------|
| `day` | Day offset (1 = first day, 2 = second day, etc.) |
| `time` | Time on that day (HH:MM or ISO 8601) |

---

## 5. Interaction System

### 5.1 Interaction Structure

Interactions define how tasks affect objects.

```json
{
  "interactions": [
    {
      "target_id": "flour",
      "property_changes": {
        "quantity": { "delta": -2.5 }
      }
    },
    {
      "target_id": "industrial_mixer",
      "property_changes": {
        "state": { "from": "clean", "to": "dirty" }
      },
      "temporary": true
    }
  ]
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `target_id` | string | **Required** | ID of object being affected |
| `property_changes` | object | Conditional | Property modifications |
| `action` | enum | Conditional | `create` \| `delete` |
| `object` | object | Conditional | New object (when action: create) |
| `temporary` | boolean | Optional | Revert changes after task completes |

### 5.2 Property Change Operators

| Operator | Syntax | Use Case | Example |
|----------|--------|----------|---------|
| `from`/`to` | `{ "from": "A", "to": "B" }` | State transitions | `"state": { "from": "clean", "to": "dirty" }` |
| `delta` | `{ "delta": N }` | Quantity changes | `"quantity": { "delta": -5 }` |
| `set` | `{ "set": V }` | Direct assignment | `"temperature": { "set": 180 }` |
| `multiply` | `{ "multiply": N }` | Proportional change | `"price": { "multiply": 1.1 }` |
| `append` | `{ "append": V }` | Add to array | `"tags": { "append": "processed" }` |
| `remove` | `{ "remove": V }` | Remove from array | `"tags": { "remove": "raw" }` |
| `increment` | `{ "increment": true }` | +1 shorthand | `"count": { "increment": true }` |
| `decrement` | `{ "decrement": true }` | -1 shorthand | `"count": { "decrement": true }` |

**Validation Rules:**
- Cannot combine `from`/`to` with `delta` on same property
- `from`/`to` requires both values
- `delta`, `multiply` require numeric values
- `increment`/`decrement` only valid on numeric properties

### 5.3 Creating Objects

Tasks can create new objects:

```json
{
  "interactions": [
    {
      "action": "create",
      "object": {
        "id": "batch_001",
        "type": "product",
        "name": "Bread Batch #001",
        "location": "cooling_rack",
        "properties": {
          "quantity": 12,
          "unit": "loaves"
        }
      }
    }
  ]
}
```

### 5.4 Deleting Objects

Tasks can remove objects:

```json
{
  "interactions": [
    {
      "action": "delete",
      "target_id": "expired_batch_001"
    }
  ]
}
```

### 5.5 Temporary Changes

When `temporary: true`, changes revert after the task completes:

```json
{
  "target_id": "industrial_mixer",
  "property_changes": {
    "state": { "from": "available", "to": "in_use" }
  },
  "temporary": true
}
```

This is useful for equipment that returns to its original state after use.

---

## 6. Type System

### 6.1 Type Traits

Types have inherent capabilities defined by traits:

```json
{
  "type_traits": {
    "quantifiable": {
      "description": "Objects that have measurable quantity",
      "required_properties": ["quantity"],
      "valid_operations": ["delta", "set", "multiply", "increment", "decrement"]
    },
    "stateful": {
      "description": "Objects that have discrete states",
      "required_properties": ["state"],
      "valid_operations": ["from/to", "set"]
    },
    "performer": {
      "description": "Objects that can perform tasks",
      "required_properties": [],
      "can_be_actor_id": true
    }
  }
}
```

### 6.2 Built-in Type Definitions

| Type | Traits |
|------|--------|
| `actor` | `stateful`, `performer` |
| `equipment` | `stateful`, `performer` |
| `resource` | `quantifiable` |
| `product` | `quantifiable` |
| `service` | `stateful`, `performer` |
| `display` | `stateful` |
| `screen_element` | `stateful` |
| `digital_object` | `stateful`, `quantifiable` |

### 6.3 Custom Type Definitions

Custom types must extend a base type:

```json
{
  "type_definitions": {
    "vehicle": {
      "extends": "equipment",
      "description": "Motorized transport equipment",
      "additional_properties": {
        "speed": { "type": "number", "unit": "km/h" },
        "fuel_capacity": { "type": "number", "unit": "liters" },
        "current_fuel": { "type": "number" }
      }
    },
    "sensor": {
      "extends": "digital_object",
      "description": "IoT sensor device",
      "additional_properties": {
        "reading": { "type": "number" },
        "unit": { "type": "string" },
        "accuracy": { "type": "number" }
      }
    }
  }
}
```

**Rules:**
- Custom types inherit all traits from their base type
- Additional properties extend (don't replace) base properties
- Type definitions are declared in `simulation.type_definitions`
- Objects with custom types must have a corresponding definition

---

## 7. Temporal Model

### 7.1 Time Formats

#### Start Time

| Format | Example | Description |
|--------|---------|-------------|
| HH:MM | `"09:30"` | Time of day (24-hour) |
| HH:MM:SS | `"09:30:00"` | With seconds |
| ISO 8601 | `"2026-02-03T09:30:00Z"` | Full timestamp |

**Validation:**
- HH:MM must be zero-padded: `"09:30"` not `"9:30"`
- Hours: 00-23
- Minutes/Seconds: 00-59
- Invalid times (e.g., `"07:60"`) are rejected with error

#### Duration

See [Section 4.2 Duration Format](#42-duration-format).

### 7.2 Time Parsing Errors

Invalid times produce clear errors:

```json
{
  "type": "https://universalautomation.wiki/workspec/errors/invalid-time-format",
  "title": "Invalid Time Format",
  "severity": "error",
  "detail": "Task 'proof_dough' has invalid start time '07:60'. Minutes must be 00-59.",
  "instance": "/simulation/process/tasks/2/start",
  "context": {
    "task_id": "proof_dough",
    "field": "start",
    "value": "07:60"
  },
  "suggestions": [
    "Change to '08:00' if you meant 8:00 AM",
    "Change to '07:59' if you meant 7:59 AM"
  ]
}
```

---

## 8. Spatial Model

### 8.1 Layout Structure

```json
{
  "layout": {
    "meta": {
      "units": "meters",
      "pixels_per_unit": 20,
      "origin": "top-left",
      "coordinate_system": "2d"
    },
    "locations": [
      {
        "id": "prep_area",
        "name": "Preparation Area",
        "shape": {
          "type": "rect",
          "x": 0,
          "y": 0,
          "width": 10,
          "height": 5
        }
      }
    ]
  }
}
```

### 8.2 Layout Meta

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `units` | enum | `"meters"` | `meters` \| `feet` \| `pixels` |
| `pixels_per_unit` | number | `20` | Rendering scale |
| `origin` | enum | `"top-left"` | Coordinate origin |
| `coordinate_system` | enum | `"2d"` | `2d` \| `3d` |

### 8.3 Location Shapes

#### Rectangle

```json
{
  "type": "rect",
  "x": 0,
  "y": 0,
  "width": 10,
  "height": 5
}
```

#### Circle

```json
{
  "type": "circle",
  "x": 5,
  "y": 5,
  "radius": 3
}
```

#### Polygon

```json
{
  "type": "polygon",
  "points": [
    { "x": 0, "y": 0 },
    { "x": 10, "y": 0 },
    { "x": 10, "y": 5 },
    { "x": 5, "y": 8 },
    { "x": 0, "y": 5 }
  ]
}
```

---

## 9. Economic Model

### 9.1 Standard Economic Properties

| Property | Applies To | Description |
|----------|-----------|-------------|
| `cost_per_hour` | actor, equipment | Hourly operating cost |
| `cost_per_unit` | resource, product | Per-unit cost |
| `revenue_per_unit` | product | Per-unit sale price |
| `fixed_cost` | any | One-time cost |
| `overhead_rate` | actor | Overhead percentage (0.0-1.0) |
| `depreciation_per_hour` | equipment | Hourly depreciation |

### 9.2 Economic Calculations

The validation system can compute:

- **Total Labor Cost:** Σ(actor.cost_per_hour × task.duration)
- **Total Material Cost:** Σ(resource.cost_per_unit × consumed_quantity)
- **Total Revenue:** Σ(product.revenue_per_unit × produced_quantity)
- **Gross Profit:** Total Revenue - Total Labor Cost - Total Material Cost
- **Equipment Depreciation:** Σ(equipment.depreciation_per_hour × usage_hours)

---

## 10. Recipe System

### 10.1 Recipe Structure

Recipes define the inputs required to produce an output.

```json
{
  "process": {
    "recipes": {
      "bread": {
        "inputs": {
          "flour": 2,
          "water": 1.5,
          "yeast": 0.1,
          "salt": 0.05
        },
        "equipment": ["industrial_mixer", "proofing_cabinet", "oven"],
        "output_quantity": 1,
        "process_time": 180
      },
      "croissant": {
        "inputs": {
          "flour": 1.5,
          "butter": 0.8,
          "yeast": 0.05
        },
        "equipment": ["mixer", "sheeter", "oven"],
        "output_quantity": 12,
        "process_time": 240
      }
    }
  }
}
```

### 10.2 Recipe Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `inputs` | object | **Required** | Resource ID → quantity mapping |
| `equipment` | string[] | Optional | Required equipment IDs |
| `output_quantity` | number | Optional | Units produced (default: 1) |
| `process_time` | number | Optional | Time to produce (in config.time_unit) |

### 10.3 Recipe Validation

When a task produces a product via interaction:

1. Check if `recipes[product_id]` exists
2. If yes, verify task consumes all required inputs
3. Missing inputs → warning (not error)

**Example warning:**

```json
{
  "type": "https://universalautomation.wiki/workspec/errors/recipe-violation",
  "title": "Recipe Violation",
  "severity": "warning",
  "detail": "Task 'bake_bread' produces 'bread' but is missing required inputs: yeast, salt",
  "instance": "/simulation/process/tasks/5",
  "context": {
    "task_id": "bake_bread",
    "product_id": "bread",
    "missing_inputs": ["yeast", "salt"],
    "provided_inputs": ["flour", "water"]
  }
}
```

---

## 11. Validation & Errors

### 11.1 Error Format (RFC 7807)

All validation errors follow the RFC 7807 Problem Details format with WorkSpec extensions:

```json
{
  "type": "https://universalautomation.wiki/workspec/errors/{category}/{specific}",
  "title": "Human-Readable Title",
  "severity": "error",
  "detail": "Detailed explanation of what went wrong.",
  "instance": "/simulation/path/to/problem",
  "metric_id": "category.subcategory.specific",
  "context": {
    "relevant": "data",
    "for": "debugging"
  },
  "suggestions": [
    "First suggested fix",
    "Second suggested fix"
  ],
  "doc_uri": "https://universalautomation.wiki/workspec/docs/errors/{specific}"
}
```

### 11.2 Error Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | URI | **Required** | Error type identifier |
| `title` | string | **Required** | Short, human-readable title |
| `severity` | enum | **Required** | `error` \| `warning` \| `info` |
| `detail` | string | **Required** | Full explanation |
| `instance` | JSON Pointer | **Required** | Location in document |
| `metric_id` | string | **Required** | Validation metric ID |
| `context` | object | **Required** | Structured error data |
| `suggestions` | string[] | **Required** | Actionable fixes |
| `doc_uri` | URI | Optional | Documentation link |

### 11.3 Severity Levels

| Severity | Meaning | Blocks Execution |
|----------|---------|------------------|
| `error` | Invalid document, cannot proceed | Yes |
| `warning` | Suspicious but allowed | No |
| `info` | Optimization opportunity | No |

### 11.4 Metric ID Namespace

```
{domain}.{category}.{specific}

Domains:
  schema    - Structural correctness
  object    - Object-level issues
  task      - Task-level issues
  resource  - Resource flow
  temporal  - Timing/scheduling
  economic  - Financial
  spatial   - Layout/location
  recipe    - Recipe compliance
  custom    - User-defined

Categories:
  integrity     - Structural soundness
  reference     - ID references
  scheduling    - Timing conflicts
  flow          - Consumption/production
  state         - State transitions
  optimization  - Suggestions
```

### 11.5 Standard Validation Rules

| Metric ID | Severity | Description |
|-----------|----------|-------------|
| `schema.integrity.missing_root` | error | Missing `simulation` root |
| `schema.integrity.missing_version` | error | Missing `schema_version` |
| `object.reference.invalid_location` | error | Location ID doesn't exist |
| `task.reference.invalid_actor` | error | Actor ID doesn't exist |
| `task.reference.invalid_dependency` | error | Dependency ID doesn't exist |
| `task.integrity.invalid_duration` | error | Duration is not positive |
| `task.integrity.invalid_start_time` | error | Invalid time format |
| `resource.flow.negative_stock` | error | Resource goes negative |
| `temporal.scheduling.actor_overlap` | error | Actor double-booked |
| `temporal.scheduling.dependency_violation` | error | Task starts before dependency ends |
| `economic.profitability.negative_margin` | warning | Simulation is unprofitable |
| `recipe.compliance.missing_inputs` | warning | Recipe inputs not consumed |
| `object.optimization.unused_resource` | info | Resource defined but never used |

---

## 12. Complete Example

```json
{
  "$schema": "https://universalautomation.wiki/workspec/v2.0.schema.json",
  "simulation": {
    "schema_version": "2.0",
    "meta": {
      "title": "Artisan Bakery Morning Shift",
      "description": "Complete bread production workflow from 6 AM to 2 PM",
      "domain": "Food Manufacturing",
      "author": "Process Engineer",
      "tags": ["bakery", "bread", "production"]
    },
    "config": {
      "time_unit": "minutes",
      "start_time": "06:00",
      "end_time": "14:00",
      "timezone": "Europe/London",
      "currency": "GBP",
      "locale": "en-GB"
    },
    "world": {
      "layout": {
        "meta": {
          "units": "meters",
          "pixels_per_unit": 20
        },
        "locations": [
          {
            "id": "prep_area",
            "name": "Preparation Area",
            "shape": { "type": "rect", "x": 0, "y": 0, "width": 10, "height": 5 }
          },
          {
            "id": "baking_area",
            "name": "Baking Area",
            "shape": { "type": "rect", "x": 12, "y": 0, "width": 8, "height": 5 }
          },
          {
            "id": "cooling_area",
            "name": "Cooling Area",
            "shape": { "type": "rect", "x": 22, "y": 0, "width": 6, "height": 5 }
          }
        ]
      },
      "objects": [
        {
          "id": "head_baker",
          "type": "actor",
          "name": "Head Baker",
          "emoji": "👨‍🍳",
          "location": "prep_area",
          "properties": {
            "role": "Lead Baker",
            "cost_per_hour": 18.50,
            "state": "available"
          }
        },
        {
          "id": "assistant",
          "type": "actor",
          "name": "Assistant Baker",
          "emoji": "👩‍🍳",
          "location": "prep_area",
          "properties": {
            "role": "Assistant",
            "cost_per_hour": 12.00,
            "state": "available"
          }
        },
        {
          "id": "industrial_mixer",
          "type": "equipment",
          "name": "Industrial Mixer",
          "emoji": "🌀",
          "location": "prep_area",
          "properties": {
            "state": "clean",
            "capacity": 1,
            "cost_per_hour": 2.50
          }
        },
        {
          "id": "oven",
          "type": "equipment",
          "name": "Commercial Oven",
          "emoji": "🔥",
          "location": "baking_area",
          "properties": {
            "state": "off",
            "capacity": 2,
            "cost_per_hour": 5.00
          }
        },
        {
          "id": "flour",
          "type": "resource",
          "name": "Bread Flour",
          "emoji": "🌾",
          "location": "prep_area",
          "properties": {
            "quantity": 50,
            "unit": "kg",
            "cost_per_unit": 0.80
          }
        },
        {
          "id": "water",
          "type": "resource",
          "name": "Water",
          "emoji": "💧",
          "location": "prep_area",
          "properties": {
            "quantity": 100,
            "unit": "liters",
            "cost_per_unit": 0.01
          }
        },
        {
          "id": "yeast",
          "type": "resource",
          "name": "Active Dry Yeast",
          "emoji": "🦠",
          "location": "prep_area",
          "properties": {
            "quantity": 5,
            "unit": "kg",
            "cost_per_unit": 8.00
          }
        },
        {
          "id": "bread_loaf",
          "type": "product",
          "name": "Artisan Bread Loaf",
          "emoji": "🍞",
          "location": "cooling_area",
          "properties": {
            "quantity": 0,
            "unit": "loaves",
            "revenue_per_unit": 3.50,
            "cost_per_unit": 1.20
          }
        }
      ]
    },
    "process": {
      "recipes": {
        "bread_loaf": {
          "inputs": {
            "flour": 0.5,
            "water": 0.3,
            "yeast": 0.01
          },
          "equipment": ["industrial_mixer", "oven"],
          "output_quantity": 1,
          "process_time": 120
        }
      },
      "tasks": [
        {
          "id": "preheat_oven",
          "emoji": "🌡️",
          "actor_id": "assistant",
          "start": "06:00",
          "duration": 15,
          "location": "baking_area",
          "description": "Preheat oven to 220°C",
          "interactions": [
            {
              "target_id": "oven",
              "property_changes": {
                "state": { "from": "off", "to": "preheating" }
              }
            }
          ]
        },
        {
          "id": "measure_ingredients",
          "emoji": "⚖️",
          "actor_id": "head_baker",
          "start": "06:00",
          "duration": 10,
          "location": "prep_area",
          "description": "Measure flour, water, and yeast for batch"
        },
        {
          "id": "mix_dough",
          "emoji": "🥄",
          "actor_id": "head_baker",
          "start": "06:15",
          "duration": 20,
          "location": "prep_area",
          "depends_on": ["measure_ingredients"],
          "description": "Combine ingredients in industrial mixer",
          "interactions": [
            {
              "target_id": "flour",
              "property_changes": {
                "quantity": { "delta": -5 }
              }
            },
            {
              "target_id": "water",
              "property_changes": {
                "quantity": { "delta": -3 }
              }
            },
            {
              "target_id": "yeast",
              "property_changes": {
                "quantity": { "delta": -0.1 }
              }
            },
            {
              "target_id": "industrial_mixer",
              "property_changes": {
                "state": { "from": "clean", "to": "dirty" }
              }
            }
          ]
        },
        {
          "id": "proof_dough",
          "emoji": "⏳",
          "actor_id": "service:timer",
          "start": "06:35",
          "duration": 60,
          "location": "prep_area",
          "depends_on": ["mix_dough"],
          "description": "Allow dough to rise"
        },
        {
          "id": "shape_loaves",
          "emoji": "🤲",
          "actor_id": "head_baker",
          "start": "07:35",
          "duration": 20,
          "location": "prep_area",
          "depends_on": ["proof_dough"],
          "description": "Divide and shape dough into loaves"
        },
        {
          "id": "bake_bread",
          "emoji": "🔥",
          "actor_id": "oven",
          "start": "08:00",
          "duration": 45,
          "location": "baking_area",
          "depends_on": {
            "all": ["shape_loaves", "preheat_oven"]
          },
          "description": "Bake loaves at 220°C",
          "interactions": [
            {
              "target_id": "oven",
              "property_changes": {
                "state": { "from": "preheating", "to": "baking" }
              }
            },
            {
              "target_id": "bread_loaf",
              "property_changes": {
                "quantity": { "delta": 10 }
              }
            }
          ]
        },
        {
          "id": "cool_bread",
          "emoji": "❄️",
          "actor_id": "assistant",
          "start": "08:45",
          "duration": 30,
          "location": "cooling_area",
          "depends_on": ["bake_bread"],
          "description": "Transfer loaves to cooling racks"
        },
        {
          "id": "clean_mixer",
          "emoji": "🧹",
          "actor_id": "assistant",
          "start": "07:00",
          "duration": 15,
          "location": "prep_area",
          "depends_on": ["mix_dough"],
          "description": "Clean the industrial mixer",
          "interactions": [
            {
              "target_id": "industrial_mixer",
              "property_changes": {
                "state": { "from": "dirty", "to": "clean" }
              }
            }
          ]
        }
      ]
    }
  }
}
```

---

## Appendix A: JSON Schema

The complete JSON Schema is available at:

`https://universalautomation.wiki/workspec/v2.0.schema.json`

## Appendix B: Migration from v1.0

A migration tool is provided to convert v1.0 documents to v2.0. The tool handles:

| v1.0 Feature | v2.0 Equivalent |
|--------------|-----------------|
| `consumes: { "flour": 2 }` | `interactions: [{ target_id: "flour", property_changes: { quantity: { delta: -2 }}}]` |
| `produces: { "bread": 1 }` | `interactions: [{ target_id: "bread", property_changes: { quantity: { delta: 1 }}}]` |
| `equipment_interactions` | `interactions` with `property_changes.state` |
| Emoji in task ID (`mix 🔸 🥄`) | Separate `id` and `emoji` fields |
| `object_id` in interactions | `target_id` |
| `article_title` in meta | `title` |
| `revert_after: true` | `temporary: true` |
| Flat structure | Nested `world` and `process` sections |

## Appendix C: Semantic Aliases

For AI comprehension, the following field aliases are recognized in documentation and error messages:

| Field | Aliases |
|-------|---------|
| `actor_id` | performer, assigned_to, worker, agent |
| `target_id` | object_id, affects, modifies |
| `depends_on` | requires, after, follows |
| `duration` | length, time, takes |
| `quantity` | amount, count, stock |
| `state` | status, condition |

---

*WorkSpec is developed by the Universal Automation Wiki project.*  
*https://universalautomation.wiki*
