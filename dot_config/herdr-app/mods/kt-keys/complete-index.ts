// bun mods/kt-keys/complete-index.ts [--root <git root>] [--jsonl <session.jsonl>] [--home <dir>] [--cache <dir>]
//
// What kt-chat's field completes (#81), read without starting anything, printed as ONE JSON line:
// { at, items, listing, tools, servers, session, errors, ms }.
// - items: the /commands on disk, as Claude Code lists them (kt-skills' roots and names): ~/.claude/skills
//   (not skills/me/**, whose cales under commands/me/ are the commands), the enabled plugins' skills and
//   commands, the project's .claude/{skills,commands}, ~/.claude/commands. Each: { name, description,
//   hint, source, path }. A file is read again only when its mtime moved (<cache>/disk.json).
// - listing, tools, servers: the session's own truth, from its transcript (--jsonl): the last
//   skill_listing (names and descriptions the model sees: plugins' and claude.ai's skills too) and the
//   deferred_tools_delta records folded in order (the MCP tools, `mcp__server__tool`, with their
//   description line; the servers come from those names). Read from the last offset on
//   (<cache>/session-<hash>.json); a shorter file (a /clear, a rewrite) starts again from 0. Never
//   deferred_tools_record (full schemas), never `claude mcp list` (it starts every server).
// Every description is third-party text: clean() (kt-market's: escapes, control and bidi out), 160 max,
// shown only, never sent. complete.js (pure) does the rest: kt-chat merges with categories.js' classify.
// Cross-imports, bun only (Herdr never loads this file): kt-skills' frontmatter parser and kt-market's
// clean(), one copy each; complete.check.mjs covers both through this script.
import { readdir, stat, realpath, readFile, mkdir, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import { nameOf, loads, argHint, listingOf, foldTools, serversOf } from "./complete.js";
import { frontmatter } from "../kt-skills/frontmatter.js";
import { clean } from "../kt-market/model.js";

const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const HOME = arg("--home") ?? homedir();
const CACHE = arg("--cache") ?? join(import.meta.dir, "../../data/kt-chat/complete");
const ROOT = arg("--root");
const JSONL = arg("--jsonl");
const SKIP = new Set(["node_modules", ".git", ".venv", "venv", "__pycache__", "dist", "build"]);
const errors = [];
const t0 = Date.now();

const readJson = async (p) => { try { return JSON.parse(await readFile(p, "utf8")); } catch { return null; } };
const writeJson = async (p, v) => { await mkdir(dirname(p), { recursive: true }); await writeFile(p, JSON.stringify(v)); };
const hash = (s) => { let h = 0x811c9dc5; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 0x01000193) >>> 0; return h.toString(16).padStart(8, "0"); };

// ---------- the disk ----------

// Files named `want` (SKILL.md) or ending .md (want null) under `dir`, links followed, each real
// folder once, 8 levels at most.
async function walk(dir, want, depth = 0, seen = new Set(), out = []) {
  let real;
  try { real = await realpath(dir); } catch { return out; }
  if (seen.has(real) || depth > 8) return out;
  seen.add(real);
  let entries;
  try { entries = await readdir(dir); } catch { return out; }
  for (const e of entries) {
    if (SKIP.has(e) || e.startsWith(".")) continue;
    const p = join(dir, e);
    let s;
    try { s = await stat(p); } catch { continue; }
    if (s.isDirectory()) await walk(p, want, depth + 1, seen, out);
    else if (want ? e === want : e.toLowerCase().endsWith(".md")) out.push({ path: p, mtime: s.mtimeMs });
  }
  return out;
}

// kt-skills' roots, in its dedupe order (~/.agents/skills aside: what Claude Code loads of it is linked
// into ~/.claude/skills).
async function roots() {
  const C = join(HOME, ".claude");
  const out = [{ dir: join(C, "skills"), kind: "skill", source: "personal" }];
  const [st, inst] = await Promise.all([readJson(join(C, "settings.json")), readJson(join(C, "plugins/installed_plugins.json"))]);
  if (!st) errors.push("settings");
  const installed = inst?.plugins ?? {};
  for (const [key, on] of Object.entries(st?.enabledPlugins ?? {})) {
    if (on !== true) continue;
    const plugin = key.split("@")[0];
    const all = installed[key] ?? [];
    const e = all.find((x) => x.scope === "user") ?? all.find((x) => x.projectPath === ROOT) ?? all[0];
    if (!e?.installPath) continue;
    out.push({ dir: join(e.installPath, "skills"), kind: "skill", source: "plugin", prefix: plugin });
    out.push({ dir: join(e.installPath, "commands"), kind: "command", source: "plugin", prefix: plugin });
  }
  if (ROOT && ROOT !== HOME) {
    out.push({ dir: join(ROOT, ".claude/skills"), kind: "skill", source: "project" });
    out.push({ dir: join(ROOT, ".claude/commands"), kind: "command", source: "project" });
  }
  out.push({ dir: join(C, "commands"), kind: "command", source: "personal" });
  return out;
}

async function disk() {
  const cacheFile = join(CACHE, "disk.json");
  const cache = (await readJson(cacheFile)) ?? {};
  const next = {};
  const items = [];
  const reals = new Set();
  for (const r of await roots()) {
    const files = await walk(r.dir, r.kind === "skill" ? "SKILL.md" : null);
    // A SKILL.md inside another skill's folder (a bundled venv's) isn't a skill.
    const dirs = new Set(files.map((f) => dirname(f.path)));
    for (const f of files) {
      const rel = f.path.slice(r.dir.length + 1);
      if (r.kind === "skill") {
        let nested = false;
        for (let d = dirname(dirname(f.path)); d.length > r.dir.length; d = dirname(d)) if (dirs.has(d)) { nested = true; break; }
        if (nested) continue;
      }
      let real;
      try { real = await realpath(f.path); } catch { continue; }
      if (reals.has(real)) continue; // the same file seen through a link
      reals.add(real);
      const key = `${f.path}\t${real}`;
      let entry = cache[key]?.mtime === f.mtime ? cache[key] : null;
      if (!entry) {
        const { meta, body } = frontmatter(await readFile(f.path, "utf8").catch(() => ""));
        const ok = loads({ kind: r.kind, rel, source: r.source, meta });
        const first = String(body).split("\n").map((l) => l.trim()).find((l) => l && !l.startsWith("#")) ?? "";
        entry = { mtime: f.mtime, item: ok ? {
          name: nameOf({ kind: r.kind, rel, prefix: r.prefix, source: r.source }),
          description: clean(typeof meta.description === "string" ? meta.description : first, 160),
          hint: argHint({ meta, body }), source: r.source, path: f.path,
        } : null };
      }
      next[key] = entry;
      if (entry.item) items.push(entry.item);
    }
  }
  await writeJson(cacheFile, next).catch(() => errors.push("cache"));
  return items;
}

// ---------- the session ----------

const MARKS = ['"attachment":{"type":"skill_listing"', '"attachment":{"type":"deferred_tools_delta"'];
const CHUNK = 16 << 20;

async function session(path) {
  const cacheFile = join(CACHE, `session-${hash(path)}.json`);
  let size;
  try { size = (await stat(path)).size; } catch { errors.push("session"); return null; }
  let c = await readJson(cacheFile);
  if (c?.path !== path || !(c.offset <= size)) c = { path, offset: 0, listing: [], tools: { names: [], lines: {} } };
  const file = Bun.file(path);
  let pos = c.offset;
  while (pos < size) {
    const buf = Buffer.from(await file.slice(pos, Math.min(size, pos + CHUNK)).arrayBuffer());
    const last = buf.lastIndexOf(10);
    if (last < 0) {
      if (buf.length < CHUNK) break; // a line still being written: the next call reads it
      pos += buf.length; // one line longer than a chunk: none of ours (they're small), skipped
      continue;
    }
    const hits = [];
    for (const m of MARKS) for (let i = buf.indexOf(m); i >= 0 && i < last; i = buf.indexOf(m, i + 1)) hits.push(i);
    hits.sort((a, b) => a - b);
    let done = -1;
    for (const h of hits) {
      if (h < done) continue;
      const from = buf.lastIndexOf(10, h) + 1;
      const to = buf.indexOf(10, h);
      done = to;
      let o;
      try { o = JSON.parse(buf.toString("utf8", from, to)); } catch { continue; }
      if (o?.type !== "attachment") continue; // the marks quoted inside some other text
      const a = o.attachment;
      if (a?.type === "skill_listing") c.listing = listingOf(a).map((x) => ({ name: x.name, description: clean(x.description, 160) }));
      else if (a?.type === "deferred_tools_delta") c.tools = foldTools(c.tools, a);
    }
    pos += last + 1;
  }
  c.offset = pos;
  for (const n of Object.keys(c.tools.lines)) c.tools.lines[n] = clean(c.tools.lines[n], 160);
  await writeJson(cacheFile, c).catch(() => errors.push("cache"));
  return { ...c, size };
}

const [items, s] = await Promise.all([disk(), JSONL ? session(JSONL) : null]);
console.log(JSON.stringify({
  at: new Date().toISOString(),
  items,
  listing: s?.listing ?? [],
  tools: (s?.tools.names ?? []).sort().map((name) => ({ name, description: s.tools.lines[name] ?? "" })),
  servers: serversOf(s?.tools.names ?? []),
  session: s ? { path: s.path, offset: s.offset, size: s.size } : null,
  errors,
  ms: Date.now() - t0,
}));
