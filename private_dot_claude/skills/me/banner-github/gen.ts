// Banner github profil (hero) — la fiche d'un profil, d'après les fiches de disarto.co
// (_banner-kit/card.ts) : en-tête (handle), carte (nom, titre en Fenix, boutons ; le portrait
// dessiné en vignette et la fiche — statut, lieu, site, handle ; la stack), pied (site, bouton),
// sur le champ de pixels.
import { readFileSync } from "node:fs";
import { readArgs, emit, type Theme } from "../_banner-kit/kit.ts";
import { page, tone, thumb, facts, section, tag, ok, person, button } from "../_banner-kit/card.ts";

const { cfg, out } = readArgs();
const W = cfg.width ?? 1600;
const H = cfg.height ?? 940;
const portraitPath = cfg.avatar ?? `${import.meta.dir}/../_banner-kit/assets/portrait.png`;
const portrait = `data:${/\.png$/i.test(portraitPath) ? "image/png" : "image/jpeg"};base64,${readFileSync(portraitPath).toString("base64")}`;

function body(t: Theme): string {
  const c = tone(t);
  const card = `
    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:32px;">
      <div style="min-width:0;">
        <h1 style="font-family:'Inter',system-ui,sans-serif;font-size:${cfg.nameSize ?? 68}px;font-weight:500;letter-spacing:-0.03em;line-height:1;color:${c.text};white-space:nowrap;">${cfg.name ?? ""}</h1>
        <p style="margin-top:16px;font-family:'Fenix',serif;font-size:32px;line-height:1.2;color:${c.accent};">${cfg.subtitle ?? ""}</p>
      </div>
      <div style="flex-shrink:0;display:flex;gap:12px;padding-top:6px;">
        ${cfg.footerLeft ? button(t, cfg.footerLeft, "globe") : ""}${button(t, cfg.cta ?? "Contact", "visit", true)}
      </div>
    </div>
    <div style="margin-top:34px;display:flex;align-items:center;gap:40px;">
      ${thumb(t, `<img src="${portrait}" style="width:300px;height:300px;margin-bottom:-36px;" />`, 440, 280)}
      ${facts(t, [
        cfg.badge && { icon: "status", label: "Status", value: ok(t, cfg.badge) },
        cfg.footerRight && { icon: "pin", label: "Location", value: cfg.footerRight },
        cfg.footerLeft && { icon: "link", label: "Site", value: cfg.footerLeft },
        cfg.handle && { icon: "user", label: "GitHub", value: person(t, cfg.handle) },
      ].filter(Boolean) as { icon: string; label: string; value: string }[])}
    </div>
    ${(cfg.chips ?? []).length ? section(t, cfg.chipsLabel ?? "Stack", `<div style="display:flex;flex-wrap:wrap;gap:10px;">${cfg.chips.map((x: string) => tag(t, x)).join("")}</div>`) : ""}`;

  return page(t, {
    title: cfg.handle ? `@${cfg.handle}` : (cfg.name ?? ""),
    card,
    footerStatus: cfg.footerLeft ? `${cfg.footerLeft}${cfg.footerRight ? ` · ${cfg.footerRight}` : ""}` : undefined,
    footerAction: button(t, cfg.footerAction ?? "Portfolio"),
  });
}

emit(out, W, H, body);
console.log(`github → ${out}/dark.html + light.html (${W}x${H})`);
