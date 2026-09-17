# Hallucinate Tree

This script uses a Large Language Model (LLM) to generate a hierarchical breakdown of tasks (a "tree") for a given topic. It can save the resulting tree structure either as a nested directory structure on the filesystem or as a single flat JSON file.

## Purpose

The primary goal of `hallucinate-tree.py` is to take a high-level task or topic and recursively break it down into smaller, manageable sub-steps using an LLM. This process, often referred to as "hallucination" in the context of AI, creates a structured plan or workflow.

## Usage

The script is executed from the command line:

```bash
python hallucinate-tree.py <input_json> [output_path] [-flat] [-saveInputs] [-uuid="UUID"] [-flow_uuid="FLOW-UUID"]
```

**Arguments:**

*   `<input_json>`: (Required) Path to the input JSON file containing the task details.
*   `[output_path]`: (Optional) Specifies the output location.
    *   If `-flat` is **not** used: This is the base directory where the tree structure and `metadata.json` will be saved. If not provided, defaults to `output/hallucinate-tree/<tree_uuid>/`.
    *   If `-flat` **is** used: This is the full path (including filename) for the output JSON file. If the path points to a directory, a file named `<tree_uuid>.json` will be created inside it. If not provided, defaults to `output/hallucinate-tree/<tree_uuid>/<tree_uuid>.json`.
*   `-flat`: (Optional) If present, saves the output as a single flat JSON file instead of a directory structure.
*   `-saveInputs`: (Optional) If present, saves the system and user prompts sent to the LLM during generation into the `flow/<flowUUID>/inputs/` directory. Requires `-flow_uuid` to be set.
*   `-uuid="UUID"`: (Optional) Specify a custom UUID for the root node of the generated tree. If omitted, a new UUID is generated.
*   `-flow_uuid="FLOW-UUID"`: (Optional) Specify a UUID for the overall flow, used primarily for organizing saved inputs when `-saveInputs` is active.

## Input Files

The script expects an input JSON file (`<input_json>`) with the following structure:

```json
{
  "topic": "The main task or topic to break down",
  "depth": 2, // Optional: How many levels deep to generate steps (default: 2)
  "model": "gemma3", // Optional: The LLM model to use (default: "gemma3")
  "parameters": {} // Optional: Additional parameters for the LLM API call
}
```

## Key Functions

*   `sanitize_filename(name)`: Converts a step name into a valid, lowercase directory name using underscores, removing invalid characters and truncating length.
*   `save_tree_to_filesystem(tree, base_path, parent_uuid=None)`: Recursively saves the generated tree structure to the filesystem. Each node becomes a directory containing a `node.json` file. Directory names are generated using `translate_to_basic_english`, `sanitize_filename`, and the node's UUID.
*   `save_tree_as_flat_json(tree, metadata, output_path)`: Saves the complete tree structure and associated metadata into a single JSON file.
*   `generate_task_tree(input_data, save_inputs=False)`: The main function orchestrating the tree generation. It initializes the process and calls the recursive `expand_step` function.
    *   `expand_step(step, current_depth)`: (Nested within `generate_task_tree`) This recursive function interacts with the LLM. For a given `step`, it prompts the LLM to generate sub-steps. It continues recursively until the specified `depth` is reached. It uses `utils.chat_with_llm` for the API call and `utils.parse_llm_json_response` to interpret the hierarchical JSON response. If `save_inputs` is true, it uses `utils.saveToFile` to store prompts.
*   `main()`: Parses command-line arguments (using `utils.handle_command_args`), loads the input JSON (`utils.load_json`), calls `generate_task_tree`, creates metadata (`utils.create_output_metadata`), and then calls either `save_tree_to_filesystem` or `save_tree_as_flat_json` based on the presence of the `-flat` flag.

## LLM Interaction

The core of the task breakdown happens in the `generate_task_tree` function, specifically within its nested `expand_step` function.

1.  `expand_step` is called initially with the main `topic` and `current_depth = 0`.
2.  If `current_depth` is less than the target `depth`, it constructs a prompt asking the LLM to break down the current `step` into 3-7 sub-steps.
3.  It calls the LLM using the `utils.chat_with_llm` function, providing the system message (instructing the LLM to return hierarchical JSON) and the user message (the specific task breakdown request).
4.  The LLM's response is expected to be a JSON array of step objects, potentially containing nested `children` arrays for sub-sub-steps.
5.  `utils.parse_llm_json_response(response_text, include_children=True)` is used to parse this potentially complex JSON structure. The `include_children=True` argument is crucial for handling the hierarchical nature of the expected response.
6.  For each sub-step returned by the LLM (if it doesn't already have children), `expand_step` calls itself recursively with the sub-step text and an incremented `current_depth`.
7.  This process continues until the maximum `depth` is reached for all branches of the tree.

## Output Formats

The script supports two distinct output formats, controlled by the `-flat` command-line flag.

### Default (Directory Structure)

*   **Triggered by:** Running the script without the `-flat` flag.
*   **Function:** `save_tree_to_filesystem` is used.
*   **Structure:**
    *   A base directory is created (either at `[output_path]` or `output/hallucinate-tree/<tree_uuid>/`).
    *   Inside the base directory, a `metadata.json` file is saved containing information about the generation process (script name, timestamp, tree UUID).
    *   The root node's details (`step`, `uuid`) are saved in `node.json` within the base directory.
    *   For each child node, a subdirectory is created within its parent's directory.
        *   The subdirectory name is generated by:
            1.  Translating the child step text to Basic English (`utils.translate_to_basic_english`).
            2.  Sanitizing the Basic English text (`sanitize_filename`).
            3.  Appending `_` and the child node's full UUID (e.g., `sanitized_name_<child_uuid>`).
        *   Inside the child subdirectory, a `node.json` file is created containing the child's `step`, `uuid`, and a `parent_uuid` referencing its parent node.
    *   This process repeats recursively for all nodes in the tree.

### Flat JSON (`-flat` flag)

*   **Triggered by:** Running the script *with* the `-flat` flag.
*   **Function:** `save_tree_as_flat_json` is used.
*   **Structure:**
    *   A single JSON file is created (either at `[output_path]` or `output/hallucinate-tree/<tree_uuid>/<tree_uuid>.json`).
    *   The JSON file contains a top-level object with two keys:
        *   `"metadata"`: An object containing the same metadata as in the directory structure format.
        *   `"tree"`: An object representing the entire hierarchical tree structure, including nested `children` arrays and `uuid` fields for each node.