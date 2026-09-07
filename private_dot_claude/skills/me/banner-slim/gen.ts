// Banner slim (presque one-line) — promo compacte à embarquer dans un README/profil.
import { readFileSync } from "node:fs";
import { readArgs, emit, frame, THEMES, type Theme } from "../_banner-kit/kit.ts";

const { cfg, out } = readArgs();
const W = cfg.width ?? 1600;
const H = cfg.height ?? 180;
const PAD = cfg.pad ?? 60;

// Logo optionnel, avant le wordmark. `logo` accepte un chemin de SVG (inliné, donc
// aucune requête au rendu headless) ou du markup brut ; `logoLight` sert la variante
// claire quand le repo en livre une. Taille par défaut calée sur la hauteur du
// wordmark slim (52px) pour que la ligne reste une ligne.
function logoHtml(t: Theme, cfg: Record<string, unknown>): string {
  // `Theme` ne se nomme pas lui-même : on l'identifie par son fond, seul champ
  // dont les deux thèmes garantissent qu'il diffère.
  const isLight = t.bg === THEMES.light.bg;
  const src = (isLight && cfg.logoLight ? cfg.logoLight : cfg.logo) as string | undefined;
  if (!src) return "";
  const markup = src.trimStart().startsWith("<") ? src : readFileSync(src, "utf8");
  const size = (cfg.logoSize as number | undefined) ?? 52;
  return `<div style="flex-shrink:0;width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;">${markup}</div>`;
}

function body(t: Theme): string {
  const wordmark = cfg.wordmark ?? "gwm";
  const cursor = cfg.cursor === false ? "" : `<span style="color:${t.sub};">_</span>`;
  const title = cfg.title ?? "";
  const subtitle = cfg.subtitle ?? "";
  const install = cfg.install
    ? `<span style="display:inline-flex;align-items:center;gap:10px;background:${t.boxBg};border:1px solid ${t.boxBorder};padding:11px 16px;">
         <span style="font-size:17px;font-weight:700;color:${t.sub};">$</span>
         <span style="font-size:17px;font-weight:600;color:${t.fg};">${cfg.install}</span>
       </span>` : "";
  const version = cfg.version
    ? `<span style="font-size:13px;letter-spacing:0.08em;font-weight:700;color:${t.badgeText};border:1px solid ${t.badgeBorder};background:${t.badgeBg};padding:6px 10px;">${cfg.version}</span>` : "";

  return `${frame(t, { pad: PAD, hlineInset: 0 })}
    <div style="position:absolute;top:0;bottom:0;left:${PAD}px;right:${PAD}px;padding:0 44px;display:flex;align-items:center;justify-content:space-between;gap:32px;">
      <div style="display:flex;align-items:center;gap:26px;min-width:0;">
        ${logoHtml(t, cfg)}
        <span style="font-size:52px;font-weight:700;letter-spacing:-0.02em;color:${t.fg};line-height:1;">${wordmark}${cursor}</span>
        <span style="width:1px;height:52px;background:${t.divider};"></span>
        <div style="display:flex;flex-direction:column;gap:5px;min-width:0;">
          <span style="font-family:'Fenix',serif;font-size:26px;color:${t.sub};line-height:1;">${title}</span>
          <span style="font-size:14px;letter-spacing:0.03em;color:${t.muted};">${subtitle}</span>
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:14px;flex-shrink:0;">${install}${version}</div>
    </div>`;
}

emit(out, W, H, body);
console.log(`slim → ${out}/dark.html + light.html (${W}x${H})`);
