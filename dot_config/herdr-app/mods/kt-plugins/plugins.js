// kt-plugins' pure helpers (no herdr import): versions, a marketplace's origin, a plugin's
// components, the CLI's arguments. Checked by `node mods/kt-plugins/plugins.test.mjs`.

const SEMVER = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+.*)?$/;

/** A git sha as Claude Code versions a plugin that declares no version ("3ea32df27be7"). */
export const isSha = (v) => /^[0-9a-f]{7,40}$/i.test(String(v ?? ""));

/** a > b, both semver (a pre-release is below its release). Anything else (a sha): false. */
export function newer(a, b) {
  const x = String(a ?? "").match(SEMVER), y = String(b ?? "").match(SEMVER);
  if (!x || !y) return false;
  for (let i = 1; i <= 3; i++) if (Number(x[i]) !== Number(y[i])) return Number(x[i]) > Number(y[i]);
  if (!x[4] !== !y[4]) return !x[4];
  return Boolean(x[4]) && x[4].localeCompare(y[4], undefined, { numeric: true }) > 0;
}

/** What the marketplace offers now: the plugin.json of its source in the marketplace's clone, else
 *  the catalog entry's version, else the commit an object source pins (12 chars, as Claude Code). */
export function offered(entry, sourceManifest) {
  const src = entry?.source;
  return sourceManifest?.version ?? entry?.version ?? (src && typeof src === "object" && src.sha ? String(src.sha).slice(0, 12) : null);
}

/** "update": a newer semver; "differs": another version that can't be ordered (a sha); else null. */
export function updateState(installed, available) {
  if (!available || !installed || available === installed) return null;
  return newer(available, installed) ? "update" : newer(installed, available) ? null : "differs";
}

/** A marketplace source ({ source: "github" | "git" | "url" | "directory", ... }) for people:
 *  { kind, label, url } (url: a web page, GitHub's when it is one). */
export function origin(src) {
  if (!src) return { kind: null, label: "—", url: null };
  if (src.source === "github") return { kind: "github", label: src.repo, url: `https://github.com/${src.repo}` };
  if (src.source === "directory" || src.source === "file") return { kind: "directory", label: src.path, url: null };
  const u = String(src.url ?? "");
  const gh = u.match(/github\.com[/:]([^/]+\/[^/]+?)(?:\.git)?\/?$/);
  return { kind: src.source ?? "git", label: u.replace(/^[a-z+]+:\/\//i, "").replace(/\.git$/, "") || "—", url: gh ? `https://github.com/${gh[1]}` : /^https?:/.test(u) ? u.replace(/\.git$/, "") : null };
}

/** A plugin's page on the web: its manifest's repository / homepage when on GitHub, else its
 *  catalog source (git-subdir: that repo's folder), else its marketplace's repo (its folder in it). */
export function webOf(manifest, entry, market) {
  const repo = typeof manifest?.repository === "string" ? manifest.repository : manifest?.repository?.url;
  for (const u of [repo, manifest?.homepage]) if (/^https:\/\/github\.com\//.test(u ?? "")) return u.replace(/\.git$/, "");
  const s = entry?.source;
  if (s && typeof s === "object") {
    const base = s.source === "github" ? `https://github.com/${s.repo}` : origin({ source: "git", url: s.url }).url;
    return base && s.path ? `${base}/tree/${s.ref ?? "HEAD"}/${s.path}` : base;
  }
  if (!market?.url) return null;
  const rel = typeof s === "string" ? s.replace(/^\.\/?/, "").replace(/\/$/, "") : "";
  return rel && market.kind === "github" ? `${market.url}/tree/HEAD/${rel}` : market.url;
}

const keys = (o) => (o && typeof o === "object" && !Array.isArray(o) ? Object.keys(o) : []);

/** What a plugin brings, from its folder's file list and its JSON files (already merged by the
 *  caller): skills/<x>/SKILL.md, commands/**.md (sub/x -> sub:x), agents/**.md, hook events,
 *  function-hook modules (hooks.json "modules": a mod), MCP and LSP servers. */
export function components(dir, files, { hooks = [], mcp = [], lsp = [] } = {}) {
  const under = (sub, re) => files.filter((f) => f.startsWith(`${dir}/${sub}/`)).map((f) => f.slice(dir.length + sub.length + 2).match(re)?.[1]).filter(Boolean);
  const md = (sub) => under(sub, /^(.+)\.md$/i).map((n) => n.replace(/\//g, ":"));
  const events = new Set(), mods = [];
  for (const h of hooks) {
    for (const e of keys(h?.hooks ?? (h && !h.modules && !h.description ? h : null))) events.add(e);
    for (const m of h?.modules ?? []) mods.push(String(m).replace(/^\.\//, ""));
  }
  const servers = (list, key) => [...new Set(list.flatMap((o) => keys(o?.[key] ?? o)))];
  const sort = (l) => [...new Set(l)].sort((a, b) => a.localeCompare(b));
  return {
    skills: sort(under("skills", /^([^/]+)\/SKILL\.md$/)),
    commands: sort(md("commands")),
    agents: sort(md("agents")),
    hooks: [...events],
    mods,
    mcp: servers(mcp, "mcpServers"),
    lsp: servers(lsp, "lspServers"),
  };
}

const KINDS = [["skills", "skill", "skills"], ["commands", "commande", "commandes"], ["agents", "agent", "agents"], ["hooks", "hook", "hooks"],
  ["mcp", "MCP", "MCP"], ["mods", "mod", "mods"], ["lsp", "LSP", "LSP"]];

/** "6 skills · 3 hooks" (only what it has), "" for nothing. */
// `name(kind, n)`: the mod's words for n of a kind (I18N.md), else this file's French.
export function summary(c, name = (k, n) => { const [, one, many] = KINDS.find(([x]) => x === k); return `${n} ${n > 1 ? many : one}`; }) {
  return KINDS.filter(([k]) => c?.[k]?.length).map(([k]) => name(k, c[k].length)).join(" · ");
}

/** A path from a plugin's manifest ("./hooks/x.json") under its folder. */
export const under = (dir, rel) => `${dir}/${String(rel).replace(/^\.\//, "").replace(/\/+$/, "")}`.replace(/\/\.?$/, "");

/** `claude` arguments, each checked: plugin ids, scopes, flags and names, never anything a shell
 *  could read as more (they're passed positionally anyway). `{ path }`: an absolute folder (spaces
 *  allowed); `{ url }`: a git URL (https, ssh, git@host:path). */
export function cli(args) {
  return args.map((a) => {
    if (a && typeof a === "object" && "path" in a) {
      if (/^\/[^\0-\x1f]*$/.test(a.path)) return a.path;
    } else if (a && typeof a === "object" && "url" in a) {
      if (/^(https?|ssh|git):\/\/[^\s\0-\x1f]+$|^[\w.-]+@[\w.-]+:[^\s\0-\x1f]+$/.test(a.url)) return a.url;
    } else if (/^[\w][\w.@:/-]*$|^--?[a-z][\w-]*$/i.test(String(a))) return String(a);
    throw new Error(`argument refusé : ${JSON.stringify(a)}`); // i18n: tech
  });
}

/** How a person may write a marketplace or a plugin id. */
export const isRepo = (s) => /^[\w.-]+\/[\w.-]+$/.test(String(s ?? ""));
export const isGitUrl = (s) => /^(https?|ssh|git):\/\/[^\s]+$|^[\w.-]+@[\w.-]+:[^\s]+$/.test(String(s ?? ""));
export const isPluginId = (s) => /^[\w.-]+@[\w.-]+$/.test(String(s ?? ""));

/** "name@market" -> { name, market } (the market after the last @). */
export function split(id) {
  const i = String(id).lastIndexOf("@");
  return i < 0 ? { name: String(id), market: "" } : { name: id.slice(0, i), market: id.slice(i + 1) };
}

/** JSON in a login shell's stdout: from the first line opening an array or object to the last
 *  closing one (rc noise around it is dropped). */
export function jsonOut(s) {
  const t = String(s ?? "");
  const i = t.search(/^[[{]/m);
  const j = Math.max(t.lastIndexOf("]"), t.lastIndexOf("}"));
  if (i < 0 || j < i) return null;
  try { return JSON.parse(t.slice(i, j + 1)); } catch { return null; }
}

/** The line that says why a command failed, not the login shell's rc noise. */
export function why(out) {
  const l = String(out ?? "").split("\n").map((s) => s.trim()).filter((s) => s && !/gitstatus|zle|setopt|zshrc|p10k|powerlevel/i.test(s));
  const j = jsonOut(l.at(-1) ?? "");
  return (j && (j.error ?? j.message)) || l.at(-1) || "";
}
