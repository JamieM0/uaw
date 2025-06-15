import json
import sys
from datetime import datetime
from utils import (
    load_json, save_output, chat_with_llm, parse_llm_json_response,
    create_output_metadata, get_output_filepath, handle_command_args,
    saveToFile
)

flowUUID = None # Global variable for flow UUID

def generate_page_metadata(input_data, save_inputs=False):
    """Generate standardized metadata for a topic page."""
    # Extract information from input data
    topic = input_data.get("topic", "")
    model = input_data.get("model", "gemma3")
    parameters = input_data.get("parameters", {})
    
    # If input already contains metadata fields, use them directly
    if "metadata" in input_data:
        return input_data["metadata"]
    
    # Otherwise, generate metadata using LLM
    systemMsg = (
        "You are an AI assistant specialized in creating consistent metadata for technical topics. "
        "Generate appropriate metadata for the topic provided, including: "
        "- A descriptive title (using the topic name) MAXIMUM 2-3 WORDS DO NOT INCLDUE A SUBTITLE (e.g., ANYTHING AFTER A SEMICOLON) "
        "- A subtitle that explains the scope "
        "- Current automation status (You MUST use one of the below defined terms for automation status. Include ONLY the name, for example, No Automation is a valid response, if it is appropriate for the given topic of course). "
        "- Percentage estimate of progress toward full automation (as a percentage). The key MUST be 'progress_percentage'. BE CRITICAL, do not exaggerate current status. E.g., '25%' would be appropriate for topics where some partial automation is POSSIBLE."
        "- Explanatory text (1-3 paragraphs) that describes the topic and its automation journey. This should be returned as a single string under the key 'explanatory_text'. "
        "Format your response as a JSON object with these fields."
        "Automation status options:"
        "No Automation - Tasks performed entirely by humans without automated tools or systems."
        "Tool Supported - Humans operate specialized tools or GUIs that enhance manual tasks but don't execute them automatically."
        "Support Automation - Systems provide context-aware suggestions and guidance while humans retain execution authority."
        "Scripted Automation - Predefined scripts execute specific sequences of tasks with minimal human intervention."
        "Coordinated Automation - Multiple automated systems are orchestrated through workflows with limited human intervention."
        "Self-Managing Automation - Systems that monitor, adapt, and optimize their performance based on policies without routine human commands."
        "Fully Autonomous (Self-Evolving) - End-to-end processes that operate and adapt over time without human involvement, using ML/AI to improve strategies."
    )
    
    user_msg = f"Create metadata for a Universal Automation Wiki page about: {topic}"
    
    # Save inputs to file if requested
    if save_inputs:
        save_path = f"flow/{flowUUID}/inputs/1-in.json"
        saveToFile(systemMsg, user_msg, save_path)
    
    # Use chat_with_llm to generate metadata
    response = chat_with_llm(model, systemMsg, user_msg, parameters)
    # Parse JSON using shared utility to extract JSON block reliably
    metadata = parse_llm_json_response(response)
    if not isinstance(metadata, dict):
        print("Error: Parsed metadata is not a JSON object. Full response: " + response)
        return None
    return metadata

def main():
    """Main function to run the metadata generation."""
    global flowUUID
    usage_msg = "Usage: python generate-metadata.py <input_json> [output_json] [-saveInputs] [-uuid=\"UUID\"] [-flow_uuid=\"FLOW-UUID\"]"
    input_filepath, specified_output_filepath, save_inputs, custom_uuid, flow_uuid_arg = handle_command_args(usage_msg)
    flowUUID = flow_uuid_arg # Set the global variable

    print("Working...")
    start_time = datetime.now()
    
    input_data = load_json(input_filepath)
    metadata = generate_page_metadata(input_data, save_inputs)
    
    if metadata is None:
        print("Failed to generate metadata.")
        sys.exit(1)
    
    # Get output filepath and UUID
    output_filepath, output_uuid = get_output_filepath(
        "metadata", 
        specified_path=specified_output_filepath
    )
    
    # Create process metadata
    process_metadata = create_output_metadata("Page Metadata Generation", start_time, output_uuid)
    
    # Combine process metadata with output content
    output_data = {
        **process_metadata,
        "page_metadata": metadata
    }

    save_output(output_data, output_filepath)
    print(f"Generated page metadata, output saved to {output_filepath}")

if __name__ == "__main__":
    main()
