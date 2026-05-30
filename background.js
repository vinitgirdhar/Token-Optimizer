/**
 * Claude Token Optimizer - Background Service Worker (Manifest V3)
 * Initializes default storage on first install.
 */

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason !== 'install') return;

  chrome.storage.local.set({
    extensions: { pdf: true, docx: true, xlsx: true, csv: true, pptx: true },
    ocrEnabled: false,
    stats: {
      totalFilesOptimized: 0,
      totalOriginalBytes: 0,
      totalOptimizedBytes: 0,
      totalTokensSaved: 0
    },
    customTemplate: ''
  });
});
