---
title: "workspec format"
description: "Parse and write a JSON file with WorkSpec CLI formatting."
section: "cli"
type: "reference"
level: "beginner"
workspec_version: "2.2"
status: "canonical"
order: 80
---

# `workspec format`

`workspec format` parses a JSON file and writes two-space JSON with a final newline.

## Syntax

```console
workspec format FILE [--write] [--out PATH]
```

## Output modes

| Options | Destination |
|---|---|
| None | Standard output |
| `--write` | The input file |
| `--out PATH` | The specified file |
| `--write --out PATH` | The specified file |

The command exits with status `2` when it cannot read or parse the input.

## Formatting contract

The command uses JSON parsing and serialization. It preserves the parsed JSON value, not the original text representation.

Whitespace and number spelling can change. Duplicate object names collapse during parsing, so do not use this command to preserve invalid authoring intent.

The command does not validate WorkSpec fields or migrate language versions.

