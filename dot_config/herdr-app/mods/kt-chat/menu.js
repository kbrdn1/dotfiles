// menu.js (kt-chat, #81 L4-L5): the completion menu, drawn from completer.js' state, and a picked word
// as the field draws it (tokenMark). Everything moves through motion.js (Kylian: « bien veiller aux
// transitions »): the menu is a passing popup over the transcript, above the card (like bgMenu): it comes
// in fading (enter, 180 ms) and goes fading (140 ms ease-in, MS.leave), never on its height (a fold would
// move the transcript's bottom each frame); the active row's fill glides (ink); the rows change at once on
// a keystroke (a cascade per keystroke would never rest). A picked word (fx3, Kylian 2026-11-20: « mot
// bloc marqué »): only it moves, once, then it stays marked by its category; a word typed by hand stays
// text, nothing moves while one types. Reduced motion: the menu shows and goes at once, the word is
// marked from the start. Checked by menu.check.mjs (gpui mocked).
import { div, svg } from "gpui-kit";
import { h_flex, v_flex } from "gpui-base";
import { ink, enter, MS } from "./motion.js";
import { colorOf, tintOf, iconOf } from "./categories.js";
import { STEPS } from "./workflows.js";
import { makeT } from "./i18n.js";
import strings from "./complete.strings.js";

const tr = makeT(strings);
const MONO = "Monaspace Krypton";
const alpha = (c, a) => `${String(c).slice(0, 7)}${a}`;
export const ROW = 32;
export const ROWS = 8; // shown at once at most; the rest scrolls
export const FRESH = 600; // a pick's motion: the veil's 420 ms, the beads' 8 × 25 + 120; then it draws still

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

/**
 * A picked word as the field draws it (Textarea.token: an InlineToken, a block the caret jumps and
 * Backspace takes whole; value() gives its text, what goes). It stays marked by its category for as
 * long as it's there: in dark, the word in its hue over a line of it; in light, the word in foreground
 * over the line (the hues are too pale for text there, L6d's rule); a file or a built-in: a neutral line.
 * A workflow's line is its cycle, one bead per step (workflows.js' STEPS).
 * Fresh (picked less than FRESH ago, `fx` on, motion not reduced): once, on the word only, a veil of its
 * hue goes out (0.34 to 0, 420 ms), its line comes (180 ms), a workflow's beads light left to right (25 ms
 * apart). The cue is the word's first layout (piece.shown, kept on the piece: the motion state forgets an
 * id a render doesn't draw, the piece doesn't). After FRESH it draws still, no transition at all.
 * piece: { kind, category, text, at?, shown? }; ctx: the token's (line_height); `id`: unique per pick.
 */
export function tokenMark(t, piece, ctx, { id, dark = true, fx = true, reduced = false, now = Date.now() } = {}) {
  const tinted = Boolean(tintOf(piece.category));
  const c = colorOf(t, piece.category);
  const fresh = fx && !reduced && piece.at != null && now - piece.at < FRESH;
  const on = !fresh || Boolean(piece.shown);
  const lh = ctx?.line_height || 20;
  const flow = (el, ms, delay = 0) => (fresh ? el.transition("opacity", { duration: ms, delay, easing: "ease-out" }) : el);
  const line = piece.category === "workflow"
    ? h_flex().absolute().left(0).bottom(1).gap(3).children(STEPS.map((_, i) => flow(div().id(`${id}-b${i}`).w(3).h(2).bg(alpha(c, "cc")).opacity(on ? 1 : 0), 120, i * 25)))
    : flow(div().id(`${id}-u`).absolute().left(0).right(0).bottom(1).h(1).bg(tinted ? alpha(c, "b3") : alpha(t.muted, "99")).opacity(on ? 1 : 0), 180);
  let word = h_flex().id(id).relative().flex_none().h(lh).items_center()
    .child(div().relative().font_family(MONO).text_size(13).text_color(tinted && dark ? c : t.foreground).child(String(piece.text ?? "")))
    .child(line);
  if (fresh) {
    word = word.child(flow(div().id(`${id}-v`).absolute().left(-2).right(-2).top(1).bottom(1).rounded(3).bg(alpha(c, "57")).opacity(on ? 0 : 1), 420))
      .on_size_change((_size, cx) => {
        if (piece.shown) return;
        piece.shown = true;
        cx.notify();
      });
  }
  return word;
}
