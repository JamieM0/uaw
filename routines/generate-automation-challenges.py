import json
import sys
from datetime import datetime
from utils import (
    load_json, save_output, chat_with_llm, parse_llm_json_response,
    create_output_metadata, get_output_filepath, handle_command_args,
    saveToFile
)

flowUUID = None # Global variable for flow UUID

def generate_automation_challenges(input_data, save_inputs=False):
    """Generate a list of challenges for automation in a specific topic."""
    # Extract information from input data
    topic = input_data.get("topic", "")
    model = input_data.get("model", "gemma3")
    parameters = input_data.get("parameters", {})

    # Generate a list of challenges using LLM
    systemMsg = (
        "You are an AI assistant specialized in analyzing automation challenges. "
        "Your task is to identify and explain the current technical, practical, and "
        "conceptual challenges that make automation difficult in a specific field or topic. "
        "The output MUST be a single, valid JSON object. "
        "The root of the JSON object must contain a key 'topic' (string, representing the field provided) "
        "and a key 'challenges' (a list of challenge objects). "
        "Each challenge object in the list must have 'id' (integer), 'title' (string), and 'explanation' (string) keys. "
        "Example format:\n"
        "{\n"
        "  \"topic\": \"Name of the Field/Topic\",\n"
        "  \"challenges\": [\n"
        "    {\n"
        "      \"id\": 1,\n"
        "      \"title\": \"First Challenge Title\",\n"
        "      \"explanation\": \"Detailed explanation of the first challenge.\"\n"
        "    },\n"
        "    {\n"
        "      \"id\": 2,\n"
        "      \"title\": \"Second Challenge Title\",\n"
        "      \"explanation\": \"Detailed explanation of the second challenge.\"\n"
        "    }\n"
        "  ]\n"
        "}\n"
        "Ensure the JSON is well-formed and complete."
    )

    user_msg = (
        f"Identify and explain the current automation challenges for the field: {topic}.\n\n"
        "Provide:\n"
        "1. The topic itself, as a string value for the 'topic' key.\n"
        "2. 4-8 specific challenges that make automation difficult in this field, as a list for the 'challenges' key.\n"
        "3. For each challenge in the list, provide an 'id', a concise 'title', and a 'detailed explanation'.\n"
        "4. Focus on technical limitations, practical constraints, and human expertise that's difficult to replicate.\n\n"
        "Format your entire response as a single JSON object as specified in the system message. "
        "Only include challenges that are significantly relevant to the topic."
    )

    # Save inputs to file if requested
    if save_inputs:
        save_path = f"flow/{flowUUID}/inputs/4-in.json"
        saveToFile(systemMsg, user_msg, save_path)

    # Use chat_with_llm to generate a list of challenges
    response = chat_with_llm(model, systemMsg, user_msg, parameters)

    try:
        # Try to parse JSON response
        # parse_llm_json_response is expected to return the full dictionary as per the prompt
        parsed_llm_output = parse_llm_json_response(response)
        
        # Basic validation of the parsed structure based on the new prompt
        if not isinstance(parsed_llm_output, dict) or \
           "topic" not in parsed_llm_output or \
           not isinstance(parsed_llm_output.get("topic"), str) or \
           "challenges" not in parsed_llm_output or \
           not isinstance(parsed_llm_output.get("challenges"), list):
            print(f"Error: LLM response for challenges does not match expected structure (topic, challenges list). Got: {str(parsed_llm_output)[:500]}", file=sys.stderr)
            # This error will lead to sys.exit(1) in main if parsed_llm_output is None or if we return None here.
            # If parse_llm_json_response raised an error, this won't be reached.
            # If it returned something that's not None but malformed, we catch it here.
            return None # Signal error to main
            
        return parsed_llm_output # This should be the dict like {"topic": "...", "challenges": [...]}
    except json.JSONDecodeError as e: # This will be caught if utils.parse_llm_json_response re-raises
        print(f"Error: LLM response for challenges is not valid JSON. {e}", file=sys.stderr)
        # The calling main() will handle sys.exit(1) if this returns None
        return None


def main():
    """Main function to run the challenge generation function."""
    global flowUUID
    usage_msg = "Usage: python generate_automation_challenges.py <input_json> [output_json] [-saveInputs] [-uuid=\"UUID\"] [-flow_uuid=\"FLOW-UUID\"]"
    input_filepath, specified_output_filepath, save_inputs, custom_uuid, flow_uuid_arg = handle_command_args(usage_msg)
    flowUUID = flow_uuid_arg # Set the global variable

    print("Working...")
    start_time = datetime.now()

    input_data = load_json(input_filepath)
    challenges = generate_automation_challenges(input_data, save_inputs)

    if challenges is None:
        print("Failed to generate automation challenges.")
        sys.exit(1)

    # Get output filepath and UUID
    output_filepath, output_uuid = get_output_filepath(
        "automation-challenges",
        specified_path=specified_output_filepath
    )

    # Create process metadata
    process_metadata = create_output_metadata("Automation Challenges Generation", start_time, output_uuid)

    # Combine process metadata with output content
    # 'challenges' here is the direct parsed output from the LLM,
    # which should now be the object {"topic": "...", "challenges": [...]}
    output_data = {
        **process_metadata,
        "challenges": challenges # This 'challenges' variable holds the dict from the LLM
    }
    # If 'challenges' from LLM is {"topic": "X", "challenges": [...] }
    # then output_data becomes:
    # { "uuid": ..., "challenges": {"topic": "X", "challenges": [...] } }
    # This matches the structure expected by flow-maker's validate_challenges_structure.

    save_output(output_data, output_filepath)
    print(f"Generated automation challenges, output saved to {output_filepath}")


if __name__ == "__main__":
    main()
