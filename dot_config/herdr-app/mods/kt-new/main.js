// kbrdn Threads' new thread: what it's about, the project, the current
// checkout or a new worktree, and the agent. Enter starts it as a tab with
// the agent running in its terminal; you talk to it there.
//
// A new worktree goes through gwm (folder per the repo's .gwm.toml, bootstrap included). "#42"
// (or "#42 fix the login") is `gwm create --issue 42`: type and description from the issue, and
// a worktree that already carries the number is opened again (its space if one is open). A type
// picked here is passed as `--type`; picked with a description, or for an issue the forge doesn't
// know, it's the triple `gwm create <type> 42 <desc>` (branch `<type>/#42-<desc>`). Always
// `--reuse-branch`: a local branch of that name without a worktree is taken back. Typing "#N" in a
// git project picks « Nouveau worktree » until the person picks the checkout themselves. The
// dialog stays open while gwm works, then opens the worktree with the agent, the thread as its
// first message (`task`, for the agents that take one). gwm runs without a terminal, so a
// .gwm.toml not yet trusted is refused: the dialog shows the file whole, and « Approuver » asks
// kt-confirm (danger), whose `kt-new.trust` runs `gwm trust add` on the file as shown, then the
// creation again. Never `--allow-bootstrap`. ctrl+P project, ctrl+W checkout, ctrl+T type, ctrl+A
// agent (in both modes, before vim's keys).
//
// Keys (vim.js): it opens typing the thread (INSERT). There ctrl-n / ctrl-j / ↓
// and ctrl-k / ↑ move the rows' cursor (Projet, Checkout, Type, Agent), tab /
// shift-tab change the cursor row's pick, Enter starts, Esc goes to NORMAL (the
// dialog stays). NORMAL: j / k (↓ ↑), gg / G move the cursor; h / l and tab /
// shift-tab change its pick; enter or o starts; / or a click on the field types
// again; q or esc closes; ? the keys (kt-keys, Modales). `kt-new.key:<keys>`
// feeds keys ("escape j l", "h e l l o"), for tests.
//
// The consigne: a multi-line field under the name, apart from it. The name stays short (the tab, the
// branch: 48 characters); the consigne, when there is one, goes whole to the agent as its first message
// (`task`), worktree or not. ctrl+O or a click puts the typing in it; there enter is a new line and
// cmd+enter / ctrl+enter starts. The agent is always its own CLI (`argv`), run in the terminal under the
// person's login: nothing here relays the model's calls.
// The consigne completes Claude Code's `/name`s (skills.js): `/` at a line's start or after a space
// lists the skills and commands Claude Code loads (personal, the selected project's .claude, the
// enabled plugins), filtered as typed; ↓ ↑ / ctrl-n ctrl-p move, tab or enter completes, esc closes.
// Read once per opening (files re-read only when their mtime moved); Claude only, the other agents
// say so. Its head carries the agent (a click or ctrl+A, both modes). The Workflow row (ctrl+F, both
// modes) prefills the consigne with an installed workflow's `/name ` (skills.js presets), libre takes
// it off; picking one picks Claude. A workflow leading the consigne (Claude) owns the checkout: it
// opens its own issue, and the worktree ones make it with gwm, so kt-new runs no gwm and starts it
// in the project's main checkout; the Checkout row says which (skills.js checkoutOf).
// Props (kt-kanban's « Lancer » on a draft, kt-head's ctrl-b shift-g): { worktree, name, task, project
// (a space id: its project picked), agent ("claude", "codex", "vibe"), draft }. Nothing starts without
// the person's Enter. With `draft`, the thread made is recorded in shared "kt.kanban.launched" ({ draft,
// tab, space, folder, machine, at }): the Kanban then lets the draft go and puts its cursor on the thread.

import { View, div, svg } from "gpui-kit";
import { v_flex, h_flex, ScrollHandle } from "gpui-base";
import { spaces, run, theme, props, closeOverlay, shared, setShared, exec, settings, openOverlay, nextCommand, checking, home, readTextFile } from "herdr";
import { Vim, keyOf, keysOf, step } from "./vim.js";
import { motionState, frame, sheet, leave, sharpen } from "./motion.js";
import { issueOf, firstMessage, firstTask, startCommand, plan, retry, TRUST, where, explain } from "./gwm.js";
import { ditherBand, TOP } from "./dither.js";
import { bump, gitTopics } from "./bus.js";
import { ORDER, scan, fit, suggest, insert, presets, leading, withWorkflow, checkoutOf } from "./skills.js";
import { makeT } from "./i18n.js";
import strings from "./strings.js";

const tr = makeT(strings);
// The skills' last list and each file's entry by its mtime, kept from one opening to the next (module
// code outlives the dialog): an opening shows the last list at once and re-reads only changed files.
const memo = { list: [], files: new Map() };
const MONO = "Monaspace Krypton";
const I = (name) => `mods/kt-threads/${name}.svg`;
const tilde = (p) => (p && p.startsWith(home()) ? `~${p.slice(home().length)}` : p ?? "");
// The dialog is the whole window (mod.json): the card keeps its 680 px.
const CARD = 680;
// A color with alpha `a`, replacing any it has (glass themes are #rrggbbaa).
const alpha = (c, a) => `${String(c).slice(0, 7)}${a}`;
const veil = () => (settings().dark ? alpha("#000000", "8c") : alpha("#0a0a0a", "59"));
// Name on the chip, the command, and whether it takes the thread as its first message (`task`:
// Herdr appends it to the command, `claude "<text>"`). Edit to taste.
const AGENTS = [
  ["Claude", ["claude"], true],
  ["Codex", ["codex"], true],
  // Mistral Vibe: `vibe [PROMPT]` opens the interactive session on its first message, so it takes `task`.
  ["Vibe", ["vibe"], true],
  ["shell", null, false],
];
// gwm's branch types (`gwm types`).
const TYPES = ["feat", "fix", "hotfix", "docs", "test", "refactor", "chore", "perf", "ci", "build"];
const MAX_NAME = 48;
const kebab = (s) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
const lastLine = (s) => (s ?? "").trim().split("\n").filter(Boolean).pop() ?? "";

// The project's color as kt-confirm reads it: its registry entry's (kt-projects: a theme name or
// #hex, same machine, its folder or one under it), else its space's ("space.colors"), else none.
function projectTint(s) {
  const e = (shared("kt.projects") ?? []).find((x) => (x.machine ?? null) === (s.machine ?? null) && x.folder && (s.folder === x.folder || s.folder?.startsWith(`${x.folder}/`)));
  return e?.color ?? (shared("space.colors") ?? {})[s.id] ?? null;
}

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
    const p = props() ?? {};
    this.name = String(p.name ?? "").trim().slice(0, MAX_NAME);
    this.task = String(p.task ?? ""); // the consigne (multi-line)
    this.field = "name"; // where the typing goes: "name" | "task"
    this.draft = typeof p.draft === "string" ? p.draft : null; // kt-kanban's draft being launched
    this.project = 0;
    // props.project: a space id, its project picked once the projects are known (projects()).
    this.wantProject = typeof p.project === "string" ? p.project : null;
    // props.agent: the agent's name or command ("claude"), else the last one picked.
    const asked = String(p.agent ?? "").toLowerCase();
    const byProp = asked ? AGENTS.findIndex(([n, argv]) => n.toLowerCase() === asked || argv?.[0] === asked) : -1;
    this.agent = byProp >= 0 ? byProp : Math.max(0, AGENTS.findIndex(([n]) => n === localStorage.getItem("agent")));
    this.type = Math.max(0, TYPES.indexOf(localStorage.getItem("type")));
    // props.worktree (ctrl-b shift-g, kt-head; a draft's launch): a new worktree this time.
    this.worktree = p.worktree === true || localStorage.getItem("worktree") === "yes";
    this.base = this.worktree; // the checkout before "#N" picks a worktree
    this.chose = false; // the person picked the checkout: "#N" no longer changes it
    this.typeChosen = false; // the person picked the type: passed to gwm
    this.nudge = null; // "name" | "issue"
    this.busy = false; // the gwm command running, shown
    this.error = null; // { title, text, raw }: gwm's last refusal
    this.trust = null; // { file, text, on, repo, changed? }: a .gwm.toml gwm won't run untrusted
    this.scanned = false; // the spaces' repos are known
    this.repos = {}; // folder -> { key, name, main, top } | null
    this.skills = memo.list; // what `/` completes (skills.js invocable)
    this.loading = true; // the skills' scan of this opening is running
    this.pick = 0; // the completion's highlighted entry
    this.shut = null; // the consigne as it was when esc closed the completion: closed while unchanged
    this.handle = cx.focus_handle();
    this.handle.focus();
    this.motion = motionState(); // ANIMATIONS.md: the veil fades and the card rises, in and out (motion.js sheet, leave)
    this.done = null; // the projects when the thread was made: the dialog is leaving, nothing runs twice
    // Keys (vim.js): typing the thread first; `at` is the row the cursor is on.
    this.vim = new Vim({ field: true, insert: true });
    this.at = "project";
    // The project and type groups scroll sideways when they're longer than the dialog.
    this.scrolls = { project: ScrollHandle.new(), type: ScrollHandle.new(), flow: ScrollHandle.new(), complete: ScrollHandle.new() };
    if (!checking()) cx.spawn(async (cx) => {
      for (;;) {
        const c = await nextCommand();
        if (c.startsWith("key:")) {
          this.handle.focus();
          for (const k of keysOf(c.slice(4))) this.press(k, cx);
        }
        // kt-confirm's answer to « Approuver » (askTrust).
        if (c === "trust") {
          this.handle.focus();
          this.approve(cx);
        }
        cx.notify();
      }
    });
    cx.spawn(async (cx) => {
      for (const s of spaces()) {
        try {
          const top = await exec("git", ["rev-parse", "--show-toplevel"], { cwd: s.folder, on: s.machine });
          const common = await exec("git", ["rev-parse", "--path-format=absolute", "--git-common-dir"], { cwd: s.folder, on: s.machine });
          if (top.code !== 0 || common.code !== 0) continue;
          const key = common.stdout.trim();
          const main = key.endsWith("/.git") ? key.slice(0, -5) : key;
          this.repos[JSON.stringify([s.machine ?? null, s.folder])] = { key: JSON.stringify([s.machine ?? null, key]), name: main.split("/").pop(), main: main === top.stdout.trim(), top: top.stdout.trim() };
        } catch {}
      }
      this.scanned = true;
      // "#N" typed before the scan knew the project was a repo.
      this.guessCheckout();
      cx.notify();
      // The skills, once the projects' roots are known (their .claude).
      if (checking()) return;
      await this.loadSkills();
      cx.notify();
    });
  }

  // The skills Claude Code loads (skills.js scan): one rg + stat, then only the files whose mtime moved.
  // Local projects only: a remote space's files are on that machine.
  async loadSkills() {
    try {
      const projects = Object.entries(this.repos).filter(([k, r]) => r && JSON.parse(k)[0] === null).map(([, r]) => r.top);
      memo.list = await scan({ home: home(), projects, exec, read: (p) => readTextFile(p), cache: memo.files });
      this.skills = memo.list;
    } catch {} // the last list stays
    this.loading = false;
  }

  // The selected project's git root, for its own .claude skills.
  projectTop() {
    const s = this.projects()[this.project]?.space;
    return s ? this.repos[JSON.stringify([s.machine ?? null, s.folder])]?.top ?? null : null;
  }

  claude() {
    return AGENTS[this.agent]?.[1]?.[0] === "claude";
  }

  // The workflow presets' names, as installed (ORDER until the first scan of this machine is in).
  flowNames() {
    return this.skills.length ? presets(this.skills).map((e) => e.name) : ORDER;
  }

  // The workflow the consigne starts with, for Claude; in a git project, it owns the checkout.
  flow() {
    return this.claude() ? leading(this.task, this.flowNames()) : null;
  }
  owner() {
    return this.projects()[this.project]?.git ? this.flow() : null;
  }

  // A workflow preset (null: libre) in place of the consigne's leading one; one picked is Claude's, and
  // the typing goes to the consigne for what follows it.
  setFlow(name) {
    this.task = withWorkflow(this.task, name, this.flowNames());
    if (name) this.agent = Math.max(0, AGENTS.findIndex(([, argv]) => argv?.[0] === "claude"));
    this.field = "task";
    this.vim.edit();
    this.shut = null;
  }

  // ctrl+f: the next preset after the consigne's (libre after the last).
  cycleFlow() {
    const seq = [null, ...this.flowNames()];
    const at = seq.indexOf(this.flow()); // the lit one: libre for Codex, Vibe, the shell
    const next = seq[(at + 1) % seq.length];
    this.setFlow(next);
    if (next) this.scrolls.flow.scroll_to_item(seq.indexOf(next));
  }

  // The completion under the consigne while a `/word` is typed at its end (INSERT): skills.js suggest,
  // { q, items, note }; Codex, Vibe and the shell get a note (strings.js' complete.<note>).
  completion() {
    if (this.field !== "task" || !this.vim.insert || this.busy) return null;
    return suggest(this.skills, this.task, AGENTS[this.agent][1]?.[0] ?? null, { project: this.projectTop(), loading: this.loading, shut: this.shut });
  }

  // One entry per project: its repo's main-checkout space (else the first),
  // the shown space's project first. Once the thread is made, as they were then: its space is shown
  // at once and would come first while the card leaves.
  projects() {
    if (this.done) return this.done;
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

  // Not `close()`: Herdr calls a View's close() when the mod reloads or the overlay goes.
  // motion.js leave(): the veil fades out and the card sinks, then the dialog closes.
  dismiss(cx) {
    leave(this.motion, cx, "kn", () => closeOverlay(props().overlay));
  }

  // The rows the cursor walks, as shown: Checkout only in a git project, Type only for a worktree;
  // neither while a workflow owns the checkout (its row is a fact then).
  fields() {
    const git = Boolean(this.projects()[this.project]?.git) && !this.owner();
    return ["project", ...(git ? ["worktree"] : []), ...(git && this.worktree ? ["type"] : []), "agent"];
  }

  // A row's next (d = 1) or previous pick, round; its group scrolls to it.
  cycle(field, d) {
    if ((field === "worktree" || field === "type") && this.owner()) return; // the workflow's
    if (field === "worktree") this.choose("worktree", !this.worktree);
    else {
      const n = Math.max(1, { project: this.projects().length, type: TYPES.length, agent: AGENTS.length }[field]);
      this.choose(field, (this[field] + d + n) % n);
      this.scrolls[field]?.scroll_to_item(this[field]);
    }
  }

  // A row's pick, by key or click: the checkout and the type are the person's from then on; another
  // project forgets the last refusal (it was about that repo).
  choose(field, value) {
    this[field] = value;
    if (field === "worktree") this.chose = true;
    if (field === "type") this.typeChosen = true;
    if (field === "project") {
      this.wantProject = null; // the person's pick wins over props.project
      this.error = null;
      this.trust = null;
      this.guessCheckout();
    }
  }

  // props.project (a space id): its project's entry, by the space itself, else (the repos known) by its
  // repo; let go once the repos are known (or the space is gone).
  pickWanted() {
    if (!this.wantProject || this.done) return;
    const s = spaces().find((x) => x.id === this.wantProject);
    const r = s ? this.repos[JSON.stringify([s.machine ?? null, s.folder])] : null;
    const i = this.projects().findIndex((x) => x.space.id === this.wantProject || (r && x.key === r.key));
    if (i >= 0) this.project = i;
    if (this.scanned || !s) {
      this.wantProject = null;
      this.guessCheckout();
    }
  }

  // "#N" typed in a git project: a new worktree, back to the checkout before once it's gone; the
  // person's own pick wins.
  guessCheckout() {
    if (this.chose) return;
    this.worktree = (/^#\d/.test(this.name.trim()) && Boolean(this.projects()[this.project]?.git)) || this.base;
  }

  // gwm's arguments for an issue (gwm.js).
  gwmArgs(spec) {
    return plan(spec, TYPES[this.type], this.typeChosen);
  }

  key(e, cx) {
    if (!this.press(e, cx)) return; // not ours: ctrl-b, cmd-* go on
    cx.stop_propagation();
    cx.notify();
  }

  // One key, from the keyboard or `key:` (a name): the open completion's first (it takes ↓ ↑, ctrl-n /
  // p / j / k, tab, enter and esc), then ctrl+p / w / t / a / f (both modes, as before), then vim's.
  press(e, cx) {
    const c = this.completion();
    if (c) {
      const n = keyOf(e).name;
      if (n === "escape") {
        this.shut = this.task;
        return true;
      }
      const k = c.items.length;
      const by = ["down", "ctrl-n", "ctrl-j"].includes(n) ? 1 : ["up", "ctrl-p", "ctrl-k", "shift-tab"].includes(n) ? -1 : 0;
      if (k && by) {
        this.pick = (Math.min(this.pick, k - 1) + by + k) % k;
        this.scrolls.complete.scroll_to_item(this.pick);
        return true;
      }
      if (k && (n === "tab" || n === "enter")) {
        this.task = insert(this.task, c.items[Math.min(this.pick, k - 1)].name);
        this.pick = 0;
        return true;
      }
    }
    if (keyOf(e).name === "ctrl-f" && !this.busy) {
      this.cycleFlow();
      return true;
    }
    const chord = { "ctrl-p": "project", "ctrl-w": "worktree", "ctrl-t": "type", "ctrl-a": "agent" }[keyOf(e).name];
    if (keyOf(e).name === "ctrl-e" && !this.busy) {
      this.blank(cx);
      return true;
    }
    // The consigne: ctrl+o puts the typing in it (again: back to the name); there enter is a new line,
    // cmd+enter or ctrl+enter starts.
    const name = keyOf(e).name;
    if (name === "ctrl-o" && !this.busy) {
      this.field = this.field === "task" ? "name" : "task";
      this.vim.edit();
      return true;
    }
    if ((name === "cmd-enter" || name === "ctrl-enter") && !this.busy) {
      this.start(cx);
      return true;
    }
    if (name === "enter" && this.field === "task" && this.vim.insert && !this.busy) {
      this.task += "\n";
      return true;
    }
    if (chord && !this.busy) {
      this.cycle(chord, 1);
      return true;
    }
    return this.act(this.vim.handle(e), cx);
  }

  // One vim action; false: not one the dialog has. While gwm works, only closing.
  act(a, cx) {
    if (!a) return false;
    if (a === "escape" || a === "quit") this.dismiss(cx);
    else if (a === "normal" || a === "filter" || a === "pending" || a === "count") {} // the mode changed, or a gg on its way
    else if (this.busy) return false;
    else if (a === "submit" || a === "open") this.start(cx);
    else if (a === "type" && this.field === "task") {
      this.task += this.vim.char;
      this.pick = 0;
    } else if (a === "backspace" && this.field === "task") {
      this.task = this.task.slice(0, -1);
      this.pick = 0;
    }
    else if (a === "type") {
      if (this.name.length < MAX_NAME) this.name += this.vim.char;
      this.nudge = null;
      this.guessCheckout();
    } else if (a === "backspace") {
      this.name = this.name.slice(0, -1);
      this.guessCheckout();
    } else if (["down", "up", "top", "bottom", "half-down", "half-up"].includes(a)) {
      const f = this.fields();
      this.at = f[step(a, Math.max(0, f.indexOf(this.at)), f.length, this.vim.count, 4)];
    } else if (a === "left" || a === "right" || a === "tab-next" || a === "tab-prev") this.cycle(this.at, a === "left" || a === "tab-prev" ? -1 : 1);
    else if (a === "help") openOverlay({ mod: "kt-keys", kind: "dialog", width: 1, height: 1, frame: "none", props: { group: "modals" } });
    else return false;
    return true;
  }

  // An empty thread: a plain terminal in the chosen project's folder, no agent, no name, no worktree.
  blank(cx) {
    if (this.busy || this.done) return;
    const p = this.projects()[this.project];
    if (!p) return;
    this.done = this.projects();
    run("layout.select", { stack: "view", child: "thread" });
    run("tab.new", { space: p.space.id, ...(p.space.folder ? { folder: p.space.folder } : {}) });
    this.dismiss(cx);
  }

  start(cx) {
    if (this.busy || this.done) return;
    // A .gwm.toml waiting for approval: Enter (or Start) asks for it; unreadable here, Start tries
    // again (approved from a terminal meanwhile).
    if (this.trust?.text != null) return this.askTrust();
    this.trust = null;
    const name = this.name.trim();
    // No name with the shell picked (and no worktree to make): that's an empty thread.
    if (!name && AGENTS[this.agent]?.[1] === null && !this.worktree) return this.blank(cx);
    if (!name) {
      this.nudge = "name";
      return;
    }
    const p = this.projects()[this.project];
    if (!p) return;
    const [label, argv, prompt] = AGENTS[this.agent];
    localStorage.setItem("agent", label);
    // Remembered only when the person picked it (a "#N" guess isn't a preference).
    if (this.chose) localStorage.setItem("worktree", this.worktree ? "yes" : "no");
    // The first message: the consigne whole, else the name (gwm.js firstTask).
    const task = firstTask({ name, consigne: this.task, prompt });
    // kbrdn-threads' main "view" stack: show the thread (⌘T may come from the Inbox page).
    const show = () => run("layout.select", { stack: "view", child: "thread" });
    // The command (gwm.js startCommand), run; a draft launched is recorded for the Kanban.
    const go = (c) => {
      run(c.name, c.args);
      if (this.draft) setShared("kt.kanban.launched", { draft: this.draft, tab: c.args.name ?? c.args.tab, space: c.name === "tab.new" ? c.args.space : null,
        folder: c.args.folder ?? null, machine: p.space.machine ?? null, at: Date.now() });
    };
    // A workflow leading the consigne makes its own issue (and worktree): the project's checkout, no gwm here.
    if (!(this.worktree && p.git) || this.owner()) {
      this.done = this.projects();
      show();
      go(startCommand({ space: p.space.id, argv, name, task }));
      this.dismiss(cx);
      return;
    }
    const spec = issueOf(name);
    if (!spec) {
      this.nudge = "issue";
      return;
    }
    const type = TYPES[this.type];
    if (this.typeChosen) localStorage.setItem("type", type);
    const { first, triple } = this.gwmArgs(spec);
    this.error = null;
    const on = p.space.machine ?? undefined;
    const repo = p.space.folder || undefined;
    // Closing this dialog would cancel the task: it closes itself once the space is open.
    cx.spawn(async (cx) => {
      try {
        // `--issue`, then what gwm's refusal calls for (gwm.js retry): `--type`, the triple, or nothing.
        let made;
        for (let args = first; args; args = made.code !== 0 ? retry(made.all, args, { first, triple }, type, this.typeChosen) : null) {
          this.busy = `gwm ${args.join(" ")}`;
          cx.notify();
          const r = await exec("gwm", args, { cwd: repo, on, timeout: 600000 });
          made = { ...r, all: `${r.stdout ?? ""}\n${r.stderr ?? ""}` };
        }
        // A worktree made, even if a hook or the bootstrap failed after it (DATA-SYNC.md). Only the
        // last try can have made one: retry() stops once "worktree created at" is printed.
        const madeAt = made.all.match(/^✓ worktree created at (.+)$/m)?.[1]?.trim();
        if (madeAt) bump("gwm", ...gitTopics(madeAt));
        const file = made.code !== 0 ? made.all.match(TRUST)?.[1] : null;
        if (file) {
          // Shown whole before any approval; unreadable: no approval (askTrust needs the text).
          this.trust = { file, text: await readTextFile(file, { on }).catch(() => null), on, repo: p.name };
          this.busy = false;
          cx.notify();
          return;
        }
        const path = where(made.all, made.code);
        if (!path) throw made.code !== 0 ? lastLine(made.stderr) || lastLine(made.stdout) || tr("exitCode", { code: made.code }) : tr("noWhere");
        const title = made.all.match(/^✓ fetched issue #\d+ (.+)$/m)?.[1]?.trim();
        const tab = spec.desc ?? title ?? name;
        // The consigne whole when there is one; else « Issue #N desc », with gwm's title for a bare #N.
        const message = firstTask({ name, consigne: this.task, prompt, title, desc: spec.desc });
        this.done = this.projects();
        show();
        // The worktree already has a space (gwm reopened it): a new thread there, not a second space.
        const open = spaces().find((s) => s.folder === path && (s.machine ?? null) === (p.space.machine ?? null));
        go(startCommand({ space: p.space.id, open: open?.id ?? null, path, machine: p.space.machine, argv, name: tab, task: message }));
        this.dismiss(cx);
      } catch (error) {
        const raw = String(error?.message ?? error);
        const kind = explain(raw);
        this.busy = false;
        this.error = { title: tr(`gwm.${kind}.title`), text: tr(`gwm.${kind}.text`, { issue: spec.issue }), raw };
        cx.notify();
      }
    });
  }

  // « Approuver » the .gwm.toml shown: kt-confirm (danger: it's the repo's commands that will run),
  // answering `kt-new.trust`. Nothing to approve while the file couldn't be read.
  askTrust() {
    const trust = this.trust;
    if (!trust?.text || this.busy) return;
    openOverlay({
      mod: "kt-confirm",
      kind: "dialog",
      width: 1,
      height: 1,
      frame: "none",
      props: {
        title: tr("trust.title"),
        tone: "danger",
        danger: true,
        subtitle: [trust.repo, ".gwm.toml", "gwm trust add"],
        facts: [[tr("fact.repo"), trust.repo], [tr("fact.file"), tilde(trust.file)]],
        detail: tr("trust.detail"),
        warning: tr("trust.warning"),
        consequence: tr("trust.consequence"),
        label: tr("trust.label"),
        command: { name: "kt-new.trust" },
      },
    });
  }

  // kt-confirm said yes: `gwm trust add` on the file as shown (changed since: shown again, not
  // approved), then the creation again.
  approve(cx) {
    const trust = this.trust;
    if (!trust?.text || this.busy) return;
    this.busy = "gwm trust add";
    cx.spawn(async (cx) => {
      // ponytail: the file can still change between this read and gwm's own; gwm hashes what it reads.
      const now = await readTextFile(trust.file, { on: trust.on }).catch(() => null);
      if (now !== trust.text) {
        this.trust = { ...trust, text: now, changed: true };
        this.busy = false;
        cx.notify();
        return;
      }
      const r = await exec("gwm", ["trust", "add"], { cwd: trust.file.slice(0, trust.file.lastIndexOf("/")), on: trust.on }).catch((e) => ({ code: 1, stdout: "", stderr: String(e?.message ?? e) }));
      this.busy = false;
      this.trust = null;
      if (r.code !== 0) this.error = { title: tr("trust.refused.title"), text: tr("trust.refused.text"), raw: lastLine(r.stderr) || lastLine(r.stdout) };
      else {
        bump("gwm");
        this.start(cx);
      }
      cx.notify();
    });
  }

  // A `.segment` of a `.segmented` pill: mono uppercase; the picked one sits on the kbrdn.dev ink
  // (transparent border elsewhere: no shift).
  chip(t, id, label, on, onClick, color) {
    return h_flex()
      .id(id)
      .h(24)
      .gap(6)
      .flex_none()
      .items_center()
      .px(9)
      .rounded_full()
      .border(1)
      .border_color(on ? t.accent + "66" : t.accent + "00")
      .when(on, (el) => el.bg(t.accent + "24"))
      .font_family(MONO)
      .text_size(11)
      .text_color(on ? t.accent : t.muted)
      .cursor_pointer()
      .hover((s) => s.text_color(on ? t.accent : t.foreground))
      .on_click(onClick)
      .when(Boolean(color), (el) => el.child(div().w(8).h(8).rounded(2).bg(color)))
      .child(label.toUpperCase());
  }

  // kbrdn.dev `.segmented`: one bordered pill holding the segments; `scroll` lets a long one slide.
  segmented(t, id, chips, scroll) {
    return h_flex()
      .id(id)
      .min_w(0)
      .flex_shrink(1)
      .p(3)
      .gap(2)
      .items_center()
      .rounded_full()
      .border(1)
      .border_color(t.border)
      .bg(t.background)
      .when(Boolean(scroll), (el) => el.overflow_x_scroll().track_scroll(scroll))
      .children(chips);
  }

  // ---------- the body's blocks (kt-confirm's) ----------

  // An inner card (radius 12 inside the 16 one), on the terminals' background.
  block(t) {
    return v_flex().flex_none().rounded(12).border(1).border_color(t.border).bg(t.background).overflow_hidden();
  }

  // Key / value pairs, the keys in mono `dim`; `mono`: the value is a command or a path.
  facts(t, rows) {
    return this.block(t).child(v_flex().px(12).py(10).gap(7).children(rows.map(([k, v, mono, color]) =>
      h_flex().gap(12).items_center()
        .child(div().w(72).flex_none().font_family(MONO).text_size(11).text_color(t.dim).child(k))
        .child(div().flex_1().min_w(0).truncate().text_color(color ?? t.foreground)
          .when(Boolean(mono), (el) => el.font_family(MONO).text_size(11.5))
          .when(!mono, (el) => el.text_size(12.5))
          .child(v)))));
  }

  // A state, explained: its mark, the title (15 medium), what it means (13 muted, airy, held to a
  // readable width), then its own blocks.
  section(t, mark, title, text, more = []) {
    return v_flex().flex_none().gap(8)
      .child(h_flex().gap(8).items_center().child(h_flex().size(18).flex_none().items_center().justify_center().child(mark))
        .child(div().text_size(15).font_medium().text_color(t.foreground).child(title)))
      .when(Boolean(text), (el) => el.child(div().max_w(580).text_size(13).line_height("20px").text_color(t.muted).child(text)))
      .children(more.filter(Boolean));
  }

  // Lines as they are, in mono, wrapped; past `max` px they scroll (never cut).
  code(t, id, lines, max = 220) {
    return this.block(t).child(v_flex().id(id).max_h(max).overflow_y_scroll().px(12).py(10).gap(1)
      .font_family(MONO).text_size(11).line_height("17px").text_color(t.muted)
      .children(lines.map((l) => div().child(l || " "))));
  }

  // The body under the rows, one state at a time: gwm working, a .gwm.toml to approve, gwm's
  // refusal, no project, else what Enter will do.
  state(t, p, git, tree, spec) {
    const mark = (icon, color) => svg(I(icon)).size(15).text_color(color);
    if (this.busy) {
      const trusting = this.busy.startsWith("gwm trust");
      return this.section(t, svg("mods/workspace-chrome/spinner.svg").size(14).text_color(t.working).spin(900),
        trusting ? tr("busy.trust.title") : tr("busy.create.title"),
        trusting ? tr("busy.trust.text") : tr("busy.create.text"),
        [this.facts(t, [[tr("fact.command"), this.busy, true]])]);
    }
    if (this.trust) {
      const trust = this.trust;
      const text = trust.text == null
        ? tr("trust.unread", { repo: trust.repo })
        : [trust.changed ? tr("trust.changed") : null, tr("trust.text", { repo: trust.repo })].filter(Boolean).join(" ");
      return this.section(t, mark("circle-alert", t.blocked), tr("trust.heading"), text, [
        this.facts(t, [[tr("fact.file"), tilde(trust.file), true]]),
        trust.text != null && this.code(t, "kt-n-toml", trust.text.replace(/\n$/, "").split("\n")),
        trust.text != null && h_flex().child(
          h_flex().id("kt-n-trust").h(30).px(14).gap(6).items_center().rounded_full().border(1)
            .border_color(alpha(t.ansi1, "66")).bg(alpha(t.ansi1, "14")).text_color(t.ansi1)
            .font_family(MONO).text_size(11).cursor_pointer().hover((s) => s.bg(alpha(t.ansi1, "24")))
            .tooltip(tr("trust.tip"))
            .on_click(() => this.askTrust())
            .child(tr("trust.button"))),
      ]);
    }
    if (this.error) return this.section(t, mark("circle-alert", t.ansi1), this.error.title, this.error.text, [this.error.raw && this.code(t, "kt-n-raw", [this.error.raw], 120)]);
    if (!p) return this.section(t, mark("folder", t.dim), tr("noProject.title"), tr("noProject.text"));
    const [, argv, prompt] = AGENTS[this.agent];
    const name = this.name.trim();
    // What the agent gets first (the consigne whole, else the name): its first line here.
    const first = firstTask({ name, consigne: this.task, prompt }) ?? "";
    const line = first.split("\n")[0];
    const said = line.length > 60 || first.includes("\n") ? `${line.slice(0, 60)}…` : line;
    const agent = argv ? `${argv.join(" ")}${said ? ` « ${said} »` : ""}` : tr("agent.none");
    // A workflow owns the checkout: what it will do, from the project's checkout.
    const own = git ? this.owner() : null;
    if (own) {
      const cmd = `/${own}`;
      const away = checkoutOf(own) === "worktree";
      return this.facts(t, [
        [tr("fact.branch"), away ? tr("branch.byFlow", { cmd }) : tr("branch.fromFlow", { branch: p.space.branch ?? "—", cmd }), true],
        [tr("fact.folder"), away ? tr("folder.byFlow", { name: p.name, cmd }) : tilde(p.space.folder) || "—", !away],
        [tr("fact.agent"), agent, true],
      ]);
    }
    if (!tree) {
      return this.facts(t, [
        [tr("fact.folder"), tilde(p.space.folder) || "—", true],
        [tr("fact.branch"), git ? p.space.branch ?? "—" : this.scanned ? tr("branch.notRepo") : tr("branch.scanning"), true, git ? undefined : t.dim],
        [tr("fact.agent"), agent, true],
      ]);
    }
    const args = spec ? this.gwmArgs(spec) : null;
    const triple = spec ? `${TYPES[this.type]}/#${spec.issue}-${kebab(spec.desc ?? "")}` : "";
    const branch = !spec
      ? tr("branch.hint")
      : args.first === args.triple
        ? triple
        : tr("branch.issue", { issue: spec.issue, type: this.typeChosen ? TYPES[this.type] : tr("branch.byLabels"), fallback: args.triple ? tr("branch.fallback", { branch: triple }) : "" });
    return this.facts(t, [
      [tr("fact.branch"), branch, Boolean(spec), spec ? undefined : t.dim],
      [tr("fact.folder"), tr("folder.worktree", { name: p.name })],
      ["gwm", args ? `gwm ${args.first.join(" ")}` : "—", true, args ? undefined : t.dim],
      [tr("fact.agent"), agent, true],
    ]);
  }

  render() {
    const t = theme();
    this.pickWanted();
    const ps = this.projects();
    this.project = Math.min(this.project, Math.max(0, ps.length - 1));
    const p = ps[this.project];
    const git = Boolean(p?.git);
    // A workflow leading the consigne owns the checkout (skills.js checkoutOf); else kt-new's pick.
    const own = git ? this.owner() : null;
    const away = own ? checkoutOf(own) === "worktree" : git && this.worktree;
    const tree = git && this.worktree && !own; // kt-new makes the worktree (gwm)
    const spec = tree ? issueOf(this.name) : null;
    // kbrdn.dev `kbd`: a small mono pill.
    const kbd = (k) => div().flex_none().h(18).px(6).flex().items_center().rounded_full().border(1).border_color(t.border).font_family(MONO).text_size(10).text_color(t.muted).child(k);
    const hint = (k, what) => h_flex().flex_none().gap(5).items_center().child(kbd(k)).child(div().child(what));
    // The keys' cursor walks these rows (`at`); one gone (Type, Checkout) puts it back on the first.
    const fields = this.fields();
    if (!fields.includes(this.at)) this.at = fields[0];
    const keyed = this.handle.is_focused();
    // kbrdn.dev `.eyebrow` label, then its `.segmented` group (32 px, round). Under the keys' cursor
    // (while the dialog has the keyboard): a 1 px accent ring on the ink, round around the group's
    // pill; a transparent border elsewhere (no shift).
    const row = (label, group, field) => {
      const cursor = keyed && this.at === field;
      return h_flex()
        .h(36)
        .px(10)
        .gap(10)
        .items_center()
        .rounded_full()
        .border(1)
        .border_color(cursor ? alpha(t.accent, "99") : alpha(t.accent, "00"))
        .when(cursor, (el) => el.bg(alpha(t.accent, "24")))
        .child(div().w(76).flex_none().font_family(MONO).text_size(10.5).text_color(cursor ? t.foreground : t.muted).child(label.toUpperCase()))
        .child(group);
    };
    const pick = (field, i) => (_e, cx) => {
      this.choose(field, i);
      cx.notify();
    };
    const placeholder = tree ? (p ? tr("ph.issueIn", { name: p.name }) : tr("ph.issue")) : p ? tr("ph.threadIn", { name: p.name }) : tr("ph.thread");
    const nudge = this.nudge === "issue" ? tr("nudge") : null;
    // The head's band: the project's color (kt-projects' registry, else its space's), else the accent.
    const dark = settings().dark;
    const tint = p ? projectTint(p.space) : null;
    const band = tint ? (String(tint).startsWith("#") ? tint : t[tint] ?? t.accent) : t.accent;
    const subtitle = [p?.name ?? tr("sub.noProject"), away ? tr("sub.worktree") : git ? tr("sub.current") : tr("sub.folder"), AGENTS[this.agent][0].toLowerCase()].join(" · ");
    // The field typed in looks live (INSERT); in NORMAL they rest, without their caret.
    const typing = keyed && this.vim.insert;
    const focused = typing && this.field === "name";
    const onTask = typing && this.field === "task";
    const dashed = () => div().flex_none().h(0).border_t(1).border_dashed().border_color(t.border);
    const mode = div().flex_none().h(16).px(6).flex().items_center().rounded(5).border(1)
      .border_color(typing ? alpha(t.accent, "66") : t.border).bg(typing ? alpha(t.accent, "24") : t.background)
      .font_family(MONO).text_size(9).text_color(typing ? t.accent : t.muted).child(this.vim.label);
    // The consigne (multi-line, apart from the name): its lines as typed, a caret at the end while it
    // types; past 6 lines it scrolls. Empty: what it is for.
    const lines = this.task.split("\n");
    const consigne = div().p(3).rounded(15).bg(onTask ? t.accent + "33" : t.accent + "00")
      .child(v_flex().id("kt-n-task").min_h(64).max_h(140).overflow_y_scroll().px(14).py(10).gap(2).rounded(12).bg(t.background)
        .border(1).border_color(onTask ? t.accent : t.input).text_size(13).line_height("19px").cursor_text()
        .on_click((_e, cx) => { this.field = "task"; this.vim.edit(); this.handle.focus(); cx.notify(); })
        .child(h_flex().gap(8).items_center().font_family(MONO).text_size(10).text_color(t.muted)
          .child(div().flex_1().child(tr("task.label")))
          // The agent, at hand while the consigne types: a click (or ctrl+a) takes the next one.
          .child(h_flex().id("kt-n-agent").h(18).px(7).gap(5).items_center().rounded_full().border(1)
            .border_color(alpha(t.accent, "4d")).bg(alpha(t.accent, "14")).text_color(t.accent).cursor_pointer()
            .hover((s) => s.bg(alpha(t.accent, "24")))
            .tooltip(tr("agent.tip"))
            .on_click((_e, cx) => { this.cycle("agent", 1); cx.notify(); })
            .child(AGENTS[this.agent][0].toUpperCase())
            .child(div().text_color(t.dim).child("ctrl+a"))) // i18n: tech
          .child(div().text_color(t.dim).child("ctrl+o"))) // i18n: tech
        .when(!this.task && !onTask, (el) => el.child(div().text_color(t.dim).child(tr("task.ph"))))
        .children((this.task || onTask ? lines : []).map((l, i) => h_flex().min_h(19).items_center().text_color(t.foreground)
          .child(div().min_w(0).child(l))
          .when(onTask && i === lines.length - 1, (el) => el.child(div().flex_none().w(2).h(16).rounded(1).bg(t.accent))))));
    // The workflow presets (skills.js): libre, then the installed ones; the one leading the consigne is lit.
    const lit = this.flow();
    const flows = this.skills.length ? presets(this.skills) : [];
    const setFlow = (name) => (_e, cx) => {
      this.setFlow(name);
      this.handle.focus();
      cx.notify();
    };
    const flowRow = flows.length > 0 && row(tr("row.workflow"), this.segmented(t, "kt-n-wf", [
      this.chip(t, "kt-n-wf-free", tr("flow.free"), !lit, setFlow(null)).tooltip(tr("flow.freeTip")),
      ...flows.map((e, i) => this.chip(t, `kt-n-wf${i}`, e.name.replace(/^me:/, ""), lit === e.name, setFlow(e.name)).tooltip(e.description || `/${e.name}`)),
    ], this.scrolls.flow), "flow");
    // The completion under the consigne (skills.js complete): `/name`, what it does, where it comes from.
    const comp = this.completion();
    const at = comp ? Math.min(this.pick, Math.max(0, comp.items.length - 1)) : 0;
    // Its height (skills.js fit): as many rows as the window leaves under the card without the list
    // (measured: the card's height less the list's and its gap), START included; too low, the Workflow
    // row goes while it's open. Closed: nothing measured, nothing hidden.
    if (!comp) this.listH = 0;
    const room = comp?.items.length
      ? fit({ win: this.size?.height, base: (this.cardH ?? 0) - (this.listH ? this.listH + 12 : 0), flowShown: !this.flowOut, flow: flowRow ? 48 : 0 })
      : { rows: 6, flow: true };
    this.flowOut = Boolean(flowRow) && !room.flow;
    const compList = comp && this.block(t).id("kt-n-list")
      .on_size_change((size, cx) => {
        if (Math.abs((this.listH ?? 0) - size.height) < 0.5) return;
        this.listH = size.height;
        cx.notify();
      })
      .child(comp.items.length
      ? v_flex()
        .child(v_flex().id("kt-n-complete").max_h(room.rows * 31 + 7).overflow_y_scroll().track_scroll(this.scrolls.complete).p(4).gap(1)
          .children(comp.items.map((e, i) => h_flex().id(`kt-n-c${i}`).h(30).px(10).gap(10).flex_none().items_center().rounded(8).cursor_pointer()
            .when(i === at, (el) => el.bg(alpha(t.accent, "24")))
            .on_click((_e, cx) => { this.task = insert(this.task, e.name); this.pick = 0; this.handle.focus(); cx.notify(); })
            .child(div().flex_none().max_w(260).truncate().font_family(MONO).text_size(12).text_color(i === at ? t.accent : t.foreground).child(`/${e.name}`)) // i18n: tech
            .child(div().flex_1().min_w(0).truncate().text_size(12).text_color(t.muted).child(e.description))
            .child(div().flex_none().font_family(MONO).text_size(10).text_color(t.dim).child(tr(`src.${e.source}`))))))
        .child(div().px(14).py(6).border_t(1).border_color(t.border).font_family(MONO).text_size(10).text_color(t.dim).child(tr("complete.keys")))
      : div().px(14).py(10).text_size(12).text_color(t.muted).child(tr(`complete.${comp.note}`, { q: comp.q, agent: AGENTS[this.agent][0] })));
    // The modals' motion (ANIMATIONS.md, kt-confirm's): the veil fades in and the card rises 6 px,
    // MS.open, once, on the first size report, and goes back out on dismiss (motion.js sheet);
    // reduced motion: there at once.
    const still = Boolean(shared("kt.reducedMotion"));
    const shown = still || Boolean(this.size);
    const s = sheet(frame(this.motion, still), "kn", shown);
    // The head, Crosstalk's: a 60 px band over the pixel dither tinted by the project, the mark (the
    // new thread's pen, accent, on a soft square), the title (14 semibold) and a mono subtitle.
    const head = div()
      .id("kt-n-head")
      .relative()
      .flex_none()
      .h(60)
      .overflow_hidden()
      .rounded_t(15)
      .on_size_change((size, cx) => {
        if (Math.abs((this.headW ?? 0) - size.width) < 0.5) return;
        this.headW = size.width;
        cx.notify();
      })
      // Inside the inner card's 1 px border: its radius 16 less the border.
      .when(this.headW > 30, (el) => el.child(ditherBand(this.headW, 60, 15, alpha(band, dark ? "6b" : "4d"), TOP)))
      .child(h_flex().size_full().px(14).gap(12).items_center()
        .child(h_flex().size(32).flex_none().rounded(10).items_center().justify_center().border(1).border_color(alpha(t.accent, "4d")).bg(alpha(t.surface, "e6"))
          .child(svg(I("square-pen")).size(16).text_color(t.accent)))
        .child(v_flex().flex_1().min_w(0).gap(2)
          // motion.js sharpen: the title comes into focus as the dialog opens, once.
          .child(sharpen(this.motion, "kn-title", () => div().truncate().text_size(14).font_semibold().text_color(t.foreground).child(tr("title"))))
          .child(div().truncate().font_family(MONO).text_size(10.5).text_color(t.muted).child(subtitle)))
        .child(kbd("esc")));
    // The card (radius 20, 4 px around) and its inner card (16): frame "none" (mod.json), so it's ours.
    const card = s.card(v_flex()
      .id("kt-new")
      // A press in the card never reaches the veil, and gives the dialog the keyboard back (after kt-confirm).
      .on_mouse_down("left", (_e, cx) => {
        cx.stop_propagation();
        this.handle.focus();
      })
      // Its height, for the completion's (fit above).
      .on_size_change((size, cx) => {
        if (Math.abs((this.cardH ?? 0) - size.height) < 0.5) return;
        this.cardH = size.height;
        cx.notify();
      })
      .w(CARD)
      .max_w_full())
      .p(4)
      .rounded(20)
      .bg(t.popover)
      .border(1)
      .border_color(t.border)
      .shadow_lg()
      .child(
        v_flex()
          .rounded(16)
          .bg(t.surface)
          .border(1)
          .border_color(t.border)
          .child(head)
          .child(div().flex_none().h(0).border_t(1).border_dashed().border_color(alpha(band, "4d")))
          .child(
            v_flex()
              .p(16)
              .gap(12)
              // The field (radius 12) in its accent ring (3 px, radius 15) while it types (INSERT).
              .child(
                div()
                  .p(3)
                  .rounded(15)
                  .bg(focused ? t.accent + "33" : t.accent + "00")
                  .child(
                    h_flex()
                      .id("kt-n-field")
                      .h(44)
                      .px(14)
                      .gap(10)
                      .items_center()
                      .rounded(12)
                      .bg(t.background)
                      .border(1)
                      .border_color(focused ? t.accent : t.input)
                      .text_size(16)
                      .cursor_text()
                      // A click on the field types again (INSERT).
                      .on_click((_e, cx) => { this.field = "name"; this.vim.edit(); this.handle.focus(); cx.notify(); })
                      .child(svg("mods/kt-threads/square-pen.svg").size(15).flex_none().text_color(t.dim))
                      .child(
                        h_flex()
                          .flex_1()
                          .min_w(0)
                          .items_center()
                          .when(Boolean(this.name), (el) => el.child(div().min_w(0).truncate().text_color(t.foreground).child(this.name)))
                          .when(focused, (el) => el.child(div().flex_none().w(2).h(20).rounded(1).bg(t.accent)))
                          .when(!this.name, (el) => el.child(div().pl(6).min_w(0).truncate().text_color(this.nudge === "name" ? t.blocked : t.dim).child(placeholder))),
                      ),
                  ),
              )
              .when(Boolean(flowRow) && !this.flowOut, (el) => el.child(flowRow))
              .child(consigne)
              .when(Boolean(compList), (el) => el.child(compList))
              .child(
                v_flex()
                  .child(row(tr("row.project"), this.segmented(t, "kt-n-ps", ps.map((x, i) => this.chip(t, `kt-n-p${i}`, x.name, i === this.project, pick("project", i), spaceColor(t, x.space))), this.scrolls.project), "project"))
                  .when(git, (el) =>
                    el.child(
                      row(
                        tr("row.checkout"),
                        // A workflow owns it: its pick alone, and whose it is.
                        own
                          ? h_flex().min_w(0).gap(10).items_center()
                            .child(this.segmented(t, "kt-n-co", [this.chip(t, "kt-n-own", away ? tr("chip.worktree") : tr("chip.current"), true, () => {}).tooltip(tr("checkout.ownTip"))]))
                            .child(div().min_w(0).truncate().font_family(MONO).text_size(10.5).text_color(t.dim).child(tr("checkout.byFlow", { cmd: `/${own}` })))
                          : this.segmented(t, "kt-n-co", [
                            this.chip(t, "kt-n-cur", tr("chip.current"), !this.worktree, pick("worktree", false)),
                            this.chip(t, "kt-n-wt", tr("chip.worktree"), this.worktree, pick("worktree", true)),
                          ]),
                        "worktree",
                      ),
                    ),
                  )
                  .when(tree, (el) => el.child(row(tr("row.type"), this.segmented(t, "kt-n-ts", TYPES.map((n, i) => this.chip(t, `kt-n-t${i}`, n, i === this.type, pick("type", i))), this.scrolls.type), "type")))
                  .child(row(tr("row.agent"), this.segmented(t, "kt-n-as", AGENTS.map(([n], i) => this.chip(t, `kt-n-a${i}`, n, i === this.agent, pick("agent", i)))), "agent")),
              )
              .when(Boolean(nudge), (el) => el.child(div().px(4).text_size(12).text_color(t.blocked).child(nudge)))
              .child(this.state(t, p, git, tree, spec)),
          )
          // The foot, under a dashed rule: the keys, the branch to be, Start.
          .child(dashed())
          .child(
            h_flex()
              .px(14)
              .py(10)
              .gap(12)
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
                    .child(`${String(this.busy).split(" ").slice(0, 2).join(" ").toUpperCase()}…`),
                ),
              )
              .when(keyed, (el) => el.child(mode))
              // The key hints take what the buttons leave and clip past it: Start never leaves the card.
              .child(
                h_flex()
                  .flex_1()
                  .min_w(0)
                  .gap(12)
                  .items_center()
                  .overflow_hidden()
                  .when(!this.busy, (el) =>
                    el
                      // Three hints fit beside the buttons; ctrl+w / ctrl+t / ctrl+a stay in the keys help (ctrl-b ?).
                      .child(hint("ctrl+p", tr("hint.project")))
                      .child(hint("ctrl+e", tr("hint.terminal")))
                      .child(hint("esc", this.vim.insert ? tr("hint.normal") : tr("hint.cancel"))),
                  ),
              )
              // An empty thread: just a terminal in the project (ctrl+e).
              .when(!this.busy, (el) =>
                el.child(
                  h_flex()
                    .id("kt-n-blank")
                    .flex_none()
                    .h(30)
                    .px(12)
                    .gap(6)
                    .items_center()
                    .rounded_full()
                    .border(1)
                    .border_color(t.input)
                    .text_color(t.muted)
                    .font_family(MONO)
                    .text_size(11)
                    .cursor_pointer()
                    .hover((s) => s.bg(t.hover).text_color(t.foreground))
                    .tooltip(tr("blank.tip"))
                    .on_click((_e, cx) => this.blank(cx))
                    .child(svg("mods/workspace-chrome/terminal.svg").size(12))
                    .child(tr("blank")),
                ),
              )
              // kbrdn.dev primary button: solid ink, round.
              .child(
                h_flex()
                  .id("kt-n-start")
                  .flex_none()
                  .h(30)
                  .px(14)
                  .gap(6)
                  .items_center()
                  .rounded_full()
                  .bg(this.busy ? t.raised : t.solid)
                  .text_color(this.busy ? t.dim : t.solid_foreground)
                  .font_family(MONO)
                  .text_size(11)
                  .cursor_pointer()
                  .hover((s) => s.opacity(0.88))
                  .on_click((_e, cx) => {
                    this.start(cx);
                    cx.notify();
                  })
                  .child(this.trust?.text != null ? tr("approve") : tr("start"))
                  .child(div().text_size(12).child("↵")),
              ),
          ),
      );
    // The whole window: a veil (a click on it closes), the card in its middle. Fades in once, out on dismiss.
    return s.veil(div()
      .id("kt-new-veil")
      .size_full()
      .flex()
      .items_center()
      .justify_center()
      .bg(veil()))
      .on_size_change((size, cx) => {
        this.size = size;
        cx.notify();
      })
      .on_click((_e, cx) => this.dismiss(cx))
      .track_focus(this.handle)
      .on_key_down((e, cx) => this.key(e, cx))
      .child(card);
  }
}
