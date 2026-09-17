---
title: "Rendered world looks wrong"
description: "Separate world-state, visual mapping, asset, layout, and renderer-host errors."
section: "troubleshooting"
type: "troubleshooting"
level: "intermediate"
workspec_version: "2.2"
status: "canonical"
order: 50
related:
  - /docs/workspec/rendering/overview/
  - /docs/workspec/rendering/state-visuals/
---

# Rendered world looks wrong

Compare the render with a snapshot from the same authoritative run and time.

## Symptom: an object shows the wrong state

Inspect the object's `properties.state` in the snapshot.

- If the snapshot is wrong, diagnose Changes, Generator logic, or task timing.
- If the snapshot is correct, inspect the State Library and appearance mapping.

The renderer presents resolved state. It does not decide semantic state.

## Symptom: an image is missing

Check each part of the visual lookup:

1. The object has `state_library`.
2. The object has `appearance`.
3. The library contains that appearance.
4. The appearance maps the resolved state to an asset ID.
5. The host's asset resolver returns data for that asset ID.

WorkSpec stores project asset IDs, not asset bytes. A missing result uses an emoji or deterministic fallback glyph.

See [state visuals and assets](/docs/workspec/rendering/state-visuals/) for the lookup contract.

## Symptom: an object appears in the wrong location

Inspect the object's resolved `location` in the snapshot. If it is wrong, diagnose the authored placement or a `move` operation.

If the resolved location is correct, inspect authored location geometry. Objects with an unmatched location appear in the `__unplaced__` group.

See [visual layout](/docs/workspec/rendering/layout/) for placement order and automatic grids.

## Symptom: positions change unexpectedly

The renderer sorts IDs and calculates deterministic positions inside locations. Adding an object can change the presentation grid without changing semantic placement.

Treat calculated coordinates as presentation data. Do not use them as world-state evidence.

## Symptom: CLI and application renders differ

Confirm that both use the same source files, package version, seed, horizon, snapshot time, dimensions, and asset resolver data.

Then confirm that both outputs derive from the same authoritative run when they appear in one workflow. The [rendering model](/docs/workspec/rendering/overview/) defines this boundary.
