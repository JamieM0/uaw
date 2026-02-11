# WorkSpec v2.0 Specification (Overview)

WorkSpec is a JSON-based specification language for defining work activities, processes, and simulations.

This page defines the **normative** v2.0 document structure and links to the detailed sections:

- Object model: [/docs/workspec/specification/v2.0/objects](/docs/workspec/specification/v2.0/objects)
- Task model: [/docs/workspec/specification/v2.0/tasks](/docs/workspec/specification/v2.0/tasks)
- Interaction system: [/docs/workspec/specification/v2.0/interactions](/docs/workspec/specification/v2.0/interactions)
- Validation + errors: [/docs/workspec/specification/v2.0/validation](/docs/workspec/specification/v2.0/validation)
- JSON Schema reference: [/docs/workspec/specification/v2.0/schema](/docs/workspec/specification/v2.0/schema)
- Version history: [/docs/workspec/specification/v2.0/changelog](/docs/workspec/specification/v2.0/changelog)

---

## File format

| Property | Value |
|---|---|
| Extension | `.workspec.json` |
| MIME type | `application/json` |
| Encoding | UTF-8 |
| Schema URL | `https://universalautomation.wiki/workspec/v2.0.schema.json` |

---

## Versioning

WorkSpec uses **Major.Minor** schema versioning.

Documents **MUST** declare their schema version:

```json
{
    "$schema": "https://universalautomation.wiki/workspec/v2.0.schema.json",
    "simulation": {
        "schema_version": "2.0"
    }
}
```

Notes:

- `$schema` is **recommended** (enables IDE schema tooling).
- `simulation.schema_version` is **required**.
- Documents without `simulation.schema_version` are treated as legacy and should be migrated: [/docs/workspec/guides/migration](/docs/workspec/guides/migration).

---

## Root structure (v2.0)

WorkSpec v2.0 splits the document into a static **world** and a dynamic **process**.

```json
{
    "$schema": "https://universalautomation.wiki/workspec/v2.0.schema.json",
    "simulation": {
        "schema_version": "2.0",
        "meta": {
            "title": "Example",
            "description": "What this simulation models",
            "domain": "Industry / domain"
        },
        "config": {
            "time_unit": "minutes",
            "start_time": "06:00",
            "end_time": "18:00",
            "currency": "USD",
            "locale": "en-US"
        },
        "world": {
            "layout": {
                "locations": [
                    { "id": "site", "name": "Site" }
                ]
            },
            "objects": []
        },
        "process": {
            "tasks": [],
            "recipes": {}
        },
        "type_definitions": {}
    }
}
```

### Required sections

| Path | Required | Meaning |
|---|---:|---|
| `$schema` | No | Schema URI for JSON tooling |
| `simulation` | Yes | Root container |
| `simulation.schema_version` | Yes | Schema version string (`"2.0"`) |
| `simulation.meta` | Yes | Document metadata |
| `simulation.config` | Yes | Simulation configuration |
| `simulation.world` | Yes | World definition (layout + objects) |
| `simulation.world.objects` | Yes | All entities (actors, equipment, resources, etc.) |
| `simulation.process` | Yes | Workflow definition (tasks + recipes) |
| `simulation.process.tasks` | Yes | Task list |
| `simulation.process.recipes` | No | Optional recipe dictionary |
| `simulation.type_definitions` | No | Optional custom type definitions |

---

## Meta (v2.0)

### Required fields

- `title` (string)
- `description` (string)
- `domain` (string)

### Optional fields

- `version` (string) — content version (not schema version)
- `author` (string)
- `created_at` (ISO 8601 date-time string)
- `updated_at` (ISO 8601 date-time string)
- `tags` (string[])

Example:

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

`meta.article_title` is **not** part of WorkSpec v2.0.

---

## Config (v2.0)

WorkSpec v2.0 defines the following core config fields:

| Field | Type | Required | Notes |
|---|---|---:|---|
| `time_unit` | enum | Yes | `seconds` \| `minutes` \| `hours` |
| `start_time` | time/date-time | Yes | `HH:MM` / `HH:MM:SS` or ISO 8601 date-time |
| `end_time` | time/date-time | Yes | `HH:MM` / `HH:MM:SS` or ISO 8601 date-time |
| `timezone` | string | No | IANA timezone identifier (default `"UTC"` if omitted) |
| `currency` | string | Yes | ISO 4217 code |
| `locale` | string | Yes | BCP 47 language tag |

Validation rules for time formats are defined in [/docs/workspec/specification/v2.0/validation](/docs/workspec/specification/v2.0/validation).

---

## Recipes (v2.0)

Recipes are optional, and live under:

- `simulation.process.recipes`

Recipes define required inputs for producing an output product.

Schema (per product id):

```json
{
    "recipes": {
        "bread_loaf": {
            "inputs": { "flour": 0.5, "water": 0.3, "yeast": 0.01 },
            "equipment": ["industrial_mixer", "oven"],
            "output_quantity": 1,
            "process_time": 120
        }
    }
}
```

Recipe compliance checking is described in [/docs/workspec/specification/v2.0/validation](/docs/workspec/specification/v2.0/validation).

---

## Custom types (v2.0)

Custom types are optional, and live under:

- `simulation.type_definitions`

They allow you to extend built-in types (for example, define a domain-specific equipment type).

Details: [/docs/workspec/specification/v2.0/objects](/docs/workspec/specification/v2.0/objects)

---

## Conformance checklist (v2.0)

A document is WorkSpec v2.0-conformant if:

- It is valid JSON.
- It includes `simulation.schema_version: "2.0"`.
- It follows the v2.0 structure: `simulation.world` and `simulation.process`.
- It includes required `meta` fields (`title`, `description`, `domain`).
- Objects and tasks meet the requirements in:
  - [/docs/workspec/specification/v2.0/objects](/docs/workspec/specification/v2.0/objects)
  - [/docs/workspec/specification/v2.0/tasks](/docs/workspec/specification/v2.0/tasks)
  - [/docs/workspec/specification/v2.0/interactions](/docs/workspec/specification/v2.0/interactions)

---

## Complete example (v2.0)

This complete example demonstrates:

- `schema_version`
- world/process split
- objects with locations
- interactions (quantity and state changes)
- a `service` performer
- recipe definitions
- explicit `depends_on.all`

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
            "timezone": "UTC",
            "currency": "USD",
            "locale": "en-US"
        },
        "world": {
            "layout": {
                "meta": { "units": "meters", "pixels_per_unit": 20 },
                "locations": [
                    { "id": "prep_area", "name": "Preparation Area", "shape": { "type": "rect", "x": 0, "y": 0, "width": 10, "height": 5 } },
                    { "id": "baking_area", "name": "Baking Area", "shape": { "type": "rect", "x": 12, "y": 0, "width": 8, "height": 5 } },
                    { "id": "cooling_area", "name": "Cooling Area", "shape": { "type": "rect", "x": 22, "y": 0, "width": 6, "height": 5 } }
                ]
            },
            "objects": [
                {
                    "id": "head_baker",
                    "type": "actor",
                    "name": "Head Baker",
                    "emoji": "👨‍🍳",
                    "location": "prep_area",
                    "properties": { "role": "Lead Baker", "cost_per_hour": 18.5, "state": "available" }
                },
                {
                    "id": "assistant",
                    "type": "actor",
                    "name": "Assistant Baker",
                    "emoji": "👩‍🍳",
                    "location": "prep_area",
                    "properties": { "role": "Assistant", "cost_per_hour": 12.0, "state": "available" }
                },
                {
                    "id": "service:timer",
                    "type": "service",
                    "name": "Timer Service",
                    "emoji": "⏱️",
                    "location": "prep_area",
                    "properties": { "state": "running", "interval": "5m", "last_run": "2026-02-03T08:00:00Z" }
                },
                {
                    "id": "industrial_mixer",
                    "type": "equipment",
                    "name": "Industrial Mixer",
                    "emoji": "🌀",
                    "location": "prep_area",
                    "properties": { "state": "clean", "capacity": 1, "cost_per_hour": 2.5 }
                },
                {
                    "id": "oven",
                    "type": "equipment",
                    "name": "Commercial Oven",
                    "emoji": "🔥",
                    "location": "baking_area",
                    "properties": { "state": "off", "capacity": 2, "cost_per_hour": 5.0 }
                },
                {
                    "id": "flour",
                    "type": "resource",
                    "name": "Bread Flour",
                    "emoji": "🌾",
                    "location": "prep_area",
                    "properties": { "quantity": 50, "unit": "kg", "cost_per_unit": 0.8 }
                },
                {
                    "id": "water",
                    "type": "resource",
                    "name": "Water",
                    "emoji": "💧",
                    "location": "prep_area",
                    "properties": { "quantity": 100, "unit": "liters", "cost_per_unit": 0.01 }
                },
                {
                    "id": "yeast",
                    "type": "resource",
                    "name": "Active Dry Yeast",
                    "emoji": "🦠",
                    "location": "prep_area",
                    "properties": { "quantity": 5, "unit": "kg", "cost_per_unit": 8.0 }
                },
                {
                    "id": "bread_loaf",
                    "type": "product",
                    "name": "Artisan Bread Loaf",
                    "emoji": "🍞",
                    "location": "cooling_area",
                    "properties": { "quantity": 0, "unit": "loaves", "revenue_per_unit": 3.5, "cost_per_unit": 1.2 }
                }
            ]
        },
        "process": {
            "recipes": {
                "bread_loaf": {
                    "inputs": { "flour": 0.5, "water": 0.3, "yeast": 0.01 },
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
                        { "target_id": "oven", "property_changes": { "state": { "from": "off", "to": "preheating" } } }
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
                        { "target_id": "flour", "property_changes": { "quantity": { "delta": -5 } } },
                        { "target_id": "water", "property_changes": { "quantity": { "delta": -3 } } },
                        { "target_id": "yeast", "property_changes": { "quantity": { "delta": -0.1 } } },
                        { "target_id": "industrial_mixer", "property_changes": { "state": { "from": "clean", "to": "dirty" } } }
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
                    "depends_on": { "all": ["shape_loaves", "preheat_oven"] },
                    "description": "Bake loaves at 220°C",
                    "interactions": [
                        { "target_id": "oven", "property_changes": { "state": { "from": "preheating", "to": "baking" } } },
                        { "target_id": "bread_loaf", "property_changes": { "quantity": { "delta": 10 } } }
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
                        { "target_id": "industrial_mixer", "property_changes": { "state": { "from": "dirty", "to": "clean" } } }
                    ]
                }
            ]
        }
    }
}
```
