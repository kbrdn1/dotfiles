#!/usr/bin/env bun
// bun ~/.config/herdr-app/mods/kt-keys/i18n-audit.mjs <mod folder>…: the i18n gate (I18N.md). For each mod:
//   1. visible text still written in the code (a heuristic): file:line and the text;
//   2. strings.js: a key in fr missing in en, a { one, other } missing a form, {vars} that differ;
//   3. t("key") calls whose key strings.js lacks (in fr).
// Exit 1 when anything is listed, 0 when the mod is clean.
//
// A literal that must keep its words says so on its line, or on a comment line just above:
//   // i18n: agent   sent to an agent (tasks, hc send): stays in French
//   // i18n: tech    a command, an id, a path, a proper noun, a key name
//   // i18n: agent file   (a line of its own) the whole file is a prompt: none of it is read
// Not read: strings.js, *.check.mjs, *.test.*, the helpers kt-keys holds (i18n.js, bus.js, motion.js…,
// shared byte for byte), gpui-kit.d.ts. Heuristic: a literal is text when it has accents, or two
// words, or one word in a UI place (.child, .tooltip, title:, label:, body:…); it isn't when a
// technical call or key holds it (.id, exec, run, shared, t, ===, import…).

import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join, basename, resolve, dirname } from "node:path";

const KEYS_DIR = dirname(new URL(import.meta.url).pathname);
const SHARED = new Set(readdirSync(KEYS_DIR).filter((f) => f.endsWith(".js") && f !== "main.js"));

// --- a small JS scanner: string and template literals with their line and the code before them.
const REGEX_AFTER = /(^|[(,=:[!&|?{};+\-*%<>~^]|\breturn|\btypeof|\bcase|\bdo|\belse|\bin|\bof|\byield|\bawait)\s*$/;

function scan(src, lineBase = 1, out = [], codeBefore = "") {
  let i = 0;
  let line = lineBase;
  let code = codeBefore;
  const n = src.length;
  const push = (text, at) => out.push({ text, line: at, before: code.slice(-160) });
  while (i < n) {
    const c = src[i];
    if (c === "\n") { line++; code += c; i++; continue; }
    if (c === "/" && src[i + 1] === "/") { const j = src.indexOf("\n", i); i = j < 0 ? n : j; continue; }
    if (c === "/" && src[i + 1] === "*") {
      const j = src.indexOf("*/", i + 2);
      const end = j < 0 ? n : j + 2;
      line += (src.slice(i, end).match(/\n/g) ?? []).length;
      i = end;
      continue;
    }
    if (c === '"' || c === "'") {
      let j = i + 1;
      let s = "";
      while (j < n && src[j] !== c && src[j] !== "\n") {
        if (src[j] === "\\") { s += src[j + 1] === "n" ? "\n" : src[j + 1]; j += 2; } else s += src[j++];
      }
      push(s, line);
      code += '""';
      // An unclosed quote (a ' in a regex taken for a division) stops at the line's end: the
      // newline is left for the loop to count.
      i = src[j] === "\n" ? j : j + 1;
      continue;
    }
    if (c === "`") {
      const start = line;
      let j = i + 1;
      let s = "";
      while (j < n && src[j] !== "`") {
        if (src[j] === "\\") { s += src[j + 1]; j += 2; continue; }
        if (src[j] === "$" && src[j + 1] === "{") {
          const end = exprEnd(src, j + 2);
          // The expression's own literals, scanned with this template's code before them.
          scan(src.slice(j + 2, end), line, out, code + "`");
          line += (src.slice(j, end).match(/\n/g) ?? []).length;
          s += "{}";
          j = end + 1;
          continue;
        }
        if (src[j] === "\n") line++;
        s += src[j++];
      }
      push(s, start);
      code += '""';
      i = j + 1;
      continue;
    }
    if (c === "/" && REGEX_AFTER.test(code)) {
      let j = i + 1;
      let cls = false;
      while (j < n && src[j] !== "\n") {
        if (src[j] === "\\") { j += 2; continue; }
        if (src[j] === "[") cls = true;
        else if (src[j] === "]") cls = false;
        else if (src[j] === "/" && !cls) break;
        j++;
      }
      if (src[j] !== "\n") j++;
      while (/[a-z]/i.test(src[j] ?? "")) j++;
      code += "/re/";
      i = j;
      continue;
    }
    code += c;
    i++;
  }
  return out;
}

// Where a template's ${ … } ends: its matching }, past nested strings and templates.
function exprEnd(src, i) {
  let depth = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === '"' || c === "'") { i++; while (i < src.length && src[i] !== c) i += src[i] === "\\" ? 2 : 1; }
    else if (c === "`") { i++; while (i < src.length && src[i] !== "`") { if (src[i] === "\\") i++; else if (src[i] === "$" && src[i + 1] === "{") i = exprEnd(src, i + 2); i++; } }
    else if (c === "{") depth++;
    else if (c === "}") { if (depth === 0) return i; depth--; }
    i++;
  }
  return i;
}

// --- what is text.
const UI = /(\.child|\.children|\.tooltip|\.placeholder|\bnotify|\bhint|\beyebrow|\bkbd|\bpill|\bbadge|\bchip|\bsection|\btag)\s*\(\s*$|(?<![.\w$])(label|title|body|detail|placeholder|hint|what|empty|message|tip|tooltip|text|help|note|intro|reason|error|confirm|cancel|cta|more|prompt|desc|description|caption|heading|subtitle|eyebrow|summary|status|where)\s*:\s*$/;
const TECH = /(\.id|font_family|\bsvg|\bimage|\bI|\brun|\bshared|\bsetShared|\bexec|\bhc|console\.\w+|\.transition|\.spring|\.loop|\.frames|localStorage\.\w+|\bbump|\bgitTopics|startsWith|endsWith|includes|indexOf|lastIndexOf|split|join|replace|replaceAll|match|matchAll|test|\bt|\bown|\bRegExp|readTextFile|writeTextFile|watchFolder|openOverlay|closeOverlay|parse|stringify|getItem|setItem|removeItem|has|get|set|delete|add|padStart|padEnd|refreshOn|on_mouse_down|on_key_down|key_context|from|\bimport|nextCommand|knownAgents|Symbol|querySelector|\btr)\s*\(\s*$|(\bimport|\bfrom|===|!==|==|!=|\bcase|\bin|\btypeof)\s*$|(?<![.\w$])(key|kind|mod|icon|level|tone|argv|args|cwd|command|id|on|section|layout|stack|child|program|app|machine|state|direction|place|mode|type|lang|easing|font|family|path|file|folder|repo|branch|url|href|ref|sha|scope|event|topic|tint|color|bg|cursor|role|language|sound|address|terminal|pane|space|overlay|frame)\s*:\s*$/;
// Words a key or a column may show as is.
const KEYWORDS = /^(esc|enter|tab|space|shift|ctrl|cmd|alt|opt|option|return|backspace|delete|up|down|left|right|home|end|pageup|pagedown|ok|PR|MCP|CLI|URL|API|JSON|YAML|HEAD|INSERT|NORMAL|VISUAL|git|gh|gwm|hc|zed|claude|codex|herdr)$/i;

function isText(lit) {
  const s = lit.text.replace(/\{\}/g, " ").trim();
  if (!/[A-Za-zÀ-ÿ]{2,}/.test(s) || looksTech(lit.text.replace(/\{\}/g, "x").trim())) return false;
  // The innermost marker that still holds the literal wins: a UI place, or a technical call or key.
  const b = lit.before.replace(/\s+/g, " ");
  const ui = lastMatch(b, UI);
  const tech = lastMatch(b, TECH);
  const uiHolds = holds(b, ui, true);
  if (holds(b, tech, false) && !(uiHolds && ui > tech)) return false;
  const accented = /[À-ÿ]/.test(s);
  const words = /[A-Za-zÀ-ÿ]{2,}[^A-Za-zÀ-ÿ\n]+[A-Za-zÀ-ÿ]{2,}/.test(s) && /\s/.test(s);
  if (accented || words) return "prose";
  // One word: only right inside its UI place, as its own argument or value (`.child("Fermer")`,
  // `label: x ? "Oui" : "Non"`, `.child(q ? q + (on ? "▏" : "") : "Filtrer")`, `hint("/", "filtrer")`),
  // not inside another call or a list there (`.child(row("status", …))`, `.line_height("16px")`).
  return uiHolds && !/[([{]/.test(strip(b.slice(ui))) && !KEYWORDS.test(s) ? "word" : false;
}

// `s` without its balanced (…) […] {…} groups.
function strip(s) {
  for (let prev; prev !== s; ) {
    prev = s;
    s = s.replace(/\([^()]*\)|\[[^[\]]*\]|\{[^{}]*\}/g, "");
  }
  return s;
}

// Whether the marker ending at `at` in `b` still holds what follows it: balanced (…) […] {…} aside,
// nothing closes it, and after a key or an operator (not a call's "(") no comma or ";" ends it. A
// technical one also ends at a ternary or a logical operator (`x === "a" ? "Ouvrir" : …`); a UI one
// goes through them (`label: on ? "Oui" : "Non"`).
function holds(b, at, ui) {
  if (at < 0) return false;
  const call = /\(\s*$/.test(b.slice(0, at));
  const rest = strip(b.slice(at));
  if (/[)\]};]/.test(rest)) return false;
  if (!call && /,/.test(rest)) return false;
  if (!ui && !call && /[?:]|\|\||&&/.test(rest)) return false;
  return true;
}

// Where the last marker matched by `re` (anchored at the end) ends in `b`, within its last 140
// characters; -1 without one.
function lastMatch(b, re) {
  for (let k = b.length; k > 0 && b.length - k <= 140; k--) if (re.test(b.slice(0, k))) return k;
  return -1;
}

// A command line, a path, an URL, a selector, a CSS-like value, an identifier: not prose.
function looksTech(s) {
  if (/^(https?:|mailto:|file:|~?\/|\.{1,2}\/)/.test(s)) return true;
  if (/(^|\s)--?[a-z][\w-]*/.test(s) && !/[À-ÿ]/.test(s)) return true;
  if (/\$\(|&&|\|\||=>|;\s*\w+=|\bprintf\b|\becho\b/.test(s)) return true;
  if (/^(git|gh|gwm|hc|herdr-app|claude|codex|defaults|sh|bash|zsh|open|zed|bun|npm|npx|node|cat|ls|rg|grep|jq|sed|awk|curl|mv|cp|ln|mkdir|rm|mktemp)\s/.test(s) && !/[À-ÿ]/.test(s)) return true;
  if (/^[\w.-]+\/[\w.\/-]+$/.test(s)) return true;
  // An identifier, a template's ${…} (scanned as {}) standing for one of its parts: "kts-md-{}#{}".
  if (/^[a-z0-9_]+([-_.:/@#][a-z0-9_]+)+$/i.test(s.replace(/\{\}/g, "x"))) return true;
  if (/^%[a-z(]|%\(\w+\)|^\w+=/.test(s)) return true; // git --format, env
  if (/\\[sbdwSBDW]|\(\?[:=!<]|^\^/.test(s)) return true; // a regex's source
  if (/^#[0-9a-f]{3,8}$/i.test(s) || /^[\dx.]*(px|%|ms|em|rem)$/.test(s)) return true; // a color, a size
  if (/^(Monaspace|Geist|JetBrains|Fira|SF Mono|Menlo)\b/.test(s)) return true; // a font
  // Keys: "tab / shift-tab", "enter / space / l", "ctrl-n / ctrl-p".
  if (s.split(/\s+/).every((w) => w === "/" || w.length === 1 || KEYWORDS.test(w) || /^(ctrl|cmd|shift|alt|opt)[-+]\S+$/.test(w))) return true;
  return false;
}

function marked(lines, line) {
  const own = lines[line - 1] ?? "";
  const above = lines[line - 2] ?? "";
  return /\/\/\s*i18n:\s*(agent|tech)\b/.test(own) || /^\s*\/\/\s*i18n:\s*(agent|tech)\b/.test(above);
}

// --- strings.js.
const vars = (v) => new Set([...(typeof v === "object" ? Object.values(v).join(" ") : String(v)).matchAll(/\{(\w+)\}/g)].map((m) => m[1]));
const same = (a, b) => a.size === b.size && [...a].every((x) => b.has(x));

// A dictionary: the mod's strings.js, or a shared file's own <file>.strings.js (form.strings.js
// for form.js), copied with it. -> its fr keys, null without the file.
const DICT = /(^|\.)strings\.js$/;
async function auditStrings(dir, file, issues) {
  const p = join(dir, file);
  if (!existsSync(p)) return null;
  const dict = (await import(resolve(p))).default ?? {};
  const fr = dict.fr ?? {};
  const en = dict.en ?? {};
  for (const [k, v] of Object.entries(fr)) {
    if (typeof v === "object" && (v.one == null || v.other == null)) issues.push(`${file}  fr "${k}": { one, other } incomplete`);
    if (!(k in en)) { issues.push(`${file}  en: missing "${k}"`); continue; }
    const e = en[k];
    if (typeof e === "object" && (e.one == null || e.other == null)) issues.push(`${file}  en "${k}": { one, other } incomplete`);
    if ((typeof v === "object") !== (typeof e === "object")) issues.push(`${file}  "${k}": plural in one language only`);
    if (!same(vars(v), vars(e))) issues.push(`${file}  "${k}": fr {${[...vars(v)]}} ≠ en {${[...vars(e)]}}`);
  }
  for (const k of Object.keys(en)) if (!(k in fr)) issues.push(`${file}  en "${k}": not in fr`);
  return fr;
}

async function audit(dir) {
  const name = basename(resolve(dir));
  const issues = [];
  const dicts = {};
  for (const f of readdirSync(dir).filter((f) => DICT.test(f)).sort()) dicts[f] = await auditStrings(dir, f, issues);
  const files = readdirSync(dir).filter((f) => f.endsWith(".js") && !DICT.test(f) && !/\.(check|test)\./.test(f)
    && !(name !== "kt-keys" && SHARED.has(f)) && !(name === "kt-keys" && f !== "main.js"));
  for (const f of files.sort()) {
    const src = readFileSync(join(dir, f), "utf8");
    // A whole file sent to an agent (a prompt builder) says so once: `// i18n: agent file`.
    if (/^\/\/ i18n: agent file\b/m.test(src)) continue;
    const lines = src.split("\n");
    for (const lit of scan(src)) {
      if (process.env.I18N_DEBUG) {
        const b = lit.before.replace(/\s+/g, " ");
        console.log(`${f}:${lit.line} ${isText(lit) ? "TEXT" : "    "} ${JSON.stringify(lit.text)} ui=${lastMatch(b, UI)} tech=${lastMatch(b, TECH)} techText=${looksTech(lit.text.replace(/\{\}/g, "x").trim())} ← ${JSON.stringify(b.slice(-60))}`);
      }
      const kind = isText(lit);
      if (!kind || marked(lines, lit.line)) continue;
      // A line whose words already go through tr(): its single words are ids, icons, keys.
      if (kind === "word" && /\btr\(/.test(lines[lit.line - 1] ?? "")) continue;
      const shown = lit.text.replace(/\s+/g, " ").trim();
      issues.push(`${f}:${lit.line}  "${shown.length > 90 ? shown.slice(0, 87) + "…" : shown}"`);
    }
    // tr("key") with a key its dictionary lacks: the file's own <x>.strings.js if it imports one,
    // else the mod's strings.js.
    const own = src.match(/from\s+["']\.\/([\w.-]+\.strings\.js)["']/)?.[1];
    const dname = own ?? "strings.js";
    const fr = dicts[dname];
    for (const m of src.matchAll(/(?:^|[^\w.$])tr\(\s*(["'])([^"'`\n]+)\1/g)) {
      const at = src.slice(0, m.index + 1).split("\n").length;
      if (!fr) issues.push(`${f}:${at}  tr("${m[2]}") without ${dname}`);
      else if (!(m[2] in fr)) issues.push(`${f}:${at}  tr("${m[2]}"): not in ${dname}`);
    }
  }
  return { name, issues };
}

const dirs = process.argv.slice(2);
if (!dirs.length) {
  console.log("usage: bun i18n-audit.mjs <mod folder>…");
  process.exit(2);
}
let total = 0;
for (const d of dirs) {
  const { name, issues } = await audit(d);
  total += issues.length;
  console.log(`${name}: ${issues.length ? `${issues.length} à reprendre` : "ok"}`);
  for (const x of issues) console.log(`  ${x}`);
}
process.exit(total ? 1 : 0);
