// motion.js: the motion every kt-* / kbrdn-* mod shares (data/orchestrator/ANIMATIONS.md). Written once in
// mods/kt-keys/motion.js and copied byte for byte into each mod that uses it (a mod can't import from
// another folder): edit here, then copy. No herdr import and no module state (copies of a mod share
// module code): the state is made in init and the caller reads reduced motion. Bun checks it
// (motion.check.mjs). Native only: gpui's transition and loop on opacity, width, height, left, top. No
// repeating timer: what goes away (rows(), leave(), a closing collapse()) is dropped by ONE one-shot
// cx.timer.after once its transition ran, and nothing runs once a transition has landed.
//
//   init:   this.motion = motionState();
//   render: const m = frame(this.motion, Boolean(shared("kt.reducedMotion")));   // once, at the top
//           enter(m, v_flex()…, "kd-body-" + tab)        // fades in and rises 6 px when it first draws
//           collapse(m, "kd-file-" + path, open, body)   // opens on its height and fades with it; null closed
//           collapse(m, id, open, () => body, { cx })     // a builder: it also closes on its height
//           const s = sheet(m, "kk", shown); s.veil(veil…); s.card(card…)   // an overlay's veil and card, in and out
//           leave(m, cx, "kk", (cx) => closeOverlay(props().overlay))     // the overlay goes away, then closes
//           rows(m, cx, "kd-files", files, (f) => f.path, (f, i) => row(f, i))   // rows opening and closing in order
//           sharpen(m, "kd-title-" + tab, () => div()…)  // a heading coming into focus
//           ink(m, div().id("seg-ink")…)                 // an indicator gliding to its new left/top/width/height
//           fade(m, div().id("row-hover")…, hovered)     // a layer coming and going: hover fill, focus ring
//           pulse(m, el, loading)                         // a skeleton breathing, while it loads only

import { div } from "gpui-kit";

// Kylian's budget: a hover or a small toggle, an opening or a fold, a panel at most; what leaves goes
// a little faster than it came (the portfolio's page-out, ease-in).
export const MS = { hover: 120, open: 180, panel: 240, leave: 140 };
// How far a block rises as it comes in, in a parent that clips: a row or a popup (swap-up's 0.5em), a
// page or a tab (tab-switch's 24 px in 0.4 s, at the same speed in Kylian's 180 ms).
export const DY = { row: 6, page: 12 };
// gpui takes named curves only: ease-out is the nearest to the portfolio's quint (0.22, 1, 0.36, 1).
const policy = (duration, delay = 0, easing = "ease-out") => ({ duration, delay, easing });

export function motionState() {
  return { gen: 0, used: new Map(), shown: new Set(), h: new Map(), st: new Map(), reduced: false };
}

// Once per render, before the helpers: forgets what the last render did not draw, so a tab coming back
// fades in again and nothing grows forever. Returns the state, with this render's reduced motion.
export function frame(m, reduced) {
  for (const [id, g] of m.used) if (g < m.gen) { m.used.delete(id); m.shown.delete(id); m.h.delete(id); m.st?.delete(id); }
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
// that changes (a diff that loads), so nothing is clipped. `body` keeps its own ids and handlers:
// collapse() wraps it. Not around a list / uniform_list, which needs a definite height.
// Closing: an element (or null) shuts at once, as before. A builder (`() => body`) closes on its height
// too: it is built once more and folds to 0 while it fades (ease-in-out), then goes, by ONE
// cx.timer.after when `cx` is given, else at the first render past `ms` (folded, it shows nothing).
// gpui consumes an element once drawn, so a closing fold needs its body built again: hence the builder.
export function collapse(m, id, open, body, { ms = MS.open, cx } = {}) {
  const all = (m.st ??= new Map());
  const shut = `${id}~shut`;
  if (!open) {
    const h = m.h.get(id);
    let at = all.get(shut);
    if (!m.reduced && h !== undefined && typeof body === "function" && !(at !== undefined && Date.now() - at > ms)) {
      if (at === undefined) {
        all.set(shut, Date.now());
        cx?.timer.after(ms + 40, (cx) => cx.notify());
      }
      m.used.set(id, m.gen);
      m.used.set(shut, m.gen);
      const p = policy(ms, 0, "ease-in-out");
      return div().id(id).w_full().flex_none().overflow_hidden().h(0).opacity(0).transition("height", p).transition("opacity", p)
        .child(div().id(`${id}~in`).w_full().flex_none().child(body()));
    }
    m.h.delete(id);
    all.delete(shut);
    return null;
  }
  all.delete(shut);
  if (typeof body === "function") body = body();
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

// An overlay going away (Esc, q, a click on its veil, Annuler, after an action): leave() marks it
// leaving and redraws, sheet() then fades its veil out and lowers its card 6 px (140 ms ease-in, the
// portfolio's page-out), and ONE cx.timer.after calls close(cx) once that ran. A second call while it
// leaves does nothing. Reduced motion: close(cx) at once. The action itself is not delayed: run it
// first, then leave().
export function leave(m, cx, id, close, { ms = MS.leave } = {}) {
  if (m.reduced) return void close(cx);
  const out = (m.out ??= new Set());
  if (out.has(id)) return;
  out.add(id);
  cx.notify();
  cx.timer.after(ms, (cx) => close(cx));
}
export const leaving = (m, id) => Boolean(m.out?.has(id));

// An overlay's veil and card for this render: in once it has laid out (`shown`: the mod's own cue, its
// first on_size_change), out while it leaves. The veil fades (its opacity carries the card), the card
// rises from, then sinks back to, `dy` px. Reduced motion: as they are.
export function sheet(m, id, shown, { dy = 6 } = {}) {
  const out = leaving(m, id);
  const p = out ? policy(MS.leave, 0, "ease-in") : policy(MS.open);
  const on = Boolean(shown) && !out;
  return {
    veil: (el) => (m.reduced ? el : el.opacity(on ? 1 : 0).transition("opacity", p)),
    card: (el) => (m.reduced ? el : el.relative().top(on ? 0 : dy).transition("top", p)),
  };
}

// When rows go and rows come in the same render, the new ones wait this long: the old ones go first.
const HANDOFF = MS.hover;

// The rows of a short list coming and going in order (listMotion.ts). A new row opens on its height and
// fades in; a row that went closes on its height and fades out (ease-in-out), still drawn, then ONE
// cx.timer.after per wave drops the wave: a one-shot and one render, never a timer per row. Both
// cascade from the top, 30 ms a row, 5 rows at most; the rows going out go first (HANDOFF). A row
// that comes back while it closes reopens where it is, under the same id. `row(item, i)` builds a row
// (its own ids and handlers kept, rows() wraps it); `i` is its index in `items`, -1 while it closes.
// `keyOf(item)` is unique and stable. Once per render, with render's cx; it returns the children.
// Above 12 rows (before or after the change) or in reduced motion: the plain rows, at once; the first
// animated render after that takes the rows as they are, without replaying them. A height level of
// its own: not inside collapse(), not in a list / uniform_list / virtual list.
// A row at rest (its opening over) lets go of its height: it follows its own content (a card that
// unfolds inside, a sub-list) with no chase and no render per frame, measured quietly for its exit.
// Leaving, it is first pinned at that height (fading), then folds at the next render: one more
// one-shot timer for a wave that holds rows at rest.
export function rows(m, cx, id, items, keyOf, row, { ms = MS.open } = {}) {
  const all = (m.st ??= new Map());
  let st = all.get(id);
  if (!st) all.set(id, (st = { order: [], item: new Map(), out: new Map(), late: new Map(), rest: new Map(), n: 0, wave: 0 }));
  st.rest ??= new Map(); // key -> when its height transition is over (then it rests at auto height)
  const now = Date.now();
  const rests = (k) => st.rest.has(k) && now >= st.rest.get(k);
  m.used.set(id, m.gen);
  const keys = items.map(keyOf);
  const at = new Map(keys.map((k, i) => [k, i]));
  const n = st.n;
  st.n = items.length;
  if (m.reduced || Math.max(n, items.length) > 12) {
    st.order = keys;
    st.item = new Map(keys.map((k, i) => [k, items[i]]));
    st.out.clear();
    st.late.clear();
    st.rest.clear();
    return items.map((it, i) => row(it, i));
  }
  const was = new Set(st.order);
  for (const k of keys) if (st.out.delete(k)) st.rest.delete(k); // back while closing: reopens, then rests
  const went = st.order.filter((k) => !at.has(k) && !st.out.has(k));
  const fresh = keys.filter((k) => !was.has(k));
  // A row keeps its cascade delay until the list changes again: a render in between moves nothing.
  if (went.length || fresh.length) st.late.clear();
  const wave = went.length ? ++st.wave : 0;
  went.forEach((k, j) => st.out.set(k, { wave, delay: Math.min(j, 5) * 30, pin: rests(k) }));
  const pins = went.some((k) => st.out.get(k).pin);
  fresh.forEach((k, j) => st.late.set(k, stagger(j, items.length) + (wave ? HANDOFF : 0)));
  // A closing row keeps its place: right after the nearest row above it that is still drawn.
  const order = keys.slice();
  st.order.forEach((k, j) => {
    if (!st.out.has(k)) return;
    let p = j - 1;
    while (p >= 0 && !order.includes(st.order[p])) p--;
    order.splice(p < 0 ? 0 : order.indexOf(st.order[p]) + 1, 0, k);
  });
  st.order = order;
  for (const k of keys) st.item.set(k, items[at.get(k)]);
  // Rows at rest leave pinned at their height for one render, then fold: one timer to fold them.
  if (pins) cx.timer.after(20, (cx) => {
    let flip = false;
    for (const o of st.out.values()) if (o.wave === wave && o.pin) { o.pin = false; flip = true; }
    if (flip) cx.notify();
  });
  if (wave) cx.timer.after(Math.min(went.length - 1, 5) * 30 + ms + 40 + (pins ? 20 : 0), (cx) => {
    const gone = st.order.filter((k) => st.out.get(k)?.wave === wave);
    if (!gone.length) return;
    for (const k of gone) {
      st.out.delete(k);
      st.item.delete(k);
      st.rest.delete(k);
      m.h.delete(`${id}:${k}`);
    }
    st.order = st.order.filter((k) => !gone.includes(k));
    cx.notify();
  });
  return order.map((k) => {
    const o = st.out.get(k);
    const wid = `${id}:${k}`;
    m.used.set(wid, m.gen);
    const h = m.h.get(wid);
    const late = st.late.get(k);
    const p = o ? policy(ms, o.delay, "ease-in-out") : policy(ms, late ?? 0);
    const w = div().id(wid).w_full().flex_none().overflow_hidden();
    let el;
    let quiet = false;
    if (o?.pin) {
      // At rest, leaving: pinned where it stands, fading. The height transition stays declared (as it
      // was at rest): gpui animates only target changes after it is declared, so a transition first
      // declared on the fold itself would drop the card to 0 at once.
      el = w.h(h ?? 0).opacity(0).transition("height", p).transition("opacity", p);
    } else if (o || (h === undefined && late !== undefined)) {
      // Closing, or new and not measured yet: nothing.
      el = w.h(0).opacity(0).transition("height", p).transition("opacity", p);
    } else {
      // Opening (or reopening) to its height until that is over, then at rest: its own height, followed
      // without a render. Already there while the list was plain: at rest at once.
      if (!st.rest.has(k)) st.rest.set(k, h === undefined ? 0 : now + (late ?? 0) + ms + 40);
      quiet = rests(k) || h === undefined;
      // At rest: no height target (it follows its content), but the height transition stays declared.
      el = (quiet ? w : w.h(h)).transition("height", p).opacity(1).transition("opacity", p);
    }
    return el
      .child(div().id(`${wid}~in`).w_full().flex_none().child(row(st.item.get(k), o ? -1 : at.get(k)))
        .on_size_change((size, cx) => {
          if (m.h.get(wid) === size.height) return;
          m.h.set(wid, size.height);
          if (!quiet) cx.notify();
        }));
  });
}

// A heading coming into focus (useReveal's blur and opacity). gpui has no blur, so four faint copies,
// 1 px off on each side, fade out as they close in while the sharp text fades in: a soft focus, proven
// by captures from 15 px up. A page or panel title, never a list row. `make()` builds the text plain,
// with no id and no handler (the copies are drawn over it); the layout (flex_1, min_w(0)) goes on what
// sharpen() returns. `dy`: the page's rise (DY.page), in a parent that clips. It costs one more render,
// like enter(); the copies leave at the first render after the fade, without a timer.
export function sharpen(m, id, make, { dy = 0, ms = MS.open } = {}) {
  const el = div().id(id).relative();
  if (m.reduced) return el.child(make());
  const all = (m.st ??= new Map());
  m.used.set(id, m.gen);
  const on = m.shown.has(id);
  const p = policy(ms);
  let box = el.child(make().id(`${id}~0`).opacity(on ? 1 : 0).transition("opacity", p));
  if (!on || Date.now() - all.get(id) < ms + 40)
    box = box.children([[-1, 0], [1, 0], [0, -1], [0, 1]].map(([x, y], i) =>
      make().id(`${id}~${i + 1}`).absolute().left(on ? 0 : x).top(on ? 0 : y).size_full().opacity(on ? 0 : 0.22)
        .transition("opacity", p).transition("left", p).transition("top", p)));
  if (dy) box = box.top(on ? 0 : dy).transition("top", p);
  return box.on_size_change((_size, cx) => {
    if (m.shown.has(id)) return;
    m.shown.add(id);
    all.set(id, Date.now());
    cx.notify();
  });
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
