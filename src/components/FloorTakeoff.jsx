import { useState, useMemo, useEffect } from "react";
import { colors, fonts, tableInputStyle, tableHeaderStyle, addButtonStyle, deleteButtonStyle } from "../theme";
import { LUMBER_PRICES, LABOR_RATES, SHEATHING_WASTE_FACTOR, SHEET_COVERAGE_SF } from "../constants";
import { Section, Row, ResultCard, NumberInput, SelectInput } from "./ui";

function getJoistPrice(size) {
  if (size === "2x12") return LUMBER_PRICES["2x12_16ft"];
  if (size === "2x8") return LUMBER_PRICES["2x8_16ft"];
  return LUMBER_PRICES["2x10_16ft"];
}

function getHangerPrice(size) {
  if (size === "2x12") return LUMBER_PRICES.hanger2x12;
  if (size === "2x8") return LUMBER_PRICES.hanger2x8;
  return LUMBER_PRICES.hanger2x10;
}

function calculateFloorArea(area, joistSize, joistSpacing, wastePercent) {
  const squareFeet = area.span * area.width;
  const joistCount = Math.ceil((area.width * 12) / joistSpacing) + 1;
  const joistsWithWaste = Math.ceil(joistCount * (1 + wastePercent / 100));
  const subfloorSheets = Math.ceil((squareFeet / SHEET_COVERAGE_SF) * SHEATHING_WASTE_FACTOR);
  const hangerCount = joistCount * 2;

  const materialCost = joistsWithWaste * getJoistPrice(joistSize) + subfloorSheets * LUMBER_PRICES.plywood3_4 + hangerCount * getHangerPrice(joistSize);
  const laborCost = squareFeet * LABOR_RATES.floorPerSquareFoot;

  return { ...area, squareFeet, joistCount, joistsWithWaste, subfloorSheets, hangerCount, materialCost, laborCost, totalCost: materialCost + laborCost };
}

export default function FloorTakeoff({ importedDims, onTotalChange }) {
  const [settings, setSettings] = useState({ joistSpacing: 16, joistSize: "2x10", wastePercent: 10 });
  const [areas, setAreas] = useState([{ id: 1, name: "Main Floor", span: 20, width: 40 }]);

  useEffect(() => {
    if (!importedDims?.length) return;
    const imported = [];
    for (let i = 0; i < importedDims.length; i += 2) {
      imported.push({
        id: Date.now() + i, name: "Import",
        span: Math.round((importedDims[i]?.feet || 0) * 10) / 10,
        width: Math.round((importedDims[i + 1]?.feet || importedDims[i]?.feet || 0) * 10) / 10,
      });
    }
    setAreas((prev) => [...prev, ...imported]);
  }, [importedDims]);

  const addArea = () => setAreas((prev) => [...prev, { id: Date.now(), name: "", span: 0, width: 0 }]);
  const removeArea = (id) => setAreas((prev) => prev.filter((a) => a.id !== id));
  const updateArea = (id, field, value) => setAreas((prev) => prev.map((a) => (a.id === id ? { ...a, [field]: value } : a)));
  const updateSetting = (key, value) => setSettings((prev) => ({ ...prev, [key]: value }));

  const calculations = useMemo(() =>
    areas.filter((a) => a.span > 0 && a.width > 0).map((a) => calculateFloorArea(a, settings.joistSize, settings.joistSpacing, settings.wastePercent)),
    [areas, settings]
  );

  const totals = calculations.reduce(
    (acc, c) => ({ squareFeet: acc.squareFeet + c.squareFeet, joists: acc.joists + c.joistsWithWaste, subfloor: acc.subfloor + c.subfloorSheets, material: acc.material + c.materialCost, labor: acc.labor + c.laborCost, total: acc.total + c.totalCost }),
    { squareFeet: 0, joists: 0, subfloor: 0, material: 0, labor: 0, total: 0 }
  );

  useEffect(() => { onTotalChange?.(totals.total); }, [totals.total, onTotalChange]);

  return (
    <div>
      <Section title="Settings" color={colors.blue}>
        <Row>
          <SelectInput label="Joist Size" value={settings.joistSize} onChange={(v) => updateSetting("joistSize", v)} options={[{ value: "2x8", label: "2×8" }, { value: "2x10", label: "2×10" }, { value: "2x12", label: "2×12" }]} />
          <SelectInput label="Spacing" value={String(settings.joistSpacing)} onChange={(v) => updateSetting("joistSpacing", +v)} options={[{ value: "12", label: '12"' }, { value: "16", label: '16"' }, { value: "24", label: '24"' }]} />
          <NumberInput label="Waste" value={settings.wastePercent} onChange={(v) => updateSetting("wastePercent", v)} unit="%" />
        </Row>
      </Section>

      <Section title="Floor Areas" color={colors.accent}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 580 }}>
            <thead><tr>{["Area", "Span", "Width", "SF", "Joists", "+W", "Subflr", "Hngrs", "Mat $", "Labor $", "Total $", ""].map((h) => <th key={h} style={tableHeaderStyle}>{h}</th>)}</tr></thead>
            <tbody>{areas.map((area, i) => {
              const calc = calculations.find((c) => c.id === area.id);
              return (
                <tr key={area.id} style={{ borderBottom: `1px solid ${colors.border}`, background: i % 2 === 0 ? colors.surface : "transparent" }}>
                  <td style={{ padding: 3 }}><input value={area.name} onChange={(e) => updateArea(area.id, "name", e.target.value)} placeholder="Area..." aria-label="Area name" style={{ ...tableInputStyle, width: "100%", minWidth: 65 }} /></td>
                  <td style={{ padding: 3 }}><input type="number" value={area.span} onChange={(e) => updateArea(area.id, "span", +e.target.value)} aria-label="Span (ft)" style={{ ...tableInputStyle, width: 48, textAlign: "center" }} /></td>
                  <td style={{ padding: 3 }}><input type="number" value={area.width} onChange={(e) => updateArea(area.id, "width", +e.target.value)} aria-label="Width (ft)" style={{ ...tableInputStyle, width: 48, textAlign: "center" }} /></td>
                  <td style={{ padding: "3px 5px", textAlign: "center", color: colors.text, fontFamily: fonts.mono }}>{calc?.squareFeet?.toLocaleString() ?? "—"}</td>
                  <td style={{ padding: "3px 5px", textAlign: "center", color: colors.text, fontFamily: fonts.mono }}>{calc?.joistCount ?? "—"}</td>
                  <td style={{ padding: "3px 5px", textAlign: "center", color: colors.green, fontFamily: fonts.mono, fontWeight: 700 }}>{calc?.joistsWithWaste ?? "—"}</td>
                  <td style={{ padding: "3px 5px", textAlign: "center", color: colors.text, fontFamily: fonts.mono }}>{calc?.subfloorSheets ?? "—"}</td>
                  <td style={{ padding: "3px 5px", textAlign: "center", color: colors.text, fontFamily: fonts.mono }}>{calc?.hangerCount ?? "—"}</td>
                  <td style={{ padding: "3px 5px", textAlign: "right", color: colors.blue, fontFamily: fonts.mono, fontWeight: 600 }}>{calc ? `$${Math.round(calc.materialCost).toLocaleString()}` : "—"}</td>
                  <td style={{ padding: "3px 5px", textAlign: "right", color: colors.teal, fontFamily: fonts.mono, fontWeight: 600 }}>{calc ? `$${Math.round(calc.laborCost).toLocaleString()}` : "—"}</td>
                  <td style={{ padding: "3px 5px", textAlign: "right", color: colors.accent, fontFamily: fonts.mono, fontWeight: 800 }}>{calc ? `$${Math.round(calc.totalCost).toLocaleString()}` : "—"}</td>
                  <td style={{ padding: 3 }}><button onClick={() => removeArea(area.id)} aria-label={`Remove ${area.name || "area"}`} style={deleteButtonStyle}>×</button></td>
                </tr>
              );
            })}</tbody>
          </table>
        </div>
        <button onClick={addArea} style={addButtonStyle}>+ Add Area</button>
      </Section>

      <Section title="Totals" color={colors.green}>
        <Row>
          <ResultCard label="Total SF" value={totals.squareFeet} unit="SF" color={colors.blue} large />
          <ResultCard label="Joists" value={totals.joists} unit="pcs" color={colors.accent} large />
          <ResultCard label="Subfloor" value={totals.subfloor} unit="sheets" color={colors.purple} />
          <ResultCard label="Material" value={`$${Math.round(totals.material).toLocaleString()}`} color={colors.blue} large />
          <ResultCard label="Labor" value={`$${Math.round(totals.labor).toLocaleString()}`} color={colors.teal} />
          <ResultCard label="Total" value={`$${Math.round(totals.total).toLocaleString()}`} color={colors.green} large />
        </Row>
      </Section>
    </div>
  );
}
