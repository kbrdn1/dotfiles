// bun ~/.config/herdr-app/mods/kt-chat/shelf.check.mjs: shelf.js (#84), the composer's ledges. The
// sub-agents' rules are proven equal to kt-threads' threads-model.js (the sidebar's), on the same rows.
// Made-up rows, no real id.
import assert from "node:assert/strict";
import * as S from "./shelf.js";
import * as M from "../kt-threads/threads-model.js";

const now = 1_000_000_000;
const min = 60e3;
const rows = [
  { id: "a1", name: "un", what: "Lire", state: "running", startedAt: now - 3 * min },
  { id: "a2", name: "deux", what: "Chercher", state: "background", startedAt: now - 10 * min },
  { id: "a3", name: "trois", what: "Écrire", state: "done", startedAt: now - 20 * min, endedAt: now - 2 * min },
  { id: "a4", name: "quatre", what: "Vérifier", state: "error", startedAt: now - 30 * min, endedAt: now - 30 * 1000 },
  { id: "a5", name: "cinq", what: "Vieux", state: "done", startedAt: now - 60 * min, endedAt: now - 6 * min },
  { id: "a6", what: "Ancien format", state: "running", at: now - 5 * min }, // a 0.3.0 bridge: `at` only
  { id: "a7", what: "Ancien fini", state: "done", at: now - 4 * min },
];

// ── The same rules as the sidebar's ─────────────────────────────────────────
assert.equal(S.FADE, M.FADE);
assert.equal(S.GONE, M.GONE);
for (const a of rows) {
  assert.equal(S.startOf(a), M.startOf(a), `startOf ${a.id}`);
  assert.equal(S.endOf(a), M.endOf(a), `endOf ${a.id}`);
  assert.equal(S.isAlive(a), M.isAlive(a), `isAlive ${a.id}`);
  for (const t of [now, now + 2 * min, now + 6 * min, now + 26 * 3600e3]) assert.equal(S.agentAge(a, t), M.agentAge(a, t), `agentAge ${a.id} at ${t}`);
}
for (const t of [now, now + 4 * min, now + 10 * min]) assert.deepEqual(S.shownAgents(rows, t).map((a) => a.id), M.shownAgents(rows, t).map((a) => a.id), `shownAgents at ${t}`);
for (const ms of [0, now - 30e3, now - 5 * min, now - 3 * 3600e3, now - 3 * 86400e3]) assert.equal(S.age(ms, now), M.age(ms, now));
assert.deepEqual(S.shownAgents(null, now), M.shownAgents(null, now));

// ── The sub-agents' ledge ───────────────────────────────────────────────────
const led = S.agentsLedge(rows, now, "t9");
assert.deepEqual(led.rows.map((a) => a.id), ["a1", "a6", "a2", "a4", "a3", "a7"], "running, background, then the latest ended; a5 ended over 5 min ago: gone");
assert.equal(led.alive, 3);
assert.deepEqual(led.kin, ["t9:a5", "t9:a4", "t9:a3", "t9:a2", "t9:a6", "t9:a7", "t9:a1"], "the coiffes' siblings: the whole list, oldest first");
assert.equal(S.agentsLedge([], now, "t9"), null, "none: nothing drawn");
assert.equal(S.agentsLedge(null, now, "t9"), null);
assert.equal(S.agentsLedge([rows[4]], now, "t9"), null, "only one ended long ago: nothing");

// ── When the bridge file is read again on a timer ───────────────────────────
const w = (o) => S.watching({ address: "t9", shown: true, status: "idle", agents: [], now, ...o });
assert.equal(w({ status: "working" }), true, "the agent works");
assert.equal(w({}), false, "at rest, no sub-agent: nothing runs");
assert.equal(w({ agents: [rows[1]] }), true, "at rest, a background sub-agent alive");
assert.equal(w({ agents: [rows[2]] }), true, "at rest, one ended 2 min ago, still shown: its age, then its going");
assert.equal(w({ agents: [rows[2]], now: now + 4 * min }), false, "the same past GONE: nothing runs");
assert.equal(w({ status: "working", shown: false }), false, "this face hidden");
assert.equal(w({ status: "working", address: null }), false, "no agent (a fixed file)");
assert.equal(w({ status: "working", address: "vps/t3" }), false, "another machine's agent: its file is there");

// ── The tasks' ledge ────────────────────────────────────────────────────────
const item = (content, status, activeForm) => ({ content, status, ...(activeForm ? { activeForm } : {}) });
const three = { done: 1, total: 3, current: "Compter", items: [item("Dire bonjour", "completed"), item("Compter jusqu'à trois", "in_progress", "Compte jusqu'à trois"), item("Dire au revoir", "pending")] };
const t3 = S.tasksLedge(three);
assert.equal(t3.done, 1);
assert.equal(t3.total, 3);
assert.equal(t3.current, "Compte jusqu'à trois", "the running one, by its activeForm");
assert.equal(t3.rows.length, 3);
assert.equal(t3.more, 0);
assert.equal(t3.live, true);
assert.equal(S.tasksLedge({ done: 3, total: 3, items: three.items.map((x) => ({ ...x, status: "completed" })) }), null, "all done: hidden");
assert.equal(S.tasksLedge({ done: 0, total: 0, items: [] }), null, "none: nothing");
assert.equal(S.tasksLedge(undefined), null, "no todos in the file (an old bridge, or a reload): nothing");
const waiting = S.tasksLedge({ total: 2, items: [item("A", "completed"), item("B", "pending")] });
assert.equal(waiting.current, "B", "none running: the next to do");
assert.equal(waiting.done, 1, "done counted from the items when the bridge leaves it out");
assert.equal(waiting.live, false);
const many = { done: 8, total: 25, items: Array.from({ length: 20 }, (_, i) => item(`T${i}`, i < 8 ? "completed" : i === 8 ? "in_progress" : "pending")) };
const t25 = S.tasksLedge(many);
assert.deepEqual(t25.rows.map((x) => x.content), ["T7", "T8", "T9", "T10", "T11", "T12"], "six from the one before the first not done (the sidebar's window)");
assert.equal(t25.more, 19, "the rest, the bridge's total counted (it publishes 20 items at most)");
const short = S.tasksLedge({ done: 20, total: 22, current: "La 21e", items: Array.from({ length: 20 }, (_, i) => item(`T${i}`, "completed")) });
assert.equal(short.current, "La 21e", "the running one past the 20 items: the bridge's current");

// ── A row's run in the loaded turns ─────────────────────────────────────────
const turns = [
  { blocks: [{ role: "prose" }, { role: "tool", result: { agent: { id: "a3", type: "Explore", model: "haiku" } } }] },
  { blocks: [{ role: "tool", result: { agent: { id: "a1", type: "general-purpose", model: "opus" } } }] },
];
assert.equal(S.runOf(turns, "a1").type, "general-purpose");
assert.equal(S.runOf(turns, "a3").model, "haiku");
assert.equal(S.runOf(turns, "a2"), null, "its call older than the loaded turns: the bridge's facts only");
assert.equal(S.runOf(turns, null), null);
assert.equal(S.runOf(undefined, "a1"), null);

console.log("shelf.check: ok");
