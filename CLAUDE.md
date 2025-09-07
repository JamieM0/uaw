# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

The Universal Automation Wiki (UAW) is an open-source platform for mapping, simulating, and optimizing real-world processes using a "bottom-up" methodology and Iterative AI. The system generates structured process trees, converts them to interactive simulations, and validates them against hundreds of metrics.

## Development Setup

### Dependencies
Install Python dependencies:
```bash
pip3 install jinja2 requests jsonschema ollama json-repair python-dotenv
```

### Ollama Configuration
1. Install Ollama: `curl -fsSL https://ollama.com/install.sh | sh`
2. Start service: `ollama serve`
3. Pull recommended model: `ollama pull gemma3`
4. Test: `python3 -c "import jinja2, requests, jsonschema; print('Dependencies OK')"`

### Local Development
- Serve locally: `cd web && python3 -m http.server 8000`
- Main site: http://localhost:8000/
- Playground: http://localhost:8000/playground.html

## Build Commands

### Content Generation
- **Single article build**: `python3 routines/assemble.py <input_flow_dir> <output_dir>` (2-5 seconds)
- **Full flow generation**: `python3 routines/flow-maker.py <topic> [breadcrumbs] [--model=model_name]` (15-45 minutes, NEVER CANCEL)
- **Batch processing**: Use `routines/auto-run.bat` for multiple flow generations

### Validation
- **Python compilation check**: `find . -name "*.py" -exec python3 -m py_compile {} \;`
- **Manual playground test**: Load http://localhost:8000/playground.html, click "Load Sample", verify "✓ Valid JSON"

## Architecture

### Core Generation Pipeline
1. **Topic Input** → `flow-maker.py` orchestrates the full pipeline
2. **Tree Generation** → `hallucinate-tree.py` creates hierarchical process breakdowns
3. **Simulation Creation** → `simulation.py` converts trees to time-based simulations
4. **Metrics Validation** → `evaluator.py` scores against persona-specific metrics
5. **Static Site Rendering** → `assemble.py` uses Jinja2 templates to generate HTML

### Key Components
- **routines/flow-maker.py**: Main orchestrator for content generation pipeline
- **routines/assemble.py**: Static site generator using Jinja2 templates
- **routines/simulation.py**: Creates time-based process simulations from tree data
- **web/assets/js/simulation-validator.js**: Client-side validation for playground
- **web/assets/js/playground/**: Modularized playground components (see Playground Architecture)
- **metrics/**: Persona-specific validation rules and definitions

### Data Flow Structure
Each generated article lives in `routines/flow/<uuid>/` containing:
- `1.json` through `9.json`: Pipeline stage outputs
- `simulation.json`: Time-based simulation data
- `metrics.json`: Validation scores by persona
- `*.html`: Generated documentation page

## Personas & Metrics System

### Core Personas
- `hobbyist`: General enthusiasts and DIY practitioners
- `researcher`: Academic and scientific researchers
- `investor`: Business and financial stakeholders
- `educator`: Teachers and educational content creators
- `field_expert`: Industry professionals and specialists

### Validation Files
- `metrics/definitions.json`: Metric descriptions and IDs
- `metrics/<persona>.json`: Boolean validation rules per persona
- `web/assets/static/metrics-catalog.json`: Client-side validation catalog

## Template System

### Jinja2 Templates
- `templates/page-template.html`: Main article template
- `templates/documentation-page-template.html`: Documentation template
- Templates use persona filtering and metrics scoring for content relevance

### Static Assets
- `web/assets/css/`: Styling and responsive design
- `web/assets/js/`: Interactive features, Monaco editor integration
- `web/assets/js/playground/`: Modularized playground JavaScript components
- `web/assets/static/`: JSON data files and validation rules

## Important Notes

### LLM Integration
- Uses Ollama with gemma3 model (1.5GB download)
- Local LLM required for content generation pipeline
- Content generation is LLM-dependent and takes 15-45 minutes
- NEVER cancel flow-maker.py mid-process - set 60+ minute timeouts

### Build Process
- No automated CI/CD - build locally before commit
- Static site deployment via GitHub Pages (`/web` directory)
- Each article is a complete generation pipeline result
- Flow-based content management system

### Testing Protocol
1. Always test playground functionality after changes
2. Verify Python script compilation before commit
3. Check CSS/JS loading on main site
4. Test article generation with simple topics first

### Common Issues
- "ollama not found": Verify installation and service status with `ollama list`
- Import errors: Install missing Python packages with pip3
- Template errors: Validate JSON structure matches schema expectations
- Playground not loading: Check browser console for JavaScript errors

## Development Best Practices

### Approach to Implementation Tasks
When working on implementation tasks, always follow this approach:
1. **Ask clarifying questions** before starting implementation to avoid assumptions
2. **Explain your planned approach** so the user can provide feedback
3. **Break down complex tasks** into smaller, manageable steps
4. **Verify requirements** especially for UI behavior, data handling, and integration points

This ensures alignment with user expectations and prevents rework from misunderstood requirements.
- When stuck on a tricky problem, ALWAYS add detailed logs and ask for the log results. Remove these logs after the problem has been resolved.

## Playground Architecture

### Modularized System (Post-PR #25)
The simulation playground has been completely modularized for better maintainability and efficiency. The system is now split into focused, single-responsibility modules:

#### Core Modules
- **playground-core.js**: Main initialization logic, global state management, and module orchestration
- **playground-editor.js**: Monaco editor initialization, sample data management, and code editing features
- **playground-ui.js**: Tab management, dialog handling, history system, and general UI utilities
- **playground-validation.js**: Validation result display, filtering, and grouped result presentation

#### Feature Modules  
- **playground-timeline.js**: Timeline rendering, visualization, and timeline-specific interactions
- **playground-objects.js**: Object and task management functionality, interaction handling
- **playground-save-load.js**: Save/load functionality for simulations, import/export features
- **playground-features.js**: Tutorial system, LLM integration, and additional playground features
- **playground-metrics-editor.js**: Custom metrics creation and management system
- **playground-utils.js**: General helper functions, time conversions, and shared utilities

#### Module Organization Principles
- **Single Responsibility**: Each module handles one specific aspect of functionality
- **Clear Dependencies**: Modules have minimal interdependencies with well-defined interfaces
- **Global State Management**: Core module manages shared state, other modules interact through defined APIs
- **Incremental Loading**: Modules can be loaded and initialized independently as needed

#### Integration Points
- All modules are loaded via `playground.html` script tags in dependency order
- Core module (`playground-core.js`) initializes after DOM load and coordinates other modules
- Modules communicate through global variables and function calls defined in the core module
- Each module follows the pattern: `// Module Name - Brief description` header comment

#### Development Guidelines for Playground Modules
When working with playground functionality:
1. **Identify the correct module** for your changes based on functionality area
2. **Follow naming conventions**: `playground-[feature-area].js`
3. **Maintain module boundaries**: Don't mix responsibilities across modules
4. **Update core module** if adding new global state or coordination logic
5. **Test cross-module interactions** to ensure proper integration
6. **Add new modules** when introducing entirely new feature areas that don't fit existing modules

#### Legacy Code
- **playground-old.js**: Original monolithic version, retained for reference but no longer used
- **playground.html**: Updated to load all modular components instead of single file