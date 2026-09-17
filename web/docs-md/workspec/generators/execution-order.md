---
title: "Generator execution order"
description: "Reference the position of Generator callbacks within each runtime event."
section: "workspec"
type: "reference"
level: "advanced"
workspec_version: "2.2"
status: "canonical"
order: 40
---

# Generator execution order

The runtime integrates Generator callbacks into the authoritative event loop. Generator state is causal input, not a final overlay.

## Callback schedule

`onStart` runs at the configured simulation start. `onUpdate` runs once at each following whole minute.

Updates continue through the requested horizon. Without a finite horizon, they continue through the latest resolved task completion.

The start callback receives `delta: 0`. Each update receives `delta: 1`.

## Same-time event order

At each logical time, the runtime follows this order:

1. Finish active tasks and apply completion Changes.
2. Run the applicable Generator callbacks and apply their writes.
3. Evaluate active-task invariants.
4. Create task instances from declared work definitions.
5. Evaluate scheduled dependencies and guards.
6. Select performers and check reservations.
7. Apply accepted start Changes and activate tasks.
8. Record one post-event history point.

The runtime can repeat same-time task-start work when new actual-end anchors or task instances make more work resolvable.

## Observable consequences

Generator logic observes completion effects at the same time. Task-start decisions observe Generator state at that time.

Generator writes win same-target conflicts with both completion and start Changes. The runtime reports each conflict as `generator.changes.conflict`.

## Authoritative history

The runtime stores one history point after it finishes all work at a logical time. Snapshots and Constraints consume that history. They do not replay Generator callbacks.

