---
title: "CLI command and option index"
description: "Generated index of WorkSpec CLI commands, inputs, options, confirmations, and JSON envelopes."
section: "cli"
type: "reference"
level: "all"
workspec_version: "2.2"
status: "canonical"
order: 130
generated_sections:
  - command_table
  - exit_codes
---

# CLI command and option index

The documentation build generates this page from `_data/cli-surface.json`. Maintainers compare the manifest with the package CLI implementation.

## Commands

| Command | Input | Options | JSON fields |
|---|---|---|---|
| [`validate`](/docs/cli/validate/) | Starting State file or `-` | `--changes`, `--generator`, `--constraints`, `--time`, `--seed`, `--max-events`, `--custom`, `--custom-catalog`, `--json`, `--fail-on-warning`, `--yes` | `validation`, `run`, `problems` |
| [`snapshot`](/docs/cli/snapshot/) | Starting State file or `-` | `--changes`, `--generator`, `--time`, `--seed`, `--max-events`, `--json` | `time`, `time_minutes`, `seed`, `run`, `state`, `problems` |
| [`constraints`](/docs/cli/constraints/) | Starting State file or `-` | `--constraints`, `--changes`, `--generator`, `--time`, `--seed`, `--max-events`, `--json`, `--yes` | `time`, `seed`, `run`, `violations`, `problems` |
| [`render`](/docs/cli/render/) | Starting State file or `-` | Project, asset, runtime, output, and JSON options | `time`, `time_minutes`, `seed`, `output`, `svg`, `run`, `problems` |
| [`format`](/docs/cli/format/) | JSON file | `--write`, `--out` | None |
| [`migrate`](/docs/cli/migrate/) | Historical JSON file | `--out`, `--schema` | None |

## Global options

| Syntax | Effect |
|---|---|
| `-h`, `--help` | Show help. |
| `-v`, `--version`, `version` | Print the installed package version. |

## Exit codes

| Code | Meaning |
|---:|---|
| `0` | The command completed without an error result. |
| `1` | A validation, runtime, migration, or Constraint result contains an error. |
| `2` | CLI usage, confirmation, input, parsing, rendering, or output handling failed. |

See [exit codes and failure policy](/docs/cli/exit-codes/) for command-specific details.
