// kt-context's reader (#91): a Claude Code transcript (JSONL) read from a byte offset, the context per
// call, the compactions and the request's last shape, as one compact JSON on stdout. Run by kt-context
// through exec, like kt-chat's chat-index.ts: a transcript is soon past readTextFile's 1 MiB.
//   bun ctx-index.ts <transcript.jsonl> [--from <byte offset>]
// Out: { from, size, offset, turns: [{ id, at, tokens }], compactions: [{ at, trigger, pre, post }],
//        shape: { system, tools, mcp: { <server>: chars }, mcpTools: { <tool>: chars } } | null, lists }
// - from: where this read started (0 when the file is shorter than --from: rewritten, read whole).
// - turns: one per API call (assistant line with message.usage), its context = input + cache creation +
//   cache read tokens (its last iteration's when it has `iterations`); a call written in several lines (one
//   per content block) keeps one entry, the last.
//   Sidechain lines (a sub-agent's) are left out: they aren't this context.
// - compactions: `system` lines of subtype `compact_boundary` (trigger auto / manual, tokens before, after).
// - shape: the last `api-request-shape` line (written when the request's shape changes), measured in
//   characters: the system prompt's blocks, the built-in tools, the MCP tools by server (mcp__<server>__…).
//   Characters, not tokens: no tokenizer here, the mod estimates and says so. Absent in this delta: null.
// - lists (#91, /context's lists): what the context carries since the last compaction of this read (a
//   compaction re-sends every listing), from the transcript's attachments, as LENGTHS only (never their
//   text): the memory files (`instructions`: path, type, chars), the skills (`skill_listing`: count, each
//   entry's name and chars), and three deltas as overlays on the state before this read (model.js
//   mergeLists): the agents (`agent_listing_delta`, the built-in ones apart), the MCP servers'
//   instructions (`mcp_instructions_delta`), the deferred tools (`deferred_tools_delta`, outside the
//   window). `reset`: a compaction in this read, the lists start over from it; an overlay's own `reset`:
//   its listing's isInitial. The session's own attachment (`session_context`: an e-mail) is never parsed.
// - offset: where the next read starts, after the last complete line (a line being written waits).
// Reads only; nothing is sent anywhere.

import { open } from "node:fs/promises";

const args = process.argv.slice(2);
const path = args[0];
const fromAt = args.indexOf("--from");
let from = fromAt >= 0 ? Math.max(0, Number(args[fromAt + 1]) || 0) : 0;

// An overlay: what a delta listing set (name -> chars) and removed, over the state before this read.
const overlay = (reset = false) => ({ reset, set: {} as Record<string, number>, removed: [] as string[] });
const freshLists = (reset = false) => ({ reset, skills: null, memory: null, agents: { ...overlay(reset), builtIn: [] as string[] }, mcpInstructions: overlay(reset), deferred: overlay(reset) });
const out = { from: 0, size: 0, offset: 0, turns: [], compactions: [], shape: null, lists: freshLists() };
const file = path ? Bun.file(path) : null;
if (!file || !(await file.exists())) {
  console.log(JSON.stringify(out));
  process.exit(0);
}
const size = file.size;
if (from > size) from = 0; // a new or rewritten file: from the start
out.from = from;
out.size = size;

const byId = new Map();
const chars = (v) => (typeof v === "string" ? v.length : JSON.stringify(v ?? "").length);
// Only lines holding one of these are parsed: a substring test, whatever the keys' order. An attachment's
// raw line reads `"attachment":{"type":"<type>"` (its quotes unescaped: never text quoting one).
const ATT = (type: string) => `"attachment":{"type":"${type}"`;
const WANTED = ['"usage"', '"compact_boundary"', '"api-request-shape"',
  ATT("instructions"), ATT("skill_listing"), ATT("agent_listing_delta"), ATT("mcp_instructions_delta"), ATT("deferred_tools_delta")];
const PRIVATE = ATT("session_context"); // the account's e-mail: never parsed
// A delta's names into its overlay: set (with its line's chars) or removed, the last one winning.
const put = (o, name, n) => { o.set[name] = n; o.removed = o.removed.filter((x) => x !== name); };
const drop = (o, name) => { delete o.set[name]; if (!o.removed.includes(name)) o.removed.push(name); };
function attachment(a) {
  const L = out.lists; // a compaction replaces it: read it here, never kept
  if (a.type === "instructions") {
    L.memory = (a.files ?? []).map((f) => ({ path: String(f?.path ?? ""), type: String(f?.type ?? ""), chars: chars(f?.content ?? "") }));
  } else if (a.type === "skill_listing") {
    // One entry a skill, « - name: description », the listing's own order.
    const parts = String(a.content ?? "").split(/\n(?=- )/).filter(Boolean);
    L.skills = { count: Number(a.skillCount) || parts.length, entries: parts.map((s, i) => ({ name: String(a.names?.[i] ?? /^- ([^:\n]+)/.exec(s)?.[1] ?? "").trim(), chars: s.length })) };
  } else if (a.type === "agent_listing_delta") {
    if (a.isInitial) L.agents = { ...overlay(true), builtIn: [] };
    for (const t of a.builtInTypes ?? []) if (!L.agents.builtIn.includes(t)) L.agents.builtIn.push(t);
    (a.addedTypes ?? []).forEach((t, i) => put(L.agents, t, chars(a.addedLines?.[i] ?? "")));
    for (const t of a.removedTypes ?? []) drop(L.agents, t);
  } else if (a.type === "mcp_instructions_delta") {
    (a.addedNames ?? []).forEach((n, i) => put(L.mcpInstructions, n, chars(a.addedBlocks?.[i] ?? "")));
    for (const n of a.removedNames ?? []) drop(L.mcpInstructions, n);
  } else if (a.type === "deferred_tools_delta") {
    (a.addedNames ?? []).forEach((n, i) => put(L.deferred, n, chars(a.addedLines?.[i] ?? "")));
    for (const n of a.readdedNames ?? []) put(L.deferred, n, L.deferred.set[n] ?? 0);
    for (const n of a.removedNames ?? []) drop(L.deferred, n);
  }
}
function take(line: string) {
  if (!line || line.includes(PRIVATE) || !WANTED.some((w) => line.includes(w))) return;
  let e;
  try { e = JSON.parse(line); } catch { return; }
  if (e?.isSidechain === true) return;
  if (e?.type === "attachment" && e.attachment) return attachment(e.attachment);
  if (e?.type === "assistant" && e.message?.usage) {
    // A call that ran iterations server-side (an advisor consulted mid-call: message, advisor_message,
    // message) sums them in its top-level usage: 552 k + 558 k read showed as 1,1 M on a 1 M window (the
    // Context tab's curve, 2026-11-19). Its context is its last "message" iteration's; the advisor's is
    // another model's.
    const u = (Array.isArray(e.message.usage.iterations) && e.message.usage.iterations.findLast((x) => (x?.type ?? "message") === "message")) || e.message.usage;
    const tokens = (u.input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0);
    if (tokens > 0) byId.set(e.message.id ?? e.uuid, { id: e.message.id ?? e.uuid, at: e.timestamp ?? null, tokens });
  } else if (e?.type === "system" && e.subtype === "compact_boundary") {
    const c = e.compactMetadata ?? {};
    out.compactions.push({ at: e.timestamp ?? null, trigger: c.trigger ?? null, pre: c.preTokens ?? null, post: c.postTokens ?? null });
    out.lists = freshLists(true); // a compaction re-sends every listing: they start over here
  } else if (e?.type === "api-request-shape" && e.shape) {
    const mcp = {}, mcpTools = {};
    let tools = 0;
    for (const tool of e.shape.tools ?? []) {
      const m = /^mcp__(.+?)__/.exec(String(tool?.name ?? ""));
      if (m) { mcp[m[1]] = (mcp[m[1]] ?? 0) + chars(tool); mcpTools[tool.name] = chars(tool); }
      else tools += chars(tool);
    }
    const system = (e.shape.system ?? []).reduce((n, b) => n + chars(b?.text ?? b), 0);
    out.shape = { system, tools, mcp, mcpTools };
  }
}

// By CHUNK into one buffer, never the whole file: read whole, a 287 MB transcript took ~1.2 GB (its bytes
// and their text; cold review 2, point 11). A chunk's complete lines are decoded and read at once; the
// bytes past its last "\n" are copied aside (the buffer is reused) for the next one, a line longer than a
// chunk across several. What follows the file's last "\n" is a line still being written: it waits.
const CHUNK = 1 << 20;
const buf = new Uint8Array(CHUNK);
const decoder = new TextDecoder();
let pending: Uint8Array[] = [];
let at = from;
out.offset = from;
const fh = await open(path, "r");
try {
  while (at < size) {
    const { bytesRead: n } = await fh.read(buf, 0, Math.min(CHUNK, size - at), at);
    if (!n) break;
    const chunk = buf.subarray(0, n);
    const nl = chunk.lastIndexOf(10);
    if (nl < 0) pending.push(chunk.slice());
    else {
      const head = chunk.subarray(0, nl + 1);
      for (const line of decoder.decode(pending.length ? Buffer.concat([...pending, head]) : head).split("\n")) take(line);
      pending = nl + 1 < n ? [chunk.slice(nl + 1)] : [];
      out.offset = at + nl + 1;
    }
    at += n;
  }
} finally {
  await fh.close();
}
out.turns = [...byId.values()];
console.log(JSON.stringify(out));
