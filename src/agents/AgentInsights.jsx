/**
 * Agent Insights Panel — shows learning stats, confidence bars,
 * similar projects, and reset button.
 */
import { useState, useEffect } from "react";
import { colors, fonts } from "../theme";
import { useAgent } from "./agentContext";
import { Section, Row, ResultCard, Button } from "../components/ui";

export default function AgentInsights() {
  const agent = useAgent();
  const [expandedCategory, setExpandedCategory] = useState(null);

  useEffect(() => {
    agent.refreshStats();
  }, []);

  const { observationCount, confidenceLevel, learnedDefaults, isProcessing } = agent;

  const allPrefs = Object.entries(learnedDefaults).flatMap(([cat, prefs]) =>
    prefs.map((p) => ({ ...p, category: cat }))
  );
  const totalPrefs = allPrefs.length;
  const autoPrefs = allPrefs.filter((p) => p.action === "auto" || p.action === "silent").length;
  const suggestPrefs = allPrefs.filter((p) => p.action === "suggest").length;

  const confidenceColor = confidenceLevel >= 0.6 ? colors.green : confidenceLevel >= 0.3 ? colors.accent : colors.dim;
  const confidenceLabel = confidenceLevel >= 0.8 ? "Expert" : confidenceLevel >= 0.6 ? "Confident" : confidenceLevel >= 0.3 ? "Learning" : "New";

  return (
    <div>
      <Section title="Agent Learning Status" color={colors.purple}>
        <Row>
          <ResultCard label="Observations" value={observationCount} color={colors.cyan} large />
          <ResultCard label="Preferences" value={totalPrefs} color={colors.blue} />
          <ResultCard label="Auto-Apply" value={autoPrefs} color={colors.green} large />
          <ResultCard label="Suggestions" value={suggestPrefs} color={colors.accent} />
          <ResultCard label="Confidence" value={confidenceLabel} color={confidenceColor} large />
        </Row>

        {/* Overall confidence bar */}
        <div style={{ marginTop: 14, marginBottom: 6 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
            <span style={{ fontSize: 11, color: colors.muted, fontWeight: 700 }}>Overall Agent Confidence</span>
            <span style={{ fontSize: 12, color: confidenceColor, fontWeight: 800, fontFamily: fonts.mono }}>{Math.round(confidenceLevel * 100)}%</span>
          </div>
          <div style={{ height: 8, background: colors.raised, borderRadius: 4, overflow: "hidden" }}>
            <div style={{ width: Math.round(confidenceLevel * 100) + "%", height: "100%", background: confidenceColor, borderRadius: 4, transition: "width 0.5s ease" }} />
          </div>
        </div>
      </Section>

      {/* Per-category breakdown */}
      {["wall", "floor", "roof", "bid"].map((cat) => {
        const prefs = learnedDefaults[cat] || [];
        if (prefs.length === 0) return null;

        return (
          <Section key={cat} title={cat.charAt(0).toUpperCase() + cat.slice(1) + " Preferences (" + prefs.length + ")"} color={cat === "wall" ? colors.blue : cat === "floor" ? colors.teal : cat === "roof" ? colors.orange : colors.green}>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {prefs.map((pref) => {
                const actionColor = pref.action === "silent" ? colors.green : pref.action === "auto" ? colors.green : pref.action === "suggest" ? colors.accent : colors.dim;
                const actionLabel = pref.action === "silent" ? "AUTO" : pref.action === "auto" ? "LEARNED" : pref.action === "suggest" ? "SUGGEST" : "WATCHING";

                return (
                  <div key={pref.key} style={{
                    display: "flex", alignItems: "center", gap: 10, padding: "8px 12px",
                    background: colors.card, borderRadius: 6, border: "1px solid " + colors.border,
                  }}>
                    {/* Setting name */}
                    <div style={{ flex: "1 1 140px", minWidth: 100 }}>
                      <div style={{ fontSize: 12, color: colors.text, fontWeight: 600 }}>
                        {pref.key.split(".").pop().replace(/([A-Z])/g, " $1").trim()}
                      </div>
                      <div style={{ fontSize: 10, color: colors.dim }}>{pref.observationCount} observations</div>
                    </div>

                    {/* Learned value */}
                    <div style={{ flex: "0 0 auto", fontSize: 14, fontWeight: 800, color: colors.accentGlow, fontFamily: fonts.mono }}>
                      {pref.learnedValue}
                    </div>

                    {/* Confidence bar */}
                    <div style={{ flex: "1 1 100px", maxWidth: 120 }}>
                      <div style={{ height: 6, background: colors.raised, borderRadius: 3, overflow: "hidden" }}>
                        <div style={{ width: Math.round(pref.confidence * 100) + "%", height: "100%", background: actionColor, borderRadius: 3 }} />
                      </div>
                      <div style={{ fontSize: 9, color: colors.dim, textAlign: "right", marginTop: 2 }}>{Math.round(pref.confidence * 100)}%</div>
                    </div>

                    {/* Action badge */}
                    <span style={{
                      fontSize: 9, fontWeight: 800, padding: "2px 8px", borderRadius: 4,
                      background: actionColor + "20", color: actionColor, letterSpacing: "0.08em",
                    }}>
                      {actionLabel}
                    </span>
                  </div>
                );
              })}
            </div>
          </Section>
        );
      })}

      {/* Controls */}
      <Section title="Agent Controls" color={colors.rose}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Button onClick={() => agent.forceProcess()} color={colors.purple} disabled={isProcessing}>
            {isProcessing ? "Processing..." : "Reprocess Observations"}
          </Button>
          <Button onClick={() => { if (window.confirm("Reset all learned data? This cannot be undone.")) agent.resetLearning(); }}
            color={colors.rose} outline>
            Reset All Learning Data
          </Button>
        </div>
        <div style={{ marginTop: 10, fontSize: 12, color: colors.dim, lineHeight: 1.6 }}>
          The agent learns from every action you take. After 2-3 projects, it starts
          auto-applying your preferred settings and suggesting templates for new projects.
          When confidence is high enough, it will pre-populate wall takeoffs automatically.
        </div>
      </Section>
    </div>
  );
}
