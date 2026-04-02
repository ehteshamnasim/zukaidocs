/**
 * md2pdf - Configuration Module
 * 
 * Handles configuration loading, merging, and validation.
 * Features:
 *   - Named configs from configs/ folder
 *   - Auto-discovery of config files in directory tree
 *   - CLI options override file settings
 *   - Validation of themes, page sizes, and other options
 *   - Sample config generation
 */

const fs = require('fs');
const path = require('path');

const DEFAULT_CONFIG = {
  theme: 'github',
  mermaidTheme: 'default',
  mermaidScale: 'auto',
  mermaidMaxHeight: null,
  codeTheme: 'github',
  
  pageSize: 'A4',
  margins: {
    top: '0.6in',
    right: '0.6in',
    bottom: '0.6in',
    left: '0.6in'
  },
  
  printBackground: true,
  displayHeaderFooter: false,
  headerTemplate: '',
  footerTemplate: '',
  
  timeout: 90000,
  
  outputDir: '.',
  filenameTemplate: '{name}.pdf',
  
  coverPage: false,
  coverTitle: '',
  coverSubtitle: '',
  coverAuthor: '',
  coverLogo: '',
  coverOrganization: '',
  coverVersion: '',
  coverConfidential: false,
  
  toc: false,
  tocTitle: 'Table of Contents',
  tocMaxLevel: 3,
  
  watermark: '',
  watermarkOpacity: 0.08,
  watermarkRotation: -45,
  
  showPageNumbers: true,
  pageNumberFormat: 'numeric',
  pageNumberStart: 1,
  skipCoverPageNumber: true,
  headerText: '',
  footerText: '',
  
  mathSupport: true,
  
  customCSS: '',
  
  pdfOutline: true,
  
  showLineNumbers: false,
  showGitInfo: false,
  
  title: ''
};

const CONFIG_FILES = [
  'md2pdf.config.json',
  'md2pdf.json',
  '.md2pdfrc',
  '.md2pdfrc.json'
];

const getConfigsDir = () => {
  return path.join(__dirname, '..', '..', 'configs');
};

const listConfigs = () => {
  const configsDir = getConfigsDir();
  
  if (!fs.existsSync(configsDir)) {
    return [];
  }
  
  const files = fs.readdirSync(configsDir);
  return files
    .filter(f => f.endsWith('.json'))
    .map(f => ({
      name: path.basename(f, '.json'),
      path: path.join(configsDir, f)
    }));
};

const findConfigByName = (name) => {
  const configsDir = getConfigsDir();
  
  let configPath = path.join(configsDir, `${name}.json`);
  if (fs.existsSync(configPath)) {
    return configPath;
  }
  
  if (name.endsWith('.json')) {
    configPath = path.join(configsDir, name);
    if (fs.existsSync(configPath)) {
      return configPath;
    }
  }
  
  return null;
};

const findConfigFile = (startDir = process.cwd()) => {
  let currentDir = path.resolve(startDir);
  const root = path.parse(currentDir).root;

  while (currentDir !== root) {
    for (const configFile of CONFIG_FILES) {
      const configPath = path.join(currentDir, configFile);
      if (fs.existsSync(configPath)) {
        return configPath;
      }
    }
    currentDir = path.dirname(currentDir);
  }

  return null;
};

const loadConfigFile = (configPath) => {
  try {
    const content = fs.readFileSync(configPath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    throw new Error(`Failed to load config file "${configPath}": ${error.message}`);
  }
};

const mergeConfigs = (...configs) => {
  const result = { ...DEFAULT_CONFIG };

  for (const config of configs) {
    if (!config) continue;
    
    for (const [key, value] of Object.entries(config)) {
      if (value === undefined) continue;
      
      if (key === 'margins' && typeof value === 'object') {
        result.margins = { ...result.margins, ...value };
      } else {
        result[key] = value;
      }
    }
  }

  return result;
};

const resolveConfig = (cliOptions = {}, configPath = null) => {
  let fileConfig = {};
  let foundConfigPath = null;
  
  if (configPath) {
    foundConfigPath = findConfigByName(configPath);
    
    if (!foundConfigPath && fs.existsSync(configPath)) {
      foundConfigPath = configPath;
    }
  }
  
  if (!foundConfigPath) {
    foundConfigPath = findConfigFile();
  }
  
  if (foundConfigPath && fs.existsSync(foundConfigPath)) {
    fileConfig = loadConfigFile(foundConfigPath);
    fileConfig._configPath = foundConfigPath;
  }

  const cliConfig = {};
  
  if (cliOptions.theme) cliConfig.theme = cliOptions.theme;
  if (cliOptions.pageSize) cliConfig.pageSize = cliOptions.pageSize;
  if (cliOptions.margin) {
    cliConfig.margins = {
      top: cliOptions.margin,
      right: cliOptions.margin,
      bottom: cliOptions.margin,
      left: cliOptions.margin
    };
  }
  if (cliOptions.timeout) cliConfig.timeout = parseInt(cliOptions.timeout, 10);
  
  if (cliOptions.cover) cliConfig.coverPage = true;
  if (cliOptions.title) cliConfig.title = cliOptions.title;
  if (cliOptions.title) cliConfig.coverTitle = cliOptions.title;
  if (cliOptions.subtitle) cliConfig.coverSubtitle = cliOptions.subtitle;
  if (cliOptions.author) cliConfig.coverAuthor = cliOptions.author;
  if (cliOptions.logo) cliConfig.coverLogo = cliOptions.logo;
  if (cliOptions.organization) cliConfig.coverOrganization = cliOptions.organization;
  if (cliOptions.docVersion) cliConfig.coverVersion = cliOptions.docVersion;
  if (cliOptions.confidential) cliConfig.coverConfidential = true;
  
  if (cliOptions.toc) cliConfig.toc = true;
  if (cliOptions.tocTitle) cliConfig.tocTitle = cliOptions.tocTitle;
  if (cliOptions.tocDepth) cliConfig.tocMaxLevel = parseInt(cliOptions.tocDepth, 10);
  
  if (cliOptions.watermark) cliConfig.watermark = cliOptions.watermark;
  if (cliOptions.watermarkOpacity) cliConfig.watermarkOpacity = parseFloat(cliOptions.watermarkOpacity);
  
  if (cliOptions.pageNumbers !== undefined) cliConfig.showPageNumbers = cliOptions.pageNumbers;
  if (cliOptions.header) cliConfig.headerText = cliOptions.header;
  if (cliOptions.footer) cliConfig.footerText = cliOptions.footer;
  
  if (cliOptions.math === false) cliConfig.mathSupport = false;

  return mergeConfigs(DEFAULT_CONFIG, fileConfig, cliConfig);
};

const validateConfig = (config) => {
  const errors = [];
  const validThemes = ['github', 'minimal', 'professional', 'academic'];
  const validPageSizes = ['A4', 'A3', 'Letter', 'Legal', 'Tabloid'];
  const validMermaidThemes = ['default', 'dark', 'forest', 'neutral', 'base'];

  if (config.theme && !validThemes.includes(config.theme)) {
    errors.push(`Invalid theme "${config.theme}". Valid options: ${validThemes.join(', ')}`);
  }

  if (config.pageSize && !validPageSizes.includes(config.pageSize)) {
    errors.push(`Invalid page size "${config.pageSize}". Valid options: ${validPageSizes.join(', ')}`);
  }

  if (config.mermaidTheme && !validMermaidThemes.includes(config.mermaidTheme)) {
    errors.push(`Invalid Mermaid theme "${config.mermaidTheme}". Valid options: ${validMermaidThemes.join(', ')}`);
  }

  if (config.timeout && (isNaN(config.timeout) || config.timeout < 1000)) {
    errors.push('Timeout must be a number >= 1000 (milliseconds)');
  }

  return {
    valid: errors.length === 0,
    errors
  };
};

const generateSampleConfig = (outputPath = 'md2pdf.config.json') => {
  const sampleConfig = {
    theme: 'professional',
    mermaidTheme: 'default',
    
    pageSize: 'A4',
    margins: {
      top: '0.6in',
      right: '0.6in',
      bottom: '0.6in',
      left: '0.6in'
    },
    
    coverPage: true,
    coverTitle: 'Document Title',
    coverSubtitle: 'Subtitle or description',
    coverAuthor: 'Author Name',
    coverOrganization: 'Organization Name',
    coverLogo: '',
    coverVersion: '1.0',
    coverConfidential: false,
    
    toc: true,
    tocTitle: 'Table of Contents',
    tocMaxLevel: 3,
    
    watermark: '',
    watermarkOpacity: 0.08,
    
    showPageNumbers: true,
    headerText: '',
    footerText: '',
    
    printBackground: true,
    mathSupport: true,
    timeout: 90000
  };

  fs.writeFileSync(outputPath, JSON.stringify(sampleConfig, null, 2));
  return outputPath;
};

module.exports = {
  DEFAULT_CONFIG,
  findConfigFile,
  findConfigByName,
  listConfigs,
  getConfigsDir,
  loadConfigFile,
  mergeConfigs,
  resolveConfig,
  validateConfig,
  generateSampleConfig
};
