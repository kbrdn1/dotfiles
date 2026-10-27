// Banner slim (presque one-line) — promo compacte à embarquer dans un README/profil : le champ
// de pixels et ses lignes de construction verticales, un panneau d'une ligne (logo + wordmark, titre et
// sous-titre, commande et version), d'après les fiches de disarto.co (_banner-kit/card.ts).
import { readFileSync } from "node:fs";
import { readArgs, emit, type Theme } from "../_banner-kit/kit.ts";
import { tone, ok } from "../_banner-kit/card.ts";
import { dither } from "../_banner-kit/kit.ts";

const { cfg, out } = readArgs();
const W = cfg.width ?? 1600;
const H = cfg.height ?? 240;

function logoHtml(t: Theme): string {
  const src = (t.name === "light" && cfg.logoLight ? cfg.logoLight : cfg.logo) as string | undefined;
  if (!src) return "";
  const markup = src.trimStart().startsWith("<") ? src : readFileSync(src, "utf8");
  const size = (cfg.logoSize as number | undefined) ?? 46;
  return `<div style="flex-shrink:0;width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;">${markup}</div>`;
}

function body(t: Theme): string {
  const c = tone(t);
  const dashedV = `background-image:repeating-linear-gradient(to bottom,${c.construct} 0 8px,transparent 8px 14px);`;
  const X = 150, Y = 44;
  return `
    <div style="position:absolute;inset:0;background:${c.page};"></div>
    ${dither(t)}
    <div style="position:absolute;top:0;bottom:0;left:${X}px;width:1px;${dashedV}"></div>
    <div style="position:absolute;top:0;bottom:0;right:${X}px;width:1px;${dashedV}"></div>
    <div style="position:absolute;top:${Y}px;bottom:${Y}px;left:${X}px;right:${X}px;padding:8px;background:${c.panel};border:1px solid ${c.panelBorder};border-radius:26px;box-shadow:${c.shadow};">
      <div style="height:100%;padding:0 26px 0 30px;display:flex;align-items:center;justify-content:space-between;gap:28px;background:${c.card};border:1px solid ${c.cardBorder};border-radius:19px;">
        <div style="min-width:0;display:flex;align-items:center;gap:24px;">
          ${logoHtml(t)}
          <span style="font-family:'Inter',system-ui,sans-serif;font-size:50px;font-weight:500;letter-spacing:-0.03em;line-height:1;color:${c.text};">${cfg.wordmark ?? ""}</span>
          <span style="flex-shrink:0;width:1px;height:46px;background:${c.dash};"></span>
          <div style="min-width:0;display:flex;flex-direction:column;gap:7px;">
            <span style="font-family:'Fenix',serif;font-size:27px;line-height:1;color:${c.accent};white-space:nowrap;">${cfg.title ?? ""}</span>
            <span style="font-family:'Inter',system-ui,sans-serif;font-size:17px;color:${c.muted};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${cfg.subtitle ?? ""}</span>
          </div>
        </div>
        <div style="flex-shrink:0;display:flex;align-items:center;gap:14px;">
          ${cfg.install ? `<span style="font-family:'Krypton',monospace;font-size:18px;letter-spacing:0.04em;color:${c.text};white-space:nowrap;"><span style="color:${c.accent};">$</span> ${cfg.install}</span>` : ""}
          ${cfg.version ? ok(t, cfg.version) : ""}
        </div>
      </div>
    </div>`;
}

emit(out, W, H, body);
console.log(`slim → ${out}/dark.html + light.html (${W}x${H})`);
