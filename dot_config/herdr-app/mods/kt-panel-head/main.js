// The top of kbrdn Threads' right panel: Files and Diff as kbrdn.dev
// segments (they pick the child of the layout's "panel-body" stack; the
// shown one sits on the ink), and close (hides the "panel" column). Add a
// surface: a block in that stack and a segment here.

import { View, div, svg } from "gpui-kit";
import { h_flex } from "gpui-base";
import { run, layout, theme } from "herdr";

const SURFACES = [
  ["files", "Files", "folder-tree"],
  ["diff", "Diff", "file-diff"],
];
const MONO = "Monaspace Krypton";
const I = (name) => `mods/kt-threads/${name}.svg`;

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
  render() {
    const t = theme();
    const active = find(layout(), "panel-body")?.active ?? SURFACES[0][0];
    return h_flex()
      .size_full()
      .bg(t.chrome)
      .px(10)
      .gap(4)
      .items_center()
      .border_b(1)
      .border_color(t.border)
      .children(
        SURFACES.map(([id, label, icon]) => {
          const on = id === active;
          return own(
            h_flex()
              .id(`ph-${id}`)
              .h(28)
              .px(12)
              .gap(7)
              .items_center()
              .rounded_full()
              // kbrdn.dev SegmentInk (transparent border elsewhere: no shift).
              .border(1)
              .border_color(on ? t.accent + "66" : t.accent + "00")
              .when(on, (el) => el.bg(t.accent + "24"))
              .font_family(MONO)
              .text_size(11)
              .text_color(on ? t.accent : t.muted)
              .cursor_pointer()
              .hover((s) => s.text_color(on ? t.accent : t.foreground))
              .on_click(() => run("layout.select", { stack: "panel-body", child: id }))
              .child(svg(I(icon)).size(14))
              .child(label.toUpperCase()),
          );
        }),
      )
      .child(div().flex_1())
      .child(
        own(
          div()
            .id("ph-close")
            .p(6)
            .rounded(8)
            .text_color(t.dim)
            .cursor_pointer()
            .hover((s) => s.bg(t.hover).text_color(t.foreground))
            .on_click(() => run("layout.toggle", { id: "panel" }))
            .child(svg(I("x")).size(14)),
        ),
      );
  }
}
