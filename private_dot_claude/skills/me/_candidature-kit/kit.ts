#!/usr/bin/env bun
// Kit partagé des skills me:cv et me:lettre.
//
// Rend un CV ou une lettre de motivation en PDF depuis un JSON de profil, à la
// charte "Claude Dark" du portfolio kbrdn.dev (accent orange chaud, coins nets,
// rayures diagonales, triangles d'angle) — mais en variante claire, imprimable.
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
// Le clair est le livrable par défaut (impression, lisibilité, ATS). Le sombre
// existe pour la version "portfolio" qu'on envoie en direct à un humain.

type Theme = {
  page: string; band: string; stripe: string; rule: string; corner: string;
  fg: string; accent: string; accentSoft: string; muted: string; dim: string;
  chipBg: string; chipFg: string; chipBorder: string;
};

const THEMES: Record<"light" | "dark", Theme> = {
  light: {
    page: "#ffffff", band: "#f5f5f5", stripe: "#e8e8e8", rule: "#d0d0d0", corner: "#b0b0b0",
    fg: "#1a1a1a", accent: "#c15f3c", accentSoft: "#a64d2e", muted: "#3a3a3a", dim: "#666666",
    chipBg: "#f0f0f0", chipFg: "#3a3a3a", chipBorder: "#d8d8d8",
  },
  dark: {
    page: "#1a1a1a", band: "#242424", stripe: "#2a2a2a", rule: "#3a3a3a", corner: "#3a3a3a",
    fg: "#e0e0e0", accent: "#d4825d", accentSoft: "#e8a573", muted: "#b0b0b0", dim: "#999999",
    chipBg: "#242424", chipFg: "#b0b0b0", chipBorder: "#3a3a3a",
  },
};

const FONT_FACES = `
@font-face{font-family:'Krypton';src:url(data:font/woff2;base64,${b64(`${FONT_DIR}/MonaspaceKrypton.woff2`)}) format('woff2');font-weight:400;font-display:block}
@font-face{font-family:'Fenix';src:url(data:font/ttf;base64,${b64(`${FONT_DIR}/Fenix-Regular.ttf`)}) format('truetype');font-weight:400;font-display:block}`;

// Inter est la police de tout le contenu parsable : c'est une sans-serif standard,
// que Chrome embarque avec une table ToUnicode propre. Krypton et Fenix ne servent
// qu'aux libellés de rubrique et au nom — vérifié extractible par le gate.
const SANS = `Inter,-apple-system,'Helvetica Neue',Helvetica,Arial,sans-serif`;
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

const corners = (t: Theme, inset: string) => {
  const tri = (pos: string, bw: string, col: string) =>
    `<span style="position:absolute;${pos};width:0;height:0;border-style:solid;border-width:${bw};border-color:${col}"></span>`;
  const c = t.corner;
  return [
    tri(`top:${inset};left:${inset}`, "5px 5px 0 0", `${c} transparent transparent transparent`),
    tri(`top:${inset};right:${inset}`, "5px 0 0 5px", `${c} transparent transparent transparent`),
    tri(`bottom:${inset};left:${inset}`, "0 5px 5px 0", `transparent transparent ${c} transparent`),
    tri(`bottom:${inset};right:${inset}`, "0 0 5px 5px", `transparent transparent ${c} transparent`),
  ].join("");
};

const stripes = (t: Theme) =>
  `repeating-linear-gradient(-45deg,${t.stripe} 0 1px,transparent 1px 7px)`;

// Un libellé de rubrique : intitulé conventionnel (l'ATS s'en sert pour découper
// le document) + filet accentué. Le mono ne porte que la casse, pas le sens.
const sectionHead = (t: Theme, title: string) => `
<h2 style="margin:9px 0 4.5px;padding:0 0 2.5px;border-bottom:1px solid ${t.rule};
  font-family:${MONO};font-size:8.5pt;font-weight:400;letter-spacing:.14em;
  text-transform:uppercase;color:${t.accent}">${esc(title)}</h2>`;

// La liste de technos est le passage le plus dense en mots-clés du document : c'est
// exactement là qu'il ne faut PAS de pastilles. Chaque pastille est une boîte
// positionnée, que pdftotext ré-ordonne à sa guise — le CV précédent sortait
// "TypeScript / Stripe / Vue" au lieu de l'ordre écrit. Un seul nœud texte, donc.
const stackLine = (t: Theme, items: string[], label = "Stack") =>
  !items?.length ? "" : `<p style="margin:3.5px 0 0;padding:2px 0 2px 6px;background:${t.chipBg};
    border-left:2px solid ${t.accent};font-size:8.1pt;line-height:1.4;color:${t.chipFg}"><span
    style="font-family:${MONO};color:${t.accent}">${esc(label)} </span>${items.map(esc).join(" · ")}</p>`;

// ─── Rendu CV ─────────────────────────────────────────────────────────────────

function renderSection(t: Theme, s: Section): string {
  const head = sectionHead(t, s.title);

  // Règle commune à toutes les rubriques : AUCUN flex, AUCUN inline-block, AUCUNE
  // date flottée à droite. Chaque information est un bloc dans le flux, dans l'ordre
  // où on veut qu'elle soit lue. Les dates alignées à droite se faisaient arracher
  // de leur ligne et regrouper en fin de document.

  if (s.type === "experience") {
    return head + s.items.map((e) => `
<div style="margin:0 0 7px;break-inside:avoid">
  <p style="margin:0;font-size:10pt;font-weight:700;color:${t.fg}">${esc(e.role)}<span
    style="font-weight:400;color:${t.accent}"> — ${esc(e.company)}</span></p>
  <p style="margin:1px 0 0;font-family:${MONO};font-size:7.9pt;color:${t.dim}">${
    [e.period, e.contract, e.location].filter(Boolean).map(esc).join("  ·  ")}</p>
  ${e.context ? `<p style="margin:2.5px 0 0;font-size:8.5pt;color:${t.muted};font-style:italic">${esc(e.context)}</p>` : ""}
  ${e.bullets?.length ? `<ul style="margin:3.5px 0 0;padding:0 0 0 12px;list-style:none">${e.bullets.map((b) =>
    `<li style="margin:0 0 2px;font-size:8.55pt;line-height:1.36;color:${t.muted};position:relative">
       <span style="position:absolute;left:-10px;color:${t.accent}">▸</span>${esc(b)}</li>`).join("")}</ul>` : ""}
  ${stackLine(t, e.stack ?? [])}
</div>`).join("");
  }

  if (s.type === "projects") {
    return head + s.items.map((p) => `
<div style="margin:0 0 5px;break-inside:avoid">
  <p style="margin:0;font-size:9.1pt;color:${t.fg}"><strong>${esc(p.name)}</strong>${
    p.tagline ? `<span style="color:${t.accent}"> — ${esc(p.tagline)}</span>` : ""}${
    p.url ? `<span style="font-family:${MONO};font-size:7.5pt;color:${t.dim}">  ${esc(p.url)}</span>` : ""}</p>
  <p style="margin:1.5px 0 0;font-size:8.5pt;line-height:1.4;color:${t.muted}">${esc(p.description)}</p>
  ${stackLine(t, p.stack ?? [])}
</div>`).join("");
  }

  if (s.type === "skills") {
    return head + s.groups.map((g) => `
<p style="margin:0 0 2px;font-size:8.6pt;line-height:1.4;color:${t.muted}"><span
  style="font-family:${MONO};font-size:8pt;color:${t.accent}">${esc(g.label)} — </span>${g.items.map(esc).join(" · ")}</p>`).join("");
  }

  if (s.type === "education") {
    return head + s.items.map((e) => `
<p style="margin:0 0 2.5px;font-size:8.7pt;line-height:1.38;color:${t.muted}"><strong
  style="color:${t.fg}">${esc(e.program)}</strong> — ${esc(e.school)}<span
  style="font-family:${MONO};font-size:7.9pt;color:${t.dim}">  ·  ${esc(e.period)}</span>${
  e.note ? `<span style="color:${t.dim}"> · ${esc(e.note)}</span>` : ""}</p>`).join("");
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
    return `
<h2 style="margin:4px 0 0;padding:0 0 2px;border-bottom:1px solid ${t.rule};
  font-family:${MONO};font-size:8.5pt;font-weight:400;
  text-transform:uppercase;color:${t.accent}">${esc(s.title)}<span
  style="font-family:${SANS};font-size:8.7pt;letter-spacing:0;text-transform:none;color:${t.muted}">   ${inline}</span></h2>`;
  }

  return head + s.body.map((p) => `<p style="margin:0 0 4px;font-size:8.9pt;line-height:1.45;color:${t.muted}">${esc(p)}</p>`).join("");
}

function renderCV(p: Profile, t: Theme): string {
  const id = p.identity;
  // Toutes les coordonnées sont du texte dans le flux du document : jamais dans un
  // en-tête PDF, que les ATS ignorent systématiquement.
  const contact = [id.location, id.email, id.phone, ...(id.links ?? []).map((l) => l.url.replace(/^https?:\/\//, ""))]
    .filter(Boolean).map(esc).join("<span style=\"color:" + t.rule + "\">  |  </span>");
  const facts = [id.mobility, id.nationality, id.availability].filter(Boolean).map(esc)
    .join("<span style=\"color:" + t.rule + "\">  |  </span>");

  const photoPath = id.photo ? fromProfile(id.photo) : null;
  if (id.photo && !existsSync(photoPath!)) console.log(`  ⚠ photo introuvable : ${photoPath}`);
  const photo = photoPath && existsSync(photoPath)
    ? `<img src="data:image/${extname(photoPath).slice(1).replace("jpg", "jpeg") || "jpeg"};base64,${b64(photoPath)}"
        style="width:26mm;height:32mm;object-fit:cover;border:1px solid ${t.rule};flex:0 0 auto">`
    : "";

  return `
<div style="position:relative;background:${t.band};background-image:${stripes(t)};
  border:1px solid ${t.rule};padding:5.5mm 6.5mm;margin:0 0 2.5mm">
  ${corners(t, "3px")}
  <div style="display:flex;gap:7mm;align-items:flex-start">
    <div style="flex:1 1 auto;min-width:0">
      <h1 style="margin:0;font-family:'Fenix',Georgia,serif;font-size:23pt;font-weight:400;
        letter-spacing:.01em;color:${t.fg};line-height:1.05">${esc(id.name)}</h1>
      <p style="margin:2px 0 0;font-family:${MONO};font-size:10pt;color:${t.accent};letter-spacing:.02em">${esc(id.title)}</p>
      ${id.summary ? `<p style="margin:5px 0 0;font-size:8.7pt;line-height:1.45;color:${t.muted};max-width:164mm">${esc(id.summary)}</p>` : ""}
      <p style="margin:5.5px 0 0;font-size:8pt;line-height:1.5;color:${t.muted}">${contact}</p>
      ${facts ? `<p style="margin:1px 0 0;font-size:8pt;line-height:1.5;color:${t.dim}">${facts}</p>` : ""}
    </div>
    ${photo}
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
  const pad = isCV ? "9mm 11mm 7mm" : "21mm 22mm";
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
