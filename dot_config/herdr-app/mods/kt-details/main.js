// kbrdn Threads' thread details: a card floating over the terminal's top
// right, shown by the header's details toggle (shared "kt.details"). For the
// shown thread's folder: where it is, open it in Zed, the branch, what
// changed (click: the right panel's diff), and commit / push / pull request
// (`git`, `gh`). Commit stages everything (`git add -A`). An example: change
// EDITOR, the buttons, or what a commit does.

import { View, div, svg } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { spaces, panes, run, shared, exec as hostExec, home, theme, checking } from "herdr";
import { bump, gitTopics, refreshOn } from "./bus.js";
import { makeT } from "./i18n.js";
import strings from "./strings.js";
// kt-keys' roll.js (a byte-identical copy): the commits ahead roll to their new count.
import { roll } from "./roll.js";
// kt-keys' motion.js (a byte-identical copy): the card fades in, the repo's block comes in, the message
// field opens and closes on its height (ANIMATIONS.md).
import { motionState, frame, enter, collapse } from "./motion.js";
import { skeleton, readyFor } from "./skeleton.js";
// kt-keys' machines.js (a byte-identical copy, with machines.strings.js): a remote folder's machine away
// refuses the read at once and says so (notice), and a remote folder is read every 20 s at most (#62).
import { guard, isOffline, reachable, due, notice, localOnly } from "./machines.js";

const tr = makeT(strings);
const exec = guard(hostExec);
const REMOTE_EVERY = 20e3;

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

export default class Details extends View {
  init(_props, cx) {
    this.git = null; // { root, on, branch, add, del, files, ahead, upstream }
    this.message = "";
    this.typing = false;
    this.busy = "";
    this.note = "";
    this.handle = cx.focus_handle();
    this.motion = motionState();
    this.refresh(cx);
    // A remote folder: the bus and a change of thread read at once; this tick only every 20 s (DATA-SYNC.md).
    cx.timer.every(4000, (cx) => { if (due(this.machine(), this.readAt, REMOTE_EVERY)) this.refresh(cx); });
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
    this.readAt = Date.now();
    cx.spawn(async (cx) => {
      try {
        const top = await exec("git", ["rev-parse", "--show-toplevel"], { cwd, on });
        this.offline = null; // the machine answered
        // this.readFor: the place the card's data was read for, set with it (readyFor), a failure too.
        if (top.code !== 0) { this.git = { root: null, on }; this.readFor = key; }
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
          this.readFor = key;
        }
      } catch (error) {
        // The machine away (machines.js): its notice, not a raw error.
        this.offline = isOffline(error);
        this.git = null; this.note = this.offline ? "" : String(error); this.readFor = key;
      }
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
      } catch (error) {
        this.offline = isOffline(error);
        if (!this.offline) this.note = String(error);
      }
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
    const cwd = this.folder();
    // Read for this folder (readyFor): before the first read, and after a change of thread until its own
    // read answers (read now, not at the next 4 s tick), the repo's block as bars, never the previous
    // repo's path, branch, changes or buttons (they would act there). No folder: nothing to read.
    const ready = readyFor(this.readFor, cwd ? JSON.stringify([this.machine(), cwd]) : null);
    if (!ready) this.refresh(cx);
    // Another mod's action on this repo, or an agent of this space that stopped working: read again.
    const sp = spaces().find((s) => s.active)?.id;
    refreshOn(this, cx, "git", [...gitTopics(this.git?.root ?? null), ...(sp ? [`agent:${sp}`] : [])], async (cx) => this.refresh(cx));
    // The folder's machine was away (machines.js): back now (kt.machines or machines() moved), read at once.
    const off = this.offline && this.offline === this.machine() ? this.offline : null;
    if (off && !checking() && reachable(off)) { this.offline = null; this.refresh(cx); }
    const t = theme();
    const away = off ? notice(t, off, { id: "td-offline" }) : null;
    const g = ready && cwd ? this.git : null;
    // The machine the card's folder is on: the editor only opens folders on this computer.
    const on = g?.on ?? this.machine();
    const changed = Boolean(g?.root) && g.files > 0;
    const m = frame(this.motion, Boolean(shared("kt.reducedMotion")));
    // The commit message field: a builder, so it folds back too when the tree is clean again.
    const message = g?.root ? collapse(m, "td-message-fold", changed, () => div()
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
      ), { cx }) : null;
    // The card fades in where it floats (no rise: Herdr's frame around it would not move with it).
    return enter(m, v_flex().w(280).p(6).gap(2).text_color(t.foreground), "kt-details", { dy: 0 })
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
      // On another machine: the same row, dimmed, saying why it doesn't open.
      .when(Boolean(on) && Boolean(g?.root ?? cwd), (el) => el.child(this.row(t, "td-open", "external-link", tr("openIn", { app: EDITOR_NAME }), null, null)
        .opacity(0.5).tooltip(localOnly(on))))
      .when(Boolean(away), (el) => el.child(div().px(4).pt(4).child(away)))
      // Not read for this folder yet: the repo's block as bars (skeleton.js), breathing: the rule, the
      // branch and changes rows (32 px), the buttons (26 px).
      .when(!ready, (el) => el.child(((S) => S.pulse(v_flex().id("td-git-sk").gap(2)
        .child(div().mx(4).my(4).h(1).bg(t.border))
        .child(S.list(2, { h: 32, icon: 15, lines: [0.4] }))
        .child(div().flex().px(4).pt(6).pb(2).gap(6).children([64, 48, 96].map((w) => S.block(w, 26, { r: 8 }))))))(skeleton(t, m))))
      // The repo's block comes in once read (again for another repo); inside, the message field opens and
      // closes on its height (collapse with a builder), the one height level of the card.
      .when(Boolean(g?.root), (el) => el.child(enter(m, v_flex()
          .gap(2)
          .child(div().mx(4).my(4).h(1).bg(t.border))
          .child(
            this.row(
              t,
              "td-branch",
              "git-branch",
              g.branch ?? "",
              // Its id carries the repo: another repo's count shows at once, not rolling.
              g.ahead > 0 ? roll(m, `td-ahead-${g.root}`, `↑${g.ahead}`, 15).font_family(MONO).text_size(11).text_color(t.dim) : null,
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
                // kt-head shows the panel on Changes (ctrl-b d's way): its content glides in if it was hidden (#73).
                ? () => run("kt-head.panel:diff")
                : null,
            ),
          )
          .when(Boolean(message), (el) => el.child(message))
          .child(
            h_flex()
              .px(4)
              .pt(6)
              .pb(2)
              .gap(6)
              .child(this.small(t, "td-commit", "Commit", (_e, cx) => this.commit(cx), changed, true))
              .child(this.small(t, "td-push", "Push", (_e, cx) => this.act(cx, "Push", [["git", ["push", "-u", "origin", "HEAD"]]]), !changed && (g.ahead > 0 || !g.upstream)))
              // --web opens a browser where gh runs: on another machine, not on this screen.
              .child(this.small(t, "td-pr", "Pull request", (_e, cx) => this.act(cx, "Pull request", [["gh", ["pr", "create", "--fill", "--web"]]]), !changed && !g.on) // i18n: tech
                .when(Boolean(g.on), (el) => el.tooltip(localOnly(g.on)))),
          ), `td-git-${g.root}`, { dy: 0 })),
      )
      .when(Boolean(this.note), (el) => el.child(enter(m, div().px(8).pt(4).text_size(11).text_color(t.ansi1).child(this.note), `td-note-${this.note}`, { dy: 0 })));
  }
}
