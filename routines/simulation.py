import json
import os
import sys
from typing import Dict, List, Tuple, Any, Optional

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from utils import chat_with_llm, parse_llm_json_response, load_json, saveToFile
import jsonschema


def load_schema_and_defaults() -> Dict[str, Any]:
    """
    Load and parse simulation_schema.json and defaults.json.
    
    Returns:
        Dict containing 'schema' and 'defaults' keys with their respective JSON data
    """
    schema_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "simulation", "simulation_schema.json")
    defaults_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "simulation", "defaults.json")
    
    try:
        # Provide fallback defaults if files don't exist
        default_schema = {
            "type": "object",
            "properties": {
                "simulation": {
                    "type": "object",
                    "properties": {
                        "time_unit": {"type": "string"},
                        "start_time": {"type": "string"},
                        "end_time": {"type": "string"},
                        "actors": {"type": "array"},
                        "resources": {"type": "array"},
                        "tasks": {"type": "array"
                        }
                    }
                }
            }
        }
        
        default_defaults = {
            "time_unit": "minute",
            "start_time": "06:00",
            "end_time": "18:00",
            "actors": [],
            "resources": [],
            "tasks": []
        }
        
        schema = default_schema
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
        # Return minimal defaults
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

Analyze the task tree and create a simulation template with:
1. Appropriate actors (workers, machines, equipment) with realistic roles, costs, and availability
2. Relevant resources (materials, ingredients, supplies) with appropriate units and starting stock
3. Suitable time window (start_time, end_time) for this type of work
4. Appropriate time_unit (second, minute, hour)

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

Make actors and resources specific to the domain (e.g., Baker for breadmaking, not Generic Worker)."""

    # Build user prompt with the task tree
    user_prompt = f"""Task: {task_name}

Task Tree Structure:
{json.dumps(tree_json, indent=2)}

Create a simulation template for this task with appropriate actors and resources."""

    try:
        response = chat_with_llm("gemma3", system_prompt, user_prompt)
        template = parse_llm_json_response(response)
        
        # Merge with defaults
        result = defaults.copy()
        result.update(template)
        
        return result
        
    except Exception as e:
        print(f"Error constructing simulation template: {e}")
        # Return basic template for breadmaking
        return {
            "time_unit": "minute",
            "start_time": "07:00",
            "end_time": "18:00",
            "actors": [
                {
                    "id": "baker_1",
                    "role": "Head Baker",
                    "cost_per_hour": 25.0,
                    "availability": [{"from": "07:00", "to": "18:00"}]
                },
                {
                    "id": "assistant_1",
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
                {"id": "clean_workspace", "unit": "units", "starting_stock": 2},
                {"id": "dirty_workspace", "unit": "units", "starting_stock": 0},
                {"id": "clean_mixer", "unit": "units", "starting_stock": 1},
                {"id": "dirty_mixer", "unit": "units", "starting_stock": 0},
                {"id": "clean_surface", "unit": "units", "starting_stock": 2},
                {"id": "dirty_surface", "unit": "units", "starting_stock": 0},
                {"id": "cold_oven", "unit": "units", "starting_stock": 1},
                {"id": "preheated_oven", "unit": "units", "starting_stock": 0},
                {"id": "used_oven", "unit": "units", "starting_stock": 0},
                {"id": "measured_ingredients", "unit": "batches", "starting_stock": 0},
                {"id": "activated_yeast", "unit": "batches", "starting_stock": 0},
                {"id": "dough", "unit": "batches", "starting_stock": 0},
                {"id": "kneaded_dough", "unit": "batches", "starting_stock": 0},
                {"id": "risen_dough", "unit": "batches", "starting_stock": 0},
                {"id": "shaped_loaves", "unit": "loaves", "starting_stock": 0},
                {"id": "finished_bread", "unit": "loaves", "starting_stock": 0}
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
    
    system_prompt = f"""You are a process scheduling expert. Given a task tree and simulation template with actors and resources, create a detailed task schedule.

CRITICAL TIME FORMAT RULES:
- ALL times must be in HH:MM format (24-hour)
- Minutes must be 00-59 (NEVER 60 or higher)
- Times must be between {start_time} and {end_time}
- If a calculation results in 60+ minutes, convert to next hour (e.g., 07:60 becomes 08:00)

RESOURCE RULES:
- consumes: Use POSITIVE numbers to indicate resource consumption
- produces: Use POSITIVE numbers to indicate resource production
- Resource IDs must exactly match those in the template
- Ensure realistic consumption amounts based on starting stock
- EVERY task must consume AND produce at least one resource (e.g., cleaning consumes "dirty_spoon" and produces "clean_spoon")
- Include intermediate resources like "dirty_equipment", "clean_equipment", "mixed_ingredients", "prepared_workspace", etc.

SCHEDULING CONSTRAINTS:
- Tasks assigned to the same actor MUST NEVER overlap in time
- Each actor can only do one task at a time
- Different actors CAN and SHOULD work simultaneously for efficiency
- Include realistic preparation and cleanup tasks
- Equipment must be cleaned between uses (e.g., "clean_mixer 🔸🧽" after mixing)
- Workspace preparation tasks should precede main tasks

REALISM REQUIREMENTS:
- Include equipment cleaning tasks between uses
- Add workspace preparation and cleanup
- Consider realistic workflow patterns (prep → work → clean → next task)
- Include safety checks and quality control tasks
- Add resource preparation tasks (e.g., "warm_water 🔸🌡️", "measure_ingredients 🔸⚖️")

TASK ID FORMAT RULES:
- Each task id must end with " 🔸[EMOJI]" where [EMOJI] is a single relevant emoji that represents the task
- Choose emojis that clearly represent the action (e.g., "mix_ingredients 🔸🥄", "bake_bread 🔸🔥", "clean_mixer 🔸🧽")
- Use only one emoji per task, choose the most representative one
- The emoji should be intuitive and help users quickly identify the task type

Generate a complete simulation JSON with tasks that:
1. Follow the logical sequence from the task tree
2. Assign realistic actors to each task with NO TIME OVERLAPS per actor
3. Include realistic timing with VALID HH:MM format
4. Show resource consumption and production with correct amounts for ALL tasks
5. Use realistic locations/stations
6. Include equipment cleaning and workspace preparation tasks
7. Maximize efficiency through parallel work by different actors
8. Include descriptive emojis in task IDs for better visualization

Return the complete simulation JSON with the tasks array populated."""

    user_prompt = f"""Task Tree:
{json.dumps(tree_json, indent=2)}

Simulation Template:
{json.dumps(simulation_template, indent=2)}

Create a complete simulation with detailed tasks. Ensure all times are valid HH:MM format and resource amounts are realistic."""

    try:
        response = chat_with_llm("gemma3", system_prompt, user_prompt)
        return response
    except Exception as e:
        print(f"Error generating schedule: {e}")
        # Return basic schedule with valid times
        return json.dumps({
            "simulation": {
                **simulation_template,
                "tasks": [
                    {
                        "id": "prepare_workspace 🔸🧹",
                        "start": "07:00",
                        "duration": 10,
                        "actor_id": simulation_template["actors"][1]["id"] if len(simulation_template.get("actors", [])) > 1 else "assistant_1",
                        "location": "Mixing Station",
                        "consumes": {"dirty_workspace": 1},
                        "produces": {"clean_workspace": 1},
                        "depends_on": []
                    },
                    {
                        "id": "measure_ingredients 🔸⚖️",
                        "start": "07:00",
                        "duration": 15,
                        "actor_id": simulation_template["actors"][0]["id"] if simulation_template.get("actors") else "baker_1",
                        "location": "Prep Station",
                        "consumes": {"flour": 0.5, "water": 0.3, "yeast": 10, "salt": 5},
                        "produces": {"measured_ingredients": 1},
                        "depends_on": []
                    },
                    {
                        "id": "activate_yeast 🔸🦠",
                        "start": "07:10",
                        "duration": 10,
                        "actor_id": simulation_template["actors"][1]["id"] if len(simulation_template.get("actors", [])) > 1 else "assistant_1",
                        "location": "Prep Station",
                        "consumes": {"yeast": 5, "water": 0.1, "sugar": 10},
                        "produces": {"activated_yeast": 1},
                        "depends_on": ["prepare_workspace 🔸🧹"]
                    },
                    {
                        "id": "mix_ingredients 🔸🥄",
                        "start": "07:15",
                        "duration": 15,
                        "actor_id": simulation_template["actors"][0]["id"] if simulation_template.get("actors") else "baker_1",
                        "location": "Mixing Station",
                        "consumes": {"measured_ingredients": 1, "activated_yeast": 1, "clean_workspace": 1},
                        "produces": {"dough": 1, "dirty_mixer": 1},
                        "depends_on": ["measure_ingredients 🔸⚖️", "activate_yeast 🔸🦠"]
                    },
                    {
                        "id": "clean_mixer 🔸🧽",
                        "start": "07:20",
                        "duration": 10,
                        "actor_id": simulation_template["actors"][1]["id"] if len(simulation_template.get("actors", [])) > 1 else "assistant_1",
                        "location": "Cleaning Station",
                        "consumes": {"dirty_mixer": 1},
                        "produces": {"clean_mixer": 1},
                        "depends_on": ["activate_yeast 🔸🦠"]
                    },
                    {
                        "id": "knead_dough 🔸👐",
                        "start": "07:30",
                        "duration": 15,
                        "actor_id": simulation_template["actors"][0]["id"] if simulation_template.get("actors") else "baker_1",
                        "location": "Kneading Area",
                        "consumes": {"dough": 1},
                        "produces": {"kneaded_dough": 1, "dirty_surface": 1},
                        "depends_on": ["mix_ingredients 🔸🥄"]
                    },
                    {
                        "id": "clean_surface 🔸🧽",
                        "start": "07:30",
                        "duration": 15,
                        "actor_id": simulation_template["actors"][1]["id"] if len(simulation_template.get("actors", [])) > 1 else "assistant_1",
                        "location": "Cleaning Station",
                        "consumes": {"dirty_surface": 1},
                        "produces": {"clean_surface": 1},
                        "depends_on": ["clean_mixer 🔸🧽"]
                    },
                    {
                        "id": "prepare_oven 🔸🔥",
                        "start": "07:45",
                        "duration": 15,
                        "actor_id": simulation_template["actors"][1]["id"] if len(simulation_template.get("actors", [])) > 1 else "assistant_1",
                        "location": "Oven Area",
                        "consumes": {"cold_oven": 1},
                        "produces": {"preheated_oven": 1},
                        "depends_on": ["clean_surface 🔸🧽"]
                    },
                    {
                        "id": "first_rise 🔸⏰",
                        "start": "07:45",
                        "duration": 60,
                        "actor_id": simulation_template["actors"][0]["id"] if simulation_template.get("actors") else "baker_1",
                        "location": "Proofing Area",
                        "consumes": {"kneaded_dough": 1},
                        "produces": {"risen_dough": 1},
                        "depends_on": ["knead_dough 🔸👐"]
                    },
                    {
                        "id": "shape_loaves 🔸🖐️",
                        "start": "08:45",
                        "duration": 20,
                        "actor_id": simulation_template["actors"][0]["id"] if simulation_template.get("actors") else "baker_1",
                        "location": "Shaping Area",
                        "consumes": {"risen_dough": 1},
                        "produces": {"shaped_loaves": 2, "dirty_surface": 1},
                        "depends_on": ["first_rise 🔸⏰"]
                    },
                    {
                        "id": "clean_workspace_final 🔸🧹",
                        "start": "08:00",
                        "duration": 20,
                        "actor_id": simulation_template["actors"][1]["id"] if len(simulation_template.get("actors", [])) > 1 else "assistant_1",
                        "location": "General Area",
                        "consumes": {"dirty_surface": 1},
                        "produces": {"clean_workspace": 1},
                        "depends_on": ["prepare_oven 🔸🔥"]
                    },
                    {
                        "id": "bake_bread 🔸🔥",
                        "start": "09:05",
                        "duration": 45,
                        "actor_id": simulation_template["actors"][0]["id"] if simulation_template.get("actors") else "baker_1",
                        "location": "Oven Area",
                        "consumes": {"shaped_loaves": 2, "preheated_oven": 1},
                        "produces": {"finished_bread": 2, "used_oven": 1},
                        "depends_on": ["shape_loaves 🔸🖐️", "prepare_oven 🔸🔥"]
                    },
                    {
                        "id": "cool_bread 🔸❄️",
                        "start": "09:50",
                        "duration": 30,
                        "actor_id": simulation_template["actors"][1]["id"] if len(simulation_template.get("actors", [])) > 1 else "assistant_1",
                        "location": "Cooling Area",
                        "consumes": {"finished_bread": 2},
                        "produces": {"cooled_bread": 2},
                        "depends_on": ["bake_bread 🔸🔥"]
                    }
                ]
            }
        }, indent=2)

def parse_and_validate_simulation(raw_json_str: str) -> Tuple[Optional[Dict[str, Any]], List[str]]:
    """Parse and validate simulation JSON response."""
    errors = []
    
    try:
        simulation_dict = parse_llm_json_response(raw_json_str)
        
        # Basic validation
        if "simulation" not in simulation_dict:
            errors.append("Missing 'simulation' key")
            return None, errors
            
        sim = simulation_dict["simulation"]
        
        # Validate required fields
        required_fields = ["time_unit", "start_time", "end_time", "actors", "resources", "tasks"]
        for field in required_fields:
            if field not in sim:
                errors.append(f"Missing required field: {field}")
        
        # Validate tasks have required fields
        for i, task in enumerate(sim.get("tasks", [])):
            task_required = ["id", "start", "duration", "actor_id"]
            for field in task_required:
                if field not in task:
                    errors.append(f"Task {i}: Missing required field: {field}")
        
        return simulation_dict, errors
        
    except Exception as e:
        errors.append(f"JSON parsing error: {e}")
        return None, errors

def validate_simulation_logic(sim: Dict[str, Any]) -> List[str]:
    """Validate simulation logic and constraints."""
    errors = []
    
    # Check if all actor_ids in tasks exist in actors
    actor_ids = {actor["id"] for actor in sim.get("actors", [])}
    for task in sim.get("tasks", []):
        if task.get("actor_id") not in actor_ids:
            errors.append(f"Task {task.get('id')}: Invalid actor_id {task.get('actor_id')}")
    
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
            errors.append(f"Task {task.get('id')}: Invalid time format")
    
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
    
    # Validate resource consumption/production
    for task in sim.get("tasks", []):
        consumes = task.get("consumes", {})
        produces = task.get("produces", {})
        
        if not consumes and not produces:
            errors.append(f"Task {task.get('id')}: Must consume and/or produce at least one resource")
        elif not consumes:
            errors.append(f"Task {task.get('id')}: Must consume at least one resource")
        elif not produces:
            errors.append(f"Task {task.get('id')}: Must produce at least one resource")
    
    return errors

def refine_simulation(simulation_errors: List[str], simulation_template: Dict[str, Any], tree_json: Dict[str, Any]) -> str:
    """Refine simulation based on errors."""
    
    system_prompt = """You are a simulation refinement expert. Fix the issues in the simulation JSON based on the provided errors.

CRITICAL CONSTRAINTS TO ENFORCE:
- Tasks assigned to the same actor MUST NOT overlap in time
- Each actor can only do one task at a time
- All tasks must consume AND produce at least one resource
- Include realistic cleaning and preparation tasks
- Ensure proper workflow sequencing

Return a corrected simulation JSON that addresses all the errors listed and enforces these constraints."""

    user_prompt = f"""Errors to fix:
{chr(10).join(simulation_errors)}

Original Template:
{json.dumps(simulation_template, indent=2)}

Task Tree:
{json.dumps(tree_json, indent=2)}

Provide a corrected simulation JSON."""

    try:
        response = chat_with_llm("gemma3", system_prompt, user_prompt)
        return response
    except Exception as e:
        print(f"Error refining simulation: {e}")
        return ask_llm_for_schedule(simulation_template, tree_json)

def generate_simulation(tree_json: Dict[str, Any], article_metadata: Dict[str, Any]) -> Dict[str, Any]:
    """Main function to generate simulation from task tree."""
    
    # Step 1: Construct initial simulation template
    simulation_template = construct_initial_simulation(tree_json, article_metadata)
    
    # Step 2: Generate detailed schedule
    raw_schedule = ask_llm_for_schedule(simulation_template, tree_json)
    
    # Step 3: Parse and validate
    simulation_dict, parse_errors = parse_and_validate_simulation(raw_schedule)
    
    if parse_errors:
        print(f"Parse errors: {parse_errors}")
        # Try to refine
        raw_schedule = refine_simulation(parse_errors, simulation_template, tree_json)
        simulation_dict, parse_errors = parse_and_validate_simulation(raw_schedule)
    
    if simulation_dict:
        # Step 4: Validate logic
        logic_errors = validate_simulation_logic(simulation_dict["simulation"])
        
        if logic_errors:
            print(f"Logic errors: {logic_errors}")
            # Try to refine again
            raw_schedule = refine_simulation(logic_errors, simulation_template, tree_json)
            simulation_dict, _ = parse_and_validate_simulation(raw_schedule)
    
    if not simulation_dict:
        print("Failed to generate valid simulation, using fallback")
        # Use fallback
        simulation_dict = {
            "simulation": {
                **simulation_template,
                "article_title": article_metadata.get("article_title", "Process Simulation"),
                "tasks": [
                    {
                        "id": "mix_ingredients",
                        "start": "07:00",
                        "duration": 15,
                        "actor_id": simulation_template["actors"][0]["id"] if simulation_template.get("actors") else "worker_1",
                        "location": "Mixing Station",
                        "consumes": {"flour": 5, "water": 3} if simulation_template.get("resources") else {},
                        "produces": {"dough": 1}
                    }
                ]
            }
        }
    
    return simulation_dict

def save_simulation_json(simulation_dict: Dict[str, Any], output_dir: str) -> str:
    """Save simulation to JSON file."""
    os.makedirs(output_dir, exist_ok=True)
    output_path = os.path.join(output_dir, "simulation.json")
    
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(simulation_dict, f, indent=2, ensure_ascii=False)
    
    return output_path

def main():
    """
    Standalone testing function for simulation generation.
    Expects a tree JSON file as command line argument.
    """
    if len(sys.argv) < 2:
        print("Usage: python simulation.py <tree_json_file> [output_dir]")
        print("Example: python simulation.py ../output/breadmaking/tree.json ../output/breadmaking/")
        sys.exit(1)
    
    tree_file = sys.argv[1]
    output_dir = sys.argv[2] if len(sys.argv) > 2 else os.path.dirname(tree_file)
    
    try:
        # Load tree JSON
        print(f"Loading tree from: {tree_file}")
        tree_json = load_json(tree_file)
        
        # Extract article metadata from tree
        metadata = tree_json.get("metadata", {})
        article_metadata = {
            "article_title": metadata.get("task", "Unknown Task"),
            "domain": "General",  # Could be enhanced to detect domain from tree content
        }
        
        # Generate simulation
        simulation_dict = generate_simulation(tree_json, article_metadata)
        
        # Check if output_dir is actually a file path ending with simulation.json
        # This happens when called from flow-maker.py
        if output_dir.endswith('simulation.json'):
            # Save directly to the specified file path
            output_path = output_dir
            os.makedirs(os.path.dirname(output_path), exist_ok=True)
            
            with open(output_path, "w", encoding="utf-8") as f:
                json.dump(simulation_dict, f, indent=2, ensure_ascii=False)
            
            print(f"Simulation saved to: {output_path}")
        else:
            # Use the original save function for standalone usage
            output_path = save_simulation_json(simulation_dict, output_dir)
        
        print(f"\nSimulation generation complete!")
        print(f"Input tree: {tree_file}")
        print(f"Output simulation: {output_path}")
        
        # Print basic stats
        sim = simulation_dict["simulation"]
        print(f"\nSimulation stats:")
        print(f"- Time window: {sim['start_time']} to {sim['end_time']}")
        print(f"- Actors: {len(sim['actors'])}")
        print(f"- Resources: {len(sim['resources'])}")
        print(f"- Tasks: {len(sim['tasks'])}")
        
    except Exception as e:
        print(f"Error generating simulation: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
