/**
 * Smart Defaults Agent — replaces hardcoded calculator defaults
 * with learned values when confidence is sufficient.
 *
 * When confidence >= 0.6, auto-applies. When >= 0.8, does it silently.
 * When the agent is highly confident, it also pre-populates wall rows,
 * effectively starting the takeoff automatically.
 */
import { getLearnedDefaultsMap } from "./learningEngine";
import { getObservations } from "./agentStore";

// Hardcoded fallback defaults (same as projectStore.js)
const FALLBACK_WALL = { studSpacing: 16, studSize: "2x4", studWaste: 10, sheathingWaste: 8 };
const FALLBACK_FLOOR = { joistSpacing: 16, joistSize: "2x10", wastePercent: 10 };
const FALLBACK_ROOF = { rafterSpacing: 24, rafterSize: "2x8", pitch: "6/12", wastePercent: 10, sheathingWaste: 8 };
const FALLBACK_BID = { markupPercent: 15 };

function applyDefaults(fallback, learned) {
  const settings = { ...fallback };
  const meta = {}; // { key: { source, confidence, action } }

  for (const [key, val] of Object.entries(fallback)) {
    meta[key] = { source: "default", confidence: 0, action: "none" };
  }

  for (const [key, info] of Object.entries(learned)) {
    if (info.action === "auto" || info.action === "silent") {
      // Apply learned value
      const parsed = typeof fallback[key] === "number" ? +info.value : info.value;
      if (!isNaN(parsed) || typeof fallback[key] === "string") {
        settings[key] = typeof fallback[key] === "number" ? +info.value : info.value;
        meta[key] = { source: "learned", confidence: info.confidence, action: info.action, observationCount: info.observationCount };
      }
    } else if (info.action === "suggest") {
      // Don't apply but record suggestion
      meta[key] = { source: "suggested", confidence: info.confidence, action: info.action, suggestedValue: info.value, observationCount: info.observationCount };
    }
  }

  return { settings, meta };
}

export async function getSmartWallDefaults() {
  const learned = await getLearnedDefaultsMap("wall");
  return applyDefaults(FALLBACK_WALL, learned);
}

export async function getSmartFloorDefaults() {
  const learned = await getLearnedDefaultsMap("floor");
  return applyDefaults(FALLBACK_FLOOR, learned);
}

export async function getSmartRoofDefaults() {
  const learned = await getLearnedDefaultsMap("roof");
  return applyDefaults(FALLBACK_ROOF, learned);
}

export async function getSmartBidDefaults() {
  const learned = await getLearnedDefaultsMap("bid");
  return applyDefaults(FALLBACK_BID, learned);
}

/**
 * Auto-takeoff: when the agent is confident enough, it generates
 * wall rows based on learned patterns from past projects.
 * Returns wall rows the agent thinks should exist, or empty array
 * if not confident enough.
 */
export async function suggestAutoWalls() {
  const wallEntries = await getObservations({ type: "wall_entry" });
  if (wallEntries.length < 8) return []; // Not enough data

  // Analyze wall patterns: typical exterior wall count and average lengths
  const extWalls = wallEntries.filter((w) => w.wallType === "Exterior");
  const intWalls = wallEntries.filter((w) => w.wallType === "Interior");

  if (extWalls.length < 4) return [];

  // Group by approximate length to find common wall sizes
  const lengthBuckets = {};
  for (const w of extWalls) {
    const bucket = Math.round(w.length / 2) * 2; // Round to nearest 2'
    if (!lengthBuckets[bucket]) lengthBuckets[bucket] = { count: 0, totalLen: 0, totalOpenings: 0, totalHeight: 0 };
    lengthBuckets[bucket].count++;
    lengthBuckets[bucket].totalLen += w.length;
    lengthBuckets[bucket].totalOpenings += w.openings;
    lengthBuckets[bucket].totalHeight += w.height;
  }

  // Find the most common configuration (at least 3 projects worth)
  const buckets = Object.entries(lengthBuckets).filter(([, b]) => b.count >= 3).sort((a, b) => b[1].count - a[1].count);
  if (buckets.length < 2) return []; // Need at least 2 common wall sizes

  // This is a suggestion — the agent populates a starting template
  // User can always edit. We mark these as agent-generated.
  const suggestions = [];
  const directions = ["North", "South", "East", "West"];
  for (let i = 0; i < Math.min(buckets.length, 4); i++) {
    const [bucketLen, data] = buckets[i];
    suggestions.push({
      id: Date.now() + i,
      name: directions[i] + " Ext",
      type: "Exterior",
      length: Math.round(data.totalLen / data.count),
      height: Math.round(data.totalHeight / data.count),
      openings: Math.round(data.totalOpenings / data.count),
      _agentGenerated: true,
    });
  }

  return suggestions;
}

/**
 * Get overall agent confidence level
 */
export async function getAgentConfidenceLevel() {
  const wallDefaults = await getLearnedDefaultsMap("wall");
  const floorDefaults = await getLearnedDefaultsMap("floor");
  const roofDefaults = await getLearnedDefaultsMap("roof");

  const allConfidences = [
    ...Object.values(wallDefaults).map((d) => d.confidence),
    ...Object.values(floorDefaults).map((d) => d.confidence),
    ...Object.values(roofDefaults).map((d) => d.confidence),
  ];

  if (allConfidences.length === 0) return 0;
  return allConfidences.reduce((s, c) => s + c, 0) / allConfidences.length;
}
