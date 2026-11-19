// panel.js: kbrdn Threads' right panel (the layout's "panel" column) opening and closing with its content
// moving (#73). Herdr doesn't animate a layout node, and stepping the column's width would resize the
// terminal at every step: so the column shows at once and its content glides in from 12 px right while it
// fades in (180 ms, ease-out); closing, the content glides out and fades (180 ms, ease-in), then ONE
// cx.timer.after hides the column. The terminal resizes once, at the start or at the end. Reduced motion:
// the column shows or hides at once, nothing moves. Written once in mods/kt-keys/panel.js and copied byte
// for byte, with motion.js, into each mod that uses it (edit here, copy, cmp). Bun checks it (panel.check.mjs).
//
//   kt-head (its button, ctrl-b p as kt-head.panel-toggle), kt-panel-head (close):  togglePanel(cx)
//   kt-head's panel:<surface> keys:                                                   showPanel(cx)
//   kt-panel-head and each mod of "panel-body", at the end of render:      return panelIn(this.motion, root)
//
// The step is shared state ("kt.panel.motion": { gen, dir: "in" | "out" | "done", at }), so every panel mod
// draws the same one. Coming in, a copy first draws its content away (12 px right, transparent, no
// transition) with a cue of that opening's own; the cue's first layout (motion.js enter()'s way) marks the
// copy ready, and the content glides to its place. Going out, it glides away; the timer hides the column,
// then says "done". Pressed again while it goes, it comes back (a newer step: the timer does nothing). A
// step older than a second is over and draws the content in place, as "done" does: the panel shown another
// way (kt-details, the picker), a reload, a surface picked later. The wrapper keeps one id, so the content's
// own ids (its scroll, its fields) keep their state.

import { div } from "gpui-kit";
import { run, layout, shared, setShared } from "herdr";
import { MS, DY } from "./motion.js";

export const KEY = "kt.panel.motion";
// The body of a panel moves as far as a page does (ANIMATIONS.md, DY.page), sideways here.
const DX = DY.page;
// After this, a step is over (its timer ran long ago).
const OVER = 1000;

function shownIn(node, id) {
  if (!node) return false;
  if (node.id === id) return !node.hidden;
  return (node.children ?? []).some((c) => shownIn(c, id));
}
const live = (s, now = Date.now()) => Boolean(s) && now - (s.at ?? 0) < OVER;
const step = (dir) => setShared(KEY, { gen: (shared(KEY)?.gen ?? 0) + 1, dir, at: Date.now() });
/** The panel shows and isn't on its way out. */
export const panelOpen = () => shownIn(layout(), "panel") && !(shared(KEY)?.dir === "out" && live(shared(KEY)));
const reducedNow = () => Boolean(shared("kt.reducedMotion"));

/** Shows the panel: the column at once, then its content comes in; on its way out, it comes back. */
export function showPanel(_cx, reduced = reducedNow()) {
  if (panelOpen()) return;
  if (!shownIn(layout(), "panel")) run("layout.show", { id: "panel" });
  step(reduced ? "done" : "in"); // a newer step: a close under way does nothing when its timer comes
}

/** Hides the panel: its content goes, then ONE timer hides the column. Nothing when it's hidden or going. */
export function hidePanel(cx, reduced = reducedNow()) {
  if (!panelOpen()) return;
  if (reduced) {
    run("layout.hide", { id: "panel" });
    return void step("done");
  }
  step("out");
  const gen = shared(KEY).gen;
  cx.timer.after(MS.open, () => {
    if (shared(KEY)?.gen !== gen) return;
    run("layout.hide", { id: "panel" });
    setShared(KEY, { gen, dir: "done", at: Date.now() });
  });
}

export const togglePanel = (cx, reduced = reducedNow()) => (panelOpen() ? hidePanel(cx, reduced) : showPanel(cx, reduced));

/** Where a panel copy draws its content now: { x, opacity, easing (null: no transition), cue (the opening it
 *  waits for, else null) }. `ready`: the opening this copy has laid out. Pure. */
export function stepOf(s, now, ready) {
  if (live(s, now) && s.dir === "out") return { x: DX, opacity: 0, easing: "ease-in", cue: null };
  if (live(s, now) && s.dir === "in")
    return ready === s.gen ? { x: 0, opacity: 1, easing: "ease-out", cue: null } : { x: DX, opacity: 0, easing: null, cue: s.gen };
  return { x: 0, opacity: 1, easing: null, cue: null };
}

/** A panel mod's root in the shared step. `m`: this copy's motion.js state (this.motion, after frame()). */
export function panelIn(m, root, s = shared(KEY), now = Date.now()) {
  let w = div().id("kt-panel-motion").flex().flex_col().size_full().relative().child(root);
  if (m.reduced) return w;
  const { x, opacity, easing, cue } = stepOf(s, now, m.panelReady);
  w = w.left(x).opacity(opacity);
  if (easing) {
    const p = { duration: MS.open, delay: 0, easing };
    w = w.transition("left", p).transition("opacity", p);
  }
  if (cue == null) return w;
  return w.child(div().id(`kt-panel-cue-${cue}`).absolute().top(0).left(0).size(1).on_size_change((_size, cx) => {
    if (m.panelReady === cue) return;
    m.panelReady = cue;
    cx.notify();
  }));
}
