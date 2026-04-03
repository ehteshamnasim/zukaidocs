# md2pdf

A production-ready CLI tool and VS Code extension for converting Markdown to beautiful PDFs with full **Mermaid diagram support**, cover pages, table of contents, and more. Designed for corporate documentation and developer workflows.

## Features

### Core
- 🎨 **Multiple Themes** — GitHub, Minimal, Professional, Academic
- 📊 **Full Mermaid Support** — Flowcharts, sequences, ERDs, Gantt charts, and more
- 🔍 **Syntax Highlighting** — 180+ languages with 5 code themes
- 👀 **Watch Mode** — Live regeneration during development
- ⚙️ **Config System** — Reusable config presets in `configs/` folder

### Professional Documents
- 📄 **Cover Page** — Title, subtitle, author, logo, version, confidential badge
- 📑 **Table of Contents** — Auto-generated with clickable links
- 💧 **Watermarks** — Text watermarks with configurable opacity
- 🔢 **Page Numbers** — Multiple formats (1/10, Page X of Y, Roman numerals)
- 🏷️ **PDF Bookmarks** — Auto-generated outline from headings

### Developer Features
- 📝 **YAML Frontmatter** — Per-file configuration override
- 🔢 **Code Line Numbers** — Toggle line numbers in code blocks
- 🎨 **Code Themes** — GitHub, Monokai, Dracula, One Dark, GitHub Dark
- 📂 **File Includes** — Split docs with `!include ./file.md`
- 🔧 **Git Info Footer** — Auto-embed branch, commit, date
- ➗ **Math Support** — KaTeX equations ($inline$ and $$block$$)

### Mermaid Sizing
- 📐 **Auto-scaling** — Diagrams scale to fit page
- 🎚️ **Size Presets** — small, medium, large, auto
- 📏 **Max Height** — Prevent diagrams from creating white pages

## VS Code Extension

Also available as a VS Code extension! Install directly from the marketplace:

**[Markdown to PDF Pro](https://marketplace.visualstudio.com/items?itemName=EhteshamNasim.markdown-to-pdf-pro)**

- Right-click any `.md` file → **Export to PDF**
- Keyboard shortcut: `Cmd+Shift+E` (Mac) / `Ctrl+Shift+E` (Windows)
- All features from CLI available through VS Code settings

## Installation

```bash
npm install
npm link  # Makes md2pdf command available globally
```

## Quick Start

```bash
# Basic conversion
md2pdf document.md

# Use a saved config
md2pdf document.md -c str-app

# Watch mode
md2pdf document.md -w

# Custom output
md2pdf document.md -o output.pdf
```

## CLI Commands

```bash
md2pdf <file.md>              # Convert file
md2pdf <file.md> -o out.pdf   # Custom output
md2pdf <file.md> -c <config>  # Use config from configs/
md2pdf <file.md> -t <theme>   # Use theme
md2pdf <file.md> -w           # Watch mode

md2pdf init                   # Create config in current dir
md2pdf new-config <name>      # Create config in configs/
md2pdf configs                # List available configs
md2pdf themes                 # List available themes
```

## YAML Frontmatter

Override config per-file:

```yaml
---
title: My Document
theme: professional
coverPage: true
coverTitle: Project Documentation
coverAuthor: John Doe
toc: true
showLineNumbers: true
codeTheme: dracula
mermaidScale: small
---

# My Document Content
```

## Configuration

### Create a Config

```bash
md2pdf new-config my-project
```

Creates `configs/my-project.json`:

```json
{
  "theme": "professional",
  "mermaidTheme": "default",
  "mermaidScale": "auto",
  "mermaidMaxHeight": 600,
  "codeTheme": "github",

  "pageSize": "A4",
  "margins": {
    "top": "0.6in",
    "right": "0.6in",
    "bottom": "0.6in",
    "left": "0.6in"
  },

  "coverPage": true,
  "coverTitle": "Document Title",
  "coverSubtitle": "Subtitle",
  "coverAuthor": "Author Name",
  "coverOrganization": "Company",
  "coverLogo": "https://example.com/logo.png",
  "coverVersion": "1.0",
  "coverConfidential": false,

  "toc": true,
  "tocTitle": "Table of Contents",
  "tocMaxLevel": 3,

  "watermark": "",
  "watermarkOpacity": 0.08,

  "showPageNumbers": true,
  "pageNumberFormat": "pageXofY",

  "showLineNumbers": false,
  "showGitInfo": false,

  "customCSS": "",
  "pdfOutline": true,
  "mathSupport": true
}
```

### Config Options Reference

| Option | Values | Description |
|--------|--------|-------------|
| `theme` | `github`, `minimal`, `professional`, `academic` | Document theme |
| `codeTheme` | `github`, `monokai`, `dracula`, `one-dark`, `github-dark` | Syntax highlighting theme |
| `mermaidScale` | `auto`, `small`, `medium`, `large` | Diagram sizing |
| `mermaidMaxHeight` | `600` (pixels) | Max diagram height before scaling |
| `pageNumberFormat` | `numeric`, `pageXofY`, `roman` | Page number style |
| `coverPage` | `true/false` | Enable cover page |
| `toc` | `true/false` | Enable table of contents |
| `showLineNumbers` | `true/false` | Show line numbers in code |
| `showGitInfo` | `true/false` | Show git metadata footer |
| `customCSS` | `"./style.css"` or inline CSS | Custom styling |

## File Includes

Split large documents:

```markdown
# Main Document

!include ./introduction.md
!include ./chapters/chapter1.md
!include ./appendix.md
```

## Mermaid Diagrams

All Mermaid diagram types supported:

```
flowchart TD
    A[Start] --> B{Decision}
    B -->|Yes| C[Action]
    B -->|No| D[End]
```

**Sizing control:**
```yaml
---
mermaidScale: small      # small, medium, large, auto
mermaidMaxHeight: 500    # Max pixels before auto-scale
---
```

## Themes

| Theme | Best For |
|-------|----------|
| `github` | General docs, READMEs |
| `minimal` | Clean, simple docs |
| `professional` | Business documents |
| `academic` | Research papers |

## Code Themes

| Theme | Style |
|-------|-------|
| `github` | Light, clean |
| `github-dark` | Dark GitHub |
| `monokai` | Classic dark |
| `dracula` | Purple dark |
| `one-dark` | Atom style |

## Programmatic Usage

```javascript
const { markdownToPdfBuffer, markdownToHtml } = require('./src');

// Convert to PDF buffer
const buffer = await markdownToPdfBuffer(markdownString, {
  theme: 'professional',
  coverPage: true
});

// Convert to HTML
const html = markdownToHtml(markdownString, {
  theme: 'github'
});
```

## Examples

### Corporate Document

```bash
md2pdf report.md -c str-app
```

Config `configs/str-app.json`:
- Cover page with company logo
- Table of contents
- Confidential watermark
- Page numbers (Page X of Y)
- Code line numbers

### Developer Docs

```yaml
---
showLineNumbers: true
codeTheme: dracula
showGitInfo: true
toc: true
---
```

## License

MIT
