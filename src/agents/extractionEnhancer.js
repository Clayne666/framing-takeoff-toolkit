/**
 * Extraction Enhancer — post-corrects extraction pipeline results
 * using learned patterns and enriches AI prompts with context.
 */
import { getAllPreferences } from "./agentStore";
import { getLearnedDefaultsMap } from "./learningEngine";

/**
 * Post-process extraction result using learned preferences.
 * Adjusts spec overrides and wall segment data based on what
 * the user typically corrects.
 */
export async function enhanceExtractionResult(result) {
  if (!result) return result;

  const enhanced = JSON.parse(JSON.stringify(result));
  const wallPrefs = await getLearnedDefaultsMap("wall");
  const floorPrefs = await getLearnedDefaultsMap("floor");
  const roofPrefs = await getLearnedDefaultsMap("roof");

  // If extraction found no spec overrides but we have learned defaults,
  // inject them as agent-suggested overrides
  if (!enhanced.specOverrides) enhanced.specOverrides = {};

  // Wall stud size — if user always changes it, pre-apply
  if (wallPrefs.studSize?.action === "auto" || wallPrefs.studSize?.action === "silent") {
    if (!enhanced.specOverrides.exteriorWallStudSize) {
      enhanced.specOverrides.exteriorWallStudSize = wallPrefs.studSize.value;
      enhanced._agentEnhanced = true;
    }
  }
  if (wallPrefs.studSpacing?.action === "auto" || wallPrefs.studSpacing?.action === "silent") {
    if (!enhanced.specOverrides.exteriorWallSpacing) {
      enhanced.specOverrides.exteriorWallSpacing = +wallPrefs.studSpacing.value;
      enhanced._agentEnhanced = true;
    }
  }

  // Floor joists
  if (floorPrefs.joistSize?.action === "auto" || floorPrefs.joistSize?.action === "silent") {
    if (!enhanced.specOverrides.floorJoistSize) {
      enhanced.specOverrides.floorJoistSize = floorPrefs.joistSize.value;
      enhanced._agentEnhanced = true;
    }
  }
  if (floorPrefs.joistSpacing?.action === "auto" || floorPrefs.joistSpacing?.action === "silent") {
    if (!enhanced.specOverrides.floorJoistSpacing) {
      enhanced.specOverrides.floorJoistSpacing = +floorPrefs.joistSpacing.value;
      enhanced._agentEnhanced = true;
    }
  }

  // Roof
  if (roofPrefs.rafterSize?.action === "auto" || roofPrefs.rafterSize?.action === "silent") {
    if (!enhanced.specOverrides.rafterSize) {
      enhanced.specOverrides.rafterSize = roofPrefs.rafterSize.value;
      enhanced._agentEnhanced = true;
    }
  }
  if (roofPrefs.pitch?.action === "auto" || roofPrefs.pitch?.action === "silent") {
    if (!enhanced.specOverrides.roofPitch) {
      enhanced.specOverrides.roofPitch = roofPrefs.pitch.value;
      enhanced._agentEnhanced = true;
    }
  }

  return enhanced;
}

/**
 * Build additional context string to append to AI Vision prompts.
 * Tells Claude what the user's typical project looks like so it
 * can better interpret ambiguous plan details.
 */
export async function buildAiContext() {
  const allPrefs = await getAllPreferences();
  if (allPrefs.length === 0) return "";

  const lines = ["The user typically works with these specifications:"];

  for (const pref of allPrefs) {
    if (pref.confidence < 0.4) continue; // Only include reasonably confident data
    const label = pref.key.replace(/\./g, " > ").replace(/([A-Z])/g, " $1");
    lines.push(`- ${label}: ${pref.learnedValue} (seen in ${pref.observationCount} projects)`);
  }

  if (lines.length === 1) return ""; // No confident preferences
  lines.push("Use these as context when interpreting ambiguous dimensions or specifications.");
  return "\n\n" + lines.join("\n");
}
