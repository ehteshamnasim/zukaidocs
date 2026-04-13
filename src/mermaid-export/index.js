/**
 * md2pdf - Mermaid Export Module
 * 
 * Exports Mermaid diagrams as PNG images for GitBook compatibility.
 * Features:
 *   - Extract all Mermaid blocks from markdown
 *   - Render each diagram to PNG using Puppeteer
 *   - Generate GitBook-compatible markdown with image references
 *   - Configurable output directory and naming
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

/**
 * Extract all mermaid code blocks from markdown content
 */
const extractMermaidBlocks = (markdown) => {
  const blocks = [];
  const regex = /```mermaid\n([\s\S]*?)```/g;
  let match;
  let index = 0;

  while ((match = regex.exec(markdown)) !== null) {
    blocks.push({
      fullMatch: match[0],
      code: match[1].trim(),
      index: index++,
      startPos: match.index,
      endPos: match.index + match[0].length
    });
  }

  return blocks;
};

/**
 * Parse Gantt chart to extract date range and calculate optimal dimensions
 */
const parseGanttMetrics = (mermaidCode) => {
  const taskCount = (mermaidCode.match(/^\s+\w.*:/gm) || []).length;
  const sectionCount = (mermaidCode.match(/section\s+/g) || []).length;
  
  // Extract all dates from the Gantt code
  const dateMatches = mermaidCode.match(/\d{4}-\d{2}-\d{2}/g) || [];
  const dates = dateMatches.map(d => new Date(d)).filter(d => !isNaN(d));
  
  // Also estimate dates from duration patterns like "7d", "2w"
  const durations = mermaidCode.match(/,\s*(\d+)([dwm])/g) || [];
  let totalDays = 0;
  durations.forEach(dur => {
    const match = dur.match(/(\d+)([dwm])/);
    if (match) {
      const num = parseInt(match[1]);
      const unit = match[2];
      if (unit === 'd') totalDays += num;
      else if (unit === 'w') totalDays += num * 7;
      else if (unit === 'm') totalDays += num * 30;
    }
  });
  
  // Calculate date range
  let daysSpan = totalDays || 30; // Default to 30 days
  if (dates.length >= 2) {
    const minDate = new Date(Math.min(...dates));
    const maxDate = new Date(Math.max(...dates));
    const explicitSpan = Math.ceil((maxDate - minDate) / (1000 * 60 * 60 * 24));
    daysSpan = Math.max(explicitSpan + totalDays, totalDays, 14);
  }
  
  const weeksSpan = Math.ceil(daysSpan / 7);
  
  return {
    taskCount,
    sectionCount,
    daysSpan,
    weeksSpan,
    isComplex: taskCount > 15 || weeksSpan > 20
  };
};

/**
 * Generate HTML for rendering a single Mermaid diagram
 */
const getMermaidRenderHtml = (mermaidCode, options = {}) => {
  const { theme = 'default', backgroundColor = 'white' } = options;
  
  // Detect diagram type for specific configurations
  const isGantt = /^\s*gantt/im.test(mermaidCode);
  const isSequence = /^\s*sequenceDiagram/im.test(mermaidCode);
  const isER = /^\s*erDiagram/im.test(mermaidCode);
  
  // Get Gantt metrics for dynamic sizing
  const ganttMetrics = isGantt ? parseGanttMetrics(mermaidCode) : null;
  const isComplexGantt = ganttMetrics?.isComplex || false;
  
  // Calculate optimal width based on timeline
  // Complex Gantts need more width for readability in PDF
  const pixelsPerWeek = isComplexGantt ? 180 : 120;
  const labelWidth = isComplexGantt ? 300 : 180;
  const ganttWidth = ganttMetrics 
    ? Math.max(isComplexGantt ? 1600 : 1000, labelWidth + (ganttMetrics.weeksSpan * pixelsPerWeek) + 150)
    : 800;
  
  // Gantt-specific settings
  const ganttConfig = isGantt ? `
    gantt: {
      useMaxWidth: false,
      barHeight: ${isComplexGantt ? 28 : 35},
      barGap: ${isComplexGantt ? 7 : 8},
      topPadding: 60,
      leftPadding: ${isComplexGantt ? 300 : 180},
      rightPadding: 80,
      gridLineStartPadding: 50,
      fontSize: 13,
      sectionFontSize: 14,
      numberSectionStyles: 4,
      tickInterval: '${ganttMetrics && ganttMetrics.weeksSpan > 12 ? '1month' : '1week'}',
      axisFormat: '${ganttMetrics && ganttMetrics.weeksSpan > 12 ? '%b %Y' : '%b %d'}'
    },` : `gantt: { useMaxWidth: true },`;
  
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <script src="https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { 
      background: ${backgroundColor}; 
      width: 100%;
      min-height: 100vh;
    }
    body {
      display: flex; 
      justify-content: flex-start;
      align-items: flex-start;
      padding: ${isGantt ? '40px 50px' : '20px'};
    }
    #container {
      display: block;
      ${isGantt ? `width: ${ganttWidth}px; min-width: ${ganttWidth}px;` : ''}
    }
    .mermaid {
      display: block;
      width: 100%;
    }
    .mermaid svg {
      max-width: none !important;
      overflow: visible !important;
    }
    /* Ensure Gantt title is visible and full width */
    .mermaid .titleText {
      font-size: 20px !important;
      font-weight: 600 !important;
    }
    /* Fix axis tick labels - ensure proper spacing */
    .mermaid .tick text {
      font-size: 11px !important;
    }
    /* Force dark text on all Gantt task bars for readability */
    .mermaid .taskText {
      fill: #1a1a1a !important;
      font-weight: 500 !important;
    }
    .mermaid .taskTextOutsideRight,
    .mermaid .taskTextOutsideLeft {
      fill: #1a1a1a !important;
    }
    /* Keep critical task text visible */
    .mermaid .task.crit .taskText,
    .mermaid .taskText.crit {
      fill: #ffffff !important;
      font-weight: 600 !important;
    }
  </style>
</head>
<body>
  <div id="container">
    <pre class="mermaid">${mermaidCode}</pre>
  </div>
  <script>
    mermaid.initialize({
      startOnLoad: true,
      theme: '${theme}',
      securityLevel: 'loose',
      fontFamily: 'Inter, system-ui, sans-serif',
      flowchart: { useMaxWidth: false, htmlLabels: true },
      sequence: { useMaxWidth: false, width: 150, height: 50 },
      ${ganttConfig}
      er: { useMaxWidth: false },
      pie: { useMaxWidth: false }
    });
    
    mermaid.run().then(() => {
      window.mermaidRendered = true;
    }).catch(err => {
      console.error('Mermaid error:', err);
      window.mermaidError = err.message || String(err);
      window.mermaidRendered = true;
    });
  </script>
</body>
</html>`;
};

/**
 * Render a single Mermaid diagram to PNG buffer
 */
const renderMermaidToPng = async (mermaidCode, options = {}) => {
  const { 
    theme = 'default', 
    backgroundColor = 'white',
    scale = 2,
    timeout = 30000 
  } = options;

  // Detect diagram type to adjust viewport
  const isGantt = /^\s*gantt/im.test(mermaidCode);
  const isSequence = /^\s*sequenceDiagram/im.test(mermaidCode);
  
  // Use dynamic Gantt metrics for precise viewport calculation
  const ganttMetrics = isGantt ? parseGanttMetrics(mermaidCode) : null;
  const isComplexGantt = ganttMetrics?.isComplex || false;
  
  // Calculate viewport based on actual timeline
  let viewportWidth = 1200;
  let viewportHeight = 800;
  
  if (isGantt && ganttMetrics) {
    // Match the width calculation from getMermaidRenderHtml
    const pixelsPerWeek = isComplexGantt ? 180 : 120;
    const labelWidth = isComplexGantt ? 300 : 180;
    viewportWidth = Math.max(isComplexGantt ? 1800 : 1200, labelWidth + (ganttMetrics.weeksSpan * pixelsPerWeek) + 200);
    // Increase height: more space per task and section for taller bars
    viewportHeight = Math.max(600, 250 + (ganttMetrics.taskCount * 45) + (ganttMetrics.sectionCount * 50));
  } else if (isSequence) {
    viewportWidth = 1600;
  }

  let browser;
  
  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage'
      ]
    });

    const page = await browser.newPage();
    
    await page.setViewport({
      width: viewportWidth,
      height: viewportHeight,
      deviceScaleFactor: scale
    });

    const html = getMermaidRenderHtml(mermaidCode, { theme, backgroundColor });
    
    await page.setContent(html, {
      waitUntil: ['networkidle0', 'domcontentloaded'],
      timeout
    });

    // Wait for Mermaid to render
    await page.waitForFunction(() => window.mermaidRendered === true, { timeout });
    
    // Check for errors
    const mermaidError = await page.evaluate(() => window.mermaidError);
    if (mermaidError) {
      throw new Error(`Mermaid rendering error: ${mermaidError}`);
    }

    // Small delay to ensure SVG is fully rendered
    await page.evaluate(() => new Promise(r => setTimeout(r, 300)));

    // Get the bounding box of the rendered diagram
    const element = await page.$('#container');
    if (!element) {
      throw new Error('Could not find rendered diagram');
    }

    const boundingBox = await element.boundingBox();
    if (!boundingBox) {
      throw new Error('Could not get diagram dimensions');
    }

    // Add some padding
    const padding = 20;
    const clip = {
      x: Math.max(0, boundingBox.x - padding),
      y: Math.max(0, boundingBox.y - padding),
      width: boundingBox.width + (padding * 2),
      height: boundingBox.height + (padding * 2)
    };

    // Capture screenshot
    const pngBuffer = await page.screenshot({
      type: 'png',
      clip,
      omitBackground: backgroundColor === 'transparent'
    });

    return {
      buffer: pngBuffer,
      width: clip.width,
      height: clip.height
    };

  } finally {
    if (browser) {
      await browser.close();
    }
  }
};

/**
 * Generate a safe filename from diagram content
 */
const generateDiagramName = (code, index) => {
  // Try to extract diagram type
  const typeMatch = code.match(/^(flowchart|sequenceDiagram|classDiagram|stateDiagram|erDiagram|gantt|pie|journey|gitGraph|mindmap|timeline)/m);
  const type = typeMatch ? typeMatch[1].toLowerCase() : 'diagram';
  
  // Try to extract title or first meaningful identifier
  const titleMatch = code.match(/title\s+([^\n]+)/i);
  const title = titleMatch ? titleMatch[1].trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 30) : null;
  
  if (title) {
    return `${type}-${title}-${index + 1}`;
  }
  
  return `${type}-${index + 1}`;
};

/**
 * Export all Mermaid diagrams from a markdown file to PNG images
 * Returns the transformed markdown with image references
 */
const exportMermaidImages = async (inputPath, options = {}, progressCallback = null) => {
  const {
    outputDir = null,
    imageDir = 'images',
    theme = 'default',
    backgroundColor = 'white',
    scale = 2,
    prefix = '',
    format = 'png'
  } = options;

  const absoluteInput = path.resolve(inputPath);
  const inputDir = path.dirname(absoluteInput);
  const inputName = path.basename(inputPath, path.extname(inputPath));
  
  // Read markdown content
  const markdown = fs.readFileSync(absoluteInput, 'utf-8');
  
  // Extract all mermaid blocks
  const blocks = extractMermaidBlocks(markdown);
  
  if (blocks.length === 0) {
    return {
      success: true,
      inputPath: absoluteInput,
      outputMarkdown: null,
      imagesExported: 0,
      message: 'No Mermaid diagrams found'
    };
  }

  // Determine output directory for images
  const imagesOutputDir = outputDir 
    ? path.resolve(outputDir, imageDir)
    : path.join(inputDir, imageDir);

  // Create images directory if it doesn't exist
  if (!fs.existsSync(imagesOutputDir)) {
    fs.mkdirSync(imagesOutputDir, { recursive: true });
  }

  const results = [];
  let transformedMarkdown = markdown;
  
  // Process each diagram (in reverse order to maintain string positions)
  for (let i = blocks.length - 1; i >= 0; i--) {
    const block = blocks[i];
    const diagramName = prefix + generateDiagramName(block.code, block.index);
    const imagePath = path.join(imagesOutputDir, `${diagramName}.${format}`);
    const relativeImagePath = path.relative(inputDir, imagePath).replace(/\\/g, '/');
    
    if (progressCallback) {
      progressCallback({
        current: blocks.length - i,
        total: blocks.length,
        diagramName,
        status: 'rendering'
      });
    }

    try {
      // Render diagram to PNG
      const result = await renderMermaidToPng(block.code, {
        theme,
        backgroundColor,
        scale
      });

      // Save the PNG file
      fs.writeFileSync(imagePath, result.buffer);

      // Generate image markdown reference
      // Extract a caption from the diagram if possible
      const caption = diagramName.replace(/-/g, ' ').replace(/^\w/, c => c.toUpperCase());
      const imageMarkdown = `![${caption}](./${relativeImagePath})`;

      // Replace mermaid block with image reference
      transformedMarkdown = 
        transformedMarkdown.slice(0, block.startPos) +
        imageMarkdown +
        transformedMarkdown.slice(block.endPos);

      results.push({
        index: block.index,
        name: diagramName,
        imagePath,
        relativeImagePath,
        width: result.width,
        height: result.height,
        success: true
      });

    } catch (error) {
      results.push({
        index: block.index,
        name: diagramName,
        error: error.message,
        success: false
      });
      
      // Keep the original mermaid block if rendering fails
      // (or optionally add an error comment)
      const errorComment = `<!-- Mermaid export failed: ${error.message} -->\n${block.fullMatch}`;
      transformedMarkdown = 
        transformedMarkdown.slice(0, block.startPos) +
        errorComment +
        transformedMarkdown.slice(block.endPos);
    }
  }

  // Determine output markdown path
  const outputMarkdownPath = outputDir
    ? path.join(path.resolve(outputDir), `${inputName}-gitbook.md`)
    : path.join(inputDir, `${inputName}-gitbook.md`);

  // Write the transformed markdown
  fs.writeFileSync(outputMarkdownPath, transformedMarkdown);

  const successCount = results.filter(r => r.success).length;
  const failCount = results.filter(r => !r.success).length;

  return {
    success: failCount === 0,
    inputPath: absoluteInput,
    outputMarkdownPath,
    imagesDir: imagesOutputDir,
    imagesExported: successCount,
    imagesFailed: failCount,
    results: results.reverse(), // Return in original order
    message: failCount === 0 
      ? `Exported ${successCount} diagram(s) successfully`
      : `Exported ${successCount} diagram(s), ${failCount} failed`
  };
};

/**
 * Export mermaid diagrams to individual PNG files only (no markdown modification)
 */
const exportMermaidImagesOnly = async (inputPath, options = {}, progressCallback = null) => {
  const {
    outputDir = null,
    imageDir = 'images',
    theme = 'default',
    backgroundColor = 'white',
    scale = 2,
    prefix = ''
  } = options;

  const absoluteInput = path.resolve(inputPath);
  const inputDir = path.dirname(absoluteInput);
  
  const markdown = fs.readFileSync(absoluteInput, 'utf-8');
  const blocks = extractMermaidBlocks(markdown);
  
  if (blocks.length === 0) {
    return {
      success: true,
      imagesExported: 0,
      message: 'No Mermaid diagrams found'
    };
  }

  const imagesOutputDir = outputDir 
    ? path.resolve(outputDir, imageDir)
    : path.join(inputDir, imageDir);

  if (!fs.existsSync(imagesOutputDir)) {
    fs.mkdirSync(imagesOutputDir, { recursive: true });
  }

  const results = [];

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    const diagramName = prefix + generateDiagramName(block.code, block.index);
    const imagePath = path.join(imagesOutputDir, `${diagramName}.png`);

    if (progressCallback) {
      progressCallback({
        current: i + 1,
        total: blocks.length,
        diagramName,
        status: 'rendering'
      });
    }

    try {
      const result = await renderMermaidToPng(block.code, {
        theme,
        backgroundColor,
        scale
      });

      fs.writeFileSync(imagePath, result.buffer);

      results.push({
        index: block.index,
        name: diagramName,
        imagePath,
        success: true
      });

    } catch (error) {
      results.push({
        index: block.index,
        name: diagramName,
        error: error.message,
        success: false
      });
    }
  }

  const successCount = results.filter(r => r.success).length;

  return {
    success: results.every(r => r.success),
    imagesDir: imagesOutputDir,
    imagesExported: successCount,
    imagesFailed: results.length - successCount,
    results
  };
};

module.exports = {
  extractMermaidBlocks,
  renderMermaidToPng,
  exportMermaidImages,
  exportMermaidImagesOnly,
  generateDiagramName
};
