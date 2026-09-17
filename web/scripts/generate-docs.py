#!/usr/bin/env python3
"""Build the WorkSpec documentation site from ``web/docs-md``.

The generator owns HTML pages, section landing pages, the search index, Mermaid
bootstrap code, syntax-highlighting CSS, and ``llms.txt`` under ``web/docs``.
The hand-authored ``docs.css`` and ``docs.js`` files remain stable site assets.
"""

from __future__ import annotations

import argparse
import hashlib
import html
import json
import os
import posixpath
import re
import shutil
import sys
import tempfile
import unicodedata
from dataclasses import dataclass, field
from pathlib import Path, PurePosixPath
from typing import Any
from urllib.parse import urlsplit, urlunsplit

try:
    import bleach
    import yaml
    from bs4 import BeautifulSoup
    from markdown_it import MarkdownIt
    from pygments import highlight
    from pygments.formatters import HtmlFormatter
    from pygments.lexers import TextLexer, get_lexer_by_name
    from pygments.util import ClassNotFound
except ImportError as error:  # pragma: no cover - only used on an unprepared machine
    raise SystemExit(
        "Missing documentation build dependencies. Run: "
        "python3 -m pip install -r web/docs-requirements.txt"
    ) from error


SCRIPT_PATH = Path(__file__).resolve()
WEB_ROOT = SCRIPT_PATH.parent.parent
REPO_ROOT = WEB_ROOT.parent
SOURCE_ROOT = WEB_ROOT / "docs-md"
DATA_ROOT = SOURCE_ROOT / "_data"
OUTPUT_ROOT = WEB_ROOT / "docs"
ASSET_ROOT = OUTPUT_ROOT / "assets"
GENERATED_MANIFEST = OUTPUT_ROOT / ".generated-files.json"

REQUIRED_METADATA = {
    "title",
    "description",
    "section",
    "type",
    "level",
    "workspec_version",
    "status",
    "order",
}
ALLOWED_SECTIONS = {
    "home",
    "start",
    "learn",
    "workspec",
    "cli",
    "studio",
    "api",
    "guides",
    "concepts",
    "troubleshooting",
}
ALLOWED_TYPES = {"tutorial", "how-to", "reference", "explanation", "troubleshooting"}
ALLOWED_LEVELS = {"beginner", "intermediate", "advanced", "all"}
ALLOWED_STATUSES = {"canonical", "compatibility", "experimental"}
CALLOUT_TYPES = {"note", "warning", "caution", "checkpoint"}
CODE_LABELS = {
    "bash": "Shell",
    "console": "Terminal",
    "js": "JavaScript",
    "json": "JSON",
    "text": "Text",
    "ts": "TypeScript",
}

MARKDOWN = MarkdownIt(
    "commonmark",
    {
        "html": False,
        "linkify": False,
        "typographer": False,
    },
).enable("table")

ALLOWED_TAGS = {
    "a",
    "aside",
    "blockquote",
    "br",
    "button",
    "code",
    "details",
    "div",
    "em",
    "figcaption",
    "figure",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "hr",
    "li",
    "ol",
    "p",
    "pre",
    "span",
    "strong",
    "summary",
    "table",
    "tbody",
    "td",
    "th",
    "thead",
    "tr",
    "ul",
}
ALLOWED_ATTRIBUTES = {
    "a": ["href", "title"],
    "aside": ["class", "role"],
    "button": ["class", "type", "aria-label"],
    "code": ["class"],
    "details": ["class"],
    "div": ["class", "aria-label", "aria-live"],
    "figure": ["class", "data-mermaid-diagram"],
    "h2": ["id"],
    "h3": ["id"],
    "h4": ["id"],
    "h5": ["id"],
    "h6": ["id"],
    "ol": ["start"],
    "pre": ["class"],
    "span": ["class"],
    "td": ["class"],
    "th": ["class"],
}


@dataclass
class TocItem:
    level: int
    anchor: str
    title: str


@dataclass
class Page:
    source: Path
    relative: str
    metadata: dict[str, Any]
    markdown: str
    url: str
    output_relative: str
    group_id: str | None = None
    body_html: str = ""
    toc: list[TocItem] = field(default_factory=list)
    anchors: set[str] = field(default_factory=set)
    outgoing_links: list[str] = field(default_factory=list)
    has_mermaid: bool = False

    @property
    def title(self) -> str:
        return str(self.metadata["title"])

    @property
    def description(self) -> str:
        return str(self.metadata["description"])

    @property
    def section(self) -> str:
        return str(self.metadata["section"])

    @property
    def order(self) -> int:
        return int(self.metadata["order"])


@dataclass
class Landing:
    title: str
    description: str
    url: str
    section_id: str
    group_id: str | None
    children: list[Page]
    child_groups: list[dict[str, Any]] = field(default_factory=list)


def fail(message: str) -> None:
    raise ValueError(message)


def load_json(path: Path) -> Any:
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)


def split_front_matter(path: Path) -> tuple[dict[str, Any], str]:
    text = path.read_text(encoding="utf-8")
    match = re.match(r"\A---\n(.*?)\n---\n(.*)\Z", text, re.DOTALL)
    if not match:
        fail(f"{path}: missing or invalid YAML front matter")
    metadata = yaml.safe_load(match.group(1))
    if not isinstance(metadata, dict):
        fail(f"{path}: front matter must be a mapping")
    return metadata, match.group(2)


def canonical_source_relative(path: Path) -> str:
    return path.relative_to(SOURCE_ROOT).as_posix()


def canonical_url(relative: str) -> str:
    if relative == "index.md":
        return "/docs/"
    stem = relative.removesuffix(".md").removesuffix(".generated")
    return f"/docs/{stem}/"


def output_relative_for_url(url: str) -> str:
    if url == "/docs/":
        return "index.html"
    path = url.removeprefix("/docs/").strip("/")
    return f"{path}/index.html"


def normalize_inline_text(markdown_text: str) -> str:
    rendered = MARKDOWN.renderInline(markdown_text)
    return BeautifulSoup(rendered, "html.parser").get_text(" ", strip=True)


def remove_first_h1(markdown_text: str, expected_title: str, source: Path) -> str:
    lines = markdown_text.splitlines()
    h1_indexes = [index for index, line in enumerate(lines) if re.match(r"^#\s+", line)]
    if len(h1_indexes) != 1:
        fail(f"{source}: expected exactly one H1, found {len(h1_indexes)}")
    index = h1_indexes[0]
    actual = normalize_inline_text(re.sub(r"^#\s+", "", lines[index]))
    if actual != expected_title:
        fail(f"{source}: H1 {actual!r} does not match title {expected_title!r}")
    del lines[index]
    return "\n".join(lines).strip() + "\n"


def slugify(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value)
    normalized = "".join(character for character in normalized if not unicodedata.combining(character))
    normalized = normalized.lower().replace("&", " and ")
    normalized = re.sub(r"[^\w\s-]", "", normalized, flags=re.UNICODE)
    normalized = re.sub(r"[-\s]+", "-", normalized).strip("-")
    return normalized or "section"


def normalize_docs_url(url: str) -> str:
    parts = urlsplit(url)
    path = parts.path
    if not path.startswith("/docs"):
        return url
    if path.endswith("/index.html"):
        path = path[: -len("index.html")]
    elif path.endswith(".html"):
        path = path[: -len(".html")] + "/"
    if path != "/docs/" and not path.endswith("/"):
        path += "/"
    return urlunsplit((parts.scheme, parts.netloc, path, parts.query, parts.fragment))


def page_for_relative_link(page: Page, href_path: str, pages_by_relative: dict[str, Page]) -> Page:
    base = PurePosixPath(page.relative).parent
    resolved = posixpath.normpath((base / href_path).as_posix())
    if resolved.startswith("../") or resolved == "..":
        fail(f"{page.source}: link escapes the documentation root: {href_path}")
    target = pages_by_relative.get(resolved)
    if target is None:
        fail(f"{page.source}: relative Markdown link does not resolve: {href_path}")
    return target


def rewrite_href(
    page: Page,
    href: str,
    pages_by_relative: dict[str, Page],
    pages_by_url: dict[str, Page],
) -> str:
    href = href.strip()
    parts = urlsplit(href)
    if parts.scheme:
        if parts.scheme not in {"http", "https", "mailto"}:
            fail(f"{page.source}: unsafe link scheme in {href!r}")
        return href
    if href.startswith("#"):
        return href
    if parts.path.endswith(".md"):
        target = page_for_relative_link(page, parts.path, pages_by_relative)
        return urlunsplit(("", "", target.url, parts.query, parts.fragment))
    if parts.path.startswith("/docs"):
        normalized = normalize_docs_url(href)
        path = urlsplit(normalized).path
        if path not in pages_by_url and not path.startswith("/docs/assets/") and path != "/docs/llms.txt":
            # Generated landing routes are validated after they are assembled.
            return normalized
        return normalized
    if parts.path.startswith("/") or not parts.path:
        return href
    fail(f"{page.source}: unsupported relative link target: {href}")


def unique_slug(title: str, used: set[str]) -> str:
    base = slugify(title)
    slug = base
    suffix = 2
    while slug in used:
        slug = f"{base}-{suffix}"
        suffix += 1
    used.add(slug)
    return slug


def language_from_code(code: Any) -> str:
    for class_name in code.get("class", []):
        if class_name.startswith("language-"):
            return class_name.removeprefix("language-").lower()
    return "text"


def pygments_html(source: str, language: str) -> str:
    try:
        lexer = get_lexer_by_name(language)
    except ClassNotFound:
        lexer = TextLexer()
    return highlight(source, lexer, HtmlFormatter(nowrap=True)).rstrip("\n")


def transform_code_block(soup: BeautifulSoup, pre: Any, page: Page) -> None:
    code = pre.find("code", recursive=False)
    if code is None:
        return
    language = language_from_code(code)
    source = code.get_text()
    if language == "mermaid":
        page.has_mermaid = True
        figure = soup.new_tag("figure", attrs={"class": "mermaid-diagram", "data-mermaid-diagram": ""})
        output = soup.new_tag(
            "div",
            attrs={
                "class": "mermaid-output",
                "aria-label": "WorkSpec diagram",
                "aria-live": "polite",
            },
        )
        output.string = "Rendering diagram…"
        details = soup.new_tag("details", attrs={"class": "mermaid-source"})
        summary = soup.new_tag("summary")
        summary.string = "Diagram source"
        source_pre = soup.new_tag("pre")
        source_code = soup.new_tag("code", attrs={"class": "language-mermaid"})
        source_code.string = source
        source_pre.append(source_code)
        details.extend([summary, source_pre])
        figure.extend([output, details])
        pre.replace_with(figure)
        return

    wrapper = soup.new_tag("div", attrs={"class": "code-block"})
    header = soup.new_tag("div", attrs={"class": "code-head"})
    label = soup.new_tag("span")
    label.string = CODE_LABELS.get(language, language.upper())
    button = soup.new_tag(
        "button",
        attrs={"class": "copy-button", "type": "button", "aria-label": "Copy code"},
    )
    button.string = "Copy"
    header.extend([label, button])
    new_pre = soup.new_tag("pre")
    new_code = soup.new_tag("code", attrs={"class": f"highlight language-{language}"})
    # html5lib preserves the runs of spaces inside Pygments whitespace spans.
    # html.parser collapses each run and destroys source indentation.
    highlighted = BeautifulSoup(f"<div>{pygments_html(source, language)}</div>", "html5lib")
    fragment = highlighted.find("div")
    new_code.extend(list(fragment.contents))
    if new_code.get_text() != source.rstrip("\n"):
        fail(f"{page.source}: syntax highlighting changed code-block text")
    new_pre.append(new_code)
    wrapper.extend([header, new_pre])
    pre.replace_with(wrapper)


def transform_callout(soup: BeautifulSoup, blockquote: Any) -> None:
    paragraph = blockquote.find("p", recursive=False)
    strong = paragraph.find("strong", recursive=False) if paragraph else None
    if paragraph is None or strong is None:
        return
    label = strong.get_text(" ", strip=True).rstrip(":").lower()
    if label not in CALLOUT_TYPES:
        return
    strong.extract()
    if paragraph.contents and isinstance(paragraph.contents[0], str):
        paragraph.contents[0].replace_with(paragraph.contents[0].lstrip())
    blockquote.name = "aside"
    blockquote["class"] = ["callout", label]
    blockquote["role"] = "note"
    title = soup.new_tag("strong", attrs={"class": "callout-title"})
    title.string = label.capitalize()
    blockquote.insert(0, title)


def render_markdown(
    page: Page,
    pages_by_relative: dict[str, Page],
    pages_by_url: dict[str, Page],
) -> None:
    source = remove_first_h1(page.markdown, page.title, page.source)
    rendered = MARKDOWN.render(source)
    soup = BeautifulSoup(rendered, "html.parser")

    used_slugs: set[str] = set()
    for heading in soup.find_all(re.compile(r"^h[2-6]$")):
        title = heading.get_text(" ", strip=True)
        anchor = unique_slug(title, used_slugs)
        heading["id"] = anchor
        page.anchors.add(anchor)
        level = int(heading.name[1])
        if level <= 3:
            page.toc.append(TocItem(level=level, anchor=anchor, title=title))

    for anchor in soup.find_all("a", href=True):
        rewritten = rewrite_href(page, anchor["href"], pages_by_relative, pages_by_url)
        anchor["href"] = rewritten
        page.outgoing_links.append(rewritten)

    for table in list(soup.find_all("table")):
        for cell in table.find_all(["th", "td"]):
            style = cell.attrs.pop("style", "")
            if "text-align:right" in style.replace(" ", ""):
                cell["class"] = [*cell.get("class", []), "align-right"]
            elif "text-align:center" in style.replace(" ", ""):
                cell["class"] = [*cell.get("class", []), "align-center"]
        wrapper = soup.new_tag("div", attrs={"class": "table-wrap"})
        table.wrap(wrapper)

    for blockquote in list(soup.find_all("blockquote")):
        transform_callout(soup, blockquote)

    for pre in list(soup.find_all("pre")):
        if pre.find_parent("figure", class_="mermaid-diagram"):
            continue
        transform_code_block(soup, pre, page)

    page.body_html = bleach.clean(
        str(soup),
        tags=ALLOWED_TAGS,
        attributes=ALLOWED_ATTRIBUTES,
        protocols={"http", "https", "mailto"},
        strip=True,
    )


def load_pages() -> tuple[list[Page], dict[str, Page], dict[str, Page]]:
    pages: list[Page] = []
    pages_by_relative: dict[str, Page] = {}
    pages_by_url: dict[str, Page] = {}
    titles: set[str] = set()

    for path in sorted(SOURCE_ROOT.rglob("*.md")):
        if DATA_ROOT in path.parents:
            continue
        metadata, markdown_text = split_front_matter(path)
        missing = REQUIRED_METADATA - metadata.keys()
        if missing:
            fail(f"{path}: missing metadata: {', '.join(sorted(missing))}")
        if metadata["section"] not in ALLOWED_SECTIONS:
            fail(f"{path}: unsupported section {metadata['section']!r}")
        if metadata["type"] not in ALLOWED_TYPES:
            fail(f"{path}: unsupported type {metadata['type']!r}")
        if metadata["level"] not in ALLOWED_LEVELS:
            fail(f"{path}: unsupported level {metadata['level']!r}")
        if metadata["status"] not in ALLOWED_STATUSES:
            fail(f"{path}: unsupported status {metadata['status']!r}")
        if not isinstance(metadata["order"], int):
            fail(f"{path}: order must be an integer")
        if metadata["title"] in titles:
            fail(f"{path}: duplicate page title {metadata['title']!r}")
        titles.add(metadata["title"])

        relative = canonical_source_relative(path)
        url = canonical_url(relative)
        if relative in pages_by_relative or url in pages_by_url:
            fail(f"{path}: duplicate page identity")
        page = Page(
            source=path,
            relative=relative,
            metadata=metadata,
            markdown=markdown_text,
            url=url,
            output_relative=output_relative_for_url(url),
        )
        pages.append(page)
        pages_by_relative[relative] = page
        pages_by_url[url] = page

    return pages, pages_by_relative, pages_by_url


def assign_navigation(
    pages: list[Page], navigation: dict[str, Any]
) -> tuple[dict[str, dict[str, Any]], list[Landing], set[str]]:
    sections = sorted(navigation["sections"], key=lambda item: item["order"])
    section_map = {section["id"]: section for section in sections}
    if set(section_map) != ALLOWED_SECTIONS - {"home"}:
        fail("navigation.json must define every public section exactly once")

    workspec = section_map["workspec"]
    assigned_workspec: set[str] = set()
    for group in sorted(workspec.get("groups", []), key=lambda item: item["order"]):
        explicit = set(group.get("paths", []))
        prefix = group.get("prefix")
        group_pages = [
            page
            for page in pages
            if page.section == "workspec"
            and (page.relative in explicit or (prefix and page.relative.startswith(prefix)))
        ]
        if not group_pages:
            fail(f"navigation group {group['id']!r} has no pages")
        for page in group_pages:
            if page.relative in assigned_workspec:
                fail(f"{page.source}: assigned to more than one WorkSpec navigation group")
            assigned_workspec.add(page.relative)
            page.group_id = group["id"]
        group["pages"] = sorted(group_pages, key=lambda page: (page.order, page.url))

    expected_workspec = {page.relative for page in pages if page.section == "workspec"}
    if assigned_workspec != expected_workspec:
        missing = sorted(expected_workspec - assigned_workspec)
        fail(f"WorkSpec navigation leaves pages unassigned: {missing}")

    for section in sections:
        section["pages"] = sorted(
            [page for page in pages if page.section == section["id"]],
            key=lambda page: (page.order, page.url),
        )

    landings: list[Landing] = []
    landing_urls: set[str] = set()
    for section in sections:
        landing = Landing(
            title=section["label"],
            description=section["description"],
            url=section["landing"],
            section_id=section["id"],
            group_id=None,
            children=section["pages"],
            child_groups=section.get("groups", []),
        )
        landings.append(landing)
        landing_urls.add(landing.url)
        for group in section.get("groups", []):
            group_landing = Landing(
                title=group["label"],
                description=group["description"],
                url=group["landing"],
                section_id=section["id"],
                group_id=group["id"],
                children=group["pages"],
            )
            landings.append(group_landing)
            landing_urls.add(group_landing.url)
    return section_map, landings, landing_urls


def validate_local_orders(section_map: dict[str, dict[str, Any]]) -> None:
    for section in section_map.values():
        collections = section.get("groups") or [{"id": section["id"], "pages": section["pages"]}]
        for collection in collections:
            seen: dict[int, str] = {}
            for page in collection["pages"]:
                if page.order in seen:
                    fail(
                        f"duplicate order {page.order} in navigation group {collection['id']}: "
                        f"{seen[page.order]} and {page.relative}"
                    )
                seen[page.order] = page.relative


def validate_manifests(pages_by_url: dict[str, Page]) -> dict[str, Any]:
    data = {
        "api": load_json(DATA_ROOT / "api-surface.json"),
        "cli": load_json(DATA_ROOT / "cli-surface.json"),
        "compatibility": load_json(DATA_ROOT / "compatibility.json"),
        "language": load_json(DATA_ROOT / "workspec-language-surface.json"),
    }
    for manifest_name in ("api", "cli", "language"):
        manifest = data[manifest_name]
        entries = manifest.get("exports", []) + manifest.get("runtime_exports", [])
        entries += manifest.get("commands", []) + manifest.get("entries", [])
        for entry in entries:
            owner = entry.get("owner")
            if owner and normalize_docs_url(owner) not in pages_by_url:
                fail(f"{manifest_name} manifest has an unknown owner route: {owner}")

    generated_sources = {
        "top_level_exports": "api",
        "runtime_exports": "api",
        "command_table": "cli",
        "exit_codes": "cli",
        "field_table": "language",
    }
    for page in pages_by_url.values():
        for section in page.metadata.get("generated_sections", []):
            if section not in generated_sources:
                fail(f"{page.source}: unknown generated section {section!r}")
    return data


def validate_links(
    pages: list[Page], pages_by_url: dict[str, Page], landing_urls: set[str]
) -> None:
    valid_urls = set(pages_by_url) | landing_urls | {"/docs/llms.txt"}
    for page in pages:
        for href in page.outgoing_links:
            parts = urlsplit(href)
            if parts.scheme or not parts.path.startswith("/docs"):
                continue
            if parts.path.startswith("/docs/assets/"):
                continue
            normalized_path = normalize_docs_url(parts.path)
            if normalized_path not in valid_urls:
                fail(f"{page.source}: generated link has no target: {href}")
            if parts.fragment and normalized_path in pages_by_url:
                target = pages_by_url[normalized_path]
                if parts.fragment not in target.anchors:
                    fail(f"{page.source}: generated link has no heading: {href}")


def escape(value: Any) -> str:
    return html.escape(str(value), quote=True)


def header_html() -> str:
    return """
    <header class="site-header">
        <a class="brand" href="/docs/" aria-label="WorkSpec documentation home">
            <img class="brand-mark" src="/assets/images/workspec-logo.cleaned.png" alt="">
            <span>WorkSpec</span><span class="brand-label">Docs</span>
        </a>
        <button class="header-search" type="button" data-search-trigger>
            <span class="search-placeholder">Search WorkSpec</span><kbd>⌘ K</kbd>
        </button>
        <div class="header-actions">
            <a class="icon-button" href="/playground.html" aria-label="Open WorkSpec Studio" title="Open WorkSpec Studio">
                <svg aria-hidden="true" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1"></rect><rect x="14" y="3" width="7" height="7" rx="1"></rect><rect x="3" y="14" width="7" height="7" rx="1"></rect><path d="M14 18h7m-3-3 3 3-3 3"></path></svg>
            </a>
            <button class="icon-button theme-button" type="button" data-theme-toggle aria-label="Use dark theme" title="Use dark theme">
                <svg class="theme-icon theme-icon-moon" aria-hidden="true" viewBox="0 0 24 24"><path d="M20 15.2A8.5 8.5 0 0 1 8.8 4a8.5 8.5 0 1 0 11.2 11.2Z"></path></svg>
                <svg class="theme-icon theme-icon-sun" aria-hidden="true" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3.5"></circle><path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"></path></svg>
            </button>
            <button class="mobile-menu" type="button" data-menu-toggle aria-label="Open navigation" aria-expanded="false">Menu</button>
        </div>
    </header>"""


def nav_link(page: Page, current_url: str) -> str:
    current = ' aria-current="page"' if page.url == current_url else ""
    return f'<li><a href="{escape(page.url)}"{current}>{escape(page.title)}</a></li>'


def sidebar_html(
    current_url: str,
    current_section: str,
    current_group: str | None,
    section_map: dict[str, dict[str, Any]],
    home_page: Page,
) -> str:
    sections = sorted(section_map.values(), key=lambda item: item["order"])
    chunks = ['<aside class="sidebar" aria-label="Documentation navigation"><nav>']
    for section in sections:
        open_section = current_section == section["id"] or (
            current_section == "home" and section["id"] == "start"
        )
        open_attr = " open" if open_section else ""
        chunks.append(f'<details class="nav-section"{open_attr}>')
        chunks.append(f'<summary>{escape(section["label"])}</summary>')
        if section["id"] == "workspec":
            for group in sorted(section.get("groups", []), key=lambda item: item["order"]):
                open_group = open_section and current_group == group["id"]
                group_open = " open" if open_group else ""
                chunks.append(f'<details class="nav-subsection"{group_open}>')
                chunks.append(f'<summary>{escape(group["label"])}</summary><ul class="nav-list">')
                chunks.extend(nav_link(page, current_url) for page in group["pages"])
                chunks.append("</ul></details>")
        else:
            chunks.append('<ul class="nav-list">')
            if section.get("include_home"):
                chunks.append(nav_link(home_page, current_url))
            chunks.extend(nav_link(page, current_url) for page in section["pages"])
            chunks.append("</ul>")
        chunks.append("</details>")
    chunks.append("</nav></aside>")
    return "".join(chunks)


def search_dialog_html() -> str:
    return """
    <dialog class="search-dialog" data-search-dialog>
        <div class="search-panel">
            <div class="search-input-wrap"><input class="search-input" data-search-input type="search" placeholder="Search WorkSpec documentation" aria-label="Search documentation"><kbd>Esc</kbd></div>
            <ul class="search-results" data-search-results></ul>
        </div>
    </dialog>"""


def footer_html() -> str:
    return """
    <footer class="site-footer">
        <span>WorkSpec language 2.2</span>
        <span>Inspectable world modelling</span>
    </footer>"""


def document_shell(
    *,
    title: str,
    description: str,
    current_url: str,
    current_section: str,
    current_group: str | None,
    main_html: str,
    section_map: dict[str, dict[str, Any]],
    home_page: Page,
    has_mermaid: bool = False,
) -> str:
    mermaid_script = '<script type="module" src="/docs/assets/mermaid.js"></script>' if has_mermaid else ""
    return f"""<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>{escape(title)} | WorkSpec documentation</title>
    <meta name="description" content="{escape(description)}">
    <link rel="canonical" href="https://universalautomation.wiki{escape(current_url)}">
    <link rel="icon" href="/assets/images/favicon.png">
    <link rel="stylesheet" href="/docs/assets/docs.css">
    <link rel="stylesheet" href="/docs/assets/syntax.css">
    <script>try{{document.documentElement.dataset.theme=localStorage.getItem('workspec-docs-theme')||(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light')}}catch(error){{}}</script>
    <!-- Google tag (gtag.js) -->
    <script async src="https://www.googletagmanager.com/gtag/js?id=G-65XT8ZJM5X"></script>
    <script>window.dataLayer=window.dataLayer||[];function gtag(){{dataLayer.push(arguments);}}gtag('js',new Date());gtag('config','G-65XT8ZJM5X');</script>
</head>
<body>
    <a class="skip-link" href="#main-content">Skip to content</a>
    {header_html()}
    <div class="docs-shell">
        {sidebar_html(current_url, current_section, current_group, section_map, home_page)}
        {main_html}
    </div>
    {search_dialog_html()}
    <script src="/docs/assets/docs.js"></script>
    {mermaid_script}
</body>
</html>
"""


def breadcrumbs_html(items: list[tuple[str, str | None]]) -> str:
    chunks = ['<nav class="breadcrumb" aria-label="Breadcrumb">']
    for index, (label, url) in enumerate(items):
        if index:
            chunks.append('<span aria-hidden="true">/</span>')
        if url:
            chunks.append(f'<a href="{escape(url)}">{escape(label)}</a>')
        else:
            chunks.append(f'<span aria-current="page">{escape(label)}</span>')
    chunks.append("</nav>")
    return "".join(chunks)


def toc_html(items: list[TocItem]) -> str:
    if not items:
        return ""
    links = "".join(
        f'<li class="toc-level-{item.level}"><a href="#{escape(item.anchor)}">{escape(item.title)}</a></li>'
        for item in items
    )
    return f'<aside class="toc" aria-label="On this page"><p class="toc-title">On this page</p><ol>{links}</ol></aside>'


def related_html(page: Page, pages_by_url: dict[str, Page]) -> str:
    related = page.metadata.get("related", [])
    if not related:
        return ""
    links = []
    for route in related:
        normalized = normalize_docs_url(str(route))
        target = pages_by_url.get(normalized)
        if target is None:
            fail(f"{page.source}: related route does not resolve: {route}")
        links.append(f'<li><a href="{escape(target.url)}">{escape(target.title)}</a></li>')
    return f'<section class="related-links" aria-labelledby="related-title"><h2 id="related-title">Related pages</h2><ul>{"".join(links)}</ul></section>'


def page_sequences(section_map: dict[str, dict[str, Any]], home_page: Page) -> dict[str, tuple[Page | None, Page | None]]:
    result: dict[str, tuple[Page | None, Page | None]] = {}
    for section in section_map.values():
        if not section.get("sequence"):
            continue
        sequence = list(section["pages"])
        if section.get("include_home"):
            sequence.insert(0, home_page)
        for index, page in enumerate(sequence):
            previous = sequence[index - 1] if index else None
            following = sequence[index + 1] if index + 1 < len(sequence) else None
            result[page.url] = (previous, following)
    return result


def page_nav_html(page: Page, sequences: dict[str, tuple[Page | None, Page | None]]) -> str:
    previous, following = sequences.get(page.url, (None, None))
    if previous is None and following is None:
        return ""
    chunks = ['<nav class="page-nav" aria-label="Page navigation">']
    if previous:
        chunks.append(f'<a href="{escape(previous.url)}"><small>Previous</small><span>{escape(previous.title)}</span></a>')
    else:
        chunks.append('<span aria-hidden="true"></span>')
    if following:
        chunks.append(f'<a href="{escape(following.url)}"><small>Next</small><span>{escape(following.title)}</span></a>')
    chunks.append("</nav>")
    return "".join(chunks)


def page_breadcrumbs(page: Page, section_map: dict[str, dict[str, Any]]) -> list[tuple[str, str | None]]:
    section = section_map[page.section]
    items: list[tuple[str, str | None]] = [("Docs", "/docs/"), (section["label"], section["landing"])]
    if page.group_id:
        group = next(group for group in section["groups"] if group["id"] == page.group_id)
        items.append((group["label"], group["landing"]))
    items.append((page.title, None))
    return items


def render_article_page(
    page: Page,
    section_map: dict[str, dict[str, Any]],
    home_page: Page,
    pages_by_url: dict[str, Page],
    sequences: dict[str, tuple[Page | None, Page | None]],
) -> str:
    experimental = ""
    if page.metadata.get("experimental"):
        experimental = (
            '<aside class="callout caution" role="note"><strong class="callout-title">Experimental</strong>'
            '<p>This API can change between package releases.</p></aside>'
        )
    toc = toc_html(page.toc)
    layout_class = "article-layout" if toc else "article-layout no-toc"
    main = f"""
        <main class="docs-stage" id="main-content">
            <div class="{layout_class}">
                <article class="article">
                    {breadcrumbs_html(page_breadcrumbs(page, section_map))}
                    <header class="article-header"><h1>{escape(page.title)}</h1><p class="lead">{escape(page.description)}</p></header>
                    {experimental}
                    <div class="article-body">{page.body_html}</div>
                    {related_html(page, pages_by_url)}
                    {page_nav_html(page, sequences)}
                </article>
                {toc}
            </div>
        </main>"""
    return document_shell(
        title=page.title,
        description=page.description,
        current_url=page.url,
        current_section=page.section,
        current_group=page.group_id,
        main_html=main,
        section_map=section_map,
        home_page=home_page,
        has_mermaid=page.has_mermaid,
    )


def render_home(page: Page, section_map: dict[str, dict[str, Any]], home_page: Page) -> str:
    main = f"""
        <main class="docs-stage home-stage" id="main-content">
            <section class="home-hero" aria-labelledby="hero-title">
                <div class="home-copy">
                    <h1 id="hero-title">Describe work. <span class="accent-phrase">Resolve the world.</span></h1>
                    <p class="lead">Model world state, planned work, executable effects, and the rules that prove the resolved result.</p>
                    <div class="hero-actions">
                        <a class="button primary" href="/docs/start/first-project/">Build your first project</a>
                        <a class="button" href="/docs/start/what-is-workspec/">Understand the model</a>
                    </div>
                </div>
                <section class="work-map" aria-labelledby="work-map-title">
                    <header class="work-map-header"><p class="work-map-kicker">Interactive model</p><h2 id="work-map-title">Trace one source of truth</h2><p>Select a part of the model to follow its role.</p></header>
                    <div class="orbit-canvas">
                        <div class="orbit-ring orbit-ring-outer" aria-hidden="true"></div><div class="orbit-ring orbit-ring-inner" aria-hidden="true"></div>
                        <div class="work-nodes" role="tablist" aria-label="Parts of a WorkSpec project">
                            <button class="work-node work-node-state" id="work-node-state" type="button" role="tab" aria-selected="true" aria-controls="work-panel-state" data-work-node><span>01</span>Starting State</button>
                            <button class="work-node work-node-changes" id="work-node-changes" type="button" role="tab" aria-selected="false" aria-controls="work-panel-changes" tabindex="-1" data-work-node><span>02</span>Changes</button>
                            <button class="work-node work-node-run" id="work-node-run" type="button" role="tab" aria-selected="false" aria-controls="work-panel-run" tabindex="-1" data-work-node><span>03</span>Resolved run</button>
                            <button class="work-node work-node-constraints" id="work-node-constraints" type="button" role="tab" aria-selected="false" aria-controls="work-panel-constraints" tabindex="-1" data-work-node><span>04</span>Constraints</button>
                            <button class="work-node work-node-rendering" id="work-node-rendering" type="button" role="tab" aria-selected="false" aria-controls="work-panel-rendering" tabindex="-1" data-work-node><span>05</span>Rendering</button>
                        </div>
                        <div class="work-panel" id="work-panel-state" role="tabpanel" aria-labelledby="work-node-state" data-work-panel><p class="work-panel-step">Input / 01</p><h3>Declare what exists</h3><p>Objects, tasks, locations, and initial properties define the world before work starts.</p><code>parcel.state = "unpacked"</code><a href="/docs/learn/world-state/">Learn about world state</a></div>
                        <div class="work-panel" id="work-panel-changes" role="tabpanel" aria-labelledby="work-node-changes" data-work-panel hidden><p class="work-panel-step">Effects / 02</p><h3>Attach known effects</h3><p>Changes describe the state updates that a task produces at known lifecycle points.</p><code>set("parcel", "state", "packed")</code><a href="/docs/learn/changes/">Learn about Changes</a></div>
                        <div class="work-panel" id="work-panel-run" role="tabpanel" aria-labelledby="work-node-run" data-work-panel hidden><p class="work-panel-step">Runtime / 03</p><h3>Resolve one history</h3><p>The runtime applies every effect once and records the authoritative state for each time.</p><code>run.resolvedThrough = 550</code><a href="/docs/workspec/runtime/execution-model/">Read the execution model</a></div>
                        <div class="work-panel" id="work-panel-constraints" role="tabpanel" aria-labelledby="work-node-constraints" data-work-panel hidden><p class="work-panel-step">Evidence / 04</p><h3>Test the resolved result</h3><p>Constraints inspect the run and report evidence without changing the world.</p><code>violations = 0</code><a href="/docs/workspec/constraints/overview/">Understand Constraints</a></div>
                        <div class="work-panel" id="work-panel-rendering" role="tabpanel" aria-labelledby="work-node-rendering" data-work-panel hidden><p class="work-panel-step">Output / 05</p><h3>Present the same result</h3><p>Renderers and Studio display the existing run. They do not calculate another world.</p><code>parcel-world.svg</code><a href="/docs/workspec/rendering/overview/">Explore rendering</a></div>
                    </div>
                </section>
            </section>
            <section class="path-grid" aria-label="Start with WorkSpec">
                <a class="path-card" href="/docs/start/what-is-workspec/"><span class="path-number">01 / Orient</span><h2>See the whole model</h2><p>Understand how state, Changes, Constraints, runtime execution, and rendering fit together.</p></a>
                <a class="path-card" href="/docs/start/install/"><span class="path-number">02 / Prepare</span><h2>Install and verify</h2><p>Set up the CLI and JavaScript package with Node.js 18 or later.</p></a>
                <a class="path-card" href="/docs/start/first-project/"><span class="path-number">03 / Build</span><h2>Resolve your first world</h2><p>Validate, inspect, constrain, and render a complete small project.</p></a>
            </section>
            <section class="reference-band" aria-labelledby="reference-title">
                <div><p class="footer-kicker">Lookup mode</p><h2 id="reference-title">Go straight to the contract.</h2><p class="lead">Once you know what you need, the reference mirrors the product surface.</p></div>
                <div class="reference-list">
                    <a href="/docs/workspec/overview/"><span>WorkSpec language</span><small>Language</small></a><a href="/docs/cli/overview/"><span>CLI commands</span><small>Commands</small></a><a href="/docs/api/overview/"><span>JavaScript API</span><small>Library</small></a><a href="/docs/studio/overview/"><span>WorkSpec Studio</span><small>Interface</small></a><a href="/docs/workspec/sources/security/"><span>Execution security</span><small>Policy</small></a><a href="/docs/workspec/versioning-compatibility/"><span>Versions and compatibility</span><small>Release</small></a>
                </div>
            </section>
            {footer_html()}
        </main>"""
    return document_shell(
        title=page.title,
        description=page.description,
        current_url=page.url,
        current_section="home",
        current_group=None,
        main_html=main,
        section_map=section_map,
        home_page=home_page,
    )


def render_landing(
    landing: Landing,
    section_map: dict[str, dict[str, Any]],
    home_page: Page,
) -> str:
    section = section_map[landing.section_id]
    breadcrumbs = [("Docs", "/docs/")]
    if landing.group_id:
        breadcrumbs.append((section["label"], section["landing"]))
    breadcrumbs.append((landing.title, None))

    if landing.child_groups:
        cards = "".join(
            f'<a class="landing-card" href="{escape(group["landing"])}"><h2>{escape(group["label"])}</h2><p>{escape(group["description"])}</p><small>{len(group["pages"])} pages</small></a>'
            for group in sorted(landing.child_groups, key=lambda item: item["order"])
        )
    else:
        cards = "".join(
            f'<a class="landing-card" href="{escape(page.url)}"><h2>{escape(page.title)}</h2><p>{escape(page.description)}</p></a>'
            for page in landing.children
        )
    main = f"""
        <main class="docs-stage" id="main-content">
            <div class="landing-layout">
                {breadcrumbs_html(breadcrumbs)}
                <header class="article-header"><h1>{escape(landing.title)}</h1><p class="lead">{escape(landing.description)}</p></header>
                <div class="landing-grid">{cards}</div>
                {footer_html()}
            </div>
        </main>"""
    return document_shell(
        title=landing.title,
        description=landing.description,
        current_url=landing.url,
        current_section=landing.section_id,
        current_group=landing.group_id,
        main_html=main,
        section_map=section_map,
        home_page=home_page,
    )


MERMAID_LOADER = r'''import mermaid from "https://cdn.jsdelivr.net/npm/mermaid@11.12.2/dist/mermaid.esm.min.mjs";

const diagrams = [...document.querySelectorAll("[data-mermaid-diagram]")];
let renderVersion = 0;

async function renderDiagrams() {
    const version = ++renderVersion;
    const dark = document.documentElement.dataset.theme === "dark";
    mermaid.initialize({
        startOnLoad: false,
        securityLevel: "strict",
        theme: dark ? "dark" : "default",
        flowchart: { htmlLabels: false, curve: "basis" }
    });
    for (const [index, diagram] of diagrams.entries()) {
        const source = diagram.querySelector(".mermaid-source code")?.textContent || "";
        const output = diagram.querySelector(".mermaid-output");
        if (!output || !source) continue;
        try {
            const id = `workspec-diagram-${version}-${index}`;
            const result = await mermaid.render(id, source);
            if (version !== renderVersion) return;
            output.innerHTML = result.svg;
            output.removeAttribute("aria-live");
            result.bindFunctions?.(output);
        } catch (error) {
            output.textContent = "The diagram could not be rendered. Open Diagram source to read it as text.";
            output.classList.add("mermaid-error");
        }
    }
}

renderDiagrams();
window.addEventListener("workspec:themechange", renderDiagrams);
'''


def syntax_css() -> str:
    formatter = HtmlFormatter(style="monokai")
    return "/* Generated by web/scripts/generate-docs.py. */\n" + formatter.get_style_defs(
        ".code-block .highlight"
    ) + "\n"


def build_search_index(pages: list[Page], section_map: dict[str, dict[str, Any]]) -> str:
    records = [
        {
            "title": page.title,
            "description": page.description,
            "section": "Start here" if page.section == "home" else section_map[page.section]["label"],
            "href": page.url,
        }
        for page in sorted(pages, key=lambda page: page.url)
    ]
    return json.dumps(records, ensure_ascii=False, indent=2, sort_keys=True) + "\n"


def write_stage_file(stage: Path, relative: str, content: str | bytes) -> None:
    destination = stage / relative
    destination.parent.mkdir(parents=True, exist_ok=True)
    if isinstance(content, bytes):
        destination.write_bytes(content)
    else:
        destination.write_text(content, encoding="utf-8", newline="\n")


def validate_staged_html(stage: Path, expected_pages: int) -> None:
    html_files = sorted(stage.rglob("*.html"))
    if len(html_files) != expected_pages:
        fail(f"expected {expected_pages} generated HTML pages, found {len(html_files)}")
    for path in html_files:
        source = path.read_text(encoding="utf-8")
        soup = BeautifulSoup(source, "html.parser")
        if len(soup.find_all("h1")) != 1:
            fail(f"{path}: generated page must contain exactly one H1")
        if not soup.select_one("[data-search-trigger]") or not soup.select_one(".sidebar"):
            fail(f"{path}: generated shell is incomplete")


def stage_build(stage: Path) -> tuple[list[str], dict[str, Any]]:
    navigation = load_json(DATA_ROOT / "navigation.json")
    pages, pages_by_relative, pages_by_url = load_pages()
    section_map, landings, landing_urls = assign_navigation(pages, navigation)
    validate_local_orders(section_map)
    manifests = validate_manifests(pages_by_url)

    for page in pages:
        render_markdown(page, pages_by_relative, pages_by_url)
    validate_links(pages, pages_by_url, landing_urls)

    home_page = pages_by_url["/docs/"]
    sequences = page_sequences(section_map, home_page)
    write_stage_file(stage, home_page.output_relative, render_home(home_page, section_map, home_page))
    for page in pages:
        if page.url == "/docs/":
            continue
        write_stage_file(
            stage,
            page.output_relative,
            render_article_page(page, section_map, home_page, pages_by_url, sequences),
        )
    for landing in landings:
        write_stage_file(
            stage,
            output_relative_for_url(landing.url),
            render_landing(landing, section_map, home_page),
        )

    write_stage_file(stage, "llms.txt", (SOURCE_ROOT / "llms.txt").read_bytes())
    write_stage_file(stage, "assets/search-index.json", build_search_index(pages, section_map))
    write_stage_file(stage, "assets/syntax.css", syntax_css())
    write_stage_file(stage, "assets/mermaid.js", MERMAID_LOADER)

    validate_staged_html(stage, expected_pages=len(pages) + len(landings))
    generated_files = sorted(path.relative_to(stage).as_posix() for path in stage.rglob("*") if path.is_file())
    summary = {
        "authored_pages": len(pages),
        "generated_landings": len(landings),
        "html_pages": len(pages) + len(landings),
        "mermaid_pages": sum(page.has_mermaid for page in pages),
        "search_records": len(pages),
        "package_version": manifests["api"]["package_version"],
        "language_version": manifests["language"]["language_version"],
    }
    return generated_files, summary


def file_digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def check_stage(stage: Path, generated_files: list[str]) -> bool:
    expected = set(generated_files)
    if not GENERATED_MANIFEST.exists():
        return False
    manifest = load_json(GENERATED_MANIFEST)
    actual = set(manifest.get("files", []))
    if expected != actual:
        return False
    return all(
        (OUTPUT_ROOT / relative).is_file()
        and file_digest(stage / relative) == file_digest(OUTPUT_ROOT / relative)
        for relative in expected
    )


def publish_stage(stage: Path, generated_files: list[str], summary: dict[str, Any]) -> None:
    OUTPUT_ROOT.mkdir(parents=True, exist_ok=True)
    ASSET_ROOT.mkdir(parents=True, exist_ok=True)
    old_files: set[str] = set()
    if GENERATED_MANIFEST.exists():
        old_files = set(load_json(GENERATED_MANIFEST).get("files", []))

    for relative in sorted(old_files - set(generated_files), reverse=True):
        target = (OUTPUT_ROOT / relative).resolve()
        if OUTPUT_ROOT.resolve() not in target.parents:
            fail(f"refusing to remove path outside docs output: {target}")
        if target.is_file():
            target.unlink()

    for relative in generated_files:
        source = stage / relative
        destination = OUTPUT_ROOT / relative
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, destination)

    manifest = {
        "files": generated_files,
        "generator": SCRIPT_PATH.relative_to(REPO_ROOT).as_posix(),
        "summary": summary,
    }
    GENERATED_MANIFEST.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
        newline="\n",
    )

    for directory in sorted(OUTPUT_ROOT.rglob("*"), reverse=True):
        if directory.is_dir() and directory != ASSET_ROOT:
            try:
                directory.rmdir()
            except OSError:
                pass


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--check",
        action="store_true",
        help="Fail if generated output differs from the current web/docs tree.",
    )
    arguments = parser.parse_args()

    with tempfile.TemporaryDirectory(prefix="workspec-docs-") as temporary:
        stage = Path(temporary)
        generated_files, summary = stage_build(stage)
        if arguments.check:
            if not check_stage(stage, generated_files):
                print("Generated documentation is stale. Run web/scripts/generate-docs.py.", file=sys.stderr)
                return 1
            print(
                f"Documentation is current: {summary['authored_pages']} Markdown pages, "
                f"{summary['generated_landings']} generated landings."
            )
            return 0
        publish_stage(stage, generated_files, summary)

    print(
        f"Generated {summary['html_pages']} HTML pages from {summary['authored_pages']} Markdown pages "
        f"({summary['generated_landings']} section landings, {summary['mermaid_pages']} Mermaid pages)."
    )
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except ValueError as error:
        print(f"Documentation build failed: {error}", file=sys.stderr)
        raise SystemExit(1) from error
