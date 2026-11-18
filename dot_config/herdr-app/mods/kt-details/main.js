// kbrdn Threads' thread details: a card floating over the terminal's top
// right, shown by the header's details toggle (shared "kt.details"). For the
// shown thread's folder: where it is, open it in Zed, the branch, what
// changed (click: the right panel's diff), and commit / push / pull request
// (`git`, `gh`). Commit stages everything (`git add -A`). An example: change
// EDITOR, the buttons, or what a commit does.

import { View, div, svg } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { spaces, panes, run, shared, exec, home, layout, theme } from "herdr";
import { bump, gitTopics, refreshOn } from "./bus.js";
import { makeT } from "./i18n.js";
import strings from "./strings.js";
// kt-keys' roll.js (a byte-identical copy): the commits ahead roll to their new count.
import { roll } from "./roll.js";

const tr = makeT(strings);

// The command that opens a folder in your editor, and its name on the card.
const EDITOR = ["zed"];
const EDITOR_NAME = "Zed";
const MONO = "Monaspace Krypton";
const I = (name) => `mods/kt-threads/${name}.svg`;
// Home as ~ (git says C:/Users/x where Windows says C:\Users\x).
const tilde = (path) => {
  if (!path) return "";
  const [p, h] = [path, home()].map((s) => s.replace(/\\/g, "/"));
  return p.startsWith(h) ? `~${p.slice(h.length)}` : path;
};

function shown(node, id) {
  if (!node) return false;
  if (node.id === id) return !node.hidden;
  return (node.children ?? []).some((c) => shown(c, id));
}

export default class Details extends View {
  init(_props, cx) {
    this.git = null; // { root, on, branch, add, del, files, ahead, upstream }
    this.message = "";
    this.typing = false;
    this.busy = "";
    this.note = "";
    this.handle = cx.focus_handle();
    this.refresh(cx);
    cx.timer.every(4000, (cx) => this.refresh(cx));
  }

  folder() {
    const p = spaces().find((x) => x.active);
    const c = p?.tabs.find((x) => x.active);
    const mine = panes().filter((x) => x.tab === c?.id && x.terminal);
    const lead = mine.find((x) => x.program?.agent) ?? mine[0];
    return lead?.cwd ?? p?.folder ?? null;
  }

  machine() {
    return spaces().find((s) => s.active)?.machine ?? null;
  }

  refresh(cx) {
    const cwd = this.folder();
    const on = this.machine();
    const key = JSON.stringify([on, cwd]);
    if (shared("kt.details") !== true || !cwd || this.looking) return;
    this.looking = true;
    cx.spawn(async (cx) => {
      try {
        const top = await exec("git", ["rev-parse", "--show-toplevel"], { cwd, on });
        if (top.code !== 0) this.git = { root: null, on };
        else {
          const root = top.stdout.trim();
          const st = await exec("git", ["status", "--porcelain=v2", "--branch"], { cwd: root, on });
          const num = await exec("git", ["diff", "HEAD", "--numstat"], { cwd: root, on });
          const g = { root, on, branch: null, add: 0, del: 0, files: 0, ahead: 0, upstream: false };
          for (const l of st.stdout.split("\n")) {
            if (l.startsWith("# branch.head ")) g.branch = l.slice(14);
            else if (l.startsWith("# branch.upstream ")) g.upstream = true;
            else if (l.startsWith("# branch.ab ")) g.ahead = Math.abs(parseInt(l.slice(12), 10)) || 0;
            else if (l && !l.startsWith("#")) g.files++;
          }
          for (const l of num.stdout.split("\n").filter(Boolean)) {
            const [a, d] = l.split("\t");
            g.add += +a || 0;
            g.del += +d || 0;
          }
          if (JSON.stringify([this.machine(), this.folder()]) !== key) return;
          this.git = g;
        }
      } catch (error) { this.git = null; this.note = String(error); }
      finally { this.looking = false; cx.notify(); }
    });
  }

  act(cx, label, steps) {
    if (this.busy || !this.git?.root || this.looking) return;
    const { root, on } = this.git;
    this.busy = label;
    this.note = "";
    cx.notify();
    cx.spawn(async (cx) => {
      try {
        for (const [cmd, args] of steps) {
          const r = await exec(cmd, args, { cwd: root, on });
          if (r.code !== 0) {
            this.note = (r.stderr || r.stdout || tr("failed", { cmd })).trim().split("\n").pop();
            break;
          }
        }
        if (!this.note && label === "Commit") this.message = "";
      } catch (error) { this.note = String(error); }
      // DATA-SYNC.md: what this changed, for every mod showing it (on a failure too: a hook may have
      // staged); a push or a PR moves GitHub's side as well.
      bump(...gitTopics(root), ...(steps.some(([cmd, args]) => cmd === "gh" || args[0] === "push") ? ["gh"] : []));
      this.busy = "";
      this.looking = false;
      this.refresh(cx);
      cx.notify();
    });
  }

  commit(cx) {
    const m = this.message.trim();
    if (!m) {
      this.typing = true;
      this.handle.focus();
      return;
    }
    this.act(cx, "Commit", [
      ["git", ["add", "-A"]],
      ["git", ["commit", "-m", m]],
    ]);
  }

  // A folder in the editor; a failure (editor not installed) shows on the card.
  openEditor(cx, folder) {
    cx.spawn(async (cx) => {
      const r = await exec(EDITOR[0], [...EDITOR.slice(1), folder]).catch((error) => ({ code: 1, stderr: String(error) }));
      if (r.code === 0) return;
      this.note = (r.stderr || tr("failed", { cmd: EDITOR[0] })).trim().split("\n").pop();
      cx.notify();
    });
  }

  row(t, id, icon, label, right, onClick) {
    return h_flex()
      .id(id)
      .h(32)
      .px(10)
      .gap(10)
      .items_center()
      .rounded(10)
      .text_size(13)
      .text_color(t.foreground)
      .when(Boolean(onClick), (el) => el.cursor_pointer().hover((s) => s.bg(t.hover)).on_click(onClick))
      .child(svg(I(icon)).size(15).flex_none().text_color(t.muted))
      .child(div().flex_1().min_w(0).truncate().child(label))
      .when(Boolean(right), (el) => el.child(right));
  }

  // primary: the kbrdn.dev solid button; else a hairline pill.
  small(t, id, label, onClick, on = true, primary = false) {
    const solid = primary && on;
    return div()
      .id(id)
      .h(26)
      .px(10)
      .flex()
      .items_center()
      .rounded_full()
      .border(1)
      .border_color(solid ? t.solid : t.border)
      .when(solid, (el) => el.bg(t.solid))
      .font_family(MONO)
      .text_size(10.5)
      .text_color(solid ? t.solid_foreground : on ? t.foreground : t.dim)
      .when(on, (el) => el.cursor_pointer().hover((s) => (solid ? s.opacity(0.9) : s.bg(t.hover))).on_click(onClick))
      .child((this.busy === label ? `${label}…` : label).toUpperCase());
  }

  render(cx) {
    if (shared("kt.details") !== true) return div();
    if (!this.git) this.refresh(cx);
    // Another mod's action on this repo, or an agent of this space that stopped working: read again.
    const sp = spaces().find((s) => s.active)?.id;
    refreshOn(this, cx, "git", [...gitTopics(this.git?.root ?? null), ...(sp ? [`agent:${sp}`] : [])], async (cx) => this.refresh(cx));
    const t = theme();
    const g = this.git;
    const cwd = this.folder();
    // The machine the card's folder is on: the editor only opens folders on this computer.
    const on = g?.on ?? this.machine();
    const changed = Boolean(g?.root) && g.files > 0;
    return v_flex()
      .id("kt-details")
      .w(280)
      .p(6)
      .gap(2)
      .text_color(t.foreground)
      .track_focus(this.handle)
      .on_key_down((e, cx) => {
        if (!this.typing) return;
        const m = e.modifiers;
        if (e.key === "enter") this.commit(cx);
        else if (e.key === "escape") this.typing = false;
        else if (e.key === "backspace") this.message = this.message.slice(0, -1);
        else if (e.key_char && !m.control && !m.platform) this.message += e.key_char;
        else return;
        cx.stop_propagation();
        cx.notify();
      })
      .child(this.row(t, "td-where", "folder", tilde(g?.root ?? cwd), null, null))
      .when(!on && Boolean(g?.root ?? cwd), (el) => el.child(this.row(t, "td-open", "external-link", tr("openIn", { app: EDITOR_NAME }), null, (_e, cx) => this.openEditor(cx, g?.root ?? cwd))))
      .when(Boolean(g?.root), (el) =>
        el
          .child(div().mx(4).my(4).h(1).bg(t.border))
          .child(
            this.row(
              t,
              "td-branch",
              "git-branch",
              g.branch ?? "",
              // Its id carries the repo: another repo's count shows at once, not rolling.
              g.ahead > 0 ? roll({ reduced: Boolean(shared("kt.reducedMotion")) }, `td-ahead-${g.root}`, `↑${g.ahead}`, 15).font_family(MONO).text_size(11).text_color(t.dim) : null,
              null,
            ),
          )
          .child(
            this.row(
              t,
              "td-changes",
              "file-diff",
              changed ? tr("changes", { n: g.files }) : tr("noChanges"),
              changed
                ? h_flex()
                    .gap(6)
                    .font_family(MONO)
                    .text_size(11)
                    .child(div().text_color(t.ansi2).child(`+${g.add}`))
                    .child(div().text_color(t.ansi1).child(`−${g.del}`))
                : null,
              changed
                ? () => {
                    if (!shown(layout(), "panel")) run("layout.show", { id: "panel" });
                    run("layout.select", { stack: "panel-body", child: "diff" });
                  }
                : null,
            ),
          )
          .when(changed, (el) =>
            el.child(
              div()
                .id("td-message")
                .mx(4)
                .mt(4)
                .px(10)
                .py(7)
                .rounded(10)
                .border(1)
                .border_color(this.typing ? t.accent : t.border)
                .bg(t.background)
                .text_size(12)
                .cursor_text()
                .on_click((_e, cx) => {
                  this.typing = true;
                  this.handle.focus();
                  cx.notify();
                })
                .child(
                  this.message
                    ? div().text_color(t.foreground).child(this.message + (this.typing ? "▏" : ""))
                    : div().text_color(t.dim).child((this.typing ? "▏" : "") + tr("message")),
                ),
            ),
          )
          .child(
            h_flex()
              .px(4)
              .pt(6)
              .pb(2)
              .gap(6)
              .child(this.small(t, "td-commit", "Commit", (_e, cx) => this.commit(cx), changed, true))
              .child(this.small(t, "td-push", "Push", (_e, cx) => this.act(cx, "Push", [["git", ["push", "-u", "origin", "HEAD"]]]), !changed && (g.ahead > 0 || !g.upstream)))
              .child(this.small(t, "td-pr", "Pull request", (_e, cx) => this.act(cx, "Pull request", [["gh", ["pr", "create", "--fill", "--web"]]]), !changed)), // i18n: tech
          ),
      )
      .when(Boolean(this.note), (el) => el.child(div().px(8).pt(4).text_size(11).text_color(t.ansi1).child(this.note)));
  }
}
