// bun chat-index.ts <session.jsonl> [--from N] [--to N] [--last-turns K] [--budget CHARS] [--max-entries M]
// bun chat-index.ts <session.jsonl> --tool <tool_use id>   (#79: one call's input, the last 4 MB read)
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
import { existsSync } from "node:fs";
import { toolKind, toolTitle, classify, taskOf } from "./chat-model.js";
import { imagesOf } from "./att-model.js";
import { citesOf } from "./assets.js";

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
  if (c.kind === "task") return { kind: "task", status: c.status ?? null, task: c.task || null };
  if (c.kind === "system") return { kind: "system" };
  return { kind: c.kind, name: c.name ?? "", color: c.color ?? null, summary: c.summary ?? null, count: c.count ?? 1, ...(c.idle ? { idle: true } : {}) };
}

/** An entry's senders when several follow one another in one message (classify's groups), each with its text. */
const groupsOf = (c: any): Entry => (c.groups ? { groups: c.groups.map((g: any) => ({ ...fromOf(g), text: cap(g.text, 8000) })) } : {});

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
export function startsTurn(o: any, text: string, side = false): boolean {
  if (o.type !== "user" || o.isCompactSummary || (o.isSidechain && !side)) return false;
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
  if (images) {
    e.images = images;
    // #93: where each image the tool got back is (a Read of a capture: what the model saw), never its data.
    e.imgs = imagesOf(part.content);
  }
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
export function normalize(o: any, off: number, meta: Meta, home: string, exists: (p: string) => boolean = existsSync, side = false): Entry[] {
  // A sub-agent's lines are sidechain ones: left out of the session's transcript, read in a sub-agent's
  // own file (#58, `side`).
  if (o.isSidechain && !side) return [];
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
        if (b.type === "text") {
          // #93: the files it cites that are on the disk (assets.js citesOf), found here in bun: the view
          // never searches a text nor asks the disk while it draws.
          const cites = citesOf(b.text, o.cwd ?? meta.cwd ?? null, home, exists);
          blocks.push({ t: "text", text: cap(b.text, 40000), ...(cites.length ? { cites } : {}) });
        }
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
      const turn = startsTurn(o, text, side);
      if (!text.trim() && !images) return out;
      if (o.isMeta && !turn) return out;
      const e: Entry = { k: "user", o: off, uuid: o.uuid, at, turn, text: "" };
      if (images) {
        e.images = images;
        // #80: where each image is in this line (its block, media, size, « [Image #N] »), never its data.
        e.imgs = imagesOf(content, o.imagePasteIds);
      }
      if (o.isMeta) e.meta = true;
      const cmd = /^\s*<command-(name|message)>/.test(text) ? tag(text, "command-name") : undefined;
      const bash = /^\s*<bash-input>/.test(text) ? tag(text, "bash-input") : undefined;
      if (cmd) e.cmd = { name: cmd, args: cap(tag(text, "command-args") ?? "", 2000) };
      else if (bash) e.cmd = { name: "!", args: cap(bash, 2000) };
      else {
        // Who speaks (chat-model.js classify): only « human » is Kylian's; the rest is shown folded.
        const c = classify(strip(text), o.origin);
        if (c.kind !== "human") Object.assign(e, { from: fromOf(c) }, groupsOf(c));
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
      // An @-mentioned file: shown as written (displayPath), opened by its absolute path (filename).
      if (a.type === "file") return a.displayPath || a.filename ? [{ k: "file", o: off, at, path: a.displayPath ?? a.filename, ...(a.filename ? { abs: a.filename } : {}) }] : [];
      if (a.type !== "queued_command") return [];
      const { text } = textOf(a.prompt);
      if (a.commandMode === "task-notification" || /^\s*<task-notification>/.test(text)) {
        const tk = taskOf(text);
        return [{ k: "notice", o: off, uuid: o.uuid, at, kind: "task", status: tk.status, task: tk.name || null, text: cap(tk.result, 4000) }];
      }
      if (a.isMeta || !text.trim()) return [];
      const c = classify(strip(text), a.origin);
      if (c.kind === "system") return [];
      return [{ k: "user", o: off, uuid: o.uuid, at, turn: false, text: cap(c.text, 20000), ...(c.kind !== "human" ? { from: fromOf(c), ...groupsOf(c) } : {}) }];
    }
  }
  return [];
}

export type Options = { from?: number; size?: number; lastTurns?: number; budget?: number; maxEntries?: number; home?: string; path?: string; exists?: (p: string) => boolean; tail?: string; side?: boolean };

// #59, a rewind: Claude Code keeps the abandoned branch in the file and writes the new prompt with
// the parentUuid of the message it went back to. Every line of the conversation is a link of that
// chain (assistant, user, attachment, system); a typed prompt whose parent is not the line just before
// it went back: the links between its parent and it are the abandoned branch. A skipped line (an
// attachment not kept) still counts, without parsing it: its parent at its head, its uuid right after
// its attachment object (`…},"type":"attachment","uuid":"…"`, a key the escaped content can't hold).
const PARENT_AT_HEAD = /^\{"parentUuid":(?:null|"([^"]+)")/;
const UUID_KEY = new TextEncoder().encode('"type":"attachment","uuid":"');
function skippedLink(line: Uint8Array, head: string, dec: TextDecoder): [string, string | null] | null {
  const p = head.match(PARENT_AT_HEAD);
  if (!p || /"isSidechain":true/.test(head)) return null;
  const at = Buffer.from(line.buffer, line.byteOffset, line.length).lastIndexOf(UUID_KEY);
  if (at < 0) return null;
  const uuid = dec.decode(line.subarray(at + UUID_KEY.length, at + UUID_KEY.length + 36));
  return /^[0-9a-f-]{36}$/.test(uuid) ? [uuid, p[1] ?? null] : null;
}

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
  // #59, the chain: the last link read (`tail`, the previous read's for a delta), each link's offset in
  // this read, the abandoned branches found ([after, before): offsets, both out), and whether a prompt
  // went back to a link before this read (the caller then reads the whole tail again).
  let prev: string | null = opts.tail ?? null;
  const seen = new Map<string, number>();
  const cuts: [number, number][] = [];
  let rewound = false;
  const link = (uuid: string, parent: string | null, off: number, prompt: boolean) => {
    if (prompt && parent && prev && parent !== prev) {
      const at = seen.get(parent);
      if (at !== undefined) cuts.push([at, off]);
      else rewound = true;
    }
    seen.set(uuid, off);
    prev = uuid;
  };
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
      const l = att ? skippedLink(line, head, dec) : null;
      if (l) link(l[0], l[1], off, false);
      continue;
    }
    let o: any;
    try {
      o = JSON.parse(dec.decode(line));
    } catch {
      bad++;
      continue;
    }
    const got = normalize(o, off, meta, opts.home ?? "", opts.exists, Boolean(opts.side));
    for (const e of got) entries.push(e);
    if (o.uuid && !o.isSidechain) link(o.uuid, o.parentUuid ?? o.logicalParentUuid ?? null, off, got.some((e) => e.k === "user" && e.turn && e.uuid === o.uuid));
  }
  const end = from + pos;
  // The abandoned branches' entries go (a queue operation is the session's, not the branch's).
  if (cuts.length) {
    const kept = entries.filter((e) => e.k === "queue" || !cuts.some(([a, b]) => e.o > a && e.o < b));
    entries.length = 0;
    entries.push(...kept);
  }

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
  return { path: opts.path ?? null, session: session ?? null, from, start, end, size, more: start > from, entries: entries.slice(first), meta: rest, skipped, bad, tail: prev, rewound };
}

/**
 * #79: the tool call `id` as the model wrote it, { name, input, cut } or null, from the transcript's
 * last bytes, the newest line first. A permission is asked for the call just written, so it is near
 * the end. An edit's texts are capped at `max` characters each (`cut` then says so).
 */
export function toolCallOf(bytes: Uint8Array, id: string, max = 32000) {
  const text = new TextDecoder().decode(bytes);
  const needle = `"id":"${id}"`;
  for (let end = text.length; end > 0; ) {
    const start = text.lastIndexOf("\n", end - 1) + 1;
    const line = text.slice(start, end);
    end = start - 1;
    if (!line.includes(needle)) continue;
    let o: any;
    try {
      o = JSON.parse(line);
    } catch {
      continue; // the line cut by the read's start, or one being written
    }
    const b = (o?.message?.content ?? []).find((c: any) => c?.type === "tool_use" && c.id === id);
    if (!b) continue;
    const input = { ...(b.input ?? {}) };
    let cut = false;
    const clip = (s: unknown) => {
      if (typeof s !== "string" || s.length <= max) return s;
      cut = true;
      return s.slice(0, max);
    };
    for (const k of ["old_string", "new_string", "content", "new_source", "command"]) if (k in input) input[k] = clip(input[k]);
    if (Array.isArray(input.edits)) input.edits = input.edits.map((e: any) => ({ ...e, old_string: clip(e?.old_string), new_string: clip(e?.new_string) }));
    return { name: String(b.name), input, cut };
  }
  return null;
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
  if (args.includes("--tool")) {
    const tool = args[args.indexOf("--tool") + 1];
    const tail = new Uint8Array(await file.slice(Math.max(0, size - 4 * 1024 * 1024), size).arrayBuffer());
    process.stdout.write(JSON.stringify({ call: tool ? toolCallOf(tail, tool) : null }));
    process.exit(0);
  }
  let from = Math.max(0, num("--from") ?? 0);
  if (from > size) from = 0;
  const to = Math.min(size, num("--to") ?? size);
  const bytes = new Uint8Array(await file.slice(from, Math.max(from, to)).arrayBuffer());
  const t = args.indexOf("--tail");
  const tail = t >= 0 && args[t + 1] && !args[t + 1].startsWith("--") ? args[t + 1] : undefined;
  const out = index(bytes, { from, size, lastTurns: num("--last-turns"), budget: num("--budget"), maxEntries: num("--max-entries"), home: process.env.HOME ?? "", path, tail, side: args.includes("--sidechain") });
  process.stdout.write(JSON.stringify(out));
}
