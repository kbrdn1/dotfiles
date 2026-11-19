// kbrdn Threads' prompt: a name typed in, then a command run with it. It stands for Herdr's shipped
// `prompt` (herdr-app 0.1.16), which Herdr opens by itself when a command comes without its `name`
// (tab.rename, space.rename), in English and in the base look: our keys and menus never send such a command
// bare, they open this instead (rename.check.mjs proves it).
// Props, the shipped contract: { title, hint, value, command: { name, args } } (and `label`, the field's
// name), run as command.name { ...args, name: <typed> }. Or `rename: { tab: <tab id> } | { space: <space
// id> }`: the words, the current name and the command (tab.rename / space.rename with that id) filled here,
// so the callers (kt-head, kt-menu) carry no words of their own.
// Opened as a dialog with frame "none" (mod.json): a veil over the window and kt-confirm's card (a dithered
// head, the field in form.js' ring, a dashed rule, the foot), coming in and going out with motion.js' sheet.
// It opens typing, the name selected: Enter saves, Esc or a click on the veil cancels. The keys' glyphs come
// from shortcuts.js (kbd), the words from strings.js (I18N.md).

import { View, div, svg } from "gpui-kit";
import { v_flex, h_flex, InputState, Input } from "gpui-base";
import { run, props, closeOverlay, theme, settings, shared, spaces } from "herdr";
import { motionState, frame, sheet, leave, sharpen } from "./motion.js";
import { ditherBand, TOP } from "./dither.js";
import { kbd } from "./shortcuts.js";
import { makeT } from "./i18n.js";
import strings from "./strings.js";

const tr = makeT(strings);
const MONO = "Monaspace Krypton";
const CARD = 420;
const I = (name) => `mods/kt-threads/${name}.svg`;
// A color with alpha `a`, replacing any it has (glass themes are #rrggbbaa).
const alpha = (c, a) => `${String(c).slice(0, 7)}${a}`;
const veil = () => (settings().dark ? alpha("#000000", "8c") : alpha("#0a0a0a", "59"));

// What the dialog asks and runs, from its props: the shipped contract as given, or `rename` filled from the
// live tab or space. null: the tab or space is gone.
export function askOf(p, all) {
  const r = p?.rename;
  if (!r) return { title: p?.title ?? tr("title"), label: p?.label ?? tr("name"), hint: p?.hint ?? null, value: p?.value ?? "", command: p?.command ?? null };
  if (r.space) {
    const s = all.find((x) => x.id === r.space);
    return s ? { title: tr("space.title"), label: tr("name"), hint: tr("space.hint"), value: s.named ? s.name : "", command: { name: "space.rename", args: { id: s.id } } } : null;
  }
  const c = all.flatMap((s) => s.tabs ?? []).find((x) => x.id === r.tab);
  return c ? { title: tr("tab.title"), label: tr("name"), hint: tr("tab.hint"), value: c.named ? c.name : "", command: { name: "tab.rename", args: { id: c.id } } } : null;
}

export default class Prompt extends View {
  init(_props, cx) {
    this.ask = askOf(props(), spaces());
    this.motion = motionState(); // ANIMATIONS.md: the veil fades in, the card rises 6 px; out on dismiss
    this.handle = cx.focus_handle();
    const value = this.ask?.value ?? "";
    this.input = InputState.new({ value });
    if (value) this.input.set_selected_range({ start: 0, end: value.length });
    this.input.on("submit", (_e, cx) => this.save(cx));
    this.focused = true;
    this.input.on("focus", (_e, cx) => { this.focused = true; cx.notify(); });
    this.input.on("blur", (_e, cx) => { this.focused = false; cx.notify(); });
    this.input.focus();
    // As the shipped prompt: the dialog's window takes the keyboard a moment after it opens.
    cx.timer.after(600, () => this.input.focus());
  }

  // motion.js leave(): the veil fades out and the card sinks, then the dialog closes.
  dismiss(cx) {
    leave(this.motion, cx, "kpr", () => closeOverlay(props().overlay));
  }

  // The command with the typed name, once (a second Enter while it leaves does nothing), then it leaves.
  save(cx) {
    if (this.done) return;
    this.done = true;
    const c = this.ask?.command;
    if (c?.name) run(c.name, { ...(c.args ?? {}), name: this.input.value() });
    this.dismiss(cx);
  }

  render() {
    const t = theme();
    const a = this.ask;
    const still = Boolean(shared("kt.reducedMotion"));
    const shown = still || Boolean(this.size);
    const s = sheet(frame(this.motion, still), "kpr", shown);
    // kbrdn.dev pills: an outline Cancel, a solid Save (kt-confirm's).
    const button = (id, label, solid, onClick) => h_flex().id(id).h(30).px(14).items_center().rounded_full().border(1)
      .border_color(solid ? t.solid : t.input).bg(solid ? t.solid : t.background)
      .text_color(solid ? t.solid_foreground : t.foreground).font_family(MONO).text_size(11)
      .cursor_pointer().hover((x) => x.opacity(0.88)).on_click(onClick).child(label.toUpperCase());
    // The head, kt-confirm's: a 60 px band over the dither in the accent, the mark, the title, a mono line.
    const dark = settings().dark;
    const head = div().id("prompt-head").relative().flex_none().h(60).overflow_hidden().rounded_t(15)
      .on_size_change((size, cx) => {
        if (Math.abs((this.headW ?? 0) - size.width) < 0.5) return;
        this.headW = size.width;
        cx.notify();
      })
      .when(this.headW > 30, (el) => el.child(ditherBand(this.headW, 60, 15, alpha(t.accent, dark ? "6b" : "4d"), TOP)))
      .child(h_flex().size_full().px(14).gap(12).items_center()
        .child(h_flex().size(32).flex_none().rounded(10).items_center().justify_center().border(1).border_color(alpha(t.accent, "4d")).bg(alpha(t.surface, "e6"))
          .child(svg(I("square-pen")).size(16).text_color(t.accent)))
        .child(v_flex().flex_1().min_w(0).gap(2)
          // motion.js sharpen: the title comes into focus as the dialog opens, once.
          .child(sharpen(this.motion, `kpr-title:${a?.title ?? ""}`, () => div().truncate().text_size(14).font_semibold().text_color(t.foreground).child(a?.title ?? tr("title"))))
          .child(div().truncate().font_family(MONO).text_size(10.5).text_color(t.muted).child(tr("sub"))))
        .child(kbd(t, "escape"))); // i18n: tech
    // The field, form.js' ring and box: the accent ring while it has the keyboard.
    const field = div().flex_1().min_w(0).p(3).rounded(15).bg(this.focused ? alpha(t.accent, "33") : alpha(t.accent, "00"))
      .child(Input.new(this.input).w_full().h(36).px(12).rounded(12).border(1).border_color(this.focused ? t.accent : t.input)
        .bg(t.background).text_size(13).text_color(t.foreground));
    const body = a
      ? v_flex().p(16).gap(7)
        .child(div().text_size(11.5).text_color(t.dim).child(a.label))
        .child(field)
        .when(Boolean(a.hint), (el) => el.child(div().pt(1).text_size(11.5).line_height("16px").text_color(t.dim).child(a.hint)))
      : v_flex().p(16).child(div().text_size(13).line_height("20px").text_color(t.muted).child(tr("gone")));
    const hint = (k, what) => h_flex().gap(5).items_center().child(kbd(t, k)).child(div().child(what));
    const card = v_flex().id("prompt")
      // A press in the card never reaches the veil.
      .on_mouse_down("left", (_e, cx) => cx.stop_propagation())
      .w(CARD).min_h(0).p(4).rounded(20).bg(t.popover).border(1).border_color(t.border).shadow_lg().text_size(13)
      .child(v_flex().min_h(0).rounded(16).bg(t.surface).border(1).border_color(t.border)
        .child(head)
        .child(div().flex_none().h(0).border_t(1).border_dashed().border_color(alpha(t.accent, "4d")))
        .child(body)
        .child(div().flex_none().h(0).border_t(1).border_dashed().border_color(t.border))
        .child(h_flex().flex_none().px(12).py(10).gap(10).items_center().text_size(11).text_color(t.dim)
          .when(Boolean(a), (el) => el.child(hint("enter", tr("foot.save"))))
          .child(hint("escape", tr("foot.cancel")))
          .child(div().flex_1())
          .child(button("prompt-cancel", tr("cancel"), false, (_e, cx) => this.dismiss(cx)))
          .when(Boolean(a), (el) => el.child(button("prompt-save", tr("save"), true, (_e, cx) => this.save(cx))))));
    return s.veil(div().id("prompt-veil").size_full().flex().items_center().justify_center())
      .track_focus(this.handle)
      .on_key_down((e, cx) => {
        if (e.key === "escape") this.dismiss(cx);
        else if (e.key === "enter" && !a) this.dismiss(cx);
        else return;
        cx.stop_propagation();
      })
      .on_size_change((size, cx) => {
        this.size = size;
        cx.notify();
      })
      // A press, not on_click: on the element holding the keyboard, GPUI turns Space and Enter into a click.
      .bg(veil())
      .on_mouse_down("left", (_e, cx) => this.dismiss(cx))
      .child(s.card(card));
  }
}
