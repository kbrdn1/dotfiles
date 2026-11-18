// band.js: the head of data/orchestrator/DESIGN-REFERENCE.md (Crosstalk's) for kt-gwm, kt-skills and
// kt-mcp: a 60 px band on the pixel dither, a 32 px mark, a 14 px semibold title, a mono subtitle,
// icon buttons whose tooltip gives the key, and a ⋯ menu. Written once in mods/kt-gwm/band.js and
// copied byte for byte (cmp) into kt-skills and kt-mcp.

import { div, svg } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { settings } from "herdr";
import { ditherBand, TOP } from "./dither.js";
import { sharpen } from "./motion.js";

const MONO = "Monaspace Krypton";
// A color with alpha `a`, replacing any it has (glass themes are #rrggbbaa).
const alpha = (c, a) => `${String(c).slice(0, 7)}${a}`;

// The pixel dither at the top of a card `w` px wide (its border box, measured with on_size_change) whose
// top corners have radius `radius` and a 1 px border: dither.js's band (the common module), inside the
// border (w - 2 wide, radius - 1), its corners filled up to the arc. Tinted with the page's (or
// project's) color. Null until `w` is measured: add it with children([…].filter(Boolean)).
export const dither = (w, h, radius, color) => ditherBand((w ?? 0) - 2, h, radius - 1, alpha(color, settings().dark ? "6b" : "4d"), TOP);

// A discreet round icon button; its tooltip gives the key ("Rafraîchir (r)").
export function iconBtn(t, id, icon, tip, fn, on = false) {
  return div().id(id).size(28).flex_none().rounded_full().flex().items_center().justify_center()
    .text_color(on ? t.accent : t.muted).cursor_pointer()
    .hover((s) => s.bg(alpha(t.foreground, "14")).text_color(t.foreground)).tooltip(tip)
    .on_click((_e, cx) => { cx.stop_propagation(); fn(cx); cx.notify(); })
    .child(svg(icon).size(14));
}

// The band's row: the 32 px mark (`mark`, else a tile with `icon` in `color`, a state dot `dot`), the
// title, the subtitle (its parts joined by " · "), the buttons. A part can be an element: roll.js'
// rollText, a count that rolls (rollText(m, id, text, 14)); the subtitle is then a row on 14 px lines,
// the elements whole, the text between them truncating.
// `m`: the page's motion state (motion.js); given, the title comes into focus (sharpen) when it arrives
// or changes, once.
export function bandRow(t, { color, icon, mark, dot, title, sub, buttons = [], m }) {
  const tile = mark ?? div().size(32).flex_none().rounded(10).border(1).border_color(alpha(color, "4d")).bg(alpha(color, "24"))
    .flex().items_center().justify_center().child(svg(icon).size(16).text_color(color));
  const parts = [sub].flat().filter(Boolean);
  // Consecutive strings in one text, as before; " · " between every part.
  const runs = parts.reduce((g, p) => (typeof p === "string" && typeof g.at(-1) === "string" ? g.splice(-1, 1, `${g.at(-1)} · ${p}`) : g.push(p), g), []);
  const subLine = runs.every((p) => typeof p === "string")
    ? div().truncate().font_family(MONO).text_size(10.5).text_color(t.muted).child(runs.join(" · "))
    : h_flex().min_w(0).h(14).overflow_hidden().line_height("14px").font_family(MONO).text_size(10.5).text_color(t.muted)
      .children(runs.flatMap((p, i) => (typeof p === "string" ? [div().min_w(0).truncate().child(`${i ? " · " : ""}${p}`)]
        : [...(i ? [div().flex_none().whitespace_nowrap().child(" · ")] : []), p.flex_none()])));
  return h_flex().flex_none().h(60).px(10).gap(10).items_center()
    .child(div().relative().flex_none().child(tile)
      .when(Boolean(dot), (el) => el.child(div().absolute().right(-2).bottom(-2).size(10).rounded_full().border(2).border_color(t.background).bg(dot))))
    .child(v_flex().flex_1().min_w(0).gap(2)
      .child(((ttl) => (m ? sharpen(m, `band-title:${title}`, ttl) : ttl()))(
        () => div().truncate().text_size(14).font_semibold().text_color(t.foreground).child(title)))
      .child(subLine))
    .children(buttons.filter(Boolean));
}

// The ⋯ menu: 30 px rows, radius 10, in a popover (14). Put it last in the page's root (relative), so
// it draws over the list; a press outside closes it. Items: [id, icon, label, onClick] (null: none).
export function moreMenu(t, id, top, items, close) {
  return v_flex().id(id).absolute().top(top).right(14).w(260).p(4).gap(2).rounded(14).border(1).border_color(t.border).bg(t.popover).shadow_lg()
    .on_mouse_down_out((_e, cx) => { close(); cx.notify(); })
    .children(items.filter(Boolean).map(([iid, icon, label, fn]) => h_flex().id(iid).h(30).px(10).gap(8).items_center().rounded(10)
      .text_size(12.5).text_color(t.foreground).cursor_pointer().hover((s) => s.bg(t.hover))
      .on_click((_e, cx) => { close(); fn(cx); cx.notify(); })
      .child(svg(icon).size(13).flex_none().text_color(t.muted)).child(div().min_w(0).truncate().child(label))));
}
