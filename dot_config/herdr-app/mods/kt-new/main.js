// kbrdn Threads' new thread: what it's about, the project, the current
// checkout or a new worktree, and the agent. Enter starts it as a tab with
// the agent running in its terminal; you talk to it there.
//
// A new worktree follows gwm's convention (`gwm create <type> <issue> <desc>`:
// branch `<type>/#<issue>-<desc>`, folder per the repo's .gwm.toml, bootstrap
// included): type the thread as "#42 fix the login", pick the type, Enter.
// The dialog stays open while gwm works, then opens a space in the new
// worktree with the agent. gwm runs without a terminal: a repo whose
// .gwm.toml isn't trusted yet (`gwm trust add`) is refused, and the error
// shows here. ctrl+P project, ctrl+W checkout, ctrl+T type, ctrl+A agent,
// Esc closes.

import { View, div, svg } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { spaces, run, theme, props, closeOverlay, shared, setShared, exec } from "herdr";

const MONO = "Monaspace Krypton";
// Name on the chip, and the command. Edit to taste.
const AGENTS = [
  ["Claude", ["claude"]],
  ["Codex", ["codex"]],
  ["Pi", ["pi"]],
  ["Grok", ["grok"]],
  ["shell", null],
];
// gwm's branch types (`gwm types`).
const TYPES = ["feat", "fix", "hotfix", "docs", "test", "refactor", "chore", "perf", "ci", "build"];
const MAX_NAME = 48;
const kebab = (s) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
// "#42 fix the login" (or "42 fix the login") -> { issue: "42", desc: "fix the login" }.
const issueOf = (name) => {
  const m = name.trim().match(/^#?(\d+)\s+(.*\S)/);
  return m ? { issue: m[1], desc: m[2] } : null;
};
const lastLine = (s) => (s ?? "").trim().split("\n").filter(Boolean).pop() ?? "";

// Space colors, kept by space id in shared "space.colors" (the same code
// in every mod that colors spaces, so they agree).
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

export default class NewThread extends View {
  init(_props, cx) {
    this.name = "";
    this.project = 0;
    this.agent = Math.max(0, AGENTS.findIndex(([n]) => n === localStorage.getItem("agent")));
    this.type = Math.max(0, TYPES.indexOf(localStorage.getItem("type")));
    this.worktree = localStorage.getItem("worktree") === "yes";
    this.nudge = null; // "name" | "issue"
    this.busy = false;
    this.error = "";
    this.repos = {}; // folder -> { key, name, main } | null
    this.handle = cx.focus_handle();
    this.handle.focus();
    cx.spawn(async (cx) => {
      for (const s of spaces()) {
        try {
          const top = await exec("git", ["rev-parse", "--show-toplevel"], { cwd: s.folder, on: s.machine });
          const common = await exec("git", ["rev-parse", "--path-format=absolute", "--git-common-dir"], { cwd: s.folder, on: s.machine });
          if (top.code !== 0 || common.code !== 0) continue;
          const key = common.stdout.trim();
          const main = key.endsWith("/.git") ? key.slice(0, -5) : key;
          this.repos[JSON.stringify([s.machine ?? null, s.folder])] = { key: JSON.stringify([s.machine ?? null, key]), name: main.split("/").pop(), main: main === top.stdout.trim() };
        } catch {}
      }
      cx.notify();
    });
  }

  // One entry per project: its repo's main-checkout space (else the first),
  // the shown space's project first.
  projects() {
    const out = new Map();
    const list = spaces();
    const ordered = [...list.filter((s) => s.active), ...list.filter((s) => !s.active)];
    for (const s of ordered) {
      const r = this.repos[JSON.stringify([s.machine ?? null, s.folder])];
      const key = r?.key ?? s.id;
      const have = out.get(key);
      if (!have) out.set(key, { key, name: r?.name ?? s.name, space: s, git: Boolean(r) });
      else if (r?.main && !this.repos[JSON.stringify([have.space.machine ?? null, have.space.folder])]?.main) have.space = s;
    }
    return [...out.values()];
  }

  close() {
    closeOverlay(props().overlay);
  }

  start(cx) {
    if (this.busy) return;
    const name = this.name.trim();
    if (!name) {
      this.nudge = "name";
      return;
    }
    const p = this.projects()[this.project];
    if (!p) return;
    const [label, argv] = AGENTS[this.agent];
    localStorage.setItem("agent", label);
    localStorage.setItem("worktree", this.worktree ? "yes" : "no");
    if (!(this.worktree && p.git)) {
      this.close();
      run("tab.new", { space: p.space.id, argv: argv ?? undefined, name });
      return;
    }
    const spec = issueOf(name);
    if (!spec) {
      this.nudge = "issue";
      return;
    }
    const type = TYPES[this.type];
    localStorage.setItem("type", type);
    this.busy = true;
    this.error = "";
    const on = p.space.machine ?? undefined;
    const repo = p.space.folder || undefined;
    // Closing this dialog would cancel the task: it closes itself once the space is open.
    cx.spawn(async (cx) => {
      try {
        const made = await exec("gwm", ["create", type, spec.issue, spec.desc], { cwd: repo, on, timeout: 600000 });
        if (made.code !== 0) throw new Error(lastLine(made.stderr) || lastLine(made.stdout) || `gwm create exited ${made.code}`);
        // gwm prints "✓ worktree created at <path>"; else ask it where.
        let path = made.stdout.match(/worktree created at (.+)$/m)?.[1]?.trim();
        if (!path) {
          const where = await exec("gwm", ["path", `${type}-${spec.issue}`], { cwd: repo, on });
          if (where.code === 0) path = where.stdout.trim();
        }
        if (!path) throw new Error("gwm made the worktree but didn't say where; open it with gwm path");
        run("space.new", { folder: path, tab: spec.desc, argv: argv ?? undefined, machine: p.space.machine ?? "" });
        this.close();
      } catch (error) {
        this.busy = false;
        this.error = String(error?.message ?? error);
        cx.notify();
      }
    });
  }

  // A choice; the picked one sits on the kbrdn.dev ink (transparent border elsewhere: no shift).
  chip(t, id, label, on, onClick, color) {
    return h_flex()
      .id(id)
      .h(26)
      .gap(6)
      .items_center()
      .px(10)
      .rounded(10)
      .border(1)
      .border_color(on ? t.accent + "66" : t.accent + "00")
      .bg(on ? t.accent + "24" : t.raised)
      .font_family(MONO)
      .text_size(11)
      .text_color(on ? t.accent : t.muted)
      .cursor_pointer()
      .hover((s) => s.text_color(on ? t.accent : t.foreground))
      .on_click(onClick)
      .when(Boolean(color), (el) => el.child(div().w(8).h(8).rounded(2).bg(color)))
      .child(label.toUpperCase());
  }

  render() {
    const t = theme();
    const ps = this.projects();
    this.project = Math.min(this.project, Math.max(0, ps.length - 1));
    const p = ps[this.project];
    const git = Boolean(p?.git);
    const tree = git && this.worktree;
    const spec = tree ? issueOf(this.name) : null;
    const key = (k) => div().px(5).rounded(4).border(1).border_color(t.border).text_color(t.dim).child(k);
    const hint = (k, what) => h_flex().gap(5).items_center().child(key(k)).child(div().child(what));
    // kbrdn.dev `.eyebrow` labels.
    const row = (label, ...chips) =>
      h_flex()
        .gap(6)
        .items_center()
        .flex_wrap()
        .child(div().w(84).flex_none().font_family(MONO).text_size(11).text_color(t.muted).child(label.toUpperCase()))
        .children(chips);
    const pick = (field, i) => (_e, cx) => {
      this[field] = i;
      cx.notify();
    };
    const placeholder = tree ? `#issue what should we build${p ? ` in ${p.name}` : ""}?` : `What should we build${p ? ` in ${p.name}` : ""}?`;
    const nudge = this.nudge === "issue" ? "A new worktree needs an issue: “#42 fix the login”" : null;
    return v_flex()
      .id("kt-new")
      .track_focus(this.handle)
      .w_full()
      .bg(t.popover)
      .on_key_down((e, cx) => {
        const k = e.key;
        const m = e.modifiers;
        if (k === "escape") return this.close();
        if (this.busy) return;
        if (k === "enter") this.start(cx);
        else if (k === "p" && m.control) this.project = (this.project + 1) % Math.max(1, ps.length);
        else if (k === "a" && m.control) this.agent = (this.agent + 1) % AGENTS.length;
        else if (k === "w" && m.control) this.worktree = !this.worktree;
        else if (k === "t" && m.control) this.type = (this.type + 1) % TYPES.length;
        else if (k === "backspace") this.name = this.name.slice(0, -1);
        else if (e.key_char && !m.control && !m.alt) {
          if (this.name.length < MAX_NAME) this.name += e.key_char;
          this.nudge = null;
        } else return;
        cx.stop_propagation();
        cx.notify();
      })
      .child(
        div()
          .px(18)
          .pt(18)
          .pb(14)
          .text_size(20)
          .border_b(1)
          .border_color(t.border)
          .child(
            this.name
              ? div().text_color(t.foreground).child(this.name + "▏")
              : div()
                  .text_color(this.nudge === "name" ? t.blocked : t.dim)
                  .child(`▏${placeholder}`),
          ),
      )
      .child(
        v_flex()
          .px(18)
          .py(12)
          .gap(10)
          .border_b(1)
          .border_color(t.border)
          .text_size(12)
          .child(row("Project", ...ps.map((x, i) => this.chip(t, `kt-n-p${i}`, x.name, i === this.project, pick("project", i), spaceColor(t, x.space)))))
          .when(git, (el) =>
            el.child(
              row(
                "Checkout",
                this.chip(t, "kt-n-cur", "Current checkout", !this.worktree, pick("worktree", false)),
                this.chip(t, "kt-n-wt", "New worktree", this.worktree, pick("worktree", true)),
              ),
            ),
          )
          .when(tree, (el) => el.child(row("Type", ...TYPES.map((n, i) => this.chip(t, `kt-n-t${i}`, n, i === this.type, pick("type", i))))))
          .child(row("Agent", ...AGENTS.map(([n], i) => this.chip(t, `kt-n-a${i}`, n, i === this.agent, pick("agent", i))))),
      )
      .when(Boolean(nudge || this.error), (el) =>
        el.child(
          div()
            .px(18)
            .pt(9)
            .text_size(12)
            .text_color(this.error ? t.ansi1 : t.blocked)
            .child(this.error || nudge),
        ),
      )
      .child(
        h_flex()
          .px(18)
          .py(9)
          .gap(16)
          .items_center()
          .text_size(11)
          .text_color(t.dim)
          .when(this.busy, (el) =>
            el.child(
              h_flex()
                .gap(6)
                .items_center()
                .font_family(MONO)
                .text_color(t.working)
                .child(svg("mods/workspace-chrome/spinner.svg").size(12).spin(900))
                .child("GWM CREATE…"),
            ),
          )
          .when(!this.busy, (el) =>
            el
              .child(hint("ctrl+p", "project"))
              .when(git, (el) => el.child(hint("ctrl+w", "checkout")))
              .when(tree, (el) => el.child(hint("ctrl+t", "type")))
              .child(hint("ctrl+a", "agent"))
              .child(hint("esc", "cancel")),
          )
          .child(div().flex_1())
          .when(Boolean(spec), (el) => el.child(div().min_w(0).truncate().font_family(MONO).child(`${TYPES[this.type]}/#${spec.issue}-${kebab(spec.desc)}`)))
          // kbrdn.dev primary button: solid ink, round.
          .child(
            div()
              .id("kt-n-start")
              .flex_none()
              .h(26)
              .px(12)
              .flex()
              .items_center()
              .rounded_full()
              .bg(this.busy ? t.raised : t.solid)
              .text_color(this.busy ? t.dim : t.solid_foreground)
              .font_family(MONO)
              .text_size(11)
              .cursor_pointer()
              .on_click((_e, cx) => {
                this.start(cx);
                cx.notify();
              })
              .child("START ↵"),
          ),
      );
  }
}
