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

## Latest Issues Fixed (Additional Update)

### Critical Issues Resolved:
1. **LLM Field Name Problem**: LLM was generating "steps" instead of "tasks"
2. **KeyError in main()**: Accessing non-existent 'tasks' field
3. **Template Rendering Error**: Wrong validation_summary structure access
4. **Constraint Processor Error**: Looking for 'tasks' in data with 'steps'
5. **Step vs Task Format**: Steps were descriptions, not executable tasks

### Solutions Implemented:
1. **Multi-layer enforcement** of "tasks" field name in LLM prompt
2. **Automatic field conversion** from "steps" to "tasks" 
3. **Intelligent step-to-task conversion** for description-style steps
4. **Template structure fixes** for validation_summary access
5. **Debug logging** to track conversion process
6. **Error handling** in main() function for missing fields

## Testing Instructions

1. **Test with the provided tree**: `uaw/routines/flow/9a7076c7-b6b1-4caf-b23c-324abf65e993/2.json`
2. **Expected output**: Multiple tasks covering all tree steps (Activate Yeast, Combine Dry Ingredients, etc.)
3. **Validation**: All tasks should have proper emoji format and pass validation
4. **No fallback**: System should not use fallback simulation

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

- **Field detection logging**: Shows what fields LLM generates
- **Conversion tracking**: Logs steps-to-tasks conversion process  
- **Structure validation**: Verifies task object structure
- **Error handling**: Graceful fallback for missing fields
- **Template debugging**: Better error messages for structure mismatches

These debug features help identify and resolve issues when the LLM generates unexpected formats or when the conversion process encounters problems.