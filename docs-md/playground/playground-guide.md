# WorkSpec Studio Guide

WorkSpec Studio is the visual editor and runner for WorkSpec 2 projects. Start
with the [guided tutorial](/playground), then use the
[WorkSpec 2 Authoring Guide](/docs/workspec/guides/authoring) as the canonical
conceptual reference.

## What each workspace answers

| Workspace | Question it answers |
| --- | --- |
| Projects | Which folder-backed project should I create, open, or import? |
| Model | What objects and scheduled tasks exist in the Starting State? |
| Editor | What is authored in Starting State, Changes, Constraints, and the optional Generator? |
| Simulate | What is true at each point in the resolved history? |
| Validate / Problems | What source or runtime rule needs attention? |
| Assets | Which project media files sit outside Starting State? |

## The four authoring tabs

- **Starting State** edits `start.workspec.json`: what exists initially,
  including locations, objects, task timing, and dependencies.
- **Changes** edits `changes.workspec.js`: explicit effects attached to a task's
  start or completion.
- **Constraints** edits `constraints.workspec.js`: rules over the resolved
  simulation and structured evidence when a rule is violated.
- **Generator** edits `generator.workspec.js`: optional computed or simulated
  behaviour. Most beginner projects do not need it.

**Constraint Library** is a separate project reference/catalog. It is not a
fifth WorkSpec language concept.

## Create or open a project

Choose **New project from template** for a working example, **New blank project**
for empty WorkSpec 2 sources, or **Open project folder** to reconnect an existing
folder. Studio writes each source as a visible file in that folder.

The guided packing tutorial is the beginner example. Simulation Library
templates are larger reference projects—even those labelled **Basic**—and are
best explored after the tutorial. The steam-sterilisation model is a domain
example, not an introduction.

## Validate and understand errors

Choose **Validate WorkSpec** or press `⌘ Enter`. Problems are grouped as errors,
warnings, suggestions/information, and passed checks.

- Invalid JSON is shown in the Starting State editor.
- Starting State semantic errors name the affected path or task. Errors block
  playback instead of leaving the run looking successful.
- Changes, Generator, and Constraint execution errors appear in Problems with
  their owning source indicated by the message and diagnostic ID.
- Runtime Constraint violations include evidence such as time, observed value,
  expected value, and affected objects. Select one to move to that time and
  highlight an affected object where possible.

Constraints report; they do not automatically repair the model.

## Run and move through time

Open **Simulate**. Use Play/Pause for continuous playback or drag the red
playhead to inspect a precise moment. Timeline and Physical views use the same
resolved history. A later state comes from Starting State plus explicit Changes
and, only when present, Generator output.

## Save, reopen, and export

Folder-backed projects autosave their four source files. Studio remembers the
folder handle when the browser permits it; if permission expires, reconnect the
folder from Projects. Checkpoints capture all four sources.

Export produces a `.workspec.zip` containing Starting State, Changes,
Constraints, Generator, and project metadata. Opening that archive restores the
same sources and Generator seed.

## Historical material

Versioned WorkSpec 2.0/2.1 pages document the older task `interactions` model.
They remain available under **Historical specifications** but should not be used
to author a WorkSpec 2 project.
