---
title: "5. Inspect and debug"
description: "Use validation Problems, snapshots, and resolved-through time to inspect a WorkSpec run."
section: "learn"
type: "tutorial"
level: "beginner"
workspec_version: "2.2"
status: "canonical"
order: 50
---

# 5. Inspect and debug

You will inspect the repair-depot project at several resolved times.

## Read machine-friendly validation output

Run project validation with JSON output:

```console
npx workspec validate start.workspec.json \
  --changes changes.workspec.js \
  --time 08:30 \
  --json
```

A successful result contains an empty `problems` array. The `run` object records the requested horizon and the safe resolution boundary.

```json
{
  "validation": { "mode": "project" },
  "run": {
    "requested_horizon": 510,
    "resolved_through": 510
  },
  "problems": []
}
```

The complete envelope includes more run metadata.

## Compare snapshots

Run these commands in order:

```console
npx workspec snapshot start.workspec.json --changes changes.workspec.js --time 08:05 --json
npx workspec snapshot start.workspec.json --changes changes.workspec.js --time 08:10 --json
npx workspec snapshot start.workspec.json --changes changes.workspec.js --time 08:30 --json
```

Inspect these paths in each response:

| JSON path | Question |
|---|---|
| `state.objects.pump.properties.state` | What state is the pump in? |
| `state.objects.pump.location` | Where is the pump? |
| `state.task_statuses.inspect_pump` | Did inspection finish? |
| `state.task_statuses.repair_pump` | Did repair start or finish? |
| `run.resolved_through` | What time is safe to inspect? |

## Use Problems as structured data

A Problem identifies its layer through `scope` and `provenance`. Use `metric_id` for automation instead of parsing the human-readable message.

The `instance` field often points to the related JSON field. Source and runtime Problems use source-related or runtime locations where appropriate.

> **Checkpoint:** A snapshot shows resolved state at one time. It is not a second execution model.

See [Problems and diagnostics](/docs/workspec/problems/) and [snapshots and resolved state](/docs/workspec/runtime/snapshots/) for complete contracts.

## Next step

[Render the world](/docs/learn/render-world/) from the same project inputs.

