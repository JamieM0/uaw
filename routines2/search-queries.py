from datetime import datetime
from utils import (
    load_json, save_output, chat_with_llm, parse_llm_json_response,
    create_output_metadata, get_output_filepath, handle_command_args
)

def generate_search_queries(input_data):
    """Generate search queries based on the input topic."""
    topic = input_data.get("topic", "")
    model = input_data.get("model", "gemma3")
    parameters = input_data.get("parameters", {})

    systemMsg = ("You are a search query generation assistant. "
                 "Your task is to take a given topic and generate multiple high-quality search engine queries that help retrieve comprehensive, relevant, and useful information. "
                 "For each topic, generate a variety of queries, including: "
                 "General queries that provide a broad overview"
                 "Specific queries targeting authoritative sources"
                 "Question-based queries to find FAQ-style answers"
                 "Alternative phrasings to ensure diverse results"
                 "Advanced search operator queries (e.g., site:, filetype:, intitle:) for precision."
                 "Output the queries in a simple list format with no numbers, symbols, or extra formatting."
                 "Separate each query with a single newline.")
    
    user_msg = f"Generate search queries for the following topic:\n\n{topic}"
    
    # Use chat_with_llm instead of direct ollama.chat
    response_text = chat_with_llm(model, systemMsg, user_msg, parameters)
    
    # Use parse_llm_json_response utility
    queries = parse_llm_json_response(response_text, include_children=False)
    
    if not isinstance(queries, list):
        queries = ["No valid search queries could be generated"]
    
    return queries

def main():
    """Main function to run the search query generation."""
    usage_msg = "Usage: python search-queries.py <input_json> [output_json]"
    input_filepath, specified_output_filepath = handle_command_args(usage_msg)

    print("Working...")
    start_time = datetime.now()
    
    input_data = load_json(input_filepath)
    queries = generate_search_queries(input_data)
    
    # Get output filepath and UUID
    output_filepath, output_uuid = get_output_filepath(
        "search-queries", 
        specified_path=specified_output_filepath
    )
    
    # Create metadata
    metadata = create_output_metadata("Search Queries", start_time, output_uuid)
    
    # Combine metadata with output content
    output_data = {
        **metadata,
        "topic": input_data.get("topic", ""),
        "queries": queries
    }

    save_output(output_data, output_filepath)
    print(f"Generated search queries, output saved to {output_filepath}")

if __name__ == "__main__":
    main()