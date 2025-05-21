import os
import json
import sys
import uuid
import re
from datetime import datetime
from utils import (
    load_json, save_output, chat_with_llm, parse_llm_json_response,
    create_output_metadata, get_output_filepath, handle_command_args, translate_to_basic_english,
    saveToFile
)

flowUUID = None # Global variable for flow UUID

def sanitize_filename(name):
    """Convert a step name to a valid directory name using lowercase and underscores."""
    # Convert to lowercase
    sanitized = name.lower()
    # Remove invalid characters and replace spaces/hyphens with underscores
    sanitized = re.sub(r'[^\w\s-]', '', sanitized)
    sanitized = re.sub(r'[\s-]+', '_', sanitized)
    # Ensure it's not too long
    return sanitized[:40]  # Shortened to leave room for the UUID

def save_tree_to_filesystem(tree, base_path, parent_uuid=None):
    """Save a tree structure to the filesystem where each node is a directory."""
    # Create the base directory if it doesn't exist
    os.makedirs(base_path, exist_ok=True)
    
    # Generate UUID for this node if it doesn't have one
    if "uuid" not in tree:
        tree["uuid"] = str(uuid.uuid4())
    
    # Save the node's details as node.json
    node_details = {
        "step": tree["step"],
        "uuid": tree["uuid"]
    }
    
    # Add parent UUID reference if this isn't the root node
    if parent_uuid:
        node_details["parent_uuid"] = parent_uuid
    
    with open(os.path.join(base_path, "node.json"), "w", encoding="utf-8") as f:
        json.dump(node_details, f, indent=4)
    
    # Create child directories for each child node
    for child in tree.get("children", []):
        # Generate UUID for the child if it doesn't have one
        if "uuid" not in child:
            child["uuid"] = str(uuid.uuid4())
        
        # Get the child's step text
        child_step = child["step"]
        
        # Translate step text to Basic English
        basic_english_step = translate_to_basic_english(child_step)
        
        # Create directory name from Basic English version
        child_name = sanitize_filename(basic_english_step)
        
        # If sanitizing results in an empty string, use a generic name
        if not child_name:
            child_name = "step"
            
        # Use full UUID in directory name
        dir_name = f"{child_name}_{child['uuid']}"
        
        # Create child directory
        child_path = os.path.join(base_path, dir_name)
        
        # Pass the current node's UUID as the parent UUID for the child
        save_tree_to_filesystem(child, child_path, tree["uuid"])
    
    return base_path

def save_tree_as_flat_json(tree, metadata, output_path):
    """Save the tree structure and metadata as a single JSON file."""
    # Combine tree and metadata into a single structure
    output_data = {
        "metadata": metadata,
        "tree": tree
    }
    
    # Ensure the output directory exists
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    
    # Save the combined data to a single JSON file
    with open(output_path+".json", "w", encoding="utf-8") as f:
        json.dump(output_data, f, indent=4)
    
    return output_path

def generate_task_tree(input_data, save_inputs=False):
    """Generate a structured task tree using AI hallucinations."""
    task = input_data.get("topic", "Unknown Task")
    depth = input_data.get("depth", 2)  # Default depth of 2
    model = input_data.get("model", "gemma3")
    parameters = input_data.get("parameters", {})

    system_msg = (
        "You are an AI that breaks down complex tasks into hierarchical steps. "
        "For each task, generate a set of sub-steps needed to complete it. "
        "Maintain clarity and logical order. "
        "Format your response as a valid JSON array of step objects, where each object has a 'step' field "
        "and optionally a 'children' array containing substeps. "
        "Example format: [{'step': 'Main step 1', 'children': [{'step': 'Substep 1.1'}, {'step': 'Substep 1.2'}]}, {'step': 'Main step 2'}] "
        "Your entire response must be parseable as JSON. Do not include markdown formatting, code blocks, or commentary."
    )

    def expand_step(step, current_depth):
        if current_depth >= depth:
            return {"step": step, "children": []}

        user_msg = (
            "Break down the following task into 3-7 sub-steps. "
            f"Task: {step}\n\n"
            "Return ONLY a JSON array of step objects, with no markdown formatting, code blocks, or extra text."
        )
        
        # Save inputs to file if requested
        if save_inputs:
            # Create unique filename for each step using timestamp
            save_path = f"flow/{flowUUID}/inputs/2-in.json"
            saveToFile(system_msg, user_msg, save_path)
        
        # Use chat_with_llm instead of direct ollama.chat
        response_text = chat_with_llm(model, system_msg, user_msg, parameters)
        
        try:
            # Use parse_llm_json_response utility with include_children=True for hierarchical data
            parsed_steps = parse_llm_json_response(response_text, include_children=True)
            
            if isinstance(parsed_steps, list):
                # Process each step recursively if we're not at max depth
                if current_depth + 1 < depth:
                    for substep in parsed_steps:
                        if isinstance(substep, dict) and "step" in substep and "children" not in substep:
                            substep_text = substep["step"]
                            child_tree = expand_step(substep_text, current_depth + 1)
                            substep["children"] = child_tree.get("children", [])
                return {"step": step, "children": parsed_steps}
            else:
                # If response isn't a list, create a simple step
                return {"step": step, "children": []}
                
        except Exception as e:
            print(f"Error processing response: {e}")
            # Fallback: create a simple structure
            return {"step": step, "children": [{"step": response_text, "children": []}]}

    tree = expand_step(task, 0)
    # Generate UUID for root node
    tree["uuid"] = str(uuid.uuid4())
    return tree

def main():
    """Main function to run the hallucination-based tree generation."""
    global flowUUID
    usage_msg = "Usage: python hallucinate-tree.py <input_json> [output_dir] [-flat] [-saveInputs] [-uuid=\"UUID\"] [-flow_uuid=\"FLOW-UUID\"]"
    
    # Use handle_command_args utility and check for -flat flag
    args = sys.argv[1:]
    flat_output = "-flat" in args
    if flat_output:
        args.remove("-flat")
    
    # Update to pass the remaining args to handle_command_args
    sys.argv = [sys.argv[0]] + args
    input_filepath, specified_output_path, save_inputs, custom_uuid, flow_uuid_arg = handle_command_args(usage_msg)
    flowUUID = flow_uuid_arg # Set the global variable

    print("Working...")
    start_time = datetime.now()
    
    input_data = load_json(input_filepath)
    tree_content = generate_task_tree(input_data, save_inputs)
    
    # Generate a UUID for this tree
    tree_uuid = tree_content["uuid"]
    
    # Create metadata
    metadata = create_output_metadata("Hallucinate Tree", start_time, tree_uuid)
    
    # Define the base output directory
    if specified_output_path:
        # If output path is specified, use that
        base_output_dir = specified_output_path.rstrip(".json")
    else:
        # Otherwise create a directory with the UUID in the default location
        base_output_dir = os.path.join("output", "hallucinate-tree", tree_uuid)
    
    if flat_output:
        # Save as a single JSON file if -flat flag is provided
        if os.path.isdir(base_output_dir):
            # If base_output_dir is a directory, create a file in that directory
            output_filepath = os.path.join(base_output_dir, f"{tree_uuid}.json")
        else:
            # If base_output_dir includes a filename, use it directly
            output_filepath = base_output_dir
            
        # Ensure the directory exists
        os.makedirs(os.path.dirname(output_filepath), exist_ok=True)
        
        # Save as flat JSON
        output_path = save_tree_as_flat_json(tree_content, metadata, output_filepath)
        print(f"Generated tree as flat JSON, output saved to {output_path}")
    else:
        # Original behavior: save as directory structure
        # Create the base output directory if it doesn't exist
        os.makedirs(base_output_dir, exist_ok=True)
        
        # Save metadata to the base directory
        with open(os.path.join(base_output_dir, "metadata.json"), "w", encoding="utf-8") as f:
            json.dump(metadata, f, indent=4)
        
        # Save the tree structure to the filesystem
        tree_root_dir = save_tree_to_filesystem(tree_content, base_output_dir)
        
        print(f"Generated initial tree, output saved to {tree_root_dir}")

if __name__ == "__main__":
    main()
