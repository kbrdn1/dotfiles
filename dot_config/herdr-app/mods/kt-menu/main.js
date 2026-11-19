// Context menus (Herdr's items). Opened as a popup with
// props { tab: "pane" | "tab" | "space" | "global", target }.
// Keys (vim.js, #78): j/k or ↑/↓ move (round), gg/G the ends, ctrl-d/ctrl-u half the menu, Enter or o
// runs, Esc or q closes. An item is [label, command, args].
// kt-menu (a clone of the shipped `menu`, layout kbrdn-threads): every close goes through kt-confirm,
// which describes what closes and runs it confirmed; worktrees go through gwm, never Herdr's own
// worktree dialog (it creates checkouts outside gwm and removes without the dirty guard): New opens
// kt-new on a new worktree, Open shows the Worktrees page, Remove is left to that page's guarded remove.
// A thread's menu is the same from kt-threads' cards and kt-head's title; its copies (name, Claude's
// session id, folder, branch, terminal address) go to the clipboard with a "Copied" toast.

import { View, div, svg } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { run, props, closeOverlay, openOverlay, theme, keys, terminals, spaces, panes, exec, shared, notify, home, readTextFile } from "herdr";
// Copied byte for byte from mods/kt-keys/motion.js (data/orchestrator/ANIMATIONS.md).
import { motionState, frame, sheet, leave, leaving, rows } from "./motion.js";
// Copied byte for byte from mods/kt-threads/threads-model.js (with its pr-pick.js and thread-filter.js):
// the thread's name and terminals as its sidebar card has them.
import { label, leads } from "./threads-model.js";
// Copied byte for byte from mods/kt-keys/shortcuts.js: the key on the right, read from keys(), as keycaps.
import { shortcut, kbd } from "./shortcuts.js";
import { makeT } from "./i18n.js";
import strings from "./strings.js";
// Copied byte for byte from mods/kt-keys/vim.js: the vim keys every kt-* mod shares.
import { Vim, step } from "./vim.js";

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

// A thread, its space and its terminals (threads-model.js leads: the one it shows, its agent's).
function thread(tg) {
  const space = spaces().find((s) => s.id === tg.space);
  const tab = space?.tabs.find((c) => c.id === tg.id);
  return { space, tab, ...(tab ? leads(tab, panes()) : {}) };
}

function items(p, git, session) {
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
    case "tab": {
      // The copies, each only when there's something to copy. The folder is kt-threads' `y` one.
      const { space, tab, lead, agent } = thread(tg);
      const copies = [
        ["copyName", tab && label(tab, agent)],
        ["copySession", session],
        ["copyFolder", lead?.cwd ?? space?.folder],
        ["copyBranch", lead?.branch],
        ["copyAddress", agent?.terminal],
      ].filter(([, text]) => text).map(([key, text]) => [tr(key), "copy", { text }]);
      return [
        [tr("rename"), "tab.rename", { id: tg.id }],
        [tr("newThread"), "tab.new", { space: tg.space }],
        ...copies,
        [tr("close"), "tab.close", { id: tg.id }],
      ];
    }
    case "space":
      return [
        [tr("rename"), "space.rename", { id: tg.id }],
        ...(git ? [[tr("newWorktree"), "worktree", { space: tg.id, action: "new" }], [tr("openWorktree"), "worktree", { space: tg.id, action: "open" }]] : []),
        [tr("close"), "space.close", { id: tg.id }],
      ];
    default:
      return [
        [tr("newProject"), "space.new", {}],
        [tr("keys"), "mod.open", { name: "kt-keys" }], // the layout's own help (ctrl-b ?), not Herdr's app.help
        [tr("theme", { name: "graphite" }), "app.theme", { name: "graphite" }],
        [tr("theme", { name: "ink" }), "app.theme", { name: "ink" }],
        [tr("theme", { name: "moss" }), "app.theme", { name: "moss" }],
        [tr("theme", { name: "atom one dark" }), "app.theme", { name: "atom-one-dark" }], // i18n: tech
      ];
  }
}

// The keys help (kt-keys, ctrl-b ?'s): it opens a dialog (the menu closes first) and starts its own group. Not
// every mod.open: another one added later takes neither.
export const isHelp = (it) => it[1] === "mod.open" && it[2]?.name === "kt-keys";

function menuIcon(command) {
  if (command === "copy") return "mods/kt-menu/copy.svg";
  const name = command.endsWith(".close") ? "x" : command.endsWith(".rename") ? "square-pen" : command.endsWith(".new") ? "plus" : command === "worktree" ? "git-branch" : command === "app.theme" ? "settings" : command === "pane.split" ? "panel-right" : command === "pane.zoom" ? "square" : "terminal";
  return `mods/workspace-chrome/${name}.svg`;
}

// The key bound to an item (shortcuts.js): the command this layout binds for the same thing (the closes and
// the worktrees go through kt-head, as here), else the command with its first argument (`pane.split:right`),
// else the command.
const SAME = { "tab.close": "kt-head.close-tab", "pane.close": "kt-head.close-pane", "worktree:new": "kt-head.worktree", "worktree:open": "layout.select:gwm",
  "tab.rename": "kt-head.rename:tab", "space.rename": "kt-head.rename:space",
  "pane.split:right": "kt-head.split:right", "pane.split:down": "kt-head.split:down", "pane.zoom": "kt-head.zoom" }; // #86
const keyOf = (name, args) => shortcut(keys(), shared("layout"),
  [SAME[name], SAME[`${name}:${args?.action}`], SAME[`${name}:${args && Object.values(args)[0]}`], `${name}:${args && Object.values(args)[0]}`, name].filter(Boolean));

export default class Menu extends View {
  init(_props, cx) {
    this.at = 0;
    this.git = null;
    this.vim = new Vim(); // no field: NORMAL only
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
    // A thread's Claude session id: its statusline's per-terminal file, here only (readLive's rule:
    // a remote "vps/t7" has none here). Its copy shows once read.
    this.session = null;
    const agent = p?.tab === "tab" && thread(p.target ?? {}).agent;
    if (agent?.terminal && !agent.terminal.includes("/") && (agent.app === "claude-code" || agent.program?.key === "claude"))
      cx.spawn(async (cx) => {
        try {
          this.session = JSON.parse(await readTextFile(`${home()}/.claude/cache/statusline/herdr-${agent.terminal}.json`))?.session_id ?? null;
        } catch { /* none yet, or torn mid-write: no copy */ }
        cx.notify();
      });
  }

  // motion.js leave(): the menu fades and sinks 6 px, then the popup closes.
  dismiss(cx) {
    leave(this.motion, cx, "km", () => closeOverlay(props()?.overlay));
  }

  choose(i, cx) {
    if (leaving(this.motion, "km")) return; // leaving: a second Enter or click would run it twice
    const it = items(props(), this.git, this.session)[i];
    if (!it) return;
    if (it[1] === "copy") {
      cx.write_to_clipboard(it[2].text);
      notify({ title: tr("copied"), body: it[2].text, level: "success", timeout: 2000 });
      return this.dismiss(cx);
    }
    // An item opening another dialog (kt-new, kt-confirm, kt-prompt, the keys) closes the menu
    // first, at once, as before: that dialog comes in on its own and takes the keyboard last. The rest
    // runs, then the menu leaves.
    const opens = (it[1] === "worktree" && it[2].action === "new") || ["tab.close", "pane.close", "space.close"].includes(it[1])
      || it[1].endsWith(".rename") || isHelp(it);
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
    // A rename asks the name in kt-prompt: tab.rename / space.rename never go out bare (Herdr's own prompt).
    else if (it[1] === "tab.rename") openOverlay({ mod: "kt-prompt", ...full, props: { rename: { tab: it[2].id } } });
    else if (it[1] === "space.rename") openOverlay({ mod: "kt-prompt", ...full, props: { rename: { space: it[2].id } } });
    else run(it[1], it[2]);
    if (!opens) this.dismiss(cx);
  }

  render(cx) {
    const t = theme();
    const list = items(props(), this.git, this.session);
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
        const a = this.vim.handle(e), n = list.length;
        if ((a === "down" || a === "up") && n) this.at = (((this.at + (a === "down" ? 1 : -1) * this.vim.count) % n) + n) % n;
        else if (["top", "bottom", "half-down", "half-up"].includes(a)) this.at = Math.max(0, step(a, this.at, n, this.vim.count, n));
        else if (a === "open") this.choose(this.at, cx);
        else if (a === "escape" || a === "quit") this.dismiss(cx);
        else if (a !== "pending" && a !== "count") return; // the first g of gg, a count: kept, stopped
        cx.stop_propagation(); // Herdr's own Esc would close the popup at once, cutting the exit short
        cx.notify();
      })
      // The items open in order from the top as the menu comes in (motion.js rows(), keyed by label, unique
      // in a menu: one read after opening, the worktrees or the session id, comes in where it goes; 12 items
      // at most, else at once).
      .children(
        rows(m, cx, "km-items", list, (it) => it[0], (it, i) =>
          v_flex()
            .when(i > 0 && (it[1].endsWith(".close") || isHelp(it) || (["app.theme", "copy"].includes(it[1]) && list[i - 1][1] !== it[1])), el => el.child(div().mx(7).my(4).h(1).bg(t.border)))
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
            .child(kbd(t, keyOf(it[1], it[2])))),
        ),
      );
  }
}
