// kt-context's reader (#91): a Claude Code transcript (JSONL) read from a byte offset, the context per
// call, the compactions and the request's last shape, as one compact JSON on stdout. Run by kt-context
// through exec, like kt-chat's chat-index.ts: a transcript is soon past readTextFile's 1 MiB.
//   bun ctx-index.ts <transcript.jsonl> [--from <byte offset>]
// Out: { from, size, offset, turns: [{ id, at, tokens }], compactions: [{ at, trigger, pre, post }],
//        shape: { system, tools, mcp: { <server>: chars } } | null }
// - from: where this read started (0 when the file is shorter than --from: rewritten, read whole).
// - turns: one per API call (assistant line with message.usage), its context = input + cache creation +
//   cache read tokens; a call written in several lines (one per content block) keeps one entry, the last.
//   Sidechain lines (a sub-agent's) are left out: they aren't this context.
// - compactions: `system` lines of subtype `compact_boundary` (trigger auto / manual, tokens before, after).
// - shape: the last `api-request-shape` line (written when the request's shape changes), measured in
//   characters: the system prompt's blocks, the built-in tools, the MCP tools by server (mcp__<server>__…).
//   Characters, not tokens: no tokenizer here, the mod estimates and says so. Absent in this delta: null.
// - offset: where the next read starts, after the last complete line (a line being written waits).
// Reads only; nothing is sent anywhere.

import { open } from "node:fs/promises";

const args = process.argv.slice(2);
const path = args[0];
const fromAt = args.indexOf("--from");
let from = fromAt >= 0 ? Math.max(0, Number(args[fromAt + 1]) || 0) : 0;

const out = { from: 0, size: 0, offset: 0, turns: [], compactions: [], shape: null };
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
// Only lines holding one of these are parsed: a substring test, whatever the keys' order.
const WANTED = ['"usage"', '"compact_boundary"', '"api-request-shape"'];
function take(line: string) {
  if (!line || !WANTED.some((w) => line.includes(w))) return;
  let e;
  try { e = JSON.parse(line); } catch { return; }
  if (e?.isSidechain === true) return;
  if (e?.type === "assistant" && e.message?.usage) {
    const u = e.message.usage;
    const tokens = (u.input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0);
    if (tokens > 0) byId.set(e.message.id ?? e.uuid, { id: e.message.id ?? e.uuid, at: e.timestamp ?? null, tokens });
  } else if (e?.type === "system" && e.subtype === "compact_boundary") {
    const c = e.compactMetadata ?? {};
    out.compactions.push({ at: e.timestamp ?? null, trigger: c.trigger ?? null, pre: c.preTokens ?? null, post: c.postTokens ?? null });
  } else if (e?.type === "api-request-shape" && e.shape) {
    const mcp = {};
    let tools = 0;
    for (const tool of e.shape.tools ?? []) {
      const m = /^mcp__(.+?)__/.exec(String(tool?.name ?? ""));
      if (m) mcp[m[1]] = (mcp[m[1]] ?? 0) + chars(tool);
      else tools += chars(tool);
    }
    const system = (e.shape.system ?? []).reduce((n, b) => n + chars(b?.text ?? b), 0);
    out.shape = { system, tools, mcp };
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
