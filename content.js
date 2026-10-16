/**
 * AI Token Optimizer - Content Script DOM Interceptor
 * Injected into Claude, ChatGPT, Gemini, Perplexity
 */

(function () {
  'use strict';

  const TARGET_EXTENSIONS = TokenOptimizerConverter.DOC_EXTENSIONS.concat(TokenOptimizerConverter.IMAGE_EXTENSIONS);

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
      return settings.extensions[TokenOptimizerConverter.settingKey(ext)] !== false;
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
    extensions: { pdf: true, docx: true, xlsx: true, csv: true, pptx: true, text: true, images: true },
    ocrEnabled: false,
    tableFormat: 'markdown',
    imageMaxEdge: 1568,
    pasteOptimize: true,
    confirmBeforeConvert: true,
    autoConvertChoice: true,
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
          <span class="ato-file-name" id="ato-current-file"></span>
          <span class="ato-file-badge" id="ato-file-index">1 / ${filesCount}</span>
        </div>
        <div class="ato-progress-track">
          <div class="ato-progress-bar" id="ato-progress-bar" style="width: 5%"></div>
          <div class="ato-progress-shine"></div>
        </div>
        <div class="ato-hud-details">
          <span id="ato-progress-status">Parsing document...</span>
          <span class="ato-saving-badge" id="ato-saving-badge" style="display: none;">
            <svg viewBox="0 0 24 24"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"></path></svg>
            <span id="ato-saving-value">0%</span> (<span id="ato-saving-count">0</span>) saved
          </span>
        </div>
      </div>
    `;

    hud.querySelector('#ato-current-file').textContent = initialFile;
    document.body.appendChild(hud);
    return hud;
  }

  /**
   * HTML UI: Update the HUD state
   */
  function updateHUDOverlay(hud, fileName, fileIndex, totalFiles, progressPercent, statusText, savingsPercent = null, tokensSaved = null) {
    if (!hud) return;
    
    const fileNameEl = hud.querySelector('#ato-current-file');
    const fileIndexEl = hud.querySelector('#ato-file-index');
    const progressBarEl = hud.querySelector('#ato-progress-bar');
    const statusTextEl = hud.querySelector('#ato-progress-status');
    const savingBadgeEl = hud.querySelector('#ato-saving-badge');
    const savingValueEl = hud.querySelector('#ato-saving-value');
    const savingCountEl = hud.querySelector('#ato-saving-count');

    if (fileNameEl) fileNameEl.textContent = fileName;
    if (fileIndexEl) fileIndexEl.textContent = `${fileIndex} / ${totalFiles}`;
    if (progressBarEl) progressBarEl.style.width = `${progressPercent}%`;
    if (statusTextEl) statusTextEl.textContent = statusText;

    if (savingsPercent !== null && savingBadgeEl && savingValueEl) {
      savingBadgeEl.style.display = 'flex';
      savingValueEl.textContent = `${savingsPercent}%`;
    }
    if (tokensSaved !== null && savingCountEl) {
      savingCountEl.textContent = tokensSaved.toLocaleString() + ' tokens';
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

  // "≈12,345 tokens · 6% of 200K window" — tells the user whether the file fits
  function contextFitText(tokens) {
    const windowSize = TokenOptimizerConverter.contextWindowFor(location.hostname);
    const pct = Math.max(1, Math.round((tokens / windowSize) * 100));
    const label = windowSize >= 1000000 ? `${windowSize / 1000000}M` : `${Math.round(windowSize / 1000)}K`;
    return `≈${tokens.toLocaleString()} tokens · ${pct}% of ${label} window`;
  }

  /**
   * CORE: Process a single file and convert to Markdown
   */
  async function processFile(file, settings, onProgress) {
    const ext = file.name.split('.').pop().toLowerCase();
    if (TokenOptimizerConverter.IMAGE_EXTENSIONS.includes(ext)) {
      onProgress(40, 'Downscaling image...');
      const result = await TokenOptimizerConverter.optimizeImage(file, file.type || `image/${ext === 'jpg' ? 'jpeg' : ext}`, settings.imageMaxEdge);
      if (!result) {
        onProgress(100, 'Already optimal size', 0, 0);
        return file;
      }
      const saved = result.tokensBefore - result.tokensAfter;
      onProgress(100, 'Image optimized!', Math.round((saved / result.tokensBefore) * 100), saved);
      await updateStatistics(1, file.size, result.blob.size, saved);
      return new File([result.blob], file.name, { type: result.blob.type });
    }

    const arrayBuffer = await readFileAsArrayBuffer(file);
    onProgress(20, 'Parsing structure...');
    const md = await TokenOptimizerConverter.convertFile(arrayBuffer, ext, {
      ocrEnabled: settings.ocrEnabled || false,
      tableFormat: settings.tableFormat,
      onProgress: (current, total) => {
        const pct = 20 + Math.round((current / total) * 60);
        onProgress(pct, `Extracting page ${current} of ${total}...`);
      }
    });

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

    // Calculate metrics in the unified text domain (both pre-optimized and optimized text with header)
    const originalText = headerMeta + md;
    const originalSize = new Blob([originalText], { type: 'text/markdown' }).size;
    const finalSize = new Blob([finalContent], { type: 'text/markdown' }).size;
    
    // Save tokens represents difference between unoptimized raw string tokens and optimized tokens
    // Fallback: at least 0, or percentage based
    const tokensSaved = Math.max(0, rawEstTokens - finalEstTokens);
    const savingsPercent = rawEstTokens > 0 ? Math.round((tokensSaved / rawEstTokens) * 100) : 0;

    onProgress(100, contextFitText(finalEstTokens), savingsPercent, tokensSaved);

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
          const optimizedFile = await processFile(file, settings, (percent, status, savings, savedTokens) => {
            updateHUDOverlay(hud, file.name, i + 1, totalFiles, percent, status, savings, savedTokens);
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

  // Extensions inject.js should intercept, so disabled types never trigger the prompt
  function enabledTargets(settings) {
    return TARGET_EXTENSIONS.filter(ext => isTargetFile('f.' + ext, settings));
  }

  /**
   * Respond to settings requests from inject.js (MAIN world)
   */
  window.addEventListener('ato-request-settings', async function () {
    const data = await getStorageData();
    window.dispatchEvent(new CustomEvent('ato-response-settings', {
      detail: {
        confirmBeforeConvert: data.confirmBeforeConvert !== false,
        autoConvertChoice: data.autoConvertChoice !== false,
        targets: enabledTargets(data)
      }
    }));
  });

  // Push once on load too: inject.js may have asked before this listener existed
  getStorageData().then((data) => {
    window.dispatchEvent(new CustomEvent('ato-response-settings', {
      detail: {
        confirmBeforeConvert: data.confirmBeforeConvert !== false,
        autoConvertChoice: data.autoConvertChoice !== false,
        targets: enabledTargets(data)
      }
    }));
  });

  /**
   * Save user preference from inject.js confirmation popup
   */
  window.addEventListener('ato-save-preference', async function (event) {
    if (!_ctxAlive() || !event.detail) return;
    const { confirmBeforeConvert, autoConvertChoice } = event.detail;
    try {
      await new Promise((resolve) => {
        chrome.storage.local.set({ confirmBeforeConvert, autoConvertChoice }, resolve);
      });
    } catch (_) { /* context may have expired */ }
  });

  /**
   * Broadcast updated settings to inject.js whenever storage changes
   */
  if (_ctxAlive() && chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local') return;
      if (changes.confirmBeforeConvert || changes.autoConvertChoice || changes.extensions) {
        getStorageData().then((data) => {
          window.dispatchEvent(new CustomEvent('ato-response-settings', {
            detail: {
              confirmBeforeConvert: data.confirmBeforeConvert !== false,
              autoConvertChoice: data.autoConvertChoice !== false,
              targets: enabledTargets(data)
            }
          }));
        });
      }
    });
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

  /**
   * Paste interception: large pasted logs/JSON get the same lossless compaction
   * as uploads. Re-dispatches a paste with the compacted text so rich editors
   * (ProseMirror on Claude/ChatGPT) handle it natively; plain textareas don't
   * act on synthetic pastes, so fall back to insertText there.
   */
  const PASTE_MIN_CHARS = 1500;
  let _pasteEnabled = true;
  getStorageData().then((data) => { _pasteEnabled = data.pasteOptimize !== false; });
  if (_ctxAlive() && chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' && changes.pasteOptimize) _pasteEnabled = changes.pasteOptimize.newValue !== false;
    });
  }

  window.addEventListener('paste', function (event) {
    if (!_pasteEnabled || _processedEvents.has(event) || !event.clipboardData) return;
    if (event.clipboardData.files && event.clipboardData.files.length > 0) return;
    const text = event.clipboardData.getData('text/plain');
    if (!text || text.length < PASTE_MIN_CHARS) return;

    const result = TokenOptimizerConverter.optimizePaste(text);
    if (!result) return;

    event.preventDefault();
    event.stopImmediatePropagation();

    const dt = new DataTransfer();
    dt.setData('text/plain', result.text);
    const synthetic = new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true });
    _processedEvents.add(synthetic);
    const target = event.target;
    target.dispatchEvent(synthetic);
    if (!synthetic.defaultPrevented) {
      if (target.focus) target.focus();
      document.execCommand('insertText', false, result.text);
    }

    const saved = result.tokensBefore - result.tokensAfter;
    updateStatistics(1, new Blob([text]).size, new Blob([result.text]).size, saved);
    const hud = showHUDOverlay(['Pasted text']);
    updateHUDOverlay(hud, 'Pasted text', 1, 1, 100, 'Compacted (Ctrl+Z to undo)',
      Math.round((saved / result.tokensBefore) * 100), saved);
    setTimeout(() => removeHUDOverlay(hud), 2500);
  }, true);

})();
