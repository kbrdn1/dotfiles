// kt-hub: the home page (#46), the "hub" child of kbrdn-threads' "view" stack. It draws what the indexer
// (index.ts, #44) leaves in data/kt-hub/summary.json and computes nothing in render: model.js derives the
// week, the rankings, the projects and the year once per summary (and when the day changes).
// Sections: the header (the index's state, r), Now (the live agents, a click goes to the one to see),
// This week (six cards against the same days of the week before, their 8 weeks as bars), Activity (the
// year in plain squares, viz.calendar, ‹ year ›), the week's workflows and skills, its sub-agents, the
// projects (this week's most active first). #48: the year of GitHub instead of the agents' (tab). #49: one
// project's view, the shown space's unless kt.project is "*" (v switches to the global one): its worktrees
// (gwm), its week with its PRs (gh pr list) and what review and CI caught (~/Reports' recaps, the flows),
// its year, its PRs (a click opens the Inbox on one), its launches. #50: the tracked workflows (claude-flow's
// flows, each its path from the issue to the note), Next (who waits, the flows' next step, the plans'
// unblocked issues) and Recent (merges, vault notes, removed worktrees, sessions), on the right when wide.
// The indexer runs (exec, bun by its path: exec's PATH has no ~/.nix-profile): on the first show and on
// coming back after 60 s, the old summary staying shown; on the bus's "agents" while shown, 60 s apart at
// most (a bump in between waits for its turn); on r. A hidden copy doesn't render, so it doesn't hear
// the bus: it catches up when it shows. One 5 s tick while shown (the page left, a bump waiting, the day
// and the minute changing); none while hidden.
// Keys (vim.js): j / k gg / G the sections, [ / ] or h / l the year, tab the source (global view), v the
// view, r index (and the project's PRs and worktrees), ? kt-keys, q / esc back to the thread when there is one.
// Mod commands: kt-hub.focus, key:<keys>, refresh, year:<yyyy>, source:<agents|github>, scope:<auto|global>.

import { View, div, svg, image } from "gpui-kit";
import { v_flex, h_flex, ScrollHandle } from "gpui-base";
import { exec, readTextFile, writeTextFile, theme, spaces, agents, run, layout, home, appHome, checking, nextCommand, openOverlay, shared, setShared, settings, panes } from "herdr";
import { week, ranked, projectRows, year, years, now, delta, localDay, dayShift, familyOf } from "./model.js";
import { ghArgs, parseYear, stale, githubYear } from "./github.js";
import { keyOf as folderKey, projectWeek, projectYear, projectYears, weekPrs, weekChecks, prListArgs } from "./project.js";
import { PATH, path as flowPath, byWorkflow, nextFlows, nextPlanIssues, recentMerges, parseHistory } from "./recent.js";
import { makeT, num, date, time, relative, duration } from "./i18n.js";
import strings from "./strings.js";
import { Vim, keysOf, keyOf, step } from "./vim.js";
import { dither, iconBtn, bandRow } from "./band.js";
import { motionState, frame, enter } from "./motion.js";
import { skeleton } from "./skeleton.js";
import { viz, quartileLevels } from "./viz.js";
import { roll } from "./roll.js";
import { refreshOn } from "./bus.js";

const tr = makeT(strings);
const MONO = "Monaspace Krypton";
const I = (name) => `mods/kt-threads/${name}.svg`;
const SPIN = "mods/workspace-chrome/spinner.svg";
const alpha = (c, a) => `${String(c).slice(0, 7)}${a}`;
const parse = (s) => { try { return JSON.parse(s ?? ""); } catch { return null; } };
const AGAIN_MS = 60e3; // the indexer at most once a minute, unless r
const SECTIONS = ["now", "week", "act", "rank", "proj", "flows", "next", "recent"];
const RECENT_MS = 14 * 864e5; // #50: Next and Recent look two weeks back
const WIDE = 1300; // #50: Next and Recent in a column on the right from this width, under the rest below it
const P_SECTIONS = ["phead", "pweek", "pact", "pprs", "plaunch"]; // #49: one project's view
const STALE_MS = 3600e3; // a project's PRs (gh) and worktrees (gwm): asked again after an hour, or on r
const CARDS = ["s", "p", "a", "sub", "pr", "streak"];
const FAMILY = { workflow: "ansi4", loop: "ansi5", skill: "ansi2" };

function find(node, id) {
  if (node?.id === id) return node;
  for (const c of node?.children ?? []) {
    const f = find(c, id);
    if (f) return f;
  }
  return null;
}
// Shown: the "view" stack is on this page.
const visible = () => (find(layout(), "view")?.active ?? null) === "hub";
// A thread to go back to: a space with a tab.
const hasThread = () => spaces().some((s) => s.tabs?.length);

export default class Hub extends View {
  init(_props, cx) {
    this.handle = cx.focus_handle();
    this.vim = new Vim({ field: false });
    this.motion = motionState();
    this.scroll = ScrollHandle.new();
    this.sum = null; // summary.json
    this.d = null; // what model.js derived from it
    this.readError = null;
    this.running = false;
    this.ranAt = 0; // the last pass this copy started (0: none yet)
    this.waiting = false; // a bump of "agents" waits for its minute
    this.err = null; // error.json, when newer than the summary
    this.year = null;
    this.heat = new Map(); // year -> its levels, per summary
    // #48: the heatmap's source, and GitHub's years (data/kt-hub/github-<year>.json, read then asked).
    this.source = "agents";
    this.ghYear = new Date().getFullYear();
    this.gh = new Map(); // year -> { text, cache, view, tips } (text: the file as read, for writeTextFile)
    this.ghBusy = new Set();
    this.ghErr = null;
    // #49: the view (auto: the shown project unless kt.project is "*"; or global; or the project), the
    // folders' repos (git), each repo's worktrees (gwm) and PRs (gh), each project's year.
    this.scope = "auto";
    this.roots = new Map(); // folder -> repo root | null (undefined: being asked)
    this.side = new Map(); // project key -> { at, busy, prs, prErr, wts }
    this.pYear = new Map(); // project key -> its year shown
    this.pHeat = new Map(); // `${key}|${year}` -> its year and levels, per summary
    this.hist = null; // #50: `gwm history --all`, { at, list }, read while shown (5 min)
    this.cur = "now";
    this.reveal = false;
    this.width = 1000;
    this.headW = 0;
    this.shown = false;
    this.tick = null;
    this.minute = 0;
    if (checking()) return;
    this.load(cx);
    cx.spawn(async (cx) => {
      for (;;) {
        const c = await nextCommand();
        if (c === "focus") this.focusIn(cx);
        else if (c.startsWith("key:")) {
          this.focusIn(cx);
          for (const k of keysOf(c.slice(4))) this.press(k, cx);
        } else if (c === "refresh") this.index(cx, "commande");
        else if (c.startsWith("year:")) this.pickYear(Number(c.slice(5)));
        else if (c === "source:agents" || c === "source:github") this.setSource(c.slice(7), cx);
        else if (c === "scope:auto" || c === "scope:global" || c === "scope:project") this.setScope(c.slice(6));
        cx.notify();
      }
    });
  }

  // ---------- data ----------

  // summary.json (and error.json), then the model; a failed read keeps what was shown.
  load(cx) {
    cx.spawn(async (cx) => {
      const base = `${appHome()}/data/kt-hub`;
      const [text, errText] = await Promise.all([readTextFile(`${base}/summary.json`).catch(() => null), readTextFile(`${base}/error.json`).catch(() => null)]);
      const s = parse(text);
      if (s?.v === 1) { this.sum = s; this.readError = null; this.derive(); }
      else if (text != null) this.readError = "summary.json";
      const e = parse(errText);
      this.err = e?.at && e.at > (this.sum?.at ?? 0) ? e : null;
      cx.notify();
    });
  }

  derive() {
    const s = this.sum;
    const today = localDay(Date.now());
    const w = week(s.days, today);
    const ys = years(s);
    if (!ys.includes(this.year)) this.year = ys.at(-1) ?? null;
    this.heat.clear();
    this.pHeat.clear();
    const reg = shared("kt.projects");
    this.regKey = JSON.stringify(reg ?? null);
    this.d = { today, w, launches: ranked(s.days, w, "l"), subs: ranked(s.days, w, "sub"), rows: projectRows(s.projects, reg, w), years: ys };
  }

  // The year's levels (quartiles each side of the junction), once per summary and year; its weeks'
  // tooltips once each (dates are slow to write: 53 a render cost ~5 ms).
  heatOf(y) {
    if (!this.heat.has(y)) {
      const h = year(this.sum, y, this.d.today);
      this.heat.set(y, h ? { ...h, levels: quartileLevels(h.values, h.split), tips: new Map() } : null);
    }
    return this.heat.get(y);
  }

  // A week's tooltip (`word`: its sentence), written after the render that first asks for it (#50: 53
  // weeks of dates cost ~8 ms, too much for a first render already building the calendar): "" until then.
  weekTip(h, a, b, word = "act.week") {
    const key = `${a}|${tr("act.less")}`; // the language in the key: a switch writes them again
    const s = h.tips.get(key);
    if (s != null) return s;
    (this.tipQueue ??= []).push([h, a, b, word, key]);
    return "";
  }

  // The tooltips asked for in a render, written in a task right after it, then one redraw.
  writeTips(cx) {
    const q = this.tipQueue;
    this.tipQueue = null;
    if (!q?.length || checking()) return;
    cx.spawn(async (cx) => {
      for (const [h, a, b, word, key] of q) {
        if (h.tips.has(key)) continue;
        const n = h.values.slice(a, b + 1).reduce((x, v) => x + (v ?? 0), 0);
        h.tips.set(key, tr(word, { from: date(`${dayShift(h.start, a)}T12:00:00`), to: date(`${dayShift(h.start, b)}T12:00:00`), n: num(n) }));
      }
      cx.notify();
    });
  }

  // ---------- GitHub (#48) ----------

  // The years GitHub can show: this one and the four before.
  ghYears() {
    const y = new Date().getFullYear();
    return [y - 4, y - 3, y - 2, y - 1, y];
  }

  // A year of GitHub: its file first (once), then gh when it's stale (an hour this year, a day before),
  // only while the page shows it. A failed gh keeps what was shown and says it.
  ghLoad(cx, y) {
    if (checking() || this.ghBusy.has(y)) return;
    const had = this.gh.get(y);
    if (had && !stale(had.cache, y, Date.now())) return;
    this.ghBusy.add(y);
    cx.spawn(async (cx) => {
      const file = `${appHome()}/data/kt-hub/github-${y}.json`;
      try {
        let entry = had;
        if (!entry) {
          const text = await readTextFile(file).catch(() => null);
          const cache = parse(text);
          entry = { text, cache: cache?.v === 1 && cache.year === y ? cache : null };
          this.setGh(y, entry);
          cx.notify();
        }
        if (stale(entry.cache, y, Date.now()) && visible() && this.source === "github") {
          const r = await exec("gh", ghArgs(y), { timeout: 30e3 });
          const cache = r.code === 0 ? parseYear(r.stdout, y, Date.now()) : null;
          if (!cache) this.ghErr = (r.stderr.trim().split("\n")[0] || `gh ${r.code}`).slice(0, 160);
          else {
            const text = JSON.stringify(cache);
            // Replaced only if the file is still the one read (another copy may have written it).
            await writeTextFile(file, text, entry.text ?? null).catch(() => null);
            this.ghErr = null;
            this.setGh(y, { text, cache });
          }
        }
      } catch (e) {
        this.ghErr = String(e?.message ?? e).slice(0, 160);
      }
      this.ghBusy.delete(y);
      cx.notify();
    });
  }

  setGh(y, { text, cache }) {
    const view = cache ? githubYear(cache, localDay(Date.now())) : null;
    this.gh.set(y, { text, cache, view, tips: new Map() });
  }

  setSource(s, cx) {
    this.source = s;
    if (s === "github") this.ghLoad(cx, this.ghYear);
  }

  // ---------- one project (#49) ----------

  // The project the hub would show: none with « Tous les projets » (kt.project "*"), at Home, with no space
  // or on another machine; else the shown space's, by the registry (its folder holds the space's), else by
  // its repo (git, once per folder; a worktree climbs to its main checkout).
  candidate(cx) {
    if (!this.sum || shared("kt.project") === "*") return null;
    const s = spaces().find((x) => x.active);
    if (!s || s.machine || !s.folder || s.folder === home()) return null;
    const reg = (shared("kt.projects") ?? []).filter((r) => r && !r.machine && r.folder).map((r) => r.folder.replace(/\/+$/, ""));
    let key = folderKey(s.folder, reg);
    if (!key) {
      const root = this.rootOf(s.folder, cx);
      if (!root) return null;
      key = folderKey(root, reg) ?? root;
    }
    const entry = (shared("kt.projects") ?? []).find((r) => r?.folder?.replace(/\/+$/, "") === key) ?? null;
    const p = this.sum.projects?.[key] ?? null;
    return { key, p, entry, name: entry?.name ?? p?.name ?? key.split("/").pop(), slug: p?.slug ?? null, root: this.roots.get(s.folder) ?? key };
  }

  rootOf(folder, cx) {
    if (this.roots.has(folder)) return this.roots.get(folder) ?? null;
    if (checking()) return null;
    this.roots.set(folder, undefined);
    cx.spawn(async (cx) => {
      const r = await exec("git", ["rev-parse", "--path-format=absolute", "--git-common-dir"], { cwd: folder }).catch(() => ({ code: 1, stdout: "" }));
      const dir = r.code === 0 ? r.stdout.trim() : null;
      this.roots.set(folder, dir ? (dir.endsWith("/.git") ? dir.slice(0, -5) : dir) : null);
      cx.notify();
    });
    return null;
  }

  setScope(s) {
    this.scope = s === "project" ? "auto" : s;
    this.cur = null;
  }

  // A project's PRs of the week (gh) and its worktrees (gwm), once an hour while it shows, or on r.
  sideLoad(cx, pr, force = false) {
    if (checking() || !pr) return;
    const was = this.side.get(pr.key);
    if (was?.busy || (!force && was && Date.now() - was.at < STALE_MS)) return;
    const st = { at: Date.now(), busy: true, prs: was?.prs ?? null, prErr: null, wts: was?.wts ?? null };
    this.side.set(pr.key, st);
    cx.spawn(async (cx) => {
      const since = dayShift(this.d.w.from, -7);
      const [g, wt] = await Promise.all([
        pr.slug ? exec("gh", prListArgs(pr.slug, since), { timeout: 30e3 }).catch((e) => ({ code: -1, stdout: "", stderr: String(e?.message ?? e) })) : null,
        exec("gwm", ["list", "--format", "json", "--deny-bootstrap"], { cwd: pr.root, timeout: 20e3 }).catch(() => ({ code: -1, stdout: "" })),
      ]);
      if (g) {
        const list = g.code === 0 ? parse(g.stdout) : null;
        if (Array.isArray(list)) st.prs = list;
        else st.prErr = (g.stderr?.trim().split("\n")[0] || `gh ${g.code}`).slice(0, 160);
      }
      const w = wt.code === 0 ? parse(wt.stdout) : null;
      const all = Array.isArray(w) ? w : Array.isArray(w?.worktrees) ? w.worktrees : null;
      if (all) st.wts = all.filter((x) => !(x.is_main ?? x.main)).map((x) => x.branch ?? x.name ?? String(x.path ?? "").split("/").pop()).filter(Boolean);
      st.busy = false;
      cx.notify();
    });
  }

  // Its year (heat pairs to levels, quartiles each side of the junction), once per summary.
  pHeatOf(pr, y) {
    const k = `${pr.key}|${y}`;
    if (!this.pHeat.has(k)) {
      const h = projectYear(pr.p, y, this.sum, this.d.today);
      this.pHeat.set(k, { ...h, levels: quartileLevels(h.values, h.split), tips: new Map() });
    }
    return this.pHeat.get(k);
  }

  // #50: the worktrees gwm removed lately (its journal), every 5 min at most while the page shows.
  histLoad(cx) {
    if (checking() || this.histBusy || (this.hist && Date.now() - this.hist.at < 300e3)) return;
    this.histBusy = true;
    cx.spawn(async (cx) => {
      const r = await exec("gwm", ["history", "--all", "--limit", "8"], { cwd: home(), timeout: 15e3 }).catch(() => null);
      this.hist = { at: Date.now(), list: r?.code === 0 ? parseHistory(r.stdout) : this.hist?.list ?? [] };
      this.histBusy = false;
      cx.notify();
    });
  }

  openIssue(repo, n) {
    if (!repo || !n) return;
    setShared("kt.inbox.open", { repo, kind: "issue", number: Number(n), at: Date.now() });
    run("layout.select", { stack: "view", child: "inbox" });
  }

  openPr(slug, n) {
    if (!slug || !n) return;
    setShared("kt.inbox.open", { repo: slug, kind: "pr", number: n, at: Date.now() });
    run("layout.select", { stack: "view", child: "inbox" });
  }

  // One pass of the indexer; a pass running elsewhere (its lock) answers busy: its summary is read after.
  index(cx, why) {
    if (checking() || this.running) return;
    this.running = true;
    this.ranAt = Date.now();
    this.waiting = false;
    console.log(`kt-hub: index (${why})`);
    cx.spawn(async (cx) => {
      try {
        const r = await exec(`${home()}/.nix-profile/bin/bun`, [`${appHome()}/mods/kt-hub/index.ts`], { timeout: 600e3 });
        const out = parse(r.stdout.trim().split("\n").pop());
        if (r.code !== 0 && !out) this.err = { at: Date.now(), message: (r.stderr.trim().split("\n").pop() || `code ${r.code}`).slice(0, 200) };
      } catch (e) {
        this.err = { at: Date.now(), message: String(e?.message ?? e).slice(0, 200) };
      }
      this.running = false;
      this.load(cx);
      cx.notify();
    });
  }

  // The 5 s tick, only while shown: the page left (so its return reads again), a bump's turn, the day
  // and the minute (the clock, « il y a ») changing, the keyboard coming or going.
  startTick(cx) {
    if (this.tick) return;
    this.tick = cx.timer.every(5000, (cx) => {
      if (!visible()) {
        this.shown = false;
        this.tick?.cancel();
        this.tick = null;
        return;
      }
      if (this.waiting && Date.now() - this.ranAt >= AGAIN_MS) this.index(cx, "bus");
      if (this.source === "github") this.ghLoad(cx, this.ghYear); // asks gh only when stale
      if (this.d && localDay(Date.now()) !== this.d.today) this.derive();
      const minute = Math.floor(Date.now() / 60e3);
      if (minute !== this.minute || this.keyed !== this.handle.is_focused()) { this.minute = minute; cx.notify(); }
    });
  }

  async close() {
    this.tick?.cancel();
    this.tick = null;
  }

  pickYear(y) {
    if (this.d?.years.includes(y)) this.year = y;
  }

  // The shown source's year, one step back or forward (GitHub: asked when shown; a project: its own years).
  stepYear(by, cx) {
    const pr = this.pv;
    if (pr) {
      const ys = projectYears(pr.p, this.d.today);
      const i = ys.indexOf(this.pYear.get(pr.key) ?? ys.at(-1));
      if (i >= 0 && ys[i + by] != null) this.pYear.set(pr.key, ys[i + by]);
      return;
    }
    const gh = this.source === "github";
    const ys = gh ? this.ghYears() : this.d?.years ?? [];
    const i = ys.indexOf(gh ? this.ghYear : this.year);
    if (i < 0 || ys[i + by] == null) return;
    if (gh) {
      this.ghYear = ys[i + by];
      this.ghLoad(cx, this.ghYear);
    } else this.year = ys[i + by];
  }

  // ---------- actions ----------

  go(a) {
    if (!a) return;
    run("layout.select", { stack: "view", child: "thread" });
    run("agent.focus", { terminal: a.address });
  }

  leavePage() {
    if (!hasThread()) return;
    run("layout.select", { stack: "view", child: "thread" });
    const tab = spaces().find((s) => s.active)?.tabs.find((c) => c.active)?.id;
    const pane = panes().find((p) => p.tab === tab && p.focused)?.pane;
    if (pane) run("pane.focus", { pane });
  }

  // ---------- keys (vim.js; kt-keys lists them) ----------

  focusIn(cx) {
    this.handle.focus();
    this.vim.normal();
    if (visible()) this.startTick(cx);
  }

  key(e, cx) {
    if (!this.press(e, cx)) return;
    cx.stop_propagation();
    cx.notify();
  }

  press(k, cx) {
    // v: the view, global or the shown project (#49); v does nothing else in vim.js.
    if (keyOf(k).name === "v") {
      this.setScope(this.scope === "global" ? "auto" : "global");
      return true;
    }
    const a = this.vim.handle(k);
    if (!a) return false;
    if (a === "pending" || a === "count") return true;
    const secs = this.pv ? P_SECTIONS : SECTIONS;
    if (["down", "up", "top", "bottom", "half-down", "half-up"].includes(a)) {
      this.cur = secs[step(a, secs.indexOf(this.cur), secs.length, this.vim.count, 4)];
      this.reveal = true;
    } else if (a === "panel-prev" || a === "left") this.stepYear(-1, cx);
    else if (a === "panel-next" || a === "right") this.stepYear(1, cx);
    else if ((a === "tab-next" || a === "tab-prev") && !this.pv) this.setSource(this.source === "github" ? "agents" : "github", cx);
    else if (a === "open" && this.cur === "now") this.go(now(agents()).go);
    else if (a === "refresh") {
      this.index(cx, "r");
      if (this.pv) this.sideLoad(cx, this.pv, true);
    }
    else if (a === "help") openOverlay({ mod: "kt-keys", kind: "dialog", width: 1, height: 1, frame: "none", props: { group: "pages" } });
    else if (a === "quit" || a === "escape") this.leavePage();
    else return false;
    return true;
  }

  // ---------- pieces ----------

  card(t) {
    return v_flex().min_h(0).rounded(16).border(1).border_color(t.border).bg(t.background);
  }

  // A section: its name on a dashed rule (the cursor's ring while the page has the keyboard), its right
  // side, its body.
  section(t, id, label, right, body) {
    const on = this.keyed && this.cur === id;
    return v_flex().id(`hub-sec-${id}`).mx(4).px(8).pt(10).pb(8).gap(8).rounded(14).border(1)
      .border_color(on ? alpha(t.accent, "99") : alpha(t.border, "00"))
      .child(h_flex().gap(10).items_center()
        .child(div().flex_none().font_family(MONO).text_size(11).text_color(t.muted).child(String(label).toUpperCase()))
        .child(div().flex_1().h(0).border_t(1).border_dashed().border_color(t.border))
        .children([right].flat().filter(Boolean)))
      .child(body);
  }

  muted(t, text) {
    return div().text_size(12.5).text_color(t.dim).child(text);
  }

  // ---------- header ----------

  header(t) {
    const s = this.sum;
    const at = Date.now();
    const state = this.running ? (s ? tr("index.running") : tr("index.first"))
      : this.err ? tr("index.failed", { ago: relative(this.err.at), error: this.err.message })
        : this.readError ? tr("index.unreadable", { error: this.readError })
          : s?.pass ? tr("index.fresh", { ago: relative(s.pass.at) }) : tr("index.never");
    const refresh = this.running
      ? div().id("hub-b-running").size(28).flex_none().flex().items_center().justify_center().tooltip(tr("tip.running"))
        .child(svg(SPIN).size(14).spin(900).text_color(t.muted))
      : iconBtn(t, "hub-b-refresh", I("refresh-cw"), tr("tip.refresh"), (cx) => this.index(cx, "bouton"));
    // #49: Global or the shown project (v), when there is one; the band takes the project's color.
    const cand = this.cand;
    const tint = this.pv ? this.colorOf(t, this.pv.entry) : t.accent;
    const seg = cand ? h_flex().flex_none().h(28).p(2).gap(2).items_center().rounded_full().border(1).border_color(t.border).bg(t.raised)
      .children([["global", tr("view.global"), null], ["auto", cand.name, cand]].map(([k, label, pr]) => {
        const on = k === "global" ? !this.pv : Boolean(this.pv);
        return h_flex().id(`hub-scope-${k}`).h(22).px(10).gap(6).items_center().rounded_full().text_size(12)
          .text_color(on ? t.foreground : t.muted).when(on, (el) => el.bg(alpha(pr ? this.colorOf(t, pr.entry) : t.accent, "33")))
          .when(!on, (el) => el.cursor_pointer().hover((s) => s.bg(t.hover)))
          .tooltip(tr("view.tip")).on_click((_e, cx) => { cx.stop_propagation(); this.setScope(k); cx.notify(); })
          .child(pr ? div().max_w(160).truncate().child(label) : label);
      })) : null;
    return this.card(t).id("hub-head").relative().flex_none().px(4).pb(4)
      .on_size_change((x, cx) => { if (x.width !== this.headW) { this.headW = x.width; cx.notify(); } })
      .children([dither(this.headW, 60, 16, tint)].filter(Boolean))
      .child(bandRow(t, { m: this.m, color: tint, icon: I("house"), title: this.pv ? tr("titleProject", { name: this.pv.name }) : tr("title"),
        dot: this.running ? t.working : this.err ? t.ansi1 : null,
        sub: [`${date(at)} · ${time(at)}`, state],
        buttons: [seg, refresh] }));
  }

  // A registry entry's color (a theme name or #hex), else the accent.
  colorOf(t, e) {
    const c = e?.color;
    return c ? (c.startsWith("#") ? c : t[c] ?? t.accent) : t.accent;
  }

  // ---------- now ----------

  nowSection(t) {
    const n = now(agents());
    const parts = [n.working && tr("now.working", { n: n.working }), n.blocked && tr("now.blocked", { n: n.blocked }), n.done && tr("now.done", { n: n.done })].filter(Boolean);
    const dot = n.blocked ? t.blocked : n.done ? t.done : n.working ? t.working : t.dim;
    const line = h_flex().gap(10).items_center().px(4)
      .child(n.working ? svg(SPIN).size(12).flex_none().spin(900).text_color(t.working)
        : div().size(8).flex_none().rounded_full().bg(dot).when(n.blocked > 0, (el) => el.loop("opacity", { from: 0.3, to: 1, period: 1200 })))
      .child(div().flex_1().min_w(0).truncate().text_size(13.5).text_color(parts.length ? t.foreground : t.muted).child(parts.length ? parts.join(" · ") : tr("now.none")))
      .when(Boolean(n.go), (el) => el.child(h_flex().id("hub-now-go").flex_none().h(26).px(10).gap(6).items_center().rounded_full()
        .border(1).border_color(alpha(dot, "66")).bg(alpha(dot, "14")).text_size(12).text_color(t.foreground).cursor_pointer()
        .hover((s) => s.bg(alpha(dot, "24"))).tooltip(tr("now.goTip", { name: n.go.tab_name || n.go.space_name || n.go.address }))
        .on_click((_e, cx) => { cx.stop_propagation(); this.go(n.go); })
        .child(tr("now.go")).child(svg(I("chevron-right")).size(12))));
    return this.section(t, "now", tr("now.title"), null, line);
  }

  // ---------- this week ----------

  // Eight weeks as bars, the last (this week so far) in the accent.
  bars(t, values, w, color) {
    const max = Math.max(1, ...values);
    const gap = 3;
    const bw = Math.max(2, Math.floor((w - gap * (values.length - 1)) / values.length));
    return h_flex().h(24).gap(gap).items_end().children(values.map((v, i) =>
      div().w(bw).h(Math.max(2, Math.round((v / max) * 24))).rounded(2).bg(i === values.length - 1 ? color : alpha(color, v ? "59" : "26"))));
  }

  statCard(t, k, cw) {
    const { w } = this.d;
    const s = this.sum;
    const inner = cw - 24;
    const value = (x) => (k === "a" ? duration(x) : num(x));
    let main, detail, d = null, series = null, tip;
    if (k === "streak") {
      main = tr("streak.days", { n: s.streak?.cur ?? 0 });
      detail = tr("streak.best", { n: s.streak?.best ?? 0 });
      tip = tr("tip.streak", { best: s.streak?.best ?? 0 });
    } else {
      main = value(w.now[k]);
      d = delta(w.now[k], w.before[k]);
      detail = d === 0 ? tr("week.same") : d == null && w.now[k] ? tr("week.new") : tr("week.vs");
      if (d === 0) d = null;
      series = w.trend.map((x) => (k === "a" ? Math.round(x[k] / 36e5) : x[k]));
      tip = tr(`tip.${k}`, { mg: num(w.now.mg) });
    }
    const pct = d == null ? null : `${d >= 0 ? "+" : "−"}${tr("pct", { n: Math.abs(d) })}`;
    return v_flex().id(`hub-card-${k}`).w(cw).flex_none().p(12).gap(8).rounded(12).border(1).border_color(t.border).bg(t.raised).tooltip(tip)
      .child(this.V.stat(tr(`card.${k}`), main, { delta: pct, detail, better: "higher", width: inner, id: `hub-st-${k}` }))
      .when(Boolean(series), (el) => el.child(this.bars(t, series, inner, t.accent)));
  }

  weekSection(t) {
    const W = this.width - 24;
    const cols = W >= 1050 ? 3 : 2;
    const cw = Math.floor((W - 8 * (cols - 1)) / cols);
    return this.section(t, "week", tr("week.title"), div().flex_none().text_size(11).text_color(t.dim).child(tr("week.sub")),
      h_flex().flex_wrap().gap(8).children(CARDS.map((k) => this.statCard(t, k, cw))));
  }

  // ---------- activity ----------

  actSection(t) {
    const gh = this.source === "github";
    const ys = gh ? this.ghYears() : this.d.years;
    const shownYear = gh ? this.ghYear : this.year;
    const i = ys.indexOf(shownYear);
    const arrow = (id, icon, tip, by, on) => div().id(id).size(24).flex_none().rounded_full().flex().items_center().justify_center()
      .text_color(on ? t.muted : t.dim).when(!on, (el) => el.opacity(0.4))
      .when(on, (el) => el.cursor_pointer().hover((s) => s.bg(t.hover).text_color(t.foreground)).tooltip(tip)
        .on_click((_e, cx) => { cx.stop_propagation(); this.stepYear(by, cx); cx.notify(); }))
      .child(svg(I(icon)).size(13));
    // The source (#48): Agents or GitHub, one at a time (tab), as pale pills (FILTERS.md).
    const pill = (key, label, tint) => {
      const on = this.source === key;
      return h_flex().id(`hub-src-${key}`).h(22).px(8).gap(5).items_center().rounded_full().border(1)
        .border_color(on ? alpha(tint, "66") : alpha(tint, "00")).bg(alpha(tint, on ? "33" : "14"))
        .font_family(MONO).text_size(10.5).text_color(on ? t.foreground : t.muted).cursor_pointer()
        .when(!on, (el) => el.hover((s) => s.bg(alpha(tint, "24")))).tooltip(tr("act.sourceTip"))
        .on_click((_e, cx) => { cx.stop_propagation(); this.setSource(key, cx); cx.notify(); })
        .child(div().size(6).rounded_full().bg(tint)).child(label);
    };
    const right = h_flex().flex_none().gap(4).items_center()
      .child(pill("agents", tr("act.agents"), t.accent))
      .child(pill("github", "GitHub", t.ansi2)) // i18n: tech
      .child(div().w(6))
      .child(arrow("hub-y-prev", "chevron-left", tr("act.prev"), -1, i > 0))
      .child(div().font_family(MONO).text_size(12).text_color(t.foreground).child(String(shownYear ?? "")))
      .child(arrow("hub-y-next", "chevron-right", tr("act.next"), 1, i >= 0 && i < ys.length - 1));
    if (gh) return this.section(t, "act", tr("act.title"), right, this.ghBody(t));
    const h = this.year != null ? this.heatOf(this.year) : null;
    if (!h) return this.section(t, "act", tr("act.title"), right, this.V.calendar([], {}));
    const junction = this.sum.junction;
    const cal = this.V.calendar(h.levels, {
      start: h.start, months: tr("act.months").split(" "), weekdays: tr("act.weekdays").split(" "), legend: [tr("act.less"), tr("act.more")],
      mark: h.split > 0 ? h.split : null, markTip: junction ? tr("act.mark", { date: date(`${junction}T12:00:00`, { year: true }) }) : null,
      tip: (a, b) => this.weekTip(h, a, b),
      id: `hub-cal-${this.year}`,
    });
    return this.section(t, "act", tr("act.title"), right, v_flex().gap(6)
      .child(div().font_family(MONO).text_size(11).text_color(t.muted).child(tr("act.total", { active: num(h.active), sessions: num(h.sessions) })))
      .child(cal));
  }

  // GitHub's year (#48): its own levels, its total and the private contributions it counts without
  // detail; before its first read, a bar breathing; gh failing, said under what was shown.
  ghBody(t) {
    const y = this.ghYear;
    const e = this.gh.get(y);
    const v = e?.view;
    const err = this.ghErr ? div().text_size(12).text_color(t.ansi1).child(tr("act.ghError", { error: this.ghErr })) : null;
    if (!v) {
      const S = skeleton(t, this.m);
      return v_flex().gap(6).children([err ?? (e && !this.ghBusy.has(y) ? this.muted(t, tr("act.ghNone")) : S.pulse(S.block(null, 120).id("hub-gh-sk")))]);
    }
    const tip = (a, b) => this.weekTip({ values: v.values, start: v.start, tips: e.tips }, a, b, "act.ghWeek");
    const cal = this.V.calendar(v.levels, { start: v.start, months: tr("act.months").split(" "), weekdays: tr("act.weekdays").split(" "),
      legend: [tr("act.less"), tr("act.more")], tip, color: "ansi2", id: `hub-gh-${y}` });
    return v_flex().gap(6)
      .child(h_flex().gap(8).items_center().font_family(MONO).text_size(11).text_color(t.muted)
        .child(div().child(tr("act.ghTotal", { n: num(v.total), active: num(v.active) })))
        .when(v.restricted > 0, (el) => el.child(div().id("hub-gh-private").text_color(t.dim).tooltip(tr("act.ghPrivateTip"))
          .child(tr("act.ghPrivate", { n: num(v.restricted) }))))
        .child(div().flex_1())
        .child(div().text_color(t.dim).child(this.ghBusy.has(y) ? tr("act.ghReading") : tr("act.ghAt", { ago: relative(e.cache.at) }))))
      .child(cal)
      .when(Boolean(err), (el) => el.child(err));
  }

  // ---------- this week's launches and sub-agents ----------

  rankRows(t, list, colorOf, emptyText) {
    if (!list.length) return this.muted(t, emptyText);
    const max = Math.max(...list.map((x) => x.n));
    return v_flex().gap(4).children(list.slice(0, 8).map((x) => {
      const c = colorOf(x);
      const d = x.n - x.prev;
      return h_flex().id(`hub-r-${x.family ?? "sub"}-${x.name}`).h(22).gap(8).items_center().tooltip(tr("rank.tip", { name: x.name, n: x.n, prev: x.prev }))
        .child(div().size(6).flex_none().rounded_full().bg(c))
        .child(div().flex_1().min_w(0).truncate().font_family(MONO).text_size(11.5).text_color(t.foreground).child(x.name))
        .child(div().w(80).h(6).flex_none().rounded(3).bg(alpha(c, "1f")).child(div().h_full().rounded(3).bg(alpha(c, "b3")).w(Math.max(3, Math.round((x.n / max) * 80)))))
        .child(div().w(28).flex_none().flex().justify_end().font_family(MONO).text_size(11.5).text_color(t.foreground).child(num(x.n)))
        .child(div().w(30).flex_none().flex().justify_end().font_family(MONO).text_size(10).text_color(d > 0 ? t.ansi2 : d < 0 ? t.ansi1 : t.dim)
          .child(d ? `${d > 0 ? "+" : "−"}${Math.abs(d)}` : "="));
    }));
  }

  // The week's launches (workflows, loops, skills; Claude Code's own commands on one line under them)
  // beside its sub-agents by type, under each other when narrow.
  rankSection(t) {
    const all = this.d.launches;
    const work = all.filter((x) => x.family !== "command");
    const cmds = all.filter((x) => x.family === "command");
    const legend = h_flex().flex_none().gap(10).items_center().children(["workflow", "loop", "skill"].map((f) => h_flex().gap(4).items_center()
      .font_family(MONO).text_size(10.5).text_color(t.dim).child(div().size(6).rounded_full().bg(t[FAMILY[f]])).child(tr(`fam.${f}`))));
    const launches = v_flex().flex_1().min_w(0).gap(4)
      .child(this.rankRows(t, work, (x) => t[FAMILY[x.family]] ?? t.accent, tr("launch.none")))
      .when(cmds.length > 0, (el) => el.child(div().pt(2).truncate().font_family(MONO).text_size(10.5).text_color(t.dim)
        .child(tr("launch.commands", { list: cmds.slice(0, 6).map((x) => `/${x.name} ${x.n}`).join(" · ") }))));
    const subs = v_flex().flex_1().min_w(0).gap(6)
      .child(div().font_family(MONO).text_size(11).text_color(t.muted).child(tr("sub.title").toUpperCase()))
      .child(this.rankRows(t, this.d.subs, () => t.ansi6, tr("sub.none")));
    const wide = this.width >= 900;
    return this.section(t, "rank", tr("launch.title"), legend, (wide ? h_flex().items_start().gap(24) : v_flex().gap(14)).child(launches).child(subs));
  }

  // ---------- projects ----------

  tile(t, r) {
    const box = div().size(20).flex_none().rounded(6).flex().items_center().justify_center().overflow_hidden();
    if (r.kind === "home") return box.bg(t.raised).border(1).border_color(t.border).child(svg(I("house")).size(12).text_color(t.muted));
    const l = r.entry?.logos;
    const logo = l ? (settings().dark ? (l.dark ?? l.light) : (l.light ?? l.dark)) : null;
    if (logo) return box.child(image(logo).size(18));
    const c = r.entry?.color;
    const fill = c ? (c.startsWith("#") ? c : t[c] ?? t.dim) : t.dim;
    const name = r.kind === "other" ? "?" : r.name;
    return box.bg(alpha(fill, r.entry ? "ff" : "66")).child(div().font_family(MONO).font_bold().text_size(11).text_color(t.chrome).child(([...name][0] ?? "?").toUpperCase()));
  }

  projRow(t, r) {
    const name = r.kind === "other" ? tr("proj.other") : r.name;
    const max = Math.max(1, ...r.spark);
    const color = r.entry?.color ? (r.entry.color.startsWith("#") ? r.entry.color : t[r.entry.color] ?? t.accent) : t.accent;
    return h_flex().id(`hub-p-${r.key}`).h(34).px(4).gap(10).items_center().rounded(10).hover((s) => s.bg(t.hover))
      .child(this.tile(t, r))
      .child(h_flex().flex_1().min_w(0).gap(8).items_center()
        .child(div().min_w(0).truncate().text_size(13).text_color(r.s ? t.foreground : t.muted).child(name))
        .when(!r.entry && (r.kind === "repo" || r.kind === "gh"), (el) => el.child(div().flex_none().h(16).px(6).flex().items_center().rounded_full()
          .border(1).border_color(t.border).font_family(MONO).text_size(9.5).text_color(t.dim).child(tr("proj.unlisted")))))
      .child(h_flex().id(`hub-ps-${r.key}`).flex_none().h(18).gap(2).items_end().tooltip(tr("proj.sparkTip", { list: r.spark.join(" · ") }))
        .children(r.spark.map((v, i) => div().w(5).h(Math.max(2, Math.round((v / max) * 18))).rounded(1)
          .bg(i === r.spark.length - 1 ? color : alpha(color, v ? "66" : "26")))))
      .child(div().w(150).flex_none().flex().justify_end().font_family(MONO).text_size(11).text_color(r.s ? t.foreground : t.dim)
        .child(tr("proj.week", { s: num(r.s), a: duration(r.a * 1000) })))
      .child(div().w(46).flex_none().flex().justify_end().font_family(MONO).text_size(11).text_color(r.pr ? t.foreground : t.dim).child(tr("proj.prs", { n: r.pr })))
      .when(this.width >= 760, (el) => el.child(div().w(110).flex_none().flex().justify_end().text_size(11).text_color(t.dim)
        .child(r.last ? tr("proj.last", { ago: relative(r.last) }) : "")));
  }

  projSection(t) {
    const rows = this.d.rows.slice(0, 14);
    return this.section(t, "proj", tr("proj.title"), null,
      rows.length ? v_flex().gap(2).children(rows.map((r) => this.projRow(t, r))) : this.muted(t, tr("proj.none")));
  }

  // ---------- flows, Next, Recent (#50) ----------

  // A line that opens something (the Inbox, an agent, a file): its dot, its text, its time on the right.
  line(t, id, color, text, right, onClick, tip) {
    return h_flex().id(id).h(26).px(4).gap(8).items_center().rounded(8).cursor_pointer().hover((s) => s.bg(t.hover))
      .when(Boolean(tip), (el) => el.tooltip(tip)).on_click((_e, cx) => { cx.stop_propagation(); onClick(cx); })
      .child(div().size(6).flex_none().rounded_full().bg(color))
      .child(div().flex_1().min_w(0).truncate().text_size(12.5).text_color(t.foreground).child(text))
      .when(right != null, (el) => el.child(div().flex_none().font_family(MONO).text_size(10.5).text_color(t.dim).child(right)));
  }

  sub(t, text) {
    return div().pt(4).font_family(MONO).text_size(10).text_color(t.dim).child(String(text).toUpperCase());
  }

  // The flows of claude-flow (archived by the indexer): by workflow, how many merged and noted and where the
  // open ones stand; then the latest, each its path from the issue to the note (viz.steps).
  flowsSection(t) {
    const since = Date.now() - RECENT_MS;
    const groups = byWorkflow(this.sum.flows, since);
    if (!groups.length) return this.section(t, "flows", tr("flows.title"), null, this.muted(t, tr("flows.none")));
    const words = Object.fromEntries(PATH.map((s) => [s, tr(`step.${s}`)]));
    const latest = (this.sum.flows ?? []).filter((f) => (f.seen ?? 0) >= since).sort((a, b) => b.seen - a.seen).slice(0, 6);
    const W = Math.max(240, Math.min(520, Math.floor((this.width >= WIDE ? this.width - 420 : this.width) * 0.45)));
    return this.section(t, "flows", tr("flows.title"), null, v_flex().gap(6)
      .children(groups.map((g) => h_flex().gap(8).items_center().font_family(MONO).text_size(11)
        .child(div().flex_none().text_color(t.foreground).child(g.workflow ?? "—"))
        .child(div().flex_1().min_w(0).truncate().text_color(t.muted).child([tr("flows.count", { n: g.total, merged: g.merged, noted: g.noted }),
          ...Object.entries(g.open).map(([s, n]) => tr("flows.at", { step: words[s] ?? s, n }))].join(" · ")))))
      .child(this.sub(t, tr("flows.latest")))
      .children(latest.map((f) => h_flex().id(`hub-fl-${f.key}`).gap(12).items_center().py(2)
        .child(div().id(`hub-fl-${f.key}-n`).w(170).flex_none().truncate().font_family(MONO).text_size(11).text_color(t.foreground).cursor_pointer()
          .hover((s) => s.text_color(t.accent)).tooltip(tr("flows.open"))
          .on_click((_e, cx) => { cx.stop_propagation(); this.openIssue(f.repo, f.issue); })
          .child(`${String(f.repo ?? "").split("/").pop()}#${f.issue ?? "?"}`)) // i18n: tech
        // The paths come a render later (stepsOk): six steps' geometry on the render that brings the
        // page's data took it near the ~50 ms a render has. Until then, the step reached, in words.
        .child(div().flex_1().min_w(0).child(this.stepsOk
          ? this.V.steps(flowPath(f).map((s) => ({ label: words[s.id], state: s.state })), { width: W, id: `hub-fl-${f.key}-steps` })
          : div().h(30).font_family(MONO).text_size(10.5).text_color(t.dim).child(words[flowPath(f).filter((s) => s.state === "done").at(-1)?.id] ?? ""))))));
  }

  // Next: who waits for you (live), the open flows' next step, the plans' unblocked issues.
  nextSection(t) {
    const since = Date.now() - RECENT_MS;
    const blocked = agents().filter((a) => a.status === "blocked");
    const flows = nextFlows(this.sum.flows, since).slice(0, 6);
    const issues = nextPlanIssues(this.sum.plans).slice(0, 6);
    const kids = [];
    if (blocked.length) kids.push(this.sub(t, tr("next.blocked")), ...blocked.slice(0, 6).map((a) =>
      this.line(t, `hub-nx-a-${a.address}`, t.blocked, a.tab_name || a.space_name || a.address, null, () => this.go(a), tr("now.goTip", { name: a.tab_name || a.address }))));
    if (flows.length) kids.push(this.sub(t, tr("next.flows")), ...flows.map((f) =>
      this.line(t, `hub-nx-f-${f.key}`, t.ansi4, `${String(f.repo ?? "").split("/").pop()}#${f.issue ?? "?"}`, f.next ? tr(`step.${f.next}`) : "", () => this.openIssue(f.repo, f.issue), tr("flows.open"))));
    if (issues.length) kids.push(this.sub(t, tr("next.plans")), ...issues.map((i) =>
      this.line(t, `hub-nx-i-${i.repo}-${i.n}`, t.ansi3, `#${i.n} ${i.title}`, i.plan, () => this.openIssue(i.repo, i.n), tr("flows.open"))));
    return this.section(t, "next", tr("next.title"), null, kids.length ? v_flex().gap(2).children(kids) : this.muted(t, tr("next.none")));
  }

  // Recent: the merges, the vault's notes, the worktrees gwm removed, the sessions of these days.
  recentSection(t) {
    const since = Date.now() - RECENT_MS;
    const merges = recentMerges(this.sum.flows, this.sum.reports, since).slice(0, 6);
    const notes = (this.sum.notes ?? []).slice(0, 6);
    const removed = (this.hist?.list ?? []).slice(0, 5);
    const sessions = (this.sum.sessions ?? []).slice(0, 6);
    const kids = [];
    if (merges.length) kids.push(this.sub(t, tr("recent.merges")), ...merges.map((x) =>
      this.line(t, `hub-rc-m-${x.repo}-${x.pr}`, t.ansi5, x.title ? `#${x.pr} ${x.title}` : `${x.repo}#${x.pr}`, relative(x.at, { bare: true }), () => this.openPr(x.repo, x.pr), tr("proj.prTip"))));
    if (notes.length) kids.push(this.sub(t, tr("recent.notes")), ...notes.map((n) =>
      this.line(t, `hub-rc-n-${n.path}`, t.ansi6, n.title, relative(n.at, { bare: true }), () => exec("open", [n.path]).catch(() => {}), tr("recent.noteTip", { where: n.vault }))));
    if (removed.length) kids.push(this.sub(t, tr("recent.worktrees")), ...removed.map((w, i) =>
      h_flex().id(`hub-rc-w-${i}`).h(22).px(4).gap(8).items_center().child(div().size(6).flex_none().rounded_full().bg(t.dim))
        .child(div().flex_1().min_w(0).truncate().font_family(MONO).text_size(11).text_color(t.muted).child(w.name))
        .child(div().flex_none().font_family(MONO).text_size(10.5).text_color(t.dim).child(w.age))));
    if (sessions.length) kids.push(this.sub(t, tr("recent.sessions")), ...sessions.map((s) =>
      h_flex().id(`hub-rc-s-${s.sid}`).h(22).px(4).gap(8).items_center().child(div().size(6).flex_none().rounded_full().bg(t.idle ?? t.dim))
        .child(div().flex_1().min_w(0).truncate().text_size(12).text_color(t.foreground).child(s.title || tr("recent.untitled")))
        .child(div().flex_none().max_w(120).truncate().font_family(MONO).text_size(10.5).text_color(t.dim).child(s.project ?? ""))
        .child(div().flex_none().font_family(MONO).text_size(10.5).text_color(t.dim).child(relative(s.last, { bare: true })))));
    return this.section(t, "recent", tr("recent.title"), null, kids.length ? v_flex().gap(2).children(kids) : this.muted(t, tr("recent.none")));
  }

  // ---------- one project (#49) ----------

  // Its head: the registry's mark, its repo, its open worktrees (gwm).
  pHead(t, pr) {
    const side = this.side.get(pr.key);
    const wts = side?.wts;
    const tileRow = { kind: pr.p?.kind ?? "repo", entry: pr.entry, name: pr.name };
    return this.section(t, "phead", tr("proj.head"), null, h_flex().gap(10).items_center().px(4)
      .child(this.tile(t, tileRow))
      .child(v_flex().flex_1().min_w(0).gap(2)
        .child(div().truncate().text_size(13.5).text_color(t.foreground).child(pr.name))
        .child(div().truncate().font_family(MONO).text_size(10.5).text_color(t.muted).child([pr.slug, pr.root.replace(home(), "~")].filter(Boolean).join(" · "))))
      .child(div().flex_none().max_w(420).truncate().font_family(MONO).text_size(11).text_color(wts?.length ? t.foreground : t.dim)
        .child(wts == null ? (side?.busy ? tr("proj.wtReading") : "") : wts.length ? tr("proj.wts", { n: wts.length, list: wts.slice(0, 4).join(", ") }) : tr("proj.wtNone"))));
  }

  pCard(t, id, cw, name, main, { d = null, detail = "", tip = "", better = "higher" } = {}) {
    const pct = d == null || d === 0 ? null : `${d > 0 ? "+" : "−"}${tr("pct", { n: Math.abs(d) })}`;
    return v_flex().id(`hub-pc-${id}`).w(cw).flex_none().p(12).rounded(12).border(1).border_color(t.border).bg(t.raised).when(Boolean(tip), (el) => el.tooltip(tip))
      .child(this.V.stat(name, main, { delta: pct, detail: d === 0 ? tr("week.same") : detail, better, width: cw - 24, id: `hub-ps-${this.pv.key}-${id}` }));
  }

  pWeek(t, pr, pw, prs, checks) {
    const W = this.width - 24;
    const cols = W >= 1050 ? 4 : 2;
    const cw = Math.floor((W - 8 * (cols - 1)) / cols);
    const vs = tr("week.vs");
    const cards = [
      this.pCard(t, "s", cw, tr("card.s"), num(pw.now.s), { d: delta(pw.now.s, pw.before.s), detail: vs, tip: tr("tip.s") }),
      this.pCard(t, "a", cw, tr("card.a"), duration(pw.now.a * 1000), { d: delta(pw.now.a, pw.before.a), detail: vs, tip: tr("tip.a") }),
      this.pCard(t, "p", cw, tr("card.p"), num(pw.now.p), { d: delta(pw.now.p, pw.before.p), detail: vs, tip: tr("tip.p") }),
      this.pCard(t, "prs", cw, tr("proj.cardPrs"), prs ? tr("proj.openedMerged", { o: prs.opened, m: prs.merged }) : "—",
        { detail: prs?.median != null ? tr("proj.median", { t: duration(prs.median) }) : prs ? tr("proj.noMerge") : tr("proj.ghNone"), tip: tr("proj.prsTip") }),
      this.pCard(t, "review", cw, tr("proj.cardReview"), `${checks.fixed} / ${checks.found}`,
        { detail: checks.reports ? tr("proj.fixedDetail", { runs: tr("proj.reviewRuns", { n: checks.reviewRuns }) }) : tr("proj.noReport"), tip: tr("proj.reviewTip") }),
      this.pCard(t, "ci", cw, tr("proj.cardCi"), `${checks.ciOk} / ${checks.ciOk + checks.ciFail}`,
        { detail: tr("proj.ciDetail", { runs: tr("proj.ciRuns", { n: checks.ciRuns }) }), tip: tr("proj.ciTip") }),
    ];
    return this.section(t, "pweek", tr("week.title"), div().flex_none().text_size(11).text_color(t.dim).child(tr("week.sub")), h_flex().flex_wrap().gap(8).children(cards));
  }

  pAct(t, pr) {
    const ys = projectYears(pr.p, this.d.today);
    const y = this.pYear.get(pr.key) ?? ys.at(-1);
    const i = ys.indexOf(y);
    const h = this.pHeatOf(pr, y);
    const arrow = (id, icon, tip, by, on) => div().id(id).size(24).flex_none().rounded_full().flex().items_center().justify_center()
      .text_color(on ? t.muted : t.dim).when(!on, (el) => el.opacity(0.4))
      .when(on, (el) => el.cursor_pointer().hover((s) => s.bg(t.hover).text_color(t.foreground)).tooltip(tip)
        .on_click((_e, cx) => { cx.stop_propagation(); this.stepYear(by, cx); cx.notify(); }))
      .child(svg(I(icon)).size(13));
    const right = h_flex().flex_none().gap(4).items_center()
      .child(arrow("hub-py-prev", "chevron-left", tr("act.prev"), -1, i > 0))
      .child(div().font_family(MONO).text_size(12).text_color(t.foreground).child(String(y)))
      .child(arrow("hub-py-next", "chevron-right", tr("act.next"), 1, i >= 0 && i < ys.length - 1));
    const junction = this.sum.junction;
    const cal = this.V.calendar(h.levels, {
      start: h.start, months: tr("act.months").split(" "), weekdays: tr("act.weekdays").split(" "), legend: [tr("act.less"), tr("act.more")],
      mark: h.split > 0 ? h.split : null, markTip: junction ? tr("act.mark", { date: date(`${junction}T12:00:00`, { year: true }) }) : null,
      tip: (a, b) => this.weekTip(h, a, b), color: this.colorOf(t, pr.entry), id: `hub-pcal-${pr.key}-${y}`,
    });
    return this.section(t, "pact", tr("act.title"), right, v_flex().gap(6)
      .child(div().font_family(MONO).text_size(11).text_color(t.muted).child(tr("act.total", { active: num(h.active), sessions: num(h.sessions) })))
      .child(cal));
  }

  // The week's PRs (gh): number, title, state, its review and CI when a report has them; a click opens it in
  // the Inbox (kt.inbox.open), as kt-flow does.
  pPrs(t, pr, prs) {
    const side = this.side.get(pr.key);
    const err = side?.prErr ? div().text_size(12).text_color(t.ansi1).child(tr("proj.ghError", { error: side.prErr })) : null;
    if (!pr.slug) return this.section(t, "pprs", tr("proj.prsTitle"), null, this.muted(t, tr("proj.noSlug")));
    if (!prs) return this.section(t, "pprs", tr("proj.prsTitle"), null, err ?? this.muted(t, side?.busy ? tr("proj.ghReading") : tr("proj.ghNone")));
    const STATE = { OPEN: t.ansi2, MERGED: t.ansi5, CLOSED: t.dim };
    const rows = prs.rows.slice(0, 10).map((x) => {
      const c = x.draft ? t.dim : STATE[x.state] ?? t.dim;
      return h_flex().id(`hub-pr-${x.n}`).h(30).px(6).gap(10).items_center().rounded(10).cursor_pointer().hover((s) => s.bg(t.hover))
        .tooltip(tr("proj.prTip")).on_click((_e, cx) => { cx.stop_propagation(); this.openPr(pr.slug, x.n); })
        .child(div().w(46).flex_none().font_family(MONO).text_size(11).text_color(t.muted).child(`#${x.n}`)) // i18n: tech
        .child(div().flex_1().min_w(0).truncate().text_size(12.5).text_color(t.foreground).child(x.title))
        .child(div().flex_none().h(18).px(7).flex().items_center().rounded_full().border(1).border_color(alpha(c, "66")).bg(alpha(c, "1a"))
          .font_family(MONO).text_size(9.5).text_color(c).child(x.draft ? "draft" : String(x.state ?? "").toLowerCase())) // i18n: tech
        .child(div().w(120).flex_none().flex().justify_end().font_family(MONO).text_size(10.5).text_color(t.dim)
          .child(x.review ? tr("proj.prReview", { p: x.review.passes, f: x.review.fixed, n: x.review.found }) : ""))
        .child(div().w(70).flex_none().flex().justify_end().font_family(MONO).text_size(10.5).text_color(x.ci?.fail ? t.ansi1 : t.dim)
          .child(x.ci ? tr("proj.prCi", { ok: x.ci.ok, n: x.ci.total }) : ""));
    });
    return this.section(t, "pprs", tr("proj.prsTitle"), null, v_flex().gap(2)
      .children(rows.length ? rows : [this.muted(t, tr("proj.noPr"))]).when(Boolean(err), (el) => el.child(err)));
  }

  pLaunches(t, pw) {
    const list = pw.launches.map((x) => ({ ...x, family: familyOf(x.name) })).filter((x) => x.family !== "command");
    return this.section(t, "plaunch", tr("launch.title"), null, this.rankRows(t, list, (x) => t[FAMILY[x.family]] ?? t.accent, tr("launch.none")));
  }

  projectBody(t, pr) {
    const pw = projectWeek(pr.p, this.d.w);
    const side = this.side.get(pr.key);
    const prs = side?.prs ? weekPrs(side.prs, this.sum.reports, pr.slug, this.d.w) : null;
    const checks = weekChecks(this.sum.reports, this.sum.flows, pr.slug, this.d.w);
    return [this.pHead(t, pr), this.pWeek(t, pr, pw, prs, checks), this.pAct(t, pr), this.pPrs(t, pr, prs), this.pLaunches(t, pw)];
  }

  // ---------- page ----------

  // Before the first summary: the sections' shapes as bars (skeleton.js), breathing.
  skeletonBody(t) {
    const S = skeleton(t, this.m);
    return S.pulse(v_flex().id("hub-body-sk").p(12).gap(14)
      .child(S.line(140, { h: 7, lh: 16 }))
      .child(h_flex().gap(8).children([0, 1, 2].map(() => S.block(null, 110).flex_1())))
      .child(S.line(110, { h: 7, lh: 16 }))
      .child(S.block(null, 140))
      .child(S.list(5, { h: 34, icon: 20, lines: [0.4] })));
  }

  body(t) {
    if (!this.sum || !this.d) {
      return v_flex().flex_1().min_h(0).child(this.readError ? div().p(16).text_size(13).text_color(t.ansi1).child(tr("index.unreadable", { error: this.readError })) : this.skeletonBody(t));
    }
    const pr = this.pv;
    // #50: Next and Recent, on the right from WIDE px (their own scroll), else after the flows.
    const wide = !pr && this.width >= WIDE;
    const side = pr ? [] : [this.nextSection(t), this.recentSection(t)];
    const kids = pr ? this.projectBody(t, pr)
      : [this.nowSection(t), this.weekSection(t), this.actSection(t), this.rankSection(t), this.projSection(t), this.flowsSection(t), ...(wide ? [] : side)];
    if (this.reveal) {
      const i = (pr ? P_SECTIONS : SECTIONS).indexOf(this.cur);
      if (i >= 0 && i < kids.length) this.scroll.scroll_to_item(i);
      this.reveal = false;
    }
    const main = v_flex().id("hub-body").flex_1().min_h(0).min_w(0).overflow_y_scrollbar().track_scroll(this.scroll).p(4).pb(16).gap(4).children(kids);
    // The view's key in the id: global and each project fade in when they come.
    return enter(this.m, h_flex().flex_1().min_h(0).items_start(), `hub-in-${pr?.key ?? "global"}`, { dy: 0 })
      .child(main.h_full())
      .when(wide, (el) => el.child(v_flex().id("hub-side").w(400).flex_none().h_full().overflow_y_scrollbar().p(4).pb(16).gap(4)
        .border_l(1).border_color(t.border).children(side)));
  }

  render(cx) {
    this.m = frame(this.motion, Boolean(shared("kt.reducedMotion")));
    const vis = visible();
    if (!checking()) {
      // The bus (DATA-SYNC.md): an agent stopped working, its transcript grew. Once a minute at most.
      refreshOn(this, cx, "hub-agents", ["agents"], async (cx) => {
        if (Date.now() - this.ranAt >= AGAIN_MS) this.index(cx, "bus");
        else this.waiting = true;
      });
      if (vis && !this.shown) {
        // Shown again: the keyboard (NORMAL) once the app has settled its own focus, the tick, a pass
        // when the last is over a minute old (the old summary stays shown meanwhile).
        cx.timer.after(150, (cx) => {
          if (visible() && !this.handle.is_focused()) this.focusIn(cx);
          cx.notify();
        });
        this.startTick(cx);
        if (Date.now() - this.ranAt >= AGAIN_MS) this.index(cx, "page");
      }
    }
    this.shown = vis;
    this.keyed = this.handle.is_focused();
    const t = theme();
    this.V = viz(t, this.m, { roll });
    // The view (#49): the shown project's, unless global; its PRs and worktrees asked while it shows.
    if (this.sum && this.d && this.regKey !== JSON.stringify(shared("kt.projects") ?? null)) this.derive(); // a project added, renamed, recoloured
    this.cand = this.sum && this.d ? this.candidate(cx) : null;
    this.pv = this.scope === "global" ? null : this.cand;
    if (this.pv && vis) this.sideLoad(cx, this.pv);
    if (!this.pv && vis && this.sum) this.histLoad(cx);
    if (!(this.pv ? P_SECTIONS : SECTIONS).includes(this.cur)) this.cur = (this.pv ? P_SECTIONS : SECTIONS)[0];
    const page = v_flex().id("hub-root").size_full().gap(4).text_color(t.foreground)
      .track_focus(this.handle)
      .on_key_down((e, cx) => this.key(e, cx))
      .on_size_change((size, cx) => { if (size.width !== this.width) { this.width = size.width; cx.notify(); } })
      .child(this.header(t))
      .child(this.card(t).flex_1().min_h(0).overflow_hidden().child(this.body(t)));
    this.writeTips(cx);
    // The flows' paths, once, a moment after the first render with data (one timer, then never again).
    if (this.d && !this.stepsOk && !this.stepsSoon && !checking()) {
      this.stepsSoon = true;
      cx.timer.after(80, (cx) => { this.stepsOk = true; cx.notify(); });
    }
    return page;
  }
}
