/**
 * md2pdf - Watch Module
 * 
 * Provides file watching for live PDF regeneration.
 * Features:
 *   - Debounced file change detection
 *   - Initial batch conversion on start
 *   - Timestamped status messages
 *   - Graceful shutdown handling
 */

const chokidar = require('chokidar');
const chalk = require('chalk');
const path = require('path');

const debounce = (func, wait) => {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
};

const formatTime = () => {
  return new Date().toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
};

const watchFiles = async (files, options, config, convertFile) => {
  console.log(chalk.cyan('\n👀 Watch mode enabled\n'));
  console.log(chalk.dim('Watching files:'));
  files.forEach(file => {
    console.log(chalk.dim(`  • ${path.basename(file)}`));
  });
  console.log('');
  console.log(chalk.dim('Press Ctrl+C to stop\n'));
  console.log(chalk.dim('─'.repeat(50)));

  for (const file of files) {
    try {
      console.log(chalk.dim(`[${formatTime()}]`) + ` Converting ${path.basename(file)}...`);
      const result = await convertFile(file, null, config, null);
      console.log(chalk.green(`[${formatTime()}]`) + ` Created: ${path.basename(result.output)}`);
    } catch (error) {
      console.log(chalk.red(`[${formatTime()}]`) + ` Error: ${error.message}`);
    }
  }

  console.log(chalk.dim('─'.repeat(50)));
  console.log(chalk.cyan('\nWaiting for changes...\n'));

  const watcher = chokidar.watch(files, {
    persistent: true,
    ignoreInitial: true,
    awaitWriteFinish: {
      stabilityThreshold: 300,
      pollInterval: 100
    }
  });

  const fileHandlers = new Map();

  const handleFileChange = (filePath) => {
    if (!fileHandlers.has(filePath)) {
      fileHandlers.set(filePath, debounce(async (fp) => {
        console.log(chalk.yellow(`[${formatTime()}]`) + ` Change detected: ${path.basename(fp)}`);
        
        try {
          const result = await convertFile(fp, null, config, null);
          console.log(chalk.green(`[${formatTime()}]`) + ` Updated: ${path.basename(result.output)}`);
          
          if (result.stats.mermaidErrors && result.stats.mermaidErrors.length > 0) {
            console.log(chalk.yellow(`  ⚠ ${result.stats.mermaidErrors.length} Mermaid error(s)`));
          }
        } catch (error) {
          console.log(chalk.red(`[${formatTime()}]`) + ` Error: ${error.message}`);
        }
        
        console.log('');
      }, 500));
    }

    fileHandlers.get(filePath)(filePath);
  };

  watcher.on('change', handleFileChange);

  watcher.on('error', error => {
    console.error(chalk.red(`Watcher error: ${error.message}`));
  });

  const cleanup = () => {
    console.log(chalk.dim('\n\nStopping watch mode...'));
    watcher.close();
    process.exit(0);
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);

  return new Promise(() => {});
};

module.exports = { watchFiles };
