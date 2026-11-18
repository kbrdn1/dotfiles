// kbrdn MCP (Monocode's Settings › MCP, kbrdn.dev look): every MCP server configured
// for Claude Code, Codex, Cursor and OpenCode, read-only, as a page: the "mcp" child of
// kbrdn-threads' main "view" stack, or a dialog (openOverlay).
// Sources (read only, never a server started by this mod except through Vérifier):
//   Claude Code: ~/.claude.json mcpServers (user) and projects[<cwd|root>].mcpServers
//   (local), through jq (the file is big and full of secrets); <root>/.mcp.json (project);
//   the enabled plugins' .mcp.json or plugin.json mcpServers (plugin). ~/.claude/mcp.json is
//   not read by Claude Code, so not here either.
//   Codex: ~/.codex/config.toml [mcp_servers.*] through python3's tomllib. Cursor:
//   ~/.cursor/mcp.json. OpenCode: ~/.config/opencode/opencode.json(c), key "mcp".
// Env, headers and tokens: names only, values never leave jq/python or are dropped at once;
// args and URLs are masked (mcp.js). States: "Vérifier" runs `claude mcp list` (it starts
// every server: only on click, 60 s max, in the project's folder, through the login shell),
// kept in shared "kt-mcp.health" (names and states); other providers are config only. Reads when the page shows, when the shown space changes while it shows, and
// on Rafraîchir; never on a timer. Mod commands: kt-mcp.refresh, kt-mcp.verify, kt-mcp.tab:<key>,
// kt-mcp.close (a dialog copy closes itself).

import { View, div, svg, image } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { exec, readTextFile, theme, spaces, panes, run, layout, props, home, notify, nextCommand, knownAgents, closeOverlay, shared, setShared, checking } from "herdr";
import { server, parseList, jsonc, maskText } from "./mcp.js";

const MONO = "Monaspace Krypton";
const I = (name) => `mods/kt-threads/${name}.svg`;
const OWN = (name) => `mods/kt-mcp/${name}.svg`;
// A theme color with alpha `a`, replacing any it has (glass themes are #rrggbbaa).
const alpha = (c, a) => `${String(c).slice(0, 7)}${a}`;
// `tint`: the fallback icon (icons/<key>.svg) is a one-color glyph.
const PROVIDERS = [
  { key: "claude", label: "Claude Code", tint: false },
  { key: "codex", label: "Codex", tint: false },
  { key: "cursor", label: "Cursor", tint: true },
  { key: "opencode", label: "OpenCode", tint: true },
];
const LABEL = Object.fromEntries(PROVIDERS.map((p) => [p.key, p.label]));
const SEGS = [["all", "Tous"], ...PROVIDERS.map((p) => [p.key, p.label])];
const SCOPES = ["local", "project", "user", "plugin"];
// state -> label, theme color name, shown as a colored pill.
const STATE = {
  connected: ["Connected", "done", true], failed: ["Failed", "ansi1", true], auth: ["Needs authentication", "ansi3", true],
  unknown: ["absent de claude mcp list", "dim", false], unchecked: ["non vérifié", "dim", false],
  config: ["config seulement", "dim", false], disabled: ["désactivé", "dim", false],
};
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

// shared: cwd -> { at, map: { name: state } } from `claude mcp list`.
const HEALTH = "kt-mcp.health";

const parse = (s) => { try { return JSON.parse(s ?? ""); } catch { return null; } };
const read = (p) => readTextFile(p).catch(() => null);
const tilde = (p) => (p && (p === home() || p.startsWith(home() + "/")) ? `~${p.slice(home().length)}` : p ?? "");

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
    this.handle = cx.focus_handle();
    this.query = "";
    this.seg = "all";
    this.items = [];
    this.errors = {}; // provider -> what failed while reading its config
    this.scope = null; // { cwd, root } of the shown space, null: none (global)
    this.global = false; // "Global" pressed in a project scope; a space change resets it
    this.space = undefined; // the space the last read looked at
    this.busy = false;
    this.read = false;
    this.hot = null; // the hovered row's key
    this.programs = {}; // Herdr's program table (knownAgents): key -> Program
    this.verifying = false;
    this.verifyError = null;
    if (checking()) return;
    cx.spawn(async (cx) => {
      try { for (const p of await knownAgents()) this.programs[p.key] = p; } catch {}
      cx.notify();
    });
    cx.spawn(async (cx) => {
      for (;;) {
        const c = await nextCommand();
        if (c === "refresh") this.reload(cx);
        else if (c === "verify") this.verify(cx);
        else if (c.startsWith("tab:") && SEGS.some(([k]) => k === c.slice(4))) this.seg = c.slice(4);
        else if (c === "close" && props()?.overlay) closeOverlay(props().overlay);
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

  // Where `claude mcp list` runs: the project's folder, else home.
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
      } finally {
        this.busy = false;
        this.read = true;
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
        } else {
          // The cause, not the login shell's rc noise (zle, gitstatus…).
          const why = `${r.stderr}\n${r.stdout}`.split("\n").map((s) => s.trim())
            .filter((s) => /claude|mcp|error|auth|login/i.test(s) && !/gitstatus|zle|setopt|zshrc/i.test(s)).pop();
          this.verifyError = maskText(why || `claude mcp list n'a listé aucun serveur (code ${r.code})`);
        }
      } catch (e) {
        const m = String(e?.message ?? e);
        this.verifyError = /time|délai/i.test(m) ? "Délai dépassé : claude mcp list n'a pas fini en 60 s." : maskText(m);
      } finally {
        this.verifying = false;
        cx.notify();
      }
    });
  }

  state(x) {
    if (x.disabled) return "disabled";
    if (x.provider !== "claude") return "config";
    const h = this.healthFor(x.scope);
    return h ? h.map[x.listName] ?? "unknown" : "unchecked";
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

  // The query's matches, before the provider filter.
  queried() {
    const q = this.query.trim().toLowerCase();
    return q ? this.items.filter((x) => `${x.name} ${LABEL[x.provider]} ${x.scope} ${x.transport} ${x.target} ${x.env.join(" ")}`.toLowerCase().includes(q)) : this.items;
  }

  copy(text, cx) {
    cx.write_to_clipboard(text);
    notify({ title: "Copié", body: text, level: "success", timeout: 2000 });
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
  tile(t, key) {
    const def = PROVIDERS.find((p) => p.key === key);
    const p = this.programs[key] ?? Object.values(this.programs).find((q) => q.name === def.label);
    const icon = p?.icon ?? `icons/${key}.svg`;
    const g = (p ? p.tint : def.tint) ? svg(icon).size(16).text_color(p?.color ?? (p?.tile ? "#ffffff" : t.foreground)) : image(icon).size(16);
    return div().size(34).flex_none().rounded(6).border(1).border_color(alpha(t.foreground, "1a")).bg(p?.tile ?? t.raised).flex().items_center().justify_center().child(g);
  }

  // The state: a colored pill once known, plain text otherwise.
  stateView(t, st) {
    const [label, name, pill] = STATE[st];
    const c = t[name];
    if (!pill) return div().text_color(t.dim).child(label);
    return h_flex().flex_none().h(18).px(7).gap(5).items_center().rounded_full().border(1).border_color(alpha(c, "4d")).bg(alpha(c, "1a"))
      .text_color(c).font_family(MONO).text_size(10).child(div().size(6).rounded_full().bg(c)).child(label.toUpperCase());
  }

  // ---------- header ----------

  key(e, cx) {
    if (e.key === "escape") { if (!this.query) return; this.query = ""; }
    else if (e.key === "backspace") this.query = this.query.slice(0, -1);
    else if (e.key_char && !e.modifiers?.control && !e.modifiers?.platform) this.query += e.key_char;
    else return;
    cx.stop_propagation();
    cx.notify();
  }

  verifyLine(t, claude) {
    const cwd = this.verifyCwd();
    const h = this.healthFor();
    let text, color = t.dim;
    if (this.verifying) text = `claude mcp list dans ${tilde(cwd)} : chaque serveur démarre pour être testé (60 s max)…`;
    else if (this.verifyError) { text = this.verifyError; color = t.ansi1; }
    else if (h) {
      const n = (s) => claude.filter((x) => this.state(x) === s).length;
      const elsewhere = h.cwd !== cwd && claude.some((x) => x.scope === "local" || x.scope === "project");
      text = `Vérifié ${ago(h.at)} dans ${tilde(h.cwd)} · ${n("connected")} connectés · ${n("failed")} en échec · ${n("auth")} à authentifier${elsewhere ? " · local et projet non vérifiés ici" : ""}`;
    } else text = "États Claude Code non vérifiés : « Vérifier » lance claude mcp list, qui démarre chaque serveur. Les autres fournisseurs : config seulement.";
    return div().font_family(MONO).text_size(11).line_height("16px").text_color(color).child(text);
  }

  header(t, q, shown) {
    const typing = this.handle.is_focused();
    const proj = this.proj();
    const filtered = this.query.trim() || this.seg !== "all";
    const count = !this.read ? "…" : filtered ? `${shown} / ${this.items.length}` : `${this.items.length} serveurs`;
    const seg = h_flex().w_full().p(3).gap(2).items_center().rounded_full().border(1).border_color(t.border)
      .children(SEGS.map(([k, label]) => {
        const on = this.seg === k;
        return h_flex().id(`ktm-seg-${k}`).flex_1().min_w(0).h(28).px(11).gap(7).items_center().justify_center().rounded_full().border(1)
          .border_color(on ? alpha(t.accent, "66") : alpha(t.accent, "00"))
          .when(on, (el) => el.bg(alpha(t.accent, "24")))
          .when(!on, (el) => el.hover((s) => s.bg(t.hover).text_color(t.foreground)))
          .text_size(12).text_color(on ? t.foreground : t.muted).cursor_pointer()
          .on_click((_e, cx) => { this.seg = k; cx.notify(); })
          .child(div().truncate().child(label))
          .child(div().flex_none().font_family(MONO).text_size(10.5).text_color(t.dim)
            .child(String(k === "all" ? q.length : q.filter((x) => x.provider === k).length)));
      }));
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
    return this.card(t).flex_none().px(18).pt(16).pb(14).gap(12)
      .child(h_flex().gap(10).items_baseline()
        .child(div().text_size(21).font_semibold().line_height("28px").text_color(t.foreground).child("MCP"))
        .child(div().font_family(MONO).text_size(12).text_color(t.muted).child(count)))
      .child(div().mt(-8).text_size(13).text_color(t.muted)
        .child("Les serveurs MCP configurés pour Claude Code, Codex, Cursor et OpenCode, lus dans leurs fichiers de config."))
      .child(h_flex().flex_wrap().gap(8).items_center()
        .child(where)
        .when(Boolean(this.scope), (el) => el.child(globalPill))
        .child(h_flex().id("ktm-filter").w(260).h(32).px(12).gap(8).items_center().rounded_full().border(1)
          .border_color(typing ? t.accent : t.border).cursor_text()
          .track_focus(this.handle)
          .on_key_down((e, cx) => this.key(e, cx))
          .on_click((_e, cx) => { this.handle.focus(); cx.notify(); })
          .child(svg(I("search")).size(14).flex_none().text_color(t.dim))
          .child(div().flex_1().min_w(0).truncate().text_size(13).text_color(this.query ? t.foreground : t.dim)
            .child(this.query ? this.query + (typing ? "▏" : "") : typing ? "▏" : "Filtrer"))
          .when(Boolean(this.query), (el) => el.child(div().id("ktm-clear").flex_none().text_color(t.dim).cursor_pointer()
            .hover((s) => s.text_color(t.foreground))
            .on_click((_e, cx) => { cx.stop_propagation(); this.query = ""; cx.notify(); })
            .child(svg(I("x")).size(13)))))
        .child(div().flex_1())
        .child(this.button(t, "ktm-verify", this.verifying ? "Vérification…" : "Vérifier",
          this.verifying ? svg(I("refresh-cw")).size(13).spin(900) : svg(I("circle-check")).size(13), this.verifying, (cx) => this.verify(cx)))
        .child(this.button(t, "ktm-refresh", this.busy ? "Lecture…" : "Rafraîchir", svg(I("refresh-cw")).size(13), this.busy, (cx) => this.reload(cx))))
      .child(this.verifyLine(t, this.items.filter((x) => x.provider === "claude")))
      .child(seg);
  }

  // ---------- list ----------

  groupRow(t, label, n, first) {
    return h_flex().px(8).pt(first ? 6 : 14).pb(6).gap(10).items_center()
      .child(this.eyebrow(t, `${label} · ${n}`).flex_none())
      .child(div().flex_1().h(0).border_t(1).border_dashed().border_color(t.border));
  }

  row(t, x) {
    const hot = x.key === this.hot;
    const st = this.state(x);
    const extra = [x.env.length ? `env: ${x.env.join(", ")}` : "", x.headers.length ? `headers: ${x.headers.join(", ")}` : ""].filter(Boolean).join(" · ");
    // Concentric: the row (12, inside the list's p 4) holds its tile in its corner at p 6, so the tile is 6.
    return h_flex().id(`ktm-row-${x.key}`).p(6).gap(12).items_start().rounded(12).border(1).border_color(t.border).bg(t.background)
      .hover((s) => s.bg(t.hover))
      .on_hover((h, cx) => {
        const next = h ? x.key : this.hot === x.key ? null : this.hot;
        if (next !== this.hot) { this.hot = next; cx.notify(); }
      })
      .child(this.tile(t, x.provider))
      .child(v_flex().flex_1().min_w(0).py(4).pr(8).gap(3)
        .child(h_flex().h(22).gap(8).items_center()
          .child(div().min_w(0).truncate().font_family(MONO).text_size(13).font_medium().text_color(x.disabled ? t.muted : t.foreground).child(x.name))
          .child(div().flex_1())
          .when(hot, (el) => el.child(h_flex().flex_none().gap(2)
            .child(this.icon(t, `ktm-copy-${x.key}`, OWN("copy"), "Copier le nom", (cx) => this.copy(x.name, cx)))
            .child(this.icon(t, `ktm-zed-${x.key}`, I("external-link"), "Ouvrir la config dans Zed", () => exec("open", [`zed://file${x.file}`]).catch(() => {})))
            .when(x.provider === "claude" && st === "failed", (el) => el.child(this.icon(t, `ktm-diag-${x.key}`, "mods/workspace-chrome/terminal.svg",
              `Copier « claude mcp get ${x.listName} »`, (cx) => this.copy(`claude mcp get ${x.listName}`, cx)))))))
        .child(h_flex().h(18).gap(6).items_center().text_size(12.5).text_color(t.muted)
          .child(div().flex_none().child(`${LABEL[x.provider]} · ${x.scope} · ${x.transport} ·`))
          .child(this.stateView(t, st)))
        .child(h_flex().gap(10).items_center().font_family(MONO).text_size(11.5).text_color(t.dim)
          .child(div().flex_1().min_w(0).truncate().child(x.target || "—"))
          .when(Boolean(extra), (el) => el.child(div().flex_none().max_w(320).truncate().text_color(t.muted).child(extra))))
        .child(div().truncate().font_family(MONO).text_size(11).text_color(t.dim).child(tilde(x.file))));
  }

  list(t, shown) {
    const card = this.card(t).flex_1().min_w(0);
    const errors = Object.entries(this.errors).map(([k, e]) => this.empty(t, `${LABEL[k]} : ${e}`, t.ansi1).py(6));
    const rows = [...errors];
    if (!shown.length) rows.push(this.empty(t, !this.read || this.busy ? "Lecture des configs…" : this.items.length ? "Aucun serveur ne correspond au filtre." : "Aucun serveur MCP configuré."));
    const per = {};
    for (const x of shown) per[x.provider] = (per[x.provider] ?? 0) + 1;
    shown.forEach((x, i) => {
      if (this.seg === "all" && (i === 0 || shown[i - 1].provider !== x.provider)) rows.push(this.groupRow(t, LABEL[x.provider], per[x.provider], i === 0));
      rows.push(this.row(t, x));
    });
    return card
      .child(v_flex().id("ktm-list").flex_1().min_h(0).overflow_y_scrollbar().p(4).gap(4).children(rows))
      .child(div().flex_none().h(0).border_t(1).border_dashed().border_color(t.border))
      .child(h_flex().flex_none().px(14).py(8).gap(8).items_center()
        .child(svg(I("circle-alert")).size(12).flex_none().text_color(t.dim))
        .child(div().flex_1().min_w(0).text_size(11.5).text_color(t.dim)
          .child("Lecture seule : ajout, suppression et connexion (Sign in) ne sont pas proposés ici, ~/.claude.json est critique. Passe par claude mcp add / remove ou /mcp.")));
  }

  render(cx) {
    const vis = visible();
    if (vis && !checking()) {
      if (!this.shown) {
        // The thread's terminal is hidden under this page: take the keyboard (typing filters),
        // after the app has settled its own focus on the switch.
        cx.timer.after(150, (cx) => {
          if (visible()) this.handle.focus();
          cx.notify();
        });
        this.reload(cx);
      } else if (!this.busy && (activeSpace()?.id ?? null) !== this.space) this.reload(cx);
    }
    if (!vis && this.shown && this.handle.is_focused() && !checking()) {
      // Back to the thread: the keyboard goes back to its terminal.
      const tab = activeSpace()?.tabs.find((c) => c.active)?.id;
      const pane = panes().find((p) => p.tab === tab && p.focused)?.pane;
      if (pane) cx.spawn(async () => run("pane.focus", { pane }));
    }
    this.shown = vis;
    const t = theme();
    const q = this.queried();
    const shown = this.seg === "all" ? q : q.filter((x) => x.provider === this.seg);
    // No frame of its own as a page: the work card around it (center: radius 20, padding 4) paints it.
    // As a frameless dialog (frame "none"), the same card drawn here.
    return v_flex().id("ktm-root").size_full().gap(4).text_color(t.foreground)
      .when(Boolean(props()?.overlay), (el) => el.p(4).rounded(20).border(1).border_color(t.border).bg(t.chrome))
      .child(this.header(t, q, shown.length))
      .child(this.list(t, shown));
  }
}
