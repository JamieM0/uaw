import json
import argparse
from pathlib import Path
from utils import chat_with_llm, parse_llm_json_response
import sys

# Define persona definitions here since they're referenced in the main function
PERSONA_DEFINITIONS = {
    "hobbyist": "Individual who pursues automation as a personal interest or hobby project",
    "educator": "Teacher, trainer, or academic who educates others about automation processes", 
    "field_expert": "Professional with deep technical expertise in the specific domain being automated",
    "investor": "Individual or entity evaluating automation opportunities for financial investment",
    "researcher": "Academic or industry researcher studying automation methodologies and outcomes"
}

def load_metric_definitions():
    with open(Path(__file__).parent.parent / "metrics" / "definitions.json", "r") as f:
        return json.load(f)

def load_profile(profile_name, param):
    with open(Path(__file__).parent.parent / "metrics" / f"{profile_name}.json", "r") as f:
        return json.load(f)[param]

def load_json_file(file_path):
    """Load and return JSON content from the specified file path."""
    with open(file_path, "r", encoding="utf-8") as f:
        return json.load(f)

def evaluate_section_for_persona_batch(section_data, persona_name, persona_description, article_title, metric_definitions):
    """
    Evaluate a section for a specific persona using a single batched LLM call.
    This combines relevance checking and all metric evaluations into one request.
    """
    # Get the metrics this persona cares about
    try:
        metrics_to_check = load_profile(persona_name, "metrics")
    except Exception as e:
        print(f"Error loading metrics for {persona_name}: {e}", file=sys.stderr)
        metrics_to_check = []

    # Build the evaluation prompt that handles both relevance and metrics in one call
    system_prompt = f"""You are an expert evaluator assessing content relevance and quality metrics for different user personas.

PERSONA: {persona_name}
DESCRIPTION: {persona_description}

Your task is to evaluate the provided content section and return a structured JSON response with:
1. Relevance assessment (is this section useful for this persona?)
2. Evaluation of specific quality metrics (only if relevant)

Return your response as valid JSON in this exact format:
{{
    "relevant": true/false,
    "relevance_reasoning": "Brief explanation of why this is/isn't relevant",
    "metrics": {{
        "metric_id_1": true/false/null,
        "metric_id_2": true/false/null
    }}
}}

If not relevant, set "metrics" to an empty object {{}}.
If relevant, evaluate each metric as true (passes), false (fails), or null (cannot determine).
"""

    # Build the metrics description for the prompt
    metrics_descriptions = []
    for metric_id in metrics_to_check:
        metric_info = metric_definitions.get(metric_id, {})
        metrics_descriptions.append(f"- {metric_id}: {metric_info.get('name', metric_id)} - {metric_info.get('description', 'No description')}")
    
    metrics_text = "\n".join(metrics_descriptions) if metrics_descriptions else "No specific metrics to evaluate."
    
    user_prompt = f"""Article: {article_title}

METRICS TO EVALUATE (only if content is relevant):
{metrics_text}

CONTENT TO EVALUATE:
{json.dumps(section_data, indent=2)}

Provide your evaluation as JSON."""

    try:
        response = chat_with_llm("gemma3", system_prompt, user_prompt, {})
        
        # Parse the JSON response
        evaluation_result = parse_llm_json_response(response)
        
        if not isinstance(evaluation_result, dict):
            raise ValueError("Response is not a valid JSON object")
            
        # Ensure required fields exist
        evaluation_result.setdefault("relevant", False)
        evaluation_result.setdefault("relevance_reasoning", "No reasoning provided")
        evaluation_result.setdefault("metrics", {})
        
        return evaluation_result
        
    except Exception as e:
        print(f"Error in batched evaluation for {persona_name}: {e}", file=sys.stderr)
        # Fallback to basic structure
        return {
            "relevant": False,
            "relevance_reasoning": f"Evaluation failed: {str(e)}",
            "metrics": {}
        }

def main():
    """Main function for the evaluator."""
    if len(sys.argv) < 3:
        print("Usage: python evaluator.py <section_file_path> <persona1> [persona2] ... [article_title]")
        sys.exit(1)
    
    section_file_path = sys.argv[1]
    personas = sys.argv[2:-1] if len(sys.argv) > 3 else sys.argv[2:]
    article_title = sys.argv[-1] if len(sys.argv) > 3 and not sys.argv[-1] in PERSONA_DEFINITIONS else "Unknown Article"
    
    # Load metric definitions
    metric_definitions = load_metric_definitions()
    
    # Load section data
    try:
        section_data = load_json_file(section_file_path)
    except Exception as e:
        print(f"Error loading section file: {e}", file=sys.stderr)
        sys.exit(1)
    
    # Results structure: {persona_name: [evaluation_result]}
    all_results = {}
    
    # Process each persona with batched evaluation
    for persona_name in personas:
        if persona_name not in PERSONA_DEFINITIONS:
            print(f"Warning: Unknown persona '{persona_name}'. Skipping.", file=sys.stderr)
            continue
            
        persona_description = PERSONA_DEFINITIONS[persona_name]
        
        # Use batched evaluation (single API call per persona)
        evaluation_result = evaluate_section_for_persona_batch(
            section_data, persona_name, persona_description, article_title, metric_definitions
        )
        
        # Format the result to match expected structure
        formatted_result = {
            "evaluation": evaluation_result
        }
        
        all_results[persona_name] = [formatted_result]
    
    # Output results as JSON
    print(json.dumps(all_results, indent=2))

if __name__ == "__main__":
    main()