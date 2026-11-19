// panel.js: kbrdn Threads' side columns opening and closing with their content moving (#73): the right panel
// (the layout's "panel" column) and the left sidebar ("side"). Herdr doesn't animate a layout node, and
// stepping a column's width would resize the terminal at every step: so the column shows at once and its
// content glides in from 12 px aside (from the right for the panel, from the left for the sidebar) while it
// fades in (180 ms, ease-out); closing, the content glides out and fades (180 ms, ease-in), then ONE
// cx.timer.after hides the column. The terminal resizes once, at the start or at the end. Reduced motion:
// the column shows or hides at once, nothing moves. Written once in mods/kt-keys/panel.js and copied byte
// for byte, with motion.js, into each mod that uses it (edit here, copy, cmp). Bun checks it (panel.check.mjs).
//
//   kt-head (its button, ctrl-b p as kt-head.panel-toggle), kt-panel-head (close):  togglePanel(cx)
//   kt-head's panel:<surface> keys:                                                   showPanel(cx)
//   kt-panel-head and each mod of "panel-body", at the end of render:      return panelIn(this.motion, root)
//   the sidebar (ctrl-b shift-v as kt-head.side-toggle):                     toggleColumn("side", cx)
//   kt-threads and kt-head's brand block, at the end of render:  return columnIn("side", this.motion, root)
//
// The step is shared state, one per column ("kt.panel.motion", "kt.side.motion": { gen, dir: "in" | "out" |
// "done", at }), so every mod of a column draws the same one. Coming in, a copy first draws its content away
// (12 px aside, transparent, no transition) with a cue of that opening's own; the cue's first layout (motion.js
// enter()'s way) marks the copy ready, and the content glides to its place. Going out, it glides away; the
// timer hides the column, then says "done". Pressed again while it goes, it comes back (a newer step: the
// timer does nothing). A step older than a second is over and draws the content in place, as "done" does:
// a column shown another way, a reload, a surface picked later. The wrapper keeps one id, so the content's
// own ids (its scroll, its fields) keep their state. The timer belongs to the copy that calls: a popup that
// closes first (the picker) runs `kt-head.panel-toggle` instead, kt-head being always shown.

import { div } from "gpui-kit";
import { run, layout, shared, setShared } from "herdr";
import { MS, DY } from "./motion.js";

// Each column's side: its content comes from there, as far as a page moves (ANIMATIONS.md, DY.page).
const COLS = { panel: DY.page, side: -DY.page };
export const keyOf = (col) => `kt.${col}.motion`;
export const KEY = keyOf("panel");
// After this, a step is over (its timer ran long ago).
const OVER = 1000;

function shownIn(node, id) {
  if (!node) return false;
  if (node.id === id) return !node.hidden;
  return (node.children ?? []).some((c) => shownIn(c, id));
}
const live = (s, now = Date.now()) => Boolean(s) && now - (s.at ?? 0) < OVER;
const step = (col, dir) => setShared(keyOf(col), { gen: (shared(keyOf(col))?.gen ?? 0) + 1, dir, at: Date.now() });
/** The column shows and isn't on its way out. */
export const columnOpen = (col) => shownIn(layout(), col) && !(shared(keyOf(col))?.dir === "out" && live(shared(keyOf(col))));
const reducedNow = () => Boolean(shared("kt.reducedMotion"));

/** Shows a column: at once, then its content comes in; on its way out, it comes back. */
export function showColumn(col, _cx, reduced = reducedNow()) {
  if (columnOpen(col)) return;
  if (!shownIn(layout(), col)) run("layout.show", { id: col });
  step(col, reduced ? "done" : "in"); // a newer step: a close under way does nothing when its timer comes
}

/** Hides a column: its content goes, then ONE timer hides it. Nothing when it's hidden or going. */
export function hideColumn(col, cx, reduced = reducedNow()) {
  if (!columnOpen(col)) return;
  if (reduced) {
    run("layout.hide", { id: col });
    return void step(col, "done");
  }
  step(col, "out");
  const gen = shared(keyOf(col)).gen;
  cx.timer.after(MS.open, () => {
    if (shared(keyOf(col))?.gen !== gen) return;
    run("layout.hide", { id: col });
    setShared(keyOf(col), { gen, dir: "done", at: Date.now() });
  });
}

export const toggleColumn = (col, cx, reduced = reducedNow()) => (columnOpen(col) ? hideColumn(col, cx, reduced) : showColumn(col, cx, reduced));
// The right panel's, as before.
export const panelOpen = () => columnOpen("panel");
export const showPanel = (cx, reduced) => showColumn("panel", cx, reduced);
export const hidePanel = (cx, reduced) => hideColumn("panel", cx, reduced);
export const togglePanel = (cx, reduced) => toggleColumn("panel", cx, reduced);

/** Where a column's copy draws its content now: { x, opacity, easing (null: no transition), cue (the opening it
 *  waits for, else null) }. `ready`: the opening this copy has laid out; `dx`: how far aside. Pure. */
export function stepOf(s, now, ready, dx = COLS.panel) {
  if (live(s, now) && s.dir === "out") return { x: dx, opacity: 0, easing: "ease-in", cue: null };
  if (live(s, now) && s.dir === "in")
    return ready === s.gen ? { x: 0, opacity: 1, easing: "ease-out", cue: null } : { x: dx, opacity: 0, easing: null, cue: s.gen };
  return { x: 0, opacity: 1, easing: null, cue: null };
}

/** A column mod's root in its column's step. `m`: this copy's motion.js state (this.motion, after frame()). */
export function columnIn(col, m, root, s = shared(keyOf(col)), now = Date.now()) {
  let w = div().id(`kt-${col}-motion`).flex().flex_col().size_full().relative().child(root);
  if (m.reduced) return w;
  const ready = `${col}Ready`;
  const { x, opacity, easing, cue } = stepOf(s, now, m[ready], COLS[col]);
  w = w.left(x).opacity(opacity);
  if (easing) {
    const p = { duration: MS.open, delay: 0, easing };
    w = w.transition("left", p).transition("opacity", p);
  }
  if (cue == null) return w;
  return w.child(div().id(`kt-${col}-cue-${cue}`).absolute().top(0).left(0).size(1).on_size_change((_size, cx) => {
    if (m[ready] === cue) return;
    m[ready] = cue;
    cx.notify();
  }));
}
export const panelIn = (m, root, s, now) => columnIn("panel", m, root, s, now);
