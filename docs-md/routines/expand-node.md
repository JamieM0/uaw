# Node Expansion

This script expands a specified node within a filesystem-based tree structure. It uses a Large Language Model (LLM) to generate substeps for the node's task and creates corresponding subdirectories and `node.json` files for each substep.

## Purpose

The primary goal of `expand-node.py` is to break down a task represented by a node into smaller, more manageable substeps. It automates the process of generating these substeps using an LLM and organizing them within the existing filesystem tree structure.

## Usage

The script is executed from the command line:

```bash
python expand-node.py <input_directory> [node_path_or_uuid] [output_metadata_path]
```

*   **`<input_directory>` (Required):** The path to the root directory of the filesystem tree structure (e.g., `output/hallucinate-tree/some_uuid`). This directory should contain the initial `node.json` and potentially subdirectories representing existing nodes.
*   **`[node_path_or_uuid]` (Optional):** Specifies the target node to expand. If omitted, the root node in the `<input_directory>` is expanded. This can be:
    *   A path of indices separated by dashes (e.g., `1-0-2`), representing the navigation path from the root directory (0-based index for alphabetically sorted subdirectories).
    *   A full or partial UUID of the target node. The script will search the tree for a matching UUID.
*   **`[output_metadata_path]` (Optional):** The path where the JSON metadata file for this expansion operation will be saved. If omitted, a default path is generated based on the script name and a UUID (e.g., `output/expand-node/some_uuid.json`).

**Examples:**

```bash
# Expand the root node in the specified directory
python expand-node.py output/hallucinate-tree/e2dd9b38-ab19-4156-8031-bcb2db5c93a7

# Expand the node found by navigating to the 2nd subdir, then the 1st subdir
python expand-node.py output/hallucinate-tree/e2dd9b38-ab19-4156-8031-bcb2db5c93a7 1-0

# Expand the node with a UUID starting with 'e2dd9b38'
python expand-node.py output/hallucinate-tree/e2dd9b38-ab19-4156-8031-bcb2db5c93a7 e2dd9b38

# Expand the root node and save metadata to a specific file
python expand-node.py output/hallucinate-tree/e2dd9b38-ab19-4156-8031-bcb2db5c93a7 output/my_expansion_metadata.json
```

## Input

*   **Filesystem Tree:** The script requires an `<input_directory>` containing a tree structure where each node is represented by a directory.
*   **`node.json`:** Each node directory must contain a `node.json` file with at least a `"step"` (describing the task) and a `"uuid"` field.
*   **`metadata.json` (Optional):** If a `metadata.json` file exists in the `<input_directory>`, the script will attempt to read the `"model"` and `"parameters"` fields to use for the LLM interaction. Defaults are used if the file is missing or cannot be parsed.

## Key Functions

*   **`sanitize_filename(name)`:** Converts a given step name into a valid, lowercase directory name using underscores instead of spaces or invalid characters. Limits length.
*   **`find_node_by_path(base_dir, path_indices)`:** Locates a node's data (`node.json`) and its directory path within the `base_dir` by following a list of subdirectory indices (`path_indices`). Handles the root node case (empty `path_indices`).
*   **`find_node_by_uuid(search_uuid, base_dir)`:** Searches the entire filesystem tree starting from `base_dir` to find a node whose `node.json` contains a matching `uuid`.
*   **`expand_node_in_filesystem(node_data, node_dir, model, parameters, num_substeps)`:** The core function that takes a target node's data and directory, interacts with the LLM to get substeps, translates substep names to Basic English, creates sanitized directory names (Basic English + UUID), creates the subdirectories, and generates `node.json` files for each new substep.
*   **`parse_path_string(path_str)`:** Converts a dash-separated string of indices (e.g., "1-0-2") or a single number string into a list of integers.
*   **`handle_expand_node_args()`:** Parses the command-line arguments provided to the script, determining the input directory, node specifier (path or UUID), and output metadata path.
*   **`main()`:** Orchestrates the script's execution: handles arguments, finds the target node, calls the expansion function, creates metadata for the operation, and saves the output metadata.
*   **Imported `utils`:**
    *   `load_json`, `save_output`: For reading/writing JSON files.
    *   `chat_with_llm`: Interacts with the specified LLM.
    *   `parse_llm_json_response`: Parses the expected JSON array from the LLM response.
    *   `create_output_metadata`, `get_output_filepath`: Utilities for generating and saving metadata.
    *   `translate_to_basic_english`: Translates text to simplified English, used for creating directory names.

## Filesystem Interaction

*   **Reading:** The script reads `node.json` files to get task descriptions (`step`) and UUIDs. It navigates the directory structure based on either index paths or by searching for UUIDs. It also reads an optional `metadata.json` in the input directory.
*   **Writing:**
    *   Creates new subdirectories under the target node's directory for each generated substep.
    *   Directory names are generated by:
        1.  Translating the LLM-generated substep text to Basic English.
        2.  Sanitizing the Basic English text (lowercase, underscores, limited length).
        3.  Appending `_` and the full UUID of the substep. (e.g., `prepare_warm_water_b06cfe1f-7104-48eb-8fe4-e0ceb140a1b3`)
    *   Writes a new `node.json` file inside each created subdirectory, containing the original substep text, the new substep's UUID, and the parent node's UUID.

## LLM Interaction

1.  **Substep Generation:** The script constructs a prompt asking the LLM (specified by `model` and `parameters`, potentially read from `metadata.json`) to break down the target node's `"step"` text into a specified range of detailed substeps (defaulting to 3-7).
2.  **JSON Formatting:** The prompt explicitly requests the LLM to return *only* a valid JSON array of objects, where each object has a `"step"` field containing the substep description.
3.  **Response Parsing:** The `parse_llm_json_response` utility is used to extract the list of substep objects from the LLM's raw text response.
4.  **Basic English Translation:** For each generated substep, `translate_to_basic_english` is called to get a simplified version of the step text, which is then used to create a more readable and filesystem-friendly directory name.

## Output

1.  **Filesystem Modifications:** The primary output is the creation of new subdirectories and corresponding `node.json` files under the expanded node's directory, representing the generated substeps.
2.  **Metadata File:** A JSON file is saved (either to the specified path or a default location) containing metadata about the expansion process. This includes:
    *   General run information (script name, timestamp, UUID of the run).
    *   Details of the node that was expanded (step, UUID, directory).
    *   A list of the newly created nodes (step, UUID, directory).
    *   The number of substeps created.