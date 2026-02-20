import { useState, useCallback } from "react";
import { colors, fonts } from "./theme";
import PdfScanner from "./components/PdfScanner";
import WallTakeoff from "./components/WallTakeoff";
import FloorTakeoff from "./components/FloorTakeoff";
import RoofTakeoff from "./components/RoofTakeoff";
import BidSummary from "./components/BidSummary";
import QuickReference from "./components/QuickReference";

const TABS = [
  { id: "scan", label: "PDF Scanner", color: colors.cyan },
  { id: "walls", label: "Walls" },
  { id: "floors", label: "Floors" },
  { id: "roof", label: "Roof" },
  { id: "bid", label: "Bid" },
  { id: "ref", label: "Quick Ref" },
];

export default function App() {
  const [activeTab, setActiveTab] = useState("scan");

  // Imported dimensions from PDF scanner → each takeoff tab
  const [wallImportedDims, setWallImportedDims] = useState(null);
  const [floorImportedDims, setFloorImportedDims] = useState(null);
  const [roofImportedDims, setRoofImportedDims] = useState(null);

  // Takeoff totals lifted here so BidSummary can use them
  const [wallTotal, setWallTotal] = useState(0);
  const [floorTotal, setFloorTotal] = useState(0);
  const [roofTotal, setRoofTotal] = useState(0);

  const handleSendToWalls = useCallback((dims) => { setWallImportedDims(dims); setActiveTab("walls"); }, []);
  const handleSendToFloors = useCallback((dims) => { setFloorImportedDims(dims); setActiveTab("floors"); }, []);
  const handleSendToRoof = useCallback((dims) => { setRoofImportedDims(dims); setActiveTab("roof"); }, []);

  return (
    <div style={{ background: colors.background, minHeight: "100vh", fontFamily: fonts.sans, color: colors.text }}>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;700;800&display=swap" rel="stylesheet" />

      <header style={{ background: "linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)", borderBottom: `2px solid ${colors.accent}`, padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: colors.accent, letterSpacing: "0.06em" }}>FRAMING TAKEOFF TOOLKIT</h1>
          <p style={{ margin: "2px 0 0", fontSize: 11, color: colors.dim }}>LeanAmp Technologies — PDF Scanner + Calculator + Quick Reference</p>
        </div>
      </header>

      <nav style={{ display: "flex", gap: 2, padding: "6px 10px", background: colors.surface, borderBottom: `1px solid ${colors.border}`, overflowX: "auto" }} aria-label="Main navigation">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            aria-current={activeTab === tab.id ? "page" : undefined}
            style={{
              padding: "7px 14px", borderRadius: 6, border: "none", cursor: "pointer",
              background: activeTab === tab.id ? (tab.color || colors.accent) : "transparent",
              color: activeTab === tab.id ? colors.background : colors.muted,
              fontWeight: activeTab === tab.id ? 800 : 600, fontSize: 13, whiteSpace: "nowrap",
            }}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <main style={{ padding: "14px 14px 40px", maxWidth: 1000, margin: "0 auto" }}>
        {activeTab === "scan" && <PdfScanner onSendToWalls={handleSendToWalls} onSendToFloors={handleSendToFloors} onSendToRoof={handleSendToRoof} />}
        {activeTab === "walls" && <WallTakeoff importedDims={wallImportedDims} onTotalChange={setWallTotal} />}
        {activeTab === "floors" && <FloorTakeoff importedDims={floorImportedDims} onTotalChange={setFloorTotal} />}
        {activeTab === "roof" && <RoofTakeoff importedDims={roofImportedDims} onTotalChange={setRoofTotal} />}
        {activeTab === "bid" && <BidSummary wallTotal={wallTotal} floorTotal={floorTotal} roofTotal={roofTotal} />}
        {activeTab === "ref" && <QuickReference />}
      </main>
    </div>
  );
}
