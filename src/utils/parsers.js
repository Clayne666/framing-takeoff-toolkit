/**
 * Enhanced construction plan parsers for accurate framing takeoff.
 *
 * Handles real-world architectural PDF text output including:
 *  - Fragmented / poorly-spaced text from PDF.js
 *  - Unicode prime/double-prime characters
 *  - Dash, hyphen, en-dash, em-dash separators
 *  - Fractional inches with various spacings
 *  - Architectural scale notations (1/4" = 1'-0", etc.)
 *  - Wall schedules, structural notes, general notes
 *  - Stud / joist / rafter spacing callouts
 *  - Opening schedules (doors & windows)
 *  - Plate heights, bearing walls, shear walls
 */

// ─── Dimension Parsing ────────────────────────────────────────────────

const FEET_CHARS = "['\\u2032\\u02B9\\u0027]";  // ' ′ ʹ '
const INCH_CHARS = `["\\u2033\\u02BA\\u0022]`; // " ″ ʺ "
const DASH_CHARS = "[-\\u2010\\u2011\\u2012\\u2013\\u2014]"; // various dashes

/**
 * Parse dimensional callouts from construction plan text.
 * Significantly expanded to handle real-world PDF text extraction quirks.
 *
 * Supported formats:
 *  12'-6 1/2"    feet-inches-fraction
 *  12'-6"        feet-inches
 *  12'-0"        feet-zero-inches
 *  12' - 6"      feet (space) dash (space) inches
 *  12.5'         decimal feet
 *  12'           feet only
 *  6'-0 1/2"     feet-zero-and-fraction
 *  146"          inches-only (>=12" converts to feet)
 *  12' 6"        feet (space) inches (no dash)
 *  12 FT         spelled out
 *  12 FEET       spelled out
 *  12'-6 1/2     inches without quote mark
 *  0'-6"         zero-feet with inches
 */
export function parseDimensions(text) {
  if (!text || typeof text !== "string") return [];

  const dimensions = [];
  const seen = new Set();

  // Normalize the text for more reliable matching
  const normalized = text
    .replace(/\u2032/g, "'")   // prime → '
    .replace(/\u02B9/g, "'")   // modifier letter prime → '
    .replace(/\u2033/g, '"')   // double prime → "
    .replace(/\u02BA/g, '"')   // modifier letter double prime → "
    .replace(/\u2018/g, "'")   // left single quote → '
    .replace(/\u2019/g, "'")   // right single quote → '
    .replace(/\u201C/g, '"')   // left double quote → "
    .replace(/\u201D/g, '"')   // right double quote → "
    .replace(/[\u2010-\u2015]/g, "-")  // all dash variants → hyphen
    .replace(/\r\n/g, " ")
    .replace(/\n/g, " ");

  const addDim = (raw, feet, type) => {
    const rounded = Math.round(feet * 10000) / 10000;
    const key = `${rounded}`;
    if (rounded > 0 && rounded < 500 && !seen.has(key)) {
      seen.add(key);
      dimensions.push({ raw: raw.trim(), feet: rounded, type });
    }
  };

  // Pattern priority matters — most specific first

  // 1. Feet-inches-fraction: 12'-6 1/2" or 12' - 6 1/2" or 12' 6 1/2"
  const p1 = /(\d+)\s*'\s*-?\s*(\d+)\s+(\d+)\s*\/\s*(\d+)\s*"?/g;
  let m;
  while ((m = p1.exec(normalized)) !== null) {
    const ft = +m[1];
    const inches = +m[2] + +m[3] / +m[4];
    addDim(m[0], ft + inches / 12, "ft-in-frac");
  }

  // 2. Feet-zero-fraction: 12'-0 1/2" (zero inches + fraction)
  const p1b = /(\d+)\s*'\s*-?\s*0\s+(\d+)\s*\/\s*(\d+)\s*"?/g;
  while ((m = p1b.exec(normalized)) !== null) {
    addDim(m[0], +m[1] + (+m[2] / +m[3]) / 12, "ft-in-frac");
  }

  // 3. Feet-inches: 12'-6" or 12' - 6" or 12' 6" or 12'-06"
  const p2 = /(\d+)\s*'\s*-?\s*(\d{1,2})\s*"/g;
  while ((m = p2.exec(normalized)) !== null) {
    addDim(m[0], +m[1] + +m[2] / 12, "ft-in");
  }

  // 4. Feet-inches no quotes: 12'-6 (no trailing " — common in some PDFs)
  const p2b = /(\d+)\s*'\s*-\s*(\d{1,2})(?=[^\/\d"']|\s|$)/g;
  while ((m = p2b.exec(normalized)) !== null) {
    addDim(m[0], +m[1] + +m[2] / 12, "ft-in");
  }

  // 5. Decimal feet: 12.5'
  const p3 = /(\d+\.\d+)\s*'/g;
  while ((m = p3.exec(normalized)) !== null) {
    addDim(m[0], +m[1], "dec-ft");
  }

  // 6. Feet only: 12' (but not followed by dash+digit which would be ft-in)
  const p4 = /(\d+)\s*'(?!\s*-?\s*\d)/g;
  while ((m = p4.exec(normalized)) !== null) {
    addDim(m[0], +m[1], "ft");
  }

  // 7. Inches only (≥12"): 146" → convert to feet
  const p5 = /(?<!['\d])(\d{2,})\s*"(?!\s*=)/g;
  while ((m = p5.exec(normalized)) !== null) {
    const inches = +m[1];
    if (inches >= 12 && inches < 6000) {
      addDim(m[0], inches / 12, "in-only");
    }
  }

  // 8. Spelled-out feet: 12 FT or 12 FEET or 12FT
  const p6 = /(\d+(?:\.\d+)?)\s*(?:FT|FEET|ft|feet|Ft|Feet)\.?(?:\s|$|,|;)/g;
  while ((m = p6.exec(normalized)) !== null) {
    addDim(m[0], +m[1], "spelled");
  }

  // 9. Dimension with x separator (common in plans): 24 x 36 or 24x36 (both as individual dims)
  const p7 = /(\d+(?:\.\d+)?)\s*[xX×]\s*(\d+(?:\.\d+)?)\s*(?:'|FT|ft)?/g;
  while ((m = p7.exec(normalized)) !== null) {
    const v1 = +m[1], v2 = +m[2];
    // Only add if they look like room/area dimensions (> 3 ft each)
    if (v1 >= 3 && v1 < 500) addDim(`${m[1]}`, v1, "area-dim");
    if (v2 >= 3 && v2 < 500 && v2 !== v1) addDim(`${m[2]}`, v2, "area-dim");
  }

  return dimensions;
}

// ─── Framing References ───────────────────────────────────────────────

/**
 * Extract framing-related references from construction plan text.
 * Expanded to cover:
 *  - Lumber sizes (2x4 through 6x6, LVL, glulam, PSL, LSL, etc.)
 *  - Structural members (beam, header, rafter, joist, stud, plate, etc.)
 *  - Hardware (Simpson, USP, hurricane ties, hold-downs, hangers, etc.)
 *  - Sheathing (OSB, plywood, T&G, CDX, ZIP, Advantech, etc.)
 *  - Spacing callouts (16" OC, 24" OC, 12" OC, etc.)
 *  - Connection types (nailing schedules, bolts, lag screws)
 *  - Wall types (shear wall, bearing wall, partition, etc.)
 *  - Truss / engineered lumber references
 */
export function parseFramingReferences(text) {
  if (!text || typeof text !== "string") return [];

  const normalized = text
    .replace(/[\u2032\u02B9]/g, "'")
    .replace(/[\u2033\u02BA]/g, '"')
    .replace(/[\u2010-\u2015]/g, "-");

  const patterns = [
    // Lumber sizes
    /\b[2-6]x[2-9]\d?\b/gi,
    /\b[2-6]\s*[xX×]\s*[2-9]\d?\b/gi,
    // Engineered lumber
    /\bLVL\b/gi,
    /\bPSL\b/gi,
    /\bLSL\b/gi,
    /\bglulam\b/gi,
    /\bGlu-?Lam\b/gi,
    /\bTJI\b/gi,
    /\bI-?joist[s]?\b/gi,
    /\bTJ[IPK]\s*\d+/gi,
    /\bBCI\s*\d+/gi,
    /\bengineered\s+(wood|lumber|beam|joist)/gi,
    /\bmicro-?lam\b/gi,
    /\bparal?lam\b/gi,
    // Structural members
    /\btruss(?:es)?\b/gi,
    /\brafter[s]?\b/gi,
    /\bjoist[s]?\b/gi,
    /\bstud[s]?\b/gi,
    /\b(?:top|bottom|sole|cap|sill)\s*plate[s]?\b/gi,
    /\bplate[s]?\b/gi,
    /\bheader[s]?\b/gi,
    /\bbeam[s]?\b/gi,
    /\bcolumn[s]?\b/gi,
    /\bpost[s]?\b/gi,
    /\bblocking\b/gi,
    /\bbridging\b/gi,
    /\brim\s*(?:joist|board)\b/gi,
    /\bledger\b/gi,
    /\bridge\s*(?:board|beam)\b/gi,
    /\bcripple\s*(?:stud|wall)\b/gi,
    /\bjack\s*stud\b/gi,
    /\bking\s*stud\b/gi,
    /\btrimmer\b/gi,
    // Sheathing / panels
    /\bOSB\b/g,
    /\bplywood\b/gi,
    /\bCDX\b/g,
    /\bT\s*(?:&|and)\s*G\b/gi,
    /\bZIP\s*(?:system|wall|sheathing)?\b/gi,
    /\bAdvantech\b/gi,
    /\bDensglass\b/gi,
    /\bgyp(?:sum)?\s*(?:board|sheathing)\b/gi,
    // Hardware
    /\bSimpson\b/gi,
    /\bUSP\b/g,
    /\bhurricane\s*(?:tie|clip|strap)[s]?\b/gi,
    /\bhanger[s]?\b/gi,
    /\bhold[\s-]?down[s]?\b/gi,
    /\bstrap[s]?\b/gi,
    /\banchor\s*bolt[s]?\b/gi,
    /\bA-?35\b/gi,
    /\bH\d+\b/g,
    /\bHDU?\d+\b/g,
    /\bLTP[24]\b/g,
    /\bL\d+\b/g,
    // Spacing callouts
    /\b\d{1,2}\s*"?\s*[oO]\.?\s*[cC]\.?\b/g,
    /\b\d{1,2}"\s*(?:on\s*center|o\.?c\.?)\b/gi,
    // Wall types
    /\bshear\s*wall[s]?\b/gi,
    /\bbearing\s*wall[s]?\b/gi,
    /\bpartition\s*wall[s]?\b/gi,
    /\bexterior\s*wall[s]?\b/gi,
    /\binterior\s*wall[s]?\b/gi,
    /\bfire[\s-]?wall[s]?\b/gi,
    /\bdemising\s*wall[s]?\b/gi,
    /\bcurtain\s*wall[s]?\b/gi,
    // Connections / nailing
    /\b\d{1,2}d\s*(?:nail|common)\b/gi,
    /\bnailing\s*schedule\b/gi,
    /\b\d+\/\d+"\s*(?:bolt|lag)\b/gi,
    // Floor / roof specific
    /\bsubfloor\b/gi,
    /\bunderlayment\b/gi,
    /\broof\s*(?:sheathing|deck(?:ing)?)\b/gi,
    /\bfloor\s*(?:sheathing|deck(?:ing)?)\b/gi,
    /\bsoffit\b/gi,
    /\bfascia\b/gi,
    /\beve\b/gi,
    /\brake\b/gi,
    /\boverhang\b/gi,
    // Pitch references
    /\b\d{1,2}\s*(?:\/|:)\s*12\s*(?:pitch|slope)?\b/gi,
  ];

  const found = new Set();
  for (const regex of patterns) {
    let match;
    // Reset lastIndex for global regexes
    regex.lastIndex = 0;
    while ((match = regex.exec(normalized)) !== null) {
      const val = match[0].trim();
      if (val.length > 1) found.add(val);
    }
  }
  return [...found].sort();
}

// ─── Room & Space Names ───────────────────────────────────────────────

/**
 * Extract room names and spaces from construction plan text.
 * Expanded for residential + light commercial plans.
 */
export function parseRooms(text) {
  if (!text || typeof text !== "string") return [];

  const patterns = [
    // Residential rooms
    /\b(?:master|primary)\s*(?:bed(?:room)?|suite|bath(?:room)?)\b/gi,
    /\bbedroom\s*(?:#?\d+)?\b/gi,
    /\bbath(?:room)?\s*(?:#?\d+)?\b/gi,
    /\bhalf\s*bath\b/gi,
    /\bpowder\s*room\b/gi,
    /\bkitchen\b/gi,
    /\bliving\s*(?:room|area)?\b/gi,
    /\bdining\s*(?:room|area)?\b/gi,
    /\bfamily\s*room\b/gi,
    /\bgreat\s*room\b/gi,
    /\bgarage\b/gi,
    /\bcloset[s]?\b/gi,
    /\bwalk[\s-]?in\s*(?:closet)?\b/gi,
    /\bhallway\b/gi,
    /\bcorridor\b/gi,
    /\bfoyer\b/gi,
    /\bentry(?:way)?\b/gi,
    /\bvestibule\b/gi,
    /\blaundry\b/gi,
    /\butility\b/gi,
    /\bmechanical\b/gi,
    /\bstorage\b/gi,
    /\boffice\b/gi,
    /\bstudy\b/gi,
    /\bden\b/gi,
    /\bbonus\s*(?:room)?\b/gi,
    /\bloft\b/gi,
    /\bporch\b/gi,
    /\bdeck\b/gi,
    /\bpatio\b/gi,
    /\bbalcony\b/gi,
    /\bveranda\b/gi,
    /\bmudroom\b/gi,
    /\bpantry\b/gi,
    /\bnook\b/gi,
    /\bbreakfast\s*(?:nook|area|room)?\b/gi,
    /\bnursery\b/gi,
    /\bplayroom\b/gi,
    /\bsunroom\b/gi,
    /\bscreened\s*(?:porch|room)\b/gi,
    /\bbreezeway\b/gi,
    /\bcarport\b/gi,
    /\bworkshop\b/gi,
    // Commercial / multi-use
    /\blobby\b/gi,
    /\breception\b/gi,
    /\bconference\s*(?:room)?\b/gi,
    /\bmeeting\s*(?:room)?\b/gi,
    /\bbreak\s*room\b/gi,
    /\brestroom\b/gi,
    /\bcommunity\s*(?:room|space|area|center)\b/gi,
    /\bclass(?:room)?\b/gi,
    /\bmultipurpose\b/gi,
    /\bcommon\s*(?:area|room|space)\b/gi,
    /\bcafeteria\b/gi,
    /\bchapel\b/gi,
    /\blibrary\b/gi,
    /\bgym(?:nasium)?\b/gi,
    /\bstairwell\b/gi,
    /\belevator\b/gi,
    /\bjani(?:tor(?:ial)?|torial)\s*(?:closet)?\b/gi,
    /\bserver\s*room\b/gi,
    /\belectrical\s*(?:room|closet)\b/gi,
    /\bIT\s*(?:room|closet)\b/gi,
    // Mother's Hub specific (since this is the project)
    /\bhub\b/gi,
    /\bnursing\s*(?:room|area|station)?\b/gi,
    /\bwelcome\s*(?:center|area|desk)?\b/gi,
    /\bplay\s*(?:area|room|space)\b/gi,
    /\bactivity\s*(?:room|area|space)\b/gi,
    /\bcounseling\b/gi,
    /\btherapy\s*(?:room)?\b/gi,
    /\bgroup\s*(?:room|space)\b/gi,
    /\bstaff\s*(?:room|area|office|lounge)\b/gi,
    /\bwait(?:ing)?\s*(?:room|area)?\b/gi,
    /\bcheck[\s-]?in\b/gi,
  ];

  const found = new Set();
  for (const regex of patterns) {
    let match;
    regex.lastIndex = 0;
    while ((match = regex.exec(text)) !== null) {
      const val = match[0].trim();
      if (val.length > 2) found.add(val);
    }
  }
  return [...found].sort();
}

// ─── Scale Detection ──────────────────────────────────────────────────

/**
 * Detect the architectural scale from plan text (e.g., "SCALE: 1/4" = 1'-0"").
 * Returns the scale factor in pixels-per-foot if found, or null.
 *
 * Common architectural scales:
 *   1" = 1'-0"    (1:12)   → fullScale
 *   3/4" = 1'-0"  (1:16)
 *   1/2" = 1'-0"  (1:24)
 *   3/8" = 1'-0"  (1:32)
 *   1/4" = 1'-0"  (1:48)   ← most common for floor plans
 *   3/16" = 1'-0" (1:64)
 *   1/8" = 1'-0"  (1:96)   ← common for site plans / elevations
 *   1/16" = 1'-0" (1:192)
 */
export function parseScale(text) {
  if (!text || typeof text !== "string") return null;

  const normalized = text
    .replace(/[\u2032\u02B9\u2018\u2019]/g, "'")
    .replace(/[\u2033\u02BA\u201C\u201D]/g, '"')
    .replace(/[\u2010-\u2015]/g, "-");

  const scales = [];

  // Pattern: SCALE: 1/4" = 1'-0" or SCALE 1/4"=1'-0" or 1/4" = 1'
  const p1 = /(?:SCALE\s*[:=]?\s*)?(\d+)\s*\/\s*(\d+)\s*"?\s*=\s*1\s*'[\s-]*0?\s*"?/gi;
  let m;
  while ((m = p1.exec(normalized)) !== null) {
    const numerator = +m[1];
    const denominator = +m[2];
    const inchesPerFoot = numerator / denominator;
    scales.push({
      raw: m[0].trim(),
      inchesPerFoot,
      ratio: Math.round(12 / inchesPerFoot),
      label: `${m[1]}/${m[2]}" = 1'-0"`,
    });
  }

  // Pattern: SCALE: 1" = X'-0" (e.g., 1" = 20')
  const p2 = /(?:SCALE\s*[:=]?\s*)?1\s*"\s*=\s*(\d+)\s*'[\s-]*(?:0\s*"?)?/gi;
  while ((m = p2.exec(normalized)) !== null) {
    const feetPerInch = +m[1];
    scales.push({
      raw: m[0].trim(),
      inchesPerFoot: 1 / feetPerInch,
      ratio: feetPerInch * 12,
      label: `1" = ${m[1]}'-0"`,
    });
  }

  // Pattern: SCALE: 1:48 or SCALE 1:24 (numeric ratio)
  const p3 = /(?:SCALE\s*[:=]?\s*)?1\s*:\s*(\d+)/gi;
  while ((m = p3.exec(normalized)) !== null) {
    const ratio = +m[1];
    if (ratio >= 10 && ratio <= 200) {
      scales.push({
        raw: m[0].trim(),
        inchesPerFoot: 12 / ratio,
        ratio,
        label: `1:${ratio}`,
      });
    }
  }

  return scales.length > 0 ? scales : null;
}

// ─── Wall Schedule Parsing ────────────────────────────────────────────

/**
 * Parse wall schedule information from plan text.
 * Extracts wall types, heights, stud sizes, sheathing, and special notes.
 */
export function parseWallSchedule(text) {
  if (!text || typeof text !== "string") return [];

  const normalized = text
    .replace(/[\u2032\u02B9]/g, "'")
    .replace(/[\u2033\u02BA]/g, '"')
    .replace(/[\u2010-\u2015]/g, "-");

  const walls = [];

  // Look for plate height callouts: "8'-0" PLATE HEIGHT" or "9' PLATE" or "10' CLG"
  const heightPattern = /(\d+)\s*'[\s-]*(?:0\s*"?\s*)?(?:PLATE\s*(?:HEIGHT|HT|H)?|CLG|CEIL(?:ING)?|WALL\s*(?:HEIGHT|HT))/gi;
  let m;
  const heights = new Set();
  while ((m = heightPattern.exec(normalized)) !== null) {
    heights.add(+m[1]);
  }

  // Look for wall type designations
  const wallTypePattern = /(?:TYPE\s*)?([A-Z]\d?)\s*[-:]\s*(.*?)(?:\n|$|;)/gi;
  while ((m = wallTypePattern.exec(normalized)) !== null) {
    walls.push({ type: m[1], description: m[2].trim() });
  }

  // Look for stud size callouts in wall context
  const studPattern = /([2-6]x[4-6])\s*(?:@|AT)\s*(\d{1,2})\s*"?\s*[oO]\.?\s*[cC]\.?/gi;
  const studs = [];
  while ((m = studPattern.exec(normalized)) !== null) {
    studs.push({ size: m[1], spacing: +m[2] });
  }

  return {
    heights: [...heights],
    wallTypes: walls,
    studSpecs: studs,
    defaultHeight: heights.size > 0 ? Math.max(...heights) : 8,
  };
}

// ─── Opening Schedule Parsing ─────────────────────────────────────────

/**
 * Parse door and window schedules from plan text.
 * Returns counts and rough opening sizes.
 */
export function parseOpeningSchedule(text) {
  if (!text || typeof text !== "string") return { doors: [], windows: [], totalOpenings: 0 };

  const normalized = text
    .replace(/[\u2032\u02B9]/g, "'")
    .replace(/[\u2033\u02BA]/g, '"')
    .replace(/[\u2010-\u2015]/g, "-");

  const doors = [];
  const windows = [];

  // Door patterns: D1, D2, etc. or DOOR 1, DOOR 2
  const doorPattern = /(?:D(?:OOR)?\s*#?\s*)(\d+)\s*[-:]\s*(\d+)\s*['"x×X]\s*(?:(\d+)\s*['"x×X]\s*)?/gi;
  let m;
  while ((m = doorPattern.exec(normalized)) !== null) {
    doors.push({ id: `D${m[1]}`, width: +m[2], height: m[3] ? +m[3] : 80 });
  }

  // Window patterns: W1, W2, etc.
  const windowPattern = /(?:W(?:INDOW)?\s*#?\s*)(\d+)\s*[-:]\s*(\d+)\s*['"x×X]\s*(?:(\d+)\s*['"x×X]\s*)?/gi;
  while ((m = windowPattern.exec(normalized)) !== null) {
    windows.push({ id: `W${m[1]}`, width: +m[2], height: m[3] ? +m[3] : 48 });
  }

  // Count generic door/window symbols (common in plans)
  const doorCount = (normalized.match(/\bDOOR\b/gi) || []).length;
  const windowCount = (normalized.match(/\bWINDOW\b/gi) || []).length;

  // If we didn't find scheduled items, at least report counts
  const total = Math.max(doors.length + windows.length, doorCount + windowCount);

  return { doors, windows, totalOpenings: total, doorCount: Math.max(doors.length, doorCount), windowCount: Math.max(windows.length, windowCount) };
}

// ─── Structural Notes Parsing ─────────────────────────────────────────

/**
 * Extract structural/general notes relevant to framing.
 * Identifies bearing conditions, shear requirements, engineering callouts.
 */
export function parseStructuralNotes(text) {
  if (!text || typeof text !== "string") return [];

  const normalized = text
    .replace(/[\u2032\u02B9]/g, "'")
    .replace(/[\u2033\u02BA]/g, '"')
    .replace(/[\u2010-\u2015]/g, "-");

  const notes = [];

  const notePatterns = [
    // Bearing & load
    /(?:all|every)\s+(?:exterior|bearing|load[\s-]?bearing)\s+walls?\s+(?:shall|to|must)\s+be\s+[^.;]{5,80}/gi,
    /(?:bearing|load)\s+(?:wall|condition|point)[^.;]{5,80}/gi,
    // Shear wall
    /shear\s+wall[^.;]{5,80}/gi,
    /shear\s+panel[^.;]{5,80}/gi,
    // Headers
    /header[s]?\s+(?:shall|to|at|per|size)[^.;]{5,80}/gi,
    /(?:all|typical)\s+headers?\s+[^.;]{5,80}/gi,
    // Nailing
    /nail(?:ing)?\s+(?:schedule|pattern|per)[^.;]{5,80}/gi,
    // Hold-down / anchoring
    /hold[\s-]?down[^.;]{5,80}/gi,
    /anchor\s+bolt[^.;]{5,80}/gi,
    // Spacing
    /stud[s]?\s+(?:@|at|spaced)\s+\d{1,2}\s*"?\s*[oO]\.?\s*[cC][^.;]{0,60}/gi,
    /joist[s]?\s+(?:@|at|spaced)\s+\d{1,2}\s*"?\s*[oO]\.?\s*[cC][^.;]{0,60}/gi,
    /rafter[s]?\s+(?:@|at|spaced)\s+\d{1,2}\s*"?\s*[oO]\.?\s*[cC][^.;]{0,60}/gi,
    // Roof pitch
    /roof\s+(?:pitch|slope)\s*[:=]?\s*\d+\s*(?:\/|:)\s*12[^.;]{0,40}/gi,
    /\d+\s*(?:\/|:)\s*12\s+(?:pitch|slope|roof)[^.;]{0,40}/gi,
  ];

  for (const pattern of notePatterns) {
    let m;
    pattern.lastIndex = 0;
    while ((m = pattern.exec(normalized)) !== null) {
      const note = m[0].trim();
      if (note.length > 10 && !notes.some((n) => n.includes(note) || note.includes(n))) {
        notes.push(note);
      }
    }
  }

  return notes;
}

// ─── Roof Pitch Detection ─────────────────────────────────────────────

/**
 * Detect roof pitch callouts from plan text.
 */
export function parseRoofPitch(text) {
  if (!text || typeof text !== "string") return [];

  const pitches = new Set();
  const pattern = /(\d{1,2})\s*(?:\/|:)\s*12/g;
  let m;
  while ((m = pattern.exec(text)) !== null) {
    const rise = +m[1];
    if (rise >= 1 && rise <= 24) {
      pitches.add(`${rise}/12`);
    }
  }
  return [...pitches];
}

// ─── Spacing Detection ────────────────────────────────────────────────

/**
 * Detect OC spacing callouts from plan text.
 */
export function parseSpacingCallouts(text) {
  if (!text || typeof text !== "string") return [];

  const normalized = text
    .replace(/[\u2033\u02BA]/g, '"')
    .replace(/[\u2010-\u2015]/g, "-");

  const spacings = new Set();
  const pattern = /(\d{1,2})\s*"?\s*[oO]\.?\s*[cC]\.?/g;
  let m;
  while ((m = pattern.exec(normalized)) !== null) {
    const spacing = +m[1];
    if ([12, 16, 19.2, 24].includes(spacing) || (spacing >= 6 && spacing <= 48)) {
      spacings.add(spacing);
    }
  }
  return [...spacings].sort((a, b) => a - b);
}

// ─── Page Classification ──────────────────────────────────────────────

/**
 * Classify a plan page by its likely content type.
 * Helps route extracted data to the correct takeoff tab.
 */
export function classifyPage(text) {
  if (!text || typeof text !== "string") return "unknown";

  const upper = text.toUpperCase();

  const scores = {
    floor: 0,
    foundation: 0,
    wall: 0,
    roof: 0,
    elevation: 0,
    section: 0,
    site: 0,
    electrical: 0,
    plumbing: 0,
    mechanical: 0,
    detail: 0,
    schedule: 0,
    cover: 0,
    general: 0,
  };

  // Floor plan indicators
  if (/FLOOR\s*PLAN/i.test(upper)) scores.floor += 10;
  if (/\b(?:1ST|2ND|3RD|FIRST|SECOND|THIRD|MAIN|UPPER|LOWER)\s*FLOOR/i.test(upper)) scores.floor += 8;
  if (/KITCHEN|BEDROOM|BATHROOM|LIVING|DINING|GARAGE/i.test(upper)) scores.floor += 3;
  if (/(?:INTERIOR|PARTITION)\s*WALL/i.test(upper)) scores.floor += 2;

  // Foundation
  if (/FOUNDATION\s*PLAN/i.test(upper)) scores.foundation += 10;
  if (/FOOTING|STEM\s*WALL|SLAB|CRAWL\s*SPACE/i.test(upper)) scores.foundation += 5;

  // Wall / framing
  if (/FRAMING\s*PLAN/i.test(upper)) scores.wall += 10;
  if (/WALL\s*(?:SECTION|SCHEDULE|DETAIL)/i.test(upper)) scores.wall += 8;
  if (/SHEAR\s*WALL|BEARING\s*WALL/i.test(upper)) scores.wall += 5;
  if (/STUD|PLATE|HEADER|BLOCKING/i.test(upper)) scores.wall += 2;

  // Roof
  if (/ROOF\s*(?:PLAN|FRAMING)/i.test(upper)) scores.roof += 10;
  if (/RAFTER|RIDGE|TRUSS|PITCH|SLOPE/i.test(upper)) scores.roof += 5;
  if (/\d+\s*[/:]\s*12/i.test(upper)) scores.roof += 3;

  // Elevation
  if (/(?:NORTH|SOUTH|EAST|WEST|FRONT|REAR|LEFT|RIGHT)\s*ELEVATION/i.test(upper)) scores.elevation += 10;
  if (/ELEVATION/i.test(upper)) scores.elevation += 5;

  // Section
  if (/(?:BUILDING|WALL|TYPICAL)\s*SECTION/i.test(upper)) scores.section += 8;
  if (/SECTION\s*[A-Z]/i.test(upper)) scores.section += 5;

  // Site plan
  if (/SITE\s*PLAN/i.test(upper)) scores.site += 10;
  if (/SETBACK|PROPERTY\s*LINE|EASEMENT/i.test(upper)) scores.site += 5;

  // MEP (not framing)
  if (/ELECTRICAL\s*PLAN/i.test(upper)) scores.electrical += 10;
  if (/PLUMBING\s*PLAN/i.test(upper)) scores.plumbing += 10;
  if (/MECHANICAL\s*PLAN|HVAC/i.test(upper)) scores.mechanical += 10;

  // Details
  if (/DETAIL/i.test(upper)) scores.detail += 3;

  // Schedule
  if (/(?:DOOR|WINDOW|FINISH|WALL)\s*SCHEDULE/i.test(upper)) scores.schedule += 8;

  // Cover / general
  if (/COVER\s*SHEET|TITLE\s*SHEET|INDEX/i.test(upper)) scores.cover += 10;
  if (/GENERAL\s*NOTES/i.test(upper)) scores.general += 8;

  const best = Object.entries(scores).reduce((a, b) => (b[1] > a[1] ? b : a), ["unknown", 0]);
  return best[1] >= 3 ? best[0] : "unknown";
}

// ─── Smart Takeoff Context ────────────────────────────────────────────

/**
 * Given extracted page data, try to associate dimensions with
 * the correct takeoff category (walls, floors, roof).
 *
 * Uses page classification + surrounding text context for each dimension.
 */
export function categorizeDimensions(dimensions, pageClassification, surroundingTexts) {
  return dimensions.map((dim, i) => {
    const context = (surroundingTexts?.[i] || "").toUpperCase();
    let category = "unknown";
    let confidence = 0;

    // Check surrounding text for clues
    if (/WALL|STUD|PLATE|HEADER|SHEAR|BEARING|PARTITION/i.test(context)) {
      category = "wall";
      confidence = 0.8;
    } else if (/JOIST|FLOOR|SUBFLOOR|SPAN|BEAM/i.test(context)) {
      category = "floor";
      confidence = 0.8;
    } else if (/RAFTER|ROOF|RIDGE|TRUSS|PITCH|OVERHANG/i.test(context)) {
      category = "roof";
      confidence = 0.8;
    }

    // Fallback to page classification
    if (category === "unknown") {
      if (pageClassification === "floor" || pageClassification === "foundation") {
        // Floor plan dimensions are usually wall lengths
        category = "wall";
        confidence = 0.5;
      } else if (pageClassification === "roof") {
        category = "roof";
        confidence = 0.6;
      } else if (pageClassification === "wall" || pageClassification === "section") {
        category = "wall";
        confidence = 0.5;
      }
    }

    // Height heuristic: 8-12 ft → likely wall height
    if (dim.feet >= 7.5 && dim.feet <= 12 && category === "unknown") {
      category = "wall-height";
      confidence = 0.4;
    }

    // Long dimensions on floor plans → wall lengths
    if (dim.feet > 12 && dim.feet < 100 && pageClassification === "floor") {
      category = "wall";
      confidence = 0.6;
    }

    return { ...dim, category, confidence };
  });
}
