// ── IndexedDB Storage Layer for Project Management ────────────────
const DB_NAME = "FramingTakeoffDB";
const DB_VERSION = 1;
let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains("projects")) {
        const ps = db.createObjectStore("projects", { keyPath: "id" });
        ps.createIndex("name", "name", { unique: false });
        ps.createIndex("updatedAt", "updatedAt", { unique: false });
      }
      if (!db.objectStoreNames.contains("planFiles")) {
        const pf = db.createObjectStore("planFiles", { keyPath: ["projectId", "fileName"] });
        pf.createIndex("projectId", "projectId", { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function genId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

// ── Default project template ──────────────────────────────────────
export function createDefaultProjectData(metadata = {}) {
  const now = new Date().toISOString();
  return {
    id: genId(),
    name: metadata.name || "Untitled Project",
    address: metadata.address || "",
    client: metadata.client || "",
    architect: metadata.architect || "",
    notes: metadata.notes || "",
    status: "active",
    createdAt: now,
    updatedAt: now,
    planFileName: null,
    planFileThumbnail: null,
    extractionResult: null,
    wallState: {
      settings: { studSpacing: 16, studSize: "2x4", studWaste: 10, sheathingWaste: 8 },
      walls: [],
    },
    floorState: {
      settings: { joistSpacing: 16, joistSize: "2x10", wastePercent: 10 },
      areas: [],
    },
    roofState: {
      settings: { rafterSpacing: 24, rafterSize: "2x8", pitch: "6/12", wastePercent: 10, sheathingWaste: 8 },
      sections: [],
    },
    bidState: {
      markupPercent: 15,
      totalSquareFeet: 2500,
      extras: [
        { id: 1, name: "Blocking", cost: 0 },
        { id: 2, name: "Headers", cost: 0 },
        { id: 3, name: "Hardware / Connections", cost: 0 },
        { id: 4, name: "Steel Members", cost: 0 },
        { id: 5, name: "Misc", cost: 0 },
      ],
    },
  };
}

// ── Project CRUD ──────────────────────────────────────────────────

export async function createProject(metadata) {
  const db = await openDB();
  const project = createDefaultProjectData(metadata);
  return new Promise((resolve, reject) => {
    const tx = db.transaction("projects", "readwrite");
    tx.objectStore("projects").add(project);
    tx.oncomplete = () => resolve(project);
    tx.onerror = () => reject(tx.error);
  });
}

export async function getProject(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("projects", "readonly");
    const req = tx.objectStore("projects").get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

export async function updateProject(id, partial) {
  const db = await openDB();
  const existing = await getProject(id);
  if (!existing) throw new Error("Project not found: " + id);
  const updated = { ...existing, ...partial, updatedAt: new Date().toISOString() };
  return new Promise((resolve, reject) => {
    const tx = db.transaction("projects", "readwrite");
    tx.objectStore("projects").put(updated);
    tx.oncomplete = () => resolve(updated);
    tx.onerror = () => reject(tx.error);
  });
}

export async function deleteProject(id) {
  const db = await openDB();
  // Delete plan files first
  const files = await listPlanFiles(id);
  if (files.length > 0) {
    await new Promise((resolve, reject) => {
      const tx = db.transaction("planFiles", "readwrite");
      const store = tx.objectStore("planFiles");
      files.forEach((f) => store.delete([id, f.fileName]));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
  // Delete project record
  return new Promise((resolve, reject) => {
    const tx = db.transaction("projects", "readwrite");
    tx.objectStore("projects").delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function listProjects() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("projects", "readonly");
    const req = tx.objectStore("projects").getAll();
    req.onsuccess = () => {
      const all = req.result || [];
      // Return lightweight summaries sorted by updatedAt desc
      const summaries = all.map((p) => ({
        id: p.id,
        name: p.name,
        address: p.address,
        client: p.client,
        status: p.status,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
        planFileThumbnail: p.planFileThumbnail,
        hasPlan: !!p.planFileName,
      }));
      summaries.sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
      resolve(summaries);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function duplicateProject(sourceId, newName) {
  const source = await getProject(sourceId);
  if (!source) throw new Error("Source project not found: " + sourceId);
  const newProject = { ...JSON.parse(JSON.stringify(source)), id: genId(), name: newName, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };

  const db = await openDB();
  await new Promise((resolve, reject) => {
    const tx = db.transaction("projects", "readwrite");
    tx.objectStore("projects").add(newProject);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });

  // Copy plan files
  const files = await listPlanFiles(sourceId);
  for (const f of files) {
    const data = await getPlanFile(sourceId, f.fileName);
    if (data) await savePlanFile(newProject.id, f.fileName, data);
  }
  return newProject;
}

// ── Plan file operations ──────────────────────────────────────────

export async function savePlanFile(projectId, fileName, data) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("planFiles", "readwrite");
    tx.objectStore("planFiles").put({ projectId, fileName, data, size: data.byteLength });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getPlanFile(projectId, fileName) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("planFiles", "readonly");
    const req = tx.objectStore("planFiles").get([projectId, fileName]);
    req.onsuccess = () => resolve(req.result?.data || null);
    req.onerror = () => reject(req.error);
  });
}

export async function deletePlanFile(projectId, fileName) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("planFiles", "readwrite");
    tx.objectStore("planFiles").delete([projectId, fileName]);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function listPlanFiles(projectId) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("planFiles", "readonly");
    const idx = tx.objectStore("planFiles").index("projectId");
    const req = idx.getAll(projectId);
    req.onsuccess = () => {
      resolve((req.result || []).map((r) => ({ fileName: r.fileName, size: r.size || 0 })));
    };
    req.onerror = () => reject(req.error);
  });
}

// ── Auto-save helper ──────────────────────────────────────────────

export function createAutoSaver(delayMs = 1500) {
  let timer = null;
  let pendingId = null;
  let pendingData = null;
  let onStatusChange = null;

  const flush = async () => {
    if (timer) { clearTimeout(timer); timer = null; }
    if (pendingId && pendingData) {
      const id = pendingId;
      const data = pendingData;
      pendingId = null;
      pendingData = null;
      onStatusChange?.("saving");
      try {
        await updateProject(id, data);
        onStatusChange?.("saved");
      } catch (err) {
        console.error("Auto-save failed:", err);
        onStatusChange?.("error");
      }
    }
  };

  const save = (id, partial) => {
    pendingId = id;
    pendingData = pendingData ? { ...pendingData, ...partial } : partial;
    onStatusChange?.("unsaved");
    if (timer) clearTimeout(timer);
    timer = setTimeout(flush, delayMs);
  };

  const cancel = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    pendingId = null;
    pendingData = null;
  };

  const setStatusCallback = (cb) => { onStatusChange = cb; };

  return { save, flush, cancel, setStatusCallback };
}
