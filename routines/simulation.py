import json
import os
import sys
from typing import Dict, List, Tuple, Any, Optional

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Windows Unicode support
if sys.platform.startswith('win'):
    import locale
    import codecs
    # Try to set UTF-8 encoding for Windows console
    try:
        # For Python 3.7+ on Windows
        if hasattr(sys.stdout, 'reconfigure'):
            sys.stdout.reconfigure(encoding='utf-8')
            sys.stderr.reconfigure(encoding='utf-8')
        else:
            # Fallback for older Python versions
            sys.stdout = codecs.getwriter('utf-8')(sys.stdout.detach())
            sys.stderr = codecs.getwriter('utf-8')(sys.stderr.detach())
    except (AttributeError, OSError):
        pass  # Fallback to safe printing

from utils import chat_with_llm, parse_llm_json_response, load_json, saveToFile, chat_with_llm_openrouter
import jsonschema
from constraint_processor import ConstraintProcessor

# EMOJI FORMAT REQUIREMENT:
# Task IDs must be in format "task_name 🔸 emoji" where:
# - 🔸 is the orange diamond separator (Unicode U+1F538)
# - This format is REQUIRED for assemble.py to properly display tasks
# - assemble.py splits on 🔸 to separate task name from emoji for visualization
# - Windows users may see rendering issues but functionality is preserved




def safe_print(*args, **kwargs):
    """Safe print function that handles Unicode encoding errors on Windows."""
    try:
        print(*args, **kwargs)
    except UnicodeEncodeError:
        # Replace problematic Unicode characters with ASCII equivalents
        safe_args = []
        for arg in args:
            if isinstance(arg, str):
                # Replace common emoji characters with ASCII equivalents
                safe_arg = arg.replace('🔸', '[*]').replace('⚙️', '[gear]').replace('✓', '[check]').replace('⚠', '[warn]')
                # Remove any remaining problematic Unicode characters
                safe_arg = safe_arg.encode('ascii', errors='replace').decode('ascii')
                safe_args.append(safe_arg)
            else:
                safe_args.append(str(arg).encode('ascii', errors='replace').decode('ascii'))
        print(*safe_args, **kwargs)


def load_schema_and_defaults() -> Dict[str, Any]:
    """
    Load and parse simulation_schema.json and defaults.json.

    Returns:
        Dict containing 'schema' and 'defaults' keys with their respective JSON data
    """
    schema_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "simulation", "simulation_schema.json")
    defaults_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "simulation", "defaults.json")

    try:
        # Minimal defaults only
        default_defaults = {
            "time_unit": "minute",
            "start_time": "06:00",
            "end_time": "18:00",
            "actors": [],
            "resources": [],
            "tasks": []
        }

        schema = {"type": "object"}
        defaults = default_defaults

        if os.path.exists(schema_path):
            with open(schema_path, "r", encoding="utf-8") as f:
                schema = json.load(f)

        if os.path.exists(defaults_path):
            with open(defaults_path, "r", encoding="utf-8") as f:
                defaults = json.load(f)

        return {"schema": schema, "defaults": defaults}

    except Exception as e:
        print(f"Error loading schema/defaults: {e}")
        return {
            "schema": {"type": "object"},
            "defaults": {
                "time_unit": "minute",
                "start_time": "06:00",
                "end_time": "18:00",
                "actors": [],
                "resources": [],
                "tasks": []
            }
        }

def construct_initial_simulation(tree_json: Dict[str, Any], article_metadata: Dict[str, Any]) -> Dict[str, Any]:
    """
    Use LLM to intelligently construct initial simulation template based on task tree content.

    Args:
        tree_json: The task tree JSON from hallucinate-tree.py
        article_metadata: Article metadata containing title, domain, and optional overrides

    Returns:
        Simulation template dict with domain-appropriate actors and resources
    """
    # Load defaults as a starting reference
    config = load_schema_and_defaults()
    defaults = config["defaults"]

    # Extract task information
    task_name = tree_json.get("tree", {}).get("step", "Unknown Task")

    # Build system prompt for LLM to create appropriate simulation template
    system_prompt = """You are an AI simulation planner. Given a task tree, you need to determine what actors (people/machines) and resources would be needed to perform this work in a realistic setting.

CRITICAL NAMING REQUIREMENTS:
- ALL resource IDs must use snake_case (lowercase with underscores): flour, water, yeast, clean_mixer, dirty_mixer
- ALL units must be lowercase: kg, grams, liters, units, batches, loaves
- NO CamelCase or capitalized resource names
- Be consistent with naming conventions throughout

Analyze the task tree and create a simulation template with:
1. Appropriate actors (workers, machines, equipment) with realistic roles, costs, and availability
2. Relevant resources including:
   - Raw materials (ingredients, supplies) with appropriate units and starting stock
   - Intermediate state resources (clean/dirty equipment, prepared ingredients, work-in-progress items)
   - Equipment state resources (cold_oven/preheated_oven, clean_mixer/dirty_mixer, etc.)
3. Suitable time window (start_time, end_time) for this type of work
4. Appropriate time_unit (second, minute, hour)

CRITICAL: Include comprehensive intermediate state resources that represent the progression of work:
- Equipment states: clean_mixer, dirty_mixer, cold_oven, preheated_oven, used_oven
- Workspace states: clean_workspace, dirty_workspace, prepared_workspace
- Work-in-progress: measured_ingredients, activated_yeast, mixed_dough, kneaded_dough, risen_dough, shaped_loaves
- Final products: finished_bread, cooled_bread

STARTING STOCK LOGIC:
- Raw materials should have positive starting stock
- Equipment should start in clean/ready state (clean_mixer: 1, dirty_mixer: 0)
- Work-in-progress items should start at 0
- Workspaces should start clean (clean_workspace: 1, dirty_workspace: 0)

Return ONLY a JSON object with this structure:
{
  "time_unit": "minute",
  "start_time": "06:00",
  "end_time": "18:00",
  "actors": [
    {
      "id": "actor_id",
      "role": "Actor Role",
      "cost_per_hour": 15.0,
      "availability": [{"from": "06:00", "to": "18:00"}]
    }
  ],
  "resources": [
    {
      "id": "resource_id",
      "unit": "unit_type",
      "starting_stock": 100
    }
  ]
}

Make actors and resources specific to the domain (e.g., baker for breadmaking, not generic_worker).
Use consistent snake_case naming for all resource IDs."""

    # Build user prompt with the task tree
    user_prompt = f"""Task: {task_name}

Task Tree Structure:
{json.dumps(tree_json, indent=2)}

Create a simulation template for this task with appropriate actors and comprehensive resources using consistent snake_case naming."""

    try:
        response = chat_with_llm("gemma3", system_prompt, user_prompt)
        template = parse_llm_json_response(response)

        # Merge with defaults and ensure we have comprehensive resources
        result = defaults.copy()
        result.update(template)

        # Standardize all resource IDs to snake_case and ensure consistency
        if result.get("resources"):
            standardized_resources = []
            for resource in result["resources"]:
                # Convert resource ID to snake_case
                resource_id = resource["id"].lower().replace(" ", "_").replace("-", "_")
                # Ensure camelCase is converted (e.g., CleanMixer -> clean_mixer)
                import re
                resource_id = re.sub(r'([a-z0-9])([A-Z])', r'\1_\2', resource_id).lower()

                standardized_resources.append({
                    "id": resource_id,
                    "unit": resource["unit"].lower(),
                    "starting_stock": resource["starting_stock"]
                })
            result["resources"] = standardized_resources

        # Ensure we have minimum required intermediate resources for breadmaking
        if not result.get("resources"):
            result["resources"] = []

        # Add missing critical intermediate resources if not present
        existing_resource_ids = {r["id"] for r in result["resources"]}
        critical_resources = [
            {"id": "clean_workspace", "unit": "units", "starting_stock": 1},
            {"id": "dirty_workspace", "unit": "units", "starting_stock": 0},
            {"id": "clean_mixer", "unit": "units", "starting_stock": 1},
            {"id": "dirty_mixer", "unit": "units", "starting_stock": 0},
            {"id": "clean_surface", "unit": "units", "starting_stock": 1},
            {"id": "dirty_surface", "unit": "units", "starting_stock": 0},
            {"id": "cold_oven", "unit": "units", "starting_stock": 1},
            {"id": "preheated_oven", "unit": "units", "starting_stock": 0},
            {"id": "used_oven", "unit": "units", "starting_stock": 0},
            {"id": "measured_ingredients", "unit": "batches", "starting_stock": 0},
            {"id": "activated_yeast", "unit": "batches", "starting_stock": 0},
            {"id": "mixed_dough", "unit": "batches", "starting_stock": 0},
            {"id": "kneaded_dough", "unit": "batches", "starting_stock": 0},
            {"id": "risen_dough", "unit": "batches", "starting_stock": 0},
            {"id": "shaped_loaves", "unit": "loaves", "starting_stock": 0},
            {"id": "finished_bread", "unit": "loaves", "starting_stock": 0},
            {"id": "cooled_bread", "unit": "loaves", "starting_stock": 0}
        ]

        for resource in critical_resources:
            if resource["id"] not in existing_resource_ids:
                result["resources"].append(resource)

        return result

    except Exception as e:
        print(f"Error constructing simulation template: {e}")
        # Return comprehensive template for breadmaking with proper naming
        return {
            "time_unit": "minute",
            "start_time": "07:00",
            "end_time": "18:00",
            "actors": [
                {
                    "id": "baker",
                    "role": "Head Baker",
                    "cost_per_hour": 25.0,
                    "availability": [{"from": "07:00", "to": "18:00"}]
                },
                {
                    "id": "assistant",
                    "role": "Baker Assistant",
                    "cost_per_hour": 18.0,
                    "availability": [{"from": "07:00", "to": "18:00"}]
                }
            ],
            "resources": [
                {"id": "flour", "unit": "kg", "starting_stock": 50},
                {"id": "water", "unit": "liters", "starting_stock": 20},
                {"id": "yeast", "unit": "grams", "starting_stock": 500},
                {"id": "salt", "unit": "grams", "starting_stock": 200},
                {"id": "sugar", "unit": "grams", "starting_stock": 300},
                {"id": "clean_workspace", "unit": "units", "starting_stock": 1},
                {"id": "dirty_workspace", "unit": "units", "starting_stock": 0},
                {"id": "clean_mixer", "unit": "units", "starting_stock": 1},
                {"id": "dirty_mixer", "unit": "units", "starting_stock": 0},
                {"id": "clean_surface", "unit": "units", "starting_stock": 1},
                {"id": "dirty_surface", "unit": "units", "starting_stock": 0},
                {"id": "cold_oven", "unit": "units", "starting_stock": 1},
                {"id": "preheated_oven", "unit": "units", "starting_stock": 0},
                {"id": "used_oven", "unit": "units", "starting_stock": 0},
                {"id": "measured_ingredients", "unit": "batches", "starting_stock": 0},
                {"id": "activated_yeast", "unit": "batches", "starting_stock": 0},
                {"id": "mixed_dough", "unit": "batches", "starting_stock": 0},
                {"id": "kneaded_dough", "unit": "batches", "starting_stock": 0},
                {"id": "risen_dough", "unit": "batches", "starting_stock": 0},
                {"id": "shaped_loaves", "unit": "loaves", "starting_stock": 0},
                {"id": "finished_bread", "unit": "loaves", "starting_stock": 0},
                {"id": "cooled_bread", "unit": "loaves", "starting_stock": 0}
            ]
        }

def ask_llm_for_schedule(simulation_template: Dict[str, Any], tree_json: Dict[str, Any]) -> str:
    """Generate detailed task schedule from the tree and simulation template."""

    # Calculate available minutes for validation
    start_time = simulation_template.get('start_time', '07:00')
    end_time = simulation_template.get('end_time', '18:00')
    start_hour, start_min = map(int, start_time.split(':'))
    end_hour, end_min = map(int, end_time.split(':'))
    total_minutes = (end_hour * 60 + end_min) - (start_hour * 60 + start_min)

    # Get available actors for examples
    actors = simulation_template.get("actors", [])
    actor_1_id = actors[0]["id"] if len(actors) > 0 else "baker"
    actor_2_id = actors[1]["id"] if len(actors) > 1 else "assistant"

    # Get available resources for validation
    resource_ids = [r["id"] for r in simulation_template.get("resources", [])]
    resource_list = ", ".join(resource_ids[:10])  # Show first 10 for brevity

    # Extract all steps from the tree to ensure comprehensive task coverage
    def extract_all_steps(tree_node, steps=None):
        if steps is None:
            steps = []

        if isinstance(tree_node, dict):
            if "step" in tree_node:
                steps.append(tree_node["step"])
            if "children" in tree_node:
                for child in tree_node["children"]:
                    extract_all_steps(child, steps)
        return steps

    tree_steps = extract_all_steps(tree_json.get("tree", {}))
    steps_text = "\n".join([f"- {step}" for step in tree_steps])

    system_prompt = f"""You are a process scheduling expert. Given a task tree and simulation template with actors and resources, create a detailed task schedule that MUST cover ALL steps from the input tree.

CRITICAL REQUIREMENTS - ALL MUST BE ENFORCED:

1. TREE COVERAGE REQUIREMENT:
   - You MUST create tasks that cover ALL the following steps from the input tree:
   {steps_text}
   - Each step should be represented as one or more tasks in the simulation
   - Do NOT create a single generic task - create specific tasks for each step

2. STRUCTURE REQUIREMENTS:
   - Return ONLY the root simulation object - NO nested simulation objects
   - Do NOT include any duplicate data structures
   - Use the exact template structure provided

3. RESOURCE NAMING - CRITICAL:
   - ALL resource references in tasks MUST exactly match the template resource IDs
   - Available resources: {resource_list}...
   - Use ONLY snake_case resource names (flour, water, yeast, clean_mixer, dirty_mixer)
   - NO CamelCase or capitalized names (NOT Flour, Water, CleanMixer)

4. TIME FORMAT RULES:
   - ALL times must be in HH:MM format (24-hour)
   - Minutes must be 00-59 (NEVER 60 or higher)
   - Times must be between {start_time} and {end_time}
   - Include BOTH start time AND duration in minutes

5. TASK STRUCTURE - EVERY task must have ALL these fields:
   - "id": "descriptive_task_name 🔸 emoji" (REQUIRED: task name, then 🔸, then relevant emoji)
   NOTE: The 🔸 separator is CRITICAL for assemble.py visualization - do NOT omit it!
   - "start": "HH:MM" (start time)
   - "duration": number (duration in minutes)
   - "actor_id": "{actor_1_id}" or "{actor_2_id}" (must match template)
   - "location": "workspace" (or specific location like "prep_station", "mixing_area")
   - "consumes": {{"resource_id": positive_number}}
   - "produces": {{"resource_id": positive_number}} (setup/cleanup tasks may produce empty object {{}})
   - "depends_on": ["task_id_1", "task_id_2"] (can be empty array [])

6. RESOURCE RULES:
   - EVERY task MUST consume at least one resource
   - EVERY task MUST produce at least one resource
   - Use POSITIVE numbers for consumption/production
   - Resource IDs must EXACTLY match template (snake_case only)
   - Include realistic amounts based on starting stock
   - Ensure logical resource flow (can't consume what doesn't exist)

7. ACTOR SCHEDULING:
   - Same actor CANNOT have overlapping tasks
   - Different actors CAN work simultaneously
   - Calculate end times: start + duration, ensure no overlaps

8. LOGICAL WORKFLOW:
   - Tasks should follow logical sequence from the tree structure
   - Dependencies should be realistic
   - Equipment cleaning should happen after equipment use
   - Include preparation and cleanup tasks

EXAMPLE TASK FORMAT:
{{
  "id": "measure_ingredients 🔸 ⚖️",
  "start": "07:00",
  "duration": 15,
  "actor_id": "{actor_1_id}",
  "location": "prep_station",
  "consumes": {{"flour": 0.5, "water": 0.3, "yeast": 10}},
  "produces": {{"measured_ingredients": 1}},
  "depends_on": []
}}

EXAMPLE SETUP TASK (can have empty produces):
{{
  "id": "initial_setup 🔸 🔧",
  "start": "06:00",
  "duration": 10,
  "actor_id": "{actor_2_id}",
  "location": "workspace",
  "consumes": {{"clean_workspace": 1}},
  "produces": {{}},
  "depends_on": []
}}

EMOJI SUGGESTIONS for different task types:
- Preparation: 🔧 🛠️ ⚙️
- Measuring: ⚖️ 📏 🥄
- Mixing: 🥄 🌀 🔄
- Kneading: 👋 💪 🤲
- Rising/Waiting: ⏰ 🕐 ⏳
- Shaping: 👐 🤏 ✋
- Baking: 🔥 🍞 🥖
- Cooling: ❄️ 🌬️ 🧊
- Cleaning: 🧽 🧹 🚿

ABSOLUTELY CRITICAL: You MUST return a JSON object with a "tasks" field (NOT "steps", NOT "activities", NOT anything else).
The field MUST be called exactly "tasks" - this is not optional. Any other field name will cause system failure.

FORBIDDEN FIELD NAMES: "steps", "activities", "actions", "processes", "procedures"
REQUIRED FIELD NAME: "tasks" (exactly this, lowercase)

Return a complete simulation JSON with the exact structure (NO nested simulation objects):
{
  "time_unit": "{simulation_template.get('time_unit', 'minute')}",
  "start_time": "{start_time}",
  "end_time": "{end_time}",
  "actors": [template actors exactly as provided],
  "resources": [template resources exactly as provided],
  "tasks": [detailed task array with ALL required fields covering ALL tree steps],
  "article_title": "Generated Simulation"
}

THE FIELD MUST BE CALLED "tasks" - NOT "steps", NOT "activities", NOT anything else!
If you use any other field name, the system will fail completely.

CRITICAL REQUIREMENTS:
- The field MUST be called "tasks" (not "steps" or anything else)
- DO NOT use "steps" field - it will cause system failure
- Create task objects with: id, start, duration, actor_id, location, consumes, produces, depends_on
- Setup and cleanup tasks may have empty produces object {{}}
- CRITICAL: Every task ID must be in format "task_name 🔸 emoji" with the orange diamond separator
- This format is REQUIRED for assemble.py to properly display tasks in the simulation view
- Windows users may see emoji rendering issues but the format must still be used

EXAMPLE TASK STRUCTURE - COPY THIS EXACT FORMAT:
{{
 "tasks": [
   {{
     "id": "measure_ingredients 🔸 ⚖️",
     "start": "07:00",
     "duration": 15,
     "actor_id": "{actor_1_id}",
     "location": "prep_station",
     "consumes": {{"flour": 0.5, "water": 0.3}},
     "produces": {{"measured_ingredients": 1}},
     "depends_on": []
   }}
 ]
}}

DO NOT return nested structures - return the flat JSON structure shown above.
"""

    user_prompt = f"""Task Tree:
{json.dumps(tree_json, indent=2)}

Simulation Template:
{json.dumps(simulation_template, indent=2)}

Create a complete simulation with detailed tasks following ALL the requirements above. Ensure every resource reference exactly matches the template resource IDs (snake_case only)."""

    try:
        response = chat_with_llm("gemma3", system_prompt, user_prompt)
        safe_print(f"DEBUG: LLM response length: {len(response)} characters")
        if "tasks" in response:
            safe_print("DEBUG: LLM response contains 'tasks' field")
        elif "steps" in response:
            safe_print("DEBUG: WARNING - LLM response contains 'steps' field instead of 'tasks'")
        else:
            safe_print("DEBUG: WARNING - LLM response may not contain required fields")
        return response
    except Exception as e:
        print(f"Error generating schedule: {e}")
        # Return comprehensive fallback with all required fields and proper structure
        # CRITICAL: Must use "tasks" field not "steps" or anything else
        safe_print("DEBUG: Using fallback JSON response due to LLM error")
        return json.dumps({
            "time_unit": simulation_template.get("time_unit", "minute"),
            "start_time": start_time,
            "end_time": end_time,
            "actors": simulation_template.get("actors", []),
            "resources": simulation_template.get("resources", []),
            "article_title": "Breadmaking Simulation",
            "tasks": [
                {
                    "id": "prepare_workspace 🔸 🔧",
                    "start": "07:00",
                    "duration": 10,
                    "actor_id": actor_2_id,
                    "location": "prep_area",
                    "consumes": {"dirty_workspace": 1},
                    "produces": {"clean_workspace": 1},
                    "depends_on": []
                },
                {
                    "id": "measure_ingredients 🔸 ⚖️",
                    "start": "07:00",
                    "duration": 15,
                    "actor_id": actor_1_id,
                    "location": "prep_station",
                    "consumes": {"flour": 0.5, "water": 0.3, "yeast": 10, "salt": 5},
                    "produces": {"measured_ingredients": 1},
                    "depends_on": []
                },
                {
                    "id": "activate_yeast 🔸 🌀",
                    "start": "07:10",
                    "duration": 10,
                    "actor_id": actor_2_id,
                    "location": "prep_station",
                    "consumes": {"yeast": 5, "water": 0.1, "sugar": 10},
                    "produces": {"activated_yeast": 1},
                    "depends_on": ["prepare_workspace 🔸 🔧"]
                },
                {
                    "id": "mix_ingredients 🔸 🥄",
                    "start": "07:15",
                    "duration": 15,
                    "actor_id": actor_1_id,
                    "location": "mixing_station",
                    "consumes": {"measured_ingredients": 1, "activated_yeast": 1, "clean_mixer": 1},
                    "produces": {"mixed_dough": 1, "dirty_mixer": 1},
                    "depends_on": ["measure_ingredients 🔸 ⚖️", "activate_yeast 🔸 🌀"]
                },
                {
                    "id": "knead_dough 🔸 👋",
                    "start": "07:30",
                    "duration": 15,
                    "actor_id": actor_1_id,
                    "location": "kneading_area",
                    "consumes": {"mixed_dough": 1, "clean_surface": 1},
                    "produces": {"kneaded_dough": 1, "dirty_surface": 1},
                    "depends_on": ["mix_ingredients 🔸 🥄"]
                },
                {
                    "id": "clean_mixer 🔸 🧽",
                    "start": "07:20",
                    "duration": 10,
                    "actor_id": actor_2_id,
                    "location": "cleaning_station",
                    "consumes": {"dirty_mixer": 1},
                    "produces": {"clean_mixer": 1},
                    "depends_on": ["activate_yeast 🔸 🌀"]
                },
                {
                    "id": "prepare_oven 🔸 🔥",
                    "start": "07:30",
                    "duration": 15,
                    "actor_id": actor_2_id,
                    "location": "oven_area",
                    "consumes": {"cold_oven": 1},
                    "produces": {"preheated_oven": 1},
                    "depends_on": ["clean_mixer 🔸 🧽"]
                },
                {
                    "id": "first_rise 🔸 ⏰",
                    "start": "07:45",
                    "duration": 60,
                    "actor_id": actor_1_id,
                    "location": "proofing_area",
                    "consumes": {"kneaded_dough": 1},
                    "produces": {"risen_dough": 1},
                    "depends_on": ["knead_dough 🔸 👋"]
                },
                {
                    "id": "clean_surface 🔸 🧹",
                    "start": "07:45",
                    "duration": 15,
                    "actor_id": actor_2_id,
                    "location": "cleaning_station",
                    "consumes": {"dirty_surface": 1},
                    "produces": {"clean_surface": 1},
                    "depends_on": ["prepare_oven 🔸 🔥"]
                },
                {
                    "id": "shape_loaves 🔸 👐",
                    "start": "08:45",
                    "duration": 20,
                    "actor_id": actor_1_id,
                    "location": "shaping_area",
                    "consumes": {"risen_dough": 1, "clean_surface": 1},
                    "produces": {"shaped_loaves": 2, "dirty_surface": 1},
                    "depends_on": ["first_rise 🔸 ⏰", "clean_surface 🔸 🧹"]
                },
                {
                    "id": "bake_bread 🔸 🍞",
                    "start": "09:05",
                    "duration": 45,
                    "actor_id": actor_1_id,
                    "location": "oven_area",
                    "consumes": {"shaped_loaves": 2, "preheated_oven": 1},
                    "produces": {"finished_bread": 2, "used_oven": 1},
                    "depends_on": ["shape_loaves 🔸 👐", "prepare_oven 🔸 🔥"]
                },
                {
                    "id": "cool_bread 🔸 ❄️",
                    "start": "09:50",
                    "duration": 30,
                    "actor_id": actor_2_id,
                    "location": "cooling_area",
                    "consumes": {"finished_bread": 2},
                    "produces": {"cooled_bread": 2},
                    "depends_on": ["bake_bread 🔸 🍞"]
                }
            ]
        }, indent=2)

def parse_and_validate_simulation(raw_json_str: str) -> Tuple[Optional[Dict[str, Any]], List[str]]:
    """Parse and validate simulation JSON response with strict requirements."""
    errors = []

    try:
        simulation_dict = parse_llm_json_response(raw_json_str)

        # Handle case where JSON parsing completely failed
        if simulation_dict is None:
            errors.append("Failed to parse JSON response - response is None")
            return None, errors

        # Handle case where parsed result is not a dictionary
        if not isinstance(simulation_dict, dict):
            errors.append(f"Expected JSON object, got {type(simulation_dict)}")
            return None, errors

        # Check for unwanted nested structure and fix it automatically
        if "simulation" in simulation_dict:
            if isinstance(simulation_dict["simulation"], dict) and any(key in simulation_dict["simulation"] for key in ["time_unit", "actors", "resources", "tasks"]):
                safe_print("Detected nested simulation structure - automatically flattening...")
                # Flatten the nested structure
                simulation_dict = simulation_dict["simulation"]

        # Fix LLM mistake: convert "steps" to "tasks" if needed
        safe_print(f"DEBUG: Fields in simulation_dict: {list(simulation_dict.keys())}")

        if "steps" in simulation_dict and "tasks" not in simulation_dict:
            safe_print("Converting 'steps' field to 'tasks' field...")
            steps_content = simulation_dict["steps"]
            safe_print(f"DEBUG: Found {len(steps_content)} items in 'steps' field")
            safe_print(f"DEBUG: First step content: {steps_content[0] if steps_content else 'No steps'}")

            # Check if steps are just descriptions (need conversion) or already task objects
            if steps_content and isinstance(steps_content[0], dict):
                if "step" in steps_content[0] and "id" not in steps_content[0]:
                    # These are step descriptions, convert to tasks
                    safe_print("Converting step descriptions to executable tasks...")
                    actors = simulation_dict.get("actors", [])
                    resources = simulation_dict.get("resources", [])
                    start_time = simulation_dict.get("start_time", "07:00")

                    converted_tasks = convert_steps_to_tasks(steps_content, actors, resources, start_time)
                    simulation_dict["tasks"] = converted_tasks
                    safe_print(f"DEBUG: Converted {len(steps_content)} steps to {len(converted_tasks)} tasks")
                else:
                    # These are already task-like objects, just rename field
                    simulation_dict["tasks"] = simulation_dict.pop("steps")
                    safe_print("DEBUG: Renamed 'steps' to 'tasks' (already task objects)")
            else:
                # Empty or invalid steps
                simulation_dict["tasks"] = []
                safe_print("DEBUG: No valid steps found, created empty tasks array")

            # Remove the steps field
            if "steps" in simulation_dict:
                del simulation_dict["steps"]
            safe_print("DEBUG: Successfully converted 'steps' to 'tasks'")

        # Also handle case where both exist (keep tasks, remove steps)
        if "steps" in simulation_dict and "tasks" in simulation_dict:
            safe_print("Removing duplicate 'steps' field (keeping 'tasks')")
            safe_print(f"DEBUG: Tasks field has {len(simulation_dict['tasks'])} items")
            safe_print(f"DEBUG: Steps field has {len(simulation_dict['steps'])} items")
            del simulation_dict["steps"]

        # Final verification
        safe_print(f"DEBUG: Final fields in simulation_dict: {list(simulation_dict.keys())}")
        if "tasks" in simulation_dict:
            safe_print(f"DEBUG: Final tasks field has {len(simulation_dict['tasks'])} items")
            if simulation_dict["tasks"]:
                safe_print(f"DEBUG: First task structure: {list(simulation_dict['tasks'][0].keys()) if isinstance(simulation_dict['tasks'][0], dict) else 'Not a dict'}")

        # Validate required fields at root level
        required_fields = ["time_unit", "start_time", "end_time", "actors", "resources", "tasks"]
        for field in required_fields:
            if field not in simulation_dict:
                errors.append(f"Missing required field at root level: {field}")

        # Validate tasks have required fields and provide defaults for optional ones
        for i, task in enumerate(simulation_dict.get("tasks", [])):
            task_required = ["id", "start", "duration", "actor_id", "consumes", "produces"]
            for field in task_required:
                if field not in task:
                    errors.append(f"Task {i} ({task.get('id', 'unnamed')}): Missing required field: {field}")

            # Provide defaults for optional fields
            if "location" not in task:
                task["location"] = "workspace"
            if "depends_on" not in task:
                task["depends_on"] = []

            # Validate task ID is present and in correct format (Windows-compatible)
            # NOTE: The 🔸 emoji format is REQUIRED for assemble.py to properly display tasks
            # assemble.py splits task IDs on 🔸 to separate display name from emoji
            task_id = task.get("id", "")
            if not task_id:
                errors.append(f"Task {i}: Missing task ID")
            else:
                # Check for emoji format more robustly to handle Windows terminal issues
                try:
                    # Try multiple representations of the diamond emoji for Windows compatibility
                    diamond_variants = ["🔸", "\U0001f538", "\\U0001f538"]
                    separator_found = None

                    for variant in diamond_variants:
                        if variant in task_id:
                            separator_found = variant
                            break

                    if separator_found:
                        # Validate the format is correct (has both parts)
                        parts = task_id.split(separator_found)
                        if len(parts) != 2 or not parts[0].strip() or not parts[1].strip():
                            errors.append(f"Task {i} ({task_id}): Invalid format - should be 'task_name 🔸 emoji'")
                    else:
                        # No separator found - this is required for assemble.py compatibility
                        # Check if task_id looks like it might have emoji issues (contains non-ASCII)
                        try:
                            task_id.encode('ascii')
                            # Pure ASCII - definitely missing emoji format
                            errors.append(f"Task {i} ({task_id}): Task ID should be in format 'task_name 🔸 emoji' (required for assemble.py)")
                        except UnicodeEncodeError:
                            # Contains non-ASCII characters - might be emoji formatting issue
                            errors.append(f"Task {i} ({task_id}): Task ID may have emoji formatting issues - should be 'task_name 🔸 emoji'")

                except (UnicodeError, UnicodeDecodeError, UnicodeEncodeError) as e:
                    # Windows compatibility - allow the task but warn about potential issues
                    # The emoji format is still required for assemble.py even if Windows has display issues
                    errors.append(f"Task {i} ({task_id}): Warning - emoji formatting may have issues on Windows: {e}")

            # Validate time format
            start_time = task.get("start", "")
            if not (isinstance(start_time, str) and ":" in start_time):
                errors.append(f"Task {i} ({task_id}): Invalid start time format: {start_time}")

            # Validate duration
            duration = task.get("duration")
            if not (isinstance(duration, (int, float)) and duration > 0):
                errors.append(f"Task {i} ({task_id}): Duration must be positive number, got: {duration}")

            # Validate resources
            consumes = task.get("consumes", {})
            produces = task.get("produces", {})

            if not consumes:
                errors.append(f"Task {i} ({task_id}): Must consume at least one resource")

            # Allow setup/cleanup tasks to not produce resources
            setup_cleanup_keywords = ["setup", "clean", "prepare", "initialize", "finalize", "inspect", "check"]
            is_setup_cleanup = any(keyword in task_id.lower() for keyword in setup_cleanup_keywords)

            if not produces and not is_setup_cleanup:
                errors.append(f"Task {i} ({task_id}): Must produce at least one resource")

            # Validate resource amounts are positive
            for resource, amount in consumes.items():
                if not (isinstance(amount, (int, float)) and amount > 0):
                    errors.append(f"Task {i} ({task_id}): Consumed {resource} must be positive, got: {amount}")

            for resource, amount in produces.items():
                if not (isinstance(amount, (int, float)) and amount > 0):
                    errors.append(f"Task {i} ({task_id}): Produced {resource} must be positive, got: {amount}")

        return simulation_dict, errors

    except Exception as e:
        errors.append(f"JSON parsing error: {e}")
        return None, errors

def convert_steps_to_tasks(steps: List[Dict[str, Any]], actors: List[Dict[str, Any]], resources: List[Dict[str, Any]], start_time: str = "07:00") -> List[Dict[str, Any]]:
    """Convert step descriptions to executable tasks with proper structure."""
    tasks = []
    current_time_minutes = 0

    # Parse start time
    if ":" in start_time:
        hours, minutes = map(int, start_time.split(":"))
        current_time_minutes = hours * 60 + minutes

    # Get actor IDs
    actor_ids = [actor["id"] for actor in actors]
    primary_actor = actor_ids[0] if actor_ids else "baker"
    secondary_actor = actor_ids[1] if len(actor_ids) > 1 else primary_actor

    # Get resource IDs for mapping
    resource_ids = {resource["id"] for resource in resources}

    # Define task templates based on step content
    task_templates = {
        "activate": {"duration": 10, "actor": secondary_actor, "location": "prep_station", "emoji": "🌀"},
        "measure": {"duration": 15, "actor": primary_actor, "location": "prep_station", "emoji": "⚖️"},
        "mix": {"duration": 15, "actor": primary_actor, "location": "mixing_station", "emoji": "🥄"},
        "knead": {"duration": 20, "actor": primary_actor, "location": "kneading_area", "emoji": "👋"},
        "rise": {"duration": 60, "actor": primary_actor, "location": "proofing_area", "emoji": "⏰"},
        "shape": {"duration": 25, "actor": primary_actor, "location": "shaping_area", "emoji": "👐"},
        "bake": {"duration": 45, "actor": primary_actor, "location": "oven_area", "emoji": "🍞"},
        "cool": {"duration": 30, "actor": secondary_actor, "location": "cooling_area", "emoji": "❄️"},
        "clean": {"duration": 10, "actor": secondary_actor, "location": "cleaning_station", "emoji": "🧽"},
        "prepare": {"duration": 10, "actor": secondary_actor, "location": "prep_area", "emoji": "🔧"},
    }

    for i, step in enumerate(steps):
        step_text = step.get("step", f"task_{i}")
        step_lower = step_text.lower()

        # Determine task type and template
        template = {"duration": 15, "actor": primary_actor, "location": "workspace", "emoji": "⚙️"}
        for keyword, tmpl in task_templates.items():
            if keyword in step_lower:
                template = tmpl
                break

        # Create task ID
        task_name = step_text.replace(":", "").replace(" – ", " ").replace("(", "").replace(")", "").strip()
        task_name = "_".join(task_name.lower().split()[:3])  # Take first 3 words
        task_id = f"{task_name} 🔸 {template['emoji']}"

        # Calculate start time
        start_hours = current_time_minutes // 60
        start_mins = current_time_minutes % 60
        start_time_str = f"{start_hours:02d}:{start_mins:02d}"

        # Basic resource consumption/production
        consumes = {}
        produces = {}

        # Map common resources
        if "yeast" in step_lower:
            if "yeast" in resource_ids:
                consumes["yeast"] = 5
            if "activated_yeast" in resource_ids:
                produces["activated_yeast"] = 1
        elif "flour" in step_lower or "measure" in step_lower:
            if "flour" in resource_ids:
                consumes["flour"] = 0.5
            if "measured_ingredients" in resource_ids:
                produces["measured_ingredients"] = 1
        elif "mix" in step_lower:
            if "measured_ingredients" in resource_ids:
                consumes["measured_ingredients"] = 1
            if "mixed_dough" in resource_ids:
                produces["mixed_dough"] = 1
        elif "knead" in step_lower:
            if "mixed_dough" in resource_ids:
                consumes["mixed_dough"] = 1
            if "kneaded_dough" in resource_ids:
                produces["kneaded_dough"] = 1
        elif "rise" in step_lower:
            if "kneaded_dough" in resource_ids:
                consumes["kneaded_dough"] = 1
            if "risen_dough" in resource_ids:
                produces["risen_dough"] = 1
        elif "shape" in step_lower:
            if "risen_dough" in resource_ids:
                consumes["risen_dough"] = 1
            if "shaped_loaves" in resource_ids:
                produces["shaped_loaves"] = 2
        elif "bake" in step_lower:
            if "shaped_loaves" in resource_ids:
                consumes["shaped_loaves"] = 2
            if "finished_bread" in resource_ids:
                produces["finished_bread"] = 2
        elif "cool" in step_lower:
            if "finished_bread" in resource_ids:
                consumes["finished_bread"] = 2
            if "cooled_bread" in resource_ids:
                produces["cooled_bread"] = 2
        elif "clean" in step_lower:
            if "dirty_workspace" in resource_ids:
                consumes["dirty_workspace"] = 1
            if "clean_workspace" in resource_ids:
                produces["clean_workspace"] = 1
        else:
            # Default resource consumption for generic tasks
            if "clean_workspace" in resource_ids:
                consumes["clean_workspace"] = 1
            if "dirty_workspace" in resource_ids:
                produces["dirty_workspace"] = 1

        # Ensure every task has some consumption/production
        if not consumes and "clean_workspace" in resource_ids:
            consumes["clean_workspace"] = 1
        if not produces and "dirty_workspace" in resource_ids:
            produces["dirty_workspace"] = 1

        # Create task object
        task = {
            "id": task_id,
            "start": start_time_str,
            "duration": template["duration"],
            "actor_id": template["actor"],
            "location": template["location"],
            "consumes": consumes,
            "produces": produces,
            "depends_on": []
        }

        # Add simple dependencies (each task depends on previous)
        if i > 0:
            prev_task_id = tasks[i-1]["id"]
            task["depends_on"] = [prev_task_id]

        tasks.append(task)
        current_time_minutes += template["duration"]

    return tasks

def standardize_resource_names(simulation_dict: Dict[str, Any]) -> Dict[str, Any]:
    """Standardize all resource names to snake_case and fix inconsistencies."""
    import re

    # Create mapping of original names to standardized names
    resource_mapping = {}

    # Process resources
    if "resources" in simulation_dict:
        standardized_resources = []
        for resource in simulation_dict["resources"]:
            original_id = resource["id"]
            # Convert to snake_case
            standardized_id = original_id.lower().replace(" ", "_").replace("-", "_")
            # Handle camelCase conversion
            standardized_id = re.sub(r'([a-z0-9])([A-Z])', r'\1_\2', standardized_id).lower()

            resource_mapping[original_id] = standardized_id

            # Check for required fields with defaults
            unit = resource.get("unit", "units")
            starting_stock = resource.get("starting_stock", 0)

            standardized_resources.append({
                "id": standardized_id,
                "unit": unit.lower() if isinstance(unit, str) else "units",
                "starting_stock": starting_stock
            })

        simulation_dict["resources"] = standardized_resources

    # Update task resource references
    if "tasks" in simulation_dict:
        for task in simulation_dict["tasks"]:
            # Update consumes
            if "consumes" in task:
                updated_consumes = {}
                for resource_id, amount in task["consumes"].items():
                    standardized_id = resource_mapping.get(resource_id, resource_id.lower())
                    updated_consumes[standardized_id] = amount
                task["consumes"] = updated_consumes

            # Update produces
            if "produces" in task:
                updated_produces = {}
                for resource_id, amount in task["produces"].items():
                    standardized_id = resource_mapping.get(resource_id, resource_id.lower())
                    updated_produces[standardized_id] = amount
                task["produces"] = updated_produces

    return simulation_dict

def validate_simulation_logic(sim: Dict[str, Any]) -> List[str]:
    """Validate simulation logic and constraints with enhanced checks."""
    errors = []

    # Check if all actor_ids in tasks exist in actors
    actor_ids = {actor["id"] for actor in sim.get("actors", [])}
    for task in sim.get("tasks", []):
        if task.get("actor_id") not in actor_ids:
            errors.append(f"Task {task.get('id')}: Invalid actor_id {task.get('actor_id')}")

    # Check if all resource IDs in tasks exist in resources
    resource_ids = {resource["id"] for resource in sim.get("resources", [])}
    for task in sim.get("tasks", []):
        for resource in task.get("consumes", {}):
            if resource not in resource_ids:
                errors.append(f"Task {task.get('id')}: Unknown consumed resource: {resource}")
        for resource in task.get("produces", {}):
            if resource not in resource_ids:
                errors.append(f"Task {task.get('id')}: Unknown produced resource: {resource}")

    # Validate no overlapping tasks per actor
    tasks_by_actor = {}
    for task in sim.get("tasks", []):
        actor_id = task.get("actor_id")
        if actor_id not in tasks_by_actor:
            tasks_by_actor[actor_id] = []

        # Parse start time and calculate end time
        try:
            start_time = task.get("start", "00:00")
            duration = task.get("duration", 0)

            if ":" in start_time:
                hours, minutes = map(int, start_time.split(":"))
                start_minutes = hours * 60 + minutes
                end_minutes = start_minutes + duration

                tasks_by_actor[actor_id].append({
                    "id": task.get("id"),
                    "start": start_minutes,
                    "end": end_minutes
                })
        except (ValueError, TypeError):
            errors.append(f"Task {task.get('id')}: Invalid time format or duration")

    # Check for overlaps within each actor's tasks
    for actor_id, actor_tasks in tasks_by_actor.items():
        # Sort tasks by start time
        actor_tasks.sort(key=lambda x: x["start"])

        for i in range(len(actor_tasks) - 1):
            current_task = actor_tasks[i]
            next_task = actor_tasks[i + 1]

            if current_task["end"] > next_task["start"]:
                errors.append(
                    f"Actor {actor_id}: Task overlap detected between "
                    f"'{current_task['id']}' (ends at {current_task['end']//60:02d}:{current_task['end']%60:02d}) "
                    f"and '{next_task['id']}' (starts at {next_task['start']//60:02d}:{next_task['start']%60:02d})"
                )

    # Validate task dependencies
    task_ids = {task["id"] for task in sim.get("tasks", [])}
    for task in sim.get("tasks", []):
        for dep in task.get("depends_on", []):
            if dep not in task_ids:
                errors.append(f"Task {task.get('id')}: Unknown dependency: {dep}")

    # Check for temporal logic issues (consuming resources before they're produced)
    # Simple check: ensure dependencies are respected
    task_by_id = {task["id"]: task for task in sim.get("tasks", [])}
    for task in sim.get("tasks", []):
        task_start = task.get("start", "00:00")
        for dep_id in task.get("depends_on", []):
            if dep_id in task_by_id:
                dep_task = task_by_id[dep_id]
                dep_start = dep_task.get("start", "00:00")
                dep_duration = dep_task.get("duration", 0)

                # Calculate end time of dependency
                try:
                    dep_hours, dep_minutes = map(int, dep_start.split(":"))
                    dep_end_minutes = dep_hours * 60 + dep_minutes + dep_duration

                    task_hours, task_minutes = map(int, task_start.split(":"))
                    task_start_minutes = task_hours * 60 + task_minutes

                    if task_start_minutes < dep_end_minutes:
                        errors.append(f"Task {task.get('id')}: Starts before dependency {dep_id} finishes")
                except (ValueError, TypeError):
                    # Time parsing errors already caught above
                    pass

    return errors

def refine_simulation(simulation_errors: List[str], simulation_template: Dict[str, Any], tree_json: Dict[str, Any]) -> str:
    """Refine simulation based on errors with detailed structure enforcement."""

    # Get actor IDs for the refined response
    actors = simulation_template.get("actors", [])
    actor_1_id = actors[0]["id"] if len(actors) > 0 else "baker"
    actor_2_id = actors[1]["id"] if len(actors) > 1 else "assistant"

    # Get resource IDs for validation
    resource_ids = [r["id"] for r in simulation_template.get("resources", [])]

    system_prompt = f"""You are a simulation refinement expert. Fix ALL issues in the simulation JSON.

CRITICAL ERRORS TO FIX:
{chr(10).join(simulation_errors)}

CRITICAL STRUCTURAL REQUIREMENTS:
1. Return ONLY the root simulation object - NO nested 'simulation' objects
2. Do NOT duplicate any data structures
3. Use exact template structure provided

RESOURCE REQUIREMENTS:
- Available resource IDs: {', '.join(resource_ids[:15])}...
- ALL resource references must EXACTLY match these IDs (snake_case only)
- NO CamelCase or capitalized resource names

MANDATORY REQUIREMENTS FOR EVERY TASK:
1. "id": "descriptive_task_name" (clear, descriptive task identifier)
2. "start": "HH:MM" (valid 24-hour time)
3. "duration": positive_number (minutes)
4. "actor_id": "{actor_1_id}" or "{actor_2_id}" (must match template)
5. "location": "location_name"
6. "consumes": {{"resource_id": positive_number}} (not empty, exact resource IDs)
7. "produces": {{"resource_id": positive_number}} (not empty, exact resource IDs)
8. "depends_on": ["dependency_list"] (can be empty array)

CONSTRAINTS TO ENFORCE:
- Same actor cannot have overlapping tasks
- All resource IDs must exist in template
- All dependency task IDs must exist
- Resource amounts must be positive numbers
- Times must be valid HH:MM format
- Dependencies must finish before dependent tasks start

Return the complete corrected simulation JSON with NO nested objects and ALL required fields."""

    user_prompt = f"""Original Template:
{json.dumps(simulation_template, indent=2)}

Task Tree:
{json.dumps(tree_json, indent=2)}

Fix ALL the listed errors and provide a complete, valid simulation JSON with proper structure (no nested simulation objects)."""

    try:
        response = chat_with_llm("gemma3", system_prompt, user_prompt)
        return response
    except Exception as e:
        print(f"Error refining simulation: {e}")
        return ask_llm_for_schedule(simulation_template, tree_json)

def generate_simulation(tree_json: Dict[str, Any], article_metadata: Dict[str, Any], output_dir: Optional[str] = None) -> Dict[str, Any]:
    """Main function to generate simulation from task tree with enhanced validation and constraint processing."""

    max_attempts = 3

    for attempt in range(max_attempts):
        safe_print(f"Simulation generation attempt {attempt + 1}/{max_attempts}")

        # Step 1: Construct initial simulation template
        simulation_template = construct_initial_simulation(tree_json, article_metadata)

        # Step 2: Generate detailed schedule
        if attempt == 0:
            raw_schedule = ask_llm_for_schedule(simulation_template, tree_json)
        else:
            # Use refinement on subsequent attempts
            raw_schedule = refine_simulation(["Previous attempt failed validation"], simulation_template, tree_json)

        # Step 3: Parse and validate structure
        simulation_dict, parse_errors = parse_and_validate_simulation(raw_schedule)
          # Save failed attempt if there are parse errors and output_dir is provided
        if parse_errors and output_dir:
            save_failed_attempt(raw_schedule, parse_errors, attempt + 1, output_dir, "parse")

        if parse_errors:
            # Safely print errors without Unicode encoding issues
            safe_print(f"Parse errors (attempt {attempt + 1}):")
            for error in parse_errors:
                safe_print(f"  - {error}")
            if attempt < max_attempts - 1:
                continue

        if simulation_dict:
            # Step 4: Standardize resource names
            try:
                simulation_dict = standardize_resource_names(simulation_dict)
            except Exception as e:
                print(f"Error standardizing resource names (attempt {attempt + 1}): {e}")
                if output_dir:
                    save_failed_attempt(simulation_dict, [f"Standardization error: {e}"], attempt + 1, output_dir, "standardization")
                if attempt < max_attempts - 1:
                    continue
                else:
                    return None

            # Step 5: Basic validation (legacy)
            logic_errors = validate_simulation_logic(simulation_dict)

            # Save failed attempt if there are logic errors and output_dir is provided
            if logic_errors and output_dir:
                save_failed_attempt(simulation_dict, logic_errors, attempt + 1, output_dir, "logic")

            # Step 6: Enhanced constraint processing
            try:
                safe_print("Applying enhanced constraint processing...")
                constraint_processor = ConstraintProcessor()
                enhanced_simulation = constraint_processor.apply_comprehensive_constraints(simulation_dict)

                # Get validation summary
                validation_summary = constraint_processor.get_validation_summary()
                transparency_data = constraint_processor.get_transparency_data()

                safe_print(f"Constraint processing complete. Business readiness: {validation_summary['business_readiness']['level']}")

                # Return enhanced simulation with validation data
                return {
                    "simulation": enhanced_simulation,
                    "validation_summary": validation_summary,
                    "validation_transparency": transparency_data,
                    "legacy_validation_errors": logic_errors
                }

            except Exception as e:
                safe_print(f"Warning: Error in constraint processing (attempt {attempt + 1}): {e}")
                if output_dir:
                    save_failed_attempt(simulation_dict, [f"Constraint processing error: {e}"], attempt + 1, output_dir, "constraint_processing")

                # Fall back to basic validation if constraint processing fails
                if not logic_errors:
                    safe_print("Basic validation passed, using simulation without enhanced constraints")
                    return {"simulation": simulation_dict, "legacy_validation_errors": logic_errors}
                elif attempt == max_attempts - 1:
                    safe_print("CRITICAL: All attempts failed - returning incomplete simulation")
                    safe_print("This represents a system failure and should be investigated")
                    return {"simulation": simulation_dict, "legacy_validation_errors": logic_errors}
                else:
                    continue

    # CRITICAL: A fallback simulation should NEVER be used as it defeats the purpose of generating
    # task-specific simulations from the input tree. This represents a complete failure of the system.
    # The fallback below is a temporary emergency measure and should be removed once the LLM
    # generation is fixed to properly handle the input tree structure.
    safe_print("CRITICAL ERROR: Creating fallback simulation - this should never happen!")
    safe_print("The system has failed to generate a proper simulation from the input tree.")
    actors = simulation_template.get("actors", [])
    actor_1_id = actors[0]["id"] if len(actors) > 0 else "baker"
    actor_2_id = actors[1]["id"] if len(actors) > 1 else "assistant"

    fallback_simulation = {
        "time_unit": simulation_template.get("time_unit", "minute"),
        "start_time": simulation_template.get("start_time", "07:00"),
        "end_time": simulation_template.get("end_time", "18:00"),
        "actors": simulation_template.get("actors", []),
        "resources": simulation_template.get("resources", []),
        "article_title": article_metadata.get("article_title", "Breadmaking Simulation"),
        "tasks": [
            {
                "id": "prepare_workspace",
                "start": "07:00",
                "duration": 10,
                "actor_id": actor_2_id,
                "location": "prep_area",
                "consumes": {"dirty_workspace": 1},
                "produces": {"clean_workspace": 1},
                "depends_on": []
            },
            {
                "id": "measure_ingredients",
                "start": "07:00",
                "duration": 15,
                "actor_id": actor_1_id,
                "location": "prep_station",
                "consumes": {"flour": 0.5, "water": 0.3, "yeast": 10, "salt": 5},
                "produces": {"measured_ingredients": 1},
                "depends_on": []
            },
            {
                "id": "activate_yeast",
                "start": "07:10",
                "duration": 10,
                "actor_id": actor_2_id,
                "location": "prep_station",
                "consumes": {"yeast": 5, "water": 0.1, "sugar": 10},
                "produces": {"activated_yeast": 1},
                "depends_on": ["prepare_workspace"]
            },
            {
                "id": "mix_ingredients",
                "start": "07:15",
                "duration": 15,
                "actor_id": actor_1_id,
                "location": "mixing_station",
                "consumes": {"measured_ingredients": 1, "activated_yeast": 1, "clean_mixer": 1},
                "produces": {"mixed_dough": 1, "dirty_mixer": 1},
                "depends_on": ["measure_ingredients", "activate_yeast"]
            },
            {
                "id": "knead_dough",
                "start": "07:30",
                "duration": 15,
                "actor_id": actor_1_id,
                "location": "kneading_area",
                "consumes": {"mixed_dough": 1, "clean_surface": 1},
                "produces": {"kneaded_dough": 1, "dirty_surface": 1},
                "depends_on": ["mix_ingredients"]
            },
            {
                "id": "clean_mixer",
                "start": "07:20",
                "duration": 10,
                "actor_id": actor_2_id,
                "location": "cleaning_station",
                "consumes": {"dirty_mixer": 1},
                "produces": {"clean_mixer": 1},
                "depends_on": ["activate_yeast"]
            },
            {
                "id": "prepare_oven",
                "start": "07:30",
                "duration": 15,
                "actor_id": actor_2_id,
                "location": "oven_area",
                "consumes": {"cold_oven": 1},
                "produces": {"preheated_oven": 1},
                "depends_on": ["clean_mixer"]
            },
            {
                "id": "first_rise",
                "start": "07:45",
                "duration": 60,
                "actor_id": actor_1_id,
                "location": "proofing_area",
                "consumes": {"kneaded_dough": 1},
                "produces": {"risen_dough": 1},
                "depends_on": ["knead_dough"]
            },
            {
                "id": "clean_surface",
                "start": "07:45",
                "duration": 15,
                "actor_id": actor_2_id,
                "location": "cleaning_station",
                "consumes": {"dirty_surface": 1},
                "produces": {"clean_surface": 1},
                "depends_on": ["prepare_oven"]
            },
            {
                "id": "shape_loaves",
                "start": "08:45",
                "duration": 20,
                "actor_id": actor_1_id,
                "location": "shaping_area",
                "consumes": {"risen_dough": 1, "clean_surface": 1},
                "produces": {"shaped_loaves": 2, "dirty_surface": 1},
                "depends_on": ["first_rise", "clean_surface"]
            },
            {
                "id": "bake_bread",
                "start": "09:05",
                "duration": 45,
                "actor_id": actor_1_id,
                "location": "oven_area",
                "consumes": {"shaped_loaves": 2, "preheated_oven": 1},
                "produces": {"finished_bread": 2, "used_oven": 1},
                "depends_on": ["shape_loaves", "prepare_oven"]
            },
            {
                "id": "cool_bread",
                "start": "09:50",
                "duration": 30,
                "actor_id": actor_2_id,
                "location": "cooling_area",
                "consumes": {"finished_bread": 2},
                "produces": {"cooled_bread": 2},
                "depends_on": ["bake_bread"]
            }
        ]
    }

    # Apply constraint processing to fallback simulation
    try:
        safe_print("Applying constraint processing to fallback simulation...")
        constraint_processor = ConstraintProcessor()
        enhanced_fallback = constraint_processor.apply_comprehensive_constraints(fallback_simulation)

        validation_summary = constraint_processor.get_validation_summary()
        transparency_data = constraint_processor.get_transparency_data()

        return {
            "simulation": enhanced_fallback,
            "validation_summary": validation_summary,
            "validation_transparency": transparency_data,
            "fallback_used": True,
            "system_failure": True  # Mark this as a system failure
        }
    except Exception as e:
        safe_print(f"Error in fallback constraint processing: {e}")
        return {
            "simulation": fallback_simulation,
            "fallback_used": True,
            "constraint_processing_failed": True,
            "system_failure": True  # Mark this as a system failure
        }

def save_simulation_json(simulation_dict: Dict[str, Any], output_dir: str) -> str:
    """Save simulation to JSON file."""
    os.makedirs(output_dir, exist_ok=True)
    output_path = os.path.join(output_dir, "simulation.json")

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(simulation_dict, f, indent=2, ensure_ascii=True)

    return output_path

def save_failed_attempt(data: Any, errors: List[str], attempt_num: int, output_dir: str, error_type: str) -> None:
    """Save a failed simulation attempt to a JSON file for debugging purposes."""
    try:
        # Determine the output directory
        if output_dir.endswith('simulation.json'):
            # Extract directory from file path
            actual_output_dir = os.path.dirname(output_dir)
        else:
            actual_output_dir = output_dir

        # Ensure output directory exists
        os.makedirs(actual_output_dir, exist_ok=True)

        # Create filename for failed attempt
        fail_filename = f"simulation-fail{attempt_num}.json"
        fail_path = os.path.join(actual_output_dir, fail_filename)

        # Prepare the failure data
        fail_data = {
            "attempt": attempt_num,
            "error_type": error_type,
            "errors": errors,
            "timestamp": json.dumps({"timestamp": "2025-06-17"}),  # Could use actual timestamp
            "failed_data": data
        }

        # Save the failed attempt with proper encoding
        with open(fail_path, "w", encoding="utf-8") as f:
            json.dump(fail_data, f, indent=2, ensure_ascii=True)

        safe_print(f"Failed attempt {attempt_num} saved to: {fail_path}")

    except Exception as e:
        safe_print(f"Error saving failed attempt {attempt_num}: {e}")

def main():
    """
    Standalone testing function for simulation generation.
    Expects a tree JSON file as command line argument.
    """
    if len(sys.argv) < 2:
        safe_print("Usage: python simulation.py <tree_json_file> [output_dir]")
        safe_print("Example: python simulation.py ../output/breadmaking/tree.json ../output/breadmaking/")
        sys.exit(1)

    tree_file = sys.argv[1]
    output_dir = sys.argv[2] if len(sys.argv) > 2 else os.path.dirname(tree_file)

    try:
        # Load tree JSON
        safe_print(f"Loading tree from: {tree_file}")
        tree_json = load_json(tree_file)

        # Extract article metadata from tree
        metadata = tree_json.get("metadata", {})
        article_metadata = {
            "article_title": metadata.get("task", "Unknown Task"),
            "domain": "General",  # Could be enhanced to detect domain from tree content
        }
        # Generate simulation
        safe_print("Generating simulation...")
        simulation_dict = generate_simulation(tree_json, article_metadata, output_dir)

        # Check if output_dir is actually a file path ending with simulation.json
        # This happens when called from flow-maker.py
        if output_dir.endswith('simulation.json'):
            # Save directly to the specified file path
            output_path = output_dir
            os.makedirs(os.path.dirname(output_path), exist_ok=True)

            with open(output_path, "w", encoding="utf-8") as f:
                json.dump(simulation_dict, f, indent=2, ensure_ascii=True)

            safe_print(f"Simulation saved to: {output_path}")
        else:
            # Use the original save function for standalone usage
            output_path = save_simulation_json(simulation_dict, output_dir)

        safe_print(f"\nSimulation generation complete!")
        safe_print(f"Input tree: {tree_file}")
        safe_print(f"Output simulation: {output_path}")

        # Print basic stats
        sim = simulation_dict["simulation"]
        safe_print(f"\nSimulation stats:")
        safe_print(f"- Time span: {sim['start_time']} to {sim['end_time']}")
        safe_print(f"- Actors: {len(sim['actors'])}")
        safe_print(f"- Resources: {len(sim['resources'])}")
        # Handle both 'tasks' and 'steps' fields for compatibility
        if 'tasks' in sim:
            safe_print(f"- Tasks: {len(sim['tasks'])}")
        elif 'steps' in sim:
            safe_print(f"- Steps: {len(sim['steps'])} (converted to tasks)")
        else:
            safe_print("- Tasks: 0 (no tasks or steps found)")


        # Validate the final output
        parse_errors = []
        logic_errors = []
        try:
            _, parse_errors = parse_and_validate_simulation(json.dumps(simulation_dict["simulation"]))
            if not parse_errors:
                logic_errors = validate_simulation_logic(simulation_dict["simulation"])
        except Exception as e:
            parse_errors.append(f"Final validation error: {e}")

        if parse_errors or logic_errors:
            safe_print(f"\nValidation issues detected:")
            for error in parse_errors + logic_errors:
                safe_print(f"  - {error}")
        else:
            safe_print(f"\nFinal validation passed - simulation is valid!")

    except Exception as e:
        safe_print(f"Error generating simulation: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
