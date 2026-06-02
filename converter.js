/**
 * AI Token Optimizer - Conversion & Optimization Engine
 * Runs locally in browser (offline-capable, 100% private)
 */

const TokenOptimizerConverter = (function () {
  // Detect whether we're running inside the extension popup vs. injected on a webpage
  const _isContentScript = typeof window !== 'undefined'
    && window.location.protocol !== 'chrome-extension:'
    && typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL;

  // Initialize PDF.js worker configuration
  if (typeof pdfjsLib !== 'undefined') {
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL) {
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
    } else {
      // Fallback for running popup outside Chrome extension (standalone web sandbox)
      pdfjsLib.GlobalWorkerOptions.workerSrc = '../lib/pdf.worker.js';
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

    function processNode(node, listType = null, listIndex = 0, inTableCell = false, listDepth = 0) {
      if (node.nodeType === Node.TEXT_NODE) {
        const parentTag = node.parentNode ? node.parentNode.tagName.toLowerCase() : '';
        if (!node.textContent.trim() && ['table', 'thead', 'tbody', 'tfoot', 'tr', 'ul', 'ol'].includes(parentTag)) {
          return '';
        }
        return node.textContent;
      }

      if (node.nodeType !== Node.ELEMENT_NODE) {
        return '';
      }

      const tagName = node.tagName.toLowerCase();
      const isListContainer = ['ul', 'ol'].includes(tagName);
      const nextListDepth = isListContainer ? listDepth + 1 : listDepth;

      // Process children first
      const childrenContent = Array.from(node.childNodes)
        .map((child, idx) => processNode(
          child,
          tagName === 'ul' ? 'ul' : tagName === 'ol' ? 'ol' : listType,
          idx + 1,
          inTableCell || tagName === 'td' || tagName === 'th',
          nextListDepth
        ))
        .join('');

      switch (tagName) {
        case 'h1':
          return inTableCell ? `**${childrenContent.trim()}** ` : `\n\n# ${childrenContent.trim()}\n\n`;
        case 'h2':
          return inTableCell ? `**${childrenContent.trim()}** ` : `\n\n## ${childrenContent.trim()}\n\n`;
        case 'h3':
          return inTableCell ? `**${childrenContent.trim()}** ` : `\n\n### ${childrenContent.trim()}\n\n`;
        case 'h4':
          return inTableCell ? `**${childrenContent.trim()}** ` : `\n\n#### ${childrenContent.trim()}\n\n`;
        case 'h5':
          return inTableCell ? `**${childrenContent.trim()}** ` : `\n\n##### ${childrenContent.trim()}\n\n`;
        case 'h6':
          return inTableCell ? `**${childrenContent.trim()}** ` : `\n\n###### ${childrenContent.trim()}\n\n`;
        case 'p':
          return inTableCell ? `${childrenContent.trim()} ` : `\n\n${childrenContent.trim()}\n\n`;
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
        case 'li': {
          const indent = '  '.repeat(Math.max(0, listDepth - 1));
          if (listType === 'ol') {
            let liIndex = 1;
            let prev = node.previousSibling;
            while (prev) {
              if (prev.nodeType === Node.ELEMENT_NODE && prev.tagName.toLowerCase() === 'li') {
                liIndex++;
              }
              prev = prev.previousSibling;
            }
            return inTableCell ? `<br>${indent}${liIndex}. ${childrenContent.trim()}` : `\n${indent}${liIndex}. ${childrenContent.trim()}`;
          }
          return inTableCell ? `<br>${indent}* ${childrenContent.trim()}` : `\n${indent}* ${childrenContent.trim()}`;
        }
        case 'ul':
        case 'ol':
          return inTableCell ? childrenContent : `\n${childrenContent}\n`;
        case 'br':
          return inTableCell ? '<br>' : '\n';
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
    const minGap = Math.max(14, lineWidth * 0.05);

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

  // ═══════════════════════════════════════════════════════════════════
  //  PDF Quality Helpers — Column Detection, Header/Footer, Footnotes
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Detect two-column layout by analyzing the X-coordinate density histogram.
   * Returns { isMultiColumn, columns: [items[]], splitX }
   */
  function detectColumns(items, pageWidth) {
    if (!items || items.length < 10 || !pageWidth) {
      return { isMultiColumn: false, columns: [items], splitX: 0 };
    }

    // Find body font size for filtering
    const fontCounts = {};
    items.forEach(i => {
      if (i.text.trim()) fontCounts[i.fontSize] = (fontCounts[i.fontSize] || 0) + 1;
    });
    let bodyFS = 10, maxCnt = 0;
    for (const s in fontCounts) {
      if (fontCounts[s] > maxCnt) { maxCnt = fontCounts[s]; bodyFS = parseInt(s); }
    }

    // Only consider body-sized items for column analysis
    const bodyItems = items.filter(i => i.text.trim() && Math.abs(i.fontSize - bodyFS) <= 2);
    if (bodyItems.length < 8) return { isMultiColumn: false, columns: [items], splitX: 0 };

    // Build X-coordinate histogram (50 bins across page width)
    const binCount = 50;
    const binWidth = pageWidth / binCount;
    const histogram = new Array(binCount).fill(0);
    bodyItems.forEach(item => {
      const bin = Math.min(binCount - 1, Math.floor(item.x / binWidth));
      histogram[bin]++;
    });

    const peakDensity = Math.max(...histogram);
    if (peakDensity < 3) return { isMultiColumn: false, columns: [items], splitX: 0 };

    // Look for a density valley in the center zone (30%–70% of page width)
    const centerStart = Math.floor(binCount * 0.30);
    const centerEnd   = Math.ceil(binCount * 0.70);
    const valleyThreshold = peakDensity * 0.10;

    let bestValley = -1, bestValleyScore = Infinity;
    for (let i = centerStart; i <= centerEnd; i++) {
      const lo = Math.max(0, i - 2), hi = Math.min(binCount - 1, i + 2);
      let sum = 0, cnt = 0;
      for (let j = lo; j <= hi; j++) { sum += histogram[j]; cnt++; }
      const avg = sum / cnt;
      if (avg <= valleyThreshold && avg < bestValleyScore) {
        bestValleyScore = avg;
        bestValley = i;
      }
    }

    if (bestValley === -1) return { isMultiColumn: false, columns: [items], splitX: 0 };

    const splitX = (bestValley + 0.5) * binWidth;
    const leftItems  = items.filter(i => i.x + i.width / 2 < splitX);
    const rightItems = items.filter(i => i.x + i.width / 2 >= splitX);

    // Validate: both columns must have meaningful content
    const leftText  = leftItems.filter(i => i.text.trim());
    const rightText = rightItems.filter(i => i.text.trim());
    if (leftText.length < 5 || rightText.length < 5) {
      return { isMultiColumn: false, columns: [items], splitX: 0 };
    }

    // Validate: columns must not overlap horizontally
    const leftMaxX  = Math.max(...leftText.map(i => i.x + i.width));
    const rightMinX = Math.min(...rightText.map(i => i.x));
    if (rightMinX - leftMaxX < pageWidth * 0.03) {
      return { isMultiColumn: false, columns: [items], splitX: 0 };
    }

    return { isMultiColumn: true, columns: [leftItems, rightItems], splitX };
  }

  /**
   * Normalize a header/footer line for cross-page comparison.
   * Strips page numbers, dates, and short identifiers.
   */
  function normalizeHeaderFooter(line) {
    if (!line || line.length > 200) return null;
    let norm = line
      .replace(/\b(page|pg\.?)\s*\d+\s*(of\s*\d+)?/gi, '##NUM##')
      .replace(/^\d{1,4}$/, '##NUM##')
      .replace(/^[-–—]\s*\d+\s*[-–—]$/, '##NUM##')
      .replace(/\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}/g, '##DATE##')
      .trim();
    return norm.length > 0 ? norm : null;
  }

  /**
   * Detect and strip repeating headers/footers across pages.
   * A line appearing on ≥50% of pages (normalized) is considered a header/footer.
   */
  function stripHeadersFooters(pageResults) {
    if (pageResults.length < 3) return pageResults;

    const candidates = { top: {}, bottom: {} };

    pageResults.forEach(page => {
      const lines = page.text.split('\n').filter(l => l.trim().length > 0);
      if (lines.length < 3) return;

      // Top 2 non-empty lines
      for (let i = 0; i < Math.min(2, lines.length); i++) {
        const norm = normalizeHeaderFooter(lines[i].trim());
        if (norm) candidates.top[norm] = (candidates.top[norm] || 0) + 1;
      }
      // Bottom 2 non-empty lines
      for (let i = lines.length - 1; i >= Math.max(0, lines.length - 2); i--) {
        const norm = normalizeHeaderFooter(lines[i].trim());
        if (norm) candidates.bottom[norm] = (candidates.bottom[norm] || 0) + 1;
      }
    });

    const threshold = Math.max(2, Math.floor(pageResults.length * 0.5));
    const headerPatterns = new Set();
    const footerPatterns = new Set();

    for (const [p, c] of Object.entries(candidates.top))    { if (c >= threshold) headerPatterns.add(p); }
    for (const [p, c] of Object.entries(candidates.bottom)) { if (c >= threshold) footerPatterns.add(p); }

    if (headerPatterns.size === 0 && footerPatterns.size === 0) return pageResults;

    return pageResults.map(page => {
      let lines = page.text.split('\n');

      // Strip matching top lines
      let stripped = 0;
      while (stripped < 3 && lines.length > 0) {
        const idx = lines.findIndex(l => l.trim().length > 0);
        if (idx === -1) break;
        const norm = normalizeHeaderFooter(lines[idx].trim());
        if (norm && headerPatterns.has(norm)) { lines.splice(idx, 1); stripped++; }
        else break;
      }

      // Strip matching bottom lines
      stripped = 0;
      while (stripped < 3 && lines.length > 0) {
        let idx = -1;
        for (let i = lines.length - 1; i >= 0; i--) {
          if (lines[i].trim().length > 0) { idx = i; break; }
        }
        if (idx === -1) break;
        const norm = normalizeHeaderFooter(lines[idx].trim());
        if (norm && footerPatterns.has(norm)) { lines.splice(idx, 1); stripped++; }
        else break;
      }

      return { pageNum: page.pageNum, text: lines.join('\n') };
    });
  }

  /**
   * Separate footnotes from body text in structured line data.
   * Footnotes = small-font lines at the bottom of the page, often starting with
   * a superscript number or symbol. Returns { bodyLines, footnoteLines }.
   */
  function extractFootnotes(lineData, bodyFontSize) {
    if (lineData.length < 3) return { bodyLines: lineData, footnoteLines: [] };

    const footnoteFontThreshold = bodyFontSize * 0.85;
    let footnoteIndex = -1;

    // Scan from bottom up to find the first line that is NOT small font
    // and is NOT a separator.
    let smallFontContiguousCount = 0;
    let hasMarkerOrSeparator = false;

    for (let i = lineData.length - 1; i >= 0; i--) {
      const line = lineData[i];
      const isSmallFont = line.maxFontSize > 0 && line.maxFontSize <= footnoteFontThreshold;
      const isSeparator = /^[_\-─━]{3,}$/.test(line.text.trim());
      const startsWithMarker = /^[\d\*†‡§¹²³⁴⁵⁶⁷⁸⁹⁰ᵃᵇᶜᵈᵉ]/.test(line.text.trim());

      if (isSeparator) {
        hasMarkerOrSeparator = true;
        // Continue scanning past the separator
        continue;
      }

      if (isSmallFont) {
        smallFontContiguousCount++;
        if (startsWithMarker) {
          hasMarkerOrSeparator = true;
        }
      } else {
        // We hit a normal body font line.
        // The footnote boundary is at index i + 1.
        footnoteIndex = i + 1;
        break;
      }
    }

    // If we scanned all the way to the top and all lines are small font,
    // then there's no footnote (it's just a small font page).
    if (footnoteIndex <= 0 || smallFontContiguousCount === 0) {
      return { bodyLines: lineData, footnoteLines: [] };
    }

    // If we have contiguous small font lines at the bottom, and we found
    // a footnote marker or a separator, extract them.
    if (hasMarkerOrSeparator) {
      const bodyLines = lineData.slice(0, footnoteIndex).filter(l => !/^[_\-─━]{3,}$/.test(l.text.trim()));
      const footnoteLines = lineData.slice(footnoteIndex).filter(l => !/^[_\-─━]{3,}$/.test(l.text.trim()));
      return { bodyLines, footnoteLines };
    }

    return { bodyLines: lineData, footnoteLines: [] };
  }

  /**
   * 1. PDF to Markdown
   */
  async function convertPDFToMarkdown(arrayBuffer, onProgress = null, options = {}) {
    if (typeof pdfjsLib === 'undefined') {
      throw new Error('PDF.js library is not loaded.');
    }

    let ocrUsed = false;

    try {
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
      const allFootnotes = [];
      const numPages = pdf.numPages;

      for (let pageNum = 1; pageNum <= numPages; pageNum++) {
        if (onProgress) {
          onProgress(pageNum, numPages);
        }

        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();

        // Sort items initially top-to-bottom (Y coordinate desc), then left-to-right (X coordinate asc)
        // Filter out empty items early to improve layout parsing efficiency and accuracy
        const items = textContent.items.map(item => ({
          text: item.str,
          x: item.transform ? item.transform[4] : 0,
          y: item.transform ? item.transform[5] : 0,
          fontSize: item.transform ? Math.round(Math.sqrt(item.transform[0] * item.transform[0] + item.transform[1] * item.transform[1])) : 10,
          height: item.height || 0,
          width: item.width || 0
        })).filter(item => item.text && item.text.trim().length > 0);

        // Check if page is scanned/image-only
        const isScanned = items.length === 0 || (items.length < 5 && options.ocrEnabled && typeof ocrPage === 'function');
        if (isScanned) {
          if (options.ocrEnabled && typeof ocrPage === 'function') {
            try {
              if (onProgress) onProgress(pageNum, numPages);
              ocrUsed = true;
              const ocrText = await ocrPage(page);
              if (ocrText && ocrText.trim()) {
                pageResults.push({ pageNum, text: '\n\n*[OCR extracted]*\n\n' + ocrText.trim() });
              }
            } catch (_ocrErr) {
              console.warn('[ClaudeTokenOptimizer] OCR failed on page ' + pageNum, _ocrErr);
            }
          }
          continue;
        }

        const viewport = page.getViewport({ scale: 1 });
        const colResult = detectColumns(items, viewport.width);

        // Group items into lines based on Y tolerance
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

        // Sort lines top-to-bottom
        const sortedY = Array.from(linesMap.keys()).sort((a, b) => b - a);

        // Linearize columns if page is multi-column, otherwise map directly
        let processedLines = [];
        if (colResult.isMultiColumn) {
          const splitX = colResult.splitX;
          const leftSection = [];
          const rightSection = [];

          const flushColumns = () => {
            if (leftSection.length > 0 || rightSection.length > 0) {
              leftSection.forEach(l => processedLines.push(l));
              rightSection.forEach(l => processedLines.push(l));
              leftSection.length = 0;
              rightSection.length = 0;
            }
          };

          for (let j = 0; j < sortedY.length; j++) {
            const lineY = sortedY[j];
            const lineItems = linesMap.get(lineY);
            lineItems.sort((a, b) => a.x - b.x);

            // Check if the line is single column (i.e. spans/overlaps the central split zone)
            const leftItems = lineItems.filter(item => item.x + item.width / 2 < splitX);
            const rightItems = lineItems.filter(item => item.x + item.width / 2 >= splitX);

            let isSingleColumn = false;
            if (leftItems.length > 0 && rightItems.length > 0) {
              const maxLeftX = Math.max(...leftItems.map(i => i.x + i.width));
              const minRightX = Math.min(...rightItems.map(i => i.x));
              const gap = minRightX - maxLeftX;
              const minGap = Math.max(15, splitX * 0.05);
              if (gap < minGap) {
                isSingleColumn = true;
              }
            } else {
              isSingleColumn = false;
            }

            if (isSingleColumn) {
              flushColumns();
              processedLines.push({
                y: lineY,
                items: lineItems
              });
            } else {
              const leftItems = lineItems.filter(item => item.x + item.width / 2 < splitX);
              const rightItems = lineItems.filter(item => item.x + item.width / 2 >= splitX);

              if (leftItems.length > 0) {
                leftSection.push({
                  y: lineY,
                  items: leftItems
                });
              }
              if (rightItems.length > 0) {
                rightSection.push({
                  y: lineY,
                  items: rightItems
                });
              }
            }
          }
          flushColumns();
        } else {
          processedLines = sortedY.map(lineY => ({
            y: lineY,
            items: linesMap.get(lineY)
          }));
        }

        // Determine modal/body font size for page elements
        let bodyFontSize = 10;
        const fontSizeCounts = {};
        items.forEach(item => {
          fontSizeCounts[item.fontSize] = (fontSizeCounts[item.fontSize] || 0) + 1;
        });
        let maxCount = 0;
        for (const size in fontSizeCounts) {
          if (fontSizeCounts[size] > maxCount) {
            maxCount = fontSizeCounts[size];
            bodyFontSize = parseInt(size);
          }
        }

        // Build structured line data with sub/superscript detection
        const lineData = [];
        let prevLineY = null;

        for (let j = 0; j < processedLines.length; j++) {
          const { y: lineY, items: lineItems } = processedLines[j];
          lineItems.sort((a, b) => a.x - b.x);

          if (lineItems.length === 0) continue;

          // Find the baseline Y (modal Y) within this line group
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

        // Footnote extraction
        const fnResult = extractFootnotes(lineData, bodyFontSize);
        const renderLines = fnResult.bodyLines;
        allFootnotes.push(...fnResult.footnoteLines.map(fn => fn.text));

        // Render renderLines to Markdown with inline table detection
        let pageText = '';
        let k = 0;
        while (k < renderLines.length) {
          const line = renderLines[k];

          // Table detection: body-sized lines with large column gaps
          if (line.maxFontSize <= bodyFontSize + 1.5) {
            const firstCells = extractTableCells(line.items);
            if (firstCells && firstCells.length >= 2) {
              const colCount = firstCells.length;
              const tableRows = [firstCells];
              let m = k + 1;
              while (m < renderLines.length) {
                if (renderLines[m].maxFontSize > bodyFontSize + 1.5) break;
                const cells = extractTableCells(renderLines[m].items);
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

          // Normal line formatting
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

        // Fallback for visual/empty pages (e.g. diagrams with only a title)
        const _pLines = pageText.split('\n').filter(l => l.trim().length > 0);
        const _allHeadings = _pLines.length > 0 && _pLines.length <= 2
          && _pLines.every(l => /^#{1,6} /.test(l.trim()));
        if (_allHeadings) {
          pageText += '\n\n*[Diagram or image — visual content not extracted]*';
        }

        if (pageText.trim()) pageResults.push({ pageNum, text: pageText });
      }

      // Header/footer stripping
      const cleanedPages = stripHeadersFooters(pageResults);

      // Slide duplicate detection
      const dedupedPages = [];
      for (let i = 0; i < cleanedPages.length; i++) {
        if (i < cleanedPages.length - 1) {
          const currLines = cleanedPages[i].text.split('\n').filter(l => l.trim().length > 3);
          if (currLines.length >= 2) {
            const nextText = cleanedPages[i + 1].text;
            const matchCount = currLines.filter(l => nextText.includes(l.trim())).length;
            if (matchCount / currLines.length >= 0.85) continue;
          }
        }
        dedupedPages.push(cleanedPages[i]);
      }

      for (const page of dedupedPages) {
        markdown += `\n\n--- [Page ${page.pageNum}] ---\n\n` + page.text;
      }

      // Footnotes appendix
      if (allFootnotes.length > 0) {
        markdown += '\n\n---\n\n## Footnotes\n\n';
        allFootnotes.forEach((fn, i) => {
          markdown += `${i + 1}. ${fn}\n`;
        });
      }

      return markdown.trim();
    } finally {
      if (options.ocrEnabled || ocrUsed) {
        try { await terminateTesseractWorker(); } catch (_) { /* ignore */ }
      }
    }
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
      if (!sheet || !sheet['!ref']) return;

      const range = XLSX.utils.decode_range(sheet['!ref']);
      const startRow = range.s.r;
      const endRow = range.e.r;
      const startCol = range.s.c;
      const endCol = range.e.c;
      
      const rows = [];
      for (let R = startRow; R <= endRow; R++) {
        const row = [];
        for (let C = startCol; C <= endCol; C++) {
          const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
          const cell = sheet[cellAddress];
          let val = '';
          if (cell) {
            // Prefer formatted text .w for high-fidelity presentation
            if (cell.w !== undefined) {
              val = String(cell.w).trim();
            } else if (cell.v !== undefined && cell.v !== null) {
              if (cell.v instanceof Date) {
                val = formatCell(cell.v);
              } else {
                val = String(cell.v).trim();
              }
            }
          }
          row.push(val);
        }
        rows.push(row);
      }

      if (rows.length === 0) return;

      // Filter out completely empty rows and columns to save tokens
      const activeCols = [];
      const numRows = rows.length;
      const numCols = rows[0] ? rows[0].length : 0;

      // Find which columns actually have data
      for (let c = 0; c < numCols; c++) {
        let hasData = false;
        for (let r = 0; r < numRows; r++) {
          if (rows[r][c] !== undefined && rows[r][c] !== '') {
            hasData = true;
            break;
          }
        }
        if (hasData) {
          activeCols.push(c);
        }
      }

      // Find which rows actually have data inside the active columns
      const activeRows = [];
      for (let r = 0; r < numRows; r++) {
        let hasData = false;
        for (const c of activeCols) {
          if (rows[r][c] !== undefined && rows[r][c] !== '') {
            hasData = true;
            break;
          }
        }
        if (hasData) {
          activeRows.push(r);
        }
      }

      if (activeCols.length === 0 || activeRows.length === 0) {
        markdown += `\n\n### Sheet: ${sheetName}\n\n*[Sheet is empty]*\n`;
        return;
      }

      markdown += `\n\n### Sheet: ${sheetName}\n\n`;

      // Generate table headers (the first non-empty/active row)
      const firstRowIdx = activeRows[0];
      let headerStr = '|';
      let separatorStr = '|';

      activeCols.forEach(c => {
        const val = rows[firstRowIdx][c];
        headerStr += ` ${val.replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>')} |`;
        separatorStr += ' --- |';
      });

      markdown += headerStr + '\n' + separatorStr + '\n';

      // Generate table body
      for (let i = 1; i < activeRows.length; i++) {
        const r = activeRows[i];
        let rowStr = '|';
        activeCols.forEach(c => {
          const val = rows[r][c];
          rowStr += ` ${val.replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>')} |`;
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
   * 5. PowerPoint (.pptx) to Markdown
   * PPTX files are ZIP archives containing XML. Uses JSZip to decompress
   * and DOMParser to extract slide titles, bullets, tables, and speaker notes.
   */
  async function convertPPTXToMarkdown(arrayBuffer, onProgress = null) {
    if (typeof JSZip === 'undefined') {
      throw new Error('JSZip library is not loaded. Cannot parse PPTX files.');
    }

    const zip = await JSZip.loadAsync(arrayBuffer);
    const parser = new DOMParser();
    let markdown = '';

    // Helper: extract standard element visual coordinates in EMUs (English Metric Units)
    function getElementCoords(el) {
      let x = 0, y = 0;
      // Try p:spPr -> a:xfrm (used in p:sp, p:cxnSp, p:pic)
      const spPr = el.getElementsByTagName('p:spPr')[0];
      let xfrm = spPr ? spPr.getElementsByTagName('a:xfrm')[0] : null;
      
      // If not found, try direct p:xfrm (used in p:graphicFrame)
      if (!xfrm) {
        xfrm = el.getElementsByTagName('p:xfrm')[0];
      }
      
      if (xfrm) {
        const off = xfrm.getElementsByTagName('a:off')[0];
        if (off) {
          x = parseInt(off.getAttribute('x') || 0);
          y = parseInt(off.getAttribute('y') || 0);
        }
      }
      return { x, y };
    }

    // Helper: extract speaker notes precisely from notes slide to avoid token leaks
    function extractSpeakerNotes(notesXmlDoc) {
      const shapes = notesXmlDoc.getElementsByTagName('p:sp');
      for (const shape of shapes) {
        const phElements = shape.getElementsByTagName('p:ph');
        let isNotesPlaceholder = false;
        for (const ph of phElements) {
          if (ph.getAttribute('type') === 'notes') {
            isNotesPlaceholder = true;
            break;
          }
        }
        if (isNotesPlaceholder) {
          const paragraphs = shape.getElementsByTagName('a:p');
          const notesParagraphs = [];
          for (const para of paragraphs) {
            const runs = para.getElementsByTagName('a:t');
            let paraText = '';
            for (const run of runs) paraText += run.textContent;
            paraText = paraText.trim();
            if (paraText) notesParagraphs.push(paraText);
          }
          return notesParagraphs.join('\n');
        }
      }
      
      // Fallback: concatenate all text runs if no specific placeholder is identified
      const textNodes = notesXmlDoc.getElementsByTagName('a:t');
      let notesText = '';
      for (const node of textNodes) notesText += node.textContent;
      return notesText.trim();
    }

    // Determine the user's defined presentation slide order from ppt/presentation.xml
    let slideFiles = [];
    try {
      const presFile = zip.files['ppt/presentation.xml'];
      const presRelsFile = zip.files['ppt/_rels/presentation.xml.rels'];
      if (presFile && presRelsFile) {
        const presXml = await presFile.async('string');
        const presDoc = parser.parseFromString(presXml, 'application/xml');
        const sldIdLst = presDoc.getElementsByTagName('p:sldId');
        
        const relsXml = await presRelsFile.async('string');
        const relsDoc = parser.parseFromString(relsXml, 'application/xml');
        const rels = relsDoc.getElementsByTagName('Relationship');
        
        const relMap = {};
        for (const rel of rels) {
          const id = rel.getAttribute('Id');
          const target = rel.getAttribute('Target');
          if (id && target) {
            relMap[id] = target.startsWith('ppt/') ? target : `ppt/${target}`;
          }
        }
        
        for (const sldId of sldIdLst) {
          let rId = sldId.getAttribute('r:id') || sldId.getAttribute('rid');
          if (!rId) {
            for (let attr of sldId.attributes) {
              if (attr.name.endsWith(':id') || attr.localName === 'id') {
                rId = attr.value;
                break;
              }
            }
          }
          if (rId && relMap[rId]) {
            slideFiles.push(relMap[rId]);
          }
        }
      }
    } catch (err) {
      console.warn('[TokenOptimizer] Failed to extract presentation-ordered slides, falling back to numeric sorting:', err);
    }
    
    // Numeric sorting fallback if presentation order parsing failed
    if (slideFiles.length === 0) {
      slideFiles = Object.keys(zip.files)
        .filter(name => /^ppt\/slides\/slide\d+\.xml$/.test(name))
        .sort((a, b) => {
          const numA = parseInt(a.match(/slide(\d+)/)[1]);
          const numB = parseInt(b.match(/slide(\d+)/)[1]);
          return numA - numB;
        });
    }

    const totalSlides = slideFiles.length;

    for (let i = 0; i < totalSlides; i++) {
      const slideFile = slideFiles[i];
      const match = slideFile.match(/slide(\d+)/);
      const slideNum = match ? parseInt(match[1]) : (i + 1);

      if (onProgress) onProgress(i + 1, totalSlides);

      try {
        const xmlString = await zip.files[slideFile].async('string');
        const xmlDoc = parser.parseFromString(xmlString, 'application/xml');

        const elements = [];

        // 1. Extract visual shapes (p:sp)
        const shapes = xmlDoc.getElementsByTagName('p:sp');
        for (const shape of shapes) {
          elements.push({ type: 'shape', el: shape, coords: getElementCoords(shape) });
        }

        // 2. Extract visual connector shapes (p:cxnSp)
        const cxnShapes = xmlDoc.getElementsByTagName('p:cxnSp');
        for (const shape of cxnShapes) {
          elements.push({ type: 'shape', el: shape, coords: getElementCoords(shape) });
        }

        // 3. Extract tables inside graphic frames (p:graphicFrame -> a:tbl)
        const frames = xmlDoc.getElementsByTagName('p:graphicFrame');
        for (const frame of frames) {
          const tbl = frame.getElementsByTagName('a:tbl')[0];
          if (tbl) {
            elements.push({ type: 'table', el: frame, tableEl: tbl, coords: getElementCoords(frame) });
          }
        }

        // Sort elements visually: top-to-bottom, then left-to-right (if vertical coordinate is very close)
        elements.sort((a, b) => {
          const yDiff = a.coords.y - b.coords.y;
          if (Math.abs(yDiff) < 150000) { // ~0.16 inches threshold in EMUs
            return a.coords.x - b.coords.x;
          }
          return yDiff;
        });

        let slideTitle = '';
        const bodyMarkdownParts = [];
        let titleElementIndex = -1;

        // A. Title placeholder matching
        for (let j = 0; j < elements.length; j++) {
          const item = elements[j];
          if (item.type === 'shape') {
            const phElements = item.el.getElementsByTagName('p:ph');
            let isTitle = false;
            for (const ph of phElements) {
              const phType = ph.getAttribute('type');
              if (phType === 'title' || phType === 'ctrTitle') {
                isTitle = true;
                break;
              }
            }
            if (isTitle) {
              const titleParts = [];
              const paragraphs = item.el.getElementsByTagName('a:p');
              for (const para of paragraphs) {
                const runs = para.getElementsByTagName('a:t');
                let paraText = '';
                for (const run of runs) paraText += run.textContent;
                if (paraText.trim()) titleParts.push(paraText.trim());
              }
              if (titleParts.length > 0) {
                slideTitle = titleParts.join(' ');
                titleElementIndex = j;
                break;
              }
            }
          }
        }

        // B. Fallback: first short shape close to the top of the slide
        if (!slideTitle) {
          for (let j = 0; j < elements.length; j++) {
            const item = elements[j];
            if (item.type === 'shape') {
              const paragraphs = item.el.getElementsByTagName('a:p');
              const firstPara = paragraphs[0];
              if (firstPara) {
                const runs = firstPara.getElementsByTagName('a:t');
                let paraText = '';
                for (const run of runs) paraText += run.textContent;
                paraText = paraText.trim();
                
                if (paraText && item.coords.y < 2000000 && paraText.length < 100) {
                  slideTitle = paraText;
                  titleElementIndex = j;
                  break;
                }
              }
            }
          }
        }

        // C. Process body elements in sorted visual reading flow order
        for (let j = 0; j < elements.length; j++) {
          if (j === titleElementIndex) continue;

          const item = elements[j];

          if (item.type === 'shape') {
            const phElements = item.el.getElementsByTagName('p:ph');
            let phType = null;
            if (phElements.length > 0) {
              phType = phElements[0].getAttribute('type');
            }

            const paragraphs = item.el.getElementsByTagName('a:p');
            for (const para of paragraphs) {
              const pPr = para.getElementsByTagName('a:pPr')[0];
              let lvl = 0;
              if (pPr) {
                lvl = parseInt(pPr.getAttribute('lvl') || 0);
              }

              // High-fidelity rich text parsing supporting inline formats (bold, italic)
              const paraTextParts = [];
              const paraChildren = para.childNodes;
              for (const child of paraChildren) {
                if (child.nodeType !== Node.ELEMENT_NODE) continue;
                const localName = child.localName || child.nodeName.split(':').pop();
                if (localName === 'r') {
                  const rPr = child.getElementsByTagName('a:rPr')[0];
                  const isBold = rPr && (rPr.getAttribute('b') === '1' || rPr.getAttribute('b') === 'true');
                  const isItalic = rPr && (rPr.getAttribute('i') === '1' || rPr.getAttribute('i') === 'true');

                  const textNodes = child.getElementsByTagName('a:t');
                  let runText = '';
                  for (const tNode of textNodes) runText += tNode.textContent;
                  if (runText) {
                    const leadingSpace = runText.match(/^\s*/)[0];
                    const trailingSpace = runText.match(/\s*$/)[0];
                    const trimmed = runText.trim();
                    if (trimmed) {
                      let formatted = trimmed;
                      if (isBold && isItalic) formatted = `***${trimmed}***`;
                      else if (isBold) formatted = `**${trimmed}**`;
                      else if (isItalic) formatted = `*${trimmed}*`;
                      runText = leadingSpace + formatted + trailingSpace;
                    } else {
                      runText = leadingSpace;
                    }
                    paraTextParts.push(runText);
                  }
                } else if (localName === 'br') {
                  paraTextParts.push('\n');
                } else if (localName === 'fld') {
                  const textNodes = child.getElementsByTagName('a:t');
                  let fldText = '';
                  for (const tNode of textNodes) fldText += tNode.textContent;
                  if (fldText) paraTextParts.push(fldText);
                }
              }

              const paraText = paraTextParts.join('').trim();
              if (paraText) {
                const hasBuNone = pPr && pPr.getElementsByTagName('a:buNone').length > 0;
                const isBullet = !hasBuNone && (lvl > 0 || (phType && ['body', 'outline', 'obj', 'subTitle'].includes(phType)) || !phType);

                const indent = '  '.repeat(lvl);
                if (isBullet) {
                  bodyMarkdownParts.push(`${indent}- ${paraText}`);
                } else {
                  bodyMarkdownParts.push(`${indent}${paraText}`);
                }
              }
            }
          } else if (item.type === 'table') {
            const tblRows = item.tableEl.getElementsByTagName('a:tr');
            const tableData = [];
            for (const row of tblRows) {
              const cells = row.getElementsByTagName('a:tc');
              const rowData = [];
              for (const cell of cells) {
                const cellTexts = cell.getElementsByTagName('a:t');
                let cellText = '';
                for (const ct of cellTexts) cellText += ct.textContent;
                rowData.push(cellText.trim());
              }
              if (rowData.length > 0) tableData.push(rowData);
            }
            if (tableData.length > 0) {
              bodyMarkdownParts.push('\n' + buildMarkdownTable(tableData) + '\n');
            }
          }
        }

        // D. Speaker Notes Extraction with precise slide mapping
        let notesText = '';
        try {
          const relFile = zip.files[`ppt/slides/_rels/slide${slideNum}.xml.rels`];
          if (relFile) {
            const relXmlString = await relFile.async('string');
            const relXmlDoc = parser.parseFromString(relXmlString, 'application/xml');
            const rels = relXmlDoc.getElementsByTagName('Relationship');
            let notesSlideTarget = null;
            for (const rel of rels) {
              const type = rel.getAttribute('Type');
              const target = rel.getAttribute('Target');
              if (type && type.includes('relationships/notesSlide') && target) {
                notesSlideTarget = target;
                break;
              }
            }
            if (notesSlideTarget) {
              const filename = notesSlideTarget.split('/').pop();
              const notesPath = `ppt/notesSlides/${filename}`;
              const notesZipFile = zip.files[notesPath];
              if (notesZipFile) {
                const notesXmlString = await notesZipFile.async('string');
                const notesXmlDoc = parser.parseFromString(notesXmlString, 'application/xml');
                notesText = extractSpeakerNotes(notesXmlDoc);
              }
            }
          }
        } catch (err) {
          console.warn(`[TokenOptimizer] Failed to resolve relationship-based notes for slide ${slideNum}:`, err);
        }

        // Notes fallback (direct index-based mapping)
        if (!notesText) {
          try {
            const notesPath = `ppt/notesSlides/notesSlide${slideNum}.xml`;
            const notesZipFile = zip.files[notesPath];
            if (notesZipFile) {
              const notesXmlString = await notesZipFile.async('string');
              const notesXmlDoc = parser.parseFromString(notesXmlString, 'application/xml');
              notesText = extractSpeakerNotes(notesXmlDoc);
            }
          } catch (_) {}
        }

        // E. Construct output markdown for slide
        const titleText = slideTitle || `Slide ${slideNum}`;
        markdown += `\n\n## Slide ${slideNum}: ${titleText}\n\n`;

        for (const block of bodyMarkdownParts) {
          markdown += block + '\n';
        }

        if (notesText) {
          markdown += `\n> **Speaker Notes:**\n> ${notesText.replace(/\n/g, '\n> ')}\n`;
        }

        markdown += '\n---\n';
      } catch (err) {
        console.error(`[TokenOptimizer] Error extracting slide ${slideNum} content:`, err);
        markdown += `\n\n## Slide ${slideNum}\n\n*[Error extracting slide content]*\n\n---\n`;
      }
    }

    return markdown.trim();
  }

  /**
   * Token and Layout Optimization Engine
   * Performs aggressive but safe text compression to minimize token usage
   * while preserving semantic meaning and structure.
   */
  function optimizeMarkdown(markdown, options = {}) {
    const config = Object.assign({
      trimMultipleNewlines: true,
      compactTables: true,
      stripComments: true,
      stripInlineStyle: true
    }, options);

    let result = markdown;

    // Normalize CRLF to LF to ensure reliable, cross-platform newline processing
    result = result.replace(/\r\n/g, '\n');

    // ── Protect code blocks from whitespace compression ──────────────
    // Extract fenced code blocks and replace with placeholders so that
    // subsequent whitespace / table passes don't corrupt them.
    const codeBlocks = [];
    result = result.replace(/(```[\s\S]*?```)/g, (match) => {
      const idx = codeBlocks.length;
      codeBlocks.push(match);
      return `\n%%CODEBLOCK_${idx}%%\n`;
    });

    // ── Strip HTML comments ─────────────────────────────────────────
    if (config.stripComments) {
      result = result.replace(/<!--[\s\S]*?-->/g, '');
    }

    // ── Remove inline CSS / class attributes ────────────────────────
    if (config.stripInlineStyle) {
      result = result.replace(/\s*style="[^"]*"/gi, '');
      result = result.replace(/\s*class="[^"]*"/gi, '');
    }

    // ── Compact Markdown tables ─────────────────────────────────────
    // Trim excessive padding inside table cells and simplify separator rows
    if (config.compactTables) {
      result = result.replace(/^(\|.*\|)$/gm, (line) => {
        // Separator row: collapse to minimal dashes
        if (/^\|[\s\-:|]+\|$/.test(line)) {
          return line.replace(/\s*-{2,}\s*/g, '-').replace(/\s*:\s*/g, ':');
        }
        // Data / header row: trim each cell to single-space padding
        return line.replace(/\|\s{2,}/g, '| ').replace(/\s{2,}\|/g, ' |');
      });
    }

    // ── Collapse redundant inline whitespace ────────────────────────
    // Reduce runs of spaces/tabs to a single space on each line.
    // Preserve leading whitespace for list indentation.
    result = result.split('\n').map(line => {
      // Don't touch lines that are only whitespace (blank lines)
      if (!line.trim()) return '';
      // Preserve leading indent, compact the rest
      const match = line.match(/^(\s*)(.*)/);
      if (!match) return line;
      const indent = match[1];
      let body = match[2];
      // Collapse multiple spaces within body text to single space
      body = body.replace(/[ \t]{2,}/g, ' ').trimEnd();
      return indent + body;
    }).join('\n');

    // ── Collapse multiple consecutive newlines to max two ───────────
    if (config.trimMultipleNewlines) {
      result = result.replace(/\n{3,}/g, '\n\n');
    }

    // ── Clean up empty Markdown constructs ───────────────────────────
    result = result.replace(/\n#+\s*\n/g, '\n');
    result = result.replace(/\n[-*]\s*\n/g, '\n');

    // ── Simplify page-break markers ─────────────────────────────────
    // Convert verbose markers like "--- [Page 3] ---" to compact form
    result = result.replace(/---\s*\[Page\s+(\d+)\]\s*---/g, '--- Page $1 ---');

    // ── Restore code blocks ─────────────────────────────────────────
    result = result.replace(/%%CODEBLOCK_(\d+)%%/g, (_, idx) => {
      return codeBlocks[parseInt(idx)];
    });

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

  // ═══════════════════════════════════════════════════════════════════
  //  OCR Support — Tesseract.js Integration (Lazy-loaded, Opt-in)
  // ═══════════════════════════════════════════════════════════════════

  let _tesseractWorker = null;

  /**
   * Detect whether a PDF page is scanned/image-only (no selectable text).
   */
  function isScannedPage(textContent) {
    if (!textContent || !textContent.items) return true;
    const meaningful = textContent.items.filter(item => item.str && item.str.trim().length > 0);
    return meaningful.length < 5;
  }

  /**
   * Initialize the Tesseract.js worker using locally-bundled files.
   * Uses workerBlobURL:false to comply with extension CSP.
   */
  async function initTesseractWorker() {
    if (_tesseractWorker) return _tesseractWorker;

    // Dynamically load Tesseract if not already available
    if (typeof Tesseract === 'undefined') {
      try {
        const script = await fetch(chrome.runtime.getURL('lib/tesseract.min.js'));
        const code = await script.text();
        (0, eval)(code);
      } catch (e) {
        console.error('[ClaudeTokenOptimizer] Failed to load Tesseract.js:', e);
        throw e;
      }
    }

    _tesseractWorker = await Tesseract.createWorker('eng', 1, {
      workerPath:  chrome.runtime.getURL('lib/tesseract-worker.min.js'),
      corePath:    chrome.runtime.getURL('lib/tesseract-core.wasm.js'),
      langPath:    chrome.runtime.getURL('lib/lang-data/'),
      workerBlobURL: false
    });

    return _tesseractWorker;
  }

  /**
   * Render a PDF page to canvas and run Tesseract OCR on it.
   * Returns extracted text string.
   */
  async function ocrPage(pdfPage, scale = 2) {
    const viewport = pdfPage.getViewport({ scale });

    let canvas, context;
    if (typeof OffscreenCanvas !== 'undefined') {
      canvas = new OffscreenCanvas(viewport.width, viewport.height);
      context = canvas.getContext('2d');
    } else {
      canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      context = canvas.getContext('2d');
    }

    await pdfPage.render({ canvasContext: context, viewport }).promise;

    const worker = await initTesseractWorker();
    const { data: { text } } = await worker.recognize(canvas);
    return text || '';
  }

  /**
   * Terminate the Tesseract worker to free resources.
   */
  async function terminateTesseractWorker() {
    if (_tesseractWorker) {
      await _tesseractWorker.terminate();
      _tesseractWorker = null;
    }
  }

  // Exported Public API
  return {
    convertPDF: convertPDFToMarkdown,
    convertDOCX: convertDOCXToMarkdown,
    convertExcel: convertExcelToMarkdown,
    convertMD: convertMDToMarkdown,
    convertPPTX: convertPPTXToMarkdown,
    optimize: optimizeMarkdown,
    estimateTokens: estimateTokens,
    formatBytes: formatBytes,
    arrayBufferToString: arrayBufferToString,
    isScannedPage: isScannedPage
  };
})();

// Assign to window for content script inclusion
if (typeof window !== 'undefined') {
  window.TokenOptimizerConverter = TokenOptimizerConverter;
}
