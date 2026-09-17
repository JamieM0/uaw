---
title: "Exit codes and failure policy"
description: "Reference for WorkSpec CLI success, result failure, and command failure statuses."
section: "cli"
type: "reference"
level: "intermediate"
workspec_version: "2.2"
status: "canonical"
order: 110
---

# Exit codes and failure policy

The WorkSpec CLI uses three exit status categories.

| Status | Meaning |
|---:|---|
| `0` | The command completed without an error result. |
| `1` | A validation, runtime, migration, or domain result failed. |
| `2` | CLI usage, confirmation, input, parsing, rendering, or output handling failed. |

## Status `0`

Validation warnings do not cause status `1` unless `--fail-on-warning` is present.

Constraint warnings and info violations do not cause status `1`. Error violations do cause status `1`.

## Status `1`

`validate` uses status `1` for error Problems. It also uses status `1` for warnings with `--fail-on-warning`.

`snapshot` and `render` use status `1` when runtime Problems contain an error. `constraints` also checks error violations.

`migrate` uses status `1` when the migration transformation throws an error.

## Status `2`

Status `2` covers unknown options, missing arguments, invalid times, invalid seeds, unreadable files, and invalid JSON.

A denied or missing JavaScript confirmation also produces status `2`. Render setup and output-write failures use the same status.

> **Note:** An unexpected top-level CLI failure uses status `1`. Automation should still capture standard error for its message.

