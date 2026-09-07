#!/usr/bin/env bun
import { readFileSync, writeFileSync, existsSync, mkdirSync, openSync, readSync, closeSync, statSync, realpathSync } from "fs";
import { execSync, spawn } from "child_process";
import { homedir } from "os";
import { basename, dirname, join } from "path";

// ── Claude Dark Palette (from theme.conf) ──────────────────────────
const C = {
  orange: [212, 130, 93] as const, // #D4825D
  purple: [199, 155, 255] as const, // #C79BFF
  green: [134, 232, 154] as const, // #86E89A
  blue: [122, 184, 255] as const, // #7AB8FF
  cyan: [138, 191, 184] as const, // #8ABFB8
  yellow: [255, 223, 97] as const, // #FFDF61
  red: [255, 122, 122] as const, // #FF7A7A
  muted: [153, 153, 153] as const, // #999999
  fg: [224, 224, 224] as const, // #E0E0E0
  dark: [26, 26, 26] as const, // #1A1A1A
  surface0: [36, 36, 36] as const, // #242424
  surface1: [56, 56, 56] as const, // #383838
  surface2: [68, 68, 68] as const, // #444444
};

type RGB = readonly [number, number, number];

// ── ANSI helpers ────────────────────────────────────────────────────
const ansi = {
  fg: (c: RGB) => `\x1b[38;2;${c[0]};${c[1]};${c[2]}m`,
  bg: (c: RGB) => `\x1b[48;2;${c[0]};${c[1]};${c[2]}m`,
  reset: "\x1b[0m",
  bold: "\x1b[1m",
};

// ── Read stdin JSON ─────────────────────────────────────────────────
const input = await Bun.stdin.text();
let data: any;
try {
  data = JSON.parse(input);
} catch {
  process.exit(0);
}

// ── Extract model info ──────────────────────────────────────────────
const modelName = (typeof data.model === "string"
  ? data.model
  : data.model?.display_name ?? "Unknown")
  .replace(/\(1M context\)/i, "[1m]");

const modelId = typeof data.model === "string"
  ? data.model
  : data.model?.id ?? "";

// ── Model context window size (tokens) ──────────────────────────────
function getMaxTokens(id: string): number {
  // 1M context models: opus-4, any model flagged with 1m/1M in id
  if (id.includes("opus-4") || id.includes("1m") || id.includes("1M")) return 1_000_000;
  return 200_000;
}

// ── Format token count as human-readable K/M string ─────────────────
function fmtTokens(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + "M";
  if (n >= 1_000) return Math.round(n / 1_000) + "K";
  return String(n);
}

// ── Resolve context usage from JSON input or transcript fallback ─────
function getContextInfo(data: any): { usedPct: number | null; windowSize: number; usedTokens: number } {
  const cw = data.context_window;
  if (cw) {
    const windowSize = cw.context_window_size ?? getMaxTokens(modelId);
    const usedPct = cw.used_percentage ?? null;
    const usedTokens = cw.current_usage
      ? (cw.current_usage.input_tokens ?? 0) +
        (cw.current_usage.cache_creation_input_tokens ?? 0) +
        (cw.current_usage.cache_read_input_tokens ?? 0)
      : 0;
    return { usedPct, windowSize, usedTokens };
  }

  // Fallback: parse transcript manually
  const path = data.transcript_path ?? "";
  if (!path || !existsSync(path)) return { usedPct: null, windowSize: getMaxTokens(modelId), usedTokens: 0 };

  let contextLength = 0;
  try {
    const lines = readFileSync(path, "utf-8").split("\n");
    for (const line of lines) {
      if (!line) continue;
      try {
        const e = JSON.parse(line);
        if (e.isApiErrorMessage || e.isSidechain) continue;
        const u = e.message?.usage;
        if (!u) continue;
        contextLength = (u.input_tokens ?? 0) +
          (u.cache_creation_input_tokens ?? 0) +
          (u.cache_read_input_tokens ?? 0);
      } catch { }
    }
  } catch { }

  const windowSize = getMaxTokens(modelId);
  const usedPct = windowSize > 0 ? Math.min(100, (contextLength / windowSize) * 100) : null;
  return { usedPct, windowSize, usedTokens: contextLength };
}

// ── Git helpers ─────────────────────────────────────────────────────
function gitIn(cwd: string, cmd: string): string {
  try {
    return execSync(`git ${cmd}`, {
      cwd,
      timeout: 2000,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
  } catch {
    return "";
  }
}

// Read the last ~64KB of the transcript as lines (avoids re-reading long logs).
function tailLines(path: string, bytes = 65536): string[] {
  try {
    const size = statSync(path).size;
    const start = Math.max(0, size - bytes);
    const len = size - start;
    const buf = Buffer.allocUnsafe(len);
    const fd = openSync(path, "r");
    try { readSync(fd, buf, 0, len, start); } finally { closeSync(fd); }
    return buf.toString("utf-8").split("\n").filter(Boolean);
  } catch {
    return [];
  }
}

// ── Small JSON cache under ~/.claude/cache/statusline ────────────────
const CACHE_DIR = join(homedir(), ".claude", "cache", "statusline");
function readJson(file: string): any {
  try { return JSON.parse(readFileSync(file, "utf-8")); } catch { return null; }
}
function writeJson(file: string, obj: any): void {
  try { mkdirSync(CACHE_DIR, { recursive: true }); writeFileSync(file, JSON.stringify(obj)); } catch { }
}

// Per-session cache: the detected worktree + the gwm pin we already fired for it.
const cacheFile = data.session_id ? join(CACHE_DIR, `session-${data.session_id}.json`) : "";
let sessionCache: any = cacheFile ? readJson(cacheFile) : null;
function saveCache(patch: Record<string, unknown>): void {
  if (!cacheFile) return;
  sessionCache = { ...(sessionCache ?? {}), ...patch };
  writeJson(cacheFile, sessionCache);
}

// POSIX single-quote escaping for the one place we shell out with paths.
const sq = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`;

// Most recent edit (then read) file_path in `lines` that resolves inside a git
// repo → the worktree the session is actually acting on. Pure: no I/O beyond
// the git resolve, so it runs over either the tail or the whole transcript.
// `fromEdit` distinguishes "the session works here" from "it merely read a file
// here" — the auto-pin below only fires on the former.
function findWorktreeInLines(lines: string[]): { dir: string; fromEdit: boolean } {
  const EDIT = new Set(["Edit", "MultiEdit", "Write", "NotebookEdit"]);
  const edits: string[] = [], reads: string[] = [];
  for (const l of lines) {
    let e: any;
    try { e = JSON.parse(l); } catch { continue; }
    if (e.isSidechain) continue; // main agent only; a sub-agent may edit elsewhere
    const c = e.message?.content;
    if (!Array.isArray(c)) continue;
    for (const b of c) {
      if (b?.type !== "tool_use") continue;
      const p = b.input?.file_path ?? b.input?.notebook_path ?? b.input?.path;
      if (typeof p !== "string" || !p.startsWith("/")) continue;
      if (EDIT.has(b.name)) edits.push(p);
      else if (b.name === "Read") reads.push(p);
    }
  }
  const ordered: Array<[string, boolean]> = [
    ...edits.reverse().map((p) => [p, true] as [string, boolean]),
    ...reads.reverse().map((p) => [p, false] as [string, boolean]),
  ];
  for (const [p, fromEdit] of ordered) {
    const top = gitIn(dirname(p), "rev-parse --show-toplevel");
    if (top) return { dir: top, fromEdit }; // first path resolving to a real repo (skips /tmp scratchpad)
  }
  return { dir: "", fromEdit: false };
}

// The session's real working tree: cwd is often the main checkout while edits
// target a gwm worktree via absolute paths. Sticky per session_id so the row
// doesn't flicker when the recent tail has no worktree edit (bash, plain chat,
// memory writes to ~/.claude — the actual bug that made it reset).
const TAIL_BYTES = 131_072; // 128 KB
let wtFromEdit = false; // set by detectWorktreeDir — gates the auto-pin
function detectWorktreeDir(): string {
  const path = data.transcript_path ?? "";
  let size = 0;
  try { if (path) size = statSync(path).size; } catch { }
  const valid = size > 0;
  // cache the detected dir + the transcript size at detection, so a later render
  // knows whether anything new scrolled past what the tail already covered.
  const save = (hit: { dir: string; fromEdit: boolean }) => {
    wtFromEdit = hit.fromEdit;
    saveCache({ dir: hit.dir, size });
    return hit.dir;
  };

  // 1) recent 128 KB — the common "just edited a worktree file", and catches a
  //    switch the moment you edit in the new worktree.
  if (valid) { const hit = findWorktreeInLines(tailLines(path, TAIL_BYTES)); if (hit.dir) return save(hit); }

  // 2) sticky: tail is dry. If nothing grew beyond what the tail already scanned
  //    since we last detected, the cache is authoritative — no rescan.
  const cached = sessionCache;
  const covered = cached && valid && size - (cached.size ?? 0) <= TAIL_BYTES;
  if (cached?.dir && existsSync(cached.dir) && covered) return cached.dir;

  // 3) a big gap accumulated (or cold cache): scan wider to catch a switch whose
  //    edits scrolled past the 128 KB tail without a render seeing them.
  if (valid) { const hit = findWorktreeInLines(tailLines(path, 2_097_152)); if (hit.dir) return save(hit); }

  // 4) wider scan also dry → keep the last known worktree, mark it current.
  if (cached?.dir && existsSync(cached.dir)) { saveCache({ size }); return cached.dir; }
  return "";
}

// One git context for the whole line: the detected worktree, else cwd. A no-op
// in normal sessions (last edit lives in the cwd repo → same toplevel).
// resolved: git hands back real paths, so a symlinked cwd (/tmp, /var on macOS)
// must be resolved too or the auto-pin below reads it as "another tree".
let cwd = data.cwd || data.workspace?.current_dir || process.cwd();
try { cwd = realpathSync(cwd); } catch { }
const gitCwd = detectWorktreeDir() || cwd;
const git = (cmd: string) => gitIn(gitCwd, cmd);

// ── OSC 8 clickable hyperlink (Ghostty/iTerm/WezTerm/tmux passthrough) ─
const osc8 = (url: string, label: string) => `\x1b]8;;${url}\x07${label}\x1b]8;;\x07`;

function gwmInstalled(): boolean {
  try {
    execSync("command -v gwm", { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] });
    return true;
  } catch { return false; }
}

// ── gwm link (issue / PR / repo) from git config — gwm's persisted state ─
// gwm resolves the issue/PR once and writes it into branch config (`gwm-issue`,
// `gwm-pr`, `gwm-pr-detected`; issue #283). Reading that is offline and instant
// (~20ms) vs `gwm status`'s ~1.5s `gh` probe, and needs no running daemon. We
// mirror what gwm last detected; normal gwm use (TUI, review loop) keeps it
// fresh. Issue falls back to the branch name when no explicit key is stored.
// origin → forge web base, for the two forges gwm speaks (GitHub, GitLab; #419).
// Rebuilt from host + path, never by munging the origin string: an https remote
// can carry `oauth2:token@` and a credential must never land in a clickable
// link. Unknown host (Gitea, Bitbucket, file://) → no base, chips stay plain
// text rather than emitting github-shaped paths that 404.
// ponytail: host substring match; a self-hosted GitLab on a custom domain needs
// gwm's `[forge_hosts]` — parse .gwm.toml here if that ever comes up.
function forgeBase(origin: string): { base: string; repo: string; gl: boolean } {
  const m = origin.match(/^(?:(?:ssh|git|https?):\/\/)?(?:[^@/]+@)?([^/:]+)(?::\d+)?[:/](.+?)(?:\.git)?\/?$/);
  const host = m?.[1] ?? "", repo = m?.[2] ?? "";
  const gl = /gitlab/i.test(host);
  if (!repo || (!gl && !/github/i.test(host))) return { base: "", repo: "", gl: false };
  return { base: `https://${host}/${repo}`, repo, gl };
}

type GwmLink = { issue: number; pr: number; prState: string; repo: string; base: string; gl: boolean; pushed: boolean; pins: string[] };
function readGwmLink(branch: string): GwmLink {
  const out: GwmLink = { issue: 0, pr: 0, prState: "", repo: "", base: "", gl: false, pushed: false, pins: [] };
  if (!branch) return out;
  const f = forgeBase(git("config --get remote.origin.url"));
  out.repo = f.repo; out.base = f.base; out.gl = f.gl;
  // one read; match exact keys by plain-string prefix (no branch-regex escaping)
  const cfg = git("config --get-regexp '(gwm-(pr-detected-state|pr-detected|pr-state|pr|issue|agent-pin)|merge)$'");
  const vals = (sub: string) => {
    const prefix = `branch.${branch}.${sub} `;
    return cfg.split("\n").filter((l) => l.startsWith(prefix)).map((l) => l.slice(prefix.length).trim());
  };
  const val = (sub: string) => vals(sub)[0] ?? "";
  out.pins = vals("gwm-agent-pin"); // multi-valued: pins accumulate per worktree
  // `branch.<b>.merge` lands on the first `push -u` (or a clone of a remote
  // branch) — i.e. the branch exists on the forge. gwm creates the worktree's
  // branch locally, so until the push a /tree/ link is a guaranteed 404. Read
  // from the same config dump: no extra git call, no shell-escaping the ref.
  out.pushed = !!val("merge");
  out.issue = parseInt(val("gwm-issue"), 10) || 0;
  // explicit `gwm-pr` wins over auto-detected; carry the matching state so the
  // caller can drop a PR that's already merged/closed.
  const explicitPr = parseInt(val("gwm-pr"), 10) || 0;
  if (explicitPr) { out.pr = explicitPr; out.prState = val("gwm-pr-state"); }
  else { out.pr = parseInt(val("gwm-pr-detected"), 10) || 0; out.prState = val("gwm-pr-detected-state"); }
  return out;
}

// ── Auto-pin this session onto the worktree it actually edits in ─────
// gwm attributes a session to the directory its transcript records — which stays
// on the main checkout through the whole `gwm create` → edit-in-the-worktree
// flow, so the worktree shows no agent. That is what `gwm agents attach` is for,
// and Claude Code hands us the exact `session_id`, so nothing has to be guessed.
// Gated hard: only a real edit, only when the session's cwd is another tree, only
// into a linked worktree — every other case gwm's own detection already covers,
// and a pin is a write into that repo's `.git/config` that never expires.
function autoPin(dir: string, pins: string[]): void {
  const sid = data.session_id ?? "";
  if (!sid) return;
  if (pins.includes(sid)) { saveCache({ pinned: dir, pinTry: 0 }); return; }
  // `attach` rejects a session gwm has not detected yet (it reads on-disk
  // artefacts), so the first try can lose a race the next render wins. Bounded
  // retry: at most 3 spawns per worktree, never a spawn on every render.
  const tries = sessionCache?.pinned === dir ? (sessionCache?.pinTry ?? 0) : 0;
  if (tries >= 3) return;
  if (!wtFromEdit) return;
  if (cwd === dir || cwd.startsWith(dir + "/")) return;
  if (!git("rev-parse --git-dir").includes("/worktrees/")) return;

  const prev = sessionCache?.pinned;
  const cmds: string[] = [];
  // moving worktrees mid-session (sprint flow) must drop the stale pin, else the
  // session shows up in a worktree it left. Chained in one shell so the two
  // `git config` writes to the shared common dir cannot race each other.
  if (prev && prev !== dir && existsSync(prev)) cmds.push(`cd ${sq(prev)} && gwm agents detach . ${sq(sid)}`);
  cmds.push(`cd ${sq(dir)} && gwm agents attach . ${sq(sid)}`);
  try { spawn("sh", ["-c", cmds.join("; ")], { detached: true, stdio: "ignore" }).unref(); } catch { }
  // counted even though the spawn is fire-and-forget: a gwm that can never pin
  // (untrusted .gwm.toml, pattern miss) gives up after 3 renders instead of
  // respawning forever. The chip reads git config, not this counter, so it
  // shows the pin only once gwm really holds it.
  saveCache({ pinned: dir, pinTry: tries + 1 });
}

// ── Gather data ─────────────────────────────────────────────────────
const ctx = getContextInfo(data);
const ctxPct = ctx.usedPct !== null ? ctx.usedPct.toFixed(1) : null;
const ctxWindowLabel = ctx.windowSize >= 1_000_000
  ? `${(ctx.windowSize / 1_000_000).toFixed(0)}M`
  : `${ctx.windowSize / 1_000}K`;
const is1MContext = ctx.windowSize >= 1_000_000;
const rawStyle = data.output_style;
const outputStyle = typeof rawStyle === "string"
  ? rawStyle
  : rawStyle?.name ?? rawStyle?.id ?? "default";
const version = data.version ?? "";
const sessionId = data.session_id ?? "";
// Reasoning effort (low|medium|high|xhigh|max) — absent if model lacks the param
const effortLevel = data.effort?.level ?? "";
const branch = git("rev-parse --abbrev-ref HEAD");
// gwm-style working-tree file counts (precedence created > deleted > modified)
const status = git("status --porcelain");
let created = 0, modified = 0, deleted = 0;
for (const l of status.split("\n")) {
  if (!l) continue;
  const x = l[0], y = l[1];
  if ((x === "?" && y === "?") || x === "A" || y === "A") created++;
  else if (x === "D" || y === "D") deleted++;
  else modified++; // ponytail: porcelain v1 line-split; rare newline-in-path miscounts
}
// Worktree from JSON-LD (only present during --worktree sessions)
const worktreeData = data.worktree;
const worktreeName = worktreeData?.name ?? "";
const worktreeBranch = worktreeData?.branch ?? "";

// Session cost
const costUsd = data.cost?.total_cost_usd ?? null;

// ── Color logic ─────────────────────────────────────────────────────
// Context chip tracks *performance* ("context rot"), not raw fill. 1M models
// (Opus 4.6+/Sonnet 4.6) bill flat, so capacity isn't the worry — degradation
// is. Field data on Opus agentic use: instruction drift ~200K (20%), real
// instruction-confusion ~500K (50%, where the long-context attention pattern
// flips per Veseli 2025). Red at 50% leaves 500K free on purpose — perf
// warning, not "almost out of room". 20% yellow = "left the pristine zone"
// (the tunable knob). 200K-class models go unreliable ~130K (~65%) before
// Claude Code auto-compacts (~78%).
function contextColor(usedPct: number, windowSize: number): RGB {
  if (windowSize >= 1_000_000) {
    if (usedPct >= 50) return C.red;
    if (usedPct >= 20) return C.yellow;
    return C.purple;
  }
  if (usedPct >= 75) return C.red;
  if (usedPct >= 55) return C.yellow;
  return C.purple;
}

// Session-$ alert levels scale with the model's input price (Opus $5/M,
// Sonnet $3/M, Haiku $1/M) so the color flags "high for THIS model", not an
// absolute $ that's trivial on Haiku but a lot on Opus. Heuristic defaults
// (not web-derived); Fast Mode (~2x) isn't reflected — tune if you use it.
function costColor(usd: number, id: string): RGB {
  const m = id.toLowerCase();
  let warn = 3, alarm = 15;                          // Sonnet-class default
  if (m.includes("opus")) { warn = 5; alarm = 25; }
  else if (m.includes("haiku")) { warn = 1; alarm = 5; }
  if (usd >= alarm) return C.red;
  if (usd >= warn) return C.yellow;
  return C.green;
}

// ── Build segments (skip when no data) ──────────────────────────────
type Seg = { text: string; fg: RGB; bg: RGB; kind?: string };
const segments: Seg[] = [];

// Group 1: Model (accent) — always shown; effort suffix only when != high
if (modelName && modelName !== "Unknown") {
  const effortSuffix = effortLevel && effortLevel !== "high" ? ` · ${effortLevel}` : "";
  segments.push({ text: ` ${modelName}${effortSuffix} `, fg: C.dark, bg: C.orange });
}

// Group 2: Context (surface2)
if (ctxPct !== null) {
  segments.push({ text: ` ${ctxPct}% `, fg: contextColor(parseFloat(ctxPct), ctx.windowSize), bg: C.surface2 });
}
if (costUsd !== null) {
  const costStr = costUsd < 0.01 ? "<$0.01" : `$${costUsd.toFixed(2)}`;
  segments.push({ text: ` ${costStr} `, fg: costColor(costUsd, modelId), bg: C.surface2 });
}
if (outputStyle && outputStyle !== "default") {
  segments.push({ text: ` ${outputStyle} `, fg: C.purple, bg: C.surface2 });
}

// Group 3: Git (surface1)
if (branch) {
  segments.push({ text: `  ${branch} `, fg: C.green, bg: C.surface1, kind: "branch" });
}
if (created > 0) {
  segments.push({ text: ` \u{eadc} ${created} `, fg: C.green, bg: C.surface1, kind: "diff" });
}
if (modified > 0) {
  segments.push({ text: ` \u{eadd} ${modified} `, fg: C.yellow, bg: C.surface1, kind: "diff" });
}
if (deleted > 0) {
  segments.push({ text: ` \u{eade} ${deleted} `, fg: C.red, bg: C.surface1, kind: "diff" });
}
if (worktreeName) {
  const wtLabel = worktreeBranch ? `${worktreeName}:${worktreeBranch}` : worktreeName;
  segments.push({ text: ` 𖠰 ${wtLabel} `, fg: C.cyan, bg: C.surface1 });
}

// Group 4: Meta (surface0)
if (sessionId) {
  segments.push({ text: ` ${sessionId} `, fg: C.muted, bg: C.surface0 });
}
if (version) {
  segments.push({ text: ` v${version} `, fg: C.muted, bg: C.surface0 });
}

// ── Row 2: gwm worktree + linked issue / PR (only inside a gwm repo) ──
const row2: Seg[] = [];
if (branch && gwmInstalled()) {
  const toplevel = git("rev-parse --show-toplevel");
  if (toplevel) {
    const wtName = basename(toplevel);
    const link = readGwmLink(branch);
    autoPin(toplevel, link.pins);
    const pinned = sessionId ? link.pins.includes(sessionId) : false;
    const repo = link.repo;
    const bm = branch.match(/#(\d+)/); // issue is free from `<type>/#N-slug`
    const issNum = link.issue || (bm ? parseInt(bm[1], 10) : 0);
    // Drop a PR that's already merged/closed — it's dead once merged, the
    // worktree is about to be cleaned. Unknown state (not yet resolved) shows.
    const prDead = link.prState === "merged" || link.prState === "closed";
    const prNum = prDead ? 0 : link.pr;
    const p = link.base && link.gl ? `${link.base}/-` : link.base; // GitLab nests everything under /-/
    const issUrl = issNum && p ? `${p}/issues/${issNum}` : "";
    const prUrl = prNum && p ? `${p}/${link.gl ? "merge_requests" : "pull"}/${prNum}` : "";
    // branch names carry `#` (feat/#283-slug); raw, everything after it becomes a
    // URL fragment. Encode per segment — `/` must stay a separator in the path.
    const branchUrl = p && link.pushed ? `${p}/tree/${branch.split("/").map(encodeURIComponent).join("/")}` : "";

    // the pin glyph reads git config: it means gwm really holds the pin
    const wtLabel = `𖠰 ${wtName}${pinned ? " \u{f08d}" : ""}`;
    row2.push({ text: ` ${branchUrl ? osc8(branchUrl, wtLabel) : wtLabel} `, fg: C.cyan, bg: C.surface0 });
    if (repo) row2.push({ text: ` ${osc8(link.base, repo)} `, fg: C.muted, bg: C.surface0 });
    if (issNum) {
      const label = `#${issNum}`;
      row2.push({ text: ` \u{f41b} ${issUrl ? osc8(issUrl, label) : label} `, fg: C.yellow, bg: C.surface0 });
    }
    if (prNum) {
      const label = `#${prNum}`;
      row2.push({ text: ` \u{f407} ${prUrl ? osc8(prUrl, label) : label} `, fg: C.blue, bg: C.surface0 });
    }
  }
}

// ── Merge adjacent same-bg segments into one block (single-space gaps) ─
// Saves width: drops the per-segment padding + SEP_SAME between siblings.
// Each merged part re-asserts its own fg inline so colors are preserved.
// trim() only bites outer spaces, never the OSC 8 escapes inside a chip.
function mergeSegs(input: Seg[]): Seg[] {
  const merged: Seg[] = [];
  for (const s of input) {
    const prev = merged[merged.length - 1];
    const sameBg = prev && prev.bg[0] === s.bg[0] && prev.bg[1] === s.bg[1] && prev.bg[2] === s.bg[2];
    if (sameBg) {
      // git block: dot only between branch and the first diff after it; spaces
      // between consecutive diffs. Other blocks: muted · between every element.
      const dot = ` ${ansi.fg(C.muted)}· `;
      const joiner = s.bg === C.surface1
        ? (prev.kind === "branch" && s.kind === "diff" ? dot : " ")
        : dot;
      prev.text = prev.text.replace(/ $/, "") + joiner + ansi.fg(s.fg) + s.text.trim() + " ";
      prev.kind = s.kind;
    } else {
      merged.push({ text: ` ${s.text.trim()} `, fg: s.fg, bg: s.bg, kind: s.kind });
    }
  }
  return merged;
}

// ── Draw a powerline row from a merged segment list ─────────────────
// Powerline glyphs (slanted style from ccstatusline)
const SEP = "\uE0B8";       // separator between groups
const CAP_START = "\uE0B6"; // start cap (half circle)
const CAP_END = "\uE0B8";   // end cap

function drawPowerline(segs: Seg[]): string {
  if (!segs.length) return "";
  let out = ansi.fg(segs[0].bg) + CAP_START + ansi.reset; // start cap
  for (let i = 0; i < segs.length; i++) {
    const s = segs[i];
    out += ansi.bold + ansi.fg(s.fg) + ansi.bg(s.bg) + s.text;
    // slanted separator to the next (always a different bg after merge)
    if (i < segs.length - 1) {
      out += ansi.fg(s.bg) + ansi.bg(segs[i + 1].bg) + SEP;
    }
  }
  const last = segs[segs.length - 1];
  return out + ansi.reset + ansi.fg(last.bg) + CAP_END + ansi.reset; // end cap
}

const renderLine = (input: Seg[]) => drawPowerline(mergeSegs(input));
const line1 = renderLine(segments);
const line2 = renderLine(row2);
process.stdout.write(line2 ? `${line1}\n${line2}` : line1);
