# Automation Timeline Generation

This script generates a historical timeline and future predictions for automation technologies related to a specific topic. It utilizes a Large Language Model (LLM) to create the timeline content based on the provided topic.

## Purpose

The primary goal of this script is to produce a structured timeline detailing the evolution and projected future of automation within a given domain. It leverages an LLM to synthesize historical data and make informed predictions.

## Usage

The script is executed from the command line:

```bash
python generate_automation_timeline.py <input_json> [output_json] [-saveInputs] [-uuid="UUID"] [-flow_uuid="FLOW-UUID"]
```

**Arguments:**

*   `<input_json>`: (Required) Path to the input JSON file containing the topic and configuration.
*   `[output_json]`: (Optional) Path where the output JSON timeline should be saved. If not provided, a default path is generated based on the topic and a UUID.
*   `-saveInputs`: (Optional) Flag to save the system and user prompts sent to the LLM into the `flow/<flowUUID>/inputs/` directory. Requires `-flow_uuid` to be set.
*   `-uuid="UUID"`: (Optional) Custom UUID to use for the output file generation.
*   `-flow_uuid="FLOW-UUID"`: (Optional) UUID representing the overarching flow this script execution is part of. Used for organizing saved inputs if `-saveInputs` is active.

## Input Files

The script expects an input JSON file (`<input_json>`) with the following structure:

```json
{
  "topic": "Your Automation Topic",
  "model": "gemma3", // Or another LLM model identifier
  "parameters": {
    // Optional LLM parameters (e.g., temperature, top_p)
  },
  "timeline": { // Optional: If provided, bypasses LLM generation
    "historical": {
      "1920s": "Description...",
      // ... other decades
    },
    "predictions": {
      "2030s": "Prediction...",
      // ... other future decades
    }
  }
}
```

*   `topic`: The subject for which the automation timeline should be generated.
*   `model`: The identifier for the LLM to use (defaults to "gemma3" if not specified).
*   `parameters`: An object containing any specific parameters to pass to the LLM during generation.
*   `timeline`: (Optional) If this key exists and contains `historical` and `predictions` objects, the script will use this data directly instead of querying the LLM.

## Key Functions

*   **`generate_automation_timeline(input_data, save_inputs=False)`**:
    *   Extracts `topic`, `model`, and `parameters` from the input data.
    *   Checks if a `timeline` already exists in the input; if so, returns it directly.
    *   Constructs system and user prompts for the LLM, requesting a historical timeline (by decade, 1920s-present) and future predictions (by decade until full automation).
    *   Optionally saves the prompts using `utils.saveToFile` if `save_inputs` is True.
    *   Calls `utils.chat_with_llm` to interact with the specified LLM.
    *   Parses the expected JSON response using `utils.parse_llm_json_response`.
    *   Returns the parsed timeline dictionary or `None` on error.
*   **`main()`**:
    *   Handles command-line arguments using `utils.handle_command_args`.
    *   Sets the global `flowUUID` if provided.
    *   Loads the input JSON using `utils.load_json`.
    *   Calls `generate_automation_timeline` to get the timeline data.
    *   Determines the output file path using `utils.get_output_filepath`.
    *   Creates process metadata (script name, start time, UUID) using `utils.create_output_metadata`.
    *   Combines metadata and the generated `timeline` into the final output data structure.
    *   Saves the output data to the determined path using `utils.save_output`.
*   **`utils` Functions**: The script relies on helper functions imported from `utils.py` for common tasks like loading/saving JSON (`load_json`, `save_output`, `saveToFile`), interacting with the LLM (`chat_with_llm`), parsing LLM responses (`parse_llm_json_response`), creating metadata (`create_output_metadata`), determining file paths (`get_output_filepath`), and handling arguments (`handle_command_args`).

## LLM Interaction

1.  **Prompt Construction**: A system prompt instructs the LLM to act as an AI specialized in automation timelines. The user prompt specifies the `topic` and requests:
    *   Historical developments by decade (1920s-present).
    *   Future predictions by decade until full automation.
    *   Output formatted as a JSON object with `historical` and `predictions` keys, where each key holds an object mapping decades (e.g., "1950s", "2040s") to descriptive strings.
2.  **API Call**: The `chat_with_llm` function sends these prompts to the specified LLM (`model`).
3.  **Response Parsing**: The script expects the LLM to return a valid JSON string matching the requested format. `parse_llm_json_response` attempts to decode this JSON.
4.  **Bypass**: If the input JSON already contains a `timeline` key, the LLM interaction steps are skipped entirely, and the provided timeline is used instead.

## Output

The script generates a JSON file (at `[output_json]` or a default path) containing:

```json
{
  "process_metadata": {
    "script_name": "Automation Timeline Generation",
    "start_time": "YYYY-MM-DD HH:MM:SS.ffffff",
    "end_time": "YYYY-MM-DD HH:MM:SS.ffffff",
    "duration_seconds": 12.345,
    "uuid": "generated-or-provided-uuid"
  },
  "timeline": {
    "historical": {
      "1920s": "...",
      // ... other decades
    },
    "predictions": {
      "2030s": "...",
      // ... other future decades
    }
  }
}
```

*   `process_metadata`: Information about the script execution.
*   `timeline`: The core output, containing the `historical` and `predictions` data, either generated by the LLM or taken directly from the input file.