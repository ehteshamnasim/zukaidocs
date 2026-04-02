#!/usr/bin/env node

/**
 * md2pdf - Command Line Interface
 * 
 * Production-ready Markdown to PDF converter with Mermaid support.
 * Features:
 *   - Single file and batch conversion with glob patterns
 *   - Configuration via JSON files or CLI options
 *   - Multiple themes: github, minimal, professional, academic
 *   - Watch mode for live regeneration
 *   - Cover page, TOC, and watermark support
 * 
 * Usage:
 *   md2pdf <file.md>                  Convert single file
 *   md2pdf *.md                       Convert multiple files
 *   md2pdf doc.md -c str-app          Use config from configs/
 *   md2pdf doc.md -w                  Watch for changes
 */

const { program } = require('commander');
const chalk = require('chalk');
const ora = require('ora');
const fs = require('fs');
const path = require('path');
const { glob } = require('glob');

const { parseMarkdown, extractMermaidBlocks, extractFrontmatter, processIncludes, getMarkdownStats, getGitInfo, setParserOptions } = require('../parser');
const { renderToHtml } = require('../renderer');
const { generatePdf, PAGE_FORMATS } = require('../pdf');
const { resolveConfig, validateConfig, generateSampleConfig, listConfigs, getConfigsDir } = require('../config');
const { watchFiles } = require('./watch');

const convertFile = async (inputPath, outputPath, config, spinner) => {
  const absoluteInput = path.resolve(inputPath);
  const filename = path.basename(inputPath);
  
  if (!fs.existsSync(absoluteInput)) {
    throw new Error(`File not found: ${absoluteInput}`);
  }

  const rawMarkdown = fs.readFileSync(absoluteInput, 'utf-8');
  
  const { frontmatter, content: markdownContent } = extractFrontmatter(rawMarkdown);
  
  const mergedConfig = { ...config, ...frontmatter };
  
  const markdown = processIncludes(markdownContent, path.dirname(absoluteInput));
  
  setParserOptions({ 
    showLineNumbers: mergedConfig.showLineNumbers,
    basePath: path.dirname(absoluteInput)
  });
  
  const stats = getMarkdownStats(markdown);
  
  let gitInfo = null;
  if (mergedConfig.showGitInfo) {
    gitInfo = getGitInfo(absoluteInput);
  }
  
  if (spinner) {
    spinner.text = `Parsing ${filename}...`;
  }

  const htmlContent = parseMarkdown(markdown);

  const html = renderToHtml(htmlContent, {
    theme: mergedConfig.theme,
    mermaidTheme: mergedConfig.mermaidTheme,
    mermaidScale: mergedConfig.mermaidScale,
    mermaidMaxHeight: mergedConfig.mermaidMaxHeight,
    codeTheme: mergedConfig.codeTheme,
    title: mergedConfig.title || path.basename(inputPath, path.extname(inputPath)),
    coverPage: mergedConfig.coverPage,
    coverTitle: mergedConfig.coverTitle || mergedConfig.title || path.basename(inputPath, path.extname(inputPath)),
    coverSubtitle: mergedConfig.coverSubtitle,
    coverAuthor: mergedConfig.coverAuthor,
    coverLogo: mergedConfig.coverLogo,
    coverOrganization: mergedConfig.coverOrganization,
    coverVersion: mergedConfig.coverVersion,
    coverConfidential: mergedConfig.coverConfidential,
    toc: mergedConfig.toc,
    tocTitle: mergedConfig.tocTitle,
    tocMaxLevel: mergedConfig.tocMaxLevel,
    watermark: mergedConfig.watermark,
    watermarkOpacity: mergedConfig.watermarkOpacity,
    watermarkRotation: mergedConfig.watermarkRotation,
    mathSupport: mergedConfig.mathSupport !== false,
    customCSS: mergedConfig.customCSS,
    gitInfo: gitInfo,
    basePath: path.dirname(absoluteInput)
  });

  let finalOutputPath = outputPath;
  if (!finalOutputPath) {
    const dir = path.dirname(absoluteInput);
    const name = path.basename(absoluteInput, path.extname(absoluteInput));
    finalOutputPath = path.join(dir, `${name}.pdf`);
  }
  finalOutputPath = path.resolve(finalOutputPath);

  if (spinner) {
    const mermaidInfo = stats.mermaidCount > 0 
      ? ` (${stats.mermaidCount} Mermaid diagram${stats.mermaidCount !== 1 ? 's' : ''})` 
      : '';
    spinner.text = `Generating PDF${mermaidInfo}...`;
  }

  let headerTemplate = '';
  let footerTemplate = '';
  
  if (mergedConfig.showPageNumbers || mergedConfig.headerText || mergedConfig.footerText) {
    const baseStyle = 'font-family: -apple-system, sans-serif; font-size: 9px; color: #666; width: 100%; padding: 5px 40px;';
    
    if (mergedConfig.headerText) {
      headerTemplate = `<div style="${baseStyle} border-bottom: 1px solid #e0e0e0;">${mergedConfig.headerText}</div>`;
    }
    
    let pageNumHtml = '';
    if (mergedConfig.showPageNumbers) {
      const format = mergedConfig.pageNumberFormat || 'numeric';
      if (format === 'roman') {
        pageNumHtml = '<span class="pageNumber"></span>';
      } else if (format === 'pageXofY') {
        pageNumHtml = 'Page <span class="pageNumber"></span> of <span class="totalPages"></span>';
      } else {
        pageNumHtml = '<span class="pageNumber"></span> / <span class="totalPages"></span>';
      }
    }
    
    footerTemplate = `<div style="${baseStyle} display: flex; justify-content: space-between;">
      <span>${mergedConfig.footerText || ''}</span>
      <span>${pageNumHtml}</span>
    </div>`;
  }

  const pdfStats = await generatePdf(html, finalOutputPath, {
    format: mergedConfig.pageSize,
    margin: mergedConfig.margins,
    printBackground: mergedConfig.printBackground,
    timeout: mergedConfig.timeout,
    headerTemplate: headerTemplate || undefined,
    footerTemplate: footerTemplate || undefined,
    displayHeaderFooter: !!(mergedConfig.showPageNumbers || mergedConfig.headerText || mergedConfig.footerText),
    pdfOutline: mergedConfig.pdfOutline
  });

  return {
    input: absoluteInput,
    output: finalOutputPath,
    stats: { ...stats, ...pdfStats }
  };
};

const handleConvert = async (inputs, options) => {
  const startTime = Date.now();
  
  const config = resolveConfig(options, options.config);
  
  const validation = validateConfig(config);
  if (!validation.valid) {
    console.error(chalk.red('\nConfiguration errors:'));
    validation.errors.forEach(err => console.error(chalk.red(`  • ${err}`)));
    process.exit(1);
  }

  if (config._configPath) {
    console.log(chalk.dim(`Using config: ${config._configPath}`));
  }

  let files = [];
  for (const input of inputs) {
    if (input.includes('*')) {
      const matched = await glob(input, { nodir: true });
      files.push(...matched.filter(f => f.endsWith('.md')));
    } else {
      files.push(input);
    }
  }

  files = [...new Set(files)];

  if (files.length === 0) {
    console.error(chalk.red('No markdown files found'));
    process.exit(1);
  }

  if (options.watch) {
    return watchFiles(files, options, config, convertFile);
  }

  if (files.length === 1 && options.output) {
    const spinner = ora({
      text: `Converting ${path.basename(files[0])}...`,
      color: 'cyan'
    }).start();

    try {
      const result = await convertFile(files[0], options.output, config, spinner);
      spinner.succeed(chalk.green(`Created: ${result.output}`));
      
      printStats(result.stats, startTime);
    } catch (error) {
      spinner.fail(chalk.red(`Failed: ${error.message}`));
      if (options.verbose) {
        console.error(error.stack);
      }
      process.exit(1);
    }
    return;
  }

  console.log(chalk.cyan(`\nConverting ${files.length} file${files.length !== 1 ? 's' : ''}...\n`));
  
  const results = [];
  const errors = [];

  for (const file of files) {
    const spinner = ora({
      text: `Converting ${path.basename(file)}...`,
      color: 'cyan'
    }).start();

    try {
      const result = await convertFile(file, null, config, spinner);
      results.push(result);
      spinner.succeed(chalk.green(`${path.basename(file)} → ${path.basename(result.output)}`));
    } catch (error) {
      errors.push({ file, error: error.message });
      spinner.fail(chalk.red(`${path.basename(file)}: ${error.message}`));
    }
  }

  console.log('');
  if (results.length > 0) {
    const totalTime = Date.now() - startTime;
    const totalMermaid = results.reduce((sum, r) => sum + (r.stats.mermaidDiagrams || 0), 0);
    console.log(chalk.green(`✓ ${results.length} file${results.length !== 1 ? 's' : ''} converted successfully`));
    console.log(chalk.dim(`  Total time: ${(totalTime / 1000).toFixed(2)}s`));
    if (totalMermaid > 0) {
      console.log(chalk.dim(`  Mermaid diagrams: ${totalMermaid}`));
    }
  }
  
  if (errors.length > 0) {
    console.log(chalk.red(`✗ ${errors.length} file${errors.length !== 1 ? 's' : ''} failed`));
  }

  if (errors.length > 0) {
    process.exit(1);
  }
};

const printStats = (stats, startTime) => {
  const totalTime = Date.now() - startTime;
  console.log('');
  console.log(chalk.dim(`  Time: ${(totalTime / 1000).toFixed(2)}s`));
  
  if (stats.mermaidDiagrams > 0) {
    console.log(chalk.dim(`  Mermaid diagrams: ${stats.mermaidDiagrams}`));
    
    if (stats.mermaidErrors && stats.mermaidErrors.length > 0) {
      console.log(chalk.yellow(`  Mermaid errors: ${stats.mermaidErrors.length}`));
      stats.mermaidErrors.forEach(err => {
        console.log(chalk.yellow(`    • ${err.error}`));
      });
    }
  }
};

const handleInit = () => {
  const configPath = 'md2pdf.config.json';
  
  if (fs.existsSync(configPath)) {
    console.log(chalk.yellow(`Config file already exists: ${configPath}`));
    return;
  }

  generateSampleConfig(configPath);
  console.log(chalk.green(`Created config file: ${configPath}`));
  console.log(chalk.dim('Edit this file to customize your PDF settings.'));
};

program
  .name('md2pdf')
  .description('Convert Markdown to PDF with Mermaid diagram support')
  .version('2.0.0');

program
  .argument('<files...>', 'Markdown file(s) to convert')
  .option('-o, --output <file>', 'Output PDF file')
  .option('-c, --config <name>', 'Config name (from configs/) or path')
  .option('-t, --theme <name>', 'Theme: github, minimal, professional, academic')
  .option('-w, --watch', 'Watch for changes')
  .action(handleConvert);

program
  .command('init')
  .description('Create a sample configuration file')
  .action(handleInit);

program
  .command('themes')
  .description('List available themes')
  .action(() => {
    console.log(chalk.cyan('\nAvailable themes:\n'));
    console.log('  • ' + chalk.bold('github') + '     - Clean, modern (default)');
    console.log('  • ' + chalk.bold('minimal') + '    - Simple, distraction-free');
    console.log('  • ' + chalk.bold('professional') + ' - Polished, business-ready');
    console.log('  • ' + chalk.bold('academic') + '   - Traditional, research papers');
    console.log('');
  });

program
  .command('configs')
  .description('List available configuration files')
  .action(() => {
    const configs = listConfigs();
    const configsDir = getConfigsDir();
    
    console.log(chalk.cyan('\nAvailable configs:\n'));
    console.log(chalk.dim(`  Location: ${configsDir}\n`));
    
    if (configs.length === 0) {
      console.log(chalk.yellow('  No configs found. Run `md2pdf init` to create one.'));
    } else {
      configs.forEach(c => {
        console.log('  • ' + chalk.bold(c.name));
      });
      console.log('');
      console.log(chalk.dim('  Usage: md2pdf <file.md> -c <config-name>'));
      console.log(chalk.dim('  Example: md2pdf doc.md -c str-app'));
    }
    console.log('');
  });

program
  .command('new-config <name>')
  .description('Create a new config file in configs folder')
  .action((name) => {
    const configsDir = getConfigsDir();
    
    if (!fs.existsSync(configsDir)) {
      fs.mkdirSync(configsDir, { recursive: true });
    }
    
    const configPath = path.join(configsDir, `${name}.json`);
    
    if (fs.existsSync(configPath)) {
      console.log(chalk.yellow(`Config "${name}" already exists at ${configPath}`));
      return;
    }
    
    generateSampleConfig(configPath);
    console.log(chalk.green(`Created config: ${configPath}`));
    console.log(chalk.dim(`Edit this file to customize, then run: md2pdf <file.md> -c ${name}`));
  });

program.parse();
