import { ImageResponse } from "next/og";

export const socialCardSize = { width: 1200, height: 630 };

// The dark theme tokens from packages/ui/src/tokens.css, as hex: ImageResponse
// cannot read CSS variables.
const background = "#070a13";
const foreground = "#eef0f4";
const muted = "#9aa3b2";
const primary = "#6a5cf0";

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
          <path d="M9 22V10h2.4l9.2 8.4V10H23v12h-2.4l-9.2-8.4V22H9Z" fill="#f7f8fa" />
        </svg>
        <div style={{ fontSize: 56, fontWeight: 700, letterSpacing: 6 }}>NEXORA</div>
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
