/**
 * AI Token Optimizer - Injected Main World Script
 * Intercepts change/drop events in the page context to bypass Chrome Extension isolated-world limitations.
 */
(function () {
  'use strict';

  const TARGET_EXTENSIONS = ['pdf', 'docx', 'pptx', 'xlsx', 'csv', 'md'];
  const _pendingTransactions = new Map();

  // Cached preferences from content script (isolated world) via storage
  let _confirmBeforeConvert = true; // default: always ask
  let _autoConvertChoice = true;    // when not asking: true = convert, false = upload original

  // Request current settings from content script on load
  window.dispatchEvent(new CustomEvent('ato-request-settings'));
  window.addEventListener('ato-response-settings', function (event) {
    if (event.detail) {
      _confirmBeforeConvert = event.detail.confirmBeforeConvert !== false;
      _autoConvertChoice = event.detail.autoConvertChoice !== false;
    }
  });

  function isTargetFile(fileName) {
    if (!fileName) return false;
    const ext = fileName.split('.').pop().toLowerCase();
    return TARGET_EXTENSIONS.includes(ext);
  }

  function hasTargetFiles(files) {
    if (!files || files.length === 0) return false;
    return Array.from(files).some(file => file && file.name && isTargetFile(file.name));
  }

  function getTargetFileNames(files) {
    return Array.from(files)
      .filter(f => f && f.name && isTargetFile(f.name))
      .map(f => f.name);
  }

  /**
   * Show a confirmation popup asking the user whether to convert files to MD.
   * Returns a Promise that resolves to { convert: boolean, remember: boolean }.
   */
  function showConvertPrompt(fileNames) {
    return new Promise((resolve) => {
      // Remove any existing prompt
      const existing = document.querySelector('.ato-confirm-overlay');
      if (existing) existing.remove();

      const overlay = document.createElement('div');
      overlay.className = 'ato-confirm-overlay';

      const fileListHtml = fileNames.map(name => {
        const ext = name.split('.').pop().toUpperCase();
        return `<div class="ato-confirm-file"><span class="ato-confirm-ext">${ext}</span><span class="ato-confirm-fname">${name}</span></div>`;
      }).join('');

      overlay.innerHTML = `
        <div class="ato-confirm-popup">
          <div class="ato-confirm-header">
            <div class="ato-confirm-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="12" y1="18" x2="12" y2="12"></line>
                <line x1="9" y1="15" x2="15" y2="15"></line>
              </svg>
            </div>
            <h3 class="ato-confirm-title">Convert to Markdown?</h3>
            <p class="ato-confirm-subtitle">AI Token Optimizer detected convertible files</p>
          </div>
          <div class="ato-confirm-files">${fileListHtml}</div>
          <div class="ato-confirm-desc">Converting to Markdown reduces token usage by up to 70%, saving costs and context window space.</div>
          <label class="ato-confirm-remember">
            <input type="checkbox" class="ato-confirm-remember-cb">
            <span>Remember my choice</span>
          </label>
          <div class="ato-confirm-actions">
            <button class="ato-confirm-btn ato-confirm-btn-skip">Upload Original</button>
            <button class="ato-confirm-btn ato-confirm-btn-convert">Convert to MD</button>
          </div>
        </div>
      `;

      document.body.appendChild(overlay);

      const rememberCb = overlay.querySelector('.ato-confirm-remember-cb');
      const convertBtn = overlay.querySelector('.ato-confirm-btn-convert');
      const skipBtn = overlay.querySelector('.ato-confirm-btn-skip');

      function cleanup() {
        overlay.classList.add('ato-confirm-fadeout');
        setTimeout(() => overlay.remove(), 200);
      }

      convertBtn.addEventListener('click', () => {
        const remember = rememberCb.checked;
        cleanup();
        if (remember) {
          _confirmBeforeConvert = false;
          window.dispatchEvent(new CustomEvent('ato-save-preference', {
            detail: { confirmBeforeConvert: false, autoConvertChoice: true }
          }));
        }
        resolve({ convert: true, remember });
      });

      skipBtn.addEventListener('click', () => {
        const remember = rememberCb.checked;
        cleanup();
        if (remember) {
          _confirmBeforeConvert = false;
          window.dispatchEvent(new CustomEvent('ato-save-preference', {
            detail: { confirmBeforeConvert: false, autoConvertChoice: false }
          }));
        }
        resolve({ convert: false, remember });
      });

      // Close on overlay background click (treat as skip without remember)
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          cleanup();
          resolve({ convert: false, remember: false });
        }
      });
    });
  }

  // Helper to re-dispatch files to their target
  function fallbackToOriginal(tx) {
    const { eventType, target, originalEvent, files } = tx;
    try {
      const dataTransfer = new DataTransfer();
      if (files && Array.isArray(files)) {
        files.forEach(file => dataTransfer.items.add(file));
      }

      if (eventType === 'change') {
        if (!target) return;
        target.files = dataTransfer.files;
        const customEvent = new Event('change', { bubbles: true, cancelable: true });
        customEvent.__atoProcessed = true;
        target.dispatchEvent(customEvent);
      } else if (eventType === 'drop') {
        const customDropEvent = new DragEvent('drop', {
          bubbles: true,
          cancelable: true,
          clientX: originalEvent.clientX,
          clientY: originalEvent.clientY,
          screenX: originalEvent.screenX,
          screenY: originalEvent.screenY,
          dataTransfer: dataTransfer
        });

        Object.defineProperty(customDropEvent, 'dataTransfer', {
          value: dataTransfer,
          writable: false,
          configurable: true
        });

        customDropEvent.__atoProcessed = true;

        let dispatchTarget = target;
        if (dispatchTarget && !dispatchTarget.isConnected) {
          dispatchTarget = document.elementFromPoint(originalEvent.clientX, originalEvent.clientY) || document.body;
        }
        if (dispatchTarget) {
          dispatchTarget.dispatchEvent(customDropEvent);
        }
      }
    } catch (err) {
      console.error('[AITokenOptimizer] Fallback failed:', err);
    }
  }

  /**
   * Common handler for intercepted file uploads (change or drop).
   * Shows confirmation popup if needed, then either converts or passes through.
   */
  async function handleInterceptedUpload(eventType, target, originalEvent, files) {
    const filesArray = Array.from(files);
    const targetFileNames = getTargetFileNames(filesArray);

    // Check if we need to ask the user
    if (_confirmBeforeConvert) {
      const { convert } = await showConvertPrompt(targetFileNames);
      if (!convert) {
        fallbackToOriginal({ eventType, target, originalEvent, files: filesArray });
        return;
      }
    } else if (!_autoConvertChoice) {
      // User previously chose "always upload original"
      fallbackToOriginal({ eventType, target, originalEvent, files: filesArray });
      return;
    }

    const txId = Math.random().toString(36).substring(2, 9);

    // Auto-fallback timer to prevent stuck uploads
    const timeoutId = setTimeout(() => {
      const pendingTx = _pendingTransactions.get(txId);
      if (pendingTx) {
        _pendingTransactions.delete(txId);
        console.warn('[AITokenOptimizer] Transaction timed out. Falling back to original files.');
        fallbackToOriginal(pendingTx);
      }
    }, 60000);

    _pendingTransactions.set(txId, {
      eventType,
      target,
      originalEvent,
      files: filesArray,
      timeoutId
    });

    window.dispatchEvent(new CustomEvent('ato-request-optimization', {
      detail: {
        transactionId: txId,
        eventType,
        files: filesArray
      }
    }));
  }

  // Hook change event at the window capture phase
  window.addEventListener('change', function (event) {
    // If the event was programmatically dispatched by us, let it pass
    if (event.__atoProcessed) return;

    const target = event.target;
    if (target && target.tagName === 'INPUT' && target.type === 'file') {
      const files = target.files;
      if (!hasTargetFiles(files)) return;

      // Intercept the upload event
      event.stopImmediatePropagation();
      event.preventDefault();

      handleInterceptedUpload('change', target, event, files);
    }
  }, true); // Capture phase is critical to run before site script listeners

  // Hook drop event at the window capture phase
  window.addEventListener('drop', function (event) {
    if (event.__atoProcessed) return;

    const dataTransfer = event.dataTransfer;
    if (!dataTransfer || !dataTransfer.files || dataTransfer.files.length === 0) return;

    if (!hasTargetFiles(dataTransfer.files)) return;

    // Intercept the drop event
    event.stopImmediatePropagation();
    event.preventDefault();

    handleInterceptedUpload('drop', event.target, event, dataTransfer.files);
  }, true); // Capture phase is critical

  // Listen for response from the isolated content script
  window.addEventListener('ato-response-optimization', function (event) {
    const { transactionId, processedFiles } = event.detail;
    const tx = _pendingTransactions.get(transactionId);
    if (!tx) return;

    if (tx.timeoutId) {
      clearTimeout(tx.timeoutId);
    }
    _pendingTransactions.delete(transactionId);
    const { eventType, target, originalEvent } = tx;

    try {
      // Create a fresh DataTransfer and add the optimized (or passed-through) files
      const dataTransfer = new DataTransfer();
      if (processedFiles && Array.isArray(processedFiles)) {
        processedFiles.forEach(file => dataTransfer.items.add(file));
      } else if (tx.files) {
        tx.files.forEach(file => dataTransfer.items.add(file));
      }

      if (eventType === 'change') {
        if (!target) return;
        // Re-inject optimized files into the input
        target.files = dataTransfer.files;

        // Dispatch a synthetic change event
        const customEvent = new Event('change', { bubbles: true, cancelable: true });
        customEvent.__atoProcessed = true;
        target.dispatchEvent(customEvent);
      } else if (eventType === 'drop') {
        // Create custom drop event with our DataTransfer
        const customDropEvent = new DragEvent('drop', {
          bubbles: true,
          cancelable: true,
          clientX: originalEvent.clientX,
          clientY: originalEvent.clientY,
          screenX: originalEvent.screenX,
          screenY: originalEvent.screenY,
          dataTransfer: dataTransfer
        });

        // Force dataTransfer property to match our DataTransfer object in Chrome/Blink
        Object.defineProperty(customDropEvent, 'dataTransfer', {
          value: dataTransfer,
          writable: false,
          configurable: true
        });

        customDropEvent.__atoProcessed = true;

        // Handle dynamic DOM unmounting/unloading in modern single-page-apps (SPAs)
        let dispatchTarget = target;
        if (dispatchTarget && !dispatchTarget.isConnected) {
          dispatchTarget = document.elementFromPoint(originalEvent.clientX, originalEvent.clientY) || document.body;
        }
        if (dispatchTarget) {
          dispatchTarget.dispatchEvent(customDropEvent);
        }
      }
    } catch (err) {
      console.error('[AITokenOptimizer] Re-dispatch failed:', err);
    }
  });

})();
