// kt-context's model (#91): what ctx-index.ts read, merged and turned into what the panel shows. Pure, no
// herdr: model.check.mjs checks it, with ctx-index.ts, on invented transcripts.
//
// The state of one transcript: { path, offset, turns: [{ id, at, tokens }], compactions, shape, lists }.
// - merge(): a read into the state. A read from 0 (the first, or a rewritten file) starts over; a read
//   from the state's offset appends (its calls by id: the last write of a call wins, its compactions, its
//   shape if it has one, else the one before, its lists through mergeLists). Any other: null, the caller
//   reads the whole file again.
// - current(): the context now, from the last call, or a compaction made since.
// - breakdown(): /context's rows (#91, the study of 2026-11-19: its categories and their order, read in
//   Claude Code 2.1.328), ESTIMATED but for the total: each part measured in characters and divided by
//   its category's CHARS_PER (calibrated on /context), else CHARS_PER_TOKEN (no tokenizer here), the
//   messages what remains of the last call's real context. The system
//   prompt and the tools come from the request's shape: without one (an older session, another version)
//   they are absent, and the panel says so. The compaction reserve from the threshold the past automatic
//   compactions crossed: none yet, absent.
// - grid(): /context's grid of squares (its algorithm: 10 by 10, 20 by 10 from a 1M window; a row takes at
//   least a square, its last one partial; the reserve at the end, the free space before it).
// - details(): the lists under the grid, by category, sorted by tokens, LIST_MAX shown and « +N ».
// - curve(): the calls, at most `n` points (each the highest of its bucket).

export const CHARS_PER_TOKEN = 4;
// Characters a token by category, where measured: one calibration against /context (Claude Code 2.1.328,
// 2026-11-19, a fresh session with this machine's memory files, skills and agents; /context counts with
// the token-count API). The memory files are dense (French Markdown, tables, emoji): ÷ 4 put them 45 %
// low; the skills' listing 25 % low, the agents' 17 %. The rest wasn't comparable (another model's prompt
// and tools, other MCP servers): CHARS_PER_TOKEN. A calibration knob: measure again before changing it.
export const CHARS_PER = { memory: 2.2, skills: 3.0, agents: 3.3 };
export const MAX_TURNS = 4000; // calls kept per transcript, the newest
export const LIST_MAX = 12; // a list's items shown, the rest « +N »
// /context's rows in its order (the engine's ids: system_prompt, system_tools, mcp_tools,
// mcp_instructions, custom_agents, memory_files, skills, messages).
export const ROWS = ["system", "tools", "mcp", "mcpInstructions", "agents", "memory", "skills", "messages"];

export const emptyLists = () => ({ skills: null, memory: null, agents: {}, builtIn: [], mcpInstructions: {}, deferred: {} });
export const emptyState = (path) => ({ path, offset: 0, turns: [], compactions: [], shape: null, lists: emptyLists() });

/** A session id as Claude Code names its transcript (a UUID: letters, digits, dashes), else null: it goes
 *  into a path under ~/.claude/projects, where « .. » or « / » would reach another file (cold review 2, 12). */
export const sessionId = (id) => (typeof id === "string" && /^[A-Za-z0-9-]+$/.test(id) ? id : null);

// An overlay of a read (ctx-index.ts: names set with their chars, names removed) over `base`; its `reset`
// (a compaction, or the listing's isInitial) starts from nothing.
const applyOverlay = (base, o) => {
  if (!o) return base ?? {};
  const next = o.reset ? {} : { ...(base ?? {}) };
  for (const k of o.removed ?? []) delete next[k];
  return Object.assign(next, o.set ?? {});
};

/** The lists the context carries, `prev` with a read's (ctx-index.ts `lists`). A snapshot (skills,
 *  memory) replaces the one before; a compaction in the read (`reset`) clears them all first. */
export function mergeLists(prev, r) {
  const p = r?.reset ? emptyLists() : prev ?? emptyLists();
  if (!r) return p;
  return {
    skills: r.skills ?? p.skills,
    memory: r.memory ?? p.memory,
    agents: applyOverlay(p.agents, r.agents),
    builtIn: r.agents?.reset ? [...(r.agents.builtIn ?? [])] : [...new Set([...p.builtIn, ...(r.agents?.builtIn ?? [])])],
    mcpInstructions: applyOverlay(p.mcpInstructions, r.mcpInstructions),
    deferred: applyOverlay(p.deferred, r.deferred),
  };
}

/** `read`: ctx-index.ts' output. Answers the new state, or null when it doesn't follow the state. */
export function merge(state, path, read) {
  if (!read || !Number.isFinite(read.offset)) return null;
  let s;
  if (read.from === 0) s = emptyState(path);
  else if (state?.path === path && read.from === state.offset) s = state;
  else return null;
  const byId = new Map(s.turns.map((x) => [x.id, x]));
  for (const x of read.turns ?? []) if (x?.id != null && Number.isFinite(x.tokens)) byId.set(x.id, x);
  const turns = [...byId.values()];
  return {
    path,
    offset: read.offset,
    turns: turns.length > MAX_TURNS ? turns.slice(-MAX_TURNS) : turns,
    compactions: [...s.compactions, ...(read.compactions ?? [])],
    shape: read.shape ?? s.shape,
    lists: mergeLists(s.lists, read.lists),
  };
}

/**
 * The context now: { tokens, pct, compacted }. The transcript's last call (ctx-index.ts: its last
 * iteration's), else the status line's tokens (they are the call's top-level usage: an advisor consulted
 * mid-call sums its iterations there, past the window); a compaction after that call makes both stale (the
 * line's ctx_pct reads 0 until the next call): then the compaction's postTokens, `compacted` its time.
 * `window`: the status line's, 1M unknown.
 */
export function current(state, line) {
  const size = line?.window || 1_000_000;
  const turn = state?.turns?.at(-1), cut = state?.compactions?.at(-1);
  const after = cut && Number.isFinite(cut.post) && (!turn || (cut.at && turn.at && cut.at > turn.at));
  const fromLine = (line?.input_tokens ?? 0) + (line?.cache_read_input_tokens ?? 0) + (line?.cache_creation_input_tokens ?? 0);
  const tokens = after ? cut.post : turn?.tokens || fromLine || 0;
  const pct = tokens > 0 ? Math.round((tokens / size) * 100) : Math.round(line?.ctx_pct ?? 0);
  return { tokens, pct, window: size, compacted: after ? cut.at : null };
}

const est = (chars, key) => Math.round(Math.max(0, chars ?? 0) / (CHARS_PER[key] ?? CHARS_PER_TOKEN));
const sum = (values) => values.reduce((n, v) => n + (v ?? 0), 0);

/** Where automatic compaction runs: the last automatic compaction that started near the window (from 80 %
 *  of it: a lower one ran on another window), its tokens before. null before the first. */
export function threshold(compactions, window) {
  const auto = (compactions ?? []).filter((c) => c?.trigger === "auto" && Number.isFinite(c.pre) && c.pre >= 0.8 * window && c.pre <= window);
  return auto.length ? auto.at(-1).pre : null;
}

const customAgents = (l) => Object.entries(l.agents ?? {}).filter(([t]) => !(l.builtIn ?? []).includes(t));

/**
 * /context's rows: { rows: [{ key, tokens }] (ROWS' order, a part of 0 left out, messages always),
 * noShape, threshold, buffer, free }. `now`: current()'s. All estimated but `now.tokens`.
 */
export function breakdown(state, now) {
  const s = state?.shape, l = state?.lists ?? emptyLists();
  const parts = {
    system: s ? est(s.system) : 0,
    tools: s ? est(s.tools) : 0,
    mcp: s ? est(sum(Object.values(s.mcp ?? {}))) : 0,
    mcpInstructions: est(sum(Object.values(l.mcpInstructions ?? {}))),
    agents: est(sum(customAgents(l).map(([, c]) => c)), "agents"),
    memory: est(sum((l.memory ?? []).map((f) => f.chars)), "memory"),
    skills: est(sum((l.skills?.entries ?? []).map((x) => x.chars)), "skills"),
  };
  const rows = ROWS.filter((k) => k !== "messages" && parts[k] > 0).map((key) => ({ key, tokens: parts[key] }));
  rows.push({ key: "messages", tokens: Math.max(0, now.tokens - sum(Object.values(parts))) });
  const th = threshold(state?.compactions, now.window);
  const buffer = th == null ? null : now.window - th;
  return { rows, noShape: !s, threshold: th, buffer, free: Math.max(0, now.window - now.tokens - (buffer ?? 0)) };
}

/**
 * /context's grid: { cols, rows, squares: [{ key, fill }] } row by row. 10 × 10, 20 × 10 from a 1M window.
 * A row takes max(1, round(its share × squares)), its last square `fill` its fraction when it has one
 * (/context draws it hollow under 0.7); the reserve's squares last (key "buffer"), the free space before
 * them ("free"). Rows past the grid are cut, as /context cuts them.
 */
export function grid(rows, window, buffer) {
  const wide = window >= 1_000_000, cols = wide ? 20 : 10, N = cols * 10;
  const bufSq = buffer ? Math.min(N, Math.round((buffer / window) * N)) : 0;
  const squares = [];
  for (const r of rows) {
    if (!(r.tokens > 0)) continue;
    const exact = (r.tokens / window) * N, n = Math.max(1, Math.round(exact)), full = Math.floor(exact), part = exact - full;
    for (let i = 0; i < n && squares.length < N - bufSq; i++) squares.push({ key: r.key, fill: i === full && part > 0 ? part : 1 });
  }
  while (squares.length < N - bufSq) squares.push({ key: "free", fill: 0 });
  while (squares.length < N) squares.push({ key: "buffer", fill: 1 });
  return { cols, rows: N / cols, squares };
}

/**
 * The grid as dither cells for viz.js runs(): { cols, rows, ink(col, row) -> key | "track" | null }. A
 * square is 4 × 4 cells and a cell of gap (null). Kept cheap to paint (runs() merges what repeats: viz.js'
 * MAX_RECTS): a full square is one rectangle; a half-ink category (`tone` 0.5) vertical stripes, 4; the
 * reserve horizontal stripes, 4; only a row's partial last square is in Bayer dots (`inked`: viz.js'), up
 * to 16. The free space is the track.
 */
export function gridInk(g, tone, inked) {
  const ink = (col, row) => {
    const ic = col % 5, ir = row % 5;
    if (ic === 4 || ir === 4) return null;
    const s = g.squares[Math.floor(row / 5) * g.cols + Math.floor(col / 5)];
    if (!s || s.key === "free") return "track";
    if (s.key === "buffer") return ir % 2 ? "track" : "buffer";
    const t = tone(s.key);
    if (s.fill >= 1 && t >= 1) return s.key;
    if (s.fill >= 1) return ic % 2 ? "track" : s.key;
    return inked(ic, ir, t * s.fill) ? s.key : "track";
  };
  return { cols: g.cols * 5 - 1, rows: g.rows * 5 - 1, ink };
}

// A list sorted by tokens (then name), LIST_MAX shown: { items, more }.
const top = (items) => {
  const sorted = [...items].sort((a, b) => (b.tokens ?? -1) - (a.tokens ?? -1) || a.name.localeCompare(b.name));
  return { items: sorted.slice(0, LIST_MAX), more: Math.max(0, sorted.length - LIST_MAX) };
};
const serverOf = (tool) => /^mcp__(.+?)__/.exec(tool)?.[1] ?? null;

/**
 * The lists under the grid, a group a category with something in it, in /context's order: { key, count,
 * tokens (estimated; null: not in the window), items: [{ name, tag?, tokens }], more, ...extra }.
 * mcp: the loaded MCP tools, their server as tag; deferred: the tools loaded on demand (names only, outside
 * the window: no tokens), their server or « system » as tag; agents: the custom ones (`builtIn`: how many
 * built-in ones are apart); memory: the files, their type as tag; skills: the listing (`listed` of `count`).
 */
export function details(state) {
  const s = state?.shape, l = state?.lists ?? emptyLists();
  const out = [];
  const group = (key, items, extra = {}) => {
    if (!items.length) return;
    const known = items.filter((x) => x.tokens != null);
    out.push({ key, count: items.length, tokens: known.length ? sum(known.map((x) => x.tokens)) : null, ...top(items), ...extra });
  };
  const mcp = Object.entries(s?.mcpTools ?? {}).map(([name, c]) => ({ name: name.replace(/^mcp__.+?__/, ""), tag: serverOf(name), tokens: est(c) }));
  group("mcp", mcp, { servers: new Set(mcp.map((x) => x.tag)).size });
  group("mcpInstructions", Object.entries(l.mcpInstructions ?? {}).map(([name, c]) => ({ name, tokens: est(c) })));
  const deferred = Object.keys(l.deferred ?? {}).map((name) => ({ name: name.replace(/^mcp__.+?__/, ""), tag: serverOf(name), tokens: null }));
  group("deferred", deferred, { mcpCount: deferred.filter((x) => x.tag).length });
  group("agents", customAgents(l).map(([name, c]) => ({ name, tokens: est(c, "agents") })), { builtIn: (l.builtIn ?? []).length });
  group("memory", (l.memory ?? []).map((f) => ({ name: f.path, tag: f.type, tokens: est(f.chars, "memory") })));
  if (l.skills) group("skills", l.skills.entries.map((x) => ({ name: x.name, tokens: est(x.chars, "skills") })), { listed: l.skills.entries.length, total: l.skills.count });
  return out;
}

/** The curve: { values, labels } with at most `n` points, each the highest call of its bucket (a
 *  compaction's drop stays a drop), labelled by its first call's number. */
export function curve(turns, n = 80) {
  const list = turns ?? [];
  const per = Math.max(1, Math.ceil(list.length / n));
  const values = [], labels = [];
  for (let i = 0; i < list.length; i += per) {
    values.push(Math.max(...list.slice(i, i + per).map((x) => x.tokens)));
    labels.push(String(i + 1));
  }
  return { values, labels };
}
