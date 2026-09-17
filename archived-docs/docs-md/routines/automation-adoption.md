# Automation Adoption

This script generates a structured breakdown of automation adoption phases for a specific topic using a Large Language Model (LLM). It analyzes the progression from basic mechanical assistance to potential future full automation within that domain.

## Purpose

The primary goal of `automation-adoption.py` is to leverage an LLM to identify and describe the distinct stages of automation adoption relevant to a user-provided topic. It prompts the LLM to detail four phases (Basic Mechanical Assistance, Integrated Semi-Automation, Advanced Automation Systems, Full End-to-End Automation) with specific examples pertinent to the topic.

## Usage

The script is executed from the command line:

```bash
python automation-adoption.py <input_json> [output_json] [-saveInputs] [-uuid="UUID"] [-flow_uuid="FLOW-UUID"]
```

*   `<input_json>`: (Required) Path to the input JSON file containing the topic and LLM parameters.
*   `[output_json]`: (Optional) Path where the output JSON file should be saved. If not provided, a default path is generated based on the script name and a UUID.
*   `-saveInputs`: (Optional) Flag to save the system and user prompts sent to the LLM into the `flow/<flowUUID>/inputs/` directory. Requires `-flow_uuid` to be set.
*   `-uuid="UUID"`: (Optional) Custom UUID to use for the output file naming and metadata. A new UUID is generated if not provided.
*   `-flow_uuid="FLOW-UUID"`: (Optional) UUID representing a larger workflow, used for organizing saved inputs when `-saveInputs` is active.

## Input Files

The script expects an input JSON file (`<input_json>`) with the following structure:

```json
{
  "topic": "The specific field or domain to analyze",
  "model": "gemma3", // Or another compatible LLM model identifier
  "parameters": {
    // Optional parameters for the LLM call (e.g., temperature, max_tokens)
  }
}
```

## Key Functions

*   `generate_automation_adoption(input_data, save_inputs=False)`:
    *   Extracts `topic`, `model`, and `parameters` from the input data.
    *   Constructs the system and user messages for the LLM prompt.
    *   Optionally saves the prompts using `utils.saveToFile` if `save_inputs` is True and `flowUUID` is set.
    *   Calls `utils.chat_with_llm` to interact with the specified LLM.
    *   Parses the expected JSON response using `utils.parse_llm_json_response`.
    *   Returns the parsed dictionary of adoption phases or `None` on error.
*   `main()`:
    *   Handles command-line arguments using `utils.handle_command_args`.
    *   Sets the global `flowUUID` if provided.
    *   Loads the input data using `utils.load_json`.
    *   Calls `generate_automation_adoption` to get the adoption phases.
    *   Determines the output file path using `utils.get_output_filepath`.
    *   Creates process metadata (script name, start time, UUID) using `utils.create_output_metadata`.
    *   Combines metadata and the generated adoption phases into a final dictionary.
    *   Saves the output data to the determined path using `utils.save_output`.
*   **Utility Functions (`utils`)**: The script relies on helper functions from `utils.py` for common tasks like loading JSON (`load_json`), saving output (`save_output`), interacting with the LLM (`chat_with_llm`), parsing LLM responses (`parse_llm_json_response`), creating metadata (`create_output_metadata`), determining file paths (`get_output_filepath`), handling arguments (`handle_command_args`), and saving intermediate files (`saveToFile`).

## LLM Interaction

The script interacts with an LLM specified in the input data.
*   **System Prompt:** Instructs the LLM to act as an AI specialized in analyzing automation adoption patterns and to identify phases from basic assistance to full automation.
*   **User Prompt:** Provides the specific `topic` and requests a detailed breakdown into four predefined phases (Basic Mechanical Assistance, Integrated Semi-Automation, Advanced Automation Systems, Full End-to-End Automation). It asks for 4-6 specific, domain-relevant examples for each phase, ensuring increasing complexity. It explicitly requests the output in a specific JSON format.
*   **Response Handling:** The script expects the LLM to return a valid JSON string matching the requested structure. It uses `parse_llm_json_response` to decode the JSON. If the response is not valid JSON, an error is printed, and the script exits.

## Output

The script generates a JSON file containing:
1.  `process_metadata`: Information about the script execution, including the script name (`process_name`), start time (`start_time_utc`), execution duration (`execution_duration_seconds`), and a unique identifier (`uuid`).
2.  `automation_adoption`: The structured data received from the LLM, containing the four phases (`phase1`, `phase2`, `phase3`, `phase4`), each with a `title`, `status`, and a list of `examples`.

Example Output Structure (`output.json`):

```json
{
  "process_metadata": {
    "process_name": "Automation Adoption Phases Generation",
    "start_time_utc": "YYYY-MM-DDTHH:MM:SS.ffffffZ",
    "execution_duration_seconds": 15.234,
    "uuid": "generated-or-provided-uuid"
  },
  "automation_adoption": {
    "phase1": {
      "title": "Basic Mechanical Assistance",
      "status": "Currently widespread",
      "examples": ["example1", "example2", ...]
    },
    "phase2": {
      "title": "Integrated Semi-Automation",
      "status": "Currently in transition",
      "examples": ["example3", "example4", ...]
    },
    "phase3": {
      "title": "Advanced Automation Systems",
      "status": "Emerging technology",
      "examples": ["example5", "example6", ...]
    },
    "phase4": {
      "title": "Full End-to-End Automation",
      "status": "Future development",
      "examples": ["example7", "example8", ...]
    }
  }
}