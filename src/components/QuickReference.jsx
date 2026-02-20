import { useState } from "react";
import { colors } from "../theme";
import { SHEATHING_WASTE_FACTOR, SHEET_COVERAGE_SF } from "../constants";
import { Section, Row, ResultCard, NumberInput, SelectInput } from "./ui";

const TOOLS = [
  { id: "studs", label: "Studs" },
  { id: "boardFeet", label: "Board Ft" },
  { id: "sheathing", label: "Sheathing" },
  { id: "headers", label: "Headers" },
  { id: "joists", label: "Joists" },
];

function StudCalculator() {
  const [wallLength, setWallLength] = useState(24);
  const [spacing, setSpacing] = useState(16);
  const [openings, setOpenings] = useState(2);
  const [wastePercent, setWastePercent] = useState(10);

  const baseStuds = Math.ceil((wallLength * 12) / spacing) + 1 + openings * 6 + 3;
  const studsWithWaste = Math.ceil(baseStuds * (1 + wastePercent / 100));

  return (
    <div>
      <Row>
        <NumberInput label="Wall Len" value={wallLength} onChange={setWallLength} unit="ft" />
        <NumberInput label="Spacing" value={spacing} onChange={setSpacing} unit="in" />
        <NumberInput label="Opens" value={openings} onChange={setOpenings} />
        <NumberInput label="Waste" value={wastePercent} onChange={setWastePercent} unit="%" />
      </Row>
      <div style={{ marginTop: 12 }}>
        <Row>
          <ResultCard label="Total Studs" value={baseStuds} color={colors.accent} large />
          <ResultCard label="With Waste" value={studsWithWaste} color={colors.green} large />
          <ResultCard label="Top Plates" value={Math.ceil((wallLength * 2) / 16)} unit="16'" color={colors.blue} />
          <ResultCard label="Btm Plate" value={Math.ceil(wallLength / 16)} unit="16'" color={colors.teal} />
        </Row>
      </div>
    </div>
  );
}

function BoardFeetCalculator() {
  const [thickness, setThickness] = useState(2);
  const [width, setWidth] = useState(6);
  const [length, setLength] = useState(12);
  const [quantity, setQuantity] = useState(10);

  const boardFeetPerPiece = (thickness * width * length) / 12;

  return (
    <div>
      <Row>
        <NumberInput label="Thick" value={thickness} onChange={setThickness} unit="in" />
        <NumberInput label="Width" value={width} onChange={setWidth} unit="in" />
        <NumberInput label="Length" value={length} onChange={setLength} unit="ft" />
        <NumberInput label="Qty" value={quantity} onChange={setQuantity} />
      </Row>
      <div style={{ marginTop: 12 }}>
        <Row>
          <ResultCard label="BF/pc" value={boardFeetPerPiece} unit="BF" color={colors.accent} large />
          <ResultCard label="Total BF" value={boardFeetPerPiece * quantity} unit="BF" color={colors.green} large />
          <ResultCard label="MBF" value={((boardFeetPerPiece * quantity) / 1000).toFixed(3)} color={colors.blue} />
        </Row>
      </div>
    </div>
  );
}

function SheathingCalculator() {
  const [length, setLength] = useState(40);
  const [height, setHeight] = useState(8);

  const area = length * height;
  const sheets = Math.ceil((area / SHEET_COVERAGE_SF) * SHEATHING_WASTE_FACTOR);

  return (
    <div>
      <Row>
        <NumberInput label="Length" value={length} onChange={setLength} unit="ft" />
        <NumberInput label="Height" value={height} onChange={setHeight} unit="ft" />
      </Row>
      <div style={{ marginTop: 12 }}>
        <Row>
          <ResultCard label="Area" value={area} unit="SF" color={colors.blue} large />
          <ResultCard label="Sheets (8%)" value={sheets} unit="4×8" color={colors.green} large />
        </Row>
      </div>
    </div>
  );
}

function HeaderCalculator() {
  const [openingWidth, setOpeningWidth] = useState(36);
  const [isLoadBearing, setIsLoadBearing] = useState("yes");

  const headerSize =
    isLoadBearing === "no" ? "2×4 flat"
    : openingWidth <= 36 ? "2×6"
    : openingWidth <= 48 ? "2×8"
    : openingWidth <= 72 ? "2×10"
    : openingWidth <= 96 ? "2×12"
    : "LVL";

  return (
    <div>
      <Row>
        <NumberInput label="Opening" value={openingWidth} onChange={setOpeningWidth} unit="in" />
        <SelectInput label="Bearing" value={isLoadBearing} onChange={setIsLoadBearing} options={[{ value: "yes", label: "Yes" }, { value: "no", label: "No" }]} />
      </Row>
      <div style={{ marginTop: 12, background: `${colors.accent}12`, border: `1px solid ${colors.accent}30`, borderRadius: 10, padding: "14px 18px" }}>
        <div style={{ fontSize: 10, color: colors.muted, textTransform: "uppercase" }}>Recommended</div>
        <div style={{ fontSize: 28, fontWeight: 800, color: colors.accent }}>{headerSize}</div>
      </div>
      <div style={{ marginTop: 10 }}>
        <Row>
          <ResultCard label="Header Len" value={(openingWidth / 12 + 0.5).toFixed(1)} unit="ft" color={colors.blue} />
          <ResultCard label="Trimmers" value={2} color={colors.teal} />
          <ResultCard label="Kings" value={2} color={colors.purple} />
        </Row>
      </div>
    </div>
  );
}

function JoistCalculator() {
  const [span, setSpan] = useState(20);
  const [width, setWidth] = useState(30);
  const [spacing, setSpacing] = useState(16);

  const joistCount = Math.ceil((width * 12) / spacing) + 1;
  const recommendedSize =
    spacing <= 16
      ? (span <= 10 ? "2×8" : span <= 14 ? "2×10" : span <= 18 ? "2×12" : "TJI")
      : (span <= 8 ? "2×8" : span <= 12 ? "2×10" : span <= 15 ? "2×12" : "TJI");

  return (
    <div>
      <Row>
        <NumberInput label="Span" value={span} onChange={setSpan} unit="ft" />
        <NumberInput label="Width" value={width} onChange={setWidth} unit="ft" />
        <NumberInput label="Spacing" value={spacing} onChange={setSpacing} unit="in" />
      </Row>
      <div style={{ marginTop: 12, background: `${colors.blue}12`, border: `1px solid ${colors.blue}30`, borderRadius: 10, padding: "14px 18px" }}>
        <div style={{ fontSize: 10, color: colors.muted, textTransform: "uppercase" }}>Recommended</div>
        <div style={{ fontSize: 28, fontWeight: 800, color: colors.blue }}>{recommendedSize}</div>
      </div>
      <div style={{ marginTop: 10 }}>
        <Row>
          <ResultCard label="Joists" value={joistCount} unit="pcs" color={colors.accent} large />
          <ResultCard label="SF" value={span * width} color={colors.blue} />
          <ResultCard label="Rim Board" value={(span + width) * 2} unit="LF" color={colors.teal} />
          <ResultCard label="Subfloor" value={Math.ceil((span * width / SHEET_COVERAGE_SF) * SHEATHING_WASTE_FACTOR)} unit="sheets" color={colors.purple} />
        </Row>
      </div>
    </div>
  );
}

const CALCULATORS = {
  studs: StudCalculator,
  boardFeet: BoardFeetCalculator,
  sheathing: SheathingCalculator,
  headers: HeaderCalculator,
  joists: JoistCalculator,
};

export default function QuickReference() {
  const [activeTool, setActiveTool] = useState("studs");
  const ActiveCalculator = CALCULATORS[activeTool];

  return (
    <div>
      <nav style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 14 }} aria-label="Calculator tools">
        {TOOLS.map((tool) => (
          <button key={tool.id} onClick={() => setActiveTool(tool.id)} aria-current={activeTool === tool.id ? "page" : undefined}
            style={{ padding: "7px 14px", borderRadius: 6, border: "none", cursor: "pointer", background: activeTool === tool.id ? colors.accent : colors.raised, color: activeTool === tool.id ? colors.background : colors.muted, fontWeight: 700, fontSize: 12 }}
          >{tool.label}</button>
        ))}
      </nav>
      <ActiveCalculator />
    </div>
  );
}
