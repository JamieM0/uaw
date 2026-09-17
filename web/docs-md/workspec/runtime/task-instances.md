---
title: "Runtime task instances"
description: "Reference task instances created from Starting State work definitions."
section: "workspec"
type: "reference"
level: "advanced"
workspec_version: "2.2"
status: "canonical"
order: 40
---

# Runtime task instances

The runtime creates task instances from authored work definitions and current collection membership. Authors do not declare these instance records directly.

## Creation rule

At a synchronization point, the runtime evaluates each work definition's `for_each` collection. It creates one instance for each new definition-member pair.

The runtime applies the definition's offset to the instantiation time. It copies the task template and binds the declared alias to the member.

The [work definitions reference](../starting-state/work-definitions.md) owns template syntax. This page documents only resolved instances.

## Instance identity

An instance ID uses the definition ID and a stable token derived from the member ID. The form is:

```text
DEFINITION_ID:STABLE_MEMBER_TOKEN
```

The runtime reports `instance.identity.collision` if the generated ID collides with another task.

One run creates at most one instance for each definition-member pair. Leaving and re-entering a collection does not create a second instance.

## Snapshot record

Each `task_instances` entry contains:

| Field | Meaning |
|---|---|
| `id` | Generated instance ID |
| `definition_id` | Source work-definition ID |
| `correlation_id` | Collection member ID |
| `correlation_collection` | Source collection ID |
| `instantiated_at` | Creation time in elapsed minutes |
| `selected_actor_id` | Resolved performer, when selected |
| `status` | Current task status |
| `timing` | Resolved timing record |
| `assignment_history` | Performer selections with time and policy |

Historical snapshots contain only instances created by the requested time.

## Cancellation on collection exit

When `cancel_pending_on_exit` is `true`, the runtime cancels a pending instance after its member leaves the collection. It records `actual_end` and `cancelled_reason: "collection_exit"` in `task_runtime`.

Active or terminal instances are not cancelled by this rule.

