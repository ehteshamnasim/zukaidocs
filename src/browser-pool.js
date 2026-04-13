/**
 * Browser Pool - Singleton Puppeteer browser instance
 * 
 * Reuses a single browser instance for all PDF/Mermaid operations,
 * significantly reducing overhead for repeated operations.
 */

const puppeteer = require('puppeteer');

let browserInstance = null;
let browserPromise = null;
let lastUsed = Date.now();
const IDLE_TIMEOUT = 5 * 60 * 1000; // 5 minutes

const BROWSER_ARGS = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',
  '--disable-accelerated-2d-canvas',
  '--disable-gpu',
  '--window-size=1920,1080',
  '--single-process', // Reduces memory on constrained systems
  '--no-zygote'
];

/**
 * Get or create a browser instance
 */
const getBrowser = async () => {
  lastUsed = Date.now();
  
  // Return existing browser if valid
  if (browserInstance && browserInstance.isConnected()) {
    return browserInstance;
  }
  
  // Wait for in-progress launch
  if (browserPromise) {
    return browserPromise;
  }
  
  // Launch new browser
  browserPromise = puppeteer.launch({
    headless: 'new',
    args: BROWSER_ARGS,
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined
  });
  
  try {
    browserInstance = await browserPromise;
    browserPromise = null;
    
    // Handle unexpected disconnection
    browserInstance.on('disconnected', () => {
      browserInstance = null;
      browserPromise = null;
    });
    
    return browserInstance;
  } catch (error) {
    browserPromise = null;
    throw error;
  }
};

/**
 * Get a new page from the browser pool
 */
const getPage = async () => {
  const browser = await getBrowser();
  const page = await browser.newPage();
  
  // Set default viewport
  await page.setViewport({
    width: 1400,
    height: 1400,
    deviceScaleFactor: 2
  });
  
  return page;
};

/**
 * Release a page (close it)
 */
const releasePage = async (page) => {
  try {
    if (page && !page.isClosed()) {
      await page.close();
    }
  } catch (e) {
    // Page already closed
  }
};

/**
 * Close browser if idle for too long
 */
const checkIdleTimeout = async () => {
  if (browserInstance && Date.now() - lastUsed > IDLE_TIMEOUT) {
    await closeBrowser();
  }
};

/**
 * Forcefully close the browser
 */
const closeBrowser = async () => {
  if (browserInstance) {
    try {
      await browserInstance.close();
    } catch (e) {
      // Already closed
    }
    browserInstance = null;
    browserPromise = null;
  }
};

// Check idle timeout every minute
setInterval(checkIdleTimeout, 60000);

// Cleanup on process exit
process.on('exit', () => {
  if (browserInstance) {
    browserInstance.close().catch(() => {});
  }
});

process.on('SIGINT', async () => {
  await closeBrowser();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await closeBrowser();
  process.exit(0);
});

module.exports = {
  getBrowser,
  getPage,
  releasePage,
  closeBrowser
};
