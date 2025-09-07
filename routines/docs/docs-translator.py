# Python script to translate the documentation Markdown files to fit in the documentation HTML template.

import argparse
import markdown
from markdown.extensions.codehilite import CodeHiliteExtension
from markdown.extensions.fenced_code import FencedCodeExtension
from markdown.extensions.tables import TableExtension
from markdown.extensions import wikilinks
import os
import sys
import pathlib
import re
import glob
from jinja2 import Environment, FileSystemLoader, select_autoescape

# Define paths for the UAW workspace - use current directory
UAW_ROOT = os.path.abspath(".")
UAW_TEMPLATE_DIR = os.path.join(UAW_ROOT, "templates")
UAW_DOCS_MD_DIR = os.path.join(UAW_ROOT, "docs-md")
UAW_DOCS_DIR = os.path.join(UAW_ROOT, "web", "docs")

def compute_output_path(input_path):
    """Computes the default output path from the input Markdown path."""
    # If we have an absolute path that starts with the UAW_DOCS_MD_DIR
    if os.path.isabs(input_path) and input_path.startswith(UAW_DOCS_MD_DIR):
        # Get the relative part of the path from docs-md
        rel_path = os.path.relpath(input_path, UAW_DOCS_MD_DIR)
        # Construct the output path in docs directory
        output_path = os.path.join(UAW_DOCS_DIR, rel_path)
        # Change extension from .md to .html
        output_path = os.path.splitext(output_path)[0] + '.html'
        return output_path
    
    # If it's a relative path, try to resolve it against UAW_DOCS_MD_DIR
    if not os.path.isabs(input_path):
        # Check if the input path is in the form routines/utils.md or similar
        full_path = os.path.join(UAW_DOCS_MD_DIR, input_path)
        if os.path.isfile(full_path):
            # Construct output in docs directory
            rel_path = input_path
            output_path = os.path.join(UAW_DOCS_DIR, rel_path)
            # Change extension from .md to .html
            output_path = os.path.splitext(output_path)[0] + '.html'
            return output_path
    
    # Fall back to replacing docs-md with web/docs in the path string
    output_path = input_path.replace("docs-md", "web/docs").replace(".md", ".html")
    return output_path

def generate_breadcrumbs(input_path, title):
    """Generate breadcrumb navigation based on file path."""
    breadcrumbs = [{"name": "Home", "url": "/"}]
    breadcrumbs.append({"name": "Documentation", "url": "/docs/"})
    
    # Extract relative path from docs-md directory
    if os.path.isabs(input_path) and input_path.startswith(UAW_DOCS_MD_DIR):
        rel_path = os.path.relpath(input_path, UAW_DOCS_MD_DIR)
    else:
        rel_path = input_path
    
    # Split path into parts
    path_parts = os.path.dirname(rel_path).split(os.sep) if os.path.dirname(rel_path) else []
    
    # Add intermediate directory parts
    current_path = "/docs"
    for part in path_parts:
        if part and part != ".":  # Skip empty and current directory parts
            current_path += f"/{part}"
            # Capitalize and clean up directory names
            display_name = part.replace("-", " ").replace("_", " ").title()
            breadcrumbs.append({"name": display_name, "url": f"{current_path}/"})
    
    # Add final page (no URL since it's current page)
    breadcrumbs.append({"name": title, "url": None})
    
    return breadcrumbs

def parse_markdown(content, input_path=None):
    """Extracts title and subtitle, and converts Markdown to HTML."""
    title = "Untitled"
    subtitle = ""
    html_content = ""
    lines = content.splitlines()

    title_found = False
    subtitle_found = False
    first_header_index = -1

    # Find the first level 1 header
    for i, line in enumerate(lines):
        line_stripped = line.strip()
        if line_stripped.startswith("# "):
            title = line_stripped[2:].strip()
            title_found = True
            first_header_index = i
            break # Found the first H1

    # Find the first non-empty paragraph after the header
    if title_found:
        for i in range(first_header_index + 1, len(lines)):
            line_stripped = lines[i].strip()
            if line_stripped and not line_stripped.startswith("#"): # Found the first non-empty, non-header line
                subtitle = line_stripped
                subtitle_found = True
                break

    # Remove the title line from markdown before converting to HTML
    if title_found and first_header_index != -1:
        content_for_html = "\n".join(lines[:first_header_index] + lines[first_header_index+1:])
    else:
        content_for_html = content

    # Set up custom Markdown extensions with proper code highlighting
    extensions = [
        'markdown.extensions.tables',
        'markdown.extensions.fenced_code',
        'markdown.extensions.codehilite',
        'markdown.extensions.attr_list',
        'markdown.extensions.def_list',
        'markdown.extensions.footnotes',
        'markdown.extensions.md_in_html',
        'markdown.extensions.toc'
    ]
    
    extension_configs = {
        'markdown.extensions.codehilite': {
            'noclasses': False,   # Use CSS classes instead of inline styles
            'linenums': False,    # No line numbers by default
            'css_class': "codehilite"  # CSS class to use
        },
        'markdown.extensions.toc': {
            'permalink': True
        }
    }
    
    # Convert the markdown content (without title) to HTML with syntax highlighting
    try:
        html_content = markdown.markdown(
            content_for_html, 
            extensions=extensions, 
            extension_configs=extension_configs
        )
        
        # Post-process HTML to ensure code blocks are properly formatted
        # This adds any language-specific class for better syntax highlighting
        html_content = post_process_code_blocks(html_content)
        
        # Post-process for better inline elements and tables
        html_content = post_process_inline_elements(html_content)
        
    except Exception as e:
        raise RuntimeError(f"Markdown conversion failed: {e}")

    if not title_found:
        print("Warning: No level 1 header ('# ') found for title.", file=sys.stderr)
    if not subtitle_found:
         print("Warning: No subtitle paragraph found after title.", file=sys.stderr)

    return title, subtitle, html_content

def post_process_code_blocks(html_content):
    """
    Post-process HTML content to enhance code blocks with appropriate classes
    and ensure proper formatting.
    """
    # Find all code blocks with language class already applied by CodeHilite
    # Replace with properly formatted code blocks if needed
    pattern = r'<div class="codehilite"><pre><code class="language-([a-zA-Z0-9_-]+)">(.*?)</code></pre></div>'
    replacement = r'<div class="codehilite"><pre><code class="language-\1">\2</code></pre></div>'
    
    # Replace using regex with a callback to maintain the language and content
    html_content = re.sub(pattern, replacement, html_content, flags=re.DOTALL)
    
    # Find code blocks without language specification and add default class
    pattern_no_lang = r'<div class="codehilite"><pre><code>(.*?)</code></pre></div>'
    replacement_no_lang = r'<div class="codehilite"><pre><code class="language-text">\1</code></pre></div>'
    
    # Replace using regex
    html_content = re.sub(pattern_no_lang, replacement_no_lang, html_content, flags=re.DOTALL)
    
    return html_content

def post_process_inline_elements(html_content):
    """
    Post-process HTML content to enhance inline elements and tables.
    """
    # Wrap tables with a responsive container
    html_content = re.sub(
        r'<table>(.*?)</table>',
        r'<div class="table-container"><table class="docs-table">\1</table></div>',
        html_content,
        flags=re.DOTALL
    )
    
    # Add classes to various elements for better styling
    # Add class to blockquotes
    html_content = re.sub(
        r'<blockquote>(.*?)</blockquote>',
        r'<blockquote class="docs-blockquote">\1</blockquote>',
        html_content,
        flags=re.DOTALL
    )
    
    # Add classes to lists
    html_content = re.sub(r'<ul>', r'<ul class="docs-list">', html_content)
    html_content = re.sub(r'<ol>', r'<ol class="docs-list docs-list-ordered">', html_content)
    
    # Enhance inline code elements
    html_content = re.sub(
        r'<code>([^<]+)</code>',
        r'<code class="docs-inline-code">\1</code>',
        html_content
    )
    
    # Add classes to headings for consistent styling
    html_content = re.sub(r'<h2>', r'<h2 class="docs-heading">', html_content)
    html_content = re.sub(r'<h3>', r'<h3 class="docs-heading">', html_content)
    html_content = re.sub(r'<h4>', r'<h4 class="docs-heading">', html_content)
    
    return html_content

def generate_code_highlight_css():
    """
    Generate the CSS styles needed for code highlighting.
    Returns a string containing CSS rules.
    """
    # This is a minimal set of CSS for syntax highlighting with Pygments
    return """
<style>
/* Code highlighting styles */
.codehilite .hll { background-color: #ffffcc }
.codehilite { background: #f8f8f8; padding: 0.5em; border-radius: 4px; overflow: auto; }
.codehilite .c { color: #3D7B7B; font-style: italic } /* Comment */
.codehilite .err { border: 1px solid #FF0000 } /* Error */
.codehilite .k { color: #008000; font-weight: bold } /* Keyword */
.codehilite .o { color: #666666 } /* Operator */
.codehilite .ch { color: #3D7B7B; font-style: italic } /* Comment.Hashbang */
.codehilite .cm { color: #3D7B7B; font-style: italic } /* Comment.Multiline */
.codehilite .cp { color: #9C6500 } /* Comment.Preproc */
.codehilite .cpf { color: #3D7B7B; font-style: italic } /* Comment.PreprocFile */
.codehilite .c1 { color: #3D7B7B; font-style: italic } /* Comment.Single */
.codehilite .cs { color: #3D7B7B; font-style: italic } /* Comment.Special */
.codehilite .gd { color: #A00000 } /* Generic.Deleted */
.codehilite .ge { font-style: italic } /* Generic.Emph */
.codehilite .gr { color: #E40000 } /* Generic.Error */
.codehilite .gh { color: #000080; font-weight: bold } /* Generic.Heading */
.codehilite .gi { color: #008400 } /* Generic.Inserted */
.codehilite .go { color: #717171 } /* Generic.Output */
.codehilite .gp { color: #000080; font-weight: bold } /* Generic.Prompt */
.codehilite .gs { font-weight: bold } /* Generic.Strong */
.codehilite .gu { color: #800080; font-weight: bold } /* Generic.Subheading */
.codehilite .gt { color: #0044DD } /* Generic.Traceback */
.codehilite .kc { color: #008000; font-weight: bold } /* Keyword.Constant */
.codehilite .kd { color: #008000; font-weight: bold } /* Keyword.Declaration */
.codehilite .kn { color: #008000; font-weight: bold } /* Keyword.Namespace */
.codehilite .kp { color: #008000 } /* Keyword.Pseudo */
.codehilite .kr { color: #008000; font-weight: bold } /* Keyword.Reserved */
.codehilite .kt { color: #B00040 } /* Keyword.Type */
.codehilite .m { color: #666666 } /* Literal.Number */
.codehilite .s { color: #BA2121 } /* Literal.String */
.codehilite .na { color: #687822 } /* Name.Attribute */
.codehilite .nb { color: #008000 } /* Name.Builtin */
.codehilite .nc { color: #0000FF; font-weight: bold } /* Name.Class */
.codehilite .no { color: #880000 } /* Name.Constant */
.codehilite .nd { color: #AA22FF } /* Name.Decorator */
.codehilite .ni { color: #717171; font-weight: bold } /* Name.Entity */
.codehilite .ne { color: #CB3F38; font-weight: bold } /* Name.Exception */
.codehilite .nf { color: #0000FF } /* Name.Function */
.codehilite .nl { color: #767600 } /* Name.Label */
.codehilite .nn { color: #0000FF; font-weight: bold } /* Name.Namespace */
.codehilite .nt { color: #008000; font-weight: bold } /* Name.Tag */
.codehilite .nv { color: #19177C } /* Name.Variable */
.codehilite .ow { color: #AA22FF; font-weight: bold } /* Operator.Word */
.codehilite .w { color: #bbbbbb } /* Text.Whitespace */
.codehilite .mb { color: #666666 } /* Literal.Number.Bin */
.codehilite .mf { color: #666666 } /* Literal.Number.Float */
.codehilite .mh { color: #666666 } /* Literal.Number.Hex */
.codehilite .mi { color: #666666 } /* Literal.Number.Integer */
.codehilite .mo { color: #666666 } /* Literal.Number.Oct */
.codehilite .sa { color: #BA2121 } /* Literal.String.Affix */
.codehilite .sb { color: #BA2121 } /* Literal.String.Backtick */
.codehilite .sc { color: #BA2121 } /* Literal.String.Char */
.codehilite .dl { color: #BA2121 } /* Literal.String.Delimiter */
.codehilite .sd { color: #BA2121; font-style: italic } /* Literal.String.Doc */
.codehilite .s2 { color: #BA2121 } /* Literal.String.Double */
.codehilite .se { color: #AA5D1F; font-weight: bold } /* Literal.String.Escape */
.codehilite .sh { color: #BA2121 } /* Literal.String.Heredoc */
.codehilite .si { color: #A45A77; font-weight: bold } /* Literal.String.Interpol */
.codehilite .sx { color: #008000 } /* Literal.String.Other */
.codehilite .sr { color: #A45A77 } /* Literal.String.Regex */
.codehilite .s1 { color: #BA2121 } /* Literal.String.Single */
.codehilite .ss { color: #19177C } /* Literal.String.Symbol */
.codehilite .bp { color: #008000 } /* Name.Builtin.Pseudo */
.codehilite .fm { color: #0000FF } /* Name.Function.Magic */
.codehilite .vc { color: #19177C } /* Name.Variable.Class */
.codehilite .vg { color: #19177C } /* Name.Variable.Global */
.codehilite .vi { color: #19177C } /* Name.Variable.Instance */
.codehilite .vm { color: #19177C } /* Name.Variable.Magic */
.codehilite .il { color: #666666 } /* Literal.Number.Integer.Long */

/* Additional styling for specific code elements */
.codehilite pre { margin: 0; padding: 10px; white-space: pre; }
.codehilite code { font-family: 'Consolas', 'Monaco', 'Andale Mono', 'Ubuntu Mono', monospace; }
</style>
"""

def find_available_markdown_files():
    """
    Returns a dictionary of all available markdown files in the UAW docs-md directory.
    The keys are the relative paths and the values are the absolute paths.
    """
    available_files = {}
    for root, dirs, files in os.walk(UAW_DOCS_MD_DIR):
        for file in files:
            if file.endswith('.md'):
                abs_path = os.path.join(root, file)
                rel_path = os.path.relpath(abs_path, UAW_DOCS_MD_DIR)
                available_files[rel_path] = abs_path
    return available_files

def resolve_input_path(input_path):
    """
    Resolves the input path to an absolute path to the markdown file.
    
    Tries multiple strategies to find the file:
    1. Absolute path
    2. Relative to current directory
    3. Relative to UAW_DOCS_MD_DIR
    4. Just the filename part of the path in the UAW_DOCS_MD_DIR
    """
    # Check if the path is already absolute and exists
    if os.path.isabs(input_path) and os.path.isfile(input_path):
        return input_path
    
    # Check if the path is relative to current directory
    abs_path = os.path.abspath(input_path)
    if os.path.isfile(abs_path):
        return abs_path
    
    # Check if the path is relative to UAW_DOCS_MD_DIR
    uaw_path = os.path.join(UAW_DOCS_MD_DIR, input_path)
    if os.path.isfile(uaw_path):
        return uaw_path
    
    # If input_path doesn't contain directories, try to find it anywhere in UAW_DOCS_MD_DIR
    if os.path.basename(input_path) == input_path:
        for root, dirs, files in os.walk(UAW_DOCS_MD_DIR):
            if input_path in files:
                return os.path.join(root, input_path)
    
    # Try searching for the file with .md extension if it doesn't have one
    if not input_path.endswith('.md'):
        return resolve_input_path(input_path + '.md')
    
    # Last resort: search for files in UAW_DOCS_MD_DIR that match the input_path
    # This handles cases where input_path is something like 'utils' and we need to find 'routines/utils.md'
    input_basename = os.path.basename(input_path)
    input_basename_noext = os.path.splitext(input_basename)[0]
    
    for root, dirs, files in os.walk(UAW_DOCS_MD_DIR):
        for file in files:
            file_basename_noext = os.path.splitext(file)[0]
            if file_basename_noext == input_basename_noext and file.endswith('.md'):
                return os.path.join(root, file)
    
    # If we get here, we couldn't find the file
    return None

def process_markdown_file(input_path, output_path=None, template_path="documentation-page-template.html", 
                         template_dir=UAW_TEMPLATE_DIR, inline_css=False):
    """
    Process a single markdown file and convert it to HTML.
    
    Args:
        input_path: Path to the input markdown file
        output_path: Path to the output HTML file (optional)
        template_path: Path to the template file
        template_dir: Directory containing the template files
        inline_css: Whether to include CSS for code highlighting in the HTML file
        
    Returns:
        True if successful, False otherwise
    """
    try:
        # Read source markdown file
        try:
            with open(input_path, 'r', encoding='utf-8') as f:
                markdown_content = f.read()
        except FileNotFoundError:
            print(f"Error: Input Markdown file not found at '{input_path}'", file=sys.stderr)
            return False
        except IOError as e:
            print(f"Error reading input file '{input_path}': {e}", file=sys.stderr)
            return False

        # Parse markdown for title, subtitle, and convert to HTML
        try:
            title, subtitle, html_content = parse_markdown(markdown_content, input_path)
        except RuntimeError as e:
             print(f"Error parsing Markdown file '{input_path}': {e}", file=sys.stderr)
             return False
        except Exception as e:
            print(f"Unexpected error during Markdown parsing '{input_path}': {e}", file=sys.stderr)
            return False

        # Generate breadcrumbs based on file path
        breadcrumbs = generate_breadcrumbs(input_path, title)

        # Determine output path if not provided
        if not output_path:
            try:
                output_path = compute_output_path(input_path)
                print(f"Computed output path: {output_path}")
            except ValueError as e:
                 print(f"Error computing output path: {e}", file=sys.stderr)
                 return False

        # Optionally include the CSS for code highlighting directly in the output
        highlight_css = ""
        if inline_css:
            highlight_css = generate_code_highlight_css()

        # Check if template directory exists
        if not os.path.isdir(template_dir):
            print(f"Warning: Template directory '{template_dir}' not found. Trying UAW template directory.", file=sys.stderr)
            template_dir = UAW_TEMPLATE_DIR
            
        if not os.path.isdir(template_dir):
            print(f"Error: Template directory not found at: {template_dir}", file=sys.stderr)
            return False
            
        # Verify template file exists in the directory
        template_file_path = os.path.join(template_dir, template_path)
        if not os.path.isfile(template_file_path):
            print(f"Error: Template file not found at: {template_file_path}", file=sys.stderr)
            return False
            
        # Set up Jinja2 environment
        try:
            env = Environment(
                loader=FileSystemLoader(template_dir),
                autoescape=select_autoescape(['html', 'xml'])
            )
            
            # Extract just the template filename if a path was provided
            template_filename = os.path.basename(template_path)
            
            # Attempt to get the template
            try:
                template = env.get_template(template_filename)
            except Exception as e:
                print(f"Error loading template '{template_filename}' from '{template_dir}': {e}", file=sys.stderr)
                return False
            
            # Render template with our variables
            output_html = template.render(
                title=title,
                subtitle=subtitle,
                content=html_content + highlight_css,
                breadcrumbs=breadcrumbs
            )
        except Exception as e:
            print(f"Error rendering template: {e}", file=sys.stderr)
            return False

        # Ensure output directory exists
        output_dir = os.path.dirname(output_path)
        if output_dir:
            try:
                os.makedirs(output_dir, exist_ok=True)
            except OSError as e:
                print(f"Error creating output directory '{output_dir}': {e}", file=sys.stderr)
                return False

        # Write populated HTML to output file
        try:
            with open(output_path, 'w', encoding='utf-8') as f:
                f.write(output_html)
            print(f"Successfully generated HTML file: {output_path}")
            return True
        except IOError as e:
            print(f"Error writing output file '{output_path}': {e}", file=sys.stderr)
            return False

    except Exception as e:
        print(f"An unexpected error occurred: {e}", file=sys.stderr)
        return False

def process_folder(folder_path, output_dir=None, template_path="documentation-page-template.html", 
                  template_dir=UAW_TEMPLATE_DIR, inline_css=False, recursive=False):
    """
    Process all markdown files in a folder and its subfolders (if recursive=True).
    
    Args:
        folder_path: Path to the folder containing markdown files
        output_dir: Directory to output HTML files (optional)
        template_path: Path to the template file
        template_dir: Directory containing the template files
        inline_css: Whether to include CSS for code highlighting in the HTML files
        recursive: Whether to process subdirectories recursively
        
    Returns:
        Tuple of (success_count, failure_count)
    """
    # Resolve the folder path to an absolute path
    if not os.path.isabs(folder_path):
        # First check relative to current directory
        abs_folder_path = os.path.abspath(folder_path)
        if not os.path.isdir(abs_folder_path):
            # Try in UAW_DOCS_MD_DIR
            abs_folder_path = os.path.join(UAW_DOCS_MD_DIR, folder_path)
    else:
        abs_folder_path = folder_path
    
    # Check if the folder exists
    if not os.path.isdir(abs_folder_path):
        print(f"Error: Folder not found at '{abs_folder_path}'", file=sys.stderr)
        return 0, 0
    
    # Find all markdown files in the folder
    if recursive:
        search_pattern = os.path.join(abs_folder_path, '**', '*.md')
        markdown_files = glob.glob(search_pattern, recursive=True)
    else:
        search_pattern = os.path.join(abs_folder_path, '*.md')
        markdown_files = glob.glob(search_pattern)
    
    if not markdown_files:
        print(f"Warning: No markdown files found in '{abs_folder_path}'", file=sys.stderr)
        return 0, 0
    
    print(f"Found {len(markdown_files)} markdown files to process")
    
    # Process each markdown file
    success_count = 0
    failure_count = 0
    
    for markdown_file in markdown_files:
        print(f"\nProcessing: {markdown_file}")
        
        # Compute output path based on input file path
        if output_dir:
            # Get the relative path from the input folder
            rel_path = os.path.relpath(markdown_file, abs_folder_path)
            # Replace extension with .html
            rel_path = os.path.splitext(rel_path)[0] + '.html'
            # Join with output directory
            output_path = os.path.join(output_dir, rel_path)
        else:
            # Let the process_markdown_file function compute the output path
            output_path = None
        
        # Process the file
        success = process_markdown_file(
            markdown_file, 
            output_path=output_path,
            template_path=template_path,
            template_dir=template_dir,
            inline_css=inline_css
        )
        
        if success:
            success_count += 1
        else:
            failure_count += 1
    
    return success_count, failure_count

def regenerate_all_docs(template_path="documentation-page-template.html", 
                       template_dir=UAW_TEMPLATE_DIR, inline_css=False):
    """
    Regenerate all documentation files from docs-md to web/docs.
    
    Returns:
        Tuple of (success_count, failure_count)
    """
    print("Regenerating all documentation files...")
    print(f"Source: {UAW_DOCS_MD_DIR}")
    print(f"Output: {UAW_DOCS_DIR}")
    print()
    
    # Find all markdown files recursively in docs-md
    markdown_files = []
    for root, dirs, files in os.walk(UAW_DOCS_MD_DIR):
        for file in files:
            if file.endswith('.md'):
                abs_path = os.path.join(root, file)
                markdown_files.append(abs_path)
    
    if not markdown_files:
        print("ERROR: No markdown files found in docs-md directory")
        return 0, 0
    
    print(f"Found {len(markdown_files)} markdown files to process")
    print()
    
    success_count = 0
    failure_count = 0
    
    for markdown_file in markdown_files:
        # Get relative path for display
        rel_path = os.path.relpath(markdown_file, UAW_DOCS_MD_DIR)
        print(f"Processing: {rel_path}")
        
        # Process the file using existing function
        success = process_markdown_file(
            markdown_file,
            output_path=None,  # Let function compute output path
            template_path=template_path,
            template_dir=template_dir,
            inline_css=inline_css
        )
        
        if success:
            success_count += 1
            print(f"   SUCCESS")
        else:
            failure_count += 1
            print(f"   FAILED")
        print()
    
    print("="*50)
    print(f"Regeneration complete:")
    print(f"   {success_count} files succeeded")
    print(f"   {failure_count} files failed")
    print("="*50)
    
    return success_count, failure_count

def main():
    parser = argparse.ArgumentParser(description="Convert Markdown documentation to HTML using a template.")
    
    # Create a mutually exclusive group for input_file and input_folder
    input_group = parser.add_mutually_exclusive_group(required=False)
    input_group.add_argument("--input-file", help="Path to the source Markdown file (e.g., routines/utils.md)")
    input_group.add_argument("--input-folder", help="Path to the folder containing markdown files to process")
    input_group.add_argument("--regenerate", action="store_true", help="Regenerate all documentation files from docs-md to web/docs")
    
    parser.add_argument("--output", help="Path to the output HTML file (for single file) or directory (for folder)")
    parser.add_argument("--template", default="documentation-page-template.html", help="Name of the HTML template file.")
    parser.add_argument("--template-dir", default=UAW_TEMPLATE_DIR, help="Directory containing the template files.")
    parser.add_argument("--inline-css", action="store_true", help="Include CSS for code highlighting in the HTML file.")
    parser.add_argument("--list-files", action="store_true", help="List available markdown files in the docs-md directory.")
    parser.add_argument("--recursive", action="store_true", help="Process subdirectories recursively (when using --input-folder).")

    args = parser.parse_args()
    
    # First, check if we should just list available files
    if args.list_files:
        available_files = find_available_markdown_files()
        print("Available markdown files in UAW docs-md directory:")
        for rel_path in sorted(available_files.keys()):
            print(f"  {rel_path}")
        sys.exit(0)
    
    # Check if we should regenerate all docs
    if args.regenerate:
        success_count, failure_count = regenerate_all_docs(
            template_path=args.template,
            template_dir=args.template_dir,
            inline_css=args.inline_css
        )
        
        if failure_count > 0:
            sys.exit(1)
        else:
            sys.exit(0)

    template_path = args.template
    template_dir = args.template_dir
    output_path = args.output
    inline_css = args.inline_css
    
    # Process a folder of markdown files
    if args.input_folder:
        folder_path = args.input_folder
        output_dir = output_path  # Use the --output as the output directory
        
        print(f"Processing markdown files in folder: {folder_path}")
        success_count, failure_count = process_folder(
            folder_path,
            output_dir=output_dir,
            template_path=template_path,
            template_dir=template_dir,
            inline_css=inline_css,
            recursive=args.recursive
        )
        
        print(f"\nProcessing complete: {success_count} files succeeded, {failure_count} files failed")
        
        if failure_count > 0:
            sys.exit(1)
        else:
            sys.exit(0)
    
    # Require at least one input method if not using regenerate or list-files
    if not any([args.input_file, args.input_folder, args.regenerate, args.list_files]):
        print("Error: Must specify --input-file, --input-folder, --regenerate, or --list-files", file=sys.stderr)
        parser.print_help()
        sys.exit(1)
    
    # Process a single markdown file
    elif args.input_file:
        input_path = args.input_file
        
        # Resolve the input path to the actual markdown file
        resolved_input_path = resolve_input_path(input_path)
        
        if not resolved_input_path or not os.path.isfile(resolved_input_path):
            print(f"Error: Could not find markdown file at '{input_path}'", file=sys.stderr)
            
            # Print available files to help the user
            available_files = find_available_markdown_files()
            print("\nAvailable markdown files in UAW docs-md directory:")
            for rel_path in sorted(available_files.keys()):
                print(f"  {rel_path}")
                
            print("\nTry one of these paths or use --list-files for a complete list.", file=sys.stderr)
            sys.exit(1)
        
        success = process_markdown_file(
            resolved_input_path,
            output_path=output_path,
            template_path=template_path,
            template_dir=template_dir,
            inline_css=inline_css
        )
        
        if not success:
            sys.exit(1)

if __name__ == "__main__":
    main()