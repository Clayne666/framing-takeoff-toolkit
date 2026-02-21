import { colors, fonts } from "../theme";

const labelStyle = {
  fontSize: 11,
  color: colors.textDarkSecondary,
  fontWeight: 600,
  letterSpacing: "0.03em",
  marginBottom: 4,
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
          aria-label={typeof label === "string" ? label : "Number input"}
          style={{
            width: "100%",
            background: colors.inputBgLight,
            border: `1px solid ${colors.inputBorderLight}`,
            borderRadius: 4,
            padding: "7px 10px",
            color: colors.textDark,
            fontSize: 14,
            fontWeight: 600,
            fontFamily: fonts.mono,
            outline: "none",
            transition: "border-color 0.15s",
          }}
          onFocus={(e) => { e.target.style.borderColor = colors.primary; }}
          onBlur={(e) => { e.target.style.borderColor = colors.inputBorderLight; }}
        />
        {unit && (
          <span style={{ fontSize: 11, color: colors.muted, fontWeight: 600, whiteSpace: "nowrap" }}>
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
        aria-label={typeof label === "string" ? label : "Select option"}
        style={{
          width: "100%",
          background: colors.inputBgLight,
          border: `1px solid ${colors.inputBorderLight}`,
          borderRadius: 4,
          padding: "7px 10px",
          color: colors.textDark,
          fontSize: 13,
          fontWeight: 600,
          fontFamily: fonts.mono,
          outline: "none",
          cursor: "pointer",
          transition: "border-color 0.15s",
        }}
        onFocus={(e) => { e.target.style.borderColor = colors.primary; }}
        onBlur={(e) => { e.target.style.borderColor = colors.inputBorderLight; }}
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

export function ResultCard({ label, value, unit, color = colors.primary, large }) {
  return (
    <div
      style={{
        background: colors.contentBg,
        borderRadius: 6,
        padding: large ? "12px 14px" : "10px 12px",
        border: `1px solid ${colors.borderLight}`,
        borderLeft: `3px solid ${color}`,
        flex: "1 1 130px",
        minWidth: 100,
      }}
    >
      <div
        style={{
          fontSize: 10,
          color: colors.muted,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          fontWeight: 600,
        }}
      >
        {label}
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginTop: 3 }}>
        <span
          style={{
            fontSize: large ? 24 : 18,
            fontWeight: 700,
            color,
            fontFamily: fonts.mono,
          }}
        >
          {formatResultValue(value)}
        </span>
        {unit && (
          <span style={{ fontSize: 11, color: colors.muted, fontWeight: 500 }}>{unit}</span>
        )}
      </div>
    </div>
  );
}

export function Section({ title, children, color = colors.primary }) {
  return (
    <section
      style={{
        marginBottom: 18,
        background: colors.contentBg,
        borderRadius: 6,
        border: `1px solid ${colors.borderLight}`,
        overflow: "hidden",
      }}
      aria-label={typeof title === "string" ? title : "Section"}
    >
      <div
        style={{
          padding: "10px 14px",
          background: colors.contentAlt,
          borderBottom: `1px solid ${colors.borderLight}`,
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <div
          style={{
            width: 3,
            height: 16,
            borderRadius: 2,
            background: color,
            flexShrink: 0,
          }}
        />
        <h2
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: colors.textDark,
            letterSpacing: "0.03em",
            textTransform: "uppercase",
            margin: 0,
          }}
        >
          {title}
        </h2>
      </div>
      <div style={{ padding: "12px 14px" }}>
        {children}
      </div>
    </section>
  );
}

export function Row({ children }) {
  return <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>{children}</div>;
}

export function LearnedBadge({ meta, settingKey }) {
  if (!meta || !meta[settingKey]) return null;
  const m = meta[settingKey];
  if (m.source === "default") return null;

  const isAuto = m.source === "auto" || m.source === "silent";
  const isSuggest = m.source === "suggest";
  const badgeColor = isAuto ? colors.success : isSuggest ? colors.warning : colors.purple;
  const label = isAuto ? "LEARNED" : isSuggest ? "SUGGESTED" : "TEMPLATE";

  return (
    <span
      title={`${label}: confidence ${Math.round((m.confidence || 0) * 100)}% (${m.observationCount || 0} observations)`}
      style={{
        fontSize: 8, fontWeight: 700, padding: "1px 5px", borderRadius: 3,
        background: badgeColor + "15", color: badgeColor, letterSpacing: "0.06em",
        marginLeft: 4, verticalAlign: "middle", cursor: "help",
        border: `1px solid ${badgeColor}30`,
      }}
    >
      {label}
    </span>
  );
}

export function Button({ children, onClick, color = colors.primary, outline, disabled, size = "md" }) {
  const pad = size === "sm" ? "5px 10px" : size === "lg" ? "10px 20px" : "7px 14px";
  const fs = size === "sm" ? 11 : size === "lg" ? 14 : 12;
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: pad,
        borderRadius: 4,
        cursor: disabled ? "not-allowed" : "pointer",
        background: outline ? "transparent" : disabled ? colors.borderMid : color,
        border: outline ? `1px solid ${color}` : "none",
        color: outline ? color : "#ffffff",
        fontWeight: 600,
        fontSize: fs,
        opacity: disabled ? 0.5 : 1,
        transition: "all 0.15s",
        letterSpacing: "0.02em",
      }}
    >
      {children}
    </button>
  );
}
