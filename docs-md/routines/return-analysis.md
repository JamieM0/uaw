# Automation ROI Analysis

This script utilizes a Large Language Model (LLM) to generate a structured Return on Investment (ROI) analysis for implementing automation technologies related to a specific topic. It processes an input JSON file containing the topic and optional model parameters, interacts with the LLM, parses the response, and saves the structured analysis along with metadata to an output JSON file.

## Purpose

The primary goal of `return-analysis.py` is to automate the generation of ROI assessments for automation projects. It prompts an LLM to analyze the potential returns across small, medium, and large production scales, providing insights into investment, savings, benefits, barriers, and recommendations in a standardized JSON format.

## Usage

The script is executed from the command line:

```bash
python return-analysis.py <input_json> [output_json] [-saveInputs] [-uuid="UUID"] [-flow_uuid="FLOW-UUID"]
```

*   `<input_json>`: (Required) Path to the input JSON file containing the analysis parameters.
*   `[output_json]`: (Optional) Path where the output JSON file should be saved. If omitted, a default path is generated based on the script name and a UUID.
*   `-saveInputs`: (Optional) Flag to save the system and user prompts sent to the LLM into the `flow/<flowUUID>/inputs/` directory.
*   `-uuid="UUID"`: (Optional) Specify a custom UUID for the output file metadata.
*   `-flow_uuid="FLOW-UUID"`: (Optional) Specify the UUID for the flow, used for saving inputs if `-saveInputs` is active.

## Input Files

The script expects an input JSON file with the following structure:

```json
{
  "topic": "The specific area or process for automation ROI analysis",
  "model": "gemma3", // Optional: Specify the LLM model (defaults if not provided)
  "parameters": {} // Optional: Additional parameters for the LLM call
}
```

*   `topic`: A string describing the subject of the ROI analysis.
*   `model`: (Optional) The identifier for the LLM to use (e.g., "gemma3").
*   `parameters`: (Optional) A JSON object containing any specific parameters for the LLM interaction (handled by `utils.chat_with_llm`).

## Key Functions

*   **`sanitize_json_string(json_str)`**: Removes invalid control characters (ASCII 0-31, excluding tab, newline, carriage return) from a string to prevent JSON parsing errors.
*   **`extract_json_from_response(response)`**: Attempts to extract and parse a valid JSON object from the LLM's raw response string. It tries:
    1.  Direct parsing of the (sanitized) response.
    2.  Extracting content within JSON code fences (e.g., ```json ... ```).
    3.  Extracting content within the first opening `{` and last closing `}`.
    Returns the parsed JSON object or `None` if parsing fails.
*   **`generate_roi_analysis(input_data, save_inputs=False)`**: Orchestrates the ROI analysis generation. It extracts the `topic`, `model`, and `parameters` from the input, constructs the system and user prompts, optionally saves the prompts using `utils.saveToFile`, calls `utils.chat_with_llm` to get the LLM response, and uses `extract_json_from_response` to parse the result.
*   **`main()`**: The main execution function. It handles command-line arguments using `utils.handle_command_args`, loads the input JSON using `utils.load_json`, calls `generate_roi_analysis`, determines the output path using `utils.get_output_filepath`, creates metadata using `utils.create_output_metadata`, combines metadata with the analysis results, and saves the final output using `utils.save_output`. It exits if `generate_roi_analysis` fails to return valid JSON data.
*   **`utils` Functions**: Relies on helper functions from `utils.py` for common tasks like loading JSON (`load_json`), saving output (`save_output`), interacting with the LLM (`chat_with_llm`), creating metadata (`create_output_metadata`), determining file paths (`get_output_filepath`), handling arguments (`handle_command_args`), and saving intermediate files (`saveToFile`).

## LLM Interaction

The script crafts specific prompts for the LLM:

*   **System Prompt**: Instructs the LLM to act as an AI assistant specialized in ROI analysis for automation, focusing on small, medium, and large production scales.
*   **User Prompt**: Provides the specific `topic` and explicitly requests the output in a JSON format with a defined structure:
    *   `roi_analysis`: An object containing keys `small_scale`, `medium_scale`, `large_scale`. Each scale object must include:
        *   `timeframe`: Typical ROI timeframe (string).
        *   `initial_investment`: Estimated investment range (string).
        *   `annual_savings`: Estimated annual savings (string).
        *   `key_considerations`: Array of factors affecting ROI at that scale.
    *   `key_benefits`: An array of significant benefits across all scales.
    *   `barriers`: An array of common challenges to achieving ROI.
    *   `recommendation`: A brief suggestion on which scale benefits most.
    The prompt strongly emphasizes returning *only* the valid JSON object without any surrounding text or formatting.
*   The interaction is performed using the `utils.chat_with_llm` function.

## JSON Handling

Robust JSON handling is crucial as LLM output can be inconsistent.
*   `sanitize_json_string` preprocesses the LLM response to remove characters that would cause `json.loads` to fail.
*   `extract_json_from_response` implements a multi-stage parsing strategy:
    1.  It first tries to parse the entire sanitized response directly.
    2.  If that fails, it looks for JSON content enclosed in ```json ... ``` or ``` ... ``` code fences.
    3.  If still unsuccessful, it attempts to parse the content between the first `{` and the last `}` in the response.
This approach increases the likelihood of successfully extracting the desired JSON data even if the LLM includes extraneous text or formatting.

## Output

The script generates a JSON file containing:

1.  **Process Metadata**: Information about the script execution, including the task name ("Automation ROI Analysis"), start time, and a unique UUID, generated by `utils.create_output_metadata`.
2.  **ROI Analysis**: The `roi_analysis` key holds the structured JSON object parsed from the LLM response, containing the detailed analysis across different scales, benefits, barriers, and the recommendation.

Example Output Structure:

```json
{
  "process_metadata": {
    "task_name": "Automation ROI Analysis",
    "start_time": "YYYY-MM-DDTHH:MM:SS.ffffff",
    "end_time": "YYYY-MM-DDTHH:MM:SS.ffffff",
    "duration_seconds": 15.234,
    "uuid": "generated-or-specified-uuid"
  },
  "roi_analysis": {
    "roi_analysis": {
      "small_scale": {
        "timeframe": "...",
        "initial_investment": "...",
        "annual_savings": "...",
        "key_considerations": ["...", "..."]
      },
      "medium_scale": { /* ... */ },
      "large_scale": { /* ... */ }
    },
    "key_benefits": ["...", "..."],
    "barriers": ["...", "..."],
    "recommendation": "..."
  }
}
```

If the script cannot extract or parse valid JSON from the LLM response after trying all methods in `extract_json_from_response`, it prints an error message and exits with a non-zero status code.