# Contributing to AI Token Optimizer

First off, thank you for considering contributing to **AI Token Optimizer**! 🎉

This project thrives on community contributions — whether it's fixing a bug, adding support for a new file format, improving the token optimization pipeline, or simply improving documentation. Every contribution is welcome and appreciated.

This document walks you through the entire process, from setting up your development environment to getting your pull request merged.

---

## 📋 Table of Contents

- [Code of Conduct](#-code-of-conduct)
- [How Can I Contribute?](#-how-can-i-contribute)
- [Development Setup](#-development-setup)
- [Contribution Workflow](#-contribution-workflow)
- [Branch Naming Conventions](#-branch-naming-conventions)
- [Commit Message Guidelines](#-commit-message-guidelines)
- [Pull Request Process](#-pull-request-process)
- [Coding Guidelines](#-coding-guidelines)
- [Project Structure](#-project-structure)
- [Testing Your Changes](#-testing-your-changes)
- [Reporting Bugs](#-reporting-bugs)
- [Suggesting Features](#-suggesting-features)

---

## 📜 Code of Conduct

Please be respectful and constructive in all interactions. We are committed to providing a welcoming and harassment-free experience for everyone, regardless of experience level, background, or identity. Disrespectful behavior will not be tolerated.

---

## 🤝 How Can I Contribute?

There are many ways to contribute:

| Type | Examples |
| :--- | :--- |
| 🐛 **Bug Fixes** | Fix file interception issues, parsing errors, or UI glitches |
| ✨ **New Features** | New file format support, new AI platform support, new optimization passes |
| 📈 **Performance** | Faster parsing, lower memory usage, better token compaction ratios |
| 📖 **Documentation** | Improve the README, add code comments, write guides |
| 🎨 **UI / UX** | Improve the popup dashboard, previews, and settings experience |
| 🧪 **Testing** | Report edge-case documents that parse incorrectly |

---

## 🛠️ Development Setup

### Prerequisites

- **Google Chrome** (or any Chromium-based browser such as Edge or Brave)
- **Git** installed on your machine
- A **GitHub account**

### Setting Up Locally

1. **Fork the repository**

   Click the **"Fork"** button at the top-right of the [repository page](https://github.com/vinitgirdhar/Token-Optimizer). This creates your own copy of the project under your GitHub account.

2. **Clone your fork** (not the original repository):

   ```bash
   git clone https://github.com/<your-username>/Token-Optimizer.git
   cd Token-Optimizer
   ```

3. **Add the upstream remote** so you can keep your fork in sync:

   ```bash
   git remote add upstream https://github.com/vinitgirdhar/Token-Optimizer.git
   ```

4. **Load the extension in Chrome**:
   - Navigate to `chrome://extensions/`
   - Toggle **Developer mode** ON (top-right corner)
   - Click **Load unpacked** and select the cloned `Token-Optimizer` folder
   - The extension is now running from your local source code

5. After making code changes, click the **↻ Reload** button on the extension card in `chrome://extensions/` to apply them. Content-script changes also require refreshing the AI platform tab (e.g., claude.ai or chatgpt.com).

---

## 🔁 Contribution Workflow

1. **Sync your fork** with the latest upstream changes:

   ```bash
   git checkout main
   git fetch upstream
   git merge upstream/main
   git push origin main
   ```

2. **Create a new branch** for your work (never commit directly to `main`):

   ```bash
   git checkout -b feature/your-feature-name
   ```

3. **Make your changes** and test them thoroughly (see [Testing Your Changes](#-testing-your-changes)).

4. **Commit** your work with a clear message (see [Commit Message Guidelines](#-commit-message-guidelines)).

5. **Push** the branch to your fork:

   ```bash
   git push -u origin feature/your-feature-name
   ```

6. **Open a Pull Request** against the `main` branch of the original repository, filling in the PR template completely.

---

## 🌿 Branch Naming Conventions

Use descriptive branch names with one of the following prefixes:

| Prefix | Purpose | Example |
| :--- | :--- | :--- |
| `feature/` | New functionality | `feature/pptx-support` |
| `fix/` | Bug fixes | `fix/pdf-column-detection` |
| `docs/` | Documentation only | `docs/update-readme` |
| `refactor/` | Code restructuring, no behavior change | `refactor/converter-pipeline` |
| `perf/` | Performance improvements | `perf/lazy-load-ocr` |

---

## ✍️ Commit Message Guidelines

Write commit messages that explain **what** changed and **why**:

```
<type>: <short summary in imperative mood>

[optional body explaining the motivation and approach]
```

**Types:** `feat`, `fix`, `docs`, `refactor`, `perf`, `style`, `chore`

**Examples:**

```
feat: add OCR fallback for scanned PDF pages
fix: prevent duplicate interception on Gemini drag-and-drop
docs: add troubleshooting section to README
```

- Keep the summary line under 72 characters
- Use the imperative mood ("add", not "added" or "adds")
- Reference related issues in the body when applicable (e.g., `Fixes #12`)

---

## 🔀 Pull Request Process

1. **Fill out the PR template completely.** PRs with empty or incomplete templates may be closed or delayed. The template asks for:
   - The **type of change** (feature, bug fix, docs, etc.)
   - A **clear description** of what you added or changed and why
   - **How you tested it** (which platforms, which file types)
   - **Screenshots or recordings** for any UI-facing change
2. **Keep PRs focused.** One feature or fix per pull request — small, reviewable PRs get merged much faster than large ones.
3. **Test before submitting.** Verify your change on at least one supported AI platform with at least one supported file format.
4. **Respond to review feedback.** Reviews are collaborative — questions and change requests are part of the process.
5. A maintainer will review, request changes if needed, and merge once approved.

---

## 🧑‍💻 Coding Guidelines

- **Vanilla JavaScript only.** This project intentionally has no build step and no framework — code runs directly as loaded by Chrome.
- **Privacy is non-negotiable.** Never introduce code that sends file contents, telemetry, or analytics to any external server. All processing must remain 100% local.
- **No new remote dependencies.** Third-party libraries must be bundled locally in `lib/` (required by Manifest V3 and our privacy guarantee).
- **Match the existing style.** Follow the naming, indentation, and commenting patterns already present in the file you're editing.
- **Mind the manifest.** If your change requires new permissions or host matches, justify them clearly in the PR description — permission creep is reviewed strictly.
- **Performance matters.** Files are parsed in the browser's main/worker threads; avoid blocking operations on large documents.

---

## 📁 Project Structure

```
Token-Optimizer/
├── manifest.json        # Chrome Extension Manifest (V3) — permissions, scripts, matches
├── background.js        # Service worker (extension lifecycle & messaging)
├── content.js           # Content script — intercepts file uploads on AI platforms
├── inject.js            # MAIN-world script for deep page-level interception
├── converter.js         # Core engine — parses PDF/DOCX/XLSX/CSV → optimized Markdown
├── styles.css           # Injected styles for on-page UI (toasts, indicators)
├── popup/
│   ├── popup.html       # Extension dashboard & playground UI
│   ├── popup.css        # Dashboard styles
│   └── popup.js         # Dashboard logic, stats, settings
└── lib/                 # Bundled third-party libraries (no CDN/remote loading)
    ├── pdf.js           # PDF.js — PDF parsing
    ├── mammoth.browser.min.js  # Mammoth — DOCX → HTML
    ├── xlsx.full.min.js # SheetJS — XLSX/CSV parsing
    ├── jszip.min.js     # JSZip — archive handling
    └── tesseract*.js    # Tesseract.js — OCR for scanned documents
```

---

## 🧪 Testing Your Changes

Run the unit tests for the converter's pure logic first: `node --test tests/converter.test.js`. Browser-only paths (PDF, DOCX, images, interception) still need manual verification:

1. **Reload the extension** at `chrome://extensions/` after every change.
2. **Test the popup playground:** open the extension popup, drag in a sample document, and verify the Markdown preview is correct.
3. **Test live interception:** visit a supported platform (Claude.ai, ChatGPT, Gemini, or Perplexity), upload a file, and confirm the optimized Markdown version is attached instead of the original.
4. **Test edge cases** relevant to your change: multi-column PDFs, scanned PDFs (OCR), spreadsheets with empty rows/columns, very large files.
5. **Check the console** (both the page DevTools and the extension service worker) for errors or warnings introduced by your change.

List everything you tested in the PR template's **"How Has This Been Tested?"** section.

---

## 🐛 Reporting Bugs

Open a [GitHub Issue](https://github.com/vinitgirdhar/Token-Optimizer/issues) and include:

- **Environment:** Chrome version, OS, extension version
- **The AI platform** where the issue occurred (Claude.ai, ChatGPT, Gemini, Perplexity)
- **The file type** and, if possible, a sample file that reproduces the issue (with sensitive data removed)
- **Steps to reproduce** the behavior
- **Expected vs. actual behavior**
- **Console errors**, if any

---

## 💡 Suggesting Features

Have an idea? Open a [GitHub Issue](https://github.com/vinitgirdhar/Token-Optimizer/issues) describing:

- **The problem** your feature solves
- **Your proposed solution** and how it fits the extension's privacy-first, local-only philosophy
- **Alternatives** you've considered

For large features, please open an issue for discussion **before** starting work — this avoids wasted effort if the direction doesn't fit the project roadmap.

---

Thank you for helping make AI Token Optimizer better! 🚀
