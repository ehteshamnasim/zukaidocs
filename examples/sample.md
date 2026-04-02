# Sample Document - md2pdf Demo

This document demonstrates all features of the **md2pdf** converter including Mermaid diagrams, code blocks, tables, and more.

---

## Table of Contents

- [Features Overview](#features-overview)
- [Mermaid Diagrams](#mermaid-diagrams)
- [Code Blocks](#code-blocks)
- [Tables](#tables)
- [Typography](#typography)

---

## Features Overview

The md2pdf converter supports:

1. **Full Mermaid Support** — All diagram types render correctly
2. **Multiple Themes** — GitHub, Minimal, Professional, Academic
3. **Syntax Highlighting** — For 180+ programming languages
4. **Watch Mode** — Live regeneration during development
5. **CI/CD Compatible** — Works in headless environments

---

## Mermaid Diagrams

### Flowchart

```mermaid
flowchart TD
    A[Start] --> B{Is it working?}
    B -->|Yes| C[Excellent!]
    B -->|No| D[Check the docs]
    D --> E[Try again]
    E --> B
    C --> F[Deploy to production]
    F --> G[End]
```

### Sequence Diagram

```mermaid
sequenceDiagram
    participant User
    participant CLI
    participant Parser
    participant Renderer
    participant PDF
    
    User->>CLI: md2pdf input.md
    CLI->>Parser: Parse markdown
    Parser->>Renderer: Generate HTML
    Renderer->>PDF: Puppeteer render
    PDF->>CLI: Return PDF
    CLI->>User: output.pdf created
```

### Class Diagram

```mermaid
classDiagram
    class Document {
        +String content
        +parse()
        +render()
    }
    
    class Parser {
        +parseMarkdown()
        +extractMermaid()
    }
    
    class Renderer {
        +toHtml()
        +applyTheme()
    }
    
    class PDFGenerator {
        +generate()
        +waitForMermaid()
    }
    
    Document --> Parser
    Document --> Renderer
    Renderer --> PDFGenerator
```

### State Diagram

```mermaid
stateDiagram-v2
    [*] --> Idle
    Idle --> Parsing: File received
    Parsing --> Rendering: Parse complete
    Rendering --> Generating: HTML ready
    Generating --> Complete: PDF created
    Complete --> [*]
    
    Parsing --> Error: Parse failed
    Rendering --> Error: Render failed
    Generating --> Error: PDF failed
    Error --> [*]
```

### Pie Chart

```mermaid
pie title Time Spent on Project
    "Development" : 45
    "Testing" : 25
    "Documentation" : 15
    "Code Review" : 10
    "Deployment" : 5
```

### Gantt Chart

```mermaid
gantt
    title Project Timeline
    dateFormat YYYY-MM-DD
    section Planning
        Requirements     :a1, 2024-01-01, 7d
        Design          :a2, after a1, 5d
    section Development
        Parser          :b1, after a2, 10d
        Renderer        :b2, after b1, 8d
        PDF Generator   :b3, after b2, 6d
    section Testing
        Unit Tests      :c1, after b3, 5d
        Integration     :c2, after c1, 3d
```

### Entity Relationship Diagram

```mermaid
erDiagram
    USER ||--o{ DOCUMENT : creates
    DOCUMENT ||--|{ VERSION : has
    DOCUMENT }|--|| THEME : uses
    USER {
        string id
        string name
        string email
    }
    DOCUMENT {
        string id
        string title
        string content
    }
    VERSION {
        int number
        date created
    }
```

---

## Code Blocks

### JavaScript

```javascript
const md2pdf = require('md2pdf');

async function convertDocument() {
  const markdown = `# Hello World
  
  This is a **test** document.`;
  
  const pdfBuffer = await md2pdf.markdownToPdfBuffer(markdown, {
    theme: 'github',
    pageSize: 'A4'
  });
  
  console.log('PDF generated:', pdfBuffer.length, 'bytes');
}

convertDocument();
```

### Python

```python
def fibonacci(n: int) -> list[int]:
    """Generate Fibonacci sequence up to n terms."""
    sequence = []
    a, b = 0, 1
    
    for _ in range(n):
        sequence.append(a)
        a, b = b, a + b
    
    return sequence

# Generate first 10 Fibonacci numbers
result = fibonacci(10)
print(f"Fibonacci sequence: {result}")
```

### SQL

```sql
SELECT 
    u.name,
    u.email,
    COUNT(d.id) AS document_count,
    MAX(d.created_at) AS last_document
FROM users u
LEFT JOIN documents d ON u.id = d.user_id
WHERE u.created_at > '2024-01-01'
GROUP BY u.id, u.name, u.email
HAVING COUNT(d.id) > 5
ORDER BY document_count DESC
LIMIT 10;
```

### Bash

```bash
#!/bin/bash

# Convert all markdown files in directory
for file in *.md; do
    if [ -f "$file" ]; then
        echo "Converting: $file"
        md2pdf "$file" -t professional
    fi
done

echo "Done! All files converted."
```

---

## Tables

### Simple Table

| Feature | Status | Priority |
|---------|--------|----------|
| Mermaid Support | ✅ Complete | High |
| Multiple Themes | ✅ Complete | High |
| Watch Mode | ✅ Complete | Medium |
| Custom CSS | 🔄 Planned | Low |

### Data Table

| Country | Capital | Population | GDP (Trillion) |
|:--------|:--------|:----------:|---------------:|
| United States | Washington D.C. | 331M | $25.5 |
| China | Beijing | 1.4B | $18.3 |
| Japan | Tokyo | 125M | $4.2 |
| Germany | Berlin | 83M | $4.1 |
| United Kingdom | London | 67M | $3.1 |

---

## Typography

This section demonstrates various text formatting options.

### Text Styles

- **Bold text** for emphasis
- *Italic text* for titles or foreign words
- ~~Strikethrough~~ for corrections
- `Inline code` for technical terms
- <mark>Highlighted text</mark> for important notes
- Normal text with a [hyperlink](https://example.com)

### Blockquote

> "The best way to predict the future is to invent it."
>
> — Alan Kay, Computer Scientist

### Nested Blockquote

> This is the first level of quoting.
>
> > This is a nested blockquote.
>
> Back to the first level.

### Lists

**Unordered List:**
- First item
- Second item
  - Nested item A
  - Nested item B
    - Deep nested item
- Third item

**Ordered List:**
1. First step
2. Second step
   1. Sub-step A
   2. Sub-step B
3. Third step

### Keyboard Shortcuts

Press <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>P</kbd> to open the command palette.

On Mac, use <kbd>⌘</kbd> + <kbd>Shift</kbd> + <kbd>P</kbd> instead.

---

## Horizontal Rule

Content before the rule.

---

Content after the rule.

---

## Conclusion

This document has demonstrated the full capabilities of md2pdf:

1. ✅ Mermaid diagrams (7 types shown)
2. ✅ Syntax-highlighted code blocks
3. ✅ Tables with alignments
4. ✅ Typography and formatting
5. ✅ Lists and blockquotes

For more information, see the [README](../README.md) or run `md2pdf --help`.

---

*Generated with md2pdf v2.0.0*
