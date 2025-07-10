# Enhanced Simulation System

The enhanced simulation system provides realistic constraints and automatic post-processing to make simulations business-ready and trustworthy for real-world planning. This system builds upon the existing simulation generation with advanced validation, constraint resolution, and transparency features.

## Key Features

1. **Enhanced Resource Flow Validation**
   - Minute-by-minute resource tracking throughout simulation
   - Detection of negative stock levels and resource shortages
   - Resource dependency validation (e.g., activated_yeast depends on yeast, water, sugar)
   - Configurable minimum stock thresholds and validation rules

2. **Equipment Maintenance Auto-Insertion**
   - Automatic detection of equipment usage and "dirty" state creation
   - Insertion of cleaning tasks with appropriate duration, resources, and actor assignments
   - Equipment cool-down period management (ovens can't be used immediately after baking)
   - Cleaning supply consumption tracking and automatic resource addition

3. **Advanced Scheduling Conflict Resolution**
   - Automatic detection of actor double-booking conflicts
   - Task shifting strategies to resolve scheduling overlaps
   - Buffer time insertion between tasks for realistic workflow
   - Equipment availability conflict detection and resolution

4. **Validation Transparency**
   - Detailed validation results with categorized feedback
   - Business readiness assessment
   - Validation transparency data for user interface
   - Integration with existing transparency modal system

5. **External Configuration Management**
   - JSON-based configuration files for easy modification
   - Separation of validation logic from Python code
   - Extensible rule system for different industries and processes

## File Structure

```
simulation/
├── simulation_schema.json      # Schema definition for simulation structure
├── defaults.json              # Default simulation template values
├── constraint_config.json     # NEW: Validation rules and constraint settings
├── maintenance_rules.json     # NEW: Equipment maintenance automation rules
└── README.md                  # This documentation file

routines/
├── simulation.py              # Enhanced simulation generation with constraint processing
├── constraint_processor.py    # NEW: Constraint processing and validation engine
└── assemble.py               # Enhanced with validation transparency support
```

## Configuration Files

### constraint_config.json

Defines validation rules, constraint resolution strategies, and business readiness criteria:

- **stock_validation**: Resource flow tracking and validation rules
- **equipment_maintenance**: Maintenance task insertion settings
- **multi_batch_optimization**: Multi-batch processing configuration (future)
- **constraint_resolution**: Conflict detection and resolution strategies
- **validation_transparency**: Transparency data generation settings
- **business_readiness**: Readiness assessment thresholds and criteria
- **post_processing**: Processing pipeline configuration

### maintenance_rules.json

Defines equipment-specific maintenance requirements:

- **equipment_types**: Maintenance rules for mixers, ovens, surfaces, etc.
- **cleaning_supplies**: Available cleaning resources and costs
- **maintenance_scheduling**: Scheduling preferences and constraints
- **actor_assignments**: Preferred actor roles for maintenance tasks
- **validation_rules**: Maintenance-specific validation requirements

## Usage

### Basic Usage

```python
from simulation import generate_simulation

# Generate enhanced simulation with validation
result = generate_simulation(tree_json, article_metadata, output_dir)

# Access processed simulation
simulation = result['simulation']
validation_summary = result['validation_summary']
transparency_data = result['validation_transparency']
```

### Constraint Processing Only

```python
from constraint_processor import ConstraintProcessor

# Apply constraint processing to existing simulation
processor = ConstraintProcessor()
enhanced_simulation = processor.apply_comprehensive_constraints(simulation_dict)

# Get validation results
validation_summary = processor.get_validation_summary()
transparency_data = processor.get_transparency_data()
```

### Configuration Customization

Edit `constraint_config.json` to customize validation rules:

```json
{
  "stock_validation": {
    "enabled": true,
    "allow_negative_stock": false,
    "minimum_stock_threshold": 0.1
  },
  "equipment_maintenance": {
    "enabled": true,
    "auto_insert_cleaning": true,
    "auto_insert_cooldown": true
  }
}
```

## Validation Categories

The system categorizes validation results into four main categories:

1. **Critical Errors** (Red): Issues that make the simulation unusable
   - Unknown resources or actors
   - Structural integrity problems
   - Fatal scheduling conflicts

2. **Resource Issues** (Orange): Problems with resource management
   - Insufficient stock for consumption
   - Missing resource dependencies
   - Resource flow inconsistencies

3. **Scheduling Conflicts** (Yellow): Actor or equipment scheduling problems
   - Actor double-booking
   - Equipment conflicts
   - Dependency timing issues

4. **Optimization Suggestions** (Blue): Recommendations for improving efficiency
   - Buffer time applications
   - Task shifting for better utilization
   - Resource optimization opportunities

## Business Readiness Assessment

The system evaluates simulation business readiness on five levels:

- **Excellent** (95%+): No significant issues, fully business-ready
- **Good** (80%+): Minor issues that can be easily addressed
- **Acceptable** (60%+): Usable but requires review and improvements
- **Needs Improvement** (40%+): Significant issues requiring attention
- **Critical** (<40%): Major problems preventing business use

Assessment considers:
- Resource flow accuracy (30% weight)
- Scheduling feasibility (25% weight)
- Equipment maintenance inclusion (20% weight)
- Temporal consistency (15% weight)
- Resource availability (10% weight)

## Transparency and User Feedback

### Validation Transparency Data

The system generates detailed transparency data for user feedback:

```json
{
  "validation_process": {
    "steps_completed": [...],
    "configuration_used": {...},
    "resource_timeline": {...},
    "validation_statistics": {...}
  },
  "business_readiness": {
    "level": "good",
    "score": 85,
    "description": "..."
  },
  "recommendations": [...]
}
```

### User Interface Integration

The transparency data integrates with the existing transparency modal system:

- Validation status badges on simulation sections
- Business readiness indicators
- Detailed validation results in transparency modal
- Issue categorization with color coding
- Actionable recommendations for improvement

## Examples

### Resource Flow Validation

The system tracks resources minute-by-minute:

```
07:00: flour: 5.0kg → 4.5kg (consumed 0.5kg for "measure ingredients")
07:15: activated_yeast: 0 → 1 batch (produced from "activate yeast")
07:20: mixed_dough: 0 → 1 batch (produced from "mix ingredients")
```

Issues detected:
- ❌ "Task mix_ingredients consumes activated_yeast but it hasn't been produced yet"
- ⚠️ "Flour stock approaching minimum threshold (0.5kg remaining)"

### Equipment Maintenance Insertion

Original task:
```json
{
  "id": "mix_ingredients",
  "produces": {"mixed_dough": 1, "dirty_mixer": 1}
}
```

Auto-inserted maintenance:
```json
{
  "id": "cleaning_mixer_mix_ingredients_0",
  "start": "07:30",
  "duration": 10,
  "actor_id": "worker_1",
  "consumes": {"dirty_mixer": 1, "water": 0.05, "detergent": 0.01},
  "produces": {"clean_mixer": 1},
  "depends_on": ["mix_ingredients"]
}
```

### Scheduling Conflict Resolution

Detected conflict:
```
Actor baker: Task overlap between 'knead_dough' (ends at 07:45) and 'shape_loaves' (starts at 07:40)
```

Resolution applied:
```
✓ Task 'shape_loaves' shifted by 10 minutes to resolve scheduling conflict
```

## Advanced Features

### Multi-Batch Processing (Future)

Configuration for handling multiple production batches:
- Batch staggering and overlapping
- Equipment sharing between batches
- Optimized throughput calculations

### Industry-Specific Templates

The system can be extended with industry-specific configuration templates:
- Food production (breadmaking, brewing, etc.)
- Manufacturing (assembly lines, quality control)
- Chemical processing (batch reactions, distillation)
- Logistics (warehouse operations, shipping)

## Troubleshooting

### Common Issues

1. **Configuration File Errors**
   - Ensure JSON files are valid
   - Check for missing required fields
   - Verify file permissions

2. **Resource Flow Validation Failures**
   - Review starting stock levels
   - Check resource dependency definitions
   - Verify consumption/production amounts

3. **Maintenance Task Insertion Problems**
   - Confirm equipment types are defined in maintenance_rules.json
   - Check actor availability for maintenance tasks
   - Verify cleaning supply resources are available

### Debug Mode

Enable detailed logging:
```python
processor = ConstraintProcessor()
processor.debug_mode = True
result = processor.apply_comprehensive_constraints(simulation_dict)
```

## Contributing

To extend the validation system:

1. Add new validation rules to `constraint_config.json`
2. Implement validation logic in `constraint_processor.py`
3. Update transparency data generation
4. Add corresponding tests
5. Update this documentation

## License

This enhanced simulation system is part of the Universal Automation Wiki project and follows the same licensing terms.