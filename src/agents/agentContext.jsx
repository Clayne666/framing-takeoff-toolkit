/**
 * Agent Context — React Context + Provider for the learning agent system.
 *
 * Provides:
 * - useAgent() hook for accessing tracker, learning engine, smart defaults
 * - useSmartDefaults(category) hook for calculator defaults
 * - AgentProvider wraps the app and manages the tracker lifecycle
 */
import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { createBehaviorTracker } from "./behaviorTracker";
import { processObservations, getLearnedDefaultsMap, getAllLearnedDefaults } from "./learningEngine";
import { getSmartWallDefaults, getSmartFloorDefaults, getSmartRoofDefaults, getSmartBidDefaults, suggestAutoWalls, getAgentConfidenceLevel } from "./smartDefaultsAgent";
import { enhanceExtractionResult, buildAiContext } from "./extractionEnhancer";
import { suggestTemplate, saveCompletedProfile, extractFeatures } from "./templateAgent";
import { getObservationCount, clearAllLearningData } from "./agentStore";

const AgentContext = createContext(null);

export function AgentProvider({ children }) {
  const [observationCount, setObservationCount] = useState(0);
  const [confidenceLevel, setConfidenceLevel] = useState(0);
  const [learnedDefaults, setLearnedDefaults] = useState({});
  const [isProcessing, setIsProcessing] = useState(false);
  const trackerRef = useRef(null);
  const processTimerRef = useRef(null);

  // Load initial stats
  useEffect(() => {
    refreshStats();
  }, []);

  const refreshStats = useCallback(async () => {
    try {
      const count = await getObservationCount();
      setObservationCount(count);
      const level = await getAgentConfidenceLevel();
      setConfidenceLevel(level);
      const defaults = await getAllLearnedDefaults();
      setLearnedDefaults(defaults);
    } catch (err) {
      console.warn("Agent stats refresh failed:", err);
    }
  }, []);

  // Process observations periodically (every 30 seconds while active)
  const scheduleProcessing = useCallback(() => {
    if (processTimerRef.current) clearTimeout(processTimerRef.current);
    processTimerRef.current = setTimeout(async () => {
      setIsProcessing(true);
      try {
        await processObservations();
        await refreshStats();
      } catch (err) {
        console.warn("Agent processing failed:", err);
      }
      setIsProcessing(false);
    }, 30000);
  }, [refreshStats]);

  // Create tracker for a project session
  const createTracker = useCallback((projectId) => {
    trackerRef.current = createBehaviorTracker(projectId);
    scheduleProcessing();
    return trackerRef.current;
  }, [scheduleProcessing]);

  const getTracker = useCallback(() => trackerRef.current, []);

  // Smart defaults getters
  const getWallDefaults = useCallback(async () => {
    return getSmartWallDefaults();
  }, []);

  const getFloorDefaults = useCallback(async () => {
    return getSmartFloorDefaults();
  }, []);

  const getRoofDefaults = useCallback(async () => {
    return getSmartRoofDefaults();
  }, []);

  const getBidDefaults = useCallback(async () => {
    return getSmartBidDefaults();
  }, []);

  // Auto-takeoff: agent generates walls when confident
  const getAutoWalls = useCallback(async () => {
    return suggestAutoWalls();
  }, []);

  // Extraction enhancement
  const enhanceExtraction = useCallback(async (result) => {
    return enhanceExtractionResult(result);
  }, []);

  const getAiContext = useCallback(async () => {
    return buildAiContext();
  }, []);

  // Template suggestions
  const getTemplateSuggestion = useCallback(async (partialFeatures) => {
    return suggestTemplate(partialFeatures);
  }, []);

  const saveProfile = useCallback(async (projectId, projectData) => {
    await saveCompletedProfile(projectId, projectData);
    await refreshStats();
  }, [refreshStats]);

  // Force re-process
  const forceProcess = useCallback(async () => {
    setIsProcessing(true);
    try {
      await processObservations();
      await refreshStats();
    } catch (err) {
      console.warn("Agent processing failed:", err);
    }
    setIsProcessing(false);
  }, [refreshStats]);

  // Reset all learning data
  const resetLearning = useCallback(async () => {
    await clearAllLearningData();
    setObservationCount(0);
    setConfidenceLevel(0);
    setLearnedDefaults({});
  }, []);

  // Cleanup timer
  useEffect(() => {
    return () => {
      if (processTimerRef.current) clearTimeout(processTimerRef.current);
    };
  }, []);

  const value = {
    // Stats
    observationCount,
    confidenceLevel,
    learnedDefaults,
    isProcessing,
    // Tracker
    createTracker,
    getTracker,
    // Smart defaults
    getWallDefaults,
    getFloorDefaults,
    getRoofDefaults,
    getBidDefaults,
    // Auto-takeoff
    getAutoWalls,
    // Extraction
    enhanceExtraction,
    getAiContext,
    // Templates
    getTemplateSuggestion,
    saveProfile,
    extractFeatures,
    // Control
    forceProcess,
    resetLearning,
    refreshStats,
  };

  return <AgentContext.Provider value={value}>{children}</AgentContext.Provider>;
}

export function useAgent() {
  const ctx = useContext(AgentContext);
  if (!ctx) throw new Error("useAgent must be used within AgentProvider");
  return ctx;
}

/**
 * Hook for getting smart defaults for a specific calculator.
 * Returns { settings, meta } where meta indicates source/confidence per key.
 */
export function useSmartDefaults(category) {
  const [result, setResult] = useState(null);
  const agent = useAgent();

  useEffect(() => {
    let cancelled = false;
    const getter = category === "wall" ? agent.getWallDefaults
      : category === "floor" ? agent.getFloorDefaults
      : category === "roof" ? agent.getRoofDefaults
      : category === "bid" ? agent.getBidDefaults : null;

    if (getter) {
      getter().then((r) => { if (!cancelled) setResult(r); }).catch(() => {});
    }
    return () => { cancelled = true; };
  }, [category, agent]);

  return result;
}
