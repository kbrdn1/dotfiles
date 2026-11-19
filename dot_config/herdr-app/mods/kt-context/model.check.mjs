// bun mods/kt-context/model.check.mjs: ctx-index.ts and model.js on an invented transcript (no real
// session is read). Each case fails loudly; "ok" at the end.
import { mkdtempSync, writeFileSync, appendFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { merge, breakdown, curve, current, emptyState, sessionId, CHARS_PER_TOKEN } from "./model.js";

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

// 4. The split: estimated from characters, messages the rest of the last call, never below 0.
const shape = { system: 400 * CHARS_PER_TOKEN, tools: 100 * CHARS_PER_TOKEN, mcp: { tolaria: 30 * CHARS_PER_TOKEN, docs: 70 * CHARS_PER_TOKEN } };
eq("breakdown", breakdown(shape, 5000), [
  { key: "system", tokens: 400 }, { key: "tools", tokens: 100 },
  { key: "mcp", tokens: 100, servers: [{ name: "docs", tokens: 70 }, { name: "tolaria", tokens: 30 }] },
  { key: "messages", tokens: 4400 }]);
eq("breakdown no mcp row", breakdown({ system: 4, tools: 4, mcp: {} }, 10).map((r) => r.key), ["system", "tools", "messages"]);
eq("breakdown messages floor", breakdown(shape, 10).at(-1).tokens, 0);
eq("breakdown without shape", breakdown(null, 5000), null);

// 5. The curve: at most n points, each its bucket's highest, labelled by its first call.
const turns = Array.from({ length: 10 }, (_, i) => ({ id: i, tokens: i === 4 ? 999 : i }));
eq("curve buckets", curve(turns, 5), { values: [1, 3, 999, 7, 9], labels: ["1", "3", "5", "7", "9"] });
eq("curve short", curve(turns.slice(0, 3), 80), { values: [0, 1, 2], labels: ["1", "2", "3"] });
eq("curve empty", curve([], 80), { values: [], labels: [] });
eq("empty state", emptyState("/p"), { path: "/p", offset: 0, turns: [], compactions: [], shape: null });

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

if (fails) { console.error(`${fails} failure(s)`); process.exit(1); }
console.log("ok");
