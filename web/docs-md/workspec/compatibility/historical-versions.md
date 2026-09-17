---
title: "Historical WorkSpec versions"
description: "Compare validator acceptance, runtime status, CLI status, Studio evidence, migration, and authoring recommendations."
section: "workspec"
type: "reference"
level: "intermediate"
workspec_version: "2.2"
status: "compatibility"
order: 820
---

# Historical WorkSpec versions

Version support differs by product surface. Validator acceptance alone does not mean complete support.

## Capability matrix

| Language | Validator | Runtime | CLI | Studio | Migration | New work |
|---|---|---|---|---|---|---|
| previous UAW / 1.x | Rejects missing version | No public contract | Migration only | Product-specific flow | To 2.1 | No |
| 2.0 | Accepted | Partial historical paths | Validation only established | Package evidence is insufficient | None | No |
| 2.1 | Accepted | Version-gated inline behavior | Validation established | Package evidence is insufficient | Target | No |
| 2.2 | Accepted | Current runtime | Current execution | Current target | None | Yes |

## Validator versions

The canonical validator lists `2.0`, `2.1`, and `2.2` as accepted values. It applies version-gated rules to historical inline task behavior.

## Current recommendation

Use WorkSpec 2.2 for new work. Declare the language version in every complete example.

Use the [migration behavior](./migration.md) page for previous UAW or 1.x input. Do not describe that migration as a direct 2.2 upgrade.
