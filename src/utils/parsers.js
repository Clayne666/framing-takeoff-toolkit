/**
 * Parse dimensional callouts from construction plan text.
 * Supports: 12'-6 1/2", 12'-6", 12.5', 12'
 */
export function parseDimensions(text) {
  const dimensions = [];
  const seen = new Set();

  const patterns = [
    {
      regex: /(\d+)\s*['\u2032]\s*[-\s]?\s*(\d+)\s*[-\s](\d+)\/(\d+)\s*["\u2033]?/g,
      parse: (m) => ({
        raw: m[0],
        feet: +m[1] + (+m[2] + +m[3] / +m[4]) / 12,
        type: "ft-in-frac",
      }),
    },
    {
      regex: /(\d+)\s*['\u2032]\s*[-\s]?\s*(\d+)\s*["\u2033]/g,
      parse: (m) => ({
        raw: m[0],
        feet: +m[1] + +m[2] / 12,
        type: "ft-in",
      }),
    },
    {
      regex: /(\d+\.\d+)\s*['\u2032]/g,
      parse: (m) => ({
        raw: m[0],
        feet: +m[1],
        type: "dec-ft",
      }),
    },
    {
      regex: /(\d+)\s*['\u2032](?!\s*[-\d])/g,
      parse: (m) => ({
        raw: m[0],
        feet: +m[1],
        type: "ft",
      }),
    },
  ];

  for (const { regex, parse } of patterns) {
    let match;
    while ((match = regex.exec(text)) !== null) {
      const dim = parse(match);
      const key = `${dim.raw}|${dim.feet.toFixed(4)}`;
      if (!seen.has(key) && dim.feet > 0 && dim.feet < 500) {
        seen.add(key);
        dimensions.push(dim);
      }
    }
  }

  return dimensions;
}

/**
 * Extract framing-related references (lumber sizes, structural members,
 * hardware, spacing callouts) from construction plan text.
 */
export function parseFramingReferences(text) {
  const regex =
    /(2x\d+|4x\d+|LVL|TJI|I-?joist|truss|rafter|joist|stud|plate|header|beam|blocking|sheathing|OSB|plywood|simpson|hurricane|hanger|16\s*["\u2033]\s*[oO]\.?[cC]|24\s*["\u2033]\s*[oO]\.?[cC])/gi;
  const found = new Set();
  let match;
  while ((match = regex.exec(text)) !== null) {
    found.add(match[0]);
  }
  return [...found];
}

/**
 * Extract room and space names from construction plan text.
 */
export function parseRooms(text) {
  const regex =
    /(bedroom|bathroom|bath|kitchen|living\s*room|dining|garage|closet|hallway|foyer|entry|laundry|utility|storage|office|den|family\s*room|great\s*room|master|bonus|loft|porch|deck|patio|mudroom|pantry)/gi;
  const found = new Set();
  let match;
  while ((match = regex.exec(text)) !== null) {
    found.add(match[0].trim());
  }
  return [...found];
}

/**
 * Common architectural scales mapping.
 * Maps the drawing-side fraction (inches per foot) to the ratio (pixels-per-inch at 72 DPI).
 */
const KNOWN_SCALES = [
  // { pattern, label, ratio } — ratio = real feet per inch on paper
  { pattern: /1\/8\s*["\u2033]?\s*=\s*1\s*['\u2032]\s*[-\s]?\s*0\s*["\u2033]?/i, label: '1/8" = 1\'-0"', ratio: 8 },
  { pattern: /3\/16\s*["\u2033]?\s*=\s*1\s*['\u2032]\s*[-\s]?\s*0\s*["\u2033]?/i, label: '3/16" = 1\'-0"', ratio: 64 / 12 },
  { pattern: /1\/4\s*["\u2033]?\s*=\s*1\s*['\u2032]\s*[-\s]?\s*0\s*["\u2033]?/i, label: '1/4" = 1\'-0"', ratio: 4 },
  { pattern: /3\/8\s*["\u2033]?\s*=\s*1\s*['\u2032]\s*[-\s]?\s*0\s*["\u2033]?/i, label: '3/8" = 1\'-0"', ratio: 32 / 12 },
  { pattern: /1\/2\s*["\u2033]?\s*=\s*1\s*['\u2032]\s*[-\s]?\s*0\s*["\u2033]?/i, label: '1/2" = 1\'-0"', ratio: 2 },
  { pattern: /3\/4\s*["\u2033]?\s*=\s*1\s*['\u2032]\s*[-\s]?\s*0\s*["\u2033]?/i, label: '3/4" = 1\'-0"', ratio: 16 / 12 },
  { pattern: /1\s*["\u2033]?\s*=\s*1\s*['\u2032]\s*[-\s]?\s*0\s*["\u2033]?/i, label: '1" = 1\'-0"', ratio: 1 },
  // Numeric ratio scales: 1:48 = 1/4" scale, etc.
  { pattern: /(?:scale\s*[:=]?\s*)?1\s*:\s*96\b/i, label: '1:96 (1/8" = 1\')', ratio: 8 },
  { pattern: /(?:scale\s*[:=]?\s*)?1\s*:\s*48\b/i, label: '1:48 (1/4" = 1\')', ratio: 4 },
  { pattern: /(?:scale\s*[:=]?\s*)?1\s*:\s*24\b/i, label: '1:24 (1/2" = 1\')', ratio: 2 },
  { pattern: /(?:scale\s*[:=]?\s*)?1\s*:\s*16\b/i, label: '1:16 (3/4" = 1\')', ratio: 16 / 12 },
  { pattern: /(?:scale\s*[:=]?\s*)?1\s*:\s*12\b/i, label: '1:12 (1" = 1\')', ratio: 1 },
  // Generic "SCALE: 1/4" etc. without the "= 1'-0"" part
  { pattern: /scale\s*[:=]?\s*1\/8\s*["\u2033]/i, label: '1/8" = 1\'-0"', ratio: 8 },
  { pattern: /scale\s*[:=]?\s*1\/4\s*["\u2033]/i, label: '1/4" = 1\'-0"', ratio: 4 },
  { pattern: /scale\s*[:=]?\s*1\/2\s*["\u2033]/i, label: '1/2" = 1\'-0"', ratio: 2 },
  { pattern: /scale\s*[:=]?\s*3\/8\s*["\u2033]/i, label: '3/8" = 1\'-0"', ratio: 32 / 12 },
  { pattern: /scale\s*[:=]?\s*3\/4\s*["\u2033]/i, label: '3/4" = 1\'-0"', ratio: 16 / 12 },
  { pattern: /scale\s*[:=]?\s*3\/16\s*["\u2033]/i, label: '3/16" = 1\'-0"', ratio: 64 / 12 },
];

/**
 * Auto-detect the architectural scale from PDF text.
 * Returns { label, ratio, pixelsPerFoot } or null if not found.
 * pixelsPerFoot is computed for the given renderScale (default 1.5) at 72 DPI base.
 */
export function parseScale(text, renderScale = 1.5) {
  const baseDPI = 72;
  for (const { pattern, label, ratio } of KNOWN_SCALES) {
    if (pattern.test(text)) {
      // ratio = how many real-world feet per 1 inch on paper
      // pixels per inch at render = baseDPI * renderScale
      // pixels per foot = (baseDPI * renderScale) / ratio
      const pixelsPerFoot = (baseDPI * renderScale) / ratio;
      return { label, ratio, pixelsPerFoot };
    }
  }
  return null;
}

/**
 * Extract wall / ceiling / plate heights from construction plan text.
 * Returns array of { raw, feet, type } where type describes the source.
 */
export function parseWallHeights(text) {
  const heights = [];
  const seen = new Set();

  const patterns = [
    // "8'-0" CLG" or "9'-0" CEILING" or "10'-0" PLATE HT"
    {
      regex: /(\d+)\s*['\u2032]\s*[-\s]?\s*(\d+)\s*["\u2033]?\s*(?:CLG|CEILING|CEIL|plate\s*h(?:eigh)?t|plate\s*line|wall\s*h(?:eigh)?t)/gi,
      parse: (m) => ({ raw: m[0].trim(), feet: +m[1] + +m[2] / 12, type: "ceiling-height" }),
    },
    // "CEILING HEIGHT: 9'" or "CLG HT: 8'" or "PLATE HEIGHT 10'"
    {
      regex: /(?:ceiling\s*h(?:eigh)?t|CLG\s*H(?:eigh)?T|plate\s*h(?:eigh)?t|plate\s*line|wall\s*h(?:eigh)?t)\s*[:=]?\s*(\d+)\s*['\u2032]\s*[-\s]?\s*(\d+)?\s*["\u2033]?/gi,
      parse: (m) => ({ raw: m[0].trim(), feet: +m[1] + (+m[2] || 0) / 12, type: "ceiling-height" }),
    },
    // "9 FT CEILING" or "8 FOOT PLATE"
    {
      regex: /(\d+)\s*(?:FT|FOOT|ft|foot)\s*(?:CEILING|CLG|PLATE|WALL)/gi,
      parse: (m) => ({ raw: m[0].trim(), feet: +m[1], type: "ceiling-height" }),
    },
    // "T.O.P. 8'-0"" (Top of Plate) or "T.O.W. 9'-0""
    {
      regex: /T\.?O\.?[PW]\.?\s*[:=]?\s*(\d+)\s*['\u2032]\s*[-\s]?\s*(\d+)?\s*["\u2033]?/gi,
      parse: (m) => ({ raw: m[0].trim(), feet: +m[1] + (+m[2] || 0) / 12, type: "top-of-plate" }),
    },
    // "F.F. TO PLATE 8'-1"" (Finished Floor to Plate)
    {
      regex: /(?:F\.?F\.?\s*(?:TO|to)\s*(?:PLATE|plate|CLG|ceiling))\s*[:=]?\s*(\d+)\s*['\u2032]\s*[-\s]?\s*(\d+)?\s*["\u2033]?/gi,
      parse: (m) => ({ raw: m[0].trim(), feet: +m[1] + (+m[2] || 0) / 12, type: "ff-to-plate" }),
    },
  ];

  for (const { regex, parse } of patterns) {
    let match;
    while ((match = regex.exec(text)) !== null) {
      const h = parse(match);
      const key = h.feet.toFixed(2);
      if (!seen.has(key) && h.feet >= 7 && h.feet <= 30) {
        seen.add(key);
        heights.push(h);
      }
    }
  }

  return heights;
}
