// kbrdn Threads' diffs drawn after DIFF-SPEC (/me:report's look), as Changes,
// History and Inbox's Code show them: a section's header (sectionHead), its
// files in compact rows (Catppuccin icon, basename, folder, mini bar, status,
// +N −N, actions shown on hover or open) that open and close on their height,
// each unfolding into its unified diff (fileItems: one gutter with a 4 px bar,
// full-line fills, word spans, "N lignes inchangées" bands instead of @@, a
// 576 px box, the 1500-line cap), an image into its before / after. theme()
// colors, but the code's: Zed's theme, by ~/.claude/scripts/zed-tokens.ts
// (colorize, on unfold). Source of truth: mods/kt-diff/diffview.js; kt-history
// and kt-inbox hold byte-identical copies (a mod can't import from another
// mod's folder), with motion.js beside them.

import { div, svg, image, PathBuilder, Background } from "gpui-kit";
import { h_flex, v_flex } from "gpui-base";
import { exec, settings, appHome, home, readTextFile, openOverlay } from "herdr";
import * as fs from "fs/promises";
import { plan, words, barWidth, pieces, zedLabel } from "./diff.js";
import { catIcon } from "./icons.js";
import { rows, collapse } from "./motion.js";
import { makeT, num } from "./i18n.js";
import dvStrings from "./diffview.strings.js";

// Its own words (I18N.md), copied with it; `words` is diff.js' (the word spans).
const tr = makeT(dvStrings);

export const CODE = "Monaspace Neon";
export const MONO = "Monaspace Krypton";
const CH = 7.5; // one column of Monaspace Neon at 12.5 px
const I = (name) => `mods/kt-threads/${name}.svg`;
const base = (p) => p.split("/").pop();
const dirOf = (p) => (p.includes("/") ? p.slice(0, p.lastIndexOf("/")) : "");

/** A theme color with alpha `a` (2 hex digits), replacing any it has (glass themes are #rrggbbaa). */
export const alpha = (c, a) => `${String(c).slice(0, 7)}${a}`;

/** DIFF-SPEC's colors from theme(): ok/err/warn/info, then line, number-cell and word fills. */
export function palette(t, dark = settings().dark !== false) {
  const ok = t.done, err = dark ? t.ansi9 : t.ansi1;
  const a = dark ? ["2e", "21", "57"] : ["1f", "16", "40"];
  return {
    ok, err, warn: dark ? t.ansi11 : t.ansi3, info: dark ? t.ansi12 : t.ansi4,
    addLine: alpha(ok, a[0]), addCell: alpha(ok, a[1]), addWord: alpha(ok, a[2]),
    delLine: alpha(err, a[0]), delCell: alpha(err, a[1]), delWord: alpha(err, a[2]),
  };
}

/** The status letter's color: A/U ok, M warn, D err, R info. */
export const statusColor = (p, s) => ({ A: p.ok, U: p.ok, M: p.warn, D: p.err, R: p.info })[s] ?? p.warn;

/** A small icon button for a row's actions; it keeps its click from the row. */
export function action(t, id, icon, tip, run) {
  return div().id(id).p(4).rounded(8).flex_none().text_color(t.muted).cursor_pointer()
    .hover((s) => s.bg(t.raised).text_color(t.foreground)).tooltip(tip)
    .on_click((_e, cx) => { cx.stop_propagation(); run(cx); })
    .child(svg(icon).size(14));
}

/** Opens `abs` at `line` in Zed. */
export const zed = (abs, line) => exec("open", [`zed://file${abs}${line ? `:${line}` : ""}`]).catch(() => {});

/** The first line a file's diff touches (new numbering), for "open at". */
export function firstLine(f) {
  for (const h of f.hunks) for (const l of h.lines) if (l.k === "+" || l.k === "-") return l.n ?? Math.max(1, h.newStart);
  return 1;
}

/** A section's header (Changes' Staged and Changes, Inbox's Code): chevron, eyebrow, count, actions; the keys' ring when `ring`.
 *  `roll`, `m`: roll.js' roll() and the motion state, handed in (as viz.js) so a copy without roll.js still
 *  loads; with them, the count rolls to its new digits. `scope` goes into its reels' id: another repo's
 *  count shows at once, not rolling. */
export function sectionHead(t, { id, label, count, folded, ring, gap, toggle, actions, roll, m, scope = "" }) {
  return h_flex().id(id).flex_none().when(Boolean(gap), (el) => el.mt(5)).h(28).px(8).gap(8).items_center().rounded(8).cursor_pointer()
    .border(1).border_color(ring ? alpha(t.accent, "99") : alpha(t.accent, "00"))
    .when(Boolean(ring), (el) => el.bg(alpha(t.accent, "24")))
    .when(!ring, (el) => el.hover((s) => s.bg(t.hover)))
    .on_click((_e, cx) => toggle(cx))
    .child(svg(I(folded ? "chevron-right" : "chevron-down")).size(12).flex_none().text_color(t.muted))
    .child(div().font_family(MONO).text_size(11).text_color(t.muted).child(String(label).toUpperCase()))
    .child(h_flex().h(16).min_w(16).px(4).items_center().justify_center().rounded_full().bg(t.accent)
      .font_family(MONO).text_size(10).font_weight(600).text_color(t.accent_foreground)
      .child(roll ? roll(m ?? { reduced: false }, `${id}-n-${scope}`, String(count), 13) : String(count)))
    .child(div().flex_1())
    .child(h_flex().gap(0).children(actions ?? []));
}

/**
 * A section's files as direct children of a scrolling list, by path: each one's compact row (one
 * 28 px row, its folder after its name), then its diff as a sibling. The rows open and close on
 * their height, in order (motion.js rows(), keyed by path; `id` names the list: another id is
 * another list, which replaces it at once and opens). A diff unfolds and folds on its height
 * (collapse, its body a builder), never inside rows() (one height level each). `ring(f)`: the keys'
 * cursor, an accent ring on the ink over the row, in its radius. A closing row gets a neutral `o`:
 * no diff, no hover, no actions, its click does nothing. m: motion.js' state; cx: render's.
 * o: { id, map, dark, isOpen(f), isHot(f), toggle(f, cx), hover(f, on, cx), letter(f)?, actions(f)?,
 * root?, preview(f)?, tokens(f)?, sk? }; fold(f): the id of f's diff. `sk`: skeleton.js' skeleton(t, m),
 * handed in so a copy without skeleton.js still loads: a diff being read shows its lines as bars.
 * Returns [{ el, f }] in order: f is the file of a live row, null for a closing row or a diff.
 */
export function fileItems(t, m, cx, id, files, o, { ring = () => false, fold = (f) => `${id}:open:${f.path}` } = {}) {
  const p = palette(t, o.dark);
  const gone = { ...o, isOpen: () => false, isHot: () => false, toggle: () => {}, hover: () => {}, actions: () => [] };
  // rows() builds the rows in the order it returns them: `built` says what each child is.
  const built = [];
  const kids = rows(m, cx, id, [...files].sort((a, b) => a.path.localeCompare(b.path)), (f) => f.path, (f, i) => {
    const row = compactRow(t, p, f, i < 0 ? gone : o);
    built.push({ f, live: i >= 0 });
    return i >= 0 && ring(f) ? v_flex().relative().child(row)
      .child(div().absolute().inset_0().rounded(8).border(1).border_color(alpha(t.accent, "99")).bg(alpha(t.accent, "24"))) : row;
  });
  const out = [];
  kids.forEach((el, j) => {
    const { f, live } = built[j];
    out.push({ el, f: live ? f : null });
    const body = collapse(m, fold(f), live && o.isOpen(f), () => div().pt(2).pr(4).pb(6).pl(30).child(diffBody(t, p, f, live ? o : gone)), { cx });
    if (body) out.push({ el: body, f: null });
  });
  return out;
}

function compactRow(t, p, f, o) {
  const open = o.isOpen(f), hot = o.isHot(f);
  const letter = o.letter?.(f) ?? f.status;
  const total = f.add + f.del;
  const w = Math.round((52 * barWidth(f.add, f.del)) / 100);
  const wa = total ? Math.round((w * f.add) / total) : 0;
  const acts = o.actions?.(f) ?? [];
  const dir = dirOf(f.path);
  return h_flex().id(`${o.id}:${f.path}:row`).relative().h(28).px(8).gap(8).items_center().rounded(8).cursor_pointer()
    .when(open || hot, (el) => el.bg(t.hover))
    .on_hover((on, cx) => o.hover(f, on, cx))
    .on_click((_e, cx) => o.toggle(f, cx))
    .child(div().w(12).flex_none().when(open || hot, (el) => el.child(svg(I(open ? "chevron-down" : "chevron-right")).size(12).text_color(open ? t.accent : t.muted))))
    .child(image(catIcon(o.map, base(f.path), { dark: o.dark })).size(14).flex_none())
    .child(h_flex().flex_1().min_w(0).gap(6).items_center()
      .when(Boolean(f.old), (el) => el.child(div().flex_none().max_w(140).truncate().text_size(12.5).text_color(t.muted).child(`${base(f.old ?? "")} →`)))
      .child(div().min_w(0).truncate().text_size(12.5).font_medium().text_color(t.foreground).child(base(f.path)))
      .when(Boolean(dir), (el) => el.child(div().flex_1().min_w(0).truncate().text_size(11).text_color(t.dim).child(dir))))
    .when((open || hot) && !f.binary && f.loaded !== false, (el) => el.child(h_flex().w(52).h(8).flex_none().bg(t.input)
      .child(div().w(wa).h_full().bg(p.ok)).child(div().w(w - wa).h_full().bg(p.err))))
    .child(div().flex_none().w(10).font_family(MONO).font_weight(600).text_size(11).text_color(statusColor(p, letter)).child(letter))
    .child(h_flex().flex_none().gap(5).font_family(MONO).text_size(10.5)
      .when(f.binary || f.loaded === false, (el) => el.child(div().text_color(t.dim).child("–")))
      .when(!f.binary && f.loaded !== false, (el) => el
        .when(f.add > 0 || !f.del, (e) => e.child(div().text_color(p.ok).child(`+${f.add}`)))
        .when(f.del > 0, (e) => e.child(div().text_color(p.err).child(`−${f.del}`)))))
    .when(acts.length > 0 && (open || hot), (el) => el.child(h_flex().absolute().right(4).top(2).h(24).px(2).gap(0)
      .items_center().rounded_full().border(1).border_color(t.border).bg(t.popover).children(acts)));
}

const stripes = (color) => v_flex().w(4).h(20).flex_none().gap(2).children([0, 1, 2, 3, 4].map(() => div().h(2).w_full().bg(color)));

// ---------- image previews (before / after) ----------

export const IMAGE = /\.(png|jpe?g|gif|webp|svg|ico)$/i;
const PREVIEWS = "data/kt-diff/preview"; // under the app home: image() reads nothing outside it
const q = (s) => `'${String(s).replace(/'/g, "'\\''")}'`;

/** Drops cached previews older than a day (call when the panel opens). */
export const cleanPreviews = () => exec("find", [`${appHome()}/${PREVIEWS}`, "-type", "f", "-mmin", "+1440", "-delete"]).catch(() => {});

// A blob's hash: rev "worktree" hashes the working file, "" is the index, else the blob at rev. Null: none.
async function blobId(root, rev, path) {
  const id = await exec("git", rev === "worktree" ? ["hash-object", "--", path] : ["rev-parse", "--verify", "--quiet", `${rev}:${path}`], { cwd: root });
  const hash = id.stdout.trim();
  return id.code === 0 && /^[0-9a-f]+$/.test(hash) ? hash : null;
}

// One side into the cache, named by its blob hash: rev "worktree" copies the file, rev "" is the index,
// else the blob at rev (cat-file: raw bytes, no textconv; the shell redirect keeps them binary); or
// rev { id, write(abs) } (a PR's blob: its hash, and what writes its bytes, resolving true when done).
// Written aside, then moved: a failed write leaves nothing a later look would take for the image.
async function previewSide(root, rev, path) {
  const ext = path.split(".").pop().toLowerCase();
  const hash = typeof rev === "object" ? rev.id : await blobId(root, rev, path);
  if (!hash) return null;
  const rel = `${PREVIEWS}/${hash}.${ext}`, abs = `${appHome()}/${rel}`;
  if (!(await fs.exists(abs).catch(() => false))) {
    await fs.mkdir(`${appHome()}/${PREVIEWS}`, { recursive: true }).catch(() => {});
    const part = `${abs}.part`;
    const ok = typeof rev === "object" ? await rev.write(part).catch(() => false)
      : (rev === "worktree"
        ? await exec("cp", ["--", `${root}/${path}`, part])
        : await exec("sh", ["-c", `git cat-file blob ${q(`${rev}:${path}`)} > ${q(part)}`], { cwd: root })).code === 0;
    if (!ok || (await exec("mv", ["-f", "--", part, abs]).catch(() => ({ code: 1 }))).code !== 0) {
      await fs.unlink(part).catch(() => {});
      return null;
    }
  }
  const m = await exec("sh", ["-c", 'stat -f %z "$1"; sips -g pixelWidth -g pixelHeight "$1" 2>/dev/null', "sh", abs]);
  let w = +(m.stdout.match(/pixelWidth: (\d+)/)?.[1] ?? 0), h = +(m.stdout.match(/pixelHeight: (\d+)/)?.[1] ?? 0);
  if (ext === "svg" && !w) {
    const s = String(await fs.readFile(abs, "utf8").catch(() => "")).slice(0, 4000);
    const vb = s.match(/viewBox="[\d.\s-]*?([\d.]+)[\s,]+([\d.]+)"/);
    w = Math.round(+(s.match(/\swidth="([\d.]+)/)?.[1] ?? vb?.[1] ?? 0));
    h = Math.round(+(s.match(/\sheight="([\d.]+)/)?.[1] ?? vb?.[2] ?? 0));
  }
  return { src: rel, size: parseInt(m.stdout, 10) || 0, w, h };
}

/** Before (rev, or null) and after (rev, "worktree", or null) of an image file: { before, after }. A side may be { id, write } (previewSide). */
export async function loadPreview(root, f, before, after) {
  const [b, a] = await Promise.all([
    before !== null ? previewSide(root, before, f.old ?? f.path).catch(() => null) : null,
    after !== null ? previewSide(root, after, f.path).catch(() => null) : null,
  ]);
  return b || a ? { before: b, after: a } : { error: "unavailable" }; // i18n: tech (pv.<error>, said at render)
}

const kb = (n) => (n >= 1048576 ? tr("size.mb", { n: num(n / 1048576, 1) }) : n >= 1024 ? tr("size.kb", { n: num(n / 1024, 1) }) : tr("size.b", { n }));
const CHECK = () => PathBuilder.fill().move_to("0%", "0%").line_to("100%", "0%").line_to("100%", "100%").line_to("0%", "100%").close().build();

/** Opens kt-viewer (full window, zoom) on a file's before/after, `index` first. */
export function viewImages(f, pv, index, compare = false) {
  const name = base(f.path);
  const images = [[tr("before"), pv.before], [tr("after"), pv.after]].filter(([, s]) => s)
    .map(([label, s]) => ({ path: s.src, label, name, w: s.w, h: s.h, size: s.size }));
  if (images.length) openOverlay({ mod: "kt-viewer", kind: "dialog", frame: "none", width: 1, height: 1, props: { images, index: Math.min(index, images.length - 1), compare } });
}

function previewBody(t, p, f, pv) {
  const sides = [[tr("before"), pv.before], [tr("after"), pv.after]].filter(([, s]) => s);
  const H = Math.min(220, Math.max(60, ...sides.map(([, s]) => (s.h || 220) + 16)));
  const meta = (s) => `${s.w && s.h ? `${s.w}×${s.h} · ` : ""}${kb(s.size)}`;
  const b = pv.before, a = pv.after;
  const delta = b && a ? a.size - b.size : 0;
  return v_flex().gap(8).p(8).rounded(12).border(1).border_color(t.border).bg(t.background)
    .child(h_flex().gap(8).children(sides.map(([label, s], k) => v_flex().flex_1().min_w(0).gap(6)
      .child(div().font_family(MONO).text_size(11).text_color(t.muted).child(label.toUpperCase()))
      .child(div().id(`pv:${f.path}:${k}`).relative().h(H).rounded(12).border(1).border_color(t.border).bg(t.background).overflow_hidden()
        .cursor_pointer().hover((st) => st.border_color(alpha(t.accent, "66"))).tooltip(tr("zoom"))
        .on_click((_e, cx) => { cx.stop_propagation(); viewImages(f, pv, k); })
        .child(window.paint_path(CHECK(), Background.checkerboard(t.raised, 8)).absolute().top(0).left(0).size_full())
        .child(div().absolute().inset_0().p(8).child(image(s.src).size_full())))
      .child(div().font_family(MONO).text_size(11).text_color(t.muted).child(meta(s))))))
    .when(Boolean(b && a), (el) => el.child(h_flex().gap(8).font_family(MONO).text_size(11).text_color(t.muted)
      .when(b.w !== a.w || b.h !== a.h, (el) => el.child(div().child(`${b.w}×${b.h} → ${a.w}×${a.h}`)))
      .child(div().text_color(delta > 0 ? p.err : delta < 0 ? p.ok : t.muted).child(`${delta > 0 ? "+" : delta < 0 ? "−" : "±"}${kb(Math.abs(delta))}`))));
}

// ---------- syntax colors (Zed's theme, ~/.claude/scripts/zed-tokens.ts) ----------

// Absolute: the mods' PATH hasn't the nix profile.
const ZED = () => [`${home()}/.nix-profile/bin/bun`, `${home()}/.claude/scripts/zed-tokens.ts`];
const TOKENS = (mod) => `${appHome()}/data/${mod}/tokens`; // under the app home: fs writes nothing outside it

/** Drops `mod`'s cached colors older than a day (call when the panel opens). */
export const cleanTokens = (mod) => exec("find", [TOKENS(mod), "-type", "f", "-mmin", "+1440", "-delete"]).catch(() => {});

/**
 * Zed-theme colors of `f`'s two sides. Each side's whole file goes through zed-tokens.ts (a line
 * alone lacks its context: a string or a comment opened above), in one batch. sides: { old, new },
 * each null, { rev, path } (rev "worktree": the working file, "": the index, else a commit) or
 * { id, path, text: async () => string | null } (contents to fetch, a PR's: id is the blob's hash).
 * Cached under data/<mod>/tokens/ by blob hash, mode and Zed theme, a day (cleanTokens). The script
 * reads stdin and exec has none: the batch goes through a file, its answer too (exec's stdout is
 * capped). Resolves { mode, label, old, new }: old and new map the line numbers plan(f) shows to
 * their runs, null for a side without colors (none, binary, past 2 MB, not found).
 */
export async function colorize(mod, root, f, sides, dark) {
  const mode = dark ? "dark" : "light", dir = TOKENS(mod);
  const label = zedLabel(await readTextFile(`${home()}/.config/zed/settings.json`).catch(() => null), mode);
  const cached = (id, l) => `${dir}/${id}-${mode}-${String(l).replace(/[^\w.-]+/g, "_")}.json`;
  const lines = {}, miss = [];
  await Promise.all(["old", "new"].map(async (k) => {
    const s = sides[k];
    if (!s) return;
    const id = s.id ?? (await blobId(root, s.rev, s.path).catch(() => null));
    if (!id) return;
    // fs, not readTextFile: a big file's runs pass its 1 MiB.
    const hit = await fs.readFile(cached(id, label), "utf8").then(JSON.parse).catch(() => null);
    if (Array.isArray(hit?.lines)) lines[k] = hit.lines;
    else miss.push({ k, s, id });
  }));
  if (miss.length) {
    const items = (await Promise.all(miss.map(async ({ k, s }) => {
      if (s.rev === "worktree") return { id: k, file: `${root}/${s.path}` };
      if (!s.text) return { id: k, rev: s.rev, path: s.path };
      const text = await s.text().catch(() => null);
      return typeof text === "string" ? { id: k, text, path: s.path } : null; // path: the language
    }))).filter(Boolean);
    if (items.length) {
      await fs.mkdir(dir, { recursive: true }).catch(() => {});
      const tag = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const req = `${dir}/req-${tag}.json`, out = `${dir}/out-${tag}.json`;
      try {
        await fs.writeFile(req, JSON.stringify({ mode, ...(root ? { cwd: root } : {}), items }));
        const r = await exec("sh", ["-c", '"$1" "$2" --batch < "$3" > "$4"', "sh", ...ZED(), req, out], { timeout: 60e3 });
        const res = r.code === 0 ? JSON.parse(await fs.readFile(out, "utf8")) : null;
        for (const { k, id } of miss) {
          const got = res?.files?.[k]?.lines;
          if (!Array.isArray(got)) continue;
          lines[k] = got;
          await fs.writeFile(cached(id, res.theme?.label ?? label), JSON.stringify({ lines: got })).catch(() => {});
        }
      } finally {
        await fs.unlink(req).catch(() => {});
        await fs.unlink(out).catch(() => {});
      }
    }
  }
  // Only the lines shown (DIFF-SPEC's cap): a big file's whole runs stay on disk.
  const keep = { old: lines.old ? {} : null, new: lines.new ? {} : null };
  for (const { line: l } of plan(f).rows) {
    if (!l || l.k === "\\") continue;
    if (l.k === "-") { if (keep.old) keep.old[l.o] = lines.old[l.o - 1]; }
    else if (keep.new) keep.new[l.n] = lines.new[l.n - 1];
  }
  return { mode, label, ...keep };
}

// One run of code: its color and style (1 italic, 2 bold), flex_none so a long line is clipped, not squeezed.
function run([text, color, style]) {
  if (!color && !style) return text;
  let el = div().flex_none().child(text);
  if (color) el = el.text_color(color);
  if (style & 1) el = el.italic();
  if (style & 2) el = el.font_weight(700);
  return el;
}

/** One file's unfolded body: an image's before/after when `o.preview` has one, then its unified diff. */
export function diffBody(t, p, f, o) {
  if (o.preview && IMAGE.test(f.path) && f.loaded !== false) {
    const pv = o.preview(f);
    const note = (text) => div().px(12).py(10).rounded(12).border(1).border_color(t.border).bg(t.background)
      .font_family(MONO).text_size(11.5).text_color(t.muted).child(text);
    const view = !pv ? note(tr("previewing")) : pv.error ? note(tr(`pv.${pv.error}`)) : previewBody(t, p, f, pv);
    if (f.binary || !f.hunks.length) return view;
    return v_flex().gap(8).child(view).child(textDiff(t, p, f, o));
  }
  return textDiff(t, p, f, o);
}

/** One file's unified diff (DIFF-SPEC: Gouttière et lignes). */
function textDiff(t, p, f, o) {
  const note = (text, color) => div().px(12).py(10).rounded(12).border(1).border_color(t.border).bg(t.background)
    .font_family(MONO).text_size(11.5).text_color(color ?? t.muted).child(text);
  if (f.loaded === false) return o.sk ? o.sk.pulse(v_flex().id(`${o.id}:${f.path}:sk`).px(12).py(10).gap(1).rounded(12).border(1).border_color(t.border).bg(t.background)
    .children([0.6, 0.85, 0.45, 0.7].map((w) => o.sk.line(w, { h: 6, lh: 17 })))) : note(tr("loading"));
  if (f.binary) return note(tr("binary"));
  if (!f.hunks.length) return note(f.status === "R" ? tr("renamed") : tr("noDiff"));
  words(f);
  const { rows, hidden } = plan(f);
  // o.tokens(f): colorize's answer for the appearance shown, or nothing (the text stays the theme's).
  const tk = o.tokens?.(f) ?? null;
  let top = 0;
  for (const r of rows) if (r.line) top = Math.max(top, r.line.o ?? 0, r.line.n ?? 0);
  const numW = (Math.max(3, String(top).length) + 2) * CH;
  const abs = o.root ? `${o.root}/${f.path}` : null;
  const id = `${o.id}:${f.path}`;
  const els = rows.map((r, i) => {
    if (r.gap) {
      return h_flex().flex_none().h(32).mt(i ? 8 : 0).mb(i < rows.length - 1 ? 8 : 0).px(CH * 2).items_center().rounded(6).bg(t.raised)
        .text_color(t.muted).child(tr("unchanged", { n: r.gap }));
    }
    const l = r.line, k = l.k;
    const fill = k === "+" ? p.addLine : k === "-" ? p.delLine : null;
    const cell = k === "+" ? p.addCell : k === "-" ? p.delCell : null;
    const num = k === "-" ? l.o : k === "\\" ? null : l.n;
    // The color from Zed's runs, the fill from the word spans: cut at both.
    const groups = pieces(l.text, !tk || k === "\\" ? null : k === "-" ? tk.old?.[l.o] : tk.new?.[l.n], l.spans);
    const code = groups?.length
      ? groups.flatMap((g) => (g.word ? [h_flex().flex_none().rounded(3).bg(k === "+" ? p.addWord : p.delWord).children(g.parts.map(run))] : g.parts.map(run)))
      : l.text || " ";
    return h_flex().flex_none().h(20).w_full()
      .when(k === "\\", (el) => el.opacity(0.6))
      .child(k === "+" ? div().w(4).h(20).flex_none().bg(p.ok) : k === "-" ? stripes(p.err) : div().w(4).flex_none())
      .child(h_flex().id(`${id}:n${i}`).w(numW).h_full().flex_none().justify_end().items_center().px(CH).text_color(t.muted)
        .when(Boolean(cell), (el) => el.bg(cell))
        .when(num != null, (el) => el.child(String(num)))
        .when(num != null && Boolean(abs), (el) => el.cursor_pointer().hover((s) => s.text_color(t.foreground)).on_click(() => zed(abs, num))))
      .child(div().w(2).h_full().flex_none())
      .child(h_flex().flex_1().min_w(0).h_full().items_center().pl(CH).overflow_hidden().whitespace_nowrap().text_color(t.foreground)
        .when(Boolean(fill), (el) => el.bg(fill))
        .when(Array.isArray(code), (el) => el.children(code))
        .when(!Array.isArray(code), (el) => el.child(code)));
  });
  return v_flex().id(`${id}:body`).max_h(576).overflow_y_scrollbar().py(6).rounded(12).border(1).border_color(t.border).bg(t.background)
    .font_family(CODE).text_size(12.5).line_height("20px")
    .children(els)
    .when(hidden > 0, (el) => el.child(div().id(`${id}:more`).flex_none().mt(8).px(12).py(6).font_family(MONO).text_size(11.5).text_color(p.warn)
      .when(Boolean(abs), (el) => el.cursor_pointer().on_click(() => zed(abs, 1)))
      .child(tr("moreHunks", { n: hidden }))));
}
