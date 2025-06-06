# Step Extraction

This script extracts actionable step-by-step instructions from a given input text (like an article, recipe, or guide) using a Large Language Model (LLM). It processes the input, interacts with the LLM, parses the response, and saves the extracted steps along with metadata to an output JSON file.

## Purpose

The primary goal of `extract-steps.py` is to distill longer texts into a concise, ordered list of actionable steps. It leverages an LLM to understand the input content and identify the core instructions, filtering out extraneous information.

## Usage

The script is executed from the command line:

```bash
python extract-steps.py <input_json> [output_json]
```

*   `<input_json>`: (Required) Path to the input JSON file containing the text and configuration.
*   `[output_json]`: (Optional) Path where the output JSON file should be saved. If not provided, a path is automatically generated based on the script name and a UUID (e.g., `output/extract-steps_<uuid>.json`).

The script uses the `handle_command_args` utility function to parse these arguments.

## Input Files

The script expects an input JSON file with the following structure:

```json
{
  "article_text": [
    "Line 1 of the article.",
    "Line 2 of the article.",
    "..."
  ],
  "model": "gemma3", // Or another model identifier
  "parameters": { // Optional LLM parameters
    "temperature": 0.7
    // ... other parameters
  }
}
```

*   `article_text`: A list of strings, where each string is a line or segment of the input text.
*   `model`: The identifier for the LLM to be used (e.g., "gemma3").
*   `parameters`: (Optional) A dictionary of parameters to pass to the LLM during the generation process (e.g., temperature, max tokens).

## Key Functions

*   **`extract_step(input_data)`**: This is the core function responsible for preparing the prompt, interacting with the LLM, and processing the response to extract steps. It takes the loaded input data dictionary as an argument.
*   **`main()`**: The main execution function. It handles command-line arguments, loads the input JSON, calls `extract_step`, creates output metadata, determines the output file path, combines metadata with the extracted steps, and saves the final output JSON.
*   **Utility Functions (`utils.py`)**:
    *   `load_json`: Loads data from the input JSON file.
    *   `save_output`: Saves the processed data to the output JSON file.
    *   `chat_with_llm`: Handles the communication with the specified LLM, sending the system and user prompts.
    *   `parse_llm_json_response`: Parses the LLM's response. In this script, it's used with `include_children=False`, suggesting it primarily expects a simple list format or line-separated text rather than complex nested JSON.
    *   `create_output_metadata`: Generates standard metadata (like task name, start time, UUID) for the output file.
    *   `get_output_filepath`: Determines the final output file path, either using the user-specified path or generating one automatically.
    *   `handle_command_args`: Parses command-line arguments for input and output file paths.

## LLM Interaction

The script constructs specific prompts for the LLM:

*   **System Prompt**: Instructs the LLM to act as an AI assistant specialized in extracting actionable steps. It provides detailed guidelines: extract only necessary steps, keep them concise and clear, maintain logical order, and output them as a simple list with each step on a new line, without any numbering or formatting. An example input and expected output are provided for clarity.
*   **User Prompt**: Contains the actual `article_text` (joined into a single string) and reiterates the key requirements for the output format (concise, ordered, simple list, one step per line).

The `chat_with_llm` function sends these prompts to the specified `model` along with any optional `parameters`.

## Output Processing

The raw text response from the LLM is processed using `parse_llm_json_response(response_text, include_children=False)`. Based on the prompt's instructions, the script expects the LLM to return a simple text response where each line represents a single step.

The `parse_llm_json_response` function (likely) first attempts to parse the response as JSON. If that fails (which is expected given the prompt), it probably falls back to splitting the text by newlines to create a list of strings. Each string (step) is then likely wrapped in a dictionary structure.

If the parsing process fails to produce a valid list (e.g., the LLM response is empty or malformed), the function returns a default list containing a single object indicating failure: `[{"step": "No valid steps could be extracted"}]`.

## Output

The script generates a JSON output file containing:

*   **Metadata**: Information about the process, generated by `create_output_metadata` (e.g., `task_name`, `start_time`, `uuid`).
*   **`steps`**: A list containing the extracted steps. Based on the processing logic and fallback, this is expected to be a list of dictionaries, where each dictionary has a `step` key holding the text of a single extracted instruction.

Example Output Structure:

```json
{
  "task_name": "Extract Steps",
  "start_time": "...",
  "end_time": "...",
  "duration": "...",
  "uuid": "...",
  "model": "gemma3", // From input
  "steps": [
    {"step": "Crack eggs into a bowl and whisk."},
    {"step": "Add salt, pepper, and a splash of milk."},
    {"step": "Heat a pan over medium heat and add butter."},
    {"step": "Pour in eggs and let them sit before stirring."},
    {"step": "Cook until just set, then fold and serve."}
  ]
}