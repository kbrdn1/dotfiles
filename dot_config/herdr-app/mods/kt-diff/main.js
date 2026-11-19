// kbrdn Threads' Changes panel (the "diff" child of the right panel's stack):
// the shown tab's repo, its branch, a commit field (⌘↩ commits), Commit (its
// chevron: stage everything first) and Create PR (`gh pr create --fill --web`),
// then Staged and Changes: each file a row after DIFF-SPEC (status, Catppuccin
// icon, mini bar, +N −N) that unfolds into its diff. On hover a row stages,
// unstages, discards (asked first, through kt-confirm when it's there, else
// the shipped confirm, which calls back `kt-diff.confirmed`), opens Zed or
// copies an nvim command. Commit runs `git add` on the staged files only, then
// `git commit -m`: hooks run, nothing is skipped. Polls every 3 s while shown.
// Keys (vim.js; kt-keys lists them, group "panel"): ctrl-b l (pane.go, "focus") or
// `kt-diff.key:<keys>` gives Changes the keyboard: a cursor (an accent ring on the ink) on the
// message, a section's header or a file. j k gg G ctrl-d ctrl-u move (k stops on the first row, #78);
// / goes to the message (INSERT, the textarea types; ⌘↩ commits; esc back to NORMAL); h folds a
// file's diff (on a folded file: folds its section and goes to its header), l unfolds; enter / o
// as a click; O opens in Zed; y copies the path; dd / x discards a file of Changes (asked first,
// the hover button's path); r reads again; ⌘↩ commits from the list too; esc gives the keyboard
// back to the terminal; [ ] the panel's previous / next tab; ? the keys.

import { View, div, svg } from "gpui-kit";
import { v_flex, h_flex, TextareaState, Textarea, ScrollHandle, Scrollbar } from "gpui-base";
import { exec as hostExec, focused, panes, spaces, theme, layout, settings, readTextFile, appHome, openOverlay, nextCommand, notify, checking, run, shared } from "herdr";
import * as fs from "fs/promises";
import { parsePatch } from "./diff.js";
import { commitPrompt, cleanMessage, SYSTEM } from "./commitmsg.js";
import { ICON_MAP } from "./icons.js";
import { fileItems, sectionHead, action, zed, firstLine, palette, alpha, MONO, IMAGE, loadPreview, cleanPreviews, colorize, cleanTokens } from "./diffview.js";
import { Vim, keysOf, step } from "./vim.js";
import { motionState, frame, enter } from "./motion.js";
// Copied byte for byte from mods/kt-keys/panel.js: in and out with the right panel (#73).
import { panelIn } from "./panel.js";
import { skeleton, readyFor } from "./skeleton.js";
import { bump, gitTopics, refreshOn } from "./bus.js";
import { shouldRead } from "./reread.js";
import { makeT } from "./i18n.js";
import strings from "./strings.js";
// kt-keys' roll.js (a byte-identical copy): the commit zone's +N −M roll to their new digits.
import { roll } from "./roll.js";
// kt-keys' machines.js (a byte-identical copy, with machines.strings.js): a remote repo's machine away
// refuses the read at once and says so (notice), and a remote repo is read every 15 s at most (#62).
import { guard, isOffline, reachable, due, notice, localOnly } from "./machines.js";

const tr = makeT(strings);
const exec = guard(hostExec);
const REMOTE_EVERY = 15e3;

const ME = "diff"; // this block's id in the layout's "panel-body" stack
const I = (name) => `mods/kt-threads/${name}.svg`;
const MINE = (name) => `mods/kt-diff/${name}.svg`;
// Reads write nothing under .git (no index refresh or lock), as the shipped Changes does.
const READ = ["--no-optional-locks", "-c", "core.fsmonitor=false", "-c", "diff.autoRefreshIndex=false", "-c", "core.quotePath=false"];
const PATCH = ["-M", "--no-color", "--no-ext-diff", "--no-textconv", "--src-prefix=a/", "--dst-prefix=b/"];
const MAX_FRESH = 40; // untracked files whose diff loads up front
// The panel's tabs in order, and each one's mod: [ / ] show the next one and give it the keyboard.
const TABS = ["files", "diff", "history", "flow", "crosstalk", "gwm-panel"];
const TAB_MODS = { files: "kt-files", diff: "kt-diff", history: "kt-history", flow: "kt-flow", crosstalk: "kt-crosstalk", "gwm-panel": "kt-gwm" };
// The keyboard follows a moment later: a `<mod>.focus` sent at once reaches no copy (the new tab
// isn't shown yet) and the app gives the keyboard back to the terminal.
function panelTab(dir, cx) {
  const child = TABS[(TABS.indexOf(ME) + dir + TABS.length) % TABS.length];
  run("layout.select", { stack: "panel-body", child });
  // gwm-panel: kt-gwm's panel copy only (its page copy may show too).
  cx.timer.after(120, () => run(child === "gwm-panel" ? "kt-gwm.panel-focus" : `${TAB_MODS[child]}.focus`));
}
// NORMAL / INSERT, kt-keys' pill: INSERT on the ink, NORMAL plain.
const modePill = (t, vim) => div().flex_none().h(16).px(6).flex().items_center().rounded(5).border(1)
  .border_color(vim.insert ? alpha(t.accent, "66") : t.border).bg(vim.insert ? alpha(t.accent, "24") : t.background)
  .font_family(MONO).text_size(9).text_color(vim.insert ? t.accent : t.muted).child(vim.label);

function find(node, id) {
  if (node?.id === id) return node;
  for (const child of node?.children ?? []) {
    const found = find(child, id);
    if (found) return found;
  }
  return null;
}
// Shown: the "panel" column isn't hidden and its stack shows this block.
function visible() {
  const root = layout(), panel = find(root, "panel"), body = find(root, "panel-body");
  return Boolean(panel && !panel.hidden && body && (body.active ?? body.children?.[0]?.id) === ME);
}
// The shown tab's folder (its agent's, else its first terminal's), and its machine.
function where() {
  const s = spaces().find((x) => x.active), tab = s?.tabs.find((x) => x.active);
  const mine = panes().filter((p) => p.tab === tab?.id && p.terminal);
  const lead = mine.find((p) => p.program?.agent) ?? mine[0];
  return { cwd: lead?.cwd ?? focused()?.cwd ?? s?.folder ?? null, on: s?.machine ?? null };
}

// `git status --porcelain=v1 -z`: [{ x, y, path, old }] (a rename carries its old path next).
function status(out) {
  const parts = out.split("\0");
  const list = [];
  for (let i = 0; i < parts.length; i++) {
    const e = parts[i];
    if (e.length < 4) continue;
    const x = e[0], y = e[1];
    const item = { x, y, path: e.slice(3), old: null };
    if (x === "R" || x === "C") item.old = parts[++i];
    list.push(item);
  }
  return list;
}

export default class Changes extends View {
  init(_props, cx) {
    this.staged = [];
    this.changes = [];
    this.fresh = {}; // untracked path -> parsed file
    this.previews = {}; // "section:path" -> { before, after } | { error }, made when an image unfolds
    this.tokens = {}; // "section:path" -> colorize's { mode, label, old, new }, made when a file unfolds
    this.coloring = new Set(); // "section:path:mode" being colored
    this.open = new Set();
    this.motion = motionState(); // ANIMATIONS.md: the tab fades in when shown, a file opens on its height
    this.showGen = 0;
    this.hot = null;
    this.fold = {};
    this.message = "";
    this.menu = false;
    this.busy = null;
    this.error = null;
    this.note = null;
    this.map = null;
    this.confirmMod = "confirm";
    // Multi-line: a subject, then a body (a generated message has both).
    this.input = TextareaState.new({ placeholder: tr("placeholder") });
    this.input.set_auto_grow(1, 6);
    this.input.on("change", (_e, cx) => {
      const had = Boolean(this.message.trim());
      this.message = this.input.value();
      if (had !== Boolean(this.message.trim())) cx.notify();
    });
    this.input.on("submit", (_e, cx) => this.commit(cx, false));
    // The message is the field: typing in it is vim's INSERT mode, with the cursor on it.
    this.input.on("focus", (_e, cx) => { this.typing = true; this.vim.edit(); this.cur = "message"; cx.notify(); });
    this.input.on("blur", (_e, cx) => { this.typing = false; this.vim.normal(); cx.notify(); });
    this.handle = cx.focus_handle();
    this.vim = new Vim({ field: true });
    this.cur = null; // the keys' cursor: "message", "h:<section>" or "<section>:<path>"
    this.flat = []; // what it walks, in order: { id, section?, head?, file? }
    this.listScroll = ScrollHandle.new();
    if (checking()) return;
    cx.spawn(async (cx) => {
      try { this.map = JSON.parse(await readTextFile(`${appHome()}/${ICON_MAP}`)); } catch { this.map = null; }
      cx.notify();
    });
    cx.spawn(async (cx) => {
      for (;;) {
        const c = await nextCommand();
        if (c === "confirmed" && this.pending) {
          const p = this.pending;
          this.pending = null;
          this.git(p.label, p.steps, cx);
        } else if (c === "overwrite" && this.generated) {
          this.input.set_value(this.generated);
          this.message = this.generated;
          this.generated = null;
        } else if (c === "generate") this.generate(cx);
        else if (c === "expand-first") {
          const f = this.changes[0] ?? this.staged[0];
          if (f) this.toggle(this.changes[0] ? "changes" : "staged", f, cx);
        } else if (c === "collapse") this.open.clear();
        // `focus` (pane.go) takes the keyboard; `key:<keys>` takes it and types those keys, for tests.
        else if (c === "focus") this.focusIn();
        else if (c.startsWith("key:")) {
          this.focusIn();
          for (const k of keysOf(c.slice(4))) this.act(this.vim.handle(k), cx);
        }
        cx.notify();
      }
    });
    this.refresh(cx);
    // A remote repo: the bus and coming back read at once; this tick only every 15 s (DATA-SYNC.md).
    cx.timer.every(3000, (cx) => { if (due(where().on, this.readAt, REMOTE_EVERY)) this.refresh(cx); });
    // The keyboard went away (Herdr doesn't always redraw then): drop the cursor. A hidden copy
    // doesn't render, so this tick notes that the tab went away: shown again, it reads and fades in.
    cx.timer.every(500, (cx) => {
      if (this.shown && !visible()) this.shown = false;
      if (this.keyed !== this.handle.is_focused()) cx.notify();
    });
  }

  // ---------- keys (vim.js; kt-keys lists them) ----------

  // The keyboard comes here: NORMAL, the cursor where it was, else on the first file.
  focusIn() {
    this.handle.focus();
    this.vim.normal();
    if (!this.flat.some((x) => x.id === this.cur) || this.cur === "message")
      this.cur = (this.flat.find((x) => x.file) ?? this.flat[1] ?? this.flat[0])?.id ?? null;
    this.reveal = true;
  }

  // A click on a row: the keys' cursor goes there, and the keyboard, in NORMAL (#78).
  pick(id) {
    this.cur = id;
    this.vim.normal();
    this.handle.focus();
  }

  key(e, cx) {
    // In the message the textarea types (⌘↩ is cg-message's): only esc comes back to the list.
    if (this.typing) {
      if (e.key !== "escape") return;
      this.vim.normal();
      this.handle.focus();
    } else if (e.key === "enter" && e.modifiers?.platform) this.commit(cx, false); // ⌘↩ from the list too
    else if (!this.act(this.vim.handle(e), cx)) return; // not ours: ctrl-b, cmd-* go on
    cx.stop_propagation();
    cx.notify();
  }

  // One vim action on Changes; false: not one it has, and the key goes on.
  act(a, cx) {
    if (!a) return false;
    if (a === "pending" || a === "count") return true;
    const flat = this.flat;
    const i = flat.findIndex((x) => x.id === this.cur);
    const x = flat[i];
    // On the message is typing in it (its focus event switches vim to INSERT).
    const to = (id) => { this.cur = id; this.reveal = true; if (id === "message") this.input.focus(); };
    if (a === "filter") to("message");
    else if (["down", "up", "top", "bottom", "half-down", "half-up"].includes(a)) {
      let j = step(a, i, flat.length, this.vim.count, 16);
      if (j === 0 && flat.length > 1) j = 1; // k stops on the first row (#78): / goes to the message
      if (j >= 0) to(flat[j].id);
    } else if (x?.id === "message" && (a === "open" || a === "right")) to("message");
    else if (a === "left") {
      // An unfolded diff folds; on a folded file, its section folds and its header takes the cursor.
      if (x?.head) this.fold[x.section] = true;
      else if (x?.file && this.open.has(x.id)) this.open.delete(x.id);
      else if (x?.file) { this.fold[x.section] = true; to(`h:${x.section}`); }
    } else if (a === "right") {
      if (x?.head) this.fold[x.section] = false;
      else if (x?.file && !this.open.has(x.id)) this.toggle(x.section, x.file, cx);
    } else if (a === "open") {
      if (x?.head) this.fold[x.section] = !this.fold[x.section];
      else if (x?.file) this.toggle(x.section, x.file, cx);
    } else if (a === "open-alt") {
      if (x?.file && this.root && !this.on) zed(`${this.root}/${x.file.path}`, x.file.letter === "D" ? 0 : firstLine(x.file));
    } else if (a === "yank") {
      const p = x?.file && this.root ? (this.on ? x.file.path : `${this.root}/${x.file.path}`) : null;
      if (p) {
        cx.write_to_clipboard(p);
        notify({ title: tr("copied"), body: p, level: "success", timeout: 2000 });
      }
    } else if (a === "delete") {
      // dd / x: the hover button's discard, asked first; Changes only (Staged has nothing to lose).
      if (x?.section !== "changes" || !x.file) return false;
      this.discard(x.file);
    } else if (a === "refresh") {
      this.key = null;
      this.refresh(cx);
    } else if (a === "escape") run("pane.go", { direction: "left" });
    else if (a === "help") openOverlay({ mod: "kt-keys", kind: "dialog", width: 1, height: 1, frame: "none", props: { group: "panel" } });
    else if (a === "panel-prev" || a === "panel-next") panelTab(a === "panel-next" ? 1 : -1, cx);
    else return false;
    return true;
  }

  refresh(cx) {
    // A read already running (maybe for the previous place): run once more when it ends.
    if (this.loading) { this.again = true; return; }
    if (!visible() || this.busy) return;
    const { cwd, on } = where();
    const at = JSON.stringify({ cwd, on }); // the place this read answers for (render's loc)
    this.loading = true;
    this.readAt = Date.now(); // DATA-SYNC.md: back on the tab, read again only past 10 s
    cx.spawn(async (cx) => {
      try {
        // No folder at all: no repo, said as such (an answer, no skeleton left standing).
        const top = cwd ? await exec("git", ["rev-parse", "--show-toplevel"], { cwd, on }) : { code: 1 };
        this.offline = null; // the machine answered
        if (top.code !== 0) {
          if (this.root !== null) { this.root = null; this.branch = null; this.staged = []; this.changes = []; this.key = null; cx.notify(); }
          return;
        }
        const root = top.stdout.trim();
        const git = (args) => exec("git", [...READ, ...args], { cwd: root, on });
        const [st, br, cached, work, kc] = await Promise.all([
          git(["status", "--porcelain=v1", "-z", "--untracked-files=all"]),
          git(["branch", "--show-current"]),
          git(["diff", "--cached", ...PATCH]),
          git(["diff", ...PATCH]),
          readTextFile(`${appHome()}/mods/kt-confirm/main.js`).catch(() => null),
        ]);
        this.confirmMod = kc ? "kt-confirm" : "confirm";
        const key = JSON.stringify([root, on, st.stdout, br.stdout, cached.stdout.length, work.stdout.length, cached.stdout.slice(0, 4096), work.stdout.slice(0, 4096)]);
        if (key === this.key && cached.stdout === this.cachedText && work.stdout === this.workText) return;
        if (root !== this.root) { this.open.clear(); this.fresh = {}; this.tokens = {}; }
        this.key = key; this.cachedText = cached.stdout; this.workText = work.stdout;
        // Something changed: unfolded images look again (their cache is by blob hash, so it's cheap).
        this.previews = {};
        this.root = root; this.on = on;
        this.branch = br.stdout.trim(); // "": a detached HEAD, said at render
        const entries = status(st.stdout);
        const letter = {};
        for (const e of entries) letter[e.path] = e;
        this.staged = parsePatch(cached.stdout).map((f) => ({ ...f, letter: letter[f.path]?.x && letter[f.path].x !== " " ? letter[f.path].x.replace("C", "R") : f.status }));
        const untracked = entries.filter((e) => e.x === "?").map((e) => e.path);
        const fresh = {};
        for (const p of untracked) fresh[p] = this.fresh[p] ?? { path: p, old: null, status: "A", letter: "U", binary: false, add: 0, del: 0, hunks: [], loaded: false };
        this.fresh = fresh;
        this.changes = [
          ...parsePatch(work.stdout).map((f) => ({ ...f, letter: letter[f.path]?.y && letter[f.path].y !== " " ? letter[f.path].y : f.status })),
          ...untracked.map((p) => fresh[p]),
        ];
        // Unfolded files look again: their images, and their colors (another blob, cached when it was seen).
        for (const [section, list] of [["staged", this.staged], ["changes", this.changes]])
          for (const f of list) if (this.open.has(`${section}:${f.path}`)) { this.preview(section, f, cx); this.colorize(section, f, cx); }
        cx.notify();
        // Untracked files: their diff against nothing (git diff --no-index exits 1 when they differ).
        for (const p of untracked.slice(0, MAX_FRESH)) if (fresh[p].loaded === false) await this.loadFresh(p, root, on);
        cx.notify();
      } catch (e) {
        // The machine away (machines.js): its notice, not a raw error.
        this.offline = isOffline(e);
        this.error = this.offline ? null : String(e);
        // Failed on another place than the one shown: its error, never the previous repo's files.
        if (this.readFor !== at) { this.root = undefined; this.branch = null; this.staged = []; this.changes = []; this.key = null; }
        cx.notify();
      } finally {
        this.loading = false;
        // An answer for this place, unchanged or failed alike: its skeleton gives way (readyFor).
        if (this.readFor !== at) { this.readFor = at; cx.notify(); }
        if (this.again) { this.again = false; this.key = null; this.refresh(cx); }
      }
    });
  }

  async loadFresh(path, root, on) {
    const r = await exec("git", [...READ, "diff", "--no-index", ...PATCH, "--", "/dev/null", path], { cwd: root, on }).catch(() => null);
    const f = parsePatch(r?.stdout ?? "")[0];
    if (this.root !== root || !this.fresh[path]) return;
    Object.assign(this.fresh[path], f ? { binary: f.binary, add: f.add, del: f.del, hunks: f.hunks, worded: false } : { binary: true }, { loaded: true });
  }

  toggle(section, f, cx) {
    const k = `${section}:${f.path}`;
    if (this.open.has(k)) this.open.delete(k);
    else {
      this.open.add(k);
      // An untracked file's diff loads first: its colors are for the lines it shows.
      if (f.loaded === false && this.root) cx.spawn(async (cx) => { await this.loadFresh(f.path, this.root, this.on); this.colorize(section, f, cx); cx.notify(); });
      else this.colorize(section, f, cx);
      this.preview(section, f, cx);
    }
    cx.notify();
  }

  // An unfolded file's code in Zed's theme (diffview's colorize), for the appearance now. Staged:
  // HEAD to the index; Changes: the index to the working file. Local repos only.
  colorize(section, f, cx) {
    if (this.on || !this.root || f.binary || f.loaded === false || !f.hunks.length) return;
    const k = `${section}:${f.path}`, dark = settings().dark !== false, busy = `${k}:${dark}`;
    if (this.coloring.has(busy)) return;
    const l = f.letter, root = this.root;
    const sides = section === "staged"
      ? { old: l === "A" ? null : { rev: "HEAD", path: f.old ?? f.path }, new: l === "D" ? null : { rev: "", path: f.path } }
      : { old: l === "U" ? null : { rev: "", path: f.old ?? f.path }, new: l === "D" ? null : { rev: "worktree", path: f.path } };
    this.coloring.add(busy);
    cx.spawn(async (cx) => {
      const tk = await colorize("kt-diff", root, f, sides, dark).catch(() => null);
      this.coloring.delete(busy);
      if (tk && this.root === root) { this.tokens[k] = tk; cx.notify(); }
    });
  }

  // An unfolded image: before = HEAD, after = the index (staged) or the working file (local only).
  preview(section, f, cx) {
    const k = `${section}:${f.path}`;
    if (!IMAGE.test(f.path) || this.on || this.previews[k] || !this.root) return;
    const l = f.letter;
    const before = l === "A" || l === "U" ? null : "HEAD";
    const after = l === "D" ? null : section === "staged" ? "" : "worktree";
    const root = this.root;
    this.previews[k] = null;
    cx.spawn(async (cx) => {
      const pv = await loadPreview(root, f, before, after);
      if (this.root === root) { this.previews[k] = pv; cx.notify(); }
    });
  }

  // ---------- actions ----------

  // Runs git steps in order, stops at the first failure and shows its message.
  git(label, steps, cx) {
    if (this.busy || !this.root) return;
    const root = this.root, on = this.on;
    this.busy = label;
    this.error = null;
    this.note = null;
    cx.spawn(async (cx) => {
      try {
        for (const [cmd, args, timeout] of steps) {
          const r = await exec(cmd, args, { cwd: root, on, timeout: timeout ?? 30e3 });
          if (r.code !== 0) throw new Error((r.stderr || r.stdout).trim() || tr("failedCode", { cmd, sub: args[0], code: r.code }));
          if (cmd === "git" && args[0] === "commit") { this.message = ""; this.input.set_value(""); this.note = r.stdout.trim().split("\n")[0]; }
        }
      } catch (e) {
        this.offline = isOffline(e);
        if (!this.offline) this.error = String(e.message ?? e);
      }
      finally {
        // DATA-SYNC.md: stage, unstage, restore, clean, commit, push, PR: every mod showing this repo reads
        // again (on a failure too: a hook may have staged); a push or a PR moves GitHub's side as well.
        bump(...gitTopics(root), ...(steps.some(([cmd, args]) => cmd === "gh" || args[0] === "push") ? ["gh"] : []));
        this.busy = null;
        this.key = null;
        this.refresh(cx);
        cx.notify();
      }
    });
    cx.notify();
  }

  // Destructive: asked first. The dialog calls back `kt-diff.confirmed`.
  // kt-confirm (agent B's, when it's there) draws its own card: frame "none"; `label` is its button.
  ask(title, detail, label, steps, button, command = "kt-diff.confirmed", danger = true) {
    if (this.busy) return;
    if (steps) this.pending = { label, steps };
    const own = this.confirmMod === "kt-confirm";
    // kt-confirm draws its own veil full window; the shipped confirm keeps its box.
    openOverlay({ mod: this.confirmMod, kind: "dialog", ...(own ? { frame: "none", width: 1, height: 1 } : { width: 460, height: steps ? 210 : 260 }),
      props: { title, detail, command: { name: command }, danger, label: button } });
  }

  commit(cx, all) {
    const msg = this.message.trim();
    // Not ready (another place, not read yet): this.root is still the previous repo's.
    if (!msg || this.busy || !this.root || !this.ready) return;
    if (!all && !this.staged.length) { this.error = tr("nothingStaged"); cx.notify(); return; }
    this.menu = false;
    // The staged files' latest content, and only theirs (deletions stage with add too).
    const paths = this.staged.flatMap((f) => (f.old ? [f.path, f.old] : [f.path]));
    this.git("Commit", [
      ["git", all ? ["add", "-A"] : ["add", "-A", "--", ...paths]],
      ["git", ["commit", "-m", msg], 120e3],
    ], cx);
  }

  // ✨: a commit message from the staged changes and the repo's conventions, by Claude Haiku
  // (`claude -p`, the subscription's login: ANTHROPIC_API_KEY unset; no tools, MCP, settings
  // sources, hooks or saved session). It fills the field (asking before replacing one) and never
  // commits. Clicked again while it runs, it cancels (kills the call). The prompt goes through a
  // file under data/ (exec takes no stdin), deleted afterwards.
  generate(cx) {
    if (this.gen) {
      const g = this.gen;
      this.gen = null;
      cx.spawn(async () => { const pid = (await fs.readFile(g.pid, "utf8").catch(() => "")).trim(); if (/^\d+$/.test(pid)) await exec("kill", [pid]).catch(() => {}); });
      return;
    }
    if (!this.staged.length || !this.root || this.on || this.busy || !this.ready) return;
    const root = this.root, token = {};
    const dir = `${appHome()}/data/kt-diff`;
    const file = `${dir}/commit-prompt.txt`, pid = `${dir}/commit-gen.pid`;
    this.gen = { token, pid };
    cx.spawn(async (cx) => {
      let out = null, error = null;
      try {
        const git = async (args) => (await exec("git", [...READ, ...args], { cwd: root })).stdout;
        // fs reads only under the home folder; ls and readTextFile reach a repo anywhere.
        const read = async (p) => { try { return await readTextFile(`${root}/${p}`); } catch { return null; } };
        const list = async (d) => { try { return (await exec("ls", ["-A", d], { cwd: root })).stdout.split("\n").filter(Boolean); } catch { return []; } };
        const prompt = await commitPrompt(git, read, list);
        await fs.mkdir(dir, { recursive: true }).catch(() => {});
        await fs.writeFile(file, prompt);
        const r = await exec("env", ["-u", "ANTHROPIC_API_KEY", "sh", "-c",
          'echo $$ > "$2"; exec claude -p --model haiku --tools "" --strict-mcp-config --setting-sources "" --no-session-persistence --disable-slash-commands --system-prompt "$3" < "$1"',
          "sh", file, pid, SYSTEM], { cwd: root, timeout: 60e3 });
        if (r.code !== 0) error = (r.stderr || r.stdout).trim().split("\n").slice(-3).join(" ") || tr("claudeFailed", { code: r.code });
        else out = cleanMessage(r.stdout);
      } catch (e) { error = String(e.message ?? e); }
      finally { await fs.unlink(file).catch(() => {}); }
      if (this.gen?.token !== token) return; // cancelled, or another repo
      this.gen = null;
      if (error || !out) notify({ title: tr("notGenerated"), body: error ?? tr("emptyAnswer"), level: "error", timeout: 6000 });
      else if (!this.message.trim()) { this.input.set_value(out); this.message = out; }
      else {
        this.generated = out;
        this.ask(tr("replace.title"), tr("replace.detail", { message: out }), null, null, tr("replace.button"), "kt-diff.overwrite", false);
      }
      cx.notify();
    });
    cx.notify();
  }

  // ✨ in the message field: off until something is staged; a spinner (click: cancel) while it runs.
  sparkle(t) {
    const running = Boolean(this.gen);
    const ready = running || (this.ready && this.staged.length > 0 && Boolean(this.root) && !this.on && !this.busy);
    return h_flex().id("cg-generate").flex_none().size(26).items_center().justify_center().rounded_full()
      .text_color(running ? t.accent : ready ? t.muted : t.dim)
      .when(!ready, (el) => el.opacity(0.5))
      .tooltip(running ? tr("cancelGen") : this.on ? localOnly(this.on) : ready ? tr("generate") : tr("stageFirst"))
      .when(ready, (el) => el.cursor_pointer().hover((s) => s.bg(t.hover).text_color(t.foreground)))
      .on_mouse_down("left", (_e, cx) => cx.stop_propagation())
      .on_click((_e, cx) => { if (ready) this.generate(cx); cx.notify(); })
      .child(running ? svg(I("refresh-cw")).size(13).spin(900) : svg(MINE("sparkles")).size(14));
  }

  // A file of Changes back to its last commit (an untracked one: off the disk), asked first.
  discard(f) {
    if (f.letter === "U")
      this.ask(tr("delete.title", { path: f.path }), tr("delete.detail"), tr("delete.busy"), [["git", ["clean", "-f", "--", f.path]]], tr("delete.button"));
    else
      this.ask(tr("discard.title", { path: f.path }), tr("discard.detail"), tr("discard.busy"), [["git", ["restore", "--", f.path]]], tr("discard.button"));
  }

  rowActions(t, section, f) {
    const id = `cg:${section}:${f.path}`;
    const abs = this.on ? null : `${this.root}/${f.path}`;
    const out = [];
    if (section === "staged") {
      out.push(action(t, `${id}:unstage`, I("minus"), tr("unstage"), (cx) => this.git(tr("unstaging"), [["git", ["restore", "--staged", "--", ...(f.old ? [f.path, f.old] : [f.path])]]], cx)));
    } else {
      out.push(action(t, `${id}:discard`, MINE("rotate-ccw"), f.letter === "U" ? tr("deleteUntracked") : tr("discard"), () => this.discard(f)));
      out.push(action(t, `${id}:stage`, I("plus"), tr("stage"), (cx) => this.git("Stage", [["git", ["add", "-A", "--", f.path]]], cx)));
    }
    if (abs) {
      out.push(action(t, `${id}:zed`, I("external-link"), tr("openZed"), () => zed(abs, f.letter === "D" ? 0 : firstLine(f))));
      out.push(action(t, `${id}:nvim`, MINE("copy"), tr("copyNvim"), (cx) => cx.write_to_clipboard(`nvim +${firstLine(f)} '${abs.replace(/'/g, "'\\''")}'`)));
    }
    return out;
  }

  // ---------- pieces ----------

  // A full-width pill button; primary = solid ink.
  button(t, id, label, icon, primary, enabled, onClick) {
    return h_flex().id(id).flex_1().h(32).gap(7).items_center().justify_center().rounded_full().border(1)
      .border_color(primary && enabled ? t.solid : t.border).bg(primary && enabled ? t.solid : t.background)
      .text_size(12.5).font_medium().text_color(primary && enabled ? t.solid_foreground : enabled ? t.foreground : t.dim)
      .when(enabled, (el) => el.cursor_pointer().hover((s) => (primary ? s.opacity(0.88) : s.bg(t.hover))).on_click((_e, cx) => onClick(cx)))
      .when(Boolean(icon), (el) => el.child(svg(icon).size(13)))
      .child(label);
  }

  // A section into cg-list as direct children (its header, then each file and its open diff), so
  // the cursor's row is one cg-list can scroll to; `flat` gets what the cursor walks, in order.
  section(t, name, label, files, headActions, flat, put, gap, cx) {
    const folded = Boolean(this.fold[name]);
    const dark = settings().dark !== false;
    const o = {
      id: `cg:${name}`, map: this.map, dark, root: this.on ? null : this.root, compact: true, sk: skeleton(t, this.motion),
      preview: this.on ? null : (f) => this.previews[`${name}:${f.path}`],
      tokens: (f) => { const tk = this.tokens[`${name}:${f.path}`]; return tk?.mode === (dark ? "dark" : "light") ? tk : null; },
      isOpen: (f) => this.open.has(`${name}:${f.path}`),
      isHot: (f) => this.hot === `${name}:${f.path}`,
      toggle: (f, cx) => { this.pick(`${name}:${f.path}`); this.toggle(name, f, cx); },
      hover: (f, on, cx) => {
        const k = `${name}:${f.path}`;
        const next = on ? k : this.hot === k ? null : this.hot;
        if (next !== this.hot) { this.hot = next; cx.notify(); }
      },
      letter: (f) => f.letter,
      actions: (f) => this.rowActions(t, name, f),
    };
    // The keys' cursor, while Changes has the keyboard: an accent ring on the ink.
    const ring = (id) => this.keyed && this.cur === id;
    const head = `h:${name}`;
    flat.push({ id: head, head: true, section: name });
    // Its count rolls (roll.js); the repo in its reels' id: another repo's shows at once.
    put(head, sectionHead(t, { id: `cg-head-${name}`, label, count: files.length, folded, ring: ring(head), gap,
      toggle: (cx) => { this.pick(head); this.fold[name] = !folded; cx.notify(); }, actions: headActions, roll, m: this.motion, scope: this.root }));
    // diffview's fileItems (Inbox's Code and History draw theirs the same): the rows by path, opening and
    // closing on their height (a stage moves a file from one section to the other, a fold closes them),
    // the cursor's ring, each diff after its row, unfolding and folding on its height.
    for (const { el, f } of fileItems(t, this.motion, cx, `cg-rows-${name}`, folded ? [] : files, o,
      { ring: (f) => ring(`${name}:${f.path}`), fold: (f) => `cg-open:${name}:${f.path}` })) {
      const id = f ? `${name}:${f.path}` : null;
      if (f) flat.push({ id, section: name, file: f });
      put(id, el);
    }
  }

  // panel.js: the whole view glides in and out with the right panel (#73).
  render(cx) {
    return panelIn(this.motion, this.draw(cx));
  }

  draw(cx) {
    // Coming into view: look now, not at the next tick.
    const vis = visible();
    // Another thread, space or worktree: read now, shown or back from hidden; back on the tab at the same
    // place, only past 10 s (reread.js). this.loc moves only while shown: a hidden copy doesn't render.
    const loc = JSON.stringify(where());
    const read = !checking() && shouldRead({ vis, shown: this.shown, loc, lastLoc: this.loc, readAt: this.readAt, now: Date.now() });
    if (vis) this.loc = loc;
    if (read) this.refresh(cx);
    if (read && !this.shown) cx.spawn(async () => { await cleanPreviews(); await cleanTokens("kt-diff"); });
    if (vis && !this.shown) this.showGen++;
    this.shown = vis;
    // DATA-SYNC.md: another mod's action on this repo, or an agent of this space that stopped working.
    const sp = spaces().find((s) => s.active)?.id;
    if (vis) refreshOn(this, cx, "git", [...gitTopics(this.root), ...(sp ? [`agent:${sp}`] : [])], async (cx) => { this.key = null; this.refresh(cx); });
    // This place's machine was away (machines.js): back now (kt.machines or machines() moved), read at once.
    const off = this.offline && this.offline === where().on ? this.offline : null;
    if (off && vis && !checking() && reachable(off)) { this.offline = null; this.key = null; this.refresh(cx); }
    const m = frame(this.motion, Boolean(shared("kt.reducedMotion")));
    const t = theme();
    const away = off ? notice(t, off, { id: "cg-offline" }) : null;
    const S = skeleton(t, m);
    // Read for this place (readyFor): before the first read, and after a change of thread, space or
    // worktree until its own read answers, the skeleton, never the previous repo's branch and files; and
    // nothing acts on that repo meanwhile (commit, PR, the sections' actions). ponytail: the place is the
    // thread's folder, so a cd within the same repo shows the skeleton for one read too; key it by the
    // repo's root if that flicker bites.
    const ready = (this.ready = readyFor(this.readFor, loc));
    const staged = ready ? this.staged : [], changes = ready ? this.changes : [];
    this.keyed = this.handle.is_focused();
    const p = palette(t);
    const hasMsg = Boolean(this.message.trim());
    const canCommit = hasMsg && staged.length > 0 && !this.busy;
    const add = [...staged, ...changes].reduce((n, f) => n + f.add, 0);
    const del = [...staged, ...changes].reduce((n, f) => n + f.del, 0);
    const card = () => v_flex().rounded(16).border(1).border_color(t.border).bg(t.background);
    const commitZone = card().flex_none().p(12).gap(8)
      .child(h_flex().h(22).gap(8).items_center()
        .child(svg(I("git-branch")).size(14).flex_none().text_color(t.muted))
        // Not read for this place yet: the branch as a bar (skeleton.js), breathing. No repo: nothing (the
        // list says so).
        .child(div().min_w(0).truncate().font_family(MONO).text_size(12.5).text_color(t.foreground)
          .child(!ready ? S.pulse(S.line(110, { h: 7, lh: 16 }).id("cg-branch-sk")) : this.branch === "" ? tr("detached") : this.branch ?? ""))
        .child(div().flex_1())
        .when(add + del > 0, (el) => el.child(h_flex().flex_none().gap(6).font_family(MONO).text_size(11)
          // Their ids carry the repo: another repo's totals show at once, not rolling.
          .child(roll(m, `cg-add-${this.root}`, `+${add}`, 15).text_color(p.ok)).child(roll(m, `cg-del-${this.root}`, `−${del}`, 15).text_color(p.err))))
        .when(this.keyed || this.typing, (el) => el.child(modePill(t, this.vim))))
      // The message: the accent while typing; the cursor's ring on the ink when it's on it in NORMAL.
      .child(h_flex().id("cg-message").min_h(36).pl(12).pr(5).py(5).gap(4).items_start().rounded(12).border(1)
        .border_color(this.typing ? t.accent : this.keyed && this.cur === "message" ? alpha(t.accent, "99") : t.input)
        .bg(!this.typing && this.keyed && this.cur === "message" ? alpha(t.accent, "24") : t.background).cursor_text()
        .on_key_down((e, cx) => {
          if (e.key === "enter" && e.modifiers?.platform) { this.commit(cx, false); cx.stop_propagation(); }
        })
        .child(Textarea.new(this.input).flex_1().min_w(0).text_size(13).text_color(t.foreground))
        .child(this.sparkle(t)))
      .child(h_flex().gap(6)
        .child(this.button(t, "cg-commit", this.busy ? `${this.busy}…` : "Commit", I("check"), true, canCommit, (cx) => this.commit(cx, false)))
        .child(h_flex().id("cg-commit-menu").size(32).flex_none().items_center().justify_center().rounded_full().border(1).border_color(t.border)
          .text_color(t.muted).cursor_pointer().hover((s) => s.bg(t.hover).text_color(t.foreground))
          .on_click((_e, cx) => { this.menu = !this.menu; cx.notify(); })
          .child(svg(I(this.menu ? "chevron-down" : "chevron-right")).size(14))))
      .when(this.menu, (el) => el.child(v_flex().p(4).gap(2).rounded(12).border(1).border_color(t.border).bg(t.popover)
        .child(h_flex().id("cg-commit-all").h(30).px(10).gap(8).items_center().rounded(8).text_size(12.5)
          .text_color(hasMsg ? t.foreground : t.dim)
          .when(hasMsg && ready && !this.busy, (el) => el.cursor_pointer().hover((s) => s.bg(t.hover)).on_click((_e, cx) => this.commit(cx, true)))
          .child(svg(I("plus")).size(13)).child(tr("stageAllCommit")))
        .child(div().px(10).pb(4).text_size(11).text_color(t.dim).child(tr("commitNote")))))
      .child(h_flex().child(this.button(t, "cg-pr", tr("createPr"), I("git-pull-request"), false, ready && Boolean(this.root) && !this.busy && !this.on,
        (cx) => this.git(tr("createPr"), [["gh", ["pr", "create", "--fill", "--web"], 60e3]], cx))
        // --web opens a browser where gh runs: on another machine, not on this screen.
        .when(Boolean(this.on), (el) => el.tooltip(localOnly(this.on)))))
      .when(Boolean(away), (el) => el.child(away))
      .when(Boolean(this.error), (el) => el.child(div().px(12).py(8).rounded(12).border(1).border_color(alpha(p.err, "4d")).bg(alpha(p.err, "1a"))
        .font_family(MONO).text_size(11.5).text_color(p.err).child(this.error)))
      .when(Boolean(this.note) && !this.error, (el) => el.child(div().px(12).font_family(MONO).text_size(11.5).text_color(p.ok).child(this.note)));
    const head = (name) => {
      const id = `cg:${name}`;
      if (name === "staged") return [action(t, `${id}:unstage-all`, I("minus"), tr("unstageAll"), (cx) => this.git(tr("unstaging"), [["git", ["restore", "--staged", "--", "."]]], cx))];
      const tracked = this.changes.filter((f) => f.letter !== "U").length;
      return [
        ...(tracked ? [action(t, `${id}:discard-all`, MINE("rotate-ccw"), tr("discardAll"), () =>
          this.ask(tr("discardAll.title"), tr("discardAll.detail", { n: tracked }), tr("discard.busy"), [["git", ["restore", "--", "."]]], tr("discard.button")))] : []),
        ...(this.changes.length ? [action(t, `${id}:stage-all`, I("plus"), tr("stageAll"), (cx) => this.git("Stage", [["git", ["add", "-A"]]], cx))] : []),
        action(t, `${id}:refresh`, I("refresh-cw"), tr("refresh"), (cx) => { this.key = null; this.refresh(cx); }),
      ];
    };
    // Not read for this place yet: file rows (28 px, skeleton.js), breathing, in place of the sections
    // (no « Changes 0 » before the answer). A read that failed there says so (no skeleton for ever).
    const empty = this.root === null ? tr("noRepo") : this.root === undefined ? this.error : tr("clean");
    // cg-list's children, flat (6 px between the sections, 1 inside), the cursor's brought into
    // view once after it moved; the message is the cursor's first stop, above the list.
    const flat = [{ id: "message" }];
    const items = [];
    const put = (id, el) => {
      if (this.reveal && id && id === this.cur) this.listScroll.scroll_to_item(items.length);
      items.push(el);
    };
    // i18n: tech (Staged: git's word; Changes: the panel's name)
    if (staged.length > 0) this.section(t, "staged", "Staged", staged, head("staged"), flat, put, false, cx);
    if (ready) this.section(t, "changes", "Changes", changes, head("changes"), flat, put, staged.length > 0, cx); // i18n: tech
    this.flat = flat;
    this.reveal = false;
    const list = card().flex_1().min_h(0)
      // overflow_y_scroll + a Scrollbar of the same id: scroll_to_item does nothing on overflow_y_scrollbar.
      .child(div().relative().flex_1().min_h(0)
        .child(v_flex().id("cg-list").size_full().overflow_y_scroll().track_scroll(this.listScroll).p(4).gap(1)
          .children(items)
          .when(!staged.length && !changes.length && (!ready || Boolean(empty)), (el) => el.child(!ready
            ? S.pulse(S.list(4, { h: 28, icon: 14, lines: [0.5], px: 8, gap: 8, gap_y: 1 }).mt(5).id("cg-list-sk"))
            : div().mt(5).px(12).py(6).text_size(12.5).text_color(t.dim).child(empty))))
        .child(Scrollbar.vertical("cg-list").absolute().inset_0()));
    // The keyboard stays on the root; the content fades in each time the tab is shown.
    return v_flex().id("kt-diff").size_full().text_color(t.foreground)
      .track_focus(this.handle)
      .on_key_down((e, cx) => this.key(e, cx))
      .child(enter(m, v_flex().size_full().gap(4).child(commitZone).child(list), `cg-in-${this.showGen}`, { dy: 0 }));
  }
}
