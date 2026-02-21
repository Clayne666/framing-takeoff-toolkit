/**
 * Takeoff data mapper.
 *
 * Converts the unified extraction result into data structures that
 * the Wall, Floor, and Roof takeoff tabs can directly consume.
 */

/**
 * Build wall import data from extraction result.
 * Groups walls by type, applies spec overrides, attaches openings.
 */
export function buildWallImportData(result) {
  const walls = [];
  const specs = result.specOverrides;

  // If we have wall types from schedule, create one entry per type per segment
  if (result.wallSegments.length > 0) {
    const typeMap = {};
    for (const wt of result.wallTypes) {
      typeMap[wt.type] = wt;
    }

    // Group segments by wallType
    const groups = {};
    for (const seg of result.wallSegments) {
      const key = seg.wallType || "UNKNOWN";
      if (!groups[key]) groups[key] = { segments: [], totalLength: 0 };
      groups[key].segments.push(seg);
      groups[key].totalLength += seg.length || 0;
    }

    for (const [typeKey, group] of Object.entries(groups)) {
      const wt = typeMap[typeKey] || {};
      const isExt = wt.exterior ?? /^[AB]$|EXT/i.test(typeKey);
      const studSize = wt.studSize || (isExt ? specs.exteriorWallStudSize : specs.interiorWallStudSize) || "2x4";
      const spacing = wt.spacing || (isExt ? specs.exteriorWallSpacing : specs.interiorWallSpacing) || 16;
      const height = wt.height || 8;

      // Count openings for this wall type
      const openingCount = result.openings.filter((o) => o.wallType === typeKey).length;

      walls.push({
        id: Date.now() + walls.length,
        name: `Type ${typeKey}`,
        type: isExt ? "Exterior" : "Interior",
        length: Math.round(group.totalLength * 10) / 10,
        height,
        openings: openingCount,
        _studSize: studSize,
        _spacing: spacing,
      });
    }
  }

  // Settings overrides from extraction
  const settingsOverrides = {};
  if (specs.exteriorWallStudSize) settingsOverrides.studSize = specs.exteriorWallStudSize;
  if (specs.exteriorWallSpacing) settingsOverrides.studSpacing = specs.exteriorWallSpacing;

  return { walls, settingsOverrides };
}

/**
 * Build opening detail from extraction result for display.
 */
export function buildOpeningDetail(result) {
  return result.openings.map((o) => ({
    mark: o.mark,
    category: o.category,
    width: o.width,
    height: o.height,
    quantity: o.quantity || 1,
    headerSize: o.headerSize || "2x8",
    headerCount: o.headerCount || 2,
    trimmerStuds: o.trimmerStuds || 2,
    kingStuds: o.kingStuds || 2,
    crippleStuds: o.crippleStuds || 2,
    wallType: o.wallType,
  }));
}

/**
 * Build floor import data from extraction result.
 */
export function buildFloorImportData(result) {
  const areas = [];
  const specs = result.specOverrides;

  if (result.floorSpecs.length > 0) {
    for (const fs of result.floorSpecs) {
      areas.push({
        id: Date.now() + areas.length,
        name: fs.area || "Floor",
        span: fs.span || 0,
        width: fs.width || 0,
      });
    }
  }

  const settingsOverrides = {};
  if (specs.floorJoistSize) settingsOverrides.joistSize = specs.floorJoistSize;
  if (specs.floorJoistSpacing) settingsOverrides.joistSpacing = specs.floorJoistSpacing;

  return { areas, settingsOverrides };
}

/**
 * Build roof import data from extraction result.
 */
export function buildRoofImportData(result) {
  const sections = [];
  const specs = result.specOverrides;

  if (result.roofSpecs.length > 0) {
    for (const rs of result.roofSpecs) {
      sections.push({
        id: Date.now() + sections.length,
        name: rs.section || "Roof",
        ridgeLength: rs.ridgeLength || 0,
        span: rs.span || 0,
      });
    }
  }

  const settingsOverrides = {};
  if (specs.rafterSize) settingsOverrides.rafterSize = specs.rafterSize;
  if (specs.rafterSpacing) settingsOverrides.rafterSpacing = specs.rafterSpacing;
  if (specs.roofPitch) settingsOverrides.pitch = specs.roofPitch;

  return { sections, settingsOverrides };
}

/**
 * Build a human-readable extraction summary.
 */
export function buildExtractionSummary(result) {
  const items = [];
  if (result.wallTypes.length) items.push(`${result.wallTypes.length} wall types`);
  if (result.wallSegments.length) items.push(`${result.wallSegments.length} wall segments`);
  if (result.openings.length) items.push(`${result.openings.length} openings`);
  if (result.floorSpecs.length) items.push(`${result.floorSpecs.length} floor areas`);
  if (result.roofSpecs.length) items.push(`${result.roofSpecs.length} roof sections`);
  if (result.structuralMembers.length) items.push(`${result.structuralMembers.length} structural members`);
  if (result.steelMembers.length) items.push(`${result.steelMembers.length} steel members`);
  if (result.hardware.length) items.push(`${result.hardware.length} hardware items`);

  const specCount = Object.values(result.specOverrides).filter((v) => v !== null).length;
  if (specCount) items.push(`${specCount} spec overrides`);

  return {
    items,
    totalWallLF: result.wallSegments.reduce((s, w) => s + (w.length || 0), 0),
    totalOpenings: result.openings.reduce((s, o) => s + (o.quantity || 1), 0),
    pageCount: result.pageClassifications.length,
    warningCount: result.warnings.length,
  };
}
