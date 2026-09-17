---
title: "Executing project JavaScript from the CLI"
description: "Understand WorkSpec CLI confirmations before executing project JavaScript."
section: "cli"
type: "how-to"
level: "intermediate"
workspec_version: "2.2"
status: "canonical"
order: 120
---

# Executing project JavaScript from the CLI

Review every executable project source before you pass it to the WorkSpec CLI.

The [trusted code and execution security contract](/docs/workspec/sources/security/) owns the system-wide isolation and timeout model.

## Command confirmations

| Command and source | Confirmation behavior |
|---|---|
| `validate --custom` | Prompts for `Y` on a TTY unless `--yes` is present. Non-interactive use requires `--yes`. |
| `validate --constraints` | Requires `--yes`. It does not prompt. |
| `constraints --constraints` | Requires `--yes`. It does not prompt. |
| Changes or Generator flags | No confirmation prompt. Passing the flag starts execution. |

`--yes` acknowledges trust. It does not make source safe or add isolation.

## Use trusted source files

1. Review the source and its dependencies.
2. Confirm that the path names the reviewed file.
3. Add `--yes` only after the review.
4. Use process or worker isolation for untrusted hosted input.

The custom-validation path uses a subprocess and a hard timeout. Project runtime callbacks use the runtime trust model described by the system security contract.

