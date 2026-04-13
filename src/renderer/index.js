/**
 * md2pdf - HTML Renderer Module
 * 
 * Renders complete HTML documents from parsed Markdown content.
 * Features:
 *   - Theme-based styling with automatic fallback
 *   - Mermaid diagram initialization with custom configuration
 *   - Cover page, TOC, and watermark integration
 *   - KaTeX math equation support
 *   - Code syntax themes (github, monokai, dracula, etc.)
 *   - Git info footer
 *   - Local image embedding as base64
 */

const fs = require('fs');
const path = require('path');
const {
  extractHeadings,
  addHeadingIds,
  generateTOC,
  generateCoverPage,
  generateWatermark,
  generateWatermarkHtml,
  generateGitInfoFooter,
  getKatexIncludes,
  getFeatureCSS,
  getCodeThemeCSS
} = require('../features');

/**
 * Convert local image references in HTML to base64 data URIs
 * This ensures images work in Puppeteer's setContent() which doesn't resolve file:// URLs
 */
const embedLocalImages = (html, basePath) => {
  // Match img tags with src attributes
  const imgRegex = /<img([^>]*?)src=["']([^"']+)["']([^>]*?)>/gi;
  
  return html.replace(imgRegex, (match, before, src, after) => {
    // Skip data URIs and remote URLs
    if (src.startsWith('data:') || src.startsWith('http://') || src.startsWith('https://')) {
      return match;
    }
    
    // Resolve the image path
    let imagePath;
    if (src.startsWith('/')) {
      imagePath = src;
    } else if (src.startsWith('./') || src.startsWith('../') || !src.includes('://')) {
      imagePath = path.resolve(basePath, src);
    } else {
      return match; // Unknown format, leave as is
    }
    
    // Check if file exists and embed as base64
    try {
      if (fs.existsSync(imagePath)) {
        const imageBuffer = fs.readFileSync(imagePath);
        const ext = path.extname(imagePath).toLowerCase();
        const mimeTypes = {
          '.png': 'image/png',
          '.jpg': 'image/jpeg',
          '.jpeg': 'image/jpeg',
          '.gif': 'image/gif',
          '.webp': 'image/webp',
          '.svg': 'image/svg+xml'
        };
        const mimeType = mimeTypes[ext] || 'image/png';
        const base64 = imageBuffer.toString('base64');
        return `<img${before}src="data:${mimeType};base64,${base64}"${after}>`;
      }
    } catch (err) {
      console.warn(`Warning: Could not embed image ${imagePath}: ${err.message}`);
    }
    
    return match;
  });
};

const getMermaidScript = (options = {}) => {
  const {
    theme = 'default',
    fontFamily = 'Inter, system-ui, sans-serif',
    mermaidScale = 'auto',
    mermaidMaxHeight = null
  } = options;

  const scaleSettings = {
    small: { fontSize: 11, nodeSpacing: 30, rankSpacing: 30 },
    medium: { fontSize: 13, nodeSpacing: 40, rankSpacing: 40 },
    large: { fontSize: 15, nodeSpacing: 50, rankSpacing: 50 },
    auto: { fontSize: 13, nodeSpacing: 40, rankSpacing: 40 }
  };
  
  const scale = scaleSettings[mermaidScale] || scaleSettings.auto;

  return `
    <script src="https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js"></script>
    <script>
      (function() {
        window.mermaidRenderState = {
          total: 0,
          rendered: 0,
          errors: []
        };

        const handleMermaidError = (error, id) => {
          console.error('Mermaid error in diagram ' + id + ':', error);
          window.mermaidRenderState.errors.push({ id, error: error.message || String(error) });
          
          const element = document.getElementById(id);
          if (element) {
            element.innerHTML = '<div class="mermaid-error">' +
              '<strong>Diagram Error</strong><br>' +
              '<code>' + (error.message || String(error)) + '</code>' +
              '</div>';
          }
        };

        mermaid.initialize({
          startOnLoad: false,
          theme: '${theme}',
          securityLevel: 'loose',
          fontFamily: '${fontFamily}',
          logLevel: 'error',
          maxTextSize: 90000,
          fontSize: ${scale.fontSize},
          flowchart: {
            useMaxWidth: true,
            htmlLabels: true,
            curve: 'basis',
            padding: 12,
            nodeSpacing: ${scale.nodeSpacing},
            rankSpacing: ${scale.rankSpacing},
            diagramPadding: 10
          },
          sequence: {
            useMaxWidth: true,
            diagramMarginX: 20,
            diagramMarginY: 10,
            actorMargin: 50,
            boxMargin: 10,
            boxTextMargin: 5,
            noteMargin: 10,
            messageMargin: 30,
            width: 140,
            height: 40
          },
          gantt: {
            useMaxWidth: false,
            barHeight: 24,
            barGap: 6,
            topPadding: 50,
            leftPadding: 260,
            rightPadding: 80,
            gridLineStartPadding: 40,
            fontSize: 13,
            sectionFontSize: 13,
            numberSectionStyles: 4,
            tickInterval: '1week'
          },
          pie: {
            useMaxWidth: true,
            textPosition: 0.7
          },
          er: {
            useMaxWidth: true,
            layoutDirection: 'TB',
            minEntityWidth: 90,
            minEntityHeight: 50,
            entityPadding: 12,
            fontSize: ${scale.fontSize}
          },
          state: {
            useMaxWidth: true,
            dividerMargin: 8,
            sizeUnit: 5,
            padding: 8,
            textHeight: 10,
            titleShift: -10,
            noteMargin: 8,
            forkWidth: 50,
            forkHeight: 7,
            miniPadding: 2,
            fontSize: ${scale.fontSize},
            labelHeight: 14,
            radius: 4
          },
          class: {
            useMaxWidth: true,
            defaultRenderer: 'dagre-wrapper'
          }
        });

        document.addEventListener('DOMContentLoaded', async () => {
          const diagrams = document.querySelectorAll('.mermaid');
          window.mermaidRenderState.total = diagrams.length;

          if (diagrams.length === 0) {
            window.mermaidRendered = true;
            return;
          }

          const maxHeight = ${mermaidMaxHeight || 'null'};
          const pageHeight = 900;

          try {
            for (const diagram of diagrams) {
              const id = diagram.id || 'mermaid-' + Math.random().toString(36).substr(2, 9);
              diagram.id = id;
              
              try {
                const graphDefinition = diagram.textContent;
                const containerWidth = diagram.parentElement ? diagram.parentElement.offsetWidth : 700;
                const { svg } = await mermaid.render(id + '-svg', graphDefinition);
                diagram.innerHTML = svg;
                
                const svgEl = diagram.querySelector('svg');
                if (svgEl) {
                  svgEl.style.maxWidth = '100%';
                  svgEl.style.height = 'auto';
                  svgEl.style.display = 'block';
                  
                  // Auto-scale if diagram is too tall
                  const svgHeight = svgEl.getBoundingClientRect().height;
                  const effectiveMaxHeight = maxHeight || pageHeight * 0.7;
                  
                  if ('${mermaidScale}' === 'auto' && svgHeight > effectiveMaxHeight) {
                    const scaleFactor = effectiveMaxHeight / svgHeight;
                    svgEl.style.transform = 'scale(' + scaleFactor + ')';
                    svgEl.style.transformOrigin = 'top left';
                    diagram.style.height = (svgHeight * scaleFactor) + 'px';
                    diagram.style.overflow = 'hidden';
                  }
                }
                
                window.mermaidRenderState.rendered++;
              } catch (err) {
                handleMermaidError(err, id);
                window.mermaidRenderState.rendered++;
              }
            }
          } catch (globalErr) {
            console.error('Global Mermaid rendering error:', globalErr);
          }

          window.mermaidRendered = true;
        });
      })();
    </script>
  `;
};

const loadTheme = (themeName) => {
  const themePath = path.join(__dirname, '..', 'themes', `${themeName}.css`);
  
  if (fs.existsSync(themePath)) {
    return fs.readFileSync(themePath, 'utf-8');
  }
  
  const fallbackPath = path.join(__dirname, '..', 'themes', 'github.css');
  if (fs.existsSync(fallbackPath)) {
    return fs.readFileSync(fallbackPath, 'utf-8');
  }
  
  console.warn(`Theme "${themeName}" not found, using inline fallback`);
  return getInlineFallbackCSS();
};

const getInlineFallbackCSS = () => `
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.6; }
  .container { max-width: 100%; }
`;

const renderToHtml = (content, options = {}) => {
  const {
    theme = 'github',
    title = 'Document',
    mermaidTheme = 'default',
    mermaidScale = 'auto',
    mermaidMaxHeight = null,
    codeTheme = 'github',
    coverPage = false,
    coverTitle = '',
    coverSubtitle = '',
    coverAuthor = '',
    coverLogo = '',
    coverOrganization = '',
    coverVersion = '',
    coverConfidential = false,
    toc = false,
    tocTitle = 'Table of Contents',
    tocMaxLevel = 3,
    watermark = '',
    watermarkOpacity = 0.08,
    watermarkRotation = -45,
    mathSupport = true,
    customCSS = '',
    gitInfo = null,
    basePath = process.cwd()
  } = options;

  const css = loadTheme(theme);
  const mermaidScript = getMermaidScript({ 
    theme: mermaidTheme,
    mermaidScale,
    mermaidMaxHeight
  });
  const featureCSS = getFeatureCSS();
  const codeThemeCSS = getCodeThemeCSS(codeTheme);
  const katexIncludes = mathSupport ? getKatexIncludes() : '';
  
  let customStyles = '';
  if (customCSS) {
    if (fs.existsSync(customCSS)) {
      customStyles = fs.readFileSync(customCSS, 'utf-8');
    } else {
      customStyles = customCSS;
    }
  }
  
  const watermarkCSS = watermark ? generateWatermark({
    text: watermark,
    opacity: watermarkOpacity,
    rotation: watermarkRotation
  }) : '';
  
  const watermarkHtml = generateWatermarkHtml({ text: watermark });
  const gitInfoHtml = gitInfo ? generateGitInfoFooter(gitInfo) : '';

  let coverHtml = '';
  if (coverPage) {
    coverHtml = generateCoverPage({
      title: coverTitle || title,
      subtitle: coverSubtitle,
      author: coverAuthor,
      logo: coverLogo,
      organization: coverOrganization,
      version: coverVersion,
      confidential: coverConfidential
    });
  }

  let processedContent = addHeadingIds(content);
  let tocHtml = '';
  
  if (toc) {
    const headings = extractHeadings(processedContent);
    tocHtml = generateTOC(headings, {
      title: tocTitle,
      maxLevel: tocMaxLevel
    });
  }

  // Embed local images as base64 for Puppeteer compatibility
  const contentWithEmbeddedImages = embedLocalImages(processedContent, basePath);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <base href="file://${basePath}/">
  <title>${title}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  ${katexIncludes}
  <style>
    ${css}
    ${featureCSS}
    ${codeThemeCSS}
    ${watermarkCSS}
    ${customStyles}
  </style>
  ${mermaidScript}
</head>
<body>
  ${watermarkHtml}
  ${coverHtml}
  ${tocHtml}
  <div class="container">
    ${contentWithEmbeddedImages}
    ${gitInfoHtml}
  </div>
</body>
</html>`;
};

module.exports = {
  renderToHtml,
  getMermaidScript,
  loadTheme,
  extractHeadings,
  addHeadingIds,
  embedLocalImages
};
