---
title: "Author WorkSpec with AI tools"
description: "Give AI tools canonical context and require validated, inspected evidence from generated projects."
section: "guides"
type: "how-to"
level: "intermediate"
workspec_version: "2.2"
status: "canonical"
order: 80
related:
  - /docs/workspec/starting-state/field-index/
  - /docs/workspec/sources/authoring/
---

# Author WorkSpec with AI tools

Treat AI-generated WorkSpec as an untrusted draft until tools validate and inspect it.

## Provide canonical context

Give the AI tool these inputs:

- the current WorkSpec language version;
- the [Starting State field index](/docs/workspec/starting-state/field-index/);
- the reference page for each feature in scope;
- the correct declaration file for each executable source;
- the domain facts and acceptance criteria.

Do not use historical examples as the primary prompt. Compatibility syntax can look valid while remaining unsuitable for new projects.

## Request separate project files

Require distinct outputs for Starting State, Changes, optional Generator logic, and Constraints.

Ask the tool to explain ownership choices. Predetermined task effects belong in Changes. Causal state-driven behavior belongs in Generator logic. Domain truth belongs in Constraints.

The [project model](/docs/workspec/project-model/) defines these boundaries.

## Validate in stages

1. Parse and validate `start.workspec.json` with all conventional sources excluded.
2. Review every executable source as JavaScript.
3. Validate the project with a fixed seed, horizon, and budget.
4. Inspect snapshots at relevant event times.
5. Run Constraints against the same resolved execution.
6. Render selected states when spatial or visual meaning matters.

> **Warning:** Do not execute generated JavaScript until you review and trust it.

The [security contract](/docs/workspec/sources/security/) explains in-process execution and isolation requirements.

## Require evidence

Ask for results, not confidence statements. Useful evidence includes:

- zero error Problems from the intended validation mode;
- the seed, requested horizon, and resolved-through time;
- snapshot values that answer the modeling question;
- Constraint results with observed and expected evidence;
- tests that damage one domain rule and show the matching Constraint fail.

Validation proves only the layer that ran. A valid document can still resolve to an invalid world.

## Review for common mistakes

Reject a draft that:

- omits the language version;
- uses compatibility-only syntax for new work;
- embeds executable effects in Starting State;
- treats Generator as a direct task-instantiation API;
- uses Constraints to mirror handler literals;
- treats the requested horizon as proof of resolved time;
- claims validity without command output or inspected evidence.
