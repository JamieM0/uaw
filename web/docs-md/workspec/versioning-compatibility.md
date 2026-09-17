---
title: "Versions and compatibility"
description: "Distinguish WorkSpec language versions, package versions, schema URIs, and compatibility support."
section: "workspec"
type: "reference"
level: "intermediate"
workspec_version: "2.2"
status: "canonical"
order: 40
---

# Versions and compatibility

WorkSpec uses independent versions for the language, package, schema, and applications.

## Version types

| Version | Identifies | Example |
|---|---|---|
| language version | The syntax and semantics of a WorkSpec document. | `2.2` |
| schema URI version | The JSON Schema associated with a language version. | `v2.2.schema.json` |
| npm package version | A release of the `workspec` package and CLI. | `1.2.x` |
| Studio version | A release of WorkSpec Studio, when versioned separately. | Product-specific |

Do not infer the language version from the package version. Read `simulation.schema_version` from the document.

## Canonical declaration

Every complete 2.2 example declares `simulation.schema_version`. The `$schema` field is optional, but a supplied URI must match that version.

```json
{
  "$schema": "https://universalautomation.wiki/workspec/v2.2.schema.json",
  "simulation": {
    "schema_version": "2.2"
  }
}
```

The full document also requires `meta`, `world`, and `process`.

## Compatibility contract

The document validator accepts language versions `2.0`, `2.1`, and `2.2`. Acceptance does not promise complete runtime, CLI, or Studio support.

Use WorkSpec 2.2 for new projects. Keep historical fields out of canonical 2.2 examples.

The checked-in migration converts previous UAW or WorkSpec 1 shapes to WorkSpec 2.1. It does not migrate arbitrary input directly to 2.2.

See the [historical version matrix](./compatibility/historical-versions.md) and [migration behavior](./compatibility/migration.md).

