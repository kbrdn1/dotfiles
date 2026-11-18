// kt-mcp's ways to add a server (form.js draws them), every one through Claude Code's own CLI, in
// the shell Vérifier uses (the user's PATH), its ANTHROPIC_API_KEY left out: `claude mcp add`
// (stdio, http / sse), `claude mcp add-json`, `claude mcp add-from-claude-desktop` (interactive: in
// a new tab). Each checked in `claude mcp --help` (v2.1): no --dry-run there, so the confirmation
// shows the exact command, secrets masked, and the folder it runs in (local and project scopes
// belong to it). Typed values go to the command as argv, never into a file or a log.

import { exec, run } from "herdr";
import { MASK, maskText, maskArgs, maskUrl, maskJson, splitArgs, shq } from "./mcp.js";
import { tilde } from "./form.js";
import { bump } from "./bus.js";
import { makeT } from "./i18n.js";
import strings from "./strings.js";

// A method's words are getters (I18N.md): form.js reads them when it draws, in the language then.
const tr = makeT(strings);
const T = (name) => `mods/kt-threads/${name}.svg`;
const W = (name) => `mods/workspace-chrome/${name}.svg`;
const NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
const ENV = /^[A-Za-z_][A-Za-z0-9_]*$/;
const HEADER = /^[A-Za-z0-9-]+$/;
// `claude mcp "$@"` in the login + interactive shell (servers' PATH, auth); the arguments as argv.
const CLI = `exec "\${SHELL:-/bin/zsh}" -lic 'env -u ANTHROPIC_API_KEY claude mcp "$@"' _ "$@"`;
const shown = (args) => `claude mcp ${args.map(shq).join(" ")}`;
// What went wrong, not the login shell's rc noise; masked.
const cause = (r) => maskText(`${r.stderr}\n${r.stdout}`.split("\n").map((s) => s.trim())
  .filter((s) => s && !/gitstatus|zle|setopt|zshrc|^\s*$/i.test(s)).pop() ?? tr("code", { code: r.code }));

// The scopes: local and project belong to a project, so only user without one.
function scopes(ctx) {
  const all = [["user", tr("scope.user")], ["local", tr("scope.local")], ["project", tr("scope.project")]];
  return { id: "scope", label: tr("scope.label"), kind: "choice", value: "user", choices: ctx.project ? all : all.slice(0, 1),
    help: ctx.project ? tr("scope.help", { path: tilde(ctx.cwd) }) : tr("scope.userOnly") };
}
const nameField = () => ({ id: "name", label: tr("name.label"), kind: "text", mono: true, placeholder: tr("name.placeholder") });
const badName = (n) => (!NAME.test(n) ? tr("badName") : null);

// One `claude mcp …` run where the plan said, then the page reads the configs again.
function runner(args, cwd, name) {
  return async () => {
    const r = await exec("sh", ["-c", CLI, "sh", ...args], { cwd, timeout: 60e3 }).catch((e) => ({ code: -1, stdout: "", stderr: String(e?.message ?? e) }));
    if (r.code !== 0) return { level: "error", title: tr("notAdded", { name }), body: cause(r) };
    bump("mcp"); // the bus (DATA-SYNC.md): every MCP copy reads its configs again, shown or not
    return { level: "success", title: tr("added", { name }), body: maskText(r.stdout.trim().split("\n").pop() ?? "") };
  };
}

export const METHODS = [
  {
    id: "stdio", icon: W("terminal"),
    get label() { return tr("stdio.label"); },
    get hint() { return tr("stdio.hint"); },
    get title() { return tr("stdio.title"); },
    get intro() { return tr("stdio.intro"); },
    fields: (ctx) => [nameField(),
      { id: "cmd", label: tr("cmd.label"), kind: "text", mono: true, placeholder: tr("cmd.placeholder"), help: tr("cmd.help") },
      { id: "env", label: tr("env.label"), kind: "pairs", sep: "=", keyPlaceholder: tr("env.key"), valuePlaceholder: tr("env.value"), more: tr("env.more") },
      scopes(ctx)],
    async plan(v, ctx) {
      const name = v.name.trim();
      const argv = splitArgs(v.cmd.trim());
      const bad = badName(name) ?? (!argv.length ? tr("needCmd") : null) ?? v.env.map(([k]) => (!ENV.test(k) ? tr("badVar", { k }) : null)).find(Boolean);
      if (bad) return { error: bad };
      const args = ["add", name, "-s", v.scope, ...v.env.flatMap(([k, x]) => ["-e", `${k}=${x}`]), "--", ...argv];
      const masked = ["add", name, "-s", v.scope, ...v.env.flatMap(([k]) => ["-e", `${k}=${MASK}`]), "--", maskText(argv[0]), ...maskArgs(argv.slice(1))];
      return { shown: shown(masked), cwd: ctx.cwd, label: tr("add"), run: runner(args, ctx.cwd, name),
        note: tr(v.scope === "user" ? "note.user" : v.scope === "local" ? "note.local" : "note.project") };
    },
  },
  {
    id: "http", icon: T("plug"),
    get label() { return tr("http.label"); },
    get hint() { return tr("http.hint"); },
    get title() { return tr("http.title"); },
    get intro() { return tr("http.intro"); },
    fields: (ctx) => [nameField(),
      { id: "url", label: "URL", kind: "text", mono: true, placeholder: tr("url.placeholder"), help: tr("url.help") }, // i18n: tech
      { id: "transport", label: "Transport", kind: "choice", value: "http", choices: [["http", "http"], ["sse", "sse"]] }, // i18n: tech
      { id: "headers", label: tr("headers.label"), kind: "pairs", sep: ": ", keyPlaceholder: "Authorization", valuePlaceholder: tr("headers.value"), more: tr("headers.more") },
      scopes(ctx)],
    async plan(v, ctx) {
      const name = v.name.trim();
      const url = v.url.trim();
      const bad = badName(name) ?? (!/^https?:\/\/\S+$/i.test(url) ? tr("badUrl") : null)
        ?? v.headers.map(([k]) => (!HEADER.test(k) ? tr("badHeader", { k }) : null)).find(Boolean);
      if (bad) return { error: bad };
      const head = ["add", "--transport", v.transport, "-s", v.scope, name];
      const args = [...head, url, ...v.headers.flatMap(([k, x]) => ["--header", `${k}: ${x}`])];
      const masked = [...head, maskUrl(url), ...v.headers.flatMap(([k]) => ["--header", `${k}: ${MASK}`])];
      return { shown: shown(masked), cwd: ctx.cwd, label: tr("add"), run: runner(args, ctx.cwd, name), note: tr("note.oauth") };
    },
  },
  {
    id: "json", icon: T("file-text"),
    get label() { return tr("json.label"); },
    get hint() { return tr("json.hint"); },
    get title() { return tr("json.title"); },
    get intro() { return tr("json.intro"); },
    fields: (ctx) => [nameField(),
      { id: "json", label: "Config", kind: "json", placeholder: '{ "type": "stdio", "command": "npx", "args": ["-y", "pkg"], "env": { "KEY": "…" } }', // i18n: tech
        help: tr("json.help"), mask: (s) => { try { return JSON.stringify(maskJson(JSON.parse(s)), null, 2); } catch { return maskText(s); } } },
      scopes(ctx)],
    async plan(v, ctx) {
      const name = v.name.trim();
      let obj = null;
      try { obj = JSON.parse(v.json); } catch (e) { return { error: tr("badJson", { why: maskText(String(e.message)) }) }; }
      const bad = badName(name)
        ?? (!obj || typeof obj !== "object" || Array.isArray(obj) ? tr("needObject") : null)
        ?? (obj.mcpServers ? tr("oneServer") : null)
        ?? (!obj.command && !obj.url ? tr("noTarget") : null);
      if (bad) return { error: bad };
      const args = ["add-json", "-s", v.scope, name, JSON.stringify(obj)];
      return { shown: shown(["add-json", "-s", v.scope, name, JSON.stringify(maskJson(obj))]), cwd: ctx.cwd, label: tr("add"), run: runner(args, ctx.cwd, name) };
    },
  },
  {
    id: "desktop", icon: W("monitor"),
    get label() { return tr("desktop.label"); },
    get hint() { return tr("desktop.hint"); },
    get title() { return tr("desktop.title"); },
    get intro() { return tr("desktop.intro"); },
    fields: (ctx) => [scopes(ctx)],
    async plan(v, ctx) {
      const args = ["add-from-claude-desktop", "-s", v.scope];
      return { shown: shown(args), cwd: ctx.cwd, label: tr("open"), note: tr("desktop.note"),
        run: async () => {
          run("tab.new", { space: ctx.space, folder: ctx.cwd, name: "MCP · Claude Desktop", argv: ["env", "-u", "ANTHROPIC_API_KEY", "claude", "mcp", ...args] }); // i18n: tech
          run("layout.select", { stack: "view", child: "thread" });
          return { level: "info", title: tr("importTitle"), body: tr("importBody") };
        } };
    },
  },
];
