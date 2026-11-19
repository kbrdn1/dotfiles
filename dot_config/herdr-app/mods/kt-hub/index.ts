// kt-hub's indexer (#44): the agents' activity, day by day, kept in data/kt-hub/archive.json.
//
// An ARCHIVE, not a cache: Claude Code deletes its transcripts (cleanupPeriodDays, 30 days by default),
// a day counted here is never counted again from the source. So:
// - each transcript is read from where the last pass stopped (its byte offset), complete lines only;
// - the offsets and the counts are ONE file (archive.json), written atomically (tmp + rename) after a
//   pass and every few seconds during it: a killed pass resumes where its last checkpoint was, without
//   counting anything twice or losing it;
// - a file shorter than its offset (rewritten) is read again from 0, counting only its records later
//   than the last one counted;
// - a day keeps its session ids for OPEN_DAYS, so a session is counted once a day, then freezes to counts;
// - counts are kept by origin (cli / mono: Monocode / sdk), never as decisions: the hub filters later.
// Nothing of a prompt's text is kept: counts, names of skills and agent types, PR urls, flows.
//
// Run: ~/.nix-profile/bin/bun mods/kt-hub/index.ts  ->  one JSON line on stdout ({ ok, ms, files, read }).
// Its check: bun mods/kt-hub/index.check.mjs (fixtures in a tmp dir, TZ fixed).
import { readdirSync, statSync, openSync, readSync, closeSync, readFileSync, writeFileSync, renameSync, mkdirSync, existsSync, unlinkSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { basename, dirname, join } from "node:path";

export const V = 1;
export const GAP = 5 * 60e3; // active time: gaps under 5 min between two records of one transcript
export const OPEN_DAYS = 7; // a day keeps its session ids this long after it ends, then freezes
export const KEEP_DAYS = 84; // summary.json: 12 weeks of days, for the week cards and their trends
const CHUNK = 8 << 20;
const SAVE_MS = 5000;
const LOCK_MS = 10 * 60e3;

export function localDay(ms: number) {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function dayShift(day: string, n: number) {
  const [y, m, d] = day.split("-").map(Number);
  return localDay(new Date(y, m - 1, d + n, 12).getTime());
}

// ---------------------------------------------------------------- what a record says

export function userText(o: any): string {
  const c = o?.message?.content;
  if (typeof c === "string") return c;
  if (!Array.isArray(c)) return "";
  let s = "";
  for (const b of c) if (b?.type === "text" && typeof b.text === "string") s += b.text;
  return s;
}

// What Kylian sends: typed, queued, an accepted suggestion, or an SDK client's (Monocode, scripts).
const HUMAN = new Set(["typed", "queued", "suggestion_accepted", "sdk"]);
// Without promptSource (older Claude Code): everything wrapped is the harness's, except Monocode's.
const WRAPPED = /^(<(?!monocode_context>)|Another Claude session sent a message|This session is being continued|\[Image)/;
// What history.jsonl and commands carry that is nobody's work: CodexBar's probes, mostly.
export const NOISE = /^\/(usage|status|rate-limit-options|exit)\b/;

/** A main transcript's user record: a slash command, a prompt, or nothing (tool results, harness). */
export function classifyUser(o: any): { cmd?: string; prompt?: true; text: string } | null {
  if (o.isMeta || o.isSidechain) return null;
  const text = userText(o);
  const m = /<command-name>\/?([^<]+)<\/command-name>/.exec(text);
  if (m) return { cmd: m[1].trim(), text };
  if (/^<hc from=/.test(text)) return null; // another agent's `hc send`, typed into the terminal
  const src = o.promptSource;
  if (src ? HUMAN.has(src) : text && !WRAPPED.test(text)) return { prompt: true, text };
  return null;
}

/** Where a session comes from: the CLI (Herdr's terminals), Monocode (SDK, its context or command
 * wrapper first), or another SDK client (Monocode's orchestra workers, scripts, probes). */
export function originOf(entrypoint: string | undefined, text: string) {
  if (entrypoint === "sdk-cli") return /^<(monocode_context|command-message)>/.test(text) ? "mono" : "sdk";
  return "cli";
}

/** owner/name from a remote url (https or ssh) or a PR url. */
export function slugOf(url: string) {
  const m = /github\.com[:/]+([^/\s]+)\/([^/\s]+?)(?:\.git)?(?:\/pull\/\d+.*)?\/?$/.exec(String(url ?? "").trim());
  return m ? `${m[1]}/${m[2]}` : null;
}

// ---------------------------------------------------------------- buckets

type Count = Record<string, number>;
export type Bucket = { s: Count; p: Count; m: number; o: number; a: number; mo: Count; sub: Count; l: Count; pr: number; mg: number; ids?: Record<string, 1> };
export const bucket = (): Bucket => ({ s: {}, p: {}, m: 0, o: 0, a: 0, mo: {}, sub: {}, l: {}, pr: 0, mg: 0, ids: {} });
const inc = (r: Count, k: string, n = 1) => (r[k] = (r[k] ?? 0) + n);
const at = (map: Record<string, Bucket>, day: string) => (map[day] ??= bucket());

// A session once per bucket; a frozen bucket (no ids) takes no late session, it was counted before.
function session(b: Bucket, sid: string, origin: string) {
  if (!b.ids || !sid || b.ids[sid]) return;
  b.ids[sid] = 1;
  inc(b.s, origin);
}

// A file's buffer bucket into the archive's: sums, maps, and its sessions (sid -> origin) once.
function merge(into: Bucket, b: Bucket & { sess?: Record<string, string> }) {
  for (const k of ["m", "o", "a", "pr", "mg"] as const) into[k] += b[k];
  for (const k of ["p", "mo", "sub", "l"] as const) for (const [n, v] of Object.entries(b[k])) inc(into[k], n, v);
  for (const [sid, origin] of Object.entries(b.sess ?? {})) session(into, sid, origin);
}

// ---------------------------------------------------------------- attribution

type Reg = { folder: string; name: string }[];
type Resolved = { root: string; slug: string | null } | 0;

export function registryOf(shared: any): Reg {
  const list = Array.isArray(shared?.["kt.projects"]) ? shared["kt.projects"] : [];
  return list.filter((p: any) => !p?.machine && typeof p?.folder === "string").map((p: any) => ({ folder: p.folder.replace(/\/+$/, ""), name: String(p.name ?? basename(p.folder)) }));
}

/** The registry folder holding `path`, cut on a path boundary, the longest winning. */
export function regMatch(path: string, reg: Reg) {
  let best: string | null = null;
  for (const { folder } of reg) if ((path === folder || path.startsWith(folder + "/")) && (!best || folder.length > best.length)) best = folder;
  return best;
}

function sh(cmd: string, args: string[]) {
  const r = spawnSync(cmd, args, { encoding: "utf8", timeout: 10e3 });
  return r.status === 0 ? r.stdout.trim() : null;
}

/** The repo a folder belongs to (a worktree climbs to its main checkout), with its GitHub slug. */
export function gitRoot(cwd: string): Resolved {
  if (!existsSync(cwd)) return 0;
  const common = sh("git", ["-C", cwd, "rev-parse", "--path-format=absolute", "--git-common-dir"]);
  if (!common) return 0;
  const root = common.endsWith("/.git") ? dirname(common) : common;
  return { root, slug: slugOf(sh("git", ["-C", root, "config", "--get", "remote.origin.url"]) ?? "") };
}

/** A folder chezmoi manages (`chezmoi source-path` succeeds on it or a parent below home). */
export function chezmoiManaged(cwd: string, home: string, cache: Map<string, boolean>) {
  for (let p = cwd; p.startsWith(home + "/"); p = dirname(p)) {
    let hit = cache.get(p);
    if (hit == null) cache.set(p, (hit = sh("chezmoi", ["source-path", p]) != null));
    if (hit) return true;
  }
  return false;
}

export type Ctx = {
  home: string;
  reg: Reg;
  scratch?: RegExp; // throwaway folders (tests, scratchpads): not projects
  cwds: Record<string, Resolved>; // the archive's: git and chezmoi asked once per folder, ever
  resolve: (cwd: string) => Resolved;
  projects: Record<string, Project>;
};
export type Project = { name: string; kind: "registry" | "repo" | "home" | "gh" | "other"; slug?: string | null; last: number; days: Record<string, Bucket> };

const TMP = /^\/(private\/)?(tmp|var\/folders)\//;

/**
 * A record's project, from its cwd, in order: the registry (kt.projects, which holds ~/.claude, not a
 * repo), Home, a scratch folder (other), the git repo (a worktree to its main checkout), chezmoi (the
 * dotfiles repo, ~/.config/herdr-app isn't one), a worktree path's repo name (`worktrees/<repo>/`, for
 * deleted ones), the session's pr-link repository. A repo found but not in the registry keeps its name.
 */
export function attribute(cwd: string, prRepo: string | null, ctx: Ctx): string {
  if (!cwd) return note(ctx, "other", "other", "other");
  const reg = regMatch(cwd, ctx.reg);
  if (reg) {
    // Its slug, for its PRs: only when the folder is the repo itself (~/.claude resolves to dotfiles).
    const r = (ctx.cwds[reg] ??= ctx.resolve(reg));
    return note(ctx, reg, "registry", ctx.reg.find((p) => p.folder === reg)!.name, r && r.root === reg ? r.slug : null);
  }
  if (cwd === ctx.home) return note(ctx, ctx.home, "home", "Home");
  if ((ctx.scratch ?? TMP).test(cwd)) return note(ctx, "other", "other", "other");
  let r = ctx.cwds[cwd];
  if (r === undefined) r = ctx.cwds[cwd] = ctx.resolve(cwd);
  // A repo's name: GitHub's (the chezmoi source folder is kbrdn1/dotfiles), else its folder's.
  if (r) return regMatch(r.root, ctx.reg) ? attribute(r.root, null, ctx) : note(ctx, r.root, "repo", r.slug?.split("/")[1] ?? basename(r.root), r.slug);
  const byName = byFolderName(cwd, ctx);
  if (byName) return attribute(byName, null, ctx);
  if (prRepo) return bySlug(prRepo, ctx);
  return note(ctx, "other", "other", "other");
}

/** A folder that is no repo (most often a deleted worktree, or a repo since moved): the deepest of its
 * names that is a registry folder's or a known repo's, `-worktrees` dropped (`x-worktrees/feat-1`,
 * `worktrees/x/feat-1`, `~/Projects/x` moved to `~/Projects/Perso/x`). */
function byFolderName(cwd: string, ctx: Ctx) {
  const names = new Map<string, string>();
  for (const k of Object.keys(ctx.projects)) if (ctx.projects[k].kind === "repo") names.set(basename(k), k);
  for (const p of ctx.reg) names.set(basename(p.folder), p.folder);
  const parts = (cwd.startsWith(ctx.home + "/") ? cwd.slice(ctx.home.length) : cwd).split("/").filter(Boolean).reverse();
  for (const part of parts) {
    const hit = names.get(part) ?? names.get(part.replace(/-worktrees$/, ""));
    if (hit) return hit;
  }
  return null;
}

/** The registry's folders and the folders history.jsonl names, known before any transcript: a deleted
 * worktree or a pr-link then finds its repo whatever the order the files are read in. */
export function seed(ctx: Ctx, history: string | null) {
  for (const p of ctx.reg) attribute(p.folder, null, ctx);
  if (!history || !existsSync(history)) return;
  const folders = new Set<string>();
  readLines(history, 0, statSync(history).size, (line) => {
    const m = /"project":"((?:[^"\\]|\\.)*)"/.exec(line);
    if (m) folders.add(JSON.parse(`"${m[1]}"`));
  });
  for (const f of folders) if (existsSync(f)) attribute(f, null, ctx);
}

function bySlug(slug: string, ctx: Ctx) {
  const known = Object.keys(ctx.projects).find((k) => ctx.projects[k].slug === slug);
  return known ?? note(ctx, `gh:${slug}`, "gh", slug, slug);
}

function note(ctx: Ctx, key: string, kind: Project["kind"], name: string, slug?: string | null) {
  const p = (ctx.projects[key] ??= { name, kind, slug: slug ?? null, last: 0, days: {} });
  p.name = name;
  if (slug) p.slug = slug;
  return key;
}

// ---------------------------------------------------------------- reading

type FileState = { s: number; t: number; off: number; key?: string; ts?: number; cwd?: string; origin?: string; cmd?: string | null; pr?: string | null };

export function listTranscripts(root: string) {
  const out: { path: string; sub: boolean }[] = [];
  let dirs: string[] = [];
  try { dirs = readdirSync(root); } catch { return out; }
  for (const d of dirs) {
    const dir = join(root, d);
    let names: string[];
    try { names = readdirSync(dir); } catch { continue; }
    for (const n of names) {
      if (n.endsWith(".jsonl")) out.push({ path: join(dir, n), sub: false });
      else if (!n.includes(".")) {
        try { for (const g of readdirSync(join(dir, n, "subagents"))) if (g.endsWith(".jsonl")) out.push({ path: join(dir, n, "subagents", g), sub: true }); } catch {}
      }
    }
  }
  return out;
}

/** Complete lines from `off` to `end` (bytes), by chunks; returns where the last complete line ends. */
export function readLines(path: string, off: number, end: number, each: (line: string) => void) {
  const fd = openSync(path, "r");
  const buf = Buffer.allocUnsafe(CHUNK);
  let pos = off, pending = Buffer.alloc(0);
  try {
    while (pos < end) {
      const n = readSync(fd, buf, 0, Math.min(CHUNK, end - pos), pos);
      if (n <= 0) break;
      pos += n;
      // Cut on the last newline BYTE: a chunk can end inside a character, never inside a line we decode.
      const cut = buf.subarray(0, n).lastIndexOf(10);
      if (cut < 0) { pending = Buffer.concat([pending, buf.subarray(0, n)]); continue; }
      const text = (pending.length ? Buffer.concat([pending, buf.subarray(0, cut)]) : buf.subarray(0, cut)).toString("utf8");
      for (const line of text.split("\n")) if (line) each(line);
      pending = Buffer.from(buf.subarray(cut + 1, n));
    }
  } finally { closeSync(fd); }
  // The unfinished line is read again next pass.
  return pos - pending.length;
}

const MERGE = /\bgh\s+pr\s+merge\b/;

/** One transcript's new lines into the archive. */
export function indexFile(path: string, sub: boolean, st: FileState, size: number, A: Archive, ctx: Ctx) {
  let guard = 0;
  if (size < st.off) { guard = st.ts ?? 0; st.off = 0; } // rewritten: only what follows the last record counted
  // cwd -> its days' buckets and its last record, attributed at the end (a pr-link later in the file helps)
  const buf = new Map<string, { last: number; days: Record<string, Bucket & { sess?: Record<string, string> }> }>();
  const box = (cwd: string, day: string, ts: number) => {
    let m = buf.get(cwd);
    if (!m) buf.set(cwd, (m = { last: 0, days: {} }));
    m.last = Math.max(m.last, ts);
    return (m.days[day] ??= Object.assign(bucket(), { ids: undefined, sess: {} }));
  };
  st.off = readLines(path, st.off, size, (line) => {
    if (line.startsWith('{"type":"')) {
      if (!line.startsWith('{"type":"pr-link"')) return; // metadata: api requests, modes, owners, titles...
      let o: any;
      try { o = JSON.parse(line); } catch { return; }
      const ts = Date.parse(o.timestamp);
      if (!o.prUrl || !ts || ts <= guard) return;
      const repo = o.prRepository ?? slugOf(o.prUrl);
      if (repo) st.pr = repo;
      // A PR once, on the day it is first linked; its project is found from its repo in summarize.
      if (!A.prs[o.prUrl]) {
        const day = localDay(ts);
        A.prs[o.prUrl] = { d: day, r: repo, n: o.prNumber ?? null };
        at(A.days, day).pr++;
      }
      return;
    }
    if (!line.startsWith('{"parentUuid"')) return;
    if (line.includes('"type":"tool_result"')) return; // the weight: a tool's output, never a prompt
    const att = line.indexOf('"attachment":{');
    if (att > 0 && att < 120) return;
    let o: any;
    try { o = JSON.parse(line); } catch { return; }
    if (o.type !== "user" && o.type !== "assistant") return;
    const ts = Date.parse(o.timestamp);
    if (!ts || ts <= guard) return;
    const day = localDay(ts);
    if (!A.first || day < A.first) A.first = day;
    const cwd = (st.cwd = o.cwd ?? st.cwd ?? "");
    const b = box(cwd, day, ts);
    if (st.ts && ts > st.ts && ts - st.ts <= GAP) b.a += ts - st.ts;
    if (ts > (st.ts ?? 0)) st.ts = ts;
    const sid = o.sessionId;
    if (o.type === "assistant") {
      const msg = o.message ?? {};
      const key = `${msg.id}|${o.requestId}`;
      // One record per content block, each with the message's usage: count the message once.
      if (key !== st.key) {
        st.key = key;
        b.m++;
        b.o += msg.usage?.output_tokens ?? 0;
        if (msg.model && !String(msg.model).startsWith("<")) inc(b.mo, msg.model);
      }
      if (!sub) b.sess![sid] = st.origin ?? (o.entrypoint === "sdk-cli" ? "sdk" : "cli");
      for (const c of Array.isArray(msg.content) ? msg.content : []) {
        if (c?.type !== "tool_use") continue;
        const input = c.input ?? {};
        if (c.name === "Skill" && input.skill) {
          // A typed /command already counted its skill: its Skill call in the same turn is the same launch.
          if (st.cmd === input.skill) st.cmd = null;
          else inc(b.l, String(input.skill));
        } else if (c.name === "Agent" || c.name === "Task") inc(b.sub, String(input.subagent_type || "general-purpose"));
        else if (c.name === "Bash" && MERGE.test(String(input.command ?? ""))) b.mg++;
      }
    } else if (!sub) {
      const u = classifyUser(o);
      if (!u) return;
      st.origin ??= originOf(o.entrypoint, u.text);
      if (u.cmd) {
        if (NOISE.test(`/${u.cmd}`)) return;
        inc(b.l, u.cmd);
        st.cmd = u.cmd;
      } else {
        inc(b.p, st.origin);
        st.cmd = null;
        b.sess![sid] = st.origin;
      }
    }
  });
  // The file's buckets into the archive, attributed once per folder.
  for (const [cwd, { last, days }] of buf) {
    const proj = ctx.projects[attribute(cwd, st.pr ?? null, ctx)];
    proj.last = Math.max(proj.last, last);
    for (const [day, b] of Object.entries(days)) {
      merge(at(A.days, day), b);
      merge(at(proj.days, day), b);
    }
  }
}

/** history.jsonl before the junction (the transcripts are complete from it on): the sessions the surviving
 * transcripts don't have, with their prompts and launches, per day and project, without the probes'
 * /usage and /status. Read once, at the first pass, before the days freeze (their ids say who's there). */
export function indexHistory(file: string, A: Archive, ctx: Ctx) {
  if (!existsSync(file)) return;
  const sessions = new Map<string, { day: string; key: string; sid: string; p: number; l: Count }>();
  readLines(file, 0, statSync(file).size, (line) => {
    let o: any;
    try { o = JSON.parse(line); } catch { return; }
    const ts = Number(o.timestamp);
    const display = String(o.display ?? "").trim();
    if (!ts || !display || NOISE.test(display)) return;
    const day = localDay(ts);
    if (day >= A.junction!) return;
    const project = String(o.project ?? "");
    // Early entries have no sessionId: one session per folder and day.
    const sid = o.sessionId ?? `h:${project}`;
    const id = `${day}|${sid}`;
    let s = sessions.get(id);
    if (!s) sessions.set(id, (s = { day, key: attribute(project, null, ctx), sid, p: 0, l: {} }));
    if (display.startsWith("/")) inc(s.l, display.slice(1).split(/\s/)[0]);
    else s.p++;
  });
  for (const s of sessions.values()) {
    if (A.days[s.day]?.ids?.[s.sid]) continue; // its transcript survived: counted already, fully
    const b = Object.assign(bucket(), { sess: { [s.sid]: "hist" }, p: s.p ? { hist: s.p } : {}, l: s.l, ids: undefined });
    merge(at(A.days, s.day), b);
    merge(at(ctx.projects[s.key].days, s.day), b);
    ctx.projects[s.key].last = Math.max(ctx.projects[s.key].last, new Date(`${s.day}T12:00:00`).getTime());
  }
}

/** claude-flow's store keeps 20 flows: each pass copies them in, and notes when a step turns done. */
export function archiveFlows(dir: string, A: Archive, now: number) {
  let names: string[] = [];
  try { names = readdirSync(dir).filter((n) => /^me_.*\.json$/.test(n)); } catch { return; }
  for (const n of names) {
    let store: any;
    try { store = JSON.parse(readFileSync(join(dir, n), "utf8")); } catch { continue; }
    for (const [k, v] of Object.entries<any>(store ?? {})) {
      if (!k.startsWith("flow:") || !v || typeof v !== "object") continue;
      const prev = A.flows[k];
      const doneAt: Count = { ...(prev?.doneAt ?? {}) };
      for (const [step, s] of Object.entries<any>(v.steps ?? {})) {
        // Done when first seen: 0, before the archive knew it.
        if (s?.status === "done" && doneAt[step] == null) doneAt[step] = prev ? now : 0;
      }
      A.flows[k] = { ...v, first: prev?.first ?? now, seen: now, doneAt };
    }
  }
}

// ---------------------------------------------------------------- the archive

export type Archive = {
  v: number;
  first: string | null; // the first day any source knows
  junction: string | null; // the transcripts are complete from this day on; history.jsonl fills before it
  historyDone: boolean;
  files: Record<string, FileState>;
  cwds: Record<string, Resolved>;
  days: Record<string, Bucket>;
  projects: Record<string, Project>;
  prs: Record<string, { d: string; r: string | null; n: number | null }>;
  flows: Record<string, any>;
  reports?: Record<string, { t: number; r: ReturnType<typeof recap> }>; // ~/Reports' branch facts (not archived: they stay)
  pass?: { at: number; ms: number; files: number; read: number };
};
const empty = (): Archive => ({ v: V, first: null, junction: null, historyDone: false, files: {}, cwds: {}, days: {}, projects: {}, prs: {}, flows: {} });

export function loadArchive(file: string): Archive {
  if (!existsSync(file)) return empty();
  // A broken archive stops the pass: starting over would lose every day the transcripts no longer hold.
  const a = JSON.parse(readFileSync(file, "utf8"));
  if (a?.v !== V) throw new Error(`archive v${a?.v}, expected v${V}`);
  return a;
}

function writeAtomic(file: string, text: string) {
  const tmp = `${file}.tmp-${process.pid}`;
  writeFileSync(tmp, text);
  renameSync(tmp, file);
}

/** Days ended more than OPEN_DAYS ago forget their session ids: their counts are final. */
export function freeze(A: Archive, today: string) {
  const limit = dayShift(today, -OPEN_DAYS);
  const close = (days: Record<string, Bucket>) => { for (const [d, b] of Object.entries(days)) if (d < limit) delete b.ids; };
  close(A.days);
  for (const p of Object.values(A.projects)) close(p.days);
}

const total = (c: Count) => Object.values(c ?? {}).reduce((s, v) => s + v, 0);
const strip = ({ ids, ...b }: Bucket) => b;

// A day's year and its index from January 1st.
function yearIndex(d: string): [number, number] {
  const [y, m, dd] = d.split("-").map(Number);
  return [y, Math.round((new Date(y, m - 1, dd, 12).getTime() - new Date(y, 0, 1, 12).getTime()) / 864e5)];
}

/** What the page draws, ready (< 100 KB): the last KEEP_DAYS days, each year's sessions per day for the
 * heatmap, the projects' days ([sessions, active s, prompts, PRs, launches?]) and their sessions per day
 * of every year (`heat`, [index, sessions] pairs: a project's heatmap), the reports' recaps and the flows
 * (#49), the streak, the pass. */
export function summarize(A: Archive, now: number) {
  const today = localDay(now);
  const from = dayShift(today, -KEEP_DAYS);
  const days = Object.fromEntries(Object.entries(A.days).filter(([d]) => d >= from).sort().map(([d, b]) => [d, strip(b)]));
  const years: Record<string, number[]> = {};
  for (const [d, b] of Object.entries(A.days)) {
    const [y, i] = yearIndex(d);
    (years[y] ??= Array(new Date(y, 1, 29).getDate() === 29 ? 366 : 365).fill(0))[i] = total(b.s);
  }
  // The streak: active days in a row, up to today (or yesterday, today not begun), and the best.
  let cur = 0, best = 0, run = 0, prev: string | null = null;
  for (const d of Object.keys(A.days).filter((d) => total(A.days[d].s) > 0).sort()) {
    run = prev && dayShift(prev, 1) === d ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  if (prev === today || prev === dayShift(today, -1)) cur = run;
  // A project's days: [sessions, active s, prompts, PRs]. Its PRs come from their repo (the pr-links), and
  // a gh:<slug> project (found by a pr-link only) joins the project that has that slug since.
  const owner: Record<string, string> = {};
  for (const [k, p] of Object.entries(A.projects)) if (p.slug && p.kind !== "gh") owner[p.slug] ??= k;
  type Row = { name: string; kind: string; slug: string | null; last: number; days: Record<string, any[]>; heat: Record<string, Map<number, number>> };
  const projects: Record<string, Row> = {};
  const row = (k: string) => {
    const into = owner[A.projects[k]?.slug ?? ""] ?? k;
    const p = A.projects[into] ?? { name: k, kind: "gh", slug: k.slice(3), last: 0 };
    return (projects[into] ??= { name: p.name, kind: p.kind, slug: p.slug ?? null, last: p.last, days: {}, heat: {} });
  };
  for (const [k, p] of Object.entries(A.projects)) {
    const r = row(k);
    r.last = Math.max(r.last, p.last);
    for (const [d, b] of Object.entries(p.days)) {
      const s = total(b.s);
      if (s) {
        const [y, i] = yearIndex(d);
        const h = (r.heat[y] ??= new Map());
        h.set(i, (h.get(i) ?? 0) + s);
      }
      if (d < from) continue;
      const v = (r.days[d] ??= [0, 0, 0, 0]);
      v[0] += s; v[1] += Math.round(b.a / 1000); v[2] += total(b.p);
      for (const [n, c] of Object.entries(b.l ?? {})) (v[4] ??= {})[n] = (v[4][n] ?? 0) + c;
    }
  }
  for (const pr of Object.values(A.prs)) {
    if (pr.d < from || !pr.r) continue;
    const k = owner[pr.r] ?? (A.projects[`gh:${pr.r}`] ? `gh:${pr.r}` : null);
    if (k) (row(k).days[pr.d] ??= [0, 0, 0, 0])[3]++;
  }
  const out: Record<string, any> = {};
  for (const [k, p] of Object.entries(projects)) {
    if (!Object.keys(p.days).length && !Object.keys(p.heat).length) continue;
    out[k] = { ...p, days: Object.fromEntries(Object.entries(p.days).sort()),
      heat: Object.fromEntries(Object.entries(p.heat).map(([y, h]) => [y, [...h].sort((a, b) => a[0] - b[0])])) };
  }
  const reports = Object.values(A.reports ?? {}).map((x) => x.r).filter((r) => r && r.at >= new Date(`${from}T00:00:00`).getTime()).sort((a, b) => b.at - a.at);
  const flows = Object.entries(A.flows ?? {}).map(([key, f]) => ({ key, workflow: f.workflow ?? null, repo: f.repo ?? null, issue: f.issue ?? null, pr: f.pr ?? null,
    steps: Object.fromEntries(Object.entries<any>(f.steps ?? {}).map(([s, v]) => [s, v?.status ?? null])), doneAt: f.doneAt ?? {},
    review: f.review?.iteration ?? 0, ci: f.ci?.iteration ?? 0, first: f.first, seen: f.seen }));
  return { v: V, at: now, today, first: A.first, junction: A.junction, pass: A.pass ?? null, streak: { cur, best }, days, years, projects: out, reports, flows };
}

/** A branch report's facts.json (me:report) as the hub tells it: its PR, its CI now, its review (passes,
 * blocking findings P0 to P2 and how many were fixed), its lines. null when it isn't one. */
export function recap(o: any) {
  const f = o?.facts;
  if (!f || o?.kind !== "report" || !f.repo) return null;
  const passes = Array.isArray(f.review?.passes) ? f.review.passes : [];
  const blocking = (Array.isArray(f.review?.findings) ? f.review.findings : []).filter((x: any) => /^P[0-2]$/.test(x?.prio ?? ""));
  const last = passes.at(-1);
  return {
    repo: f.repo, branch: f.branch ?? null, issue: f.issue ?? null, at: Date.parse(o.generatedAt) || 0,
    pr: f.pr ? { n: f.pr.number ?? null, title: f.pr.title ?? "", state: f.pr.state ?? null, url: f.pr.url ?? null, draft: Boolean(f.pr.isDraft) } : null,
    ci: f.ci ? { ok: f.ci.ok ?? 0, fail: f.ci.fail ?? 0, pending: f.ci.pending ?? 0, total: f.ci.total ?? 0 } : null,
    review: passes.length ? { passes: passes.length, found: blocking.length, fixed: blocking.filter((x: any) => x.status === "fixed").length,
      open: last ? (last.p0 ?? 0) + (last.p1 ?? 0) + (last.p2 ?? 0) : 0 } : null,
    lines: f.totals ? [f.totals.add ?? 0, f.totals.del ?? 0] : null,
  };
}

/** ~/Reports/<repo>/<branch>/facts.json: read again when their mtime moved (they stay on disk: no archive,
 * a deleted one goes). */
export function readReports(dir: string, A: Archive) {
  const seen = new Set<string>();
  A.reports ??= {};
  let repos: string[] = [];
  try { repos = readdirSync(dir); } catch { return; }
  for (const r of repos) {
    let branches: string[] = [];
    try { branches = readdirSync(join(dir, r)); } catch { continue; }
    for (const b of branches) {
      if (b === "plans") continue;
      const file = join(dir, r, b, "facts.json");
      let t: number;
      try { t = statSync(file).mtimeMs; } catch { continue; }
      seen.add(file);
      if (A.reports[file]?.t === t) continue;
      let o: any = null;
      try { o = JSON.parse(readFileSync(file, "utf8")); } catch {}
      A.reports[file] = { t, r: recap(o) };
    }
  }
  for (const f of Object.keys(A.reports)) if (!seen.has(f)) delete A.reports[f];
}

// ---------------------------------------------------------------- the pass

export type Cfg = { home: string; projects: string; history: string; store: string; reports?: string; shared: string; out: string; now?: () => number; resolve?: (cwd: string) => Resolved; scratch?: RegExp };

export function defaults(home: string): Cfg {
  return {
    home,
    projects: join(home, ".claude/projects"),
    history: join(home, ".claude/history.jsonl"),
    store: join(home, ".claude/plugins/store"),
    reports: join(home, "Reports"),
    shared: join(home, ".config/herdr-app/shared.json"),
    out: join(home, ".config/herdr-app/data/kt-hub"),
  };
}

function lock(out: string, now: number) {
  const file = join(out, "lock");
  for (let i = 0; i < 2; i++) {
    try {
      writeFileSync(file, JSON.stringify({ pid: process.pid, at: now }), { flag: "wx" });
      return file;
    } catch {
      let l: any = null;
      try { l = JSON.parse(readFileSync(file, "utf8")); } catch {}
      let alive = false;
      try { if (l?.pid) { process.kill(l.pid, 0); alive = true; } } catch {}
      if (alive && now - (l?.at ?? 0) < LOCK_MS) return null;
      try { unlinkSync(file); } catch {}
    }
  }
  return null;
}

/** One pass: the transcripts' new lines, history.jsonl once, the flows; then archive.json and summary.json. */
export function run(cfg: Cfg) {
  const clock = cfg.now ?? Date.now;
  const t0 = clock();
  mkdirSync(cfg.out, { recursive: true });
  const held = lock(cfg.out, t0);
  if (!held) return { ok: true, busy: true };
  try {
    const archiveFile = join(cfg.out, "archive.json");
    const A = loadArchive(archiveFile);
    let shared: any = {};
    try { shared = JSON.parse(readFileSync(cfg.shared, "utf8")); } catch {}
    const chez = new Map<string, boolean>();
    let chezRoot: Resolved | undefined;
    // git and chezmoi must run: a folder resolved to nothing is kept so in the archive.
    if (!cfg.resolve) for (const bin of ["git", "chezmoi"]) if (!sh(bin, ["--version"])) throw new Error(`${bin} not found`);
    const resolve = cfg.resolve ?? ((cwd: string) => {
      const r = gitRoot(cwd);
      if (r || !existsSync(cwd) || !chezmoiManaged(cwd, cfg.home, chez)) return r;
      return (chezRoot ??= gitRoot(sh("chezmoi", ["source-path"]) ?? ""));
    });
    const ctx: Ctx = { home: cfg.home, reg: registryOf(shared), scratch: cfg.scratch, cwds: A.cwds, resolve, projects: A.projects };
    seed(ctx, A.historyDone ? null : cfg.history);
    const save = () => writeAtomic(archiveFile, JSON.stringify(A));
    let files = 0, read = 0, saved = clock(), oldest = Infinity;
    const present = new Set<string>();
    for (const f of listTranscripts(cfg.projects)) {
      present.add(f.path);
      let s;
      try { s = statSync(f.path); } catch { continue; }
      if (!f.sub) oldest = Math.min(oldest, s.mtimeMs);
      const st = (A.files[f.path] ??= { s: 0, t: 0, off: 0 });
      if (s.size === st.s && s.mtimeMs === st.t) continue;
      const before = st.off;
      indexFile(f.path, f.sub, st, s.size, A, ctx);
      st.s = s.size;
      st.t = s.mtimeMs;
      files++;
      read += Math.max(0, st.off - before);
      if (clock() - saved > SAVE_MS) { save(); saved = clock(); } // a checkpoint: offsets and counts together
    }
    // A transcript Claude Code deleted: its days are kept, its offset goes.
    for (const p of Object.keys(A.files)) if (!present.has(p)) delete A.files[p];
    // The junction: the oldest session file's last write. Claude Code deletes a session by its mtime, so
    // the days before it hold only survivors (a resumed session, its sub-agents): history.jsonl adds the
    // sessions they miss. Fixed at the first pass.
    A.junction ??= localDay(Number.isFinite(oldest) ? oldest : t0);
    if (!A.historyDone) {
      indexHistory(cfg.history, A, ctx);
      A.historyDone = true;
      for (const d of Object.keys(A.days)) if (d < A.junction && (!A.first || d < A.first)) A.first = d;
    }
    archiveFlows(cfg.store, A, t0);
    if (cfg.reports) readReports(cfg.reports, A);
    freeze(A, localDay(t0));
    A.pass = { at: clock(), ms: clock() - t0, files, read };
    save();
    writeAtomic(join(cfg.out, "summary.json"), JSON.stringify(summarize(A, clock())));
    return { ok: true, ms: A.pass.ms, files, read };
  } finally {
    try { unlinkSync(held); } catch {}
  }
}

if (import.meta.main) {
  const home = process.env.HOME ?? "";
  // exec's PATH has no ~/.nix-profile, where git and chezmoi live here.
  process.env.PATH = [join(home, ".nix-profile/bin"), "/opt/homebrew/bin", "/usr/local/bin", process.env.PATH ?? "/usr/bin:/bin"].join(":");
  try {
    console.log(JSON.stringify(run(defaults(home))));
  } catch (e: any) {
    const out = defaults(home).out;
    // The page says it quietly and keeps the last summary.
    try { mkdirSync(out, { recursive: true }); writeAtomic(join(out, "error.json"), JSON.stringify({ at: Date.now(), message: String(e?.message ?? e) })); } catch {}
    console.log(JSON.stringify({ ok: false, error: String(e?.message ?? e) }));
    process.exitCode = 1;
  }
}
