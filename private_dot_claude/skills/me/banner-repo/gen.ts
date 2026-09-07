// Banner repo (promo générique, adaptable) — logo optionnel, wordmark, tagline, features,
// install, + un "motif" à droite : graphe de branches intégré (branchGraph) ou HTML/SVG custom.
import { readFileSync } from "node:fs";
import { readArgs, emit, frame, chip, THEMES, type Theme } from "../_banner-kit/kit.ts";

const { cfg, out } = readArgs();
const W = cfg.width ?? 1600;
const H = cfg.height ?? 600;
const PAD = cfg.pad ?? 90;

// Motif intégré : graphe de branches type gwm. data = [{label,color,fill?}]
function branchGraphSvg(t: Theme, data: Array<{ label: string; color: string; fill?: boolean }>): string {
  const TX = 26, EX = 250, LX = 280, top = 24, bot = 436;
  const n = data.length;
  const step = (bot - top - 40) / Math.max(1, n - 1 || 1);
  const drift = [-20, -8, 0, 12, 4, -12, 8];
  const rows = data.map((b, i) => {
    const src = top + 36 + step * i;
    const ey = src + (drift[i % drift.length] ?? 0);
    return `
      <path d="M ${TX} ${src} C 130 ${src}, 150 ${ey}, ${EX} ${ey}" fill="none" stroke="${b.color}" stroke-width="2.5" opacity="0.9"/>
      <circle cx="${TX}" cy="${src}" r="5" fill="${b.color}"/>
      <circle cx="${EX}" cy="${ey}" r="8.5" fill="${b.fill ? b.color : t.bg}" stroke="${b.color}" stroke-width="2.5"/>
      <text x="${LX}" y="${ey + 8}" font-family="'Krypton',monospace" font-size="25" font-weight="700" fill="${b.color}">${b.label}</text>`;
  }).join("");
  return `<svg width="620" height="460" viewBox="0 0 620 460" xmlns="http://www.w3.org/2000/svg">
    <line x1="${TX}" y1="${top}" x2="${TX}" y2="${bot}" stroke="${t.trunk}" stroke-width="2.5"/>
    <circle cx="${TX}" cy="${top}" r="6" fill="none" stroke="${t.trunk}" stroke-width="2.5"/>
    <circle cx="${TX}" cy="${bot}" r="6" fill="none" stroke="${t.trunk}" stroke-width="2.5"/>
    ${rows}</svg>`;
}

// Logo optionnel, à gauche du wordmark. `logo` accepte un chemin de fichier SVG
// (inliné, donc pas de requête au rendu headless) ou du markup SVG brut. Un repo
// qui livre deux variantes passe `logoLight` pour le thème clair ; sans elle, le
// même fichier sert aux deux, ce qui va tant que le tracé est neutre.
function logoHtml(t: Theme, cfg: Record<string, unknown>): string {
  // `Theme` ne se nomme pas lui-même : on l'identifie par son fond, seul champ
  // dont les deux thèmes garantissent qu'il diffère.
  const isLight = t.bg === THEMES.light.bg;
  const src = (isLight && cfg.logoLight ? cfg.logoLight : cfg.logo) as string | undefined;
  if (!src) return "";
  const markup = src.trimStart().startsWith("<") ? src : readFileSync(src, "utf8");
  const size = (cfg.logoSize as number | undefined) ?? 96;
  // `height` sur le conteneur et non sur le SVG : un viewBox carré se met à
  // l'échelle tout seul, et un SVG sans width/height explicites hériterait sinon
  // de la taille de son parent flex, ce qui le fait disparaître.
  return `<div style="flex-shrink:0;width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;">${markup}</div>`;
}

function body(t: Theme): string {
  const eyebrow = cfg.eyebrow
    ? `<span style="font-size:13px;letter-spacing:0.16em;text-transform:uppercase;color:${t.muted};">${cfg.eyebrow}</span>` : "";
  const version = cfg.version
    ? `<span style="font-size:12px;letter-spacing:0.08em;font-weight:700;color:${t.badgeText};border:1px solid ${t.badgeBorder};background:${t.badgeBg};padding:3px 9px;">${cfg.version}</span>` : "";
  const cursor = cfg.cursor === false ? "" : `<span style="color:${t.sub};">_</span>`;
  const tagline = cfg.tagline
    ? `<p style="font-family:'Fenix',serif;font-size:31px;color:${t.sub};margin-bottom:22px;">${cfg.tagline}</p>` : "";
  const chips = (cfg.chips ?? []).length
    ? `<div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:22px;">${cfg.chips.map((c: string) => chip(t, c)).join("")}</div>` : "";
  const install = cfg.install
    ? `<div style="display:inline-flex;align-items:center;gap:12px;background:${t.boxBg};border:1px solid ${t.boxBorder};padding:14px 20px;width:fit-content;">
         <span style="font-size:19px;font-weight:700;color:${t.sub};">$</span>
         <span style="font-size:19px;font-weight:600;color:${t.fg};">${cfg.install}</span></div>` : "";
  const footer = cfg.footer
    ? `<p style="font-size:13px;letter-spacing:0.04em;color:${t.dim};margin-top:16px;">${cfg.footer}</p>` : "";

  // motif à droite : branchGraph intégré > motif HTML/SVG custom > rien
  const motif = cfg.branchGraph
    ? `<div style="flex-shrink:0;display:flex;align-items:center;">${branchGraphSvg(t, cfg.branchGraph)}</div>`
    : cfg.motif
      ? `<div style="flex-shrink:0;display:flex;align-items:center;">${cfg.motif}</div>`
      : "";

  return `${frame(t, { pad: PAD, hlineInset: 60 })}
    <div style="position:absolute;top:60px;bottom:60px;left:${PAD}px;right:${PAD}px;padding:40px 56px;display:flex;align-items:center;gap:40px;">
      <div style="flex:1;min-width:0;display:flex;flex-direction:column;">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px;">${eyebrow}${version}</div>
        <div style="display:flex;align-items:center;gap:${cfg.logo ? 24 : 0}px;margin-bottom:14px;">
          ${logoHtml(t, cfg)}
          <h1 style="font-size:${cfg.wordmarkSize ?? 120}px;font-weight:700;line-height:0.9;color:${t.fg};letter-spacing:-0.03em;margin:0;">${cfg.wordmark ?? ""}${cursor}</h1>
        </div>
        ${tagline}${chips}${install}${footer}
      </div>
      ${motif}
    </div>`;
}

emit(out, W, H, body);
console.log(`repo → ${out}/dark.html + light.html (${W}x${H}${cfg.branchGraph ? ", branch-graph" : cfg.motif ? ", motif" : ""})`);
