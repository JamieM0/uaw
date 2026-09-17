---
title: "Executable source fails or the CLI requires confirmation"
description: "Diagnose CLI trust acknowledgements, synchronous-source failures, and isolation assumptions."
section: "troubleshooting"
type: "troubleshooting"
level: "intermediate"
workspec_version: "2.2"
status: "canonical"
order: 60
related:
  - /docs/cli/security/
  - /docs/workspec/sources/security/
---

# Executable source fails or the CLI requires confirmation

Treat a trust confirmation as acknowledgement of reviewed code, not as a security control.

## Symptom: `workspec constraints` requires confirmation

The command requires `--yes` or `-y` with `--constraints`. It does not prompt interactively.

Review the Constraint file and all other executable project sources. Then rerun the command with the acknowledgement.

## Symptom: `workspec validate --constraints` refuses to run

Project validation requires `--yes` when Constraint source is present. Add it only after you review the source.

The flag acknowledges trust. It does not isolate the Constraint callback.

## Symptom: custom validation prompts or fails in automation

`validate --custom` prompts for `Y` on a terminal unless `--yes` is present. Non-interactive use requires `--yes`.

Custom validation runs in an isolated subprocess with a hard timeout. This isolation applies to the custom-validator path, not all project sources.

See [executing project JavaScript from the CLI](/docs/cli/security/) for the command matrix.

## Symptom: Changes or Generator source ran without a prompt

Changes and Generator flags do not trigger a confirmation prompt. Passing the source path starts trusted in-process execution.

Do not use the absence of a prompt as evidence that the source is data-only or isolated.

## Symptom: a callback returns an async value or never finishes

WorkSpec executable callbacks must be synchronous. Replace asynchronous work with data prepared outside the callback.

The work-unit budget counts callbacks that return. It is not a wall-clock timeout. A synchronous callback that never returns can prevent the in-process runtime from regaining control.

## Symptom: a hosted execution can receive untrusted source

Do not execute that source in the application process. Run each project in a separate worker or process with a wall-clock timeout and resource limits.

Restrict filesystem and network access. Destroy the isolated environment after execution.

The [trusted code and execution security contract](/docs/workspec/sources/security/) owns the full trust, isolation, and timeout model.
