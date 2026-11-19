// market.mjs: kt-market's only network and disk side. The mod runs it through exec (never from render):
//   ~/.nix-profile/bin/bun ~/.config/herdr-app/mods/kt-market/market.mjs <command> [argument]
// Each command prints ONE JSON value on stdout (codes, never words: main.js says them).
//   sync [--force] [source…]  official, community, known, herdr-dev, aitmpl -> data/kt-market/index/<source>.json
//                             (a lock: one sync at a time; a source is re-read past its TTL, or with --force)
//   query '<json>'            { q, types, sources, sort, offset, limit } over the index; with words, the MCP
//                             registry and skills.sh are asked live (a cache per query, 24 h)
//   detail <id> [--force]     the inspection, on an explicit action only: a download at the pin (git, blobs
//                             filtered, sparse, bounded), the scans, the plan, the licence -> detail/<hash>.json
// Everything downloaded is untrusted: model.js cleans it; nothing from a repo is run (git with no hooks,
// no LFS smudge, no prompt; links never followed); only https URLs; values go to programs as argv.
// Cross-mod imports (accepted by the lead for pure modules, 2026-11-19): ../kt-plugins/plugins.js
// (components(): a plugin's parts from its files and JSON) and ../kt-skills/frontmatter.js
// (frontmatter(): a SKILL.md's meta and body), read-only, not copied. model.check.mjs imports both and
// checks the shapes this file relies on: a change of their signatures fails it.
// GitHub: the licence and stars through `gh api` (Kylian's login, read only, one GET per inspection,
// cached 7 days), the keyless API without gh; commits through `git ls-remote`.

import { mkdir, readFile, writeFile, rename, rm, readdir, lstat, mkdtemp, stat } from "node:fs/promises";
import {
  SOURCES, LIVE, TYPES, SAFE_MOD, clean, hash, github, safeRel, normalizeMarketplace, marketSource, normalizeRegistry,
  normalizeSkillsSh, normalizeHerdr, normalizeLoop, query as runQuery, dedupe, levelOf, code, scanHerdr, scanSkill,
  pluginFlags, repoFlags, findSkill, loopRecipe, plan, mcpVariants, tokens, ROW_OF, AITMPL,
} from "./model.js";
import { components } from "../kt-plugins/plugins.js";
import { frontmatter } from "../kt-skills/frontmatter.js";

const HOME = process.env.HOME;
const DATA = `${HOME}/.config/herdr-app/data/kt-market`;
const MIN = 6e4, HOUR = 36e5, DAY = 864e5;
const TTL = { official: 0, known: 0, community: DAY, "herdr-dev": HOUR, aitmpl: 7 * DAY };
const LOCAL = ["official", "community", "known", "herdr-dev", "aitmpl"];
const LIVE_TTL = DAY, DETAIL_TTL = 7 * DAY, GH_TTL = 7 * DAY;
// The detail's shape: a cached one of another shape is inspected again (2: plan.addMarket; 3: an MCP's
// plan as kt-mcp's form shows it, plan.form).
const DETAIL_V = 3;
const UA = { "user-agent": "kt-market" };
// A download's bounds: per file, in all, files.
const FILE_MAX = 256 * 1024, TREE_MAX = 8 * 1024 * 1024, FILES_MAX = 400;
const TEXT = /\.(md|markdown|json|jsonc|js|mjs|cjs|ts|tsx|luau|lua|toml|ya?ml|txt|sh|bash|zsh|py|rb)$|(^|\/)[^./]+$/i;

// ---------- small I/O ----------

const now = () => Date.now();
const T0 = now();
// KT_MARKET_TRACE=1: each step's time on stderr (the mod never reads stderr).
const trace = process.env.KT_MARKET_TRACE ? (s) => process.stderr.write(`${now() - T0} ms ${s}\n`) : () => {};
async function readJson(p) { try { return JSON.parse(await readFile(p, "utf8")); } catch { return null; } }
async function writeJson(p, v) {
  await mkdir(p.slice(0, p.lastIndexOf("/")), { recursive: true });
  const tmp = `${p}.${process.pid}.tmp`;
  await writeFile(tmp, JSON.stringify(v));
  await rename(tmp, p);
}
const out = (v) => process.stdout.write(JSON.stringify(v) + "\n");

/** A program, its argv as given (never a shell line). -> { code, out, err } (never rejects). */
async function run(cmd, args, { cwd, timeout = 60e3, env } = {}) {
  trace(`${cmd} ${args.filter((a) => !a.startsWith("core.") && !a.startsWith("protocol.") && a !== "-c").slice(0, 4).join(" ")}`);
  try {
    const p = Bun.spawn([cmd, ...args], { cwd, env: { ...process.env, ...env }, stdin: "ignore", stdout: "pipe", stderr: "pipe" });
    const timer = setTimeout(() => p.kill(), timeout);
    const [o, e] = await Promise.all([new Response(p.stdout).text(), new Response(p.stderr).text()]);
    const c = await p.exited;
    clearTimeout(timer);
    return { code: c, out: o, err: e };
  } catch (e) { return { code: -1, out: "", err: String(e?.message ?? e) }; }
}

// git on untrusted repos: no hooks, no LFS smudge, no credential prompt, no local-file protocol.
// A partial clone fetches a missing blob one request at a time (a `ls-tree -l` cost 18 s on 14 files):
// GIT_NO_LAZY_FETCH everywhere but the checkout, which downloads its chosen files in one batch.
const GIT_ENV = { GIT_TERMINAL_PROMPT: "0", GIT_LFS_SKIP_SMUDGE: "1", GIT_ASKPASS: "/usr/bin/false", GCM_INTERACTIVE: "never" };
const git = (args, o = {}) => run("git", ["-c", "core.hooksPath=/dev/null", "-c", "protocol.file.allow=never", "-c", "core.fsmonitor=false", "-c", "core.symlinks=false", ...args],
  { ...o, env: o.lazy ? GIT_ENV : { ...GIT_ENV, GIT_NO_LAZY_FETCH: "1" } });

async function getText(url, { etag, accept = "application/json", timeout = 30e3 } = {}) {
  trace(`GET ${url.slice(0, 100)}`);
  const r = await fetch(url, { headers: { ...UA, accept, ...(etag ? { "if-none-match": etag } : {}) }, signal: AbortSignal.timeout(timeout), redirect: "follow" });
  if (r.status === 304) return { notModified: true, etag };
  if (!r.ok) throw Object.assign(new Error(`http-${r.status}`), { code: r.status === 403 || r.status === 429 ? "rate-limited" : `http-${r.status}` });
  return { text: await r.text(), etag: r.headers.get("etag") };
}
async function getJson(url, o) {
  const r = await getText(url, o);
  if (r.notModified) return r;
  try { return { json: JSON.parse(r.text), etag: r.etag, bytes: r.text.length }; } catch { throw Object.assign(new Error("bad-json"), { code: "bad-json" }); }
}
const why = (e) => e?.code ?? (e?.name === "TimeoutError" ? "timeout" : "network");

// ---------- the marketplaces Claude Code knows (as kt-plugins' data.js reads them) ----------

async function markets() {
  const [known, st] = await Promise.all([readJson(`${HOME}/.claude/plugins/known_marketplaces.json`), readJson(`${HOME}/.claude/settings.json`)]);
  const all = {};
  for (const [name, m] of Object.entries(st?.extraKnownMarketplaces ?? {}))
    all[name] = { name, src: m?.source, loc: m?.source?.source === "directory" ? m.source.path : null, updatedAt: null };
  for (const [name, m] of Object.entries(known ?? {}))
    all[name] = { name, src: m?.source, loc: m?.installLocation ?? null, updatedAt: m?.lastUpdated ?? null };
  for (const m of Object.values(all)) m.repo = m.src?.source === "github" ? github(m.src.repo) : m.src?.url ? github(m.src.url) : null;
  return all;
}

// ---------- sync ----------

async function lock() {
  const p = `${DATA}/sync.lock`;
  await mkdir(DATA, { recursive: true });
  try { await writeFile(p, JSON.stringify({ pid: process.pid, at: now() }), { flag: "wx" }); return true; } catch {}
  const l = await readJson(p);
  let alive = false;
  try { process.kill(l?.pid, 0); alive = true; } catch {}
  if (alive && now() - (l?.at ?? 0) < 10 * MIN) return false;
  await writeFile(p, JSON.stringify({ pid: process.pid, at: now() }));
  return true;
}
const unlock = () => rm(`${DATA}/sync.lock`, { force: true });

async function syncMarkets(meta) {
  const ms = await markets();
  const bySource = { official: [], community: [], known: [] };
  let rejected = 0, communityLocal = false;
  for (const m of Object.values(ms)) {
    if (!m.loc) continue;
    const cat = await readJson(`${m.loc}/.claude-plugin/marketplace.json`);
    if (!cat) continue;
    const head = (await run("git", ["-C", m.loc, "rev-parse", "HEAD"], { timeout: 10e3 })).out.trim();
    const n = normalizeMarketplace(cat, { name: m.name, repo: m.repo, head, updatedAt: m.updatedAt });
    rejected += n.rejected;
    const src = marketSource(m.name, m.repo);
    if (src === "community") communityLocal = true;
    bySource[src].push(...n.items);
  }
  const at = new Date().toISOString();
  const res = {};
  for (const s of ["official", "known"]) {
    await writeJson(`${DATA}/index/${s}.json`, { source: s, fetchedAt: at, items: bySource[s] });
    meta[s] = { fetchedAt: at, count: bySource[s].length, rejected, error: null };
    res[s] = { count: bySource[s].length };
  }
  if (communityLocal) {
    await writeJson(`${DATA}/index/community.json`, { source: "community", fetchedAt: at, items: bySource.community, local: true });
    meta.community = { fetchedAt: at, count: bySource.community.length, error: null, local: true };
    res.community = { count: bySource.community.length, local: true };
  }
  return { res, communityLocal };
}

// Anthropic's community catalog, when Claude Code doesn't know it yet: its commit, then the catalog at it.
async function syncCommunity(meta) {
  const repo = { owner: "anthropics", name: "claude-plugins-community" };
  // The commit by git (no API call, no rate limit).
  const sha = (await git(["ls-remote", `https://github.com/${repo.owner}/${repo.name}.git`, "refs/heads/main"], { timeout: 30e3 })).out.split(/\s/)[0];
  if (!/^[0-9a-f]{40}$/.test(sha)) throw Object.assign(new Error("bad-sha"), { code: "bad-sha" });
  if (sha === meta.community?.head) return { count: meta.community.count, cached: true };
  const r = await getJson(`https://raw.githubusercontent.com/${repo.owner}/${repo.name}/${sha}/.claude-plugin/marketplace.json`);
  const name = /^[\w.-]+$/.test(r.json?.name ?? "") ? r.json.name : "claude-community";
  const n = normalizeMarketplace(r.json, { name, repo, head: sha, updatedAt: null });
  const at = new Date().toISOString();
  await writeJson(`${DATA}/index/community.json`, { source: "community", fetchedAt: at, items: n.items });
  meta.community = { fetchedAt: at, head: sha, count: n.items.length, rejected: n.rejected, bytes: r.bytes, error: null };
  return { count: n.items.length, bytes: r.bytes };
}

async function syncHerdr(meta) {
  const prev = meta["herdr-dev"] ?? {};
  const [mods, lays] = await Promise.all([
    getJson("https://assets.herdr.dev/mods/index.json", { etag: prev.etag?.mods }),
    getJson("https://assets.herdr.dev/layouts/index.json", { etag: prev.etag?.layouts })]);
  if (mods.notModified && lays.notModified) { meta["herdr-dev"] = { ...prev, fetchedAt: new Date().toISOString() }; return { count: prev.count, cached: true }; }
  const old = mods.notModified || lays.notModified ? (await readJson(`${DATA}/index/herdr-dev.json`))?.items ?? [] : [];
  const items = dedupe([
    mods.notModified ? old.filter((i) => i.type === "herdr-mod") : (mods.json?.mods ?? []).map((e) => normalizeHerdr(e, "mod")),
    lays.notModified ? old.filter((i) => i.type === "herdr-layout") : (lays.json?.layouts ?? []).map((e) => normalizeHerdr(e, "layout"))]);
  const at = new Date().toISOString();
  await writeJson(`${DATA}/index/herdr-dev.json`, { source: "herdr-dev", fetchedAt: at, items });
  meta["herdr-dev"] = { fetchedAt: at, etag: { mods: mods.etag, layouts: lays.etag }, generatedAt: mods.json?.generatedAt ?? prev.generatedAt ?? null,
    count: items.length, bytes: (mods.bytes ?? 0) + (lays.bytes ?? 0), error: null };
  return { count: items.length, bytes: meta["herdr-dev"].bytes };
}

async function syncAitmpl(meta) {
  const prev = meta.aitmpl ?? {};
  const r = await getJson("https://www.aitmpl.com/components.json", { etag: prev.etag, timeout: 60e3 });
  if (r.notModified) { meta.aitmpl = { ...prev, fetchedAt: new Date().toISOString() }; return { count: prev.count, cached: true }; }
  const items = dedupe([(r.json?.loops ?? []).map(normalizeLoop)]);
  const at = new Date().toISOString();
  await writeJson(`${DATA}/index/aitmpl.json`, { source: "aitmpl", fetchedAt: at, items });
  meta.aitmpl = { fetchedAt: at, etag: r.etag, count: items.length, bytes: r.bytes, error: null };
  return { count: items.length, bytes: r.bytes };
}

// The oldest files of a cache folder beyond `keep`.
async function prune(dir, keep) {
  const names = await readdir(dir).catch(() => []);
  if (names.length <= keep) return;
  const st = await Promise.all(names.map(async (n) => ({ n, t: (await stat(`${dir}/${n}`).catch(() => null))?.mtimeMs ?? 0 })));
  for (const { n } of st.sort((a, b) => a.t - b.t).slice(0, names.length - keep)) await rm(`${dir}/${n}`, { force: true });
}

async function sync(args) {
  const t0 = now();
  const force = args.includes("--force");
  const want = args.filter((a) => LOCAL.includes(a));
  if (!(await lock())) return out({ busy: true });
  try {
    const meta = (await readJson(`${DATA}/meta.json`)) ?? {};
    const due = (s) => (!want.length || want.includes(s)) && (force || !meta[s]?.fetchedAt || meta[s]?.error || now() - Date.parse(meta[s].fetchedAt) >= TTL[s]);
    const sources = {};
    const step = async (s, fn) => {
      const t = now();
      try { sources[s] = { ...(await fn()), ms: now() - t }; }
      catch (e) { meta[s] = { ...(meta[s] ?? {}), error: why(e), failedAt: new Date().toISOString() }; sources[s] = { error: why(e), ms: now() - t }; }
    };
    let communityLocal = false;
    if (due("official") || due("known") || due("community")) await step("markets", async () => { const r = await syncMarkets(meta); communityLocal = r.communityLocal; return r.res; });
    await Promise.all([
      !communityLocal && due("community") ? step("community", () => syncCommunity(meta)) : null,
      due("herdr-dev") ? step("herdr-dev", () => syncHerdr(meta)) : null,
      due("aitmpl") ? step("aitmpl", () => syncAitmpl(meta)) : null]);
    await writeJson(`${DATA}/meta.json`, meta);
    await Promise.all([prune(`${DATA}/detail`, 200), prune(`${DATA}/live`, 500)]);
    out({ ok: true, ms: now() - t0, sources });
  } finally { await unlock(); }
}

// ---------- query ----------

async function localItems() {
  const lists = await Promise.all(LOCAL.map(async (s) => (await readJson(`${DATA}/index/${s}.json`))?.items ?? []));
  return dedupe(lists);
}

// A live source's answer for these words: its cache (24 h), else asked; an error keeps an older cache.
async function live(source, q) {
  const file = `${DATA}/live/${source}-${hash(q)}.json`;
  const cached = await readJson(file);
  if (cached?.q === q && now() - Date.parse(cached.at) < LIVE_TTL) return { items: cached.items, state: "cache", at: cached.at };
  try {
    let items, hidden = {};
    if (source === "mcp-registry") {
      // The registry looks in names only, one substring: the longest word; the others filter here.
      const word = tokens(q).sort((a, b) => b.length - a.length)[0];
      const r = await getJson(`https://registry.modelcontextprotocol.io/v0.1/servers?search=${encodeURIComponent(word)}&version=latest&limit=100`);
      items = [];
      for (const w of r.json?.servers ?? []) {
        const it = normalizeRegistry(w);
        if (it?.hidden) hidden[it.hidden] = (hidden[it.hidden] ?? 0) + 1;
        else if (it) items.push(it);
      }
    } else {
      const r = await getJson(`https://skills.sh/api/search?q=${encodeURIComponent(q)}&limit=50`);
      items = (r.json?.skills ?? []).map(normalizeSkillsSh).filter(Boolean);
    }
    items = dedupe([items]);
    const at = new Date().toISOString();
    await writeJson(file, { q, at, items, hidden });
    const ids = (await readJson(`${DATA}/live/ids.json`)) ?? {};
    for (const it of items) ids[it.id] = file.split("/").pop();
    const keys = Object.keys(ids);
    for (const k of keys.slice(0, Math.max(0, keys.length - 3000))) delete ids[k];
    await writeJson(`${DATA}/live/ids.json`, ids);
    return { items, state: "ok", at, hidden };
  } catch (e) {
    return cached ? { items: cached.items, state: "stale", at: cached.at, error: why(e) } : { items: [], state: "error", error: why(e) };
  }
}

function parseReq(s) {
  let r = {};
  try { r = JSON.parse(s ?? "{}") ?? {}; } catch {}
  const list = (v, ok) => (Array.isArray(v) ? v.filter((x) => ok.includes(x)) : []);
  return { q: typeof r.q === "string" ? clean(r.q, 200) : "", types: list(r.types, TYPES), sources: list(r.sources, SOURCES),
    sort: ["relevance", "popular", "recent"].includes(r.sort) ? r.sort : "relevance", offset: Math.max(0, r.offset | 0), limit: Math.min(60, Math.max(1, r.limit | 0 || 60)) };
}

async function query(arg) {
  const t0 = now();
  const req = parseReq(arg);
  const meta = (await readJson(`${DATA}/meta.json`)) ?? {};
  const words = tokens(req.q).length > 0;
  const wants = (type) => !req.types.length || req.types.includes(type);
  const asked = {
    "mcp-registry": words && wants("mcp") ? live("mcp-registry", req.q) : null,
    "skills-sh": words && wants("skill") ? live("skills-sh", req.q) : null,
  };
  const [local, mcp, skills] = await Promise.all([localItems(), asked["mcp-registry"], asked["skills-sh"]]);
  const res = runQuery(dedupe([local, mcp?.items ?? [], skills?.items ?? []]), req);
  const sources = {};
  for (const s of LOCAL) sources[s] = { at: meta[s]?.fetchedAt ?? null, error: meta[s]?.error ?? null, count: meta[s]?.count ?? 0 };
  for (const [s, r] of [["mcp-registry", mcp], ["skills-sh", skills]])
    sources[s] = r ? { at: r.at ?? null, error: r.error ?? null, state: r.state, hidden: r.hidden ?? null } : { state: words ? "off" : "needs-query" };
  out({ ...res, q: req.q, sources, ms: now() - t0 });
}

// ---------- detail (the inspection) ----------

async function findItem(id) {
  for (const it of await localItems()) if (it.id === id) return it;
  const ids = (await readJson(`${DATA}/live/ids.json`)) ?? {};
  const f = ids[id];
  if (!f || !/^[\w-]+\.json$/.test(f)) return null;
  return ((await readJson(`${DATA}/live/${f}`))?.items ?? []).find((x) => x.id === id) ?? null;
}

// gh where it is installed (exec's PATH lacks the nix profile); null: not installed.
const GH = [`${HOME}/.nix-profile/bin/gh`, "/opt/homebrew/bin/gh", "/usr/local/bin/gh"];
async function ghBin() {
  for (const p of GH) if (await stat(p).catch(() => null)) return p;
  return null;
}

// GitHub's facts on a repo (licence, stars, archived, last push): ONE `gh api` GET per inspection, with
// Kylian's login and read only (decision 4, PROPOSAL.md §7); without gh or when it fails, the keyless
// API (60 requests an hour). Cached 7 days either way. owner/name come checked by model.js' github().
async function repoFacts(repo) {
  if (!repo) return { facts: null, error: null };
  const file = `${DATA}/gh/${repo.owner}__${repo.name}.json`;
  const c = await readJson(file);
  if (c && now() - Date.parse(c.at) < GH_TTL) return { facts: c.facts, error: null };
  try {
    let j = null, via = "api";
    const bin = await ghBin();
    if (bin) {
      const r = await run(bin, ["api", "--method", "GET", `repos/${repo.owner}/${repo.name}`], { timeout: 20e3, env: { GH_PROMPT_DISABLED: "1", NO_COLOR: "1" } });
      if (r.code === 0) { try { j = JSON.parse(r.out); via = "gh"; } catch {} }
    }
    if (!j) j = (await getJson(`https://api.github.com/repos/${repo.owner}/${repo.name}`, { accept: "application/vnd.github+json" })).json ?? {};
    const facts = { license: j.license?.spdx_id ?? null, license_name: clean(j.license?.name ?? "", 80) || null, stars: j.stargazers_count ?? null,
      archived: Boolean(j.archived), pushed_at: j.pushed_at ?? null, default_branch: j.default_branch ?? null, via };
    await writeJson(file, { at: new Date().toISOString(), facts });
    return { facts, error: null };
  } catch (e) { return { facts: c?.facts ?? null, error: why(e) }; }
}

/** A repo at `want` (a sha, a ref, or HEAD) in a fresh folder: blobs filtered out, the tree listed
 *  (sizes unknown until checked out). -> { dir, head, entries: [{ path, size: null, exec, link }] } */
async function fetchTree(url, want) {
  await mkdir(`${DATA}/inspect`, { recursive: true });
  const dir = await mkdtemp(`${DATA}/inspect/x-`);
  const fail = async (c) => { await drop(dir); throw Object.assign(new Error(c), { code: c }); };
  if ((await git(["init", "-q", dir])).code !== 0) await fail("git-init");
  await git(["-C", dir, "remote", "add", "origin", url]);
  const f = await git(["-C", dir, "fetch", "-q", "--depth", "1", "--filter=blob:none", "--no-tags", "origin", want || "HEAD"], { timeout: 120e3 });
  if (f.code !== 0) await fail("fetch-failed");
  const head = (await git(["-C", dir, "rev-parse", "FETCH_HEAD"])).out.trim();
  const ls = await git(["-C", dir, "ls-tree", "-r", "--full-tree", "FETCH_HEAD"], { timeout: 30e3 });
  const entries = [];
  for (const line of ls.out.split("\n")) {
    const m = line.match(/^(\d{6}) (\w+) [0-9a-f]+\t(.+)$/);
    if (!m || m[2] !== "blob") continue;
    const path = safeRel(m[3]);
    if (path == null || path !== m[3]) continue;
    entries.push({ path, size: null, exec: m[1] === "100755", link: m[1] === "120000" });
  }
  return { dir, head, entries };
}

/** Checks out these paths only (one batched download, 60 s at most), then reads them: links, files
 *  over FILE_MAX and what passes TREE_MAX are left unread. Sizes go back into t.entries. */
async function materialize(t, paths) {
  await writeFile(`${t.dir}/.git/info/sparse-checkout`, paths.map((p) => `/${p}`).join("\n") + "\n");
  await git(["-C", t.dir, "config", "core.sparseCheckout", "true"]);
  const c = await git(["-C", t.dir, t.checked ? "read-tree" : "checkout", ...(t.checked ? ["-mu", "HEAD"] : ["-q", "FETCH_HEAD"])], { timeout: 60e3, lazy: true });
  t.checked = true;
  if (c.code !== 0) throw Object.assign(new Error("checkout-failed"), { code: "checkout-failed" });
  const size = new Map(t.entries.map((e) => [e.path, e]));
  const files = [];
  let total = 0;
  for (const p of paths) {
    const st = await lstat(`${t.dir}/${p}`).catch(() => null);
    if (st?.isFile() && size.get(p)) size.get(p).size = st.size;
    if (!st?.isFile() || st.size > FILE_MAX || total + st.size > TREE_MAX) continue;
    total += st.size;
    files.push({ path: p, text: await readFile(`${t.dir}/${p}`, "utf8").catch(() => "") });
  }
  return files;
}

/** The files under `root` worth reading (by name: sizes come after the checkout), FILES_MAX at most. */
function pick(entries, root, test = TEXT) {
  const under = root ? entries.filter((e) => e.path === root || e.path.startsWith(`${root}/`)) : entries;
  return under.filter((e) => !e.link && test.test(e.path) && !/(^|\/)(node_modules|\.git)\//.test(e.path)).slice(0, FILES_MAX).map((e) => e.path);
}

async function drop(dir) {
  if (dir && dir.startsWith(`${DATA}/inspect/x-`)) await rm(dir, { recursive: true, force: true });
}

const rel = (root, p) => (root ? p.slice(root.length + 1) : p);
const fileList = (entries, root) => (root ? entries.filter((e) => e.path.startsWith(`${root}/`)) : entries)
  .slice(0, 300).map((e) => ({ path: rel(root, e.path), size: e.size, exec: e.exec, link: e.link }));
const readmeOf = (files, root, names) => {
  for (const n of names) { const f = files.find((x) => x.path === (root ? `${root}/${n}` : n)); if (f) return { name: n, text: clean(f.text, 64e3, { lines: true }) }; }
  return null;
};

// `claude plugin details` on a folder: its inventory and token cost (it runs nothing: PROPOSAL.md §6.3).
const RUN = `exec "\${SHELL:-/bin/zsh}" -lic 'env -u ANTHROPIC_API_KEY claude "$@"' claude "$@"`;
async function pluginDetails(dir, name) {
  if (!/^[\w.-]+$/.test(name) || !dir.startsWith("/")) return null;
  const r = await run("sh", ["-c", RUN, "sh", "--plugin-dir", dir, "plugin", "details", name], { timeout: 90e3 });
  if (r.code !== 0) return null;
  const lines = clean(r.out, 8000, { lines: true }).split("\n");
  const i = lines.findIndex((l) => l.startsWith(`${name} `) || l === name);
  return lines.slice(Math.max(0, i)).join("\n").trim() || null;
}

async function inspectPlugin(it, d) {
  const ms = await markets();
  const m = ms[it.market];
  const entryPath = it.repo?.path ?? "";
  let t = null, root, base, files, entries, local = false;
  try {
    if (!it.url && m?.loc) {
      // A folder of a marketplace Claude Code already has: read where it is.
      local = true;
      base = `${m.loc}${entryPath ? `/${entryPath}` : ""}`;
      const walk = await run("find", [base, "-type", "f", "-size", "-256k", "-not", "-path", "*/node_modules/*", "-not", "-path", "*/.git/*"], { timeout: 20e3 });
      entries = walk.out.split("\n").filter(Boolean).slice(0, 2000).map((p) => ({ path: p.slice(base.length + 1), size: null, exec: false, link: false }));
      files = await Promise.all(entries.filter((e) => /\.(json|md)$/i.test(e.path)).slice(0, FILES_MAX).map(async (e) => ({ path: e.path, text: await readFile(`${base}/${e.path}`, "utf8").catch(() => "") })));
      root = "";
      d.head = it.pin?.value ?? null;
    } else {
      const url = it.url ?? (it.repo ? `https://github.com/${it.repo.owner}/${it.repo.name}.git` : null);
      if (!url) throw Object.assign(new Error("no-source"), { code: "no-source" });
      t = await fetchTree(url, it.pin?.kind === "sha" || it.pin?.kind === "market" ? it.pin.value : it.repo?.ref);
      root = entryPath;
      entries = t.entries;
      files = await materialize(t, pick(entries, root, /\.(json|jsonc|md)$/i));
      base = `${t.dir}${root ? `/${root}` : ""}`;
      d.head = t.head;
    }
    const text = (p) => files.find((f) => f.path === (root ? `${root}/${p}` : p))?.text ?? null;
    const json = (p) => { try { return JSON.parse(text(p) ?? ""); } catch { return null; } };
    const pj = json(".claude-plugin/plugin.json");
    const load = (field, file) => [json(file), ...[pj?.[field]].flat().filter((x) => typeof x === "string").map((p) => json(safeRel(p) ?? "")),
      ...[pj?.[field]].flat().filter((x) => x && typeof x === "object")].filter(Boolean);
    const hooks = load("hooks", "hooks/hooks.json"), mcp = load("mcpServers", ".mcp.json"), lsp = load("lspServers", ".lsp.json");
    const paths = (local ? entries.map((e) => e.path) : entries.filter((e) => !root || e.path.startsWith(`${root}/`)).map((e) => rel(root, e.path))).map((p) => `/p/${p}`);
    const comps = components("/p", paths, { hooks, mcp, lsp });
    const servers = mcp.flatMap((o) => Object.values(o?.mcpServers ?? o ?? {})).filter((s) => s && typeof s === "object");
    d.components = comps;
    d.flags.push(...pluginFlags(comps, servers));
    d.servers = servers.slice(0, 20).map((s) => ({ command: clean(s.command ?? "", 200) || null, args: (Array.isArray(s.args) ? s.args : []).slice(0, 20).map((a) => clean(String(a), 200)), url: clean(s.url ?? "", 300) || null }));
    d.readme = readmeOf(files, root, ["README.md", "readme.md", "README"]);
    d.manifest = pj ? clean(JSON.stringify(pj, null, 2), 16e3, { lines: true }) : null;
    d.files = local ? entries.slice(0, 300) : fileList(entries, root);
    const name = /^[\w.-]+$/.test(pj?.name ?? "") ? pj.name : it.name;
    if (!comps.mods.length) d.details = await pluginDetails(base, name);
    const known = Object.values(ms).some((x) => x.repo?.owner === "anthropics" && x.repo?.name === "claude-plugins-community");
    d.plan = plan(it, { addMarket: it.source === "community" && !known ? "anthropics/claude-plugins-community" : null });
  } finally { await drop(t?.dir); }
}

async function inspectMcp(it, d) {
  const variants = it.variants ?? [];
  d.variants = variants.map((v) => ({ ...v, flags: [v.host ? `remote-mcp:${v.host}` : null, v.pinned ? null : "unpinned", v.secrets.length ? `secrets:${v.secrets.length}` : null, v.needs ? "needs-args" : null].filter(Boolean) }));
  d.plan = plan(it, { variant: variants[0] });
  if (it.repo) {
    try {
      const r = await getText(`https://raw.githubusercontent.com/${it.repo.owner}/${it.repo.name}/HEAD/${it.repo.path ? `${it.repo.path}/` : ""}README.md`, { accept: "text/plain" });
      d.readme = { name: "README.md", text: clean(r.text, 64e3, { lines: true }) };
    } catch (e) { d.errors.push(`readme:${why(e)}`); }
  }
}

async function inspectSkill(it, d) {
  if (!it.repo) { d.plan = plan(it); return; }
  let t = null;
  try {
    t = await fetchTree(`https://github.com/${it.repo.owner}/${it.repo.name}.git`, null);
    d.head = t.head;
    const mds = t.entries.filter((e) => /(^|\/)SKILL\.md$/.test(e.path) && !e.link && !/(^|\/)node_modules\//.test(e.path)).slice(0, 300).map((e) => e.path);
    const read = await materialize(t, mds);
    const cands = read.map((f) => ({ path: f.path, name: String(frontmatter(f.text).meta?.name ?? ""), text: f.text }));
    const dir = findSkill(cands, it.name);
    if (dir == null) { d.flags.push("no-skill-md"); d.plan = plan(it, { skillPath: null }); return; }
    const files = await materialize(t, [...new Set([...mds, ...pick(t.entries, dir)])]);
    const text = new Map(files.map((f) => [f.path, f.text]));
    const mine = t.entries.filter((e) => !dir || e.path.startsWith(`${dir}/`));
    const md = cands.find((c) => c.path === (dir ? `${dir}/SKILL.md` : "SKILL.md"));
    const meta = frontmatter(md?.text ?? "").meta ?? {};
    d.flags.push(...scanSkill(mine.map((e) => ({ path: e.path, exec: e.exec, text: (text.get(e.path) ?? "").slice(0, 200) })), meta));
    if (t.entries.some((e) => e.link && (!dir || e.path.startsWith(`${dir}/`)))) d.flags.push("symlink");
    d.skillPath = dir;
    d.readme = md ? { name: "SKILL.md", text: clean(md.text, 64e3, { lines: true }) } : null;
    d.description = clean(meta.description ?? "", 600) || null;
    d.files = fileList(t.entries, dir);
    d.plan = plan(it, { skillPath: dir });
  } finally { await drop(t?.dir); }
}

async function inspectHerdr(it, d) {
  let t = null;
  try {
    t = await fetchTree(`https://github.com/${it.repo.owner}/${it.repo.name}.git`, it.pin?.value ?? it.repo.ref);
    d.head = t.head;
    const root = it.repo.path;
    const files = await materialize(t, pick(t.entries, root, /\.(m?js|ts|json|md)$/i));
    const scan = scanHerdr(files.map((f) => ({ path: rel(root, f.path), text: f.text })));
    d.flags.push(...scan.flags);
    d.findings = scan.findings;
    const mods = [...new Set(t.entries.map((e) => rel(root, e.path).match(/^mods\/([^/]+)\/main\.js$/)?.[1]).filter(Boolean))];
    d.mods = mods;
    if (mods.some((n) => !SAFE_MOD.test(n))) d.flags.push("bad-name");
    const taken = [];
    for (const n of mods) if (await lstat(`${HOME}/.config/herdr-app/mods/${n}`).catch(() => null)) taken.push(n);
    if (taken.length) d.flags.push(`name-clash:${taken.join(",")}`);
    if (t.entries.some((e) => e.link && (!root || e.path.startsWith(`${root}/`)))) d.flags.push("symlink");
    d.layouts = t.entries.map((e) => rel(root, e.path).match(/^layouts\/([^/]+)\.json$/)?.[1]).filter(Boolean);
    d.readme = readmeOf(files, root, ["RECIPE.md", "README.md"]);
    d.files = fileList(t.entries, root);
    d.plan = plan(it, { mods });
  } finally { await drop(t?.dir); }
}

async function inspectLoop(it, d) {
  const { owner, name, path } = it.repo;
  let sha = null;
  // The commit by git (no API call: the inspection's one GitHub request is the licence's).
  const ls = await git(["ls-remote", `https://github.com/${owner}/${name}.git`, "HEAD"], { timeout: 30e3 });
  if (ls.code === 0) sha = ls.out.split(/\s/)[0];
  else d.errors.push("pin:fetch-failed");
  if (!/^[0-9a-f]{40}$/.test(sha ?? "")) sha = null;
  const r = await getText(`https://raw.githubusercontent.com/${owner}/${name}/${sha ?? "HEAD"}/${path}`, { accept: "text/plain" });
  const fm = frontmatter(r.text);
  const recipe = loopRecipe(fm.body ?? r.text, fm.meta ?? {});
  d.head = sha;
  d.loop = recipe;
  d.readme = { name: path.split("/").pop(), text: clean(r.text, 64e3, { lines: true }) };
  d.plan = plan(it, { prompt: recipe.prompt });
}

async function detail(id, args) {
  const t0 = now();
  const it = typeof id === "string" && id.length < 400 ? await findItem(id) : null;
  if (!it) return out({ error: "unknown-id", id: clean(id ?? "", 200) });
  const file = `${DATA}/detail/${hash(id)}.json`;
  const c = await readJson(file);
  if (!args.includes("--force") && c?.v === DETAIL_V && c.id === id && c.pin === (it.pin?.value ?? null) && now() - Date.parse(c.at) < DETAIL_TTL) return out({ ...c, cached: true });
  const d = { v: DETAIL_V, id, at: new Date().toISOString(), pin: it.pin?.value ?? null, item: ROW_OF(it), head: null, flags: [...it.flags], errors: [],
    readme: null, files: [], findings: [], plan: null };
  try {
    if (it.type === "plugin") await inspectPlugin(it, d);
    else if (it.type === "mcp") await inspectMcp(it, d);
    else if (it.type === "skill") await inspectSkill(it, d);
    else if (it.type === "herdr-mod" || it.type === "herdr-layout") await inspectHerdr(it, d);
    else if (it.type === "loop") await inspectLoop(it, d);
  } catch (e) { d.errors.push(why(e)); }
  const { facts, error } = await repoFacts(it.repo);
  if (error) d.errors.push(`github:${error}`);
  d.repoFacts = facts;
  d.flags.push(...repoFlags(facts && { license: { spdx_id: facts.license }, archived: facts.archived, pushed_at: facts.pushed_at }));
  d.flags = [...new Set(d.flags)];
  d.level = levelOf(d.flags);
  if (d.plan?.route && d.level === "blocking") d.plan = { ...d.plan, route: null, why: code(d.flags.find((f) => levelOf([f]) === "blocking")) };
  d.ms = now() - t0;
  await writeJson(file, d);
  out(d);
}

// ---------- main ----------

const [cmd, ...rest] = process.argv.slice(2);
try {
  if (cmd === "sync") await sync(rest);
  else if (cmd === "query") await query(rest[0]);
  else if (cmd === "detail") await detail(rest[0], rest.slice(1));
  else out({ error: "usage" });
} catch (e) {
  out({ error: why(e) });
  process.exitCode = 1;
}
