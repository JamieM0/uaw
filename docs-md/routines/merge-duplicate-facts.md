# Merge Duplicate Facts

This script utilizes a Large Language Model (LLM) to process a list of facts provided in an input JSON file. It identifies duplicate or semantically similar facts, merges them into comprehensive, unique statements, and outputs the deduplicated list along with metadata to a new JSON file.

## Purpose

The primary goal of this script is to reduce redundancy in a list of factual statements by leveraging an LLM's understanding of language to consolidate similar information.

## Usage

Run the script from the command line:

```bash
python merge-duplicate-facts.py <input_json> [output_json]
```

*   `<input_json>`: (Required) Path to the input JSON file containing the facts to be processed.
*   `[output_json]`: (Optional) Path where the output JSON file should be saved. If not provided, a path will be generated automatically in the `output/` directory based on the script name and a UUID.

**Note:** The script comments recommend using the model `llama3.1:8b-instruct-q5_K_M` for potentially better results, although the default is `gemma3`. This can be specified in the input JSON.

## Input Files

The script expects an input JSON file with the following structure:

```json
{
  "facts": [
    "Fact statement 1.",
    "Fact statement 2.",
    "A statement similar to fact 1."
  ],
  "model": "llama3.1:8b-instruct-q5_K_M", // Optional: Defaults to "gemma3" if omitted
  "parameters": {} // Optional: LLM parameters (e.g., temperature)
}
```

*   `facts`: A list of strings, where each string is a fact to be processed.
*   `model`: (Optional) The name of the LLM model to use (e.g., from Ollama).
*   `parameters`: (Optional) A dictionary of parameters to pass to the LLM during the chat interaction.

## Key Functions

*   **`merge_duplicate_facts(input_data)`**:
    *   Extracts the `facts`, `model`, and `parameters` from the input data.
    *   Constructs system and user messages to instruct the LLM.
    *   Calls `chat_with_llm` to interact with the specified LLM.
    *   Uses `parse_llm_json_response` to attempt parsing the LLM's response into a list of strings.
    *   Returns the list of merged facts or a default error message if parsing fails.
*   **`main()`**:
    *   Handles command-line arguments using `handle_command_args` to get input and optional output file paths.
    *   Loads the input JSON using `load_json`.
    *   Calls `merge_duplicate_facts` to perform the core logic.
    *   Determines the output file path using `get_output_filepath`.
    *   Creates metadata (script name, timestamp, UUID) using `create_output_metadata`.
    *   Combines metadata and the `merged_facts` into a final dictionary.
    *   Saves the output data to the determined path using `save_output`.
*   **`utils` Functions**: The script relies on helper functions imported from `utils.py`:
    *   `load_json`: Loads data from a JSON file.
    *   `save_output`: Saves data to a JSON file.
    *   `chat_with_llm`: Handles the interaction with the LLM service.
    *   `parse_llm_json_response`: Parses JSON content from the LLM's text response.
    *   `create_output_metadata`: Generates standard metadata for output files.
    *   `get_output_filepath`: Determines the appropriate output file path.
    *   `handle_command_args`: Parses command-line arguments.

## LLM Interaction

1.  **Prompt Construction**:
    *   A **system message** instructs the LLM that its role is to identify duplicate/similar facts, merge them comprehensively, organize logically, remove redundancy, and format the output as a JSON array of unique fact strings.
    *   A **user message** presents the list of facts (prefixed with `- `) from the input file and asks the LLM to perform the merging task.
2.  **LLM Call**: The `chat_with_llm` utility function sends these messages to the specified LLM (`model` from input or default).
3.  **Response Parsing**: The script expects the LLM to return a JSON-formatted string representing an array of unique facts. The `parse_llm_json_response` utility attempts to parse this string into a Python list.

## Output

The script generates a JSON file containing:

*   **Metadata**: Information about the script execution, including the script name (`routine_name`), a unique identifier (`uuid`), and the start time (`start_time_utc`).
*   **`merged_facts`**: A list of strings, where each string is a unique, potentially merged fact as returned and parsed from the LLM. If the LLM response cannot be parsed into a valid list, this will contain a single string: `["No valid facts could be merged"]`.

Example Output Structure:

```json
{
  "metadata": {
    "routine_name": "Merge Duplicate Facts",
    "uuid": "...",
    "start_time_utc": "..."
  },
  "merged_facts": [
    "Merged fact statement 1.",
    "Unique fact statement 2."
  ]
}