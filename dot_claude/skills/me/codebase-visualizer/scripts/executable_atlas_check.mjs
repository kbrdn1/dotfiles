#!/usr/bin/env node
// atlas_check.mjs — valide le bloc DATA d'un atlas avant publication.
//
//     node atlas_check.mjs atlas.html
//
// La section DATA n'utilise aucune API DOM : on l'extrait entre ses marqueurs
// et on l'évalue telle quelle. Zéro dépendance. Sort 1 si une erreur bloque.

import { readFileSync } from "node:fs";

const file = process.argv[2];
if (!file) {
  console.error("usage: atlas_check.mjs <atlas.html>");
  process.exit(2);
}

const html = readFileSync(file, "utf8");
const START = "// ---- ATLAS DATA START ----";
const END = "// ---- ATLAS DATA END ----";
const a = html.indexOf(START), b = html.indexOf(END);
if (a < 0 || b < 0) {
  console.error(`✗ marqueurs DATA introuvables (${START} … ${END})`);
  process.exit(2);
}

let DATA;
try {
  DATA = new Function(
    `${html.slice(a + START.length, b)}
     return { REPO, STRUCTURES, EDGES, EXTERNALS, TRACE,
              STACK: typeof STACK === "undefined" ? null : STACK };`
  )();
} catch (e) {
  console.error("✗ la section DATA ne s'évalue pas :", e.message);
  process.exit(2);
}

const { REPO, STRUCTURES: S, EDGES: E, EXTERNALS: X, TRACE: T, STACK: K } = DATA;
const errors = [], warns = [];
const err = m => errors.push(m);
const warn = m => warns.push(m);

// --- structure de la page -------------------------------------------------
// Trois pannes vécues : un <script> non fermé n'est jamais exécuté par le
// parser, un charset manquant sort du mojibake dès que la page est servie en
// HTTP, et une ressource externe est bloquée par la CSP de l'artifact.
const open = (html.match(/<script\b/g) || []).length;
const close = (html.match(/<\/script>/g) || []).length;
if (open !== close) err(`${open} <script> pour ${close} </script> — un script non fermé n'est jamais exécuté`);
if (!/<meta\s+charset=/i.test(html)) err("<meta charset=\"utf-8\"> manquant — mojibake garanti en HTTP");
if (!/<title>[^<]+<\/title>/i.test(html)) err("<title> manquant — l'artifact n'aura pas de nom");
for (const m of html.matchAll(/(?:src|href)\s*=\s*["'](https?:\/\/[^"']+)/gi))
  if (!/^https?:\/\/(github\.com|gitlab\.com)/.test(m[1]))
    warn(`ressource externe (bloquée par la CSP de l'artifact) : ${m[1].slice(0, 60)}`);
if (/@import\s+url/i.test(html)) warn("@import url(...) — bloqué par la CSP de l'artifact");
// un getElementById sur un id absent du HTML fait planter tout le script
const declared = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]));
for (const m of html.matchAll(/getElementById\("([^"]+)"\)(\s*\.\w)/g))
  if (!declared.has(m[1]))
    err(`getElementById("${m[1]}") sans id="${m[1]}" dans le HTML — le script casse au chargement`);

// --- identité -------------------------------------------------------------
const ids = new Set(), codes = new Map();
for (const s of S) {
  if (!s.id) err(`structure sans id : ${JSON.stringify(s).slice(0, 60)}`);
  if (ids.has(s.id)) err(`id dupliqué : ${s.id}`);
  ids.add(s.id);
  if (!s.code || s.code.length !== 2) err(`${s.id} : code doit faire 2 caractères (reçu "${s.code}")`);
  if (codes.has(s.code)) err(`code "${s.code}" partagé par ${codes.get(s.code)} et ${s.id}`);
  codes.set(s.code, s.id);
  for (const k of ["name", "group", "loc", "what", "how"])
    if (!s[k]) err(`${s.id} : champ "${k}" manquant`);
  if (![s.gx, s.gy, s.w, s.d, s.h].every(Number.isFinite))
    err(`${s.id} : géométrie incomplète (gx/gy/w/d/h)`);
  if (!s.mod && !s.slab && !["tests", "ci"].includes(s.id))
    warn(`${s.id} : pas de mod:[…] — atlas_scan --inject ne pourra pas le rafraîchir`);
  for (const c of s.children || []) {
    if (!c.code || !c.name) err(`${s.id} : enfant sans code/name`);
    if (!Number.isFinite(c.h)) err(`${s.id}/${c.code} : hauteur manquante`);
  }
}

// --- géométrie : empreintes disjointes ------------------------------------
for (let i = 0; i < S.length; i++)
  for (let j = i + 1; j < S.length; j++) {
    const p = S[i], q = S[j];
    const hit = p.gx < q.gx + q.w && q.gx < p.gx + p.w &&
                p.gy < q.gy + q.d && q.gy < p.gy + p.d;
    if (hit) err(`empreintes qui se chevauchent : ${p.id} et ${q.id}`);
  }

// --- graphe ---------------------------------------------------------------
const seen = new Set();
for (const e of E) {
  if (!ids.has(e.f)) err(`arête vers un id inconnu : f="${e.f}"`);
  if (!ids.has(e.t)) err(`arête vers un id inconnu : t="${e.t}"`);
  if (e.f === e.t) err(`auto-arête sur ${e.f}`);
  const k = `${e.f}>${e.t}`;
  if (seen.has(k)) err(`arête dupliquée : ${k}`);
  seen.add(k);
  if (!e.pay) warn(`arête ${k} sans "pay" — le survol d'un point n'affichera rien`);
  if (e.src && !["import", "runtime", "design"].includes(e.src))
    err(`arête ${k} : src doit valoir "import", "runtime" ou "design" (reçu "${e.src}")`);
  if (!e.src) warn(`arête ${k} sans "src" — provenance non déclarée`);
}
const orphans = [...ids].filter(id => !E.some(e => e.f === id || e.t === id));
if (orphans.length) warn(`blocs sans aucune arête : ${orphans.join(", ")}`);

// --- trace ----------------------------------------------------------------
if (!Array.isArray(T) || !T.length) err("TRACE vide");
T.forEach(([id, line], i) => {
  if (!ids.has(id)) err(`TRACE[${i}] pointe sur un id inconnu : ${id}`);
  if (!line || line.length < 20) warn(`TRACE[${i}] : phrase trop courte pour expliquer l'étape`);
});
if (T.length < 10 || T.length > 14) warn(`TRACE fait ${T.length} étapes (viser 10 à 14)`);

// --- externals ------------------------------------------------------------
for (const x of X) {
  if (!ids.has(x.at)) err(`external "${x.label}" ancré sur un id inconnu : ${x.at}`);
  if (Math.abs(x.dx) < 120) warn(`external "${x.label}" : |dx|=${Math.abs(x.dx)} — l'étiquette va tomber dans le dessin`);
}

// --- cohérence hauteur / LOC ---------------------------------------------
const num = s => {
  const m = String(s.loc).replace(/\s/g, "").match(/^([\d.]+)(k?)/);
  return m ? parseFloat(m[1]) * (m[2] ? 1000 : 1) : null;
};
// `REPO.hScale` — "sqrt" quand l'écart entre le plus gros et le plus petit bloc
// écraserait tout sur une échelle linéaire (300k lignes contre 257).
const scale = REPO?.hScale === "sqrt" ? n => Math.sqrt(n) / 25 : n => n / 1000;
for (const s of S) {
  const n = num(s);
  if (n && !s.slab && s.h > 0.4) {
    const want = scale(n);
    if (want > 0.5 && (s.h > want * 2.5 || s.h < want / 2.5))
      warn(`${s.id} : hauteur ${s.h} contre ~${want.toFixed(1)} attendu pour ${s.loc} lignes`);
  }
}

// --- dossier technique ----------------------------------------------------
// `STACK` alimente les vues Architecture et Stack. Il sort d'atlas_scan.py
// --stack-for, donc ses id de blocs viennent de l'atlas lui-même : un id
// inconnu ici veut dire que le STACK a été généré contre une autre version.
if (!K) {
  warn("pas de bloc STACK — les vues Architecture et Stack seront vides "
     + "(atlas_scan.py --stack-for atlas.html)");
} else {
  if (!K.manifests?.length) err("STACK.manifests vide — aucun manifeste lu");
  for (const [key, list] of Object.entries(K.edgeSyms || {})) {
    const [f, t] = key.split(">");
    if (!ids.has(f) || !ids.has(t)) err(`STACK.edgeSyms["${key}"] pointe hors des blocs`);
    if (!Array.isArray(list) || !list.length) warn(`STACK.edgeSyms["${key}"] vide`);
  }
  const refs = [...(K.manifests || []).flatMap(m => m.deps || []),
                ...(K.undeclared || [])].flatMap(d => d.by || []);
  const bad = [...new Set(refs)].filter(id => !ids.has(id));
  if (bad.length) err(`STACK renvoie à des blocs inconnus : ${bad.join(", ")}`);
  const mapped = new Set(refs);
  const unmapped = S.filter(s => s.mod && !mapped.has(s.id) && !s.slab).map(s => s.id);
  if (unmapped.length > S.length * 0.6)
    warn(`${unmapped.length} blocs sur ${S.length} n'apparaissent dans aucune dépendance `
       + `— vérifier que le STACK a été généré contre cet atlas`);
  const langs = Object.keys(K.langs || {});
  if (!langs.length) warn("STACK.langs vide — la barre des langages sera vide");
}

// --- provenance : confronter les arêtes au graphe mesuré ------------------
// `--scan scan.json` (sortie d'atlas_scan.py) : une arête déclarée "import"
// doit exister dans le graphe réel, sinon c'est une relation devinée.
const scanArg = process.argv.indexOf("--scan");
if (scanArg > 0 && process.argv[scanArg + 1]) {
  const scan = JSON.parse(readFileSync(process.argv[scanArg + 1], "utf8"));
  const byPath = Object.fromEntries(
    Object.entries(scan.modules).map(([name, m]) => [m.path, name]));
  const graph = new Map(scan.edges.map(e => [`${e.f}>${e.t}`, e.src]));
  // `mod` accepte un nom, un chemin, ou un dossier (suffixe "/")
  const modsOf = id => {
    const mod = byId(id)?.mod || [];
    const drop = mod.filter(p => p.startsWith("!")).map(p => p.slice(1));
    const out = mod.filter(p => !p.startsWith("!")).flatMap(p =>
      p.endsWith("/") ? Object.entries(byPath).filter(([q]) => q.startsWith(p)).map(([q, n]) => [q, n])
                      : [[p, byPath[p] ?? (scan.modules[p] ? p : null)]]);
    return out.filter(([q, n]) => n && !drop.some(d => q === d || q.startsWith(d))).map(([, n]) => n);
  };
  const link = (f, t) => {
    let best = null;
    for (const a of modsOf(f)) for (const b of modsOf(t)) {
      const s = graph.get(`${a}>${b}`);
      if (s === "import") return "import";
      if (s) best = s;
    }
    return best;
  };
  let checked = 0;
  for (const e of E) {
    const f = byId(e.f), t = byId(e.t);
    if (!f?.mod || !t?.mod) continue;         // dalles, CI : rien à confronter
    checked++;
    const real = link(e.f, e.t);
    if (e.src === "import" && real !== "import")
      err(`arête ${e.f}>${e.t} déclarée "import" mais absente du graphe mesuré (${real ?? "aucune trace"})`);
    if (e.src !== "import" && real === "import")
      warn(`arête ${e.f}>${e.t} déclarée "${e.src}" alors qu'un import réel existe`);
    if (e.mutual && link(e.t, e.f) !== "import")
      err(`arête ${e.f}>${e.t} marquée mutual:1 mais le retour n'existe pas dans le graphe mesuré`);
  }
  // cycles mesurés qu'aucune arête ne porte — information perdue, pas une faute
  const drawn = new Set(E.filter(e => e.mutual).map(e => [e.f, e.t].sort().join("|")));
  let missed = 0;
  for (let i = 0; i < S.length; i++)
    for (let j = i + 1; j < S.length; j++) {
      const [p, q] = [S[i].id, S[j].id];
      if (!S[i].mod || !S[j].mod) continue;
      if (link(p, q) === "import" && link(q, p) === "import" && !drawn.has([p, q].sort().join("|")))
        missed++;
    }
  if (missed) warn(`${missed} paire(s) mutuelle(s) mesurée(s) qu'aucune arête ne montre`);
  console.log(`  · ${checked} arêtes confrontées à ${process.argv[scanArg + 1]}`);
}
function byId(id) { return S.find(s => s.id === id); }

// --- rapport --------------------------------------------------------------
const stat = `${S.length} blocs · ${E.length} arêtes · ${T.length} étapes de trace · ${X.length} externals`;
console.log(`${REPO?.name ?? file} — ${stat}`);
for (const w of warns) console.log(`  ! ${w}`);
for (const e of errors) console.log(`  ✗ ${e}`);
console.log(errors.length ? `\n${errors.length} erreur(s), ${warns.length} avertissement(s)`
                          : `\nok — ${warns.length} avertissement(s)`);
process.exit(errors.length ? 1 : 0);
