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
//   Typing filters (the field takes the keyboard while the page shows).
// - "panel": the "gwm-panel" child of the right panel's "panel-body" stack. It follows the shown
//   thread's terminal (kt-flow's rule) and its folder: in a linked worktree, that worktree (links,
//   agents, note, commit prefix, sync); in a main checkout, the repo (branches, worktrees, daemon,
//   doctor, .gwm.toml trust, `gwm clean` dry run); outside git, an empty state.
// Transport: JSON-RPC to `gwm daemon` over its unix socket, one request per `nc -U`. A daemon
// answers for one repo only, so each repo gets its own socket beside gwm's default one
// (`gwm-kt-<hash>.sock`); gwm's default socket is used when it serves that repo. A repo shown
// in a repo view without a daemon gets one, started once by this copy, detached: it keeps running
// after Herdr quits. Failing that, `gwm list --format=json`. The header says which ("daemon"/"cli").
// Refresh: watchFolder on the repo's `<git-common-dir>/worktrees` and `refs/heads` (debounced),
// plus every 15 s for dirty and agent freshness, which no git event announces; only while shown.

import { View, div, svg, image } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { exec, theme, spaces, panes, focused, run, layout, openOverlay, notify, nextCommand, props, shared, setShared, home, knownAgents, watchFolder, checking } from "herdr";

const MONO = "Monaspace Krypton";
const I = (name) => `mods/kt-threads/${name}.svg`;
const G = (name) => `mods/kt-gwm/${name}.svg`;
// This mod's blocks in kbrdn-threads.json.
const PAGE = "gwm"; // in the "view" stack
const PANEL = "gwm-panel"; // in the "panel-body" stack
const TICK = 15e3;
const STATUS_TTL = 10 * 60e3;
const INFO_TTL = 5 * 60e3;
const CLEAN_TTL = 30 * 60e3;
// gwm's agent kinds -> Herdr's program keys (programs.json) and names.
const KIND = { claude: "claude", codex: "codex", opencode: "opencode", vibe: "vibe" };
const KIND_NAME = { claude: "Claude Code", codex: "Codex", opencode: "opencode", vibe: "Mistral Vibe" };

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
const plural = (n, one, many) => `${n} ${n > 1 ? many : one}`;
// gwm clean's "4.1 GiB" -> "4,1 Go".
const french = (s) => s.replace(/(\d)\.(\d)/, "$1,$2").replace(/\b([KMGT])iB\b/, "$1o").replace(/\bB$/, "o");
const isHome = (s) => !s.machine && trim(s.folder) === trim(home());
const branchOf = (w) => w.branch ?? (w.head ? `HEAD détachée · ${w.head.slice(0, 7)}` : "HEAD détachée");
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

function ago(sec) {
  if (!sec) return "";
  const s = Math.max(0, Date.now() / 1000 - sec);
  if (s < 60) return "à l'instant";
  const m = Math.floor(s / 60);
  if (m < 60) return `il y a ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `il y a ${h} h`;
  const d = Math.floor(h / 24);
  return d < 30 ? `il y a ${d} j` : `il y a ${Math.floor(d / 30)} mois`;
}

// gwm status' state -> label, icon, theme color name (no state yet: the bare number, muted).
function look(kind, state) {
  const s = String(state ?? "").toUpperCase();
  if (kind === "pr") {
    if (s === "MERGED") return { label: "merged", icon: "git-merge", color: "ansi5" };
    if (s === "CLOSED") return { label: "closed", icon: "git-pull-request-closed", color: "ansi1" };
    if (s === "DRAFT") return { label: "draft", icon: "git-pull-request", color: "dim" };
    if (s === "OPEN") return { label: "open", icon: "git-pull-request", color: "ansi2" };
    return { label: "", icon: "git-pull-request", color: "muted" };
  }
  if (s === "CLOSED") return { label: "closed", icon: "circle-check", color: "ansi5" };
  if (s === "OPEN") return { label: "open", icon: "circle-dashed", color: "ansi2" };
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
    this.panel = props()?.view === "panel";
    this.handle = cx.focus_handle();
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
    cx.spawn(async (cx) => {
      for (;;) {
        const c = await nextCommand();
        if (c === "refresh") this.refresh(cx, true);
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
    return Array.isArray(rows) ? { rows, source: "cli" } : { rows: [], source: "cli", error: lastLine(r.stderr || r.stdout) || `gwm list a échoué (code ${r.code})` };
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
  // | { kind: "none", cwd } | { kind: "wait" }.
  scope(cx) {
    if (this.panel) {
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
    const folder = s && !s.machine && !isHome(s) ? trim(s.folder) : null;
    if (folder && !(folder in this.repos)) { this.resolve(folder, cx); return { kind: "wait" }; }
    const own = folder ? this.repos[folder] : null;
    if (own && !this.global) return { kind: "repo", repo: own };
    // The projects registry, one group per repo (this computer's).
    const seen = new Set();
    const repos = [];
    for (const e of [...(shared("kt.projects") ?? [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))) {
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
      if (loud || !prev || sig(prev) !== sig(next)) cx.notify();
    });
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
      this.clean[repo.common] = { at: Date.now(), total: total ? french(total) : null, error: r.code === 0 ? null : lastLine(r.stderr) || `code ${r.code}` };
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
    if (w.is_main) return "c'est le checkout principal";
    if (w.is_locked) return "il est verrouillé";
    if (w.status?.unknown) return "son état git est inconnu";
    if (w.status?.is_dirty) return "des modifications ne sont pas commitées";
    if ((w.agents?.sessions ?? []).some((s) => s.freshness === "active")) return "un agent y est actif (gwm agents)";
    const here = panes().filter((p) => p.terminal && !p.terminal.includes("/") && inside(trim(p.cwd), w.path));
    if (here.some((p) => p.program?.agent)) return "un agent tourne dans un terminal Herdr ouvert dessus";
    if (here.length) return "un terminal Herdr y est ouvert";
    return null;
  }

  refuse(name, title, why) {
    notify({ title, body: `${name} : ${why}.`, level: "warning", timeout: 6000 });
  }

  ask(p, title, detail, label, danger) {
    if (this.busy) return;
    this.pending = p;
    // kbrdn's confirm draws its own card and veil, full window (its mod.json): frame "none", no size.
    openOverlay({ mod: "kt-confirm", kind: "dialog", frame: "none",
      props: { title, detail, label, danger, command: { name: "kt-gwm.confirmed" } } });
  }

  askSync(w) {
    const s = w.status ?? {};
    if (s.is_dirty) return this.refuse(w.name, "Sync refusé", "des modifications ne sont pas commitées, gwm sync ne rebase pas dessus");
    if (!s.has_upstream) return this.refuse(w.name, "Sync impossible", "la branche n'a pas d'upstream");
    this.ask({ kind: "sync", path: w.path, name: w.name }, `Synchroniser ${w.name} ?`,
      `gwm sync : fetch de l'upstream de ${w.branch}, puis rebase${s.behind ? ` (${plural(s.behind, "commit", "commits")} de retard)` : ""}. En cas de conflit, gwm annule le rebase et laisse le worktree tel quel.`,
      "Synchroniser", false);
  }

  askRemove(repo, w) {
    const why = this.refusal(w);
    if (why) return this.refuse(w.name, "Suppression refusée", why);
    this.ask({ kind: "remove", path: w.path, name: w.name, repo }, `Supprimer le worktree ${w.name} ?`,
      `${tilde(w.path)} sera supprimé par gwm remove. La branche ${w.branch ?? "(HEAD détachée)"} est conservée.`, "Supprimer", true);
  }

  act(p, cx) {
    this.busy = { path: p.path, label: p.kind === "sync" ? "Sync" : "Suppression" };
    cx.spawn(async (cx) => {
      const n = await (p.kind === "sync" ? this.sync(p) : this.remove(p));
      this.busy = null;
      notify({ ...n, timeout: n.level === "success" ? 4000 : 8000 });
      this.refresh(cx, false);
      cx.notify();
    });
  }

  async sync(p) {
    const r = await sh("gwm", ["sync"], { cwd: p.path, timeout: 180e3 });
    return r.code === 0
      ? { level: "success", title: `${p.name} synchronisé`, body: lastLine(r.stdout) }
      : { level: "error", title: `Sync de ${p.name} échoué`, body: lastLine(r.stderr || r.stdout) || `gwm sync a échoué (code ${r.code})` };
  }

  async remove(p) {
    // Fresh state: changes or an agent may have shown up since the dialog opened.
    const got = await this.list(p.repo, false);
    const rows = got.rows.map((w) => ({ ...w, path: trim(w.path) }));
    const w = rows.find((x) => x.path === p.path);
    if (!w) return { level: "error", title: "Suppression annulée", body: `${p.name} n'est plus dans la liste de gwm.` };
    const why = this.refusal(w);
    if (why) return { level: "warning", title: "Suppression refusée", body: `${w.name} : ${why}.` };
    const main = rows.find((x) => x.is_main)?.path ?? p.repo.folder;
    // gwm resolves its target by name or id: its plan must name this very path.
    const dry = await sh("gwm", ["remove", w.id, "--dry-run"], { cwd: main });
    const planned = trim(dry.stdout.match(/^\s*path:\s+(.+)$/m)?.[1]?.trim());
    if (dry.code !== 0 || planned !== w.path)
      return { level: "error", title: "Suppression annulée", body: `gwm ne cible pas ${tilde(w.path)}. ${lastLine(dry.stderr || dry.stdout)}` };
    const r = await sh("gwm", ["remove", w.id], { cwd: main, timeout: 120e3 });
    return r.code === 0
      ? { level: "success", title: `${w.name} supprimé`, body: `Branche ${w.branch ?? "—"} conservée.` }
      : { level: "error", title: `Suppression de ${w.name} échouée`, body: lastLine(r.stderr || r.stdout) || `gwm remove a échoué (code ${r.code})` };
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
      .cursor_pointer().hover((s) => s.bg(t.hover).text_color(t.foreground)).tooltip("Ouvrir sur GitHub")
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
        .cursor_pointer().hover((s) => s.bg(alpha(color, "33"))).tooltip("Ouvrir dans l'Inbox")
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

  // Dirty, ahead/behind, lock: the git state pills.
  marks(t, w, clean) {
    const s = w.status ?? {};
    const out = [];
    if (s.is_dirty) out.push(this.tag(t, t.ansi3, "● modifié"));
    else if (clean && !s.unknown) out.push(this.tag(t, t.done, "propre"));
    if (s.ahead || s.behind)
      out.push(h_flex().flex_none().h(20).px(8).gap(6).items_center().rounded_full().border(1).border_color(t.border).font_family(MONO).text_size(10.5)
        .when(s.ahead > 0, (el) => el.child(div().text_color(t.ansi2).child(`↑${s.ahead}`)))
        .when(s.behind > 0, (el) => el.child(div().text_color(t.ansi3).child(`↓${s.behind}`))));
    if (s.unknown) out.push(this.tag(t, t.dim, "état inconnu"));
    if (w.is_locked) out.push(this.tag(t, t.dim, "verrouillé"));
    if (w.is_prunable) out.push(this.tag(t, t.ansi1, "orphelin"));
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

  key(e, cx) {
    if (e.key === "escape") this.query = "";
    else if (e.key === "backspace") this.query = this.query.slice(0, -1);
    else if (e.key_char && !e.modifiers?.control && !e.modifiers?.platform) this.query += e.key_char;
    else return;
    cx.stop_propagation();
    cx.notify();
  }

  card(t, repo, d, w, here, cx) {
    if (cx) this.statusOf(w, cx);
    const { issue, pr } = this.links(w);
    const hot = this.hot === w.path;
    const busy = this.busy?.path === w.path;
    const note = (w.note ?? "").split("\n").map((l) => l.replace(/^#+\s*/, "").trim()).find(Boolean) ?? "";
    const top = w.agents?.top;
    const actions = [
      this.mini(t, `kg-open-${w.path}`, G("enter"), "Ouvrir", () => this.openSpace(d, w)),
      issue && this.mini(t, `kg-issue-${w.path}`, I("circle-dashed"), "Issue", () => this.inInbox(repo, "issue", issue)),
      pr && this.mini(t, `kg-pr-${w.path}`, I("git-pull-request"), "PR", () => this.inInbox(repo, "pr", pr)),
      this.mini(t, `kg-copy-${w.path}`, G("copy"), "Copier", (cx) => {
        cx.write_to_clipboard(w.path);
        notify({ title: "Chemin copié", body: tilde(w.path), level: "success", timeout: 2500 });
      }),
      this.mini(t, `kg-sync-${w.path}`, G("sync"), "Sync", () => this.askSync(w)),
      !w.is_main && this.mini(t, `kg-rm-${w.path}`, G("trash"), "Supprimer", () => this.askRemove(repo, w), true),
    ].filter(Boolean);
    // A card (radius 16) on the page; the shown thread's worktree carries the ink.
    return v_flex().id(`kg-card-${w.path}`).flex_none().rounded(16).border(1)
      .border_color(here ? alpha(t.accent, "66") : t.border).bg(t.background)
      .on_hover((on, cx) => {
        const next = on ? w.path : this.hot === w.path ? null : this.hot;
        if (next !== this.hot) { this.hot = next; cx.notify(); }
      })
      .child(v_flex().px(14).py(10).gap(6).rounded(16).when(here, (el) => el.bg(alpha(t.accent, "1a")))
        .child(h_flex().h(22).gap(8).items_center()
          .child(svg(w.is_main ? I("folder") : I("git-branch")).size(14).flex_none().text_color(w.is_main || here ? t.accent : t.muted))
          .child(div().flex_none().max_w(320).truncate().text_size(13.5).font_medium().text_color(t.foreground).child(w.name))
          .child(div().min_w(0).truncate().font_family(MONO).text_size(11.5).text_color(here ? t.accent : t.muted)
            .child(branchOf(w)))
          .child(div().flex_1())
          .children(this.marks(t, w, false))
          .when(Boolean(issue), (el) => el.child(this.link(t, `kg-li-${w.path}`, repo, "issue", issue)))
          .when(Boolean(pr), (el) => el.child(this.link(t, `kg-lp-${w.path}`, repo, "pr", pr)))
          .children(this.agentChips(t, w, d)))
        .child(h_flex().h(26).gap(8).items_center()
          .child(div().flex_none().max_w(420).truncate().font_family(MONO).text_size(11).text_color(t.dim).child(tilde(w.path)))
          .when(Boolean(note), (el) => el.child(div().flex_none().text_color(t.dim).child("·"))
            .child(div().min_w(0).truncate().text_size(12).text_color(t.dim).child(note)))
          .child(div().flex_1())
          .when(busy, (el) => el.child(h_flex().flex_none().gap(6).items_center().text_size(12).text_color(t.muted)
            .child(svg(I("refresh-cw")).size(12).spin(900)).child(`${this.busy.label} en cours…`)))
          .when(!busy && hot, (el) => el.child(h_flex().flex_none().gap(5).items_center().children(actions)))
          .when(!busy && !hot && Boolean(top), (el) => el.child(div().flex_none().font_family(MONO).text_size(11).text_color(t.dim)
            .child(`${KIND_NAME[top.kind] ?? top.kind} · ${ago(top.last_activity)}`)))));
  }

  groupHead(t, r, d, n) {
    return h_flex().flex_none().h(28).px(8).pt(6).gap(8).items_center()
      .child(svg(I("folder")).size(13).flex_none().text_color(t.muted))
      .child(this.eyebrow(t, r.name, t.foreground))
      .child(div().flex_none().font_family(MONO).text_size(11).text_color(t.dim).child(String(n)))
      .child(this.source(t, new Set(d?.source ? [d.source] : [])) ?? div());
  }

  pageView(t, sc, cx) {
    const groups = sc.kind === "repo" ? [sc.repo] : sc.kind === "workspace" ? sc.repos : [];
    const cwd = threadCwd();
    const q = this.query.trim().toLowerCase();
    const match = (w) => !q || `${w.name} ${w.branch ?? ""} ${tilde(w.path)} #${w.issue ?? ""} #${w.pr ?? ""} ${w.note ?? ""}`.toLowerCase().includes(q);
    const total = groups.reduce((n, r) => n + (this.data[r.common]?.rows.length ?? 0), 0);
    const sources = new Set(groups.map((r) => this.data[r.common]?.source).filter(Boolean));
    const loading = groups.some((r) => this.inflight[`l:${r.common}`]);
    const list = [];
    let shown = 0;
    for (const r of groups) {
      const d = this.data[r.common];
      const rows = (d?.rows ?? []).filter(match);
      shown += rows.length;
      if (sc.kind === "workspace" && (rows.length || d?.error)) list.push(this.groupHead(t, r, d, rows.length));
      if (d?.error) list.push(this.empty(t, `${r.name} : ${d.error}`, t.ansi1));
      const here = d ? enclosing(d.rows, cwd) : null;
      for (const w of rows) list.push(this.card(t, r, d, w, w === here, cx));
    }
    const typing = this.handle.is_focused();
    const label = sc.kind === "repo" ? sc.repo.name : sc.kind === "wait" ? "…" : "Global";
    const head = this.box(t).flex_none().p(12).gap(10)
      .child(h_flex().gap(8).items_center()
        .child(svg(I("git-branch")).size(14).flex_none().text_color(sc.kind === "repo" ? t.accent : t.muted))
        .child(this.eyebrow(t, label, sc.kind === "repo" ? t.foreground : t.muted).min_w(0).truncate())
        .child(div().flex_none().font_family(MONO).text_size(11).text_color(t.dim).child(plural(total, "worktree", "worktrees")))
        .child(this.source(t, sources) ?? div())
        .child(div().flex_1())
        .when(sc.kind === "repo" || Boolean(sc.inRepo), (el) => el.child(this.chip(t, "kg-global", "Global", this.global, () => { this.global = !this.global; })))
        .child(this.pill(t, "kg-new", "Nouveau worktree", I("plus"), true, () => run("mod.open", { name: "kt-new" })))
        .child(h_flex().id("kg-refresh").h(30).px(12).gap(6).items_center().rounded_full().border(1).border_color(t.border)
          .text_size(12).text_color(t.muted).cursor_pointer().hover((s) => s.bg(t.hover).text_color(t.foreground))
          .on_click((_e, cx) => { this.refresh(cx, true); cx.notify(); })
          .child(svg(I("refresh-cw")).size(13).when(this.spinning > 0, (el) => el.spin(900)))
          .child("Rafraîchir")))
      .child(h_flex().id("kg-filter").h(34).px(13).gap(8).items_center().rounded_full().border(1)
        .border_color(typing ? t.accent : t.border).cursor_text()
        .track_focus(this.handle)
        .on_key_down((e, cx) => this.key(e, cx))
        .on_click((_e, cx) => { this.handle.focus(); cx.notify(); })
        .child(svg(I("search")).size(14).flex_none().text_color(t.dim))
        .child(div().flex_1().min_w(0).truncate().text_size(13).text_color(this.query ? t.foreground : t.dim)
          .child(this.query ? this.query + (typing ? "▏" : "") : typing ? "▏" : "Filtrer par nom, branche, issue, note"))
        .when(Boolean(this.query), (el) => el.child(div().id("kg-clear").flex_none().text_color(t.dim).cursor_pointer().hover((s) => s.text_color(t.foreground))
          .on_click((_e, cx) => { cx.stop_propagation(); this.query = ""; cx.notify(); })
          .child(svg(I("x")).size(13)))));
    const none = sc.kind === "wait" || (loading && !total) ? "Chargement…"
      : !groups.length ? "Aucun dépôt dans le registre des projets."
      : total && !shown ? "Aucun worktree ne correspond au filtre." : !total && !list.length ? "Aucun worktree." : null;
    const body = v_flex().id("kg-list").flex_1().min_h(0).overflow_y_scrollbar().gap(4)
      .when(Boolean(none), (el) => el.child(this.box(t).child(this.empty(t, none))))
      .children(list);
    const page = v_flex().size_full().gap(4).text_color(t.foreground).child(head).child(body);
    if (sc.kind !== "repo") return page;
    // The foot: what `gwm clean --yes` would reclaim (never run here).
    const d = this.data[sc.repo.common];
    if (cx && d) this.loadClean(sc.repo, d, cx);
    const c = this.clean[sc.repo.common];
    const measuring = Boolean(this.inflight[`c:${sc.repo.common}`]);
    return page.child(h_flex().flex_none().h(40).px(14).gap(8).items_center().rounded(16).border(1).border_color(t.border).bg(t.background)
      .child(svg(G("trash")).size(13).flex_none().text_color(t.dim))
      .child(this.eyebrow(t, "gwm clean", t.muted).flex_none())
      .child(div().flex_1().min_w(0).truncate().text_size(12.5).text_color(c?.total ? t.foreground : t.dim)
        .child(measuring ? "mesure en cours…" : c?.error ? `échec : ${c.error}` : c?.total ? `${c.total} récupérables (rapport seul, rien n'est supprimé)` : c ? "rien à récupérer" : "—"))
      .when(measuring, (el) => el.child(svg(I("refresh-cw")).size(12).spin(900).text_color(t.dim))));
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

  linkLine(t, id, kind, x, repo, loading) {
    if (!x) return div().h(26).flex().items_center().text_size(12.5).text_color(t.dim).child(kind === "pr" ? "Aucune PR liée" : "Aucune issue liée");
    const lk = look(kind, x.state);
    return h_flex().id(id).h(30).px(8).mx(-8).gap(8).items_center().rounded(12).cursor_pointer().hover((s) => s.bg(t.hover))
      .on_click(() => this.inInbox(repo, kind, x))
      .child(svg(I(lk.icon)).size(14).flex_none().text_color(t[lk.color]))
      .child(div().flex_none().font_family(MONO).text_size(12).text_color(t.foreground).child(`${kind === "pr" ? "PR " : ""}#${x.number}`))
      .when(Boolean(lk.label), (el) => el.child(this.tag(t, t[lk.color], lk.label)))
      .when(kind === "pr" && x.checks_total > 0, (el) => el.child(div().flex_none().font_family(MONO).text_size(11)
        .text_color(x.checks_passed === x.checks_total ? t.done : t.ansi3).child(`checks ${x.checks_passed}/${x.checks_total}`)))
      .child(div().flex_1().min_w(0).truncate().text_size(12.5).text_color(t.muted).child(x.title ?? (loading ? "gwm status…" : "")))
      .when(Boolean(x.url || repo.slug), (el) => el.child(this.github(t, `${id}-gh`, repo, kind, x, 24)));
  }

  session(t, s, pinned) {
    return h_flex().h(28).gap(8).items_center()
      .child(tile(t, this.programs[KIND[s.kind] ?? s.kind], s.kind, 18))
      .child(div().flex_1().min_w(0).truncate().text_size(12.5).text_color(s.freshness === "active" ? t.foreground : t.muted)
        .child(s.name?.replace(/\*\*|`/g, "") || KIND_NAME[s.kind] || s.kind))
      .when(pinned, (el) => el.child(svg(I("pin")).size(11).flex_none().text_color(t.accent)))
      .child(s.freshness === "active" ? this.tag(t, t.working, "actif") : div().flex_none().font_family(MONO).text_size(10.5).text_color(t.dim).child(ago(s.last_activity)));
  }

  // A linked worktree: everything about it.
  worktreeCard(t, repo, d, w, cx) {
    if (cx) {
      this.statusOf(w, cx);
      this.loadPrefix(w, cx);
    }
    const { issue, pr } = this.links(w);
    const statusLoading = Boolean(this.inflight[`s:${w.path}|${w.branch}`]);
    const pins = new Set(d.pins?.[w.branch] ?? []);
    const sessions = [...(w.agents?.sessions ?? [])]
      .sort((a, b) => (b.freshness === "active") - (a.freshness === "active") || pins.has(b.id) - pins.has(a.id) || b.last_activity - a.last_activity);
    const prefix = this.prefix[`${w.path}|${w.branch}`];
    const busy = this.busy?.path === w.path;
    return this.box(t).flex_1().child(v_flex().id("kg-p-wt").flex_1().min_h(0).overflow_y_scrollbar().p(16).gap(12)
      .child(this.head(t, I("git-branch"), "Worktree", d, cx))
      .child(v_flex().gap(4)
        .child(div().text_size(17).font_semibold().text_color(t.foreground).child(w.name))
        .child(div().truncate().font_family(MONO).text_size(12).text_color(t.accent).child(branchOf(w)))
        .child(div().truncate().font_family(MONO).text_size(11).text_color(t.dim).child(tilde(w.path))))
      .child(h_flex().flex_wrap().gap(5).children(this.marks(t, w, true)))
      .child(this.dashed(t))
      .child(v_flex().gap(2)
        .child(this.eyebrow(t, "Liens"))
        .child(this.linkLine(t, "kg-p-issue", "issue", issue, repo, statusLoading))
        .child(this.linkLine(t, "kg-p-pr", "pr", pr, repo, statusLoading)))
      .child(this.dashed(t))
      .child(v_flex().gap(2)
        .child(this.eyebrow(t, sessions.length ? `Agents · ${sessions.length}` : "Aucun agent détecté"))
        .children(sessions.slice(0, 4).map((s) => this.session(t, s, pins.has(s.id))))
        .when(sessions.length > 4, (el) => el.child(div().text_size(12).text_color(t.dim).child(`+ ${plural(sessions.length - 4, "autre session", "autres sessions")}`))))
      .when(Boolean(w.note), (el) => el.child(this.dashed(t)).child(v_flex().gap(6)
        .child(this.eyebrow(t, "Note"))
        .child(div().max_h(132).overflow_hidden().text_size(12.5).line_height("19px").text_color(t.dim).child(w.note.trim()))))
      .child(this.dashed(t))
      .child(v_flex().gap(6)
        .child(this.eyebrow(t, "Préfixe de commit"))
        .child(h_flex().gap(8).items_center()
          .child(div().flex_1().min_w(0).truncate().font_family(MONO).text_size(12.5).text_color(prefix ? t.foreground : t.dim).child(prefix ?? (prefix === null ? "—" : "…")))
          .when(Boolean(prefix), (el) => el.child(this.iconButton(t, "kg-p-prefix", G("copy"), (cx) => {
            cx.write_to_clipboard(`${prefix} `);
            notify({ title: "Préfixe copié", body: prefix, level: "success", timeout: 2500 });
          })))))
      .child(this.dashed(t))
      .child(h_flex().flex_wrap().gap(6).items_center()
        .child(this.mini(t, "kg-p-sync", G("sync"), "Sync", () => this.askSync(w)))
        .when(Boolean(issue), (el) => el.child(this.mini(t, "kg-p-oi", I("circle-dashed"), "Issue", () => this.inInbox(repo, "issue", issue))))
        .when(Boolean(pr), (el) => el.child(this.mini(t, "kg-p-op", I("git-pull-request"), "PR", () => this.inInbox(repo, "pr", pr))))
        .child(this.mini(t, "kg-p-all", I("layers"), "Tous les worktrees", () => show(PAGE)))
        .when(busy, (el) => el.child(h_flex().gap(6).items_center().text_size(12).text_color(t.muted)
          .child(svg(I("refresh-cw")).size(12).spin(900)).child(`${this.busy.label} en cours…`)))));
  }

  // A main checkout: the repo.
  repoCard(t, repo, d, w, cx) {
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
    const doctor = !info ? ["…", t.dim] : !doc ? ["indisponible", t.dim]
      : failed ? [plural(failed, "échec", "échecs"), t.ansi1]
      : bad.length ? [plural(bad.length, "avertissement", "avertissements"), t.ansi3] : ["OK", t.done];
    const trust = { trusted: ["présent · approuvé", t.done], drift: ["présent · modifié depuis l'approbation", t.ansi3],
      untrusted: ["présent · non approuvé", t.ansi3], absent: ["absent", t.dim], unknown: ["présent · registre illisible", t.dim] }[info?.trust] ?? ["…", t.dim];
    const sock = d.sock ? d.sock.split("/").pop() : null;
    return this.box(t).flex_1().child(v_flex().id("kg-p-repo").flex_1().min_h(0).overflow_y_scrollbar().p(16).gap(12)
      .child(this.head(t, I("folder"), "Dépôt", d, cx))
      .child(div().text_size(17).font_semibold().text_color(t.foreground).child(repo.name))
      .child(v_flex().gap(4)
        .child(this.meta(t, "Branche", h_flex().min_w(0).gap(8).items_center().font_family(MONO).text_size(12)
          .child(div().min_w(0).truncate().text_color(t.accent).child(w?.branch ?? "—"))
          .children(this.marks(t, w ?? {}, false))))
        .child(this.meta(t, "Par défaut", info ? info.def ?? "—" : "…", t.foreground))
        .child(this.meta(t, "Daemon", d.source === "daemon" ? `actif · ${sock}` : "absent · lecture par la CLI", d.source === "daemon" ? t.done : t.ansi3))
        .child(this.meta(t, "Doctor", doctor[0], doctor[1]))
        .child(this.meta(t, ".gwm.toml", trust[0], trust[1]))
        .child(this.meta(t, "gwm clean", this.inflight[`c:${repo.common}`] ? "mesure en cours…" : c?.error ? `échec : ${c.error}` : c?.total ? `${c.total} récupérables` : c ? "rien à récupérer" : "…", c?.total ? t.foreground : t.dim)))
      .child(this.dashed(t))
      .child(v_flex().gap(2)
        .child(this.eyebrow(t, linked.length ? `Worktrees · ${linked.length}` : "Aucun worktree lié"))
        .children(linked.slice(0, 8).map((x) => h_flex().id(`kg-p-w-${x.path}`).h(30).px(8).mx(-8).gap(8).items_center().rounded(12)
          .cursor_pointer().hover((s) => s.bg(t.hover))
          .on_click(() => this.openSpace(d, x))
          .child(svg(I("git-branch")).size(13).flex_none().text_color(t.muted))
          .child(div().flex_1().min_w(0).truncate().font_family(MONO).text_size(12).text_color(t.foreground).child(x.branch ?? x.name))
          .when(Boolean(x.status?.is_dirty), (el) => el.child(div().size(6).rounded_full().flex_none().bg(t.ansi3)))
          .when((x.agents?.sessions ?? []).some((s) => s.freshness === "active"), (el) => el.child(div().size(6).rounded_full().flex_none().bg(t.working)))
          .child(svg(G("enter")).size(12).flex_none().text_color(t.dim))))
        .when(linked.length > 8, (el) => el.child(div().text_size(12).text_color(t.dim).child(`+ ${linked.length - 8}`))))
      .child(this.dashed(t))
      .child(h_flex().flex_wrap().gap(6)
        .child(this.mini(t, "kg-p-all", I("layers"), "Tous les worktrees", () => show(PAGE)))
        .child(this.mini(t, "kg-p-new", I("plus"), "Nouveau worktree", () => run("mod.open", { name: "kt-new" })))));
  }

  panelView(t, sc, cx) {
    const root = v_flex().size_full().gap(4).text_color(t.foreground);
    const blank = (title, detail) => root.child(this.box(t).flex_1().items_center().justify_center().gap(10).p(24)
      .child(div().size(44).rounded_full().border(1).border_dashed().border_color(t.input).flex().items_center().justify_center()
        .child(svg(I("git-branch")).size(18).text_color(t.dim)))
      .child(div().text_size(14).font_medium().text_color(t.foreground).child(title))
      .when(Boolean(detail), (el) => el.child(div().max_w(320).truncate().font_family(MONO).text_size(11).text_color(t.dim).child(detail))));
    if (sc.kind === "wait") return blank("…", null);
    if (sc.kind === "none") return blank("Hors dépôt git", sc.cwd ? tilde(sc.cwd) : "Aucun terminal dans ce thread");
    const d = this.data[sc.repo.common];
    if (!d) return blank("Chargement…", sc.repo.name);
    if (d.error && !d.rows.length) return blank("gwm list a échoué", d.error);
    const w = enclosing(d.rows, sc.cwd);
    return root.child(w && !w.is_main ? this.worktreeCard(t, sc.repo, d, w, cx) : this.repoCard(t, sc.repo, d, d.rows.find((x) => x.is_main) ?? w, cx));
  }

  render(cx) {
    const t = theme();
    const vis = this.visible();
    const live = !checking();
    const sc = live ? this.scope(cx) : { kind: "wait" };
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
      // The thread's terminal is hidden under this page: take the keyboard (typing filters),
      // after the app has settled its own focus on the switch (kt-inbox's way).
      if (vis && !this.shown) cx.timer.after(150, (cx) => { if (this.visible()) this.handle.focus(); cx.notify(); });
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
    return this.panel ? this.panelView(t, sc, ask) : this.pageView(t, sc, ask);
  }
}
