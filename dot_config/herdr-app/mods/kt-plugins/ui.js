// kt-plugins' drawing pieces (the page and its dialogs): kt-skills / kt-mcp's kbrdn.dev look.
// Concentric radii: a card 16, what sits 4 px inside it 12, a segment 3 px inside that 9.

import { div, svg } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { home, settings } from "herdr";
import { ditherBand, TOP } from "./dither.js";

export const MONO = "Monaspace Krypton";
export const CODE = "Monaspace Neon"; // fenced code and plugin.json
export const I = (name) => `mods/kt-threads/${name}.svg`;
export const OWN = (name) => `mods/kt-plugins/${name}.svg`;
export const SPIN = "mods/workspace-chrome/spinner.svg";
// A theme color with alpha `a`, replacing any it has (glass themes are #rrggbbaa).
export const alpha = (c, a) => `${String(c).slice(0, 7)}${a}`;
export const veil = () => (settings().dark ? alpha("#000000", "8c") : alpha("#0a0a0a", "59"));
export const tilde = (p) => (p && (p === home() || p.startsWith(home() + "/")) ? `~${p.slice(home().length)}` : p ?? "");
export const plural = (n, one, many) => `${n} ${n > 1 ? many : one}`;

const pad = (n) => String(n).padStart(2, "0");
/** "à l'instant", "il y a 3 h", then a date from a week on. */
export function ago(at) {
  if (!at) return "date inconnue";
  const s = Math.max(0, (Date.now() - at) / 1000);
  if (s < 60) return "à l'instant";
  if (s < 3600) return `il y a ${Math.floor(s / 60)} min`;
  if (s < 86400) return `il y a ${Math.floor(s / 3600)} h`;
  if (s < 7 * 86400) return `il y a ${Math.floor(s / 86400)} j`;
  const d = new Date(at);
  return `le ${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

export const card = (t) => v_flex().min_h(0).rounded(16).border(1).border_color(t.border).bg(t.background);
export const eyebrow = (t, text, color) => div().font_family(MONO).text_size(11).text_color(color ?? t.muted).child(String(text).toUpperCase());
export const dashed = (t) => div().flex_none().h(0).border_t(1).border_dashed().border_color(t.border);
export const empty = (t, text, color) => div().p(16).text_size(13).text_color(color ?? t.dim).child(text);

/** kbrdn.dev `.tag`: a pill, border 30% / fill 10% of its own color. */
export function tag(t, color, text) {
  return h_flex().flex_none().h(18).px(7).items_center().rounded_full().border(1).border_color(alpha(color, "4d")).bg(alpha(color, "1a"))
    .text_color(color).font_family(MONO).text_size(10).child(String(text).toUpperCase());
}

/** NORMAL / INSERT (kt-keys' pill), mono 9 px. */
export function mode(t, label, typing) {
  return div().flex_none().h(16).px(6).flex().items_center().rounded(5).border(1)
    .border_color(typing ? alpha(t.accent, "66") : t.border).bg(typing ? alpha(t.accent, "24") : t.background)
    .font_family(MONO).text_size(9).text_color(typing ? t.accent : t.muted).child(label);
}

/** A round button. `primary`: solid; `danger`: red text; `off`: dimmed, its `tip` says why. */
export function pill(t, id, label, icon, onClick, { primary = false, danger = false, off = false, tip = null, h = 30 } = {}) {
  const ink = danger ? t.ansi1 : primary ? t.solid_foreground : t.foreground;
  return h_flex().id(id).flex_none().h(h).px(13).gap(6).items_center().rounded_full().border(1)
    .border_color(primary && !off ? t.solid : t.border).bg(primary && !off ? t.solid : t.background)
    .text_size(12.5).font_medium().text_color(off ? t.dim : ink)
    .when(off, (el) => el.opacity(0.55))
    .when(!off, (el) => el.cursor_pointer().hover((s) => (primary ? s.opacity(0.88) : s.bg(danger ? alpha(t.ansi1, "1a") : t.hover))))
    .when(Boolean(tip), (el) => el.tooltip(tip))
    .on_mouse_down("left", (_e, cx) => cx.stop_propagation())
    .on_click((_e, cx) => { cx.stop_propagation(); if (!off) onClick(cx); cx.notify(); })
    .when(Boolean(icon), (el) => el.child(svg(icon).size(13)))
    .child(label);
}

/** A small round icon button; it keeps its click from the row. */
export function icon(t, id, glyph, tip, onClick, { danger = false, off = false } = {}) {
  return div().id(id).p(4).rounded_full().flex_none().text_color(off ? t.dim : danger ? t.ansi1 : t.muted).tooltip(tip)
    .when(off, (el) => el.opacity(0.5))
    .when(!off, (el) => el.cursor_pointer().hover((s) => s.bg(t.hover).text_color(danger ? t.ansi1 : t.foreground)))
    .on_click((_e, cx) => { cx.stop_propagation(); if (!off) onClick(cx); cx.notify(); })
    .child(svg(glyph).size(13));
}

/** A row's selection box (select.js): drawn on hover or once a row is selected, its room kept. */
export function check(t, id, on, shown, onClick) {
  return div().id(id).size(16).flex_none().rounded(5).border(1).flex().items_center().justify_center()
    .when(!shown, (el) => el.border_color(alpha(t.input, "00")))
    .when(shown, (el) => el.border_color(on ? t.accent : t.input).bg(on ? t.accent : t.background).cursor_pointer()
      .hover((s) => s.border_color(t.accent))
      .on_click((_e, cx) => { cx.stop_propagation(); onClick(); cx.notify(); }))
    .when(on, (el) => el.child(svg(I("check")).size(11).text_color(t.accent_foreground)));
}

/** Segments ([key, label, count]) in a box 36 high, radius 12; `on`: the shown one. */
export function segments(t, prefix, segs, on, onPick) {
  return h_flex().flex_none().h(36).p(3).gap(2).items_center().rounded(12).border(1).border_color(t.border)
    .children(segs.map(([k, label, n]) => {
      const sel = on === k;
      return h_flex().id(`${prefix}-${k}`).h_full().px(11).gap(6).items_center().rounded(9).border(1)
        .border_color(sel ? alpha(t.accent, "66") : alpha(t.accent, "00"))
        .when(sel, (el) => el.bg(alpha(t.accent, "24")))
        .when(!sel, (el) => el.hover((s) => s.bg(t.hover).text_color(t.foreground)))
        .text_size(12).text_color(sel ? t.foreground : t.muted).cursor_pointer()
        .on_click((_e, cx) => { onPick(k, cx); cx.notify(); })
        .child(label)
        .when(n != null, (el) => el.child(div().font_family(MONO).text_size(10.5).text_color(t.dim).child(String(n))));
    }));
}

/** A small chip (a marketplace filter, a component). */
export function chip(t, id, label, on, onClick) {
  return h_flex().id(id).flex_none().h(24).px(10).gap(6).items_center().rounded_full().border(1)
    .border_color(on ? alpha(t.accent, "66") : t.border).when(on, (el) => el.bg(alpha(t.accent, "24")))
    .font_family(MONO).text_size(11).text_color(on ? t.foreground : t.muted)
    .when(Boolean(onClick), (el) => el.cursor_pointer().hover((s) => s.bg(t.hover).text_color(t.foreground))
      .on_click((_e, cx) => { cx.stop_propagation(); onClick(cx); cx.notify(); }))
    .child(label);
}

/** A fenced block: t.raised, radius 12, Monaspace Neon, one line per row; a long line scrolls. */
export function codeBlock(t, id, lang, text) {
  return v_flex().flex_none().rounded(12).border(1).border_color(t.border).bg(t.raised).overflow_hidden()
    .when(Boolean(lang), (el) => el.child(div().px(14).pt(9).font_family(MONO).text_size(10).text_color(t.dim).child(lang.toUpperCase())))
    .child(div().id(`ktp-code-${id}`).overflow_x_scrollbar().px(14).pt(lang ? 6 : 12).pb(12)
      .child(v_flex().flex_none().font_family(CODE).text_size(12).line_height("19px").text_color(t.foreground)
        .children(String(text).split("\n").map((l) => div().flex_none().whitespace_nowrap().child(l || " ")))));
}

// ---------- Crosstalk's head (data/orchestrator/DESIGN-REFERENCE.md) ----------

// Marketplace tints (FILTERS.md: ansi4, ansi5, ansi6… in order), by name order among the known ones,
// so a marketplace keeps its tint on the page and in Parcourir; claude.ai's own: accent.
const MARKET_TINTS = ["ansi4", "ansi5", "ansi6", "ansi2", "ansi3", "accent"];
export function marketTint(name, markets) {
  if (name === "synced") return "accent";
  const names = Object.keys(markets ?? {}).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  return MARKET_TINTS[Math.max(0, names.indexOf(name)) % MARKET_TINTS.length];
}

/** A 60 px head over a dither of `color`, inside its card's 1 px border (`radius`: the card's minus
 *  that border): mark, title (14 semibold), mono subtitle (10.5), icon buttons on the right. `w`: its
 *  measured width (`onW(width, cx)` reports it), the trame waits for it. */
export function band(t, id, color, { mark, title, sub, actions = [], radius = 15, w = 0, onW }) {
  return div().id(id).relative().flex_none().h(60).overflow_hidden().rounded_t(radius)
    .on_size_change((size, cx) => { if (Math.abs(w - size.width) >= 0.5) onW?.(size.width, cx); })
    // dither.js (shared): the trame 1:1 through 2 px rows as wide as the top arcs allow, so the
    // corners are filled up to the arc and nothing crosses it or the border (DESIGN-REFERENCE.md).
    .when(w > 2 * radius, (el) => el.child(ditherBand(w, 60, radius, alpha(color, settings().dark ? "6b" : "4d"), TOP)))
    .child(h_flex().size_full().px(12).gap(10).items_center()
      .child(mark)
      .child(v_flex().flex_1().min_w(0).gap(2)
        .child(div().truncate().text_size(14).font_semibold().text_color(t.foreground).child(title))
        .child(div().truncate().font_family(MONO).text_size(10.5).text_color(t.muted).child(sub)))
      .children(actions.filter(Boolean)));
}

/** The dashed rule under a band, in its color. */
export const bandRule = (color) => div().flex_none().h(0).border_t(1).border_dashed().border_color(alpha(color, "4d"));

/** A 32 px mark: a glyph in `color` on its pale tile, a status dot at its corner. */
export function markTile(t, glyph, color, dot) {
  return div().relative().flex_none().size(32)
    .child(div().size_full().rounded(10).border(1).border_color(alpha(color, "4d")).bg(alpha(color, "24")).flex().items_center().justify_center()
      .child(svg(glyph).size(16).text_color(color)))
    .when(Boolean(dot), (el) => el.child(div().absolute().right(-2).bottom(-2).size(9).rounded_full().border(2).border_color(t.background).bg(dot)));
}

/** A discreet round icon button; its tooltip gives the key ("Rafraîchir (r)"). */
export function iconBtn(t, id, glyph, tip, fn, { off = false, spin = false, onDown = null } = {}) {
  return div().id(id).size(28).flex_none().rounded_full().flex().items_center().justify_center().text_color(off ? t.dim : t.muted).tooltip(tip)
    .when(off, (el) => el.opacity(0.5))
    .when(!off, (el) => el.cursor_pointer().hover((s) => s.bg(alpha(t.foreground, "14")).text_color(t.foreground)))
    .when(Boolean(onDown), (el) => el.on_mouse_down("left", onDown))
    .on_click((_e, cx) => { cx.stop_propagation(); if (!off) fn(cx); cx.notify(); })
    .child(svg(glyph).size(14).when(spin, (el) => el.spin(900)));
}

/** The "⋯" menu, floating under the band's right edge: rows 30 high, radius 10. `rows`:
 *  [id, glyph, label, fn]; `close()` runs on a row's click and on a press outside it. */
export function moreMenu(t, id, rows, close) {
  return v_flex().id(id).absolute().top(56).right(10).w(280).p(4).gap(2).rounded(14).border(1).border_color(t.border).bg(t.popover).shadow_lg()
    .on_mouse_down_out((_e, cx) => { close(); cx.notify(); })
    .children(rows.map(([rid, glyph, label, fn]) => h_flex().id(rid).h(30).px(10).gap(8).items_center().rounded(10).text_size(12.5)
      .text_color(t.foreground).cursor_pointer().hover((s) => s.bg(t.hover))
      .on_click((_e, cx) => { close(); fn(cx); cx.notify(); })
      .child(svg(glyph).size(13).flex_none().text_color(t.muted)).child(label)));
}

/** A warning band: what an install runs (hooks, MCP, mods) is third-party code. */
export function warning(t, text) {
  return h_flex().flex_none().gap(8).items_start().px(12).py(9).rounded(12).border(1).border_color(alpha(t.blocked, "4d")).bg(alpha(t.blocked, "14"))
    .child(svg(I("circle-alert")).size(13).flex_none().mt(2).text_color(t.blocked))
    .child(div().flex_1().min_w(0).text_size(12.5).line_height("18px").text_color(t.foreground).child(text));
}
