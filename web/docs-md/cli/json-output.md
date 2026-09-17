---
title: "JSON output and automation"
description: "Consume WorkSpec CLI JSON envelopes in scripts and continuous integration."
section: "cli"
type: "how-to"
level: "intermediate"
workspec_version: "2.2"
status: "canonical"
order: 100
---

# JSON output and automation

Use `--json` to receive a command-specific JSON envelope on standard output.

## Envelope fields by command

| Command | Top-level fields |
|---|---|
| `validate` | `validation`, `run`, `problems` |
| `snapshot` | `time`, `time_minutes`, `seed`, `run`, `state`, `problems` |
| `constraints` | `time`, `seed`, `run`, `violations`, `problems` |
| `render` | `time`, `time_minutes`, `seed`, `output`, `svg`, `run`, `problems` |

`format` and `migrate` do not implement `--json` envelopes.

## Run metadata

When a command executes a project, its `run` object contains:

| Field | Meaning |
|---|---|
| `executed` | Whether runtime execution started |
| `seed` | Effective Generator seed |
| `requested_horizon` | Requested finite time, or `null` |
| `resolved_through` | Last safe inspection time, or `null` |
| `complete` | Whether execution completed within the request and budget |
| `max_events` | Effective work-unit budget |
| `processed_work_units` | Work units consumed |

## Use output in continuous integration

To fail for validation warnings, run:

```console
workspec validate start.workspec.json --json --fail-on-warning > validation.json
```

Read the process exit code before parsing optional fields. Status `2` can mean that the command produced no valid JSON envelope.

Do not treat a zero exit status as proof that warnings do not exist. Inspect `problems` when warning policy matters.

Problem fields belong to the [Problems and diagnostics reference](/docs/workspec/problems/). Constraint result fields belong to [Constraint violations](/docs/workspec/constraints/violations/).
