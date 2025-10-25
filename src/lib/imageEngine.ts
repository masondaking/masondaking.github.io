import { StoryMetadata } from "../context/WorkspaceContext";

export interface CoverStyle {
  id: string;
  label: string;
  background: string;
  accentA: string;
  accentB: string;
  overlay?: string;
}

export const COVER_STYLES: CoverStyle[] = [
  {
    id: "neon-noir",
    label: "Neon Noir",
    background: "#080820",
    accentA: "rgba(124,77,255,0.85)",
    accentB: "rgba(244,143,177,0.85)",
    overlay: "rgba(10,10,30,0.72)",
  },
  {
    id: "sunrise-parchment",
    label: "Sunrise Parchment",
    background: "#1a130a",
    accentA: "rgba(245,210,140,0.9)",
    accentB: "rgba(255,120,92,0.85)",
    overlay: "rgba(28,20,10,0.78)",
  },
  {
    id: "cosmic-aether",
    label: "Cosmic Aether",
    background: "#050b1d",
    accentA: "rgba(94,211,255,0.85)",
    accentB: "rgba(167,139,255,0.8)",
    overlay: "rgba(6,12,30,0.78)",
  },
];

function escapeXml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function encodeSvg(svg: string) {
  return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
}

export function generateCoverDataUrl(meta: StoryMetadata, style: CoverStyle = COVER_STYLES[0]): string {
  const title = escapeXml(meta.title || "Untitled");
  const subtitle = escapeXml(`${meta.genre} • ${meta.tone}`);

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
  <svg xmlns='http://www.w3.org/2000/svg' width='1200' height='630' viewBox='0 0 1200 630'>
    <defs>
      <linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>
        <stop offset='0%' stop-color='${style.accentA}'/>
        <stop offset='100%' stop-color='${style.accentB}'/>
      </linearGradient>
      <filter id='blur'>
        <feGaussianBlur stdDeviation='70'/>
      </filter>
    </defs>
    <rect width='1200' height='630' fill='${style.background}'/>
    <g opacity='0.6' filter='url(#blur)'>
      <circle cx='240' cy='160' r='240' fill='url(#g)'/>
      <circle cx='960' cy='500' r='280' fill='url(#g)'/>
    </g>
    <rect x='40' y='40' width='1120' height='550' rx='28' fill='${style.overlay ?? "rgba(8,8,20,0.72)"}' stroke='rgba(255,255,255,0.12)'/>
    <text x='80' y='280' font-family='Inter, system-ui, -apple-system, "Segoe UI"' font-size='64' fill='white' font-weight='700'>${title}</text>
    <text x='80' y='340' font-family='Inter, system-ui, -apple-system, "Segoe UI"' font-size='24' fill='rgba(230,232,255,0.92)' font-weight='500'>${subtitle}</text>
  </svg>`;

  return encodeSvg(svg);
}
