// kbrdn Automatisation: everything that automates, read-only and 0 token, as a page: the "automation"
// child of kbrdn-threads' main "view" stack (kt-threads' navigation, Agents group, after Plugins).
// Two families, two engines, never mixed:
// A. Claude loops (me:loop:*): a Claude session iterates until a deterministic shell gate says done.
//    Sources: ~/.claude/skills/me/loop/*/SKILL.md, the shown space's <repo>/.claude/skills/me/loop
//    (« ## Définition », the intro's dimensions) and their cales commands/me/loop/<name>.md (global or
//    in the repo; a missing one is an alert: the loop can't be reached in Claude Code 2.1.327).
//    Running ones come from live data (an agent in a thread named loop:<name>, or a terminal labelled
//    loop=<name>); their « Itération N/M » from `hc read --lines 40`, only while the page shows, every
//    10 s at most. Lancer: a gwm worktree (never the main checkout; a PR loop needs its PR, checked by
//    gh pr view in the worktree), one loop of a name per worktree, then kt-confirm (where, tokens),
//    then a thread « loop:<name> » running claude on /me:loop:<name> in that worktree's space (or a
//    new space there). Voir (kt-skills, a dialog), Zed, Créer (form.js: /me:create-loop), Modifier.
// B. Herdr automations (sheprd-automate, Luau): a daemon runs approved scripts. Sources: the registry's
//    <repo>/.herdr/automations/*.luau, ~/.config/herdr-automate/automations/*.luau, `sheprd-automate
//    status`. Voir le plan (check), Approuver (Sheprd's own dialog: Kylian approves, never the page),
//    Lancer maintenant (kt-confirm, danger with an agent step), Runs. Without the binary: said, how
//    to get it, actions off.
// C. Claude Code schedules (/schedule, session crons): not listable locally, explained.
// The ONE session « Automatisation » (session.js, shared with kt-workflow) creates and edits.
// Scans when the page shows (if the last scan is over 10 s old), on Rafraîchir, on a change in the
// loop and automation folders (watched while shown), on the bus (skills). A file is re-read only when
// its mtime moved. One 1 s tick while the page shows (it notices the page left, the keyboard left,
// and every 10 s reads the running loops' screens); none while hidden.
// Keys (vim.js): j/k gg/G ctrl-d/u, enter/o the item's action (Voir, choisir, le plan), s Lancer, e
// Modifier, a Créer, C the session, O Zed, y copy, tab / shift-tab the filters, r refresh, ? kt-keys,
// esc closes the launch card or the output, then q / esc back to the thread.
// Mod commands: kt-automation.focus, key:<keys>, refresh, filter:<all|loops|herdr|schedule>,
// confirmed (kt-confirm's), create:<loop|automation>, session, dialog (the page again as a dialog,
// which then closes on q / esc: for captures under another dialog).

import { View, div, svg } from "gpui-kit";
import { v_flex, h_flex, ScrollHandle } from "gpui-base";
import { exec, hc, readTextFile, theme, spaces, panes, agents, terminals, run, layout, props, home, notify, checking, nextCommand, openOverlay, closeOverlay, shared, watchFolder } from "herdr";
import { classify, loopDef, isCale, running, iteration, targets, launch, luau, PR_LOOPS, TASK, intents, tilde, trimSlash } from "./auto.js";
import { makeT } from "./i18n.js";
import strings from "./strings.js";
import { session, showSession, dedicated } from "./session.js";
import { METHODS, NAME } from "./add.js";
import { AddForm } from "./form.js";
import { Vim, keysOf, keyOf, step } from "./vim.js";
import { filterRow, filterState } from "./filters.js";
import { dither, iconBtn, bandRow } from "./band.js";
import { motionState, frame, enter, pulse, rows as rowsOf } from "./motion.js";
import { viz } from "./viz.js";
// kt-keys' roll.js (a byte-identical copy): viz's figures, the head's and the sections' counts roll.
import { roll, rollText } from "./roll.js";
import { refreshOn } from "./bus.js";

const MONO = "Monaspace Krypton";
const I = (name) => `mods/kt-threads/${name}.svg`;
const OWN = (name) => `mods/kt-automation/${name}.svg`;
const SPIN = "mods/workspace-chrome/spinner.svg";
// A theme color with alpha `a`, replacing any it has (glass themes are #rrggbbaa).
const alpha = (c, a) => `${String(c).slice(0, 7)}${a}`;
const parse = (s) => { try { return JSON.parse(s ?? ""); } catch { return null; } };
const firstLine = (s) => String(s ?? "").trim().split("\n")[0] ?? "";
const sh = (cmd, args, o = {}) => exec(cmd, args, { timeout: 30e3, ...o }).catch((e) => ({ code: -1, stdout: "", stderr: String(e?.message ?? e) }));

const tr = makeT(strings);
// The filter row (FILTERS.md: pale tints; « Tout » neutral): [id, tint], its words strings.js' sec.<id>.
const SECS = [["all"], ["loops", "ansi5"], ["herdr", "ansi6"], ["schedule", "ansi4"]];
// An agent's state in words (strings.js' status.<state>); an unknown one as it comes.
const statusText = (s) => (["working", "blocked", "done", "idle"].includes(s) ? tr(`status.${s}`) : s ?? "—");
// A Luau trigger as people read it: « à 03:00 », « toutes les 6h », « cron … », « à la main ».
const when = (x) => (["at", "every", "cron"].includes(x.kind) ? tr(`when.${x.kind}`, { spec: x.spec ?? "?" }) : tr("when.manual"));

// The whole scan in one process: the loop, cale and script files (mtime, path; macOS stat, PATH's may
// be GNU's), the folders worth watching, sheprd-automate and sheprd. $1 home, $2 the shown project
// (or ""), then the registry's repos.
const STAT = `H=$1; P=$2; shift 2
st() { /usr/bin/stat -L -f '%m%t%N' "$@" 2>/dev/null; }
d() { for x in "$@"; do [ -d "$x" ] && printf 'DIR\\t%s\\n' "$x"; done; }
st "$H"/.claude/skills/me/loop/*/SKILL.md "$H"/.claude/commands/me/loop/*.md "$H"/.config/herdr-automate/automations/*.luau
d "$H/.claude/skills/me/loop" "$H/.claude/commands/me/loop" "$H/.config/herdr-automate/automations"
if [ -n "$P" ]; then st "$P"/.claude/skills/me/loop/*/SKILL.md "$P"/.claude/commands/me/loop/*.md; d "$P/.claude/skills/me/loop" "$P/.claude/commands/me/loop"; fi
for r in "$@"; do st "$r"/.herdr/automations/*.luau; d "$r/.herdr/automations"; done
for b in /Applications/Herdr.app/Contents/MacOS/sheprd-automate "$H"/Applications/*.app/Contents/MacOS/sheprd-automate "$(command -v sheprd-automate 2>/dev/null)"; do
  [ -n "$b" ] && [ -x "$b" ] && { printf 'BIN\\t%s\\n' "$b"; break; }; done
for s in /Applications/Herdr.app/Contents/MacOS/sheprd "$H"/Applications/*.app/Contents/MacOS/sheprd "$(command -v sheprd 2>/dev/null)"; do
  [ -n "$s" ] && [ -x "$s" ] && { printf 'SHEPRD\\t%s\\n' "$s"; break; }; done
exit 0`;

function find(node, id) {
  if (node?.id === id) return node;
  for (const c of node?.children ?? []) {
    const f = find(c, id);
    if (f) return f;
  }
  return null;
}
// Shown: kbrdn-threads' main "view" stack is on this page, or this copy is a dialog (mod.open
// kt-automation, any layout).
function visible() {
  if (props()?.overlay) return true;
  const v = find(layout(), "view");
  return (v?.active ?? v?.children?.[0]?.id) === "automation";
}
const activeSpace = () => spaces().find((s) => s.active);

export default class Automation extends View {
  init(_props, cx) {
    // « Créer »'s dialog: this mod again, in that role only (form.js; no scan, no page keys).
    const add = props()?.add;
    if (add) {
      const m = METHODS.find((x) => x.id === add);
      this.role = m ? new AddForm("kt-automation", m, cx) : null;
      if (!checking()) cx.spawn(async (cx) => {
        for (;;) {
          const c = await nextCommand();
          this.role?.command(c, cx);
          cx.notify();
        }
      });
      return;
    }
    this.handle = cx.focus_handle();
    this.vim = new Vim({ field: false });
    this.motion = motionState();
    this.filt = filterState();
    this.scroll = ScrollHandle.new();
    this.sec = "all";
    this.d = null; // the last scan (load())
    this.cache = new Map(); // path -> { mtime, text }
    this.busy = false;
    this.again = false;
    this.error = null;
    this.scannedAt = 0;
    this.watches = [];
    this.watched = ""; // the watched folders, joined
    this.shown = false;
    this.tick = null; // the 1 s tick, while the page shows
    this.ticks = 0;
    this.iter = {}; // terminal address -> { n, m } (the last « Itération N/M » read)
    this.headW = 0;
    this.width = 1100;
    this.cur = null; // the keys' cursor: an item id
    this.items = []; // the cursor's items, as the last render listed them
    this.reveal = null;
    this.notice = null; // { intent, why }: an intention that couldn't go to the live session
    this.launching = null; // the launch card: { loop, wts: null | [...], error, checking }
    this.out = null; // the output panel: { title, text, busy, ok }
    this.pending = null; // what kt-confirm's « confirmed » runs
    if (checking()) return;
    cx.spawn(async (cx) => {
      for (;;) {
        const c = await nextCommand();
        if (c === "focus") this.focusIn(cx);
        else if (c.startsWith("key:")) {
          this.focusIn(cx);
          for (const k of keysOf(c.slice(4))) this.press(k, cx);
        } else if (c === "refresh") this.scan(cx, "commande");
        else if (c.startsWith("filter:")) { this.sec = SECS.some(([k]) => k === c.slice(7)) ? c.slice(7) : "all"; this.cur = null; }
        else if (c === "confirmed") this.confirmed(cx);
        else if (c.startsWith("create:")) this.create(c.slice(7));
        else if (c === "session") this.openSession(null, cx);
        // The page again as a dialog over everything (captures while another dialog is open).
        else if (c === "dialog" && !props()?.overlay) openOverlay({ mod: "kt-automation", kind: "dialog", width: 0.94, height: 0.92, frame: "none" });
        cx.notify();
      }
    });
  }

  // ---------- data ----------

  // The shown space's git root (local spaces only), as kt-skills finds it.
  async projectRoot() {
    const s = activeSpace();
    if (!s || s.machine) return null;
    const tab = s.tabs.find((x) => x.active);
    const mine = panes().filter((p) => p.tab === tab?.id && p.terminal);
    const cwd = (mine.find((p) => p.program?.agent) ?? mine[0])?.cwd ?? s.folder;
    if (!cwd) return null;
    const r = await sh("git", ["-C", cwd, "rev-parse", "--show-toplevel"]);
    return r.code === 0 ? r.stdout.trim() : null;
  }

  // The registry's local repos (kt.projects).
  repos() {
    const all = shared("kt.projects");
    return [...new Set((Array.isArray(all) ? all : []).filter((p) => p && !p.machine && p.folder).map((p) => trimSlash(p.folder)))];
  }

  scan(cx, why) {
    if (checking()) return;
    if (this.busy) { this.again = true; return; }
    this.busy = true;
    console.log(`kt-automation: scan (${why})`);
    cx.spawn(async (cx) => {
      do {
        this.again = false;
        try {
          await this.load();
          this.error = null;
        } catch (e) {
          this.error = String(e?.message ?? e); // the last data stays shown
        }
      } while (this.again);
      this.busy = false;
      this.scannedAt = Date.now();
      if (visible()) this.watch(cx);
      cx.notify();
    });
  }

  async load() {
    const H = home(), C = `${H}/.claude`;
    const space = activeSpace()?.id ?? null;
    const root = await this.projectRoot();
    // ~/.claude itself is the global scope, not a project.
    const project = root && root !== H && root !== C ? root : null;
    const r = await exec("sh", ["-c", STAT, "sh", H, project ?? "", ...this.repos()], { timeout: 30e3 });
    const c = classify(r.stdout, { home: H, project });
    const read = async (p) => {
      const mtime = c.mtimes[p];
      const k = this.cache.get(p);
      if (k && k.mtime === mtime) return k.text;
      const text = await readTextFile(p).catch(() => null);
      this.cache.set(p, { mtime, text });
      return text;
    };
    const globalCale = (p) => p.startsWith(`${C}/`);
    const loops = await Promise.all(c.loops.map(async (l) => {
      const text = await read(l.path);
      // A global loop's cale is global; a project loop's is in its repo, else global.
      const cands = (c.cales[l.name] ?? []).filter((p) => l.scope === "projet" || globalCale(p)).sort((a, b) => globalCale(a) - globalCale(b));
      const cale = cands[0] ?? null;
      const caleText = cale ? await read(cale) : null;
      return { ...l, key: l.path, def: loopDef(text), unreadable: text == null, cale, copy: Boolean(cale) && !isCale(caleText, l.name), mtime: c.mtimes[l.path] };
    }));
    const scripts = await Promise.all(c.scripts.map(async (s) => {
      const text = await read(s.path);
      return { ...s, key: s.path, sum: luau(text), unreadable: text == null };
    }));
    let status = null;
    if (c.bin) {
      const st = await sh(c.bin, ["status"], { timeout: 15e3 });
      status = { ok: st.code === 0, text: (st.stdout.trim() || st.stderr.trim() || `code ${st.code}`) };
    }
    this.d = { loops, scripts, bin: c.bin, sheprd: c.sheprd, status, project, repos: this.repos().length, dirs: c.dirs, space };
  }

  // The folders the scan found, watched while the page shows; a change rescans, one while hidden
  // only stops watching.
  watch(cx) {
    const dirs = this.d?.dirs ?? [];
    if (dirs.join("\n") === this.watched && this.watches.length) return;
    this.unwatch();
    this.watched = dirs.join("\n");
    for (const dir of dirs) {
      cx.spawn(async (cx) => {
        for (;;) {
          const w = watchFolder(dir);
          this.watches.push(w);
          let paths;
          try { paths = await w; } catch { return; }
          this.watches = this.watches.filter((x) => x !== w);
          if (!paths.length) return; // cancelled
          if (!visible()) return void this.unwatch();
          this.scan(cx, "fichiers");
        }
      });
    }
  }

  unwatch() {
    for (const w of this.watches) w.cancel();
    this.watches = [];
    this.watched = "";
  }

  // The 1 s tick, only while the page shows: the page left (stop watching, the keyboard back to the
  // thread, stop ticking), the keyboard left (redraw without the cursor), and every 10 s the running
  // loops' « Itération N/M ».
  startTick(cx) {
    if (this.tick) return;
    this.ticks = 0;
    this.tick = cx.timer.every(1000, (cx) => {
      if (!visible()) {
        this.shown = false;
        this.unwatch();
        if (this.handle.is_focused()) this.focusThread();
        this.tick?.cancel();
        this.tick = null;
        return;
      }
      if (this.keyed !== this.handle.is_focused()) cx.notify();
      if (++this.ticks % 10 === 1) this.readIterations(cx);
    });
  }

  // `hc read --lines 40` of each running loop; a redraw only when a count moved.
  readIterations(cx) {
    const live = this.live();
    if (!live.length) return;
    cx.spawn(async (cx) => {
      let moved = false;
      await Promise.all(live.map(async (r) => {
        const out = await hc(["read", r.address, "--lines", "40"]).catch(() => null);
        const it = out?.code === 0 ? iteration(out.stdout) : null;
        const was = this.iter[r.address];
        if (it && (it.n !== was?.n || it.m !== was?.m)) { this.iter[r.address] = it; moved = true; }
      }));
      if (moved) cx.notify();
    });
  }

  live() {
    return running({ agents: agents(), panes: panes(), terminals: terminals() });
  }

  // ---------- actions ----------

  openSkill(name) {
    if (!name || checking()) return;
    openOverlay({ mod: "kt-skills", kind: "dialog", frame: "none", width: 0.9, height: 0.88, props: { select: name } });
  }

  zed(path) {
    if (path) exec("zed", [path]).catch(() => exec("open", [`zed://file${path}`]).catch(() => {}));
  }

  copy(text, cx) {
    cx.write_to_clipboard(text);
    notify({ title: tr("copied"), body: text, level: "success", timeout: 2000 });
  }

  // q / esc, a launch: back to the thread (a dialog closes).
  leavePage() {
    if (props()?.overlay) return void closeOverlay(props().overlay);
    run("layout.select", { stack: "view", child: "thread" });
    this.focusThread();
  }

  async close() {
    if (props()?.add) return void (await this.role?.dispose?.()); // the form's copy: no tick, no watch
    this.tick?.cancel();
    this.tick = null;
    this.unwatch();
  }

  focusThread() {
    const tab = activeSpace()?.tabs.find((c) => c.active)?.id;
    const pane = panes().find((p) => p.tab === tab && p.focused)?.pane;
    if (pane) run("pane.focus", { pane });
  }

  // A running loop: its project and thread, its terminal focused.
  showRunning(r) {
    if (props()?.overlay) closeOverlay(props().overlay);
    if (r.space) run("space.select", { id: r.space });
    if (r.tab) run("tab.select", { id: r.tab });
    run("layout.select", { stack: "view", child: "thread" });
    run("pane.focus", { terminal: r.address });
  }

  // « Créer » (form.js as a dialog): the description first. `root`: the project a loop or a script can
  // belong to.
  create(kind) {
    if (checking() || !METHODS.some((m) => m.id === kind)) return;
    openOverlay({ mod: "kt-automation", kind: "dialog", width: 1, height: 1, frame: "none", modal: true,
      props: { add: kind, space: activeSpace()?.id ?? null, root: this.d?.project ?? null } });
  }

  // The session « Automatisation » (session.js): shown, or opened (~/.claude for what is global, the
  // project for the rest), an intention typed only between two turns.
  openSession(intent, cx, folder) {
    if (checking()) return;
    const at = folder ?? `${home()}/.claude`;
    cx.spawn(async (cx) => {
      const r = await dedicated({ name: NAME, folder: at, task: TASK, intent });
      this.notice = r.why ? { intent, why: r.why, folder: at } : null;
      if (r.done === "sent") notify({ title: tr("sent", { name: NAME }), body: intent, level: "success", timeout: 2500 });
      cx.notify();
    });
  }

  editLoop(l, cx) {
    this.openSession(intents.editLoop(l.name, tilde(l.path, home())), cx, l.repo ?? undefined);
  }

  editScript(s, cx) {
    this.openSession(intents.editAutomation(tilde(s.path, home())), cx, s.repo ?? undefined);
  }

  // « Lancer »: the card that asks where, filled by `gwm list` in each repo (the loop's own repo only,
  // for a project loop).
  openLaunch(l, cx) {
    if (checking()) return;
    this.launching = { loop: l, wts: null, error: null, checking: null };
    this.sec = this.sec === "all" || this.sec === "loops" ? this.sec : "loops";
    this.reveal = "launch";
    cx.spawn(async (cx) => {
      const repos = l.repo ? [l.repo] : this.repos();
      const lists = await Promise.all(repos.map(async (repo) => {
        const r = await sh("gwm", ["list", "--format", "json", "--deny-bootstrap"], { cwd: repo, timeout: 20e3 });
        return r.code === 0 ? targets(parse(r.stdout), repo.split("/").pop()) : [];
      }));
      if (this.launching?.loop !== l) return;
      this.launching.wts = lists.flat();
      if (!this.launching.wts.length) this.launching.error = l.repo ? tr("noWorktreeIn", { path: tilde(l.repo, home()) }) : tr("noWorktree");
      cx.notify();
    });
  }

  // A worktree picked: its PR (a PR loop), the same loop already there (shown), else kt-confirm.
  pick(wt, cx) {
    const st = this.launching;
    if (!st || st.checking) return;
    const name = st.loop.name;
    st.error = null;
    st.checking = wt.path;
    cx.spawn(async (cx) => {
      let pr = null;
      if (PR_LOOPS.has(name)) {
        // gh pr view also answers a merged or closed PR of the branch: only an OPEN one counts.
        const r = await sh("gh", ["pr", "view", "--json", "number,url,title,state"], { cwd: wt.path, timeout: 20e3 });
        pr = r.code === 0 ? parse(r.stdout) : null;
        if (pr?.state !== "OPEN") pr = null;
      }
      if (this.launching !== st) return;
      st.checking = null;
      const p = launch({ name, wt, pr: pr?.number ?? null, spaces: spaces(), panes: panes(), live: this.live() });
      if (p.error) st.error = tr(`launch.${p.error}`, p);
      else if (p.show) { this.launching = null; this.showRunning(p.show); notify({ title: tr("alreadyHere", { name }), body: wt.name, level: "info", timeout: 3000 }); }
      else {
        this.pending = { kind: "loop", command: p.command, name, wt };
        openOverlay({ mod: "kt-confirm", kind: "dialog", frame: "none", props: {
          title: tr("run.title", { name }), tone: "warning", icon: "bot", label: tr("launch"),
          detail: tr("run.detail"),
          facts: [[tr("fact.project"), wt.project], [tr("fact.worktree"), tilde(wt.path, home())], [tr("fact.branch"), wt.branch ?? "—"],
            [tr("fact.pr"), pr ? `#${pr.number} ${pr.title ?? ""}`.trim() : PR_LOOPS.has(name) ? "—" : tr("notRequired")],
            [tr("fact.thread"), p.space ? tr("inProject", { name, project: p.space.name }) : tr("inNewProject", { name })], [tr("fact.task"), p.task],
            [tr("fact.cap"), st.loop.def.max ? tr("iterations", { n: st.loop.def.max }) : "—"]],
          consequence: tr("run.consequence", { path: tilde(wt.path, home()), task: p.task }),
          command: { name: "kt-automation.confirmed" } } });
      }
      cx.notify();
    });
  }

  confirmed(cx) {
    const p = this.pending;
    this.pending = null;
    if (!p) return;
    if (p.kind === "loop") {
      run(p.command.name, p.command.args);
      this.launching = null;
      this.leavePage();
    } else if (p.kind === "run-now") this.automate(tr("runNowTitle", { name: p.script.name }), ["run-now", p.script.path], cx);
  }

  // sheprd-automate <args>, its output in the panel (read-only: check, status, runs).
  automate(title, args, cx) {
    const bin = this.d?.bin;
    if (!bin || checking()) return;
    this.out = { title, text: "", busy: true, ok: true };
    this.reveal = "out";
    cx.spawn(async (cx) => {
      const r = await sh(bin, args, { timeout: 120e3 });
      if (this.out?.title !== title) return;
      this.out = { title, text: [r.stdout.trim(), r.stderr.trim()].filter(Boolean).join("\n\n") || tr("nothing", { code: r.code }), busy: false, ok: r.code === 0 };
      cx.notify();
    });
  }

  // Sheprd's approval dialog: Kylian approves there; the page never approves nor bypasses it.
  approve(s) {
    const bin = this.d?.sheprd;
    if (!bin || checking()) return;
    exec(bin, ["automation", "approve", s.path]).then((r) => {
      if (r.code !== 0) notify({ title: tr("approveFailed"), body: firstLine(r.stderr || r.stdout), level: "warning", timeout: 8000 });
    }).catch((e) => notify({ title: tr("approveImpossible"), body: String(e?.message ?? e), level: "warning", timeout: 8000 }));
  }

  runNow(s) {
    if (!this.d?.bin || checking()) return;
    this.pending = { kind: "run-now", script: s };
    const agent = s.sum.agent;
    openOverlay({ mod: "kt-confirm", kind: "dialog", frame: "none", props: {
      title: tr("now.title", { name: s.name }), danger: agent, tone: agent ? "danger" : "warning", label: tr("launch"),
      detail: tr(agent ? "now.agent" : "now.once"),
      facts: [[tr("fact.script"), tilde(s.path, home())], [tr("fact.triggers"), s.sum.triggers.map(when).join(" · ") || "—"], [tr("fact.steps"), s.sum.steps.join(", ") || "—"], [tr("fact.caps"), s.sum.caps ?? "—"]],
      consequence: `sheprd-automate run-now ${tilde(s.path, home())}`, // i18n: tech
      command: { name: "kt-automation.confirmed" } } });
  }

  // ---------- keys (vim.js; kt-keys lists them) ----------

  focusIn(cx) {
    this.handle.focus();
    this.vim.normal();
    if (!this.items.some((x) => x.id === this.cur)) this.cur = this.items[0]?.id ?? null;
    this.reveal = this.cur;
    if (visible()) this.startTick(cx);
  }

  key(e, cx) {
    if (!this.press(e, cx)) return; // not ours: ctrl-b, cmd-* go on
    cx.stop_propagation();
    cx.notify();
  }

  press(k, cx) {
    const name = keyOf(k).name;
    const x = this.items.find((i) => i.id === this.cur) ?? this.items[0] ?? null;
    if (name === "s") { x?.launch?.(cx); return true; }
    if (name === "e") { x?.edit?.(cx); return true; }
    if (name === "C") { this.openSession(null, cx); return true; }
    const a = this.vim.handle(k);
    if (!a) return false;
    if (a === "pending" || a === "count") return true;
    const i = x ? this.items.indexOf(x) : -1;
    if (["down", "up", "top", "bottom", "half-down", "half-up", "next", "prev"].includes(a)) {
      const to = this.items[step(a === "next" ? "down" : a === "prev" ? "up" : a, i, this.items.length, this.vim.count, 10)];
      if (to) { this.cur = to.id; this.reveal = to.id; }
    } else if (a === "tab-next" || a === "tab-prev") {
      const k2 = SECS.findIndex(([id]) => id === this.sec);
      this.sec = SECS[(k2 + (a === "tab-next" ? 1 : SECS.length - 1)) % SECS.length][0];
      this.cur = null;
    } else if (a === "open" || a === "right") x?.primary?.(cx);
    else if (a === "open-alt") this.zed(x?.path);
    else if (a === "yank") { if (x?.yank) this.copy(x.yank, cx); }
    else if (a === "refresh") this.scan(cx, "r");
    else if (a === "archive") this.create(x?.family === "herdr" || this.sec === "herdr" ? "automation" : "loop");
    else if (a === "help") openOverlay({ mod: "kt-keys", kind: "dialog", width: 1, height: 1, frame: "none", props: { group: "pages" } });
    else if (a === "escape" && (this.launching || this.out)) {
      if (this.launching) this.launching = null;
      else this.out = null;
    } else if (a === "quit" || a === "escape") this.leavePage();
    else return false;
    return true;
  }

  // ---------- pieces ----------

  card(t) {
    return v_flex().min_h(0).rounded(16).border(1).border_color(t.border).bg(t.background);
  }

  eyebrow(t, text, color) {
    return div().font_family(MONO).text_size(11).text_color(color ?? t.muted).child(String(text).toUpperCase());
  }

  // kbrdn.dev `.tag`: pill, border 30% / fill 10% of its own color.
  tag(t, color, text) {
    return h_flex().flex_none().h(18).px(7).items_center().rounded_full().border(1).border_color(alpha(color, "4d")).bg(alpha(color, "1a"))
      .text_color(color).font_family(MONO).text_size(10).child(String(text).toUpperCase());
  }

  // A small round icon button; it keeps its click from the row. `off`: a reason, then it does nothing.
  icon(t, id, icon, tip, fn, off) {
    return div().id(id).p(4).rounded_full().flex_none().text_color(off ? t.dim : t.muted).tooltip(off ? `${tip} : ${off}` : tip)
      .when(Boolean(off), (el) => el.opacity(0.5))
      .when(!off, (el) => el.cursor_pointer().hover((s) => s.bg(t.hover).text_color(t.foreground))
        .on_click((_e, cx) => { cx.stop_propagation(); fn(cx); cx.notify(); }))
      .child(svg(icon).size(13));
  }

  // A section's head: its name and count on a dashed rule, then its buttons.
  head(t, id, label, n, buttons, first) {
    return h_flex().px(8).pt(first ? 6 : 18).pb(6).gap(10).items_center()
      // The count rolls (roll.js), in the eyebrow's mono 11 and capitals.
      .child(n == null ? this.eyebrow(t, label).flex_none()
        : rollText(this.m, `kta-h-${id}-n`, `${String(label).toUpperCase()} · ${n}`, 15).flex_none().font_family(MONO).text_size(11).text_color(t.muted))
      .child(div().flex_1().h(0).border_t(1).border_dashed().border_color(t.border))
      .children(buttons ?? []);
  }

  sub(t, text) {
    return div().px(12).pt(8).pb(4).font_family(MONO).text_size(10).text_color(t.dim).child(String(text).toUpperCase());
  }

  // A text button with its icon, pale tinted (the section's color).
  action(t, id, label, icon, color, fn) {
    return h_flex().id(id).flex_none().h(26).px(10).gap(6).items_center().rounded_full().border(1).border_color(alpha(color, "66"))
      .bg(alpha(color, "14")).text_size(12).text_color(t.foreground).cursor_pointer().hover((s) => s.bg(alpha(color, "24")))
      .on_click((_e, cx) => { cx.stop_propagation(); fn(cx); cx.notify(); })
      .child(svg(icon).size(12).text_color(color)).child(label);
  }

  // The cursor's look: a 1 px accent ring with the ink, while the page has the keyboard.
  row(t, id, on) {
    return h_flex().id(id).mx(4).px(12).py(9).gap(10).items_start().rounded(12).border(1)
      .border_color(on ? alpha(t.accent, "99") : alpha(t.border, "00")).bg(on ? alpha(t.accent, "24") : alpha(t.background, "00"))
      .when(!on, (el) => el.hover((s) => s.bg(t.hover)));
  }

  explain(t, color, icon, title, paras) {
    return v_flex().mx(4).mb(4).p(12).gap(8).rounded(12).border(1).border_color(alpha(color, "66")).bg(alpha(color, "0f"))
      .child(h_flex().gap(8).items_center()
        .child(svg(icon).size(14).flex_none().text_color(color))
        .child(div().flex_1().text_size(13).font_semibold().text_color(t.foreground).child(title)))
      .children(paras.map((p) => div().text_size(12.5).line_height("19px").text_color(t.muted).child(p)));
  }

  block(t, text, color) {
    return v_flex().flex_none().rounded(12).border(1).border_color(t.border).bg(t.raised).px(12).py(10)
      .font_family(MONO).text_size(11.5).line_height("18px").text_color(color ?? t.foreground)
      .children(String(text).split("\n").slice(0, 400).map((l) => div().whitespace_nowrap().child(l || " ")));
  }

  statusDot(t, status) {
    if (status === "working") return svg(SPIN).size(10).flex_none().spin(900).text_color(t.working);
    return div().size(8).flex_none().rounded_full().bg(t[status] ?? t.dim);
  }

  // ---------- header ----------

  header(t, live) {
    const d = this.d;
    const s = session(NAME);
    const count = { loops: d?.loops.length ?? null, herdr: d?.scripts.length ?? null };
    const seg = filterRow({ id: "kta-seg", t, state: this.filt, active: this.sec, reduced: Boolean(shared("kt.reducedMotion")),
      items: SECS.map(([key, tint]) => ({ key, label: tr(`sec.${key}`), tint, count: count[key] ?? null })),
      onPick: (k) => { this.sec = k; this.cur = null; } });
    const sessionBtn = h_flex().id("kta-session").flex_none().h(30).px(13).gap(6).items_center().rounded_full()
      .bg(t.solid).text_color(t.solid_foreground).text_size(12.5).font_medium().cursor_pointer()
      .hover((x) => x.opacity(0.9)).tooltip(s ? tr("sessionLive", { name: NAME }) : tr("sessionNew"))
      .on_click((_e, cx) => { this.openSession(null, cx); cx.notify(); })
      .child(svg(I("bot")).size(13)).child(s ? tr("sessionBtn", { name: NAME }) : tr("openSession"));
    return this.card(t).id("kta-head").relative().flex_none().px(4).pb(4).gap(4)
      .on_size_change((x, cx) => { if (x.width !== this.headW) { this.headW = x.width; cx.notify(); } })
      .children([dither(this.headW, 60, 16, t.ansi5)].filter(Boolean))
      .child(bandRow(t, { m: this.m, color: t.ansi5, icon: OWN("repeat"), title: tr("title"),
        dot: live.some((r) => r.status === "working") ? t.working : live.length ? t.done : null,
        sub: [!d ? "…" : rollText(this.m, "kta-head-n", `${tr("loops", { n: d.loops.length })} · ${tr("automations", { n: d.scripts.length })}`, 14),
          live.length ? rollText(this.m, "kta-head-run", tr("running", { n: live.length }), 14) : null, tr("readOnly"), s ? tr("sessionOpen", { name: NAME }) : null],
        buttons: [
          iconBtn(t, "kta-b-loop", I("plus"), tr("createLoopTip"), () => this.create("loop")),
          iconBtn(t, "kta-b-refresh", I("refresh-cw"), this.busy ? tr("scanningTip") : tr("refreshTip"), (cx) => this.scan(cx, "bouton")), // i18n: tech
          div().w(4).flex_none(),
          sessionBtn] }))
      .child(div().flex_none().mx(-4).h(0).border_t(1).border_dashed().border_color(alpha(t.ansi5, "4d")))
      .when(this.busy || Boolean(this.error), (el) => el.child(h_flex().px(10).gap(8).items_center()
        .when(this.busy, (e2) => e2.child(pulse(this.m, div().font_family(MONO).text_size(11).text_color(t.dim).child(tr("scanning")), true)))
        .when(Boolean(this.error), (e2) => e2.child(div().min_w(0).truncate().text_size(12).text_color(t.ansi1).child(tr("readError", { error: this.error }))))))
      .when(Boolean(this.notice), (el) => el.child(this.noticeRow(t)))
      .child(div().px(4).pb(2).child(seg));
  }

  // An intention that couldn't go to the live session: why, Réessayer, the session, dismiss.
  noticeRow(t) {
    const n = this.notice;
    const btn = (id, label, fn) => h_flex().id(id).flex_none().h(26).px(10).items_center().rounded_full().border(1).border_color(alpha(t.ansi3, "66"))
      .text_size(12).text_color(t.foreground).cursor_pointer().hover((s) => s.bg(alpha(t.ansi3, "24")))
      .on_click((_e, cx) => { fn(cx); cx.notify(); }).child(label);
    return enter(this.m, h_flex().mx(4).px(10).py(6).gap(8).items_center().rounded(12).border(1).border_color(alpha(t.ansi3, "66")).bg(alpha(t.ansi3, "14")), "kta-notice", { dy: 0 })
      .child(svg(I("circle-alert")).size(14).flex_none().text_color(t.ansi3))
      .child(v_flex().flex_1().min_w(0).gap(1)
        .child(div().text_size(12.5).text_color(t.foreground).child(n.why))
        .child(div().truncate().font_family(MONO).text_size(11).text_color(t.muted).child(`Intention : ${n.intent}`))) // i18n: agent (what goes to the session)
      .child(btn("kta-n-retry", tr("retry"), (cx) => this.openSession(n.intent, cx, n.folder)))
      .child(btn("kta-n-show", tr("seeSession"), () => { const s = session(NAME); if (s) showSession(s); }))
      .child(this.icon(t, "kta-n-x", I("x"), tr("dismiss"), () => { this.notice = null; }));
  }

  // ---------- A. Claude loops ----------

  loops(t, kids, live, cx) {
    const d = this.d;
    kids.push(this.head(t, "loops", tr("sec.loops"), d.loops.length,
      [this.action(t, "kta-new-loop", tr("createLoop"), I("plus"), t.ansi5, () => this.create("loop"))], kids.length === 0));
    if (this.launching) this.put(kids, this.launchCard(t, live), "launch");
    // The running loops open and close on their height, in order (motion.js rows(), keyed by address),
    // under their heading while one is drawn: the last one to end closes too. A closing one adds no
    // item; `at` puts each one's items at its index as rows() builds it (the heading comes first).
    let at = kids.length + 1;
    const running = rowsOf(this.m, cx, "kta-live", live, (r) => r.address, (r, i) => {
      const el = this.runningRow(t, r, i < 0);
      this.claim(at++);
      return el;
    });
    if (running.length) kids.push(this.sub(t, tr("runningNow", { n: live.length })), ...running);
    if (!d.loops.length) kids.push(div().px(12).py(8).text_size(12.5).text_color(t.dim).child(tr("noLoop")));
    let group = null;
    for (const l of d.loops) {
      const g = l.scope === "global" ? tr("global") : tr("projectGroup", { name: l.repo.split("/").pop() });
      if (g !== group) { kids.push(this.sub(t, g)); group = g; }
      this.put(kids, this.loopRow(t, l, live));
    }
    if (!d.project) kids.push(div().px(12).pt(6).text_size(12).text_color(t.dim).child(tr("showProject")));
    else if (!d.loops.some((l) => l.scope === "projet")) kids.push(div().px(12).pt(6).text_size(12).text_color(t.dim) // i18n: tech
      .child(tr("noProjectLoop", { path: tilde(d.project, home()) })));
  }

  loopRow(t, l, live) {
    const id = `loop:${l.key}`;
    const on = this.keyed && this.cur === id;
    const def = l.def;
    const mine = live.filter((r) => r.name === l.name);
    const caleRel = `commands/me/loop/${l.name}.md`;
    const alert = !l.cale ? [t.ansi1, tr(l.repo ? "alert.noCaleRepo" : "alert.noCale", { path: caleRel, name: l.name })]
      : l.copy ? [t.ansi3, tr("alert.copy", { path: tilde(l.cale, home()), name: l.name })]
        : !def.defined ? [t.ansi3, tr("alert.noDef")] : null;
    this.items.push({ id, family: "loops", path: l.path, yank: `/me:loop:${l.name}`,
      primary: () => this.openSkill(`me:loop:${l.name}`), launch: (cx) => { if (l.cale) this.openLaunch(l, cx); }, edit: (cx) => this.editLoop(l, cx) });
    const dims = [def.mode, def.trigger, def.exec].filter(Boolean);
    return this.row(t, `kta-loop-${l.key}`, on).cursor_pointer()
      .when(Boolean(alert) && !on, (el) => el.border_color(alpha(alert[0], "66")))
      .tooltip(def.description ?? `me:loop:${l.name}`)
      .on_click((_e, cx) => { this.cur = id; cx.notify(); })
      .child(div().pt(5).child(div().size(8).flex_none().rounded_full().bg(!l.cale ? t.ansi1 : l.copy ? t.ansi3 : t.done)))
      .child(v_flex().flex_1().min_w(0).gap(3)
        .child(h_flex().h(20).gap(8).items_center()
          .child(h_flex().min_w(0).items_center().font_family(MONO).text_size(13).font_medium()
            .child(div().flex_none().text_color(t.dim).child("/me:loop:"))
            .child(div().min_w(0).truncate().text_color(t.foreground).child(l.name)))
          .children(dims.map((x) => this.tag(t, t.ansi5, x)))
          .when(PR_LOOPS.has(l.name), (el) => el.child(this.tag(t, t.ansi2, "PR")))
          .when(mine.length > 0, (el) => el.child(this.tag(t, t.working, tr("running", { n: mine.length }))))
          .child(div().flex_1())
          .child(h_flex().flex_none().gap(2)
            .child(this.icon(t, `kta-l-run-${l.key}`, OWN("play"), tr("launchTip"), (cx) => this.openLaunch(l, cx), !l.cale ? tr("noCale") : null))
            .child(this.icon(t, `kta-l-see-${l.key}`, "mods/kt-skills/eye.svg", tr("seeSkills"), () => this.openSkill(`me:loop:${l.name}`)))
            .child(this.icon(t, `kta-l-zed-${l.key}`, I("external-link"), tr("openZed"), () => this.zed(l.path)))
            .child(this.icon(t, `kta-l-edit-${l.key}`, I("square-pen"), tr("editE"), (cx) => this.editLoop(l, cx)))))
        .child(div().text_size(12.5).line_height("18px").text_color(def.goal ? t.muted : t.dim).child(l.unreadable ? tr("unreadableSkill") : def.goal ?? def.description ?? tr("noGoal")))
        .child(h_flex().gap(10).items_center().font_family(MONO).text_size(11).text_color(t.dim)
          .child(div().flex_none().child(tr("max", { n: def.max ?? "—" })))
          .child(div().flex_1().min_w(0).truncate().child(tr("exit", { exit: def.exit ?? "—" }))))
        .child(div().truncate().font_family(MONO).text_size(11).text_color(t.dim)
          .child(tr("check", { check: def.check ? def.check + (def.script ? tr("script", def.script) : "") : "—" })))
        .when(Boolean(alert), (el) => el.child(h_flex().gap(6).items_start()
          .child(svg(I("circle-alert")).size(12).flex_none().mt(2).text_color(alert[0]))
          .child(div().flex_1().min_w(0).text_size(12).line_height("17px").text_color(alert[0]).child(alert[1])))));
  }

  // `gone`: closing (rows() gave it -1), drawn as it was but no longer a target nor a keys' item.
  runningRow(t, r, gone = false) {
    const id = `run:${r.address}`;
    const on = !gone && this.keyed && this.cur === id;
    const sp = spaces().find((s) => s.id === r.space);
    const it = this.iter[r.address];
    if (!gone) this.items.push({ id, family: "loops", yank: r.address, primary: () => this.showRunning(r) });
    return this.row(t, `kta-run-${r.address}`, on).items_center()
      .tooltip(tr(r.via === "thread" ? "runTip.thread" : "runTip.label", { address: r.address, name: r.name }))
      .when(!gone, (el) => el.cursor_pointer().on_click((_e, cx) => { this.cur = id; this.showRunning(r); cx.notify(); }))
      .child(this.statusDot(t, r.status))
      .child(div().w(190).flex_none().truncate().font_family(MONO).text_size(12.5).font_medium().text_color(t.foreground).child(r.name))
      .child(div().flex_1().min_w(0).truncate().text_size(12).text_color(t.muted).child([sp?.name, r.cwd ? tilde(r.cwd, home()) : null].filter(Boolean).join(" · ") || r.address))
      .child(div().flex_none().font_family(MONO).text_size(11).text_color(t[r.status] ?? t.dim).child(statusText(r.status)))
      // « Itération N/M » as read on its screen (viz.js' dithered bar); nothing read yet: said.
      .child(it ? div().w(180).flex_none().child(this.V.progress(tr("iteration", { n: it.n, m: it.m }), it.n, { max: it.m, width: 180, color: "working", id: `kta-it-${r.address}`, live: r.status === "working" }))
        : div().w(180).flex_none().font_family(MONO).text_size(11).text_color(t.dim).child(tr("noIteration")));
  }

  // Where to launch: the worktrees, by project; the PR as gwm last saw it (gh checks it on the pick).
  launchCard(t, live) {
    const st = this.launching;
    const l = st.loop;
    const pr = PR_LOOPS.has(l.name);
    const rows = [];
    let group = null;
    for (const w of st.wts ?? []) {
      if (w.project !== group) { rows.push(this.sub(t, w.project)); group = w.project; }
      const id = `wt:${w.path}`;
      const on = this.keyed && this.cur === id;
      const busy = st.checking === w.path;
      const twin = live.find((r) => r.name === l.name && r.cwd && (trimSlash(r.cwd) === w.path || r.cwd.startsWith(w.path + "/")));
      this.items.push({ id, family: "loops", path: w.path, yank: w.path, primary: (cx) => this.pick(w, cx) });
      rows.push(this.row(t, `kta-wt-${w.path}`, on).items_center().cursor_pointer()
        .on_click((_e, cx) => { this.cur = id; this.pick(w, cx); cx.notify(); })
        .child(svg(I("git-branch")).size(13).flex_none().text_color(t.ansi2))
        .child(div().w(240).flex_none().truncate().font_family(MONO).text_size(12.5).text_color(t.foreground).child(w.name ?? w.path.split("/").pop()))
        .child(div().flex_1().min_w(0).truncate().font_family(MONO).text_size(11).text_color(t.dim).child(w.branch ?? ""))
        .when(Boolean(twin), (el) => el.child(this.tag(t, t.working, tr("alreadyRuns"))))
        .child(w.pr ? this.tag(t, t.ansi2, `PR #${w.pr}`) : div().flex_none().font_family(MONO).text_size(10.5).text_color(t.dim).child(pr ? tr("noPr") : "")) // i18n: tech
        .when(busy, (el) => el.child(pulse(this.m, div().font_family(MONO).text_size(11).text_color(t.dim).child(pr ? "gh pr view…" : "…"), true))));
    }
    return enter(this.m, v_flex().mx(4).mb(8).p(4).gap(2).rounded(14).border(1).border_color(alpha(t.ansi5, "80")).bg(alpha(t.ansi5, "0f")), `kta-launch-${l.key}`, { dy: 0 })
      .child(h_flex().px(8).py(6).gap(8).items_center()
        .child(svg(OWN("play")).size(14).flex_none().text_color(t.ansi5))
        .child(v_flex().flex_1().min_w(0).gap(2)
          .child(div().text_size(13).font_semibold().text_color(t.foreground).child(tr("where", { name: l.name })))
          .child(div().text_size(12).text_color(t.muted).child(tr(pr ? "where.pr" : "where.any"))))
        .child(this.icon(t, "kta-launch-x", I("x"), tr("closeEsc"), () => { this.launching = null; })))
      // The refusal under the title, where it's seen (the list can be long).
      .when(Boolean(st.error), (el) => el.child(h_flex().mx(8).mb(4).px(10).py(6).gap(6).items_start().rounded(10).border(1)
        .border_color(alpha(t.ansi1, "66")).bg(alpha(t.ansi1, "14"))
        .child(svg(I("circle-alert")).size(12).flex_none().mt(2).text_color(t.ansi1))
        .child(div().flex_1().min_w(0).text_size(12).line_height("17px").text_color(t.foreground).child(st.error))))
      .when(!st.wts, (el) => el.child(pulse(this.m, div().px(12).py(6).font_family(MONO).text_size(11).text_color(t.dim).child("gwm list…"), true)))
      .children(rows);
  }

  // ---------- B. Herdr automations ----------

  herdr(t, kids) {
    const d = this.d;
    kids.push(this.head(t, "herdr", tr("sec.herdr"), d.scripts.length,
      [this.action(t, "kta-new-auto", tr("createAutomation"), I("plus"), t.ansi6, () => this.create("automation"))], kids.length === 0));
    const off = d.bin ? null : tr("noBin");
    if (!d.bin) {
      kids.push(this.explain(t, t.ansi3, I("circle-alert"), tr("bin.title"), [tr("bin.1"), tr("bin.2"), tr("bin.3"), tr("bin.4")]));
    } else {
      kids.push(v_flex().mx(4).mb(4).gap(6)
        .child(h_flex().px(8).gap(8).items_center()
          .child(this.eyebrow(t, "sheprd-automate status", d.status?.ok ? t.dim : t.ansi1).flex_1()) // i18n: tech
          .child(div().font_family(MONO).text_size(10.5).text_color(t.dim).child(tilde(d.bin, home())))
          .child(this.icon(t, "kta-runs", I("list"), tr("runsTip"), (cx) => this.automate("Runs · sheprd-automate runs", ["runs"], cx)))) // i18n: tech
        .child(div().id("kta-status").overflow_x_scrollbar().child(this.block(t, d.status?.text ?? "…", d.status?.ok ? t.foreground : t.ansi1))));
    }
    if (this.out) this.put(kids, this.outPanel(t), "out");
    if (!d.scripts.length) {
      kids.push(div().px(12).py(8).text_size(12.5).line_height("19px").text_color(t.dim)
        .child(tr("noScript", { n: d.repos })));
    }
    for (const s of d.scripts) this.put(kids, this.scriptRow(t, s, off));
    kids.push(div().px(12).pt(8).text_size(12).line_height("18px").text_color(t.dim)
      .child(tr("knowThis")));
  }

  scriptRow(t, s, off) {
    const id = `script:${s.key}`;
    const on = this.keyed && this.cur === id;
    const plan = (cx) => this.automate(`Plan · ${s.name}`, ["check", s.path], cx);
    const runs = (cx) => this.automate(`Runs · ${s.name}`, ["runs", s.path], cx);
    this.items.push({ id, family: "herdr", path: s.path, yank: s.path, primary: (cx) => { if (!off) plan(cx); }, launch: () => { if (!off) this.runNow(s); }, edit: (cx) => this.editScript(s, cx) });
    const sum = s.sum;
    return this.row(t, `kta-script-${s.key}`, on).cursor_pointer()
      .on_click((_e, cx) => { this.cur = id; cx.notify(); })
      .child(svg(I("clock")).size(13).flex_none().mt(3).text_color(t.ansi6))
      .child(v_flex().flex_1().min_w(0).gap(3)
        .child(h_flex().h(20).gap(8).items_center()
          .child(div().min_w(0).truncate().font_family(MONO).text_size(13).font_medium().text_color(t.foreground).child(s.name))
          .child(this.tag(t, t.muted, s.repo ? s.repo.split("/").pop() : tr("personal")))
          .when(sum.agent, (el) => el.child(this.tag(t, t.ansi1, tr("agentTokens"))))
          .when(sum.worktree, (el) => el.child(this.tag(t, t.ansi3, "worktree"))) // i18n: tech
          .child(div().flex_1())
          .child(h_flex().flex_none().gap(2)
            .child(this.icon(t, `kta-s-plan-${s.key}`, I("file-text"), tr("planTip"), plan, off))
            .child(this.icon(t, `kta-s-ok-${s.key}`, I("circle-check"), tr("approveTip"), () => this.approve(s), this.d.sheprd ? null : tr("noSheprd")))
            .child(this.icon(t, `kta-s-run-${s.key}`, OWN("play"), tr("runNowTip"), () => this.runNow(s), off))
            .child(this.icon(t, `kta-s-runs-${s.key}`, I("list"), "Runs", runs, off)) // i18n: tech
            .child(this.icon(t, `kta-s-zed-${s.key}`, I("external-link"), tr("openZed"), () => this.zed(s.path)))
            .child(this.icon(t, `kta-s-edit-${s.key}`, I("square-pen"), tr("editE"), (cx) => this.editScript(s, cx)))))
        .child(div().truncate().text_size(12.5).text_color(sum.triggers.length ? t.muted : t.dim)
          .child(s.unreadable ? tr("unreadable") : sum.triggers.map((x) => (x.name ? `${x.name} : ${when(x)}` : when(x))).join(" · ") || tr("noTrigger")))
        .child(div().truncate().font_family(MONO).text_size(11).text_color(t.dim).child(`${sum.steps.join(", ") || tr("noStep")}${sum.caps ? tr("caps", { caps: sum.caps }) : tr("noCaps")}`))
        .child(div().truncate().font_family(MONO).text_size(11).text_color(t.dim).child(tilde(s.path, home()))));
  }

  outPanel(t) {
    const o = this.out;
    return enter(this.m, v_flex().mx(4).mb(6).p(4).gap(4).rounded(14).border(1).border_color(alpha(o.ok ? t.ansi6 : t.ansi1, "80")), `kta-out-${o.title}`, { dy: 0 })
      .child(h_flex().px(8).py(4).gap(8).items_center()
        .child(this.eyebrow(t, o.title, o.ok ? t.muted : t.ansi1).flex_1().min_w(0).truncate())
        .when(o.busy, (el) => el.child(pulse(this.m, div().font_family(MONO).text_size(11).text_color(t.dim).child(tr("inProgress")), true)))
        .child(this.icon(t, "kta-out-x", I("x"), tr("closeEsc"), () => { this.out = null; })))
      .child(div().id("kta-out-text").max_h(360).overflow_y_scrollbar().child(div().id("kta-out-x-scroll").overflow_x_scrollbar().child(this.block(t, o.busy ? "…" : o.text, o.ok ? t.foreground : t.ansi1))));
  }

  // ---------- C. Claude Code schedules ----------

  schedule(t, kids) {
    kids.push(this.head(t, "schedule", tr("schedules"), null, null, kids.length === 0));
    kids.push(this.explain(t, t.ansi4, I("clock"), tr("sched.title"), [tr("sched.1"), tr("sched.2"), tr("sched.3")]));
  }

  // ---------- page ----------

  // Pushes a scroll child and records it as the place of the items its building added (and of `key`:
  // "launch", "out"), for the keys' scroll_to_item.
  put(kids, el, key) {
    if (key) this.idx[key] = kids.length;
    kids.push(el);
    this.claim(kids.length - 1);
  }

  // Records the items built since the last claim as at scroll child `i`.
  claim(i) {
    for (const x of this.items.slice(this.mark)) this.idx[x.id] = i;
    this.mark = this.items.length;
  }

  body(t, live, cx) {
    const kids = [];
    this.items = [];
    this.idx = {}; // item id (or "launch", "out") -> its scroll child's index
    this.mark = 0;
    if (!this.d) {
      kids.push(div().p(16).text_size(13).text_color(this.error ? t.ansi1 : t.dim).child(this.error ?? tr("scanningAll")));
    } else {
      const want = (k) => this.sec === "all" || this.sec === k;
      if (want("loops")) this.loops(t, kids, live, cx);
      if (want("herdr")) this.herdr(t, kids);
      if (want("schedule")) this.schedule(t, kids);
    }
    if (this.reveal) {
      if (this.idx[this.reveal] != null) this.scroll.scroll_to_item(this.idx[this.reveal]);
      this.reveal = null;
    }
    return enter(this.m, v_flex().flex_1().min_h(0), `kta-in-${this.sec}`, { dy: 0 })
      .child(v_flex().id("kta-body").flex_1().min_h(0).overflow_y_scrollbar().track_scroll(this.scroll).p(4).pb(16).gap(2).children(kids));
  }

  render(cx) {
    if (props()?.add) return this.role ? this.role.render(cx) : div();
    this.m = frame(this.motion, Boolean(shared("kt.reducedMotion")));
    const vis = visible();
    const live = this.live();
    if (!checking()) {
      // The bus (DATA-SYNC.md): a skill (a loop is one) added or removed elsewhere rescans.
      refreshOn(this, cx, "data", ["skills"], async (cx) => this.scan(cx, "bus"));
      if (vis && !this.shown) {
        // The thread's terminal is hidden under this page: take the keyboard (NORMAL), after the app
        // has settled its own focus on the switch; tick while shown; read again when stale.
        cx.timer.after(150, (cx) => {
          if (visible() && !this.handle.is_focused()) this.focusIn(cx);
          cx.notify();
        });
        this.startTick(cx);
        if (Date.now() - this.scannedAt > 10e3) this.scan(cx, "page");
        else this.watch(cx);
      } else if (vis && this.d && !this.busy && (activeSpace()?.id ?? null) !== this.d.space) this.scan(cx, "projet"); // project loops
    }
    this.shown = vis;
    this.keyed = this.handle.is_focused();
    const t = theme();
    this.V = viz(t, this.m, { roll });
    // No frame of its own as a page: the layout's center column (chrome, radius 20, padding 4) holds it.
    // As a frameless dialog it draws that same frame.
    return v_flex().id("kta-root").size_full().gap(4).text_color(t.foreground)
      .when(Boolean(props()?.overlay), (el) => el.p(4).rounded(20).border(1).border_color(t.border).bg(t.chrome))
      .track_focus(this.handle)
      .on_key_down((e, cx) => this.key(e, cx))
      .on_size_change((size, cx) => { if (size.width !== this.width) { this.width = size.width; cx.notify(); } })
      .child(this.header(t, live))
      .child(this.card(t).flex_1().min_h(0).overflow_hidden().child(this.body(t, live, cx)));
  }
}
