// kbrdn Threads inbox (port of herdr.dev "Threads", restyled to kbrdn.dev):
// every tab of every space as one inbox of work. Grouped by project by default (Home, then
// the projects that need you, then the registry's order; inside, pinned, then blocked, done,
// working, idle, most recent first; a header folds), or by date from the filter menu (pinned on
// top, then Aujourd'hui, Hier, Cette semaine, Plus ancien; newest thread first inside),
// then the snoozed shelf, folded. Keys: vim.js (kt-keys lists them). Archived threads (tab.settle,
// still running) have their own view, from the filter menu (kt-thread-filter: archived,
// status, period, program; shared "kt.threadFilter"). A row: the tile of the program it runs (its agent's first),
// its project, its status tag (needs you, done, working for
// how long) or how long since it last changed; its name; its branch and the
// icons of what runs in it. A project is a repo, worked out from git (a
// worktree's space belongs to its repo); a space outside git is its own.
// Quiet rows recede so the ones that need you stand out. Hover a row to
// snooze, pin or settle it; right-click for the tab menu. Search opens the
// picker; the filter narrows the list to one project; + folder adds a
// project (a space), the pen a new thread. A branch with a pull request shows
// its number and state (from `gh`, refreshed every few minutes); click it to
// open. Pins and snoozes are this layout's own (shared "kt.pins",
// "kt.snoozed"); a snoozed thread wakes on time or when its agent needs you.
// Settling is everyone's.
// kbrdn (Monocode): a space is a project. On top, the shown project with a
// picker of every space (by machine, worktrees under their repo) and New
// project; New thread, Inbox, Skills, MCP, Plugins and Worktrees (with the shown project's
// worktree count); the list follows the shown project unless
// "Tous les projets" (shared "kt.project" = "*"); at the bottom, a bar of
// project squares. The main area is the layout's "view" stack: "thread" (the
// tab) or a page ("inbox", "skills", "mcp", "plugins", "gwm": kt-inbox, kt-skills, kt-mcp,
// kt-plugins, kt-gwm); an entry shows its page, a thread, the project picker and New thread
// show the thread again.
// A card (Monocode's sidebar): program tile, title, status; model · effort ·
// branch and the PR; the agent's live action; its sub-agents branching off its tile (kbrdn.dev's
// Parcours). Every card rings its context; the shown thread alone opens an inner card
// (context / 5 h / cache rings, cost and lines, the flow by phase, todos, report), fed by
// ~/.claude/scripts/statusline.ts, herdr-bridge and /me:report.

import { View, div, svg, image } from "gpui-kit";
import { ring, ctxTokens } from "./ring.js";
import { costLevel, quotaLevel, levelColor } from "./levels.js";
import { companion, variantFor } from "./companion-logo.js";
import { longLived } from "./pr-pick.js";
import { filterOf, filtering, openFirst, moveInGroup } from "./thread-filter.js";
// The threads' model (pure) and its reads, shared with kt-kanban: a thread's data comes from there.
import * as model from "./threads-model.js";
import { age, duration, until, label, startOf, endOf, isAlive, FADE, PROJECT_COLORS, assignColors, sortRegistry, where } from "./threads-model.js";
import * as io from "./threads-io.js";
// The registry moved or grown by a request file (registry.js): a renamed folder, a project with no space yet.
// Not `registry`: that name is this file's own registry() (the sorted kt.projects), and the app's runtime let the
// local one win without a word, every registry.<fn> undefined (2026-11-19). kt-keys/parse.check.mjs catches it.
import * as projectRegistry from "./registry.js";
// A project archived (#88, projects.js: its source is here): out of the bar and the picker, restored when a
// space opens on it. A namespace for the same reason as above: `shown` is a local name in places.
import * as archiving from "./projects.js";
import { pollMachines, guard, reachable, stateOf, stateWord, stateColor, machineList } from "./machines.js";
import { Vim, keysOf, step } from "./vim.js";
// Copied byte for byte from mods/kbrdn-toast/decide.js (a mod can't import from another folder): edit
// there, then copy.
import { decide, decisionButtons, pillKeys, press } from "./decide.js";
// Copied byte for byte from mods/kt-keys/motion.js (data/orchestrator/ANIMATIONS.md).
import { motionState, frame, enter, collapse, ink, fade, sheet, leave, leaving, rows as motionRows } from "./motion.js";
import { tileState, tilesFrame, projTile, LETTER } from "./projtile.js";
import { skeleton } from "./skeleton.js";
// kt-keys' roll.js (a byte-identical copy): the nav's counts, the group heads', the focus card's figures,
// and (12 threads or fewer listed) the cards' ages and durations roll to their new digits.
import { roll, rollText } from "./roll.js";
// kt-keys' viz.js and kt-flow's steps.js (byte-identical copies, each with its .strings.js): the focus
// card's flow in tiers by phase, as kt-flow's head draws it, and its todos' tier.
import { viz } from "./viz.js";
import { phasesOf, nameOf, speak } from "./steps.js";
// Copied byte for byte from mods/kt-keys/bus.js (data/orchestrator/DATA-SYNC.md).
import { bump, refreshOn } from "./bus.js";
// Written here, copied byte for byte into mods/kt-head: the halo both draw.
import { HALO, haloLayers } from "./halo.js";
import { langSwitch, cycleButton, makeT, num as fnum, relative } from "./i18n.js";
import strings from "./strings.js";
import { v_flex, h_flex, ScrollHandle } from "gpui-base";
import { spaces, panes, run, theme, shared, setShared, openOverlay, exec, window as win, home, readTextFile, pickFolder, checking, layout, nextCommand, settings, appHome, writeTextFile, notify, watchFolder, keys } from "herdr";
// kt-keys' shortcuts.js (a byte-identical copy): each nav line's key as keycaps, read from keys() (#72).
import { shortcut, kbd, tip } from "./shortcuts.js";
// kt-keys' panel.js (a byte-identical copy): the sidebar's content glides in and out with it (#73).
import { columnIn } from "./panel.js";
import * as fs from "fs/promises";

// The places' git and real paths go through machines.js' guard: a machine away refuses at once (#61).
const ask = guard(exec);

// The layout's main stack and its children (kbrdn-threads.json).
const VIEW = "view";
const show = (child) => run("layout.select", { stack: VIEW, child });
function find(node, id) {
  if (node?.id === id) return node;
  for (const c of node?.children ?? []) {
    const f = find(c, id);
    if (f) return f;
  }
  return null;
}
const SPIN = "mods/workspace-chrome/spinner.svg";
// A sub-agent's branch: 28 px, kbrdn-agents' sub-agent rhythm with room for the 20×16 companion and its
// corner badge (26 would let the badge touch the next line). An ended one fades after FADE, goes after GONE
// (threads-model.js).
const BRANCH_H = 28;
// The focus card's todos in one tier, a cell each, up to TODO_TIER of them; past that (a cell under
// ~20 px in the card) or when the bridge read fewer than its total, one bar.
const TODO_TIER = 8;
const tr = makeT(strings);
speak(makeT); // steps.js' step and phase names follow kt.lang too
// The pages under the navigation's Agents group, in order, as the view stack names them: [icon, label].
// One the layout's stack doesn't have yet (Workflow, kt-workflow) is left out rather than open a blank.
// The names are the pages' own, in every language; automation's is words (strings.js' automation).
const AGENT_PAGES = ["workflow", "skills", "mcp", "plugins", "automation", "market"];
// automation: refresh-cw until kt-automation gives its own icon. market: Marketplaces (kt-market, #70).
const AGENT_PAGE = { workflow: ["workflow", "Workflow"], skills: ["sparkles", "Skills"], mcp: ["plug", "MCP"], plugins: ["puzzle", "Plugins"],
  automation: ["refresh-cw", null], market: ["store", "Marketplaces"] };
const pageName = (p) => AGENT_PAGE[p][1] ?? tr(p);

// One branch of a tree (kbrdn.dev's Parcours), the sub-agents' and the navigation's Agents group's: the
// column drawn before a row's content, 2x wide. Its piece of trunk runs over the row's whole height `h`
// (to the bend only, on the `last`), and a ╰ bends off it 8 px above the middle, rounded, to the column's
// right edge. `color`: the bend and the piece leading to it; `rest`: the trunk going on below. `reach`:
// px the pieces reach past the row's edges, so they still meet across bordered rows.
function twig(t, { h, x, last, color, rest, reach = 0 }) {
  const mid = h / 2;
  return div().w(2 * x).h_full().flex_none().relative()
    .child(div().absolute().top(-reach).left(x).h(mid - 8 + reach).border_l(1).border_color(color))
    .when(!last, (el) => el.child(div().absolute().top(mid - 4).bottom(-reach).left(x).border_l(1).border_color(rest)))
    .child(div().absolute().top(mid - 8).left(x).w(x).h(9).border_l(1).border_b(1).rounded_bl(8).border_color(color));
}
// The tree's lines at rest, Parcours' --control-border (neutral-300 light, white at .14 dark): the
// foreground made translucent, so they read at a glance without shouting, glass mode included.
const treeLine = (t) => alpha(t.foreground, settings().dark ? "38" : "4d");

const MONO = "Monaspace Krypton";
// PR state -> icon and theme color name.
const PR = {
  OPEN: { icon: "git-pull-request", color: "ansi2" },
  MERGED: { icon: "git-merge", color: "ansi5" },
  CLOSED: { icon: "git-pull-request-closed", color: "ansi1" },
};
const PR_EVERY = 180e3;
const I = (name) => `mods/kt-threads/${name}.svg`;

// Snooze choices: label and when it wakes. Edit to taste.
const SNOOZE = [
  ["1 hour", () => Date.now() + 3600e3],
  ["Tonight", () => at(Date.now(), 19)],
  ["Tomorrow", () => at(Date.now() + 86400e3, 9)],
];
function at(ms, hour) {
  const d = new Date(ms);
  d.setHours(hour, 0, 0, 0);
  return d.getTime() > Date.now() ? d.getTime() : d.getTime() + 86400e3;
}

// Space colors (shared "space.colors", threads-model.js' assignColors): this list gives a new space
// its color and writes it back.
function spaceColors() {
  const { colors, changed } = assignColors(spaces(), shared("space.colors"));
  if (changed) setShared("space.colors", colors);
  return colors;
}
function spaceColor(t, p) {
  if (p.name === "~") return t.dim;
  const c = spaceColors()[p.id] ?? PROJECT_COLORS[0];
  return c.startsWith("#") ? c : t[c];
}

const clock = (sec) => { const d = new Date(sec * 1000); return `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`; };
// A quota window's reset, from its unix seconds: "4d23h", "3h07m", "12m".
function resetIn(sec) {
  const m = Math.max(0, Math.round((sec * 1000 - Date.now()) / 60e3));
  return m >= 1440 ? `${Math.floor(m / 1440)}d${Math.floor((m % 1440) / 60)}h` : m >= 60 ? `${Math.floor(m / 60)}h${String(m % 60).padStart(2, "0")}m` : `${m}m`;
}
const toks = (n) => (n < 1000 ? String(n) : n < 1e6 ? `${Math.floor(n / 1000)}k` : `${(n / 1e6).toFixed(1)}M`);
// The prompt cache's time left, from the last API call and the TTL it was written with.
function cacheLeft(s) {
  if (!s?.cache_at || !s.cache_ttl) return "";
  const m = Math.ceil((s.cache_at + s.cache_ttl * 1000 - Date.now()) / 60e3);
  return m <= 0 ? tr("cacheGone") : m >= 60 ? "ttl≈1h" : `ttl≈${m}m`; // i18n: tech
}
// A window's reset in words, from its unix seconds: "reset dans 6 j", "reset dans 3 h".
function resetWords(sec) {
  const h = (sec * 1000 - Date.now()) / 3600e3;
  return h >= 24 ? tr("reset.d", { n: Math.ceil(h / 24) }) : tr("reset.h", { n: Math.max(1, Math.ceil(h)) });
}
// A live 5h / 7d window (statusline's rate_limits, top level), or null once it has reset.
function windowOf(q, name) {
  const w = q?.[name] ?? q?.rate_limits?.[name];
  return w && w.resets_at * 1000 > Date.now() ? w : null;
}

// The projects registry (shared "kt.projects", kept across restarts): [{ id, name, folder, machine,
// color, logo, order }], id = [machine, the folder's real path]. kt-projects manages it; the list
// adds every space it sees, so a project closed stays one click away.
const registry = () => sortRegistry(shared("kt.projects"));
// A project's logo for the appearance now (threads-model.js).
const logoOf = (e) => model.logoOf(e, settings().dark);
// The theme switch at the bottom (shared "kt.themeMode"), kbrdn.dev's ThemeToggle: light, dark,
// or blur: frosted glass, a `-glass` copy of the shown layout with `window_blur` and these
// translucent colors (forces dark). The shown layout's own file is never written.
// One button: its icon by mode, and the next mode on a click (light → dark → glass → light).
const THEME_ICON = { light: "sun", dark: "moon", blur: "blend" };
const THEME_NEXT = { light: "dark", dark: "blur", blur: "light" };
const GLASS = { canvas: "#00000000", chrome: "#0f0f0fb3", surface: "#191919cc", background: "#191919d9", popover: "#242424e6" };
const GLASS_SUFFIX = "-glass";

// Sets settings.json's `appearance`, touching only that key's text (the rest stays byte for byte);
// a file where that can't be done is rewritten as JSON. writeTextFile refuses a stale snapshot.
async function writeAppearance(value) {
  const path = `${appHome()}/settings.json`;
  const before = (await readTextFile(path)) ?? "{}";
  const parsed = JSON.parse(before);
  if (parsed.appearance === value) return;
  let text = /"appearance"\s*:\s*"[^"]*"/.test(before)
    ? before.replace(/("appearance"\s*:\s*)"[^"]*"/, `$1"${value}"`)
    : before.replace(/^\{\n/, `{\n  "appearance": "${value}",\n`);
  let ok = text !== before;
  try { ok = ok && JSON.parse(text).appearance === value; } catch { ok = false; }
  if (!ok) text = `${JSON.stringify({ ...parsed, appearance: value }, null, 2)}\n`;
  await writeTextFile(path, text, before);
}

// `<base>-glass`: the layout's file with window_blur, GLASS's colors and a translucent terminal at
// its root. Written only when it differs, so the watcher that keeps it in step (followGlass)
// doesn't loop on its own write.
async function writeGlass(base) {
  const dir = `${appHome()}/layouts`;
  const tree = JSON.parse(await readTextFile(`${dir}/${base}.json`));
  tree.window_blur = true;
  tree.colors = { ...(tree.colors ?? {}), ...GLASS };
  tree.terminal_opacity = 0.9;
  const path = `${dir}/${base}${GLASS_SUFFIX}.json`;
  const text = `${JSON.stringify(tree, null, 2)}\n`;
  const before = await readTextFile(path);
  if (text !== before) await writeTextFile(path, text, before);
}

// A registry color: a theme name ("ansi6", "accent") or a #hex.
const paint = (t, c) => (!c ? null : c.startsWith("#") ? c : t[c] ?? null);
// A theme color with alpha `a`, replacing any it has (glass themes are #rrggbbaa).
const alpha = (c, a) => `${String(c).slice(0, 7)}${a}`;
// The project bar: 30 px squares 6 px apart, 12 px in from the sidebar's edges; its arrows 20 px.
const SQUARE = 30, BAR_GAP = 6, BAR_PAD = 12, ARROW = 20;

export default class Threads extends View {
  init(_props, cx) {
    this.tiles = tileState(); // projtile.js: a project without a logo on the logos' dithered background
    this.hover = null;
    this.showSnoozed = false;
    this.snoozing = null; // the row showing its snooze choices
    this.projAt = null; // where the project picker opens: under the selector, as last pressed
    this.quota = null; // ~/.claude/cache/statusline/herdr-quota.json
    this.repos = {}; // folder -> { key, name } | null

    this.prs = {}; // "folder|branch" -> { number, state, url } | null
    this.asked = {}; // "folder|branch" -> when
    this.defaults = {}; // a repo -> its default branch (gh repo view), asked once; null: unknown
    this.queue = [];
    // Durations: checked every second, but the list redraws only when a time
    // it shows really changes ("WORKING 12s" -> "13s", "3m" -> "4m"), else
    // every 30 s (snoozes coming due). Each redraw repaints the whole window.
    this.ticks = 0;
    this.shownClocks = "";
    cx.timer.every(1000, (cx) => {
      this.ticks++;
      // Also when the keyboard left without a render (a click on a terminal): the cursor goes out.
      if (this.ticks >= 30 || this.clocks() !== this.shownClocks || this.keyed !== this.handle?.is_focused()) cx.notify();
    });
    cx.timer.every(1500, (cx) => this.lookup(cx));
    // kbrdn: each agent's live line (herdr-bridge Claude mod) every 3 s, /me:report facts every 15 s.
    // Both redraw only when what they read changed.
    this.live = {};
    this.reports = {};
    this.real = {}; // where(space) -> [machine, its folder's real path], null when it can't be resolved
    // #61: places another machine couldn't answer (threads-io askable: asked again once it's back, or
    // 30 s later), and the machines whose queue runs (one per machine: threads-io queues).
    this.triedRepo = {};
    this.triedReal = {};
    this.finding = new Set();
    this.realing = new Set();
    this.seen = new Set(); // spaces whose project color was applied once
    this.homeReal = null; // home()'s real path: its space is "Home", never a project
    this.memos = {}; // terminal -> companion-logo's memo (when done or blocked began, one-shots)
    this.decisions = {}; // a blocked agent's terminal -> decide.js' { pending, accept, refuse, open }
    this.motion = motionState(); // motion.js: what has drawn, the folds' heights
    this.statusOf = {}; // terminal -> its agent's status last render: the `agent:<space>` bumps
    this.twigsOpen = new Set(); // agents' terminals whose sub-agents show all, not 4 then "+N"
    // Keys (vim.js): ctrl-b h (pane.go, "focus") or `kt-threads.key:<keys>` gives this list the
    // keyboard; a cursor (a thread id, or "snoozed": the shelf's header) moves over the rows shown.
    this.handle = cx.focus_handle();
    this.vim = new Vim();
    this.cur = null;
    this.flat = []; // the rows the cursor walks, in order: { id, group, r, fold?, head? }
    this.folded = new Set(); // project groups folded (h on a header or a thread, or a click)
    this.listScroll = ScrollHandle.new();
    // The project bar scrolls sideways: barAt is the first square shown (kept here: a ScrollHandle has
    // no offset), barW the bar's width, barShown the active project's square last brought into view.
    this.barScroll = ScrollHandle.new();
    this.barAt = 0;
    this.barW = 0;
    this.barShown = null;
    this.barPress = null; // the registry project a drag in the bar started on
    this.barOver = null; // the square it is over (an id of barShownIds)
    // The Usage button's peek (usagePeek): its generation while shown (null: hidden), the pointer on the
    // button or the panel, the statusLine's quota as read on hover-in.
    this.peek = null;
    this.peekGen = 0;
    this.peekOver = {};
    this.peekQuota = null;
    if (!checking()) {
      cx.spawn(async () => {
        const r = await exec("pwd", ["-P"], { cwd: home() }).catch(() => null);
        this.homeReal = r?.code === 0 ? r.stdout.trim() : home();
      });
      cx.timer.every(3000, (cx) => this.readLive(cx));
      cx.timer.every(1500, (cx) => this.readDecisions(cx));
      cx.timer.every(15000, (cx) => this.readReports(cx));
      cx.timer.every(5000, (cx) => this.syncProjects(cx));
      pollMachines(cx); // #60: shared "kt.machines" from hc machine ls, every 15 s (machines.js)
      // The registry's request file (registry.js), read every 3 s, one request at a time (a watch of
      // data/kt-threads/ never woke: polled instead, a missing file read off the UI thread).
      fs.mkdir(`${appHome()}/data/kt-threads`, { recursive: true }).catch(() => {});
      this.alive = { started: Date.now(), tick: null };
      cx.timer.every(3000, () => {
        if (this.requesting) return;
        this.requesting = true;
        this.registryRequest()
          .catch((e) => this.commandFailed(projectRegistry.failure("registry-request.json", e)))
          .finally(() => { this.requesting = false; });
      });
      // `kt-threads.density` (a key, or `herdr-app do`) flips the cards like the icon by THREADS;
      // `kt-threads.projects` opens or closes the project picker; `kt-threads.every` flips every
      // project / the shown one (the icon by THREADS); `kt-threads.archived` flips the archived view;
      // `kt-threads.theme-light` /
      // `theme-dark` / `theme-blur` move the theme switch. `focus` (pane.go) takes the keyboard;
      // `key:<keys>` takes it and types those keys ("j", "g g", "5 j", "L"), for tests.
      // Each command is guarded (projectRegistry.guard): one that throws is written to
      // data/kt-threads/command-error.json (commandFailed), and the loop goes on.
      cx.spawn(async (cx) => {
        for (;;) {
          const c = await nextCommand();
          await projectRegistry.guard(c, async (c) => {
            if (c === "focus") this.focusIn();
            // `hover:<tab id>` opens a compact row as the pointer would; `hover:` alone leaves it (tests).
            else if (c.startsWith("hover:")) {
              const was = this.hover;
              this.hover = c.slice(6) || null;
              if (!this.hover) this.linger(was, cx);
            }
            else if (c.startsWith("key:")) {
              this.focusIn();
              for (const k of keysOf(c.slice(4))) this.act(this.vim.handle(k), cx);
            }
            // `cursor:<line id>` takes the keyboard with the cursor on that line (a tab id, `dec:accept:<tab
            // id>`), for tests.
            else if (c.startsWith("cursor:")) {
              this.focusIn();
              this.cur = c.slice(7);
              this.reveal = true;
            }
            else if (c === "density") this.toggleDensity();
            else if (c === "projects") this.openProjects();
            // `bar-move:<name>|<name>`: a drag in the bar from one project onto another (names as the
            // registry has them, "home" for Home), for tests.
            else if (c.startsWith("bar-move:")) {
              const [a, b] = c.slice(9).split("|");
              const id = (n) => (n === "home" ? "home" : registry().find((e) => e.name === n)?.id);
              if (id(a) && id(b)) this.moveProject(id(a), id(b));
            }
            // The project picker's « Nouveau projet »: `space.new` alone opens in the focused terminal's
            // folder (no prompt), so ask for a local folder; here, as this list outlives the popup.
            else if (c === "new-project") {
              show("thread");
              const folder = await pickFolder({ prompt: tr("open") }).catch(() => null);
              if (folder) {
                run("space.new", { folder, machine: "" });
                this.syncProjects(cx); // into the registry now, not at the next tick
              }
            }
            else if (c === "every") setShared("kt.project", shared("kt.project") === "*" ? null : "*");
            // `agents` folds or unfolds the navigation's Agents group (Skills, MCP, Plugins).
            else if (c === "agents") setShared("kt.nav.agents", !shared("kt.nav.agents"));
            // `wt-remove:<worktree path>` (settle()'s notification): kt-gwm's guarded removal of it, asked
            // first, then its page shown (a copy never opened only exists once shown, and reads it then).
            else if (c.startsWith("wt-remove:")) {
              setShared("kt-gwm.remove", { path: c.slice(10), at: Date.now() });
              show("gwm");
            }
            // `halo:<color>` draws the halo in that color, `nav-page:<page>` the navigation as if that page
            // showed; `halo:` / `nav-page:` alone go back. This copy only, nothing shown changes (tests).
            else if (c.startsWith("halo:")) this.haloTest = c.slice(5) || null;
            else if (c.startsWith("nav-page:")) this.navTest = c.slice(9) || null;
            else if (c === "archived") {
              const f = filterOf(shared("kt.threadFilter"));
              setShared("kt.threadFilter", { ...f, archived: !f.archived });
            }
            else if (/^theme-(light|dark|blur)$/.test(c)) this.setTheme(c.slice(6), cx);
          }, (f) => this.commandFailed(f));
          cx.notify();
        }
      });
    }
  }

  // data/kt-threads/registry-result.json, written at once (shared.json is saved in the background):
  // { alive: { started, tick }, last }: the request reader's last tick (written once a minute at most when
  // there's nothing to read, proof it runs), and the registry's last outcome (registry.js' header).
  registryWrite(last) {
    if (last !== undefined) this.registryLast = last;
    this.aliveWritten = Date.now();
    const body = { alive: this.alive ?? null, last: this.registryLast ?? null };
    return fs.writeFile(`${appHome()}/data/kt-threads/registry-result.json`, `${JSON.stringify(body, null, 2)}\n`).catch(() => {});
  }

  // A command that threw (projectRegistry.guard), or a request read that failed: data/kt-threads/command-error.json
  // ({ at, received, error }), and shared "kt.registry.last" for the registry's own.
  commandFailed(f) {
    // The file first: setShared itself can throw (a host call outside a task), and the error would be lost.
    const written = fs.writeFile(`${appHome()}/data/kt-threads/command-error.json`, `${JSON.stringify(f, null, 2)}\n`).catch(() => {});
    if (/^registry-request/.test(f.received)) {
      const last = { ...f, ok: false, reason: `error: ${f.error.split("\n")[0]}` }; // i18n: tech
      this.registryWrite(last);
      try { setShared("kt.registry.last", last); } catch { /* in the files already */ }
    }
    return written;
  }

  // The registry's request file, data/kt-threads/registry-request.json (registry.js' header), read every 3 s:
  // set aside when too old or its id was applied already, else applied (projectRegistry.settle: the folder looked
  // for on the disk first, nothing written on a refusal), then deleted, whatever came of it. The outcome goes to
  // shared "kt.registry.last" and to registry-result.json ({ at, received (200 characters at most), id, ok,
  // project, entry, maps | reason }). A text read a second time unchanged (its unlink failed) is left alone.
  async registryRequest() {
    const a = this.alive;
    a.tick = Date.now();
    const file = `${appHome()}/data/kt-threads/registry-request.json`;
    // The path read and what the read gave (its length, or its error) go to alive.file / alive.read, written at
    // once when they change: a request not taken shows why there.
    a.file = file;
    const text = await fs.readFile(file, "utf8").then(
      (t) => { a.read = `${typeof t} ${t?.length ?? 0}`; return t; }, // i18n: tech
      (e) => { a.read = `error: ${String(e?.message ?? e).slice(0, 300)}`; return null; }, // i18n: tech
    );
    if (!text || text === this.requestDone) {
      if (a.read !== this.readWritten || Date.now() - (this.aliveWritten ?? 0) >= 60e3) {
        this.readWritten = a.read;
        await this.registryWrite();
      }
      return;
    }
    this.requestDone = text;
    const req = projectRegistry.requestOf(text, Date.now(), shared("kt.registry.applied") ?? []);
    const exists = req.folder ? await exec("test", ["-d", req.folder]).then((r) => r.code === 0).catch(() => false) : false;
    const state = { projects: shared("kt.projects"), maps: { "kt.chat.backgrounds": shared("kt.chat.backgrounds") ?? {} }, applied: shared("kt.registry.applied") };
    const { out, writes } = projectRegistry.settle(req, state, exists);
    for (const [key, value] of Object.entries(writes)) setShared(key, value);
    // A move's color goes to the spaces now on its folder: their entry, made when they opened, is absorbed by
    // the move, and syncProjects would otherwise take the space's own color back into the registry.
    if (req.kind === "project-move" && out.ok && out.entry?.color) {
      const colors = { ...(shared("space.colors") ?? {}) };
      for (const s of spaces()) if (this.projectId(s) === out.project) colors[s.id] = out.entry.color;
      setShared("space.colors", colors);
    }
    await fs.unlink(file).catch(() => {});
    const last = { at: Date.now(), received: text.slice(0, 200), id: req.id ?? null, ...out };
    setShared("kt.registry.last", last);
    await this.registryWrite(last);
  }

  // Keeps the registry in step with the spaces: an open space whose project isn't in it adds it
  // (the space's name, a worktree's repo name; its space color); a space just opened takes its
  // project's color, and a color given later to a project's only open space (another mod's
  // picker) follows into the registry. One entry per project (projectId): a worktree or a second
  // space on the same folder adds nothing. Names change only from kt-projects.
  syncProjects(cx) {
    if (this.syncing) return;
    const ps = spaces().filter((s) => s.folder);
    const todo = [...new Set(ps.map(where).filter((l) => !(l in this.real) && io.askable(l, { reachable, tried: this.triedReal })))];
    // Another machine's places in their own queue (#61): a slow one never holds this computer's back;
    // what they find goes into the registry at the next tick.
    let local = [];
    for (const [m, q] of io.queues(todo)) {
      if (m === null) local = q;
      else if (!this.realing.has(m)) {
        this.realing.add(m);
        cx.spawn(async () => {
          await io.drain(q, (l) => io.realOf(l, ask), this.real, this.triedReal);
          this.realing.delete(m);
        });
      }
    }
    this.syncing = true;
    cx.spawn(async (cx) => {
      await io.drain(local, (l) => io.realOf(l, ask), this.real, this.triedReal);
      this.syncing = false;
      if (this.homeReal === null) return; // which space is Home isn't known yet: next time
      let next = shared("kt.projects") ?? [];
      // An older single `logo` becomes `logos` for both modes.
      let changed = next.some((e) => "logo" in e || "logoFrom" in e);
      if (changed) next = next.map(({ logo, logoFrom, ...e }) => ({ ...e, logos: e.logos ?? { light: logo ?? null, dark: logo ?? null }, ...(e.logosFrom || !logoFrom ? {} : { logosFrom: { light: logoFrom, dark: logoFrom } }) }));
      // The home folder is never a project: an entry for it (added before this rule) goes.
      const homes = [home(), this.homeReal].filter(Boolean);
      if (next.some((e) => !e.machine && homes.includes(e.folder))) {
        next = next.filter((e) => e.machine || !homes.includes(e.folder));
        changed = true;
      }
      const colors = { ...(shared("space.colors") ?? {}) };
      let recolor = false;
      const open = spaces().filter((s) => s.folder && !this.isHome(s));
      // A new project's logos default to brand/projects/<name>.svg (or <name>-light.svg / -dark.svg).
      const brand = open.some((s) => !next.some((x) => x.id === this.projectId(s))) ? await fs.readdir(`${appHome()}/brand/projects`).catch(() => []) : [];
      const brandOf = (n, mode) => [`${n}-${mode}.svg`, `${n}.svg`].find((f) => brand.includes(f)) ?? null;
      for (const s of open) {
        const id = this.projectId(s);
        if (!id) continue; // unknown yet: next time
        const e = next.find((x) => x.id === id);
        if (!e) {
          const order = next.reduce((m, x) => Math.max(m, (x.order ?? 0) + 1), 0);
          const repo = this.spaceRepo(s);
          const name = repo?.linked ? repo.name : s.name;
          const logo = (mode) => (brandOf(name, mode) ? `brand/projects/${brandOf(name, mode)}` : null);
          next = [...next, { id, name, folder: JSON.parse(id)[1], machine: s.machine ?? null, color: colors[s.id] ?? null, logos: { light: logo("light"), dark: logo("dark") }, order }];
          changed = true;
        } else if (!this.seen.has(s.id)) {
          if (e.color && colors[s.id] !== e.color) { colors[s.id] = e.color; recolor = true; }
        } else if (colors[s.id] && colors[s.id] !== e.color && open.filter((o) => this.projectId(o) === id).length === 1) {
          next = next.map((x) => (x.id === id ? { ...x, color: colors[s.id] } : x));
          changed = true;
        }
        // A space opened on an archived project brings it back (#88). Only a space not seen yet: those
        // kt-projects closes before archiving may linger a tick, and must not undo it.
        if (e && !this.seen.has(s.id) && archiving.isArchived(e)) {
          next = archiving.restore(next, id) ?? next;
          changed = true;
        }
        this.seen.add(s.id);
      }
      if (changed) setShared("kt.projects", next);
      if (recolor) setShared("space.colors", colors);
      if (changed || recolor) cx.notify();
    });
  }

  // What threads-model.js reads of this list's places: the repos, real paths and home found so far.
  places() {
    return { repos: this.repos, real: this.real, home: home(), homeReal: this.homeReal };
  }

  // The Home space (threads-model.js): never a project; shown first, with a house.
  isHome(s) {
    return model.isHome(s, this.places());
  }

  // The halo's color: the accent across every project, neutral at home, else the shown project's (its
  // registry color, else its space's).
  haloColor(t, shown) {
    if (this.haloTest) return paint(t, this.haloTest) ?? t.accent;
    if (this.everyProject || !shown) return t.accent;
    if (this.isHome(shown)) return t.muted;
    return paint(t, this.entryOf(shown, registry())?.color) ?? spaceColor(t, shown);
  }

  // Home's name, its square in the bar and its group's header: "Home" or the name it was given.
  homeLabel(s) {
    return model.homeLabel(s);
  }

  // A space's registry entry (by project, else by its folder as written while that's unknown).
  entryOf(s, reg) {
    return model.entryOf(s, reg, this.places());
  }

  // The project picker under the shown project: a popup (kt-project-picker) the sidebar's width
  // less 16, under the selector, as tall as its lines (its formula: 118 + 33 per line + 25 per
  // eyebrow), within the window. It reads the spaces itself; this list gives it what it has
  // worked out: each folder's real path, home's, each folder's repo.
  openProjects() {
    const ps = spaces();
    const reg = registry();
    const open = ps.filter((s) => !this.isHome(s));
    const machines = new Set(open.map((s) => s.machine ?? null)).size;
    const closed = archiving.shown(reg).filter((e) => !open.some((s) => this.entryOf(s, reg) === e)).length; // the picker skips the archived
    const lines = ps.filter((s) => this.isHome(s)).length + open.length + closed;
    const eyebrows = (machines > 1 ? machines : 0) + (closed ? 1 : 0);
    const at = this.projAt ?? { x: 8, y: 106 };
    const room = Math.max(160, (this.winH ?? 900) - at.y - 12);
    // A popup is as tall as its content: the card takes `height` from its props too.
    const height = Math.min(room, 118 + 33 * lines + 25 * eyebrows);
    openOverlay({
      mod: "kt-project-picker", kind: "popup", frame: "none", at,
      width: Math.max(220, (this.width ?? 300) - 16), height,
      props: { real: this.real, homeReal: this.homeReal, repos: this.repos, height },
    });
  }

  // The theme switch's position: what the window shows now (an appearance set elsewhere too);
  // shared "kt.themeMode" keeps the last pick.
  themeMode() {
    return String(shared("layout") ?? "").endsWith(GLASS_SUFFIX) || layout()?.window_blur ? "blur" : settings().dark ? "dark" : "light";
  }

  // Light / dark: settings.json's appearance, and back to the plain layout. Blur: appearance dark
  // and `<layout>-glass`, a copy of the shown layout's file rewritten at every pick (so it never
  // drifts from it) with window_blur, GLASS's colors and a translucent terminal at its root; the
  // node ids stay, so the mods that look up "view", "panel" or "panel-body" find them. The
  // shown layout's own file is never written.
  setTheme(mode, cx) {
    cx.spawn(async (cx) => {
      try {
        await writeAppearance(mode === "light" ? "light" : "dark");
        const shown = String(shared("layout") ?? "");
        const base = shown.endsWith(GLASS_SUFFIX) ? shown.slice(0, -GLASS_SUFFIX.length) : shown;
        if (mode === "blur" && base) {
          await writeGlass(base);
          run("layout.switch", { name: `${base}${GLASS_SUFFIX}` });
        } else if (mode !== "blur" && shown !== base) {
          run("layout.switch", { name: base });
        }
        setShared("kt.themeMode", mode);
      } catch (err) {
        notify({ title: tr("themeError"), body: String(err?.message ?? err), level: "error" });
      }
      cx.notify();
    });
  }

  // In glass mode, the shown `-glass` copy follows its layout: rewritten (writeGlass) whenever that
  // file changes, else it misses the blocks added since the pick. Nothing runs outside glass mode.
  // Glass mode is the shown layout, as themeMode() reads it: "kt.themeMode" only keeps the last
  // pick, and a layout switch (ctrl-shift-l) doesn't update it.
  followGlass(cx) {
    const shown = String(shared("layout") ?? "");
    const base = shown.endsWith(GLASS_SUFFIX) && !checking() ? shown.slice(0, -GLASS_SUFFIX.length) : null;
    if (base === this.glassBase) return;
    this.glassWatch?.cancel();
    this.glassWatch = null;
    this.glassBase = base;
    if (!base) return;
    const dir = `${appHome()}/layouts`;
    cx.spawn(async () => {
      // A half-saved layout doesn't parse: the next change retries.
      const sync = () => writeGlass(base).catch(() => {});
      await sync(); // what changed while nothing watched
      while (this.glassBase === base) {
        const watch = (this.glassWatch = watchFolder(dir));
        let paths;
        try { paths = await watch; } catch { return; }
        if (this.glassBase !== base || !paths.length) return; // [] = cancelled
        if (paths.some((p) => p === dir || p.endsWith(`/${base}.json`))) await sync();
      }
    });
  }

  // Cards compact (one 36 px line) or detailed, shared "kt.density": kbrdn-agents follows it too.
  toggleDensity() {
    setShared("kt.density", shared("kt.density") === "compact" ? "detailed" : "compact");
  }

  // The thread's todos (herdr-bridge's `todos.items`). On top, viz.js' steps in one tier (completed done,
  // in_progress running, pending to do, in the lines' colours) and its line « TODOS · the one in front
  // n / total »; one bar instead (progress, « TODOS · the one in front », n / total) past TODO_TIER todos
  // or when the bridge read fewer than its total. Under it the lines: done checked, the current one in
  // working, the rest a ring. Six at most, from the last done one, then "+N" for the rest.
  todoList(t, V, todos, id) {
    const items = todos?.items ?? [];
    const total = Math.max(items.length, todos?.total ?? 0);
    if (!total) return null;
    const done = todos.done ?? items.filter((x) => x.status === "completed").length;
    const say = (x) => (x.status === "in_progress" ? x.activeForm || x.content : x.content);
    const colors = { done: t.done, current: t.working };
    const TODOS = "TODOS"; // i18n: tech
    // The one in front, as viz.js names it: the running one, else the next to do.
    const front = items.find((x) => x.status === "in_progress") ?? items.find((x) => x.status !== "completed");
    // One id for both: from a tier to the bar, nothing draws in twice.
    const tier = total > items.length || items.length > TODO_TIER
      ? V.progress(front ? `${TODOS} · ${say(front)}` : TODOS, done, { max: total, figure: `${done} / ${total}`, id: `kt-todos-${id}`,
        color: items.some((x) => x.status === "in_progress") ? colors.current : colors.done, live: items.some((x) => x.status === "in_progress") })
      : V.steps(items.map((x) => ({ label: say(x), state: x.status === "completed" ? "done" : x.status === "in_progress" ? "current" : "todo", group: TODOS })),
        { id: `kt-todos-${id}`, colors });
    if (!items.length) return tier;
    const open = items.findIndex((x) => x.status !== "completed");
    const from = Math.max(0, Math.min((open < 0 ? items.length : open) - 1, items.length - 6));
    const shown = items.slice(from, from + 6);
    const more = Math.max(items.length, todos.total ?? 0) - shown.length;
    const mark = (s) =>
      s === "completed" ? svg(I("check")).size(11).flex_none().text_color(t.done)
        : s === "in_progress" ? div().size(7).rounded(4).flex_none().bg(t.working)
          : div().size(7).rounded(4).flex_none().border(1.5).border_color(t.dim);
    return v_flex()
      .gap(1)
      .child(tier.mb(4))
      .children(shown.map((x) =>
        h_flex().h(18).gap(7).items_center()
          .child(h_flex().w(11).flex_none().items_center().justify_center().child(mark(x.status)))
          .child(div().flex_1().min_w(0).truncate().text_size(11.5)
            .text_color(x.status === "in_progress" ? t.foreground : x.status === "completed" ? t.dim : t.muted)
            .child(x.status === "in_progress" ? x.activeForm || x.content : x.content))))
      .when(more > 0, (el) => el.child(div().pl(18).h(16).font_family(MONO).text_size(10.5).text_color(t.dim).child(rollText(this.m, `kt-todo-more-${id}`, `+${more}`, 14))));
  }

  readLive(cx) {
    if (this.readingLive) return;
    this.readingLive = true;
    cx.spawn(async (cx) => {
      // herdr-bridge, statusline and claude-flow per agent, and the quota (threads-io.js).
      const { live: next, quota } = await io.readLive(panes(), { home: home(), readTextFile }, { live: this.live, quota: this.quota });
      this.readingLive = false;
      // When each thread was first seen (shared "kt.firstSeen"): the activity date of one with no agent
      // file. Written only when a tab is new; closed tabs drop out then.
      const seen = shared("kt.firstSeen") ?? {};
      const tabs = spaces().flatMap((s) => s.tabs.map((c) => c.id));
      if (tabs.some((id) => !(id in seen))) {
        const at = Date.now();
        setShared("kt.firstSeen", Object.fromEntries(tabs.map((id) => [id, seen[id] ?? at])));
      }
      const key = JSON.stringify([next, quota]);
      if (key !== this.liveKey) { this.liveKey = key; this.live = next; this.quota = quota; cx.notify(); }
    });
  }

  readReports(cx) {
    if (this.readingReports) return;
    this.readingReports = true;
    cx.spawn(async (cx) => {
      const next = await io.readReports(panes(), this.repos, { home: home(), readTextFile, readdir: (dir) => fs.readdir(dir) });
      this.readingReports = false;
      const k = JSON.stringify(next);
      if (k !== this.reportsKey) { this.reportsKey = k; this.reports = next; cx.notify(); }
    });
  }

  // What each blocked agent waits on (decide.js): a permission herdr-bridge publishes, a held message
  // or a question. Redraws only when what waits changed.
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

  // The decision pills under the keys' cursor stop as their own lines (`dec:<key>:<tab id>`), after
  // their thread's card: enter / o press the one under it.
  pillStops(r, group, fold) {
    if (r.tab.status !== "blocked" || r.tab.settled || this.asleep(r.tab)) return [];
    const d = this.decisions[this.leads(r.tab).agent?.terminal];
    return pillKeys(d).map((key) => ({ id: `dec:${key}:${r.tab.id}`, group, fold, r, pill: { d, key } }));
  }

  // A pill pressed (a click, or enter on it): the cursor back on its thread, a toast when nothing went.
  decided(res, tab, cx) {
    if (!res?.ok) notify({ title: tr("reply.title"), body: res?.reason ?? tr("reply.none"), level: "warning", timeout: 4000 });
    if (this.cur?.startsWith("dec:")) this.cur = tab;
    this.readDecisions(cx);
    cx.notify();
  }

  // CI as a compact mark for a card's second line: ✓, ✗ or … in its color.
  ciMark(t, r) {
    const ci = r?.ci;
    if (!ci?.total) return null;
    const [color, mark] = ci.fail > 0 ? [t.ansi1, "✗"] : ci.pending > 0 ? [t.ansi3, "…"] : [t.done, "✓"];
    return div().flex_none().font_family(MONO).text_size(10.5).text_color(color).child(`CI ${mark}`); // i18n: tech
  }

  // claude-flow's whole timeline (viz.js steps), as kt-flow's head draws it: a tier per phase (steps.js'
  // phasesOf and names), a cell per step in kt-flow's colours (done green, running accent, breathing while
  // the thread works, failed red), the step in front and n / total under it; one bar when too narrow. Its id carries the
  // thread: another thread's flow draws in afresh, it doesn't morph from this one.
  flowSteps(t, V, lead, id) {
    const steps = lead?.terminal ? this.live[lead.terminal]?.flow?.steps : null;
    const list = Array.isArray(steps) ? steps.filter((s) => s?.id) : [];
    if (!list.length) return null;
    const failed = settings().dark !== false ? t.ansi9 : t.ansi1;
    return V.steps(phasesOf(list).flatMap((p) => p.steps.map((s) => ({ label: nameOf(s.id), state: s.state, group: p.label }))),
      { id: `kt-steps-${id}`, colors: { done: t.done, current: t.accent, failed } });
  }

  // Monocode's live line: what the thread's agent is doing now, or what it needs.
  liveLine(t, c, lead) {
    const l = lead?.terminal ? this.live[lead.terminal] : null;
    if (c.status === "blocked") {
      return h_flex().h(22).px(10).gap(6).items_center().rounded_full().bg(t.blocked + "26").border(1).border_color(t.blocked + "4d")
        // The detailed card's one pulse (each one redraws the window): its top right shows no NEEDS YOU.
        .child(div().size(6).rounded(3).bg(t.blocked).loop("opacity", { from: 0.3, to: 1, period: 1200 }))
        .child(div().truncate().text_size(12).font_medium().text_color(t.blocked).child(tr("needsYou")));
    }
    // An agent on another machine (#65): its live line (herdr-bridge's file) is on that machine, not read
    // from here; said where this computer's agent would show its action or answer, instead of nothing.
    const on = lead?.terminal?.includes("/") ? lead.terminal.split("/")[0] : null;
    if (on && (c.status === "working" || c.status === "done")) return div().min_w(0).truncate().text_size(11.5).text_color(t.dim).child(tr("liveRemote", { m: on }));
    const text = c.status === "working" ? l?.action?.what : c.status === "done" ? l?.answer : null;
    return text ? div().min_w(0).truncate().text_size(11.5).text_color(t.dim).child(`↳ ${text}`) : null;
  }

  // The thread's sub-agents (herdr-bridge's `agents`, the engine's own list) still shown
  // (threads-model.js): the alive ones, then the ended until GONE after they ended.
  shownAgents(terminal) {
    return model.shownAgents(terminal && this.live[terminal]?.agents, Date.now());
  }

  // What a branch shows of its age ("now", "3m"), "~" once faded: clocks() redraws when it changes.
  agentAge(a) {
    return model.agentAge(a, Date.now());
  }

  // The sub-agents as branches, the Parcours of kbrdn.dev's home (Expériences et Formations): the
  // trunk from the tile's centre (`x`) runs down, each row drawing its own piece over its whole height
  // so the pieces meet, and a ╰ bends off it 8 px above the row's middle to 8 px before the text; the
  // last ends the trunk at its bend. Each sub-agent is its program's companion (companion-logo.js) at
  // 20×16, the smallest size it draws cleanly (its corner badge is a 10 px PNG): working while alive
  // (the bob), sparkles once when seen ending, × failed, still once stopped. Its age on the right;
  // ended ones fade after FADE. 4, then "+N" as one more branch: a click (enter / l on it) shows them all,
  // unfolding on their height, "Replier" last (h, or its click: back to 4). Kept per thread's agent, here
  // only (this.twigsOpen). `agent`: the thread's agent; `id`: its tab.
  branches(t, list, x, id, agent, cx) {
    const key = agent?.terminal ?? id;
    const open = this.twigsOpen.has(key);
    const shown = list.slice(0, 4);
    const more = list.length - shown.length;
    const cursor = this.keyed && this.cur === `twigs:${id}`;
    // The trunk and bend stay whole on a faded branch: only what it says fades. `color`: the bend and the
    // piece of trunk leading to it; the trunk going on below keeps the resting line. A new branch fades
    // in, bend and all (enter: once, when it first draws).
    const rest = treeLine(t);
    const face = (last, faded, color, body) => h_flex().h(BRANCH_H).px(6).gap(8).items_center()
      .child(twig(t, { h: BRANCH_H, x, last, color, rest }))
      .child(h_flex().flex_1().min_w(0).gap(8).items_center().when(faded, (el) => el.opacity(0.45)).children(body));
    const line = (key, last, faded, color, ...body) => enter(this.m, face(last, faded, color, body), `kt-br-${id}-${key}`, { dy: 0 });
    // Under rows() (detailed cards, below): the same branch without enter, rows() fades it in.
    const plain = (key, last, faded, color, ...body) => face(last, faded, color, body).id(`kt-br-${id}-${key}`);
    // Each one's coiffe (#71): its siblings oldest first, the bridge's whole list (its last 8), not only the shown.
    const kin = [...(this.live[agent?.terminal]?.agents ?? list)].sort((x, y) => startOf(x) - startOf(y)).map((s) => `${key}:${s.id}`);
    // An ending seen within 5 s sparkles (the memo dates it); an older one, seen on a reload, does not.
    const icon = (a) => companion({
      program: agent?.program, id: `kt-sa-${id}-${a.id}`, cx, size: 20, height: 16,
      variant: variantFor(`${key}:${a.id}`, kin),
      state: isAlive(a) ? "working" : a.state === "done" ? "done" : a.state === "error" ? "error" : "idle",
      since: isAlive(a) ? startOf(a) : Date.now() - endOf(a) < 5000 ? undefined : endOf(a),
      memo: (this.memos[`${agent?.terminal ?? id}:${a.id}`] ??= {}),
    });
    const branch = (a, i, last, make = line) => {
      const ended = !isAlive(a);
      // A live sub-agent's branch in its state's color, a failed one in a muted red, the others at rest.
      const color = !ended ? alpha(t.working, "99") : a.state === "error" ? alpha(t.ansi1, "80") : rest;
      return make(a.id ?? i, last, ended && Date.now() - endOf(a) > FADE, color,
        icon(a),
        div().flex_1().min_w(0).truncate().text_size(12.5).text_color(ended ? t.muted : t.foreground).child(a.what || a.name || "agent"), // i18n: tech
        div().flex_none().text_size(12).text_color(t.dim).child(age(ended ? endOf(a) : startOf(a))));
    };
    // "+N" / "Replier": the last branch, a click (or the keys' cursor on it) folds or unfolds the rest.
    // `gone`: closing under rows(), no longer a target.
    const toggle = (label, chevron, make = line, gone = false) => make(open ? "fold" : "more", true, false, rest,
      div().font_family(MONO).text_size(10.5).text_color(cursor && !gone ? t.foreground : t.dim).child(label),
      svg(I(chevron)).size(11).flex_none().text_color(t.dim))
      .rounded(8).when(cursor && !gone, (el) => el.bg(alpha(t.accent, "24")))
      .when(!gone, (el) => el.cursor_pointer().hover((s) => s.bg(t.hover))
        .on_click((_e, cx) => {
          cx.stop_propagation();
          if (open) this.twigsOpen.delete(key);
          else this.twigsOpen.add(key);
          cx.notify();
        }));
    // A detailed card (nothing folds around it): the branches open and close on their height, in order
    // (motion.js rows(), keyed by sub-agent), the toggle last as one more: 4, then the rest as it
    // unfolds, back to 4 as it folds. A compact card's are inside its fold (collapse(), one height
    // level): they fade in as before. The card's last sub-agent leaving takes the block at once.
    if (!this.compact) {
      const items = [...(open || more <= 0 ? list : shown).map((a, i) => ({ a, i })), ...(more > 0 ? [{ toggle: true }] : [])];
      return v_flex().children(motionRows(this.m, cx, `kt-twigs-${id}`, items, (e) => (e.toggle ? "toggle" : String(e.a.id ?? e.i)), (e, j) =>
        e.toggle ? toggle(open ? "Replier" : more > 0 ? (this.fewRows ? rollText(this.m, `kt-twigs-n-${id}`, `+${more}`, 14) : `+${more}`) : "", open ? "chevron-up" : "chevron-down", plain, j < 0)
          : branch(e.a, e.i, more <= 0 && e.i === list.length - 1, plain)));
    }
    if (more <= 0) return v_flex().children(list.map((a, i) => branch(a, i, i === list.length - 1)));
    // A builder: the rest folds on its height too (motion.js collapse), not only unfolds.
    const rest4 = collapse(this.m, `kt-twigs-all-${id}`, open,
      () => v_flex().children([...list.slice(4).map((a, i) => branch(a, i + 4, false)), toggle("Replier", "chevron-up")]), { cx });
    return v_flex()
      .children(shown.map((a, i) => branch(a, i, false)))
      .when(Boolean(rest4), (el) => el.child(rest4))
      .when(!open, (el) => el.child(toggle(this.fewRows ? rollText(this.m, `kt-twigs-n-${id}`, `+${more}`, 14) : `+${more}`, "chevron-down")));
  }

  // The "+N" / "Replier" line of a thread whose sub-agents run past 4: a stop for the keys' cursor too.
  twigStop(r, group, fold) {
    if (r.tab.settled || this.asleep(r.tab)) return [];
    const agent = this.leads(r.tab).agent;
    if (this.shownAgents(agent?.terminal).length <= 4) return [];
    return [{ id: `twigs:${r.tab.id}`, group, fold, r, twigs: agent?.terminal ?? r.tab.id }];
  }

  // The shown thread's inner card (radius 8, 4 px inside the card's 12: concentric), dashed on
  // top, with only the rows there's data for: the rings (context, the 5 h window), the numbers
  // (cost · time · lines · cache TTL, the cache hit under 85 %), claude-flow's steps by phase, the todos, the
  // sub-agents on their rail, the report's CI and review (its PR is on line 2). The weekly quota
  // stays in the status line.
  focusCard(t, { sl, todos, lead, agent, working, report, c }) {
    const s = sl ?? {};
    const five = sl ? windowOf(this.quota, "five_hour") : null;
    // The weekly limit when there is no 5 h window (none on Kylian's plan): the 5 h one wins if it is back.
    const week = sl && !five ? windowOf(this.quota, "seven_day") : null;
    const weekReset = week ? resetWords(week.resets_at) : "";
    const eyebrow = (text) => div().font_family(MONO).text_size(10).text_color(t.muted).child(text);
    const beside = (text) => div().min_w(0).truncate().font_family(MONO).text_size(10).text_color(t.dim).child(text);
    // A 32 px ring, its value in the middle, its label and detail beside it.
    // ring.js colours it like the Claude Code status line: context by context rot, quotas by level.
    const cell = (id, label, pct, sub, kind = "quota") => h_flex().flex_1().min_w(0).gap(8).items_center()
      .child(ring(t, id, pct, 32, { kind, window: s.window, roll, m: this.m })).child(v_flex().min_w(0).gap(1).child(eyebrow(label)).when(Boolean(sub), (el) => el.child(beside(sub))));
    const rings = [
      s.ctx_pct != null && cell(`kt-ring-cx-${c.id}`, tr("context"), s.ctx_pct, s.window && ctxTokens(s) > 0 ? `${toks(ctxTokens(s))} / ${toks(s.window)}` : null, "ctx"),
      five && cell(`kt-ring-5h-${c.id}`, "5H", five.used_percentage, `reset ${clock(five.resets_at)}`),
      week && cell(`kt-ring-7j-${c.id}`, tr("week"), week.used_percentage, weekReset).id(`kt-7j-${c.id}`).tooltip(weekReset),
    ].filter(Boolean);
    const ttl = s.cache_at && s.cache_ttl ? s.cache_at / 1000 + s.cache_ttl - Date.now() / 1000 : null;
    const mono = (color, text) => div().flex_none().font_family(MONO).text_size(11).text_color(color).child(text);
    // The same, its numbers rolling (rollText); the ids carry the thread: another one's figures show at once.
    const rmono = (color, key, text) => rollText(this.m, `kt-fc-${key}-${c.id}`, text, 15).flex_none().font_family(MONO).text_size(11).text_color(color);
    // The session's duration: its seconds (the first minute) don't roll.
    const dur = s.duration_ms > 0 ? duration(Date.now() - s.duration_ms) : "";
    const numbers = [
      // The dollars roll, the cents don't: they change at every reading.
      s.cost_usd != null && roll(this.m, `kt-fc-cost-${c.id}`, `$${fnum(s.cost_usd, 2)}`, 15, { snap: 2 }).font_family(MONO).text_size(11)
        .text_color(levelColor(t, costLevel(s.cost_usd, s.model), { okGreen: true })),
      s.duration_ms > 0 && (/s$/.test(dur) ? mono(t.muted, dur) : rmono(t.muted, "dur", dur)),
      (s.lines_added > 0 || s.lines_removed > 0) && h_flex().gap(4).child(rmono(t.ansi2, "add", `+${s.lines_added ?? 0}`)).child(rmono(t.ansi1, "del", `−${s.lines_removed ?? 0}`)),
      ttl != null && (ttl > 0 ? rmono(t.dim, "ttl", `TTL ${ttl >= 3600 ? `${Math.floor(ttl / 3600)}h${String(Math.floor((ttl % 3600) / 60)).padStart(2, "0")}` : `${Math.ceil(ttl / 60)}m`}`) : mono(t.ansi1, tr("ttlGone"))),
      // The cache hit only when it's worth a look: under 85 %.
      s.hit_pct != null && s.hit_pct < 85 && rmono(s.hit_pct < 60 ? t.ansi1 : t.blocked, "hit", `cache ${Math.round(s.hit_pct)}%`),
    ].filter(Boolean);
    // The report's CI and review only (its PR is already on line 2): "✓ CI 3/3 · R2 · 0 bloquant".
    const ci = report?.ci?.total ? report.ci : null;
    const rv = report?.review ?? null;
    const reportLine = [
      // Failing counts the failures, else the passes: in the id, so 3 passed never rolls into 1 failed.
      ci && rmono(ci.fail > 0 ? t.ansi1 : ci.pending > 0 ? t.ansi3 : t.done, `ci-${ci.fail > 0 ? "f" : "o"}`, `${ci.fail > 0 ? "✗" : ci.pending > 0 ? "…" : "✓"} CI ${ci.fail > 0 ? ci.fail : ci.ok}/${ci.total}`),
      rv && rmono(rv.blockers === null ? t.dim : rv.blockers > 0 ? t.blocked : t.done, "rv",
        `R${rv.pass} · ${rv.blockers === null ? tr("notRun") : tr("blockers", { n: rv.blockers })}`),
    ].filter(Boolean);
    // viz.js on the card's motion (reduced: drawn at once, nothing breathes) and roll (n / total rolls).
    // The running step's and todo's pulse only while the thread works (no loop for nothing): otherwise a
    // reduced copy of the motion, sharing its widths and folds (made here first, else the copy's are lost).
    this.m.widths ??= new Map();
    this.m.folded ??= new Set();
    const V = viz(t, working ? this.m : { ...this.m, reduced: true }, { roll });
    const rows = [
      // Before the first read of the agents' files: two rings' shapes (skeleton.js), breathing.
      rings.length > 0 ? h_flex().gap(8).items_center().children(rings) : this.liveKey === undefined && ((S) => S.pulse(h_flex().id(`kt-rings-sk-${c.id}`).gap(8).items_center()
        .children([0, 1].map(() => h_flex().flex_1().min_w(0).gap(8).items_center().child(S.circle(32, { ring: 3 }))
          .child(v_flex().min_w(0).gap(1).child(S.line(36, { h: 6, lh: 13 })).child(S.line(72, { h: 6, lh: 13 })))))))(skeleton(t, this.m)),
      numbers.length > 0 && h_flex().min_h(16).gap_x(8).gap_y(4).items_center().flex_wrap()
        .children(numbers.flatMap((n, i) => (i ? [div().text_size(11).text_color(t.border).child("·"), n] : [n]))),
      this.flowSteps(t, V, lead, c.id),
      this.todoList(t, V, todos, c.id),
      reportLine.length > 0 && h_flex().h(16).gap(8).items_center()
        .children(reportLine.flatMap((n, i) => (i ? [div().text_size(11).text_color(t.border).child("·"), n] : [n]))),
    ].filter(Boolean);
    if (!rows.length) return null;
    return v_flex().p(8).gap(6).rounded(8).bg(t.background).border_t(1).border_dashed().border_color(t.border)
      .children(rows.map((r, i) => (i ? div().pt(6).border_t(1).border_dashed().border_color(t.border).child(r) : r)));
  }

  // The folder's repo of a space (where it was made), or null outside git.
  spaceRepo(s) {
    return model.spaceRepo(s, this.repos);
  }

  // A project's key: its repo (worktree spaces share it), else the space itself.
  spaceKey(s) {
    return model.spaceKey(s, this.repos);
  }

  // The Worktrees entry's badge: the shown project's checkouts (its git dir's worktrees/ entries
  // and the main one, as `gwm list` counts them), read at most every 10 s; this computer only.
  worktreeCount(s, cx) {
    const r = s && !this.isHome(s) ? this.spaceRepo(s) : null;
    const [on, dir] = r ? JSON.parse(r.key) : [null, null];
    if (!dir || on) return null;
    if ((this.wt?.dir !== dir || Date.now() - this.wt.at > 10e3) && !this.wtBusy && !checking()) {
      this.wtBusy = true;
      cx.spawn(async (cx) => {
        const n = 1 + (await fs.readdir(`${dir}/worktrees`).catch(() => [])).length;
        const changed = this.wt?.dir !== dir || this.wt?.n !== n;
        this.wt = { dir, n, at: Date.now() };
        this.wtBusy = false;
        if (changed) cx.notify();
      });
    }
    return this.wt?.dir === dir ? this.wt.n : undefined; // undefined: still counted (its badge a skeleton); null: none
  }

  // A space's project, as the registry ids it: its repo's main checkout (a worktree, or a space
  // whose terminal moved into a subfolder, belongs to it), else its folder's real path; null
  // while that's being worked out.
  projectId(s) {
    return model.projectId(s, this.places());
  }

  // Spaces grouped by project, one group per project: its first plain checkout on top, then its
  // other spaces (worktrees, a second space on the same folder).
  projectTree(ps) {
    const groups = new Map();
    for (const s of ps) {
      const id = this.projectId(s) ?? `space:${s.id}`;
      const g = groups.get(id);
      if (!g) groups.set(id, { s, kids: [] });
      else if (!this.spaceRepo(s)?.linked && this.spaceRepo(g.s)?.linked) { g.kids.unshift(g.s); g.s = s; }
      else g.kids.push(s);
    }
    return [...groups.values()];
  }

  // Monocode's project bar: a colored square per project, the shown one ringed in accent,
  // a pulsing dot where an agent waits for you.
  // Home first (a house), then the open projects in the registry's order, then open spaces it
  // doesn't hold yet, then the closed projects in the registry's order, dimmed (a click opens them
  // again): openFirst, the picker's order too. Logo, else the initial on the color.
  // A registry square drags (as the picker's lines): pressed, moved over another (a 2 px accent bar
  // where it lands), released there, it takes that one's place among its own group, open or closed
  // (moveInGroup: a drop outside it lands at its edge); a press released where it began is a click.
  // An archived project has no square (#88); a right-click on a registry square, open or closed, opens its
  // menu (kt-menu, tab "project": archive, delete by force, both through kt-projects).
  projectBar(t, all) {
    const reg = registry();
    const homes = all.filter((s) => this.isHome(s));
    const tree = this.projectTree(all.filter((s) => !this.isHome(s))).map((g) => ({ ...g, e: this.entryOf(g.s, reg) }));
    const isOpen = (id) => tree.some((g) => g.e?.id === id);
    const ordered = openFirst(reg, isOpen);
    const openReg = ordered.filter((e) => isOpen(e.id));
    const closedReg = ordered.filter((e) => !isOpen(e.id) && !archiving.isArchived(e)); // #88: not the archived
    const loose = tree.filter((g) => !g.e);
    // The ids as shown (drop targets): Home, the open, the loose spaces, the closed.
    this.barOpen = isOpen;
    this.barShownIds = [...(homes.length ? ["home"] : []), ...openReg.map((e) => e.id), ...loose.map((g) => g.s.id), ...closedReg.map((e) => e.id)];
    const from = this.barShownIds.indexOf(this.barPress);
    // `drag`: a registry project's id (it drags); `drop`: the id it is as a target.
    const square = (key, name, color, logo, on, dim, onClick, icon, drag, drop) => {
      const at = this.barShownIds.indexOf(drop);
      return div()
        .id(`kt-bar-${key}`)
        .relative()
        .size(30)
        .p(2)
        .flex_none()
        .rounded(8)
        .border(1)
        .border_color(on ? t.accent : t.accent + "00")
        .when(!on, (el) => el.hover((st) => st.border_color(t.border)))
        .cursor_pointer()
        .tooltip(name)
        .when(this.barPress === drop && this.barOver !== drop, (el) => el.opacity(0.5))
        .when(this.barPress != null && this.barOver === drop && this.barPress !== drop, (el) => el.child(
          div().absolute().top(3).bottom(3).w(2).rounded(1).bg(t.accent).when(from < at, (b) => b.right(-5)).when(from > at, (b) => b.left(-5))))
        .when(Boolean(drag), (el) => el.on_mouse_down("left", () => { this.barPress = drag; this.barOver = drag; }))
        .when(Boolean(drag), (el) => el.on_mouse_down("right", () =>
          openOverlay({ mod: "kt-menu", kind: "popup", width: 200, props: { tab: "project", target: { id: drag } } })))
        .on_mouse_move((_e, cx) => {
          if (this.barPress != null && this.barOver !== drop) { this.barOver = drop; cx.notify(); }
        })
        .on_mouse_up("left", (_e, cx) => {
          const src = this.barPress;
          this.barPress = null;
          this.barOver = null;
          if (src != null && src !== drop) this.moveProject(src, drop);
          else if (src === drop && drag) onClick();
          cx.notify();
        })
        .when(!drag, (el) => el.on_click(onClick))
        // Without a logo: the initial on the logos' dithered background of its color (projtile.js,
        // 24 = the square less its padding and border).
        .child(logo || icon
          ? div().size_full().rounded(6).bg(t.raised).flex().items_center().justify_center()
            .when(dim, (el) => el.opacity(0.4))
            .child(icon ?? image(logo).size(18))
          : projTile(this.tiles, { color, size: 24,
            letter: div().text_size(11).font_semibold().text_color(LETTER).child([...name][0]?.toUpperCase() ?? "?") })
            .when(dim, (el) => el.opacity(0.4)),
        );
    };
    // Another machine's project (#64): its name says the machine (and its state when it doesn't answer),
    // its square is greyed then, and a dot in its corner is the machine's state (machines.js).
    const onM = (name, m) => (m ? [name, m, stateWord(m)].filter(Boolean).join(" · ") : name);
    const away = (m) => Boolean(m) && !reachable(m);
    const mDot = (el, m, key) => (!m ? el : el.child(div().id(`kt-bar-m-${key}`).absolute().bottom(-3).right(-3).size(9).rounded(5)
      .border(2).border_color(t.chrome).bg(stateColor(t, stateOf(m).status))));
    // One square per project (its group of spaces): ringed when any of them shows; a click goes
    // to the one shown, else the group's first. Home: a house, no project color.
    const live = ({ s, kids }, e, house = false) => {
      const group = [s, ...kids];
      const blocked = group.some((x) => x.status === "blocked");
      const go = group.find((x) => x.active) ?? s;
      const on = group.some((x) => x.active);
      return mDot(square(s.id, onM(house ? this.homeLabel(s) : e?.name ?? s.name, s.machine), spaceColor(t, s), logoOf(e), on, away(s.machine), () => run("space.select", { id: go.id }),
        house ? svg(I("house")).size(14).text_color(on ? t.accent : t.muted) : null, e?.id ?? null, house ? "home" : e?.id ?? s.id)
        .when(blocked, (el) =>
          // Still: the agent's card is its one pulse.
          el.child(div().id(`kt-bar-wait-${s.id}`).absolute().top(-3).right(-3).size(9).rounded(5).border(2).border_color(t.chrome).bg(t.blocked))), s.machine, s.id);
    };
    // `on`: the square of the shown project.
    const groups = [
      ...(homes.length > 0 ? [{ key: homes[0].id, on: homes.some((x) => x.active), el: live({ s: homes[0], kids: homes.slice(1) }, null, true) }] : []),
      ...openReg.map((e) => {
        const g = tree.find((x) => x.e === e);
        return { key: e.id, on: [g.s, ...g.kids].some((x) => x.active), el: live(g, e) };
      }),
      ...loose.map((g) => ({ key: g.s.id, on: [g.s, ...g.kids].some((x) => x.active), el: live(g, null) })),
      // A closed project on a machine away doesn't reopen: its hover says why (onM).
      ...closedReg.map((e, i) => ({ key: `closed-${e.id}`, on: false,
        el: mDot(square(`closed-${i}`, tr("closed", { name: onM(e.name, e.machine) }), paint(t, e.color) ?? t.dim, logoOf(e), false, true,
          () => { if (!away(e.machine)) run("space.new", { folder: e.folder, name: e.name, machine: e.machine ?? "" }); }, null, e.id, e.id), e.machine, `closed-${i}`) })),
    ];
    const n = groups.length;
    if (!n) return null;
    // One row that scrolls sideways once it's wider than the sidebar (measured: barW); then the
    // arrows show, outside the scrolling row so its children stay the squares.
    const stride = SQUARE + BAR_GAP;
    const over = this.barW > 0 && n * stride - BAR_GAP + 2 * BAR_PAD > this.barW;
    const view = over ? this.barW - 2 * BAR_PAD - 2 * (ARROW + 4) : n * stride;
    const shown = Math.max(1, Math.floor((view + BAR_GAP) / stride));
    this.barFit = { n, shown: over ? shown : n };
    this.barAt = over ? Math.max(0, Math.min(this.barAt, n - shown)) : 0;
    // The shown project comes into view when it changes (once, not on every render).
    const active = groups.findIndex((g) => g.on);
    const activeKey = active >= 0 ? groups[active].key : null;
    if (over && activeKey !== this.barShown) {
      this.barShown = activeKey;
      if (active >= 0) {
        this.barScroll.scroll_to_item(active);
        if (active < this.barAt) this.barAt = active;
        else if (active > this.barAt + shown - 1) this.barAt = active - shown + 1;
      }
    }
    const arrow = (dir, ok) =>
      h_flex()
        .id(`kt-bar-${dir}`)
        .w(ARROW)
        .h(24)
        .flex_none()
        .items_center()
        .justify_center()
        .rounded(6)
        .text_color(t.muted)
        .when(!ok, (el) => el.opacity(0.35))
        .when(ok, (el) => el.cursor_pointer().hover((s) => s.bg(t.hover).text_color(t.foreground))
          .on_click((_e, cx) => { this.pageBar(dir === "right" ? 1 : -1); cx.notify(); }))
        .child(svg(I(`chevron-${dir}`)).size(14));
    // Short rules above and below, as the sidebar's other dashed ones: 12 px in, 8 px from the row.
    const rule = () => div().flex_none().mx(BAR_PAD).h(0).border_t(1).border_dashed().border_color(t.border);
    return v_flex()
      .flex_none()
      .pt(4)
      .child(rule())
      .child(
        h_flex()
          .id("kt-bar")
          .px(BAR_PAD)
          .my(4)
          .gap(4)
          .items_center()
          // A drag let go between squares or on an arrow ends there, nothing moved.
          .on_mouse_up("left", (_e, cx) => {
            if (this.barPress == null) return;
            this.barPress = null;
            this.barOver = null;
            cx.notify();
          })
          .on_size_change((size, cx) => {
            if (size.width !== this.barW) {
              this.barW = size.width;
              cx.notify();
            }
          })
          .when(over, (el) => el.child(arrow("left", Math.round(this.barAt) > 0)))
          .child(
            // 4 px above and below: room for the pulsing dot on a square's corner (the row clips).
            h_flex()
              .id("kt-bar-row")
              .flex_1()
              .min_w(0)
              .py(4)
              .gap(BAR_GAP)
              .overflow_x_scroll()
              .track_scroll(this.barScroll)
              // ponytail: the wheel's move is estimated from its pixels (no offset to read); an arrow can
              // show at its end a little early or late after a long wheel scroll. Exact once clicked.
              .on_scroll_wheel((e, cx) => {
                if (!over) return;
                const d = e.delta.x || e.delta.y;
                const at = Math.max(0, Math.min(n - shown, this.barAt - d / stride));
                if (Math.round(at) !== Math.round(this.barAt)) cx.notify();
                this.barAt = at;
              })
              .children(groups.map((g) => g.el)),
          )
          .when(over, (el) => el.child(arrow("right", Math.round(this.barAt) + shown < n))),
      )
      .child(rule());
  }

  // Every time text the rows show, in one string: what the tick compares.
  clocks() {
    const snoozed = this.snoozed();
    return spaces()
      .flatMap((w) =>
        w.tabs.map((c) =>
          this.asleep(c)
            ? until(snoozed[c.id].until)
            : c.status === "working"
              ? c.working_since ? duration(c.working_since) : ""
              : c.status === "blocked" || c.status === "done"
                ? c.status
                : age(c.settled ? c.settled_at : c.changed_at),
        ),
      )
      .concat(Object.keys(this.live).flatMap((k) => this.shownAgents(k).map((a) => this.agentAge(a))))
      .concat(Object.values(this.live).map((l) => cacheLeft(l.sl)), ["five_hour", "seven_day"].map((n) => windowOf(this.quota, n)?.resets_at ?? 0).map((s) => (s ? resetIn(s) : "")))      .join("|");
  }

  // New folders only: a folder's repo doesn't change. Asked on render too,
  // so a new space shows its project at once.
  findRepos(cx) {
    const here = [...spaces().map((s) => [s.machine ?? null, s.folder]), ...panes().filter((p) => p.terminal).map((p) => [p.terminal.includes("/") ? p.terminal.split("/")[0] : null, p.cwd])].filter(([, cwd]) => cwd).map((at) => JSON.stringify(at));
    // #61: a machine away isn't asked (back, its places are: the render that sees it back); one queue per
    // machine, this computer's never behind another's; a place it couldn't ask is not kept as « no repo ».
    const folders = [...new Set(here.filter((f) => f && !(f in this.repos) && io.askable(f, { reachable, tried: this.triedRepo })))];
    for (const [m, q] of io.queues(folders)) {
      if (this.finding.has(m)) continue;
      this.finding.add(m);
      cx.spawn(async (cx) => {
        await io.drain(q, (l) => io.findRepo(l, ask), this.repos, this.triedRepo);
        this.finding.delete(m);
        cx.notify();
      });
    }
  }

  // Settling a thread. Settling the last open one of a local worktree offers, in a notification, to
  // remove it: a click hands it to kt-gwm's guarded removal (wt-remove: its own confirmation, its refusals,
  // a dry run, never --force). Not a jump to Worktrees on every settle: settling is quick and undone at once.
  settle(w, c) {
    run("tab.settle", { id: c.id });
    const last = w.tabs.every((x) => x.id === c.id || x.settled);
    if (last && !w.machine && w.folder && this.repos[JSON.stringify([null, w.folder])]?.linked)
      notify({ title: tr("wt.title"), body: tr("wt.body", { name: w.name }),
        level: "info", timeout: 8000, action: { name: `kt-threads.wt-remove:${w.folder}`, args: {} } });
  }

  snoozed() {
    return shared("kt.snoozed") ?? {};
  }

  // Snoozed now: not yet due, and its agent hasn't asked for you since.
  asleep(c) {
    return model.asleep(c, this.snoozed(), Date.now());
  }

  snooze(id, wake) {
    const all = { ...this.snoozed() };
    if (wake) all[id] = { until: wake, at: Date.now() };
    else delete all[id];
    setShared("kt.snoozed", all);
  }

  // The pull request of a branch, asked of `gh` at most every few minutes (pr-pick.js chooses it).
  // None on a long-lived branch, nor on the repo's default branch.
  pr(cwd, branch, on) {
    if (!cwd || !branch || longLived(branch, this.defaults[this.repoOf(on, cwd)])) return null;
    const key = model.prKey(on, cwd, branch);
    if (!(Date.now() - (this.asked[key] ?? 0) < PR_EVERY) && !this.queue.includes(key)) this.queue.push(key);
    return this.prs[key] ?? null;
  }

  // A folder's repo (its git common dir, as findRepos keys it), else the folder itself.
  repoOf(on, cwd) {
    return model.repoOf(on, cwd, this.repos);
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

  badge(t, c, pr) {
    const look = PR[pr.state] ?? PR.OPEN;
    return h_flex()
      .id(`kt-pr-${c.id}`)
      .flex_none()
      .gap(3)
      .items_center()
      .font_family(MONO)
      .text_size(11)
      .text_color(t[look.color])
      .cursor_pointer()
      .hover((s) => s.opacity(0.8))
      .on_click((_e, cx) => {
        cx.stop_propagation();
        const p = win()?.platform;
        if (p === "windows") exec("explorer.exe", [pr.url]).catch(() => {});
        else exec(p === "macos" ? "open" : "xdg-open", [pr.url]).catch(() => {});
      })
      .child(svg(I(look.icon)).size(12))
      .child(`#${pr.number}`);
  }

  pins() {
    return shared("kt.pins") ?? [];
  }

  togglePin(id) {
    const pins = this.pins();
    setShared("kt.pins", pins.includes(id) ? pins.filter((p) => p !== id) : [...pins, id]);
  }


  // Monocode's status, mono 10.5 with no frame: a spinner while working, a pulsing dot when it needs you.
  // A thread's status tag; a new status fades in where the last one was (its id carries the status).
  status(t, c) {
    const mono = (color) => h_flex().flex_none().gap(5).items_center().font_family(MONO).text_size(10.5).text_color(color);
    // Its minutes roll in a short list (12 threads or fewer); its seconds, the first minute, don't.
    const working = `WORKING${c.working_since ? ` ${duration(c.working_since).toUpperCase()}` : ""}`; // i18n: tech
    // Monocode's states: the same words in every language (I18N.md).
    const tag = c.status === "blocked"
      ? mono(t.blocked).child(div().size(6).rounded(3).bg(t.blocked).loop("opacity", { from: 0.3, to: 1, period: 1200 })).child("NEEDS YOU") // i18n: tech
      : c.status === "done" ? mono(t.done).child("DONE") // i18n: tech
        : c.status === "working"
          ? mono(t.working).child(svg(SPIN).size(11).spin(900)).child(this.fewRows && !/S$/.test(working) ? rollText(this.m, `kt-st-n-${c.id}`, working, 14) : working)
          : null;
    return tag && enter(this.m, tag, `kt-st-${c.id}-${c.status}`, { dy: 0 });
  }

  button(id, label, icon, onClick) {
    const t = this.t;
    return h_flex()
      .id(id)
      .gap(4)
      .px(6)
      .py(1)
      .rounded_full()
      .items_center()
      .text_size(12)
      .text_color(t.muted)
      .cursor_pointer()
      .hover((s) => s.text_color(t.foreground).bg(t.hover))
      .on_click((_e, cx) => {
        cx.stop_propagation();
        onClick();
        cx.notify();
      })
      .when(Boolean(icon), (el) => el.child(svg(I(icon)).size(13)))
      .when(Boolean(label), (el) => el.child(label));
  }

  // ---------- grouped by project (threads-model.js' projectGroups) ----------

  // A project's header, one thin line (no frame, no rule: the space between groups is enough): its
  // 14 px logo (the registry's, for the appearance now), else its initial on the logos' dithered
  // background of its color (projtile.js), Home's house; its name as a mono eyebrow, how many
  // threads, "N te demandent" only when some do; a
  // chevron only once folded (a click, or h on it or one of its threads, folds it).
  groupHead(t, g, i) {
    const name = g.home ? this.homeLabel(g.space) : g.entry?.name ?? g.space.name;
    const logo = g.home ? null : logoOf(g.entry);
    const cursor = this.keyed && this.cur === `grp:${g.key}`;
    const folded = this.folded.has(g.key);
    const mark = g.home
      ? svg(I("house")).size(12).text_color(t.muted)
      : logo
        ? image(logo).size(14).rounded(3)
        : projTile(this.tiles, { color: paint(t, g.entry?.color) ?? spaceColor(t, g.space), size: 14,
          letter: div().text_size(8.5).font_semibold().text_color(LETTER).child([...name][0]?.toUpperCase() ?? "?") });
    return h_flex()
      .id(`kt-grp-${i}`)
      .mx(8)
      .mt(i ? 10 : 2)
      .px(10)
      .h(22)
      .gap(7)
      .items_center()
      .rounded(8)
      .border(1)
      .border_color(cursor ? alpha(t.accent, "99") : alpha(t.accent, "00"))
      .when(cursor, (el) => el.bg(alpha(t.accent, "24")))
      .cursor_pointer()
      .on_click((_e, cx) => {
        if (folded) this.folded.delete(g.key);
        else this.folded.add(g.key);
        cx.notify();
      })
      .child(div().size(14).flex_none().flex().items_center().justify_center().child(mark))
      .child(div().min_w(0).truncate().font_family(MONO).text_size(10).text_color(cursor ? t.foreground : t.muted).child(name.toUpperCase()))
      .child(roll(this.m, `kt-g-n-${g.key}`, String(g.threads.length), 13).font_family(MONO).text_size(10).text_color(t.dim))
      .child(div().flex_1())
      .when(g.need > 0, (el) => el.child(h_flex().flex_none().h(16).px(6).items_center().rounded_full().border(1)
        .border_color(alpha(t.blocked, "4d")).bg(alpha(t.blocked, "1a")).font_family(MONO).text_size(9.5).text_color(t.blocked)
        .child(tr("asks", { n: g.need }))))
      .when(folded, (el) => el.child(svg(I("chevron-right")).size(11).flex_none().text_color(t.dim)));
  }

  // ---------- compact rows, opened ----------

  // Compact: the row under the pointer, the keys' cursor, or the one just left open as a detailed
  // card; detailed cards don't change.
  expanded(id) {
    return this.compact && (id === this.hover || id === this.keep || (this.keyed && id === this.curThread));
  }

  // A row the pointer or the cursor just left stays open 150 ms (one timer, the last one wins), so
  // going from row to row doesn't flicker; then it folds back, no animation.
  linger(id, cx) {
    if (!this.compact || !id) return;
    this.keep = id;
    const tok = (this.keepTok = (this.keepTok ?? 0) + 1);
    cx.timer.after(150, (cx) => {
      if (this.keepTok !== tok) return;
      this.keep = null;
      cx.notify();
    });
  }

  // ---------- keys (vim.js; kt-keys lists them) ----------

  // The keyboard comes here (ctrl-b h, a key command): normal mode, the cursor on the shown thread.
  focusIn() {
    this.handle.focus();
    this.vim.normal();
    if (!this.flat.some((x) => x.id === this.cur)) {
      const here = this.flat.find((x) => x.r?.space.active && x.r?.tab.active);
      this.cur = (here ?? this.flat[0])?.id ?? null;
    }
    this.reveal = true;
  }

  key(e, cx) {
    if (!this.act(this.vim.handle(e), cx)) return; // not ours: ctrl-b, cmd-* go on
    cx.stop_propagation();
    cx.notify();
  }

  // A thread's terminals: the one it shows first, and its agent's (else the lead).
  leads(c) {
    return model.leads(c, panes());
  }

  // One vim action on the list; false: not one the sidebar has, and the key goes on.
  act(a, cx) {
    if (!a) return false;
    if (a === "pending" || a === "count") return true;
    const flat = this.flat;
    const i = flat.findIndex((x) => x.id === this.cur);
    const x = flat[i];
    const r = x?.r;
    if (["down", "up", "top", "bottom", "half-down", "half-up"].includes(a)) {
      const j = step(a, i, flat.length, this.vim.count, this.compact ? 14 : 7);
      if (j >= 0) this.cur = flat[j].id;
      if (this.cur !== x?.id) this.linger(x?.r?.tab.id ?? x?.id, cx);
      this.reveal = true;
    } else if (a === "tab-next" || a === "tab-prev") {
      // The next (previous) group's first row: pinned, the date groups, the snoozed shelf.
      const groups = [...new Set(flat.map((y) => y.group))];
      const g = groups.indexOf(x?.group);
      const to = groups[a === "tab-next" ? Math.min(groups.length - 1, g + 1) : Math.max(0, g - 1)];
      const first = flat.find((y) => y.group === to);
      if (first) {
        this.cur = first.id;
        this.reveal = true;
      }
    } else if (a === "left") {
      // h folds a project (from its header or one of its threads), the snoozed shelf, or the Agents
      // group (from its line or one of its pages: the cursor goes back to the group).
      if (x?.id === "kt-agents" || x?.navChild) {
        setShared("kt.nav.agents", false);
        this.cur = "kt-agents";
      } else if (x?.twigs) this.twigsOpen.delete(x.twigs); // back to 4 sub-agents
      else if (x?.fold) {
        this.folded.add(x.fold);
        this.cur = `grp:${x.fold}`;
      } else if (x?.group === "snoozed" && this.showSnoozed) {
        this.showSnoozed = false;
        this.cur = "snoozed";
      }
    } else if (a === "right" || a === "open") {
      // "+N": enter / o / l show all the sub-agents.
      if (x?.twigs) this.twigsOpen.add(x.twigs);
      // A decision pill: enter / o press it (as a click); l does nothing there.
      else if (x?.pill) {
        if (a === "open") cx.spawn(async (cx) => this.decided(await press(x.pill.d, x.pill.key), r.tab.id, cx));
      }
      else if (x?.group === "nav") this.nav[x.id]();
      else if (x?.head) {
        if (a === "right" || this.folded.has(x.fold)) this.folded.delete(x.fold);
        else this.folded.add(x.fold);
      } else if (x?.id === "snoozed") this.showSnoozed = a === "right" ? true : !this.showSnoozed;
      else if (r) {
        // l shows the thread and keeps the keyboard; enter / o go to its terminal.
        show("thread");
        run("tab.select", { id: r.tab.id });
        const { lead } = this.leads(r.tab);
        if (a === "open" && lead) run("pane.focus", { pane: lead.pane });
        else this.handle.focus();
      }
    } else if (a === "archive") {
      // Archive (tab.settle, reversible: no confirmation); in the archived view, restore.
      if (r) {
        this.cur = (flat[i + 1] ?? flat[i - 1])?.id ?? null;
        if (r.tab.settled) run("tab.unsettle", { id: r.tab.id });
        else this.settle(r.space, r.tab);
      }
    } else if (a === "delete") {
      if (r) openOverlay({ mod: "kt-confirm", kind: "dialog", width: 1, height: 1, frame: "none", props: {
        title: tr("close.title"), detail: tr("close.detail", { name: label(r.tab, this.leads(r.tab).agent) }),
        label: tr("close"), danger: true, command: { name: "tab.close", args: { id: r.tab.id } } } });
    } else if (a === "yank") {
      const at = r ? this.leads(r.tab).lead?.cwd ?? r.space.folder : null;
      if (at) {
        cx.write_to_clipboard(at);
        notify({ title: tr("copied"), body: at, level: "success", timeout: 2000 });
      }
    } else if (a === "refresh") {
      this.asked = {};
      this.readLive(cx);
      this.readReports(cx);
    } else if (a === "escape" || a === "quit") run("pane.go", { direction: "right" });
    else if (a === "help") openOverlay({ mod: "kt-keys", kind: "dialog", width: 1, height: 1, frame: "none", props: { group: "sidebar" } });
    else if (a === "scroll-left" || a === "scroll-right") this.pageBar(a === "scroll-right" ? 1 : -1);
    else return false;
    return true;
  }

  // A drop in the bar: `fromId` takes `toId`'s place in its group (moveInGroup), the registry rewritten.
  moveProject(fromId, toId) {
    const next = moveInGroup(registry(), fromId, toId, this.barOpen ?? (() => false), this.barShownIds ?? []);
    if (next) setShared("kt.projects", next);
  }

  // H / L and the bar's arrows: a page of squares (those shown, less one) to the left or right.
  // scroll_to_item moves only as much as needed: going right, the square a page past the last
  // shown comes to the right edge; going left, the one a page before the first, to the left edge.
  pageBar(dir) {
    const { n, shown } = this.barFit ?? {};
    if (!n || n <= shown) return;
    const page = Math.max(1, shown - 1);
    const first = Math.min(Math.round(this.barAt), n - shown);
    const to = dir > 0 ? Math.min(n - 1, first + shown - 1 + page) : Math.max(0, first - page);
    this.barScroll.scroll_to_item(to);
    this.barAt = dir > 0 ? Math.max(0, to - shown + 1) : to;
  }

  // `gone`: closing (rows() gave it -1), drawn as it was but no longer a target: no hover, click, menu
  // or cursor.
  row(t, r, cx, gone = false) {
    const { space: w, tab: c } = r;
    // The thread as this render sees it (threads-model.js): a closing card keeps the space and tab it
    // had (rows() hands it its last item), the rest is read now.
    const th = model.threadOf(w, c, this.world);
    const { lead, agent } = th;
    const st = this.status(t, c);
    // The branch's PR: /me:report's when it has one (the card's other facts come from it), else gh's
    // (this.pr asks gh again when it's due).
    const pr = th.prFrom === "report" ? th.pr : this.pr(lead?.cwd, lead?.branch, w.machine);
    // The shown thread, unless a page (Inbox, Skills, MCP, Worktrees) covers it.
    const here = w.active && c.active && !this.paged;
    const hovered = !gone && this.hover === c.id;
    // The keys' cursor, while the list has the keyboard: an accent border.
    const cursor = !gone && this.keyed && this.cur === c.id;
    const pinned = th.pinned;
    const asleep = th.asleep;
    const pj = th.repo;
    // Quiet rows recede: what needs you (or what you're on) stays bright.
    const recede = !here && !hovered && !cursor && c.status !== "blocked" && c.status !== "done";
    const mono = (color, text) => div().flex_none().font_family(MONO).text_size(11).text_color(color).child(text);
    // Compact: the row under the pointer or the keys' cursor opens as a detailed card (expanded()).
    const compact = this.compact && !this.expanded(c.id);
    const ago = age(c.settled ? c.settled_at : c.changed_at).toUpperCase();
    // The age, and a snoozed card's time left, roll once a minute in a short list (12 threads or fewer).
    const clockEl = (color, key, text) => (this.fewRows ? rollText(this.m, `kt-${key}-${c.id}`, text, 15).flex_none().font_family(MONO).text_size(11).text_color(color) : mono(color, text));
    const right = hovered
      ? c.settled
        ? this.button(`kt-un-${c.id}`, "Restaurer", "archive-restore", () => run("tab.unsettle", { id: c.id }))
        : asleep
          ? this.button(`kt-wake-${c.id}`, "Wake", "clock", () => this.snooze(c.id, null))
          : h_flex()
              .gap(2)
              .child(
                this.button(`kt-snooze-${c.id}`, "", "clock", () => {
                  this.snoozing = this.snoozing === c.id ? null : c.id;
                }),
              )
              .child(this.button(`kt-pin-${c.id}`, pinned ? "Unpin" : "", "pin", () => this.togglePin(c.id)))
              // Archive: tab.settle, the thread keeps running; Herdr brings it back when its agent needs you.
              .child(this.button(`kt-settle-${c.id}`, "", "archive", () => this.settle(w, c)).tooltip(tr("archive")))
      : asleep
        ? clockEl(t.working, "until", until(this.snoozed()[c.id].until).toUpperCase())
        // A detailed blocked card says it once, in its line 3 pill: up here only the ring.
        : c.status === "blocked" && !compact && !c.settled
          ? null
          // Compact: the status and how long since it changed (a working one's status says how long).
          : compact && st
            ? h_flex().flex_none().gap(8).items_center().child(st).when(c.status !== "working" && Boolean(ago), (el) => el.child(clockEl(t.dim, "age", ago)))
            : (st ?? clockEl(t.dim, "age", ago));
    const short = c.settled || asleep;
    const title = th.title;
    // Line 2: model · effort (statusline) · branch, else the project; its eyebrow only across projects.
    const sl = th.sl;
    const facts = [sl?.model, sl?.effort, lead?.branch || (!this.everyProject && pj.name)].filter(Boolean).join(" · ");
    const live = this.liveLine(t, c, lead);
    // What a blocked thread's agent waits on (decide.js): its pills at the end of line 3 (the keys'
    // cursor stops on each, pillStops), what it asks on line 4, whole in its tooltip.
    const d = c.status === "blocked" && !short ? this.decisions[agent?.terminal] : null;
    const ask = d?.pending ? [d.pending.title, d.pending.detail].filter(Boolean).join(" · ") : "";
    const pills = d ? decisionButtons(d, {
      cursor: pillKeys(d).find((k) => this.keyed && this.cur === `dec:${k}:${c.id}`) ?? null,
      onDone: (res, cx) => this.decided(res, c.id, cx),
    }) : null;
    const todos = agent?.terminal ? this.live[agent.terminal]?.todos : null;
    const report = th.report;
    const ci = this.ciMark(t, report);
    const focus = here && !compact && !short ? this.focusCard(t, { sl, todos, lead, agent, working: c.status === "working", report, c }) : null;
    // The context everywhere: a ring at the line's right end (16 px compact, 18 detailed).
    const ctxRing = sl?.ctx_pct != null && !short ? ring(t, `kt-ring-${c.id}`, sl.ctx_pct, compact ? 16 : 18) : null;
    // The program's tile, alive (companion-logo.js): its own icon, a bob while working, what it does in
    // a corner (herdr-bridge's action), "!" blocked, sparkles once done. 24×20, 20×16 compact. A click
    // hops it once; the card's own click still runs (it doesn't stop the event).
    const bridge = agent?.terminal ? this.live[agent.terminal] : null;
    const pet = companion({
      program: agent?.program, state: agent?.status ?? c.status, id: `kt-c-${c.id}`, cx,
      action: bridge?.state ? (bridge.action ?? null) : undefined, since: bridge?.state ? bridge.since : undefined,
      size: compact ? 20 : 24, height: compact ? 16 : 20, memo: (this.memos[agent?.terminal ?? c.id] ??= {}),
    });
    // Compact: one 36 px line (28 + the card's 4 px around it): tile, title, ring, status. The tile has
    // a column of its own down the card (Parcours' tree node): the other lines sit right of it, and with
    // sub-agents its trunk runs on from under the tile to their branches (through the padding and gap).
    const lineH = compact ? 28 : 20;
    const tileW = compact ? 20 : 24;
    const py = compact ? 0 : short ? 2 : 6;
    const subs = !short && !compact ? th.subagents.shown : [];
    // Lines 2 to 4 (and, below the card's content, the branches): a compact card opening (the pointer,
    // the keys' cursor) unfolds them on their height; detailed cards just have them.
    // Compact: given the builder, the lines fold back on their height when the card closes too.
    const unfold = (key, open, build) => (this.compact ? collapse(this.m, `${key}-${c.id}`, open, build, { cx }) : open ? build() : null);
    const more = unfold("kt-more", !short && !compact, () =>
      v_flex()
        .gap(4)
        .child(
          h_flex()
            .h(16)
            .gap(6)
            .items_center()
            .text_size(11)
            .text_color(t.muted)
            .when(this.everyProject, (el) =>
              el
                .child(div().size(6).rounded(2).flex_none().bg(spaceColor(t, pj.first)))
                // kbrdn.dev `.eyebrow`: the project.
                .child(div().flex_none().max_w(120).truncate().font_family(MONO).text_size(10.5).child(pj.name.toUpperCase())),
            )
            .child(div().flex_1().min_w(0).truncate().child(facts))
            .when(Boolean(pj.machine), (el) => el.child(div().flex_none().px(6).rounded_full().bg(t.raised).text_color(t.dim).child(pj.machine)))
            .when(Boolean(pr), (el) => el.child(this.badge(t, c, pr)))
            .when(Boolean(ci), (el) => el.child(ci)),
        )
        // Line 3: the last action (or "a besoin de toi"), the todos' count and the decision pills on the right.
        .when(Boolean(live) || todos?.total > 0 || Boolean(pills), (el) => el.child(
          h_flex().min_h(16).gap(8).items_center()
            .child(div().flex_1().min_w(0).when(Boolean(live), (el) => el.child(live)))
            .when(todos?.total > 0, (el) => el.child(div().flex_none().font_family(MONO).text_size(10.5).text_color(t.muted).child(`${todos.done}/${todos.total}`)))
            .when(Boolean(pills), (el) => el.child(pills)),
        ))
        .when(Boolean(ask), (el) => el.child(div().id(`kt-ask-${c.id}`).h(16).min_w(0).truncate().font_family(MONO).text_size(10.5)
          .text_color(t.muted).tooltip(ask).child(ask))));
    const twigs = unfold("kt-twigs", subs.length > 0, () => this.branches(t, subs, tileW / 2, c.id, agent, cx));
    const tile = v_flex().w(tileW).flex_none().self_stretch().relative()
      // Monocode's program tile, once: the agent's program, else what runs in the thread.
      .child(h_flex().h(lineH).items_center().child(pet))
      .when(subs.length > 0, (el) => el.child(div().absolute().top(lineH / 2 + 10).bottom(-(py + 4)).left(tileW / 2)
        .border_l(1).border_color(treeLine(t))));
    const lines = v_flex()
      .flex_1()
      .min_w(0)
      .gap(4)
      .child(
        h_flex()
          .h(lineH)
          .gap(8)
          .items_center()
          .child(div().flex_1().min_w(0).truncate().text_size(short || compact ? 13 : 13.5).font_medium().text_color(short ? t.muted : t.foreground).child(title))
          .when(pinned && !hovered, (el) => el.child(svg(I("pin")).size(12).flex_none().text_color(t.dim)))
          .when(compact && Boolean(ctxRing), (el) => el.child(ctxRing))
          .when(Boolean(right), (el) => el.child(right))
          .when(!compact && Boolean(ctxRing), (el) => el.child(ctxRing)),
      )
      .when(Boolean(more), (el) => el.child(more))
      .when(this.snoozing === c.id, (el) =>
        el.child(
          h_flex()
            .gap(4)
            .pt(4)
            .children(
              SNOOZE.map(([label, wake], i) =>
                this.button(`kt-sn-${c.id}-${i}`, label, null, () => {
                  this.snoozing = null;
                  this.snooze(c.id, wake());
                }),
              ),
            ),
        ),
      );
    const content = h_flex().flex_1().min_w(0).px(6).py(py).gap(8).child(tile).child(lines);
    // The card: radius 12, padding 10 (4 + the content's 6, so the gauges' inner card sits 4 in).
    const card = v_flex()
      .id(`kt-row-${c.id}`)
      .p(4)
      .gap(4)
      .rounded(12)
      // kbrdn.dev SegmentInk on the shown thread (transparent border elsewhere: no shift).
      .border(1)
      // The keys' cursor: a 1 px accent ring on the card, with the ink.
      .border_color(cursor ? alpha(t.accent, "99") : here ? t.accent + "66" : t.accent + "00")
      .when(here || cursor, (el) => el.bg(alpha(t.accent, "24")))
      .when(!gone && !here && !cursor, (el) => el.hover((s) => s.bg(t.hover)))
      .when(!gone, (el) => el.cursor_pointer()
        .on_hover((h, cx) => {
          if (h && this.peek) return; // the Usage peek drawn over the row: gpui hovers what's under it too
          if (h) this.hover = c.id;
          else if (this.hover === c.id) {
            this.hover = null;
            this.linger(c.id, cx);
          }
          if (!h && this.snoozing === c.id) this.snoozing = null;
          cx.notify();
        })
        .on_click(() => {
          show("thread");
          run("tab.select", { id: c.id });
        })
        .on_mouse_down("right", () =>
          // kt-menu: the shipped menu's clone whose closings go through kt-confirm, worktrees through gwm.
          openOverlay({ mod: "kt-menu", kind: "popup", width: 200, props: { tab: "tab", target: { id: c.id, space: w.id, settled: c.settled } } }),
        ))
      .child(content)
      .when(Boolean(twigs), (el) => el.child(twigs))
      .when(Boolean(focus), (el) => el.child(focus));
    return v_flex()
      .mx(8)
      .when(recede, (el) => el.opacity(0.62))
      .child(card);
  }

  // ---------- the Usage button's peek ----------

  // Shown once the pointer rests 300 ms on the button; gone 160 ms after it left both the button and
  // the panel (room to slide onto it), fading and sinking 6 px (motion.js sheet / leave). One-shot
  // timers, the last one wins (peekTok).
  peekHover(part, on, cx) {
    this.peekOver = { ...this.peekOver, [part]: on };
    const tok = (this.peekTok = (this.peekTok ?? 0) + 1);
    const id = `kt-peek-${this.peek}`;
    if (this.peekOver.btn || this.peekOver.panel) {
      if (part === "btn" && on) this.readPeek(cx);
      // Back while it goes: a new one at once (a new id, so it comes in again).
      if (this.peek && leaving(this.motion, id)) {
        this.peek = ++this.peekGen;
        cx.notify();
      } else if (!this.peek) cx.timer.after(300, (cx) => {
        if (this.peekTok !== tok) return;
        this.peek = ++this.peekGen;
        cx.notify();
      });
    } else if (this.peek) cx.timer.after(160, (cx) => {
      if (this.peekTok !== tok) return;
      leave(this.motion, cx, id, (cx) => {
        this.motion.out?.delete(id); // frame() never clears it
        if (`kt-peek-${this.peek}` === id) {
          this.peek = null;
          this.peekOver = {};
        }
        cx.notify();
      });
    });
  }

  // The statusLine's quota file as written, with its updated_at (readLive drops it): a local read on
  // hover-in, never the network.
  readPeek(cx) {
    if (checking()) return;
    cx.spawn(async (cx) => {
      try {
        const s = await readTextFile(`${io.statuslineDir(home())}/herdr-quota.json`);
        this.peekQuota = s ? JSON.parse(s) : null;
      } catch { /* torn mid-write: keep the last one */ }
      if (this.peek) cx.notify();
    });
  }

  // A click on the button or the panel: the console, and the peek gone at once (the dialog covers it).
  openUsage() {
    this.peekTok = (this.peekTok ?? 0) + 1;
    this.peek = null;
    this.peekOver = {};
    run("mod.open", { name: "kt-usage" });
  }

  // The peek, 220 px, over the bottom of the sidebar: kt-usage's last full read as it publishes it
  // (shared "kt.usage.summary": the weekly window, Fable, today's cost, Codex) and the statusLine's
  // weekly window, the newer of the two for the week. Read only: no network, nothing of kt-usage's
  // token. A window whose reset passed since its reading shows no number (kt-usage's data.js rule).
  usagePeek(t, m) {
    const now = Date.now() / 1000;
    const q = this.peekQuota;
    const s = shared("kt.usage.summary");
    const sc = s?.claude;
    const qw = Number.isFinite(q?.seven_day?.used_percentage) ? { used: q.seven_day.used_percentage, resets: q.seven_day.resets_at } : null;
    const fromSum = Boolean(sc?.week) && (s.at ?? 0) >= (q?.updated_at ?? 0);
    const week = fromSum ? sc.week : qw;
    const live = (w) => Boolean(w) && Number.isFinite(w.used) && !(w.resets <= now);
    const fable = sc?.fable && sc.fable.active !== false && live(sc.fable) ? sc.fable : null;
    const day = sc?.day && (s.at ?? 0) >= new Date().setHours(0, 0, 0, 0) / 1000 ? sc.day : null;
    const codex = s?.codex ?? null;
    // How old what's shown is: its oldest source.
    const ats = [week && !fromSum ? q?.updated_at : null, fromSum || fable || day || codex ? s?.at : null].filter(Number.isFinite);
    const age = ats.length ? relative(Math.min(...ats) * 1000) : "";

    const eyebrow = (text) => div().flex_none().font_family(MONO).text_size(10).text_color(t.muted).child(text);
    const dim = (text) => div().min_w(0).truncate().font_family(MONO).text_size(10).text_color(t.dim).child(text);
    // The agent's logo, as kt-usage's tile() has it: its program's icon while one runs, else Herdr's for the key.
    const logo = (key) => {
      const p = panes().find((x) => x.program?.key === key)?.program ?? { icon: `icons/${key}.svg`, tint: false };
      return p.tint ? svg(p.icon).size(12).flex_none().text_color(t.foreground) : image(p.icon).size(12).flex_none();
    };
    // The focus card's 32 px ring (levels.js' quota colours), its label and detail beside it.
    const cell = (id, label, w, sub) => h_flex().gap(8).items_center()
      .child(ring(t, id, w.used, 32, { kind: "quota", severity: w.severity, roll, m }))
      .child(v_flex().min_w(0).gap(1).child(eyebrow(label)).child(dim(sub)));
    const claude = [];
    if (week) claude.push(live(week) ? cell("kt-peek-7j", tr("week"), week, resetWords(week.resets)) : dim(`${tr("week")} · ${tr("peek.stale")}`));
    if (fable) claude.push(cell("kt-peek-fable", (fable.name ?? "Fable").toUpperCase(), fable, sc.share // i18n: tech
      ? tr("peek.share", { used: Math.round(sc.share.used), of: Math.round(sc.share.of) }) : resetWords(fable.resets)));
    if (day) claude.push(h_flex().gap(8).items_center()
      .child(div().flex_1().min_w(0).truncate().text_size(11).text_color(t.muted).child(tr("peek.dayCost")))
      .child(div().flex_none().font_family(MONO).text_size(11).text_color(t.foreground).child(`$${fnum(day.usd, 2)}`)));
    const cw = codex ? [["5H", codex.five], [tr("week"), codex.week]].filter(([, w]) => live(w)) : []; // i18n: tech
    const parts = [
      claude.length > 0 && v_flex().gap(8)
        .child(h_flex().gap(6).items_center()
          .child(logo("claude"))
          .child(eyebrow("CLAUDE")) // i18n: tech
          .child(div().flex_1())
          .when(Boolean(sc?.plan), (el) => el.child(dim(sc.plan))))
        .children(claude),
      codex && h_flex().gap(8).items_center()
        .child(h_flex().gap(6).items_center().child(logo("codex")).child(eyebrow("CODEX"))) // i18n: tech
        .child(div().flex_1())
        .children(cw.length ? cw.map(([label, w]) => div().flex_none().font_family(MONO).text_size(10.5)
          .text_color(levelColor(t, quotaLevel(w.used))).child(tr("peek.pct", { label, n: Math.round(w.used) }))) : [dim(codex.five || codex.week ? tr("peek.stale") : "—")]),
    ].filter(Boolean);
    const body = parts.length > 0 && v_flex().p(10).gap(8).rounded(10).bg(t.surface).border(1).border_color(t.border)
      .children(parts.flatMap((p, i) => (i ? [div().h(0).border_t(1).border_dashed().border_color(t.border), p] : [p])));
    const foot = h_flex().px(8).py(4).gap(8).items_center()
      .child(div().flex_1().min_w(0).truncate().text_size(10.5).text_color(t.dim).child(tr(body ? "peek.open" : "peek.none")))
      .when(Boolean(body && age), (el) => el.child(div().flex_none().font_family(MONO).text_size(10).text_color(t.dim).child(tr("peek.read", { ago: age }))));

    // In: a fade and a 6 px rise once laid out (its first on_size_change); out: leave() in peekHover.
    // Each showing has its own id, so it comes in again.
    const gen = this.peek;
    const id = `kt-peek-${gen}`;
    const sh = sheet(m, id, m.reduced || this.peekShown === gen);
    const card = v_flex().id(id).p(4).gap(4).rounded(14).bg(t.popover).border(1).border_color(t.border).shadow_lg().cursor_pointer()
      .on_size_change((_size, cx) => {
        if (this.peekShown === gen) return;
        this.peekShown = gen;
        cx.notify();
      })
      .on_hover((h, cx) => this.peekHover("panel", h, cx))
      // Presses stop here: the rows under it open their menu on a right-click, the project bar drags.
      .on_mouse_down("left", (_e, cx) => cx.stop_propagation())
      .on_mouse_down("right", (_e, cx) => cx.stop_propagation())
      .on_click((_e, cx) => {
        cx.stop_propagation();
        this.openUsage();
        cx.notify();
      })
      .when(Boolean(body), (el) => el.child(body))
      .child(foot);
    // Out of the flow, 4 px over the footer (40): nothing above it moves.
    return div().absolute().bottom(44).left(8).w(Math.min(220, this.width - 16)).child(sh.card(sh.veil(card)));
  }

  // kbrdn.dev `.eyebrow` shelf header.
  section(id, label, open, onClick, cursor = false) {
    const t = this.t;
    return h_flex()
      .id(id)
      .mx(cursor ? 8 : 18)
      .when(cursor, (el) => el.px(9).py(3).rounded(12).border(1).border_color(alpha(t.accent, "99")).bg(alpha(t.accent, "24")))
      .mt(10)
      .mb(4)
      .gap(8)
      .items_center()
      .font_family(MONO)
      .text_size(11)
      .text_color(cursor ? t.foreground : t.muted)
      .cursor_pointer()
      .hover((s) => s.text_color(t.foreground))
      .on_click(onClick)
      .child(label.toUpperCase())
      .child(div().flex_1().h(1).bg(t.border))
      .child(svg(I(open ? "chevron-down" : "chevron-right")).size(13));
  }

  // panel.js: the whole sidebar glides in and out with its column (#73).
  render(cx) {
    tilesFrame(this.tiles, cx);
    return columnIn("side", this.motion, this.draw(cx));
  }

  draw(cx) {
    this.findRepos(cx);
    this.followGlass(cx);
    const t = (this.t = theme());
    // Motion (ANIMATIONS.md): a compact card unfolding, sub-agents entering their branch, a status
    // coming in, the navigation's ink gliding. Nothing loops but an active state's.
    const m = (this.m = frame(this.motion, Boolean(shared("kt.reducedMotion"))));
    const fx = (el, key) => enter(m, el, key, { dy: 0 }); // the footer buttons' face, faded in on a change
    this.ticks = 0;
    this.shownClocks = this.clocks();
    const all = panes();
    const ps = spaces();
    // The bus (DATA-SYNC.md). kt-threads is the central `agent:<space>` emitter: an agent leaving
    // `working` (idle, done, blocked) may have changed its repo without Herdr knowing. Once per real
    // transition, never on an agent's first sight; bumped after the render (setShared re-renders all).
    const ended = new Set();
    for (const p of all) {
      if (!p.terminal || !p.program?.agent) continue;
      const was = this.statusOf[p.terminal];
      this.statusOf[p.terminal] = p.status;
      const space = was === "working" && p.status !== "working" ? ps.find((s) => s.tabs.some((x) => x.id === p.tab)) : null;
      if (space) ended.add(`agent:${space.id}`);
    }
    if (ended.size && !checking()) cx.spawn(async () => bump(...ended, "agents"));
    // What others change: a commit, a branch, a PR made elsewhere (or by an agent that just stopped)
    // asks the PR badges again; a worktree made or removed, the project's count; the quota, the rings.
    refreshOn(this, cx, "prs", ["git", "gh", "agents"], async (cx) => { this.asked = {}; cx.notify(); });
    // Stale, not gone: the badge keeps its count while it is read again (DATA-SYNC.md, no skeleton flash).
    refreshOn(this, cx, "worktrees", ["gwm", "git"], async (cx) => { if (this.wt) this.wt.at = 0; cx.notify(); });
    refreshOn(this, cx, "usage", ["usage"], async (cx) => this.readLive(cx));
    // The project filter (shared "kt.project"): "*" lists every project; anything else
    // follows the shown space, with its repo's worktree spaces.
    const everyProject = (this.everyProject = shared("kt.project") === "*");
    const compact = (this.compact = shared("kt.density") === "compact");
    const shown = ps.find((w) => w.active);
    // The threads (threads-model.js, read as of now: row() reads this world too) of the shown
    // project, or of every one.
    const now = Date.now();
    const world = (this.world = {
      ...this.places(), spaces: ps, panes: all, now, registry: registry(), colors: shared("space.colors") ?? {},
      live: this.live, reports: this.reports, prs: this.prs, defaults: this.defaults,
      snoozed: this.snoozed(), pins: this.pins(), firstSeen: shared("kt.firstSeen") ?? {}, dark: Boolean(settings().dark),
    });
    const rows = model.scoped(model.threadsOf(world), everyProject ? null : shown, this.repos);
    const page = find(layout(), VIEW)?.active ?? "thread";
    // The page the navigation marks: the one shown, or `nav-page:`'s (tests).
    const navPage = this.navTest ?? page;
    const inboxOn = navPage === "inbox";
    this.paged = page !== "thread";
    const worktrees = this.worktreeCount(shown, cx);
    // The filter (kt-thread-filter, shared "kt.threadFilter"): the archived view or the active one,
    // then status, period (by activity) and program; none set lets everything through.
    const filter = filterOf(shared("kt.threadFilter"));
    const kept = model.filtered(rows, filter, now);
    // A short list (ANIMATIONS.md: not past 12 rows): its cards' ages, durations and +N roll; longer, they stay still.
    this.fewRows = kept.length <= 12;
    const pins = this.pins();
    // The pinned, the others awake, the snoozed; or, archived (tab.settle), dated by when they were put away.
    const { pinned, active, snoozed, archived } = model.sections(kept, filter, pins);
    // Monocode's date groups, newest thread first inside each (a group never reshuffles on activity).
    const dated = (list) => model.datedGroups(list, now).map(([id, l]) => [tr(`date.${id}`), l]);
    // Grouped by project (the default; "Grouper par" in the filter menu, shared "kt.threadFilter"
    // group): one group per project (Home its own), the pinned on top of theirs, then what needs you,
    // done, working, idle (byNeed); Home first, then the projects a thread of which needs you, then the
    // registry's order (byProject). Grouped by date: the pinned on their shelf, then the date groups.
    const byDate = filter.group === "date";
    const listed = byDate ? dated(filter.archived ? archived : active) : [];
    const projects = byDate ? [] : model.projectGroups(filter.archived ? archived : [...pinned, ...active], pins, world.registry);
    const shelf = byDate ? model.sortByNeed(pinned, pins) : [];
    // One project shown ("Projet actif"): its header would only repeat the selector above.
    const heads = projects.length > 1 || everyProject;
    if (!heads) for (const g of projects) this.folded.delete(g.key); // no header to unfold it from
    // What the keys' cursor walks: the navigation lines on top (the shown project, New thread, the
    // pages, Search; enter runs their click), then the rows in the order shown (a project's header a
    // stop too: h / l fold and unfold it), the snoozed shelf's header too.
    this.keyed = this.handle.is_focused();
    // The Agents group (Skills, MCP, Plugins): open as last left (shared "kt.nav.agents"), and always
    // while one of its pages shows. Its pages are cursor stops only while it is open.
    const stack = find(layout(), VIEW)?.children ?? [];
    const agentPages = AGENT_PAGES.filter((p) => stack.some((c) => c.id === p));
    // Notes (kt-notes: the project's and its gwm worktrees' notes), under Worktrees, once the stack has it.
    const hasNotes = (this.hasNotes = stack.some((c) => c.id === "notes"));
    // Kanban (kt-kanban: the threads as a board by status), under Inbox, once the stack has it.
    const hasKanban = (this.hasKanban = stack.some((c) => c.id === "kanban"));
    // Accueil (kt-hub) has no line here, at Kylian's ask: its button beside « @kbrdn1 » (kt-head), ctrl-b shift-h, Search.
    const agentsOpen = (this.agentsOpen = Boolean(shared("kt.nav.agents")) || agentPages.includes(navPage));
    this.nav = {
      "kt-project": () => this.openProjects(),
      "kt-new": () => { show("thread"); run("mod.open", { name: "kt-new" }); },
      "kt-inbox": () => show("inbox"),
      ...(hasKanban ? { "kt-kanban": () => show("kanban") } : {}),
      "kt-agents": () => setShared("kt.nav.agents", true),
      ...(agentsOpen ? Object.fromEntries(agentPages.map((p) => [`kt-${p}`, () => show(p)])) : {}),
      "kt-gwm": () => show("gwm"),
      ...(hasNotes ? { "kt-notes": () => show("notes") } : {}),
      "kt-search": () => run("mod.open", { name: "kt-picker" }),
    };
    // A thread's line, then its decision pills' (pillStops).
    const stop = (r, group, fold) => [{ id: r.tab.id, group, fold, r }, ...this.pillStops(r, group, fold), ...this.twigStop(r, group, fold)];
    this.flat = [
      ...Object.keys(this.nav).map((id) => ({ id, group: "nav", r: null, navChild: AGENT_PAGES.includes(id.slice(3)) })),
      ...shelf.flatMap((r) => stop(r, "pinned")),
      ...listed.flatMap(([name, list]) => list.flatMap((r) => stop(r, name))),
      ...projects.flatMap((g) => [
        ...(heads ? [{ id: `grp:${g.key}`, group: g.key, fold: g.key, head: true, r: null }] : []),
        ...(this.folded.has(g.key) ? [] : g.threads.flatMap((r) => stop(r, g.key, g.key))),
      ]),
      ...(snoozed.length ? [{ id: "snoozed", group: "snoozed", r: null }] : []),
      ...(this.showSnoozed ? snoozed.map((r) => ({ id: r.tab.id, group: "snoozed", r })) : []),
    ];
    // The thread the cursor is in (on its line or one of its pills): its card opens and comes into view.
    this.curThread = this.flat.find((x) => x.id === this.cur)?.r?.tab.id ?? null;
    // The list's children, the cursor's brought into view once after it moved.
    const items = [];
    const put = (id, el) => {
      if (this.reveal && (id === this.cur || id === this.curThread)) {
        this.listScroll.scroll_to_item(items.length);
        this.reveal = false;
      }
      items.push(el);
    };
    if (filter.archived) items.push(h_flex().id("kt-archived").mx(18).mt(2).mb(2).gap(8).items_center()
      .font_family(MONO).text_size(10.5).text_color(t.muted)
      .child(svg(I("archive")).size(12).flex_none())
      .child(div().flex_1().child(tr("archived", { n: archived.length })))
      .child(div().id("kt-archived-back").px(6).rounded(6).cursor_pointer().hover((s) => s.bg(t.hover).text_color(t.foreground))
        .on_click((_e, cx) => { setShared("kt.threadFilter", { ...filter, archived: false }); cx.notify(); })
        .child(tr("active"))));
    // A group's threads open and close on their height, in order (motion.js rows(), keyed by tab; a
    // group past 12 at once; folded or closed: none, so they close). A card at rest follows its content
    // (its compact unfold, its sub-agents). rows() builds the cards in the order it returns them:
    // `built` says each child's thread for put()'s reveal (a closing card: none). A group gone whole
    // (its header too) goes at once.
    const group = (gid, rs) => {
      const built = [];
      const kids = motionRows(this.m, cx, `kt-th-${gid}`, rs, (r) => r.tab.id, (r, i) => {
        built.push(i < 0 ? null : r.tab.id);
        return this.row(t, r, cx, i < 0);
      });
      kids.forEach((el, j) => (built[j] ? put(built[j], el) : items.push(el)));
    };
    group("shelf", shelf);
    if (shelf.length > 0) items.push(div().mx(18).my(6).h(1).bg(t.border));
    for (const [name, list] of listed) {
      items.push(div().mx(18).mt(8).mb(2).text_size(12).text_color(t.dim).child(name));
      group(`d-${name}`, list);
    }
    projects.forEach((g, i) => {
      if (heads) put(`grp:${g.key}`, this.groupHead(t, g, i));
      group(`p-${g.key}`, this.folded.has(g.key) ? [] : g.threads);
    });
    if (!pinned.length && !listed.length && !projects.length && !snoozed.length) items.push(div().mx(18).mt(10).text_size(12.5).text_color(t.dim)
      .child(filter.archived ? tr("noArchived") : filtering(filter) ? tr("noFilter") : tr("none")));
    // i18n: tech (Snoozed: Monocode's word)
    if (snoozed.length > 0) put("snoozed", this.section("kt-snoozed", `Snoozed (${snoozed.length})`, this.showSnoozed, (_e, cx) => {
      this.showSnoozed = !this.showSnoozed;
      cx.notify();
    }, this.keyed && this.cur === "snoozed"));
    if (snoozed.length > 0) group("snoozed", this.showSnoozed ? snoozed : []);
    items.push(div().h(12));

    // Monocode's 32 px navigation lines; `on`: the page shown, under the kbrdn.dev ink, one layer gliding
    // from line to line (navInk). The keys' cursor on one: a 1 px accent ring and the ink, in place.
    const navCur = (id) => this.keyed && this.cur === id;
    // The Agents group as a tree, drawn as the sub-agents' (twig): the trunk leaves from under the group's
    // icon (`trunk`), each page hangs on a branch (`branch`: its twig column, before its icon), the shown
    // page's in the accent. 32 px lines, the navigation's rhythm (the sub-agents' 40 px would break it).
    const NAV_X = 7; // the trunk under the 15 px icons' middle
    const NAV_BOX = 8 + 11 + 2 * NAV_X; // where a page's box starts: its line's margin, padding, branch
    const navRest = treeLine(t);
    // The line's box (its border, the cursor's ring, the hover fill), from `id`: a page of the group has
    // its branch outside the box, which starts where the bend ends (NAV_BOX), so nothing covers the tree.
    const box = (id, on, el) => el
      .id(id)
      .h(32)
      .px(10)
      .gap(10)
      .items_center()
      .rounded(12)
      .border(1)
      .border_color(navCur(id) ? alpha(t.accent, "99") : t.accent + "00")
      .when(navCur(id), (el) => el.bg(alpha(t.accent, "24")))
      .text_size(13)
      .text_color(on || navCur(id) ? t.foreground : t.muted)
      .cursor_pointer()
      .when(!on && !navCur(id), (el) => el.hover((s) => s.bg(t.hover).text_color(t.foreground)));
    // Each line's key (shortcuts.js, #72), from the line itself: its page's `layout.select:<id less "kt-">`, else
    // the mod it opens (`mod.open:<id>`), so a new line shows its key once keys.json binds it. Search says its own.
    const NAV_KEYS = { "kt-search": ["kt-head.picker:0", "mod.open:kt-picker"] };
    const binds = keys();
    const navKey = (id) => shortcut(binds, shared("layout"), NAV_KEYS[id] ?? [`layout.select:${id.replace(/^kt-/, "")}`, `mod.open:${id}`]);
    const tool = (id, icon, label, onClick, right, on = false, { trunk = false, branch = null } = {}) => {
      const body = (el) => el
        // The group's icon over its trunk: from under the icon down through the line's border.
        .child(trunk
          ? div().w(15).h_full().flex_none().relative().flex().items_center()
            .child(svg(I(icon)).size(15))
            .child(div().absolute().top(23).bottom(-1).left(NAV_X).border_l(1).border_color(navRest))
          : svg(I(icon)).size(15))
        .child(div().flex_1().min_w(0).truncate().child(label))
        .when(Boolean(right), (el) => el.child(right))
        .child(kbd(t, navKey(id)));
      if (!branch) return body(box(id, on, h_flex().mx(8)).on_click(onClick));
      // A page of the group: its branch where the group's icon is (8 + its line's border and padding, 11),
      // then its box from the bend's end.
      return h_flex().id(`${id}-line`).mx(8).pl(11).h(32).items_center()
        .child(branch)
        .child(body(box(id, on, h_flex().flex_1().min_w(0)).on_click(onClick)));
    };

    // The ink under the page's line, the lines counted as drawn (the Agents pages only while the group
    // is open): it glides to the next page's, and fades out on the thread (no page), staying where it was.
    const navRows = ["new", "inbox", ...(this.hasKanban ? ["kanban"] : []), "agents", ...(agentsOpen ? agentPages : []), "gwm", ...(this.hasNotes ? ["notes"] : []), "search"];
    const navAt = navPage === "thread" ? -1 : navRows.indexOf(navPage);
    if (navAt >= 0) this.navAt = navAt;
    // Under a page of the Agents group it starts where that page's box does, after its branch's bend.
    if (navAt >= 0) this.navLeft = agentPages.includes(navPage) ? NAV_BOX : 8;
    const navInk = ink(m, fade(m, div().id("kt-nav-ink").absolute().left(this.navLeft ?? 8).right(8).top((this.navAt ?? 1) * 32).h(32)
      .rounded(12).border(1).border_color(t.accent + "66").bg(alpha(t.accent, "24")), navAt >= 0));
    // The Agents group: its line folds and unfolds it (a plain chevron: gpui turns nothing), its pages
    // unfold on their height (collapse), each on its branch, left of its box.
    const branchOf = (p) => ({ branch: twig(t, { h: 32, x: NAV_X, last: p === agentPages.at(-1),
      color: navPage === p ? alpha(t.accent, "99") : navRest, rest: navRest }) });
    const agentsFold = collapse(m, "kt-agents-fold", agentsOpen, () => v_flex().children(agentPages.map((p) =>
      tool(`kt-${p}`, AGENT_PAGE[p][0], pageName(p), () => show(p), null, navPage === p, branchOf(p)))), { cx });
    const bar = this.projectBar(t, ps);
    // The halo (halo.js), in the shown project's color, softer than the headers' (a large surface),
    // published for kt-head's brand block above, which draws its top: here it starts that block's height
    // higher, so the dither runs on across both. Cut on the right by a narrow sidebar, where it has
    // already died out. No background of its own (the side column's): it would band the brand block.
    const halo = alpha(this.haloColor(t, shown), settings().dark ? "4d" : "33");
    if (halo !== shared(HALO) && !checking()) cx.spawn(async () => setShared(HALO, halo));
    const brandH = find(layout(), "brand")?.size?.px ?? 0;
    return v_flex()
      .id("kt-root")
      .relative()
      .overflow_hidden()
      .size_full()
      .children(shared("kt.opt.kt-threads.halo") === false ? [] : haloLayers(m, (this.haloMemo ??= {}), halo, -brandH))
      .text_color(t.foreground)
      // No frame of its own when it has the keyboard: the focus shows on the element under the cursor.
      .track_focus(this.handle)
      .on_key_down((e, cx) => this.key(e, cx))
      // Its width and the window's height (the brand block, 62, above it): the project picker's room.
      .on_size_change((size) => {
        this.width = size.width;
        this.winH = size.height + 62;
      })
      .pt(4)
      // The shown project; a click opens its picker under it, floating (openProjects).
      .child(
        h_flex()
          .id("kt-project")
          .mx(8)
          .px(10)
          .h(36)
          .gap(9)
          .items_center()
          .rounded(12)
          .border(1)
          .border_color(navCur("kt-project") ? alpha(t.accent, "99") : alpha(t.accent, "00"))
          .when(navCur("kt-project"), (el) => el.bg(alpha(t.accent, "24")))
          .cursor_pointer()
          .hover((s) => s.bg(t.hover))
          // Where the picker goes: 4 px under the selector (its top-left from the press).
          .on_mouse_down("left", (e) => {
            if (e.local_position) this.projAt = { x: e.position.x - e.local_position.x, y: e.position.y - e.local_position.y + (e.bounds?.height ?? 36) + 4 };
          })
          .on_click(() => this.openProjects())
          .child(((logo) => shown && this.isHome(shown)
            ? svg(I("house")).size(14).flex_none().text_color(t.accent)
            // The project's registry logo when it has one, as in the bar below; else its letter tile (the
            // group headers' mark: its initial on the logos' dithered background of its colour, projtile.js).
            : logo ? image(logo).size(16).flex_none()
            : shown ? projTile(this.tiles, { color: paint(t, this.entryOf(shown, registry())?.color) ?? spaceColor(t, shown), size: 16,
              letter: div().text_size(9.5).font_semibold().text_color(LETTER).child([...shown.name][0]?.toUpperCase() ?? "?") })
            : div().size(10).rounded(3).flex_none().bg(t.dim))(shown && !this.isHome(shown) ? logoOf(this.entryOf(shown, registry())) : null))
          .child(div().min_w(0).truncate().text_size(14).font_medium().child(shown ? (this.isHome(shown) ? this.homeLabel(shown) : shown.name) : tr("noProject")))
          .child(svg(I("chevron-down")).size(14).flex_none().text_color(t.muted))
          .child(div().flex_1())
          .when(Boolean(shown?.branch), (el) => el.child(div().flex_none().max_w(110).truncate().font_family(MONO).text_size(10.5).text_color(t.dim).child(shown.branch))),
      )
      .child(v_flex().relative()
        .child(navInk)
        .child(
          tool("kt-new", "square-pen", tr("newThread"), () => {
            show("thread");
            run("mod.open", { name: "kt-new" });
          }),
        )
        .child(tool("kt-inbox", "layers", "Inbox", () => show("inbox"), inboxOn ? null : div().size(6).rounded(3).bg(t.accent), inboxOn))
        .when(this.hasKanban, (el) => el.child(tool("kt-kanban", "square-kanban", "Kanban", () => show("kanban"), null, navPage === "kanban"))) // i18n: tech
        .child(tool("kt-agents", "bot", "Agents", () => setShared("kt.nav.agents", !shared("kt.nav.agents")),
          svg(I(agentsOpen ? "chevron-down" : "chevron-right")).size(13).flex_none().text_color(t.dim), false, { trunk: agentsOpen }))
        .when(Boolean(agentsFold), (el) => el.child(agentsFold))
        // Still counted: the badge's pill as a bar (skeleton.js), breathing; none to count: no badge.
        .child(tool("kt-gwm", "git-branch", "Worktrees", () => show("gwm"), worktrees === undefined ? ((S) => S.pulse(S.block(30, 18, { r: 9 }).id("kt-nav-gwm-sk")))(skeleton(t, m))
          : worktrees == null ? null
          : div().flex_none().h(18).px(7).flex().items_center().rounded_full().border(1).border_color(t.border)
            .font_family(MONO).text_size(10.5).text_color(navPage === "gwm" ? t.foreground : t.muted).child(roll(m, "kt-nav-gwm-n", String(worktrees), 14)), navPage === "gwm"))
        // file-text until kt-notes gives its own icon.
        .when(this.hasNotes, (el) => el.child(tool("kt-notes", "file-text", "Notes", () => show("notes"), null, navPage === "notes")))
        .child(tool("kt-search", "search", tr("search"), () => run("mod.open", { name: "kt-picker" }))))
      // kbrdn.dev `.eyebrow` over the list, and the filter as a `.segment` pill.
      .child(
        h_flex()
          .mx(18)
          .mt(8)
          .gap(8)
          .items_center()
          // vim's mode beside it while the list has the keyboard (ctrl-b h).
          .child(div().flex_none().font_family(MONO).text_size(10.5).text_color(t.muted).child("THREADS")) // i18n: tech
          .when(this.keyed, (el) => el.child(div().flex_none().h(16).px(6).flex().items_center().rounded(5).border(1)
            .border_color(t.border).bg(t.background).font_family(MONO).text_size(9).text_color(t.muted).child(this.vim.label)))
          // The cards' density: the icon shows the current one.
          .child(
            div()
              .id("kt-density")
              .flex_none()
              .p(3)
              .rounded(6)
              .text_color(t.dim)
              .cursor_pointer()
              .hover((s) => s.bg(t.hover).text_color(t.foreground))
              .tooltip(compact ? tr("compact") : tr("detailed"))
              .on_click((_e, cx) => {
                this.toggleDensity();
                cx.notify();
              })
              .child(svg(I(compact ? "list" : "layout-list")).size(13)),
          )
          .child(div().flex_1().h(1).bg(t.border))
          .child(
            // Every project or the shown one: a 24 px square, the accent and its ink when on.
            h_flex()
              .id("kt-every")
              .size(24)
              .flex_none()
              .items_center()
              .justify_center()
              .rounded(8)
              .when(everyProject, (el) => el.bg(t.accent))
              .text_color(everyProject ? t.accent_foreground : t.muted)
              .cursor_pointer()
              .when(!everyProject, (el) => el.hover((s) => s.bg(t.hover).text_color(t.foreground)))
              .tooltip(everyProject ? tr("everyProject") : tr("activeProject"))
              .on_click((_e, cx) => {
                setShared("kt.project", everyProject ? null : "*");
                cx.notify();
              })
              .child(svg(I("layers")).size(14)),
          )
          // The filters (kt-thread-filter, a popup at the pointer): accent once any is set.
          .child(
            h_flex()
              .id("kt-filter")
              .size(24)
              .flex_none()
              .items_center()
              .justify_center()
              .rounded(8)
              .when(filtering(filter), (el) => el.bg(t.accent))
              .text_color(filtering(filter) ? t.accent_foreground : t.muted)
              .cursor_pointer()
              .when(!filtering(filter), (el) => el.hover((s) => s.bg(t.hover).text_color(t.foreground)))
              .tooltip(tr("filters"))
              .on_click((_e, cx) => {
                const programs = new Set(all.filter((p) => p.program?.agent).map((p) => p.program.key)).size;
                openOverlay({ mod: "kt-thread-filter", kind: "popup", at: "pointer", frame: "none", width: 240,
                  // Its rows: Archivés 32, GROUPER PAR (eyebrow ~27, two 32 lines), STATUT and PÉRIODE
                  // (eyebrow, one 26 + 2 row each), rules 9, padding and border 10, 4 at the end: ~274.
                  // PROGRAMME, when an agent runs: a rule, an eyebrow, one row, ~64.
                  height: 280 + (programs ? 64 : 0) });
                cx.notify();
              })
              .child(svg(I("list-filter")).size(14)),
          ),
      )
      .child(
        v_flex()
          .id("kt-list")
          .flex_1()
          .min_h(0)
          .overflow_y_scrollbar()
          .track_scroll(this.listScroll)
          .pt(6)
          .gap(4)
          // The archived view says so, with the way back (in `items`, built above).
          .children(items),
      )
      .when(Boolean(bar), (el) => el.child(bar))
      .child(
        h_flex()
          .h(40)
          .px(14)
          .gap(4)
          .items_center()
          .child(this.button("kt-settings", "", "settings", () => run("app.settings")))
          .child(this.button("kt-keys", "", "keyboard", () => run("mod.open", { name: "kt-keys" }))) // the layout's help (ctrl-b ?)
          .child(this.button("kt-layout", "", "layers", () => run("layout.switch")))
          // kt-usage's console (its own icon: button() takes its icons from this folder, so as the label).
          // Its hover shows the peek (usagePeek) in place of a tooltip: the two would show together.
          .child(this.button("kt-usage", svg("mods/kt-usage/gauge.svg").size(13), "", () => this.openUsage())
            .accessibility_label(tr("usage")).on_hover((h, cx) => this.peekHover("btn", h, cx)))
          // kt-mods' console: blocks shown or hidden, root mods, kbrdn options, shared copies.
          .child(this.button("kt-mods", svg("mods/kt-mods/blocks.svg").size(13), "", () => run("mod.open", { name: "kt-mods" })).tooltip("Mods")) // i18n: tech
          // Machines (#64, moved here from the navigation at Kylian's ask): kt-machines, the other machines'
          // state, their logins, adding one. Its badge: the dot of the one that needs you most (login, away,
          // loading), none without another machine. Its tooltip says its key when keys.json binds one.
          .child(((ms) => this.button("kt-machines", div().relative().child(svg(I("server")).size(13))
            .when(ms.length > 0, (el) => el.child(div().absolute().top(-2).right(-3).size(6).rounded_full().border(1).border_color(t.chrome)
              .bg(stateColor(t, ["login", "away", "loading"].find((st) => ms.some((x) => x.status === st)) ?? "ready")))),
          "", () => run("mod.open", { name: "kt-machines" }))
            .tooltip(tip(tr("machines"), shortcut(keys(), shared("layout"), "mod.open:kt-machines"))))(machineList()))
          .child(div().flex_1())
          // Language and theme (i18n.js' cycleButton): one button each, the state now, a click to the
          // next; the face fades in on a change (enter, keyed by the state).
          .child(langSwitch(t, fx))
          .child(((mode) => cycleButton(t, { id: "kt-theme", key: mode, icon: I(THEME_ICON[mode]), tip: tr(`theme.${mode}`), fx,
            onClick: (cx) => this.setTheme(THEME_NEXT[mode], cx) }))(this.themeMode())),
      )
      // The Usage peek, last: drawn over the list and the project bar, which keep their place.
      .when(Boolean(this.peek) && this.width >= 216, (el) => el.child(this.usagePeek(t, m)));
  }
}
