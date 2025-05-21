import json
from datetime import datetime
from utils import (
    load_json, save_output, chat_with_llm,
    create_output_metadata, get_output_filepath, handle_command_args
)

def translate_basic_english(input_data):
    """Convert the input text to BASIC English."""
    prompt = f"""
    {" ".join(input_data.get("input_text", []))}
    Output Format: {input_data["output_format"]}
    """

    if "success_criteria" in input_data:
        criteria_str = json.dumps(input_data["success_criteria"], indent=2)
        prompt += f"\n\nSuccess Criteria:\n{criteria_str}"

    systemMsg = ("Convert the given text into BASIC English. "
                 "Use only words from the BASIC English list (850 words). "
                 "Make all sentences short, clear, and simple. Do not use difficult words. "
                 "If needed, explain with easy words. Keep numbers and measurements clear. "
                 "If the sentence is already simple, do not change it.")

    # Use chat_with_llm instead of direct ollama.chat call
    response_content = chat_with_llm(
        model=input_data["model"],
        system_message=systemMsg,
        user_message=prompt,
        parameters=input_data.get("parameters", {})
    )

    return response_content

def main():
    """Main function to run the BASIC English convert routine."""
    usage_msg = "Usage: python basic-english.py <input_json> [output_json]"
    input_filepath, specified_output_filepath = handle_command_args(usage_msg)

    print("Working...")
    start_time = datetime.now()

    input_data = load_json(input_filepath)
    output_content = translate_basic_english(input_data)
    
    # Get output filepath and UUID
    output_filepath, output_uuid = get_output_filepath(
        "basic-english", 
        specified_path=specified_output_filepath
    )
    
    # Create metadata
    metadata = create_output_metadata("BASIC English conversion", start_time, output_uuid)
    
    # Combine metadata with output content
    output_data = {
        **metadata,
        "output_text": output_content.split("\n")
    }

    save_output(output_data, output_filepath)
    print(f"Generated BASIC English, output saved to {output_filepath}")

if __name__ == "__main__":
    main()