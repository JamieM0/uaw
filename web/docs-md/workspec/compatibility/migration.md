---
title: "Migration behavior"
description: "Migrate previous UAW or WorkSpec 1 documents to the exact WorkSpec 2.1 target produced by the current migrator."
section: "workspec"
type: "how-to"
level: "advanced"
workspec_version: "2.2"
status: "compatibility"
order: 840
---

# Migration behavior

The current migration implementation converts previous UAW or WorkSpec 1 shapes to WorkSpec 2.1.

> **Caution:** Do not treat the result as WorkSpec 2.2. The migrator sets `simulation.schema_version` to `2.1`.

## Run the migration

To create a migrated file with a schema URI, run:

```bash
workspec migrate legacy.json --out migrated.workspec.json --schema
```

Expected result: the output declares WorkSpec 2.1 and uses a nested `simulation` root.

## Automatic transformations

The migrator performs these best-effort transformations:

- wraps a flat input in `simulation`;
- sets `schema_version` to `2.1`;
- optionally adds the 2.1 `$schema` URI;
- creates required metadata and configuration defaults;
- moves flat objects, layout, tasks, and recipes into `world` and `process`;
- converts legacy actors, equipment, resources, and products into objects;
- normalizes IDs and makes duplicate IDs unique;
- maps common legacy object types to canonical built-in types;
- updates object, task, location, actor, and dependency references when possible;
- converts `consumes`, `produces`, and equipment effects into inline 2.1 interactions; and
- renames interaction `object_id` and `revert_after` fields.

## Defaults

Default configuration values are `USD`, `en-US`, `UTC`, and `minutes`. Caller options can replace these defaults.

Missing metadata receives fallback values. Generated fallback IDs can depend on migration time when the input has no usable ID.

## Manual review

Review every migrated document for domain accuracy. The transformation normalizes shape but cannot infer missing intent.

Check object types, generated IDs, references, time units, metadata, interaction timing, and day-type tasks.

Then validate the 2.1 output. Convert inline behavior to Changes before manually upgrading the document to 2.2.

## Migration limits

The migrator does not convert arbitrary older or current projects directly to the latest language. It also does not create 2.2 Changes source files.

The migrator keeps some legacy day-type structure and normalizes interactions only where it can do so safely.

