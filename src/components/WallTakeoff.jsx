import { useState, useMemo, useEffect } from "react";
import { colors, fonts, tableInputStyle, tableHeaderStyle, addButtonStyle, deleteButtonStyle } from "../theme";
import { LUMBER_PRICES, LABOR_RATES } from "../constants";
import { Section, Row, ResultCard, NumberInput, SelectInput } from "./ui";

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

export default function WallTakeoff({ importedDims, detectedWallHeight, onTotalChange }) {
  const wallHeight = detectedWallHeight || 8;
  const [settings, setSettings] = useState({ studSpacing: 16, studSize: "2x4", studWaste: 10, sheathingWaste: 8 });
  const [walls, setWalls] = useState([
    { id: 1, name: "North Ext", type: "Exterior", length: 40, height: 8, openings: 3 },
    { id: 2, name: "South Ext", type: "Exterior", length: 40, height: 8, openings: 4 },
    { id: 3, name: "East Ext", type: "Exterior", length: 28, height: 8, openings: 2 },
    { id: 4, name: "West Ext", type: "Exterior", length: 28, height: 8, openings: 1 },
  ]);

  // When detected height changes, update default walls that still have the old default
  useEffect(() => {
    if (!detectedWallHeight) return;
    setWalls((prev) => prev.map((w) => w.height === 8 ? { ...w, height: detectedWallHeight } : w));
  }, [detectedWallHeight]);

  useEffect(() => {
    if (!importedDims?.length) return;
    setWalls((prev) => [...prev, ...importedDims.map((dim, i) => ({
      id: Date.now() + i, name: `Import ${dim.raw}`, type: "Exterior",
      length: Math.round(dim.feet * 10) / 10, height: wallHeight, openings: 0,
    }))]);
  }, [importedDims]);

  const addWall = () => setWalls((prev) => [...prev, { id: Date.now(), name: "", type: "Interior", length: 0, height: wallHeight, openings: 0 }]);
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

  return (
    <div>
      <Section title="Settings" color={colors.blue}>
        <Row>
          <SelectInput label="Stud Size" value={settings.studSize} onChange={(v) => updateSetting("studSize", v)} options={[{ value: "2x4", label: "2×4" }, { value: "2x6", label: "2×6" }]} />
          <SelectInput label="Spacing" value={String(settings.studSpacing)} onChange={(v) => updateSetting("studSpacing", +v)} options={[{ value: "12", label: '12" OC' }, { value: "16", label: '16" OC' }, { value: "24", label: '24" OC' }]} />
          <NumberInput label="Stud Waste" value={settings.studWaste} onChange={(v) => updateSetting("studWaste", v)} unit="%" />
          <NumberInput label="Sheath Waste" value={settings.sheathingWaste} onChange={(v) => updateSetting("sheathingWaste", v)} unit="%" />
        </Row>
      </Section>

      <Section title="Wall Schedule" color={colors.accent}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 720 }}>
            <thead><tr>{["Wall ID", "Type", "Len", "Ht", "Opens", "Studs", "+Waste", "Plates", "Sheath", "Mat $", "Labor $", "Total $", ""].map((h) => <th key={h} style={tableHeaderStyle}>{h}</th>)}</tr></thead>
            <tbody>{walls.map((wall, i) => {
              const calc = calculations.find((c) => c.id === wall.id);
              return (
                <tr key={wall.id} style={{ borderBottom: `1px solid ${colors.border}`, background: i % 2 === 0 ? colors.surface : "transparent" }}>
                  <td style={{ padding: 3 }}><input value={wall.name} onChange={(e) => updateWall(wall.id, "name", e.target.value)} placeholder="Name..." aria-label="Wall name" style={{ ...tableInputStyle, width: "100%", minWidth: 70 }} /></td>
                  <td style={{ padding: 3 }}><select value={wall.type} onChange={(e) => updateWall(wall.id, "type", e.target.value)} aria-label="Wall type" style={{ ...tableInputStyle, width: 76 }}><option>Exterior</option><option>Interior</option><option>Bearing</option></select></td>
                  <td style={{ padding: 3 }}><input type="number" value={wall.length} onChange={(e) => updateWall(wall.id, "length", +e.target.value)} aria-label="Length (ft)" style={{ ...tableInputStyle, width: 48, textAlign: "center" }} /></td>
                  <td style={{ padding: 3 }}><input type="number" value={wall.height} onChange={(e) => updateWall(wall.id, "height", +e.target.value)} aria-label="Height (ft)" style={{ ...tableInputStyle, width: 38, textAlign: "center" }} /></td>
                  <td style={{ padding: 3 }}><input type="number" value={wall.openings} onChange={(e) => updateWall(wall.id, "openings", +e.target.value)} aria-label="Openings" style={{ ...tableInputStyle, width: 38, textAlign: "center" }} /></td>
                  <td style={{ padding: "3px 5px", textAlign: "center", color: colors.text, fontFamily: fonts.mono }}>{calc?.totalStuds ?? "—"}</td>
                  <td style={{ padding: "3px 5px", textAlign: "center", color: colors.green, fontFamily: fonts.mono, fontWeight: 700 }}>{calc?.studsWithWaste ?? "—"}</td>
                  <td style={{ padding: "3px 5px", textAlign: "center", color: colors.text, fontFamily: fonts.mono }}>{calc ? calc.topPlates + calc.bottomPlates : "—"}</td>
                  <td style={{ padding: "3px 5px", textAlign: "center", color: colors.text, fontFamily: fonts.mono }}>{calc?.sheathingSheets ?? "—"}</td>
                  <td style={{ padding: "3px 5px", textAlign: "right", color: colors.blue, fontFamily: fonts.mono, fontWeight: 600 }}>{calc ? `$${Math.round(calc.materialCost).toLocaleString()}` : "—"}</td>
                  <td style={{ padding: "3px 5px", textAlign: "right", color: colors.teal, fontFamily: fonts.mono, fontWeight: 600 }}>{calc ? `$${Math.round(calc.laborCost).toLocaleString()}` : "—"}</td>
                  <td style={{ padding: "3px 5px", textAlign: "right", color: colors.accent, fontFamily: fonts.mono, fontWeight: 800 }}>{calc ? `$${Math.round(calc.totalCost).toLocaleString()}` : "—"}</td>
                  <td style={{ padding: 3 }}><button onClick={() => removeWall(wall.id)} aria-label={`Remove ${wall.name || "wall"}`} style={deleteButtonStyle}>×</button></td>
                </tr>
              );
            })}</tbody>
          </table>
        </div>
        <button onClick={addWall} style={addButtonStyle}>+ Add Wall</button>
      </Section>

      <Section title="Totals" color={colors.green}>
        <Row>
          <ResultCard label="Total Wall LF" value={totals.linearFeet} unit="LF" color={colors.blue} large />
          <ResultCard label="Studs" value={totals.studs} unit="pcs" color={colors.accent} large />
          <ResultCard label="Plates" value={totals.plates} unit="16'" color={colors.teal} />
          <ResultCard label="Sheathing" value={totals.sheathing} unit="sheets" color={colors.purple} />
          <ResultCard label="Material" value={`$${Math.round(totals.material).toLocaleString()}`} color={colors.blue} large />
          <ResultCard label="Labor" value={`$${Math.round(totals.labor).toLocaleString()}`} color={colors.teal} />
          <ResultCard label="Total" value={`$${Math.round(totals.total).toLocaleString()}`} color={colors.green} large />
        </Row>
      </Section>
    </div>
  );
}
