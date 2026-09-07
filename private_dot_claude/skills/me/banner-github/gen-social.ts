// Bannière social (X / LinkedIn) — même design que le hero github, mais tout centré
// sur l'axe vertical et type scale dérivé de la hauteur (les formats sociaux sont plus plats).
import { readArgs, emit, frame, chip, logo, type Theme } from "../_banner-kit/kit.ts";

const { cfg, out } = readArgs();
const W = cfg.width ?? 1500;
const H = cfg.height ?? 500;
const PAD = cfg.pad ?? 90;
const k = (r: number) => Math.round(H * r);
const HI = cfg.hlineInset ?? k(0.085);
const mono = (size: number, extra = "") =>
  `font-family:'Krypton',monospace;font-size:${size}px;${extra}`;

function body(t: Theme): string {
  const badge = cfg.badge
    ? `<span style="display:inline-flex;align-items:center;gap:9px;padding:7px 15px;${mono(12, `text-transform:uppercase;letter-spacing:0.12em;color:${t.badgeText};`)}border:1px solid ${t.badgeBorder};background:${t.badgeBg};margin-bottom:${k(0.05)}px;">
         <span style="width:8px;height:8px;border-radius:9999px;background:${t.badgeText};"></span>${cfg.badge}</span>`
    : "";
  const chips = (cfg.chips ?? []).map((c: string) => chip(t, c)).join("");
  const footerParts = [
    cfg.footerLeft && `<span style="${mono(15, `font-weight:600;color:${t.muted};`)}">${cfg.footerLeft}</span>`,
    cfg.handle && `<span style="${mono(15, "font-weight:700;")}"><span style="color:${t.fg};">@</span><span style="color:${t.sub};">${cfg.handle}</span></span>`,
    cfg.footerRight && `<span style="${mono(12, `letter-spacing:0.1em;text-transform:uppercase;color:${t.dim};`)}">${cfg.footerRight}</span>`,
  ].filter(Boolean) as string[];
  const footer = footerParts.length
    ? `<div style="display:flex;align-items:center;justify-content:center;gap:16px;margin-top:${k(0.06)}px;">
         ${footerParts.join(`<span style="color:${t.divider};">·</span>`)}</div>`
    : "";

  return `${frame(t, { pad: PAD, hlineInset: HI })}
    <div style="position:absolute;top:${HI}px;bottom:${HI}px;left:${PAD}px;right:${PAD}px;padding:${k(0.07)}px 56px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;">
      ${badge}
      <div style="display:flex;align-items:center;gap:${k(0.036)}px;margin-bottom:${k(0.024)}px;">
        ${cfg.logo ? logo(t, Math.round(k(0.136) * 0.8)) : ""}
        <h1 style="font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;font-size:${k(0.136)}px;font-weight:800;letter-spacing:-0.02em;color:${t.fg};line-height:1;">${cfg.name ?? ""}</h1>
      </div>
      <p style="font-family:'Fenix',serif;font-size:${k(0.072)}px;color:${t.sub};margin-bottom:${k(0.038)}px;">${cfg.subtitle ?? ""}</p>
      <div style="display:flex;flex-wrap:wrap;gap:9px;justify-content:center;">${chips}</div>
      ${footer}
    </div>`;
}

emit(out, W, H, body);
console.log(`social → ${out}/dark.html + light.html (${W}x${H})`);
