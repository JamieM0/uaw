---
title: "workspec snapshot"
description: "Run a WorkSpec project and inspect its resolved observable state at one time."
section: "cli"
type: "reference"
level: "intermediate"
workspec_version: "2.2"
status: "canonical"
order: 50
---

# `workspec snapshot`

`workspec snapshot` creates one authoritative run and returns observable state at a required time.

## Syntax

```console
workspec snapshot START --time TIME [OPTIONS]
```

## Options

| Option | Required | Default | Purpose |
|---|---:|---:|---|
| `--time TIME` | Yes | None | Set the snapshot time and requested horizon. |
| `--changes PATH` | No | Discovered sibling | Override the Changes source. |
| `--no-changes` | No | Off | Exclude Changes. |
| `--generator PATH` | No | Discovered sibling | Override the Generator source. |
| `--no-generator` | No | Off | Exclude the Generator. |
| `--seed INTEGER` | No | `1` | Set deterministic Generator randomness. |
| `--max-events INTEGER` | No | `10000` | Set the runtime work budget. |
| `--json` | No | Off | Print the JSON envelope. |

## JSON result

The envelope contains `time`, `time_minutes`, `seed`, `run`, `state`, and `problems`.

The `state` value is `null` when execution cannot reach the requested time. The Problems then include `snapshot.time.unresolved`.

The `run.resolved_through` field gives the last safe inspection boundary. Raise `--max-events` only for a trusted project.

The command loads `changes.workspec.js` and `generator.workspec.js` from the Starting State directory when those files exist.

## Behavior boundary

The command does not validate the Starting State before execution. Run [`workspec validate`](/docs/cli/validate/) as a separate check.

The snapshot uses the run created for this command. It does not execute project behavior a second time.
