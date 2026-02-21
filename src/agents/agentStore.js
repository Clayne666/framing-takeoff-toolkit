/**
 * Agent Learning IndexedDB — separate from project DB.
 * Stores: observations, preferences, projectProfiles
 */
const DB_NAME = "AgentLearningDB";
const DB_VERSION = 1;
let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains("observations")) {
        const os = db.createObjectStore("observations", { keyPath: "id" });
        os.createIndex("type", "type", { unique: false });
        os.createIndex("projectId", "projectId", { unique: false });
        os.createIndex("timestamp", "timestamp", { unique: false });
      }
      if (!db.objectStoreNames.contains("preferences")) {
        db.createObjectStore("preferences", { keyPath: "key" });
      }
      if (!db.objectStoreNames.contains("projectProfiles")) {
        db.createObjectStore("projectProfiles", { keyPath: "projectId" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

// ── Observations ────────────────────────────────────────────────────

export async function addObservation(obs) {
  const db = await openDB();
  const record = { id: genId(), timestamp: Date.now(), ...obs };
  return new Promise((resolve, reject) => {
    const tx = db.transaction("observations", "readwrite");
    tx.objectStore("observations").add(record);
    tx.oncomplete = () => resolve(record);
    tx.onerror = () => reject(tx.error);
  });
}

export async function getObservations(filter = {}) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("observations", "readonly");
    const store = tx.objectStore("observations");
    let req;
    if (filter.type) {
      req = store.index("type").getAll(filter.type);
    } else if (filter.projectId) {
      req = store.index("projectId").getAll(filter.projectId);
    } else {
      req = store.getAll();
    }
    req.onsuccess = () => {
      let results = req.result || [];
      if (filter.since) results = results.filter((r) => r.timestamp >= filter.since);
      resolve(results);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function getObservationCount() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("observations", "readonly");
    const req = tx.objectStore("observations").count();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// ── Preferences ─────────────────────────────────────────────────────

export async function getPreference(key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("preferences", "readonly");
    const req = tx.objectStore("preferences").get(key);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

export async function setPreference(pref) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("preferences", "readwrite");
    tx.objectStore("preferences").put(pref);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getAllPreferences() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("preferences", "readonly");
    const req = tx.objectStore("preferences").getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

// ── Project Profiles ────────────────────────────────────────────────

export async function saveProjectProfile(profile) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("projectProfiles", "readwrite");
    tx.objectStore("projectProfiles").put(profile);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getProjectProfile(projectId) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("projectProfiles", "readonly");
    const req = tx.objectStore("projectProfiles").get(projectId);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

export async function getAllProjectProfiles() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("projectProfiles", "readonly");
    const req = tx.objectStore("projectProfiles").getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

// ── Reset ───────────────────────────────────────────────────────────

export async function clearAllLearningData() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(["observations", "preferences", "projectProfiles"], "readwrite");
    tx.objectStore("observations").clear();
    tx.objectStore("preferences").clear();
    tx.objectStore("projectProfiles").clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
