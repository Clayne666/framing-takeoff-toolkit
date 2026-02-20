import { colors, fonts } from "../theme";

const labelStyle = {
  fontSize: 10,
  color: colors.muted,
  fontWeight: 700,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  marginBottom: 3,
  display: "block",
};

export function NumberInput({ label, value, onChange, unit, min = 0, step = 1 }) {
  return (
    <div style={{ flex: "1 1 130px", minWidth: 100 }}>
      <label style={labelStyle}>{label}</label>
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(+e.target.value)}
          min={min}
          step={step}
          aria-label={label}
          style={{
            width: "100%",
            background: colors.inputBg,
            border: `1px solid ${colors.inputBorder}`,
            borderRadius: 6,
            padding: "8px 10px",
            color: colors.accentGlow,
            fontSize: 16,
            fontWeight: 700,
            fontFamily: fonts.mono,
            outline: "none",
          }}
        />
        {unit && (
          <span style={{ fontSize: 11, color: colors.dim, fontWeight: 700, whiteSpace: "nowrap" }}>
            {unit}
          </span>
        )}
      </div>
    </div>
  );
}

export function SelectInput({ label, value, onChange, options }) {
  return (
    <div style={{ flex: "1 1 130px", minWidth: 100 }}>
      {label && <label style={labelStyle}>{label}</label>}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label || "Select option"}
        style={{
          width: "100%",
          background: colors.inputBg,
          border: `1px solid ${colors.inputBorder}`,
          borderRadius: 6,
          padding: "8px 10px",
          color: colors.accentGlow,
          fontSize: 14,
          fontWeight: 700,
          fontFamily: fonts.mono,
          outline: "none",
        }}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function formatResultValue(value) {
  if (typeof value !== "number") return value;
  return value % 1 === 0
    ? value.toLocaleString()
    : value.toLocaleString(undefined, { maximumFractionDigits: 1 });
}

export function ResultCard({ label, value, unit, color = colors.accent, large }) {
  return (
    <div
      style={{
        background: colors.card,
        borderRadius: 8,
        padding: large ? "14px 16px" : "10px 12px",
        border: `1px solid ${color}22`,
        flex: "1 1 130px",
        minWidth: 100,
      }}
    >
      <div
        style={{
          fontSize: 9,
          color: colors.muted,
          textTransform: "uppercase",
          letterSpacing: "0.1em",
          fontWeight: 700,
        }}
      >
        {label}
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginTop: 2 }}>
        <span
          style={{
            fontSize: large ? 28 : 20,
            fontWeight: 800,
            color,
            fontFamily: fonts.mono,
          }}
        >
          {formatResultValue(value)}
        </span>
        {unit && (
          <span style={{ fontSize: 11, color: colors.dim, fontWeight: 600 }}>{unit}</span>
        )}
      </div>
    </div>
  );
}

export function Section({ title, children, color = colors.accent }) {
  return (
    <section style={{ marginBottom: 20 }} aria-label={title}>
      <h2
        style={{
          fontSize: 11,
          fontWeight: 800,
          color,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          marginBottom: 10,
          paddingBottom: 4,
          borderBottom: `1px solid ${color}33`,
          margin: "0 0 10px 0",
        }}
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

export function Row({ children }) {
  return <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>{children}</div>;
}

export function Button({ children, onClick, color = colors.accent, outline, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: "6px 14px",
        borderRadius: 6,
        cursor: disabled ? "not-allowed" : "pointer",
        background: outline ? "transparent" : disabled ? colors.dim : color,
        border: outline ? `1px solid ${color}` : "none",
        color: outline ? color : colors.background,
        fontWeight: 700,
        fontSize: 11,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {children}
    </button>
  );
}
