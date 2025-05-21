# Usage note: use the model llama3.1:8b-instruct-q5_K_M for better results.
import json
import sys
import uuid
from datetime import datetime
import re
from utils import (
    load_json, save_output, chat_with_llm, parse_llm_json_response,
    create_output_metadata, get_output_filepath, handle_command_args
)

def merge_duplicate_facts(input_data):
    """Merge duplicate or similar facts in the input list."""
    facts = input_data.get("facts", [])
    model = input_data.get("model", "gemma3")
    parameters = input_data.get("parameters", {})

    system_msg = (
        "You are an AI assistant that identifies duplicate or similar facts in a list. "
        "When you find duplicates, merge them into a single, comprehensive fact. "
        "Organize the facts logically and remove redundancy. "
        "Format your response as a JSON array of strings, where each string is a unique fact. "
        "Your entire response must be parseable as JSON."
    )
    
    user_msg = (
        "Identify duplicate or similar facts in the following list and merge them into unique facts:\n\n" +
        "\n".join([f"- {fact}" for fact in facts])
    )
    
    # Use chat_with_llm instead of direct ollama.chat
    response_text = chat_with_llm(model, system_msg, user_msg, parameters)
    
    # Use parse_llm_json_response utility
    merged_facts = parse_llm_json_response(response_text, include_children=False)
    
    if not isinstance(merged_facts, list):
        merged_facts = ["No valid facts could be merged"]
    
    return merged_facts

def main():
    """Main function to run the fact merging."""
    usage_msg = "Usage: python merge-duplicate-facts.py <input_json> [output_json]"
    input_filepath, specified_output_filepath = handle_command_args(usage_msg)

    print("Working...")
    start_time = datetime.now()
    
    input_data = load_json(input_filepath)
    merged_facts = merge_duplicate_facts(input_data)
    
    # Get output filepath and UUID
    output_filepath, output_uuid = get_output_filepath(
        "merge-duplicate-facts", 
        specified_path=specified_output_filepath
    )
    
    # Create metadata
    metadata = create_output_metadata("Merge Duplicate Facts", start_time, output_uuid)
    
    # Combine metadata with output content
    output_data = {
        **metadata,
        "merged_facts": merged_facts
    }

    save_output(output_data, output_filepath)
    print(f"Merged facts, output saved to {output_filepath}")

if __name__ == "__main__":
    main()