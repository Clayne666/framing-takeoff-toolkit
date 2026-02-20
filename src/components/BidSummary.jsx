import { useState } from "react";
import { colors, fonts } from "../theme";
import { Section, Row, ResultCard, NumberInput } from "./ui";

export default function BidSummary({ wallTotal, floorTotal, roofTotal }) {
  const [markupPercent, setMarkupPercent] = useState(15);
  const [totalSquareFeet, setTotalSquareFeet] = useState(2500);
  const [extras, setExtras] = useState([
    { id: 1, name: "Blocking", cost: 0 },
    { id: 2, name: "Hardware", cost: 0 },
    { id: 3, name: "Misc", cost: 0 },
  ]);

  const extrasCost = extras.reduce((sum, item) => sum + item.cost, 0);
  const subtotal = wallTotal + floorTotal + roofTotal + extrasCost;
  const markup = (subtotal * markupPercent) / 100;
  const bidTotal = subtotal + markup;

  const lineItems = [
    { name: "Walls", value: wallTotal, color: colors.accent },
    { name: "Floors", value: floorTotal, color: colors.blue },
    { name: "Roof", value: roofTotal, color: colors.purple },
  ];

  const updateExtraCost = (id, newCost) => {
    setExtras((prev) => prev.map((item) => (item.id === id ? { ...item, cost: newCost } : item)));
  };

  return (
    <div>
      <Section title="Summary" color={colors.accent}>
        {lineItems.map((item) => (
          <div key={item.name} style={{ display: "flex", justifyContent: "space-between", padding: "10px 14px", background: colors.card, borderRadius: 8, borderLeft: `3px solid ${item.color}`, marginBottom: 6 }}>
            <span style={{ color: colors.text, fontWeight: 600 }}>{item.name}</span>
            <span style={{ color: item.color, fontWeight: 800, fontFamily: fonts.mono, fontSize: 18 }}>${Math.round(item.value).toLocaleString()}</span>
          </div>
        ))}

        {extras.map((extra) => (
          <div key={extra.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 14px", background: colors.card, borderRadius: 8, borderLeft: `3px solid ${colors.dim}`, marginBottom: 6 }}>
            <span style={{ color: colors.muted, fontWeight: 600, fontSize: 13 }}>{extra.name}</span>
            <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
              <span style={{ color: colors.muted }}>$</span>
              <input type="number" value={extra.cost} onChange={(e) => updateExtraCost(extra.id, +e.target.value)} aria-label={`${extra.name} cost`}
                style={{ background: colors.inputBg, border: `1px solid ${colors.inputBorder}`, borderRadius: 4, padding: "5px 8px", color: colors.accentGlow, fontSize: 14, fontFamily: fonts.mono, width: 85, textAlign: "right", outline: "none" }}
              />
            </div>
          </div>
        ))}
      </Section>

      <Section title="Bid" color={colors.green}>
        <Row>
          <NumberInput label="Markup" value={markupPercent} onChange={setMarkupPercent} unit="%" />
          <NumberInput label="Total SF" value={totalSquareFeet} onChange={setTotalSquareFeet} unit="SF" />
        </Row>
        <div style={{ marginTop: 12 }}>
          <Row>
            <ResultCard label="Subtotal" value={`$${Math.round(subtotal).toLocaleString()}`} color={colors.blue} large />
            <ResultCard label={`Markup (${markupPercent}%)`} value={`$${Math.round(markup).toLocaleString()}`} color={colors.orange} />
            <ResultCard label="BID TOTAL" value={`$${Math.round(bidTotal).toLocaleString()}`} color={colors.green} large />
            <ResultCard label="$/SF" value={totalSquareFeet > 0 ? `$${(bidTotal / totalSquareFeet).toFixed(2)}` : "—"} color={colors.accent} large />
          </Row>
        </div>
      </Section>
    </div>
  );
}
