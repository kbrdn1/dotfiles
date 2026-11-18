// kbrdn Threads' confirm (a clone of the shipped `confirm`, kt-new's look): asks before
// something destructive. Opened as a dialog with props { title, detail, command: { name, args } }
// and optional `label` (the confirm button) and `danger` (the button in red). Open it with
// `frame: "none"`: it draws its own card. Enter confirms (runs the command), Esc cancels.
// Full window (mod.json, or width: 1, height: 1): a veil over the window and the 460 px card in its
// middle; a click on the veil cancels, unless `danger` (then only the buttons and Esc). Opened in a
// card-sized box (an explicit `width: 460, height: 200`), the card fills it as before, no veil.

import { View, div } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { run, props, closeOverlay, theme, settings } from "herdr";

const MONO = "Monaspace Krypton";
const CARD = 460;
// A color with alpha `a`, replacing any it has (glass themes are #rrggbbaa).
const alpha = (c, a) => `${String(c).slice(0, 7)}${a}`;
const veil = () => (settings().dark ? alpha("#000000", "8c") : alpha("#0a0a0a", "59"));

export default class Confirm extends View {
  init(_props, cx) {
    this.handle = cx.focus_handle();
    this.handle.focus();
  }

  yes() {
    const p = props();
    closeOverlay(p.overlay);
    // Opened bare (`mod.open`), it has nothing to run: it only closes.
    if (p.command?.name) run(p.command.name, p.command.args ?? {});
  }

  render() {
    const t = theme();
    const p = props() ?? {};
    const tone = p.danger ? t.ansi1 : t.solid;
    // kbrdn.dev pills: an outline Cancel, a solid Confirm.
    const button = (id, label, solid, onClick) =>
      h_flex()
        .id(id)
        .h(30)
        .px(14)
        .items_center()
        .rounded_full()
        .border(1)
        .border_color(solid ? tone : t.input)
        .bg(solid ? tone : t.background)
        .text_color(solid ? (p.danger ? t.background : t.solid_foreground) : t.foreground)
        .font_family(MONO)
        .text_size(11)
        .cursor_pointer()
        .hover((s) => s.opacity(0.88))
        .on_click(onClick)
        .child(label.toUpperCase());
    const kbd = (k) => div().flex_none().h(18).px(6).flex().items_center().rounded_full().border(1).border_color(t.border).font_family(MONO).text_size(10).text_color(t.muted).child(k);
    // Before the first size report (and in `herdr-app check`), the full layout, still transparent.
    const full = !this.size || this.size.width > CARD + 40;
    const shown = Boolean(this.size);
    // The card (radius 20, 4 px around) and its inner card (16), as kt-new.
    const card = v_flex()
      .id("confirm")
      // A press in the card never reaches the veil.
      .on_mouse_down("left", (_e, cx) => cx.stop_propagation())
      // Full: 460 wide, as tall as its text. In a fixed box: the box, the detail scrolling.
      .when(full, (el) => el.w(CARD).relative().top(shown ? 0 : 8).transition("top", { duration: 180, easing: "ease-out" }))
      .when(!full, (el) => el.size_full())
      .min_h(0)
      .p(4)
      .rounded(20)
      .bg(t.popover)
      .border(1)
      .border_color(t.border)
      .shadow_lg()
      .text_size(13)
      .child(
        v_flex()
          .when(!full, (el) => el.flex_1().min_h(0))
          .rounded(16)
          .bg(t.surface)
          .border(1)
          .border_color(t.border)
          .child(
            v_flex()
              .when(!full, (el) => el.flex_1().min_h(0))
              .p(16)
              .gap(10)
              .child(
                h_flex()
                  .gap(10)
                  .items_center()
                  .when(Boolean(p.danger), (el) => el.child(div().size(8).rounded(4).flex_none().bg(t.ansi1)))
                  .child(div().flex_1().min_w(0).text_size(15).font_semibold().text_color(t.foreground).child(p.title ?? "Are you sure?"))
                  .child(kbd("esc")),
              )
              .child(div().id("detail").when(!full, (el) => el.flex_1().min_h(0).overflow_y_scrollbar()).text_color(t.muted).child(p.detail ?? "")),
          )
          // The foot, under a dashed rule.
          .child(div().flex_none().h(0).border_t(1).border_dashed().border_color(t.border))
          .child(
            h_flex()
              .flex_none()
              .px(12)
              .py(10)
              .gap(8)
              .items_center()
              .child(h_flex().gap(5).items_center().text_size(11).text_color(t.dim).child(kbd("↵")).child("confirmer"))
              .child(div().flex_1())
              .child(button("no", "Annuler", false, () => closeOverlay(props().overlay)))
              .child(button("yes", p.label ?? "Confirmer", true, () => this.yes())),
          ),
      );
    return div()
      .id("confirm-veil")
      .size_full()
      .flex()
      .items_center()
      .justify_center()
      .track_focus(this.handle)
      .on_key_down((e, cx) => {
        if (e.key === "enter") this.yes();
        else if (e.key === "escape") closeOverlay(props().overlay);
        else return;
        cx.stop_propagation();
      })
      .on_size_change((size, cx) => {
        this.size = size;
        cx.notify();
      })
      // Fades in once, on the first size report.
      .opacity(shown ? 1 : 0)
      .transition("opacity", { duration: 160, easing: "ease-out" })
      .when(full, (el) => el.bg(veil()).when(!p.danger, (el) => el.on_click(() => closeOverlay(props().overlay))))
      .child(card);
  }
}
