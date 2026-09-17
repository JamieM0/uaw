---
title: "Validation and source errors"
description: "Diagnose JSON parsing, document validation, source compilation, and provenance errors."
section: "troubleshooting"
type: "troubleshooting"
level: "intermediate"
workspec_version: "2.2"
status: "canonical"
order: 10
related:
  - /docs/workspec/problems/
  - /docs/cli/validate/
---

# Validation and source errors

Use a Problem's scope and provenance to identify which project layer failed.

## Symptom: the CLI cannot parse the Starting State

The file is not valid JSON, the path is wrong, or standard input is incomplete.

1. Read the CLI error before any WorkSpec Problems.
2. Check the file path and JSON syntax.
3. Run document-only validation again.

Input and JSON parsing failures use CLI exit status `2`. See [`workspec validate`](/docs/cli/validate/) for accepted input.

## Symptom: document validation reports an error

A `document` Problem concerns `start.workspec.json`.

Use `instance` as the JSON Pointer to the affected value. Use `metric_id` for automation, and read `context` before you edit the file.

Common causes include an unsupported schema version, duplicate IDs, an invalid reference, or a field in the wrong language version. Check the owning page in the [Starting State field index](/docs/workspec/starting-state/field-index/).

Do not move an invalid declarative field into executable source to hide the error.

## Symptom: Changes, Generator, or Constraints do not compile

A `source` Problem identifies executable-source compilation or registration failure. Check `provenance.source` to select the correct file.

Confirm that the file uses its own authoring contract:

- Changes register task lifecycle handlers.
- Generator source registers update callbacks.
- Constraints register or export checks.

These files share conventions but not one module syntax. See [executable source files](/docs/workspec/sources/authoring/).

## Symptom: the source compiles but execution reports an error

A `runtime` Problem concerns an attempted event in resolved execution. Inspect its time, task ID, target, and operation context.

Take a snapshot at the last resolved time. Then use [task troubleshooting](./tasks.md) for lifecycle, performer, dependency, or reservation failures.

## Symptom: a Constraint throws or returns an invalid result

A `constraint` Problem concerns the Constraint execution layer. It is not a domain violation.

Check that the callback is synchronous and queries only resolved time. Then compare its return value with the [Constraint violation contract](/docs/workspec/constraints/violations/).

The [Problems reference](/docs/workspec/problems/) owns all generic Problem fields and pointer behavior.
