// kanban.js: the Kanban's board, pure (no herdr, no gpui): which threads it shows, sliced, grouped in
// lanes, in which column and order, the text filter, and the keys' cursor across columns and lanes.
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

/** What the board shows: never an archived thread; the sidebar's archived view (its filter): only those. */
export const onBoard = (threads, archived = false) => threads.filter((th) => Boolean(th.settled) === Boolean(archived));

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

/** The text filter: every word somewhere in the thread's title, project, branch, program, #issue or #PR. */
export function matches(th, query) {
  const words = String(query ?? "").toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const hay = [th.title, th.project?.name, th.branch, th.program?.name, th.issue && `#${th.issue}`, th.pr && `#${th.pr.number}`]
    .filter(Boolean).join(" ").toLowerCase();
  return words.every((w) => hay.includes(w));
}

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
