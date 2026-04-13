/**
 * md2pdf Web UI Server
 * 
 * A deployable web interface for converting Markdown to PDF
 * with live preview and Mermaid diagram export.
 * 
 * Security features:
 *   - Security headers (CSP, X-Frame-Options, etc.)
 *   - Rate limiting
 *   - Path traversal protection
 *   - Input validation
 *   - File type validation
 */

const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');

// Import md2pdf core modules
const { markdownToPdfBuffer } = require('../src');
const { exportMermaidImages, extractMermaidBlocks, renderMermaidToPng } = require('../src/mermaid-export');
const { renderToHtml } = require('../src/renderer');
const { parseMarkdown } = require('../src/parser');
const { resolveConfig } = require('../src/config');

const app = express();
const PORT = process.env.PORT || 3000;
const isProduction = process.env.NODE_ENV === 'production';

// ============================================
// SECURITY: Rate Limiting
// ============================================
const rateLimitStore = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 200; // 200 requests per minute
const RATE_LIMIT_MAX_CONVERTS = 30; // 30 PDF conversions per minute

const rateLimit = (key, maxRequests) => {
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW;
  
  if (!rateLimitStore.has(key)) {
    rateLimitStore.set(key, []);
  }
  
  const requests = rateLimitStore.get(key).filter(time => time > windowStart);
  requests.push(now);
  rateLimitStore.set(key, requests);
  
  return requests.length <= maxRequests;
};

// Clean up old rate limit entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW;
  rateLimitStore.forEach((times, key) => {
    const filtered = times.filter(time => time > windowStart);
    if (filtered.length === 0) rateLimitStore.delete(key);
    else rateLimitStore.set(key, filtered);
  });
}, 5 * 60 * 1000);

// Rate limit middleware
const rateLimitMiddleware = (maxRequests = RATE_LIMIT_MAX_REQUESTS) => (req, res, next) => {
  const clientIP = req.ip || req.connection.remoteAddress || 'unknown';
  
  if (!rateLimit(clientIP, maxRequests)) {
    return res.status(429).json({ 
      error: 'Too many requests. Please try again later.',
      retryAfter: Math.ceil(RATE_LIMIT_WINDOW / 1000)
    });
  }
  next();
};

// ============================================
// SECURITY: Headers
// ============================================
const securityHeaders = (req, res, next) => {
  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  
  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // XSS protection
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // Referrer policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Permissions policy
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  
  // Content Security Policy
  const nonce = crypto.randomBytes(16).toString('base64');
  res.locals.nonce = nonce;
  
  if (isProduction) {
    res.setHeader('Content-Security-Policy', [
      "default-src 'self'",
      `script-src 'self' 'nonce-${nonce}' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com`,
      "style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com",
      "img-src 'self' data: blob:",
      "font-src 'self' https://cdnjs.cloudflare.com",
      "connect-src 'self'",
      "frame-ancestors 'self'"
    ].join('; '));
  }
  
  // HSTS in production
  if (isProduction) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  
  next();
};

// ============================================
// SECURITY: Path Traversal Protection
// ============================================
const sanitizePath = (inputPath) => {
  // Remove null bytes
  let clean = inputPath.replace(/\0/g, '');
  
  // Normalize path separators
  clean = clean.replace(/\\/g, '/');
  
  // Remove path traversal sequences
  clean = clean.replace(/\.\.\//g, '').replace(/\.\.$/g, '');
  
  // Remove leading slashes
  clean = clean.replace(/^\/+/, '');
  
  // Only allow safe characters
  clean = clean.replace(/[^a-zA-Z0-9_\-./]/g, '');
  
  return clean;
};

const isPathSafe = (targetPath, allowedBase) => {
  const resolved = path.resolve(allowedBase, targetPath);
  return resolved.startsWith(path.resolve(allowedBase));
};

// ============================================
// SECURITY: Input Validation
// ============================================
const validateMarkdown = (markdown) => {
  if (typeof markdown !== 'string') return false;
  if (markdown.length > 1024 * 1024) return false; // Max 1MB
  return true;
};

const validateTheme = (theme) => {
  const allowedThemes = ['github', 'professional', 'academic', 'minimal', 'default'];
  return allowedThemes.includes(theme);
};

const validateFormat = (format) => {
  const allowedFormats = ['A4', 'Letter', 'Legal', 'A3', 'A5'];
  return allowedFormats.includes(format);
};

// ============================================
// Middleware Setup
// ============================================
app.use(securityHeaders);
app.use(rateLimitMiddleware());

// CORS - restrict in production
const corsOptions = {
  origin: isProduction ? process.env.ALLOWED_ORIGINS?.split(',') || false : true,
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type'],
  maxAge: 86400 // 24 hours
};
app.use(cors(corsOptions));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// File upload config with security
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { 
    fileSize: 10 * 1024 * 1024, // 10MB
    files: 1 // Only 1 file at a time
  },
  fileFilter: (req, file, cb) => {
    // Only allow markdown files
    const allowedMimes = ['text/markdown', 'text/plain', 'text/x-markdown', 'application/octet-stream'];
    const allowedExts = ['.md', '.markdown', '.txt'];
    const ext = path.extname(file.originalname).toLowerCase();
    
    if (allowedExts.includes(ext) || allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only markdown files are allowed'), false);
    }
  }
});

// Track current working directory for file operations
let currentWorkingDir = path.join(__dirname, '..');

// Temp directory for processing
const getTempDir = () => {
  const dir = path.join(os.tmpdir(), 'md2pdf-web');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
};

/**
 * GET /api/image/* - Serve local images from workspace
 * SECURITY: Path traversal protection applied
 */
app.get('/api/image/*', (req, res) => {
  // Sanitize the image path to prevent path traversal
  const rawPath = req.params[0];
  const imagePath = sanitizePath(rawPath);
  
  // Only allow image extensions
  const ext = path.extname(imagePath).toLowerCase();
  const allowedExts = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp'];
  if (!allowedExts.includes(ext)) {
    return res.status(400).json({ error: 'Invalid file type' });
  }
  
  // Allowed base directories
  const allowedBases = [
    currentWorkingDir,
    path.join(currentWorkingDir, 'examples'),
    path.join(__dirname, '..'),
    path.join(__dirname, '..', 'examples')
  ];
  
  // Try to find the image in allowed locations
  for (const base of allowedBases) {
    const fullPath = path.resolve(base, imagePath);
    
    // Security: Ensure the resolved path is within the allowed base
    if (!fullPath.startsWith(path.resolve(base))) {
      continue; // Path traversal attempt - skip this base
    }
    
    if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
      const mimeTypes = {
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.gif': 'image/gif',
        '.svg': 'image/svg+xml',
        '.webp': 'image/webp'
      };
      res.setHeader('Content-Type', mimeTypes[ext] || 'application/octet-stream');
      res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 24h
      return res.sendFile(fullPath);
    }
  }
  
  res.status(404).json({ error: 'Image not found' });
});

/**
 * GET /api/themes - List available themes
 */
app.get('/api/themes', (req, res) => {
  const themesDir = path.join(__dirname, '../src/themes');
  const themes = fs.readdirSync(themesDir)
    .filter(f => f.endsWith('.css'))
    .map(f => f.replace('.css', ''));
  res.json({ themes });
});

/**
 * GET /api/configs - List available configs
 */
app.get('/api/configs', (req, res) => {
  const configsDir = path.join(__dirname, '../configs');
  if (!fs.existsSync(configsDir)) {
    return res.json({ configs: [] });
  }
  const configs = fs.readdirSync(configsDir)
    .filter(f => f.endsWith('.json'))
    .map(f => f.replace('.json', ''));
  res.json({ configs });
});

/**
 * POST /api/preview - Generate HTML preview from markdown
 * SECURITY: Input validation applied
 */
app.post('/api/preview', async (req, res) => {
  try {
    const { markdown, theme = 'github' } = req.body;
    
    // Validate input
    if (!markdown) {
      return res.status(400).json({ error: 'No markdown content provided' });
    }
    
    if (!validateMarkdown(markdown)) {
      return res.status(400).json({ error: 'Invalid markdown content' });
    }
    
    // Validate theme (use default if invalid)
    const safeTheme = validateTheme(theme) ? theme : 'github';

    // Parse markdown
    const parsed = parseMarkdown(markdown);
    
    // Get theme CSS - sanitize theme name
    const themeName = safeTheme.replace(/[^a-z]/g, '');
    const themePath = path.join(__dirname, `../src/themes/${themeName}.css`);
    const themeCSS = fs.existsSync(themePath) 
      ? fs.readFileSync(themePath, 'utf-8')
      : '';

    // Generate HTML (for preview, we use a simplified version)
    const html = renderToHtml(parsed.content, {
      title: parsed.frontmatter?.title || 'Preview',
      theme: themeCSS,
      enableMermaid: true
    });

    res.json({ html, frontmatter: parsed.frontmatter });
  } catch (error) {
    console.error('Preview error:', error);
    res.status(500).json({ error: 'Preview generation failed' });
  }
});

/**
 * POST /api/convert - Convert markdown to PDF
 * SECURITY: Rate limited (10/min), input validated
 */
app.post('/api/convert', rateLimitMiddleware(RATE_LIMIT_MAX_CONVERTS), upload.single('file'), async (req, res) => {
  try {
    let markdown;
    
    // Get markdown from file upload or request body
    if (req.file) {
      markdown = req.file.buffer.toString('utf-8');
    } else if (req.body.markdown) {
      markdown = req.body.markdown;
    } else {
      return res.status(400).json({ error: 'No markdown content provided' });
    }

    // Validate markdown
    if (!validateMarkdown(markdown)) {
      return res.status(400).json({ error: 'Invalid or too large markdown content' });
    }

    // Validate and sanitize options
    const theme = validateTheme(req.body.theme) ? req.body.theme : 'github';
    
    // Auto-detect Gantt charts and pre-render them as PNG for proper sizing
    const hasGantt = /```mermaid[\s\S]*?gantt[\s\S]*?```/i.test(markdown);
    
    if (hasGantt) {
      // Pre-render Gantt charts using the same engine as CLI
      const blocks = extractMermaidBlocks(markdown);
      for (const block of blocks) {
        if (/^\s*gantt/im.test(block.code)) {
          try {
            const result = await renderMermaidToPng(block.code, {
              theme: 'default',
              backgroundColor: 'white',
              scale: 2
            });
            // renderMermaidToPng returns { buffer, width, height }
            const base64 = result.buffer.toString('base64');
            // Replace mermaid block with embedded image
            markdown = markdown.replace(
              block.fullMatch,
              `\n\n![Gantt Chart](data:image/png;base64,${base64})\n\n`
            );
          } catch (err) {
            console.error('Gantt pre-render failed:', err.message);
          }
        }
      }
    }
    
    const format = hasGantt ? 'A3' : (validateFormat(req.body.format) ? req.body.format : 'A4');
    const landscape = req.body.landscape === 'true' || hasGantt;
    
    const options = {
      theme,
      format,
      landscape,
      margin: hasGantt ? '10mm' : (req.body.margin || '20mm')
    };

    // Convert to PDF using buffer API
    const pdfBuffer = await markdownToPdfBuffer(markdown, options);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="document.pdf"');
    res.send(pdfBuffer);

  } catch (error) {
    console.error('Conversion error:', error);
    res.status(500).json({ error: 'PDF conversion failed' });
  }
});

/**
 * POST /api/export-mermaid - Export Mermaid diagrams as images
 * SECURITY: Rate limited, input validated
 */
app.post('/api/export-mermaid', rateLimitMiddleware(RATE_LIMIT_MAX_CONVERTS), upload.single('file'), async (req, res) => {
  const tempDir = getTempDir();
  const timestamp = Date.now();
  const randomSuffix = crypto.randomBytes(8).toString('hex');
  const inputPath = path.join(tempDir, `input-${timestamp}-${randomSuffix}.md`);
  const imagesDir = path.join(tempDir, `images-${timestamp}-${randomSuffix}`);

  try {
    let markdown;
    
    if (req.file) {
      markdown = req.file.buffer.toString('utf-8');
    } else if (req.body.markdown) {
      markdown = req.body.markdown;
    } else {
      return res.status(400).json({ error: 'No markdown content provided' });
    }

    // Validate markdown
    if (!validateMarkdown(markdown)) {
      return res.status(400).json({ error: 'Invalid or too large markdown content' });
    }

    // Check for mermaid blocks
    const blocks = extractMermaidBlocks(markdown);
    if (blocks.length === 0) {
      return res.json({ 
        success: true, 
        message: 'No Mermaid diagrams found',
        images: [],
        markdown: markdown
      });
    }

    // Validate scale (1-4)
    const scale = Math.min(4, Math.max(1, parseInt(req.body.scale) || 2));
    
    // Validate background color (basic check)
    const bgColors = ['white', 'transparent', '#ffffff', '#fff'];
    const backgroundColor = bgColors.includes(req.body.background) ? req.body.background : 'white';

    // Write temp file
    fs.writeFileSync(inputPath, markdown);

    // Export mermaid images
    const result = await exportMermaidImages(inputPath, {
      outputDir: tempDir,
      imageDir: `images-${timestamp}-${randomSuffix}`,
      theme: validateTheme(req.body.theme) ? req.body.theme : 'default',
      backgroundColor,
      scale
    });

    // Read the generated images as base64
    const images = [];
    if (result.results) {
      for (const r of result.results) {
        if (r.success && fs.existsSync(r.imagePath)) {
          const imgBuffer = fs.readFileSync(r.imagePath);
          images.push({
            name: r.name,
            data: `data:image/png;base64,${imgBuffer.toString('base64')}`
          });
        }
      }
    }

    // Read modified markdown
    const modifiedMarkdown = fs.existsSync(result.outputMarkdownPath)
      ? fs.readFileSync(result.outputMarkdownPath, 'utf-8')
      : markdown;

    // Cleanup
    fs.unlinkSync(inputPath);
    if (fs.existsSync(result.outputMarkdownPath)) {
      fs.unlinkSync(result.outputMarkdownPath);
    }
    if (fs.existsSync(imagesDir)) {
      fs.readdirSync(imagesDir).forEach(f => fs.unlinkSync(path.join(imagesDir, f)));
      fs.rmdirSync(imagesDir);
    }

    res.json({
      success: true,
      message: `Exported ${images.length} diagram(s)`,
      images,
      markdown: modifiedMarkdown
    });

  } catch (error) {
    console.error('Mermaid export error:', error);
    // Cleanup on error
    [inputPath].forEach(f => {
      if (fs.existsSync(f)) fs.unlinkSync(f);
    });
    res.status(500).json({ error: 'Mermaid export failed' });
  }
});

/**
 * GET /health - Health check for deployments
 */
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

/**
 * GET /local-images/* - Serve images from workspace for local development
 * This allows markdown files to reference local images
 */
app.get('/local-images/*', (req, res) => {
  const imagePath = req.params[0];
  
  // Security: validate path
  if (!imagePath || imagePath.includes('..') || path.isAbsolute(imagePath)) {
    return res.status(400).json({ error: 'Invalid path' });
  }
  
  // Serve from workspace root (parent of web-ui)
  const fullPath = path.join(__dirname, '..', imagePath);
  
  if (!fs.existsSync(fullPath)) {
    return res.status(404).json({ error: 'Image not found' });
  }
  
  // Only allow image files
  const ext = path.extname(fullPath).toLowerCase();
  const allowedExts = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'];
  if (!allowedExts.includes(ext)) {
    return res.status(400).json({ error: 'Invalid file type' });
  }
  
  res.sendFile(fullPath);
});

// Serve index.html for all other routes (SPA support)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ============================================
// SECURITY: Global Error Handler
// ============================================
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  
  // Don't leak error details in production
  const message = isProduction ? 'Internal server error' : err.message;
  
  res.status(500).json({ error: message });
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
  // In production, you might want to gracefully shutdown
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled rejection at:', promise, 'reason:', reason);
});

// Start server
app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════════╗
║                   md2pdf Web UI                      ║
╠══════════════════════════════════════════════════════╣
║  Server running at: http://localhost:${PORT}             ║
║                                                      ║
║  Features:                                           ║
║    • Live Markdown preview with Mermaid support      ║
║    • Convert Markdown to PDF                         ║
║    • Export Mermaid diagrams as PNG                  ║
║    • Multiple themes available                       ║
╚══════════════════════════════════════════════════════╝
  `);
});

module.exports = app;
