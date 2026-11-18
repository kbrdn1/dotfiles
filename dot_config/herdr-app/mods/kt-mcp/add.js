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
  .filter((s) => s && !/gitstatus|zle|setopt|zshrc|^\s*$/i.test(s)).pop() ?? `code ${r.code}`);

// The scopes: local and project belong to a project, so only user without one.
function scopes(ctx) {
  const all = [["user", "user · toi, partout"], ["local", "local · toi, ce projet"], ["project", "project · .mcp.json, l'équipe"]];
  return { id: "scope", label: "Portée", kind: "choice", value: "user", choices: ctx.project ? all : all.slice(0, 1),
    help: ctx.project ? `projet : ${tilde(ctx.cwd)}` : "pas de projet affiché : user seulement" };
}
const nameField = { id: "name", label: "Nom", kind: "text", mono: true, placeholder: "mon-serveur" };
const badName = (n) => (!NAME.test(n) ? "Nom : lettres, chiffres, . _ -, sans espace, 64 au plus." : null);

// One `claude mcp …` run where the plan said, then the page reads the configs again.
function runner(args, cwd, name) {
  return async () => {
    const r = await exec("sh", ["-c", CLI, "sh", ...args], { cwd, timeout: 60e3 }).catch((e) => ({ code: -1, stdout: "", stderr: String(e?.message ?? e) }));
    if (r.code !== 0) return { level: "error", title: `${name} n'a pas été ajouté`, body: cause(r) };
    bump("mcp"); // the bus (DATA-SYNC.md): every MCP copy reads its configs again, shown or not
    return { level: "success", title: `${name} ajouté`, body: maskText(r.stdout.trim().split("\n").pop() ?? "") };
  };
}

export const METHODS = [
  {
    id: "stdio", label: "Serveur stdio", hint: "Une commande locale et ses variables d'environnement", icon: W("terminal"),
    title: "Ajouter un serveur stdio",
    intro: "claude mcp add : Claude Code lance la commande et lui parle sur son entrée et sa sortie.",
    fields: (ctx) => [nameField,
      { id: "cmd", label: "Commande", kind: "text", mono: true, placeholder: "npx -y @scope/serveur --port 3000", help: "découpée comme le shell, sans expansion" },
      { id: "env", label: "Environnement", kind: "pairs", sep: "=", keyPlaceholder: "CLÉ", valuePlaceholder: "valeur (masquée)", more: "Une variable de plus" },
      scopes(ctx)],
    async plan(v, ctx) {
      const name = v.name.trim();
      const argv = splitArgs(v.cmd.trim());
      const bad = badName(name) ?? (!argv.length ? "Il faut une commande." : null) ?? v.env.map(([k]) => (!ENV.test(k) ? `Variable « ${k} » : lettres, chiffres et _, pas de chiffre en tête.` : null)).find(Boolean);
      if (bad) return { error: bad };
      const args = ["add", name, "-s", v.scope, ...v.env.flatMap(([k, x]) => ["-e", `${k}=${x}`]), "--", ...argv];
      const masked = ["add", name, "-s", v.scope, ...v.env.flatMap(([k]) => ["-e", `${k}=${MASK}`]), "--", maskText(argv[0]), ...maskArgs(argv.slice(1))];
      return { shown: shown(masked), cwd: ctx.cwd, label: "Ajouter", run: runner(args, ctx.cwd, name),
        note: v.scope === "user" ? "Écrit dans ~/.claude.json (mcpServers), par la CLI." : v.scope === "local" ? "Écrit dans ~/.claude.json, pour ce projet seulement, par la CLI." : "Écrit dans .mcp.json à la racine du projet : partagé avec le dépôt." };
    },
  },
  {
    id: "http", label: "Serveur HTTP ou SSE", hint: "Une URL distante, ses en-têtes", icon: T("plug"),
    title: "Ajouter un serveur HTTP ou SSE",
    intro: "claude mcp add --transport : Claude Code se connecte à l'URL ; un en-tête porte souvent un jeton.",
    fields: (ctx) => [nameField,
      { id: "url", label: "URL", kind: "text", mono: true, placeholder: "https://mcp.exemple.com/mcp", help: "ses paramètres sont masqués à la confirmation" },
      { id: "transport", label: "Transport", kind: "choice", value: "http", choices: [["http", "http"], ["sse", "sse"]] },
      { id: "headers", label: "En-têtes", kind: "pairs", sep: ": ", keyPlaceholder: "Authorization", valuePlaceholder: "Bearer … (masqué)", more: "Un en-tête de plus" },
      scopes(ctx)],
    async plan(v, ctx) {
      const name = v.name.trim();
      const url = v.url.trim();
      const bad = badName(name) ?? (!/^https?:\/\/\S+$/i.test(url) ? "L'URL commence par http:// ou https://, sans espace." : null)
        ?? v.headers.map(([k]) => (!HEADER.test(k) ? `En-tête « ${k} » : lettres, chiffres et -.` : null)).find(Boolean);
      if (bad) return { error: bad };
      const head = ["add", "--transport", v.transport, "-s", v.scope, name];
      const args = [...head, url, ...v.headers.flatMap(([k, x]) => ["--header", `${k}: ${x}`])];
      const masked = [...head, maskUrl(url), ...v.headers.flatMap(([k]) => ["--header", `${k}: ${MASK}`])];
      return { shown: shown(masked), cwd: ctx.cwd, label: "Ajouter", run: runner(args, ctx.cwd, name),
        note: "Un serveur qui demande une connexion (OAuth) se connecte ensuite par /mcp ou claude mcp login." };
    },
  },
  {
    id: "json", label: "Depuis du JSON", hint: "Une config collée telle quelle", icon: T("file-text"),
    title: "Ajouter depuis du JSON",
    intro: "claude mcp add-json : la config d'un serveur, comme dans .mcp.json (l'objet sous mcpServers.<nom>).",
    fields: (ctx) => [nameField,
      { id: "json", label: "Config", kind: "json", placeholder: '{ "type": "stdio", "command": "npx", "args": ["-y", "pkg"], "env": { "KEY": "…" } }',
        help: "masquée dès qu'on la quitte", mask: (s) => { try { return JSON.stringify(maskJson(JSON.parse(s)), null, 2); } catch { return maskText(s); } } },
      scopes(ctx)],
    async plan(v, ctx) {
      const name = v.name.trim();
      let obj = null;
      try { obj = JSON.parse(v.json); } catch (e) { return { error: `JSON illisible : ${maskText(String(e.message))}` }; }
      const bad = badName(name)
        ?? (!obj || typeof obj !== "object" || Array.isArray(obj) ? "Il faut un objet JSON." : null)
        ?? (obj.mcpServers ? "Colle la config d'un seul serveur : l'objet sous mcpServers.<nom>." : null)
        ?? (!obj.command && !obj.url ? "La config n'a ni command (stdio) ni url (http, sse)." : null);
      if (bad) return { error: bad };
      const args = ["add-json", "-s", v.scope, name, JSON.stringify(obj)];
      return { shown: shown(["add-json", "-s", v.scope, name, JSON.stringify(maskJson(obj))]), cwd: ctx.cwd, label: "Ajouter", run: runner(args, ctx.cwd, name) };
    },
  },
  {
    id: "desktop", label: "Importer de Claude Desktop", hint: "Ses serveurs, choisis dans la CLI", icon: W("monitor"),
    title: "Importer depuis Claude Desktop",
    intro: "claude mcp add-from-claude-desktop lit la config de Claude Desktop et demande lesquels importer : elle s'ouvre dans un nouvel onglet, pour y répondre.",
    fields: (ctx) => [scopes(ctx)],
    async plan(v, ctx) {
      const args = ["add-from-claude-desktop", "-s", v.scope];
      return { shown: shown(args), cwd: ctx.cwd, label: "Ouvrir", note: "Interactive : rien n'est importé avant ton choix dans l'onglet.",
        run: async () => {
          run("tab.new", { space: ctx.space, folder: ctx.cwd, name: "MCP · Claude Desktop", argv: ["env", "-u", "ANTHROPIC_API_KEY", "claude", "mcp", ...args] });
          run("layout.select", { stack: "view", child: "thread" });
          return { level: "info", title: "Import dans un nouvel onglet", body: "Choisis les serveurs, puis Rafraîchir sur la page MCP." };
        } };
    },
  },
];
