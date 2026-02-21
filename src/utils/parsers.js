/**
 * Parse dimensional callouts from construction plan text.
 * Supports: 12'-6 1/2", 12'-6", 12.5', 12', 6 1/2", paired W x H
 */
export function parseDimensions(text) {
  const dimensions = [];
  const seen = new Set();

  const patterns = [
    // feet-inches-fraction: 12'-6 1/2"
    {
      regex: /(\d+)\s*['\u2032]\s*[-\s]?\s*(\d+)\s*[-\s](\d+)\/(\d+)\s*["\u2033]?/g,
      parse: (m) => ({ raw: m[0], feet: +m[1] + (+m[2] + +m[3] / +m[4]) / 12, type: "ft-in-frac" }),
    },
    // feet-inches: 12'-6"
    {
      regex: /(\d+)\s*['\u2032]\s*[-\s]?\s*(\d+)\s*["\u2033]/g,
      parse: (m) => ({ raw: m[0], feet: +m[1] + +m[2] / 12, type: "ft-in" }),
    },
    // decimal feet: 12.5'
    {
      regex: /(\d+\.\d+)\s*['\u2032]/g,
      parse: (m) => ({ raw: m[0], feet: +m[1], type: "dec-ft" }),
    },
    // whole feet only: 12'
    {
      regex: /(\d+)\s*['\u2032](?!\s*[-\d])/g,
      parse: (m) => ({ raw: m[0], feet: +m[1], type: "ft" }),
    },
    // fractional inches only: 6 1/2"
    {
      regex: /(\d+)\s+(\d+)\/(\d+)\s*["\u2033]/g,
      parse: (m) => ({ raw: m[0], feet: (+m[1] + +m[2] / +m[3]) / 12, type: "in-frac" }),
    },
    // whole inches only (contextual): 36", 48"
    {
      regex: /(?<!\d['\u2032]\s*[-\s]?\s*)(\d{2,3})\s*["\u2033](?!\s*[oO]\.?[cC])/g,
      parse: (m) => ({ raw: m[0], feet: +m[1] / 12, type: "in" }),
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
 * Parse paired dimensions like "3'-0\" x 6'-8\"" from schedule entries.
 * Returns [{ width, height }] in decimal feet.
 */
export function parsePairedDimensions(text) {
  const pairs = [];
  const regex = /(\d+['\u2032]?\s*[-\s]?\s*\d*\s*(?:\d+\/\d+)?\s*["\u2033]?)\s*[xX\u00d7]\s*(\d+['\u2032]?\s*[-\s]?\s*\d*\s*(?:\d+\/\d+)?\s*["\u2033]?)/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    const wDims = parseDimensions(match[1]);
    const hDims = parseDimensions(match[2]);
    if (wDims.length > 0 && hDims.length > 0) {
      pairs.push({ width: wDims[0].feet, height: hDims[0].feet, raw: match[0] });
    }
  }
  return pairs;
}

/**
 * Extract framing-related references from construction plan text.
 * Covers lumber, engineered wood, steel shapes, hardware, and spacing.
 */
export function parseFramingReferences(text) {
  const regex =
    /(2x\d+|4x\d+|6x\d+|LVL[\s\d.x]*|PSL[\s\d.x]*|LSL[\s\d.x]*|glulam|TJI[\s\d]*|I-?joist|truss|rafter|joist|stud|plate|header|beam|blocking|fire\s*block|bridging|sheathing|OSB|plywood|CDX|rim\s*board|band\s*joist|ledger|cripple|king\s*stud|trimmer|W\d+[xX]\d+|HSS\d+[xX][\d.xX/]+|C\d+[xX][\d.]+|L\d+[xX]\d+[xX][\d/.]+|tube\s*steel|simpson|hurricane|hanger|hold[\s-]?down|strap|anchor|HDU?\d+\w*|PAHD\d+\w*|MSTA\d+\w*|LUS\d+\w*|HUS\d+\w*|H\d+[.\w]*|A35|LTP4|LSTA\d+|12\s*["\u2033]\s*[oO]\.?[cC]|16\s*["\u2033]\s*[oO]\.?[cC]|24\s*["\u2033]\s*[oO]\.?[cC])/gi;
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
    /(bedroom|bathroom|bath|kitchen|living\s*room|dining|garage|closet|hallway|foyer|entry|laundry|utility|storage|office|den|family\s*room|great\s*room|master|bonus|loft|porch|deck|patio|mudroom|pantry|nook|mechanical|crawl\s*space|attic|stairwell|hub|studio|lobby|reception|corridor|ADA\s*bath|break\s*room|conference|meeting|vestibule|alcove|mezzanine|breezeway|carport|workshop)/gi;
  const found = new Set();
  let match;
  while ((match = regex.exec(text)) !== null) {
    found.add(match[0].trim());
  }
  return [...found];
}
