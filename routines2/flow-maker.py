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

def run_program(program_name, input_path, output_path, extra_args=None):
    """Run a program with the specified input and output paths."""
    print(f"Running {program_name}...")
    
    # Build command with any extra arguments
    command = [sys.executable, program_name, input_path, output_path]
    if extra_args:
        command.extend(extra_args)
        
    try:
        # Run the program and capture its output
        result = subprocess.run(
            command,
            capture_output=True,
            text=True,
            check=True
        )
        print(f"  {program_name} completed successfully")
        print(f"  {result.stdout.strip()}")
        return True
    except subprocess.CalledProcessError as e:
        print(f"  ERROR running {program_name}: {e}")
        print(f"  STDOUT: {e.stdout}")
        print(f"  STDERR: {e.stderr}")
        return False

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
    
    # Run each program in sequence
    for i, (program, output_filename) in enumerate(programs):
        print(f"\nStep {i+1}/{len(programs)}: Running {program}")

        # Default input is the copied input.json
        current_input_path = input_copy_path
        
        # Define output path for this program
        # For assemble.py, the output path is the flow directory itself
        if program == "assemble.py":
            output_path = flow_dir
            current_input_path = flow_dir # assemble.py takes the flow dir as input now
            extra_args = None # assemble.py doesn't need extra args like this
        else:
            output_path = os.path.join(flow_dir, output_filename)
            # Handle special parameters for hallucinate-tree.py
            extra_args = ["-saveInputs", "-flow_uuid="+flow_uuid]
            if program == "hallucinate-tree.py":
                extra_args += ["-flat"]
        
        # Run the program
        success = run_program(program, current_input_path, output_path, extra_args)

        if not success:
            print(f"Warning: {program} failed to complete successfully")
            # Optionally, decide if the flow should stop if a step fails
            # sys.exit(1)
    
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
    
    # HTML generation is now handled within the main loop
    
    print(f"\nFlow process completed in {time_taken}")
    print(f"Output files saved to: {os.path.abspath(flow_dir)}")

if __name__ == "__main__":
    main()