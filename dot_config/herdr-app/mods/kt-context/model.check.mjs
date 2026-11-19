// bun mods/kt-context/model.check.mjs: ctx-index.ts and model.js on an invented transcript (no real
// session is read). Each case fails loudly; "ok" at the end.
import { mkdtempSync, writeFileSync, appendFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { merge, breakdown, grid, gridInk, details, mergeLists, curve, current, emptyState, emptyLists, sessionId, CHARS_PER_TOKEN, CHARS_PER } from "./model.js";

const INDEX = join(import.meta.dir, "ctx-index.ts");
let fails = 0;
const eq = (name, got, want) => {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g !== w) { fails++; console.error(`FAIL ${name}\n  got  ${g}\n  want ${w}`); }
};
const read = (path, from) => {
  const r = Bun.spawnSync([process.execPath, INDEX, path, ...(from != null ? ["--from", String(from)] : [])]);
  if (r.exitCode !== 0) throw new Error(r.stderr.toString());
  return JSON.parse(r.stdout.toString());
};

const call = (id, at, input, created, cached, extra = {}) => ({ type: "assistant", timestamp: at, uuid: `u-${id}-${Math.random()}`, ...extra,
  message: { id, usage: { input_tokens: input, cache_creation_input_tokens: created, cache_read_input_tokens: cached, output_tokens: 50 } } });
const line = (o) => JSON.stringify(o) + "\n";
const dir = mkdtempSync(join(tmpdir(), "kt-context-"));
const file = join(dir, "s.jsonl");
try {
  const shape = { type: "api-request-shape", shape: {
    system: [{ text: "x".repeat(400) }, { text: "y".repeat(40) }],
    tools: [{ name: "Read", description: "d", input_schema: {} }, { name: "mcp__tolaria__get_note", description: "d" }, { name: "mcp__claude_ai_Claude_Docs__batch", description: "dd" }] } };
  writeFileSync(file, [
    line({ type: "user", timestamp: "2026-11-19T10:00:00Z", message: { content: "hi" } }),
    line(shape),
    line(call("m1", "2026-11-19T10:00:01Z", 2, 1000, 0)),
    // One call written in two lines (two content blocks): one turn, the last write.
    line(call("m2", "2026-11-19T10:00:02Z", 2, 100, 1000)),
    line(call("m2", "2026-11-19T10:00:02Z", 2, 100, 1000)),
    // A sub-agent's call: not this context.
    line(call("s1", "2026-11-19T10:00:03Z", 5, 90000, 0, { isSidechain: true })),
    "not json\n",
  ].join(""));

  // 1. The whole file.
  const a = read(file);
  eq("from", a.from, 0);
  eq("turns", a.turns.map((x) => [x.id, x.tokens]), [["m1", 1002], ["m2", 1102]]);
  eq("shape system", a.shape.system, 440);
  eq("shape mcp servers", Object.keys(a.shape.mcp).sort(), ["claude_ai_Claude_Docs", "tolaria"]);
  eq("shape tools", a.shape.tools, JSON.stringify(shape.shape.tools[0]).length);
  const s1 = merge(null, file, a);
  eq("offset at the end", s1.offset, a.size);

  // 2. A compaction and a call appended, plus half a line still being written: read from the offset.
  appendFileSync(file, line({ type: "system", subtype: "compact_boundary", timestamp: "2026-11-19T10:05:00Z", compactMetadata: { trigger: "auto", preTokens: 967196, postTokens: 60021 } })
    + line(call("m3", "2026-11-19T10:05:01Z", 2, 60000, 0)) + '{"type":"assist');
  const b = read(file, s1.offset);
  eq("delta from", b.from, s1.offset);
  eq("delta turns", b.turns.map((x) => x.id), ["m3"]);
  eq("delta compaction", b.compactions, [{ at: "2026-11-19T10:05:00Z", trigger: "auto", pre: 967196, post: 60021 }]);
  eq("delta shape absent", b.shape, null);
  eq("partial line waits", b.offset < b.size, true);
  const s2 = merge(s1, file, b);
  eq("merged turns", s2.turns.map((x) => x.id), ["m1", "m2", "m3"]);
  eq("shape kept", s2.shape, s1.shape);
  eq("compactions kept", s2.compactions.length, 1);

  // 3. A read that doesn't follow (another offset, another file): null, read again.
  eq("mismatch", merge(s2, file, { ...b, from: 7 }), null);
  eq("other path", merge(s2, "/other.jsonl", b), null);
  eq("no read", merge(s2, file, null), null);
  // A file shorter than --from (rewritten): read whole, from 0, starts over.
  writeFileSync(file, line(call("n1", "2026-11-19T11:00:00Z", 1, 10, 10)));
  const c = read(file, s2.offset);
  eq("rewritten from 0", c.from, 0);
  eq("rewritten starts over", merge(s2, file, c).turns.map((x) => x.id), ["n1"]);
  // A missing file: an empty read.
  eq("missing", read(join(dir, "none.jsonl")).turns, []);
} finally {
  rmSync(dir, { recursive: true, force: true });
}

// 4. The split, /context's rows in its order: estimated from characters, a part of 0 left out, the
// messages the rest of the last call (never below 0); without a shape, no system prompt nor tools.
const C = CHARS_PER_TOKEN;
const shape = { system: 400 * C, tools: 100 * C, mcp: { tolaria: 30 * C, docs: 70 * C } };
// Each category at its calibrated rate (CHARS_PER): memory 2.2, skills 3, agents 3.3, the rest 4.
const lists = { ...emptyLists(), skills: { count: 3, entries: [{ name: "a", chars: 60 }, { name: "b", chars: 30 }] }, memory: [{ path: "/h/.claude/CLAUDE.md", type: "User", chars: 110 }],
  agents: { mine: 33, Explore: 9 * C }, builtIn: ["Explore"], mcpInstructions: { tavily: 8 * C } };
eq("calibration", CHARS_PER, { memory: 2.2, skills: 3, agents: 3.3 });
const now = (tokens, window = 1_000_000) => ({ tokens, window, pct: 0, compacted: null });
const B = (st, n) => breakdown({ shape: null, lists: emptyLists(), compactions: [], ...st }, now(n));
eq("breakdown", B({ shape, lists }, 5000).rows, [
  { key: "system", tokens: 400 }, { key: "tools", tokens: 100 }, { key: "mcp", tokens: 100 }, { key: "mcpInstructions", tokens: 8 },
  { key: "agents", tokens: 10 }, { key: "memory", tokens: 50 }, { key: "skills", tokens: 30 }, { key: "messages", tokens: 4302 }]);
eq("breakdown: a part of 0 left out", B({ shape: { system: 4, tools: 4, mcp: {} } }, 10).rows.map((r) => r.key), ["system", "tools", "messages"]);
eq("breakdown: messages floor", B({ shape, lists }, 10).rows.at(-1).tokens, 0);
eq("breakdown: without a shape", [B({ lists }, 5000).noShape, B({ lists }, 5000).rows.map((r) => r.key)], [true, ["mcpInstructions", "agents", "memory", "skills", "messages"]]);
// The reserve: the last automatic compaction near the window (967 k on 1 M, seen for real); a manual one
// and an automatic one far below (409 k: another window) don't count; none: no reserve, all free.
const cut = (trigger, pre) => ({ at: "2026-11-19T10:00:00Z", trigger, pre, post: 60000 });
eq("reserve", B({ shape, compactions: [cut("auto", 967196), cut("auto", 968530), cut("manual", 990000), cut("auto", 409000)] }, 600000),
  { rows: B({ shape }, 600000).rows, noShape: false, threshold: 968530, buffer: 31470, free: 368530 });
eq("no reserve yet", [B({ shape }, 600000).buffer, B({ shape }, 600000).free], [null, 400000]);

// 4b. The grid, /context's algorithm: 20 × 10 from a 1M window, 10 × 10 below; a row at least a square,
// its last one partial; the reserve last, the free space before it; past the grid, cut.
const G = (rows, window, buffer) => grid(rows, window, buffer);
const g1 = G([{ key: "system", tokens: 3355 }, { key: "messages", tokens: 646426 }], 1_000_000, 31470);
eq("grid 1M", [g1.cols, g1.rows, g1.squares.length], [20, 10, 200]);
eq("grid: a small row takes a square, partial", [g1.squares[0].key, Math.round(g1.squares[0].fill * 1000) / 1000], ["system", 0.671]);
eq("grid: counts", ["system", "messages", "free", "buffer"].map((k) => g1.squares.filter((s) => s.key === k).length), [1, 129, 64, 6]);
eq("grid: the reserve last", g1.squares.slice(-6).every((s) => s.key === "buffer"), true);
eq("grid: under half a square, still one", G([{ key: "mcp", tokens: 791 }], 1_000_000, null).squares.filter((s) => s.key === "mcp").length, 1);
const g3 = G([{ key: "messages", tokens: 990000 }], 1_000_000, 31470);
eq("grid: the reserve keeps its squares, the rows cut before it", [g3.squares.filter((s) => s.key === "messages").length, g3.squares.filter((s) => s.key === "buffer").length], [194, 6]);
const g2 = G([{ key: "tools", tokens: 150000 }, { key: "messages", tokens: 100000 }], 200_000, null);
eq("grid 200 k: 10 × 10, cut at the end", [g2.cols, g2.squares.length, g2.squares.filter((s) => s.key === "tools").length, g2.squares.filter((s) => s.key === "messages").length], [10, 100, 75, 25]);

// The grid's cells: a full square solid, a half-ink one in stripes, a partial one in dots (`inked`, here a
// stand-in: the left half), the reserve in horizontal stripes, the free space the track, the gaps null.
const sq = { cols: 5, rows: 1, squares: [{ key: "messages", fill: 1 }, { key: "memory", fill: 1 }, { key: "system", fill: 0.5 }, { key: "buffer", fill: 1 }, { key: "free", fill: 0 }] };
const gi = gridInk(sq, (k) => (k === "memory" ? 0.5 : 1), (c, _r, tone) => c < 4 * tone);
const cellsOf = (n) => Array.from({ length: 4 }, (_, r) => Array.from({ length: 4 }, (_, c) => gi.ink(n * 5 + c, r)).join(" "));
eq("gridInk: size", [gi.cols, gi.rows], [24, 4]);
eq("gridInk: gaps", [gi.ink(4, 0), gi.ink(0, 4)], [null, null]);
eq("gridInk: full", cellsOf(0)[0], "messages messages messages messages");
eq("gridInk: half-ink stripes", [cellsOf(1)[0], cellsOf(1)[3]], ["memory track memory track", "memory track memory track"]);
eq("gridInk: partial dots", cellsOf(2)[0], "system system track track");
eq("gridInk: reserve hatched", [cellsOf(3)[0], cellsOf(3)[1]], ["buffer buffer buffer buffer", "track track track track"]);
eq("gridInk: free", cellsOf(4)[2], "track track track track");

// 4c. The lists: sorted by tokens, 12 then « +N », tags, the built-in agents apart, deferred tools without tokens.
const many = Object.fromEntries(Array.from({ length: 15 }, (_, i) => [`mcp__srv${i % 2}__t${i}`, (i + 1) * C]));
const dd = details({ shape: { ...shape, mcpTools: many }, lists: { ...lists, deferred: { mcp__x__a: 10, Monitor: 5 } } });
eq("details: groups in order", dd.map((d) => d.key), ["mcp", "mcpInstructions", "deferred", "agents", "memory", "skills"]);
eq("details: mcp sorted, 12 then +3", [dd[0].items.length, dd[0].more, dd[0].items[0], dd[0].servers, dd[0].tokens], [12, 3, { name: "t14", tag: "srv0", tokens: 15 }, 2, 120]);
eq("details: deferred, no tokens", [dd[2].tokens, dd[2].mcpCount, dd[2].items.map((x) => [x.name, x.tag])], [null, 1, [["a", "x"], ["Monitor", null]]]);
eq("details: agents without the built-in", [dd[3].items.map((x) => x.name), dd[3].builtIn], [["mine"], 1]);
eq("details: memory and skills", [dd[4].items[0], dd[5].listed, dd[5].total, dd[5].items.map((x) => x.name)],
  [{ name: "/h/.claude/CLAUDE.md", tag: "User", tokens: 50 }, 2, 3, ["a", "b"]]);
eq("details: skills and agents at their rate", [dd[5].items.map((x) => x.tokens), dd[3].items[0].tokens], [[20, 10], 10]);
eq("details: nothing", details({ shape: null, lists: emptyLists() }), []);

// 4d. mergeLists: an overlay sets and removes over the state, its reset starts over; a compaction (the
// read's reset) clears the snapshots too; the built-in agents add up.
const prev = { ...emptyLists(), skills: { count: 1, entries: [] }, agents: { a: 1, b: 2 }, builtIn: ["X"], deferred: { d1: 1 } };
const ov = (set = {}, removed = [], reset = false) => ({ reset, set, removed });
eq("mergeLists: overlay", mergeLists(prev, { reset: false, skills: null, memory: null, agents: { ...ov({ c: 3 }, ["a"]), builtIn: ["Y"] }, mcpInstructions: ov(), deferred: ov({}, ["d1"]) }),
  { skills: { count: 1, entries: [] }, memory: null, agents: { b: 2, c: 3 }, builtIn: ["X", "Y"], mcpInstructions: {}, deferred: {} });
eq("mergeLists: isInitial", mergeLists(prev, { reset: false, skills: null, memory: null, agents: { ...ov({ z: 1 }, [], true), builtIn: ["Y"] }, mcpInstructions: ov(), deferred: ov() }).agents, { z: 1 });
eq("mergeLists: a compaction", mergeLists(prev, { reset: true, skills: null, memory: null, agents: { ...ov({}, [], true), builtIn: [] }, mcpInstructions: ov({}, [], true), deferred: ov({}, [], true) }), emptyLists());

// 5. The curve: at most n points, each its bucket's highest, labelled by its first call.
const turns = Array.from({ length: 10 }, (_, i) => ({ id: i, tokens: i === 4 ? 999 : i }));
eq("curve buckets", curve(turns, 5), { values: [1, 3, 999, 7, 9], labels: ["1", "3", "5", "7", "9"] });
eq("curve short", curve(turns.slice(0, 3), 80), { values: [0, 1, 2], labels: ["1", "2", "3"] });
eq("curve empty", curve([], 80), { values: [], labels: [] });
eq("empty state", emptyState("/p"), { path: "/p", offset: 0, turns: [], compactions: [], shape: null, lists: emptyLists() });

// 6. The context now: the status line's last call, unless a compaction came after it (seen for real: an
// auto compaction at 10:08 after the last call at 09:13, the line still at 350 k and ctx_pct 0).
const lineOf = (n, pct) => ({ window: 1_000_000, ctx_pct: pct, input_tokens: 2, cache_read_input_tokens: n - 2, cache_creation_input_tokens: 0 });
const st = (turnAt, cutAt) => ({ turns: [{ id: "a", at: turnAt, tokens: 350187 }], compactions: cutAt ? [{ at: cutAt, trigger: "auto", pre: 350831, post: 36891 }] : [] });
eq("current from line", current(st("2026-11-19T09:13:39Z"), lineOf(350187, 35)), { tokens: 350187, pct: 35, window: 1_000_000, compacted: null });
eq("current after compaction", current(st("2026-11-19T09:13:39Z", "2026-11-19T10:08:31Z"), lineOf(350187, 0)),
  { tokens: 36891, pct: 4, window: 1_000_000, compacted: "2026-11-19T10:08:31Z" });
eq("compaction before the call", current(st("2026-11-19T10:09:00Z", "2026-11-19T10:08:31Z"), lineOf(350187, 35)).compacted, null);
eq("no line, last call, 1M", current(st("2026-11-19T09:13:39Z"), null), { tokens: 350187, pct: 35, window: 1_000_000, compacted: null });
eq("nothing", current(null, { ctx_pct: 12, window: 200000 }), { tokens: 0, pct: 12, window: 200000, compacted: null });

// 7. Read by chunks (cold review 2, point 11; ctx-index.ts reads 1 MiB at a time): a line longer than two
// chunks, lines across the chunks' edges, a line still being written at the end. And the memory: read
// whole, this ~66 MB transcript peaked at 194 MB (its bytes, its text and its lines at once); by chunks, 78.
{
  const dir = mkdtempSync(join(tmpdir(), "kt-context-big-"));
  const big = join(dir, "big.jsonl");
  const partial = '{"type":"assistant","mess';
  try {
    const filler = line({ type: "user", timestamp: "2026-11-19T12:00:00Z", message: { content: "z".repeat(4000) } });
    writeFileSync(big, filler.repeat(8000) + line(call("L", "2026-11-19T12:00:01Z", 1, 2, 3, { blob: "x".repeat(2_500_000) }))
      + line(call("A", "2026-11-19T12:00:02Z", 1, 10, 100))
      + line({ type: "system", subtype: "compact_boundary", timestamp: "2026-11-19T12:00:02Z", compactMetadata: { trigger: "manual", preTokens: 111, postTokens: 9 } })
      + filler.repeat(8000) + line(call("B", "2026-11-19T12:00:03Z", 1, 10, 200)) + partial);
    const size = Bun.file(big).size;
    const r = Bun.spawnSync([process.execPath, INDEX, big]);
    const out = JSON.parse(r.stdout.toString());
    eq("chunks: every call", out.turns.map((x) => [x.id, x.tokens]), [["L", 6], ["A", 111], ["B", 211]]);
    // Once: calls are kept by id, a compaction isn't, so bytes read twice (a chunk of the long line kept
    // without copying it, the buffer reused under it) show here.
    eq("chunks: the compaction once", out.compactions.map((c) => c.post), [9]);
    eq("chunks: the partial line waits", out.offset, size - partial.length);
    const mb = Math.round(r.resourceUsage.maxRSS / 1e6);
    eq(`chunks: peak memory under the file's size + 48 MB (${mb} MB for ${Math.round(size / 1e6)} MB)`, r.resourceUsage.maxRSS < size + 48e6, true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// 8. A session id goes into a path (main.js bySession): a UUID's characters only (cold review 2, point 12).
eq("session id", sessionId("665f5244-2fd6-4059-8db9-050182eeedc3"), "665f5244-2fd6-4059-8db9-050182eeedc3");
for (const bad of ["../../etc/passwd", "a/b", "*", "x y", "", "$(id)", "abc\n", "a\nb", null, 42]) eq(`session id refused: ${JSON.stringify(bad)}`, sessionId(bad), null);

// 9. A call that consulted an advisor mid-call (seen for real, 2026-11-19: the curve peaked at 1,9 M on a 1 M
// window): its top-level usage sums its iterations; its context is the last "message" iteration's.
{
  const dir = mkdtempSync(join(tmpdir(), "kt-context-iter-"));
  const f = join(dir, "s.jsonl");
  try {
    const it = (type, input, created, cached) => ({ type, input_tokens: input, cache_creation_input_tokens: created, cache_read_input_tokens: cached, output_tokens: 9 });
    const advised = call("V", "2026-11-19T13:00:00Z", 4, 10767, 1110367);
    advised.message.usage.iterations = [it("message", 2, 6073, 552147), it("advisor_message", 561813, 0, 0), it("message", 2, 4694, 558220)];
    const onlyAdvisor = call("W", "2026-11-19T13:01:00Z", 5, 6, 7);
    onlyAdvisor.message.usage.iterations = [it("advisor_message", 900000, 0, 0)];
    writeFileSync(f, line(advised) + line(onlyAdvisor) + line(call("P", "2026-11-19T13:02:00Z", 1, 2, 3)));
    eq("iterations: the last message's", read(f).turns.map((x) => [x.id, x.tokens]), [["V", 562916], ["W", 18], ["P", 6]]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  // The status line carries the top-level sum: the transcript's call wins.
  eq("current: the call over the line", current({ turns: [{ id: "V", at: "2026-11-19T13:00:00Z", tokens: 562916 }], compactions: [] }, lineOf(1121138, 56)).tokens, 562916);
}

// 10. The lists from the transcript's attachments (#91, /context's lists), in three reads: their lengths
// only, the deltas as overlays over the state, a compaction starting them over; the session's own
// attachment (an e-mail) is never parsed, even holding a "usage".
{
  const dir = mkdtempSync(join(tmpdir(), "kt-context-lists-"));
  const f = join(dir, "s.jsonl");
  const att = (attachment) => line({ type: "attachment", timestamp: "2026-11-19T14:00:00Z", attachment });
  try {
    writeFileSync(f, att({ type: "instructions", files: [{ path: "/h/.claude/CLAUDE.md", type: "User", content: "x".repeat(120) }, { path: "/h/m/MEMORY.md", type: "AutoMem", content: "y".repeat(40) }] })
      + att({ type: "skill_listing", content: "- alpha: does a\n- beta: does b, longer", skillCount: 3, isInitial: true, names: ["alpha", "beta"] })
      + att({ type: "agent_listing_delta", addedTypes: ["Explore", "mine"], addedLines: ["- Explore: x", "- mine: abcdef"], builtInTypes: ["Explore"], removedTypes: [], isInitial: true })
      + att({ type: "mcp_instructions_delta", addedNames: ["tavily"], addedBlocks: ["z".repeat(80)], removedNames: [] })
      + att({ type: "deferred_tools_delta", addedNames: ["mcp__x__a", "Monitor"], addedLines: ["mcp__x__a", "Monitor: watch"], removedNames: [], readdedNames: [] })
      + line({ type: "assistant", attachment: { type: "session_context", context: { userEmail: "someone@example.com" } }, message: { id: "S", usage: { input_tokens: 5, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 } } })
      + line(call("q1", "2026-11-19T14:00:01Z", 1, 10, 100)));
    const r1 = read(f);
    eq("lists: no session_context", r1.turns.map((x) => x.id), ["q1"]);
    eq("lists: memory, lengths only", r1.lists.memory, [{ path: "/h/.claude/CLAUDE.md", type: "User", chars: 120 }, { path: "/h/m/MEMORY.md", type: "AutoMem", chars: 40 }]);
    eq("lists: skills", r1.lists.skills, { count: 3, entries: [{ name: "alpha", chars: 15 }, { name: "beta", chars: 22 }] });
    eq("lists: no text kept", JSON.stringify(r1.lists).includes("does a") || JSON.stringify(r1.lists).includes("xxxx"), false);
    const s1 = merge(null, f, r1);
    eq("lists: state", [s1.lists.agents, s1.lists.builtIn, s1.lists.mcpInstructions, s1.lists.deferred], [{ Explore: 12, mine: 14 }, ["Explore"], { tavily: 80 }, { mcp__x__a: 9, Monitor: 14 }]);
    // 2: a delta removes, another adds: over the state.
    appendFileSync(f, att({ type: "agent_listing_delta", addedTypes: ["other"], addedLines: ["- other: q"], builtInTypes: [], removedTypes: ["mine"] })
      + att({ type: "deferred_tools_delta", addedNames: [], addedLines: [], removedNames: ["Monitor"], readdedNames: [] }));
    const s2a = merge(s1, f, read(f, s1.offset));
    eq("lists: overlay", [s2a.lists.agents, s2a.lists.deferred, s2a.lists.memory.length, s2a.lists.skills.count], [{ Explore: 12, other: 10 }, { mcp__x__a: 9 }, 2, 3]);
    // 2b: the agents' listing sent whole again (isInitial), no compaction: it replaces theirs, nothing else.
    appendFileSync(f, att({ type: "agent_listing_delta", addedTypes: ["Explore", "z"], addedLines: ["- Explore: x", "- z: zz"], builtInTypes: ["Explore"], removedTypes: [], isInitial: true }));
    const s2 = merge(s2a, f, read(f, s2a.offset));
    eq("lists: isInitial replaces the agents", [s2.lists.agents, s2.lists.deferred], [{ Explore: 12, z: 7 }, { mcp__x__a: 9 }]);
    // 3: a compaction, then a new skill listing: everything else starts over (empty until re-sent).
    appendFileSync(f, line({ type: "system", subtype: "compact_boundary", timestamp: "2026-11-19T15:00:00Z", compactMetadata: { trigger: "auto", preTokens: 967000, postTokens: 50000 } })
      + att({ type: "skill_listing", content: "- gamma: g", skillCount: 1, isInitial: true, names: ["gamma"] }));
    const s3 = merge(s2, f, read(f, s2.offset));
    eq("lists: a compaction starts over", s3.lists, { ...emptyLists(), skills: { count: 1, entries: [{ name: "gamma", chars: 10 }] } });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

if (fails) { console.error(`${fails} failure(s)`); process.exit(1); }
console.log("ok");
