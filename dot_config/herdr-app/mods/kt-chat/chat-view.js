// kt-chat's choices that herdr-app check can't reach, pure (herdr's calls and tr passed in):
// which agent the Chat shows, the words of a fold, which turns are drawn and where the view goes
// when more are. Checked by chat-view.check.mjs.

const isClaude = (a) => a?.program?.key === "claude" || /^claude/.test(a?.app ?? "");

/**
 * The Chat's agent: the shown tab's Claude agent, the focused pane's first (when the Chat has the
 * keyboard, focused().terminal is no longer the agent's, the tab's focused pane still is). Or why
 * there is none: { reason: "noAgent" | "notClaude" (with app) | "remote" (with machine) }.
 */
export function pickTarget({ focused, agents, panes }) {
  const tab = focused()?.tab;
  const mine = tab ? agents().filter((a) => a.tab === tab) : [];
  if (!mine.length) return { reason: "noAgent" }; // i18n: tech
  const pane = panes().find((p) => p.tab === tab && p.focused && p.terminal);
  const claude = mine.filter(isClaude);
  const a = claude.find((x) => x.address === pane?.terminal) ?? claude[0];
  if (!a) {
    const o = mine.find((x) => x.address === pane?.terminal) ?? mine[0];
    return { reason: "notClaude", app: o.program?.name ?? o.app ?? "" }; // i18n: tech
  }
  if (a.address.includes("/")) return { reason: "remote", agent: a, machine: a.address.split("/")[0] }; // i18n: tech
  return { agent: a };
}

/** The words of a tally (chat-model.js): « 4 lectures · 2 modifs », in the order the work was done. */
export function tallyText(c, tr) {
  const parts = [];
  for (const k of c.order) {
    if (k === "research") {
      if (c.reads) parts.push(tr("count.reads", { n: c.reads }));
      if (c.searches) parts.push(tr("count.searches", { n: c.searches }));
    } else if (k === "edit") parts.push(tr("count.edits", { n: c.edits }));
    else if (k === "run") parts.push(tr("count.runs", { n: c.runs }));
    else if (k === "agent") parts.push(tr("count.agents", { n: c.agents }));
    else parts.push(tr("count.others", { n: c.others }));
  }
  if (!c.order.length && c.thoughts) parts.push(tr("count.thoughts", { n: c.thoughts }));
  if (c.notes) parts.push(tr("count.notes", { n: c.notes }));
  if (c.errors) parts.push(tr("count.errors", { n: c.errors }));
  return parts.join(" · ");
}

function find(node, id) {
  if (node?.id === id) return node;
  for (const child of node?.children ?? []) {
    const found = find(child, id);
    if (found) return found;
  }
  return null;
}
const shownChild = (stack) => stack?.active ?? stack?.children?.[0]?.id;

/** Does the layout show the thread on its Chat face (stack view on thread, thread-body on chat)? */
export function chatShown(root) {
  const body = find(root, "thread-body");
  const page = find(root, "view");
  return shownChild(body) === "chat" && (!page || shownChild(page) === "thread");
}

/**
 * The live tail's next move (#55), at a render: `delta` reads what the session wrote since the last
 * read (the face came back on screen, or the agent's status changed: the last lines of a turn),
 * `tick` keeps a timer reading deltas (the face shows and its agent works). At rest: neither.
 */
export function liveStep({ shown, wasShown, status, lastStatus, hasState, fixed }) {
  const delta = Boolean(hasState) && ((shown && !wasShown) || (lastStatus !== undefined && status !== lastStatus));
  const tick = Boolean(shown) && status === "working" && !fixed;
  return { delta, tick };
}

/**
 * The scroll child (0 is the head: « Tours précédents » or « Début de la session ») of the turn
 * now at index `at` among all turns, when the first drawn is `first` (turn-window.js: which ones).
 */
export const childOf = (at, first) => 1 + at - first;

// ── Monocode's words (#75) ──────────────────────────────────────────────────

/**
 * A Claude model id as a name: "claude-opus-5-5" → "Opus 5.5", "claude-sonnet-4-5-20250929" →
 * "Sonnet 4.5" (the date dropped); anything else as it is; "" for none or "<synthetic>".
 */
export function modelName(id) {
  const s = String(id ?? "").trim();
  if (!s || s.startsWith("<")) return "";
  const m = s.match(/^claude-([a-z]+)((?:-\d{1,2})*)(?:-\d{8})?$/i);
  if (!m) return s;
  const family = m[1][0].toUpperCase() + m[1].slice(1);
  const version = m[2].split("-").filter(Boolean).join(".");
  return version ? `${family} ${version}` : family;
}

/** Monocode's « worked for » duration: « 42s », « 3m », « 3m 12s » (rounded to the second, 1 s at least). */
export function workedFor(ms) {
  const s = Math.max(1, Math.round((ms ?? 0) / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60), r = s % 60;
  return r ? `${m}m ${r}s` : `${m}m`;
}

/**
 * A long message folded to its first `lines` wrapped lines (Monocode: a prompt past four lines is
 * clamped under « Show more », transcript.rs:5275-5282, 5359). The wrap is estimated: `cols`
 * characters a line, a line of no space cut there too. { text, cut }: the folded text (ending « … »
 * when cut) and whether anything was left out.
 */
export function clampText(text, { lines = 4, cols = 76 } = {}) {
  const src = String(text ?? "").replace(/\s+$/, "");
  const out = [];
  let used = 0;
  for (const line of src.split("\n")) {
    const need = Math.max(1, Math.ceil(line.length / cols));
    if (used + need > lines) {
      const room = (lines - used) * cols;
      if (room > 0) out.push(line.slice(0, Math.max(0, room - 1)));
      return { text: out.join("\n").replace(/\s+$/, "") + "…", cut: true };
    }
    out.push(line);
    used += need;
  }
  return { text: src, cut: false };
}

/**
 * Markdown folded on its SOURCE, before it is drawn, never in the middle of its syntax: `lines`
 * visual lines of `cols` and `chars` characters at most (Monocode's interjection: four lines, 300
 * characters, transcript.rs:4798), cut after a whole word, then what the cut left open is closed
 * again: a code fence, an inline code span, a `**` of the last paragraph; a link never finished is
 * dropped from its `[`. { text, cut }: the text to draw, and whether something was left out.
 */
export function foldMd(text, { lines = 4, cols = 110, chars = 300 } = {}) {
  const src = String(text ?? "").replace(/\s+$/, "");
  const c = clampText(src, { lines, cols });
  let out = c.cut ? c.text.replace(/…$/, "") : src;
  let cut = c.cut;
  if (out.length > chars) {
    out = out.slice(0, chars);
    cut = true;
  }
  if (!cut) return { text: src, cut: false };
  const word = out.search(/\s\S*$/); // the partial word at the end goes
  if (word > out.length * 0.6) out = out.slice(0, word);
  out = out.replace(/\s+$/, "");
  if ((out.match(/^\s*(```|~~~)/gm) ?? []).length % 2) {
    // Inside code: whole lines only (a code line cut at a word reads as a bug), then the fence closed.
    const kept = out.split("\n");
    if (kept.length > 2 && src.split("\n")[kept.length - 1] !== kept[kept.length - 1]) kept.pop();
    return { text: `${kept.join("\n")}\n\`\`\``, cut: true };
  }
  const nl = out.lastIndexOf("\n");
  let last = out.slice(nl + 1);
  const open = last.lastIndexOf("[");
  if (open >= 0 && !/\]\([^)]*\)/.test(last.slice(open))) last = last.slice(0, open).replace(/\s+$/, "");
  out = out.slice(0, nl + 1) + last;
  const para = out.slice(out.lastIndexOf("\n\n") + 1);
  const ticks = (para.match(/`/g) ?? []).length % 2;
  const outside = para.replace(/`[^`]*`/g, "").replace(/`[^`]*$/, "");
  const close = ticks ? "`" : (outside.match(/\*\*/g) ?? []).length % 2 ? "**" : "";
  return { text: `${out}…${close}`, cut: true };
}

/**
 * A notice's header (the mod translates `key` with `vars`): who, and what happened, the sender's
 * own summary when there is one, never made up. Kylian (2026-11-19): « hub-dev a fini son tour »,
 * not « idle notification »; « claude-80 (session) » for another session; a task's name.
 */
export function noticeHead(from) {
  const name = from?.name || null;
  const summary = from?.summary || null;
  if (from?.kind === "task") {
    const st = String(from.status ?? "completed");
    const how = st === "completed" ? "" : /^(killed|stopped|cancell?ed|interrupted)$/.test(st) ? "Stopped" : "Failed";
    return { key: `head.task${how}${from.task ? "Named" : ""}`, vars: { name: from.task ?? "" } };
  }
  if (from?.kind === "peer") return { key: summary ? "head.peerSaid" : "head.peer", vars: { name, summary } };
  if (from?.kind === "teammate") {
    if (from.idle) return { key: summary ? "head.idleSaid" : "head.idle", vars: { name, summary } };
    return { key: summary ? "head.said" : "head.msg", vars: { name, summary } };
  }
  return { key: "sentDuring", vars: {} };
}

/** Monocode's `content(a)` token: the theme's ink (foreground) at alpha `a`, as #rrggbbaa. */
export const ink = (t, a) => `${String(t.foreground).slice(0, 7)}${Math.round(Math.min(1, Math.max(0, a)) * 255).toString(16).padStart(2, "0")}`;

// ── The project's background (#57) ──────────────────────────────────────────

/**
 * The registry project (shared kt.projects) a session's folder belongs to: the longest folder that is
 * `cwd` or holds it, else the one whose folder is the repo's main checkout `root` (a worktree lives
 * elsewhere). This computer's projects only. null when none.
 */
export function projectOf(entries, cwd, root) {
  const mine = (entries ?? []).filter((e) => !e.machine && e.folder);
  const under = (dir) => mine.filter((e) => dir && (dir === e.folder || dir.startsWith(e.folder + "/"))).sort((a, b) => b.folder.length - a.folder.length)[0];
  return under(cwd) ?? under(root) ?? null;
}

export const OPACITY = { min: 0.05, max: 0.65, step: 0.04, dflt: 0.24 };
export const CELL_SIZES = [2, 4, 6];

/** A project's settings, as stored (shared kt.chat.backgrounds[id]), with the defaults and bounds. */
export function bgSettings(raw) {
  if (!raw?.src) return null;
  const o = Number(raw.opacity);
  return {
    src: raw.src, w: raw.w ?? null, h: raw.h ?? null,
    cell: CELL_SIZES.includes(raw.cell) ? raw.cell : 2,
    color: raw.color === "project" ? "project" : "photo",
    opacity: Number.isFinite(o) ? Math.min(OPACITY.max, Math.max(OPACITY.min, Math.round(o * 100) / 100)) : OPACITY.dflt,
    scope: raw.scope === "empty" ? "empty" : "all",
  };
}

// What chat-bg.ts writes in data/kt-chat: a kept source, a dithered texture. Nothing else there is ours.
const SRC = /^src-([0-9a-f]{8})\.png$/;
const TEX = /^bg-([0-9a-f]{8})-(\d+)-(photo|[0-9a-f]{6})\.png$/;

/**
 * The files of data/kt-chat no setting refers to any more (shared kt.chat.backgrounds), to unlink one
 * by one. Kept: each setting's source (src-<hash>.png) and its texture at its cell: « photo », or any
 * tint for « project » (the project's color isn't in the setting, and it may change). Only names in
 * chat-bg.ts' two patterns are ever listed.
 */
export function orphans(names, all) {
  const keep = { src: new Set(), tex: [] };
  for (const raw of Object.values(all ?? {})) {
    const s = bgSettings(raw);
    const h = s?.src?.split("/").pop()?.match(SRC)?.[1];
    if (!h) continue;
    keep.src.add(h);
    keep.tex.push({ h, cell: String(s.cell), photo: s.color === "photo" });
  }
  return (names ?? []).filter((n) => {
    const src = n.match(SRC);
    if (src) return !keep.src.has(src[1]);
    const tex = n.match(TEX);
    if (!tex) return false;
    return !keep.tex.some((k) => k.h === tex[1] && k.cell === tex[2] && (k.photo ? tex[3] === "photo" : tex[3] !== "photo"));
  });
}

// Monocode's background_fade (crates/monocode-core/src/project_appearance.rs), for a conversation
// and for an empty one: 1 at the top, gone by 72 % of the view's height.
const FADE = {
  session: [[0, 1], [0.18, 1], [0.32, 0.61], [0.47, 0.32], [0.62, 0.11], [0.72, 0]],
  empty: [[0, 1], [0.19, 1], [0.3, 0.79], [0.42, 0.5], [0.54, 0.2], [0.64, 0.05], [0.72, 0]],
};
export function fadeAt(y, empty = false) {
  const stops = empty ? FADE.empty : FADE.session;
  for (let i = 1; i < stops.length; i++) {
    const [a, va] = stops[i - 1], [b, vb] = stops[i];
    if (y <= b) return va + (vb - va) * Math.min(1, Math.max(0, (y - a) / (b - a)));
  }
  return 0;
}

/**
 * A veil under the reading column, where the background shows (Kylian, 2026-11-19: the dither's
 * cells ran through the letters). Monocode needs none: its artwork is smooth and fades at the same
 * place (fadeAt); our Bayer cells are hard 2 px dots that break a glyph's edges even at 0.24, and a
 * lower default would also dim the sides Kylian wants to see. So the column alone gets a veil of the
 * theme's ground at VEIL, following the same fade (none where the image is gone), as two rectangles:
 * full to the fade's first stop, then a top-to-bottom gradient to nothing at its last. Kept off the
 * view's rounded top corners (`r`). [{ x, y, w, h, fade }].
 */
export const VEIL = 0.5;
export function veilRects({ w, h, column = 832, r = 16, empty = false }) {
  if (!(w > 0 && h > 0)) return [];
  const x = Math.max(r, Math.floor((w - column) / 2));
  const x1 = Math.min(w - r, Math.ceil((w + column) / 2));
  if (x1 <= x) return [];
  const stops = empty ? FADE.empty : FADE.session;
  const y1 = Math.round(h * stops[1][0]);
  const y2 = Math.round(h * stops[stops.length - 1][0]);
  return [{ x, y: 0, w: x1 - x, h: y1, fade: false }, { x, y: y1, w: x1 - x, h: y2 - y1, fade: true }];
}

/**
 * The background's layers in a w × h view: the image covers it at a WHOLE scale (cells stay sharp:
 * 1 image px = 1, 2, 3… logical px), centred across, from the top, cropped by the view; it shows
 * through `windows` (dither.js bandWindows: nothing crosses the rounded corners), each cut in steps of
 * `band` px whose opacity follows the fade (the fade belongs to the view, not to the texture).
 * [{ x, y, w, h, o, ix, iy, iw, ih }]: a window, its opacity, the image's place and size in it.
 */
export function bgLayers({ w, h, iw, ih, windows, opacity, empty = false, band = 16 }) {
  if (!(w > 0 && h > 0 && iw > 0 && ih > 0)) return [];
  const s = Math.max(1, Math.ceil(Math.max(w / iw, h / ih)));
  const dw = iw * s, dh = ih * s;
  const ox = Math.floor((w - dw) / 4) * 2; // centred, on an even px
  const out = [];
  for (const [x, y, ww, hh] of windows) {
    for (let y0 = y; y0 < y + hh;) {
      const y1 = Math.min(y + hh, (Math.floor(y0 / band) + 1) * band);
      const o = Math.round(opacity * fadeAt((y0 + y1) / 2 / h, empty) * 1000) / 1000;
      const last = out[out.length - 1];
      if (o >= 0.005) {
        // Steps of the same opacity, one above the other in the same columns, are one window.
        if (last && last.o === o && last.x === x && last.w === ww && last.y + last.h === y0) last.h += y1 - y0;
        else out.push({ x, y: y0, w: ww, h: y1 - y0, o, ix: ox - x, iy: -y0, iw: dw, ih: dh });
      }
      y0 = y1;
    }
  }
  return out;
}
