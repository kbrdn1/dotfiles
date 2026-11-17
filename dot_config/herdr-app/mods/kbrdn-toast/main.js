// How notifications look. Anything can post one with notify({ title, body,
// level, icon, action }); replace this mod to restyle them all. Click to
// run its action (e.g. go to the agent) and dismiss it.

import { View, div, image } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { props, closeOverlay, run, theme, agents } from "herdr";

// kbrdn.dev mascot: the agent's live status first (the toast's action targets it), else the level.
const BY_STATUS = { blocked: "nervous", done: "clap", working: "thinking", idle: "content" };
const BY_LEVEL = { error: "shocked", warning: "nervous", success: "clap", info: "thinking" };
function mood(p) {
  const terminal = p.action?.args?.terminal;
  const agent = terminal ? agents().find((a) => a.address === terminal) : null;
  return BY_STATUS[agent?.status] ?? BY_LEVEL[p.level] ?? "neutral";
}

export default class Toast extends View {
  render(cx) {
    const t = theme();
    const p = props() ?? {};
    const login = /^([a-z0-9][a-z0-9_.-]{0,31}) needs login; run hc machine login \1$/.exec(p.body ?? "");
    const command = login ? `hc machine login ${login[1]}` : null;
    return h_flex()
      .id("toast")
      .size_full()
      .px(18)
      .gap(12)
      .items_center()
      .bg(t.popover)
      .cursor_pointer()
      .hover((s) => s.bg(t.hover))
      .on_click(() => {
        if (p.action?.name) run(p.action.name, p.action.args ?? {});
        closeOverlay(p.overlay);
      })
      .child(image(`brand/mascot/${mood(p)}.png`).size(40).flex_none())
      .when(Boolean(p.icon), (el) => el.child(image(p.icon).size(16).flex_none()))
      .child(
        v_flex()
          .flex_1()
          .overflow_hidden()
          .child(div().truncate().font_semibold().text_size(13).text_color(t.foreground).child(login ? `${login[1]} needs a login: run` : p.title ?? ""))
          .when(!login && Boolean(p.body), (el) => el.child(div().truncate().text_size(12).text_color(t.muted).child(p.body ?? "")))
          .when(Boolean(login), (el) => el.child(h_flex().gap(8).items_center()
            .child(div().flex_1().min_w(0).truncate().tooltip(command).text_size(12).text_color(t.muted).child(command))
            .child(div().id("toast-login-copy").flex_none().px(6).py(3).rounded(4).bg(t.raised)
              .text_size(12).text_color(t.foreground).cursor_pointer().hover(s => s.bg(t.hover))
              .on_click((_e, cx) => { cx.stop_propagation(); cx.write_to_clipboard(command); this.copied = true; cx.notify(); })
              .child(this.copied ? "Copied" : "Copy")))),
      );
  }
}
