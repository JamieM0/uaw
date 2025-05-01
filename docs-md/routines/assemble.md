# Assemble

This script reads data from various JSON files located in a specified directory, processes it, and uses a Jinja2 template (`page-template.html`) to generate a final HTML output file. It handles metadata, content structuring (like trees and timelines), breadcrumbs, and alternative approaches.

## Purpose

The primary purpose of `assemble.py` is to aggregate structured data from multiple JSON sources and render it into a standardized HTML page format using a predefined template. It serves as the final step in generating documentation or report pages from processed data.

## Usage

```bash
python assemble.py <files_dir> <output_dir>
```

*   `<files_dir>`: The directory containing the input JSON files (1.json - 9.json), `breadcrumbs.txt`, and any alternative approach files (`alt*.json`).
*   `<output_dir>`: The directory where the generated HTML file will be saved.

## Input Files

The script expects the following files within the `<files_dir>`:

*   `1.json`: Contains page metadata (title, summary, status, progress, etc.).
*   `2.json`: Contains the main hierarchical tree structure data for the primary approach.
*   `3.json`: Contains timeline data, including historical events and future predictions.
*   `4.json`: Contains data related to challenges, obstacles, or risks.
*   `5.json`: Contains information about adoption stages or maturity levels.
*   `6.json`: Contains implementation assessment details, steps, or levels.
*   `7.json`: Contains Return on Investment (ROI) analysis data, including timeframes and key benefits.
*   `8.json`: Contains information about relevant future technologies or trends.
*   `9.json`: Contains industrial specifications, such as performance metrics and implementation requirements.
*   `breadcrumbs.txt`: A plain text file containing the breadcrumb path string (e.g., `/category/sub-category`).
*   `alt*.json` (Optional): JSON files starting with `alt` and ending with `.json`, each representing an alternative approach or tree structure.

## Key Functions

*   **`read_json_file(file_path)`**: Reads a specified JSON file and returns its content parsed as a Python dictionary. Handles file opening and JSON decoding.
*   **`process_bold_text(text)`**: Uses regular expressions to find text enclosed in double asterisks (`**text**`) and replaces it with HTML `<strong>text</strong>` tags.
*   **`generate_tree_preview_text(tree_data)`**: Generates a compact, ASCII-art representation of the tree structure found in `tree_data`. It includes the root, main steps (children), and initial sub-steps (grandchildren), using shortened names and UUIDs for brevity. Designed for previews, like in alternative approach cards.
*   **`process_metadata(metadata, breadcrumb_str)`**: Takes the raw metadata dictionary (from `1.json`) and the breadcrumb string. It processes fields like `progress_percentage` (handling different keys and ensuring numeric conversion), formats the `summary` into paragraphs, sets default values for missing fields, adds standard contributor text and the current date (`last_updated`), and includes the raw breadcrumb string.
*   **`process_breadcrumbs(breadcrumbs_str)`**: Parses the raw breadcrumb string (e.g., `/category/sub-category`) into a structured list of dictionaries. Each dictionary represents a breadcrumb link with `name` (formatted title) and `url` (path to the parent index, or `None` for the last item). Includes a 'Home' link.
*   **`main()`**: Orchestrates the entire process:
    *   Parses command-line arguments (`<files_dir>`, `<output_dir>`).
    *   Constructs paths to all expected input JSON files and `breadcrumbs.txt`.
    *   Loads data from mandatory JSON files (`1.json`, `2.json`) using `read_json_file`.
    *   Loads data from optional JSON files (3-9) if they exist, otherwise uses empty dictionaries.
    *   Reads the `breadcrumbs.txt` file if it exists.
    *   Finds and loads alternative approach files (`alt*.json`), generating preview text for each using `generate_tree_preview_text`.
    *   Sets up the Jinja2 environment, loading templates from the `templates` directory and adding the `process_bold_text` filter and `generate_tree_preview_text`, `enumerate` globals.
    *   Loads the `page-template.html` template.
    *   Calls `process_metadata` and `process_breadcrumbs` to prepare metadata and navigation data.
    *   Processes data from optional JSONs (timeline, challenges, adoption, ROI, future tech, specs) into structured lists suitable for the template.
    *   Builds the final context dictionary containing all processed data.
    *   Renders the Jinja2 template with the context.
    *   Determines the output HTML filename based on the metadata's `slug` or `title`, sanitizing it.
    *   Creates the output directory if it doesn't exist.
    *   Writes the rendered HTML content to the output file.
    *   Includes error handling for file not found, JSON decoding errors, and other exceptions.

## Template Processing

The script utilizes the Jinja2 templating engine to generate the final HTML output:

*   **Environment Setup**: A Jinja2 `Environment` is configured to load templates from the `templates/` directory. Settings like `autoescape=True`, `trim_blocks=True`, and `lstrip_blocks=True` are enabled for security and cleaner template rendering.
*   **Template Loading**: The primary template `page-template.html` is loaded from the environment.
*   **Custom Filters/Globals**:
    *   `process_bold`: A custom filter is added to allow `{{ some_text | process_bold }}` syntax in the template for converting Markdown bold to HTML bold.
    *   `generate_tree_preview_text`: Made available as a global function if needed directly within the template (though primarily used during alternative processing).
    *   `enumerate`: The built-in `enumerate` function is added as a global for easier iteration with indices in the template.
*   **Context Data**: A comprehensive Python dictionary (`context`) is prepared, containing all the processed data extracted and transformed from the input JSON files (metadata, tree structure, timeline entries, challenges, adoption stages, implementation steps, ROI points, benefits, future technologies, specifications, breadcrumbs, and alternative approaches).
*   **Rendering**: The `template.render(context)` method is called to inject the context data into the `page-template.html`, producing the final HTML string.

## Output

The script generates a single HTML file located in the specified `<output_dir>`.

*   **Filename**: The name of the HTML file is automatically generated based on the `slug` field found in the processed metadata (`1.json`). If `slug` is not present, it falls back to the `title` field. The name is converted to lowercase, spaces are replaced with hyphens, and characters other than alphanumerics, hyphens, or underscores are removed to ensure it's filesystem-safe. A default name like `output.html` is used if no suitable title/slug is found.
*   **Content**: The content of the file is the fully rendered HTML page, combining the structure from `page-template.html` with the data processed from all the input JSON files.