// A pane's header, for layouts that frame their panes:
//   { "tab": "active", "pane": { "header": { "content": { "mod": "kbrdn-pane" } } } }
// Shows the program's icon (the app's program table), the agent's name or
// the terminal's title, the folder, and the agent's status; buttons split, zoom and close
// this pane. Props from the app: { pane, terminal }. Click: focus the pane.

import { View, div, svg, image } from "gpui-kit";
import { h_flex } from "gpui-base";
import { panes, props, run, theme, home, layout, shared } from "herdr";
import { motionState, frame, enter } from "./motion.js";

// Match the first visible tab frame, including the active child of a stack.
function paneFrame(node) {
  if (!node || node.hidden) return null;
  if (node.content?.tab && node.content.pane) return node.content.pane;
  let children = node.children ?? [];
  if (node.type === "stack") {
    const visible = children.filter(child => !child.hidden);
    children = [visible.find(child => child.id === node.active) ?? visible[0]];
  }
  for (const child of children) {
    const frame = paneFrame(child);
    if (frame) return frame;
  }
  return null;
}

function icon(p, size, color) {
  if (!p?.icon) return null;
  return p.tint ? svg(p.icon).size(size).flex_none().text_color(color) : image(p.icon).w(size).h(size).flex_none();
}

function folder(cwd) {
  if (!cwd) return "";
  const h = home();
  return cwd === h ? "~" : cwd.startsWith(h + "/") ? "~" + cwd.slice(h.length) : cwd;
}

export default class Pane extends View {
  init() {
    this.hovered = false;
    this.motion = motionState(); // ANIMATIONS.md: the state tag and the hover buttons fade in
  }

  me() {
    return panes().find((p) => p.pane === props()?.pane);
  }

  button(t, id, icon, command, args) {
    return div()
      .id(id)
      .p(3)
      .rounded(4)
      .text_color(t.dim)
      .hover((s) => s.bg(t.hover).text_color(t.foreground))
      .on_click((_e, cx) => {
        cx.stop_propagation();
        run(command, args);
      })
      .child(svg(`mods/kbrdn-pane/${icon}.svg`).size(14));
  }

  // kbrdn.dev `.tag`: mono uppercase pill, border 30% / fill 10% of its own color.
  tag(color, text, lead) {
    return enter(this.motion, h_flex().flex_none().h(20).px(8).gap(5).items_center().rounded_full(), `pane-tag-${this.me()?.pane}-${text}`, { dy: 0 })
      .border(1).border_color(color + "4d").bg(color + "1a").text_color(color)
      .font_family("Monaspace Krypton").text_size(10.5)
      .when(Boolean(lead), (el) => el.child(lead)).child(text);
  }

  render(cx) {
    const t = theme();
    const p = this.me();
    if (!p) return div();
    const name = ((p.program?.agent || p.program?.shell) && p.program.name) || p.title || p.program?.name || "shell";
    const pic = icon(p.program, 14, t.dim);
    const st = p.status;
    const pane = p.pane;
    const bottom = paneFrame(layout())?.header?.position === "bottom";
    const m = frame(this.motion, Boolean(shared("kt.reducedMotion")));
    return h_flex()
      .id(`pane-head-${pane}`)
      .size_full()
      .px(10)
      .gap(8)
      .items_center()
      .bg(t.background)
      .when(bottom, el => el.border_t(1))
      .when(!bottom, el => el.border_b(1))
      .border_color(t.border)
      .text_size(12)
      .on_hover((hovered, cx) => { this.hovered = hovered; cx.notify(); })
      .on_click(() => run("pane.focus", { pane }))
      .when(Boolean(pic), (el) => el.child(pic))
      .child(div().flex_none().truncate().max_w(260).font_medium().text_size(13).text_color(t.foreground).child(name))
      // kbrdn.dev `.eyebrow`: mono 11px uppercase, label color.
      .child(div().flex_1().min_w(0).truncate().font_family("Monaspace Krypton").text_size(11).text_color(t.muted)
        .child(`${folder(p.cwd)}${p.branch ? `  ·  ${p.branch}` : ""}`.toUpperCase()))
      // i18n: tech (the agent states, the same in every language: I18N.md)
      .when(st === "working", el => el.child(this.tag(t.working, "WORKING", svg("mods/workspace-chrome/spinner.svg").size(10).text_color(t.working).spin(900))))
      .when(st === "blocked", el => el.child(this.tag(t.blocked, "NEEDS YOU", div().size(6).rounded(3).bg(t.blocked).loop("opacity", { from: 0.3, to: 1, period: 1200 })))) // i18n: tech
      .when(st === "done", el => el.child(this.tag(t.done, "DONE"))) // i18n: tech
      // The buttons fade in on hover (120 ms); they go at once, a removed element can't fade out.
      .when(this.hovered, el => el.child(enter(m, h_flex().flex_none().gap(8).items_center(), `ph-btns-${pane}`, { dy: 0, ms: 120 })
        .child(this.button(t, `ph-r-${pane}`, "split-right", "pane.split", { direction: "right", pane }))
        .child(this.button(t, `ph-d-${pane}`, "split-down", "pane.split", { direction: "down", pane }))
        .child(this.button(t, `ph-z-${pane}`, p.zoomed ? "unzoom" : "zoom", "pane.zoom", { pane }))
        .child(this.button(t, `ph-x-${pane}`, "close", "pane.close", { pane }))));
  }
}
