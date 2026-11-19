// shelf.js: the composer's ledges (#84), from the Chat's agent's herdr-bridge file
// (~/.claude/cache/herdr/<terminal>.json, the sidebar's own source, threads-io.js): its tasks on top of
// the card (`todos`), its sub-agents under it (`agents`). Pure, the facts passed in: checked under bun
// (shelf.check.mjs), the sub-agents' rules against kt-threads' threads-model.js, which they copy.

// ---------- sub-agents: threads-model.js's rules, word for word (the check proves them equal) ----------

// An ended one fades after FADE, goes after GONE. A 0.3.0 bridge's rows have `at` and no
// `startedAt` / `endedAt`.
export const FADE = 60e3;
export const GONE = 5 * 60e3;
export const startOf = (a) => a.startedAt ?? a.at ?? 0;
export const endOf = (a) => a.endedAt ?? startOf(a);
export const isAlive = (a) => a.state === "running" || a.state === "background";

/** The sub-agents still shown: the alive ones, then the ended until GONE after they ended; running,
 *  background, then the latest ended. */
export function shownAgents(list, now) {
  const order = { running: 0, background: 1 };
  return (list || []).filter((a) => isAlive(a) || now - endOf(a) < GONE)
    .sort((a, b) => (order[a.state] ?? 2) - (order[b.state] ?? 2) || endOf(b) - endOf(a));
}

export function age(ms, now = Date.now()) {
  if (!ms) return "";
  const s = Math.max(0, Math.floor((now - ms) / 1000));
  if (s < 60) return "now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return h < 24 ? `${h}h` : `${Math.floor(h / 24)}d`;
}

/** What a branch shows of its age ("now", "3m"), "~" once faded. */
export const agentAge = (a, now) => (isAlive(a) ? age(startOf(a), now) : `${age(endOf(a), now)}${now - endOf(a) > FADE ? "~" : ""}`);

// ---------- the ledges ----------

/**
 * The sub-agents' ledge: null when none is shown (nothing drawn); else the rows (shownAgents), how
 * many are alive, and `kin`: every row's key oldest first, the coiffes' siblings (variantFor), from
 * the bridge's whole list as the sidebar takes them.
 */
export function agentsLedge(list, now, key) {
  const rows = shownAgents(list, now);
  if (!rows.length) return null;
  const kin = [...(list || [])].sort((x, y) => startOf(x) - startOf(y)).map((s) => `${key}:${s.id}`);
  return { rows, alive: rows.filter(isAlive).length, kin };
}

/**
 * Whether the bridge file is read again on a timer: this face shows an agent of this computer
 * (`address`, a remote one's file is on its machine), and it works or shows sub-agents (their ages
 * move, an ended one goes after GONE). Else nothing runs.
 */
export function watching({ address, shown, status, agents, now, tasks = false }) {
  return Boolean(address) && !address.includes("/") && Boolean(shown) && (status === "working" || shownAgents(agents, now).length > 0 || tasks);
}

/** A task's words: its activeForm while it runs (the sidebar's todoList); `subject` in a session's plan. */
export const say = (x) => (x.status === "in_progress" ? x.activeForm || (x.content ?? x.subject) : (x.content ?? x.subject));

/**
 * Whose tasks the ledge shows: herdr-bridge's `todos` when it has some (items, or a total), else the
 * session's plan (data/kt-chat/plan/<terminal>.json, the same shape, kept by hand for a session with no
 * TaskCreate), when it has that shape (an object, its `items` an array), else none. { todos, plan, at }:
 * `plan` true when from the plan, `at` its updatedAt (ms) or null; the bridge, live, has no age.
 */
export function tasksOf(todos, plan) {
  const some = (x) => Boolean(x) && typeof x === "object" && ((Array.isArray(x.items) && x.items.length > 0) || Number(x.total) > 0);
  if (some(todos)) return { todos, plan: false, at: null };
  if (plan && typeof plan === "object" && Array.isArray(plan.items) && some(plan)) return { todos: plan, plan: true, at: Date.parse(plan.updatedAt) || null };
  return null;
}

/**
 * The tasks' ledge from herdr-bridge's `todos` ({ done, total, current, items, the first 20 }): null
 * when there are none, or all are done (hidden: the lead's arbitration). `front`: the running one,
 * else the next to do; `current`: its words (the bridge's own when the items stop short of it).
 * `rows`: six at most from the one before the first not done (the sidebar's window), `more` the rest.
 */
export function tasksLedge(todos) {
  const items = Array.isArray(todos?.items) ? todos.items : [];
  const total = Math.max(items.length, Number(todos?.total) || 0);
  if (!total) return null;
  const done = Number.isFinite(todos?.done) ? todos.done : items.filter((x) => x.status === "completed").length;
  if (done >= total) return null;
  const front = items.find((x) => x.status === "in_progress") ?? items.find((x) => x.status !== "completed") ?? null;
  const open = items.findIndex((x) => x.status !== "completed");
  const from = Math.max(0, Math.min((open < 0 ? items.length : open) - 1, items.length - 6));
  const rows = items.slice(from, from + 6);
  return { done, total, front, current: front ? say(front) : String(todos?.current ?? ""), rows, more: total - rows.length, live: items.some((x) => x.status === "in_progress") };
}

/**
 * The run a bridge row is, from its Agent call in the loaded turns (chat-index.ts keeps the result's
 * agentId, type, model, and the call's prompt): { id, name, type, model, status, block }, or null when
 * that call is older than what is loaded (the detail then says only what the bridge says).
 */
export function runOf(turns, id) {
  if (!id) return null;
  for (let i = (turns?.length ?? 0) - 1; i >= 0; i--) {
    for (const b of turns[i].blocks ?? []) {
      if (b?.role === "tool" && b.result?.agent?.id === id) return { ...b.result.agent, block: b };
    }
  }
  return null;
}
