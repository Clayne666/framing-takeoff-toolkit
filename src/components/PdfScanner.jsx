import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { colors, fonts } from "../theme";
import { parseDimensions, parseFramingReferences, parseRooms, parseScale, parseWallHeights } from "../utils/parsers";
import { Section, Row, ResultCard, SelectInput, Button } from "./ui";

const PDF_JS_URL = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
const PDF_WORKER_URL = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
const RENDER_SCALE = 1.5;

const TOOLS = {
  select: { id: "select", label: "Select", icon: "\u25B3", shortcut: "V", cursor: "default" },
  linear: { id: "linear", label: "Linear", icon: "\u2194", shortcut: "L", cursor: "crosshair" },
  area:   { id: "area",   label: "Area",   icon: "\u25A1", shortcut: "A", cursor: "crosshair" },
  count:  { id: "count",  label: "Count",  icon: "#",      shortcut: "C", cursor: "cell" },
  text:   { id: "text",   label: "Label",  icon: "T",      shortcut: "T", cursor: "text" },
  scale:  { id: "scale",  label: "Scale",  icon: "\u2696", shortcut: "S", cursor: "crosshair" },
};

const MARKUP_COLORS = [
  { id: "red", hex: "#ef4444" },
  { id: "blue", hex: "#3b82f6" },
  { id: "green", hex: "#22c55e" },
  { id: "orange", hex: "#f97316" },
  { id: "purple", hex: "#a855f7" },
  { id: "cyan", hex: "#06b6d4" },
  { id: "yellow", hex: "#eab308" },
  { id: "white", hex: "#ffffff" },
];

const MIN_ZOOM = 0.3;
const MAX_ZOOM = 5;
const ZOOM_STEP = 0.25;

function pointDistance(a, b) {
  return Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2);
}

function polygonArea(points) {
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    area += points[i].x * points[j].y;
    area -= points[j].x * points[i].y;
  }
  return Math.abs(area / 2);
}

let nextMarkupId = 1;

const tbtnStyle = {
  padding: "4px 8px",
  borderRadius: 4,
  border: "none",
  cursor: "pointer",
  background: "transparent",
  color: colors.muted,
  fontWeight: 700,
  fontSize: 12,
};

export default function PdfScanner({ onSendToWalls, onSendToFloors, onSendToRoof, onHeightsDetected }) {
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

  const [detectedScales, setDetectedScales] = useState([]);
  const [detectedHeights, setDetectedHeights] = useState([]);

  const [isScaleSet, setIsScaleSet] = useState(false);
  const [scalePixels, setScalePixels] = useState(0);
  const [scaleFeet, setScaleFeet] = useState(0);
  const [scaleLabel, setScaleLabel] = useState("");
  const [scalePoints, setScalePoints] = useState([]);
  const [showScaleInput, setShowScaleInput] = useState(false);
  const [scaleInputValue, setScaleInputValue] = useState("10");

  const [activeTool, setActiveTool] = useState("select");
  const [markupColor, setMarkupColor] = useState("#ef4444");

  const [markups, setMarkups] = useState([]);
  const [undoStack, setUndoStack] = useState([]);
  const [activePoints, setActivePoints] = useState([]);
  const [selectedMarkupId, setSelectedMarkupId] = useState(null);

  const [showTextInput, setShowTextInput] = useState(false);
  const [textInputValue, setTextInputValue] = useState("");
  const [textInputPos, setTextInputPos] = useState({ x: 0, y: 0 });

  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  const canvasRef = useRef(null);
  const imgRef = useRef(null);
  const containerRef = useRef(null);
  const scaleInputRef = useRef(null);
  const textInputRef = useRef(null);

  const pageMarkups = useMemo(
    () => markups.filter((m) => m.page === activePageIndex),
    [markups, activePageIndex]
  );

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

  useEffect(() => {
    if (showScaleInput && scaleInputRef.current) {
      scaleInputRef.current.focus();
      scaleInputRef.current.select();
    }
  }, [showScaleInput]);

  useEffect(() => {
    if (showTextInput && textInputRef.current) {
      textInputRef.current.focus();
    }
  }, [showTextInput]);

  useEffect(() => {
    const handler = (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA" || e.target.tagName === "SELECT") return;
      const key = e.key.toUpperCase();
      for (const tool of Object.values(TOOLS)) {
        if (key === tool.shortcut) { setActiveTool(tool.id); setActivePoints([]); return; }
      }
      if ((e.key === "+" || e.key === "=") && (e.ctrlKey || e.metaKey)) { e.preventDefault(); setZoom((z) => Math.min(z + ZOOM_STEP, MAX_ZOOM)); }
      if (e.key === "-" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); setZoom((z) => Math.max(z - ZOOM_STEP, MIN_ZOOM)); }
      if (e.key === "0" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); setZoom(1); setPan({ x: 0, y: 0 }); }
      if (e.key === "Escape") { setActiveTool("select"); setActivePoints([]); setShowTextInput(false); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const handleUndo = useCallback(() => {
    setUndoStack((prev) => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      if (last.action === "add") {
        setMarkups((m) => m.filter((x) => x.id !== last.markup.id));
      } else if (last.action === "delete") {
        setMarkups((m) => [...m, last.markup]);
      }
      return prev.slice(0, -1);
    });
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
      if (e.key === "z" && (e.ctrlKey || e.metaKey) && !e.shiftKey) { e.preventDefault(); handleUndo(); }
      if ((e.key === "Delete" || e.key === "Backspace") && selectedMarkupId != null) {
        setMarkups((prev) => {
          const m = prev.find((x) => x.id === selectedMarkupId);
          if (m) setUndoStack((u) => [...u, { action: "delete", markup: m }]);
          return prev.filter((x) => x.id !== selectedMarkupId);
        });
        setSelectedMarkupId(null);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selectedMarkupId, handleUndo]);

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
    setMarkups([]);
    setUndoStack([]);
    setDetectedScales([]);
    setDetectedHeights([]);
    setIsScaleSet(false);
    setScaleLabel("");
    setZoom(1);
    setPan({ x: 0, y: 0 });

    try {
      const buffer = await file.arrayBuffer();
      const pdf = await window.pdfjsLib.getDocument({ data: buffer }).promise;
      const totalPages = pdf.numPages;
      const extractedPages = [];
      const extractedDims = [];
      const refSet = new Set();
      const roomSet = new Set();
      const images = [];
      const scales = [];
      const allHeights = [];

      for (let i = 1; i <= totalPages; i++) {
        setProgressText("Scanning page " + i + " of " + totalPages + "...");
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const text = textContent.items.map((item) => item.str).join(" ");

        const pageDims = parseDimensions(text);
        const pageRefs = parseFramingReferences(text);
        const pageRooms = parseRooms(text);
        const pageScale = parseScale(text, RENDER_SCALE);
        const pageHeights = parseWallHeights(text);

        const viewport = page.getViewport({ scale: RENDER_SCALE });
        const canvas = document.createElement("canvas");
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
        images.push({ dataUrl: canvas.toDataURL(), width: viewport.width, height: viewport.height });

        pageDims.forEach((d) => extractedDims.push({ ...d, page: i }));
        pageRefs.forEach((r) => refSet.add(r));
        pageRooms.forEach((r) => roomSet.add(r));
        scales.push(pageScale);
        pageHeights.forEach((h) => allHeights.push({ ...h, page: i }));
        extractedPages.push({ page: i, dims: pageDims, refs: pageRefs, rooms: pageRooms, textLength: text.length });
      }

      setPages(extractedPages);
      setDimensions(extractedDims);
      setFramingRefs([...refSet]);
      setRooms([...roomSet]);
      setPageImages(images);
      setActivePageIndex(0);
      setDetectedScales(scales);
      setDetectedHeights(allHeights);

      // Send most common detected height to Wall takeoff
      if (allHeights.length > 0 && onHeightsDetected) {
        // Use the most frequently occurring height
        const freq = {};
        allHeights.forEach((h) => { const k = h.feet.toFixed(1); freq[k] = (freq[k] || 0) + 1; });
        const bestHeight = Object.entries(freq).sort((a, b) => b[1] - a[1])[0];
        onHeightsDetected(+bestHeight[0]);
      }

      const firstScale = scales.find((s) => s !== null);
      if (firstScale) {
        setScalePixels(firstScale.pixelsPerFoot);
        setScaleFeet(1);
        setIsScaleSet(true);
        setScaleLabel(firstScale.label);
      }

      const hSummary = allHeights.length > 0 ? ", " + allHeights.length + " wall height(s) detected" : "";
      const sSummary = firstScale ? ", scale auto-set: " + firstScale.label : "";
      setProgressText("Done \u2014 " + totalPages + " pages scanned, " + extractedDims.length + " dimensions found" + sSummary + hSummary);
    } catch (err) {
      setProgressText("Error: " + err.message);
    }
    setIsScanning(false);
  }, []);

  const addMarkup = (markup) => {
    const m = { ...markup, id: nextMarkupId++ };
    setMarkups((prev) => [...prev, m]);
    setUndoStack((prev) => [...prev, { action: "add", markup: m }]);
    return m;
  };

  const deleteMarkup = (id) => {
    setMarkups((prev) => {
      const m = prev.find((x) => x.id === id);
      if (m) setUndoStack((u) => [...u, { action: "delete", markup: m }]);
      return prev.filter((x) => x.id !== id);
    });
    if (selectedMarkupId === id) setSelectedMarkupId(null);
  };

  const confirmScale = () => {
    const value = +scaleInputValue;
    if (value > 0) {
      setScaleFeet(value);
      setIsScaleSet(true);
      setScaleLabel("Manual: " + scalePixels.toFixed(0) + "px = " + value + "'");
    }
    setShowScaleInput(false);
    setActiveTool("select");
  };

  const confirmTextLabel = () => {
    if (textInputValue.trim()) {
      addMarkup({ type: "text", page: activePageIndex, color: markupColor, position: textInputPos, text: textInputValue.trim() });
    }
    setShowTextInput(false);
    setTextInputValue("");
  };

  const pxToFeet = (px) => {
    if (!isScaleSet || scalePixels === 0) return 0;
    return (px / scalePixels) * scaleFeet;
  };

  const getClickPos = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: (event.clientX - rect.left) / zoom, y: (event.clientY - rect.top) / zoom };
  };

  const handleCanvasClick = (event) => {
    if (isPanning) return;
    const pos = getClickPos(event);

    if (activeTool === "select") {
      let found = null;
      for (const m of pageMarkups) {
        if (m.type === "count" && pointDistance(pos, m.position) < 18 / zoom) { found = m; break; }
        if (m.type === "text" && pointDistance(pos, m.position) < 24 / zoom) { found = m; break; }
        if (m.type === "linear" && m.start && m.end) {
          const mid = { x: (m.start.x + m.end.x) / 2, y: (m.start.y + m.end.y) / 2 };
          if (pointDistance(pos, mid) < 24 / zoom) { found = m; break; }
        }
        if (m.type === "area" && m.points && m.points.length > 0) {
          const cx = m.points.reduce((s, p) => s + p.x, 0) / m.points.length;
          const cy = m.points.reduce((s, p) => s + p.y, 0) / m.points.length;
          if (pointDistance(pos, { x: cx, y: cy }) < 30 / zoom) { found = m; break; }
        }
      }
      setSelectedMarkupId(found ? found.id : null);
      return;
    }

    if (activeTool === "scale") {
      const newPoints = [...scalePoints, pos];
      setScalePoints(newPoints);
      if (newPoints.length === 2) {
        setScalePixels(pointDistance(newPoints[0], newPoints[1]));
        setShowScaleInput(true);
        setScalePoints([]);
      }
      return;
    }

    if (activeTool === "count") {
      addMarkup({ type: "count", page: activePageIndex, color: markupColor, position: pos });
      return;
    }

    if (activeTool === "text") {
      setTextInputPos(pos);
      setShowTextInput(true);
      return;
    }

    if (activeTool === "linear") {
      const newPoints = [...activePoints, pos];
      setActivePoints(newPoints);
      if (newPoints.length === 2) {
        const px = pointDistance(newPoints[0], newPoints[1]);
        const feet = pxToFeet(px);
        addMarkup({
          type: "linear", page: activePageIndex, color: markupColor,
          start: newPoints[0], end: newPoints[1], pixels: px, feet,
          label: isScaleSet ? feet.toFixed(1) + "'" : Math.round(px) + "px",
        });
        setActivePoints([]);
      }
      return;
    }

    if (activeTool === "area") {
      setActivePoints((prev) => [...prev, pos]);
      return;
    }
  };

  const handleCanvasDoubleClick = (event) => {
    if (activeTool === "area" && activePoints.length >= 3) {
      const pxArea = polygonArea(activePoints);
      const sqFeet = isScaleSet ? pxArea * (scaleFeet / scalePixels) ** 2 : 0;
      addMarkup({
        type: "area", page: activePageIndex, color: markupColor,
        points: [...activePoints], pxArea, sqFeet,
        label: isScaleSet ? sqFeet.toFixed(1) + " SF" : Math.round(pxArea) + "px\u00B2",
      });
      setActivePoints([]);
    }
  };

  const handleMouseDown = (e) => {
    if (e.button === 1 || (e.button === 0 && e.shiftKey) || (e.button === 0 && activeTool === "select" && e.altKey)) {
      e.preventDefault();
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };
  const handleMouseMove = (e) => {
    if (isPanning) setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
  };
  const handleMouseUp = () => setIsPanning(false);

  const handleWheel = (e) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
      setZoom((z) => Math.min(Math.max(z + delta, MIN_ZOOM), MAX_ZOOM));
    }
  };

  const toggleDimension = (index) => {
    setSelectedIndices((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index); else next.add(index);
      return next;
    });
  };

  const sendSelectedToTakeoff = () => {
    const selected = [...selectedIndices].map((i) => dimensions[i]);
    const linearMs = markups.filter((m) => m.type === "linear" && m.feet > 0)
      .map((m) => ({ raw: m.feet.toFixed(1) + "'", feet: m.feet, type: "measured", page: m.page + 1 }));
    const all = [...selected, ...linearMs];
    if (sendTarget === "walls") onSendToWalls(all);
    else if (sendTarget === "floors") onSendToFloors(all);
    else onSendToRoof(all);
  };

  const drawOverlay = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;

    canvas.width = img.naturalWidth || img.clientWidth;
    canvas.height = img.naturalHeight || img.clientHeight;
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const sx = canvas.width / (img.clientWidth || 1);
    const sy = canvas.height / (img.clientHeight || 1);

    const drawAnchor = (pt, color, r) => {
      ctx.beginPath();
      ctx.arc(pt.x * sx, pt.y * sy, r || 5, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.6)";
      ctx.lineWidth = 1;
      ctx.stroke();
    };

    const drawLabel = (x, y, text, color, fs) => {
      fs = fs || 13;
      ctx.font = "bold " + fs + "px Inter, sans-serif";
      const tw = ctx.measureText(text).width;
      const px = x * sx;
      const py = y * sy;
      ctx.fillStyle = "rgba(0,0,0,0.85)";
      const pad = 5;
      if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(px - tw / 2 - pad, py - fs / 2 - pad, tw + pad * 2, fs + pad * 2, 4); ctx.fill(); }
      else ctx.fillRect(px - tw / 2 - pad, py - fs / 2 - pad, tw + pad * 2, fs + pad * 2);
      ctx.fillStyle = color;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(text, px, py);
    };

    pageMarkups.forEach((m) => {
      const sel = m.id === selectedMarkupId;
      const c = m.color || colors.accent;

      if (m.type === "linear") {
        ctx.beginPath();
        ctx.moveTo(m.start.x * sx, m.start.y * sy);
        ctx.lineTo(m.end.x * sx, m.end.y * sy);
        ctx.strokeStyle = c;
        ctx.lineWidth = sel ? 4 : 2.5;
        ctx.setLineDash(sel ? [6, 3] : []);
        ctx.stroke();
        ctx.setLineDash([]);
        drawAnchor(m.start, c);
        drawAnchor(m.end, c);
        drawLabel((m.start.x + m.end.x) / 2, (m.start.y + m.end.y) / 2, m.label, c);
      }

      if (m.type === "area" && m.points && m.points.length >= 3) {
        ctx.beginPath();
        ctx.moveTo(m.points[0].x * sx, m.points[0].y * sy);
        for (let i = 1; i < m.points.length; i++) ctx.lineTo(m.points[i].x * sx, m.points[i].y * sy);
        ctx.closePath();
        ctx.fillStyle = c + "22";
        ctx.fill();
        ctx.strokeStyle = c;
        ctx.lineWidth = sel ? 3.5 : 2;
        ctx.setLineDash(sel ? [6, 3] : []);
        ctx.stroke();
        ctx.setLineDash([]);
        m.points.forEach((pt) => drawAnchor(pt, c, 4));
        const cx = m.points.reduce((s, p) => s + p.x, 0) / m.points.length;
        const cy = m.points.reduce((s, p) => s + p.y, 0) / m.points.length;
        drawLabel(cx, cy, m.label, c, 14);
      }

      if (m.type === "count") {
        const px = m.position.x * sx;
        const py = m.position.y * sy;
        ctx.beginPath();
        ctx.arc(px, py, sel ? 14 : 12, 0, Math.PI * 2);
        ctx.fillStyle = c;
        ctx.fill();
        ctx.strokeStyle = sel ? "#fff" : "rgba(0,0,0,0.5)";
        ctx.lineWidth = sel ? 3 : 1.5;
        ctx.stroke();
        const ci = pageMarkups.filter((x) => x.type === "count" && x.color === m.color && x.id <= m.id).length;
        ctx.font = "bold 11px Inter, sans-serif";
        ctx.fillStyle = "#fff";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(String(ci), px, py);
      }

      if (m.type === "text") {
        const px = m.position.x * sx;
        const py = m.position.y * sy;
        ctx.font = "bold 14px Inter, sans-serif";
        const tw = ctx.measureText(m.text).width;
        const pad = 4;
        ctx.fillStyle = "rgba(0,0,0,0.8)";
        if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(px - pad, py - 14 - pad, tw + pad * 2, 18 + pad * 2, 4); ctx.fill(); }
        else ctx.fillRect(px - pad, py - 14 - pad, tw + pad * 2, 18 + pad * 2);
        if (sel) { ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.strokeRect(px - pad, py - 14 - pad, tw + pad * 2, 18 + pad * 2); }
        ctx.fillStyle = m.color;
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillText(m.text, px, py - 5);
      }
    });

    const toolColor = activeTool === "scale" ? colors.blue : markupColor;
    const inPts = activeTool === "scale" ? scalePoints : activePoints;
    inPts.forEach((pt, i) => {
      drawAnchor(pt, toolColor, 7);
      if (i > 0) {
        const prev = inPts[i - 1];
        ctx.beginPath();
        ctx.moveTo(prev.x * sx, prev.y * sy);
        ctx.lineTo(pt.x * sx, pt.y * sy);
        ctx.strokeStyle = toolColor;
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    });
  }, [pageMarkups, activePoints, scalePoints, selectedMarkupId, activeTool, markupColor]);

  useEffect(() => { drawOverlay(); }, [drawOverlay, pageImages, activePageIndex]);

  const linearMeasurements = markups.filter((m) => m.type === "linear" && m.feet > 0);
  const areaMeasurements = markups.filter((m) => m.type === "area" && m.sqFeet > 0);
  const countMarkups = markups.filter((m) => m.type === "count");
  const currentCursor = isPanning ? "grabbing" : (TOOLS[activeTool]?.cursor || "default");

  return (
    <div>
      <Section title="Upload Construction Plans (PDF)" color={colors.cyan}>
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <label style={{ display: "inline-flex", alignItems: "center", gap: 8, background: isPdfLoaded ? colors.cyan : colors.dim, color: colors.background, padding: "12px 24px", borderRadius: 8, cursor: isPdfLoaded ? "pointer" : "not-allowed", fontWeight: 800, fontSize: 14 }}>
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

            {detectedHeights.length > 0 && (
              <div style={{ marginTop: 10, background: colors.green + "12", border: "1px solid " + colors.green + "30", borderRadius: 8, padding: "10px 14px" }}>
                <div style={{ fontSize: 10, color: colors.green, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>Auto-Detected Wall / Ceiling Heights</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {detectedHeights.map((h, i) => (
                    <div key={i} style={{ background: colors.card, borderRadius: 6, padding: "6px 12px", border: "1px solid " + colors.green + "33", display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 18, fontWeight: 800, color: colors.accentGlow, fontFamily: fonts.mono }}>{h.feet.toFixed(1)}'</span>
                      <span style={{ fontSize: 10, color: colors.dim }}>{h.type} (pg {h.page})</span>
                      <span style={{ fontSize: 10, color: colors.muted, fontFamily: fonts.mono }}>{h.raw}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {isScaleSet && scaleLabel && (
              <div style={{ marginTop: 8, background: colors.blue + "12", border: "1px solid " + colors.blue + "30", borderRadius: 8, padding: "8px 14px", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <span style={{ fontSize: 10, color: colors.blue, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>Auto Scale</span>
                <span style={{ fontSize: 14, fontWeight: 800, color: colors.accentGlow, fontFamily: fonts.mono }}>{scaleLabel}</span>
                <Button onClick={() => { setIsScaleSet(false); setScaleLabel(""); }} color={colors.muted} outline>Reset Scale</Button>
              </div>
            )}
          </Section>

          <Section title="Plan Viewer & Markup Tools" color={colors.accent}>
            {/* Toolbar */}
            <div style={{ display: "flex", gap: 0, marginBottom: 8, background: colors.raised, borderRadius: 8, padding: 4, alignItems: "center", flexWrap: "wrap" }}>
              <div style={{ display: "flex", gap: 2, marginRight: 8 }}>
                {pageImages.map((_, i) => (
                  <button key={i} onClick={() => { setActivePageIndex(i); setActivePoints([]); setScalePoints([]); }}
                    aria-label={"Page " + (i + 1)} aria-current={activePageIndex === i ? "page" : undefined}
                    style={{ padding: "5px 10px", borderRadius: 4, border: "none", cursor: "pointer", background: activePageIndex === i ? colors.accent : "transparent", color: activePageIndex === i ? colors.background : colors.muted, fontWeight: 700, fontSize: 11 }}>
                    Pg {i + 1}
                  </button>
                ))}
              </div>

              <div style={{ width: 1, height: 24, background: colors.border, margin: "0 4px" }} />

              {Object.values(TOOLS).map((tool) => (
                <button key={tool.id} onClick={() => { setActiveTool(tool.id); setActivePoints([]); setScalePoints([]); }}
                  title={tool.label + " (" + tool.shortcut + ")"}
                  style={{ padding: "6px 10px", borderRadius: 4, border: "none", cursor: "pointer", background: activeTool === tool.id ? (tool.id === "scale" ? colors.blue : colors.accent) : "transparent", color: activeTool === tool.id ? colors.background : colors.muted, fontWeight: 700, fontSize: 12, display: "flex", alignItems: "center", gap: 4 }}>
                  <span style={{ fontSize: 14 }}>{tool.icon}</span>
                  <span style={{ fontSize: 10 }}>{tool.label}</span>
                </button>
              ))}

              <div style={{ width: 1, height: 24, background: colors.border, margin: "0 4px" }} />

              <div style={{ display: "flex", gap: 3, alignItems: "center", marginRight: 8 }}>
                {MARKUP_COLORS.map((c) => (
                  <button key={c.id} onClick={() => setMarkupColor(c.hex)} title={c.id} aria-label={"Color: " + c.id}
                    style={{ width: 18, height: 18, borderRadius: 9, border: markupColor === c.hex ? "2px solid #fff" : "2px solid transparent", background: c.hex, cursor: "pointer", padding: 0, boxShadow: markupColor === c.hex ? "0 0 6px " + c.hex : "none" }} />
                ))}
              </div>

              <div style={{ width: 1, height: 24, background: colors.border, margin: "0 4px" }} />

              <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
                <button onClick={() => setZoom((z) => Math.max(z - ZOOM_STEP, MIN_ZOOM))} style={tbtnStyle} title="Zoom out">-</button>
                <span style={{ fontSize: 11, fontWeight: 700, color: colors.muted, fontFamily: fonts.mono, minWidth: 40, textAlign: "center" }}>{Math.round(zoom * 100)}%</span>
                <button onClick={() => setZoom((z) => Math.min(z + ZOOM_STEP, MAX_ZOOM))} style={tbtnStyle} title="Zoom in">+</button>
                <button onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }} style={{ ...tbtnStyle, fontSize: 10, padding: "3px 6px" }} title="Reset view (Ctrl+0)">Fit</button>
              </div>

              <div style={{ flex: 1 }} />

              <button onClick={handleUndo} disabled={undoStack.length === 0} style={{ ...tbtnStyle, opacity: undoStack.length === 0 ? 0.3 : 1 }} title="Undo (Ctrl+Z)">Undo</button>
              {markups.length > 0 && (
                <button onClick={() => { setMarkups([]); setUndoStack([]); setSelectedMarkupId(null); }} style={{ ...tbtnStyle, color: colors.rose }} title="Clear all markups">Clear All</button>
              )}
            </div>

            {/* Status bar */}
            <div style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "center", flexWrap: "wrap", fontSize: 11, color: colors.muted }}>
              {isScaleSet && (
                <span style={{ background: colors.green + "18", color: colors.green, padding: "3px 8px", borderRadius: 4, fontWeight: 700, fontSize: 10 }}>
                  Scale: {scaleLabel || scalePixels.toFixed(0) + "px = " + scaleFeet + "'"}
                </span>
              )}
              {!isScaleSet && (
                <span style={{ background: colors.orange + "18", color: colors.orange, padding: "3px 8px", borderRadius: 4, fontWeight: 700, fontSize: 10 }}>
                  No scale set &mdash; use Scale tool or upload plan with scale notation
                </span>
              )}
              <span style={{ color: colors.dim, fontSize: 10 }}>
                {activeTool === "linear" && "Click 2 points to measure distance"}
                {activeTool === "area" && (activePoints.length < 3 ? "Click points to define area (" + activePoints.length + " placed, need 3+). Double-click to close." : activePoints.length + " points. Double-click to close polygon.")}
                {activeTool === "count" && "Click to place count markers"}
                {activeTool === "text" && "Click to place a text label"}
                {activeTool === "scale" && (scalePoints.length === 0 ? "Click first point of known dimension" : "Click second point")}
                {activeTool === "select" && "Click markups to select. Shift+drag or middle-click to pan. Ctrl+scroll to zoom."}
              </span>
            </div>

            {showScaleInput && (
              <div role="dialog" aria-label="Set scale distance" style={{ background: colors.blue + "18", border: "1px solid " + colors.blue + "50", borderRadius: 8, padding: "12px 16px", marginBottom: 10, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <span style={{ fontSize: 13, color: colors.blue, fontWeight: 700 }}>Real-world distance of that line in feet:</span>
                <input ref={scaleInputRef} type="number" value={scaleInputValue} onChange={(e) => setScaleInputValue(e.target.value)} onKeyDown={(e) => e.key === "Enter" && confirmScale()} min="0.1" step="0.1" aria-label="Distance in feet"
                  style={{ background: colors.inputBg, border: "1px solid " + colors.inputBorder, borderRadius: 6, padding: "8px 12px", color: colors.accentGlow, fontSize: 16, fontWeight: 700, fontFamily: fonts.mono, outline: "none", width: 100 }} />
                <span style={{ color: colors.dim, fontWeight: 700 }}>ft</span>
                <Button onClick={confirmScale} color={colors.blue}>Confirm</Button>
                <Button onClick={() => { setShowScaleInput(false); setActiveTool("select"); }} color={colors.muted} outline>Cancel</Button>
              </div>
            )}

            {showTextInput && (
              <div role="dialog" aria-label="Add text label" style={{ background: markupColor + "18", border: "1px solid " + markupColor + "50", borderRadius: 8, padding: "12px 16px", marginBottom: 10, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <span style={{ fontSize: 13, color: markupColor, fontWeight: 700 }}>Label text:</span>
                <input ref={textInputRef} type="text" value={textInputValue} onChange={(e) => setTextInputValue(e.target.value)} onKeyDown={(e) => e.key === "Enter" && confirmTextLabel()} placeholder="e.g. LVL Header" aria-label="Label text"
                  style={{ background: colors.inputBg, border: "1px solid " + colors.inputBorder, borderRadius: 6, padding: "8px 12px", color: colors.accentGlow, fontSize: 14, fontWeight: 700, fontFamily: fonts.sans, outline: "none", width: 200 }} />
                <Button onClick={confirmTextLabel} color={markupColor}>Add Label</Button>
                <Button onClick={() => { setShowTextInput(false); setTextInputValue(""); }} color={colors.muted} outline>Cancel</Button>
              </div>
            )}

            {/* Plan viewer */}
            <div ref={containerRef} onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp} onWheel={handleWheel}
              style={{ position: "relative", background: "#1a1a2e", borderRadius: 8, overflow: "hidden", border: "1px solid " + colors.border, cursor: currentCursor, maxHeight: 600 }}>
              <div style={{ transform: "translate(" + pan.x + "px, " + pan.y + "px) scale(" + zoom + ")", transformOrigin: "0 0", transition: isPanning ? "none" : "transform 0.1s ease-out" }}>
                <img ref={imgRef} src={pageImages[activePageIndex]?.dataUrl} alt={"Page " + (activePageIndex + 1)} style={{ display: "block", maxWidth: zoom <= 1 ? "100%" : "none", userSelect: "none", pointerEvents: "none" }} onLoad={drawOverlay} />
                <canvas ref={canvasRef} onClick={handleCanvasClick} onDoubleClick={handleCanvasDoubleClick} aria-label="Plan markup canvas" style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }} />
              </div>
            </div>

            {/* Markup summary panel */}
            {markups.length > 0 && (
              <div style={{ marginTop: 12, display: "flex", gap: 12, flexWrap: "wrap" }}>
                {linearMeasurements.length > 0 && (
                  <div style={{ flex: "1 1 250px" }}>
                    <div style={{ fontSize: 10, color: colors.muted, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>Linear Measurements ({linearMeasurements.length})</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                      {linearMeasurements.map((m) => (
                        <div key={m.id} onClick={() => setSelectedMarkupId(m.id)}
                          style={{ background: selectedMarkupId === m.id ? m.color + "30" : colors.card, borderRadius: 6, padding: "6px 10px", border: "1px solid " + (selectedMarkupId === m.id ? m.color : colors.border), display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                          <div style={{ width: 8, height: 8, borderRadius: 4, background: m.color }} />
                          <span style={{ fontSize: 14, fontWeight: 800, color: colors.accentGlow, fontFamily: fonts.mono }}>{m.feet.toFixed(1)}'</span>
                          <span style={{ fontSize: 10, color: colors.dim }}>pg {m.page + 1}</span>
                          <button onClick={(e) => { e.stopPropagation(); deleteMarkup(m.id); }} aria-label="Remove" style={{ background: "none", border: "none", color: colors.rose, cursor: "pointer", fontSize: 14, padding: 0 }}>x</button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {areaMeasurements.length > 0 && (
                  <div style={{ flex: "1 1 250px" }}>
                    <div style={{ fontSize: 10, color: colors.muted, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>Area Measurements ({areaMeasurements.length})</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                      {areaMeasurements.map((m) => (
                        <div key={m.id} onClick={() => setSelectedMarkupId(m.id)}
                          style={{ background: selectedMarkupId === m.id ? m.color + "30" : colors.card, borderRadius: 6, padding: "6px 10px", border: "1px solid " + (selectedMarkupId === m.id ? m.color : colors.border), display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                          <div style={{ width: 8, height: 8, borderRadius: 2, background: m.color }} />
                          <span style={{ fontSize: 14, fontWeight: 800, color: colors.accentGlow, fontFamily: fonts.mono }}>{m.sqFeet.toFixed(1)} SF</span>
                          <button onClick={(e) => { e.stopPropagation(); deleteMarkup(m.id); }} aria-label="Remove" style={{ background: "none", border: "none", color: colors.rose, cursor: "pointer", fontSize: 14, padding: 0 }}>x</button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {countMarkups.length > 0 && (
                  <div style={{ flex: "1 1 180px" }}>
                    <div style={{ fontSize: 10, color: colors.muted, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>Counts ({countMarkups.length} total)</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                      {Object.entries(countMarkups.reduce((acc, m) => { acc[m.color] = (acc[m.color] || 0) + 1; return acc; }, {})).map(([color, count]) => (
                        <div key={color} style={{ background: colors.card, borderRadius: 6, padding: "6px 10px", border: "1px solid " + color + "33", display: "flex", alignItems: "center", gap: 6 }}>
                          <div style={{ width: 12, height: 12, borderRadius: 6, background: color }} />
                          <span style={{ fontSize: 16, fontWeight: 800, color: colors.accentGlow, fontFamily: fonts.mono }}>{count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </Section>

          <Section title={"Extracted Dimensions (" + dimensions.length + ")"} color={colors.accent}>
            <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap", alignItems: "center" }}>
              <Button onClick={() => setSelectedIndices(new Set(dimensions.map((_, i) => i)))} outline>Select All</Button>
              <Button onClick={() => setSelectedIndices(new Set())} color={colors.muted} outline>Clear</Button>
              <span style={{ fontSize: 11, color: colors.green, fontWeight: 700 }}>{selectedIndices.size} selected</span>
              {linearMeasurements.length > 0 && <span style={{ fontSize: 11, color: colors.blue, fontWeight: 700 }}>+ {linearMeasurements.length} measured</span>}
              <div style={{ flex: 1 }} />
              <SelectInput value={sendTarget} onChange={setSendTarget} options={[{ value: "walls", label: "\u2192 Walls" }, { value: "floors", label: "\u2192 Floors" }, { value: "roof", label: "\u2192 Roof" }]} />
              <Button onClick={sendSelectedToTakeoff} color={colors.green} disabled={selectedIndices.size === 0 && linearMeasurements.length === 0}>
                Send {selectedIndices.size + linearMeasurements.length} to Takeoff &rarr;
              </Button>
            </div>
            <div style={{ maxHeight: 280, overflowY: "auto", border: "1px solid " + colors.border, borderRadius: 8 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }} role="grid">
                <thead>
                  <tr>
                    {["", "Pg", "Raw", "Feet", "Type"].map((h) => (
                      <th key={h} style={{ padding: "7px 8px", background: colors.raised, color: colors.muted, textAlign: "center", fontSize: 10, fontWeight: 700, position: "sticky", top: 0, zIndex: 1, borderBottom: "1px solid " + colors.border }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {dimensions.map((dim, i) => (
                    <tr key={i} onClick={() => toggleDimension(i)} role="row" aria-selected={selectedIndices.has(i)}
                      style={{ cursor: "pointer", borderBottom: "1px solid " + colors.border, background: selectedIndices.has(i) ? colors.accent + "18" : i % 2 === 0 ? colors.surface : "transparent" }}>
                      <td style={{ padding: "5px 8px", textAlign: "center" }}>
                        <div role="checkbox" aria-checked={selectedIndices.has(i)} style={{ width: 16, height: 16, borderRadius: 3, border: "2px solid " + (selectedIndices.has(i) ? colors.accent : colors.dim), background: selectedIndices.has(i) ? colors.accent : "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          {selectedIndices.has(i) && <span style={{ color: colors.background, fontSize: 11, fontWeight: 900 }}>{"\u2713"}</span>}
                        </div>
                      </td>
                      <td style={{ padding: "5px 8px", textAlign: "center", color: colors.muted, fontFamily: fonts.mono, fontSize: 11 }}>{dim.page}</td>
                      <td style={{ padding: "5px 8px", color: colors.text, fontWeight: 700, fontFamily: fonts.mono }}>{dim.raw}</td>
                      <td style={{ padding: "5px 8px", textAlign: "center", color: colors.accentGlow, fontWeight: 800, fontFamily: fonts.mono, fontSize: 14 }}>{dim.feet.toFixed(2)}'</td>
                      <td style={{ padding: "5px 8px", textAlign: "center" }}>
                        <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 3, background: colors.blue + "20", color: colors.blue, fontWeight: 700 }}>{dim.type}</span>
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
                    <span key={ref} style={{ background: colors.blue + "18", border: "1px solid " + colors.blue + "33", borderRadius: 4, padding: "4px 10px", fontSize: 12, color: colors.blue, fontWeight: 700, fontFamily: fonts.mono }}>{ref}</span>
                  )) : <span style={{ color: colors.dim, fontSize: 12 }}>None found</span>}
                </div>
              </Section>
            </div>
            <div style={{ flex: "1 1 280px" }}>
              <Section title="Rooms & Spaces" color={colors.purple}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                  {rooms.length ? rooms.map((room) => (
                    <span key={room} style={{ background: colors.purple + "18", border: "1px solid " + colors.purple + "33", borderRadius: 4, padding: "4px 10px", fontSize: 12, color: colors.purple, fontWeight: 700 }}>{room}</span>
                  )) : <span style={{ color: colors.dim, fontSize: 12 }}>None found</span>}
                </div>
              </Section>
            </div>
          </div>
        </>
      )}

      {pages.length === 0 && !isScanning && (
        <div style={{ textAlign: "center", padding: "50px 20px" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }} aria-hidden="true">{"\uD83D\uDCD0"}</div>
          <div style={{ fontSize: 20, color: colors.text, fontWeight: 700, marginBottom: 8 }}>Upload Construction Plans</div>
          <div style={{ fontSize: 13, color: colors.muted, maxWidth: 560, margin: "0 auto", lineHeight: 1.8 }}>
            Upload a PDF blueprint to get started. The scanner will automatically:
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "center", marginTop: 16, maxWidth: 600, margin: "16px auto 0" }}>
            {[
              { icon: "\uD83D\uDD0D", text: "Detect the drawing scale" },
              { icon: "\uD83D\uDCCF", text: "Extract all dimensions" },
              { icon: "\uD83C\uDFE0", text: "Find room labels & framing refs" },
              { icon: "\u2195\uFE0F", text: "Read wall & ceiling heights" },
            ].map((f) => (
              <div key={f.text} style={{ background: colors.card, borderRadius: 8, padding: "12px 16px", border: "1px solid " + colors.border, flex: "1 1 200px", textAlign: "left" }}>
                <span style={{ fontSize: 18, marginRight: 8 }}>{f.icon}</span>
                <span style={{ fontSize: 12, color: colors.text, fontWeight: 600 }}>{f.text}</span>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 12, color: colors.dim, marginTop: 16, maxWidth: 560, margin: "16px auto 0", lineHeight: 1.7 }}>
            Then use <strong style={{ color: colors.accent }}>Stack-style markup tools</strong> to measure distances, calculate areas, count items,
            and add labels directly on the plan. Send everything to the takeoff tabs for instant material calculations.
          </div>
          <div style={{ marginTop: 16, fontSize: 11, color: colors.dim }}>
            Keyboard shortcuts: <strong>V</strong>=Select <strong>L</strong>=Linear <strong>A</strong>=Area <strong>C</strong>=Count <strong>T</strong>=Label <strong>S</strong>=Scale | <strong>Ctrl+Z</strong>=Undo | <strong>Ctrl+Scroll</strong>=Zoom
          </div>
        </div>
      )}
    </div>
  );
}
