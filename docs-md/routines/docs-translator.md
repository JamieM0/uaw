# Docs Translator

This script converts Markdown documentation files into HTML pages using a specified HTML template. It extracts key elements like the title and subtitle from the Markdown source and injects them along with the main content (converted to HTML) into the template.

## Purpose

The primary goal of this script is to automate the process of generating consistent HTML documentation pages from Markdown source files. It ensures that all generated pages adhere to a standard layout defined by the HTML template, while dynamically populating the title, subtitle, and main content area.

## Usage

The script is executed from the command line.

```bash
python docs/docs-translator.py <input_file> [--output <output_file>] [--template <template_file>]
```

**Arguments:**

*   `<input_file>` (Required): Path to the source Markdown file. This file **must** reside within the `docs-md/` directory relative to the workspace root.
    *   Example: `docs-md/standards/automation-status.md`
*   `--output <output_file>` (Optional): Path to the output HTML file. If omitted, the script automatically computes the output path by placing the HTML file in the `docs/` directory, mirroring the structure within `docs-md/`.
    *   Example: `docs/standards/automation-status.html` (if `--output` is omitted for the input example above).
*   `--template <template_file>` (Optional): Path to the HTML template file.
    *   Default: `templates/documentation-page-template.html`

**Examples:**

1.  **Basic usage (automatic output path):**
    ```bash
    python docs/docs-translator.py docs-md/introduction.md
    ```
    This will generate `docs/introduction.html` using the default template.

2.  **Specifying output and template:**
    ```bash
    python docs/docs-translator.py docs-md/guides/setup.md --output docs/generated/setup-guide.html --template templates/custom-template.html
    ```

## Input Files

*   **Markdown Source (`<input_file>`):**
    *   Must be a valid Markdown file located within the `docs-md/` directory.
    *   The script expects the first Level 1 Header (`# Header`) to be the document title.
    *   The first non-empty paragraph immediately following the title header is treated as the subtitle.
*   **HTML Template (`--template`):**
    *   A valid HTML file used as the base structure for the output.
    *   It must contain specific placeholders that the script will replace:
        *   `<h1>Title</h1>`: Replaced with the title extracted from the Markdown.
        *   `<p class="hero-subtitle">Subtitle-explain</p>`: Replaced with the subtitle extracted from the Markdown.
        *   `<section class="content-section">content</section>`: The literal word `content` within this section is replaced by the HTML generated from the Markdown body.

## Key Functions

*   `compute_output_path(input_path_str)`:
    *   Takes the input Markdown file path string.
    *   Validates that the input path starts with `docs-md/`.
    *   Constructs the default output HTML path by replacing `docs-md/` with `docs/` and changing the file extension to `.html`.
    *   Returns the computed output path string.
*   `parse_markdown(content)`:
    *   Takes the full Markdown content as a string.
    *   Finds the first Level 1 Header (`# `) and extracts it as the `title`.
    *   Finds the first non-empty paragraph following the title header and extracts it as the `subtitle`.
    *   Converts the *entire* Markdown content into an HTML string using the `markdown` library.
    *   Prints warnings if the title or subtitle cannot be found.
    *   Returns the extracted `title`, `subtitle`, and the generated `html_content`.
*   `main()`:
    *   Parses command-line arguments (`input_file`, `--output`, `--template`).
    *   Determines the final output path, calling `compute_output_path` if `--output` is not provided.
    *   Reads the content of the specified HTML template file.
    *   Reads the content of the source Markdown file.
    *   Calls `parse_markdown` to get the title, subtitle, and HTML body.
    *   Populates the template content by replacing the defined placeholders (`<h1>Title</h1>`, `<p class="hero-subtitle">Subtitle-explain</p>`, and `content` within the content section) with the extracted/generated values.
    *   Ensures the output directory exists, creating it if necessary.
    *   Writes the final populated HTML content to the output file.
    *   Includes error handling for file operations and Markdown parsing.

## Template Processing

1.  The script reads the entire content of the HTML template file specified by `--template` (or the default).
2.  It calls `parse_markdown` on the input Markdown content to extract the `title` and `subtitle`, and to convert the full Markdown body to `html_body`.
3.  It replaces the *first occurrence* of `<h1>Title</h1>` in the template with `<h1>{extracted_title}</h1>`.
4.  It replaces the *first occurrence* of `<p class="hero-subtitle">Subtitle-explain</p>` with `<p class="hero-subtitle">{extracted_subtitle}</p>`.
5.  It finds the section `<section class="content-section">...</section>`.
6.  It replaces the *first occurrence* of the literal word `content` *within* that section with the generated `html_body`. If the word `content` is not found within the section, it prints a warning and replaces the entire original content of the section with the `html_body`.

## Output

The script generates a single HTML file.

*   **Path:** The location of the output file is determined by the `--output` argument if provided. If not provided, the path is automatically calculated by taking the relative path of the input file within `docs-md/`, placing it under the `docs/` directory, and changing the extension to `.html`. For example, `docs-md/folder/file.md` becomes `docs/folder/file.html`.
*   **Content:** The content is the HTML template populated with the title, subtitle, and HTML-converted body from the source Markdown file.