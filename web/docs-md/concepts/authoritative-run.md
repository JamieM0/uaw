---
title: "Why one authoritative run matters"
description: "Understand why snapshots, Constraints, playback, and rendering must share one resolved history."
section: "concepts"
type: "explanation"
level: "intermediate"
workspec_version: "2.2"
status: "canonical"
order: 30
related:
  - /docs/workspec/runtime/execution-model/
---

# Why one authoritative run matters

One authoritative run gives every inspection surface the same evidence.

## Identity before agreement

Two executions can use the same project, seed, and horizon. They are still two executions.

If a snapshot, Constraint check, and renderer each run the project independently, agreement becomes an assumption. Source changes, control changes, defects, or nondeterministic host behavior can break that assumption.

When all consumers use one run, their results have a stronger relationship: they are different views of one history.

## Stable evidence

An authoritative run contains the resolved history, task state, assignments, reservations, runtime instances, Problems, seed, and inspection boundary.

That shared identity supports clear questions:

- Does the rendered object match the inspected snapshot?
- Did the Constraint evaluate the same task assignment shown in playback?
- Is the unresolved-time message based on the same work-budget stop?

Without a shared run, a tool can answer each question from separate evidence.

## Better product boundaries

One run also clarifies ownership. Execution produces history once. Snapshots select from it. Constraints query it. Rendering presents it.

Consumers do not become alternative simulation paths. They cannot silently change the world that another consumer inspected.

## Scope of this concept

This page explains the rationale. It does not define event order, result fields, or API calls.

Use the [execution model and authoritative run reference](/docs/workspec/runtime/execution-model/) for normative runtime behavior. Use [snapshot APIs](/docs/api/snapshots/) and [Constraint execution APIs](/docs/api/constraints/) for supported embedding mechanics.
