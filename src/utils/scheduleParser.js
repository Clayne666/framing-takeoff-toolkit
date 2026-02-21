/**
 * Schedule parsers for wall schedules and door/window schedules.
 *
 * Parses detected tabular regions from the spatial text engine to extract
 * structured framing specifications.
 */

import { parseDimensions } from "./parsers";

// ─── Column header mapping (fuzzy) ────────────────────────────────

const WALL_COL_MAP = {
  type:       /^(type|mark|id|wall[\s_-]*type|wall[\s_-]*id)$/i,
  studSize:   /^(stud|framing|size|stud[\s_-]*size|frame[\s_-]*size)$/i,
  spacing:    /^(spac|o\.?c\.?|layout|stud[\s_-]*spac)$/i,
  height:     /^(height|ht|wall[\s_-]*ht|wall[\s_-]*height)$/i,
  sheathing:  /^(sheath|ext\.?\s*finish|osb|ply|exterior)$/i,
  insulation: /^(insul|r[\s_-]*val|cavity)$/i,
  interior:   /^(int\.?\s*finish|interior|gypsum|drywall)$/i,
  notes:      /^(note|remark|comment|description)$/i,
};

const DOOR_WIN_COL_MAP = {
  mark:        /^(mark|id|tag|no\.?|number)$/i,
  width:       /^(width|w|size|nominal)$/i,
  height:      /^(height|h|ht)$/i,
  type:        /^(type|style|frame|material|description)$/i,
  quantity:    /^(qty|quan|count|#|number)$/i,
  headerSize:  /^(header|hdr|lintel)$/i,
  roughWidth:  /^(r\.?o\.?\s*w|rough[\s_-]*w)$/i,
  roughHeight: /^(r\.?o\.?\s*h|rough[\s_-]*h)$/i,
  fire:        /^(fire|rating|label)$/i,
  glazing:     /^(glaz|glass|lite)$/i,
  notes:       /^(note|remark|comment)$/i,
};

/**
 * Map table header cells to semantic column names using a column map.
 * Returns { colIndex → semanticName } mapping.
 */
function mapColumns(headerRow, colMap) {
  const mapping = {};
  for (let i = 0; i < headerRow.length; i++) {
    const cell = headerRow[i].trim();
    if (!cell) continue;
    for (const [semantic, regex] of Object.entries(colMap)) {
      if (regex.test(cell)) {
        mapping[i] = semantic;
        break;
      }
    }
    // Fallback: check if the header contains the key word (partial match)
    if (!mapping[i]) {
      for (const [semantic, regex] of Object.entries(colMap)) {
        const keyword = semantic.replace(/([A-Z])/g, " $1").toLowerCase().trim();
        if (cell.toLowerCase().includes(keyword)) {
          mapping[i] = semantic;
          break;
        }
      }
    }
  }
  return mapping;
}

/**
 * Extract a dimensional value (in feet) from a cell string.
 */
function parseDimCell(str) {
  if (!str) return null;
  const dims = parseDimensions(str);
  if (dims.length > 0) return dims[0].feet;
  // Try plain number (already in feet or inches)
  const num = parseFloat(str);
  if (!isNaN(num) && num > 0 && num < 500) return num;
  return null;
}

/**
 * Extract a spacing value in inches from a cell string.
 */
function parseSpacingCell(str) {
  if (!str) return null;
  const match = str.match(/(\d+)\s*["\u2033]?\s*[oO]\.?[cC]\.?/);
  if (match) return parseInt(match[1], 10);
  const num = parseInt(str, 10);
  if ([12, 16, 24].includes(num)) return num;
  return null;
}

/**
 * Extract a stud size from a cell string (e.g. "2x6", "2×4").
 */
function parseStudSize(str) {
  if (!str) return null;
  const match = str.match(/(2x\d+|4x\d+)/i);
  return match ? match[1].toLowerCase() : null;
}

// ─── Wall Schedule Parser ──────────────────────────────────────────

/**
 * Parse a wall schedule table.
 *
 * @param {object} table – a table from spatialData.tables
 * @returns {Array} Wall type objects
 */
export function parseWallSchedule(table) {
  if (!table || table.cells.length < 2) return [];

  const colMap = mapColumns(table.headerRow, WALL_COL_MAP);
  const dataRows = table.cells.slice(1); // skip header
  const wallTypes = [];

  for (const row of dataRows) {
    const get = (semantic) => {
      const idx = Object.entries(colMap).find(([, name]) => name === semantic)?.[0];
      return idx !== undefined ? row[+idx] : null;
    };

    const typeVal = get("type");
    if (!typeVal || !typeVal.trim()) continue; // skip empty rows

    const studSize = parseStudSize(get("studSize"));
    const spacing = parseSpacingCell(get("spacing"));
    const height = parseDimCell(get("height"));
    const sheathingRaw = get("sheathing") || "";
    const notes = get("notes") || "";
    const insulRaw = get("insulation") || "";

    // Determine exterior/interior from type name or sheathing presence
    const typeUpper = typeVal.toUpperCase().trim();
    const isExterior = /EXT|EXTERIOR|^A$|^B$/i.test(typeUpper) || sheathingRaw.length > 0;

    wallTypes.push({
      type: typeUpper,
      studSize: studSize || "2x4",
      spacing: spacing || 16,
      height: height || 8,
      sheathingType: /osb/i.test(sheathingRaw) ? "OSB" : /ply/i.test(sheathingRaw) ? "Plywood" : sheathingRaw.trim() || null,
      sheathingThickness: sheathingRaw.match(/(\d+\/?\d*)\s*[""]?/)?.[1] || null,
      insulation: insulRaw.trim() || null,
      exterior: isExterior,
      notes: notes.trim(),
    });
  }

  return wallTypes;
}

// ─── Door / Window Schedule Parser ─────────────────────────────────

/** Header sizing rules (from QuickReference.jsx logic) */
function deriveHeaderSize(openingWidthInches) {
  if (openingWidthInches <= 36) return "2x6";
  if (openingWidthInches <= 48) return "2x8";
  if (openingWidthInches <= 72) return "2x10";
  if (openingWidthInches <= 96) return "2x12";
  return "LVL";
}

/**
 * Parse a door or window schedule table.
 *
 * @param {object} table – a table from spatialData.tables
 * @param {"door"|"window"} category
 * @returns {Array} Opening objects
 */
export function parseDoorWindowSchedule(table, category = "door") {
  if (!table || table.cells.length < 2) return [];

  const colMap = mapColumns(table.headerRow, DOOR_WIN_COL_MAP);
  const dataRows = table.cells.slice(1);
  const openings = [];

  for (const row of dataRows) {
    const get = (semantic) => {
      const idx = Object.entries(colMap).find(([, name]) => name === semantic)?.[0];
      return idx !== undefined ? row[+idx] : null;
    };

    const mark = (get("mark") || "").trim();
    if (!mark) continue;

    const widthRaw = get("width") || get("roughWidth") || "";
    const heightRaw = get("height") || get("roughHeight") || "";

    // Parse dimensions — try the cell, look for paired "W x H" in one cell too
    let width = parseDimCell(widthRaw);
    let height = parseDimCell(heightRaw);

    // If width cell contains "3'-0\" x 6'-8\"", parse both
    if (width === null && widthRaw.includes("x")) {
      const parts = widthRaw.split(/\s*x\s*/i);
      width = parseDimCell(parts[0]);
      if (parts[1] && height === null) height = parseDimCell(parts[1]);
    }

    const quantity = parseInt(get("quantity"), 10) || 1;
    const headerRaw = get("headerSize") || "";
    const headerMatch = headerRaw.match(/(\d+)[-\s]*(2x\d+|LVL)/i);
    let headerCount = headerMatch ? parseInt(headerMatch[1], 10) : 2;
    let headerSize = headerMatch ? headerMatch[2] : null;

    // Derive header size if not specified
    const widthInches = width ? width * 12 : 36;
    if (!headerSize) {
      headerSize = deriveHeaderSize(widthInches);
    }

    // Infer category from mark prefix
    const inferredCategory = /^[wW]/.test(mark) ? "window" : /^[dD]/.test(mark) ? "door" : category;

    openings.push({
      mark,
      category: inferredCategory,
      width: width || 3,
      height: height || (inferredCategory === "door" ? 6.67 : 4),
      quantity,
      headerSize,
      headerCount,
      trimmerStuds: 2,    // per opening
      kingStuds: 2,       // per opening
      crippleStuds: inferredCategory === "window" ? 4 : 2, // estimate
      sillHeight: inferredCategory === "window" ? 3 : 0,
      wallType: null,     // filled later by floor plan correlation
      type: (get("type") || "").trim(),
      notes: (get("notes") || "").trim(),
    });
  }

  return openings;
}

/**
 * Scan all tables on a page and return wall schedule entries found.
 */
export function findWallScheduleInTables(tables) {
  const results = [];
  for (const table of tables) {
    const header = (table.headerRow || []).join(" ").toLowerCase();
    if (/type/.test(header) && (/stud|height|spacing|framing/.test(header))) {
      results.push(...parseWallSchedule(table));
    }
  }
  return results;
}

/**
 * Scan all tables on a page and return door/window schedule entries found.
 */
export function findDoorWindowScheduleInTables(tables, rawText) {
  const results = [];
  const isDoorPage = /door\s*schedule/i.test(rawText);
  const isWindowPage = /window\s*schedule/i.test(rawText);
  const defaultCategory = isDoorPage ? "door" : isWindowPage ? "window" : "door";

  for (const table of tables) {
    const header = (table.headerRow || []).join(" ").toLowerCase();
    if (/mark|tag|id/.test(header) && (/size|width|height|type/.test(header))) {
      results.push(...parseDoorWindowSchedule(table, defaultCategory));
    }
  }
  return results;
}
