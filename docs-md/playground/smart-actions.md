# Smart Actions

Smart Actions is an AI-powered assistant integrated into the Universal Automation Wiki playground. It provides intelligent analysis, suggestions, and automated editing capabilities for your simulations using Large Language Models (LLMs).

## Overview

Smart Actions helps you:

- **Analyze simulations**: Get comprehensive insights into your simulation's structure, efficiency, and potential improvements
- **Fix validation errors**: Automatically identify and resolve issues flagged by the validation engine
- **Optimize processes**: Receive suggestions for improving task sequencing, resource usage, and cost efficiency
- **Edit simulations**: Use natural language to request changes, which are applied via a visual diff interface
- **Learn best practices**: Get guidance on Universal Object Model (UOM) standards and simulation design

## Getting Started

### Initial Setup

1. Open the playground and locate the **Smart Actions** button in the toolbar
2. Click the dropdown and select **Setup**
3. Choose your AI provider and configure:

#### Supported Providers

**OpenAI**
- Models Examples: GPT-5, GPT-5 Mini
- Requires: OpenAI API key
- Best for: Comprehensive analysis and complex editing tasks

**Anthropic**
- Models: Claude 4.5 Sonnet, Claude 4.1 Opus, Claude 4.5 Haiku
- Requires: Anthropic API key
- Best for: Detailed reasoning, long-context analysis, and complex editing tasks

**OpenRouter**
- Models: Any model from external providers, DeepSeek, Qwen, etc.
- Requires: OpenRouter API key
- Best for: Experimentation, cost-effectiveness

**GitHub Models**
- Models: Various open and proprietary models
- Requires: GitHub Personal Access Token (with appropriate permissions)
- Best for: Experimentation

**Ollama (Local)**
- Models: Any model installed locally via Ollama
- Requires: Ollama running locally at http://localhost:11434
- Best for: Privacy-conscious users and offline work

4. Enter your API key or configure your model
5. Test the connection
6. Click **Save Configuration**

### First Analysis

After setup:

1. Load or create a simulation
2. Click **Smart Actions** → **Chat**
3. Click the **Analyse** button
4. Review the AI's comprehensive analysis

The analysis will cover:
- Simulation structure and completeness
- Validation issues and how to fix them
- Resource flow efficiency
- Cost optimization opportunities
- Best practice compliance

## Features

### Conversational Interface

Smart Actions uses a chat-based interface for natural interaction:

- **Multiple conversations**: Switch between different analysis sessions
- **Conversation history**: All conversations are saved locally
- **Context aware**: The AI understands your full simulation and validation state
- **Streaming responses**: See responses as they're generated

### Tool Calling

Smart Actions has access to powerful tools for interacting with your simulation:

#### View Simulation

The AI can request full simulation data when needed:

```
User: "What's the total cost of all tasks?"
AI: Let me view the simulation to calculate the total task costs.
[Accessing Simulation...]
AI: The total cost across all tasks is $247.50, broken down as follows...
```

#### Find and Replace

The AI can suggest and apply edits directly:

```
User: "Change the end time to 4PM"
AI: I'll update the end time to 16:00 (4PM).
[Editing Simulation...]
[Diff view appears showing the change]
```

The diff view allows you to:
- Review the exact changes
- See before/after comparison
- Approve or reject changes
- Ensure JSON validity

### Markdown Support

Responses support rich markdown formatting:

- **Code blocks** with syntax highlighting
- **Tables** for comparison data
- **Lists** for organized information
- **Headings** for structured content
- **Emphasis** for important points

### Streaming Responses

Smart Actions streams responses in real-time:

- See responses as they're generated
- Faster perceived performance
- Ability to read while the AI is still thinking
- Auto-scrolling (with manual scroll detection)

## Usage Patterns

### Quick Analysis

Get a rapid overview of your simulation:

```
"Analyze this simulation"
"What are the main issues?"
"Give me a quick summary"
```

### Targeted Questions

Ask specific questions about your simulation:

```
"What's the critical path of tasks?"
"Which resources are being over-utilized?"
"How much does this process cost per hour?"
"Are there any task scheduling conflicts?"
```

### Validation Help

Get assistance with validation errors:

```
"Why am I getting validation errors?"
"How do I fix the actor reference errors?"
"Explain the dependency cycle warning"
```

### Optimization Requests

Request improvements to your simulation:

```
"How can I reduce the total cost?"
"Suggest ways to speed up this process"
"What resources am I wasting?"
"How can I improve task parallelization?"
```

### Direct Editing

Request changes using natural language:

```
"Change the baker's hourly rate to $30"
"Add a 15-minute break task at 12:00"
"Rename the 'workspace' location to 'prep_counter'"
"Set all resource quantities to 100"
```

## System Prompts

Smart Actions uses carefully crafted system prompts to provide accurate, helpful assistance:

### Base System Message

Provides:
- Universal Object Model (UOM) specification
- Current simulation context
- Validation system status
- Quality standards and constraints
- Tool calling capabilities
- Response formatting guidelines

### Analysis Agent

Specialized for:
- Comprehensive simulation analysis
- Issue identification and prioritization
- Optimization recommendations
- Best practice validation

## Advanced Features

### Cached Conversations

Smart Actions optimizes token usage by:

- Caching full system context for first 2-3 exchanges
- Switching to lightweight context for continuing conversations
- Maintaining conversation history for coherence

### Multi-Turn Tool Calling

The AI can chain multiple tool calls:

1. View simulation to understand structure
2. Analyze and identify issues
3. Suggest specific changes
4. Apply changes via find-and-replace
5. Verify changes were applied correctly

### Context Management

Smart Actions automatically gathers and provides:

- **Simulation data**: Structure, objects, tasks, configuration
- **Validation results**: Errors, warnings, info messages
- **Metrics configuration**: Active and disabled validation rules
- **Session state**: Current view, selected objects, history

### Error Handling

Smart Actions gracefully handles:

- API failures with clear error messages
- Invalid JSON edits with explanations
- Tool call failures with fallback options
- Network issues with retry logic

## Configuration Management

### Saved Configurations

Smart Actions saves:
- API keys
- Model selections per provider
- Last-used configuration
- Conversation history (local storage)

### Privacy and Security

- API keys never leave your browser
- All data stored locally (localStorage)
- Direct API connections (no intermediary servers)

### Multiple Configurations

You can configure multiple providers and switch between them:

1. Open **Setup**
2. Configure each provider you want to use
3. Select the active provider from dropdown
4. Settings are saved automatically

## Best Practices

### Getting Good Results

1. **Load your simulation first**: The AI needs context
2. **Be specific**: "Change task 3's duration to 45 minutes" vs "make it faster"
3. **Review suggestions**: Not all AI suggestions are optimal for your use case
4. **Iterate**: Use follow-up questions to refine suggestions
5. **Approve carefully**: Review diffs before approving changes

### Effective Prompts

**Good:**
```
"The validation shows resource conflicts. Can you identify which
tasks are causing the issue and suggest how to resolve them?"
```

**Less Effective:**
```
"Fix it"
```

**Good:**
```
"I want to add a quality control step after baking. It should take
10 minutes, be performed by the assistant, and check the product quality."
```

**Less Effective:**
```
"Add QC"
```

### When to Use Smart Actions

Smart Actions is ideal for:

- ✅ Understanding complex validation errors
- ✅ Getting optimization suggestions
- ✅ Learning UOM best practices
- ✅ Quick edits to existing simulations
- ✅ Analyzing simulation economics

Smart Actions may not be ideal for:

- ❌ Building entire simulations from scratch (use the editor)
- ❌ Highly specialized domain calculations (use external tools)
- ❌ Real-time constraint solving (use validation engine)

## Troubleshooting

### "API key invalid" Error

- Verify your API key is correct
- Check the key has appropriate permissions
- Ensure billing is set up (OpenAI, Anthropic)
- Try regenerating the key

### "Model not available" Error

- Check your API plan supports the selected model
- Verify model name is spelled correctly
- Try a different model from the same provider
- For Ollama: ensure the model is installed (`ollama list`)

### Slow Responses

- Larger models take longer to respond
- Complex simulations require more processing
- Try a faster model (GPT-5 Mini, Claude 4.5 Haiku)
- Check your internet connection

### Changes Not Applying

- Ensure you clicked **Approve** in the diff view
- Check the browser console for errors
- Try making smaller, more targeted edits

### Conversation Lost

- Conversations are saved in localStorage
- Clearing browser data will delete conversations
- Export important conversations (copy/paste)
- Use version control for important simulations

## Technical Details

### Architecture

Smart Actions consists of several modules:

- **smart-actions-ui.js**: Main interface orchestrator
- **smart-actions-client.js**: API client for multiple providers
- **smart-actions-context.js**: Simulation context gathering
- **smart-actions-markdown.js**: Markdown rendering
- **smart-actions-setup.js**: Configuration modal
- **smart-actions-diff.js**: Visual diff editor for changes

### API Integration

Native function calling is supported for:
- OpenAI (GPT-5, GPT-5 Mini, etc.)
- Anthropic (Claude 4 family and later)
- GitHub Models (provider-dependent)

Fallback text-based tool commands for:
- Ollama (local models)
- Legacy providers

### Storage

Smart Actions uses browser storage:

- **Cookies**: Configuration (API keys, model selections)
  - Expiry: 365 days
  - Scope: Current domain
  - Secure: HTTPS only

- **localStorage**: Conversation history
  - Max conversations: 10
  - Auto-pruning: Oldest first
  - Format: JSON

### Performance

- Streaming reduces perceived latency
- Context caching minimizes token usage
- Diff previews prevent unnecessary reloads
- Lazy loading of large simulations

## Keyboard Shortcuts

- **Shift+Enter**: Send message (while in input field)
- **Enter**: New line (while in input field)
- **Escape**: Close Smart Actions panel (planned)

## Limitations

Current limitations:

1. **Context Window**: Very large simulations may exceed model context limits
2. **Rate Limits**: Subject to provider API rate limits
3. **Local Storage**: Limited conversation history (10 conversations)
4. **Language**: English only for system prompts
5. **Offline**: Requires internet connection (except Ollama)

## Future Enhancements

Planned features:

- Multi-file simulation support
- Simulation templates via AI
- Automated testing suggestions
- Cost estimation for changes
- Simulation comparison mode
- Export conversations as documentation
- Custom system prompts
- Team collaboration features

## Provider-Specific Notes

### OpenAI

- Best model: GPT-5 Pro
- Fastest model: GPT-5 Mini
- Tool calling: Excellent
- Streaming: Supported (OpenAI requires invasive scanning of official government IDs for some models, recommended to use OpenRouter as an alternative)
- Cost: Moderate to high

### Anthropic

- Best model: Claude 4.5 Sonnet
- Fastest model: Claude 4.5 Haiku
- Tool calling: Excellent
- Streaming: Supported
- Cost: Moderate to high

### GitHub Models

- Variety of models available
- Free tier available
- Requires GitHub account
- Tool calling: Model-dependent
- Note: Preview/beta feature

### Ollama

- Fully local and private
- No API costs
- Requires local setup
- Tool calling: Limited
- Streaming: Supported
- Note: Performance depends on hardware

## Privacy and Data

Smart Actions respects your privacy:

- **Direct API calls**: Your data goes directly to your chosen provider
- **No intermediaries**: No proxy servers or middleware
- **Open source**: All code is inspectable

Your simulation data is only sent to:
1. The AI provider you explicitly configure
2. According to that provider's privacy policy
3. When you explicitly request analysis or edits

## Getting Help

If you encounter issues:

1. Check the browser console for error messages
2. Verify your configuration in Setup
3. Try a different model or provider
4. Test with a simple sample simulation
5. Report issues on GitHub

## Examples

### Example 1: Adding a Task

```
User: "Add a cleanup task after baking, duration 15 minutes,
assigned to the assistant"

AI: I'll add a cleanup task after the baking task with 15 minute
duration assigned to the assistant.

[Editing Simulation...]

[Diff shows new task being added with proper dependencies]

User: [Reviews diff and clicks Approve]

System: ✓ Changes applied successfully
```

### Example 2: Optimizing Costs

```
User: "How can I reduce the total cost of this simulation?"

AI: [Accessing Simulation...]

Based on my analysis, here are the main cost optimization opportunities:

1. **Labor Costs** ($450.00/day, 72% of total)
   - The assistant is idle for 2 hours (12:00-14:00)
   - Consider reducing work hours or adding tasks

2. **Resource Waste** ($85.00/day)
   - Flour consumption exceeds requirements by 15%
   - Reduce flour quantity in mixing tasks

3. **Equipment Utilization** (Only 60% utilized)
   - The oven sits idle for 3 hours
   - Consider adding additional baking tasks

Would you like me to suggest specific changes for any of these areas?
```

### Example 3: Fixing Validation Errors

```
User: "I have 5 validation errors. What's wrong?"

AI: Let me analyze the validation errors.

I can see 5 errors in your simulation:

1. **Missing actor reference** (Task "mix_dough")
   - Error: References actor "baker_john" which doesn't exist
   - Fix: Change to "baker" or create the actor

2. **Dependency cycle** (Tasks "proof" and "shape")
   - Error: Circular dependency detected
   - Fix: Remove "shape" from "proof" dependencies

3. **Invalid time format** (Task "bake")
   - Error: start time "1:00PM" should be "13:00"
   - Fix: Use 24-hour format

4. **Resource quantity** (Resource "flour")
   - Error: Quantity is negative (-5)
   - Fix: Set quantity to positive value

5. **Missing required field** (Object "workspace")
   - Error: Equipment objects require "state" property
   - Fix: Add "state": "available"

Would you like me to fix these issues?
```

## Conclusion

Smart Actions is a powerful tool for simulation analysis and optimization. By combining AI capabilities with the Universal Object Model, it provides intelligent assistance that respects the structure and constraints of your simulations while offering creative solutions and optimizations.

Start with the **Analyse** button to explore what Smart Actions can do, then experiment with natural language questions and edit requests to discover its full potential.
