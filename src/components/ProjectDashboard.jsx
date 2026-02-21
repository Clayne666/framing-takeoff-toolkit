import { useState, useEffect, useCallback } from "react";
import { colors, fonts } from "../theme";
import { listProjects, createProject, deleteProject, duplicateProject } from "../utils/projectStore";
import { Button } from "./ui";

const STATUS_COLORS = {
  active: colors.green, bid: colors.accent, awarded: colors.blue,
  complete: colors.purple, archived: colors.dim,
};

function relativeDate(isoString) {
  if (!isoString) return "";
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return mins + "m ago";
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return hrs + "h ago";
  const days = Math.floor(hrs / 24);
  if (days < 7) return days + "d ago";
  return new Date(isoString).toLocaleDateString();
}

export default function ProjectDashboard({ onOpenProject }) {
  const [projects, setProjects] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [newProject, setNewProject] = useState({ name: "", address: "", client: "", architect: "" });

  const loadProjects = useCallback(async () => {
    try {
      const list = await listProjects();
      setProjects(list);
    } catch (err) {
      console.error("Failed to load projects:", err);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => { loadProjects(); }, [loadProjects]);

  const handleCreate = async () => {
    if (!newProject.name.trim()) return;
    try {
      const project = await createProject(newProject);
      setShowNewDialog(false);
      setNewProject({ name: "", address: "", client: "", architect: "" });
      onOpenProject(project.id);
    } catch (err) {
      console.error("Failed to create project:", err);
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteProject(id);
      setDeleteConfirmId(null);
      await loadProjects();
    } catch (err) {
      console.error("Failed to delete project:", err);
    }
  };

  const handleDuplicate = async (id, name) => {
    try {
      await duplicateProject(id, name + " (Copy)");
      await loadProjects();
    } catch (err) {
      console.error("Failed to duplicate project:", err);
    }
  };

  const filtered = projects.filter((p) => {
    if (filterStatus !== "all" && p.status !== filterStatus) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (p.name || "").toLowerCase().includes(q) || (p.address || "").toLowerCase().includes(q) || (p.client || "").toLowerCase().includes(q);
    }
    return true;
  });

  const inputStyle = {
    background: colors.inputBg, border: "1px solid " + colors.inputBorder, borderRadius: 6,
    padding: "10px 14px", color: colors.text, fontSize: 14, fontFamily: fonts.sans, outline: "none", width: "100%",
  };

  return (
    <div>
      {/* ── Toolbar ─────────────────────────────── */}
      <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
        <input
          type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search projects..." aria-label="Search projects"
          style={{ ...inputStyle, flex: "1 1 200px", maxWidth: 320 }}
        />
        <select
          value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} aria-label="Filter by status"
          style={{ ...inputStyle, width: "auto", cursor: "pointer" }}
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="bid">Bid</option>
          <option value="awarded">Awarded</option>
          <option value="complete">Complete</option>
          <option value="archived">Archived</option>
        </select>
        <button
          onClick={() => setShowNewDialog(true)}
          style={{
            background: colors.green, color: colors.background, border: "none", borderRadius: 8,
            padding: "10px 24px", fontWeight: 800, fontSize: 14, cursor: "pointer", letterSpacing: "0.03em",
            whiteSpace: "nowrap",
          }}
        >
          + New Project
        </button>
      </div>

      {/* ── Loading / Empty ─────────────────────── */}
      {isLoading && <div style={{ textAlign: "center", padding: 40, color: colors.muted }}>Loading projects...</div>}

      {!isLoading && filtered.length === 0 && (
        <div style={{ textAlign: "center", padding: "60px 20px" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>&#128193;</div>
          <div style={{ fontSize: 18, color: colors.text, fontWeight: 700, marginBottom: 8 }}>
            {projects.length === 0 ? "No Projects Yet" : "No Matching Projects"}
          </div>
          <div style={{ fontSize: 13, color: colors.muted, maxWidth: 400, margin: "0 auto", lineHeight: 1.7 }}>
            {projects.length === 0
              ? "Create your first project to start scanning plans and building takeoffs."
              : "Try adjusting your search or filter."}
          </div>
          {projects.length === 0 && (
            <button
              onClick={() => setShowNewDialog(true)}
              style={{
                marginTop: 20, background: colors.green, color: colors.background, border: "none", borderRadius: 8,
                padding: "12px 28px", fontWeight: 800, fontSize: 15, cursor: "pointer",
              }}
            >
              + Create First Project
            </button>
          )}
        </div>
      )}

      {/* ── Project Grid ────────────────────────── */}
      {!isLoading && filtered.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
          {filtered.map((p) => (
            <div
              key={p.id}
              style={{
                background: colors.surface, borderRadius: 12, border: "1px solid " + colors.border,
                overflow: "hidden", transition: "border-color 0.15s",
                cursor: "pointer",
              }}
              onClick={() => { if (deleteConfirmId !== p.id) onOpenProject(p.id); }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = colors.accent; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = colors.border; }}
            >
              {/* Thumbnail */}
              <div style={{ height: 140, background: colors.card, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                {p.planFileThumbnail ? (
                  <img src={p.planFileThumbnail} alt="Plan preview" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <div style={{ fontSize: 40, color: colors.dim }}>&#128209;</div>
                )}
              </div>

              {/* Info */}
              <div style={{ padding: "12px 16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: colors.text, lineHeight: 1.3 }}>{p.name}</div>
                  <span style={{
                    fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em",
                    padding: "2px 8px", borderRadius: 4,
                    background: (STATUS_COLORS[p.status] || colors.dim) + "20",
                    color: STATUS_COLORS[p.status] || colors.dim,
                  }}>
                    {p.status}
                  </span>
                </div>
                {p.address && <div style={{ fontSize: 12, color: colors.muted, marginBottom: 4 }}>{p.address}</div>}
                {p.client && <div style={{ fontSize: 11, color: colors.dim }}>{p.client}</div>}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10, borderTop: "1px solid " + colors.border, paddingTop: 8 }}>
                  <span style={{ fontSize: 11, color: colors.dim }}>{relativeDate(p.updatedAt)}</span>
                  <div style={{ display: "flex", gap: 4 }} onClick={(e) => e.stopPropagation()}>
                    <button onClick={() => handleDuplicate(p.id, p.name)} title="Duplicate"
                      style={{ background: "none", border: "1px solid " + colors.border, borderRadius: 4, padding: "3px 8px", color: colors.muted, cursor: "pointer", fontSize: 11 }}
                    >Copy</button>
                    {deleteConfirmId === p.id ? (
                      <>
                        <button onClick={() => handleDelete(p.id)}
                          style={{ background: colors.rose, border: "none", borderRadius: 4, padding: "3px 10px", color: "#fff", cursor: "pointer", fontSize: 11, fontWeight: 700 }}
                        >Confirm</button>
                        <button onClick={() => setDeleteConfirmId(null)}
                          style={{ background: "none", border: "1px solid " + colors.border, borderRadius: 4, padding: "3px 8px", color: colors.muted, cursor: "pointer", fontSize: 11 }}
                        >Cancel</button>
                      </>
                    ) : (
                      <button onClick={() => setDeleteConfirmId(p.id)} title="Delete"
                        style={{ background: "none", border: "1px solid " + colors.rose + "40", borderRadius: 4, padding: "3px 8px", color: colors.rose, cursor: "pointer", fontSize: 11 }}
                      >Del</button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── New Project Dialog ──────────────────── */}
      {showNewDialog && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex",
          alignItems: "center", justifyContent: "center", zIndex: 1000,
        }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowNewDialog(false); }}
        >
          <div style={{
            background: colors.surface, borderRadius: 12, padding: "28px 32px", maxWidth: 480, width: "90%",
            border: "1px solid " + colors.border,
          }}>
            <h2 style={{ margin: "0 0 20px", fontSize: 20, fontWeight: 800, color: colors.text }}>New Project</h2>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, color: colors.muted, fontWeight: 600, marginBottom: 4, display: "block" }}>Project Name *</label>
                <input
                  value={newProject.name} onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                  placeholder="e.g. Smith Residence" autoFocus style={inputStyle}
                  onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                />
              </div>
              <div>
                <label style={{ fontSize: 12, color: colors.muted, fontWeight: 600, marginBottom: 4, display: "block" }}>Address</label>
                <input value={newProject.address} onChange={(e) => setNewProject({ ...newProject, address: e.target.value })} placeholder="Job site address" style={inputStyle} />
              </div>
              <div style={{ display: "flex", gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 12, color: colors.muted, fontWeight: 600, marginBottom: 4, display: "block" }}>Client</label>
                  <input value={newProject.client} onChange={(e) => setNewProject({ ...newProject, client: e.target.value })} placeholder="Owner / GC" style={inputStyle} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 12, color: colors.muted, fontWeight: 600, marginBottom: 4, display: "block" }}>Architect</label>
                  <input value={newProject.architect} onChange={(e) => setNewProject({ ...newProject, architect: e.target.value })} placeholder="Architect" style={inputStyle} />
                </div>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 24 }}>
              <Button onClick={() => setShowNewDialog(false)} color={colors.muted} outline>Cancel</Button>
              <button
                onClick={handleCreate}
                disabled={!newProject.name.trim()}
                style={{
                  background: newProject.name.trim() ? colors.green : colors.dim,
                  color: colors.background, border: "none", borderRadius: 8,
                  padding: "10px 24px", fontWeight: 800, fontSize: 14, cursor: newProject.name.trim() ? "pointer" : "not-allowed",
                }}
              >
                Create Project
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
