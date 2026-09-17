---
title: "workspec validate"
description: "Validate a Starting State document or a complete WorkSpec project."
section: "cli"
type: "reference"
level: "intermediate"
workspec_version: "2.2"
status: "canonical"
order: 40
---

# `workspec validate`

`workspec validate` checks a Starting State document and its conventional project sources.

## Syntax

```console
workspec validate START [OPTIONS]
```

`START` is a JSON file path or `-` for standard input.

## Validation modes

The command discovers `changes.workspec.js`, `generator.workspec.js`, and `constraints.workspec.js` beside the Starting State.

Use `--no-changes`, `--no-generator`, and `--no-constraints` together for document validation. An explicit source path overrides its discovered path.

Project validation composes document, source, runtime, and optional Constraint results. `--time` sets a finite runtime horizon.

## Options

| Option | Purpose |
|---|---|
| `--changes PATH` | Override the discovered Changes source. |
| `--no-changes` | Exclude Changes. |
| `--generator PATH` | Override the discovered Generator source. |
| `--no-generator` | Exclude the Generator. |
| `--constraints PATH` | Override the discovered Constraints source. |
| `--no-constraints` | Exclude Constraints. |
| `--time TIME` | Resolve through a finite time. |
| `--seed INTEGER` | Set the Generator seed. |
| `--max-events INTEGER` | Set the work-unit budget. |
| `--custom PATH`, `-custom PATH` | Run a custom validator. |
| `--custom-catalog PATH` | Load an explicit custom metrics catalog. |
| `--json` | Print the JSON envelope. |
| `--fail-on-warning` | Exit with status `1` when any warning exists. |
| `--yes`, `-y` | Acknowledge a loaded Constraints source or custom validator. |

## JSON result

The JSON envelope contains `validation`, `run`, and `problems`. `run` is `null` for document validation.

```json
{
  "validation": { "mode": "document", "source": "start.workspec.json", "custom": false },
  "run": null,
  "problems": []
}
```

For project validation, `run` reports the requested horizon, resolved-through time, completion status, seed, and work-budget use.

## Failure behavior

The command exits with status `1` for an error Problem. With `--fail-on-warning`, any warning also produces status `1`.

Usage, input, confirmation, and custom-validation execution failures produce status `2`. See [exit codes](/docs/cli/exit-codes/).
