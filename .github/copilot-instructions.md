# Universal Automation Wiki (UAW) Development Instructions

Always reference these instructions first and fallback to search or bash commands only when you encounter unexpected information that does not match the info here.

## Working Effectively

### Bootstrap and Build the Repository:
- Install Python dependencies: `pip3 install jinja2 requests jsonschema ollama json-repair python-dotenv`
- Install and configure Ollama (for LLM functionality): 
  - Download from https://ollama.com/install or use `curl -fsSL https://ollama.com/install.sh | sh`
  - Start ollama service: `ollama serve`
  - Pull recommended model: `ollama pull gemma3`
- Verify Python installation: `python3 --version` (requires Python 3.12+)
- Test basic functionality: `python3 -c "import jinja2, requests, jsonschema; print('Dependencies OK')"`

### Build Process:
- **Single Article Build**: `python3 routines/assemble.py <input_flow_dir> <output_dir>` -- takes 2-5 seconds
- **Complete Flow Generation**: `python3 routines/flow-maker.py <topic> [breadcrumbs] [--model=model_name]` -- takes 15-45 minutes depending on content complexity. NEVER CANCEL. Set timeout to 60+ minutes.
- **Content Validation**: All Python scripts compile in ~1 second: `find . -name "*.py" -exec python3 -m py_compile {} \;`

### Run the Web Application:
- **ALWAYS build content first** using the routines above
- Serve locally: `cd web && python3 -m http.server 8000`
- Access main site: http://localhost:8000/
- Access playground: http://localhost:8000/playground.html
- **Playground functionality tested and working**: Load samples, validation, JSON editing, simulation rendering

### Key File Locations:
- **Main build script**: `routines/assemble.py` (generates HTML from JSON using Jinja2)
- **Content generation**: `routines/flow-maker.py` (orchestrates full content pipeline)
- **Simulation engine**: `routines/simulation.py` (creates time-based process simulations)
- **Web assets**: `web/assets/` (CSS, JS, static files)
- **Templates**: `templates/` (Jinja2 HTML templates)
- **Metrics system**: `metrics/` (validation rules and persona definitions)
- **Generated content**: `routines/flow/` (UUID-based directories with article data)

## Validation

### Manual Testing Requirements:
- **ALWAYS test the playground after making changes**: Load http://localhost:8000/playground.html, click "Load Sample", verify validation shows "✓ Valid JSON"
- **Test basic web functionality**: Navigate to main site, check that CSS/JS loads correctly
- **Verify Python scripts**: Run `python3 -m py_compile` on any modified Python files
- **Test article generation**: Create a simple flow using `flow-maker.py` with a basic topic

### Automated Validation:
- **No formal linting configured** - validate manually by compilation
- **GitHub Pages deployment**: Automatic via `.github/workflows/github-pages.yml` (uploads `/web` directory)
- **JavaScript validation**: Built-in playground validation via `web/assets/js/simulation-validator.js`

## Common Tasks

### Working with Content Generation:
- **Flow directory structure**: Each generated article lives in `routines/flow/<uuid>/` with numbered JSON files (1.json, 2.json, etc.)
- **Simulation data**: Stored as `simulation.json` in flow directories
- **Metrics validation**: Uses `metrics/definitions.json` and persona-specific files in `metrics/`

### Adding New Features:
- **Python routines**: Add new scripts in `routines/` following existing patterns
- **Web components**: Add JS/CSS in `web/assets/` and reference in HTML templates
- **Templates**: Modify Jinja2 templates in `templates/` for layout changes
- **Metrics**: Add new validation rules to `web/assets/static/metrics-catalog.json`

### Debugging:
- **LLM connection issues**: Check `ollama serve` is running and model is available
- **Build failures**: Verify input JSON structure matches expected schema
- **Web issues**: Check browser console for JavaScript errors, verify static file paths
- **Python errors**: Use `python3 -c "import traceback; traceback.print_exc()"` for detailed stack traces

## Technology Stack

### Backend:
- **Python 3.12+** with Jinja2 (template engine), requests (HTTP), jsonschema (validation)
- **Ollama** for local LLM integration (gemma3 model recommended)
- **Static site generation** - no server-side rendering in production

### Frontend:
- **Vanilla JavaScript** - no framework dependencies
- **CSS3** with custom components and responsive design
- **Interactive features**: Monaco editor integration, simulation player, validation system

### Infrastructure:
- **GitHub Pages** deployment (static files only)
- **No CI build process** - build happens locally before commit
- **Flow-based content management** - each article is a complete generation pipeline

## Critical Notes

### Timing Expectations:
- **Python dependency installation**: 30-60 seconds
- **Ollama model download**: 5-10 minutes for gemma3 (1.5GB)
- **Single article build**: 2-5 seconds
- **Full content generation**: 15-45 minutes (NEVER CANCEL - set 60+ minute timeout)
- **Web server startup**: Instant
- **Playground testing**: 10-30 seconds for full validation

### Known Limitations:
- **Ollama requires internet connection** for initial model download
- **External fonts/CDNs may be blocked** in sandboxed environments (functionality preserved)
- **Monaco editor requires external CDN** - editor will have limited features if blocked
- **No automated test suite** - rely on manual validation steps above
- **Build process is LLM-dependent** - requires working Ollama installation for content generation

### When Things Don't Work:
- **"ollama not found"**: Install ollama and start service, verify with `ollama list`
- **Import errors**: Install missing Python packages with pip3
- **Template errors**: Check JSON structure matches expected schema in routines
- **404 errors**: Verify file paths are correct relative to web/ directory
- **Playground not loading**: Check JavaScript console, verify static files accessible

## Repository Structure Reference

```
├── .github/
│   └── workflows/github-pages.yml    # Deployment workflow
├── routines/                         # Python content generation scripts
│   ├── assemble.py                   # Main build script
│   ├── flow-maker.py                 # Content pipeline orchestrator
│   ├── simulation.py                 # Simulation generator
│   ├── utils.py                      # Common utilities
│   └── flow/                         # Generated content (UUID directories)
├── web/                              # Static website files
│   ├── assets/                       # CSS, JS, images, data files
│   ├── playground.html               # Interactive simulation editor
│   └── index.html                    # Main site
├── templates/                        # Jinja2 HTML templates
├── metrics/                          # Validation rules and persona definitions
├── README.md                         # Project documentation
└── UAW-Context.md                    # Detailed project context
```

Always build and test your changes using the validation steps above before committing.