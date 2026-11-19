// kt-hub: the home page (#46), the "hub" child of kbrdn-threads' "view" stack. It draws what the indexer
// (index.ts, #44) leaves in data/kt-hub/summary.json and computes nothing in render: model.js and recent.js
// derive the week, the rankings, the projects, the year and the flows once per summary (and per day).
// #76's cards (validated on its HTML mockup): a card per section, every series in trame (viz.js' dithered
// cells: the year, the charts and the ring as SVG images written by the page, trame.js; the bars in paths),
// Now in the header. #89's layout (Apple's Screen Time, validated on its mockup), every row as wide as the
// page: Temps agent (Semaine / Mois and the periods before, the daily average and its change, the days
// stacked by project under a dashed average, the most active, the plan's limits), Activity, then Next,
// Sub-agents and Recent side by side as tall as each other (Recent dropping lines to fit), Machines (this
// Mac and main-vps: CPU, memory, disk; hosts.js), then the tracked workflows (week by week, then a funnel
// per workflow). Widths: tiers.js, with their previous tier kept.
// #48: the year of GitHub instead of the agents' (tab). #49: one project's view, the shown space's unless
// kt.project is "*" (v switches to the global one): its worktrees (gwm), its week with its PRs (gh pr list)
// and what review and CI caught (~/Reports' recaps, the flows), its year, its PRs (a click opens the Inbox
// on one), its launches. #50: Next (who waits, the flows' next step, the plans' unblocked issues) and Recent
// (merges, vault notes, removed worktrees, sessions).
// The indexer runs (exec, bun by its path: exec's PATH has no ~/.nix-profile): on the first show and on
// coming back after 60 s, the old summary staying shown; on the bus's "agents" while shown, 60 s apart at
// most (a bump in between waits for its turn); on r. A hidden copy doesn't render, so it doesn't hear
// the bus: it catches up when it shows. One tick while shown (each second the page left; each 5 s a bump
// waiting, the day and the minute changing); none while hidden.
// Keys (vim.js): j / k gg / G the sections, [ / ] or h / l the year (on Temps agent: the period), tab the
// source (on Temps agent: Semaine / Mois), n / N the most active's tab, v the view, r index (and the
// project's PRs and worktrees), enter (Now: go to the agent; Temps agent: all the projects or 6), ? kt-keys,
// q / esc back to the thread when there is one.
// Mod commands: kt-hub.focus, key:<keys>, refresh, year:<yyyy>, source:<agents|github>, scope:<auto|global>.

import { View, div, svg, image } from "gpui-kit";
import { v_flex, h_flex, ScrollHandle } from "gpui-base";
import * as fs from "fs/promises";
import { exec, readTextFile, writeTextFile, theme, spaces, agents, run, layout, home, appHome, checking, nextCommand, openOverlay, shared, setShared, settings, panes } from "herdr";
import { week, ranked, year, years, now, byMachine, delta, localDay, dayShift, familyOf, projectIndex, period, spent, spentDelta, stacks, periodCounts, planLimits } from "./model.js";
// kt-keys' machines.js (a byte-identical copy, with machines.strings.js): the other machines and their state (#66).
import { machineList, machineTag, stateOf, stateWord, guard, loginOf, REMOTE_TIMEOUT } from "./machines.js";
// Machines (Kylian's request of 2026-11-19): CPU, memory and disk of this Mac and of main-vps.
import { VPS, VPS_CMD, MAC_EVERY, VPS_EVERY, VPS_FLOOR, macFigures, linuxFigures, readDue } from "./hosts.js";
import { ghArgs, parseYear, stale, githubYear } from "./github.js";
import { keyOf as folderKey, projectWeek, projectYear, projectYears, weekPrs, weekChecks, prListArgs } from "./project.js";
import { nextFlows, nextPlanIssues, recentMerges, parseHistory, onGitHub, flowWeeks, funnels } from "./recent.js";
import { makeT, num, date, time, relative, duration } from "./i18n.js";
import strings from "./strings.js";
import { Vim, keysOf, keyOf, step } from "./vim.js";
import { dither, iconBtn, bandRow } from "./band.js";
import { motionState, frame, enter, stagger } from "./motion.js";
import { tileState, tilesFrame, projTile, LETTER } from "./projtile.js";
import { skeleton } from "./skeleton.js";
import { viz, quartileLevels, capped, progressGeometry, faint, reveal, swatch, SERIES, Scale } from "./viz.js";
import { roll } from "./roll.js";
import { refreshOn } from "./bus.js";
// kt-keys' tiers.js and kt-flow's steps.js (byte-identical copies): the width tiers, the steps' phases.
import { tierOf } from "./tiers.js";
import { PHASES, workflowName, speak } from "./steps.js";
import { calN, calendarGrid, calendarSvg, squaresSvg, funnelSvg, donutSvg, stackSvg, hash } from "./trame.js";

const tr = makeT(strings);
speak(makeT);
const MONO = "Monaspace Krypton";
const I = (name) => `mods/kt-threads/${name}.svg`;
const H = (name) => `mods/kt-hub/${name}.svg`;
const HISTORY = "mods/kt-panel-head/history.svg";
const SPIN = "mods/workspace-chrome/spinner.svg";
const alpha = (c, a) => `${String(c).slice(0, 7)}${a}`;
// A registry entry archived (#88, kt-projects; projects.js isArchived).
const archived = (e) => Number.isFinite(e?.archived);
const parse = (s) => { try { return JSON.parse(s ?? ""); } catch { return null; } };
const paint = (path, c) => globalThis.window.paint_path(path, c).absolute().inset_0();
const AGAIN_MS = 60e3; // the indexer at most once a minute, unless r
const SECTIONS = ["now", "time", "act", "next", "subs", "recent", "hosts", "flows"];
const RECENT_MS = 14 * 864e5; // #50: Next and Recent look two weeks back
const P_SECTIONS = ["phead", "pweek", "pact", "pprs", "plaunch"]; // #49: one project's view
const STALE_MS = 3600e3; // a project's PRs (gh) and worktrees (gwm): asked again after an hour, or on r
const FAMILY = { workflow: "ansi4", loop: "ansi5", skill: "ansi2" };
const PROJ_MAX = 6;
// #89: the most active's tabs; the colors of the chart's projects without one in the registry, in turn;
// the plan's limits as the statusLine writes them (the bottom bar's source).
const MOST = ["proj", "launch", "model"];
const FALL = ["accent", "ansi13", "ansi9", "ansi6", "ansi5"];
const QUOTA = ".claude/cache/statusline/herdr-quota.json";
const HOSTS_FILE = "data/kt-hub/machines.json"; // main-vps' last figures (numbers only)
const BUILD_MAX = 4; // bars built cold in one render (built()); the chart counts for all
const MEMO = 120; // their geometries kept
// A card's frame: its border (2), its padding (28 across; 12 + 14 down) and its head (24 + 12).
const CARD_X = 30, CARD_Y = 64;
// #76: the steps' phases in color (steps.js' PHASES), and a color per workflow (its own, else stable by name).
const PHASE_COLOR = { prep: "ansi4", spec: "ansi6", impl: "ansi5", ship: "ansi3", close: "ansi2" };
const phaseOf = (id) => PHASES.find((p) => p.steps.includes(id))?.id ?? "close";
const WF_COLOR = { "me:issue-worktree-pr": "ansi4", "me:issue-branch-pr": "ansi6", "me:spec-issue-worktree-pr": "ansi2", "me:spec-issue-branch-pr": "ansi2",
  "me:goal": "ansi5", "me:dispatch": "ansi3", "me:release": "accent" };
const WF_SERIES = ["ansi4", "ansi5", "ansi2", "ansi3", "ansi6", "accent"];
const wfColor = (w) => WF_COLOR[w] ?? WF_SERIES[parseInt(hash(String(w ?? "")), 36) % WF_SERIES.length];
// #76: the trames' images (trame.js), in data/kt-hub/trame: <kind>-<data>-<look>.svg (the data part and the
// look part apart: the sweep keeps every look of the data shown, dark, light, glass). TRAME: the captures'
// two switches (<use>, and the SVG's size for a Retina that would blur it).
const TRAME = { use: true, scale: 1 };
const TRAME_DIR = "data/kt-hub/trame";
// days and tr: #76's streak and trends, gone with « Cette semaine » (#89); kept for the sweep to take them.
const TRAME_NAME = /^(cal|leg|days|tr|fn|dn|st)-[0-9a-z]+-[0-9a-z]+\.svg$/;
const MAX_FILES = 120; // ponytail: a cap, not an LRU; past it, only the shown look's files stay
const SETTLE_MS = 300; // a width that moved this recently writes no image (a drag would write one a pixel)
// Next's and Recent's rows: a group's name, a line; the empty sentence.
const SUB_H = 18, LINE_H = 26, EMPTY_H = 34;

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
// The height of groups of lines with `counts` lines shown each: a name, its lines (2 px apart), 4 between.
const groupsH = (counts) => (counts.length ? counts.reduce((s, n) => s + SUB_H + n * (LINE_H + 2), 0) + 4 * (counts.length - 1) : EMPTY_H);
// The lines each group keeps within `avail` px: the longest loses its last first, each keeps one.
function fit(sizes, avail) {
  const n = [...sizes];
  while (groupsH(n) > avail) {
    let k = -1;
    n.forEach((v, i) => { if (v > 1 && (k < 0 || v > n[k])) k = i; });
    if (k < 0) break;
    n[k]--;
  }
  return n;
}

export default class Hub extends View {
  init(_props, cx) {
    this.tiles = tileState(); // projtile.js: a project without a logo on the logos' dithered background
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
    this.widthAt = null; // when the width last moved (SETTLE_MS); null: not measured yet, no image before it
    this.headW = 0;
    this.shown = false;
    this.tick = null;
    this.minute = 0;
    // #76: the layout's states (tiers with their previous one), the bars' paths (memo), the trames' files.
    // #89: Temps agent's period (week | month, `shift` back), the most active's tab, all the projects or 6,
    // the period's figures (timeOf, memo), the plan's limits (herdr-quota.json, as read).
    this.tiers = {};
    this.per = "week";
    this.shift = 0;
    this.most = "proj";
    this.projAll = false;
    this.tm = null;
    this.qText = undefined; // herdr-quota.json as read (planLimits weighs it against kt.usage.summary)
    // Machines: each one's last figures (hosts.js) and when it was last asked; main-vps' last ones kept in
    // data/kt-hub/machines.json (shown with their age after a restart; `file`: that file as read or written).
    this.hosts = { mac: null, macAt: 0, vps: null, vpsAt: 0, file: undefined };
    this.bars = new Map();
    this.slots = new Map(); // a bar's last geometry, by its row (built())
    this.builds = 0;
    this.later = false;
    this.heavy = 0; // 0: none yet, 1: the bars, 3: and the flows' chart (bar()); 2 was #76's weeks
    this.heavySoon = -1;
    this.tr = { have: new Set(), slot: new Map(), queue: new Map(), busy: false, listed: false, swept: null };
    this.tw = new Set(); // the trames the last render asked for
    if (checking()) return;
    this.load(cx);
    // main-vps' last figures as the last pass on it left them (a file of this Mac: nothing asked of the VPS).
    cx.spawn(async (cx) => {
      const text = await readTextFile(`${appHome()}/${HOSTS_FILE}`).catch(() => null);
      this.hosts.file = text;
      const kept = parse(text)?.vps;
      if (kept?.at && !this.hosts.vps) { this.hosts.vps = kept; cx.notify(); }
    });
    cx.spawn(async (cx) => {
      const names = await fs.readdir(`${appHome()}/${TRAME_DIR}`).catch(() => []);
      for (const n of names) if (TRAME_NAME.test(n)) this.tr.have.add(n);
      this.tr.listed = true;
      cx.notify();
    });
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
    // #76: the flows of the last two weeks, week by week (their commits' times) and by workflow.
    const flows = (s.flows ?? []).filter((f) => (f.seen ?? 0) >= Date.now() - RECENT_MS);
    // #89: the projects by key (Temps agent's names, colors, logos), the first day the summary knows.
    this.d = { today, w, subs: ranked(s.days, w, "sub"), projects: projectIndex(s.projects, reg), first: Object.keys(s.days ?? {}).sort()[0] ?? today, years: ys,
      fl: { weeks: flowWeeks(flows, Date.now()), funnels: funnels(flows) } };
    this.tm = null;
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

  // ---------- trames (#76, trame.js) ----------

  // An image of the hub's: { path, w, h } once its file is written, else the last image of that slot (the
  // old one stays until the new one exists, drawn at its own size), else null (its place, empty). Asked in
  // render, built in a task after it (flushTrames), never while the width moves.
  trame(slot, kind, data, look, w, h, build) {
    const name = `${kind}-${hash(`${slot}|${data}`)}-${hash(look)}.svg`;
    this.tw.add(name);
    if (this.tr.have.has(name)) {
      this.tr.slot.set(slot, { name, w, h });
      return { path: `${TRAME_DIR}/${name}`, w, h };
    }
    if (this.tr.listed && this.widthAt != null && Date.now() - this.widthAt >= SETTLE_MS) this.tr.queue.set(name, build);
    const last = this.tr.slot.get(slot);
    return last && this.tr.have.has(last.name) ? { path: `${TRAME_DIR}/${last.name}`, w: last.w, h: last.h } : null;
  }

  // The images asked for and not there: built and written in a task, one per turn (each a few ms, #76's
  // measures), the page redrawn after each. A file that already exists (another copy wrote it) is there.
  flushTrames(cx) {
    if (checking() || this.tr.busy) return;
    if (!this.tr.queue.size) { this.sweep(cx); return; }
    this.tr.busy = true;
    cx.spawn(async (cx) => {
      const dir = `${appHome()}/${TRAME_DIR}`;
      await fs.mkdir(dir, { recursive: true }).catch(() => {});
      for (const [name, build] of [...this.tr.queue]) {
        this.tr.queue.delete(name);
        if (this.tr.have.has(name)) continue;
        const file = `${dir}/${name}`;
        try {
          const text = build();
          const ok = await writeTextFile(file, text, null).then(() => true, () => fs.exists(file));
          if (ok) this.tr.have.add(name);
        } catch (e) {
          console.log(`kt-hub: trame ${name}: ${String(e?.message ?? e).slice(0, 160)}`);
        }
        cx.notify();
      }
      this.tr.busy = false;
      cx.notify();
    });
  }

  // Once per summary, the queue empty: the files of no data shown go (every look of the shown data stays),
  // and past MAX_FILES the other looks too. Only in data/kt-hub/trame, only names of TRAME_NAME.
  sweep(cx) {
    if (!this.sum || !this.tr.listed || this.tr.swept === this.sum.at || !this.tw.size) return;
    this.tr.swept = this.sum.at;
    const parts = (n) => n.slice(0, -4).split("-");
    const data = new Set([...this.tw].map((n) => parts(n)[1]));
    const looks = new Set([...this.tw].map((n) => parts(n)[2]));
    cx.spawn(async () => {
      const dir = `${appHome()}/${TRAME_DIR}`;
      const names = (await fs.readdir(dir).catch(() => [])).filter((n) => TRAME_NAME.test(n));
      const kept = names.filter((n) => data.has(parts(n)[1]));
      const gone = names.filter((n) => !data.has(parts(n)[1]));
      if (kept.length > MAX_FILES) gone.push(...kept.filter((n) => !looks.has(parts(n)[2])));
      for (const n of gone) {
        await fs.unlink(`${dir}/${n}`).catch(() => {});
        this.tr.have.delete(n);
      }
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

  // The Inbox opens GitHub repos only (#76, recent.js' onGitHub): a flow's repo can be a folder's name.
  openIssue(repo, n) {
    if (!onGitHub(repo) || !n) return;
    setShared("kt.inbox.open", { repo, kind: "issue", number: Number(n), at: Date.now() });
    run("layout.select", { stack: "view", child: "inbox" });
  }

  openPr(slug, n) {
    if (!onGitHub(slug) || !n) return;
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

  // The tick, only while shown: each second, the page left (a hidden copy doesn't render: this is how it
  // knows, so its return reads again and opens at the top, a short leave included); each 5 s, a bump's
  // turn, the day and the minute (the clock, « il y a ») changing, the keyboard coming or going.
  startTick(cx) {
    if (this.tick) return;
    let n = 0;
    this.tick = cx.timer.every(1000, (cx) => {
      if (!visible()) {
        this.shown = false;
        this.tick?.cancel();
        this.tick = null;
        return;
      }
      if (++n % 5) return;
      this.quotaLoad(cx);
      this.hostsLoad(cx, MAC_EVERY, VPS_EVERY);
      if (this.waiting && Date.now() - this.ranAt >= AGAIN_MS) this.index(cx, "bus");
      if (this.source === "github") this.ghLoad(cx, this.ghYear); // asks gh only when stale
      if (this.d && localDay(Date.now()) !== this.d.today) this.derive();
      const minute = Math.floor(Date.now() / 60e3);
      if (minute !== this.minute || this.keyed !== this.handle.is_focused()) { this.minute = minute; cx.notify(); }
    });
  }

  // Machines (hosts.js): this Mac every `macEvery` ms, main-vps every `vpsEvery` (both only while the hub
  // shows: readDue asks visible() itself, and the tick that calls this stops when the page is left). This
  // Mac: three local commands. main-vps: Kylian's approved command, through guard() (a machine away is not
  // called; REMOTE_TIMEOUT), its figures then written to HOSTS_FILE. A read that fails keeps the last
  // figures and their age.
  hostsLoad(cx, macEvery, vpsEvery) {
    if (checking()) return;
    const h = this.hosts, now = Date.now(), shown = visible();
    if (!h.macBusy && readDue(shown, h.macAt, macEvery, now)) {
      h.macBusy = true;
      h.macAt = now;
      cx.spawn(async (cx) => {
        const out = (r) => (r?.code === 0 ? r.stdout : "");
        const [s, v, d] = await Promise.all([
          exec("/usr/sbin/sysctl", ["-n", "vm.loadavg", "hw.ncpu", "hw.memsize"], { timeout: 5e3 }).catch(() => null),
          exec("/usr/bin/vm_stat", [], { timeout: 5e3 }).catch(() => null),
          exec("/bin/df", ["-kP", "/System/Volumes/Data"], { timeout: 5e3 }).catch(() => null),
        ]);
        h.mac = macFigures(out(s), out(v), out(d), Date.now()) ?? h.mac;
        h.macBusy = false;
        cx.notify();
      });
    }
    if (!h.vpsBusy && machineList().some((m) => m.name === VPS) && readDue(shown, h.vpsAt, vpsEvery, now)) {
      h.vpsBusy = true;
      h.vpsAt = now;
      cx.spawn(async (cx) => {
        const r = await guard(exec)("sh", ["-c", VPS_CMD], { on: VPS, timeout: REMOTE_TIMEOUT }).catch(() => null);
        const f = r?.code === 0 ? linuxFigures(r.stdout, Date.now()) : null;
        if (f) {
          h.vps = f;
          const text = JSON.stringify({ v: 1, vps: f });
          await writeTextFile(`${appHome()}/${HOSTS_FILE}`, text, h.file ?? null).then(() => { h.file = text; }, () => {
            h.file = undefined; // written elsewhere meanwhile: read again before the next write
            return readTextFile(`${appHome()}/${HOSTS_FILE}`).then((x) => { h.file = x; }, () => {});
          });
        }
        h.vpsBusy = false;
        cx.notify();
      });
    }
  }

  // #89: the statusLine's herdr-quota.json, on show and every 5 s while shown; a file that changed redraws,
  // one that didn't costs nothing (kt.usage.summary, the other source, redraws by itself: shared state).
  quotaLoad(cx) {
    if (checking() || this.qBusy) return;
    this.qBusy = true;
    cx.spawn(async (cx) => {
      const text = await readTextFile(`${home()}/${QUOTA}`).catch(() => null);
      this.qBusy = false;
      if (text === this.qText) return;
      this.qText = text;
      cx.notify();
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

  // #89: Semaine / Mois (this one again), a period back (by 1) or forward (-1): never past the first day the
  // summary knows, nor after this one.
  setPeriod(k) {
    this.per = k;
    this.shift = 0;
  }

  stepPeriod(by) {
    if (!this.d || (by > 0 && !this.timeOf().back)) return;
    this.shift = Math.max(0, this.shift + by);
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
    // #89, on Temps agent: h / l and [ / ] the period (back, forward), tab Semaine / Mois, n / N the tabs.
    const onTime = this.cur === "time" && !this.pv;
    if (["down", "up", "top", "bottom", "half-down", "half-up"].includes(a)) {
      this.cur = secs[step(a, secs.indexOf(this.cur), secs.length, this.vim.count, 4)];
      this.reveal = true;
    } else if (onTime && (a === "panel-prev" || a === "left")) this.stepPeriod(1);
    else if (onTime && (a === "panel-next" || a === "right")) this.stepPeriod(-1);
    else if (onTime && (a === "tab-next" || a === "tab-prev")) this.setPeriod(this.per === "week" ? "month" : "week");
    else if (onTime && (a === "next" || a === "prev")) this.most = MOST[(MOST.indexOf(this.most) + (a === "next" ? 1 : MOST.length - 1)) % MOST.length];
    else if (a === "panel-prev" || a === "left") this.stepYear(-1, cx);
    else if (a === "panel-next" || a === "right") this.stepYear(1, cx);
    else if ((a === "tab-next" || a === "tab-prev") && !this.pv) this.setSource(this.source === "github" ? "agents" : "github", cx);
    else if (a === "open" && this.cur === "now") this.go(now(agents()).go);
    else if (a === "open" && onTime) this.projAll = !this.projAll;
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

  // A tier of the width `w` (tiers.js), its previous one kept per `name` (hysteresis).
  tier(name, w) {
    return (this.tiers[name] = tierOf(w, this.tiers[name]));
  }

  // A section (#76): a card, radius 14, padding 14; its head, the name in mono 11 caps, its count rolling,
  // its actions on the right; the accent ring while the page has the keyboard on it. `i`: its rank in the
  // page, for the entry's cascade.
  card(t, id, label, count, right, body, i = 0) {
    const on = this.keyed && this.cur === id;
    const el = v_flex().min_w(0).px(14).pt(12).pb(14).gap(12).rounded(14).border(1)
      .border_color(on ? alpha(t.accent, "99") : t.border).bg(t.background)
      .child(h_flex().h(24).gap(8).items_center()
        .child(div().flex_none().font_family(MONO).text_size(11).text_color(t.muted).child(String(label).toUpperCase()))
        .when(count != null, (e) => e.child(div().flex_none().font_family(MONO).text_size(11).text_color(t.dim).child(roll(this.m, `hub-ct-${id}`, num(count ?? 0), 14))))
        .child(div().flex_1())
        .children([right].flat().filter(Boolean)))
      .child(body);
    return enter(this.m, el, `hub-sec-${id}`, { dy: 0, delay: stagger(i, 8) });
  }

  // The empty sentence of a section: its icon and why, centred, a line high (never silent).
  empty(t, icon, text) {
    return h_flex().h(EMPTY_H).gap(8).items_center().justify_center().text_size(12.5).text_color(t.dim)
      .child(svg(icon).size(14).flex_none()).child(div().truncate().child(text));
  }

  hint(t, text) {
    return div().min_w(0).truncate().text_size(11).text_color(t.dim).child(text);
  }

  sub(t, text, more = 0) {
    return div().h(SUB_H).pt(4).font_family(MONO).text_size(10).text_color(t.dim)
      .child(`${String(text).toUpperCase()}${more ? `  +${more}` : ""}`); // i18n: tech
  }

  // A dithered bar (viz.js' progress, bare): paths memoized by width and ratio. The bars (this.heavy 1) and
  // the flows' chart (3) come one and three renders after the one that brings the data: a render of the page
  // takes ~20 ms, and all of them at once ~40 of the ~50 a render has (#76's measures).
  // Paths built cold in this render, BUILD_MAX at most: past it a slot keeps its last geometry one more render
  // (a summary that changes them all at once, Monday's, cost ~40 ms in one render); `this.later` asks for it.
  // The memo: by what draws (a bar's head column, a week's bar heights), the oldest entries going past MEMO.
  built(map, key, slot, build) {
    let g = map.get(key);
    if (!g) {
      const last = this.slots.get(slot);
      if (this.builds >= BUILD_MAX) { this.later = true; return last ?? null; }
      this.builds++;
      g = build();
      map.set(key, g);
      while (map.size > MEMO) map.delete(map.keys().next().value);
    }
    this.slots.set(slot, g);
    return g;
  }

  bar(t, w, ratio, color, slot) {
    const head = Math.round(Math.floor(w / 3) * Math.min(1, Math.max(0, ratio)));
    const g = this.heavy ? this.built(this.bars, `${w}|${head}`, slot, () => capped((c) => progressGeometry(ratio, w, c), 3, w * 9)) : null;
    if (!g) return div().w(w).h(9).flex_none().bg(faint(color, 0.14));
    return div().relative().w(w).h(9).flex_none().children([...g.paths].map(([k, p]) => paint(p, k === "tint" ? color : faint(color, 0.14))));
  }

  // ---------- header and Now ----------

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
    return v_flex().id("hub-head").relative().flex_none().rounded(16).border(1).border_color(t.border).bg(t.background).px(4).pb(4)
      .on_size_change((x, cx) => { if (x.width !== this.headW) { this.headW = x.width; cx.notify(); } })
      .children([dither(this.headW, 60, 16, tint)].filter(Boolean))
      .child(bandRow(t, { m: this.m, color: tint, icon: I("house"), title: this.pv ? tr("titleProject", { name: this.pv.name }) : tr("title"),
        dot: this.running ? t.working : this.err ? t.ansi1 : null,
        // #66: the archived figures are this Mac's (its transcripts), said once there are other machines.
        sub: [`${date(at)} · ${time(at)}`, state, machineList().length ? tr("index.local") : null],
        buttons: [seg, refresh] }))
      .child(this.nowRow(t));
  }

  colorOf(t, e) {
    const c = e?.color;
    return c ? (c.startsWith("#") ? c : t[c] ?? t.accent) : t.accent;
  }

  // Now (#76: the header's second row): the live agents in a sentence (a spinner while one works, a
  // breathing dot while one waits), a pill per machine with other machines (#66: its state when it doesn't
  // answer, its counts else), and « Y aller » to the one to see first.
  nowRow(t) {
    const n = now(agents());
    const parts = [n.working && tr("now.working", { n: n.working }), n.blocked && tr("now.blocked", { n: n.blocked }), n.done && tr("now.done", { n: n.done })].filter(Boolean);
    const dot = n.blocked ? t.blocked : n.done ? t.done : n.working ? t.working : t.dim;
    const others = machineList();
    const pills = others.length ? byMachine(agents(), others.map((m) => m.name)).map((g) => {
      const s = g.name == null ? null : others.find((m) => m.name === g.name) ?? stateOf(g.name);
      const word = g.name == null ? "" : stateWord(g.name);
      const counts = [g.working && tr("now.working", { n: g.working }), g.blocked && tr("now.blocked", { n: g.blocked }), g.done && tr("now.done", { n: g.done })].filter(Boolean);
      const text = word || (counts.length ? counts.join(", ") : g.total ? tr("now.idle", { n: g.total }) : tr("now.noAgent"));
      const tag = g.name == null
        ? h_flex().gap(5).items_center().child(div().size(6).flex_none().rounded_full().bg(t.done)).child(tr("now.thisMac"))
        : machineTag(t, g.name, { id: `hub-now-tag-${g.name}` });
      return h_flex().id(`hub-now-m-${g.name ?? "local"}`).flex_none().h(22).pl(g.name == null ? 8 : 0).pr(8).gap(6).items_center().rounded_full().bg(t.raised)
        .font_family(MONO).text_size(10.5).text_color(t.dim)
        .when(Boolean(g.go), (el) => el.cursor_pointer().hover((x) => x.bg(t.hover)).tooltip(tr("now.goTip", { name: g.go.tab_name || g.go.address }))
          .on_click((_e, cx) => { cx.stop_propagation(); this.go(g.go); }))
        .child(tag)
        .child(div().max_w(220).truncate().text_color(t.muted).child(s && !s.reachable && s.status === "login" ? `hc machine login ${g.name}` : text)); // i18n: tech
    }) : [];
    const on = this.keyed && this.cur === "now";
    return h_flex().id("hub-now").h(40).pl(12).pr(6).gap(10).items_center().rounded(12).border(1)
      .border_color(on ? alpha(t.accent, "99") : alpha(t.border, "00")).bg(alpha(t.raised, "99"))
      .child(n.working ? svg(SPIN).size(12).flex_none().spin(900).text_color(t.working)
        : div().size(8).flex_none().rounded_full().bg(dot).when(n.blocked > 0, (el) => el.loop("opacity", { from: 0.3, to: 1, period: 1200 })))
      .child(div().flex_1().min_w(0).truncate().text_size(13.5).text_color(parts.length ? t.foreground : t.muted).child(parts.length ? parts.join(" · ") : tr("now.none")))
      .children(pills)
      .when(Boolean(n.go), (el) => el.child(h_flex().id("hub-now-go").flex_none().h(26).px(10).gap(6).items_center().rounded_full()
        .border(1).border_color(alpha(dot, "66")).bg(alpha(dot, "14")).text_size(12).text_color(t.foreground).cursor_pointer()
        .hover((s) => s.bg(alpha(dot, "24"))).tooltip(tr("now.goTip", { name: n.go.tab_name || n.go.space_name || n.go.address }))
        .on_click((_e, cx) => { cx.stop_propagation(); this.go(n.go); })
        .child(tr("now.go")).child(svg(I("chevron-right")).size(12))));
  }

  // ---------- Temps agent (#89, after Apple's Screen Time) ----------

  // Agent time in hours past one (« 54 h 10 »: a day holds more than 24 h of agents running side by side).
  hours(sec) {
    const m = Math.round(sec / 60);
    return m < 60 ? tr("time.m", { m }) : tr("time.h", { h: Math.floor(m / 60), m: String(m % 60).padStart(2, "0") });
  }

  // The period shown and its figures, once per summary, day, registry and period (model.js): the average
  // and the one before, the chart's days by its 5 first projects (their registry color, else the next of
  // FALL), its scale in hours, the launches and the models of its days; tips, written after a render.
  timeOf() {
    const key = `${this.per}|${this.shift}|${this.sum.at}|${this.d.today}|${this.regKey}`;
    if (this.tm?.key === key) return this.tm;
    const s = this.sum, today = this.d.today;
    const P = period(this.per, this.shift, today), prev = period(this.per, this.shift + 1, today);
    const cur = spent(s, P), before = spent(s, prev);
    let spare = 0;
    const keys = cur.by.slice(0, 5).map((x, i) => {
      const pr = this.d.projects.get(x.key);
      return { k: `p${i}`, key: x.key, t: x.t, name: pr?.kind === "other" ? tr("proj.other") : pr?.name ?? "?", color: pr?.entry?.color ?? FALL[spare++ % FALL.length] };
    });
    const days = stacks(s, P, today, keys.map((x) => x.key));
    const scale = Scale.nice([...days.map((d) => d.reduce((a, x) => a + x.v, 0)), cur.avg].map((v) => v / 3600), true);
    this.tm = { key, P, cur, before, keys, days, scale, pct: spentDelta(cur, before), back: prev.keys.at(-1) >= this.d.first,
      launches: periodCounts(s.days, cur.use, "l"), models: periodCounts(s.days, cur.use, "mo"), tips: null };
    return this.tm;
  }

  // A day's tooltip each (dates are slow to write: in a task after the render that first shows the period).
  dayTips(tm) {
    return tm.P.keys.map((k, i) => {
      if (k > this.d.today) return "";
      const segs = tm.days[i], all = segs.reduce((s, x) => s + x.v, 0);
      const parts = tm.keys.map((x, j) => (segs[j]?.v ? `${x.name} ${this.hours(segs[j].v)}` : null)).filter(Boolean);
      const rest = segs.at(-1)?.v ?? 0;
      if (rest >= 60) parts.push(`${tr("time.others")} ${this.hours(rest)}`);
      return [tr("time.day", { d: tr("time.weekdays").split(" ")[(i + (tm.P.kind === "week" ? 0 : this.weekdayOf(tm.P.keys[0]))) % 7], date: date(`${k}T12:00:00`, { year: false }) }), all ? this.hours(all) : tr("time.nothing"), ...parts].join(" · ");
    });
  }

  // Monday 0 … Sunday 6.
  weekdayOf(day) {
    const [y, m, d] = day.split("-").map(Number);
    return (new Date(y, m - 1, d, 12).getDay() + 6) % 7;
  }

  periodLabel(P) {
    if (P.kind === "week") {
      if (P.shift < 2) return tr(P.shift ? "time.lastWeek" : "time.thisWeek");
      return `${date(`${P.keys[0]}T12:00:00`, { year: false })} – ${date(`${P.keys.at(-1)}T12:00:00`, { year: false })}`;
    }
    if (P.shift === 0) return tr("time.thisMonth");
    const [y, m] = P.keys[0].split("-").map(Number);
    const name = tr("time.months").split(" ")[m - 1] ?? "";
    return `${name.charAt(0).toUpperCase()}${name.slice(1)}${String(y) !== this.d.today.slice(0, 4) ? ` ${y}` : ""}`;
  }

  // The card: Semaine / Mois and the periods in its head; the average, the chart and its legend on the left;
  // the most active and the plan's limits on the right (under them when narrow).
  timeCard(t, fullW, i) {
    const tm = this.timeOf();
    const inner = fullW - CARD_X;
    const two = this.tier("time", inner) !== "narrow";
    const leftW = two ? Math.floor((inner - 24) * 0.59) : inner, rightW = two ? inner - 24 - leftW : inner;
    const pill = (k, label) => {
      const on = this.per === k;
      return h_flex().id(`hub-tm-${k}`).h(20).px(9).items_center().rounded_full().border(1)
        .border_color(on ? alpha(t.accent, "66") : alpha(t.accent, "00")).bg(on ? alpha(t.accent, "24") : alpha(t.accent, "00"))
        .font_family(MONO).text_size(10.5).text_color(on ? t.accent : t.muted)
        .when(!on, (el) => el.cursor_pointer().hover((s) => s.text_color(t.foreground)).on_click((_e, cx) => { cx.stop_propagation(); this.setPeriod(k); cx.notify(); }))
        .child(label);
    };
    const arrow = (id, icon, tip, by, on) => div().id(id).size(24).flex_none().rounded_full().flex().items_center().justify_center()
      .text_color(on ? t.muted : t.dim).when(!on, (el) => el.opacity(0.4))
      .when(on, (el) => el.cursor_pointer().hover((s) => s.bg(t.hover).text_color(t.foreground)).tooltip(tip)
        .on_click((_e, cx) => { cx.stop_propagation(); this.stepPeriod(by); cx.notify(); }))
      .child(svg(I(icon)).size(13));
    const week = this.per === "week";
    const right = h_flex().flex_none().gap(4).items_center()
      .child(h_flex().flex_none().p(2).gap(2).items_center().rounded_full().border(1).border_color(t.border).bg(t.background)
        .child(pill("week", tr("time.week"))).child(pill("month", tr("time.month"))))
      .child(div().w(6))
      .child(arrow("hub-tm-prev", "chevron-left", tr(week ? "time.prevWeek" : "time.prevMonth"), 1, tm.back))
      .child(div().w(112).flex_none().flex().justify_center().font_family(MONO).text_size(11.5).text_color(t.foreground).child(this.periodLabel(tm.P)))
      .child(arrow("hub-tm-next", "chevron-right", tr(week ? "time.nextWeek" : "time.nextMonth"), -1, this.shift > 0));
    const jd = date(`${this.sum.junction}T12:00:00`, { year: false });
    const left = v_flex().w(leftW).flex_none().gap(12)
      .child(this.timeAvg(t, tm, jd))
      .child(this.timeChart(t, tm, leftW))
      .child(this.timeLegend(t, tm))
      .when(tm.P.keys[0] < (this.sum.junction ?? ""), (el) => el.child(div().text_size(11).line_height("16px").text_color(t.dim)
        .child(`${tr("time.pre", { date: jd })}${tm.cur.cut ? ` ${tr("time.preAvg", { date: jd })}` : ""}`)));
    const side = v_flex().w(rightW).flex_none().gap(8).child(this.mostPanel(t, tm)).child(div().flex_1()).child(this.limitsBlock(t));
    return this.card(t, "time", tr("time.title"), null, right, (two ? div().flex().gap(24) : v_flex().gap(16)).child(left).child(side), i);
  }

  // The daily average (its suffix: « d'agent »), its change against the period before (on the days that
  // period knows from the junction, said so), the total over the days it counts.
  timeAvg(t, tm, jd) {
    const fg = (a) => faint(t.foreground, a);
    const { P, cur, before, pct } = tm;
    const vs = tr(P.kind === "week" ? (P.shift ? "time.vsWeekBefore" : "time.vsWeek") : P.shift ? "time.vsMonthBefore" : "time.vsMonth");
    const change = pct == null ? [cur.avg ? div().min_w(0).truncate().text_color(fg(0.55)).child(tr("time.noCompare", { date: jd })) : null]
      : pct === 0 ? [div().text_color(fg(0.55)).child(tr("time.same"))]
        : [h_flex().flex_none().gap(4).font_family(MONO).text_color(pct < 0 ? t.ansi1 : t.ansi2).child(pct < 0 ? "▼" : "▲").child(tr("pct", { n: Math.abs(pct) })),
          div().min_w(0).truncate().text_color(fg(0.55)).child(`${vs}${before.cut ? ` (${tr("time.since", { date: jd })})` : ""}`)];
    const days = cur.cut ? tr("time.daysSince", { days: tr("time.days", { n: cur.known }), date: jd })
      : P.passed.length === P.keys.length ? tr("time.days", { n: P.keys.length }) : tr("time.passed", { n: P.passed.length });
    return v_flex().id("hub-tm-avg").gap(2).tooltip(tr("tip.a"))
      .child(div().text_size(12).text_color(fg(0.6)).child(tr("time.avg")))
      .child(h_flex().gap(6).items_end()
        .child(div().text_size(28).font_semibold().text_color(t.foreground).child(roll(this.m, "hub-tm-avg-v", this.hours(cur.avg), 36)))
        .child(div().pb(5).text_size(12).text_color(t.muted).child(tr("time.unit"))))
      .child(h_flex().h(16).gap(8).items_center().text_size(12).children(change.filter(Boolean)))
      .child(div().text_size(11).text_color(t.dim).child(cur.total ? tr("time.total", { t: this.hours(cur.total), days }) : tr("time.none")));
  }

  // The chart (#89): the days stacked by project, one image (trame.js); over it, the hours on the right, the
  // grid, the days under it (the week's names, the month's every 5th, today in bold), the dashed average and
  // a tooltip a day.
  timeChart(t, tm, w) {
    const AX = 46, TOP = 14, BOT = 22, H = tm.P.kind === "week" ? 196 : 186;
    const pw = Math.floor((w - AX) / 3) * 3, ph = Math.floor((H - TOP - BOT) / 3) * 3;
    const max = tm.scale.max * 3600;
    const colors = Object.fromEntries([...tm.keys.map((x) => [x.k, this.colorOf(t, x)]), ["o", t.dim]]);
    const data = JSON.stringify([tm.days.map((d) => d.map((x) => Math.round(x.v / 60))), tm.scale.max]);
    const img = this.trame(`st-${tm.P.kind}`, "st", data, `${Object.values(colors).join(",")}|${pw}|${ph}|${TRAME.scale}`, pw, ph,
      () => stackSvg(tm.days, max, pw, ph, colors, { scale: TRAME.scale }).svg);
    const axis = faint(t.foreground, 0.45), y = (v) => TOP + ph - (v / max) * ph, band = pw / tm.days.length;
    const lbl = (s, x, top, ww, align, color = axis, bold = false) => div().absolute().left(Math.round(x)).top(Math.round(top - 7)).w(ww).h(14).flex().items_center()
      .when(align === "center", (e) => e.justify_center()).when(align === "end", (e) => e.justify_end())
      .whitespace_nowrap().font_family(MONO).text_size(10).text_color(color).when(bold, (e) => e.font_semibold()).child(s);
    const today = tm.P.keys.indexOf(this.d.today);
    const wd = tr("time.weekdays").split(" ");
    const xs = tm.P.keys.map((k, i) => {
      const n = Number(k.slice(8));
      if (tm.P.kind === "week") return `${wd[i]} ${n}`;
      return i === 0 || n % 5 === 0 || i === today ? String(n) : "";
    });
    const kids = [
      ...tm.scale.ticks().flatMap((v) => [div().absolute().left(0).top(Math.round(y(v * 3600))).w(pw).h(1).bg(faint(t.foreground, v ? 0.07 : 0.16)),
        lbl(`${num(v)} h`, pw + 8, y(v * 3600), AX - 8, "start")]),
      ...xs.map((s, i) => (s ? lbl(s, band * (i + 0.5) - 40, TOP + ph + 12, 80, "center", i === today ? t.foreground : axis, i === today) : null)).filter(Boolean),
      div().absolute().left(0).top(TOP).child(img ? reveal(this.m, `hub-st-${tm.P.kind}`, img.w, img.h, image(img.path).w(img.w).h(img.h)) : div().w(pw).h(ph)),
      ...(tm.cur.avg > 0 && tm.cur.avg <= max ? [div().absolute().left(0).top(Math.round(y(tm.cur.avg))).w(pw).h(0).border_t(1).border_dashed().border_color(t.done),
        lbl(tr("time.avgLine"), pw - 40, y(tm.cur.avg) - 9, 40, "end", t.done)] : []),
      ...(tm.tips ?? []).map((tip, i) => (tip ? div().id(`hub-tm-d${i}`).absolute().left(Math.round(band * i)).top(TOP).w(Math.max(1, Math.round(band))).h(ph).tooltip(tip) : null)).filter(Boolean),
    ];
    return div().relative().w(w).h(H).flex_none().children(kids);
  }

  // The 5 projects in their colors and the rest, each with its time on the period.
  timeLegend(t, tm) {
    const other = tm.cur.total - tm.keys.reduce((s, x) => s + x.t, 0);
    const item = (id, color, name, sec) => h_flex().id(id).flex_none().gap(6).items_center().font_family(MONO).text_size(11).text_color(faint(t.foreground, 0.7))
      .child(swatch(color)).child(name).child(div().text_color(t.dim).child(this.hours(sec)));
    return h_flex().flex_wrap().gap(10).children([...tm.keys.map((x) => item(`hub-tm-l${x.k}`, this.colorOf(t, x), x.name, x.t)),
      ...(other >= 60 ? [item("hub-tm-lo", t.dim, tr("time.others"), other)] : [])]);
  }

  // Les plus actifs (#89), on the period's days: the projects by agent time (the chart's colors; archived
  // dimmed and said), the workflows and skills by launches (their family's color), the models by messages.
  // 6 rows, then « Voir les N projets » (enter) or how many more.
  mostPanel(t, tm) {
    const colorOfKey = new Map(tm.keys.map((x) => [x.key, x]));
    let list;
    if (this.most === "proj") {
      list = tm.cur.by.map((x) => {
        const pr = this.d.projects.get(x.key);
        const name = pr?.kind === "other" ? tr("proj.other") : pr?.name ?? "?";
        const c = colorOfKey.get(x.key) ?? (pr?.entry?.color ? pr.entry : null);
        const arch = archived(pr?.entry);
        return { id: hash(x.key), lead: this.tile(t, { kind: pr?.kind, entry: pr?.entry, name }), name, v: x.t, text: this.hours(x.t), color: c ? this.colorOf(t, c) : t.dim,
          dim: arch, pills: [!pr?.entry && (pr?.kind === "repo" || pr?.kind === "gh") ? this.pill(t, tr("proj.unlisted")) : null, arch ? this.pill(t, tr("proj.archived")) : null].filter(Boolean),
          tip: tr("most.tipProj", { name, t: this.hours(x.t) }) };
      });
    } else if (this.most === "launch") {
      list = tm.launches.map(([n, c]) => {
        const f = familyOf(n), color = t[FAMILY[f]] ?? t.dim;
        return { id: hash(n), lead: div().size(6).flex_none().rounded_full().bg(color), name: f === "command" ? `/${n}` : n, mono: true, v: c, text: `× ${num(c)}`, color,
          tip: tr("most.tipLaunch", { name: n, fam: tr(`fam.${f}`), n: c }) };
      });
    } else {
      list = tm.models.map(([n, c], k) => {
        const color = t[SERIES[k % 6]] ?? t.accent;
        return { id: hash(n), lead: div().size(6).flex_none().rounded_full().bg(color), name: n, mono: true, v: c, text: num(c), color, tip: tr("most.tipModel", { name: n, n: c }) };
      });
    }
    const all = this.most === "proj" && this.projAll, shown = all ? list : list.slice(0, PROJ_MAX), max = Math.max(1, ...list.map((x) => x.v));
    const row = (x) => h_flex().id(`hub-mu-${this.most}-${x.id}`).h(28).px(4).gap(10).items_center().rounded(8).hover((s) => s.bg(t.hover)).tooltip(x.tip)
      .when(Boolean(x.dim), (el) => el.opacity(0.55))
      .child(x.lead)
      .child(h_flex().flex_1().min_w(0).gap(8).items_center()
        .child(div().min_w(0).truncate().text_size(x.mono ? 11.5 : 12.5).when(Boolean(x.mono), (e) => e.font_family(MONO)).text_color(t.foreground).child(x.name))
        .children(x.pills ?? []))
      .child(this.bar(t, 96, x.v / max, x.color, `mu:${this.most}:${x.id}`))
      .child(div().w(64).flex_none().flex().justify_end().font_family(MONO).text_size(11).text_color(t.foreground).child(x.text));
    const more = list.length <= PROJ_MAX ? null
      : this.most === "proj" ? h_flex().id("hub-tm-more").h(28).gap(6).items_center().justify_center().rounded(8).cursor_pointer()
        .font_family(MONO).text_size(11).text_color(t.muted).hover((s) => s.bg(t.hover).text_color(t.foreground))
        .on_click((_e, cx) => { cx.stop_propagation(); this.projAll = !this.projAll; cx.notify(); })
        .child(this.projAll ? tr("proj.less") : tr("proj.more", { n: list.length })).child(svg(I(this.projAll ? "chevron-up" : "chevron-down")).size(12))
        : div().px(4).text_size(11).text_color(t.dim).child(tr("most.others", { n: list.length - PROJ_MAX }));
    const tab = (k) => {
      const on = this.most === k;
      return h_flex().id(`hub-mu-tab-${k}`).h(20).px(9).items_center().rounded_full().border(1)
        .border_color(on ? alpha(t.accent, "66") : alpha(t.accent, "00")).bg(on ? alpha(t.accent, "24") : alpha(t.accent, "00"))
        .font_family(MONO).text_size(10.5).text_color(on ? t.accent : t.muted)
        .when(!on, (el) => el.cursor_pointer().hover((s) => s.text_color(t.foreground)).on_click((_e, cx) => { cx.stop_propagation(); this.most = k; cx.notify(); }))
        .child(tr(`most.${k}`));
    };
    return v_flex().gap(6)
      .child(h_flex().gap(8).items_center().min_w(0)
        .child(div().flex_none().font_family(MONO).text_size(10).text_color(t.dim).child(tr("most.title").toUpperCase()))
        .child(div().min_w(0).truncate().text_size(11).text_color(t.dim).child(tr(`most.unit.${this.most}`))))
      .child(h_flex().child(h_flex().flex_none().p(2).gap(2).items_center().rounded_full().border(1).border_color(t.border).bg(t.background).children(MOST.map(tab))))
      .child(list.length ? v_flex().gap(2).children(shown.map(row)).when(Boolean(more), (el) => el.child(more))
        : this.empty(t, this.most === "proj" ? I("folder") : this.most === "launch" ? I("workflow") : I("bot"), tr("most.none")));
  }

  // The plan's limits (#89), as the bottom bar's peek shows them (kt-threads' usagePeek, model.js' planLimits):
  // the 7 day window from the newer of the statusLine's reading and kt-usage's summary, the 5 h one from the
  // statusLine; their part used (accent, blocked from 75 %, red from 90 %), when they reset, how old the
  // reading is (its oldest source); a window reset since it was read, or that Claude Code doesn't report,
  // said so.
  limitsBlock(t) {
    const q = planLimits(this.qText, shared("kt.usage.summary"), Date.now());
    const tone = (u) => (u >= 90 ? t.ansi1 : u >= 75 ? t.blocked : t.accent);
    const ats = [q?.five?.at, q?.seven?.at].filter((x) => x > 0);
    const row = (id, label, win, none) => (win && !win.stale
      ? h_flex().id(id).h(24).px(4).gap(10).items_center()
        .tooltip(tr("limit.tip", { label, n: win.used, date: date(win.resets, { year: false }), time: time(win.resets) }))
        .child(div().w(52).flex_none().font_family(MONO).text_size(11).text_color(t.muted).child(label))
        .child(this.bar(t, 96, win.used / 100, tone(win.used), `lim:${id}`))
        .child(div().w(36).flex_none().flex().justify_end().font_family(MONO).text_size(11).text_color(t.foreground).child(tr("pct", { n: win.used })))
        .child(div().flex_1().min_w(0).truncate().text_size(11.5).text_color(t.muted).child(tr("limit.resets", { in: duration(Math.max(0, win.resets - Date.now())) })))
      : h_flex().id(id).h(24).px(4).gap(10).items_center()
        .child(div().w(52).flex_none().font_family(MONO).text_size(11).text_color(t.muted).child(label))
        .child(div().flex_1().min_w(0).truncate().text_size(11.5).text_color(t.dim).child(win?.stale ? tr("limit.stale") : none)));
    return v_flex().gap(4).pt(10).border_t(1).border_dashed().border_color(t.border)
      .child(h_flex().gap(8).items_center()
        .child(div().flex_none().font_family(MONO).text_size(10).text_color(t.dim).child(tr("limit.title").toUpperCase()))
        .child(div().flex_1())
        .when(ats.length > 0, (el) => el.child(this.hint(t, tr("limit.read", { ago: relative(Math.min(...ats)) })))))
      .child(row("hub-lim-5h", tr("limit.h5"), q?.five, tr("limit.none5")))
      .child(row("hub-lim-7d", tr("limit.d7"), q?.seven, q ? tr("limit.none7") : tr("limit.unread")));
  }

  // ---------- activity ----------

  // A year in trame (#76): its squares one image (trame.js), centred in `width`; months over the weeks they
  // begin, Lun/Mer/Ven beside their rows, the junction's step line, a tooltip per week over the image; under
  // it, the total on the left (and `extras`), the legend (the same squares) on the right.
  yearBody(t, { slot, h, tint, mark, markTip, word = "act.week", total, extras = [], width }) {
    const gutter = 30, top = 16;
    const avail = Math.max(60, width - gutter);
    const [Y, M, D] = h.start.split("-").map(Number);
    const offset = (new Date(Y, M - 1, D, 12).getDay() + 6) % 7;
    const n = calN(h.levels, offset, avail);
    const gk = `${n}|${avail}`;
    if (h.gridKey !== gk) {
      const g = calendarGrid(h.levels, offset, avail, n);
      // The 1st of each month in range (a Date per month, not per day: #50's ~10 ms), at its week's column;
      // the first goes when the next is under 3 weeks away.
      const starts = [];
      const t0 = new Date(Y, M - 1, D, 12).getTime();
      for (let k = 0; k < 12; k++) {
        const i = Math.round((new Date(Y, M - 1 + k, 1, 12).getTime() - t0) / 864e5);
        const col = Math.floor((offset + i) / 7) - g.skip;
        if (i >= 0 && i < h.levels.length && col >= 0) starts.push([col, (M - 1 + k) % 12]);
      }
      if (starts.length > 1 && starts[1][0] - starts[0][0] < 3) starts.shift();
      g.months = starts;
      h.grid = g;
      h.gridKey = gk;
    }
    const g = h.grid;
    const ink = t[tint] ?? tint, track = faint(t.foreground, 0.07), axis = faint(t.foreground, 0.45);
    const img = this.trame(slot, "cal", `${h.start}|${h.levels.map((v) => v ?? "-").join("")}`, `${ink}|${track}|${n}|${avail}|${TRAME.use}|${TRAME.scale}`, g.width, g.height,
      () => calendarSvg(h.levels, offset, avail, ink, track, { n, use: TRAME.use, scale: TRAME.scale }).svg);
    const lbl = (s, x, y, w) => div().absolute().left(Math.round(x)).top(Math.round(y - 7)).w(w).h(14).flex().items_center().whitespace_nowrap()
      .font_family(MONO).text_size(10).text_color(axis).child(s);
    const months = tr("act.months").split(" "), days = tr("act.weekdays").split(" ");
    const kids = [
      ...g.months.map(([col, k]) => lbl(months[k] ?? "", gutter + col * g.pitch, top / 2, 60)),
      ...days.slice(0, 3).map((l, k) => lbl(l, 0, top + 2 * k * g.pitch + g.square / 2, gutter)),
      div().absolute().left(gutter).top(top).child(img ? reveal(this.m, `hub-${slot}`, img.w, img.h, image(img.path).w(img.w).h(img.h))
        : div().w(g.width).h(g.height).rounded(4).bg(faint(t.foreground, 0.03))),
    ];
    // Where two sources meet: the line between the days before and after, a step in a week cut there.
    if (mark != null && mark > 0 && mark < h.levels.length) {
      const col = Math.floor((offset + mark) / 7) - g.skip, row = (offset + mark) % 7, x = (c) => gutter + c * g.pitch - 2;
      if (col >= 0) {
        const seg = (k, l, tp, ww, hh) => div().id(`hub-${slot}-mark${k}`).absolute().left(l).top(tp).w(ww).h(hh).bg(axis).when(Boolean(markTip), (e) => e.tooltip(markTip));
        kids.push(seg(0, x(col), top + row * g.pitch - 2, 1, (7 - row) * g.pitch));
        if (row > 0) kids.push(seg(1, x(col), top + row * g.pitch - 2, g.pitch + 1, 1), seg(2, x(col + 1), top - 2, 1, row * g.pitch));
      }
    }
    // A tooltip per week (a square each would be 371 elements): its first and last day in range.
    for (let c = 0; c < g.cols; c++) {
      const from = Math.max(0, (c + g.skip) * 7 - offset), to = Math.min(h.levels.length - 1, (c + g.skip) * 7 - offset + 6);
      if (from <= to && h.levels[from] != null) kids.push(div().id(`hub-${slot}-w${c}`).absolute().left(gutter + c * g.pitch).top(top).w(g.pitch).h(g.height).tooltip(this.weekTip(h, from, to, word)));
    }
    const legW = 5 * (n * 3 + 3) - 3;
    const leg = this.trame(`${slot}-leg`, "leg", "01234", `${ink}|${track}|${n}|${TRAME.scale}`, legW, n * 3, () => squaresSvg([0, 1, 2, 3, 4], 3, ink, track, { n, scale: TRAME.scale }).svg);
    return v_flex().gap(10)
      .child(h_flex().justify_center().child(div().relative().w(gutter + g.width).h(top + g.height).flex_none().children(kids)))
      .child(h_flex().gap(10).items_center().min_w(0).font_family(MONO).text_size(11).text_color(t.muted)
        .child(div().flex_none().child(total))
        .children(extras)
        .child(div().flex_1())
        .child(h_flex().flex_none().gap(6).items_center().text_size(10).text_color(axis)
          .child(tr("act.less")).child(leg ? image(leg.path).w(leg.w).h(leg.h) : div().w(legW).h(n * 3)).child(tr("act.more"))));
  }

  actCard(t, colW, i) {
    const gh = this.source === "github";
    const ys = gh ? this.ghYears() : this.d.years;
    const shownYear = gh ? this.ghYear : this.year;
    const yi = ys.indexOf(shownYear);
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
      .child(arrow("hub-y-prev", "chevron-left", tr("act.prev"), -1, yi > 0))
      .child(div().font_family(MONO).text_size(12).text_color(t.foreground).child(String(shownYear ?? "")))
      .child(arrow("hub-y-next", "chevron-right", tr("act.next"), 1, yi >= 0 && yi < ys.length - 1));
    const width = colW - CARD_X;
    if (gh) return this.card(t, "act", tr("act.title"), null, right, this.ghBody(t, width), i);
    const h = this.year != null ? this.heatOf(this.year) : null;
    if (!h) return this.card(t, "act", tr("act.title"), null, right, this.empty(t, H("calendar"), tr("act.none")), i);
    const junction = this.sum.junction;
    return this.card(t, "act", tr("act.title"), null, right, this.yearBody(t, { slot: `cal-${this.year}`, h, tint: "accent",
      mark: h.split > 0 ? h.split : null, markTip: junction ? tr("act.mark", { date: date(`${junction}T12:00:00`, { year: true }) }) : null,
      total: tr("act.total", { active: num(h.active), sessions: num(h.sessions) }), width }), i);
  }

  // GitHub's year (#48): its own levels, its total and the private contributions it counts without detail;
  // before its first read, a bar breathing; gh failing, said under what was shown.
  ghBody(t, width) {
    const y = this.ghYear;
    const e = this.gh.get(y);
    const v = e?.view;
    const err = this.ghErr ? div().text_size(12).text_color(t.ansi1).child(tr("act.ghError", { error: this.ghErr })) : null;
    if (!v) {
      const S = skeleton(t, this.m);
      return v_flex().gap(6).children([err ?? (e && !this.ghBusy.has(y) ? this.empty(t, H("calendar"), tr("act.ghNone")) : S.pulse(S.block(null, 120).id("hub-gh-sk")))]);
    }
    const extras = [
      ...(v.restricted > 0 ? [div().id("hub-gh-private").flex_none().text_color(t.dim).tooltip(tr("act.ghPrivateTip")).child(tr("act.ghPrivate", { n: num(v.restricted) }))] : []),
      div().flex_none().text_color(t.dim).child(this.ghBusy.has(y) ? tr("act.ghReading") : tr("act.ghAt", { ago: relative(e.cache.at) })),
    ];
    // The year as yearBody wants it, kept on its entry (its grid memoized there; a new read makes a new entry).
    e.h ??= { values: v.values, levels: v.levels, start: v.start, tips: e.tips };
    return v_flex().gap(6)
      .child(this.yearBody(t, { slot: `gh-${y}`, h: e.h, tint: "ansi2",
        word: "act.ghWeek", total: tr("act.ghTotal", { n: num(v.total), active: num(v.active) }), extras, width }))
      .when(Boolean(err), (el) => el.child(err));
  }

  // ---------- this week's launches and sub-agents ----------

  // The ranked rows in `cols` columns (ranked down, then across: a row stretched wide left a hole between
  // its name and its bar), a dithered bar each.
  rankRows(t, list, colorOf, emptyText, cols = 1) {
    if (!list.length) return this.empty(t, I("workflow"), emptyText);
    const shown = list.slice(0, 8);
    const max = Math.max(...shown.map((x) => x.n));
    const per = Math.ceil(shown.length / cols);
    const row = (x) => {
      const c = colorOf(x);
      const d = x.n - x.prev;
      return h_flex().id(`hub-r-${x.family ?? "sub"}-${x.name}`).h(24).gap(8).items_center().tooltip(tr("rank.tip", { name: x.name, n: x.n, prev: x.prev }))
        .child(div().size(6).flex_none().rounded_full().bg(c))
        .child(div().flex_1().min_w(0).truncate().font_family(MONO).text_size(11.5).text_color(t.foreground).child(x.name))
        .child(this.bar(t, 96, x.n / max, c, `rk:${x.family ?? "sub"}:${x.name}`))
        .child(div().w(28).flex_none().flex().justify_end().font_family(MONO).text_size(11.5).text_color(t.foreground).child(num(x.n)))
        .child(div().w(30).flex_none().flex().justify_end().font_family(MONO).text_size(10).text_color(d > 0 ? t.ansi2 : d < 0 ? t.ansi1 : t.dim)
          .child(d ? `${d > 0 ? "+" : "−"}${Math.abs(d)}` : "="));
    };
    return h_flex().items_start().gap(32).children(Array.from({ length: cols }, (_, j) => v_flex().flex_1().min_w(0).gap(2).children(shown.slice(j * per, (j + 1) * per).map(row))));
  }

  // The week's sub-agents (a donut; #89: « Workflows et skills » is a tab of Les plus actifs now), between
  // Next and Recent, the donut centred in what it's given.
  subsCard(t, i) {
    const subs = this.d.subs;
    return this.card(t, "subs", tr("sub.title"), subs.reduce((s, x) => s + x.n, 0), this.hint(t, tr("sub.week")), v_flex().flex_1().justify_center()
      .child(subs.length ? this.donut(t, subs.slice(0, 6)) : this.empty(t, I("bot"), tr("sub.none"))), i);
  }

  // The sub-agents as viz.donut draws a ring (its ring an image, trame.js: ~400 rectangles in paths), its
  // caption and total in the hole, its legend beside it.
  donut(t, list) {
    const size = 132, values = list.map((x) => x.n), total = values.reduce((s, v) => s + v, 0);
    const colors = list.map((_, k) => t[SERIES[k % 6]] ?? t.accent);
    const img = this.trame("subs", "dn", values.join(","), `${colors.join(",")}|${size}|${TRAME.scale}`, size, size, () => donutSvg(values, size, colors, { scale: TRAME.scale }).svg);
    // viz.donut's hole: outer 60 px from the centre (66), inner 21 px further in (39).
    const inner = 39, figure = num(total), fit = Math.floor(Math.min(26, (inner * 2 - 16) / (figure.length * 0.62)));
    const label = (s, y, lh, size2, color, semibold, mono) => div().absolute().left(0).top(Math.round(y - lh / 2)).w(size).h(lh).flex().items_center().justify_center()
      .whitespace_nowrap().text_size(size2).text_color(color).when(semibold, (e) => e.font_semibold()).when(mono, (e) => e.font_family(MONO)).child(s);
    const fg = (a) => faint(t.foreground, a);
    const ring = div().relative().size(size).flex_none()
      .child(img ? reveal(this.m, "hub-subs-ring", img.w, img.h, image(img.path).w(img.w).h(img.h)) : div().size(size))
      .child(label(tr("sub.caption").toUpperCase(), size / 2 - 16, 13, 10, fg(0.45), false, true))
      .child(label(figure, size / 2 + 4, Math.ceil(fit * 1.3), fit, t.foreground, true, false));
    const rows = list.map((x, k) => h_flex().gap(8).items_center().text_size(12)
      .child(swatch(colors[k]))
      .child(div().flex_1().min_w(0).truncate().text_color(fg(0.8)).child(x.name))
      .child(div().flex_none().font_family(MONO).text_color(fg(0.5)).child(`${num(x.n)} · ${tr("pct", { n: total ? Math.round((x.n / total) * 100) : 0 })}`)));
    return h_flex().flex_wrap().items_center().gap(24).child(ring).child(v_flex().flex_1().min_w(140).max_w(320).gap(8).children(rows));
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
    // Without a logo: the initial on the logos' dithered background of its color (projtile.js); not
    // in the registry, the whole tile at 40 %.
    return projTile(this.tiles, { color: fill, size: 20,
      letter: div().font_family(MONO).font_bold().text_size(11).text_color(LETTER).child(([...name][0] ?? "?").toUpperCase()) })
      .when(!r.entry, (el) => el.opacity(0.4));
  }

  // A pill after a project's name: not in the registry, archived (#88).
  pill(t, text) {
    return div().flex_none().h(16).px(6).flex().items_center().rounded_full().border(1).border_color(t.border).font_family(MONO).text_size(9.5).text_color(t.dim).child(text);
  }

  // ---------- tracked workflows (#76: week by week, then a funnel per workflow) ----------

  flowsCard(t, fullW, i) {
    const F = this.d.fl, W = F.weeks;
    if (!W.total) return this.card(t, "flows", tr("flows.title"), null, null, this.empty(t, I("git-pull-request"), tr("flows.none")), i);
    const inner = fullW - CARD_X;
    const fg = (a) => faint(t.foreground, a);
    const kw = Math.floor((inner - 16) / 3);
    const kpi = (id, name, value, detail, tip) => v_flex().id(`hub-fk-${id}`).w(kw).flex_none().px(14).py(12).gap(4).rounded(12).border(1).border_color(t.border).bg(t.raised)
      .when(Boolean(tip), (el) => el.tooltip(tip))
      .child(div().truncate().text_size(12).text_color(fg(0.6)).child(name))
      .child(div().text_size(24).font_semibold().text_color(t.foreground).child(roll(this.m, `hub-fk-${id}-v`, value, 31)))
      .child(div().truncate().text_size(12).text_color(fg(0.55)).child(detail));
    const kpis = h_flex().gap(8)
      .child(kpi("merged", tr("flows.merged"), num(W.mergedTotal), tr("flows.mergedOf", { n: W.total })))
      .child(kpi("span", tr("flows.span"), W.median != null ? duration(W.median) : "—", tr("flows.spanOf", { n: W.spanN }), tr("flows.spanTip")))
      .child(kpi("waiting", tr("flows.waiting"), num(W.open), W.oldest ? tr("flows.oldest", { ago: relative(W.oldest.c1, { bare: true }) }) : ""));
    // The weeks beside what blocks (under each other when narrow): the chart's series in the colors of the
    // phases they stand for, active (implementation) and merged (wrap-up); no per-week phase is invented.
    const two = this.tier("flows", inner) !== "narrow";
    const half = two ? Math.floor((inner - 16) / 2) : inner;
    const flowName = (f) => `${String(f.repo ?? "").split("/").pop()}#${f.issue ?? "?"}`; // i18n: tech
    // The chart's new values wait a render when other paths were built in this one (built()): the old ones
    // are still in viz.js' memo, so drawing them costs nothing.
    const want = { active: W.active, merged: W.merged, labels: W.starts.map((s) => date(s, { year: false })), half };
    const key = JSON.stringify(want);
    if (this.heavy >= 3 && this.chartKey !== key) {
      if (this.builds > 0 && this.chartLast) this.later = true;
      else { this.chartKey = key; this.chartLast = want; this.builds += BUILD_MAX; }
    }
    const cv = this.chartLast ?? want;
    const chart = v_flex().w(half).flex_none().gap(6).child(this.sub(t, tr("flows.byWeek")))
      .child(this.heavy < 3 || cv.half !== half ? div().w(half).h(150 + 26) : this.V.chart("bar", [
        { label: tr("flows.active"), values: cv.active, color: PHASE_COLOR.impl },
        { label: tr("flows.mergedS"), values: cv.merged, color: PHASE_COLOR.close },
      ], { labels: cv.labels, height: 150, width: half, id: "hub-fl-weeks" }));
    const blocks = v_flex().w(half).flex_none().gap(2).child(this.sub(t, tr("flows.blocks")))
      .children(W.blocks.slice(0, 6).map((b) => {
        const c = t[PHASE_COLOR[phaseOf(b.step)]] ?? t.muted;
        return h_flex().id(`hub-fb-${b.step}`).h(26).gap(8).items_center().tooltip(b.flows.map(flowName).join(" · "))
          .child(div().w(104).flex_none().h(18).flex().items_center().justify_center().rounded_full().border(1).border_color(alpha(c, "4d")).bg(alpha(c, "1a"))
            .font_family(MONO).text_size(10.5).text_color(c).child(b.step ? tr(`step.${b.step}`) : "?"))
          .child(div().w(56).flex_none().font_family(MONO).text_size(11).text_color(t.foreground).child(tr("flows.n", { n: b.n })))
          .child(div().flex_1().min_w(0).truncate().text_size(12.5).text_color(t.muted)
            .child(b.oldest ? tr("flows.oldestIs", { name: flowName(b.oldest), ago: relative(b.oldest.c1) }) : b.flows.map(flowName).join(", ")));
      }));
    // The funnels, two a row (one when narrow; an odd last one as wide as the row: no hole).
    const fs = F.funnels;
    const per = two ? 2 : 1;
    const legend = h_flex().flex_none().gap(10).items_center().children(PHASES.filter((p) => p.id !== "spec").map((p) => h_flex().gap(4).items_center()
      .font_family(MONO).text_size(10.5).text_color(t.dim).child(div().size(6).rounded_full().bg(t[PHASE_COLOR[p.id]])).child(p.label.toLowerCase())));
    const rowsOf = [];
    for (let k = 0; k < fs.length; k += per) {
      const row = fs.slice(k, k + per);
      const w = Math.floor((inner - 8 * (row.length - 1)) / row.length);
      rowsOf.push(h_flex().gap(8).items_start().children(row.map((f) => this.funnelCard(t, f, w))));
    }
    return this.card(t, "flows", tr("flows.title"), W.total, this.hint(t, tr("flows.hint")), v_flex().gap(12)
      .child(kpis)
      .child((two ? h_flex().items_start().gap(16) : v_flex().gap(12)).child(chart).child(blocks))
      .child(h_flex().gap(8).items_center().child(div().flex_1().child(this.sub(t, tr("flows.byWf")))).child(legend))
      .child(v_flex().gap(8).children(rowsOf)), i);
  }

  // A workflow's funnel: its color and name, then for each step from the issue to the note how many of its
  // flows passed it (a dithered bar in the color of the step's phase: the 8 bars one image, trame.js) and
  // how many are at it now. Rows of FN_ROW px: the image's bars sit in them.
  funnelCard(t, f, w) {
    const FN_ROW = 26;
    const color = t[wfColor(f.workflow)] ?? t.accent;
    const barW = Math.floor(Math.max(42, w - CARD_X - 100 - 24 - 40 - 76 - 4 * 10) / 3) * 3;
    const colors = f.steps.map((s) => t[PHASE_COLOR[phaseOf(s.id)]] ?? t.accent);
    const ratios = f.steps.map((s) => (f.total ? s.passed / f.total : 0));
    const img = this.trame(`fn-${f.workflow}`, "fn", ratios.map((r) => Math.round(r * 1000)).join(","), `${colors.join(",")}|${barW}|${TRAME.scale}`, barW, f.steps.length * FN_ROW,
      () => funnelSvg(ratios.map((ratio, k) => ({ ratio, color: colors[k] })), barW, FN_ROW, { scale: TRAME.scale }).svg);
    const tip = (s) => { const name = tr(`step.${s.id}`); return s.current ? tr("flows.passedNow", { step: name, n: s.passed, total: f.total, cur: s.current }) : tr("flows.passed", { step: name, n: s.passed, total: f.total }); };
    const col = (w2, cell) => v_flex().w(w2).flex_none().children(f.steps.map((s, k) => div().id(`hub-fn-${f.workflow ?? "none"}-${w2}-${k}`).h(FN_ROW).flex().items_center().tooltip(tip(s)).child(cell(s))));
    return v_flex().id(`hub-fn-${f.workflow ?? "none"}`).w(w).flex_none().px(14).py(12).gap(6).rounded(12).border(1).border_color(alpha(color, "4d")).bg(t.raised)
      .child(h_flex().h(20).gap(8).items_center().min_w(0)
        .child(div().size(8).flex_none().rounded_full().bg(color))
        .child(div().flex_none().text_size(13).font_semibold().text_color(t.foreground).child(workflowName(f.workflow)))
        .child(div().min_w(0).truncate().font_family(MONO).text_size(10.5).text_color(t.dim).child(f.workflow ?? ""))
        .child(div().flex_1())
        .child(div().flex_none().font_family(MONO).text_size(11).text_color(t.muted).child(`${tr("flows.n", { n: f.total })} · ${tr("flows.wfMerged", { n: f.merged })}`)))
      .child(h_flex().gap(10).items_start()
        .child(col(100, (s) => div().truncate().font_family(MONO).text_size(10.5).text_color(t.muted).child(tr(`step.${s.id}`))))
        .child(img ? reveal(this.m, `hub-fn-${f.workflow}-img`, img.w, img.h, image(img.path).w(img.w).h(img.h)) : div().w(barW).h(f.steps.length * FN_ROW))
        .child(col(24, (s) => div().w_full().flex().justify_end().font_family(MONO).text_size(11).text_color(t.foreground).child(num(s.passed))))
        .child(col(40, (s) => div().w_full().flex().justify_end().font_family(MONO).text_size(10.5).text_color(t.dim).child(tr("pct", { n: f.total ? Math.round((s.passed / f.total) * 100) : 0 }))))
        .child(col(76, (s) => div().truncate().font_family(MONO).text_size(10.5).text_color(t.working).child(s.current ? tr("flows.running", { n: s.current }) : ""))));
  }

  // ---------- Machines (Kylian's request of 2026-11-19) ----------

  // A column per machine, as wide and as tall as the other (under each other when narrow): this Mac, then
  // main-vps when Herdr knows it. The iPhone: nothing yet (Herdr doesn't know it; iOS gives no app the
  // system's CPU or memory).
  machinesCard(t, fullW, i) {
    const inner = fullW - CARD_X;
    const cols = [null, ...(machineList().some((m) => m.name === VPS) ? [VPS] : [])];
    const two = cols.length > 1 && this.tier("hosts", inner) !== "narrow";
    const w = two ? Math.floor((inner - 16 * (cols.length - 1)) / cols.length) : inner;
    return this.card(t, "hosts", tr("hosts.title"), null, this.hint(t, tr("hosts.hint")),
      (two ? h_flex().items_start().gap(16) : v_flex().gap(16)).children(cols.map((name) => this.hostCol(t, name, w))), i);
  }

  // A machine: its tag (this Mac's dot, else machines.js' with ROOT), what it is (cores, memory), how old its
  // figures are; then CPU (the load over the cores: past 100 % when the queue is longer), memory and disk,
  // each a dithered bar in the plan limit's tones. A machine away or to log in again: said, its last figures
  // dimmed (never the connection's reason, which can hold its address).
  hostCol(t, name, w) {
    const h = this.hosts, f = name ? h.vps : h.mac, s = name ? stateOf(name) : null;
    const away = Boolean(s && !s.reachable);
    const every = name ? VPS_EVERY : MAC_EVERY;
    const old = f?.at && Date.now() - f.at > 3 * every;
    const tone = (r) => (r >= 0.9 ? t.ansi1 : r >= 0.75 ? t.blocked : t.accent);
    const gib = (b) => num(b / 2 ** 30, b >= 100 * 2 ** 30 ? 0 : 1);
    const pct = (r) => tr("pct", { n: Math.round(r * 100) });
    const barW = Math.max(60, Math.min(140, Math.floor((w - 72 - 44 - 30) / 2 / 3) * 3));
    const row = (id, label, x, detail) => h_flex().id(`hub-host-${name ?? "mac"}-${id}`).h(26).gap(10).items_center()
      .child(div().w(72).flex_none().font_family(MONO).text_size(11).text_color(t.muted).child(label))
      .child(x ? this.bar(t, barW, Math.min(1, x.ratio), tone(x.ratio), `host:${name ?? "mac"}:${id}`) : div().w(barW).h(9).flex_none().bg(faint(t.foreground, 0.06)))
      .child(div().w(44).flex_none().flex().justify_end().font_family(MONO).text_size(11).text_color(x ? t.foreground : t.dim).child(x ? pct(x.ratio) : "…"))
      .child(div().flex_1().min_w(0).truncate().text_size(11.5).text_color(t.muted).child(x ? detail : ""));
    const tag = name ? machineTag(t, name, { id: `hub-host-tag-${name}` })
      : h_flex().gap(6).items_center().child(div().size(7).flex_none().rounded_full().bg(t.done)).child(div().text_size(12.5).font_medium().text_color(t.foreground).child(tr("now.thisMac")));
    const what = [f?.cpu && tr("hosts.cores", { n: f.cpu.cores }), f?.mem && tr("hosts.gib", { n: gib(f.mem.total) })].filter(Boolean).join(" · ");
    const login = name ? loginOf(name) : null;
    const state = away ? stateWord(name) : f?.at ? tr(old ? "hosts.old" : "hosts.read", { ago: relative(f.at) }) : tr("hosts.reading");
    return v_flex().id(`hub-host-${name ?? "mac"}`).w(w).flex_none().gap(4)
      .child(h_flex().h(24).gap(10).items_center()
        .child(tag)
        .child(div().min_w(0).truncate().font_family(MONO).text_size(10.5).text_color(t.dim).child(what))
        .child(div().flex_1())
        .child(div().flex_none().text_size(11).text_color(away || old ? t.blocked : t.dim).child(state)))
      .when(Boolean(login), (el) => el.child(h_flex().gap(8).items_center()
        .child(div().flex_1().min_w(0).truncate().font_family(MONO).text_size(11).text_color(t.foreground).child(login))
        .child(div().id(`hub-host-login-${name}`).flex_none().px(8).py(2).rounded(6).border(1).border_color(t.border).text_size(11).text_color(t.muted)
          .cursor_pointer().hover((x) => x.bg(t.hover).text_color(t.foreground))
          .on_click((_e, cx) => { cx.stop_propagation(); cx.write_to_clipboard(login); })
          .child(tr("hosts.copy")))))
      .child(v_flex().gap(2).when(away || old, (el) => el.opacity(0.55))
        .child(row("cpu", tr("hosts.cpu"), f?.cpu, f?.cpu ? tr("hosts.load", { load: num(f.cpu.load, 1), n: f.cpu.cores }) : ""))
        .child(row("mem", tr("hosts.mem"), f?.mem, f?.mem ? tr("hosts.of", { used: gib(f.mem.used), total: gib(f.mem.total) }) : ""))
        .child(row("disk", tr("hosts.disk"), f?.disk, f?.disk ? tr("hosts.of", { used: gib(f.disk.used), total: gib(f.disk.total) }) : "")));
  }

  // ---------- Next, Recent (#50) ----------

  // A line that opens something (the Inbox, an agent, a file), or says it can't: its dot, its text, its
  // project or time on the right.
  line(t, l) {
    return h_flex().id(l.id).h(LINE_H).px(4).gap(8).items_center().rounded(8)
      .when(Boolean(l.go), (el) => el.cursor_pointer().hover((s) => s.bg(t.hover)).on_click((_e, cx) => { cx.stop_propagation(); l.go(cx); }))
      .when(Boolean(l.tip), (el) => el.tooltip(l.tip))
      .child(div().size(6).flex_none().rounded_full().bg(l.color))
      .child(div().flex_1().min_w(0).truncate().text_size(12.5).text_color(t.foreground).child(l.text))
      .when(Boolean(l.extra), (el) => el.child(div().flex_none().max_w(120).truncate().font_family(MONO).text_size(10.5).text_color(t.dim).child(l.extra)))
      .when(l.right != null, (el) => el.child(div().flex_none().font_family(MONO).text_size(10.5).text_color(t.dim).child(l.right)));
  }

  nextGroups(t) {
    const since = Date.now() - RECENT_MS;
    const flowLine = (f) => ({ id: `hub-nx-f-${f.key}`, color: t.ansi4, text: `${String(f.repo ?? "").split("/").pop()}#${f.issue ?? "?"}`, right: f.next ? tr(`step.${f.next}`) : "", // i18n: tech
      go: onGitHub(f.repo) ? () => this.openIssue(f.repo, f.issue) : null, tip: onGitHub(f.repo) ? tr("flows.open") : tr("flows.noLink", { repo: f.repo }) });
    return [
      [tr("next.blocked"), agents().filter((a) => a.status === "blocked").slice(0, 6).map((a) => ({ id: `hub-nx-a-${a.address}`, color: t.blocked,
        text: a.tab_name || a.space_name || a.address, go: () => this.go(a), tip: tr("now.goTip", { name: a.tab_name || a.address }) }))],
      [tr("next.flows"), nextFlows(this.sum.flows, since).slice(0, 6).map(flowLine)],
      [tr("next.plans"), nextPlanIssues(this.sum.plans).slice(0, 6).map((x) => ({ id: `hub-nx-i-${x.repo}-${x.n}`, color: t.ansi3, text: `#${x.n} ${x.title}`, right: x.plan,
        go: onGitHub(x.repo) ? () => this.openIssue(x.repo, x.n) : null, tip: tr("flows.open") }))],
    ].filter(([, l]) => l.length);
  }

  recentGroups(t) {
    const since = Date.now() - RECENT_MS;
    return [
      [tr("recent.merges"), recentMerges(this.sum.flows, this.sum.reports, since).slice(0, 6).map((x) => ({ id: `hub-rc-m-${x.repo}-${x.pr}`, color: t.ansi5,
        text: x.title ? `#${x.pr} ${x.title}` : `${x.repo}#${x.pr}`, right: relative(x.at, { bare: true }), go: () => this.openPr(x.repo, x.pr), tip: tr("proj.prTip") }))],
      [tr("recent.notes"), (this.sum.notes ?? []).slice(0, 6).map((n) => ({ id: `hub-rc-n-${n.path}`, color: t.ansi6, text: n.title, right: relative(n.at, { bare: true }),
        go: () => exec("open", [n.path]).catch(() => {}), tip: tr("recent.noteTip", { where: n.vault }) }))],
      [tr("recent.worktrees"), (this.hist?.list ?? []).slice(0, 5).map((w, i) => ({ id: `hub-rc-w-${i}`, color: t.dim, text: w.name, right: w.age }))],
      [tr("recent.sessions"), (this.sum.sessions ?? []).slice(0, 6).map((s) => ({ id: `hub-rc-s-${s.sid}`, color: t.idle ?? t.dim, text: s.title || tr("recent.untitled"),
        extra: s.project ?? "", right: relative(s.last, { bare: true }) }))],
    ].filter(([, l]) => l.length);
  }

  // A card of groups of lines, `counts` lines shown each (fit()), « +n » after a group's name for the rest;
  // the empty sentence centred in what it's given.
  linesCard(t, id, label, groups, counts, emptyIcon, emptyText, i) {
    const body = groups.length
      ? v_flex().gap(4).children(groups.map(([name, lines], k) => v_flex().gap(2).child(this.sub(t, name, lines.length - counts[k]))
        .children(lines.slice(0, counts[k]).map((l) => this.line(t, l)))))
      : v_flex().flex_1().justify_center().child(this.empty(t, emptyIcon, emptyText));
    return this.card(t, id, label, null, null, body, i);
  }

  // ---------- one project (#49) ----------

  // Its head: the registry's mark, its repo, its open worktrees (gwm).
  pHead(t, pr, i) {
    const side = this.side.get(pr.key);
    const wts = side?.wts;
    const tileRow = { kind: pr.p?.kind ?? "repo", entry: pr.entry, name: pr.name };
    return this.card(t, "phead", tr("proj.head"), null, null, h_flex().gap(10).items_center()
      .child(this.tile(t, tileRow))
      .child(v_flex().flex_1().min_w(0).gap(2)
        .child(h_flex().min_w(0).gap(8).items_center()
          .child(div().min_w(0).truncate().text_size(13.5).text_color(t.foreground).child(pr.name))
          .when(archived(pr.entry), (el) => el.child(this.pill(t, tr("proj.archived")))))
        .child(div().truncate().font_family(MONO).text_size(10.5).text_color(t.muted).child([pr.slug, pr.root.replace(home(), "~")].filter(Boolean).join(" · "))))
      .child(div().flex_none().max_w(420).truncate().font_family(MONO).text_size(11).text_color(wts?.length ? t.foreground : t.dim)
        .child(wts == null ? (side?.busy ? tr("proj.wtReading") : "") : wts.length ? tr("proj.wts", { n: wts.length, list: wts.slice(0, 4).join(", ") }) : tr("proj.wtNone"))), i);
  }

  pCard(t, id, cw, name, main, { d = null, detail = "", tip = "", better = "higher" } = {}) {
    const pct = d == null || d === 0 ? null : `${d > 0 ? "+" : "−"}${tr("pct", { n: Math.abs(d) })}`;
    return v_flex().id(`hub-pc-${id}`).w(cw).flex_none().p(14).rounded(12).border(1).border_color(t.border).bg(t.raised).when(Boolean(tip), (el) => el.tooltip(tip))
      .child(this.V.stat(name, main, { delta: pct, detail: d === 0 ? tr("week.same") : detail, better, width: cw - CARD_X, id: `hub-ps-${this.pv.key}-${id}` }));
  }

  pWeek(t, pr, pw, prs, checks, fullW, i) {
    const inner = fullW - CARD_X;
    const tier = this.tier("pweek", inner);
    const cols = tier === "wide" ? 3 : tier === "medium" ? 2 : 1;
    const cw = Math.floor((inner - 8 * (cols - 1)) / cols);
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
    return this.card(t, "pweek", tr("week.title"), null, this.hint(t, tr("week.sub")), h_flex().flex_wrap().gap(8).children(cards), i);
  }

  pAct(t, pr, fullW, i) {
    const ys = projectYears(pr.p, this.d.today);
    const y = this.pYear.get(pr.key) ?? ys.at(-1);
    const yi = ys.indexOf(y);
    const h = this.pHeatOf(pr, y);
    const arrow = (id, icon, tip, by, on) => div().id(id).size(24).flex_none().rounded_full().flex().items_center().justify_center()
      .text_color(on ? t.muted : t.dim).when(!on, (el) => el.opacity(0.4))
      .when(on, (el) => el.cursor_pointer().hover((s) => s.bg(t.hover).text_color(t.foreground)).tooltip(tip)
        .on_click((_e, cx) => { cx.stop_propagation(); this.stepYear(by, cx); cx.notify(); }))
      .child(svg(I(icon)).size(13));
    const right = h_flex().flex_none().gap(4).items_center()
      .child(arrow("hub-py-prev", "chevron-left", tr("act.prev"), -1, yi > 0))
      .child(div().font_family(MONO).text_size(12).text_color(t.foreground).child(String(y)))
      .child(arrow("hub-py-next", "chevron-right", tr("act.next"), 1, yi >= 0 && yi < ys.length - 1));
    const junction = this.sum.junction;
    return this.card(t, "pact", tr("act.title"), null, right, this.yearBody(t, { slot: `pcal-${hash(pr.key)}-${y}`, h, tint: this.colorOf(t, pr.entry),
      mark: h.split > 0 ? h.split : null, markTip: junction ? tr("act.mark", { date: date(`${junction}T12:00:00`, { year: true }) }) : null,
      total: tr("act.total", { active: num(h.active), sessions: num(h.sessions) }), width: fullW - CARD_X }), i);
  }

  // The week's PRs (gh): number, title, state, its review and CI when a report has them; a click opens it in
  // the Inbox (kt.inbox.open), as kt-flow does.
  pPrs(t, pr, prs, i) {
    const side = this.side.get(pr.key);
    const err = side?.prErr ? div().text_size(12).text_color(t.ansi1).child(tr("proj.ghError", { error: side.prErr })) : null;
    if (!pr.slug) return this.card(t, "pprs", tr("proj.prsTitle"), null, null, this.empty(t, I("git-pull-request"), tr("proj.noSlug")), i);
    if (!prs) return this.card(t, "pprs", tr("proj.prsTitle"), null, null, err ?? this.empty(t, I("git-pull-request"), side?.busy ? tr("proj.ghReading") : tr("proj.ghNone")), i);
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
    return this.card(t, "pprs", tr("proj.prsTitle"), null, null, v_flex().gap(2)
      .children(rows.length ? rows : [this.empty(t, I("git-pull-request"), tr("proj.noPr"))]).when(Boolean(err), (el) => el.child(err)), i);
  }

  pLaunches(t, pw, fullW, i) {
    const list = pw.launches.map((x) => ({ ...x, family: familyOf(x.name) })).filter((x) => x.family !== "command");
    const cols = this.tier("plaunch", fullW - CARD_X) === "wide" ? 2 : 1;
    return this.card(t, "plaunch", tr("launch.title"), null, null, this.rankRows(t, list, (x) => t[FAMILY[x.family]] ?? t.accent, tr("launch.none"), cols), i);
  }

  projectBody(t, pr, W) {
    const pw = projectWeek(pr.p, this.d.w);
    const side = this.side.get(pr.key);
    const prs = side?.prs ? weekPrs(side.prs, this.sum.reports, pr.slug, this.d.w) : null;
    const checks = weekChecks(this.sum.reports, this.sum.flows, pr.slug, this.d.w);
    this.rowOf = Object.fromEntries(P_SECTIONS.map((s, k) => [s, k]));
    return [this.pHead(t, pr, 0), this.pWeek(t, pr, pw, prs, checks, W, 1), this.pAct(t, pr, W, 2), this.pPrs(t, pr, prs, 3), this.pLaunches(t, pw, W, 4)];
  }

  // ---------- page ----------

  // Before the first summary: the cards' shapes (skeleton.js), breathing.
  skeletonBody(t) {
    const S = skeleton(t, this.m);
    const sec = (inner) => v_flex().px(14).pt(12).pb(14).gap(12).rounded(14).border(1).border_color(t.border).bg(t.background)
      .child(S.line(110, { h: 7, lh: 24 })).child(inner);
    // #89: Temps agent (the chart, the most active), Activity, then Next, Sub-agents and Recent.
    return S.pulse(v_flex().id("hub-body-sk").gap(8)
      .child(sec(h_flex().gap(24).items_start().child(S.block(null, 260).flex_1()).child(div().w(380).flex_none().child(S.list(6, { h: 28, icon: 20, lines: [0.4] })))))
      .child(sec(S.block(null, 140)))
      .child(h_flex().gap(8).children([0, 1, 2].map(() => sec(S.list(4, { h: 26, icon: 6, lines: [0.6] })).flex_1()))));
  }

  // The global view (#89's layout, at every width): its rows (each a child of the scroll, for j / k), and
  // each section's row. Next, Sub-agents and Recent side by side, as tall as Next or Sub-agents (Recent at
  // least ~240 px when it has that much, dropping lines to fit); under each other when narrow. #76's right
  // column from 1 300 px is gone: with Sub-agents in it, Recent kept one line at 1 530 (the mockup's measure).
  globalRows(t, W) {
    const time = this.timeCard(t, W, 1), act = this.actCard(t, W, 2);
    const ng = this.nextGroups(t), rg = this.recentGroups(t);
    const nSizes = ng.map(([, l]) => l.length), rSizes = rg.map(([, l]) => l.length);
    const trio = this.tier("trio", W) !== "narrow";
    // Sub-agents' height: the ring (132) beside its legend (16 a line, 8 between), under it when the card is
    // too narrow for both (donut()'s wrap).
    const n = Math.min(6, this.d.subs.length), legendH = n ? n * 16 + (n - 1) * 8 : 0;
    const side = Math.floor((W - 16) / 3) - CARD_X >= 132 + 24 + 140;
    const subsNat = CARD_Y + (n ? (side ? Math.max(132, legendH) : 132 + 24 + legendH) : EMPTY_H);
    const nextNat = CARD_Y + groupsH(nSizes), recentNat = CARD_Y + groupsH(rSizes);
    const hh = Math.max(nextNat, subsNat, Math.min(recentNat, 240));
    const rCounts = trio ? fit(rSizes, hh - CARD_Y) : rSizes;
    const next = this.linesCard(t, "next", tr("next.title"), ng, nSizes, H("list-todo"), tr("next.none"), 3);
    const subs = this.subsCard(t, 4);
    const recent = this.linesCard(t, "recent", tr("recent.title"), rg, rCounts, HISTORY, tr("recent.none"), 5);
    this.rowOf = { now: 0, time: 0, act: 1, next: 2, subs: 2, recent: 2, hosts: 3, flows: 4 };
    return [time, act,
      trio ? h_flex().items_start().gap(8).child(next.flex_1().h(hh)).child(subs.flex_1().h(hh)).child(recent.flex_1().h(hh).overflow_hidden())
        : v_flex().gap(8).child(next).child(subs).child(recent),
      this.machinesCard(t, W, 6),
      this.flowsCard(t, W, 7)];
  }

  body(t) {
    if (!this.sum || !this.d) {
      return v_flex().flex_1().min_h(0).child(this.readError ? div().p(16).text_size(13).text_color(t.ansi1).child(tr("index.unreadable", { error: this.readError })) : this.skeletonBody(t));
    }
    const pr = this.pv;
    const kids = pr ? this.projectBody(t, pr, this.width) : this.globalRows(t, this.width);
    // The top row is taller than the page: scroll_to_item leaves a child already in sight where it is, so
    // the top (row 0) is a child of no height before it (gg, the page shown again).
    if (this.reveal) {
      const i = this.rowOf?.[this.cur];
      if (i != null && i < kids.length) this.scroll.scroll_to_item(i ? i + 1 : 0);
      this.reveal = false;
    }
    // The view's key in the id: global and each project fade in when they come.
    return enter(this.m, v_flex().flex_1().min_h(0), `hub-in-${pr?.key ?? "global"}`, { dy: 0 })
      .child(v_flex().id("hub-body").flex_1().min_h(0).min_w(0).overflow_y_scrollbar().track_scroll(this.scroll).pb(16).gap(8)
        .child(div().h(0).mb(-8)).children(kids));
  }

  render(cx) {
    tilesFrame(this.tiles, cx);
    this.m = frame(this.motion, Boolean(shared("kt.reducedMotion")));
    const vis = visible();
    if (!checking()) {
      // The bus (DATA-SYNC.md): an agent stopped working, its transcript grew. Once a minute at most.
      refreshOn(this, cx, "hub-agents", ["agents"], async (cx) => {
        if (Date.now() - this.ranAt >= AGAIN_MS) this.index(cx, "bus");
        else this.waiting = true;
      });
      if (vis && !this.shown) {
        // Shown again: at the top, the keyboard (NORMAL) once the app has settled its own focus, the tick,
        // a pass when the last is over a minute old (the old summary stays shown meanwhile).
        this.cur = null; // the view's first section, below
        this.reveal = true;
        cx.timer.after(150, (cx) => {
          if (visible() && !this.handle.is_focused()) this.focusIn(cx);
          cx.notify();
        });
        this.startTick(cx);
        this.quotaLoad(cx);
        // Machines at once: this Mac, and main-vps unless it was read under VPS_FLOOR ago (back and forth).
        this.hostsLoad(cx, 0, VPS_FLOOR);
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
    this.tw = new Set();
    this.builds = 0;
    this.later = false;
    const page = v_flex().id("hub-root").size_full().gap(8).text_color(t.foreground)
      .track_focus(this.handle)
      .on_key_down((e, cx) => this.key(e, cx))
      .on_size_change((size, cx) => {
        if (size.width === this.width && this.widthAt != null) return;
        this.width = size.width;
        this.widthAt = Date.now();
        // The images wait for the width to settle: one timer per resize, to draw them once it has.
        if (!this.settling && !checking()) {
          this.settling = true;
          cx.timer.after(SETTLE_MS + 20, (cx) => { this.settling = false; cx.notify(); });
        }
        cx.notify();
      })
      .child(this.header(t))
      .child(this.body(t));
    this.writeTips(cx);
    // #89: the period's day tooltips, in a task after the render that first shows it (dates are slow).
    if (this.tm && !this.tm.tips && !this.tipsBusy && !this.pv && !checking()) {
      this.tipsBusy = true;
      const tm = this.tm;
      cx.spawn(async (cx) => { tm.tips = this.dayTips(tm); this.tipsBusy = false; cx.notify(); });
    }
    this.flushTrames(cx);
    // Paths left for the next render (built()): one timer, re-armed only while some are left.
    if (this.later && !this.laterSoon && !checking()) {
      this.laterSoon = true;
      cx.timer.after(16, (cx) => { this.laterSoon = false; cx.notify(); });
    }
    // The bars, the weeks, then the chart, once each, a moment after the first render with data (one timer
    // each, never again).
    if (this.d && this.heavy < 3 && this.heavySoon !== this.heavy && !checking()) {
      this.heavySoon = this.heavy;
      cx.timer.after(80, (cx) => { this.heavy++; cx.notify(); });
    }
    return page;
  }
}
