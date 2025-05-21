from datetime import datetime
from utils import (
    load_json, save_output, chat_with_llm,
    create_output_metadata, get_output_filepath, handle_command_args
)

def generate_prompt_response(input_data):
    """Generate a response to the user's prompt."""
    prompt = input_data.get("prompt", "")
    model = input_data.get("model", "gemma3")
    system_message = (
        "You are a knowledgeable assistant specialized in providing accurate, concise, and informative facts about various topics. "
        "Your responses should be factual, specific, and organized. "
        "When asked about a subject, provide clear, detailed information based on your knowledge, focusing on relevant details. "
        "Present your information in a clear, structured format with one fact per line. "
        "Avoid unnecessary commentary, opinions, or irrelevant details. "
        "Focus on providing factual, educational content about the requested topic."
        "Focus on having a wide variety of facts."
        "Output the instructions in a simple list format with no numbers, symbols, markdown, or extra formatting. ")
    parameters = input_data.get("parameters", {})

    # Use chat_with_llm instead of direct ollama.chat
    response_content = chat_with_llm(model, system_message, prompt, parameters)
    
    return response_content

def main():
    """Main function to run the prompt response generation."""
    usage_msg = "Usage: python prompt.py <input_json> [output_json]"
    input_filepath, specified_output_filepath = handle_command_args(usage_msg)

    print("Working...")
    start_time = datetime.now()
    
    input_data = load_json(input_filepath)
    response_content = generate_prompt_response(input_data)
    
    # Get output filepath and UUID
    output_filepath, output_uuid = get_output_filepath(
        "prompt", 
        specified_path=specified_output_filepath
    )
    
    # Create metadata
    metadata = create_output_metadata("Prompt Response", start_time, output_uuid)
    
    # Combine metadata with output content
    output_data = {
        **metadata,
        "prompt": input_data.get("prompt", ""),
        "response": response_content.split("\n")
    }

    save_output(output_data, output_filepath)
    print(f"Generated response, output saved to {output_filepath}")

if __name__ == "__main__":
    main()