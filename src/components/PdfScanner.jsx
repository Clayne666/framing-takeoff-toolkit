import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { colors, fonts } from "../theme";
import {
  parseDimensions,
  parseFramingReferences,
  parseRooms,
  parseScale,
  parseWallSchedule,
  parseOpeningSchedule,
  parseStructuralNotes,
  parseRoofPitch,
  parseSpacingCallouts,
  classifyPage,
  categorizeDimensions,
} from "../utils/parsers";
import { Section, Row, ResultCard, SelectInput, Button } from "./ui";

const PDF_JS_URL = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
const PDF_WORKER_URL = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
const RENDER_SCALE = 1.5;

function pointDistance(a, b) {
  return Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2);
}

// ─── Badge helper ─────────────────────────────────────────────────────
function Badge({ children, color, style }) {
  return (
    <span
      style={{
        fontSize: 10,
        padding: "2px 7px",
        borderRadius: 3,
        background: `${color}20`,
        color,
        fontWeight: 700,
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      {children}
    </span>
  );
}

// ─── Category color mapping ───────────────────────────────────────────
const CAT_COLORS = {
  wall: colors.accent,
  floor: colors.blue,
  roof: colors.green,
  "wall-height": colors.purple,
  unknown: colors.muted,
};
const CAT_LABELS = {
  wall: "Wall",
  floor: "Floor",
  roof: "Roof",
  "wall-height": "Ht",
  unknown: "—",
};

// page-type → human label
const PAGE_TYPE_LABELS = {
  floor: "Floor Plan",
  foundation: "Foundation",
  wall: "Framing",
  roof: "Roof Plan",
  elevation: "Elevation",
  section: "Section",
  site: "Site Plan",
  electrical: "Electrical",
  plumbing: "Plumbing",
  mechanical: "Mechanical",
  detail: "Detail",
  schedule: "Schedule",
  cover: "Cover",
  general: "General Notes",
  unknown: "Unknown",
};

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

  // Enhanced extraction data
  const [pageClassifications, setPageClassifications] = useState([]);
  const [scales, setScales] = useState([]);
  const [wallScheduleData, setWallScheduleData] = useState(null);
  const [openingData, setOpeningData] = useState(null);
  const [structuralNotes, setStructuralNotes] = useState([]);
  const [roofPitches, setRoofPitches] = useState([]);
  const [spacings, setSpacings] = useState([]);
  const [categorizedDims, setCategorizedDims] = useState([]);
  const [rawPageTexts, setRawPageTexts] = useState([]);

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

  // Inline scale input
  const [showScaleInput, setShowScaleInput] = useState(false);
  const [scaleInputValue, setScaleInputValue] = useState("10");

  // Auto-populate panel
  const [showAutoPopulate, setShowAutoPopulate] = useState(false);

  // Filter
  const [dimFilter, setDimFilter] = useState("all"); // all | wall | floor | roof | wall-height

  const canvasRef = useRef(null);
  const imgRef = useRef(null);
  const scaleInputRef = useRef(null);

  // Load PDF.js from CDN
  useEffect(() => {
    if (window.pdfjsLib) {
      setIsPdfLoaded(true);
      return;
    }
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

  // ─── Enhanced PDF processing with position-aware extraction ──────────
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
    setPageClassifications([]);
    setScales([]);
    setWallScheduleData(null);
    setOpeningData(null);
    setStructuralNotes([]);
    setRoofPitches([]);
    setSpacings([]);
    setCategorizedDims([]);
    setRawPageTexts([]);

    try {
      const buffer = await file.arrayBuffer();
      const pdf = await window.pdfjsLib.getDocument({ data: buffer }).promise;
      const totalPages = pdf.numPages;
      const extractedPages = [];
      const extractedDims = [];
      const refSet = new Set();
      const roomSet = new Set();
      const images = [];
      const classifications = [];
      const allScales = [];
      const allNotes = [];
      const allPitches = new Set();
      const allSpacings = new Set();
      const pageTexts = [];

      // Aggregate wall schedule & opening data across all pages
      let aggWallSchedule = { heights: [], wallTypes: [], studSpecs: [], defaultHeight: 8 };
      let aggOpenings = { doors: [], windows: [], totalOpenings: 0, doorCount: 0, windowCount: 0 };

      for (let i = 1; i <= totalPages; i++) {
        setProgressText(`Scanning page ${i} of ${totalPages}... (text + spatial analysis)`);
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();

        // ── Position-aware text extraction ──
        // Build text with position data for contextual dimension association
        const textItems = textContent.items;
        const fullText = textItems.map((item) => item.str).join(" ");
        pageTexts.push(fullText);

        // Build position-indexed text segments (for surrounding-text context)
        const positionedTexts = textItems.map((item) => ({
          str: item.str,
          x: item.transform[4],
          y: item.transform[5],
          width: item.width,
          height: item.height,
        }));

        // ── Run all parsers ──
        const pageDims = parseDimensions(fullText);
        const pageRefs = parseFramingReferences(fullText);
        const pageRooms = parseRooms(fullText);
        const pageScale = parseScale(fullText);
        const pageWallSchedule = parseWallSchedule(fullText);
        const pageOpenings = parseOpeningSchedule(fullText);
        const pageNotes = parseStructuralNotes(fullText);
        const pagePitches = parseRoofPitch(fullText);
        const pageSpacings = parseSpacingCallouts(fullText);
        const pageType = classifyPage(fullText);

        // Build surrounding text context for each dimension
        // Find the text segment nearest to where each dimension's raw string appears
        const surroundingTexts = pageDims.map((dim) => {
          const idx = fullText.indexOf(dim.raw);
          if (idx === -1) return "";
          const start = Math.max(0, idx - 120);
          const end = Math.min(fullText.length, idx + dim.raw.length + 120);
          return fullText.slice(start, end);
        });

        // Categorize dimensions based on page type + surrounding context
        const categorized = categorizeDimensions(pageDims, pageType, surroundingTexts);

        // ── Aggregate results ──
        classifications.push(pageType);
        categorized.forEach((d) => extractedDims.push({ ...d, page: i }));
        pageRefs.forEach((r) => refSet.add(r));
        pageRooms.forEach((r) => roomSet.add(r));
        if (pageScale) allScales.push(...pageScale);
        pageNotes.forEach((n) => allNotes.push(n));
        pagePitches.forEach((p) => allPitches.add(p));
        pageSpacings.forEach((s) => allSpacings.add(s));

        // Merge wall schedule data
        if (pageWallSchedule.heights?.length) {
          aggWallSchedule.heights.push(...pageWallSchedule.heights);
        }
        if (pageWallSchedule.wallTypes?.length) {
          aggWallSchedule.wallTypes.push(...pageWallSchedule.wallTypes);
        }
        if (pageWallSchedule.studSpecs?.length) {
          aggWallSchedule.studSpecs.push(...pageWallSchedule.studSpecs);
        }

        // Merge opening data
        aggOpenings.doors.push(...pageOpenings.doors);
        aggOpenings.windows.push(...pageOpenings.windows);
        aggOpenings.doorCount = Math.max(aggOpenings.doorCount, pageOpenings.doorCount);
        aggOpenings.windowCount = Math.max(aggOpenings.windowCount, pageOpenings.windowCount);
        aggOpenings.totalOpenings = Math.max(aggOpenings.totalOpenings, pageOpenings.totalOpenings);

        // ── Render page to image for viewer ──
        setProgressText(`Rendering page ${i} of ${totalPages}...`);
        const viewport = page.getViewport({ scale: RENDER_SCALE });
        const canvas = document.createElement("canvas");
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
        images.push({ dataUrl: canvas.toDataURL(), width: viewport.width, height: viewport.height });

        extractedPages.push({
          page: i,
          type: pageType,
          dims: categorized,
          refs: pageRefs,
          rooms: pageRooms,
          textLength: fullText.length,
          scale: pageScale,
          notes: pageNotes,
          pitches: pagePitches,
          spacings: pageSpacings,
        });
      }

      // Finalize aggregated wall schedule
      aggWallSchedule.heights = [...new Set(aggWallSchedule.heights)];
      aggWallSchedule.defaultHeight = aggWallSchedule.heights.length > 0 ? Math.max(...aggWallSchedule.heights) : 8;

      setPages(extractedPages);
      setDimensions(extractedDims);
      setCategorizedDims(extractedDims);
      setFramingRefs([...refSet]);
      setRooms([...roomSet]);
      setPageImages(images);
      setActivePageIndex(0);
      setPageClassifications(classifications);
      setScales(allScales);
      setWallScheduleData(aggWallSchedule);
      setOpeningData(aggOpenings);
      setStructuralNotes(allNotes);
      setRoofPitches([...allPitches]);
      setSpacings([...allSpacings].sort((a, b) => a - b));
      setRawPageTexts(pageTexts);

      const wallDims = extractedDims.filter((d) => d.category === "wall").length;
      const floorDims = extractedDims.filter((d) => d.category === "floor").length;
      const roofDims = extractedDims.filter((d) => d.category === "roof").length;
      setProgressText(
        `Done — ${totalPages} pages | ${extractedDims.length} dims (${wallDims} wall, ${floorDims} floor, ${roofDims} roof) | ${[...refSet].length} framing refs`
      );
    } catch (err) {
      setProgressText(`Error: ${err.message}`);
    }
    setIsScanning(false);
  }, []);

  // ─── Filtered dimensions ────────────────────────────────────────────
  const filteredDims = useMemo(() => {
    if (dimFilter === "all") return categorizedDims;
    return categorizedDims.filter((d) => d.category === dimFilter);
  }, [categorizedDims, dimFilter]);

  // ─── Dimension selection helpers ────────────────────────────────────
  const toggleDimension = (index) => {
    // index is relative to the full categorizedDims array
    setSelectedIndices((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const selectByCategory = (cat) => {
    const indices = new Set();
    categorizedDims.forEach((d, i) => {
      if (d.category === cat) indices.add(i);
    });
    setSelectedIndices(indices);
  };

  const sendSelectedToTakeoff = () => {
    const selected = [...selectedIndices].map((i) => categorizedDims[i]).filter(Boolean);
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

  // ─── Auto-populate: send categorized dims to correct tabs ───────────
  const autoPopulateAll = () => {
    const wallDims = categorizedDims.filter((d) => d.category === "wall" || d.category === "wall-height");
    const floorDims = categorizedDims.filter((d) => d.category === "floor");
    const roofDims = categorizedDims.filter((d) => d.category === "roof");

    if (wallDims.length > 0) onSendToWalls(wallDims);
    if (floorDims.length > 0) onSendToFloors(floorDims);
    if (roofDims.length > 0) onSendToRoof(roofDims);

    setShowAutoPopulate(false);
    setProgressText(
      `Auto-populated: ${wallDims.length} wall dims, ${floorDims.length} floor dims, ${roofDims.length} roof dims`
    );
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

  useEffect(() => {
    drawOverlay();
  }, [drawOverlay, pageImages, activePageIndex]);

  // ─── Category counts for quick stats ────────────────────────────────
  const catCounts = useMemo(() => {
    const counts = { wall: 0, floor: 0, roof: 0, "wall-height": 0, unknown: 0 };
    categorizedDims.forEach((d) => {
      counts[d.category] = (counts[d.category] || 0) + 1;
    });
    return counts;
  }, [categorizedDims]);

  return (
    <div>
      {/* ─── Upload ─────────────────────────────────────────────────── */}
      <Section title="Upload Construction Plans (PDF)" color={colors.cyan}>
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <label
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              background: isPdfLoaded ? colors.cyan : colors.dim,
              color: colors.background,
              padding: "12px 24px",
              borderRadius: 8,
              cursor: isPdfLoaded ? "pointer" : "not-allowed",
              fontWeight: 800,
              fontSize: 14,
            }}
          >
            {isScanning ? "Scanning..." : "Choose PDF File"}
            <input
              type="file"
              accept=".pdf"
              onChange={handleFileUpload}
              disabled={!isPdfLoaded || isScanning}
              style={{ display: "none" }}
              aria-label="Upload PDF construction plans"
            />
          </label>
          {fileName && (
            <span style={{ fontSize: 13, color: colors.text, fontWeight: 600 }}>{fileName}</span>
          )}
          {progressText && (
            <span style={{ fontSize: 12, color: colors.green, fontWeight: 600 }}>{progressText}</span>
          )}
        </div>
      </Section>

      {pages.length > 0 && (
        <>
          {/* ─── Scan Results Summary ──────────────────────────────── */}
          <Section title="Scan Results" color={colors.green}>
            <Row>
              <ResultCard label="Pages" value={pages.length} color={colors.cyan} large />
              <ResultCard label="Dimensions" value={categorizedDims.length} color={colors.accent} large />
              <ResultCard label="Wall Dims" value={catCounts.wall} color={colors.accent} />
              <ResultCard label="Floor Dims" value={catCounts.floor} color={colors.blue} />
              <ResultCard label="Roof Dims" value={catCounts.roof} color={colors.green} />
              <ResultCard label="Framing Refs" value={framingRefs.length} color={colors.blue} />
              <ResultCard label="Rooms" value={rooms.length} color={colors.purple} />
            </Row>

            {/* Page Classifications */}
            {pageClassifications.length > 0 && (
              <div style={{ marginTop: 10 }}>
                <div style={{ fontSize: 10, color: colors.muted, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 4 }}>
                  Page Types Detected
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                  {pageClassifications.map((type, i) => (
                    <span
                      key={i}
                      style={{
                        fontSize: 11,
                        padding: "3px 8px",
                        borderRadius: 4,
                        background: type === "floor" || type === "wall" || type === "roof" ? `${colors.green}20` : `${colors.muted}15`,
                        color: type === "floor" || type === "wall" || type === "roof" ? colors.green : colors.muted,
                        fontWeight: 700,
                      }}
                    >
                      Pg {i + 1}: {PAGE_TYPE_LABELS[type] || type}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Detected scales */}
            {scales.length > 0 && (
              <div style={{ marginTop: 8 }}>
                <div style={{ fontSize: 10, color: colors.muted, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 4 }}>
                  Scales Detected
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                  {scales.map((s, i) => (
                    <Badge key={i} color={colors.cyan}>
                      {s.label} (1:{s.ratio})
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Wall schedule data */}
            {wallScheduleData && (wallScheduleData.heights.length > 0 || wallScheduleData.studSpecs.length > 0) && (
              <div style={{ marginTop: 8 }}>
                <div style={{ fontSize: 10, color: colors.muted, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 4 }}>
                  Wall Schedule Info
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {wallScheduleData.heights.map((h, i) => (
                    <Badge key={`h${i}`} color={colors.accent}>Plate Ht: {h}'</Badge>
                  ))}
                  {wallScheduleData.studSpecs.map((s, i) => (
                    <Badge key={`s${i}`} color={colors.blue}>{s.size} @ {s.spacing}" OC</Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Openings */}
            {openingData && openingData.totalOpenings > 0 && (
              <div style={{ marginTop: 8 }}>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <Badge color={colors.rose}>Doors: ~{openingData.doorCount}</Badge>
                  <Badge color={colors.purple}>Windows: ~{openingData.windowCount}</Badge>
                </div>
              </div>
            )}

            {/* Roof pitches & spacings */}
            {(roofPitches.length > 0 || spacings.length > 0) && (
              <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
                {roofPitches.map((p, i) => (
                  <Badge key={`p${i}`} color={colors.green}>Pitch: {p}</Badge>
                ))}
                {spacings.map((s, i) => (
                  <Badge key={`sp${i}`} color={colors.blue}>{s}" OC</Badge>
                ))}
              </div>
            )}

            {/* Structural notes */}
            {structuralNotes.length > 0 && (
              <details style={{ marginTop: 8 }}>
                <summary style={{ fontSize: 11, color: colors.muted, fontWeight: 700, cursor: "pointer" }}>
                  Structural Notes ({structuralNotes.length})
                </summary>
                <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 4 }}>
                  {structuralNotes.map((note, i) => (
                    <div key={i} style={{ fontSize: 11, color: colors.text, padding: "4px 8px", background: `${colors.blue}10`, borderRadius: 4, borderLeft: `3px solid ${colors.blue}` }}>
                      {note}
                    </div>
                  ))}
                </div>
              </details>
            )}
          </Section>

          {/* ─── Auto-Populate Button ──────────────────────────────── */}
          {catCounts.wall + catCounts.floor + catCounts.roof > 0 && (
            <Section title="Quick Actions" color={colors.green}>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <Button onClick={() => setShowAutoPopulate(true)} color={colors.green}>
                  Auto-Populate All Takeoffs
                </Button>
                <span style={{ fontSize: 11, color: colors.muted }}>
                  Sends {catCounts.wall} wall, {catCounts.floor} floor, {catCounts.roof} roof dims to their tabs
                </span>
              </div>
              {showAutoPopulate && (
                <div style={{ marginTop: 10, background: `${colors.green}12`, border: `1px solid ${colors.green}40`, borderRadius: 8, padding: 14 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: colors.green, marginBottom: 8 }}>
                    Auto-Populate Summary
                  </div>
                  <div style={{ fontSize: 12, color: colors.text, lineHeight: 1.8 }}>
                    <div><Badge color={colors.accent}>Walls</Badge> {catCounts.wall} dimensions{wallScheduleData?.defaultHeight ? `, ${wallScheduleData.defaultHeight}' plate height` : ""}</div>
                    <div><Badge color={colors.blue}>Floors</Badge> {catCounts.floor} dimensions</div>
                    <div><Badge color={colors.green}>Roof</Badge> {catCounts.roof} dimensions{roofPitches.length ? `, pitch: ${roofPitches.join(", ")}` : ""}</div>
                  </div>
                  <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                    <Button onClick={autoPopulateAll} color={colors.green}>Confirm & Populate</Button>
                    <Button onClick={() => setShowAutoPopulate(false)} color={colors.muted} outline>Cancel</Button>
                  </div>
                </div>
              )}
            </Section>
          )}

          {/* ─── Plan Viewer & Measuring Tool ─────────────────────── */}
          <Section title="Plan Viewer & Measuring Tool" color={colors.accent}>
            <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap", alignItems: "center" }}>
              <div style={{ display: "flex", gap: 2 }}>
                {pageImages.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setActivePageIndex(i);
                      setMeasurePoints([]);
                      setScalePoints([]);
                    }}
                    aria-label={`Page ${i + 1}`}
                    aria-current={activePageIndex === i ? "page" : undefined}
                    style={{
                      padding: "4px 10px",
                      borderRadius: 4,
                      border: "none",
                      cursor: "pointer",
                      background: activePageIndex === i ? colors.accent : colors.raised,
                      color: activePageIndex === i ? colors.background : colors.muted,
                      fontWeight: 700,
                      fontSize: 11,
                    }}
                  >
                    Pg {i + 1}
                    {pageClassifications[i] && pageClassifications[i] !== "unknown" && (
                      <span style={{ fontSize: 9, opacity: 0.7 }}> ({PAGE_TYPE_LABELS[pageClassifications[i]]?.slice(0, 5) || ""})</span>
                    )}
                  </button>
                ))}
              </div>
              <div style={{ width: 1, height: 20, background: colors.border }} />
              <Button
                onClick={() => {
                  setIsSettingScale(true);
                  setScalePoints([]);
                  setIsMeasuring(false);
                }}
                color={colors.blue}
                outline={!isSettingScale}
              >
                {isSettingScale ? "Click 2 pts..." : "Set Scale"}
              </Button>
              {isScaleSet && (
                <span
                  style={{
                    fontSize: 11,
                    color: colors.green,
                    fontWeight: 700,
                    background: `${colors.green}15`,
                    padding: "3px 8px",
                    borderRadius: 4,
                  }}
                >
                  Scale: {scalePixels.toFixed(0)}px = {scaleFeet}'
                </span>
              )}
              <Button
                onClick={() => {
                  setIsMeasuring(!isMeasuring);
                  setMeasurePoints([]);
                  setIsSettingScale(false);
                }}
                color={colors.green}
                outline={!isMeasuring}
                disabled={!isScaleSet}
              >
                {isMeasuring ? "Click 2 pts..." : "Measure"}
              </Button>
              {measurements.length > 0 && (
                <Button onClick={() => setMeasurements([])} color={colors.rose} outline>
                  Clear
                </Button>
              )}
            </div>

            {showScaleInput && (
              <div
                role="dialog"
                aria-label="Set scale distance"
                style={{
                  background: `${colors.blue}18`,
                  border: `1px solid ${colors.blue}50`,
                  borderRadius: 8,
                  padding: "12px 16px",
                  marginBottom: 10,
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  flexWrap: "wrap",
                }}
              >
                <span style={{ fontSize: 13, color: colors.blue, fontWeight: 700 }}>
                  Real-world distance of that line in feet:
                </span>
                <input
                  ref={scaleInputRef}
                  type="number"
                  value={scaleInputValue}
                  onChange={(e) => setScaleInputValue(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && confirmScale()}
                  min="0.1"
                  step="0.1"
                  aria-label="Distance in feet"
                  style={{
                    background: colors.inputBg,
                    border: `1px solid ${colors.inputBorder}`,
                    borderRadius: 6,
                    padding: "8px 12px",
                    color: colors.accentGlow,
                    fontSize: 16,
                    fontWeight: 700,
                    fontFamily: fonts.mono,
                    outline: "none",
                    width: 100,
                  }}
                />
                <span style={{ color: colors.dim, fontWeight: 700 }}>ft</span>
                <Button onClick={confirmScale} color={colors.blue}>
                  Confirm
                </Button>
                <Button onClick={() => setShowScaleInput(false)} color={colors.muted} outline>
                  Cancel
                </Button>
              </div>
            )}

            {!isScaleSet && !showScaleInput && pageImages.length > 0 && (
              <div
                style={{
                  background: `${colors.orange}15`,
                  border: `1px solid ${colors.orange}40`,
                  borderRadius: 8,
                  padding: "10px 14px",
                  marginBottom: 10,
                  fontSize: 12,
                  color: colors.orange,
                }}
              >
                <strong>Step 1:</strong> Click "Set Scale" then click two endpoints of a known dimension on the
                plan. Enter the real distance to calibrate.
              </div>
            )}
            {isScaleSet && !isMeasuring && (
              <div
                style={{
                  background: `${colors.green}12`,
                  border: `1px solid ${colors.green}30`,
                  borderRadius: 8,
                  padding: "10px 14px",
                  marginBottom: 10,
                  fontSize: 12,
                  color: colors.green,
                }}
              >
                <strong>Step 2:</strong> Click "Measure" then click any two points on the plan to get
                real-world distances.
              </div>
            )}

            <div
              style={{
                position: "relative",
                background: "#fff",
                borderRadius: 8,
                overflow: "auto",
                maxHeight: 500,
                border: `1px solid ${colors.border}`,
                cursor: isSettingScale || isMeasuring ? "crosshair" : "default",
              }}
            >
              <img
                ref={imgRef}
                src={pageImages[activePageIndex]?.dataUrl}
                alt={`Page ${activePageIndex + 1}`}
                style={{ display: "block", maxWidth: "100%", userSelect: "none", pointerEvents: "none" }}
                onLoad={drawOverlay}
              />
              <canvas
                ref={canvasRef}
                onClick={handleCanvasClick}
                aria-label="Plan measurement canvas"
                style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }}
              />
            </div>

            {measurements.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <div
                  style={{
                    fontSize: 10,
                    color: colors.muted,
                    fontWeight: 700,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    marginBottom: 6,
                  }}
                >
                  Manual Measurements
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {measurements.map((m, i) => (
                    <div
                      key={i}
                      style={{
                        background: colors.card,
                        borderRadius: 6,
                        padding: "8px 12px",
                        border: `1px solid ${colors.accent}33`,
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <span style={{ fontSize: 11, color: colors.muted, fontWeight: 700 }}>{m.label}</span>
                      <span
                        style={{
                          fontSize: 16,
                          fontWeight: 800,
                          color: colors.accentGlow,
                          fontFamily: fonts.mono,
                        }}
                      >
                        {m.feet.toFixed(1)}'
                      </span>
                      <span style={{ fontSize: 10, color: colors.dim }}>pg {m.page + 1}</span>
                      <button
                        onClick={() => setMeasurements((prev) => prev.filter((_, j) => j !== i))}
                        aria-label={`Remove ${m.label}`}
                        style={{ background: "none", border: "none", color: colors.rose, cursor: "pointer", fontSize: 14 }}
                      >
                        x
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Section>

          {/* ─── Extracted Dimensions with Category Filtering ──────── */}
          <Section title={`Extracted Dimensions (${filteredDims.length}${dimFilter !== "all" ? ` of ${categorizedDims.length}` : ""})`} color={colors.accent}>
            {/* Filter bar */}
            <div style={{ display: "flex", gap: 4, marginBottom: 8, flexWrap: "wrap", alignItems: "center" }}>
              {[
                { key: "all", label: "All", count: categorizedDims.length },
                { key: "wall", label: "Wall", count: catCounts.wall },
                { key: "floor", label: "Floor", count: catCounts.floor },
                { key: "roof", label: "Roof", count: catCounts.roof },
                { key: "wall-height", label: "Heights", count: catCounts["wall-height"] },
                { key: "unknown", label: "Unclassified", count: catCounts.unknown },
              ].map((f) => (
                <button
                  key={f.key}
                  onClick={() => setDimFilter(f.key)}
                  style={{
                    padding: "4px 10px",
                    borderRadius: 4,
                    border: `1px solid ${dimFilter === f.key ? (CAT_COLORS[f.key] || colors.accent) : colors.border}`,
                    background: dimFilter === f.key ? `${CAT_COLORS[f.key] || colors.accent}20` : "transparent",
                    color: dimFilter === f.key ? (CAT_COLORS[f.key] || colors.accent) : colors.muted,
                    cursor: "pointer",
                    fontWeight: 700,
                    fontSize: 11,
                  }}
                >
                  {f.label} ({f.count})
                </button>
              ))}
            </div>

            {/* Selection + send controls */}
            <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap", alignItems: "center" }}>
              <Button onClick={() => setSelectedIndices(new Set(categorizedDims.map((_, i) => i)))} outline>
                Select All
              </Button>
              <Button onClick={() => selectByCategory("wall")} color={colors.accent} outline>
                Sel Walls
              </Button>
              <Button onClick={() => selectByCategory("floor")} color={colors.blue} outline>
                Sel Floors
              </Button>
              <Button onClick={() => selectByCategory("roof")} color={colors.green} outline>
                Sel Roof
              </Button>
              <Button onClick={() => setSelectedIndices(new Set())} color={colors.muted} outline>
                Clear
              </Button>
              <span style={{ fontSize: 11, color: colors.green, fontWeight: 700 }}>
                {selectedIndices.size} selected
              </span>
              <div style={{ flex: 1 }} />
              <SelectInput
                value={sendTarget}
                onChange={setSendTarget}
                options={[
                  { value: "walls", label: "-> Walls" },
                  { value: "floors", label: "-> Floors" },
                  { value: "roof", label: "-> Roof" },
                ]}
              />
              <Button
                onClick={sendSelectedToTakeoff}
                color={colors.green}
                disabled={selectedIndices.size === 0 && measurements.length === 0}
              >
                Send {selectedIndices.size + measurements.length} to Takeoff
              </Button>
            </div>

            {/* Dimensions table */}
            <div style={{ maxHeight: 350, overflowY: "auto", border: `1px solid ${colors.border}`, borderRadius: 8 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }} role="grid">
                <thead>
                  <tr>
                    {["", "Pg", "Raw", "Feet", "Type", "Category", "Conf"].map((h) => (
                      <th
                        key={h}
                        style={{
                          padding: "7px 8px",
                          background: colors.raised,
                          color: colors.muted,
                          textAlign: "center",
                          fontSize: 10,
                          fontWeight: 700,
                          position: "sticky",
                          top: 0,
                          zIndex: 1,
                          borderBottom: `1px solid ${colors.border}`,
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredDims.map((dim) => {
                    // Find the original index in categorizedDims for selection state
                    const origIdx = categorizedDims.indexOf(dim);
                    return (
                      <tr
                        key={origIdx}
                        onClick={() => toggleDimension(origIdx)}
                        role="row"
                        aria-selected={selectedIndices.has(origIdx)}
                        style={{
                          cursor: "pointer",
                          borderBottom: `1px solid ${colors.border}`,
                          background: selectedIndices.has(origIdx) ? `${colors.accent}18` : origIdx % 2 === 0 ? colors.surface : "transparent",
                        }}
                      >
                        <td style={{ padding: "5px 8px", textAlign: "center" }}>
                          <div
                            role="checkbox"
                            aria-checked={selectedIndices.has(origIdx)}
                            style={{
                              width: 16,
                              height: 16,
                              borderRadius: 3,
                              border: `2px solid ${selectedIndices.has(origIdx) ? colors.accent : colors.dim}`,
                              background: selectedIndices.has(origIdx) ? colors.accent : "transparent",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            {selectedIndices.has(origIdx) && (
                              <span style={{ color: colors.background, fontSize: 11, fontWeight: 900 }}>
                                ✓
                              </span>
                            )}
                          </div>
                        </td>
                        <td
                          style={{
                            padding: "5px 8px",
                            textAlign: "center",
                            color: colors.muted,
                            fontFamily: fonts.mono,
                            fontSize: 11,
                          }}
                        >
                          {dim.page}
                        </td>
                        <td
                          style={{
                            padding: "5px 8px",
                            color: colors.text,
                            fontWeight: 700,
                            fontFamily: fonts.mono,
                          }}
                        >
                          {dim.raw}
                        </td>
                        <td
                          style={{
                            padding: "5px 8px",
                            textAlign: "center",
                            color: colors.accentGlow,
                            fontWeight: 800,
                            fontFamily: fonts.mono,
                            fontSize: 14,
                          }}
                        >
                          {dim.feet.toFixed(2)}'
                        </td>
                        <td style={{ padding: "5px 8px", textAlign: "center" }}>
                          <Badge color={colors.blue}>{dim.type}</Badge>
                        </td>
                        <td style={{ padding: "5px 8px", textAlign: "center" }}>
                          <Badge color={CAT_COLORS[dim.category] || colors.muted}>
                            {CAT_LABELS[dim.category] || dim.category}
                          </Badge>
                        </td>
                        <td
                          style={{
                            padding: "5px 8px",
                            textAlign: "center",
                            fontSize: 10,
                            color: dim.confidence > 0.6 ? colors.green : dim.confidence > 0.3 ? colors.accent : colors.muted,
                            fontFamily: fonts.mono,
                            fontWeight: 700,
                          }}
                        >
                          {dim.confidence ? `${Math.round(dim.confidence * 100)}%` : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Section>

          {/* ─── Framing References & Rooms ────────────────────────── */}
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 280px" }}>
              <Section title="Framing References" color={colors.blue}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                  {framingRefs.length ? (
                    framingRefs.map((ref) => (
                      <span
                        key={ref}
                        style={{
                          background: `${colors.blue}18`,
                          border: `1px solid ${colors.blue}33`,
                          borderRadius: 4,
                          padding: "4px 10px",
                          fontSize: 12,
                          color: colors.blue,
                          fontWeight: 700,
                          fontFamily: fonts.mono,
                        }}
                      >
                        {ref}
                      </span>
                    ))
                  ) : (
                    <span style={{ color: colors.dim, fontSize: 12 }}>None found</span>
                  )}
                </div>
              </Section>
            </div>
            <div style={{ flex: "1 1 280px" }}>
              <Section title="Rooms & Spaces" color={colors.purple}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                  {rooms.length ? (
                    rooms.map((room) => (
                      <span
                        key={room}
                        style={{
                          background: `${colors.purple}18`,
                          border: `1px solid ${colors.purple}33`,
                          borderRadius: 4,
                          padding: "4px 10px",
                          fontSize: 12,
                          color: colors.purple,
                          fontWeight: 700,
                        }}
                      >
                        {room}
                      </span>
                    ))
                  ) : (
                    <span style={{ color: colors.dim, fontSize: 12 }}>None found</span>
                  )}
                </div>
              </Section>
            </div>
          </div>

          {/* ─── Raw Page Text Viewer (debug/verify) ──────────────── */}
          {rawPageTexts.length > 0 && (
            <details style={{ marginTop: 12 }}>
              <summary style={{ fontSize: 11, color: colors.muted, fontWeight: 700, cursor: "pointer", padding: "8px 12px", background: colors.surface, borderRadius: 8, border: `1px solid ${colors.border}` }}>
                View Raw Extracted Text (for verification)
              </summary>
              <div style={{ marginTop: 4, maxHeight: 300, overflowY: "auto", background: colors.surface, borderRadius: 8, border: `1px solid ${colors.border}`, padding: 12 }}>
                {rawPageTexts.map((text, i) => (
                  <div key={i} style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 11, color: colors.cyan, fontWeight: 700, marginBottom: 4 }}>
                      Page {i + 1} — {PAGE_TYPE_LABELS[pageClassifications[i]] || "Unknown"} ({text.length} chars)
                    </div>
                    <pre style={{ fontSize: 10, color: colors.dim, fontFamily: fonts.mono, whiteSpace: "pre-wrap", wordBreak: "break-all", maxHeight: 120, overflowY: "auto", background: colors.background, padding: 8, borderRadius: 4, margin: 0 }}>
                      {text.slice(0, 2000)}{text.length > 2000 ? "\n... (truncated)" : ""}
                    </pre>
                  </div>
                ))}
              </div>
            </details>
          )}
        </>
      )}

      {/* ─── Empty state ─────────────────────────────────────────── */}
      {pages.length === 0 && !isScanning && (
        <div style={{ textAlign: "center", padding: "50px 20px" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }} aria-hidden="true">
            📐
          </div>
          <div style={{ fontSize: 18, color: colors.text, fontWeight: 700, marginBottom: 8 }}>
            Upload Construction Plans
          </div>
          <div
            style={{
              fontSize: 13,
              color: colors.muted,
              maxWidth: 520,
              margin: "0 auto",
              lineHeight: 1.7,
            }}
          >
            Upload a PDF blueprint. The enhanced scanner extracts dimensional callouts, classifies pages
            (floor plan, roof plan, elevations, etc.), detects framing references, wall schedules, opening
            counts, roof pitches, and structural notes. Use the on-plan measuring tool for additional
            measurements. Auto-populate sends everything to the correct takeoff tab.
          </div>
        </div>
      )}
    </div>
  );
}
