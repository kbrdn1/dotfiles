// Kit partagé pour les 3 skills banner (github / repo / slim).
// Design system du portfolio kbrdn.dev (refonte #86) : un champ de pixels orange tramé
// (Bayer) sur fond quasi noir, et le contenu dans un panneau arrondi qui tient une carte,
// comme les composants du site. Mono Monaspace Krypton + serif Fenix, pastilles arrondies,
// filets en tirets. Rendu dark + light.
import { readFileSync, writeFileSync } from "node:fs";

const FONT_DIR = `${import.meta.dir}/assets/fonts`;
const b64 = (p: string) => readFileSync(p).toString("base64");

export const FONT_FACES = `
@font-face{font-family:'Krypton';src:url(data:font/woff2;base64,${b64(`${FONT_DIR}/MonaspaceKrypton.woff2`)}) format('woff2');font-weight:400;}
@font-face{font-family:'Fenix';src:url(data:font/ttf;base64,${b64(`${FONT_DIR}/Fenix-Regular.ttf`)}) format('truetype');font-weight:400;}`;

export type Theme = {
  name: "dark" | "light";
  bg: string; fg: string; sub: string; muted: string; dim: string; divider: string; trunk: string;
  // panneau (UiPanel) et sa carte (.panel-card)
  panel: string; panelBorder: string; panelShadow: string; card: string; cardBorder: string;
  // pastilles (chips), boîte terminal, badge
  chipBg: string; chipText: string; chipBorder: string;
  boxBg: string; boxBorder: string;
  badgeText: string; badgeBorder: string; badgeBg: string;
  avatarBorder: string; glow: string;
  // le champ de pixels : couleur et opacités des 4 niveaux de la trame
  dither: [number, number, number]; ditherAlphas: number[];
};

export const THEMES: Record<"dark" | "light", Theme> = {
  dark: {
    name: "dark",
    bg: "#0a0a0a", fg: "#ececec", sub: "#d4825d", muted: "#a3a3a3", dim: "#737373", divider: "#333333", trunk: "#3a3a3a",
    panel: "#0f0f0f", panelBorder: "#262626", panelShadow: "0 24px 48px -24px rgba(0,0,0,0.7)",
    card: "#191919", cardBorder: "#262626",
    chipBg: "transparent", chipText: "#b5b5b5", chipBorder: "rgba(255,255,255,0.14)",
    boxBg: "#141414", boxBorder: "#2a2a2a",
    badgeText: "#e8a573", badgeBorder: "rgba(232,165,115,0.4)", badgeBg: "rgba(212,130,93,0.12)",
    avatarBorder: "#2a2a2a", glow: "rgba(212,130,93,0.3)",
    dither: [0xd4, 0x82, 0x5d], ditherAlphas: [0, 0.06, 0.12, 0.18],
  },
  light: {
    name: "light",
    bg: "#fafafa", fg: "#171717", sub: "#c15f3c", muted: "#525252", dim: "#a3a3a3", divider: "#d4d4d4", trunk: "#c8c8c8",
    panel: "#ffffff", panelBorder: "rgba(229,229,229,0.8)",
    panelShadow: "0 40px 60px rgba(0,0,0,0.06), 0 12px 20px rgba(0,0,0,0.04), 0 3px 4px rgba(0,0,0,0.03)",
    card: "#ffffff", cardBorder: "rgba(229,229,229,0.9)",
    chipBg: "transparent", chipText: "#525252", chipBorder: "#d4d4d4",
    boxBg: "#fafafa", boxBorder: "#e5e5e5",
    badgeText: "#c15f3c", badgeBorder: "rgba(193,95,60,0.4)", badgeBg: "rgba(212,130,93,0.1)",
    avatarBorder: "#e5e5e5", glow: "rgba(212,130,93,0.22)",
    dither: [0xd4, 0x82, 0x5d], ditherAlphas: [0, 0.05, 0.1, 0.15],
  },
};

// Le champ de pixels du site, figé : un bruit lissé à graine fixe (rendu reproductible),
// seuillé par une matrice de Bayer 4x4 en 4 niveaux d'opacité, une cellule = 4 px, plus
// dense en haut et éteint vers le bas (comme le fond des pages). Dessiné par un <canvas>
// au rendu headless, agrandi sans lissage.
function dither(t: Theme): string {
  return `<canvas data-dither style="position:absolute;inset:0;width:100%;height:100%;image-rendering:pixelated;"></canvas>
<script>(() => {
  const c = document.querySelector('canvas[data-dither]');
  const W = c.parentElement.clientWidth, H = c.parentElement.clientHeight, CELL = 4;
  const cols = Math.ceil(W / CELL), rows = Math.ceil(H / CELL);
  c.width = cols; c.height = rows;
  let s = 0x51a7e3c9;
  const rand = () => ((s = (s + 0x6d2b79f5) | 0), (((s ^ (s >>> 15)) * (1 | s)) >>> 0) / 4294967296);
  const grid = (n) => Array.from({ length: (n + 2) * (n + 2) }, rand);
  const smooth = (g, n, x, y) => {
    const fx = x * n, fy = y * n, x0 = Math.floor(fx), y0 = Math.floor(fy), dx = fx - x0, dy = fy - y0;
    const at = (i, j) => g[(j % (n + 1)) * (n + 2) + (i % (n + 1))];
    const a = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * dx, b = at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * dx;
    return a + (b - a) * dy;
  };
  const g1 = grid(18), g2 = grid(46);
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => v / 16);
  const [R, G, B] = ${JSON.stringify(t.dither)}, ALPHAS = ${JSON.stringify(t.ditherAlphas)};
  const ctx = c.getContext('2d'), img = ctx.createImageData(cols, rows);
  for (let y = 0; y < rows; y++) {
    const ty = y / (rows - 1), floor = 0.42 + 0.55 * ty * ty, mask = Math.min(1, Math.max(0, (0.9 - ty) / 0.35));
    for (let x = 0; x < cols; x++) {
      const v = smooth(g1, 18, x / cols, y / rows) * 0.65 + smooth(g2, 46, x / cols, y / rows) * 0.35;
      const u = (v - floor) * 4.2;
      const level = u > 0 ? Math.min(3, (u * 3 + BAYER[((y & 3) << 2) | (x & 3)]) | 0) : 0;
      img.data.set([R, G, B, Math.round(ALPHAS[level] * mask * 255)], (y * cols + x) * 4);
    }
  }
  ctx.putImageData(img, 0, 0);
})()</script>`;
}

// Fond du site + panneau arrondi (UiPanel) + sa carte (.panel-card), aux retraits pad
// (côtés) et hlineInset (haut/bas ; 0 = slim, un petit retrait quand même). Le contenu des
// layouts se pose par-dessus, aux mêmes retraits : il tombe dans la carte.
export function frame(t: Theme, opts: { pad?: number; hlineInset?: number } = {}): string {
  const pad = opts.pad ?? 90;
  const vy = (opts.hlineInset ?? 60) || 14;
  return `
    ${dither(t)}
    <div style="position:absolute;top:${vy - 8}px;bottom:${vy - 8}px;left:${pad - 8}px;right:${pad - 8}px;background:${t.panel};border:1px solid ${t.panelBorder};border-radius:28px;box-shadow:${t.panelShadow};"></div>
    <div style="position:absolute;top:${vy - 2}px;bottom:${vy - 2}px;left:${pad - 2}px;right:${pad - 2}px;background:${t.card};border:1px solid ${t.cardBorder};border-radius:20px;"></div>`;
}

// Monogramme @kbrdn1 (miroir de public/favicon.svg du portfolio) : cadre ouvert en rects
// pleins, masse neutre = fg du thème, chevron = accent. Opt-in via `logo: true` dans le config.
export function logo(t: Theme, size: number): string {
  return `
    <svg width="${size}" height="${size}" viewBox="0 0 32 32" style="flex-shrink:0;">
      <g fill="${t.fg}">
        <rect x="2" y="2" width="28" height="4"/><rect x="2" y="2" width="4" height="28"/>
        <rect x="26" y="2" width="4" height="14"/><rect x="2" y="26" width="14" height="4"/>
      </g>
      <path d="M19 9 L7 16 L19 23 V19 L14 16 L19 13 Z" fill="${t.sub}"/>
    </svg>`;
}

// Pastille mono arrondie, comme les tags du site (réutilisée par les 3 layouts)
export function chip(t: Theme, label: string): string {
  return `<span style="font-family:'Krypton',monospace;font-size:14px;letter-spacing:0.02em;color:${t.chipText};background:${t.chipBg};border:1px solid ${t.chipBorder};border-radius:9999px;padding:6px 14px;">${label}</span>`;
}

// Filet en tirets, comme les séparateurs des cartes du site
export function dashed(t: Theme): string {
  return `<div style="height:1px;background-image:repeating-linear-gradient(90deg,${t.divider} 0 5px,transparent 5px 9px);"></div>`;
}

export function doc({ w, h, t, inner }: { w: number; h: number; t: Theme; inner: string }): string {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
${FONT_FACES}
*{margin:0;padding:0;box-sizing:border-box;}
html,body{width:${w}px;height:${h}px;}
body{background:${t.bg};overflow:hidden;}
.banner{position:relative;width:${w}px;height:${h}px;background:${t.bg};font-family:'Krypton',monospace;}
</style></head><body><div class="banner">${inner}</div></body></html>`;
}

// Écrit dark.html + light.html dans outdir. inner(theme) => contenu (cadre + layout).
export function emit(outdir: string, w: number, h: number, inner: (t: Theme) => string): void {
  writeFileSync(`${outdir}/dark.html`, doc({ w, h, t: THEMES.dark, inner: inner(THEMES.dark) }));
  writeFileSync(`${outdir}/light.html`, doc({ w, h, t: THEMES.light, inner: inner(THEMES.light) }));
}

// Lit argv : [config.json] [outdir]
export function readArgs(): { cfg: any; out: string } {
  const cfgPath = process.argv[2];
  const out = process.argv[3];
  if (!cfgPath || !out) throw new Error("usage: bun gen.ts <config.json> <outdir>");
  return { cfg: JSON.parse(readFileSync(cfgPath, "utf8")), out };
}
