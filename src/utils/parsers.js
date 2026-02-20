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
