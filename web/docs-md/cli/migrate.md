---
title: "workspec migrate"
description: "Migrate Previous UAW Syntax input to the historical WorkSpec 2.1 shape."
section: "cli"
type: "reference"
level: "intermediate"
workspec_version: "2.2"
status: "compatibility"
order: 90
---

# `workspec migrate`

`workspec migrate` converts Previous UAW Syntax input to a WorkSpec 2.1 document.

## Syntax

```console
workspec migrate INPUT --out OUTPUT [--schema]
```

You must supply `--out`. The command overwrites the input only when both paths resolve to the same file.

> **Caution:** Choose a different output path when you need to retain the source document.

## Options

| Option | Required | Effect |
|---|---:|---|
| `--out PATH` | Yes | Write the migrated JSON document. |
| `--schema` | No | Add a top-level `$schema` when the input lacks one. |

The CLI sets migration defaults to currency `USD`, locale `en-US`, and timezone `UTC`.

## Migration boundary

The command sets `simulation.schema_version` to `2.1`. It does not migrate arbitrary input directly to WorkSpec 2.2.

The migration normalizes known legacy entities, configuration, structure, identifiers, tasks, and multi-period data on a best-effort basis.

Review the result before use. See [migration behavior](/docs/workspec/compatibility/migration/) for the complete transformation contract.

Parse and input failures produce status `2`. Migration transformation failures produce status `1`.
