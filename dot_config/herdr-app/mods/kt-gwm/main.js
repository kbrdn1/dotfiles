// kbrdn Threads' Worktrees (gwm): the git worktrees of the project at hand, from gwm's daemon.
// One mod, two views (props.view):
// - "page" (default): the "gwm" child of kbrdn-threads' main "view" stack, opened from
//   kt-threads' Worktrees entry. Every worktree of the shown space's repo as a card: main or
//   linked, name, branch; dirty, ahead/behind, the linked issue and PR with their live state
//   (`gwm status`, cached 10 min), the agent sessions gwm detected (a tile per agent, pin, active
//   dot), the note. An issue or PR opens in kt-inbox (shared "kt.inbox.open", then the "inbox"
//   page); only the GitHub icon beside it opens the browser. The thread on screen's worktree
//   carries the ink. Hovering a card shows its actions: open as a space, the issue or PR (in the
//   Inbox), copy the path, sync, remove. Sync and remove
//   ask first through kt-confirm, which calls back `kt-gwm.confirmed`; remove is refused on a
//   dirty worktree, an active agent or a Herdr terminal in it, and never forced. On Home, outside
//   git or with "Global": every repo of the projects registry (shared "kt.projects"), grouped.
//   / then typing filters (the page takes the keyboard while it shows). Under it, a state row
//   (filters.js, FILTERS.md): Tous, Modifiés, PR ouverte, PR mergée, Agent actif.
//   Selection (select.js, page only): ⌘-click toggles a card, ⇧-click selects from the anchor, the
//   box left of its name (on hover, or once one is selected) toggles it; a plain click empties it.
//   While cards are selected, a bar floats at the list's foot: open them as spaces, copy their
//   paths (one a line), sync, remove, ✕ to empty; a running sync or remove shows its progress there
//   (viz.js' dithered bar). Sync and remove ask once through kt-confirm,
//   listing every worktree; each one is checked with the single action's rules (remove: changes,
//   an active agent, a Herdr terminal, a lock, the main checkout; sync: changes, no upstream): the
//   refused ones are listed with their reason and left out. Remove stays one `gwm remove` at a
//   time, each after its own --dry-run and a fresh check, never --force.
// - "panel": the "gwm-panel" child of the right panel's "panel-body" stack. It follows the shown
//   thread's terminal (kt-flow's rule) and its folder: in a linked worktree, that worktree (links,
//   agents, note, commit prefix, sync); in a main checkout, the repo (branches, worktrees, daemon,
//   doctor (a dithered bar: checks passed / total), .gwm.toml trust, `gwm clean` dry run); outside
//   git, an empty state.
// Transport: JSON-RPC to `gwm daemon` over its unix socket, one request per `nc -U`. A daemon
// answers for one repo only, so each repo gets its own socket beside gwm's default one
// (`gwm-kt-<hash>.sock`); gwm's default socket is used when it serves that repo. A repo shown
// in a repo view without a daemon gets one, started once by this copy, detached: it keeps running
// after Herdr quits. Failing that, `gwm list --format=json`. The header says which ("daemon"/"cli").
// Refresh: watchFolder on the repo's `<git-common-dir>/worktrees` and `refs/heads` (debounced),
// plus every 15 s for dirty and agent freshness, which no git event announces; only while shown.
// Keys (vim.js; kt-keys lists them under Pages and Panneau): ctrl-b h/l (pane.go, "focus") or
// `kt-gwm.key:<keys>` give a copy the keyboard in NORMAL (both copies get a `kt-gwm.<command>` when
// both show). Page: it opens in NORMAL (#78), as does a click on a card. INSERT (/): type to filter,
// ctrl-n/ctrl-p, ctrl-j/ctrl-k, ↓ ↑ move the cursor, enter opens it, esc: NORMAL. NORMAL: j/k, gg/G,
// ctrl-d/u, n/N move the cursor over the cards (k stops on the first card), / the filter, tab /
// shift-tab the next / previous repo (Global), enter/o/l open as a space (Ouvrir), O its PR (else
// issue) on GitHub, y copy the path, r refresh, dd remove (kt-confirm, refused when unsafe), ?
// kt-keys, q back to the thread; x or space toggle the card's selection, V a visual range (j/k
// extend it), ctrl-a selects every listed card; esc ends the range, then empties the selection,
// then clears the filter, then back to the thread. `kt-gwm.bulk:<open|copy|sync|remove>` runs a bulk
// bar button, for tests (sync and remove only open their confirm). Panel (no filter):
// the same over a worktree's issue and PR lines (enter: the Inbox, O: GitHub) or a repo's linked
// worktrees (enter: Ouvrir, dd/x: remove); [ / ] the previous / next panel tab, q and esc give the
// keyboard back (pane.go left). The panel has no selection.

import { View, div, svg, image } from "gpui-kit";
import { v_flex, h_flex, ScrollHandle } from "gpui-base";
import { exec, theme, spaces, panes, focused, run, layout, openOverlay, notify, nextCommand, props, shared, setShared, home, knownAgents, watchFolder, checking, settings } from "herdr";
import { Select, partition, lines } from "./select.js";
// #82: the page opened on a card by another mod (shared "kt.gwm.open"), open.js deciding.
import { openRequest, matchStop } from "./open.js";
import { filterRow, filterState } from "./filters.js";
import { dither, iconBtn, bandRow, moreMenu } from "./band.js";
import { motionState, frame, enter, pulse, sharpen, rows as rowsOf } from "./motion.js";
import { tileState, tilesFrame, projTile, LETTER } from "./projtile.js";
// Copied byte for byte from mods/kt-keys/panel.js: the panel view in and out with the right panel (#73).
import { panelIn } from "./panel.js";
import { skeleton, still } from "./skeleton.js";
// kt-keys' roll.js (a byte-identical copy): the head's, the selection's and a worktree's ahead / behind
// counts roll to their new digits.
import { roll, rollText } from "./roll.js";
// kt-keys' viz.js (a byte-identical copy, with viz.strings.js): the doctor and a bulk action's progress as dithered bars.
import { viz } from "./viz.js";
import { bump, gitTopics, refreshOn } from "./bus.js";
import { Vim, keysOf, keyOf, step } from "./vim.js";
import { makeT, lang, relative } from "./i18n.js";
import strings from "./strings.js";
// kt-keys' machines.js (a byte-identical copy, with machines.strings.js): the note beside another
// machine's thread (#65).
import { machineNote } from "./machines.js";
// kt-threads' projects.js (a byte-identical copy): an archived project isn't listed in Global (#88).
import { shown } from "./projects.js";

const tr = makeT(strings);
const MONO = "Monaspace Krypton";
const I = (name) => `mods/kt-threads/${name}.svg`;
const G = (name) => `mods/kt-gwm/${name}.svg`;
// This mod's blocks in kbrdn-threads.json.
const PAGE = "gwm"; // in the "view" stack
const PANEL = "gwm-panel"; // in the "panel-body" stack
// The right panel's tabs, in order, and their mods: [ / ] go round them.
const PANEL_TABS = [["files", "kt-files"], ["diff", "kt-diff"], ["history", "kt-history"], ["flow", "kt-flow"], ["crosstalk", "kt-crosstalk"], ["context", "kt-context"], [PANEL, "kt-gwm"]];
const TICK = 15e3;
const STATUS_TTL = 10 * 60e3;
const INFO_TTL = 5 * 60e3;
const CLEAN_TTL = 30 * 60e3;
// gwm's agent kinds -> Herdr's program keys (programs.json) and names.
const KIND = { claude: "claude", codex: "codex", opencode: "opencode", vibe: "vibe" };
const KIND_NAME = { claude: "Claude Code", codex: "Codex", opencode: "opencode", vibe: "Mistral Vibe" }; // i18n: tech

// gwm's default socket folder (src/daemon.rs, socket_in): $XDG_RUNTIME_DIR, else $TMPDIR, else
// /tmp; one that isn't owner-only gets gwm's private gwm-<uid>/ inside.
const SOCKET_DIR = 'b="${XDG_RUNTIME_DIR:-${TMPDIR:-/tmp}}"; b="${b%/}"; if [ -d "$b" ] && [ ! -L "$b" ] && [ -O "$b" ] && [ "$(ls -ld "$b" | cut -c5-10)" = "------" ]; then printf %s "$b"; else printf %s "$b/gwm-$(id -u)"; fi';
// One NDJSON request, one response line; macOS nc closes once the daemon has answered.
const RPC = 'printf "%s\\n" "$1" | nc -U "$2"';
// A long-lived daemon on purpose: nohup and every fd redirected, so exec returns at once and the
// daemon outlives this mod. Never --allow-bootstrap. Waits (3 s at most) for "listening on".
const START = 'mkdir -p -m 700 "${1%/*}" || exit 1; : >"$2"; nohup gwm daemon --socket "$1" --deny-bootstrap >"$2" 2>&1 </dev/null & i=0; while [ $i -lt 30 ] && ! grep -q "listening on" "$2"; do sleep 0.1; i=$((i+1)); done';
// The trust ledger's key for the repo (src/trust.rs): origin's raw URL, else the checkout's real
// path; then .gwm.toml's sha256 when there is one.
const TRUST_KEY = 'git config --get remote.origin.url || pwd -P; [ -f .gwm.toml ] && shasum -a 256 .gwm.toml | cut -c1-64';

/** A theme color with alpha `a` (2 hex digits), replacing any it has (glass themes are #rrggbbaa). */
const alpha = (c, a) => `${String(c).slice(0, 7)}${a}`;
const parse = (s, fallback) => { try { return JSON.parse(s); } catch { return fallback; } };
const load = (k) => parse(localStorage.getItem(k) ?? "null", null);
const save = (k, v) => localStorage.setItem(k, JSON.stringify(v));
// exec that never rejects (not installed, folder gone, timeout): code -1.
const sh = (cmd, args, o = {}) => exec(cmd, args, { timeout: 20e3, ...o }).catch((e) => ({ code: -1, stdout: "", stderr: String(e) }));
const lastLine = (s) => String(s ?? "").trim().split("\n").filter(Boolean).pop() ?? "";
const trim = (p) => (typeof p === "string" && p.length > 1 ? p.replace(/\/+$/, "") : p);
const inside = (cwd, p) => Boolean(cwd && p) && (cwd === p || cwd.startsWith(`${p}/`));
// The worktree a folder is in: the longest enclosing path (kbrdn.dev-v2 doesn't own kbrdn.dev-v2-worktrees/x).
const enclosing = (rows, cwd) => rows.filter((w) => inside(cwd, w.path)).sort((a, b) => b.path.length - a.path.length)[0] ?? null;
const tilde = (p) => (p && inside(p, home()) ? `~${p.slice(home().length)}` : p ?? "");
// gwm clean's "4.1 GiB" -> "4,1 Go" in French, "4.1 GB" in English.
const size = (s) => (lang() === "fr" ? s.replace(/(\d)\.(\d)/, "$1,$2").replace(/\b([KMGT])iB\b/, "$1o").replace(/\bB$/, "o") : s.replace(/\b([KMGT])iB\b/, "$1B"));
const isHome = (s) => !s.machine && trim(s.folder) === trim(home());
const branchOf = (w) => w.branch ?? (w.head ? tr("detachedAt", { sha: w.head.slice(0, 7) }) : tr("detached"));
// A project's logo for the appearance now (registry `logos: { light, dark }`, or the older single
// `logo`): its own, else the other mode's; null for none. kt-threads' logoOf().
function logoOf(e) {
  const l = e?.logos ?? { light: e?.logo ?? null, dark: e?.logo ?? null };
  return (settings().dark ? (l.dark ?? l.light) : (l.light ?? l.dark)) ?? null;
}
// Claude Code's own worktrees (its WorktreeCreate hooks: subagents in isolation, --worktree,
// background sessions): <repo>-worktrees/claude-<name> on a claude/<name> branch.
const isAgent = (w) => String(w.branch ?? "").startsWith("claude/");
// "owner/repo" from a github.com remote (https, ssh://, scp-like git@…:), else null (kt-inbox's rule).
function githubRepo(url) {
  const m = String(url ?? "").trim().match(/^(?:(?:https?|ssh|git):\/\/)?(?:[^@/\s]+@)?github\.com(?::\d+)?[:/]([^/\s]+)\/([^/\s]+?)(?:\.git)?\/?$/i);
  return m ? `${m[1]}/${m[2]}` : null;
}

// A socket name per repo: two 32-bit FNV-1a variants of its git dir.
function hash(s) {
  let a = 0x811c9dc5, b = 0x01000193;
  for (const ch of s) {
    const c = ch.codePointAt(0);
    a = Math.imul(a ^ c, 0x01000193) >>> 0;
    b = Math.imul(b ^ c, 0x811c9dc5) >>> 0;
  }
  return a.toString(16).padStart(8, "0") + b.toString(16).padStart(8, "0").slice(0, 4);
}

const ago = (sec) => (sec ? relative(sec * 1000) : "");

// gwm status' state -> label (GitHub's word, in both languages), icon, theme color name (no state
// yet: the bare number, muted).
// i18n: tech
function look(kind, state) {
  const s = String(state ?? "").toUpperCase();
  if (kind === "pr") {
    if (s === "MERGED") return { label: "merged", icon: "git-merge", color: "ansi5" }; // i18n: tech
    if (s === "CLOSED") return { label: "closed", icon: "git-pull-request-closed", color: "ansi1" }; // i18n: tech
    if (s === "DRAFT") return { label: "draft", icon: "git-pull-request", color: "dim" }; // i18n: tech
    if (s === "OPEN") return { label: "open", icon: "git-pull-request", color: "ansi2" }; // i18n: tech
    return { label: "", icon: "git-pull-request", color: "muted" };
  }
  if (s === "CLOSED") return { label: "closed", icon: "circle-check", color: "ansi5" }; // i18n: tech
  if (s === "OPEN") return { label: "open", icon: "circle-dashed", color: "ansi2" }; // i18n: tech
  return { label: "", icon: "circle-dashed", color: "muted" };
}

// Monocode's program tile: the program's icon on its own color (Herdr's program table).
function tile(t, p, kind, size = 18) {
  const glyph = p?.icon
    ? (p.tint ? svg(p.icon).size(size - 7).text_color(p.color ?? "#ffffff") : image(p.icon).size(size - 7))
    : div().font_family(MONO).text_size(10).text_color(t.muted).child(String(kind ?? "?")[0].toUpperCase());
  return div().size(size).flex_none().rounded(5).border(1).border_color("#00000033").bg(p?.tile ?? t.raised).flex().items_center().justify_center().child(glyph);
}

function find(node, id) {
  if (node?.id === id) return node;
  for (const c of node?.children ?? []) {
    const f = find(c, id);
    if (f) return f;
  }
  return null;
}
const activeChild = (n) => n?.active ?? n?.children?.[0]?.id;
const onPage = () => activeChild(find(layout(), "view")) === PAGE;
function onPanel() {
  const root = layout(), panel = find(root, "panel");
  return Boolean(panel && !panel.hidden && activeChild(find(root, "panel-body")) === PANEL);
}
const show = (child) => run("layout.select", { stack: "view", child });

// Where the shown thread's terminal is now (kt-flow's terminal(), this computer only).
function threadCwd() {
  const f = focused();
  if (f?.terminal && !f.terminal.includes("/")) return trim(f.cwd ?? null);
  const tab = spaces().find((s) => s.active)?.tabs.find((x) => x.active);
  const mine = panes().filter((p) => p.tab === tab?.id && p.terminal && !p.terminal.includes("/"));
  return trim((mine.find((p) => p.program?.agent) ?? mine[0])?.cwd ?? null);
}

export default class Worktrees extends View {
  init(_props, cx) {
    this.tiles = tileState(); // projtile.js: a project without a logo on the logos' dithered background
    this.panel = props()?.view === "panel";
    this.handle = cx.focus_handle();
    this.vim = new Vim({ field: !this.panel });
    this.cur = null; // the keys' cursor (a stop's id, see stops()); null: the first
    this.scroll = ScrollHandle.new();
    this.query = "";
    this.global = false; // "Global" pressed in a repo scope; a space change resets it
    this.spaceId = null;
    this.repos = {}; // folder -> { folder, common, name } | null (outside git)
    this.data = {}; // git common dir -> { rows, source, sock, error, pins, at }
    this.inflight = {};
    this.started = new Set(); // sockets this copy started a daemon on: once each
    this.dir = null; // gwm's default socket folder
    this.ready = false;
    this.st = {}; // "path|branch" -> { at, data } from `gwm status --json`
    this.queue = [];
    this.running = 0;
    this.info = {}; // common dir -> { at, def, doctor, trust } (panel, main checkout)
    this.prefix = {}; // "path|branch" -> `gwm commit-prefix`
    this.clean = {}; // common dir -> { at, total, error } (`gwm clean`, report only)
    this.busy = null; // { path, label }: the running action
    this.pending = null; // what kt-confirm is asking about
    this.hot = null; // the hovered card's path
    this.multi = new Select(); // the page's selected cards (paths)
    this.agentOpen = new Set(); // repos (common dirs) whose agent worktrees are unfolded
    this.motion = motionState(); // motion.js: the bulk bar fades in, Rafraîchir breathes while it loads, the cards open and close
    this.headW = 0; // the head card's width (its dither)
    this.panelW = 0; // the panel card's
    this.more = false; // the head's ⋯ menu
    this.removeSeen = 0; // the last shared "kt-gwm.remove" request handled (its `at`)
    this.want = null; // a card another mod asked to see (openAsked, #82): { path, branch }, until listed
    this.openSeen = null; // that request's `at`: each read once
    this.wf = null; // the page's state filter (WSTATES key), null: every worktree
    this.wfRow = filterState();
    this.programs = {};
    this.watches = [];
    this.watching = null;
    this.scopeKey = null;
    this.spinning = 0; // loud fetches running
    if (checking()) return;
    this.st = load("status") ?? {};
    this.clean = load("clean") ?? {};
    cx.spawn(async (cx) => {
      const r = await sh("sh", ["-c", SOCKET_DIR]);
      this.dir = (r.code === 0 && r.stdout.trim()) || null;
      this.ready = true;
      cx.notify();
      try { for (const p of await knownAgents()) this.programs[p.key] = p; } catch { /* plain letters */ }
      cx.notify();
    });
    cx.timer.every(TICK, (cx) => { if (this.visible()) this.refresh(cx, false); });
    // The keyboard left without a render (a click on a terminal): the cursor goes out.
    // On the same tick (timers run while the page is hidden; a hidden page doesn't render): shared
    // "kt-gwm.remove" ({ path, at }, kt-threads when a worktree's last thread is put away), taken by
    // the page copy once if under a minute old, through the guarded remove (which shows the page).
    cx.timer.every(1000, (cx) => {
      if (this.keyed !== this.handle.is_focused()) cx.notify();
      const req = shared("kt-gwm.remove");
      if (!this.panel && req?.path && req.at > this.removeSeen && Date.now() - req.at < 60e3) {
        this.removeSeen = req.at;
        this.removeByPath(req.path, cx);
      }
    });
    // `focus` (pane.go) takes the keyboard in NORMAL; `key:<keys>` takes it and types those keys
    // ("j", "g g", "/ f i x"), for tests.
    cx.spawn(async (cx) => {
      for (;;) {
        const c = await nextCommand();
        if (c === "focus") this.focusIn();
        // The panel's [ / ] land on gwm-panel: only that copy takes the keyboard, not the page's.
        else if (c === "panel-focus") { if (this.panel) this.focusIn(); }
        else if (c.startsWith("key:")) {
          this.focusIn();
          for (const k of keysOf(c.slice(4))) this.press(k, cx);
        }
        // `bulk:<id>`: the page's bulk bar button of that id, as its click, for tests.
        else if (c.startsWith("bulk:")) { if (!this.panel) this.bulkActions?.find(([id]) => id === c.slice(5))?.[3](cx); }
        else if (c.startsWith("remove:")) { if (!this.panel) this.removeByPath(c.slice(7), cx); }
        else if (c === "refresh") this.refresh(cx, true);
        else if (c === "open-first-link") this.openFirstLink();
        // Both views can show at once: only the copy that asked has something pending.
        else if (c === "confirmed" && this.pending) {
          const p = this.pending;
          this.pending = null;
          this.act(p, cx);
        }
        cx.notify();
      }
    });
  }

  // An overlay copy (tests, mod.open) always counts as shown.
  visible() {
    return Boolean(props()?.overlay) || (this.panel ? onPanel() : onPage());
  }

  // ---------- transport ----------

  sockOf(repo) {
    return this.dir && `${this.dir}/gwm-kt-${hash(repo.common)}.sock`;
  }

  async rpc(sock, method) {
    const r = await sh("sh", ["-c", RPC, "sh", JSON.stringify({ jsonrpc: "2.0", method, id: 1 }), sock], { timeout: 5e3 });
    const msg = r.code === 0 ? parse(r.stdout.split("\n")[0], null) : null;
    return msg && "result" in msg ? msg.result : null;
  }

  // A repo's worktrees: its daemon (this mod's socket, else gwm's default one when it serves this
  // repo, else one started for it once when `start`), else the CLI.
  async list(repo, start) {
    const own = this.sockOf(repo);
    // A daemon answers for the repo it was started in: it must list the folder we asked about.
    const ours = (rows) => Array.isArray(rows) && rows.some((w) => inside(repo.folder, trim(w.path)));
    for (const sock of [own, this.dir && `${this.dir}/gwm.sock`].filter(Boolean)) {
      const rows = await this.rpc(sock, "list");
      if (ours(rows)) return { rows, source: "daemon", sock };
    }
    if (start && own && !this.started.has(own)) {
      this.started.add(own);
      // From the main checkout: a daemon started in a linked worktree loses its repo when that worktree goes.
      await sh("sh", ["-c", START, "sh", own, own.replace(/\.sock$/, ".log")], { cwd: repo.main ?? repo.folder, timeout: 8e3 });
      const rows = await this.rpc(own, "list");
      if (ours(rows)) return { rows, source: "daemon", sock: own };
    }
    const r = await sh("gwm", ["list", "--format=json"], { cwd: repo.folder });
    const rows = r.code === 0 ? parse(r.stdout, null) : null;
    return Array.isArray(rows) ? { rows, source: "cli" } : { rows: [], source: "cli", error: lastLine(r.stderr || r.stdout) || tr("failedCode", { cmd: "gwm list", code: r.code }) };
  }

  // Agent pins (`gwm agents attach`) live in git config, not in the list: branch -> [session ids].
  async pins(repo) {
    const r = await sh("git", ["config", "--get-regexp", "^branch\\..*\\.gwm-agent-pin$"], { cwd: repo.folder });
    const out = {};
    for (const line of r.stdout.split("\n")) {
      const m = line.match(/^branch\.(.+)\.gwm-agent-pin (\S+)$/);
      if (m) (out[m[1]] ??= []).push(m[2]);
    }
    return out;
  }

  // ---------- data ----------

  // A folder's repo (git's common dir), once per folder.
  resolve(folder, cx) {
    const k = `r:${folder}`;
    if (!folder || folder in this.repos || this.inflight[k] || checking()) return;
    this.inflight[k] = true;
    cx.spawn(async (cx) => {
      const [r, origin] = await Promise.all([
        sh("git", ["rev-parse", "--path-format=absolute", "--git-common-dir"], { cwd: folder }),
        sh("git", ["config", "--get", "remote.origin.url"], { cwd: folder }),
      ]);
      delete this.inflight[k];
      const common = r.code === 0 ? trim(r.stdout.trim()) : "";
      const main = common.endsWith("/.git") ? common.slice(0, -5) : common.replace(/\.git$/, "");
      // `main`: the main checkout when git's dir sits in it (not a bare repo); `slug`: its GitHub
      // "owner/repo", which kt-inbox lists.
      this.repos[folder] = common ? { folder, common, main: common.endsWith("/.git") ? main : null, name: main.split("/").pop(), slug: githubRepo(origin.stdout) } : null;
      cx.notify();
    });
  }

  // What this copy shows: { kind: "repo", repo, cwd? } | { kind: "workspace", repos, inRepo }
  // | { kind: "none", cwd } | { kind: "wait" } | { kind: "remote", machine }: another machine's thread
  // (#65), whose worktrees aren't read from here (gwm and its daemon run on this Mac); the page can still
  // show this Mac's projects (the global view).
  scope(cx) {
    const away = spaces().find((x) => x.active)?.machine ?? null;
    if (this.panel) {
      if (away) return { kind: "remote", machine: away };
      const cwd = threadCwd();
      if (!cwd) return { kind: "none", cwd: null };
      if (!(cwd in this.repos)) { this.resolve(cwd, cx); return { kind: "wait" }; }
      return this.repos[cwd] ? { kind: "repo", repo: this.repos[cwd], cwd } : { kind: "none", cwd };
    }
    const s = spaces().find((x) => x.active);
    if ((s?.id ?? null) !== this.spaceId) {
      this.spaceId = s?.id ?? null;
      this.global = false;
    }
    if (away && !this.global) return { kind: "remote", machine: away };
    const folder = s && !s.machine && !isHome(s) ? trim(s.folder) : null;
    if (folder && !(folder in this.repos)) { this.resolve(folder, cx); return { kind: "wait" }; }
    const own = folder ? this.repos[folder] : null;
    if (own && !this.global) return { kind: "repo", repo: own };
    // The projects registry, one group per repo (this computer's), the archived ones left out.
    const seen = new Set();
    const repos = [];
    for (const e of shown(shared("kt.projects")).sort((a, b) => (a.order ?? 0) - (b.order ?? 0))) {
      if (e.machine || !e.folder) continue;
      const f = trim(e.folder);
      if (!(f in this.repos)) { this.resolve(f, cx); continue; }
      const r = this.repos[f];
      if (r && !seen.has(r.common)) { seen.add(r.common); repos.push(r); }
    }
    return { kind: "workspace", repos, inRepo: Boolean(own) };
  }

  // `loud` (Rafraîchir): spins the refresh icon and always redraws when done. A quiet tick redraws
  // only on a change, so it must not spin (the spin would outlive it).
  fetch(repo, start, cx, loud) {
    const k = `l:${repo.common}`;
    if (this.inflight[k]) return;
    this.inflight[k] = true;
    if (loud) {
      this.spinning++;
      cx.notify();
    }
    cx.spawn(async (cx) => {
      const [got, pins] = await Promise.all([this.list(repo, start), this.pins(repo)]);
      delete this.inflight[k];
      if (loud) this.spinning--;
      const rows = got.rows.map((w) => ({ ...w, path: trim(w.path) }));
      const next = { rows, source: got.source, sock: got.sock ?? null, error: got.error ?? null, pins, at: Date.now() };
      // Redraw only on a change (each redraw repaints the window); age_seconds ticks by itself.
      const sig = (d) => JSON.stringify([d.rows.map(({ age_seconds, ...w }) => w), d.source, d.error, d.pins]);
      const prev = this.data[repo.common];
      this.data[repo.common] = next;
      // A card asked for (openAsked): the rows it waited for are here.
      if (this.want) this.applyWant(cx, true);
      if (loud || !prev || sig(prev) !== sig(next)) cx.notify();
    });
  }

  // shared "kt.gwm.open" (#82, the Chat's references: { path?, branch?, at }, kt-inbox's
  // "kt.inbox.open" pattern), on the page only: that worktree's card SHOWN, the cursor on it brought
  // into view, the filters that hide it cleared, the agent fold opened for an agent's one. It acts on
  // nothing: no sync, no remove (open.check.mjs proves neither is reached from here). Not listed yet:
  // kept until the rows come; listed and absent: said, dropped. Read once and cleared; older than 30 s,
  // only cleared.
  openAsked(cx) {
    const req = shared("kt.gwm.open");
    if (this.panel || !req || this.openSeen === req.at) return;
    this.openSeen = req.at;
    // Not during render: setShared redraws every mod.
    cx.spawn(async (cx) => {
      setShared("kt.gwm.open", null);
      const want = openRequest(req, Date.now());
      if (!want) return;
      this.want = want;
      this.applyWant(cx, Object.keys(this.data).length > 0);
      cx.notify();
    });
  }

  applyWant(cx, listed) {
    const s = matchStop(this.stops(true), this.want);
    if (!s && !listed) return;
    const want = this.want;
    this.want = null;
    if (!s) {
      notify({ title: tr("open.notListed"), body: want.branch ?? want.path, level: "warning", timeout: 5000 });
      return;
    }
    if (!this.matches(s.w)) { this.query = ""; this.wf = null; }
    if (isAgent(s.w)) this.agentOpen.add(s.repo.common);
    this.cur = s.id;
    // The keyboard here (NORMAL), so the cursor shows on the card: focusIn keeps a cursor it finds.
    this.focusIn();
    this.reveal = true;
    cx.notify();
  }

  refresh(cx, force) {
    if (!this.ready || checking()) return;
    const sc = this.scope(cx);
    const repos = sc.kind === "repo" ? [sc.repo] : sc.kind === "workspace" ? sc.repos : [];
    for (const r of repos) {
      if (force) {
        for (const w of this.data[r.common]?.rows ?? []) delete this.st[`${w.path}|${w.branch}`];
        delete this.info[r.common];
        delete this.clean[r.common];
      }
      // A daemon is started only for a repo shown on its own, not for each repo of the registry.
      this.fetch(r, sc.kind === "repo", cx, force);
    }
  }

  // The live issue / PR of a worktree (`gwm status --json` asks gh: seconds each), cached;
  // asked again when stale, only with a cx (a shown copy).
  statusOf(w, cx) {
    if (!w.branch) return null;
    const k = `${w.path}|${w.branch}`;
    const c = this.st[k];
    if (cx && (!c || Date.now() - c.at > STATUS_TTL) && !this.inflight[`s:${k}`]) {
      this.inflight[`s:${k}`] = true;
      this.queue.push({ k, path: w.path });
      this.pump(cx);
    }
    return c?.data ?? null;
  }

  // Two `gwm status` at a time.
  pump(cx) {
    while (this.running < 2 && this.queue.length) {
      const { k, path } = this.queue.shift();
      this.running++;
      cx.spawn(async (cx) => {
        const r = await sh("gwm", ["status", "--json"], { cwd: path, timeout: 60e3 });
        this.running--;
        delete this.inflight[`s:${k}`];
        // A failure (gh offline) is kept too: asked again when stale, not on every render.
        this.st[k] = { at: Date.now(), data: (r.code === 0 && parse(r.stdout, null)) || this.st[k]?.data || null };
        const old = Date.now() - 86400e3;
        for (const [x, v] of Object.entries(this.st)) if (v.at < old) delete this.st[x];
        save("status", this.st);
        this.pump(cx);
        cx.notify();
      });
    }
  }

  // The repo card of the panel: default branch, doctor, .gwm.toml trust.
  loadInfo(repo, d, cx) {
    const k = `i:${repo.common}`;
    const old = this.info[repo.common];
    if (this.inflight[k] || (old && Date.now() - old.at < INFO_TTL)) return;
    const main = d.rows.find((w) => w.is_main)?.path ?? repo.folder;
    this.inflight[k] = true;
    cx.spawn(async (cx) => {
      const doctor = async () => (d.sock && (await this.rpc(d.sock, "doctor"))) || parse((await sh("gwm", ["doctor", "--format=json"], { cwd: main })).stdout, null);
      const [def, doc, key, ledger] = await Promise.all([
        sh("git", ["symbolic-ref", "--short", "refs/remotes/origin/HEAD"], { cwd: main }),
        doctor(),
        sh("sh", ["-c", TRUST_KEY], { cwd: main }),
        sh("gwm", ["trust", "show"], { cwd: main }),
      ]);
      delete this.inflight[k];
      const [origin, sha] = key.stdout.split("\n").map((x) => x.trim());
      // Read-only: the ledger as `gwm trust show` prints it; a match is (origin, sha) exactly.
      const entries = ledger.stdout.split("[[entries]]").slice(1).map((e) => ({ origin: e.match(/^origin = "(.*)"$/m)?.[1], sha: e.match(/^config_sha = "(.*)"$/m)?.[1] }));
      const trust = !sha ? "absent" : ledger.code !== 0 ? "unknown"
        : entries.some((e) => e.origin === origin && e.sha === sha) ? "trusted"
        : entries.some((e) => e.origin === origin) ? "drift" : "untrusted";
      this.info[repo.common] = { at: Date.now(), def: def.code === 0 ? def.stdout.trim().replace(/^origin\//, "") : null, doctor: doc, trust };
      cx.notify();
    });
  }

  // `gwm clean` without --yes only reports (seconds of disk scanning): cached 30 min.
  loadClean(repo, d, cx) {
    const k = `c:${repo.common}`;
    const old = this.clean[repo.common];
    if (this.inflight[k] || (old && Date.now() - old.at < CLEAN_TTL)) return;
    const main = d.rows.find((w) => w.is_main)?.path ?? repo.folder;
    this.inflight[k] = true;
    cx.spawn(async (cx) => {
      const r = d.rows.length > 1 ? await sh("gwm", ["clean"], { cwd: main, timeout: 120e3 }) : { code: 0, stdout: "" };
      delete this.inflight[k];
      const total = r.stdout.match(/^Total reclaimable:\s*(.+)$/m)?.[1]?.trim();
      // The raw total: size() says it in the language shown (a cached one is drawn again in the new one).
      this.clean[repo.common] = { at: Date.now(), total: total ?? null, error: r.code === 0 ? null : lastLine(r.stderr) || tr("code", { code: r.code }) };
      const stale = Date.now() - 86400e3;
      for (const [x, v] of Object.entries(this.clean)) if (v.at < stale) delete this.clean[x];
      save("clean", this.clean);
      cx.notify();
    });
  }

  loadPrefix(w, cx) {
    const k = `${w.path}|${w.branch}`;
    if (!w.branch || k in this.prefix || this.inflight[`p:${k}`]) return;
    this.inflight[`p:${k}`] = true;
    cx.spawn(async (cx) => {
      const r = await sh("gwm", ["commit-prefix", "--unicode"], { cwd: w.path });
      delete this.inflight[`p:${k}`];
      this.prefix[k] = r.code === 0 ? r.stdout.trim() : null;
      cx.notify();
    });
  }

  // ---------- refresh on git events ----------

  watch(repo, cx) {
    if (this.watching === (repo?.common ?? null)) return;
    this.unwatch();
    if (!repo) return;
    const mine = (this.watching = repo.common);
    for (const dir of [`${repo.common}/worktrees`, `${repo.common}/refs/heads`]) {
      cx.spawn(async (cx) => {
        while (this.watching === mine) {
          const w = watchFolder(dir);
          this.watches.push(w);
          let paths;
          // Absent (no linked worktree yet) or no room left: the 15 s timer covers it.
          try { paths = await w; } catch { return; }
          this.watches = this.watches.filter((x) => x !== w);
          if (this.watching !== mine || !paths.length) return; // [] = cancelled
          // Not index or lock churn: reading a worktree's status may touch its index.
          if (paths.some((p) => p === dir || !/(\/index|\.lock|\/logs\/.*|_HEAD)$/.test(p))) this.soon(cx);
        }
      });
    }
  }

  unwatch() {
    this.watching = null;
    for (const w of this.watches) w.cancel();
    this.watches = [];
  }

  soon(cx) {
    if (this.later) return;
    this.later = true;
    cx.timer.after(600, (cx) => {
      this.later = false;
      if (this.visible()) this.refresh(cx, false);
    });
  }

  // ---------- actions ----------

  openSpace(d, w) {
    const s = spaces().find((x) => !x.machine && enclosing(d.rows, trim(x.folder))?.path === w.path);
    if (!this.panel) show("thread");
    if (s) run("space.select", { id: s.id });
    else run("space.new", { folder: w.path, machine: "" });
  }

  // A linked issue / PR opens in kt-inbox (the "inbox" page of the same stack), which reads
  // shared "kt.inbox.open" once and clears it. Not on GitHub: the browser instead.
  inInbox(repo, kind, x) {
    if (!repo.slug) return this.onGitHub(repo, kind, x);
    setShared("kt.inbox.open", { repo: repo.slug, kind, number: x.number, at: Date.now() });
    show("inbox");
  }

  // The browser, only from the GitHub icons. Read-only.
  onGitHub(repo, kind, x) {
    if (x.url) exec("open", [x.url]).catch(() => {});
    else if (repo.slug) sh("gh", [kind === "pr" ? "pr" : "issue", "view", String(x.number), "--web", "-R", repo.slug]);
  }

  // Test hook (`kt-gwm.open-first-link`): the first linked issue or PR of what this copy shows, in kt-inbox.
  openFirstLink() {
    for (const r of Object.values(this.repos)) {
      if (!r) continue;
      for (const w of this.data[r.common]?.rows ?? []) {
        const { issue, pr } = this.links(w);
        if (issue || pr) return this.inInbox(r, issue ? "issue" : "pr", issue ?? pr);
      }
    }
  }

  // Why a worktree can't go now, or null. Never forced.
  refusal(w) {
    if (w.is_main) return tr("why.main");
    if (w.is_locked) return tr("why.locked");
    if (w.status?.unknown) return tr("why.unknown");
    if (w.status?.is_dirty) return tr("why.dirty");
    if ((w.agents?.sessions ?? []).some((s) => s.freshness === "active")) return tr("why.agentActive");
    const here = panes().filter((p) => p.terminal && !p.terminal.includes("/") && inside(trim(p.cwd), w.path));
    if (here.some((p) => p.program?.agent)) return tr("why.agentTerminal");
    if (here.length) return tr("why.terminal");
    return null;
  }

  refuse(name, title, why) {
    notify({ title, body: tr("refuseBody", { name, why }), level: "warning", timeout: 6000 });
  }

  ask(p, title, detail, label, danger) {
    if (this.busy) return;
    this.pending = p;
    // kbrdn's confirm draws its own card and veil, full window (its mod.json): frame "none", no size.
    // A list (a bulk action) opens it card-sized instead, its detail scrolling: full window, today's
    // kt-confirm leaves its detail out.
    const rows = detail.split("\n").length;
    openOverlay({ mod: "kt-confirm", kind: "dialog", frame: "none", ...(p.items ? { width: 460, height: Math.min(560, 170 + 21 * rows) } : {}),
      props: { title, detail, label, danger, command: { name: "kt-gwm.confirmed" } } });
  }

  // Why gwm sync can't run on a worktree now, or null.
  syncRefusal(w) {
    const s = w.status ?? {};
    if (s.is_dirty) return tr("why.syncDirty");
    if (!s.has_upstream) return tr("why.noUpstream");
    return null;
  }

  askSync(w) {
    const why = this.syncRefusal(w);
    if (why) return this.refuse(w.name, w.status?.is_dirty ? tr("syncRefused") : tr("syncImpossible"), why);
    const s = w.status ?? {};
    this.ask({ kind: "sync", path: w.path, name: w.name }, tr("sync.title", { name: w.name }),
      tr("sync.detail", { branch: w.branch, behind: s.behind ? tr("sync.behind", { n: s.behind }) : "" }),
      tr("sync.label"), false);
  }

  askRemove(repo, w) {
    const why = this.refusal(w);
    if (why) return this.refuse(w.name, tr("removeRefused"), why);
    this.ask({ kind: "remove", path: w.path, name: w.name, repo }, tr("remove.title", { name: w.name }),
      tr("remove.detail", { path: tilde(w.path), branch: w.branch ?? tr("remove.detached") }), tr("remove.label"), true);
  }

  // The bulk bar's Sync and Supprimer: each selected worktree checked with the single action's rule
  // (select.js partition); the refused ones are listed with their reason and left out, the rest asked
  // about once (kt-confirm, every one listed). Nothing to do: a toast with the reasons, no confirm.
  askBulk(kind, picked, more = () => null) {
    if (this.busy) return;
    const remove = kind === "remove";
    const plan = partition(picked, (s) => (remove ? this.refusal(s.w) : this.syncRefusal(s.w)) ?? more(s.w));
    const refused = plan.refused.map(({ item, why }) => tr("line", { name: item.w.name, why }));
    const rest = (k) => tr("more", { n: k });
    if (!plan.ok.length)
      return notify({ title: remove ? tr("removeRefused") : tr("syncRefused"), body: lines(refused, 6, rest), level: "warning", timeout: 9000 });
    const n = plan.ok.length;
    const names = plan.ok.map((s) => s.w.name);
    const what = remove ? tr("bulk.removeWhat") : tr("bulk.syncWhat");
    const whom = n <= 3 ? names.join(", ") : tr("worktrees", { n });
    this.ask({ kind, items: plan.ok.map((s) => ({ kind, path: s.w.path, name: s.w.name, repo: s.repo })) },
      remove ? tr("bulk.removeTitle", { what: whom }) : tr("bulk.syncTitle", { what: whom }),
      [what, lines(plan.ok.map((s) => `${s.w.name} — ${tilde(s.w.path)}`), 10, rest), refused.length ? `${tr("refused")}\n${lines(refused, 10, rest)}` : ""].filter(Boolean).join("\n\n"),
      remove ? tr("remove.label") : tr("sync.label"), remove);
  }

  // Nettoyer: a repo's agent worktrees (claude/*) merged into its default branch (origin/HEAD, an
  // ancestor of it) and clean; the bulk remove's guard and confirm (danger, the list), never --force.
  // A subagent that ends doesn't remove its own worktree: this is where they go.
  cleanAgents(repo, d, cx) {
    if (this.busy) return;
    const agents = d.rows.filter(isAgent);
    const main = d.rows.find((w) => w.is_main)?.path ?? repo.folder;
    cx.spawn(async (cx) => {
      const def = (await sh("git", ["symbolic-ref", "--short", "refs/remotes/origin/HEAD"], { cwd: main })).stdout.trim() || "origin/main";
      const merged = new Set();
      for (const w of agents) {
        const r = await sh("git", ["merge-base", "--is-ancestor", w.branch, def], { cwd: main });
        if (r.code === 0) merged.add(w.path);
      }
      this.askBulk("remove", agents.map((w) => ({ id: w.path, repo, d, w })), (w) => (merged.has(w.path) ? null : tr("why.notMerged", { def })));
      cx.notify();
    });
  }

  // `kt-gwm.remove:<path>` and shared "kt-gwm.remove" ({ path, at }, from kt-threads): one worktree
  // by its path, through exactly the guarded remove (fresh state, refusal, kt-confirm, then remove()'s
  // re-check and --dry-run, never --force). The page shows itself first, so kt-confirm's answer
  // (kt-gwm.confirmed, which reaches shown copies only) comes back to it.
  removeByPath(path, cx) {
    path = trim(String(path ?? ""));
    if (!path.startsWith("/") || this.busy) return;
    show(PAGE);
    cx.spawn(async (cx) => {
      const r = await sh("git", ["rev-parse", "--path-format=absolute", "--git-common-dir"], { cwd: path });
      const common = r.code === 0 ? trim(r.stdout.trim()) : "";
      if (!common) return notify({ title: tr("removeRefused"), body: tr("notWorktree", { path: tilde(path) }), level: "warning", timeout: 6000 });
      const main = common.endsWith("/.git") ? common.slice(0, -5) : null;
      const repo = { folder: main ?? path, common, main, name: (main ?? common).split("/").pop(), slug: null };
      const got = await this.list(repo, false);
      const w = got.rows.map((x) => ({ ...x, path: trim(x.path) })).find((x) => x.path === path);
      if (!w) return notify({ title: tr("removeRefused"), body: tr("notListed", { path: tilde(path) }), level: "warning", timeout: 6000 });
      this.askRemove(repo, w);
      cx.notify();
    });
  }

  // One action, or a bulk one (p.items) worktree after worktree; a bulk one ends with one toast.
  act(p, cx) {
    const items = p.items ?? [p];
    const sync = p.kind === "sync";
    const label = sync ? "Sync" : tr("busy.remove"); // i18n: tech
    this.busy = { path: items[0].path, label, ...(p.items && { what: label, i: 0, n: items.length }) };
    cx.spawn(async (cx) => {
      const out = [];
      for (const [i, q] of items.entries()) {
        // A bulk one: its base label, i done of n, for the bulk bar's progress.
        this.busy = { path: q.path, label: p.items ? `${label} ${i + 1}/${items.length}` : label, ...(p.items && { what: label, i, n: items.length }) };
        cx.notify();
        out.push(await (sync ? this.sync(q) : this.remove(q)));
      }
      this.busy = null;
      // The bus (DATA-SYNC.md), even after a partial failure: worktrees and their repos changed.
      bump("gwm", ...new Set(items.flatMap((q) => gitTopics(q.path))));
      if (!p.items) notify({ ...out[0], timeout: out[0].level === "success" ? 4000 : 8000 });
      else {
        const bad = out.filter((n) => n.level !== "success");
        notify({ level: !bad.length ? "success" : bad.length === out.length ? "error" : "warning",
          title: tr(sync ? "doneSync" : "doneRemove", { ok: out.length - bad.length, n: out.length }),
          body: bad.length ? lines(bad.map((n) => tr("line", { name: n.title, why: n.body })), 5, (k) => tr("more", { n: k })) : sync ? tr("rebased") : tr("branchesKept"),
          timeout: bad.length ? 10000 : 5000 });
        this.multi.clear();
      }
      this.refresh(cx, false);
      cx.notify();
    });
  }

  async sync(p) {
    const r = await sh("gwm", ["sync"], { cwd: p.path, timeout: 180e3 });
    return r.code === 0
      ? { level: "success", title: tr("synced", { name: p.name }), body: lastLine(r.stdout) }
      : { level: "error", title: tr("syncFailed", { name: p.name }), body: lastLine(r.stderr || r.stdout) || tr("failedCode", { cmd: "gwm sync", code: r.code }) };
  }

  async remove(p) {
    // Fresh state: changes or an agent may have shown up since the dialog opened.
    const got = await this.list(p.repo, false);
    const rows = got.rows.map((w) => ({ ...w, path: trim(w.path) }));
    const w = rows.find((x) => x.path === p.path);
    if (!w) return { level: "error", title: tr("removeCancelled"), body: tr("gone", { name: p.name }) };
    const why = this.refusal(w);
    if (why) return { level: "warning", title: tr("removeRefused"), body: tr("refuseBody", { name: w.name, why }) };
    const main = rows.find((x) => x.is_main)?.path ?? p.repo.folder;
    // gwm resolves its target by name or id: its plan must name this very path.
    const dry = await sh("gwm", ["remove", w.id, "--dry-run"], { cwd: main });
    const planned = trim(dry.stdout.match(/^\s*path:\s+(.+)$/m)?.[1]?.trim());
    if (dry.code !== 0 || planned !== w.path)
      return { level: "error", title: tr("removeCancelled"), body: tr("notTargeted", { path: tilde(w.path), last: lastLine(dry.stderr || dry.stdout) }) };
    const r = await sh("gwm", ["remove", w.id], { cwd: main, timeout: 120e3 });
    return r.code === 0
      ? { level: "success", title: tr("removed", { name: w.name }), body: tr("branchKept", { branch: w.branch ?? "—" }) }
      : { level: "error", title: tr("removeFailed", { name: w.name }), body: lastLine(r.stderr || r.stdout) || tr("failedCode", { cmd: "gwm remove", code: r.code }) };
  }

  // ---------- pieces ----------

  box(t) {
    return v_flex().min_h(0).rounded(16).border(1).border_color(t.border).bg(t.background);
  }

  eyebrow(t, text, color) {
    return div().font_family(MONO).text_size(11).text_color(color ?? t.muted).child(String(text).toUpperCase());
  }

  tag(t, color, text) {
    return h_flex().flex_none().h(20).px(8).items_center().rounded_full().border(1).border_color(alpha(color, "4d")).bg(alpha(color, "1a"))
      .text_color(color).font_family(MONO).text_size(10.5).child(String(text).toUpperCase());
  }

  dashed(t) {
    return div().flex_none().h(0).border_t(1).border_dashed().border_color(t.border);
  }

  empty(t, text, color) {
    return div().px(16).py(12).text_size(13).text_color(color ?? t.dim).child(text);
  }

  chip(t, id, label, on, onClick) {
    return h_flex().id(id).flex_none().h(26).px(11).items_center().rounded_full().border(1)
      .border_color(on ? alpha(t.accent, "66") : t.border)
      .when(on, (el) => el.bg(alpha(t.accent, "24")))
      .when(!on, (el) => el.hover((s) => s.bg(t.hover).text_color(t.foreground)))
      .text_size(12).text_color(on ? t.foreground : t.muted).cursor_pointer()
      .on_click((_e, cx) => { onClick(cx); cx.notify(); })
      .child(label);
  }

  pill(t, id, label, icon, primary, onClick) {
    return h_flex().id(id).flex_none().h(30).px(13).gap(6).items_center().rounded_full().border(1)
      .border_color(primary ? t.solid : t.border).bg(primary ? t.solid : t.background)
      .text_size(12.5).font_medium().text_color(primary ? t.solid_foreground : t.foreground)
      .cursor_pointer().hover((s) => (primary ? s.opacity(0.88) : s.bg(t.hover)))
      .on_click((_e, cx) => { onClick(cx); cx.notify(); })
      .when(Boolean(icon), (el) => el.child(svg(icon).size(13)))
      .child(label);
  }

  // A card's action (or the panel's): disabled while one runs.
  mini(t, id, icon, label, onClick, danger) {
    const off = Boolean(this.busy);
    return h_flex().id(id).flex_none().h(26).px(10).gap(6).items_center().rounded_full().border(1).border_color(t.border).bg(t.background)
      .text_size(12).text_color(danger ? t.ansi1 : t.foreground)
      .when(off, (el) => el.opacity(0.45))
      .when(!off, (el) => el.cursor_pointer().hover((s) => s.bg(danger ? alpha(t.ansi1, "1a") : t.hover)))
      .on_click((_e, cx) => { cx.stop_propagation(); if (!this.busy) onClick(cx); cx.notify(); })
      .child(svg(icon).size(12))
      .child(label);
  }

  iconButton(t, id, icon, onClick, spinning) {
    return h_flex().id(id).flex_none().size(28).items_center().justify_center().rounded_full().text_color(t.muted)
      .cursor_pointer().hover((s) => s.bg(t.hover).text_color(t.foreground))
      .on_click((_e, cx) => { cx.stop_propagation(); onClick(cx); cx.notify(); })
      .child(svg(icon).size(13).when(Boolean(spinning), (el) => el.spin(900)));
  }

  // A card's selection box (select.js): drawn on hover or once a card is selected, its room always
  // kept so the card never moves; a click toggles the card, as ⌘-click does.
  check(t, id, on, shown, onClick) {
    return div().id(id).size(16).flex_none().rounded(5).border(1).flex().items_center().justify_center()
      .when(!shown, (el) => el.border_color(alpha(t.input, "00")))
      .when(shown, (el) => el.border_color(on ? t.accent : t.input).bg(on ? t.accent : t.background).cursor_pointer()
        .hover((s) => s.border_color(t.accent))
        .on_click((_e, cx) => { cx.stop_propagation(); onClick(); cx.notify(); }))
      .when(on, (el) => el.child(svg(I("check")).size(11).text_color(t.accent_foreground)));
  }

  // The bulk bar (select.js): floats over the list's foot while cards are selected: how many, the
  // actions ([id, label, icon, onClick, danger]) or the running one, ✕ to empty. A card (radius 12,
  // shadow), its buttons 4 px in: 8.
  bulkBar(t, n, actions, progress) {
    // It fades in and rises 6 px when a first card is selected (motion.js).
    // Narrow, its buttons wrap rather than leave the list.
    return h_flex().absolute().bottom(12).left(0).right(0).px(8).justify_center()
      .child(enter(this.m, div().max_w_full(), "kg-bulk-in").child(h_flex().id("kg-bulk").max_w_full().flex_wrap().p(4).gap(2).items_center().rounded(12).border(1).border_color(t.border).bg(t.popover).shadow_lg()
        .on_mouse_down("left", (_e, cx) => cx.stop_propagation())
        .child(div().pl(10).pr(8).font_family(MONO).text_size(11).text_color(t.foreground).child(rollText(this.m, "kg-sel-n", tr("selected", { n }), 15)))
        .child(div().w(1).h(18).flex_none().bg(t.border))
        .when(Boolean(progress), (el) => el.child(h_flex().h(28).px(10).gap(6).items_center().text_size(12).text_color(t.muted)
          .child(svg(I("refresh-cw")).size(13).spin(900))
          // viz.js' bar is ~39 px (its label on a 16 px line, 2, its cells in their 6 px glow): held in the
          // buttons' 28 px, 3 px up, so the bar keeps its height; only the bottom glow runs into the padding.
          .child(typeof progress === "string" ? progress : div().h(28).flex_none().line_height("16px").child(div().mt(-3).child(progress)))))
        .when(!progress, (el) => el.children(actions.map(([id, label, icon, onClick, danger]) => h_flex().id(`kg-bulk-${id}`).h(28).px(10).gap(6).items_center().rounded(8)
          .text_size(12).text_color(danger ? t.ansi1 : t.foreground).cursor_pointer().hover((s) => s.bg(danger ? alpha(t.ansi1, "1a") : t.hover))
          .on_click((_e, cx) => { onClick(cx); cx.notify(); })
          .child(svg(icon).size(13)).child(label))))
        .child(h_flex().id("kg-bulk-clear").size(28).flex_none().items_center().justify_center().rounded(8).text_color(t.muted)
          .cursor_pointer().hover((s) => s.bg(t.hover).text_color(t.foreground)).tooltip(tr("clearSelection"))
          .on_click((_e, cx) => { this.multi.clear(); cx.notify(); })
          .child(svg(I("x")).size(13)))));
  }

  // The panel's card: the band of the project's color behind its head (DESIGN-REFERENCE.md).
  panelBox(t, repo) {
    return this.box(t).id("kg-p-box").relative().flex_1()
      .on_size_change((s, cx) => { if (s.width !== this.panelW) { this.panelW = s.width; cx.notify(); } })
      .children([dither(this.panelW, 60, 16, this.projectColor(t, repo))].filter(Boolean));
  }

  // The bar's actions on the selected worktrees (hidden by the filter or not), in list order.
  bulk(t) {
    const picked = this.multi.pick(this.stops(true), (s) => s.id);
    this.bulkActions = null;
    if (!picked.length) return null;
    this.bulkActions = [
      ["open", tr("open"), G("enter"), () => { for (const s of picked) this.openSpace(s.d, s.w); }],
      ["copy", tr("copyPaths"), G("copy"), (cx) => {
        cx.write_to_clipboard(picked.map((s) => s.w.path).join("\n"));
        notify({ title: tr("pathsCopied", { n: picked.length }), body: tr("onePerLine"), level: "success", timeout: 2500 });
      }],
      ["sync", "Sync", G("sync"), () => this.askBulk("sync", picked)], // i18n: tech
      ["remove", tr("remove"), G("trash"), () => this.askBulk("remove", picked), true],
    ];
    // A bulk action: i done of n as viz.js' bar under its bare label (the spinner says it runs; 160 px
    // cut « Suppression en cours… »), « i+1 / n » the one running; a single one: its words.
    const b = this.busy;
    return this.bulkBar(t, picked.length, this.bulkActions, b && (!b.n ? tr("running", { what: b.label })
      : viz(t, this.m, { roll }).progress(b.what, b.i, { max: b.n, width: 160, figure: `${b.i + 1} / ${b.n}`, id: "kg-bulk-p", live: true })));
  }

  // Where the data came from: the daemon (done) or the CLI (warning).
  source(t, sources) {
    if (!sources.size) return null;
    const label = [...sources].sort().join(" + ");
    const color = sources.has("cli") ? t.ansi3 : t.done;
    return h_flex().flex_none().h(20).px(8).gap(6).items_center().rounded_full().border(1).border_color(t.border)
      .font_family(MONO).text_size(10.5).text_color(t.muted)
      .child(div().size(6).rounded_full().bg(color)).child(label);
  }

  // The GitHub icon beside a link: the only way to the browser.
  github(t, id, repo, kind, x, size = 22) {
    return h_flex().id(id).flex_none().size(size).items_center().justify_center().rounded_full().text_color(t.dim)
      .cursor_pointer().hover((s) => s.bg(t.hover).text_color(t.foreground)).tooltip(tr("openGithub"))
      .on_click((_e, cx) => { cx.stop_propagation(); this.onGitHub(repo, kind, x); })
      .child(svg(G("github")).size(12));
  }

  // A linked issue / PR pill: opens it in the Inbox; the GitHub icon beside it, in the browser.
  link(t, id, repo, kind, x) {
    const lk = look(kind, x.state);
    const color = t[lk.color];
    return h_flex().flex_none().gap(2).items_center()
      .child(h_flex().id(id).flex_none().h(20).px(8).gap(5).items_center().rounded_full().border(1).border_color(alpha(color, "4d")).bg(alpha(color, "1a"))
        .text_color(color).font_family(MONO).text_size(10.5)
        .cursor_pointer().hover((s) => s.bg(alpha(color, "33"))).tooltip(tr("openInbox"))
        .on_click((_e, cx) => { cx.stop_propagation(); this.inInbox(repo, kind, x); })
        .child(svg(I(lk.icon)).size(11))
        .child(`${kind === "pr" ? "PR " : ""}#${x.number}${lk.label ? ` · ${lk.label}` : ""}`)
        .when(kind === "pr" && x.checks_total > 0, (el) => el.child(div().text_color(x.checks_passed === x.checks_total ? t.done : t.ansi3).child(`${x.checks_passed}/${x.checks_total}`))))
      .when(Boolean(x.url || repo.slug), (el) => el.child(this.github(t, `${id}-gh`, repo, kind, x)));
  }

  // One chip per agent kind: its tile, how many sessions, pinned, an active one.
  agentChips(t, w, d) {
    const sessions = w.agents?.sessions ?? [];
    const pins = new Set(d?.pins?.[w.branch] ?? []);
    return [...new Set(sessions.map((s) => s.kind))].map((k) => {
      const mine = sessions.filter((s) => s.kind === k);
      const active = mine.some((s) => s.freshness === "active");
      return h_flex().flex_none().h(22).pl(2).pr(7).gap(5).items_center().rounded_full().border(1)
        .border_color(active ? alpha(t.working, "66") : t.border)
        .child(tile(t, this.programs[KIND[k] ?? k], k, 16))
        .child(div().font_family(MONO).text_size(10.5).text_color(active ? t.foreground : t.muted).child(String(mine.length)))
        .when(mine.some((s) => pins.has(s.id)), (el) => el.child(svg(I("pin")).size(10).text_color(t.accent)))
        .when(active, (el) => el.child(div().size(6).rounded_full().bg(t.working)));
    });
  }

  // Dirty, ahead/behind, lock: the git state pills. `id`: a panel's (one worktree), its ahead / behind
  // roll (roll.js); the list's rows (up to every worktree) leave it out and stay still.
  marks(t, w, clean, id = null) {
    const s = w.status ?? {};
    const out = [];
    const count = (key, text) => (id ? roll(this.m, `${id}-${key}`, text, 14) : text);
    if (s.is_dirty) out.push(this.tag(t, t.ansi3, tr("mark.dirty")));
    else if (clean && !s.unknown) out.push(this.tag(t, t.done, tr("mark.clean")));
    if (s.ahead || s.behind)
      out.push(h_flex().flex_none().h(20).px(8).gap(6).items_center().rounded_full().border(1).border_color(t.border).font_family(MONO).text_size(10.5)
        .when(s.ahead > 0, (el) => el.child(div().text_color(t.ansi2).child(count("ahead", `↑${s.ahead}`))))
        .when(s.behind > 0, (el) => el.child(div().text_color(t.ansi3).child(count("behind", `↓${s.behind}`)))));
    if (s.unknown) out.push(this.tag(t, t.dim, tr("mark.unknown")));
    if (w.is_locked) out.push(this.tag(t, t.dim, tr("mark.locked")));
    if (w.is_prunable) out.push(this.tag(t, t.ansi1, tr("mark.orphan")));
    return out;
  }

  links(w) {
    const st = this.st[`${w.path}|${w.branch}`]?.data;
    return {
      issue: st?.issue ?? (w.issue ? { number: w.issue } : null),
      pr: st?.pr ?? (w.pr ? { number: w.pr } : null),
    };
  }

  // ---------- page ----------

  // The filter's matches: name, branch, path, issue, PR, note; then the state row's (wf).
  matches(w) {
    const q = this.query.trim().toLowerCase();
    return (!q || `${w.name} ${w.branch ?? ""} ${tilde(w.path)} #${w.issue ?? ""} #${w.pr ?? ""} ${w.note ?? ""}`.toLowerCase().includes(q))
      && (!this.wf || this.wstate(w, this.wf));
  }

  // The state row's filters (FILTERS.md's tints): changes, an open or draft PR, a merged one, an active agent.
  wstate(w, k) {
    const pr = String(this.links(w).pr?.state ?? "").toUpperCase();
    if (k === "dirty") return Boolean(w.status?.is_dirty);
    if (k === "pr-open") return pr === "OPEN" || pr === "DRAFT";
    if (k === "pr-merged") return pr === "MERGED";
    if (k === "agent") return (w.agents?.sessions ?? []).some((s) => s.freshness === "active");
    return true;
  }

  // The card's Copier, and y on the cursor.
  copyPath(w, cx) {
    cx.write_to_clipboard(w.path);
    notify({ title: tr("pathCopied"), body: tilde(w.path), level: "success", timeout: 2500 });
  }

  // ---------- keys (vim.js; kt-keys lists them) ----------

  // The keyboard comes here (pane.go, a key command): NORMAL, the cursor kept, else the shown
  // thread's worktree (page), else the first.
  focusIn() {
    this.handle.focus();
    this.vim.normal();
    const stops = this.stops();
    if (!stops.some((s) => s.id === this.cur)) this.cur = stops.find((s) => s.here)?.id ?? null;
    this.reveal = true;
  }

  // The page shown (ctrl-b shift-o, the sidebar): the keyboard in NORMAL, so j moves and / types (#78:
  // it came in INSERT, and a first j filtered the cards), unless pane.go or a key command gave it.
  arrive() {
    if (this.visible() && !this.handle.is_focused()) this.focusIn();
  }

  // A click on a card or a line: the keys' cursor goes there, and the keyboard, in NORMAL (#78).
  pick(id) {
    this.cur = id;
    this.vim.normal();
    this.handle.focus();
  }

  // What the cursor walks, in order. Page: each card shown ({ id: path, repo, d, w, here }); `all`:
  // the filter's misses too (the bulk bar acts on a selection the filter may hide).
  // Panel: a linked worktree's issue and PR lines ({ id, kind, x, repo, d, w }), else the repo's
  // linked worktrees ({ id: path, repo, d, w }).
  stops(all = false) {
    const sc = this.sc ?? { kind: "wait" };
    if (this.panel) {
      const d = sc.kind === "repo" ? this.data[sc.repo.common] : null;
      if (!d) return [];
      const w = enclosing(d.rows, sc.cwd);
      if (w && !w.is_main) {
        const { issue, pr } = this.links(w);
        return [issue && { id: "issue", kind: "issue", x: issue }, pr && { id: "pr", kind: "pr", x: pr }]
          .filter(Boolean).map((s) => ({ ...s, repo: sc.repo, d, w }));
      }
      return d.rows.filter((x) => !x.is_main).slice(0, 8).map((x) => ({ id: x.path, repo: sc.repo, d, w: x }));
    }
    const groups = sc.kind === "repo" ? [sc.repo] : sc.kind === "workspace" ? sc.repos : [];
    const cwd = threadCwd();
    return groups.flatMap((r) => {
      const d = this.data[r.common];
      const here = d ? enclosing(d.rows, cwd) : null;
      return (d?.rows ?? []).filter((w) => all || (this.matches(w) && (!isAgent(w) || this.agentOpen.has(r.common))))
        .sort((a, b) => isAgent(a) - isAgent(b)) // as drawn: the agent ones after the fold
        .map((w) => ({ id: w.path, repo: r, d, w, here: w === here }));
    });
  }

  key(e, cx) {
    if (!this.press(e, cx)) return; // not ours: ctrl-b, cmd-* go on
    cx.stop_propagation();
    cx.notify();
  }

  // One key (an event, or a name from `kt-gwm.key:`): on the page, the selection's first (select.js,
  // NORMAL only: x space V ctrl-a esc), then vim's; a visual range then follows the cursor.
  press(k, cx) {
    const cur = () => { const stops = this.stops(); return (stops.find((s) => s.id === this.cur) ?? stops[0])?.id ?? null; };
    const order = () => this.stops().map((s) => s.id);
    if (!this.panel && !this.vim.insert && this.multi.key(keyOf(k).name, cur(), order())) {
      this.vim.normal(); // a `d` or a count typed before it is dropped
      return true;
    }
    if (!this.keyAct(this.vim.handle(k), cx)) return false;
    if (!this.panel && this.multi.visual) this.multi.follow(cur(), order());
    return true;
  }

  // One vim action; false: not one this view has, and the key goes on.
  keyAct(a, cx) {
    if (!a) return false;
    if (a === "pending" || a === "count" || a === "filter" || a === "normal") return true;
    const stops = this.stops();
    const s = stops.find((x) => x.id === this.cur) ?? stops[0] ?? null;
    const i = stops.indexOf(s);
    if (a === "type" || a === "backspace") {
      this.query = a === "type" ? this.query + this.vim.char : this.query.slice(0, -1);
      this.cur = null;
    } else if (["down", "up", "top", "bottom", "half-down", "half-up", "next", "prev"].includes(a)) {
      // k stops on the first card (#78: climbing into the filter in INSERT made the next j type there).
      const j = step(a === "next" ? "down" : a === "prev" ? "up" : a, i, stops.length, this.vim.count, 8);
      if (j >= 0) this.cur = stops[j].id;
      this.reveal = true;
    } else if (a === "tab-next" || a === "tab-prev") {
      // The next (previous) repo's first card (Global's groups); one repo: nothing to do.
      if (this.panel) return false;
      const groups = [...new Set(stops.map((x) => x.repo.common))];
      const g = groups.indexOf(s?.repo.common);
      const to = groups[a === "tab-next" ? Math.min(groups.length - 1, g + 1) : Math.max(0, g - 1)];
      const first = to !== s?.repo.common && stops.find((x) => x.repo.common === to);
      if (first) {
        this.cur = first.id;
        this.reveal = true;
      }
    } else if (a === "open" || a === "right" || a === "submit") {
      if (s?.kind) this.inInbox(s.repo, s.kind, s.x);
      else if (s) this.openSpace(s.d, s.w);
    } else if (a === "open-alt") {
      // The browser: the line's issue or PR; a worktree's PR, else its issue.
      const { issue, pr } = s && !s.kind ? this.links(s.w) : {};
      const kind = s?.kind ?? (pr ? "pr" : issue ? "issue" : null);
      if (kind) this.onGitHub(s.repo, kind, s.x ?? pr ?? issue);
    } else if (a === "yank") { if (s) this.copyPath(s.w, cx); }
    else if (a === "delete") { if (s && !s.kind) this.askRemove(s.repo, s.w); }
    else if (a === "refresh") this.refresh(cx, true);
    else if (a === "panel-prev" || a === "panel-next") {
      if (!this.panel) return false;
      const k = PANEL_TABS.findIndex(([c]) => c === PANEL);
      const [child, mod] = PANEL_TABS[(k + (a === "panel-next" ? 1 : PANEL_TABS.length - 1)) % PANEL_TABS.length];
      run("layout.select", { stack: "panel-body", child });
      // A moment later: sent at once, the new tab isn't shown yet and no copy gets it.
      cx.timer.after(120, () => run(`${mod}.focus`));
    } else if (a === "escape" && this.query) {
      this.query = "";
      this.cur = null;
    } else if (a === "escape" || a === "quit") {
      if (this.panel) run("pane.go", { direction: "left" });
      else show("thread");
    } else if (a === "help") openOverlay({ mod: "kt-keys", kind: "dialog", width: 1, height: 1, frame: "none", props: { group: this.panel ? "panel" : "pages" } });
    else return false;
    return true;
  }

  // NORMAL / INSERT (kt-keys' pill), mono 9 px, while the page has the keyboard.
  mode(t, typing) {
    return div().flex_none().h(16).px(6).flex().items_center().rounded(5).border(1)
      .border_color(typing ? alpha(t.accent, "66") : t.border).bg(typing ? alpha(t.accent, "24") : t.background)
      .font_family(MONO).text_size(9).text_color(typing ? t.accent : t.muted).child(this.vim.label);
  }

  // `cursor`: "ring" (NORMAL: a 1 px accent ring with the ink), "mark" (INSERT: ctrl-n/p's card) or null.
  // `gone`: closing (rows() gave it -1), drawn as it was but no longer a target and asking for nothing.
  card(t, repo, d, w, here, cx, cursor, gone = false) {
    if (cx && !gone) this.statusOf(w, cx);
    const { issue, pr } = this.links(w);
    const hot = !gone && this.hot === w.path;
    const busy = this.busy?.path === w.path;
    const note = (w.note ?? "").split("\n").map((l) => l.replace(/^#+\s*/, "").trim()).find(Boolean) ?? "";
    const top = w.agents?.top;
    const actions = [
      this.mini(t, `kg-open-${w.path}`, G("enter"), tr("open"), () => this.openSpace(d, w)),
      issue && this.mini(t, `kg-issue-${w.path}`, I("circle-dashed"), "Issue", () => this.inInbox(repo, "issue", issue)), // i18n: tech
      pr && this.mini(t, `kg-pr-${w.path}`, I("git-pull-request"), "PR", () => this.inInbox(repo, "pr", pr)),
      this.mini(t, `kg-copy-${w.path}`, G("copy"), tr("copy"), (cx) => this.copyPath(w, cx)),
      this.mini(t, `kg-sync-${w.path}`, G("sync"), "Sync", () => this.askSync(w)), // i18n: tech
      !w.is_main && this.mini(t, `kg-rm-${w.path}`, G("trash"), tr("remove"), () => this.askRemove(repo, w), true),
    ].filter(Boolean);
    // A card (radius 16) on the page; the shown thread's worktree carries the ink; a selected one a
    // lighter ink and its box checked. A plain click on it only empties the selection.
    const picked = this.multi.has(w.path);
    return v_flex().id(`kg-card-${w.path}`).flex_none().rounded(16).border(1)
      .border_color(cursor === "ring" ? alpha(t.accent, "99") : here ? alpha(t.accent, "66") : t.border)
      .bg(cursor === "ring" ? alpha(t.accent, "24") : picked ? alpha(t.accent, "14") : cursor === "mark" ? t.hover : t.background)
      .when(!gone, (el) => el
        .on_hover((on, cx) => {
          const next = on ? w.path : this.hot === w.path ? null : this.hot;
          if (next !== this.hot) { this.hot = next; cx.notify(); }
        })
        .on_click((e, cx) => {
          this.pick(w.path);
          this.multi.click(e.modifiers, w.path, this.stops().map((s) => s.id));
          cx.notify();
        }))
      .child(v_flex().pl(10).pr(14).py(10).gap(6).rounded(16).when(here, (el) => el.bg(alpha(t.accent, "1a")))
        .child(h_flex().h(22).gap(8).items_center()
          .child(this.check(t, `kg-check-${w.path}`, picked, !gone && (picked || hot || this.multi.size > 0), () => this.multi.toggle(w.path)))
          // The project's logo (16 px); the main checkout says so with a tag.
          .child(this.mark(t, repo, 16))
          .child(div().flex_none().max_w(320).truncate().text_size(13.5).font_medium().text_color(t.foreground).child(w.name))
          .child(div().min_w(0).truncate().font_family(MONO).text_size(11.5).text_color(here ? t.accent : t.muted)
            .child(branchOf(w)))
          .when(isAgent(w), (el) => el.child(this.tag(t, t.accent, "agent"))) // i18n: tech
          .when(Boolean(w.is_main), (el) => el.child(this.tag(t, t.dim, tr("main"))))
          // gwm's note (kt-notes): gwm list leaves `note` out when the branch carries none.
          .when(Boolean(w.note), (el) => el.child(this.tag(t, t.ansi3, tr("note"))))
          .child(div().flex_1())
          .children(this.marks(t, w, false))
          .when(Boolean(issue), (el) => el.child(this.link(t, `kg-li-${w.path}`, repo, "issue", issue)))
          .when(Boolean(pr), (el) => el.child(this.link(t, `kg-lp-${w.path}`, repo, "pr", pr)))
          .children(this.agentChips(t, w, d)))
        // Under the icon: the box's room (16) and its gap (8).
        .child(h_flex().h(26).pl(24).gap(8).items_center()
          .child(div().flex_none().max_w(420).truncate().font_family(MONO).text_size(11).text_color(t.dim).child(tilde(w.path)))
          .when(Boolean(note), (el) => el.child(div().flex_none().text_color(t.dim).child("·"))
            .child(div().min_w(0).truncate().text_size(12).text_color(t.dim).child(note)))
          .child(div().flex_1())
          .when(busy, (el) => el.child(h_flex().flex_none().gap(6).items_center().text_size(12).text_color(t.muted)
            .child(svg(I("refresh-cw")).size(12).spin(900)).child(tr("running", { what: this.busy.label }))))
          .when(!busy && hot, (el) => el.child(h_flex().flex_none().gap(5).items_center().children(actions)))
          .when(!busy && !hot && Boolean(top), (el) => el.child(div().flex_none().font_family(MONO).text_size(11).text_color(t.dim)
            .child(`${KIND_NAME[top.kind] ?? top.kind} · ${ago(top.last_activity)}`)))));
  }

  // The fold of a repo's agent worktrees (claude/*): how many, open or not, and Nettoyer (the merged
  // and clean ones, through the bulk remove's guard).
  agentFold(t, r, d, n) {
    const open = this.agentOpen.has(r.common);
    return h_flex().id(`kg-agents-${r.common}`).flex_none().h(36).px(14).gap(8).items_center().rounded(16).border(1).border_dashed().border_color(t.border)
      .text_size(12.5).text_color(t.muted).cursor_pointer().hover((s) => s.bg(t.hover).text_color(t.foreground))
      .on_click((_e, cx) => { if (open) this.agentOpen.delete(r.common); else this.agentOpen.add(r.common); cx.notify(); })
      .child(svg(I(open ? "chevron-down" : "chevron-right")).size(13).flex_none())
      .child(this.tag(t, t.accent, "agent")) // i18n: tech
      .child(div().flex_1().min_w(0).truncate().child(tr("agentWorktrees", { n })))
      .child(this.mini(t, `kg-clean-agents-${r.common}`, G("trash"), tr("cleanUp"), (cx) => this.cleanAgents(r, d, cx), true));
  }

  // A repo's entry in the projects registry (shared "kt.projects"): by folder (its main checkout's
  // toplevel), else by the repo's name.
  projectOf(repo) {
    const reg = (shared("kt.projects") ?? []).filter((x) => !x.machine);
    return reg.find((x) => x.folder && [repo.main, repo.folder].includes(trim(x.folder))) ?? reg.find((x) => x.name === repo.name) ?? null;
  }

  // Its color (a theme color name or #hex), else Worktrees' ansi2 (DESIGN-REFERENCE.md).
  projectColor(t, repo) {
    const c = this.projectOf(repo)?.color;
    return (c && (String(c).startsWith("#") ? c : t[c])) || t.ansi2;
  }

  // Its mark, `size` px: the logo 1:1 in a rounded tile; without one, its initial on the logos' dithered
  // background of its color (projtile.js); home (~) the house. 20 px on a repo's head, 16 on a card, 32 in a band.
  mark(t, repo, size) {
    const r = Math.max(3, Math.round(size / 4));
    if (trim(repo.main ?? repo.folder) === trim(home()))
      return div().size(size).flex_none().rounded(r).bg(t.raised).flex().items_center().justify_center().child(svg(I("house")).size(Math.round(size * 0.6)).text_color(t.muted));
    const e = this.projectOf(repo);
    const logo = logoOf(e);
    if (logo) return div().size(size).flex_none().rounded(r).overflow_hidden().child(image(logo).size(size));
    return projTile(this.tiles, { color: this.projectColor(t, repo), size,
      letter: div().text_size(Math.round(size * 0.55)).font_semibold().text_color(LETTER).child([...(e?.name || repo.name || "?")][0].toUpperCase()) }); // || : an empty name too
  }

  // The head's ⋯: the rest of the page's actions.
  moreItems() {
    const { sc } = this.moreFor ?? {};
    const d = sc?.kind === "repo" ? this.data[sc.repo.common] : null;
    return [
      ["kg-mi-new", I("plus"), tr("newWorktreeKey"), () => run("mod.open", { name: "kt-new" })],
      (sc?.kind === "repo" || sc?.inRepo) && ["kg-mi-global", I("layers"), this.global ? tr("backToRepo") : tr("globalView"), () => { this.global = !this.global; }],
      d?.rows.some(isAgent) && ["kg-mi-clean", G("trash"), tr("cleanAgents"), (cx) => this.cleanAgents(sc.repo, d, cx)],
      ["kg-mi-keys", I("keyboard"), tr("keys"), () => openOverlay({ mod: "kt-keys", kind: "dialog", width: 1, height: 1, frame: "none", props: { group: "pages" } })],
    ];
  }

  groupHead(t, r, d, n) {
    return h_flex().flex_none().h(28).px(8).pt(6).gap(8).items_center()
      .child(this.mark(t, r, 20))
      .child(this.eyebrow(t, r.name, t.foreground))
      .child(div().flex_none().font_family(MONO).text_size(11).text_color(t.dim).child(String(n)))
      .child(this.source(t, new Set(d?.source ? [d.source] : [])) ?? div());
  }

  // `ask`: render's cx on a shown copy (status, clean), else null; `cx`: render's, for rows().
  pageView(t, sc, ask, cx) {
    const groups = sc.kind === "repo" ? [sc.repo] : sc.kind === "workspace" ? sc.repos : [];
    const cwd = threadCwd();
    const total = groups.reduce((n, r) => n + (this.data[r.common]?.rows.length ?? 0), 0);
    const sources = new Set(groups.map((r) => this.data[r.common]?.source).filter(Boolean));
    const loading = groups.some((r) => this.inflight[`l:${r.common}`]);
    // The keys' cursor, while the page has the keyboard: its card, brought into view once after it moved.
    const typing = this.keyed && this.vim.insert;
    const stops = this.keyed ? this.stops() : [];
    const cur = (stops.find((s) => s.id === this.cur) ?? stops[0])?.id;
    // Before a repo's first read (or the scope's): cards in the shape of the worktrees' (skeleton.js),
    // breathing; then the list fades in over them, its cards at rest (still(): no opening from 0).
    const S = skeleton(t, this.m);
    const waiting = sc.kind === "wait" || groups.some((r) => !this.data[r.common]);
    const mm = S.arriving("kg-list") ? still(this.m) : this.m;
    const list = [];
    let shown = 0;
    for (const r of groups) {
      const d = this.data[r.common];
      const rows = (d?.rows ?? []).filter((w) => this.matches(w));
      shown += rows.length;
      if (sc.kind === "workspace" && (rows.length || d?.error)) list.push(this.groupHead(t, r, d, rows.length));
      if (d?.error) list.push(this.empty(t, tr("line", { name: r.name, why: d.error }), t.ansi1));
      const here = d ? enclosing(d.rows, cwd) : null;
      // The cards open and close on their height, in order (motion.js rows(), keyed by path); a repo
      // gone whole (head too) goes at once. A card shown means no "none" box above the list: `at`, the
      // list's index, counts the cards as rows() builds them, the closing ones included.
      const put = (id, ws) => {
        let at = list.length;
        list.push(...rowsOf(mm, cx, id, ws, (w) => w.path, (w, i) => {
          if (i >= 0 && this.reveal && w.path === cur) {
            this.scroll.scroll_to_item(at);
            this.reveal = false;
          }
          at++;
          return this.card(t, r, d, w, w === here, ask, i >= 0 && w.path === cur ? (typing ? "mark" : "ring") : null, i < 0);
        }));
      };
      // Issue worktrees first; Claude Code's own (claude/*: subagents, --worktree, background
      // sessions) after them, behind one fold, folded until opened (none: they close).
      put(`kg-wt-${r.common}`, rows.filter((w) => !isAgent(w)));
      const agents = rows.filter(isAgent);
      if (agents.length) {
        list.push(this.agentFold(t, r, d, agents.length));
        put(`kg-ag-${r.common}`, this.agentOpen.has(r.common) ? agents : []);
      }
    }
    const label = sc.kind === "repo" ? sc.repo.name : sc.kind === "wait" ? "…" : "Global"; // i18n: tech
    // DESIGN-REFERENCE.md's head: the band on the dither of the project's color (Global: ansi2).
    const color = sc.kind === "repo" ? this.projectColor(t, sc.repo) : t.ansi2;
    // In the rolling counts' ids: another repo's (or Global's) counts show at once, not rolling.
    const scopeKey = sc.kind === "repo" ? sc.repo.main ?? sc.repo.folder : sc.kind;
    this.moreFor = { sc, color };
    const head = this.box(t).id("kg-head").relative().flex_none().px(4).pb(12).gap(10)
      .on_size_change((s, cx) => { if (s.width !== this.headW) { this.headW = s.width; cx.notify(); } })
      .children([dither(this.headW, 60, 16, color)].filter(Boolean))
      .child(bandRow(t, { m: this.m, color, icon: I("git-branch"), mark: sc.kind === "repo" ? this.mark(t, sc.repo, 32) : null,
        title: sc.kind === "repo" ? label : sc.kind === "wait" ? "Worktrees" : "Worktrees · Global", // i18n: tech
        sub: [rollText(this.m, `kg-head-n-${scopeKey}`, tr("worktrees", { n: total }), 14), [...sources].sort().join(" + "), sc.kind === "repo" ? tilde(sc.repo.main ?? sc.repo.folder) : tr("allProjects")],
        buttons: [
          iconBtn(t, "kg-b-new", I("plus"), tr("newWorktreeKey"), () => run("mod.open", { name: "kt-new" })),
          pulse(this.m, iconBtn(t, "kg-b-refresh", I("refresh-cw"), tr("refresh"), (cx) => this.refresh(cx, true), this.spinning > 0), this.spinning > 0),
          iconBtn(t, "kg-b-more", "mods/kt-crosstalk/ellipsis.svg", tr("moreTip"), () => { this.more = !this.more; }, this.more)] }))
      .child(div().flex_none().mx(-4).h(0).border_t(1).border_dashed().border_color(alpha(color, "4d")))
      // The filter: the keys' ring (and the ink) while typing in it; the mode beside it.
      .child(h_flex().px(8).gap(8).items_center()
        .child(h_flex().id("kg-filter").flex_1().min_w(0).h(34).px(13).gap(8).items_center().rounded_full().border(1)
          .border_color(typing ? alpha(t.accent, "99") : t.border).when(typing, (el) => el.bg(alpha(t.accent, "24"))).cursor_text()
          .track_focus(this.handle)
          .on_key_down((e, cx) => this.key(e, cx))
          // A press, not on_click: on the element holding the keyboard, GPUI turns Space and Enter into a click.
          .on_mouse_down("left", (_e, cx) => { this.vim.edit(); this.handle.focus(); cx.notify(); })
          .child(svg(I("search")).size(14).flex_none().text_color(t.dim))
          .child(div().flex_1().min_w(0).truncate().text_size(13).text_color(this.query ? t.foreground : t.dim)
            .child(this.query ? this.query + (typing ? "▏" : "") : typing ? "▏" : tr("filter")))
          .when(Boolean(this.query), (el) => el.child(div().id("kg-clear").flex_none().text_color(t.dim).cursor_pointer().hover((s) => s.text_color(t.foreground))
            .on_mouse_down("left", (_e, cx) => { cx.stop_propagation(); this.handle.focus(); }) // not the field's press: × keeps the mode
            .on_click((_e, cx) => { cx.stop_propagation(); this.query = ""; this.cur = null; cx.notify(); })
            .child(svg(I("x")).size(13)))))
        .when(Boolean(this.keyed), (el) => el.child(this.mode(t, typing))))
      // The state row (filters.js): every worktree, or those with changes, a PR open / merged, an agent at work.
      .child(div().px(8).child(filterRow({ id: "kg-states", t, state: this.wfRow, active: this.wf ?? "all", reduced: Boolean(shared("kt.reducedMotion")), scope: scopeKey,
        items: [["all"], ["dirty", "ansi3"], ["pr-open", "ansi2"], ["pr-merged", "ansi5"], ["agent", "working"]]
          .map(([key, tint]) => ({ key, label: tr(`wf.${key}`), tint, count: groups.reduce((n, r) => n + (this.data[r.common]?.rows ?? []).filter((w) => key === "all" || this.wstate(w, key)).length, 0) })),
        onPick: (k) => { this.wf = k === "all" ? null : k; this.cur = null; } })));
    const none = sc.kind === "wait" || (loading && !total) ? tr("loading")
      : !groups.length ? tr("noRepo")
      : total && !shown ? tr("noMatch") : !total && !list.length ? tr("noWorktree") : null;
    // Rows gone (removed, another repo shown) leave the selection, once every repo has its rows.
    if (groups.every((r) => this.data[r.common])) this.multi.keep(this.stops(true).map((s) => s.id));
    const bar = this.bulk(t);
    const body = S.swap("kg-list", !(waiting && !total), v_flex().id("kg-list").flex_1().min_h(0).overflow_y_scrollbar().track_scroll(this.scroll).gap(4)
      .when(Boolean(none), (el) => el.child(this.box(t).child(this.empty(t, none))))
      .when(Boolean(bar), (el) => el.pb(64)) // room under the last card for the floating bar
      .children(list),
    () => v_flex().gap(4).children([0, 1, 2, 3, 4].map((k) => S.block(null, 76, { r: 16 }).child(S.row({ h: 74, icon: 16, lines: [0.4, 0.6], k })))),
    { grow: true });
    const page = v_flex().size_full().gap(4).text_color(t.foreground).child(head)
      .child(v_flex().flex_1().min_h(0).relative().child(body).when(Boolean(bar), (el) => el.child(bar)));
    // The head's ⋯, last in the page so that it draws over the list.
    const more = (el) => el.when(this.more, (p) => p.relative().child(moreMenu(t, "kg-more", 56, this.moreItems(), () => { this.more = false; })));
    if (sc.kind !== "repo") return more(page);
    // The foot: what `gwm clean --yes` would reclaim (never run here).
    const d = this.data[sc.repo.common];
    if (ask && d) this.loadClean(sc.repo, d, ask);
    const c = this.clean[sc.repo.common];
    const measuring = Boolean(this.inflight[`c:${sc.repo.common}`]);
    return more(page.child(h_flex().flex_none().h(40).px(14).gap(8).items_center().rounded(16).border(1).border_color(t.border).bg(t.background)
      .child(svg(G("trash")).size(13).flex_none().text_color(t.dim))
      .child(this.eyebrow(t, "gwm clean", t.muted).flex_none())
      .child(div().flex_1().min_w(0).truncate().text_size(12.5).text_color(c?.total ? t.foreground : t.dim)
        .child(measuring ? tr("measuring") : c?.error ? tr("cleanFailed", { error: c.error }) : c?.total ? tr("reclaimableReport", { total: size(c.total) }) : c ? tr("nothingToReclaim") : "—"))
      .when(measuring, (el) => el.child(svg(I("refresh-cw")).size(12).spin(900).text_color(t.dim)))));
  }

  // ---------- panel ----------

  meta(t, label, value, color) {
    return h_flex().gap(10).items_center().min_h(22)
      .child(this.eyebrow(t, label).w(118).flex_none())
      .child(typeof value === "string" || value == null
        ? div().min_w(0).truncate().text_size(12.5).text_color(color ?? t.foreground).child(value ?? "—")
        : value);
  }

  head(t, icon, eyebrow, d) {
    return h_flex().gap(8).items_center()
      .child(svg(icon).size(14).flex_none().text_color(t.accent))
      .child(this.eyebrow(t, eyebrow))
      .child(div().flex_1())
      .child(this.source(t, new Set(d?.source ? [d.source] : [])) ?? div())
      .child(this.iconButton(t, "kg-p-refresh", I("refresh-cw"), (cx) => this.refresh(cx, true), this.spinning > 0));
  }

  // `cursor`: the keys' cursor on it (a 1 px accent ring with the ink; transparent border elsewhere).
  // `pending`: the worktree's `gwm status` not answered yet: bars (skeleton.js) where the answer goes, not
  // « Aucune PR liée » nor « gwm status… » before it. A number already known (gwm list) shows meanwhile.
  linkLine(t, id, kind, x, repo, pending, cursor) {
    const S = skeleton(t, this.m);
    if (!x && pending) return S.pulse(S.row({ h: 30, icon: 14, lines: [0.45], px: 0, gap: 8 }).id(`${id}-sk`));
    if (!x) return div().h(26).flex().items_center().text_size(12.5).text_color(t.dim).child(kind === "pr" ? tr("noPr") : tr("noIssue"));
    const lk = look(kind, x.state);
    return h_flex().id(id).h(30).px(8).mx(-8).gap(8).items_center().rounded(12).border(1)
      .border_color(cursor ? alpha(t.accent, "99") : alpha(t.accent, "00")).when(cursor, (el) => el.bg(alpha(t.accent, "24")))
      .cursor_pointer().when(!cursor, (el) => el.hover((s) => s.bg(t.hover)))
      // The keys' cursor follows the click (#78); the keyboard goes with the Inbox it opens.
      .on_click(() => { this.cur = kind; this.inInbox(repo, kind, x); })
      .child(svg(I(lk.icon)).size(14).flex_none().text_color(t[lk.color]))
      .child(div().flex_none().font_family(MONO).text_size(12).text_color(t.foreground).child(`${kind === "pr" ? "PR " : ""}#${x.number}`))
      .when(Boolean(lk.label), (el) => el.child(this.tag(t, t[lk.color], lk.label)))
      .when(kind === "pr" && x.checks_total > 0, (el) => el.child(div().flex_none().font_family(MONO).text_size(11)
        .text_color(x.checks_passed === x.checks_total ? t.done : t.ansi3).child(`checks ${x.checks_passed}/${x.checks_total}`))) // i18n: tech
      .child(div().flex_1().min_w(0).truncate().text_size(12.5).text_color(t.muted).child(x.title ?? (pending ? S.pulse(S.line(0.6, { h: 7, lh: 16 }).id(`${id}-sk`)) : "")))
      .when(Boolean(x.url || repo.slug), (el) => el.child(this.github(t, `${id}-gh`, repo, kind, x, 24)));
  }

  session(t, s, pinned) {
    return h_flex().h(28).gap(8).items_center()
      .child(tile(t, this.programs[KIND[s.kind] ?? s.kind], s.kind, 18))
      .child(div().flex_1().min_w(0).truncate().text_size(12.5).text_color(s.freshness === "active" ? t.foreground : t.muted)
        .child(s.name?.replace(/\*\*|`/g, "") || KIND_NAME[s.kind] || s.kind))
      .when(pinned, (el) => el.child(svg(I("pin")).size(11).flex_none().text_color(t.accent)))
      .child(s.freshness === "active" ? this.tag(t, t.working, tr("active")) : div().flex_none().font_family(MONO).text_size(10.5).text_color(t.dim).child(ago(s.last_activity)));
  }

  // A linked worktree: everything about it.
  worktreeCard(t, repo, d, w, cx, cur) {
    if (cx) {
      this.statusOf(w, cx);
      this.loadPrefix(w, cx);
    }
    const { issue, pr } = this.links(w);
    // Its `gwm status` (the links' state and titles) not answered yet for this worktree: the links wait as
    // bars. Asked again when stale: the last answer stays meanwhile.
    const pending = Boolean(w.branch) && !this.st[`${w.path}|${w.branch}`];
    const pins = new Set(d.pins?.[w.branch] ?? []);
    const sessions = [...(w.agents?.sessions ?? [])]
      .sort((a, b) => (b.freshness === "active") - (a.freshness === "active") || pins.has(b.id) - pins.has(a.id) || b.last_activity - a.last_activity);
    const prefix = this.prefix[`${w.path}|${w.branch}`];
    const busy = this.busy?.path === w.path;
    // The head, Crosstalk's (DESIGN-REFERENCE.md): the project's logo (32 px) on its band, the
    // worktree's name, its branch · path, where the data came from and Rafraîchir.
    return this.panelBox(t, repo).child(v_flex().id("kg-p-wt").flex_1().min_h(0).overflow_y_scrollbar().track_scroll(this.scroll).px(16).pb(16).gap(12)
      .child(bandRow(t, { m: this.m, mark: this.mark(t, repo, 32), title: w.name, sub: [branchOf(w), tilde(w.path)],
        buttons: [this.source(t, new Set(d?.source ? [d.source] : [])), iconBtn(t, "kg-p-refresh", I("refresh-cw"), tr("refresh"), (cx) => this.refresh(cx, true))] }).mx(-6))
      .child(h_flex().flex_wrap().gap(5).children(this.marks(t, w, true, `kg-p-mk-${w.path}`)))
      .child(this.dashed(t))
      .child(v_flex().gap(2)
        .child(this.eyebrow(t, tr("links")))
        .child(this.linkLine(t, "kg-p-issue", "issue", issue, repo, pending, cur === "issue"))
        .child(this.linkLine(t, "kg-p-pr", "pr", pr, repo, pending, cur === "pr")))
      .child(this.dashed(t))
      .child(v_flex().gap(2)
        .child(this.eyebrow(t, sessions.length ? `Agents · ${sessions.length}` : tr("noAgent"))) // i18n: tech
        .children(sessions.slice(0, 4).map((s) => this.session(t, s, pins.has(s.id))))
        .when(sessions.length > 4, (el) => el.child(div().text_size(12).text_color(t.dim).child(tr("moreSessions", { n: sessions.length - 4 })))))
      .when(Boolean(w.note), (el) => el.child(this.dashed(t)).child(v_flex().gap(6)
        .child(this.eyebrow(t, tr("noteTitle")))
        .child(div().max_h(132).overflow_hidden().text_size(12.5).line_height("19px").text_color(t.dim).child(w.note.trim()))))
      .child(this.dashed(t))
      .child(v_flex().gap(6)
        .child(this.eyebrow(t, tr("prefixTitle")))
        .child(h_flex().gap(8).items_center()
          // Not read yet: a bar (skeleton.js), breathing.
          .child(div().flex_1().min_w(0).truncate().font_family(MONO).text_size(12.5).text_color(prefix ? t.foreground : t.dim)
            .child(prefix === undefined ? ((S) => S.pulse(S.line(150, { h: 7, lh: 16 }).id("kg-sk-prefix")))(skeleton(t, this.m)) : prefix ?? "—"))
          .when(Boolean(prefix), (el) => el.child(this.iconButton(t, "kg-p-prefix", G("copy"), (cx) => {
            cx.write_to_clipboard(`${prefix} `);
            notify({ title: tr("prefixCopied"), body: prefix, level: "success", timeout: 2500 });
          })))))
      .child(this.dashed(t))
      .child(h_flex().flex_wrap().gap(6).items_center()
        .child(this.mini(t, "kg-p-sync", G("sync"), "Sync", () => this.askSync(w))) // i18n: tech
        // Its note in kt-notes (shared "kt-notes.open": the repo, the worktree, taken once there).
        .child(this.mini(t, "kg-p-note", "mods/kt-notes/notebook-pen.svg", tr("noteButton"), () => {
          setShared("kt-notes.open", { root: repo.main ?? repo.folder, worktree: w.path, at: Date.now() });
          show("notes");
        }))
        .when(Boolean(issue), (el) => el.child(this.mini(t, "kg-p-oi", I("circle-dashed"), "Issue", () => this.inInbox(repo, "issue", issue)))) // i18n: tech
        .when(Boolean(pr), (el) => el.child(this.mini(t, "kg-p-op", I("git-pull-request"), "PR", () => this.inInbox(repo, "pr", pr))))
        .child(this.mini(t, "kg-p-all", I("layers"), tr("allWorktrees"), () => show(PAGE)))
        .when(busy, (el) => el.child(h_flex().gap(6).items_center().text_size(12).text_color(t.muted)
          .child(svg(I("refresh-cw")).size(12).spin(900)).child(tr("running", { what: this.busy.label }))))));
  }

  // A main checkout: the repo.
  repoCard(t, repo, d, w, cx, cur) {
    if (cx) {
      this.loadInfo(repo, d, cx);
      this.loadClean(repo, d, cx);
    }
    const info = this.info[repo.common];
    const c = this.clean[repo.common];
    const linked = d.rows.filter((x) => !x.is_main);
    const doc = info?.doctor;
    const bad = (doc?.checks ?? []).filter((x) => x.status !== "ok");
    const failed = bad.filter((x) => x.status === "failed").length;
    // Both counts when both: the bar names every check that isn't ok under it.
    // Not read yet: each fact as a bar (skeleton.js), breathing.
    const S = skeleton(t, this.m);
    const sk = (id, w) => S.pulse(S.line(w, { h: 7, lh: 16 }).id(id));
    const doctor = !info ? [sk("kg-sk-doc", 70), t.dim] : !doc ? [tr("unavailable"), t.dim]
      : failed ? [[tr("failures", { n: failed }), bad.length > failed && tr("warnings", { n: bad.length - failed })].filter(Boolean).join(" · "), t.ansi1]
      : bad.length ? [tr("warnings", { n: bad.length }), t.ansi3] : ["OK", t.done];
    const TRUST_COLOR = { trusted: t.done, drift: t.ansi3, untrusted: t.ansi3, absent: t.dim, unknown: t.dim };
    const trust = TRUST_COLOR[info?.trust] ? [tr(`trust.${info.trust}`), TRUST_COLOR[info.trust]] : [info ? "…" : sk("kg-sk-trust", 60), t.dim];
    const sock = d.sock ? d.sock.split("/").pop() : null;
    return this.panelBox(t, repo).child(v_flex().id("kg-p-repo").flex_1().min_h(0).overflow_y_scrollbar().track_scroll(this.scroll).p(16).gap(12)
      .child(this.head(t, I("folder"), tr("repo"), d, cx))
      // motion.js sharpen: the repo's name comes into focus when it is shown or changes, once.
      .child(((ttl) => (this.m ? sharpen(this.m, `kg-repo-title:${repo.name}`, ttl) : ttl()))(
        () => div().text_size(17).font_semibold().text_color(t.foreground).child(repo.name)))
      .child(v_flex().gap(4)
        .child(this.meta(t, tr("meta.branch"), h_flex().min_w(0).gap(8).items_center().font_family(MONO).text_size(12)
          .child(div().min_w(0).truncate().text_color(t.accent).child(w?.branch ?? "—"))
          .children(this.marks(t, w ?? {}, false, `kg-r-mk-${w?.path ?? repo.name}`))))
        .child(this.meta(t, tr("meta.default"), info ? info.def ?? "—" : sk("kg-sk-def", 90), t.foreground))
        .child(this.meta(t, "Daemon", d.source === "daemon" ? tr("daemonOn", { sock }) : tr("daemonOff"), d.source === "daemon" ? t.done : t.ansi3)) // i18n: tech
        // Read: viz.js' bar, the checks that pass over all of them, tinted by the worst, the others named
        // under it; its id per repo (its label changes with the state). Not read yet or none: in words.
        .child(!doc?.checks?.length ? this.meta(t, "Doctor", doctor[0], doctor[1])
          : h_flex().gap(10).items_start()
            .child(this.eyebrow(t, "Doctor").w(118).flex_none()) // i18n: tech
            .child(div().flex_1().min_w(0).child(viz(t, this.m, { roll }).progress(doctor[0], doc.checks.length - bad.length, {
              max: doc.checks.length, color: doctor[1], figure: `${doc.checks.length - bad.length} / ${doc.checks.length}`,
              detail: bad.map((x) => x.name).join(" · ") || undefined, id: `kg-doc-${repo.common}` }))))
        .child(this.meta(t, ".gwm.toml", trust[0], trust[1]))
        // Not measured yet for this repo: a bar (skeleton.js), breathing. Measured again (past 30 min): the
        // last measure stays until the new one; Rafraîchir drops it, so the bar again.
        .child(this.meta(t, "gwm clean", !c ? sk("kg-sk-clean", 110) : c.error ? tr("cleanFailed", { error: c.error }) : c.total ? tr("reclaimable", { total: size(c.total) }) : tr("nothingToReclaim"), c?.total ? t.foreground : t.dim)))
      .child(this.dashed(t))
      .child(v_flex().gap(2)
        .child(this.eyebrow(t, linked.length ? `Worktrees · ${linked.length}` : tr("noLinked"))) // i18n: tech
        .children(linked.slice(0, 8).map((x) => h_flex().id(`kg-p-w-${x.path}`).h(30).px(8).mx(-8).gap(8).items_center().rounded(12).border(1)
          .border_color(x.path === cur ? alpha(t.accent, "99") : alpha(t.accent, "00")).when(x.path === cur, (el) => el.bg(alpha(t.accent, "24")))
          .cursor_pointer().when(x.path !== cur, (el) => el.hover((s) => s.bg(t.hover)))
          // The keys' cursor follows the click (#78); the keyboard goes with the space it opens.
          .on_click(() => { this.cur = x.path; this.openSpace(d, x); })
          .child(svg(I("git-branch")).size(13).flex_none().text_color(t.muted))
          .child(div().flex_1().min_w(0).truncate().font_family(MONO).text_size(12).text_color(t.foreground).child(x.branch ?? x.name))
          .when(Boolean(x.status?.is_dirty), (el) => el.child(div().size(6).rounded_full().flex_none().bg(t.ansi3)))
          .when((x.agents?.sessions ?? []).some((s) => s.freshness === "active"), (el) => el.child(div().size(6).rounded_full().flex_none().bg(t.working)))
          .child(svg(G("enter")).size(12).flex_none().text_color(t.dim))))
        .when(linked.length > 8, (el) => el.child(div().text_size(12).text_color(t.dim).child(`+ ${linked.length - 8}`))))
      .child(this.dashed(t))
      .child(h_flex().flex_wrap().gap(6)
        .child(this.mini(t, "kg-p-all", I("layers"), tr("allWorktrees"), () => show(PAGE)))
        .child(this.mini(t, "kg-p-new", I("plus"), tr("newWorktree"), () => run("mod.open", { name: "kt-new" })))));
  }

  panelView(t, sc, cx) {
    // No field here: the whole view takes the keyboard (pane.go), NORMAL only.
    const root = v_flex().id("kg-panel").size_full().gap(4).text_color(t.foreground)
      .track_focus(this.handle)
      .on_key_down((e, cx) => this.key(e, cx));
    const blank = (title, detail) => root.child(this.box(t).flex_1().items_center().justify_center().gap(10).p(24)
      .child(div().size(44).rounded_full().border(1).border_dashed().border_color(t.input).flex().items_center().justify_center()
        .child(svg(I("git-branch")).size(18).text_color(t.dim)))
      .child(div().text_size(14).font_medium().text_color(t.foreground).child(title))
      .when(Boolean(detail), (el) => el.child(div().max_w(320).truncate().font_family(MONO).text_size(11).text_color(t.dim).child(detail))));
    // Before the first read: the panel's shape (skeleton.js), breathing: its head, the name, the facts.
    // The card that comes has its own entry (the name's sharpen): it lands as it does.
    const S = skeleton(t, this.m);
    const skel = () => root.child(this.box(t).flex_1().p(16).child(S.pulse(v_flex().id("kg-p-sk").gap(12)
      .child(S.line(120, { h: 8, lh: 22 })).child(S.line(160, { h: 12, lh: 24 }))
      .child(v_flex().gap(4).children([90, 140, 110, 70, 120].map((w) => h_flex().min_h(22).gap(10).items_center()
        .child(div().w(118).flex_none().child(S.line(70, { h: 6, lh: 14 }))).child(S.line(w, { h: 7, lh: 16 }))))))));
    if (sc.kind === "wait") return skel();
    if (sc.kind === "none") return blank(tr("outsideRepo"), sc.cwd ? tilde(sc.cwd) : tr("noTerminal"));
    const d = this.data[sc.repo.common];
    if (!d) return skel();
    if (d.error && !d.rows.length) return blank(tr("listFailed"), d.error);
    const w = enclosing(d.rows, sc.cwd);
    // The keys' cursor, while the panel has the keyboard. Its rows sit in the card's fifth child
    // (the links, or the linked worktrees): that one is brought into view once after a move.
    const stops = this.keyed ? this.stops() : [];
    const cur = (stops.find((s) => s.id === this.cur) ?? stops[0])?.id;
    if (this.reveal && cur) {
      // The links are the worktree card's 4th child (its band row), the linked list the repo card's 5th.
      this.scroll.scroll_to_item(w && !w.is_main ? 3 : 4);
      this.reveal = false;
    }
    return root.child(w && !w.is_main ? this.worktreeCard(t, sc.repo, d, w, cx, cur) : this.repoCard(t, sc.repo, d, d.rows.find((x) => x.is_main) ?? w, cx, cur));
  }

  // panel.js: the panel view glides in and out with the right panel (#73); the Worktrees page doesn't move.
  render(cx) {
    tilesFrame(this.tiles, cx);
    const view = this.draw(cx);
    return this.panel ? panelIn(this.motion, view) : view;
  }

  draw(cx) {
    const t = theme();
    this.m = frame(this.motion, Boolean(shared("kt.reducedMotion")));
    const vis = this.visible();
    const live = !checking();
    if (live) {
      // The bus (DATA-SYNC.md): gwm and git actions anywhere, and an agent of a space that stopped
      // working (it may have changed a worktree), read the worktrees again.
      refreshOn(this, cx, "data", ["gwm", "git", ...spaces().map((s) => `agent:${s.id}`)], async (cx) => this.refresh(cx, false));
    }
    const sc = live ? this.scope(cx) : { kind: "wait" };
    this.sc = sc; // what the keys' cursor walks (stops())
    this.keyed = this.handle.is_focused();
    if (vis && live) this.openAsked(cx);
    if (vis && live && this.ready) {
      const key = sc.kind === "repo" ? `r:${sc.repo.common}` : sc.kind === "workspace" ? `w:${sc.repos.map((r) => r.common).join("|")}` : sc.kind;
      if (key !== this.scopeKey || !this.shown) {
        this.scopeKey = key;
        this.refresh(cx, false);
      }
      this.watch(sc.kind === "repo" ? sc.repo : null, cx);
    }
    if (!vis && this.shown) this.unwatch();
    if (!this.panel && live) {
      // The thread's terminal is hidden under this page: take the keyboard (arrive), after the app has
      // settled its own focus on the switch (kt-inbox's way).
      if (vis && !this.shown) cx.timer.after(150, (cx) => { this.arrive(); cx.notify(); });
      // Back to the thread: the keyboard goes back to its terminal.
      if (!vis && this.shown && this.handle.is_focused()) {
        const tab = spaces().find((s) => s.active)?.tabs.find((c) => c.active)?.id;
        const pane = panes().find((p) => p.tab === tab && p.focused)?.pane;
        if (pane) cx.spawn(async () => run("pane.focus", { pane }));
      }
    }
    this.shown = vis;
    // Only a shown copy asks for more (gwm status, info, clean): pass cx then.
    const ask = vis && live ? cx : null;
    if (sc.kind === "remote") return this.remoteView(t, sc);
    return this.panel ? this.panelView(t, sc, ask) : this.pageView(t, sc, ask, cx);
  }

  // Another machine's thread (#65): said instead of « hors dépôt » (the panel) or this Mac's repos as if
  // they were its (the page); the page offers this Mac's projects (the global view).
  remoteView(t, sc) {
    return v_flex().id(this.panel ? "kg-panel" : "kg-page").size_full().gap(4).text_color(t.foreground)
      .track_focus(this.handle)
      .on_key_down((e, cx) => this.key(e, cx))
      .child(this.box(t).flex_1().items_center().justify_center().gap(12).p(24)
        .child(machineNote(t, sc.machine, tr("remote.text"), { id: "kg-remote" }))
        .when(!this.panel, (el) => el.child(this.mini(t, "kg-remote-global", I("layers"), tr("remote.global"), () => { this.global = true; }))));
  }
}
