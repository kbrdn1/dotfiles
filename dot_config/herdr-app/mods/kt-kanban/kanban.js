// kanban.js: the Kanban's board, pure (no herdr, no gpui): which threads it shows, sliced, grouped in
// lanes, in which column and order, the filter (`field:value` terms and words), the columns' cost and
// soft limits, the saved views, the drawer's checks and snooze times, and the keys' cursor across
// columns and lanes.
// The threads are threads-model.js' (a byte-identical copy of kt-threads'); the flow's phases, kt-flow's
// steps.js (a byte-identical copy). Its check: bun mods/kt-kanban/kanban.check.mjs.
import { STATUSES, sortByNeed, projectGroups } from "./threads-model.js";
import { PHASES } from "./steps.js";
import { step } from "./vim.js";

// The board's choices (mod.json's options, kt.opt.kt-kanban.*), each list's first is the default.
export const OPTIONS = {
  column: ["status", "phase"],
  group: ["none", "project"],
  slice: ["none", "project", "program"],
  sort: ["activity", "age", "cost", "name"],
  density: ["normal", "compact", "detailed"], // a card: as #31, its title and status only, or more
};
/** A stored choice, the default when unknown. */
export const choice = (opt, v) => (OPTIONS[opt].includes(v) ? v : OPTIONS[opt][0]);
/** The next choice of a cycling button (c, b, s, t). */
export const nextChoice = (opt, v) => OPTIONS[opt][(OPTIONS[opt].indexOf(choice(opt, v)) + 1) % OPTIONS[opt].length];

// A column is a value of a field. `values(threads)`: the columns in order; `of(thread)`: its column.
// The flow's phase: kt-flow's phases in order (prep, spec, impl, ship, close), "other" only while a
// flow stands on a step out of the table, then "none" (no flow, or an empty one). Where a flow stands
// is threads-model's flow.at (its current step, else the furthest reached; report counts in ship); a
// flow with nothing reached yet has started: prep.
const PHASE_IDS = PHASES.map((p) => p.id);
const phaseOf = (th) => (!th.flow?.total ? "none" : th.flow.at ?? "prep");
export const FIELDS = {
  status: { values: () => STATUSES, of: (th) => (STATUSES.includes(th.status) ? th.status : "idle") },
  phase: { values: (threads) => [...PHASE_IDS, ...(threads.some((th) => phaseOf(th) === "other") ? ["other"] : []), "none"], of: phaseOf },
};
/** Every column key a field can give (a column's scroll handle is made once, before any render). */
export const COLUMN_KEYS = [...STATUSES, ...PHASE_IDS, "other", "none"];

// In a column: the default by need (pinned, then the most recently active); else by the thread's age
// (first seen, the oldest first), its cost (the dearest first, none last) or its title. A sorted board
// is never reordered by hand (there is no hand order).
const text = (s) => String(s ?? "").toLowerCase();
const SORTS = {
  age: (a, b, o) => (o.firstSeen[a.id] ?? a.activity) - (o.firstSeen[b.id] ?? b.activity),
  cost: (a, b) => (b.cost ?? -1) - (a.cost ?? -1),
  name: (a, b) => (text(a.title) < text(b.title) ? -1 : text(a.title) > text(b.title) ? 1 : 0),
};

/** What the board can show: every project's threads (its views decide, not the sidebar's scope), the
 *  archived ones only when the filter asks for them (`archived`: parseQuery's, an is:archived). */
export const onBoard = (threads, archived = false) => (archived ? threads : threads.filter((th) => !th.settled));

/** The columns of `field`, [{ key, threads }], in `sort`'s order (ties: by need), the snoozed at the end,
 *  soonest due first, as the sidebar shelves them. `values`: the columns, when lanes share them. */
export function columns(threads, field = "status", { pins = [], sort = "activity", firstSeen = {}, values } = {}) {
  const f = FIELDS[field] ?? FIELDS.status;
  const cols = (values ?? f.values(threads)).map((key) => ({ key, threads: [] }));
  const of = new Map(cols.map((c) => [c.key, c]));
  const by = SORTS[sort];
  const order = by ? sortByNeed(threads, pins).sort((a, b) => by(a, b, { firstSeen })) : sortByNeed(threads, pins);
  for (const th of order) of.get(f.of(th))?.threads.push(th);
  for (const c of cols) {
    // The drafts first (what is to start next), the snoozed last.
    const asleep = c.threads.filter((th) => th.asleep).sort((a, b) => a.snooze.until - b.snooze.until);
    c.threads = [...c.threads.filter((th) => th.draft), ...c.threads.filter((th) => !th.asleep && !th.draft), ...asleep];
  }
  return cols;
}

// ---------- a card's menu (right-click or m) ----------

/** A card's actions, in order: [{ key, option?, label?, tone?, hint?, sep? }] (main.js says and runs
 *  them; `hint`, the key that runs it while the menu shows, as in the drawer). A blocked agent's choices
 *  first (decide.js' options; answered by its own press(), the sidebar's path); blocked with none,
 *  « go to the agent » leads anyway. Then the drawer, pin, snooze (the sidebar's three) or wake, archive
 *  or bring back, the PR and the issue once their address is known, Zed (a local checkout), copy the
 *  branch; last, set apart, close the thread (kt-confirm). A draft: launch, edit, delete.
 *  `decision`: decide.js' for this agent. */
export function cardMenu(th, { decision = null, prUrl = null, issueUrl = null } = {}) {
  if (th.draft) return [{ key: "launch", hint: "L" }, { key: "edit", hint: "i" }, { key: "deleteDraft", hint: "x", tone: "danger", sep: true }];
  const options = th.status === "blocked" ? decision?.pending?.options ?? [] : [];
  const choices = options.map((o) => ({ key: `decide:${o.key}`, option: o.key, label: o.label ?? o.key, tone: o.tone === "positive" ? "positive" : "negative" }));
  return [
    ...choices,
    { key: "go", sep: choices.length > 0 },
    { key: "drawer", hint: "o" },
    { key: th.pinned ? "unpin" : "pin", hint: "p" },
    ...(th.asleep ? [{ key: "wake", hint: "0" }] : SNOOZES.map((c, i) => ({ key: `snooze:${c}`, hint: String(i + 1) }))),
    { key: th.settled ? "unarchive" : "archive" },
    ...(prUrl ? [{ key: "openPr", hint: "O" }] : []),
    ...(issueUrl ? [{ key: "openIssue", hint: "I" }] : []),
    ...(th.cwd && !th.space?.machine ? [{ key: "zed", hint: "e" }] : []),
    ...(th.branch ? [{ key: "copyBranch" }] : []),
    { key: "close", tone: "danger", sep: true },
  ];
}

/** Arriving on the page, the keyboard comes to it only while it still shows, doesn't have it yet, and
 *  herdr-app status says no overlay is open (a dialog, a popup); a status it couldn't read: it stays put. */
export const takesFocus = ({ visible, focused, status }) =>
  Boolean(visible) && !focused && Array.isArray(status?.overlays) && status.overlays.length === 0;

/** Where the menu's highlight starts: the first item that answers nothing (go, or launch), so that m
 *  then enter never accepts a permission by accident; a choice is one k, or a click, away. */
export const menuStart = (items) => (items.find((i) => !i.option) ?? items[0])?.key ?? null;

// ---------- drafts (GitHub Projects' draft items): an idea that isn't a thread yet ----------
// Stored in shared "kt.kanban.drafts": [{ id, title, task, space, project, at }]: its title, its consigne
// (multi-line), the space it was made in, its project as it was then ({ key, name, color, logo, home }),
// when. A card like a thread's, with no agent, flow, cost nor PR: in Inactif (status) or Sans flow
// (phase), with the other fields as any card; never archived; outside the limits.

/** A draft as a card (`draft: true`); a title "#N …" is that issue's. */
export function draftThread(d) {
  return {
    id: d.id, draft: true, title: String(d.title ?? ""), task: String(d.task ?? ""), from: d.space ?? null, space: null, tab: null, lead: null, agent: null,
    status: null, flow: null, cost: null, model: null, ctx: null, sl: null, activity: d.at ?? 0, settled: false, asleep: false, snooze: null,
    pinned: false, shown: false, branch: null, worktree: null, cwd: null, terminal: null, program: null, agentKey: null,
    issue: String(d.title ?? "").match(/^#(\d+)/)?.[1] ?? null, pr: null, prFrom: null,
    project: d.project ?? { key: "none", name: "", home: false, color: null, logo: null },
    subagents: { shown: [], done: 0, total: 0 },
  };
}

/** The drafts stored, as cards. */
export const draftsOf = (stored) => (Array.isArray(stored) ? stored : []).filter((d) => d && typeof d.id === "string").map(draftThread);

/** The thread a launched draft became (kt-new's record, shared "kt.kanban.launched": { tab, space,
 *  folder, machine }): the one whose tab has that name, in that space, or in that worktree's when kt-new
 *  made a space; null while it isn't there, or when two could be it (no guess). */
export function attach(threads, rec) {
  if (!rec?.tab) return null;
  const hits = threads.filter((th) => !th.draft && th.tab?.name === rec.tab
    && (rec.space ? th.space.id === rec.space : th.space.folder === rec.folder && (th.space.machine ?? null) === (rec.machine ?? null)));
  return hits.length === 1 ? hits[0].id : null;
}

// ---------- auto-archive ----------

/** The threads to archive (tab.settle, the sidebar's archive: a display state, nothing closes): its PR
 *  merged, seen (no longer done: looked at; nor working nor blocked), idle `days` days since its last
 *  activity; never a pinned, shown, archived one, a draft, nor one in `skip` (archived once already:
 *  brought back by hand, it stays). `days` 0: none. */
export const toArchive = (threads, { days, now, skip = new Set() }) => (!(days > 0) ? [] : threads
  .filter((th) => !th.draft && !th.settled && !th.pinned && !th.shown && !skip.has(th.id) && th.pr?.state === "MERGED"
    && (th.status === "idle" || th.status == null) && now - th.activity >= days * 86400e3)
  .map((th) => th.id));

/** What auto-archive does now, from its memo (shared "kt.kanban.autoArchived": { since, done }): `since`,
 *  when it was taken on (absent: now, the first pass); `done`, the threads it archived or was told to
 *  leave. A thread that crossed its N days after `since` is archived on its own (`auto`); one already
 *  past them before (all of them, on the first pass, whatever the PRs read so far) is only proposed
 *  (`propose`): the person archives or leaves them with a click. Never twice the same. */
export function archivePlan(threads, { days, now, memo = null }) {
  const since = memo?.since ?? now;
  const done = new Set(Object.keys(memo?.done ?? {}));
  const byId = new Map(threads.map((th) => [th.id, th]));
  const ids = toArchive(threads, { days, now, skip: done });
  const crossed = (id) => byId.get(id).activity + days * 86400e3;
  return { auto: ids.filter((id) => crossed(id) >= since), propose: ids.filter((id) => crossed(id) < since) };
}

/** The board: its column keys and its lanes, [{ key, project, count, open, cols }]. No group: one lane
 *  (key "all"). By project: one per project, Home first, then those that need you, then the registry's
 *  order (threads-model's projectGroups); a lane only while it has a thread. `folded`: lane keys shut.
 *  `hidden`: column keys left out (their cards with them; never all of them); `all`, every column of the
 *  field, and `counts`, the cards each holds, say them in the reminder and the panel. */
export function board(threads, { field = "status", group = "none", sort = "activity", pins = [], firstSeen = {}, registry = [], folded = new Set(), hidden = [] } = {}) {
  const f = FIELDS[field] ?? FIELDS.status;
  const all = f.values(threads);
  const keys = all.some((k) => !hidden.includes(k)) ? all.filter((k) => !hidden.includes(k)) : all;
  const counts = Object.fromEntries(all.map((k) => [k, threads.filter((th) => f.of(th) === k).length]));
  const lane = (key, list, project) => ({ key, project, count: list.length, open: !folded.has(key), cols: columns(list, field, { pins, sort, firstSeen, values: keys }) });
  if (group !== "project") return { keys, all, counts, lanes: [lane("all", threads, null)] };
  return { keys, all, counts, lanes: projectGroups(threads, pins, registry).map((g) => lane(g.key, g.threads, g.threads[0].project)) };
}

// Slice by: a field's value per thread, { key, name } (the program by its key; none without an agent).
const SLICES = {
  project: (th) => ({ key: th.project.key, name: th.project.name, project: th.project }),
  program: (th) => (th.agentKey ? { key: th.agentKey, name: th.program?.name ?? th.agentKey, program: th.program } : { key: "none", name: null }),
};
const sliceOf = (th, field) => (SLICES[field] ?? SLICES.project)(th);

/** The values of a slice field over `threads`, with their counts, the most used first (then by name),
 *  the unnamed last (no agent); the picked one kept at 0 when nothing has it any more (to let it go). */
export function slices(threads, field, pick = null) {
  const map = new Map();
  for (const th of threads) {
    const s = sliceOf(th, field);
    const v = map.get(s.key) ?? { ...s, count: 0 };
    v.count++;
    map.set(s.key, v);
  }
  if (pick != null && !map.has(pick)) map.set(pick, { key: pick, name: null, count: 0 });
  return [...map.values()].sort((a, b) => (a.name == null) - (b.name == null) || b.count - a.count
    || (text(a.name) < text(b.name) ? -1 : text(a.name) > text(b.name) ? 1 : 0));
}

/** The threads of the picked value (none picked: all). */
export const sliced = (threads, field, pick) => (pick == null ? threads : threads.filter((th) => sliceOf(th, field).key === pick));

// ---------- the filter (`/`): GitHub Projects' syntax ----------
// Free words (in the title, project, branch, program, #issue or #PR) and `field:value` terms, all of
// them to match; `-` before either negates it; "quotes" keep spaces (project:"my app", "two words");
// `a,b` in a value: one or the other. A field it doesn't know, or a value it can't read, is set aside
// (`issues`, said in the header) and the rest still filters; a field typed without its value yet
// (`status:`) is skipped quietly.
//   status:blocked|done|working|idle   phase:prep|spec|impl|ship|close|other|none
//   project:<in its name>|@current     agent:<program key or name>|none   branch:<in it>|none
//   pr:open|draft|merged|closed|none   is:pinned|snoozed|draft|archived (the archived show only with it)
//   cost:>5  cost:<=1,5  cost:2..10  cost:3   age:<1h  age:>2d  age:1h..1d (s, m, h, d or j, w)

/** The query's tokens: { neg, field, value, quoted }; a `field:` only outside quotes. */
export function tokens(text) {
  const out = [];
  let t = null;
  let quoted = false;
  for (const ch of String(text ?? "")) {
    if (!quoted && /\s/.test(ch)) {
      if (t) out.push(t);
      t = null;
      continue;
    }
    t ??= { neg: false, field: null, value: "", quoted: false };
    if (ch === '"') { quoted = !quoted; t.quoted = true; continue; }
    if (!quoted && ch === "-" && !t.neg && !t.field && !t.value && !t.quoted) { t.neg = true; continue; }
    if (!quoted && ch === ":" && !t.field && !t.quoted && /^[a-z]+$/i.test(t.value)) { t.field = t.value.toLowerCase(); t.value = ""; continue; }
    t.value += ch;
  }
  if (t) out.push(t);
  return out;
}

// A bound: >x, >=x, <x, <=x, a..b (an end may be left open), or x alone (`plain`: its meaning, or null
// when the field takes none). `num` reads one value, null when it can't.
function bound(v, num, plain) {
  let m = v.match(/^(>=|<=|>|<)(.+)$/);
  if (m) {
    const x = num(m[2]);
    return x == null ? null : { op: m[1], x };
  }
  m = v.match(/^(.*)\.\.(.*)$/);
  if (m) {
    const a = m[1] ? num(m[1]) : -Infinity, b = m[2] ? num(m[2]) : Infinity;
    return a == null || b == null || (!m[1] && !m[2]) ? null : { op: "..", a, b };
  }
  const x = num(v);
  return x == null || !plain ? null : { op: plain, x };
}
const within = (r, v) => (r.op === ">" ? v > r.x : r.op === ">=" ? v >= r.x : r.op === "<" ? v < r.x : r.op === "<=" ? v <= r.x
  : r.op === ".." ? v >= r.a && v <= r.b : Math.abs(v - r.x) < 0.005);
const money = (s) => (/^\$?\d+(?:[.,]\d+)?$/.test(s) ? Number(s.replace("$", "").replace(",", ".")) : null);
const UNIT = { s: 1e3, m: 60e3, min: 60e3, h: 3600e3, d: 86400e3, j: 86400e3, w: 604800e3, sem: 604800e3 };
const span = (s) => {
  const m = s.match(/^(\d+(?:[.,]\d+)?)(s|min|m|h|d|j|w|sem)$/);
  return m ? Number(m[1].replace(",", ".")) * UNIT[m[2]] : null;
};
const PR_STATE = { open: "OPEN", merged: "MERGED", closed: "CLOSED" };

// Each field: the value read into a test (th, ctx) => boolean, or null when it can't be read.
// `ctx`: { now, current: the shown project's key (project:@current) }.
const oneOf = (v, ok) => {
  const list = v.toLowerCase().split(",").filter(Boolean);
  return list.length && list.every(ok) ? list : null;
};
const TERMS = {
  status: (v) => { const l = oneOf(v, (x) => STATUSES.includes(x)); return l && ((th) => l.includes(FIELDS.status.of(th))); },
  phase: (v) => { const l = oneOf(v, (x) => [...PHASE_IDS, "other", "none"].includes(x)); return l && ((th) => l.includes(phaseOf(th))); },
  project: (v) => {
    const l = oneOf(v, () => true);
    return l && ((th, ctx) => l.some((x) => (x === "@current" ? th.project?.key === ctx.current : text(th.project?.name).includes(x))));
  },
  agent: (v) => {
    const l = oneOf(v, () => true);
    return l && ((th) => l.some((x) => (x === "none" ? !th.agentKey : Boolean(th.agentKey) && (th.agentKey === x || text(th.program?.name).includes(x)))));
  },
  branch: (v) => { const l = oneOf(v, () => true); return l && ((th) => l.some((x) => (x === "none" ? !th.branch : text(th.branch).includes(x)))); },
  pr: (v) => {
    const l = oneOf(v, (x) => x === "none" || x === "draft" || x in PR_STATE);
    return l && ((th) => l.some((x) => (x === "none" ? !th.pr : x === "draft" ? th.pr?.state === "OPEN" && Boolean(th.pr.draft ?? th.pr.isDraft) : th.pr?.state === PR_STATE[x])));
  },
  is: (v) => {
    const l = oneOf(v, (x) => ["pinned", "snoozed", "archived", "draft"].includes(x));
    return l && ((th) => l.some((x) => (x === "pinned" ? th.pinned : x === "snoozed" ? th.asleep : x === "draft" ? th.draft : th.settled)));
  },
  // cost: an unknown cost never matches a bound (its negation does)
  cost: (v) => { const r = bound(v, money, "="); return r && ((th) => th.cost != null && within(r, th.cost)); },
  // age: since its last activity, as the card says; a bare duration means nothing (<, > or a range)
  age: (v) => { const r = bound(v, span, null); return r && ((th, ctx) => within(r, ctx.now - th.activity)); },
};
export const FILTER_FIELDS = Object.keys(TERMS);

/** The query read: { terms: [{ field, neg, test }], words: [{ text, neg }], issues: [{ kind: "field" |
 *  "value", field, value }], archived: an `is:archived` asks for the archived (else onBoard leaves them
 *  out), current: a `project:@current` (the page takes that project's color) }. */
export function parseQuery(query) {
  const out = { terms: [], words: [], issues: [], archived: false, current: false };
  for (const tk of tokens(query)) {
    if (!tk.field) {
      if (tk.value) out.words.push({ text: tk.value.toLowerCase(), neg: tk.neg });
      continue;
    }
    if (!(tk.field in TERMS)) out.issues.push({ kind: "field", field: tk.field, value: tk.value });
    else if (!tk.value) continue; // still typing it
    else {
      const test = TERMS[tk.field](tk.value);
      if (!test) {
        out.issues.push({ kind: "value", field: tk.field, value: tk.value });
        continue;
      }
      out.terms.push({ field: tk.field, neg: tk.neg, test });
      const has = (x) => !tk.neg && tk.value.toLowerCase().split(",").includes(x);
      if (tk.field === "is" && has("archived")) out.archived = true;
      if (tk.field === "project" && has("@current")) out.current = true;
    }
  }
  return out;
}

/** A thread through the query read (parseQuery): every term and every word, a negated one must not match. */
export function matchQuery(th, q, ctx = {}) {
  if (!q.terms.every((t) => t.test(th, ctx) !== t.neg)) return false;
  if (!q.words.length) return true;
  const hay = [th.title, th.project?.name, th.branch, th.program?.name, th.issue && `#${th.issue}`, th.pr && `#${th.pr.number}`, th.task]
    .filter(Boolean).join(" ").toLowerCase();
  return q.words.every((w) => hay.includes(w.text) !== w.neg);
}

// ---------- a card's drawer ----------

// gh pr checks' bucket -> viz.js steps' state (kt-inbox's), and the order the bar shows them in: what
// failed first, then what runs, what passed, what was skipped (then gh's order).
const CHECK = { pass: "done", fail: "failed", cancel: "failed", pending: "current", skipping: "skipped" }; // i18n: tech
const CHECK_RANK = { failed: 0, current: 1, done: 2, skipped: 3, todo: 4 };
/** A PR's checks as viz.js steps: [{ label, state }]. */
export const checkSteps = (checks) => (checks ?? []).map((c, i) => ({ label: c.name ?? "", state: CHECK[c.bucket] ?? "todo", i }))
  .sort((a, b) => CHECK_RANK[a.state] - CHECK_RANK[b.state] || a.i - b.i).map(({ label, state }) => ({ label, state }));

/** A PR's checks counted as /me:report's CI is ({ ok, fail, pending, total }); null with none. */
export function ciCount(checks) {
  if (!checks?.length) return null;
  const n = (s) => checkSteps(checks).filter((c) => c.state === s).length;
  return { ok: n("done"), fail: n("failed"), pending: n("current"), total: checks.length };
}

// Snooze (the sidebar's choices): an hour; tonight, 19:00; tomorrow, 9:00 (an hour already past: the next day's).
export const SNOOZES = ["hour", "tonight", "tomorrow"];
// `day`'s `hour`, the next day's when that is already past `now` (kt-threads' at()).
const hourOf = (day, hour, now) => {
  const d = new Date(day);
  d.setHours(hour, 0, 0, 0);
  return d.getTime() > now ? d.getTime() : d.getTime() + 86400e3;
};
/** When a snooze wakes, from `now`. */
export const wakeAt = (choice, now) => (choice === "hour" ? now + 3600e3 : choice === "tonight" ? hourOf(now, 19, now) : hourOf(now + 86400e3, 9, now));

// ---------- the columns' figures: the cost, the soft limit (WIP) ----------

/** What a column's cards cost together (the known costs), to the cent. */
export const costOf = (threads) => Math.round(threads.reduce((s, th) => s + (th.cost ?? 0), 0) * 100) / 100;

/** The limits kept: whole numbers from 1, by column key. */
export const cleanLimits = (limits) => Object.fromEntries(Object.entries(limits ?? {})
  .filter(([, n]) => Number.isInteger(n) && n > 0).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));

/** + / - on a column's limit: none yet, + sets it to its cards now (at least 1), - does nothing; down
 *  to 0, it goes. A limit never blocks anything: over it, the head only says so. */
export function stepLimit(limits, key, delta, count = 0) {
  const now = limits?.[key];
  const next = now ? now + delta : delta > 0 ? Math.max(1, count) : 0;
  return cleanLimits({ ...limits, [key]: next });
}

// ---------- a card's session (#38): what it unfolds on hover, as the sidebar's focus card ----------

/** The session's facts (statusline's `sl`, the quota's windows), at `now`: model · effort, the context
 *  (pct, its window), the 5 h window, else the 7 d one (pct, resets_at in s), the cost, how long it has
 *  run (ms), the lines +/−, the prompt cache's time left (s) and its hit when under 85 %. null without
 *  a statusline. */
export function sessionOf(th, quota, now) {
  const s = th?.sl;
  if (!s) return null;
  const win = (name) => {
    const w = quota?.[name] ?? quota?.rate_limits?.[name];
    return w && w.resets_at * 1000 > now ? w : null;
  };
  const five = win("five_hour");
  const week = five ? null : win("seven_day");
  const q = five ?? week;
  return {
    model: [s.model, s.effort].filter(Boolean).join(" · ") || null,
    ctx: s.ctx_pct ?? null,
    window: s.window ?? null,
    quota: q ? { kind: five ? "5h" : "7d", pct: q.used_percentage, resets: q.resets_at } : null,
    cost: s.cost_usd ?? null,
    ran: s.duration_ms > 0 ? s.duration_ms : null,
    added: s.lines_added ?? 0,
    removed: s.lines_removed ?? 0,
    ttl: s.cache_at && s.cache_ttl ? s.cache_at / 1000 + s.cache_ttl - now / 1000 : null,
    hit: s.hit_pct != null && s.hit_pct < 85 ? s.hit_pct : null,
  };
}

/** The cache's time left as the sidebar says it: "TTL 1h05", "TTL 12m"; spent: null. */
export const ttlText = (sec) => (!(sec > 0) ? null : `TTL ${sec >= 3600 ? `${Math.floor(sec / 3600)}h${String(Math.floor((sec % 3600) / 60)).padStart(2, "0")}` : `${Math.ceil(sec / 60)}m`}`);

// ---------- the board's look (#34): column widths, hidden columns ----------

/** A column's width: auto (it shares the board, `auto` px at least) or set, `min` to `max`, by `step`. */
export const WIDTH = { min: 200, max: 420, step: 20, auto: 240 };

/** The widths kept: whole px within bounds, by column key. */
export const cleanWidths = (widths) => Object.fromEntries(Object.entries(widths ?? {})
  .filter(([, w]) => Number.isInteger(w) && w >= WIDTH.min && w <= WIDTH.max).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));

const clampW = (w) => Math.min(WIDTH.max, Math.max(WIDTH.min, w));

/** < / > on a column, or on each of several (`keys`): a step narrower / wider; an auto column steps from
 *  the width it is drawn at (`shown`, px by key: an auto column shares the board, often wider than 240),
 *  rounded to a step and kept in bounds, else from auto's least width; 0 (=): back to auto. */
export function stepWidth(widths, keys, delta, shown = {}) {
  const next = { ...widths };
  for (const k of [].concat(keys)) {
    if (!delta) delete next[k];
    else next[k] = clampW((widths?.[k] ?? clampW(Math.round((shown?.[k] ?? WIDTH.auto) / WIDTH.step) * WIDTH.step)) + delta * WIDTH.step);
  }
  return cleanWidths(next);
}

/** By project, a width per column (the lanes share them): a set one as set; the auto ones split what is
 *  left of `avail` after the set ones and the gaps, `auto` px at least. */
export function laneWidths(keys, widths, avail, gap = 4) {
  const set = keys.map((k) => widths?.[k] ?? null);
  const autos = set.filter((w) => w == null).length;
  const left = avail - gap * Math.max(0, keys.length - 1) - set.reduce((s, w) => s + (w ?? 0), 0);
  const auto = autos ? Math.max(WIDTH.auto, Math.floor(left / autos)) : 0;
  return set.map((w) => w ?? auto);
}

/** The hidden columns kept: column keys, once each, sorted (two views compare as text). */
export const cleanHidden = (hidden) => [...new Set((Array.isArray(hidden) ? hidden : []).filter((k) => typeof k === "string"))].sort();

/** A column hidden, or shown again; the last one showing of `keys` (the field's columns) stays. */
export function toggleHidden(hidden, key, keys) {
  const now = cleanHidden(hidden);
  if (now.includes(key)) return now.filter((k) => k !== key);
  return keys.some((k) => k !== key && !now.includes(k)) ? cleanHidden([...now, key]) : now;
}

// ---------- saved views (tabs) ----------
// A view: { id, name (null: the default's name, said in the language shown), column, group, slice,
// pick (the slice's value), sort, density, filter, limits, widths, hidden }. Stored in shared "kt.kanban.views" as { current,
// list }; nothing stored: the default views. What shows is the view's settings until one changes (then
// the tab says it is modified), saved into it, or discarded (the view applied again).

export const DEFAULT_VIEWS = [
  { id: "all", name: null, filter: "" },
  { id: "blocked", name: null, filter: "status:blocked" },
  { id: "project", name: null, filter: "project:@current" },
];

/** A view's settings, complete and checked, in one order (so two of them compare as text). */
export function settingsOf(v) {
  const slice = choice("slice", v?.slice);
  return {
    column: choice("column", v?.column), group: choice("group", v?.group), slice,
    pick: slice === "none" ? null : v?.pick ?? null, sort: choice("sort", v?.sort), density: choice("density", v?.density),
    filter: String(v?.filter ?? "").trim(), limits: cleanLimits(v?.limits), widths: cleanWidths(v?.widths), hidden: cleanHidden(v?.hidden),
  };
}

/** The views stored, else the default ones: { current (a view's id), list }. */
export function viewsOf(stored) {
  const list = (Array.isArray(stored?.list) && stored.list.length ? stored.list : DEFAULT_VIEWS)
    .filter((v) => v && typeof v.id === "string")
    .map((v) => ({ id: v.id, name: typeof v.name === "string" && v.name.trim() ? v.name.trim() : null, ...settingsOf(v) }));
  if (!list.length) return viewsOf(null);
  return { current: list.some((v) => v.id === stored?.current) ? stored.current : list[0].id, list };
}

export const currentView = (views) => views.list.find((v) => v.id === views.current) ?? views.list[0];

/** What shows differs from the saved view: the tab's dot. */
export const dirty = (view, live) => JSON.stringify(settingsOf(view)) !== JSON.stringify(settingsOf(live));

const put = (views, list, current = views.current) => ({ current, list });
/** What shows, saved into the current view. */
export const saveView = (views, live) => put(views, views.list.map((v) => (v.id === views.current ? { ...v, ...settingsOf(live) } : v)));
/** A new view from what shows, after the current one, made current. */
export function addView(views, live, id, name) {
  const at = views.list.findIndex((v) => v.id === views.current) + 1;
  return put(views, [...views.list.slice(0, at), { id, name, ...settingsOf(live) }, ...views.list.slice(at)], id);
}
/** A copy of the view `of` (as saved), after it, made current. */
export function duplicateView(views, of, id, name) {
  const at = views.list.findIndex((v) => v.id === of);
  if (at < 0) return views;
  return put(views, [...views.list.slice(0, at + 1), { ...views.list[at], id, name }, ...views.list.slice(at + 1)], id);
}
/** A view's new name; an empty one changes nothing. */
export const renameView = (views, id, name) => (String(name ?? "").trim()
  ? put(views, views.list.map((v) => (v.id === id ? { ...v, name: String(name).trim() } : v))) : views);
/** A view gone; the last one stays. The current one gone: the next, else the one before. */
export function deleteView(views, id) {
  const at = views.list.findIndex((v) => v.id === id);
  if (at < 0 || views.list.length < 2) return views;
  const list = views.list.filter((v) => v.id !== id);
  return put(views, list, views.current === id ? (list[at] ?? list[at - 1]).id : views.current);
}
/** gt / gT: the next / previous view's id, round. */
export const stepView = (views, dir) => {
  const i = views.list.findIndex((v) => v.id === views.current);
  return views.list[(i + dir + views.list.length) % views.list.length].id;
};

// ---------- the keys' cursor: { l: lane, c: column, i: card } (i -1: no card) ----------

/** Where the cursor is: the thread `id` where it is now (a card that changed column or lane takes the
 *  cursor along; one in a folded lane is out of reach); gone, the same place (`last`), clamped; else the
 *  first card of the first open lane that has one. */
export function locate(b, id, last = null) {
  for (let l = 0; l < b.lanes.length; l++) {
    if (!b.lanes[l].open) continue;
    for (let c = 0; c < b.lanes[l].cols.length; c++) {
      const i = b.lanes[l].cols[c].threads.findIndex((th) => th.id === id);
      if (i >= 0) return { l, c, i };
    }
  }
  const n = last && b.lanes[last.l]?.open ? b.lanes[last.l].cols[last.c]?.threads.length ?? 0 : 0;
  if (n) return { l: last.l, c: last.c, i: Math.max(0, Math.min(last.i, n - 1)) };
  for (let l = 0; l < b.lanes.length; l++) {
    const c = b.lanes[l].open ? b.lanes[l].cols.findIndex((col) => col.threads.length > 0) : -1;
    if (c >= 0) return { l, c, i: 0 };
  }
  return { l: 0, c: Math.max(0, Math.min(last?.c ?? 0, b.keys.length - 1)), i: -1 };
}

// h / l and tab / shift-tab: a column; j / k, n / N, gg / G, ctrl-d / u: a card in it, down across lanes.
const SIDE = { left: -1, right: 1, "tab-prev": -1, "tab-next": 1 };
const DOWN = { next: "down", prev: "up" };

/** The cursor after a vim action. Across columns: in its lane, the next one that has a card (an empty
 *  one is skipped), at the same row or its last; at an end, it stays. Down a column: vim's step over its
 *  cards in every open lane, top to bottom. `page`: the cards a screen shows. */
export function move(b, at, action, count = 1, page = 8) {
  const dir = SIDE[action];
  const cols = b.lanes[at.l]?.cols ?? [];
  if (dir) {
    let c = at.c;
    for (let k = 0; k < count; k++) {
      let j = c + dir;
      while (j >= 0 && j < cols.length && !cols[j].threads.length) j += dir;
      if (j < 0 || j >= cols.length) break;
      c = j;
    }
    const n = cols[c]?.threads.length ?? 0;
    return c === at.c ? at : { l: at.l, c, i: n ? Math.min(Math.max(at.i, 0), n - 1) : -1 };
  }
  const down = b.lanes.flatMap((lane, l) => (lane.open ? (lane.cols[at.c]?.threads ?? []).map((_th, i) => ({ l, c: at.c, i })) : []));
  const j = step(DOWN[action] ?? action, down.findIndex((p) => p.l === at.l && p.i === at.i), down.length, count, page);
  return j >= 0 ? down[j] : at;
}

/** The thread under the cursor, or null. */
export const atCard = (b, at) => b.lanes[at.l]?.cols[at.c]?.threads[at.i] ?? null;
