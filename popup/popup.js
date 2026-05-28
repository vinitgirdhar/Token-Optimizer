/**
 * Claude Token Optimizer - Dashboard & Playground Controller
 */

document.addEventListener('DOMContentLoaded', async function () {
  'use strict';

  // State
  let statistics = {
    totalFilesOptimized: 0,
    totalOriginalBytes: 0,
    totalOptimizedBytes: 0,
    totalTokensSaved: 0
  };

  // DOM Elements
  const tabs = document.querySelectorAll('.nav-btn');
  const tabContents = document.querySelectorAll('.tab-content');
  const appNav = document.querySelector('.app-nav');

  // Stats Elements
  const statFiles = document.getElementById('stat-files');
  const statRatio = document.getElementById('stat-ratio');
  const ratioBarFill = document.getElementById('ratio-bar-fill');
  const metricOriginal = document.getElementById('metric-original');
  const metricOptimized = document.getElementById('metric-optimized');

  // Settings Elements
  const togglePdf = document.getElementById('setting-pdf');
  const toggleDocx = document.getElementById('setting-docx');
  const toggleXlsx = document.getElementById('setting-xlsx');
  const toggleCsv = document.getElementById('setting-csv');
  const templateInput = document.getElementById('setting-template');
  const resetStatsBtn = document.getElementById('setting-reset-stats');

  // Playground Elements
  const playDropzone = document.getElementById('play-dropzone');
  const playFileInput = document.getElementById('play-file-input');
  const playSelectBtn = document.getElementById('play-select-btn');
  const playLoader = document.getElementById('play-loader');
  const playLoaderText = document.getElementById('play-loader-text');
  const playResult = document.getElementById('play-result');
  const playResFilename = document.getElementById('play-res-filename');
  const playResStats = document.getElementById('play-res-stats');
  const playCopyBtn = document.getElementById('play-copy-btn');
  const playResetBtn = document.getElementById('play-reset-btn');
  const playOutput = document.getElementById('play-markdown-output');

  /* ==========================================
     Tab Navigation Layer
     ========================================== */
  // Initialize slider position
  if (appNav) {
    appNav.style.setProperty('--active-index', 0);
  }

  tabs.forEach((btn, index) => {
    btn.addEventListener('click', () => {
      const targetTab = btn.getAttribute('data-tab');
      
      // Update Tab Buttons
      tabs.forEach(t => t.classList.remove('active'));
      btn.classList.add('active');

      // Update Slider Position
      if (appNav) {
        appNav.style.setProperty('--active-index', index);
      }

      // Update Tab Views
      tabContents.forEach(content => {
        content.classList.remove('active');
        if (content.id === `tab-${targetTab}`) {
          content.classList.add('active');
        }
      });
    });
  });

  /* ==========================================
     Storage & Settings Layer
     ========================================== */
  async function loadSettings() {
    await new Promise((resolve) => {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get({
          extensions: { pdf: true, docx: true, xlsx: true, csv: true },
          stats: { totalFilesOptimized: 0, totalOriginalBytes: 0, totalOptimizedBytes: 0, totalTokensSaved: 0 },
          customTemplate: ''
        }, (items) => {
          togglePdf.checked = items.extensions.pdf;
          toggleDocx.checked = items.extensions.docx;
          toggleXlsx.checked = items.extensions.xlsx;
          toggleCsv.checked = items.extensions.csv;
          templateInput.value = items.customTemplate || '';
          statistics = items.stats;
          updateDashboardUI();
          resolve();
        });
      } else {
        updateDashboardUI();
        resolve();
      }
    });
  }

  function saveSettings() {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({
        extensions: {
          pdf: togglePdf.checked,
          docx: toggleDocx.checked,
          xlsx: toggleXlsx.checked,
          csv: toggleCsv.checked
        },
        customTemplate: templateInput.value
      });
    }
  }

  // Trigger Save on any change
  [togglePdf, toggleDocx, toggleXlsx, toggleCsv].forEach(el => {
    el.addEventListener('change', saveSettings);
  });
  templateInput.addEventListener('input', saveSettings);

  // Clear Logs Button
  resetStatsBtn.addEventListener('click', () => {
    if (confirm('Are you sure you want to reset all dashboard statistics? This cannot be undone.')) {
      statistics = {
        totalFilesOptimized: 0,
        totalOriginalBytes: 0,
        totalOptimizedBytes: 0,
        totalTokensSaved: 0
      };

      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ stats: statistics }, () => {
          updateDashboardUI();
        });
      } else {
        updateDashboardUI();
      }
    }
  });

  /* ==========================================
     Dashboard Presentation Layer
     ========================================== */
  function updateDashboardUI() {
    statFiles.textContent = statistics.totalFilesOptimized.toLocaleString();

    // Text Sizes
    const origText = TokenOptimizerConverter.formatBytes(statistics.totalOriginalBytes);
    const optText = TokenOptimizerConverter.formatBytes(statistics.totalOptimizedBytes);
    metricOriginal.textContent = origText;
    metricOptimized.textContent = optText;

    // Ratio computation
    let savingsRatio = 0;
    if (statistics.totalOriginalBytes > 0) {
      const savings = statistics.totalOriginalBytes - statistics.totalOptimizedBytes;
      savingsRatio = Math.max(0, Math.round((savings / statistics.totalOriginalBytes) * 100));
    }
    
    statRatio.textContent = `${savingsRatio}% Saved`;
    ratioBarFill.style.width = `${savingsRatio}%`;
  }

  /* ==========================================
     Playground Parsing Layer
     ========================================== */
  
  // Custom helper: Read file as ArrayBuffer
  function readFileAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(file);
    });
  }

  // Trigger File Picker
  playSelectBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    playFileInput.click();
  });

  playFileInput.addEventListener('change', () => {
    if (playFileInput.files.length > 0) {
      handlePlaygroundFile(playFileInput.files[0]);
    }
  });

  // Drag & Drop Listeners
  ['dragenter', 'dragover'].forEach(eventName => {
    playDropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      playDropzone.classList.add('dragover');
    }, false);
  });

  ['dragleave', 'drop'].forEach(eventName => {
    playDropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      playDropzone.classList.remove('dragover');
    }, false);
  });

  playDropzone.addEventListener('drop', (e) => {
    const dt = e.dataTransfer;
    const files = dt.files;
    if (files.length > 0) {
      handlePlaygroundFile(files[0]);
    }
  });

  // Clicking on dropzone opens dialog
  playDropzone.addEventListener('click', () => {
    playFileInput.click();
  });

  // Process selected file
  async function handlePlaygroundFile(file) {
    const name = file.name;
    const ext = name.split('.').pop().toLowerCase();
    
    if (!['pdf', 'docx', 'xlsx', 'csv', 'md'].includes(ext)) {
      showPlayError(`Unsupported type ".${ext}". Use PDF, DOCX, XLSX, CSV, or MD.`);
      return;
    }

    // Toggle states
    playDropzone.style.display = 'none';
    playLoader.style.display = 'flex';
    playResult.style.display = 'none';
    playLoaderText.textContent = `Reading ${name}...`;

    try {
      const arrayBuffer = await readFileAsArrayBuffer(file);
      let md = '';

      playLoaderText.textContent = 'Extracting elements...';

      // Parse file
      if (ext === 'pdf') {
        md = await TokenOptimizerConverter.convertPDF(arrayBuffer, (curr, tot) => {
          playLoaderText.textContent = `Extracting page ${curr} of ${tot}...`;
        });
      } else if (ext === 'docx') {
        md = await TokenOptimizerConverter.convertDOCX(arrayBuffer);
      } else if (ext === 'xlsx' || ext === 'csv') {
        md = await TokenOptimizerConverter.convertExcel(arrayBuffer);
      } else if (ext === 'md') {
        playLoaderText.textContent = 'Running layout optimization pass...';
        md = await TokenOptimizerConverter.convertMD(arrayBuffer);
      }

      playLoaderText.textContent = 'Optimizing layout...';
      
      // Calculate savings metrics
      const rawEstTokens = TokenOptimizerConverter.estimateTokens(md);
      
      let headerMeta = `<!-- [PLAYGROUND OPTIMIZATION]
Original: ${name}
Format: ${ext.toUpperCase()} to Markdown
-->\n\n`;

      if (templateInput.value && templateInput.value.trim()) {
        headerMeta += `${templateInput.value.trim()}\n\n`;
      }

      const optimizedMd = TokenOptimizerConverter.optimize(md);
      const finalContent = headerMeta + optimizedMd;
      // Compare raw extracted text vs optimized body only (header is fixed overhead, not a saving)
      const finalEstTokens = TokenOptimizerConverter.estimateTokens(optimizedMd);

      const tokensSaved = Math.max(0, rawEstTokens - finalEstTokens);
      const savingsPct = rawEstTokens > 0 ? Math.round((tokensSaved / rawEstTokens) * 100) : 0;

      // Update Playground UI
      playResFilename.textContent = name;

      const finalSizeText = TokenOptimizerConverter.formatBytes(new Blob([finalContent]).size);
      playResStats.textContent = `${finalSizeText} (Saved ~${savingsPct}% tokens)`;

      playOutput.value = finalContent;

      // Persist to dashboard stats
      statistics.totalFilesOptimized += 1;
      statistics.totalOriginalBytes += file.size;
      statistics.totalOptimizedBytes += new Blob([finalContent]).size;
      statistics.totalTokensSaved += tokensSaved;
      updateDashboardUI();
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ stats: statistics });
      }

      // Swap views
      playLoader.style.display = 'none';
      playResult.style.display = 'flex';

    } catch (err) {
      resetPlayground();
      showPlayError(`Conversion failed: ${err.message}`);
    }
  }

  // Copy to Clipboard Action
  playCopyBtn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(playOutput.value);
      
      // Visual feedback
      const origText = playCopyBtn.innerHTML;
      playCopyBtn.innerHTML = `
        <svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
        Copied!
      `;
      playCopyBtn.style.color = 'var(--emerald)';
      
      setTimeout(() => {
        playCopyBtn.innerHTML = origText;
        playCopyBtn.style.color = '';
      }, 2000);

    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  });

  function showPlayError(message) {
    const errEl = document.getElementById('play-error-msg');
    if (!errEl) return;
    errEl.textContent = message;
    errEl.style.display = 'block';
    setTimeout(() => { errEl.style.display = 'none'; }, 4000);
  }

  function resetPlayground() {
    playFileInput.value = '';
    playDropzone.style.display = 'flex';
    playLoader.style.display = 'none';
    playResult.style.display = 'none';
    playOutput.value = '';
    const errEl = document.getElementById('play-error-msg');
    if (errEl) errEl.style.display = 'none';
  }

  playResetBtn.addEventListener('click', resetPlayground);

  // Initialize
  await loadSettings();

  // Keep dashboard live — refresh whenever content script writes new stats to storage
  if (typeof chrome !== 'undefined' && chrome.storage) {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' && changes.stats) {
        statistics = changes.stats.newValue;
        updateDashboardUI();
      }
    });
  }
});
