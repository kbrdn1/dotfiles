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
//   rawList(): a virtual list of rows (v_virtual_list, 19 px each, kt-history's pattern) that fills its
//   caller's box: only the rows on screen are built, from the first line to the last, no pages. The
//   mod scrolls it with rawScroll() (its keys, `<mod>.raw:` for tests). view() keeps a paged Brut
//   inside a longer page (kt-workflow's sections), within the render's budget.
// Source lines soft-wrap as an editor does, here and in the Aperçu's code blocks (wrapLine): Brut's
// font is mono (CH px a column), so a line is cut at the last space before the column, a word longer
// than a row at the column, its indent kept as padding on every row, its colors cut at the same
// points; the columns come from the box's width (on_size_change), a column of margin. A row never
// wraps by itself (nowrap): nothing is cut, nothing scrolls sideways.
// A render has ~50 ms before the engine interrupts it: the paged Brut and the code blocks share one
// budget per render (mdBudget()); past it the code blocks go on plain, and stop past HARD rows, saying so.
// Colors are asked from render on a miss, never under checking(): every miss of one render goes in
// ONE batch (a task, after the render), cached per view by (content hash, language, light / dark).
// A theme flip is a miss for the other mode: Brut shows the skeleton again, then the new colors.
//
//   const md = mdState();                                   // in init(): md.raw, Brut shown (sticky)
//   const doc = parse(text) | parse(text, { fields: false })   // in a task: { src, fields, segs }
//   parse(text, { meta: false })                            // no frontmatter at all (a note's later block)
//   const doc = docOf(md, text)                             // or in render, memoized by text
//   tabs(t, "kx-md-tabs", md)                               // Aperçu / Brut, their key in the tooltip
//   md.raw ? rawList(t, m, cx, md, { id, mod, doc })        // Brut filling a flex_1 box
//          : view(t, m, cx, md, { id, mod, doc, onLink })   // Aperçu (or a paged Brut: view alone)
//   preview(t, cx, md, { id, mod, doc, onLink, budget, noRaw })    // Aperçu only (an issue's comment)
//   const budget = mdBudget()                               // once per render, for several documents
//   rawScroll(md, "down" | "up" | "half-down" | "half-up" | "top" | "bottom" | "<row>")
//   key "p" (NORMAL): md.raw = !md.raw                       // the mod's own press(), before vim
//   target(url, dir)                                        // a link: { web } | { path } | null

import { div } from "gpui-kit";
import { v_flex, h_flex, TextView, v_virtual_list, Scrollbar, VirtualListScrollHandle } from "gpui-base";
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
const CH = 7.2; // Monaspace Neon's advance at 12 px (0.6 em): a column, and an indent drawn as padding
const ROW = 19; // a row's height: Brut's and the code blocks' line height
// What one render may spend on source rows outside the virtual list (the paged Brut, the code
// blocks), in units of one colored one-run row (14 to 30 µs, by the machine's load). Measured
// 2026-11-18 under herdr-app check: a call into a mod is interrupted past ~50 ms (a busy wait of 45 ms
// passes, 75 ms doesn't; init and render have one each). A row costs 1, a line of several colors LINE
// more and a unit per run on its rows. One BUDGET per render (~12 ms), shared by the documents a mod
// draws (mdBudget()): the paged Brut stops where it runs out and offers the next page; the code blocks
// go on plain (no colors) past it, and stop at HARD rows a render, saying so.
const LINE = 1;
const BUDGET = 500;
const HARD = 1000;
export const mdBudget = () => ({ left: BUDGET, rows: 0 });
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

// ---------- pure: the soft wrap ----------

const MIN_COLS = 20; // a row keeps at least this many columns of text, however deep its indent

// Where a body of text is cut into rows of `avail` columns: each row's end. After the last space that
// fits (the space stays at the row's end: a row may hold avail + 1 when that extra is a space); a word
// longer than a row is cut at the column (défaut c), never between the two halves of a surrogate pair.
function cuts(body, avail) {
  const out = [];
  let p = 0;
  while (body.length - p > avail) {
    const s = body.lastIndexOf(" ", p + avail);
    let e = s > p ? s + 1 : p + avail;
    if (s <= p) {
      const c = body.charCodeAt(e);
      if (c >= 0xdc00 && c <= 0xdfff && e - 1 > p) e -= 1;
    }
    out.push(e);
    p = e;
  }
  out.push(body.length);
  return out;
}

// A line's lay-out at `cols` columns: its leading spaces (lead), the indent drawn (pad: capped so a
// row keeps MIN_COLS of text), the columns left for text (avail).
function lay(text, cols) {
  const body = text.trimStart();
  const lead = text.length - body.length;
  const pad = Math.min(lead, Math.max(0, cols - MIN_COLS));
  return { body, lead, pad, avail: Math.max(MIN_COLS, cols - pad) };
}

/** How many rows a source line takes at `cols` columns (as wrapLine cuts it). A line no longer than the
 *  columns is one row, whatever its indent (the common case: no trim, no cut). */
export function rowCount(text, cols) {
  if (text.length <= cols) return 1;
  const { body, avail } = lay(text, cols);
  return body.length <= avail ? 1 : cuts(body, avail).length;
}

/** One source line soft-wrapped at `cols` columns, as an editor does: [{ pad, runs }], one per row.
 *  pad: the line's indent (in columns, drawn as padding on every row); runs: the row's pieces of the
 *  line's runs [text, color, style], cut at the same points (a run across a cut goes on in the next
 *  row, its color kept). `runs`: zed-tokens' runs of the line, or [[text, null, 0]]. */
export function wrapLine(runs, cols) {
  let text = "";
  for (let k = 0; k < runs.length; k++) text += runs[k][0];
  const { body, lead, pad, avail } = lay(text, cols);
  const rows = [];
  let r = 0, rStart = 0, a = lead;
  for (const end of cuts(body, avail)) {
    const b = lead + end;
    const parts = [];
    while (r < runs.length && rStart + runs[r][0].length <= a) { rStart += runs[r][0].length; r++; }
    for (let j = r, jStart = rStart; j < runs.length && jStart < b; jStart += runs[j][0].length, j++) {
      const s = runs[j][0], from = Math.max(a, jStart) - jStart, to = Math.min(b, jStart + s.length) - jStart;
      if (to > from) parts.push([s.slice(from, to), runs[j][1] ?? null, runs[j][2] ?? 0]);
    }
    rows.push({ pad, runs: parts });
    a = b;
  }
  return rows;
}

/** wrapLine for each line of `lines` (runs per line). */
export const wrapRows = (lines, cols) => lines.map((runs) => wrapLine(runs, cols));

/** Each line's first row at `cols` columns, and the total at the end: starts[i], starts[n]. */
export function rowStarts(rows, cols) {
  const starts = new Array(rows.length + 1);
  let n = 0;
  for (let i = 0; i < rows.length; i++) { starts[i] = n; n += rowCount(rows[i], cols); }
  starts[rows.length] = n;
  return starts;
}

/** The line that holds row v: the last i with starts[i] <= v. */
export function lineAt(starts, v) {
  let lo = 0, hi = starts.length - 2;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (starts[mid] <= v) lo = mid;
    else hi = mid - 1;
  }
  return Math.max(0, lo);
}

/** The columns a box `w` px wide holds: its two 14 px paddings off, one column of margin. */
export const colsFor = (w) => Math.max(MIN_COLS, Math.floor((w - 28) / CH) - 1);

// zed-tokens' runs for source line i when they are its text (else the line plain: never a row lost).
function runsOf(rows, lines, i) {
  const runs = lines?.[i];
  if (!runs?.length) return [[rows[i], null, 0]];
  let text = "";
  for (let k = 0; k < runs.length; k++) text += runs[k][0];
  return text === rows[i] ? runs : [[rows[i], null, 0]];
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

// In init() (it makes Brut's scroll handle). raw: Brut shown; pages: the paged Brut's page starts per
// document; colors / busy / queue: colorsOf's; docs: docOf's; seen / fade / n: view()'s fade on a
// switch; widths / lastW: the boxes' widths (their columns); starts: rowStarts per (hash, columns);
// scroll / range / total / listOf: rawList's handle, the rows on screen, their count, its document.
export const mdState = () => ({
  raw: false, colors: new Map(), busy: new Set(), queue: [], docs: new Map(), seen: new Map(), fade: new Map(), n: 0, pages: new Map(),
  widths: new Map(), lastW: 640, starts: new Map(), scroll: VirtualListScrollHandle.new(), range: { start: 0, end: 0 }, total: 0, listOf: null,
});

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

// A box's width, for its columns: recorded on its on_size_change; a render only when the columns change
// (a height, a pixel more, never: no loop through the rows' widths). The first frame uses the last width.
function measure(st, key) {
  return (s, cx) => {
    const before = colsFor(st.widths.get(key) ?? st.lastW);
    remember(st.widths, key, s.width);
    st.lastW = s.width;
    if (colsFor(s.width) !== before) cx.notify();
  };
}
const colsOf = (st, key) => colsFor(st.widths.get(key) ?? st.lastW);

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
// render's ~50 ms).
function span([text, color, style], el = div()) {
  if (color) el = el.text_color(color);
  if (style & 1) el = el.italic();
  if (style & 2) el = el.font_weight(700);
  return el.child(text || " ");
}

// One row as wrapLine cut it: one text, or its runs side by side; never wrapping by itself (it fits its
// columns). Its indent as padding, after `inset` px (the virtual list's rows carry their box's padding).
function vrow(r, inset = 0) {
  const left = inset + r.pad * CH;
  let el = r.runs.length > 1 ? h_flex() : div();
  if (left) el = el.pl(left);
  if (inset) el = el.pr(inset);
  el = el.whitespace_nowrap();
  if (r.runs.length > 1) return el.children(r.runs.map((s) => span(s, div().flex_none())));
  return r.runs.length ? span(r.runs[0], el) : el.child(" ");
}

/** Source lines from `from`, soft-wrapped at `cols` columns, in Zed's colors while `budget` (mdBudget())
 *  lasts: { el, to }, `to` the first line not drawn (one at least is). `page` (the paged Brut): stop
 *  where the budget runs out. Else (a code block): go on plain past it, up to HARD rows a render. */
function code(t, rows, lines, budget, cols, from = 0, page = false) {
  const kids = [];
  let i = from;
  for (; i < rows.length; i++) {
    const rich = budget.left > 0;
    if (i > from && (page ? !rich : budget.rows >= HARD)) break;
    const runs = rich ? runsOf(rows, lines, i) : [[rows[i], null, 0]];
    const wl = wrapLine(runs, cols);
    let cost = wl.length;
    if (runs.length > 1) { cost += LINE; for (const r of wl) cost += r.runs.length; }
    budget.left -= cost;
    budget.rows += wl.length;
    for (const r of wl) kids.push(vrow(r));
  }
  return { el: v_flex().w_full().min_w(0).font_family(CODE).text_size(12).line_height(`${ROW}px`).text_color(t.foreground).children(kids), to: i };
}

const note = (t, text) => div().font_family(MONO).text_size(10.5).text_color(t.dim).child(text);

/** A fenced block: t.raised, radius 12, Monaspace Neon; its language as an eyebrow; long lines soft-wrap
 *  at the block's columns (`st`, `key`: where its width is kept). Past `budget` (shared by what the
 *  render draws), its lines go on plain; past HARD rows, they stop, said (`raw`: Brut shows them). */
export function codeBlock(t, s, lines, budget, raw, st, key) {
  const rows = s.text.split("\n");
  const { el, to } = code(t, rows, lines, budget, colsOf(st, key));
  return v_flex().flex_none().w_full().rounded(12).border(1).border_color(t.border).bg(t.raised).overflow_hidden()
    .when(Boolean(s.lang), (el) => el.child(div().px(14).pt(9).font_family(MONO).text_size(10).text_color(t.dim).child(s.lang.toUpperCase())))
    .child(div().id(`${key}-code`).w_full().min_w(0).overflow_hidden().px(14).pt(s.lang ? 6 : 12).pb(12).on_size_change(measure(st, key)).child(el))
    .when(to < rows.length, (el) => el.child(note(t, tr(raw ? "md.codeMore" : "md.codeCut", { n: rows.length - to })).px(14).pb(10)));
}

// Previous / next page of the paged Brut: small chips (the tabs' look), no track_focus.
function pageChip(t, id, label, onClick) {
  return h_flex().id(id).flex_none().h(20).px(8).items_center().rounded_full().border(1).border_color(t.border)
    .hover((s) => s.bg(t.hover).text_color(t.foreground)).font_family(MONO).text_size(10.5).text_color(t.muted).cursor_pointer()
    .on_click((_e, cx) => { cx.stop_propagation(); onClick(); cx.notify(); })
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
      ? codeBlock(t, s, n++ < MAX_CODE ? colorsOf(st, cx, mod, s.text, langFor(s.lang), s.hash) : null, budget, !noRaw, st, `${id}#${i}`)
      : s.kind === "alert" ? alertBox(t, `${id}#${i}`, s, onLink)
        : prose(`${id}#${i}`, s.text, onLink))));
}

// The paged Brut, inside a longer page (kt-workflow's sections): code() until the render's budget runs
// out, the pages' starts kept per document (st.pages), « lignes a–b sur n » and ‹ › above and under a
// page when there are several.
function raw(t, m, cx, st, { id, mod, doc, budget = mdBudget() }) {
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
    const { el: src, to } = code(t, rows, lines, budget, colsOf(st, id), from, true);
    const paged = from > 0 || to < rows.length;
    const pager = (k) => h_flex().px(14).py(8).gap(6).items_center()
      .child(note(t, tr("md.lines", { from: from + 1, to, n: rows.length })).flex_1().min_w(0))
      .when(starts.length > 1, (el) => el.child(pageChip(t, `${id}:prev${k}`, tr("md.prev"), () => starts.pop())))
      .when(to < rows.length, (el) => el.child(pageChip(t, `${id}:next${k}`, tr("md.next"), () => starts.push(to))));
    return box()
      .when(lines === null && !checking(), (el) => el.child(note(t, tr("md.mono")).px(14).pt(9)))
      .when(paged, (el) => el.child(pager("t")))
      .child(div().id(`${id}:src-x`).w_full().min_w(0).overflow_hidden().px(14).py(12).on_size_change(measure(st, id)).child(src))
      .when(paged, (el) => el.child(pager("b")));
  }, () => box().px(14).py(12).gap(2).children([0.5, 0.9, 0.75, 0.3, 0.95, 0.6].map((w) => S.line(w, { h: 8, lh: ROW }))));
}

/** Brut as a virtual list filling its caller's flex_1 box: every row of the document, 19 px each,
 *  only those on screen built (v_virtual_list, kt-history's pattern), its scrollbar; soft-wrapped at
 *  the box's columns, rowStarts cached per (hash, columns). The skeleton while its colors are asked;
 *  plain mono, and said, when none come. A new document starts at its top. */
export function rawList(t, m, cx, st, { id, mod, doc }) {
  const rows = doc.src.replace(/\n+$/, "").split("\n");
  const lines = colorsOf(st, cx, mod, doc.src, "markdown", doc.hash);
  const cols = colsOf(st, id);
  const k = `${doc.hash}|${cols}`;
  const starts = st.starts.has(k) ? remember(st.starts, k, st.starts.get(k)) : remember(st.starts, k, rowStarts(rows, cols));
  st.total = starts[rows.length];
  if (st.listOf !== id) {
    st.listOf = id;
    st.range = { start: 0, end: 0 };
    st.scroll.scroll_to_item(0, "top");
  }
  const S = skeleton(t, m);
  // Called from inside layout, for the rows on screen only: no handlers, no state but the range.
  const render = (range) => {
    st.range = { start: range.start, end: range.end };
    const out = [];
    for (let i = lineAt(starts, range.start); i < rows.length && starts[i] < range.end; i++) {
      const wl = wrapLine(runsOf(rows, lines, i), cols);
      for (let r = 0; r < wl.length; r++) {
        const v = starts[i] + r;
        if (v >= range.start && v < range.end) out.push(vrow(wl[r], 14));
      }
    }
    return out;
  };
  return v_flex().flex_1().min_h(0).w_full().min_w(0).rounded(12).border(1).border_color(t.border).bg(t.raised).overflow_hidden()
    .when(lines === null && !checking(), (el) => el.child(note(t, tr("md.mono")).px(14).pt(9)))
    .child(S.swap(`${id}:src`, lines !== undefined, () => div().id(`${id}:area`).flex_1().min_h(0).w_full().min_w(0).relative().overflow_hidden()
      .on_size_change(measure(st, id))
      .child(v_virtual_list(`${id}:list`, st.total, ROW, (v) => String(v), render).size_full().track_scroll(st.scroll)
        .font_family(CODE).text_size(12).line_height(`${ROW}px`).text_color(t.foreground))
      .child(Scrollbar.vertical(`${id}:list`).absolute().inset_0()),
    () => v_flex().flex_1().px(14).py(12).gap(2).children([0.5, 0.9, 0.75, 0.3, 0.95, 0.6].map((w) => S.line(w, { h: 8, lh: ROW }))), { grow: true }));
}

/** Scrolls rawList's Brut: "down" / "up" a row, "half-down" / "half-up" half the rows on screen, "top",
 *  "bottom", or a row's number (`<mod>.raw:<how>`, for tests: that row brought to the nearest edge, the
 *  top when it is above the screen, the bottom when below; already on screen, nothing moves).
 *  scroll_to_item only brings a row into view (seen on screen, 2026-11-19), so a move aims just past
 *  the rows last on screen: the first below them (range.end) to go down, the one above (start − 1) to
 *  go up, half a screen further for the half pages. */
export function rawScroll(st, how) {
  const { start, end } = st.range;
  const half = Math.max(1, Math.floor((end - start) / 2));
  const to = (v) => st.scroll.scroll_to_item(Math.max(0, Math.min(Math.max(0, st.total - 1), v)), "top");
  if (how === "top") to(0);
  else if (how === "bottom") st.scroll.scroll_to_bottom();
  else if (how === "down") to(end);
  else if (how === "up") to(start - 1);
  else if (how === "half-down") to(end - 1 + half);
  else if (how === "half-up") to(start - half);
  else if (/^\d+$/.test(how)) to(Number(how));
}

/** The document: Aperçu (fields, prose, code, alerts) or the paged Brut (the source), as md.raw says,
 *  faded in on a switch. id: unique in the view, per document; mod: the folder its colors' batches go
 *  under. A mod whose Brut fills a box draws rawList() for it instead. */
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
