import os
import sys
import uuid
import json
import subprocess
import requests
import time
from datetime import datetime
from utils import (
    load_json, save_output, create_output_metadata,
    get_output_filepath, handle_command_args
)

# Attempt to enable ANSI escape code processing on Windows
if sys.platform == "win32":
    import ctypes
    try:
        kernel32 = ctypes.windll.kernel32
        stdout_handle = kernel32.GetStdHandle(-11) # STD_OUTPUT_HANDLE
        mode = ctypes.c_ulong()
        if kernel32.GetConsoleMode(stdout_handle, ctypes.byref(mode)):
            ENABLE_VIRTUAL_TERMINAL_PROCESSING = 0x0004
            # Enable VT processing if not already enabled
            if (mode.value & ENABLE_VIRTUAL_TERMINAL_PROCESSING) == 0:
                kernel32.SetConsoleMode(stdout_handle, mode.value | ENABLE_VIRTUAL_TERMINAL_PROCESSING)
    except Exception:
        # If enabling fails (e.g., ctypes not available, or older Windows), colors might not work.
        # A common fallback is os.system('') but it's not ideal.
        # For now, we'll proceed, and colors will simply not render if this failed.
        pass

# ANSI escape codes for colors
class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'

def validate_timeline_structure(data):
    """Validates the structure of the timeline JSON (3.json)."""
    if not isinstance(data, dict):
        return False, "Root of timeline data is not a dictionary."
    
    if "timeline" not in data: # Check for the top-level "timeline" key
        return False, "Missing 'timeline' key at the root of timeline data."
        
    timeline_obj = data.get("timeline") # This should be an object
    if not isinstance(timeline_obj, dict):
        # This is the primary check for the "bad" format vs "good" format for 3.json
        # In "bad" format, data["timeline"] is a list of {"step": "..."}
        # In "good" format, data["timeline"] is an object {"historical": {}, "predictions": {}}
        return False, "The 'timeline' key should map to an object (containing 'historical' and 'predictions'), not directly to a list. This indicates a malformed structure."
        
    if "historical" not in timeline_obj or not isinstance(timeline_obj.get("historical"), dict):
        return False, "Invalid or missing 'historical' (object) in the timeline object."
        
    if "predictions" not in timeline_obj or not isinstance(timeline_obj.get("predictions"), dict):
        return False, "Invalid or missing 'predictions' (object) in the timeline object."
        
    # Optionally, check types of keys/values within historical and predictions
    for section_key, section_obj in timeline_obj.items(): # Iterates historical, predictions
        if section_key in ["historical", "predictions"]:
            for year_key, desc_val in section_obj.items():
                if not isinstance(year_key, str) or not isinstance(desc_val, str):
                    return False, f"Invalid entry in timeline's '{section_key}': key '{year_key}' or its value is not a string."
    return True, "Timeline structure appears valid."

def validate_challenges_structure(data):
    """Validates the structure of the challenges JSON (4.json)."""
    if not isinstance(data, dict):
        return False, "Root of challenges data is not a dictionary."
    
    if "challenges" not in data:
        return False, "Missing 'challenges' key at the root of challenges data."
        
    challenges_obj = data.get("challenges")
    if not isinstance(challenges_obj, dict):
        return False, "The main 'challenges' key should map to an object (containing 'topic' and a 'challenges' list), not directly to a list of steps. This indicates a malformed structure (like 4-bad.json)."
        
    if "topic" not in challenges_obj or not isinstance(challenges_obj.get("topic"), str):
        return False, "Invalid or missing 'topic' (string) in the challenges object."
        
    if "challenges" not in challenges_obj or not isinstance(challenges_obj.get("challenges"), list):
        return False, "Invalid or missing 'challenges' (list) within the challenges object."
        
    challenges_list = challenges_obj.get("challenges")
    for idx, item in enumerate(challenges_list):
        if not isinstance(item, dict):
            return False, f"Item at index {idx} in the nested challenges list is not a dictionary."
        if not all(k in item for k in ["id", "title", "explanation"]):
            return False, f"Item at index {idx} in the nested challenges list is missing one or more required keys (id, title, explanation)."
        if not isinstance(item.get("title"), str) or \
           not isinstance(item.get("explanation"), str) or \
           not (isinstance(item.get("id"), int) or isinstance(item.get("id"), str)): # ID can be int or string
            return False, f"Item at index {idx} in the nested challenges list has non-string title/explanation or invalid ID type."
            
    return True, "Challenges structure appears valid."

def preload_ollama_model(model_name="gemma3", max_retries=3, retry_delay=2):
    """
    Preload the Ollama model to keep it in memory for the duration of the flow.
    Uses /api/chat to match the same API that scripts will use.
    Returns True if successful, False otherwise.
    """
    print(f"Preloading Ollama model '{model_name}'...")
    
    for attempt in range(max_retries):
        try:
            # Use /api/chat instead of /api/generate to match what scripts use
            response = requests.post(
                "http://localhost:11434/api/chat",
                json={
                    "model": model_name,
                    "messages": [
                        {
                            "role": "user",
                            "content": "Hello"
                        }
                    ],
                    "stream": False,
                    "options": {
                        "num_predict": 1  # Minimal generation to just load model
                    }
                },
                timeout=30
            )
            
            if response.status_code == 200:
                print(f"{Colors.GREEN}Model '{model_name}' preloaded successfully.{Colors.ENDC}")
                return True
            else:
                print(f"{Colors.YELLOW}Attempt {attempt + 1}/{max_retries}: HTTP {response.status_code}{Colors.ENDC}")
                
        except requests.exceptions.ConnectionError:
            print(f"{Colors.YELLOW}Attempt {attempt + 1}/{max_retries}: Ollama server not responding{Colors.ENDC}")
        except requests.exceptions.Timeout:
            print(f"{Colors.YELLOW}Attempt {attempt + 1}/{max_retries}: Request timed out{Colors.ENDC}")
        except Exception as e:
            print(f"{Colors.YELLOW}Attempt {attempt + 1}/{max_retries}: {str(e)}{Colors.ENDC}")
        
        if attempt < max_retries - 1:
            print(f"Retrying in {retry_delay} seconds...")
            time.sleep(retry_delay)
    
    print(f"{Colors.RED}Failed to preload model '{model_name}' after {max_retries} attempts.{Colors.ENDC}")
    return False

def keep_model_warm(model_name="gemma3"):
    """
    Send a minimal request to keep the model loaded in memory.
    Uses /api/chat to match the same API that scripts use.
    This prevents Ollama from unloading it due to inactivity.
    """
    try:
        requests.post(
            "http://localhost:11434/api/chat",
            json={
                "model": model_name,
                "messages": [
                    {
                        "role": "user", 
                        "content": "."
                    }
                ],
                "stream": False,
                "options": {
                    "num_predict": 1
                }
            },
            timeout=10
        )
    except Exception:
        # Silently fail - this is just a keep-alive
        pass

def cleanup_ollama_model(model_name="gemma3"):
    """
    Optionally unload the model from memory after the flow completes.
    Note: Ollama will naturally unload models after a period of inactivity.
    """
    try:
        # Send a request to unload the model (this is optional)
        # Ollama doesn't have a direct "unload" API, but we can let it naturally timeout
        print(f"Model '{model_name}' will be unloaded by Ollama after inactivity timeout.")
        return True
    except Exception as e:
        print(f"{Colors.YELLOW}Note: Could not explicitly unload model: {e}{Colors.ENDC}")
        return False

def run_program(program_name, input_path, output_path, step_info="Running script", extra_args=None, model_name="gemma3"):
    """
    Run a program with specified input/output, enhanced console output, and error handling.
    Now includes model keep-alive functionality.
    Returns a dictionary with 'status': 'success' or 'failure', and 'error_info' if failed.
    """
    script_dir = os.path.dirname(os.path.abspath(__file__))
    script_full_path = os.path.join(script_dir, program_name)

    command = [sys.executable, script_full_path, input_path, output_path]
    if extra_args:
        command.extend(extra_args)

    # Print initial running message (no newline)
    sys.stdout.write(f"{step_info}{program_name}... ")
    sys.stdout.flush()
    
    # Keep model warm before running the program
    keep_model_warm(model_name)
    
    # Capture input data before running the program (skip for assemble.py which uses directories)
    input_data = None
    if program_name != "assemble.py":
        try:
            input_data = load_json(input_path)
        except Exception as e:
            print(f"Warning: Could not load input data from {input_path}: {e}")

    try:
        result = subprocess.run(
            command,
            capture_output=True,
            text=True,
            check=False, # We'll check status manually
            cwd=script_dir
        )

        if result.returncode == 0:
            sys.stdout.write(f"\r{step_info}{program_name}... {Colors.GREEN}Completed!{Colors.ENDC}\n")
            sys.stdout.flush()
            
            # Capture output data and add transparency data (skip for assemble.py)
            if program_name != "assemble.py":
                try:
                    output_data = load_json(output_path)
                    
                    # Determine the step number from output_path to find corresponding input file
                    step_number = None
                    if output_path.endswith('.json'):
                        filename = os.path.basename(output_path)
                        if filename.split('.')[0].isdigit():
                            step_number = filename.split('.')[0]
                    
                    # Try to load the corresponding input file from inputs directory
                    llm_input_data = None
                    if step_number:
                        flow_dir = os.path.dirname(output_path)
                        input_file_path = os.path.join(flow_dir, "inputs", f"{step_number}-in.json")
                        try:
                            llm_input_data = load_json(input_file_path)
                        except Exception as e:
                            print(f"  Warning: Could not load LLM input data from {input_file_path}: {e}")
                    
                    # Add input and output to the JSON for transparency
                    if isinstance(output_data, dict):
                        if llm_input_data:
                            output_data['input'] = llm_input_data
                        else:
                            # Fallback to the input file data if LLM input not found
                            output_data['input'] = input_data
                        
                        # Save the updated file with transparency data (file itself is the output)
                        save_output(output_data, output_path)
                        
                except Exception as e:
                    print(f"  Warning: Could not add transparency data to {output_path}: {e}")
                
            return {"status": "success"}
        else:
            sys.stdout.write(f"\r{step_info}{program_name}... {Colors.RED}Failed!{Colors.ENDC}\n")
            sys.stdout.flush()
            error_info = (
                f"  {Colors.RED}ERROR running {program_name}:{Colors.ENDC}\n"
                f"  Return Code: {result.returncode}\n"
                f"  {Colors.YELLOW}STDOUT from {program_name}:{Colors.ENDC}\n{result.stdout.strip()}\n"
                f"  {Colors.YELLOW}STDERR from {program_name}:{Colors.ENDC}\n{result.stderr.strip()}"
            )
            return {"status": "failure", "error_info": error_info, "program_name": program_name, "args": (program_name, input_path, output_path, step_info, extra_args)}

    except Exception as e: # Catch other exceptions like file not found for the script itself
        sys.stdout.write(f"\r{step_info}{program_name}... {Colors.RED}Failed! (Critical Error){Colors.ENDC}\n")
        sys.stdout.flush()
        error_info = (
            f"  {Colors.RED}CRITICAL ERROR trying to run {program_name}:{Colors.ENDC}\n"
            f"  Exception: {str(e)}"
        )
        return {"status": "failure", "error_info": error_info, "program_name": program_name, "args": (program_name, input_path, output_path, step_info, extra_args)}

def countdown_choice(prompt, default_choice, countdown_seconds=5):
    """
    Display a prompt with countdown, defaulting to a choice after timeout.
    Returns the user's choice or the default if timeout occurs.
    """
    import select
    import sys
    
    # For Windows compatibility
    if sys.platform == "win32":
        import msvcrt
        print(f"{prompt}")
        print(f"  {Colors.YELLOW}Auto-retrying in {countdown_seconds} seconds... (press any key to choose manually){Colors.ENDC}")
        
        for i in range(countdown_seconds, 0, -1):
            sys.stdout.write(f"\r  Auto-retry in {i} seconds...")
            sys.stdout.flush()
            time.sleep(1)
            
            # Check if a key was pressed
            if msvcrt.kbhit():
                msvcrt.getch()  # Clear the key press
                print("\n")
                while True:
                    choice = input(f"  {Colors.YELLOW}Action: [R]etry, [C]ontinue (skip step), or [S]top flow? {Colors.ENDC}").upper()
                    if choice in ['R', 'C', 'S']:
                        return choice
                    print("  Invalid choice. Please enter R, C, or S.")
        
        print(f"\n  {Colors.GREEN}Auto-retrying...{Colors.ENDC}")
        return default_choice
    else:
        # Unix/Linux version using select
        print(f"{prompt}")
        print(f"  {Colors.YELLOW}Auto-retrying in {countdown_seconds} seconds... (press Enter to choose manually){Colors.ENDC}")
        
        for i in range(countdown_seconds, 0, -1):
            sys.stdout.write(f"\r  Auto-retry in {i} seconds...")
            sys.stdout.flush()
            
            # Use select to check if input is available
            ready, _, _ = select.select([sys.stdin], [], [], 1)
            if ready:
                sys.stdin.readline()  # Clear the input
                print("\n")
                while True:
                    choice = input(f"  {Colors.YELLOW}Action: [R]etry, [C]ontinue (skip step), or [S]top flow? {Colors.ENDC}").upper()
                    if choice in ['R', 'C', 'S']:
                        return choice
                    print("  Invalid choice. Please enter R, C, or S.")
        
        print(f"\n  {Colors.GREEN}Auto-retrying...{Colors.ENDC}")
        return default_choice

PROFILES = ["hobbyist", "educator", "field_expert", "investor", "researcher"]

# Function to load metric definitions (similar to evaluator.py)
def load_metric_definitions_for_flow_maker():
    # Assuming metrics/definitions.json is relative to this script's parent's sibling "metrics" dir
    # i.e. ../metrics/definitions.json if script is in routines/
    script_dir = os.path.dirname(os.path.abspath(__file__))
    definitions_path = os.path.join(script_dir, "..", "metrics", "definitions.json")
    try:
        with open(definitions_path, "r", encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        print(f"{Colors.RED}Error: Metric definitions file not found at {definitions_path}{Colors.ENDC}")
        return {} # Return empty dict to avoid crashing, but metrics will lack names/descriptions
    except json.JSONDecodeError:
        print(f"{Colors.RED}Error: Could not decode JSON from metric definitions file at {definitions_path}{Colors.ENDC}")
        return {}

def main():
    """Main function to run the flow of programs."""
    global metric_definitions_data # Make it accessible in the metrics processing loop
    metric_definitions_data = load_metric_definitions_for_flow_maker()

    usage_msg = "Usage: python flow-maker.py <topic> [breadcrumbs] [--model=model_name]"
    
    if len(sys.argv) < 2:
        print(usage_msg)
        sys.exit(1)
        
    # First argument is now the topic directly
    topic = sys.argv[1]
    
    # Get breadcrumbs if provided, otherwise use a default empty value
    breadcrumbs = sys.argv[2] if len(sys.argv) > 2 and not sys.argv[2].startswith("--") else ""
    
    # Parse model name from command line arguments
    model_name = "gemma3"  # default
    for arg in sys.argv:
        if arg.startswith("--model"):
            if "=" in arg:
                model_name = arg.split("=", 1)[1]
            else:
                # Look for next argument
                try:
                    model_idx = sys.argv.index(arg)
                    if model_idx + 1 < len(sys.argv):
                        model_name = sys.argv[model_idx + 1]
                except (ValueError, IndexError):
                    pass
    
    print("UAW Flow Maker")
    print(f"Topic: {topic}")
    start_time = datetime.now()
    
    # Preload the model before starting the flow
    model_preloaded = preload_ollama_model(model_name)
    if not model_preloaded:
        print(f"{Colors.YELLOW}Warning: Model preloading failed. Scripts may run slower as model loads for each step.{Colors.ENDC}")
        while True:
            choice = input(f"Continue anyway? [Y/N]: ").upper()
            if choice == 'Y':
                break
            elif choice == 'N':
                print("Flow cancelled.")
                sys.exit(1)
            else:
                print("Please enter Y or N.")
    
    # Create input data structure instead of loading from file
    input_data = {
        "topic": topic,
        "model": model_name,
        "depth": 2,
        "parameters": {},
        "alternatives": 0  # Default to no alternatives
    }
    
    # Generate a UUID for this flow
    flow_uuid = str(uuid.uuid4())
    print(f"Flow UUID: {flow_uuid}")
    
    # Create flow directory
    flow_dir = os.path.join("flow", flow_uuid)
    os.makedirs(flow_dir, exist_ok=True)
    
    # Save the generated input data to the flow directory for transparency
    input_copy_path = os.path.join(flow_dir, "input.json")
    with open(input_copy_path, "w", encoding="utf-8") as f:
        json.dump(input_data, f, indent=4)
    
    # Save breadcrumbs to a file in the flow directory
    if breadcrumbs:
        breadcrumbs_path = os.path.join(flow_dir, "breadcrumbs.txt")
        with open(breadcrumbs_path, "w", encoding="utf-8") as f:
            f.write(breadcrumbs)
        print(f"Breadcrumbs saved: {breadcrumbs}")
    
    # Define the programs to run in order
    programs = [
        ("generate-metadata.py", "1.json"),  # 1. metadata.py
        ("hallucinate-tree.py", "2.json"),   # 2. hallucinate-tree.py
        ("expand-node.py", "expanded-tree.json"),  # 3. expand-node.py - Expand the tree with detailed substeps
        ("generate-automation-timeline.py", "3.json"),  # 4. generate-automation-timeline.py
        ("generate-automation-challenges.py", "4.json"), # 5. generate-automation-challenges.py
        ("automation-adoption.py", "5.json"),  # 6. automation-adoption.py
        ("current-implementations.py", "6.json"),  # 7. current-implementations.py
        ("return-analysis.py", "7.json"),  # 8. return-analysis.py
        ("future-technology.py", "8.json"),  # 9. future-technology.py
        ("specifications-industrial.py", "9.json"),  # 10. specifications-industrial.py
        ("simulation.py", "simulation.json"),  # 11. simulation.py - Generate process simulation
        # 12. assemble.py - Run after all content generation including simulation
    ]
    
    evaluation_summary = {
        profile: {"passed": 0, "total_relevant_checks": 0}
        for profile in PROFILES
    }
    # Initialize structure for collecting all metrics for metrics.json
    all_flow_metrics = {
        "flow_uuid": flow_uuid,
        "sections": {}
    }

    script_dir = os.path.dirname(os.path.abspath(__file__))
    evaluator_script_path = os.path.join(script_dir, "evaluator.py")

    # Run each program in sequence
    program_idx = 0
    while program_idx < len(programs):
        program, output_filename = programs[program_idx]
        step_info_prefix = f"Step {program_idx + 1}/{len(programs)}: "

        # For expand-node.py, use 2.json (the tree) as input from hallucinate-tree.py
        if program == "expand-node.py":
            current_input_path = os.path.join(flow_dir, "2.json")
        # For simulation.py, use 2.json (the tree) as input instead of the previous output
        elif program == "simulation.py":
            current_input_path = os.path.join(flow_dir, "2.json")
        else:
            current_input_path = input_copy_path
        
        abs_current_input_path = os.path.abspath(current_input_path)
        
        output_path = os.path.join(flow_dir, output_filename)
        extra_args = ["-saveInputs", "-flow_uuid="+flow_uuid]
        if program == "hallucinate-tree.py":
            extra_args += ["-flat"]
        
        abs_output_path = os.path.abspath(output_path)
        
        run_result = run_program(program, abs_current_input_path, abs_output_path, step_info_prefix, extra_args, model_name)

        if run_result["status"] == "failure":
            print(run_result["error_info"])
            choice = countdown_choice(
                f"  {Colors.YELLOW}Error occurred in {program}.{Colors.ENDC}",
                'R',  # Default to Retry
                5     # 5 second countdown
            )
            
            if choice == 'R':
                print(f"  Retrying {program}...")
                continue # Retry the current script
            elif choice == 'C':
                print(f"  Skipping {program} and continuing...")
                program_idx += 1
                if program_idx >= len(programs): break # End of programs
                continue # Go to next iteration for the next script
            elif choice == 'S':
                print(f"  Stopping flow.")
                sys.exit(1)

        # If script execution was successful, proceed to potential validation and then evaluation
        if run_result["status"] == "success":
            validation_passed_for_current_file = True
            validation_error_message = ""

            # Perform specific validation based on the program that just ran
            if program == "generate-automation-timeline.py": # For 3.json
                try:
                    generated_content = load_json(abs_output_path)
                    validation_passed_for_current_file, validation_error_message = validate_timeline_structure(generated_content)
                    if not validation_passed_for_current_file:
                        print(f"  {Colors.RED}Structural Validation Failed for {output_filename} (Timeline):{Colors.ENDC} {validation_error_message}")
                except Exception as e_val:
                    validation_passed_for_current_file = False
                    validation_error_message = f"Exception during timeline validation of {output_filename}: {e_val}"
                    print(f"  {Colors.RED}{validation_error_message}{Colors.ENDC}")
            
            elif program == "generate-automation-challenges.py": # For 4.json
                try:
                    generated_content = load_json(abs_output_path)
                    validation_passed_for_current_file, validation_error_message = validate_challenges_structure(generated_content)
                    if not validation_passed_for_current_file:
                        print(f"  {Colors.RED}Structural Validation Failed for {output_filename} (Challenges):{Colors.ENDC} {validation_error_message}")
                except Exception as e_val:
                    validation_passed_for_current_file = False
                    validation_error_message = f"Exception during challenges validation of {output_filename}: {e_val}"
                    print(f"  {Colors.RED}{validation_error_message}{Colors.ENDC}")

            if not validation_passed_for_current_file:
                # Validation failed, use countdown choice
                choice = countdown_choice(
                    f"  {Colors.YELLOW}Validation failed for {output_filename}: {validation_error_message}{Colors.ENDC}",
                    'R',  # Default to Retry
                    5     # 5 second countdown
                )
                
                if choice == 'R':
                    print(f"  Retrying {program}...")
                    continue # Retry current program in the main while loop
                elif choice == 'C':
                    print(f"  Skipping evaluations for {output_filename} and continuing with next program...")
                    program_idx += 1
                    if program_idx >= len(programs): break
                    continue # Go to next program in the main while loop
                elif choice == 'S':
                    print(f"  Stopping flow.")
                    sys.exit(1)
            
            # If validation passed (or was not applicable for this file type)
            # AND program is not assemble.py, simulation.py, or expand-node.py, then run evaluations.
            if validation_passed_for_current_file and program not in ["assemble.py", "simulation.py", "expand-node.py"]:
                section_source_file_path = abs_output_path

                # Run evaluation for all profiles in a single call
                sys.stdout.write(f"  Evaluating for all profiles... ")
                sys.stdout.flush()
                
                eval_command = [
                    sys.executable,
                    evaluator_script_path,
                    section_source_file_path,
                ] + PROFILES + [
                    breadcrumbs # Use breadcrumbs as article_title
                ]
                
                try:
                    eval_result_proc = subprocess.run(
                        eval_command,
                        capture_output=True,
                        text=True,
                        check=False, # Check manually
                        cwd=script_dir
                    )
                    
                    if eval_result_proc.returncode == 0:
                        sys.stdout.write(f"{Colors.GREEN}Done.{Colors.ENDC}\n")
                        sys.stdout.flush()
                        actual_json_str = eval_result_proc.stdout.strip()
                        if not actual_json_str:
                            print(f"    {Colors.RED}ERROR: No output received from evaluator.py.{Colors.ENDC}")
                            all_eval_results = {}
                        else:
                            all_eval_results = json.loads(actual_json_str)
                    else:
                        sys.stdout.write(f"{Colors.RED}Failed.{Colors.ENDC}\n")
                        sys.stdout.flush()
                        print(f"    {Colors.RED}ERROR running evaluator.py. Return code: {eval_result_proc.returncode}{Colors.ENDC}")
                        if eval_result_proc.stdout.strip():
                             print(f"    {Colors.YELLOW}STDOUT from evaluator:{Colors.ENDC}\n{eval_result_proc.stdout.strip()}")
                        if eval_result_proc.stderr.strip():
                             print(f"    {Colors.YELLOW}STDERR from evaluator:{Colors.ENDC}\n{eval_result_proc.stderr.strip()}")
                        all_eval_results = {}

                except json.JSONDecodeError as e_json:
                    sys.stdout.write(f"{Colors.RED}Failed (JSON Error).{Colors.ENDC}\n")
                    sys.stdout.flush()
                    print(f"    {Colors.RED}ERROR decoding JSON from evaluator.py: {e_json}{Colors.ENDC}")
                    raw_output_for_error = eval_result_proc.stdout.strip() if 'eval_result_proc' in locals() and hasattr(eval_result_proc, 'stdout') else "N/A"
                    print(f"    Raw STDOUT from evaluator for JSON parsing: '{raw_output_for_error}'")
                    all_eval_results = {}
                except Exception as e_eval_general:
                    sys.stdout.write(f"{Colors.RED}Failed (General Error).{Colors.ENDC}\n")
                    sys.stdout.flush()
                    print(f"    {Colors.RED}An unexpected error occurred running evaluator.py: {e_eval_general}{Colors.ENDC}")
                    all_eval_results = {}

                # Process results for each profile
                for profile_name in PROFILES:
                    eval_results_list = all_eval_results.get(profile_name, [])
                    
                    if not eval_results_list:
                        print(f"    No evaluation results processed for profile {profile_name} from {output_filename}.")

                    for item_index, section_eval_result in enumerate(eval_results_list):
                        evaluation_details = section_eval_result.get("evaluation", {})
                        is_relevant = evaluation_details.get("relevant", False)
                        relevance_reasoning = evaluation_details.get("relevance_reasoning", "No reasoning provided.")

                        if output_filename not in all_flow_metrics["sections"]:
                            all_flow_metrics["sections"][output_filename] = {}
                        if profile_name not in all_flow_metrics["sections"][output_filename]:
                            all_flow_metrics["sections"][output_filename][profile_name] = {
                                "is_relevant_to_persona": is_relevant,
                                "relevance_reasoning": relevance_reasoning,
                                "evaluated_metrics_dict": {},
                                "evaluated_metrics": []
                            }
                        else:
                            profile_entry_for_update = all_flow_metrics["sections"][output_filename][profile_name]
                            profile_entry_for_update["is_relevant_to_persona"] = is_relevant
                            profile_entry_for_update["relevance_reasoning"] = relevance_reasoning
                            if "evaluated_metrics_dict" not in profile_entry_for_update:
                                 profile_entry_for_update["evaluated_metrics_dict"] = {}
                            if "evaluated_metrics" not in profile_entry_for_update:
                                 profile_entry_for_update["evaluated_metrics"] = []

                        if is_relevant:
                            metrics_results = evaluation_details.get("metrics", {})
                            if metrics_results:
                                profile_data_entry = all_flow_metrics["sections"][output_filename][profile_name]
                                profile_data_entry["evaluated_metrics_dict"] = metrics_results

                                for metric_name, passed_status in metrics_results.items():
                                    if passed_status is not None:
                                        evaluation_summary[profile_name]["total_relevant_checks"] += 1
                                        if passed_status:
                                            evaluation_summary[profile_name]["passed"] += 1
                            else:
                                print("      No specific metrics evaluated for this relevant section.")
                        elif evaluation_details:
                            all_flow_metrics["sections"][output_filename][profile_name]["is_relevant_to_persona"] = False
                            all_flow_metrics["sections"][output_filename][profile_name]["relevance_reasoning"] = relevance_reasoning
                            if "evaluated_metrics" not in all_flow_metrics["sections"][output_filename][profile_name]:
                                 all_flow_metrics["sections"][output_filename][profile_name]["evaluated_metrics"] = []

        program_idx += 1 # Move to next program

    # Generate alternative trees if specified in the input
    num_alternatives = input_data.get("alternatives", 0)
    if num_alternatives > 0:
        print(f"\nGenerating {num_alternatives} alternative trees...")
        
        # Create inputs directory for alternatives
        inputs_dir = os.path.join(flow_dir, "inputs")
        os.makedirs(inputs_dir, exist_ok=True)
        
        # Create variations of the input with different model parameters for diversity
        alternative_inputs = []
        for i in range(num_alternatives):
            alt_input = input_data.copy()
            
            # Modify parameters to create diversity in the alternatives
            if "parameters" not in alt_input:
                alt_input["parameters"] = {}
            
            # Different temperature for each alternative to produce variations
            alt_input["parameters"]["temperature"] = 0.3 + (i * 0.15)  # 0.3, 0.45, 0.6, etc.
            
            # Different name/title for each approach
            if i == 0:
                alt_input["approach_name"] = "Efficiency-Optimized Approach"
                alt_input["approach_description"] = "This approach prioritizes minimizing resource usage and production time."
            elif i == 1:
                alt_input["approach_name"] = "Safety-Optimized Approach"
                alt_input["approach_description"] = "This approach focuses on maximizing safety and reliability."
            elif i == 2:
                alt_input["approach_name"] = "Hybridized Approach"
                alt_input["approach_description"] = "This approach balances efficiency with safety considerations."
            else:
                alt_input["approach_name"] = f"Alternative Approach {i+1}"
                alt_input["approach_description"] = f"An alternative methodology for approaching this process."
            
            alternative_inputs.append(alt_input)
        
        # Generate each alternative tree
        for i, alt_input in enumerate(alternative_inputs):
            alt_input_path = os.path.join(flow_dir, f"inputs/alt_input_{i+1}.json")
            alt_output_path = os.path.join(flow_dir, f"alt{i+1}.json")
            
            # Save the alternative input
            with open(alt_input_path, "w", encoding="utf-8") as f:
                json.dump(alt_input, f, indent=4)
            
            # Run hallucinate-tree.py with the alternative input
            run_result = run_program("hallucinate-tree.py", alt_input_path, alt_output_path, f"  Alternative {i+1}: ", ["-flat"], model_name)
            
            if run_result["status"] == "success":
                print(f"  Alternative tree {i+1} generated successfully at {alt_output_path}")
            else:
                print(f"  Warning: Failed to generate alternative tree {i+1}")

    # Create flow metadata
    end_time = datetime.now()
    time_taken = end_time - start_time
    
    flow_metadata = {
        "uuid": flow_uuid,
        "date_created": end_time.isoformat(),
        "task": "Complete Automation Flow",
        "time_taken": str(time_taken),
        "topic": topic,  # Use the topic parameter instead of input_filepath
        "model": model_name,  # Add model information
        "programs_run": [p[0] for p in programs]
    }
    
    # Save flow metadata
    metadata_path = os.path.join(flow_dir, "flow-metadata.json")
    with open(metadata_path, "w", encoding="utf-8") as f:
        json.dump(flow_metadata, f, indent=4)
    
    # HTML generation is now handled within the main loop (by assemble.py)
    
    print("\n--- Overall Evaluation Summary ---")
    for profile_name, data in evaluation_summary.items():
        passed_count = data["passed"]
        total_checks = data["total_relevant_checks"]
        if total_checks > 0:
            print(f"  {profile_name.capitalize()}: {passed_count}/{total_checks} metrics passed across all relevant sections.")
        else:
            print(f"  {profile_name.capitalize()}: No relevant metrics evaluated or all sections deemed irrelevant.")

    # Save all collected metrics to metrics.json
    metrics_file_path = os.path.join(flow_dir, "metrics.json")
    
    # Load metric definitions to build the final evaluated_metrics list
    definitions_for_metrics = {}
    try:
        # Construct path relative to script_dir for metrics/definitions.json
        definitions_path = os.path.join(script_dir, "..", "metrics", "definitions.json")
        with open(definitions_path, "r", encoding="utf-8") as def_f:
            definitions_for_metrics = json.load(def_f)
    except Exception as e:
        print(f"  {Colors.YELLOW}Warning: Could not load metric definitions.json for enriching metrics.json: {e}{Colors.ENDC}")

    # Restructure metrics before saving
    for section_file, profiles_data in all_flow_metrics.get("sections", {}).items():
        for profile, data_for_profile in profiles_data.items():
            # Get the temporary dict and remove it
            raw_metrics_dict = data_for_profile.pop("evaluated_metrics_dict", {})
            data_for_profile["evaluated_metrics"] = [] # Initialize the final list
            if isinstance(raw_metrics_dict, dict):
                for metric_id, passed_status in raw_metrics_dict.items():
                    metric_definition = definitions_for_metrics.get(metric_id, {})
                    data_for_profile["evaluated_metrics"].append({
                        "id": metric_id,
                        "name": metric_definition.get("name", metric_id), # Use ID as name if not found
                        "passed": bool(passed_status) if passed_status is not None else None, # Ensure boolean or None
                        "description": metric_definition.get("description", "Description not found.")
                    })
            elif raw_metrics_dict is None and not data_for_profile["is_relevant_to_persona"]:
                 # If not relevant, evaluated_metrics should be an empty list
                 pass # Already initialized to []
            else:
                print(f"  {Colors.YELLOW}Warning: 'evaluated_metrics_dict' for {section_file}/{profile} was not a dict or was unexpected: {raw_metrics_dict}{Colors.ENDC}")


    try:
        with open(metrics_file_path, "w", encoding="utf-8") as mf:
            json.dump(all_flow_metrics, mf, indent=2)
        print(f"\n{Colors.GREEN}Successfully saved detailed metrics to {os.path.abspath(metrics_file_path)}{Colors.ENDC}")
    except Exception as e:
        print(f"\n{Colors.RED}Error saving detailed metrics to {os.path.abspath(metrics_file_path)}: {e}{Colors.ENDC}")

    # Run assemble.py to generate HTML output
    # Determine the web output path based on breadcrumbs
    web_output_dir = None
    if breadcrumbs:
        # Convert breadcrumbs path to web directory structure
        # breadcrumbs: "technology/software-development/ci-cd-pipelines"
        # should become directory: "uaw/web/technology/software-development/"
        # and assemble.py will create: "ci-cd-pipelines.html"
        
        breadcrumb_parts = breadcrumbs.strip('/').split('/')
        if len(breadcrumb_parts) > 0:
            # Create the web directory path using all parts except the last one
            script_dir = os.path.dirname(os.path.abspath(__file__))
            project_root = os.path.dirname(script_dir)  # Go up from routines/ to uaw/
            web_base_dir = os.path.join(project_root, "web")
            
            # Create nested directory structure for all parts except the last
            web_dir_path = web_base_dir
            for part in breadcrumb_parts[:-1]:  # All parts except the last one
                web_dir_path = os.path.join(web_dir_path, part)
            
            # Ensure the directory exists
            os.makedirs(web_dir_path, exist_ok=True)
            
            print(f"Web output directory: {os.path.abspath(web_dir_path)}")
            print(f"HTML filename will be determined by assemble.py based on page title/slug")
            web_output_dir = web_dir_path
    
    # Fallback to flow directory if no breadcrumbs or parsing fails
    if not web_output_dir:
        web_output_dir = flow_dir
        print(f"Using fallback output directory: {os.path.abspath(web_output_dir)}")
    
    abs_current_input_path = os.path.abspath(flow_dir)
    extra_args = None
    run_result = run_program("assemble.py", abs_current_input_path, web_output_dir, "Assembling HTML output... ", extra_args, model_name)
    if run_result["status"] == "failure":
        print(run_result["error_info"])
        sys.exit(1)
    
    # Cleanup: Allow model to unload naturally
    cleanup_ollama_model(model_name)
    
    print(f"\nFlow process completed in {time_taken}")
    print(f"Flow files saved to: {os.path.abspath(flow_dir)}")
    if web_output_dir != flow_dir:
        print(f"Web page saved to directory: {os.path.abspath(web_output_dir)}")

if __name__ == "__main__":
    main()