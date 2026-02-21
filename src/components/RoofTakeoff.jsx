import { useState, useMemo, useEffect, useRef } from "react";
import { colors, fonts, addButtonStyle, deleteButtonStyle } from "../theme";
import { LUMBER_PRICES, LABOR_RATES, PITCH_FACTORS } from "../constants";
import { Section, Row, ResultCard, NumberInput, SelectInput, LearnedBadge } from "./ui";

function getRafterPrice(size) {
  if (size === "2x10") return LUMBER_PRICES["2x10_16ft"];
  if (size === "2x12") return LUMBER_PRICES["2x12_16ft"];
  return LUMBER_PRICES["2x8_16ft"];
}

function calculateRoofSection(section, rafterSize, rafterSpacing, pitch, wastePercent, sheathingWastePercent) {
  const pitchFactor = PITCH_FACTORS[pitch] || PITCH_FACTORS["6/12"];
  const rafterLength = (section.span / 2) * pitchFactor;
  const raftersPerSide = Math.ceil((section.ridgeLength * 12) / rafterSpacing) + 1;
  const totalRafters = raftersPerSide * 2;
  const raftersWithWaste = Math.ceil(totalRafters * (1 + wastePercent / 100));
  const roofArea = section.ridgeLength * rafterLength * 2;
  const sheathingSheets = Math.ceil((roofArea / 32) * (1 + sheathingWastePercent / 100));

  const materialCost = raftersWithWaste * getRafterPrice(rafterSize) + sheathingSheets * LUMBER_PRICES.osb4x8 + totalRafters * LUMBER_PRICES.hurricaneTie;
  const laborCost = roofArea * LABOR_RATES.roofPerSquareFoot;

  return { ...section, rafterLength, totalRafters, raftersWithWaste, sheathingSheets, roofArea, materialCost, laborCost, totalCost: materialCost + laborCost };
}

const ROOF_DEFAULT_SETTINGS = { rafterSpacing: 24, rafterSize: "2x8", pitch: "6/12", wastePercent: 10, sheathingWaste: 8 };

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

export default function RoofTakeoff({ importedDims, importData, onTotalChange, initialState, onStateChange, smartDefaults }) {
  const effectiveDefaults = smartDefaults?.settings
    ? { ...ROOF_DEFAULT_SETTINGS, ...smartDefaults.settings }
    : ROOF_DEFAULT_SETTINGS;
  const [settings, setSettings] = useState(initialState?.settings || effectiveDefaults);
  const [sections, setSections] = useState(initialState?.sections?.length ? initialState.sections : [{ id: 1, name: "Main Roof", ridgeLength: 40, span: 28 }]);
  const importDataRef = useRef(null);
  const hasInitialized = useRef(false);

  useEffect(() => {
    if (!importedDims?.length) return;
    const imported = [];
    for (let i = 0; i < importedDims.length; i += 2) {
      imported.push({
        id: Date.now() + i, name: "Import",
        ridgeLength: Math.round((importedDims[i]?.feet || 0) * 10) / 10,
        span: Math.round((importedDims[i + 1]?.feet || importedDims[i]?.feet || 0) * 10) / 10,
      });
    }
    setSections((prev) => [...prev, ...imported]);
  }, [importedDims]);

  useEffect(() => {
    if (!importData || importData === importDataRef.current) return;
    importDataRef.current = importData;
    if (importData.settingsOverrides) setSettings((prev) => ({ ...prev, ...importData.settingsOverrides }));
    if (importData.sections?.length) setSections(importData.sections);
  }, [importData]);

  const addSection = () => setSections((prev) => [...prev, { id: Date.now(), name: "", ridgeLength: 0, span: 0 }]);
  const removeSection = (id) => setSections((prev) => prev.filter((s) => s.id !== id));
  const updateSection = (id, field, value) => setSections((prev) => prev.map((s) => (s.id === id ? { ...s, [field]: value } : s)));
  const updateSetting = (key, value) => setSettings((prev) => ({ ...prev, [key]: value }));

  const calculations = useMemo(() =>
    sections.filter((s) => s.ridgeLength > 0 && s.span > 0).map((s) => calculateRoofSection(s, settings.rafterSize, settings.rafterSpacing, settings.pitch, settings.wastePercent, settings.sheathingWaste)),
    [sections, settings]
  );

  const totals = calculations.reduce(
    (acc, c) => ({ roofArea: acc.roofArea + c.roofArea, rafters: acc.rafters + c.raftersWithWaste, sheathing: acc.sheathing + c.sheathingSheets, material: acc.material + c.materialCost, labor: acc.labor + c.laborCost, total: acc.total + c.totalCost }),
    { roofArea: 0, rafters: 0, sheathing: 0, material: 0, labor: 0, total: 0 }
  );

  useEffect(() => { onTotalChange?.(totals.total); }, [totals.total, onTotalChange]);

  useEffect(() => {
    if (!hasInitialized.current) { hasInitialized.current = true; return; }
    onStateChange?.({ settings, sections });
  }, [settings, sections, onStateChange]);

  return (
    <div>
      <Section title="Settings" color={colors.primary}>
        <Row>
          <SelectInput label={<>Rafter Size<LearnedBadge meta={smartDefaults?.meta} settingKey="rafterSize" /></>} value={settings.rafterSize} onChange={(v) => updateSetting("rafterSize", v)} options={[{ value: "2x8", label: "2x8" }, { value: "2x10", label: "2x10" }, { value: "2x12", label: "2x12" }]} />
          <SelectInput label={<>Spacing<LearnedBadge meta={smartDefaults?.meta} settingKey="rafterSpacing" /></>} value={String(settings.rafterSpacing)} onChange={(v) => updateSetting("rafterSpacing", +v)} options={[{ value: "16", label: '16"' }, { value: "24", label: '24"' }]} />
          <SelectInput label={<>Pitch<LearnedBadge meta={smartDefaults?.meta} settingKey="pitch" /></>} value={settings.pitch} onChange={(v) => updateSetting("pitch", v)} options={Object.keys(PITCH_FACTORS).map((p) => ({ value: p, label: p }))} />
          <NumberInput label="Waste" value={settings.wastePercent} onChange={(v) => updateSetting("wastePercent", v)} unit="%" />
        </Row>
      </Section>

      <Section title="Roof Sections" color={colors.warning}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 580 }}>
            <thead><tr>{["Section", "Ridge", "Span", "Rftr Len", "Rftrs", "+W", "Sheath", "Mat $", "Labor $", "Total $", ""].map((h) => <th key={h} style={lightHeader}>{h}</th>)}</tr></thead>
            <tbody>{sections.map((section, i) => {
              const calc = calculations.find((c) => c.id === section.id);
              return (
                <tr key={section.id} style={{ borderBottom: `1px solid ${colors.borderLight}`, background: i % 2 === 0 ? colors.contentBg : colors.contentAlt }}>
                  <td style={{ padding: 3 }}><input value={section.name} onChange={(e) => updateSection(section.id, "name", e.target.value)} placeholder="Section..." aria-label="Section name" style={{ ...lightInput, width: "100%", minWidth: 65 }} /></td>
                  <td style={{ padding: 3 }}><input type="number" value={section.ridgeLength} onChange={(e) => updateSection(section.id, "ridgeLength", +e.target.value)} aria-label="Ridge length (ft)" style={{ ...lightInput, width: 48, textAlign: "center" }} /></td>
                  <td style={{ padding: 3 }}><input type="number" value={section.span} onChange={(e) => updateSection(section.id, "span", +e.target.value)} aria-label="Span (ft)" style={{ ...lightInput, width: 48, textAlign: "center" }} /></td>
                  <td style={{ padding: "3px 5px", textAlign: "center", color: colors.textDark, fontFamily: fonts.mono, fontSize: 12 }}>{calc ? calc.rafterLength.toFixed(1) + "'" : "\u2014"}</td>
                  <td style={{ padding: "3px 5px", textAlign: "center", color: colors.textDark, fontFamily: fonts.mono, fontSize: 12 }}>{calc?.totalRafters ?? "\u2014"}</td>
                  <td style={{ padding: "3px 5px", textAlign: "center", color: colors.success, fontFamily: fonts.mono, fontWeight: 700, fontSize: 12 }}>{calc?.raftersWithWaste ?? "\u2014"}</td>
                  <td style={{ padding: "3px 5px", textAlign: "center", color: colors.textDark, fontFamily: fonts.mono, fontSize: 12 }}>{calc?.sheathingSheets ?? "\u2014"}</td>
                  <td style={{ padding: "3px 5px", textAlign: "right", color: colors.primary, fontFamily: fonts.mono, fontWeight: 600, fontSize: 12 }}>{calc ? "$" + Math.round(calc.materialCost).toLocaleString() : "\u2014"}</td>
                  <td style={{ padding: "3px 5px", textAlign: "right", color: colors.teal, fontFamily: fonts.mono, fontWeight: 600, fontSize: 12 }}>{calc ? "$" + Math.round(calc.laborCost).toLocaleString() : "\u2014"}</td>
                  <td style={{ padding: "3px 5px", textAlign: "right", color: colors.textDark, fontFamily: fonts.mono, fontWeight: 700, fontSize: 12 }}>{calc ? "$" + Math.round(calc.totalCost).toLocaleString() : "\u2014"}</td>
                  <td style={{ padding: 3 }}><button onClick={() => removeSection(section.id)} aria-label={"Remove " + (section.name || "section")} style={{ ...deleteButtonStyle, color: colors.danger, fontSize: 13 }}>x</button></td>
                </tr>
              );
            })}</tbody>
          </table>
        </div>
        <button onClick={addSection} style={{ ...addButtonStyle, borderColor: colors.borderMid, color: colors.muted }}>+ Add Section</button>
      </Section>

      <Section title="Totals" color={colors.success}>
        <Row>
          <ResultCard label="Roof Area" value={Math.round(totals.roofArea)} unit="SF" color={colors.primary} large />
          <ResultCard label="Rafters" value={totals.rafters} unit="pcs" color={colors.warning} large />
          <ResultCard label="Sheathing" value={totals.sheathing} unit="sheets" color={colors.purple} />
          <ResultCard label="Material" value={"$" + Math.round(totals.material).toLocaleString()} color={colors.primary} large />
          <ResultCard label="Labor" value={"$" + Math.round(totals.labor).toLocaleString()} color={colors.teal} />
          <ResultCard label="Total" value={"$" + Math.round(totals.total).toLocaleString()} color={colors.success} large />
        </Row>
      </Section>
    </div>
  );
}
