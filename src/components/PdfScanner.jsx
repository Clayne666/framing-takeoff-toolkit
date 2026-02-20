import { useState, useCallback, useRef, useEffect } from "react";
import { colors, fonts } from "../theme";
import { parseDimensions, parseFramingReferences, parseRooms } from "../utils/parsers";
import { Section, Row, ResultCard, SelectInput, Button } from "./ui";

const PDF_JS_URL = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
const PDF_WORKER_URL = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
const RENDER_SCALE = 1.5;

function pointDistance(a, b) {
  return Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2);
}

export default function PdfScanner({ onSendToWalls, onSendToFloors, onSendToRoof }) {
  const [pages, setPages] = useState([]);
  const [dimensions, setDimensions] = useState([]);
  const [framingRefs, setFramingRefs] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [isScanning, setIsScanning] = useState(false);
  const [fileName, setFileName] = useState("");
  const [progressText, setProgressText] = useState("");
  const [selectedIndices, setSelectedIndices] = useState(new Set());
  const [sendTarget, setSendTarget] = useState("walls");
  const [isPdfLoaded, setIsPdfLoaded] = useState(false);
  const [pageImages, setPageImages] = useState([]);
  const [activePageIndex, setActivePageIndex] = useState(0);

  // On-plan measuring
  const [isMeasuring, setIsMeasuring] = useState(false);
  const [measurePoints, setMeasurePoints] = useState([]);
  const [measurements, setMeasurements] = useState([]);

  // Scale calibration
  const [isScaleSet, setIsScaleSet] = useState(false);
  const [scalePixels, setScalePixels] = useState(0);
  const [scaleFeet, setScaleFeet] = useState(0);
  const [isSettingScale, setIsSettingScale] = useState(false);
  const [scalePoints, setScalePoints] = useState([]);

  // Inline scale input (replaces blocking prompt())
  const [showScaleInput, setShowScaleInput] = useState(false);
  const [scaleInputValue, setScaleInputValue] = useState("10");

  const canvasRef = useRef(null);
  const imgRef = useRef(null);
  const scaleInputRef = useRef(null);

  // Load PDF.js from CDN
  useEffect(() => {
    if (window.pdfjsLib) { setIsPdfLoaded(true); return; }
    const script = document.createElement("script");
    script.src = PDF_JS_URL;
    script.onload = () => {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDF_WORKER_URL;
      setIsPdfLoaded(true);
    };
    document.head.appendChild(script);
  }, []);

  // Auto-focus scale input when shown
  useEffect(() => {
    if (showScaleInput && scaleInputRef.current) {
      scaleInputRef.current.focus();
      scaleInputRef.current.select();
    }
  }, [showScaleInput]);

  const handleFileUpload = useCallback(async (event) => {
    const file = event.target.files?.[0];
    if (!file || !window.pdfjsLib) return;

    setIsScanning(true);
    setFileName(file.name);
    setPages([]);
    setDimensions([]);
    setFramingRefs([]);
    setRooms([]);
    setPageImages([]);
    setMeasurements([]);
    setIsScaleSet(false);

    try {
      const buffer = await file.arrayBuffer();
      const pdf = await window.pdfjsLib.getDocument({ data: buffer }).promise;
      const totalPages = pdf.numPages;
      const extractedPages = [];
      const extractedDims = [];
      const refSet = new Set();
      const roomSet = new Set();
      const images = [];

      for (let i = 1; i <= totalPages; i++) {
        setProgressText(`Scanning page ${i} of ${totalPages}...`);
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const text = textContent.items.map((item) => item.str).join(" ");

        const pageDims = parseDimensions(text);
        const pageRefs = parseFramingReferences(text);
        const pageRooms = parseRooms(text);

        // Render page to canvas for the viewer
        const viewport = page.getViewport({ scale: RENDER_SCALE });
        const canvas = document.createElement("canvas");
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
        images.push({ dataUrl: canvas.toDataURL(), width: viewport.width, height: viewport.height });

        pageDims.forEach((d) => extractedDims.push({ ...d, page: i }));
        pageRefs.forEach((r) => refSet.add(r));
        pageRooms.forEach((r) => roomSet.add(r));
        extractedPages.push({ page: i, dims: pageDims, refs: pageRefs, rooms: pageRooms, textLength: text.length });
      }

      setPages(extractedPages);
      setDimensions(extractedDims);
      setFramingRefs([...refSet]);
      setRooms([...roomSet]);
      setPageImages(images);
      setActivePageIndex(0);
      setProgressText(`Done — ${totalPages} pages scanned, ${extractedDims.length} dimensions found`);
    } catch (err) {
      setProgressText(`Error: ${err.message}`);
    }
    setIsScanning(false);
  }, []);

  const toggleDimension = (index) => {
    setSelectedIndices((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const sendSelectedToTakeoff = () => {
    const selected = [...selectedIndices].map((i) => dimensions[i]);
    const manual = measurements.map((m) => ({
      raw: `${m.feet.toFixed(1)}'`,
      feet: m.feet,
      type: "measured",
      page: m.page + 1,
    }));
    const all = [...selected, ...manual];
    if (sendTarget === "walls") onSendToWalls(all);
    else if (sendTarget === "floors") onSendToFloors(all);
    else onSendToRoof(all);
  };

  const confirmScale = () => {
    const value = +scaleInputValue;
    if (value > 0) {
      setScaleFeet(value);
      setIsScaleSet(true);
    }
    setShowScaleInput(false);
  };

  const handleCanvasClick = (event) => {
    if (!isMeasuring && !isSettingScale) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    if (isSettingScale) {
      const newPoints = [...scalePoints, { x, y }];
      setScalePoints(newPoints);
      if (newPoints.length === 2) {
        setScalePixels(pointDistance(newPoints[0], newPoints[1]));
        setShowScaleInput(true);
        setIsSettingScale(false);
        setScalePoints([]);
      }
    } else if (isMeasuring) {
      const newPoints = [...measurePoints, { x, y }];
      setMeasurePoints(newPoints);
      if (newPoints.length === 2) {
        const px = pointDistance(newPoints[0], newPoints[1]);
        const feet = isScaleSet ? (px / scalePixels) * scaleFeet : 0;
        setMeasurements((prev) => [
          ...prev,
          { start: newPoints[0], end: newPoints[1], pixels: px, feet, page: activePageIndex, label: `M${prev.length + 1}` },
        ]);
        setMeasurePoints([]);
      }
    }
  };

  const drawOverlay = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;

    canvas.width = img.clientWidth;
    canvas.height = img.clientHeight;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw completed measurements for the active page
    measurements
      .filter((m) => m.page === activePageIndex)
      .forEach((m) => {
        ctx.beginPath();
        ctx.moveTo(m.start.x, m.start.y);
        ctx.lineTo(m.end.x, m.end.y);
        ctx.strokeStyle = colors.accent;
        ctx.lineWidth = 2.5;
        ctx.stroke();

        [m.start, m.end].forEach((pt) => {
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, 5, 0, Math.PI * 2);
          ctx.fillStyle = colors.accent;
          ctx.fill();
          ctx.strokeStyle = "#000";
          ctx.lineWidth = 1;
          ctx.stroke();
        });

        const midX = (m.start.x + m.end.x) / 2;
        const midY = (m.start.y + m.end.y) / 2;
        const label = isScaleSet ? `${m.feet.toFixed(1)}'` : `${Math.round(m.pixels)}px`;
        ctx.font = "bold 14px Inter, sans-serif";
        const textWidth = ctx.measureText(label).width;
        ctx.fillStyle = "rgba(0,0,0,0.85)";
        ctx.fillRect(midX - textWidth / 2 - 6, midY - 11, textWidth + 12, 22);
        if (ctx.roundRect) ctx.roundRect(midX - textWidth / 2 - 6, midY - 11, textWidth + 12, 22, 4);
        ctx.fillStyle = colors.accentGlow;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(label, midX, midY);
      });

    // Draw in-progress points
    const activePoints = isSettingScale ? scalePoints : measurePoints;
    activePoints.forEach((pt) => {
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 6, 0, Math.PI * 2);
      ctx.fillStyle = isSettingScale ? colors.blue : colors.green;
      ctx.fill();
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 2;
      ctx.stroke();
    });
  }, [measurements, measurePoints, scalePoints, activePageIndex, isScaleSet, scalePixels, scaleFeet, isSettingScale]);

  useEffect(() => { drawOverlay(); }, [drawOverlay, pageImages, activePageIndex]);

  return (
    <div>
      <Section title="Upload Construction Plans (PDF)" color={colors.cyan}>
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <label
            style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              background: isPdfLoaded ? colors.cyan : colors.dim,
              color: colors.background, padding: "12px 24px", borderRadius: 8,
              cursor: isPdfLoaded ? "pointer" : "not-allowed", fontWeight: 800, fontSize: 14,
            }}
          >
            {isScanning ? "Scanning..." : "Choose PDF File"}
            <input type="file" accept=".pdf" onChange={handleFileUpload} disabled={!isPdfLoaded || isScanning} style={{ display: "none" }} aria-label="Upload PDF construction plans" />
          </label>
          {fileName && <span style={{ fontSize: 13, color: colors.text, fontWeight: 600 }}>{fileName}</span>}
          {progressText && <span style={{ fontSize: 12, color: colors.green, fontWeight: 600 }}>{progressText}</span>}
        </div>
      </Section>

      {pages.length > 0 && (
        <>
          <Section title="Scan Results" color={colors.green}>
            <Row>
              <ResultCard label="Pages" value={pages.length} color={colors.cyan} large />
              <ResultCard label="Dimensions" value={dimensions.length} color={colors.accent} large />
              <ResultCard label="Framing Refs" value={framingRefs.length} color={colors.blue} />
              <ResultCard label="Rooms" value={rooms.length} color={colors.purple} />
            </Row>
          </Section>

          <Section title="Plan Viewer & Measuring Tool" color={colors.accent}>
            <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap", alignItems: "center" }}>
              <div style={{ display: "flex", gap: 2 }}>
                {pageImages.map((_, i) => (
                  <button key={i} onClick={() => { setActivePageIndex(i); setMeasurePoints([]); setScalePoints([]); }}
                    aria-label={`Page ${i + 1}`} aria-current={activePageIndex === i ? "page" : undefined}
                    style={{ padding: "4px 10px", borderRadius: 4, border: "none", cursor: "pointer", background: activePageIndex === i ? colors.accent : colors.raised, color: activePageIndex === i ? colors.background : colors.muted, fontWeight: 700, fontSize: 11 }}
                  >Pg {i + 1}</button>
                ))}
              </div>
              <div style={{ width: 1, height: 20, background: colors.border }} />
              <Button onClick={() => { setIsSettingScale(true); setScalePoints([]); setIsMeasuring(false); }} color={colors.blue} outline={!isSettingScale}>
                {isSettingScale ? "Click 2 pts..." : "Set Scale"}
              </Button>
              {isScaleSet && (
                <span style={{ fontSize: 11, color: colors.green, fontWeight: 700, background: `${colors.green}15`, padding: "3px 8px", borderRadius: 4 }}>
                  Scale: {scalePixels.toFixed(0)}px = {scaleFeet}'
                </span>
              )}
              <Button onClick={() => { setIsMeasuring(!isMeasuring); setMeasurePoints([]); setIsSettingScale(false); }} color={colors.green} outline={!isMeasuring} disabled={!isScaleSet}>
                {isMeasuring ? "Click 2 pts..." : "Measure"}
              </Button>
              {measurements.length > 0 && <Button onClick={() => setMeasurements([])} color={colors.rose} outline>Clear</Button>}
            </div>

            {/* Inline scale distance input — replaces the old blocking prompt() */}
            {showScaleInput && (
              <div role="dialog" aria-label="Set scale distance" style={{ background: `${colors.blue}18`, border: `1px solid ${colors.blue}50`, borderRadius: 8, padding: "12px 16px", marginBottom: 10, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <span style={{ fontSize: 13, color: colors.blue, fontWeight: 700 }}>Real-world distance of that line in feet:</span>
                <input ref={scaleInputRef} type="number" value={scaleInputValue} onChange={(e) => setScaleInputValue(e.target.value)} onKeyDown={(e) => e.key === "Enter" && confirmScale()} min="0.1" step="0.1" aria-label="Distance in feet"
                  style={{ background: colors.inputBg, border: `1px solid ${colors.inputBorder}`, borderRadius: 6, padding: "8px 12px", color: colors.accentGlow, fontSize: 16, fontWeight: 700, fontFamily: fonts.mono, outline: "none", width: 100 }}
                />
                <span style={{ color: colors.dim, fontWeight: 700 }}>ft</span>
                <Button onClick={confirmScale} color={colors.blue}>Confirm</Button>
                <Button onClick={() => setShowScaleInput(false)} color={colors.muted} outline>Cancel</Button>
              </div>
            )}

            {!isScaleSet && !showScaleInput && pageImages.length > 0 && (
              <div style={{ background: `${colors.orange}15`, border: `1px solid ${colors.orange}40`, borderRadius: 8, padding: "10px 14px", marginBottom: 10, fontSize: 12, color: colors.orange }}>
                <strong>Step 1:</strong> Click "Set Scale" then click two endpoints of a known dimension on the plan. Enter the real distance to calibrate.
              </div>
            )}
            {isScaleSet && !isMeasuring && (
              <div style={{ background: `${colors.green}12`, border: `1px solid ${colors.green}30`, borderRadius: 8, padding: "10px 14px", marginBottom: 10, fontSize: 12, color: colors.green }}>
                <strong>Step 2:</strong> Click "Measure" then click any two points on the plan to get real-world distances.
              </div>
            )}

            <div style={{ position: "relative", background: "#fff", borderRadius: 8, overflow: "auto", maxHeight: 500, border: `1px solid ${colors.border}`, cursor: (isSettingScale || isMeasuring) ? "crosshair" : "default" }}>
              <img ref={imgRef} src={pageImages[activePageIndex]?.dataUrl} alt={`Page ${activePageIndex + 1}`} style={{ display: "block", maxWidth: "100%", userSelect: "none", pointerEvents: "none" }} onLoad={drawOverlay} />
              <canvas ref={canvasRef} onClick={handleCanvasClick} aria-label="Plan measurement canvas" style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }} />
            </div>

            {measurements.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 10, color: colors.muted, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>Manual Measurements</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {measurements.map((m, i) => (
                    <div key={i} style={{ background: colors.card, borderRadius: 6, padding: "8px 12px", border: `1px solid ${colors.accent}33`, display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 11, color: colors.muted, fontWeight: 700 }}>{m.label}</span>
                      <span style={{ fontSize: 16, fontWeight: 800, color: colors.accentGlow, fontFamily: fonts.mono }}>{m.feet.toFixed(1)}'</span>
                      <span style={{ fontSize: 10, color: colors.dim }}>pg {m.page + 1}</span>
                      <button onClick={() => setMeasurements((prev) => prev.filter((_, j) => j !== i))} aria-label={`Remove ${m.label}`} style={{ background: "none", border: "none", color: colors.rose, cursor: "pointer", fontSize: 14 }}>×</button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Section>

          <Section title={`Extracted Dimensions (${dimensions.length})`} color={colors.accent}>
            <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap", alignItems: "center" }}>
              <Button onClick={() => setSelectedIndices(new Set(dimensions.map((_, i) => i)))} outline>Select All</Button>
              <Button onClick={() => setSelectedIndices(new Set())} color={colors.muted} outline>Clear</Button>
              <span style={{ fontSize: 11, color: colors.green, fontWeight: 700 }}>{selectedIndices.size} selected</span>
              <div style={{ flex: 1 }} />
              <SelectInput value={sendTarget} onChange={setSendTarget} options={[{ value: "walls", label: "→ Walls" }, { value: "floors", label: "→ Floors" }, { value: "roof", label: "→ Roof" }]} />
              <Button onClick={sendSelectedToTakeoff} color={colors.green} disabled={selectedIndices.size === 0 && measurements.length === 0}>
                Send {selectedIndices.size + measurements.length} to Takeoff →
              </Button>
            </div>
            <div style={{ maxHeight: 280, overflowY: "auto", border: `1px solid ${colors.border}`, borderRadius: 8 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }} role="grid">
                <thead>
                  <tr>
                    {["", "Pg", "Raw", "Feet", "Type"].map((h) => (
                      <th key={h} style={{ padding: "7px 8px", background: colors.raised, color: colors.muted, textAlign: "center", fontSize: 10, fontWeight: 700, position: "sticky", top: 0, zIndex: 1, borderBottom: `1px solid ${colors.border}` }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {dimensions.map((dim, i) => (
                    <tr key={i} onClick={() => toggleDimension(i)} role="row" aria-selected={selectedIndices.has(i)}
                      style={{ cursor: "pointer", borderBottom: `1px solid ${colors.border}`, background: selectedIndices.has(i) ? `${colors.accent}18` : i % 2 === 0 ? colors.surface : "transparent" }}
                    >
                      <td style={{ padding: "5px 8px", textAlign: "center" }}>
                        <div role="checkbox" aria-checked={selectedIndices.has(i)} style={{ width: 16, height: 16, borderRadius: 3, border: `2px solid ${selectedIndices.has(i) ? colors.accent : colors.dim}`, background: selectedIndices.has(i) ? colors.accent : "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          {selectedIndices.has(i) && <span style={{ color: colors.background, fontSize: 11, fontWeight: 900 }}>✓</span>}
                        </div>
                      </td>
                      <td style={{ padding: "5px 8px", textAlign: "center", color: colors.muted, fontFamily: fonts.mono, fontSize: 11 }}>{dim.page}</td>
                      <td style={{ padding: "5px 8px", color: colors.text, fontWeight: 700, fontFamily: fonts.mono }}>{dim.raw}</td>
                      <td style={{ padding: "5px 8px", textAlign: "center", color: colors.accentGlow, fontWeight: 800, fontFamily: fonts.mono, fontSize: 14 }}>{dim.feet.toFixed(2)}'</td>
                      <td style={{ padding: "5px 8px", textAlign: "center" }}>
                        <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 3, background: `${colors.blue}20`, color: colors.blue, fontWeight: 700 }}>{dim.type}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 280px" }}>
              <Section title="Framing References" color={colors.blue}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                  {framingRefs.length ? framingRefs.map((ref) => (
                    <span key={ref} style={{ background: `${colors.blue}18`, border: `1px solid ${colors.blue}33`, borderRadius: 4, padding: "4px 10px", fontSize: 12, color: colors.blue, fontWeight: 700, fontFamily: fonts.mono }}>{ref}</span>
                  )) : <span style={{ color: colors.dim, fontSize: 12 }}>None found</span>}
                </div>
              </Section>
            </div>
            <div style={{ flex: "1 1 280px" }}>
              <Section title="Rooms & Spaces" color={colors.purple}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                  {rooms.length ? rooms.map((room) => (
                    <span key={room} style={{ background: `${colors.purple}18`, border: `1px solid ${colors.purple}33`, borderRadius: 4, padding: "4px 10px", fontSize: 12, color: colors.purple, fontWeight: 700 }}>{room}</span>
                  )) : <span style={{ color: colors.dim, fontSize: 12 }}>None found</span>}
                </div>
              </Section>
            </div>
          </div>
        </>
      )}

      {pages.length === 0 && !isScanning && (
        <div style={{ textAlign: "center", padding: "50px 20px" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }} aria-hidden="true">📐</div>
          <div style={{ fontSize: 18, color: colors.text, fontWeight: 700, marginBottom: 8 }}>Upload Construction Plans</div>
          <div style={{ fontSize: 13, color: colors.muted, maxWidth: 520, margin: "0 auto", lineHeight: 1.7 }}>
            Upload a PDF blueprint. The scanner extracts dimensional callouts, framing references, and room labels.
            Then use the on-plan measuring tool to take additional measurements.
            Send everything directly to the Wall, Floor, or Roof takeoff tabs.
          </div>
        </div>
      )}
    </div>
  );
}
