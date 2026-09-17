# Text Summarization

This script utilizes a large language model (LLM) to generate a concise summary of input text provided in a JSON file. It processes the input, interacts with the LLM via a utility function, and saves the resulting summary along with metadata to an output JSON file.

## Purpose

The primary goal of this script is to automate the process of text summarization. It takes a potentially long text input and produces a shorter, coherent summary that captures the main points.

## Usage

To run the script, use the following command in your terminal:

```bash
python summary.py <input_json> [output_json]
```

*   `<input_json>`: (Required) Path to the input JSON file containing the text to be summarized and configuration.
*   `[output_json]`: (Optional) Path where the output JSON file containing the summary and metadata should be saved. If not provided, a default path is generated based on the script name and a UUID.

The script uses the `handle_command_args` utility function to parse these command-line arguments.

## Input Files

The script expects an input JSON file with the following structure:

*   `input_text`: (Required) A list of strings. These strings will be joined together to form the full text to be summarized.
*   `model`: (Required) The identifier for the LLM to be used (e.g., "gemma3").
*   `parameters`: (Optional) A dictionary of parameters to pass to the LLM during the chat interaction (e.g., temperature, top\_p). Defaults to an empty dictionary if not provided.
*   `max_length`: (Optional) An integer specifying a desired maximum length for the summary. *Note: While this value is read from the input, it is not currently used in the prompt sent to the LLM.* Defaults to 200 if not provided.

Example (`examples/summary-in.json`):
```json
{
  "input_text": [
    "The Industrial Revolution, starting in Great Britain around 1760, marked a major turning point in history.",
    "It involved the transition to new manufacturing processes, including the rise of factories and mechanization.",
    "Key inventions like the steam engine, power loom, and cotton gin dramatically increased production efficiency.",
    "This era led to significant economic growth, urbanization, and social changes, but also brought challenges like poor working conditions and pollution."
  ],
  "model": "gemma3",
  "parameters": {
    "temperature": 0.7
  },
  "max_length": 100
}
```

## Key Functions

*   `generate_summary(input_data)`: Takes the parsed input data dictionary, extracts the text and configuration, constructs the prompts, interacts with the LLM using `chat_with_llm`, and returns the raw summary text.
*   `main()`: The main execution function. It handles command-line arguments, loads the input JSON (`load_json`), calls `generate_summary`, prepares metadata (`create_output_metadata`, `get_output_filepath`), formats the output data, and saves it to a JSON file (`save_output`).
*   **Utility Functions (from `utils.py`)**:
    *   `load_json`: Loads data from a JSON file.
    *   `save_output`: Saves data to a JSON file.
    *   `chat_with_llm`: Handles the interaction with the specified LLM, sending system and user messages and returning the response.
    *   `create_output_metadata`: Generates standard metadata (task name, timestamp, UUID).
    *   `get_output_filepath`: Determines the appropriate output file path.
    *   `handle_command_args`: Parses command-line arguments for input/output file paths.

## LLM Interaction

The script interacts with the LLM through the `chat_with_llm` utility function. It constructs two messages:

1.  **System Prompt**: Instructs the LLM on its role and desired output style.
    ```
    You are an AI assistant specialized in summarizing content. Your goal is to provide a concise and clear summary of the provided text. Ensure that the summary captures the key points, main ideas, and critical details. Keep the summary brief, precise, and easy to understand. Avoid unnecessary details or opinions. Follow the output format as specified by the user if provided; otherwise, return a plain text summary.
    ```
2.  **User Prompt**: Provides the actual text to be summarized. The list of strings from `input_text` is joined into a single string.
    ```
    Summarize the following text:

    [Joined input_text content here]
    ```

The `chat_with_llm` function sends these prompts along with the specified `model` and `parameters` to the LLM service and returns the generated summary as a single string.

## Output Processing

The raw text summary received from the LLM is processed by splitting it into a list of strings based on newline characters (`\n`). This list becomes the value for the `summary` key in the output JSON.

## Output

The script generates a JSON output file containing:

*   **Metadata**: Information about the process, including:
    *   `task_name`: "Text Summary"
    *   `start_time`: Timestamp when the script started.
    *   `end_time`: Timestamp when the script finished.
    *   `duration_seconds`: Execution time.
    *   `uuid`: A unique identifier for this run.
    *   `input_filepath`: Path to the input file used.
*   **Summary**:
    *   `summary`: A list of strings, where each string is a line from the LLM's generated summary.

Example (`examples/summary-out.json` structure):
```json
{
  "task_name": "Text Summary",
  "start_time": "...",
  "end_time": "...",
  "duration_seconds": ...,
  "uuid": "...",
  "input_filepath": "examples/summary-in.json",
  "summary": [
    "The Industrial Revolution, beginning around 1760 in Great Britain, was a pivotal historical period.",
    "It introduced new manufacturing methods, mechanization, and factories.",
    "Key inventions like the steam engine boosted efficiency, leading to economic growth, urbanization, and social shifts, alongside issues like poor working conditions."
  ]
}