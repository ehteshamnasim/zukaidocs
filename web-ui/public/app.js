/**
 * MarkFlow Web UI - Frontend Application
 */

// DOM Elements
const editor = document.getElementById('editor');
const preview = document.getElementById('preview');
const previewPanel = document.getElementById('previewPanel');
const charCount = document.getElementById('charCount');
const fileInput = document.getElementById('fileInput');
const themeSelect = document.getElementById('themeSelect');
const formatSelect = document.getElementById('formatSelect');
const downloadPdfBtn = document.getElementById('downloadPdfBtn');
const exportMermaidBtn = document.getElementById('exportMermaidBtn');
const refreshPreview = document.getElementById('refreshPreview');
const fullscreenBtn = document.getElementById('fullscreenBtn');
const dropZone = document.getElementById('dropZone');
const loadingOverlay = document.getElementById('loadingOverlay');
const loadingText = document.getElementById('loadingText');
const toastContainer = document.getElementById('toastContainer');
const resizeHandle = document.getElementById('resizeHandle');
const aboutBtn = document.getElementById('aboutBtn');
const aboutModal = document.getElementById('aboutModal');
const closeAboutBtn = document.getElementById('closeAboutBtn');

// State
let previewTimeout = null;
const PREVIEW_DELAY = 300;
let themeCache = {};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  initMermaid();
  loadThemes();
  setupEventListeners();
  setupDragDrop();
  setupResizeHandle();
  
  // Load sample content if editor is empty
  if (!editor.value.trim()) {
    editor.value = getSampleMarkdown();
    updateCharCount();
    updatePreview();
  }
});

// Initialize Mermaid
function initMermaid() {
  mermaid.initialize({
    startOnLoad: false,
    theme: 'default',
    securityLevel: 'loose',
    fontFamily: 'Inter, system-ui, sans-serif',
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
    flowchart: {
      useMaxWidth: false,
      htmlLabels: true
    },
    sequence: {
      useMaxWidth: false
    }
  });
}

// Load available themes
async function loadThemes() {
  try {
    const response = await fetch('/api/themes');
    const data = await response.json();
    
    themeSelect.innerHTML = data.themes.map(theme => 
      `<option value="${theme}">${theme.charAt(0).toUpperCase() + theme.slice(1)} Theme</option>`
    ).join('');
    
    // Pre-load first theme
    await loadThemeCSS(themeSelect.value);
  } catch (error) {
    console.log('Using default themes');
  }
}

// Load and cache theme CSS
async function loadThemeCSS(themeName) {
  if (themeCache[themeName]) {
    return themeCache[themeName];
  }
  
  try {
    const response = await fetch(`/api/theme/${themeName}`);
    if (response.ok) {
      const css = await response.text();
      themeCache[themeName] = css;
      return css;
    }
  } catch (error) {
    console.log('Could not load theme:', themeName);
  }
  return '';
}

// Apply theme CSS to preview
function applyThemeToPreview(css) {
  let styleEl = document.getElementById('preview-theme-style');
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = 'preview-theme-style';
    document.head.appendChild(styleEl);
  }
  
  // Scope the CSS to .preview
  const scopedCSS = css
    .replace(/body\s*\{/g, '.preview {')
    .replace(/html\s*\{/g, '.preview {');
  
  styleEl.textContent = scopedCSS;
}

// Setup event listeners
function setupEventListeners() {
  // Editor input
  editor.addEventListener('input', () => {
    updateCharCount();
    debouncePreview();
  });

  // File input
  fileInput.addEventListener('change', handleFileSelect);

  // Theme change
  themeSelect.addEventListener('change', updatePreview);

  // Refresh preview
  refreshPreview.addEventListener('click', updatePreview);

  // Fullscreen toggle
  fullscreenBtn.addEventListener('click', toggleFullscreen);

  // Download PDF
  downloadPdfBtn.addEventListener('click', handleDownloadPdf);

  // Export Mermaid
  exportMermaidBtn.addEventListener('click', handleExportMermaid);

  // About modal
  aboutBtn.addEventListener('click', () => aboutModal.classList.remove('hidden'));
  closeAboutBtn.addEventListener('click', () => aboutModal.classList.add('hidden'));
  aboutModal.addEventListener('click', (e) => {
    if (e.target === aboutModal) aboutModal.classList.add('hidden');
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', handleKeyboardShortcuts);
}

// Toggle fullscreen preview
function toggleFullscreen() {
  previewPanel.classList.toggle('fullscreen');
  
  // Update button title
  const isFullscreen = previewPanel.classList.contains('fullscreen');
  fullscreenBtn.title = isFullscreen ? 'Exit Fullscreen (Esc)' : 'Fullscreen Preview (F11)';
  
  // Add escape key handler when fullscreen
  if (isFullscreen) {
    document.addEventListener('keydown', handleFullscreenEscape);
  } else {
    document.removeEventListener('keydown', handleFullscreenEscape);
  }
}

// Handle escape key in fullscreen
function handleFullscreenEscape(e) {
  if (e.key === 'Escape' && previewPanel.classList.contains('fullscreen')) {
    toggleFullscreen();
  }
}

// Setup drag and drop
function setupDragDrop() {
  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    document.body.addEventListener(eventName, preventDefaults, false);
  });

  ['dragenter', 'dragover'].forEach(eventName => {
    document.body.addEventListener(eventName, () => {
      dropZone.classList.add('active');
    }, false);
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, () => {
      dropZone.classList.remove('active');
    }, false);
  });

  dropZone.addEventListener('drop', handleDrop, false);
}

function preventDefaults(e) {
  e.preventDefault();
  e.stopPropagation();
}

function handleDrop(e) {
  const files = e.dataTransfer.files;
  if (files.length > 0) {
    loadFile(files[0]);
  }
}

// Setup resize handle
function setupResizeHandle() {
  let isResizing = false;
  let startX;
  let startWidth;

  resizeHandle.addEventListener('mousedown', (e) => {
    isResizing = true;
    startX = e.clientX;
    startWidth = document.querySelector('.editor-panel').offsetWidth;
    resizeHandle.classList.add('active');
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  });

  document.addEventListener('mousemove', (e) => {
    if (!isResizing) return;
    
    const diff = e.clientX - startX;
    const newWidth = startWidth + diff;
    const containerWidth = document.querySelector('.editor-container').offsetWidth;
    const minWidth = 300;
    const maxWidth = containerWidth - minWidth - 4;

    if (newWidth >= minWidth && newWidth <= maxWidth) {
      document.querySelector('.editor-panel').style.flex = `0 0 ${newWidth}px`;
    }
  });

  document.addEventListener('mouseup', () => {
    isResizing = false;
    resizeHandle.classList.remove('active');
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  });
}

// Handle file selection
function handleFileSelect(e) {
  const file = e.target.files[0];
  if (file) {
    loadFile(file);
  }
}

// Load file
function loadFile(file) {
  if (!file.name.match(/\.(md|markdown|txt)$/i)) {
    showToast('Please select a Markdown file (.md)', 'error');
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    editor.value = e.target.result;
    updateCharCount();
    updatePreview();
    showToast(`Loaded: ${file.name}`, 'success');
  };
  reader.onerror = () => {
    showToast('Error reading file', 'error');
  };
  reader.readAsText(file);
}

// Update character count
function updateCharCount() {
  const count = editor.value.length;
  charCount.textContent = `${count.toLocaleString()} chars`;
}

// Debounced preview update
function debouncePreview() {
  clearTimeout(previewTimeout);
  previewTimeout = setTimeout(updatePreview, PREVIEW_DELAY);
}

// Update preview
async function updatePreview() {
  const markdown = editor.value;
  
  if (!markdown.trim()) {
    preview.innerHTML = `
      <div class="preview-placeholder">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.3">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          <polyline points="14 2 14 8 20 8"></polyline>
        </svg>
        <p>Start typing to see preview</p>
      </div>
    `;
    return;
  }

  // Load and apply selected theme
  const selectedTheme = themeSelect.value;
  const themeCSS = await loadThemeCSS(selectedTheme);
  applyThemeToPreview(themeCSS);

  // Convert markdown to HTML using Marked
  let html = marked.parse(markdown, {
    gfm: true,
    breaks: true,
    highlight: function(code, lang) {
      if (lang && hljs.getLanguage(lang)) {
        return hljs.highlight(code, { language: lang }).value;
      }
      return hljs.highlightAuto(code).value;
    }
  });

  // Rewrite local image paths to use local-images API
  // Handle paths like ./schedule-images/..., ./images/..., relative paths
  html = html.replace(/src="\.\/([^"]+\.(png|jpg|jpeg|gif|webp|svg))"/gi, 'src="/local-images/$1"');
  html = html.replace(/src="([^\/"][^"]*\.(png|jpg|jpeg|gif|webp|svg))"/gi, 'src="/local-images/$1"');

  preview.innerHTML = html;

  // Process Mermaid diagrams
  const mermaidElements = preview.querySelectorAll('pre code.language-mermaid');
  for (const el of mermaidElements) {
    const code = el.textContent;
    const container = document.createElement('div');
    container.className = 'mermaid';
    container.textContent = code;
    el.parentElement.replaceWith(container);
  }

  // Also handle ```mermaid blocks that might be parsed differently
  const codeBlocks = preview.querySelectorAll('pre');
  for (const pre of codeBlocks) {
    const code = pre.querySelector('code');
    if (code && code.textContent.trim().match(/^(flowchart|sequenceDiagram|classDiagram|stateDiagram|erDiagram|gantt|pie|journey|gitGraph|mindmap|timeline)/)) {
      const container = document.createElement('div');
      container.className = 'mermaid';
      container.textContent = code.textContent;
      pre.replaceWith(container);
    }
  }

  // Render Mermaid
  try {
    await mermaid.run({
      querySelector: '.mermaid'
    });
  } catch (error) {
    console.log('Mermaid rendering:', error.message);
  }
}

// Handle PDF download
async function handleDownloadPdf() {
  const markdown = editor.value;
  
  if (!markdown.trim()) {
    showToast('Please enter some markdown content', 'error');
    return;
  }

  showLoading('Generating PDF...');

  try {
    const response = await fetch('/api/convert', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        markdown,
        theme: themeSelect.value,
        format: formatSelect.value
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Conversion failed');
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'document.pdf';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast('PDF downloaded successfully!', 'success');
  } catch (error) {
    showToast(`Error: ${error.message}`, 'error');
  } finally {
    hideLoading();
  }
}

// Handle Mermaid export
async function handleExportMermaid() {
  const markdown = editor.value;
  
  if (!markdown.trim()) {
    showToast('Please enter some markdown content', 'error');
    return;
  }

  // Check if there are any mermaid blocks
  if (!markdown.includes('```mermaid')) {
    showToast('No Mermaid diagrams found in the document', 'info');
    return;
  }

  showLoading('Exporting Mermaid diagrams...');

  try {
    const response = await fetch('/api/export-mermaid', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        markdown,
        theme: 'default',
        background: 'white',
        scale: 2
      })
    });

    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      throw new Error('Server error - please try again');
    }

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Export failed');
    }

    if (data.images && data.images.length > 0) {
      // Download each image
      for (const img of data.images) {
        const a = document.createElement('a');
        a.href = img.data;
        a.download = `${img.name}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
      showToast(`Exported ${data.images.length} diagram(s)!`, 'success');
    } else {
      showToast('No diagrams were exported', 'info');
    }
  } catch (error) {
    showToast(`Error: ${error.message}`, 'error');
  } finally {
    hideLoading();
  }
}

// Keyboard shortcuts
function handleKeyboardShortcuts(e) {
  // F11 = Toggle fullscreen
  if (e.key === 'F11') {
    e.preventDefault();
    toggleFullscreen();
  }
  
  // Cmd/Ctrl + S = Download PDF
  if ((e.metaKey || e.ctrlKey) && e.key === 's') {
    e.preventDefault();
    handleDownloadPdf();
  }
  
  // Cmd/Ctrl + E = Export Mermaid
  if ((e.metaKey || e.ctrlKey) && e.key === 'e') {
    e.preventDefault();
    handleExportMermaid();
  }
}

// Show loading overlay
function showLoading(text = 'Loading...') {
  loadingText.textContent = text;
  loadingOverlay.classList.remove('hidden');
}

// Hide loading overlay
function hideLoading() {
  loadingOverlay.classList.add('hidden');
}

// Show toast notification
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span>${message}</span>
  `;
  toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'slideIn 0.3s ease reverse';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// Sample markdown content
function getSampleMarkdown() {
  return `# Welcome to ZukaiDocs

This is a **live preview** editor for converting Markdown to PDF.

## Features

- 📝 Live preview with syntax highlighting
- 🎨 Multiple themes available
- 📊 Full Mermaid diagram support
- 📄 Export to PDF
- 🖼️ Export Mermaid diagrams as images

## Mermaid Diagrams

Here's a flowchart example:

\`\`\`mermaid
flowchart LR
    A[Write Markdown] --> B{Has Diagrams?}
    B -->|Yes| C[Render Mermaid]
    B -->|No| D[Convert to PDF]
    C --> D
    D --> E[Download]
\`\`\`

## Code Highlighting

\`\`\`javascript
function greet(name) {
  console.log(\`Hello, \${name}!\`);
}

greet('World');
\`\`\`

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| Cmd/Ctrl + S | Download PDF |
| Cmd/Ctrl + E | Export Mermaid |

---

*Drop any .md file here to open it!*
`;
}
