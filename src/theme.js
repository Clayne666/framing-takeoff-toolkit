export const colors = {
  background: "#0a0e17",
  surface: "#111827",
  card: "#1a2234",
  raised: "#1f2b3f",
  accent: "#f59e0b",
  accentDim: "#b47608",
  accentGlow: "#fbbf24",
  blue: "#3b82f6",
  teal: "#14b8a6",
  green: "#22c55e",
  rose: "#f43f5e",
  purple: "#a78bfa",
  orange: "#fb923c",
  cyan: "#06b6d4",
  text: "#e2e8f0",
  muted: "#64748b",
  dim: "#475569",
  border: "#1e293b",
  inputBg: "#0f1729",
  inputBorder: "#2d3a50",
};

export const fonts = {
  mono: "'JetBrains Mono', monospace",
  sans: "'Inter', -apple-system, sans-serif",
};

export const tableInputStyle = {
  background: colors.inputBg,
  border: `1px solid ${colors.inputBorder}`,
  borderRadius: 4,
  padding: "5px 6px",
  color: colors.accentGlow,
  fontSize: 12,
  fontFamily: fonts.mono,
  outline: "none",
};

export const tableHeaderStyle = {
  padding: "7px 5px",
  background: colors.raised,
  color: colors.muted,
  textAlign: "center",
  fontSize: 10,
  fontWeight: 700,
  borderBottom: `1px solid ${colors.border}`,
};

export const addButtonStyle = {
  marginTop: 8,
  background: colors.raised,
  border: `1px dashed ${colors.dim}`,
  borderRadius: 6,
  padding: "7px 16px",
  color: colors.muted,
  fontSize: 12,
  fontWeight: 700,
  cursor: "pointer",
};

export const deleteButtonStyle = {
  background: "none",
  border: "none",
  color: colors.rose,
  cursor: "pointer",
  fontSize: 15,
};
