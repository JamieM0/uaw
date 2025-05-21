from datetime import datetime
from utils import (
    load_json, save_output, chat_with_llm, parse_llm_json_response,
    create_output_metadata, get_output_filepath, handle_command_args
)

def extract_step(input_data):
    """Extract steps based on the input text."""
    # Properly join the article text if it's a list
    text = " ".join(input_data.get("article_text", []))
    model = input_data.get("model", "gemma3")
    
    # Create a clearer prompt with explicit instructions
    userMsg = f"""Please extract the step-by-step instructions from the following article:

ARTICLE:
{text}

Remember to:
1. Extract only necessary, actionable steps
2. Keep steps concise and clear
3. Maintain logical order
4. Present steps in a simple list format without numbers or formatting

Each step should be on its own line, with no numbering.
"""

    systemMsg = ("You are an AI assistant specialized in extracting actionable instructions from text. "
                 "Your task is to take an article, recipe, or guide and distill it into a clear, step-by-step list of instructions. Follow these guidelines: "
                 "Extract only the necessary steps. Ignore background information, explanations, anecdotes, or unnecessary details. "
                 "Keep steps concise and clear. Ensure each step is actionable and uses direct language. "
                 "Maintain logical order. Ensure the steps follow a clear and natural progression. "
                 "Output the instructions in a simple list format with no numbers, symbols, markdown, or extra formatting. "
                 "Example Input: To make a great omelet, first, you need to gather your ingredients. People often wonder whether to use water or milk—chefs recommend milk. Crack the eggs into a bowl, whisk them, and add salt and pepper to taste. Then, heat a pan over medium heat and add butter. Once melted, pour in the eggs and let them sit before stirring. Cook until just set, then fold the omelet and serve immediately. "
                 "Example Output: \n"
                 "Crack eggs into a bowl and whisk.\n"
                 "Add salt, pepper, and a splash of milk.\n"
                 "Heat a pan over medium heat and add butter.\n"
                 "Pour in eggs and let them sit before stirring.\n"
                 "Cook until just set, then fold and serve.")

    response_text = chat_with_llm(model, systemMsg, userMsg, input_data.get("parameters", {}))

    # Use parse_llm_json_response utility with include_children=False
    steps = parse_llm_json_response(response_text, include_children=False)
    
    if not isinstance(steps, list):
        steps = [{"step": "No valid steps could be extracted"}]
        
    return steps

def main():
    """Main function to run the step extraction."""
    usage_msg = "Usage: python extract-steps.py <input_json> [output_json]"
    input_filepath, specified_output_filepath = handle_command_args(usage_msg)

    print("Working...")
    start_time = datetime.now()

    input_data = load_json(input_filepath)
    steps = extract_step(input_data)
    
    # Get output filepath and UUID
    output_filepath, output_uuid = get_output_filepath(
        "extract-steps", 
        specified_path=specified_output_filepath
    )
    
    # Create metadata
    metadata = create_output_metadata("Extract Steps", start_time, output_uuid)
    
    # Combine metadata with output content
    output_data = {
        **metadata,
        "steps": steps
    }

    save_output(output_data, output_filepath)
    print(f"Extracted steps, output saved to {output_filepath}")

if __name__ == "__main__":
    main()