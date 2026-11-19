// kt-context's model (#91): what ctx-index.ts read, merged and turned into what the panel shows. Pure, no
// herdr: model.check.mjs checks it, with ctx-index.ts, on invented transcripts.
//
// The state of one transcript: { path, offset, turns: [{ id, at, tokens }], compactions, shape }.
// - merge(): a read into the state. A read from 0 (the first, or a rewritten file) starts over; a read
//   from the state's offset appends (its calls by id: the last write of a call wins, its compactions, its
//   shape if it has one, else the one before). Any other: null, the caller reads the whole file again.
// - breakdown(): the split by category, ESTIMATED: the request's shape is measured in characters, here
//   divided by CHARS_PER_TOKEN (no tokenizer), the messages being what remains of the last call's real
//   context (memory files, skills and reminders come in as messages: nothing tells them apart outside
//   /context). null without a shape (an older session, another version): the panel says so, never guesses.
// - current(): the context now, from the status line, or a compaction made since its call.
// - curve(): the calls, at most `n` points (each the highest of its bucket).

export const CHARS_PER_TOKEN = 4;
export const MAX_TURNS = 4000; // calls kept per transcript, the newest

export const emptyState = (path) => ({ path, offset: 0, turns: [], compactions: [], shape: null });

/** A session id as Claude Code names its transcript (a UUID: letters, digits, dashes), else null: it goes
 *  into a path under ~/.claude/projects, where « .. » or « / » would reach another file (cold review 2, 12). */
export const sessionId = (id) => (typeof id === "string" && /^[A-Za-z0-9-]+$/.test(id) ? id : null);

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

const est = (chars) => Math.round(Math.max(0, chars ?? 0) / CHARS_PER_TOKEN);

/** [{ key, tokens, servers? }] in the panel's order, or null. `last`: the last call's context, in tokens. */
export function breakdown(shape, last) {
  if (!shape) return null;
  const servers = Object.entries(shape.mcp ?? {}).map(([name, c]) => ({ name, tokens: est(c) })).sort((a, b) => b.tokens - a.tokens);
  const system = est(shape.system), tools = est(shape.tools), mcp = servers.reduce((n, x) => n + x.tokens, 0);
  const rows = [{ key: "system", tokens: system }, { key: "tools", tokens: tools }];
  if (servers.length) rows.push({ key: "mcp", tokens: mcp, servers });
  rows.push({ key: "messages", tokens: Math.max(0, (last ?? 0) - system - tools - mcp) });
  return rows;
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
