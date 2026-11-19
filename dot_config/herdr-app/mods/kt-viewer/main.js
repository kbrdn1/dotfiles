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
// #80: `items` (the Chat's attachments) besides `images` (items.js says both, `images` unchanged):
// a PDF page by page (rendered by the command items.js builds itself: j / k or ⇟ ⇞ while it fits, its
// ‹ › in the bar), markdown as the notes show it (markdown.js, a byte-identical copy: prose, code in
// Zed's colors, http(s) links only), code and text in a readonly editor (kt-files' pattern), anything
// else said, with « Afficher dans le Finder »; ← → or [ ] between all the message's items.

import { View, div, svg, image } from "gpui-kit";
import { v_flex, h_flex, Editor, EditorState } from "gpui-base";
import { props, closeOverlay, theme, openOverlay, nextCommand, checking, exec, appHome, home, shared, readTextFile, settings } from "herdr";
import { Vim, keyOf, keysOf } from "./vim.js";
import { motionState, frame, sheet, leave } from "./motion.js";
import { skeleton } from "./skeleton.js";
import { makeT, num } from "./i18n.js";
import { mdState, docOf, preview as mdPreview, target as mdTarget } from "./markdown.js";
import { itemsOf, zoomable, textual, pageArgv, clampPage, pageImage, editorLang, capText, webLink, openArgv } from "./items.js";
import strings from "./strings.js";

const tr = makeT(strings);
const MONO = "Monaspace Krypton";
const MIN = 0.1, MAX = 8;
const RESERVE = 72; // the bottom bar (40) and its 16 px above and below
const PAN = 80; // px an h j k l press scrolls the zoomed image
// A theme color with alpha `a`, replacing any it has (glass themes are #rrggbbaa).
const alpha = (c, a) => `${String(c).slice(0, 7)}${a}`;
const clamp = (z) => Math.min(MAX, Math.max(MIN, z));
const kb = (n) => (n >= 1048576 ? tr("size.mb", { n: num(n / 1048576, 1) }) : n >= 1024 ? tr("size.kb", { n: num(n / 1024, 1) }) : tr("size.b", { n }));

export default class Viewer extends View {
  init(_p, cx) {
    const p = props();
    const list = itemsOf(p);
    this.index = Math.max(0, Math.min((list.length || 1) - 1, p?.index ?? 0));
    this.zoom = null; // null: fitted
    this.off = { x: 0, y: 0 };
    this.stage = { width: 0, height: 0 };
    this.compare = Boolean(p?.compare) && list.length === 2 && list.every((x) => x.kind === "image");
    this.pages = {}; // a PDF item's page, by index: { n, pages, path, w, h, busy, error }
    this.texts = {}; // a document's text, by index: { text, cut } | { busy } | { error }
    this.editors = {}; // code and text: their readonly editor, by index
    this.md = mdState();
    this.drag = null;
    this.handle = cx.focus_handle();
    this.handle.focus();
    this.vim = new Vim({ counts: false });
    this.motion = motionState(); // ANIMATIONS.md: the veil fades and the bar rises, in and out (motion.js sheet, leave)
    // Is each file there? The previews are copies (data/…) that a cleanup can take: a missing one is
    // said, not drawn as an empty stage. path -> true | false, absent while it's being looked for.
    this.exists = {};
    if (!checking()) cx.spawn(async (cx) => {
      for (const path of new Set(this.items().filter((x) => x.kind === "image").map((x) => x.path).filter(Boolean))) {
        const r = await exec("test", ["-f", path.startsWith("/") ? path : `${appHome()}/${path}`]).catch(() => null);
        this.exists[path] = r?.code === 0;
      }
      cx.notify();
    });
    this.load(cx);
    if (!checking()) cx.spawn(async (cx) => {
      for (;;) {
        const c = await nextCommand();
        if (c.startsWith("key:")) {
          this.handle.focus();
          for (const k of keysOf(c.slice(4))) this.press(k, cx);
        }
        cx.notify();
      }
    });
  }

  items() {
    return itemsOf(props());
  }

  // An image's state: "ok", "loading" (looking for its file), "missing", "none" (no path at all); a
  // PDF's: its page being rendered, there, or not renderable ("pdf"). A check (`herdr-app check`)
  // looks for nothing: drawn as there.
  status(x, i = this.index) {
    if (x?.kind === "pdf") {
      const p = this.pages[i];
      return !p || p.busy ? (checking() ? "ok" : "loading") : p.path ? "ok" : "pdf";
    }
    if (!x?.path) return "none";
    const e = this.exists[x.path];
    return e === undefined ? (checking() ? "ok" : "loading") : e ? "ok" : "missing";
  }

  img() {
    const i = this.items()[this.index] ?? {};
    const p = i.kind === "pdf" ? this.pages[this.index] ?? {} : null;
    // Unknown size (an svg without one): the stage's, so "fit" is 100 %.
    return { ...i, path: p ? p.path : i.path, w: (p ? p.w : i.w) || this.stage.width || 800, h: (p ? p.h : i.h) || this.stage.height || 600 };
  }

  // What the current item needs before it is drawn, asked once: a PDF's page (the opener's command),
  // a document's text (items.js MAX_BYTES at most; code and text then get their readonly editor).
  load(cx) {
    if (checking()) return;
    const i = this.index, it = this.items()[i];
    if (it?.kind === "pdf") return this.turn(cx, this.pages[i]?.n ?? 1);
    if (!textual(it) || this.texts[i]) return;
    this.texts[i] = { busy: true };
    cx.spawn(async (cx) => {
      const raw = await readTextFile(it.src).catch(() => null);
      this.texts[i] = raw == null ? { error: true } : capText(raw);
      if (raw != null && it.kind !== "markdown") {
        const t = theme();
        this.editors[i] = EditorState.new({
          language: editorLang(it), value: this.texts[i].text, readonly: true, font_family: settings().font_family, font_size: 12.5,
          syntax: { keyword: t.ansi5, string: t.ansi2, comment: t.dim, function: t.ansi4, type: t.ansi3, number: t.ansi1, constant: t.ansi6 },
        });
      }
      cx.notify();
    });
  }

  // A PDF item's page `n` (kept inside the document), rendered by the command items.js pageArgv BUILDS
  // from the PDF's path and the page (by argv; the opener passes no command): the page's PNG under the
  // app home, its size and the page count come back. No path to a .pdf: « Page indisponible », no exec.
  turn(cx, n) {
    const i = this.index, it = this.items()[i], cur = this.pages[i];
    const want = clampPage(n, cur?.pages ?? 0);
    if (cur && cur.n === want && (cur.busy || cur.path)) return;
    const argv = pageArgv(it, want, { home: home(), appHome: appHome() });
    if (!argv) {
      this.pages[i] = { n: want, error: true };
      return;
    }
    this.pages[i] = { ...cur, n: want, busy: true, path: null };
    cx.spawn(async (cx) => {
      const r = await exec(argv[0], argv.slice(1)).catch(() => null);
      let a = null;
      try { a = JSON.parse(r?.stdout ?? ""); } catch { /* said as not renderable */ }
      if (this.pages[i]?.n !== want) return; // another page was asked meanwhile
      const path = pageImage(a);
      this.pages[i] = { n: want, pages: a?.pages ?? cur?.pages ?? 0, path, w: a?.w, h: a?.h, error: !path };
      if (i === this.index) this.reset();
      cx.notify();
    });
  }

  // Herdr calls it when the overlay goes or the mod reloads: the editors let go of their buffers.
  close() {
    for (const e of Object.values(this.editors ?? {})) e?.release?.();
    this.editors = {};
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

  go(d, cx) {
    const n = this.items().length;
    if (n < 2) return;
    this.index = (this.index + d + n) % n;
    this.reset();
    if (cx) this.load(cx);
  }

  // Not `close()`: Herdr calls a View's close() when the mod reloads or its overlay goes.
  // motion.js leave(): the veil fades out and the bar sinks, then the viewer closes.
  dismiss(cx) {
    leave(this.motion, cx, "kv", () => closeOverlay(props()?.overlay));
  }

  key(e, cx) {
    if (!this.press(e, cx)) return; // not ours: ctrl-b, cmd-* go on
    cx.stop_propagation();
    cx.notify();
  }

  // One key, from the keyboard or `key:` (a name): its own keys first (as before), then vim's.
  press(e, cx) {
    const k = keyOf(e).name;
    const it = this.items()[this.index];
    const zoom = zoomable(it);
    if (k === "escape") this.dismiss(cx);
    else if (zoom && (k === "+" || k === "=")) this.zoomTo(this.scale() * 1.25);
    else if (zoom && (k === "-" || k === "_")) this.zoomTo(this.scale() / 1.25);
    else if (zoom && k === "0") this.reset();
    else if (zoom && k === "1") this.reset(1);
    else if (k === "left") this.go(-1, cx);
    else if (k === "right") this.go(1, cx);
    else if (it?.kind === "pdf" && (k === "pagedown" || k === "pageup")) this.turn(cx, (this.pages[this.index]?.n ?? 1) + (k === "pagedown" ? 1 : -1));
    else return this.act(this.vim.handle(e), cx);
    return true;
  }

  // One vim action; false: not one the viewer has.
  act(a, cx) {
    if (!a) return false;
    if (a === "pending") return true;
    // Fits whole (fitted, or 100 % of a small one): h / l change item, j / k turn a PDF's page (an
    // image has nothing to scroll). A document scrolls itself: h / l still change item.
    const it = this.items()[this.index];
    const whole = !zoomable(it) || this.compare || this.scale() <= this.fit() + 1e-6;
    if (a === "panel-prev" || a === "panel-next") this.go(a === "panel-next" ? 1 : -1, cx);
    else if ((a === "left" || a === "right") && whole) this.go(a === "right" ? 1 : -1, cx);
    else if ((a === "up" || a === "down") && whole && it?.kind === "pdf") this.turn(cx, (this.pages[this.index]?.n ?? 1) + (a === "down" ? 1 : -1));
    else if (["left", "right", "up", "down"].includes(a) && !whole) {
      const d = a === "left" || a === "up" ? PAN : -PAN;
      this.off = a === "left" || a === "right" ? { ...this.off, x: this.off.x + d } : { ...this.off, y: this.off.y + d };
    } else if (a === "quit") this.dismiss(cx);
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

  // The floating pill at the bottom, in groups between thin rules: vim's mode (with the keyboard), ←,
  // what it shows (its label as a tag, its name, n / total, size), the zoom (− readout +, 100 %,
  // Ajuster), Comparer, →. It rises 6 px with the opening and sinks back on dismiss (`s`: motion.js sheet).
  bar(t, s) {
    const raw = this.items()[this.index] ?? {}, n = this.items().length;
    const z = this.scale();
    const ok = this.status(raw) === "ok";
    const page = raw.kind === "pdf" ? this.pages[this.index] : null;
    const rule = () => div().flex_none().w(1).h(18).mx(2).bg(t.border);
    const round = (id, icon, onClick) => h_flex().id(id).flex_none().size(24).items_center().justify_center().rounded_full().text_color(t.muted)
      .cursor_pointer().hover((s) => s.bg(t.hover).text_color(t.foreground))
      .on_mouse_down("left", (_e, cx) => cx.stop_propagation())
      .on_click((_e, cx) => { onClick(cx); cx.notify(); })
      .child(svg(`mods/kt-threads/${icon}.svg`).size(12));
    // Its kind as a tag: an image without a name says « image », a document its kind (code: its language).
    const label = raw.label ?? (raw.kind === "image" ? (raw.name ? null : tr("image")) : raw.kind === "code" && raw.lang ? raw.lang : tr(`kind.${raw.kind}`));
    return h_flex().absolute().bottom(16).left(0).right(0).justify_center().child(s.card(h_flex())
      .h(RESERVE - 32).max_w_full().gap(6).p(4).items_center()
      .rounded_full().bg(alpha(t.popover, "e6")).border(1).border_color(t.border)
      .on_mouse_down("left", (_e, cx) => cx.stop_propagation())
      .when(this.handle.is_focused(), (el) => el.child(div().flex_none().h(16).ml(6).px(6).flex().items_center().rounded(5).border(1)
        .border_color(t.border).bg(t.background).font_family(MONO).text_size(9).text_color(t.muted).child(this.vim.label)))
      .when(n > 1 && !this.compare, (el) => el.child(this.arrow(t, "kv-prev", "left", -1)))
      .child(h_flex().id("kv-label").min_w(0).h(30).px(8).gap(8).items_center()
        .when(Boolean(label), (el) => el.child(div().flex_none().h(18).px(6).flex().items_center().rounded(5).border(1).border_color(alpha(t.accent, "4d")).bg(alpha(t.accent, "14"))
          .font_family(MONO).text_size(9.5).text_color(t.accent).child(String(label).toUpperCase())))
        .when(Boolean(raw.name), (el) => el.child(div().min_w(0).max_w(240).truncate().text_size(12.5).text_color(t.foreground).child(raw.name)))
        .when(n > 1, (el) => el.child(div().flex_none().font_family(MONO).text_size(10.5).text_color(t.dim).child(`${this.index + 1}/${n}`))))
      .when(Boolean(raw.w && raw.h) || Boolean(raw.size), (el) => el.child(div().id("kv-dims").flex_none().pr(4).font_family(MONO).text_size(10.5).text_color(t.muted)
        .child([raw.w && raw.h ? `${raw.w}×${raw.h}` : null, raw.size ? kb(raw.size) : null].filter(Boolean).join(" · "))))
      // A PDF: its page (‹ n / total ›), j / k and ⇟ ⇞ too.
      .when(Boolean(page), (el) => el.child(rule())
        .child(h_flex().flex_none().h(30).p(2).gap(2).items_center().rounded_full().border(1).border_color(t.border).bg(t.background)
          .child(round("kv-page-prev", "chevron-up", (cx) => this.turn(cx, page.n - 1)))
          .child(div().id("kv-page").px(4).flex_none().font_family(MONO).text_size(11).text_color(t.foreground)
            .child(tr("page", { n: page.n, total: page.pages || "…" })))
          .child(round("kv-page-next", "chevron-down", (cx) => this.turn(cx, page.n + 1)))))
      .when(!this.compare && ok && zoomable(raw), (el) => el
        .child(rule())
        .child(h_flex().flex_none().h(30).p(2).gap(2).items_center().rounded_full().border(1).border_color(t.border).bg(t.background)
          .child(round("kv-out", "minus", () => this.zoomTo(z / 1.25)))
          .child(div().id("kv-zoom").w(52).flex_none().text_center().font_family(MONO).text_size(11).text_color(t.foreground).child(tr("percent", { n: Math.round(z * 100) })))
          .child(round("kv-in", "plus", () => this.zoomTo(z * 1.25))))
        .child(this.pill(t, "kv-100", tr("percent", { n: 100 }), () => this.reset(1), this.zoom === 1))
        .child(this.pill(t, "kv-fit", tr("fit"), () => this.reset(), this.zoom === null)))
      .when(n === 2 && this.items().every((x) => x.kind === "image"), (el) => el.child(rule()).child(this.pill(t, "kv-compare", tr("compare"), () => { this.compare = !this.compare; this.reset(); }, this.compare)))
      .when(n > 1 && !this.compare, (el) => el.child(this.arrow(t, "kv-next", "right", 1))));
  }

  // An item that can't be drawn, said plainly in a card: the file gone, nothing given at all, a PDF's
  // page not renderable, a document not readable, a kind not shown here; with, on a click, its file
  // opened in its app (a PDF, markdown, text) or only shown in the Finder (code, an unknown kind: a
  // click never runs a file, items.js openArgv). `compact`: inside a compare half `k` (its id carries it).
  notice(t, x, kind, compact = false, k = 0) {
    const [icon, color] = { missing: ["circle-alert", t.blocked], none: ["file", t.dim], pdf: ["circle-alert", t.blocked], unreadable: ["circle-alert", t.blocked], other: ["file", t.dim] }[kind];
    const [title, text] = [tr(`${kind}.title`), tr(`${kind}.text`)];
    const where = x?.path ?? x?.src;
    return v_flex().id(`kv-notice-${kind}-${k}`).max_w(compact ? 300 : 380).gap(6).p(compact ? 14 : 18).rounded(16).border(1).border_color(t.border).bg(alpha(t.popover, "e6"))
      .on_mouse_down("left", (_e, cx) => cx.stop_propagation())
      .child(h_flex().gap(10).items_center()
        .child(h_flex().size(32).flex_none().rounded(10).items_center().justify_center().border(1).border_color(alpha(color, "4d")).bg(t.surface)
          .child(svg(`mods/kt-threads/${icon}.svg`).size(16).text_color(color)))
        .child(div().min_w(0).truncate().text_size(15).font_medium().text_color(t.foreground).child(title)))
      .child(div().text_size(13).line_height("20px").text_color(t.muted).child(text))
      .when(Boolean(where), (el) => el.child(div().font_family(MONO).text_size(10.5).line_height("16px").text_color(t.dim).child(where)))
      .when(Boolean(openArgv(x)) && kind !== "none", (el) => {
        const argv = openArgv(x);
        return el.child(h_flex().pt(4).child(this.pill(t, `kv-open-${k}`, tr(argv.includes("-R") ? "showInFinder" : "openElsewhere"), () => {
          if (!checking()) exec(argv[0], argv.slice(1)).catch(() => null);
        }, false)));
      });
  }

  // A document (#80) in a reading box above the bar: markdown as the notes show it (markdown.js
  // preview: prose, code in Zed's colors), code and text in their readonly editor; the skeleton while
  // it reads, its reason when it can't, a line when it was cut (items.js MAX_BYTES).
  docStage(t, cx, it) {
    const st = this.texts[this.index];
    const box = (el) => div().absolute().top(56).left(0).right(0).bottom(RESERVE).px(16).flex().justify_center()
      .child(v_flex().w_full().max_w(920).h_full().min_h(0).rounded(12).border(1).border_color(t.border).bg(alpha(t.popover, "f2")).overflow_hidden()
        .on_mouse_down("left", (_e, cx) => cx.stop_propagation()).child(el));
    if (st?.error) return div().absolute().top(0).left(0).right(0).bottom(RESERVE).px(16).flex().items_center().justify_center().child(this.notice(t, it, "unreadable"));
    if (!st || st.busy) return box(this.S.pulse(this.S.block(null, 0, { r: 6 }).size_full().id("kv-doc-sk")));
    const cut = st.cut ? div().flex_none().px(16).py(8).border_t(1).border_color(t.border).text_size(11.5).text_color(t.muted).child(tr("cut")) : null;
    if (it.kind === "markdown") {
      const doc = docOf(this.md, st.text);
      // A link: http(s) only (items.js webLink), opened in the browser on its click.
      const onLink = (url) => { const web = webLink(mdTarget(url)?.web); if (web && !checking()) exec("/usr/bin/open", [web]).catch(() => null); };
      return box(v_flex().size_full().min_h(0)
        .child(v_flex().id("kv-md-scroll").flex_1().min_h(0).overflow_y_scrollbar().px(28).py(24)
          .child(mdPreview(t, cx, this.md, { id: "kv-md", mod: "kt-viewer", doc, onLink })))
        .when(Boolean(cut), (el) => el.child(cut)));
    }
    const ed = this.editors[this.index];
    return box(v_flex().size_full().min_h(0)
      .child(ed ? Editor.new(ed).flex_1().min_h(0) : div().flex_1())
      .when(Boolean(cut), (el) => el.child(cut)));
  }

  arrow(t, id, side, d) {
    return h_flex().id(id).flex_none().size(30).items_center().justify_center().rounded_full().border(1).border_color(t.border).bg(t.popover).text_color(t.muted)
      .cursor_pointer().hover((s) => s.bg(t.hover).text_color(t.foreground))
      .on_mouse_down("left", (_e, cx) => cx.stop_propagation())
      .on_click((_e, cx) => { this.go(d, cx); cx.notify(); })
      .child(svg(side === "left" ? "mods/kt-crosstalk/chevron-left.svg" : "mods/kt-threads/chevron-right.svg").size(14));
  }

  // ✕ alone, a small round button at the top right.
  closeButton(t) {
    return h_flex().id("kv-close").absolute().top(16).right(16).size(32).items_center().justify_center().rounded_full()
      .border(1).border_color(t.border).bg(alpha(t.popover, "e6")).text_color(t.muted)
      .cursor_pointer().hover((s) => s.bg(t.hover).text_color(t.foreground))
      .on_mouse_down("left", (_e, cx) => cx.stop_propagation())
      .on_click((_e, cx) => this.dismiss(cx))
      .child(svg("mods/kt-threads/x.svg").size(14));
  }

  // One image fitted in half the stage, with its label (compare mode).
  half(t, i, k) {
    const st = this.status(i);
    return v_flex().flex_1().min_w(0).h_full().gap(8).p(12)
      .child(div().flex_none().font_family(MONO).text_size(11).text_color(t.muted).child(String(i.label ?? i.name ?? "").toUpperCase()))
      .child(div().flex_1().min_h(0).rounded(12).border(1).border_color(t.border).bg(t.background).p(8)
        .when(st === "ok", (el) => el.child(image(i.path).size_full()))
        // While its file is looked for: the frame it will fill (skeleton.js), breathing.
        .when(st === "loading", (el) => el.child(this.S.pulse(this.S.block(null, 0, { r: 6 }).size_full().id(`kv-half-sk-${k}`))))
        .when(st !== "ok" && st !== "loading", (el) => el.flex().items_center().justify_center().child(this.notice(t, i, st, true, k))))
      .child(div().flex_none().font_family(MONO).text_size(11).text_color(t.muted).child(`${i.w && i.h ? `${i.w}×${i.h} · ` : ""}${i.size ? kb(i.size) : ""}`));
  }

  render(cx) {
    const t = theme();
    const still = Boolean(shared("kt.reducedMotion"));
    const m = frame(this.motion, still);
    this.S = skeleton(t, m);
    const list = this.items();
    const item = list[this.index];
    const zoom = zoomable(item);
    const i = this.img();
    const st = this.status(item);
    const z = this.scale(), o = this.origin(z);
    const stage = div().id("kv-stage").relative().size_full().overflow_hidden()
      .on_size_change((size, cx) => { this.stage = size; cx.notify(); })
      .on_scroll_wheel((e, cx) => {
        const d = e.delta?.y ?? 0;
        if (!d || !zoom) return; // a document scrolls in its own box
        this.zoomTo(this.scale() * Math.exp(d * 0.0025), e.local_position);
        cx.notify();
      })
      .on_pinch((e, cx) => { if (!zoom) return; this.zoomTo(this.scale() * (1 + e.delta), e.local_position); cx.notify(); })
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
        if (d && !d.inside && !d.moved) this.dismiss(cx); // a click on the veil
        cx.notify();
      })
      .when(zoom && st === "ok", (el) => el.child(image(i.path).absolute().left(o.x).top(o.y).w(i.w * z).h(i.h * z)
        .when(Boolean(this.drag?.inside), (e) => e.cursor_grabbing()).when(!this.drag?.inside, (e) => e.cursor_grab())))
      // While its file is looked for (a PDF: its page rendered): the image's own box, at its place and
      // size (skeleton.js), breathing.
      .when(zoom && st === "loading", (el) => el.child(this.S.pulse(this.S.block(i.w * z, i.h * z, { r: 6 }).absolute().left(o.x).top(o.y).id("kv-img-sk"))))
      // A document: its reading box (docStage).
      .when(textual(item), (el) => el.child(this.docStage(t, cx, item)))
      // Not drawable: the reason, in the middle of the stage above the bar.
      .when(item?.kind === "other" || (zoom && st !== "ok" && st !== "loading") || !item, (el) => el.child(div().absolute().top(0).left(0).right(0).bottom(RESERVE).px(16).flex().items_center().justify_center()
        .child(this.notice(t, item, item?.kind === "other" ? "other" : st))));
    // The modals' motion (ANIMATIONS.md, kt-confirm's motif): the veil fades in and the bar rises
    // 6 px, 180 ms, once, on the root's first size report (the stage isn't drawn in compare), and
    // both go back out on dismiss (motion.js sheet); reduced motion: there at once.
    const shown = still || Boolean(this.size);
    const s = sheet(m, "kv", shown);
    return s.veil(div().id("kv-root").size_full().relative().bg(alpha(t.canvas, "eb")).text_color(t.foreground))
      .on_size_change((size, cx) => {
        this.size = size;
        cx.notify();
      })
      .track_focus(this.handle)
      .on_key_down((e, cx) => this.key(e, cx))
      .when(!this.compare, (el) => el.child(stage))
      .when(this.compare && list.length === 2, (el) => el.child(h_flex().size_full().pt(48).pb(RESERVE - 12).gap(8).children(list.map((x, k) => this.half(t, x, k)))))
      .child(this.bar(t, s))
      .child(this.closeButton(t));
  }
}
