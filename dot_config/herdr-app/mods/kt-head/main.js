// kbrdn Threads top: on the left the brand over the inbox (the kbrdn.dev K
// and @kbrdn1), in the middle "project / thread" over the terminal (the
// project is the repo, from git), and on the right three toggles: thread
// details (the floating card, shared "kt.details"), the terminal drawer
// (shells under the agent: a first one splits in, then zooming the agent
// hides or shows them), the right panel (the layout's hidden "panel"
// column); then the window buttons where the system draws none. Both halves
// are this mod with props { part: "brand" | "crumbs" }; the layout makes
// them drag the window, and the controls here keep their press.

import { View, div, svg, image } from "gpui-kit";
import { h_flex } from "gpui-base";
import { spaces, panes, run, theme, shared, props, layout, settings, window as win, setShared, exec } from "herdr";

const MONO = "Monaspace Krypton";
const I = (name) => `mods/kt-threads/${name}.svg`;

function own(el) {
  return el.on_mouse_down("left", (_e, cx) => cx.stop_propagation());
}

// Space colors, kept by space id in shared "space.colors": a theme
// color name ("ansi6") or a picked #rrggbb. A space seen without one gets
// the theme color fewest spaces use, once; every mod does the same in the
// same order, so they agree, and adding or renaming spaces moves nothing.
const PROJECT_COLORS = ["ansi6", "ansi3", "ansi4", "ansi5", "ansi2", "ansi1"];
function spaceColors() {
  const ids = new Set(spaces().map((p) => p.id));
  const kept = Object.fromEntries(Object.entries(shared("space.colors") ?? {}).filter(([id]) => ids.has(id)));
  let changed = Object.keys(kept).length !== Object.keys(shared("space.colors") ?? {}).length;
  for (const p of spaces()) {
    if (kept[p.id] || p.name === "~") continue;
    const uses = (c) => Object.values(kept).filter((v) => v === c).length;
    kept[p.id] = PROJECT_COLORS.reduce((best, c) => (uses(c) < uses(best) ? c : best));
    changed = true;
  }
  if (changed) setShared("space.colors", kept);
  return kept;
}
function spaceColor(t, p) {
  if (p.name === "~") return t.dim;
  const c = spaceColors()[p.id] ?? PROJECT_COLORS[0];
  return c.startsWith("#") ? c : t[c];
}

// Whether a layout node is shown.
function shown(node, id) {
  if (!node) return false;
  if (node.id === id) return !node.hidden;
  return (node.children ?? []).some((c) => shown(c, id));
}

// The drawer: the shown tab's panes beside its agent's, and whether they show.
function drawer() {
  const p = spaces().find((x) => x.active);
  const c = p?.tabs.find((x) => x.active);
  const mine = panes().filter((x) => x.tab === c?.id && x.terminal);
  const lead = mine.find((x) => x.program?.agent) ?? mine[0];
  return { mine, lead, open: mine.length > 1 && !lead?.zoomed };
}

function toggleDrawer() {
  const { mine, lead } = drawer();
  if (!lead) return;
  if (mine.length === 1) run("pane.split", { direction: "down", pane: lead.pane });
  else {
    run("pane.zoom", { pane: lead.pane });
    if (!lead.zoomed) run("pane.focus", { pane: lead.pane });
  }
}

// A toggle on the kbrdn.dev ink when on (transparent border when off: no shift);
// framed: the window buttons.
function button(t, id, icon, onClick, on = false, framed = false) {
  return own(
    h_flex()
      .id(id)
      .h(28)
      .px(7)
      .items_center()
      .rounded(10)
      .border(1)
      .border_color(framed ? t.border : on ? t.accent + "66" : t.accent + "00")
      .when(on, (el) => el.bg(t.accent + "24"))
      .text_color(on ? t.accent : t.muted)
      .cursor_pointer()
      .hover((s) => s.bg(on ? t.accent + "24" : t.hover).text_color(on ? t.accent : t.foreground))
      .on_click(onClick)
      .child(svg(I(icon)).size(14)),
  );
}

export default class Head extends View {
  init(_props, cx) {
    this.repos = {}; // folder -> repo name | null
  }

  // Name the repo where the thread's terminal is now, else the space's folder.
  project(p, cx) {
    const at = drawer().lead?.cwd || p.folder;
    const location = JSON.stringify([p.machine ?? null, at]);
    if (!(location in this.repos)) {
      this.repos[location] = undefined;
      cx.spawn(async (cx) => {
        const r = await exec("git", ["rev-parse", "--path-format=absolute", "--git-common-dir"], { cwd: at, on: p.machine }).catch(() => ({ code: 1 }));
        const key = r.code === 0 ? r.stdout.trim() : null;
        this.repos[location] = key && (key.endsWith("/.git") ? key.slice(0, -5) : key).split("/").pop();
        cx.notify();
      });
    }
    return this.repos[location] ?? p.name;
  }

  brand(t, w) {
    const mac = w.platform === "macos" && !w.fullscreen;
    return h_flex()
      .size_full()
      .bg(t.chrome)
      .border_b(1)
      .border_color(t.border)
      .pl(mac ? 80 : 18)
      .gap(8)
      .items_center()
      .child(image(settings().dark ? "brand/logo/k-light.svg" : "brand/logo/k-dark.svg").size(20).flex_none())
      .child(
        h_flex()
          .font_family(MONO)
          .font_bold()
          .text_size(13)
          .child(div().text_color(t.foreground).child("@"))
          .child(div().text_color(t.accent).child("kbrdn1")),
      );
  }

  crumbs(t, w, cx) {
    const p = spaces().find((x) => x.active);
    const c = p?.tabs.find((x) => x.active);
    return h_flex()
      .size_full()
      .bg(t.chrome)
      .border_b(1)
      .border_color(t.border)
      .pl(20)
      .pr(10)
      .gap(10)
      .items_center()
      .when(Boolean(p), (el) =>
        el
          .child(div().w(10).h(10).rounded(3).flex_none().bg(spaceColor(t, p)))
          // kbrdn.dev `.eyebrow`: the project.
          .child(div().flex_none().font_family(MONO).text_size(11).text_color(t.muted).child(this.project(p, cx).toUpperCase()))
          .child(div().flex_none().text_size(14).text_color(t.dim).child("/"))
          .child(div().flex_1().min_w(0).truncate().text_size(14).font_medium().text_color(t.foreground).child(c?.name ?? "")),
      )
      .when(!p, (el) => el.child(div().flex_1()))
      .child(
        h_flex()
          .gap(2)
          .child(button(t, "kt-h-details", "file-text", () => setShared("kt.details", shared("kt.details") !== true), shared("kt.details") === true))
          .child(button(t, "kt-h-drawer", "panel-bottom", toggleDrawer, drawer().open))
          .child(button(t, "kt-h-panel", "panel-right", () => run("layout.toggle", { id: "panel" }), shown(layout(), "panel"))),
      )
      .when(Boolean(w.buttons), (el) =>
        el.child(
          h_flex()
            .pl(8)
            .gap(6)
            .child(button(t, "kt-h-min", "minus", () => run("window.minimize"), false, true))
            .child(button(t, "kt-h-max", "square", () => run("window.maximize"), false, true))
            .child(button(t, "kt-h-close", "x", () => run("window.close"), false, true)),
        ),
      );
  }

  render(cx) {
    const w = win() ?? {};
    const t = theme();
    return props()?.part === "brand" ? this.brand(t, w) : this.crumbs(t, w, cx);
  }
}
