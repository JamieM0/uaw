# Current Implementations Assessment

This script analyzes the current state of automation for a given topic. It identifies key process steps, assesses the automation level for each step across different production scales (Low, Medium, High) using a Large Language Model (LLM), and provides explanations for the assessments.

## Purpose

The primary goal of this script is to generate a structured assessment of how automated the various processes related to a specific topic currently are. It leverages an LLM to analyze the topic and provide ratings and descriptions.

## Usage

The script is executed from the command line:

```bash
python current-implementations.py <input_json> [output_json] [-saveInputs] [-uuid="UUID"] [-flow_uuid="FLOW-UUID"]
```

*   `<input_json>`: (Required) Path to the input JSON file containing the topic and LLM parameters.
*   `[output_json]`: (Optional) Path to save the output JSON file. If not provided, a path is generated based on the script name and a UUID.
*   `-saveInputs`: (Optional) Flag to save the prompts sent to the LLM in the `flow/<flowUUID>/inputs/` directory.
*   `-uuid="UUID"`: (Optional) Specify a custom UUID for the output file generation.
*   `-flow_uuid="FLOW-UUID"`: (Optional) Specify a UUID for the flow, used for saving inputs if `-saveInputs` is active.

## Input Files

The script requires an input JSON file (`<input_json>`) with the following structure:

```json
{
  "topic": "The topic to be assessed",
  "model": "gemma3", // Or another LLM model identifier
  "parameters": {
    // Optional LLM parameters (e.g., temperature, max_tokens)
  }
}
```

## Key Functions

*   `sanitize_json_string(json_str)`: Removes invalid control characters from a string to prepare it for JSON parsing.
*   `extract_json_from_response(response)`: Attempts to extract and parse a valid JSON object from the LLM's response string. It handles direct JSON, JSON within Markdown code fences (```json ... ``` or ``` ... ```), and JSON enclosed in curly braces `{...}`.
*   `generate_implementation_assessment(input_data, save_inputs=False)`: Orchestrates the assessment generation. It extracts data from the input, constructs the system and user prompts for the LLM, calls `chat_with_llm`, and uses `extract_json_from_response` to get the structured data. Optionally saves input prompts.
*   `main()`: The main execution function. It handles command-line arguments using `handle_command_args`, loads the input JSON using `load_json`, calls `generate_implementation_assessment`, creates output metadata using `create_output_metadata`, determines the output path using `get_output_filepath`, and saves the final combined output using `save_output`.
*   **Utility Functions (from `utils.py`)**: The script also relies on several functions imported from `utils.py`, including `load_json`, `save_output`, `chat_with_llm`, `create_output_metadata`, `get_output_filepath`, `handle_command_args`, and `saveToFile`.

## LLM Interaction

1.  **Prompt Construction**: A detailed system prompt instructs the LLM to act as an automation analyst, identify process steps for the given topic, assess automation levels ('None', 'Low', 'Medium', 'High') for each step at Low, Medium, and High production scales, provide explanations, and format the output strictly as JSON. The user prompt simply provides the topic.
2.  **API Call**: The `chat_with_llm` function (from `utils.py`) is used to send the prompts to the specified LLM (`model` from input).
3.  **Expected Response**: The script expects the LLM to return *only* a valid JSON object containing:
    *   `process_steps`: An array where each object has `step_name`, `description`, `automation_levels` (object with `low_scale`, `medium_scale`, `high_scale`), and `explanation`.
    *   `overall_assessment`: A string summarizing the overall automation landscape.

## JSON Handling

Because LLM output can sometimes include extra text or formatting inconsistencies, the script employs robust JSON handling:
*   `sanitize_json_string`: Cleans the raw response string by removing characters that would invalidate JSON.
*   `extract_json_from_response`: Tries multiple strategies (direct parsing, code fence extraction, brace extraction) to reliably isolate and parse the JSON payload from the LLM's potentially noisy response. This ensures the script can proceed even if the LLM doesn't perfectly adhere to the "JSON only" instruction.

## Output

The script generates a JSON output file containing:
*   `process_metadata`: Information about the script execution, including the process name, start time, and a unique UUID.
*   `implementation_assessment`: The structured JSON data received and successfully extracted from the LLM, detailing the process steps, automation levels, explanations, and the overall assessment.