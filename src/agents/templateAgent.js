/**
 * Template Agent — builds feature vectors from completed projects
 * and suggests templates for new projects based on similarity.
 */
import { getAllProjectProfiles, saveProjectProfile } from "./agentStore";

// Feature weights for similarity calculation
const FEATURE_WEIGHTS = {
  totalWallLF: 0.25,
  wallCount: 0.10,
  avgWallLength: 0.15,
  totalFloorSF: 0.20,
  totalRoofSF: 0.15,
  openingCount: 0.05,
  studSize_2x6: 0.05, // boolean: 1 if 2x6, 0 if 2x4
  markupPercent: 0.05,
};

/**
 * Extract a feature vector from a project's saved state.
 */
export function extractFeatures(projectData) {
  const features = {
    totalWallLF: 0,
    wallCount: 0,
    avgWallLength: 0,
    totalFloorSF: 0,
    totalRoofSF: 0,
    openingCount: 0,
    studSize_2x6: 0,
    markupPercent: 15,
  };

  if (projectData.wallState?.walls) {
    const walls = projectData.wallState.walls.filter((w) => w.length > 0);
    features.wallCount = walls.length;
    features.totalWallLF = walls.reduce((s, w) => s + (w.length || 0), 0);
    features.avgWallLength = walls.length > 0 ? features.totalWallLF / walls.length : 0;
    features.openingCount = walls.reduce((s, w) => s + (w.openings || 0), 0);
  }
  if (projectData.wallState?.settings?.studSize === "2x6") {
    features.studSize_2x6 = 1;
  }
  if (projectData.floorState?.areas) {
    const areas = projectData.floorState.areas.filter((a) => a.span > 0 && a.width > 0);
    features.totalFloorSF = areas.reduce((s, a) => s + (a.span || 0) * (a.width || 0), 0);
  }
  if (projectData.roofState?.sections) {
    const secs = projectData.roofState.sections.filter((s) => s.ridgeLength > 0 && s.span > 0);
    features.totalRoofSF = secs.reduce((s, sec) => s + (sec.ridgeLength || 0) * (sec.span || 0), 0);
  }
  if (projectData.bidState?.markupPercent) {
    features.markupPercent = projectData.bidState.markupPercent;
  }

  return features;
}

/**
 * Save a project's feature profile after it's completed/archived.
 */
export async function saveCompletedProfile(projectId, projectData) {
  const features = extractFeatures(projectData);
  const finalSettings = {
    wall: projectData.wallState?.settings || {},
    floor: projectData.floorState?.settings || {},
    roof: projectData.roofState?.settings || {},
    bid: { markupPercent: projectData.bidState?.markupPercent || 15 },
  };

  await saveProjectProfile({
    projectId,
    features,
    finalSettings,
    savedAt: Date.now(),
    name: projectData.name || "Unknown",
  });
}

/**
 * Weighted Euclidean distance between two feature vectors.
 * Features are normalized by typical ranges before comparison.
 */
const NORMALIZATION = {
  totalWallLF: 500, // typical range 0-500 LF
  wallCount: 20,
  avgWallLength: 50,
  totalFloorSF: 5000,
  totalRoofSF: 5000,
  openingCount: 30,
  studSize_2x6: 1,
  markupPercent: 30,
};

function similarity(featuresA, featuresB) {
  let sumSqDiff = 0;
  let totalWeight = 0;
  for (const [key, weight] of Object.entries(FEATURE_WEIGHTS)) {
    const norm = NORMALIZATION[key] || 1;
    const a = (featuresA[key] || 0) / norm;
    const b = (featuresB[key] || 0) / norm;
    sumSqDiff += weight * (a - b) ** 2;
    totalWeight += weight;
  }
  // Convert distance to similarity score (1 = identical, 0 = very different)
  const distance = Math.sqrt(sumSqDiff / totalWeight);
  return Math.max(0, 1 - distance);
}

/**
 * Find similar past projects and return their profiles sorted by similarity.
 */
export async function findSimilarProjects(currentFeatures, maxResults = 5) {
  const profiles = await getAllProjectProfiles();
  if (profiles.length === 0) return [];

  const scored = profiles.map((p) => ({
    ...p,
    similarity: similarity(currentFeatures, p.features),
  }));

  scored.sort((a, b) => b.similarity - a.similarity);
  return scored.slice(0, maxResults);
}

/**
 * Suggest a template for a new project based on most similar completed project.
 * Returns { template, similarity, sourceName } or null if no good match.
 */
export async function suggestTemplate(partialFeatures) {
  const similar = await findSimilarProjects(partialFeatures || {}, 1);
  if (similar.length === 0 || similar[0].similarity < 0.3) return null;

  const best = similar[0];
  return {
    template: best.finalSettings,
    similarity: best.similarity,
    sourceName: best.name,
    sourceId: best.projectId,
  };
}
