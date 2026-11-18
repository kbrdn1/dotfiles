// kt-plugins' reads and its one writer, the official CLI. Nothing here writes a settings file or
// installed_plugins.json: `claude plugin …` does, through `claude()`.
// Reads: `claude plugin list --json` (the installs, their scope and state: the truth the counters
// follow), ~/.claude/plugins/known_marketplaces.json and settings.json (extraKnownMarketplaces,
// enabledPlugins), each marketplace's .claude-plugin/marketplace.json (in its clone, or its folder),
// and each plugin's folder (plugin.json, hooks, .mcp.json, .lsp.json, skills/commands/agents).

import { exec, readTextFile, home } from "herdr";
import * as fs from "fs/promises";
import { cli, components, offered, updateState, origin, webOf, under, jsonOut, why, split } from "./plugins.js";
import { makeT } from "./i18n.js";
import strings from "./strings.js";

const tr = makeT(strings);

export const read = (p) => readTextFile(p).catch(() => null);
export const parse = (s) => { try { return JSON.parse(s ?? ""); } catch { return null; } };
const readJson = async (p) => parse(await read(p));
const isObj = (o) => o && typeof o === "object" && !Array.isArray(o);

// `claude` in the shell Herdr's terminals start (login + interactive): their PATH, and no API key
// overriding the claude.ai login. Arguments go positionally ("$@"), never into the script.
// ponytail: sh/bash/zsh take `-lic script arg0 args…`; fish passes them differently.
const RUN = `exec "\${SHELL:-/bin/zsh}" -lic 'env -u ANTHROPIC_API_KEY claude "$@"' claude "$@"`;

/** Runs `claude <args>` (see cli() for what an argument may be). Never rejects: { code, stdout, stderr }. */
export function claude(args, { cwd, timeout = 60e3 } = {}) {
  let argv;
  try { argv = cli(args); } catch (e) { return Promise.resolve({ code: -1, stdout: "", stderr: String(e?.message ?? e) }); }
  return exec("sh", ["-c", RUN, "sh", ...argv], { cwd: cwd ?? home(), timeout })
    .catch((e) => ({ code: -1, stdout: "", stderr: String(e?.message ?? e) }));
}

/** The command as a person would type it (the confirms show this). */
export const shown = (args) => ["claude", ...args.map((a) => (isObj(a) ? a.path ?? a.url : a))]
  .map((a) => (/^[\w.@:/=-]+$/.test(a) ? a : `'${a.replace(/'/g, "'\\''")}'`)).join(" ");

/** Every known marketplace: { name: { name, src, loc, updated, origin } } (loc: where its catalog
 *  is: its clone, or its folder), and settings.json's enabledPlugins. */
export async function marketplaces() {
  const h = home();
  const [known, st] = await Promise.all([readJson(`${h}/.claude/plugins/known_marketplaces.json`), readJson(`${h}/.claude/settings.json`)]);
  const out = {};
  for (const [name, m] of Object.entries(st?.extraKnownMarketplaces ?? {}))
    out[name] = { name, src: m?.source, loc: m?.source?.source === "directory" ? m.source.path : null, updated: null };
  for (const [name, m] of Object.entries(known ?? {}))
    out[name] = { name, src: m?.source, loc: m?.installLocation ?? null, updated: m?.lastUpdated ? Date.parse(m.lastUpdated) : null };
  for (const m of Object.values(out)) m.origin = origin(m.src);
  return { markets: out, enabled: st?.enabledPlugins ?? {} };
}

export const catalog = (m) => (m?.loc ? readJson(`${m.loc}/.claude-plugin/marketplace.json`) : Promise.resolve(null));

// Every .md under each folder's skills/, commands/ and agents/, in one process (links followed).
const FIND = `for d in "$@"; do for s in skills commands agents; do [ -d "$d/$s" ] && find -L "$d/$s" -name '*.md' -not -path '*/node_modules/*' 2>/dev/null; done; done; true`;

/** What each folder holds: [{ dir, entry }] -> [{ pj, pjText, manifest, comps }]. `entry`: its
 *  catalog entry (a strict:false plugin declares its parts there); plugin.json wins over it. No
 *  folder (a remote source not downloaded): what the entry declares. */
export async function inspect(targets) {
  const dirs = [...new Set(targets.map((x) => x.dir).filter(Boolean))];
  const r = dirs.length ? await exec("sh", ["-c", FIND, "sh", ...dirs], { timeout: 30e3 }).catch(() => null) : null;
  const files = (r?.stdout ?? "").split("\n").filter(Boolean);
  const inline = (v) => [v].flat().filter(isObj);
  return Promise.all(targets.map(async ({ dir, entry }) => {
    if (!dir) {
      const manifest = { ...(entry ?? {}) };
      return { pj: null, pjText: null, manifest, comps: components("", [], { hooks: inline(manifest.hooks), mcp: inline(manifest.mcpServers), lsp: inline(manifest.lspServers) }) };
    }
    const pjText = await read(`${dir}/.claude-plugin/plugin.json`);
    const pj = parse(pjText);
    const manifest = { ...(entry ?? {}), ...(pj ?? {}) };
    // A part's default file, plus the paths the manifest names, plus what it declares inline.
    const load = async (field, file) => {
      const paths = [file, ...[manifest[field]].flat().filter((x) => typeof x === "string").map((p) => under(dir, p))];
      const got = await Promise.all([...new Set(paths)].map(readJson));
      return [...got.filter(Boolean), ...inline(manifest[field])];
    };
    const [hooks, mcp, lsp] = await Promise.all([load("hooks", `${dir}/hooks/hooks.json`), load("mcpServers", `${dir}/.mcp.json`), load("lspServers", `${dir}/.lsp.json`)]);
    return { pj, pjText, manifest, comps: components(dir, files, { hooks, mcp, lsp }) };
  }));
}

const exists = (p) => fs.readdir(p).then(() => true, () => false);

/** The installs, one row per `claude plugin list --json` entry (a plugin installed for the user and
 *  for two projects is three rows, as the CLI lists it). */
export async function installed() {
  const h = home();
  const [r, { markets, enabled }, data] = await Promise.all([
    claude(["plugin", "list", "--json"], { cwd: h }),
    marketplaces(),
    fs.readdir(`${h}/.claude/plugins/data`).catch(() => []),
  ]);
  const list = jsonOut(r.stdout);
  if (!Array.isArray(list)) throw new Error(why(r.stderr || r.stdout) || tr("listFailed", { code: r.code }));
  const names = [...new Set(list.map((p) => split(p.id).market))];
  const cats = Object.fromEntries(await Promise.all(names.map(async (n) => [n, await catalog(markets[n])])));
  const base = list.map((p) => {
    const { name, market } = split(p.id);
    return { p, name, market, entry: cats[market]?.plugins?.find((e) => e.name === name) ?? null, dir: p.readFromFolder ?? p.installPath };
  });
  const [seen, offers, gone] = await Promise.all([
    inspect(base),
    // What the marketplace offers now: its source's plugin.json in the marketplace's own folder.
    Promise.all(base.map(async ({ p, entry, market }) => {
      if (!entry || p.readFromFolder || p.scope === "synced") return null;
      const loc = markets[market]?.loc;
      const src = typeof entry.source === "string" && loc ? await readJson(`${under(loc, entry.source)}/.claude-plugin/plugin.json`) : null;
      return offered(entry, src);
    })),
    Promise.all(base.map(({ p }) => (p.projectPath ? exists(p.projectPath).then((x) => !x) : false))),
  ]);
  const dataDirs = new Set(data);
  const items = base.map(({ p, name, market, entry, dir }, i) => {
    const { pjText, manifest, comps } = seen[i];
    const synced = p.scope === "synced";
    // A plugin read from its folder: the folder's version, as `claude plugin list` shows it.
    const version = p.folderVersion ?? p.version ?? "—";
    const avail = offers[i];
    const state = synced || p.readFromFolder ? null : updateState(version, avail);
    return {
      key: `${p.id}|${p.scope}|${p.projectPath ?? ""}`, id: p.id, name, market, scope: p.scope,
      projectPath: p.projectPath ?? null, projectGone: gone[i], enabled: p.enabled === true, synced,
      folder: p.readFromFolder ?? null, installPath: p.installPath ?? null, dir,
      version, avail, update: state === "update", differs: state === "differs",
      installedAt: p.installedAt ? Date.parse(p.installedAt) : null, lastUpdated: p.lastUpdated ? Date.parse(p.lastUpdated) : null,
      description: String(manifest.description ?? ""), manifest, pjText, comps, entry,
      web: webOf(manifest, entry, markets[market]?.origin),
      data: dataDirs.has(`${name}-${market}`) ? `${h}/.claude/plugins/data/${name}-${market}` : null,
    };
  });
  return { items, markets, enabled };
}

/** What the known marketplaces offer and isn't installed (in any scope): one row per catalog entry. */
export async function offeredPlugins() {
  const h = home();
  const [{ markets }, inst] = await Promise.all([marketplaces(), readJson(`${h}/.claude/plugins/installed_plugins.json`)]);
  const have = new Set(Object.keys(inst?.plugins ?? {}));
  const out = [];
  const errors = [];
  await Promise.all(Object.values(markets).map(async (m) => {
    const c = await catalog(m);
    if (!c) { errors.push(m.name); return; }
    for (const e of c.plugins ?? []) {
      if (!e?.name) continue;
      const id = `${e.name}@${m.name}`;
      if (have.has(id)) continue;
      const local = typeof e.source === "string" && m.loc;
      out.push({ key: id, id, name: e.name, market: m.name, entry: e, description: String(e.description ?? ""), category: e.category ?? null,
        version: e.version ?? null, dir: local ? under(m.loc, e.source) : null, remote: !local });
    }
  }));
  out.sort((a, b) => a.market.localeCompare(b.market, undefined, { sensitivity: "base" }) || a.name.localeCompare(b.name));
  return { items: out, markets, errors: errors.sort() };
}

/** A folder picked as "a plugin in development": its marketplace.json's plugins (installable through
 *  `claude plugin install <name> --marketplace <folder>`), else its lone plugin.json. */
export async function folderInfo(path) {
  const [mk, pj] = await Promise.all([readJson(`${path}/.claude-plugin/marketplace.json`), readJson(`${path}/.claude-plugin/plugin.json`)]);
  return { market: mk, plugin: pj, plugins: (mk?.plugins ?? []).filter((e) => e?.name) };
}
