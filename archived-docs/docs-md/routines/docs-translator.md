# Docs Translator

Converts Markdown documentation in `docs-md/` into styled HTML pages in `web/docs/`.

## Common Workflows

### Regenerate the Entire Docs Site

```bash
python routines/docs/docs-translator.py --regenerate
```

### Translate a Single File

```bash
python routines/docs/docs-translator.py --input-file docs-md/architecture-overview.md
```

### Translate a Folder

```bash
python routines/docs/docs-translator.py --input-folder docs-md/simulations --recursive
```

## Output Paths

When `--output` is not provided, the translator mirrors the `docs-md/` directory structure into `web/docs/` and converts `.md` → `.html`.

Examples:

- `docs-md/playground/playground-guide.md` → `web/docs/playground/playground-guide.html`
- `docs-md/simulations/validation.md` → `web/docs/simulations/validation.html`

## Templates

- Default template: `templates/documentation-page-template.html`
- Override with: `--template <template-file>` and/or `--template-dir <dir>`

## Notes

- **Internal links:** The site serves docs under `/docs/`, so docs should link to other docs using `/docs/.../page` (no `.html`).
- **Images:** Local images referenced from markdown are copied into `/assets/images/docs/` and paths are rewritten automatically.
