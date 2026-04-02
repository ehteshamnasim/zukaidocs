/**
 * md2pdf - Document Features Module
 * 
 * Provides professional document features for PDF generation.
 * Features:
 *   - Cover page with logo, title, author, and metadata
 *   - Table of Contents with numbered sections and linking
 *   - Watermarks (text or image) with configurable opacity
 *   - KaTeX math equation rendering support
 *   - Header/footer templates with page numbers
 */

const extractHeadings = (html) => {
  const headings = [];
  const regex = /<h([1-6])[^>]*>(.*?)<\/h\1>/gi;
  let match;
  let index = 0;

  while ((match = regex.exec(html)) !== null) {
    const level = parseInt(match[1]);
    const text = match[2].replace(/<[^>]+>/g, '').trim(); // Strip inner HTML tags
    const id = `heading-${index}`;
    
    headings.push({
      level,
      text,
      id,
      index: index++
    });
  }

  return headings;
};

const addHeadingIds = (html) => {
  let index = 0;
  return html.replace(/<h([1-6])([^>]*)>/gi, (match, level, attrs) => {
    const id = `heading-${index++}`;
    if (attrs.includes('id=')) {
      return match;
    }
    return `<h${level}${attrs} id="${id}">`;
  });
};

const generateTOC = (headings, options = {}) => {
  const {
    title = 'Table of Contents',
    maxLevel = 3,
    numbered = true
  } = options;

  if (headings.length === 0) {
    return '';
  }

  const filteredHeadings = headings.filter(h => h.level <= maxLevel);
  
  if (filteredHeadings.length === 0) {
    return '';
  }

  const counters = [0, 0, 0, 0, 0, 0];
  
  const items = filteredHeadings.map(heading => {
    if (numbered) {
      counters[heading.level - 1]++;
      for (let i = heading.level; i < 6; i++) {
        counters[i] = 0;
      }
    }
    
    let prefix = '';
    if (numbered) {
      const parts = counters.slice(0, heading.level).filter(n => n > 0);
      prefix = parts.join('.');
    }
    
    const indent = (heading.level - 1) * 24;
    
    return `
      <div class="toc-item toc-level-${heading.level}" style="padding-left: ${indent}px;">
        <a href="#${heading.id}">
          <span class="toc-number">${prefix}</span>
          <span class="toc-text">${heading.text}</span>
        </a>
      </div>
    `;
  }).join('');

  return `
    <div class="toc-container">
      <h2 class="toc-title">${title}</h2>
      <nav class="toc-nav">
        ${items}
      </nav>
    </div>
    <div class="page-break"></div>
  `;
};

const generateCoverPage = (options = {}) => {
  const {
    title = 'Document Title',
    subtitle = '',
    author = '',
    date = new Date().toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    }),
    logo = '',
    version = '',
    organization = '',
    confidential = false
  } = options;

  const logoHtml = logo ? `<img src="${logo}" alt="Logo" class="cover-logo" />` : '';
  
  const confidentialHtml = confidential ? `
    <div class="cover-badge">CONFIDENTIAL</div>
  ` : '';

  const subtitleHtml = subtitle ? `<div class="cover-subtitle">${subtitle}</div>` : '';
  const versionHtml = version ? `<span class="cover-version">v${version}</span>` : '';
  const authorHtml = author ? `<div class="cover-author">Prepared by: <strong>${author}</strong></div>` : '';
  const orgHtml = organization ? `<div class="cover-org">${organization}</div>` : '';

  return `
    <div class="cover-page">
      <div class="cover-accent"></div>
      ${confidentialHtml}
      <div class="cover-content">
        ${logoHtml}
        <h1 class="cover-title">${title}</h1>
        ${subtitleHtml}
        ${versionHtml}
      </div>
      <div class="cover-bottom">
        ${authorHtml}
        <div class="cover-date">${date}</div>
        ${orgHtml}
      </div>
    </div>
    <div class="page-break"></div>
  `;
};

const generateWatermark = (options = {}) => {
  const {
    text = '',
    image = '',
    opacity = 0.08,
    rotation = -45,
    fontSize = '120px',
    color = '#cbd5e1'
  } = options;

  if (!text && !image) {
    return '';
  }

  if (image) {
    return `
      .watermark {
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%) rotate(${rotation}deg);
        opacity: ${opacity};
        z-index: -1;
        pointer-events: none;
      }
      .watermark img {
        max-width: 400px;
        max-height: 400px;
      }
    `;
  }

  return `
    .watermark-text {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%) rotate(${rotation}deg);
      font-size: ${fontSize};
      color: ${color};
      opacity: ${opacity};
      z-index: 9999;
      pointer-events: none;
      white-space: nowrap;
      font-weight: bold;
      letter-spacing: 8px;
      text-transform: uppercase;
    }
    
    @media print {
      .watermark-text {
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%) rotate(${rotation}deg);
        font-size: ${fontSize};
        color: ${color};
        opacity: ${opacity};
        z-index: 9999;
        pointer-events: none;
        white-space: nowrap;
        font-weight: bold;
        letter-spacing: 8px;
      }
    }
  `;
};

const generateWatermarkHtml = (options = {}) => {
  const { image = '', text = '' } = options;
  
  if (image) {
    return `<div class="watermark"><img src="${image}" alt="Watermark" /></div>`;
  }
  
  if (text) {
    return `<div class="watermark-text">${text}</div>`;
  }
  
  return '';
};

const getKatexIncludes = () => {
  return `
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css">
    <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js"></script>
    <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/contrib/auto-render.min.js"></script>
    <script>
      document.addEventListener("DOMContentLoaded", function() {
        if (typeof renderMathInElement !== 'undefined') {
          renderMathInElement(document.body, {
            delimiters: [
              {left: '$$', right: '$$', display: true},
              {left: '$', right: '$', display: false},
              {left: '\\\\[', right: '\\\\]', display: true},
              {left: '\\\\(', right: '\\\\)', display: false}
            ],
            throwOnError: false
          });
        }
      });
    </script>
  `;
};

const generateHeaderFooter = (options = {}) => {
  const {
    headerLeft = '',
    headerCenter = '',
    headerRight = '',
    footerLeft = '',
    footerCenter = '<span class="pageNumber"></span> / <span class="totalPages"></span>',
    footerRight = '',
    showPageNumbers = true,
    documentTitle = '',
    fontSize = '9px',
    color = '#666666'
  } = options;

  const baseStyle = `
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    font-size: ${fontSize};
    color: ${color};
    width: 100%;
    padding: 10px 40px;
    box-sizing: border-box;
  `;

  const headerTemplate = (headerLeft || headerCenter || headerRight) ? `
    <div style="${baseStyle} display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #e0e0e0; margin-bottom: 10px;">
      <span style="flex: 1; text-align: left;">${headerLeft || documentTitle}</span>
      <span style="flex: 1; text-align: center;">${headerCenter}</span>
      <span style="flex: 1; text-align: right;">${headerRight}</span>
    </div>
  ` : '<span></span>';

  const footerTemplate = `
    <div style="${baseStyle} display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #e0e0e0; padding-top: 10px;">
      <span style="flex: 1; text-align: left;">${footerLeft}</span>
      <span style="flex: 1; text-align: center;">${showPageNumbers ? footerCenter : ''}</span>
      <span style="flex: 1; text-align: right;">${footerRight}</span>
    </div>
  `;

  return { headerTemplate, footerTemplate };
};

const getFeatureCSS = () => {
  return `
    /* Page Break */
    .page-break {
      page-break-after: always;
      break-after: page;
      height: 0;
      margin: 0;
      padding: 0;
    }

    /* Mermaid Diagrams - Prevent Page Breaks */
    .mermaid-wrapper {
      page-break-inside: avoid;
      break-inside: avoid;
      margin: 1em 0;
    }
    
    .mermaid {
      page-break-inside: avoid;
      break-inside: avoid;
      display: block;
      margin: 0 auto;
      overflow: visible;
    }
    
    .mermaid svg {
      max-width: 100%;
      height: auto;
    }

    /* Cover Page - Clean Professional Design */
    .cover-page {
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      position: relative;
      background: #ffffff;
      padding: 0;
    }

    .cover-accent {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 8px;
      background: linear-gradient(90deg, var(--color-primary, #22626a) 0%, #3d8a94 100%);
    }

    .cover-badge {
      position: absolute;
      top: 40px;
      right: 40px;
      background: #dc2626;
      color: white;
      padding: 6px 16px;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 2px;
      border-radius: 3px;
    }

    .cover-content {
      flex: 1;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      padding: 80px 60px;
      text-align: center;
    }

    .cover-logo {
      max-width: 200px;
      max-height: 80px;
      margin-bottom: 60px;
      object-fit: contain;
    }

    .cover-title {
      font-size: 2.8em;
      font-weight: 700;
      color: var(--color-primary, #22626a);
      margin: 0 0 16px 0;
      border: none;
      padding: 0;
      line-height: 1.2;
    }

    .cover-subtitle {
      font-size: 1.3em;
      color: #64748b;
      margin: 0 0 24px 0;
      font-weight: 400;
    }

    .cover-version {
      display: inline-block;
      background: #f1f5f9;
      color: #475569;
      padding: 6px 16px;
      font-size: 0.85em;
      font-weight: 600;
      border-radius: 20px;
      font-family: var(--font-mono, monospace);
    }

    .cover-bottom {
      padding: 40px 60px;
      border-top: 1px solid #e2e8f0;
      text-align: center;
    }

    .cover-author {
      font-size: 0.95em;
      color: #475569;
      margin-bottom: 8px;
    }

    .cover-author strong {
      color: #1e293b;
    }

    .cover-date {
      font-size: 0.9em;
      color: #94a3b8;
      margin-bottom: 12px;
    }

    .cover-org {
      font-size: 1em;
      color: var(--color-primary, #22626a);
      font-weight: 600;
    }

    /* Table of Contents - Professional Design */
    .toc-container {
      padding: 40px 0;
      max-width: 100%;
    }

    .toc-title {
      font-size: 2em;
      font-weight: 700;
      margin-bottom: 40px;
      color: var(--color-primary, #22626a);
      text-align: center;
      position: relative;
    }

    .toc-title::after {
      content: '';
      display: block;
      width: 60px;
      height: 3px;
      background: var(--color-primary, #22626a);
      margin: 15px auto 0;
      border-radius: 2px;
    }

    .toc-nav {
      line-height: 1.5;
      max-width: 550px;
      margin: 0 auto;
    }

    .toc-item {
      margin: 0;
    }

    .toc-item a {
      color: var(--color-text, #1e293b);
      text-decoration: none;
      display: flex;
      align-items: baseline;
      padding: 10px 0;
      transition: color 0.2s;
      border-bottom: 1px solid #f1f5f9;
    }

    .toc-item:last-child a {
      border-bottom: none;
    }

    .toc-item a:hover {
      color: var(--color-primary, #22626a);
    }

    .toc-item a:hover .toc-number {
      transform: translateX(3px);
    }

    .toc-number {
      font-weight: 700;
      color: var(--color-primary, #22626a);
      min-width: 40px;
      font-size: 0.85em;
      transition: transform 0.2s;
    }

    .toc-text {
      flex: 1;
    }

    .toc-level-1 {
      font-weight: 600;
      font-size: 1em;
    }

    .toc-level-1 a {
      padding: 12px 0;
    }

    .toc-level-1 .toc-number {
      font-size: 0.9em;
    }

    .toc-level-2 {
      font-size: 0.92em;
    }

    .toc-level-2 a {
      padding: 9px 0;
    }

    .toc-level-3 {
      font-size: 0.85em;
      color: #64748b;
    }

    .toc-level-3 a {
      padding: 7px 0;
    }

    .toc-level-3 .toc-number {
      color: #64748b;
    }

    /* KaTeX / Math */
    .katex-display {
      margin: 1em 0;
      overflow-x: auto;
      padding: 0.5em 0;
    }

    .katex {
      font-size: 1.1em;
    }

    /* Code Line Numbers */
    .code-block.with-line-numbers code {
      display: block;
      counter-reset: line;
    }
    
    .code-block.with-line-numbers .line-number {
      display: inline-block;
      width: 3em;
      padding-right: 1em;
      text-align: right;
      color: #6b7280;
      user-select: none;
      border-right: 1px solid #e5e7eb;
      margin-right: 1em;
    }
    
    .code-block.with-line-numbers .line-content {
      display: inline;
    }
    
    .code-block .code-lang {
      position: absolute;
      top: 8px;
      right: 12px;
      font-size: 0.7em;
      color: #9ca3af;
      text-transform: uppercase;
      font-weight: 600;
    }
    
    .code-block {
      position: relative;
    }

    /* Git Info Footer */
    .git-info {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #e5e7eb;
      font-size: 0.8em;
      color: #6b7280;
      display: flex;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 10px;
    }
    
    .git-info-item {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    
    .git-info-label {
      font-weight: 600;
      color: #374151;
    }
    
    .git-dirty {
      color: #f59e0b;
      font-size: 0.9em;
    }
  `;
};

const generateGitInfoFooter = (gitInfo) => {
  if (!gitInfo || !gitInfo.available) {
    return '';
  }
  
  const dirtyBadge = gitInfo.dirty ? '<span class="git-dirty">(modified)</span>' : '';
  
  return `
    <div class="git-info">
      <div class="git-info-item">
        <span class="git-info-label">Branch:</span>
        <span>${gitInfo.branch}</span>
      </div>
      <div class="git-info-item">
        <span class="git-info-label">Commit:</span>
        <span>${gitInfo.commitHash}</span>
        ${dirtyBadge}
      </div>
      <div class="git-info-item">
        <span class="git-info-label">Date:</span>
        <span>${gitInfo.commitDate}</span>
      </div>
      <div class="git-info-item">
        <span class="git-info-label">Author:</span>
        <span>${gitInfo.authorName}</span>
      </div>
    </div>
  `;
};

const CODE_THEMES = {
  github: `
    .hljs { background: #f6f8fa; color: #24292e; }
    .hljs-comment, .hljs-quote { color: #6a737d; }
    .hljs-keyword, .hljs-selector-tag { color: #d73a49; }
    .hljs-string, .hljs-attr { color: #032f62; }
    .hljs-number, .hljs-literal { color: #005cc5; }
    .hljs-function .hljs-title { color: #6f42c1; }
    .hljs-built_in { color: #005cc5; }
  `,
  monokai: `
    .hljs { background: #272822; color: #f8f8f2; }
    .hljs-comment, .hljs-quote { color: #75715e; }
    .hljs-keyword, .hljs-selector-tag { color: #f92672; }
    .hljs-string, .hljs-attr { color: #e6db74; }
    .hljs-number, .hljs-literal { color: #ae81ff; }
    .hljs-function .hljs-title { color: #a6e22e; }
    .hljs-built_in { color: #66d9ef; }
  `,
  dracula: `
    .hljs { background: #282a36; color: #f8f8f2; }
    .hljs-comment, .hljs-quote { color: #6272a4; }
    .hljs-keyword, .hljs-selector-tag { color: #ff79c6; }
    .hljs-string, .hljs-attr { color: #f1fa8c; }
    .hljs-number, .hljs-literal { color: #bd93f9; }
    .hljs-function .hljs-title { color: #50fa7b; }
    .hljs-built_in { color: #8be9fd; }
  `,
  'one-dark': `
    .hljs { background: #282c34; color: #abb2bf; }
    .hljs-comment, .hljs-quote { color: #5c6370; }
    .hljs-keyword, .hljs-selector-tag { color: #c678dd; }
    .hljs-string, .hljs-attr { color: #98c379; }
    .hljs-number, .hljs-literal { color: #d19a66; }
    .hljs-function .hljs-title { color: #61afef; }
    .hljs-built_in { color: #e5c07b; }
  `,
  'github-dark': `
    .hljs { background: #0d1117; color: #c9d1d9; }
    .hljs-comment, .hljs-quote { color: #8b949e; }
    .hljs-keyword, .hljs-selector-tag { color: #ff7b72; }
    .hljs-string, .hljs-attr { color: #a5d6ff; }
    .hljs-number, .hljs-literal { color: #79c0ff; }
    .hljs-function .hljs-title { color: #d2a8ff; }
    .hljs-built_in { color: #79c0ff; }
  `
};

const getCodeThemeCSS = (themeName = 'github') => {
  return CODE_THEMES[themeName] || CODE_THEMES.github;
};

module.exports = {
  extractHeadings,
  addHeadingIds,
  generateTOC,
  generateCoverPage,
  generateWatermark,
  generateWatermarkHtml,
  generateHeaderFooter,
  generateGitInfoFooter,
  getKatexIncludes,
  getFeatureCSS,
  getCodeThemeCSS,
  CODE_THEMES
};
