/**
 * md2pdf - PDF Generator Module
 * 
 * Generates PDF documents from HTML using Puppeteer headless browser.
 * Features:
 *   - Mermaid diagram rendering with timeout handling
 *   - Multiple page formats (A4, A3, Letter, Legal, Tabloid)
 *   - Configurable margins and backgrounds
 *   - Optional header/footer templates with page numbers
 *   - Buffer generation for streaming
 *   - Browser preview mode for development
 */

const puppeteer = require('puppeteer');

const PAGE_FORMATS = {
  A4: { width: '210mm', height: '297mm' },
  A3: { width: '297mm', height: '420mm' },
  Letter: { width: '8.5in', height: '11in' },
  Legal: { width: '8.5in', height: '14in' },
  Tabloid: { width: '11in', height: '17in' }
};

const DEFAULT_OPTIONS = {
  format: 'A4',
  margin: { top: '0.6in', right: '0.6in', bottom: '0.6in', left: '0.6in' },
  printBackground: true,
  displayHeaderFooter: false,
  preferCSSPageSize: false,
  timeout: 90000
};

const launchBrowser = async () => {
  return puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--disable-gpu',
      '--window-size=1920,1080'
    ],
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined
  });
};

const waitForMermaid = async (page, timeout = 45000) => {
  return page.evaluate((maxWait) => {
    return new Promise((resolve) => {
      const check = () => {
        const elapsed = Date.now() - window.__startTime;
        
        if (window.mermaidRendered) {
          resolve({
            success: true,
            elapsed,
            state: window.mermaidRenderState || { total: 0, rendered: 0, errors: [] }
          });
          return;
        }
        
        if (elapsed >= maxWait) {
          resolve({
            success: false,
            elapsed,
            error: 'Mermaid rendering timed out',
            state: window.mermaidRenderState || { total: 0, rendered: 0, errors: [] }
          });
          return;
        }
        
        setTimeout(check, 100);
      };
      
      window.__startTime = Date.now();
      check();
    });
  }, timeout);
};

const generatePdf = async (html, outputPath, options = {}) => {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const stats = {
    startTime: Date.now(),
    mermaidDiagrams: 0,
    mermaidErrors: [],
    pageCount: 0
  };

  let browser;
  
  try {
    browser = await launchBrowser();
    const page = await browser.newPage();
    
    // Use much larger viewport for Gantt charts in A3 landscape
    const isA3Landscape = opts.format === 'A3' && opts.landscape;
    const viewportWidth = isA3Landscape ? 2400 : 1400;
    await page.setViewport({
      width: viewportWidth,
      height: 1400,
      deviceScaleFactor: 2
    });

    await page.setContent(html, {
      waitUntil: ['networkidle0', 'domcontentloaded'],
      timeout: opts.timeout
    });

    const mermaidResult = await waitForMermaid(page, opts.timeout);
    
    if (mermaidResult.state) {
      stats.mermaidDiagrams = mermaidResult.state.total;
      stats.mermaidErrors = mermaidResult.state.errors || [];
    }

    // For Gantt charts, don't constrain width
    await page.evaluate((isA3L) => {
      document.querySelectorAll('.mermaid svg').forEach(svg => {
        const isGantt = svg.querySelector('.grid') || svg.innerHTML.includes('section');
        if (isGantt && isA3L) {
          svg.style.maxWidth = 'none';
          svg.style.width = 'auto';
        } else {
          svg.style.maxWidth = '100%';
        }
        svg.style.height = 'auto';
        svg.style.display = 'block';
        svg.style.overflow = 'visible';
      });
    }, isA3Landscape);

    await page.evaluate(() => new Promise(r => setTimeout(r, 500)));

    const pdfOptions = {
      path: outputPath,
      format: opts.format,
      landscape: opts.landscape || false,
      margin: opts.margin,
      printBackground: opts.printBackground,
      displayHeaderFooter: opts.displayHeaderFooter,
      preferCSSPageSize: opts.preferCSSPageSize,
      tagged: opts.pdfOutline !== false
    };

    if (opts.headerTemplate || opts.footerTemplate) {
      pdfOptions.displayHeaderFooter = true;
      pdfOptions.headerTemplate = opts.headerTemplate || '<span></span>';
      pdfOptions.footerTemplate = opts.footerTemplate || `
        <div style="font-size: 10px; text-align: center; width: 100%; color: #666;">
          <span class="pageNumber"></span> / <span class="totalPages"></span>
        </div>
      `;
    }

    await page.pdf(pdfOptions);

    stats.endTime = Date.now();
    stats.duration = stats.endTime - stats.startTime;
    stats.success = true;

    return stats;

  } catch (error) {
    stats.endTime = Date.now();
    stats.duration = stats.endTime - stats.startTime;
    stats.success = false;
    stats.error = error.message;
    throw error;

  } finally {
    if (browser) {
      await browser.close();
    }
  }
};

const generatePdfBuffer = async (html, options = {}) => {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let browser;

  try {
    browser = await launchBrowser();
    const page = await browser.newPage();

    // Use much larger viewport for Gantt charts in A3 landscape
    // A3 landscape is 420mm x 297mm = ~1587 x 1122 points at 96 DPI
    const isA3Landscape = opts.format === 'A3' && opts.landscape;
    const viewportWidth = isA3Landscape ? 2400 : 1400;
    await page.setViewport({
      width: viewportWidth,
      height: 1400,
      deviceScaleFactor: 2
    });

    await page.setContent(html, {
      waitUntil: ['networkidle0', 'domcontentloaded'],
      timeout: opts.timeout
    });

    await waitForMermaid(page, opts.timeout);
    
    // For Gantt charts, don't constrain width - let PDF scaling handle it
    await page.evaluate((isA3L) => {
      document.querySelectorAll('.mermaid svg').forEach(svg => {
        const isGantt = svg.querySelector('.grid') || svg.innerHTML.includes('section');
        if (isGantt && isA3L) {
          // Don't constrain Gantt width - let it use full space
          svg.style.maxWidth = 'none';
          svg.style.width = 'auto';
        } else {
          svg.style.maxWidth = '100%';
        }
        svg.style.height = 'auto';
        svg.style.display = 'block';
        svg.style.overflow = 'visible';
      });
    }, isA3Landscape);
    
    await page.evaluate(() => new Promise(r => setTimeout(r, 500)));

    const buffer = await page.pdf({
      format: opts.format,
      landscape: opts.landscape || false,
      margin: opts.margin,
      printBackground: opts.printBackground
    });

    return buffer;

  } finally {
    if (browser) {
      await browser.close();
    }
  }
};

const previewInBrowser = async (html) => {
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--start-maximized']
  });
  
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle0' });
  
  return { browser, page };
};

module.exports = {
  generatePdf,
  generatePdfBuffer,
  previewInBrowser,
  launchBrowser,
  PAGE_FORMATS,
  DEFAULT_OPTIONS
};
