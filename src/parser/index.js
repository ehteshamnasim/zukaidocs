/**
 * md2pdf - Markdown Parser Module
 * 
 * Parses markdown files with syntax highlighting and Mermaid support.
 * Features:
 *   - YAML frontmatter extraction for per-file configuration
 *   - Mermaid diagram rendering
 *   - Syntax highlighting with multiple themes
 *   - Code line numbers
 *   - File includes (!include ./file.md)
 *   - Git metadata extraction
 */

const { marked } = require('marked');
const hljs = require('highlight.js');
const matter = require('gray-matter');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

let parserOptions = {
  showLineNumbers: false,
  basePath: process.cwd()
};

const setParserOptions = (opts) => {
  parserOptions = { ...parserOptions, ...opts };
};

const createMermaidRenderer = () => {
  const renderer = new marked.Renderer();
  
  renderer.code = function(codeOrObj, langOrEscaped, escaped) {
    let text, lang;
    
    if (typeof codeOrObj === 'object' && codeOrObj !== null) {
      text = codeOrObj.text;
      lang = codeOrObj.lang;
    } else {
      text = codeOrObj;
      lang = langOrEscaped;
    }
    
    if (!text) text = '';
    
    if (lang === 'mermaid') {
      const id = `mermaid-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      return `<div class="mermaid-wrapper"><pre class="mermaid" id="${id}">${text}</pre></div>`;
    }
    
    let highlighted;
    if (lang && hljs.getLanguage(lang)) {
      try {
        highlighted = hljs.highlight(text, { language: lang }).value;
      } catch (err) {
        highlighted = hljs.highlightAuto(text).value;
      }
    } else {
      highlighted = hljs.highlightAuto(text).value;
    }
    
    const langClass = lang ? ` language-${lang}` : '';
    const langLabel = lang ? `<span class="code-lang">${lang}</span>` : '';
    
    if (parserOptions.showLineNumbers) {
      const lines = highlighted.split('\n');
      const numberedLines = lines.map((line, i) => 
        `<span class="line-number">${i + 1}</span><span class="line-content">${line}</span>`
      ).join('\n');
      return `<pre class="code-block with-line-numbers">${langLabel}<code class="hljs${langClass}">${numberedLines}</code></pre>`;
    }
    
    return `<pre class="code-block">${langLabel}<code class="hljs${langClass}">${highlighted}</code></pre>`;
  };
  
  return renderer;
};

const extractMermaidBlocks = (markdown) => {
  const blocks = [];
  const regex = /```mermaid\n([\s\S]*?)```/g;
  let match;
  
  while ((match = regex.exec(markdown)) !== null) {
    const beforeMatch = markdown.substring(0, match.index);
    const lineNumber = (beforeMatch.match(/\n/g) || []).length + 1;
    blocks.push({
      code: match[1].trim(),
      line: lineNumber
    });
  }
  
  return blocks;
};

const parseMarkdown = (markdown) => {
  marked.setOptions({
    gfm: true,
    breaks: true,
    pedantic: false
  });
  
  marked.use({ renderer: createMermaidRenderer() });
  
  return marked.parse(markdown);
};

const getMarkdownStats = (markdown) => {
  const mermaidBlocks = extractMermaidBlocks(markdown);
  const codeBlocks = (markdown.match(/```[\s\S]*?```/g) || []).length;
  const headings = (markdown.match(/^#{1,6}\s/gm) || []).length;
  const tables = (markdown.match(/\|.*\|/g) || []).length > 0;
  
  return {
    mermaidCount: mermaidBlocks.length,
    codeBlockCount: codeBlocks,
    headingCount: headings,
    hasTables: tables,
    characterCount: markdown.length,
    wordCount: markdown.split(/\s+/).filter(Boolean).length
  };
};

const extractFrontmatter = (markdown) => {
  try {
    const { data, content } = matter(markdown);
    return {
      frontmatter: data,
      content: content
    };
  } catch (err) {
    return {
      frontmatter: {},
      content: markdown
    };
  }
};

const processIncludes = (markdown, basePath = process.cwd(), depth = 0) => {
  if (depth > 10) return markdown;
  
  const includeRegex = /^!include\s+([^\n]+)$/gm;
  
  return markdown.replace(includeRegex, (match, filePath) => {
    const cleanPath = filePath.trim();
    const fullPath = path.isAbsolute(cleanPath) 
      ? cleanPath 
      : path.resolve(basePath, cleanPath);
    
    try {
      if (fs.existsSync(fullPath)) {
        const content = fs.readFileSync(fullPath, 'utf-8');
        const newBasePath = path.dirname(fullPath);
        return processIncludes(content, newBasePath, depth + 1);
      }
      return `<!-- Include not found: ${cleanPath} -->`;
    } catch (err) {
      return `<!-- Include error: ${err.message} -->`;
    }
  });
};

const getGitInfo = (filePath = null) => {
  try {
    const cwd = filePath ? path.dirname(filePath) : process.cwd();
    
    const commitHash = execSync('git rev-parse --short HEAD', { cwd, encoding: 'utf-8' }).trim();
    const branch = execSync('git rev-parse --abbrev-ref HEAD', { cwd, encoding: 'utf-8' }).trim();
    const commitDate = execSync('git log -1 --format=%ci', { cwd, encoding: 'utf-8' }).trim();
    const authorName = execSync('git log -1 --format=%an', { cwd, encoding: 'utf-8' }).trim();
    
    let dirty = false;
    try {
      execSync('git diff --quiet HEAD', { cwd });
    } catch {
      dirty = true;
    }
    
    return {
      commitHash,
      branch,
      commitDate: new Date(commitDate).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      }),
      authorName,
      dirty,
      available: true
    };
  } catch (err) {
    return {
      available: false,
      error: err.message
    };
  }
};

module.exports = {
  parseMarkdown,
  extractMermaidBlocks,
  extractFrontmatter,
  processIncludes,
  getMarkdownStats,
  getGitInfo,
  setParserOptions
};
