---
title: "Generator and dynamic work"
description: "Understand how Generator state can indirectly trigger declared work definitions."
section: "workspec"
type: "explanation"
level: "advanced"
workspec_version: "2.2"
status: "canonical"
order: 60
---

# Generator and dynamic work

Generator logic can indirectly cause dynamic work. It does not instantiate tasks through a Generator API.

## Indirect flow

The relationship follows this sequence:

1. Starting State declares a collection and a work definition.
2. Generator logic creates or changes a world object.
3. The object's state changes collection membership or appearance.
4. The runtime evaluates the declared work definition.
5. The runtime creates a task instance for a new matching member.

This separation keeps task templates declarative and Generator operations focused on world state.

## Identity and correlation

The runtime correlates each instance with its work definition and collection member. The snapshot records the definition ID, correlation ID, collection ID, and instantiation time.

The runtime creates an instance pair once for each definition and member. A member that re-enters does not create a second instance in the run.

## Collection boundaries

An open collection can accept new instances until its declared close time. After that cutoff, new matching members do not create instances.

A work definition can cancel pending instances when their members leave the collection. This behavior comes from the authored definition, not Generator source.

## Ownership boundaries

- [Work definitions](../starting-state/work-definitions.md) own authored templates and triggers.
- [Runtime task instances](../runtime/task-instances.md) own execution-created instance records.
- This page owns only the causal relationship with Generator state.
