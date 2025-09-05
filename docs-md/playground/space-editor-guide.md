# The Space Editor Guide

The Space Editor is a powerful visual tool within the Simulation Playground that allows you to define and manipulate the physical layout of your simulation environment. It provides a 2D canvas where you can draw, name, and arrange the different locations where tasks and objects reside.

## Purpose and Functionality

The main purpose of the Space Editor is to create a spatial context for your simulation. While a simulation can run without a defined layout, adding one provides several key benefits:

*   **Realism:** It makes the simulation more realistic by representing the physical constraints of a workspace.
*   **Visualization:** It helps you and others visualize the flow of work and movement of objects between different areas.
*   **Validation:** It enables a class of location-based validation metrics, such as checking if an actor is in the correct location to perform a task, or if a location has exceeded its capacity.

## The `layout` Object in `simulation.json`

The Space Editor directly interacts with the `layout` object in your `simulation.json` file. Any changes you make in the editor (like drawing or resizing a location) will be reflected in this JSON object in real-time, and vice-versa.

A typical `layout` object looks like this:

```json
"layout": {
  "meta": {
    "units": "meters",
    "pixels_per_unit": 20
  },
  "locations": [
    {
      "id": "prep_area",
      "name": "Prep Area",
      "shape": {
        "type": "rect",
        "x": 50,
        "y": 50,
        "width": 300,
        "height": 150
      }
    },
    {
      "id": "oven_area",
      "name": "Oven Area",
      "shape": {
        "type": "rect",
        "x": 400,
        "y": 50,
        "width": 150,
        "height": 150
      }
    }
  ]
}
```

*   **`meta`**: Contains metadata about the layout, such as the `units` of measurement and the `pixels_per_unit` scale for rendering on the canvas.
*   **`locations`**: An array of location objects. Each location has:
    *   `id`: A unique identifier used to reference the location from tasks and objects.
    *   `name`: A human-readable display name.
    *   `shape`: An object defining the location's geometry. Currently, only `rect` (rectangle) is supported, with `x`, `y`, `width`, and `height` properties in pixels.

## Using the Space Editor

You can access the Space Editor by clicking on its tab in the Simulation Panel.

### Creating a New Location

1.  Click the `+ Add` button in the Properties panel on the right.
2.  Your cursor will change to a crosshair.
3.  Click and drag on the canvas to draw a new rectangular location.

Once you release the mouse, the new location will be created, and a corresponding object will be added to the `locations` array in your `simulation.json`.

### Selecting and Editing a Location

*   **Select:** Simply click on any location on the canvas to select it. The selected location will be highlighted, and its properties will appear in the Properties panel.
*   **Move:** Click and drag a selected location to move it around the canvas.
*   **Resize:** Click and drag the handles on the corners and edges of a selected location to resize it.
*   **Edit Properties:** When a location is selected, you can edit its `id` and `name` in the Properties panel. These changes will be immediately reflected in the JSON.

### Snapping and Options

The Options panel provides settings to make it easier to align your locations:

*   **Enable Vertical/Horizontal Snapping:** When enabled, the edges of the location you are dragging or resizing will "snap" to the edges of other locations on the canvas, helping you create clean, aligned layouts.
*   **Snap Tolerance:** This value (in pixels) controls how close an edge needs to be to another edge before it snaps.

By using the Space Editor, you can quickly build a visual representation of your process environment, adding another layer of realism and detail to your simulations.
