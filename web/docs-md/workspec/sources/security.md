---
title: "Trusted code and execution security"
description: "Understand executable WorkSpec sources, in-process limits, custom-validation isolation, and hosting requirements."
section: "workspec"
type: "reference"
level: "advanced"
workspec_version: "2.2"
status: "canonical"
order: 220
---

# Trusted code and execution security

Changes, Constraints, Generators, and custom validators can execute JavaScript. Treat project source as code, not data.

> **Warning:** Do not execute an untrusted WorkSpec project in the package runtime process.

## Executable sources

| Source | Typical trigger | Execution model |
|---|---|---|
| Changes | Project execution, snapshots, rendering, or project validation | In process |
| Generator | Project execution, snapshots, rendering, or project validation | In process |
| Constraints | Constraint execution or project validation with Constraint source | In process |
| custom validator | Custom validation CLI path | Isolated subprocess with a hard timeout |

Project commands can execute conventional sources beside the Starting State. Use the applicable `--no-*` option to exclude a source.

A loaded Constraints source and custom validation require an explicit acknowledgement such as `--yes` in non-interactive use.

## Work budget

The runtime work budget counts task events, callbacks, writes, reservations, active guards, and dynamic collection work.

The budget is not a wall-clock timeout. A synchronous callback that never returns prevents the in-process runtime from regaining control.

## Isolation boundary

The standard runtime executes trusted project sources in process. The custom-validation path uses a subprocess and a hard timeout.

These models are different. Custom-validator isolation does not make Changes, Generator, or Constraint execution isolated.

## Hosted execution

To accept untrusted sources, run each project in a separate worker or process. Apply a wall-clock timeout and operating-system resource limits.

Restrict filesystem and network access. Destroy the isolated environment after execution.

Do not rely only on `maxEvents`. A non-returning synchronous callback can consume CPU without increasing the work counter.

## Authoring requirements

Keep callbacks synchronous and deterministic where the source contract requires determinism. Use the Generator `random()` helper instead of `Math.random()`.

Review all project JavaScript before local execution. Pin the package version when reproducible or regulated execution matters.
