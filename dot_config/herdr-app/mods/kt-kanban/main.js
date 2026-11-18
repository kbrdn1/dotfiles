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
// A card, what matters first (Kylian, #31: « pas du tout le coût »): the agent's live logo
// (companion-logo.js), the title, pinned / snoozed as the sidebar shows them, the age; then what the
// agent waits on from you when blocked (the sidebar's decisions: decide.js, a copy of kbrdn-toast's;
// else herdr-bridge's pending), else what it does or answered (the sidebar's live line); then
// claude-flow's step; then the PR, its CI as icons and counts, the issue, the sub-agents k/n; last the
// project and the branch. A blocked agent's card has the sidebar's decision pills (decide.js'
// decisionButtons: the same answer as the sidebar's and the toast's). Right-click, or m on the cursor's
// card, opens its menu (kanban.js cardMenu), anchored to it (gpui-base's Popup): those choices first,
// then go, the drawer, pin, snooze, archive, the PR, the issue, Zed, the branch copied, the thread
// closed (kt-confirm); a draft's: launch, edit, delete. j / k move in it, enter runs, esc or q shuts it,
// and an item's key (o p 1 2 3 0 O I e, L i x) runs it. The board's look (#34), the view's like its
// limits: a column's width (auto, or 200 to 420 px: < / > on the cursor's column, = back to auto, or its
// head's selector), its columns hidden (the head's selector; a reminder at the board's end shows them
// again, with their counts), the cards' density (D, the header's fifth button: normal, compact, the
// title and status only, or detailed). A card the pointer rests on, or the keys' cursor, unfolds its
// session as the sidebar's focus card shows it (#38: model · effort, context and quota rings, cost, run
// time, lines, the cache's TTL and hit; compact: everything), always shown in detailed. The filter
// (#35): typing a token completes its field, then its values (the board's projects, agents, branches;
// kt-new's keys); its terms show as chips under the toolbar (a click, or F then x, removes one; one set
// aside in the warning color); a card's agent, PR, project, branch or a column's name clicked adds its
// term (alt: negated), f the cursor's card's « filter by… ». The cost is the drawer's (and, with the columnCost option, off by default, the
// column heads'). It lists every project's threads, whatever the sidebar's scope or filter: its
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
import { v_flex, h_flex, ScrollHandle, Popup } from "gpui-base";
import { spaces, panes, run, theme, shared, setShared, layout, nextCommand, settings, exec, home, readTextFile, openOverlay, checking, notify, window as win } from "herdr";
import * as fs from "fs/promises";
import * as model from "./threads-model.js";
import * as io from "./threads-io.js";
import { longLived } from "./pr-pick.js";
import { OPTIONS, COLUMN_KEYS, DEFAULT_VIEWS, choice, nextChoice, board, slices, sliced, onBoard, locate, move, atCard, parseQuery, matchQuery,
  costOf, stepLimit, viewsOf, currentView, dirty, saveView, addView, duplicateView, renameView, deleteView, stepView, checkSteps, SNOOZES, wakeAt,
  FIELDS, draftThread, draftsOf, attach, archivePlan, ciCount, cardMenu, menuStart, takesFocus, sessionOf, ttlText, termText, chipsOf, dropToken, addTerm, filterValues, completions, cardTerms, WIDTH, stepWidth, laneWidths, toggleHidden } from "./kanban.js";
// The sidebar's decisions (a byte-identical copy of kbrdn-toast's decide.js): what a blocked agent waits
// on, its pills, and its answer (press, the sidebar's and the toast's path).
import { decide, decisionButtons, press as answer } from "./decide.js";
import { companion } from "./companion-logo.js";
// kt-keys' viz.js (a byte-identical copy, with viz.strings.js): the drawer's dither steps (flow, checks).
import { viz } from "./viz.js";
import { costLevel, ctxLevel, levelColor } from "./levels.js";
import { Vim, keysOf, keyOf } from "./vim.js";
import { motionState, frame, enter, sharpen, rows, collapse, sheet, leave, leaving, MS } from "./motion.js";
import { roll, rollText } from "./roll.js";
// kt-threads' ring.js (a byte-identical copy, with ring.strings.js; levels.js its colours): a card's session.
import { ring, ctxTokens } from "./ring.js";
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
const COL_W = WIDTH.auto; // an auto column's least width: a card stays readable
const DRAWER_W = 360; // the drawer's width (the board narrows beside it)
// A column's color, a theme name: the status' own; a phase's along the way (delivery green, wrap-up done).
const TINT = {
  blocked: "blocked", done: "done", working: "working", idle: "idle",
  prep: "ansi4", spec: "ansi5", impl: "working", ship: "ansi2", close: "done", other: "dim", none: "idle",
};
// The header's buttons, their keys and icons; mod.json declares the options (MOD-OPTIONS.md).
const OPT_KEYS = { c: "column", b: "group", s: "slice", t: "sort", D: "density" };
const OPT_SHARED = { column: "kt.opt.kt-kanban.column", group: "kt.opt.kt-kanban.group", slice: "kt.opt.kt-kanban.slice", sort: "kt.opt.kt-kanban.sort", density: "kt.opt.kt-kanban.density" };
const OPT_ICON = { column: K("columns-3"), group: K("rows-3"), slice: I("panel-left"), sort: K("arrow-down-wide-narrow"), density: I("layout-list") };
const KEY_OF = { column: "c", group: "b", slice: "s", sort: "t", density: "D" };
const PICKS = "kt.kanban.slicePick"; // { project: key | null, program: key | null }
const VIEWS = "kt.kanban.views"; // { current, list }: the saved views (kanban.js viewsOf)
const DRAFTS = "kt.kanban.drafts"; // [{ id, title, task, space, project, at }]: the draft cards (kanban.js draftsOf)
const LAUNCHED = "kt.kanban.launched"; // kt-new's record of a draft launched: { draft, tab, space, folder, machine, at }
const ARCHIVE_EVERY = 600e3; // auto-archive looks every 10 minutes (and on arrival)
const AUTO_ARCHIVED = "kt.kanban.autoArchived"; // { since, done: { tab id: when } }: auto-archive's memo (archivePlan)
const WAIT = 600; // vim.js' time between the two keys of gt / gT
const HOVER_IN = 200; // #38: the pointer resting on a card this long unfolds it (passing over doesn't)
const HOVER_OUT = 150; // and it folds back this long after the pointer left (the sidebar's linger)
// #35: a filter chip's color, by its field (a word: muted; set aside: the warning color).
const FIELD_TINT = { status: "accent", phase: "ansi5", project: "ansi4", agent: "ansi6", branch: "ansi2", pr: "ansi2", is: "ansi3", cost: "ansi3", age: "ansi3" }; // i18n: tech
const FIELD_ICON = { project: "folder", agent: "bot", branch: "git-branch", pr: "git-pull-request", status: "circle-dashed", phase: "workflow", is: "square-pen" };
const COMP_ROWS = 8; // the completion's rows shown (it scrolls past them; the Popup keeps clear of the window's edges)
const toks = (n) => (n < 1000 ? String(n) : n < 1e6 ? `${Math.floor(n / 1000)}k` : `${(n / 1e6).toFixed(1)}M`); // the sidebar's

// The board's choices as stored (the key strings in full: kt-mods finds who reads them by a grep).
function opts() {
  return {
    column: choice("column", shared("kt.opt.kt-kanban.column")),
    group: choice("group", shared("kt.opt.kt-kanban.group")),
    slice: choice("slice", shared("kt.opt.kt-kanban.slice")),
    sort: choice("sort", shared("kt.opt.kt-kanban.sort")),
    density: choice("density", shared("kt.opt.kt-kanban.density")),
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
    this.widths = { ...saved.widths }; // column key -> its width set (none: auto)
    this.shownW = {}; // column key -> the width it is drawn at (an auto column's < / > start there)
    this.hidden = [...saved.hidden]; // the column keys hidden
    this.renaming = null; // the view whose tab is a field (its name being typed: this.draft)
    this.draft = "";
    this.viewMenu = false; // the current view's actions shown in the tab row
    this.limitEdit = null; // the column whose head shows its limit's stepper
    this.pending = null; // what kt-confirm asks about deleting: { kind: "view" | "draft", id }
    this.editing = null; // a draft being typed in its drawer: { id, field: "title" | "task", title, task }
    // The drawer (a card's side panel): the thread it shows (null: shut), the last one (drawn while it
    // closes), whether its snooze choices show; its PR, issue and diff by thread id ({ at, pr, issue,
    // diff, diffAt, loading }), read when it opens.
    this.drawer = null;
    this.drawerLast = null;
    this.snoozing = false;
    this.details = {};
    this.decisions = {}; // a blocked agent's terminal -> decide.js' { pending, … } (readDecisions)
    this.menu = null; // a card's menu: { id (its thread), key (the item under the keys' cursor), anim (its motion id), kind ("card" | "filter": f) }
    // #35, the filter: its completion's highlighted row and scroll, the text esc closed it on; the chip
    // under the keys' cursor (F), else null.
    this.compAt = 0;
    this.compScroll = ScrollHandle.new();
    this.compShut = null;
    this.chipAt = null;
    this.menus = 0;
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
    // #38: the card under the pointer (unfolded, hovering()), the one it just left (folding back soon),
    // the one it rests on (not yet: HOVER_IN).
    this.hover = null;
    this.keep = null;
    this.entering = null;
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
    cx.timer.every(1500, (cx) => {
      if (!visible()) return;
      this.lookup(cx);
      this.readDecisions(cx);
    });
    // Auto-archive: only while the page shows (autoArchive returns at once otherwise), gently.
    cx.timer.every(ARCHIVE_EVERY, () => this.autoArchive());
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
        // kt-confirm's yes on deleting a view or a draft (command `kt-kanban.confirmed`, this copy shows
        // behind it).
        else if (c === "confirmed" && this.pending) {
          const { kind, id } = this.pending;
          this.pending = null;
          if (kind === "draft") {
            setShared(DRAFTS, (shared(DRAFTS) ?? []).filter((d) => d.id !== id));
            if (this.drawer === id) this.closeDrawer(cx);
          } else {
            const views = deleteView(viewsOf(shared(VIEWS)), id);
            this.setViews(views);
            this.applyView(currentView(views));
          }
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

  // What each blocked agent waits on (decide.js, as kt-threads reads it: a permission herdr-bridge
  // publishes, a held message or a question read on its screen), while the page shows; redraws only
  // when what waits changed.
  readDecisions(cx) {
    if (this.readingDecisions) return;
    this.readingDecisions = true;
    cx.spawn(async (cx) => {
      const next = {};
      for (const p of panes()) {
        if (!p.terminal || p.terminal.includes("/") || !p.program?.agent || p.status !== "blocked") continue;
        next[p.terminal] = await decide(p.terminal).catch(() => null);
      }
      this.readingDecisions = false;
      const key = JSON.stringify(Object.entries(next).map(([k, d]) => [k, d?.pending]));
      if (key !== this.decisionsKey) { this.decisionsKey = key; this.decisions = next; cx.notify(); }
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
        this.menu = null; // a card's menu doesn't wait for the page to come back
        this.hover = this.keep = this.entering = null; // nor a card unfolded under the pointer (#38)
        this.chipAt = null; // nor the filter's chip cursor (#35)
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

  // What shows, as a view's settings: the choices, the slice picked, the filter, the limits, the widths,
  // the hidden columns.
  shownView() {
    const o = opts();
    return { ...o, pick: o.slice === "none" ? null : (shared(PICKS) ?? {})[o.slice] ?? null, filter: this.query, limits: this.limits,
      widths: this.widths, hidden: this.hidden };
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
    this.widths = { ...v.widths };
    this.hidden = [...v.hidden];
    this.chipAt = null;
    this.compShut = null;
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
    this.pending = { kind: "view", id: v.id };
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
    // A draft being typed in its drawer takes them too: tab the other field, enter the consigne (from the
    // title) or a new line (in it), esc or cmd+enter done (kept).
    const ed = this.editing;
    if (ed) {
      if (name === "escape" || name === "cmd-enter" || name === "ctrl-enter") this.commitEdit();
      else if (name === "tab" || name === "shift-tab") ed.field = ed.field === "title" ? "task" : "title";
      else if (name === "enter") { if (ed.field === "title") ed.field = "task"; else ed.task += "\n"; }
      else if (name === "backspace") ed[ed.field] = ed[ed.field].slice(0, -1);
      else if (char && !/^(ctrl|cmd)-/.test(name)) { if (ed.field === "task" || ed.title.length < 120) ed[ed.field] += char; }
      else return false;
      return true;
    }
    // A card's menu takes the keys while it shows (not while it leaves): j / k (↓ / ↑) move, enter runs,
    // esc / q shut it, an item's key (cardMenu's hint) runs that item; ctrl / cmd go on, the rest stops here.
    const menu = this.menu && !leaving(this.motion, this.menu.anim) ? this.menu : null;
    if (menu) {
      const th = this.byId?.get(menu.id);
      const list = th ? this.menuItems(th) : [];
      const i = Math.max(0, list.findIndex((it) => it.key === menu.key));
      if (["j", "down", "k", "up"].includes(name)) menu.key = list[(i + (name === "j" || name === "down" ? 1 : list.length - 1)) % list.length]?.key ?? null;
      // The filter's menu (f): - or alt-enter adds the term negated (keyOf names alt-enter « enter »).
      else if (name === "enter") this.runItem(th, list[i], cx, menu.kind === "filter" && Boolean(typeof e === "object" && e?.modifiers?.alt));
      else if (menu.kind === "filter" && name === "-") this.runItem(th, list[i], cx, true);
      else if (name === "escape" || name === "q") this.closeMenu(cx);
      else if (list.some((it) => it.hint === name)) this.runItem(th, list.find((it) => it.hint === name), cx);
      else if (/^(ctrl|cmd)-/.test(name)) return false;
      return true;
    }
    // #35, the filter's chips under the keys' cursor (F): h / l (← / →) move, x or backspace removes the
    // term, esc, q, F or enter leave them, / leaves them for the filter; the rest stops here.
    if (this.chipAt != null) {
      const list = chipsOf(this.query);
      if (name === "h" || name === "left") this.chipAt = Math.max(0, this.chipAt - 1);
      else if (name === "l" || name === "right") this.chipAt = Math.min(list.length - 1, this.chipAt + 1);
      else if (name === "x" || name === "backspace") {
        const c = list[this.chipAt];
        if (c) this.query = dropToken(this.query, c.i);
        this.chipAt = list.length > 1 ? Math.min(this.chipAt, list.length - 2) : null;
      } else if (["escape", "q", "F", "enter"].includes(name)) this.chipAt = null;
      else if (name === "/") {
        this.chipAt = null;
        return this.act(this.vim.handle(e), cx);
      } else if (/^(ctrl|cmd)-/.test(name)) return false;
      return true;
    }
    // The filter's completion, while typing (it takes ↓ ↑, ctrl-n / p / j / k, shift-tab, tab, enter and
    // esc before vim's INSERT: kt-new's list): tab or enter takes the row, esc closes the list (once more:
    // NORMAL).
    const comp = this.vim.insert ? this.compOf() : [];
    if (comp.length) {
      const k = comp.length;
      const by = ["down", "ctrl-n", "ctrl-j"].includes(name) ? 1 : ["up", "ctrl-p", "ctrl-k", "shift-tab"].includes(name) ? -1 : 0;
      if (by) {
        this.compAt = (Math.min(this.compAt, k - 1) + by + k) % k;
        this.compScroll.scroll_to_item(this.compAt);
        return true;
      }
      if (name === "tab" || name === "enter") {
        this.query = comp[Math.min(this.compAt, k - 1)].query;
        this.compAt = 0;
        return true;
      }
      if (name === "escape") {
        this.compShut = this.query;
        return true;
      }
    }
    if (this.vim.insert) return this.act(this.vim.handle(e), cx);
    // m: the cursor's card's menu; f: its « filter by… » (kanban.js cardTerms).
    if (name === "m" || name === "f") {
      const th = atCard(this.board, this.at ?? { l: 0, c: 0, i: -1 });
      this.vim.normal();
      if (th) this.openMenu(th, cx, name === "f" ? "filter" : "card");
      return true;
    }
    // F: the filter's chips under the keys' cursor (the last one first).
    if (name === "F") {
      this.vim.normal();
      const n = chipsOf(this.query).length;
      if (n) this.chipAt = n - 1;
      return true;
    }
    // n: a new draft (its drawer opens, its title typed at once).
    if (name === "n") {
      this.vim.normal();
      this.newDraft(cx);
      return true;
    }
    // The draft in the drawer, else under the cursor: i types it, L launches it (kt-new).
    const draft = [this.drawer && this.byId?.get(this.drawer), atCard(this.board, this.at ?? { l: 0, c: 0, i: -1 })].find((x) => x?.draft);
    if (draft && (name === "i" || name === "L")) {
      this.vim.normal();
      if (name === "i") {
        if (this.drawer !== draft.id) this.openDrawer(draft.id, cx);
        this.startEdit(draft, "title");
      } else this.launch(draft);
      return true;
    }
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
      const n = this.board.lanes.reduce((s, lane) => s + (lane.cols[this.at?.c ?? 0]?.threads.filter((x) => !x.draft).length ?? 0), 0);
      if (key) this.limits = stepLimit(this.limits, key, name === "+" ? 1 : -1, n);
      return true;
    }
    // < / > the cursor's column narrower / wider, = back to auto (the view's, as its limit).
    if (name === "<" || name === ">" || name === "=") {
      this.vim.normal();
      const key = this.board.keys[this.at?.c ?? 0];
      if (key) this.widths = stepWidth(this.widths, key, name === "<" ? -1 : name === ">" ? 1 : 0, this.shownW);
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
    if (th && !th.draft) {
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

  // Its thread's (or `id`'s: a card's menu wants its PR's and issue's addresses) PR (with its checks) and issue from gh, at most every PR_EVERY (as the badges) unless
  // forced (r, a gh bump); its diff against its base (the PR's, else the repo's default) each time, a
  // remote one only with the gh reads. Never in a check.
  loadDetail(cx, force = false, id = this.drawer) {
    const th = this.byId?.get(id);
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

  // ---------- the filter, refined (#35: kanban.js chipsOf, completions, addTerm) ----------

  // Entering it (`/`, a click): a space after what it holds (trimmed in the view: no dot), the chip cursor gone.
  editFilter() {
    if (this.query && !/\s$/.test(this.query)) this.query += " ";
    this.chipAt = null;
    this.compAt = 0;
  }

  // The completion for what is typed: only a token being typed (nothing on an empty one, nor after a
  // space), and not once esc closed it on this very text.
  compOf() {
    const q = this.query;
    return /\S$/.test(q) && q !== this.compShut ? completions(q, this.values ?? {}) : [];
  }

  // A card's value clicked (alt: negated), or f's choice: its term in the filter.
  addFilter(field, value, neg = false) {
    this.query = addTerm(this.query, field, value, neg);
    this.reveal = true;
  }

  // ---------- a card's menu (kanban.js cardMenu; anchored to the card: withMenu) ----------

  // Right-click or m: the card takes the cursor and the keyboard, its PR and issue are read (their items);
  // the highlight on « go » (menuStart: never on a choice, enter can't accept by accident). `kind`
  // "filter" (f, #35): its values to filter by instead, nothing read.
  openMenu(th, cx, kind = "card") {
    if (this.editing) this.commitEdit();
    this.vim.normal();
    this.handle.focus();
    this.cur = th.id;
    this.chipAt = null;
    this.menu = { id: th.id, key: menuStart(this.menuItems(th, kind)), anim: `km-${++this.menus}`, kind };
    if (!th.draft && kind === "card") this.loadDetail(cx, false, th.id);
  }

  // motion.js leave(): it fades and sinks 6 px, then goes (unless another opened meanwhile).
  closeMenu(cx) {
    const was = this.menu;
    if (!was) return;
    leave(this.motion, cx, was.anim, (cx) => {
      this.motion.out?.delete(was.anim);
      if (this.menu?.anim === was.anim) this.menu = null;
      cx.notify();
    });
  }

  menuItems(th, kind = this.menu?.kind) {
    if (kind === "filter") return cardTerms(th).map((x) => ({ key: `filter:${x.field}`, field: x.field, value: x.value }));
    const d = this.details[th.id] ?? {};
    return cardMenu(th, { decision: this.decisions[th.terminal], prUrl: d.pr?.url ?? th.pr?.url, issueUrl: d.issue?.url });
  }

  // One item run, then the menu leaves. A decision goes by decide.js' press (the sidebar's and the
  // toast's answer: the decision file herdr-bridge's plugin reads, or the held dialog's keys); closing
  // the thread asks kt-confirm (it says what stops); archiving is the sidebar's (nothing closes).
  runItem(th, it, cx, neg = false) {
    if (!th || !it) return;
    const [kind, arg] = it.key.split(":");
    const d = this.details[th.id] ?? {};
    const go = {
      filter: () => this.addFilter(it.field, it.value, neg), // f's (#35): `neg` with - or alt
      decide: () => {
        const dd = this.decisions[th.terminal];
        if (dd) cx.spawn(async (cx) => this.decided(await answer(dd, arg), cx));
      },
      go: () => this.open(th),
      drawer: () => this.openDrawer(th.id, cx),
      pin: () => this.pin(th),
      unpin: () => this.pin(th),
      snooze: () => this.snooze(th, arg),
      wake: () => this.snooze(th, null),
      archive: () => run("tab.settle", { id: th.id }),
      unarchive: () => this.unarchive(th),
      openPr: () => this.browse(d.pr?.url ?? th.pr?.url),
      openIssue: () => this.browse(d.issue?.url),
      zed: () => this.zed(th),
      copyBranch: () => {
        cx.write_to_clipboard(th.branch);
        notify({ title: tr("copied"), body: th.branch, level: "success", timeout: 2000 });
      },
      close: () => openOverlay({ mod: "kt-confirm", kind: "dialog", width: 1, height: 1, frame: "none", props: { thread: th.id } }),
      launch: () => this.launch(th),
      edit: () => {
        if (this.drawer !== th.id) this.openDrawer(th.id, cx);
        this.startEdit(th, "title");
      },
      deleteDraft: () => this.askDeleteDraft(th),
    }[kind];
    go?.();
    this.closeMenu(cx);
  }

  // A decision answered (a pill, or the menu): a toast when nothing went (kt-threads' decided), what
  // waits read again.
  decided(res, cx) {
    if (!res?.ok) notify({ title: tr("reply.title"), body: res?.reason ?? tr("reply.none"), level: "warning", timeout: 4000 });
    this.readDecisions(cx);
    cx.notify();
  }

  // Back from the archive: auto-archive marks it done (archivePlan never settles it again on its own).
  unarchive(th) {
    run("tab.unsettle", { id: th.id });
    this.markArchived(shared(AUTO_ARCHIVED), [th.id], [...(this.byId?.values() ?? [])], Date.now());
  }

  // ---------- drafts (kanban.js draftsOf; shared "kt.kanban.drafts") ----------

  // A new draft in the shown space's project, its drawer open, its title typed at once.
  newDraft(cx) {
    const shown = spaces().find((s) => s.active);
    const p = shown ? [...(this.byId?.values() ?? [])].find((x) => !x.draft && x.space?.id === shown.id)?.project : null;
    const d = { id: `d${Date.now().toString(36)}`, title: "", task: "", space: shown?.id ?? null, at: Date.now(),
      project: p ? { key: p.key, name: p.name, color: p.color, logo: p.logo, home: p.home } : null };
    setShared(DRAFTS, [...(shared(DRAFTS) ?? []), d]);
    this.openDrawer(d.id, cx);
    this.startEdit(draftThread(d), "title");
  }

  startEdit(th, field) {
    this.editing = { id: th.id, field, title: th.title, task: th.task };
    this.handle.focus();
    this.vim.normal();
  }

  // The typing kept; a draft left with neither title nor consigne goes (there is nothing to lose).
  commitEdit() {
    const ed = this.editing;
    this.editing = null;
    if (!ed) return;
    const list = shared(DRAFTS) ?? [];
    const empty = !ed.title.trim() && !ed.task.trim();
    setShared(DRAFTS, empty ? list.filter((d) => d.id !== ed.id) : list.map((d) => (d.id === ed.id ? { ...d, title: ed.title.trim(), task: ed.task } : d)));
  }

  askDeleteDraft(th) {
    this.pending = { kind: "draft", id: th.id };
    openOverlay({ mod: "kt-confirm", kind: "dialog", width: 1, height: 1, frame: "none", props: {
      title: tr("draft.del.title", { name: th.title || tr("draft.untitled") }), detail: tr("draft.del.detail"), label: tr("draft.delete"), danger: true,
      command: { name: "kt-kanban.confirmed" } } });
  }

  // « Lancer » (L): kt-new, filled in: the draft's title as the thread's name, its consigne as the
  // agent's first message, its project (the space it was made in, else the shown one), Claude, a gwm
  // worktree. Nothing starts until the person's Enter there; kt-new records the thread it made
  // (shared "kt.kanban.launched") and the board lets the draft go (landing).
  launch(th) {
    if (this.editing) this.commitEdit();
    const space = spaces().some((s) => s.id === th.from) ? th.from : spaces().find((s) => s.active)?.id;
    openOverlay({ mod: "kt-new", kind: "dialog", width: 1, height: 1, frame: "none",
      props: { name: th.title, task: th.task, project: space ?? null, agent: "claude", worktree: true, draft: th.id } }); // i18n: tech
  }

  // A draft kt-new launched: it goes from the drafts; its thread (kanban.js attach: its tab's name in its
  // space or worktree), once there, takes the cursor, and the drawer if it showed the draft. Not found
  // a minute after: the record goes too (the draft is gone anyway). Writes off the render.
  landing(rec, all, cx) {
    const drafts = shared(DRAFTS) ?? [];
    const has = drafts.some((d) => d.id === rec.draft);
    const id = attach(all, rec);
    const stale = Date.now() - (rec.at ?? 0) > 60e3;
    if (!has && !id && !stale) return;
    cx.spawn(async () => {
      if (has) setShared(DRAFTS, drafts.filter((d) => d.id !== rec.draft));
      if (id || stale) setShared(LAUNCHED, null);
    });
    if (!id) return;
    if (this.drawer === rec.draft) this.drawer = this.drawerLast = id;
    this.cur = id;
    this.reveal = true;
  }

  // Auto-archive (mod.json's archiveDays, 7 by default, 0: never; kanban.js archivePlan): tab.settle, the
  // sidebar's own archive (a display state: nothing closes), on the threads whose PR is merged and that
  // were seen, quiet N days. Only while the page shows. On its own only for a thread that crosses its N
  // days after auto-archive was taken on (its memo's `since`, set at the first pass): every thread
  // already past them is only proposed in the head (« Archiver » / « Laisser »), the person's click. Its
  // memo is shared ("kt.kanban.autoArchived": { since, done }), not this copy's (the glass layout has one
  // of its own); `done`, what it archived or was told to leave: never twice. Written only on a change.
  autoArchive() {
    if (checking() || !visible()) return;
    const days = Number(shared("kt.opt.kt-kanban.archiveDays") ?? 7);
    const memo = shared(AUTO_ARCHIVED);
    const now = Date.now();
    const threads = model.threadsOf(this.world(now));
    const { auto } = archivePlan(threads, { days, now, memo });
    for (const id of auto) run("tab.settle", { id });
    // Said once per pass, how many and where to find them (nothing closed).
    if (auto.length) notify({ title: tr("archive.title", { n: auto.length }), body: tr("archive.body"), level: "info", timeout: 6000 });
    this.markArchived(memo, auto, threads, now);
  }

  // The memo after a pass or a click: `since` set once (the first pass), `ids` done, the closed tabs out.
  markArchived(memo, ids, threads, now) {
    const alive = new Set(threads.map((x) => x.id));
    const was = memo?.done ?? {};
    const done = Object.fromEntries([...Object.entries(was).filter(([id]) => alive.has(id)), ...ids.map((id) => [id, now])]);
    if (!memo?.since || ids.length || Object.keys(done).length !== Object.keys(was).length) setShared(AUTO_ARCHIVED, { since: memo?.since ?? now, done });
  }

  // The head's proposal (archivePlan's `propose`): « Archiver » settles them, « Laisser » leaves them for
  // good; either way they are done.
  settleProposed(ids, archive) {
    const now = Date.now();
    if (archive) for (const id of ids) run("tab.settle", { id });
    this.markArchived(shared(AUTO_ARCHIVED), ids, [...(this.byId?.values() ?? [])], now);
  }

  // One vim action on the board; false: not one it has, and the key goes on.
  act(a, cx) {
    if (!a) return false;
    // `/`: the filter, a space after what it holds (its last term stays a chip, no completion pops on it).
    if (a === "filter") this.editFilter();
    if (a === "pending" || a === "count" || a === "filter" || a === "normal") return true;
    const b = this.board;
    const at = this.at ?? { l: 0, c: 0, i: -1 };
    if (a === "type" || a === "backspace") {
      this.query = a === "type" ? this.query + this.vim.char : this.query.slice(0, -1);
      this.compAt = 0;
    }
    else if (["down", "up", "top", "bottom", "half-down", "half-up", "next", "prev", "left", "right", "tab-next", "tab-prev"].includes(a)) {
      this.at = move(b, at, a, this.vim.count, PAGE_ROWS);
      this.cur = atCard(b, this.at)?.id ?? null;
      this.reveal = true;
      // An open drawer follows the cursor (j / k browse the cards in it).
      if (this.drawer && this.cur && this.cur !== this.drawer) this.openDrawer(this.cur, cx);
    } else if (a === "open-alt") {
      // O: the drawer's PR in the browser (while it shows).
      const th = this.drawer ? this.byId?.get(this.drawer) : null;
      if (!th || th.draft) return false;
      this.browse(this.details[th.id]?.pr?.url ?? th.pr?.url);
    } else if (a === "open" || a === "submit") {
      // A draft has no agent: enter opens its drawer.
      const th = atCard(b, at);
      if (th?.draft) this.openDrawer(th.id, cx);
      else if (th) this.open(th);
    } else if (a === "delete") {
      // x / dd: a draft goes (kt-confirm); nothing else is deleted from here.
      const th = [this.drawer && this.byId?.get(this.drawer), atCard(b, at)].find((x) => x?.draft);
      if (!th) return false;
      this.askDeleteDraft(th);
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
  // warning color past it: nothing is blocked), and on the right, with mod.json's columnCost option (off
  // by default), what its cards cost together (rolling, in costLevel's color). A click on the count shows
  // the limit's stepper under it (or + / - on the cursor's column), the width's (< / > / =) and « Masquer »
  // (while another column shows); they belong to the view.
  // The drafts (in the column a draft lands in) count apart, « +k », outside the limit; that column's head
  // has the « + » of a new draft (n).
  colHead(t, key, cards) {
    const list = cards.filter((th) => !th.draft);
    const drafts = cards.length - list.length;
    const n = list.length;
    const lim = this.limits[key];
    const over = Boolean(lim) && n > lim;
    const cost = costOf(list);
    const editing = this.limitEdit === key;
    const width = this.widths[key];
    const mono = (el) => el.font_family(MONO).text_size(11);
    const step = (id, label, onClick) => h_flex().id(`kk-lim-${id}-${key}`).flex_none().h(22).px(8).items_center().justify_center().rounded(6).border(1)
      .border_color(t.border).bg(t.background).text_size(12).text_color(t.muted).cursor_pointer().hover((s) => s.bg(t.hover).text_color(t.foreground))
      .on_click((_e, cx) => { onClick(); cx.notify(); })
      .child(label);
    return v_flex().flex_none()
      .child(h_flex().h(40).px(14).gap(8).items_center()
        .child(div().size(8).rounded(4).flex_none().bg(t[TINT[key]] ?? t.dim))
        // Its name clicked (#35): its status (or phase) in the filter, alt: negated.
        .child(div().id(`kk-fv-col-${key}`).flex_none().text_size(13).font_medium().text_color(t.foreground).cursor_pointer()
          .hover((s) => s.text_color(t.accent)).tooltip(tr("fv.tip", { term: termText({ field: this.colField, value: key }) }))
          .on_click((e, cx) => { this.addFilter(this.colField, key, Boolean(e?.modifiers?.alt)); cx.notify(); })
          .child(this.colName(key)))
        .child(h_flex().id(`kk-wip-${key}`).flex_none().h(20).px(6).gap(3).items_center().rounded(6).border(1)
          .border_color(over ? alpha(t.blocked, "66") : editing ? t.border : alpha(t.border, "00"))
          .when(over, (el) => el.bg(alpha(t.blocked, "24")))
          .text_color(over ? t.blocked : t.dim).cursor_pointer().hover((s) => s.bg(t.hover))
          .tooltip(over ? tr("limit.over", { n, lim }) : tr("limit.tip"))
          .on_click((_e, cx) => { this.limitEdit = editing ? null : key; cx.notify(); })
          .child(mono(roll(this.m, `kk-n-${key}`, String(n), 14)))
          .when(Boolean(lim), (el) => el.child(mono(div()).child(`/ ${lim}`))))
        .when(drafts > 0, (el) => el.child(div().id(`kk-drafts-${key}`).flex_none().px(5).rounded(5).border(1).border_dashed().border_color(t.input)
          .tooltip(tr("draft.count")).child(mono(div()).text_color(t.dim).child(`+${drafts}`))))
        .child(div().flex_1())
        .when(key === this.draftCol, (el) => el.child(h_flex().id(`kk-new-draft-${key}`).flex_none().size(22).items_center().justify_center().rounded(6)
          .text_color(t.dim).cursor_pointer().hover((s) => s.bg(t.hover).text_color(t.foreground)).tooltip(tr("draft.new"))
          .on_click((_e, cx) => { this.newDraft(cx); cx.notify(); })
          .child(svg(I("plus")).size(13))))
        .when(cost > 0 && shared("kt.opt.kt-kanban.columnCost") === true, (el) => el.child(div().id(`kk-cost-${key}`).flex_none().tooltip(tr("cost.sum"))
          .child(mono(roll(this.m, `kk-cost-n-${key}`, `$${fnum(cost, 2)}`, 14, { snap: 2 })).text_color(levelColor(t, costLevel(cost), { okGreen: true }))))))
      .when(editing, (el) => el.child(h_flex().h(32).px(14).gap(6).items_center()
        .child(div().flex_none().w(52).text_size(12).text_color(t.muted).child(tr("limit")))
        .child(step("minus", "−", () => { this.limits = stepLimit(this.limits, key, -1, n); }))
        .child(mono(div()).flex_none().w(28).text_center().text_color(lim ? t.foreground : t.dim).child(lim ? String(lim) : "—"))
        .child(step("plus", "+", () => { this.limits = stepLimit(this.limits, key, 1, n); }))
        .child(div().flex_1())
        .when(Boolean(lim), (el) => el.child(step("none", tr("limit.none"), () => { this.limits = stepLimit(this.limits, key, -lim, n); }))))
        // #34: its width (< / > / = on the keys), then hiding it (the reminder at the board's end shows it again).
        .child(h_flex().h(32).px(14).gap(6).items_center()
          .child(div().flex_none().w(52).text_size(12).text_color(t.muted).child(tr("width")))
          .child(step("narrow", "−", () => { this.widths = stepWidth(this.widths, key, -1, this.shownW); }))
          .child(mono(div()).flex_none().w(28).text_center().text_color(width ? t.foreground : t.dim).child(width ? String(width) : tr("width.auto")))
          .child(step("wide", "+", () => { this.widths = stepWidth(this.widths, key, 1, this.shownW); }))
          .child(div().flex_1())
          .when(Boolean(width), (el) => el.child(step("auto", tr("width.auto"), () => { this.widths = stepWidth(this.widths, key, 0); }))))
        .when(this.board.keys.length > 1, (el) => el.child(h_flex().h(32).px(14).items_center()
          .child(step("hide", tr("col.hide"), () => { this.hidden = toggleHidden(this.hidden, key, this.board.all); this.limitEdit = null; })))));
  }

  // One card, ~240 px wide. `col` goes into every id: a card changing column is drawn twice for a moment
  // (its leaving copy in the old column, rows()). `gone`: that leaving copy, no longer a target.
  card(t, th, col, cursor, gone, now, cx) {
    const key = `${col}-${th.id}`;
    if (th.draft) return this.withMenu(t, th, key, gone, this.draftCard(t, th, key, cursor, gone));
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
    // First, what matters (Kylian: « pas du tout le coût »): what the agent waits on from you when it is
    // blocked (the sidebar's decision: decide.js' dialog, else herdr-bridge's pending, else that it
    // waits), else what it does now or answered (the sidebar's live line). Two lines at most.
    // The density (#34, the view's): compact, the title row only (its status: the agent's logo, the
    // column), except a blocked card, which keeps what it asks on one line with its pills (Kylian: what
    // the agent waits on is what matters); detailed, what it asks or does on four lines and its session
    // (sessionBlock) besides.
    // #38: the pointer resting on it (hovering(): a short delay in, a short linger out) or the keys'
    // cursor unfolds it, as the sidebar's compact cards: compact, everything; normal, its session (model
    // · effort, context, quota, cost, run time, lines, TTL, cache); detailed shows it already.
    // Its menu open (#33), it stays as it is under it: the anchored menu doesn't move.
    const open = !gone && (cursor || this.hover === th.id || this.keep === th.id || this.menu?.id === th.id);
    const ses = sessionOf(th, this.quota, now);
    const full = this.density !== "compact";
    const clamp = this.density === "detailed" ? 64 : 32;
    const asking = th.status === "blocked" ? this.askOf(th) : null;
    // Its answer there, as the sidebar's pills (decide.js decisionButtons: Accepter, Refuser, other
    // choices; Ouvrir with none, which goes to the agent as the card's click). Never on a leaving copy:
    // the pills' ids carry only the terminal.
    const d = asking && !gone ? this.decisions[th.terminal] : null;
    const pills = d ? decisionButtons(d, { onDone: (res, cx) => {
      if (res?.ok && !d.pending.options?.length) this.open(th);
      this.decided(res, cx);
    } }) : null;
    // Compact, a blocked card: what it asks on one line, then its pills.
    const one = asking && !full ? h_flex().id(`kk-ask1-${key}`).h(26).px(8).gap(6).items_center().rounded(8).border(1).border_color(alpha(t.blocked, "4d")).bg(alpha(t.blocked, "1a"))
      .tooltip(asking.detail ? `${asking.title} · ${asking.detail}` : asking.title)
      .child(div().size(6).rounded(3).flex_none().bg(t.blocked))
      .child(div().flex_1().min_w(0).truncate().text_size(12).font_medium().text_color(t.blocked).child(asking.title))
      .when(Boolean(pills), (el) => el.child(pills)) : null;
    // The rows below the title are builders: a fold closing builds them once more (motion.js collapse).
    // What it asks (whole, with its pills), else what it does or answered. `fold`: inside a compact card's
    // fold, under its one line (which keeps the pills: drawn once), the title whole instead of truncated.
    const callout = (fold = false) => (asking
      ? v_flex().px(8).py(5).gap(2).rounded(8).border(1).border_color(alpha(t.blocked, "4d")).bg(alpha(t.blocked, "1a"))
        .child(h_flex().gap(6).items_center()
          .child(div().size(6).rounded(3).flex_none().bg(t.blocked))
          .child(div().flex_1().min_w(0).when(!fold, (el) => el.truncate()).text_size(12).font_medium().text_color(t.blocked).child(asking.title)))
        .when(Boolean(asking.detail), (el) => el.child(div().max_h(fold ? 64 : clamp).overflow_hidden().text_size(11.5).line_height("16px").text_color(t.foreground).child(asking.detail)))
        .when(!fold && Boolean(pills), (el) => el.child(h_flex().pt(3).child(pills)))
      : th.line ? div().max_h(clamp).overflow_hidden().text_size(11.5).line_height("16px").text_color(th.status === "working" ? t.muted : t.dim).child(`↳ ${th.line}`)
        : null);
    // Then the flow's step, then the PR (its state's color, a draft in dim as kt-flow) and its CI (/me:report's,
    // else the drawer's checks): passed, failing, running, as icons and counts; the issue, the sub-agents.
    const look = !th.pr ? null : th.pr.state === "OPEN" && (th.pr.draft ?? th.pr.isDraft) ? { ...PR.OPEN, color: "dim" } : PR[th.pr.state] ?? PR.OPEN;
    const subs = th.subagents;
    const ci = th.report?.ci?.total ? th.report.ci : ciCount(this.details[th.id]?.pr?.checks);
    const count = (icon, color, n) => n > 0 && h_flex().flex_none().gap(2).items_center().text_color(color).child(svg(I(icon)).size(10)).child(mono(color, String(n)));
    // #35: a value of the card (its agent, its PR, its project, its branch) clicked adds its term to the
    // filter (kanban.js cardTerms; alt: negated); never on a leaving copy. The card's own click is stopped.
    const terms = Object.fromEntries(cardTerms(th).map((x) => [x.field, x.value]));
    const fv = (field, el) => (gone || terms[field] == null ? el : el.id(`kk-fv-${field}-${key}`).cursor_pointer()
      .hover((s) => s.text_color(t.accent)).tooltip(tr("fv.tip", { term: termText({ field, value: terms[field] }) }))
      .on_click((e, cx) => { cx.stop_propagation(); this.addFilter(field, terms[field], Boolean(e?.modifiers?.alt)); cx.notify(); }));
    const facts = () => [
      look && fv("pr", h_flex().flex_none().gap(3).items_center().text_color(t[look.color])
        .child(svg(I(look.icon)).size(11)).child(mono(t[look.color], `#${th.pr.number}`))),
      ci?.total && h_flex().id(`kk-ci-${key}`).flex_none().gap(5).items_center()
        .tooltip(tr("ci.tip", { ok: ci.ok, fail: ci.fail, pending: ci.pending }))
        .child(mono(t.dim, "CI")) // i18n: tech
        .children([count("check", t.done, ci.ok), count("x", t.ansi1, ci.fail), count("clock", t.ansi3, ci.pending)].filter(Boolean)),
      th.issue && h_flex().flex_none().gap(3).items_center().text_color(t.muted)
        .child(svg(I("circle-dashed")).size(11)).child(mono(t.muted, `#${th.issue}`)),
      subs.total > 0 && h_flex().id(`kk-sub-${key}`).flex_none().gap(3).items_center().text_color(t.dim)
        .tooltip(tr("subagents", { done: subs.done, total: subs.total }))
        .child(svg(I("bot")).size(11)).child(mono(t.dim, `${subs.done}/${subs.total}`)),
    ].filter(Boolean);
    const step = th.flow?.step?.label;
    const working = th.status === "working";
    const rest = () => { const f = facts(); return [
      step && h_flex().h(16).gap(6).items_center()
        // The step's dot breathes while the agent works (an active state: ANIMATIONS.md).
        .child(div().id(`kk-step-${key}`).size(6).rounded(3).flex_none().bg(t.accent)
          .when(working && !this.m.reduced, (d) => d.loop("opacity", { from: 0.35, to: 1, period: 1400 })))
        .child(div().min_w(0).truncate().font_family(MONO).text_size(10.5).text_color(t.muted).child(step)),
      f.length > 0 && h_flex().h(16).gap(10).items_center().overflow_hidden().children(f),
      // Last, where it is: its project, its branch (a worktree's icon in a linked one).
      h_flex().h(16).gap(6).items_center()
        .child(this.mark(t, th.project, 12))
        .child(fv("project", div().flex_none().max_w(96).truncate().font_family(MONO).text_size(10).text_color(t.muted).child(th.project.name.toUpperCase())))
        .when(Boolean(th.branch), (el) => el
          .child(svg(I(th.worktree ? "folder-tree" : "git-branch")).size(11).flex_none().text_color(t.dim))
          .child(fv("branch", div().flex_1().min_w(0).truncate().font_family(MONO).text_size(10.5).text_color(t.dim).child(th.branch)))),
    ].filter(Boolean); };
    const session = () => (ses ? this.sessionBlock(t, th, ses, key, now) : null);
    // Unfolding: in a column, on its height (collapse, a builder: it folds back on its height too); by
    // project, at once (the lane's fold is the only height level there: ANIMATIONS.md).
    const unfold = (id, on, build) => (this.inLanes ? (on ? build() : null) : collapse(this.m, id, on, build, { cx }));
    const below = !full
      ? [one, unfold(`kk-more-${key}`, open, () => v_flex().gap(4).children([callout(true), ...rest(), session()].filter(Boolean)))]
      : this.density === "detailed" ? [callout(), ...rest(), session()]
        : [callout(), ...rest(), ses && unfold(`kk-ses-${key}`, open, session)];
    return this.withMenu(t, th, key, gone, v_flex().id(`kk-card-${key}`).p(8).gap(4).rounded(12).border(1)
      .border_color(cursor ? alpha(t.accent, "99") : th.shown ? alpha(t.accent, "66") : t.border)
      .bg(cursor || th.shown ? alpha(t.accent, "24") : t.background)
      .when(muted, (el) => el.opacity(0.62))
      .when(!gone && !cursor, (el) => el.hover((s) => s.bg(t.hover)))
      .when(!gone, (el) => el.cursor_pointer().on_click(() => this.open(th)).on_hover((h, cx) => this.hovering(th.id, h, cx)))
      .child(h_flex().h(20).gap(8).items_center()
        .child(fv("agent", h_flex().flex_none().child(pet)))
        // The title opens the card's drawer (the rest of the card goes to the agent, as enter).
        .child(div().id(`kk-tt-${key}`).flex_1().min_w(0).truncate().text_size(13).font_medium().text_color(muted ? t.muted : t.foreground)
          .when(!gone, (el) => el.hover((s) => s.text_color(t.accent)).on_click((_e, cx) => { cx.stop_propagation(); this.openDrawer(th.id, cx); cx.notify(); }))
          .child(th.title))
        .when(th.pinned, (el) => el.child(svg(I("pin")).size(11).flex_none().text_color(t.dim)))
        .child(corner))
      .children(below.filter(Boolean)));
  }

  // #38: the pointer on a card unfolds it after HOVER_IN (passing over doesn't), and it folds back
  // HOVER_OUT after the pointer left (going from card to card doesn't flicker; back on it before then, it
  // simply stays open). Never takes the keyboard.
  hovering(id, h, cx) {
    if (h && this.keep === id) {
      this.keep = null;
      this.keepTok = (this.keepTok ?? 0) + 1; // its fold back is called off
      this.hover = id;
      return;
    }
    if (h) {
      const tok = (this.hoverTok = (this.hoverTok ?? 0) + 1);
      this.entering = { id, tok };
      cx.timer.after(HOVER_IN, (cx) => {
        if (this.entering?.tok !== tok) return;
        this.entering = null;
        this.hover = id;
        this.keep = null;
        cx.notify();
      });
      return;
    }
    if (this.entering?.id === id) this.entering = null;
    if (this.hover !== id) return;
    this.hover = null;
    this.keep = id;
    const tok = (this.keepTok = (this.keepTok ?? 0) + 1);
    cx.timer.after(HOVER_OUT, (cx) => {
      if (this.keepTok !== tok) return;
      this.keep = null;
      cx.notify();
    });
    cx.notify();
  }

  // #38, a card's session (kanban.js sessionOf), the sidebar's focus card's: model · effort; the context
  // ring (tokens / window beside it) and the 5 h window's, else the 7 d one's (its reset); then cost ·
  // run time · lines · the cache's TTL · its hit under 85 %. The ids carry the card's key (column).
  sessionBlock(t, th, s, key, now) {
    const eyebrow = (text) => div().font_family(MONO).text_size(9.5).text_color(t.muted).child(text);
    const beside = (text) => div().min_w(0).truncate().font_family(MONO).text_size(9.5).text_color(t.dim).child(text);
    const mono = (color, text) => div().flex_none().font_family(MONO).text_size(10.5).text_color(color).child(text);
    const cell = (id, label, pct, sub, kind) => h_flex().flex_1().min_w(0).gap(6).items_center()
      .child(ring(t, id, pct, 28, { kind, window: s.window ?? undefined, roll, m: this.m }))
      .child(v_flex().min_w(0).gap(1).child(eyebrow(label)).when(Boolean(sub), (el) => el.child(beside(sub))));
    const tokens = ctxTokens(th.sl);
    const reset = (q) => {
      if (q.kind === "5h") { const d = new Date(q.resets * 1000); return tr("ses.resetAt", { time: `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}` }); }
      const h = (q.resets * 1000 - now) / 3600e3;
      return h >= 24 ? tr("ses.resetD", { n: Math.ceil(h / 24) }) : tr("ses.resetH", { n: Math.max(1, Math.ceil(h)) });
    };
    const rings = [
      s.ctx != null && cell(`kk-ring-cx-${key}`, tr("ses.context"), s.ctx, s.window && tokens > 0 ? `${toks(tokens)} / ${toks(s.window)}` : null, "ctx"),
      s.quota && cell(`kk-ring-q-${key}`, s.quota.kind === "5h" ? "5H" : tr("ses.week"), s.quota.pct, reset(s.quota), "quota"), // i18n: tech
    ].filter(Boolean);
    const ttl = ttlText(s.ttl);
    const numbers = [
      s.cost != null && mono(levelColor(t, costLevel(s.cost, th.model), { okGreen: true }), `$${fnum(s.cost, 2)}`),
      s.ran != null && mono(t.muted, model.duration(now - s.ran, now)),
      (s.added > 0 || s.removed > 0) && h_flex().flex_none().gap(4).child(mono(t.ansi2, `+${s.added}`)).child(mono(t.ansi1, `−${s.removed}`)),
      s.ttl != null && (ttl ? mono(t.dim, ttl) : mono(t.ansi1, tr("ses.ttlGone"))),
      s.hit != null && mono(s.hit < 60 ? t.ansi1 : t.blocked, `cache ${Math.round(s.hit)}%`), // i18n: tech
    ].filter(Boolean);
    return v_flex().id(`kk-ses-in-${key}`).gap(6).pt(6).border_t(1).border_dashed().border_color(t.border)
      .when(Boolean(s.model), (el) => el.child(div().min_w(0).truncate().font_family(MONO).text_size(10.5).text_color(t.muted).child(s.model)))
      .when(rings.length > 0, (el) => el.child(h_flex().gap(8).items_center().children(rings)))
      .when(numbers.length > 0, (el) => el.child(h_flex().min_h(16).gap_x(6).gap_y(4).items_center().flex_wrap()
        .children(numbers.flatMap((n, i) => (i ? [div().text_size(10.5).text_color(t.border).child("·"), n] : [n])))));
  }

  // A right-click opens the card's menu; while it shows, gpui-base's Popup anchors it under the card
  // (kept clear of the window's edges, above the rest). Never on a leaving copy (gone). `menuDrawn`
  // tells render() it found its card (a filtered or folded one: the menu goes).
  withMenu(t, th, key, gone, el) {
    if (gone) return el;
    el = el.on_mouse_down("right", (_e, cx) => {
      cx.stop_propagation();
      this.openMenu(th, cx);
      cx.notify();
    });
    if (this.menu?.id !== th.id) return el;
    this.menuDrawn = true;
    return Popup.new(`kk-menu-${key}`, el).anchor("top_left").w_full().content(this.menuPanel(t, th));
  }

  // The menu (kt-menu's look: 31 px rows, a rule before a group): what the item says, its icon (a
  // decision's tone as a dot), its key. It rises in on its first layout and sinks out (sheet / leave);
  // a press outside it shuts it.
  menuPanel(t, th) {
    const list = this.menuItems(th);
    const at = Math.max(0, list.findIndex((it) => it.key === this.menu.key));
    const anim = this.menu.anim;
    const s = sheet(this.m, anim, this.menuShown === anim);
    const words = {
      accept: tr("menu.accept"), refuse: tr("menu.refuse"), go: tr("drawer.go"), drawer: tr("menu.drawer"), pin: tr("drawer.pin"),
      unpin: tr("drawer.unpin"), wake: tr("snooze.wake"), archive: tr("menu.archive"), unarchive: tr("menu.unarchive"),
      openPr: tr("drawer.openPr"), openIssue: tr("drawer.openIssue"), zed: tr("drawer.zed"), copyBranch: tr("menu.copyBranch"),
      close: tr("menu.close"), launch: tr("draft.launch"), edit: tr("draft.edit"), deleteDraft: tr("draft.delete"),
    };
    const icons = { go: "bot", drawer: "panel-right", pin: "pin", unpin: "pin", snooze: "clock", wake: "sun", archive: "archive",
      unarchive: "archive-restore", openPr: "git-pull-request", openIssue: "circle-dashed", zed: "folder", copyBranch: "git-branch",
      close: "x", launch: "sparkles", edit: "square-pen", deleteDraft: "x" };
    const tone = { positive: t.done, negative: t.ansi1, danger: t.ansi1 };
    const row = (it, i) => {
      const [kind, arg] = it.key.split(":");
      // f's (#35): the term it adds, in its field's color; alt-click adds it negated.
      const term = kind === "filter";
      const label = term ? termText({ field: it.field, value: it.value })
        : kind === "decide" ? words[arg] ?? it.label : kind === "snooze" ? tr("menu.snooze", { when: tr(`snooze.${arg}`) }) : words[kind];
      const color = term ? t[FIELD_TINT[it.field]] ?? t.foreground : tone[it.tone] ?? t.foreground;
      return v_flex()
        .when(Boolean(it.sep) && i > 0, (el) => el.child(div().mx(7).my(4).h(1).bg(t.border)))
        .child(h_flex().id(`kk-mi-${it.key}`).h(31).px(8).gap(9).rounded(7).items_center().text_color(term ? t.foreground : color).cursor_pointer()
          .when(i === at, (el) => el.bg(t.selected))
          .hover((st) => st.bg(t.hover))
          .on_click((e, cx) => { cx.stop_propagation(); this.runItem(th, it, cx, Boolean(e?.modifiers?.alt)); cx.notify(); })
          .child(kind === "decide"
            ? h_flex().size(14).flex_none().items_center().justify_center().child(div().size(8).rounded(4).bg(color))
            : svg(I(term ? FIELD_ICON[it.field] ?? "search" : icons[kind])).size(14).flex_none().text_color(it.tone || term ? color : t.muted))
          .child(div().flex_1().min_w(0).truncate().when(term, (el) => el.font_family(MONO).text_size(11.5)).child(label))
          .when(Boolean(it.hint), (el) => el.child(div().flex_none().font_family(MONO).text_size(11).text_color(t.dim).child(it.hint))));
    };
    const filtering = this.menu.kind === "filter";
    return s.card(s.veil(v_flex().id("kk-menu"))).w(filtering ? 260 : 236).p(5).rounded(12).border(1).border_color(t.border).bg(t.popover).text_size(12.8)
      .on_size_change((_size, cx) => {
        if (this.menuShown === anim) return;
        this.menuShown = anim;
        cx.notify();
      })
      .on_mouse_down_out((_e, cx) => {
        this.closeMenu(cx);
        cx.notify();
      })
      .when(filtering, (el) => el.child(div().px(8).pt(4).pb(2).font_family(MONO).text_size(10).text_color(t.muted).child(tr("fmenu.title").toUpperCase())))
      .children(list.map(row))
      .when(filtering, (el) => el.child(div().mt(4).px(8).py(5).border_t(1).border_color(t.border).font_family(MONO).text_size(10).text_color(t.dim).child(tr("fmenu.keys"))));
  }

  // What a blocked thread waits on (the sidebar's: decide.js, read for the blocked agents while the page
  // shows; else herdr-bridge's pending in the model): { title, detail }; nothing known, that it waits.
  askOf(th) {
    const p = this.decisions[th.terminal]?.pending ?? th.asks;
    return { title: p?.title || tr("now.blocked"), detail: p?.detail || null };
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
    // Its width set (the view's): as set; auto: it shares the board, COL_W at least. The width it is drawn
    // at is noted (no redraw: only < / > read it).
    const w = this.widths[col.key];
    return v_flex().id(`kk-lane-${col.key}`).when(Boolean(w), (el) => el.w(w).flex_none()).when(!w, (el) => el.flex_1().min_w(COL_W))
      .on_size_change((size) => { this.shownW[col.key] = size.width; })
      .h_full().rounded(16).border(1).border_color(t.border).bg(t.chrome)
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
    // A width per column, the heads' and every lane's cells (kanban.js laneWidths: a set one as set, the
    // auto ones share the rest, COL_W at least).
    const ws = laneWidths(b.keys, this.widths, (this.lanesW ?? 0) - 12);
    b.keys.forEach((k, c) => { this.shownW[k] = ws[c]; });
    const total = ws.reduce((s, x) => s + x, 0) + 4 * (ws.length - 1);
    // A column's cards in every lane: its head's count, limit and cost are the whole column's.
    const all = b.keys.map((_k, c) => b.lanes.flatMap((lane) => lane.cols[c].threads));
    if (this.reveal && this.at && atCard(b, this.at)) {
      this.laneScroll.scroll_to_item(this.at.l + 1); // after the heads' row
      this.reveal = false;
    }
    const lane = (ln, l) => {
      const body = collapse(this.m, `kk-fold-${ln.key}`, ln.open, () => h_flex().gap(4).items_start().children(ln.cols.map((col, c) =>
        v_flex().w(ws[c]).flex_none().min_h(44).p(6).gap(6).rounded(12).border(1).border_color(t.border).bg(t.chrome)
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
        v_flex().w(ws[c]).flex_none().rounded(12).border(1).border_color(t.border).bg(t.chrome).child(this.colHead(t, k, all[c])))))
      .children(b.lanes.map(lane))
      .when(!b.lanes.length, (el) => el.child(div().p(12).text_size(12.5).text_color(t.dim).child(tr("noMatch"))));
  }

  // The drawer's content, DRAWER_W wide: its head over the dither of the card's project (the agent's live
  // logo, the title coming into focus, project · branch or worktree · age, a close), then its sections:
  // the flow in kt-flow's tiers (viz.js steps by phase), the issue, the PR with its checks in dither steps
  // (kt-inbox's), the diff against the base, the cost, context and sub-agents, then its actions, each with
  // its key. It fades in at each card it shows (its id carries the thread).
  drawerPanel(t, th, now, cx) {
    if (th.draft) return this.draftPanel(t, th, now);
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
    // First, as on the card: what it waits on from you (whole), else what it does or answered.
    const asking = th.status === "blocked" ? this.askOf(th) : null;
    const nowEl = asking
      ? v_flex().px(10).py(8).gap(4).rounded(10).border(1).border_color(alpha(t.blocked, "4d")).bg(alpha(t.blocked, "1a"))
        .child(div().text_size(12.5).font_medium().text_color(t.blocked).child(asking.title))
        .when(Boolean(asking.detail), (el) => el.child(div().max_h(120).overflow_hidden().text_size(12).line_height("17px").text_color(t.foreground).child(asking.detail)))
      : th.line ? div().max_h(120).overflow_hidden().text_size(12).line_height("17px").text_color(t.muted).child(`↳ ${th.line}`) : null;
    const body = v_flex().id(`kk-dr-body-${key}`).flex_1().min_h(0).overflow_y_scrollbar().p(14).gap(18)
      .when(Boolean(nowEl), (el) => el.child(section(asking ? tr("drawer.asks") : tr("drawer.doing"), nowEl)))
      .child(section(tr("drawer.flow"), flow))
      .when(Boolean(issue), (el) => el.child(section("Issue", issue))) // i18n: tech
      .when(Boolean(prBlock), (el) => el.child(section("Pull request", prBlock))) // i18n: tech
      .when(Boolean(th.branch), (el) => el.child(section("Diff", diff))) // i18n: tech
      .child(section(tr("drawer.figures"), figures, ...agents))
      .child(section(tr("drawer.actions"), actions));
    return enter(this.m, v_flex().w(DRAWER_W).h_full().rounded(16).border(1).border_color(t.border).bg(t.background)
      .child(head).child(div().flex_none().h(0).border_t(1).border_dashed().border_color(alpha(tint, "4d"))).child(body), `kk-dr-${key}`, { dy: 0 });
  }

  // Auto-archive's proposal, a line in the head: how many threads could go (their titles in the tooltip),
  // « Archiver » (tab.settle, nothing closes) or « Laisser » (never proposed again).
  archiveOffer(t, ids, days) {
    const titles = ids.map((id) => this.byId?.get(id)?.title).filter(Boolean);
    const chip = (id, label, onClick, color) => h_flex().id(`kk-arch-${id}`).flex_none().h(24).px(10).items_center().rounded_full().border(1)
      .border_color(t.border).bg(t.background).text_size(12).text_color(color).cursor_pointer().hover((s) => s.bg(t.hover))
      .on_click((_e, cx) => { onClick(); cx.notify(); })
      .child(label);
    return h_flex().id("kk-archive-offer").flex_none().h(38).px(12).gap(8).items_center()
      .tooltip(titles.slice(0, 12).join(" · ") + (titles.length > 12 ? " …" : ""))
      .child(svg(I("archive")).size(13).flex_none().text_color(t.muted))
      .child(div().flex_1().min_w(0).truncate().text_size(12.5).text_color(t.muted).child(tr("archive.offer", { n: ids.length, days })))
      .child(chip("do", tr("archive.do"), () => this.settleProposed(ids, true), t.foreground))
      .child(chip("leave", tr("archive.leave"), () => this.settleProposed(ids, false), t.muted));
  }

  // A draft's card (GitHub's draft item): dashed and faded, the pen, its title (« Sans titre » while it
  // has none), the DRAFT word, its project, its consigne's first line. A click opens its drawer.
  draftCard(t, th, key, cursor, gone) {
    const first = th.task.split("\n").find((l) => l.trim()) ?? "";
    return v_flex().id(`kk-card-${key}`).p(8).gap(4).rounded(12).border(1).border_dashed()
      .border_color(cursor ? alpha(t.accent, "99") : t.input).bg(cursor ? alpha(t.accent, "24") : alpha(t.background, "80"))
      .when(!cursor, (el) => el.opacity(0.8))
      .when(!gone && !cursor, (el) => el.hover((s) => s.bg(t.hover)))
      .when(!gone, (el) => el.cursor_pointer().on_click((_e, cx) => { this.openDrawer(th.id, cx); cx.notify(); }))
      .child(h_flex().h(20).gap(8).items_center()
        .child(h_flex().size(20).flex_none().items_center().justify_center().child(svg(I("square-pen")).size(13).text_color(t.dim)))
        .child(div().flex_1().min_w(0).truncate().text_size(13).font_medium().text_color(th.title ? t.foreground : t.dim).child(th.title || tr("draft.untitled")))
        .child(div().flex_none().h(16).px(6).flex().items_center().rounded_full().border(1).border_dashed().border_color(t.input)
          .font_family(MONO).text_size(9).text_color(t.dim).child(tr("draft.tag"))))
      .when(this.density !== "compact", (el) => el.child(h_flex().h(16).gap(6).items_center()
        .child(this.mark(t, th.project.key === "none" ? null : th.project, 12))
        .child(div().flex_none().max_w(150).truncate().font_family(MONO).text_size(10).text_color(t.muted).child(String(th.project.name ?? "").toUpperCase()))))
      .when(this.density !== "compact" && Boolean(first), (el) => el.child(div().h(16).min_w(0).truncate().text_size(11.5).text_color(t.dim).child(first)));
  }

  // A draft's drawer: its head (the pen over the project's dither), its title and its consigne (i types
  // them, tab from one to the other, esc done: kept), then « Lancer » (L: kt-new filled in, nothing
  // starts without the person's Enter there) and « Supprimer » (x, kt-confirm).
  draftPanel(t, th, now) {
    const ed = this.editing?.id === th.id ? this.editing : null;
    const title = ed ? ed.title : th.title;
    const task = ed ? ed.task : th.task;
    const tint = th.project.home ? t.muted : paint(t, th.project.color) ?? t.accent;
    const mono = (color, text) => div().flex_none().font_family(MONO).text_size(10.5).text_color(color).child(text);
    const eyebrow = (text, hint) => h_flex().gap(8).items_center().font_family(MONO).text_size(10).text_color(t.muted)
      .child(div().flex_1().child(String(text).toUpperCase())).when(Boolean(hint), (el) => el.child(div().text_color(t.dim).child(hint)));
    const box = (field, body) => {
      const on = ed?.field === field;
      return v_flex().id(`kk-df-${field}-${th.id}`).min_h(field === "task" ? 96 : 32).max_h(field === "task" ? 260 : 64).overflow_y_scroll()
        .px(12).py(7).gap(2).rounded(10).border(1).border_color(on ? t.accent : t.input).when(on, (el) => el.bg(alpha(t.accent, "14")))
        .bg(t.background).cursor_text()
        .on_click((_e, cx) => {
          if (ed) this.editing.field = field;
          else {
            if (this.editing) this.commitEdit(); // another draft's typing, kept
            this.startEdit(th, field);
          }
          cx.notify();
        })
        .child(body(on));
    };
    const caret = () => div().flex_none().w(2).h(16).rounded(1).bg(t.accent);
    const titleBox = box("title", (on) => h_flex().min_h(18).items_center().text_size(13.5).font_medium()
      .text_color(title ? t.foreground : t.dim).child(div().min_w(0).truncate().child(title || (on ? "" : tr("draft.untitled")))).when(on, (el) => el.child(caret())));
    const lines = task.split("\n");
    const taskBox = box("task", (on) => v_flex().gap(2).text_size(12.5).line_height("18px")
      .when(!task && !on, (el) => el.child(div().text_color(t.dim).child(tr("draft.taskPh"))))
      .children((task || on ? lines : []).map((l, i) => h_flex().min_h(18).items_center().text_color(t.foreground)
        .child(div().min_w(0).child(l)).when(on && i === lines.length - 1, (el) => el.child(caret())))));
    const button = (id, label, k, onClick, color = t.foreground) => h_flex().id(`kk-dd-${id}`).flex_none().h(28).px(10).gap(8).items_center().rounded_full().border(1)
      .border_color(t.border).bg(t.background).text_size(12).text_color(color).cursor_pointer().hover((s) => s.bg(t.hover))
      .on_click((_e, cx) => { onClick(); cx.notify(); })
      .child(label).child(div().flex_none().px(5).rounded(4).bg(t.raised).font_family(MONO).text_size(9.5).text_color(t.muted).child(k));
    const head = div().relative().flex_none().h(64).overflow_hidden().rounded_t(15)
      .child(ditherBand(DRAWER_W - 2, 64, 15, alpha(tint, settings().dark ? "4d" : "33"), TOP))
      .child(h_flex().size_full().px(12).gap(10).items_center()
        .child(h_flex().size(36).flex_none().rounded(10).items_center().justify_center().border(1).border_dashed().border_color(t.input).bg(alpha(t.background, "e6"))
          .child(svg(I("square-pen")).size(16).text_color(t.dim)))
        .child(v_flex().flex_1().min_w(0).gap(3)
          .child(sharpen(this.m, `kk-dr-title:${th.id}`, () => div().truncate().text_size(14).font_semibold().text_color(title ? t.foreground : t.dim).child(title || tr("draft.untitled"))))
          .child(h_flex().min_w(0).gap(6).items_center()
            .child(this.mark(t, th.project.key === "none" ? null : th.project, 12))
            .child(div().flex_none().max_w(140).truncate().font_family(MONO).text_size(10.5).text_color(t.muted).child(String(th.project.name ?? "").toUpperCase()))
            .child(mono(t.dim, tr("draft.tag")))
            .child(mono(t.dim, model.age(th.activity, now).toUpperCase()))))
        .child(h_flex().id("kk-dr-close").size(26).flex_none().items_center().justify_center().rounded_full().text_color(t.dim)
          .cursor_pointer().hover((s) => s.bg(t.hover).text_color(t.foreground)).tooltip(tr("drawer.close"))
          .on_click((_e, cx) => { if (this.editing) this.commitEdit(); this.closeDrawer(cx); cx.notify(); })
          .child(svg(I("x")).size(13))));
    const body = v_flex().id(`kk-dr-body-${th.id}`).flex_1().min_h(0).overflow_y_scrollbar().p(14).gap(14)
      .child(v_flex().gap(6).child(eyebrow(tr("draft.title"), ed ? null : "i")).child(titleBox))
      .child(v_flex().gap(6).child(eyebrow(tr("draft.consigne"), ed ? "tab · esc" : null)).child(taskBox)) // i18n: tech
      .child(div().text_size(12).line_height("18px").text_color(t.dim).child(tr("draft.help")))
      .child(h_flex().flex_wrap().gap(6)
        .child(button("launch", tr("draft.launch"), "L", () => this.launch(th)))
        .child(button("edit", tr("draft.edit"), "i", () => this.startEdit(th, "title")))
        .child(button("delete", tr("draft.delete"), "x", () => this.askDeleteDraft(th), t.ansi1)));
    return enter(this.m, v_flex().w(DRAWER_W).h_full().rounded(16).border(1).border_dashed().border_color(t.input).bg(t.background)
      .child(head).child(div().flex_none().h(0).border_t(1).border_dashed().border_color(t.input)).child(body), `kk-dr-${th.id}`, { dy: 0 });
  }

  // #35, a filter chip: its term in its field's color (a word muted; one set aside in the warning color,
  // its icon and the filter's help); an x; a click removes the term. `on`: under the keys' cursor (F).
  chip(t, c, on) {
    const color = !c.ok ? t.blocked : c.field ? t[FIELD_TINT[c.field]] ?? t.muted : t.muted;
    return h_flex().id(`kk-chip-${c.i}`).flex_none().h(22).pl(8).pr(5).gap(5).items_center().rounded_full().border(1)
      .border_color(on ? alpha(t.accent, "99") : alpha(color, "66")).bg(on ? alpha(t.accent, "24") : alpha(color, "1a"))
      .text_color(color).cursor_pointer().hover((s) => s.bg(alpha(color, "33")))
      .tooltip(c.ok ? tr("chip.remove", { term: c.text }) : tr("filter.help"))
      .on_click((_e, cx) => { this.query = dropToken(this.query, c.i); this.reveal = true; cx.notify(); })
      .when(!c.ok, (el) => el.child(svg(I("circle-alert")).size(11).flex_none()))
      .child(div().font_family(MONO).text_size(10.5).when(c.neg, (el) => el.line_through()).child(c.text))
      .child(svg(I("x")).size(10).flex_none().text_color(t.dim));
  }

  // #35, the completion's list (kt-new's): a field (its icon) or a value, the highlighted row accented;
  // COMP_ROWS rows, then it scrolls; a click takes the row; its keys at the foot.
  compPanel(t, items) {
    const at = Math.min(this.compAt, items.length - 1);
    return v_flex().id("kk-comp").w(260).rounded(12).border(1).border_color(t.border).bg(t.popover)
      .child(v_flex().id("kk-comp-list").max_h(COMP_ROWS * 29 + 8).overflow_y_scroll().track_scroll(this.compScroll).p(4).gap(1)
        .children(items.map((it, i) => h_flex().id(`kk-comp-${i}`).h(28).px(10).gap(8).flex_none().items_center().rounded(8).cursor_pointer()
          .when(i === at, (el) => el.bg(alpha(t.accent, "24")))
          .hover((s) => s.bg(t.hover))
          .on_click((_e, cx) => { cx.stop_propagation(); this.query = it.query; this.compAt = 0; cx.notify(); })
          .child(div().flex_1().min_w(0).truncate().font_family(MONO).text_size(12).text_color(i === at ? t.accent : t.foreground).child(it.label)))))
      .child(div().px(12).py(6).border_t(1).border_color(t.border).font_family(MONO).text_size(10).text_color(t.dim).child(tr("comp.keys")));
  }

  // The hidden columns (GitHub Projects' « hidden columns »), at the board's end: how many, then each one,
  // its dot, its name and its cards' count; a click shows it again (the view's, as hiding it).
  hiddenStrip(t, b) {
    const gone = b.all.filter((k) => !b.keys.includes(k));
    return v_flex().id("kk-hidden").w(150).flex_none().ml(4).p(6).gap(2).rounded(16).border(1).border_dashed().border_color(t.border).bg(t.chrome)
      .child(h_flex().h(28).px(6).gap(6).items_center().text_color(t.dim)
        .child(svg(I("layers")).size(12).flex_none())
        .child(div().min_w(0).truncate().font_family(MONO).text_size(10).child(tr("hidden.title", { n: gone.length }).toUpperCase())))
      .children(gone.map((k) => h_flex().id(`kk-hid-${k}`).h(28).px(6).gap(7).items_center().rounded(8).cursor_pointer()
        .text_color(t.muted).hover((s) => s.bg(t.hover).text_color(t.foreground))
        .tooltip(tr("hidden.show", { name: this.colName(k), n: b.counts[k] ?? 0 }))
        .on_click((_e, cx) => { this.hidden = toggleHidden(this.hidden, k, b.all); this.reveal = true; cx.notify(); })
        .child(div().size(7).rounded(4).flex_none().bg(t[TINT[k]] ?? t.dim))
        .child(div().flex_1().min_w(0).truncate().text_size(12).child(this.colName(k)))
        .child(div().flex_none().font_family(MONO).text_size(10.5).text_color(t.dim).child(String(b.counts[k] ?? 0)))));
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
        // app has settled its own focus on the switch (unless pane.go already gave it), and only while no
        // overlay is open (herdr-app status' `overlays`; kanban.js takesFocus): a dialog or a popup that
        // opened meanwhile keeps the keyboard (else its Space would open the drawer under it).
        cx.timer.after(150, (cx) => {
          this.autoArchive(); // and what has gone quiet since
          cx.notify();
          if (!visible() || this.handle.is_focused()) return;
          cx.spawn(async (cx) => {
            const r = await exec("herdr-app", ["status"], { timeout: 3000 }).catch(() => null);
            let status = null;
            try { status = r?.code === 0 ? JSON.parse(r.stdout) : null; } catch { status = null; }
            if (!takesFocus({ visible: visible(), focused: this.handle.is_focused(), status })) return;
            this.focusIn();
            cx.notify();
          });
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
    // A draft kt-new launched: let it go, find its thread (landing).
    const rec = shared(LAUNCHED);
    if (rec?.draft && !checking()) this.landing(rec, all, cx);
    // The drafts (kanban.js draftsOf): cards with no agent, never archived.
    const drafts = draftsOf(shared(DRAFTS));
    // Every card by id: the drawer's (it may be out of the board's filter), the keys' actions on it.
    this.byId = new Map([...all, ...drafts].map((th) => [th.id, th]));
    // Auto-archive's proposal (archivePlan, pure): the threads already past their N days when it was taken
    // on, offered in the head; nothing settles without the click.
    const archiveDays = Number(shared("kt.opt.kt-kanban.archiveDays") ?? 7);
    const plan = archivePlan(all, { days: archiveDays, now, memo: shared(AUTO_ARCHIVED) });
    if (this.drawer && !this.byId.has(this.drawer)) this.drawer = this.drawerLast = null; // its tab closed
    const listed = [...onBoard(all, query.archived), ...drafts];
    // The column a draft lands in (Inactif, Sans flow): its head has the « + » of a new one.
    this.draftCol = (FIELDS[o.column] ?? FIELDS.status).of(draftThread({ id: "" }));
    const current = !shown ? null : model.isHome(shown, world) ? "home" : model.projectId(shown, world) ?? `space:${shown.id}`;
    const kept = listed.filter((th) => matchQuery(th, query, { now, current }));
    const pick = (this.pick = o.slice === "none" ? null : (shared(PICKS) ?? {})[o.slice] ?? null);
    const values = (this.sliceList = o.slice === "none" ? [] : slices(kept, o.slice, pick));
    const onIt = sliced(kept, o.slice, pick);
    if (vis && !checking()) for (const th of onIt) this.wantPr(th);
    this.colField = o.column === "phase" ? "phase" : "status"; // a column head's term (#35)
    // The values the filter's completion offers (#35): those of the board's threads, before the query.
    this.values = filterValues(listed);
    const b = (this.board = board(onIt, { field: o.column, group: o.group, sort: o.sort, pins: world.pins, firstSeen: world.firstSeen, registry: world.registry, folded: this.folded, hidden: this.hidden }));
    const focused = this.handle.is_focused();
    // The keyboard gone (a terminal clicked, ctrl-b t) while a tab was being renamed: the name stays as it
    // was. Only on that change, so the render right after startRename() doesn't end it before focus lands.
    if (this.renaming && this.keyed && !focused) this.renaming = null;
    // The same for a draft being typed, except that what was typed is kept.
    if (this.editing && this.keyed && !focused && !checking()) cx.spawn(async () => this.commitEdit());
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
      .on_click((_e, cx) => { this.handle.focus(); this.vim.edit(); this.editFilter(); cx.notify(); })
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
    // #35: the completion while a token is typed, under the field (gpui-base's Popup, as the card's menu),
    // COMP_ROWS rows at most, the rest scrolls.
    const comp = typing ? this.compOf() : [];
    const filterBox = comp.length ? Popup.new("kk-comp-pop", field).anchor("top_right").flex_none().content(this.compPanel(t, comp)) : field;
    // The terms as chips under the toolbar (kanban.js chipsOf), each in its field's color, one set aside in
    // the warning color (with the filter's help); a click, or x on the chip under the keys' cursor (F),
    // removes it.
    const chips = chipsOf(this.query, { typing });
    if (this.chipAt != null) this.chipAt = chips.length ? Math.min(this.chipAt, chips.length - 1) : null;
    const chipRow = chips.length > 0 && h_flex().id("kk-chips").flex_none().px(10).pb(8).gap(6).items_center().flex_wrap()
      .children(chips.map((c, j) => this.chip(t, c, focused && j === this.chipAt)));
    // The toolbar under the tabs: the five choices, then the filter. One line that scrolls sideways on a
    // narrow page (FILTERS.md).
    const tools = h_flex().id("kk-tools").flex_none().h(44).px(10).gap(6).items_center().overflow_x_scroll()
      .children(["column", "group", "slice", "sort", "density"].map((k) => this.choiceButton(t, k, o[k])))
      .child(div().flex_1().min_w(8))
      .child(filterBox);
    const head = v_flex().flex_none().rounded(16).border(1).border_color(t.border).bg(t.background)
      .child(this.band(t, tint, "Kanban", sub, [mode].filter(Boolean))) // i18n: tech
      .child(div().flex_none().h(0).border_t(1).border_dashed().border_color(alpha(tint, "4d")))
      .child(this.tabs(t))
      .child(div().flex_none().mx(10).h(0).border_t(1).border_dashed().border_color(t.border))
      .child(tools)
      .when(Boolean(chipRow), (el) => el.child(chipRow))
      .when(plan.propose.length > 0, (el) => el
        .child(div().flex_none().mx(10).h(0).border_t(1).border_dashed().border_color(t.border))
        .child(this.archiveOffer(t, plan.propose, archiveDays)));
    // The board: no group, the columns side by side (scrolling sideways once narrower than their 240 px
    // each; the cursor's column comes into view, its card then in column()); by project, the lanes. The
    // slice panel on its left.
    if (this.reveal && o.group !== "project") this.boardScroll.scroll_to_item(this.at.c);
    this.menuDrawn = false;
    this.density = o.density; // the cards' (card(), draftCard())
    this.inLanes = o.group === "project"; // a card unfolds at once there (card())
    const area = o.group === "project"
      ? this.lanes(t, b, cur, now, cx)
      : h_flex().id("kk-board").flex_1().min_w(0).h_full().gap(4).items_start().overflow_x_scroll().track_scroll(this.boardScroll)
        .children((b.lanes[0]?.cols ?? []).map((col, c) => this.column(t, col, c === this.at.c ? cur : null, now, cx)));
    // A menu whose card isn't drawn (filtered out, its lane folded, its tab closed) goes.
    if (this.menu && !this.menuDrawn) this.menu = null;
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
      .when(b.keys.length < b.all.length, (el) => el.child(this.hiddenStrip(t, b)))
      .child(drawer);
    // No frame of its own: the work card around it paints the background. Each arrival fades it in.
    return enter(m, v_flex().size_full().gap(4).text_color(t.foreground).child(head).child(main), `kk-page-${this.arrivals}`, { dy: 0 })
      .track_focus(this.handle)
      .on_key_down((e, cx) => this.key(e, cx));
  }
}
