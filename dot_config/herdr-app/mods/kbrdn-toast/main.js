// How notifications look. Anything can post one with notify({ title, body,
// level, icon, action }); replace this mod to restyle them all. Click to
// run its action (e.g. go to the agent) and dismiss it.
// kbrdn: no mascot. For an agent's toast (its action targets a terminal) it says
// which thread, where, and what it's on, from Herdr's panes and the herdr-bridge
// file, instead of a bare "Claude Code needs you". Others keep title and body.
// What the agent waits on (decide.js) puts its buttons in place of the state pill:
// Accepter / Refuser (Livrer / Refuser for a held message) with what it asks in
// the second row, or Ouvrir for a question. A button's click stays on the button.

import { View, div, image, svg } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { props, closeOverlay, run, theme, agents, panes, spaces, home, readTextFile, checking, shared } from "herdr";
import { decide, decisionButtons } from "./decide.js";
// Copied byte for byte from mods/kt-keys/motion.js (data/orchestrator/ANIMATIONS.md).
import { motionState, frame, enter, leave, leaving, MS } from "./motion.js";
import { makeT } from "./i18n.js";
import strings from "./strings.js";

const tr = makeT(strings);
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

// [color, label, pulse, blocked]: blocked says "an agent needs you", whatever the label's language.
function state(t, p, agent) {
  const byStatus = { blocked: [t.blocked, tr("state.blocked"), true, true], done: [t.done, tr("state.done")], working: [t.working, tr("state.working")], idle: [t.done, tr("state.done")] };
  const byLevel = { error: [t.ansi1, tr("state.error")], warning: [t.blocked, tr("state.warning"), true], success: [t.done, tr("state.done")], info: [t.accent, tr("state.info")] };
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
    this.decision = null;
    this.notice = null;
    this.motion = motionState();
    const terminal = props()?.action?.args?.terminal;
    if (terminal && !checking()) cx.spawn(async (cx) => {
      try { this.bridge = JSON.parse(await readTextFile(`${home()}/.claude/cache/herdr/${terminal}.json`)); } catch { this.bridge = null; }
      cx.notify();
    });
    // What it waits on can come after the toast (the plugin writes it as the dialog opens) and goes
    // once answered anywhere: looked at again while the toast is up.
    const look = (cx) => cx.spawn(async (cx) => { this.decision = await decide(terminal).catch(() => null); cx.notify(); });
    if (terminal && !checking()) { look(cx); cx.timer.every(1500, look); }
  }

  render(cx) {
    const t = theme();
    const m = frame(this.motion, Boolean(shared("kt.reducedMotion")));
    const out = leaving(m, "toast");
    const exit = { duration: MS.leave, easing: "ease-in" };
    const p = props() ?? {};
    const login = /^([a-z0-9][a-z0-9_.-]{0,31}) needs login; run hc machine login \1$/.exec(p.body ?? "");
    const command = login ? `hc machine login ${login[1]}` : null;
    const terminal = p.action?.args?.terminal;
    const agent = terminal ? agents().find((a) => a.address === terminal) : null;
    const pane = terminal ? panes().find((x) => x.terminal === terminal) : null;
    const space = pane ? spaces().find((s) => s.tabs.some((x) => x.id === pane.tab)) : null;
    const tab = space?.tabs.find((x) => x.id === pane.tab);
    const [color, label, pulse, blocked = false] = state(t, p, agent);

    // Where: project (Home for the home folder) and branch.
    const where = space ? [space.folder === home() ? "Home" : space.name, pane?.branch].filter(Boolean).join(" · ") : null; // i18n: tech
    // What: the thread's title, else the prompt it was given, else Herdr's title.
    const b = this.bridge;
    const title = login ? tr("login", { name: login[1] }) : threadTitle(tab, pane) ?? (b?.prompt ? cut(plain(b.prompt), 70) : null) ?? p.title ?? "";
    // Detail: what it waits on (the command, the message); blocked, what it asked to do; done, the
    // start of its answer; else Herdr's body. A failed answer says why instead.
    const waits = this.decision?.pending;
    const asked = waits?.detail ? plain(waits.detail) : null;
    const detail = login ? null
      : this.notice ? this.notice
      : asked ? cut(asked, 140)
      : blocked && b?.action?.what ? cut(plain(b.action.what), 140)
      : !blocked && b?.answer ? cut(plain(b.answer), 140)
      : p.body ? cut(p.body, 140) : null;
    const buttons = login ? null : decisionButtons(this.decision, {
      onDone: (r, cx) => {
        if (r?.ok) return leave(this.motion, cx, "toast", () => closeOverlay(p.overlay));
        this.notice = r?.reason ?? tr("nothingSent");
        cx.notify();
      },
    });

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
      .on_click((_e, cx) => { cx.stop_propagation(); leave(this.motion, cx, "toast", () => closeOverlay(p.overlay)); })
      .child(svg(X).size(11));
    // Time left, as a 2 px line that empties once over the toast's timeout.
    const bar = p.timeout && this.width > 0
      ? div().absolute().left(0).bottom(0).h(2).bg(alpha(color, "99"))
          .w(this.leaving ? 0 : this.width).transition("width", { duration: p.timeout, easing: "linear" })
      : null;

    // Herdr's toast is ~72 px high: two rows. Title and state; then where, then the detail. They slide in
    // (6 px up, fading in: enter) inside the toast, which clips; the time line stays put.
    const sub = [where?.toUpperCase(), detail].filter(Boolean);
    const rows = v_flex()
      .size_full()
      .px(12)
      .gap(3)
      .justify_center()
      .child(h_flex().gap(8).items_center()
        .child(tile)
        .child(div().flex_1().min_w(0).truncate().font_medium().text_size(13).text_color(t.foreground).child(title))
        .when(!login && !buttons, (el) => el.child(pill))
        .when(Boolean(buttons), (el) => el.child(buttons))
        .child(close))
      .when(!login && sub.length > 0, (el) => el.child(h_flex().pl(30).pr(26).gap(6).items_center().min_w(0)
        .when(Boolean(where), (r) => r.child(div().flex_none().font_family(MONO).text_size(10).text_color(t.dim).child(where.toUpperCase())))
        .when(Boolean(where && detail), (r) => r.child(div().flex_none().text_size(10).text_color(t.dim).child("·")))
        .when(Boolean(detail), (r) => r.child(div().id("toast-detail").flex_1().min_w(0).truncate().text_size(12)
          .text_color(this.notice ? t.ansi1 : t.muted)
          .when(Boolean(asked && !this.notice), (d) => d.tooltip(waits.detail))
          .child(detail)))))
      .when(Boolean(login), (el) => el.child(h_flex().pl(30).gap(8).items_center()
        .child(div().flex_1().min_w(0).truncate().tooltip(command).font_family(MONO).text_size(11).text_color(t.muted).child(command))
        .child(div().id("toast-login-copy").flex_none().px(8).h(20).flex().items_center().rounded_full().border(1).border_color(t.input)
          .font_family(MONO).text_size(10).text_color(t.foreground).cursor_pointer().hover((s) => s.bg(t.hover))
          .on_click((_e, cx) => { cx.stop_propagation(); cx.write_to_clipboard(command); this.copied = true; cx.notify(); })
          .child(this.copied ? tr("copied") : tr("copy")))));
    return v_flex()
      .id("toast")
      .relative()
      .size_full()
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
      .on_click((_e, cx) => {
        if (leaving(this.motion, "toast")) return; // leaving: a second click would run the action twice
        if (p.action?.name) run(p.action.name, p.action.args ?? {});
        leave(this.motion, cx, "toast", () => closeOverlay(p.overlay));
      })
      // Going (motion.js leave): what came in fades and sinks 6 px, 140 ms ease-in, then the toast closes.
      // Not on Herdr's own timeout close: Herdr shuts the toast itself, at once.
      .child(div().id("toast-out").size_full().relative().top(out ? 6 : 0).opacity(out ? 0 : 1)
        .transition("top", exit).transition("opacity", exit)
        .child(enter(m, rows, "toast-in")))
      .when(Boolean(bar), (el) => el.child(bar));
  }
}
