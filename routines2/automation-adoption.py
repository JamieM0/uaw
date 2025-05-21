import json
import sys
from datetime import datetime
from utils import (
    load_json, save_output, chat_with_llm, parse_llm_json_response,
    create_output_metadata, get_output_filepath, handle_command_args,
    saveToFile
)

flowUUID = None # Global variable for flow UUID

def generate_automation_adoption(input_data, save_inputs=False):
    """Generate detailed information about automation adoption phases for a specific topic."""
    # Extract information from input data
    topic = input_data.get("topic", "")
    model = input_data.get("model", "gemma3")
    parameters = input_data.get("parameters", {})

    # Generate automation adoption phases using LLM
    systemMsg = (
        "You are an AI assistant specialized in analyzing automation adoption patterns. "
        "Your task is to identify and explain the different phases of automation adoption "
        "in a specific field or topic, from basic mechanical assistance to full end-to-end automation."
    )

    user_msg = (
        f"Create a detailed breakdown of automation adoption phases for: {topic}\n\n"
        "Please structure your response in 4 phases:\n"
        "Phase 1: Basic Mechanical Assistance (Currently widespread)\n"
        "Phase 2: Integrated Semi-Automation (Currently in transition)\n"
        "Phase 3: Advanced Automation Systems (Emerging technology)\n"
        "Phase 4: Full End-to-End Automation (Future development)\n\n"
        "For each phase:\n"
        "1. Provide 4-6 specific examples of automation technology or processes\n"
        "2. Make sure the automation complexity increases with each phase\n"
        "3. Be specific to the domain rather than generic\n\n"
        "Format your response as a JSON object with the following structure:\n"
        "{\n"
        "  \"phase1\": {\n"
        "    \"title\": \"Basic Mechanical Assistance\",\n"
        "    \"status\": \"Currently widespread\",\n"
        "    \"examples\": [\"example1\", \"example2\", ...]\n"
        "  },\n"
        "  \"phase2\": { ... },\n"
        "  \"phase3\": { ... },\n"
        "  \"phase4\": { ... }\n"
        "}\n\n"
        "Only include examples that are significantly relevant to the topic."
    )

    # Save inputs to file if requested
    if save_inputs:
        save_path = f"flow/{flowUUID}/inputs/5-in.json"
        saveToFile(systemMsg, user_msg, save_path)

    # Use chat_with_llm to generate automation adoption phases
    response = chat_with_llm(model, systemMsg, user_msg, parameters)

    try:
        # Try to parse JSON response
        adoption_phases = parse_llm_json_response(response)
        return adoption_phases
    except json.JSONDecodeError:
        print("Error: LLM response is not valid JSON. Full response: " + response)
        return None


def main():
    """Main function to run the automation adoption generation function."""
    global flowUUID
    usage_msg = "Usage: python automation-adoption.py <input_json> [output_json] [-saveInputs] [-uuid=\"UUID\"] [-flow_uuid=\"FLOW-UUID\"]"
    input_filepath, specified_output_filepath, save_inputs, custom_uuid, flow_uuid_arg = handle_command_args(usage_msg)
    flowUUID = flow_uuid_arg # Set the global variable

    print("Working...")
    start_time = datetime.now()

    input_data = load_json(input_filepath)
    adoption_phases = generate_automation_adoption(input_data, save_inputs)

    if adoption_phases is None:
        print("Failed to generate automation adoption phases.")
        sys.exit(1)

    # Get output filepath and UUID
    output_filepath, output_uuid = get_output_filepath(
        "automation-adoption",
        specified_path=specified_output_filepath
    )

    # Create process metadata
    process_metadata = create_output_metadata("Automation Adoption Phases Generation", start_time, output_uuid)

    # Combine process metadata with output content
    output_data = {
        **process_metadata,
        "automation_adoption": adoption_phases
    }

    save_output(output_data, output_filepath)
    print(f"Generated automation adoption phases, output saved to {output_filepath}")


if __name__ == "__main__":
    main()
