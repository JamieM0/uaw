import os
import sys
import re
import json
import subprocess
import argparse
from pathlib import Path
from datetime import datetime

# Attempt to enable ANSI escape code processing on Windows
if sys.platform == "win32":
    import ctypes
    try:
        kernel32 = ctypes.windll.kernel32
        stdout_handle = kernel32.GetStdHandle(-11)  # STD_OUTPUT_HANDLE
        mode = ctypes.c_ulong()
        if kernel32.GetConsoleMode(stdout_handle, ctypes.byref(mode)):
            ENABLE_VIRTUAL_TERMINAL_PROCESSING = 0x0004
            # Enable VT processing if not already enabled
            if (mode.value & ENABLE_VIRTUAL_TERMINAL_PROCESSING) == 0:
                kernel32.SetConsoleMode(stdout_handle, mode.value | ENABLE_VIRTUAL_TERMINAL_PROCESSING)
    except Exception:
        # If enabling fails, colors might not work but continue anyway
        pass

# ANSI escape codes for colors
class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'

def extract_uuid_from_html(html_file_path):
    """Extract UUID from HTML comment in the file."""
    try:
        with open(html_file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Look for the UUID comment pattern
        uuid_match = re.search(r'<!-- UAW_ORIGIN_UUID: ([a-f0-9\-]+) -->', content)
        if uuid_match:
            return uuid_match.group(1)
        
        print(f"{Colors.RED}Error: Could not find UUID in {html_file_path}{Colors.ENDC}")
        return None
    except Exception as e:
        print(f"{Colors.RED}Error reading {html_file_path}: {e}{Colors.ENDC}")
        return None

def find_html_files_in_category(web_dir, category_path):
    """Find all HTML files in a category directory and its subdirectories."""
    category_dir = os.path.join(web_dir, category_path)
    if not os.path.exists(category_dir):
        print(f"{Colors.YELLOW}Warning: Category directory {category_dir} does not exist{Colors.ENDC}")
        return []
    
    html_files = []
    for root, dirs, files in os.walk(category_dir):
        for file in files:
            if file.endswith('.html'):
                html_files.append(os.path.join(root, file))
    
    return html_files

def find_all_html_files(web_dir):
    """Find all HTML files in the entire web directory."""
    html_files = []
    for root, dirs, files in os.walk(web_dir):
        for file in files:
            if file.endswith('.html'):
                html_files.append(os.path.join(root, file))
    
    return html_files

def breadcrumbs_to_file_path(breadcrumbs, web_dir):
    """Convert breadcrumbs to expected HTML file path."""
    parts = breadcrumbs.strip('/').split('/')
    if len(parts) == 0:
        return None
    
    # The last part becomes the filename
    filename = f"{parts[-1]}.html"
    # All parts except the last become the directory path
    dir_path = os.path.join(web_dir, *parts[:-1])
    
    return os.path.join(dir_path, filename)

def breadcrumbs_from_file_path(file_path, web_dir):
    """Extract breadcrumbs from file path."""
    # Get relative path from web directory
    rel_path = os.path.relpath(file_path, web_dir)
    
    # Remove .html extension and convert path separators to forward slashes
    breadcrumbs = rel_path.replace('.html', '').replace(os.sep, '/')
    
    return breadcrumbs

def run_flow_maker(topic, breadcrumbs, model_name="gemma3"):
    """Run flow-maker.py to create a new flow."""
    script_dir = os.path.dirname(os.path.abspath(__file__))
    flow_maker_path = os.path.join(script_dir, "flow-maker.py")
    
    command = [sys.executable, flow_maker_path, topic, breadcrumbs, f"--model={model_name}"]
    
    print(f"{Colors.BLUE}Running: {' '.join(command)}{Colors.ENDC}")
    
    try:
        result = subprocess.run(command, cwd=script_dir, check=True)
        return True
    except subprocess.CalledProcessError as e:
        print(f"{Colors.RED}Error running flow-maker.py: {e}{Colors.ENDC}")
        return False

def run_assemble(flow_dir, output_dir):
    """Run assemble.py to regenerate the HTML."""
    script_dir = os.path.dirname(os.path.abspath(__file__))
    assemble_path = os.path.join(script_dir, "assemble.py")
    
    command = [sys.executable, assemble_path, flow_dir, output_dir]
    
    print(f"{Colors.BLUE}Running: {' '.join(command)}{Colors.ENDC}")
    
    try:
        result = subprocess.run(command, cwd=script_dir, check=True)
        return True
    except subprocess.CalledProcessError as e:
        print(f"{Colors.RED}Error running assemble.py: {e}{Colors.ENDC}")
        return False

def regenerate_page(breadcrumbs, web_dir, flow_base_dir, force_recreate=False):
    """Regenerate a single page by breadcrumbs."""
    print(f"\n{Colors.BOLD}Processing: {breadcrumbs}{Colors.ENDC}")
    
    # Find the HTML file
    html_file_path = breadcrumbs_to_file_path(breadcrumbs, web_dir)
    
    if not html_file_path or not os.path.exists(html_file_path):
        print(f"{Colors.RED}Error: HTML file not found at {html_file_path}{Colors.ENDC}")
        return False
    
    # Extract UUID from HTML file
    uuid = extract_uuid_from_html(html_file_path)
    if not uuid:
        return False
    
    # Look for flow directory
    flow_dir = os.path.join(flow_base_dir, uuid)
    
    if not os.path.exists(flow_dir) or force_recreate:
        if not os.path.exists(flow_dir):
            print(f"{Colors.YELLOW}Flow directory not found: {flow_dir}{Colors.ENDC}")
        else:
            print(f"{Colors.YELLOW}Force recreate requested{Colors.ENDC}")
        
        # Ask user if they want to recreate
        response = input(f"Would you like to recreate the page using flow-maker.py? [y/N]: ").strip().lower()
        if response == 'y' or response == 'yes':
            # Extract topic from the last part of breadcrumbs
            topic = breadcrumbs.split('/')[-1].replace('-', ' ').title()
            print(f"Recreating page with topic: '{topic}'")
            
            if run_flow_maker(topic, breadcrumbs):
                print(f"{Colors.GREEN}Successfully recreated page data{Colors.ENDC}")
                return True
            else:
                return False
        else:
            print("Skipping recreation")
            return False
    
    # Regenerate using assemble.py
    print(f"Found flow directory: {flow_dir}")
    
    # Determine output directory (directory containing the HTML file)
    output_dir = os.path.dirname(html_file_path)
    
    print(f"Regenerating to: {output_dir}")
    
    if run_assemble(flow_dir, output_dir):
        print(f"{Colors.GREEN}Successfully regenerated: {breadcrumbs}{Colors.ENDC}")
        return True
    else:
        return False

def regenerate_by_uuid(uuid, web_dir, flow_base_dir, force_recreate=False):
    """Regenerate a page by UUID."""
    print(f"\n{Colors.BOLD}Processing UUID: {uuid}{Colors.ENDC}")
    
    # Look for flow directory
    flow_dir = os.path.join(flow_base_dir, uuid)
    
    if not os.path.exists(flow_dir) or force_recreate:
        print(f"{Colors.RED}Error: Flow directory not found: {flow_dir}{Colors.ENDC}")
        print("Cannot recreate without breadcrumbs. Use --breadcrumbs instead.")
        return False
    
    # Try to find breadcrumbs from flow directory
    breadcrumbs_file = os.path.join(flow_dir, "breadcrumbs.txt")
    if not os.path.exists(breadcrumbs_file):
        print(f"{Colors.RED}Error: No breadcrumbs.txt found in {flow_dir}{Colors.ENDC}")
        return False
    
    with open(breadcrumbs_file, 'r', encoding='utf-8') as f:
        breadcrumbs = f.read().strip()
    
    print(f"Found breadcrumbs: {breadcrumbs}")
    
    # Determine output directory
    html_file_path = breadcrumbs_to_file_path(breadcrumbs, web_dir)
    output_dir = os.path.dirname(html_file_path)
    
    print(f"Regenerating to: {output_dir}")
    
    if run_assemble(flow_dir, output_dir):
        print(f"{Colors.GREEN}Successfully regenerated UUID: {uuid}{Colors.ENDC}")
        return True
    else:
        return False

def regenerate_category(category_path, web_dir, flow_base_dir, force_recreate=False):
    """Regenerate all pages in a category."""
    print(f"\n{Colors.BOLD}Regenerating category: {category_path}{Colors.ENDC}")
    
    html_files = find_html_files_in_category(web_dir, category_path)
    
    if not html_files:
        print(f"{Colors.YELLOW}No HTML files found in category: {category_path}{Colors.ENDC}")
        return True
    
    print(f"Found {len(html_files)} HTML files to regenerate")
    
    success_count = 0
    total_count = len(html_files)
    
    for html_file in html_files:
        breadcrumbs = breadcrumbs_from_file_path(html_file, web_dir)
        if regenerate_page(breadcrumbs, web_dir, flow_base_dir, force_recreate):
            success_count += 1
    
    print(f"\n{Colors.BOLD}Category regeneration complete: {success_count}/{total_count} successful{Colors.ENDC}")
    return success_count == total_count

def regenerate_entire_site(web_dir, flow_base_dir, force_recreate=False):
    """Regenerate all pages in the entire site."""
    print(f"\n{Colors.BOLD}Regenerating entire site{Colors.ENDC}")
    
    html_files = find_all_html_files(web_dir)
    
    if not html_files:
        print(f"{Colors.YELLOW}No HTML files found in web directory{Colors.ENDC}")
        return True
    
    print(f"Found {len(html_files)} HTML files to regenerate")
    
    # Ask for confirmation
    response = input(f"Are you sure you want to regenerate {len(html_files)} pages? [y/N]: ").strip().lower()
    if response != 'y' and response != 'yes':
        print("Operation cancelled")
        return False
    
    success_count = 0
    total_count = len(html_files)
    
    for i, html_file in enumerate(html_files, 1):
        print(f"\n{Colors.BLUE}Progress: {i}/{total_count}{Colors.ENDC}")
        breadcrumbs = breadcrumbs_from_file_path(html_file, web_dir)
        if regenerate_page(breadcrumbs, web_dir, flow_base_dir, force_recreate):
            success_count += 1
    
    print(f"\n{Colors.BOLD}Site regeneration complete: {success_count}/{total_count} successful{Colors.ENDC}")
    return success_count == total_count

def main():
    parser = argparse.ArgumentParser(
        description="Regenerate UAW pages from existing flow data or recreate them",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Regenerate a specific page
  python regenerator.py --breadcrumbs technology/software-development/code-generation
  
  # Regenerate by UUID
  python regenerator.py --uuid 08e3aeaa-1b51-47a2-990a-b6097b06fb3a
  
  # Regenerate all pages in a category
  python regenerator.py --category technology/software-development
  
  # Regenerate entire site
  python regenerator.py --entire-site
  
  # Force recreation of page data
  python regenerator.py --breadcrumbs technology/ai --force-recreate
        """
    )
    
    # Main operation modes (mutually exclusive)
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument('--breadcrumbs', type=str, 
                      help='Breadcrumbs path (e.g., technology/software-development/code-generation)')
    group.add_argument('--uuid', type=str, 
                      help='Page UUID to regenerate')
    group.add_argument('--category', type=str, 
                      help='Category path to regenerate all pages (e.g., technology or technology/software-development)')
    group.add_argument('--entire-site', action='store_true', 
                      help='Regenerate all pages in the entire site')
    
    # Optional arguments
    parser.add_argument('--force-recreate', action='store_true',
                       help='Force recreation of page data using flow-maker.py')
    
    args = parser.parse_args()
    
    # Setup paths
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(script_dir)
    web_dir = os.path.join(project_root, "web")
    flow_base_dir = os.path.join(script_dir, "flow")
    
    # Verify directories exist
    if not os.path.exists(web_dir):
        print(f"{Colors.RED}Error: Web directory not found: {web_dir}{Colors.ENDC}")
        sys.exit(1)
    
    if not os.path.exists(flow_base_dir):
        print(f"{Colors.RED}Error: Flow directory not found: {flow_base_dir}{Colors.ENDC}")
        sys.exit(1)
    
    print(f"{Colors.BLUE}UAW Regenerator{Colors.ENDC}")
    print(f"Web directory: {web_dir}")
    print(f"Flow directory: {flow_base_dir}")
    
    # Execute based on arguments
    success = False
    
    if args.breadcrumbs:
        success = regenerate_page(args.breadcrumbs, web_dir, flow_base_dir, args.force_recreate)
    
    elif args.uuid:
        success = regenerate_by_uuid(args.uuid, web_dir, flow_base_dir, args.force_recreate)
    
    elif args.category:
        success = regenerate_category(args.category, web_dir, flow_base_dir, args.force_recreate)
    
    elif args.entire_site:
        success = regenerate_entire_site(web_dir, flow_base_dir, args.force_recreate)
    
    if success:
        print(f"\n{Colors.GREEN}✓ Regeneration completed successfully{Colors.ENDC}")
        sys.exit(0)
    else:
        print(f"\n{Colors.RED}✗ Regeneration completed with errors{Colors.ENDC}")
        sys.exit(1)

if __name__ == "__main__":
    main()
