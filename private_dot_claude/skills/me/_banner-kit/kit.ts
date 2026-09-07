// Kit partagé pour les 3 skills banner (github / repo / slim).
// Design system "Claude Dark" du portfolio kbrdn.dev : fond neutre quasi-noir,
// accent orange chaud, coins nets, mono Monaspace Krypton + serif Fenix,
// zones rayées en diagonale, triangles d'angle. Rendu dark + light.
import { readFileSync, writeFileSync } from "node:fs";

const FONT_DIR = `${import.meta.dir}/assets/fonts`;
const b64 = (p: string) => readFileSync(p).toString("base64");

export const FONT_FACES = `
@font-face{font-family:'Krypton';src:url(data:font/woff2;base64,${b64(`${FONT_DIR}/MonaspaceKrypton.woff2`)}) format('woff2');font-weight:400;}
@font-face{font-family:'Fenix';src:url(data:font/ttf;base64,${b64(`${FONT_DIR}/Fenix-Regular.ttf`)}) format('truetype');font-weight:400;}`;

export type Theme = {
  bg: string; stripe: string; line: string; corner: string;
  fg: string; sub: string; muted: string; dim: string; divider: string; trunk: string;
  chipBg: string; chipText: string; chipBorder: string;
  boxBg: string; boxBorder: string;
  badgeText: string; badgeBorder: string; badgeBg: string;
  avatarStripe: string; avatarBorder: string;
};

export const THEMES: Record<"dark" | "light", Theme> = {
  dark: {
    bg: "#1a1a1a", stripe: "#333", line: "#2a2a2a", corner: "#3a3a3a",
    fg: "#e0e0e0", sub: "#d4825d", muted: "#b0b0b0", dim: "#777", divider: "#3a3a3a", trunk: "#3a3a3a",
    chipBg: "#242424", chipText: "#b0b0b0", chipBorder: "#3a3a3a",
    boxBg: "#121212", boxBorder: "#3a3a3a",
    badgeText: "#e8a573", badgeBorder: "rgba(232,165,115,0.4)", badgeBg: "rgba(212,130,93,0.15)",
    avatarStripe: "#2a2a2a", avatarBorder: "#3a3a3a",
  },
  light: {
    bg: "#f5f5f5", stripe: "#dddddd", line: "#d0d0d0", corner: "#b0b0b0",
    fg: "#1a1a1a", sub: "#c15f3c", muted: "#555555", dim: "#999999", divider: "#c8c8c8", trunk: "#c8c8c8",
    chipBg: "#e8e8e8", chipText: "#555555", chipBorder: "#c8c8c8",
    boxBg: "#eaeaea", boxBorder: "#c8c8c8",
    badgeText: "#c15f3c", badgeBorder: "rgba(193,95,60,0.4)", badgeBg: "rgba(212,130,93,0.12)",
    avatarStripe: "#dddddd", avatarBorder: "#c8c8c8",
  },
};

// Cadre "Claude Dark" : zones rayées latérales + lignes verticales + (option) lignes
// horizontales en retrait + triangles d'angle. hlineInset>0 => cadre intérieur avec
// hlines + coins à ce retrait ; hlineInset=0 => coins aux bords, pas de hlines (slim).
export function frame(t: Theme, opts: { pad?: number; hlineInset?: number } = {}): string {
  const pad = opts.pad ?? 90;
  const hi = opts.hlineInset ?? 60;
  const tri = (pos: string, bw: string, col: string) =>
    `<span style="position:absolute;${pos};width:0;height:0;border-style:solid;border-width:${bw};border-color:${col};"></span>`;
  const yTop = hi > 0 ? `${hi}px` : "0";
  const yBot = hi > 0 ? `${hi}px` : "0";
  const corners = [
    tri(`top:${yTop};left:${pad}px`, "9px 9px 0 0", `${t.corner} transparent transparent transparent`),
    tri(`top:${yTop};right:${pad}px`, "9px 0 0 9px", `${t.corner} transparent transparent transparent`),
    tri(`bottom:${yBot};left:${pad}px`, "0 9px 9px 0", `transparent transparent ${t.corner} transparent`),
    tri(`bottom:${yBot};right:${pad}px`, "0 0 9px 9px", `transparent transparent ${t.corner} transparent`),
  ].join("");
  const hlines = hi > 0
    ? `<div style="position:absolute;height:1px;left:${pad}px;right:${pad}px;top:${hi}px;background:${t.line};"></div>
       <div style="position:absolute;height:1px;left:${pad}px;right:${pad}px;bottom:${hi}px;background:${t.line};"></div>`
    : "";
  const zone = (side: string) =>
    `<div style="position:absolute;top:0;bottom:0;${side}:0;width:${pad}px;background-image:repeating-linear-gradient(-45deg,transparent,transparent 10px,${t.stripe} 10px,${t.stripe} 10.6px);opacity:0.55;"></div>`;
  return `
    ${zone("left")}${zone("right")}
    <div style="position:absolute;top:0;bottom:0;left:${pad}px;width:1px;background:${t.line};"></div>
    <div style="position:absolute;top:0;bottom:0;right:${pad}px;width:1px;background:${t.line};"></div>
    ${hlines}${corners}`;
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

// petit helper chip mono (réutilisé par les 3 layouts)
export function chip(t: Theme, label: string): string {
  return `<span style="font-family:'Krypton',monospace;font-size:14px;letter-spacing:0.05em;text-transform:uppercase;color:${t.chipText};background:${t.chipBg};border:1px solid ${t.chipBorder};padding:6px 12px;">${label}</span>`;
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
