<div align="center">

# 🧩 AI Token Optimizer

**Reduce AI token usage by up to 70% — locally, in your browser.**
100% Private. 0% Data Leaks.

![Manifest V3](https://img.shields.io/badge/Chrome%20Extension-Manifest%20V3-4285F4?logo=googlechrome&logoColor=white)
![Version](https://img.shields.io/badge/version-1.2.0-blue)
![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)
![Privacy First](https://img.shields.io/badge/Privacy-100%25%20Local-success)
![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)

</div>

---

**AI Token Optimizer** is an offline-capable Google Chrome extension that intercepts file uploads (`.pdf`, `.docx`, `.pptx`, `.xlsx`, `.csv`, `.md`, `.json`, `.html`, `.txt`, `.log`, and images) on popular AI chat platforms — **Claude.ai, ChatGPT, Gemini, Perplexity**, plus Grok, DeepSeek, Mistral, Copilot, AI Studio and Poe in beta — converts documents locally into optimized Markdown, downscales oversized images, and uploads the lean version instead.

The result: massive context-window savings, lower API costs, faster AI reasoning, and no more platform-specific file size or file type friction.

---

## 📋 Table of Contents

- [Why AI Token Optimizer?](#-why-ai-token-optimizer)
- [Features](#-features)
- [Supported Formats](#-supported-formats)
- [Supported Platforms](#-supported-platforms)
- [Installation](#-installation)
- [Usage](#-usage)
- [How It Works](#-how-it-works)
- [Project Structure](#-project-structure)
- [Privacy & Security](#-privacy--security)
- [Troubleshooting](#-troubleshooting)
- [Contributing](#-contributing)
- [Roadmap](#-roadmap)
- [License](#-license)

---

## 💡 Why AI Token Optimizer?

Raw documents are extremely token-inefficient. A `.docx` or `.pdf` file carries formatting metadata, redundant whitespace, empty spreadsheet cells, and structural bloat that AI platforms tokenize anyway — burning through your context window and your usage limits.

| Without Optimizer | With Optimizer |
| :--- | :--- |
| Raw PDF/DOCX/XLSX uploaded as-is | Clean, structured Markdown uploaded instead |
| Bloated tokens from formatting noise | **Up to 70% fewer tokens** |
| Slower responses on large documents | Faster reasoning over compact input |
| File type & size limits get in the way | Markdown sails through every platform |
| Files uploaded to third-party servers for parsing | **Everything parsed locally in your browser** |

---

## ✨ Features

- 🔒 **100% Local & Private** — All document parsing (PDF, Word, Excel, CSV) happens entirely inside your browser sandbox. No file data ever leaves your device.
- 📉 **Up to 70% Token Savings** — Smart compaction removes redundant whitespace, empty cells, duplicated slide content, and bloated document structure.
- ⚡ **Seamless Interception** — Automatically catches `<input type="file">` change events and drag-and-drop triggers on supported chat platforms using capture-phase event hooking. Zero extra clicks.
- 🔍 **OCR for Scanned Documents** — Built-in Tesseract.js OCR (bundled locally) extracts text from scanned/image-based PDF pages.
- 📰 **Two-Column PDF Support** — Structural coordinate extraction correctly reconstructs multi-column academic papers and reports.
- 🧪 **Popup Playground** — Open the extension dashboard, drag in any document, and instantly view the structured Markdown preview, copy it to your clipboard, or tweak options.
- 📈 **Savings Dashboard** — Live-track total files processed, original vs. optimized sizes, and estimated cumulative tokens saved.
- ⚙️ **Custom Instructions Template** — Automatically prepend a custom system prompt to every optimized document (e.g., *"Here is the optimized markdown version of my sheet. Tidy up the figures and wait for my instructions…"*).

---

## 🛠️ Supported Formats

| Format | Library & Strategy | Output | Optimization Pass |
| :--- | :--- | :--- | :--- |
| **PDF** (`.pdf`) | `PDF.js` with structural coordinate extraction + `Tesseract.js` OCR fallback | Structured `.md` | Column reconstruction, list formatting, sub/superscript mapping, slide-deck deduplication |
| **Word** (`.docx`) | `Mammoth.js` HTML tag compilation | Semantic `.md` | Semantic headers, bold, italics, tables, and list extraction |
| **Excel** (`.xlsx` / `.xls`) | `SheetJS` workbook cell mapper | Table `.md` | Token-efficient clean table rows (blanks and unused cells stripped) |
| **CSV** (`.csv`) | Native text decoder with SheetJS parsing | Table `.md` | Layout-compressed tables |
| **Markdown** (`.md`) | Native text pass-through | Optimized `.md` | Whitespace compaction, multi-newline trimming |
| **JSON** (`.json`) | Native `JSON.parse` | Fenced `.md` | Minified (indentation is pure token overhead); JSON Lines falls back to the text pass |
| **HTML** (`.html` / `.htm`) | Inert `DOMParser` + the DOCX Markdown walker | Semantic `.md` | Scripts, styles, SVG and markup stripped |
| **Text / Logs** (`.txt` / `.log`) | Native text decoder | `.md` | ANSI colour codes stripped, consecutive duplicate lines folded (`line [x400]`) |
| **Images** (`.png` / `.jpg` / `.webp`) | `OffscreenCanvas` | Same format | Downscaled to a 1568px long edge — the resolution vision models actually use; billed tokens scale with pixel count |

## 🌐 Supported Platforms

| Platform | Status |
| :--- | :---: |
| [Claude.ai](https://claude.ai) | ✅ |
| [ChatGPT](https://chatgpt.com) | ✅ |
| [Gemini](https://gemini.google.com) | ✅ |
| [Perplexity](https://www.perplexity.ai) | ✅ |
| [Grok](https://grok.com), [DeepSeek](https://chat.deepseek.com), [Mistral Le Chat](https://chat.mistral.ai), [Copilot](https://copilot.microsoft.com), [Google AI Studio](https://aistudio.google.com), [Poe](https://poe.com) | 🧪 Beta (interception not yet verified on every site) |

---

## 🚀 Installation

This extension is installed as an **unpacked developer extension** — it takes less than a minute.

### Step 1 — Fork the Repository

Click the **"Fork"** button at the top-right of this page to create your own copy of the repository under your GitHub account.

> 💡 Forking first is the recommended workflow — it lets you pull updates cleanly and contribute changes back via pull requests. If you only want to try the extension without a GitHub account, you can use **Code → Download ZIP** instead and skip to Step 3.

### Step 2 — Clone Your Fork

```bash
git clone https://github.com/<your-username>/Token-Optimizer.git
cd Token-Optimizer
```

### Step 3 — Load the Extension in Chrome

1. Open Google Chrome and navigate to `chrome://extensions/`
2. Toggle the **"Developer mode"** switch **ON** (top-right corner)
3. Click the **"Load unpacked"** button (top-left corner)
4. Select the cloned `Token-Optimizer` folder
5. Pin **AI Token Optimizer** from your extensions bar for easy access ✅

### Updating

To get the latest version, pull the newest changes and reload:

```bash
git pull
```

Then click the **↻ Reload** button on the extension card in `chrome://extensions/`.

---

## 📖 Usage

### Automatic Mode (Zero Effort)

1. Visit any supported AI platform (Claude.ai, ChatGPT, Gemini, Perplexity).
2. Upload or drag-and-drop a supported document exactly as you normally would.
3. The extension intercepts the upload, converts the file to optimized Markdown locally, and attaches the Markdown version instead — automatically.

### Playground Mode (Manual Preview)

1. Click the **AI Token Optimizer** icon in your extensions bar.
2. Drag any supported document into the popup playground.
3. Instantly preview the structured Markdown output, copy it to your clipboard, or adjust conversion options.
4. Check the **Savings Dashboard** to see your cumulative token savings.

---

## 🔬 How It Works

### Dual-Layer Event Interception

The extension injects a lightweight, isolated content script (`content.js`) into supported AI domains, plus a MAIN-world script (`inject.js`) for deep page-level hooks. Listeners are registered on the `change` event of `<input type="file">` elements and the `drop` event of drag-and-drop zones during the **capture phase** (`useCapture = true`). This allows the extension to:

1. Halt the platform's own upload handlers (e.g., React file handlers on Claude/ChatGPT) before they fire.
2. Parse and convert the file locally.
3. Programmatically build a new optimized file using the `DataTransfer` API.
4. Re-dispatch the event so the platform uploads the optimized Markdown seamlessly.

### Local Conversion Pipelines

The core engine (`converter.js`) leverages high-performance, sandboxed browser APIs and Web Workers to read file buffers:

1. **PDF Parse** — Reconstructs paragraphs, matches font baselines to capture mathematical sub/superscripts, filters out visual-only components (images, diagram labels), reconstructs multi-column layouts, and falls back to local OCR for scanned pages.
2. **Word Parse** — Compiles Mammoth's HTML output into lightweight semantic Markdown.
3. **Excel/CSV Parse** — Cleans spreadsheet tables, drops completely empty rows/columns, formats dates, and generates standard pipe-separated GFM tables.

---

## 📁 Project Structure

```
Token-Optimizer/
├── manifest.json        # Chrome Extension Manifest (V3)
├── background.js        # Service worker (lifecycle & messaging)
├── content.js           # Content script — upload interception on AI platforms
├── inject.js            # MAIN-world script for page-level interception
├── converter.js         # Core engine — document → optimized Markdown
├── styles.css           # Injected on-page UI styles
├── popup/               # Extension dashboard (playground, stats, settings)
└── lib/                 # Bundled third-party libraries (PDF.js, Mammoth,
                         # SheetJS, JSZip, Tesseract.js — no remote loading)
```

---

## 🛡️ Privacy & Security

We believe your data is yours alone. **AI Token Optimizer** requires no internet-access permissions (other than matching chat sites for script injection) and contacts **zero external APIs or servers**.

- 🟢 **No telemetry or analytics tracking**
- 🟢 **No remote script loading** — all libraries (including OCR models) are fully bundled locally
- 🟢 **No file logging or third-party cookies**
- 🟢 **Minimal permissions** — only `storage` (for your settings and savings stats) and content-script access to the four supported chat domains

You can verify every claim above yourself — the entire source code is in this repository, unminified where authored by this project, with no build step.

---

## 🩺 Troubleshooting

| Problem | Solution |
| :--- | :--- |
| Uploads aren't being intercepted | Refresh the AI platform tab after installing/reloading the extension (content scripts inject at page load). |
| Changes to the code aren't taking effect | Click **↻ Reload** on the extension card in `chrome://extensions/`, then refresh the platform tab. |
| A specific document parses incorrectly | Open the popup playground, drag the file in, and inspect the preview. Please [open an issue](https://github.com/vinitgirdhar/Token-Optimizer/issues) with a sanitized sample file. |
| Scanned PDF returns little/no text | OCR runs locally and can take longer on large scans — give it a moment. Very low-resolution scans may extract poorly. |

---

## 🤝 Contributing

Contributions are welcome and appreciated! Whether it's a bug fix, a new file format, a new platform, or better docs — we'd love your help.

Please read our **[Contributing Guide](CONTRIBUTING.md)** to get started. It covers:

- 🔧 Setting up your development environment (fork → clone → load unpacked)
- 🌿 Branch naming and commit message conventions
- 🔀 The pull request process and template
- 🧑‍💻 Coding guidelines (privacy-first, no remote dependencies, Manifest V3)
- 🧪 How to test your changes

Found a bug or have a feature idea? [Open an issue](https://github.com/vinitgirdhar/Token-Optimizer/issues) — clear reproduction steps and sample files make fixes much faster.

---

## 🗺️ Roadmap

AI usage has shifted: models take images natively, context windows are 200K–1M tokens, people paste logs and JSON as often as PDFs, and more chat apps compete for attention. The plan follows that shift.

**Phase 1 — Broader inputs (v1.2, shipped)**
- [x] Image downscaling to the resolution vision models use (largest real token saving for screenshots/photos)
- [x] JSON minification, HTML→Markdown, log de-duplication
- [x] Grok, DeepSeek, Mistral, Copilot, AI Studio, Poe (beta)
- [x] Tokenizer-aware estimate (whitespace runs no longer counted as savings)
- [x] Untrusted file names / HTML handled without `innerHTML` (XSS fix)
- [x] Disabled file types no longer trigger the confirm prompt
- [x] Unit tests: `node --test tests/converter.test.js`

**Phase 2 — Smarter compression**
- [ ] Paste interception: optimize large pasted text (logs, JSON, code) the same way as uploads
- [ ] CSV/TSV output option for big tables (pipe-table padding costs tokens on every cell)
- [ ] Context-window fit indicator (e.g. "uses 12% of a 200K window") in the HUD
- [ ] Per-format settings (OCR language, image max edge, table format)

**Phase 3 — Reach**
- [ ] Chrome Web Store release
- [ ] Firefox (WebExtensions) port
- [ ] Optional on-device summarisation via Chrome's built-in AI (Gemini Nano) for documents too large for any context window

Have a suggestion? [Open a feature request](https://github.com/vinitgirdhar/Token-Optimizer/issues)!

---

## 📝 License

This project is licensed under the **MIT License** by **Vinit Girdhar**. Feel free to fork, modify, and distribute as you see fit.

---

<div align="center">

**If this project saves you tokens, consider giving it a ⭐ — it helps others discover it!**

Made with ❤️ for the AI community

</div>
