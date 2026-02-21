import { useState, useEffect, useRef } from "react";
import { colors, fonts } from "../theme";
import { Section, Row, ResultCard, NumberInput, LearnedBadge } from "./ui";

const DEFAULT_EXTRAS = [
  { id: 1, name: "Blocking", cost: 0 },
  { id: 2, name: "Headers", cost: 0 },
  { id: 3, name: "Hardware / Connections", cost: 0 },
  { id: 4, name: "Steel Members", cost: 0 },
  { id: 5, name: "Misc", cost: 0 },
];

export default function BidSummary({ wallTotal, floorTotal, roofTotal, extractionResult, initialState, onStateChange, smartDefaults }) {
  const defaultMarkup = smartDefaults?.settings?.markupPercent ?? 15;
  const [markupPercent, setMarkupPercent] = useState(initialState?.markupPercent ?? defaultMarkup);
  const [totalSquareFeet, setTotalSquareFeet] = useState(initialState?.totalSquareFeet ?? 2500);
  const [extras, setExtras] = useState(initialState?.extras?.length ? initialState.extras : DEFAULT_EXTRAS);
  const hasInitialized = useRef(false);

  const extrasCost = extras.reduce((sum, item) => sum + item.cost, 0);
  const subtotal = wallTotal + floorTotal + roofTotal + extrasCost;
  const markup = (subtotal * markupPercent) / 100;
  const bidTotal = subtotal + markup;

  const lineItems = [
    { name: "Walls", value: wallTotal, color: colors.warning },
    { name: "Floors", value: floorTotal, color: colors.primary },
    { name: "Roof", value: roofTotal, color: colors.purple },
  ];

  useEffect(() => {
    if (!hasInitialized.current) { hasInitialized.current = true; return; }
    onStateChange?.({ markupPercent, totalSquareFeet, extras });
  }, [markupPercent, totalSquareFeet, extras, onStateChange]);

  const updateExtraCost = (id, newCost) => {
    setExtras((prev) => prev.map((item) => (item.id === id ? { ...item, cost: newCost } : item)));
  };

  const er = extractionResult;
  const hasExtraction = er && (er.wallTypes?.length > 0 || er.openings?.length > 0 || er.steelMembers?.length > 0);

  return (
    <div>
      {hasExtraction && (
        <Section title="Extraction Summary" color={colors.info}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {er.wallTypes?.length > 0 && <ResultCard label="Wall Types" value={er.wallTypes.length} color={colors.warning} />}
            {er.wallSegments?.length > 0 && <ResultCard label="Wall Segs" value={er.wallSegments.length} color={colors.success} />}
            {er.openings?.length > 0 && <ResultCard label="Openings" value={er.openings.reduce((s, o) => s + (o.quantity || 1), 0)} color={colors.purple} />}
            {er.structuralMembers?.length > 0 && <ResultCard label="Struct Members" value={er.structuralMembers.length} color={colors.primary} />}
            {er.steelMembers?.length > 0 && <ResultCard label="Steel Members" value={er.steelMembers.length} color={colors.orange} />}
            {er.hardware?.length > 0 && <ResultCard label="Hardware" value={er.hardware.length} color={colors.teal} />}
          </div>
          {er.warnings?.length > 0 && (
            <div style={{ marginTop: 8, fontSize: 11, color: colors.warning }}>
              {er.warnings.length} warning(s) from extraction — review in Plans tab
            </div>
          )}
        </Section>
      )}

      <Section title="Cost Summary" color={colors.primary}>
        {lineItems.map((item) => (
          <div key={item.name} style={{
            display: "flex", justifyContent: "space-between", padding: "10px 14px",
            background: colors.contentBg, borderRadius: 6,
            borderLeft: `3px solid ${item.color}`,
            marginBottom: 6,
            border: `1px solid ${colors.borderLight}`,
            borderLeftWidth: 3,
            borderLeftColor: item.color,
          }}>
            <span style={{ color: colors.textDark, fontWeight: 600, fontSize: 13 }}>{item.name}</span>
            <span style={{ color: item.color, fontWeight: 700, fontFamily: fonts.mono, fontSize: 16 }}>${Math.round(item.value).toLocaleString()}</span>
          </div>
        ))}

        {extras.map((extra) => (
          <div key={extra.id} style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            padding: "8px 14px", background: colors.contentBg, borderRadius: 6,
            border: `1px solid ${colors.borderLight}`,
            borderLeft: `3px solid ${colors.borderMid}`,
            marginBottom: 6,
          }}>
            <span style={{ color: colors.muted, fontWeight: 600, fontSize: 12 }}>{extra.name}</span>
            <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
              <span style={{ color: colors.muted, fontSize: 12 }}>$</span>
              <input type="number" value={extra.cost} onChange={(e) => updateExtraCost(extra.id, +e.target.value)} aria-label={extra.name + " cost"}
                style={{
                  background: colors.contentBg, border: `1px solid ${colors.borderLight}`,
                  borderRadius: 3, padding: "5px 8px", color: colors.textDark, fontSize: 13,
                  fontFamily: fonts.mono, width: 85, textAlign: "right", outline: "none",
                }}
              />
            </div>
          </div>
        ))}
      </Section>

      <Section title="Bid Calculation" color={colors.success}>
        <Row>
          <NumberInput label={<>Markup<LearnedBadge meta={smartDefaults?.meta} settingKey="markupPercent" /></>} value={markupPercent} onChange={setMarkupPercent} unit="%" />
          <NumberInput label="Total SF" value={totalSquareFeet} onChange={setTotalSquareFeet} unit="SF" />
        </Row>
        <div style={{ marginTop: 12 }}>
          <Row>
            <ResultCard label="Subtotal" value={"$" + Math.round(subtotal).toLocaleString()} color={colors.primary} large />
            <ResultCard label={"Markup (" + markupPercent + "%)"} value={"$" + Math.round(markup).toLocaleString()} color={colors.orange} />
            <ResultCard label="BID TOTAL" value={"$" + Math.round(bidTotal).toLocaleString()} color={colors.success} large />
            <ResultCard label="$/SF" value={totalSquareFeet > 0 ? "$" + (bidTotal / totalSquareFeet).toFixed(2) : "\u2014"} color={colors.warning} large />
          </Row>
        </div>
      </Section>
    </div>
  );
}
