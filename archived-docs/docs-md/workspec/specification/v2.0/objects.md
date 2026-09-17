# WorkSpec v2.0 Object Model

Objects are the entities that exist in the simulation world: people, machines, resources, products, and digital entities.

---

## Where objects live (v2.0)

Objects are defined under:

- `simulation.world.objects[]`

---

## Object structure

All objects share a standardized top-level shape.

```json
{
    "id": "head_baker",
    "type": "actor",
    "name": "Head Baker",
    "emoji": "👨‍🍳",
    "location": "prep_area",
    "properties": {
        "role": "Lead Baker",
        "cost_per_hour": 25.0,
        "state": "available"
    }
}
```

### Top-level fields

| Field | Required | Type | Meaning |
|---|---:|---|---|
| `id` | Yes | string | Unique identifier |
| `type` | Yes | string | Object type |
| `name` | Yes | string | Display name |
| `emoji` | No | string | Visual icon (single emoji / short emoji sequence) |
| `location` | No | string | Location ID from `simulation.world.layout.locations[]` |
| `properties` | No | object | Type-specific and custom properties |

All type-specific fields belong in the `properties` bag.

---

## Object ID rules

### Plain IDs (recommended default)

Plain IDs are snake_case:

- Regex: `^[a-z][a-z0-9_]{0,249}$`
- Max length: 250 characters

Examples:

- Valid: `head_baker`, `oven_1`, `prep_area`
- Invalid: `HeadBaker`, `prep-area`, `1_baker`, `prep area`

### Optional namespaced IDs

IDs may include a namespace prefix:

```json
{ "id": "actor:head_baker", "type": "actor" }
{ "id": "equipment:industrial_mixer", "type": "equipment" }
```

Rules:

- Format: `{type}:{identifier}`
- If a namespace is present, it **MUST** match the `type` field exactly
- Plain IDs (without namespace) remain valid
- Max ID length remains 250 characters

---

## Built-in types (v2.0)

### Core types

| Type | Description | Can perform tasks | Key properties |
|---|---|---:|---|
| `actor` | Human workers | Yes | `state`, `role`, `cost_per_hour`, shifts |
| `equipment` | Machines/tools | Yes | `state`, `capacity`, `cost_per_hour` |
| `resource` | Consumables | No | `quantity`, `unit`, `cost_per_unit` |
| `product` | Outputs | No | `quantity`, `unit`, `revenue_per_unit` |
| `service` | Automated/background process | Yes | `state`, `interval`, `last_run` |

### Digital types

| Type | Description | Notes |
|---|---|---|
| `display` | Screen device | Typically stateful |
| `screen_element` | UI element | Typically stateful |
| `digital_object` | Virtual entity | Can be stateful and/or quantifiable |

---

## Type aliases (removed in v2.0)

The following are not valid in v2.0:

- `material`
- `ingredient`
- `tool`

Use canonical types instead:

- Use `resource` instead of `material`/`ingredient`
- Use `equipment` instead of `tool`

---

## Reserved type names

The following type names are reserved and cannot be used:

- `timeline_actors` (internal)
- `_internal` (and any type starting with `_`)
- `any` (reserved wildcard)
- `unknown` (reserved untyped placeholder)

---

## Custom types (v2.0)

Custom types are declared in:

- `simulation.type_definitions`

Schema:

```json
{
    "type_definitions": {
        "vehicle": {
            "extends": "equipment",
            "description": "Motorized transport equipment",
            "additional_properties": {
                "speed": { "type": "number", "unit": "km/h" },
                "fuel_capacity": { "type": "number", "unit": "liters" }
            }
        }
    }
}
```

Rules:

- Custom types **MUST** declare `extends` pointing to a built-in base type.
- Objects using a custom `type` **MUST** have a corresponding definition in `simulation.type_definitions`.
- Custom types inherit the traits/capabilities of their base type (for example, a type extending `equipment` can act as a task performer).

---

## Standard properties (quick reference)

For a full standard property list, see [/docs/workspec/reference/properties](/docs/workspec/reference/properties).

Common patterns:

- `resource` / `product` should use numeric `properties.quantity` and string `properties.unit`.
- `actor` / `equipment` / `service` typically use `properties.state` to model discrete states.

---

## Location references

If an object has a top-level `location`, it must reference a valid location id from:

- `simulation.world.layout.locations[]`

Location format is defined under the Spatial Model in [/docs/workspec/specification/v2.0/validation](/docs/workspec/specification/v2.0/validation) and the JSON Schema.
