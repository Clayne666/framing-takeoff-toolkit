import { useState, useMemo, useEffect, useRef } from "react";
import { colors, fonts, tableInputStyle, tableHeaderStyle, addButtonStyle, deleteButtonStyle } from "../theme";
import { LUMBER_PRICES, LABOR_RATES } from "../constants";
import { Section, Row, ResultCard, NumberInput, SelectInput, LearnedBadge } from "./ui";

function calculateWall(wall, studSize, studSpacing, studWastePercent, sheathingWastePercent) {
  const baseStuds = Math.ceil((wall.length * 12) / studSpacing) + 1;
  const openingStuds = wall.openings * 6;
  const cornerStuds = wall.type === "Exterior" ? 3 : 0;
  const totalStuds = baseStuds + openingStuds + cornerStuds;
  const studsWithWaste = Math.ceil(totalStuds * (1 + studWastePercent / 100));

  const topPlates = Math.ceil((wall.length * 2) / 16);
  const bottomPlates = Math.ceil(wall.length / 16);
  const sheathingSheets = Math.ceil((wall.length * wall.height) / 32 * (1 + sheathingWastePercent / 100));

  const studPrice = studSize === "2x4" ? LUMBER_PRICES["2x4Stud"] : LUMBER_PRICES["2x6Stud"];
  const platePrice = studSize === "2x4" ? LUMBER_PRICES["2x4_16ft"] : LUMBER_PRICES["2x6_16ft"];
  const materialCost = studsWithWaste * studPrice + (topPlates + bottomPlates) * platePrice + sheathingSheets * LUMBER_PRICES.osb4x8;
  const laborCost = wall.length * LABOR_RATES.wallPerLinearFoot;

  return { ...wall, totalStuds, studsWithWaste, topPlates, bottomPlates, sheathingSheets, materialCost, laborCost, totalCost: materialCost + laborCost };
}

const DEFAULT_WALLS = [
  { id: 1, name: "North Ext", type: "Exterior", length: 40, height: 8, openings: 3 },
  { id: 2, name: "South Ext", type: "Exterior", length: 40, height: 8, openings: 4 },
  { id: 3, name: "East Ext", type: "Exterior", length: 28, height: 8, openings: 2 },
  { id: 4, name: "West Ext", type: "Exterior", length: 28, height: 8, openings: 1 },
];
const DEFAULT_SETTINGS = { studSpacing: 16, studSize: "2x4", studWaste: 10, sheathingWaste: 8 };

// Light table styles
const lightInput = {
  background: colors.contentBg,
  border: `1px solid ${colors.borderLight}`,
  borderRadius: 3,
  padding: "5px 8px",
  color: colors.textDark,
  fontSize: 12,
  fontFamily: fonts.mono,
  outline: "none",
};
const lightHeader = {
  padding: "8px 6px",
  background: colors.contentAlt,
  color: colors.muted,
  textAlign: "center",
  fontSize: 10,
  fontWeight: 600,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  borderBottom: `2px solid ${colors.borderLight}`,
  whiteSpace: "nowrap",
};

export default function WallTakeoff({ importedDims, importData, onTotalChange, initialState, onStateChange, smartDefaults }) {
  const effectiveDefaults = smartDefaults?.settings
    ? { ...DEFAULT_SETTINGS, ...smartDefaults.settings }
    : DEFAULT_SETTINGS;
  const [settings, setSettings] = useState(initialState?.settings || effectiveDefaults);
  const [walls, setWalls] = useState(initialState?.walls?.length ? initialState.walls : DEFAULT_WALLS);
  const hasInitialized = useRef(false);
  const importDataRef = useRef(null);

  useEffect(() => {
    if (!importedDims?.length) return;
    setWalls((prev) => [...prev, ...importedDims.map((dim, i) => ({
      id: Date.now() + i, name: "Import " + dim.raw, type: "Exterior",
      length: Math.round(dim.feet * 10) / 10, height: 8, openings: 0,
    }))]);
  }, [importedDims]);

  useEffect(() => {
    if (!importData || importData === importDataRef.current) return;
    importDataRef.current = importData;
    if (importData.settingsOverrides) setSettings((prev) => ({ ...prev, ...importData.settingsOverrides }));
    if (importData.walls?.length) setWalls(importData.walls);
  }, [importData]);

  const addWall = () => setWalls((prev) => [...prev, { id: Date.now(), name: "", type: "Interior", length: 0, height: 8, openings: 0 }]);
  const removeWall = (id) => setWalls((prev) => prev.filter((w) => w.id !== id));
  const updateWall = (id, field, value) => setWalls((prev) => prev.map((w) => (w.id === id ? { ...w, [field]: value } : w)));
  const updateSetting = (key, value) => setSettings((prev) => ({ ...prev, [key]: value }));

  const calculations = useMemo(() =>
    walls.filter((w) => w.length > 0).map((w) => calculateWall(w, settings.studSize, settings.studSpacing, settings.studWaste, settings.sheathingWaste)),
    [walls, settings]
  );

  const totals = calculations.reduce(
    (acc, c) => ({ linearFeet: acc.linearFeet + c.length, studs: acc.studs + c.studsWithWaste, plates: acc.plates + c.topPlates + c.bottomPlates, sheathing: acc.sheathing + c.sheathingSheets, material: acc.material + c.materialCost, labor: acc.labor + c.laborCost, total: acc.total + c.totalCost }),
    { linearFeet: 0, studs: 0, plates: 0, sheathing: 0, material: 0, labor: 0, total: 0 }
  );

  useEffect(() => { onTotalChange?.(totals.total); }, [totals.total, onTotalChange]);

  useEffect(() => {
    if (!hasInitialized.current) { hasInitialized.current = true; return; }
    onStateChange?.({ settings, walls });
  }, [settings, walls, onStateChange]);

  return (
    <div>
      <Section title="Settings" color={colors.primary}>
        <Row>
          <SelectInput label={<>Stud Size<LearnedBadge meta={smartDefaults?.meta} settingKey="studSize" /></>} value={settings.studSize} onChange={(v) => updateSetting("studSize", v)} options={[{ value: "2x4", label: "2x4" }, { value: "2x6", label: "2x6" }]} />
          <SelectInput label={<>Spacing<LearnedBadge meta={smartDefaults?.meta} settingKey="studSpacing" /></>} value={String(settings.studSpacing)} onChange={(v) => updateSetting("studSpacing", +v)} options={[{ value: "12", label: '12" OC' }, { value: "16", label: '16" OC' }, { value: "24", label: '24" OC' }]} />
          <NumberInput label="Stud Waste" value={settings.studWaste} onChange={(v) => updateSetting("studWaste", v)} unit="%" />
          <NumberInput label="Sheath Waste" value={settings.sheathingWaste} onChange={(v) => updateSetting("sheathingWaste", v)} unit="%" />
        </Row>
      </Section>

      <Section title="Wall Schedule" color={colors.warning}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 720 }}>
            <thead><tr>{["Wall ID", "Type", "Len", "Ht", "Opens", "Studs", "+Waste", "Plates", "Sheath", "Mat $", "Labor $", "Total $", ""].map((h) => <th key={h} style={lightHeader}>{h}</th>)}</tr></thead>
            <tbody>{walls.map((wall, i) => {
              const calc = calculations.find((c) => c.id === wall.id);
              return (
                <tr key={wall.id} style={{ borderBottom: `1px solid ${colors.borderLight}`, background: i % 2 === 0 ? colors.contentBg : colors.contentAlt }}>
                  <td style={{ padding: 3 }}><input value={wall.name} onChange={(e) => updateWall(wall.id, "name", e.target.value)} placeholder="Name..." aria-label="Wall name" style={{ ...lightInput, width: "100%", minWidth: 70 }} /></td>
                  <td style={{ padding: 3 }}><select value={wall.type} onChange={(e) => updateWall(wall.id, "type", e.target.value)} aria-label="Wall type" style={{ ...lightInput, width: 80, cursor: "pointer" }}><option>Exterior</option><option>Interior</option><option>Bearing</option></select></td>
                  <td style={{ padding: 3 }}><input type="number" value={wall.length} onChange={(e) => updateWall(wall.id, "length", +e.target.value)} aria-label="Length (ft)" style={{ ...lightInput, width: 48, textAlign: "center" }} /></td>
                  <td style={{ padding: 3 }}><input type="number" value={wall.height} onChange={(e) => updateWall(wall.id, "height", +e.target.value)} aria-label="Height (ft)" style={{ ...lightInput, width: 38, textAlign: "center" }} /></td>
                  <td style={{ padding: 3 }}><input type="number" value={wall.openings} onChange={(e) => updateWall(wall.id, "openings", +e.target.value)} aria-label="Openings" style={{ ...lightInput, width: 38, textAlign: "center" }} /></td>
                  <td style={{ padding: "3px 5px", textAlign: "center", color: colors.textDark, fontFamily: fonts.mono, fontSize: 12 }}>{calc?.totalStuds ?? "\u2014"}</td>
                  <td style={{ padding: "3px 5px", textAlign: "center", color: colors.success, fontFamily: fonts.mono, fontWeight: 700, fontSize: 12 }}>{calc?.studsWithWaste ?? "\u2014"}</td>
                  <td style={{ padding: "3px 5px", textAlign: "center", color: colors.textDark, fontFamily: fonts.mono, fontSize: 12 }}>{calc ? calc.topPlates + calc.bottomPlates : "\u2014"}</td>
                  <td style={{ padding: "3px 5px", textAlign: "center", color: colors.textDark, fontFamily: fonts.mono, fontSize: 12 }}>{calc?.sheathingSheets ?? "\u2014"}</td>
                  <td style={{ padding: "3px 5px", textAlign: "right", color: colors.primary, fontFamily: fonts.mono, fontWeight: 600, fontSize: 12 }}>{calc ? "$" + Math.round(calc.materialCost).toLocaleString() : "\u2014"}</td>
                  <td style={{ padding: "3px 5px", textAlign: "right", color: colors.teal, fontFamily: fonts.mono, fontWeight: 600, fontSize: 12 }}>{calc ? "$" + Math.round(calc.laborCost).toLocaleString() : "\u2014"}</td>
                  <td style={{ padding: "3px 5px", textAlign: "right", color: colors.textDark, fontFamily: fonts.mono, fontWeight: 700, fontSize: 12 }}>{calc ? "$" + Math.round(calc.totalCost).toLocaleString() : "\u2014"}</td>
                  <td style={{ padding: 3 }}><button onClick={() => removeWall(wall.id)} aria-label={"Remove " + (wall.name || "wall")} style={{ ...deleteButtonStyle, color: colors.danger, fontSize: 13 }}>x</button></td>
                </tr>
              );
            })}</tbody>
          </table>
        </div>
        <button onClick={addWall} style={{ ...addButtonStyle, borderColor: colors.borderMid, color: colors.muted }}>+ Add Wall</button>
      </Section>

      <Section title="Totals" color={colors.success}>
        <Row>
          <ResultCard label="Total Wall LF" value={totals.linearFeet} unit="LF" color={colors.primary} large />
          <ResultCard label="Studs" value={totals.studs} unit="pcs" color={colors.warning} large />
          <ResultCard label="Plates" value={totals.plates} unit="16'" color={colors.teal} />
          <ResultCard label="Sheathing" value={totals.sheathing} unit="sheets" color={colors.purple} />
          <ResultCard label="Material" value={"$" + Math.round(totals.material).toLocaleString()} color={colors.primary} large />
          <ResultCard label="Labor" value={"$" + Math.round(totals.labor).toLocaleString()} color={colors.teal} />
          <ResultCard label="Total" value={"$" + Math.round(totals.total).toLocaleString()} color={colors.success} large />
        </Row>
      </Section>
    </div>
  );
}
