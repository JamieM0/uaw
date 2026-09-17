---
title: "Starting State overview"
description: "Reference the declarative WorkSpec 2.2 document and its major regions."
section: "workspec"
type: "reference"
level: "beginner"
workspec_version: "2.2"
status: "canonical"
order: 310
---

# Starting State overview

Starting State is the declarative `start.workspec.json` input for a WorkSpec project.

## Document shape

```json
{
  "$schema": "https://universalautomation.wiki/workspec/v2.2.schema.json",
  "simulation": {
    "schema_version": "2.2",
    "meta": {
      "title": "Sterilisation line",
      "description": "A small process model",
      "domain": "healthcare"
    },
    "world": {
      "objects": []
    },
    "process": {
      "tasks": []
    }
  }
}
```

Include `simulation`, `schema_version`, `meta`, `world`, and `process`. Use arrays for `world.objects` and `process.tasks`, including when empty.

## Major regions

| Region | Purpose |
|---|---|
| `meta` | Identifies and describes the model. |
| `config` | Sets global time, locale, currency, and timezone values. |
| `world` | Declares objects and physical layout. |
| `process` | Declares tasks and reusable work definitions. |
| `type_definitions` and `type_traits` | Define reusable object types and performer traits. |
| `state_libraries` | Maps semantic object states to asset IDs. |
| `collections` | Selects changing sets of objects or locations. |
| `simulation_config`, `calendar`, and `day_types` | Declares multi-period calendar data. |

## Declarative boundary

Starting State cannot contain executable task effects in WorkSpec 2.2. The validator rejects `interactions`, `equipment_interactions`, `consumes`, and `produces` on tasks.

Put predetermined task effects in `changes.workspec.js`. Put optional causal logic in `generator.workspec.js`.

## Validation boundary

Document validation checks facts that one Starting State document can establish. Runtime validation owns execution-dependent conclusions.

Use the [Starting State field index](./field-index.generated.md) to find the page that owns each canonical field.
