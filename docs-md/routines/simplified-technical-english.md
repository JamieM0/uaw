# Simplified Technical English (STE) Conversion

This script uses a Large Language Model (LLM) to convert input text into Simplified Technical English (STE). It follows a defined set of STE rules to ensure clarity, conciseness, and consistency in technical documentation.

## Purpose

The primary goal of this script is to take a given text input (provided in a JSON file) and transform it into Simplified Technical English using an LLM, adhering to specified formatting and success criteria.

## Usage

To run the script, use the following command in your terminal:

```bash
python simplified-technical-english.py <input_json> [output_json]
```

*   `<input_json>`: (Required) Path to the input JSON file containing the text and parameters.
*   `[output_json]`: (Optional) Path where the output JSON file should be saved. If not provided, a path is generated automatically in the `output/` directory based on the script name and a UUID.

The script utilizes the `handle_command_args` function from the `utils` module to parse these command-line arguments.

## Input Files

The script expects an input JSON file with the following structure:

```json
{
  "input_text": [
    "Paragraph 1 of the text to be converted.",
    "Paragraph 2, potentially longer and more complex."
  ],
  "output_format": "A description of the desired output format (e.g., 'list of short sentences', 'step-by-step instructions').",
  "model": "The identifier of the LLM to use (e.g., 'ollama/llama3').",
  "parameters": {
    "temperature": 0.5
    // Other LLM parameters can be included here
  },
  "success_criteria": {
    "max_sentence_length": 20,
    "voice": "active"
    // Other criteria defining successful conversion
  }
}
```

*   `input_text` (list of strings): The text content to be converted, typically split into paragraphs or logical sections.
*   `output_format` (string): Specifies the desired format for the STE output.
*   `model` (string): The identifier for the LLM used for the conversion.
*   `parameters` (dict, optional): Parameters to pass to the LLM (e.g., temperature, top_p).
*   `success_criteria` (dict/list, optional): Criteria that the LLM should aim to meet in the output.

## Key Functions

*   **`translate_simplified_technical_english(input_data)`**:
    *   Takes the loaded input data dictionary as an argument.
    *   Constructs the system and user prompts for the LLM based on the input data.
    *   Calls the `chat_with_llm` utility function to interact with the specified LLM.
    *   Returns the raw text content received from the LLM.
*   **`main()`**:
    *   Handles command-line arguments using `handle_command_args`.
    *   Loads the input JSON file using `load_json`.
    *   Calls `translate_simplified_technical_english` to perform the conversion.
    *   Processes the raw LLM output text into a list of strings (`output_lines`).
    *   Determines the output file path using `get_output_filepath`.
    *   Creates metadata for the output file using `create_output_metadata`.
    *   Combines metadata and the processed text into a final dictionary.
    *   Saves the final dictionary to a JSON file using `save_output`.
*   **Utility Functions (`utils.py`)**:
    *   `load_json`: Loads data from a JSON file.
    *   `save_output`: Saves data to a JSON file.
    *   `chat_with_llm`: Handles the interaction with the LLM API.
    *   `create_output_metadata`: Generates standard metadata (task name, timestamp, UUID).
    *   `get_output_filepath`: Determines the output file path, generating one if necessary.
    *   `handle_command_args`: Parses command-line arguments for input/output file paths.

## LLM Interaction

The script interacts with the LLM by providing two main prompts:

1.  **System Prompt**: This prompt instructs the LLM on its role and the rules it must follow. It explicitly lists the 10 core rules of Simplified Technical English:
    *   Use only approved technical words for your technical domain.
    *   Keep sentences short (20 words or less).
    *   Use simple present tense when possible.
    *   Be specific and avoid ambiguity.
    *   Use active voice instead of passive.
    *   One instruction per sentence.
    *   Use articles (the, a, an) consistently.
    *   Use the same term consistently for each concept.
    *   Avoid slang, jargon, and colloquialisms.
    *   Use approved technical vocabulary only.
2.  **User Prompt**: This prompt contains the specific task details:
    *   The input text, joined together from the `input_text` list.
    *   The desired `output_format`.
    *   If provided, the `success_criteria` are included as a JSON string.

The `chat_with_llm` function sends these prompts along with any specified `parameters` to the designated LLM and retrieves the generated text response.

## Output Processing

The raw text response obtained from the LLM is processed before saving:

1.  The response string is split into segments using double newlines (`\n\n`) as delimiters. This attempts to separate paragraphs or distinct blocks of text.
2.  Each segment is stripped of leading/trailing whitespace.
3.  Only non-empty segments are kept.
4.  These processed segments are stored as a list of strings in the `output_lines` variable.

## Output

The script generates a JSON output file containing:

*   **Metadata**: Information about the process, including the task name ("Simplified Technical English conversion"), start time, and a unique identifier (UUID), generated by `create_output_metadata`.
*   **`output_text`**: A list of strings, where each string represents a paragraph or line of the STE-converted text as processed from the LLM response.

Example Output Structure:

```json
{
  "task_name": "Simplified Technical English conversion",
  "start_time": "YYYY-MM-DDTHH:MM:SS.ffffff",
  "end_time": "YYYY-MM-DDTHH:MM:SS.ffffff",
  "duration_seconds": 10.5,
  "uuid": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "output_text": [
    "This is the first sentence converted to STE.",
    "This is the second sentence, also in STE.",
    "Follow this instruction carefully."
  ]
}