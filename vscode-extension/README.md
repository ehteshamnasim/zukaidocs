# md2pdf — Markdown to PDF Converter

<p align="center">
  <img src="https://img.shields.io/visual-studio-marketplace/v/md2pdf.md2pdf.svg" alt="Version">
  <img src="https://img.shields.io/visual-studio-marketplace/d/md2pdf.md2pdf.svg" alt="Downloads">
  <img src="https://img.shields.io/badge/license-MIT-green.svg" alt="License">
</p>

<p align="center">
  <b>Convert Markdown to beautiful, professional PDFs with full Mermaid diagram support.</b>
</p>

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 📊 **Mermaid Diagrams** | Flowcharts, sequence diagrams, Gantt charts, ER diagrams, and more |
| 📄 **Cover Pages** | Professional title pages with logo, author, version, and confidential badge |
| 📑 **Table of Contents** | Auto-generated, numbered, with clickable links |
| 🎨 **4 Themes** | GitHub, Professional, Minimal, Academic |
| 💻 **5 Code Themes** | GitHub, Monokai, Dracula, One Dark, GitHub Dark |
| 🔢 **Line Numbers** | Optional line numbers for code blocks |
| 💧 **Watermarks** | Configurable text watermarks (DRAFT, CONFIDENTIAL, etc.) |
| 📐 **Math Support** | KaTeX equations (inline and block) |
| 📖 **Page Numbers** | Multiple formats (numeric, Page X of Y) |

---

## 🚀 Quick Start

1. Install from VS Code Marketplace
2. Open any `.md` file
3. Press **Cmd+Shift+E** (Mac) or **Ctrl+Shift+E** (Windows)
4. PDF is created in the same folder!

### Other Ways to Export

- **Status Bar:** Click the `PDF` button when editing Markdown
- **Context Menu:** Right-click → "Export to PDF"
- **Command Palette:** Cmd+Shift+P → "md2pdf: Export to PDF"

### Export Mermaid for GitBook

GitBook doesn't support Mermaid diagrams natively. Use this feature to export Mermaid blocks as PNG images:

1. **Context Menu:** Right-click → "Export Mermaid as Images (GitBook)"
2. **Command Palette:** Cmd+Shift+P → "md2pdf: Export Mermaid as Images"

This creates:
- `images/*.png` — PNG images for each Mermaid diagram
- `yourfile-gitbook.md` — New markdown with image references instead of mermaid blocks

---

## ⚙️ Configuration

### Option 1: VS Code Settings

Open Settings (Cmd+,) and search for "md2pdf":

| Setting | Default | Description |
|---------|---------|-------------|
| `md2pdf.theme` | `github` | Document theme |
| `md2pdf.codeTheme` | `github` | Syntax highlighting theme |
| `md2pdf.coverPage` | `false` | Enable cover page |
| `md2pdf.coverTitle` | `""` | Cover page title |
| `md2pdf.coverSubtitle` | `""` | Cover page subtitle |
| `md2pdf.coverAuthor` | `""` | Cover page author |
| `md2pdf.coverOrganization` | `""` | Organization name |
| `md2pdf.coverLogo` | `""` | Logo path or URL |
| `md2pdf.coverVersion` | `""` | Version number |
| `md2pdf.coverConfidential` | `false` | Show CONFIDENTIAL badge |
| `md2pdf.toc` | `false` | Generate table of contents |
| `md2pdf.tocTitle` | `"Table of Contents"` | TOC heading |
| `md2pdf.tocMaxLevel` | `3` | TOC depth (1-6) |
| `md2pdf.watermark` | `""` | Watermark text |
| `md2pdf.watermarkOpacity` | `0.08` | Watermark opacity |
| `md2pdf.showPageNumbers` | `true` | Show page numbers |
| `md2pdf.showLineNumbers` | `false` | Line numbers in code |
| `md2pdf.pageSize` | `A4` | Page size |

### Option 2: YAML Frontmatter

Add configuration directly in your Markdown file:

```yaml
---
title: My Document
theme: professional
coverPage: true
coverTitle: Project Documentation
coverSubtitle: Technical Guide v2.0
coverAuthor: Your Name
coverOrganization: Your Company
coverLogo: ./images/logo.png
toc: true
tocTitle: Contents
watermark: DRAFT
codeTheme: monokai
showLineNumbers: true
---
```

### Option 3: Config Files

1. Create: Cmd+Shift+P → "md2pdf: Create Config File"
2. Export: Cmd+Shift+P → "md2pdf: Export with Config"

---

## 📊 Mermaid Diagram Support

All Mermaid diagram types are fully supported:

- **Flowcharts** — Process flows, decision trees
- **Sequence Diagrams** — API calls, interactions
- **Gantt Charts** — Project timelines
- **Class Diagrams** — UML structures
- **State Diagrams** — State machines
- **ER Diagrams** — Database schemas
- **Pie Charts** — Data visualization
- **Git Graphs** — Branch visualization

---

## 🎨 Themes

| Theme | Best For |
|-------|----------|
| **GitHub** | General documentation |
| **Professional** | Corporate documents |
| **Minimal** | Clean, simple reports |
| **Academic** | Papers, formal reports |

---

## 💻 Code Themes

| Theme | Style |
|-------|-------|
| **GitHub** | Light, clean |
| **Monokai** | Dark, classic |
| **Dracula** | Dark, purple |
| **One Dark** | Atom-style |
| **GitHub Dark** | Dark GitHub |

---

## 📁 Output Options

PDFs are saved in the same directory by default.

Change output location in settings:
```json
{
  "md2pdf.outputDirectory": "./pdf"
}
```

---

## 🔧 Requirements

- VS Code 1.74.0+
- Puppeteer (auto-installed on first use)

---

## 📝 Changelog

### 1.0.0
- Initial release
- Full Mermaid diagram support
- Cover pages with logo
- Table of contents generation
- 4 document themes
- 5 code syntax themes
- Watermark support
- Math equations (KaTeX)
- Line numbers for code
- Page numbering options

---

## 📄 License

MIT © Ehtesham Nasim

---

<p align="center">
  <b>Made with ❤️ for developers who love Markdown</b>
</p>
