---
title: "workspec render"
description: "Run a WorkSpec project and render one resolved state as standalone SVG."
section: "cli"
type: "reference"
level: "intermediate"
workspec_version: "2.2"
status: "canonical"
order: 70
---

# `workspec render`

`workspec render` resolves a project through a required time and creates standalone SVG.

## Syntax

```console
workspec render START --time TIME [OPTIONS]
```

## Options

| Option | Required | Default | Purpose |
|---|---:|---:|---|
| `--time TIME` | Yes | None | Set the rendered snapshot time. |
| `--changes PATH` | No | Discovered sibling | Override the Changes source. |
| `--no-changes` | No | Off | Exclude Changes. |
| `--generator PATH` | No | Discovered sibling | Override the Generator source. |
| `--no-generator` | No | Off | Exclude the Generator. |
| `--assets DIRECTORY` | No | Discovered `assets/` | Override the asset directory. |
| `--no-assets` | No | Off | Exclude project assets. |
| `--seed INTEGER` | No | `1` | Set the Generator seed. |
| `--max-events INTEGER` | No | `10000` | Set the work-unit budget. |
| `--out PATH` | No | Standard output | Write SVG to a file. |
| `--json` | No | Off | Print a JSON envelope. |

The command discovers project sources and `assets/` beside the Starting State. The asset directory accepts GIF, JPEG, PNG, SVG, and WebP files.

Asset filenames map to asset IDs after extension removal and normalization.

Two files must not map to the same asset ID. The command reports an error when a collision occurs.

## Output modes

Without `--out` or `--json`, the command writes SVG to standard output. With `--out`, it writes SVG to the specified path.

With `--json`, the envelope contains `time`, `time_minutes`, `seed`, `output`, `svg`, `run`, and `problems`.

When `--out` is present, `svg` is `null`. Without `--out`, `output` is `null`, and `svg` contains the document.

Rendering presents resolved state. It does not define another simulation path. See the [SVG renderer reference](/docs/workspec/rendering/svg/).
