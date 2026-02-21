/**
 * Page classification engine.
 *
 * Uses weighted keyword scoring to classify each PDF page by its
 * construction drawing type, enabling specialized parsers per page.
 */

import { parseDimensions, parseRooms } from "./parsers";

const PAGE_TYPES = [
  "TITLE_SHEET",
  "SITE_PLAN",
  "FLOOR_PLAN",
  "ELEVATION",
  "SECTION_DETAIL",
  "WALL_SCHEDULE",
  "DOOR_WINDOW_SCHEDULE",
  "STRUCTURAL_PLAN",
  "ROOF_PLAN",
  "GENERAL_NOTES",
];

/**
 * Classify a single page's spatial data into a drawing type.
 *
 * @param {object} spatialData – output from extractSpatialText()
 * @returns {{ type: string, confidence: number, scores: object }}
 */
export function classifyPage(spatialData) {
  const text = spatialData.rawText.toLowerCase();
  const textLength = text.length;
  const tableCount = spatialData.tables.length;
  const dimCount = parseDimensions(spatialData.rawText).length;
  const roomCount = parseRooms(spatialData.rawText).length;

  const scores = {};

  // --- TITLE SHEET ---
  scores.TITLE_SHEET = 0;
  if (/sheet\s*index|cover\s*sheet|project\s*(info|data)|table\s*of\s*contents/i.test(text)) scores.TITLE_SHEET += 50;
  if (/code\s*compliance|jurisdiction|permit|zoning/i.test(text)) scores.TITLE_SHEET += 20;
  if (/architect|engineer|owner|contractor|drawn\s*by/i.test(text)) scores.TITLE_SHEET += 15;
  if (dimCount < 3 && textLength > 200) scores.TITLE_SHEET += 10;

  // --- SITE PLAN ---
  scores.SITE_PLAN = 0;
  if (/site\s*plan|grading\s*plan/i.test(text)) scores.SITE_PLAN += 50;
  if (/setback|easement|property\s*line|lot\s*line|topograph/i.test(text)) scores.SITE_PLAN += 25;
  if (/parking|driveway|sidewalk|curb/i.test(text)) scores.SITE_PLAN += 10;

  // --- FLOOR PLAN ---
  scores.FLOOR_PLAN = 0;
  if (/floor\s*plan|first\s*floor|second\s*floor|main\s*level|ground\s*floor|upper\s*level|lower\s*level/i.test(text)) scores.FLOOR_PLAN += 40;
  if (roomCount > 2) scores.FLOOR_PLAN += 25;
  if (dimCount > 8) scores.FLOOR_PLAN += 15;
  if (/[A-Z]\d{3}|rm[\s-]?\d+/i.test(text)) scores.FLOOR_PLAN += 10; // room numbers

  // --- ELEVATION ---
  scores.ELEVATION = 0;
  if (/(?:north|south|east|west|front|rear|left|right)\s*elevation/i.test(text)) scores.ELEVATION += 50;
  if (/exterior\s*elevation|building\s*elevation/i.test(text)) scores.ELEVATION += 40;
  if (/finish\s*grade|roof\s*line|eave|fascia|soffit/i.test(text)) scores.ELEVATION += 15;

  // --- SECTION DETAIL ---
  scores.SECTION_DETAIL = 0;
  if (/(?:wall|building|typical)\s*section|section\s*detail|detail\s*\d/i.test(text)) scores.SECTION_DETAIL += 40;
  if (/typ(?:ical)?\s*(?:wall|floor|roof)\s*(?:section|detail|assembly)/i.test(text)) scores.SECTION_DETAIL += 35;
  if (/2x\d+.*@|plate|header|joist|rafter|rim\s*board/i.test(text)) scores.SECTION_DETAIL += 15;
  if (/insulation|vapor\s*barrier|sheathing|drywall|gypsum/i.test(text)) scores.SECTION_DETAIL += 10;

  // --- WALL SCHEDULE ---
  scores.WALL_SCHEDULE = 0;
  if (/wall\s*schedule|wall\s*type\s*schedule/i.test(text)) scores.WALL_SCHEDULE += 55;
  if (tableCount > 0 && /type.*stud|stud.*spacing|framing.*height/i.test(text)) scores.WALL_SCHEDULE += 35;
  spatialData.tables.forEach((t) => {
    const header = (t.headerRow || []).join(" ").toLowerCase();
    if (/type/.test(header) && (/stud|height|spacing|framing/.test(header))) scores.WALL_SCHEDULE += 30;
  });

  // --- DOOR / WINDOW SCHEDULE ---
  scores.DOOR_WINDOW_SCHEDULE = 0;
  if (/door\s*schedule|window\s*schedule/i.test(text)) scores.DOOR_WINDOW_SCHEDULE += 55;
  if (/[dw]\d{1,3}/i.test(text) && tableCount > 0) scores.DOOR_WINDOW_SCHEDULE += 25;
  spatialData.tables.forEach((t) => {
    const header = (t.headerRow || []).join(" ").toLowerCase();
    if (/mark|size|type|qty|width|height|frame/.test(header)) scores.DOOR_WINDOW_SCHEDULE += 20;
  });
  if (/header|rough\s*opening|r\.?o\.?|frame\s*type|glazing/i.test(text)) scores.DOOR_WINDOW_SCHEDULE += 10;

  // --- STRUCTURAL PLAN ---
  scores.STRUCTURAL_PLAN = 0;
  if (/structural\s*(plan|framing|layout)|framing\s*plan|foundation\s*plan/i.test(text)) scores.STRUCTURAL_PLAN += 45;
  if (/beam\s*schedule|column\s*schedule|lintel\s*schedule/i.test(text)) scores.STRUCTURAL_PLAN += 35;
  if (/lvl|glulam|psf|point\s*load|w\d+x\d+|hss\d/i.test(text)) scores.STRUCTURAL_PLAN += 20;
  if (/footing|pier|foundation|stem\s*wall/i.test(text)) scores.STRUCTURAL_PLAN += 10;

  // --- ROOF PLAN ---
  scores.ROOF_PLAN = 0;
  if (/roof\s*(plan|framing)|roof\s*framing\s*plan/i.test(text)) scores.ROOF_PLAN += 50;
  if (/ridge|hip|valley|rafter\s*layout|eave|overhang/i.test(text)) scores.ROOF_PLAN += 20;
  if (/pitch|slope|truss\s*layout|truss\s*plan/i.test(text)) scores.ROOF_PLAN += 15;

  // --- GENERAL NOTES ---
  scores.GENERAL_NOTES = 0;
  if (/general\s*notes|structural\s*notes|framing\s*notes|construction\s*notes/i.test(text)) scores.GENERAL_NOTES += 55;
  if (/specification|all\s+(?:exterior|interior)\s+walls?\s+shall/i.test(text)) scores.GENERAL_NOTES += 20;
  if (textLength > 2000 && dimCount < 8 && tableCount === 0) scores.GENERAL_NOTES += 15;

  // Pick the winner
  const entries = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const best = entries[0];
  const maxScore = best[1];
  const totalPositive = entries.reduce((s, e) => s + Math.max(0, e[1]), 0);
  const confidence = totalPositive > 0 ? maxScore / totalPositive : 0;

  return {
    type: maxScore >= 15 ? best[0] : "UNKNOWN",
    confidence: Math.min(confidence, 1),
    scores,
  };
}
