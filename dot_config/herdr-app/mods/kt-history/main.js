// kbrdn Threads' History (the "history" child of the right panel's stack): the
// shown tab's repo, its last 200 commits as a git graph in colored lanes
// (computed here from `git log --topo-order` hashes and parents), each with its
// title, author, date, short sha and its refs as pills colored by name. Click a
// commit: it keeps the ink and its files show in a lower card, in the same
// compact rows as Changes, each unfolding into its diff after DIFF-SPEC (one
// `git diff -M` against its first parent: statuses, counts and patches at once,
// and a merge shows what it brought), an image into its before/after preview.
// The files can't unfold inside the list: a virtual list's rows take no
// handlers. The header card draws the commits per day over the last 30 days (viz.js' trend), from a
// second `git log --since` read with the list. Read-only. Polls every 10 s while shown.
// Keys (vim.js; kt-keys lists them, group "panel"): ctrl-b l (pane.go, "focus") or
// `kt-history.key:<keys>` gives History the keyboard: a cursor (an accent ring on the ink) on a
// commit. j k gg G ctrl-d ctrl-u move; l / enter / o open the commit's files (again: go into
// them), h closes them; tab / shift-tab go between the commits and the open commit's files, where
// j k move, l / h unfold / fold a file's diff (h on a folded one: back to the commits), enter / o
// as a click; y copies the hash (a file: its path); r reads again; esc gives the keyboard back
// to the terminal; [ ] the panel's previous / next tab; ? the keys.

import { View, div, svg, PathBuilder } from "gpui-kit";
import { v_flex, h_flex, v_virtual_list, Scrollbar, ScrollHandle, VirtualListScrollHandle } from "gpui-base";
import { exec as hostExec, focused, panes, spaces, theme, layout, settings, readTextFile, appHome, nextCommand, checking, run, notify, openOverlay, shared, watchFolder } from "herdr";
import { parsePatch } from "./diff.js";
import { ICON_MAP } from "./icons.js";
import { fileItems, palette, alpha, action, MONO, IMAGE, loadPreview, cleanPreviews, viewImages, colorize, cleanTokens } from "./diffview.js";
import { Vim, keysOf, step } from "./vim.js";
import { motionState, frame, enter } from "./motion.js";
import { skeleton, readyFor } from "./skeleton.js";
import { gitTopics, refreshOn } from "./bus.js";
import { makeT, date } from "./i18n.js";
import strings from "./strings.js";
// kt-keys' machines.js (a byte-identical copy, with machines.strings.js): a remote repo's machine away
// refuses the read at once and says so (notice), and a remote repo is read every 60 s at most (#62).
import { guard, isOffline, reachable, due, notice } from "./machines.js";

const tr = makeT(strings);
const exec = guard(hostExec);
const REMOTE_EVERY = 60e3;
// The header's pixel band (kt-keys' dither.js, a byte-identical copy).
import { ditherBand, TOP } from "./dither.js";
import { shouldRead } from "./reread.js";
// The header's activity curve (kt-keys' viz.js and viz.strings.js, byte-identical copies).
import { viz } from "./viz.js";

const ME = "history"; // this block's id in the layout's "panel-body" stack
const I = (name) => `mods/kt-threads/${name}.svg`;
const READ = ["--no-optional-locks", "-c", "core.fsmonitor=false", "-c", "core.quotePath=false", "-c", "log.showSignature=false"];
const PATCH = ["-M", "--no-color", "--no-ext-diff", "--no-textconv", "--src-prefix=a/", "--dst-prefix=b/"];
const EMPTY_TREE = "4b825dc642cb6eb9a060e54bf8d69288fbee4904";
const COUNT = 200;
const ROW = 44; // a commit row
const LANE = 14; // one lane's width
const DOT_Y = 14; // the dot sits on the title line
const MAX_LANES = 12;
const DAYS = 30; // the activity curve's window, today last
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
function visible() {
  const root = layout(), panel = find(root, "panel"), body = find(root, "panel-body");
  return Boolean(panel && !panel.hidden && body && (body.active ?? body.children?.[0]?.id) === ME);
}
function where() {
  const s = spaces().find((x) => x.active), tab = s?.tabs.find((x) => x.active);
  const mine = panes().filter((p) => p.tab === tab?.id && p.terminal);
  const lead = mine.find((p) => p.program?.agent) ?? mine[0];
  return { cwd: lead?.cwd ?? focused()?.cwd ?? s?.folder ?? null, on: s?.machine ?? null };
}

// `%D` with --decorate=full: [{ name, kind: head|branch|remote|tag }], HEAD folded into its branch.
function refs(d) {
  const out = [];
  for (let r of d.split(", ").filter(Boolean)) {
    let head = false;
    if (r.startsWith("HEAD -> ")) { head = true; r = r.slice(8); }
    if (r === "HEAD") { out.push({ name: "HEAD", kind: "head" }); continue; }
    if (r.startsWith("tag: ")) out.push({ name: r.slice(5).replace(/^refs\/tags\//, ""), kind: "tag" });
    else if (r.startsWith("refs/heads/")) out.push({ name: r.slice(11), kind: "branch", head });
    else if (r.startsWith("refs/remotes/")) { if (!r.endsWith("/HEAD")) out.push({ name: r.slice(13), kind: "remote" }); }
    else out.push({ name: r, kind: "other" });
  }
  return out;
}

/**
 * Lanes for commits in topo order. Each row: { lane, color, width, segs: [[x0, y0, x1, y1, color]] }
 * in lane units and row fractions (0 top, "dot" the dot, 1 bottom). A commit takes the lane
 * waiting for it, other lanes waiting for it end in it, its first parent keeps the lane, other
 * parents get a lane (an existing one when already awaited).
 */
export function graph(commits) {
  const lanes = [];
  let next = 0;
  const free = (skip) => { const i = lanes.findIndex((l, j) => !l && j !== skip); return i < 0 ? lanes.length : i; };
  return commits.map((c) => {
    const top = lanes.slice();
    let idx = lanes.findIndex((l) => l && l.hash === c.hash);
    const tip = idx < 0;
    if (tip) { idx = free(-1); lanes[idx] = { hash: c.hash, color: next++ }; }
    const color = lanes[idx].color;
    const segs = [];
    top.forEach((l, j) => {
      if (!l) return;
      if (l.hash === c.hash) segs.push([j, 0, idx, "dot", l.color]);
      else segs.push([j, 0, j, "dot", l.color]);
    });
    lanes.forEach((l, j) => { if (j !== idx && l && l.hash === c.hash) lanes[j] = null; });
    const fresh = new Set();
    if (!c.parents.length) lanes[idx] = null;
    else {
      lanes[idx] = { hash: c.parents[0], color };
      for (const p of c.parents.slice(1)) {
        let k = lanes.findIndex((l) => l && l.hash === p);
        if (k < 0) { k = free(idx); lanes[k] = { hash: p, color: next++ }; fresh.add(k); }
        segs.push([idx, "dot", k, 1, lanes[k].color]);
      }
    }
    lanes.forEach((l, j) => {
      if (!l || fresh.has(j)) return;
      if (j === idx) segs.push([idx, "dot", idx, 1, color]);
      else if (top[j] && top[j].hash === l.hash) segs.push([j, "dot", j, 1, l.color]);
    });
    while (lanes.length && !lanes[lanes.length - 1]) lanes.pop();
    const width = Math.max(idx, ...segs.flatMap((s) => [s[0], s[2]])) + 1;
    return { lane: idx, color, width, segs, tip };
  });
}

// A commit's day (git's seconds): « 18 nov. », the year when it isn't this one.
const day = (at) => date(at * 1000);

// The activity curve's DAYS local days, by date and not by 86 400 s (the window may cross a DST
// change): `since`, the first one's midnight in git's seconds, and each day's index.
const dayOf = (d) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
function windowOf(now) {
  const d = new Date(now);
  const days = Array.from({ length: DAYS }, (_, i) => new Date(d.getFullYear(), d.getMonth(), d.getDate() - DAYS + 1 + i));
  return { since: Math.floor(days[0].getTime() / 1000), index: new Map(days.map((x, i) => [dayOf(x), i])) };
}
// Commits per day (git's seconds) in that window: a zero for a day without one, a date outside it dropped.
function perDay(stamps, index) {
  const out = new Array(DAYS).fill(0);
  for (const s of stamps) {
    const i = index.get(dayOf(new Date(s * 1000)));
    if (i != null) out[i]++;
  }
  return out;
}

export default class History extends View {
  init(_props, cx) {
    this.commits = [];
    this.rows = [];
    this.activity = null; // commits per day over DAYS days, today last: the header's curve
    this.sel = null; // the selected commit's hash
    this.detail = null; // { hash, files, error, loading }
    this.open = new Set();
    this.motion = motionState(); // ANIMATIONS.md: the tab and a commit's files fade in, a file opens on its height
    this.showGen = 0;
    this.previews = {}; // path -> { before, after } | { error }, for the selected commit's unfolded images
    this.tokens = {}; // path -> colorize's { mode, label, old, new }, for the selected commit's unfolded files
    this.hot = null;
    this.map = null;
    this.handle = cx.focus_handle();
    this.vim = new Vim();
    this.zone = "commits"; // where the keys' cursor is: "commits", or "files" (the open commit's)
    this.cur = null; // the cursor's commit hash
    this.fcur = null; // the cursor's file path, in "files"
    this.listScroll = VirtualListScrollHandle.new();
    this.filesScroll = ScrollHandle.new();
    this.range = null; // the commit rows last drawn: the cursor scrolls only when it leaves them
    if (checking()) return;
    cx.spawn(async (cx) => {
      try { this.map = JSON.parse(await readTextFile(`${appHome()}/${ICON_MAP}`)); } catch { this.map = null; }
      cx.notify();
    });
    cx.spawn(async (cx) => {
      for (;;) {
        const c = await nextCommand();
        if (c === "select-first" && this.commits[0]) this.select(this.commits.find((x) => x.parents.length === 1)?.hash ?? this.commits[0].hash, cx);
        else if (c.startsWith("select-")) { const h = this.commits.find((x) => x.hash.startsWith(c.slice(7)))?.hash; if (h && h !== this.sel) this.select(h, cx); }
        else if (c === "expand-first" && this.detail?.files?.[0]) this.toggle(this.detail.files[0], cx);
        else if (c === "view-first" || c === "view-compare") {
          const f = this.detail?.files?.find((x) => this.previews[x.path]?.after || this.previews[x.path]?.before);
          if (f) viewImages(f, this.previews[f.path], 0, c === "view-compare");
        }
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
    // A remote repo: the bus and coming back read at once; this tick only every 60 s (DATA-SYNC.md).
    cx.timer.every(10000, (cx) => { if (due(where().on, this.readAt, REMOTE_EVERY)) this.refresh(cx); });
    // The keyboard went away (Herdr doesn't always redraw then): drop the cursor. A hidden copy
    // doesn't render, so this tick notes that the tab went away: shown again, it reads and fades in.
    cx.timer.every(500, (cx) => {
      if (this.shown && !visible()) { this.shown = false; this.watchGit(cx); }
      if (this.keyed !== this.handle.is_focused()) cx.notify();
    });
  }

  // DATA-SYNC.md: a commit, a checkout or a fetch made outside Herdr (a terminal, an agent) shows at once.
  // While History shows a local repo, its git dir (and the common one, for a linked worktree) is
  // watched. Only refs, HEAD, logs and packed-refs count, never the index: any `git status` rewrites it,
  // and a watch on it would loop. Cancelled when the repo changes or the tab is hidden.
  watchGit(cx) {
    const root = visible() && !this.on ? this.root : null;
    if (root === this.watchRoot) return;
    this.watch?.cancel();
    this.watch = null;
    this.watchRoot = root;
    if (!root) return;
    cx.spawn(async (cx) => {
      const r = await exec("git", ["rev-parse", "--path-format=absolute", "--git-dir", "--git-common-dir"], { cwd: root }).catch(() => null);
      const dirs = [...new Set((r?.code === 0 ? r.stdout : "").split("\n").map((s) => s.trim()).filter(Boolean))];
      const counts = (p) => dirs.includes(p) || /\/(HEAD|ORIG_HEAD|packed-refs)$|\/(refs|logs)\//.test(p);
      while (dirs.length && this.watchRoot === root) {
        const ws = dirs.map((d) => watchFolder(d));
        this.watch = { cancel: () => ws.forEach((w) => w.cancel()) };
        const paths = await Promise.race(ws);
        ws.forEach((w) => w.cancel());
        if (this.watchRoot !== root) return;
        if (paths.some(counts)) this.refresh(cx);
      }
    });
  }

  // ---------- keys (vim.js; kt-keys lists them) ----------

  // The keyboard comes here: NORMAL, the cursor where it was, else on the open commit, else the first.
  focusIn() {
    this.handle.focus();
    this.vim.normal();
    if (!this.detail) this.zone = "commits";
    if (!this.commits.some((c) => c.hash === this.cur)) this.cur = this.sel ?? this.commits[0]?.hash ?? null;
    this.reveal = true;
  }

  key(e, cx) {
    if (!this.act(this.vim.handle(e), cx)) return; // not ours: ctrl-b, cmd-* go on
    cx.stop_propagation();
    cx.notify();
  }

  // The open commit's files in fileItems' order (by path).
  files() {
    return [...(this.detail?.files ?? [])].sort((a, b) => a.path.localeCompare(b.path));
  }

  // One vim action on History; false: not one it has, and the key goes on.
  act(a, cx) {
    if (!a) return false;
    if (a === "pending" || a === "count") return true;
    const files = this.files();
    const inFiles = this.zone === "files" && files.length > 0;
    const f = inFiles ? files.find((x) => x.path === this.fcur) : null;
    const c = this.commits.find((x) => x.hash === this.cur);
    // Into the open commit's files: the cursor where it was, else on the first.
    const dive = () => {
      if (!files.length) return;
      this.zone = "files";
      if (!files.some((x) => x.path === this.fcur)) this.fcur = files[0].path;
      this.reveal = true;
    };
    if (["down", "up", "top", "bottom", "half-down", "half-up"].includes(a)) {
      if (inFiles) {
        const j = step(a, files.indexOf(f), files.length, this.vim.count, 10);
        if (j >= 0) this.fcur = files[j].path;
      } else {
        const j = step(a, this.commits.indexOf(c), this.commits.length, this.vim.count, 12);
        if (j >= 0) this.cur = this.commits[j].hash;
      }
      this.reveal = true;
    } else if (a === "tab-next" || a === "tab-prev") {
      if (inFiles) { this.zone = "commits"; this.reveal = true; }
      else dive();
    } else if (inFiles && a === "left") {
      // A file's diff folds; on a folded one, back to the commits.
      if (f && this.open.has(f.path)) this.open.delete(f.path);
      else { this.zone = "commits"; this.reveal = true; }
    } else if (inFiles && a === "right") {
      if (f && !this.open.has(f.path)) this.toggle(f, cx);
    } else if (inFiles && a === "open") {
      if (f) this.toggle(f, cx);
    } else if (a === "left") {
      // The open commit's files close (its card's ×).
      this.sel = null;
      this.detail = null;
    } else if (a === "right" || a === "open") {
      // A click toggles; a key opens, and on the open commit goes into its files.
      if (c && c.hash !== this.sel) this.select(c.hash, cx);
      else if (c) dive();
    } else if (a === "yank") {
      const text = inFiles ? (f && this.root ? (this.on ? f.path : `${this.root}/${f.path}`) : null) : c?.hash;
      if (text) {
        cx.write_to_clipboard(text);
        notify({ title: tr("copied"), body: text, level: "success", timeout: 2000 });
      }
    } else if (a === "refresh") this.refresh(cx, true);
    else if (a === "escape") run("pane.go", { direction: "left" });
    else if (a === "help") openOverlay({ mod: "kt-keys", kind: "dialog", width: 1, height: 1, frame: "none", props: { group: "panel" } });
    else if (a === "panel-prev" || a === "panel-next") panelTab(a === "panel-next" ? 1 : -1, cx);
    else return false;
    return true;
  }

  refresh(cx, force) {
    // A read already running (maybe for the previous place): run once more when it ends.
    if (this.loading) { this.again = true; return; }
    if (!visible()) return;
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
          // Not a repo (a thread on ~): forget the key and the branch too, as kt-diff does, or coming back
          // to the same repo would find the same key and keep « pas de dépôt git ici ».
          if (this.root !== null) { this.root = null; this.key = null; this.branch = null; this.commits = []; this.rows = []; this.activity = null; this.sel = null; this.detail = null; cx.notify(); }
          return;
        }
        const root = top.stdout.trim();
        const git = (args) => exec("git", [...READ, ...args], { cwd: root, on });
        const win = windowOf(Date.now());
        const [log, br, act] = await Promise.all([
          git(["log", "--topo-order", "-n", String(COUNT), "--decorate=full", "--format=%H%x00%P%x00%an%x00%at%x00%D%x00%s"]),
          git(["branch", "--show-current"]),
          // The activity curve's commits, by committer date as --since reads it. A repo without commits fails: none.
          git(["log", `--since=@${win.since}`, "--format=%ct"]).catch(() => null),
        ]);
        // A repo without commits (an unborn HEAD) fails git log too: no commits, said as such, not an error.
        // Asked of git rather than read in its stderr, which is in the person's language.
        const unborn = log.code !== 0 && (await git(["rev-parse", "-q", "--verify", "HEAD"])).code !== 0;
        // The window too: past midnight, the same commits fall a day earlier.
        const key = JSON.stringify([root, on, br.stdout, log.stdout, act?.stdout, win.since]);
        if (key === this.key && !force) return;
        if (root !== this.root || on !== this.on) { this.sel = null; this.detail = null; this.open.clear(); }
        this.key = key;
        this.root = root;
        this.on = on;
        this.branch = br.stdout.trim(); // "": a detached HEAD, said at render
        this.error = log.code && !unborn ? log.stderr.trim() : null;
        this.commits = log.stdout.split("\n").filter(Boolean).map((l) => {
          const [hash, parents, author, at, d, subject] = l.split("\0");
          return { hash, parents: parents ? parents.split(" ") : [], author, at: +at, refs: refs(d ?? ""), subject: subject ?? "" };
        });
        this.rows = graph(this.commits);
        this.activity = perDay(act?.code === 0 ? act.stdout.split("\n").filter(Boolean).map(Number) : [], win.index);
        cx.notify();
      } catch (e) {
        // The machine away (machines.js): its notice, not a raw error.
        this.offline = isOffline(e);
        this.error = this.offline ? null : String(e);
        // Failed on another place than the one shown: its error, never the previous repo's commits.
        if (this.readFor !== at) { this.root = undefined; this.key = null; this.branch = null; this.commits = []; this.rows = []; this.activity = null; this.sel = null; this.detail = null; }
        cx.notify();
      } finally {
        this.loading = false;
        // An answer for this place, unchanged or failed alike: its skeleton gives way (readyFor).
        if (this.readFor !== at) { this.readFor = at; cx.notify(); }
        if (this.again) { this.again = false; this.refresh(cx, true); }
      }
    });
  }

  select(hash, cx) {
    if (this.sel === hash) { this.sel = null; this.detail = null; return; }
    const c = this.commits.find((x) => x.hash === hash);
    if (!c) return;
    this.sel = hash;
    this.open.clear();
    this.previews = {};
    this.tokens = {};
    this.detail = { hash, files: [], loading: true };
    const root = this.root, on = this.on;
    cx.spawn(async (cx) => {
      const r = await exec("git", [...READ, "diff", ...PATCH, c.parents[0] ?? EMPTY_TREE, hash], { cwd: root, on, timeout: 60e3 })
        .catch((e) => ({ code: 1, stdout: "", stderr: String(e) }));
      if (this.sel !== hash) return;
      this.detail = { hash, files: r.code ? [] : parsePatch(r.stdout), error: r.code ? r.stderr.trim() || tr("diffFailed") : null, loading: false };
      cx.notify();
    });
  }

  // Unfolds a file of the selected commit; an image gets its before (first parent) and after.
  toggle(f, cx) {
    if (this.open.has(f.path)) { this.open.delete(f.path); return; }
    this.open.add(f.path);
    const c = this.commits.find((x) => x.hash === this.sel);
    if (c) this.colorize(c, f, cx);
    if (!c || !IMAGE.test(f.path) || this.on || this.previews[f.path] !== undefined) return;
    const root = this.root, sel = this.sel;
    this.previews[f.path] = null;
    cx.spawn(async (cx) => {
      const pv = await loadPreview(root, f, f.status === "A" ? null : c.parents[0] ?? null, f.status === "D" ? null : sel);
      if (this.sel === sel) { this.previews[f.path] = pv; cx.notify(); }
    });
  }

  // An unfolded file's code in Zed's theme (diffview's colorize), for the appearance now: its
  // first parent's blob to the commit's (a root commit or an added file: no old side). Local repos only.
  colorize(c, f, cx) {
    if (this.on || !this.root || f.binary || !f.hunks.length) return;
    const parent = c.parents[0] ?? null, sel = c.hash, root = this.root;
    const sides = {
      old: f.status === "A" || !parent ? null : { rev: parent, path: f.old ?? f.path },
      new: f.status === "D" ? null : { rev: sel, path: f.path },
    };
    cx.spawn(async (cx) => {
      const tk = await colorize("kt-history", root, f, sides, settings().dark !== false).catch(() => null);
      if (tk && this.sel === sel) { this.tokens[f.path] = tk; cx.notify(); }
    });
  }

  // ---------- pieces ----------

  laneColors(t) {
    return settings().dark !== false
      ? [t.ansi12, t.ansi11, t.ansi14, t.ansi13, t.ansi9, t.ansi10]
      : [t.ansi4, t.ansi3, t.ansi6, t.ansi5, t.ansi1, t.ansi2];
  }

  pill(t, ref, colors) {
    let h = 0;
    for (const ch of ref.name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    const color = ref.kind === "head" ? t.accent : colors[h % colors.length];
    return h_flex().flex_none().max_w(150).h(18).px(7).gap(4).items_center().rounded_full().border(1).border_color(alpha(color, "4d")).bg(alpha(color, "1a"))
      .font_family(MONO).text_size(10.5).text_color(color)
      .when(Boolean(ref.head), (el) => el.child(svg(I("git-branch")).size(10).flex_none()))
      .when(ref.kind === "tag", (el) => el.child(div().flex_none().child("◆")))
      .child(div().min_w(0).truncate().child(ref.name));
  }

  graphCell(t, row, c, gw, colors) {
    const x = (j) => 6 + Math.min(j, MAX_LANES - 1) * LANE + LANE / 2;
    const y = (v) => (v === "dot" ? DOT_Y : v * ROW);
    const paths = new Map();
    for (const [x0, y0, x1, y1, ci] of row.segs) {
      const color = colors[ci % colors.length];
      if (!paths.has(color)) paths.set(color, PathBuilder.stroke(2));
      const p = paths.get(color), ya = y(y0), yb = y(y1);
      p.move_to(x(x0), ya);
      if (x0 === x1) p.line_to(x(x1), yb);
      else p.cubic_bezier_to(x(x1), yb, x(x0), (ya + yb) / 2, x(x1), (ya + yb) / 2);
    }
    const color = colors[row.color % colors.length];
    const merge = c.parents.length > 1;
    const head = c.refs.some((r) => r.head || r.kind === "head");
    const r = head ? 6 : merge ? 5 : 4;
    return div().relative().w(gw).h(ROW).flex_none()
      .children([...paths].map(([col, p]) => window.paint_path(p.build(), col).absolute().inset_0()))
      .child(div().absolute().left(x(row.lane) - r).top(DOT_Y - r).size(r * 2).rounded_full()
        .when(head || merge, (el) => el.border(2).border_color(color).bg(t.background))
        .when(!head && !merge, (el) => el.bg(color))
        .when(head, (el) => el.child(div().absolute().left(2).top(2).size(4).rounded_full().bg(color))));
  }

  commitRow(t, c, row, gw, colors) {
    const on = c.hash === this.sel;
    // The keys' cursor, while History has the keyboard: an accent ring on the ink, drawn over the
    // row (the lanes keep their geometry).
    const cursor = this.keyed && this.zone === "commits" && c.hash === this.cur;
    return h_flex().h(ROW).w_full().pr(10).rounded(12)
      .when(on || cursor, (el) => el.bg(alpha(t.accent, "24")))
      .when(cursor, (el) => el.relative().child(div().absolute().inset_0().rounded(12).border(1).border_color(alpha(t.accent, "99"))))
      .child(this.graphCell(t, row, c, gw, colors))
      .child(v_flex().flex_1().min_w(0).py(4).gap(2)
        .child(h_flex().h(20).gap(6).items_center()
          .child(div().flex_1().min_w(0).truncate().text_size(13).font_medium().text_color(on ? t.foreground : t.foreground).child(c.subject))
          .children(c.refs.slice(0, 2).map((r) => this.pill(t, r, colors)))
          .when(c.refs.length > 2, (el) => el.child(div().flex_none().font_family(MONO).text_size(10.5).text_color(t.dim).child(`+${c.refs.length - 2}`))))
        .child(h_flex().h(16).gap(8).items_center()
          .child(div().flex_1().min_w(0).truncate().text_size(11.5).text_color(t.muted).child(c.author))
          .child(div().flex_none().font_family(MONO).text_size(11).text_color(t.dim).child(day(c.at)))
          .child(div().flex_none().font_family(MONO).text_size(11).text_color(t.muted).child(c.hash.slice(0, 7)))));
  }

  details(t, cx) {
    const d = this.detail, c = this.commits.find((x) => x.hash === d.hash);
    const dark = settings().dark !== false;
    const o = {
      // The same compact rows as Changes (diffview.js's compactRow, byte-identical copy).
      id: "hi", map: this.map, dark, root: this.on ? null : this.root, compact: true, sk: this.S,
      preview: this.on ? null : (f) => this.previews[f.path],
      tokens: (f) => (this.tokens[f.path]?.mode === (dark ? "dark" : "light") ? this.tokens[f.path] : null),
      isOpen: (f) => this.open.has(f.path),
      isHot: (f) => this.hot === f.path,
      toggle: (f, cx) => { this.toggle(f, cx); cx.notify(); },
      hover: (f, on, cx) => {
        const next = on ? f.path : this.hot === f.path ? null : this.hot;
        if (next !== this.hot) { this.hot = next; cx.notify(); }
      },
    };
    const p = palette(t, dark);
    const add = d.files.reduce((n, f) => n + f.add, 0), del = d.files.reduce((n, f) => n + f.del, 0);
    // diffview's fileItems (Changes and Inbox's Code draw theirs the same): the rows by path, opening and
    // closing on their height (the commit is in the id: another commit's list replaces this one at once
    // and opens), the cursor's ring, each diff after its row, unfolding and folding on its height. The
    // cursor's row is scrolled to once after it moved.
    const cursor = (f) => this.keyed && this.zone === "files" && f.path === this.fcur;
    const items = [];
    for (const { el, f } of fileItems(t, this.motion, cx, `hi-rows-${d.hash}`, d.loading ? [] : this.files(), o,
      { ring: cursor, fold: (f) => `hi-open:${f.path}` })) {
      if (f && cursor(f) && this.reveal) { this.filesScroll.scroll_to_item(items.length); this.reveal = false; }
      items.push(el);
    }
    return enter(this.motion, v_flex().flex_1().min_h(0).rounded(16).border(1).border_color(t.border).bg(t.background), `hi-detail-${d.hash}`, { dy: 0 })
      .child(v_flex().flex_none().px(14).pt(12).pb(10).gap(4)
        .child(h_flex().gap(8).items_center()
          .child(svg(I("git-commit")).size(14).flex_none().text_color(t.muted))
          .child(div().flex_1().min_w(0).truncate().text_size(13.5).font_semibold().text_color(t.foreground).child(c?.subject ?? d.hash))
          .child(action(t, "hi-close", I("x"), tr("close"), (cx) => { this.sel = null; this.detail = null; cx.notify(); })))
        .child(h_flex().gap(8).items_center().font_family(MONO).text_size(11).text_color(t.muted)
          .child(div().flex_none().child(d.hash.slice(0, 10)))
          .child(div().min_w(0).truncate().child(`${c?.author ?? ""} · ${c ? day(c.at) : ""}`))
          .child(div().flex_1())
          .when(!d.loading, (el) => el.child(div().flex_none().child(tr("files", { n: d.files.length })))
            .child(div().flex_none().text_color(p.ok).child(`+${add}`)).child(div().flex_none().text_color(p.err).child(`−${del}`)))))
      .child(div().mx(14).flex_none().h(0).border_t(1).border_dashed().border_color(t.border))
      // overflow_y_scroll + a Scrollbar of the same id: scroll_to_item does nothing on overflow_y_scrollbar.
      .child(div().relative().flex_1().min_h(0)
        .child(v_flex().id("hi-files").size_full().overflow_y_scroll().track_scroll(this.filesScroll).p(4).gap(2)
          // While the commit is read: its file rows as bars (skeleton.js), breathing.
          .when(d.loading, (el) => el.child(this.S.pulse(this.S.list(4, { h: 28, icon: 14, lines: [0.5], px: 8, gap: 8, gap_y: 2 }).id("hi-files-sk"))))
          .when(Boolean(d.error), (el) => el.child(div().p(12).font_family(MONO).text_size(11.5).text_color(p.err).child(d.error)))
          .when(!d.loading && !d.error && !d.files.length, (el) => el.child(div().p(12).text_size(13).text_color(t.dim).child(tr("noFiles"))))
          .children(items))
        .child(Scrollbar.vertical("hi-files").absolute().inset_0()));
  }

  render(cx) {
    const vis = visible();
    // Another thread, space or worktree: read now, shown or back from hidden; back on the tab at the same
    // place, only past 10 s (reread.js). this.loc moves only while shown: a hidden copy doesn't render.
    const loc = JSON.stringify(where());
    const read = !checking() && shouldRead({ vis, shown: this.shown, loc, lastLoc: this.loc, readAt: this.readAt, now: Date.now() });
    if (vis) this.loc = loc;
    if (read) this.refresh(cx);
    if (read && !this.shown) cx.spawn(async () => { await cleanPreviews(); await cleanTokens("kt-history"); });
    if (vis && !this.shown) this.showGen++;
    this.shown = vis;
    // DATA-SYNC.md: another mod's action on this repo, or an agent of this space that stopped working.
    // History acts on nothing (read only): it bumps nothing. A commit made outside Herdr: watchGit.
    const sp = spaces().find((s) => s.active)?.id;
    if (vis) refreshOn(this, cx, "git", [...gitTopics(this.root), ...(sp ? [`agent:${sp}`] : [])], async (cx) => this.refresh(cx));
    if (!checking()) this.watchGit(cx);
    // This place's machine was away (machines.js): back now (kt.machines or machines() moved), read at once.
    const off = this.offline && this.offline === where().on ? this.offline : null;
    if (off && vis && !checking() && reachable(off)) { this.offline = null; this.refresh(cx, true); }
    const m = frame(this.motion, Boolean(shared("kt.reducedMotion")));
    const t = theme();
    const away = off ? notice(t, off, { id: "hi-offline" }) : null;
    const S = (this.S = skeleton(t, m)); // details() too
    // Read for this place (readyFor): before the first read, and after a change of thread, space or
    // worktree until its own read answers, the skeleton, never the previous repo's branch, curve, commits
    // or open commit. ponytail: the place is the thread's folder, so a cd within the same repo shows the
    // skeleton for one read too; key it by the repo's root if that flicker bites.
    const ready = readyFor(this.readFor, loc);
    this.keyed = this.handle.is_focused();
    if (!ready || !this.detail) this.zone = "commits";
    const colors = this.laneColors(t);
    const lanes = Math.min(MAX_LANES, Math.max(1, ...this.rows.map((r) => r.width)));
    const gw = 12 + lanes * LANE;
    const n = ready ? this.commits.length : 0;
    // The cursor's commit brought into view once after it moved, only when it left the rows last
    // drawn. ponytail: "drawn" may count a half-shown row; ask the list for its visible range if that bites.
    if (this.reveal && this.zone === "commits") {
      const at = this.commits.findIndex((c) => c.hash === this.cur);
      if (at >= 0 && (!this.range || at < this.range.start || at >= this.range.end)) this.listScroll.scroll_to_item(at, "center");
      this.reveal = false;
    }
    // DESIGN-REFERENCE.md: the project's pixel band behind the header, inside its border (width less 2,
    // radius 16 less 1), measured on the card itself.
    const reg = ready && this.root && (shared("kt.projects") ?? []).filter((x) => !x.machine && x.folder && !this.on && (this.root === x.folder || this.root.startsWith(`${x.folder}/`)))
      .sort((a, b) => b.folder.length - a.folder.length)[0];
    const tint = !reg?.color ? t.accent : reg.color.startsWith("#") ? reg.color : t[reg.color] ?? t.accent;
    // Under the branch, the commits per day over DAYS days (viz.js' trend) in the band's tint, the period
    // said above it. Its id carries the repo: another repo's curve draws in afresh, never from this one's
    // (reduced motion: at once). No repo: nothing (the list says it). No commit in the window: said in
    // words at the same height (a flat line would read as steady work).
    const total = this.activity?.reduce((s, v) => s + v, 0) ?? 0;
    // Not read for this place yet: the period's line and the curve (56 px) as bars, the 76 px both take,
    // so the header doesn't grow when they come.
    const activity = !ready ? div().px(14).pb(12).child(S.pulse(v_flex().id("hi-trend-sk").gap(6)
      .child(S.line(0.4, { h: 6, lh: 14 })).child(S.line(null, { h: 56, lh: 56, r: 4 }))))
      : !this.activity ? null : div().px(14).pb(12).child(total
      ? v_flex().gap(6)
        .child(div().h(14).truncate().font_family(MONO).text_size(10.5).text_color(t.muted).child(tr("activity", { n: total, days: DAYS })))
        .child(viz(t, m).trend(this.activity, { color: tint, id: `hi-trend:${this.on ?? ""}:${this.root}` }))
      : div().h(76).flex().items_center().justify_center().text_size(12).text_color(t.dim).child(tr("activityNone", { days: DAYS })));
    const band = ditherBand(this.headW - 2, 40, 15, alpha(tint, settings().dark !== false ? "6b" : "4d"), TOP);    const head = v_flex().id("hi-head").relative().overflow_hidden().flex_none().rounded(16).border(1).border_color(t.border).bg(t.background)
      .on_size_change((size, cx) => { if (Math.abs(size.width - (this.headW ?? 0)) > 0.5) { this.headW = size.width; cx.notify(); } })
      .when(Boolean(band), (el) => el.child(band))
      .child(h_flex().h(40).px(14).gap(8).items_center()
        .child(svg(I("git-branch")).size(14).flex_none().text_color(t.muted))
        // Not read for this place yet: the branch as a bar (skeleton.js), breathing. No repo: nothing (the
        // list says so).
        .child(div().min_w(0).truncate().font_family(MONO).text_size(12.5).text_color(t.foreground)
          .child(!ready ? S.pulse(S.line(110, { h: 7, lh: 16 }).id("hi-branch-sk")) : this.branch === "" ? tr("detached") : this.branch ?? ""))
        .child(div().flex_1())
        .when(this.keyed, (el) => el.child(modePill(t, this.vim)))
        .child(div().flex_none().font_family(MONO).text_size(11).text_color(t.dim).child(n ? `${n}${n >= COUNT ? "+" : ""} commits` : "")) // i18n: tech
        .child(action(t, "hi-refresh", I("refresh-cw"), tr("refresh"), (cx) => this.refresh(cx, true))))
      .when(Boolean(activity), (el) => el.child(activity));
    // Not read for this place yet: commit rows (ROW px: graph dot, subject, author · time) as bars
    // (skeleton.js), breathing.
    const empty = this.root === null ? tr("noRepo") : this.error ?? tr("noCommits");
    const list = v_flex().flex_1().min_h(0).rounded(16).border(1).border_color(t.border).bg(t.background).p(4)
      // Its machine away: the notice on top (over the commits last read, if any), no « pas de commit ».
      .when(Boolean(away), (el) => el.child(away))
      .when(!n && !(ready && away), (el) => el.child(!ready ? S.pulse(S.list(6, { h: ROW, icon: 10, round: true, lines: [0.6, 0.3] }).id("hi-list-sk"))
        : div().p(12).text_size(13).text_color(t.dim).child(empty)))
      .when(n > 0, (el) => el.child(div().flex_1().min_h(0).relative()
        .child(v_virtual_list("hi-list", n, ROW, (i) => this.commits[i].hash,
          (range) => {
            this.range = range;
            return this.commits.slice(range.start, range.end).map((c, k) => this.commitRow(t, c, this.rows[range.start + k], gw, colors));
          })
          .size_full()
          .track_scroll(this.listScroll)
          // A click selects (toggles) and takes the cursor along.
          .on_item_click((hash, cx) => { this.cur = hash; this.select(hash, cx); cx.notify(); }))
        .child(Scrollbar.vertical("hi-list").absolute().inset_0())));
    // The keyboard stays on the root; the content fades in each time the tab is shown.
    return v_flex().id("kt-history").size_full().text_color(t.foreground)
      .track_focus(this.handle)
      .on_key_down((e, cx) => this.key(e, cx))
      .child(enter(m, v_flex().size_full().gap(4), `hi-in-${this.showGen}`, { dy: 0 })
        .child(head)
        .child(list)
        .when(ready && Boolean(this.detail), (el) => el.child(this.details(t, cx))));
  }
}
