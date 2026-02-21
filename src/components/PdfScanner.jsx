import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { colors, fonts } from "../theme";
import { parseDimensions, parseFramingReferences, parseRooms } from "../utils/parsers";
import { extractSpatialText } from "../utils/spatialText";
import { classifyPage } from "../utils/pageClassifier";
import { createExtractionResult, mergeIntoResult } from "../utils/extractionResult";
import { findWallScheduleInTables, findDoorWindowScheduleInTables } from "../utils/scheduleParser";
import { parseGeneralNotes } from "../utils/notesParser";
import {
  getApiKey, setApiKey as storeApiKey, isAiAvailable, extractWithAi,
  mapAiResult, AI_PAGE_TYPES,
} from "../utils/aiExtractor";
import { savePlanFile, getPlanFile, updateProject } from "../utils/projectStore";
import { Section, Row, ResultCard, SelectInput, Button } from "./ui";

const PDF_JS_URL = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
const PDF_WORKER_URL = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
const RENDER_SCALE = 1.5;
const AI_RENDER_SCALE = 2.0;

// ── Geometry utilities ──────────────────────────────────────────────
function pointDistance(a, b) {
  return Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2);
}

function polylineLength(points) {
  let total = 0;
  for (let i = 1; i < points.length; i++) total += pointDistance(points[i - 1], points[i]);
  return total;
}

function polygonArea(points) {
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    area += points[i].x * points[j].y - points[j].x * points[i].y;
  }
  return Math.abs(area / 2);
}

function midpoint(a, b) { return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; }

function polygonCentroid(pts) {
  const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
  const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
  return { x: cx, y: cy };
}

// ── Default condition colors ────────────────────────────────────────
const CONDITION_COLORS = ["#ef4444", "#3b82f6", "#22c55e", "#f59e0b", "#a78bfa", "#06b6d4", "#fb923c", "#ec4899"];
function nextConditionColor(existing) {
  const usedColors = existing.map((c) => c.color);
  return CONDITION_COLORS.find((c) => !usedColors.includes(c)) || CONDITION_COLORS[existing.length % CONDITION_COLORS.length];
}

// ── Tool definitions ────────────────────────────────────────────────
const TOOLS = [
  { id: "select", label: "Select", icon: "\u25B3", tip: "Select / edit measurements" },
  { id: "pan", label: "Pan", icon: "\u270B", tip: "Click and drag to pan the view" },
  { id: "scale", label: "Scale", icon: "\u2696", tip: "Set scale (2 points + distance)" },
  { id: "verify", label: "Verify", icon: "\u2713", tip: "Verify scale accuracy" },
  { id: "linear", label: "Linear", icon: "\u2500", tip: "2-point linear measurement" },
  { id: "polyline", label: "Polyline", icon: "\u2571", tip: "Multi-point wall tracing (dbl-click to finish)" },
  { id: "area", label: "Area", icon: "\u25A1", tip: "Polygon area measurement (dbl-click to close)" },
  { id: "count", label: "Count", icon: "\u00B7", tip: "Click to count items (openings, etc.)" },
];

const TOOL_GROUPS = [
  { label: "Navigate", tools: ["select", "pan"] },
  { label: "Scale", tools: ["scale", "verify"] },
  { label: "Measure", tools: ["linear", "polyline", "area", "count"] },
];

const TOOL_INSTRUCTIONS = {
  select: "Click a measurement to select it. Press Delete to remove.",
  pan: "Click and drag to pan. Scroll to zoom. Press Esc to switch back to Select.",
  scale: "Click two points of a known distance, then enter the real-world length.",
  verify: "Click two points of a known distance to check your scale accuracy.",
  linear: "Click start point, then end point to measure a straight line.",
  polyline: "Click to add points along a wall. Double-click or press Enter to finish.",
  area: "Click corners of a region. Double-click or press Enter to close and measure area.",
  count: "Click each item to count. Press Esc when done.",
};

export default function PdfScanner({ onSendToWalls, onSendToFloors, onSendToRoof, onExtractionComplete, onScanProgress, projectId, initialPlanFileName }) {
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

  // ── Tool state (replaces old isMeasuring / isSettingScale) ────────
  const [activeTool, setActiveTool] = useState(null);
  const [activePoints, setActivePoints] = useState([]);
  const [cursorPos, setCursorPos] = useState(null);

  // ── Scale ─────────────────────────────────────────────────────────
  const [isScaleSet, setIsScaleSet] = useState(false);
  const [scalePixels, setScalePixels] = useState(0);
  const [scaleFeet, setScaleFeet] = useState(0);
  const [showScaleInput, setShowScaleInput] = useState(false);
  const [scaleInputValue, setScaleInputValue] = useState("10");
  const [scaleVerifications, setScaleVerifications] = useState([]);
  const [verifyInputValue, setVerifyInputValue] = useState("");
  const [showVerifyInput, setShowVerifyInput] = useState(false);
  const [pendingVerifyPixels, setPendingVerifyPixels] = useState(0);

  // ── Measurements & conditions ─────────────────────────────────────
  const [measurements, setMeasurements] = useState([]);
  const [conditions, setConditions] = useState([]);
  const [activeConditionId, setActiveConditionId] = useState(null);
  const [showConditionDialog, setShowConditionDialog] = useState(false);
  const [conditionForm, setConditionForm] = useState({ name: "", type: "linear", target: "wall", wallType: "Exterior" });

  // ── Zoom & pan ────────────────────────────────────────────────────
  const [zoom, setZoom] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef(null);

  // ── Extraction pipeline state ─────────────────────────────────────
  const [extractionResult, setExtractionResult] = useState(null);
  const [pageClassifications, setPageClassifications] = useState([]);
  const [isAiRunning, setIsAiRunning] = useState(false);
  const [aiProgress, setAiProgress] = useState("");
  const [apiKeyInput, setApiKeyInput] = useState(getApiKey());
  const [showApiKeySection, setShowApiKeySection] = useState(false);

  const canvasRef = useRef(null);
  const imgRef = useRef(null);
  const scaleInputRef = useRef(null);
  const verifyInputRef = useRef(null);
  const pdfRef = useRef(null);
  const containerRef = useRef(null);

  // ── Undo stack ────────────────────────────────────────────────────
  const undoStack = useRef([]);
  const pushUndo = (type, data) => { undoStack.current.push({ type, data }); };
  const handleUndo = () => {
    const last = undoStack.current.pop();
    if (!last) return;
    if (last.type === "measurement") setMeasurements((prev) => prev.filter((m) => m.id !== last.data.id));
    if (last.type === "condition") setConditions((prev) => prev.filter((c) => c.id !== last.data.id));
  };

  // ── Load PDF.js from CDN ──────────────────────────────────────────
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
    if (showScaleInput && scaleInputRef.current) { scaleInputRef.current.focus(); scaleInputRef.current.select(); }
  }, [showScaleInput]);
  useEffect(() => {
    if (showVerifyInput && verifyInputRef.current) { verifyInputRef.current.focus(); verifyInputRef.current.select(); }
  }, [showVerifyInput]);

  // ── Coordinate transforms (viewport <-> image space) ──────────────
  const viewportToImage = useCallback((clientX, clientY) => {
    const container = containerRef.current;
    if (!container) return { x: 0, y: 0 };
    const rect = container.getBoundingClientRect();
    return {
      x: (clientX - rect.left + container.scrollLeft - panOffset.x) / zoom,
      y: (clientY - rect.top + container.scrollTop - panOffset.y) / zoom,
    };
  }, [zoom, panOffset]);

  const imageToViewport = useCallback((ix, iy) => {
    return { x: ix * zoom + panOffset.x, y: iy * zoom + panOffset.y };
  }, [zoom, panOffset]);

  const pxToFeet = useCallback((px) => {
    if (!isScaleSet || scalePixels === 0) return 0;
    return (px / scalePixels) * scaleFeet;
  }, [isScaleSet, scalePixels, scaleFeet]);

  const pxAreaToSqFt = useCallback((pxArea) => {
    if (!isScaleSet || scalePixels === 0) return 0;
    const scale = scaleFeet / scalePixels;
    return pxArea * scale * scale;
  }, [isScaleSet, scalePixels, scaleFeet]);

  // ── Core extraction pipeline ──────────────────────────────────────
  const yieldToMain = () => new Promise((resolve) => setTimeout(resolve, 0));

  const runExtraction = useCallback(async (buffer, fName) => {
    setIsScanning(true);
    setPages([]);
    setDimensions([]);
    setFramingRefs([]);
    setRooms([]);
    setPageImages([]);
    setMeasurements([]);
    setIsScaleSet(false);
    setExtractionResult(null);
    setPageClassifications([]);
    setConditions([]);
    setScaleVerifications([]);
    setZoom(1);
    setPanOffset({ x: 0, y: 0 });

    const reportProgress = (phase, current, total, message) => {
      setProgressText(message);
      onScanProgress?.({ phase, current, total, message });
    };

    try {
      const pdf = await window.pdfjsLib.getDocument({ data: buffer }).promise;
      pdfRef.current = pdf;
      const totalPages = pdf.numPages;
      const result = createExtractionResult();

      const extractedPages = [];
      const extractedDims = [];
      const refSet = new Set();
      const roomSet = new Set();
      const images = [];
      const spatialDataArr = [];
      const classifications = [];
      const hasAi = isAiAvailable();

      for (let i = 1; i <= totalPages; i++) {
        reportProgress("extract", i, totalPages, `Pass 1/${hasAi ? "4" : "3"}: Extracting page ${i}/${totalPages}...`);
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const viewport = page.getViewport({ scale: RENDER_SCALE });

        const spatialData = extractSpatialText(textContent.items, viewport);
        spatialDataArr.push(spatialData);

        const classification = classifyPage(spatialData);
        classifications.push({ page: i, ...classification });
        result.pageClassifications.push({ page: i, type: classification.type, confidence: classification.confidence });

        const text = spatialData.rawText;
        const pageDims = parseDimensions(text);
        const pageRefs = parseFramingReferences(text);
        const pageRooms = parseRooms(text);

        pageDims.forEach((d) => extractedDims.push({ ...d, page: i }));
        pageRefs.forEach((r) => refSet.add(r));
        pageRooms.forEach((r) => roomSet.add(r));
        extractedPages.push({ page: i, dims: pageDims, refs: pageRefs, rooms: pageRooms, textLength: text.length, type: classification.type, confidence: classification.confidence });

        const canvas = document.createElement("canvas");
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
        const imgData = { dataUrl: canvas.toDataURL(), width: viewport.width, height: viewport.height };
        images.push(imgData);

        // Progressive: push each page image immediately so user sees pages appear
        setPageImages((prev) => [...prev, imgData]);
        if (i === 1) setActivePageIndex(0);

        if (i === 1 && projectId) {
          const thumbCanvas = document.createElement("canvas");
          const thumbScale = 0.3;
          thumbCanvas.width = viewport.width * thumbScale;
          thumbCanvas.height = viewport.height * thumbScale;
          const thumbCtx = thumbCanvas.getContext("2d");
          thumbCtx.drawImage(canvas, 0, 0, thumbCanvas.width, thumbCanvas.height);
          const thumbnailDataUrl = thumbCanvas.toDataURL("image/jpeg", 0.6);
          updateProject(projectId, { planFileThumbnail: thumbnailDataUrl }).catch(() => {});
        }

        // Yield to event loop so UI stays responsive
        await yieldToMain();
      }

      setPageClassifications(classifications);

      reportProgress("parse", 0, 1, "Pass 2: Parsing schedules and notes...");

      for (let i = 0; i < totalPages; i++) {
        const cls = classifications[i];
        const sd = spatialDataArr[i];

        if (cls.type === "WALL_SCHEDULE") {
          const wallTypes = findWallScheduleInTables(sd.tables);
          if (wallTypes.length) mergeIntoResult(result, { wallTypes });
        }
        if (cls.type === "DOOR_WINDOW_SCHEDULE") {
          const openings = findDoorWindowScheduleInTables(sd.tables, sd.rawText);
          if (openings.length) mergeIntoResult(result, { openings });
        }
        if (cls.type === "GENERAL_NOTES") {
          const notesResult = parseGeneralNotes(sd);
          mergeIntoResult(result, notesResult);
        }
      }

      result.rawDimensions = extractedDims;
      result.rawFramingRefs = [...refSet];
      result.rawRooms = [...roomSet];

      setPages(extractedPages);
      setDimensions(extractedDims);
      setFramingRefs([...refSet]);
      setRooms([...roomSet]);
      setExtractionResult({ ...result });
      onExtractionComplete?.({ ...result });

      // Auto-detect scale from dimension text
      tryAutoScale(extractedDims, images[0]);

      const aiPages = classifications.filter((c) => AI_PAGE_TYPES.includes(c.type));
      if (hasAi && aiPages.length > 0) {
        reportProgress("done", totalPages, totalPages, `Done. ${aiPages.length} pages queued for AI.`);
      } else {
        reportProgress("done", totalPages, totalPages, `Done \u2014 ${totalPages} pages, ${extractedDims.length} dims, ${result.wallTypes.length} wall types`);
      }
    } catch (err) {
      setProgressText("Error: " + err.message);
      onScanProgress?.(null);
    }
    setIsScanning(false);
  }, [onExtractionComplete, onScanProgress, projectId]);

  // ── Auto-scale detection from dimension callouts ──────────────────
  const tryAutoScale = (dims, firstImage) => {
    // Look for scale notation in dimension text like "1/4" = 1'-0""
    // This is a best-effort heuristic — user always verifies
    const scalePatterns = [
      { regex: /1\/4"\s*=\s*1'-0"/, pixelsPerFoot: null, ratio: 48 },
      { regex: /1\/8"\s*=\s*1'-0"/, ratio: 96 },
      { regex: /1"\s*=\s*4'/, ratio: 48 },
      { regex: /1"\s*=\s*8'/, ratio: 96 },
      { regex: /Scale:\s*1[:/](\d+)/, extract: (m) => +m[1] },
    ];
    // For now, auto-scale is attempted but we don't auto-set —
    // just show a suggestion. Manual calibration is the primary flow.
  };

  // ── File upload handler ───────────────────────────────────────────
  const handleFileUpload = useCallback(async (event) => {
    const file = event.target.files?.[0];
    if (!file || !window.pdfjsLib) return;

    setFileName(file.name);
    const buffer = await file.arrayBuffer();

    if (projectId) {
      try {
        await savePlanFile(projectId, file.name, buffer);
        await updateProject(projectId, { planFileName: file.name });
      } catch (err) {
        console.error("Failed to save plan file:", err);
      }
    }

    await runExtraction(buffer, file.name);
  }, [projectId, runExtraction]);

  // ── Auto-load stored plan ─────────────────────────────────────────
  const hasAutoLoaded = useRef(false);
  useEffect(() => {
    if (!initialPlanFileName || !projectId || !isPdfLoaded || hasAutoLoaded.current) return;
    hasAutoLoaded.current = true;
    let cancelled = false;

    (async () => {
      try {
        setProgressText("Loading saved plan...");
        const buffer = await getPlanFile(projectId, initialPlanFileName);
        if (!buffer || cancelled) { setProgressText(""); return; }
        setFileName(initialPlanFileName);
        await runExtraction(buffer, initialPlanFileName);
      } catch (err) {
        if (!cancelled) setProgressText("Failed to load saved plan: " + err.message);
      }
    })();

    return () => { cancelled = true; };
  }, [initialPlanFileName, projectId, isPdfLoaded, runExtraction]);

  // ── Pass 3: AI Vision extraction ──────────────────────────────────
  const runAiExtraction = useCallback(async () => {
    if (!pdfRef.current || !isAiAvailable() || !extractionResult) return;
    setIsAiRunning(true);
    const pdf = pdfRef.current;
    const result = { ...extractionResult };
    for (const key of ["wallSegments", "openings", "structuralMembers", "steelMembers", "hardware", "warnings", "floorSpecs", "roofSpecs"]) {
      result[key] = [...(result[key] || [])];
    }
    result.specOverrides = { ...result.specOverrides };

    const aiPages = pageClassifications.filter((c) => AI_PAGE_TYPES.includes(c.type));

    for (let idx = 0; idx < aiPages.length; idx++) {
      const cls = aiPages[idx];
      setAiProgress(`AI extracting page ${cls.page} (${cls.type.replace(/_/g, " ")}) \u2014 ${idx + 1}/${aiPages.length}...`);

      try {
        const page = await pdf.getPage(cls.page);
        const viewport = page.getViewport({ scale: AI_RENDER_SCALE });
        const canvas = document.createElement("canvas");
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;

        const dataUrl = canvas.toDataURL("image/png");
        const base64 = dataUrl.split(",")[1];

        const rawText = dimensions.filter((d) => d.page === cls.page).map((d) => d.raw).join(", ");
        const aiResult = await extractWithAi(base64, cls.type, rawText);
        const mapped = mapAiResult(aiResult, cls.type, cls.page);
        mergeIntoResult(result, mapped);
      } catch (err) {
        result.warnings.push("AI failed page " + cls.page + " (" + cls.type + "): " + err.message);
      }
    }

    setExtractionResult({ ...result });
    onExtractionComplete?.({ ...result });
    setAiProgress("");
    setIsAiRunning(false);
    setProgressText("AI done \u2014 " + result.wallSegments.length + " walls, " + result.structuralMembers.length + " members, " + result.steelMembers.length + " steel");
  }, [extractionResult, pageClassifications, dimensions, onExtractionComplete]);

  // ── Scale confirmation ────────────────────────────────────────────
  const confirmScale = () => {
    const value = +scaleInputValue;
    if (value > 0) {
      setScaleFeet(value);
      setIsScaleSet(true);
    }
    setShowScaleInput(false);
    setActiveTool(null);
  };

  // ── Scale verification confirmation ───────────────────────────────
  const confirmVerify = () => {
    const entered = +verifyInputValue;
    if (entered > 0 && pendingVerifyPixels > 0) {
      const calculated = pxToFeet(pendingVerifyPixels);
      const error = Math.abs(calculated - entered) / entered;
      setScaleVerifications((prev) => [...prev, { entered, calculated, error, timestamp: Date.now() }]);
    }
    setShowVerifyInput(false);
    setVerifyInputValue("");
    setPendingVerifyPixels(0);
    setActiveTool(null);
  };

  const avgVerificationError = useMemo(() => {
    if (scaleVerifications.length === 0) return null;
    return scaleVerifications.reduce((s, v) => s + v.error, 0) / scaleVerifications.length;
  }, [scaleVerifications]);

  // ── Create condition ──────────────────────────────────────────────
  const createCondition = () => {
    if (!conditionForm.name.trim()) return;
    const cond = {
      id: Date.now(),
      name: conditionForm.name.trim(),
      color: nextConditionColor(conditions),
      type: conditionForm.type,
      targetCalculator: conditionForm.target,
      wallType: conditionForm.wallType,
    };
    setConditions((prev) => [...prev, cond]);
    setActiveConditionId(cond.id);
    pushUndo("condition", cond);
    setShowConditionDialog(false);
    setConditionForm({ name: "", type: "linear", target: "wall", wallType: "Exterior" });
    // Auto-select appropriate tool
    if (cond.type === "linear") setActiveTool("polyline");
    else if (cond.type === "area") setActiveTool("area");
    else if (cond.type === "count") setActiveTool("count");
  };

  const removeCondition = (id) => {
    setConditions((prev) => prev.filter((c) => c.id !== id));
    setMeasurements((prev) => prev.filter((m) => m.conditionId !== id));
    if (activeConditionId === id) setActiveConditionId(null);
  };

  // ── Canvas click handler ──────────────────────────────────────────
  const handleCanvasClick = (event) => {
    if (!activeTool || isPanning) return;
    const pt = viewportToImage(event.clientX, event.clientY);

    switch (activeTool) {
      case "scale": {
        const pts = [...activePoints, pt];
        setActivePoints(pts);
        if (pts.length === 2) {
          setScalePixels(pointDistance(pts[0], pts[1]));
          setShowScaleInput(true);
          setActivePoints([]);
        }
        break;
      }
      case "verify": {
        if (!isScaleSet) return;
        const pts = [...activePoints, pt];
        setActivePoints(pts);
        if (pts.length === 2) {
          setPendingVerifyPixels(pointDistance(pts[0], pts[1]));
          setShowVerifyInput(true);
          setActivePoints([]);
        }
        break;
      }
      case "linear": {
        const pts = [...activePoints, pt];
        setActivePoints(pts);
        if (pts.length === 2) {
          const px = pointDistance(pts[0], pts[1]);
          const feet = pxToFeet(px);
          const m = {
            id: Date.now(), tool: "linear", points: pts, pixels: px, feet, sqft: 0, count: 0,
            page: activePageIndex, conditionId: activeConditionId,
            label: "L" + (measurements.length + 1),
          };
          setMeasurements((prev) => [...prev, m]);
          pushUndo("measurement", m);
          setActivePoints([]);
        }
        break;
      }
      case "polyline": {
        setActivePoints((prev) => [...prev, pt]);
        break;
      }
      case "area": {
        setActivePoints((prev) => [...prev, pt]);
        break;
      }
      case "count": {
        const m = {
          id: Date.now(), tool: "count", points: [pt], pixels: 0, feet: 0, sqft: 0, count: 1,
          page: activePageIndex, conditionId: activeConditionId,
          label: "C" + (measurements.filter((x) => x.tool === "count").length + 1),
        };
        setMeasurements((prev) => [...prev, m]);
        pushUndo("measurement", m);
        break;
      }
      default: break;
    }
  };

  const handleCanvasDoubleClick = (event) => {
    if (activeTool === "polyline" && activePoints.length >= 2) {
      const px = polylineLength(activePoints);
      const feet = pxToFeet(px);
      const m = {
        id: Date.now(), tool: "polyline", points: [...activePoints], pixels: px, feet, sqft: 0, count: 0,
        page: activePageIndex, conditionId: activeConditionId,
        label: "P" + (measurements.filter((x) => x.tool === "polyline").length + 1),
      };
      setMeasurements((prev) => [...prev, m]);
      pushUndo("measurement", m);
      setActivePoints([]);
    }
    if (activeTool === "area" && activePoints.length >= 3) {
      const pxArea = polygonArea(activePoints);
      const sqft = pxAreaToSqFt(pxArea);
      const perimPx = polylineLength([...activePoints, activePoints[0]]);
      const m = {
        id: Date.now(), tool: "area", points: [...activePoints], pixels: perimPx, feet: pxToFeet(perimPx), sqft, count: 0,
        page: activePageIndex, conditionId: activeConditionId,
        label: "A" + (measurements.filter((x) => x.tool === "area").length + 1),
      };
      setMeasurements((prev) => [...prev, m]);
      pushUndo("measurement", m);
      setActivePoints([]);
    }
  };

  // ── Mouse move for rubber-band preview ────────────────────────────
  const handleCanvasMouseMove = (event) => {
    if (isPanning && panStartRef.current) {
      const dx = event.clientX - panStartRef.current.x;
      const dy = event.clientY - panStartRef.current.y;
      setPanOffset({ x: panStartRef.current.ox + dx, y: panStartRef.current.oy + dy });
      return;
    }
    if (!activeTool || activeTool === "select") return;
    const pt = viewportToImage(event.clientX, event.clientY);
    setCursorPos(pt);
  };

  // ── Middle-click pan / space+drag ─────────────────────────────────
  const handleMouseDown = (event) => {
    if (event.button === 1 || (event.button === 0 && event.shiftKey) || (event.button === 0 && activeTool === "pan")) {
      event.preventDefault();
      setIsPanning(true);
      panStartRef.current = { x: event.clientX, y: event.clientY, ox: panOffset.x, oy: panOffset.y };
    }
  };
  const handleMouseUp = () => {
    if (isPanning) { setIsPanning(false); panStartRef.current = null; }
  };

  // ── Zoom via scroll wheel ─────────────────────────────────────────
  const handleWheel = (event) => {
    event.preventDefault();
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;

    const oldZoom = zoom;
    const delta = event.deltaY < 0 ? 1.15 : 1 / 1.15;
    const newZoom = Math.min(Math.max(oldZoom * delta, 0.25), 5);

    // Zoom toward cursor position
    const newPanX = mouseX - (mouseX - panOffset.x) * (newZoom / oldZoom);
    const newPanY = mouseY - (mouseY - panOffset.y) * (newZoom / oldZoom);

    setZoom(newZoom);
    setPanOffset({ x: newPanX, y: newPanY });
  };

  const resetView = () => { setZoom(1); setPanOffset({ x: 0, y: 0 }); };

  // ── Keyboard shortcuts ────────────────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "SELECT" || e.target.tagName === "TEXTAREA") return;
      if (e.key === "Escape") { setActiveTool(null); setActivePoints([]); setCursorPos(null); }
      if (e.ctrlKey && e.key === "z") { e.preventDefault(); handleUndo(); }
      if (e.key === "1") setActiveTool("select");
      if (e.key === "2") setActiveTool("scale");
      if (e.key === "3") setActiveTool("verify");
      if (e.key === "4") setActiveTool("linear");
      if (e.key === "5") setActiveTool("polyline");
      if (e.key === "6") setActiveTool("area");
      if (e.key === "7") setActiveTool("count");
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const saveApiKey = () => {
    storeApiKey(apiKeyInput);
    setShowApiKeySection(false);
  };

  // ── Draw overlay ──────────────────────────────────────────────────
  const drawOverlay = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;

    const displayW = img.clientWidth * zoom;
    const displayH = img.clientHeight * zoom;
    canvas.width = img.clientWidth;
    canvas.height = img.clientHeight;
    canvas.style.width = displayW + "px";
    canvas.style.height = displayH + "px";
    canvas.style.left = panOffset.x + "px";
    canvas.style.top = panOffset.y + "px";

    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    // Helper: draw dimension line with tick marks
    const drawDimLine = (a, b, label, color, lineWidth = 2) => {
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth / zoom;
      ctx.stroke();

      // Tick marks at endpoints
      const angle = Math.atan2(b.y - a.y, b.x - a.x);
      const perpAngle = angle + Math.PI / 2;
      const tickLen = 6 / zoom;
      [a, b].forEach((pt) => {
        ctx.beginPath();
        ctx.moveTo(pt.x + Math.cos(perpAngle) * tickLen, pt.y + Math.sin(perpAngle) * tickLen);
        ctx.lineTo(pt.x - Math.cos(perpAngle) * tickLen, pt.y - Math.sin(perpAngle) * tickLen);
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5 / zoom;
        ctx.stroke();
      });

      // Endpoint dots
      [a, b].forEach((pt) => {
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 4 / zoom, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.strokeStyle = "#000";
        ctx.lineWidth = 0.5 / zoom;
        ctx.stroke();
      });

      // Label at midpoint
      if (label) {
        const mid = midpoint(a, b);
        const fontSize = Math.max(10, 13 / zoom);
        ctx.font = `bold ${fontSize}px Inter, sans-serif`;
        const tw = ctx.measureText(label).width;
        const pad = 5 / zoom;
        ctx.fillStyle = "rgba(0,0,0,0.85)";
        ctx.fillRect(mid.x - tw / 2 - pad, mid.y - fontSize / 2 - pad / 2, tw + pad * 2, fontSize + pad);
        ctx.fillStyle = "#fbbf24";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(label, mid.x, mid.y);
      }
    };

    // Helper: draw vertex marker
    const drawVertex = (pt, color, radius = 4) => {
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, radius / zoom, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 1.5 / zoom;
      ctx.stroke();
    };

    // ── Draw completed measurements ──────────────────────────────
    const pageMeasurements = measurements.filter((m) => m.page === activePageIndex);

    for (const m of pageMeasurements) {
      const cond = conditions.find((c) => c.id === m.conditionId);
      const color = cond?.color || colors.accent;

      if (m.tool === "linear") {
        const label = isScaleSet ? m.feet.toFixed(1) + "'" : Math.round(m.pixels) + "px";
        drawDimLine(m.points[0], m.points[1], label, color);
      }

      if (m.tool === "polyline") {
        ctx.beginPath();
        m.points.forEach((pt, i) => {
          if (i === 0) ctx.moveTo(pt.x, pt.y); else ctx.lineTo(pt.x, pt.y);
        });
        ctx.strokeStyle = color;
        ctx.lineWidth = 2.5 / zoom;
        ctx.stroke();

        // Vertex markers
        m.points.forEach((pt) => drawVertex(pt, color));

        // Segment labels
        for (let i = 1; i < m.points.length; i++) {
          const segPx = pointDistance(m.points[i - 1], m.points[i]);
          const segFt = pxToFeet(segPx);
          const mid = midpoint(m.points[i - 1], m.points[i]);
          const fontSize = Math.max(9, 11 / zoom);
          ctx.font = `bold ${fontSize}px Inter, sans-serif`;
          const label = segFt > 0 ? segFt.toFixed(1) + "'" : "";
          if (label) {
            const tw = ctx.measureText(label).width;
            ctx.fillStyle = "rgba(0,0,0,0.75)";
            ctx.fillRect(mid.x - tw / 2 - 3 / zoom, mid.y - fontSize / 2 - 2 / zoom, tw + 6 / zoom, fontSize + 4 / zoom);
            ctx.fillStyle = color;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(label, mid.x, mid.y);
          }
        }

        // Total label at last point
        const last = m.points[m.points.length - 1];
        const totalLabel = isScaleSet ? m.feet.toFixed(1) + "' total" : "";
        if (totalLabel) {
          const fontSize = Math.max(10, 13 / zoom);
          ctx.font = `bold ${fontSize}px Inter, sans-serif`;
          const tw = ctx.measureText(totalLabel).width;
          ctx.fillStyle = "rgba(0,0,0,0.9)";
          ctx.fillRect(last.x + 8 / zoom, last.y - fontSize / 2 - 3 / zoom, tw + 10 / zoom, fontSize + 6 / zoom);
          ctx.fillStyle = "#fff";
          ctx.textAlign = "left";
          ctx.textBaseline = "middle";
          ctx.fillText(totalLabel, last.x + 13 / zoom, last.y);
        }
      }

      if (m.tool === "area") {
        // Filled polygon
        ctx.beginPath();
        m.points.forEach((pt, i) => {
          if (i === 0) ctx.moveTo(pt.x, pt.y); else ctx.lineTo(pt.x, pt.y);
        });
        ctx.closePath();
        ctx.fillStyle = color + "25";
        ctx.fill();
        ctx.strokeStyle = color;
        ctx.lineWidth = 2 / zoom;
        ctx.stroke();

        m.points.forEach((pt) => drawVertex(pt, color, 3));

        // Area label at centroid
        const cent = polygonCentroid(m.points);
        const areaLabel = m.sqft > 0 ? Math.round(m.sqft) + " SF" : "";
        if (areaLabel) {
          const fontSize = Math.max(12, 16 / zoom);
          ctx.font = `bold ${fontSize}px Inter, sans-serif`;
          const tw = ctx.measureText(areaLabel).width;
          ctx.fillStyle = "rgba(0,0,0,0.85)";
          ctx.fillRect(cent.x - tw / 2 - 6 / zoom, cent.y - fontSize / 2 - 4 / zoom, tw + 12 / zoom, fontSize + 8 / zoom);
          ctx.fillStyle = color;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(areaLabel, cent.x, cent.y);
        }
      }

      if (m.tool === "count") {
        const pt = m.points[0];
        const r = 10 / zoom;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2);
        ctx.fillStyle = color + "50";
        ctx.fill();
        ctx.strokeStyle = color;
        ctx.lineWidth = 2 / zoom;
        ctx.stroke();

        const fontSize = Math.max(9, 11 / zoom);
        ctx.font = `bold ${fontSize}px Inter, sans-serif`;
        ctx.fillStyle = "#fff";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(m.label.replace("C", ""), pt.x, pt.y);
      }
    }

    // ── Draw active points (in-progress measurement) ─────────────
    if (activePoints.length > 0) {
      const toolColor = activeTool === "scale" ? colors.blue : activeTool === "verify" ? colors.teal : colors.green;

      if (activeTool === "polyline" || activeTool === "area") {
        ctx.beginPath();
        activePoints.forEach((pt, i) => { if (i === 0) ctx.moveTo(pt.x, pt.y); else ctx.lineTo(pt.x, pt.y); });
        if (cursorPos) ctx.lineTo(cursorPos.x, cursorPos.y);
        if (activeTool === "area" && activePoints.length >= 2 && cursorPos) {
          // Show closing line preview
          ctx.strokeStyle = toolColor + "60";
          ctx.lineWidth = 1.5 / zoom;
          ctx.setLineDash([5 / zoom, 5 / zoom]);
          ctx.stroke();
          ctx.setLineDash([]);
          // Solid part
          ctx.beginPath();
          activePoints.forEach((pt, i) => { if (i === 0) ctx.moveTo(pt.x, pt.y); else ctx.lineTo(pt.x, pt.y); });
        }
        ctx.strokeStyle = toolColor;
        ctx.lineWidth = 2 / zoom;
        ctx.stroke();

        activePoints.forEach((pt) => drawVertex(pt, toolColor, 5));
      } else {
        // Scale, verify, linear — just show dots
        activePoints.forEach((pt) => drawVertex(pt, toolColor, 6));
      }

      // Rubber-band line from last active point to cursor
      if (cursorPos && activePoints.length > 0 && (activeTool === "linear" || activeTool === "scale" || activeTool === "verify")) {
        const last = activePoints[activePoints.length - 1];
        ctx.beginPath();
        ctx.moveTo(last.x, last.y);
        ctx.lineTo(cursorPos.x, cursorPos.y);
        ctx.strokeStyle = toolColor + "80";
        ctx.lineWidth = 1.5 / zoom;
        ctx.setLineDash([4 / zoom, 4 / zoom]);
        ctx.stroke();
        ctx.setLineDash([]);

        // Live distance preview
        const px = pointDistance(last, cursorPos);
        const ft = pxToFeet(px);
        const previewLabel = isScaleSet && ft > 0 ? ft.toFixed(1) + "'" : Math.round(px) + "px";
        const mid = midpoint(last, cursorPos);
        const fontSize = Math.max(10, 12 / zoom);
        ctx.font = `bold ${fontSize}px Inter, sans-serif`;
        const tw = ctx.measureText(previewLabel).width;
        ctx.fillStyle = "rgba(0,0,0,0.7)";
        ctx.fillRect(mid.x - tw / 2 - 4 / zoom, mid.y - fontSize / 2 - 2 / zoom, tw + 8 / zoom, fontSize + 4 / zoom);
        ctx.fillStyle = toolColor;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(previewLabel, mid.x, mid.y);
      }

      // Rubber-band for polyline/area from last point to cursor
      if (cursorPos && activePoints.length > 0 && (activeTool === "polyline" || activeTool === "area")) {
        const last = activePoints[activePoints.length - 1];
        const segPx = pointDistance(last, cursorPos);
        const segFt = pxToFeet(segPx);
        const mid = midpoint(last, cursorPos);
        const previewLabel = segFt > 0 ? segFt.toFixed(1) + "'" : "";
        if (previewLabel) {
          const fontSize = Math.max(9, 10 / zoom);
          ctx.font = `bold ${fontSize}px Inter, sans-serif`;
          const tw = ctx.measureText(previewLabel).width;
          ctx.fillStyle = "rgba(0,0,0,0.6)";
          ctx.fillRect(mid.x - tw / 2 - 3 / zoom, mid.y - fontSize / 2 - 2 / zoom, tw + 6 / zoom, fontSize + 4 / zoom);
          ctx.fillStyle = toolColor + "cc";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(previewLabel, mid.x, mid.y);
        }
      }
    }
  }, [measurements, activePoints, cursorPos, activePageIndex, isScaleSet, scalePixels, scaleFeet, activeTool, conditions, zoom, panOffset, pxToFeet, pxAreaToSqFt]);

  useEffect(() => { drawOverlay(); }, [drawOverlay, pageImages, activePageIndex]);

  // ── Condition totals ──────────────────────────────────────────────
  const conditionTotals = useMemo(() => {
    const map = {};
    for (const c of conditions) {
      const ms = measurements.filter((m) => m.conditionId === c.id && m.page === activePageIndex);
      const allMs = measurements.filter((m) => m.conditionId === c.id);
      if (c.type === "linear") {
        map[c.id] = { totalFeet: allMs.reduce((s, m) => s + m.feet, 0), count: allMs.length, pageFeet: ms.reduce((s, m) => s + m.feet, 0) };
      } else if (c.type === "area") {
        map[c.id] = { totalSqFt: allMs.reduce((s, m) => s + m.sqft, 0), count: allMs.length };
      } else if (c.type === "count") {
        map[c.id] = { totalCount: allMs.length, count: allMs.length };
      }
    }
    return map;
  }, [conditions, measurements, activePageIndex]);

  // ── Send conditions to takeoff ────────────────────────────────────
  const sendConditionsToTakeoff = () => {
    // Build wall import data from linear conditions tagged "wall"
    const wallConditions = conditions.filter((c) => c.targetCalculator === "wall" && c.type === "linear");
    if (wallConditions.length > 0) {
      const walls = wallConditions.map((c) => {
        const ms = measurements.filter((m) => m.conditionId === c.id);
        const totalFeet = ms.reduce((s, m) => s + m.feet, 0);
        return {
          id: c.id, name: c.name, type: c.wallType || "Exterior",
          length: Math.round(totalFeet * 10) / 10, height: 8, openings: 0,
        };
      });
      onSendToWalls(walls.map((w) => ({ raw: w.length + "'", feet: w.length, type: "condition" })));
    }

    // Build floor import from area conditions tagged "floor"
    const floorConditions = conditions.filter((c) => c.targetCalculator === "floor" && c.type === "area");
    if (floorConditions.length > 0) {
      const areas = floorConditions.map((c) => {
        const ms = measurements.filter((m) => m.conditionId === c.id);
        const totalSqFt = ms.reduce((s, m) => s + m.sqft, 0);
        const approxSide = Math.sqrt(totalSqFt);
        return { raw: Math.round(totalSqFt) + " SF", feet: approxSide, type: "area" };
      });
      onSendToFloors(areas);
    }

    // Build roof import from area conditions tagged "roof"
    const roofConditions = conditions.filter((c) => c.targetCalculator === "roof" && c.type === "area");
    if (roofConditions.length > 0) {
      const areas = roofConditions.map((c) => {
        const ms = measurements.filter((m) => m.conditionId === c.id);
        const totalSqFt = ms.reduce((s, m) => s + m.sqft, 0);
        const approxSide = Math.sqrt(totalSqFt);
        return { raw: Math.round(totalSqFt) + " SF", feet: approxSide, type: "area" };
      });
      onSendToRoof(areas);
    }
  };

  // ── Legacy manual send (extracted dims + standalone measurements) ──
  const toggleDimension = (index) => {
    setSelectedIndices((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index); else next.add(index);
      return next;
    });
  };

  const sendSelectedToTakeoff = () => {
    const selected = [...selectedIndices].map((i) => dimensions[i]);
    const manual = measurements.filter((m) => !m.conditionId && (m.tool === "linear" || m.tool === "polyline")).map((m) => ({
      raw: m.feet.toFixed(1) + "'", feet: m.feet, type: "measured", page: m.page + 1,
    }));
    const all = [...selected, ...manual];
    if (sendTarget === "walls") onSendToWalls(all);
    else if (sendTarget === "floors") onSendToFloors(all);
    else onSendToRoof(all);
  };

  const typeColor = (type) => {
    const map = {
      FLOOR_PLAN: colors.green, ELEVATION: colors.teal, SECTION_DETAIL: colors.orange,
      WALL_SCHEDULE: colors.accent, DOOR_WINDOW_SCHEDULE: colors.purple, STRUCTURAL_PLAN: colors.blue,
      ROOF_PLAN: colors.cyan, GENERAL_NOTES: colors.dim, TITLE_SHEET: colors.muted, SITE_PLAN: colors.muted,
    };
    return map[type] || colors.dim;
  };

  // ── Active condition color for toolbar indicator ───────────────────
  const activeCondition = conditions.find((c) => c.id === activeConditionId);

  // ── Cursor style ──────────────────────────────────────────────────
  const cursorStyle = isPanning ? "grabbing" : activeTool === "pan" ? "grab" : activeTool && activeTool !== "select" ? "crosshair" : "default";

  return (
    <div>
      <Section title="Upload Construction Plans (PDF)" color={colors.primary}>
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <label style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            background: isPdfLoaded ? colors.primary : colors.borderMid, color: "#fff",
            padding: "12px 24px", borderRadius: 8, cursor: isPdfLoaded ? "pointer" : "not-allowed",
            fontWeight: 800, fontSize: 14,
          }}>
            {isScanning ? "Scanning..." : "Choose PDF File"}
            <input type="file" accept=".pdf" onChange={handleFileUpload} disabled={!isPdfLoaded || isScanning} style={{ display: "none" }} aria-label="Upload PDF" />
          </label>
          <Button onClick={() => setShowApiKeySection(!showApiKeySection)} color={isAiAvailable() ? colors.green : colors.orange} outline>
            {isAiAvailable() ? "AI Ready" : "Set API Key"}
          </Button>
          {fileName && <span style={{ fontSize: 13, color: colors.textDark, fontWeight: 600 }}>{fileName}</span>}
          {progressText && <span style={{ fontSize: 12, color: colors.green, fontWeight: 600 }}>{progressText}</span>}
        </div>

        {showApiKeySection && (
          <div style={{ marginTop: 12, background: colors.contentAlt, borderRadius: 8, padding: "12px 16px", border: "1px solid " + colors.borderLight }}>
            <div style={{ fontSize: 12, color: colors.muted, marginBottom: 8 }}>
              Anthropic API key for AI Vision extraction. Stored in browser only.
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input type="password" value={apiKeyInput} onChange={(e) => setApiKeyInput(e.target.value)}
                placeholder="sk-ant-..." aria-label="Anthropic API key"
                style={{ flex: 1, background: colors.inputBgLight, border: "1px solid " + colors.inputBorderLight, borderRadius: 6, padding: "8px 12px", color: colors.textDark, fontSize: 13, fontFamily: fonts.mono, outline: "none" }} />
              <Button onClick={saveApiKey} color={colors.green}>Save</Button>
            </div>
          </div>
        )}
      </Section>

      {pages.length > 0 && (
        <>
          <Section title="Scan Results" color={colors.green}>
            <Row>
              <ResultCard label="Pages" value={pages.length} color={colors.cyan} large />
              <ResultCard label="Dimensions" value={dimensions.length} color={colors.primary} large />
              <ResultCard label="Framing Refs" value={framingRefs.length} color={colors.blue} />
              <ResultCard label="Rooms" value={rooms.length} color={colors.purple} />
              {extractionResult && (
                <>
                  <ResultCard label="Wall Types" value={extractionResult.wallTypes.length} color={colors.orange} />
                  <ResultCard label="Openings" value={extractionResult.openings.length} color={colors.teal} />
                  <ResultCard label="Steel" value={extractionResult.steelMembers.length} color={colors.primary} />
                </>
              )}
            </Row>
          </Section>

          {pageClassifications.length > 0 && (
            <Section title="Page Classification" color={colors.blue}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {pageClassifications.map((cls) => (
                  <button key={cls.page} onClick={() => { setActivePageIndex(cls.page - 1); setActivePoints([]); }}
                    style={{
                      padding: "4px 10px", borderRadius: 6, border: "1px solid " + typeColor(cls.type) + "40",
                      background: activePageIndex === cls.page - 1 ? typeColor(cls.type) + "18" : colors.contentBg,
                      cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 2, minWidth: 60,
                    }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: colors.textDark }}>Pg {cls.page}</span>
                    <span style={{ fontSize: 9, fontWeight: 600, color: typeColor(cls.type), textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      {cls.type.replace(/_/g, " ")}
                    </span>
                    <span style={{ fontSize: 8, color: colors.dim }}>{Math.round(cls.confidence * 100)}%</span>
                  </button>
                ))}
              </div>

              {isAiAvailable() && pageClassifications.some((c) => AI_PAGE_TYPES.includes(c.type)) && (
                <div style={{ marginTop: 10, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                  <Button onClick={runAiExtraction} color={colors.purple} disabled={isAiRunning}>
                    {isAiRunning ? "AI Running..." : "Run AI (" + pageClassifications.filter((c) => AI_PAGE_TYPES.includes(c.type)).length + " pages)"}
                  </Button>
                  {aiProgress && <span style={{ fontSize: 12, color: colors.purple, fontWeight: 600 }}>{aiProgress}</span>}
                </div>
              )}
            </Section>
          )}

          {/* Extracted schedules, spec overrides, structural members — unchanged */}
          {extractionResult && (extractionResult.wallTypes.length > 0 || extractionResult.openings.length > 0) && (
            <Section title="Extracted Schedules" color={colors.orange}>
              {extractionResult.wallTypes.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: colors.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Wall Types</div>
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                      <thead><tr>{["Type", "Stud", "Spac", "Ht", "Sheath", "Ext?"].map((h) => (
                        <th key={h} style={{ padding: "5px 8px", background: colors.contentAlt, color: colors.muted, fontSize: 10, fontWeight: 700, textAlign: "center", borderBottom: "2px solid " + colors.borderLight }}>{h}</th>
                      ))}</tr></thead>
                      <tbody>
                        {extractionResult.wallTypes.map((wt, i) => (
                          <tr key={i} style={{ borderBottom: "1px solid " + colors.borderLight, background: i % 2 === 0 ? colors.contentBg : colors.contentAlt }}>
                            <td style={{ padding: "4px 8px", fontWeight: 700, color: colors.primary, fontFamily: fonts.mono, textAlign: "center" }}>{wt.type}</td>
                            <td style={{ padding: "4px 8px", textAlign: "center", fontFamily: fonts.mono, color: colors.textDark }}>{wt.studSize}</td>
                            <td style={{ padding: "4px 8px", textAlign: "center", fontFamily: fonts.mono, color: colors.textDark }}>{wt.spacing}"</td>
                            <td style={{ padding: "4px 8px", textAlign: "center", fontFamily: fonts.mono, color: colors.textDark }}>{wt.height}'</td>
                            <td style={{ padding: "4px 8px", textAlign: "center", fontSize: 10, color: colors.textDark }}>{wt.sheathingType || "\u2014"}</td>
                            <td style={{ padding: "4px 8px", textAlign: "center", color: wt.exterior ? colors.green : colors.dim }}>{wt.exterior ? "Yes" : "No"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              {extractionResult.openings.length > 0 && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: colors.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Openings</div>
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                      <thead><tr>{["Mark", "Cat", "W", "H", "Qty", "Header", "Wall"].map((h) => (
                        <th key={h} style={{ padding: "5px 8px", background: colors.contentAlt, color: colors.muted, fontSize: 10, fontWeight: 700, textAlign: "center", borderBottom: "2px solid " + colors.borderLight }}>{h}</th>
                      ))}</tr></thead>
                      <tbody>
                        {extractionResult.openings.map((o, i) => (
                          <tr key={i} style={{ borderBottom: "1px solid " + colors.borderLight, background: i % 2 === 0 ? colors.contentBg : colors.contentAlt }}>
                            <td style={{ padding: "4px 8px", fontWeight: 700, color: colors.purple, fontFamily: fonts.mono, textAlign: "center" }}>{o.mark}</td>
                            <td style={{ padding: "4px 8px", textAlign: "center", fontSize: 10, color: colors.textDark }}>{o.category}</td>
                            <td style={{ padding: "4px 8px", textAlign: "center", fontFamily: fonts.mono, color: colors.textDark }}>{o.width}'</td>
                            <td style={{ padding: "4px 8px", textAlign: "center", fontFamily: fonts.mono, color: colors.textDark }}>{o.height}'</td>
                            <td style={{ padding: "4px 8px", textAlign: "center", fontFamily: fonts.mono, color: colors.textDark }}>{o.quantity}</td>
                            <td style={{ padding: "4px 8px", textAlign: "center", fontFamily: fonts.mono, fontSize: 10, color: colors.textDark }}>{o.headerSize}</td>
                            <td style={{ padding: "4px 8px", textAlign: "center", fontSize: 10, color: colors.textDark }}>{o.wallType || "\u2014"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </Section>
          )}

          {extractionResult && Object.values(extractionResult.specOverrides).some((v) => v !== null) && (
            <Section title="Spec Overrides" color={colors.teal}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {Object.entries(extractionResult.specOverrides).filter(([, v]) => v !== null).map(([key, value]) => (
                  <div key={key} style={{ background: colors.contentBg, border: "1px solid " + colors.teal + "30", borderRadius: 6, padding: "6px 10px" }}>
                    <div style={{ fontSize: 9, color: colors.muted, textTransform: "uppercase", letterSpacing: "0.05em" }}>{key.replace(/([A-Z])/g, " $1").trim()}</div>
                    <div style={{ fontSize: 13, color: colors.teal, fontWeight: 700, fontFamily: fonts.mono }}>{value}</div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {extractionResult && (extractionResult.structuralMembers.length > 0 || extractionResult.steelMembers.length > 0 || extractionResult.hardware.length > 0) && (
            <Section title="Structural Members & Hardware" color={colors.primary}>
              {extractionResult.steelMembers.length > 0 && (
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: colors.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Steel</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                    {extractionResult.steelMembers.map((s, i) => (
                      <span key={i} style={{ background: colors.blue + "18", border: "1px solid " + colors.blue + "33", borderRadius: 4, padding: "4px 10px", fontSize: 12, color: colors.blue, fontWeight: 700, fontFamily: fonts.mono }}>
                        {s.shape || s.size} ({s.type}){s.span ? " \u2014 " + s.span + "'" : ""}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {extractionResult.hardware.length > 0 && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: colors.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Hardware</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                    {extractionResult.hardware.map((h, i) => (
                      <span key={i} style={{ background: colors.orange + "18", border: "1px solid " + colors.orange + "33", borderRadius: 4, padding: "4px 10px", fontSize: 12, color: colors.orange, fontWeight: 700 }}>
                        {h.model || h.type}{h.quantity ? " x" + h.quantity : ""} \u2014 {h.location || h.type}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </Section>
          )}

          {extractionResult && extractionResult.warnings.length > 0 && (
            <Section title={"Warnings (" + extractionResult.warnings.length + ")"} color={colors.orange}>
              {extractionResult.warnings.map((w, i) => (
                <div key={i} style={{ background: colors.orange + "12", border: "1px solid " + colors.orange + "30", borderRadius: 6, padding: "8px 12px", marginBottom: 4, fontSize: 12, color: colors.orange }}>{w}</div>
              ))}
            </Section>
          )}

          {/* ══════════════════════════════════════════════════════════
               PLAN VIEWER — Tool Palette + Canvas + Conditions
             ══════════════════════════════════════════════════════════ */}
          <Section title="Plan Viewer & Takeoff Tools" color={colors.primary}>
            {/* Page tabs */}
            <div style={{ display: "flex", gap: 2, marginBottom: 8, flexWrap: "wrap" }}>
              {pageImages.map((_, i) => (
                <button key={i} onClick={() => { setActivePageIndex(i); setActivePoints([]); setCursorPos(null); }}
                  aria-label={"Page " + (i + 1)} aria-current={activePageIndex === i ? "page" : undefined}
                  style={{ padding: "4px 10px", borderRadius: 4, border: "1px solid " + (activePageIndex === i ? colors.primary : colors.borderLight), cursor: "pointer", background: activePageIndex === i ? colors.primary : colors.contentBg, color: activePageIndex === i ? "#fff" : colors.muted, fontWeight: 700, fontSize: 11 }}>
                  Pg {i + 1}
                </button>
              ))}
            </div>

            {/* Main layout: horizontal toolbar above canvas */}
            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>

              {/* ── Horizontal Toolbar ──────────────── */}
              <div style={{
                display: "flex", alignItems: "center", gap: 0, padding: "4px 8px",
                background: colors.contentBg, border: "1px solid " + colors.borderLight,
                borderRadius: "8px 8px 0 0", flexWrap: "wrap",
              }}>
                {TOOL_GROUPS.map((group, gi) => (
                  <div key={group.label} style={{ display: "flex", alignItems: "center", gap: 2 }}>
                    {gi > 0 && (
                      <div style={{ width: 1, height: 28, background: colors.borderLight, margin: "0 6px" }} />
                    )}
                    {group.tools.map((toolId) => {
                      const tool = TOOLS.find((t) => t.id === toolId);
                      if (!tool) return null;
                      const isActive = activeTool === tool.id;
                      const isDisabled = tool.id === "verify" && !isScaleSet;
                      return (
                        <button key={tool.id}
                          onClick={() => { setActiveTool(activeTool === tool.id ? null : tool.id); setActivePoints([]); setCursorPos(null); }}
                          title={tool.tip}
                          disabled={isDisabled}
                          style={{
                            height: 32, padding: "0 10px", borderRadius: 5,
                            border: "1px solid " + (isActive ? colors.primary : "transparent"),
                            background: isActive ? colors.primary + "15" : "transparent",
                            color: isActive ? colors.primary : colors.muted,
                            cursor: isDisabled ? "not-allowed" : "pointer",
                            fontWeight: 600, fontSize: 11, display: "flex", alignItems: "center", gap: 4,
                            opacity: isDisabled ? 0.4 : 1, transition: "all 0.15s",
                          }}>
                          <span style={{ fontSize: 14 }}>{tool.icon}</span>
                          <span>{tool.label}</span>
                        </button>
                      );
                    })}
                  </div>
                ))}

                {/* Undo */}
                <div style={{ width: 1, height: 28, background: colors.borderLight, margin: "0 6px" }} />
                <button onClick={handleUndo} title="Undo (Ctrl+Z)"
                  style={{ height: 32, padding: "0 8px", borderRadius: 5, border: "none", background: "transparent", color: colors.muted, cursor: "pointer", fontWeight: 700, fontSize: 14 }}>
                  {"\u21A9"}
                </button>

                {/* Status badges */}
                {isScaleSet && (
                  <span style={{ color: colors.green, fontWeight: 700, background: colors.green + "15", padding: "2px 8px", borderRadius: 4, fontSize: 11, marginLeft: 4 }}>
                    Scale: {scaleFeet}' set
                  </span>
                )}
                {activeCondition && (
                  <span style={{ color: activeCondition.color, fontWeight: 700, padding: "2px 8px", borderRadius: 4, border: "1px solid " + activeCondition.color + "40", fontSize: 11, marginLeft: 4 }}>
                    {activeCondition.name}
                  </span>
                )}

                {/* Right side: zoom controls */}
                <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 3 }}>
                  <button onClick={() => setZoom((z) => Math.max(z / 1.25, 0.25))} title="Zoom Out"
                    style={{ width: 28, height: 28, borderRadius: 4, border: "1px solid " + colors.borderLight, background: colors.contentBg, color: colors.muted, cursor: "pointer", fontWeight: 800, fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center" }}>{"\u2212"}</button>
                  <span style={{ fontSize: 11, color: colors.dim, fontWeight: 700, fontFamily: fonts.mono, minWidth: 36, textAlign: "center" }}>{Math.round(zoom * 100)}%</span>
                  <button onClick={() => setZoom((z) => Math.min(z * 1.25, 5))} title="Zoom In"
                    style={{ width: 28, height: 28, borderRadius: 4, border: "1px solid " + colors.borderLight, background: colors.contentBg, color: colors.muted, cursor: "pointer", fontWeight: 800, fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>
                  <button onClick={resetView} title="Fit to Width"
                    style={{ height: 28, padding: "0 8px", borderRadius: 4, border: "1px solid " + colors.borderLight, background: colors.contentBg, color: colors.muted, cursor: "pointer", fontWeight: 700, fontSize: 10 }}>FIT</button>
                </div>
              </div>

              {/* ── Instruction Bar ──────────────── */}
              {activeTool && (
                <div style={{
                  display: "flex", alignItems: "center", gap: 10, padding: "6px 12px",
                  background: colors.primary + "08", borderLeft: "1px solid " + colors.borderLight,
                  borderRight: "1px solid " + colors.borderLight,
                  fontSize: 12, color: colors.textDark,
                }}>
                  <span style={{ fontWeight: 700, color: colors.primary }}>{TOOLS.find((t) => t.id === activeTool)?.label}:</span>
                  <span>{TOOL_INSTRUCTIONS[activeTool] || ""}</span>
                  {scaleVerifications.length > 0 && activeTool === "verify" && (
                    <span style={{
                      color: avgVerificationError < 0.03 ? colors.green : avgVerificationError < 0.08 ? colors.accent : colors.rose,
                      fontWeight: 700, marginLeft: 8,
                    }}>
                      {scaleVerifications.length} checks ({(100 - avgVerificationError * 100).toFixed(1)}% acc.)
                    </span>
                  )}
                  <button onClick={() => { setActiveTool(null); setActivePoints([]); setCursorPos(null); }}
                    style={{ marginLeft: "auto", padding: "2px 10px", borderRadius: 4, border: "1px solid " + colors.borderLight, background: colors.contentBg, color: colors.muted, cursor: "pointer", fontWeight: 600, fontSize: 11 }}>
                    Esc
                  </button>
                </div>
              )}

              {/* ── Canvas area ────────────────────────── */}
              <div style={{ flex: 1, minWidth: 0 }}>

                {/* Scale input dialog */}
                {showScaleInput && (
                  <div role="dialog" aria-label="Set scale" style={{ background: colors.blue + "18", border: "1px solid " + colors.blue + "50", borderRadius: 8, padding: "12px 16px", marginBottom: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 13, color: colors.blue, fontWeight: 700 }}>Distance (feet):</span>
                      <input ref={scaleInputRef} type="number" value={scaleInputValue} onChange={(e) => setScaleInputValue(e.target.value)} onKeyDown={(e) => e.key === "Enter" && confirmScale()} min="0.1" step="0.1"
                        style={{ background: colors.inputBgLight, border: "1px solid " + colors.inputBorderLight, borderRadius: 6, padding: "8px 12px", color: colors.primary, fontSize: 16, fontWeight: 700, fontFamily: fonts.mono, outline: "none", width: 100 }} />
                      <span style={{ color: colors.dim, fontWeight: 700 }}>ft</span>
                      <Button onClick={confirmScale} color={colors.blue}>Confirm</Button>
                      <Button onClick={() => { setShowScaleInput(false); setActiveTool(null); }} color={colors.muted} outline>Cancel</Button>
                    </div>
                    <div style={{ display: "flex", gap: 4, marginTop: 8, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 11, color: colors.dim, marginRight: 4, alignSelf: "center" }}>Quick:</span>
                      {[1, 2, 4, 5, 8, 10, 12, 16, 20].map((ft) => (
                        <button key={ft} onClick={() => setScaleInputValue(String(ft))}
                          style={{
                            padding: "3px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600, fontFamily: fonts.mono,
                            border: "1px solid " + (scaleInputValue === String(ft) ? colors.primary : colors.borderLight),
                            background: scaleInputValue === String(ft) ? colors.primary + "15" : "transparent",
                            color: scaleInputValue === String(ft) ? colors.primary : colors.muted, cursor: "pointer",
                          }}>
                          {ft}'
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Verify input dialog */}
                {showVerifyInput && (
                  <div role="dialog" aria-label="Verify scale" style={{ background: colors.teal + "18", border: "1px solid " + colors.teal + "50", borderRadius: 8, padding: "12px 16px", marginBottom: 8, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 13, color: colors.teal, fontWeight: 700 }}>
                      Measured: {pxToFeet(pendingVerifyPixels).toFixed(2)}' \u2014 Actual distance:
                    </span>
                    <input ref={verifyInputRef} type="number" value={verifyInputValue} onChange={(e) => setVerifyInputValue(e.target.value)} onKeyDown={(e) => e.key === "Enter" && confirmVerify()} min="0.1" step="0.1"
                      style={{ background: colors.inputBgLight, border: "1px solid " + colors.inputBorderLight, borderRadius: 6, padding: "8px 12px", color: colors.teal, fontSize: 16, fontWeight: 700, fontFamily: fonts.mono, outline: "none", width: 100 }} />
                    <span style={{ color: colors.dim, fontWeight: 700 }}>ft</span>
                    <Button onClick={confirmVerify} color={colors.teal}>Verify</Button>
                    <Button onClick={() => { setShowVerifyInput(false); setActiveTool(null); }} color={colors.muted} outline>Cancel</Button>
                  </div>
                )}

                {/* Help hints */}
                {!isScaleSet && !showScaleInput && pageImages.length > 0 && !activeTool && (
                  <div style={{ background: colors.orange + "12", border: "1px solid " + colors.orange + "30", borderRadius: 6, padding: "8px 12px", marginBottom: 6, fontSize: 12, color: colors.orange, display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontWeight: 800 }}>1.</span> Click <strong>Scale</strong> above, then click two endpoints of a known dimension to calibrate.
                  </div>
                )}

                {/* Canvas container with overflow for pan/zoom */}
                <div ref={containerRef}
                  onWheel={handleWheel}
                  onMouseDown={handleMouseDown}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                  style={{
                    position: "relative", background: "#fff", borderRadius: "0 0 8px 8px", overflow: "hidden",
                    height: 550, border: "1px solid " + colors.borderLight, borderTop: "none", cursor: cursorStyle,
                  }}>
                  <img ref={imgRef} src={pageImages[activePageIndex]?.dataUrl} alt={"Page " + (activePageIndex + 1)}
                    style={{
                      display: "block", userSelect: "none", pointerEvents: "none",
                      transformOrigin: "0 0", transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoom})`,
                    }}
                    onLoad={drawOverlay} />
                  <canvas ref={canvasRef}
                    onClick={handleCanvasClick}
                    onDoubleClick={handleCanvasDoubleClick}
                    onMouseMove={handleCanvasMouseMove}
                    aria-label="Plan measurement canvas"
                    style={{ position: "absolute", top: 0, left: 0, pointerEvents: "auto" }} />
                </div>
              </div>
            </div>

            {/* ── Conditions Panel ─────────────────────── */}
            <div style={{ marginTop: 12 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8, flexWrap: "wrap" }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: colors.muted, textTransform: "uppercase", letterSpacing: "0.1em" }}>Takeoff Conditions</span>
                <button onClick={() => setShowConditionDialog(true)}
                  style={{ padding: "4px 12px", borderRadius: 6, border: "1px dashed " + colors.borderMid, background: "transparent", color: colors.muted, cursor: "pointer", fontWeight: 700, fontSize: 11 }}>
                  + Add Condition
                </button>
                {conditions.length > 0 && (
                  <Button onClick={sendConditionsToTakeoff} color={colors.green} outline>
                    Send Conditions to Takeoff
                  </Button>
                )}
              </div>

              {/* New condition dialog */}
              {showConditionDialog && (
                <div style={{ background: colors.contentAlt, border: "1px solid " + colors.borderLight, borderRadius: 8, padding: 16, marginBottom: 12, maxWidth: 500 }}>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "end" }}>
                    <div style={{ flex: "1 1 160px" }}>
                      <label style={{ display: "block", fontSize: 10, color: colors.muted, fontWeight: 700, marginBottom: 3, textTransform: "uppercase", letterSpacing: "0.1em" }}>Name</label>
                      <input value={conditionForm.name} onChange={(e) => setConditionForm((f) => ({ ...f, name: e.target.value }))}
                        onKeyDown={(e) => e.key === "Enter" && createCondition()} placeholder="e.g. Exterior Walls"
                        autoFocus style={{ width: "100%", background: colors.inputBgLight, border: "1px solid " + colors.inputBorderLight, borderRadius: 6, padding: "8px 10px", color: colors.textDark, fontSize: 13, outline: "none" }} />
                    </div>
                    <div style={{ flex: "0 0 auto" }}>
                      <label style={{ display: "block", fontSize: 10, color: colors.muted, fontWeight: 700, marginBottom: 3, textTransform: "uppercase", letterSpacing: "0.1em" }}>Type</label>
                      <select value={conditionForm.type} onChange={(e) => setConditionForm((f) => ({ ...f, type: e.target.value }))}
                        style={{ background: colors.inputBgLight, border: "1px solid " + colors.inputBorderLight, borderRadius: 6, padding: "8px 10px", color: colors.textDark, fontSize: 13, outline: "none" }}>
                        <option value="linear">Linear (LF)</option>
                        <option value="area">Area (SF)</option>
                        <option value="count">Count</option>
                      </select>
                    </div>
                    <div style={{ flex: "0 0 auto" }}>
                      <label style={{ display: "block", fontSize: 10, color: colors.muted, fontWeight: 700, marginBottom: 3, textTransform: "uppercase", letterSpacing: "0.1em" }}>Target</label>
                      <select value={conditionForm.target} onChange={(e) => setConditionForm((f) => ({ ...f, target: e.target.value }))}
                        style={{ background: colors.inputBgLight, border: "1px solid " + colors.inputBorderLight, borderRadius: 6, padding: "8px 10px", color: colors.textDark, fontSize: 13, outline: "none" }}>
                        <option value="wall">Walls</option>
                        <option value="floor">Floors</option>
                        <option value="roof">Roof</option>
                      </select>
                    </div>
                    {conditionForm.target === "wall" && (
                      <div style={{ flex: "0 0 auto" }}>
                        <label style={{ display: "block", fontSize: 10, color: colors.muted, fontWeight: 700, marginBottom: 3, textTransform: "uppercase", letterSpacing: "0.1em" }}>Wall Type</label>
                        <select value={conditionForm.wallType} onChange={(e) => setConditionForm((f) => ({ ...f, wallType: e.target.value }))}
                          style={{ background: colors.inputBgLight, border: "1px solid " + colors.inputBorderLight, borderRadius: 6, padding: "8px 10px", color: colors.textDark, fontSize: 13, outline: "none" }}>
                          <option>Exterior</option>
                          <option>Interior</option>
                          <option>Bearing</option>
                        </select>
                      </div>
                    )}
                    <Button onClick={createCondition} color={colors.green}>Create</Button>
                    <Button onClick={() => setShowConditionDialog(false)} color={colors.muted} outline>Cancel</Button>
                  </div>
                </div>
              )}

              {/* Condition list */}
              {conditions.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {conditions.map((c) => {
                    const totals = conditionTotals[c.id] || {};
                    const isActive = activeConditionId === c.id;
                    return (
                      <div key={c.id} onClick={() => setActiveConditionId(isActive ? null : c.id)}
                        style={{
                          background: isActive ? c.color + "10" : colors.contentBg, border: "2px solid " + (isActive ? c.color : colors.borderLight),
                          borderRadius: 8, padding: "8px 12px", cursor: "pointer", minWidth: 140, position: "relative",
                        }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                          <div style={{ width: 10, height: 10, borderRadius: 2, background: c.color }} />
                          <span style={{ fontSize: 12, fontWeight: 700, color: colors.textDark }}>{c.name}</span>
                          <button onClick={(e) => { e.stopPropagation(); removeCondition(c.id); }}
                            style={{ marginLeft: "auto", background: "none", border: "none", color: colors.rose, cursor: "pointer", fontSize: 12, padding: "0 2px" }}>x</button>
                        </div>
                        <div style={{ fontSize: 11, color: colors.muted }}>
                          {c.type === "linear" && <span>{totals.count || 0} lines \u2014 <span style={{ color: c.color, fontWeight: 700, fontFamily: fonts.mono }}>{(totals.totalFeet || 0).toFixed(1)} LF</span></span>}
                          {c.type === "area" && <span>{totals.count || 0} areas \u2014 <span style={{ color: c.color, fontWeight: 700, fontFamily: fonts.mono }}>{Math.round(totals.totalSqFt || 0)} SF</span></span>}
                          {c.type === "count" && <span><span style={{ color: c.color, fontWeight: 700, fontFamily: fonts.mono }}>{totals.totalCount || 0}</span> items</span>}
                        </div>
                        <div style={{ fontSize: 9, color: colors.dim, marginTop: 2 }}>{c.type} \u2192 {c.targetCalculator}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Standalone measurements (not tied to conditions) */}
            {measurements.filter((m) => !m.conditionId).length > 0 && (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 10, color: colors.muted, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>Quick Measurements</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {measurements.filter((m) => !m.conditionId).map((m) => (
                    <div key={m.id} style={{ background: colors.contentBg, borderRadius: 6, padding: "8px 12px", border: "1px solid " + colors.primary + "33", display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 11, color: colors.muted, fontWeight: 700 }}>{m.label}</span>
                      {m.tool === "linear" || m.tool === "polyline" ? (
                        <span style={{ fontSize: 16, fontWeight: 800, color: colors.primary, fontFamily: fonts.mono }}>{m.feet.toFixed(1)}'</span>
                      ) : m.tool === "area" ? (
                        <span style={{ fontSize: 16, fontWeight: 800, color: colors.primary, fontFamily: fonts.mono }}>{Math.round(m.sqft)} SF</span>
                      ) : (
                        <span style={{ fontSize: 16, fontWeight: 800, color: colors.primary, fontFamily: fonts.mono }}>#{m.count}</span>
                      )}
                      <span style={{ fontSize: 10, color: colors.dim }}>pg {m.page + 1}</span>
                      {/* Assign to condition */}
                      {conditions.length > 0 && (
                        <select
                          value={m.conditionId || ""}
                          onChange={(e) => {
                            const cid = e.target.value || null;
                            setMeasurements((prev) => prev.map((x) => x.id === m.id ? { ...x, conditionId: cid } : x));
                          }}
                          style={{ fontSize: 10, padding: "2px 4px", borderRadius: 4, border: "1px solid " + colors.borderLight, background: colors.contentBg, color: colors.muted, cursor: "pointer" }}>
                          <option value="">Assign...</option>
                          {conditions.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                      )}
                      <button onClick={() => setMeasurements((prev) => prev.filter((x) => x.id !== m.id))} style={{ background: "none", border: "none", color: colors.rose, cursor: "pointer", fontSize: 14 }}>x</button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Section>

          <Section title={"Extracted Dimensions (" + dimensions.length + ")"} color={colors.primary}>
            <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap", alignItems: "center" }}>
              <Button onClick={() => setSelectedIndices(new Set(dimensions.map((_, i) => i)))} outline>Select All</Button>
              <Button onClick={() => setSelectedIndices(new Set())} color={colors.muted} outline>Clear</Button>
              <span style={{ fontSize: 11, color: colors.green, fontWeight: 700 }}>{selectedIndices.size} selected</span>
              <div style={{ flex: 1 }} />
              <SelectInput value={sendTarget} onChange={setSendTarget} options={[{ value: "walls", label: "-> Walls" }, { value: "floors", label: "-> Floors" }, { value: "roof", label: "-> Roof" }]} />
              <Button onClick={sendSelectedToTakeoff} color={colors.green} disabled={selectedIndices.size === 0 && measurements.filter((m) => !m.conditionId).length === 0}>
                Send {selectedIndices.size + measurements.filter((m) => !m.conditionId && (m.tool === "linear" || m.tool === "polyline")).length} to Takeoff
              </Button>
            </div>
            <div style={{ maxHeight: 280, overflowY: "auto", border: "1px solid " + colors.borderLight, borderRadius: 8 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }} role="grid">
                <thead>
                  <tr>
                    {["", "Pg", "Raw", "Feet", "Type"].map((h) => (
                      <th key={h} style={{ padding: "7px 8px", background: colors.contentAlt, color: colors.muted, textAlign: "center", fontSize: 10, fontWeight: 700, position: "sticky", top: 0, zIndex: 1, borderBottom: "2px solid " + colors.borderLight }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {dimensions.map((dim, i) => (
                    <tr key={i} onClick={() => toggleDimension(i)} role="row" aria-selected={selectedIndices.has(i)}
                      style={{ cursor: "pointer", borderBottom: "1px solid " + colors.borderLight, background: selectedIndices.has(i) ? colors.primary + "12" : i % 2 === 0 ? colors.contentBg : colors.contentAlt }}>
                      <td style={{ padding: "5px 8px", textAlign: "center" }}>
                        <div role="checkbox" aria-checked={selectedIndices.has(i)} style={{ width: 16, height: 16, borderRadius: 3, border: "2px solid " + (selectedIndices.has(i) ? colors.primary : colors.borderMid), background: selectedIndices.has(i) ? colors.primary : "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          {selectedIndices.has(i) && <span style={{ color: "#fff", fontSize: 11, fontWeight: 900 }}>v</span>}
                        </div>
                      </td>
                      <td style={{ padding: "5px 8px", textAlign: "center", color: colors.muted, fontFamily: fonts.mono, fontSize: 11 }}>{dim.page}</td>
                      <td style={{ padding: "5px 8px", color: colors.textDark, fontWeight: 700, fontFamily: fonts.mono }}>{dim.raw}</td>
                      <td style={{ padding: "5px 8px", textAlign: "center", color: colors.primary, fontWeight: 800, fontFamily: fonts.mono, fontSize: 14 }}>{dim.feet.toFixed(2)}'</td>
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
          <div style={{ fontSize: 48, marginBottom: 12 }} aria-hidden="true">{"\uD83D\uDCD0"}</div>
          <div style={{ fontSize: 18, color: colors.textDark, fontWeight: 700, marginBottom: 8 }}>Upload Construction Plans</div>
          <div style={{ fontSize: 13, color: colors.muted, maxWidth: 520, margin: "0 auto", lineHeight: 1.7 }}>
            Upload a PDF blueprint. The scanner extracts dimensions, framing references, and room labels.
            Use the on-plan tools to set scale, trace walls, measure areas, and count openings.
            Create takeoff conditions to auto-map measurements to calculators.
          </div>
        </div>
      )}
    </div>
  );
}
