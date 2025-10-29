# Python script to translate the documentation Markdown files to fit in the documentation HTML template.

import argparse
import markdown
from markdown.extensions.codehilite import CodeHiliteExtension
from markdown.extensions.fenced_code import FencedCodeExtension
from markdown.extensions.tables import TableExtension
import os
import sys
import pathlib
import re
import glob
import shutil
from datetime import datetime
from bs4 import BeautifulSoup
from jinja2 import Environment, FileSystemLoader, select_autoescape

# Define paths for the UAW workspace - use current directory
UAW_ROOT = os.path.abspath(".")
UAW_TEMPLATE_DIR = os.path.join(UAW_ROOT, "templates")
UAW_DOCS_MD_DIR = os.path.join(UAW_ROOT, "docs-md")
UAW_DOCS_DIR = os.path.join(UAW_ROOT, "web", "docs")
UAW_DOCS_IMAGES_DIR = os.path.join(UAW_ROOT, "web", "assets", "images", "docs")

# Supported image extensions for asset management
SUPPORTED_IMAGE_EXTENSIONS = {'.svg', '.png', '.jpg', '.jpeg', '.gif', '.webp'}

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

def copy_image_asset(image_src, source_md_path):
    """
    Copy an image asset from markdown source to web assets directory.

    Args:
        image_src: The image source path from markdown
        source_md_path: Absolute path to the markdown file containing the image reference

    Returns:
        Tuple of (new_web_path, success_bool) where new_web_path is the path to use in HTML
    """
    # Skip external URLs
    if image_src.startswith(('http://', 'https://', '//')):
        return image_src, True

    # Skip absolute paths that are already in web directory
    if image_src.startswith('/web/'):
        return image_src, True

    # Resolve the source image path relative to the markdown file
    source_md_dir = os.path.dirname(source_md_path)
    source_image_path = os.path.normpath(os.path.join(source_md_dir, image_src))

    # Check if source image exists
    if not os.path.isfile(source_image_path):
        print(f"Warning: Image not found: {source_image_path}", file=sys.stderr)
        return image_src, False

    # Get file extension and validate it's a supported image
    _, ext = os.path.splitext(source_image_path)
    if ext.lower() not in SUPPORTED_IMAGE_EXTENSIONS:
        print(f"Warning: Unsupported image type: {ext} for {source_image_path}", file=sys.stderr)
        return image_src, False

    # Get the filename
    filename = os.path.basename(source_image_path)
    name_without_ext = os.path.splitext(filename)[0]

    # Determine target path
    target_path = os.path.join(UAW_DOCS_IMAGES_DIR, filename)

    # Handle conflicts with timestamp
    if os.path.exists(target_path):
        # Check if files are identical
        if os.path.getsize(source_image_path) == os.path.getsize(target_path):
            with open(source_image_path, 'rb') as f1, open(target_path, 'rb') as f2:
                if f1.read() == f2.read():
                    # Files are identical, use existing
                    web_path = f"/assets/images/docs/{filename}"
                    return web_path, True

        # Files differ, create timestamped version
        timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
        new_filename = f"{name_without_ext}-{timestamp}{ext}"
        target_path = os.path.join(UAW_DOCS_IMAGES_DIR, new_filename)
        filename = new_filename

    # Create target directory if it doesn't exist
    os.makedirs(UAW_DOCS_IMAGES_DIR, exist_ok=True)

    # Copy the file
    try:
        shutil.copy2(source_image_path, target_path)
        print(f"Copied image: {filename}")
    except Exception as e:
        print(f"Error copying image {source_image_path}: {e}", file=sys.stderr)
        return image_src, False

    # Return the web path
    web_path = f"/assets/images/docs/{filename}"
    return web_path, True

def process_image_references(markdown_content, source_md_path):
    """
    Find and process all image references in markdown content.
    Copies images to the web assets directory and updates paths.

    Args:
        markdown_content: The markdown content string
        source_md_path: Absolute path to the source markdown file

    Returns:
        Updated markdown content with corrected image paths
    """
    # Pattern to match markdown images: ![alt](path) or ![alt](path "title")
    image_pattern = r'!\[([^\]]*)\]\(([^\s\)]+)(?:\s+"([^"]*)")?\)'

    def replace_image(match):
        alt_text = match.group(1)
        image_src = match.group(2)
        title = match.group(3)

        # Copy the image and get new path
        new_path, success = copy_image_asset(image_src, source_md_path)

        # Reconstruct markdown image syntax
        if title:
            return f'![{alt_text}]({new_path} "{title}")'
        else:
            return f'![{alt_text}]({new_path})'

    # Replace all image references
    updated_content = re.sub(image_pattern, replace_image, markdown_content)

    return updated_content

def validate_internal_links(markdown_content, source_md_path):
    """
    Validate internal links in markdown content and warn about broken links.

    Args:
        markdown_content: The markdown content string
        source_md_path: Absolute path to the source markdown file
    """
    # Pattern to match markdown links: [text](path)
    link_pattern = r'\[([^\]]+)\]\(([^\)]+)\)'

    source_md_dir = os.path.dirname(source_md_path)

    for match in re.finditer(link_pattern, markdown_content):
        link_text = match.group(1)
        link_target = match.group(2)

        # Skip external URLs
        if link_target.startswith(('http://', 'https://', '//', 'mailto:', '#')):
            continue

        # Split anchor from path
        if '#' in link_target:
            path_part, anchor_part = link_target.split('#', 1)
        else:
            path_part = link_target
            anchor_part = None

        # Skip if it's just an anchor
        if not path_part:
            continue

        # Resolve the link relative to the markdown file
        if path_part.startswith('/'):
            # Absolute path from web root - harder to validate
            continue
        else:
            # Relative path
            target_path = os.path.normpath(os.path.join(source_md_dir, path_part))

            # Check if it's a markdown file that should exist
            if path_part.endswith('.md'):
                if not os.path.isfile(target_path):
                    print(f"Warning: Broken internal link in {os.path.basename(source_md_path)}: [{link_text}]({link_target}) - file not found", file=sys.stderr)

def is_valid_subtitle_line(line):
    """
    Check if a line is a valid subtitle (paragraph text, not special markdown syntax).

    Args:
        line: The line to check

    Returns:
        True if the line is valid subtitle text
    """
    line = line.strip()

    # Empty line
    if not line:
        return False

    # Header
    if line.startswith('#'):
        return False

    # List item
    if line.startswith(('-', '*', '+')):
        return False

    # Ordered list
    if re.match(r'^\d+\.', line):
        return False

    # Code block marker
    if line.startswith('```') or line.startswith('~~~'):
        return False

    # Horizontal rule
    if re.match(r'^[-*_]{3,}$', line):
        return False

    # HTML tag
    if line.startswith('<') and line.endswith('>'):
        return False

    # Table separator
    if re.match(r'^\|?[\s:-]*\|[\s:-]*\|', line):
        return False

    return True

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

    # Find the first valid paragraph after the header (improved subtitle extraction)
    if title_found:
        for i in range(first_header_index + 1, len(lines)):
            line_stripped = lines[i].strip()
            if is_valid_subtitle_line(line_stripped):
                subtitle = line_stripped
                subtitle_found = True
                break

    # Remove the title line from markdown before converting to HTML
    if title_found and first_header_index != -1:
        content_for_html = "\n".join(lines[:first_header_index] + lines[first_header_index+1:])
    else:
        content_for_html = content

    # Process image references and copy assets
    if input_path:
        content_for_html = process_image_references(content_for_html, input_path)
        # Validate internal links
        validate_internal_links(content_for_html, input_path)

    # Set up custom Markdown extensions with proper code highlighting
    extensions = [
        'markdown.extensions.tables',
        'markdown.extensions.fenced_code',
        'markdown.extensions.codehilite',
        'markdown.extensions.attr_list',
        'markdown.extensions.def_list',
        'markdown.extensions.footnotes',
        'markdown.extensions.md_in_html',
        'markdown.extensions.toc',
        'markdown.extensions.sane_lists',  # Better list nesting behavior
        'markdown.extensions.smarty',      # Smart quotes and dashes
        'markdown.extensions.abbr'         # Abbreviations with tooltips
    ]

    extension_configs = {
        'markdown.extensions.codehilite': {
            'noclasses': False,           # Use CSS classes instead of inline styles
            'linenums': False,            # No line numbers by default
            'css_class': "codehilite",    # CSS class to use
            'pygments_style': 'default'   # Pygments style
        },
        'markdown.extensions.toc': {
            'permalink': True,
            'permalink_title': 'Link to this section',
            'toc_depth': '2-4',           # Only H2-H4 in TOC
            'marker': '[TOC]'
        }
    }
    
    # Convert the markdown content (without title) to HTML with syntax highlighting
    try:
        html_content = markdown.markdown(
            content_for_html,
            extensions=extensions,
            extension_configs=extension_configs
        )

        # Post-process HTML using BeautifulSoup for robust element enhancement
        html_content = post_process_html_with_beautifulsoup(html_content)

    except Exception as e:
        raise RuntimeError(f"Markdown conversion failed: {e}")

    if not title_found:
        print("Warning: No level 1 header ('# ') found for title.", file=sys.stderr)
    if not subtitle_found:
         print("Warning: No subtitle paragraph found after title.", file=sys.stderr)

    return title, subtitle, html_content

def post_process_html_with_beautifulsoup(html_content):
    """
    Post-process HTML content using BeautifulSoup for robust element enhancement.
    This replaces fragile regex-based post-processing.
    """
    # Use html.parser instead of lxml to avoid auto-wrapping issues
    soup = BeautifulSoup(html_content, 'html.parser')

    # Add classes to all heading levels
    for level in range(1, 7):
        for heading in soup.find_all(f'h{level}'):
            if 'class' in heading.attrs:
                heading['class'].append('docs-heading')
            else:
                heading['class'] = ['docs-heading']

    # Wrap tables with responsive container
    for table in soup.find_all('table'):
        if not table.parent or table.parent.name != 'div' or 'table-container' not in table.parent.get('class', []):
            # Add class to table
            if 'class' in table.attrs:
                if 'docs-table' not in table['class']:
                    table['class'].append('docs-table')
            else:
                table['class'] = ['docs-table']

            # Wrap in container div
            wrapper = soup.new_tag('div', attrs={'class': 'table-container'})
            table.wrap(wrapper)

    # Add classes to blockquotes
    for blockquote in soup.find_all('blockquote'):
        if 'class' in blockquote.attrs:
            if 'docs-blockquote' not in blockquote['class']:
                blockquote['class'].append('docs-blockquote')
        else:
            blockquote['class'] = ['docs-blockquote']

    # Add classes to lists
    for ul in soup.find_all('ul'):
        if 'class' in ul.attrs:
            if 'docs-list' not in ul['class']:
                ul['class'].append('docs-list')
        else:
            ul['class'] = ['docs-list']

    for ol in soup.find_all('ol'):
        if 'class' in ol.attrs:
            if 'docs-list' not in ol['class']:
                ol['class'].append('docs-list')
            if 'docs-list-ordered' not in ol['class']:
                ol['class'].append('docs-list-ordered')
        else:
            ol['class'] = ['docs-list', 'docs-list-ordered']

    # Add classes to inline code elements (but not those inside pre/code blocks)
    for code in soup.find_all('code'):
        # Check if this is inline code (not in a pre block)
        if not code.find_parent('pre'):
            if 'class' in code.attrs:
                if 'docs-inline-code' not in code['class']:
                    code['class'].append('docs-inline-code')
            else:
                code['class'] = ['docs-inline-code']

    # Add classes to horizontal rules
    for hr in soup.find_all('hr'):
        if 'class' in hr.attrs:
            if 'docs-hr' not in hr['class']:
                hr['class'].append('docs-hr')
        else:
            hr['class'] = ['docs-hr']

    # Add classes to definition lists
    for dl in soup.find_all('dl'):
        if 'class' in dl.attrs:
            if 'docs-definition-list' not in dl['class']:
                dl['class'].append('docs-definition-list')
        else:
            dl['class'] = ['docs-definition-list']

    for dt in soup.find_all('dt'):
        if 'class' in dt.attrs:
            if 'docs-definition-term' not in dt['class']:
                dt['class'].append('docs-definition-term')
        else:
            dt['class'] = ['docs-definition-term']

    for dd in soup.find_all('dd'):
        if 'class' in dd.attrs:
            if 'docs-definition-description' not in dd['class']:
                dd['class'].append('docs-definition-description')
        else:
            dd['class'] = ['docs-definition-description']

    # Enhance images with figure/figcaption wrapping if they have a title
    for img in soup.find_all('img'):
        # Add class to image
        if 'class' in img.attrs:
            if 'docs-image' not in img['class']:
                img['class'].append('docs-image')
        else:
            img['class'] = ['docs-image']

        # Add lazy loading
        if 'loading' not in img.attrs:
            img['loading'] = 'lazy'

        # If image has a title attribute, wrap in figure with figcaption
        if 'title' in img.attrs and img.attrs['title']:
            # Check if already wrapped in figure
            if not img.parent or img.parent.name != 'figure':
                figure = soup.new_tag('figure', attrs={'class': 'docs-figure'})
                img.wrap(figure)

                # Create figcaption with title text
                figcaption = soup.new_tag('figcaption')
                figcaption.string = img['title']
                figure.append(figcaption)

    # Add default language class to code blocks without one
    for code in soup.find_all('code'):
        parent = code.find_parent('pre')
        if parent:  # This is a code block
            # Check if it already has a language class
            has_lang_class = False
            if 'class' in code.attrs:
                for cls in code['class']:
                    if cls.startswith('language-'):
                        has_lang_class = True
                        break

            if not has_lang_class:
                # Add default language-text class
                if 'class' in code.attrs:
                    code['class'].append('language-text')
                else:
                    code['class'] = ['language-text']

    # Return the processed HTML as a string
    return str(soup)

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