// tree.js: kt-threads' branches (the sub-agents' twig, the Agents group's tree: kbrdn.dev's Parcours),
// word for word from its main.js, for kt-chat's sub-agents ledge (#84). #90 makes it the module shared
// with kt-threads (copied, checked by cmp); until then kt-threads keeps its own.
import { div } from "gpui-kit";
import { settings } from "herdr";

const alpha = (c, a) => `${String(c).slice(0, 7)}${a}`;

/**
 * One branch of a tree: the trunk from `x` runs down the row's whole height (so the pieces meet), a ╰
 * bends off it 8 px above the row's middle to `x` further; `last` ends the trunk at its bend. `color`:
 * the bend and the trunk leading to it; `rest`: the trunk going on below. `reach`: how far the trunk
 * runs up past the row (through a padding or a gap above).
 */
export function twig(t, { h, x, last, color, rest, reach = 0 }) {
  const mid = h / 2;
  return div().w(2 * x).h_full().flex_none().relative()
    .child(div().absolute().top(-reach).left(x).h(mid - 8 + reach).border_l(1).border_color(color))
    .when(!last, (el) => el.child(div().absolute().top(mid - 4).bottom(-reach).left(x).border_l(1).border_color(rest)))
    .child(div().absolute().top(mid - 8).left(x).w(x).h(9).border_l(1).border_b(1).rounded_bl(8).border_color(color));
}

// The tree's lines at rest, Parcours' --control-border (neutral-300 light, white at .14 dark): the
// foreground made translucent, so they read at a glance without shouting, glass mode included.
export const treeLine = (t) => alpha(t.foreground, settings().dark ? "38" : "4d");
