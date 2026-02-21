/**
 * Unified extraction data model.
 *
 * Central data structure that all specialized parsers contribute to and
 * that the takeoff tabs consume. Bridges PDF parsing → material takeoff.
 */

/**
 * Create a fresh, empty extraction result.
 */
export function createExtractionResult() {
  return {
    // Project metadata
    projectInfo: {
      name: "",
      address: "",
      architect: "",
      date: "",
    },

    // Wall type definitions from wall schedule
    wallTypes: [],
    // e.g. { type: "A", studSize: "2x6", spacing: 16, height: 9.0,
    //        sheathingType: "OSB", sheathingThickness: "1/2\"", exterior: true, notes: "" }

    // Wall segments from floor plans
    wallSegments: [],
    // e.g. { wallType: "A", length: 24.5, room: "Living Room", page: 3 }

    // Openings from door/window schedules
    openings: [],
    // e.g. { mark: "D1", category: "door", width: 3.0, height: 6.67,
    //        quantity: 3, headerSize: "2x10", headerCount: 2,
    //        trimmerStuds: 2, kingStuds: 2, crippleStuds: 4,
    //        sillHeight: null, wallType: null }

    // Floor framing specs
    floorSpecs: [],
    // e.g. { area: "Main Floor", joistSize: "2x10", spacing: 16, span: 20, width: 40 }

    // Roof framing specs
    roofSpecs: [],
    // e.g. { section: "Main Roof", rafterSize: "2x8", spacing: 24,
    //        pitch: "6/12", ridgeLength: 40, span: 28 }

    // Structural members (beams, columns, posts)
    structuralMembers: [],
    // e.g. { type: "beam", size: "LVL 3.5x11.875", span: 16, location: "Main bearing line" }

    // Steel members (for mixed wood + steel framing)
    steelMembers: [],
    // e.g. { type: "beam", shape: "W8x31", span: 20, location: "Entry header" }
    // e.g. { type: "column", shape: "HSS4x4x1/4", height: 10, location: "Lobby" }

    // Hardware
    hardware: [],
    // e.g. { type: "holdDown", model: "HDU2", quantity: 8, location: "Shear walls" }
    // e.g. { type: "hurricaneTie", model: "H2.5A", quantity: null }
    // e.g. { type: "hanger", model: "LUS210", size: "2x10", quantity: 22 }

    // Specification overrides extracted from general notes
    specOverrides: {
      exteriorWallStudSize: null,
      exteriorWallSpacing: null,
      interiorWallStudSize: null,
      interiorWallSpacing: null,
      floorJoistSize: null,
      floorJoistSpacing: null,
      rafterSize: null,
      rafterSpacing: null,
      roofPitch: null,
      wallSheathingType: null,
      wallSheathingThickness: null,
      roofSheathingType: null,
      roofSheathingThickness: null,
      subfloorType: null,
      subfloorThickness: null,
      blockingSpec: null,
    },

    // Additional framing items beyond the three main calculators
    additionalFraming: {
      blocking: [],       // { size, placement, linearFeet }
      bridging: [],       // { type, joistSize, quantity }
      rimBoard: [],       // { size, linearFeet }
      strapping: [],      // { size, linearFeet }
      fireBlocking: [],   // { linearFeet, location }
    },

    // Backward-compatible raw data (same shape as current output)
    rawDimensions: [],    // { raw, feet, type, page }
    rawFramingRefs: [],   // string[]
    rawRooms: [],         // string[]

    // Per-page classification results
    pageClassifications: [],
    // { page: 1, type: "TITLE_SHEET", confidence: 0.85 }

    // Parsing warnings for user review
    warnings: [],
    // "Wall schedule found on page 4 but some columns could not be identified"
  };
}

/**
 * Merge partial results into the extraction result, deduplicating by key.
 */
export function mergeIntoResult(result, partial) {
  for (const key of ["wallTypes", "wallSegments", "openings", "floorSpecs", "roofSpecs", "structuralMembers", "steelMembers", "hardware", "warnings"]) {
    if (partial[key]?.length) {
      result[key].push(...partial[key]);
    }
  }
  if (partial.specOverrides) {
    for (const [k, v] of Object.entries(partial.specOverrides)) {
      if (v !== null && v !== undefined) {
        result.specOverrides[k] = v;
      }
    }
  }
  if (partial.projectInfo) {
    for (const [k, v] of Object.entries(partial.projectInfo)) {
      if (v) result.projectInfo[k] = v;
    }
  }
}
