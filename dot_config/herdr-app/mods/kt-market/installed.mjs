// installed.mjs: what this Mac has of the catalogs' items (issue #70 lot 8), for kt-market's badges
// « installé » and « mise à jour ». The mod runs it through exec (never from render):
//   ~/.nix-profile/bin/bun ~/.config/herdr-app/mods/kt-market/installed.mjs
// and gets ONE JSON line: { at, states: { [item id]: { state: "installed" | "update", local, available? } },
// counts, errors }. No network: the truth is local.
// - plugins: `claude plugin list --json` (the login shell's claude, arguments as "$@" never in the text);
// - MCP: ~/.claude.json's servers, user and per project (local), reduced at once (serverFacts) to the
//   name, the runner's name, a package it runs that the catalog has, a URL whose origin and path a
//   catalog remote has: no other argument (an --api-key, a --token), no env, no header, no userinfo,
//   query nor fragment, nothing the catalog doesn't publish, kept past that line;
// - skills: ~/.claude/skills' links, their clone's git remote and commit, their SKILL.md's name;
// - herdr mods: the folders under ~/.config/herdr-app/mods.
// The items: the catalogs' index and the live answers already cached (data/kt-market/).
// Reads kt-skills' frontmatter() (pure, read-only, as market.mjs); installed.js imports kt-plugins'.

import { readFile, readdir, lstat, realpath, stat } from "node:fs/promises";
import { states, repoOfRemote, serverFacts, knownOf } from "./installed.js";
import { dedupe } from "./model.js";
import { frontmatter } from "../kt-skills/frontmatter.js";

const HOME = process.env.HOME;
const DATA = `${HOME}/.config/herdr-app/data/kt-market`;
const LOCAL = ["official", "community", "known", "herdr-dev", "aitmpl"];
const out = (v) => process.stdout.write(JSON.stringify(v) + "\n");
const readJson = async (p) => { try { return JSON.parse(await readFile(p, "utf8")); } catch { return null; } };

async function run(cmd, args, { cwd, timeout = 60e3 } = {}) {
  try {
    const p = Bun.spawn([cmd, ...args], { cwd, stdin: "ignore", stdout: "pipe", stderr: "pipe" });
    const timer = setTimeout(() => p.kill(), timeout);
    const [o] = await Promise.all([new Response(p.stdout).text(), new Response(p.stderr).text()]);
    const code = await p.exited;
    clearTimeout(timer);
    return { code, out: o };
  } catch (e) { return { code: -1, out: "" }; }
}

// The plugins, as kt-plugins reads them: claude in the login shell (its PATH), no API key.
const RUN = `exec "\${SHELL:-/bin/zsh}" -lic 'env -u ANTHROPIC_API_KEY claude "$@"' claude "$@"`;
async function plugins() {
  const r = await run("sh", ["-c", RUN, "sh", "plugin", "list", "--json"], { cwd: HOME, timeout: 60e3 });
  const t = r.out;
  const i = t.search(/^\[/m), j = t.lastIndexOf("]");
  if (i < 0 || j < i) throw Object.assign(new Error("plugins"), { code: "plugins" });
  const list = JSON.parse(t.slice(i, j + 1));
  return (Array.isArray(list) ? list : []).filter((p) => typeof p?.id === "string")
    .map((p) => ({ id: p.id, version: typeof p.version === "string" ? p.version : null, scope: p.scope ?? null, enabled: p.enabled === true }));
}

// ~/.claude.json's servers, reduced at once by serverFacts() (installed.js) to their name, scope, the
// runner's name, the package it runs and the URL's origin and path. Every other argument, env value,
// header, URL userinfo, query or fragment is dropped here: never returned, written nor logged.
// `known`: the catalog's packages and remote URLs (knownOf): the only ones a server may be kept with.
async function servers(known) {
  let j = await readJson(`${HOME}/.claude.json`);
  if (!j) return [];
  const take = (scope, all) => Object.entries(all ?? {}).filter(([, s]) => s && typeof s === "object")
    .map(([name, s]) => ({ name: String(name).slice(0, 64), scope, ...serverFacts(s, known) }));
  const list = [...take("user", j.mcpServers), ...Object.values(j.projects ?? {}).flatMap((p) => take("local", p?.mcpServers))];
  j = null; // the whole file (its secrets) goes now
  return list;
}

// ~/.claude/skills: each link into a git clone (kt-skills' « Depuis GitHub » puts them so), its repo,
// the skill's folder in it, the clone's commit, its SKILL.md's name. A copied folder: its name only.
async function skills() {
  const dir = `${HOME}/.claude/skills`;
  const names = await readdir(dir).catch(() => []);
  const outList = [];
  for (const name of names) {
    if (name.startsWith(".") || name.startsWith("_")) continue;
    const st = await lstat(`${dir}/${name}`).catch(() => null);
    if (!st) continue;
    const target = st.isSymbolicLink() ? await realpath(`${dir}/${name}`).catch(() => null) : `${dir}/${name}`;
    if (!target) continue;
    const meta = frontmatter(await readFile(`${target}/SKILL.md`, "utf8").catch(() => "")).meta ?? {};
    const top = (await run("git", ["-C", target, "rev-parse", "--show-toplevel"], { timeout: 5e3 })).out.trim();
    const entry = { name, skill: typeof meta.name === "string" ? meta.name : null, repo: null, path: "", head: null };
    if (top && target.startsWith(top)) {
      entry.repo = repoOfRemote((await run("git", ["-C", top, "remote", "get-url", "origin"], { timeout: 5e3 })).out.trim());
      entry.head = (await run("git", ["-C", top, "rev-parse", "HEAD"], { timeout: 5e3 })).out.trim() || null;
      entry.path = target.slice(top.length + 1);
    }
    outList.push(entry);
  }
  return outList;
}

const mods = () => readdir(`${HOME}/.config/herdr-app/mods`).catch(() => []);

// The items the page can show: the index and the live answers in cache.
async function items() {
  const lists = await Promise.all(LOCAL.map(async (s) => (await readJson(`${DATA}/index/${s}.json`))?.items ?? []));
  const live = (await readdir(`${DATA}/live`).catch(() => [])).filter((f) => /^(mcp-registry|skills-sh)-[0-9a-f]{8}\.json$/.test(f));
  for (const f of live) lists.push((await readJson(`${DATA}/live/${f}`))?.items ?? []);
  return dedupe(lists);
}

// A plugin from a folder of its marketplace (no version in the catalog): the version its plugin.json
// says in the marketplace's clone, as kt-plugins' offered() reads it. Only for the installed ones.
async function folderVersions(its, pl) {
  const have = new Set(pl.map((p) => p.id));
  const [known, st] = await Promise.all([readJson(`${HOME}/.claude/plugins/known_marketplaces.json`), readJson(`${HOME}/.claude/settings.json`)]);
  const loc = {};
  for (const [n, m] of Object.entries(st?.extraKnownMarketplaces ?? {})) if (m?.source?.source === "directory") loc[n] = m.source.path;
  for (const [n, m] of Object.entries(known ?? {})) if (m?.installLocation) loc[n] = m.installLocation;
  await Promise.all(its.filter((it) => it.type === "plugin" && !it.version && it.pin?.kind === "market" && have.has(`${it.name}@${it.market}`) && loc[it.market])
    .map(async (it) => {
      const pj = await readJson(`${loc[it.market]}/${it.repo?.path ?? ""}/.claude-plugin/plugin.json`);
      if (typeof pj?.version === "string") it.version = pj.version;
    }));
}

const t0 = Date.now();
const errors = [];
const safe = (name, p) => p.catch(() => { errors.push(name); return []; });
const its = await items();
const [pl, sv, sk, md] = await Promise.all([safe("plugins", plugins()), safe("mcp", servers(knownOf(its))), safe("skills", skills()), safe("mods", mods())]);
await folderVersions(its, pl);
out({ at: new Date().toISOString(), states: states(its, { plugins: pl, servers: sv, skills: sk, mods: md }),
  counts: { plugins: pl.length, servers: sv.length, skills: sk.length, mods: md.length, items: its.length }, errors, ms: Date.now() - t0 });
