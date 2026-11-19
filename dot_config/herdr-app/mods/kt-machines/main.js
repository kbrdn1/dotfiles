// kt-machines, « Machines »: the other machines Herdr reaches, as a dialog opened from kt-threads'
// navigation (#64, Kylian's decision of 2026-11-19). For each one (machines.js: shared "kt.machines",
// published by kt-threads, and machines()): its state's dot and name, ROOT when it logs in as root,
// its account and core; a login to do again (the command, Copy); its programs stopping at logout (the
// warning, « Voir » opens kt-machine-add, which has the administrator's command); « + projet » opens a
// project there (space.new {machine}: a shell in its home, never an agent, so never asked first). The
// foot: Add a machine (kt-machine-add) and Settings › Machines (rename, update, remove, reconnect a
// rebuilt one). Nothing here runs anything on a machine.
// Keys (vim.js; kt-keys lists them, Modales): j / k (↓ ↑), gg / G move; enter or o: copy the login,
// else open a project there; y copies the login; q or esc closes; ? the keys.
// `kt-machines.key:<keys>` feeds keys, space separated ("j enter"), for tests.

import { View, div, svg } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { run, theme, shared, settings, props, closeOverlay, openOverlay, nextCommand, checking, notify } from "herdr";
import { Vim, keysOf, step } from "./vim.js";
import { motionState, frame, sheet, leave, sharpen } from "./motion.js";
import { ditherBand, TOP } from "./dither.js";
import { machineList, stateColor, stateWord } from "./machines.js";
import { cardOf } from "./card.js";
import { makeT } from "./i18n.js";
import strings from "./strings.js";

const tr = makeT(strings);
const MONO = "Monaspace Krypton";
const CARD = 520;
const SERVER = "mods/kt-machines/server.svg";
// A color with alpha `a`, replacing any it has (glass themes are #rrggbbaa).
const alpha = (c, a) => `${String(c).slice(0, 7)}${a}`;
const veil = () => (settings().dark ? alpha("#000000", "8c") : alpha("#0a0a0a", "59"));

export default class Machines extends View {
  init(_props, cx) {
    this.handle = cx.focus_handle();
    this.handle.focus();
    this.vim = new Vim();
    this.cur = 0;
    this.cards = [];
    this.motion = motionState(); // ANIMATIONS.md: the veil fades and the card rises, in and out (motion.js sheet, leave)
    if (!checking()) cx.spawn(async (cx) => {
      for (;;) {
        const c = await nextCommand();
        if (c.startsWith("key:")) for (const k of keysOf(c.slice(4))) this.act(this.vim.handle(k), cx);
        cx.notify();
      }
    });
  }

  // motion.js leave(): the veil fades out and the card sinks, then the dialog closes.
  dismiss(cx) {
    leave(this.motion, cx, "km", () => closeOverlay(props().overlay));
  }

  copy(text, cx) {
    cx.write_to_clipboard(text);
    notify({ title: tr("copied"), body: text, level: "success", timeout: 2000 });
  }

  // A project on that machine: a shell in its home (space.new {machine}), the thread shown; the dialog goes.
  project(name, cx) {
    run("space.new", { machine: name });
    run("layout.select", { stack: "view", child: "thread" });
    this.dismiss(cx);
  }

  // kt-machine-add (machine-add's clone, in our look), over this dialog's place: its linger card has the
  // administrator's command. This dialog closes at once, as kt-menu's do: two veils never stack.
  add() {
    closeOverlay(props().overlay);
    run("mod.open", { name: "kt-machine-add" });
  }

  // enter / o on a card (card.js primary): copy its login, else open a project there.
  primary(c, cx) {
    if (c?.primary === "login") this.copy(c.login, cx);
    else if (c?.primary === "project") this.project(c.name, cx);
  }

  // One vim action; false: not one of ours, and the key goes on.
  act(a, cx) {
    if (!a) return false;
    if (a === "pending" || a === "count") return true;
    const cards = this.cards;
    if (["down", "up", "top", "bottom", "half-down", "half-up"].includes(a)) this.cur = Math.max(0, step(a, this.cur, cards.length, this.vim.count, 4));
    else if (a === "open" || a === "right") this.primary(cards[this.cur], cx);
    else if (a === "yank") { if (cards[this.cur]?.login) this.copy(cards[this.cur].login, cx); }
    else if (a === "quit" || a === "escape") this.dismiss(cx);
    else if (a === "help") openOverlay({ mod: "kt-keys", kind: "dialog", width: 1, height: 1, frame: "none", props: { group: "modals" } });
    else return false;
    return true;
  }

  // A small hairline pill (kt-new's), an action on a card or in the foot.
  pill(t, id, label, onClick, tip) {
    return h_flex().id(id).flex_none().h(24).px(9).items_center().rounded_full().border(1).border_color(t.border)
      .font_family(MONO).text_size(10.5).text_color(t.muted).cursor_pointer().hover((s) => s.bg(t.hover).text_color(t.foreground))
      .when(Boolean(tip), (el) => el.tooltip(tip))
      .on_mouse_down("left", (_e, cx) => cx.stop_propagation())
      .on_click(onClick)
      .child(label.toUpperCase());
  }

  // One machine (card.js): its line (dot, name, ROOT, state, + projet), its account and core, then
  // what it needs: its reason when away, its login with Copy, the linger warning.
  card(t, c, i, on) {
    const meta = [c.account ? tr("account", { account: c.account }) : null, c.version ? tr("core", { version: c.version }) : null].filter(Boolean).join(" · ");
    return v_flex().id(`km-m-${i}`).flex_none().px(12).py(10).gap(6).rounded(12).border(1)
      .border_color(on ? alpha(t.accent, "99") : t.border).bg(on ? alpha(t.accent, "24") : t.background)
      .child(h_flex().h(24).gap(8).items_center()
        .child(div().size(8).flex_none().rounded_full().bg(stateColor(t, c.status)))
        .child(div().flex_none().max_w(200).truncate().text_size(13.5).font_medium().text_color(t.foreground).child(c.name))
        .when(c.root === true, (el) => el.child(div().id(`km-root-${i}`).flex_none().px(5).rounded(4).bg(alpha(t.blocked, "24"))
          .font_family(MONO).text_size(9.5).text_color(t.blocked).tooltip(tr("root.tip")).child("ROOT"))) // i18n: tech
        .child(div().flex_1().min_w(0).truncate().font_family(MONO).text_size(11).text_color(c.status === "ready" ? t.dim : t.muted)
          .child(c.status === "ready" ? tr("state.ready") : stateWord(c.name)))
        .when(c.primary === "project", (el) => el.child(this.pill(t, `km-project-${i}`, tr("project"), (_e, cx) => this.project(c.name, cx), tr("project.tip", { name: c.name })))))
      .when(Boolean(meta), (el) => el.child(div().pl(16).font_family(MONO).text_size(11).text_color(t.dim).child(meta)))
      .when(Boolean(c.why), (el) => el.child(div().pl(16).font_family(MONO).text_size(11).text_color(t.dim).child(c.why)))
      .when(Boolean(c.login), (el) => el.child(v_flex().pl(16).gap(4)
        .child(div().text_size(12).text_color(t.muted).child(tr("login.text")))
        .child(h_flex().gap(6).items_center()
          .child(div().flex_1().min_w(0).truncate().font_family(MONO).text_size(11.5).text_color(t.foreground).child(c.login))
          .child(this.pill(t, `km-copy-${i}`, tr("copy"), (_e, cx) => this.copy(c.login, cx))))))
      .when(c.linger, (el) => el.child(h_flex().pl(16).gap(6).items_center()
        .child(div().flex_1().min_w(0).text_size(12).text_color(t.blocked).child(tr("linger.text")))
        .child(this.pill(t, `km-linger-${i}`, tr("linger.button"), (_e, cx) => this.add(cx), tr("linger.tip")))));
  }

  render(cx) {
    const t = theme();
    const cards = (this.cards = machineList().map(cardOf));
    this.cur = Math.min(this.cur, Math.max(0, cards.length - 1));
    const keyed = this.handle.is_focused();
    const still = Boolean(shared("kt.reducedMotion"));
    const m = frame(this.motion, still);
    // The modals' motion (ANIMATIONS.md, kt-confirm's): the veil fades in and the card rises, once, on
    // the first size report, and goes back out on dismiss; reduced motion: there at once.
    const s = sheet(m, "km", still || Boolean(this.size));
    const kbd = (k) => div().flex_none().h(18).px(6).flex().items_center().rounded_full().border(1).border_color(t.border).font_family(MONO).text_size(10).text_color(t.muted).child(k);
    const dark = settings().dark;
    // The head (kt-confirm's): a 60 px band over the pixel dither, in the accent; the mark, the title, a
    // mono subtitle (how many machines), esc.
    const head = div().id("km-head").relative().flex_none().h(60).overflow_hidden().rounded_t(15)
      .on_size_change((size, cx) => {
        if (Math.abs((this.headW ?? 0) - size.width) < 0.5) return;
        this.headW = size.width;
        cx.notify();
      })
      .when(this.headW > 30, (el) => el.child(ditherBand(this.headW, 60, 15, alpha(t.accent, dark ? "6b" : "4d"), TOP)))
      .child(h_flex().size_full().px(14).gap(12).items_center()
        .child(h_flex().size(32).flex_none().rounded(10).items_center().justify_center().border(1).border_color(alpha(t.accent, "4d")).bg(alpha(t.surface, "e6"))
          .child(svg(SERVER).size(16).text_color(t.accent)))
        .child(v_flex().flex_1().min_w(0).gap(2)
          .child(sharpen(this.motion, "km-title", () => div().truncate().text_size(14).font_semibold().text_color(t.foreground).child(tr("title"))))
          .child(div().truncate().font_family(MONO).text_size(10.5).text_color(t.muted).child(cards.length ? tr("sub.count", { n: cards.length }) : tr("sub.none"))))
        .child(kbd("esc")));
    const empty = v_flex().id("km-empty").flex_none().px(4).py(6).gap(4)
      .child(div().text_size(13).font_medium().text_color(t.foreground).child(tr("empty.title")))
      .child(div().max_w(440).text_size(13).line_height("20px").text_color(t.muted).child(tr("empty.text")));
    const card = v_flex().id("km-card")
      // A press in the card never reaches the veil.
      .on_mouse_down("left", (_e, cx) => cx.stop_propagation())
      .w(CARD).max_w_full().p(4).rounded(20).bg(t.popover).border(1).border_color(t.border).shadow_lg().text_size(13)
      .child(v_flex().rounded(16).bg(t.surface).border(1).border_color(t.border)
        .child(head)
        .child(div().flex_none().h(0).border_t(1).border_dashed().border_color(alpha(t.accent, "4d")))
        .child(v_flex().id("km-list").p(12).gap(8).max_h(Math.max(200, (this.size?.height ?? 900) - 220)).overflow_y_scroll()
          .children(cards.length ? cards.map((c, i) => this.card(t, c, i, keyed && i === this.cur)) : [empty]))
        .child(div().flex_none().h(0).border_t(1).border_dashed().border_color(t.border))
        .child(h_flex().flex_none().px(12).py(10).gap(8).items_center()
          .child(div().flex_1().min_w(0).truncate().font_family(MONO).text_size(10.5).text_color(t.dim).child(tr("foot.keys")))
          .child(this.pill(t, "km-settings", tr("settings"), (_e, cx) => { this.dismiss(cx); run("app.settings", { section: "machines" }); }, tr("settings.tip")))
          .child(this.pill(t, "km-add", tr("add"), (_e, cx) => this.add(cx)))));
    return s.veil(div().id("km-veil").size_full().flex().items_center().justify_center().bg(veil()))
      .track_focus(this.handle)
      .on_key_down((e, cx) => {
        if (!this.act(this.vim.handle(e), cx)) return;
        cx.stop_propagation();
        cx.notify();
      })
      .on_size_change((size, cx) => {
        this.size = size;
        cx.notify();
      })
      // A press, not on_click: on the element holding the keyboard, GPUI turns Space and Enter into a click.
      .on_mouse_down("left", (_e, cx) => this.dismiss(cx))
      .child(s.card(card));
  }
}
