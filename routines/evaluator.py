import json
import argparse
from pathlib import Path
from utils import chat_with_llm
import sys

def load_metric_definitions():
    with open(Path(__file__).parent.parent / "metrics" / "definitions.json", "r") as f:
        return json.load(f)

def load_profile(profile_name, param):
    with open(Path(__file__).parent.parent / "metrics" / f"{profile_name}.json", "r") as f:
        return json.load(f)[param]

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
def is_section_relevant_to_persona(profile_name, biography, section_text, article_title):
    system_message = """
    You are a relevance classifier. You will be given:
1. A user persona description
2. The topic of the article the user is reading
3. The content of a specific section from that article

    Your task is to determine whether the section is relevant to the user's likely interests, assuming they are currently reading an article about that topic.

    Respond with a JSON object containing two keys:
1. "is_relevant": A boolean (true or false).
2. "reasoning": A brief explanation (1-2 sentences) for your decision.

Example response:
{
  "is_relevant": true,
  "reasoning": "This section is relevant because it directly addresses the user's stated interest in practical applications."
}
"""
    
    user_message = f"""
    Persona: {profile_name}

    Article topic:
    "{article_title}"
    
Persona biography:
\"\"\"
{biography}
\"\""

Section content:
\"\"\"
{section_text}
\"\""

Is this section relevant to the user? Provide your answer as a JSON object.
"""
    
    response_text = chat_with_llm("gemma3", system_message, user_message)
    
    try:
        # Attempt to find JSON within potentially larger response
        json_start = response_text.find('{')
        json_end = response_text.rfind('}') + 1
        if json_start != -1 and json_end != 0:
            json_str = response_text[json_start:json_end]
            data = json.loads(json_str)
            is_relevant = data.get("is_relevant", False)
            reasoning = data.get("reasoning", "No reasoning provided by LLM.")
            if not isinstance(is_relevant, bool):
                is_relevant = False # Default to False if type is incorrect
                reasoning += " (LLM returned non-boolean for is_relevant)"
            return is_relevant, reasoning
        else:
            # Fallback if no JSON object is found, try to interpret as True/False
            is_relevant_fallback = response_text.lower().strip().startswith("true")
            reasoning_fallback = "LLM did not return a valid JSON object. Relevance determined by simple True/False check."
            if not is_relevant_fallback and not response_text.lower().strip().startswith("false"):
                 reasoning_fallback += f" Raw LLM response: '{response_text[:100]}...'" # Add raw response if ambiguous
            return is_relevant_fallback, reasoning_fallback

    except json.JSONDecodeError:
        return False, f"Error: LLM response was not valid JSON. Response: '{response_text[:200]}...'"
    except Exception as e:
        return False, f"An unexpected error occurred while parsing LLM response: {str(e)}"

# Evaluate all relevant metrics for a section given a persona
def evaluate_section(section_text, profile_name, article_title):
    definitions = load_metric_definitions()
    metrics_to_check = load_profile(profile_name, "metrics")
    profile_biography = load_profile(profile_name, "biography")

    # First check if the section is relevant and get reasoning
    is_relevant, relevance_reasoning = is_section_relevant_to_persona(profile_name, profile_biography, section_text, article_title)

    if not is_relevant:
        return {
            "relevant": False,
            "relevance_reasoning": relevance_reasoning, # Add reasoning here
            "metrics": {metric: None for metric in metrics_to_check}
        }

    # Run all metrics
    results = {}
    for metric in metrics_to_check:
        desc = definitions[metric]["description"]
        results[metric] = run_metric_check_with_llm(desc, section_text)

    return {
        "relevant": True,
        "relevance_reasoning": relevance_reasoning, # relevance_reasoning is now defined
        "metrics": results
    }

def load_json_file(file_path):
    """Load and return JSON content from the specified file path."""
    with open(file_path, "r", encoding="utf-8") as f: # Specify UTF-8 encoding
        return json.load(f)

def main():
    """Process command line arguments and run evaluation."""
    parser = argparse.ArgumentParser(description='Evaluate text sections based on a profile.')
    parser.add_argument('input_file', type=str, help='Path to the JSON file containing text to evaluate')
    parser.add_argument('profile_name', type=str, help='Name of the profile to use for evaluation (e.g., "hobbyist")')
    parser.add_argument('article_title', type=str, help='Title of the article being evaluated')
    
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
        print(f"Evaluating section {i+1}/{len(sections)} for profile '{args.profile_name}' regarding article '{args.article_title}'...", file=sys.stderr)
        result = evaluate_section(section_text, args.profile_name, args.article_title)
        results.append({
            "section": section_text, # section_text should be a string or JSON-serializable
            "evaluation": result
        })
    
    # Print the final JSON results to stdout
    print(json.dumps(results, indent=2))

if __name__ == "__main__":
    main()