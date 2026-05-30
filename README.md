# 🧩 AI Token Optimizer

> **Reduce AI token usage by up to 70% locally in your browser.** 100% Private, 0% Data Leaks.

**AI Token Optimizer** is a premium, offline-capable Google Chrome extension that intercepts file uploads (.pdf, .docx, .xlsx, .csv, and .md) on popular AI chat platforms (Claude.ai, ChatGPT, Gemini, and Perplexity), processes and compiles them locally in the browser to highly efficient, optimized Markdown, and uploads the clean Markdown version instead.

This saves massive amounts of context window tokens, cuts down costs, speeds up AI reasoning, and bypasses platform-specific size or file type friction.

---

## ✨ Features

- 🔒 **100% Local & Private**: All document parsing (PDF, Word, Excel, CSV) happens entirely inside your browser sandbox. No file data ever leaves your device.
- 📉 **Up to 70% Token Savings**: Smart compaction removes redundant empty spaces, splits long headings, and eliminates bloated document tags.
- ⚡ **Seamless Interception**: Automatically catches `<input type="file">` change events and drag-and-drop triggers on chat targets using capture-phase event hooking.
- 📊 **Interactive HUD**: Displays a clean, smooth, animated loading indicator in the bottom/top-right of your screen showing optimization progress and immediate token-saving ratios.
- 🧪 **Popup Playground**: Open the extension dashboard to drag-and-drop any document and view the structured Markdown preview instantly, copy it to your clipboard, or tweak options.
- 📈 **Savings Dashboard**: Live-track the total files processed, original file sizes vs. optimized markdown sizes, and estimated cumulative tokens saved.
- ⚙️ **Custom Instructions Template**: Prepend a custom system prompt to every optimized document automatically (e.g., *"Here is the optimized markdown version of my sheet. Tidy up the figures and wait for my instructions..."*).

---

## 🛠️ Supported Formats

| Format | Library & Strategy | Output Type | Optimization Pass |
| :--- | :--- | :--- | :--- |
| **PDF (`.pdf`)** | `PDF.js` with structural coordinate extraction | Structured `.md` | Column reconstruction, list formatting, sub/superscript mapping, PPT reveal-slide deduplication |
| **Word (`.docx`)** | `Mammoth.js` HTML tag compilation | Semantic `.md` | Semantic headers, bold, italics, tables, and list extraction |
| **Excel (`.xlsx` / `.xls`)** | `SheetJS` workbook cell mapper | Table `.md` | Token-efficient clean table rows (blanks, unused cells stripped) |
| **CSV (`.csv`)** | Native text decoder with SheetJS parsing | Table `.md` | Layout compressed tables |
| **Markdown (`.md`)** | Native text pass-through | Optimized `.md` | Whitespace compaction, multi-newline trimming |

---

## 🚀 Installation

Since this is a developer-focused Chrome extension, you can install it easily in less than a minute:

1. **Clone or Download** this repository to your local machine.
2. Open Google Chrome and navigate to `chrome://extensions/`.
3. In the top-right corner of the Extensions page, toggle the **"Developer mode"** switch to **ON**.
4. Click the **"Load unpacked"** button in the top-left corner.
5. Select the folder containing this project (`chrome extension`).
6. Pin the **AI Token Optimizer** from your extensions bar for easy access!

---

## 🔬 How It Works

### Dual-Layer Event Interception
The extension injects a lightweight, isolated content script (`content.js`) into supported AI domains. It registers listeners on the `change` event of `<input type="file">` and the `drop` event of drag-and-drop zones during the **capture phase** (`useCapture = true`). This allows it to halt target page handlers (like React file upload handlers on Claude/ChatGPT), process the file, programmatically build a new optimized file using `DataTransfer` APIs, and safely dispatch it so the platform uploads it seamlessly.

### Local Conversion Pipelines
The core engine (`converter.js`) leverages high-performance, sandboxed browser-level APIs and Web Workers to read file buffers:
1. **PDF Parse**: Reconstructs paragraphs, matches font baselines to capture mathematical sub/superscripts, filters out visual-only components (images, diagram labels), and formats structured data.
2. **Word Parse**: Formats HTML entities from mammoth into lightweight markdown strings.
3. **Excel/CSV Parse**: Cleans up spreadsheet tables, drops completely empty rows/columns, formats dates, and generates standard pipe-separated GFM tables.

---

## 📂 Project Structure

```
chrome-extension/
├── manifest.json            # Extension configuration (Manifest V3)
├── image.png                # Extension brand icon
├── background.js            # Background service worker (State & storage initialization)
├── content.js               # Content script (Capture phase event hooking & HUD)
├── converter.js             # Local parsing & optimization engine
├── styles.css               # HUD progress overlay UI styling
├── lib/                     # Offline library dependencies
│   ├── pdf.js               # PDF document engine
│   ├── pdf.worker.js        # PDF worker service
│   ├── mammoth.browser.min.js # Word document converter
│   └── xlsx.full.min.js     # SheetJS Excel parser
└── popup/                   # Extension popup interface
    ├── popup.html           # Dashboard & Playground UI
    ├── popup.js             # Interactive controller
    └── popup.css            # Custom glassmorphic styling
```

---

## 🛡️ Privacy & Security

We believe your data is yours alone. **AI Token Optimizer** requires no internet access permissions (other than matching chat sites for scripts injection) and contacts **zero external APIs or servers**. 
- 🟢 **No telemetry or analytics tracking**
- 🟢 **No remote script loading (all libraries are fully bundled locally)**
- 🟢 **No file logging or third-party cookies**

---

## 📝 License

This project is licensed under the MIT License. Feel free to fork, modify, and distribute as you see fit!
