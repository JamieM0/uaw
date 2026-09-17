---
title: "Debug a broken project"
description: "Use validation, resolved inspection, Constraints, and rendering to isolate project failures."
section: "guides"
type: "how-to"
level: "intermediate"
workspec_version: "2.2"
status: "canonical"
order: 40
related:
  - /docs/troubleshooting/validation/
  - /docs/workspec/problems/
---

# Debug a broken project

Use one evidence path from authored files to resolved world state. Stop at the first layer that does not match your expectation.

## Preserve the failing case

Record the package version, language version, input files, seed, requested horizon, and work budget. Do not change several inputs before you can reproduce the symptom.

> **Warning:** Review executable project sources before you run them. WorkSpec project JavaScript runs in process.

See [trusted code and execution security](/docs/workspec/sources/security/) before you inspect an untrusted project.

## Validate the document

Run document-only validation first:

```console
workspec validate start.workspec.json \
  --no-changes --no-generator --no-constraints --json
```

Use each Problem's `scope`, `provenance`, `metric_id`, and `instance` to locate the cause. Fix document errors before you execute project sources.

## Validate the project

Use the discovered executable sources and the same run controls that reproduce the failure:

```console
workspec validate start.workspec.json \
  --time 600 --seed 17 --max-events 20000 --json
```

This step separates source-compilation failures from runtime Problems. Add Constraints only after the run succeeds.

## Inspect resolved state

Take snapshots at the last correct time and the first incorrect time. Compare task status, runtime instances, reservations, object properties, and locations.

Check `run.resolved_through` before you trust a requested time. If the run stopped early, follow [requested time was not resolved](/docs/troubleshooting/unresolved-time/).

## Check domain truth

Run Constraints against the same seed and horizon. A violation can explain why a structurally valid execution produces an invalid world.

If a rule never fires or reports poor evidence, follow [Constraint surprises](/docs/troubleshooting/constraints/).

## Render last

Render the same resolved time after state inspection. If the snapshot is correct but the image is wrong, inspect State Library mappings, assets, and layout.

This order prevents a presentation symptom from hiding a state or runtime failure. See [rendered world looks wrong](/docs/troubleshooting/rendering/).
