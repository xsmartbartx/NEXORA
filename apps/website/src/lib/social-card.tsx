import { ImageResponse } from "next/og";

export const socialCardSize = { width: 1200, height: 630 };

// The dark theme tokens from packages/ui/src/tokens.css (zinc-950, zinc-100,
// zinc-400, indigo-600), as hex: ImageResponse cannot read CSS variables.
const background = "#09090b";
const foreground = "#f4f4f5";
const muted = "#a1a1aa";
const primary = "#4f46e5";

export function renderSocialCard() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: 80,
        background,
        color: foreground,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
        <svg width="88" height="88" viewBox="0 0 32 32" fill="none">
          <rect width="32" height="32" rx="8" fill={primary} />
          <path d="M9 22V10h2.4l9.2 8.4V10H23v12h-2.4l-9.2-8.4V22H9Z" fill="#ffffff" />
        </svg>
        <div style={{ fontSize: 56, fontWeight: 700, letterSpacing: -1 }}>NEXORA</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <div style={{ fontSize: 68, fontWeight: 700, lineHeight: 1.1 }}>
          Production software infrastructure for modern AI-powered applications.
        </div>
        <div style={{ fontSize: 34, color: muted }}>
          One account, one console, one API. onenexora.com
        </div>
      </div>
    </div>,
    { ...socialCardSize },
  );
}
