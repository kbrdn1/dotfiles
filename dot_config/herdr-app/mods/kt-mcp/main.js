// kbrdn MCP (Monocode's Settings › MCP, kbrdn.dev look): every MCP server configured
// for Claude Code, Codex, Cursor and OpenCode, read-only, as a page: the "mcp" child of
// kbrdn-threads' main "view" stack, or a dialog (openOverlay).
// Sources (read only, never a server started by this mod except through Vérifier and claude mcp get):
//   Claude Code: ~/.claude.json mcpServers (user) and projects[<cwd|root>].mcpServers
//   (local), through jq (the file is big and full of secrets); <root>/.mcp.json (project);
//   the enabled plugins' .mcp.json or plugin.json mcpServers (plugin). ~/.claude/mcp.json is
//   not read by Claude Code, so not here either.
//   Codex: ~/.codex/config.toml [mcp_servers.*] through python3's tomllib. Cursor:
//   ~/.cursor/mcp.json. OpenCode: ~/.config/opencode/opencode.json(c), key "mcp".
// Env, headers and tokens: names only, values never leave jq/python or are dropped at once;
// args and URLs are masked (mcp.js). States: "Vérifier" runs `claude mcp list` (it starts
// every server: only on click, 60 s max, in the project's folder, through the login shell),
// kept in shared "kt-mcp.health" (names and states); `claude mcp get <name>` (the detail's button,
// the bulk bar's Vérifier: one server at a time, in series) the same way, its output masked at once
// (maskGet) and kept in memory; a server's state is the newest of the two. Other providers: config
// only. Plugin servers aren't known to `claude mcp get`: Vérifier covers them.
// The page, top to bottom: title, scope, filter, Vérifier, Rafraîchir; the health strip (Claude
// Code's servers: connected, failed, to authenticate, unchecked; each pill filters, again: all);
// the provider segments; then the servers grouped by provider (a thin header with its logo), one
// dense line each (selection box, name, state pill, scope · transport), and on a click the detail
// on the right: state and when it was checked, transport, scope, file, the masked config, and for
// a Claude Code server `claude mcp get` on demand.
// Selection (select.js): ⌘-click toggles, ⇧-click selects from the anchor, the box toggles; a plain
// click opens the detail and empties it. The bulk bar: Vérifier (claude mcp get each, in series,
// its progress in the bar), copy the names, open the config files in Zed. No removal.
// + Ajouter (the header, `a`, kt-mcp.add): this mod again as a popup (props.add "menu": stdio,
// HTTP/SSE, JSON, Claude Desktop), then as a dialog (props.add: the way) with its form and a
// confirmation showing the exact command; form.js draws them, add.js runs `claude mcp add`,
// `add-json` or `add-from-claude-desktop`. Changes go through `claude mcp` only, after that
// confirmation; this page never writes a config itself.
// Reads when the page shows, when the shown space changes while it shows, and on Rafraîchir; never
// on a timer. Mod commands: kt-mcp.refresh, kt-mcp.verify, kt-mcp.tab:<key>, kt-mcp.close (a dialog
// copy closes itself), kt-mcp.bulk:<verify|copy|zed> (the bulk bar's button, for tests).
// Keys (vim.js; kt-keys lists them under Pages): the page opens typing in the filter (INSERT);
// ctrl-b h/l (pane.go, "focus") or `kt-mcp.key:<keys>` give it the keyboard in NORMAL.
// INSERT: type to filter, ctrl-n/ctrl-p, ctrl-j/ctrl-k, ↓ ↑ move the cursor, enter opens its detail,
// esc: NORMAL. NORMAL: j/k, gg/G, ctrl-d/u, n/N move the cursor (k on the first row: the filter,
// INSERT), / the filter, tab / shift-tab the provider segments, enter/o/l open the detail, O the
// config in Zed, y copies the name, r refresh, a + Ajouter, ? kt-keys, q back to the thread (a dialog closes);
// x or space toggle the row's selection, V a visual range (j/k extend it), ctrl-a selects every
// listed row; esc ends the range, then empties the selection, then clears the filter, then as q.
// Read-only: no dd.

import { View, div, svg, image } from "gpui-kit";
import { v_flex, h_flex, ScrollHandle } from "gpui-base";
import { exec, readTextFile, theme, spaces, panes, run, layout, props, home, notify, nextCommand, knownAgents, closeOverlay, shared, setShared, checking, openOverlay } from "herdr";
import { server, parseList, jsonc, maskText, maskGet, parseGet } from "./mcp.js";
import { Select } from "./select.js";
import { Vim, keysOf, keyOf, step } from "./vim.js";
import { AddMenu, AddForm, menuSize } from "./form.js";
import { filterRow, filterState } from "./filters.js";
import { dither, iconBtn, bandRow, moreMenu } from "./band.js";
import { motionState, frame, enter, pulse } from "./motion.js";
import { refreshOn } from "./bus.js";
import { METHODS } from "./add.js";

const MONO = "Monaspace Krypton";
const I = (name) => `mods/kt-threads/${name}.svg`;
const OWN = (name) => `mods/kt-mcp/${name}.svg`;
// A theme color with alpha `a`, replacing any it has (glass themes are #rrggbbaa).
const alpha = (c, a) => `${String(c).slice(0, 7)}${a}`;
// `tint`: the fallback icon (icons/<key>.svg) is a one-color glyph. `pale`: its filter's tint (FILTERS.md).
const PROVIDERS = [
  { key: "claude", label: "Claude Code", tint: false, pale: "accent" },
  { key: "codex", label: "Codex", tint: false, pale: "ansi6" },
  { key: "cursor", label: "Cursor", tint: true, pale: "ansi4" },
  { key: "opencode", label: "OpenCode", tint: true, pale: "ansi2" },
];
const LABEL = Object.fromEntries(PROVIDERS.map((p) => [p.key, p.label]));
const SEGS = [["all", "Tous"], ...PROVIDERS.map((p) => [p.key, p.label])];
const SCOPES = ["local", "project", "user", "plugin"];
// state -> label, theme color name; every state is a pill, the unchecked ones dim.
const STATE = {
  connected: ["Connected", "done"], failed: ["Failed", "ansi1"], auth: ["Needs authentication", "ansi3"],
  unknown: ["absent de claude mcp list", "dim"], unchecked: ["non vérifié", "dim"],
  config: ["config seulement", "dim"], disabled: ["désactivé", "dim"],
};
// The health strip: Claude Code's states as filters (unknown counts as unchecked), FILTERS.md's tints.
const BUCKETS = [["connected", "connectés", "done"], ["failed", "en échec", "ansi1"], ["auth", "à authentifier", "blocked"], ["unchecked", "non vérifiés", "dim"]];
const bucket = (st) => (st === "unknown" ? "unchecked" : st);
// ~/.claude.json -> only what a row shows: env/header names, never their values.
const JQ = `def s: (. // {}) | with_entries(.value |= {type, command, args, url, env: ((.env // {}) | keys), headers: ((.headers // {}) | keys)});
{user: (.mcpServers | s), local: ((.projects[$cwd].mcpServers // .projects[$root].mcpServers) | s)}`;
// ~/.codex/config.toml -> the same shape; env = env's keys + env_vars + bearer_token_env_var.
const PY = `import json, sys, tomllib
try: d = tomllib.load(open(sys.argv[1], "rb")).get("mcp_servers", {})
except FileNotFoundError: d = {}
print(json.dumps({k: {"command": v.get("command"), "args": v.get("args"), "url": v.get("url"), "enabled": v.get("enabled", True),
  "env": sorted((v.get("env") or {}).keys()) + [str(x) for x in (v.get("env_vars") or [])] + ([v["bearer_token_env_var"]] if v.get("bearer_token_env_var") else []),
  "headers": sorted({**(v.get("http_headers") or {}), **(v.get("env_http_headers") or {})}.keys())} for k, v in d.items()}))`;
// `claude mcp get "$1"` in the shell Herdr's terminals start (Vérifier's, below), the name as an
// argument, never in the command text (names come from config files).
// ponytail: sh/bash/zsh/fish take -lic; another $SHELL may not.
const GET = `exec "\${SHELL:-/bin/zsh}" -lic 'env -u ANTHROPIC_API_KEY claude mcp get "$1"' _ "$1"`;

// shared: cwd -> { at, map: { name: state } } from `claude mcp list`.
const HEALTH = "kt-mcp.health";

const parse = (s) => { try { return JSON.parse(s ?? ""); } catch { return null; } };
const read = (p) => readTextFile(p).catch(() => null);
const tilde = (p) => (p && (p === home() || p.startsWith(home() + "/")) ? `~${p.slice(home().length)}` : p ?? "");
// What went wrong, not the login shell's rc noise (zle, gitstatus…).
const cause = (r) => `${r.stderr}\n${r.stdout}`.split("\n").map((s) => s.trim())
  .filter((s) => /claude|mcp|server|error|auth|login/i.test(s) && !/gitstatus|zle|setopt|zshrc/i.test(s)).pop();

function ago(at) {
  const s = Math.max(0, (Date.now() - at) / 1000);
  if (s < 60) return "à l'instant";
  const m = Math.floor(s / 60);
  if (m < 60) return `il y a ${m} min`;
  const h = Math.floor(m / 60);
  return h < 24 ? `il y a ${h} h` : `il y a ${Math.floor(h / 24)} j`;
}

// Shown: kbrdn-threads' main "view" stack is on this page, or this copy is a dialog.
function find(node, id) {
  if (node?.id === id) return node;
  for (const c of node?.children ?? []) {
    const f = find(c, id);
    if (f) return f;
  }
  return null;
}
function visible() {
  if (props()?.overlay) return true;
  const v = find(layout(), "view");
  return (v?.active ?? v?.children?.[0]?.id) === "mcp";
}
const activeSpace = () => spaces().find((s) => s.active);

export default class Mcp extends View {
  init(_props, cx) {
    // + Ajouter's popup or dialog: this mod again, in that role only (no reads, no page keys).
    const add = props()?.add;
    if (add) {
      const m = METHODS.find((x) => x.id === add);
      this.role = add === "menu" ? new AddMenu("kt-mcp", METHODS, cx) : m ? new AddForm("kt-mcp", m, cx) : null;
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
    this.query = "";
    this.seg = "all";
    this.stateF = null; // the health strip's filter: a BUCKETS key, null: every state
    this.items = [];
    this.errors = {}; // provider -> what failed while reading its config
    this.scope = null; // { cwd, root } of the shown space, null: none (global)
    this.global = false; // "Global" pressed in a project scope; a space change resets it
    this.space = undefined; // the space the last read looked at
    this.busy = false;
    this.read = false;
    this.hot = null; // the hovered row's key
    this.open = null; // the detail's server key
    this.gets = {}; // server key -> { at, cwd, state, text (masked), failed } from `claude mcp get`
    this.getting = null; // { i, n, name, key }: the `claude mcp get` running, in a series of n
    this.multi = new Select(); // the rows selected for the bulk bar (keys)
    this.width = 1100;
    this.programs = {}; // Herdr's program table (knownAgents): key -> Program
    this.verifying = false;
    this.verifyError = null;
    this.vim = new Vim({ field: true });
    this.cur = null; // the keys' cursor (a server key); null: the first one shown
    this.listScroll = ScrollHandle.new();
    this.detailScroll = ScrollHandle.new();
    this.segRow = filterState(); // the filter rows (filters.js)
    this.healthRow = filterState();
    this.motion = motionState(); // motion.js: the detail and the bulk bar fade in
    this.headW = 0; // the head card's width (its dither)
    this.more = false; // the head's ⋯ menu
    this.readAt = 0;
    this.mtimes = undefined; // ~/.claude.json's and the project's .mcp.json's, as last seen
    if (!checking()) {
      // Outside Herdr (DATA-SYNC.md): ~/.claude.json sits at home's root, not watched; its mtime and
      // the project's .mcp.json's, compared every 5 s, and only while the page shows.
      cx.timer.every(5000, (cx) => {
        if (!visible() || this.busy) return;
        const files = [`${home()}/.claude.json`, ...(this.proj() ? [`${this.proj().root}/.mcp.json`] : [])];
        cx.spawn(async (cx) => {
          const r = await exec("/usr/bin/stat", ["-f", "%m", ...files]).catch(() => null);
          const sig = `${files.join("|")}:${r?.stdout.trim() ?? ""}`;
          if (this.mtimes !== undefined && sig !== this.mtimes) this.reload(cx);
          this.mtimes = sig;
        });
      });
    }
    if (checking()) return;
    cx.spawn(async (cx) => {
      try { for (const p of await knownAgents()) this.programs[p.key] = p; } catch {}
      cx.notify();
    });
    // The keyboard left without a render (a click on a terminal): the cursor goes out.
    // Recorded here too: a hidden copy never renders, so a stale `keyed` would notify every second.
    cx.timer.every(1000, (cx) => { const f = this.handle.is_focused(); if (this.keyed !== f) { this.keyed = f; cx.notify(); } });
    // `focus` (pane.go) takes the keyboard in NORMAL; `key:<keys>` takes it and types those keys
    // ("j", "g g", "/ g i t"), for tests.
    cx.spawn(async (cx) => {
      for (;;) {
        const c = await nextCommand();
        if (c === "focus") this.focusIn();
        else if (c.startsWith("key:")) {
          this.focusIn();
          for (const k of keysOf(c.slice(4))) this.press(k, cx);
        }
        else if (c === "refresh") this.reload(cx);
        else if (c === "verify") this.verify(cx);
        else if (c === "add") this.openAdd();
        else if (c.startsWith("tab:") && SEGS.some(([k]) => k === c.slice(4))) this.seg = c.slice(4);
        else if (c === "close" && props()?.overlay) closeOverlay(props().overlay);
        // `bulk:<id>`: the bulk bar's action of that id (verify, copy, zed), as its click, for tests.
        else if (c.startsWith("bulk:")) this.bulkActions?.find(([id]) => id === c.slice(5))?.[3](cx);
        cx.notify();
      }
    });
  }

  // ---------- data ----------

  // The shown space's folder (its agent's, else its first terminal's) and git root. Local spaces only.
  async projectScope() {
    const s = activeSpace();
    if (!s || s.machine) return null;
    const tab = s.tabs.find((x) => x.active);
    const mine = panes().filter((p) => p.tab === tab?.id && p.terminal);
    const cwd = (mine.find((p) => p.program?.agent) ?? mine[0])?.cwd ?? s.folder;
    if (!cwd) return null;
    const r = await exec("git", ["-C", cwd, "rev-parse", "--show-toplevel"]).catch(() => null);
    return { cwd, root: r?.code === 0 ? r.stdout.trim() : cwd };
  }

  proj() {
    return this.global ? null : this.scope;
  }

  // Where `claude mcp list` and `claude mcp get` run: the project's folder, else home.
  verifyCwd() {
    return this.proj()?.cwd ?? home();
  }

  async claude(h, proj) {
    const file = `${h}/.claude.json`;
    const r = await exec("jq", ["-c", "--arg", "cwd", proj?.cwd ?? "", "--arg", "root", proj?.root ?? "", JQ, file]);
    if (r.code) throw new Error(r.stderr.trim() || `jq a échoué (code ${r.code})`);
    const d = JSON.parse(r.stdout);
    const out = [];
    const add = (scope, servers, from, listName = (n) => n) => {
      for (const [n, v] of Object.entries(servers ?? {})) out.push(server("claude", scope, n, v, from, listName(n)));
    };
    if (proj) {
      add("local", d.local, file);
      const mcp = `${proj.root}/.mcp.json`;
      add("project", parse(await read(mcp))?.mcpServers, mcp);
    }
    add("user", d.user, file);
    // Enabled plugins (user settings): their install's .mcp.json, or plugin.json's mcpServers.
    const [st, inst] = await Promise.all([read(`${h}/.claude/settings.json`), read(`${h}/.claude/plugins/installed_plugins.json`)]);
    const installed = parse(inst)?.plugins ?? {};
    for (const [key, on] of Object.entries(parse(st)?.enabledPlugins ?? {})) {
      if (on !== true) continue;
      const all = installed[key] ?? [];
      const dir = (all.find((x) => x.scope === "user") ?? all.find((x) => x.projectPath === proj?.root) ?? all[0])?.installPath;
      if (!dir) continue;
      const plugin = key.split("@")[0];
      const manifest = `${dir}/.claude-plugin/plugin.json`;
      const m = parse(await read(manifest))?.mcpServers;
      let from = manifest, servers = m;
      if (!m || typeof m === "string") {
        from = typeof m === "string" ? `${dir}/${m.replace(/^\.\//, "")}` : `${dir}/.mcp.json`;
        const j = parse(await read(from));
        servers = j?.mcpServers ?? j;
      }
      if (servers && typeof servers === "object") add("plugin", servers, from, (n) => `plugin:${plugin}:${n}`);
    }
    return out;
  }

  async codex(h) {
    const file = `${h}/.codex/config.toml`;
    const r = await exec("python3", ["-c", PY, file]);
    if (r.code) throw new Error(r.stderr.trim().split("\n").pop() || `python3 a échoué (code ${r.code})`);
    return Object.entries(JSON.parse(r.stdout)).map(([n, v]) => server("codex", "user", n, v, file));
  }

  async cursor(h) {
    const file = `${h}/.cursor/mcp.json`;
    const text = await read(file);
    return Object.entries(text ? JSON.parse(text).mcpServers ?? {} : {}).map(([n, v]) => server("cursor", "user", n, v, file));
  }

  async opencode(h) {
    let file = `${h}/.config/opencode/opencode.json`;
    let text = await read(file);
    if (text == null) text = await read((file += "c"));
    return Object.entries(text ? jsonc(text).mcp ?? {} : {}).map(([n, v]) => server("opencode", "user", n, v, file));
  }

  reload(cx) {
    if (this.busy) return;
    this.busy = true;
    const space = activeSpace()?.id ?? null;
    if (space !== this.space) this.global = false;
    this.space = space;
    cx.spawn(async (cx) => {
      try {
        const h = home();
        this.scope = await this.projectScope();
        const proj = this.proj();
        const got = await Promise.all([this.claude(h, proj), this.codex(h), this.cursor(h), this.opencode(h)]
          .map((p) => p.catch((e) => ({ error: maskText(String(e?.message ?? e)) }))));
        this.errors = {};
        const items = [];
        got.forEach((g, i) => (g.error ? (this.errors[PROVIDERS[i].key] = g.error) : items.push(...g)));
        const order = (x) => PROVIDERS.findIndex((p) => p.key === x.provider) * 10 + SCOPES.indexOf(x.scope);
        this.items = items.sort((a, b) => order(a) - order(b) || a.name.localeCompare(b.name));
        this.multi.keep(this.items.map((x) => x.key)); // gone (another project): out of the selection
      } finally {
        this.busy = false;
        this.read = true;
        this.readAt = Date.now();
        cx.notify();
      }
    });
  }

  // `claude mcp list` (it starts every server to test it): on click only, 60 s max.
  verify(cx) {
    if (this.verifying || checking()) return;
    const cwd = this.verifyCwd();
    this.verifying = true;
    this.verifyError = null;
    cx.spawn(async (cx) => {
      try {
        // In the shell Herdr's terminals start (login + interactive), so servers get the PATH the
        // user's Claude sessions have: exec's own lacks ~/.nix-profile (npx, bunx, node) and every
        // npx/bunx server would read as Failed. Its rc noise goes to stderr.
        // ponytail: sh/bash/zsh/fish take -lic; another $SHELL may not.
        const r = await exec("sh", ["-c", 'exec "${SHELL:-/bin/zsh}" -lic "env -u ANTHROPIC_API_KEY claude mcp list"'], { cwd, timeout: 60e3 });
        const map = parseList(r.stdout);
        if (Object.keys(map).length) {
          // Shared by the page and its dialogs (names and states only); a day's worth is kept.
          const all = Object.fromEntries(Object.entries(shared(HEALTH) ?? {}).filter(([, h]) => Date.now() - h.at < 86400e3));
          setShared(HEALTH, { ...all, [cwd]: { at: Date.now(), map } });
        } else this.verifyError = maskText(cause(r) || `claude mcp list n'a listé aucun serveur (code ${r.code})`);
      } catch (e) {
        const m = String(e?.message ?? e);
        this.verifyError = /time|délai/i.test(m) ? "Délai dépassé : claude mcp list n'a pas fini en 60 s." : maskText(m);
      } finally {
        this.verifying = false;
        cx.notify();
      }
    });
  }

  // `claude mcp get` knows Claude Code's own servers (user, local, project), not the plugins'.
  canGet(x) {
    return x.provider === "claude" && x.scope !== "plugin" && !x.name.startsWith("-");
  }

  // One `claude mcp get` (it starts the server to test it, 60 s max), where Vérifier runs; its output
  // masked before it is kept (it prints env and header values in clear).
  async getOne(x) {
    const cwd = this.verifyCwd();
    let out;
    try {
      const r = await exec("sh", ["-c", GET, "sh", x.name], { cwd, timeout: 60e3 });
      const ok = r.code === 0 && /Status:/.test(r.stdout);
      out = { state: ok ? parseGet(r.stdout) : "unknown", failed: !ok,
        text: ok ? maskGet(r.stdout.trim()) : maskText(cause(r) || `claude mcp get a échoué (code ${r.code})`) };
    } catch (e) {
      const m = String(e?.message ?? e);
      out = { state: "unknown", failed: true, text: /time|délai/i.test(m) ? "Délai dépassé : claude mcp get n'a pas fini en 60 s." : maskText(m) };
    }
    this.gets[x.key] = { at: Date.now(), cwd, ...out };
  }

  // `claude mcp get` over servers, one at a time (each starts its server), the progress in the bulk
  // bar and the detail; the others (plugins, other providers) are skipped and counted.
  getMany(list, cx) {
    if (this.getting || checking()) return;
    const todo = list.filter((x) => this.canGet(x));
    const skipped = list.length - todo.length;
    if (!todo.length) {
      notify({ title: "Rien à vérifier", body: "claude mcp get ne connaît que les serveurs Claude Code (user, local, projet) : « Vérifier » en haut couvre ceux des plugins.", level: "info", timeout: 6000 });
      return;
    }
    this.getting = { i: 0, n: todo.length, name: todo[0].name, key: todo[0].key };
    cx.spawn(async (cx) => {
      for (const [i, x] of todo.entries()) {
        this.getting = { i, n: todo.length, name: x.name, key: x.key };
        cx.notify();
        await this.getOne(x);
      }
      this.getting = null;
      if (todo.length > 1 || skipped) {
        const n = (s) => todo.filter((x) => this.gets[x.key]?.state === s).length;
        const failed = n("failed") + todo.filter((x) => this.gets[x.key]?.failed).length;
        notify({ title: `${todo.length} serveur${todo.length > 1 ? "s" : ""} vérifié${todo.length > 1 ? "s" : ""}`,
          body: `${n("connected")} connectés · ${n("failed")} en échec · ${n("auth")} à authentifier${skipped ? ` · ${skipped} ignoré${skipped > 1 ? "s" : ""} (plugin ou autre fournisseur)` : ""}`,
          level: failed ? "warning" : "success", timeout: 6000 });
      }
      cx.notify();
    });
  }

  // The newest known state of a Claude Code server: `claude mcp list` (Vérifier) or `claude mcp get`.
  // { state, at, via, cwd } or null (never checked).
  known(x) {
    if (x.provider !== "claude") return null;
    const h = this.healthFor(x.scope);
    const list = h ? { state: h.map[x.listName] ?? "unknown", at: h.at, via: "claude mcp list", cwd: h.cwd } : null;
    const g = this.gets[x.key];
    return g && (!list || g.at >= list.at) ? { state: g.state, at: g.at, via: "claude mcp get", cwd: g.cwd } : list;
  }

  state(x) {
    if (x.disabled) return "disabled";
    if (x.provider !== "claude") return "config";
    return this.known(x)?.state ?? "unchecked";
  }

  // The last `claude mcp list` run where Vérifier would run now ({ cwd, at, map }), else, for
  // user and plugin servers (the same in every folder), the latest run anywhere.
  healthFor(scope = "user") {
    const all = shared(HEALTH) ?? {};
    const here = all[this.verifyCwd()];
    if (here) return { cwd: this.verifyCwd(), ...here };
    if (scope !== "user" && scope !== "plugin") return null;
    const [cwd, h] = Object.entries(all).sort((a, b) => b[1].at - a[1].at)[0] ?? [];
    return h ? { cwd, ...h } : null;
  }

  // The query's matches, before the provider and state filters.
  queried() {
    const q = this.query.trim().toLowerCase();
    return q ? this.items.filter((x) => `${x.name} ${LABEL[x.provider]} ${x.scope} ${x.transport} ${x.target} ${x.env.join(" ")}`.toLowerCase().includes(q)) : this.items;
  }

  // What the list shows: the query's matches of the provider segment, of the health strip's state.
  listed(q = this.queried()) {
    return q.filter((x) => (this.seg === "all" || x.provider === this.seg)
      && (!this.stateF || (x.provider === "claude" && !x.disabled && bucket(this.state(x)) === this.stateF)));
  }

  // Config files in Zed: the row's icon, O on the cursor, the bulk bar (each file once).
  zed(files) {
    for (const f of new Set(files)) exec("open", [`zed://file${f}`]).catch(() => {});
  }

  copy(text, cx, title = "Copié") {
    cx.write_to_clipboard(text);
    notify({ title, body: text, level: "success", timeout: 2000 });
  }

  // + Ajouter's popup (this mod as the menu), with what its forms need: the space, where `claude mcp`
  // runs (local and project scopes belong to that folder), whether a project is shown.
  openAdd() {
    if (checking()) return;
    openOverlay({ mod: "kt-mcp", kind: "popup", frame: "none", ...menuSize(METHODS.length),
      props: { add: "menu", space: activeSpace()?.id ?? null, cwd: this.verifyCwd(), project: Boolean(this.proj()) } });
  }

  async close() {
    await this.role?.dispose?.();
  }

  // The detail: a click, enter / o / l on the cursor.
  show(x) {
    if (this.open === x.key) return;
    this.open = x.key;
    this.detailScroll.scroll_to_item(0);
  }

  // ---------- pieces ----------

  card(t) {
    return v_flex().min_h(0).rounded(16).border(1).border_color(t.border).bg(t.background);
  }

  eyebrow(t, text, color) {
    return div().font_family(MONO).text_size(11).text_color(color ?? t.muted).child(String(text).toUpperCase());
  }

  empty(t, text, color) {
    return div().p(16).text_size(13).text_color(color ?? t.dim).child(text);
  }

  dashed(t) {
    return div().flex_none().h(0).border_t(1).border_dashed().border_color(t.border);
  }

  // A small icon button; it keeps its click from the row.
  icon(t, id, icon, tip, onClick) {
    return div().id(id).p(4).rounded(8).flex_none().text_color(t.muted).cursor_pointer()
      .hover((s) => s.bg(t.raised).text_color(t.foreground)).tooltip(tip)
      .on_click((_e, cx) => { cx.stop_propagation(); onClick(cx); cx.notify(); })
      .child(svg(icon).size(13));
  }

  button(t, id, label, icon, off, onClick) {
    return h_flex().id(id).flex_none().h(32).px(12).gap(6).items_center().rounded_full().border(1).border_color(t.border)
      .text_size(12).text_color(off ? t.dim : t.muted)
      .when(!off, (el) => el.cursor_pointer().hover((s) => s.bg(t.hover).text_color(t.foreground)))
      .on_click((_e, cx) => { if (!off && !checking()) onClick(cx); cx.notify(); })
      .child(icon).child(label);
  }

  // Monocode's program tile: the provider's icon on its color (Herdr's program table, else icons/<key>.svg).
  tile(t, key, size = 34) {
    const def = PROVIDERS.find((p) => p.key === key);
    const p = this.programs[key] ?? Object.values(this.programs).find((q) => q.name === def.label);
    const icon = p?.icon ?? `icons/${key}.svg`;
    const g = Math.round(size * 0.47);
    const glyph = (p ? p.tint : def.tint) ? svg(icon).size(g).text_color(p?.color ?? (p?.tile ? "#ffffff" : t.foreground)) : image(icon).size(g);
    return div().size(size).flex_none().rounded(size > 20 ? 6 : 4).border(1).border_color(alpha(t.foreground, "1a")).bg(p?.tile ?? t.raised).flex().items_center().justify_center().child(glyph);
  }

  // The state: a colored pill (the unchecked ones in dim).
  stateView(t, st) {
    const [label, name] = STATE[st];
    const c = t[name];
    return h_flex().flex_none().h(18).px(7).gap(5).items_center().rounded_full().border(1).border_color(alpha(c, "4d")).bg(alpha(c, "1a"))
      .text_color(c).font_family(MONO).text_size(10).child(div().size(6).rounded_full().bg(c)).child(label.toUpperCase());
  }

  // A row's selection box (select.js): drawn on hover or once a row is selected, its room always
  // kept so the row never moves; a click toggles the row, as ⌘-click does.
  check(t, id, on, shown, onClick) {
    return div().id(id).size(16).flex_none().rounded(5).border(1).flex().items_center().justify_center()
      .when(!shown, (el) => el.border_color(alpha(t.input, "00")))
      .when(shown, (el) => el.border_color(on ? t.accent : t.input).bg(on ? t.accent : t.background).cursor_pointer()
        .hover((s) => s.border_color(t.accent))
        .on_click((_e, cx) => { cx.stop_propagation(); onClick(); cx.notify(); }))
      .when(on, (el) => el.child(svg(I("check")).size(11).text_color(t.accent_foreground)));
  }

  // The bulk bar (select.js): floats over the list's foot while rows are selected: how many, the
  // actions ([id, label, icon, onClick]) or the running series, ✕ to empty. A card (radius 12,
  // shadow), its buttons 4 px in: 8.
  bulkBar(t, n, actions, progress) {
    // It fades in and rises 6 px when a first row is selected (motion.js).
    // Narrow (the detail and the panel open), its buttons wrap rather than leave the list.
    return h_flex().absolute().bottom(12).left(0).right(0).px(8).justify_center()
      .child(enter(this.m, div().max_w_full(), "ktm-bulk-in").child(h_flex().id("ktm-bulk").max_w_full().flex_wrap().p(4).gap(2).items_center().rounded(12).border(1).border_color(t.border).bg(t.popover).shadow_lg()
        .on_mouse_down("left", (_e, cx) => cx.stop_propagation())
        .child(div().pl(10).pr(8).font_family(MONO).text_size(11).text_color(t.foreground).child(`${n} sélectionné${n > 1 ? "s" : ""}`))
        .child(div().w(1).h(18).flex_none().bg(t.border))
        .when(Boolean(progress), (el) => el.child(h_flex().h(28).px(10).gap(6).items_center().text_size(12).text_color(t.muted)
          .child(svg(I("refresh-cw")).size(13).spin(900)).child(progress ?? "")))
        .when(!progress, (el) => el.children(actions.map(([id, label, icon, onClick]) => h_flex().id(`ktm-bulk-${id}`).h(28).px(10).gap(6).items_center().rounded(8)
          .text_size(12).text_color(t.foreground).cursor_pointer().hover((s) => s.bg(t.hover))
          .on_click((_e, cx) => { onClick(cx); cx.notify(); })
          .child(svg(icon).size(13)).child(label))))
        .child(h_flex().id("ktm-bulk-clear").size(28).flex_none().items_center().justify_center().rounded(8).text_color(t.muted)
          .cursor_pointer().hover((s) => s.bg(t.hover).text_color(t.foreground)).tooltip("Vider la sélection (esc)")
          .on_click((_e, cx) => { this.multi.clear(); cx.notify(); })
          .child(svg(I("x")).size(13)))));
  }

  // The bar's actions on the selected servers (hidden by a filter or not), in list order.
  bulk(t) {
    const picked = this.multi.pick(this.items, (x) => x.key);
    this.bulkActions = null;
    if (!picked.length) return null;
    const g = this.getting;
    this.bulkActions = [
      ["verify", "Vérifier", I("circle-check"), (cx) => this.getMany(picked, cx)],
      ["copy", "Copier les noms", OWN("copy"), (cx) => this.copy(picked.map((x) => x.name).join("\n"), cx, `${picked.length} nom${picked.length > 1 ? "s" : ""} copié${picked.length > 1 ? "s" : ""}`)],
      ["zed", "Ouvrir les configs", I("external-link"), () => this.zed(picked.map((x) => x.file))],
    ];
    return this.bulkBar(t, picked.length, this.bulkActions, g && `claude mcp get ${g.i + 1}/${g.n} · ${g.name}…`);
  }

  // ---------- keys (vim.js; kt-keys lists them) ----------

  // The keyboard comes here (pane.go, a key command): NORMAL, the cursor kept, else the first row.
  focusIn() {
    this.handle.focus();
    this.vim.normal();
    this.reveal = true;
  }

  // The cursor's server: this.cur when shown, else the first one.
  at(list) {
    return list.find((x) => x.key === this.cur) ?? list[0] ?? null;
  }

  key(e, cx) {
    if (!this.press(e, cx)) return; // not ours: ctrl-b, cmd-* go on
    cx.stop_propagation();
    cx.notify();
  }

  // One key (an event, or a name from `kt-mcp.key:`): the selection's first (select.js, NORMAL only:
  // x space V ctrl-a esc), then vim's; a visual range then follows the cursor.
  press(k, cx) {
    const order = () => this.listed().map((x) => x.key);
    if (!this.vim.insert && this.multi.key(keyOf(k).name, this.at(this.listed())?.key ?? null, order())) {
      this.vim.normal(); // a `d` or a count typed before it is dropped
      return true;
    }
    if (!this.keyAct(this.vim.handle(k), cx)) return false;
    if (this.multi.visual) this.multi.follow(this.at(this.listed())?.key ?? null, order());
    return true;
  }

  // One vim action; false: not one this page has, and the key goes on.
  keyAct(a, cx) {
    if (!a) return false;
    if (a === "pending" || a === "count" || a === "filter" || a === "normal") return true;
    const list = this.listed();
    const x = this.at(list);
    const i = list.indexOf(x);
    if (a === "type" || a === "backspace") {
      this.query = a === "type" ? this.query + this.vim.char : this.query.slice(0, -1);
      this.cur = null;
    } else if (a === "up" && i <= 0 && !this.vim.insert) this.vim.edit(); // k on the first row: the filter
    else if (["down", "up", "top", "bottom", "half-down", "half-up", "next", "prev"].includes(a)) {
      const j = step(a === "next" ? "down" : a === "prev" ? "up" : a, i, list.length, this.vim.count, 8);
      if (j >= 0) this.cur = list[j].key;
      this.reveal = true;
    } else if (a === "tab-next" || a === "tab-prev") {
      const k = SEGS.findIndex(([id]) => id === this.seg);
      this.seg = SEGS[(k + (a === "tab-next" ? 1 : SEGS.length - 1)) % SEGS.length][0];
      this.cur = null;
    } else if (a === "open" || a === "right" || a === "submit") { if (x) { this.cur = x.key; this.show(x); } }
    else if (a === "open-alt") { if (x) this.zed([x.file]); }
    else if (a === "yank") { if (x) this.copy(x.name, cx); }
    else if (a === "refresh") { if (!checking()) this.reload(cx); }
    else if (a === "archive") this.openAdd(); // a: + Ajouter
    else if (a === "escape" && this.query) {
      this.query = "";
      this.cur = null;
    } else if (a === "escape" || a === "quit") {
      if (props()?.overlay) closeOverlay(props().overlay);
      else run("layout.select", { stack: "view", child: "thread" });
    } else if (a === "help") openOverlay({ mod: "kt-keys", kind: "dialog", width: 1, height: 1, frame: "none", props: { group: "pages" } });
    else return false;
    return true;
  }

  // NORMAL / INSERT (kt-keys' pill), mono 9 px, while the page has the keyboard.
  mode(t, typing) {
    return div().flex_none().h(16).px(6).flex().items_center().rounded(5).border(1)
      .border_color(typing ? alpha(t.accent, "66") : t.border).bg(typing ? alpha(t.accent, "24") : t.background)
      .font_family(MONO).text_size(9).text_color(typing ? t.accent : t.muted).child(this.vim.label);
  }

  // ---------- header ----------

  // Where the states come from: Vérifier running, its error, when it last ran, or how to start.
  verifyLine(t, claude) {
    const cwd = this.verifyCwd();
    const h = this.healthFor();
    let text, color = t.dim;
    if (this.verifying) text = `claude mcp list dans ${tilde(cwd)} : chaque serveur démarre pour être testé (60 s max)…`;
    else if (this.verifyError) { text = this.verifyError; color = t.ansi1; }
    else if (h) {
      const elsewhere = h.cwd !== cwd && claude.some((x) => x.scope === "local" || x.scope === "project");
      text = `vérifié ${ago(h.at)} dans ${tilde(h.cwd)}${elsewhere ? " · local et projet non vérifiés ici" : ""}`;
    } else text = "« Vérifier » lance claude mcp list, qui démarre chaque serveur. Les autres fournisseurs : config seulement.";
    return div().min_w(0).font_family(MONO).text_size(11).line_height("16px").text_color(color).child(text);
  }

  // The health strip: Claude Code's servers by state, each pill a filter (again: every state).
  health(t, claude) {
    const n = Object.fromEntries(BUCKETS.map(([k]) => [k, 0]));
    for (const x of claude) if (!x.disabled) n[bucket(this.state(x))] = (n[bucket(this.state(x))] ?? 0) + 1;
    return v_flex().gap(6)
      .child(filterRow({ id: "ktm-health", t, state: this.healthRow, active: this.stateF, reduced: Boolean(shared("kt.reducedMotion")),
        items: BUCKETS.map(([key, label, tint]) => ({ key, label, tint, count: n[key] })),
        onPick: (k) => { this.stateF = this.stateF === k ? null : k; this.cur = null; } }))
      .child(this.verifyLine(t, claude));
  }

  header(t, q, shown) {
    const typing = this.keyed && this.vim.insert;
    const proj = this.proj();
    const filtered = this.query.trim() || this.seg !== "all" || this.stateF;
    const count = !this.read ? "…" : filtered ? `${shown} / ${this.items.length}` : `${this.items.length} serveurs`;
    const seg = filterRow({ id: "ktm-seg", t, state: this.segRow, active: this.seg, reduced: Boolean(shared("kt.reducedMotion")),
      items: SEGS.map(([key, label]) => ({ key, label, tint: PROVIDERS.find((p) => p.key === key)?.pale,
        count: key === "all" ? q.length : q.filter((x) => x.provider === key).length })),
      onPick: (k) => { this.seg = k; this.cur = null; } });
    // The scope: the shown project's folder, else Global; the Global pill switches a project to the global view.
    const where = h_flex().flex_none().h(32).px(12).gap(7).items_center().rounded_full().border(1).border_color(t.border)
      .child(svg(I(proj ? "folder" : "layers")).size(13).text_color(t.dim))
      .child(div().max_w(220).truncate().text_size(12.5).text_color(proj ? t.foreground : t.muted)
        .child(proj ? (proj.root === home() ? "~" : proj.root.split("/").pop()) : "Global"));
    const globalPill = h_flex().id("ktm-global").flex_none().h(32).px(12).items_center().rounded_full().border(1)
      .border_color(this.global ? alpha(t.accent, "66") : t.border)
      .when(this.global, (el) => el.bg(alpha(t.accent, "24")))
      .when(!this.global, (el) => el.hover((s) => s.bg(t.hover).text_color(t.foreground)))
      .text_size(12).text_color(this.global ? t.foreground : t.muted).cursor_pointer()
      .on_click((_e, cx) => { this.global = !this.global; if (!checking()) this.reload(cx); cx.notify(); })
      .child("Global");
    // DESIGN-REFERENCE.md's head: the band on the page's dither (MCP: accent), the rest under it.
    return this.card(t).id("ktm-head").relative().flex_none().px(4).pb(12).gap(10)
      .on_size_change((s, cx) => { if (s.width !== this.headW) { this.headW = s.width; cx.notify(); } })
      .children([dither(this.headW, 60, 16, t.accent)].filter(Boolean))
      .child(bandRow(t, { color: t.accent, icon: I("plug"), title: "MCP",
        sub: [count, proj ? tilde(proj.root) : "Global", "Claude Code, Codex, Cursor, OpenCode"],
        buttons: [
          iconBtn(t, "ktm-b-add", I("plus"), "Ajouter (a)", () => this.openAdd()),
          pulse(this.m, iconBtn(t, "ktm-b-verify", I("circle-check"), this.verifying ? "Vérification…" : "Vérifier : claude mcp list", (cx) => this.verify(cx), this.verifying), this.verifying),
          iconBtn(t, "ktm-b-refresh", I("refresh-cw"), this.busy ? "Lecture…" : "Rafraîchir (r)", (cx) => { if (!checking()) this.reload(cx); }),
          iconBtn(t, "ktm-b-more", "mods/kt-crosstalk/ellipsis.svg", "Plus", () => { this.more = !this.more; }, this.more)] }))
      .child(div().flex_none().mx(-4).h(0).border_t(1).border_dashed().border_color(alpha(t.accent, "4d")))
      .child(h_flex().px(10).flex_wrap().gap(8).items_center()
        .child(where)
        .when(Boolean(this.scope), (el) => el.child(globalPill))
        // The filter: the keys' ring (and the ink) while typing in it; the mode beside it.
        .child(h_flex().id("ktm-filter").w(260).h(32).px(12).gap(8).items_center().rounded_full().border(1)
          .border_color(typing ? alpha(t.accent, "99") : t.border).when(typing, (el) => el.bg(alpha(t.accent, "24"))).cursor_text()
          .track_focus(this.handle)
          .on_key_down((e, cx) => this.key(e, cx))
          .on_click((_e, cx) => { this.vim.edit(); this.handle.focus(); cx.notify(); })
          .child(svg(I("search")).size(14).flex_none().text_color(t.dim))
          .child(div().flex_1().min_w(0).truncate().text_size(13).text_color(this.query ? t.foreground : t.dim)
            .child(this.query ? this.query + (typing ? "▏" : "") : typing ? "▏" : "Filtrer"))
          .when(Boolean(this.query), (el) => el.child(div().id("ktm-clear").flex_none().text_color(t.dim).cursor_pointer()
            .hover((s) => s.text_color(t.foreground))
            .on_click((_e, cx) => { cx.stop_propagation(); this.query = ""; this.cur = null; cx.notify(); })
            .child(svg(I("x")).size(13)))))
        .when(Boolean(this.keyed), (el) => el.child(this.mode(t, typing))))
      .child(div().px(10).child(this.health(t, this.items.filter((x) => x.provider === "claude"))))
      .child(div().px(10).child(seg));
  }

  // The head's ⋯: the rest of the page's actions.
  moreItems() {
    return [
      ["ktm-mi-add", I("plus"), "Ajouter un serveur… (a)", () => this.openAdd()],
      ["ktm-mi-verify", I("circle-check"), "Vérifier tout : claude mcp list", (cx) => this.verify(cx)],
      this.scope && ["ktm-mi-global", I("layers"), this.global ? "Revenir au projet" : "Vue globale", (cx) => { this.global = !this.global; if (!checking()) this.reload(cx); }],
      ["ktm-mi-zed", I("external-link"), "Ouvrir ~/.claude.json dans Zed", () => this.zed([`${home()}/.claude.json`])],
      ["ktm-mi-keys", I("keyboard"), "Les touches (?)", () => openOverlay({ mod: "kt-keys", kind: "dialog", width: 1, height: 1, frame: "none", props: { group: "pages" } })],
    ];
  }

  // ---------- list ----------

  // A provider's header, one thin line as the sidebar's groups: its logo, its name, how many.
  groupRow(t, key, n, first) {
    return h_flex().flex_none().h(22).mx(4).px(6).mt(first ? 4 : 12).mb(2).gap(7).items_center()
      .child(this.tile(t, key, 16))
      .child(div().min_w(0).truncate().font_family(MONO).text_size(10).text_color(t.muted).child(LABEL[key].toUpperCase()))
      .child(div().flex_none().font_family(MONO).text_size(10).text_color(t.dim).child(String(n)));
  }

  // One dense line: the box, the name, its state, then scope · transport. `cursor`: "ring" (NORMAL:
  // a 1 px accent ring with the ink), "mark" (INSERT: ctrl-n/p's row) or null. The detail's row
  // carries the ink with a 66 border, a selected one a lighter ink and its box checked.
  row(t, x, cursor) {
    const hot = x.key === this.hot;
    const on = x.key === this.open;
    const picked = this.multi.has(x.key);
    const st = this.state(x);
    const getting = this.getting?.key === x.key;
    return h_flex().id(`ktm-row-${x.key}`).flex_none().h(38).pl(10).pr(6).gap(10).items_center().rounded(12).border(1)
      .border_color(cursor === "ring" ? alpha(t.accent, "99") : on ? alpha(t.accent, "66") : alpha(t.border, "00"))
      .bg(on || cursor === "ring" ? alpha(t.accent, "24") : picked ? alpha(t.accent, "14") : cursor === "mark" ? t.hover : t.background)
      .when(!cursor && !on && !picked, (el) => el.hover((s) => s.bg(t.hover)))
      .cursor_pointer()
      .on_click((e, cx) => {
        this.cur = x.key;
        if (!this.multi.click(e.modifiers, x.key, this.listed().map((y) => y.key))) this.show(x);
        cx.notify();
      })
      .on_hover((h, cx) => {
        const next = h ? x.key : this.hot === x.key ? null : this.hot;
        if (next !== this.hot) { this.hot = next; cx.notify(); }
      })
      .child(this.check(t, `ktm-check-${x.key}`, picked, picked || hot || this.multi.size > 0, () => this.multi.toggle(x.key)))
      .child(div().min_w(0).truncate().font_family(MONO).text_size(13).font_medium().text_color(x.disabled ? t.muted : t.foreground).child(x.name))
      .child(this.stateView(t, st))
      .when(getting, (el) => el.child(svg(I("refresh-cw")).size(12).flex_none().text_color(t.dim).spin(900)))
      .child(div().flex_1())
      .when(hot, (el) => el.child(h_flex().flex_none().gap(2)
        .child(this.icon(t, `ktm-copy-${x.key}`, OWN("copy"), "Copier le nom", (cx) => this.copy(x.name, cx)))
        .child(this.icon(t, `ktm-zed-${x.key}`, I("external-link"), "Ouvrir la config dans Zed", () => this.zed([x.file])))))
      .child(div().flex_none().pr(6).font_family(MONO).text_size(11).text_color(t.dim).child(`${x.scope} · ${x.transport}`));
  }

  list(t, shown) {
    const card = this.card(t).flex_1().min_w(0).h_full();
    const errors = Object.entries(this.errors).map(([k, e]) => this.empty(t, `${LABEL[k]} : ${e}`, t.ansi1).py(6));
    const rows = [...errors];
    if (!shown.length) rows.push(this.empty(t, !this.read || this.busy ? "Lecture des configs…" : this.items.length ? "Aucun serveur ne correspond au filtre." : "Aucun serveur MCP configuré."));
    const per = {};
    for (const x of shown) per[x.provider] = (per[x.provider] ?? 0) + 1;
    // The keys' cursor, while the page has the keyboard: its row, brought into view once after it moved.
    const typing = this.keyed && this.vim.insert;
    const cur = this.keyed ? this.at(shown)?.key : null;
    shown.forEach((x, i) => {
      if (i === 0 || shown[i - 1].provider !== x.provider) rows.push(this.groupRow(t, x.provider, per[x.provider], i === 0));
      if (this.reveal && x.key === cur) {
        this.listScroll.scroll_to_item(rows.length);
        this.reveal = false;
      }
      rows.push(this.row(t, x, x.key === cur ? (typing ? "mark" : "ring") : null));
    });
    const bar = this.bulk(t);
    // The bulk bar floats over the rows' foot: room under the last row so it never hides it.
    return card
      .child(v_flex().flex_1().min_h(0).relative()
        .child(v_flex().id("ktm-list").flex_1().min_h(0).overflow_y_scrollbar().track_scroll(this.listScroll).p(4).gap(2)
          .when(Boolean(bar), (el) => el.pb(64)).children(rows))
        .when(Boolean(bar), (el) => el.child(bar)))
      .child(this.dashed(t))
      .child(h_flex().flex_none().px(14).py(8).gap(8).items_center()
        .child(svg(I("circle-alert")).size(12).flex_none().text_color(t.dim))
        .child(div().flex_1().min_w(0).text_size(11.5).text_color(t.dim)
          .child("Modifications via claude mcp uniquement : « Ajouter » passe par claude mcp add, après confirmation. Suppression et connexion (Sign in) : claude mcp remove, /mcp.")));
  }

  // ---------- detail ----------

  // A mono block on t.raised, radius 12 (inner boxes sit 4 px in the 16 cards), one line per row.
  block(t, text, color) {
    return v_flex().flex_none().rounded(12).border(1).border_color(t.border).bg(t.raised).px(12).py(10)
      .font_family(MONO).text_size(11.5).line_height("18px").text_color(color ?? t.foreground)
      .children(String(text).split("\n").map((l) => div().child(l || " ")));
  }

  detail(t, x, w) {
    const k = this.known(x);
    const st = this.state(x);
    const g = this.gets[x.key];
    const running = this.getting?.key === x.key;
    const pair = (label, v, mono = true) => h_flex().gap(10).items_start()
      .child(this.eyebrow(t, label, t.dim).w(96).flex_none().pt(1))
      .child(div().flex_1().min_w(0).when(mono, (el) => el.font_family(MONO)).text_size(12).text_color(v ? t.foreground : t.dim).child(v || "—"));
    const when = k ? `${k.via} ${ago(k.at)} dans ${tilde(k.cwd)}` : x.provider === "claude" ? "jamais vérifié ici" : "config seulement : seul Claude Code est vérifiable";
    // The card (16): DESIGN-REFERENCE.md's band on the page's dither (its width is known: w), the
    // provider's tile as the mark with the state's dot; it fades in and rises when a server opens.
    const dot = { connected: t.done, failed: t.ansi1, auth: t.ansi3 }[st] ?? null;
    const card = this.card(t).w(w).flex_none().h_full().relative().px(4).pb(4).overflow_hidden()
      .children([dither(w, 60, 16, t.accent)].filter(Boolean))
      .child(bandRow(t, { mark: this.tile(t, x.provider, 32), dot, title: x.name, sub: [LABEL[x.provider], x.scope, x.transport],
        buttons: [
          iconBtn(t, "ktm-d-copy", OWN("copy"), "Copier le nom (y)", (cx) => this.copy(x.name, cx)),
          iconBtn(t, "ktm-d-zed", I("external-link"), "Ouvrir la config dans Zed (O)", () => this.zed([x.file])),
          this.canGet(x) && pulse(this.m, iconBtn(t, "ktm-d-get", I("circle-check"), running ? "claude mcp get…" : "Tester : claude mcp get",
            (cx) => { if (!this.getting) this.getMany([x], cx); }, running), running),
          iconBtn(t, "ktm-close", I("x"), "Fermer", () => { this.open = null; })] }))
      .child(div().flex_none().mx(-4).h(0).border_t(1).border_dashed().border_color(alpha(t.accent, "4d")))
      .child(v_flex().id("ktm-detail").flex_1().min_h(0).overflow_y_scrollbar().track_scroll(this.detailScroll).px(10).pt(10).pb(16).gap(14)
        .child(h_flex().gap(8).items_center().child(this.stateView(t, st))
          .child(div().min_w(0).truncate().font_family(MONO).text_size(11).text_color(t.dim).child(when)))
        .child(this.dashed(t))
        .child(v_flex().gap(6)
          .child(pair("Transport", x.transport))
          .child(pair("Portée", x.scope))
          .child(pair("Fichier", tilde(x.file)))
          .when(x.listName !== x.name, (el) => el.child(pair("Dans la liste", x.listName)))
          .child(pair("Cible", x.target))
          .child(pair("Env", x.env.join(", ")))
          .child(pair("Headers", x.headers.join(", "))))
        .child(v_flex().gap(6)
          .child(this.eyebrow(t, "Config · secrets masqués"))
          .child(this.block(t, JSON.stringify(x.config, null, 2))))
        .when(x.provider === "claude", (el) => el.child(v_flex().gap(6)
          .child(this.eyebrow(t, g ? `claude mcp get · ${ago(g.at)} dans ${tilde(g.cwd)}` : "claude mcp get"))
          .child(running ? this.block(t, "Le serveur démarre pour être testé (60 s max)…", t.dim)
            : g ? this.block(t, g.text, g.failed ? t.ansi1 : t.foreground)
            : this.block(t, this.canGet(x) ? "Pas encore lancé : le bouton de test, en haut, démarre le serveur pour le tester." : "claude mcp get ne connaît pas les serveurs de plugin : « Vérifier » en haut les couvre.", t.dim)))));
    return enter(this.m, card, `ktm-detail-${x.key}`);
  }

  render(cx) {
    if (props()?.add) return this.role ? this.role.render(cx) : div();
    this.m = frame(this.motion, Boolean(shared("kt.reducedMotion")));
    // The bus (DATA-SYNC.md): an add here, or a plugin's change in kt-plugins, reads the configs again.
    if (!checking()) refreshOn(this, cx, "data", ["mcp", "plugins"], async (cx) => this.reload(cx));
    const vis = visible();
    if (vis && !checking()) {
      if (!this.shown) {
        // The thread's terminal is hidden under this page: take the keyboard (typing filters),
        // after the app has settled its own focus on the switch.
        // INSERT then, unless pane.go or a key command already gave it the keyboard (NORMAL).
        cx.timer.after(150, (cx) => {
          if (visible() && !this.handle.is_focused()) {
            this.handle.focus();
            this.vim.edit();
          }
          cx.notify();
        });
        // Back on the page: read again when the last read is more than 10 s old (DATA-SYNC.md).
        if (Date.now() - this.readAt > 10e3) this.reload(cx);
      } else if (!this.busy && (activeSpace()?.id ?? null) !== this.space) this.reload(cx);
    }
    if (!vis && this.shown && this.handle.is_focused() && !checking()) {
      // Back to the thread: the keyboard goes back to its terminal.
      const tab = activeSpace()?.tabs.find((c) => c.active)?.id;
      const pane = panes().find((p) => p.tab === tab && p.focused)?.pane;
      if (pane) cx.spawn(async () => run("pane.focus", { pane }));
    }
    this.shown = vis;
    this.keyed = this.handle.is_focused();
    const t = theme();
    const q = this.queried();
    const shown = this.listed(q);
    const x = this.items.find((i) => i.key === this.open);
    // No frame of its own as a page: the work card around it (center: radius 20, padding 4) paints it.
    // As a frameless dialog (frame "none"), the same card drawn here.
    return v_flex().id("ktm-root").size_full().gap(4).text_color(t.foreground)
      .when(Boolean(props()?.overlay), (el) => el.p(4).rounded(20).border(1).border_color(t.border).bg(t.chrome))
      .on_size_change((size, cx) => { if (size.width !== this.width) { this.width = size.width; cx.notify(); } })
      .child(this.header(t, q, shown.length))
      .child(h_flex().flex_1().min_h(0).gap(4)
        .child(this.list(t, shown))
        .when(Boolean(x), (el) => el.child(this.detail(t, x, Math.round(this.width * 0.42)))))
      // The head's ⋯, last so that it draws over the list.
      .when(this.more, (el) => el.relative().child(moreMenu(t, "ktm-more", props()?.overlay ? 60 : 56, this.moreItems(), () => { this.more = false; })));
  }
}
