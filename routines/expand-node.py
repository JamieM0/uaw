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

def expand_node_with_llm(node, model, parameters=None):
    """Expand a single node using the LLM to generate robot-level detail."""
    if parameters is None:
        parameters = {}
    
    step = node.get("step", "Unknown step")
    
    print(f"Expanding node: '{step}'")
    
    system_msg = (
        "You are an AI that breaks down tasks into extremely detailed, robot-level steps. "
        "Each step should be so specific that a robot could follow it without any ambiguity. "
        "Think 'game cutscene level of specificity' - every movement, every measurement, every action. "
        "Format your response as a valid JSON array of step objects, where each object has a 'step' field. "
        "Example format: [{'step': 'First extremely detailed step'}, {'step': 'Second extremely detailed step'}] "
        "Your entire response must be parseable as JSON. Do not include markdown formatting or commentary."
    )
    
    user_msg = (
        f"Break down the following task into 5-10 extremely detailed, robot-level substeps:\n\n"
        f"Task: {step}\n\n"
        "Each step should be detailed enough that a robot could follow it without any interpretation. "
        "Include specific measurements, exact movements, precise timings, and clear indicators. "
        "Return ONLY a JSON array of step objects, with no markdown formatting, code blocks, or extra text."
    )
    
    response_text = chat_with_llm(model, system_msg, user_msg, parameters)
    
    # Parse the LLM response
    substeps = parse_llm_json_response(response_text)
    
    if not isinstance(substeps, list) or len(substeps) == 0:
        print(f"Error: No valid substeps could be generated for '{step}'")
        return []
    
    # Convert substeps to the expected format with children arrays
    expanded_children = []
    for substep in substeps:
        if isinstance(substep, dict) and "step" in substep:
            expanded_children.append({
                "step": substep["step"],
                "children": []
            })
        elif isinstance(substep, str):
            expanded_children.append({
                "step": substep,
                "children": []
            })
    
    return expanded_children

def expand_tree_recursively(node, model, parameters=None):
    """Recursively expand all nodes in the tree to maximum detail."""
    if not isinstance(node, dict):
        return node
    
    # If this node has no children, expand it
    children = node.get("children", [])
    if not children:
        # This is a leaf node - expand it with LLM
        expanded_children = expand_node_with_llm(node, model, parameters)
        node["children"] = expanded_children
    else:
        # This node has children - recursively expand each child
        expanded_children = []
        for child in children:
            expanded_child = expand_tree_recursively(child, model, parameters)
            expanded_children.append(expanded_child)
        node["children"] = expanded_children
    
    return node

def count_leaf_nodes(node):
    """Count the number of leaf nodes in the tree."""
    if not isinstance(node, dict):
        return 0
    
    children = node.get("children", [])
    if not children:
        return 1
    
    count = 0
    for child in children:
        count += count_leaf_nodes(child)
    return count

def handle_expand_node_args():
    """Custom argument handling for expand-node.py to support both standalone and flow-maker usage."""
    usage_msg = """Usage: python expand-node.py <json_file_path> [output_file_path] [additional_args...]
    
    <json_file_path>: Path to JSON file containing tree structure (e.g., 'routines/flow/05c6f003-39eb-4dc9-8fa3-eabddadb6bce/2.json')
    [output_file_path]: Optional - Path to save expanded tree (defaults to 'expanded-tree.json' in same directory)
    [additional_args]: Additional arguments (e.g., -saveInputs, -flow_uuid=xxx)
    
    Examples:
      python expand-node.py routines/flow/05c6f003-39eb-4dc9-8fa3-eabddadb6bce/2.json
      python expand-node.py routines/flow/05c6f003-39eb-4dc9-8fa3-eabddadb6bce/2.json my-expanded-tree.json
      python expand-node.py input.json output.json -saveInputs -flow_uuid=12345
    """
    
    if len(sys.argv) < 2:
        print(usage_msg)
        sys.exit(1)
        
    json_file_path = sys.argv[1]
    output_file_path = None
    
    if len(sys.argv) >= 3 and not sys.argv[2].startswith('-'):
        output_file_path = sys.argv[2]
    else:
        # Default output path: same directory as input, named 'expanded-tree.json'
        input_dir = os.path.dirname(json_file_path)
        output_file_path = os.path.join(input_dir, "expanded-tree.json")
    
    # Parse additional arguments
    save_inputs = False
    flow_uuid = None
    
    for arg in sys.argv[2:]:
        if arg == "-saveInputs":
            save_inputs = True
        elif arg.startswith("-flow_uuid="):
            flow_uuid = arg.split("=", 1)[1]
    
    return json_file_path, output_file_path, save_inputs, flow_uuid

def main():
    """Main function to run the tree expansion routine."""
    json_file_path, output_file_path, save_inputs, flow_uuid = handle_expand_node_args()
    
    print("Working...")
    start_time = datetime.now()
    
    # Check if the input file exists
    if not os.path.isfile(json_file_path):
        print(f"Error: Input file '{json_file_path}' does not exist.")
        sys.exit(1)
    
    # Load the JSON file
    try:
        input_data = load_json(json_file_path)
    except (json.JSONDecodeError, FileNotFoundError) as e:
        print(f"Error loading JSON file: {e}")
        sys.exit(1)
    
    # Check if the file has a 'tree' field
    if "tree" not in input_data:
        print("Error: JSON file does not contain a 'tree' field.")
        sys.exit(1)
    
    tree = input_data["tree"]
    
    # Get model and parameters from metadata if available
    model = "gemma3"  # Default model
    parameters = {}
    
    if "metadata" in input_data:
        metadata = input_data["metadata"]
        if "model" in metadata:
            model = metadata["model"]
        if "parameters" in metadata:
            parameters = metadata["parameters"]
    
    # Count initial leaf nodes
    initial_leaf_count = count_leaf_nodes(tree)
    print(f"Initial tree has {initial_leaf_count} leaf nodes to expand")
    
    # Recursively expand the entire tree
    print("Starting recursive expansion of all nodes...")
    expanded_tree = expand_tree_recursively(tree, model, parameters)
    
    # Count final leaf nodes
    final_leaf_count = count_leaf_nodes(expanded_tree)
    print(f"Expanded tree now has {final_leaf_count} leaf nodes")
    
    # Create the output data with the same structure as input but expanded tree
    output_data = input_data.copy()
    output_data["tree"] = expanded_tree
    
    # Update metadata to reflect the expansion
    if "metadata" not in output_data:
        output_data["metadata"] = {}
    
    output_data["metadata"]["expanded"] = True
    output_data["metadata"]["expansion_date"] = datetime.now().isoformat()
    output_data["metadata"]["original_leaf_count"] = initial_leaf_count
    output_data["metadata"]["expanded_leaf_count"] = final_leaf_count
    output_data["metadata"]["expansion_model"] = model
    
    # Save input data to inputs directory if requested (for flow-maker transparency)
    if save_inputs and flow_uuid:
        try:
            # Determine step number from output filename for input saving
            step_number = None
            output_filename = os.path.basename(output_file_path)
            if output_filename == "expanded-tree.json":
                step_number = "3"  # expand-node.py is step 3 in the flow
            
            if step_number:
                flow_dir = os.path.dirname(output_file_path)
                inputs_dir = os.path.join(flow_dir, "inputs")
                os.makedirs(inputs_dir, exist_ok=True)
                
                input_save_path = os.path.join(inputs_dir, f"{step_number}-in.json")
                save_output(input_data, input_save_path)
                print(f"Input data saved to: {input_save_path}")
        except Exception as e:
            print(f"Warning: Could not save input data: {e}")
    
    # Save the expanded tree
    try:
        save_output(output_data, output_file_path)
        print(f"Expanded tree saved to: {output_file_path}")
        print(f"Expansion complete: {initial_leaf_count} -> {final_leaf_count} leaf nodes")
    except Exception as e:
        print(f"Error saving output: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()