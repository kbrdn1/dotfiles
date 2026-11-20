// The Chat view's model: entries from chat-index.ts → turns → items → fold. Pure, no herdr
// import: tested under bun (chat-model.check.mjs), copied as is wherever it's used.
//
// Adapted from Monocode (github.com/hardbeat920/monocode, MIT, Copyright (c) 2026 Nick):
// src/features/sessions/model/transcriptActivity.ts (groupTurnItems, foldableWork, tallySteps,
// dominantWorkKind) and claudeProtocol.ts (toolKindFromName).
//
// Copyright (c) 2026 Nick
//
// Permission is hereby granted, free of charge, to any person obtaining a copy of this software
// and associated documentation files (the "Software"), to deal in the Software without
// restriction, including without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the
// Software is furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in all copies or
// substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING
// BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
// NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
//
// Differences with Monocode, on purpose:
// - thinking counts as work even with empty text (Claude Code keeps only the signature and
//   thinkingDurationMs 9 times out of 10): it stays a "Réflexion · 4 s" step;
// - no withoutSupersededInitialThinking, no yieldedAt, no approvals, no Mono turns: a JSONL
//   has no pending permission, and a task-notification opens its own turn (chat-index.ts);
// - words stay out (I18N.md): tally() returns counts, the mod says them.

// ── Tools ────────────────────────────────────────────────────────────────────

const TASKS = /^(TodoWrite|TaskCreate|TaskUpdate|TaskList|TaskGet)$/;

/** read | edit | execute | search | skill | agent | tasks | other (toolKindFromName). */
export function toolKind(name) {
  const n = String(name ?? "").toLowerCase();
  if (TASKS.test(name ?? "")) return "tasks";
  if (/bash|command|shell|terminal/.test(n)) return "execute";
  if (/edit|write|patch|replace/.test(n)) return "edit";
  if (n.includes("read")) return "read";
  if (/grep|glob|search/.test(n)) return "search";
  if (n === "skill" || n === "skills") return "skill";
  if (n === "agent" || n === "task") return "agent";
  return "other";
}

/** What a run of calls was for: reads and searches are one thing, looking around. */
export function category(kind) {
  if (kind === "agent") return "agent";
  if (kind === "edit") return "edit";
  if (kind === "read" || kind === "search") return "research";
  if (kind === "execute") return "run";
  return "other";
}

/** A path as the row shows it: relative to the session's folder, else ~/… */
export function rel(path, cwd, home) {
  if (!path) return "";
  if (cwd && path.startsWith(cwd + "/")) return path.slice(cwd.length + 1);
  if (home && path.startsWith(home + "/")) return "~/" + path.slice(home.length + 1);
  return path;
}

// One plain line: the first that says something, its markdown marks (**, `) off, spaces folded.
const firstLine = (s, max = 160) => {
  const line = (String(s ?? "").split("\n").find((l) => l.trim()) ?? "").replace(/\*\*|`/g, "").replace(/\s+/g, " ").trim();
  return line.length > max ? line.slice(0, max - 1) + "…" : line;
};

/** The row's title: data only (a path, a command, a pattern), "" when there is none. */
export function toolTitle(name, input, cwd, home) {
  const i = input ?? {};
  const path = i.file_path ?? i.notebook_path ?? i.path;
  // A message to another agent: who, and what about (its summary), never its body.
  if (name === "SendMessage" && i.to) return firstLine([i.to, i.summary].filter(Boolean).join(" · "));
  switch (toolKind(name)) {
    case "read":
    case "edit":
      if (path) return rel(path, cwd, home);
      break;
    case "execute":
      if (i.command) return firstLine(i.command);
      break;
    case "search":
      if (i.pattern) return i.path ? `${i.pattern} · ${rel(i.path, cwd, home)}` : i.pattern;
      if (i.query) return firstLine(i.query);
      break;
    case "agent":
      return firstLine(i.description ?? i.name ?? i.subagent_type ?? "");
    case "skill":
      return firstLine([i.skill, i.args].filter(Boolean).join(" "));
  }
  for (const k of ["description", "url", "query", "pattern", "prompt", "subject", "message"]) {
    if (typeof i[k] === "string" && i[k].trim()) return firstLine(i[k]);
  }
  if (path) return rel(path, cwd, home);
  return "";
}

/** ok | error | running | stopped. A call with no result in a settled turn was cut short. */
export function toolState(block, live) {
  if (block.result) return block.result.ok ? "ok" : "error";
  return live ? "running" : "stopped";
}

// ── Who speaks in a user message ────────────────────────────────────────────

const attrsOf = (s) => {
  const out = {};
  for (const a of String(s ?? "").matchAll(/([\w-]+)="([^"]*)"/g)) out[a[1]] = a[2];
  return out;
};

/**
 * A task-notification's parts: its task's name (the `Agent "…"` of its summary, else the summary),
 * status, summary and result (what the task answered, markdown).
 */
export function taskOf(raw) {
  const text = String(raw ?? "");
  const tag = (n) => text.match(new RegExp(`<${n}>([\\s\\S]*?)</${n}>`))?.[1]?.trim() ?? null;
  const summary = tag("summary"); // i18n: tech
  return { name: (summary && /"([^"]+)"/.exec(summary)?.[1]) ?? summary ?? "", status: tag("status"), summary, result: tag("result") ?? "" }; // i18n: tech
}

/** One `<teammate-message>` / `<cross-session-message>`: who, what about, its body; an idle_notification's JSON read for its result. */
function partOf(w) {
  const at = attrsOf(w[2]);
  const b = w[3].trim();
  let body = b, summary = at.summary ?? null, idle = false;
  if (b.startsWith("{")) {
    try {
      const j = JSON.parse(b);
      idle = j.type === "idle_notification";
      const said = j.result ?? j.message ?? j.text ?? j.content ?? null;
      body = typeof said === "string" ? said : idle ? "" : b;
      summary = j.summary ?? summary ?? (j.type && !idle ? j.type.replace(/_/g, " ") : null);
    } catch {
      // plain text after all
    }
  }
  return { kind: w[1] === "teammate-message" ? "teammate" : "peer", name: at["from-name"] ?? at.teammate_id ?? at.from ?? "", color: at.color ?? null, summary, idle, body };
}

/**
 * Consecutive parts of one sender, one group: one header, a count, their bodies (a body repeating the
 * one before it said once). Measured on the lead's transcript (2026-11-19): 213 of 354 idle notices
 * came in a line of 2 to 14 messages, 134 next to a message of their own sender.
 */
function groupsOf(parts) {
  const out = [];
  for (const p of parts) {
    const g = out[out.length - 1];
    if (g && g.kind === p.kind && g.name === p.name) {
      g.count++;
      g.idle = g.idle && p.idle;
      g.color ??= p.color;
      g.summary ??= p.summary;
      if (p.body && p.body !== g.bodies[g.bodies.length - 1]) g.bodies.push(p.body);
    } else out.push({ kind: p.kind, name: p.name, color: p.color, summary: p.summary, idle: p.idle, count: 1, bodies: p.body ? [p.body] : [] });
  }
  return out.map(({ bodies, ...g }) => ({ ...g, text: bodies.join("\n\n") }));
}

/**
 * What a user message is, from its text (after hc's wrappers, chat-index.ts strip()) and its line's
 * origin. Kylian typed only « human »; the rest came in by the harness and is shown folded, never
 * as his bubble:
 * - « teammate » (`<teammate-message teammate_id color summary?>`, an idle_notification's JSON body
 *   read for its result) and « peer » (`<cross-session-message from-name>`), wherever in the text
 *   (the harness puts words before and a note after), grouped by consecutive sender (groupsOf);
 * - « task » (`<task-notification>`): its task's name, status and result (taskOf);
 * - `<system-reminder>` blocks go; a message of nothing else is « system », hidden.
 * Answers { kind, text, name?, color?, summary?, idle?, count?, status?, task?, groups? }: the first
 * sender's group, and `groups` (all of them) when several senders follow one another; `text` is what
 * is left to show. `summary` is the sender's own (an attribute, the JSON's), never made up.
 */
export function classify(raw, origin = null) {
  const text = String(raw ?? "");
  if (origin?.kind === "task-notification" || /<task-notification>/.test(text)) {
    const tk = taskOf(text);
    return { kind: "task", text: tk.result, status: tk.status, task: tk.name }; // i18n: tech
  }
  const wraps = [...text.matchAll(/<(teammate-message|cross-session-message|agent-message)\b([^>]*)>([\s\S]*?)<\/\1>/g)];
  if (wraps.length) {
    const groups = groupsOf(wraps.map(partOf));
    return { ...groups[0], ...(groups.length > 1 ? { groups } : {}) };
  }
  if (origin?.kind === "peer") return { kind: "peer", name: origin.name ?? "", color: null, summary: null, idle: false, count: 1, text };
  const rest = text.replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, "").trim();
  if (!rest && /<system-reminder>/.test(text)) return { kind: "system", text: "" };
  return { kind: "human", text: rest };
}

// ── State: what the indexer has given so far ────────────────────────────────

/**
 * Takes one output of chat-index.ts into the state. A delta continues the state when it starts
 * where the state ends, on the same file and session; anything else (another session, a file
 * that shrank, a delta cut by the budget) replaces it.
 */
export function ingest(state, out) {
  const same = state && out.path === state.path && (!out.session || !state.session || out.session === state.session);
  if (same && out.start === state.end) {
    return {
      ...state,
      session: state.session || out.session,
      end: out.end,
      size: out.size,
      entries: out.entries.length ? state.entries.concat(out.entries) : state.entries,
      meta: { ...state.meta, ...out.meta },
      // #59: the chain's last link, for the next delta (chat-index.ts --tail).
      tail: out.tail ?? state.tail ?? null,
    };
  }
  return {
    path: out.path, session: out.session, start: out.start, end: out.end, size: out.size,
    more: out.more, entries: out.entries, meta: { ...out.meta }, tail: out.tail ?? null,
  };
}

/**
 * A state grown past `max` entries by the live tail: its oldest turns go, whole (the cut falls on a
 * turn's opener, else on a line start inside a turn longer than `max`), and `more` says they can be
 * read again. Keeps build() within the ~50 ms a mod call has.
 */
export function trim(state, max) {
  const n = state?.entries?.length ?? 0;
  if (n <= max) return state;
  const e = state.entries;
  let i = n - max;
  while (i < n && !(e[i].k === "user" && e[i].turn)) i++;
  if (i >= n) i = n - max;
  while (i > 0 && e[i - 1].o === e[i].o) i--;
  return { ...state, entries: e.slice(i), start: e[i].o, more: true };
}

/**
 * Older turns (`--to state.start`) put in front. `more`: the file has bytes before the new start. Not
 * the read's own `more`, which says « before its --from »: a read toward a far message (reach(), a
 * --from) that fits whole has start == from, so more false, with the session's older turns still above
 * (#59, measured on t1's 160 MB: one read of 90 turns, then the timeline's jump never came).
 */
export function prepend(state, out) {
  if (!state || out.path !== state.path || out.end !== state.start) return state;
  return { ...state, start: out.start, more: out.start > 0, entries: out.entries.concat(state.entries) };
}

/** Messages typed while the agent worked and not taken yet (queue-operation, FIFO). */
export function pendingQueue(entries) {
  const fifo = [];
  for (const e of entries) {
    if (e.k !== "queue") continue;
    if (e.op === "enqueue") fifo.push(e);
    else if (e.op === "dequeue") fifo.shift();
    else if (e.op === "remove") {
      const i = e.text != null ? fifo.findIndex((q) => q.text === e.text) : -1;
      fifo.splice(i < 0 ? 0 : i, 1);
    }
  }
  return fifo.filter((q) => q.text && !q.task);
}

// ── Turns ────────────────────────────────────────────────────────────────────

/**
 * Lines of one assistant message share its id (one block per line): one message, blocks in
 * order. A line written twice (same uuid) counts once.
 */
export function merge(entries) {
  const out = [];
  const byMid = new Map();
  const seen = new Set();
  for (const e of entries) {
    if (e.uuid && e.k !== "result") {
      const key = e.k + e.uuid;
      if (seen.has(key)) continue;
      seen.add(key);
    }
    if (e.k !== "assistant" || !e.mid) {
      out.push(e);
      continue;
    }
    const first = byMid.get(e.mid);
    if (first) first.blocks.push(...e.blocks);
    else {
      const copy = { ...e, blocks: [...e.blocks] };
      byMid.set(e.mid, copy);
      out.push(copy);
    }
  }
  return out;
}

/**
 * The turns, each opened by the entry chat-index.ts marked `turn` (a prompt, a peer's message,
 * a task-notification). What comes before the first one is a turn without opener. Only the last
 * turn can be live: the mod says so from the agent's status.
 */
export function build(entries, opts = {}) {
  const live = !!opts.live;
  const merged = merge(entries);
  const tools = new Map();
  const turns = [];
  let cur = null;
  const open = (user) => {
    cur = { id: user?.uuid ?? `head-${user?.o ?? 0}`, user, files: [], blocks: [], ms: null, model: null };
    turns.push(cur);
  };
  for (const e of merged) {
    if (e.k === "user" && e.turn) {
      open(e);
      continue;
    }
    if (e.k === "queue" || e.k === "meta") continue;
    if (!cur) open(null);
    if (e.k === "file") cur.files.push({ path: e.path, abs: e.abs ?? null });
    else if (e.k === "assistant") {
      // The model that answered (Monocode's « Opus 5.5 worked for 3m »): the turn's first real one.
      if (!cur.model && e.model && !String(e.model).startsWith("<")) cur.model = e.model;
      e.blocks.forEach((b, n) => {
        if (b.t === "text") cur.blocks.push({ role: "prose", id: `${e.uuid}:${n}`, text: b.text, at: e.at, ...(b.cites ? { cites: b.cites } : {}) });
        else if (b.t === "thinking") cur.blocks.push({ role: "thinking", id: `${e.uuid}:${n}`, ms: b.ms ?? null, text: b.text ?? "" });
        else if (b.t === "tool") {
          const block = { role: "tool", id: b.id, name: b.name, kind: b.kind, title: b.title, input: b.input, at: e.at, result: null };
          tools.set(b.id, block);
          cur.blocks.push(block);
        }
      });
    } else if (e.k === "result") {
      const tool = tools.get(e.tool);
      if (tool) tool.result = e;
    } else if (e.k === "notice") {
      if (e.kind === "duration") cur.ms = e.ms;
      else if (e.kind === "summary") {
        let last = null;
        for (const b of cur.blocks) if (b.role === "notice" && b.kind === "compact" && b.text == null) last = b;
        if (last) last.text = e.text;
        else cur.blocks.push({ role: "notice", id: `n${e.o}`, kind: "compact", text: e.text });
      } else cur.blocks.push({ role: "notice", id: `n${e.o}:${e.kind}`, ...e });
    } else if (e.k === "user") {
      // A message delivered mid-turn (queued_command): an interjection, not a new turn.
      cur.blocks.push({ role: "note", id: e.uuid ?? `u${e.o}`, text: e.text, from: e.from ?? null, groups: e.groups ?? null, at: e.at });
    }
  }
  // buildInc(): a result written in a later turn for one of these turns' tools, after their own lines.
  for (const r of opts.results ?? []) {
    const tool = tools.get(r.tool);
    if (tool) tool.result = r;
  }
  turns.forEach((turn, n) => {
    turn.live = live && n === turns.length - 1;
    for (const b of turn.blocks) if (b.role === "tool") b.state = toolState(b, turn.live);
    turn.items = items(turn.blocks, !turn.live);
    turn.fold = fold(turn.items);
  });
  return turns;
}

/**
 * build(), one turn at a time (#59, the infinite scroll's lot 1): what a live tick, a read in front or
 * a trim changes is a few turns; the others are the same entry objects as at the last call (ingest,
 * prepend and trim keep them), so they are the same turn objects. Equal to build(entries, { live })
 * (chat-model.check.mjs). `cache`: a Map the caller keeps between calls, refilled each time.
 *
 * A turn is its entries from its opener to the next one (the first: what comes before any opener).
 * Three things cross turns in build(), all handled here: a line written twice counts in the turn where
 * it first is (its later copies are left out of their turn); a tool's result written in a later turn
 * goes to the tool's turn (after its own entries, as build() applies them in order); an assistant
 * message whose lines span two turns (never seen): then build() itself, whole.
 */
export function buildInc(entries, { live = false, cache = new Map() } = {}) {
  // An opener written again opens nothing (merge() leaves the copy out): its turn, or the one it lands
  // in, goes on, and the copy is left out there like any line written twice.
  const starts = [], opened = new Set();
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    if (e.k !== "user" || !e.turn) continue;
    if (e.uuid) {
      if (opened.has(e.uuid)) continue;
      opened.add(e.uuid);
    }
    starts.push(i);
  }
  if (starts[0] !== 0 && entries.length) starts.unshift(0);
  const segs = starts.length;
  // One pass over every entry, in order: where each line first is, which turn each tool is in when a
  // result for it comes, the messages' turns.
  const firstSeg = new Map();
  const midSeg = new Map();
  const toolSeg = new Map();
  const dups = new Array(segs).fill(0);
  const outside = Array.from({ length: segs }, () => []);
  for (let s = 0, i = 0; s < segs; s++) {
    const end = s + 1 < segs ? starts[s + 1] : entries.length;
    for (; i < end; i++) {
      const e = entries[i];
      if (e.uuid && e.k !== "result") {
        const key = e.k + e.uuid;
        const at = firstSeg.get(key);
        if (at === undefined) firstSeg.set(key, s);
        else if (at < s) {
          dups[s]++;
          continue;
        } else continue; // a copy in its own turn: merge() leaves it out there
      }
      if (e.k === "assistant") {
        if (e.mid) {
          const m = midSeg.get(e.mid);
          if (m === undefined) midSeg.set(e.mid, s);
          else if (m !== s) {
            cache.clear();
            return build(entries, { live });
          }
        }
        for (const b of e.blocks ?? []) if (b.t === "tool") toolSeg.set(b.id, s);
      } else if (e.k === "result") {
        const owner = toolSeg.get(e.tool);
        if (owner !== undefined && owner !== s) outside[owner].push(e);
      }
    }
  }
  const was = new Map(cache);
  cache.clear();
  const turns = [];
  for (let s = 0; s < segs; s++) {
    const a = starts[s], b = s + 1 < segs ? starts[s + 1] : entries.length;
    const isLive = live && s === segs - 1;
    const res = outside[s];
    const key = entries[a];
    const sig = { n: b - a, last: entries[b - 1], live: isLive, dups: dups[s], res: res.length, lastRes: res[res.length - 1] ?? null };
    const hit = was.get(key);
    let built;
    if (hit && hit.n === sig.n && hit.last === sig.last && hit.live === sig.live && hit.dups === sig.dups && hit.res === sig.res && hit.lastRes === sig.lastRes) built = hit.turns;
    else {
      const own = [];
      for (let i = a; i < b; i++) {
        const e = entries[i];
        if (dups[s] && e.uuid && e.k !== "result" && firstSeg.get(e.k + e.uuid) < s) continue;
        own.push(e);
      }
      built = build(own, { live: isLive, results: res });
    }
    cache.set(key, { ...sig, turns: built });
    turns.push(...built);
  }
  return turns;
}

const isProse = (b) => b.role === "prose" && !!b.text?.trim();
const isSubagent = (b) => b.role === "tool" && b.kind === "agent";
const isActivity = (b) => b.role === "thinking" || b.role === "tool";

/**
 * groupTurnItems: runs of calls and thinking become one activity item, prose stands alone. A
 * live turn keeps its sub-agents on their own rows (that's where the reader watches) and its
 * interjections too; once settled they join the work, except a sub-agent that failed.
 */
export function items(blocks, settled = true) {
  const out = [];
  let steps = [];
  const flush = () => {
    if (steps.length) out.push({ type: "activity", id: steps[0].id, steps });
    steps = [];
  };
  for (const b of blocks) {
    if (b.role === "prose" && !isProse(b)) continue;
    if (isSubagent(b) && (!settled || b.state === "error")) {
      flush();
      const last = out[out.length - 1];
      if (last?.type === "subagents") last.runs.push(b);
      else out.push({ type: "subagents", id: b.id, runs: [b] });
      continue;
    }
    if (isActivity(b) || (settled && b.role === "note")) {
      steps.push(b);
      continue;
    }
    flush();
    out.push({ type: "block", id: b.id, block: b });
  }
  flush();
  return out;
}

const foldable = (item) => item.type === "subagents" || item.type === "activity" || (item.type === "block" && isProse(item.block));

/**
 * foldableWork: from the first thing the agent did up to the last work it has already narrated
 * past, leaving the prompt above and the answer below. A notice (compaction, error,
 * interruption) is neither, so the fold stops at it. null when nothing folds.
 */
export function fold(list) {
  let end = -1;
  let answered = false;
  for (let i = list.length - 1; i >= 0; i--) {
    const item = list[i];
    if (item.type === "activity") {
      if (answered) {
        end = i;
        break;
      }
      continue;
    }
    if (item.type === "block" && isProse(item.block)) answered = true;
  }
  if (end < 0) return null;
  let start = end;
  while (start > 0 && foldable(list[start - 1])) start--;
  return { start, end };
}

/**
 * The fold as a tree (#90): the items that hang under its « … a travaillé » (opened, all of them;
 * closed, only the sub-agents, which Monocode keeps), the last of them (its branch ends the trunk), and
 * whether the header starts a trunk (it has children shown). null when nothing folds.
 */
export function foldTree(list, f, opened) {
  if (!f) return null;
  const kids = [];
  for (let n = f.start; n <= f.end; n++) if (opened || list[n]?.type === "subagents") kids.push(n);
  return { kids, last: kids.length ? kids[kids.length - 1] : -1, stem: kids.length > 0 };
}

/**
 * What arrived live (#92), to fade in where it lands: the turns after the last one of the previous
 * build (`was`: its turn ids), and in a live last turn the previous build had too (`seen`: { turn, ids }),
 * its new items. Nothing on a first build, an older read (it comes above) or another session's (the last
 * turn known isn't there). `seen` for the next build: the live turn's item ids.
 */
export function arrivals(was, turns, live, seen) {
  const ids = turns.map((t) => t.id);
  const k = was.length ? ids.indexOf(was[was.length - 1]) : -1;
  const fresh = k >= 0 ? ids.slice(k + 1) : [];
  const last = turns[turns.length - 1];
  if (live && last && seen?.turn === last.id) for (const it of last.items) if (!seen.ids.has(it.id)) fresh.push(it.id);
  return { fresh, seen: live && last ? { turn: last.id, ids: new Set(last.items.map((it) => it.id)) } : null };
}

/**
 * A sub-agent's own transcript (#58), beside its session's: `<session>/subagents/agent-<id>.jsonl`, its
 * `.meta.json` next to it (what Claude Code writes). null for an id that isn't a plain name (no path
 * goes out of that folder) or a session that isn't a .jsonl.
 */
export function subPath(session, id) {
  if (!session || !/\.jsonl$/.test(session) || !/^[A-Za-z0-9_-]{1,128}$/.test(String(id ?? ""))) return null;
  const file = `${session.replace(/\.jsonl$/, "")}/subagents/agent-${id}.jsonl`;
  return { file, meta: file.replace(/\.jsonl$/, ".meta.json") };
}

/**
 * What a sub-agent's line shows unfolded (#58): the items of its last turn (its work, its words), the
 * last `max` of them; null when its transcript gave none (the line keeps its report, as before). Their
 * ids and their blocks' are made its own (`sub:<agent>:`): built from another file, an id made of an
 * offset (a notice's, a note's) could be one of the session's too. Steps keep theirs (tool ids, uuids).
 */
export function subItems(turns, max = 8, agent = "") {
  const last = turns?.[turns.length - 1];
  const list = last?.items ?? [];
  const own = (x) => `sub:${agent}:${x}`;
  const items = list.slice(-max).map((it) => ({ ...it, id: own(it.id), ...(it.block ? { block: { ...it.block, id: own(it.block.id) } } : {}) }));
  return list.length ? { turn: last, items, more: Math.max(0, list.length - max) } : null;
}

/**
 * #58: the items a sub-agent's read brought (subItems' ids), to fade in once: the first read's all (they
 * take the report's place), then each delta's new ones; those still waiting to be drawn stay.
 */
export function subArrivals(was, turns, agent, waiting = new Set()) {
  const ids = (t) => (t ? subItems(t, 8, agent)?.items.map((it) => it.id) ?? [] : []);
  const before = new Set(ids(was));
  return new Set(ids(turns).filter((x) => waiting.has(x) || !before.has(x)));
}

/** Every step inside a fold (sub-agents keep their own rows, outside the count). */
export function foldedSteps(list, f) {
  return list.slice(f.start, f.end + 1).flatMap((it) => (it.type === "activity" ? it.steps : it.type === "block" ? [it.block] : []));
}

const KIND_ORDER = ["edit", "run", "agent", "research", "other"];

/**
 * tallySteps: what a run of work adds up to, as counts; the mod says them ("4 lectures · 2
 * modifs · 3 commandes"). Reads and edits count distinct files. `order` is the kinds in the
 * order the agent first did them, `kind` the dominant one (its icon), `current` the kind of the
 * last call (present tense while live).
 */
export function tally(steps) {
  const t = { order: [], reads: 0, edits: 0, searches: 0, runs: 0, agents: 0, others: 0, thoughts: 0, thinkMs: 0, notes: 0, errors: 0, kind: null, current: null };
  const reads = new Set();
  const edits = new Set();
  const counts = new Map();
  for (const b of steps) {
    if (b.role === "note") {
      t.notes++;
      continue;
    }
    if (b.role === "thinking") {
      t.thoughts++;
      t.thinkMs += b.ms ?? 0;
      continue;
    }
    if (b.role !== "tool") continue;
    const c = category(b.kind);
    if (!t.order.includes(c)) t.order.push(c);
    counts.set(c, (counts.get(c) ?? 0) + 1);
    t.current = c;
    if (b.state === "error") t.errors++;
    const target = b.input?.path ?? b.id;
    if (c === "edit") edits.add(target);
    else if (c === "agent") t.agents++;
    else if (c === "run") t.runs++;
    else if (c === "research") {
      if (b.kind === "search") t.searches++;
      else reads.add(target);
    } else t.others++;
  }
  t.reads = reads.size;
  t.edits = edits.size;
  for (const k of KIND_ORDER) if ((counts.get(k) ?? 0) > (counts.get(t.kind) ?? 0)) t.kind = k;
  if (!t.kind) t.kind = t.notes && !t.thoughts ? "note" : "think";
  return t;
}
