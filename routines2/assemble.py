import json
import os
import sys
from pathlib import Path
from jinja2 import Environment, FileSystemLoader
from datetime import datetime # Import datetime

def read_json_file(file_path):
    """Read a JSON file and return its contents as a Python dictionary."""
    with open(file_path, 'r', encoding='utf-8') as file:
        return json.load(file)

def process_bold_text(text):
    """Replace text surrounded by ** with HTML bold tags."""
    import re
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

    # Handle progress percentage (use existing logic)
    if 'automation_progress' in result:
        progress_text = result['automation_progress']
    elif 'progress_percentage' in result:
        progress_text = result['progress_percentage']
    else:
        progress_text = "0"  # Default fallback to 0 if missing

    # Extract numeric value from progress text
    try:
        result['progress_percentage'] = int(''.join(filter(str.isdigit, str(progress_text))))
    except ValueError:
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
    result['last_updated'] = now.strftime("%B %Y") # e.g., April 2025

    # Add breadcrumb string read from file
    result['breadcrumbs'] = breadcrumb_str

    return result

def process_breadcrumbs(breadcrumbs_str):
    """Process breadcrumbs string into a list of dictionaries with names and URLs."""
    if not breadcrumbs_str:
        return []

    parts = [part for part in breadcrumbs_str.strip('/').split('/') if part]
    result = []
    current_path = ""

    # Add Home breadcrumb
    result.append({'name': 'Home', 'url': '/index'})

    for i, part in enumerate(parts):
        # Build cumulative path, ensuring no double slashes
        current_path = f"{current_path}/{part}".replace('//', '/')
        display_name = part.replace('-', ' ').title()

        # Determine URL - only add index if it's not the last part
        url = f"{current_path}/index" if i < len(parts) - 1 else None

        result.append({
            'name': display_name,
            'url': url
        })

    return result

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
        # Load all required JSON data
        metadata_raw = read_json_file(metadata_path)
        tree_data = read_json_file(tree_path)

        # Load optional JSON data with fallbacks
        timeline_data = read_json_file(timeline_path) if os.path.exists(timeline_path) else {}
        challenges_data = read_json_file(challenges_path) if os.path.exists(challenges_path) else {}
        adoption_data = read_json_file(adoption_path) if os.path.exists(adoption_path) else {}
        implementation_data = read_json_file(implementation_path) if os.path.exists(implementation_path) else {}
        roi_data = read_json_file(roi_path) if os.path.exists(roi_path) else {}
        future_tech_data = read_json_file(future_tech_path) if os.path.exists(future_tech_path) else {}
        specs_data = read_json_file(specs_path) if os.path.exists(specs_path) else {}

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


        # Set up Jinja2 environment
        env = Environment(
            loader=FileSystemLoader('templates'),
            autoescape=True, # Keep autoescape True for security
            trim_blocks=True,
            lstrip_blocks=True
        )

        # Add custom filters
        env.filters['process_bold'] = process_bold_text

        # Register generate_tree_preview_text as a global function (still useful if template calls it)
        env.globals['generate_tree_preview_text'] = generate_tree_preview_text
        env.globals['enumerate'] = enumerate  # Make enumerate available in templates

        # Load template
        template = env.get_template('page-template.html')

        # Process data before adding to context (pass breadcrumb string)
        processed_metadata = process_metadata(metadata_raw, breadcrumb_string)
        # Now process the breadcrumbs string stored within processed_metadata
        processed_breadcrumbs = process_breadcrumbs(processed_metadata.get('breadcrumbs', ''))

        # --- Process Timeline Data ---
        timeline_entries = []
        timeline_content = timeline_data.get('timeline', {})
        for year, content in timeline_content.get('historical', {}).items():
            timeline_entries.append({'year': year, 'content': content, 'is_prediction': False})
        for year, content in timeline_content.get('predictions', {}).items():
            timeline_entries.append({'year': year, 'content': content, 'is_prediction': True})
        # Sort entries (optional, depends on desired order)
        # timeline_entries.sort(key=lambda x: x['year']) # Simple sort might fail with year ranges

        # --- Process Adoption Data ---
        adoption_stages = []
        adoption_content = adoption_data.get('automation_adoption', {})
        # Sort by phase key (phase1, phase2, ...) if needed
        for phase_key in sorted(adoption_content.keys()):
            if phase_key.startswith('phase'):
                adoption_stages.append(adoption_content[phase_key])

        # --- Process ROI Data ---
        roi_points = []
        roi_scales_data = roi_data.get('roi_analysis', {}).get('roi_analysis', {})
        for scale_key, scale_data in roi_scales_data.items():
            if isinstance(scale_data, dict) and 'timeframe' in scale_data:
                 roi_points.append({'scale': scale_key, 'timeframe': scale_data['timeframe']})
        key_benefits_list = roi_data.get('roi_analysis', {}).get('key_benefits', [])

        # --- Process Future Technology Data ---
        future_technologies = []
        future_tech_content = future_tech_data.get('future_technology', {})
        categories = {
            'sensory_systems': 'Sensory Systems',
            'control_systems': 'Control Systems',
            'mechanical_systems': 'Mechanical Systems',
            'software_integration': 'Software Integration'
        }
        for category_key, category_name in categories.items():
            for tech_item in future_tech_content.get(category_key, []):
                if isinstance(tech_item, dict):
                    tech_item['category'] = category_name # Add category for template grouping
                    future_technologies.append(tech_item)

        # --- Prepare context with processed and structured data ---
        context = {
            # Use processed metadata
            'metadata': processed_metadata,
            # Main process tree
            'tree': tree_data.get('tree', {}),
            # Use processed lists/data
            'timeline_entries': timeline_entries,
            'challenge_points': challenges_data.get('challenges', {}).get('challenges', []), # Use 'challenges' list
            'adoption_stages': adoption_stages,
            'implementation_levels': implementation_data.get('implementation_assessment', {}).get('process_steps', []), # Use 'process_steps' list
            'roi_points': roi_points,
            'key_benefits': key_benefits_list,
            'future_technologies': future_technologies,
            # Use correct keys for specifications
            'spec_performance': specs_data.get('industrial_specifications', {}).get('performance_metrics', []),
            'spec_requirements': specs_data.get('industrial_specifications', {}).get('implementation_requirements', []),
            # Use processed breadcrumbs
            'breadcrumbs': processed_breadcrumbs,
            # Pass alternatives with pre-generated preview text
            'alternatives': alt_trees_data
        }

        # Render template
        output_html = template.render(context)

        # Write output
        # Generate slug from processed metadata title
        slug = processed_metadata.get('slug', processed_metadata.get('title', 'output').lower().replace(' ', '-'))
        # Ensure slug is filesystem-safe (basic example)
        slug = "".join(c for c in slug if c.isalnum() or c in ('-', '_')).rstrip() or "output"
        output_path = Path(output_dir) / f"{slug}.html"
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
        print(f"An unexpected error occurred: {str(e)}", file=sys.stderr)
        import traceback
        traceback.print_exc(file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()