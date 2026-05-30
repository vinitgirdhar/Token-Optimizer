/**
 * Claude Token Optimizer - Injected Main World Script
 * Intercepts change/drop events in the page context to bypass Chrome Extension isolated-world limitations.
 */
(function () {
  'use strict';

  const TARGET_EXTENSIONS = ['pdf', 'docx', 'pptx', 'xlsx', 'csv', 'md'];
  const _pendingTransactions = new Map();

  function isTargetFile(fileName) {
    if (!fileName) return false;
    const ext = fileName.split('.').pop().toLowerCase();
    return TARGET_EXTENSIONS.includes(ext);
  }

  function hasTargetFiles(files) {
    if (!files || files.length === 0) return false;
    return Array.from(files).some(file => file && file.name && isTargetFile(file.name));
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
      console.error('[ClaudeTokenOptimizer] Fallback failed:', err);
    }
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

      const txId = Math.random().toString(36).substring(2, 9);
      
      // Auto-fallback timer to prevent stuck uploads
      const timeoutId = setTimeout(() => {
        const pendingTx = _pendingTransactions.get(txId);
        if (pendingTx) {
          _pendingTransactions.delete(txId);
          console.warn('[ClaudeTokenOptimizer] Transaction timed out. Falling back to original files.');
          fallbackToOriginal(pendingTx);
        }
      }, 60000); // 60 seconds safety window

      _pendingTransactions.set(txId, {
        eventType: 'change',
        target: target,
        originalEvent: event,
        files: Array.from(files),
        timeoutId: timeoutId
      });

      // Request optimization from the isolated content script
      window.dispatchEvent(new CustomEvent('ato-request-optimization', {
        detail: {
          transactionId: txId,
          eventType: 'change',
          files: Array.from(files)
        }
      }));
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

    const txId = Math.random().toString(36).substring(2, 9);

    // Auto-fallback timer to prevent stuck uploads
    const timeoutId = setTimeout(() => {
      const pendingTx = _pendingTransactions.get(txId);
      if (pendingTx) {
        _pendingTransactions.delete(txId);
        console.warn('[ClaudeTokenOptimizer] Transaction timed out. Falling back to original files.');
        fallbackToOriginal(pendingTx);
      }
    }, 60000); // 60 seconds safety window

    _pendingTransactions.set(txId, {
      eventType: 'drop',
      target: event.target,
      originalEvent: event,
      files: Array.from(dataTransfer.files),
      timeoutId: timeoutId
    });

    // Request optimization from the isolated content script
    window.dispatchEvent(new CustomEvent('ato-request-optimization', {
      detail: {
        transactionId: txId,
        eventType: 'drop',
        files: Array.from(dataTransfer.files)
      }
    }));
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
      console.error('[ClaudeTokenOptimizer] Re-dispatch failed:', err);
    }
  });

})();
