// motion.js: the motion every kt-* / kbrdn-* mod shares (data/orchestrator/ANIMATIONS.md). Written once in
// mods/kt-keys/motion.js and copied byte for byte into each mod that uses it (a mod can't import from
// another folder): edit here, then copy. No herdr import and no module state (copies of a mod share
// module code): the state is made in init and the caller reads reduced motion. Bun checks it
// (motion.check.mjs). Native only: gpui's transition and loop on opacity, width, height, left, top. No
// timer, nothing runs once a transition has landed.
//
//   init:   this.motion = motionState();
//   render: const m = frame(this.motion, Boolean(shared("kt.reducedMotion")));   // once, at the top
//           enter(m, v_flex()…, "kd-body-" + tab)        // fades in and rises 6 px when it first draws
//           collapse(m, "kd-file-" + path, open, body)   // opens on its height and fades with it; null closed
//           ink(m, div().id("seg-ink")…)                 // an indicator gliding to its new left/top/width/height
//           fade(m, div().id("row-hover")…, hovered)     // a layer coming and going: hover fill, focus ring
//           pulse(m, el, loading)                         // a skeleton breathing, while it loads only

import { div } from "gpui-kit";

// Kylian's budget: a hover or a small toggle, an opening or a fold, a panel at most.
export const MS = { hover: 120, open: 180, panel: 240 };
// gpui takes named curves only: ease-out is the nearest to the portfolio's quint (0.22, 1, 0.36, 1).
const policy = (duration, delay = 0, easing = "ease-out") => ({ duration, delay, easing });

export function motionState() {
  return { gen: 0, used: new Map(), shown: new Set(), h: new Map(), reduced: false };
}

// Once per render, before the helpers: forgets what the last render did not draw, so a tab coming back
// fades in again and nothing grows forever. Returns the state, with this render's reduced motion.
export function frame(m, reduced) {
  for (const [id, g] of m.used) if (g < m.gen) { m.used.delete(id); m.shown.delete(id); m.h.delete(id); }
  m.gen++;
  m.reduced = Boolean(reduced);
  return m;
}

// A block that fades in (and rises `dy` px) when it first draws: a popup, a tab's content, a new row.
// `el` is a div / h_flex / v_flex with no id and no on_size_change of its own: enter() gives it `id` and
// takes its first layout as the cue, so it costs one more render, then nothing. A new id is a new
// block (the content of another tab): it starts over. `delay`: a short stagger (stagger()).
export function enter(m, el, id, { dy = 6, ms = MS.open, delay = 0 } = {}) {
  el = el.id(id);
  if (m.reduced) return el;
  m.used.set(id, m.gen);
  const on = m.shown.has(id);
  if (dy) el = el.relative().top(on ? 0 : dy).transition("top", policy(ms, delay));
  return el.opacity(on ? 1 : 0).transition("opacity", policy(ms, delay))
    .on_size_change((_size, cx) => {
      if (m.shown.has(id)) return;
      m.shown.add(id);
      cx.notify();
    });
}

// The delay of row i of n for enter(): a short cascade on a small list, none on a long one.
export const stagger = (i, n) => (n > 12 ? 0 : Math.min(i, 5) * 30);

// A fold opening on its height, fading with it (Expand.vue). Measured from its content, again whenever
// that changes (a diff that loads), so nothing is clipped. Closed, it is null: it shuts at once (an
// animated close would keep the content drawn, then need a timer to drop it). `body` keeps its own ids
// and handlers: collapse() wraps it. Not around a list / uniform_list, which needs a definite height.
export function collapse(m, id, open, body, { ms = MS.open } = {}) {
  if (!open) {
    m.h.delete(id);
    return null;
  }
  if (m.reduced) return body;
  m.used.set(id, m.gen);
  const h = m.h.get(id);
  return div().id(id).w_full().flex_none().overflow_hidden().h(h ?? 0).opacity(h === undefined ? 0 : 1)
    .transition("height", policy(ms)).transition("opacity", policy(ms))
    .child(div().id(`${id}~in`).w_full().flex_none().child(body)
      .on_size_change((size, cx) => {
        if (m.h.get(id) === size.height) return;
        m.h.set(id, size.height);
        cx.notify();
      }));
}

// An indicator gliding to its new place (SegmentInk.vue, .ink): it lands at once the first time, then
// glides. `el` has a stable id. Reduced motion: it jumps, still showing where it is.
export const ink = (m, el, ms = MS.panel) =>
  m.reduced ? el : ["left", "top", "width", "height"].reduce((e, k) => e.transition(k, policy(ms, 0, "ease-in-out")), el);

// A layer coming and going in place: a hover fill, a focus ring, a selection. gpui animates no color,
// so it is a layer over the row (absolute, size_full) whose opacity moves. `el` has a stable id.
export const fade = (m, el, on, ms = MS.hover) =>
  m.reduced ? el.opacity(on ? 1 : 0) : el.opacity(on ? 1 : 0).transition("opacity", policy(ms));

// A placeholder breathing while it loads (Skeleton.vue's animate-pulse), and only then.
export const pulse = (m, el, on) => (on && !m.reduced ? el.loop("opacity", { from: 0.5, to: 1, period: 2000 }) : el);
