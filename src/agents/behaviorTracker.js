/**
 * Behavior Tracker — observes user actions and records deltas.
 *
 * Watches for: settings changes, wall/floor/roof edits, bid adjustments,
 * scale patterns, measurement patterns. Each change is recorded as an
 * observation in the agent store.
 */
import { addObservation } from "./agentStore";

// Keys we track in each calculator's settings
const WALL_KEYS = ["studSize", "studSpacing", "studWaste", "sheathingWaste"];
const FLOOR_KEYS = ["joistSize", "joistSpacing", "wastePercent"];
const ROOF_KEYS = ["rafterSize", "rafterSpacing", "pitch", "wastePercent", "sheathingWaste"];
const BID_KEYS = ["markupPercent"];

function diffSettings(oldSettings, newSettings, keys) {
  const changes = [];
  if (!oldSettings || !newSettings) return changes;
  for (const key of keys) {
    if (oldSettings[key] !== undefined && newSettings[key] !== undefined && oldSettings[key] !== newSettings[key]) {
      changes.push({ key, oldValue: oldSettings[key], newValue: newSettings[key] });
    }
  }
  return changes;
}

/**
 * Create a behavior tracker for a project session.
 * Call track*() whenever state changes. It diffs against previous
 * snapshots and emits observations when deltas are detected.
 */
export function createBehaviorTracker(projectId) {
  let prevWallState = null;
  let prevFloorState = null;
  let prevRoofState = null;
  let prevBidState = null;
  let prevWallCount = 0;
  let prevFloorCount = 0;
  let prevRoofCount = 0;

  const emit = (type, data) => {
    addObservation({ type, projectId, ...data }).catch((err) => {
      console.warn("Agent observation failed:", err);
    });
  };

  return {
    /**
     * Called when wall state changes. Detects settings deltas and row edits.
     */
    trackWallState(state) {
      if (!state) return;

      // Settings changes
      if (prevWallState?.settings) {
        const changes = diffSettings(prevWallState.settings, state.settings, WALL_KEYS);
        for (const ch of changes) {
          emit("settings_change", {
            category: "wall",
            settingKey: ch.key,
            systemValue: ch.oldValue,
            userValue: ch.newValue,
          });
        }
      }

      // Row additions/removals
      const wallCount = state.walls?.length || 0;
      if (prevWallCount > 0 && wallCount !== prevWallCount) {
        emit("row_change", {
          category: "wall",
          oldCount: prevWallCount,
          newCount: wallCount,
        });
      }

      // Track wall length patterns (for smart defaults)
      if (state.walls?.length > prevWallCount) {
        const newWalls = state.walls.slice(prevWallCount);
        for (const w of newWalls) {
          if (w.length > 0) {
            emit("wall_entry", {
              category: "wall",
              wallType: w.type,
              length: w.length,
              height: w.height,
              openings: w.openings,
            });
          }
        }
      }

      prevWallState = JSON.parse(JSON.stringify(state));
      prevWallCount = wallCount;
    },

    trackFloorState(state) {
      if (!state) return;
      if (prevFloorState?.settings) {
        const changes = diffSettings(prevFloorState.settings, state.settings, FLOOR_KEYS);
        for (const ch of changes) {
          emit("settings_change", { category: "floor", settingKey: ch.key, systemValue: ch.oldValue, userValue: ch.newValue });
        }
      }
      const count = state.areas?.length || 0;
      if (prevFloorCount > 0 && count !== prevFloorCount) {
        emit("row_change", { category: "floor", oldCount: prevFloorCount, newCount: count });
      }
      prevFloorState = JSON.parse(JSON.stringify(state));
      prevFloorCount = count;
    },

    trackRoofState(state) {
      if (!state) return;
      if (prevRoofState?.settings) {
        const changes = diffSettings(prevRoofState.settings, state.settings, ROOF_KEYS);
        for (const ch of changes) {
          emit("settings_change", { category: "roof", settingKey: ch.key, systemValue: ch.oldValue, userValue: ch.newValue });
        }
      }
      const count = state.sections?.length || 0;
      if (prevRoofCount > 0 && count !== prevRoofCount) {
        emit("row_change", { category: "roof", oldCount: prevRoofCount, newCount: count });
      }
      prevRoofState = JSON.parse(JSON.stringify(state));
      prevRoofCount = count;
    },

    trackBidState(state) {
      if (!state) return;
      if (prevBidState) {
        const changes = diffSettings(prevBidState, state, BID_KEYS);
        for (const ch of changes) {
          emit("settings_change", { category: "bid", settingKey: ch.key, systemValue: ch.oldValue, userValue: ch.newValue });
        }
        // Track extras cost patterns
        if (state.extras && prevBidState.extras) {
          for (const ext of state.extras) {
            const prev = prevBidState.extras.find((e) => e.name === ext.name);
            if (prev && prev.cost !== ext.cost && ext.cost > 0) {
              emit("bid_extra", { category: "bid", extraName: ext.name, oldCost: prev.cost, newCost: ext.cost });
            }
          }
        }
      }
      prevBidState = JSON.parse(JSON.stringify(state));
    },

    /**
     * Track scale calibration pattern
     */
    trackScale(scalePixels, scaleFeet) {
      if (scalePixels > 0 && scaleFeet > 0) {
        emit("scale_set", { category: "scale", pixelsPerFoot: scalePixels / scaleFeet, scaleFeet });
      }
    },

    /**
     * Initialize from saved state (so first change is relative to saved data)
     */
    initFromState({ wallState, floorState, roofState, bidState } = {}) {
      if (wallState) {
        prevWallState = JSON.parse(JSON.stringify(wallState));
        prevWallCount = wallState.walls?.length || 0;
      }
      if (floorState) {
        prevFloorState = JSON.parse(JSON.stringify(floorState));
        prevFloorCount = floorState.areas?.length || 0;
      }
      if (roofState) {
        prevRoofState = JSON.parse(JSON.stringify(roofState));
        prevRoofCount = roofState.sections?.length || 0;
      }
      if (bidState) {
        prevBidState = JSON.parse(JSON.stringify(bidState));
      }
    },
  };
}
