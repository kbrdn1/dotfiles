// halo.js: the sidebar's halo (brand/dither-corner.svg, the headers' dither as a glow from the top left
// corner), one glow across the side column's two blocks: kt-head's brand part draws it at its top, and
// kt-threads under it, shifted up by the brand block's height, so the dither runs on without a seam.
// kt-threads works out its color (the shown project's) and publishes it as shared HALO; both draw it
// here, the same way. Written in mods/kt-threads/halo.js and copied byte for byte into mods/kt-head
// (a mod can't import from another folder): edit here, then copy (cmp to check). Static: no loop.
import { div, svg } from "gpui-kit";
import { enter, fade, MS } from "./motion.js";

export const HALO = "kt.halo";

// The halo's layers in `color` (null: none), `top` px from the block's top, 1:1 and never stretched, for
// a block that is relative and clips. A new color fades in as the last one fades out (240 ms): `memo`
// keeps the last one, per copy. They take no clicks: nothing to stop a window drag.
export function haloLayers(m, memo, color, top = 0) {
  if (!color) return [];
  if (color !== memo.now) [memo.was, memo.now] = [memo.now, color];
  const layer = (c) => div().absolute().top(top).left(0).w(480).h(260)
    .child(svg("brand/dither-corner.svg").w(480).h(260).text_color(c));
  return [
    ...(memo.was ? [fade(m, layer(memo.was).id(`halo-${memo.was}`), false, MS.panel)] : []),
    enter(m, layer(color), `halo-${color}`, { dy: 0, ms: MS.panel }),
  ];
}
