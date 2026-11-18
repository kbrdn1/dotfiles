// bun ~/.config/herdr-app/mods/kt-threads/thread-filter.check.mjs : thread-filter.js. Not loaded by Herdr.
import assert from "node:assert/strict";
import { DEFAULT_FILTER, filterOf, filtering, groupOf, midnight, passes, byNeed, byProject, openFirst, moveInGroup } from "./thread-filter.js";

const now = new Date(2026, 10, 18, 15, 0).getTime();
const today = midnight(now);
const H = 3600e3;

assert.deepEqual(filterOf(null), DEFAULT_FILTER);
assert.deepEqual(filterOf({ period: "bogus", status: "x" }), DEFAULT_FILTER);
assert.ok(!filtering(filterOf(undefined)));
assert.ok(filtering(filterOf({ archived: true })));
assert.ok(filtering(filterOf({ period: "7d" })));
// Grouping is a way to show, kept, and never a filter.
assert.equal(filterOf(null).group, "project");
assert.equal(filterOf({ group: "date" }).group, "date");
assert.equal(filterOf({ group: "bogus" }).group, "project");
assert.ok(!filtering(filterOf({ group: "date" })));

// Inside a project: blocked, done, working, idle; equal status, pinned then most recent first.
const threads = [
  { id: "idle", status: "idle", act: 9 },
  { id: "work-old", status: "working", act: 1 },
  { id: "work-new", status: "working", act: 5 },
  { id: "done", status: "done", act: 2 },
  { id: "blocked", status: "blocked", act: 0 },
  { id: "pinned-idle", status: "idle", act: 0 },
  { id: "none", status: null, act: 3 },
];
assert.deepEqual(threads.sort((a, b) => byNeed(a, b, ["pinned-idle"])).map((x) => x.id),
  ["blocked", "done", "work-new", "work-old", "pinned-idle", "idle", "none"]);
// Projects: Home first, then any that needs you, then the registry's order, unregistered last.
const projects = [
  { id: "c", home: false, need: 0, at: 2 },
  { id: "x", home: false, need: 0, at: -1 },
  { id: "b", home: false, need: 1, at: 1 },
  { id: "home", home: true, need: 0, at: -1 },
  { id: "a", home: false, need: 0, at: 0 },
];
assert.deepEqual(projects.sort(byProject).map((x) => x.id), ["home", "b", "a", "c", "x"]);

// The bar: open first, then closed, each in the registry's order.
const reg = ["A", "x", "B", "y", "C"].map((id, order) => ({ id, order }));
const open = (id) => ["A", "B", "C"].includes(id);
const ids = (list) => list.map((e) => e.id);
assert.deepEqual(ids(openFirst(reg, open)), ["A", "B", "C", "x", "y"]);
const shown = ["home", ...ids(openFirst(reg, open))];
const moved = (from, to) => { const r = moveInGroup(reg, from, to, open, shown); return r && ids(r); };
// Inside the open group: A onto C goes after it; C onto A, before it. The closed keep their slots.
assert.deepEqual(moved("A", "C"), ["B", "x", "C", "y", "A"]);
assert.deepEqual(ids(openFirst(moveInGroup(reg, "A", "C", open, shown), open)), ["B", "C", "A", "x", "y"]);
assert.deepEqual(moved("C", "A"), ["C", "x", "A", "y", "B"]);
// Outside its group: at the group's edge (an open one dropped on a closed one: last of the open;
// on Home: first). A closed one dropped on an open one: first of the closed.
assert.deepEqual(ids(openFirst(moveInGroup(reg, "A", "y", open, shown), open)), ["B", "C", "A", "x", "y"]);
assert.deepEqual(ids(openFirst(moveInGroup(reg, "C", "home", open, shown), open)), ["C", "A", "B", "x", "y"]);
assert.deepEqual(ids(openFirst(moveInGroup(reg, "y", "B", open, shown), open)), ["A", "B", "C", "y", "x"]);
// Nothing moves: onto itself, or already at the edge.
assert.equal(moved("A", "A"), null);
assert.equal(moved("x", "A"), null);
// `order` follows the new places.
assert.deepEqual(moveInGroup(reg, "A", "C", open, shown).map((e) => e.order), [0, 1, 2, 3, 4]);
// A project closed later goes back to its place: B closed after the move A onto C.
const after = moveInGroup(reg, "A", "C", open, shown);
assert.deepEqual(ids(openFirst(after, (id) => ["A", "C"].includes(id))), ["C", "A", "B", "x", "y"]);

const f = (o) => filterOf(o);
const row = { status: "working", activity: now - H, program: "claude" };
assert.ok(passes(f({}), row, now));
assert.ok(passes(f({ status: ["working", "done"] }), row, now));
assert.ok(!passes(f({ status: ["blocked"] }), row, now));
assert.ok(!passes(f({ programs: ["codex"] }), row, now));
assert.ok(passes(f({ programs: ["claude"] }), row, now));
assert.ok(passes(f({ period: "today" }), row, now));
assert.ok(!passes(f({ period: "today" }), { ...row, activity: today - 1 }, now));
assert.ok(passes(f({ period: "7d" }), { ...row, activity: now - 6 * 24 * H }, now));
assert.ok(!passes(f({ period: "7d" }), { ...row, activity: now - 8 * 24 * H }, now));
assert.ok(!passes(f({ period: "30d" }), { ...row, activity: now - 31 * 24 * H }, now));

assert.equal(groupOf(now - H, now), 0);
assert.equal(groupOf(today - H, now), 1);
assert.equal(groupOf(today - 3 * 24 * H, now), 2);
assert.equal(groupOf(today - 9 * 24 * H, now), 3);
console.log("thread-filter: ok");
