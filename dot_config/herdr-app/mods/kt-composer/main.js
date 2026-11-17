// The composer under the thread, as a chat-first agent app draws it: a
// rounded box to write to the agent (inside the layout's card, concentric
// like the panes), and a row with the agent, the access mode, attach and a
// round send button. Enter sends the text to the focused pane's agent
// (hc send) and clears the box. kbrdn: the row shows the agent's real model and
// effort, its context fill and its branch (statusline.ts writes
// ~/.claude/cache/statusline/herdr-<terminal>.json), as Monocode's composer does.

import { View, div, svg, image } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { agents, focused, hc, theme, panes, home, readTextFile, checking } from "herdr";

const MONO = "Monaspace Krypton";

export default class Composer extends View {
  init(_p, cx) {
    this.handle = cx.focus_handle();
    this.text = "";
    this.line = null;
    if (!checking()) cx.timer.every(4000, (cx) => this.readLine(cx));
  }

  readLine(cx) {
    const a = this.agent();
    if (!a || a.address.includes("/")) {
      if (this.line) { this.line = null; this.lineKey = ""; cx.notify(); }
      return;
    }
    cx.spawn(async (cx) => {
      let line = null;
      try { const s = await readTextFile(`${home()}/.claude/cache/statusline/herdr-${a.address}.json`); line = s ? JSON.parse(s) : null; } catch { return; }
      const key = JSON.stringify([a.address, line]);
      if (key !== this.lineKey) { this.lineKey = key; this.line = line; cx.notify(); }
    });
  }

  // Same thresholds as statusline.ts contextColor(): context rot, not fill.
  ctxColor(t, pct, window) {
    const [warn, alarm] = window >= 1_000_000 ? [20, 50] : [55, 75];
    return pct >= alarm ? t.ansi1 : pct >= warn ? t.ansi3 : t.muted;
  }

  agent() {
    const f = focused();
    return agents().find((a) => a.address === f?.terminal) ?? agents().find((a) => a.focused) ?? null;
  }

  send(cx) {
    const a = this.agent(), text = this.text.trim();
    if (!a || !text) return;
    this.text = "";
    cx.notify();
    hc(["send", a.address, text]);
  }

  key(e, cx) {
    if (e.key === "enter") return this.send(cx);
    if (e.key === "backspace") this.text = this.text.slice(0, -1);
    else if (e.key_char && !e.modifiers?.control) this.text += e.key_char;
    cx.notify();
  }

  render(cx) {
    const t = theme();
    const a = this.agent();
    const name = a?.program?.name ?? "Agent";
    const typing = this.handle.is_focused();
    const line = a && this.line;
    const branch = panes().find((p) => p.terminal === a?.address)?.branch;
    // kbrdn.dev pill: mono uppercase, rounded, a hairline border.
    const pill = (child) =>
      h_flex().h(26).px(10).gap(6).items_center().rounded_full().border(1).border_color(t.border)
        .font_family(MONO).text_size(10.5).text_color(t.muted).child(child);
    return v_flex()
      .id("composer")
      .size_full()
      .rounded(16)
      .bg(t.background)
      .border(1)
      .border_color(typing ? t.accent : t.border)
      .px(16)
      .pt(12)
      .pb(10)
      .cursor_text()
      .track_focus(this.handle)
      .on_key_down((e, cx) => this.key(e, cx))
      .on_click((_e, cx) => {
        this.handle.focus();
        cx.notify();
      })
      .child(
        div()
          .flex_1()
          .min_h(0)
          .text_size(14)
          .text_color(this.text ? t.foreground : t.dim)
          .child(this.text ? this.text + (typing ? "▏" : "") : `Ask ${name} for changes, send follow-ups, or attach images`),
      )
      .child(
        h_flex()
          .gap(8)
          .items_center()
          .child(
            pill(
              h_flex()
                .gap(6)
                .items_center()
                .when(Boolean(a?.program?.icon), (el) => el.child(image(a.program.icon).w(13).h(13)))
                .child(div().text_color(t.foreground).child((line?.model ?? name).toUpperCase()))
                .when(Boolean(line?.effort), (el) => el.child(div().text_color(t.dim).child(line.effort.toUpperCase()))),
            ),
          )
          .when(line?.ctx_pct != null, (el) => {
            const c = this.ctxColor(t, line.ctx_pct, line.window);
            return el.child(pill(h_flex().gap(6).items_center()
              .child(div().w(28).h(4).rounded(2).bg(t.raised).child(div().h(4).rounded(2).w(Math.max(2, 28 * Math.min(1, line.ctx_pct / 100))).bg(c)))
              .child(div().text_color(c).child(`CTX ${Math.round(line.ctx_pct)}%`))));
          })
          .when(Boolean(branch), (el) => el.child(pill(h_flex().gap(6).items_center()
            .child(svg("mods/kt-threads/git-branch.svg").size(12))
            .child(div().max_w(220).truncate().child(branch)))))
          .child(div().flex_1())
          .child(div().size(28).flex().items_center().justify_center().text_color(t.muted).child(svg("mods/workspace-chrome/plus.svg").size(16)))
          // kbrdn.dev primary button: solid ink, round.
          .child(
            div()
              .id("send")
              .size(32)
              .rounded_full()
              .bg(this.text ? t.solid : t.raised)
              .flex()
              .items_center()
              .justify_center()
              .text_color(this.text ? t.solid_foreground : t.dim)
              .text_size(16)
              .font_bold()
              .cursor_pointer()
              .on_click((_e, cx) => this.send(cx))
              .child("↑"),
          ),
      );
  }
}
