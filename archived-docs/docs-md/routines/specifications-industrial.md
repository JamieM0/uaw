# Industrial Specifications Generation

This script utilizes a large language model (LLM), prompted to act as an industrial engineering specialist, to generate comprehensive industrial and commercial specifications for a user-provided topic. It expects the LLM to return a structured JSON object containing detailed information relevant to professionals in the field.

## Purpose

The primary goal of this script is to automate the generation of detailed industrial specifications, including performance metrics, implementation requirements, relevant standards, key suppliers, and operational considerations for a specific topic.

## Usage

The script is executed from the command line:

```bash
python specifications-industrial.py <input_json> [output_json] [-saveInputs] [-uuid="UUID"] [-flow_uuid="FLOW-UUID"]
```

*   `<input_json>`: (Required) Path to the input JSON file containing the topic and configuration.
*   `[output_json]`: (Optional) Path where the output JSON file should be saved. If omitted, a default path is generated.
*   `-saveInputs`: (Optional) Flag to save the system and user prompts sent to the LLM into the `flow/<flowUUID>/inputs/` directory.
*   `-uuid="UUID"`: (Optional) Custom UUID for the output file metadata.
*   `-flow_uuid="FLOW-UUID"`: (Optional) UUID for the flow, used for saving inputs if `-saveInputs` is specified.

## Input Files

The script requires an input JSON file (`<input_json>`) with the following structure:

```json
{
  "topic": "The specific industrial topic (e.g., High-Volume Lithium-ion Battery Manufacturing)",
  "model": "gemma3", // Or another LLM model identifier
  "parameters": {
    // Optional LLM parameters (e.g., temperature, max_tokens)
  }
}
```

*   `topic`: A string describing the subject for which specifications are needed.
*   `model`: The identifier for the LLM to use (defaults to `gemma3` if not provided).
*   `parameters`: An optional object containing parameters to pass to the LLM during generation.

## Key Functions

*   `main()`: Parses command-line arguments using `handle_command_args`, loads the input JSON using `load_json`, orchestrates the specification generation by calling `generate_industrial_specifications`, determines the output path using `get_output_filepath`, creates metadata using `create_output_metadata`, combines metadata with the results, and saves the final output using `save_output`. It also handles setting the global `flowUUID`.
*   `generate_industrial_specifications(input_data, save_inputs=False)`: Extracts the `topic`, `model`, and `parameters` from the input data. Constructs the system and user prompts for the LLM. Optionally saves these prompts using `saveToFile` (from `utils`). Calls `chat_with_llm` (from `utils`) to interact with the LLM. Processes the LLM response using `extract_json_from_response`.
*   `extract_json_from_response(response)`: Attempts to robustly extract and parse a JSON object from the LLM's potentially messy response string. It tries direct parsing, then looks for JSON within ```json ... ``` or ``` ... ``` code fences, and finally searches for content between the first `{` and last `}`. It uses `sanitize_json_string` before attempting to parse.
*   `sanitize_json_string(json_str)`: Removes invalid control characters (ASCII 0-31, excluding tab, newline, carriage return) from a string using regular expressions to prevent JSON parsing errors.
*   **Utility Functions (`utils`)**: The script relies heavily on shared functions from `utils.py`, including `load_json`, `save_output`, `chat_with_llm`, `create_output_metadata`, `get_output_filepath`, `handle_command_args`, and `saveToFile`.

## LLM Interaction

The script crafts specific prompts to guide the LLM:

*   **System Prompt**: Instructs the LLM to act as an AI assistant specialized in industrial engineering and specifications. It requests a comprehensive overview for the given topic, including performance metrics and implementation requirements, emphasizing precision with numerical values/ranges and practical technical details relevant to professionals.
*   **User Prompt**: Provides the specific `topic` from the input file. It explicitly requests the output format as a JSON object with specific top-level keys:
    *   `performance_metrics`: Array of objects (name, value/range, description).
    *   `implementation_requirements`: Array of objects (name, specification, description).
    *   `industry_standards`: Array of relevant standards/certifications.
    *   `key_suppliers`: Array of major equipment/technology suppliers.
    *   `operational_considerations`: Array of important operational factors.
    The prompt stresses the need for realistic values for industrial/commercial scale and demands *only* valid JSON output, without any surrounding text or formatting.
*   **LLM Call**: The `chat_with_llm` function (from `utils`) is used to send these prompts to the specified LLM and retrieve the response.

## JSON Handling

Robust JSON handling is crucial due to the variability of LLM outputs:

*   **Sanitization (`sanitize_json_string`)**: Before any parsing attempt, the raw LLM response is cleaned to remove control characters that are invalid in JSON strings but might be present in the LLM output.
*   **Extraction (`extract_json_from_response`)**: This function implements a multi-stage strategy to find and parse the JSON:
    1.  Tries parsing the sanitized response directly.
    2.  If that fails, looks for markdown code fences (```json ... ``` or ``` ... ```) and attempts to parse the content within them.
    3.  If that fails, finds the first opening curly brace `{` and the last closing curly brace `}` and attempts to parse the substring between them.
    This approach increases the likelihood of successfully extracting the desired JSON even if the LLM includes introductory text, explanations, or incorrect formatting. These helper functions are identical to those used in `return-analysis.py`.

## Output

The script generates a JSON file (at the path determined by `get_output_filepath` or specified by the user) containing:

*   `process_metadata`: Standard metadata including script name, start time, duration, and UUID (generated by `create_output_metadata`).
*   `industrial_specifications`: The structured JSON object containing the specifications as generated by the LLM and successfully parsed by `extract_json_from_response`.

If `extract_json_from_response` fails to return a valid JSON object from the LLM response, the script prints an error message, shows the raw response, and exits with a non-zero status code.