
const vscode = require('vscode');
const path = require('path');
const fs = require('fs');

let marked, hljs, matter, puppeteer;
let extensionPath;

function loadDependencies() {
  try {
    const markedModule = require('marked');
    if (typeof markedModule === 'function') {
      marked = markedModule;
    } else if (markedModule.marked) {
      marked = markedModule.marked;
    } else if (markedModule.parse) {
      marked = markedModule;
    } else {
      throw new Error('Unknown marked module format');
    }
    hljs = require('highlight.js');
    matter = require('gray-matter');
    console.log('md2pdf: Dependencies loaded successfully');
    console.log('md2pdf: marked type:', typeof marked, 'has parse:', typeof marked.parse);
    return true;
  } catch (e) {
    console.error('md2pdf: Failed to load dependencies:', e.message);
    return false;
  }
}

function activate(context) {
  console.log('md2pdf extension activated');
  extensionPath = context.extensionPath;
  
  if (!loadDependencies()) {
    vscode.window.showWarningMessage(
      'md2pdf: Dependencies not found. Run "npm install" in extension folder.',
      'Show Folder'
    ).then(action => {
      if (action === 'Show Folder') {
        vscode.env.openExternal(vscode.Uri.file(extensionPath));
      }
    });
  }

  const exportCommand = vscode.commands.registerCommand('md2pdf.exportToPdf', async (uri) => {
    await exportToPdf(uri);
  });

  const exportWithConfigCommand = vscode.commands.registerCommand('md2pdf.exportWithConfig', async (uri) => {
    await exportToPdfWithConfig(uri);
  });

  const createConfigCommand = vscode.commands.registerCommand('md2pdf.createConfig', async () => {
    await createConfigFile();
  });

  context.subscriptions.push(exportCommand, exportWithConfigCommand, createConfigCommand);

  const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBarItem.command = 'md2pdf.exportToPdf';
  statusBarItem.text = '$(file-pdf) PDF';
  statusBarItem.tooltip = 'Export to PDF (md2pdf)';
  context.subscriptions.push(statusBarItem);

  vscode.window.onDidChangeActiveTextEditor((editor) => {
    if (editor && editor.document.languageId === 'markdown') {
      statusBarItem.show();
    } else {
      statusBarItem.hide();
    }
  });

  if (vscode.window.activeTextEditor?.document.languageId === 'markdown') {
    statusBarItem.show();
  }
}

async function exportToPdf(uri) {
  try {
    let filePath;
    if (uri) {
      filePath = uri.fsPath;
    } else if (vscode.window.activeTextEditor) {
      filePath = vscode.window.activeTextEditor.document.uri.fsPath;
    } else {
      vscode.window.showErrorMessage('No Markdown file selected');
      return;
    }

    if (!filePath.endsWith('.md') && !filePath.endsWith('.markdown')) {
      vscode.window.showErrorMessage('Please select a Markdown file');
      return;
    }

    const config = vscode.workspace.getConfiguration('md2pdf');
    const options = getOptionsFromConfig(config, filePath);

    await convertToPdf(filePath, options);

  } catch (error) {
    vscode.window.showErrorMessage(`md2pdf error: ${error.message}`);
    console.error(error);
  }
}

async function exportToPdfWithConfig(uri) {
  try {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    const configFiles = [];

    if (workspaceFolder) {
      const configsPath = path.join(workspaceFolder.uri.fsPath, 'configs');
      if (fs.existsSync(configsPath)) {
        const files = fs.readdirSync(configsPath).filter(f => f.endsWith('.json'));
        files.forEach(f => configFiles.push({
          label: path.basename(f, '.json'),
          description: 'configs/' + f,
          path: path.join(configsPath, f)
        }));
      }

      const localConfig = path.join(workspaceFolder.uri.fsPath, 'md2pdf.config.json');
      if (fs.existsSync(localConfig)) {
        configFiles.unshift({
          label: 'md2pdf.config.json',
          description: 'Local config',
          path: localConfig
        });
      }
    }

    configFiles.unshift({
      label: 'VS Code Settings',
      description: 'Use extension settings',
      path: null
    });

    const selected = await vscode.window.showQuickPick(configFiles, {
      placeHolder: 'Select configuration'
    });

    if (!selected) return;

    let filePath;
    if (uri) {
      filePath = uri.fsPath;
    } else if (vscode.window.activeTextEditor) {
      filePath = vscode.window.activeTextEditor.document.uri.fsPath;
    } else {
      vscode.window.showErrorMessage('No Markdown file selected');
      return;
    }

    let options;
    if (selected.path) {
      const configContent = fs.readFileSync(selected.path, 'utf-8');
      options = JSON.parse(configContent);
      options.basePath = path.dirname(filePath);
    } else {
      const config = vscode.workspace.getConfiguration('md2pdf');
      options = getOptionsFromConfig(config, filePath);
    }

    await convertToPdf(filePath, options);

  } catch (error) {
    vscode.window.showErrorMessage(`md2pdf error: ${error.message}`);
    console.error(error);
  }
}

async function createConfigFile() {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    vscode.window.showErrorMessage('No workspace folder open');
    return;
  }

  const name = await vscode.window.showInputBox({
    prompt: 'Config name',
    placeHolder: 'my-config'
  });

  if (!name) return;

  const configsDir = path.join(workspaceFolder.uri.fsPath, 'configs');
  if (!fs.existsSync(configsDir)) {
    fs.mkdirSync(configsDir, { recursive: true });
  }

  const configPath = path.join(configsDir, `${name}.json`);
  const defaultConfig = {
    theme: 'professional',
    mermaidTheme: 'default',
    codeTheme: 'github',
    mermaidScale: 'auto',
    pageSize: 'A4',
    margins: { top: '0.6in', right: '0.6in', bottom: '0.6in', left: '0.6in' },
    coverPage: false,
    coverTitle: '',
    coverSubtitle: '',
    coverAuthor: '',
    coverOrganization: '',
    coverLogo: '',
    coverVersion: '',
    coverConfidential: false,
    toc: false,
    tocTitle: 'Table of Contents',
    tocMaxLevel: 3,
    watermark: '',
    watermarkOpacity: 0.08,
    showPageNumbers: true,
    pageNumberFormat: 'numeric',
    showLineNumbers: false,
    showGitInfo: false,
    mathSupport: true
  };

  fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2));
  
  const doc = await vscode.workspace.openTextDocument(configPath);
  await vscode.window.showTextDocument(doc);
  
  vscode.window.showInformationMessage(`Created config: configs/${name}.json`);
}

function getOptionsFromConfig(config, filePath) {
  return {
    theme: config.get('theme'),
    codeTheme: config.get('codeTheme'),
    mermaidTheme: config.get('mermaidTheme'),
    mermaidScale: config.get('mermaidScale'),
    pageSize: config.get('pageSize'),
    coverPage: config.get('coverPage'),
    coverTitle: config.get('coverTitle'),
    coverSubtitle: config.get('coverSubtitle'),
    coverAuthor: config.get('coverAuthor'),
    coverOrganization: config.get('coverOrganization'),
    coverLogo: config.get('coverLogo'),
    coverVersion: config.get('coverVersion'),
    coverConfidential: config.get('coverConfidential'),
    toc: config.get('toc'),
    tocMaxLevel: config.get('tocMaxLevel'),
    tocTitle: config.get('tocTitle'),
    watermark: config.get('watermark'),
    watermarkOpacity: config.get('watermarkOpacity'),
    showPageNumbers: config.get('showPageNumbers'),
    pageNumberFormat: config.get('pageNumberFormat'),
    showLineNumbers: config.get('showLineNumbers'),
    showGitInfo: config.get('showGitInfo'),
    mathSupport: config.get('mathSupport'),
    outputDirectory: config.get('outputDirectory'),
    basePath: path.dirname(filePath)
  };
}

async function convertToPdf(filePath, options) {
  if (!marked || !matter || !hljs) {
    if (!loadDependencies()) {
      vscode.window.showErrorMessage('md2pdf: Failed to load dependencies. Please reinstall the extension.');
      return;
    }
  }
  
  await vscode.window.withProgress({
    location: vscode.ProgressLocation.Notification,
    title: 'md2pdf',
    cancellable: false
  }, async (progress) => {
    
    progress.report({ message: 'Reading file...' });
    
    let markdown = fs.readFileSync(filePath, 'utf-8');
    
    let frontmatter = {};
    try {
      const parsed = matter(markdown);
      frontmatter = parsed.data || {};
      markdown = parsed.content || markdown;
      console.log('md2pdf: Frontmatter extracted:', Object.keys(frontmatter));
    } catch (e) {
      console.error('md2pdf: Frontmatter parsing error:', e.message);
      if (markdown.startsWith('---')) {
        const endIndex = markdown.indexOf('---', 3);
        if (endIndex !== -1) {
          markdown = markdown.substring(endIndex + 3).trim();
        }
      }
    }
    
    const mergedOptions = { ...options, ...frontmatter };
    
    progress.report({ message: 'Parsing Markdown...' });
    
    configureMarked(mergedOptions);
    
    let htmlContent;
    if (typeof marked === 'function') {
      htmlContent = marked(markdown);
    } else if (marked.parse) {
      htmlContent = marked.parse(markdown);
    } else {
      throw new Error('Cannot parse markdown: invalid marked module');
    }
    console.log('md2pdf: HTML generated, length:', htmlContent.length);
    
    const mermaidCount = (markdown.match(/```mermaid/g) || []).length;
    
    progress.report({ message: 'Generating HTML...' });
    
    const html = renderToHtml(htmlContent, mergedOptions, filePath);
    
    progress.report({ message: mermaidCount > 0 ? `Rendering ${mermaidCount} Mermaid diagram(s)...` : 'Generating PDF...' });
    
    if (!puppeteer) {
      const puppeteerPaths = [
        path.join(extensionPath, 'node_modules', 'puppeteer'),
        'puppeteer'
      ];
      
      let loaded = false;
      for (const puppeteerPath of puppeteerPaths) {
        try {
          puppeteer = require(puppeteerPath);
          loaded = true;
          console.log('md2pdf: Puppeteer loaded from', puppeteerPath);
          break;
        } catch (e) {
          console.log('md2pdf: Puppeteer not found at', puppeteerPath);
        }
      }
      
      if (!loaded) {
        const action = await vscode.window.showErrorMessage(
          'Puppeteer is required for PDF generation. Install it now?',
          'Install',
          'Cancel'
        );
        
        if (action === 'Install') {
          progress.report({ message: 'Installing Puppeteer (this may take a minute)...' });
          
          try {
            const { exec } = require('child_process');
            await new Promise((resolve, reject) => {
              exec(`cd "${extensionPath}" && npm install puppeteer --save`, (error, stdout, stderr) => {
                if (error) {
                  console.error('Install error:', stderr);
                  reject(error);
                } else {
                  resolve(stdout);
                }
              });
            });
            
            puppeteer = require(path.join(extensionPath, 'node_modules', 'puppeteer'));
            vscode.window.showInformationMessage('Puppeteer installed! Generating PDF...');
          } catch (installError) {
            vscode.window.showErrorMessage(
              'Failed to install Puppeteer. Please run manually: cd "' + extensionPath + '" && npm install puppeteer'
            );
            return;
          }
        } else {
          return;
        }
      }
    }
    
    const browser = await puppeteer.launch({ 
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    try {
      const page = await browser.newPage();
      
      await page.setViewport({ width: 800, height: 1100, deviceScaleFactor: 2 });
      
      await page.setContent(html, { 
        waitUntil: ['networkidle0', 'domcontentloaded'],
        timeout: 60000
      });
      
      if (mermaidCount > 0) {
        progress.report({ message: 'Waiting for Mermaid diagrams...' });
        await page.waitForFunction(() => window.mermaidRendered === true, { timeout: 30000 });
        await page.evaluate(() => new Promise(r => setTimeout(r, 500)));
      }
      
      let outputPath;
      if (mergedOptions.outputDirectory) {
        const outDir = path.isAbsolute(mergedOptions.outputDirectory) 
          ? mergedOptions.outputDirectory 
          : path.join(path.dirname(filePath), mergedOptions.outputDirectory);
        if (!fs.existsSync(outDir)) {
          fs.mkdirSync(outDir, { recursive: true });
        }
        outputPath = path.join(outDir, path.basename(filePath, path.extname(filePath)) + '.pdf');
      } else {
        outputPath = filePath.replace(/\.(md|markdown)$/i, '.pdf');
      }
      
      progress.report({ message: 'Saving PDF...' });
      
      const pdfOptions = {
        path: outputPath,
        format: mergedOptions.pageSize || 'A4',
        margin: mergedOptions.margins || { top: '0.6in', right: '0.6in', bottom: '0.6in', left: '0.6in' },
        printBackground: true,
        preferCSSPageSize: false,
        displayHeaderFooter: false
      };
      
      if (mergedOptions.showPageNumbers) {
        pdfOptions.displayHeaderFooter = true;
        pdfOptions.headerTemplate = '<span></span>';
        pdfOptions.footerTemplate = getFooterTemplate(mergedOptions);
      }
      
      await page.pdf(pdfOptions);
      
      const action = await vscode.window.showInformationMessage(
        `PDF created: ${path.basename(outputPath)}`,
        'Open PDF',
        'Open Folder'
      );
      
      if (action === 'Open PDF') {
        vscode.env.openExternal(vscode.Uri.file(outputPath));
      } else if (action === 'Open Folder') {
        vscode.env.openExternal(vscode.Uri.file(path.dirname(outputPath)));
      }
      
    } finally {
      await browser.close();
    }
  });
}

function configureMarked(options) {
  const showLineNumbers = options && options.showLineNumbers;
  
  const renderer = {
    code(code, lang, escaped) {
      const language = (lang || '').split(' ')[0];
      
      if (language === 'mermaid') {
        return `<div class="mermaid-wrapper"><pre class="mermaid">${code}</pre></div>\n`;
      }
      
      let highlighted = escapeHtml(code);
      if (language && hljs && hljs.getLanguage(language)) {
        try {
          highlighted = hljs.highlight(code, { language: language }).value;
        } catch (e) {
          console.error('md2pdf highlight error:', e);
        }
      } else if (hljs) {
        try {
          highlighted = hljs.highlightAuto(code).value;
        } catch (e) {
        }
      }
      
      if (showLineNumbers) {
        highlighted = addLineNumbers(highlighted);
      }
      
      const langClass = language ? `hljs language-${language}` : 'hljs';
      return `<pre><code class="${langClass}">${highlighted}</code></pre>\n`;
    }
  };
  
  marked.use({ renderer });
}

function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function addLineNumbers(html) {
  const lines = html.split('\n');
  return lines.map((line, i) => 
    `<span class="line-number">${i + 1}</span>${line}`
  ).join('\n');
}

function getFooterTemplate(options) {
  if (!options.showPageNumbers) {
    return '<div></div>';
  }
  
  const style = 'font-size: 10px; width: 100%; text-align: center; color: #666;';
  
  switch (options.pageNumberFormat) {
    case 'pageXofY':
      return `<div style="${style}">Page <span class="pageNumber"></span> of <span class="totalPages"></span></div>`;
    case 'roman':
      return `<div style="${style}"><span class="pageNumber"></span></div>`;
    default:
      return `<div style="${style}"><span class="pageNumber"></span></div>`;
  }
}

function renderToHtml(content, options, filePath) {
  const basePath = options.basePath || path.dirname(filePath);
  const title = options.coverTitle || options.title || path.basename(filePath, path.extname(filePath));
  
  const themeCSS = getThemeCSS(options.theme || 'github');
  const codeThemeCSS = getCodeThemeCSS(options.codeTheme || 'github');
  const featureCSS = getFeatureCSS();
  
  const mermaidScript = getMermaidScript(options);
  
  let coverHtml = '';
  if (options.coverPage) {
    coverHtml = generateCoverPage(options, title);
  }
  
  content = addHeadingIds(content);
  
  let tocHtml = '';
  if (options.toc) {
    tocHtml = generateTOC(content, options);
  }
  
  let watermarkCSS = '';
  let watermarkHtml = '';
  if (options.watermark) {
    watermarkCSS = generateWatermarkCSS(options);
    watermarkHtml = `<div class="watermark-text">${options.watermark}</div>`;
  }
  
  const katexIncludes = options.mathSupport !== false ? getKatexIncludes() : '';
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <base href="file://${basePath}/">
  <title>${title}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  ${katexIncludes}
  <style>
    ${themeCSS}
    ${featureCSS}
    ${codeThemeCSS}
    ${watermarkCSS}
  </style>
  ${mermaidScript}
</head>
<body>
  ${watermarkHtml}
  ${coverHtml}
  ${tocHtml}
  <div class="container">
    ${content}
  </div>
</body>
</html>`;
}

function getMermaidScript(options) {
  const theme = options.mermaidTheme || 'default';
  const mermaidScale = options.mermaidScale || 'auto';
  
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
          fontFamily: 'Inter, system-ui, sans-serif',
          logLevel: 'error',
          maxTextSize: 90000,
          fontSize: ${scale.fontSize},
          flowchart: {
            useMaxWidth: true,
            htmlLabels: true,
            curve: 'basis',
            padding: 12,
            nodeSpacing: ${scale.nodeSpacing},
            rankSpacing: ${scale.rankSpacing}
          },
          sequence: {
            useMaxWidth: true,
            diagramMarginX: 20,
            diagramMarginY: 10,
            actorMargin: 50,
            messageMargin: 30
          },
          gantt: {
            useMaxWidth: true,
            barHeight: 18,
            fontSize: ${scale.fontSize}
          },
          pie: {
            useMaxWidth: true,
            textPosition: 0.7
          }
        });

        document.addEventListener('DOMContentLoaded', async () => {
          const diagrams = document.querySelectorAll('.mermaid');
          window.mermaidRenderState.total = diagrams.length;

          if (diagrams.length === 0) {
            window.mermaidRendered = true;
            return;
          }

          const pageHeight = 900;
          const maxHeight = ${options.mermaidMaxHeight || 'null'};

          try {
            for (const diagram of diagrams) {
              const id = diagram.id || 'mermaid-' + Math.random().toString(36).substr(2, 9);
              diagram.id = id;
              
              try {
                const graphDefinition = diagram.textContent;
                const { svg } = await mermaid.render(id + '-svg', graphDefinition);
                diagram.innerHTML = svg;
                
                const svgEl = diagram.querySelector('svg');
                if (svgEl) {
                  svgEl.style.maxWidth = '100%';
                  svgEl.style.height = 'auto';
                  svgEl.style.display = 'block';
                  
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
}

function generateCoverPage(options, title) {
  const logoHtml = options.coverLogo 
    ? `<img src="${options.coverLogo}" alt="Logo" class="cover-logo" />`
    : '';
    
  const confidentialBadge = options.coverConfidential
    ? '<div class="cover-badge">CONFIDENTIAL</div>'
    : '';

  const subtitleHtml = options.coverSubtitle 
    ? `<div class="cover-subtitle">${options.coverSubtitle}</div>` 
    : '';
    
  const versionHtml = options.coverVersion 
    ? `<span class="cover-version">v${options.coverVersion}</span>` 
    : '';
    
  const authorHtml = options.coverAuthor 
    ? `<div class="cover-author">Prepared by: <strong>${options.coverAuthor}</strong></div>` 
    : '';
    
  const orgHtml = options.coverOrganization 
    ? `<div class="cover-org">${options.coverOrganization}</div>` 
    : '';

  const dateStr = new Date().toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
  
  return `
    <div class="cover-page">
      <div class="cover-accent"></div>
      ${confidentialBadge}
      <div class="cover-content">
        ${logoHtml}
        <h1 class="cover-title">${options.coverTitle || title}</h1>
        ${subtitleHtml}
        ${versionHtml}
      </div>
      <div class="cover-bottom">
        ${authorHtml}
        <div class="cover-date">${dateStr}</div>
        ${orgHtml}
      </div>
    </div>
    <div class="page-break"></div>
  `;
}

function generateTOC(content, options) {
  const maxLevel = options.tocMaxLevel || 3;
  const headingRegex = /<h([1-6])[^>]*id="([^"]*)"[^>]*>(.*?)<\/h\1>/gi;
  const headings = [];
  let match;
  
  while ((match = headingRegex.exec(content)) !== null) {
    const level = parseInt(match[1]);
    if (level <= maxLevel) {
      headings.push({
        level,
        id: match[2],
        text: match[3].replace(/<[^>]+>/g, '')
      });
    }
  }
  
  if (headings.length === 0) return '';
  
  const counters = [0, 0, 0, 0, 0, 0];
  
  const items = headings.map(heading => {
    counters[heading.level - 1]++;
    for (let i = heading.level; i < 6; i++) {
      counters[i] = 0;
    }
    
    const parts = counters.slice(0, heading.level).filter(n => n > 0);
    const prefix = parts.join('.');
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
      <h2 class="toc-title">${options.tocTitle || 'Table of Contents'}</h2>
      <nav class="toc-nav">
        ${items}
      </nav>
    </div>
    <div class="page-break"></div>
  `;
}

function addHeadingIds(content) {
  let counter = 0;
  return content.replace(/<h([1-6])([^>]*)>(.*?)<\/h\1>/gi, (match, level, attrs, text) => {
    if (attrs.includes('id="')) return match;
    const id = text.toLowerCase()
      .replace(/<[^>]+>/g, '')
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .substring(0, 50) + '-' + (++counter);
    return `<h${level} id="${id}"${attrs}>${text}</h${level}>`;
  });
}

function generateWatermarkCSS(options) {
  const opacity = options.watermarkOpacity || 0.08;
  return `
    .watermark-text {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%) rotate(-45deg);
      font-size: 80px;
      font-weight: bold;
      color: rgba(203, 213, 225, ${opacity});
      pointer-events: none;
      z-index: 9999;
      white-space: nowrap;
      letter-spacing: 0.15em;
      text-transform: uppercase;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    
    @media print {
      .watermark-text {
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%) rotate(-45deg);
        font-size: 80px;
        font-weight: bold;
        color: rgba(203, 213, 225, ${opacity});
        z-index: 9999;
        pointer-events: none;
        white-space: nowrap;
        letter-spacing: 0.15em;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
    }
  `;
}

function getKatexIncludes() {
  return `
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css">
    <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js"></script>
    <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/contrib/auto-render.min.js"
      onload="renderMathInElement(document.body, {delimiters: [{left: '$$', right: '$$', display: true}, {left: '$', right: '$', display: false}]});"></script>
  `;
}

function getThemeCSS(theme) {
  const baseVars = `
    :root {
      --font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      --font-mono: 'JetBrains Mono', 'Fira Code', 'Consolas', 'Monaco', monospace;
    }
    * { box-sizing: border-box; }
  `;
  
  const themes = {
    github: baseVars + `
      :root {
        --color-text: #24292f;
        --color-text-muted: #57606a;
        --color-heading: #1f2328;
        --color-link: #0969da;
        --color-border: #d0d7de;
        --color-bg-subtle: #f6f8fa;
        --color-bg-code: #f6f8fa;
        --color-primary: #0969da;
        --line-height: 1.7;
      }
      body {
        font-family: var(--font-sans);
        font-size: 11pt;
        line-height: var(--line-height);
        color: var(--color-text);
        background: white;
        margin: 0;
        padding: 0;
        -webkit-font-smoothing: antialiased;
      }
      .container { max-width: 100%; margin: 0 auto; }
      h1, h2, h3, h4, h5, h6 {
        font-family: var(--font-sans);
        color: var(--color-heading);
        font-weight: 600;
        line-height: 1.25;
        margin-top: 24px;
        margin-bottom: 16px;
        page-break-after: avoid;
      }
      h1 { font-size: 2em; padding-bottom: 0.3em; border-bottom: 1px solid var(--color-border); margin-top: 0; }
      h2 { font-size: 1.5em; padding-bottom: 0.3em; border-bottom: 1px solid var(--color-border); }
      h3 { font-size: 1.25em; }
      h4 { font-size: 1em; }
      h5 { font-size: 0.875em; }
      h6 { font-size: 0.85em; color: var(--color-text-muted); }
      p { margin: 0 0 16px; orphans: 3; widows: 3; }
      a { color: var(--color-link); text-decoration: none; }
      a:hover { text-decoration: underline; }
      strong, b { font-weight: 600; }
      ul, ol { margin: 0 0 16px; padding-left: 2em; }
      li { margin-bottom: 4px; }
      li > ul, li > ol { margin-top: 4px; margin-bottom: 0; }
      blockquote {
        margin: 0 0 16px;
        padding: 0 1em;
        color: var(--color-text-muted);
        border-left: 4px solid var(--color-border);
      }
      blockquote > :first-child { margin-top: 0; }
      blockquote > :last-child { margin-bottom: 0; }
      code {
        font-family: var(--font-mono);
        font-size: 0.875em;
        background: rgba(175, 184, 193, 0.2);
        padding: 0.2em 0.4em;
        border-radius: 6px;
      }
      pre {
        margin: 0 0 16px;
        padding: 16px;
        overflow-x: auto;
        font-size: 0.875em;
        line-height: 1.45;
        background: var(--color-bg-code);
        border-radius: 6px;
        page-break-inside: avoid;
      }
      pre code { background: transparent; padding: 0; border-radius: 0; font-size: inherit; }
      table { width: 100%; border-collapse: collapse; margin: 0 0 16px; page-break-inside: avoid; }
      th, td { padding: 6px 13px; border: 1px solid var(--color-border); }
      th { font-weight: 600; background: var(--color-bg-subtle); }
      tr:nth-child(2n) { background: var(--color-bg-subtle); }
      hr { height: 0.25em; padding: 0; margin: 24px 0; background-color: var(--color-border); border: 0; }
      img { max-width: 100%; height: auto; display: block; margin: 16px auto; border-radius: 6px; }
      kbd {
        font-family: var(--font-mono);
        font-size: 0.85em;
        padding: 3px 5px;
        background: var(--color-bg-subtle);
        border: solid 1px var(--color-border);
        border-radius: 6px;
        box-shadow: inset 0 -1px 0 var(--color-border);
      }
      @media print {
        h1, h2, h3, h4, h5, h6 { page-break-after: avoid; }
        pre, blockquote, table, .mermaid-wrapper { page-break-inside: avoid; }
      }
    `,
    professional: baseVars + `
      :root {
        --color-primary: #22626a;
        --color-text: #1e293b;
        --color-text-muted: #64748b;
        --color-heading: #0f172a;
        --color-link: #22626a;
        --color-border: #e2e8f0;
        --color-bg-subtle: #f8fafc;
        --color-bg-code: #f1f5f9;
        --line-height: 1.6;
        --border-radius: 6px;
      }
      body {
        font-family: var(--font-sans);
        font-size: 11pt;
        line-height: var(--line-height);
        color: var(--color-text);
        background: white;
        margin: 0;
        padding: 0;
        -webkit-font-smoothing: antialiased;
      }
      .container { max-width: 100%; }
      h1, h2, h3, h4, h5, h6 {
        font-family: var(--font-sans);
        color: var(--color-heading);
        font-weight: 700;
        line-height: 1.25;
        margin-top: 1.25em;
        margin-bottom: 0.75em;
        page-break-after: avoid;
      }
      h1 { font-size: 2.25em; margin-top: 0; padding-bottom: 0.5em; border-bottom: 3px solid var(--color-primary); }
      h2 { font-size: 1.75em; padding-bottom: 0.25em; border-bottom: 2px solid var(--color-border); }
      h3 { font-size: 1.35em; color: var(--color-primary); }
      h4 { font-size: 1.15em; }
      h5, h6 { font-size: 1em; text-transform: uppercase; letter-spacing: 0.05em; }
      h6 { color: var(--color-text-muted); }
      p { margin: 0 0 1em; orphans: 3; widows: 3; }
      strong, b { font-weight: 600; }
      a { color: var(--color-link); text-decoration: none; font-weight: 500; }
      a:hover { text-decoration: underline; }
      ul, ol { margin: 0 0 1em; padding-left: 1.75em; }
      li { margin-bottom: 0.35em; }
      li > ul, li > ol { margin-top: 0.5em; margin-bottom: 0; }
      blockquote {
        margin: 1em 0;
        padding: 0.75em 1.25em;
        background: var(--color-bg-subtle);
        border-left: 4px solid var(--color-primary);
        border-radius: 0 var(--border-radius) var(--border-radius) 0;
        font-style: normal;
      }
      blockquote > :first-child { margin-top: 0; }
      blockquote > :last-child { margin-bottom: 0; }
      code {
        font-family: var(--font-mono);
        font-size: 0.875em;
        background: var(--color-bg-code);
        padding: 0.2em 0.5em;
        border-radius: 4px;
        color: var(--color-primary);
      }
      pre {
        margin: 0 0 1em;
        padding: 1em;
        background: var(--color-bg-code);
        border-radius: var(--border-radius);
        overflow-x: auto;
        font-size: 0.85em;
        line-height: 1.5;
        page-break-inside: auto;
        border: 1px solid var(--color-border);
      }
      pre code { background: none; padding: 0; border-radius: 0; color: inherit; }
      table {
        width: 100%;
        border-collapse: collapse;
        margin: 0 0 1em;
        font-size: 0.9em;
        page-break-inside: auto;
        border-radius: var(--border-radius);
        overflow: hidden;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
      }
      th { background: var(--color-primary); color: white; font-weight: 600; padding: 0.65em 0.8em; text-align: left; }
      td { padding: 0.5em 0.8em; border-bottom: 1px solid var(--color-border); }
      tr:last-child td { border-bottom: none; }
      tr:nth-child(even) { background: var(--color-bg-subtle); }
      hr { border: none; height: 2px; background: linear-gradient(to right, var(--color-primary), var(--color-border)); margin: 1.25em 0; }
      img { max-width: 100%; height: auto; display: block; margin: 1em auto; border-radius: var(--border-radius); box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); }
      kbd { font-family: var(--font-mono); font-size: 0.85em; padding: 0.2em 0.5em; background: var(--color-bg-subtle); border: 1px solid var(--color-border); border-radius: 4px; box-shadow: 0 2px 0 var(--color-border); }
      @media print {
        h1, h2, h3, h4, h5, h6 { page-break-after: avoid; }
        pre, blockquote, table { page-break-inside: auto; }
        .mermaid-wrapper { page-break-inside: auto; }
        table { box-shadow: none; border: 1px solid var(--color-border); }
        img { box-shadow: none; }
      }
    `,
    minimal: baseVars + `
      :root {
        --color-text: #333;
        --color-text-muted: #666;
        --color-border: #eee;
        --color-bg-subtle: #fafafa;
        --color-primary: #333;
        --line-height: 1.8;
      }
      body { font-family: Georgia, 'Times New Roman', serif; font-size: 11pt; line-height: var(--line-height); color: var(--color-text); background: white; margin: 0; }
      .container { max-width: 700px; margin: 0 auto; padding: 40px 20px; }
      h1, h2, h3, h4, h5, h6 { font-weight: normal; margin-top: 40px; margin-bottom: 16px; }
      h1 { font-size: 2em; }
      h2 { font-size: 1.5em; }
      h3 { font-size: 1.25em; }
      p { margin: 0 0 1em; }
      a { color: var(--color-text); }
      code { font-family: Menlo, Monaco, monospace; font-size: 0.9em; }
      pre { background: var(--color-bg-subtle); padding: 20px; border: 1px solid var(--color-border); overflow: auto; }
      pre code { background: none; }
      blockquote { border-left: 2px solid #ccc; padding-left: 20px; color: var(--color-text-muted); margin: 1em 0; }
      table { width: 100%; border-collapse: collapse; margin: 1em 0; }
      th, td { border-bottom: 1px solid #ddd; padding: 10px; text-align: left; }
      img { max-width: 100%; }
    `,
    academic: baseVars + `
      :root {
        --color-text: #000;
        --color-border: #ddd;
        --color-bg-subtle: #f9f9f9;
        --color-primary: #000;
      }
      body { font-family: 'Times New Roman', Times, serif; font-size: 12pt; line-height: 1.8; color: var(--color-text); background: white; margin: 0; }
      .container { max-width: 700px; margin: 0 auto; padding: 1in; }
      h1, h2, h3, h4, h5, h6 { font-family: Arial, Helvetica, sans-serif; margin-top: 24pt; margin-bottom: 12pt; }
      h1 { font-size: 16pt; text-align: center; }
      h2 { font-size: 14pt; }
      h3 { font-size: 12pt; font-style: italic; }
      p { text-indent: 0.5in; margin: 0 0 12pt 0; text-align: justify; }
      a { color: var(--color-text); text-decoration: underline; }
      code { font-family: 'Courier New', Courier, monospace; }
      pre { font-size: 10pt; background: var(--color-bg-subtle); padding: 12pt; border: 1px solid var(--color-border); overflow: auto; }
      blockquote { margin: 12pt 40pt; font-style: italic; }
      table { margin: 12pt auto; border-collapse: collapse; }
      th, td { border: 1px solid var(--color-text); padding: 6pt 12pt; }
      img { max-width: 100%; display: block; margin: 12pt auto; }
    `
  };
  
  return themes[theme] || themes.github;
}

function getCodeThemeCSS(theme) {
  const themes = {
    github: `
      .hljs { background: #f6f8fa; color: #24292e; }
      .hljs-comment, .hljs-quote { color: #6e7781; font-style: italic; }
      .hljs-keyword, .hljs-selector-tag, .hljs-literal { color: #cf222e; }
      .hljs-name, .hljs-tag { color: #116329; }
      .hljs-attr, .hljs-selector-id, .hljs-selector-class { color: #0550ae; }
      .hljs-string, .hljs-addition { color: #0a3069; }
      .hljs-number, .hljs-symbol, .hljs-bullet { color: #0550ae; }
      .hljs-variable, .hljs-template-variable, .hljs-link { color: #953800; }
      .hljs-title, .hljs-section, .hljs-built_in, .hljs-type { color: #8250df; }
      .hljs-meta { color: #1f6feb; }
      .hljs-deletion { color: #82071e; background: #ffebe9; }
    `,
    monokai: `
      pre { background: #272822 !important; }
      pre code { color: #f8f8f2; }
      .hljs { background: #272822; color: #f8f8f2; }
      .hljs-comment, .hljs-quote { color: #75715e; font-style: italic; }
      .hljs-keyword, .hljs-selector-tag { color: #f92672; }
      .hljs-string, .hljs-attr { color: #e6db74; }
      .hljs-number, .hljs-literal { color: #ae81ff; }
      .hljs-function .hljs-title, .hljs-title { color: #a6e22e; }
      .hljs-built_in { color: #66d9ef; }
      .hljs-type { color: #66d9ef; font-style: italic; }
      .hljs-tag, .hljs-name { color: #f92672; }
      .hljs-attribute { color: #a6e22e; }
    `,
    dracula: `
      pre { background: #282a36 !important; }
      pre code { color: #f8f8f2; }
      .hljs { background: #282a36; color: #f8f8f2; }
      .hljs-comment, .hljs-quote { color: #6272a4; font-style: italic; }
      .hljs-keyword, .hljs-selector-tag { color: #ff79c6; }
      .hljs-string, .hljs-attr { color: #f1fa8c; }
      .hljs-number, .hljs-literal { color: #bd93f9; }
      .hljs-function .hljs-title, .hljs-title { color: #50fa7b; }
      .hljs-built_in { color: #8be9fd; }
      .hljs-type { color: #8be9fd; font-style: italic; }
      .hljs-tag, .hljs-name { color: #ff79c6; }
      .hljs-attribute { color: #50fa7b; }
    `,
    'one-dark': `
      pre { background: #282c34 !important; }
      pre code { color: #abb2bf; }
      .hljs { background: #282c34; color: #abb2bf; }
      .hljs-comment, .hljs-quote { color: #5c6370; font-style: italic; }
      .hljs-keyword, .hljs-selector-tag { color: #c678dd; }
      .hljs-string, .hljs-attr { color: #98c379; }
      .hljs-number, .hljs-literal { color: #d19a66; }
      .hljs-function .hljs-title, .hljs-title { color: #61afef; }
      .hljs-built_in { color: #e5c07b; }
      .hljs-type { color: #e5c07b; }
      .hljs-tag, .hljs-name { color: #e06c75; }
      .hljs-attribute { color: #d19a66; }
    `,
    'github-dark': `
      pre { background: #0d1117 !important; }
      pre code { color: #c9d1d9; }
      .hljs { background: #0d1117; color: #c9d1d9; }
      .hljs-comment, .hljs-quote { color: #8b949e; font-style: italic; }
      .hljs-keyword, .hljs-selector-tag { color: #ff7b72; }
      .hljs-string, .hljs-attr { color: #a5d6ff; }
      .hljs-number, .hljs-literal { color: #79c0ff; }
      .hljs-function .hljs-title, .hljs-title { color: #d2a8ff; }
      .hljs-built_in { color: #79c0ff; }
      .hljs-type { color: #79c0ff; }
      .hljs-tag, .hljs-name { color: #7ee787; }
      .hljs-attribute { color: #79c0ff; }
    `
  };
  
  return themes[theme] || themes.github;
}

function getFeatureCSS() {
  return `
    /* Page Break */
    .page-break {
      page-break-after: always;
      break-after: page;
      height: 0;
      margin: 0;
      padding: 0;
    }

    /* Mermaid Diagrams */
    .mermaid-wrapper {
      page-break-inside: avoid;
      break-inside: avoid;
      margin: 1em 0;
    }
    
    .mermaid,
    pre.mermaid {
      page-break-inside: avoid;
      break-inside: avoid;
      display: block;
      text-align: center;
      margin: 0 auto;
      overflow: visible;
      background: var(--color-bg-subtle, #f6f8fa);
      border-radius: 6px;
      padding: 8px;
      border: none;
      width: 100%;
      font-size: 10px;
    }
    
    .mermaid svg {
      display: block;
      margin: 0 auto;
      max-width: 100%;
      height: auto;
      overflow: visible;
    }

    .mermaid text,
    .mermaid .nodeLabel,
    .mermaid .edgeLabel,
    .mermaid .cluster-label,
    .mermaid .label {
      overflow: visible !important;
    }

    .mermaid foreignObject {
      overflow: visible !important;
    }

    .mermaid .node,
    .mermaid .cluster {
      overflow: visible !important;
    }

    .mermaid-error {
      color: #cf222e;
      background: #ffebe9;
      padding: 12px;
      border-radius: 6px;
      font-family: var(--font-mono);
      font-size: 0.8em;
      white-space: pre-wrap;
    }

    /* Cover Page - Professional Design */
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

    .cover-badge,
    .confidential-badge {
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
      border: none !important;
      padding: 0 !important;
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

    .cover-bottom,
    .cover-meta {
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
    .toc,
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
      border: none !important;
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

    .toc-nav,
    .toc-list {
      line-height: 1.5;
      max-width: 550px;
      margin: 0 auto;
      list-style: none;
      padding: 0;
    }

    .toc-list li,
    .toc-item {
      margin: 0;
    }

    .toc-list li a,
    .toc-item a {
      color: var(--color-text, #1e293b);
      text-decoration: none;
      display: flex;
      align-items: baseline;
      padding: 10px 0;
      transition: color 0.2s;
      border-bottom: 1px solid #f1f5f9;
    }

    .toc-list li:last-child a,
    .toc-item:last-child a {
      border-bottom: none;
    }

    .toc-list li a:hover,
    .toc-item a:hover {
      color: var(--color-primary, #22626a);
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

    .toc-level-1 { font-weight: 600; font-size: 1em; }
    .toc-level-1 a { padding: 12px 0; }
    .toc-level-2 { font-size: 0.92em; }
    .toc-level-2 a { padding: 9px 0; }
    .toc-level-3 { font-size: 0.85em; color: #64748b; }
    .toc-level-3 a { padding: 7px 0; }

    /* Code blocks */
    pre {
      margin: 16px 0;
      padding: 16px;
      overflow-x: auto;
      border-radius: 6px;
      font-size: 14px;
      line-height: 1.5;
    }
    pre code {
      display: block;
      padding: 0;
      background: none;
      font-family: 'JetBrains Mono', 'Fira Code', 'SF Mono', Menlo, Monaco, 'Courier New', monospace;
      font-size: inherit;
      white-space: pre;
    }
    code {
      font-family: 'JetBrains Mono', 'Fira Code', 'SF Mono', Menlo, Monaco, 'Courier New', monospace;
    }
    
    /* Line numbers */
    .code-block.with-line-numbers code { display: block; counter-reset: line; }
    .line-number {
      display: inline-block;
      width: 3em;
      padding-right: 1em;
      text-align: right;
      color: #6b7280;
      user-select: none;
      border-right: 1px solid #e5e7eb;
      margin-right: 1em;
    }
    
    /* KaTeX / Math */
    .katex-display { margin: 1em 0; overflow-x: auto; padding: 0.5em 0; }
    .katex { font-size: 1.1em; }

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
    .git-info-item { display: flex; align-items: center; gap: 6px; }
    .git-info-label { font-weight: 600; color: #374151; }
    .git-dirty { color: #f59e0b; font-size: 0.9em; }
    
    /* Print */
    @media print {
      .mermaid-wrapper { page-break-inside: avoid; }
      pre { page-break-inside: avoid; }
    }
  `;
}

function deactivate() {}

module.exports = {
  activate,
  deactivate
};
