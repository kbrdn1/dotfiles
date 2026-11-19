// installed.js: kt-market's « déjà installé » and « mise à jour » (issue #70 lot 8), pure: no herdr, no
// I/O. installed.mjs reads this Mac's truth (claude plugin list, ~/.claude.json's servers, the skills'
// links and clones, the mods' folders) and these functions match it with the catalogs' items.
// Checked by `bun mods/kt-market/installed.check.mjs` on invented fixtures.
// Imports kt-plugins' newer() and updateState() (a pure module, read-only, as market.mjs does): an
// update is said the way the Plugins page says it. Only the bun script loads this file, never the mod.
import { newer, updateState } from "../kt-plugins/plugins.js";

/** A plugin: installed (any scope) under name@market; an update when the catalog's version (else its
 *  pinned commit, 12 characters as Claude Code writes it) is newer, as kt-plugins says it. */
export function pluginState(it, plugins) {
  const mine = plugins.filter((p) => p?.id === `${it.name}@${it.market}`);
  if (!mine.length) return null;
  const local = mine.find((p) => p.scope === "user") ?? mine[0];
  const available = it.version ?? (it.pin?.kind === "sha" && it.pin.value ? String(it.pin.value).slice(0, 12) : null);
  const state = updateState(local.version, available) === "update" ? "update" : "installed";
  return { state, local: { version: local.version ?? null, scope: local.scope ?? null, enabled: local.enabled === true, scopes: mine.length }, available };
}

// ---------- MCP: what may be kept of a configured server ----------
// args and URLs can hold secrets (--api-key xxx, --token=…, ?apiKey=…, https://user:pass@…, a token in
// a path). Kept, and only for the scan's match: the command's name, a package it runs when that package
// is in the catalog (with the plain version written with it), the URL's origin and path when they are
// a catalog remote's. Nothing else: no other argument, env, header, userinfo, query nor fragment.

const VER = /^v?\d[\w.+-]{0,39}$/;

/** A URL's origin and path ("https://host/mcp"), or null: no userinfo, query nor fragment. */
export function urlKey(u) {
  try {
    const x = new URL(String(u));
    if (x.protocol !== "https:" && x.protocol !== "http:") return null;
    return `${x.protocol}//${x.host}${x.pathname.replace(/\/+$/, "")}`;
  } catch { return null; }
}

// A package token split into its identifier and version: npm "@s/p@1.2.3", "p@1.2.3"; pypi "p==1.2";
// oci "img:1.2" (a tag after the last /). The version only when it is a plain version.
function splitPkg(tok, kind) {
  let ident = tok, version = null;
  const at = tok.lastIndexOf("@"), eq = tok.indexOf("=="), colon = tok.lastIndexOf(":");
  if (eq > 0) { ident = tok.slice(0, eq); version = tok.slice(eq + 2); }
  else if (kind === "oci" ? colon > tok.lastIndexOf("/") : at > 0) { const i = kind === "oci" ? colon : at; ident = tok.slice(0, i); version = tok.slice(i + 1); }
  return { ident, version: VER.test(version ?? "") ? version : null };
}

/** A server's config ({ command, args, url, env, headers… }) -> only { command, pkg, version, url }.
 *  `known`: { pkgs: Set, urls: Set }, the catalog's own package identifiers and remote URL keys (public).
 *  A package is kept only when an argument IS one of them (its version only when it is a plain version
 *  written with it), the URL only when its origin and path are one of them. So an option's value, a
 *  token in a URL's path, any argument that isn't a catalog package, is never kept: the scan can't tell
 *  a secret from a package name, the catalog can. */
export function serverFacts(cfg, known = { pkgs: new Set(), urls: new Set() }) {
  const command = typeof cfg?.command === "string" ? cfg.command.split("/").pop().slice(0, 40) : null;
  const args = Array.isArray(cfg?.args) ? cfg.args.filter((a) => typeof a === "string") : [];
  const kind = command === "docker" ? "oci" : command === "uvx" ? "pypi" : ["npx", "bunx", "pnpm"].includes(command) ? "npm" : null;
  let p = null;
  if (kind) for (const a of args) {
    if (a.startsWith("-") || !/^[@\w][\w@./:=+-]{0,200}$/.test(a)) continue;
    const s = splitPkg(a, kind);
    if (known.pkgs.has(s.ident)) { p = s; break; }
  }
  const u = urlKey(cfg?.url);
  return { command, pkg: p?.ident ?? null, version: p?.version ?? null, url: u && known.urls.has(u) ? u : null };
}

/** The catalog's MCP items -> what serverFacts may keep: their pinned packages' identifiers, their
 *  remote URLs' keys. */
export function knownOf(items) {
  const pkgs = new Set(), urls = new Set();
  for (const it of items) if (it.type === "mcp") for (const v of it.variants ?? []) {
    const id = identOf(v, it.version);
    if (id) pkgs.add(id);
    const k = v.host ? urlKey(v.config?.url) : null;
    if (k) urls.add(k);
  }
  return { pkgs, urls };
}

// A variant's package identifier (model.js mcpVariants): its pinned token, split the same way.
function identOf(v, version) {
  if (!v || v.host || !version) return null;
  const sep = v.kind === "npm" ? "@" : v.kind === "pypi" ? "==" : v.kind === "oci" ? ":" : null;
  const token = sep && (v.config?.args ?? []).find((a) => String(a).endsWith(`${sep}${version}`) && String(a).length > sep.length + version.length);
  return token ? splitPkg(String(token), v.kind).ident : null;
}

/** An MCP server: one of ~/.claude.json's servers (serverFacts) runs one of its packages (its pinned
 *  variants) or points at one of its remote URLs (origin and path); an update when the registry's version
 *  is newer than the one it runs. `servers`: [{ name, scope, command, pkg, version, url }]. */
export function mcpState(it, servers) {
  for (const v of it.variants ?? []) {
    const ident = identOf(v, it.version);
    const key = v.host ? urlKey(v.config?.url) : null;
    for (const s of servers) {
      if (key && s.url === key) return { state: "installed", local: { name: s.name, scope: s.scope, version: null } };
      if (!ident || s.pkg !== ident) continue;
      return { state: s.version && newer(it.version, s.version) ? "update" : "installed", local: { name: s.name, scope: s.scope, version: s.version }, available: it.version };
    }
  }
  return null;
}

/** A skill (skills.sh): a link of ~/.claude/skills into a clone of the same GitHub repo, whose skill is
 *  that id (its SKILL.md's name, else its folder's). Its update shows at inspection (the clone's commit
 *  against the repo's), not here: that would need the network. */
export function skillState(it, skills) {
  if (!it.repo) return null;
  const repo = `${it.repo.owner}/${it.repo.name}`.toLowerCase();
  const s = skills.find((k) => k.repo?.toLowerCase() === repo && (k.skill === it.name || String(k.path ?? "").split("/").pop() === it.name || k.name === it.name));
  return s ? { state: "installed", local: { name: s.name, path: s.path ?? "", head: s.head ?? null } } : null;
}

/** A herdr mod or layout: a folder under ~/.config/herdr-app/mods has one of its mods' names (item.mods,
 *  the gallery's modNames). « present », never « installed »: a name proves nothing (Herdr ships a
 *  `toast`, a `worktree`; another author's mod can share a name), and installing it would be a clash.
 *  No update: a copied folder has no commit of its own. */
export function modState(it, mods) {
  const names = (it.mods ?? []).filter((n) => mods.includes(n));
  return names.length ? { state: "present", local: { mods: names } } : null;
}

/** Every item's state, only those installed: { [id]: { state, local, available? } }. */
export function states(items, local) {
  const out = {};
  for (const it of items) {
    const s = it.type === "plugin" ? pluginState(it, local.plugins ?? [])
      : it.type === "mcp" ? mcpState(it, local.servers ?? [])
      : it.type === "skill" ? skillState(it, local.skills ?? [])
      : it.type === "herdr-mod" || it.type === "herdr-layout" ? modState(it, local.mods ?? [])
      : null;
    if (s) out[it.id] = s;
  }
  return out;
}

/** "git@github.com:o/r.git" or "https://github.com/o/r(.git)" -> "o/r", else null. */
export function repoOfRemote(url) {
  const m = String(url ?? "").trim().match(/^(?:https:\/\/github\.com\/|git@github\.com:)([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?\/?$/);
  return m ? `${m[1]}/${m[2]}` : null;
}
