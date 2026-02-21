/**
 * AI Vision extraction module.
 *
 * Renders PDF pages to high-res images and sends them to the Anthropic
 * Claude API (Messages with vision) for structured framing data extraction.
 */

const CLAUDE_API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-4-20250514";
const MAX_TOKENS = 4096;

// ── Prompt templates per page type ─────────────────────────────────

const PROMPTS = {
  FLOOR_PLAN: `You are an expert construction estimator analyzing a floor plan drawing.
Extract ALL framing-relevant data from this construction floor plan image. Return a JSON object with:

{
  "wallSegments": [
    { "wallType": "A or B etc if marked", "length": feet_decimal, "room": "room name", "direction": "N/S/E/W" }
  ],
  "openings": [
    { "mark": "D1 or W1 etc", "category": "door or window", "width": feet, "height": feet, "wallType": "A etc" }
  ],
  "rooms": [
    { "name": "Room Name", "width": feet, "length": feet }
  ],
  "dimensions": [
    { "value": feet_decimal, "context": "what this dimension describes" }
  ],
  "notes": ["any relevant text notes on this page"]
}

Be precise with dimensions. Convert all measurements to decimal feet. Include every dimension callout visible.
If a wall type letter is circled near a wall, include it. If you cannot read a value, set it to null.
Return ONLY the JSON object, no other text.`,

  SECTION_DETAIL: `You are an expert construction estimator analyzing a building section or detail drawing.
Extract ALL framing members and structural components visible. Return a JSON object with:

{
  "members": [
    { "size": "2x6 or LVL 3.5x11.875 etc", "type": "stud|joist|rafter|header|beam|plate|blocking|column", "spacing": OC_inches_or_null, "zone": "roof|wall|floor", "description": "brief context" }
  ],
  "steelMembers": [
    { "shape": "W8x31 or HSS4x4 etc", "type": "beam|column|brace", "description": "context" }
  ],
  "hardware": [
    { "type": "holdDown|hanger|hurricaneTie|strap|anchor", "model": "Simpson model if visible", "description": "context" }
  ],
  "assemblies": [
    { "name": "Wall Type A etc", "layers": ["description of each layer from exterior to interior"] }
  ],
  "notes": ["any relevant text callouts"]
}

Be precise with lumber sizes. Include doubled members (e.g., "DBL 2x12" or "2-2x10").
Return ONLY the JSON object, no other text.`,

  STRUCTURAL_PLAN: `You are an expert construction estimator analyzing a structural/framing plan.
Extract ALL structural members, beams, columns, and framing layout. Return a JSON object with:

{
  "beams": [
    { "size": "LVL 3.5x11.875 or W8x31 etc", "span": feet, "location": "description", "type": "wood|steel|engineered" }
  ],
  "columns": [
    { "size": "4x4 or HSS4x4x1/4 etc", "height": feet_or_null, "location": "description", "type": "wood|steel" }
  ],
  "joists": [
    { "size": "2x10 etc", "spacing": OC_inches, "span": feet, "direction": "N-S or E-W", "area": "description" }
  ],
  "bearingWalls": [
    { "location": "description", "wallType": "letter if marked" }
  ],
  "hardware": [
    { "type": "hanger|holdDown|post_base|beam_seat", "model": "Simpson model", "quantity": number_or_null, "size": "member size" }
  ],
  "notes": ["any relevant text notes"]
}

Include ALL beam sizes with their spans. Note every steel member. Return ONLY the JSON object.`,

  ROOF_PLAN: `You are an expert construction estimator analyzing a roof framing plan.
Extract ALL roof framing data. Return a JSON object with:

{
  "sections": [
    { "name": "Main Roof etc", "ridgeLength": feet, "span": feet, "pitch": "X/12", "rafterSize": "2x8 etc", "rafterSpacing": OC_inches }
  ],
  "hips": [
    { "length": feet, "rafterSize": "size" }
  ],
  "valleys": [
    { "length": feet, "rafterSize": "size" }
  ],
  "trusses": [
    { "type": "description", "spacing": OC_inches, "span": feet, "quantity": number }
  ],
  "sheathing": { "type": "OSB or plywood", "thickness": "1/2 etc" },
  "notes": ["any relevant text notes"]
}

Include all pitch callouts. Note ridge board sizes if visible. Return ONLY the JSON object.`,

  ELEVATION: `You are an expert construction estimator analyzing a building elevation drawing.
Extract height and material information. Return a JSON object with:

{
  "heights": [
    { "description": "plate height, ridge height, etc", "value": feet_decimal }
  ],
  "materials": [
    { "type": "siding|roofing|trim", "description": "material callout" }
  ],
  "pitches": [
    { "value": "X/12", "location": "which roof section" }
  ],
  "notes": ["any relevant text notes"]
}

Return ONLY the JSON object.`,
};

// ── API key management ─────────────────────────────────────────────

export function getApiKey() {
  try {
    return localStorage.getItem("anthropic_api_key") || "";
  } catch {
    return "";
  }
}

export function setApiKey(key) {
  try {
    localStorage.setItem("anthropic_api_key", key.trim());
  } catch {
    // localStorage unavailable
  }
}

export function isAiAvailable() {
  return getApiKey().length > 10;
}

// ── API call ───────────────────────────────────────────────────────

/**
 * Send a page image to Claude Vision API for structured extraction.
 *
 * @param {string} base64Image - base64-encoded PNG (no data: prefix)
 * @param {string} pageType - one of the PROMPTS keys
 * @param {string} [contextText] - extracted text from this page
 * @returns {Promise<object>} Parsed JSON from Claude
 */
export async function extractWithAi(base64Image, pageType, contextText = "", agentContext = "") {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("No Anthropic API key configured.");
  }

  const prompt = PROMPTS[pageType];
  if (!prompt) {
    throw new Error("No AI prompt for page type: " + pageType);
  }

  // Build full prompt with optional context additions
  let fullPrompt = prompt;
  if (contextText) fullPrompt += "\n\nAdditional text extracted from this page:\n" + contextText;
  if (agentContext) fullPrompt += agentContext;

  const body = {
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: "You are a construction plan analysis expert. Always respond with valid JSON only. No markdown, no explanation - just the JSON object.",
    messages: [{
      role: "user",
      content: [
        {
          type: "image",
          source: { type: "base64", media_type: "image/png", data: base64Image },
        },
        {
          type: "text",
          text: fullPrompt,
        },
      ],
    }],
  };

  const response = await fetch(CLAUDE_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error("Claude API error " + response.status + ": " + errText);
  }

  const data = await response.json();
  const text = data.content?.[0]?.text || "";
  const jsonStr = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();

  try {
    return JSON.parse(jsonStr);
  } catch {
    throw new Error("Failed to parse AI response as JSON: " + jsonStr.slice(0, 200));
  }
}

// ── Result mapping ─────────────────────────────────────────────────

export function mapFloorPlanAiResult(aiResult, pageNum) {
  const partial = { wallSegments: [], openings: [], warnings: [] };
  if (aiResult.wallSegments) {
    for (const seg of aiResult.wallSegments) {
      if (seg.length > 0) {
        partial.wallSegments.push({ wallType: seg.wallType || null, length: seg.length, room: seg.room || "", page: pageNum });
      }
    }
  }
  if (aiResult.openings) {
    for (const o of aiResult.openings) {
      partial.openings.push({
        mark: o.mark || "", category: o.category || "door", width: o.width || 3, height: o.height || 6.67,
        quantity: 1, headerSize: null, headerCount: 2, trimmerStuds: 2, kingStuds: 2, crippleStuds: 2,
        sillHeight: o.category === "window" ? 3 : 0, wallType: o.wallType || null, type: "", notes: "",
      });
    }
  }
  return partial;
}

export function mapSectionDetailAiResult(aiResult) {
  const partial = { structuralMembers: [], steelMembers: [], hardware: [], specOverrides: {} };
  if (aiResult.members) {
    for (const m of aiResult.members) {
      partial.structuralMembers.push({ type: m.type || "unknown", size: m.size || "", span: null, location: m.description || "" });
      if (m.type === "stud" && m.size && m.spacing) {
        partial.specOverrides.exteriorWallStudSize = m.size.toLowerCase();
        partial.specOverrides.exteriorWallSpacing = m.spacing;
      }
      if (m.type === "joist" && m.size && m.spacing) {
        partial.specOverrides.floorJoistSize = m.size.toLowerCase();
        partial.specOverrides.floorJoistSpacing = m.spacing;
      }
      if (m.type === "rafter" && m.size && m.spacing) {
        partial.specOverrides.rafterSize = m.size.toLowerCase();
        partial.specOverrides.rafterSpacing = m.spacing;
      }
    }
  }
  if (aiResult.steelMembers) {
    for (const s of aiResult.steelMembers) {
      partial.steelMembers.push({ type: s.type || "beam", shape: s.shape || "", span: null, location: s.description || "" });
    }
  }
  if (aiResult.hardware) {
    for (const h of aiResult.hardware) {
      partial.hardware.push({ type: h.type || "unknown", model: h.model || "", quantity: null, location: h.description || "" });
    }
  }
  return partial;
}

export function mapStructuralPlanAiResult(aiResult) {
  const partial = { structuralMembers: [], steelMembers: [], floorSpecs: [], hardware: [] };
  if (aiResult.beams) {
    for (const b of aiResult.beams) {
      const isSteel = /^(W|HSS|C|L)\d/i.test(b.size || "");
      if (isSteel) partial.steelMembers.push({ type: "beam", shape: b.size, span: b.span, location: b.location || "" });
      else partial.structuralMembers.push({ type: "beam", size: b.size, span: b.span, location: b.location || "" });
    }
  }
  if (aiResult.columns) {
    for (const c of aiResult.columns) {
      const isSteel = /^(W|HSS|C|L)\d/i.test(c.size || "");
      if (isSteel) partial.steelMembers.push({ type: "column", shape: c.size, height: c.height, location: c.location || "" });
      else partial.structuralMembers.push({ type: "column", size: c.size, span: c.height, location: c.location || "" });
    }
  }
  if (aiResult.joists) {
    for (const j of aiResult.joists) {
      partial.floorSpecs.push({ area: j.area || "Floor", joistSize: j.size, spacing: j.spacing, span: j.span, width: null });
    }
  }
  if (aiResult.hardware) {
    for (const h of aiResult.hardware) {
      partial.hardware.push({ type: h.type || "hanger", model: h.model || "", size: h.size || null, quantity: h.quantity || null });
    }
  }
  return partial;
}

export function mapRoofPlanAiResult(aiResult) {
  const partial = { roofSpecs: [] };
  if (aiResult.sections) {
    for (const s of aiResult.sections) {
      partial.roofSpecs.push({
        section: s.name || "Roof", rafterSize: s.rafterSize || "2x8", spacing: s.rafterSpacing || 24,
        pitch: s.pitch || "6/12", ridgeLength: s.ridgeLength || 0, span: s.span || 0,
      });
    }
  }
  return partial;
}

export function mapElevationAiResult(aiResult) {
  const partial = { specOverrides: {}, warnings: [] };
  if (aiResult.pitches) {
    for (const p of aiResult.pitches) {
      if (p.value) partial.specOverrides.roofPitch = p.value;
    }
  }
  return partial;
}

export function mapAiResult(aiResult, pageType, pageNum) {
  switch (pageType) {
    case "FLOOR_PLAN": return mapFloorPlanAiResult(aiResult, pageNum);
    case "SECTION_DETAIL": return mapSectionDetailAiResult(aiResult);
    case "STRUCTURAL_PLAN": return mapStructuralPlanAiResult(aiResult);
    case "ROOF_PLAN": return mapRoofPlanAiResult(aiResult);
    case "ELEVATION": return mapElevationAiResult(aiResult);
    default: return {};
  }
}

export const AI_PAGE_TYPES = ["FLOOR_PLAN", "SECTION_DETAIL", "STRUCTURAL_PLAN", "ROOF_PLAN", "ELEVATION"];
