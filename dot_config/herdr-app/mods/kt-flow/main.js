// kbrdn Threads' Flow (the "flow" child of the right panel's stack): the
// claude-flow timeline of the focused terminal (else the shown tab's agent),
// read from ~/.claude/cache/herdr/<terminal>.flow.json ({ v: 1, workflow,
// steps: [{ id, label, state, tool, source }], updatedAt }, written by
// claude-flow). On top, the context: the workflow's readable name, the project
// and branch (the flow's, else the terminal's; its issue), the PR and the CI from
// /me:report's facts (that branch's report), the
// progress by steps (viz.js steps: a dithered segment a step). Below, the steps grouped in phases
// (Préparation, Spec, Implémentation, Livraison, Clôture), a phase all done
// folded to one line, each step one 28 px row with its details as pills.
// Read-only. Follows the cache folder with watchFolder (10 s fallback), only
// while shown; loop animations only on the running step: its row's pulse and its segment's.
// Implémentation unfolds like Review (#36), open while it runs: « Maintenant », what its agent runs now
// (the sidebar's live line « ↳ … », its running sub-agents and their k / n), then its todos, a row a task
// in the session's order (past 12: the open ones, then « +N faites »), their n / total on the step's row,
// the running one breathing while its agent works only. No todo and nothing running: no fold. All from
// its agent's herdr-bridge json (<terminal>.json) read as the sidebar's focus card reads it (threads-io.js
// readLive and threads-model.js lineOf / shownAgents, byte-identical copies), when that file changes, at
// most every 3 s as the sidebar.
// Keys (vim.js; kt-keys lists them, group "panel"): ctrl-b l (pane.go, "focus") or
// `kt-flow.key:<keys>` gives Flow the keyboard: a cursor (an accent ring on the ink), first on the
// header of the phase running (else the first unfolded one). j k gg G ctrl-d ctrl-u move over
// phases, steps, Review's passes and their findings; h folds (a phase, Review, a pass, a finding;
// on a row that doesn't fold: folds its parent and goes there), l unfolds; enter / o as a click
// (a phase, Review, the tasks, « +N faites », a pass, a finding; the issue and PR steps open theirs in the
// Inbox); O opens a finding in Zed, the issue, PR, review or CI step's page on GitHub; gi / gI the issue in
// the Inbox / on GitHub, gp / gP the PR (links.js); y copies (a finding's place, a pass's sha, a task's text, a step's label); r reads again; esc gives the keyboard back to
// the terminal; [ ] the panel's previous / next tab; ? the keys. While Flow has the keyboard it
// keeps following the same terminal.
// Links (#40, kt-gwm's model: a pill in Herdr, the GitHub icon beside it in the browser): the issue, the PR
// and its checks (the CI pill) on the header and on their steps open in kt-inbox (shared "kt.inbox.open",
// then its page), the review and CI steps have their GitHub icon; the branch line opens Worktrees, and
// Changes and History when the terminal is on the flow's branch (they follow the terminal).
// CI unfolds like Review: the PR's pushed commits (its last 10, read by `gh` on unfold, on r and
// when the followed terminal changes, never in a loop; a commit whose checks all ended is never
// read again), a bar and a row each, one unfolded at a time into its checks (failures first), a
// failed one's "Extrait des logs" (`gh run view --log-failed`, its last 40 lines) on demand. Keys
// as Review's: j k move, l / h unfold / fold (a commit, a check's logs), enter as a click, O
// opens a check's run, y copies a commit's sha or a check's link.

import { View, div, svg, PathBuilder, Background } from "gpui-kit";
import { v_flex, h_flex, ScrollHandle, Scrollbar } from "gpui-base";
import { focused, panes, spaces, theme, layout, settings, readTextFile, watchFolder, exec, home, nextCommand, checking, run, notify, openOverlay, shared, setShared } from "herdr";
import * as fs from "fs/promises";
import { nameOf, speak, workflowName, issueOf, flowBranch, phasesOf, details, findPlans, passOf, decisionOf, locOf,
  checkState, checkMs, tally, checkOrder, duration, runIdOf, logTail, ciLine, taskList } from "./steps.js";
import { makeT, relative } from "./i18n.js";
import strings from "./strings.js";
import { Vim, keyOf, keysOf, step } from "./vim.js";
// Where the issue, PR, checks and branch buttons and gi gI gp gP go (pure: links.check.mjs).
import { target, checksOf, stepKind, stepUrl, inHerdr, toBrowser, toPage, toTab, gLink } from "./links.js";
import { motionState, frame, enter, collapse, stagger } from "./motion.js";
import { skeleton, readyFor } from "./skeleton.js";
import { refreshOn } from "./bus.js";
// kt-threads' reads (threads-io.js with threads-model.js, pr-pick.js, thread-filter.js: byte-identical
// copies): the followed agent's herdr-bridge json, for its todos, its live line and its sub-agents.
import { readLive } from "./threads-io.js";
import { lineOf, shownAgents, isAlive } from "./threads-model.js";
// Monocode's dithered visuals (kt-keys' viz.js) and the header's pixel band (dither.js), byte-identical copies.
import { viz } from "./viz.js";
// kt-keys' roll.js (a byte-identical copy): viz's figures and the CI pill's count roll to their new digits.
import { roll, rollText } from "./roll.js";
import { ditherBand, TOP } from "./dither.js";

const ME = "flow"; // this block's id in the layout's "panel-body" stack
const MONO = "Monaspace Krypton";
const I = (name) => `mods/kt-threads/${name}.svg`;
const GH = "mods/kt-gwm/github.svg";
// What links.js acts with.
const H = { run, exec, setShared, now: () => Date.now() };
// A theme color with alpha `a`, replacing any it has (glass themes are #rrggbbaa).
const alpha = (c, a) => `${String(c).slice(0, 7)}${a}`;
// A skipped step's dot (#41), in an 8 px box with no border (as ring.js: everything painted): the to-do
// ring (1 px, radius 3.5) and a disc of radius 3 inside it for the hatch. Built once, at their first use.
const circle = (b, r) => b.move_to(4, 4 - r).arc_to(r, r, 0, false, true, 4, 4 + r).arc_to(r, r, 0, false, true, 4, 4 - r).build();
let SKIP_DOT = null;
const skipDot = () => (SKIP_DOT ??= { ring: circle(PathBuilder.stroke(1), 3.5), disc: circle(PathBuilder.fill(), 3) });
// The project's color (shared "kt.projects", the registry entry holding `folder`), else the accent.
function projectColor(t, folder) {
  const e = folder && (shared("kt.projects") ?? []).filter((x) => !x.machine && x.folder && (folder === x.folder || folder.startsWith(`${x.folder}/`)))
    .sort((a, b) => b.folder.length - a.folder.length)[0];
  const c = e?.color;
  return !c ? t.accent : c.startsWith("#") ? c : t[c] ?? t.accent;
}
const CACHE = () => `${home()}/.claude/cache/herdr`;
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
// The focused terminal, else the shown tab's agent (else its first terminal). Local ones only.
function terminal() {
  const f = focused()?.terminal;
  if (f && !f.includes("/")) return f;
  const tab = spaces().find((s) => s.active)?.tabs.find((x) => x.active);
  const mine = panes().filter((p) => p.tab === tab?.id && p.terminal && !p.terminal.includes("/"));
  return (mine.find((p) => p.program?.agent) ?? mine[0])?.terminal ?? null;
}
// "owner/repo" from a github.com remote, else null.
function githubRepo(url) {
  const m = String(url ?? "").trim().match(/^(?:(?:https?|ssh|git):\/\/)?(?:[^@/\s]+@)?github\.com(?::\d+)?[:/]([^/\s]+)\/([^/\s]+?)(?:\.git)?\/?$/i);
  return m ? `${m[1]}/${m[2]}` : null;
}
// After kt-threads' summarizeReport: /me:report's facts, the PR and the CI here.
function summarizeReport(d) {
  const f = d?.facts ?? {};
  const pr = f.pr?.number ? { number: f.pr.number, state: String(f.pr.state ?? "").toUpperCase(), draft: Boolean(f.pr.isDraft), url: f.pr.url ?? null } : null;
  const ci = f.ci ? { ok: f.ci.ok ?? 0, total: f.ci.total ?? 0, fail: f.ci.fail ?? 0, pending: f.ci.pending ?? 0 } : null;
  return { pr, ci, at: d?.generatedAt ?? null };
}

const tr = makeT(strings);
speak(makeT); // steps.js' words follow kt.lang too
const ago = (ms) => relative(ms);

export default class Flow extends View {
  init(_props, cx) {
    this.term = null;
    this.flow = null;
    this.fold = {}; // phase id -> folded, once clicked
    this.motion = motionState(); // ANIMATIONS.md: the tab fades in, phases / Review / CI open on their height
    this.showGen = 0;
    this.headW = 0; // the header card, measured: its dither band and the visuals' width
    this.repos = {}; // cwd -> { name, gh } | null
    this.report = null;
    this.copied = false;
    this.ciOpen = false; // CI unfolded (read on unfold)
    this.ci = null; // { key: "owner/repo#n", repo, head, commits: [{ sha, subject }], ahead, error }
    this.ciRuns = {}; // "owner/repo@sha" -> { runs, done } | { error }: a done one is never read again
    this.openCommit = null; // the CI commit unfolded into its checks
    this.ciLog = null; // a failed check's log extract: { key, loading } | { key, lines } | { key, error }
    this.bridge = null; // { term, b: { todos, action, answer, agents }, key }: that terminal's herdr-bridge (readBridge)
    this.bridgeAt = 0; // its last read: at most one every 3 s, as the sidebar
    this.list = null; // taskList() of the followed terminal's todos, this render's; null without any
    this.now = null; // what its agent runs now, this render's: { line, agents (alive), done, total }; null: nothing
    this.implOpen = undefined; // Implémentation unfolded (its activity and tasks; default: while it runs)
    this.doneOpen = false; // past 12 tasks, the done ones unfolded
    this.logScroll = ScrollHandle.new(); // the extract opens on its last lines
    this.handle = cx.focus_handle();
    this.vim = new Vim();
    this.cur = null; // the keys' cursor: "p:<phase>", "s:<step>", "pass:<n>" or "f:<finding>"
    this.flat = []; // what it walks, in order: { id, kind, card (its phase's index), ... }
    this.phasesScroll = ScrollHandle.new();
    if (checking()) return;
    this.read(cx);
    // The keyboard went away (Herdr doesn't always redraw then): drop the cursor. A hidden copy
    // doesn't render, so this tick notes that the tab went away: shown again, it reads and fades in.
    cx.timer.every(500, (cx) => {
      if (this.shown && !visible()) this.shown = false;
      if (this.keyed !== this.handle.is_focused()) cx.notify();
    });
    // claude-flow writes into one folder: wake on its changes, read when they're ours.
    cx.spawn(async (cx) => {
      for (;;) {
        let changed;
        try { changed = await watchFolder(CACHE()); } catch { return; } // the 10 s timer carries on
        const mine = this.term && `/${this.term}.flow.json`;
        if (changed.some((p) => p === CACHE() || (mine && p.endsWith(mine)))) this.read(cx);
        // herdr-bridge rewrites its file on each tool call: only it is read again then.
        const bridge = this.term && `/${this.term}.json`;
        if (bridge && changed.some((p) => p.endsWith(bridge))) this.readBridge(cx, this.term);
      }
    });
    cx.timer.every(10000, (cx) => this.read(cx));
    // Debug and capture hooks: `kt-flow.report:<folder or facts.json>` reads that report instead of
    // the branch's (`report:` alone goes back), `review` / `pass:<n>` / `finding:first` unfold.
    cx.spawn(async (cx) => {
      for (;;) {
        const c = await nextCommand();
        if (c.startsWith("report:")) {
          const p = c.slice(7).trim().replace(/\/facts\.json$/, "");
          this.forced = p || null;
          this.read(cx);
        } else if (c === "review") this.reviewOpen = true;
        else if (c.startsWith("pass:")) { this.reviewOpen = true; this.openPass = Number(c.slice(5)); this.openFinding = null; }
        else if (c === "finding:first") this.openFinding = (this.report?.review?.findings ?? []).find((f) => f.pass === this.openPass)?.id ?? null;
        // `focus` (pane.go) takes the keyboard; `key:<keys>` takes it and types those keys, for tests.
        else if (c === "focus") this.focusIn();
        else if (c.startsWith("key:")) {
          this.focusIn();
          for (const k of keysOf(c.slice(4))) this.press(k, cx);
        }
        cx.notify();
      }
    });
  }

  // The terminal followed: the focused one, but kept while Flow has the keyboard (taking it may
  // move focused(), and another terminal would unfold every phase again).
  follow() {
    return this.handle.is_focused() && this.term ? this.term : terminal();
  }

  // ---------- keys (vim.js; kt-keys lists them) ----------

  // The keyboard comes here: NORMAL, the cursor where it was, else on the running phase's header.
  focusIn() {
    this.handle.focus();
    this.vim.normal();
    if (!this.flat.some((x) => x.id === this.cur)) {
      const heads = this.flat.filter((x) => x.kind === "phase");
      this.cur = (heads.find((x) => x.p.current && !x.folded) ?? heads.find((x) => !x.folded) ?? heads[0])?.id ?? null;
    }
    this.reveal = true;
  }

  key(e, cx) {
    if (!this.press(e, cx)) return; // not ours: ctrl-b, cmd-* go on
    cx.stop_propagation();
    cx.notify();
  }

  // One key, from the keyboard or `key:`: gi gI gp gP (links.js, after vim's pending g, as kt-kanban's gt),
  // then vim's.
  press(e, cx) {
    const g = gLink(this.vim, keyOf(e).name, Date.now());
    if (g) { this.go(g.kind, g.github); return true; }
    return this.act(this.vim.handle(e), cx);
  }

  // What the cursor walks, in the order shown: phase headers, the steps of unfolded ones, Review's
  // passes when it's open and the findings of the open pass.
  walk(phases) {
    const out = [];
    const rv = this.report?.review;
    phases.forEach((p, card) => {
      const folded = this.folded(p);
      out.push({ id: `p:${p.id}`, kind: "phase", p, folded, card });
      if (folded) return;
      for (const s of p.steps) {
        out.push({ id: `s:${s.id}`, kind: "step", s, phase: p.id, card });
        if (this.isImplOpen(s) && this.list) {
          for (const x of this.list.open) out.push({ id: `task:${x.key}`, kind: "task", x, card });
          if (this.list.done.length) out.push({ id: "tasks:done", kind: "tasks-done", card });
          if (this.list.done.length && this.doneOpen) for (const x of this.list.done) out.push({ id: `task:${x.key}`, kind: "task", x, done: true, card });
        }
        if (s.id === "ci" && this.isCiOpen(s)) {
          for (const pc of this.pushed()) {
            out.push({ id: `ci:${pc.sha}`, kind: "commit", pc, card });
            if (this.openCommit !== pc.sha) continue;
            for (const r of checkOrder(pc.runs)) out.push({ id: `ck:${pc.sha}:${r.name}`, kind: "check", r, sha: pc.sha, card });
          }
        }
        if (s.id !== "review" || !this.isReviewOpen(s)) continue;
        for (const ps of rv.passes ?? []) {
          out.push({ id: `pass:${ps.pass}`, kind: "pass", ps, card });
          if (this.openPass !== ps.pass) continue;
          for (const f of (rv.findings ?? []).filter((y) => y.pass === ps.pass)) out.push({ id: `f:${f.id}`, kind: "finding", f, pass: ps.pass, card });
        }
      }
    });
    return out;
  }

  // One vim action on the timeline; false: not one Flow has, and the key goes on.
  act(a, cx) {
    if (!a) return false;
    if (a === "pending" || a === "count") return true;
    const flat = this.flat;
    const i = flat.findIndex((x) => x.id === this.cur);
    const x = flat[i];
    const to = (id) => { this.cur = id; this.reveal = true; };
    if (this.ciAct(a, x, cx, to) || this.tasksAct(a, x, cx, to)) return true;
    const review = flat.find((y) => y.id === "s:review");
    const reviewOpen = review ? this.isReviewOpen(review.s) : false;
    if (["down", "up", "top", "bottom", "half-down", "half-up"].includes(a)) {
      const j = step(a, i, flat.length, this.vim.count, 12);
      if (j >= 0) to(flat[j].id);
    } else if (a === "left") {
      // An open row folds; on one that doesn't fold (or already folded), its parent folds and takes the cursor.
      if (x?.kind === "phase") this.fold[x.p.id] = true;
      else if (x?.kind === "step" && x.s.id === "review" && reviewOpen) this.reviewOpen = false;
      else if (x?.kind === "step") { this.fold[x.phase] = true; to(`p:${x.phase}`); }
      else if (x?.kind === "pass" && this.openPass === x.ps.pass) { this.openPass = null; this.openFinding = null; }
      else if (x?.kind === "pass") { this.reviewOpen = false; to("s:review"); }
      else if (x?.kind === "finding" && this.openFinding === x.f.id) this.openFinding = null;
      else if (x?.kind === "finding") { this.openPass = null; this.openFinding = null; to(`pass:${x.pass}`); }
    } else if (a === "right") {
      if (x?.kind === "phase") this.fold[x.p.id] = false;
      else if (x?.kind === "step" && x.s.id === "review" && this.report?.review?.passes?.length) this.reviewOpen = true;
      else if (x?.kind === "pass" && this.openPass !== x.ps.pass) { this.openPass = x.ps.pass; this.openFinding = null; }
      else if (x?.kind === "finding") this.openFinding = x.f.id;
    } else if (a === "open") {
      // As a click: the phase, Review, a pass, a finding toggle; the issue and PR steps open theirs in the Inbox.
      if (x?.kind === "phase") this.fold[x.p.id] = !x.folded;
      else if (x?.kind === "step" && x.s.id === "review" && this.report?.review?.passes?.length) this.reviewOpen = !reviewOpen;
      else if (x?.kind === "step") { if (stepKind(x.s.id)) this.go(stepKind(x.s.id), false); }
      else if (x?.kind === "pass") { this.openPass = this.openPass === x.ps.pass ? null : x.ps.pass; this.openFinding = null; }
      else if (x?.kind === "finding") this.openFinding = this.openFinding === x.f.id ? null : x.f.id;
    } else if (a === "open-alt") {
      // A step's GitHub page (issue, PR, review, CI), a finding in Zed.
      const loc = x?.kind === "finding" ? locOf(x.f.loc) : null, root = this.report?.root;
      if (x?.kind === "step") toBrowser(H, this.stepGithub(x.s.id));
      else if (loc && root) exec("open", [`zed://file${root}/${loc}`]).catch(() => {});
    } else if (a === "yank") {
      const text = x?.kind === "finding" ? x.f.loc ?? x.f.title : x?.kind === "pass" ? x.ps.sha : x?.kind === "step" ? x.s.label : null;
      if (text) {
        cx.write_to_clipboard(String(text));
        notify({ title: tr("copied"), body: String(text), level: "success", timeout: 2000 });
      }
    } else if (a === "refresh") {
      this.relink = true;
      this.reportDirty = true;
      this.read(cx);
      if (this.ciOpen) this.loadCi(cx, true);
    } else if (a === "escape") run("pane.go", { direction: "left" });
    else if (a === "help") openOverlay({ mod: "kt-keys", kind: "dialog", width: 1, height: 1, frame: "none", props: { group: "panel" } });
    else if (a === "panel-prev" || a === "panel-next") panelTab(a === "panel-next" ? 1 : -1, cx);
    else return false;
    return true;
  }

  // Implémentation's rows under the keys, as Review's: l / h unfold / fold it and « +N faites »; h on a
  // task folds its parent and goes there; enter as a click; y copies a task's text. false: not one of
  // their rows (the timeline's keys go on). « Maintenant » has no stop: it changes at every tool call.
  tasksAct(a, x, cx, to) {
    const step = x?.kind === "step" && this.implFolds(x.s);
    if (!step && x?.kind !== "task" && x?.kind !== "tasks-done") return false;
    const open = step && this.isImplOpen(x.s);
    if (a === "left") {
      if (step && !open) return false; // folds its phase, as any step
      if (step) this.implOpen = false;
      else if (x.kind === "tasks-done" && this.doneOpen) this.doneOpen = false;
      else if (x.done) { this.doneOpen = false; to("tasks:done"); }
      else { this.implOpen = false; to("s:implement"); }
    } else if (a === "right") {
      if (step) this.implOpen = true;
      else if (x.kind === "tasks-done") this.doneOpen = true;
    } else if (a === "open") {
      if (step) this.implOpen = !open;
      else if (x.kind === "tasks-done") this.doneOpen = !this.doneOpen;
    } else if (a === "yank" && x.kind === "task") {
      cx.write_to_clipboard(x.x.text);
      notify({ title: tr("copied"), body: x.x.text, level: "success", timeout: 2000 });
    } else return false;
    return true;
  }

  // Follows the report folder: collect.py rewrites facts.json atomically, read it again then.
  watchReport(cx, folder) {
    if (folder === this.watchedReport) return;
    this.reportWatch?.cancel();
    this.reportWatch = null;
    this.watchedReport = folder;
    if (!folder) return;
    cx.spawn(async (cx) => {
      while (this.watchedReport === folder) {
        const w = watchFolder(folder);
        this.reportWatch = w;
        let changed;
        try { changed = await w; } catch { return; } // no such folder: the next panel opening looks again
        if (this.watchedReport !== folder || !changed.length) return;
        this.reportDirty = true;
        this.read(cx);
      }
    });
  }

  read(cx) {
    if (!visible() || this.reading) return;
    this.readAt = Date.now(); // DATA-SYNC.md: back on the tab, read again only past 10 s
    const term = this.follow();
    this.readBridge(cx, term);
    const pane = term ? panes().find((p) => p.terminal === term) : null;
    const cwd = pane?.cwd ?? null;
    let branch = pane?.branch ?? null;
    const own = branch; // the terminal's own branch, before the flow's replaces it
    this.reading = true;
    cx.spawn(async (cx) => {
      try {
        const text = term ? await readTextFile(`${CACHE()}/${term}.flow.json`).catch(() => null) : null;
        let flow = null;
        try { flow = text ? JSON.parse(text) : null; } catch { flow = term === this.term ? this.flow : null; } // a torn write keeps the last one
        // The flow's branch before the terminal's: a session that dispatches stays on dev and works in
        // worktrees (`cd "$WT"`), so its report, issue and branch shown are the flow's.
        branch = flowBranch(flow?.steps) ?? branch;
        // The project: its repo (git, once per folder) and its /me:report facts for this branch.
        if (cwd && !(cwd in this.repos)) {
          const [top, origin] = await Promise.all([
            exec("git", ["rev-parse", "--show-toplevel"], { cwd }).catch(() => ({ code: 1 })),
            exec("git", ["remote", "get-url", "origin"], { cwd }).catch(() => ({ code: 1 })),
          ]);
          // The project's name: its GitHub repo's (a worktree's folder isn't), else its folder's.
          const gh = origin.code ? null : githubRepo(origin.stdout);
          this.repos[cwd] = top.code ? null : { name: gh ? gh.split("/")[1] : top.stdout.trim().split("/").pop(), gh, top: top.stdout.trim() };
        }
        const repo = cwd ? this.repos[cwd] : null;
        // A shell that just started may not report its branch yet: ask git.
        if (repo && !branch) branch = (await exec("git", ["branch", "--show-current"], { cwd }).catch(() => ({ stdout: "" }))).stdout.trim() || null;
        // /me:report's folder for this branch (or the one `kt-flow.report:<path>` forces): its facts
        // are read when the panel opens, when it changes, and when collect.py rewrites them (watched).
        const reports = `${home()}/Reports`;
        const folder = this.forced ?? (repo?.gh && branch ? `${reports}/${repo.gh.replace("/", "-")}/${branch.replace(/[/#]+/g, "-")}` : null);
        let report = this.report;
        if (folder !== this.reportFolder || this.relink || this.reportDirty) {
          this.reportDirty = false;
          if (folder !== this.reportFolder) { this.openPass = null; this.openFinding = null; this.reviewOpen = undefined; }
          this.reportFolder = folder;
          report = null;
          const facts = folder ? await readTextFile(`${folder}/facts.json`).catch(() => null) : null;
          try {
            if (facts) {
              const d = JSON.parse(facts), f = d.facts ?? d;
              report = { ...summarizeReport(d.facts ? d : { facts: d, generatedAt: d.generatedAt }), review: f.review ?? null, root: f.repoPath ?? null };
            }
          } catch { report = this.report; } // a torn write keeps the last one
          // The review loops copy each pass into review/ and then run collect.py, a step sessions drop
          // (seen: 8 passes copied, facts.json still on pass 1). More passes on disk than in the facts:
          // run it ourselves, once per count, so Review unfolds from the first finished pass.
          const onDisk = folder ? new Set((await fs.readdir(`${folder}/review`).catch(() => []))
            .map((n) => /^pass-(\d+)-(?:standards|spec)\.md$/.exec(n)?.[1]).filter(Boolean)).size : 0;
          const root = report?.root ?? (repo?.top && own === branch ? repo.top : null);
          if (!checking() && root && onDisk > (report?.review?.passes?.length ?? 0) && this.regen !== `${folder}#${onDisk}`) {
            this.regen = `${folder}#${onDisk}`;
            exec(`${home()}/.claude/skills/me/report/collect.py`, [], { cwd: root, timeout: 120000 }).catch(() => {});
          }
          this.watchReport(cx, folder);
        }
        // The branch's report page and the plans holding the flow's issue: on opening the panel and
        // when the followed terminal (its repo, branch, issue) changes, never in the loop.
        const issue = issueOf(branch) ?? details((flow?.steps ?? []).find((s) => s.id === "issue") ?? { id: "issue" })[0]?.text?.slice(1) ?? null;
        const linkKey = JSON.stringify([repo?.gh, branch, issue, folder]);
        if (linkKey !== this.linkKey || this.relink) {
          this.linkKey = linkKey;
          const page = folder ? `${folder}/index.html` : null;
          this.page = page && (await fs.exists(page).catch(() => false)) ? page : null;
          const list = async (d) => { try { return await fs.readdir(d); } catch { return []; } };
          const read = (p) => readTextFile(p).catch(() => null);
          const dirs = [...(repo?.gh ? [`${reports}/${repo.gh.replace("/", "-")}/plans`] : []), `${reports}/_plans`];
          this.plans = await findPlans(dirs, issue, list, read).catch(() => []);
        }
        this.relink = false;
        const key = JSON.stringify([term, cwd, branch, own, text, report, this.page, this.plans]);
        this.issue = issue;
        if (key === this.key) return;
        if (term !== this.term) {
          this.fold = {};
          this.ciOpen = false; // another terminal: its CI is read when unfolded
          this.openCommit = null;
          this.ciLog = null;
          this.implOpen = undefined;
          this.doneOpen = false;
        }
        this.key = key;
        this.term = term;
        this.cwd = cwd;
        this.branch = branch;
        // Changes and History follow the terminal, not the flow: offered only when it's on the flow's branch.
        this.onBranch = Boolean(branch) && own === branch;
        this.flow = flow;
        this.report = report;
        cx.notify();
      } finally {
        this.reading = false;
        // An answer for `term` (unchanged or failed alike): its skeleton gives way (readyFor).
        if (this.readFor !== term) { this.readFor = term; cx.notify(); }
        // The terminal changed while this read ran (that read was dropped): read the new one now.
        if (this.follow() !== term) this.read(cx);
      }
    });
  }

  // The terminal's herdr-bridge json as the sidebar's focus card reads it (threads-io readLive): its
  // todos, its last action and answer, its sub-agents. With each read() and when that file changes, at
  // the sidebar's cadence: one read every 3 s at most (another terminal: at once), a wake in between or
  // during a read reads once at its end (one one-shot timer). A redraw only when what Flow shows changed.
  readBridge(cx, term) {
    // A late wake for a terminal no longer followed (its 3 s timer) would replace the one shown.
    if (!term || term !== this.follow() || !visible()) return;
    const wait = term === this.bridge?.term ? this.bridgeAt + 3000 - Date.now() : 0;
    if (this.readingBridge || wait > 0) {
      this.bridgeAgain = term;
      if (!this.readingBridge && !this.bridgeWait) {
        this.bridgeWait = true;
        cx.timer.after(wait, (cx) => {
          this.bridgeWait = false;
          const again = this.bridgeAgain;
          this.bridgeAgain = null;
          if (again) this.readBridge(cx, again);
        });
      }
      return;
    }
    this.readingBridge = true;
    this.bridgeAt = Date.now();
    cx.spawn(async (cx) => {
      try {
        const pane = panes().find((p) => p.terminal === term);
        const { live } = await readLive(pane ? [pane] : [], { home: home(), readTextFile }, { live: this.live });
        this.live = live;
        const l = live[term];
        const b = { todos: l?.todos ?? null, action: l?.action ?? null, answer: l?.answer ?? null, agents: l?.agents ?? [], pending: l?.pending ?? null };
        const key = JSON.stringify([term, b]);
        if (key !== this.bridge?.key) { this.bridge = { term, b, key }; cx.notify(); }
      } finally {
        this.readingBridge = false;
        const again = this.bridgeWait ? null : this.bridgeAgain;
        if (again) { this.bridgeAgain = null; this.readBridge(cx, again); }
      }
    });
  }

  // Its agent's status now (live data: a redraw comes with each change), null without one.
  status() {
    return panes().find((p) => p.terminal === this.term)?.status ?? null;
  }
  // Only while it works does the running task breathe.
  working() {
    return this.status() === "working";
  }

  // Implémentation folds when its agent has todos, or, while it runs, does something now (« Maintenant »).
  implFolds(s) {
    return s.id === "implement" && Boolean(this.list || (s.state === "current" && this.now));
  }
  // Open by default while it runs.
  isImplOpen(s) {
    return this.implFolds(s) && (this.implOpen ?? s.state === "current");
  }

  colors(t) {
    const dark = settings().dark !== false;
    return { ok: t.done, err: dark ? t.ansi9 : t.ansi1, warn: dark ? t.ansi11 : t.ansi3, accent: t.accent };
  }

  pill(t, id, text, color, onClick, icon, tip) {
    return h_flex().id(id).flex_none().max_w(220).h(18).px(7).gap(4).items_center().rounded_full().border(1)
      .border_color(alpha(color, "4d")).bg(alpha(color, "1a")).font_family(MONO).text_size(10.5).text_color(color)
      .when(Boolean(onClick), (el) => el.cursor_pointer().hover((s) => s.bg(alpha(color, "33"))).on_click(() => onClick()))
      .when(Boolean(tip), (el) => el.tooltip(tip))
      .when(Boolean(icon), (el) => el.child(svg(icon).size(11).flex_none()))
      .child(div().min_w(0).truncate().child(text));
  }

  prUrl(n) {
    const gh = this.cwd ? this.repos[this.cwd]?.gh : null;
    return this.report?.pr?.number === n && this.report.pr.url ? this.report.pr.url : gh ? `https://github.com/${gh}/pull/${n}` : null;
  }

  // ---------- links: the issue and the PR in Herdr (the Inbox) or on GitHub (links.js) ----------

  // The flow's issue or PR (`n`: a step's own number, else the flow's), where its buttons go.
  target(kind, n = kind === "pr" ? this.prOf() : this.issue) {
    const gh = this.cwd ? this.repos[this.cwd]?.gh : null;
    return target(gh, kind, n, kind === "pr" && n ? this.prUrl(Number(n)) : null);
  }
  // gi gI gp gP, enter on the issue and PR steps: in the Inbox, else (off GitHub) the browser.
  go(kind, github) {
    const x = this.target(kind);
    return github ? toBrowser(H, x?.url) : inHerdr(H, x) || toBrowser(H, x?.url);
  }
  stepGithub(id) {
    return stepUrl(id, this.target("issue"), this.target("pr"));
  }

  // kt-gwm's GitHub icon: a round 18 px icon button, dim until hovered; its click stays its own (rows fold on theirs).
  iconBtn(t, id, icon, tip, onClick) {
    return h_flex().id(id).flex_none().size(18).items_center().justify_center().rounded_full().text_color(t.dim)
      .cursor_pointer().hover((s) => s.bg(t.hover).text_color(t.foreground)).tooltip(tip)
      .on_click((_e, cx) => { cx.stop_propagation(); onClick(); })
      .child(svg(icon).size(12));
  }
  // kt-gwm's link(): the pill opens the item in the Inbox (off GitHub: the browser), the GitHub icon beside it
  // in the browser. `tips`: [Inbox's, GitHub's].
  link(t, id, text, color, x, icon, tips) {
    const inbox = Boolean(x?.repo);
    return h_flex().flex_none().gap(2).items_center()
      .child(this.pill(t, id, text, color, x && (inbox || x.url) ? () => inHerdr(H, x) || toBrowser(H, x.url) : null, icon, inbox ? tips[0] : x?.url ? tips[1] : null))
      .when(Boolean(x?.url), (el) => el.child(this.iconBtn(t, `${id}-gh`, GH, tips[1], () => toBrowser(H, x.url))));
  }

  // ---------- context ----------

  head(t, c, steps) {
    const f = this.flow;
    const repo = this.cwd ? this.repos[this.cwd] : null;
    const issue = this.issue;
    const prN = this.prOf();
    const prState = this.report?.pr?.number === prN ? this.report.pr : null;
    const prColor = !prState ? t.muted : prState.state === "MERGED" ? t.ansi5 : prState.state === "CLOSED" ? c.err : prState.draft ? t.dim : t.done;
    const ci = this.report?.ci;
    const ciColor = !ci ? t.muted : ci.fail ? c.err : ci.pending ? c.warn : c.ok;
    const iss = this.target("issue"), pr = this.target("pr");
    // DESIGN-REFERENCE.md: the project's pixel band behind the header, inside its border (width less 2,
    // radius 16 less 1), measured on the card itself.
    const band = ditherBand(this.headW - 2, 60, 15, alpha(projectColor(t, this.report?.root ?? this.cwd), settings().dark !== false ? "6b" : "4d"), TOP);
    return v_flex().id("kf-head").relative().overflow_hidden().flex_none().rounded(16).border(1).border_color(t.border).bg(t.background).px(14).py(12).gap(9)
      .on_size_change((size, cx) => { if (Math.abs(size.width - this.headW) > 0.5) { this.headW = size.width; cx.notify(); } })
      .when(Boolean(band), (el) => el.child(band))
      .child(h_flex().gap(8).items_center()
        .child(svg("mods/kt-panel-head/workflow.svg").size(14).flex_none().text_color(t.muted))
        .child(div().flex_1().min_w(0).truncate().text_size(13.5).font_semibold().child(workflowName(f.workflow)))
        .child(div().flex_none().font_family(MONO).text_size(11).text_color(t.dim).child(f.updatedAt ? ago(f.updatedAt) : ""))
        .when(this.keyed, (el) => el.child(modePill(t, this.vim))))
      // The branch, then where else to see it: the Worktrees page; Changes and History (the panel's tabs, which
      // follow the terminal) when the terminal is on it.
      .when(Boolean(repo || this.branch), (el) => el.child(h_flex().gap(6).items_center().min_w(0)
        .child(svg(I("git-branch")).size(12).flex_none().text_color(t.muted))
        .child(div().flex_1().min_w(0).truncate().font_family(MONO).text_size(11.5).text_color(t.muted)
          .child([repo?.name, this.branch].filter(Boolean).join(" · ")))
        .when(Boolean(repo), (el) => el.child(this.iconBtn(t, "kf-wt", I("folder-tree"), tr("worktrees"), () => toPage(H, "gwm"))))
        .when(Boolean(repo && this.onBranch), (el) => el
          .child(this.iconBtn(t, "kf-changes", I("file-diff"), tr("changes"), () => toTab(H, "diff")))
          .child(this.iconBtn(t, "kf-history", "mods/kt-panel-head/history.svg", tr("history"), () => toTab(H, "history"))))))
      // The issue, the PR and its checks: each pill in the Inbox, its GitHub icon in the browser (kt-gwm's links).
      .when(Boolean(issue || prN || ci?.total || this.page || this.plans?.length), (el) => el.child(h_flex().flex_wrap().gap(6).items_center()
        .when(Boolean(issue), (el) => el.child(this.link(t, "kf-issue", `#${issue}`, t.muted, iss, I("circle-dashed"),
          [tr("issueHerdr", { n: issue }), tr("issueGithub", { n: issue })])))
        // i18n: tech (PR #n and GitHub's state, the same in every language)
        .when(Boolean(prN), (el) => el.child(this.link(t, "kf-pr", `PR #${prN}${prState ? ` · ${prState.draft ? "draft" : prState.state.toLowerCase()}` : ""}`, prColor,
          pr, I("git-pull-request"), [tr("prHerdr", { n: prN }), tr("prGithub", { n: prN })])))
        // Its id carries the repo and branch: another thread's CI shows at once, not rolling.
        .when(Boolean(ci?.total), (el) => el.child(this.link(t, "kf-ci", rollText(this.motion, `kf-ci-n-${repo?.name}|${this.branch}`, `CI ${ci.ok}/${ci.total}`, 14), ciColor, // i18n: tech
          checksOf(pr), null, [tr("checksHerdr", { n: prN }), tr("checksGithub", { n: prN })])))
        .when(Boolean(this.page), (el) => el.child(this.pill(t, "kf-report", tr("report"), t.ansi4,
          () => exec("open", [this.page]).catch(() => {}), I("file-text"), tr("reportTip"))))
        .children((this.plans ?? []).map((p, i) => this.pill(t, `kf-plan-${i}`, p.title, t.ansi5,
          () => exec("open", [p.path]).catch(() => {}), I("layers"), `Plan /me:report --plan · ${p.slug}`))))) // i18n: tech
      // The progress by steps (viz.js steps), a tier per phase holding a cell per step, in the phase cards'
      // order and names, as wide as the card (viz measures it); under it the running phase and step, n / total.
      // The list's own state colours (colors()): done green, running accent, failed red.
      .child(((c) => viz(t, this.motion, { roll }).steps(phasesOf(steps).flatMap((p) => p.steps.map((s) => ({ label: nameOf(s.id), state: s.state, group: p.label }))),
        { id: "kf-progress", colors: { done: c.ok, current: c.accent, failed: c.err } }))(this.colors(t)));
  }

  // ---------- steps ----------

  dot(t, c, s, pulse) {
    const box = h_flex().size(14).flex_none().items_center().justify_center();
    if (s.state === "done") return box.text_color(c.ok).child(svg(I("check")).size(12));
    if (s.state === "failed") return box.text_color(t.ansi1).child(svg(I("x")).size(12));
    if (s.state === "current") return box.child(div().size(8).rounded_full().bg(c.accent).when(pulse, (el) => el.loop("opacity", { from: 0.35, to: 1, period: 1400 })));
    // Skipped (#41): hatched, as viz.js' tiers draw it: the to-do ring, a slash pattern inside.
    if (s.state === "skipped") {
      const { ring, disc } = skipDot(), w = globalThis.window;
      return box.child(div().relative().size(8)
        .child(w.paint_path(ring, t.dim).absolute().inset_0())
        .child(w.paint_path(disc, Background.pattern_slash(t.dim, 1, 3)).absolute().inset_0()));
    }
    return box.child(div().size(8).rounded_full().border(1).border_color(t.dim));
  }

  // Review unfolds when the report has passes: open by default while it runs.
  isReviewOpen(s) {
    return Boolean(this.report?.review?.passes?.length) && (this.reviewOpen ?? s.state === "current");
  }

  // The keys' cursor on this row, while Flow has the keyboard (an accent ring on the ink).
  ring(id) {
    return this.keyed && this.cur === id;
  }

  step(t, c, s, first, last, pulse) {
    const on = s.state === "current";
    const live = on || s.state === "done";
    const toneOf = (d) => (d.tone === "ok" ? c.ok : d.tone === "err" ? c.err : d.tone === "dim" ? t.dim : t.muted);
    const rail = (show) => div().w(1).flex_1().when(show, (el) => el.bg(t.border));
    const ci = s.id === "ci" && this.ciFolds();
    const impl = this.implFolds(s); // « Maintenant » and the todos below, their n / total here
    const tasks = impl && Boolean(this.list);
    const folds = ci || impl || (s.id === "review" && Boolean(this.report?.review?.passes?.length));
    const open = folds && (ci ? this.isCiOpen(s) : impl ? this.isImplOpen(s) : this.isReviewOpen(s));
    const cursor = this.ring(`s:${s.id}`);
    const gh = s.id === "review" || s.id === "ci" ? this.stepGithub(s.id) : null;
    return h_flex().id(`kf-s-${s.id}`).h(28).px(6).gap(8).items_center().rounded(8)
      .border(1).border_color(cursor ? alpha(t.accent, "99") : on ? alpha(t.accent, "66") : alpha(t.accent, "00"))
      .when(cursor, (el) => el.bg(alpha(t.accent, "24")))
      .when(on && !cursor, (el) => el.bg(alpha(t.accent, "14")))
      .when(folds, (el) => el.cursor_pointer().when(!on && !cursor, (e) => e.hover((st) => st.bg(t.hover)))
        .on_click((_e, cx) => { if (ci) this.toggleCi(!open, cx); else if (impl) this.implOpen = !open; else this.reviewOpen = !open; cx.notify(); }))
      .child(v_flex().w(14).h_full().flex_none().items_center()
        .child(rail(!first)).child(this.dot(t, c, s, pulse)).child(rail(!last && !open)))
      .child(div().flex_none().text_size(12.5).text_color(s.state === "pending" ? t.muted : s.state === "skipped" ? t.dim : t.foreground).when(on, (el) => el.font_medium())
        .child(nameOf(s.id)))
      .when(folds, (el) => el.child(svg(I(open ? "chevron-down" : "chevron-right")).size(12).flex_none().text_color(open ? t.accent : t.muted)))
      .child(h_flex().flex_1().min_w(0).gap(5).items_center().overflow_hidden()
        // The PR's and the issue's #n: links as the header's (the Inbox, GitHub's icon beside).
        .children(details(s).map((d, i) => {
          const n = d.pr ?? (stepKind(s.id) === "issue" ? /^#(\d+)$/.exec(d.text)?.[1] : null);
          return n ? this.link(t, `kf-${d.pr ? "pr" : "is"}-${s.id}-${i}`, d.text, s.state === "pending" ? t.muted : t.ansi4,
            this.target(d.pr ? "pr" : "issue", n), null, d.pr ? [tr("prHerdr", { n }), tr("prGithub", { n })] : [tr("issueHerdr", { n }), tr("issueGithub", { n })])
          : d.tone
            ? this.pill(t, `kf-d-${s.id}-${i}`, d.text, toneOf(d))
            : div().min_w(0).truncate().when(Boolean(d.mono), (el) => el.font_family(MONO).text_size(11)).when(!d.mono, (el) => el.text_size(11.5))
              .text_color(t.muted).child(d.text);
        })))
      // Review and CI: their page on GitHub (the PR's files with their review comments, its checks); in Herdr,
      // they unfold here.
      .when(Boolean(gh), (el) => el.child(this.iconBtn(t, `kf-gh-${s.id}`, GH, tr(s.id === "ci" ? "checksGithub" : "reviewGithub", { n: this.prOf() }), () => toBrowser(H, gh))))
      // The todos done / all; the terminal in its id: another agent's count shows at once, not rolling.
      .when(tasks, (el) => el.child(rollText(this.motion, `kf-todo-n-${this.term}`, `${this.list.n} / ${this.list.total}`, 14)
        .flex_none().font_family(MONO).text_size(10.5).text_color(this.list.n === this.list.total ? c.ok : t.dim)))
      .when(s.source === "host", (el) => el.child(div().id(`kf-h-${s.id}`).flex_none().text_color(t.dim).tooltip(tr("hostTip"))
        .child(svg("mods/kt-flow/scan-eye.svg").size(12))))
      .when(live && Boolean(s.tool), (el) => el.child(div().flex_none().font_family(MONO).text_size(10).text_color(t.dim).child(s.tool)));
  }

  // ---------- Implémentation: what runs now, the session's tasks ----------

  // What its agent runs now (herdr-bridge, readBridge), as the sidebar says it: the live line (lineOf:
  // a working agent's last action, a done one's answer), or while it waits on Kylian what it asks
  // (`ask`: its pending dialog's title and detail, "" without one: the fold stays while it's blocked);
  // its sub-agents still running and their k / n (ended / all, as kt-kanban's). null: nothing to show.
  nowOf(b) {
    const agents = b?.agents ?? [];
    const blocked = this.status() === "blocked";
    const ask = blocked ? [b?.pending?.title, b?.pending?.detail].filter(Boolean).map(String) : null;
    const line = b && !blocked ? lineOf(this.status(), b) : null;
    const running = shownAgents(agents, Date.now()).filter(isAlive);
    return blocked || line || running.length
      ? { line, ask, agents: running, done: agents.filter((a) => !isAlive(a)).length, total: agents.length } : null;
  }

  // Under an open Implémentation, as Review's body. « Maintenant » while it runs: the live line « ↳ … »
  // (its whole text on hover), or « En attente : » and what it asks while blocked, and a row a running sub-agent (4, then « +N »), k / n on its head. Then
  // « Tâches »: a 24 px row a task, in the session's order (done a check, the running one an accent dot
  // that breathes only while its agent works, to do a ring), its text on one line, all of it on hover.
  // Past 12 (taskList): the open ones, then « +N faites », which unfolds the done ones; « +N autres
  // tâches » for those past the bridge's 20. The block and each new row fade in (a row keeps its id when
  // its state changes: a task done behind « +N faites » only moves the count), a row gone goes at once,
  // and the phase's fold follows their height (ANIMATIONS.md: one level).
  implBody(t, c, s) {
    if (!this.isImplOpen(s)) return [];
    const L = this.list, N = s.state === "current" ? this.now : null, m = this.motion, term = this.term;
    const head = (label, right) => h_flex().h(24).px(6).gap(8).items_center()
      .child(div().flex_none().font_family(MONO).text_size(10.5).text_color(t.muted).child(label))
      .child(div().flex_1()).when(Boolean(right), (el) => el.child(right));
    const box = enter(m, v_flex().ml(13).pl(10).pb(4).gap(2).border_l(1).border_color(t.border), `kf-impl-${term}`, { dy: 0 });
    return [box
      .when(Boolean(N), (el) => el.child(head(tr("now"), N.total > 0 && h_flex().id(`kf-now-k-${term}`).flex_none().gap(4).items_center()
        .text_color(t.dim).tooltip(tr("subagents", { n: N.done, total: N.total }))
        .child(svg(I("bot")).size(11)).child(div().font_family(MONO).text_size(10.5).child(`${N.done}/${N.total}`))))
        .when(Boolean(N.line), (el) => el.child(div().id(`kf-now-line-${term}`).h(22).px(6).flex().items_center().tooltip(N.line)
          .child(div().flex_1().min_w(0).truncate().text_size(12).text_color(this.working() ? t.muted : t.dim).child(`↳ ${N.line}`))))
        // Waiting on Kylian: what it asks, as the Kanban's card and the sidebar (title · detail on hover).
        .when(Boolean(N.ask), (el) => el.child(div().id(`kf-now-ask-${term}`).h(22).px(6).flex().items_center()
          .when(N.ask.length > 0, (e) => e.tooltip(N.ask.join(" · ")))
          .child(div().flex_1().min_w(0).truncate().text_size(12).text_color(t.blocked)
            .child(N.ask.length ? tr("waiting", { title: N.ask[0] }) : tr("waitingBare")))))
        .children(N.agents.slice(0, 4).map((a, i) => enter(m, h_flex().h(22).px(6).gap(8).items_center(), `kf-now-a-${term}-${a.id ?? i}`, { dy: 0, delay: stagger(i, 4) })
          .child(h_flex().size(14).flex_none().items_center().justify_center().child(div().size(6).rounded_full().bg(t.working)))
          .child(div().flex_1().min_w(0).truncate().text_size(12).text_color(t.foreground).child(a.what || a.name || "agent")))) // i18n: tech
        .when(N.agents.length > 4, (el) => el.child(div().h(18).pl(28).font_family(MONO).text_size(10.5).text_color(t.dim)
          .child(tr("agentsMore", { n: N.agents.length - 4 })))))
      // « Tâches » even alone: the list doesn't move by a head when « Maintenant » comes and goes.
      .when(Boolean(L), (el) => el.child(head(tr("tasks"))).children(this.taskRows(t, c, L, term)))];
  }

  // The tasks' rows (implBody).
  taskRows(t, c, L, term) {
    const m = this.motion;
    const pulse = this.working() && !m.reduced;
    const items = [...L.open, ...(L.done.length ? [null] : []), ...(L.done.length && this.doneOpen ? L.done : [])];
    const mark = (st) => h_flex().size(14).flex_none().items_center().justify_center()
      .child(st === "done" ? svg(I("check")).size(11).text_color(c.ok)
        : st === "current" ? div().size(7).rounded_full().bg(c.accent).when(pulse, (el) => el.loop("opacity", { from: 0.35, to: 1, period: 1400 }))
          : div().size(7).rounded_full().border(1).border_color(t.dim));
    const row = (id, cursor, el, i) => enter(m, el.h(24).px(6).gap(8).items_center().rounded(8)
      .border(1).border_color(cursor ? alpha(t.accent, "99") : alpha(t.accent, "00"))
      .when(cursor, (e) => e.bg(alpha(t.accent, "24"))), `kf-t-${term}-${id}`, { dy: 0, delay: stagger(i, items.length) });
    const rows = items.map((x, i) => {
      if (!x) {
        // « +N faites »: the done ones, folded past 12.
        const cursor = this.ring("tasks:done"), open = this.doneOpen;
        return row("~done", cursor, h_flex(), i).cursor_pointer().when(!cursor, (e) => e.hover((st) => st.bg(t.hover)))
          .on_click((_e, cx) => { this.doneOpen = !open; cx.notify(); })
          .child(h_flex().size(14).flex_none().items_center().justify_center()
            .child(svg(I(open ? "chevron-down" : "chevron-right")).size(11).text_color(open ? t.accent : t.dim)))
          .child(div().flex_1().min_w(0).truncate().font_family(MONO).text_size(10.5).text_color(t.dim).child(tr("tasksDone", { n: L.done.length })));
      }
      const say = x.state === "current" ? x.active ?? x.text : x.text;
      return row(x.key, this.ring(`task:${x.key}`), h_flex(), i).tooltip(say)
        .child(mark(x.state))
        .child(div().flex_1().min_w(0).truncate().text_size(12)
          .text_color(x.state === "current" ? t.foreground : x.state === "done" ? t.dim : t.muted).child(say));
    });
    if (L.unread > 0) rows.push(div().h(18).pl(28).font_family(MONO).text_size(10.5).text_color(t.dim).child(tr("tasksMore", { n: L.unread })));
    return rows;
  }

  // ---------- review passes ----------

  // Under an open Review step: the passes' convergence, one 28 px row a pass (the last one inked),
  // one pass unfolded at a time into its findings, one finding at a time into its detail.
  reviewBody(t, c, s) {
    if (s.id !== "review" || !this.isReviewOpen(s)) return [];
    const rv = this.report.review;
    const passes = rv.passes ?? [], findings = rv.findings ?? [];
    const sums = passes.map(passOf);
    const lastN = passes.at(-1)?.pass;
    const root = this.report.root ?? null;
    const prioColor = (pr) => (/P[012]/.test(pr) ? c.err : t.muted);
    const toneColor = (tone) => (tone === "ok" ? c.ok : tone === "warn" ? c.warn : t.dim);
    const axis = (label, ran) => h_flex().flex_none().gap(3).items_center().font_family(MONO).text_size(10)
      .text_color(ran ? t.dim : c.warn).child(label)
      .child(ran ? svg(I("check")).size(10).text_color(c.ok) : div().child(tr("notRun")));
    const rows = [];
    passes.forEach((p, i) => {
      const x = sums[i], last = p.pass === lastN, open = this.openPass === p.pass;
      const cursor = this.ring(`pass:${p.pass}`);
      rows.push(h_flex().id(`kf-pass-${p.pass}`).h(28).px(6).gap(7).items_center().rounded(8).cursor_pointer()
        .border(1).border_color(cursor ? alpha(t.accent, "99") : alpha(t.accent, "00"))
        .when(cursor, (el) => el.bg(alpha(t.accent, "24")))
        .when(last && !cursor, (el) => el.bg(alpha(t.accent, "14")))
        .when(!last && !cursor, (el) => el.hover((st) => st.bg(t.hover)))
        .on_click((_e, cx) => { this.openPass = open ? null : p.pass; this.openFinding = null; cx.notify(); })
        .child(svg(I(open ? "chevron-down" : "chevron-right")).size(11).flex_none().text_color(open ? t.accent : t.dim))
        .child(div().flex_none().text_size(12).text_color(last ? t.foreground : t.muted).when(last, (el) => el.font_medium()).child(tr("pass", { n: p.pass })))
        .child(div().flex_none().font_family(MONO).text_size(10.5).text_color(t.dim).child(String(p.sha ?? "").slice(0, 7)))
        .child(h_flex().flex_1().min_w(0).gap(4).items_center().overflow_hidden()
          .children(["p0", "p1", "p2"].filter((k) => x[k] > 0).map((k) => this.pill(t, `kf-pc-${p.pass}-${k}`, `${k.toUpperCase()} ${x[k]}`, c.err)))
          .when(x.p3 > 0, (el) => el.child(this.pill(t, `kf-pc-${p.pass}-p3`, `P3 ${x.p3}`, t.muted)))
          .when(x.clean, (el) => el.child(this.pill(t, `kf-pc-${p.pass}-ok`, tr("noBlocker"), c.ok))))
        .child(axis("std", x.std)).child(axis("spec", x.spec)));
      if (!open) return;
      const fr = []; // the open pass's findings, one fold
      for (const f of findings.filter((y) => y.pass === p.pass)) {
        const d = decisionOf(f), loc = locOf(f.loc), shown = this.openFinding === f.id;
        const cursor = this.ring(`f:${f.id}`);
        fr.push(h_flex().id(`kf-f-${f.id}`).h(26).ml(18).px(6).gap(7).items_center().rounded(8).cursor_pointer()
          .border(1).border_color(cursor ? alpha(t.accent, "99") : alpha(t.accent, "00"))
          .when(cursor, (el) => el.bg(alpha(t.accent, "24")))
          .when(shown && !cursor, (el) => el.bg(t.hover)).when(!shown && !cursor, (el) => el.hover((st) => st.bg(t.hover)))
          .on_click((_e, cx) => { this.openFinding = shown ? null : f.id; cx.notify(); })
          .child(this.pill(t, `kf-fp-${f.id}`, f.prio ?? "?", prioColor(f.prio ?? "")))
          .child(div().flex_1().min_w(0).truncate().text_size(12).text_color(t.foreground).child(f.title ?? f.id))
          .when(Boolean(loc), (el) => el.child(div().id(`kf-fl-${f.id}`).flex_none().max_w(150).truncate().font_family(MONO).text_size(10.5).text_color(t.dim)
            .when(Boolean(root), (e) => e.cursor_pointer().hover((st) => st.text_color(t.foreground))
              .on_click((_e, cx) => { cx.stop_propagation(); exec("open", [`zed://file${root}/${loc}`]).catch(() => {}); }))
            .tooltip(f.loc).child(loc.split("/").pop())))
          .child(div().flex_none().font_family(MONO).text_size(10.5).text_color(toneColor(d.tone)).child(d.text)));
        if (shown) {
          fr.push(enter(this.motion, v_flex().ml(18).mb(4).p(10).gap(6).rounded(8).border(1).border_color(t.border).bg(t.raised), `kf-fd-${f.id}`, { dy: 0 })
            .child(div().font_family(MONO).text_size(10.5).text_color(t.dim).child(`${f.axis ?? ""} · ${f.loc ?? ""}`))
            .child(div().w_full().text_size(12).line_height("17px").text_color(t.foreground).child(f.detail ?? "—")));
        }
      }
      rows.push(enter(this.motion, v_flex().gap(2), `kf-pf-${p.pass}`, { dy: 0 }).children(fr));
    });
    // One height level only (the phase's body, around this): Review, its passes and findings, and CI fade
    // in, and the phase's fold grows to them. Nested folds would chase each other's height every frame.
    // The convergence (viz.js): the open findings and their change since the previous pass, then each
    // pass's blocking (P0 to P2) and non-blocking (P3) findings, as wide as this body (viz measures it).
    const V = viz(t, this.motion, { roll });
    const openOf = (n) => findings.filter((f) => f.pass === n && decisionOf(f).tone === "warn").length;
    const prevN = passes.at(-2)?.pass, open = openOf(lastN), delta = prevN == null ? 0 : open - openOf(prevN);
    return [enter(this.motion, v_flex().ml(13).pl(10).pb(4).gap(2).border_l(1).border_color(t.border), "kf-review", { dy: 0 })
      .child(h_flex().h(30).px(6).gap(8).items_center()
        .child(div().flex_none().font_family(MONO).text_size(10.5).text_color(t.muted).child("CONVERGENCE")) // i18n: tech
        .child(div().flex_1())
        .child(div().flex_none().font_family(MONO).text_size(10.5).text_color(t.dim)
          .child(tr("passes", { who: rv.reviewer ? `${rv.reviewer} · ` : "", n: passes.length, f: findings.length }))))
      .child(v_flex().px(6).pt(2).pb(10).gap(12)
        .child(V.stat(tr("openFindings"), String(open), {
          delta: delta ? `${delta > 0 ? "+" : "−"}${Math.abs(delta)}` : null,
          detail: prevN == null ? tr("firstPass") : delta ? tr("sincePass", { n: prevN }) : tr("stableSince", { n: prevN }),
          better: "lower", id: "kf-rv-open" }))
        .child(V.chart("bar", [
          { label: tr("blocking"), values: sums.map((x) => x.blockers), color: "negative" },
          { label: tr("nonBlocking"), values: sums.map((x) => x.p3), color: "muted" },
        ], { labels: passes.map((p) => `P${p.pass}`), height: 140, id: "kf-rv-chart" })))
      .children(rows)];
  }

  // ---------- CI (the PR's check runs, per pushed commit) ----------

  // The followed project's GitHub repo, the flow's PR, and the CI read for them: "owner/repo#n".
  prOf() {
    const pr = (this.flow?.steps ?? []).find((s) => s.id === "pr");
    return this.report?.pr?.number ?? details(pr ?? { id: "pr" }).find((d) => d.pr)?.pr ?? null;
  }
  ciKey() {
    const gh = this.cwd ? this.repos[this.cwd]?.gh : null, n = this.prOf();
    return gh && n ? `${gh}#${n}` : null;
  }
  ciFolds() { return Boolean(this.ciKey()); }
  isCiOpen(s) { return s.id === "ci" && this.ciOpen && this.ciFolds(); }

  toggleCi(open, cx) {
    this.ciOpen = open;
    if (open) this.loadCi(cx, false);
  }
  toggleCommit(sha) {
    this.openCommit = this.openCommit === sha ? null : sha;
    this.ciLog = null;
  }
  openRun(r) {
    const url = r?.html_url ?? r?.details_url;
    if (url) exec("open", [url]).catch(() => {});
  }

  // The PR's last 10 commits and each one's check runs (`gh`, 20 s each), and the local branch's
  // commits the PR hasn't (unpushed). Only on unfold, on r (force) and when the PR read changes;
  // a commit whose checks all ended is kept and never read again.
  loadCi(cx, force) {
    const key = this.ciKey();
    if (!key || this.ciLoading || (!force && this.ci?.key === key)) return;
    const [repo, n] = key.split("#");
    const branch = this.branch, cwd = this.cwd;
    this.ciLoading = true;
    const gh = (args) => exec("gh", args, { timeout: 20e3 }).catch((e) => ({ code: 1, stdout: "", stderr: String(e?.message ?? e) }));
    const why = (r, what) => r.stderr.trim().split("\n").pop() || tr("failed", { what, code: r.code });
    cx.spawn(async (cx) => {
      let ci;
      try {
        const pv = await gh(["pr", "view", n, "-R", repo, "--json", "commits,headRefOid"]);
        if (pv.code) throw new Error(`gh pr view ${n} : ${why(pv, "gh pr view")}`);
        const d = JSON.parse(pv.stdout);
        const commits = (d.commits ?? []).slice(-10).map((x) => ({ sha: x.oid, subject: x.messageHeadline ?? "" }));
        await Promise.all(commits.map(async ({ sha }) => {
          const k = `${repo}@${sha}`;
          if (this.ciRuns[k]?.done) return;
          // i18n: tech
          const r = await gh(["api", `repos/${repo}/commits/${sha}/check-runs?per_page=100`, "--jq",
            // i18n: tech
            "[.check_runs[] | {name, status, conclusion, started_at, completed_at, html_url, details_url}]"]);
          let runs = null;
          try { runs = r.code ? null : JSON.parse(r.stdout); } catch { runs = null; }
          this.ciRuns[k] = Array.isArray(runs) ? { runs, done: runs.length > 0 && runs.every((x) => x.status === "completed") } : { error: why(r, "gh api check-runs") };
        }));
        // ci-until-green's guard: commits on the local branch the PR's head hasn't.
        let ahead = 0;
        if (branch && cwd && d.headRefOid) {
          const r = await exec("git", ["rev-list", "--count", `${d.headRefOid}..refs/heads/${branch}`], { cwd }).catch(() => null);
          ahead = r?.code === 0 ? Number(r.stdout.trim()) || 0 : 0;
        }
        ci = { key, repo, head: d.headRefOid ?? null, commits, ahead, error: null };
      } catch (e) {
        ci = { key, repo, commits: [], error: String(e?.message ?? e) };
      }
      this.ciLoading = false;
      if (this.ciKey() === key) this.ci = ci;
      cx.notify();
    });
  }

  // The commits that ran checks (an intermediate commit of a push has none), the PR's head always;
  // each with its runs and their tally.
  pushed() {
    const ci = this.ci;
    if (!ci?.commits?.length || ci.key !== this.ciKey()) return [];
    return ci.commits.map((x) => ({ ...x, ...(this.ciRuns[`${ci.repo}@${x.sha}`] ?? {}) }))
      .filter((x) => x.runs?.length || x.error || x.sha === ci.head)
      .map((x) => ({ ...x, runs: x.runs ?? [], tally: tally(x.runs ?? []) }));
  }

  // A failed check's log extract, on demand: `gh run view <run> --log-failed`, its job's last 40 lines.
  showLog(x, cx, only) {
    const key = x.id;
    if (this.ciLog?.key === key) { if (!only) this.ciLog = null; return; }
    const id = runIdOf(x.r), repo = this.ci?.repo;
    if (!id || !repo) { this.ciLog = { key, error: tr("notActions") }; return; }
    this.ciLog = { key, loading: true };
    cx.spawn(async (cx) => {
      const r = await exec("gh", ["run", "view", id, "--log-failed", "-R", repo], { timeout: 20e3 }).catch((e) => ({ code: 1, stdout: "", stderr: String(e?.message ?? e) }));
      if (this.ciLog?.key !== key) return;
      const lines = logTail(r.stdout, x.r.name, 40);
      this.ciLog = lines.length ? { key, run: id, lines }
        : { key, error: r.code ? `gh run view ${id} : ${r.stderr.trim().split("\n").pop() || tr("code", { code: r.code })}` : tr("noFailedLog") };
      this.logReveal = Boolean(lines.length);
      cx.notify();
    });
  }

  // CI's rows under the keys, as Review's; false: not a CI row (the timeline's keys go on).
  ciAct(a, x, cx, to) {
    const step = x?.kind === "step" && x.s.id === "ci" && this.ciFolds();
    if (!step && x?.kind !== "commit" && x?.kind !== "check") return false;
    const open = step && this.isCiOpen(x.s);
    if (a === "left") {
      if (step && !open) return false; // folds its phase, as any step
      if (step) this.ciOpen = false;
      else if (x.kind === "commit" && this.openCommit === x.pc.sha) this.toggleCommit(x.pc.sha);
      else if (x.kind === "commit") { this.ciOpen = false; to("s:ci"); }
      else if (this.ciLog?.key === x.id) this.ciLog = null;
      else { this.toggleCommit(x.sha); to(`ci:${x.sha}`); }
    } else if (a === "right") {
      if (step) this.toggleCi(true, cx);
      else if (x.kind === "commit") { if (this.openCommit !== x.pc.sha) this.toggleCommit(x.pc.sha); }
      else if (checkState(x.r) === "fail") this.showLog(x, cx, true);
    } else if (a === "open") {
      if (step) this.toggleCi(!open, cx);
      else if (x.kind === "commit") this.toggleCommit(x.pc.sha);
      else if (checkState(x.r) === "fail") this.showLog(x, cx);
      else this.openRun(x.r);
    } else if (a === "open-alt" && x.kind === "check") this.openRun(x.r);
    else if (a === "yank" && !step) {
      const text = x.kind === "commit" ? x.pc.sha : x.r.html_url ?? x.r.details_url ?? x.r.name;
      cx.write_to_clipboard(String(text));
      notify({ title: tr("copied"), body: String(text), level: "success", timeout: 2000 });
    } else return false;
    return true;
  }

  // Under an open CI step, as Review's: the runs' convergence (a bar per pushed commit, its height
  // the failed checks, green when all pass, the last one inked), a row per commit (sha, subject,
  // ✓ ✗ … pills, time), one unfolded into its checks, a failed one's log extract below it.
  ciBody(t, c, s) {
    if (s.id !== "ci" || !this.isCiOpen(s)) return [];
    const box = (rows) => [enter(this.motion, v_flex().ml(13).pl(10).pb(4).gap(2).border_l(1).border_color(t.border), "kf-ci", { dy: 0 }).children(rows)];
    const note = (text, color) => div().px(6).py(6).font_family(MONO).text_size(10.5).line_height("15px").text_color(color ?? t.dim).child(text);
    const ci = this.ci?.key === this.ciKey() ? this.ci : null;
    // While the checks are read: commit rows (28 px) as bars (skeleton.js), breathing, what is read under them.
    const S = skeleton(t, this.motion);
    if (!ci) return box([S.pulse(S.list(3, { h: 28, icon: 11, lines: [0.55], px: 6, gap: 7, gap_y: 2 }).id("kf-ci-sk")), note(tr("readingChecks", { key: this.ciKey() }))]);
    if (ci.error) return box([note(ci.error, c.err)]);
    const pushed = this.pushed();
    const last = pushed.at(-1)?.sha;
    // A check's conclusion in words (GitHub's: success, failure…); an unknown one as it comes.
    const CONCLUSIONS = ["success", "failure", "cancelled", "timed_out", "skipped", "neutral", "action_required", "startup_failure", "stale"];
    const word = (c) => (CONCLUSIONS.includes(c) ? tr(`c.${c}`) : String(c ?? ""));
    const rows = [];
    for (const p of pushed) {
      const x = p.tally, open = this.openCommit === p.sha, head = p.sha === last && p.sha === ci.head;
      const cursor = this.ring(`ci:${p.sha}`);
      rows.push(h_flex().id(`kf-ci-${p.sha}`).h(28).px(6).gap(7).items_center().rounded(8).cursor_pointer()
        .border(1).border_color(cursor ? alpha(t.accent, "99") : alpha(t.accent, "00"))
        .when(cursor, (el) => el.bg(alpha(t.accent, "24")))
        .when(head && !cursor, (el) => el.bg(alpha(t.accent, "14")))
        .when(!head && !cursor, (el) => el.hover((st) => st.bg(t.hover)))
        .on_click((_e, cx) => { this.toggleCommit(p.sha); cx.notify(); })
        .child(svg(I(open ? "chevron-down" : "chevron-right")).size(11).flex_none().text_color(open ? t.accent : t.dim))
        .child(div().flex_none().font_family(MONO).text_size(10.5).text_color(head ? t.foreground : t.muted).child(p.sha.slice(0, 7)))
        .child(div().flex_1().min_w(0).truncate().text_size(12).text_color(head ? t.foreground : t.muted).when(head, (el) => el.font_medium()).child(p.subject))
        .child(h_flex().flex_none().gap(4).items_center()
          .when(x.ok > 0, (el) => el.child(this.pill(t, `kf-cio-${p.sha}`, `✓ ${x.ok}`, c.ok)))
          .when(x.fail > 0, (el) => el.child(this.pill(t, `kf-cif-${p.sha}`, `✗ ${x.fail}`, c.err)))
          .when(x.pending > 0, (el) => el.child(this.pill(t, `kf-cip-${p.sha}`, `… ${x.pending}`, c.warn)))
          .when(!x.total, (el) => el.child(this.pill(t, `kf-cin-${p.sha}`, p.error ? tr("unreadable") : tr("noCheck"), p.error ? c.err : t.muted, null, null, p.error))))
        .child(h_flex().w(54).flex_none().justify_end().font_family(MONO).text_size(10.5).text_color(t.dim).child(duration(x.ms))));
      if (!open) continue;
      for (const r of checkOrder(p.runs)) {
        const st = checkState(r), id = `ck:${p.sha}:${r.name}`, logs = this.ciLog?.key === id ? this.ciLog : null;
        const color = st === "fail" ? c.err : st === "pending" ? c.warn : st === "ok" ? c.ok : t.dim;
        const cursor = this.ring(id), x = { id, r, sha: p.sha };
        rows.push(h_flex().id(`kf-${id}`).h(26).ml(18).px(6).gap(7).items_center().rounded(8)
          .border(1).border_color(cursor ? alpha(t.accent, "99") : alpha(t.accent, "00"))
          .when(cursor, (el) => el.bg(alpha(t.accent, "24")))
          .when(!cursor, (el) => el.hover((st) => st.bg(t.hover)))
          .child(h_flex().size(14).flex_none().items_center().justify_center().text_color(color)
            .child(st === "ok" ? svg(I("check")).size(12) : st === "fail" ? svg(I("x")).size(12)
              : div().size(7).rounded_full().bg(color).when(st === "pending", (el) => el.loop("opacity", { from: 0.35, to: 1, period: 1400 }))))
          .child(div().flex_1().min_w(0).truncate().text_size(12).text_color(st === "skip" ? t.muted : t.foreground).child(r.name))
          .when(st === "fail" && Boolean(runIdOf(r)), (el) => el.child(h_flex().id(`kf-logbtn-${id}`).flex_none().h(18).px(7).gap(4).items_center().rounded_full()
            .border(1).border_color(alpha(c.err, "4d")).bg(alpha(c.err, logs ? "33" : "1a")).font_family(MONO).text_size(10.5).text_color(c.err)
            .cursor_pointer().hover((st) => st.bg(alpha(c.err, "33")))
            .on_click((_e, cx) => { cx.stop_propagation(); this.showLog(x, cx); cx.notify(); })
            .child(svg(I("file-text")).size(11)).child(logs ? tr("hideLogs") : tr("showLogs"))))
          .child(div().flex_none().font_family(MONO).text_size(10.5).text_color(t.dim).child(st === "pending" ? "" : duration(checkMs(r))))
          .child(div().flex_none().font_family(MONO).text_size(10.5).text_color(color)
            .child(st === "pending" ? (r.status === "queued" ? tr("queued") : tr("inProgress")) : word(r.conclusion)))
          .when(Boolean(r.html_url ?? r.details_url), (el) => el.child(div().id(`kf-run-${id}`).flex_none().text_color(t.dim).cursor_pointer()
            .hover((st) => st.text_color(t.foreground)).tooltip(tr("openRun"))
            .on_click((_e, cx) => { cx.stop_propagation(); this.openRun(r); })
            .child(svg(I("external-link")).size(12)))));
        if (!logs) continue;
        // While the logs are read: the log block's lines as bars (skeleton.js), breathing, what is read under them.
        if (!logs.lines) {
          if (logs.loading) rows.push(div().ml(18).mb(4).child(S.pulse(v_flex().id(`kf-logs-sk-${id}`).p(10).gap(1).rounded(8).border(1).border_color(t.border).bg(t.raised)
            .children([0.7, 0.9, 0.5, 0.8].map((w) => S.line(w, { h: 6, lh: 15 }))))));
          rows.push(div().ml(18).child(note(logs.loading ? tr("readingLogs") : logs.error, logs.loading ? t.dim : c.err)));
          continue;
        }
        if (this.logReveal) { this.logScroll.scroll_to_item(logs.lines.length); this.logReveal = false; }
        // overflow_y_scroll + a Scrollbar of the same id: scroll_to_item does nothing on overflow_y_scrollbar.
        rows.push(div().relative().ml(18).mb(4)
          .child(v_flex().id(`kf-logs-${id}`).p(10).gap(1).max_h(240).overflow_y_scroll().track_scroll(this.logScroll)
            .rounded(8).border(1).border_color(t.border).bg(t.raised).font_family(MONO).text_size(10.5).line_height("15px")
            .child(div().pb(4).text_color(t.dim).child(tr("lastLines", { run: logs.run, n: logs.lines.length })))
            .children(logs.lines.map((l) => div().w_full().text_color(t.foreground).child(l || " "))))
          .child(Scrollbar.vertical(`kf-logs-${id}`).absolute().inset_0()));
      }
    }
    if (!pushed.length) rows.push(note(tr("noCommits")));
    if (ci.ahead > 0) {
      rows.push(h_flex().h(26).px(6).gap(7).items_center().rounded(8).bg(alpha(c.warn, "14"))
        .child(svg(I("git-commit")).size(12).flex_none().text_color(c.warn))
        .child(div().flex_1().min_w(0).truncate().text_size(12).text_color(c.warn)
          .child(tr("unpushed", { n: ci.ahead })))
        .child(div().flex_none().font_family(MONO).text_size(10.5).text_color(t.dim).child(this.branch ?? "")));
    }
    // The convergence (viz.js): each pushed commit's green and red checks, and the last one's checks still
    // running as a progress (done over total), as wide as this body. Nothing pushed: viz says « aucune donnée ».
    const V = viz(t, this.motion, { roll });
    const head = pushed.at(-1)?.tally;
    return [enter(this.motion, v_flex().ml(13).pl(10).pb(4).gap(2).border_l(1).border_color(t.border), "kf-ci", { dy: 0 })
      .child(h_flex().h(30).px(6).gap(8).items_center()
        .child(div().flex_none().font_family(MONO).text_size(10.5).text_color(t.muted).child("CONVERGENCE")) // i18n: tech
        .child(div().flex_1())
        .child(div().flex_none().font_family(MONO).text_size(10.5).text_color(t.dim).child(`${this.ciLoading ? "… " : ""}${ciLine(pushed)}`)))
      .child(v_flex().px(6).pt(2).pb(10).gap(12)
        .when(Boolean(head?.pending), (el) => el.child(V.progress(tr("checksRunning"), head.total - head.pending, {
          max: head.total, detail: tr("checksDone", { done: head.total - head.pending, total: head.total, sha: String(last).slice(0, 7) }),
          // live (#37): its front works while checks run, and the bar only shows then.
          color: head.fail ? "negative" : "warning", id: "kf-ci-progress", live: true })))
        .child(V.chart("bar", [
          { label: tr("green"), values: pushed.map((p) => p.tally.ok), color: "positive" },
          { label: tr("red"), values: pushed.map((p) => p.tally.fail), color: "negative" },
        ], { labels: pushed.map((p) => String(p.sha).slice(0, 7)), height: 140, id: "kf-ci-chart" })))
      .children(rows)];
  }

  // A phase all done is folded until clicked (or h / l).
  folded(p) {
    return this.fold[p.id] ?? (p.done === p.total && !p.failed);
  }

  phase(t, c, p, pulseId, cx) {
    const folded = this.folded(p);
    const all = p.done === p.total;
    const cursor = this.ring(`p:${p.id}`);
    // Its steps unfold and fold on their height (motion.js collapse, given a builder: the fold closes too).
    const body = collapse(this.motion, `kf-pb-${p.id}`, !folded, () => v_flex()
      .children(p.steps.flatMap((s, i) => [this.step(t, c, s, i === 0, i === p.steps.length - 1, s.id === pulseId),
        ...this.implBody(t, c, s), ...this.reviewBody(t, c, s), ...this.ciBody(t, c, s)])), { cx });
    return v_flex().flex_none().rounded(12).border(1).border_color(t.border).bg(t.background).p(4)
      .child(h_flex().id(`kf-p-${p.id}`).h(28).px(6).gap(8).items_center().rounded(8).cursor_pointer()
        .border(1).border_color(cursor ? alpha(t.accent, "99") : alpha(t.accent, "00"))
        .when(cursor, (el) => el.bg(alpha(t.accent, "24")))
        .when(!cursor, (el) => el.hover((s) => s.bg(t.hover)))
        .on_click((_e, cx) => { this.fold[p.id] = !folded; cx.notify(); })
        .child(svg(I(folded ? "chevron-right" : "chevron-down")).size(12).flex_none().text_color(t.muted))
        .when(all, (el) => el.child(svg(I("check")).size(12).flex_none().text_color(c.ok)))
        .child(div().flex_1().min_w(0).truncate().text_size(12.5).font_medium().text_color(p.current ? t.foreground : t.muted).child(p.label))
        .child(div().flex_none().font_family(MONO).text_size(11).text_color(all ? c.ok : p.failed ? c.err : t.dim).child(`${p.done}/${p.total}`)))
      .when(Boolean(body), (el) => el.child(body));
  }

  // ---------- empty ----------

  empty(t) {
    const why = !this.term ? tr("noTerminal") : tr("noFlow", { term: this.term });
    return v_flex().size_full().gap(4).text_color(t.foreground)
      .when(this.keyed, (el) => el.child(h_flex().flex_none().px(14).pt(6).child(div().flex_1()).child(modePill(t, this.vim))))
      .child(v_flex().flex_1().rounded(16).border(1).border_color(t.border).bg(t.background).items_center().justify_center().gap(12).p(24)
        .child(div().size(44).rounded_full().border(1).border_dashed().border_color(t.input).flex().items_center().justify_center()
          .text_color(t.dim).child(svg("mods/kt-panel-head/workflow.svg").size(18)))
        .child(div().text_size(14).font_medium().child(why))
        .child(div().max_w(380).text_size(12.5).line_height("19px").text_color(t.muted)
          .child(tr("about")))
        .child(h_flex().gap(8).items_center()
          .child(div().text_size(12).text_color(t.dim).child(tr("showIn")))
          .child(h_flex().id("kf-kbd").h(24).px(9).gap(6).items_center().rounded(6).border(1).border_color(t.input).bg(t.raised)
            .font_family(MONO).text_size(11.5).text_color(this.copied ? t.done : t.foreground).cursor_pointer().tooltip(tr("copy"))
            .hover((s) => s.border_color(t.accent))
            .on_click((_e, cx) => {
              cx.write_to_clipboard("/me:flow");
              this.copied = true;
              cx.timer.after(1500, (cx) => { this.copied = false; cx.notify(); });
              cx.notify();
            })
            .child(this.copied ? tr("copiedShort") : "/me:flow")
            .when(!this.copied, (el) => el.child(svg("mods/kt-diff/copy.svg").size(11).text_color(t.dim))))));
  }

  // ---------- loading (skeleton.js) ----------

  // The timeline while it is read, in its real sizes: the header card (workflow, branch, pills, the steps'
  // tiers and their line), then phase cards of 28 px rows, the running one unfolded. One loop around it all.
  skel(t, m) {
    const S = skeleton(t, m);
    const card = (r) => v_flex().flex_none().rounded(r).border(1).border_color(t.border).bg(t.background);
    const phase = (n, w) => card(12).p(4).child(S.list(n, { h: 28, icon: 12, lines: [w], px: 6, gap: 8 }));
    return v_flex().size_full().gap(4)
      .when(this.keyed, (el) => el.child(h_flex().flex_none().px(14).pt(6).child(div().flex_1()).child(modePill(t, this.vim))))
      .child(S.pulse(v_flex().id("kf-sk").flex_1().min_h(0).gap(4).overflow_hidden()
        .child(card(16).px(14).py(12).gap(9)
          .child(h_flex().gap(8).items_center().child(S.circle(14)).child(S.line(0.45, { h: 9, lh: 18 })))
          .child(S.line(0.35, { h: 7, lh: 15 }))
          .child(h_flex().gap(6).children([44, 72, 56].map((w) => S.block(w, 18, { r: 9 }))))
          .child(v_flex().gap(4).child(S.line(null, { h: 15, lh: 15, r: 2 })).child(S.line(0.5, { h: 6, lh: 14 }))))
        .child(phase(1, 0.3))
        .child(phase(4, 0.4))
        .child(phase(1, 0.35))));
  }

  render(cx) {
    const vis = visible();
    // The panel opens (and the last read is past 10 s, DATA-SYNC.md): look for the report and plans again.
    const stale = !this.shown && Date.now() - (this.readAt ?? 0) > 10e3;
    if (vis && stale) this.relink = true;
    if (vis && !checking() && (stale || this.follow() !== this.term)) this.read(cx);
    if (vis && !this.shown) this.showGen++;
    this.shown = vis;
    // DATA-SYNC.md: a commit, a push or a PR made elsewhere, or an agent of this space that stopped
    // working: the report, the plans and the CI are read again.
    const sp = spaces().find((s) => s.active)?.id;
    if (vis && !checking()) refreshOn(this, cx, "flow", ["git", "gh", ...(sp ? [`agent:${sp}`] : [])], async (cx) => {
      this.relink = true;
      this.read(cx);
      if (this.ciOpen) this.loadCi(cx, true);
    });
    const m = frame(this.motion, Boolean(shared("kt.reducedMotion")));
    const t = theme();
    this.keyed = this.handle.is_focused();
    // The same root in both states, so the keyboard stays here (focus, key:, esc, [ ]).
    const root = (el) => el.id("kt-flow").track_focus(this.handle).on_key_down((e, cx) => this.key(e, cx));
    // Before the first read, and after a change of terminal until its own read answers (readyFor): the
    // timeline's shape, never the previous terminal's flow, nor « pas de flow » before the answer.
    if (!readyFor(this.readFor, this.follow())) {
      this.flat = [];
      return root(this.skel(t, m));
    }
    const steps = this.flow?.steps ?? [];
    if (!steps.length) {
      this.flat = [];
      return root(this.empty(t));
    }
    const c = this.colors(t);
    // CI unfolded on another PR than the one read (the report moved): read it, once per PR.
    if (this.ciOpen && !checking() && this.ciKey() && this.ci?.key !== this.ciKey()) this.loadCi(cx, false);
    const pulseId = steps.find((s) => s.state === "current")?.id;
    const phases = phasesOf(steps);
    // The followed terminal's herdr-bridge (readBridge): its todos as listed, what it runs now; neither:
    // Implémentation has no fold, no count, no block.
    const b = this.bridge?.term === this.term ? this.bridge.b : null;
    const L = b ? taskList(b.todos) : null;
    this.list = L?.total ? L : null;
    this.now = this.nowOf(b);
    this.flat = this.walk(phases);
    // The cursor's phase card brought into view once after it moved. ponytail: kf-phases' children
    // are the cards, so a row deep in a card taller than the panel may stay below; flatten if it bites.
    if (this.reveal) {
      const at = this.flat.find((x) => x.id === this.cur);
      if (at) this.phasesScroll.scroll_to_item(at.card);
      this.reveal = false;
    }
    // The content fades in each time the tab is shown (the root keeps the keyboard).
    return root(v_flex().size_full().text_color(t.foreground)).child(enter(m, v_flex().size_full().gap(4), `kf-in-${this.showGen}`, { dy: 0 })
      .child(this.head(t, c, steps))
      // overflow_y_scroll + a Scrollbar of the same id: scroll_to_item does nothing on overflow_y_scrollbar.
      .child(div().relative().flex_1().min_h(0)
        .child(v_flex().id("kf-phases").size_full().overflow_y_scroll().track_scroll(this.phasesScroll).gap(4)
          .children(phases.map((p) => this.phase(t, c, p, pulseId, cx))))
        .child(Scrollbar.vertical("kf-phases").absolute().inset_0())));
  }
}
