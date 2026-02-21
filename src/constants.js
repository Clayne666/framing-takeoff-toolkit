export const LUMBER_PRICES = {
  "2x4Stud": 4.28,
  "2x4_16ft": 10.98,
  "2x6Stud": 6.78,
  "2x6_16ft": 17.48,
  "2x8_16ft": 21.98,
  "2x10_16ft": 28.48,
  "2x12_16ft": 35.98,
  osb4x8: 14.98,
  plywood3_4: 42.98,
  hanger2x8: 2.45,
  hanger2x10: 2.85,
  hanger2x12: 3.15,
  hurricaneTie: 1.85,

  // Header lumber (per piece)
  "header_2x6": 6.78,
  "header_2x8": 8.98,
  "header_2x10": 11.48,
  "header_2x12": 14.98,
  "header_LVL_per_lf": 8.50,

  // Blocking & bridging
  "blocking_2x4": 4.28,
  "blocking_2x6": 6.78,
  "blocking_2x10": 11.48,
  metalBridging: 1.45,

  // Hold-down hardware
  holdDown_HDU2: 42.50,
  holdDown_HDU5: 68.00,
  holdDown_HDU8: 89.00,
  holdDown_PAHD: 55.00,

  // Anchors & straps
  anchorBolt: 3.85,
  strapTie_MSTA: 4.25,
  strapTie_LSTA: 5.50,
  postBase: 12.50,
  beamSeat: 18.00,

  // Steel connection hardware (per each)
  steelPlate_small: 8.50,
  steelPlate_large: 22.00,
  steelBolts_set: 3.25,
};

export const LABOR_RATES = {
  wallPerLinearFoot: 8.5,
  floorPerSquareFoot: 3.25,
  roofPerSquareFoot: 4.5,
  headerEach: 35.00,
  blockingPerLinearFoot: 2.50,
  hardwareEach: 15.00,
};

export const PITCH_FACTORS = {
  "3/12": 1.031,
  "4/12": 1.054,
  "5/12": 1.083,
  "6/12": 1.118,
  "7/12": 1.158,
  "8/12": 1.202,
  "9/12": 1.25,
  "10/12": 1.302,
  "12/12": 1.414,
};

// Waste factor for sheathing: 8% standard
export const SHEATHING_WASTE_FACTOR = 1.08;

// Standard sheet coverage: 4x8 = 32 SF
export const SHEET_COVERAGE_SF = 32;
