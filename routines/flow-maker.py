import os
import sys
import uuid
import json
import subprocess
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

def run_program(program_name, input_path, output_path, step_info="Running script", extra_args=None):
    """
    Run a program with specified input/output, enhanced console output, and error handling.
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
            # Generic message, actual saving happens in sub-scripts
            print("  Saved inputs and outputs.")
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

PROFILES = ["hobbyist", "educator", "field_expert", "investor", "researcher"]

def main():
    """Main function to run the flow of programs."""
    usage_msg = "Usage: python flow-maker.py <input_json> [breadcrumbs]"
    
    if len(sys.argv) < 2:
        print(usage_msg)
        sys.exit(1)
        
    input_filepath = sys.argv[1]
    
    # Get breadcrumbs if provided, otherwise use a default empty value
    breadcrumbs = sys.argv[2] if len(sys.argv) > 2 else ""
    
    print("Starting flow process...")
    start_time = datetime.now()
    
    # Load the input data
    input_data = load_json(input_filepath)
    
    # Generate a UUID for this flow
    flow_uuid = str(uuid.uuid4())
    print(f"Flow UUID: {flow_uuid}")
    
    # Create flow directory
    flow_dir = os.path.join("flow", flow_uuid)
    os.makedirs(flow_dir, exist_ok=True)
    
    # Save a copy of the input file in the flow directory
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
        ("generate-automation-timeline.py", "3.json"),  # 3. generate-automation-timeline.py
        ("generate-automation-challenges.py", "4.json"), # 4. generate-automation-challenges.py
        ("automation-adoption.py", "5.json"),  # 5. automation-adoption.py
        ("current-implementations.py", "6.json"),  # 6. current-implementations.py
        ("return-analysis.py", "7.json"),  # 7. return-analysis.py
        ("future-technology.py", "8.json"),  # 8. future-technology.py
        ("specifications-industrial.py", "9.json"),  # 9. specifications-industrial.py
        ("assemble.py", None),  # 10. assemble.py - Output filename handled differently
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

        current_input_path = input_copy_path
        abs_current_input_path = os.path.abspath(current_input_path)
        
        if program == "assemble.py":
            output_path = flow_dir
            abs_current_input_path = os.path.abspath(flow_dir)
            extra_args = None
        else:
            output_path = os.path.join(flow_dir, output_filename)
            extra_args = ["-saveInputs", "-flow_uuid="+flow_uuid]
            if program == "hallucinate-tree.py":
                extra_args += ["-flat"]
        
        abs_output_path = os.path.abspath(output_path)
        
        run_result = run_program(program, abs_current_input_path, abs_output_path, step_info_prefix, extra_args)

        if run_result["status"] == "failure":
            print(run_result["error_info"])
            while True:
                choice = input(f"  {Colors.YELLOW}Action: [R]etry, [C]ontinue (skip step), or [S]top flow? {Colors.ENDC}").upper()
                if choice == 'R':
                    print(f"  Retrying {program}...")
                    # Loop will re-run current program_idx
                    break
                elif choice == 'C':
                    print(f"  Skipping {program} and continuing...")
                    program_idx += 1
                    break
                elif choice == 'S':
                    print(f"  Stopping flow.")
                    sys.exit(1)
                else:
                    print("  Invalid choice. Please enter R, C, or S.")
            if choice == 'R':
                continue # Retry the current script
            if choice == 'C':
                if program_idx >= len(programs): break # End of programs
                continue # Go to next iteration for the next script
            elif choice == 'S':
                sys.exit(1)
        
        # If successful and not assemble.py, run evaluations
        if run_result["status"] == "success" and program != "assemble.py":
            print(f"\n--- Starting Evaluation for output of {program} ({output_filename}) ---")
            section_source_file_path = abs_output_path

            for profile_name in PROFILES:
                # Using sys.stdout.write for more control over newlines if needed
                sys.stdout.write(f"\n  Evaluating for Profile: {Colors.BOLD}{profile_name.capitalize()}{Colors.ENDC}... ")
                sys.stdout.flush()
                
                eval_command = [
                    sys.executable,
                    evaluator_script_path,
                    section_source_file_path,
                    profile_name
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
                            print(f"    {Colors.RED}ERROR: No output received from evaluator.py for profile {profile_name}.{Colors.ENDC}")
                            eval_results_list = []
                        else:
                            eval_results_list = json.loads(actual_json_str)
                    else:
                        sys.stdout.write(f"{Colors.RED}Failed.{Colors.ENDC}\n")
                        sys.stdout.flush()
                        print(f"    {Colors.RED}ERROR running evaluator.py for profile {profile_name}. Return code: {eval_result_proc.returncode}{Colors.ENDC}")
                        if eval_result_proc.stdout.strip():
                             print(f"    {Colors.YELLOW}STDOUT from evaluator:{Colors.ENDC}\n{eval_result_proc.stdout.strip()}")
                        if eval_result_proc.stderr.strip():
                             print(f"    {Colors.YELLOW}STDERR from evaluator:{Colors.ENDC}\n{eval_result_proc.stderr.strip()}")
                        eval_results_list = []

                except json.JSONDecodeError as e_json:
                    sys.stdout.write(f"{Colors.RED}Failed (JSON Error).{Colors.ENDC}\n") # Overwrite "Done."
                    sys.stdout.flush()
                    print(f"    {Colors.RED}ERROR decoding JSON from evaluator.py for profile {profile_name}: {e_json}{Colors.ENDC}")
                    # actual_json_str might not be defined if subprocess failed before stdout was read
                    # For safety, let's ensure it exists or provide a placeholder.
                    raw_output_for_error = eval_result_proc.stdout.strip() if 'eval_result_proc' in locals() and hasattr(eval_result_proc, 'stdout') else "N/A"
                    print(f"    Raw STDOUT from evaluator for JSON parsing: '{raw_output_for_error}'")
                    eval_results_list = []
                except Exception as e_eval_general: # Catch other potential errors
                    sys.stdout.write(f"{Colors.RED}Failed (General Error).{Colors.ENDC}\n")
                    sys.stdout.flush()
                    print(f"    {Colors.RED}An unexpected error occurred running evaluator.py for {profile_name}: {e_eval_general}{Colors.ENDC}")
                    eval_results_list = []


                if not eval_results_list:
                    print(f"    No evaluation results processed for profile {profile_name} from {output_filename}.")

                for item_index, section_eval_result in enumerate(eval_results_list):
                    evaluation_details = section_eval_result.get("evaluation", {})
                    is_relevant = evaluation_details.get("relevant", False)

                    print(f"\n    Sub-section {item_index + 1} (from {output_filename}, Profile: {profile_name.capitalize()}):")
                    print(f"      Relevant: {is_relevant}")

                    if is_relevant:
                        metrics_results = evaluation_details.get("metrics", {})
                        if metrics_results:
                            print("      Metrics:")
                            for metric_name, passed_status in metrics_results.items():
                                status_str = f"{Colors.GREEN}Passed{Colors.ENDC}" if passed_status else \
                                             (f"{Colors.RED}Failed{Colors.ENDC}" if passed_status is False else "Not Applicable/Checked")
                                print(f"        - {metric_name}: {status_str}")
                                if passed_status is not None:
                                    evaluation_summary[profile_name]["total_relevant_checks"] += 1
                                    if passed_status:
                                        evaluation_summary[profile_name]["passed"] += 1
                                    
                                    # Populate all_flow_metrics with this specific metric result
                                    # Ensure section and profile lists are initialized
                                    if output_filename not in all_flow_metrics["sections"]:
                                        all_flow_metrics["sections"][output_filename] = {}
                                    if profile_name not in all_flow_metrics["sections"][output_filename]:
                                        all_flow_metrics["sections"][output_filename][profile_name] = {}
                                    
                                    all_flow_metrics["sections"][output_filename][profile_name][metric_name] = bool(passed_status)
                        else:
                            print("      No specific metrics evaluated for this relevant section.")
                    elif evaluation_details:
                        print("      Section deemed not relevant. No metrics applied by evaluator.")
            print(f"--- Finished Evaluation for output of {program} ---")
        
        program_idx += 1 # Move to next program

    # Generate alternative trees if specified in the input
    num_alternatives = input_data.get("alternatives", 0)
    if num_alternatives > 0:
        print(f"\nGenerating {num_alternatives} alternative trees...")
        
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
            alt_success = run_program("hallucinate-tree.py", alt_input_path, alt_output_path, ["-flat"])
            
            if alt_success:
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
        "input_file": input_filepath,
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
    try:
        with open(metrics_file_path, "w", encoding="utf-8") as mf:
            json.dump(all_flow_metrics, mf, indent=2)
        print(f"\n{Colors.GREEN}Successfully saved detailed metrics to {os.path.abspath(metrics_file_path)}{Colors.ENDC}")
    except Exception as e:
        print(f"\n{Colors.RED}Error saving detailed metrics to {os.path.abspath(metrics_file_path)}: {e}{Colors.ENDC}")

    print(f"\nFlow process completed in {time_taken}")
    print(f"Output files saved to: {os.path.abspath(flow_dir)}")

if __name__ == "__main__":
    main()