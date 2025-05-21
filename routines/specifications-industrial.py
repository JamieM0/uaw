import json
import sys
import re
from datetime import datetime
from utils import (
    load_json, save_output, chat_with_llm,
    create_output_metadata, get_output_filepath, handle_command_args,
    saveToFile
)

flowUUID = None # Global variable for flow UUID

def sanitize_json_string(json_str):
    """Remove control characters and other invalid characters from a JSON string."""
    # Replace control characters that are invalid in JSON
    # This regex matches control characters (ASCII 0-31) except tabs, newlines and carriage returns
    sanitized = re.sub(r'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]', '', json_str)
    return sanitized

def extract_json_from_response(response):
    """Extract and parse JSON from various formats in LLM responses."""
    # First try direct parsing
    try:
        return json.loads(sanitize_json_string(response))
    except json.JSONDecodeError:
        pass
    
    # Try extracting from code fence markers
    if "```json" in response or "```" in response:
        try:
            # Extract content between code fence markers with or without language specifier
            if "```json" in response:
                json_content = response.split("```json", 1)[1].split("```", 1)[0].strip()
            else:
                json_content = response.split("```", 1)[1].split("```", 1)[0].strip()
            
            return json.loads(sanitize_json_string(json_content))
        except (json.JSONDecodeError, IndexError) as e:
            print(f"Error extracting JSON from code block: {str(e)}")
    
    # Look for content between curly braces
    try:
        if "{" in response and "}" in response:
            start = response.find("{")
            end = response.rfind("}") + 1
            potential_json = response[start:end]
            return json.loads(sanitize_json_string(potential_json))
    except json.JSONDecodeError as e:
        print(f"Error parsing JSON between curly braces: {str(e)}")
    
    return None

def generate_industrial_specifications(input_data, save_inputs=False):
    """Generate industrial specifications for a given topic."""
    # Extract information from input data
    topic = input_data.get("topic", "")
    model = input_data.get("model", "gemma3")
    parameters = input_data.get("parameters", {})
    
    systemMsg = (
        "You are an AI assistant specialized in industrial engineering and specifications. "
        "For the given topic, provide a comprehensive overview of industrial/commercial specifications "
        "including performance metrics and implementation requirements. "
        "Be precise with numerical values and include ranges where appropriate. "
        "Focus on practical technical details that would be relevant to professionals in the field."
    )
    
    user_msg = (f"Create detailed industrial specifications for: {topic}\n\n"
                "Format your response as a JSON object with these categories:\n"
                "1. performance_metrics: An array of metrics with names, values/ranges, and descriptions\n"
                "2. implementation_requirements: An array of requirements with names, specifications, and descriptions\n"
                "3. industry_standards: An array of relevant standards and certifications\n"
                "4. key_suppliers: An array of major equipment/technology suppliers for this industry\n"
                "5. operational_considerations: An array of important operational factors\n"
                "\nPlease provide realistic values for industrial/commercial scale implementations.\n"
                "\nReturn ONLY valid JSON without any additional text, explanation, or code block formatting."
    )
    
    # Save inputs to file if requested
    if save_inputs:
        save_path = f"flow/{flowUUID}/inputs/9-in.json"
        saveToFile(systemMsg, user_msg, save_path)
    
    # Use chat_with_llm to generate industrial specifications
    response = chat_with_llm(model, systemMsg, user_msg, parameters)
    
    # Extract and parse JSON from the response
    specs_data = extract_json_from_response(response)
    
    if specs_data is None:
        print("Error: Could not extract valid JSON from LLM response.")
        print("Response: ", response)
    
    return specs_data

def main():
    """Main function to run the industrial specifications analysis."""
    global flowUUID
    usage_msg = "Usage: python specifications-industrial.py <input_json> [output_json] [-saveInputs] [-uuid=\"UUID\"] [-flow_uuid=\"FLOW-UUID\"]"
    input_filepath, specified_output_filepath, save_inputs, custom_uuid, flow_uuid_arg = handle_command_args(usage_msg)
    flowUUID = flow_uuid_arg # Set the global variable

    print("Working...")
    start_time = datetime.now()
    
    input_data = load_json(input_filepath)
    specs_data = generate_industrial_specifications(input_data, save_inputs)
    
    if specs_data is None:
        print("Failed to generate industrial specifications.")
        sys.exit(1)
    
    # Get output filepath and UUID
    output_filepath, output_uuid = get_output_filepath(
        "specifications-industrial", 
        specified_path=specified_output_filepath
    )
    
    # Create process metadata
    process_metadata = create_output_metadata("Industrial Specifications Analysis", start_time, output_uuid)
    
    # Combine process metadata with output content
    output_data = {
        **process_metadata,
        "industrial_specifications": specs_data
    }

    save_output(output_data, output_filepath)
    print(f"Generated industrial specifications, output saved to {output_filepath}")

if __name__ == "__main__":
    main()
