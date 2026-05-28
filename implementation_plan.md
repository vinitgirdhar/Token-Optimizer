# Implementation Plan - AI Token Optimizer Chrome Extension

This plan outlines the architecture, design, and implementation steps for building **Antigravity AI Token Optimizer**, a Chrome extension that intercepts file uploads (.pdf, .docx, .xlsx, .csv) on AI chat platforms (Claude, ChatGPT, Gemini, Perplexity), converts them locally in the browser to highly optimized, token-efficient Markdown (.md), and uploads the Markdown version instead.

---

## User Review Required

> [!IMPORTANT]
> **Interception Strategy**: We will implement a dual-layer interception approach:
> 1. **DOM Capture Phase Hooking**: Listening to `change` events on `<input type="file">` elements and `drop` events on drag-and-drop targets in the capture phase.
> 2. **API Injection (Optional/Fallback)**: Overriding `HTMLInputElement.prototype.files` and `DataTransfer.prototype.files` via a lightweight script injected into the page context.
> This makes the extension highly robust and self-healing against UI updates by Claude or ChatGPT.

> [!TIP]
> **Local Processing & Privacy**: All file parsing (PDF, Word, Excel, CSV) happens **100% on-device** using local Web Workers or bundled client-side libraries. No file data ever leaves the user's browser, maintaining absolute privacy.

---

## Technical Stack & Libraries

To keep development simple, fast, and robust (without requiring the user to run complex build steps to run the unpacked extension), we will build this using **Modern Vanilla JS (ES6+), Premium CSS variables, and HTML5**, structure it for Chrome Extension Manifest V3, and bundle pre-built, offline-capable library files:

1. **PDF.js (`pdf.js` & `pdf.worker.js`)**: For extracting raw text, tables, and headers from PDFs.
2. **Mammoth.js (`mammoth.browser.min.js`)**: For converting Word `.docx` documents into structured HTML, which we then convert to clean Markdown.
3. **SheetJS (`xlsx.full.min.js`)**: For parsing Excel files (`.xlsx`, `.xls`) and CSV files, enabling conversion of complex sheets into perfectly aligned Markdown tables.
4. **Token Optimizer Engine**: A custom JS library to strip redundant whitespaces, clean up broken characters, format tables efficiently, and estimate LLM tokens (using a simple rule of thumb: ~4 characters per token).

---

## Proposed Changes

```
chrome-extension/
├── manifest.json            # Extension configuration (Manifest V3)
├── icon.png                 # Extension logo
├── background.js            # Background service worker (state management, stats)
├── content.js               # Content script injected into ChatGPT, Claude, etc.
├── inject.js                # Page-context script for API-level file interception
├── converter.js             # Shared file processing & Markdown conversion library
├── styles.css               # Injected stylesheet for the premium optimization overlay UI
├── lib/                     # Client-side dependency libraries (bundled for local/offline run)
│   ├── pdf.js
│   ├── pdf.worker.js
│   ├── mammoth.browser.min.js
│   └── xlsx.full.min.js
├── popup/
│   ├── popup.html           # Premium glassmorphic interface (Dashboard + Playground)
│   ├── popup.js             # Statistics, configuration settings, and drag-and-drop playground
│   └── popup.css            # Styles for popup dashboard
```

---

### Component Details

#### 1. Manifest V3 Configuration (`manifest.json`)
- Request permissions for `storage` (saving stats, toggles) and content script injection on `https://chatgpt.com/*`, `https://claude.ai/*`, `https://gemini.google.com/*`, and `https://*.perplexity.ai/*`.
- Expose `lib/` files as web-accessible resources so they can be loaded by the content script or background worker.

#### 2. Shared Conversion Engine (`converter.js`)
- **PDF Parser**: Reads PDF pages, extracts text items with coordinate matching to reconstruct columns/paragraphs, and handles basic tables.
- **DOCX Parser**: Feeds the array buffer to `mammoth.convertToHtml` and parses the HTML to clean Markdown (preserving headers, bold, italics, tables, and lists).
- **Excel/CSV Parser**: Uses SheetJS to read worksheets, converting sheets into standard Markdown tables:
  ```markdown
  | Header 1 | Header 2 |
  | -------- | -------- |
  | Cell 1   | Cell 2   |
  ```
- **Markdown Optimization Engine**:
  - Trims consecutive empty lines (reducing token waste).
  - Compacts markdown tables (removes unnecessary spaces).
  - Converts verbose formatting to standard lightweight markdown.
  - Adds meta header block to let the AI know it's reading an optimized document:
    ```markdown
    <!-- [OPTIMIZED BY ANTIGRAVITY TOKEN OPTIMIZER]
         Original File: annual_report.pdf
         Format: PDF -> Markdown
         Tokens Saved: ~65%
    -->
    ```

#### 3. Interception Script (`content.js` & `inject.js`)
- Runs in the capture phase on `change` events for `input[type="file"]`.
- Checks if files match: `.pdf`, `.docx`, `.xlsx`, `.csv`.
- If match found:
  1. Interrupts the event.
  2. Displays a stunning, animated overlay in the browser: **"Optimizing Document for AI..."** with a token saving indicator.
  3. Triggers `converter.js` on the file.
  4. Generates an optimized `.md` file with the name `[original_name]_optimized.md`.
  5. Updates the `<input>` element's file selection using `DataTransfer` APIs.
  6. Dispatches a new, programmatically marked `change` event so the platform uploads our optimized Markdown file seamlessly!
- Also intercepts `drop` events on textareas/chat inputs to prevent direct dropping of raw documents, converting them first.

#### 4. Premium Interface (`popup.html`, `popup.css`, `popup.js`)
- **Visuals**: Modern glassmorphic theme with a dark/neon color scheme (emerald and deep indigo gradients), custom typography, and micro-animations.
- **Dashboard**:
  - **Total Files Optimized** counter.
  - **Estimated Tokens Saved** counter.
  - **Cost Saved ($USD)** visual tracker.
- **Settings Panel**:
  - Toggles for file types (PDF, Word, Excel, CSV).
  - Custom instruction templates (e.g., "Summarize this...", "Analyze this data...").
  - Table compression toggles.
- **Interactive Playground**:
  - Drag-and-drop zone right inside the popup!
  - Users can drop any local file to immediately see the converted Markdown, a character/token counter, and a "Copy to Clipboard" button.

---

## Verification Plan

### Automated & Manual Verification
1. **Offline Support Test**: Disable network connection and verify files convert successfully (proving no external servers are contacted).
2. **Library Validation**: Ensure Mammoth, PDFJS, and SheetJS load correctly.
3. **Format Integrity Tests**:
   - Convert a complex `.xlsx` with empty columns and ensure it outputs a valid, clean Markdown table.
   - Convert a multi-page PDF with headers, footers, and bullet points, checking that headers and lists are correctly preserved.
   - Convert a `.docx` with bold/italic text and headers to verify standard Markdown tags are generated.
4. **Interception Tests**:
   - Open ChatGPT (`https://chatgpt.com`) and upload a PDF. Verify that ChatGPT receives an optimized `.md` file.
   - Open Claude (`https://claude.ai`) and drag-and-drop a `.docx`. Verify that Claude receives the `.md` file.
   - Verify the Token Savings HUD overlay matches the selected theme and animates smoothly during parsing.

### Performance Target
- File conversion completed in **< 300ms** for files up to 5MB.
- High-fidelity tables and list retention.
- Absolute privacy: 0 network requests outside target platform domains.
