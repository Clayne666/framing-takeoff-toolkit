// ── STACK-inspired professional construction takeoff theme ──────────
// Dark chrome (nav, sidebar), light content areas for readability,
// blue primary accent like STACK, clean/professional typography.

export const colors = {
  // ── Chrome / shell ──────────────────────────────────────────────
  navBg: "#1a1f2e",
  navBorder: "#2a3042",
  sidebarBg: "#1e2433",
  toolbarBg: "#232938",

  // ── Content areas ───────────────────────────────────────────────
  background: "#0f1218",
  surface: "#161b26",
  card: "#1c2232",
  raised: "#232a3a",
  contentBg: "#ffffff",      // plan viewer / light panels
  contentAlt: "#f7f8fa",     // alternating rows in light mode

  // ── Primary accent (STACK blue) ─────────────────────────────────
  primary: "#2563eb",
  primaryDim: "#1d4ed8",
  primaryLight: "#3b82f6",
  primaryGlow: "#60a5fa",

  // ── Semantic colors ─────────────────────────────────────────────
  accent: "#f59e0b",         // amber — warnings, highlights
  accentDim: "#d97706",
  accentGlow: "#fbbf24",
  blue: "#3b82f6",
  teal: "#0d9488",
  green: "#16a34a",
  greenLight: "#22c55e",
  rose: "#e11d48",
  purple: "#7c3aed",
  orange: "#ea580c",
  cyan: "#0891b2",

  // ── Text hierarchy ──────────────────────────────────────────────
  text: "#e2e8f0",           // primary text on dark
  textSecondary: "#94a3b8",  // secondary
  muted: "#64748b",          // labels, placeholders
  dim: "#475569",            // disabled, hints
  textDark: "#1e293b",       // text on light backgrounds
  textDarkSecondary: "#475569",

  // ── Borders ─────────────────────────────────────────────────────
  border: "#1e293b",
  borderLight: "#e2e8f0",    // borders on light backgrounds
  borderMid: "#cbd5e1",

  // ── Inputs ──────────────────────────────────────────────────────
  inputBg: "#0f1729",
  inputBorder: "#2d3a50",
  inputBgLight: "#ffffff",
  inputBorderLight: "#cbd5e1",

  // ── Status ──────────────────────────────────────────────────────
  success: "#16a34a",
  warning: "#d97706",
  danger: "#dc2626",
  info: "#2563eb",
};

export const fonts = {
  mono: "'JetBrains Mono', 'Fira Code', monospace",
  sans: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
};

// ── Shared table styles (dark tables for calculators) ───────────────
export const tableInputStyle = {
  background: colors.inputBg,
  border: `1px solid ${colors.inputBorder}`,
  borderRadius: 4,
  padding: "6px 8px",
  color: colors.primaryGlow,
  fontSize: 12,
  fontFamily: fonts.mono,
  outline: "none",
  transition: "border-color 0.15s",
};

export const tableHeaderStyle = {
  padding: "8px 6px",
  background: colors.raised,
  color: colors.textSecondary,
  textAlign: "center",
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: "0.05em",
  textTransform: "uppercase",
  borderBottom: `2px solid ${colors.primary}22`,
  whiteSpace: "nowrap",
};

export const addButtonStyle = {
  marginTop: 8,
  background: "transparent",
  border: `1px dashed ${colors.dim}`,
  borderRadius: 6,
  padding: "8px 18px",
  color: colors.textSecondary,
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
  transition: "all 0.15s",
};

export const deleteButtonStyle = {
  background: "none",
  border: "none",
  color: colors.rose,
  cursor: "pointer",
  fontSize: 14,
  fontWeight: 700,
  opacity: 0.6,
  transition: "opacity 0.15s",
};
