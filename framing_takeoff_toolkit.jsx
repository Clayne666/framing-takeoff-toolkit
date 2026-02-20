import { useState, useMemo, useCallback, useRef, useEffect } from "react";

const C = {
  bg: "#0a0e17", surface: "#111827", card: "#1a2234", raised: "#1f2b3f",
  accent: "#f59e0b", accentDim: "#b47608", accentGlow: "#fbbf24",
  blue: "#3b82f6", teal: "#14b8a6", green: "#22c55e", rose: "#f43f5e",
  purple: "#a78bfa", orange: "#fb923c", cyan: "#06b6d4",
  text: "#e2e8f0", muted: "#64748b", dim: "#475569",
  border: "#1e293b", inputBg: "#0f1729", inputBorder: "#2d3a50",
};
const mono = "'JetBrains Mono', monospace";
const sans = "'Inter', -apple-system, sans-serif";

function N({ label, value, onChange, unit, min = 0, step = 1 }) {
  return (<div style={{ flex: "1 1 130px", minWidth: 100 }}>
    <div style={{ fontSize: 10, color: C.muted, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 3 }}>{label}</div>
    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
      <input type="number" value={value} onChange={e => onChange(+e.target.value)} min={min} step={step} style={{ width: "100%", background: C.inputBg, border: "1px solid " + C.inputBorder, borderRadius: 6, padding: "8px 10px", color: C.accentGlow, fontSize: 16, fontWeight: 700, fontFamily: mono, outline: "none" }} />
      {unit && <span style={{ fontSize: 11, color: C.dim, fontWeight: 700, whiteSpace: "nowrap" }}>{unit}</span>}
    </div>
  </div>);
}
function S({ label, value, onChange, options }) {
  return (<div style={{ flex: "1 1 130px", minWidth: 100 }}>
    <div style={{ fontSize: 10, color: C.muted, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 3 }}>{label}</div>
    <select value={value} onChange={e => onChange(e.target.value)} style={{ width: "100%", background: C.inputBg, border: "1px solid " + C.inputBorder, borderRadius: 6, padding: "8px 10px", color: C.accentGlow, fontSize: 14, fontWeight: 700, fontFamily: mono, outline: "none" }}>
      {options.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
    </select>
  </div>);
}
function R({ label, value, unit, color = C.accent, big }) {
  return (<div style={{ background: C.card, borderRadius: 8, padding: big ? "14px 16px" : "10px 12px", border: "1px solid " + color + "22", flex: "1 1 130px", minWidth: 100 }}>
    <div style={{ fontSize: 9, color: C.muted, textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700 }}>{label}</div>
    <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginTop: 2 }}>
      <span style={{ fontSize: big ? 28 : 20, fontWeight: 800, color, fontFamily: mono }}>{typeof value === "number" ? (value % 1 === 0 ? value.toLocaleString() : value.toLocaleString(undefined, { maximumFractionDigits: 1 })) : value}</span>
      {unit && <span style={{ fontSize: 11, color: C.dim, fontWeight: 600 }}>{unit}</span>}
    </div>
  </div>);
}
function Sec({ title, children, color = C.accent }) {
  return (<div style={{ marginBottom: 20 }}>
    <div style={{ fontSize: 11, fontWeight: 800, color, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 10, paddingBottom: 4, borderBottom: "1px solid " + color + "33" }}>{title}</div>
    {children}
  </div>);
}
function Row({ children }) { return <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>{children}</div>; }

const LUMBER = { "2x4-stud": 4.28, "2x4-16": 10.98, "2x6-stud": 6.78, "2x6-16": 17.48, "2x8-16": 21.98, "2x10-16": 28.48, "2x12-16": 35.98, osb: 14.98, ply34: 42.98, "h2x8": 2.45, "h2x10": 2.85, "h2x12": 3.15, hurricane: 1.85 };
const LAB = { wall: 8.50, floor: 3.25, roof: 4.50 };

function parseDimensions(text) {
  const dims = []; const seen = new Set();
  const pats = [
    { re: /(\d+)\s*['\u2032]\s*[-\s]?\s*(\d+)\s*[-\s](\d+)\/(\d+)\s*["\u2033]?/g, fn: m => ({ raw: m[0], ft: +m[1] + (+m[2] + +m[3]/+m[4])/12, type: "ft-in-frac" }) },
    { re: /(\d+)\s*['\u2032]\s*[-\s]?\s*(\d+)\s*["\u2033]/g, fn: m => ({ raw: m[0], ft: +m[1] + +m[2]/12, type: "ft-in" }) },
    { re: /(\d+\.\d+)\s*['\u2032]/g, fn: m => ({ raw: m[0], ft: +m[1], type: "dec-ft" }) },
    { re: /(\d+)\s*['\u2032](?!\s*[-\d])/g, fn: m => ({ raw: m[0], ft: +m[1], type: "ft" }) },
  ];
  for (const { re, fn } of pats) { let m; while ((m = re.exec(text)) !== null) { const d = fn(m); const k = d.raw + "|" + d.ft.toFixed(4); if (!seen.has(k) && d.ft > 0 && d.ft < 500) { seen.add(k); dims.push(d); } } }
  return dims;
}
function parseFramingRefs(text) {
  const re = /(2x\d+|4x\d+|LVL|TJI|I-?joist|truss|rafter|joist|stud|plate|header|beam|blocking|sheathing|OSB|plywood|simpson|hurricane|hanger|16\s*["\u2033]\s*[oO]\.?[cC]|24\s*["\u2033]\s*[oO]\.?[cC])/gi;
  const s = new Set(); let m; while ((m = re.exec(text)) !== null) s.add(m[0]); return [...s];
}
function parseRooms(text) {
  const re = /(bedroom|bathroom|bath|kitchen|living\s*room|dining|garage|closet|hallway|foyer|entry|laundry|utility|storage|office|den|family\s*room|great\s*room|master|bonus|loft|porch|deck|patio|mudroom|pantry)/gi;
  const s = new Set(); let m; while ((m = re.exec(text)) !== null) s.add(m[0].trim()); return [...s];
}

function PdfScanner({ onSendToWalls, onSendToFloors, onSendToRoof }) {
  const [pages, setPages] = useState([]);
  const [allDims, setAllDims] = useState([]);
  const [allRefs, setAllRefs] = useState([]);
  const [allRooms, setAllRooms] = useState([]);
  const [scanning, setScanning] = useState(false);
  const [fileName, setFileName] = useState("");
  const [progress, setProgress] = useState("");
  const [selectedDims, setSelectedDims] = useState(new Set());
  const [sendTarget, setSendTarget] = useState("walls");
  const [pdfLoaded, setPdfLoaded] = useState(false);
  const [pageImages, setPageImages] = useState([]);
  const [activePageIdx, setActivePageIdx] = useState(0);
  const [measuring, setMeasuring] = useState(false);
  const [measurePoints, setMeasurePoints] = useState([]);
  const [measurements, setMeasurements] = useState([]);
  const [scaleSet, setScaleSet] = useState(false);
  const [scalePx, setScalePx] = useState(0);
  const [scaleFt, setScaleFt] = useState(0);
  const [settingScale, setSettingScale] = useState(false);
  const [scalePoints, setScalePoints] = useState([]);
  const canvasRef = useRef(null);
  const imgRef = useRef(null);

  useEffect(() => {
    if (window.pdfjsLib) { setPdfLoaded(true); return; }
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
    s.onload = () => { window.pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js"; setPdfLoaded(true); };
    document.head.appendChild(s);
  }, []);

  const handleFile = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file || !window.pdfjsLib) return;
    setScanning(true); setFileName(file.name); setPages([]); setAllDims([]); setAllRefs([]); setAllRooms([]); setPageImages([]); setMeasurements([]); setScaleSet(false);
    try {
      const buf = await file.arrayBuffer();
      const pdf = await window.pdfjsLib.getDocument({ data: buf }).promise;
      const total = pdf.numPages; const ep = []; const ed = []; const rs = new Set(); const rms = new Set(); const imgs = [];
      for (let i = 1; i <= total; i++) {
        setProgress("Scanning page " + i + " of " + total + "...");
        const page = await pdf.getPage(i);
        const tc = await page.getTextContent();
        const text = tc.items.map(x => x.str).join(" ");
        const dims = parseDimensions(text); const refs = parseFramingRefs(text); const rooms = parseRooms(text);
        const vp = page.getViewport({ scale: 1.5 });
        const canvas = document.createElement("canvas"); canvas.width = vp.width; canvas.height = vp.height;
        await page.render({ canvasContext: canvas.getContext("2d"), viewport: vp }).promise;
        imgs.push({ dataUrl: canvas.toDataURL(), width: vp.width, height: vp.height });
        dims.forEach(d => ed.push({ ...d, page: i })); refs.forEach(r => rs.add(r)); rooms.forEach(r => rms.add(r));
        ep.push({ page: i, dims, refs, rooms, textLen: text.length });
      }
      setPages(ep); setAllDims(ed); setAllRefs([...rs]); setAllRooms([...rms]); setPageImages(imgs); setActivePageIdx(0);
      setProgress("Done — " + total + " pages scanned, " + ed.length + " dimensions found");
    } catch (err) { setProgress("Error: " + err.message); }
    setScanning(false);
  }, []);

  const toggleDim = i => setSelectedDims(p => { const n = new Set(p); n.has(i) ? n.delete(i) : n.add(i); return n; });

  const sendSelected = () => {
    const dims = [...selectedDims].map(i => allDims[i]);
    const manual = measurements.map(m => ({ raw: m.ft.toFixed(1) + "'", ft: m.ft, type: "measured", page: m.page + 1 }));
    const all = [...dims, ...manual];
    if (sendTarget === "walls") onSendToWalls(all);
    else if (sendTarget === "floors") onSendToFloors(all);
    else onSendToRoof(all);
  };

  const handleCanvasClick = (e) => {
    if (!measuring && !settingScale) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left; const y = e.clientY - rect.top;
    if (settingScale) {
      const np = [...scalePoints, { x, y }]; setScalePoints(np);
      if (np.length === 2) {
        const px = Math.sqrt((np[1].x-np[0].x)**2 + (np[1].y-np[0].y)**2);
        setScalePx(px);
        const ft = prompt("Real-world distance of that line in FEET?", "10");
        if (ft && +ft > 0) { setScaleFt(+ft); setScaleSet(true); }
        setSettingScale(false); setScalePoints([]);
      }
    } else if (measuring) {
      const np = [...measurePoints, { x, y }]; setMeasurePoints(np);
      if (np.length === 2) {
        const px = Math.sqrt((np[1].x-np[0].x)**2 + (np[1].y-np[0].y)**2);
        const ft = scaleSet ? (px / scalePx) * scaleFt : 0;
        setMeasurements(p => [...p, { p1: np[0], p2: np[1], px, ft, page: activePageIdx, label: "M" + (p.length + 1) }]);
        setMeasurePoints([]);
      }
    }
  };

  const drawOverlay = useCallback(() => {
    const canvas = canvasRef.current; const img = imgRef.current;
    if (!canvas || !img) return;
    canvas.width = img.clientWidth; canvas.height = img.clientHeight;
    const ctx = canvas.getContext("2d"); ctx.clearRect(0, 0, canvas.width, canvas.height);
    measurements.filter(m => m.page === activePageIdx).forEach(m => {
      ctx.beginPath(); ctx.moveTo(m.p1.x, m.p1.y); ctx.lineTo(m.p2.x, m.p2.y);
      ctx.strokeStyle = "#f59e0b"; ctx.lineWidth = 2.5; ctx.stroke();
      [m.p1, m.p2].forEach(p => { ctx.beginPath(); ctx.arc(p.x, p.y, 5, 0, Math.PI * 2); ctx.fillStyle = "#f59e0b"; ctx.fill(); ctx.strokeStyle = "#000"; ctx.lineWidth = 1; ctx.stroke(); });
      const mx = (m.p1.x + m.p2.x) / 2; const my = (m.p1.y + m.p2.y) / 2;
      const txt = scaleSet ? m.ft.toFixed(1) + "'" : Math.round(m.px) + "px";
      ctx.font = "bold 14px Inter, sans-serif";
      const tw = ctx.measureText(txt).width;
      ctx.fillStyle = "rgba(0,0,0,0.85)"; ctx.fillRect(mx - tw/2 - 6, my - 11, tw + 12, 22); ctx.roundRect && ctx.roundRect(mx - tw/2 - 6, my - 11, tw + 12, 22, 4);
      ctx.fillStyle = "#fbbf24"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(txt, mx, my);
    });
    const pts = settingScale ? scalePoints : measurePoints;
    pts.forEach(p => { ctx.beginPath(); ctx.arc(p.x, p.y, 6, 0, Math.PI * 2); ctx.fillStyle = settingScale ? "#3b82f6" : "#22c55e"; ctx.fill(); ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.stroke(); });
  }, [measurements, measurePoints, scalePoints, activePageIdx, scaleSet, scalePx, scaleFt, settingScale]);

  useEffect(() => { drawOverlay(); }, [drawOverlay, pageImages, activePageIdx]);

  const Btn = ({ children, onClick, color = C.accent, outline, disabled }) => (
    <button onClick={onClick} disabled={disabled} style={{ padding: "6px 14px", borderRadius: 6, cursor: disabled ? "not-allowed" : "pointer", background: outline ? "transparent" : disabled ? C.dim : color, border: outline ? "1px solid " + color : "none", color: outline ? color : C.bg, fontWeight: 700, fontSize: 11, opacity: disabled ? 0.5 : 1 }}>{children}</button>
  );

  return (<div>
    <Sec title="Upload Construction Plans (PDF)" color={C.cyan}>
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <label style={{ display: "inline-flex", alignItems: "center", gap: 8, background: pdfLoaded ? C.cyan : C.dim, color: C.bg, padding: "12px 24px", borderRadius: 8, cursor: pdfLoaded ? "pointer" : "not-allowed", fontWeight: 800, fontSize: 14 }}>
          {scanning ? "⏳ Scanning..." : "📄 Choose PDF File"}
          <input type="file" accept=".pdf" onChange={handleFile} disabled={!pdfLoaded || scanning} style={{ display: "none" }} />
        </label>
        {fileName && <span style={{ fontSize: 13, color: C.text, fontWeight: 600 }}>{fileName}</span>}
        {progress && <span style={{ fontSize: 12, color: C.green, fontWeight: 600 }}>{progress}</span>}
      </div>
    </Sec>

    {pages.length > 0 && (<>
      <Sec title="Scan Results" color={C.green}>
        <Row><R label="Pages" value={pages.length} color={C.cyan} big /><R label="Dimensions" value={allDims.length} color={C.accent} big /><R label="Framing Refs" value={allRefs.length} color={C.blue} /><R label="Rooms" value={allRooms.length} color={C.purple} /></Row>
      </Sec>

      <Sec title="Plan Viewer & Measuring Tool" color={C.accent}>
        <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ display: "flex", gap: 2 }}>
            {pageImages.map((_, i) => (<button key={i} onClick={() => { setActivePageIdx(i); setMeasurePoints([]); setScalePoints([]); }} style={{ padding: "4px 10px", borderRadius: 4, border: "none", cursor: "pointer", background: activePageIdx === i ? C.accent : C.raised, color: activePageIdx === i ? C.bg : C.muted, fontWeight: 700, fontSize: 11 }}>Pg {i + 1}</button>))}
          </div>
          <div style={{ width: 1, height: 20, background: C.border }} />
          <Btn onClick={() => { setSettingScale(true); setScalePoints([]); setMeasuring(false); }} color={C.blue} outline={!settingScale}>{settingScale ? "⏳ Click 2 pts..." : "📏 Set Scale"}</Btn>
          {scaleSet && <span style={{ fontSize: 11, color: C.green, fontWeight: 700, background: C.green + "15", padding: "3px 8px", borderRadius: 4 }}>✓ Scale: {scalePx.toFixed(0)}px = {scaleFt}'</span>}
          <Btn onClick={() => { setMeasuring(!measuring); setMeasurePoints([]); setSettingScale(false); }} color={C.green} outline={!measuring} disabled={!scaleSet}>{measuring ? "⏳ Click 2 pts..." : "📐 Measure"}</Btn>
          {measurements.length > 0 && <Btn onClick={() => setMeasurements([])} color={C.rose} outline>Clear</Btn>}
        </div>

        {!scaleSet && pageImages.length > 0 && (
          <div style={{ background: C.orange + "15", border: "1px solid " + C.orange + "40", borderRadius: 8, padding: "10px 14px", marginBottom: 10, fontSize: 12, color: C.orange }}>
            <strong>Step 1:</strong> Click "Set Scale" → click two endpoints of a known dimension on the plan → enter the real distance in feet. This calibrates all measurements.
          </div>
        )}
        {scaleSet && !measuring && (
          <div style={{ background: C.green + "12", border: "1px solid " + C.green + "30", borderRadius: 8, padding: "10px 14px", marginBottom: 10, fontSize: 12, color: C.green }}>
            <strong>Step 2:</strong> Click "Measure" → click any two points on the plan to get real-world distances. They'll appear as labeled overlays.
          </div>
        )}

        <div style={{ position: "relative", background: "#fff", borderRadius: 8, overflow: "auto", maxHeight: 500, border: "1px solid " + C.border, cursor: (settingScale || measuring) ? "crosshair" : "default" }}>
          <img ref={imgRef} src={pageImages[activePageIdx]?.dataUrl} alt={"Page " + (activePageIdx + 1)} style={{ display: "block", maxWidth: "100%", userSelect: "none", pointerEvents: "none" }} onLoad={drawOverlay} />
          <canvas ref={canvasRef} onClick={handleCanvasClick} style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }} />
        </div>

        {measurements.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 10, color: C.muted, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>Manual Measurements</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {measurements.map((m, i) => (
                <div key={i} style={{ background: C.card, borderRadius: 6, padding: "8px 12px", border: "1px solid " + C.accent + "33", display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 11, color: C.muted, fontWeight: 700 }}>{m.label}</span>
                  <span style={{ fontSize: 16, fontWeight: 800, color: C.accentGlow, fontFamily: mono }}>{m.ft.toFixed(1)}'</span>
                  <span style={{ fontSize: 10, color: C.dim }}>pg {m.page + 1}</span>
                  <button onClick={() => setMeasurements(p => p.filter((_, j) => j !== i))} style={{ background: "none", border: "none", color: C.rose, cursor: "pointer", fontSize: 14 }}>×</button>
                </div>
              ))}
            </div>
          </div>
        )}
      </Sec>

      <Sec title={"Extracted Dimensions (" + allDims.length + ")"} color={C.accent}>
        <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap", alignItems: "center" }}>
          <Btn onClick={() => setSelectedDims(new Set(allDims.map((_, i) => i)))} outline>Select All</Btn>
          <Btn onClick={() => setSelectedDims(new Set())} color={C.muted} outline>Clear</Btn>
          <span style={{ fontSize: 11, color: C.green, fontWeight: 700 }}>{selectedDims.size} selected</span>
          <div style={{ flex: 1 }} />
          <S label="" value={sendTarget} onChange={setSendTarget} options={[{ v: "walls", l: "→ Walls" }, { v: "floors", l: "→ Floors" }, { v: "roof", l: "→ Roof" }]} />
          <Btn onClick={sendSelected} color={C.green} disabled={selectedDims.size === 0 && measurements.length === 0}>Send {selectedDims.size + measurements.length} to Takeoff →</Btn>
        </div>
        <div style={{ maxHeight: 280, overflowY: "auto", border: "1px solid " + C.border, borderRadius: 8 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead><tr>{["", "Pg", "Raw", "Feet", "Type"].map(h => <th key={h} style={{ padding: "7px 8px", background: C.raised, color: C.muted, textAlign: "center", fontSize: 10, fontWeight: 700, position: "sticky", top: 0, zIndex: 1, borderBottom: "1px solid " + C.border }}>{h}</th>)}</tr></thead>
            <tbody>{allDims.map((d, i) => (
              <tr key={i} onClick={() => toggleDim(i)} style={{ cursor: "pointer", borderBottom: "1px solid " + C.border, background: selectedDims.has(i) ? C.accent + "18" : i % 2 === 0 ? C.surface : "transparent" }}>
                <td style={{ padding: "5px 8px", textAlign: "center" }}><div style={{ width: 16, height: 16, borderRadius: 3, border: "2px solid " + (selectedDims.has(i) ? C.accent : C.dim), background: selectedDims.has(i) ? C.accent : "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}>{selectedDims.has(i) && <span style={{ color: C.bg, fontSize: 11, fontWeight: 900 }}>✓</span>}</div></td>
                <td style={{ padding: "5px 8px", textAlign: "center", color: C.muted, fontFamily: mono, fontSize: 11 }}>{d.page}</td>
                <td style={{ padding: "5px 8px", color: C.text, fontWeight: 700, fontFamily: mono }}>{d.raw}</td>
                <td style={{ padding: "5px 8px", textAlign: "center", color: C.accentGlow, fontWeight: 800, fontFamily: mono, fontSize: 14 }}>{d.ft.toFixed(2)}'</td>
                <td style={{ padding: "5px 8px", textAlign: "center" }}><span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 3, background: C.blue + "20", color: C.blue, fontWeight: 700 }}>{d.type}</span></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </Sec>

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 280px" }}><Sec title="Framing References" color={C.blue}><div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>{allRefs.length ? allRefs.map(r => <span key={r} style={{ background: C.blue + "18", border: "1px solid " + C.blue + "33", borderRadius: 4, padding: "4px 10px", fontSize: 12, color: C.blue, fontWeight: 700, fontFamily: mono }}>{r}</span>) : <span style={{ color: C.dim, fontSize: 12 }}>None found</span>}</div></Sec></div>
        <div style={{ flex: "1 1 280px" }}><Sec title="Rooms & Spaces" color={C.purple}><div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>{allRooms.length ? allRooms.map(r => <span key={r} style={{ background: C.purple + "18", border: "1px solid " + C.purple + "33", borderRadius: 4, padding: "4px 10px", fontSize: 12, color: C.purple, fontWeight: 700 }}>{r}</span>) : <span style={{ color: C.dim, fontSize: 12 }}>None found</span>}</div></Sec></div>
      </div>
    </>)}

    {pages.length === 0 && !scanning && (
      <div style={{ textAlign: "center", padding: "50px 20px" }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>📐</div>
        <div style={{ fontSize: 18, color: C.text, fontWeight: 700, marginBottom: 8 }}>Upload Construction Plans</div>
        <div style={{ fontSize: 13, color: C.muted, maxWidth: 520, margin: "0 auto", lineHeight: 1.7 }}>
          Upload a PDF blueprint. The scanner extracts dimensional callouts, framing references, and room labels. Then use the on-plan measuring tool to take additional measurements. Send everything directly to the Wall, Floor, or Roof takeoff tabs.
        </div>
      </div>
    )}
  </div>);
}

function WallTakeoff({ importedDims }) {
  const [st, setSt] = useState({ sp: 16, sz: "2x4", wa: 10, sw: 8 });
  const [walls, setWalls] = useState([
    { id: 1, n: "North Ext", t: "Exterior", l: 40, h: 8, o: 3 },
    { id: 2, n: "South Ext", t: "Exterior", l: 40, h: 8, o: 4 },
    { id: 3, n: "East Ext", t: "Exterior", l: 28, h: 8, o: 2 },
    { id: 4, n: "West Ext", t: "Exterior", l: 28, h: 8, o: 1 },
  ]);
  useEffect(() => { if (importedDims?.length) setWalls(p => [...p, ...importedDims.map((d, i) => ({ id: Date.now() + i, n: "Import " + d.raw, t: "Exterior", l: Math.round(d.ft * 10) / 10, h: 8, o: 0 }))]); }, [importedDims]);
  const add = () => setWalls(w => [...w, { id: Date.now(), n: "", t: "Interior", l: 0, h: 8, o: 0 }]);
  const del = id => setWalls(w => w.filter(x => x.id !== id));
  const upd = (id, f, v) => setWalls(w => w.map(x => x.id === id ? { ...x, [f]: v } : x));
  const calcs = useMemo(() => walls.filter(w => w.l > 0).map(w => {
    const studs = Math.ceil((w.l * 12) / st.sp) + 1 + w.o * 6 + (w.t === "Exterior" ? 3 : 0);
    const ww = Math.ceil(studs * (1 + st.wa / 100));
    const tp = Math.ceil(w.l * 2 / 16); const bp = Math.ceil(w.l / 16);
    const sh = Math.ceil((w.l * w.h) / 32 * (1 + st.sw / 100));
    const sp = st.sz === "2x4" ? LUMBER["2x4-stud"] : LUMBER["2x6-stud"];
    const pp = st.sz === "2x4" ? LUMBER["2x4-16"] : LUMBER["2x6-16"];
    const mat = ww * sp + (tp + bp) * pp + sh * LUMBER.osb;
    const lab = w.l * LAB.wall;
    return { ...w, studs, ww, tp, bp, sh, mat, lab, tot: mat + lab };
  }), [walls, st]);
  const T = calcs.reduce((a, c) => ({ s: a.s + c.ww, p: a.p + c.tp + c.bp, sh: a.sh + c.sh, m: a.m + c.mat, lb: a.lb + c.lab, t: a.t + c.tot, lf: a.lf + c.l }), { s: 0, p: 0, sh: 0, m: 0, lb: 0, t: 0, lf: 0 });
  const cs = { background: C.inputBg, border: "1px solid " + C.inputBorder, borderRadius: 4, padding: "5px 6px", color: C.accentGlow, fontSize: 12, fontFamily: mono, outline: "none" };
  return (<div>
    <Sec title="Settings" color={C.blue}><Row>
      <S label="Stud Size" value={st.sz} onChange={v => setSt(s => ({ ...s, sz: v }))} options={[{ v: "2x4", l: "2×4" }, { v: "2x6", l: "2×6" }]} />
      <S label="Spacing" value={String(st.sp)} onChange={v => setSt(s => ({ ...s, sp: +v }))} options={[{ v: "12", l: '12" OC' }, { v: "16", l: '16" OC' }, { v: "24", l: '24" OC' }]} />
      <N label="Stud Waste" value={st.wa} onChange={v => setSt(s => ({ ...s, wa: v }))} unit="%" />
      <N label="Sheath Waste" value={st.sw} onChange={v => setSt(s => ({ ...s, sw: v }))} unit="%" />
    </Row></Sec>
    <Sec title="Wall Schedule" color={C.accent}><div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 720 }}>
        <thead><tr>{["Wall ID", "Type", "Len", "Ht", "Opens", "Studs", "+Waste", "Plates", "Sheath", "Mat $", "Labor $", "Total $", ""].map(h => <th key={h} style={{ padding: "7px 5px", background: C.raised, color: C.muted, textAlign: "center", fontSize: 10, fontWeight: 700, borderBottom: "1px solid " + C.border }}>{h}</th>)}</tr></thead>
        <tbody>{walls.map((w, i) => { const c = calcs.find(x => x.id === w.id); return (
          <tr key={w.id} style={{ borderBottom: "1px solid " + C.border, background: i % 2 === 0 ? C.surface : "transparent" }}>
            <td style={{ padding: 3 }}><input value={w.n} onChange={e => upd(w.id, "n", e.target.value)} placeholder="Name..." style={{ ...cs, width: "100%", minWidth: 70 }} /></td>
            <td style={{ padding: 3 }}><select value={w.t} onChange={e => upd(w.id, "t", e.target.value)} style={{ ...cs, width: 76 }}><option>Exterior</option><option>Interior</option><option>Bearing</option></select></td>
            <td style={{ padding: 3 }}><input type="number" value={w.l} onChange={e => upd(w.id, "l", +e.target.value)} style={{ ...cs, width: 48, textAlign: "center" }} /></td>
            <td style={{ padding: 3 }}><input type="number" value={w.h} onChange={e => upd(w.id, "h", +e.target.value)} style={{ ...cs, width: 38, textAlign: "center" }} /></td>
            <td style={{ padding: 3 }}><input type="number" value={w.o} onChange={e => upd(w.id, "o", +e.target.value)} style={{ ...cs, width: 38, textAlign: "center" }} /></td>
            <td style={{ padding: "3px 5px", textAlign: "center", color: C.text, fontFamily: mono }}>{c?.studs ?? "—"}</td>
            <td style={{ padding: "3px 5px", textAlign: "center", color: C.green, fontFamily: mono, fontWeight: 700 }}>{c?.ww ?? "—"}</td>
            <td style={{ padding: "3px 5px", textAlign: "center", color: C.text, fontFamily: mono }}>{c ? c.tp + c.bp : "—"}</td>
            <td style={{ padding: "3px 5px", textAlign: "center", color: C.text, fontFamily: mono }}>{c?.sh ?? "—"}</td>
            <td style={{ padding: "3px 5px", textAlign: "right", color: C.blue, fontFamily: mono, fontWeight: 600 }}>{c ? "$" + Math.round(c.mat).toLocaleString() : "—"}</td>
            <td style={{ padding: "3px 5px", textAlign: "right", color: C.teal, fontFamily: mono, fontWeight: 600 }}>{c ? "$" + Math.round(c.lab).toLocaleString() : "—"}</td>
            <td style={{ padding: "3px 5px", textAlign: "right", color: C.accent, fontFamily: mono, fontWeight: 800 }}>{c ? "$" + Math.round(c.tot).toLocaleString() : "—"}</td>
            <td style={{ padding: 3 }}><button onClick={() => del(w.id)} style={{ background: "none", border: "none", color: C.rose, cursor: "pointer", fontSize: 15 }}>×</button></td>
          </tr>); })}</tbody>
      </table></div>
      <button onClick={add} style={{ marginTop: 8, background: C.raised, border: "1px dashed " + C.dim, borderRadius: 6, padding: "7px 16px", color: C.muted, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>+ Add Wall</button>
    </Sec>
    <Sec title="Totals" color={C.green}><Row>
      <R label="Total Wall LF" value={T.lf} unit="LF" color={C.blue} big /><R label="Studs" value={T.s} unit="pcs" color={C.accent} big /><R label="Plates" value={T.p} unit="16'" color={C.teal} /><R label="Sheathing" value={T.sh} unit="sheets" color={C.purple} />
      <R label="Material" value={"$" + Math.round(T.m).toLocaleString()} color={C.blue} big /><R label="Labor" value={"$" + Math.round(T.lb).toLocaleString()} color={C.teal} /><R label="Total" value={"$" + Math.round(T.t).toLocaleString()} color={C.green} big />
    </Row></Sec>
  </div>);
}

function FloorTakeoff({ importedDims }) {
  const [st, setSt] = useState({ sp: 16, sz: "2x10", wa: 10 });
  const [areas, setAreas] = useState([{ id: 1, n: "Main Floor", s: 20, w: 40 }]);
  useEffect(() => { if (importedDims?.length) { const p = []; for (let i = 0; i < importedDims.length; i += 2) p.push({ id: Date.now() + i, n: "Import", s: Math.round((importedDims[i]?.ft || 0) * 10) / 10, w: Math.round((importedDims[i + 1]?.ft || importedDims[i]?.ft || 0) * 10) / 10 }); setAreas(a => [...a, ...p]); } }, [importedDims]);
  const add = () => setAreas(a => [...a, { id: Date.now(), n: "", s: 0, w: 0 }]);
  const del = id => setAreas(a => a.filter(x => x.id !== id));
  const upd = (id, f, v) => setAreas(a => a.map(x => x.id === id ? { ...x, [f]: v } : x));
  const calcs = useMemo(() => areas.filter(a => a.s > 0 && a.w > 0).map(a => {
    const sf = a.s * a.w; const j = Math.ceil((a.w * 12) / st.sp) + 1; const jw = Math.ceil(j * (1 + st.wa / 100));
    const sub = Math.ceil(sf / 32 * 1.08); const h = j * 2;
    const jp = st.sz === "2x10" ? LUMBER["2x10-16"] : st.sz === "2x12" ? LUMBER["2x12-16"] : LUMBER["2x8-16"];
    const hp = st.sz === "2x10" ? LUMBER.h2x10 : st.sz === "2x12" ? LUMBER.h2x12 : LUMBER.h2x8;
    const mat = jw * jp + sub * LUMBER.ply34 + h * hp; const lab = sf * LAB.floor;
    return { ...a, sf, j, jw, sub, h, mat, lab, tot: mat + lab };
  }), [areas, st]);
  const T = calcs.reduce((a, c) => ({ sf: a.sf + c.sf, j: a.j + c.jw, sub: a.sub + c.sub, m: a.m + c.mat, lb: a.lb + c.lab, t: a.t + c.tot }), { sf: 0, j: 0, sub: 0, m: 0, lb: 0, t: 0 });
  const cs = { background: C.inputBg, border: "1px solid " + C.inputBorder, borderRadius: 4, padding: "5px 6px", color: C.accentGlow, fontSize: 12, fontFamily: mono, outline: "none" };
  return (<div>
    <Sec title="Settings" color={C.blue}><Row>
      <S label="Joist Size" value={st.sz} onChange={v => setSt(s => ({ ...s, sz: v }))} options={[{ v: "2x8", l: "2×8" }, { v: "2x10", l: "2×10" }, { v: "2x12", l: "2×12" }]} />
      <S label="Spacing" value={String(st.sp)} onChange={v => setSt(s => ({ ...s, sp: +v }))} options={[{ v: "12", l: '12"' }, { v: "16", l: '16"' }, { v: "24", l: '24"' }]} />
      <N label="Waste" value={st.wa} onChange={v => setSt(s => ({ ...s, wa: v }))} unit="%" />
    </Row></Sec>
    <Sec title="Floor Areas" color={C.accent}><div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 580 }}>
        <thead><tr>{["Area", "Span", "Width", "SF", "Joists", "+W", "Subflr", "Hngrs", "Mat $", "Labor $", "Total $", ""].map(h => <th key={h} style={{ padding: "7px 5px", background: C.raised, color: C.muted, textAlign: "center", fontSize: 10, fontWeight: 700, borderBottom: "1px solid " + C.border }}>{h}</th>)}</tr></thead>
        <tbody>{areas.map((a, i) => { const c = calcs.find(x => x.id === a.id); return (
          <tr key={a.id} style={{ borderBottom: "1px solid " + C.border, background: i % 2 === 0 ? C.surface : "transparent" }}>
            <td style={{ padding: 3 }}><input value={a.n} onChange={e => upd(a.id, "n", e.target.value)} placeholder="Area..." style={{ ...cs, width: "100%", minWidth: 65 }} /></td>
            <td style={{ padding: 3 }}><input type="number" value={a.s} onChange={e => upd(a.id, "s", +e.target.value)} style={{ ...cs, width: 48, textAlign: "center" }} /></td>
            <td style={{ padding: 3 }}><input type="number" value={a.w} onChange={e => upd(a.id, "w", +e.target.value)} style={{ ...cs, width: 48, textAlign: "center" }} /></td>
            <td style={{ padding: "3px 5px", textAlign: "center", color: C.text, fontFamily: mono }}>{c?.sf?.toLocaleString() ?? "—"}</td>
            <td style={{ padding: "3px 5px", textAlign: "center", color: C.text, fontFamily: mono }}>{c?.j ?? "—"}</td>
            <td style={{ padding: "3px 5px", textAlign: "center", color: C.green, fontFamily: mono, fontWeight: 700 }}>{c?.jw ?? "—"}</td>
            <td style={{ padding: "3px 5px", textAlign: "center", color: C.text, fontFamily: mono }}>{c?.sub ?? "—"}</td>
            <td style={{ padding: "3px 5px", textAlign: "center", color: C.text, fontFamily: mono }}>{c?.h ?? "—"}</td>
            <td style={{ padding: "3px 5px", textAlign: "right", color: C.blue, fontFamily: mono, fontWeight: 600 }}>{c ? "$" + Math.round(c.mat).toLocaleString() : "—"}</td>
            <td style={{ padding: "3px 5px", textAlign: "right", color: C.teal, fontFamily: mono, fontWeight: 600 }}>{c ? "$" + Math.round(c.lab).toLocaleString() : "—"}</td>
            <td style={{ padding: "3px 5px", textAlign: "right", color: C.accent, fontFamily: mono, fontWeight: 800 }}>{c ? "$" + Math.round(c.tot).toLocaleString() : "—"}</td>
            <td style={{ padding: 3 }}><button onClick={() => del(a.id)} style={{ background: "none", border: "none", color: C.rose, cursor: "pointer", fontSize: 15 }}>×</button></td>
          </tr>); })}</tbody>
      </table></div>
      <button onClick={add} style={{ marginTop: 8, background: C.raised, border: "1px dashed " + C.dim, borderRadius: 6, padding: "7px 16px", color: C.muted, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>+ Add Area</button>
    </Sec>
    <Sec title="Totals" color={C.green}><Row>
      <R label="Total SF" value={T.sf} unit="SF" color={C.blue} big /><R label="Joists" value={T.j} unit="pcs" color={C.accent} big /><R label="Subfloor" value={T.sub} unit="sheets" color={C.purple} />
      <R label="Material" value={"$" + Math.round(T.m).toLocaleString()} color={C.blue} big /><R label="Labor" value={"$" + Math.round(T.lb).toLocaleString()} color={C.teal} /><R label="Total" value={"$" + Math.round(T.t).toLocaleString()} color={C.green} big />
    </Row></Sec>
  </div>);
}

function RoofTakeoff({ importedDims }) {
  const PF = { "3/12": 1.031, "4/12": 1.054, "5/12": 1.083, "6/12": 1.118, "7/12": 1.158, "8/12": 1.202, "9/12": 1.25, "10/12": 1.302, "12/12": 1.414 };
  const [st, setSt] = useState({ sp: 24, sz: "2x8", pitch: "6/12", wa: 10, sw: 8 });
  const [secs, setSecs] = useState([{ id: 1, n: "Main Roof", r: 40, s: 28 }]);
  useEffect(() => { if (importedDims?.length) { const p = []; for (let i = 0; i < importedDims.length; i += 2) p.push({ id: Date.now() + i, n: "Import", r: Math.round((importedDims[i]?.ft || 0) * 10) / 10, s: Math.round((importedDims[i + 1]?.ft || importedDims[i]?.ft || 0) * 10) / 10 }); setSecs(a => [...a, ...p]); } }, [importedDims]);
  const add = () => setSecs(s => [...s, { id: Date.now(), n: "", r: 0, s: 0 }]);
  const del = id => setSecs(s => s.filter(x => x.id !== id));
  const upd = (id, f, v) => setSecs(s => s.map(x => x.id === id ? { ...x, [f]: v } : x));
  const calcs = useMemo(() => secs.filter(s => s.r > 0 && s.s > 0).map(s => {
    const pf = PF[st.pitch] || 1.118; const rl = (s.s / 2) * pf;
    const rf = (Math.ceil((s.r * 12) / st.sp) + 1) * 2; const rw = Math.ceil(rf * (1 + st.wa / 100));
    const sh = Math.ceil((s.r * rl * 2) / 32 * (1 + st.sw / 100));
    const rp = st.sz === "2x8" ? LUMBER["2x8-16"] : st.sz === "2x10" ? LUMBER["2x10-16"] : LUMBER["2x12-16"];
    const mat = rw * rp + sh * LUMBER.osb + rf * LUMBER.hurricane;
    const area = s.r * rl * 2; const lab = area * LAB.roof;
    return { ...s, rl, rf, rw, sh, mat, lab, tot: mat + lab, area };
  }), [secs, st]);
  const T = calcs.reduce((a, c) => ({ r: a.r + c.rw, sh: a.sh + c.sh, m: a.m + c.mat, lb: a.lb + c.lab, t: a.t + c.tot, a: a.a + c.area }), { r: 0, sh: 0, m: 0, lb: 0, t: 0, a: 0 });
  const cs = { background: C.inputBg, border: "1px solid " + C.inputBorder, borderRadius: 4, padding: "5px 6px", color: C.accentGlow, fontSize: 12, fontFamily: mono, outline: "none" };
  return (<div>
    <Sec title="Settings" color={C.blue}><Row>
      <S label="Rafter Size" value={st.sz} onChange={v => setSt(s => ({ ...s, sz: v }))} options={[{ v: "2x8", l: "2×8" }, { v: "2x10", l: "2×10" }, { v: "2x12", l: "2×12" }]} />
      <S label="Spacing" value={String(st.sp)} onChange={v => setSt(s => ({ ...s, sp: +v }))} options={[{ v: "16", l: '16"' }, { v: "24", l: '24"' }]} />
      <S label="Pitch" value={st.pitch} onChange={v => setSt(s => ({ ...s, pitch: v }))} options={Object.keys(PF).map(p => ({ v: p, l: p }))} />
      <N label="Waste" value={st.wa} onChange={v => setSt(s => ({ ...s, wa: v }))} unit="%" />
    </Row></Sec>
    <Sec title="Roof Sections" color={C.accent}><div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 580 }}>
        <thead><tr>{["Section", "Ridge", "Span", "Rftr Len", "Rftrs", "+W", "Sheath", "Mat $", "Labor $", "Total $", ""].map(h => <th key={h} style={{ padding: "7px 5px", background: C.raised, color: C.muted, textAlign: "center", fontSize: 10, fontWeight: 700, borderBottom: "1px solid " + C.border }}>{h}</th>)}</tr></thead>
        <tbody>{secs.map((s, i) => { const c = calcs.find(x => x.id === s.id); return (
          <tr key={s.id} style={{ borderBottom: "1px solid " + C.border, background: i % 2 === 0 ? C.surface : "transparent" }}>
            <td style={{ padding: 3 }}><input value={s.n} onChange={e => upd(s.id, "n", e.target.value)} placeholder="Section..." style={{ ...cs, width: "100%", minWidth: 65 }} /></td>
            <td style={{ padding: 3 }}><input type="number" value={s.r} onChange={e => upd(s.id, "r", +e.target.value)} style={{ ...cs, width: 48, textAlign: "center" }} /></td>
            <td style={{ padding: 3 }}><input type="number" value={s.s} onChange={e => upd(s.id, "s", +e.target.value)} style={{ ...cs, width: 48, textAlign: "center" }} /></td>
            <td style={{ padding: "3px 5px", textAlign: "center", color: C.text, fontFamily: mono }}>{c ? c.rl.toFixed(1) + "'" : "—"}</td>
            <td style={{ padding: "3px 5px", textAlign: "center", color: C.text, fontFamily: mono }}>{c?.rf ?? "—"}</td>
            <td style={{ padding: "3px 5px", textAlign: "center", color: C.green, fontFamily: mono, fontWeight: 700 }}>{c?.rw ?? "—"}</td>
            <td style={{ padding: "3px 5px", textAlign: "center", color: C.text, fontFamily: mono }}>{c?.sh ?? "—"}</td>
            <td style={{ padding: "3px 5px", textAlign: "right", color: C.blue, fontFamily: mono, fontWeight: 600 }}>{c ? "$" + Math.round(c.mat).toLocaleString() : "—"}</td>
            <td style={{ padding: "3px 5px", textAlign: "right", color: C.teal, fontFamily: mono, fontWeight: 600 }}>{c ? "$" + Math.round(c.lab).toLocaleString() : "—"}</td>
            <td style={{ padding: "3px 5px", textAlign: "right", color: C.accent, fontFamily: mono, fontWeight: 800 }}>{c ? "$" + Math.round(c.tot).toLocaleString() : "—"}</td>
            <td style={{ padding: 3 }}><button onClick={() => del(s.id)} style={{ background: "none", border: "none", color: C.rose, cursor: "pointer", fontSize: 15 }}>×</button></td>
          </tr>); })}</tbody>
      </table></div>
      <button onClick={add} style={{ marginTop: 8, background: C.raised, border: "1px dashed " + C.dim, borderRadius: 6, padding: "7px 16px", color: C.muted, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>+ Add Section</button>
    </Sec>
    <Sec title="Totals" color={C.green}><Row>
      <R label="Roof Area" value={Math.round(T.a)} unit="SF" color={C.blue} big /><R label="Rafters" value={T.r} unit="pcs" color={C.accent} big /><R label="Sheathing" value={T.sh} unit="sheets" color={C.purple} />
      <R label="Material" value={"$" + Math.round(T.m).toLocaleString()} color={C.blue} big /><R label="Labor" value={"$" + Math.round(T.lb).toLocaleString()} color={C.teal} /><R label="Total" value={"$" + Math.round(T.t).toLocaleString()} color={C.green} big />
    </Row></Sec>
  </div>);
}

function QuickRef() {
  const [v, setV] = useState({ wl: 24, sp: 16, op: 2, wa: 10, t: 2, w: 6, l: 12, q: 10, aL: 40, aH: 8, oW: 36, lb: "yes", jS: 20, jW: 30, jSp: 16 });
  const s = (k, val) => setV(o => ({ ...o, [k]: val }));
  const [tool, setTool] = useState("studs");
  const studs = Math.ceil((v.wl * 12) / v.sp) + 1 + v.op * 6 + 3;
  const studsW = Math.ceil(studs * (1 + v.wa / 100));
  const bf = (v.t * v.w * v.l) / 12;
  const hdr = v.lb === "no" ? "2×4 flat" : v.oW <= 36 ? "2×6" : v.oW <= 48 ? "2×8" : v.oW <= 72 ? "2×10" : v.oW <= 96 ? "2×12" : "LVL";
  const jCnt = Math.ceil((v.jW * 12) / v.jSp) + 1;
  const jSz = v.jSp <= 16 ? (v.jS <= 10 ? "2×8" : v.jS <= 14 ? "2×10" : v.jS <= 18 ? "2×12" : "TJI") : (v.jS <= 8 ? "2×8" : v.jS <= 12 ? "2×10" : v.jS <= 15 ? "2×12" : "TJI");
  return (<div>
    <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 14 }}>
      {[{ id: "studs", l: "🪵 Studs" }, { id: "bf", l: "📐 Board Ft" }, { id: "sh", l: "🏗️ Sheathing" }, { id: "hdr", l: "🚪 Headers" }, { id: "jst", l: "🏠 Joists" }].map(t => <button key={t.id} onClick={() => setTool(t.id)} style={{ padding: "7px 14px", borderRadius: 6, border: "none", cursor: "pointer", background: tool === t.id ? C.accent : C.raised, color: tool === t.id ? C.bg : C.muted, fontWeight: 700, fontSize: 12 }}>{t.l}</button>)}
    </div>
    {tool === "studs" && <div><Row><N label="Wall Len" value={v.wl} onChange={x => s("wl", x)} unit="ft" /><N label="Spacing" value={v.sp} onChange={x => s("sp", x)} unit="in" /><N label="Opens" value={v.op} onChange={x => s("op", x)} /><N label="Waste" value={v.wa} onChange={x => s("wa", x)} unit="%" /></Row><div style={{ marginTop: 12 }}><Row><R label="Total Studs" value={studs} color={C.accent} big /><R label="With Waste" value={studsW} color={C.green} big /><R label="Top Plates" value={Math.ceil(v.wl * 2 / 16)} unit="16'" color={C.blue} /><R label="Btm Plate" value={Math.ceil(v.wl / 16)} unit="16'" color={C.teal} /></Row></div></div>}
    {tool === "bf" && <div><Row><N label="Thick" value={v.t} onChange={x => s("t", x)} unit="in" /><N label="Width" value={v.w} onChange={x => s("w", x)} unit="in" /><N label="Length" value={v.l} onChange={x => s("l", x)} unit="ft" /><N label="Qty" value={v.q} onChange={x => s("q", x)} /></Row><div style={{ marginTop: 12 }}><Row><R label="BF/pc" value={bf} unit="BF" color={C.accent} big /><R label="Total BF" value={bf * v.q} unit="BF" color={C.green} big /><R label="MBF" value={(bf * v.q / 1000).toFixed(3)} color={C.blue} /></Row></div></div>}
    {tool === "sh" && <div><Row><N label="Length" value={v.aL} onChange={x => s("aL", x)} unit="ft" /><N label="Height" value={v.aH} onChange={x => s("aH", x)} unit="ft" /></Row><div style={{ marginTop: 12 }}><Row><R label="Area" value={v.aL * v.aH} unit="SF" color={C.blue} big /><R label="Sheets (8%)" value={Math.ceil((v.aL * v.aH) / 32 * 1.08)} unit="4×8" color={C.green} big /></Row></div></div>}
    {tool === "hdr" && <div><Row><N label="Opening" value={v.oW} onChange={x => s("oW", x)} unit="in" /><S label="Bearing" value={v.lb} onChange={x => s("lb", x)} options={[{ v: "yes", l: "Yes" }, { v: "no", l: "No" }]} /></Row><div style={{ marginTop: 12, background: C.accent + "12", border: "1px solid " + C.accent + "30", borderRadius: 10, padding: "14px 18px" }}><div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase" }}>Recommended</div><div style={{ fontSize: 28, fontWeight: 800, color: C.accent }}>{hdr}</div></div><div style={{ marginTop: 10 }}><Row><R label="Header Len" value={((v.oW / 12) + 0.5).toFixed(1)} unit="ft" color={C.blue} /><R label="Trimmers" value={2} color={C.teal} /><R label="Kings" value={2} color={C.purple} /></Row></div></div>}
    {tool === "jst" && <div><Row><N label="Span" value={v.jS} onChange={x => s("jS", x)} unit="ft" /><N label="Width" value={v.jW} onChange={x => s("jW", x)} unit="ft" /><N label="Spacing" value={v.jSp} onChange={x => s("jSp", x)} unit="in" /></Row><div style={{ marginTop: 12, background: C.blue + "12", border: "1px solid " + C.blue + "30", borderRadius: 10, padding: "14px 18px" }}><div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase" }}>Recommended</div><div style={{ fontSize: 28, fontWeight: 800, color: C.blue }}>{jSz}</div></div><div style={{ marginTop: 10 }}><Row><R label="Joists" value={jCnt} unit="pcs" color={C.accent} big /><R label="SF" value={v.jS * v.jW} color={C.blue} /><R label="Rim Board" value={(v.jS + v.jW) * 2} unit="LF" color={C.teal} /><R label="Subfloor" value={Math.ceil((v.jS * v.jW) / 32 * 1.08)} unit="sheets" color={C.purple} /></Row></div></div>}
  </div>);
}

function BidSummary({ wt, ft, rt }) {
  const [mk, setMk] = useState(15); const [sf, setSf] = useState(2500);
  const [ex, setEx] = useState([{ id: 1, n: "Blocking", c: 0 }, { id: 2, n: "Hardware", c: 0 }, { id: 3, n: "Misc", c: 0 }]);
  const et = ex.reduce((s, e) => s + e.c, 0); const sub = wt + ft + rt + et; const mu = sub * mk / 100; const bid = sub + mu;
  return (<div>
    <Sec title="Summary" color={C.accent}>
      {[{ n: "Walls", v: wt, c: C.accent }, { n: "Floors", v: ft, c: C.blue }, { n: "Roof", v: rt, c: C.purple }].map(i => (
        <div key={i.n} style={{ display: "flex", justifyContent: "space-between", padding: "10px 14px", background: C.card, borderRadius: 8, borderLeft: "3px solid " + i.c, marginBottom: 6 }}>
          <span style={{ color: C.text, fontWeight: 600 }}>{i.n}</span><span style={{ color: i.c, fontWeight: 800, fontFamily: mono, fontSize: 18 }}>${Math.round(i.v).toLocaleString()}</span>
        </div>))}
      {ex.map(e => (<div key={e.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 14px", background: C.card, borderRadius: 8, borderLeft: "3px solid " + C.dim, marginBottom: 6 }}>
        <span style={{ color: C.muted, fontWeight: 600, fontSize: 13 }}>{e.n}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 3 }}><span style={{ color: C.muted }}>$</span><input type="number" value={e.c} onChange={ev => setEx(x => x.map(z => z.id === e.id ? { ...z, c: +ev.target.value } : z))} style={{ background: C.inputBg, border: "1px solid " + C.inputBorder, borderRadius: 4, padding: "5px 8px", color: C.accentGlow, fontSize: 14, fontFamily: mono, width: 85, textAlign: "right", outline: "none" }} /></div>
      </div>))}
    </Sec>
    <Sec title="Bid" color={C.green}>
      <Row><N label="Markup" value={mk} onChange={setMk} unit="%" /><N label="Total SF" value={sf} onChange={setSf} unit="SF" /></Row>
      <div style={{ marginTop: 12 }}><Row>
        <R label="Subtotal" value={"$" + Math.round(sub).toLocaleString()} color={C.blue} big />
        <R label={"Markup (" + mk + "%)"} value={"$" + Math.round(mu).toLocaleString()} color={C.orange} />
        <R label="BID TOTAL" value={"$" + Math.round(bid).toLocaleString()} color={C.green} big />
        <R label="$/SF" value={"$" + (sf > 0 ? (bid / sf).toFixed(2) : "—")} color={C.accent} big />
      </Row></div>
    </Sec>
  </div>);
}

export default function App() {
  const [tab, setTab] = useState("scan");
  const [wi, setWi] = useState(null); const [fi, setFi] = useState(null); const [ri, setRi] = useState(null);
  const tabs = [{ id: "scan", l: "📄 PDF Scanner", c: C.cyan }, { id: "walls", l: "🧱 Walls" }, { id: "floors", l: "🏗️ Floors" }, { id: "roof", l: "🏠 Roof" }, { id: "bid", l: "💰 Bid" }, { id: "ref", l: "📐 Quick Ref" }];
  return (<div style={{ background: C.bg, minHeight: "100vh", fontFamily: sans, color: C.text }}>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;700;800&display=swap" rel="stylesheet" />
    <div style={{ background: "linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)", borderBottom: "2px solid " + C.accent, padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
      <div><h1 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: C.accent, letterSpacing: "0.06em" }}>FRAMING TAKEOFF TOOLKIT</h1><p style={{ margin: "2px 0 0", fontSize: 11, color: C.dim }}>LeanAmp Technologies — PDF Scanner + Calculator + Quick Reference</p></div>
    </div>
    <div style={{ display: "flex", gap: 2, padding: "6px 10px", background: C.surface, borderBottom: "1px solid " + C.border, overflowX: "auto" }}>
      {tabs.map(t => <button key={t.id} onClick={() => setTab(t.id)} style={{ padding: "7px 14px", borderRadius: 6, border: "none", cursor: "pointer", background: tab === t.id ? (t.c || C.accent) : "transparent", color: tab === t.id ? C.bg : C.muted, fontWeight: tab === t.id ? 800 : 600, fontSize: 13, whiteSpace: "nowrap" }}>{t.l}</button>)}
    </div>
    <div style={{ padding: "14px 14px 40px", maxWidth: 1000, margin: "0 auto" }}>
      {tab === "scan" && <PdfScanner onSendToWalls={d => { setWi(d); setTab("walls"); }} onSendToFloors={d => { setFi(d); setTab("floors"); }} onSendToRoof={d => { setRi(d); setTab("roof"); }} />}
      {tab === "walls" && <WallTakeoff importedDims={wi} />}
      {tab === "floors" && <FloorTakeoff importedDims={fi} />}
      {tab === "roof" && <RoofTakeoff importedDims={ri} />}
      {tab === "bid" && <BidSummary wt={0} ft={0} rt={0} />}
      {tab === "ref" && <QuickRef />}
    </div>
  </div>);
}
