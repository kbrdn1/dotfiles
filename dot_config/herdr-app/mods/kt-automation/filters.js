// filters.js: the filter row every kt-* mod shares (data/orchestrator/FILTERS.md). Written once in
// mods/kt-keys/filters.js and copied byte for byte into each mod that uses it (a mod can't import
// from another folder): edit here, then copy. No herdr import and no module state (copies of a mod
// share module code); the logic below the row is pure, so Bun checks it (filters.check.mjs).
//
// One state per row, made in init (a ScrollHandle can't be made in render):
//   this.kinds = filterState();
// then in render:
//   filterRow({ id: "kti-kinds", state: this.kinds, t, bg: t.background,
//     items: [{ key: "all", label: "Tout" }, { key: "pr", label: "PR", count: 4, tint: "ansi2" }],
//     active: "pr",                      // a key, or an array of keys (several on), or null
//     cursor: null,                      // the key under the keys' cursor (the accent ring), or null
//     onPick: (key, cx) => { ... } })    // a click; the row calls cx.notify() after it
// An item: { key (string), label, count?, tint?, group? }. `tint`: a theme color name ("ansi2",
// "accent", "done", "dim") or a #hex; none: neutral (« Tout »). A change of `group` from one item
// to the next draws a thin rule between them (two kinds of filter in one row). `bg`: the color
// behind the row, which the fades melt into (default t.background).
// The row: one line, scrolling sideways (wheel and trackpad), a 16 px fade on a cut edge, and the
// active pill (else the cursor's) brought into view once each time it changes. In a group with one
// pill on (a single choice), its fill is an ink under the pills that glides to the next one picked
// (left and width, 240 ms ease-in-out, ANIMATIONS.md); `reduced: true` (shared "kt.reducedMotion")
// makes it jump. Several on in a group (a multiple choice): each pill its own fill, no ink.
// A pill's count rolls to its new digits (roll.js, ANIMATIONS.md 7; net in reduced motion): roll.js
// travels with filters.js, copied beside it in each mod. `scope` (optional) goes into the reels' ids:
// a row whose counts are another context's (another repo) passes it, so they show net, not rolling.

import { div, PathBuilder, Background } from "gpui-kit";
import { h_flex, ScrollHandle } from "gpui-base";
import { roll } from "./roll.js";

const GAP = 6;
const FADE = 16;
// Category tints for keys without one of their own (tintFor), in the theme; ansi1 (red) is kept for
// danger and failures.
export const TINTS = ["ansi4", "ansi5", "ansi2", "ansi3", "ansi6", "accent"];

// A color with alpha `a`, replacing any it has (glass themes are #rrggbbaa).
const alpha = (c, a) => `${String(c).slice(0, 7)}${a}`;

/** A theme color name or #hex -> a color; none -> null (neutral). */
export function tintColor(tint, t) {
  if (!tint) return null;
  return String(tint).startsWith("#") ? tint : t?.[tint] ?? null;
}

/** A stable tint for a key (a program, a marketplace): the same key always gets the same one. */
export function tintFor(key) {
  let h = 0;
  for (const ch of String(key)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return TINTS[h % TINTS.length];
}

/** Light theme: its background is light. Alphas go one notch up there (FILTERS.md). */
export function isLight(t) {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i.exec(String(t?.background ?? ""));
  if (!m) return false;
  const [r, g, b] = m.slice(1, 4).map((x) => parseInt(x, 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.5;
}

/** The pill alphas: inactive fill, hover fill, active fill, active border. */
export function alphas(light) {
  return light ? { off: "1f", hover: "2e", on: "40", border: "80" } : { off: "14", hover: "24", on: "33", border: "66" };
}

/** The keys that are on: a key, an array of keys, or null. */
export function activeSet(active) {
  return new Set((Array.isArray(active) ? active : [active]).filter((k) => k != null));
}

/** The key before (dir -1) or after (dir 1) `key`, wrapping; the first one when `key` isn't there. */
export function nextKey(items, key, dir) {
  const n = items.length;
  if (!n) return null;
  const i = items.findIndex((x) => x.key === key);
  if (i < 0) return items[dir < 0 ? n - 1 : 0].key;
  return items[(i + dir + n) % n].key;
}

/** The pills an ink sits under: in each group (an item's `group`), the one on, when only one is. */
export function inkIndices(items, on) {
  const by = new Map();
  items.forEach((x, i) => {
    if (!on.has(x.key)) return;
    const g = by.get(x.group);
    by.set(x.group, g === undefined ? i : -1);
  });
  return [...by.values()].filter((i) => i >= 0);
}

/** Left and right edges of each child laid out with `gap` between them. */
export function edgesOf(widths, gap = GAP) {
  let x = 0;
  return widths.map((w) => {
    const e = [x, x + w];
    x += w + gap;
    return e;
  });
}

/** How far the row can scroll: its content minus its viewport. */
export function maxScroll(widths, vw, gap = GAP) {
  const content = widths.reduce((s, w) => s + w, 0) + gap * Math.max(0, widths.length - 1);
  return Math.max(0, content - vw);
}

/** The scroll after revealing child i, as ScrollHandle.scroll_to_item does: the least move. */
export function reveal(widths, i, s, vw, gap = GAP) {
  const e = edgesOf(widths, gap)[i];
  if (!e || vw <= 0) return s;
  const [l, r] = e;
  const next = l < s ? l : r > s + vw ? r - vw : s;
  return Math.max(0, Math.min(maxScroll(widths, vw, gap), next));
}

/** The scroll after a wheel delta (GPUI: content follows the delta; a vertical wheel scrolls a
 *  row that only scrolls sideways). */
export function wheel(s, dx, dy, max) {
  return Math.max(0, Math.min(max, s - (dx || dy || 0)));
}

/** Which edges are cut, hence faded. */
export function fades(widths, s, vw, gap = GAP) {
  const max = maxScroll(widths, vw, gap);
  return { left: max > 0 && s > 1, right: max > 0 && s < max - 1 };
}

/** A row's state: its scroll handle and what was measured. Make it in init(). */
export function filterState() {
  return { scroll: ScrollHandle.new(), w: {}, vw: 0, s: 0, shown: undefined };
}

// A gradient layer filling its (relative) parent, left to right: win98/kit.js's way.
const RECT = () => PathBuilder.fill().move_to("0%", "0%").line_to("100%", "0%").line_to("100%", "100%").line_to("0%", "100%").close().build();
const gradient = (from, to) => globalThis.window.paint_path(RECT(), Background.linear_gradient(90, from, to)).absolute().top(0).left(0).size_full();

/** The row. See the top of the file. */
export function filterRow({ id, state, items, active = null, cursor = null, onPick, t, bg, reduced = false, scope = "" }) {
  const on = activeSet(active);
  const a = alphas(isLight(t));
  const back = bg ?? t.background;
  const widths = items.map((x) => state.w[x.key] ?? 0);
  const measured = state.vw > 0 && widths.every((w) => w > 0);
  // The inks: one per group with exactly one pill on, once every pill is measured. They are the
  // scroll area's first children, so the pills' indices for scroll_to_item move by their number.
  const inks = measured ? inkIndices(items, on) : [];
  const inked = new Set(inks);
  // The pill to keep in view: the cursor's, else the first active one; revealed once per change.
  const target = cursor ?? items.find((x) => on.has(x.key))?.key ?? null;
  if (target !== state.shown && measured) {
    state.shown = target;
    const i = items.findIndex((x) => x.key === target);
    if (i >= 0) {
      state.scroll.scroll_to_item(i + inks.length);
      state.s = reveal(widths, i, state.s, state.vw);
    }
  }
  // ponytail: ScrollHandle has no offset getter, so the scroll is estimated from wheel deltas and
  // reveals; a missed event can show a fade on the wrong edge. Upgrade: an offset getter.
  state.s = Math.min(state.s, maxScroll(widths, state.vw));
  const cut = fades(widths, state.s, state.vw);
  const measure = (key) => (size, cx) => {
    if (Math.abs((state.w[key] ?? 0) - size.width) < 0.5) return;
    state.w[key] = size.width;
    cx.notify();
  };
  // An active pill's fill and border: its tint's, else neutral (« Tout »).
  const onFill = (tint) => (tint ? alpha(tint, a.on) : t.hover);
  const onBorder = (tint) => (tint ? alpha(tint, a.border) : t.input);
  const pill = (x) => {
    const tint = tintColor(x.tint, t);
    const isOn = on.has(x.key);
    const ring = cursor != null && x.key === cursor;
    // Under the ink, the active pill is clear: the ink is its fill and border.
    const clear = inked.has(items.indexOf(x));
    const fill = clear ? alpha(t.border, "00") : tint ? alpha(tint, isOn ? a.on : a.off) : isOn ? t.hover : t.raised;
    const border = ring ? alpha(t.accent, "99") : isOn && !clear ? onBorder(tint) : alpha(t.border, "00");
    return h_flex()
      .id(`${id}-${x.key}`)
      .flex_none()
      .h(26)
      .px(10)
      .gap(6)
      .items_center()
      .rounded_full()
      .border(1)
      .border_color(border)
      .bg(fill)
      .when(!isOn, (el) => el.hover((s) => s.bg(tint ? alpha(tint, a.hover) : t.hover).text_color(t.foreground)))
      .whitespace_nowrap()
      .text_size(12)
      .text_color(isOn ? t.foreground : t.muted)
      .cursor_pointer()
      .on_click((_e, cx) => {
        onPick?.(x.key, cx);
        cx.notify();
      })
      .when(Boolean(tint), (el) => el.child(div().size(6).flex_none().rounded_full().bg(tint)))
      .child(x.label)
      .when(x.count != null, (el) => el.child(roll({ reduced }, `${id}-n-${scope}-${x.key}`, String(x.count), 14).font_family("Monaspace Krypton").text_size(10.5).text_color(isOn ? t.muted : t.dim)));
  };
  // Direct children of the scroll area are what scroll_to_item counts: one per item. A group's
  // first item carries the rule before it, inside its own child.
  const kids = items.map((x, i) => {
    const p = pill(x);
    const rule = i > 0 && x.group !== items[i - 1].group;
    const child = rule ? h_flex().id(`${id}-g-${x.key}`).flex_none().items_center().gap(GAP).child(div().w(1).h(14).flex_none().bg(t.border)).child(p) : p;
    return child.on_size_change(measure(x.key));
  });
  const glide = { duration: reduced ? 0 : 240, easing: "ease-in-out" };
  const edges = edgesOf(widths);
  kids.unshift(...inks.map((at) => {
    // Where the active pill sits in the content (past its group's rule when it has one).
    const x = items[at];
    const ruled = at > 0 && x.group !== items[at - 1].group;
    const left = edges[at][0] + (ruled ? 1 + GAP : 0);
    const tint = tintColor(x.tint, t);
    return div().id(`${id}-ink-${x.group ?? ""}`).absolute().top(0).left(left).w(edges[at][1] - left).h(26).rounded_full().border(1)
      .border_color(onBorder(tint)).bg(onFill(tint)).transition("left", glide).transition("width", glide);
  }));
  return div()
    .id(id)
    .relative()
    .w_full()
    .min_w(0)
    .flex_none()
    .child(
      h_flex()
        .id(`${id}-scroll`)
        .w_full()
        .gap(GAP)
        .items_center()
        .overflow_x_scroll()
        .track_scroll(state.scroll)
        .on_size_change((size, cx) => {
          if (Math.abs(state.vw - size.width) < 0.5) return;
          state.vw = size.width;
          cx.notify();
        })
        .on_scroll_wheel((e, cx) => {
          const lines = e.delta_lines;
          const dx = lines ? lines.x * 20 : e.delta?.x;
          const dy = lines ? lines.y * 20 : e.delta?.y;
          const s = wheel(state.s, dx, dy, maxScroll(widths, state.vw));
          if (Math.abs(s - state.s) < 0.5) return;
          state.s = s;
          cx.notify();
        })
        .children(kids),
    )
    .when(cut.left, (el) => el.child(div().absolute().top(0).bottom(0).left(0).w(FADE).child(gradient(back, alpha(back, "00")))))
    .when(cut.right, (el) => el.child(div().absolute().top(0).bottom(0).right(0).w(FADE).child(gradient(alpha(back, "00"), back))));
}
