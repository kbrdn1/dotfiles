// skeleton.js: the placeholders the kt-* / kbrdn-* mods show while their data loads, shaped like what is
// coming (data/orchestrator/ANIMATIONS.md 11, Skeleton.vue's animate-pulse). Written once in
// mods/kt-keys/skeleton.js and copied byte for byte into each mod that uses it, with motion.js beside it
// (a mod can't import from another folder): edit here, then copy, then `cmp`. No herdr import and no
// module state: the caller hands in theme() and its motion state, as viz.js. Check:
// bun mods/kt-keys/skeleton.check.mjs.
//
//   const S = skeleton(theme(), m);                  // m: frame(this.motion, …), or null (no motion)
//   S.line(120) · S.line(0.6) · S.line()             // a text line: px, a share of its parent, all of it
//   S.line(90, { h: 8, lh: 16 })                     // h: the bar, lh: the text line it stands for
//   S.circle(32) · S.circle(132, { ring: 12 })       // a dot, a logo; a ring (a donut's track)
//   S.block(320, 120, { r: 14 })                     // a card; skeleton(t, m, { band: ditherBand }):
//                                                    //   with a px width, its dither band on top
//   S.row({ h: 36, icon: 16, lines: [0.5, 0.3] })    // a list row: a mark, one or two lines
//   S.list(5, { h: 36, … })                          // n such rows (8 at most), widths varied
//   S.pulse(el)                                      // the loading region breathing: ONE loop, once around it
//   S.swap("kx-body", ready, (first) => content, () => skel, { grow })   // skeleton while !ready, then content fading in
//   rows(first ? still(m) : m, cx, …)                // in that content: the list lands at rest, no jump
//   S.arriving("kx-body")                            // that `first`, known before calling swap
//   readyFor(this.readFor, target)                   // that `ready`: read for the target followed now
//
// Its look: flat bars in t.border, cards in t.raised with their border, the interface's dither only on
// a card's band (DESIGN-REFERENCE.md: not on list rows, too busy). Bricks never move: the region they
// make breathes once (opacity 0.5 ↔ 1, 2 s, motion.js pulse), a native loop drawn only while loading,
// none in reduced motion. So a skeleton costs one loop and a bounded handful of elements (a list: 1 +
// 5 per row, 8 rows at most). Dimensions: the real ones (the row's height, the card's size, the line
// height of the text it stands for), so nothing jumps when the data comes.

import { div } from "gpui-kit";
import { enter, pulse as breathe } from "./motion.js";

export const MAX_ROWS = 8;
// A list's line widths vary row to row, as text does (deterministic: a render changes nothing).
const VARY = [1, 0.78, 0.9, 0.66, 0.84, 0.72, 0.95, 0.6];
const alpha = (c, a) => `${String(c).slice(0, 7)}${a}`; // replaces any alpha (glass themes are #rrggbbaa)
// A width: px, a share of the parent (0 < w ≤ 1), or the whole of it (null / undefined).
const width = (el, w) => (w == null ? el.w_full() : w <= 1 ? el.w(`${Math.round(w * 100)}%`) : el.w(w));
const call = (x) => (typeof x === "function" ? x() : x);

export function skeleton(t, m = null, { band } = {}) {
  const fill = t.border;

  // A bar the height of a text glyph, in the line box of the text it stands for (no jump).
  function line(w = null, { h = 8, lh = 16, r = 3 } = {}) {
    return width(div().flex_none().h(h).my(Math.max(0, (lh - h) / 2)).rounded(r).bg(fill), w);
  }

  function circle(d, { ring = 0 } = {}) {
    const el = div().flex_none().size(d).rounded_full();
    return ring ? el.border(ring).border_color(fill) : el.bg(fill);
  }

  // A card: raised, bordered, rounded; with `band` (dither.js' ditherBand, handed in so a copy without
  // dither.js still loads) and a px width, the interface's band across its top, faint.
  function block(w = null, h = 80, { r = 12, tint = t.foreground } = {}) {
    const el = width(div().relative().overflow_hidden().flex_none().h(h).rounded(r).border(1).border_color(fill).bg(t.raised), w);
    const b = band && typeof w === "number" && w > 1 ? band(w - 2, Math.min(h - 2, 40), Math.max(0, r - 1), alpha(tint, "1f")) : null;
    return b ? el.child(b) : el;
  }

  // A row: its mark (icon px square, rounded; `round`: a circle; 0: none) and one or two lines, the
  // second shorter and fainter in size. `k` varies the widths (a list's row index).
  function row({ h = 36, icon = 16, round = false, lines = [0.5, 0.3], px = 10, gap = 10, k = 0 } = {}) {
    const v = VARY[k % VARY.length];
    const bars = lines.slice(0, 2).map((w, i) =>
      line(w <= 1 ? Math.max(0.12, w * v) : Math.round(w * v), i ? { h: 6, lh: 12 } : { h: 8, lh: 14 }));
    return div().flex_none().w_full().h(h).px(px).gap(gap).flex().items_center()
      .when(icon > 0, (el) => el.child(round ? circle(icon) : div().flex_none().size(icon).rounded(Math.min(6, icon / 3)).bg(fill)))
      .when(bars.length > 0, (el) => el.child(div().flex_1().min_w(0).flex().flex_col().gap(2).children(bars)));
  }

  function list(n, opts = {}) {
    const k = Math.max(0, Math.min(MAX_ROWS, n | 0));
    return div().flex_none().w_full().flex().flex_col().gap(opts.gap_y ?? 0)
      .children(Array.from({ length: k }, (_, i) => row({ ...opts, k: i })));
  }

  // The loading region, breathing: put once around the whole skeleton, never on its bricks (a loop each
  // would multiply). Reduced motion or no motion state: still.
  const pulse = (el) => (m ? breathe(m, el, true) : el);

  // The skeleton while !ready (`ready`: readyFor(), the data was read for the target shown now, never
  // "not busy": a reload keeps the old data on screen, DATA-SYNC.md), breathing under the id `${id}~sk`;
  // `skel` has no id of its own. Back to the skeleton (another target), the content fades in again. Then the
  // content: at once when no skeleton stood there (content at hand, as before); else faded in (enter,
  // no rise) in a box of its own, so the content keeps its ids and handlers: `grow`, a flex_1 column
  // (a scrolling body, a virtual list), else a full-width column. `content(first)`: `first` on the
  // render it comes in (arriving(id), also callable before). A list there hands rows() `still(m)`, so
  // it lands at rest under the fade instead of opening from 0 (a jump). Not around what has its own
  // entry (viz.js, sharpen, enter): opacities multiply.
  function swap(id, ready, content, skel, { grow = false } = {}) {
    const key = `${id}~sk`;
    const make = (first) => (typeof content === "function" ? content(first) : content);
    const st = m && !m.reduced ? (m.st ??= new Map()) : null;
    if (!ready) {
      if (st) { st.set(key, true); m.used.set(key, m.gen); }
      return pulse(call(skel).id(key));
    }
    if (!st?.has(key)) return make(false);
    const first = arriving(id);
    m.used.set(key, m.gen);
    const box = grow ? div().flex_1().min_h(0).min_w(0).flex().flex_col() : div().w_full().flex_none().flex().flex_col();
    return enter(m, box.child(make(first)), `${id}~in`, { dy: 0 });
  }

  // Whether swap(id, …) brings its content in on this render (a skeleton stood there, the fade not run).
  const arriving = (id) => Boolean(m && !m.reduced && m.st?.has(`${id}~sk`) && !m.shown.has(`${id}~in`));

  return { line, circle, block, row, list, pulse, swap, arriving };
}

// Whether what a panel shows was read for the target it follows now (a terminal, a thread's folder, a
// repo: any key, compared with ===). `readFor`: the target its last read answered for, a failed read
// included (an answer: no skeleton left standing), undefined before the first. The data existing is not
// enough: after a change of target, the previous one's data is still there until the new read answers.
// So: another target than the one read, not ready (the skeleton, never the previous target's data); the
// same target read again, ready (what is shown stays); no target (null), ready: there is nothing to read,
// the panel says why. Pure: skeleton.check.mjs.
export const readyFor = (readFor, target) => target == null || readFor === target;

// motion.js' state seen as reduced for one call: rows() then shows its rows at rest and records them,
// so the next (animated) render takes them as they are. For the render content comes in after a
// skeleton (swap's `first`). Same maps, so nothing is lost.
export const still = (m) => (m ? { ...m, reduced: true } : m);
