// Banner repo — la fiche d'un projet, d'après les fiches de disarto.co (_banner-kit/card.ts) :
// en-tête (nom du projet), carte (logo + wordmark, tagline, boutons ; le motif en vignette et la
// fiche du dépôt ; features ; installation), pied (adresse, bouton), sur le champ de pixels.
import { readFileSync } from "node:fs";
import { readArgs, emit, type Theme } from "../_banner-kit/kit.ts";
import { page, tone, thumb, picture, dataUri, facts, section, tag, ok, person, monoLine, button } from "../_banner-kit/card.ts";

const { cfg, out } = readArgs();
const W = cfg.width ?? 1600;
const H = cfg.height ?? 1052;

// Motif intégré : graphe de branches type gwm, sur la vignette sombre. data = [{label,color,fill?}]
function branchGraphSvg(data: Array<{ label: string; color: string; fill?: boolean }>): string {
  const TX = 26, EX = 250, LX = 280, top = 24, bot = 436, trunk = "#3a3a42", bg = "#0f0f12";
  const step = (bot - top - 40) / Math.max(1, data.length - 1 || 1);
  const drift = [-20, -8, 0, 12, 4, -12, 8];
  const rows = data.map((b, i) => {
    const src = top + 36 + step * i;
    const ey = src + (drift[i % drift.length] ?? 0);
    return `
      <path d="M ${TX} ${src} C 130 ${src}, 150 ${ey}, ${EX} ${ey}" fill="none" stroke="${b.color}" stroke-width="2.5" opacity="0.9"/>
      <circle cx="${TX}" cy="${src}" r="5" fill="${b.color}"/>
      <circle cx="${EX}" cy="${ey}" r="8.5" fill="${b.fill ? b.color : bg}" stroke="${b.color}" stroke-width="2.5"/>
      <text x="${LX}" y="${ey + 8}" font-family="'Krypton',monospace" font-size="25" font-weight="700" fill="${b.color}">${b.label}</text>`;
  }).join("");
  return `<svg width="620" height="460" viewBox="0 0 620 460" xmlns="http://www.w3.org/2000/svg">
    <line x1="${TX}" y1="${top}" x2="${TX}" y2="${bot}" stroke="${trunk}" stroke-width="2.5"/>
    <circle cx="${TX}" cy="${top}" r="6" fill="none" stroke="${trunk}" stroke-width="2.5"/>
    <circle cx="${TX}" cy="${bot}" r="6" fill="none" stroke="${trunk}" stroke-width="2.5"/>
    ${rows}</svg>`;
}

// Logo optionnel, à gauche du wordmark : chemin de SVG (inliné) ou markup brut ; `logoLight` pour
// le thème clair quand le repo en livre une variante.
function logoHtml(t: Theme, size: number): string {
  const src = (t.name === "light" && cfg.logoLight ? cfg.logoLight : cfg.logo) as string | undefined;
  if (!src) return "";
  const markup = src.trimStart().startsWith("<") ? src : readFileSync(src, "utf8");
  return `<div style="flex-shrink:0;width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;">${markup}</div>`;
}

// La fiche du dépôt : `facts` du config s'il y en a (`ok: true` pour une pastille verte,
// `person: true` pour la puce avec l'avatar), sinon tirée du footer
// (« github.com/user/repo · Langage · Licence ») et de la version — rien d'inventé. `facts: []`
// retire la fiche.
function repoFacts(t: Theme) {
  if (cfg.facts)
    return (cfg.facts as { icon: string; label: string; value: string; ok?: boolean; person?: boolean }[]).map((f) => ({
      ...f,
      value: f.ok ? ok(t, f.value) : f.person ? person(t, f.value) : f.value,
    }));
  const [, language, license] = String(cfg.footer ?? "").split(" · ");
  return [
    cfg.version && { icon: "tag", label: "Version", value: ok(t, cfg.version) },
    language && { icon: "code", label: "Language", value: language },
    license && { icon: "scale", label: "License", value: license },
    { icon: "user", label: "Author", value: person(t, cfg.author ?? "kbrdn1") },
  ].filter(Boolean) as { icon: string; label: string; value: string }[];
}

// La vignette : une image du repo (`image`, `imageLight` pour le thème clair) — sa vraie capture,
// son illustration — sinon le motif (graphe de branches, markup). `thumbSize` : [w, h].
function illustration(t: Theme): string {
  const [w, h] = cfg.thumbSize ?? [440, 280];
  const src = t.name === "light" && cfg.imageLight ? cfg.imageLight : cfg.image;
  if (src) return picture(t, dataUri(src), { w, h, size: cfg.imageSize, position: cfg.imagePosition });
  const motif = cfg.branchGraph ? branchGraphSvg(cfg.branchGraph) : cfg.motif;
  return motif ? thumb(t, motif, w, h) : "";
}

// Les boutons de la carte, à adapter au projet (un site se visite, un outil s'installe) ; `[]`
// n'en met aucun
type Btn = { label: string; icon?: string; filled?: boolean };
const BUTTONS: Btn[] = cfg.buttons ?? [{ label: "GitHub", icon: "share" }, { label: "Install", icon: "visit", filled: true }];

function body(t: Theme): string {
  const c = tone(t);
  const size = cfg.wordmarkSize ?? 68;
  const repo = String(cfg.footer ?? "").split(" · ")[0];
  const art = illustration(t);
  const list = repoFacts(t);

  const card = `
    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:32px;">
      <div style="min-width:0;">
        <div style="display:flex;align-items:center;gap:${Math.round(size * 0.3)}px;">
          ${logoHtml(t, cfg.logoSize ?? Math.round(size * 0.9))}
          <h1 style="font-family:'Inter',system-ui,sans-serif;font-size:${size}px;font-weight:500;letter-spacing:-0.03em;line-height:1;color:${c.text};white-space:nowrap;">${cfg.wordmark ?? ""}</h1>
        </div>
        ${cfg.tagline ? `<p style="margin-top:16px;font-family:'Fenix',serif;font-size:30px;line-height:1.25;color:${c.accent};">${cfg.tagline}</p>` : ""}
      </div>
      ${BUTTONS.length ? `<div style="flex-shrink:0;display:flex;gap:12px;padding-top:6px;">${BUTTONS.map((b) => button(t, b.label, b.icon, b.filled)).join("")}</div>` : ""}
    </div>
    ${art || list.length ? `<div style="margin-top:34px;display:flex;align-items:center;gap:40px;">${art}${list.length ? facts(t, list) : ""}</div>` : ""}
    ${(cfg.chips ?? []).length ? section(t, cfg.featuresLabel ?? "Features", `<div style="display:flex;flex-wrap:wrap;gap:10px;">${cfg.chips.map((x: string) => tag(t, x)).join("")}</div>`) : ""}
    ${cfg.install ? section(t, cfg.installLabel ?? "Install", monoLine(t, "terminal", `<span style="color:${c.accent};">$</span>&nbsp;${cfg.install}`)) : ""}`;

  return page(t, {
    title: cfg.eyebrow ?? cfg.wordmark ?? "",
    card,
    footerStatus: repo,
    footerAction: cfg.footerAction === null ? undefined : button(t, cfg.footerAction ?? "README"),
  });
}

emit(out, W, H, body);
console.log(`repo → ${out}/dark.html + light.html (${W}x${H}${cfg.image ? ", image" : cfg.branchGraph ? ", branch-graph" : cfg.motif ? ", motif" : ""})`);
