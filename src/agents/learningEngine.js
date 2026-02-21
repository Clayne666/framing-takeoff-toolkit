/**
 * Learning Engine — aggregates observations into preferences with
 * confidence scoring. Processes raw behavior data into actionable
 * learned defaults.
 *
 * Confidence = frequency(0.3) + consistency(0.5) + recency(0.2)
 *   - frequency: log2(count)/log2(20) capped at 1.0 (saturates ~20 obs)
 *   - consistency: fraction of observations matching the most common value
 *   - recency: exponential decay, 90-day half-life from most recent obs
 *
 * Thresholds:
 *   < 0.3  = no action (not enough data)
 *   0.3-0.6 = suggest to user (show as suggested default)
 *   0.6-0.8 = auto-apply with "Learned" badge
 *   > 0.8  = silent auto-apply
 */
import { getObservations, setPreference, getAllPreferences } from "./agentStore";

const RECENCY_HALF_LIFE_MS = 90 * 24 * 60 * 60 * 1000; // 90 days

function computeConfidence(observations) {
  if (observations.length === 0) return { confidence: 0, learnedValue: null, distribution: {} };

  // Count value frequencies
  const valueCounts = {};
  for (const obs of observations) {
    const val = String(obs.userValue);
    valueCounts[val] = (valueCounts[val] || 0) + 1;
  }

  // Most common value
  let topValue = null;
  let topCount = 0;
  for (const [val, count] of Object.entries(valueCounts)) {
    if (count > topCount) { topCount = count; topValue = val; }
  }

  const n = observations.length;

  // Frequency factor: log2(n) / log2(20), capped at 1.0
  const frequency = Math.min(Math.log2(Math.max(n, 1)) / Math.log2(20), 1.0);

  // Consistency: fraction matching top value
  const consistency = topCount / n;

  // Recency: exponential decay from most recent observation
  const now = Date.now();
  const mostRecent = Math.max(...observations.map((o) => o.timestamp));
  const age = now - mostRecent;
  const recency = Math.pow(0.5, age / RECENCY_HALF_LIFE_MS);

  const confidence = frequency * 0.3 + consistency * 0.5 + recency * 0.2;

  // Try to parse as number if possible
  let learnedValue = topValue;
  const asNum = +topValue;
  if (!isNaN(asNum) && topValue !== "") learnedValue = asNum;

  return { confidence, learnedValue, distribution: valueCounts, observationCount: n, consistencyRate: consistency };
}

/**
 * Process all observations and update preferences.
 * Call periodically or after a batch of new observations.
 */
export async function processObservations() {
  const allObs = await getObservations({ type: "settings_change" });

  // Group by category + settingKey
  const groups = {};
  for (const obs of allObs) {
    const key = `${obs.category}.settings.${obs.settingKey}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(obs);
  }

  // Compute and store preferences
  const preferences = [];
  for (const [key, observations] of Object.entries(groups)) {
    const result = computeConfidence(observations);
    const pref = {
      key,
      category: observations[0].category,
      learnedValue: result.learnedValue,
      confidence: result.confidence,
      observationCount: result.observationCount,
      consistencyRate: result.consistencyRate,
      valueDistribution: result.distribution,
      updatedAt: Date.now(),
    };
    await setPreference(pref);
    preferences.push(pref);
  }

  // Also process bid extras patterns
  const bidExtras = await getObservations({ type: "bid_extra" });
  const extraGroups = {};
  for (const obs of bidExtras) {
    const key = `bid.extras.${obs.extraName}`;
    if (!extraGroups[key]) extraGroups[key] = [];
    extraGroups[key].push({ ...obs, userValue: obs.newCost });
  }
  for (const [key, observations] of Object.entries(extraGroups)) {
    const result = computeConfidence(observations);
    await setPreference({
      key,
      category: "bid",
      learnedValue: result.learnedValue,
      confidence: result.confidence,
      observationCount: result.observationCount,
      consistencyRate: result.consistencyRate,
      valueDistribution: result.distribution,
      updatedAt: Date.now(),
    });
  }

  return preferences;
}

/**
 * Get learned defaults for a specific calculator, organized by setting key.
 * Returns { [settingKey]: { value, confidence, observationCount, action } }
 * where action = "none" | "suggest" | "auto" | "silent"
 */
export async function getLearnedDefaultsMap(category) {
  const allPrefs = await getAllPreferences();
  const prefix = category + ".settings.";
  const result = {};

  for (const pref of allPrefs) {
    if (!pref.key.startsWith(prefix)) continue;
    const settingKey = pref.key.slice(prefix.length);
    let action = "none";
    if (pref.confidence >= 0.8) action = "silent";
    else if (pref.confidence >= 0.6) action = "auto";
    else if (pref.confidence >= 0.3) action = "suggest";

    result[settingKey] = {
      value: pref.learnedValue,
      confidence: pref.confidence,
      observationCount: pref.observationCount,
      consistencyRate: pref.consistencyRate,
      action,
    };
  }
  return result;
}

/**
 * Get all learned preferences grouped by category
 */
export async function getAllLearnedDefaults() {
  const allPrefs = await getAllPreferences();
  const byCategory = {};
  for (const pref of allPrefs) {
    if (!byCategory[pref.category]) byCategory[pref.category] = [];
    let action = "none";
    if (pref.confidence >= 0.8) action = "silent";
    else if (pref.confidence >= 0.6) action = "auto";
    else if (pref.confidence >= 0.3) action = "suggest";
    byCategory[pref.category].push({ ...pref, action });
  }
  return byCategory;
}
