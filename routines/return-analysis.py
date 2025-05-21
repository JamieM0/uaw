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

def generate_roi_analysis(input_data, save_inputs=False):
    """Generate ROI analysis for automation at different production scales."""
    # Extract information from input data
    topic = input_data.get("topic", "")
    model = input_data.get("model", "gemma3")
    parameters = input_data.get("parameters", {})
    
    systemMsg = (
        "You are an AI assistant specialized in analyzing return on investment for automation technologies. "
        "For the given topic, provide a detailed ROI analysis for automation implementation across "
        "three production scales: small (low-scale), medium, and large (high-scale). "
    )
    
    user_msg = (f"Create a detailed ROI analysis for automation in: {topic}"
                "Format your response as a JSON object with these components:\n"
                "1. roi_analysis: An object with keys 'small_scale', 'medium_scale', and 'large_scale', each containing:\n"
                "   - timeframe: The typical ROI timeframe (e.g., '1-2 years', '3-5 years')\n"
                "   - initial_investment: Estimated range of initial investment required\n"
                "   - annual_savings: Estimated annual savings or benefits\n"
                "   - key_considerations: Array of specific factors affecting ROI at this scale\n"
                "2. key_benefits: Array of the most significant benefits driving ROI across all scales\n"
                "3. barriers: Array of common barriers or challenges to achieving good ROI\n"
                "4. recommendation: A brief recommendation about which scale benefits most from automation\n"
                "\nPlease return ONLY valid JSON without any additional text, explanation, or code block formatting."
    )
    
    # Save inputs to file if requested
    if save_inputs:
        save_path = f"flow/{flowUUID}/inputs/7-in.json"
        saveToFile(systemMsg, user_msg, save_path)
    
    # Use chat_with_llm to generate ROI analysis
    response = chat_with_llm(model, systemMsg, user_msg, parameters)
    
    # Extract and parse JSON from the response
    roi_data = extract_json_from_response(response)
    
    if roi_data is None:
        print("Error: Could not extract valid JSON from LLM response.")
        print("Response preview:", response[:200] + "..." if len(response) > 200 else response)
    
    return roi_data

def main():
    """Main function to run the ROI analysis."""
    global flowUUID
    usage_msg = "Usage: python return-analysis.py <input_json> [output_json] [-saveInputs] [-uuid=\"UUID\"] [-flow_uuid=\"FLOW-UUID\"]"
    input_filepath, specified_output_filepath, save_inputs, custom_uuid, flow_uuid_arg = handle_command_args(usage_msg)
    flowUUID = flow_uuid_arg # Set the global variable

    print("Working...")
    start_time = datetime.now()
    
    input_data = load_json(input_filepath)
    roi_data = generate_roi_analysis(input_data, save_inputs)
    
    if roi_data is None:
        print("Failed to generate ROI analysis.")
        sys.exit(1)
    
    # Get output filepath and UUID
    output_filepath, output_uuid = get_output_filepath(
        "return-analysis", 
        specified_path=specified_output_filepath
    )
    
    # Create process metadata
    process_metadata = create_output_metadata("Automation ROI Analysis", start_time, output_uuid)
    
    # Combine process metadata with output content
    output_data = {
        **process_metadata,
        "roi_analysis": roi_data
    }

    save_output(output_data, output_filepath)
    print(f"Generated ROI analysis, output saved to {output_filepath}")

if __name__ == "__main__":
    main()
