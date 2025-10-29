# Test Document for Translator Features

This is a valid subtitle paragraph that should be properly extracted.

## Table of Contents

[TOC]

## Testing Various Markdown Elements

This section tests the comprehensive improvements to the documentation translator.

### Code Blocks

Here's a Python code block:

```python
def hello_world():
    print("Hello, World!")
    return True
```

Here's a code block without language specification:

```
plain text code
no highlighting
```

### Inline Code with HTML Entities

Use `<div>` tags for containers. The `&lt;script&gt;` tag should work. Try `<p>test</p>`.

### Lists

#### Unordered List

- First item
- Second item
  - Nested item 1
  - Nested item 2
- Third item

#### Ordered List

1. First step
2. Second step
   1. Sub-step A
   2. Sub-step B
3. Third step

### Tables

| Feature | Status | Priority |
|---------|--------|----------|
| Wikilinks | Fixed | High |
| Asset Management | Added | High |
| BeautifulSoup | Implemented | High |

### Blockquotes

> This is a blockquote that should get the docs-blockquote class.
> It can span multiple lines.

### Horizontal Rule

---

### Definition Lists

HTML
:   HyperText Markup Language

CSS
:   Cascading Style Sheets

### Headings at All Levels

# H1 Heading
## H2 Heading
### H3 Heading
#### H4 Heading
##### H5 Heading
###### H6 Heading

### Smart Typography

This should have "smart quotes" and proper em-dashes—like this.

### Abbreviations

The HTML specification is maintained by the W3C.

*[HTML]: HyperText Markup Language
*[W3C]: World Wide Web Consortium

### Footnotes

Here's a sentence with a footnote[^1].

[^1]: This is the footnote content.

## Links Testing

- External link: [Python](https://python.org)
- Anchor link: [Back to top](#test-document-for-translator-features)
- Internal link: [Architecture](./architecture-overview.md)

## End of Test

This document tests all major features added to the translator.
