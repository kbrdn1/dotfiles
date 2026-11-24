// Codex rollout adapter for kt-chat. It reads ~/.codex/sessions in place and emits the same compact
// entries as chat-index.ts, so chat-model.js and the whole renderer stay shared.
import { readdir } from "node:fs/promises";
import { classify, toolKind, toolTitle } from "./chat-model.js";
import { strip } from "./chat-index.ts";

type Entry = Record<string, any>;
type Meta = Record<string, any>;
type Candidate = { path: string; cwd: string | null; timestamp: number; session?: string | null };
type Options = {
  from?: number; size?: number; path?: string; lastTurns?: number; budget?: number;
  maxEntries?: number; home?: string;
};

const cap = (value: unknown, limit: number) => {
  const text = typeof value === "string" ? value : "";
  return text.length > limit ? text.slice(0, limit) + "…" : text;
};
const firstLine = (value: unknown) => String(value ?? "").split("\n").map((x) => x.trim()).find(Boolean)?.replace(/\s+/g, " ") ?? "";

function textOf(value: any): string {
  if (typeof value === "string") return value;
  if (!Array.isArray(value)) return typeof value?.text === "string" ? value.text : "";
  return value.map((part) => textOf(part)).filter(Boolean).join("\n");
}

function fromOf(c: any): Entry {
  if (c.kind === "task") return { kind: "task", status: c.status ?? null, task: c.task || null };
  if (c.kind === "system") return { kind: "system" };
  return { kind: c.kind, name: c.name ?? "", color: c.color ?? null, summary: c.summary ?? null, count: c.count ?? 1, ...(c.idle ? { idle: true } : {}) };
}

const groupsOf = (c: any): Entry => c.groups
  ? { groups: c.groups.map((g: any) => ({ ...fromOf(g), text: cap(g.text, 8000) })) }
  : {};

function toolInput(p: any) {
  if (p.type === "custom_tool_call") return { command: cap(p.input, 4000) };
  try {
    const parsed = JSON.parse(p.arguments ?? "{}");
    return parsed && typeof parsed === "object" ? parsed : { json: cap(p.arguments, 1000) };
  } catch {
    return { json: cap(p.arguments, 1000) };
  }
}

function toolName(p: any) {
  return p.type === "custom_tool_call" && p.name === "exec" ? "Bash" : String(p.name ?? "Tool");
}

/** One rollout line to the entries chat-model.js already understands. */
export function normalize(o: any, off: number, meta: Meta, home = ""): Entry[] {
  const at = Date.parse(o?.timestamp) || null;
  const p = o?.payload ?? {};
  if (o?.type === "session_meta") {
    if (p.id && !meta.session) meta.session = p.id;
    if (p.cwd) meta.cwd = p.cwd;
    meta.source = "codex";
    return [];
  }
  if (o?.type === "turn_context") {
    if (p.cwd) meta.cwd = p.cwd;
    if (p.model) meta.model = p.model;
    meta.source = "codex";
    return [];
  }
  if (o?.type !== "response_item") return [];

  if (p.type === "message" && p.role === "user") {
    const raw = textOf(p.content);
    if (!raw.trim()) return [];
    const hc = raw.match(/^\s*<hc\s+from="([^"]+)">([\s\S]*?)<\/hc>\s*$/);
    const c = hc && !p.origin
      ? { kind: "peer", name: hc[1], color: null, summary: null, count: 1, text: strip(raw) }
      : classify(strip(raw), p.origin);
    if (c.kind === "system") return [];
    return [{
      k: "user", o: off, uuid: p.id ?? `u${off}`, at, turn: true, text: cap(c.text, 20000),
      ...(c.kind !== "human" ? { from: fromOf(c), ...groupsOf(c) } : {}),
    }];
  }

  if (p.type === "message" && p.role === "assistant") {
    const blocks = (p.content ?? []).flatMap((part: any) => {
      const text = textOf(part);
      return text ? [{ t: "text", text: cap(text, 40000) }] : [];
    });
    return blocks.length ? [{ k: "assistant", o: off, uuid: p.id ?? `a${off}`, mid: p.id ?? `a${off}`, at, model: null, blocks }] : [];
  }

  if (p.type === "reasoning") {
    const text = textOf(p.summary);
    return text ? [{
      k: "assistant", o: off, uuid: p.id ?? `r${off}`, mid: p.id ?? `r${off}`, at, model: null,
      blocks: [{ t: "thinking", ms: null, text: cap(text, 4000) }],
    }] : [];
  }

  if (p.type === "custom_tool_call" || p.type === "function_call") {
    const input = toolInput(p);
    const name = toolName(p);
    const id = p.call_id ?? p.id ?? `call-${off}`;
    const title = toolTitle(name, input, meta.cwd ?? null, home) || firstLine(name);
    return [{
      k: "assistant", o: off, uuid: p.id ?? id, mid: p.id ?? id, at, model: null,
      blocks: [{ t: "tool", id, name, kind: toolKind(name), title, input }],
    }];
  }

  if (p.type === "custom_tool_call_output" || p.type === "function_call_output") {
    const raw = textOf(p.output);
    return [{ k: "result", o: off, tool: p.call_id ?? p.id ?? `call-${off}`, at, ok: p.is_error !== true, text: cap(raw, 4000), size: raw.length }];
  }
  return [];
}

/** Index complete lines from a byte range, with the same paging contract as chat-index.ts. */
export function index(bytes: Uint8Array, opts: Options = {}) {
  const from = opts.from ?? 0;
  const size = opts.size ?? from + bytes.length;
  const lastTurns = opts.lastTurns ?? 30;
  const budget = opts.budget ?? 600000;
  const maxEntries = opts.maxEntries ?? 1000;
  const dec = new TextDecoder();
  const meta: Meta = { source: "codex" };
  const entries: Entry[] = [];
  let pos = 0, bad = 0;
  for (;;) {
    const nl = bytes.indexOf(10, pos);
    if (nl < 0) break;
    const off = from + pos;
    const line = bytes.subarray(pos, nl);
    pos = nl + 1;
    if (line.length < 2) continue;
    try {
      entries.push(...normalize(JSON.parse(dec.decode(line)), off, meta, opts.home ?? ""));
    } catch {
      bad++;
    }
  }
  let first = entries.length, turns = 0, spent = 0, cut = false;
  for (let i = entries.length - 1; i >= 0; i--) {
    spent += JSON.stringify(entries[i]).length;
    if ((spent > budget || entries.length - i > maxEntries) && first < entries.length) { cut = true; break; }
    first = i;
    if (entries[i].k === "user" && entries[i].turn && ++turns >= lastTurns) { cut = i > 0; break; }
  }
  while (cut && first > 0 && entries[first - 1].o === entries[first].o) first--;
  const start = cut ? entries[first].o : from;
  const { session, ...rest } = meta;
  return {
    path: opts.path ?? null, session: session ?? null, from, start, end: from + pos, size,
    more: start > from, entries: entries.slice(first), meta: rest, skipped: 0, bad, tail: null, rewound: false,
  };
}

/** Timeline summary: Codex user response_items are the turn openers. */
export function marksOf(bytes: Uint8Array, opts: Options = {}) {
  const from = opts.from ?? 0;
  const size = opts.size ?? from + bytes.length;
  const dec = new TextDecoder();
  const turns: Entry[] = [], marks: Entry[] = [];
  let pos = 0;
  for (;;) {
    const nl = bytes.indexOf(10, pos);
    if (nl < 0) break;
    const off = from + pos;
    const line = bytes.subarray(pos, nl);
    pos = nl + 1;
    if (line.length < 2) continue;
    try {
      for (const e of normalize(JSON.parse(dec.decode(line)), off, {}, opts.home ?? "")) {
        if (e.k !== "user" || !e.turn) continue;
        turns.push({ o: e.o, uuid: e.uuid, at: e.at });
        if (!e.from && e.text?.trim()) marks.push({ o: e.o, uuid: e.uuid, turn: e.uuid, at: e.at, text: cap(firstLine(e.text), 300), images: 0, note: false });
      }
    } catch {
      // A partial or malformed line has no mark.
    }
  }
  return { path: opts.path ?? null, from, end: from + pos, size, turns, marks };
}

function toolCallOf(bytes: Uint8Array, id: string) {
  const lines = new TextDecoder().decode(bytes).split("\n");
  for (let i = lines.length - 1; i >= 0; i--) {
    if (!lines[i].includes(id)) continue;
    try {
      const p = JSON.parse(lines[i])?.payload ?? {};
      if ((p.type === "custom_tool_call" || p.type === "function_call") && p.call_id === id) {
        return { name: toolName(p), input: toolInput(p), cut: false };
      }
    } catch {
      // Keep looking toward older complete lines.
    }
  }
  return null;
}

/** Exact path held open by a live Codex process; accepts nothing outside ~/.codex/sessions. */
export function rolloutFromLsof(output: string, home: string) {
  const root = `${home.replace(/\/$/, "")}/.codex/sessions/`;
  const matches = new Set<string>();
  for (const line of String(output ?? "").split("\n")) {
    const path = line.startsWith("n") ? line.slice(1) : "";
    if (path.startsWith(root) && !path.includes("/../") && /\/rollout-[^/]+\.jsonl$/.test(path)) matches.add(path);
  }
  return matches.size === 1 ? [...matches][0] : null;
}

/** Fallback for a finished process. Refuse a weak or ambiguous cwd/start-time match. */
export function pickRollout(candidates: Candidate[], terminal: { cwd?: string | null; createdMs?: number | null }) {
  const made = Number(terminal.createdMs);
  if (!terminal.cwd || !Number.isFinite(made)) return null;
  const ranked = candidates
    .filter((c) => c.cwd === terminal.cwd && Number.isFinite(c.timestamp))
    .map((c) => ({ c, delta: c.timestamp - made }))
    .filter((x) => x.delta >= -5000 && x.delta <= 120000)
    .sort((a, b) => Math.abs(a.delta) - Math.abs(b.delta));
  if (!ranked.length) return null;
  if (ranked[1] && Math.abs(Math.abs(ranked[1].delta) - Math.abs(ranked[0].delta)) < 3000) return null;
  return ranked[0].c;
}

const pad = (n: number) => String(n).padStart(2, "0");
function dayDirs(home: string, createdMs: number) {
  const out = new Set<string>();
  for (const by of [-86400000, 0, 86400000]) {
    const d = new Date(createdMs + by);
    out.add(`${home}/.codex/sessions/${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())}`);
  }
  return [...out];
}

async function metaOf(path: string): Promise<Candidate | null> {
  try {
    const file = Bun.file(path);
    if (!(await file.exists())) return null;
    const head = await file.slice(0, Math.min(file.size, 65536)).text();
    for (const line of head.split("\n")) {
      if (!line.includes('"type":"session_meta"')) continue;
      const o = JSON.parse(line), p = o.payload ?? {};
      return { path, cwd: p.cwd ?? null, timestamp: Date.parse(p.timestamp ?? o.timestamp), session: p.id ?? null };
    }
  } catch {
    // An unreadable candidate is not a match.
  }
  return null;
}

async function fallback(home: string, cwd: string, createdMs: number) {
  const paths: string[] = [];
  for (const dir of dayDirs(home, createdMs)) {
    try {
      for (const name of await readdir(dir)) if (/^rollout-[^/]+\.jsonl$/.test(name)) paths.push(`${dir}/${name}`);
    } catch {
      // A neighboring day may not exist.
    }
  }
  const candidates = (await Promise.all(paths.map(metaOf))).filter(Boolean) as Candidate[];
  return pickRollout(candidates, { cwd, createdMs });
}

async function livePath(pid: number, home: string) {
  if (!Number.isInteger(pid) || pid <= 0) return null;
  try {
    const proc = Bun.spawn(["/usr/sbin/lsof", "-Fn", "-p", String(pid)], { stdout: "pipe", stderr: "ignore" });
    const output = await new Response(proc.stdout).text();
    await proc.exited;
    const path = rolloutFromLsof(output, home);
    return path && await Bun.file(path).exists() ? path : null;
  } catch {
    return null;
  }
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const value = (flag: string) => {
    const i = args.indexOf(flag);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const num = (flag: string) => {
    const n = Number(value(flag));
    return Number.isFinite(n) ? n : undefined;
  };
  const home = process.env.HOME ?? "";
  if (args[0] === "--resolve") {
    const pid = num("--pid") ?? 0, createdMs = num("--created-ms") ?? 0, cwd = value("--cwd") ?? "";
    const exact = await livePath(pid, home);
    const found = exact ? await metaOf(exact) : await fallback(home, cwd, createdMs);
    process.stdout.write(JSON.stringify({ path: found?.path ?? exact ?? null, session: found?.session ?? null }));
  } else {
    const path = args[0];
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
      const id = value("--tool") ?? "";
      const tail = new Uint8Array(await file.slice(Math.max(0, size - 4 * 1024 * 1024), size).arrayBuffer());
      process.stdout.write(JSON.stringify({ call: id ? toolCallOf(tail, id) : null }));
    } else {
      let from = Math.max(0, num("--from") ?? 0);
      if (from > size) from = 0;
      const to = Math.min(size, num("--to") ?? size);
      const bytes = new Uint8Array(await file.slice(from, Math.max(from, to)).arrayBuffer());
      const out = args.includes("--marks")
        ? marksOf(bytes, { from, size, home, path })
        : index(bytes, { from, size, path, home, lastTurns: num("--last-turns"), budget: num("--budget"), maxEntries: num("--max-entries") });
      process.stdout.write(JSON.stringify(out));
    }
  }
}
