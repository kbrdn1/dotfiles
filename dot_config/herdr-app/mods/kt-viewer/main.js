// kbrdn Threads' image viewer: a full-window dialog over a 92 % canvas veil,
// opened by the before/after previews of Changes and History with
// openOverlay({ mod: "kt-viewer", kind: "dialog", frame: "none", width: 1,
// height: 1, props: { images: [{ path, label, name?, w?, h?, size? }], index } })
// (paths under the app home, as image() wants). The image starts fitted
// (contain); the wheel and a pinch zoom around the pointer, from 10 % to 800 %;
// a drag moves it; + − 0 (fit) 1 (100 %) zoom from the keyboard; ← → or the
// arrows switch between two images, "Comparer" puts them side by side. The
// controls float in a pill at the bottom (fitting leaves it room), ✕ alone at
// the top right. Esc, q, ✕ or a click on the veil outside the image closes it.
// Keys (vim.js, NORMAL only, no counts: 0 and 1 zoom): h j k l scroll a zoomed
// image (sxiv's way: h shows more of its left); [ ] the previous / next image,
// and h / l too while the image fits whole (nothing to scroll); ? the keys
// (kt-keys, Modales). `kt-viewer.key:<keys>` feeds keys ("l", "+ h"), for tests.

import { View, div, svg, image } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { props, closeOverlay, theme, openOverlay, nextCommand, checking } from "herdr";
import { Vim, keyOf, keysOf } from "./vim.js";

const MONO = "Monaspace Krypton";
const MIN = 0.1, MAX = 8;
const RESERVE = 72; // the bottom bar (40) and its 16 px above and below
const PAN = 80; // px an h j k l press scrolls the zoomed image
// A theme color with alpha `a`, replacing any it has (glass themes are #rrggbbaa).
const alpha = (c, a) => `${String(c).slice(0, 7)}${a}`;
const clamp = (z) => Math.min(MAX, Math.max(MIN, z));
const kb = (n) => (n >= 1048576 ? `${(n / 1048576).toFixed(1)} Mo` : n >= 1024 ? `${(n / 1024).toFixed(1)} Ko` : `${n} o`);

export default class Viewer extends View {
  init(_p, cx) {
    const p = props();
    this.index = Math.max(0, Math.min((p?.images?.length ?? 1) - 1, p?.index ?? 0));
    this.zoom = null; // null: fitted
    this.off = { x: 0, y: 0 };
    this.stage = { width: 0, height: 0 };
    this.compare = Boolean(p?.compare) && (p?.images?.length ?? 0) === 2;
    this.drag = null;
    this.handle = cx.focus_handle();
    this.handle.focus();
    this.vim = new Vim({ counts: false });
    if (!checking()) cx.spawn(async (cx) => {
      for (;;) {
        const c = await nextCommand();
        if (c.startsWith("key:")) {
          this.handle.focus();
          for (const k of keysOf(c.slice(4))) this.press(k);
        }
        cx.notify();
      }
    });
  }

  images() {
    return props()?.images ?? [];
  }

  img() {
    const i = this.images()[this.index] ?? {};
    // Unknown size (an svg without one): the stage's, so "fit" is 100 %.
    return { ...i, w: i.w || this.stage.width || 800, h: i.h || this.stage.height || 600 };
  }

  // The stage's height above the bottom bar: "Ajuster" never puts the image under it.
  area() {
    return Math.max(1, this.stage.height - RESERVE);
  }

  fit() {
    const i = this.img();
    if (!this.stage.width || !this.stage.height) return 1;
    return Math.min(this.stage.width / i.w, this.area() / i.h);
  }

  scale() {
    return this.zoom ?? this.fit();
  }

  // Where the image's top left sits in the stage (centered above the bar, then moved by the drag).
  origin(z) {
    const i = this.img();
    return { x: (this.stage.width - i.w * z) / 2 + this.off.x, y: (this.area() - i.h * z) / 2 + this.off.y };
  }

  // Zooms to `z`, keeping the stage point `at` (default: the center) still.
  zoomTo(z, at) {
    const from = this.scale(), to = clamp(z);
    const p = at ?? { x: this.stage.width / 2, y: this.area() / 2 };
    const o = this.origin(from), i = this.img();
    const u = (p.x - o.x) / from, v = (p.y - o.y) / from; // the image point under p
    this.zoom = to;
    this.off = { x: p.x - u * to - (this.stage.width - i.w * to) / 2, y: p.y - v * to - (this.area() - i.h * to) / 2 };
  }

  reset(z) {
    this.zoom = z ?? null;
    this.off = { x: 0, y: 0 };
  }

  go(d) {
    const n = this.images().length;
    if (n < 2) return;
    this.index = (this.index + d + n) % n;
    this.reset();
  }

  close() {
    closeOverlay(props()?.overlay);
  }

  key(e, cx) {
    if (!this.press(e)) return; // not ours: ctrl-b, cmd-* go on
    cx.stop_propagation();
    cx.notify();
  }

  // One key, from the keyboard or `key:` (a name): its own keys first (as before), then vim's.
  press(e) {
    const k = keyOf(e).name;
    if (k === "escape") this.close();
    else if (k === "+" || k === "=") this.zoomTo(this.scale() * 1.25);
    else if (k === "-" || k === "_") this.zoomTo(this.scale() / 1.25);
    else if (k === "0") this.reset();
    else if (k === "1") this.reset(1);
    else if (k === "left") this.go(-1);
    else if (k === "right") this.go(1);
    else return this.act(this.vim.handle(e));
    return true;
  }

  // One vim action; false: not one the viewer has.
  act(a) {
    if (!a) return false;
    if (a === "pending") return true;
    // Fits whole (fitted, or 100 % of a small one): h / l change image, j / k have nothing to scroll.
    const whole = this.compare || this.scale() <= this.fit() + 1e-6;
    if (a === "panel-prev" || a === "panel-next") this.go(a === "panel-next" ? 1 : -1);
    else if ((a === "left" || a === "right") && whole) this.go(a === "right" ? 1 : -1);
    else if (["left", "right", "up", "down"].includes(a) && !whole) {
      const d = a === "left" || a === "up" ? PAN : -PAN;
      this.off = a === "left" || a === "right" ? { ...this.off, x: this.off.x + d } : { ...this.off, y: this.off.y + d };
    } else if (a === "quit") this.close();
    else if (a === "help") openOverlay({ mod: "kt-keys", kind: "dialog", width: 1, height: 1, frame: "none", props: { group: "modals" } });
    else return false;
    return true;
  }

  pill(t, id, label, onClick, on) {
    return h_flex().id(id).flex_none().h(30).px(12).gap(6).items_center().rounded_full().border(1)
      .border_color(on ? alpha(t.accent, "66") : t.border).bg(on ? alpha(t.accent, "24") : t.popover)
      .font_family(MONO).text_size(11.5).text_color(on ? t.foreground : t.muted)
      .when(Boolean(onClick), (el) => el.cursor_pointer().hover((s) => s.bg(t.hover).text_color(t.foreground))
        .on_mouse_down("left", (_e, cx) => cx.stop_propagation())
        .on_click((_e, cx) => { onClick(); cx.notify(); }))
      .child(label);
  }

  // The floating pill at the bottom: vim's mode (with the keyboard), ←, label, size, zoom, − + 100 %
  // Ajuster, Comparer, →.
  bar(t) {
    const raw = this.images()[this.index] ?? {}, n = this.images().length;
    const z = this.scale();
    return h_flex().absolute().bottom(16).left(0).right(0).justify_center().child(h_flex().h(RESERVE - 32).gap(6).p(4).items_center()
      .rounded_full().bg(alpha(t.popover, "e6")).border(1).border_color(t.border)
      .on_mouse_down("left", (_e, cx) => cx.stop_propagation())
      .when(this.handle.is_focused(), (el) => el.child(div().flex_none().h(16).ml(6).px(6).flex().items_center().rounded(5).border(1)
        .border_color(t.border).bg(t.background).font_family(MONO).text_size(9).text_color(t.muted).child(this.vim.label)))
      .when(n === 2 && !this.compare, (el) => el.child(this.arrow(t, "kv-prev", "left", -1)))
      .child(this.pill(t, "kv-label", `${String(raw.label ?? raw.name ?? "image").toUpperCase()}${raw.name && raw.label ? ` · ${raw.name}` : ""}`))
      .when(Boolean(raw.w && raw.h), (el) => el.child(this.pill(t, "kv-dims", `${raw.w}×${raw.h}${raw.size ? ` · ${kb(raw.size)}` : ""}`)))
      .when(!this.compare, (el) => el
        .child(this.pill(t, "kv-zoom", `${Math.round(z * 100)} %`))
        .child(this.pill(t, "kv-out", "−", () => this.zoomTo(z / 1.25)))
        .child(this.pill(t, "kv-in", "+", () => this.zoomTo(z * 1.25)))
        .child(this.pill(t, "kv-100", "100 %", () => this.reset(1), this.zoom === 1))
        .child(this.pill(t, "kv-fit", "Ajuster", () => this.reset(), this.zoom === null)))
      .when(n === 2, (el) => el.child(this.pill(t, "kv-compare", "Comparer", () => { this.compare = !this.compare; this.reset(); }, this.compare)))
      .when(n === 2 && !this.compare, (el) => el.child(this.arrow(t, "kv-next", "right", 1))));
  }

  arrow(t, id, side, d) {
    return h_flex().id(id).flex_none().size(30).items_center().justify_center().rounded_full().border(1).border_color(t.border).bg(t.popover).text_color(t.muted)
      .cursor_pointer().hover((s) => s.bg(t.hover).text_color(t.foreground))
      .on_mouse_down("left", (_e, cx) => cx.stop_propagation())
      .on_click((_e, cx) => { this.go(d); cx.notify(); })
      .child(svg(side === "left" ? "mods/kt-crosstalk/chevron-left.svg" : "mods/kt-threads/chevron-right.svg").size(14));
  }

  // ✕ alone, a small round button at the top right.
  closeButton(t) {
    return h_flex().id("kv-close").absolute().top(16).right(16).size(32).items_center().justify_center().rounded_full()
      .border(1).border_color(t.border).bg(alpha(t.popover, "e6")).text_color(t.muted)
      .cursor_pointer().hover((s) => s.bg(t.hover).text_color(t.foreground))
      .on_mouse_down("left", (_e, cx) => cx.stop_propagation())
      .on_click(() => this.close())
      .child(svg("mods/kt-threads/x.svg").size(14));
  }

  // One image fitted in half the stage, with its label (compare mode).
  half(t, i, k) {
    return v_flex().flex_1().min_w(0).h_full().gap(8).p(12)
      .child(div().flex_none().font_family(MONO).text_size(11).text_color(t.muted).child(String(i.label ?? i.name ?? "").toUpperCase()))
      .child(div().flex_1().min_h(0).rounded(12).border(1).border_color(t.border).bg(t.background).p(8).child(image(i.path).size_full()))
      .child(div().flex_none().font_family(MONO).text_size(11).text_color(t.muted).child(`${i.w && i.h ? `${i.w}×${i.h} · ` : ""}${i.size ? kb(i.size) : ""}`));
  }

  render() {
    const t = theme();
    const list = this.images();
    const i = this.img();
    const z = this.scale(), o = this.origin(z);
    const stage = div().id("kv-stage").relative().size_full().overflow_hidden()
      .on_size_change((size, cx) => { this.stage = size; cx.notify(); })
      .on_scroll_wheel((e, cx) => {
        const d = e.delta?.y ?? 0;
        if (!d) return;
        this.zoomTo(this.scale() * Math.exp(d * 0.0025), e.local_position);
        cx.notify();
      })
      .on_pinch((e, cx) => { this.zoomTo(this.scale() * (1 + e.delta), e.local_position); cx.notify(); })
      .on_mouse_down("left", (e, cx) => {
        const p = e.local_position ?? e.position, oo = this.origin(this.scale()), zz = this.scale();
        const inside = p.x >= oo.x && p.y >= oo.y && p.x <= oo.x + i.w * zz && p.y <= oo.y + i.h * zz;
        this.drag = { x: e.position.x, y: e.position.y, ox: this.off.x, oy: this.off.y, inside, moved: false };
        cx.notify();
      })
      .on_mouse_move((e, cx) => {
        if (!this.drag) return;
        const dx = e.position.x - this.drag.x, dy = e.position.y - this.drag.y;
        if (Math.abs(dx) + Math.abs(dy) > 3) this.drag.moved = true;
        if (!this.drag.inside) return;
        this.off = { x: this.drag.ox + dx, y: this.drag.oy + dy };
        cx.notify();
      })
      .on_mouse_up("left", (_e, cx) => {
        const d = this.drag;
        this.drag = null;
        if (d && !d.inside && !d.moved) this.close(); // a click on the veil
        cx.notify();
      })
      .when(Boolean(i.path), (el) => el.child(image(i.path).absolute().left(o.x).top(o.y).w(i.w * z).h(i.h * z)
        .when(Boolean(this.drag?.inside), (e) => e.cursor_grabbing()).when(!this.drag?.inside, (e) => e.cursor_grab())));
    return div().id("kv-root").size_full().relative().bg(alpha(t.canvas, "eb")).text_color(t.foreground)
      .track_focus(this.handle)
      .on_key_down((e, cx) => this.key(e, cx))
      .when(!this.compare, (el) => el.child(stage))
      .when(this.compare && list.length === 2, (el) => el.child(h_flex().size_full().pt(48).pb(RESERVE - 12).gap(8).children(list.map((x, k) => this.half(t, x, k)))))
      .child(this.bar(t))
      .child(this.closeButton(t));
  }
}
