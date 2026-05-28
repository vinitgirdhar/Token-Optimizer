/**
 * Claude Token Optimizer - Conversion & Optimization Engine
 * Runs locally in browser (offline-capable, 100% private)
 */

const TokenOptimizerConverter = (function () {
  // Detect whether we're running inside the extension popup vs. injected on a webpage
  const _isContentScript = typeof window !== 'undefined'
    && window.location.protocol !== 'chrome-extension:'
    && typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL;

  // Initialize PDF.js worker configuration
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL) {
    if (typeof pdfjsLib !== 'undefined') {
      // Set the canonical worker source (used by popup for real Worker, or by
      // fake-worker's loadScript fallback on external pages).
      pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('lib/pdf.worker.js');

      if (_isContentScript && pdfjsLib.PDFWorkerUtil) {
        // On external pages (Gemini, ChatGPT, Claude) strict CSP policies block
        // blob: Workers. Disable the Worker path entirely so pdf.js goes straight
        // to its "fake worker" mode (runs on the main thread instead).
        // The fake worker finds globalThis.pdfjsWorker.WorkerMessageHandler which
        // is set when pdf.worker.js is loaded as a content script.
        pdfjsLib.PDFWorkerUtil.isWorkerDisabled = true;
      }
    }
  }

  /**
   * Helper: Convert ArrayBuffer to string (for CSVs/text)
   */
  function arrayBufferToString(buffer) {
    const decoder = new TextDecoder('utf-8');
    return decoder.decode(buffer);
  }

  /**
   * Helper: Parse HTML string to Markdown (used for mammoth DOCX outputs)
   */
  function htmlToMarkdown(htmlString) {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlString;

    function processNode(node, listType = null, listIndex = 0) {
      if (node.nodeType === Node.TEXT_NODE) {
        return node.textContent;
      }

      if (node.nodeType !== Node.ELEMENT_NODE) {
        return '';
      }

      const tagName = node.tagName.toLowerCase();

      // Process children first
      const childrenContent = Array.from(node.childNodes)
        .map((child, idx) => processNode(child, tagName === 'ul' ? 'ul' : tagName === 'ol' ? 'ol' : listType, idx + 1))
        .join('');

      switch (tagName) {
        case 'h1':
          return `\n\n# ${childrenContent.trim()}\n\n`;
        case 'h2':
          return `\n\n## ${childrenContent.trim()}\n\n`;
        case 'h3':
          return `\n\n### ${childrenContent.trim()}\n\n`;
        case 'h4':
          return `\n\n#### ${childrenContent.trim()}\n\n`;
        case 'h5':
          return `\n\n##### ${childrenContent.trim()}\n\n`;
        case 'h6':
          return `\n\n###### ${childrenContent.trim()}\n\n`;
        case 'p':
          return `\n\n${childrenContent.trim()}\n\n`;
        case 'strong':
        case 'b':
          const strTrimmed = childrenContent.trim();
          return strTrimmed ? ` **${strTrimmed}** ` : '';
        case 'em':
        case 'i':
          const emTrimmed = childrenContent.trim();
          return emTrimmed ? ` *${emTrimmed}* ` : '';
        case 'a':
          const href = node.getAttribute('href') || '';
          return ` [${childrenContent.trim()}](${href}) `;
        case 'li':
          if (listType === 'ol') {
            return `\n${listIndex}. ${childrenContent.trim()}`;
          }
          return `\n* ${childrenContent.trim()}`;
        case 'ul':
        case 'ol':
          return `\n${childrenContent}\n`;
        case 'br':
          return '\n';
        case 'table':
          return `\n\n${childrenContent.trim()}\n\n`;
        case 'tr':
          return `${childrenContent}|\n`;
        case 'th':
        case 'td':
          return `| ${childrenContent.trim().replace(/\|/g, '\\|')} `;
        case 'code': {
          const codeText = childrenContent.trim();
          return codeText ? `\`${codeText}\`` : '';
        }
        case 'pre': {
          const preText = childrenContent.trim();
          return preText ? `\n\n\`\`\`\n${preText}\n\`\`\`\n\n` : '';
        }
        case 'blockquote':
          return `\n\n> ${childrenContent.trim().replace(/\n/g, '\n> ')}\n\n`;
        case 'del':
        case 's': {
          const delTrimmed = childrenContent.trim();
          return delTrimmed ? ` ~~${delTrimmed}~~ ` : '';
        }
        case 'div':
        case 'span':
        case 'section':
        case 'article':
        case 'main':
        case 'header':
        case 'footer':
        case 'nav':
        case 'aside':
          return childrenContent;
        default:
          return childrenContent;
      }
    }

    // Clean and convert
    let markdown = processNode(tempDiv);

    // Format tables in markdown to have proper header separators
    markdown = formatMarkdownTables(markdown);

    return markdown;
  }

  /**
   * Helper: Ensure tables have standard header dividers
   */
  function formatMarkdownTables(markdown) {
    const lines = markdown.split('\n');
    const result = [];
    let inTable = false;
    let tableHeadersCount = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.startsWith('|') && line.endsWith('|')) {
        if (!inTable) {
          inTable = true;
          result.push(line);
          // Insert a separator row right after the first row
          tableHeadersCount = (line.match(/\|/g) || []).length - 1;
          const separator = '| ' + Array(tableHeadersCount).fill('---').join(' | ') + ' |';
          result.push(separator);
        } else {
          result.push(line);
        }
      } else {
        if (inTable) {
          inTable = false;
        }
        result.push(lines[i]);
      }
    }
    return result.join('\n');
  }

  // Unicode sub/superscript character maps for math notation
  const SUBSCRIPT_MAP = {
    '0':'₀','1':'₁','2':'₂','3':'₃','4':'₄',
    '5':'₅','6':'₆','7':'₇','8':'₈','9':'₉',
    'a':'ₐ','e':'ₑ','o':'ₒ','x':'ₓ','i':'ᵢ',
    'n':'ₙ','m':'ₘ','k':'ₖ','t':'ₜ',
    '+':'₊','-':'₋','=':'₌','(':'₍',')':'₎'
  };
  const SUPERSCRIPT_MAP = {
    '0':'⁰','1':'¹','2':'²','3':'³','4':'⁴',
    '5':'⁵','6':'⁶','7':'⁷','8':'⁸','9':'⁹',
    'n':'ⁿ','T':'ᵀ','i':'ⁱ','x':'ˣ',
    '+':'⁺','-':'⁻','=':'⁼','(':'⁽',')':'⁾'
  };

  function toSubscriptStr(str) {
    return str.split('').map(c => SUBSCRIPT_MAP[c] || c).join('');
  }
  function toSuperscriptStr(str) {
    return str.split('').map(c => SUPERSCRIPT_MAP[c] || c).join('');
  }

  // Detect column-separated cells in a PDF line by finding large horizontal gaps.
  // Returns an array of cell strings if ≥2 columns found, otherwise null.
  function extractTableCells(items) {
    if (!items || items.length < 2) return null;
    const sorted = [...items].sort((a, b) => a.x - b.x);
    const lineWidth = sorted[sorted.length - 1].x + sorted[sorted.length - 1].width - sorted[0].x;
    const minGap = Math.max(18, lineWidth * 0.12);

    const cells = [];
    let cell = sorted[0].text;
    let lastRight = sorted[0].x + sorted[0].width;

    for (let i = 1; i < sorted.length; i++) {
      const gap = sorted[i].x - lastRight;
      if (gap >= minGap) {
        cells.push(cell.trim());
        cell = sorted[i].text;
      } else {
        if (gap > 3) cell += ' ';
        cell += sorted[i].text;
      }
      lastRight = sorted[i].x + sorted[i].width;
    }
    cells.push(cell.trim());
    return cells.length >= 2 ? cells : null;
  }

  // Render a 2D array of strings as a Markdown table.
  function buildMarkdownTable(rows) {
    const colCount = rows[0].length;
    const esc = s => (s || '').replace(/\|/g, '\\|');
    const header = '| ' + rows[0].map(esc).join(' | ') + ' |';
    const sep    = '| ' + Array(colCount).fill('---').join(' | ') + ' |';
    const body   = rows.slice(1).map(r => '| ' + r.map(esc).join(' | ') + ' |').join('\n');
    return body ? `${header}\n${sep}\n${body}` : header;
  }

  /**
   * 1. PDF to Markdown
   */
  async function convertPDFToMarkdown(arrayBuffer, onProgress = null) {
    if (typeof pdfjsLib === 'undefined') {
      throw new Error('PDF.js library is not loaded.');
    }

    // Ensure the fake-worker handler is available in content-script contexts.
    // pdf.worker.js *should* have set globalThis.pdfjsWorker when it loaded as a
    // content script, but on some pages (Gemini) the UMD export can fail silently.
    // If it's missing, fetch the bundled worker source and eval it in the
    // content-script's isolated world (not subject to the page's CSP).
    if (_isContentScript && !globalThis.pdfjsWorker?.WorkerMessageHandler) {
      try {
        const _res = await fetch(chrome.runtime.getURL('lib/pdf.worker.js'));
        const _code = await _res.text();
        (0, eval)(_code); // indirect eval → runs in global scope of isolated world
      } catch (_e) {
        console.warn('[TokenOptimizer] Manual pdf.worker load failed:', _e);
      }
    }

    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;
    let markdown = '';
    const pageResults = [];
    const numPages = pdf.numPages;

    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      if (onProgress) {
        onProgress(pageNum, numPages);
      }

      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();

      // Sort items: top-to-bottom (Y coordinate desc), then left-to-right (X coordinate asc)
      // transform matrix: [scaleX, skewX, skewY, scaleY, posX, posY]
      // posY is transform[5], posX is transform[4]
      const items = textContent.items.map(item => ({
        text: item.str,
        x: item.transform[4],
        y: item.transform[5],
        fontSize: Math.round(Math.sqrt(item.transform[0] * item.transform[0] + item.transform[1] * item.transform[1])),
        height: item.height,
        width: item.width
      }));

      if (items.length === 0) continue;

      // Pass 1: group items into lines.
      // Tolerance of 8pt captures subscripts/superscripts (2–6pt offset) without merging
      // adjacent body-text lines (which are typically 12–14pt apart).
      const linesMap = new Map();
      const yTolerance = 8;

      items.forEach(item => {
        let foundLineY = null;
        let minDiff = Infinity;
        for (const lineY of linesMap.keys()) {
          const diff = Math.abs(lineY - item.y);
          if (diff <= yTolerance && diff < minDiff) {
            minDiff = diff;
            foundLineY = lineY;
          }
        }
        if (foundLineY !== null) {
          linesMap.get(foundLineY).push(item);
        } else {
          linesMap.set(item.y, [item]);
        }
      });

      // Sort lines top-to-bottom (Y descending in PDF coords where Y=0 is bottom)
      const sortedY = Array.from(linesMap.keys()).sort((a, b) => b - a);

      // Pass 2: determine body font size (modal font size = body text)
      let bodyFontSize = 10;
      const fontSizeCounts = {};
      items.forEach(item => {
        if (item.text.trim()) {
          fontSizeCounts[item.fontSize] = (fontSizeCounts[item.fontSize] || 0) + 1;
        }
      });
      let maxCount = 0;
      for (const size in fontSizeCounts) {
        if (fontSizeCounts[size] > maxCount) {
          maxCount = fontSizeCounts[size];
          bodyFontSize = parseInt(size);
        }
      }

      // Pass 3: build structured line data with sub/superscript detection.
      // Each entry: { text, items, maxFontSize, lineGap }
      const lineData = [];
      let prevLineY = null;

      for (let j = 0; j < sortedY.length; j++) {
        const lineY = sortedY[j];
        const lineItems = linesMap.get(lineY);
        lineItems.sort((a, b) => a.x - b.x);

        // Find the modal Y within this line group — that is the true baseline.
        // Items whose Y deviates significantly from it are sub/superscripts.
        const yBuckets = {};
        lineItems.forEach(item => {
          const key = Math.round(item.y);
          yBuckets[key] = (yBuckets[key] || 0) + 1;
        });
        const baselineY = parseInt(
          Object.entries(yBuckets).sort((a, b) => b[1] - a[1])[0][0]
        );

        let lineText = '';
        let currentX = -1;
        let lineMaxFontSize = 0;

        lineItems.forEach(item => {
          if (item.fontSize > lineMaxFontSize) lineMaxFontSize = item.fontSize;
          if (currentX !== -1 && item.x - currentX > 4) lineText += ' ';

          // In PDF coords: lower Y = below baseline (subscript), higher Y = above (superscript)
          const yDiff = item.y - baselineY;
          const isSmall = item.fontSize > 0 && item.fontSize < bodyFontSize * 0.9;

          if (isSmall && yDiff < -1.5) {
            lineText += toSubscriptStr(item.text);
          } else if (isSmall && yDiff > 1.5) {
            lineText += toSuperscriptStr(item.text);
          } else {
            lineText += item.text;
          }
          currentX = item.x + item.width;
        });

        const trimmedLine = lineText.trim();
        if (!trimmedLine) continue;

        const lineGap = prevLineY !== null ? Math.abs(prevLineY - lineY) : 0;
        lineData.push({ text: trimmedLine, items: lineItems, maxFontSize: lineMaxFontSize, lineGap });
        prevLineY = lineY;
      }

      // Pass 4: render lineData to Markdown, detecting table regions inline.
      let pageText = '';
      let k = 0;
      while (k < lineData.length) {
        const line = lineData[k];

        // Table detection: body-sized lines where items have large column gaps.
        if (line.maxFontSize <= bodyFontSize + 1.5) {
          const firstCells = extractTableCells(line.items);
          if (firstCells && firstCells.length >= 2) {
            const colCount = firstCells.length;
            const tableRows = [firstCells];
            let m = k + 1;
            while (m < lineData.length) {
              if (lineData[m].maxFontSize > bodyFontSize + 1.5) break;
              const cells = extractTableCells(lineData[m].items);
              if (!cells || Math.abs(cells.length - colCount) > 1) break;
              while (cells.length < colCount) cells.push('');
              tableRows.push(cells.slice(0, colCount));
              m++;
            }
            if (tableRows.length >= 2) {
              pageText += '\n\n' + buildMarkdownTable(tableRows) + '\n\n';
              k = m;
              continue;
            }
          }
        }

        // Normal line: heading detection by font size, paragraph breaks by gap.
        const { text, maxFontSize, lineGap } = line;
        let formattedLine;
        if (maxFontSize >= bodyFontSize + 6) {
          formattedLine = `\n\n# ${text}\n\n`;
        } else if (maxFontSize >= bodyFontSize + 3) {
          formattedLine = `\n\n## ${text}\n\n`;
        } else if (maxFontSize >= bodyFontSize + 1.5) {
          formattedLine = `\n\n### ${text}\n\n`;
        } else {
          formattedLine = (lineGap > maxFontSize * 2 && k > 0) ? `\n\n${text}` : `\n${text}`;
        }
        pageText += formattedLine;
        k++;
      }

      // Heading-only page: the content was a diagram or image — add a marker so the reader
      // knows something was there rather than seeing an orphaned heading.
      const _pLines = pageText.split('\n').filter(l => l.trim().length > 0);
      const _allHeadings = _pLines.length > 0 && _pLines.length <= 2
        && _pLines.every(l => /^#{1,6} /.test(l.trim()));
      if (_allHeadings) {
        pageText += '\n\n*[Diagram or image — visual content not extracted]*';
      }

      if (pageText.trim()) pageResults.push({ pageNum, text: pageText });
    }

    // Deduplicate build-animation slides in slide-based PDFs.
    // PowerPoint "reveal" exports produce consecutive pages where each page adds one bullet
    // to the previous. If ≥85% of a page's content lines appear in the very next page,
    // that page is a subset — skip it and keep only the fully-revealed slide.
    const dedupedPages = [];
    for (let i = 0; i < pageResults.length; i++) {
      if (i < pageResults.length - 1) {
        const currLines = pageResults[i].text.split('\n').filter(l => l.trim().length > 3);
        if (currLines.length >= 2) {
          const nextText = pageResults[i + 1].text;
          const matchCount = currLines.filter(l => nextText.includes(l.trim())).length;
          if (matchCount / currLines.length >= 0.85) continue;
        }
      }
      dedupedPages.push(pageResults[i]);
    }

    for (const page of dedupedPages) {
      markdown += `\n\n--- [Page ${page.pageNum}] ---\n\n` + page.text;
    }

    return markdown.trim();
  }

  /**
   * 2. Word (.docx) to Markdown
   */
  async function convertDOCXToMarkdown(arrayBuffer) {
    if (typeof mammoth === 'undefined') {
      throw new Error('Mammoth.js library is not loaded.');
    }

    const result = await mammoth.convertToHtml({ arrayBuffer: arrayBuffer });
    const html = result.value; // Extracted HTML
    return htmlToMarkdown(html).trim();
  }

  /**
   * 3. Excel/CSV to Markdown Table
   */
  async function convertExcelToMarkdown(arrayBuffer) {
    if (typeof XLSX === 'undefined') {
      throw new Error('SheetJS (XLSX) library is not loaded.');
    }

    const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array', cellDates: true });
    let markdown = '';

    // Format a raw cell value: converts Date objects to ISO strings, everything else to plain text.
    function formatCell(val) {
      if (val instanceof Date) {
        if (isNaN(val.getTime())) return '';
        const y = val.getFullYear();
        const mo = String(val.getMonth() + 1).padStart(2, '0');
        const d = String(val.getDate()).padStart(2, '0');
        const hasTime = val.getHours() || val.getMinutes() || val.getSeconds();
        if (hasTime) {
          const h = String(val.getHours()).padStart(2, '0');
          const mi = String(val.getMinutes()).padStart(2, '0');
          return `${y}-${mo}-${d} ${h}:${mi}`;
        }
        return `${y}-${mo}-${d}`;
      }
      return val !== undefined && val !== null ? String(val).trim() : '';
    }

    workbook.SheetNames.forEach(sheetName => {
      const sheet = workbook.Sheets[sheetName];
      // Convert to 2D array representation
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });

      if (rows.length === 0) return;

      markdown += `\n\n### Sheet: ${sheetName}\n\n`;

      // Filter out completely empty rows and columns to save tokens
      const activeCols = [];
      const numCols = rows[0].length;

      // Find which columns actually have data
      for (let col = 0; col < numCols; col++) {
        let hasData = false;
        for (let row = 0; row < rows.length; row++) {
          if (rows[row][col] !== undefined && String(rows[row][col]).trim() !== "") {
            hasData = true;
            break;
          }
        }
        if (hasData) {
          activeCols.push(col);
        }
      }

      if (activeCols.length === 0) {
        markdown += '*[Sheet is empty]*\n';
        return;
      }

      // Generate table headers
      const headers = rows[0];
      let headerStr = '|';
      let separatorStr = '|';

      activeCols.forEach(colIdx => {
        const val = formatCell(headers[colIdx]);
        headerStr += ` ${val.replace(/\|/g, '\\|')} |`;
        separatorStr += ' --- |';
      });

      markdown += headerStr + '\n' + separatorStr + '\n';

      // Generate table body
      for (let r = 1; r < rows.length; r++) {
        const row = rows[r];
        // Check if row is completely blank
        const isRowBlank = activeCols.every(colIdx => row[colIdx] === undefined || String(row[colIdx]).trim() === "");
        if (isRowBlank) continue;

        let rowStr = '|';
        activeCols.forEach(colIdx => {
          const val = formatCell(row[colIdx]);
          rowStr += ` ${val.replace(/\|/g, '\\|')} |`;
        });
        markdown += rowStr + '\n';
      }
    });

    return markdown.trim();
  }

  /**
   * 4. Markdown pass-through (optimization only — no format conversion)
   */
  function convertMDToMarkdown(arrayBuffer) {
    return Promise.resolve(arrayBufferToString(arrayBuffer));
  }

  /**
   * Token and Layout Optimization Engine
   */
  function optimizeMarkdown(markdown, options = {}) {
    const config = Object.assign({
      trimMultipleNewlines: true,
      compactTables: true,
      stripComments: false,
      stripInlineStyle: true
    }, options);

    let result = markdown;

    // Remove inline CSS or styling elements
    if (config.stripInlineStyle) {
      result = result.replace(/style="[^"]*"/gi, '');
      result = result.replace(/class="[^"]*"/gi, '');
    }

    // Collapse multiple consecutive newlines down to a max of two
    if (config.trimMultipleNewlines) {
      result = result.replace(/\n{3,}/g, '\n\n');
    }

    // Trim trailing whitespace from all lines
    result = result.split('\n').map(line => line.trimEnd()).join('\n');

    // Clean up empty Markdown lists or headings
    result = result.replace(/\n#+\s*\n/g, '\n');
    result = result.replace(/\n\*\s*\n/g, '\n');

    // Merge split headings: a short heading immediately followed by another at the same
    // level with no content between them is almost always one heading split across two
    // PDF text runs (e.g. "Q2" and "Introduction to Linear Regression" both as ##).
    result = result.replace(
      /^(#{1,6}) ([^\n]{1,60})\n+(#{1,6}) ([^\n]+)/gm,
      (match, marks1, text1, marks2, text2) => {
        if (marks1 === marks2 && !/[.?!:]$/.test(text1.trim())) {
          return `${marks1} ${text1.trim()} ${text2.trim()}`;
        }
        return match;
      }
    );

    return result.trim();
  }

  /**
   * Token Estimator
   */
  function estimateTokens(text) {
    if (!text) return 0;
    // Standard LLM rule of thumb: ~4 characters per token
    // Using 3.9 yields extremely accurate approximation for standard Markdown/CSV text
    return Math.ceil(text.length / 3.9);
  }

  /**
   * Human Readable File Size
   */
  function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }

  // Exported Public API
  return {
    convertPDF: convertPDFToMarkdown,
    convertDOCX: convertDOCXToMarkdown,
    convertExcel: convertExcelToMarkdown,
    convertMD: convertMDToMarkdown,
    optimize: optimizeMarkdown,
    estimateTokens: estimateTokens,
    formatBytes: formatBytes,
    arrayBufferToString: arrayBufferToString
  };
})();

// Assign to window for content script inclusion
if (typeof window !== 'undefined') {
  window.TokenOptimizerConverter = TokenOptimizerConverter;
}
