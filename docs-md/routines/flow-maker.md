# Flow Maker

This script orchestrates a sequence of Python programs to perform a comprehensive analysis related to automation processes. It takes an initial JSON input, runs various analysis and generation scripts, potentially generates alternative process trees, and outputs the results, including intermediate files, metadata, and a final assembled report (typically HTML), into a unique flow-specific directory.

## Purpose

The `flow-maker.py` script serves as the main driver for a multi-step automation analysis workflow. It manages the execution order of several specialized Python scripts, handles input/output file paths between steps, creates a structured output directory for each run, and optionally generates alternative analysis variations based on input parameters.

## Usage

To run the script, use the following command structure:

```bash
python flow-maker.py <input_json> [breadcrumbs]
```

*   `<input_json>`: (Required) Path to the primary JSON file containing the initial data and configuration for the flow.
*   `[breadcrumbs]`: (Optional) A string providing context or tracking information, which will be saved in the output directory.

## Input Files

*   **`<input_json>`:** A JSON file that provides the starting data for the analysis flow. It may contain parameters controlling the execution, such as the number of `alternatives` to generate.
*   **`[breadcrumbs]`:** An optional string passed as a command-line argument. If provided, it's saved to `breadcrumbs.txt` within the flow's output directory for tracking or informational purposes.

## Key Functions

*   **`run_program(program_name, input_path, output_path, extra_args=None)`:**
    *   Executes a specified Python script (`program_name`) using `subprocess.run`.
    *   Passes the `input_path` and `output_path` as command-line arguments to the target script.
    *   Includes any `extra_args` provided.
    *   Captures standard output and standard error.
    *   Prints status messages and returns `True` on success or `False` on failure.
*   **`main()`:**
    *   Parses command-line arguments (`input_json`, `breadcrumbs`).
    *   Loads the initial `input_data` from the specified JSON file using `utils.load_json`.
    *   Generates a unique UUID (`flow_uuid`) for the run.
    *   Creates the main output directory: `flow/<flow_uuid>/`.
    *   Copies the input JSON and saves breadcrumbs (if any) into the flow directory.
    *   Defines and executes the sequence of programs (see Program Execution Flow).
    *   Handles the generation of alternative trees if requested (see Alternative Tree Generation).
    *   Generates and saves `flow-metadata.json` summarizing the run.
*   **`utils` Module Functions:**
    *   Imports helper functions like `load_json` (to read JSON files), `save_output`, `create_output_metadata`, `get_output_filepath`, and `handle_command_args` from a shared `utils.py` module. These handle common tasks like file I/O and argument parsing across the different scripts in the workflow.

## Program Execution Flow

The script executes a predefined sequence of Python programs. Each program typically takes the output of the previous step (or the initial input) as its input and generates an output file.

1.  **Directory Setup:** A unique directory `flow/<flow_uuid>` is created. The initial `<input_json>` is copied to `flow/<flow_uuid>/input.json`.
2.  **Sequential Execution:** The following scripts are run in order:
    *   `generate-metadata.py`: Input `input.json`, Output `1.json`
    *   `hallucinate-tree.py`: Input `input.json`, Output `2.json` (with `-saveInputs`, `-flow_uuid=<uuid>`, `-flat` args)
    *   `generate-automation-timeline.py`: Input `input.json`, Output `3.json`
    *   `generate-automation-challenges.py`: Input `input.json`, Output `4.json`
    *   `automation-adoption.py`: Input `input.json`, Output `5.json`
    *   `current-implementations.py`: Input `input.json`, Output `6.json`
    *   `return-analysis.py`: Input `input.json`, Output `7.json`
    *   `future-technology.py`: Input `input.json`, Output `8.json`
    *   `specifications-industrial.py`: Input `input.json`, Output `9.json`
    *   `assemble.py`: Input is the entire `flow/<flow_uuid>` directory. Output is typically an HTML report within the same directory (specific output filename determined by `assemble.py`).
3.  **Input/Output Handling:**
    *   For most steps, the input is the copied `input.json`.
    *   Intermediate outputs are saved as numbered JSON files (`1.json` through `9.json`) within the `flow/<flow_uuid>` directory.
    *   `assemble.py` is treated specially: it takes the entire flow directory path as input and is responsible for generating the final report(s).

## Alternative Tree Generation

If the initial `<input_json>` file contains a key `"alternatives"` with a value greater than 0, the script will generate that number of alternative process trees:

1.  **Input Variation:** For each alternative, a copy of the original `input_data` is made. Parameters like `temperature`, `approach_name`, and `approach_description` are modified to encourage diverse outputs.
2.  **Saving Inputs:** Each modified input is saved to `flow/<flow_uuid>/inputs/alt_input_<N>.json`.
3.  **Execution:** `hallucinate-tree.py` is run for each alternative input using the `-flat` argument.
4.  **Output:** The output for each alternative is saved to `flow/<flow_uuid>/alt<N>.json`.

## Output

The script generates a primary output directory named `flow/<flow_uuid>/`, where `<flow_uuid>` is a unique identifier for the run. This directory contains:

*   `input.json`: A copy of the original input JSON file provided to the script.
*   `breadcrumbs.txt`: (Optional) Contains the breadcrumbs string if provided via the command line.
*   `1.json` - `9.json`: Intermediate JSON output files generated by the corresponding scripts in the execution flow.
*   `inputs/`: A subdirectory created if alternatives are generated.
    *   `alt_input_1.json`, `alt_input_2.json`, ...: The modified input JSON files used for generating alternative trees.
*   `alt1.json`, `alt2.json`, ...: (Optional) The JSON output files for each generated alternative tree.
*   `flow-metadata.json`: A JSON file containing metadata about the flow run, including the UUID, timestamp, time taken, input file path, and list of programs executed.
*   **Final Report(s):** Files generated by the final `assemble.py` script (e.g., an HTML report). The exact filenames depend on the implementation of `assemble.py`.