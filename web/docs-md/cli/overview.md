---
title: "CLI overview"
description: "Choose a WorkSpec CLI command for validation, execution, inspection, rendering, migration, or formatting."
section: "cli"
type: "explanation"
level: "beginner"
workspec_version: "2.2"
status: "canonical"
order: 10
---

# CLI overview

The `workspec` command validates documents and runs WorkSpec projects from a terminal or automation system.

## Command workflow

| Goal | Command | Result |
|---|---|---|
| Check a document or project | `workspec validate` | Problems and optional run metadata |
| Inspect resolved state | `workspec snapshot` | One snapshot from an authoritative run |
| Check domain rules | `workspec constraints` | Constraint violations and Problems |
| Create an SVG | `workspec render` | Standalone SVG or a JSON envelope |
| Reformat JSON | `workspec format` | Two-space JSON with a final newline |
| Migrate historical input | `workspec migrate` | A WorkSpec 2.1 document |

The CLI uses the package validator and runtime. It does not define a separate language or execution model.

## Common workflow

1. Run `workspec validate start.workspec.json --yes` to check the project.
2. Use a source option only to override or exclude a discovered project source.
3. Run `workspec snapshot` to inspect state at a specified time.
4. Run `workspec constraints` to evaluate domain rules against the same run.
5. Run `workspec render` to present the resolved state as SVG.

Use [`--json` output](/docs/cli/json-output/) in scripts. See the [command and option index](/docs/cli/reference/) for exact command syntax.

## Related pages

- [Project source inputs](/docs/cli/project-inputs/)
- [Exit codes and failure policy](/docs/cli/exit-codes/)
- [Executing project JavaScript from the CLI](/docs/cli/security/)
