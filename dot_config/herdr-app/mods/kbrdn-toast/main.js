// How notifications look. Anything can post one with notify({ title, body,
// level, icon, action }); replace this mod to restyle them all. Click to
// run its action (e.g. go to the agent) and dismiss it.
// kbrdn: no mascot. For an agent's toast (its action targets a terminal) it says
// which thread, where, and what it's on, from Herdr's panes and the herdr-bridge
// file, instead of a bare "Claude Code needs you". Others keep title and body.

import { View, div, image, svg } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { props, closeOverlay, run, theme, agents, panes, spaces, home, readTextFile, checking } from "herdr";

const MONO = "Monaspace Krypton";
const X = "mods/kt-threads/x.svg";

// A color with its alpha replaced, so "#rrggbbaa" theme colors (glass mode) stay valid.
const alpha = (c, a) => (c ?? "#000000").slice(0, 7) + a;
// One line of plain text out of a markdown reply.
const plain = (s) => (s ?? "").replace(/```[\s\S]*?```/g, " ").replace(/[*_`#>]+/g, "").replace(/\s+/g, " ").trim();
const cut = (s, n) => (s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s);
// kt-threads' label(): a name the person gave, else the agent's live title, else null.
const clean = (s) => (s ?? "").replace(/^[^\p{L}\p{N}\p{Ps}\p{Pi}]+/u, "").replace(/^\[ [!.] \] /, "").trim();
function threadTitle(tab, pane) {
  if (tab?.named) return tab.name;
  const live = clean(pane?.title);
  const prog = pane?.program?.name;
  const path = /^[~/]/.test(live);
  return live && live !== pane?.terminal && live !== prog && !path && !live.includes("@") ? live : null;
}

function state(t, p, agent) {
  const byStatus = { blocked: [t.blocked, "NEEDS YOU", true], done: [t.done, "DONE"], working: [t.working, "WORKING"], idle: [t.done, "DONE"] };
  const byLevel = { error: [t.ansi1, "ERREUR"], warning: [t.blocked, "ATTENTION", true], success: [t.done, "DONE"], info: [t.accent, "INFO"] };
  // Herdr posts "an agent needs you" as level error (its own toast draws error in t.blocked).
  if (p.action?.args?.terminal && p.level === "error") return byStatus.blocked;
  // The toast's own level says what happened; the agent's live status only when it gives none.
  return byLevel[p.level] ?? byStatus[agent?.status] ?? byLevel.info;
}

export default class Toast extends View {
  init(_props, cx) {
    this.bridge = null;
    this.width = 0;
    this.leaving = false;
    const terminal = props()?.action?.args?.terminal;
    if (terminal && !checking()) cx.spawn(async (cx) => {
      try { this.bridge = JSON.parse(await readTextFile(`${home()}/.claude/cache/herdr/${terminal}.json`)); } catch { this.bridge = null; }
      cx.notify();
    });
  }

  render(cx) {
    const t = theme();
    const p = props() ?? {};
    const login = /^([a-z0-9][a-z0-9_.-]{0,31}) needs login; run hc machine login \1$/.exec(p.body ?? "");
    const command = login ? `hc machine login ${login[1]}` : null;
    const terminal = p.action?.args?.terminal;
    const agent = terminal ? agents().find((a) => a.address === terminal) : null;
    const pane = terminal ? panes().find((x) => x.terminal === terminal) : null;
    const space = pane ? spaces().find((s) => s.tabs.some((x) => x.id === pane.tab)) : null;
    const tab = space?.tabs.find((x) => x.id === pane.tab);
    const [color, label, pulse] = state(t, p, agent);
    const blocked = label === "NEEDS YOU";

    // Where: project (Home for the home folder) and branch.
    const where = space ? [space.folder === home() ? "Home" : space.name, pane?.branch].filter(Boolean).join(" · ") : null;
    // What: the thread's title, else the prompt it was given, else Herdr's title.
    const b = this.bridge;
    const title = login ? `${login[1]} needs a login: run` : threadTitle(tab, pane) ?? (b?.prompt ? cut(plain(b.prompt), 70) : null) ?? p.title ?? "";
    // Detail: blocked, what it asked to do; done, the start of its answer; else Herdr's body.
    const detail = login ? null
      : blocked && b?.action?.what ? cut(plain(b.action.what), 140)
      : !blocked && b?.answer ? cut(plain(b.answer), 140)
      : p.body ? cut(p.body, 140) : null;

    const program = agent?.program ?? pane?.program;
    const tile = div().w(22).h(20).flex_none().rounded(6).border(1).border_color("#00000033").bg(program?.tile ?? t.raised)
      .flex().items_center().justify_center()
      .child(program?.icon
        ? (program.tint ? svg(program.icon).size(13).text_color(program.color ?? "#ffffff") : image(program.icon).size(13))
        : p.icon ? image(p.icon).size(13) : div().size(7).rounded_full().bg(color));
    // kbrdn.dev `.tag`: mono uppercase pill, border 30% / fill 10%.
    const pill = h_flex().flex_none().h(18).px(7).gap(5).items_center().rounded_full()
      .border(1).border_color(alpha(color, "4d")).bg(alpha(color, "1a")).font_family(MONO).text_size(9.5).text_color(color)
      .when(Boolean(pulse), (el) => el.child(div().size(5).rounded_full().bg(color).loop("opacity", { from: 0.3, to: 1, period: 1200 })))
      .child(label);
    const close = div().id("toast-close").flex_none().size(18).rounded_full().flex().items_center().justify_center()
      .text_color(t.dim).cursor_pointer().hover((s) => s.bg(t.hover).text_color(t.foreground))
      .on_click((_e, cx) => { cx.stop_propagation(); closeOverlay(p.overlay); })
      .child(svg(X).size(11));
    // Time left, as a 2 px line that empties once over the toast's timeout.
    const bar = p.timeout && this.width > 0
      ? div().absolute().left(0).bottom(0).h(2).bg(alpha(color, "99"))
          .w(this.leaving ? 0 : this.width).transition("width", { duration: p.timeout, easing: "linear" })
      : null;

    // Herdr's toast is ~72 px high: two rows. Title and state; then where, then the detail.
    const sub = [where?.toUpperCase(), detail].filter(Boolean);
    return v_flex()
      .id("toast")
      .relative()
      .size_full()
      .px(12)
      .gap(3)
      .justify_center()
      .overflow_hidden()
      .bg(t.popover)
      .cursor_pointer()
      .hover((s) => s.bg(t.hover))
      .on_size_change((size, cx) => {
        if (size.width === this.width) return;
        this.width = size.width;
        cx.notify();
        if (p.timeout) cx.timer.after(30, (cx) => { this.leaving = true; cx.notify(); });
      })
      .on_click(() => {
        if (p.action?.name) run(p.action.name, p.action.args ?? {});
        closeOverlay(p.overlay);
      })
      .child(h_flex().gap(8).items_center()
        .child(tile)
        .child(div().flex_1().min_w(0).truncate().font_medium().text_size(13).text_color(t.foreground).child(title))
        .when(!login, (el) => el.child(pill))
        .child(close))
      .when(!login && sub.length > 0, (el) => el.child(h_flex().pl(30).pr(26).gap(6).items_center().min_w(0)
        .when(Boolean(where), (r) => r.child(div().flex_none().font_family(MONO).text_size(10).text_color(t.dim).child(where.toUpperCase())))
        .when(Boolean(where && detail), (r) => r.child(div().flex_none().text_size(10).text_color(t.dim).child("·")))
        .when(Boolean(detail), (r) => r.child(div().flex_1().min_w(0).truncate().text_size(12).text_color(t.muted).child(detail)))))
      .when(Boolean(login), (el) => el.child(h_flex().pl(30).gap(8).items_center()
        .child(div().flex_1().min_w(0).truncate().tooltip(command).font_family(MONO).text_size(11).text_color(t.muted).child(command))
        .child(div().id("toast-login-copy").flex_none().px(8).h(20).flex().items_center().rounded_full().border(1).border_color(t.input)
          .font_family(MONO).text_size(10).text_color(t.foreground).cursor_pointer().hover((s) => s.bg(t.hover))
          .on_click((_e, cx) => { cx.stop_propagation(); cx.write_to_clipboard(command); this.copied = true; cx.notify(); })
          .child(this.copied ? "COPIÉ" : "COPIER"))))
      .when(Boolean(bar), (el) => el.child(bar));
  }
}
