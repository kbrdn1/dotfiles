// The top of kbrdn Threads' right panel: Files, Changes, History, Flow,
// Crosstalk and GWM (kt-gwm's panel view) as kbrdn.dev segments (they pick the child of the layout's
// "panel-body" stack; the shown one sits on the ink; narrow, the others keep
// only their icon), and close (hides the "panel" column). Add a surface: a
// block in that stack and a segment here. Changes is the stack's "diff" child.

import { View, div, svg } from "gpui-kit";
import { h_flex } from "gpui-base";
import { run, layout, theme } from "herdr";

const SURFACES = [
  ["files", "Files", "mods/kt-threads/folder-tree.svg"],
  ["diff", "Changes", "mods/kt-threads/file-diff.svg"],
  ["history", "History", "mods/kt-panel-head/history.svg"],
  ["flow", "Flow", "mods/kt-panel-head/workflow.svg"],
  ["crosstalk", "Crosstalk", "mods/kt-panel-head/messages-square.svg"],
  ["gwm-panel", "GWM", "mods/kt-threads/git-branch.svg"],
];
const MONO = "Monaspace Krypton";
// A theme color with alpha `a`, replacing any it has (glass themes are #rrggbbaa).
const alpha = (c, a) => `${String(c).slice(0, 7)}${a}`;
// Below this width the segments that aren't shown drop their label (icon + tooltip):
// the six labelled ones need ~590 px, the panel is 560.
const WIDE = 600;

function find(node, id) {
  if (!node) return null;
  if (node.id === id) return node;
  for (const c of node.children ?? []) {
    const f = find(c, id);
    if (f) return f;
  }
  return null;
}

const own = (el) => el.on_mouse_down("left", (_e, cx) => cx.stop_propagation());

export default class PanelHead extends View {
  init() {
    this.width = WIDE;
  }

  render() {
    const t = theme();
    const active = find(layout(), "panel-body")?.active ?? SURFACES[0][0];
    const wide = this.width >= WIDE;
    // Inside the panel card (it paints the background): no rule.
    return h_flex()
      .id("ph-root")
      .on_size_change((size, cx) => {
        if ((size.width >= WIDE) !== (this.width >= WIDE)) cx.notify();
        this.width = size.width;
      })
      .size_full()
      .px(4)
      .gap(2)
      .items_center()
      .children(
        SURFACES.map(([id, label, icon]) => {
          const on = id === active;
          return own(
            h_flex()
              .id(`ph-${id}`)
              .flex_none()
              .h(28)
              .px(on || wide ? 11 : 8)
              .gap(7)
              .items_center()
              .rounded_full()
              // kbrdn.dev SegmentInk (transparent border elsewhere: no shift).
              .border(1)
              .border_color(on ? alpha(t.accent, "66") : alpha(t.accent, "00"))
              .when(on, (el) => el.bg(alpha(t.accent, "24")))
              .font_family(MONO)
              .text_size(11)
              .text_color(on ? t.accent : t.muted)
              .cursor_pointer()
              .hover((s) => s.text_color(on ? t.accent : t.foreground))
              .tooltip(label)
              .on_click(() => run("layout.select", { stack: "panel-body", child: id }))
              .child(svg(icon).size(14))
              .when(on || wide, (el) => el.child(label.toUpperCase())),
          );
        }),
      )
      .child(div().flex_1())
      .child(
        own(
          div()
            .id("ph-close")
            .flex_none()
            .p(6)
            .rounded_full()
            .text_color(t.dim)
            .cursor_pointer()
            .hover((s) => s.bg(t.hover).text_color(t.foreground))
            .on_click(() => run("layout.toggle", { id: "panel" }))
            .child(svg("mods/kt-threads/x.svg").size(14)),
        ),
      );
  }
}
