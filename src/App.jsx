import { useState, useCallback, useRef, useEffect } from "react";
import { colors, fonts } from "./theme";
import PdfScanner from "./components/PdfScanner";
import WallTakeoff from "./components/WallTakeoff";
import FloorTakeoff from "./components/FloorTakeoff";
import RoofTakeoff from "./components/RoofTakeoff";
import BidSummary from "./components/BidSummary";
import QuickReference from "./components/QuickReference";
import ProjectDashboard from "./components/ProjectDashboard";
import AgentInsights from "./agents/AgentInsights";
import { useAgent } from "./agents/agentContext";
import { buildWallImportData, buildFloorImportData, buildRoofImportData } from "./utils/takeoffMapper";
import { getProject, createAutoSaver } from "./utils/projectStore";

const TABS = [
  { id: "scan", label: "Plans", icon: "\u2750" },
  { id: "walls", label: "Walls", icon: "\u2502" },
  { id: "floors", label: "Floors", icon: "\u2500" },
  { id: "roof", label: "Roof", icon: "\u25B3" },
  { id: "bid", label: "Estimate", icon: "$" },
  { id: "ai", label: "AI Agent", icon: "\u2726" },
  { id: "ref", label: "Reference", icon: "\u2139" },
];

const STATUS_OPTS = ["active", "bid", "awarded", "complete", "archived"];
const STATUS_COLORS = { active: colors.success, bid: colors.warning, awarded: colors.primary, complete: colors.purple, archived: colors.muted };

export default function App() {
  const [view, setView] = useState("dashboard");
  const [activeTab, setActiveTab] = useState("scan");
  const agent = useAgent();

  const [activeProjectId, setActiveProjectId] = useState(null);
  const [projectData, setProjectData] = useState(null);
  const [isProjectLoading, setIsProjectLoading] = useState(false);

  const [wallSmartDefaults, setWallSmartDefaults] = useState(null);
  const [floorSmartDefaults, setFloorSmartDefaults] = useState(null);
  const [roofSmartDefaults, setRoofSmartDefaults] = useState(null);
  const [bidSmartDefaults, setBidSmartDefaults] = useState(null);
  const [autoTakeoffApplied, setAutoTakeoffApplied] = useState(false);

  const [wallInitialState, setWallInitialState] = useState(null);
  const [floorInitialState, setFloorInitialState] = useState(null);
  const [roofInitialState, setRoofInitialState] = useState(null);
  const [bidInitialState, setBidInitialState] = useState(null);

  const [wallImportedDims, setWallImportedDims] = useState(null);
  const [floorImportedDims, setFloorImportedDims] = useState(null);
  const [roofImportedDims, setRoofImportedDims] = useState(null);

  const [wallImportData, setWallImportData] = useState(null);
  const [floorImportData, setFloorImportData] = useState(null);
  const [roofImportData, setRoofImportData] = useState(null);

  const [extractionResult, setExtractionResult] = useState(null);
  const [scanProgress, setScanProgress] = useState(null); // { phase, current, total, message }
  const [toasts, setToasts] = useState([]);

  const [wallTotal, setWallTotal] = useState(0);
  const [floorTotal, setFloorTotal] = useState(0);
  const [roofTotal, setRoofTotal] = useState(0);

  const [saveStatus, setSaveStatus] = useState("saved");
  const autoSaverRef = useRef(null);
  if (!autoSaverRef.current) {
    autoSaverRef.current = createAutoSaver(1500);
    autoSaverRef.current.setStatusCallback(setSaveStatus);
  }

  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [workspaceKey, setWorkspaceKey] = useState(0);

  const loadSmartDefaults = useCallback(async () => {
    try {
      const [wd, fd, rd, bd] = await Promise.all([
        agent.getWallDefaults(), agent.getFloorDefaults(),
        agent.getRoofDefaults(), agent.getBidDefaults(),
      ]);
      setWallSmartDefaults(wd); setFloorSmartDefaults(fd);
      setRoofSmartDefaults(rd); setBidSmartDefaults(bd);
    } catch (err) { console.warn("Failed to load smart defaults:", err); }
  }, [agent]);

  const openProject = useCallback(async (projectId) => {
    setIsProjectLoading(true);
    setAutoTakeoffApplied(false);
    try {
      const data = await getProject(projectId);
      if (!data) { setIsProjectLoading(false); return; }
      setProjectData(data);
      setActiveProjectId(projectId);
      setExtractionResult(data.extractionResult);
      const tracker = agent.createTracker(projectId);
      if (tracker?.initFromState) {
        tracker.initFromState({ wallState: data.wallState, floorState: data.floorState, roofState: data.roofState, bidState: data.bidState });
      }
      setWallInitialState(data.wallState); setFloorInitialState(data.floorState);
      setRoofInitialState(data.roofState); setBidInitialState(data.bidState);
      setWallImportedDims(null); setFloorImportedDims(null); setRoofImportedDims(null);
      setWallImportData(null); setFloorImportData(null); setRoofImportData(null);
      setWallTotal(0); setFloorTotal(0); setRoofTotal(0);
      await loadSmartDefaults();
      setWorkspaceKey((k) => k + 1);
      setActiveTab("scan");
      setView("workspace");
      setSaveStatus("saved");
    } catch (err) { console.error("Failed to open project:", err); }
    setIsProjectLoading(false);
  }, [agent, loadSmartDefaults]);

  useEffect(() => {
    if (autoTakeoffApplied || !activeProjectId) return;
    if (wallInitialState?.walls?.some((w) => w.length > 0)) return;
    let cancelled = false;
    agent.getAutoWalls().then((autoWalls) => {
      if (cancelled || !autoWalls || autoWalls.length === 0) return;
      setAutoTakeoffApplied(true);
      setWallImportData({ walls: autoWalls, settingsOverrides: wallSmartDefaults?.settings || {}, _agentGenerated: true });
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [activeProjectId, autoTakeoffApplied, agent, wallInitialState, wallSmartDefaults]);

  const backToDashboard = useCallback(async () => {
    if (activeProjectId && projectData) {
      try {
        await agent.saveProfile(activeProjectId, { name: projectData.name, wallState: wallInitialState, floorState: floorInitialState, roofState: roofInitialState, bidState: bidInitialState });
      } catch (err) { console.warn("Failed to save project profile:", err); }
    }
    await autoSaverRef.current.flush();
    setView("dashboard"); setActiveProjectId(null); setProjectData(null);
    setWallInitialState(null); setFloorInitialState(null); setRoofInitialState(null); setBidInitialState(null);
    setExtractionResult(null);
    setWallImportedDims(null); setFloorImportedDims(null); setRoofImportedDims(null);
    setWallImportData(null); setFloorImportData(null); setRoofImportData(null);
    setWallSmartDefaults(null); setFloorSmartDefaults(null); setRoofSmartDefaults(null); setBidSmartDefaults(null);
    setAutoTakeoffApplied(false);
  }, [activeProjectId, projectData, agent, wallInitialState, floorInitialState, roofInitialState, bidInitialState]);

  const handleWallStateChange = useCallback((state) => {
    if (!activeProjectId) return;
    setWallInitialState(state);
    autoSaverRef.current.save(activeProjectId, { wallState: state });
    const tracker = agent.getTracker();
    if (tracker) tracker.trackWallState(state);
  }, [activeProjectId, agent]);

  const handleFloorStateChange = useCallback((state) => {
    if (!activeProjectId) return;
    setFloorInitialState(state);
    autoSaverRef.current.save(activeProjectId, { floorState: state });
    const tracker = agent.getTracker();
    if (tracker) tracker.trackFloorState(state);
  }, [activeProjectId, agent]);

  const handleRoofStateChange = useCallback((state) => {
    if (!activeProjectId) return;
    setRoofInitialState(state);
    autoSaverRef.current.save(activeProjectId, { roofState: state });
    const tracker = agent.getTracker();
    if (tracker) tracker.trackRoofState(state);
  }, [activeProjectId, agent]);

  const handleBidStateChange = useCallback((state) => {
    if (!activeProjectId) return;
    setBidInitialState(state);
    autoSaverRef.current.save(activeProjectId, { bidState: state });
    const tracker = agent.getTracker();
    if (tracker) tracker.trackBidState(state);
  }, [activeProjectId, agent]);

  const handleSendToWalls = useCallback((dims) => { setWallImportedDims(dims); setActiveTab("walls"); }, []);
  const handleSendToFloors = useCallback((dims) => { setFloorImportedDims(dims); setActiveTab("floors"); }, []);
  const handleSendToRoof = useCallback((dims) => { setRoofImportedDims(dims); setActiveTab("roof"); }, []);

  const handleExtractionComplete = useCallback(async (result) => {
    let enhanced = result;
    try { enhanced = await agent.enhanceExtraction(result); } catch (err) { console.warn("Agent enhancement failed:", err); }
    setExtractionResult(enhanced);
    setWallImportData(buildWallImportData(enhanced));
    setFloorImportData(buildFloorImportData(enhanced));
    setRoofImportData(buildRoofImportData(enhanced));
    setScanProgress(null);
    addToast("Scan complete — data ready to auto-populate");
    if (activeProjectId) {
      autoSaverRef.current.save(activeProjectId, { extractionResult: enhanced });
    }
  }, [activeProjectId, agent, addToast]);

  const handleAutoPopulate = useCallback(() => {
    if (!extractionResult) return;
    setWallImportData(buildWallImportData(extractionResult));
    setFloorImportData(buildFloorImportData(extractionResult));
    setRoofImportData(buildRoofImportData(extractionResult));
    addToast("Data populated into Walls, Floors & Roof tabs");
  }, [extractionResult, addToast]);

  const saveProjectName = useCallback(() => {
    if (nameInput.trim() && activeProjectId) {
      setProjectData((prev) => prev ? { ...prev, name: nameInput.trim() } : prev);
      autoSaverRef.current.save(activeProjectId, { name: nameInput.trim() });
    }
    setEditingName(false);
  }, [nameInput, activeProjectId]);

  const changeStatus = useCallback((newStatus) => {
    if (!activeProjectId) return;
    setProjectData((prev) => prev ? { ...prev, status: newStatus } : prev);
    autoSaverRef.current.save(activeProjectId, { status: newStatus });
  }, [activeProjectId]);

  const addToast = useCallback((msg, type = "success") => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, msg, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 5000);
  }, []);

  useEffect(() => {
    return () => { autoSaverRef.current?.flush(); };
  }, []);

  const saveLabel = saveStatus === "saved" ? "Saved" : saveStatus === "saving" ? "Saving..." : "Unsaved";
  const saveDotColor = saveStatus === "saved" ? colors.success : saveStatus === "saving" ? colors.warning : colors.orange;
  const bidTotal = wallTotal + floorTotal + roofTotal;

  return (
    <div style={{ background: colors.contentAlt, minHeight: "100vh", fontFamily: fonts.sans, color: colors.textDark }}>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;700;800&display=swap" rel="stylesheet" />

      {view === "dashboard" ? (
        <>
          {/* ── Dashboard Top Bar ──────────────── */}
          <header style={{
            background: colors.navBg,
            borderBottom: `1px solid ${colors.navBorder}`,
            padding: "0 24px",
            height: 48,
            display: "flex",
            alignItems: "center",
            gap: 16,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{
                width: 24, height: 24, borderRadius: 4,
                background: colors.primary, display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 12, fontWeight: 800, color: "#fff",
              }}>FT</div>
              <span style={{ fontSize: 14, fontWeight: 700, color: "#ffffff", letterSpacing: "0.02em" }}>
                Framing Takeoff
              </span>
            </div>
            <span style={{ fontSize: 11, color: colors.textSecondary }}>
              LeanAmp Technologies
            </span>
          </header>
          <main style={{ padding: "24px 24px 40px", maxWidth: 1200, margin: "0 auto" }}>
            <ProjectDashboard onOpenProject={openProject} />
          </main>
        </>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
          {/* ── Top Navigation Bar ──────────────── */}
          <header style={{
            background: colors.navBg,
            borderBottom: `1px solid ${colors.navBorder}`,
            padding: "0 16px",
            height: 48,
            display: "flex",
            alignItems: "center",
            gap: 12,
            flexShrink: 0,
          }}>
            {/* Back button */}
            <button
              onClick={backToDashboard}
              style={{
                background: "none", border: "none", padding: "6px 8px",
                color: colors.textSecondary, cursor: "pointer", fontSize: 14,
                display: "flex", alignItems: "center", gap: 4,
              }}
              title="Back to Projects"
            >
              <span style={{ fontSize: 16 }}>{"\u2190"}</span>
            </button>

            {/* Divider */}
            <div style={{ width: 1, height: 24, background: colors.navBorder }} />

            {/* Logo */}
            <div style={{
              width: 22, height: 22, borderRadius: 3,
              background: colors.primary, display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 10, fontWeight: 800, color: "#fff", flexShrink: 0,
            }}>FT</div>

            {/* Project name */}
            <div style={{ flex: 1, minWidth: 120 }}>
              {editingName ? (
                <input
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  onBlur={saveProjectName}
                  onKeyDown={(e) => { if (e.key === "Enter") saveProjectName(); if (e.key === "Escape") setEditingName(false); }}
                  autoFocus
                  style={{
                    background: colors.toolbarBg, border: `1px solid ${colors.primary}`, borderRadius: 3,
                    padding: "3px 8px", color: "#ffffff", fontSize: 14, fontWeight: 600, fontFamily: fonts.sans,
                    outline: "none", width: "100%", maxWidth: 300,
                  }}
                />
              ) : (
                <span
                  onClick={() => { setNameInput(projectData?.name || ""); setEditingName(true); }}
                  title="Click to rename"
                  style={{ fontSize: 14, fontWeight: 600, color: "#ffffff", cursor: "text" }}
                >
                  {projectData?.name || "Loading..."}
                </span>
              )}
            </div>

            {/* Status */}
            <select
              value={projectData?.status || "active"}
              onChange={(e) => changeStatus(e.target.value)}
              style={{
                background: "transparent",
                border: `1px solid ${(STATUS_COLORS[projectData?.status] || colors.muted) + "60"}`,
                borderRadius: 3, padding: "3px 8px", color: STATUS_COLORS[projectData?.status] || colors.muted,
                fontSize: 11, fontWeight: 600, textTransform: "uppercase", cursor: "pointer", outline: "none",
              }}
            >
              {STATUS_OPTS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>

            {/* Save indicator */}
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: saveDotColor }} />
              <span style={{ fontSize: 11, color: colors.textSecondary, fontWeight: 500 }}>{saveLabel}</span>
            </div>

            {/* AI indicator */}
            {agent.confidenceLevel > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "3px 8px", borderRadius: 3, background: colors.purple + "20" }}>
                <span style={{ fontSize: 11, color: colors.purple, fontWeight: 600 }}>
                  AI {Math.round(agent.confidenceLevel * 100)}%
                </span>
              </div>
            )}

            {/* Auto-populate */}
            {extractionResult && (
              <button
                onClick={handleAutoPopulate}
                style={{
                  background: colors.primary, color: "#ffffff", border: "none", borderRadius: 4,
                  padding: "6px 14px", fontWeight: 600, fontSize: 12, cursor: "pointer",
                }}
              >
                Auto-Populate
              </button>
            )}
          </header>

          {/* ── Tab Sub-Navigation ──────────────── */}
          <nav
            style={{
              display: "flex",
              gap: 0,
              padding: "0 16px",
              background: colors.toolbarBg,
              borderBottom: `1px solid ${colors.navBorder}`,
              height: 38,
              alignItems: "stretch",
              flexShrink: 0,
              overflowX: "auto",
            }}
            aria-label="Main navigation"
          >
            {TABS.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  aria-current={isActive ? "page" : undefined}
                  style={{
                    padding: "0 16px",
                    border: "none",
                    borderBottom: isActive ? `2px solid ${colors.primary}` : "2px solid transparent",
                    cursor: "pointer",
                    background: "transparent",
                    color: isActive ? "#ffffff" : colors.textSecondary,
                    fontWeight: isActive ? 600 : 500,
                    fontSize: 13,
                    whiteSpace: "nowrap",
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                    transition: "all 0.15s",
                  }}
                >
                  <span style={{ fontSize: 12, opacity: isActive ? 1 : 0.6 }}>{tab.icon}</span>
                  {tab.label}
                  {tab.id === "ai" && agent.observationCount > 0 && (
                    <span style={{
                      fontSize: 9, fontWeight: 700, padding: "1px 5px", borderRadius: 8,
                      background: colors.purple + "30", color: colors.purple,
                    }}>
                      {agent.observationCount}
                    </span>
                  )}
                </button>
              );
            })}

            {/* Right side: quick stats + scan progress */}
            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 14, paddingRight: 4 }}>
              {scanProgress && (
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 80, height: 4, borderRadius: 2, background: colors.navBorder, overflow: "hidden" }}>
                    <div style={{
                      height: "100%", borderRadius: 2, background: colors.primary,
                      width: scanProgress.total > 0 ? `${Math.round((scanProgress.current / scanProgress.total) * 100)}%` : "0%",
                      transition: "width 0.3s",
                    }} />
                  </div>
                  <span style={{ fontSize: 10, color: colors.textSecondary, whiteSpace: "nowrap" }}>
                    {scanProgress.message || `Scanning ${scanProgress.current}/${scanProgress.total}`}
                  </span>
                </div>
              )}
              {wallTotal > 0 && (
                <span style={{ fontSize: 11, color: colors.textSecondary, fontFamily: fonts.mono }}>
                  W: ${Math.round(wallTotal).toLocaleString()}
                </span>
              )}
              {floorTotal > 0 && (
                <span style={{ fontSize: 11, color: colors.textSecondary, fontFamily: fonts.mono }}>
                  F: ${Math.round(floorTotal).toLocaleString()}
                </span>
              )}
              {roofTotal > 0 && (
                <span style={{ fontSize: 11, color: colors.textSecondary, fontFamily: fonts.mono }}>
                  R: ${Math.round(roofTotal).toLocaleString()}
                </span>
              )}
              {bidTotal > 0 && (
                <span style={{ fontSize: 12, color: colors.primaryGlow, fontFamily: fonts.mono, fontWeight: 700 }}>
                  ${Math.round(bidTotal).toLocaleString()}
                </span>
              )}
            </div>
          </nav>

          {/* ── Workspace Content ──────────────── */}
          <main style={{
            flex: 1,
            overflow: "auto",
            padding: activeTab === "scan" ? 0 : "16px 20px 40px",
            background: activeTab === "scan" ? colors.contentAlt : colors.contentAlt,
          }}>
            {isProjectLoading && (
              <div style={{ textAlign: "center", padding: 60, color: colors.muted, fontSize: 14 }}>Loading project...</div>
            )}

            {!isProjectLoading && (
              <>
                <div style={{ display: activeTab === "scan" ? "block" : "none" }}>
                  <PdfScanner
                    onSendToWalls={handleSendToWalls}
                    onSendToFloors={handleSendToFloors}
                    onSendToRoof={handleSendToRoof}
                    onExtractionComplete={handleExtractionComplete}
                    onScanProgress={setScanProgress}
                    projectId={activeProjectId}
                    initialPlanFileName={projectData?.planFileName}
                  />
                </div>

                <div key={"w-" + workspaceKey} style={{ display: activeTab === "walls" ? "block" : "none", maxWidth: 1100, margin: "0 auto" }}>
                  <WallTakeoff
                    importedDims={wallImportedDims} importData={wallImportData}
                    onTotalChange={setWallTotal} initialState={wallInitialState}
                    onStateChange={handleWallStateChange} smartDefaults={wallSmartDefaults}
                  />
                </div>

                <div key={"f-" + workspaceKey} style={{ display: activeTab === "floors" ? "block" : "none", maxWidth: 1100, margin: "0 auto" }}>
                  <FloorTakeoff
                    importedDims={floorImportedDims} importData={floorImportData}
                    onTotalChange={setFloorTotal} initialState={floorInitialState}
                    onStateChange={handleFloorStateChange} smartDefaults={floorSmartDefaults}
                  />
                </div>

                <div key={"r-" + workspaceKey} style={{ display: activeTab === "roof" ? "block" : "none", maxWidth: 1100, margin: "0 auto" }}>
                  <RoofTakeoff
                    importedDims={roofImportedDims} importData={roofImportData}
                    onTotalChange={setRoofTotal} initialState={roofInitialState}
                    onStateChange={handleRoofStateChange} smartDefaults={roofSmartDefaults}
                  />
                </div>

                <div key={"b-" + workspaceKey} style={{ display: activeTab === "bid" ? "block" : "none", maxWidth: 1100, margin: "0 auto" }}>
                  <BidSummary
                    wallTotal={wallTotal} floorTotal={floorTotal} roofTotal={roofTotal}
                    extractionResult={extractionResult} initialState={bidInitialState}
                    onStateChange={handleBidStateChange} smartDefaults={bidSmartDefaults}
                  />
                </div>

                {activeTab === "ai" && <div style={{ maxWidth: 1100, margin: "0 auto" }}><AgentInsights /></div>}
                {activeTab === "ref" && <div style={{ maxWidth: 1100, margin: "0 auto" }}><QuickReference /></div>}
              </>
            )}
          </main>

          {/* ── Toast Notifications ──────────────── */}
          {toasts.length > 0 && (
            <div style={{ position: "fixed", bottom: 20, right: 20, zIndex: 9999, display: "flex", flexDirection: "column", gap: 8 }}>
              {toasts.map((t) => (
                <div
                  key={t.id}
                  style={{
                    background: t.type === "success" ? colors.success : t.type === "error" ? "#ef4444" : colors.primary,
                    color: "#ffffff", padding: "10px 18px", borderRadius: 6,
                    fontSize: 13, fontWeight: 600, boxShadow: "0 4px 12px rgba(0,0,0,0.25)",
                    display: "flex", alignItems: "center", gap: 8, maxWidth: 340,
                    animation: "slideInRight 0.3s ease",
                  }}
                >
                  <span>{t.type === "success" ? "\u2713" : t.type === "error" ? "\u2717" : "\u2139"}</span>
                  {t.msg}
                  <button
                    onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
                    style={{ background: "none", border: "none", color: "#ffffff", cursor: "pointer", marginLeft: "auto", fontSize: 16, opacity: 0.7 }}
                  >{"\u00D7"}</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
