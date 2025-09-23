# Repository Guidelines

## Project Structure & Module Organization
The site is a static frontend served from `web/`. Core entry points are `index.html` for the main experience and `playground.html` for the simulation editor. UI assets live in `assets/`: CSS is split into modular files (`main.css`, `components.css`, `responsive.css`), JavaScript components sit in `assets/js/`, and the playground logic is grouped under `assets/js/playground/` (e.g., `playground-core.js`, `playground-timeline.js`). Generated industry pages (`technology/`, `manufacturing/`, etc.) and documentation under `docs/` reuse those shared assets. Keep new datasets in `assets/static/` or `assets/data/` so they can be fetched by existing loaders.

## Build, Test, and Development Commands
Install dependencies once with `npm install`. For local preview, run `npx http-server . --port 8000` (or `python -m http.server 8000`) from this directory and open `http://localhost:8000/`. Use the same server to load `playground.html` when debugging the editor. When touching npm dependencies, update `package-lock.json` alongside `package.json`.

## Coding Style & Naming Conventions
Match the established four-space indentation for HTML, CSS, and JavaScript. Name new modules with kebab-case filenames (e.g., `asset-manager.js`) and expose functions via ES modules or revealing module pattern consistent with existing files. CSS classes favor a BEM-leaning style such as `playground-panel__header`; keep theme variables in `main.css` and extend via CSS custom properties. Prefer descriptive data attributes over brittle selectors when wiring JS.

## Testing Guidelines
There is no automated test runner yet—validate changes manually. Smoke-test `playground.html`: load a sample, confirm the "✓ Valid JSON" state, and scrub the timeline interactions. Verify navigation inside category directories and documentation pages. Check responsive layouts at 1280px, 1024px, and 375px widths, and ensure the browser console stays clean. For asset pipeline updates, run `test-asset-manager.js` in the playground console to confirm UUID, storage, and retrieval helpers.

## Commit & Pull Request Guidelines
Commits in this repo use short, Title Case summaries (e.g., `Improve Simulation Validator Logging`). Group related assets and scripts in a single commit so reviewers can reason about the change holistically. PRs should link any tracking issue, describe user-facing effects, and include before/after screenshots or screen recordings when UI changes are visible. Call out manual test steps performed and any follow-up work required.

## Static Asset Practices
Store images and audio beneath `assets/images/` and `assets/audio/`, and register large JSON payloads in `assets/static/` for lazy loading. Reference assets with relative paths rooted at `/` so they resolve across documentation, category pages, and the playground server.
