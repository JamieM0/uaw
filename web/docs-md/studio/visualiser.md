---
title: "World visualiser"
description: "Use Studio Model views to author environments and inspect resolved physical state without redefining renderer behavior."
section: "studio"
type: "how-to"
level: "intermediate"
workspec_version: "2.2"
status: "canonical"
order: 60
---

# World visualiser

Studio's **Model** workspace provides visual views for process structure and world environments.

## Model views

| View | Purpose | Main creation action |
|---|---|---|
| **Process** | Review authored tasks, assignments, dependencies, and linked Changes handlers. | **New task** |
| **Objects** | Review and edit authored objects. | **Add object** |
| **Physical** | Draw and edit physical locations. | **New location** |
| **Digital** | Edit digital locations, objects, and connections. | **New location**, **New object** |
| **Displays** | Edit displays and interface elements. | **New display**, **New element** |

These views update Starting State. Use [Starting State reference pages](/docs/workspec/starting-state/overview/) for the canonical field meanings.

## Edit the physical layout

1. Open **Model**.
2. Select **Physical**.
3. Select **New location**.
4. Draw the location on the canvas.
5. Edit it in **Physical properties**.

Use the canvas controls **Zoom In**, **Zoom Out**, and **Zoom to Fit**. The **Options** section controls snapping, tolerance, scrolling, and object visibility.

Studio writes the physical layout to `simulation.world.layout`. The [layout rendering reference](/docs/workspec/rendering/layout/) owns coordinate and shape behavior.

## Inspect resolved physical state

1. Open **Physical**.
2. Use **Play** or the **Time scrubber**.
3. Watch authored object artwork move between authored locations.
4. Inspect object state through its image, emoji fallback, and current clock state.

For WorkSpec 2.2, the Physical view prefers the player's runtime snapshot. Authored `move()` and `set()` effects therefore update visible authored objects.

> **Note:** Objects created at runtime can appear in timeline live-state panels. They do not automatically gain artwork in **Physical**.

Studio does not provide a separate physical simulation engine. It projects resolved runtime state into the existing physical editor.

## Use object artwork

An authored object can resolve artwork from its State Library, appearance, and current semantic state. Studio uses an emoji when no asset resolves.

Configure mappings in **Assets**. See [Assets and State Libraries](/docs/studio/assets/) for the UI workflow.

The [state visuals reference](/docs/workspec/rendering/state-visuals/) owns lookup behavior. The [SVG renderer reference](/docs/workspec/rendering/svg/) owns standalone renderer output.

## Inspect other environments

Use **Digital** for digital locations and objects. Use **Displays** for authored interface layouts.

Each environment keeps its own canvas selection and property panel. The application clock still marks visible entities by temporal state.

