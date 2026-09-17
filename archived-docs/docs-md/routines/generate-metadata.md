# Page Metadata Generation

This script generates standardized metadata for a technical topic page. It can either use pre-existing metadata provided in the input or leverage a Large Language Model (LLM) to generate new metadata based on the topic name.

## Purpose

The primary goal of `generate-metadata.py` is to create consistent and informative metadata for pages within a knowledge base or wiki, specifically focusing on automation topics. This metadata includes a title, subtitle, automation status, progress percentage, and a descriptive explanation.

## Usage

The script is executed from the command line:

```bash
python generate-metadata.py <input_json> [output_json] [-saveInputs] [-uuid="UUID"] [-flow_uuid="FLOW-UUID"]
```

*   `<input_json>`: (Required) Path to the input JSON file containing topic information.
*   `[output_json]`: (Optional) Path where the output JSON containing the generated metadata should be saved. If not provided, a path is automatically generated based on the process name and a UUID.
*   `-saveInputs`: (Optional) Flag to save the system and user messages sent to the LLM into the `flow/<flowUUID>/inputs/` directory. Requires `-flow_uuid` to be set.
*   `-uuid="UUID"`: (Optional) Specify a custom UUID for the output file naming and process metadata.
*   `-flow_uuid="FLOW-UUID"`: (Optional) Specify a UUID for the overall flow, used for organizing saved inputs when `-saveInputs` is active.

## Input Files

The script expects an input JSON file (`<input_json>`) with the following structure:

```json
{
  "topic": "Name of the Technical Topic",
  "model": "gemma3", // Optional: LLM model to use (defaults if not provided)
  "parameters": {}, // Optional: Parameters for the LLM call
  "metadata": { // Optional: Pre-existing metadata object
    "title": "Existing Title",
    "subtitle": "Existing Subtitle",
    "automation_status": "Some Automation",
    "automation_percentage": "40%",
    "explanation": "Existing explanation text..."
  }
}
```

If the `metadata` key exists in the input JSON, its value will be used directly, bypassing the LLM generation step.

## Key Functions

*   **`generate_page_metadata(input_data, save_inputs=False)`**:
    *   Checks if `input_data` contains a `metadata` key. If yes, returns that metadata.
    *   If no pre-existing metadata, it constructs system and user prompts based on the `topic`.
    *   Optionally saves prompts using `saveToFile` if `save_inputs` is True and `flowUUID` is set.
    *   Calls the LLM using `chat_with_llm`.
    *   Parses the LLM's JSON response using `parse_llm_json_response`.
    *   Returns the parsed metadata dictionary.
*   **`main()`**:
    *   Handles command-line arguments using `handle_command_args`.
    *   Sets the global `flowUUID`.
    *   Loads the input JSON using `load_json`.
    *   Calls `generate_page_metadata` to get the metadata.
    *   Determines the output file path and UUID using `get_output_filepath`.
    *   Creates process metadata (script name, start time, UUID) using `create_output_metadata`.
    *   Combines process metadata and page metadata into a final dictionary.
    *   Saves the output JSON using `save_output`.
*   **Imported `utils` functions**:
    *   `load_json`, `save_output`: Handle file I/O for JSON data.
    *   `chat_with_llm`: Interacts with the specified LLM.
    *   `parse_llm_json_response`: Extracts JSON content from the LLM response string.
    *   `create_output_metadata`: Generates standard metadata about the script execution.
    *   `get_output_filepath`: Determines the appropriate path for saving output files.
    *   `handle_command_args`: Parses arguments passed via the command line.
    *   `saveToFile`: Saves content (like LLM prompts) to a specified file path.

## Metadata Generation Logic

The script follows two main paths for obtaining metadata:

1.  **Pre-existing Metadata:** If the input JSON file contains a top-level key named `"metadata"`, the script assumes this object contains the required metadata fields and uses it directly. The LLM is not called in this case.
2.  **LLM Generation:** If the `"metadata"` key is *not* present in the input JSON, the script proceeds to generate it using an LLM:
    *   It constructs a system prompt instructing the AI to act as a metadata specialist for technical topics.
    *   It constructs a user prompt containing the specific `topic` from the input file.
    *   It calls the `chat_with_llm` function with these prompts, the specified model, and any parameters.
    *   The response from the LLM, expected to be a JSON object, is parsed using `parse_llm_json_response`.

## LLM Interaction

When generating metadata via the LLM, the script specifically requests the following fields in JSON format:

*   `title`: A short (2-3 words max), descriptive title based on the topic. No subtitles (text after a semicolon) should be included.
*   `subtitle`: A brief explanation of the topic's scope.
*   `automation_status`: The current level of automation, chosen from a predefined list (No Automation, Very Early Automation, Early Automation, Some Automation, Partially Fully Automated, Mostly Fully Automated, Fully Automated).
*   `automation_percentage`: An estimated percentage (e.g., "25%") representing progress towards full automation. The prompt emphasizes being critical and avoiding exaggeration.
*   `explanation`: 2-3 full paragraphs describing the topic and its automation journey.

The interaction relies on the `chat_with_llm` utility function for the API call and `parse_llm_json_response` to reliably extract the JSON block from the potentially verbose LLM response.

## Output

The script generates a JSON output file (at the path specified by `[output_json]` or an auto-generated path). This file contains:

1.  **Process Metadata:** Information about the script execution itself (e.g., script name, timestamp, UUID), generated by `create_output_metadata`.
2.  **Page Metadata:** The core metadata for the topic, under the key `"page_metadata"`. This is either the metadata object passed directly from the input file or the JSON object generated by the LLM.

Example Output Structure:

```json
{
  "process_name": "Page Metadata Generation",
  "start_time": "2023-10-27T10:00:00.123456",
  "end_time": "2023-10-27T10:00:05.678910",
  "duration_seconds": 5.555,
  "uuid": "generated-or-specified-uuid",
  "page_metadata": {
    "title": "Topic Title",
    "subtitle": "Scope explanation.",
    "automation_status": "Some Automation",
    "automation_percentage": "30%",
    "explanation": "Paragraph 1 describing the topic...\n\nParagraph 2 detailing automation journey..."
  }
}