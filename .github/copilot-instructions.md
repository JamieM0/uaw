# Universal Automation Wiki (UAW)
UAW is a static website platform for mapping, simulating, and optimizing real-world automation processes. It uses Python backend routines for content generation and a JavaScript frontend for interactive simulation validation and editing.

Always reference these instructions first and fallback to search or bash commands only when you encounter unexpected information that does not match the info here.

## Working Effectively
- Bootstrap and install dependencies:
  - `pip3 install jinja2 requests jsonschema` -- core dependencies, takes 5-10 seconds
  - `pip3 install ollama json-repair python-dotenv` -- optional LLM dependencies, takes 15-30 seconds
- Build/assemble content from flow data:
  - `python3 routines/assemble.py routines/flow/<flow-uuid> web/` -- takes 0.1-0.2 seconds per flow. NEVER CANCEL.
- Run the web application:
  - `python3 -m http.server 8000 --directory web` -- starts immediately, serves on http://localhost:8000
- Validate simulation data:
  - Use Node.js: `node /tmp/test-validator.js` (create test script) -- takes 0.05 seconds. NEVER CANCEL.
- Python syntax checking:
  - `python3 -m py_compile routines/assemble.py` -- takes 0.1 seconds
- GitHub Pages deployment happens automatically via `.github/workflows/github-pages.yml` when pushing to main branch

## Validation
- ALWAYS test the web application by running `python3 -m http.server --directory web` and accessing http://localhost:8000
- ALWAYS test at least one complete user scenario after making changes:
  1. Visit the homepage at http://localhost:8000
  2. Navigate to the playground at http://localhost:8000/playground.html
  3. Load a simulation and run validation checks
  4. Verify simulation player functionality works
- Test the assembly process: `python3 routines/assemble.py routines/flow/<any-uuid> /tmp/test-output` and verify HTML is generated
- JavaScript simulation validator can be tested with Node.js but requires browser environment for full functionality
- ALWAYS run Python syntax checks on any modified Python files before committing
- NO formal unit tests exist - manual validation via playground and assembly testing is the primary validation method

## Common Tasks
The following are outputs from frequently run commands. Reference them instead of viewing, searching, or running bash commands to save time.

### Repository root structure
```
.
├── README.md               # Main project documentation
├── .github/               # GitHub workflows and templates
├── web/                   # Static website files (deployment target)
├── routines/              # Python backend processing scripts  
├── metrics/               # Validation metrics definitions (JSON)
├── templates/             # Jinja2 HTML templates
├── docs-md/               # Documentation in markdown
└── style-guide.md         # Code style guidelines
```

### Core Python routines (in /routines/)
- `assemble.py` - Main build script: converts flow JSON files to HTML pages
- `simulation.py` - Generates simulation data from process trees (requires Ollama)
- `utils.py` - Shared utilities for LLM communication and JSON processing
- `constraint_processor.py` - Processes validation constraints
- Directory structure: `examples/`, `flow/`, `output/`, `templates/`

### Web application structure (in /web/)  
```
web/
├── index.html             # Homepage
├── playground.html        # Interactive simulation editor
├── assets/
│   ├── css/              # Stylesheets
│   ├── js/               # JavaScript modules
│   └── static/           # JSON data files
├── docs/                 # Generated documentation pages
└── [category]/           # Generated category pages (food-production/, etc.)
```

### Key JavaScript modules (in /web/assets/js/)
- `simulation-validator.js` - Client-side validation engine (380 lines)
- `simulation-player.js` - Interactive simulation playback
- `space-editor.js` - Drag-and-drop simulation editor
- `main.js` - Core application logic

### Metrics catalog structure
The metrics catalog (`web/assets/static/metrics-catalog.json`) contains 13 validation metrics:
- Structural integrity checks (schema validation)
- Resource flow validation (negative stock, recipe compliance)  
- Scheduling validation (actor overlap, equipment state)
- Proximity and location checks

### Assembly process flow
1. Load numbered JSON files (1.json through 9.json) from a flow directory
2. Load optional simulation.json and expanded tree data
3. Process and validate data structure
4. Render HTML using Jinja2 templates
5. Output final HTML page to specified directory

### Performance expectations
- Web server startup: Immediate (HTTP responses in <10ms)
- Assembly process: 0.1-0.2 seconds per flow - NEVER CANCEL, set timeout to 30+ seconds
- Validation testing: 0.05 seconds - NEVER CANCEL, set timeout to 10+ seconds  
- Python dependency installation: 5-30 seconds - NEVER CANCEL, set timeout to 60+ seconds
- Static file serving: Immediate (<10ms response times)

### Dependencies and requirements
- **Required**: Python 3.12+, jinja2, requests, jsonschema
- **Optional**: ollama (for LLM features), json-repair, python-dotenv  
- **Frontend**: No build process needed, uses vanilla JavaScript
- **Browser**: Modern browser required for simulation playground functionality
- **Ollama installation**: `curl -fsSL https://ollama.ai/install.sh | sh` -- may fail in restricted environments

### Troubleshooting
- If `assembly.py` fails with "argument of type 'NoneType' is not iterable": This is fixed in the current version
- If Ollama is not available: Core functionality (assembly, web serving, validation) works without it
- If simulation.json is missing from a flow: Assembly will proceed but skip simulation features
- If metrics catalog is not loading: Check `web/assets/static/metrics-catalog.json` exists and is valid JSON

### Development workflow
1. Make changes to Python routines in `/routines/` or frontend files in `/web/`
2. Test assembly: `python3 routines/assemble.py routines/flow/<test-flow> /tmp/test`  
3. Test web application: `python3 -m http.server --directory web` and verify functionality
4. Run validation: Create Node.js test script and verify simulation validation works
5. Manual testing: Use playground to test simulation editing and validation features
6. Commit changes - GitHub Pages deployment happens automatically

### Working with simulations
- Simulation data is stored as JSON with actors, tasks, resources, and timeline
- Validation happens client-side using JavaScript validator against metrics catalog
- Playground provides real-time editing and validation feedback  
- Assembly process embeds simulation data directly into HTML pages
- Simulation player provides interactive timeline visualization

### Important notes
- This is a static site - no server-side processing in production
- All dynamic functionality happens client-side via JavaScript
- LLM integration (Ollama) is for content generation, not runtime functionality  
- GitHub Pages serves the `/web` directory automatically on push to main
- No formal testing framework - validation is done through simulation system and manual testing