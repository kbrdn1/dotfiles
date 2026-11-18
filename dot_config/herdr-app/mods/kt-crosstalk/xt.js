// kt-crosstalk's pure part (no herdr, no gpui-kit, no module state): the crosstalk publication read
// as one shape whether it is v1 or v2, the outbox Herdr writes back, a peer's project in the
// registry, the search and the grouping. node mods/kt-crosstalk/xt.test.mjs checks it.

import { search } from "./fuzzy.js";

export const DAY = 24 * 3600e3;

// A session's name without its random suffix, two hex digits since crosstalk's README ("claude-flow-1d"
// -> "claude-flow"): a registry name stays whole, and so does any other ending ("gwm-cli", "kbrdn.dev-v2").
export function baseName(name, names = []) {
  const n = String(name ?? "");
  return names.includes(n) ? n : n.replace(/^(.+)-[0-9a-f]{2}$/i, "$1");
}

// The publication (v1 or v2) as one shape; { error } when it can't be read: "unreadable", or
// "version" with the `version` it has (main.js says it in words, I18N.md). Fields v1 doesn't have
// stay null (kind, live, topic...), v1's title is the name without its suffix and its project that
// same prefix. A v2 thread is under the peer's key (by name as a fallback, before the key resolved).
export function normalize(pub, names = []) {
  if (!pub || typeof pub !== "object") return { error: "unreadable" }; // i18n: tech
  if (pub.v !== 1 && pub.v !== 2) return { error: "version", version: pub.v ?? "?" }; // i18n: tech
  const v2 = pub.v === 2;
  const threads = pub.threads && typeof pub.threads === "object" ? pub.threads : {};
  const s = pub.session ?? {};
  const peers = (Array.isArray(pub.peers) ? pub.peers : []).filter((p) => p && (p.name || p.key)).map((p) => {
    const name = String(p.name ?? p.key);
    const key = String(v2 ? p.key ?? name : name);
    const raw = threads[key] ?? threads[name];
    const msgs = (Array.isArray(raw) ? raw : []).filter((m) => m && typeof m.text === "string");
    const base = baseName(name, names);
    const lastIn = [...msgs].reverse().find((m) => m.dir === "in")?.at ?? (p.last?.dir === "in" ? p.last.at : null) ?? null;
    const last = p.last ?? msgs[msgs.length - 1] ?? null;
    // v2: `project` may be absent (Remote Control, cloud): no project then, and no project color.
    // A topic is never a bare step name; guard anyway, as nothing beats a wrong label.
    const topic = typeof p.topic === "string" && p.topic.trim() && !/^(issue|branch)$/i.test(p.topic.trim()) ? p.topic : null;
    return {
      key,
      name,
      title: (v2 && p.title) || base,
      project: p.project || (v2 ? null : base),
      topic,
      kind: p.kind ?? null,
      status: p.status ?? null,
      live: typeof p.live === "boolean" ? p.live : null,
      lastMessageAt: p.lastMessageAt ?? last?.at ?? null,
      unread: Number(p.unread) || 0,
      last,
      lastIn,
      msgs,
    };
  });
  return {
    v: pub.v,
    session: { id: s.id ?? null, name: s.name ?? null, cwd: s.cwd ?? null, project: s.project ?? null },
    peers,
    handled: pub.handled && typeof pub.handled === "object" ? pub.handled : {},
  };
}

// What the outbox calls a peer (`to`, `read`, `title`): always its key, the one id that still works
// once a peer's last name leads nowhere (v1 has no key: there it is the name).
export const addr = (_pub, p) => p.key;

// The outbox after one change, from what is on disk: entries crosstalk handled leave `send`, read
// marks only move forward. `title` (v2 only): crosstalk applies an entry once, when it appears or
// changes ("" clears a title); one the publication already shows leaves, and so does one for a key
// it doesn't publish (ignored there). An outbox written for another session starts over: crosstalk
// would ignore it anyway.
export function nextOutbox(pub, disk, { send, read, title } = {}) {
  const base = disk && disk.session === pub.session.id ? disk : {};
  const out = {
    v: pub.v,
    session: pub.session.id,
    send: [...(Array.isArray(base.send) ? base.send : []), ...(send ? [send] : [])].filter((e) => e?.id && !pub.handled[e.id]),
    read: { ...(base.read ?? {}) },
  };
  for (const [k, at] of Object.entries(read ?? {})) if (!(out.read[k] >= at)) out.read[k] = at;
  if (pub.v === 2) out.title = Object.fromEntries(Object.entries({ ...(base.title ?? {}), ...(title ?? {}) }).filter(([k, v]) => !titleDone(pub, k, v)));
  return out;
}

// A title entry with nothing left to do: its key isn't published, or the publication shows it.
// ponytail: a clear ("") can't be seen landing (the title falls back to a computed one), so it stays;
// crosstalk applies it once, so it never undoes a later rename.
export function titleDone(pub, key, value) {
  const p = pub.peers.find((x) => x.key === key);
  return !p || (value !== "" && p.title === value);
}

// What became of one of Herdr's sends: "refused" (with its reason), "sent", "pending" (still in the
// outbox), or "failed" (never made it to the outbox: its write's error, else `gone`, said in words by
// main.js).
export function sendState(e, pub, box) {
  const h = pub.handled[e.id];
  if (h?.status === "refused") return { state: "refused", reason: h.reason ?? "" };
  if (h) return { state: "sent" };
  if (e.err) return { state: "failed", reason: e.err };
  return (box?.send ?? []).some((x) => x.id === e.id) ? { state: "pending" } : { state: "failed", reason: "", gone: true };
}

// Unread, once Herdr marked the conversation read past its last incoming message.
export const unreadOf = (p, mark) => (p.lastIn && mark >= p.lastIn ? 0 : p.unread);

// Where a conversation goes in the inbox: "todo" (waits, or has unread), "active" (live: seen now,
// or a message in the last 24 h), else "idle" (folded).
export function groupOf(p, unread, now) {
  if (p.status === "waiting" || unread > 0) return "todo";
  return p.live === true || (p.lastMessageAt && now - p.lastMessageAt < DAY) ? "active" : "idle";
}

// The registry entry for a project given as a folder (its realpath: the deepest entry holding it),
// or as a name; else for a session name (the longest entry name it is or starts with).
export function entryOf(reg, project, name, real = (p) => p) {
  if (typeof project === "string" && project.startsWith("/")) {
    const p = real(project);
    const hits = reg.filter((e) => e.folder && !e.machine && (p === real(e.folder) || p.startsWith(`${real(e.folder)}/`)));
    if (hits.length) return hits.sort((a, b) => b.folder.length - a.folder.length)[0];
  } else if (project) {
    const lo = String(project).toLowerCase();
    const e = reg.find((x) => x.name?.toLowerCase() === lo);
    if (e) return e;
  }
  const lo = String(name ?? "").toLowerCase();
  if (!lo) return null;
  return reg.filter((e) => e.name && (lo === e.name.toLowerCase() || lo.startsWith(`${e.name.toLowerCase()}-`)))
    .sort((a, b) => b.name.length - a.name.length)[0] ?? null;
}

// The query against a conversation: each term fuzzy on its short fields (title, project, topic,
// live name), else as a substring of one of its messages (fuzzy over long text matches anything).
// { score, marks (per field), hit: the first message a term was found in } or null.
export function matchPeer(query, fields, texts) {
  const terms = String(query ?? "").trim().split(/\s+/).filter(Boolean);
  const marks = fields.map(() => new Set());
  let score = 0;
  let hit = null;
  for (const term of terms) {
    const m = search(term, fields);
    if (m) {
      score += m.score;
      m.marks.forEach((set, i) => set.forEach((k) => marks[i].add(k)));
      continue;
    }
    const lo = term.toLowerCase();
    const text = texts.find((t) => t.toLowerCase().includes(lo));
    if (!text) return null;
    score += 50;
    hit ??= { text, term: lo };
  }
  return { score, marks, hit };
}

// A line of `text` around `term`, its letters marked: { s, marks }.
export function snippet(text, term, width = 90) {
  const flat = String(text).replace(/\s+/g, " ");
  const i = flat.toLowerCase().indexOf(term);
  const from = Math.max(0, i - Math.floor(width / 3));
  const s = `${from ? "…" : ""}${flat.slice(from, from + width)}`;
  const at = i - from + (from ? 1 : 0);
  return { s, marks: new Set(i < 0 ? [] : Array.from(term, (_, k) => at + k)) };
}

// Messages in runs: one per day, then one per side within it ([{ day, runs: [{ dir, items }] }]).
// `dayOf(at)` names the day; items without a time join the day before.
export function runsOf(items, dayOf) {
  const days = [];
  for (const m of items) {
    const d = m.at ? dayOf(m.at) : days[days.length - 1]?.day ?? null;
    if (!days.length || days[days.length - 1].day !== d) days.push({ day: d, runs: [] });
    const runs = days[days.length - 1].runs;
    if (!runs.length || runs[runs.length - 1].dir !== m.dir) runs.push({ dir: m.dir, items: [] });
    runs[runs.length - 1].items.push(m);
  }
  return days;
}
