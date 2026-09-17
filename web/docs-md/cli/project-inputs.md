---
title: "Project source inputs"
description: "Reference for Starting State, executable source flags, time, seed, and work-budget CLI inputs."
section: "cli"
type: "reference"
level: "intermediate"
workspec_version: "2.2"
status: "canonical"
order: 30
---

# Project source inputs

Project commands combine one Starting State JSON document with optional executable JavaScript sources.

## Input files

| Input | Default location | Override or exclusion | Commands |
|---|---|---|---|
| Starting State | First positional argument | None | All commands |
| Changes source | `changes.workspec.js` beside Starting State | `--changes PATH` or `--no-changes` | `validate`, `snapshot`, `render`, `constraints` |
| Generator source | `generator.workspec.js` beside Starting State | `--generator PATH` or `--no-generator` | `validate`, `snapshot`, `render`, `constraints` |
| Constraints source | `constraints.workspec.js` beside Starting State | `--constraints PATH` or `--no-constraints` | `validate`, `constraints` |
| Custom validator | None | `--custom PATH` or `-custom PATH` | `validate` |
| Metrics catalog | Beside the custom validator | `--custom-catalog PATH` | `validate` |
| Asset directory | `assets/` beside Starting State | `--assets DIRECTORY` or `--no-assets` | `render` |

The CLI loads each conventional input when it exists. An explicit path overrides the conventional path. A `--no-*` option excludes that input.

Use `-` as the Starting State path to read JSON from standard input. The CLI then discovers conventional inputs in the current directory.

If a conventional source does not exist, the CLI uses an empty source. Source options always read named files.

## Runtime options

| Option | Value | Default | Constraint |
|---|---|---:|---|
| `--time` | WorkSpec time | Command-specific | See accepted time forms |
| `--seed` | Safe integer | `1` | Controls deterministic Generator randomness |
| `--max-events` | Integer | `10000` | Runtime maximum is `1000000` work units |

The CLI accepts elapsed minutes, `HH:MM`, strict ISO date-times with offsets, and JSON day/time objects.

```console
workspec snapshot start.workspec.json --time '{"day":2,"time":"09:42"}' --json
```

The shell quoting in the example prevents the JSON object from splitting into multiple arguments.

## Trust boundary

Changes, Generators, Constraints, and custom validators contain JavaScript. Review these files before execution.

The [CLI security page](/docs/cli/security/) documents command confirmations. The [system security contract](/docs/workspec/sources/security/) explains execution and isolation.
