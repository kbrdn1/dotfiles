// The top of kbrdn Threads' right panel: Files, Changes, History, Flow,
// Crosstalk, Context and GWM (kt-gwm's panel view) as kbrdn.dev segments (they pick the child of the layout's
// "panel-body" stack; the shown one sits on the ink; narrow, the others keep
// only their icon), and close (hides the "panel" column). Add a surface: a
// block in that stack and a segment here. Changes is the stack's "diff" child.

import { View, div, svg } from "gpui-kit";
import { h_flex } from "gpui-base";
import { run, layout, theme, shared, keys } from "herdr";
import { motionState, frame, ink } from "./motion.js";
// Copied byte for byte from mods/kt-keys/shortcuts.js: each segment's key (kt-head.panel:<id>, read from
// keys()) in its tooltip, and close's (layout.toggle:panel); the segments have no room for keycaps.
import { shortcut, tip } from "./shortcuts.js";
// Copied byte for byte from mods/kt-keys/i18n.js (I18N.md).
import { makeT } from "./i18n.js";
import strings from "./strings.js";
// Copied byte for byte from mods/kt-keys/panel.js: the panel's content glides in and out (#73).
import { panelIn, togglePanel } from "./panel.js";

const tr = makeT(strings);

const SURFACES = [
  ["files", "Files", "mods/kt-threads/folder-tree.svg"],
  ["diff", "Changes", "mods/kt-threads/file-diff.svg"],
  ["history", "History", "mods/kt-panel-head/history.svg"],
  ["flow", "Flow", "mods/kt-panel-head/workflow.svg"],
  ["crosstalk", "Crosstalk", "mods/kt-panel-head/messages-square.svg"],
  ["context", "Context", "mods/kt-panel-head/gauge.svg"],
  ["gwm-panel", "GWM", "mods/kt-threads/git-branch.svg"],
];
// What gives each surface the keyboard after a click on its segment (#78), as [ ] do (kt-files' panelTab):
// a moment later, the new child shown; gwm-panel: kt-gwm's panel copy only (its page copy may show too).
const FOCUS = { files: "kt-files.focus", diff: "kt-diff.focus", history: "kt-history.focus", flow: "kt-flow.focus", crosstalk: "kt-crosstalk.focus", context: "kt-context.focus", "gwm-panel": "kt-gwm.panel-focus" };
const MONO = "Monaspace Krypton";
// A theme color with alpha `a`, replacing any it has (glass themes are #rrggbbaa).
const alpha = (c, a) => `${String(c).slice(0, 7)}${a}`;
// Below this width the segments that aren't shown drop their label (icon + tooltip):
// the seven labelled ones need ~690 px (estimated from the six's ~590, to measure), the panel is 560.
const WIDE = 700;

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
    this.segW = {}; // segment id -> its measured width, for the ink
    this.motion = motionState();
  }

  render() {
    const t = theme();
    const m = frame(this.motion, Boolean(shared("kt.reducedMotion")));
    const active = find(layout(), "panel-body")?.active ?? SURFACES[0][0];
    const wide = this.width >= WIDE;
    // kbrdn.dev SegmentInk: one pill gliding to the shown segment (ANIMATIONS.md), once the
    // segments before it are measured; it lands at once the first time.
    const at = SURFACES.findIndex(([id]) => id === active);
    const before = SURFACES.slice(0, at).map(([id]) => this.segW[id]);
    const placed = at >= 0 && this.segW[active] && before.every(Boolean);
    const left = placed ? before.reduce((s, w) => s + w + 2, 0) : 0;
    // Inside the panel card (it paints the background): no rule. panel.js: in and out with the panel (#73).
    return panelIn(m, h_flex()
      .id("ph-root")
      .on_size_change((size, cx) => {
        if ((size.width >= WIDE) !== (this.width >= WIDE)) cx.notify();
        this.width = size.width;
      })
      .size_full()
      .px(4)
      .gap(2)
      .items_center()
      .child(h_flex().relative().flex_none().h(28).gap(2).items_center()
        .child(placed
          ? ink(m, div().id("ph-ink").absolute().top(0).h(28).left(left).w(this.segW[active]).rounded_full()
            .border(1).border_color(alpha(t.accent, "66")).bg(alpha(t.accent, "24")))
          : div().id("ph-ink-wait").absolute().w(0).h(0))
        .children(
        SURFACES.map(([id, label, icon]) => {
          const on = id === active;
          return own(
            h_flex()
              .id(`ph-${id}`)
              .on_size_change((size, cx) => {
                if (this.segW[id] === size.width) return;
                this.segW[id] = size.width;
                cx.notify();
              })
              .flex_none()
              .h(28)
              .px(on || wide ? 11 : 8)
              .gap(7)
              .items_center()
              .rounded_full()
              // The ink is the pill under the segments (transparent border here: no shift).
              .border(1)
              .border_color(alpha(t.accent, "00"))
              .font_family(MONO)
              .text_size(11)
              .text_color(on ? t.accent : t.muted)
              .cursor_pointer()
              .hover((s) => s.text_color(on ? t.accent : t.foreground))
              .tooltip(tip(label, shortcut(keys(), shared("layout"), `kt-head.panel:${id}`)))
              .on_click((_e, cx) => {
                run("layout.select", { stack: "panel-body", child: id });
                cx.timer.after(120, () => run(FOCUS[id]));
              })
              .child(svg(icon).size(14))
              .when(on || wide, (el) => el.child(label.toUpperCase())),
          );
        }),
      ))
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
            .tooltip(tip(tr("close"), shortcut(keys(), shared("layout"), "kt-head.panel-toggle", "layout.toggle:panel")))
            // panel.js: the content goes, then the column (#73).
            .on_click((_e, cx) => togglePanel(cx))
            .child(svg("mods/kt-threads/x.svg").size(14)),
        ),
      ));
  }
}
