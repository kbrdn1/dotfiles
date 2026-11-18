// The pixel dither band (brand/dither-band.svg, 3840×80 so a 4K-wide window never sees it end; a 128 px
// tile, 2 px dots on a 4 px grid) inside a card with
// rounded corners, cut so that nothing crosses an arc or the border AND nothing is missing in the
// corners: the band is shown through 2 px rows, each as wide as the arc allows there, merged where
// rows are equal (so the middle is one window). Every window shows the same band from the card's
// origin (left(-x), top(-y)), so the pattern stays continuous. GPUI clips to rectangles and draws an
// svg without radii: that is why the corners are steps, not a clip.
// Copied as is into every mod with a band (cmp to check); check: bun mods/kt-keys/dither.check.mjs.
// Rule: data/orchestrator/DESIGN-REFERENCE.md.
import { div, svg } from "gpui-kit";

export const DITHER = "brand/dither-band.svg";
export const BAND_W = 3840; // the svg's own width: drawn 1:1, never stretched
export const TOP = { tl: true, tr: true };
export const BOTTOM = { bl: true, br: true };
export const ALL = { tl: true, tr: true, bl: true, br: true };

// [x, y, w, h] windows covering a w × h box whose given corners have radius r (the card's radius less
// its border), in the box's coordinates. A dot [4k, 4k+2) is shown only if it lies inside the arc.
export function bandWindows(w, h, r, corners = TOP) {
  const chord = (d) => Math.sqrt(Math.max(0, r * r - d * d));
  const out = [];
  for (let y = 0; y < h; y += 2) {
    const y1 = Math.min(h, y + 2);
    let l = 0, right = w;
    const above = r - y; // a top row: its top edge is the farthest from the top arcs' centres
    const below = y1 - (h - r); // a bottom row: its bottom edge
    if (above > 0) {
      const c = chord(above);
      if (corners.tl) l = Math.max(l, Math.ceil((r - c) / 2) * 2);
      if (corners.tr) right = Math.min(right, Math.floor((w - r + c) / 2) * 2);
    }
    if (below > 0) {
      const c = chord(below);
      if (corners.bl) l = Math.max(l, Math.ceil((r - c) / 2) * 2);
      if (corners.br) right = Math.min(right, Math.floor((w - r + c) / 2) * 2);
    }
    if (right <= l) continue;
    const last = out.at(-1);
    if (last && last[0] === l && last[2] === right - l && last[1] + last[3] === y) last[3] += y1 - y;
    else out.push([l, y, right - l, y1 - y]);
  }
  return out;
}

// The band as an absolute layer at the top left of its card's content box (inside the border), w × h
// (h ≤ 80), tinted `color`. Nothing until w is measured (on_size_change on the card).
export function ditherBand(w, h, r, color, corners = TOP, src = DITHER) {
  if (!(w > 2 * r)) return null;
  return div().absolute().top(0).left(0).w(w).h(h).children(bandWindows(w, h, r, corners).map(([x, y, ww, hh]) =>
    div().absolute().left(x).top(y).w(ww).h(hh).overflow_hidden()
      .child(svg(src).absolute().left(-x).top(-y).w(BAND_W).h(80).text_color(color))));
}
