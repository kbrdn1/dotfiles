// Context menus (Herdr's items). Opened as a popup with
// props { tab: "pane" | "tab" | "space" | "global", target }.
// ↑/↓ move, Enter runs, Esc closes. An item is [label, command, args].
// kt-menu (a clone of the shipped `menu`, layout kbrdn-threads): every close goes through kt-confirm,
// which describes what closes and runs it confirmed; worktrees go through gwm, never Herdr's own
// worktree dialog (it creates checkouts outside gwm and removes without the dirty guard): New opens
// kt-new on a new worktree, Open shows the Worktrees page, Remove is left to that page's guarded remove.

import { View, div, svg } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { run, props, closeOverlay, openOverlay, theme, keys, terminals, spaces, panes, exec, shared } from "herdr";
// Copied byte for byte from mods/kt-keys/motion.js (data/orchestrator/ANIMATIONS.md).
import { motionState, frame, sheet, leave, leaving, rows } from "./motion.js";
import { makeT } from "./i18n.js";
import strings from "./strings.js";

const tr = makeT(strings);

// Where a space is now: its first terminal's live folder, else where it was made.
function place(s) {
  const tabs = new Set((s.tabs ?? []).map((c) => c.id));
  return panes().find((p) => tabs.has(p.tab) && p.cwd)?.cwd || s.folder;
}

// A space's checkout: "main" (a repo's own), "linked" (a worktree), or null.
async function checkout(folder, on) {
  const top = await exec("git", ["rev-parse", "--show-toplevel"], { cwd: folder, on });
  const common = await exec("git", ["rev-parse", "--path-format=absolute", "--git-common-dir"], { cwd: folder, on });
  if (top.code !== 0 || common.code !== 0) return null;
  return common.stdout.trim() === `${top.stdout.trim()}/.git` ? "main" : "linked";
}

function items(p, git) {
  p = p ?? {};
  const tg = p.target ?? {};
  switch (p.tab) {
    case "pane": {
      // A kept sub-agent can go back under its parent, still running.
      const all = terminals();
      const term = all.find((t) => t.address === tg.terminal);
      const parent = term?.parent && all.find((t) => t.address === term.parent);
      // Once they go to the program, Shift+right-click still opens this menu.
      const toProgram = term?.labels?.["herdr.right-click"] === "program";
      // A terminal shown outside a tab (a layout terminal block, a window) has
      // no pane to split, zoom or close: its pane is the block's id.
      const inTab = panes().some((pane) => pane.pane === tg.pane);
      return [
        ...(inTab
          ? [
              [tr("splitRight"), "pane.split", { direction: "right", pane: tg.pane }],
              [tr("splitDown"), "pane.split", { direction: "down", pane: tg.pane }],
              [tr("zoom"), "pane.zoom", { pane: tg.pane }],
            ]
          : []),
        ...(term
          ? [
              toProgram
                ? [tr("rightClickMenu"), "terminal.right_click", { terminal: term.address, to: "menu" }]
                : [tr("rightClickProgram"), "terminal.right_click", { terminal: term.address, to: "program" }],
            ]
          : []),
        ...(parent ? [[tr("sendBack", { name: parent.name || parent.address }), "terminal.park", { terminal: term.address }]] : []),
        ...(inTab ? [[tr("closePane"), "pane.close", { pane: tg.pane }]] : []),
      ];
    }
    case "tab":
      return [
        [tr("rename"), "tab.rename", { id: tg.id }],
        [tr("newThread"), "tab.new", { space: tg.space }],
        [tr("close"), "tab.close", { id: tg.id }],
      ];
    case "space":
      return [
        [tr("rename"), "space.rename", { id: tg.id }],
        ...(git ? [[tr("newWorktree"), "worktree", { space: tg.id, action: "new" }], [tr("openWorktree"), "worktree", { space: tg.id, action: "open" }]] : []),
        [tr("close"), "space.close", { id: tg.id }],
      ];
    default:
      return [
        [tr("newProject"), "space.new", {}],
        [tr("keys"), "app.help", {}],
        [tr("theme", { name: "graphite" }), "app.theme", { name: "graphite" }],
        [tr("theme", { name: "ink" }), "app.theme", { name: "ink" }],
        [tr("theme", { name: "moss" }), "app.theme", { name: "moss" }],
        [tr("theme", { name: "atom one dark" }), "app.theme", { name: "atom-one-dark" }], // i18n: tech
      ];
  }
}

function menuIcon(command) {
  const name = command.endsWith(".close") ? "x" : command.endsWith(".rename") ? "square-pen" : command.endsWith(".new") ? "plus" : command === "worktree" ? "git-branch" : command === "app.help" ? "terminal" : command === "app.theme" ? "settings" : command === "pane.split" ? "panel-right" : command === "pane.zoom" ? "square" : "terminal";
  return `mods/workspace-chrome/${name}.svg`;
}

// The key bound to a command, for the hint on the right.
function shortcut(name, args) {
  // `pane.split:right` binds pane.split with { direction: "right" }.
  const value = args && Object.values(args)[0];
  const k = keys().find((b) => b.section === "global" && (b.action === name || b.action === `${name}:${value}`));
  return k ? k.keys : "";
}

export default class Menu extends View {
  init(_props, cx) {
    this.at = 0;
    this.git = null;
    this.handle = cx.focus_handle();
    this.handle.focus();
    this.motion = motionState(); // ANIMATIONS.md: the menu rises in on its first layout, fades and sinks 6 px out
    const p = props();
    const space = p?.tab === "space" && spaces().find((s) => s.id === p.target?.id);
    const folder = space && place(space);
    if (folder)
      cx.spawn(async (cx) => {
        this.git = await checkout(folder, space.machine).catch(() => null);
        cx.notify();
      });
  }

  // motion.js leave(): the menu fades and sinks 6 px, then the popup closes.
  dismiss(cx) {
    leave(this.motion, cx, "km", () => closeOverlay(props()?.overlay));
  }

  choose(i, cx) {
    if (leaving(this.motion, "km")) return; // leaving: a second Enter or click would run it twice
    const it = items(props(), this.git)[i];
    if (!it) return;
    // An item opening another dialog (kt-new, kt-confirm, Herdr's rename prompt, the keys) closes the menu
    // first, at once, as before: that dialog comes in on its own and takes the keyboard last. The rest
    // runs, then the menu leaves.
    const opens = (it[1] === "worktree" && it[2].action === "new") || ["tab.close", "pane.close", "space.close"].includes(it[1])
      || it[1].endsWith(".rename") || it[1] === "app.help";
    if (opens) closeOverlay(props()?.overlay);
    const full = { kind: "dialog", width: 1, height: 1, frame: "none" };
    if (it[1] === "worktree") {
      if (it[2].action === "new") {
        run("space.select", { id: it[2].space });
        openOverlay({ mod: "kt-new", ...full, props: { worktree: true } });
      } else run("layout.select", { stack: "view", child: "gwm" });
    } else if (it[1] === "tab.close") openOverlay({ mod: "kt-confirm", ...full, props: { thread: it[2].id } });
    else if (it[1] === "pane.close") openOverlay({ mod: "kt-confirm", ...full, props: { pane: it[2].pane } });
    else if (it[1] === "space.close") openOverlay({ mod: "kt-confirm", ...full, props: { space: it[2].id } });
    else run(it[1], it[2]);
    if (!opens) this.dismiss(cx);
  }

  render(cx) {
    const t = theme();
    const list = items(props(), this.git);
    const m = frame(this.motion, Boolean(shared("kt.reducedMotion")));
    const s = sheet(m, "km", this.shown); // no veil in a popup: the menu itself fades and moves 6 px
    return s.card(s.veil(v_flex().id("menu")))
      .on_size_change((_size, cx) => { if (this.shown) return; this.shown = true; cx.notify(); })
      .track_focus(this.handle)
      .w_full()
      .min_h(0)
      .p(5)
      .bg(t.popover)
      .text_size(12.8)
      .on_key_down((e, cx) => {
        if (e.key === "down") this.at = (this.at + 1) % list.length;
        else if (e.key === "up") this.at = (this.at + list.length - 1) % list.length;
        else if (e.key === "enter") this.choose(this.at, cx);
        else if (e.key === "escape") this.dismiss(cx);
        else return;
        cx.stop_propagation(); // Herdr's own Esc would close the popup at once, cutting the exit short
        cx.notify();
      })
      // The items open in order from the top as the menu comes in (motion.js rows(), keyed by rank: the
      // list doesn't change while the menu is open; 12 items at most, else at once).
      .children(
        rows(m, cx, "km-items", list, (it) => String(list.indexOf(it)), (it, i) =>
          v_flex()
            .when(i > 0 && (it[1].endsWith(".close") || it[1] === "app.help" || (it[1] === "app.theme" && list[i - 1][1] !== "app.theme")), el => el.child(div().mx(7).my(4).h(1).bg(t.border)))
            .child(h_flex()
            .id(`mi-${i}`)
            .h(31)
            .px(8)
            .gap(9)
            .rounded(7)
            .items_center()
            .justify_between()
            .text_color(t.foreground)
            .when(i === this.at, (el) => el.bg(t.selected))
            .hover((s) => s.bg(t.hover))
            .on_click((_e, cx) => this.choose(i, cx))
            .child(svg(menuIcon(it[1])).size(14).flex_none().text_color(t.muted))
            .child(div().flex_1().child(it[0]))
            .child(div().text_size(11).text_color(t.dim).child(shortcut(it[1], it[2])))),
        ),
      );
  }
}
