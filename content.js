/**
 * AI Token Optimizer - Content Script DOM Interceptor
 * Injected into Claude, ChatGPT, Gemini, Perplexity
 */

(function () {
  'use strict';

  const TARGET_EXTENSIONS = ['pdf', 'docx', 'pptx', 'xlsx', 'csv', 'md'];

  // Tracks synthetic re-dispatched events to prevent re-processing them
  const _processedEvents = new WeakSet();

  /**
   * Helper: Check if file name matches a supported extension based on settings
   */
  function isTargetFile(fileName, settings) {
    if (!fileName) return false;
    const ext = fileName.split('.').pop().toLowerCase();
    if (!TARGET_EXTENSIONS.includes(ext)) return false;
    
    // Check settings toggle
    if (settings && settings.extensions) {
      return settings.extensions[ext] !== false;
    }
    return true;
  }

  /**
   * Helper: Read file as ArrayBuffer
   */
  function readFileAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(file);
    });
  }

  const _STORAGE_DEFAULTS = {
    extensions: { pdf: true, docx: true, xlsx: true, csv: true, pptx: true },
    ocrEnabled: false,
    stats: { totalFilesOptimized: 0, totalOriginalBytes: 0, totalOptimizedBytes: 0, totalTokensSaved: 0 },
    customTemplate: ''
  };

  // Returns false when the extension has been reloaded/updated and this old content
  // script no longer has a valid connection to the extension context.
  function _ctxAlive() {
    try { return typeof chrome !== 'undefined' && !!chrome.runtime.id; }
    catch (_) { return false; }
  }

  /**
   * Helper: Retrieve current extension settings and statistics
   */
  function getStorageData() {
    return new Promise((resolve) => {
      if (!_ctxAlive()) { resolve(_STORAGE_DEFAULTS); return; }
      try {
        chrome.storage.local.get(_STORAGE_DEFAULTS, resolve);
      } catch (_) {
        resolve(_STORAGE_DEFAULTS);
      }
    });
  }

  /**
   * Helper: Save updated stats to storage
   */
  async function updateStatistics(addedFiles, addedOriginalBytes, addedOptimizedBytes, addedTokensSaved) {
    if (!_ctxAlive()) return;

    const data = await getStorageData();
    const stats = data.stats;

    stats.totalFilesOptimized += addedFiles;
    stats.totalOriginalBytes += addedOriginalBytes;
    stats.totalOptimizedBytes += addedOptimizedBytes;
    stats.totalTokensSaved += addedTokensSaved;

    try {
      await new Promise((resolve) => { chrome.storage.local.set({ stats }, resolve); });
    } catch (_) { /* context may have expired mid-write — ignore */ }
  }

  /**
   * HTML UI: Show HUD overlay loader in bottom-right/top-right
   */
  function showHUDOverlay(fileNames) {
    // Remove existing HUD overlay if there
    const existing = document.querySelector('.ato-hud-overlay');
    if (existing) existing.remove();

    const hud = document.createElement('div');
    hud.className = 'ato-hud-overlay';
    
    const filesCount = fileNames.length;
    const initialFile = fileNames[0];

    hud.innerHTML = `
      <div class="ato-header">
        <div class="ato-logo-container">
          <div class="ato-logo-glow"></div>
          <div class="ato-logo-ring"></div>
        </div>
        <h4 class="ato-title">AI Token Optimizer</h4>
      </div>
      <div class="ato-status-container">
        <div class="ato-file-info">
          <span class="ato-file-name" id="ato-current-file">${initialFile}</span>
          <span class="ato-file-badge" id="ato-file-index">1 / ${filesCount}</span>
        </div>
        <div class="ato-progress-track">
          <div class="ato-progress-bar" id="ato-progress-bar" style="width: 5%"></div>
          <div class="ato-progress-shine"></div>
        </div>
        <div class="ato-hud-details">
          <span id="ato-progress-status">Parsing document...</span>
          <span class="ato-saving-badge" id="ato-saving-badge" style="display: none;">
            <svg viewBox="0 0 24 24"><path d="M7 11h2v2H7zm4 0h2v2h-2zm4 0h2v2h-2z"/><path d="M5 3a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm14 16H5V7h14zm0-14H5v1.99h14z"/></svg>
            <span id="ato-saving-value">0%</span> tokens saved
          </span>
        </div>
      </div>
    `;

    document.body.appendChild(hud);
    return hud;
  }

  /**
   * HTML UI: Update the HUD state
   */
  function updateHUDOverlay(hud, fileName, fileIndex, totalFiles, progressPercent, statusText, savingsPercent = null) {
    if (!hud) return;
    
    const fileNameEl = hud.querySelector('#ato-current-file');
    const fileIndexEl = hud.querySelector('#ato-file-index');
    const progressBarEl = hud.querySelector('#ato-progress-bar');
    const statusTextEl = hud.querySelector('#ato-progress-status');
    const savingBadgeEl = hud.querySelector('#ato-saving-badge');
    const savingValueEl = hud.querySelector('#ato-saving-value');

    if (fileNameEl) fileNameEl.textContent = fileName;
    if (fileIndexEl) fileIndexEl.textContent = `${fileIndex} / ${totalFiles}`;
    if (progressBarEl) progressBarEl.style.width = `${progressPercent}%`;
    if (statusTextEl) statusTextEl.textContent = statusText;

    if (savingsPercent !== null && savingBadgeEl && savingValueEl) {
      savingBadgeEl.style.display = 'flex';
      savingValueEl.textContent = `${savingsPercent}%`;
    }
  }

  /**
   * HTML UI: Remove HUD overlay
   */
  function removeHUDOverlay(hud) {
    if (!hud) return;
    hud.classList.add('ato-slide-out');
    setTimeout(() => hud.remove(), 400);
  }

  /**
   * CORE: Process a single file and convert to Markdown
   */
  async function processFile(file, settings, onProgress) {
    const ext = file.name.split('.').pop().toLowerCase();
    const arrayBuffer = await readFileAsArrayBuffer(file);
    let md = '';

    onProgress(20, 'Parsing structure...');

    // 1. Convert to Markdown
    if (ext === 'pdf') {
      md = await TokenOptimizerConverter.convertPDF(arrayBuffer, (current, total) => {
        const pct = 20 + Math.round((current / total) * 60);
        onProgress(pct, `Extracting page ${current} of ${total}...`);
      }, { ocrEnabled: settings.ocrEnabled || false });
    } else if (ext === 'docx') {
      onProgress(40, 'Parsing Word tags...');
      md = await TokenOptimizerConverter.convertDOCX(arrayBuffer);
    } else if (ext === 'pptx') {
      onProgress(40, 'Extracting slides...');
      md = await TokenOptimizerConverter.convertPPTX(arrayBuffer, (current, total) => {
        const pct = 20 + Math.round((current / total) * 60);
        onProgress(pct, `Extracting slide ${current} of ${total}...`);
      });
    } else if (ext === 'xlsx') {
      onProgress(40, 'Compiling sheet tables...');
      md = await TokenOptimizerConverter.convertExcel(arrayBuffer);
    } else if (ext === 'csv') {
      onProgress(40, 'Converting CSV table...');
      md = await TokenOptimizerConverter.convertExcel(arrayBuffer);
    } else if (ext === 'md') {
      onProgress(40, 'Running layout optimization pass...');
      md = await TokenOptimizerConverter.convertMD(arrayBuffer);
    } else {
      return file;
    }

    onProgress(85, 'Optimizing formatting...');

    // 2. Apply Custom Prepended Template if available
    const operation = ext === 'md'
      ? `Layout-optimized: ${file.name}`
      : `Converted: ${ext.toUpperCase()} → Markdown`;
    let headerMeta = `<!-- [OPTIMIZED BY AI TOKEN OPTIMIZER]
Original: ${file.name}
${operation}
-->\n\n`;

    if (settings.customTemplate && settings.customTemplate.trim()) {
      headerMeta += `${settings.customTemplate.trim()}\n\n`;
    }

    // 3. Optimize Layout (collapse spacing, simplify formatting)
    const rawEstTokens = TokenOptimizerConverter.estimateTokens(md);
    const optimizedMd = TokenOptimizerConverter.optimize(md);
    const finalContent = headerMeta + optimizedMd;
    // Compare raw vs optimized body only — the header comment is fixed overhead, not a saving
    const finalEstTokens = TokenOptimizerConverter.estimateTokens(optimizedMd);

    // Calculate metrics
    const originalSize = file.size;
    const finalSize = new Blob([finalContent], { type: 'text/markdown' }).size;
    
    // Save tokens represents difference between unoptimized raw string tokens and optimized tokens
    // Fallback: at least 0, or percentage based
    const tokensSaved = Math.max(0, rawEstTokens - finalEstTokens);
    const savingsPercent = rawEstTokens > 0 ? Math.round((tokensSaved / rawEstTokens) * 100) : 0;

    onProgress(100, 'Conversion complete!', savingsPercent);

    // 4. Update Global/Extension Stats
    await updateStatistics(1, originalSize, finalSize, tokensSaved);

    // 5. Create new File object
    const originalBaseName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
    const newFileName = `${originalBaseName}_optimized.md`;
    
    return new File([finalContent], newFileName, { type: 'text/markdown' });
  }

  /**
   * Core Batch File Processor
   */
  async function processFiles(fileList, hud, settings) {
    const optimizedFiles = [];
    const filesArray = Array.from(fileList);
    const totalFiles = filesArray.length;

    for (let i = 0; i < totalFiles; i++) {
      const file = filesArray[i];
      if (isTargetFile(file.name, settings)) {
        updateHUDOverlay(hud, file.name, i + 1, totalFiles, 5, 'Reading file...');
        
        try {
          const optimizedFile = await processFile(file, settings, (percent, status, savings) => {
            updateHUDOverlay(hud, file.name, i + 1, totalFiles, percent, status, savings);
          });
          optimizedFiles.push(optimizedFile);
          
          // Small brief delay for visual satisfaction
          await new Promise(r => setTimeout(r, 600));
        } catch (error) {
          console.error(`Error processing file ${file.name}:`, error);
          // Keep original file on error
          optimizedFiles.push(file);
        }
      } else {
        // Pass-through other files
        optimizedFiles.push(file);
      }
    }

    return optimizedFiles;
  }

  /**
   * Listen for request events from inject.js (MAIN world)
   */
  window.addEventListener('ato-request-optimization', async function (event) {
    if (!_ctxAlive()) {
      // Extension context is dead (reloaded or updated).
      // Fallback immediately by returning original files to prevent freezing the page's upload process.
      try {
        const { transactionId, files } = event.detail;
        window.dispatchEvent(new CustomEvent('ato-response-optimization', {
          detail: {
            transactionId: transactionId,
            processedFiles: files
          }
        }));
      } catch (_) {}
      return;
    }
    
    const { transactionId, eventType, files } = event.detail;
    if (!files || files.length === 0) return;

    try {
      const settings = await getStorageData();

      // Verify if any target extensions are active in settings
      const hasActiveTargets = Array.from(files).some(file => file && file.name && isTargetFile(file.name, settings));

      if (!hasActiveTargets) {
        // Settings bypass: return original files unoptimized
        window.dispatchEvent(new CustomEvent('ato-response-optimization', {
          detail: {
            transactionId: transactionId,
            processedFiles: files
          }
        }));
        return;
      }

      // Show floating loader UI only for active target files
      const targetFiles = Array.from(files).filter(f => isTargetFile(f.name, settings));
      const hud = showHUDOverlay(targetFiles.map(f => f.name));

      try {
        const processedFiles = await processFiles(files, hud, settings);

        // Dispatch response back to MAIN world
        window.dispatchEvent(new CustomEvent('ato-response-optimization', {
          detail: {
            transactionId: transactionId,
            processedFiles: processedFiles
          }
        }));

      } catch (err) {
        console.error('Token Optimizer Process Error:', err);
        // Fallback: send original files back on error
        window.dispatchEvent(new CustomEvent('ato-response-optimization', {
          detail: {
            transactionId: transactionId,
            processedFiles: files
          }
        }));
      } finally {
        removeHUDOverlay(hud);
      }
    } catch (err) {
      console.error('ato-request-optimization Event Error:', err);
      // Fallback: send original files back
      window.dispatchEvent(new CustomEvent('ato-response-optimization', {
        detail: {
          transactionId: transactionId,
          processedFiles: files
        }
      }));
    }
  });

})();
