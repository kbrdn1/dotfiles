// kanban.js: the Kanban's board, pure (no herdr, no gpui): which threads it shows, in which column and
// order, the text filter, and the keys' cursor across columns. The threads are threads-model.js'
// (a byte-identical copy of kt-threads'). Its check: bun mods/kt-kanban/kanban.check.mjs.
import { STATUSES, sortByNeed } from "./threads-model.js";
import { step } from "./vim.js";

// A column is a value of a field. One field today, the status; the next ones (#27: project, program,
// flow phase) go here. `values(threads)`: the columns in order; `of(thread)`: its column.
export const FIELDS = {
  status: { values: () => STATUSES, of: (th) => (STATUSES.includes(th.status) ? th.status : "idle") },
};

/** What the board shows: never an archived thread; the sidebar's archived view (its filter): only those. */
export const onBoard = (threads, archived = false) => threads.filter((th) => Boolean(th.settled) === Boolean(archived));

/** The columns of `field`, [{ key, threads }]: each in byNeed order (pinned, then the most recently
 *  active), the snoozed at the end, soonest due first, as the sidebar shelves them. */
export function columns(threads, field = "status", pins = []) {
  const f = FIELDS[field] ?? FIELDS.status;
  const cols = f.values(threads).map((key) => ({ key, threads: [] }));
  const of = new Map(cols.map((c) => [c.key, c]));
  for (const th of sortByNeed(threads, pins)) of.get(f.of(th))?.threads.push(th);
  for (const c of cols) {
    const asleep = c.threads.filter((th) => th.asleep).sort((a, b) => a.snooze.until - b.snooze.until);
    c.threads = [...c.threads.filter((th) => !th.asleep), ...asleep];
  }
  return cols;
}

/** The text filter: every word somewhere in the thread's title, project, branch, program, #issue or #PR. */
export function matches(th, query) {
  const words = String(query ?? "").toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const hay = [th.title, th.project?.name, th.branch, th.program?.name, th.issue && `#${th.issue}`, th.pr && `#${th.pr.number}`]
    .filter(Boolean).join(" ").toLowerCase();
  return words.every((w) => hay.includes(w));
}

/** Where the cursor is, { c: column, i: card } (i -1: no card). The thread `id` where it is now (a card
 *  that changed column takes the cursor along); gone, the same place in its column (`last`), clamped;
 *  else the first card of the first column that has one. */
export function locate(cols, id, last = null) {
  for (let c = 0; c < cols.length; c++) {
    const i = cols[c].threads.findIndex((th) => th.id === id);
    if (i >= 0) return { c, i };
  }
  const n = last ? cols[last.c]?.threads.length ?? 0 : 0;
  if (n) return { c: last.c, i: Math.max(0, Math.min(last.i, n - 1)) };
  const c = cols.findIndex((col) => col.threads.length > 0);
  return c >= 0 ? { c, i: 0 } : { c: Math.max(0, Math.min(last?.c ?? 0, cols.length - 1)), i: -1 };
}

// h / l and tab / shift-tab: a column; j / k, n / N, gg / G, ctrl-d / u: a card in it.
const SIDE = { left: -1, right: 1, "tab-prev": -1, "tab-next": 1 };
const DOWN = { next: "down", prev: "up" };

/** The cursor after a vim action: across columns, the next one that has a card (an empty column is
 *  skipped), at the same row or its last; down a column, vim's step. `page`: the cards a column shows. */
export function move(cols, at, action, count = 1, page = 8) {
  const dir = SIDE[action];
  if (dir) {
    let c = at.c;
    for (let k = 0; k < count; k++) {
      let j = c + dir;
      while (j >= 0 && j < cols.length && !cols[j].threads.length) j += dir;
      if (j < 0 || j >= cols.length) break;
      c = j;
    }
    const n = cols[c]?.threads.length ?? 0;
    return c === at.c ? at : { c, i: n ? Math.min(Math.max(at.i, 0), n - 1) : -1 };
  }
  const n = cols[at.c]?.threads.length ?? 0;
  const i = step(DOWN[action] ?? action, at.i, n, count, page);
  return { c: at.c, i };
}
