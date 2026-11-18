// kanban.js: the Kanban's board, pure (no herdr, no gpui): which threads it shows, sliced, grouped in
// lanes, in which column and order, the filter (`field:value` terms and words), the columns' cost and
// soft limits, the saved views, and the keys' cursor across columns and lanes.
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
    const asleep = c.threads.filter((th) => th.asleep).sort((a, b) => a.snooze.until - b.snooze.until);
    c.threads = [...c.threads.filter((th) => !th.asleep), ...asleep];
  }
  return cols;
}

/** The board: its column keys and its lanes, [{ key, project, count, open, cols }]. No group: one lane
 *  (key "all"). By project: one per project, Home first, then those that need you, then the registry's
 *  order (threads-model's projectGroups); a lane only while it has a thread. `folded`: lane keys shut. */
export function board(threads, { field = "status", group = "none", sort = "activity", pins = [], firstSeen = {}, registry = [], folded = new Set() } = {}) {
  const f = FIELDS[field] ?? FIELDS.status;
  const keys = f.values(threads);
  const lane = (key, list, project) => ({ key, project, count: list.length, open: !folded.has(key), cols: columns(list, field, { pins, sort, firstSeen, values: keys }) });
  if (group !== "project") return { keys, lanes: [lane("all", threads, null)] };
  return { keys, lanes: projectGroups(threads, pins, registry).map((g) => lane(g.key, g.threads, g.threads[0].project)) };
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
//   pr:open|draft|merged|closed|none   is:pinned|snoozed|archived (the archived show only with it)
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
    const l = oneOf(v, (x) => x === "pinned" || x === "snoozed" || x === "archived");
    return l && ((th) => l.some((x) => (x === "pinned" ? th.pinned : x === "snoozed" ? th.asleep : th.settled)));
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
  const hay = [th.title, th.project?.name, th.branch, th.program?.name, th.issue && `#${th.issue}`, th.pr && `#${th.pr.number}`]
    .filter(Boolean).join(" ").toLowerCase();
  return q.words.every((w) => hay.includes(w.text) !== w.neg);
}

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

// ---------- saved views (tabs) ----------
// A view: { id, name (null: the default's name, said in the language shown), column, group, slice,
// pick (the slice's value), sort, filter, limits }. Stored in shared "kt.kanban.views" as { current,
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
    pick: slice === "none" ? null : v?.pick ?? null, sort: choice("sort", v?.sort),
    filter: String(v?.filter ?? "").trim(), limits: cleanLimits(v?.limits),
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
