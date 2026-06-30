/**
 * AI Token Optimizer - Dashboard & Playground Controller
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
  const metricOriginal = document.getElementById('metric-original');
  const metricOptimized = document.getElementById('metric-optimized');
  const metricSaved = document.getElementById('metric-saved');
  const metricTokensSaved = document.getElementById('metric-tokens-saved');

  // Settings Elements
  const togglePdf = document.getElementById('setting-pdf');
  const toggleDocx = document.getElementById('setting-docx');
  const toggleXlsx = document.getElementById('setting-xlsx');
  const toggleCsv = document.getElementById('setting-csv');
  const togglePptx = document.getElementById('setting-pptx');
  const toggleConfirm = document.getElementById('setting-confirm');
  const toggleOcr = document.getElementById('setting-ocr');
  const toggleDarkMode = document.getElementById('setting-darkmode');
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
  const defaultSettings = {
    extensions: { pdf: true, docx: true, xlsx: true, csv: true, pptx: true },
    ocrEnabled: false,
    confirmBeforeConvert: true,
    autoConvertChoice: true,
    darkModeEnabled: false,
    stats: { totalFilesOptimized: 0, totalOriginalBytes: 0, totalOptimizedBytes: 0, totalTokensSaved: 0 },
    customTemplate: ''
  };

  function loadFromLocalStorageFallback(resolve) {
    try {
      const stored = localStorage.getItem('ato_settings');
      const items = stored ? JSON.parse(stored) : defaultSettings;
      const merged = {
        extensions: { ...defaultSettings.extensions, ...items.extensions },
        ocrEnabled: items.ocrEnabled !== undefined ? items.ocrEnabled : defaultSettings.ocrEnabled,
        confirmBeforeConvert: items.confirmBeforeConvert !== undefined ? items.confirmBeforeConvert : defaultSettings.confirmBeforeConvert,
        autoConvertChoice: items.autoConvertChoice !== undefined ? items.autoConvertChoice : defaultSettings.autoConvertChoice,
        darkModeEnabled: items.darkModeEnabled !== undefined ? items.darkModeEnabled : defaultSettings.darkModeEnabled,
        stats: { ...defaultSettings.stats, ...items.stats },
        customTemplate: items.customTemplate !== undefined ? items.customTemplate : defaultSettings.customTemplate
      };
      applyLoadedSettings(merged);
    } catch (err) {
      console.warn('Failed to load settings from localStorage:', err);
      applyLoadedSettings(defaultSettings);
    }
    resolve();
  }

  async function loadSettings() {
    await new Promise((resolve) => {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        try {
          chrome.storage.local.get(defaultSettings, (items) => {
            if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.lastError) {
              loadFromLocalStorageFallback(resolve);
            } else {
              applyLoadedSettings(items || defaultSettings);
              resolve();
            }
          });
        } catch (_) {
          loadFromLocalStorageFallback(resolve);
        }
      } else {
        loadFromLocalStorageFallback(resolve);
      }
    });
  }

  function applyLoadedSettings(items) {
    togglePdf.checked = items.extensions.pdf;
    toggleDocx.checked = items.extensions.docx;
    toggleXlsx.checked = items.extensions.xlsx;
    toggleCsv.checked = items.extensions.csv;
    togglePptx.checked = items.extensions.pptx;
    toggleConfirm.checked = items.confirmBeforeConvert !== false;
    toggleOcr.checked = items.ocrEnabled;
    toggleDarkMode.checked = items.darkModeEnabled || false;

    if (toggleDarkMode.checked) {
      document.body.classList.add('dark-theme');
    } else {
      document.body.classList.remove('dark-theme');
    }

    templateInput.value = items.customTemplate || '';
    statistics = items.stats;
    updateDashboardUI();
  }

  function saveToLocalStorageFallback(settings) {
    try {
      const stored = localStorage.getItem('ato_settings');
      const items = stored ? JSON.parse(stored) : {};
      const merged = { ...items, ...settings };
      localStorage.setItem('ato_settings', JSON.stringify(merged));
    } catch (err) {
      console.warn('Failed to save settings to localStorage:', err);
    }
  }

  function saveSettings() {
    const settings = {
      extensions: {
        pdf: togglePdf.checked,
        docx: toggleDocx.checked,
        xlsx: toggleXlsx.checked,
        csv: toggleCsv.checked,
        pptx: togglePptx.checked
      },
      ocrEnabled: toggleOcr.checked,
      confirmBeforeConvert: toggleConfirm.checked,
      autoConvertChoice: true,
      darkModeEnabled: toggleDarkMode.checked,
      customTemplate: templateInput.value
    };

    if (toggleDarkMode.checked) {
      document.body.classList.add('dark-theme');
    } else {
      document.body.classList.remove('dark-theme');
    }

    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      try {
        chrome.storage.local.set(settings, () => {
          if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.lastError) {
            saveToLocalStorageFallback(settings);
          }
        });
      } catch (_) {
        saveToLocalStorageFallback(settings);
      }
    } else {
      saveToLocalStorageFallback(settings);
    }
  }

  // Trigger Save on any change
  [togglePdf, toggleDocx, toggleXlsx, toggleCsv, togglePptx, toggleConfirm, toggleOcr, toggleDarkMode].forEach(el => {
    el.addEventListener('change', saveSettings);
  });
  templateInput.addEventListener('input', saveSettings);

  function resetStatsLocalStorageFallback() {
    try {
      const stored = localStorage.getItem('ato_settings');
      const items = stored ? JSON.parse(stored) : {};
      items.stats = statistics;
      localStorage.setItem('ato_settings', JSON.stringify(items));
    } catch (_) {}
    updateDashboardUI();
  }

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
        try {
          chrome.storage.local.set({ stats: statistics }, () => {
            if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.lastError) {
              resetStatsLocalStorageFallback();
            } else {
              updateDashboardUI();
            }
          });
        } catch (_) {
          resetStatsLocalStorageFallback();
        }
      } else {
        resetStatsLocalStorageFallback();
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

    // Data Saved computation (byte-based)
    const savedBytes = Math.max(0, statistics.totalOriginalBytes - statistics.totalOptimizedBytes);
    const savedText = TokenOptimizerConverter.formatBytes(savedBytes);
    metricSaved.textContent = savedText;

    // Tokens Saved display
    if (metricTokensSaved) {
      metricTokensSaved.textContent = (statistics.totalTokensSaved || 0).toLocaleString();
    }

    // Ratio badge: compute byte savings in the unified text domain.
    // Since both totalOriginalBytes and totalOptimizedBytes are text representations,
    // this directly maps to the exact LLM token cost reduction.
    let savingsRatio = 0;
    if (statistics.totalOriginalBytes > 0) {
      savingsRatio = Math.max(0, Math.round(((statistics.totalOriginalBytes - statistics.totalOptimizedBytes) / statistics.totalOriginalBytes) * 100));
    }
    
    statRatio.textContent = `${savingsRatio}% Saved`;
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
    
    if (!['pdf', 'docx', 'pptx', 'xlsx', 'csv', 'md'].includes(ext)) {
      showPlayError(`Unsupported type ".${ext}". Use PDF, DOCX, PPTX, XLSX, CSV, or MD.`);
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
      } else if (ext === 'pptx') {
        md = await TokenOptimizerConverter.convertPPTX(arrayBuffer, (curr, tot) => {
          playLoaderText.textContent = `Extracting slide ${curr} of ${tot}...`;
        });
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
      playResStats.textContent = `${finalSizeText} (Saved ~${tokensSaved.toLocaleString()} tokens, ${savingsPct}%)`;

      playOutput.value = finalContent;

      // Persist to dashboard stats (using the unified text domain to ensure correct and positive metrics)
      const originalText = headerMeta + md;
      const originalSize = new Blob([originalText]).size;
      const finalSize = new Blob([finalContent]).size;

      statistics.totalFilesOptimized += 1;
      statistics.totalOriginalBytes += originalSize;
      statistics.totalOptimizedBytes += finalSize;
      statistics.totalTokensSaved += tokensSaved;
      updateDashboardUI();
      const savePlaygroundStatsFallback = () => {
        try {
          const stored = localStorage.getItem('ato_settings');
          const items = stored ? JSON.parse(stored) : {};
          items.stats = statistics;
          localStorage.setItem('ato_settings', JSON.stringify(items));
        } catch (_) {}
      };

      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        try {
          chrome.storage.local.set({ stats: statistics }, () => {
            if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.lastError) {
              savePlaygroundStatsFallback();
            }
          });
        } catch (_) {
          savePlaygroundStatsFallback();
        }
      } else {
        savePlaygroundStatsFallback();
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
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width:11px;height:11px;fill:none;stroke:currentColor;"><polyline points="20 6 9 17 4 12"></polyline></svg>
        Copied!
      `;
      playCopyBtn.style.color = 'var(--theme-blue)';
      
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
