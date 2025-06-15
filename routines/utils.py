import json
import ollama
import uuid
import sys
from datetime import datetime # Corrected import
import os
import re
from json_repair import repair_json # Added for robust JSON fixing
import requests
# import google.generativeai as genai
# from dotenv import load_dotenv

# Load environment variables from .env file
# load_dotenv()

def load_json(filepath):
    """Load JSON input file."""
    with open(filepath, "r", encoding="utf-8") as file:
        return json.load(file)

def save_output(output_data, output_filepath):
    """Save generated output to a JSON file."""
    # Ensure directory exists
    os.makedirs(os.path.dirname(output_filepath), exist_ok=True)
    with open(output_filepath, "w", encoding="utf-8") as file:
        json.dump(output_data, file, indent=4, ensure_ascii=False)

def parse_embedded_json(node):
    """
    Recursively check if the 'step' field contains embedded JSON.
    If so, parse it and update the node's 'children' accordingly.
    """
    # If 'step' is a string that looks like JSON, try to parse it.
    step_value = node.get("step", "")
    if isinstance(step_value, str) and (step_value.strip().startswith('[') or step_value.strip().startswith('{')):
        try:
            parsed = json.loads(step_value)
            # If parsed is a list, replace the children with parsed nodes
            if isinstance(parsed, list):
                new_children = []
                for item in parsed:
                    if isinstance(item, dict):
                        new_children.append(item)
                    else:
                        new_children.append({"step": str(item), "children": []})
                node["children"] = new_children
                # Don't clear the step field completely to avoid empty steps
                if not node.get("title"):
                    node["title"] = step_value
            elif isinstance(parsed, dict):
                node["children"] = [parsed]
                if not node.get("title"):
                    node["title"] = step_value
        except json.JSONDecodeError:
            # If parsing fails, leave the node unchanged.
            pass

    # Recursively process all children.
    for child in node.get("children", []):
        parse_embedded_json(child)
    return node

def chat_with_llm(model, system_message, user_message, parameters=None):
    """Generic function to interact with LLMs via Ollama."""
    if parameters is None:
        parameters = {}
    
    response = ollama.chat(
        model=model,
        messages=[
            {"role": "system", "content": system_message},
            {"role": "user", "content": user_message}
        ],
        options=parameters
    )
    
    # Get the response content
    content = response["message"]["content"].strip()
    
    # Remove <think>...</think> blocks from the response
    # This handles both single-line and multi-line think blocks
    import re
    content = re.sub(r'<think>.*?</think>', '', content, flags=re.DOTALL)
    
    # Clean up any extra whitespace that might be left after removing think blocks
    content = re.sub(r'\n\s*\n', '\n\n', content)  # Replace multiple blank lines with double newlines
    content = content.strip()
    
    return content

# def chat_with_llm_google_ai_studio(model, system_message, user_message, parameters=None):
#     """Generic function to interact with LLMs via Google AI Studio."""
#     if parameters is None:
#         parameters = {}
    
#     # Get API key from environment
#     api_key = os.getenv("GOOGLE_AI_STUDIO_API_KEY")
#     if not api_key:
#         raise ValueError("GOOGLE_AI_STUDIO_API_KEY environment variable not set")
    
#     # Configure the Google AI client
#     genai.configure(api_key=api_key)
    
#     # Model mapping for compatibility
#     model_mapping = {
#         "gemma3": "gemma-3n-e4b-it"
#     }
    
#     # Use mapped model if available, otherwise use the provided model
#     api_model = model_mapping.get(model, model)
    
#     # Create the generative model
#     ai_model = genai.GenerativeModel(api_model)
    
#     # Combine system and user messages for Gemini
#     combined_prompt = f"{system_message}\n\nUser: {user_message}"
    
#     # Generate response
#     response = ai_model.generate_content(combined_prompt)
    
#     return response.text.strip()

def clean_llm_json_response(response_text):
    """Clean an LLM response to extract valid JSON, removing markdown fences."""
    text = response_text.strip()
    
    # Regex to find content within ```json ... ``` or ``` ... ```
    # It handles optional "json" label and potential newlines around the JSON content.
    # It captures the content within the fences.
    fence_match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", text, re.S)
    
    if fence_match:
        # If fences are found, use the content within them
        json_candidate = fence_match.group(1).strip()
    else:
        # If no fences, assume the whole text might be JSON or contain JSON
        json_candidate = text
        
    # Try to extract the first valid JSON object or array from the candidate string
    # This helps if there's extraneous text before or after the actual JSON
    # even if fences were not perfectly matched or were absent.
    json_match = re.search(r"^\s*(\{[\s\S]*\}|\[[\s\S]*\])\s*$", json_candidate, re.S)
    
    if json_match:
        return json_match.group(1)
    
    # Fallback: if no clear JSON structure is found after attempting to strip fences,
    # return the json_candidate (which is either content from fences or original text).
    # The calling function (parse_llm_json_response) will attempt to parse this.
    return json_candidate

def parse_llm_json_response(response_text, include_children=False):
    """Parse JSON from an LLM response with fallback handling.
    
    Args:
        response_text: The text response from the LLM
        include_children: Whether to include empty children arrays for hierarchical data
    """
    cleaned_text = clean_llm_json_response(response_text)
    
    try:
        # First attempt: standard JSON parsing
        return json.loads(cleaned_text)
    except json.JSONDecodeError as e_initial:
        # If standard parsing fails, try to repair it using json_repair
        print(f"utils.py: Initial JSONDecodeError: {e_initial}. Attempting to repair JSON. Problematic text (first 200 chars): '{cleaned_text[:200]}'")
        try:
            repaired_json_string = repair_json(cleaned_text)
            # print(f"utils.py: JSON repaired. Repaired string (first 200 chars): '{repaired_json_string[:200]}'")
            return json.loads(repaired_json_string) # Try parsing the repaired string
        except Exception as e_repair:
            # If repair also fails, or parsing the repaired string fails
            print(f"utils.py: JSON repair failed or parsing repaired JSON failed: {e_repair}. Original error: {e_initial}. Problematic text (first 200 chars): '{cleaned_text[:200]}'")
            raise e_initial # Re-raise the *original* JSONDecodeError to signal fundamental unparsability

def create_output_metadata(task_name, start_time, output_uuid=None):
    """Create standard metadata for output files."""
    end_time = datetime.now()
    time_taken = end_time - start_time
    
    # No need to generate UUID here, it should be passed from get_output_filepath
    # or generated at a higher level
    return {
        "uuid": output_uuid,
        "date_created": end_time.isoformat(),
        "task": task_name,
        "time_taken": str(time_taken)
    }

def get_output_filepath(output_dir, output_uuid=None, specified_path=None):
    """Determine output filepath based on arguments or generate a default one."""
    if specified_path:
        return specified_path, output_uuid
        
    # Create a UUID for this output if not provided
    if output_uuid is None:
        output_uuid = str(uuid.uuid4())
    
    # Ensure output directory exists
    output_path = f"output/{output_dir}"
    os.makedirs(output_path, exist_ok=True)
    
    return f"{output_path}/{output_uuid}.json", output_uuid

def handle_command_args(usage_msg, min_args=1, max_args=2):
    """Process command line arguments with validation."""
    # Check for -saveInputs flag
    save_inputs = "-saveInputs" in sys.argv
    if save_inputs:
        # Remove the flag from argv for further processing
        sys.argv.remove("-saveInputs")
    
    # Check for -uuid flag
    custom_uuid = None
    for arg in list(sys.argv):  # Create a copy of sys.argv to modify while iterating
        if arg.startswith("-uuid="):
            custom_uuid = arg.split("=", 1)[1].strip('"')
            if custom_uuid:  # Only remove if we got a valid UUID
                sys.argv.remove(arg)
                
    # Check for -flow_uuid flag
    flow_uuid = None
    for arg in list(sys.argv):
        if arg.startswith("-flow_uuid="):
            flow_uuid = arg.split("=", 1)[1].strip('"')
            if flow_uuid:
                sys.argv.remove(arg)
    
    if len(sys.argv) > max_args + 1 or len(sys.argv) < min_args + 1:
        print(usage_msg)
        sys.exit(1)
        
    input_filepath = sys.argv[1]
    output_filepath = sys.argv[2] if len(sys.argv) > 2 else None
    
    return input_filepath, output_filepath, save_inputs, custom_uuid, flow_uuid

def saveToFile(system_message, user_message, filepath):
    """Save system message and user message to a JSON file.
    
    Used for debugging and logging prompt inputs when requested via -saveInputs flag.
    
    Args:
        system_message: The system message sent to the LLM
        user_message: The user message sent to the LLM
        filepath: Path where the JSON file should be saved
    """
    data = {
        "system_message": system_message,
        "user_message": user_message,
        "timestamp": datetime.now().isoformat()
    }
    
    # Ensure directory exists
    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    
    with open(filepath, "w", encoding="utf-8") as file:
        json.dump(data, file, indent=4, ensure_ascii=False)
    
    print(f"Saved LLM inputs to {filepath}")

def translate_to_basic_english(text, model="gemma3", parameters=None):
    """Convert text to Basic English for use in folder names."""
    if parameters is None:
        parameters = {}
    
    system_msg = ("Convert the given text into BASIC English. "
                 "Use only words from the BASIC English list (850 words). "
                 "Make all sentences short, clear, and simple. "
                 "Keep ONLY essential words needed to understand the meaning. "
                 "Make output VERY short, suitable for a folder name. "
                 "Output only the translated text without explanations.")
    
    user_msg = ("Convert to short, simple BASIC English for folder name. "
                "Do not use special symbols that aren't allowed in file/folder names. "
                f"Use a MAXIMUM of 4 words, ensure that the meaning is understandable: {text}")
    
    # Use chat_with_llm to translate the text
    response = chat_with_llm(model, system_msg, user_msg, parameters)
    
    # Clean up the response to ensure it's suitable for a folder name
    response = response.strip().split("\n")[0]
    
    # Limit length for folder name suitability
    return response[:50]