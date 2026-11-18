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
import { spaces, panes, run, theme, shared, props, layout, settings, window as win, setShared, exec, home, agents, focused, openOverlay, nextCommand, checking } from "herdr";
import { motionState, frame, enter, fade, sharpen } from "./motion.js";
import { makeT } from "./i18n.js";
import strings from "./strings.js";
// Copied byte for byte from mods/kt-threads/halo.js: the halo the brand part draws, kt-threads below.
import { HALO, haloLayers } from "./halo.js";

const tr = makeT(strings);
const MONO = "Monaspace Krypton";
const I = (name) => `mods/kt-threads/${name}.svg`;
const SPIN = "mods/workspace-chrome/spinner.svg";
// The main view's pages (stack "view"), as the sidebar names them: [label, icon, sidebar group].
// Skills, MCP and Plugins sit in the sidebar's « Agents » group: their crumb reads « Agents › Skills ».
const PAGES = {
  inbox: ["Inbox", "layers"],
  workflow: ["Workflow", "workflow", "Agents"],
  skills: ["Skills", "sparkles", "Agents"],
  mcp: ["MCP", "plug", "Agents"],
  plugins: ["Plugins", "puzzle", "Agents"],
  gwm: ["Worktrees", "git-branch"],
  // kt-notes; the sidebar's own icon for it (kt-threads), so the crumb and the line match.
  notes: ["Notes", "file-text"],
  // kt-automation, in the Agents group with kt-threads' icon for it; its name is words (page.automation).
  automation: [null, "refresh-cw", "Agents"],
};
const alpha = (c, a) => (c ?? "#000000").slice(0, 7) + a;

// kt-threads' label(): a name the person gave stays; else the agent's live title, else the program.
const clean = (s) => (s ?? "").replace(/^[^\p{L}\p{N}\p{Ps}\p{Pi}]+/u, "").replace(/^\[ [!.] \] /, "").trim();
function label(tab, lead) {
  const prog = lead?.program?.name;
  const base = tab?.named ? tab.name : prog ?? "Terminal";
  if (!lead?.program?.agent) return base;
  const live = clean(lead.title);
  const path = /^[~/]|^[A-Za-z]:\\/.test((lead.title ?? "").replace(/^[^\p{L}\p{N}~/]+/u, ""));
  const telling = live && live !== lead.terminal && live !== prog && !path && !live.includes("@") && live.toLowerCase() !== lead.program.key;
  return (tab?.name === prog || !tab?.named) && telling ? live : base;
}
// kt-threads' logoOf(): the registry logo for the appearance now, else the other mode's.
function logoOf(e) {
  const l = e?.logos ?? { light: e?.logo ?? null, dark: e?.logo ?? null };
  return (settings().dark ? (l.dark ?? l.light) : (l.light ?? l.dark)) ?? null;
}
function find(node, id) {
  if (node?.id === id) return node;
  for (const c of node?.children ?? []) { const f = find(c, id); if (f) return f; }
  return null;
}

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

// A toggle on the kbrdn.dev ink when on (transparent border: no shift); the ink is a layer that
// fades in and out with the toggle (motion.js fade, ANIMATIONS.md: gpui animates no color).
// framed: the window buttons.
function button(m, t, id, icon, onClick, on = false, framed = false, tip = null) {
  return own(
    h_flex()
      .id(id)
      .relative()
      .h(28)
      .px(7)
      .items_center()
      .rounded(10)
      .border(1)
      .border_color(framed ? t.border : t.accent + "00")
      .text_color(on ? t.accent : t.muted)
      .cursor_pointer()
      .hover((s) => (on ? s.text_color(t.accent) : s.bg(t.hover).text_color(t.foreground)))
      .on_click(onClick)
      .when(Boolean(tip), (el) => el.tooltip(tip))
      .when(!framed, (el) => el.child(fade(m, div().id(`${id}-ink`).absolute().top(-1).left(-1).right(-1).bottom(-1)
        .rounded(10).border(1).border_color(t.accent + "66").bg(t.accent + "24"), on)))
      .child(svg(icon.includes("/") ? icon : I(icon)).size(14)),
  );
}

// A shell beside the thread's agent (a split to the right of its pane).
function splitRight() {
  const { lead } = drawer();
  if (lead) run("pane.split", { direction: "right", pane: lead.pane });
}

// The ctrl-b keys that are more than one command (keys.json `kt-head.<command>`), run by the crumbs
// copy only: both copies get them, and the crumbs one is always shown (the sidebar can be hidden).
// `panel:<child>` shows the right panel on that surface; `attention` shows the first agent that
// needs you, else the first done; `picker:<group>` opens Search on a group (0 all, 2 projects);
// `worktree` opens New thread on a new worktree; `close-pane` / `close-tab` ask kt-confirm first.
const confirm = (title, detail, label, command) =>
  openOverlay({ mod: "kt-confirm", kind: "dialog", width: 1, height: 1, frame: "none", props: { title, detail, label, danger: true, command } });
function route(c) {
  const [name, arg] = [c.split(":")[0], c.slice(c.indexOf(":") + 1)];
  if (name === "panel") {
    run("layout.show", { id: "panel" });
    run("layout.select", { stack: "panel-body", child: arg });
  } else if (name === "attention") {
    const all = agents();
    const a = all.find((x) => x.status === "blocked") ?? all.find((x) => x.status === "done");
    if (!a) return;
    run("layout.select", { stack: "view", child: "thread" });
    run("agent.focus", { terminal: a.address });
  } else if (name === "picker") {
    openOverlay({ mod: "kt-picker", kind: "dialog", width: 1, height: 1, frame: "none", props: { group: Number(arg) || 0 } });
  } else if (name === "worktree") {
    run("layout.select", { stack: "view", child: "thread" });
    openOverlay({ mod: "kt-new", kind: "dialog", width: 1, height: 1, frame: "none", props: { worktree: true } });
  } else if (name === "close-pane") {
    const p = panes().find((x) => x.pane === focused()?.pane);
    if (p) confirm(tr("pane.title"), tr("pane.detail", { name: p.title || p.program?.name || "Terminal" }), tr("close"), { name: "pane.close", args: { pane: p.pane } });
  } else if (name === "close-tab") {
    const s = spaces().find((x) => x.active);
    const c = s?.tabs.find((x) => x.active);
    if (c) confirm(tr("tab.title"), tr(s.tabs.length === 1 ? "tab.detailLast" : "tab.detail", { name: c.name }), tr("close"), { name: "tab.close", args: { id: c.id } });
  }
}

export default class Head extends View {
  init(_props, cx) {
    this.repos = {}; // folder -> repo name | null
    this.motion = motionState(); // ANIMATIONS.md: the toggles' ink and the agent's state fade in
    if (checking()) return;
    cx.spawn(async (cx) => {
      for (;;) {
        const c = await nextCommand();
        if (props()?.part === "crumbs") route(c);
        cx.notify();
      }
    });
  }

  // The repo's main checkout where the thread's terminal is now (null outside git), once per folder.
  root(p, cx) {
    const at = drawer().lead?.cwd || p.folder;
    const location = JSON.stringify([p.machine ?? null, at]);
    if (!(location in this.repos)) {
      this.repos[location] = undefined;
      cx.spawn(async (cx) => {
        const r = await exec("git", ["rev-parse", "--path-format=absolute", "--git-common-dir"], { cwd: at, on: p.machine }).catch(() => ({ code: 1 }));
        const key = r.code === 0 ? r.stdout.trim() : null;
        this.repos[location] = key ? (key.endsWith("/.git") ? key.slice(0, -5) : key) : null;
        cx.notify();
      });
    }
    return this.repos[location] ?? null;
  }

  // The project as the sidebar shows it: Home, else its registry entry (name, logo, color), else the repo.
  project(t, p, cx) {
    if (!p.machine && p.folder === home()) return { home: true, name: "Home" };
    const root = this.root(p, cx);
    const e = (shared("kt.projects") ?? []).find((x) => (x.machine ?? null) === (p.machine ?? null) && (x.folder === root || x.folder === p.folder));
    const c = e?.color ?? spaceColors()[p.id] ?? PROJECT_COLORS[0];
    return { name: e?.name ?? (root ? root.split("/").pop() : p.name), logo: logoOf(e), color: c.startsWith("#") ? c : t[c] };
  }

  // The halo's top (halo.js, its color kt-threads' shared HALO), clipped by the block; no background of
  // its own (the side column's), so it runs on into kt-threads below without a band.
  brand(t, w) {
    const mac = w.platform === "macos" && !w.fullscreen;
    const m = frame(this.motion, Boolean(shared("kt.reducedMotion")));
    return h_flex()
      .size_full()
      .relative()
      .overflow_hidden()
      .children(shared("kt.opt.kt-threads.halo") === false ? [] : haloLayers(m, (this.haloMemo ??= {}), shared(HALO) ?? null, 0))
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
          .child(div().text_color(t.accent).child("kbrdn1")), // i18n: tech
      );
  }

  // Project tile: Home's house, else the registry logo, else the initial on the project's color.
  tile(t, pr) {
    const box = div().size(20).flex_none().rounded(6).flex().items_center().justify_center().overflow_hidden();
    if (pr.home) return box.bg(t.raised).border(1).border_color(t.border).child(svg(I("house")).size(12).text_color(t.muted));
    if (pr.logo) return box.child(image(pr.logo).size(18));
    return box.bg(pr.color).child(div().font_family(MONO).font_bold().text_size(11).text_color("#ffffff").child((pr.name[0] ?? "?").toUpperCase()));
  }

  // The agent's state, written: a spinner while it works, one pulse when it needs you.
  status(t, lead) {
    const s = lead?.status;
    const look = { working: [t.working, "WORKING"], blocked: [t.blocked, "NEEDS YOU"], done: [t.done, "DONE"] }[s]; // i18n: tech
    if (!look) return null;
    const [color, text] = look;
    return enter(this.motion, h_flex().flex_none().h(22).px(8).gap(6).items_center().rounded_full(), `kt-h-st-${s}`, { dy: 0 })
      .border(1).border_color(alpha(color, "4d")).bg(alpha(color, "1a"))
      .font_family(MONO).text_size(10).text_color(color)
      .child(s === "working" ? svg(SPIN).size(10).spin(900) : div().size(6).rounded_full().bg(color)
        .when(s === "blocked", (el) => el.loop("opacity", { from: 0.3, to: 1, period: 1200 })))
      .child(text);
  }

  crumbs(t, w, cx) {
    const p = spaces().find((x) => x.active);
    const c = p?.tabs.find((x) => x.active);
    const lead = drawer().lead;
    const active = find(layout(), "view")?.active;
    const page = PAGES[active];
    const pr = p ? this.project(t, p, cx) : null;
    const sep = () => svg(I("chevron-right")).size(12).flex_none().text_color(t.dim);
    const m = frame(this.motion, Boolean(shared("kt.reducedMotion")));
    // Inside the work card (it paints the background): padding, no rule.
    return h_flex()
      .size_full()
      .pl(10)
      .pr(4)
      .gap(8)
      .items_center()
      .when(Boolean(p), (el) =>
        el
          .child(this.tile(t, pr))
          .child(div().flex_none().text_size(13).font_medium().text_color(page ? t.muted : t.foreground).child(pr.name))
          .child(sep())
          .when(Boolean(page), (el) => el
            // The sidebar group, a plain crumb (a click on it does nothing).
            .when(Boolean(page?.[2]), (el) => el
              .child(div().flex_none().text_size(13).font_medium().text_color(t.muted).child(page[2]))
              .child(sep()))
            .child(svg(I(page?.[1] ?? "layers")).size(14).flex_none().text_color(t.accent))
            // motion.js sharpen: the page's title comes into focus at each change of view, once.
            .child(((name) => sharpen(m, `kh-page:${name}`, () => div().text_size(14).font_medium().text_color(t.foreground).child(name)).flex_none())(
              page ? page[0] ?? tr(`page.${active}`) : ""))
            // Back to the thread the page covers.
            .child(own(h_flex().id("kt-h-back").flex_none().h(24).px(9).gap(6).items_center().rounded_full()
              .border(1).border_color(t.border).font_family(MONO).text_size(10).text_color(t.muted)
              .cursor_pointer().hover((s) => s.bg(t.hover).text_color(t.foreground))
              .on_click(() => run("layout.select", { stack: "view", child: "thread" }))
              .child(div().flex_none().text_color(t.dim).child("←"))
              .child(div().max_w(180).truncate().child(label(c, lead)))))
            .child(div().flex_1()))
          .when(!page, (el) => el
            .child(sharpen(m, `kh-thread:${c?.id ?? ""}`, () => div().truncate().text_size(14).font_medium().text_color(t.foreground).child(label(c, lead))).flex_shrink(1).min_w(0))
            .when(Boolean(lead?.branch), (el) => el.child(h_flex().flex_none().h(22).px(8).gap(5).items_center().rounded_full()
              .border(1).border_color(t.border).font_family(MONO).text_size(10.5).text_color(t.muted)
              .child(svg(I("git-branch")).size(11).text_color(t.dim))
              .child(div().max_w(220).truncate().child(lead.branch))))
            .when(Boolean(this.status(t, lead)), (el) => el.child(this.status(t, lead)))
            .child(div().flex_1())),
      )
      .when(!p, (el) => el.child(div().flex_1()))
      .child(
        h_flex()
          .gap(2)
          .child(button(m, t, "kt-h-details", "file-text", () => setShared("kt.details", shared("kt.details") !== true), shared("kt.details") === true, false, tr("details")))
          .child(button(m, t, "kt-h-split", "mods/kt-head/columns-2.svg", splitRight, false, false, tr("splitRight")))
          .child(button(m, t, "kt-h-drawer", "panel-bottom", toggleDrawer, drawer().open, false, tr("drawer")))
          .child(button(m, t, "kt-h-panel", "panel-right", () => run("layout.toggle", { id: "panel" }), shown(layout(), "panel"), false, tr("panel"))),
      )
      .when(Boolean(w.buttons), (el) =>
        el.child(
          h_flex()
            .pl(8)
            .gap(6)
            .child(button(m, t, "kt-h-min", "minus", () => run("window.minimize"), false, true))
            .child(button(m, t, "kt-h-max", "square", () => run("window.maximize"), false, true))
            .child(button(m, t, "kt-h-close", "x", () => run("window.close"), false, true)),
        ),
      );
  }

  render(cx) {
    const w = win() ?? {};
    const t = theme();
    return props()?.part === "brand" ? this.brand(t, w) : this.crumbs(t, w, cx);
  }
}
