// kbrdn Kanban (kt-kanban): kt-threads' threads as a board, GitHub Projects' Board view with what
// needs you first (the agent views' "Needs attention"). A view, not an editor: a thread's column is
// what its agent reports (Herdr's status), never a drop. Columns: Bloqué (blocked, waits on you),
// Fini non vu (done), En cours (working), Inactif (idle, or no agent), each with its count (rolling)
// and its own scroll. A card: the agent's live logo (companion-logo.js), the title, pinned / snoozed as
// the sidebar shows them, the age; the project (logo, else its letter on its color) and the branch
// (a worktree's icon in a linked one); the issue, the PR and its state, the cost (levels.js), the
// sub-agents k/n; claude-flow's step. It lists what the sidebar lists: the shown project or every one
// (shared "kt.project"), through the sidebar's filter (shared "kt.threadFilter": status, period,
// program; its archived view shows the archived), then the text typed after `/`. A click or enter:
// back to the thread, on that agent (agent.focus).
// Keys (vim.js; kt-keys lists them under Pages): h / l a column, j / k a card, gg / G, ctrl-d / u, /
// the filter (INSERT, esc: NORMAL), enter / o go, esc clears the filter, then back to the thread (as
// q), ? the keys. Arriving on the page takes the keyboard (NORMAL); ctrl-b h / l (pane.go, "focus")
// or `kt-kanban.key:<keys>` too.
// The "kanban" page of the layout's "view" stack. Its data: threads-model.js and threads-io.js (with
// thread-filter.js, pr-pick.js), byte-identical copies of kt-threads' (cmp), read only while the page
// shows (DATA-SYNC.md). The board's logic: kanban.js (kanban.check.mjs). Words: strings.js (I18N.md).

import { View, div, svg, image } from "gpui-kit";
import { v_flex, h_flex, ScrollHandle } from "gpui-base";
import { spaces, panes, run, theme, shared, layout, nextCommand, settings, exec, home, readTextFile, openOverlay, checking } from "herdr";
import * as fs from "fs/promises";
import * as model from "./threads-model.js";
import * as io from "./threads-io.js";
import { filterOf } from "./thread-filter.js";
import { longLived } from "./pr-pick.js";
import { columns, onBoard, matches, locate, move } from "./kanban.js";
import { companion } from "./companion-logo.js";
import { costLevel, levelColor } from "./levels.js";
import { Vim, keysOf } from "./vim.js";
import { motionState, frame, enter, sharpen, rows } from "./motion.js";
import { roll, rollText } from "./roll.js";
import { refreshOn } from "./bus.js";
import { ditherBand, ALL } from "./dither.js";
import { makeT, num as fnum } from "./i18n.js";
import strings from "./strings.js";

const tr = makeT(strings);
const MONO = "Monaspace Krypton";
const I = (name) => `mods/kt-threads/${name}.svg`;
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
    this.query = "";
    this.cur = null; // the keys' cursor: a thread id
    this.at = null; // where it last was, { c, i } (kanban.js locate)
    this.cols = [];
    // A column's key -> its ScrollHandle (made here: not during render). Another field's columns add theirs.
    this.scrolls = Object.fromEntries(model.STATUSES.map((k) => [k, ScrollHandle.new()]));
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
    cx.timer.every(15000, (cx) => { if (visible()) this.readReports(cx); });
    cx.timer.every(1500, (cx) => { if (visible()) this.lookup(cx); });
    // `focus` (pane.go) takes the keyboard in NORMAL; `key:<keys>` takes it and types those keys
    // ("l", "g g", "/ f i x"), for tests; `refresh` reads again.
    cx.spawn(async (cx) => {
      for (;;) {
        const c = await nextCommand();
        if (c === "focus") this.focusIn();
        else if (c.startsWith("key:")) {
          this.focusIn();
          for (const k of keysOf(c.slice(4))) this.act(this.vim.handle(k), cx);
        } else if (c === "refresh") this.refresh(cx);
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
    if (!this.act(this.vim.handle(e), cx)) return; // not ours: ctrl-b, cmd-* go on
    cx.stop_propagation();
    cx.notify();
  }

  // One vim action on the board; false: not one it has, and the key goes on.
  act(a, cx) {
    if (!a) return false;
    if (a === "pending" || a === "count" || a === "filter" || a === "normal") return true;
    const cols = this.cols;
    const at = this.at ?? { c: 0, i: -1 };
    if (a === "type" || a === "backspace") this.query = a === "type" ? this.query + this.vim.char : this.query.slice(0, -1);
    else if (["down", "up", "top", "bottom", "half-down", "half-up", "next", "prev", "left", "right", "tab-next", "tab-prev"].includes(a)) {
      this.at = move(cols, at, a, this.vim.count, PAGE_ROWS);
      this.cur = cols[this.at.c]?.threads[this.at.i]?.id ?? null;
      this.reveal = true;
    } else if (a === "open" || a === "submit") {
      const th = cols[at.c]?.threads[at.i];
      if (th) this.open(th);
    } else if (a === "escape" && this.query) this.query = "";
    else if (a === "escape" || a === "quit") {
      show("thread");
      this.toTerminal();
    } else if (a === "refresh") this.refresh(cx);
    else if (a === "help") openOverlay({ mod: "kt-keys", kind: "dialog", width: 1, height: 1, frame: "none", props: { group: "pages" } });
    else return false;
    return true;
  }

  // ---------- drawing ----------

  // The page's head (DESIGN-REFERENCE.md, Crosstalk's): 60 px over the dither of `tint`, a 32 px mark, the
  // title coming into focus (sharpen), a mono subtitle, the filter on the right. The whole head card:
  // the dither keeps off its four corners.
  band(t, tint, title, sub, right) {
    const w = this.bandW;
    return div().id("kk-band").relative().flex_none().h(60).overflow_hidden().rounded(15)
      .on_size_change((size, cx) => {
        if (Math.abs((this.bandW ?? 0) - size.width) < 0.5) return;
        this.bandW = size.width;
        cx.notify();
      })
      // Inside the card's 1 px border: its radius 16 less the border.
      .when(w > 30, (el) => el.child(ditherBand(w, 60, 15, alpha(tint, settings().dark ? "6b" : "4d"), ALL)))
      .child(h_flex().size_full().px(12).gap(10).items_center()
        .child(h_flex().size(32).flex_none().rounded(10).items_center().justify_center().border(1).border_color(alpha(tint, "4d")).bg(alpha(t.background, "e6"))
          .child(svg(I("square-kanban")).size(16).text_color(tint)))
        .child(v_flex().flex_1().min_w(0).gap(2)
          .child(sharpen(this.m, `kk-title:${title}`, () => div().truncate().text_size(14).font_semibold().text_color(t.foreground).child(title)))
          .child(sub))
        .children(right));
  }

  // The project's mark at `size`: Home's house, its registry logo, else its initial on its color.
  mark(t, p, size) {
    if (p.home) return svg(I("house")).size(size).flex_none().text_color(t.muted);
    if (p.logo) return image(p.logo).size(size).flex_none().rounded(3);
    return div().size(size).flex_none().rounded(3).bg(paint(t, p.color) ?? t.dim).flex().items_center().justify_center()
      .child(div().text_size(Math.round(size * 0.62)).font_semibold().text_color(t.chrome).child([...p.name][0]?.toUpperCase() ?? "?"));
  }

  // One card, ~240 px wide. `col` goes into every id: a card changing column is drawn twice for a moment
  // (its leaving copy in the old column, rows()). `gone`: that leaving copy, no longer a target.
  card(t, th, col, cursor, gone, now, cx) {
    const key = `${col}-${th.id}`;
    const muted = th.settled || th.asleep;
    const bridge = th.terminal ? this.live[th.terminal] : null;
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
    const look = th.pr ? PR[th.pr.state] ?? PR.OPEN : null;
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
        .child(div().flex_1().min_w(0).truncate().text_size(13).font_medium().text_color(muted ? t.muted : t.foreground).child(th.title))
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

  // A column (a card of radius 16, concentric with the work card; GitHub's board: a recessed lane, the
  // cards on the terminals' background): its head (the status' dot, its name, its count rolling), then
  // its cards, scrolling on their own, entering and leaving on their height (rows(), keyed by thread).
  // `cur`: the cursor's thread when it is in this column.
  column(t, col, cur, now, cx) {
    const tint = t[col.key] ?? t.dim;
    const scroll = this.scrolls[col.key];
    // scroll_to_item counts every child rows() gives, the leaving ones too.
    let k = 0;
    const cards = rows(this.m, cx, `kk-col-${col.key}`, col.threads, (th) => th.id, (th, i) => {
      if (i >= 0 && this.reveal && th.id === cur) {
        scroll.scroll_to_item(k);
        this.reveal = false;
      }
      k++;
      return div().w_full().pb(6).child(this.card(t, th, col.key, i >= 0 && th.id === cur, i < 0, now, cx));
    });
    const empty = this.query ? tr("noMatch") : tr(`empty.${col.key}`);
    return v_flex().id(`kk-lane-${col.key}`).flex_1().min_w(240).h_full().rounded(16).border(1).border_color(t.border).bg(t.chrome)
      .child(h_flex().flex_none().h(40).px(14).gap(8).items_center()
        .child(div().size(8).rounded(4).flex_none().bg(tint))
        .child(div().flex_none().text_size(13).font_medium().text_color(t.foreground).child(tr(`col.${col.key}`)))
        .child(roll(this.m, `kk-n-${col.key}`, String(col.threads.length), 14).font_family(MONO).text_size(11).text_color(t.dim))
        .child(div().flex_1()))
      .child(div().flex_none().h(0).border_t(1).border_dashed().border_color(alpha(tint, "4d")))
      .child(v_flex().id(`kk-list-${col.key}`).flex_1().min_h(0).overflow_y_scrollbar().track_scroll(scroll).p(6)
        .when(!cards.length, (el) => el.child(div().p(8).text_size(12.5).line_height("18px").text_color(t.dim).child(empty)))
        .children(cards));
  }

  render(cx) {
    const vis = visible();
    this.findRepos(cx);
    const t = theme();
    const m = (this.m = frame(this.motion, Boolean(shared("kt.reducedMotion"))));
    // What others change (DATA-SYNC.md): a commit, a branch, a PR made elsewhere, an agent that just
    // stopped (kt-threads' `agents`) asks the PR badges again. The first render records.
    if (!checking()) refreshOn(this, cx, "prs", ["git", "gh", "agents"], async (cx) => { this.asked = {}; cx.notify(); });
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
    // What the sidebar lists (threads-model.js): the shown project or every one, its filter, then `/`'s.
    const every = shared("kt.project") === "*";
    const shown = world.spaces.find((s) => s.active);
    const filter = filterOf(shared("kt.threadFilter"));
    const listed = onBoard(model.filtered(model.scoped(model.threadsOf(world), every ? null : shown, world.repos), filter, now), filter.archived);
    const kept = listed.filter((th) => matches(th, this.query.trim()));
    if (vis && !checking()) for (const th of kept) this.wantPr(th);
    const cols = (this.cols = columns(kept, "status", world.pins));
    const focused = (this.keyed = this.handle.is_focused());
    const typing = focused && this.vim.insert;
    this.at = locate(cols, this.cur, this.at);
    this.cur = cols[this.at.c]?.threads[this.at.i]?.id ?? null;
    const cur = focused ? this.cur : null;

    // The head: the scope (the shown project's color and name, Home muted, every project the accent).
    const home = shown && model.isHome(shown, world);
    const entry = shown && !home ? model.entryOf(shown, world.registry, world) : null;
    const tint = every || !shown ? t.accent : home ? t.muted
      : paint(t, entry?.color) ?? paint(t, model.spaceColorOf(shown, world.colors)) ?? t.accent;
    const scope = filter.archived ? tr("archived") : every || !shown ? tr("every") : home ? model.homeLabel(shown) : entry?.name ?? shown.name;
    const count = this.query.trim() ? tr("shownOf", { n: kept.length, total: listed.length }) : tr("threads", { n: listed.length });
    const sub = rollText(m, `kk-head-n-${every ? "*" : shown?.id ?? ""}`, `${scope} · ${count}`, 14).font_family(MONO).text_size(10.5).text_color(t.muted);
    const field = h_flex().id("kk-filter").w(240).flex_none().h(32).px(12).gap(8).items_center().rounded_full().border(1)
      .border_color(typing ? alpha(t.accent, "99") : t.border).bg(typing ? alpha(t.accent, "24") : alpha(t.background, "e6")).cursor_text()
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
    const head = v_flex().flex_none().rounded(16).border(1).border_color(t.border).bg(t.background)
      .child(this.band(t, tint, "Kanban", sub, [mode, field].filter(Boolean))); // i18n: tech
    // The board: the columns side by side, scrolling sideways once narrower than 4 × 240.
    const board = h_flex().id("kk-board").flex_1().min_h(0).gap(4).items_start().overflow_x_scroll()
      .children(cols.map((col, c) => this.column(t, col, c === this.at.c ? cur : null, now, cx)));
    // No frame of its own: the work card around it paints the background. Each arrival fades it in.
    return enter(m, v_flex().size_full().gap(4).text_color(t.foreground).child(head).child(board), `kk-page-${this.arrivals}`, { dy: 0 })
      .track_focus(this.handle)
      .on_key_down((e, cx) => this.key(e, cx));
  }
}
