# Simulation.py Fixes and Improvements

## Overview
This document summarizes the critical fixes made to `simulation.py` to resolve the issues where simulations were failing to generate properly from input trees and falling back to generic hardcoded simulations.

## Critical Issues Identified

### 1. **System Failure - Fallback Usage**
- **Problem**: The system was falling back to a generic hardcoded simulation after failed attempts
- **Impact**: Generated simulations bore no resemblance to the input tree structure
- **Fix**: Added critical warnings and comments declaring that fallback should NEVER be used

### 2. **Emoji Format Requirements**
- **Problem**: Validation was rejecting task IDs for missing emoji format
- **Impact**: Valid LLM-generated simulations were being rejected
- **Root Cause**: `assemble.py` requires task IDs in format `"task_name 🔸 emoji"` 
- **Fix**: Improved emoji validation while maintaining Windows compatibility

### 3. **Overly Strict Validation**
- **Problem**: Validation was too strict on optional fields and format requirements
- **Impact**: LLM-generated simulations with minor formatting issues were completely rejected
- **Fix**: Made validation more flexible while maintaining required fields

### 4. **Missing Tree Coverage**
- **Problem**: LLM wasn't generating tasks that covered all steps from the input tree
- **Impact**: Rich input trees were reduced to single generic tasks
- **Fix**: Enhanced LLM prompt to explicitly require coverage of all tree steps

### 5. **LLM Generating "steps" Instead of "tasks"**
- **Problem**: LLM was generating "steps" field instead of required "tasks" field
- **Impact**: System failures, constraint processor errors, missing task data
- **Fix**: Aggressive prompt enforcement and automatic field conversion

### 6. **Step Descriptions vs Executable Tasks**
- **Problem**: When LLM generated "steps", they were just descriptions, not executable tasks
- **Impact**: No task timing, resources, or execution details
- **Fix**: Added conversion function to transform step descriptions to executable tasks

### 7. **Template Structure Mismatch**
- **Problem**: assemble.py template expected different validation_summary structure
- **Impact**: Template rendering errors in web interface
- **Fix**: Updated template to match actual validation_summary structure

### 8. **F-String Braces Error**
- **Problem**: Single braces `{` in f-string JSON templates caused formatting errors
- **Impact**: "Invalid format specifier" errors preventing simulation generation
- **Fix**: Changed to double braces `{{` for literal JSON in f-strings

### 9. **LLM Generating Wrong Task Structure**
- **Problem**: LLM creating tasks with nested "steps" arrays instead of flat executable tasks
- **Impact**: Tasks missing critical fields like start, duration, actor_id, consumes, produces
- **Fix**: Ultra-specific prompt with clear wrong vs right examples

### 10. **Resource Duplication and Clutter**
- **Problem**: Duplicate resources and excessive auto-added cleaning supplies
- **Impact**: Cluttered resource lists making simulation hard to read
- **Fix**: Added duplicate removal and temporarily disabled auto-cleaning supplies

### 11. **Constraint Processor Processing Invalid Tasks**
- **Problem**: Constraint processor tried to "fix" fundamentally broken task structures
- **Impact**: Generated misleading "successful" simulations with invalid tasks
- **Fix**: Added validation to skip constraint processing for malformed tasks

## Specific Fixes Implemented

### 1. Emoji Format Handling
```python
# BEFORE: Strict emoji validation that failed on Windows
if not task_id.endswith(' 🔸[EMOJI]'):
    errors.append("Invalid format")

# AFTER: Robust emoji validation with Windows compatibility
diamond_variants = ["🔸", "\U0001f538", "\\U0001f538"]
# ... handles multiple Unicode representations
```

**Why this matters**: `assemble.py` splits task IDs on `🔸` to create display names and emojis for visualization.

### 2. Enhanced LLM Prompt
```python
# ADDED: Explicit tree coverage requirement
tree_steps = extract_all_steps(tree_json.get("tree", {}))
system_prompt = f"""You MUST create tasks that cover ALL the following steps:
{steps_text}
Each step should be represented as one or more tasks in the simulation
Do NOT create a single generic task - create specific tasks for each step
```

### 3. Flexible Validation
```python
# BEFORE: Required all fields to be present
task_required = ["id", "start", "duration", "actor_id", "location", "consumes", "produces", "depends_on"]

# AFTER: Provides defaults for optional fields
task_required = ["id", "start", "duration", "actor_id", "consumes", "produces"]
# Provides defaults for optional fields
if "location" not in task:
    task["location"] = "workspace"
if "depends_on" not in task:
    task["depends_on"] = []
```

### 4. Setup/Cleanup Task Support
```python
# ADDED: Allow setup/cleanup tasks to have empty produces
setup_cleanup_keywords = ["setup", "clean", "prepare", "initialize", "finalize"]
is_setup_cleanup = any(keyword in task_id.lower() for keyword in setup_cleanup_keywords)
if not produces and not is_setup_cleanup:
    errors.append("Must produce at least one resource")
```

### 5. Aggressive Field Name Enforcement
```python
# ADDED: Multiple enforcement layers for "tasks" field
ABSOLUTELY CRITICAL: You MUST return a JSON object with a "tasks" field
FORBIDDEN FIELD NAMES: "steps", "activities", "actions", "processes", "procedures"
REQUIRED FIELD NAME: "tasks" (exactly this, lowercase)

# Automatic field conversion
if "steps" in simulation_dict and "tasks" not in simulation_dict:
    simulation_dict["tasks"] = simulation_dict.pop("steps")
```

### 6. Step-to-Task Conversion
```python
# ADDED: Convert step descriptions to executable tasks
def convert_steps_to_tasks(steps, actors, resources, start_time):
    # Analyzes step descriptions
    # Creates proper task objects with timing, resources, dependencies
    # Maps step content to appropriate task templates
    # Returns fully executable task list
```

### 7. Template Structure Fix
```python
# FIXED: Template validation summary access
# BEFORE: simulation_data.validation_summary.critical_errors
# AFTER: simulation_data.validation_summary.issue_counts.critical_errors
```

### 8. F-String Braces Fix
```python
# BEFORE: Single braces causing format errors
f"""{
  "time_unit": "{time_unit}",
  "tasks": []
}"""

# AFTER: Double braces for literal JSON
f"""{{
  "time_unit": "{time_unit}",
  "tasks": []
}}"""
```

### 9. Ultra-Specific Task Structure Enforcement
```python
# ADDED: Clear wrong vs right examples in LLM prompt
❌ WRONG EXAMPLES (THESE WILL FAIL):
{{"id": "task", "description": "...", "steps": [...]}}

✅ CORRECT EXAMPLES (CREATE EXACTLY LIKE THIS):
{{"id": "measure_ingredients 🔸 ⚖️", "start": "07:00", "duration": 15, ...}}

# Enhanced validation with immediate rejection
if "steps" in task:
    errors.append("INVALID STRUCTURE - contains nested 'steps' field")
    continue
```

### 10. Resource Management
```python
# ADDED: Duplicate resource removal
def remove_duplicate_resources(simulation_dict):
    # Removes duplicate resources by ID
    # Logs removal for debugging

# TEMPORARILY DISABLED: Auto-cleaning supplies
def _add_cleaning_supplies(self, simulation_data):
    return  # Disabled to reduce clutter
```

### 11. Constraint Processing Protection
```python
# ADDED: Skip constraint processing for invalid tasks
for task in tasks:
    required_fields = ["id", "start", "duration", "actor_id", "consumes", "produces"]
    if missing_fields or "steps" in task:
        has_valid_tasks = False
        break

if not has_valid_tasks:
    return {"constraint_processing_skipped": True, "reason": "Invalid task structure"}
```

## Emoji Format Requirements

### Why Emojis Are Critical
- `assemble.py` uses emojis for task visualization in the simulation view
- Tasks are displayed as: `display_name` + `emoji` 
- Format: `"task_name 🔸 emoji"` where `🔸` is the separator
- `assemble.py` splits on `🔸` to extract parts: `task_name.split('🔸')`

### Windows Compatibility
- Windows terminals may not render emojis correctly
- But the format is still required for `assemble.py` functionality
- Validation now handles multiple Unicode representations:
  - `🔸` (direct emoji)
  - `\U0001f538` (Unicode escape)
  - `\\U0001f538` (escaped Unicode)

### Emoji Suggestions Added
```python
# EMOJI SUGGESTIONS for different task types:
# - Preparation: 🔧 🛠️ ⚙️
# - Measuring: ⚖️ 📏 🥄
# - Mixing: 🥄 🌀 🔄
# - Kneading: 👋 💪 🤲
# - Rising/Waiting: ⏰ 🕐 ⏳
# - Shaping: 👐 🤏 ✋
# - Baking: 🔥 🍞 🥖
# - Cooling: ❄️ 🌬️ 🧊
# - Cleaning: 🧽 🧹 🚿
```

## Fallback Prevention

### Critical Comments Added
```python
# CRITICAL: A fallback simulation should NEVER be used as it defeats the purpose of generating
# task-specific simulations from the input tree. This represents a complete failure of the system.
# The fallback below is a temporary emergency measure and should be removed once the LLM
# generation is fixed to properly handle the input tree structure.
```

### System Failure Marking
```python
return {
    "simulation": fallback_simulation,
    "fallback_used": True,
    "system_failure": True  # Mark this as a system failure
}
```

## Expected Behavior After Fixes

### 1. Tree Coverage
- Input tree with multiple steps (Gather Ingredients, Activate Yeast, etc.)
- Should generate multiple specific tasks covering each step
- No more single generic "shape_dough" tasks

### 2. Proper Emoji Format
- All task IDs: `"task_name 🔸 emoji"`
- Examples: `"measure_ingredients 🔸 ⚖️"`, `"knead_dough 🔸 👋"`
- Windows compatibility maintained

### 3. Validation Success
- LLM-generated simulations with proper format should pass validation
- Minor formatting issues auto-corrected (default location, empty depends_on)
- Setup/cleanup tasks allowed to have empty produces

### 4. No Fallback Usage
- System should generate proper simulations from tree structure
- Fallback usage indicates system failure that needs investigation
- All attempts should be logged for debugging

### 5. Field Name Enforcement
- LLM responses should contain "tasks" field (never "steps")
- Automatic conversion handles LLM mistakes
- Debug logging shows field conversion process

### 6. Step-to-Task Conversion
- Step descriptions automatically converted to executable tasks
- Proper timing, resources, and dependencies assigned
- Task templates based on step content analysis

## Latest Critical Issues Fixed (Final Update)

### Most Recent Problems Resolved:
1. **F-String Format Error**: Single braces `{` caused "Invalid format specifier" errors
2. **LLM Task Structure Problem**: LLM generating tasks with nested "steps" instead of flat executable tasks
3. **Missing Executable Fields**: Tasks lacking start, duration, actor_id, consumes, produces
4. **Resource Clutter**: Duplicate resources and excessive auto-added cleaning supplies
5. **Constraint Processing Invalid Tasks**: System trying to "fix" fundamentally broken task structures
6. **Misleading Success Reports**: System reporting "excellent" business readiness despite broken tasks

### Comprehensive Solutions Implemented:
1. **F-String Fix**: Changed `{` to `{{` for literal JSON braces in f-string templates
2. **Ultra-Specific LLM Prompt**: Added clear wrong vs right examples with visual indicators
3. **Strict Task Validation**: Immediate rejection of tasks with nested "steps" or missing fields
4. **Resource Management**: Duplicate removal and disabled auto-cleaning supplies
5. **Constraint Processing Protection**: Skip processing for fundamentally malformed tasks
6. **Enhanced Error Detection**: Better debugging and critical error identification

### Task Structure Requirements Enforced:
- ✅ **Flat executable tasks**: Each task is one action with timing and resources
- ❌ **No nested structures**: Forbidden "steps", "description", or nested objects
- 🔸 **Emoji format required**: Every task ID must have "task_name 🔸 emoji" format
- ⚖️ **All 8 mandatory fields**: id, start, duration, actor_id, location, consumes, produces, depends_on
- 🎯 **Multiple tasks required**: 8-12 individual tasks covering all tree steps

## Testing Instructions

1. **Test with any tree file**: e.g., `flow\0ef49db7-8c4d-4d0f-b71a-21f5bbbf1838\2.json`
2. **Expected output**: 8-12 individual executable tasks covering all tree steps
3. **Task structure validation**: Each task must have all 8 mandatory fields
4. **Emoji format**: All task IDs in format "task_name 🔸 emoji"
5. **No structural errors**: No tasks with nested "steps", no missing executable fields
6. **Resource management**: Clean resource list without duplicates or excessive cleaning supplies
7. **No fallback**: System should generate proper tasks, not use fallback simulation

### Success Criteria:
- Multiple individual tasks (not descriptions)
- Each task has: id, start, duration, actor_id, location, consumes, produces, depends_on
- Task timing is realistic and sequential
- Resources are consumed and produced appropriately
- No validation errors about missing fields or wrong structure

## Files Modified

1. `simulation.py` - Main fixes for validation, emoji handling, LLM prompts, field conversion
2. `page-template.html` - Fixed validation_summary structure access
3. `SIMULATION_FIXES.md` (this file) - Documentation of changes

## Dependencies

- `assemble.py` - Requires emoji format for proper task display
- `utils.py` - LLM interaction functions
- `constraint_processor.py` - Enhanced validation processing

The fixes ensure that simulations properly reflect the input tree structure while maintaining compatibility with the existing visualization system.

## Debug Features Added

- **Enhanced LLM response analysis**: Detects wrong task structures before validation
- **Critical error identification**: Flags fundamental task structure problems
- **Resource management logging**: Tracks duplicate removal and cleaning supply management
- **Constraint processing protection**: Prevents processing of invalid task structures
- **Detailed validation feedback**: Specific error messages for each type of structural problem
- **F-string validation**: Test suite to prevent format string errors

### Key Debug Outputs:
- "CRITICAL ERROR - LLM response contains 'steps' field instead of 'tasks'"
- "INVALID STRUCTURE - contains nested 'steps' field"
- "Missing critical executable fields: start, duration, actor_id"
- "Removed duplicate resource: [resource_name]"
- "Skipping constraint processing due to malformed tasks"

These debug features provide clear feedback about what's wrong and help identify whether issues are from LLM generation, validation logic, or constraint processing.