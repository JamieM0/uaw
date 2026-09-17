---
title: "workspec constraints"
description: "Run Constraints against one authoritative WorkSpec execution."
section: "cli"
type: "reference"
level: "intermediate"
workspec_version: "2.2"
status: "canonical"
order: 60
---

# `workspec constraints`

`workspec constraints` evaluates domain rules against one authoritative resolved run.

## Syntax

```console
workspec constraints START --yes [OPTIONS]
```

The command discovers `constraints.workspec.js`, `changes.workspec.js`, and `generator.workspec.js` beside the Starting State.

A loaded Constraints source requires `--yes`. The command does not offer an interactive confirmation.

## Options

| Option | Required | Default | Purpose |
|---|---:|---:|---|
| `--constraints PATH` | No | Discovered sibling | Override Constraint JavaScript. |
| `--no-constraints` | No | Off | Exclude Constraints. |
| `--yes`, `-y` | For Constraints | None | Acknowledge trusted Constraint JavaScript. |
| `--changes PATH` | No | Discovered sibling | Override Changes. |
| `--no-changes` | No | Off | Exclude Changes. |
| `--generator PATH` | No | Discovered sibling | Override the Generator. |
| `--no-generator` | No | Off | Exclude the Generator. |
| `--time TIME` | No | Final resolved time | Set a finite run and Constraint time. |
| `--seed INTEGER` | No | `1` | Set the Generator seed. |
| `--max-events INTEGER` | No | `10000` | Set the work-unit budget. |
| `--json` | No | Off | Print the JSON envelope. |

## JSON result

The envelope contains `time`, `seed`, `run`, `violations`, and `problems`.

`violations` contains domain results returned by Constraint checks. `problems` contains compilation, runtime, and execution diagnostics.

The command exits with status `1` for an error violation or an error Problem. Warning and info violations do not cause failure.

See [Constraint violations](/docs/workspec/constraints/violations/) for the violation contract. See [Problems and diagnostics](/docs/workspec/problems/) for Problem fields.
