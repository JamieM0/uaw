---
title: "Calendars and multi-period models"
description: "Reference canonical WorkSpec 2.2 day types, repeating calendars, overrides, and multi-day configuration."
section: "workspec"
type: "reference"
level: "advanced"
workspec_version: "2.2"
status: "canonical"
order: 430
---

# Calendars and multi-period models

WorkSpec 2.2 supports multi-period declarations through `simulation_config`, `day_types`, and `calendar`.

## Simulation configuration

`simulation.simulation_config` can declare `start_date` and `duration_days`.

| Field | Type | Constraint |
|---|---|---|
| `start_date` | string | `YYYY-MM-DD`, `date.today`, or `date.start` with an integer day offset |
| `duration_days` | integer | One or greater |

Examples of relative dates are `date.start + 1` and `date.today - 2`.

## Day types

`simulation.day_types` is an object keyed by plain day-type ID. Each day type requires a non-empty `name`.

```json
{
  "day_types": {
    "weekday": { "name": "Weekday" },
    "weekend": { "name": "Weekend" }
  }
}
```

## Repeating calendar

`simulation.calendar` declares a positive `cycle_length` and a complete, non-empty `pattern`.

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
      { "day": 7, "type": "weekend" }
    ]
  }
}
```

Each cycle day must appear exactly once. Every referenced day type must exist.

## Overrides

`calendar.overrides` is an array of date and day-type replacements.

```json
{ "date": "2026-12-25", "type": "weekend" }
```

The date accepts the same date expressions as `start_date`. The type must reference a declared day type.

## Canonical status

The canonical validator performs document-local integrity checks for these declarations. This status does not make legacy inline day-type task effects canonical 2.2 behavior.

