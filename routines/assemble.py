import json
import os
import sys
from pathlib import Path
from jinja2 import Environment, FileSystemLoader, select_autoescape
from datetime import datetime
import re # Ensure re is imported at the top level
from typing import Dict, Any, Optional

# Define Core Personas
CORE_PERSONAS = ['hobbyist', 'researcher', 'investor', 'educator', 'field_expert'] # List of slugs
DEFAULT_PERSONA = 'hobbyist'

# Dictionary for persona display names, to be passed to the template
CORE_PERSONAS_DICT = {
    slug: slug.replace('_', ' ').capitalize() for slug in CORE_PERSONAS
}
# This creates:
# {
#     "hobbyist": "Hobbyist",
#     "researcher": "Researcher",
#     "investor": "Investor",
#     "educator": "Educator",
#     "field_expert": "Field Expert"
# }


def read_json_file(file_path, is_critical=True):
    """Read a JSON file and return its contents as a Python dictionary."""
    try:
        with open(file_path, 'r', encoding='utf-8') as file:
            return json.load(file)
    except FileNotFoundError:
        if is_critical:
            print(f"Error: Critical file not found - {file_path}", file=sys.stderr)
            sys.exit(1)
        else:
            print(f"Warning: Optional file not found - {file_path}", file=sys.stderr)
            return {} # Return empty dict for optional files
    except json.JSONDecodeError as e:
        if is_critical:
            print(f"Error: Failed to decode JSON from {file_path} - {e}", file=sys.stderr)
            sys.exit(1)
        else:
            print(f"Warning: Failed to decode JSON from {file_path} - {e}", file=sys.stderr)
            return {} # Return empty dict for optional files with bad JSON
    except Exception as e:
        if is_critical:
            print(f"Error: An unexpected error occurred while reading {file_path} - {e}", file=sys.stderr)
            sys.exit(1)
        else:
            print(f"Warning: An unexpected error occurred while reading {file_path} - {e}", file=sys.stderr)
            return {}

# Mapping from id_suffix to the keys in metrics.json's "sections" object
SECTION_ID_SUFFIX_TO_METRICS_KEY_MAP = {
    "process-steps": "2.json",
    "timeline": "3.json",
    "challenges": "4.json",
    "adoption-framework": "5.json",
    "implementation-levels": "6.json",
    "roi-analysis": "7.json",
    "automation-technologies": "8.json",
    "technical-specifications": "9.json",
    # "alternative-approaches-intro": None, # Or a specific key if metrics are defined
    # "alternative-approaches-grid": None,
    # "why-multiple-approaches": None,
}

def get_section_metrics_and_relevance(id_suffix, article_metrics_data, metric_definitions_data):
    """
    Gathers metrics and relevance for a specific section based on its id_suffix,
    expecting an 'is_relevant' flag and a nested 'metrics' object in article_metrics_data.
    Returns a dictionary containing:
        - relevant_personas_list: List of persona slugs for which this section is relevant.
        - metrics_data_for_section_json: JSON string of detailed metrics for the modal.
    """
    relevant_personas_list = []
    detailed_metrics_for_modal_by_persona = {}

    metrics_key_for_file = SECTION_ID_SUFFIX_TO_METRICS_KEY_MAP.get(id_suffix)
    
    section_metrics_content_from_file = {} # This will hold the content of e.g. "2.json"
    if metrics_key_for_file and article_metrics_data.get("sections"):
        section_metrics_content_from_file = article_metrics_data["sections"].get(metrics_key_for_file, {})

    # Use the slugs for internal logic
    for persona_slug in CORE_PERSONAS: # Use the list of slugs
        # Get the persona-specific block (e.g., content of "hobbyist" under "2.json")
        persona_data_block = section_metrics_content_from_file.get(persona_slug, {})
        
        # Read the relevance flag and reasoning
        # flow-maker.py now saves "is_relevant_to_persona" and "relevance_reasoning"
        is_relevant_for_persona = persona_data_block.get("is_relevant_to_persona", False)
        relevance_reasoning = persona_data_block.get("relevance_reasoning", "No reasoning provided.")
        
        # evaluated_metrics is now a list of objects from flow-maker.py
        # Each object should have: "id", "name", "passed", "description"
        evaluated_metrics_list = persona_data_block.get("evaluated_metrics", [])
        
        if is_relevant_for_persona:
            if persona_slug not in relevant_personas_list:
                relevant_personas_list.append(persona_slug)
            # No need to iterate and build evaluated_metrics_list here anymore,
            # as flow-maker.py should have already structured it correctly.
            # We just need to ensure the structure is what the modal expects.
            # The modal expects: name, passed, description.
            # flow-maker now provides: id, name, passed, description. This is compatible.

        detailed_metrics_for_modal_by_persona[persona_slug] = {
            "is_relevant_to_persona": is_relevant_for_persona,
            "relevance_reasoning": relevance_reasoning, # Add the reasoning here
            "evaluated_metrics": evaluated_metrics_list # Use the pre-structured list
        }
    
    return {
        "relevant_personas_list": relevant_personas_list,
        "metrics_data_for_section_json": json.dumps(detailed_metrics_for_modal_by_persona)
    }

def process_bold_text(text):
    """Replace text surrounded by ** with HTML bold tags."""
    # Find all text surrounded by ** and replace with <strong> tags
    return re.sub(r'\*\*(.*?)\*\*', r'<strong>\1</strong>', text)

def generate_tree_preview_text(tree_data):
    """Generate a text representation of a tree suitable for the approach preview."""
    # Use the first level (root) and second level (main steps) of the tree for the preview
    root_name = tree_data.get("tree", {}).get("step", "approach_root").lower().replace(" ", "_")
    
    # Start with the root node
    lines = [root_name]
    
    # Add child nodes with ASCII art tree structure
    children = tree_data.get("tree", {}).get("children", [])
    for i, child in enumerate(children):
        # Get a shortened UUID to use in the preview
        uuid_part = child.get("uuid", "")[:4] if "uuid" in child else str(i)
        
        child_step = child.get("step", "step").lower().replace(" ", "_")
        # Make the child step name and uuid shorter for the preview
        child_name = f"{child_step}_{uuid_part}"
        
        # Last child has a different prefix
        if i == len(children) - 1:
            lines.append(f"└── {child_name}")
        else:
            lines.append(f"├── {child_name}")
        
        # Add grandchildren for this child with proper indentation
        grandchildren = child.get("children", [])
        for j, grandchild in enumerate(grandchildren):
            # Get a shortened UUID for the grandchild
            g_uuid_part = grandchild.get("uuid", "")[:4] if "uuid" in grandchild else str(j)
            
            g_step = grandchild.get("step", "substep").lower().replace(" ", "_")
            # Make the grandchild step name and uuid shorter for the preview
            g_name = f"{g_step}_{g_uuid_part}"
            
            # Use different prefixes based on whether this is the last child and last grandchild
            if i == len(children) - 1:  # Last child
                if j == len(grandchildren) - 1:  # Last grandchild
                    lines.append(f"    └── {g_name}")
                else:
                    lines.append(f"    ├── {g_name}")
            else:  # Not last child
                if j == len(grandchildren) - 1:  # Last grandchild
                    lines.append(f"│   └── {g_name}")
                else:
                    lines.append(f"│   ├── {g_name}")
                    
            # Limit the preview to a reasonable size
            if j >= 2 and len(grandchildren) > 4:
                lines.append(f"│   └── ... ({len(grandchildren) - 3} more steps)")
                break
        
        # Limit the preview to a reasonable number of main steps
        if i >= 2 and len(children) > 4:
            lines.append(f"└── ... ({len(children) - 3} more steps)")
            break
    
    return "\n".join(lines)

def process_metadata(metadata, breadcrumb_str):
    """Process metadata, add contributors/date, and incorporate breadcrumbs."""
    result = metadata.get('page_metadata', {})

    # Handle progress percentage
    progress_text = None
    if 'percentage_progress' in result:
        progress_text = result['percentage_progress']
    elif 'automation_progress' in result:
        progress_text = result['automation_progress']
    elif 'progress_percentage' in result:
        progress_text = result['progress_percentage']
    elif 'progress_estimate' in result:
        progress_text = result['progress_percentage']
    else:
        progress_text = "0%"  # Default fallback

    # Extract numeric value from progress text (handle percentage strings)
    try:
        if isinstance(progress_text, str):
            # Remove % symbol and any other non-numeric characters except digits
            numeric_part = ''.join(filter(str.isdigit, progress_text))
            result['progress_percentage'] = int(numeric_part) if numeric_part else 0
        else:
            result['progress_percentage'] = int(progress_text)
    except (ValueError, TypeError):
        result['progress_percentage'] = 0 # Fallback if conversion fails

    # Process summary: Use 'explanatory_text' as fallback for 'summary'
    summary_content = result.get('summary', result.get('explanatory_text'))

    if summary_content:
        # Ensure summary is a list of strings (paragraphs)
        if isinstance(summary_content, str):
            # Split string by double newlines to get paragraphs, stripping whitespace
            result['summary_paragraphs'] = [p.strip() for p in summary_content.split('\n\n') if p.strip()]
        elif isinstance(summary_content, list):
            # Assume it's already a list of paragraphs (strings)
            result['summary_paragraphs'] = [str(p).strip() for p in summary_content if str(p).strip()]
        else:
            result['summary_paragraphs'] = [] # Fallback for unexpected types
    else:
        result['summary_paragraphs'] = []

    # Ensure other required fields have defaults if missing
    result.setdefault('title', 'Untitled Page')
    result.setdefault('subtitle', '')
    # Use 'automation_status' as fallback for 'status'
    result.setdefault('status', result.get('automation_status', 'Unknown'))
    result.setdefault('contributors', 'N/A')
    # Set standard contributors text
    result['contributors'] = "This workflow was developed using Iterative AI analysis with input from subject matter experts and automation engineers."

    # Set last updated date
    now = datetime.now()
    result['last_updated'] = now.strftime("%B %d, %Y") # e.g., April 23, 2025

    # Add breadcrumb string read from file
    result['breadcrumbs_str'] = breadcrumb_str # Store the raw string

    # Ensure explanatory_text is a string
    if 'explanatory_text' in result and not isinstance(result['explanatory_text'], str):
        result['explanatory_text'] = str(result['explanatory_text'])
    elif 'explanatory_text' not in result:
        result['explanatory_text'] = result.get('summary', '') # Fallback to summary if explanatory_text is missing

    # Generate and store slug
    slug_base = result.get('title', 'untitled').lower().replace(' ', '-')
    result['slug'] = "".join(c for c in slug_base if c.isalnum() or c in ('-', '_')).rstrip() or "untitled-page"

    return result

def process_breadcrumbs(breadcrumbs_str):
    """Process breadcrumbs string into a list of dictionaries with names and URLs."""
    if not breadcrumbs_str:
        return []

    parts = [part for part in breadcrumbs_str.strip('/').split('/') if part]
    result = []
    current_path = ""

    # Add Home breadcrumb
    result.append({'name': 'Home', 'url': '/'})

    for i, part in enumerate(parts):
        # Build cumulative path, ensuring no double slashes
        current_path = f"{current_path}/{part}".replace('//', '/')
        display_name = part.replace('-', ' ').title()

        # Determine URL
        url = f"{current_path}/" if i < len(parts) - 1 else None

        result.append({
            'name': display_name,
            'url': url
        })

    return result

def get_transparency_data_for_section(id_suffix, files_dir_path):
    """
    Get transparency data for a specific section based on the section-to-step mapping.
    Returns a dictionary with input and output data for the transparency modal.
    """
    # Section to step mapping (same as in main.js)
    section_step_map = {
        'process-steps': '2',
        'timeline': '3',
        'challenges': '4',
        'adoption-framework': '5',
        'implementation-levels': '6',
        'roi-analysis': '7',
        'automation-technologies': '8',
        'technical-specifications': '9'
    }
    
    step_id = section_step_map.get(id_suffix)
    if not step_id:
        return None
    
    try:
        # Load step data
        step_path = os.path.join(files_dir_path, f"{step_id}.json")
        step_data = read_json_file(step_path, is_critical=False)
        
        if not step_data:
            return None
        
        # Extract input data from the step's input key (contains actual LLM prompts)
        input_data = step_data.get('input', {})
        
        # Filter out 'input' and 'process_metadata' keys from step_data to create output
        output_data = {}
        for key, value in step_data.items():
            if key not in ['input', 'process_metadata']:
                output_data[key] = value
        
        return {
            'input': input_data,
            'output': output_data
        }
    
    except Exception as e:
        print(f"Warning: Could not load transparency data for section {id_suffix}: {e}", file=sys.stderr)
        return None

def load_expanded_tree_data(files_dir_path: str) -> Optional[Dict[str, Any]]:
    """
    Load expanded tree data from expanded-tree.json in the files directory.
    
    Args:
        files_dir_path: Path to the directory containing expanded-tree.json
        
    Returns:
        Processed expanded tree data ready for template rendering, or None if not found
    """
    expanded_tree_path = os.path.join(files_dir_path, "expanded-tree.json")
    
    if not os.path.exists(expanded_tree_path):
        print(f"No expanded-tree.json found at {expanded_tree_path}")
        return None
    
    try:
        with open(expanded_tree_path, "r", encoding="utf-8") as f:
            expanded_tree_data = json.load(f)
        
        print(f"Loaded expanded-tree.json with keys: {list(expanded_tree_data.keys())}")
        
        # Extract the tree object
        tree = expanded_tree_data.get("tree", {})
        metadata = expanded_tree_data.get("metadata", {})
        
        if not tree:
            print("No 'tree' key found in expanded-tree.json")
            return None
        
        print(f"Tree object has keys: {list(tree.keys())}")
        
        # Process the tree to add indentation levels for rendering
        def process_tree_node(node, level=0):
            """Recursively process tree nodes to add indentation levels."""
            processed_node = node.copy()
            processed_node["indentation_level"] = level
            processed_node["indentation_tabs"] = "\t" * level  # For CSS/styling
            processed_node["indentation_class"] = f"indent-{level}"  # CSS class for indentation
            
            if "children" in processed_node and processed_node["children"]:
                processed_children = []
                for child in processed_node["children"]:
                    processed_children.append(process_tree_node(child, level + 1))
                processed_node["children"] = processed_children
            
            return processed_node
        
        # Process the root tree
        processed_tree = process_tree_node(tree, 0)
        
        # Build the processed expanded tree data
        processed_expanded_tree = {
            "metadata": metadata,
            "tree": processed_tree,
            "original_leaf_count": metadata.get("original_leaf_count", 0),
            "expanded_leaf_count": metadata.get("expanded_leaf_count", 0),
            "expansion_model": metadata.get("expansion_model", "unknown"),
            "expansion_date": metadata.get("expansion_date", "unknown")
        }
        
        print(f"Processed expanded tree data with {processed_expanded_tree.get('expanded_leaf_count', 0)} expanded leaves")
        return processed_expanded_tree
        
    except Exception as e:
        print(f"Error loading expanded tree data: {e}")
        import traceback
        traceback.print_exc()
        return None

def load_simulation_data(files_dir_path: str) -> Optional[Dict[str, Any]]:
    """
    Load simulation data from simulation.json in the files directory.
    
    Args:
        files_dir_path: Path to the directory containing simulation.json
        
    Returns:
        Processed simulation data ready for template rendering, or None if not found
    """
    simulation_path = os.path.join(files_dir_path, "simulation.json")
    
    if not os.path.exists(simulation_path):
        print(f"No simulation.json found at {simulation_path}")
        return None
    
    try:
        with open(simulation_path, "r", encoding="utf-8") as f:
            simulation_data = json.load(f)
        
        print(f"Loaded simulation.json with keys: {list(simulation_data.keys())}")
        
        # Extract the simulation object
        sim = simulation_data.get("simulation", {})
        
        if not sim:
            print("No 'simulation' key found in simulation.json")
            return None
        
        print(f"Simulation object has keys: {list(sim.keys())}")
        
        # Convert time strings to minutes for easier JavaScript processing
        start_time = sim.get("start_time", "06:00")
        end_time = sim.get("end_time", "18:00")
        
        start_hour, start_min = map(int, start_time.split(':'))
        end_hour, end_min = map(int, end_time.split(':'))
        
        start_time_minutes = start_hour * 60 + start_min
        end_time_minutes = end_hour * 60 + end_min
        
        # Process tasks to include computed timing information
        processed_tasks = []
        for task in sim.get("tasks", []):
            task_start = task.get("start", "00:00")
            
            # Handle time format issues (some tasks might have invalid times like "07:60")
            try:
                if ':' in task_start:
                    time_parts = task_start.split(':')
                    task_hour = int(time_parts[0])
                    task_min = int(time_parts[1])
                    
                    # Fix invalid minutes (60+ minutes should roll over to next hour)
                    if task_min >= 60:
                        additional_hours = task_min // 60
                        task_hour += additional_hours
                        task_min = task_min % 60
                        
                    task_start_minutes = task_hour * 60 + task_min
                else:
                    # If no colon, assume it's already in minutes or invalid
                    task_start_minutes = start_time_minutes
                    
            except (ValueError, IndexError):
                # If time parsing fails, default to start time
                task_start_minutes = start_time_minutes
                print(f"Warning: Invalid start time '{task_start}' for task {task.get('id')}, using default")
                
            task_duration = task.get("duration", 0)
            task_end_minutes = task_start_minutes + task_duration
            
            processed_task = task.copy()
            processed_task["start_minutes"] = task_start_minutes
            processed_task["end_minutes"] = task_end_minutes
            
            # Extract emoji from task ID for enhanced visualization
            task_id = task.get("id", "")
            if "🔸" in task_id:
                # Split the task name and emoji
                parts = task_id.split("🔸", 1)
                if len(parts) == 2:
                    task_name, emoji_part = parts
                    processed_task["display_name"] = task_name.strip()
                    processed_task["emoji"] = emoji_part.strip()
                else:
                    # Fallback if split doesn't work as expected
                    processed_task["display_name"] = task_id
                    processed_task["emoji"] = "⚙️"
            else:
                # No emoji found, use the full ID as display name
                processed_task["display_name"] = task_id
                processed_task["emoji"] = "⚙️"  # Default emoji for tasks without emojis
            
            # Calculate percentages for timeline visualization
            total_duration = end_time_minutes - start_time_minutes
            if total_duration > 0:
                processed_task["start_percentage"] = ((task_start_minutes - start_time_minutes) / total_duration) * 100
                processed_task["duration_percentage"] = (task_duration / total_duration) * 100
            else:
                processed_task["start_percentage"] = 0
                processed_task["duration_percentage"] = 0
            
            processed_tasks.append(processed_task)
        
        # Calculate actor workloads for efficiency analysis
        actor_workloads = {}
        total_available_time = end_time_minutes - start_time_minutes
        
        for task in processed_tasks:
            actor_id = task.get("actor_id")
            duration = task.get("duration", 0)
            
            if actor_id not in actor_workloads:
                actor_workloads[actor_id] = 0
            actor_workloads[actor_id] += duration
        
        # Add utilization percentages to actors
        processed_actors = []
        for actor in sim.get("actors", []):
            actor_copy = actor.copy()
            actor_id = actor["id"]
            workload = actor_workloads.get(actor_id, 0)
            utilization = (workload / total_available_time) * 100 if total_available_time > 0 else 0
            actor_copy["utilization_percentage"] = round(utilization, 1)
            actor_copy["total_work_minutes"] = workload
            processed_actors.append(actor_copy)
        
        # Build the processed simulation data
        processed_simulation = {
            "time_unit": sim.get("time_unit", "minute"),
            "start_time": start_time,
            "end_time": end_time,
            "start_time_minutes": start_time_minutes,
            "end_time_minutes": end_time_minutes,
            "total_duration_minutes": end_time_minutes - start_time_minutes,
            "actors": processed_actors,
            "resources": sim.get("resources", []),
            "tasks": processed_tasks,
            "article_title": sim.get("article_title", "Process Simulation"),
            "domain": sim.get("domain", "General")
        }
        
        print(f"Processed simulation data: {len(processed_tasks)} tasks, {len(processed_actors)} actors, {len(sim.get('resources', []))} resources")
        return processed_simulation
        
    except Exception as e:
        print(f"Error loading simulation data: {e}")
        import traceback
        traceback.print_exc()
        return None

def main():
    # Correct argument check: script name + 2 arguments = 3
    if len(sys.argv) != 3:
        print("Usage: python assemble.py <files_dir> <output_dir>")
        sys.exit(1)

    files_dir_path = sys.argv[1] # This should be the directory path, e.g., flow/ce6c090c...
    output_dir = sys.argv[2]

    # Correct path derivation: JSON files are directly inside files_dir_path
    metadata_path = os.path.join(files_dir_path, "1.json")
    tree_path = os.path.join(files_dir_path, "2.json")
    timeline_path = os.path.join(files_dir_path, "3.json")
    challenges_path = os.path.join(files_dir_path, "4.json")
    adoption_path = os.path.join(files_dir_path, "5.json")
    implementation_path = os.path.join(files_dir_path, "6.json")
    roi_path = os.path.join(files_dir_path, "7.json")
    future_tech_path = os.path.join(files_dir_path, "8.json")
    specs_path = os.path.join(files_dir_path, "9.json")

    try:
        # --- Load Core Data Files ---
        metadata_raw = read_json_file(metadata_path, is_critical=True)
        
        # --- Load Simulation Data ---
        simulation_data = load_simulation_data(files_dir_path)
        if simulation_data:
            print("Simulation data loaded successfully")
        else:
            print("No simulation data available for this flow")
        
        # --- Load Expanded Tree Data ---
        expanded_tree_data = load_expanded_tree_data(files_dir_path)
        if expanded_tree_data:
            print("Expanded tree data loaded successfully")
        else:
            print("No expanded tree data available for this flow")
        
        # --- Load Metrics Data ---
        # Article-specific metrics
        article_metrics_path = os.path.join(files_dir_path, "metrics.json")
        article_metrics_data = read_json_file(article_metrics_path, is_critical=False) # Not critical if missing, sections default to not relevant
        if not article_metrics_data:
            print(f"Warning: Article metrics file not found or empty at {article_metrics_path}. Sections may not display correctly.", file=sys.stderr)

        # Global metric definitions
        # Assuming 'metrics/definitions.json' is relative to the project root (where templates/ and routines/ are)
        project_root = Path(__file__).resolve().parent.parent
        metric_definitions_path = project_root / "metrics" / "definitions.json"
        metric_definitions_data = read_json_file(metric_definitions_path, is_critical=True)


        # --- Load Content Data Files (Optional, with fallbacks) ---
        tree_data = read_json_file(tree_path, is_critical=False)
        timeline_data = read_json_file(timeline_path, is_critical=False)
        challenges_data = read_json_file(challenges_path, is_critical=False)
        adoption_data = read_json_file(adoption_path, is_critical=False)
        implementation_data = read_json_file(implementation_path, is_critical=False)
        roi_data = read_json_file(roi_path, is_critical=False)
        future_tech_data = read_json_file(future_tech_path, is_critical=False)
        specs_data = read_json_file(specs_path, is_critical=False)

        # --- Read Breadcrumbs File ---
        breadcrumb_file_path = os.path.join(files_dir_path, "breadcrumbs.txt")
        breadcrumb_string = ""
        if os.path.exists(breadcrumb_file_path):
            try:
                with open(breadcrumb_file_path, 'r', encoding='utf-8') as bf:
                    breadcrumb_string = bf.read().strip()
            except Exception as bc_err:
                print(f"Warning: Could not read breadcrumbs file {breadcrumb_file_path}: {bc_err}", file=sys.stderr)
        else:
             print(f"Warning: Breadcrumbs file not found at {breadcrumb_file_path}", file=sys.stderr)

        # Load alternative approaches if they exist
        alt_trees_data = []
        if os.path.exists(files_dir_path): # Check if files_dir_path exists
            for filename in os.listdir(files_dir_path): # Iterate through files_dir_path
                if filename.startswith('alt') and filename.endswith('.json'):
                    try:
                        alt_tree = read_json_file(os.path.join(files_dir_path, filename))
                        # Add preview text directly to each alternative tree dictionary
                        if isinstance(alt_tree, dict) and 'tree' in alt_tree:
                             alt_tree['preview_text'] = generate_tree_preview_text(alt_tree)
                             # Add other potential fields needed by template card, e.g., title, creator
                             alt_tree.setdefault('title', alt_tree.get('tree', {}).get('step', 'Alternative Approach'))
                             alt_tree.setdefault('creator', 'Iterative AI') # Example default
                             alt_tree.setdefault('votes', 0) # Example default
                             alt_trees_data.append(alt_tree)
                        else:
                             print(f"Warning: Skipping invalid alternative file {filename}", file=sys.stderr)
                    except Exception as alt_err:
                        print(f"Warning: Could not load or process alternative file {filename}: {alt_err}", file=sys.stderr)


        # --- Set up Jinja2 Environment ---
        project_root_for_templates = Path(__file__).resolve().parent.parent / "templates"
        env = Environment(
            loader=FileSystemLoader(str(project_root_for_templates)),
            autoescape=select_autoescape(['html', 'xml']),
            trim_blocks=True,
            lstrip_blocks=True
        )
        env.filters['process_bold'] = process_bold_text
        env.globals['enumerate'] = enumerate
        env.globals['json_dumps'] = json.dumps # Make json.dumps available for inline JSON in template if needed

        # --- Process Metadata and Breadcrumbs ---
        page_level_metadata = process_metadata(metadata_raw, breadcrumb_string)
        processed_breadcrumbs = process_breadcrumbs(page_level_metadata.get('breadcrumbs_str', ''))


        # --- Prepare `all_content_sections` for the new template structure ---
        all_content_sections = []

        # Helper to add sections
        def add_section(id_suffix, title, content_data, template_str_or_html, is_html=False):
            # Construct section_id based on page slug (if available) or a default
            page_slug = page_level_metadata.get('slug')
            if not page_slug or not isinstance(page_slug, str):
                page_slug = "article"
            
            section_id_for_html = f"{page_slug}-{id_suffix}" # Used for HTML element IDs
            
            # Pass the id_suffix to get_section_metrics_and_relevance for mapping
            metrics_info = get_section_metrics_and_relevance(id_suffix, article_metrics_data, metric_definitions_data)
            
            # Create transparency data for this section
            transparency_data = get_transparency_data_for_section(id_suffix, files_dir_path)
            
            content_html_output = ""
            if is_html:
                content_html_output = template_str_or_html # Already HTML
            elif content_data is not None and template_str_or_html:
                # Render content HTML using a temporary Jinja template string
                section_template = env.from_string(template_str_or_html)
                content_html_output = section_template.render(data=content_data, page_metadata=page_level_metadata) # Pass page_metadata for context
            
            all_content_sections.append({
                "id": section_id_for_html, # Use the slug-prefixed ID for HTML
                "title_text": title,
                "title_html": title,
                "content_html": content_html_output,
                "relevant_personas_json": json.dumps(metrics_info["relevant_personas_list"]),
                "metrics_data_json": metrics_info["metrics_data_for_section_json"],
                "transparency_data_json": json.dumps(transparency_data) if transparency_data else "{}"
            })

        # --- REMOVE MANUAL SIMULATION SECTION - Template handles this automatically ---

        # 1. Standard Process Steps (from tree_data)
        if tree_data and tree_data.get('tree', {}).get('children'):
            process_steps_content = """
                {% if data.tree and data.tree.children %}
                    {% for step_item in data.tree.children %}
                    <div class="process-section-item">
                        <h4>{{ loop.index }}. {{ step_item.step }}</h4>
                        {% if step_item.children %}
                        <ul class="step-list">
                            {% for sub_step in step_item.children %}
                            <li>{{ sub_step.step }}
                                {% if sub_step.children %}
                                <ul>
                                    {% for sub_sub_step in sub_step.children %}
                                    <li>{{ sub_sub_step.step }}</li>
                                    {% endfor %}
                                </ul>
                                {% endif %}
                            </li>
                            {% endfor %}
                        </ul>
                        {% endif %}
                    </div>
                    {% endfor %}
                {% endif %}
            """
            add_section("process-steps", "Standard Process", tree_data, process_steps_content)

        # 2. Automation Development Timeline
        if timeline_data and timeline_data.get('timeline'):
            timeline_content_template = """
                {% if data.timeline.historical or data.timeline.predictions %}
                    {% for year, description in data.timeline.historical.items() %}
                    <div class="timeline-entry">
                        <div class="timeline-year">{{ year }}</div>
                        <div class="timeline-content"><p>{{ description }}</p></div>
                    </div>
                    {% endfor %}
                    {% for year, description in data.timeline.predictions.items() %}
                    <div class="timeline-entry">
                        <div class="timeline-year-prediction">{{ year }}</div>
                        <div class="timeline-content"><p><em>{{ description }}</em></p></div>
                    </div>
                    {% endfor %}
                {% else %}
                    <p>No timeline data available.</p>
                {% endif %}
            """
            add_section("timeline", "Automation Development Timeline", timeline_data, timeline_content_template)
            
        # 3. Current Automation Challenges
        if challenges_data and challenges_data.get('challenges', {}).get('challenges'):
            challenges_content_template = """
                <ul>
                    {% for challenge in data.challenges.challenges %}
                    <li><strong>{{ challenge.title }}:</strong> {{ challenge.explanation }}</li>
                    {% endfor %}
                </ul>
            """
            add_section("challenges", "Current Automation Challenges", challenges_data, challenges_content_template)

        # 4. Automation Adoption Framework
        if adoption_data and adoption_data.get('automation_adoption'):
            adoption_content_template = """
                {% for phase_key, phase_data in data.automation_adoption.items() %}
                <h4>{{ phase_data.title }} ({{ phase_data.status }})</h4>
                <ul class="step-list">
                    {% for example in phase_data.examples %}
                    <li>{{ example|safe }}</li>
                    {% endfor %}
                </ul>
                {% endfor %}
            """
            add_section("adoption-framework", "Automation Adoption Framework", adoption_data, adoption_content_template)

        # 5. Current Implementation Levels
        if implementation_data and implementation_data.get('implementation_assessment',{}).get('process_steps'):
            implementation_content_template = """
                <table class="automation-table">
                    <thead>
                        <tr><th>Process Step</th><th>Small Scale</th><th>Medium Scale</th><th>Large Scale</th></tr>
                    </thead>
                    <tbody>
                        {% for step in data.implementation_assessment.process_steps %}
                        <tr>
                            <td>{{ step.step_name }}</td>
                            <td>{{ step.automation_levels.low_scale }}</td>
                            <td>{{ step.automation_levels.medium_scale }}</td>
                            <td>{{ step.automation_levels.high_scale }}</td>
                        </tr>
                        {% endfor %}
                    </tbody>
                </table>
            """
            add_section("implementation-levels", "Current Implementation Levels", implementation_data, implementation_content_template)

        # 6. Automation ROI Analysis
        if roi_data and roi_data.get('roi_analysis'):
            roi_content_template = """
                {% if data.roi_analysis.roi_analysis %}
                    {% for scale_key, scale_data in data.roi_analysis.roi_analysis.items() %}
                    <h4>{{ scale_key | replace('_', ' ') | capitalize }}</h4>
                    <ul class="step-list">
                        <li><strong>Timeframe:</strong> {{ scale_data.timeframe }}</li>
                        <li><strong>Initial Investment:</strong> {{ scale_data.initial_investment }}</li>
                        <li><strong>Annual Savings:</strong> {{ scale_data.annual_savings }}</li>
                        <li><strong>Key Considerations:</strong>
                            <ul>{% for consideration in scale_data.key_considerations %}<li>{{ consideration }}</li>{% endfor %}</ul>
                        </li>
                    </ul>
                    {% endfor %}
                {% endif %}
                {% if data.roi_analysis.key_benefits %}
                    <h4>Key Benefits</h4>
                    <ul class="step-list">{% for benefit in data.roi_analysis.key_benefits %}<li>{{ benefit }}</li>{% endfor %}</ul>
                {% endif %}
                {% if data.roi_analysis.barriers %}
                    <h4>Barriers</h4>
                    <ul class="step-list">{% for barrier in data.roi_analysis.barriers %}<li>{{ barrier }}</li>{% endfor %}</ul>
                {% endif %}
                {% if data.roi_analysis.recommendation %}
                    <h4>Recommendation</h4><p>{{ data.roi_analysis.recommendation }}</p>
                {% endif %}
            """
            add_section("roi-analysis", "Automation ROI Analysis", roi_data, roi_content_template)

        # 7. Automation Technologies (Future Tech)
        if future_tech_data and future_tech_data.get('future_technology'):
            future_tech_template = """
                {% if data.future_technology.sensory_systems %}
                <h4>Sensory Systems</h4>
                <ul class="step-list">{% for item in data.future_technology.sensory_systems %}<li><strong>{{ item.name }}:</strong> {{ item.description }}</li>{% endfor %}</ul>
                {% endif %}
                {% if data.future_technology.control_systems %}
                <h4>Control Systems</h4>
                <ul class="step-list">{% for item in data.future_technology.control_systems %}<li><strong>{{ item.name }}:</strong> {{ item.description }}</li>{% endfor %}</ul>
                {% endif %}
                {% if data.future_technology.mechanical_systems %}
                <h4>Mechanical Systems</h4>
                <ul class="step-list">{% for item in data.future_technology.mechanical_systems %}<li><strong>{{ item.name }}:</strong> {{ item.description }}</li>{% endfor %}</ul>
                {% endif %}
                {% if data.future_technology.software_integration %}
                <h4>Software Integration</h4>
                <ul class="step-list">{% for item in data.future_technology.software_integration %}<li><strong>{{ item.name }}:</strong> {{ item.description }}</li>{% endfor %}</ul>
                {% endif %}
            """
            add_section("automation-technologies", "Automation Technologies", future_tech_data, future_tech_template)

        # 8. Technical Specifications for Commercial Automation
        if specs_data and specs_data.get('industrial_specifications'):
            specs_template = """
                {% if data.industrial_specifications.performance_metrics %}
                <h4>Performance Metrics</h4>
                <ul class="step-list">{% for metric in data.industrial_specifications.performance_metrics %}<li><strong>{{ metric.name }}:</strong> {{ metric.value }} - {{ metric.description }}</li>{% endfor %}</ul>
                {% endif %}
                {% if data.industrial_specifications.implementation_requirements %}
                <h4>Implementation Requirements</h4>
                <ul class="step-list">{% for req in data.industrial_specifications.implementation_requirements %}<li><strong>{{ req.name }}:</strong> {{ req.specifications }} - {{ req.description }}</li>{% endfor %}</ul>
                {% endif %}
            """
            add_section("technical-specifications", "Technical Specifications for Commercial Automation", specs_data, specs_template)

        # 9. Alternative Approaches Introduction
        alt_intro_html = ""
        add_section("alternative-approaches-intro", "Alternative Approaches", None, alt_intro_html, is_html=True)
        
        # 10. Alternative Approaches Grid
        if alt_trees_data:
            alt_grid_template = """
            <div class="approaches-grid">
                {% for approach in data %}
                <div class="approach-card">
                    <h4>{{ approach.get('input', {}).get('approach_name', approach.get('title', 'Unnamed Approach')) }}</h4>
                    <p>{{ approach.get('input', {}).get('approach_description', 'No description available.') }}</p>
                    <div class="approach-preview">{{ approach.get('preview_text', 'Preview not available') }}</div>
                    <div class="approach-meta">
                        <p>Created by: {{ approach.creator | default("Iterative AI Alpha") }}</p>
                        <p>Votes: <span class="vote-count">{{ approach.votes | default(0) }}</span></p>
                    </div>
                    <div class="approach-actions">
                        <button class="button secondary vote-button">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 4L18 10H6L12 4Z" fill="currentColor"/></svg> Vote Up
                        </button>
                        <a href="{{ approach.full_tree_url | default('#') }}" class="button secondary">View Full Tree</a>
                    </div>
                </div>
                {% endfor %}
            </div>
            """
            add_section("alternative-approaches-grid", "Competing Models", alt_trees_data, alt_grid_template)

        # 11. Why Multiple Approaches?
        why_multiple_html = """
            <ul class="step-list">
                <li><strong>Scale considerations:</strong> Some approaches work better for large-scale production, while others are more suitable for specialized applications</li>
                <li><strong>Resource constraints:</strong> Different methods optimize for different resources (time, computing power, energy)</li>
                <li><strong>Quality objectives:</strong> Approaches vary in their emphasis on safety, efficiency, adaptability, and reliability</li>
                <li><strong>Automation potential:</strong> Some approaches are more easily adapted to full automation than others</li>
            </ul>
            <p>By voting for approaches you find most effective, you help our community identify the most promising automation pathways.</p>
        """
        add_section("why-multiple-approaches", "Why Multiple Approaches?", None, why_multiple_html, is_html=True)


        # --- Extract Flow UUID from Directory Path ---
        flow_uuid = None
        if files_dir_path:
            # Extract UUID from path like "flow/uuid-here" or just "uuid-here"
            # Normalize path separators and remove any trailing separators
            normalized_path = files_dir_path.replace('\\', '/').rstrip('/')
            path_parts = normalized_path.split('/')
            
            for part in reversed(path_parts):  # Check from the end
                # UUID pattern: 8-4-4-4-12 characters separated by hyphens
                if len(part) == 36 and part.count('-') == 4:
                    # Validate it looks like a UUID
                    try:
                        # Try to parse as UUID to validate format
                        import uuid as uuid_module
                        uuid_module.UUID(part)
                        flow_uuid = part
                        break
                    except ValueError:
                        # Not a valid UUID, continue looking
                        continue
        
        print(f"DEBUG: Extracted flow_uuid: {flow_uuid} from path: {files_dir_path}")

        # --- Final Jinja2 Context for page-template.html ---
        context = {
            'page_metadata': page_level_metadata, # Renamed from 'metadata' for clarity in template
            'all_content_sections': all_content_sections,
            'breadcrumbs': processed_breadcrumbs,
            'metric_definitions': metric_definitions_data, # Pass global definitions
            # 'article_metrics': article_metrics_data, # This is now processed into each section's metrics_data_json
            'core_personas': CORE_PERSONAS_DICT, # Pass the pre-defined dictionary
            'flow_uuid': flow_uuid, # Add flow UUID for transparency modal and origin tracking
            'simulation_data': simulation_data, # Add simulation data to context
            'expanded_tree_data': expanded_tree_data # Add expanded tree data to context
        }

        # --- Render Main Template ---
        main_template = env.get_template('page-template.html')
        output_html = main_template.render(context)

        # --- Write Output File ---
        # Use the final part of breadcrumbs if available, otherwise fall back to slug
        output_filename = None
        
        if breadcrumb_string:
            # Extract the final part of the breadcrumbs for the filename
            breadcrumb_parts = breadcrumb_string.strip('/').split('/')
            if breadcrumb_parts and breadcrumb_parts[-1]:
                # Use the last part of breadcrumbs as the filename
                final_breadcrumb = breadcrumb_parts[-1]
                # Sanitize the breadcrumb part for use as filename
                output_filename = "".join(c for c in final_breadcrumb if c.isalnum() or c in ('-', '_')).rstrip()
        
        # Fallback to existing slug logic if no valid breadcrumb filename
        if not output_filename:
            slug_base = page_level_metadata.get('slug', page_level_metadata.get('title', 'output').lower().replace(' ', '-'))
            output_filename = "".join(c for c in slug_base if c.isalnum() or c in ('-', '_')).rstrip() or "output"
        
        output_path = Path(output_dir) / f"{output_filename}.html"
        output_path.parent.mkdir(parents=True, exist_ok=True)

        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(output_html)

        print(f"Generated HTML page: {output_path}")

    except FileNotFoundError as fnf_error:
        print(f"Error: Input file not found - {fnf_error}", file=sys.stderr)
        sys.exit(1)
    except json.JSONDecodeError as json_error:
        print(f"Error: Failed to decode JSON - {json_error}", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"An unexpected error occurred in main: {str(e)}", file=sys.stderr)
        import traceback
        traceback.print_exc(file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()