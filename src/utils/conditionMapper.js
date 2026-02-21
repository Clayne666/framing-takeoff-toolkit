/**
 * Condition Mapper — converts takeoff conditions + measurements
 * into the import data format expected by the calculators.
 */

/**
 * Build wall import data from linear conditions tagged "wall".
 * Returns { walls, settingsOverrides } matching WallTakeoff importData format.
 */
export function buildWallImportFromConditions(conditions, measurements) {
  const wallConditions = conditions.filter((c) => c.targetCalculator === "wall" && c.type === "linear");
  if (wallConditions.length === 0) return null;

  const walls = wallConditions.map((c) => {
    const ms = measurements.filter((m) => m.conditionId === c.id);
    const totalFeet = ms.reduce((s, m) => s + m.feet, 0);

    return {
      id: c.id,
      name: c.name,
      type: c.wallType || "Exterior",
      length: Math.round(totalFeet * 10) / 10,
      height: 8,
      openings: 0, // Will be updated by count conditions below
    };
  });

  // Apply count conditions to update opening counts on matching walls
  const countConditions = conditions.filter((c) => c.targetCalculator === "wall" && c.type === "count");
  for (const cc of countConditions) {
    const countMs = measurements.filter((m) => m.conditionId === cc.id);
    const count = countMs.length;
    // Distribute openings across walls proportionally to length
    if (walls.length > 0 && count > 0) {
      const totalLF = walls.reduce((s, w) => s + w.length, 0);
      for (const wall of walls) {
        wall.openings += Math.round((wall.length / totalLF) * count);
      }
    }
  }

  return { walls, settingsOverrides: {} };
}

/**
 * Build floor import data from area conditions tagged "floor".
 * Returns { areas, settingsOverrides } matching FloorTakeoff importData format.
 */
export function buildFloorImportFromConditions(conditions, measurements) {
  const floorConditions = conditions.filter((c) => c.targetCalculator === "floor" && c.type === "area");
  if (floorConditions.length === 0) return null;

  const areas = floorConditions.map((c) => {
    const ms = measurements.filter((m) => m.conditionId === c.id);
    const totalSqFt = ms.reduce((s, m) => s + m.sqft, 0);
    // Approximate as square for span/width
    const side = Math.sqrt(totalSqFt);

    return {
      id: c.id,
      name: c.name,
      span: Math.round(side * 10) / 10,
      width: Math.round(side * 10) / 10,
    };
  });

  return { areas, settingsOverrides: {} };
}

/**
 * Build roof import data from area conditions tagged "roof".
 * Returns { sections, settingsOverrides } matching RoofTakeoff importData format.
 */
export function buildRoofImportFromConditions(conditions, measurements) {
  const roofConditions = conditions.filter((c) => c.targetCalculator === "roof");
  if (roofConditions.length === 0) return null;

  const sections = [];

  // Area conditions -> roof sections
  const areaConditions = roofConditions.filter((c) => c.type === "area");
  for (const c of areaConditions) {
    const ms = measurements.filter((m) => m.conditionId === c.id);
    const totalSqFt = ms.reduce((s, m) => s + m.sqft, 0);
    const side = Math.sqrt(totalSqFt);

    sections.push({
      id: c.id,
      name: c.name,
      ridgeLength: Math.round(side * 10) / 10,
      span: Math.round(side * 10) / 10,
    });
  }

  // Linear conditions -> use as ridge length
  const linearConditions = roofConditions.filter((c) => c.type === "linear");
  for (const c of linearConditions) {
    const ms = measurements.filter((m) => m.conditionId === c.id);
    const totalFeet = ms.reduce((s, m) => s + m.feet, 0);

    sections.push({
      id: c.id,
      name: c.name,
      ridgeLength: Math.round(totalFeet * 10) / 10,
      span: 0, // User needs to set span manually
    });
  }

  return { sections, settingsOverrides: {} };
}

/**
 * Build all import data from conditions + measurements.
 */
export function buildAllImportsFromConditions(conditions, measurements) {
  return {
    wallImport: buildWallImportFromConditions(conditions, measurements),
    floorImport: buildFloorImportFromConditions(conditions, measurements),
    roofImport: buildRoofImportFromConditions(conditions, measurements),
  };
}
