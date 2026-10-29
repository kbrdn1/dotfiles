#!/usr/bin/env bun
// Kit partagé des skills me:cv et me:lettre.
//
// Rend un CV ou une lettre de motivation en PDF depuis un JSON de profil, au design
// actuel du portfolio kbrdn.dev (app/assets/css/theme.css + components.css du repo) :
// panels gris clair aux coins arrondis portant une card blanche, monogramme K arrondi,
// nom en Inter, titre en Fenix orange, eyebrows mono en capitales, séparateurs
// pointillés — en variante claire, imprimable.
//
// Contrainte structurante : le PDF doit être PARSABLE par un ATS. D'où :
//   - une seule colonne, aucun tableau, aucune info dans un en-tête/pied de page
//   - des intitulés de rubrique conventionnels ("Expérience professionnelle")
//   - du vrai texte, pas des pictogrammes à la place des mots
//   - un gate `pdftotext` qui vérifie chaque mot-clé après génération
//
// Usage :
//   bun kit.ts <profil.json> --out <sortie.pdf> [--theme light|dark] [--docx] [--keep-html]
//
// Le JSON porte `doc: "cv" | "lettre"`. Voir profil.fr.json pour le schéma.

import { readFileSync, writeFileSync, existsSync, unlinkSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve, extname, dirname, isAbsolute } from "node:path";

// Les chemins de fichiers du JSON (photo…) sont résolus par rapport au JSON lui-même,
// pas au répertoire courant : la skill tourne depuis n'importe où.
let BASE_DIR = process.cwd();
const fromProfile = (p: string) => {
  if (isAbsolute(p)) return p;
  const near = resolve(BASE_DIR, p);
  return existsSync(near) ? near : resolve(import.meta.dir, p);
};

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const FONT_DIR = `${import.meta.dir}/assets/fonts`;
const b64 = (p: string) => readFileSync(p).toString("base64");

// ─── Thème ────────────────────────────────────────────────────────────────────
// Les jetons de theme.css (.light / .dark). Le clair est le livrable par défaut
// (impression, lisibilité, ATS). Le sombre existe pour la version "portfolio"
// qu'on envoie en direct à un humain.

type Theme = {
  page: string; panel: string; panelBorder: string; card: string; cardBorder: string;
  rule: string; fg: string; muted: string; label: string;
  accent: string; mark: string; tint: string; ok: string;
};

const THEMES: Record<"light" | "dark", Theme> = {
  // accent en primary-700 : primary-500 ne tient que 2,7:1 sur fond clair (Hero.vue)
  light: {
    page: "#ffffff", panel: "#f5f5f5", panelBorder: "#dedede", card: "#ffffff", cardBorder: "#dedede",
    rule: "#d0d0d0", fg: "#1a1a1a", muted: "#3a3a3a", label: "#666666",
    accent: "#a64d2e", mark: "#d4825d", tint: "#f5f5f5", ok: "#166534",
  },
  dark: {
    page: "#1a1a1a", panel: "#0f0f0f", panelBorder: "#2a2a2a", card: "#191919", cardBorder: "#2a2a2a",
    rule: "#3a3a3a", fg: "#e0e0e0", muted: "#b0b0b0", label: "#999999",
    accent: "#d4825d", mark: "#d4825d", tint: "#242424", ok: "#86e89a",
  },
};

// Inter est embarquée en TTF statique (copie de public/fonts/inter du site, 400 et 500) :
// Chrome écrit une police variable en Type 3, que des parseurs lisent mal ; une statique
// sort en TrueType avec sa ToUnicode. Pas de 700 : il serait synthétisé, le site n'en a pas.
const FONT_FACES = `
@font-face{font-family:'Inter OG';src:url(data:font/ttf;base64,${b64(`${FONT_DIR}/InterOG-400.ttf`)}) format('truetype');font-weight:400;font-display:block}
@font-face{font-family:'Inter OG';src:url(data:font/ttf;base64,${b64(`${FONT_DIR}/InterOG-500.ttf`)}) format('truetype');font-weight:500;font-display:block}
@font-face{font-family:'Krypton';src:url(data:font/woff2;base64,${b64(`${FONT_DIR}/MonaspaceKrypton.woff2`)}) format('woff2');font-weight:200 800;font-display:block}
@font-face{font-family:'Fenix';src:url(data:font/ttf;base64,${b64(`${FONT_DIR}/Fenix-Regular.ttf`)}) format('truetype');font-weight:400;font-display:block}`;

// Inter porte tout le contenu parsable. Krypton et Fenix ne servent qu'aux libellés,
// aux dates et au titre — vérifié extractible par le gate.
const SANS = `'Inter OG',Inter,-apple-system,'Helvetica Neue',Helvetica,Arial,sans-serif`;
const MONO = `'Krypton','JetBrains Mono','Courier New',monospace`;

const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));

// ─── Types du profil ──────────────────────────────────────────────────────────

type Link = { label: string; url: string };
type Identity = {
  name: string; title: string; summary?: string;
  location?: string; mobility?: string; email?: string; phone?: string;
  nationality?: string; availability?: string; photo?: string;
  links?: Link[];
};
type Section =
  | { type: "experience"; title: string; items: Array<{ role: string; company: string; location?: string; period: string; contract?: string; context?: string; bullets?: string[]; stack?: string[] }> }
  | { type: "projects"; title: string; items: Array<{ name: string; tagline?: string; url?: string; period?: string; description: string; stack?: string[] }> }
  | { type: "skills"; title: string; groups: Array<{ label: string; items: string[] }> }
  | { type: "education"; title: string; items: Array<{ school: string; program: string; period: string; note?: string }> }
  | { type: "languages"; title: string; items: Array<{ label: string; level: string }> }
  | { type: "text"; title: string; body: string[] };

type Profile = {
  doc: "cv" | "lettre";
  lang: string;
  identity: Identity;
  sections?: Section[];
  // lettre uniquement
  recipient?: { name?: string; role?: string; company: string; address?: string[] };
  place?: string;
  date?: string;
  subject?: string;
  salutation?: string;
  body?: string[];
  closing?: string;
  // méta : mots-clés supplémentaires que le gate doit retrouver intacts
  gateExtra?: string[];
};

// ─── Fragments visuels (identité kbrdn.dev) ───────────────────────────────────

// Le monogramme K du site (app/components/ui/Logo.vue, #101), figé : la barre à la
// couleur du texte, la branche coupée en deux pièces orange. Un dessin, aucun glyphe :
// le parser n'en voit rien.
const logo = (t: Theme) => `<svg width=".8em" height=".8em" viewBox="0 0 96 96" aria-hidden="true"
  style="vertical-align:-.04em;margin-right:.3em"><path fill="${t.fg}"
  d="M62.83 1.17A4 4 0 0 1 65.66 0L86.34 0A4 4 0 0 1 89.17 6.83L6.83 89.17A4 4 0 0 1 0 86.34L0 65.66A4 4 0 0 1 1.17 62.83Z"/><path
  fill="${t.mark}" d="M0 9.66A4 4 0 0 1 6.83 6.83L21.17 21.17A4 4 0 0 1 21.17 26.83L6.83 41.17A4 4 0 0 1 0 38.34Z"/><path
  fill="${t.mark}" d="M53.17 58.83A4 4 0 0 1 58.83 58.83L89.17 89.17A4 4 0 0 1 86.34 96L65.66 96A4 4 0 0 1 62.83 94.83L42.83 74.83A4 4 0 0 1 42.83 69.17Z"/></svg>`;

// Un libellé de rubrique : intitulé conventionnel (l'ATS s'en sert pour découper le
// document), en eyebrow du site (mono, capitales) dans la bande grise d'un panel. Les
// capitales ne sont pas décoratives : le gate cherche les titres sous cette forme.
// `inline` : contenu d'une rubrique courte posé dans la même bande — et alors pas de
// letter-spacing, qui ressortirait en "L A N G U E S" chez le parser.
const sectionHead = (t: Theme, title: string, inline = "") => `
<h2 class="sh" style="margin:${inline ? "4px 0 0" : "7px 0 4px"};padding:2px 8px;background:${t.panel};
  border:1px solid ${t.panelBorder};border-radius:8px;font-family:${MONO};font-size:8pt;
  font-weight:400;${inline ? "" : "letter-spacing:.08em;"}text-transform:uppercase;color:${t.muted}">${esc(title)}${inline}</h2>`;

// La liste de technos est le passage le plus dense en mots-clés du document : c'est
// exactement là qu'il ne faut PAS de pastilles. Chaque pastille est une boîte
// positionnée, que pdftotext ré-ordonne à sa guise — le CV précédent sortait
// "TypeScript / Stripe / Vue" au lieu de l'ordre écrit. Un seul nœud texte, donc,
// dans une bande teintée aux coins arrondis.
const stackLine = (t: Theme, items: string[], label = "Stack") =>
  !items?.length ? "" : `<p style="margin:3.5px 0 0;padding:2px 5px;background:${t.tint};
    border-radius:6px;font-size:8.1pt;line-height:1.4;color:${t.muted}"><span
    style="font-family:${MONO};color:${t.accent}">${esc(label)} </span>${items.map(esc).join(" · ")}</p>`;

// ─── Rendu CV ─────────────────────────────────────────────────────────────────

function renderSection(t: Theme, s: Section): string {
  const head = sectionHead(t, s.title);

  // Règle commune à toutes les rubriques : AUCUN flex, AUCUN inline-block, AUCUNE
  // date flottée à droite. Chaque information est un bloc dans le flux, dans l'ordre
  // où on veut qu'elle soit lue. Les dates alignées à droite se faisaient arracher
  // de leur ligne et regrouper en fin de document.

  // La ligne de dates reprend la méta des entrées du parcours (eyebrow orange en
  // capitales), sans son letter-spacing : c'est du contenu, pas un titre seul.
  if (s.type === "experience") {
    return head + s.items.map((e) => `
<div class="it" style="margin:0 0 6px;break-inside:avoid">
  <p style="margin:0;font-size:10pt;font-weight:500;color:${t.fg}">${esc(e.role)}<span
    style="font-weight:400;color:${t.muted}"> — ${esc(e.company)}</span></p>
  <p style="margin:1px 0 0;font-family:${MONO};font-size:7.6pt;text-transform:uppercase;color:${t.accent}">${
    [e.period, e.contract, e.location].filter(Boolean).map(esc).join("  ·  ")}</p>
  ${e.context ? `<p style="margin:2.5px 0 0;font-size:8.5pt;color:${t.label}">${esc(e.context)}</p>` : ""}
  ${e.bullets?.length ? `<ul style="margin:3px 0 0;padding:0 0 0 11px;list-style:none">${e.bullets.map((b) =>
    `<li class="b" style="margin:0 0 2px;font-size:8.55pt;line-height:1.36;color:${t.muted}">${esc(b)}</li>`).join("")}</ul>` : ""}
  ${stackLine(t, e.stack ?? [])}
</div>`).join("");
  }

  if (s.type === "projects") {
    return head + s.items.map((p) => `
<div class="it" style="margin:0 0 5px;break-inside:avoid">
  <p style="margin:0;font-size:9.1pt;color:${t.fg}"><span style="font-weight:500">${esc(p.name)}</span>${
    p.tagline ? `<span style="color:${t.accent}"> — ${esc(p.tagline)}</span>` : ""}${
    p.url ? `<span style="font-family:${MONO};font-size:7.5pt;color:${t.label}">  ${esc(p.url)}</span>` : ""}</p>
  <p style="margin:1.5px 0 0;font-size:8.5pt;line-height:1.4;color:${t.muted}">${esc(p.description)}</p>
  ${stackLine(t, p.stack ?? [])}
</div>`).join("");
  }

  // Les libellés gardent leur casse : en capitales, « LANGUAGES — » au milieu des
  // compétences se lirait comme un titre de rubrique.
  if (s.type === "skills") {
    return head + s.groups.map((g) => `
<p style="margin:0 0 2px;font-size:8.6pt;line-height:1.4;color:${t.muted}"><span
  style="font-family:${MONO};font-size:7.9pt;color:${t.accent}">${esc(g.label)} — </span>${g.items.map(esc).join(" · ")}</p>`).join("");
  }

  if (s.type === "education") {
    return head + s.items.map((e) => `
<p style="margin:0 0 2.5px;font-size:8.7pt;line-height:1.38;color:${t.muted}"><span
  style="font-weight:500;color:${t.fg}">${esc(e.program)}</span> — ${esc(e.school)}<span
  style="font-family:${MONO};font-size:7.6pt;color:${t.label}">  ·  ${esc(e.period)}</span>${
  e.note ? `<span style="color:${t.label}"> · ${esc(e.note)}</span>` : ""}</p>`).join("");
  }

  // Le compact ne vaut que pour une rubrique qui tient VRAIMENT sur une ligne
  // (Langues, Loisirs). Un paragraphe entier crammé dans un <h2> bordé reproduirait
  // exactement la mise en page que le gate est censé attraper.
  if (s.type === "languages" || (s.type === "text" && s.body.length === 1 && s.body[0].length < 80)) {
    // Rubrique courte : titre et contenu sur une seule ligne, dans un unique nœud
    // texte. On économise une ligne sans introduire de flex ni de seconde colonne.
    // Pas de letter-spacing ici : sur un titre suivi de contenu inline, il ressort
    // en "L A N G U E S" chez le parser.
    const inline = s.type === "languages"
      ? s.items.map((l) => `${esc(l.label)} ${esc(l.level)}`).join("  ·  ")
      : esc(s.body[0]);
    return sectionHead(t, s.title, `<span
  style="font-family:${SANS};font-size:8.6pt;text-transform:none;color:${t.muted}">   ${inline}</span>`);
  }

  return head + s.body.map((p) => `<p style="margin:0 0 4px;font-size:8.9pt;line-height:1.45;color:${t.muted}">${esc(p)}</p>`).join("");
}

function renderCV(p: Profile, t: Theme): string {
  const id = p.identity;
  // Toutes les coordonnées sont du texte dans le flux du document : jamais dans un
  // en-tête PDF, que les ATS ignorent systématiquement.
  const sep = `<span style="color:${t.rule}">  ·  </span>`;
  const contact = [id.location, id.email, id.phone, ...(id.links ?? []).map((l) => l.url.replace(/^https?:\/\//, ""))]
    .filter(Boolean).map(esc).join(sep);
  const facts = [id.mobility, id.nationality].filter(Boolean).map(esc).join(sep);

  const photoPath = id.photo ? fromProfile(id.photo) : null;
  if (id.photo && !existsSync(photoPath!)) console.log(`  ⚠ photo introuvable : ${photoPath}`);
  const photo = photoPath && existsSync(photoPath)
    ? `<img src="data:image/${extname(photoPath).slice(1).replace("jpg", "jpeg") || "jpeg"};base64,${b64(photoPath)}"
        style="width:25mm;height:31mm;object-fit:cover;border:1px solid ${t.cardBorder};border-radius:12px;flex:0 0 auto">`
    : "";

  // La pastille de statut du hero (.tag) : un bloc seul sur sa ligne, le point dessiné
  // en CSS — jamais un inline-block au milieu d'une ligne de texte.
  const status = id.availability ? `<p style="margin:5px 0 0;width:max-content;padding:1px 8px 1px 7px;
    border:1px solid ${t.ok}4d;border-radius:9999px;background:${t.ok}1a;font-family:${MONO};
    font-size:7.4pt;letter-spacing:.06em;text-transform:uppercase;color:${t.ok}"><span class="dot"></span>${esc(id.availability)}</p>` : "";

  // Le header est un panel du site : surface grise, card blanche dedans (coins
  // concentriques, 20 − 4 = 16), et les coordonnées dans la bande du panel sous la
  // card. Tout reste du texte dans le flux : jamais dans un en-tête PDF.
  return `
<div style="background:${t.panel};border:1px solid ${t.panelBorder};border-radius:20px;padding:4px;margin:0 0 2mm">
  <div style="display:flex;gap:6mm;align-items:flex-start;background:${t.card};
    border:1px solid ${t.cardBorder};border-radius:16px;padding:4mm 5.5mm">
    <div style="flex:1 1 auto;min-width:0">
      <h1 style="margin:0;font-size:24pt;font-weight:400;letter-spacing:-.025em;line-height:1.05;color:${t.fg}">${logo(t)}${esc(id.name)}</h1>
      <p style="margin:3px 0 0;font-family:'Fenix',Georgia,serif;font-size:12.5pt;color:${t.accent}">${esc(id.title)}</p>
      ${status}
      ${id.summary ? `<p style="margin:5px 0 0;font-size:8.7pt;line-height:1.45;color:${t.muted}">${esc(id.summary)}</p>` : ""}
    </div>
    ${photo}
  </div>
  <div style="padding:1.8mm 5.5mm 1.4mm;font-size:8pt;line-height:1.5;color:${t.muted}">
    <p style="margin:0">${contact}</p>
    ${facts ? `<p style="margin:0;color:${t.label}">${facts}</p>` : ""}
  </div>
</div>
${(p.sections ?? []).map((s) => renderSection(t, s)).join("")}`;
}

// ─── Rendu lettre ─────────────────────────────────────────────────────────────

function renderLettre(p: Profile, t: Theme): string {
  const id = p.identity;
  const r = p.recipient;
  return `
<div style="display:flex;justify-content:space-between;gap:20mm;margin:0 0 13mm">
  <div style="font-size:9.5pt;line-height:1.5;color:${t.muted}">
    <p style="margin:0;font-size:12pt;font-weight:700;color:${t.fg}">${esc(id.name)}</p>
    <p style="margin:1px 0 5px;font-family:${MONO};font-size:9pt;color:${t.accent}">${esc(id.title)}</p>
    ${[id.location, id.phone, id.email, ...(id.links ?? []).map((l) => l.url.replace(/^https?:\/\//, ""))]
      .filter(Boolean).map((l) => `<p style="margin:0">${esc(l)}</p>`).join("")}
  </div>
  ${r ? `<div style="font-size:9.5pt;line-height:1.5;color:${t.fg};text-align:right">
    ${[r.name, r.role, r.company, ...(r.address ?? [])].filter(Boolean)
      .map((l, i) => `<p style="margin:0${i === 0 ? ";font-weight:700" : ""}">${esc(l)}</p>`).join("")}
  </div>` : ""}
</div>
${p.place || p.date ? `<p style="margin:0 0 8mm;font-size:9.5pt;color:${t.muted};text-align:right">${
  esc([p.place, p.date].filter(Boolean).join(", "))}</p>` : ""}
${p.subject ? `<p style="margin:0 0 7mm;font-size:10pt;color:${t.fg};padding:0 0 3px;border-bottom:1px solid ${t.rule}">
  <strong>${esc(p.subject)}</strong></p>` : ""}
${p.salutation ? `<p style="margin:0 0 4mm;font-size:10.5pt;color:${t.fg}">${esc(p.salutation)}</p>` : ""}
${(p.body ?? []).map((par) => `<p style="margin:0 0 4mm;font-size:10.1pt;line-height:1.55;color:${t.fg};text-align:justify">${esc(par)}</p>`).join("")}
${p.closing ? `<p style="margin:5.5mm 0 0;font-size:10.1pt;line-height:1.55;color:${t.fg}">${esc(p.closing)}</p>` : ""}
<p style="margin:6mm 0 0;font-size:10.5pt;color:${t.fg}">${esc(id.name)}</p>`;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function html(p: Profile, theme: "light" | "dark"): string {
  const t = THEMES[theme];
  const isCV = p.doc === "cv";
  const pad = isCV ? "9mm 10mm 7mm" : "21mm 22mm";
  return `<!doctype html><html lang="${esc(p.lang)}"><head><meta charset="utf-8">
<title>${esc(p.identity.name)}</title><style>
${FONT_FACES}
@page{size:A4;margin:0}
*{box-sizing:border-box}
html,body{margin:0;padding:0}
body{background:${t.page};color:${t.fg};font-family:${SANS};
  -webkit-print-color-adjust:exact;print-color-adjust:exact;
  font-variant-ligatures:none;font-kerning:normal;text-rendering:geometricPrecision}
.page{width:210mm;min-height:297mm;padding:${pad};background:${t.page};position:relative}
p,li,h1{orphans:2;widows:2}
/* Un titre de rubrique n'a qu'une ligne : avec widows:2 il refuse la fin de page
   et bascule tout seul sur une 2e page à moitié vide. */
h2{orphans:1;widows:1;break-after:avoid}
a{color:inherit;text-decoration:none}
/* Décors sans glyphe (pseudo-éléments vides) : le parser n'en voit rien. Le point
   orange des rubriques et des puces reprend ceux de la timeline du parcours. */
.sh::before,.dot{content:"";display:inline-block;width:5px;height:5px;border-radius:50%;vertical-align:middle}
.sh::before{background:${t.mark};margin:0 7px 1px 0}
.dot{background:currentColor;margin:0 6px 1px 0}
.b{position:relative}
.b::before{content:"";position:absolute;left:-9px;top:.5em;width:4px;height:4px;border-radius:50%;background:${t.mark}}
/* Séparateurs pointillés entre deux entrées, comme les lignes des cards du site */
.it+.it{border-top:1px dashed ${t.rule};padding-top:4px}
</style></head><body><div class="page">
${isCV ? renderCV(p, t) : renderLettre(p, t)}
</div></body></html>`;
}

// ─── Export .docx ─────────────────────────────────────────────────────────────
// Workday et SuccessFactors parsent parfois mieux le .docx que le PDF. On le génère
// depuis le JSON, jamais depuis le PDF : re-parser sa propre sortie réintroduit
// exactement les erreurs qu'on cherche à éviter.

function markdown(p: Profile): string {
  const id = p.identity;
  const L: string[] = [`# ${id.name}`, "", id.title, ""];
  if (id.summary) L.push(id.summary, "");
  L.push([id.location, id.email, id.phone, ...(id.links ?? []).map((l) => l.url.replace(/^https?:\/\//, ""))]
    .filter(Boolean).join(" | "));
  const facts = [id.mobility, id.nationality, id.availability].filter(Boolean).join(" | ");
  if (facts) L.push("", facts);
  L.push("");

  if (p.doc === "lettre") {
    const r = p.recipient;
    if (r) L.push([r.name, r.role, r.company, ...(r.address ?? [])].filter(Boolean).join(", "), "");
    if (p.place || p.date) L.push([p.place, p.date].filter(Boolean).join(", "), "");
    if (p.subject) L.push(`**${p.subject}**`, "");
    if (p.salutation) L.push(p.salutation, "");
    L.push(...(p.body ?? []).flatMap((b) => [b, ""]));
    if (p.closing) L.push(p.closing, "");
    L.push(id.name);
    return L.join("\n");
  }

  for (const s of p.sections ?? []) {
    L.push(`## ${s.title}`, "");
    if (s.type === "experience") for (const e of s.items) {
      L.push(`### ${e.role} — ${e.company}`, "",
        [e.period, e.contract, e.location].filter(Boolean).join(" · "), "");
      if (e.context) L.push(`*${e.context}*`, "");
      for (const b of e.bullets ?? []) L.push(`- ${b}`);
      if (e.stack?.length) L.push("", `Stack : ${e.stack.join(" · ")}`);
      L.push("");
    }
    else if (s.type === "projects") for (const x of s.items) {
      L.push(`### ${x.name}${x.tagline ? ` — ${x.tagline}` : ""}`, "",
        [x.description, x.url].filter(Boolean).join(" "), "");
      if (x.stack?.length) L.push(`Stack : ${x.stack.join(" · ")}`, "");
    }
    else if (s.type === "skills") { for (const g of s.groups) L.push(`- **${g.label}** : ${g.items.join(" · ")}`); L.push(""); }
    else if (s.type === "education") { for (const e of s.items) L.push(`- **${e.program}** — ${e.school} · ${e.period}${e.note ? ` · ${e.note}` : ""}`); L.push(""); }
    else if (s.type === "languages") { for (const l of s.items) L.push(`- **${l.label}** : ${l.level}`); L.push(""); }
    else { L.push(...s.body, ""); }
  }
  return L.join("\n");
}

// ─── Gate ATS ─────────────────────────────────────────────────────────────────
// On relit le PDF produit exactement comme le ferait un parser : `pdftotext` sans
// `-layout`. Chaque terme attendu doit ressortir INTACT, dans un ordre de lecture
// correct. C'est ce contrôle qui aurait attrapé le CV précédent, où "WAMP" sortait
// en "A P W M" et "TailwindCSS" en "T ailwindCSS".

function gateKeywords(p: Profile): string[] {
  const out = new Set<string>([p.identity.name, p.identity.title]);
  for (const v of [p.identity.email, p.identity.phone]) if (v) out.add(v);
  for (const s of p.sections ?? []) {
    if (s.type === "experience") for (const e of s.items) { out.add(e.company); out.add(e.role); (e.stack ?? []).forEach((x) => out.add(x)); }
    if (s.type === "projects") for (const x of s.items) { out.add(x.name); (x.stack ?? []).forEach((y) => out.add(y)); }
    if (s.type === "skills") for (const g of s.groups) g.items.forEach((x) => out.add(x));
    if (s.type === "education") for (const e of s.items) { out.add(e.school); out.add(e.program); }
    if (s.type !== "text") out.add(s.title);
  }
  (p.gateExtra ?? []).forEach((x) => out.add(x));
  return [...out].filter((x) => x && x.length > 1);
}

function runGate(pdf: string, p: Profile, maxPages: number) {
  const text = execFileSync("pdftotext", [pdf, "-"], { encoding: "utf8" });
  // pdftotext coupe aux fins de ligne, et les titres sont en petites capitales CSS :
  // on compare sur une version dé-wrappée et insensible à la casse, comme le ferait
  // la normalisation d'un parser.
  const flat = text.replace(/\s+/g, " ").toLowerCase();
  const norm = (k: string) => k.replace(/\s+/g, " ").toLowerCase();
  const keys = gateKeywords(p);
  const missing = keys.filter((k) => !flat.includes(norm(k)));

  // Ordre de lecture : les rubriques doivent ressortir dans l'ordre du document.
  // C'est ce contrôle qui attrape les mises en page multi-colonnes et les dates
  // flottées à droite, qui se font ré-ordonner par le parser.
  //
  // On cherche la forme EN CAPITALES (les titres de rubrique sont rendus en
  // `text-transform:uppercase`) et on scanne séquentiellement : sinon un mot du
  // corps déclenche un faux positif — « education platform » dans l'accroche
  // arrivait avant la rubrique « Education ».
  const titles = (p.sections ?? []).filter((s) => s.type !== "text").map((s) => s.title);
  const raw = text.replace(/\s+/g, " ");
  const outOfOrder: string[] = [];
  let cursor = 0;
  for (const t0 of titles) {
    const at = raw.indexOf(t0.toUpperCase(), cursor);
    if (at < 0) outOfOrder.push(t0);
    else cursor = at + t0.length;
  }

  // Complétude : un document parsable qui affiche "TODO" est pire que l'ancien CV.
  // Le gate vérifie la parsabilité ET l'absence de trous laissés dans le contenu.
  const holes = [/\bTODO\b/i, /à confirmer/i, /à compléter/i, /\bXXX\b/, /🔴/, /\bLorem ipsum\b/i];
  const placeholders = text.split("\n").map((l) => l.trim())
    .filter((l) => holes.some((re) => re.test(l)));

  const pages = Number(/Pages:\s+(\d+)/.exec(execFileSync("pdfinfo", [pdf], { encoding: "utf8" }))?.[1] ?? 0);
  const ok = (b: boolean) => (b ? "✓" : "✗");

  console.log(`\n  gate ATS`);
  console.log(`  pages            ${pages}/${maxPages}  ${ok(pages <= maxPages)}`);
  console.log(`  mots-clés        ${keys.length - missing.length}/${keys.length}  ${ok(!missing.length)}`);
  console.log(`  ordre rubriques  ${titles.length - outOfOrder.length}/${titles.length}  ${ok(!outOfOrder.length)}`);
  console.log(`  complétude       ${placeholders.length ? `${placeholders.length} trou(s)` : "aucun trou"}  ${ok(!placeholders.length)}`);
  console.log(`  caractères       ${text.trim().length}`);
  if (missing.length) console.log(`  ✗ introuvables   ${missing.join(" | ")}`);
  if (outOfOrder.length) console.log(`  ✗ désordonnées   ${outOfOrder.join(" | ")}`);
  for (const l of placeholders) console.log(`  ✗ à remplir      ${l.slice(0, 100)}`);
  if (missing.length || outOfOrder.length || pages > maxPages || placeholders.length) {
    if (missing.length || outOfOrder.length) console.log(`\n  --- texte extrait (ce que lit l'ATS) ---\n${text}`);
    console.log(`\n  ✗ BROUILLON — ne pas envoyer en l'état.\n`);
    process.exit(1);
  }
  console.log(`  → parsable, complet, dans l'ordre. Bon pour envoi.\n`);
}

// ─── CLI ──────────────────────────────────────────────────────────────────────

const argv = process.argv.slice(2);
const src = argv.find((a) => !a.startsWith("--"));
if (!src) { console.error("usage: bun kit.ts <profil.json> --out <sortie.pdf> [--theme light|dark] [--docx] [--keep-html] [--max-pages N]"); process.exit(2); }
const flag = (n: string, d?: string) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : d; };

const profile: Profile = JSON.parse(readFileSync(src, "utf8"));
BASE_DIR = dirname(resolve(src));
const theme = (flag("theme", "light") as "light" | "dark");
const out = resolve(flag("out", src.replace(/\.json$/, `.${theme}.pdf`))!);
const maxPages = Number(flag("max-pages", "1"));
const tmpHtml = out.replace(/\.pdf$/, ".html");

writeFileSync(tmpHtml, html(profile, theme));
execFileSync(CHROME, [
  "--headless=new", "--disable-gpu", "--no-pdf-header-footer",
  "--run-all-compositor-stages-before-draw", "--virtual-time-budget=2000",
  `--print-to-pdf=${out}`, `file://${tmpHtml}`,
], { stdio: ["ignore", "ignore", "ignore"] });

if (!argv.includes("--keep-html")) unlinkSync(tmpHtml);

if (argv.includes("--docx")) {
  const docx = out.replace(/\.pdf$/, ".docx");
  execFileSync("pandoc", ["-f", "markdown", "-t", "docx", "-o", docx], { input: markdown(profile) });
  console.log(`  écrit           ${docx}`);
}

console.log(`  écrit           ${out}`);
runGate(out, profile, maxPages);
