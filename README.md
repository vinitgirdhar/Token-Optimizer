<div align="center">

# 🧩 AI Token Optimizer

**Reduce AI token usage by up to 70% — locally, in your browser.**
100% Private. 0% Data Leaks.

![Manifest V3](https://img.shields.io/badge/Chrome%20Extension-Manifest%20V3-4285F4?logo=googlechrome&logoColor=white)
![Firefox 128+](https://img.shields.io/badge/Firefox-128%2B%20(beta)-FF7139?logo=firefoxbrowser&logoColor=white)
![Version](https://img.shields.io/badge/version-1.3.0-blue)
![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)
![Privacy First](https://img.shields.io/badge/Privacy-100%25%20Local-success)
![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)

</div>

---

**AI Token Optimizer** is an offline-capable Chrome (and beta Firefox) extension that intercepts file uploads and large pastes (`.pdf`, `.docx`, `.pptx`, `.xlsx`, `.csv`, `.md`, `.json`, `.html`, `.txt`, `.log`, and images) on popular AI chat platforms — **Claude.ai, ChatGPT, Gemini, Perplexity**, plus Grok, DeepSeek, Mistral, Copilot, AI Studio and Poe in beta — converts documents locally into optimized Markdown, downscales oversized images, compacts pasted JSON and logs, and sends the lean version instead.

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
| Full-resolution screenshots billed by pixel count | Images downscaled to what vision models actually use |
| Pasted pretty-printed JSON and noisy logs | Minified JSON, repeated log lines folded |
| Files uploaded to third-party servers for parsing | **Everything parsed locally in your browser** |

---

## ✨ Features

- 🔒 **100% Local & Private** — All parsing (documents, images, pastes) happens entirely inside your browser sandbox. No file data ever leaves your device.
- 📉 **Up to 70% Token Savings** — Smart compaction removes redundant whitespace, empty cells, duplicated slide content, and bloated document structure.
- ⚡ **Seamless Interception** — Automatically catches `<input type="file">` change events and drag-and-drop triggers on supported chat platforms using capture-phase event hooking. Zero extra clicks.
- 🖼️ **Image Downscaling** — PNG/JPG/WebP uploads are resized to a 1568px long edge (configurable) before upload. Vision tokens scale with pixel count, so a 12MP screenshot drops from ~16K to ~2.5K estimated tokens.
- 📋 **Paste Compaction** — Pastes over 1,500 characters get JSON minified, ANSI colour codes stripped and repeated lines folded, but only when that saves 15%+. Code indentation is never touched, and Ctrl+Z undoes it.
- 📏 **Context-Window Fit** — After each conversion the on-page HUD shows the estimated token count and how much of the site's context window it uses (e.g. *"≈24,310 tokens · 12% of 200K window"*).
- 🎛️ **Output Tuning** — Choose Markdown or CSV for spreadsheet tables, pick the image size limit, and turn paste compaction on or off.
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
| **PowerPoint** (`.pptx`) | `JSZip` + `DOMParser` over slide XML | Structured `.md` | Slide titles, bullets, tables and speaker notes |
| **Excel** (`.xlsx`) | `SheetJS` workbook cell mapper | Table `.md` (or CSV) | Blank rows/columns stripped; optional CSV output skips per-cell pipe padding |
| **CSV** (`.csv`) | SheetJS parsing | Table `.md` (or CSV) | Layout-compressed tables |
| **Markdown** (`.md`) | Native text pass-through | Optimized `.md` | Whitespace compaction, multi-newline trimming |
| **JSON** (`.json`) | Native `JSON.parse` | Fenced `.md` | Minified (indentation is pure token overhead); JSON Lines falls back to the text pass |
| **HTML** (`.html` / `.htm`) | Inert `DOMParser` + the DOCX Markdown walker | Semantic `.md` | Scripts, styles, SVG and markup stripped |
| **Text / Logs** (`.txt` / `.log`) | Native text decoder | `.md` | ANSI colour codes stripped, consecutive duplicate lines folded (`line [x400]`) |
| **Images** (`.png` / `.jpg` / `.webp`) | `OffscreenCanvas` | Same format | Downscaled to a 1568px long edge by default (1024 / 2048 selectable); billed tokens scale with pixel count |

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

### Firefox (beta, 128+)

1. Open `about:debugging#/runtime/this-firefox`
2. Click **Load Temporary Add-on…** and select `manifest.json` in the cloned folder
3. Temporary add-ons are removed when Firefox restarts; reload it the same way

> Firefox support is new and not yet verified end-to-end. Please [report issues](https://github.com/vinitgirdhar/Token-Optimizer/issues).

### Updating

To get the latest version, pull the newest changes and reload:

```bash
git pull
```

Then click the **↻ Reload** button on the extension card in `chrome://extensions/`.

---

## 📖 Usage

### Automatic Mode (Zero Effort)

1. Visit any [supported AI platform](#-supported-platforms).
2. Upload or drag-and-drop a supported document or image exactly as you normally would.
3. Choose **Optimize** in the confirmation popup (or tick *Remember my choice* to skip it next time).
4. The extension converts the file locally and attaches the optimized version instead. The HUD shows tokens saved and how much of the context window the file uses.

### Paste Compaction

Paste a large JSON blob or log into the chat box. If compaction saves 15% or more, the compact version is inserted and a short notice confirms it. Press **Ctrl+Z** to restore the original, or turn it off under **Settings → Output Tuning**.

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
3. **Excel/CSV Parse** — Cleans spreadsheet tables, drops completely empty rows/columns, formats dates, and generates GFM pipe tables or fenced CSV.
4. **PowerPoint Parse** — Unzips the deck and reads slide XML for titles, bullets, tables and speaker notes.
5. **JSON / HTML / Text** — Minifies JSON, converts HTML through an inert `DOMParser` (no scripts run), and folds duplicate log lines.
6. **Images** — Decodes with `createImageBitmap`, resizes on an `OffscreenCanvas`, and re-encodes in the original format.

### Paste Interception

`content.js` listens for `paste` in the capture phase. For large text it computes a lossless compaction, cancels the original paste and dispatches a new one carrying the compact text. Rich editors such as ProseMirror (Claude, ChatGPT) handle it natively. Plain textareas fall back to `insertText`, which keeps native undo working.

### Token Estimation

Savings are estimated with a tokenizer-shaped heuristic (words, 3-digit number groups, CJK characters, merged whitespace) rather than a raw character count, so whitespace removal isn't over-reported. It is an estimate, not an exact count for any one model.

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
├── tests/               # Unit tests: node --test tests/converter.test.js
└── lib/                 # Bundled third-party libraries (PDF.js, Mammoth,
                         # SheetJS, JSZip, Tesseract.js — no remote loading)
```

---

## 🛡️ Privacy & Security

We believe your data is yours alone. **AI Token Optimizer** requires no internet-access permissions (other than matching chat sites for script injection) and contacts **zero external APIs or servers**.

- 🟢 **No telemetry or analytics tracking**
- 🟢 **No remote script loading** — all libraries (including OCR models) are fully bundled locally
- 🟢 **No file logging or third-party cookies**
- 🟢 **Minimal permissions** — only `storage` (for your settings and savings stats) and content-script access to the [supported chat domains](#-supported-platforms)

You can verify every claim above yourself — the entire source code is in this repository, unminified where authored by this project, with no build step.

---

## 🩺 Troubleshooting

| Problem | Solution |
| :--- | :--- |
| Uploads aren't being intercepted | Refresh the AI platform tab after installing/reloading the extension (content scripts inject at page load). |
| Changes to the code aren't taking effect | Click **↻ Reload** on the extension card in `chrome://extensions/`, then refresh the platform tab. |
| A specific document parses incorrectly | Open the popup playground, drag the file in, and inspect the preview. Please [open an issue](https://github.com/vinitgirdhar/Token-Optimizer/issues) with a sanitized sample file. |
| A paste wasn't compacted | Only pastes over 1,500 characters that shrink by 15%+ are changed. Check **Settings → Output Tuning → Compact Large Pastes**. |
| I want the original paste back | Press **Ctrl+Z** right after pasting. |
| An image wasn't resized | Images already within the size limit are uploaded unchanged. GIFs are never modified. |
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

**Phase 2 — Smarter compression (v1.3, shipped)**
- [x] Paste compaction: pastes over 1,500 chars get JSON minified, ANSI codes stripped and repeated lines folded — only when it saves 15%+, never touching code indentation (Ctrl+Z undoes)
- [x] CSV output option for spreadsheets (no per-cell pipe padding)
- [x] Context-window fit in the HUD (e.g. "≈24,310 tokens · 12% of 200K window")
- [x] Output Tuning settings: paste toggle, table format, image max size (1024 / 1568 / 2048px)

**Phase 3 — Reach**
- [x] Firefox 128+ manifest support (`browser_specific_settings`, background `scripts`) — load via `about:debugging` → *Load Temporary Add-on* → `manifest.json`; not yet verified end-to-end
- [ ] Chrome Web Store / Firefox AMO listings (needs store assets and the owner's developer accounts)
- [ ] Optional on-device summarisation via Chrome's built-in AI (Gemini Nano) for documents too large for any context window — deferred: lossy, so it needs its own opt-in UX

Have a suggestion? [Open a feature request](https://github.com/vinitgirdhar/Token-Optimizer/issues)!

---

## 📝 License

This project is licensed under the **MIT License** by **Vinit Girdhar**. Feel free to fork, modify, and distribute as you see fit.

---

<div align="center">

**If this project saves you tokens, consider giving it a ⭐ — it helps others discover it!**

Made with ❤️ for the AI community

</div>
