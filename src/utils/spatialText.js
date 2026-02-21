/**
 * Spatial text extraction engine for PDF.js.
 *
 * Replaces flat `items.map(i => i.str).join(" ")` with a position-aware
 * extractor that preserves x/y coordinates, reconstructs lines, detects
 * column gaps, and identifies tabular regions.
 */

/**
 * Normalize a single PDF.js text item into a predictable shape.
 */
function normalizeItem(item) {
  const fontSize = Math.abs(item.transform[0]) || Math.abs(item.transform[3]) || 10;
  return {
    str: item.str,
    x: item.transform[4],
    y: item.transform[5],
    width: item.width,
    height: item.height || fontSize,
    fontSize,
    fontName: item.fontName || "",
  };
}

/**
 * Group normalized items into horizontal text lines.
 * Items whose y-positions are within a tolerance are placed on the same line.
 */
function groupIntoLines(items) {
  if (items.length === 0) return [];

  // Sort by y descending (top of page first) then x ascending
  const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x);

  const lines = [];
  let currentLine = { items: [sorted[0]], y: sorted[0].y, fontSize: sorted[0].fontSize };

  for (let i = 1; i < sorted.length; i++) {
    const item = sorted[i];
    const tolerance = Math.max(currentLine.fontSize * 0.4, 2);

    if (Math.abs(item.y - currentLine.y) <= tolerance) {
      currentLine.items.push(item);
    } else {
      // Finalize current line and start a new one
      currentLine.items.sort((a, b) => a.x - b.x);
      lines.push(currentLine);
      currentLine = { items: [item], y: item.y, fontSize: item.fontSize };
    }
  }
  currentLine.items.sort((a, b) => a.x - b.x);
  lines.push(currentLine);

  return lines;
}

/**
 * Build a single text string for a line, inserting TAB characters where
 * large horizontal gaps indicate column boundaries.
 */
function buildLineText(lineItems) {
  if (lineItems.length === 0) return "";
  let text = lineItems[0].str;

  for (let i = 1; i < lineItems.length; i++) {
    const prev = lineItems[i - 1];
    const curr = lineItems[i];
    const prevEnd = prev.x + prev.width;
    const gap = curr.x - prevEnd;
    const avgCharWidth = prev.str.length > 0 ? prev.width / prev.str.length : prev.fontSize * 0.5;
    const tabThreshold = avgCharWidth * 2.5;

    if (gap > tabThreshold) {
      text += "\t" + curr.str;
    } else if (gap > avgCharWidth * 0.3) {
      text += " " + curr.str;
    } else {
      text += curr.str;
    }
  }
  return text;
}

/**
 * Detect tabular regions by finding runs of consecutive lines with
 * matching column-aligned x-start positions.
 */
function detectTables(lines, tolerance = 6) {
  if (lines.length < 3) return [];

  // For each line, collect the set of column x-start buckets
  const lineColumnSets = lines.map((line) => {
    const cols = [];
    for (const item of line.items) {
      // Round to nearest bucket
      const bucket = Math.round(item.x / tolerance) * tolerance;
      if (!cols.includes(bucket)) cols.push(bucket);
    }
    return cols.sort((a, b) => a - b);
  });

  const tables = [];
  let runStart = null;
  let runCols = null;

  for (let i = 0; i < lineColumnSets.length; i++) {
    const cols = lineColumnSets[i];
    if (cols.length < 2) {
      // Single-column line breaks a table run
      if (runStart !== null && i - runStart >= 3) {
        tables.push(buildTable(lines, runStart, i - 1, runCols, tolerance));
      }
      runStart = null;
      runCols = null;
      continue;
    }

    if (runCols === null) {
      // Start a potential run
      runStart = i;
      runCols = cols;
    } else {
      // Check if column count matches (allow +/- 1)
      if (Math.abs(cols.length - runCols.length) <= 1) {
        // Extend the run; use the wider column set as reference
        if (cols.length > runCols.length) runCols = cols;
      } else {
        // Column count changed — finalize if long enough
        if (i - runStart >= 3) {
          tables.push(buildTable(lines, runStart, i - 1, runCols, tolerance));
        }
        runStart = i;
        runCols = cols;
      }
    }
  }
  // Finalize trailing run
  if (runStart !== null && lines.length - runStart >= 3) {
    tables.push(buildTable(lines, runStart, lines.length - 1, runCols, tolerance));
  }

  return tables;
}

/**
 * Build a table object from a detected range of lines and column positions.
 */
function buildTable(lines, startIdx, endIdx, columnBuckets, tolerance) {
  // Derive column boundaries: each bucket marks the start of a column,
  // extend to the next bucket (or page edge) for the boundary.
  const colBounds = columnBuckets.map((bucket, idx) => ({
    xMin: bucket - tolerance,
    xMax: idx < columnBuckets.length - 1 ? columnBuckets[idx + 1] - tolerance : Infinity,
  }));

  const cells = [];
  for (let i = startIdx; i <= endIdx; i++) {
    const row = colBounds.map((col) => {
      const matching = lines[i].items
        .filter((item) => item.x >= col.xMin && item.x < col.xMax)
        .map((item) => item.str)
        .join(" ")
        .trim();
      return matching;
    });
    cells.push(row);
  }

  // First row is likely the header
  const headerRow = cells.length > 0 ? cells[0] : [];

  return {
    startLineIndex: startIdx,
    endLineIndex: endIdx,
    columns: colBounds,
    cells,
    headerRow,
  };
}

/**
 * Identify text blocks: headings (larger font) vs body text.
 */
function extractTextBlocks(lines) {
  if (lines.length === 0) return [];

  // Compute median font size
  const sizes = lines.map((l) => l.fontSize).sort((a, b) => a - b);
  const medianSize = sizes[Math.floor(sizes.length / 2)];

  return lines.map((line) => ({
    text: buildLineText(line.items),
    fontSize: line.fontSize,
    y: line.y,
    type: line.fontSize > medianSize * 1.2 ? "heading" : "body",
  }));
}

/**
 * Main entry point: extract spatial text data from PDF.js textContent items.
 *
 * @param {Array} items – textContent.items from page.getTextContent()
 * @param {{ width: number, height: number }} viewport – page viewport
 * @returns {object} Spatial text data with lines, tables, blocks, and raw text.
 */
export function extractSpatialText(items, viewport) {
  const normalized = items.filter((item) => item.str.trim().length > 0).map(normalizeItem);
  const lines = groupIntoLines(normalized);

  // Build raw text (backward-compatible flat string)
  const rawText = lines.map((line) => buildLineText(line.items)).join(" ");

  const tables = detectTables(lines);
  const textBlocks = extractTextBlocks(lines);

  return {
    lines: lines.map((line) => ({
      y: line.y,
      fontSize: line.fontSize,
      fontName: line.items[0]?.fontName || "",
      text: buildLineText(line.items),
      items: line.items,
    })),
    tables,
    rawText,
    textBlocks,
    viewportWidth: viewport.width,
    viewportHeight: viewport.height,
  };
}
