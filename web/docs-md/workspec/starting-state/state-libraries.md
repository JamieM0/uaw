---
title: "State Libraries and appearance"
description: "Reference semantic state libraries, appearance mappings, and project asset identifiers."
section: "workspec"
type: "reference"
level: "intermediate"
workspec_version: "2.2"
status: "canonical"
order: 360
---

# State Libraries and appearance

A State Library maps semantic object states to project asset IDs.

## Library shape

`simulation.state_libraries` is an object keyed by a plain library ID.

```json
{
  "state_libraries": {
    "actor_basic": {
      "states": ["available", "working"],
      "appearances": {
        "standard": {
          "available": "asset_actor_idle",
          "working": "asset_actor_working"
        }
      }
    }
  }
}
```

`states` must contain unique, non-empty strings. `appearances` is optional and maps appearance IDs to state-to-asset maps.

Each mapped state must exist in `states`. Each asset ID must be a non-empty string.

## Object selection

An object opts in with `state_library`. Its initial `properties.state` must exist in that library.

The optional `appearance` selects one appearance map. An object cannot declare `appearance` without `state_library`.

## State and presentation

`properties.state` remains the semantic source of truth. The State Library only selects a visual asset for that state.

Store asset bytes in project asset storage. WorkSpec documents contain asset IDs and must not embed asset data.

## Runtime boundary

The document validator checks the Starting State. A runtime state change needs separate validation against the selected library.
