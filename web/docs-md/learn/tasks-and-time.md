---
title: "2. Tasks and time"
description: "Add planned tasks, durations, start times, and dependencies to a WorkSpec 2.2 project."
section: "learn"
type: "tutorial"
level: "beginner"
workspec_version: "2.2"
status: "canonical"
order: 20
---

# 2. Tasks and time

You will add inspection and repair tasks to the repair-depot Starting State.

## Add planned tasks

Replace the empty `simulation.process.tasks` array in `start.workspec.json`:

```json
"tasks": [
  {
    "id": "inspect_pump",
    "actor_id": "technician",
    "start": "08:00",
    "duration": "10m",
    "location": "workshop",
    "reservations": [
      { "resource": "test_bench", "mode": "exclusive" }
    ]
  },
  {
    "id": "repair_pump",
    "actor_id": "technician",
    "duration": "20m",
    "location": "workshop",
    "depends_on": ["inspect_pump"]
  }
]
```

The `inspect_pump` task starts at `08:00`. The `repair_pump` task derives its start from the completed predecessor.

## Validate the schedule inputs

Run document validation again:

```console
npx workspec validate start.workspec.json
```

Expected final line:

```text
✓ No problems found
```

## Inspect task status

Run the project through `08:30`:

```console
npx workspec snapshot start.workspec.json --time 08:30 --json
```

The snapshot contains these task statuses:

```json
{
  "inspect_pump": "completed",
  "repair_pump": "completed"
}
```

Find these values under `state.task_statuses` in the output envelope.

> **Checkpoint:** Both tasks can finish without changing the pump. Tasks describe planned work; Changes describe their effects.

## Understand finite time

A snapshot at `08:15` leaves `repair_pump` active. That result is a valid partial run, not a failure.

Read [tasks](/docs/workspec/starting-state/tasks/) and [scheduling and dependencies](/docs/workspec/starting-state/scheduling/) for the complete contracts.

## Next step

[Add Changes](/docs/learn/changes/) so the task timeline changes the pump.
