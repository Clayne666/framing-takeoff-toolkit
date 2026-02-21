/**
 * General notes parser.
 *
 * Extracts framing specification overrides from text-heavy "General Notes"
 * and "Structural Notes" pages.
 */

const NOTE_PATTERNS = [
  // Exterior wall stud size and spacing
  {
    pattern: /(?:all\s+)?(?:exterior|ext\.?)\s+walls?\s+(?:shall\s+be\s+|(?:=|:)\s*)?(2x\d+)\s+(?:studs?\s+)?(?:at\s+|@\s*)?(\d+)\s*["\u2033]\s*o\.?c\.?/gi,
    extract: (m) => ({ specOverrides: { exteriorWallStudSize: m[1].toLowerCase(), exteriorWallSpacing: parseInt(m[2], 10) } }),
  },
  // Interior wall stud size and spacing
  {
    pattern: /(?:all\s+)?(?:interior|int\.?)\s+walls?\s+(?:shall\s+be\s+|(?:=|:)\s*)?(2x\d+)\s+(?:studs?\s+)?(?:at\s+|@\s*)?(\d+)\s*["\u2033]\s*o\.?c\.?/gi,
    extract: (m) => ({ specOverrides: { interiorWallStudSize: m[1].toLowerCase(), interiorWallSpacing: parseInt(m[2], 10) } }),
  },
  // Generic stud spec (no int/ext qualifier)
  {
    pattern: /studs?\s*(?:shall\s+be\s+|(?:=|:)\s*)?(2x\d+)\s+(?:at\s+|@\s*)?(\d+)\s*["\u2033]\s*o\.?c\.?/gi,
    extract: (m) => ({ specOverrides: { exteriorWallStudSize: m[1].toLowerCase(), exteriorWallSpacing: parseInt(m[2], 10) } }),
  },
  // Floor joist size and spacing
  {
    pattern: /floor\s+joists?\s*(?:shall\s+be\s+|(?:=|:)\s*)?(2x\d+|TJI|I-?joist)\s+(?:at\s+|@\s*)?(\d+)\s*["\u2033]\s*o\.?c\.?/gi,
    extract: (m) => ({ specOverrides: { floorJoistSize: m[1].toLowerCase(), floorJoistSpacing: parseInt(m[2], 10) } }),
  },
  // Rafter size and spacing
  {
    pattern: /(?:rafter|roof\s+framing)\s*(?:shall\s+be\s+|(?:=|:)\s*)?(2x\d+)\s+(?:at\s+|@\s*)?(\d+)\s*["\u2033]\s*o\.?c\.?/gi,
    extract: (m) => ({ specOverrides: { rafterSize: m[1].toLowerCase(), rafterSpacing: parseInt(m[2], 10) } }),
  },
  // Roof pitch
  {
    pattern: /roof\s+(?:pitch|slope)\s*(?:shall\s+be\s+|(?:=|:)\s*)?(\d+)\s*(?:\/|:)\s*12/gi,
    extract: (m) => ({ specOverrides: { roofPitch: `${m[1]}/12` } }),
  },
  // Wall sheathing
  {
    pattern: /(?:wall\s+)?sheathing\s*(?:shall\s+be\s+|(?:=|:)\s*)?(\d+\/?\d*)\s*["\u2033]?\s*(OSB|plywood|CDX|structural)/gi,
    extract: (m) => ({ specOverrides: { wallSheathingType: m[2], wallSheathingThickness: m[1] } }),
  },
  // Roof sheathing
  {
    pattern: /roof\s+(?:sheathing|decking)\s*(?:shall\s+be\s+|(?:=|:)\s*)?(\d+\/?\d*)\s*["\u2033]?\s*(OSB|plywood|CDX)/gi,
    extract: (m) => ({ specOverrides: { roofSheathingType: m[2], roofSheathingThickness: m[1] } }),
  },
  // Subfloor
  {
    pattern: /sub\s*floor\s*(?:shall\s+be\s+|(?:=|:)\s*)?(\d+\/?\d*)\s*["\u2033]?\s*(plywood|OSB|tongue)/gi,
    extract: (m) => ({ specOverrides: { subfloorType: m[2], subfloorThickness: m[1] } }),
  },
  // Blocking
  {
    pattern: /blocking\s*(?:shall\s+be\s+|(?:=|:)\s*)?(2x\d+|solid)\s+(?:at\s+)?(?:mid[\s-]?height|(\d+)\s*["\u2033]\s*o\.?c\.?)/gi,
    extract: (m) => ({ specOverrides: { blockingSpec: `${m[1]} at ${m[2] ? m[2] + '" OC' : "mid-height"}` } }),
  },
  // Hold-down hardware
  {
    pattern: /hold[\s-]?downs?\s*(?:shall\s+be\s+|(?:=|:)\s*)?(?:simpson\s+)?(HD[A-Z]*\d+\w*|HDU\d+\w*|PAHD\d+\w*)/gi,
    extract: (m) => ({
      hardware: [{ type: "holdDown", model: m[1].toUpperCase(), quantity: null, location: "Per plan" }],
    }),
  },
  // Hurricane / rafter ties
  {
    pattern: /(?:hurricane|rafter)\s+ties?\s*(?:shall\s+be\s+|(?:=|:)\s*)?(?:simpson\s+)?(H\d+[\w.]*)/gi,
    extract: (m) => ({
      hardware: [{ type: "hurricaneTie", model: m[1].toUpperCase(), quantity: null, location: "Every rafter" }],
    }),
  },
  // Joist hangers
  {
    pattern: /joist\s+hangers?\s*(?:shall\s+be\s+|(?:=|:)\s*)?(?:simpson\s+)?(LUS\d+\w*|U\d+\w*|HUS\d+\w*)/gi,
    extract: (m) => ({
      hardware: [{ type: "hanger", model: m[1].toUpperCase(), size: null, quantity: null }],
    }),
  },
  // Steel beam callouts (W-shape, HSS, channel, angle)
  {
    pattern: /(W\d+[xX]\d+|HSS\d+[xX]\d+[xX][\d/.]+|C\d+[xX][\d.]+|L\d+[xX]\d+[xX][\d/.]+)\s+(?:beam|column|brace|header)/gi,
    extract: (m) => ({
      steelMembers: [{ type: "beam", shape: m[1].toUpperCase(), span: null, location: "Per notes" }],
    }),
  },
  // Tube steel columns
  {
    pattern: /(?:tube\s+steel|steel\s+(?:column|post))\s*(?:=|:)?\s*(HSS[\d.xX/]+|\d+["\u2033]?\s*(?:sq|square)\s*tube)/gi,
    extract: (m) => ({
      steelMembers: [{ type: "column", shape: m[1].toUpperCase(), height: null, location: "Per notes" }],
    }),
  },
];

/**
 * Parse general notes text and extract specification overrides,
 * hardware callouts, and steel member references.
 *
 * @param {object} spatialData - output from extractSpatialText()
 * @returns {object} Partial extraction result to merge
 */
export function parseGeneralNotes(spatialData) {
  const text = spatialData.rawText;
  const partial = {
    specOverrides: {},
    hardware: [],
    steelMembers: [],
    warnings: [],
  };

  for (const { pattern, extract } of NOTE_PATTERNS) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const extracted = extract(match);
      if (extracted.specOverrides) {
        Object.assign(partial.specOverrides, extracted.specOverrides);
      }
      if (extracted.hardware) {
        partial.hardware.push(...extracted.hardware);
      }
      if (extracted.steelMembers) {
        partial.steelMembers.push(...extracted.steelMembers);
      }
    }
  }

  if (/seismic\s*design\s*category/i.test(text) && partial.hardware.length === 0) {
    partial.warnings.push("Seismic design category noted but no specific hold-down hardware identified - verify shear wall schedule");
  }

  return partial;
}
