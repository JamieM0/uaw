# Display Editor Guide

The Display Editor is a powerful tool within the UAW Simulation Playground for creating and managing digital displays and screen elements. This guide covers everything from basic display setup to advanced interactive interface design.

## Overview

Modern processes increasingly involve digital interfaces, control panels, dashboards, and screens. The Display Editor allows you to model these digital components and their interactions within your simulations, providing complete visibility into human-computer interaction workflows.

## Core Concepts

### Displays
Displays represent physical or virtual screens, monitors, dashboards, or any digital interface surface. They act as containers for screen elements and define the coordinate system for positioning interface components.

### Screen Elements
Screen elements are the individual interactive components that live within displays. These can be windows, buttons, textboxes, labels, panels, menus, dialogs, or any custom interface element.

## Display Object Type

A display object defines the properties and capabilities of a screen or digital interface:

```json
{
  "id": "production_control_panel",
  "type": "display",
  "name": "Production Control Panel",
  "emoji": "📺",
  "properties": {
    "display_type": "control_interface",
    "resolution": {
      "width": 1920,
      "height": 1080
    },
    "viewport": {
      "x": 0,
      "y": 0,
      "width": 1920,
      "height": 1080
    },
    "location": "control_room",
    "active": true,
    "refresh_rate": 60,
    "touch_enabled": true
  }
}
```

### Display Properties Reference

| Property | Type | Description |
|----------|------|-------------|
| `display_type` | string | Type of display (e.g., "dashboard", "control_interface", "information_display") |
| `resolution` | object | Physical resolution of the display (`width`, `height`) |
| `viewport` | object | Visible area coordinates (`x`, `y`, `width`, `height`) |
| `location` | string | Physical location where the display is mounted |
| `active` | boolean | Whether the display is currently powered on |
| `refresh_rate` | number | Display refresh rate in Hz (optional) |
| `touch_enabled` | boolean | Whether the display supports touch input (optional) |
| `brightness` | number | Display brightness level 0-100 (optional) |

## Screen Element Object Type

Screen elements are the building blocks of digital interfaces:

```json
{
  "id": "temperature_label",
  "type": "screen_element",
  "name": "Temperature Status Display",
  "emoji": "🌡️",
  "properties": {
    "element_type": "label",
    "display_id": "production_control_panel",
    "position": {
      "x": 100,
      "y": 200
    },
    "dimensions": {
      "width": 200,
      "height": 30
    },
    "text": "Temperature: 325°F",
    "font_size": 16,
    "color": "orange",
    "visible": true,
    "interactive": false
  }
}
```

### Screen Element Properties Reference

| Property | Type | Description |
|----------|------|-------------|
| `element_type` | string | Type of screen element (see types below) |
| `display_id` | string | ID of the display that contains this element |
| `position` | object | X,Y coordinates within the display |
| `dimensions` | object | Width and height of the element |
| `visible` | boolean | Whether the element is currently visible |
| `interactive` | boolean | Whether users can interact with this element |
| `z_index` | number | Layering order (higher numbers appear on top) |

## Screen Element Types

### 1. Window
Container elements that represent application windows or main interface areas.

```json
{
  "id": "main_application_window",
  "type": "screen_element",
  "properties": {
    "element_type": "window",
    "title": "Production Control System",
    "position": { "x": 100, "y": 50 },
    "dimensions": { "width": 800, "height": 600 },
    "resizable": true,
    "minimizable": true,
    "closable": true,
    "modal": false,
    "visible": true
  }
}
```

### 2. Button
Interactive clickable elements for user input and actions.

```json
{
  "id": "start_process_button",
  "type": "screen_element",
  "properties": {
    "element_type": "button",
    "text": "Start Process",
    "position": { "x": 50, "y": 200 },
    "dimensions": { "width": 120, "height": 40 },
    "color": "green",
    "font_size": 14,
    "enabled": true,
    "button_style": "raised"
  }
}
```

### 3. Textbox
Input fields for text entry and editing.

```json
{
  "id": "operator_name_input",
  "type": "screen_element",
  "properties": {
    "element_type": "textbox",
    "placeholder": "Enter operator name",
    "value": "",
    "position": { "x": 200, "y": 150 },
    "dimensions": { "width": 200, "height": 30 },
    "max_length": 50,
    "read_only": false,
    "password": false,
    "border": true
  }
}
```

### 4. Label
Static text elements for displaying information and field labels.

```json
{
  "id": "temperature_label",
  "type": "screen_element",
  "properties": {
    "element_type": "label",
    "text": "Current Temperature: 72°F",
    "position": { "x": 50, "y": 100 },
    "dimensions": { "width": 200, "height": 25 },
    "font_size": 12,
    "font_weight": "normal",
    "color": "black",
    "text_align": "left"
  }
}
```

### 5. Panel
Container elements for grouping related interface components.

```json
{
  "id": "control_panel",
  "type": "screen_element",
  "properties": {
    "element_type": "panel",
    "title": "Process Controls",
    "position": { "x": 20, "y": 80 },
    "dimensions": { "width": 300, "height": 250 },
    "border": true,
    "background_color": "lightgray",
    "collapsible": true,
    "collapsed": false
  }
}
```

### 6. Menu
Navigation elements including menu bars, context menus, and dropdown menus.

```json
{
  "id": "main_menu",
  "type": "screen_element",
  "properties": {
    "element_type": "menu",
    "menu_type": "horizontal",
    "position": { "x": 0, "y": 0 },
    "dimensions": { "width": 800, "height": 30 },
    "items": [
      { "text": "File", "submenu": ["New", "Open", "Save", "Exit"] },
      { "text": "Edit", "submenu": ["Copy", "Paste", "Clear"] },
      { "text": "View", "submenu": ["Refresh", "Full Screen"] }
    ]
  }
}
```

### 7. Dialog
Modal windows for user interactions, confirmations, and data entry.

```json
{
  "id": "confirmation_dialog",
  "type": "screen_element",
  "properties": {
    "element_type": "dialog",
    "title": "Confirm Action",
    "message": "Are you sure you want to stop the production line?",
    "position": { "x": 300, "y": 200 },
    "dimensions": { "width": 400, "height": 150 },
    "modal": true,
    "buttons": ["Yes", "No", "Cancel"],
    "default_button": "No",
    "closable": true
  }
}
```

## Using the Display Editor

### Accessing the Display Editor

1. Open the Simulation Playground
2. Click the **Display Editor** tab in the Simulation Panel
3. Your displays will be listed in the displays panel
4. Select a display to edit its screen elements

### Display Editor Interface

#### Display Management Panel
- **Display List:** Shows all displays in your simulation
- **Add Display:** Button to create new displays
- **Display Properties:** Edit display settings and properties
- **Display Preview:** Real-time preview of the selected display

#### Screen Element Panel
- **Element Palette:** Drag and drop different element types
- **Element List:** Shows all elements in the current display
- **Property Editor:** Modify selected element properties
- **Layer Manager:** Organize element z-index and visibility

#### Visual Editor
- **Canvas:** Visual representation of the display with interactive elements
- **Selection Tools:** Click to select and move elements
- **Alignment Guides:** Snap to grid and alignment helpers
- **Zoom Controls:** Navigate large displays effectively

### Creating Displays and Elements

#### Step 1: Create a Display
```json
{
  "id": "main_hmi",
  "type": "display",
  "name": "Human Machine Interface",
  "properties": {
    "display_type": "hmi",
    "resolution": { "width": 1280, "height": 800 },
    "location": "operator_station",
    "active": true
  }
}
```

#### Step 2: Add Screen Elements
```json
{
  "id": "start_button",
  "type": "screen_element",
  "properties": {
    "element_type": "button",
    "display_id": "main_hmi",
    "position": { "x": 50, "y": 700 },
    "dimensions": { "width": 100, "height": 50 },
    "text": "START",
    "color": "green"
  }
}
```

#### Step 3: Add Interactions
Tasks can interact with screen elements to create dynamic interfaces:

```json
{
  "id": "system_startup",
  "actor_id": "operator",
  "interactions": [
    {
      "object_id": "start_button",
      "property_changes": {
        "color": { "from": "green", "to": "gray" },
        "enabled": { "from": true, "to": false }
      }
    },
    {
      "object_id": "status_label",
      "property_changes": {
        "text": { "from": "Ready", "to": "Starting System..." }
      }
    }
  ]
}
```

## Advanced Display Features

### Multi-Display Systems
Create complex control rooms with multiple coordinated displays:

```json
{
  "simulation": {
    "objects": [
      {
        "id": "overview_display",
        "type": "display",
        "name": "Plant Overview",
        "properties": {
          "display_type": "overview",
          "resolution": { "width": 3840, "height": 2160 },
          "location": "control_room"
        }
      },
      {
        "id": "detail_display",
        "type": "display",
        "name": "Process Details",
        "properties": {
          "display_type": "detail_view",
          "resolution": { "width": 1920, "height": 1080 },
          "location": "control_room"
        }
      }
    ]
  }
}
```

### Dynamic Content Updates
Screen elements can change based on simulation state:

```json
{
  "id": "update_production_metrics",
  "actor_id": "system",
  "interactions": [
    {
      "object_id": "hourly_production",
      "property_changes": {
        "value": { "delta": 25 }
      }
    },
    {
      "object_id": "efficiency_chart",
      "property_changes": {
        "data_series": {
          "add_point": { "time": "11:00", "value": 0.87 }
        }
      }
    }
  ]
}
```

### Alarm and Alert Systems
Create visual and interactive alarm systems:

```json
{
  "id": "temperature_alarm",
  "type": "screen_element",
  "properties": {
    "element_type": "dialog",
    "display_id": "control_panel",
    "title": "Temperature Warning",
    "message": "High Temperature Detected",
    "position": { "x": 400, "y": 300 },
    "dimensions": { "width": 350, "height": 120 },
    "modal": true,
    "buttons": ["Acknowledge", "Dismiss"],
    "closable": true
  }
}
```

## Complete Example: Manufacturing Dashboard

This example demonstrates a comprehensive manufacturing dashboard with multiple screen elements and interactions:

```json
{
  "simulation": {
    "objects": [
      {
        "id": "manufacturing_dashboard",
        "type": "display",
        "name": "Manufacturing Control Dashboard",
        "properties": {
          "display_type": "manufacturing_hmi",
          "resolution": { "width": 1920, "height": 1080 },
          "location": "control_room",
          "active": true,
          "touch_enabled": true
        }
      },
      {
        "id": "production_counter",
        "type": "screen_element",
        "properties": {
          "element_type": "label",
          "display_id": "manufacturing_dashboard",
          "position": { "x": 50, "y": 50 },
          "dimensions": { "width": 300, "height": 80 },
          "text": "Production: 0 units",
          "font_size": 24,
          "color": "blue"
        }
      },
      {
        "id": "operator_input",
        "type": "screen_element",
        "properties": {
          "element_type": "textbox",
          "display_id": "manufacturing_dashboard",
          "position": { "x": 400, "y": 100 },
          "dimensions": { "width": 200, "height": 30 },
          "placeholder": "Enter batch number",
          "value": "",
          "max_length": 10
        }
      },
      {
        "id": "control_panel",
        "type": "screen_element",
        "properties": {
          "element_type": "panel",
          "display_id": "manufacturing_dashboard",
          "position": { "x": 50, "y": 400 },
          "dimensions": { "width": 600, "height": 300 },
          "title": "Process Controls",
          "border": true,
          "background_color": "lightgray"
        }
      },
      {
        "id": "emergency_stop_btn",
        "type": "screen_element",
        "properties": {
          "element_type": "button",
          "display_id": "manufacturing_dashboard",
          "position": { "x": 1650, "y": 50 },
          "dimensions": { "width": 200, "height": 100 },
          "text": "EMERGENCY STOP",
          "color": "red",
          "font_size": 18,
          "font_weight": "bold"
        }
      }
    ],
    "tasks": [
      {
        "id": "update_dashboard_metrics",
        "actor_id": "monitoring_system",
        "start": "08:00",
        "duration": 1,
        "interactions": [
          {
            "object_id": "production_counter",
            "property_changes": {
              "text": { "from": "Production: 0 units", "to": "Production: 45 units" }
            }
          },
          {
            "object_id": "operator_input",
            "property_changes": {
              "value": { "from": "", "to": "BATCH001" }
            }
          },
          {
            "object_id": "control_panel",
            "property_changes": {
              "background_color": { "from": "lightgray", "to": "lightgreen" }
            }
          }
        ]
      }
    ]
  }
}
```

## Best Practices

### Display Design
- **Keep interfaces clean and uncluttered**
- **Use consistent color schemes and fonts**
- **Group related information together**
- **Provide clear visual hierarchy with size and positioning**

### Screen Element Organization
- **Use meaningful IDs and names**
- **Organize elements with appropriate z-index values**
- **Consider different screen resolutions and sizes**
- **Plan for responsive behavior**

### Interaction Design
- **Make interactive elements obviously clickable**
- **Provide visual feedback for user actions**
- **Use appropriate colors for different states (normal, warning, error)**
- **Consider accessibility and usability principles**

### Performance Considerations
- **Limit the number of real-time updating elements**
- **Use efficient data structures for chart data**
- **Consider display refresh rates for smooth animations**
- **Optimize image and video assets**

## Integration with Tasks

Screen elements can be modified by tasks to create dynamic, responsive interfaces that reflect the actual state of your process. This allows you to model complete human-machine interaction workflows and understand how digital interfaces support operational processes.

Use the Display Editor to create realistic digital interfaces that enhance your simulation's accuracy and provide insights into the role of technology in modern automation processes.