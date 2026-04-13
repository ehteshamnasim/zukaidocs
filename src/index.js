/**
 * md2pdf - Main Library Module
 * 
 * Markdown to PDF converter with Mermaid diagram support.
 * Provides both high-level API and low-level access to all modules.
 * 
 * Features:
 *   - YAML frontmatter support for per-file configuration
 *   - Custom CSS injection
 *   - PDF bookmarks/outline
 *   - Configurable page numbers
 * 
 * High-level API:
 *   markdownToPdfBuffer(markdown, options) - Convert to PDF buffer
 *   markdownToHtml(markdown, options)      - Convert to HTML string
 * 
 * Low-level access:
 *   parseMarkdown, renderToHtml, generatePdf, resolveConfig
 */

const { parseMarkdown, extractMermaidBlocks, extractFrontmatter, getMarkdownStats } = require('./parser');
const { renderToHtml, getMermaidScript } = require('./renderer');
const { generatePdf, generatePdfBuffer, PAGE_FORMATS } = require('./pdf');
const { resolveConfig, validateConfig, DEFAULT_CONFIG } = require('./config');
const { exportMermaidImages, exportMermaidImagesOnly, renderMermaidToPng } = require('./mermaid-export');

const markdownToPdfBuffer = async (markdown, options = {}) => {
  const config = resolveConfig(options);
  
  const htmlContent = parseMarkdown(markdown);
  const html = renderToHtml(htmlContent, {
    theme: config.theme,
    mermaidTheme: config.mermaidTheme,
    title: options.title || 'Document'
  });
  
  return generatePdfBuffer(html, {
    format: config.pageSize,
    margin: config.margins,
    printBackground: config.printBackground,
    timeout: config.timeout
  });
};

const markdownToHtml = (markdown, options = {}) => {
  const config = resolveConfig(options);
  
  const htmlContent = parseMarkdown(markdown);
  return renderToHtml(htmlContent, {
    theme: config.theme,
    mermaidTheme: config.mermaidTheme,
    title: options.title || 'Document'
  });
};

module.exports = {
  markdownToPdfBuffer,
  markdownToHtml,
  
  parseMarkdown,
  extractMermaidBlocks,
  extractFrontmatter,
  getMarkdownStats,
  
  renderToHtml,
  getMermaidScript,
  
  generatePdf,
  generatePdfBuffer,
  PAGE_FORMATS,
  
  resolveConfig,
  validateConfig,
  DEFAULT_CONFIG,
  
  // Mermaid export for GitBook compatibility
  exportMermaidImages,
  exportMermaidImagesOnly,
  renderMermaidToPng
};
