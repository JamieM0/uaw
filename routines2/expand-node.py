import json
import sys
import os
import re
import uuid
from datetime import datetime
from utils import (
    load_json, save_output, chat_with_llm, parse_llm_json_response,
    create_output_metadata, get_output_filepath, translate_to_basic_english
)

def sanitize_filename(name):
    """Convert a step name to a valid directory name using lowercase and underscores."""
    # Convert to lowercase
    sanitized = name.lower()
    # Remove invalid characters and replace spaces/hyphens with underscores
    sanitized = re.sub(r'[^\w\s-]', '', sanitized)
    sanitized = re.sub(r'[\s-]+', '_', sanitized)
    # Ensure it's not too long
    return sanitized[:40]  # Shortened to leave room for the UUID

def find_node_by_path(base_dir, path_indices):
    """Find a node in the filesystem tree using a path of indices."""
    if not path_indices:
        # Return the root node
        node_path = os.path.join(base_dir, "node.json")
        if os.path.exists(node_path):
            try:
                with open(node_path, 'r') as f:
                    return json.load(f), base_dir
            except json.JSONDecodeError:
                return None, None
        return None, None
    
    # Start at the base directory
    current_dir = base_dir
    
    # Navigate through subdirectories based on index
    for index in path_indices:
        # Get all subdirectories (only directories, not files)
        subdirs = [d for d in os.listdir(current_dir) 
                   if os.path.isdir(os.path.join(current_dir, d)) 
                   and d != "." and d != ".." and not d.startswith('.')]
        
        # Sort subdirectories alphabetically for consistent indexing
        subdirs.sort()
        
        if index < 0 or index >= len(subdirs):
            print(f"Path index {index} is out of range. Available range: 0-{len(subdirs)-1}")
            return None, None
        
        # Move to the next subdirectory
        current_dir = os.path.join(current_dir, subdirs[index])
    
    # Read the node.json from the final directory
    node_path = os.path.join(current_dir, "node.json")
    if os.path.exists(node_path):
        try:
            with open(node_path, 'r') as f:
                return json.load(f), current_dir
        except json.JSONDecodeError:
            return None, None
    
    return None, None

def find_node_by_uuid(search_uuid, base_dir):
    """Find a node in the filesystem tree by its UUID."""
    search_uuid = search_uuid.lower()
    
    for root, dirs, files in os.walk(base_dir):
        if "node.json" in files:
            node_path = os.path.join(root, "node.json")
            try:
                with open(node_path, 'r') as f:
                    node_data = json.load(f)
                    if node_data.get("uuid", "").lower() == search_uuid:
                        return node_data, root
            except json.JSONDecodeError:
                continue
    
    return None, None

def expand_node_in_filesystem(node_data, node_dir, model, parameters=None, num_substeps=None):
    """Expand a node by creating child directories with substeps."""
    if parameters is None:
        parameters = {}
    
    # Get the node step and UUID
    step = node_data.get("step", "Unknown step")
    node_uuid = node_data.get("uuid", str(uuid.uuid4()))
    
    print(f"Expanding node: '{step}'")
    
    # Allow customizing the number of substeps
    substep_range = "3-7" if num_substeps is None else str(num_substeps)
    
    system_msg = (
        "You are an AI that breaks down tasks into detailed steps. "
        "For the given task, generate a set of specific, actionable substeps needed to complete it. "
        "Maintain clarity and logical order. "
        "Format your response as a valid JSON array of step objects, where each object has a 'step' field. "
        "Example format: [{'step': 'First detailed step'}, {'step': 'Second detailed step'}] "
        "Your entire response must be parseable as JSON. Do not include markdown formatting or commentary."
    )
    
    user_msg = (
        f"Break down the following task into {substep_range} detailed substeps:\n\n"
        f"Task: {step}\n\n"
        "Return ONLY a JSON array of step objects, with no markdown formatting, code blocks, or extra text."
    )
    
    response_text = chat_with_llm(model, system_msg, user_msg, parameters)
    
    # Parse the LLM response
    substeps = parse_llm_json_response(response_text)
    
    if not isinstance(substeps, list) or len(substeps) == 0:
        print("Error: No valid substeps could be generated")
        return []
    
    # Create subdirectories for each substep
    created_dirs = []
    for substep in substeps:
        substep_text = substep.get("step", "Unnamed step")
        
        # Generate UUID for the substep
        substep_uuid = str(uuid.uuid4())
        
        # Translate step text to Basic English
        basic_english_step = translate_to_basic_english(substep_text, model, parameters)
        
        # Create directory name from Basic English version
        substep_name = sanitize_filename(basic_english_step)
        if not substep_name:
            substep_name = "step"
        
        # Use full UUID in directory name
        dir_name = f"{substep_name}_{substep_uuid}"
        
        # Create the subdirectory
        substep_dir = os.path.join(node_dir, dir_name)
        os.makedirs(substep_dir, exist_ok=True)
        
        # Create node.json for the substep
        substep_data = {
            "step": substep_text,
            "uuid": substep_uuid,
            "parent_uuid": node_uuid
        }
        
        with open(os.path.join(substep_dir, "node.json"), "w") as f:
            json.dump(substep_data, f, indent=4)
        
        created_dirs.append({
            "directory": substep_dir,
            "data": substep_data
        })
    
    return created_dirs

def parse_path_string(path_str):
    """Convert a path string like '1-0-2' or '4' to a list of integers [1, 0, 2] or [4]."""
    try:
        # Handle both dash-separated paths and single numbers
        if '-' in path_str:
            return [int(i) for i in path_str.split('-')]
        else:
            return [int(path_str)]
    except ValueError:
        return None

def handle_expand_node_args():
    """Custom argument handling for expand-node.py to support node path specification."""
    usage_msg = """Usage: python expand-node.py <input_directory> [node_path_or_uuid] [output_metadata_path]
    
    <input_directory>: Directory containing the tree structure (e.g., output/hallucinate-tree/uuid)
    [node_path_or_uuid]: Optional - Path indices (e.g., 1-0-2) or UUID to identify the node to expand
    [output_metadata_path]: Optional - Path to save expansion metadata
    
    Examples:
      python expand-node.py output/hallucinate-tree/e2dd9b38-ab19-4156-8031-bcb2db5c93a7
      python expand-node.py output/hallucinate-tree/e2dd9b38-ab19-4156-8031-bcb2db5c93a7 1-0
      python expand-node.py output/hallucinate-tree/e2dd9b38-ab19-4156-8031-bcb2db5c93a7 e2dd9b38
    """
    
    if len(sys.argv) < 2 or len(sys.argv) > 4:
        print(usage_msg)
        sys.exit(1)
        
    input_directory = sys.argv[1]
    node_specifier = None
    output_filepath = None
    
    # Process the second argument - could be a node path, UUID, or output filepath
    if len(sys.argv) >= 3:
        arg2 = sys.argv[2]
        # If it doesn't end with .json and looks like a path or UUID, treat as node specifier
        if not arg2.endswith('.json'):
            node_specifier = arg2
        else:
            output_filepath = arg2
    
    # Process the third argument - must be output filepath
    if len(sys.argv) >= 4:
        output_filepath = sys.argv[3]
    
    return input_directory, node_specifier, output_filepath

def main():
    """Main function to run the node expansion routine."""
    input_directory, node_specifier, specified_output_filepath = handle_expand_node_args()
    
    print("Working...")
    start_time = datetime.now()
    
    # Check if the input directory exists
    if not os.path.isdir(input_directory):
        print(f"Error: Input directory '{input_directory}' does not exist.")
        sys.exit(1)
    
    # Try to read metadata for model information if available
    metadata_path = os.path.join(input_directory, "metadata.json")
    model = "gemma3"  # Default model
    parameters = {}
    
    if os.path.exists(metadata_path):
        try:
            with open(metadata_path, 'r') as f:
                metadata = json.load(f)
                if "model" in metadata:
                    model = metadata["model"]
                if "parameters" in metadata:
                    parameters = metadata["parameters"]
        except json.JSONDecodeError:
            print("Warning: Could not parse metadata.json, using default model settings.")
    
    # Find the target node
    target_node = None
    node_dir = None
    
    if node_specifier:
        # Check if the specifier is a path (contains only digits and dashes)
        if re.match(r'^[\d-]+$', node_specifier):
            path_indices = parse_path_string(node_specifier)
            print(f"Searching for node at path indices: {path_indices}")
            target_node, node_dir = find_node_by_path(input_directory, path_indices)
        else:
            # Assume it's a UUID or part of one
            print(f"Searching for node with UUID containing: {node_specifier}")
            target_node, node_dir = find_node_by_uuid(node_specifier, input_directory)
    else:
        # Default to root node
        print("No node specified, using root node.")
        target_node, node_dir = find_node_by_path(input_directory, [])
    
    if target_node is None or node_dir is None:
        print(f"Error: Could not find the specified node.")
        sys.exit(1)
    
    # Expand the node
    expanded_dirs = expand_node_in_filesystem(
        target_node,
        node_dir,
        model,
        parameters
    )
    
    # Get output filepath and UUID for metadata
    output_filepath, output_uuid = get_output_filepath(
        "expand-node",
        specified_path=specified_output_filepath
    )
    
    # Create metadata for this expansion
    metadata = create_output_metadata("Node Expansion", start_time, output_uuid)
    
    # Add details about the expansion to metadata
    expanded_node_info = []
    for dir_info in expanded_dirs:
        expanded_node_info.append({
            "step": dir_info["data"]["step"],
            "uuid": dir_info["data"]["uuid"],
            "directory": dir_info["directory"]
        })
    
    # Combine metadata with expansion information
    output_data = {
        **metadata,
        "expanded_node": {
            "step": target_node["step"],
            "uuid": target_node["uuid"],
            "directory": node_dir
        },
        "new_nodes": expanded_node_info,
        "num_substeps_created": len(expanded_dirs)
    }
    
    save_output(output_data, output_filepath)
    print(f"Node expanded with {len(expanded_dirs)} substeps")
    print(f"Expansion metadata saved to {output_filepath}")

if __name__ == "__main__":
    main()