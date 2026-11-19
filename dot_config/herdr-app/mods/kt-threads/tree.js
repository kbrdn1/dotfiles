// tree.js: the tree's branches, kbrdn.dev's Parcours: kt-threads' sub-agents and its navigation's Agents
// group, kt-chat's sub-agents ledge (#84) and a turn's tools (#90). The reference is kt-threads' copy
// (kt-mods SHARED), the others byte-identical (cmp). Check: bun mods/kt-threads/tree.check.mjs.
import { div } from "gpui-kit";
import { settings } from "herdr";

const alpha = (c, a) => `${String(c).slice(0, 7)}${a}`;

// A branch's pieces in a box as tall as its row, `x` from its left: the trunk going on below (unless
// `last`, at rest), then the trunk down to the bend and the bend as one box, whose rounded corner is the
// ╰ (8 px above the row's middle, to `x` further). The bend is drawn last, over the trunk below.
// `reach`: px the pieces reach past the row's edges, so they still meet across bordered rows.
const pieces = ({ h, x, last, color, rest, reach = 0 }) => [
  ...(last ? [] : [div().absolute().top(h / 2 - 4).bottom(-reach).left(x).border_l(1).border_color(rest)]),
  div().absolute().top(-reach).left(x).w(x).h(h / 2 + 1 + reach).border_l(1).border_b(1).rounded_bl(8).border_color(color),
];

/**
 * One branch of a tree, the column drawn before a row's content, 2·x wide: its piece of trunk runs over
 * the row's whole height `h` (to the bend only, on the `last`), and a ╰ bends off it 8 px above the
 * middle, rounded, to the column's right edge. `color`: the bend and the piece leading to it; `rest`: the
 * trunk going on below.
 */
export function twig(t, { h, x, last, color, rest, reach = 0 }) {
  return div().w(2 * x).h_full().flex_none().relative().children(pieces({ h, x, last, color, rest, reach }));
}

// The tree's lines at rest, Parcours' --control-border (neutral-300 light, white at .14 dark): the
// foreground made translucent, so they read at a glance without shouting, glass mode included.
export const treeLine = (t) => alpha(t.foreground, settings().dark ? "38" : "4d");

/**
 * A child of any height put on its branch: 2·x of left padding (it replaces the child's own), the
 * branch drawn in it, its bend `h / 2` from the child's top (h: the height of its first line, the bend
 * coming in at its middle), the trunk through its whole height unless `last`. No wrapper: the child (a
 * div, h_flex or v_flex) holds the pieces inside its own box, so its clipping keeps them. Siblings
 * stacked with no gap make one trunk. `color`: this branch's (a live one's, a failed one's), else `rest`,
 * the tree's line at rest (treeLine).
 */
export function hang(t, child, { h = 28, x = 11, last = false, color, rest = treeLine(t) } = {}) {
  return child.relative().pl(2 * x).min_w(0).children(pieces({ h, x, last, color: color ?? rest, rest }));
}

/** The trunk's start under a parent's icon: from the icon's bottom (`top`, in its row) to the row's end, at `x`. */
export const stem = (color, { x = 11, top }) => div().absolute().left(x).top(top).bottom(0).border_l(1).border_color(color);
