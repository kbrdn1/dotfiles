// Banner github profil (hero) — nom, titre, badge de statut, chips stack, avatar optionnel.
import { readFileSync } from "node:fs";
import { readArgs, emit, frame, chip, logo, type Theme } from "../_banner-kit/kit.ts";

const { cfg, out } = readArgs();
const hasAvatar = !!cfg.avatar;
const W = cfg.width ?? 1600;
const H = cfg.height ?? (hasAvatar ? 560 : 460);
const PAD = cfg.pad ?? 90;
const avatarB64 = hasAvatar ? readFileSync(cfg.avatar).toString("base64") : "";
const avatarMime = hasAvatar && /\.png$/i.test(cfg.avatar) ? "image/png" : "image/jpeg";

function body(t: Theme): string {
  const badge = cfg.badge
    ? `<span style="display:inline-flex;align-items:center;gap:9px;padding:7px 15px;font-family:'Krypton',monospace;font-size:12px;text-transform:uppercase;letter-spacing:0.12em;color:${t.badgeText};border:1px solid ${t.badgeBorder};background:${t.badgeBg};">
         <span style="width:8px;height:8px;border-radius:9999px;background:${t.badgeText};"></span>${cfg.badge}</span>`
    : "<span></span>";
  // logoSlot: "name" (lockup avec le nom, décale le h1) | "top" (en tête de la ligne du haut)
  const slot = cfg.logoSlot ?? "name";
  const handle = cfg.handle
    ? `<span style="font-family:'Krypton',monospace;font-size:15px;font-weight:700;"><span style="color:${t.fg};">@</span><span style="color:${t.sub};">${cfg.handle}</span></span>`
    : "";
  const chips = (cfg.chips ?? []).map((c: string) => chip(t, c)).join("");
  const avatar = hasAvatar
    ? `<div style="flex-shrink:0;position:relative;width:210px;height:210px;border:1px solid ${t.avatarBorder};overflow:hidden;">
         <div style="position:absolute;inset:0;background-image:repeating-linear-gradient(-45deg,transparent,transparent 10px,${t.avatarStripe} 10px,${t.avatarStripe} 10.6px);opacity:0.5;"></div>
         <img src="data:${avatarMime};base64,${avatarB64}" style="width:100%;height:100%;object-fit:cover;position:relative;" /></div>`
    : "";
  const middleGap = hasAvatar ? "gap:48px;" : "";

  return `${frame(t, { pad: PAD, hlineInset: 60 })}
    <div style="position:absolute;top:60px;bottom:60px;left:${PAD}px;right:${PAD}px;padding:38px 56px;display:flex;flex-direction:column;justify-content:space-between;">
      <div style="display:flex;align-items:center;justify-content:space-between;">
        <div style="display:flex;align-items:center;gap:18px;">${cfg.logo && slot === "top" ? logo(t, 40) : ""}${badge}</div>${handle}</div>
      <div style="display:flex;align-items:center;justify-content:space-between;${middleGap}flex:1;padding:12px 0;">
        <div style="display:flex;flex-direction:column;justify-content:center;flex:1;min-width:0;">
          <div style="display:flex;align-items:center;gap:22px;margin-bottom:16px;">
            ${cfg.logo && slot === "name" ? logo(t, Math.round((hasAvatar ? 62 : 74) * 0.8)) : ""}
            <h1 style="font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;font-size:${hasAvatar ? 62 : 74}px;font-weight:800;letter-spacing:-0.02em;color:${t.fg};line-height:1;">${cfg.name ?? ""}</h1>
          </div>
          <p style="font-family:'Fenix',serif;font-size:${hasAvatar ? 34 : 40}px;color:${t.sub};margin-bottom:26px;">${cfg.subtitle ?? ""}</p>
          <div style="display:flex;flex-wrap:wrap;gap:9px;">${chips}</div>
        </div>
        ${avatar}
      </div>
      <div style="display:flex;align-items:center;justify-content:space-between;">
        <span style="font-family:'Krypton',monospace;font-size:15px;font-weight:600;color:${t.muted};">${cfg.footerLeft ?? ""}</span>
        <span style="font-family:'Krypton',monospace;font-size:12px;letter-spacing:0.1em;text-transform:uppercase;color:${t.dim};">${cfg.footerRight ?? ""}</span>
      </div>
    </div>`;
}

emit(out, W, H, body);
console.log(`github → ${out}/dark.html + light.html (${W}x${H}${hasAvatar ? ", avatar" : ""})`);
