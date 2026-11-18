// kbrdn Kanban (kt-kanban): kt-threads' threads as a board, GitHub Projects' Board view with what
// needs you first (the agent views' "Needs attention"). A view, not an editor: a thread's column is
// what its agent reports, never a drop, and a sorted board has no hand order.
// Its columns are a field, picked by a header button (c): the agent's status (Bloqué: waits on you,
// Fini non vu, En cours, Inactif: idle or no agent), or the flow's phase (kt-flow's: Préparation,
// Spec, Implémentation, Livraison, Clôture, then Sans flow; where a flow stands is threads-model's
// flow.at). Each column has its count (rolling) and its own scroll. Group by (b): none, or one foldable
// lane per project, each with the board's columns. Slice by (s): a narrow panel on the left lists a
// field's values (project, or agent) with their counts, and a click narrows the board to one; [ and ]
// step through them. Sort (t): by need and activity, the thread's age, its cost or its name. The four
// are mod.json's options (kt.opt.kt-kanban.*, the kt-mods console shows them); the slice picked is
// shared "kt.kanban.slicePick".
// Saved views (GitHub Projects' views), tabs over the toolbar, shared "kt.kanban.views": each keeps the
// four choices, the slice picked, the filter and the columns' limits; Tout, Bloqués and Ce projet by
// default. What shows is the current view until something changes (a dot on its tab, Enregistrer or
// Annuler), + makes one from what shows, ⋯ renames, duplicates or deletes (kt-confirm); gt / gT go from
// tab to tab. A column's head says `n / limit` with a soft limit (WIP: past it, in the warning color,
// nothing blocked; a click on the count, or + / -), and what its cards cost together (costLevel).
// The filter (`/`) reads GitHub's syntax: words and field:value terms (kanban.js parseQuery); a term it
// can't read is set aside and said before the field.
// The drawer (GitHub Projects' item panel): a card's side panel, DRAWER_W, right of the board, which
// narrows as it opens on its width (and widens as it folds). Space or o on the cursor's card, or a click
// on a card's title, opens it (it then follows the cursor); esc or q shuts it; enter still goes to the
// agent. In it: the head (the agent's live logo, title, project, branch, age), the flow in kt-flow's
// tiers (viz.js steps by phase), the issue, the PR and its checks in dither steps, the diff against the
// base, cost, context and sub-agents; its actions, each with its key: enter the agent, p pin, z snooze
// (1 2 3, 0 wakes), O the PR, I the issue, e Zed (a local checkout). Its PR, issue and diff (threads-io's
// readPr, readIssue, readDiff) are read as it opens, gh at most as often as the badges, the diff again
// with the reports (local), all again on r or a git / gh bump.
// A card: the agent's live logo (companion-logo.js), the title, pinned / snoozed as the sidebar shows
// them, the age; the project (logo, else its letter on its color) and the branch (a worktree's icon in
// a linked one); the issue, the PR and its state, the cost (levels.js), the sub-agents k/n;
// claude-flow's step. It lists every project's threads, whatever the sidebar's scope or filter: its
// views decide (GitHub Projects), through the filter typed after `/` (the archived only with
// is:archived), then the slice. A click or enter: back to the thread, on that agent (agent.focus).
// Keys (vim.js; kt-keys lists them under Pages): h / l a column, j / k a card (down into the next
// lane), gg / G, ctrl-d / u, / the filter (INSERT, esc: NORMAL), enter / o go, c b s t the header's
// buttons, [ ] the slice, gt / gT the views, + / - the column's limit, esc clears the filter, then back
// to the thread (as q), ? the keys. Arriving on
// the page takes the keyboard (NORMAL); ctrl-b h / l (pane.go, "focus") or `kt-kanban.key:<keys>` too.
// The "kanban" page of the layout's "view" stack. Its data: threads-model.js and threads-io.js (with
// thread-filter.js, pr-pick.js), byte-identical copies of kt-threads' (cmp), read only while the page
// shows (DATA-SYNC.md); the phases: kt-flow's steps.js and steps.strings.js (cmp). The board's logic:
// kanban.js (kanban.check.mjs). Words: strings.js (I18N.md).

import { View, div, svg, image } from "gpui-kit";
import { v_flex, h_flex, ScrollHandle } from "gpui-base";
import { spaces, panes, run, theme, shared, setShared, layout, nextCommand, settings, exec, home, readTextFile, openOverlay, checking, window as win } from "herdr";
import * as fs from "fs/promises";
import * as model from "./threads-model.js";
import * as io from "./threads-io.js";
import { longLived } from "./pr-pick.js";
import { OPTIONS, COLUMN_KEYS, DEFAULT_VIEWS, choice, nextChoice, board, slices, sliced, onBoard, locate, move, atCard, parseQuery, matchQuery,
  costOf, stepLimit, viewsOf, currentView, dirty, saveView, addView, duplicateView, renameView, deleteView, stepView, checkSteps, SNOOZES, wakeAt } from "./kanban.js";
import { companion } from "./companion-logo.js";
// kt-keys' viz.js (a byte-identical copy, with viz.strings.js): the drawer's dither steps (flow, checks).
import { viz } from "./viz.js";
import { costLevel, ctxLevel, levelColor } from "./levels.js";
import { Vim, keysOf, keyOf } from "./vim.js";
import { motionState, frame, enter, sharpen, rows, collapse, MS } from "./motion.js";
import { roll, rollText } from "./roll.js";
import { refreshOn } from "./bus.js";
import { ditherBand, TOP } from "./dither.js";
import { makeT, num as fnum } from "./i18n.js";
import strings from "./strings.js";
// kt-flow's phases (a byte-identical copy): the phase columns' names are Flow's, and the drawer's flow.
import { PHASES, speak, phasesOf, nameOf } from "./steps.js";

const tr = makeT(strings);
speak(makeT); // steps.js' phase names follow kt.lang too
const MONO = "Monaspace Krypton";
const I = (name) => `mods/kt-threads/${name}.svg`;
const K = (name) => `mods/kt-kanban/${name}.svg`;
const PAGE = "kanban";
const show = (child) => run("layout.select", { stack: "view", child });
const alpha = (c, a) => `${String(c).slice(0, 7)}${a}`;
// A registry or space color: a theme name ("ansi6") or a #hex.
const paint = (t, c) => (!c ? null : c.startsWith("#") ? c : t[c] ?? null);
// PR state -> icon and theme color name (kt-threads').
const PR = {
  OPEN: { icon: "git-pull-request", color: "ansi2" },
  MERGED: { icon: "git-merge", color: "ansi5" },
  CLOSED: { icon: "git-pull-request-closed", color: "ansi1" },
};
const PR_EVERY = 180e3; // a branch's PR, asked of gh at most this often (kt-threads')
const STALE = 10e3; // back on the page, what was read longer ago is read again (DATA-SYNC.md)
const PAGE_ROWS = 8; // the cards a column shows: ctrl-d / ctrl-u move half of it
const COL_W = 240; // a column's least width: a card stays readable
const DRAWER_W = 360; // the drawer's width (the board narrows beside it)
// A column's color, a theme name: the status' own; a phase's along the way (delivery green, wrap-up done).
const TINT = {
  blocked: "blocked", done: "done", working: "working", idle: "idle",
  prep: "ansi4", spec: "ansi5", impl: "working", ship: "ansi2", close: "done", other: "dim", none: "idle",
};
// The header's buttons, their keys and icons; mod.json declares the options (MOD-OPTIONS.md).
const OPT_KEYS = { c: "column", b: "group", s: "slice", t: "sort" };
const OPT_SHARED = { column: "kt.opt.kt-kanban.column", group: "kt.opt.kt-kanban.group", slice: "kt.opt.kt-kanban.slice", sort: "kt.opt.kt-kanban.sort" };
const OPT_ICON = { column: K("columns-3"), group: K("rows-3"), slice: I("panel-left"), sort: K("arrow-down-wide-narrow") };
const KEY_OF = { column: "c", group: "b", slice: "s", sort: "t" };
const PICKS = "kt.kanban.slicePick"; // { project: key | null, program: key | null }
const VIEWS = "kt.kanban.views"; // { current, list }: the saved views (kanban.js viewsOf)
const WAIT = 600; // vim.js' time between the two keys of gt / gT

// The board's choices as stored (the key strings in full: kt-mods finds who reads them by a grep).
function opts() {
  return {
    column: choice("column", shared("kt.opt.kt-kanban.column")),
    group: choice("group", shared("kt.opt.kt-kanban.group")),
    slice: choice("slice", shared("kt.opt.kt-kanban.slice")),
    sort: choice("sort", shared("kt.opt.kt-kanban.sort")),
  };
}

function find(node, id) {
  if (node?.id === id) return node;
  for (const c of node?.children ?? []) {
    const f = find(c, id);
    if (f) return f;
  }
  return null;
}
function visible() {
  const v = find(layout(), "view");
  return (v?.active ?? v?.children?.[0]?.id) === PAGE;
}

export default class Kanban extends View {
  init(_props, cx) {
    this.handle = cx.focus_handle();
    this.vim = new Vim({ field: true });
    this.motion = motionState();
    // What shows starts as the current view saved: its filter and limits here, its choices in shared.
    const saved = currentView(viewsOf(shared(VIEWS)));
    this.query = saved.filter;
    this.limits = { ...saved.limits }; // column key -> its soft limit (WIP)
    this.renaming = null; // the view whose tab is a field (its name being typed: this.draft)
    this.draft = "";
    this.viewMenu = false; // the current view's actions shown in the tab row
    this.limitEdit = null; // the column whose head shows its limit's stepper
    this.pending = null; // the view kt-confirm asks about deleting
    // The drawer (a card's side panel): the thread it shows (null: shut), the last one (drawn while it
    // closes), whether its snooze choices show; its PR, issue and diff by thread id ({ at, pr, issue,
    // diff, diffAt, loading }), read when it opens.
    this.drawer = null;
    this.drawerLast = null;
    this.snoozing = false;
    this.details = {};
    this.cur = null; // the keys' cursor: a thread id
    this.at = null; // where it last was, { l, c, i } (kanban.js locate)
    this.board = { keys: [], lanes: [] };
    // A column's key -> its ScrollHandle (made here: not during render); the lanes' one scroll.
    this.scrolls = Object.fromEntries(COLUMN_KEYS.map((k) => [k, ScrollHandle.new()]));
    this.laneScroll = ScrollHandle.new();
    this.boardScroll = ScrollHandle.new(); // no group: the columns side by side (h / l bring one into view)
    this.folded = new Set(); // lanes folded (a click on their head)
    this.memos = {}; // companion-logo's memo, by column and terminal
    this.arrivals = 0; // each arrival on the page fades it in again
    this.ticks = 0;
    // The World's reads (threads-model.js, as kt-threads keeps them): asked only while the page shows.
    this.repos = {};
    this.real = {};
    this.homeReal = null;
    this.live = {};
    this.quota = null;
    this.reports = {};
    this.prs = {};
    this.asked = {};
    this.defaults = {};
    this.queue = [];
    this.readAt = 0;
    if (checking()) return;
    cx.spawn(async (cx) => {
      const r = await exec("pwd", ["-P"], { cwd: home() }).catch(() => null);
      this.homeReal = r?.code === 0 ? r.stdout.trim() : home();
      cx.notify();
    });
    // Hidden, every timer returns at once: nothing is read, nothing redraws.
    cx.timer.every(1000, (cx) => this.tick(cx));
    cx.timer.every(3000, (cx) => { if (visible()) this.readLive(cx); });
    cx.timer.every(15000, (cx) => {
      if (!visible()) return;
      this.readReports(cx);
      if (this.drawer) this.loadDetail(cx); // its diff again (local, cheap); gh only once stale
    });
    cx.timer.every(1500, (cx) => { if (visible()) this.lookup(cx); });
    // `focus` (pane.go) takes the keyboard in NORMAL; `key:<keys>` takes it and types those keys
    // ("l", "g g", "/ f i x", "c"), for tests; `refresh` reads again.
    cx.spawn(async (cx) => {
      for (;;) {
        const c = await nextCommand();
        if (c === "focus") this.focusIn();
        else if (c.startsWith("key:")) {
          this.focusIn();
          for (const k of keysOf(c.slice(4))) this.press(k, cx);
        } else if (c === "refresh") this.refresh(cx);
        // kt-confirm's yes on deleting a view (command `kt-kanban.confirmed`, this copy shows behind it).
        else if (c === "confirmed" && this.pending) {
          const views = deleteView(viewsOf(shared(VIEWS)), this.pending);
          this.pending = null;
          this.setViews(views);
          this.applyView(currentView(views));
        }
        cx.notify();
      }
    });
  }

  // ---------- the World (threads-model.js), as kt-threads builds it ----------

  // Only reads the keys kt-threads writes (space.colors, kt.firstSeen, kt.projects): it never writes them.
  world(now) {
    return {
      repos: this.repos, real: this.real, home: home(), homeReal: this.homeReal,
      spaces: spaces(), panes: panes(), now, registry: model.sortRegistry(shared("kt.projects")),
      colors: shared("space.colors") ?? {}, live: this.live, reports: this.reports, prs: this.prs, defaults: this.defaults,
      snoozed: shared("kt.snoozed") ?? {}, pins: shared("kt.pins") ?? [], firstSeen: shared("kt.firstSeen") ?? {},
      dark: Boolean(settings().dark),
    };
  }

  // New folders only (a folder's repo and real path don't change): the spaces' and the terminals'.
  findRepos(cx) {
    if (this.finding || checking()) return;
    const ps = spaces();
    const here = [...ps.map((s) => [s.machine ?? null, s.folder]), ...panes().filter((p) => p.terminal)
      .map((p) => [p.terminal.includes("/") ? p.terminal.split("/")[0] : null, p.cwd])].filter(([, f]) => f).map((l) => JSON.stringify(l));
    const repos = [...new Set(here.filter((l) => !(l in this.repos)))];
    const reals = [...new Set(ps.filter((s) => s.folder).map(model.where).filter((l) => !(l in this.real)))];
    if (!repos.length && !reals.length) return;
    this.finding = true;
    cx.spawn(async (cx) => {
      for (const l of repos) this.repos[l] = await io.findRepo(l, exec);
      for (const l of reals) this.real[l] = await io.realOf(l, exec);
      this.finding = false;
      // /me:report's folders are named after the repos: the ones just found can have one.
      if (repos.length && visible()) this.readReports(cx);
      cx.notify();
    });
  }

  // herdr-bridge, statusline and claude-flow per agent (threads-io.js); redraws only when it changed.
  readLive(cx) {
    if (this.readingLive) return;
    this.readingLive = true;
    this.readAt = Date.now();
    cx.spawn(async (cx) => {
      const { live, quota } = await io.readLive(panes(), { home: home(), readTextFile }, { live: this.live, quota: this.quota });
      this.readingLive = false;
      const key = JSON.stringify([live, quota]);
      if (key !== this.liveKey) { this.liveKey = key; this.live = live; this.quota = quota; cx.notify(); }
    });
  }

  // /me:report's facts by branch (its PR, CI, review).
  readReports(cx) {
    if (this.readingReports) return;
    this.readingReports = true;
    cx.spawn(async (cx) => {
      const next = await io.readReports(panes(), this.repos, { home: home(), readTextFile, readdir: (dir) => fs.readdir(dir) });
      this.readingReports = false;
      const key = JSON.stringify(next);
      if (key !== this.reportsKey) { this.reportsKey = key; this.reports = next; cx.notify(); }
    });
  }

  // A card's branch whose PR gh hasn't been asked for lately (none from /me:report, none on a
  // long-lived branch): queued for lookup().
  wantPr(th) {
    const { lead, space } = th;
    if (th.prFrom === "report" || !lead?.cwd || !lead?.branch) return;
    if (longLived(lead.branch, this.defaults[model.repoOf(space.machine, lead.cwd, this.repos)])) return;
    const key = model.prKey(space.machine, lead.cwd, lead.branch);
    if (!(Date.now() - (this.asked[key] ?? 0) < PR_EVERY) && !this.queue.includes(key)) this.queue.push(key);
  }

  lookup(cx) {
    if (this.looking || !this.queue.length) return;
    this.looking = true;
    const keys = this.queue.splice(0);
    cx.spawn(async (cx) => {
      for (const key of keys) {
        this.asked[key] = Date.now();
        this.prs[key] = await io.lookupPr(key, { exec, repos: this.repos, defaults: this.defaults });
      }
      this.looking = false;
      cx.notify();
    });
  }

  refresh(cx) {
    this.asked = {};
    this.readLive(cx);
    this.readReports(cx);
  }

  // Once a second, shown: the keyboard leaving without a render, the ages (every 30 s). A hidden copy
  // doesn't render: this is where it sees the page go (ANIMATIONS.md, « Copie cachée »).
  tick(cx) {
    if (!visible()) {
      if (this.shown) {
        this.shown = false;
        // Left for another page or the thread with the keyboard still here: back to the thread's terminal.
        if (this.handle.is_focused()) this.toTerminal();
      }
      return;
    }
    if (this.keyed !== this.handle.is_focused() || ++this.ticks >= 30) {
      this.ticks = 0;
      cx.notify();
    }
  }

  // ---------- the header's choices ----------

  // The next value of a choice (a button, or its key): the default is stored as null (MOD-OPTIONS.md).
  cycle(opt) {
    const v = nextChoice(opt, opts()[opt]);
    setShared(OPT_SHARED[opt], v === OPTIONS[opt][0] ? null : v);
    this.reveal = true;
  }

  // The slice picked: `key`, or none (null): kept per field.
  pickSlice(field, key) {
    setShared(PICKS, { ...(shared(PICKS) ?? {}), [field]: key });
    this.reveal = true;
  }

  // ---------- saved views (kanban.js; the tabs over the board) ----------

  // What shows, as a view's settings: the choices, the slice picked, the filter, the limits.
  shownView() {
    const o = opts();
    return { ...o, pick: o.slice === "none" ? null : (shared(PICKS) ?? {})[o.slice] ?? null, filter: this.query, limits: this.limits };
  }

  setViews(views) {
    setShared(VIEWS, views);
  }

  // A view's settings shown: its choices (the defaults stored as null), its slice picked, its filter and limits.
  applyView(v) {
    for (const k of Object.keys(OPTIONS)) setShared(OPT_SHARED[k], v[k] === OPTIONS[k][0] ? null : v[k]);
    if (v.slice !== "none") setShared(PICKS, { ...(shared(PICKS) ?? {}), [v.slice]: v.pick });
    this.query = v.filter;
    this.limits = { ...v.limits };
    this.limitEdit = null;
    this.renaming = null; // another tab, a copy, a discard, a delete: no tab stays a field
    this.reveal = true;
  }

  // Another tab: its view as saved (what showed unsaved on the other one goes).
  selectView(id) {
    const views = viewsOf(shared(VIEWS));
    if (id === views.current) return;
    const next = { ...views, current: id };
    this.setViews(next);
    this.applyView(currentView(next));
  }

  // A view's name as the tab says it: its own, else the default one's in the language shown.
  viewName(v) {
    return v.name ?? (DEFAULT_VIEWS.some((d) => d.id === v.id) ? tr(`view.${v.id}`) : v.id);
  }

  newView() {
    const views = viewsOf(shared(VIEWS));
    const id = `v${Date.now().toString(36)}`;
    this.setViews(addView(views, this.shownView(), id, tr("view.new", { n: views.list.length + 1 })));
    this.startRename(id, ""); // typed from empty; enter on nothing keeps « Vue N »
  }

  duplicate() {
    const views = viewsOf(shared(VIEWS));
    const next = duplicateView(views, views.current, `v${Date.now().toString(36)}`, tr("view.copy", { name: this.viewName(currentView(views)) }));
    this.setViews(next);
    this.applyView(currentView(next));
  }

  // The tab becomes a field: the page types its name (enter keeps it, esc leaves it as it was).
  startRename(id, name) {
    this.renaming = id;
    this.draft = name;
    this.viewMenu = false;
    this.handle.focus();
    this.vim.normal();
  }

  commitRename() {
    this.setViews(renameView(viewsOf(shared(VIEWS)), this.renaming, this.draft));
    this.renaming = null;
  }

  // Deleting asks kt-confirm first (its yes comes back as `confirmed`); the last view has no delete.
  askDelete() {
    const views = viewsOf(shared(VIEWS));
    if (views.list.length < 2) return;
    const v = currentView(views);
    this.pending = v.id;
    this.viewMenu = false;
    openOverlay({ mod: "kt-confirm", kind: "dialog", width: 1, height: 1, frame: "none", props: {
      title: tr("view.del.title", { name: this.viewName(v) }), detail: tr("view.del.detail"), label: tr("view.delete"), danger: true,
      command: { name: "kt-kanban.confirmed" } } });
  }

  // ---------- keys (vim.js; kt-keys lists them) ----------

  focusIn() {
    this.handle.focus();
    this.vim.normal();
    this.reveal = true;
  }

  // The shown tab's focused pane takes the keyboard back.
  toTerminal() {
    const tab = spaces().find((s) => s.active)?.tabs.find((c) => c.active)?.id;
    const pane = panes().find((p) => p.tab === tab && p.focused)?.pane;
    if (pane) run("pane.focus", { pane });
  }

  // A card: back to the thread, its tab (the sidebar's click: tab.select by id reaches any space), on
  // its agent (kt-head's attention; "show an agent" alone doesn't say it selects the tab).
  open(th) {
    show("thread");
    run("tab.select", { id: th.id });
    if (th.terminal) run("agent.focus", { terminal: th.terminal });
  }

  key(e, cx) {
    if (!this.press(e, cx)) return; // not ours: ctrl-b, cmd-* go on
    cx.stop_propagation();
    cx.notify();
  }

  // One key, from the keyboard or `key:`. A tab being renamed takes them all (enter keeps, esc leaves).
  // In NORMAL, before vim: gt / gT the next / previous view (g is vim's pending gg: t or T after it), c
  // b s t the header's buttons, + / - the cursor's column's limit (vim has no use for them).
  press(e, cx) {
    const { name, char } = keyOf(e);
    if (this.renaming) {
      if (name === "enter") this.commitRename();
      else if (name === "escape") this.renaming = null;
      else if (name === "backspace") this.draft = this.draft.slice(0, -1);
      else if (char && !/^(ctrl|cmd)-/.test(name)) this.draft += char;
      else return false;
      return true;
    }
    if (this.vim.insert) return this.act(this.vim.handle(e), cx);
    if ((name === "t" || name === "T") && this.vim.pending === "g" && Date.now() - this.vim.at <= WAIT) {
      this.vim.normal();
      const views = viewsOf(shared(VIEWS));
      this.selectView(stepView(views, name === "t" ? 1 : -1));
      return true;
    }
    if (OPT_KEYS[name]) {
      this.vim.normal(); // a pending g or d, or a count, is dropped
      this.cycle(OPT_KEYS[name]);
      return true;
    }
    if (name === "+" || name === "-") {
      this.vim.normal();
      const key = this.board.keys[this.at?.c ?? 0];
      const n = this.board.lanes.reduce((s, lane) => s + (lane.cols[this.at?.c ?? 0]?.threads.length ?? 0), 0);
      if (key) this.limits = stepLimit(this.limits, key, name === "+" ? 1 : -1, n);
      return true;
    }
    // The drawer: space or o opens it on the cursor's card (again: shuts it); enter keeps going to the agent.
    if (name === "space" || name === "o") {
      this.vim.normal();
      const id = atCard(this.board, this.at ?? { l: 0, c: 0, i: -1 })?.id;
      if (this.drawer && this.drawer === id) this.closeDrawer(cx);
      else if (id) this.openDrawer(id, cx);
      return true;
    }
    // Its actions, while it shows (kt-keys lists them): p pin, z snooze (then 1 2 3 the choices, 0 wakes),
    // O the PR, I the issue, e Zed.
    const th = this.drawer ? this.byId?.get(this.drawer) : null;
    if (th) {
      const d = this.details[th.id] ?? {};
      const pick = this.snoozing ? { 1: "hour", 2: "tonight", 3: "tomorrow" }[name] ?? (name === "0" ? null : undefined) : undefined;
      const act = pick !== undefined ? () => this.snooze(th, pick)
        : { p: () => this.pin(th), z: () => { this.snoozing = !this.snoozing; }, O: () => this.browse(d.pr?.url ?? th.pr?.url),
          I: () => this.browse(d.issue?.url), e: () => this.zed(th) }[name];
      if (act) {
        this.vim.normal();
        act();
        return true;
      }
    }
    return this.act(this.vim.handle(e), cx);
  }

  // ---------- the drawer (a card's side panel, GitHub Projects' item panel) ----------

  openDrawer(id, cx) {
    this.drawer = id;
    this.drawerLast = id;
    this.snoozing = false;
    this.cur = id;
    this.reveal = true;
    this.loadDetail(cx);
  }

  // Its exit: it folds to 0 (the board widens beside it), then ONE timer lets its content go.
  closeDrawer(cx) {
    if (!this.drawer) return;
    this.drawer = null;
    this.snoozing = false;
    if (this.m?.reduced) this.drawerLast = null;
    else cx.timer.after(MS.panel + 40, (cx) => {
      if (this.drawer) return;
      this.drawerLast = null;
      cx.notify();
    });
  }

  // Its thread's PR (with its checks) and issue from gh, at most every PR_EVERY (as the badges) unless
  // forced (r, a gh bump); its diff against its base (the PR's, else the repo's default) each time, a
  // remote one only with the gh reads. Never in a check.
  loadDetail(cx, force = false) {
    const th = this.byId?.get(this.drawer);
    if (!th?.lead?.cwd || checking()) return;
    const d = (this.details[th.id] ??= { at: 0, diffAt: 0 });
    if (d.loading) return;
    // Stale, or the card knows another PR or issue than the one read (its badge found it since).
    const gh = force || Date.now() - d.at > PR_EVERY || (th.pr?.number ?? null) !== (d.prN ?? null) || (th.issue ?? null) !== (d.issueN ?? null);
    if (!gh && th.space.machine) return;
    d.loading = true;
    const { lead, space } = th;
    const where = { exec, cwd: lead.cwd, on: space.machine ?? null };
    cx.spawn(async (cx) => {
      if (gh) {
        const [pr, issue] = await Promise.all([th.pr ? io.readPr(th.pr.number, where) : null, th.issue ? io.readIssue(th.issue, where) : null]);
        Object.assign(d, { pr, issue, at: Date.now(), prN: th.pr?.number ?? null, issueN: th.issue ?? null });
      }
      const base = d.pr?.base ?? this.defaults[model.repoOf(space.machine, lead.cwd, this.repos)] ?? null;
      d.diff = lead.branch && base && lead.branch !== base ? await io.readDiff(base, where) : null;
      d.diffAt = Date.now();
      d.loading = false;
      cx.notify();
    });
  }

  pin(th) {
    const pins = shared("kt.pins") ?? [];
    setShared("kt.pins", pins.includes(th.id) ? pins.filter((p) => p !== th.id) : [...pins, th.id]);
  }

  // The sidebar's snooze (shared "kt.snoozed": { until, at }); null wakes it.
  snooze(th, choice) {
    const all = { ...(shared("kt.snoozed") ?? {}) };
    if (choice) all[th.id] = { until: wakeAt(choice, Date.now()), at: Date.now() };
    else delete all[th.id];
    setShared("kt.snoozed", all);
    this.snoozing = false;
  }

  browse(url) {
    if (!url) return;
    const p = win()?.platform;
    exec(p === "windows" ? "explorer.exe" : p === "macos" ? "open" : "xdg-open", [url]).catch(() => {});
  }

  // A local checkout only (Zed opens a folder of this computer).
  zed(th) {
    if (!th.cwd || th.space.machine) return;
    exec("zed", [th.cwd]).catch(() => exec("open", [`zed://file${th.cwd}`]).catch(() => {}));
  }

  // One vim action on the board; false: not one it has, and the key goes on.
  act(a, cx) {
    if (!a) return false;
    if (a === "pending" || a === "count" || a === "filter" || a === "normal") return true;
    const b = this.board;
    const at = this.at ?? { l: 0, c: 0, i: -1 };
    if (a === "type" || a === "backspace") this.query = a === "type" ? this.query + this.vim.char : this.query.slice(0, -1);
    else if (["down", "up", "top", "bottom", "half-down", "half-up", "next", "prev", "left", "right", "tab-next", "tab-prev"].includes(a)) {
      this.at = move(b, at, a, this.vim.count, PAGE_ROWS);
      this.cur = atCard(b, this.at)?.id ?? null;
      this.reveal = true;
      // An open drawer follows the cursor (j / k browse the cards in it).
      if (this.drawer && this.cur && this.cur !== this.drawer) this.openDrawer(this.cur, cx);
    } else if (a === "open-alt") {
      // O: the drawer's PR in the browser (while it shows).
      const th = this.drawer ? this.byId?.get(this.drawer) : null;
      if (!th) return false;
      this.browse(this.details[th.id]?.pr?.url ?? th.pr?.url);
    } else if (a === "open" || a === "submit") {
      const th = atCard(b, at);
      if (th) this.open(th);
    } else if (a === "panel-prev" || a === "panel-next") {
      // [ / ]: the slice before / after (« Tout » among them), while the panel shows.
      const field = opts().slice;
      if (field === "none") return true;
      const keys = [null, ...(this.sliceList ?? []).map((v) => v.key)];
      const j = keys.indexOf(this.pick ?? null);
      this.pickSlice(field, keys[(j + (a === "panel-next" ? 1 : keys.length - 1)) % keys.length]);
    } else if ((a === "escape" || a === "quit") && this.snoozing) this.snoozing = false;
    // Esc / q: the drawer shuts first; then esc empties the filter; then back to the thread.
    else if ((a === "escape" || a === "quit") && this.drawer) this.closeDrawer(cx);
    else if (a === "escape" && this.query) this.query = "";
    else if (a === "escape" || a === "quit") {
      show("thread");
      this.toTerminal();
    } else if (a === "refresh") {
      this.refresh(cx);
      if (this.drawer) this.loadDetail(cx, true);
    }
    else if (a === "help") openOverlay({ mod: "kt-keys", kind: "dialog", width: 1, height: 1, frame: "none", props: { group: "pages" } });
    else return false;
    return true;
  }

  // ---------- drawing ----------

  // The page's head (DESIGN-REFERENCE.md, Crosstalk's): 60 px over the dither of `tint`, a 32 px mark, the
  // title coming into focus (sharpen), a mono subtitle, the mode on the right. The toolbar is under it,
  // in the same card: the dither keeps off the top corners only.
  band(t, tint, title, sub, right) {
    const w = this.bandW;
    return div().id("kk-band").relative().flex_none().h(60).overflow_hidden().rounded_t(15)
      .on_size_change((size, cx) => {
        if (Math.abs((this.bandW ?? 0) - size.width) < 0.5) return;
        this.bandW = size.width;
        cx.notify();
      })
      // Inside the card's 1 px border: its radius 16 less the border.
      .when(w > 30, (el) => el.child(ditherBand(w, 60, 15, alpha(tint, settings().dark ? "6b" : "4d"), TOP)))
      .child(h_flex().size_full().px(12).gap(10).items_center()
        .child(h_flex().size(32).flex_none().rounded(10).items_center().justify_center().border(1).border_color(alpha(tint, "4d")).bg(alpha(t.background, "e6"))
          .child(svg(I("square-kanban")).size(16).text_color(tint)))
        .child(v_flex().flex_1().min_w(0).gap(2)
          .child(sharpen(this.m, `kk-title:${title}`, () => div().truncate().text_size(14).font_semibold().text_color(t.foreground).child(title)))
          .child(sub))
        .children(right));
  }

  // A header button that steps its choice (c b s t): its icon and the choice now, which fades in when it
  // changes (the language / theme buttons' way); accented while it isn't the default.
  choiceButton(t, opt, value) {
    const on = value !== OPTIONS[opt][0];
    return h_flex().id(`kk-opt-${opt}`).flex_none().h(26).px(10).gap(6).items_center().rounded_full().border(1)
      .border_color(on ? alpha(t.accent, "66") : t.border).bg(on ? alpha(t.accent, "24") : t.background)
      .text_size(12).text_color(on ? t.foreground : t.muted).cursor_pointer()
      .when(!on, (el) => el.hover((s) => s.bg(t.hover).text_color(t.foreground)))
      .tooltip(tr(`tip.${opt}`, { key: KEY_OF[opt] }))
      .on_click((_e, cx) => { this.cycle(opt); cx.notify(); })
      .child(svg(OPT_ICON[opt]).size(12).flex_none())
      .child(enter(this.m, div().whitespace_nowrap().child(tr(`opt.${opt}.${value}`)), `kk-opt-${opt}-${value}`, { dy: 0 }));
  }

  // The saved views as tabs (GitHub Projects' views): the current one in the ink, with a dot while what
  // shows isn't what it saved; + a new view from what shows (its name typed at once); then, the current
  // one changed, Enregistrer and Annuler; ⋯ its actions: rename, duplicate, delete (kt-confirm; the last
  // view has none). gt / gT go from tab to tab.
  tabs(t) {
    const views = viewsOf(shared(VIEWS));
    const changed = dirty(currentView(views), this.shownView());
    const chip = (id, label, onClick, color = t.muted) => h_flex().id(`kk-va-${id}`).flex_none().h(24).px(9).items_center().rounded_full().border(1)
      .border_color(t.border).text_size(12).text_color(color).cursor_pointer().hover((s) => s.bg(t.hover))
      .on_click((_e, cx) => { onClick(); cx.notify(); })
      .child(label);
    const tab = (v) => {
      const on = v.id === views.current;
      // Renaming: the name typed and a caret; nothing typed yet, its name now, faded.
      if (this.renaming === v.id) return h_flex().id(`kk-tab-${v.id}`).flex_none().h(28).px(12).items_center().rounded_full().border(1)
        .border_color(alpha(t.accent, "99")).bg(alpha(t.accent, "24")).text_size(12.5).text_color(this.draft ? t.foreground : t.dim)
        .child(`${this.draft || this.viewName(v)}▏`);
      return h_flex().id(`kk-tab-${v.id}`).flex_none().h(28).px(12).gap(6).items_center().rounded_full().border(1)
        .border_color(on ? alpha(t.accent, "66") : alpha(t.accent, "00")).when(on, (el) => el.bg(alpha(t.accent, "24")))
        .text_size(12.5).text_color(on ? t.foreground : t.muted).cursor_pointer()
        .when(!on, (el) => el.hover((s) => s.bg(t.hover).text_color(t.foreground)))
        .on_click((_e, cx) => { this.selectView(v.id); cx.notify(); })
        .child(div().whitespace_nowrap().child(this.viewName(v)))
        .when(on && changed, (el) => el.child(div().id("kk-dirty").size(6).rounded(3).flex_none().bg(t.blocked).tooltip(tr("view.dirty"))));
    };
    const icon = (id, path, tip, onClick) => h_flex().id(id).flex_none().size(26).items_center().justify_center().rounded_full()
      .text_color(t.dim).cursor_pointer().hover((s) => s.bg(t.hover).text_color(t.foreground)).tooltip(tip)
      .on_click((_e, cx) => { onClick(); cx.notify(); })
      .child(svg(path).size(13));
    return h_flex().id("kk-tabs").flex_none().h(40).px(10).gap(4).items_center().overflow_x_scroll()
      .children(views.list.map(tab))
      .child(icon("kk-view-add", I("plus"), tr("view.add"), () => this.newView()))
      .child(div().flex_1().min_w(8))
      .when(changed, (el) => el
        .child(chip("save", tr("view.save"), () => this.setViews(saveView(views, this.shownView())), t.foreground))
        .child(chip("discard", tr("view.discard"), () => this.applyView(currentView(views)))))
      .when(this.viewMenu, (el) => el
        .child(chip("rename", tr("view.rename"), () => this.startRename(views.current, this.viewName(currentView(views)))))
        .child(chip("duplicate", tr("view.duplicate"), () => { this.viewMenu = false; this.duplicate(); }))
        .when(views.list.length > 1, (el) => el.child(chip("delete", tr("view.delete"), () => this.askDelete(), t.ansi1))))
      .child(icon("kk-view-more", this.viewMenu ? I("x") : K("ellipsis"), tr("view.more"), () => { this.viewMenu = !this.viewMenu; }));
  }

  // The project's mark at `size`: Home's house, its registry logo, else its initial on its color.
  mark(t, p, size) {
    if (!p) return div().size(size).flex_none().rounded(3).bg(t.dim);
    if (p.home) return svg(I("house")).size(size).flex_none().text_color(t.muted);
    if (p.logo) return image(p.logo).size(size).flex_none().rounded(3);
    return div().size(size).flex_none().rounded(3).bg(paint(t, p.color) ?? t.dim).flex().items_center().justify_center()
      .child(div().text_size(Math.round(size * 0.62)).font_semibold().text_color(t.chrome).child([...p.name][0]?.toUpperCase() ?? "?"));
  }

  // A column's name: the status' (strings.js), else the phase's (kt-flow's), « Autres », « Sans flow ».
  colName(key) {
    return PHASES.find((p) => p.id === key)?.label ?? tr(`col.${key}`);
  }

  // A column's head: its color's dot, its name, its count rolling, `n / limit` with a soft limit (in the
  // warning color past it: nothing is blocked), and on the right what its cards cost together (rolling,
  // in costLevel's color). A click on the count shows the limit's stepper under it (or + / - on the
  // cursor's column); the limit belongs to the view.
  colHead(t, key, list) {
    const n = list.length;
    const lim = this.limits[key];
    const over = Boolean(lim) && n > lim;
    const cost = costOf(list);
    const editing = this.limitEdit === key;
    const mono = (el) => el.font_family(MONO).text_size(11);
    const step = (id, label, onClick) => h_flex().id(`kk-lim-${id}-${key}`).flex_none().h(22).px(8).items_center().justify_center().rounded(6).border(1)
      .border_color(t.border).bg(t.background).text_size(12).text_color(t.muted).cursor_pointer().hover((s) => s.bg(t.hover).text_color(t.foreground))
      .on_click((_e, cx) => { onClick(); cx.notify(); })
      .child(label);
    return v_flex().flex_none()
      .child(h_flex().h(40).px(14).gap(8).items_center()
        .child(div().size(8).rounded(4).flex_none().bg(t[TINT[key]] ?? t.dim))
        .child(div().flex_none().text_size(13).font_medium().text_color(t.foreground).child(this.colName(key)))
        .child(h_flex().id(`kk-wip-${key}`).flex_none().h(20).px(6).gap(3).items_center().rounded(6).border(1)
          .border_color(over ? alpha(t.blocked, "66") : editing ? t.border : alpha(t.border, "00"))
          .when(over, (el) => el.bg(alpha(t.blocked, "24")))
          .text_color(over ? t.blocked : t.dim).cursor_pointer().hover((s) => s.bg(t.hover))
          .tooltip(over ? tr("limit.over", { n, lim }) : tr("limit.tip"))
          .on_click((_e, cx) => { this.limitEdit = editing ? null : key; cx.notify(); })
          .child(mono(roll(this.m, `kk-n-${key}`, String(n), 14)))
          .when(Boolean(lim), (el) => el.child(mono(div()).child(`/ ${lim}`))))
        .child(div().flex_1())
        .when(cost > 0, (el) => el.child(div().id(`kk-cost-${key}`).flex_none().tooltip(tr("cost.sum"))
          .child(mono(roll(this.m, `kk-cost-n-${key}`, `$${fnum(cost, 2)}`, 14, { snap: 2 })).text_color(levelColor(t, costLevel(cost), { okGreen: true }))))))
      .when(editing, (el) => el.child(h_flex().h(32).px(14).gap(6).items_center()
        .child(div().flex_none().text_size(12).text_color(t.muted).child(tr("limit")))
        .child(step("minus", "−", () => { this.limits = stepLimit(this.limits, key, -1, n); }))
        .child(mono(div()).flex_none().w(28).text_center().text_color(lim ? t.foreground : t.dim).child(lim ? String(lim) : "—"))
        .child(step("plus", "+", () => { this.limits = stepLimit(this.limits, key, 1, n); }))
        .child(div().flex_1())
        .when(Boolean(lim), (el) => el.child(step("none", tr("limit.none"), () => { this.limits = stepLimit(this.limits, key, -lim, n); })))));
  }

  // One card, ~240 px wide. `col` goes into every id: a card changing column is drawn twice for a moment
  // (its leaving copy in the old column, rows()). `gone`: that leaving copy, no longer a target.
  card(t, th, col, cursor, gone, now, cx) {
    const key = `${col}-${th.id}`;
    const muted = th.settled || th.asleep;
    const bridge = th.terminal ? this.shownLive[th.terminal] : null;
    const pet = companion({
      program: th.program, state: th.agent?.status ?? th.status ?? "idle", id: `kk-c-${key}`, cx, size: 20, height: 16,
      action: bridge?.state ? (bridge.action ?? null) : undefined, since: bridge?.state ? bridge.since : undefined,
      memo: (this.memos[`${col}:${th.terminal ?? th.id}`] ??= {}),
    });
    const mono = (color, text) => div().flex_none().font_family(MONO).text_size(10.5).text_color(color).child(text);
    // The sidebar's corner: a snoozed card's time left (clock, in working), else its age.
    const corner = th.asleep
      ? h_flex().id(`kk-sn-${key}`).flex_none().gap(3).items_center().text_color(t.working).tooltip(tr("snoozed", { left: model.until(th.snooze.until, now) }))
        .child(svg(I("clock")).size(11)).child(mono(t.working, model.until(th.snooze.until, now).toUpperCase()))
      : mono(t.dim, model.age(th.settled ? th.tab.settled_at ?? th.activity : th.activity, now).toUpperCase());
    // A draft PR in dim, as kt-flow shows it.
    const look = !th.pr ? null : th.pr.state === "OPEN" && (th.pr.draft ?? th.pr.isDraft) ? { ...PR.OPEN, color: "dim" } : PR[th.pr.state] ?? PR.OPEN;
    const subs = th.subagents;
    // The facts there are: the issue (its number only: the model has no state for it), the PR in its
    // state's color, the cost by level, the sub-agents ended / all.
    const facts = [
      th.issue && h_flex().flex_none().gap(3).items_center().text_color(t.muted)
        .child(svg(I("circle-dashed")).size(11)).child(mono(t.muted, `#${th.issue}`)),
      look && h_flex().flex_none().gap(3).items_center().text_color(t[look.color])
        .child(svg(I(look.icon)).size(11)).child(mono(t[look.color], `#${th.pr.number}`)),
      th.cost != null && mono(levelColor(t, costLevel(th.cost, th.model), { okGreen: true }), `$${fnum(th.cost, 2)}`),
      subs.total > 0 && h_flex().id(`kk-sub-${key}`).flex_none().gap(3).items_center().text_color(t.dim)
        .tooltip(tr("subagents", { done: subs.done, total: subs.total }))
        .child(svg(I("bot")).size(11)).child(mono(t.dim, `${subs.done}/${subs.total}`)),
    ].filter(Boolean);
    const step = th.flow?.step?.label;
    const working = th.status === "working";
    return v_flex().id(`kk-card-${key}`).p(8).gap(4).rounded(12).border(1)
      .border_color(cursor ? alpha(t.accent, "99") : th.shown ? alpha(t.accent, "66") : t.border)
      .bg(cursor || th.shown ? alpha(t.accent, "24") : t.background)
      .when(muted, (el) => el.opacity(0.62))
      .when(!gone && !cursor, (el) => el.hover((s) => s.bg(t.hover)))
      .when(!gone, (el) => el.cursor_pointer().on_click(() => this.open(th)))
      .child(h_flex().h(20).gap(8).items_center()
        .child(pet)
        // The title opens the card's drawer (the rest of the card goes to the agent, as enter).
        .child(div().id(`kk-tt-${key}`).flex_1().min_w(0).truncate().text_size(13).font_medium().text_color(muted ? t.muted : t.foreground)
          .when(!gone, (el) => el.hover((s) => s.text_color(t.accent)).on_click((_e, cx) => { cx.stop_propagation(); this.openDrawer(th.id, cx); cx.notify(); }))
          .child(th.title))
        .when(th.pinned, (el) => el.child(svg(I("pin")).size(11).flex_none().text_color(t.dim)))
        .child(corner))
      .child(h_flex().h(16).gap(6).items_center()
        .child(this.mark(t, th.project, 12))
        .child(div().flex_none().max_w(96).truncate().font_family(MONO).text_size(10).text_color(t.muted).child(th.project.name.toUpperCase()))
        .when(Boolean(th.branch), (el) => el
          .child(svg(I(th.worktree ? "folder-tree" : "git-branch")).size(11).flex_none().text_color(t.dim))
          .child(div().flex_1().min_w(0).truncate().font_family(MONO).text_size(10.5).text_color(t.dim).child(th.branch))))
      .when(facts.length > 0, (el) => el.child(h_flex().h(16).gap(10).items_center().overflow_hidden().children(facts)))
      .when(Boolean(step), (el) => el.child(h_flex().h(16).gap(6).items_center()
        // The step's dot breathes while the agent works (an active state: ANIMATIONS.md).
        .child(div().id(`kk-step-${key}`).size(6).rounded(3).flex_none().bg(t.accent)
          .when(working && !this.m.reduced, (d) => d.loop("opacity", { from: 0.35, to: 1, period: 1400 })))
        .child(div().min_w(0).truncate().font_family(MONO).text_size(10.5).text_color(t.muted).child(step))));
  }

  // An empty column says why, in clear.
  emptyText(key) {
    if (this.query || this.pick != null) return tr("noMatch");
    return opts().column === "status" ? tr(`empty.${key}`) : tr("empty.phase");
  }

  // No group: a column (a card of radius 16, concentric with the work card; GitHub's board: a recessed
  // lane, the cards on the terminals' background): its head, then its cards, scrolling on their own,
  // entering and leaving on their height (rows(), keyed by thread). `cur`: the cursor's thread when it is
  // in this column.
  column(t, col, cur, now, cx) {
    const scroll = this.scrolls[col.key];
    // scroll_to_item counts every child rows() gives, the leaving ones too.
    let k = 0;
    const cards = rows(this.m, cx, `kk-col-${col.key}`, col.threads, (th) => th.id, (th, i) => {
      if (i >= 0 && this.reveal && th.id === cur) {
        scroll?.scroll_to_item(k);
        this.reveal = false;
      }
      k++;
      return div().w_full().pb(6).child(this.card(t, th, col.key, i >= 0 && th.id === cur, i < 0, now, cx));
    });
    return v_flex().id(`kk-lane-${col.key}`).flex_1().min_w(COL_W).h_full().rounded(16).border(1).border_color(t.border).bg(t.chrome)
      .child(this.colHead(t, col.key, col.threads))
      .child(div().flex_none().h(0).border_t(1).border_dashed().border_color(alpha(t[TINT[col.key]] ?? t.dim, "4d")))
      .child(v_flex().id(`kk-list-${col.key}`).flex_1().min_h(0).overflow_y_scrollbar().when(Boolean(scroll), (el) => el.track_scroll(scroll)).p(6)
        .when(!cards.length, (el) => el.child(div().p(8).text_size(12.5).line_height("18px").text_color(t.dim).child(this.emptyText(col.key))))
        .children(cards));
  }

  // By project: the column heads once on top, then one lane per project, its head (a click folds it: its
  // project's mark, its name, its count rolling) and its row of cells, the board's columns. The lane folds
  // on its height (collapse, a builder): inside, the cards only fade in (enter), never rows(), which would
  // be a second height level in it (ANIMATIONS.md). Everything scrolls together, both ways: the columns
  // are as wide as the board allows, 240 at least.
  lanes(t, b, cur, now, cx) {
    const n = b.keys.length;
    const w = Math.max(COL_W, Math.floor(((this.lanesW ?? 0) - 12 - 4 * (n - 1)) / n));
    const total = n * w + 4 * (n - 1);
    // A column's cards in every lane: its head's count, limit and cost are the whole column's.
    const all = b.keys.map((_k, c) => b.lanes.flatMap((lane) => lane.cols[c].threads));
    if (this.reveal && this.at && atCard(b, this.at)) {
      this.laneScroll.scroll_to_item(this.at.l + 1); // after the heads' row
      this.reveal = false;
    }
    const lane = (ln, l) => {
      const body = collapse(this.m, `kk-fold-${ln.key}`, ln.open, () => h_flex().gap(4).items_start().children(ln.cols.map((col) =>
        v_flex().w(w).flex_none().min_h(44).p(6).gap(6).rounded(12).border(1).border_color(t.border).bg(t.chrome)
          .children(col.threads.map((th) => enter(this.m, div().w_full().child(this.card(t, th, col.key, th.id === cur && this.at?.l === l, false, now, cx)),
            `kk-in-${ln.key}-${col.key}-${th.id}`, { dy: 0 }))))), { cx });
      return v_flex().id(`kk-ln-${ln.key}`).w(total).flex_none().gap(4).pt(6)
        .child(h_flex().id(`kk-lh-${ln.key}`).h(30).px(8).gap(8).items_center().rounded(10).cursor_pointer()
          .hover((s) => s.bg(t.hover))
          .on_click((_e, cx) => {
            if (this.folded.has(ln.key)) this.folded.delete(ln.key);
            else this.folded.add(ln.key);
            cx.notify();
          })
          .child(svg(I(ln.open ? "chevron-down" : "chevron-right")).size(12).flex_none().text_color(t.dim))
          .child(this.mark(t, ln.project, 14))
          .child(div().flex_none().max_w(260).truncate().font_family(MONO).text_size(10.5).text_color(t.muted).child(String(ln.project?.name ?? "").toUpperCase()))
          .child(roll(this.m, `kk-ln-n-${ln.key}`, String(ln.count), 14).font_family(MONO).text_size(10.5).text_color(t.dim)))
        .when(Boolean(body), (el) => el.child(body));
    };
    return v_flex().id("kk-lanes").flex_1().min_w(0).h_full().overflow_scrollbar().track_scroll(this.laneScroll)
      .on_size_change((size, cx) => {
        if (Math.abs((this.lanesW ?? 0) - size.width) < 0.5) return;
        this.lanesW = size.width;
        cx.notify();
      })
      .child(h_flex().w(total).flex_none().gap(4).children(b.keys.map((k, c) =>
        v_flex().w(w).flex_none().rounded(12).border(1).border_color(t.border).bg(t.chrome).child(this.colHead(t, k, all[c])))))
      .children(b.lanes.map(lane))
      .when(!b.lanes.length, (el) => el.child(div().p(12).text_size(12.5).text_color(t.dim).child(tr("noMatch"))));
  }

  // The drawer's content, DRAWER_W wide: its head over the dither of the card's project (the agent's live
  // logo, the title coming into focus, project · branch or worktree · age, a close), then its sections:
  // the flow in kt-flow's tiers (viz.js steps by phase), the issue, the PR with its checks in dither steps
  // (kt-inbox's), the diff against the base, the cost, context and sub-agents, then its actions, each with
  // its key. It fades in at each card it shows (its id carries the thread).
  drawerPanel(t, th, now, cx) {
    const d = this.details[th.id] ?? {};
    const V = viz(t, this.m, { roll });
    const key = th.id;
    const mono = (color, text) => div().flex_none().font_family(MONO).text_size(11).text_color(color).child(text);
    const eyebrow = (text) => div().font_family(MONO).text_size(10).text_color(t.muted).child(String(text).toUpperCase());
    const dim = (text) => div().text_size(12).line_height("18px").text_color(t.dim).child(text);
    const section = (title, ...kids) => v_flex().gap(8).child(eyebrow(title)).children(kids.filter(Boolean));
    const tag = (color, text) => h_flex().flex_none().h(18).px(7).items_center().rounded_full().border(1).border_color(alpha(color, "4d"))
      .bg(alpha(color, "1a")).font_family(MONO).text_size(9.5).text_color(color).child(String(text).toUpperCase());
    const loading = d.loading && !d.at;
    const bridge = th.terminal ? this.shownLive[th.terminal] : null;
    const tint = th.project.home ? t.muted : paint(t, th.project.color) ?? t.accent;
    // The head (DESIGN-REFERENCE.md: a detail pane's band), 64 px.
    const head = div().relative().flex_none().h(64).overflow_hidden().rounded_t(15)
      .child(ditherBand(DRAWER_W - 2, 64, 15, alpha(tint, settings().dark ? "6b" : "4d"), TOP))
      .child(h_flex().size_full().px(12).gap(10).items_center()
        .child(h_flex().size(36).flex_none().rounded(10).items_center().justify_center().border(1).border_color(alpha(tint, "4d")).bg(alpha(t.background, "e6"))
          .child(companion({ program: th.program, state: th.agent?.status ?? th.status ?? "idle", id: `kk-dr-c-${key}`, cx, size: 24, height: 20,
            action: bridge?.state ? (bridge.action ?? null) : undefined, since: bridge?.state ? bridge.since : undefined,
            memo: (this.memos[`drawer:${th.terminal ?? key}`] ??= {}) })))
        .child(v_flex().flex_1().min_w(0).gap(3)
          .child(sharpen(this.m, `kk-dr-title:${key}`, () => div().truncate().text_size(14).font_semibold().text_color(t.foreground).child(th.title)))
          .child(h_flex().min_w(0).gap(6).items_center()
            .child(this.mark(t, th.project, 12))
            .child(div().flex_none().max_w(110).truncate().font_family(MONO).text_size(10.5).text_color(t.muted).child(th.project.name.toUpperCase()))
            .when(Boolean(th.branch), (el) => el
              .child(svg(I(th.worktree ? "folder-tree" : "git-branch")).size(11).flex_none().text_color(t.dim))
              .child(div().flex_1().min_w(0).truncate().font_family(MONO).text_size(10.5).text_color(t.dim).child(th.branch)))
            .child(mono(t.dim, model.age(th.activity, now).toUpperCase()))))
        .child(h_flex().id("kk-dr-close").size(26).flex_none().items_center().justify_center().rounded_full().text_color(t.dim)
          .cursor_pointer().hover((s) => s.bg(t.hover).text_color(t.foreground)).tooltip(tr("drawer.close"))
          .on_click((_e, cx) => { this.closeDrawer(cx); cx.notify(); })
          .child(svg(I("x")).size(13))));
    // The flow: claude-flow's whole timeline, a tier per phase (kt-flow's colours).
    const steps = (bridge?.flow?.steps ?? []).filter((s) => s?.id);
    const failed = settings().dark !== false ? t.ansi9 : t.ansi1;
    const flow = steps.length
      ? V.steps(phasesOf(steps).flatMap((p) => p.steps.map((s) => ({ label: nameOf(s.id), state: s.state, group: p.label }))),
        { id: `kk-dr-flow-${key}`, width: DRAWER_W - 30, colors: { done: t.done, current: t.accent, failed } })
      : dim(tr("drawer.noFlow"));
    // The issue and the PR: their number, title and state (gh's words); the PR's checks in dither steps.
    const issue = th.issue && (d.issue
      ? h_flex().gap(7).items_center().child(svg(I(d.issue.state === "CLOSED" ? "circle-check" : "circle-dashed")).size(13).flex_none().text_color(d.issue.state === "CLOSED" ? t.ansi5 : t.ansi2))
        .child(mono(t.muted, `#${th.issue}`)).child(div().flex_1().min_w(0).truncate().text_size(12.5).text_color(t.foreground).child(d.issue.title))
        .child(tag(d.issue.state === "CLOSED" ? t.ansi5 : t.ansi2, d.issue.state === "CLOSED" ? "closed" : "open")) // i18n: tech
      : h_flex().gap(7).items_center().child(mono(t.muted, `#${th.issue}`)).child(dim(loading ? tr("drawer.reading") : tr("drawer.unread"))));
    const pr = d.pr ?? (th.pr ? { ...th.pr, title: null, checks: null } : null);
    const prLook = !pr ? null : pr.state === "OPEN" && pr.draft ? ["git-pull-request", t.dim, "draft"] : pr.state === "MERGED" ? ["git-merge", t.ansi5, "merged"]
      : pr.state === "CLOSED" ? ["git-pull-request-closed", t.ansi1, "closed"] : ["git-pull-request", t.ansi2, "open"]; // i18n: tech
    const checks = pr?.checks ? checkSteps(pr.checks) : null;
    const prBlock = pr && v_flex().gap(8)
      .child(h_flex().gap(7).items_center().child(svg(I(prLook[0])).size(13).flex_none().text_color(prLook[1]))
        .child(mono(prLook[1], `#${pr.number}`)).child(div().flex_1().min_w(0).truncate().text_size(12.5).text_color(pr.title ? t.foreground : t.dim).child(pr.title ?? (loading ? tr("drawer.reading") : "")))
        .child(tag(prLook[1], prLook[2])))
      .child(checks == null ? dim(loading ? tr("drawer.reading") : tr("drawer.unread"))
        : checks.length ? V.steps(checks, { id: `kk-dr-ck-${key}`, width: DRAWER_W - 30, colors: { done: t.done, current: t.ansi3, failed: t.ansi1 },
          words: { done: tr("ck.done"), current: tr("ck.current"), failed: tr("ck.failed"), skipped: tr("ck.skipped") } })
          : dim(tr("drawer.noChecks")));
    // The diff against the base: its files, +N −M.
    const diff = d.diff
      ? h_flex().gap(10).items_center().child(div().text_size(12.5).text_color(t.foreground).child(tr("drawer.files", { n: d.diff.files })))
        .child(mono(t.ansi2, `+${d.diff.added}`)).child(mono(t.ansi1, `−${d.diff.removed}`))
      : dim(d.diffAt ? tr("drawer.noDiff") : tr("drawer.reading"));
    // Cost, context, sub-agents (k ended / n, the ones still shown).
    const subs = th.subagents;
    const figures = h_flex().flex_wrap().gap_x(14).gap_y(6).items_center()
      .when(th.cost != null, (el) => el.child(mono(levelColor(t, costLevel(th.cost, th.model), { okGreen: true }), `$${fnum(th.cost, 2)}`)))
      .when(th.ctx != null, (el) => el.child(mono(levelColor(t, ctxLevel(th.ctx, th.sl?.window)), tr("drawer.ctx", { n: Math.round(th.ctx) }))))
      .when(subs.total > 0, (el) => el.child(h_flex().gap(4).items_center().text_color(t.dim).child(svg(I("bot")).size(12)).child(mono(t.dim, `${subs.done}/${subs.total}`))));
    const agents = subs.shown.slice(0, 4).map((a, i) => h_flex().id(`kk-dr-sa-${key}-${a.id ?? i}`).h(20).gap(8).items_center()
      .child(div().size(6).rounded(3).flex_none().bg(model.isAlive(a) ? t.working : a.state === "error" ? t.ansi1 : t.dim))
      .child(div().flex_1().min_w(0).truncate().text_size(12).text_color(model.isAlive(a) ? t.foreground : t.muted).child(a.what || a.name || "agent")) // i18n: tech
      .child(mono(t.dim, model.agentAge(a, now))));
    // The actions, each with its key (in the drawer): enter, p, z (1 2 3, 0), O, I, e.
    const pinned = th.pinned;
    const button = (id, label, k, onClick, on = true) => h_flex().id(`kk-dr-${id}`).flex_none().h(28).px(10).gap(8).items_center().rounded_full().border(1)
      .border_color(t.border).bg(t.background).text_size(12).text_color(on ? t.foreground : t.dim)
      .when(on, (el) => el.cursor_pointer().hover((s) => s.bg(t.hover)).on_click((_e, cx) => { onClick(); cx.notify(); }))
      .child(label).child(div().flex_none().px(5).rounded(4).bg(t.raised).font_family(MONO).text_size(9.5).text_color(t.muted).child(k));
    const zedHere = Boolean(th.cwd) && !th.space.machine;
    const actions = v_flex().gap(8)
      .child(h_flex().flex_wrap().gap(6)
        .child(button("go", tr("drawer.go"), "↵", () => this.open(th)))
        .child(button("pin", pinned ? tr("drawer.unpin") : tr("drawer.pin"), "p", () => this.pin(th)))
        .child(button("snooze", th.asleep ? tr("drawer.snoozed", { left: model.until(th.snooze.until, now) }) : tr("drawer.snooze"), "z", () => { this.snoozing = !this.snoozing; }))
        .child(button("pr", tr("drawer.openPr"), "O", () => this.browse(d.pr?.url ?? th.pr?.url), Boolean(d.pr?.url ?? th.pr?.url)))
        .child(button("issue", tr("drawer.openIssue"), "I", () => this.browse(d.issue?.url), Boolean(d.issue?.url)))
        .child(button("zed", tr("drawer.zed"), "e", () => this.zed(th), zedHere)))
      .when(this.snoozing, (el) => el.child(h_flex().flex_wrap().gap(6)
        .children(SNOOZES.map((c, i) => button(`sn-${c}`, tr(`snooze.${c}`), String(i + 1), () => this.snooze(th, c))))
        .when(th.asleep, (el) => el.child(button("wake", tr("snooze.wake"), "0", () => this.snooze(th, null))))));
    const body = v_flex().id(`kk-dr-body-${key}`).flex_1().min_h(0).overflow_y_scrollbar().p(14).gap(18)
      .child(section(tr("drawer.flow"), flow))
      .when(Boolean(issue), (el) => el.child(section("Issue", issue))) // i18n: tech
      .when(Boolean(prBlock), (el) => el.child(section("Pull request", prBlock))) // i18n: tech
      .when(Boolean(th.branch), (el) => el.child(section("Diff", diff))) // i18n: tech
      .child(section(tr("drawer.figures"), figures, ...agents))
      .child(section(tr("drawer.actions"), actions));
    return enter(this.m, v_flex().w(DRAWER_W).h_full().rounded(16).border(1).border_color(t.border).bg(t.background)
      .child(head).child(div().flex_none().h(0).border_t(1).border_dashed().border_color(alpha(tint, "4d"))).child(body), `kk-dr-${key}`, { dy: 0 });
  }

  // Slice by: the panel on the left, its field's values with their counts, « Tout » first; a click picks
  // one (again: lets it go). Its field: the header's button (s), its close button sets it back to none.
  slicePanel(t, field, values, total) {
    const icon = (v) => {
      if (field === "project") return this.mark(t, v.project, 12);
      const p = v.program;
      if (!p?.icon) return div().size(8).mx(2).rounded(4).flex_none().bg(v.key === "none" ? t.dim : t.muted);
      return (p.tint ? svg(p.icon).text_color(t.muted) : image(p.icon)).size(12).flex_none().rounded(3);
    };
    const name = (v) => v.name ?? (v.key === "none" && field === "program" ? tr("slice.noAgent") : tr("slice.gone"));
    const row = (v, on) => h_flex().id(`kk-sl-${v.key ?? "*"}`).h(28).px(8).gap(8).items_center().rounded(8).border(1)
      .border_color(on ? alpha(t.accent, "66") : alpha(t.accent, "00")).when(on, (el) => el.bg(alpha(t.accent, "24")))
      .when(!on, (el) => el.hover((s) => s.bg(t.hover)))
      .text_color(on ? t.foreground : t.muted).cursor_pointer()
      .on_click((_e, cx) => { this.pickSlice(field, on || v.key == null ? null : v.key); cx.notify(); })
      .child(v.key == null ? svg(I("layers")).size(12).flex_none() : icon(v))
      .child(div().flex_1().min_w(0).truncate().text_size(12.5).child(v.key == null ? tr("slice.all") : name(v)))
      .child(div().flex_none().font_family(MONO).text_size(10.5).text_color(t.dim).child(String(v.count)));
    return v_flex().id("kk-slice").w(196).flex_none().h_full().rounded(16).border(1).border_color(t.border).bg(t.chrome)
      .child(h_flex().flex_none().h(40).pl(14).pr(8).gap(8).items_center()
        .child(div().flex_1().min_w(0).truncate().font_family(MONO).text_size(10.5).text_color(t.muted).child(tr(`slice.${field}`).toUpperCase()))
        .child(div().id("kk-slice-close").flex_none().p(4).rounded(6).text_color(t.dim).cursor_pointer()
          .hover((s) => s.bg(t.hover).text_color(t.foreground)).tooltip(tr("slice.close"))
          .on_click((_e, cx) => { setShared(OPT_SHARED.slice, null); cx.notify(); })
          .child(svg(I("x")).size(12))))
      .child(div().flex_none().h(0).border_t(1).border_dashed().border_color(t.border))
      .child(v_flex().id("kk-slice-list").flex_1().min_h(0).overflow_y_scrollbar().p(6).gap(2)
        .child(row({ key: null, count: total }, this.pick == null))
        .children(values.map((v) => row(v, v.key === this.pick))));
  }

  render(cx) {
    const vis = visible();
    this.findRepos(cx);
    const t = theme();
    const m = (this.m = frame(this.motion, Boolean(shared("kt.reducedMotion"))));
    // What others change (DATA-SYNC.md): a commit, a branch, a PR made elsewhere, an agent that just
    // stopped (kt-threads' `agents`) asks the PR badges again. The first render records.
    // The drawer's PR, issue and diff too.
    if (!checking()) refreshOn(this, cx, "prs", ["git", "gh", "agents"], async (cx) => {
      this.asked = {};
      if (this.drawer) this.loadDetail(cx, true);
      cx.notify();
    });
    if (vis && !this.shown) {
      this.arrivals++;
      if (!checking()) {
        // Back on the page: what moved while it was hidden, if read over 10 s ago.
        if (Date.now() - this.readAt > STALE) this.refresh(cx);
        // The thread's terminal is hidden under the page: the keyboard comes here, in NORMAL, once the
        // app has settled its own focus on the switch (unless pane.go already gave it).
        cx.timer.after(150, (cx) => {
          if (visible() && !this.handle.is_focused()) this.focusIn();
          cx.notify();
        });
      }
    }
    this.shown = vis;

    const now = Date.now();
    const world = this.world(now);
    this.shownLive = world.live; // what the cards and the drawer read of the agents (this.live, as read)
    const o = opts();
    // Every project's threads (threads-model.js): the views decide, not the sidebar's scope or filter
    // (GitHub Projects: a view stands alone); the archived only for an is:archived. Then `/`'s query
    // (kanban.js parseQuery: words and field:value terms; project:@current is the shown space's
    // project), then the slice picked.
    const shown = world.spaces.find((s) => s.active);
    const query = parseQuery(this.query);
    const all = model.threadsOf(world);
    // Every thread by id: the drawer's (it may be out of the board's filter), the keys' actions on it.
    this.byId = new Map(all.map((th) => [th.id, th]));
    if (this.drawer && !this.byId.has(this.drawer)) this.drawer = this.drawerLast = null; // its tab closed
    const listed = onBoard(all, query.archived);
    const current = !shown ? null : model.isHome(shown, world) ? "home" : model.projectId(shown, world) ?? `space:${shown.id}`;
    const kept = listed.filter((th) => matchQuery(th, query, { now, current }));
    const pick = (this.pick = o.slice === "none" ? null : (shared(PICKS) ?? {})[o.slice] ?? null);
    const values = (this.sliceList = o.slice === "none" ? [] : slices(kept, o.slice, pick));
    const onIt = sliced(kept, o.slice, pick);
    if (vis && !checking()) for (const th of onIt) this.wantPr(th);
    const b = (this.board = board(onIt, { field: o.column, group: o.group, sort: o.sort, pins: world.pins, firstSeen: world.firstSeen, registry: world.registry, folded: this.folded }));
    const focused = this.handle.is_focused();
    // The keyboard gone (a terminal clicked, ctrl-b t) while a tab was being renamed: the name stays as it
    // was. Only on that change, so the render right after startRename() doesn't end it before focus lands.
    if (this.renaming && this.keyed && !focused) this.renaming = null;
    this.keyed = focused;
    const typing = focused && this.vim.insert;
    this.at = locate(b, this.cur, this.at);
    this.cur = atCard(b, this.at)?.id ?? null;
    const cur = focused ? this.cur : null;

    // The head: the current view's name and how many threads it shows; the accent, or the shown project's
    // color (Home muted) when the view filters on it (project:@current).
    const home = shown && model.isHome(shown, world);
    const entry = shown && !home ? model.entryOf(shown, world.registry, world) : null;
    const tint = !query.current || !shown ? t.accent : home ? t.muted
      : paint(t, entry?.color) ?? paint(t, model.spaceColorOf(shown, world.colors)) ?? t.accent;
    const view = currentView(viewsOf(shared(VIEWS)));
    const count = onIt.length < listed.length ? tr("shownOf", { n: onIt.length, total: listed.length }) : tr("threads", { n: listed.length });
    const sub = rollText(m, `kk-head-n-${view.id}`, `${this.viewName(view)} · ${count}`, 14).font_family(MONO).text_size(10.5).text_color(t.muted);
    const field = h_flex().id("kk-filter").w(220).flex_none().h(28).px(12).gap(8).items_center().rounded_full().border(1)
      .border_color(typing ? alpha(t.accent, "99") : t.border).bg(typing ? alpha(t.accent, "24") : t.background).cursor_text()
      .on_click((_e, cx) => { this.handle.focus(); this.vim.edit(); cx.notify(); })
      .child(svg(I("search")).size(13).flex_none().text_color(t.dim))
      .child(div().flex_1().min_w(0).truncate().text_size(12.5).text_color(this.query ? t.foreground : t.dim)
        .child(this.query ? this.query + (typing ? "▏" : "") : typing ? "▏" : tr("filter")))
      .when(Boolean(this.query), (el) => el.child(div().id("kk-clear").flex_none().text_color(t.dim).cursor_pointer().hover((s) => s.text_color(t.foreground))
        .on_click((_e, cx) => { cx.stop_propagation(); this.query = ""; cx.notify(); })
        .child(svg(I("x")).size(12))));
    // NORMAL / INSERT (kt-keys' pill), while the page has the keyboard.
    const mode = focused && div().flex_none().h(16).px(6).flex().items_center().rounded(5).border(1)
      .border_color(typing ? alpha(t.accent, "66") : t.border).bg(typing ? alpha(t.accent, "24") : t.background)
      .font_family(MONO).text_size(9).text_color(typing ? t.accent : t.muted).child(this.vim.label);
    // What the query set aside (an unknown field, a value it can't read), said quietly before the field:
    // the rest still filters.
    const ignored = query.issues.map((i) => (i.kind === "field" ? `${i.field}:` : `${i.field}:${i.value}`)).join(" ");
    const notice = ignored && h_flex().id("kk-ignored").flex_none().max_w(260).gap(5).items_center().text_color(t.blocked)
      .tooltip(tr("filter.help"))
      .child(svg(I("circle-alert")).size(12).flex_none())
      .child(div().min_w(0).truncate().font_family(MONO).text_size(10.5).child(tr("filter.ignored", { list: ignored })));
    // The toolbar under the tabs: the four choices, then the filter. One line that scrolls sideways on a
    // narrow page (FILTERS.md).
    const tools = h_flex().id("kk-tools").flex_none().h(44).px(10).gap(6).items_center().overflow_x_scroll()
      .children(["column", "group", "slice", "sort"].map((k) => this.choiceButton(t, k, o[k])))
      .child(div().flex_1().min_w(8))
      .when(Boolean(notice), (el) => el.child(notice))
      .child(field);
    const head = v_flex().flex_none().rounded(16).border(1).border_color(t.border).bg(t.background)
      .child(this.band(t, tint, "Kanban", sub, [mode].filter(Boolean))) // i18n: tech
      .child(div().flex_none().h(0).border_t(1).border_dashed().border_color(alpha(tint, "4d")))
      .child(this.tabs(t))
      .child(div().flex_none().mx(10).h(0).border_t(1).border_dashed().border_color(t.border))
      .child(tools);
    // The board: no group, the columns side by side (scrolling sideways once narrower than their 240 px
    // each; the cursor's column comes into view, its card then in column()); by project, the lanes. The
    // slice panel on its left.
    if (this.reveal && o.group !== "project") this.boardScroll.scroll_to_item(this.at.c);
    const area = o.group === "project"
      ? this.lanes(t, b, cur, now, cx)
      : h_flex().id("kk-board").flex_1().min_w(0).h_full().gap(4).items_start().overflow_x_scroll().track_scroll(this.boardScroll)
        .children((b.lanes[0]?.cols ?? []).map((col, c) => this.column(t, col, c === this.at.c ? cur : null, now, cx)));
    // The drawer on the right: its box opens to DRAWER_W (plus the gap) and folds back to 0 on its width,
    // the board narrowing and widening beside it; its content stays drawn while it folds (closeDrawer's
    // one timer). Reduced motion: at once.
    const dr = this.drawerLast ? this.byId.get(this.drawerLast) : null;
    const drawer = div().id("kk-drawer").flex_none().h_full().overflow_hidden().w(this.drawer && dr ? DRAWER_W + 4 : 0)
      .when(!m.reduced, (el) => el.transition("width", { duration: MS.panel, easing: "ease-out" }))
      .when(Boolean(dr), (el) => el.child(div().pl(4).h_full().child(this.drawerPanel(t, dr, now, cx))));
    const main = h_flex().flex_1().min_h(0).items_start()
      .when(o.slice !== "none", (el) => el.child(this.slicePanel(t, o.slice, values, kept.length).mr(4)))
      .child(area)
      .child(drawer);
    // No frame of its own: the work card around it paints the background. Each arrival fades it in.
    return enter(m, v_flex().size_full().gap(4).text_color(t.foreground).child(head).child(main), `kk-page-${this.arrivals}`, { dy: 0 })
      .track_focus(this.handle)
      .on_key_down((e, cx) => this.key(e, cx));
  }
}
