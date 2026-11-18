// markdown.js: a Markdown document as the kt-* mods draw it (issue #43). Written once in
// mods/kt-keys/markdown.js and copied byte for byte into each mod that uses it, with
// markdown.strings.js, skeleton.js, motion.js and i18n.js beside it (a mod can't import from another
// folder): edit here, then copy, then `cmp`. Check: bun mods/kt-keys/markdown.check.mjs.
//
// Two faces, the same for every document (a README, SKILL.md, an issue's body, a note):
// - Aperçu: the frontmatter as fields (key, value), then the body cut by blocks(): its prose by
//   TextView.markdown (headings, lists, emphasis, inline code, quotes, tables, links), its fenced code
//   as blocks drawn here in Zed's colors, its GitHub alerts (> [!NOTE]…) as tinted boxes; HTML
//   comments (issue and PR templates) dropped, as GitHub does.
// - Brut: the source, in Zed's colors (~/.claude/scripts/zed-tokens.ts, lang markdown: the
//   frontmatter as YAML, the fences in their language), asked only while Brut shows, the skeleton
//   meanwhile; plain mono when zed-tokens gives nothing (no bun, past the timeout, unknown language).
//   As wide as its caller's box: a caller keeps its prose measure (max_w) for Aperçu only.
// Brut and the code blocks soft-wrap as an editor does (softLine, wrapPlan): a long line goes on under
// itself, its indent kept; nothing is cut, nothing scrolls sideways. A render has ~50 ms before the
// engine interrupts it, so one budget per render (mdBudget(), shared by the documents a mod draws):
// Brut draws by pages of what fits (‹ ›, « lignes a–b sur n »); Aperçu's code blocks go on plain past
// it, and stop only past HARD rows a render, saying so (code(), LINE, BUDGET).
// Colors are asked from render on a miss, never under checking(): every miss of one render goes in
// ONE batch (a task, after the render), cached per view by (content hash, language, light / dark).
// A theme flip is a miss for the other mode: Brut shows the skeleton again, then the new colors.
//
//   const md = mdState();                                   // per view; md.raw: Brut shown (sticky)
//   const doc = parse(text) | parse(text, { fields: false })   // in a task: { src, fields, segs }
//   parse(text, { meta: false })                            // no frontmatter at all (a note's later block)
//   const doc = docOf(md, text)                             // or in render, memoized by text
//   tabs(t, "kx-md-tabs", md)                               // Aperçu / Brut, their key in the tooltip
//   view(t, m, cx, md, { id, mod, doc, onLink, budget, onPage })   // the document: Aperçu or Brut
//   preview(t, cx, md, { id, mod, doc, onLink, budget, noRaw })    // Aperçu only (an issue's comment)
//   const budget = mdBudget()                               // once per render, for several documents
//   key "p" (NORMAL): md.raw = !md.raw                       // the mod's own press(), before vim
//   target(url, dir)                                        // a link: { web } | { path } | null

import { div } from "gpui-kit";
import { v_flex, h_flex, TextView } from "gpui-base";
import { exec, appHome, home, settings, checking } from "herdr";
import * as fs from "fs/promises";
import { skeleton } from "./skeleton.js";
import { enter } from "./motion.js";
import { makeT } from "./i18n.js";
import mdStrings from "./markdown.strings.js";

const tr = makeT(mdStrings);
const MONO = "Monaspace Krypton";
const CODE = "Monaspace Neon";
const alpha = (c, a) => `${String(c).slice(0, 7)}${a}`;
// What one render may spend on source lines, in units of one colored one-run line (14 to 30 µs, by the
// machine's load). Measured 2026-11-18 under herdr-app check: a call into a mod is interrupted past
// ~50 ms (a busy wait of 45 ms passes, 75 ms doesn't; init and render have one each); 800 one-color
// lines take 20 to 25 ms, 32 lines of six colors cut into words 16 to 22 ms, 2900 colored code rows
// ~28 ms. A line in one color or none is a padded text, 1 unit; a line of several colors costs LINE
// (its plan) plus its elements (wrapPlan). One BUDGET per render (~12 ms), shared by the documents a
// mod draws (mdBudget()):
// - Brut stops where it runs out and offers the next page (colors on every page);
// - Aperçu's code blocks go on plain (no colors) past it, and stop at HARD rows a render, saying so
//   (before #43, 2000 plain rows drew in 8 to 13 ms, with nothing else on the page).
const LINE = 1;
const BUDGET = 500;
const HARD = 1000;
export const mdBudget = () => ({ left: BUDGET, rows: 0 });
const CH = 7.2; // Monaspace Neon's advance at 12 px (0.6 em): an indent drawn as padding
// ponytail: a bounded LRU per view; a page showing more than KEEP colored blocks at once would ask
// again on each render. MAX_CODE per document keeps that out of reach.
const KEEP = 128;
const MAX_CODE = 40;
const TIMEOUT = 60e3; // the first call installs @pierre/highlights

// ---------- pure: the cut ----------

const FENCE = /^(\s*)(`{3,}|~{3,})(.*)$/;
const ALERT = /^ {0,3}>\s*\[!(note|tip|important|warning|caution)\]\s*$/i;
const QUOTE = /^ {0,3}>/;

/** The body cut where the mods draw their own blocks: [{ kind: "md", text } | { kind: "code", lang,
 *  text } | { kind: "alert", type, text }]. Fences: ``` or ~~~, at any indent (inside a list item);
 *  an unclosed one runs to the end, as in CommonMark. An alert: a quote whose first line is [!TYPE]. */
export function blocks(md) {
  const lines = String(md ?? "").replace(/\r\n?/g, "\n").replace(/\t/g, "    ").split("\n");
  const out = [];
  let prose = [];
  const flush = () => {
    const text = prose.join("\n").replace(/<!--[\s\S]*?-->/g, "").replace(/^\n+|\n+$/g, "");
    if (text.trim()) out.push({ kind: "md", text });
    prose = [];
  };
  for (let i = 0; i < lines.length; i++) {
    const a = !QUOTE.test(lines[i - 1] ?? "") && lines[i].match(ALERT);
    if (a) {
      const body = [];
      let j = i + 1;
      for (; j < lines.length && QUOTE.test(lines[j]); j++) body.push(lines[j].replace(/^ {0,3}>\s?/, ""));
      flush();
      out.push({ kind: "alert", type: a[1].toLowerCase(), text: body.join("\n").trim() });
      i = j - 1;
      continue;
    }
    const f = lines[i].match(FENCE);
    // A backtick fence's info string has no backtick (```a``` is inline code).
    if (!f || (f[2][0] === "`" && f[3].includes("`"))) {
      prose.push(lines[i]);
      continue;
    }
    const [, indent, fence, info] = f;
    const code = [];
    let j = i + 1;
    for (; j < lines.length; j++) {
      const m = lines[j].trim();
      if (m[0] === fence[0] && /^(`+|~+)$/.test(m) && m.length >= fence.length) break;
      code.push(lines[j].startsWith(indent) ? lines[j].slice(indent.length) : lines[j].trimStart());
    }
    flush();
    out.push({ kind: "code", lang: info.trim().split(/\s+/)[0] || "", text: code.join("\n").replace(/\n+$/, "") });
    i = j; // past the closing fence
  }
  flush();
  return out;
}

const KEYLINE = /^([^\s#:-][^:]*?)\s*:(?:\s+(.*))?$/;
// A value as read: quotes off, [a, b] as "a, b", a block scalar's indicator (> |) as nothing.
function plain(v) {
  const s = String(v ?? "").trim();
  if (/^[|>][+-]?\d*$/.test(s)) return "";
  if (/^\[.*\]$/.test(s)) return s.slice(1, -1).split(",").map(plain).filter(Boolean).join(", ");
  return /^(["']).*\1$/.test(s) ? s.slice(1, -1) : s;
}

/** The frontmatter as fields to show: { fields: [[key, value]], body }. Top-level keys only; a
 *  nested map or a list joins its lines with ", ", a folded scalar with spaces. Only YAML-looking
 *  lines count: a `---` rule followed by prose stays prose. */
export function fields(md) {
  const src = String(md ?? "");
  const lines = src.split("\n");
  const none = { fields: [], body: src };
  if (lines[0].replace(/^﻿/, "").trim() !== "---") return none;
  const end = lines.findIndex((l, i) => i > 0 && /^(---|\.\.\.)\s*$/.test(l));
  if (end < 0) return none;
  const out = [];
  for (const l of lines.slice(1, end)) {
    const s = l.trim();
    if (!s || s.startsWith("#")) continue;
    const k = !/^\s/.test(l) && KEYLINE.exec(l);
    if (k) { out.push([k[1], plain(k[2])]); continue; }
    const item = s.startsWith("- ") || s === "-";
    if (!out.length || !(/^\s/.test(l) || item)) return none;
    const f = out[out.length - 1];
    const v = item ? plain(s.slice(1)) : s;
    f[1] = !f[1] ? v : `${f[1]}${item || KEYLINE.test(s) ? ", " : " "}${v}`;
  }
  return { fields: out, body: lines.slice(end + 1).join("\n") };
}

/** FNV-1a of a string, with its length: the colors' cache key. */
export function hash(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return `${(h >>> 0).toString(16)}-${s.length}`;
}

/** A document for view(): its source (line ends, tabs and a BOM made plain: what Brut colors and
 *  shows), its frontmatter's fields (none with { fields: false }: the mod shows them itself), its
 *  body's blocks; the hashes the colors are cached by, computed here once. { meta: false }: a text
 *  that can't open on a frontmatter (a block in the middle of a note), its `---` lines kept as rules. */
export function parse(text, { fields: show = true, meta = true } = {}) {
  const src = String(text ?? "").replace(/^﻿/, "").replace(/\r\n?/g, "\n").replace(/\t/g, "    ");
  const fm = meta ? fields(src) : { fields: [], body: src };
  const segs = blocks(fm.body).map((s) => (s.kind === "code" ? { ...s, hash: hash(s.text) } : s));
  return { src, hash: hash(src), fields: show ? fm.fields : [], segs };
}

/** A source line for the soft wrap (Brut and the code blocks, as an editor's): its indent (the leading
 *  spaces, kept in front of every row the line takes) and the rest in pieces that break only after a
 *  space, each piece its spans [text, color, style]; `**gras**,` across two runs stays one piece. */
// Plain loops, split and slice: the mods' engine is an interpreter (a regex match per word and for…of
// over runs cost ~75 µs a line, measured), and a render is interrupted past ~50 ms.
export function softLine(runs) {
  let indent = "", lead = true, open = false;
  const pieces = [];
  for (let r = 0; r < runs.length; r++) {
    let s = String(runs[r][0] ?? "");
    const color = runs[r][1] ?? null, style = runs[r][2] ?? 0;
    if (lead) {
      const t = s.replace(LEAD, "");
      indent += s.slice(0, s.length - t.length);
      if (!t) continue;
      s = t;
      lead = false;
    }
    const words = s.split(" ");
    for (let k = 0; k < words.length; k++) {
      const w = k < words.length - 1 ? `${words[k]} ` : words[k];
      if (!w) continue;
      if (w === " ") {
        // One more space after a piece: onto its last span (or a span of its own, in this run's style).
        const p = pieces[pieces.length - 1], last = p[p.length - 1];
        if (last[1] === color && last[2] === style) last[0] += " ";
        else p.push([" ", color, style]);
        open = false;
        continue;
      }
      if (open) pieces[pieces.length - 1].push([w, color, style]);
      else pieces.push([[w, color, style]]);
      open = !w.endsWith(" ");
    }
  }
  return { indent, pieces };
}
const LEAD = /^ +/;
const WORDS_AT = 40; // the budget left under which a line isn't cut into words (softLine) at all
const WRAP_AT = 60; // characters: a line shorter than this rarely wraps (60 × 7.2 px = 432 px)
const MAX_WORDS = 40; // a longer line (a frontmatter description) wraps by runs: one page would hold few lines
const CHUNK = 32; // characters: words of one style drawn as one element

/** How one source line is drawn, with `left` units to spend (one colored one-run line each, ~14 µs):
 *  { indent, mode, parts, cost }.
 *  - "one": a line in one color and style, one text that wraps itself (parts: [span]); cost 1.
 *  - "words": a line of several colors longer than WRAP_AT, breaking between softLine's pieces, those
 *    of one style grouped up to CHUNK characters (parts: chunks); cost 2 + 2 a chunk (+2 a span more for
 *    a chunk of several spans: a word across runs).
 *  - "segs": its runs merged by style, each wrapping inside (parts: spans); cost 1 + a run. A short
 *    line looks the same as in words; a long one past the budget gets rows a little ragged.
 *  - "mono": past the budget, plain, one text that wraps itself; cost 1.
 *  The indent is drawn as padding: every row the line takes starts under its first character. The
 *  common line (one style) costs a replace and a slice; words only while the budget allows. */
export function wrapPlan(runs, left = Infinity) {
  // The indent: the leading spaces, across runs (a run of spaces alone, then the line's first word).
  let indent = "", r = 0, first = "";
  for (; r < runs.length; r++) {
    const s = String(runs[r][0] ?? "");
    first = s.replace(LEAD, "");
    indent += s.slice(0, s.length - first.length);
    if (first) break;
  }
  if (r >= runs.length) return { indent, mode: "one", parts: [[" ", null, 0]], cost: 1 };
  // The rest, its runs merged by style.
  const segs = [[first, runs[r][1] ?? null, runs[r][2] ?? 0]];
  for (let k = r + 1; k < runs.length; k++) {
    const last = segs[segs.length - 1], c = runs[k][1] ?? null, st = runs[k][2] ?? 0;
    if (last[1] === c && last[2] === st) last[0] += String(runs[k][0] ?? "");
    else segs.push([String(runs[k][0] ?? ""), c, st]);
  }
  if (segs.length === 1) return { indent, mode: "one", parts: segs, cost: 1 };
  // Words only for a line long enough to wrap (a shorter one looks the same in runs, for less): a word
  // piece costs twice a run (measured), plus softLine's cut.
  let len = 0;
  for (let k = 0; k < segs.length; k++) len += segs[k][0].length;
  if (len > WRAP_AT && left > WORDS_AT) {
    // Words of one style side by side go together up to CHUNK characters: a break every few words
    // (a row ends at most CHUNK short), a third of the elements of one per word.
    const chunks = [];
    for (const p of softLine(runs).pieces) {
      const last = chunks[chunks.length - 1];
      if (p.length === 1 && last?.length === 1 && last[0][1] === p[0][1] && last[0][2] === p[0][2] && last[0][0].length + p[0][0].length <= CHUNK) last[0][0] += p[0][0];
      else chunks.push(p);
    }
    let words = 2;
    for (let k = 0; k < chunks.length; k++) words += chunks[k].length > 1 ? 2 * chunks[k].length + 2 : 2;
    if (words <= left && chunks.length <= MAX_WORDS) return { indent, mode: "words", parts: chunks, cost: words };
  }
  if (1 + segs.length <= left) return { indent, mode: "segs", parts: segs, cost: 1 + segs.length };
  let text = "";
  for (let k = 0; k < segs.length; k++) text += segs[k][0];
  return { indent, mode: "mono", parts: [[text, null, 0]], cost: 1 };
}

// zed-tokens' names for a fence's info string; null: draw it plain (no info, nothing to ask).
const ALIAS = { console: "shellsession", luau: "lua" };
export const langFor = (info) => {
  const l = String(info ?? "").trim().toLowerCase().replace(/^\{?\.?/, "").replace(/[},].*$/, "");
  return l ? ALIAS[l] ?? l : null;
};

/** A link of the document: { web } (http, mailto), { path } (a file, relative to `dir`), or null
 *  (an anchor alone, another scheme, a relative path without `dir`). */
export function target(url, dir) {
  if (/^(https?|mailto):/i.test(url)) return { web: url };
  let raw = String(url ?? "").replace(/^file:\/\//i, "").replace(/[?#].*$/, "");
  try { raw = decodeURI(raw); } catch { /* as written */ }
  if (!raw || /^[a-z][\w+.-]*:/i.test(raw) || (!raw.startsWith("/") && !dir)) return null;
  const parts = [];
  for (const p of (raw.startsWith("/") ? raw : `${dir}/${raw}`).split("/")) {
    if (p === "..") parts.pop();
    else if (p && p !== ".") parts.push(p);
  }
  return { path: `/${parts.join("/")}` };
}

// ---------- state ----------

// raw: Brut shown; pages: Brut's page starts per document; colors / busy / queue: colorsOf's; docs:
// docOf's; seen / fade / n: view()'s fade
// on a switch (the face each document was last drawn in, the fade's id for those that switched).
export const mdState = () => ({ raw: false, colors: new Map(), busy: new Set(), queue: [], docs: new Map(), seen: new Map(), fade: new Map(), n: 0, pages: new Map() });

// A bounded map, least recently used out first.
function remember(map, k, v) {
  map.delete(k);
  map.set(k, v);
  if (map.size > KEEP) map.delete(map.keys().next().value);
  return v;
}

/** parse(text, opts), memoized per view: for documents that live as text in the mod (a body from GitHub). */
export function docOf(st, text, opts) {
  const k = `${opts?.fields === false ? 0 : 1}${opts?.meta === false ? 0 : 1}${text ?? ""}`;
  return st.docs.has(k) ? remember(st.docs, k, st.docs.get(k)) : remember(st.docs, k, parse(text, opts));
}

// ---------- colors (zed-tokens.ts) ----------

// Absolute: the mods' PATH hasn't the nix profile.
const ZED = () => [`${home()}/.nix-profile/bin/bun`, `${home()}/.claude/scripts/zed-tokens.ts`];

// One batch: { key: lines | null }, or null when the script failed. The script reads stdin and exec has
// none: the batch goes through a file under the app home (fs writes nothing outside it), its answer too
// (exec's stdout is capped); both removed at once. `md-` apart from diffview's blob files there.
async function zed(mod, mode, items) {
  const dir = `${appHome()}/data/${mod}/tokens`;
  await fs.mkdir(dir, { recursive: true }).catch(() => {});
  const tag = `md-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const req = `${dir}/${tag}-req.json`, out = `${dir}/${tag}-out.json`;
  try {
    await fs.writeFile(req, JSON.stringify({ mode, items: items.map(({ key, lang, text }) => ({ id: key, lang, text })) }));
    const r = await exec("sh", ["-c", '"$1" "$2" --batch < "$3" > "$4"', "sh", ...ZED(), req, out], { timeout: TIMEOUT });
    if (r.code !== 0) return null;
    const files = JSON.parse(await fs.readFile(out, "utf8")).files ?? {};
    return Object.fromEntries(items.map(({ key }) => [key, Array.isArray(files[key]?.lines) ? files[key].lines : null]));
  } finally {
    await fs.unlink(req).catch(() => {});
    await fs.unlink(out).catch(() => {});
  }
}

/** `text`'s colors in `lang` for the appearance now: lines of runs ([text, color, style]), null (none:
 *  plain mono) or undefined (asked, not back yet). A miss joins the render's batch. `h`: hash(text),
 *  when parse() has it. */
export function colorsOf(st, cx, mod, text, lang, h) {
  if (!lang) return null;
  const mode = settings()?.dark === false ? "light" : "dark";
  const key = `${mode}:${lang}:${h ?? hash(text)}`;
  if (st.colors.has(key)) return remember(st.colors, key, st.colors.get(key));
  if (checking()) return null;
  if (st.busy.has(key)) return undefined;
  st.busy.add(key);
  st.queue.push({ key, lang, text, mode });
  if (st.queue.length === 1) cx.spawn(async (cx) => {
    await null; // after the render: its other misses are queued by then
    const batch = st.queue.splice(0);
    const modes = [...new Set(batch.map((x) => x.mode))];
    for (const md of modes) {
      const items = batch.filter((x) => x.mode === md);
      const got = await zed(mod, md, items).catch(() => null);
      for (const { key: k } of items) { remember(st.colors, k, got?.[k] ?? null); st.busy.delete(k); }
    }
    cx.notify();
  });
  return undefined;
}

// ---------- drawing ----------

// A span of code: its color and style (1 italic, 2 bold). As few calls as can be: each one costs (the
// render's ~50 ms). `el`: a flex item gets min_w(0), so a word wider than the box wraps, never cut.
function span([text, color, style], el = div()) {
  if (color) el = el.text_color(color);
  if (style & 1) el = el.italic();
  if (style & 2) el = el.font_weight(700);
  return el.child(text);
}

// One source line as wrapPlan drew it up, soft-wrapped as an editor does: its indent as padding (every
// row it takes starts under its first character), its pieces or runs breaking between them. A row of
// the column stretches to its width by itself.
function softRow(p) {
  const el = p.mode === "one" || p.mode === "mono" ? span(p.parts[0], p.indent ? div().pl(p.indent.length * CH) : div())
    : (p.indent ? h_flex().pl(p.indent.length * CH) : h_flex()).flex_wrap().children(p.mode === "segs" ? p.parts.map((s) => span(s, div().min_w(0)))
      : p.parts.map((g) => (g.length > 1 ? h_flex().min_w(0).children(g.map((s) => span(s))) : span(g[0], div().min_w(0)))));
  return el;
}

/** Source lines from `from`, soft-wrapped, in Zed's colors while `budget` (mdBudget()) lasts: { el, to },
 *  `to` the first line not drawn (one at least is). `page` (Brut): stop where the budget runs out.
 *  Else (a code block): go on plain past it, up to HARD rows a render. A line in one color or none is
 *  a padded text with no plan (the common line, as cheap as before #43). */
function code(t, rows, lines, budget, from = 0, page = false) {
  const kids = [];
  let i = from;
  for (; i < rows.length; i++) {
    const rich = budget.left > 0;
    if (i > from && (page ? !rich : budget.rows >= HARD)) break;
    budget.rows++;
    const runs = rich ? lines?.[i] : null;
    if (!runs || runs.length <= 1) {
      const s = runs?.length ? String(runs[0][0] ?? "") : rows[i];
      const body = s.trimStart(), n = s.length - body.length;
      kids.push(span([body || " ", runs?.[0]?.[1] ?? null, runs?.[0]?.[2] ?? 0], n ? div().pl(n * CH) : div()));
      budget.left -= 1;
      continue;
    }
    const p = wrapPlan(runs, budget.left - LINE);
    budget.left -= LINE + p.cost;
    kids.push(softRow(p));
  }
  return { el: v_flex().w_full().min_w(0).font_family(CODE).text_size(12).line_height("19px").text_color(t.foreground).children(kids), to: i };
}

const note = (t, text) => div().font_family(MONO).text_size(10.5).text_color(t.dim).child(text);

/** A fenced block: t.raised, radius 12, Monaspace Neon; its language as an eyebrow; long lines soft-wrap.
 *  Past `budget` (shared by what the render draws), its lines go on plain; past HARD rows, they stop,
 *  said (`raw`: Brut shows them, else not shown). */
export function codeBlock(t, s, lines, budget = mdBudget(), raw = true) {
  const rows = s.text.split("\n");
  const { el, to } = code(t, rows, lines, budget);
  return v_flex().flex_none().w_full().rounded(12).border(1).border_color(t.border).bg(t.raised).overflow_hidden()
    .when(Boolean(s.lang), (el) => el.child(div().px(14).pt(9).font_family(MONO).text_size(10).text_color(t.dim).child(s.lang.toUpperCase())))
    .child(div().px(14).pt(s.lang ? 6 : 12).pb(12).child(el))
    .when(to < rows.length, (el) => el.child(note(t, tr(raw ? "md.codeMore" : "md.codeCut", { n: rows.length - to })).px(14).pb(10)));
}

// Previous / next page of Brut: small chips (the tabs' look), no track_focus.
function pageChip(t, id, label, onClick) {
  return h_flex().id(id).flex_none().h(20).px(8).items_center().rounded_full().border(1).border_color(t.border)
    .hover((s) => s.bg(t.hover).text_color(t.foreground)).font_family(MONO).text_size(10.5).text_color(t.muted).cursor_pointer()
    .on_click((_e, cx) => { cx.stop_propagation(); onClick(cx); cx.notify(); })
    .child(label);
}

function prose(id, text, onLink) {
  const v = TextView.markdown(id, text).selectable(true);
  return onLink ? v.on_link_click(onLink) : v;
}

// The frontmatter: one line per key, the key as an eyebrow, the value in mono, as kt-skills' card.
function fieldsCard(t, f) {
  return v_flex().flex_none().gap(6).px(14).py(10).rounded(12).border(1).border_color(t.border)
    .children(f.map(([k, v]) => h_flex().gap(10).items_start()
      .child(div().w(130).flex_none().pt(1).truncate().font_family(MONO).text_size(11).text_color(t.muted).child(k.toUpperCase()))
      .child(div().flex_1().min_w(0).font_family(MONO).text_size(12).line_height("18px").text_color(t.foreground).child(v || "—"))));
}

// GitHub's five alerts, in the theme's tints (FILTERS.md's pale fills).
const TONE = { note: "accent", tip: "ansi2", important: "ansi5", warning: "ansi3", caution: "ansi1" };
function alertBox(t, id, s, onLink) {
  const c = t[TONE[s.type]] ?? t.accent;
  return v_flex().flex_none().gap(4).px(14).py(10).rounded(12).border(1).border_color(alpha(c, "4d")).bg(alpha(c, "14"))
    .child(div().font_family(MONO).text_size(10.5).text_color(c).child(tr(`md.alert.${s.type}`).toUpperCase()))
    .when(Boolean(s.text), (el) => el.child(prose(id, s.text, onLink)));
}

/** Aperçu alone (a comment under an issue: { noRaw: true }, it has no Brut): the fields, prose, code
 *  and alerts. `budget`: the render's (mdBudget()), when the mod draws several documents. */
export function preview(t, cx, st, { id, mod, doc, onLink, budget = mdBudget(), noRaw = false }) {
  let n = 0;
  return v_flex().flex_none().gap(14)
    .when(doc.fields.length > 0, (el) => el.child(fieldsCard(t, doc.fields)))
    .children(doc.segs.map((s, i) => (s.kind === "code"
      ? codeBlock(t, s, n++ < MAX_CODE ? colorsOf(st, cx, mod, s.text, langFor(s.lang), s.hash) : null, budget, !noRaw)
      : s.kind === "alert" ? alertBox(t, `${id}#${i}`, s, onLink)
        : prose(`${id}#${i}`, s.text, onLink))));
}

// Brut: the source in pages (code() until the render's budget runs out), the pages' starts kept per
// document (st.pages), « lignes a–b sur n » and ‹ › above and under a page when there are several;
// `onPage(cx)`: the mod brings the page's top into view (its scroll handle).
function raw(t, m, cx, st, { id, mod, doc, budget = mdBudget(), onPage }) {
  const rows = doc.src.replace(/\n+$/, "").split("\n");
  const lines = colorsOf(st, cx, mod, doc.src, "markdown", doc.hash);
  const S = skeleton(t, m);
  // As wide as the caller's box (the panel's width, no measure): it follows a resize, nothing scrolls sideways.
  const box = () => v_flex().flex_none().w_full().min_w(0).rounded(12).border(1).border_color(t.border).bg(t.raised).overflow_hidden();
  return S.swap(`${id}:src`, lines !== undefined, () => {
    let starts = st.pages.get(id) ?? [0];
    if (starts[starts.length - 1] >= rows.length) starts = [0]; // the text got shorter (a note edited)
    remember(st.pages, id, starts);
    const from = starts[starts.length - 1];
    const { el: src, to } = code(t, rows, lines, budget, from, true);
    const paged = from > 0 || to < rows.length;
    const turn = (f) => (cx) => { f(); onPage?.(cx); };
    const pager = (k) => h_flex().px(14).py(8).gap(6).items_center()
      .child(note(t, tr("md.lines", { from: from + 1, to, n: rows.length })).flex_1().min_w(0))
      .when(starts.length > 1, (el) => el.child(pageChip(t, `${id}:prev${k}`, tr("md.prev"), turn(() => starts.pop()))))
      .when(to < rows.length, (el) => el.child(pageChip(t, `${id}:next${k}`, tr("md.next"), turn(() => starts.push(to)))));
    return box()
      .when(lines === null && !checking(), (el) => el.child(note(t, tr("md.mono")).px(14).pt(9)))
      .when(paged, (el) => el.child(pager("t")))
      .child(div().px(14).py(12).child(src))
      .when(paged, (el) => el.child(pager("b")));
  }, () => box().px(14).py(12).gap(2).children([0.5, 0.9, 0.75, 0.3, 0.95, 0.6].map((w) => S.line(w, { h: 8, lh: 19 }))));
}

/** The document: Aperçu (fields, prose, code, alerts) or Brut (the source), as md.raw says, faded in
 *  on a switch. id: unique in the view, per document; mod: the folder its colors' batches go under. */
export function view(t, m, cx, st, o) {
  const face = st.raw ? "raw" : "pv";
  const was = st.seen.get(o.id);
  remember(st.seen, o.id, face);
  if (was && was !== face) remember(st.fade, o.id, { id: `${o.id}:${face}:${++st.n}`, face });
  // The fade (ANIMATIONS.md 2) only for a switch on a document already drawn, and while it stays
  // drawn: its first draw is faded by the caller (a swap, a detail's enter) and opacities multiply.
  const f = st.fade.get(o.id);
  const fading = Boolean(f && f.face === face && (was !== face || m?.used?.has(f.id)));
  if (f && !fading) st.fade.delete(o.id);
  // A box of its own: raw()'s swap gives ids to what it returns.
  const box = v_flex().flex_none().w_full().min_w(0).child(face === "raw" ? raw(t, m, cx, st, o) : preview(t, cx, st, o));
  return fading ? enter(m, box, f.id, { dy: 0 }) : box;
}

/** Aperçu / Brut: two chips (kt-inbox's tabs, smaller), their key in the tooltip; no track_focus
 *  (KEYMAP.md: GPUI turns Space into a click on the focused element). */
export function tabs(t, id, st) {
  const tab = (isRaw) => {
    const on = st.raw === isRaw;
    return h_flex().id(`${id}-${isRaw ? "raw" : "pv"}`).flex_none().h(22).px(9).items_center().rounded_full().border(1)
      .border_color(on ? alpha(t.accent, "66") : t.border)
      .when(on, (el) => el.bg(alpha(t.accent, "24")))
      .when(!on, (el) => el.hover((s) => s.bg(t.hover).text_color(t.foreground)))
      .font_family(MONO).text_size(10.5).text_color(on ? t.foreground : t.muted).cursor_pointer()
      .tooltip(tr(isRaw ? "md.rawTip" : "md.previewTip"))
      .on_click((_e, cx) => { cx.stop_propagation(); st.raw = isRaw; cx.notify(); })
      .child(tr(isRaw ? "md.raw" : "md.preview"));
  };
  return h_flex().flex_none().gap(4).items_center().child(tab(false)).child(tab(true));
}
