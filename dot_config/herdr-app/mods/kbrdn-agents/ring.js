// A ring that fills (context, the 5 h and 7 d windows). kbrdn-agents/ring.js and kt-composer/ring.js
// are copies of this file (a mod can't import from another mod's folder): change them together. A t.border track and a round-ended arc from 12 o'clock, clockwise; accent under 60 %, blocked
// to 85 %, ansi1 above. From 28 px the percent sits in the middle, below it's the tooltip.
// ponytail: the arc is a painted path and only opacity / width / height / left / top move
// natively, so a new value steps, it doesn't slide.

import { div, PathBuilder } from "gpui-kit";

const MONO = "Monaspace Krypton";
// The global window (paint_path), even where a mod imports herdr's window() under that name.
const surface = () => globalThis.window;

const RING_CACHE = new Map(); // `${size}|${pct}` -> paths: a ring is the same geometry every render
function ringPaths(size, pct) {
  const key = `${size}|${pct}`;
  if (RING_CACHE.has(key)) return RING_CACHE.get(key);
  const sw = size >= 28 ? 3 : 2;
  const c = size / 2;
  const r = c - sw / 2 - 0.5;
  const circle = (b, rad, x, y) => b.move_to(x, y - rad).arc_to(rad, rad, 0, false, true, x, y + rad).arc_to(rad, rad, 0, false, true, x, y - rad);
  const a = (Math.min(pct, 99.9) / 100) * 2 * Math.PI;
  const [ex, ey] = [c + r * Math.sin(a), c - r * Math.cos(a)];
  const paths = {
    track: circle(PathBuilder.stroke(sw), r, c, c).build(),
    arc: pct >= 99.5 ? circle(PathBuilder.stroke(sw), r, c, c).build() : PathBuilder.stroke(sw).move_to(c, c - r).arc_to(r, r, 0, a > Math.PI, true, ex, ey).build(),
    // Round ends: a dot of the stroke's width at each end of the arc.
    caps: circle(circle(PathBuilder.fill(), sw / 2, c, c - r), sw / 2, ex, ey).build(),
  };
  RING_CACHE.set(key, paths);
  return paths;
}

// The threshold color: accent under 60 %, blocked to 85 %, ansi1 above.
export const ringColor = (t, pct) => (pct > 85 ? t.ansi1 : pct >= 60 ? t.blocked : t.accent);

// `tip`: what the tooltip names below 28 px ("Contexte" by default).
export function ring(t, id, pct, size, { tip = "Contexte" } = {}) {
  const p = Math.round(Math.max(0, Math.min(100, pct ?? 0)));
  const color = ringColor(t, p);
  const { track, arc, caps } = ringPaths(size, p);
  const w = surface();
  return div()
    .id(id)
    .relative()
    .size(size)
    .flex_none()
    .child(w.paint_path(track, t.border).absolute().inset_0())
    .when(p > 0, (el) => el.child(w.paint_path(arc, color).absolute().inset_0()).when(p < 100, (el) => el.child(w.paint_path(caps, color).absolute().inset_0())))
    .when(size >= 28, (el) => el.child(div().absolute().inset_0().flex().items_center().justify_center()
      .font_family(MONO).text_size(size >= 40 ? 11 : p >= 100 ? 8 : 9).text_color(t.foreground).child(`${p}%`)))
    .when(size < 28, (el) => el.tooltip(`${tip} ${p} %`));
}

// The context as tokens: what the last call sent (fresh, cache read, cache written).
export const ctxTokens = (s) => (s?.input_tokens ?? 0) + (s?.cache_read_input_tokens ?? 0) + (s?.cache_creation_input_tokens ?? 0);
