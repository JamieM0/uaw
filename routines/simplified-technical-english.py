import json
from datetime import datetime
from utils import (
    load_json, save_output, chat_with_llm,
    create_output_metadata, get_output_filepath, handle_command_args
)

def translate_simplified_technical_english(input_data):
    """Convert the input text to Simplified Technical English."""
    prompt = f"""
    {" ".join(input_data.get("input_text", []))}
    Output Format: {input_data["output_format"]}
    """

    if "success_criteria" in input_data:
        criteria_str = json.dumps(input_data["success_criteria"], indent=2)
        prompt += f"\n\nSuccess Criteria:\n{criteria_str}"

    systemMsg = ("Convert the given text into Simplified Technical English. "
                 "Follow these Simplified Technical English rules:\n"
                 "1. Use only approved technical words for your technical domain\n"
                 "2. Keep sentences short (20 words or less)\n"
                 "3. Use simple present tense when possible\n"
                 "4. Be specific and avoid ambiguity\n"
                 "5. Use active voice instead of passive\n"
                 "6. One instruction per sentence\n"
                 "7. Use articles (the, a, an) consistently\n"
                 "8. Use the same term consistently for each concept\n"
                 "9. Avoid slang, jargon, and colloquialisms\n"
                 "10. Use approved technical vocabulary only")

    # Use chat_with_llm instead of direct ollama.chat call
    response_content = chat_with_llm(
        model=input_data["model"],
        system_message=systemMsg,
        user_message=prompt,
        parameters=input_data.get("parameters", {})
    )

    return response_content

def main():
    """Main function to run the Simplified Technical English conversion."""
    usage_msg = "Usage: python simplified-technical-english.py <input_json> [output_json]"
    input_filepath, specified_output_filepath = handle_command_args(usage_msg)

    print("Working...")
    start_time = datetime.now()

    input_data = load_json(input_filepath)
    output_content = translate_simplified_technical_english(input_data)
    
    # Process output to handle potential paragraph structure
    output_lines = []
    for paragraph in output_content.split('\n\n'):
        # Add each paragraph as an item, or split further by lines if appropriate
        if len(paragraph.strip()) > 0:
            output_lines.append(paragraph.strip())
    
    # Get output filepath and UUID
    output_filepath, output_uuid = get_output_filepath(
        "simplified-technical-english", 
        specified_path=specified_output_filepath
    )
    
    # Create metadata
    metadata = create_output_metadata("Simplified Technical English conversion", start_time, output_uuid)
    
    # Combine metadata with output content
    output_data = {
        **metadata,
        "output_text": output_lines
    }

    save_output(output_data, output_filepath)
    print(f"Generated Simplified Technical English, output saved to {output_filepath}")

if __name__ == "__main__":
    main()