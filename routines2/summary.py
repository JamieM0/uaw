import json
import sys
import uuid
from datetime import datetime
from utils import (
    load_json, save_output, chat_with_llm,
    create_output_metadata, get_output_filepath, handle_command_args
)

def generate_summary(input_data):
    """Generate a summary of the input text."""
    text = " ".join(input_data.get("input_text", []))
    model = input_data.get("model", "gemma3")
    parameters = input_data.get("parameters", {})
    max_length = input_data.get("max_length", 200)

    systemMsg = (
        "You are an AI assistant specialized in summarizing content. "
        "Your goal is to provide a concise and clear summary of the provided text. "
        "Ensure that the summary captures the key points, main ideas, and critical details. "
        "Keep the summary brief, precise, and easy to understand. "
        "Avoid unnecessary details or opinions. "
        "Follow the output format as specified by the user if provided; otherwise, return a plain text summary."
    )
    
    user_msg = f"Summarize the following text:\n\n{text}"
    
    # Use chat_with_llm instead of direct ollama.chat
    summary = chat_with_llm(model, systemMsg, user_msg, parameters)
    
    return summary

def main():
    """Main function to run the summary generation."""
    usage_msg = "Usage: python summary.py <input_json> [output_json]"
    input_filepath, specified_output_filepath = handle_command_args(usage_msg)

    print("Working...")
    start_time = datetime.now()
    
    input_data = load_json(input_filepath)
    summary = generate_summary(input_data)
    
    # Get output filepath and UUID
    output_filepath, output_uuid = get_output_filepath(
        "summary", 
        specified_path=specified_output_filepath
    )
    
    # Create metadata
    metadata = create_output_metadata("Text Summary", start_time, output_uuid)
    
    # Combine metadata with output content
    output_data = {
        **metadata,
        "summary": summary.split("\n")
    }

    save_output(output_data, output_filepath)
    print(f"Generated summary, output saved to {output_filepath}")

if __name__ == "__main__":
    main()