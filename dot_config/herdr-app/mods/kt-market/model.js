// model.js: kt-market's pure side (no herdr, no gpui, no I/O), run by market.mjs (bun) and checked by
// `bun mods/kt-market/model.check.mjs` on invented fixtures.
// - the sources' entries normalized into one item shape (PROPOSAL.md §3), everything downloaded being
//   untrusted: text cleaned (control, ANSI, OSC, bidi), names and ids checked, URLs https only;
// - the search (every token must match), the facet counts and the sorts;
// - the risk rules (codes, never words: main.js says them), the scans of a downloaded tree;
// - what an install would run (each route's lines; a variant as kt-mcp's form takes it, mcpForm()).

export const SOURCES = ["official", "community", "known", "mcp-registry", "skills-sh", "herdr-dev", "aitmpl"];
/** Sources asked at query time (too big to mirror, or no listing): a query needs words. */
export const LIVE = new Set(["mcp-registry", "skills-sh"]);
export const TYPES = ["plugin", "mcp", "skill", "herdr-mod", "herdr-layout", "loop", "automation"];
/** A mod name Herdr opens safely (kt-mods' SAFE: a dot crashed the window). */
export const SAFE_MOD = /^[a-z0-9-]+$/;
const PART = /^[A-Za-z0-9_.-]{1,100}$/;
const NATIVE = /^[A-Za-z0-9._@/+:#-]{1,300}$/;
const SHA = /^[0-9a-f]{40}$/;
const DAY = 864e5;

// ---------- text ----------

const ANSI = /\u001b\[[0-?]*[ -/]*[@-~]|\u001b\][^\u0007\u001b]*(?:\u0007|\u001b\\)?|\u001b[@-_]/g;
const CTRL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/g;
const BIDI = /[‎‏‪-‮⁦-⁩]/g;

/** Untrusted text for the screen: escape sequences, control and bidi characters out, capped.
 *  One line (spaces collapsed) unless `lines`. */
export function clean(s, max = 400, { lines = false } = {}) {
  let t = typeof s === "string" ? s : s == null ? "" : String(s);
  t = t.replace(ANSI, "").replace(BIDI, "");
  t = lines ? t.replace(/\r\n?/g, "\n").replace(/[\u0000-\u0008\u000b-\u001f\u007f-\u009f]/g, "") : t.replace(CTRL, " ").replace(/\s+/g, " ").trim();
  return t.length > max ? t.slice(0, max - 1) + "…" : t;
}

/** An https URL kept as is, else null. */
export const https = (u) => (typeof u === "string" && u.length < 500 && /^https:\/\/[^\s"'<>\\]+$/.test(u) ? u : null);

/** "https://github.com/o/r(.git)(/…)" or "o/r" -> { owner, name }, else null. */
export function github(u) {
  const s = String(u ?? "").trim();
  const m = s.match(/^https:\/\/github\.com\/([^/\s]+)\/([^/\s#?]+?)(?:\.git)?(?:[/#?].*)?$/i) ?? s.match(/^([^/\s:]+)\/([^/\s:]+)$/);
  if (!m || !PART.test(m[1]) || !PART.test(m[2]) || m[2].startsWith(".")) return null;
  return { owner: m[1], name: m[2] };
}

/** A path inside a repo: relative, no "..", no "." segment, plain characters; "" for the root. */
export function safeRel(p) {
  const parts = String(p ?? "").replace(/^\.\//, "").split("/").filter(Boolean);
  return parts.every((x) => x !== "." && x !== ".." && /^[\w.@+ -]{1,120}$/.test(x)) ? parts.join("/") : null;
}

/** FNV-1a, 32 bits: a file name for an id or a query. */
export function hash(s) {
  let h = 0x811c9dc5;
  for (const c of String(s)) { h ^= c.codePointAt(0); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, "0");
}

// ---------- the item ----------

const LOOP = /(^|[^a-z])(loops?|ralph)([^a-z]|$)/i;
const AUTOMATION = /automat|schedul|\bcron\b/i;
const tagsOf = (...lists) => [...new Set(lists.flat().filter((x) => typeof x === "string").map((x) => clean(x, 40).toLowerCase()).filter(Boolean))].slice(0, 12);

function item(o) {
  const it = {
    id: `${o.type}:${o.source}:${o.native}`, type: o.type, source: o.source, name: o.name,
    title: clean(o.title ?? o.name, 120), description: clean(o.description ?? "", o.max ?? 400),
    author: o.author ? clean(o.author, 80) : null, market: o.market ?? null,
    repo: o.repo ?? null, url: o.url ?? null, pin: o.pin ?? { kind: "none", value: null },
    homepage: https(o.homepage), preview: o.preview ?? null,
    popularity: o.popularity ?? null, updatedAt: o.updatedAt ?? null, version: o.version ? clean(o.version, 40) : null,
    tags: o.tags ?? [], flags: o.flags ?? [], route: o.route ?? null, why: o.why ?? null,
  };
  if (it.route && o.flags?.some((f) => levelOf([f]) === "blocking")) { it.why = it.why ?? code(o.flags.find((f) => levelOf([f]) === "blocking")); it.route = null; }
  it.hay = [it.name, it.title, it.description, it.author, it.market, it.repo ? `${it.repo.owner}/${it.repo.name}` : "", ...it.tags].join(" ").toLowerCase();
  return it;
}

const authorOf = (a) => (typeof a === "string" ? a : a && typeof a === "object" ? a.name : null);
const pop = (unit, n) => (Number.isFinite(n) && n >= 0 ? { unit, n } : null);
const iso = (d) => (typeof d === "string" && !Number.isNaN(Date.parse(d)) ? new Date(Date.parse(d)).toISOString() : null);

// ---------- plugins (a marketplace.json) ----------

/** Which source a marketplace is: the reserved Anthropic names count only from github.com/anthropics. */
export function marketSource(name, repo) {
  const anthropic = repo?.owner === "anthropics";
  if (anthropic && name === "claude-plugins-official") return "official";
  if (anthropic && repo?.name === "claude-plugins-community") return "community";
  return "known";
}

/** A marketplace.json's plugins. `m`: { name, repo ({owner,name}|null), head (its clone's commit, or
 *  the fetched catalog's), updatedAt }. -> { items, rejected } */
export function normalizeMarketplace(catalog, m) {
  const source = marketSource(m.name, m.repo);
  const items = [];
  let rejected = 0;
  for (const e of Array.isArray(catalog?.plugins) ? catalog.plugins : []) {
    const name = typeof e?.name === "string" ? e.name : "";
    if (!PART.test(name) || !PART.test(m.name)) { rejected++; continue; }
    const s = e.source;
    const flags = [];
    let repo = null, url = null, pin = { kind: "none", value: null }, why = null;
    if (typeof s === "string") {
      const rel = safeRel(s);
      if (rel == null) { rejected++; continue; }
      repo = m.repo ? { ...m.repo, path: rel, ref: null } : null;
      pin = { kind: "market", value: SHA.test(m.head ?? "") ? m.head : null };
    } else if (s && typeof s === "object" && s.source === "command") {
      flags.push("command-source");
    } else if (s && typeof s === "object" && ["url", "git-subdir", "github"].includes(s.source)) {
      url = s.source === "github" ? (github(s.repo) ? `https://github.com/${s.repo}.git` : null) : https(s.url);
      const gh = github(s.source === "github" ? s.repo : s.url);
      const rel = safeRel(s.path ?? "");
      if (!url || rel == null) { why = "non-https"; }
      repo = gh ? { ...gh, path: rel ?? "", ref: typeof s.ref === "string" ? clean(s.ref, 100) : null } : null;
      if (SHA.test(s.sha ?? "")) pin = { kind: "sha", value: s.sha };
      else flags.push("unpinned");
    } else why = "unsupported-source";
    if (e.hooks) flags.push("hooks");
    if (e.mcpServers) flags.push("plugin-mcp");
    if (e.lspServers) flags.push("plugin-lsp");
    const kw = tagsOf(e.keywords ?? [], e.tags ?? [], e.category ?? []);
    const loop = LOOP.test(`${name} ${kw.join(" ")}`);
    items.push(item({
      type: "plugin", source, native: `${name}@${m.name}`, name, title: e.displayName ?? name, description: e.description,
      author: authorOf(e.author), market: m.name, repo, url, pin, homepage: e.homepage, version: typeof e.version === "string" ? e.version : null,
      updatedAt: m.updatedAt ?? null, tags: loop ? [...kw, "loop"] : kw, flags, route: why ? null : "kt-plugins", why,
    }));
  }
  return { items, rejected };
}

// ---------- MCP (the official registry's server.json) ----------

const DEAD = /(^|\.)(server\.smithery\.ai|run\.tools)$/i;
const ENV = /^[A-Za-z_][A-Za-z0-9_]{0,100}$/;
const HEADER = /^[A-Za-z0-9-]{1,100}$/;
const FLAG = /^--?[A-Za-z0-9][\w-]{0,60}$/;
const IDENT = { npm: /^(@[a-z0-9._-]+\/)?[a-z0-9._-]+$/i, pypi: /^[A-Za-z0-9._-]+$/, oci: /^[a-z0-9./_-]+(:[\w.-]+)?$/i };
const VERSION = /^[\w.+-]{1,60}$/;

/** A registry argument list -> { args, needs } (needs: a value the person has to give). */
function argList(list) {
  const args = [];
  let needs = false;
  for (const a of Array.isArray(list) ? list : []) {
    const v = a?.value ?? a?.default;
    const val = v == null ? null : clean(String(v), 200);
    if (a?.type === "named") {
      if (!FLAG.test(a.name ?? "")) { needs = true; continue; }
      args.push(a.name);
      if (val != null) args.push(val);
      else if (a.isRequired) needs = true;
    } else if (val != null) args.push(val);
    else needs = true;
    if (val != null && /\{[^}]*\}/.test(val)) needs = true;
  }
  return { args, needs };
}

/** What `claude mcp add` could run from a server.json: stdio packages (npm, pypi, oci) then
 *  remotes (http, sse), each { kind, config, secrets, env, needs, pinned, host }. Secret values are
 *  always empty strings: the person types them in kt-mcp's form. Dead hosts are left out. */
export function mcpVariants(s) {
  const out = [];
  for (const p of Array.isArray(s?.packages) ? s.packages : []) {
    const kind = p?.registryType;
    if (!IDENT[kind] || p?.transport?.type !== "stdio" || !IDENT[kind].test(p.identifier ?? "")) continue;
    const pinned = VERSION.test(p.version ?? "") && p.version !== "latest";
    const env = (Array.isArray(p.environmentVariables) ? p.environmentVariables : []).filter((v) => ENV.test(v?.name ?? ""));
    const rt = argList(p.runtimeArguments), pa = argList(p.packageArguments);
    const id = p.identifier;
    const pkg = !pinned ? id : kind === "npm" ? `${id}@${p.version}` : kind === "pypi" ? `${id}==${p.version}` : id.includes(":") ? id : `${id}:${p.version}`;
    const command = { npm: "npx", pypi: "uvx", oci: "docker" }[kind];
    const args = kind === "npm" ? ["-y", ...rt.args, pkg, ...pa.args]
      : kind === "pypi" ? [...rt.args, pkg, ...pa.args]
      : ["run", "-i", "--rm", ...env.flatMap((v) => ["-e", v.name]), ...rt.args, pkg, ...pa.args];
    const config = { type: "stdio", command, args };
    if (env.length) config.env = Object.fromEntries(env.map((v) => [v.name, ""]));
    out.push({ kind, config, secrets: env.filter((v) => v.isSecret).map((v) => v.name), env: env.map((v) => v.name),
      needs: rt.needs || pa.needs || env.some((v) => v.isRequired && !v.isSecret && v.default == null), pinned, host: null });
  }
  for (const r of Array.isArray(s?.remotes) ? s.remotes : []) {
    const url = https(r?.url);
    const type = r?.type === "streamable-http" ? "http" : r?.type === "sse" ? "sse" : null;
    if (!url || !type) continue;
    const host = url.replace(/^https:\/\//, "").split(/[/:?#]/)[0].toLowerCase();
    if (DEAD.test(host)) continue;
    const headers = (Array.isArray(r.headers) ? r.headers : []).filter((h) => HEADER.test(h?.name ?? ""));
    const config = { type, url };
    if (headers.length) config.headers = Object.fromEntries(headers.map((h) => [h.name, ""]));
    out.push({ kind: type, config, secrets: headers.filter((h) => h.isSecret).map((h) => h.name), env: [],
      needs: /\{[^}]*\}/.test(url) || headers.some((h) => h.isRequired && !h.isSecret), pinned: true, host });
  }
  return out;
}

/** One registry entry ({ server, _meta }) -> an item, or { hidden: code }. */
export function normalizeRegistry(w) {
  const s = w?.server;
  const meta = w?._meta?.["io.modelcontextprotocol.registry/official"] ?? {};
  if (!s || !NATIVE.test(s.name ?? "")) return { hidden: "bad-name" };
  if (meta.status && meta.status !== "active") return { hidden: "inactive" };
  const variants = mcpVariants(s);
  const remotes = Array.isArray(s.remotes) ? s.remotes : [];
  if (!variants.length && remotes.some((r) => DEAD.test(String(https(r?.url) ?? "").replace(/^https:\/\//, "").split(/[/:?#]/)[0]))) return { hidden: "dead-host" };
  const v = variants[0];
  const flags = [];
  if (v?.host) flags.push(`remote-mcp:${v.host}`);
  if (v && !v.pinned) flags.push("unpinned");
  if (v?.secrets.length) flags.push(`secrets:${v.secrets.length}`);
  if (v?.needs) flags.push("needs-args");
  const short = String(s.name).split("/").pop();
  const it = item({
    type: "mcp", source: "mcp-registry", native: s.name, name: PART.test(short) ? short : "server", title: s.title ?? short,
    description: s.description, author: String(s.name).split("/")[0], repo: github(s.repository?.url) ? { ...github(s.repository.url), path: safeRel(s.repository?.subfolder ?? "") ?? "", ref: null } : null,
    pin: v?.pinned && !v.host ? { kind: "version", value: s.version } : { kind: v?.host ? "remote" : "none", value: null },
    homepage: s.websiteUrl, version: s.version, updatedAt: iso(meta.updatedAt) ?? iso(meta.publishedAt),
    tags: tagsOf(variants.map((x) => x.kind)), flags, route: v ? "kt-mcp" : null, why: v ? null : "no-variant",
  });
  it.variants = variants.slice(0, 6); // for the inspection; never in a row
  return it;
}

// ---------- skills.sh (search results) ----------

/** One /api/search result -> an item. Only a GitHub owner/repo source is installable (kt-skills). */
export function normalizeSkillsSh(r) {
  const skillId = typeof r?.skillId === "string" ? r.skillId : "";
  const src = typeof r?.source === "string" ? r.source : "";
  if (!/^[\w.:-]{1,100}$/.test(skillId) || !/^[\w./-]{1,200}$/.test(src)) return null;
  const gh = /^[^/]+\/[^/]+$/.test(src) ? github(src) : null;
  return item({
    type: "skill", source: "skills-sh", native: `${src}/${skillId}`, name: skillId, title: r.name ?? skillId,
    description: "", author: gh?.owner ?? src, repo: gh ? { ...gh, path: "", ref: null } : null,
    popularity: pop("installs", Number(r.installs)), tags: [], route: gh ? "kt-skills" : null, why: gh ? null : "non-github",
  });
}

// ---------- herdr.dev (assets.herdr.dev/{mods,layouts}/index.json) ----------

/** One gallery entry -> an item. `kind`: "mod" or "layout". */
export function normalizeHerdr(e, kind) {
  if (!PART.test(e?.owner ?? "") || !PART.test(e?.repo ?? "")) return null;
  const path = safeRel(e.path ?? "");
  if (path == null) return null;
  const names = Array.isArray(e.modNames) ? e.modNames.map(String) : [];
  const flags = [];
  if (names.some((n) => !SAFE_MOD.test(n))) flags.push("bad-name");
  if (e.hasKeys) flags.push("keys-json");
  const auto = AUTOMATION.test(`${e.name ?? ""} ${e.blurb ?? ""}`);
  const preview = https(e.previewUrl)?.startsWith("https://assets.herdr.dev/") ? e.previewUrl : null;
  return item({
    type: kind === "layout" ? "herdr-layout" : "herdr-mod", source: "herdr-dev", native: `${e.owner}/${e.repo}${path ? `/${path}` : ""}`,
    name: clean(e.name ?? e.repo, 80), title: e.name ?? e.repo, description: e.blurb, max: 600, author: e.owner,
    repo: { owner: e.owner, name: e.repo, path, ref: PART.test(e.defaultBranch ?? "") ? e.defaultBranch : null },
    pin: SHA.test(e.headCommit ?? "") ? { kind: "sha", value: e.headCommit } : { kind: "none", value: null },
    popularity: pop("stars", Number(e.stars)), updatedAt: iso(e.pushedAt), preview,
    tags: auto ? ["automation"] : [], flags: SHA.test(e.headCommit ?? "") ? flags : [...flags, "unpinned"],
    route: kind === "layout" ? null : "herdr-thread", why: kind === "layout" ? "layout-readonly" : null,
  });
}

// ---------- aitmpl (components.json, its loops) ----------

export const AITMPL = { owner: "davila7", name: "claude-code-templates", base: "cli-tool/components/loops" };

/** One aitmpl loop -> an item (its text is read at inspection, in the repo). */
export function normalizeLoop(e) {
  const path = safeRel(e?.path ?? "");
  const name = typeof e?.name === "string" ? e.name : "";
  if (!path || !/\.md$/.test(path) || !PART.test(name)) return null;
  const rec = e.skillspector?.recommendation;
  return item({
    type: "loop", source: "aitmpl", native: path, name, title: name, description: e.description, author: AITMPL.owner,
    repo: { owner: AITMPL.owner, name: AITMPL.name, path: `${AITMPL.base}/${path}`, ref: null },
    popularity: pop("downloads", Number(e.downloads)), tags: tagsOf(e.keywords ?? [], e.category ?? [], ["loop"]),
    flags: /^[A-Z_]{2,30}$/.test(rec ?? "") ? [`third-party-scan:${rec}`] : [], route: "loop-session",
  });
}

// ---------- risk ----------

const LEVELS = ["info", "warn", "danger", "blocking"];
const LEVEL = {
  "command-source": "blocking", "bad-name": "blocking", "name-clash": "blocking",
  unpinned: "danger", mods: "danger",
  hooks: "warn", "plugin-mcp": "warn", "plugin-lsp": "warn", "remote-mcp": "warn", scripts: "warn", "skill-hooks": "warn",
  "herdr-exec": "warn", "herdr-hc": "warn", "herdr-fetch": "warn", "herdr-write": "warn", "herdr-fs": "warn", "herdr-focus": "warn",
  "keys-json": "warn", "license-unknown": "warn", "needs-args": "warn", symlink: "warn",
};
/** "remote-mcp:host" -> "remote-mcp". */
export const code = (f) => String(f).split(":")[0];
/** The highest level of a list of flags ("info" for an empty one). */
export function levelOf(flags) {
  let best = 0;
  for (const f of flags ?? []) {
    const c = code(f);
    const l = c === "third-party-scan" ? (f.endsWith(":DO_NOT_INSTALL") ? "warn" : "info") : LEVEL[c] ?? "info";
    best = Math.max(best, LEVELS.indexOf(l));
  }
  return LEVELS[best];
}

/** A command an MCP server or a hook runs: does it name a package without a version? true, false,
 *  or null (not a runner we know). */
export function unpinnedRun(command, args = []) {
  const bin = String(command ?? "").split("/").pop();
  const list = (Array.isArray(args) ? args : []).map(String);
  if (bin === "npx" || bin === "bunx" || (bin === "pnpm" && list[0] === "dlx")) {
    const pkg = list.filter((a) => a !== "dlx").find((a) => !a.startsWith("-"));
    return pkg ? !/^(@[^/@\s]+\/)?[^@/\s]+@\d[\w.+-]*$/.test(pkg) : null;
  }
  if (bin === "uvx") {
    const pkg = list.find((a) => !a.startsWith("-"));
    return pkg ? !/==\d/.test(pkg) : null;
  }
  if (bin === "docker" && list[0] === "run") {
    const img = list.slice(1).filter((a, i, l) => !a.startsWith("-") && !["-e", "--env", "-v", "--name"].includes(l[i - 1])).at(0);
    return img ? !(/@sha256:[0-9a-f]{64}$/.test(img) || /:[\w.-]+$/.test(img.split("/").pop()) && !/:latest$/.test(img)) : null;
  }
  return null;
}

const HERDR_RULES = [
  ["herdr-exec", /\bexec\s*\(/], ["herdr-hc", /\bhc\s*\(/], ["herdr-fetch", /\bfetch\s*\(/],
  ["herdr-write", /\bwriteTextFile\s*\(/], ["herdr-fs", /from\s+["'](?:node:)?fs(?:\/promises)?["']|require\(\s*["'](?:node:)?fs/],
  ["herdr-focus", /["'](?:layout\.select|layout\.switch|pane\.go|mod\.open|agent\.focus)["']/],
];

/** A herdr mod or layout's files ({ path, text }): what AGENTS.md says to tell before adding it.
 *  -> { flags, findings: [{ code, file, line }] } (5 findings per code at most). */
export function scanHerdr(files) {
  const findings = [];
  const flags = new Set();
  for (const f of files) {
    if (/(^|\/)keys\.json$/.test(f.path)) { flags.add("keys-json"); findings.push({ code: "keys-json", file: f.path, line: 1 }); }
    if (!/\.(m?js|ts)$/.test(f.path)) continue;
    String(f.text ?? "").split("\n").forEach((l, i) => {
      for (const [c, re] of HERDR_RULES) {
        if (!re.test(l)) continue;
        flags.add(c);
        if (findings.filter((x) => x.code === c).length < 5) findings.push({ code: c, file: f.path, line: i + 1 });
      }
    });
  }
  return { flags: [...flags], findings };
}

const SCRIPT = /\.(sh|bash|zsh|fish|py|rb|pl|js|mjs|cjs|ts|ps1|bat|exe|bin)$/i;

/** A skill's folder: { files: [{ path, exec, text? }], meta (its SKILL.md frontmatter) } -> flags. */
export function scanSkill(files, meta = {}) {
  const flags = [];
  if (files.some((f) => f.exec || SCRIPT.test(f.path) || /^#!/.test(f.text ?? ""))) flags.push("scripts");
  const tools = [meta["allowed-tools"]].flat().join(" ");
  if (/\bBash\b/.test(tools)) flags.push("bash-tool");
  if (meta.hooks) flags.push("skill-hooks");
  return flags;
}

/** A plugin's parts (kt-plugins' components()) and its servers' configs -> flags. */
export function pluginFlags(comps, servers = []) {
  const flags = [];
  if (comps?.hooks?.length) flags.push(`hooks:${comps.hooks.join(",")}`);
  if (comps?.mods?.length) flags.push("mods");
  if (comps?.mcp?.length) flags.push("plugin-mcp");
  if (comps?.lsp?.length) flags.push("plugin-lsp");
  if (servers.some((s) => unpinnedRun(s?.command, s?.args) === true)) flags.push("unpinned");
  return flags;
}

/** A repo's facts (GitHub's /repos answer) -> flags, `now` in ms. */
export function repoFlags(r, now = Date.now()) {
  if (!r) return ["license-unknown"];
  const flags = [];
  const lic = r.license?.spdx_id;
  if (!lic || lic === "NOASSERTION") flags.push("license-unknown");
  if (r.archived) flags.push("archived");
  if (r.pushed_at && now - Date.parse(r.pushed_at) > 365 * DAY) flags.push("stale");
  return flags;
}

/** The SKILL.md a skills.sh id names, among { path, name } (name: its frontmatter's): its name
 *  first, then its folder's name; the shallowest wins. -> path of its folder ("" for the root), or null. */
export function findSkill(candidates, skillId) {
  const depth = (p) => p.split("/").length;
  const dirOf = (p) => p.split("/").slice(0, -1).join("/");
  const ok = candidates.filter((c) => /(^|\/)SKILL\.md$/.test(c.path) && !/(^|\/)node_modules\//.test(c.path)).sort((a, b) => depth(a.path) - depth(b.path));
  const hit = ok.find((c) => c.name === skillId) ?? ok.find((c) => dirOf(c.path).split("/").pop() === skillId);
  return hit ? dirOf(hit.path) : null;
}

/** An aitmpl loop's recipe: its frontmatter fields and the first `/loop` command of its code blocks. */
export function loopRecipe(md, meta = {}) {
  const blocks = [...String(md ?? "").matchAll(/```[^\n]*\n([\s\S]*?)```/g)].map((m) => m[1].trim());
  const prompt = blocks.find((b) => /^\/loop\b/.test(b)) ?? null;
  return { interval: meta.interval ? clean(meta.interval, 40) : null, stop: meta["stop-condition"] ? clean(meta["stop-condition"], 300) : null,
    components: [meta.components].flat().filter(Boolean).map((c) => clean(c, 120)), prompt: prompt ? clean(prompt, 4000, { lines: true }) : null };
}

// ---------- what an install would run (shown; the routes run it) ----------

const shq = (s) => (/^[\w@%+=:,./~-]+$/.test(s) ? s : `'${String(s).replace(/'/g, "'\\''")}'`);

/** What kt-mcp's form gets for a variant (issue #70 lot 4): its method ("stdio" or "http") and the
 *  public values. A secret is never there: env and header NAMES only (the pairs' keys), every value
 *  empty, typed by the person in kt-mcp's masked fields. The command line splits back with kt-mcp's
 *  splitArgs() (model.check.mjs). null: nothing kt-mcp's forms take. */
export function mcpForm(name, v) {
  const c = v?.config;
  if (!c || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(name ?? "")) return null;
  if (c.type === "stdio") return { add: "stdio", prefill: { name, cmd: [c.command, ...c.args].map(shq).join(" "), env: Object.keys(c.env ?? {}), scope: "user" } };
  if (c.type === "http" || c.type === "sse") return { add: "http", prefill: { name, url: c.url, transport: c.type, headers: Object.keys(c.headers ?? {}), scope: "user" } };
  return null;
}

/** The route's command lines and the files it writes, for the detail. Codes and commands only. */
export function plan(it, extra = {}) {
  if (!it.route) return { route: null, why: it.why ?? "no-route", lines: [], writes: [] };
  if (it.type === "plugin") {
    const lines = [];
    if (extra.addMarket) lines.push(`claude plugin marketplace add ${extra.addMarket} --json`);
    lines.push(`claude plugin install ${it.name}@${it.market} --scope user --json`);
    // addMarket: kt-plugins' "marketplace" view comes first, filled with it (kt-market runs nothing).
    return { route: it.route, why: null, lines, writes: ["~/.claude/settings.json", "~/.claude/plugins/"], addMarket: extra.addMarket ?? null };
  }
  if (it.type === "mcp") {
    const f = mcpForm(it.name, extra.variant);
    if (!f) return { route: null, why: "no-variant", lines: [], writes: [] };
    // As kt-mcp's form will show it, the values to type as … (never a secret here).
    const p = f.prefill;
    const line = f.add === "stdio"
      ? ["claude mcp add", shq(p.name), "-s user", ...p.env.map((k) => `-e ${k}=…`), "--", p.cmd].join(" ")
      : ["claude mcp add --transport", p.transport, "-s user", shq(p.name), shq(p.url), ...p.headers.map((h) => `--header '${h}: …'`)].join(" ");
    return { route: it.route, why: null, lines: [line], writes: ["~/.claude.json"], form: f.add };
  }
  if (it.type === "skill") {
    if (extra.skillPath == null) return { route: null, why: "no-skill-md", lines: [], writes: [] };
    const name = extra.skillPath ? extra.skillPath.split("/").pop() : it.repo.name;
    const src = `${it.repo.owner}/${it.repo.name}${extra.skillPath ? `/${extra.skillPath}` : ""}`;
    return { route: it.route, why: null, src, lines: [`git clone --depth 1 https://github.com/${it.repo.owner}/${it.repo.name}.git <tmp>/repo`,
      `mv <tmp>/repo ~/.agents/skills/${name}`, `ln -s ~/.agents/skills/${name}${extra.skillPath ? `/${extra.skillPath}` : ""} ~/.claude/skills/${name}`],
      writes: [`~/.agents/skills/${name}`, `~/.claude/skills/${name}`] };
  }
  if (it.type === "herdr-mod") {
    const names = extra.mods ?? [];
    // i18n: tech
    return { route: it.route, why: null, lines: [`tab.new claude (AGENTS.md: ${it.repo.owner}/${it.repo.name}@${String(it.pin.value ?? "").slice(0, 12)})`],
      writes: names.map((n) => `~/.config/herdr-app/mods/${n}`) };
  }
  if (it.type === "loop") return { route: it.route, why: null, lines: extra.prompt ? [extra.prompt.split("\n")[0]] : [], writes: [] };
  return { route: null, why: "no-route", lines: [], writes: [] };
}

// ---------- search ----------

export const tokens = (q) => String(q ?? "").toLowerCase().split(/\s+/).filter(Boolean).slice(0, 8);

/** null when a token is missing; else a relevance score (the name counts most). */
export function score(it, toks, q = toks.join(" ")) {
  if (!toks.length) return 0;
  let s = 0;
  const name = it.name.toLowerCase(), title = it.title.toLowerCase();
  for (const t of toks) {
    if (!it.hay.includes(t)) return null;
    s += name === t ? 40 : name.startsWith(t) ? 25 : name.includes(t) ? 15 : title.includes(t) ? 8 : 1;
  }
  if (name === q || title === q) s += 100;
  return s;
}

/** The type filter: an item's own type, or the loop / automation tags. */
export const typeMatch = (it, types) => !types?.length || types.includes(it.type)
  || (types.includes("loop") && it.tags.includes("loop")) || (types.includes("automation") && it.tags.includes("automation"));

const ROW = (it) => ({
  id: it.id, type: it.type, source: it.source, name: it.name, title: it.title, description: clean(it.description, 220), author: it.author,
  market: it.market, repo: it.repo ? `${it.repo.owner}/${it.repo.name}` : null, pin: it.pin?.value ? String(it.pin.value).slice(0, 12) : null,
  pinKind: it.pin?.kind ?? "none", popularity: it.popularity, updatedAt: it.updatedAt, version: it.version, tags: it.tags.slice(0, 6),
  flags: it.flags, level: levelOf(it.flags), route: it.route, why: it.why, preview: it.preview,
});

/** Percentile of each item's popularity within its unit (0..1, -1 without one): a sort that never
 *  compares stars with installs. */
function percentiles(list) {
  const by = {};
  for (const it of list) if (it.popularity) (by[it.popularity.unit] ??= []).push(it.popularity.n);
  for (const u in by) by[u].sort((a, b) => a - b);
  const out = new Map();
  for (const it of list) {
    const arr = it.popularity ? by[it.popularity.unit] : null;
    if (!arr) { out.set(it, -1); continue; }
    let lo = 0, hi = arr.length;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (arr[mid] < it.popularity.n) lo = mid + 1; else hi = mid; }
    out.set(it, arr.length > 1 ? lo / (arr.length - 1) : 1);
  }
  return out;
}

/** The query: { q, types, sources, sort: "relevance" | "popular" | "recent", offset, limit ≤ 60 }
 *  -> { rows, total, counts: { byType, bySource } } (byType under the source filter, bySource under
 *  the type filter, both under the words). */
export function query(items, { q = "", types = [], sources = [], sort = "relevance", offset = 0, limit = 60 } = {}) {
  const toks = tokens(q);
  const base = [];
  const scores = new Map();
  for (const it of items) {
    const s = score(it, toks);
    if (s == null) continue;
    scores.set(it, s);
    base.push(it);
  }
  const inSource = (it) => !sources.length || sources.includes(it.source);
  const byType = Object.fromEntries(TYPES.map((t) => [t, 0]));
  const bySource = Object.fromEntries(SOURCES.map((s) => [s, 0]));
  for (const it of base) {
    if (inSource(it)) for (const t of TYPES) if (typeMatch(it, [t])) byType[t]++;
    if (typeMatch(it, types)) bySource[it.source]++;
  }
  const hits = base.filter((it) => inSource(it) && typeMatch(it, types));
  const pct = percentiles(hits);
  const time = (it) => (it.updatedAt ? Date.parse(it.updatedAt) : -Infinity);
  const by = {
    relevance: (a, b) => (toks.length ? scores.get(b) - scores.get(a) : 0) || pct.get(b) - pct.get(a),
    popular: (a, b) => pct.get(b) - pct.get(a) || (b.popularity?.n ?? -1) - (a.popularity?.n ?? -1),
    recent: (a, b) => time(b) - time(a),
  }[sort] ?? (() => 0);
  hits.sort((a, b) => by(a, b) || a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
  const lim = Math.max(1, Math.min(60, limit | 0 || 60));
  const off = Math.max(0, offset | 0);
  return { rows: hits.slice(off, off + lim).map(ROW), total: hits.length, counts: { byType, bySource } };
}

/** Items of several sources, one per id (the first wins). */
export function dedupe(lists) {
  const seen = new Set();
  const out = [];
  for (const it of lists.flat()) if (it && !seen.has(it.id)) { seen.add(it.id); out.push(it); }
  return out;
}

export const ROW_OF = ROW;
