---
title: "Runtime usage accounting"
description: "Reference the bounded used-through-time diagnostic in WorkSpec 2.2."
section: "workspec"
type: "reference"
level: "advanced"
workspec_version: "2.2"
status: "canonical"
order: 70
---

# Runtime usage accounting

Runtime usage is a bounded diagnostic over one resolved execution. A snapshot exposes sorted used entity IDs in `usage`.

## Meaning of used through T

An entity counts as used through time T when resolved execution does at least one of these actions through T:

- reads it through an evaluated expression;
- reads it through Generator `get()`;
- writes it;
- creates or removes it;
- names it in a resolved reservation attempt.

Merely appearing in authored work after T does not count.

## Short-circuit behavior

Boolean `all` and `any` expressions use short-circuit evaluation. An unreachable operand does not cause usage.

Usage therefore records executed reads, not all possible references in source.

## Constraint queries

Constraint reads inspect evidence after execution. They do not change execution usage.

This separation prevents diagnostic checks from changing the fact they measure.

## Required horizon

The built-in unused-resource diagnostic needs an explicit finite horizon. Without one, the phrase “unused during this run” has no bounded meaning.

## Scope limit

Usage does not prove utilization, profitability, lifecycle quality, or resource-flow correctness. Use project-specific Constraints for those domain conclusions.

Usage records IDs, not a detailed read-and-write trace. Do not treat it as an audit log.

