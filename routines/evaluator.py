import json
import argparse
from pathlib import Path
from utils import chat_with_llm
import sys

def load_metric_definitions():
    with open(Path(__file__).parent.parent / "metrics" / "definitions.json", "r") as f:
        return json.load(f)

def load_metric_profile(profile_name):
    with open(Path(__file__).parent.parent / "metrics" / f"{profile_name}.json", "r") as f:
        return json.load(f)["metrics"]

# Run classification prompt using local LLM via Ollama
def run_metric_check_with_llm(metric_description, section_text):
    system_message = "You are a strict binary classifier. Based on the following content, determine if the given condition is met. Respond only with 'True' or 'False'."
    
    user_message = f"""Condition:
"{metric_description}"

Content:
\"\"\"
{section_text}
\"\""
"""
    
    response = chat_with_llm("gemma3", system_message, user_message)
    return response.lower().startswith("true")

# Check if section is relevant to a persona using LLM
def is_section_relevant_to_persona(profile_name, section_text):
    system_message = "You are a classifier. Given a section of an article and a user type, decide if this section would be useful for that user. Respond only with 'True' or 'False'."
    
    user_message = f"""User type: {profile_name}

Section:
\"\"\"
{section_text}
\"\""
"""
    
    response = chat_with_llm("gemma3", system_message, user_message)
    return response.lower().startswith("true")

# Evaluate all relevant metrics for a section given a persona
def evaluate_section(section_text, profile_name):
    definitions = load_metric_definitions()
    metrics_to_check = load_metric_profile(profile_name)

    # First check if the section is relevant
    if not is_section_relevant_to_persona(profile_name, section_text):
        return {
            "relevant": False,
            "metrics": {metric: None for metric in metrics_to_check}
        }

    # Run all metrics
    results = {}
    for metric in metrics_to_check:
        desc = definitions[metric]["description"]
        results[metric] = run_metric_check_with_llm(desc, section_text)

    return {
        "relevant": True,
        "metrics": results
    }

def load_json_file(file_path):
    """Load and return JSON content from the specified file path."""
    with open(file_path, "r") as f:
        return json.load(f)

def main():
    """Process command line arguments and run evaluation."""
    parser = argparse.ArgumentParser(description='Evaluate text sections based on a profile.')
    parser.add_argument('input_file', type=str, help='Path to the JSON file containing text to evaluate')
    parser.add_argument('profile_name', type=str, help='Name of the profile to use for evaluation (e.g., "hobbyist")')
    
    args = parser.parse_args()
    
    # Load the input text from the provided JSON file
    try:
        input_data = load_json_file(args.input_file)
        if isinstance(input_data, str):
            # If the JSON file contains a single string
            sections = [input_data]
        elif isinstance(input_data, list):
            # If the JSON file contains a list of strings
            sections = input_data
        elif isinstance(input_data, dict) and "sections" in input_data:
            # If the JSON file has a sections key
            sections = input_data["sections"]
        else:
            # Default case
            sections = [str(input_data)]
    except Exception as e:
        print(f"Error loading input file: {e}")
        return
    
    # Evaluate each section
    results = []
    for i, section_text in enumerate(sections):
        print(f"Evaluating section {i+1}/{len(sections)} for profile '{args.profile_name}'...", file=sys.stderr)
        result = evaluate_section(section_text, args.profile_name)
        results.append({
            "section": section_text, # section_text should be a string or JSON-serializable
            "evaluation": result
        })
    
    # Print the final JSON results to stdout
    print(json.dumps(results, indent=2))

# Example usage
# if __name__ == "__main__":
#     section = "This section explains how to use a commercial-grade dough kneader and where to purchase it online."
#     profile = "hobbyist"
#     result = evaluate_section(section, profile)
#     print(json.dumps(result, indent=2))
if __name__ == "__main__":
    main()