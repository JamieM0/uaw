import os
import json
import sys
import uuid
from datetime import datetime
from utils import (
    load_json, save_output, create_output_metadata, get_output_filepath
)

def find_node_by_uuid(search_uuid, base_dir='output'):
    """Find a node.json file containing the specified UUID."""
    search_uuid = search_uuid.lower()  # Normalize for comparison
    
    for root, dirs, files in os.walk(base_dir):
        if "node.json" in files:
            node_path = os.path.join(root, "node.json")
            try:
                with open(node_path, 'r', encoding='utf-8') as f:
                    node_data = json.load(f)
                    
                    # Check if this is the node we're looking for
                    if node_data.get("uuid", "").lower() == search_uuid:
                        node_data["filepath"] = node_path
                        return node_data
            except (json.JSONDecodeError, IOError) as e:
                print(f"Error reading {node_path}: {e}")
    
    return None

def get_parent_chain(node_data, search_dir='output'):
    """Build a chain of nodes from the given node up to the root."""
    node_chain = [node_data]
    current_node = node_data
    
    # Continue until we reach a node without a parent (the root)
    while "parent_uuid" in current_node:
        parent_uuid = current_node["parent_uuid"]
        parent_node = find_node_by_uuid(parent_uuid, search_dir)
        
        if parent_node is None:
            print(f"Warning: Could not find parent with UUID {parent_uuid}")
            break
            
        node_chain.insert(0, parent_node)
        current_node = parent_node
    
    return node_chain

def build_tree_branch(node_chain):
    """Build a tree structure representing the branch from root to the specified node."""
    if not node_chain:
        return {}
    
    # Initialize with the root node
    root = {
        "step": node_chain[0]["step"],
        "uuid": node_chain[0]["uuid"],
        "children": []
    }
    
    current = root
    # For each node in the chain (except the root which we already processed)
    for node in node_chain[1:]:
        # Create a new node
        new_node = {
            "step": node["step"],
            "uuid": node["uuid"],
            "children": []
        }
        
        # Add it as a child of the current node
        current["children"].append(new_node)
        
        # Move down to this new node for the next iteration
        current = new_node
    
    return root

def parse_command_args():
    """Parse command line arguments with support for search directory."""
    usage_msg = """Usage: python reconstructor.py <node_uuid> [search_directory] [output_json]
    
    Arguments:
      node_uuid        UUID of the node to reconstruct the tree from
      search_directory (Optional) Directory to search for node files (default: output/)
      output_json      (Optional) Path to save the output JSON
      
    Examples:
      python reconstructor.py e2dd9b38ab194156
      python reconstructor.py e2dd9b38ab194156 output/hallucinate-tree
      python reconstructor.py e2dd9b38ab194156 output/hallucinate-tree my_tree.json
    """
    
    if len(sys.argv) < 2:
        print(usage_msg)
        sys.exit(1)
    
    search_uuid = sys.argv[1]
    search_directory = None
    output_path = None
    
    # If we have at least 3 args, determine if the 2nd is a directory or output file
    if len(sys.argv) >= 3:
        arg2 = sys.argv[2]
        if os.path.isdir(arg2) or '/' in arg2:  # Directory check
            search_directory = arg2
            # If we have 4 args, the 3rd is the output file
            if len(sys.argv) >= 4:
                output_path = sys.argv[3]
        else:  # Assume it's an output file
            output_path = arg2
    
    return search_uuid, search_directory, output_path

def main():
    """Main function to run the tree reconstruction."""
    search_uuid, search_directory, specified_output_path = parse_command_args()
    
    # Set default search directory if not specified
    if not search_directory:
        search_directory = 'output'
    
    print(f"Searching for node with UUID: {search_uuid}")
    print(f"Search directory: {search_directory}")
    start_time = datetime.now()
    
    # Find the node with the specified UUID
    node_data = find_node_by_uuid(search_uuid, search_directory)
    
    if node_data is None:
        print(f"Error: Could not find a node with UUID {search_uuid} in directory {search_directory}")
        sys.exit(1)
    
    print(f"Found node: '{node_data['step']}' at {node_data.get('filepath', 'unknown location')}")
    
    # Get the chain of nodes from root to this node
    print(f"Building parent chain...")
    node_chain = get_parent_chain(node_data, search_directory)
    
    print(f"Found path with {len(node_chain)} nodes from root to target")
    
    # Build a tree structure from this chain
    tree = build_tree_branch(node_chain)
    
    # Get output filepath and UUID
    output_filepath, output_uuid = get_output_filepath(
        "reconstructor",
        specified_path=specified_output_path
    )
    
    # Create metadata
    metadata = create_output_metadata("Tree Reconstruction", start_time, output_uuid)
    
    # Combine metadata with the reconstructed tree
    output_data = {
        **metadata,
        "source_uuid": search_uuid,
        "search_directory": search_directory,
        "reconstructed_tree": tree,
        "path_length": len(node_chain)
    }
    
    save_output(output_data, output_filepath)
    print(f"Reconstructed tree saved to {output_filepath}")

if __name__ == "__main__":
    main()