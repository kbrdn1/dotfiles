// bun chat-index.ts <session.jsonl> [--from N] [--to N] [--last-turns K] [--budget CHARS] [--max-entries M]
//
// Reads a Claude Code transcript from byte N (never `tail`: nix's gives one line on these files)
// and prints { path, session, from, start, end, size, more, entries, meta } on stdout:
// - `end` is the byte after the last complete line before --to: the line being written waits
//   for the next call, and `--from end` always lands on a line start;
// - heavy lines (api-request*, file-history-*, most attachments) are skipped on their head,
//   before JSON.parse;
// - entries are normalized and trimmed (Edit: structuredPatch only, never originalFile; Read:
//   path and line counts, never the content; images: a count, never base64);
// - only the last K turns are emitted, within the budget (characters of JSON, and entries):
//   `start` is where the emitted part
//   begins (a line start), `more` says there is something before it (`--to start` reads it).
// A --from past the end of the file (a file rewritten) starts again from 0.
import { toolKind, toolTitle, classify } from "./chat-model.js";

const HEAVY = /^\{"type":"(api-request|file-history|session-owner|bridge-session|atis-latch|tools-used|frame-link|last-prompt)/;
const ATTACHMENT = /"attachment":\{"type":"([a-z_]+)"/;
const KEPT_ATTACHMENTS = new Set(["queued_command", "file"]);

const cap = (s: unknown, n: number) => {
  const str = typeof s === "string" ? s : "";
  return str.length > n ? str.slice(0, n) + "…" : str;
};
const tailCap = (s: unknown, n: number) => {
  const str = typeof s === "string" ? s : "";
  return str.length > n ? "…" + str.slice(str.length - n) : str;
};
const ANSI = /\x1b\[[0-9;?]*[A-Za-z]/g;

type Entry = Record<string, any>;
type Meta = Record<string, any>;

/** Text of a message content: a string, or its text parts joined; images counted, never kept. */
function textOf(content: any): { text: string; images: number } {
  if (typeof content === "string") return { text: content, images: 0 };
  if (!Array.isArray(content)) return { text: "", images: 0 };
  let text = "";
  let images = 0;
  for (const p of content) {
    if (p?.type === "text" && typeof p.text === "string") text += (text ? "\n" : "") + p.text;
    else if (p?.type === "image") images++;
  }
  return { text, images };
}

/** <tag ...>inner</tag> around a whole message (peer, teammate, agent): its sender and inner text. */
/** classify()'s answer as an entry's `from` (no text: it stays the entry's own). */
function fromOf(c: any): Entry {
  if (c.kind === "task") return { kind: "task", status: c.status ?? null };
  if (c.kind === "system") return { kind: "system" };
  return { kind: c.kind, name: c.name ?? "", color: c.color ?? null, summary: c.summary ?? null, count: c.count ?? 1 };
}

/**
 * What a message sent by `hc send` and a paste come wrapped in, seen in transcripts (2026-11-19):
 * `<hc from="t1">…</hc>` around the text, `<pasted_content id="x">…</pasted_content id="x">` around a
 * pasted part (a text of several lines sent by hc). Off, the text inside kept, blank lines at the ends
 * dropped.
 */
export function strip(text: string): string {
  let s = text.replace(/<pasted_content id="([^"]*)">\n?([\s\S]*?)\n?<\/pasted_content id="\1">/g, "$2");
  const hc = s.match(/^\s*<hc(?:\s[^>]*)?>([\s\S]*?)<\/hc>\s*$/);
  if (hc) s = hc[1];
  return s.replace(/^\n+|\n+$/g, "");
}

const tag = (text: string, name: string) => text.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`))?.[1]?.trim();

/**
 * Does this user line open a turn? Lines that open one carry `turnPosition` (Claude Code
 * 2.1.3xx: prompts, peers, teammates, task-notifications); a compaction summary carries it too
 * but continues the turn. Older lines without it: a user message that is not injected (isMeta),
 * not tool results, not an interruption, not a command's output.
 */
export function startsTurn(o: any, text: string): boolean {
  if (o.type !== "user" || o.isCompactSummary || o.isSidechain) return false;
  if (o.turnPosition) return true;
  if (o.isMeta) return false;
  const c = o.message?.content;
  if (Array.isArray(c) && c.some((p: any) => p?.type === "tool_result")) return false;
  return !/^\s*(\[Request interrupted by user|<local-command-std|<bash-std)/.test(text);
}

function slimInput(name: string, i: any): Entry {
  if (!i || typeof i !== "object") return {};
  switch (toolKind(name)) {
    case "execute":
      return { command: cap(i.command, 4000), description: cap(i.description, 300), background: !!i.run_in_background };
    case "edit":
      return { path: i.file_path ?? i.notebook_path, replaceAll: !!i.replace_all, chars: typeof i.content === "string" ? i.content.length : undefined };
    case "read":
      return { path: i.file_path ?? i.notebook_path ?? i.path, offset: i.offset, limit: i.limit };
    case "search":
      return { pattern: cap(i.pattern ?? i.query, 500), path: i.path, glob: i.glob, type: i.type, mode: i.output_mode };
    case "agent":
      return { description: cap(i.description, 300), type: i.subagent_type, name: i.name, prompt: cap(i.prompt, 1000) };
    case "skill":
      return { skill: i.skill, args: cap(i.args, 500) };
    case "tasks":
      return Array.isArray(i.todos) ? { todos: i.todos.slice(0, 50).map((t: any) => ({ text: cap(t.content ?? t.subject, 200), status: t.status })) } : { json: cap(JSON.stringify(i), 600) };
  }
  return { json: cap(JSON.stringify(i), 1000) };
}

/** A structuredPatch capped to `max` lines in all. */
function slimPatch(patch: any[], max = 200): Entry[] {
  const out: Entry[] = [];
  let left = max;
  for (const h of patch ?? []) {
    if (left <= 0) break;
    const lines = Array.isArray(h.lines) ? h.lines.slice(0, left) : [];
    left -= lines.length;
    out.push({ oldStart: h.oldStart, oldLines: h.oldLines, newStart: h.newStart, newLines: h.newLines, lines: lines.map((l: string) => cap(l, 400)), cut: lines.length < (h.lines?.length ?? 0) });
  }
  return out;
}

function result(part: any, tur: any, o: any, off: number, at: number | null): Entry {
  const { text: content, images } = textOf(part.content);
  const e: Entry = { k: "result", o: off, tool: part.tool_use_id, at, ok: !part.is_error, size: content.length };
  if (images) e.images = images;
  if (typeof tur === "string" || tur == null || typeof tur !== "object") {
    e.text = cap(typeof tur === "string" && tur ? tur : content, 2000);
  } else if ("stdout" in tur || "stderr" in tur) {
    const out = String(tur.stdout ?? "").replace(ANSI, "");
    const err = String(tur.stderr ?? "").replace(ANSI, "");
    e.text = tailCap(out, 3000) + (err ? (out ? "\n" : "") + tailCap(err, 1500) : "");
    e.size = out.length + err.length;
    if (tur.interrupted) e.interrupted = true;
    if (tur.backgroundTaskId) e.background = true;
  } else if (Array.isArray(tur.structuredPatch)) {
    e.path = tur.filePath;
    e.diff = slimPatch(tur.structuredPatch);
    if (tur.type === "create") {
      e.create = true;
      e.lines = typeof tur.content === "string" ? tur.content.split("\n").length : 0;
    }
    e.text = "";
  } else if (tur.file && typeof tur.file === "object") {
    e.file = tur.type === "image"
      ? { path: tur.file.filePath ?? null, image: true }
      : { path: tur.file.filePath, lines: tur.file.numLines, start: tur.file.startLine, total: tur.file.totalLines };
    e.text = "";
  } else if (tur.agentId || tur.agent_id) {
    e.agent = {
      id: tur.agentId ?? tur.agent_id,
      name: tur.name ?? tur.description ?? null,
      type: tur.agent_type ?? null,
      color: tur.color ?? null,
      model: tur.resolvedModel ?? tur.model ?? null,
      status: tur.status ?? null,
      async: !!tur.isAsync,
    };
    e.text = cap(content, 4000);
  } else {
    e.text = cap(content, 2000);
  }
  return e;
}

/** One JSONL line → 0..n entries (a user line can carry several tool results). */
export function normalize(o: any, off: number, meta: Meta, home: string): Entry[] {
  if (o.isSidechain) return [];
  const at = Date.parse(o.timestamp) || null;
  if (o.sessionId && !meta.session) meta.session = o.sessionId;
  if (o.cwd) meta.cwd = o.cwd;
  switch (o.type) {
    case "ai-title":
      meta.title = o.aiTitle ?? meta.title;
      return [];
    case "permission-mode":
      meta.permission = o.permissionMode;
      return [];
    case "mode":
      meta.mode = o.mode;
      return [];
    case "pr-link":
      meta.pr = { number: o.prNumber, repo: o.prRepository, url: o.prUrl };
      return [];
    case "assistant": {
      if (o.isApiErrorMessage) {
        return [{ k: "notice", o: off, uuid: o.uuid, at, kind: "error", code: o.error ?? null, text: cap(textOf(o.message?.content).text, 1000) }];
      }
      const blocks: Entry[] = [];
      const extra: Entry[] = [];
      for (const b of o.message?.content ?? []) {
        if (b.type === "text") blocks.push({ t: "text", text: cap(b.text, 40000) });
        else if (b.type === "thinking" || b.type === "redacted_thinking") blocks.push({ t: "thinking", ms: o.thinkingDurationMs ?? null, text: cap(b.thinking, 4000) });
        else if (b.type === "tool_use" || b.type === "server_tool_use") {
          blocks.push({ t: "tool", id: b.id, name: b.name, kind: toolKind(b.name), title: toolTitle(b.name, b.input, o.cwd, home), input: slimInput(b.name, b.input) });
        } else if (b.tool_use_id) {
          const t = b.content?.text ?? (typeof b.content === "string" ? b.content : "");
          extra.push({ k: "result", o: off, tool: b.tool_use_id, at, ok: !b.is_error && !b.content?.error_code, text: cap(t, 2000), size: String(t).length });
        }
      }
      const out: Entry[] = blocks.length ? [{ k: "assistant", o: off, uuid: o.uuid, mid: o.message?.id ?? o.uuid, at, model: o.message?.model ?? null, blocks }] : [];
      return out.concat(extra);
    }
    case "user": {
      const content = o.message?.content;
      const out: Entry[] = [];
      if (Array.isArray(content)) {
        const results = content.filter((p: any) => p?.type === "tool_result");
        for (const p of results) out.push(result(p, results.length === 1 ? o.toolUseResult : null, o, off, at));
      }
      let { text, images } = textOf(content);
      if (o.isCompactSummary) return out.concat({ k: "notice", o: off, uuid: o.uuid, at, kind: "summary", text: cap(text, 8000) });
      if (/^\s*\[Request interrupted by user/.test(text)) return out.concat({ k: "notice", o: off, uuid: o.uuid, at, kind: "interrupt" });
      if (/^\s*<(local-command-stdout|local-command-stderr|bash-stdout|bash-stderr)>/.test(text)) {
        const body = ["local-command-stdout", "local-command-stderr", "bash-stdout", "bash-stderr"].map((t) => tag(text, t)).filter(Boolean).join("\n");
        return out.concat({ k: "notice", o: off, uuid: o.uuid, at, kind: "command", text: cap(body.replace(ANSI, ""), 2000) });
      }
      const turn = startsTurn(o, text);
      if (!text.trim() && !images) return out;
      if (o.isMeta && !turn) return out;
      const e: Entry = { k: "user", o: off, uuid: o.uuid, at, turn, text: "" };
      if (images) e.images = images;
      if (o.isMeta) e.meta = true;
      const cmd = /^\s*<command-(name|message)>/.test(text) ? tag(text, "command-name") : undefined;
      const bash = /^\s*<bash-input>/.test(text) ? tag(text, "bash-input") : undefined;
      if (cmd) e.cmd = { name: cmd, args: cap(tag(text, "command-args") ?? "", 2000) };
      else if (bash) e.cmd = { name: "!", args: cap(bash, 2000) };
      else {
        // Who speaks (chat-model.js classify): only « human » is Kylian's; the rest is shown folded.
        const c = classify(strip(text), o.origin);
        if (c.kind !== "human") e.from = fromOf(c);
        e.text = cap(c.text, 20000);
      }
      return out.concat(e);
    }
    case "system":
      if (o.subtype === "turn_duration") return [{ k: "notice", o: off, uuid: o.uuid, at, kind: "duration", ms: o.durationMs ?? null }];
      if (o.subtype === "compact_boundary") return [{ k: "notice", o: off, uuid: o.uuid, at, kind: "compact", trigger: o.compactMetadata?.trigger ?? null, tokens: o.compactMetadata?.preTokens ?? null }];
      if (o.subtype === "local_command") {
        const t = String(o.content ?? "");
        const body = tag(t, "local-command-stdout") ?? tag(t, "local-command-stderr") ?? "";
        return body ? [{ k: "notice", o: off, uuid: o.uuid, at, kind: "command", text: cap(body.replace(ANSI, ""), 2000) }] : [];
      }
      return [];
    case "queue-operation": {
      const t = typeof o.content === "string" ? o.content : null;
      const task = !!t && /^\s*<task-notification>/.test(t);
      return [{ k: "queue", o: off, at, op: o.operation, text: task || t == null ? null : cap(strip(t), 2000), task }];
    }
    case "attachment": {
      const a = o.attachment ?? {};
      if (a.type === "file") return a.displayPath || a.filename ? [{ k: "file", o: off, at, path: a.displayPath ?? a.filename }] : [];
      if (a.type !== "queued_command") return [];
      const { text } = textOf(a.prompt);
      if (a.commandMode === "task-notification" || /^\s*<task-notification>/.test(text)) {
        return [{ k: "notice", o: off, uuid: o.uuid, at, kind: "task", status: tag(text, "status") ?? null, text: cap(tag(text, "summary") ?? "", 2000) }];
      }
      if (a.isMeta || !text.trim()) return [];
      const c = classify(strip(text), a.origin);
      if (c.kind === "system") return [];
      return [{ k: "user", o: off, uuid: o.uuid, at, turn: false, text: cap(c.text, 20000), ...(c.kind !== "human" ? { from: fromOf(c) } : {}) }];
    }
  }
  return [];
}

export type Options = { from?: number; size?: number; lastTurns?: number; budget?: number; maxEntries?: number; home?: string; path?: string };

/**
 * The pure core. `bytes` is the part of the file to read, starting at byte `from` of a file of
 * `size` bytes (the CLI slices it; a test can pass any cut). Offsets in the output are absolute.
 */
export function index(bytes: Uint8Array, opts: Options = {}) {
  const from = opts.from ?? 0;
  const size = opts.size ?? from + bytes.length;
  const lastTurns = opts.lastTurns ?? 30;
  // Measured in the mod engine (herdr-app check, synthetic output): JSON.parse + build() take
  // ~17 ms for 930 entries / 670 KB, ~40 ms for 1890 / 750 KB, and a call has ~50 ms.
  const budget = opts.budget ?? 600_000;
  const maxEntries = opts.maxEntries ?? 1000;
  const dec = new TextDecoder();
  const meta: Meta = {};
  const entries: Entry[] = [];
  let pos = 0;
  let skipped = 0;
  let bad = 0;
  for (;;) {
    const nl = bytes.indexOf(10, pos);
    if (nl < 0) break;
    const line = bytes.subarray(pos, nl);
    const off = from + pos;
    pos = nl + 1;
    if (line.length < 2) continue;
    const head = dec.decode(line.subarray(0, 200));
    const att = head.match(ATTACHMENT);
    if (HEAVY.test(head) || (att && !KEPT_ATTACHMENTS.has(att[1]))) {
      skipped++;
      continue;
    }
    let o: any;
    try {
      o = JSON.parse(dec.decode(line));
    } catch {
      bad++;
      continue;
    }
    for (const e of normalize(o, off, meta, opts.home ?? "")) entries.push(e);
  }
  const end = from + pos;

  // Keep the last K turns within the budget. A cut always falls on a line start, with every
  // entry of that line; no cut means everything from `from`.
  let first = entries.length;
  let turns = 0;
  let spent = 0;
  let cut = false;
  for (let i = entries.length - 1; i >= 0; i--) {
    spent += JSON.stringify(entries[i]).length;
    if ((spent > budget || entries.length - i > maxEntries) && first < entries.length) {
      cut = true;
      break;
    }
    first = i;
    if (entries[i].k === "user" && entries[i].turn && ++turns >= lastTurns) {
      cut = i > 0;
      break;
    }
  }
  while (cut && first > 0 && entries[first - 1].o === entries[first].o) first--;
  const start = cut ? entries[first].o : from;
  const { session, ...rest } = meta;
  return { path: opts.path ?? null, session: session ?? null, from, start, end, size, more: start > from, entries: entries.slice(first), meta: rest, skipped, bad };
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const path = args.find((a, i) => !a.startsWith("--") && !args[i - 1]?.startsWith("--"));
  const num = (flag: string) => {
    const i = args.indexOf(flag);
    return i >= 0 ? Number(args[i + 1]) : undefined;
  };
  if (!path) {
    console.log(JSON.stringify({ error: "usage" }));
    process.exit(2);
  }
  const file = Bun.file(path);
  if (!(await file.exists())) {
    console.log(JSON.stringify({ error: "missing", path }));
    process.exit(0);
  }
  const size = file.size;
  let from = Math.max(0, num("--from") ?? 0);
  if (from > size) from = 0;
  const to = Math.min(size, num("--to") ?? size);
  const bytes = new Uint8Array(await file.slice(from, Math.max(from, to)).arrayBuffer());
  const out = index(bytes, { from, size, lastTurns: num("--last-turns"), budget: num("--budget"), maxEntries: num("--max-entries"), home: process.env.HOME ?? "", path });
  process.stdout.write(JSON.stringify(out));
}
