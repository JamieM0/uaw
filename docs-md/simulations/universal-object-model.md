# Universal Object Model (UOM)

The Universal Object Model is the standardized schema that defines how simulations are structured in the UAW system. This document describes the current implementation, including both legacy compatibility features and modern extensible patterns.

## Overview

The UOM provides a flexible foundation for modeling any real-world process by defining objects, their properties, and how tasks interact with those objects. The model supports both traditional manufacturing processes and modern digital-physical hybrid workflows.

## Core Principles

### 1. Flexible Object Typing
The system supports standard object types (`actor`, `equipment`, `resource`, `product`) as well as custom types for specialized domains (`digital_object`, `display`, `screen_element`, `vehicle`, etc.).

### 2. Property-Based Configuration
All object behavior is defined through properties, allowing for unlimited customization without changing the core schema.

### 3. Interaction-Driven Dynamics
Tasks modify object properties through a rich interaction system, enabling complex state changes and realistic process modeling.

## Schema Structure

```json
{
  "simulation": {
    "meta": { ... },
    "config": { ... },
    "layout": { ... },
    "objects": [ ... ],
    "tasks": [ ... ],
    "production_recipes": { ... }
  }
}
```

### Meta Section
Contains descriptive information about the simulation:

```json
{
  "meta": {
    "title": "Bread Production Process",
    "description": "Complete bakery production workflow",
    "version": "2.1",
    "created_date": "2024-09-13",
    "author": "Process Engineer",
    "industry": "Food Manufacturing",
    "complexity_level": "intermediate"
  }
}
```

### Config Section
Defines timing and simulation parameters:

```json
{
  "config": {
    "time_unit": "minutes",
    "start_time": "06:00",
    "end_time": "18:00",
    "time_step": 1,
    "currency": "USD",
    "locale": "en-US"
  }
}
```

### Layout Section
Defines physical and digital spaces:

```json
{
  "layout": {
    "areas": {
      "prep_area": {
        "name": "Preparation Area",
        "type": "physical",
        "coordinates": { "x": 0, "y": 0, "width": 10, "height": 5 }
      },
      "virtual_control_room": {
        "name": "Digital Control Center",
        "type": "digital",
        "coordinates": { "x": 0, "y": 0, "z": 0 },
        "bounds": { "width": 20, "height": 10, "depth": 15 }
      }
    }
  }
}
```

## Object Types

### Standard Object Types

#### Actor
Represents people or autonomous agents that perform tasks:

```json
{
  "id": "head_baker",
  "type": "actor",
  "name": "Head Baker",
  "emoji": "👨‍🍳",
  "properties": {
    "role": "Senior Baker",
    "skill_level": "expert",
    "cost_per_hour": 28.50,
    "location": "prep_area",
    "certifications": ["food_safety", "artisan_bread"],
    "shift_start": "06:00",
    "shift_end": "14:00"
  }
}
```

**Standard Properties:**
- `role`: Job title or function
- `skill_level`: Proficiency level (beginner, intermediate, advanced, expert)
- `cost_per_hour`: Labor cost for economic analysis
- `location`: Current physical location
- `shift_start`/`shift_end`: Working hours

#### Equipment
Physical tools, machinery, and apparatus:

```json
{
  "id": "industrial_mixer",
  "type": "equipment",
  "name": "Industrial Dough Mixer",
  "emoji": "⚙️",
  "properties": {
    "state": "clean",
    "capacity": 50,
    "capacity_unit": "kg",
    "power_rating": 5.5,
    "power_unit": "kW",
    "location": "prep_area",
    "maintenance_hours": 2000,
    "last_maintenance": "2024-09-01"
  }
}
```

**Standard Properties:**
- `state`: Current operational state (clean, dirty, in_use, maintenance, broken)
- `capacity`: Maximum throughput or volume
- `power_rating`: Energy consumption
- `location`: Physical position
- `maintenance_hours`: Hours until next maintenance

#### Resource
Consumable materials and supplies:

```json
{
  "id": "organic_flour",
  "type": "resource",
  "name": "Organic Bread Flour",
  "emoji": "🌾",
  "properties": {
    "quantity": 500,
    "unit": "kg",
    "cost_per_unit": 0.85,
    "supplier": "Local Grain Mill",
    "expiration_date": "2024-12-15",
    "location": "dry_storage",
    "batch_number": "FL-2024-089",
    "quality_grade": "premium"
  }
}
```

**Standard Properties:**
- `quantity`: Current amount available
- `unit`: Measurement unit (kg, L, pieces, etc.)
- `cost_per_unit`: Material cost for economic analysis
- `expiration_date`: Shelf life tracking
- `location`: Storage location

#### Product
Items created during the process:

```json
{
  "id": "artisan_sourdough",
  "type": "product",
  "name": "Artisan Sourdough Loaf",
  "emoji": "🍞",
  "properties": {
    "quantity": 0,
    "unit": "loaves",
    "revenue_per_unit": 8.50,
    "production_time": 240,
    "shelf_life_days": 3,
    "location": "cooling_area",
    "weight_per_unit": 0.8,
    "quality_standards": "artisan_grade"
  }
}
```

**Standard Properties:**
- `quantity`: Current inventory level
- `revenue_per_unit`: Selling price for economic analysis
- `production_time`: Time required to produce one unit
- `shelf_life_days`: Product freshness period

### Digital Object Types

#### Digital Location
Virtual spaces within digital systems:

```json
{
  "id": "warehouse_sim",
  "type": "digital_location",
  "name": "Virtual Warehouse Environment",
  "properties": {
    "environment_type": "logistics_simulation",
    "coordinate_system": "cartesian_3d",
    "bounds": {
      "x": { "min": -100, "max": 100 },
      "y": { "min": 0, "max": 30 },
      "z": { "min": -100, "max": 100 }
    },
    "physics_enabled": true,
    "lighting_model": "realistic",
    "collision_detection": true,
    "gravity": 9.81
  }
}
```

#### Digital Object
Virtual items within digital spaces:

```json
{
  "id": "autonomous_forklift",
  "type": "digital_object",
  "name": "AI-Powered Forklift",
  "properties": {
    "digital_type": "autonomous_vehicle",
    "position": { "x": 0, "y": 0, "z": 0 },
    "rotation": { "x": 0, "y": 0, "z": 0 },
    "scale": { "x": 1, "y": 1, "z": 1 },
    "movement_speed": 3.5,
    "load_capacity": 2000,
    "battery_level": 85,
    "digital_location": "warehouse_sim"
  }
}
```

#### Display
Screens and digital interfaces:

```json
{
  "id": "production_dashboard",
  "type": "display",
  "name": "Production Control Dashboard",
  "emoji": "📊",
  "properties": {
    "display_type": "control_interface",
    "resolution": { "width": 2560, "height": 1440 },
    "viewport": { "x": 0, "y": 0, "width": 2560, "height": 1440 },
    "location": "control_room",
    "active": true,
    "brightness": 75,
    "refresh_rate": 120,
    "touch_enabled": true
  }
}
```

#### Screen Element
Interactive components within displays:

```json
{
  "id": "efficiency_display",
  "type": "screen_element",
  "name": "Production Efficiency Display",
  "properties": {
    "element_type": "label",
    "display_id": "production_dashboard",
    "position": { "x": 200, "y": 300 },
    "dimensions": { "width": 250, "height": 30 },
    "text": "Efficiency: 87.5%",
    "font_size": 16,
    "color": "green",
    "visible": true,
    "interactive": false
  }
}
```

### Custom Object Types

The system supports unlimited custom object types for specialized domains:

#### Vehicle Example
```json
{
  "id": "delivery_truck_01",
  "type": "vehicle",
  "name": "Delivery Truck #1",
  "emoji": "🚛",
  "properties": {
    "vehicle_type": "box_truck",
    "fuel_level": 0.75,
    "fuel_capacity": 120,
    "fuel_unit": "liters",
    "max_payload": 3500,
    "current_load": 0,
    "location": "loading_dock",
    "license_plate": "DT-001",
    "mileage": 45280,
    "next_maintenance": "2024-10-15"
  }
}
```

#### Sensor Example
```json
{
  "id": "temp_sensor_01",
  "type": "sensor",
  "name": "Oven Temperature Sensor",
  "emoji": "🌡️",
  "properties": {
    "sensor_type": "temperature",
    "current_reading": 180,
    "min_range": -20,
    "max_range": 300,
    "unit": "celsius",
    "accuracy": 0.5,
    "location": "oven_chamber",
    "calibration_date": "2024-08-15",
    "digital_output": true
  }
}
```

## Task Interactions

### Modern Interaction System

The interaction system provides powerful ways to modify object properties:

#### Property Changes
```json
{
  "interactions": [
    {
      "object_id": "mixing_bowl",
      "property_changes": {
        "state": { "from": "empty", "to": "filled" },
        "contents": { "from": "", "to": "flour_water_mixture" },
        "weight": { "delta": 2.5 }
      }
    }
  ]
}
```

**Change Types:**
- `from`/`to`: Explicit state transitions
- `delta`: Numerical increments/decrements
- `set`: Direct value assignment
- `multiply`: Proportional changes

#### Object Creation
```json
{
  "interactions": [
    {
      "add_objects": [
        {
          "id": "batch_001",
          "type": "product",
          "name": "Bread Batch #001",
          "properties": {
            "quantity": 12,
            "unit": "loaves",
            "batch_time": "09:30"
          }
        }
      ]
    }
  ]
}
```

#### Object Removal
```json
{
  "interactions": [
    {
      "remove_objects": ["expired_batch_001", "damaged_equipment"]
    }
  ]
}
```

### Complex Interaction Examples

#### Multi-Object State Changes
```json
{
  "id": "production_line_startup",
  "interactions": [
    {
      "object_id": "conveyor_belt",
      "property_changes": {
        "state": { "from": "stopped", "to": "running" },
        "speed": { "set": 1.5 }
      }
    },
    {
      "object_id": "quality_scanner",
      "property_changes": {
        "state": { "from": "standby", "to": "active" },
        "scan_rate": { "set": 60 }
      }
    },
    {
      "object_id": "production_display",
      "property_changes": {
        "active": { "set": true }
      }
    }
  ]
}
```

#### Economic Transactions
```json
{
  "id": "purchase_materials",
  "interactions": [
    {
      "object_id": "flour",
      "property_changes": {
        "quantity": { "delta": 100 },
        "cost_total": { "delta": 85.00 }
      }
    },
    {
      "object_id": "company_cash",
      "property_changes": {
        "balance": { "delta": -85.00 }
      }
    }
  ]
}
```

#### Digital Object Movement
```json
{
  "id": "move_digital_asset",
  "interactions": [
    {
      "object_id": "inventory_bot",
      "property_changes": {
        "position": {
          "from": { "x": 10, "y": 0, "z": 5 },
          "to": { "x": 25, "y": 0, "z": 12 }
        },
        "battery_level": { "delta": -2.5 }
      }
    }
  ]
}
```

## Production Recipes

Define complex production requirements:

```json
{
  "production_recipes": {
    "artisan_bread": {
      "ingredients": {
        "flour": 2.5,
        "water": 1.8,
        "yeast": 0.2,
        "salt": 0.05
      },
      "equipment_required": ["mixer", "oven"],
      "production_time": 180,
      "skill_level": "intermediate",
      "yield": 1
    }
  }
}
```

## Validation Integration

The UOM works closely with the validation system to ensure:

### Schema Compliance
- All required fields are present
- Data types match specifications
- Object references are valid

### Logical Consistency
- State transitions are realistic
- Resource flows balance properly
- Timing constraints are respected

### Economic Viability
- Cost and revenue properties enable profitability analysis
- Resource consumption aligns with production output
- Labor costs reflect realistic market rates

## Best Practices

### Object Design
1. **Use descriptive IDs**: `industrial_mixer_01` vs `mixer1`
2. **Include relevant properties**: Don't over-engineer, but include what matters
3. **Set realistic initial values**: Base quantities and costs on real-world data
4. **Plan for scalability**: Design objects that can handle process variations

### Task Interactions
1. **Prefer modern interaction format**: More explicit and flexible
2. **Group related changes**: Combine multiple property changes in one interaction
3. **Include validation properties**: Use `from` values to enable state validation
4. **Document complex interactions**: Use clear task names and descriptions

### Custom Types
1. **Follow naming conventions**: Use clear, descriptive type names
2. **Define standard properties**: Establish patterns for similar objects
3. **Avoid reserved types**: Don't conflict with system-internal types
4. **Document custom schemas**: Explain your custom types for other users

### Economic Modeling
1. **Include all costs**: Labor, materials, overhead, equipment depreciation
2. **Use realistic prices**: Base on market research or industry standards
3. **Account for waste**: Include scrap rates and efficiency factors
4. **Plan for scenarios**: Model different price points and volumes

The Universal Object Model provides the foundation for creating accurate, realistic, and business-ready process simulations that can guide real-world automation decisions.