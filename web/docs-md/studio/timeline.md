---
title: "Timeline and playback"
description: "Inspect resolved WorkSpec execution with the Studio timeline, clock, scrubber, and live object state."
section: "studio"
type: "how-to"
level: "beginner"
workspec_version: "2.2"
status: "canonical"
order: 50
---

# Timeline and playback

Studio's **Timeline** displays the resolved project execution and updates visible state through one application clock.

## Open the timeline

1. Open **Simulate**.
2. Select **Timeline**.
3. Review the task lanes and live object panels.

Studio resolves WorkSpec 2.2 dependency schedules with the shared runtime. The clock range includes the configured end time and resolved task end times.

The timeline is an inspection view. The [runtime execution model](/docs/workspec/runtime/execution-model/) owns the normative execution contract.

## Play the run

Select **Play** to advance the application clock. Select **Pause** to stop it.

Use the playback speed menu to choose `0.5x`, `1x`, `2x`, `5x`, or `10x`. Playback restarts at the run start after it reaches the end.

Studio marks tasks as upcoming, active, or completed. It applies the same clock to Model rows, live objects, locations, and other visible entities.

## Scrub to a time

1. Select the date and time in the title bar.
2. Drag **Current WorkSpec time** in the **Time scrubber**.
3. Close the scrubber when you finish.

The scrubber shows the resolved start and end. Its scale buttons are **Day**, **Week**, and **Month**.

The scale changes the scrubber step size. It does not change WorkSpec time semantics.

## Inspect resolved object state

Live object panels show each object's resolved state and quantity when available. An object's tooltip lists its current location and scalar resolved properties.

Studio obtains WorkSpec 2.2 object state from runtime snapshots. This includes authored Changes and Generator effects at the selected time.

Runtime-created objects can appear in live object panels. Deleted objects leave the resolved live collection after their removal time.

The [snapshot reference](/docs/workspec/runtime/snapshots/) defines resolved-state behavior. Studio only documents how to inspect that state.

## Use multi-period views

For a multi-period project, **Timeline** adds **Day**, **Week**, and **Month** view buttons.

These buttons change the timeline presentation. They are separate from the time scrubber's scale buttons.

## Follow a Problem to the timeline

Select a runtime Constraint Problem that contains a time. Studio moves the clock to that time.

If the affected object is hidden, Studio opens **Timeline** and highlights it. See [Validation and Problems](/docs/studio/problems/) for the diagnostic workflow.

## Playback limits

Studio disables playback for an unresolved dependency-scheduling error. Review **Problems** and fix the reported task schedule.

The Gantt header can include presentation padding outside the canonical scrubber range. Use the title-bar clock and scrubber for the selected runtime time.

