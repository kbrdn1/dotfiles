// menu.js (kt-chat, #81 L4-L5): the completion menu and the field's dither effects, drawn from
// completer.js' state. Everything moves through motion.js (Kylian: « bien veiller aux transitions »):
// the menu is a passing popup over the transcript, above the card (like bgMenu): it comes in fading
// (enter, 180 ms) and goes fading (140 ms ease-in, MS.leave), never on its height (a fold would move the
// transcript's bottom each frame); the active row's fill glides (ink); the rows change at once on a
// keystroke (a cascade per keystroke would never rest). The wave and the rail are motion.js' sweep()
// layers under the text, in the field's own box. Reduced motion: the menu shows and goes at once, no
// wave, no rail: the chip's color says it. Checked by menu.check.mjs (gpui mocked).
import { div, svg } from "gpui-kit";
import { h_flex, v_flex } from "gpui-base";
import { ink, enter, sweep, MS } from "./motion.js";
import { colorOf, tintOf, iconOf } from "./categories.js";
import { makeT } from "./i18n.js";
import strings from "./complete.strings.js";

const tr = makeT(strings);
const MONO = "Monaspace Krypton";
const alpha = (c, a) => `${String(c).slice(0, 7)}${a}`;
export const ROW = 32;
export const ROWS = 8; // shown at once at most; the rest scrolls
export const CREST = "mods/kt-chat/dither-crest.svg";
export const CREST_W = 24;

// A row's words: its name, hint, description and the category's word.
function words(row) {
  if (row.type === "command") {
    const x = row.item;
    return { name: `/${x.name}`, hint: x.hint, desc: x.description || (x.kind === "builtin" ? tr(`builtin.${x.name}`) : ""), mono: true };
  }
  if (row.type === "server") return { name: `#${row.name}`, hint: null, desc: tr("menu.tools", { n: row.count }), mono: true };
  if (row.type === "tool") return { name: row.label, hint: null, desc: row.description ?? "", mono: true };
  return { name: row.path.slice(row.path.lastIndexOf("/") + 1), hint: null, desc: row.path, mono: false };
}

function body(t, m, shown, { dark, onPick, scroll, rows: max }) {
  const rows = shown.rows;
  const act = rows[shown.active];
  const hue = act ? colorOf(t, act.category) : t.muted;
  const list = v_flex().id("kc-menu-rows").relative().max_h(ROW * max).overflow_y_scroll().track_scroll(scroll)
    .child(ink(m, div().id("kc-menu-ink").absolute().left(0).right(0).top(shown.active * ROW).h(ROW).rounded(8)
      .bg(alpha(hue, dark ? "24" : "1f")), MS.hover))
    .children(rows.map((row, i) => {
      const w = words(row);
      const c = colorOf(t, row.category);
      const tinted = Boolean(tintOf(row.category));
      return h_flex().id(`kc-menu-${row.id}`).relative().h(ROW).flex_none().px(8).gap(10).items_center().cursor_pointer()
        .on_mouse_down("left", (_e, cx) => { cx.stop_propagation(); onPick(i, cx); }) // a press: the field keeps the keyboard
        .child(div().size(22).flex_none().rounded(6).bg(tinted ? alpha(c, "33") : alpha(t.foreground, "14")).flex().items_center().justify_center()
          .child(svg(iconOf({ kind: row.type, category: row.category })).size(13).text_color(tinted ? c : t.muted)))
        .child(div().flex_none().max_w(240).truncate().text_size(12.5).when(w.mono, (el) => el.font_family(MONO))
          .text_color(i === shown.active && tinted && dark ? c : t.foreground).child(w.name))
        .when(Boolean(w.hint), (el) => el.child(div().flex_none().max_w(180).truncate().font_family(MONO).text_size(11.5).text_color(t.dim).child(w.hint)))
        .child(div().flex_1().min_w(0).truncate().text_size(12).text_color(t.muted).child(w.desc))
        .child(div().flex_none().text_size(10.5).text_color(tinted ? c : t.dim).child(tr(`cat.${row.category}`)));
    }));
  return v_flex().w_full().p(6).gap(4).rounded(12).border(1).border_color(alpha(t.foreground, "1a")).bg(t.popover ?? t.background).shadow_md()
    .child(rows.length ? list : div().h(ROW).px(10).flex().items_center().text_size(12).text_color(t.dim).child(tr("menu.empty")))
    .child(div().px(10).pt(2).text_size(11).text_color(t.dim).child(tr("menu.keys")));
}

/**
 * The popup, or null. `menu`: completer's state (open) or null; `last`: the menu that just closed, kept
 * by the caller for MS.leave (ONE cx.timer.after per close drops it) so it fades out; `gen`: counts the
 * openings, a new one fades in again. onPick(i, cx); scroll: the caller's ScrollHandle; rows: how many
 * rows show at once (ROWS, fewer when the transcript is short: the popup stays inside it).
 */
export function menuView(t, m, menu, { last = null, gen = 0, dark = true, onPick, scroll, rows = ROWS }) {
  const id = `kc-menu-${gen}`;
  if (menu) return enter(m, body(t, m, menu, { dark, onPick, scroll, rows }), id, { dy: 0 });
  if (!last || m.reduced) return null;
  return body(t, m, last, { dark, onPick: () => {}, scroll, rows }).id(id).opacity(0)
    .transition("opacity", { duration: MS.leave, easing: "ease-in" });
}

/** The words under the card for the route a /command takes (complete.js routeOf), or null: herdr-bridge's
 *  types it natively (nothing to say but a confirmation), a plain message neither. */
export function routeWords(r) {
  if (!r) return null;
  if (r.via === "none") return tr("route.untypable");
  if (r.via === "keys") return r.confirm ? `${tr("route.keys")} · ${tr("route.confirm")}` : tr("route.keys");
  if (r.via === "say") return r.confirm ? tr("route.confirm") : null;
  return r.by === "agent" ? tr("route.agent") : null;
}

/** The wave: three crest layers crossing the field (its inner width `w`) under the text, the densest
 *  first, the trail dissolving (0 / 40 / 80 ms). [] once it ran, or in reduced motion. */
export function wave(t, m, id, category, w, { dark = true } = {}) {
  const c = colorOf(t, category);
  const a = dark ? ["6b", "48", "24"] : ["4d", "33", "1a"];
  return [0, 1, 2].map((k) => sweep(m, `${id}-${k}`, svg(CREST).w(CREST_W).h(40).top(0).text_color(alpha(c, a[k])),
    { from: -CREST_W - k * 8, to: w - k * 8, ms: MS.panel, delay: k * 40, fade: 120, fadeDelay: 120 + k * 40 })).filter(Boolean);
}

/** The workflow's rail: one dither bead per step of its cycle (workflows.js' STEPS), lit left to right
 *  in the wave's wake (25 ms apart, 120 ms each), then the rail fades (180 ms after 300): 480 ms, once.
 *  Under the chip, in the height its line keeps: nothing moves around it. null once it ran. */
export function rail(t, m, id, n, { dark = true } = {}) {
  const c = colorOf(t, "workflow");
  const beads = Array.from({ length: n }, (_, i) => enter(m, div().size(4).flex_none().bg(alpha(c, dark ? "cc" : "99")), `${id}-b${i}`, { dy: 0, delay: i * 25, ms: 120 }));
  return sweep(m, id, h_flex().gap(6).items_center().bottom(1).children(beads), { from: 10, to: 10, ms: 0, fade: MS.open, fadeDelay: 300 });
}
