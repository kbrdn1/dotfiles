// bun ~/.config/herdr-app/mods/kt-kanban/kanban.check.mjs : kanban.js (the board's columns and their
// order, what it shows, the text filter, the cursor across columns). Made-up threads only ("tfx" ids).
// Not loaded by Herdr.
import assert from "node:assert/strict";
import { FIELDS, columns, onBoard, matches, locate, move } from "./kanban.js";
import { byStatus, STATUSES } from "./threads-model.js";

const now = 1_800_000_000_000;
const MIN = 60e3;
const th = (id, status, ago, o = {}) => ({
  id, status, activity: now - ago * MIN, settled: false, asleep: false, snooze: null, title: `T ${id}`,
  project: { name: "acme" }, branch: null, program: { name: "Claude Code" }, issue: null, pr: null, ...o,
});
const list = [
  th("tfx-1", "working", 3),
  th("tfx-2", "blocked", 9),
  th("tfx-3", "idle", 40),
  th("tfx-4", null, 1), // no agent: idle
  th("tfx-5", "done", 2),
  th("tfx-6", "blocked", 1),
  th("tfx-7", "idle", 2, { asleep: true, snooze: { until: now + 60 * MIN } }),
  th("tfx-8", "idle", 5, { asleep: true, snooze: { until: now + 10 * MIN } }),
  th("tfx-9", "done", 1, { settled: true }),
  th("tfx-10", "working", 30, { branch: "feat/#12-ring", issue: "12", pr: { number: 34 }, title: "Ring model", project: { name: "beta" } }),
];
const ids = (c) => c.threads.map((x) => x.id);

// Columns in the order that needs you first: blocked, done, working, idle; one per status, even empty.
const board = onBoard(list);
assert.ok(!board.some((x) => x.settled)); // never an archived thread
assert.deepEqual(onBoard(list, true).map((x) => x.id), ["tfx-9"]); // the archived view: only those
const cols = columns(board, "status", ["tfx-3"]);
assert.deepEqual(cols.map((c) => c.key), ["blocked", "done", "working", "idle"]);
assert.deepEqual(cols.map((c) => c.key), STATUSES);
assert.deepEqual(ids(cols[0]), ["tfx-6", "tfx-2"]); // most recently active first
assert.deepEqual(ids(cols[1]), ["tfx-5"]);
assert.deepEqual(ids(cols[2]), ["tfx-1", "tfx-10"]);
// idle: pinned first, then by activity, a thread without status in it; the snoozed last, soonest due first.
assert.deepEqual(ids(cols[3]), ["tfx-3", "tfx-4", "tfx-8", "tfx-7"]);
// The awake cards keep threads-model's byStatus order (the shared contract).
const awake = board.filter((x) => !x.asleep);
const ref = byStatus(awake, ["tfx-3"]);
for (const c of columns(awake, "status", ["tfx-3"])) assert.deepEqual(ids(c), ref[c.key].map((x) => x.id));
// A field is a value per thread: an unknown one falls back to the status.
assert.equal(FIELDS.status.of({ status: "weird" }), "idle");
assert.deepEqual(columns(board, "nope").map((c) => c.key), STATUSES);
assert.deepEqual(columns([], "status").map((c) => c.threads.length), [0, 0, 0, 0]);

// The text filter: every word, over title, project, branch, program, #issue, #PR; case-insensitive.
const ring = list.find((x) => x.id === "tfx-10");
assert.ok(matches(ring, ""));
assert.ok(matches(ring, "ring"));
assert.ok(matches(ring, "BETA feat"));
assert.ok(matches(ring, "#12"));
assert.ok(matches(ring, "#34"));
assert.ok(matches(ring, "claude"));
assert.ok(!matches(ring, "ring acme"));
assert.ok(!matches(list[0], "#12"));

// The cursor: where its thread is now (it follows a card into another column).
assert.deepEqual(locate(cols, "tfx-5"), { c: 1, i: 0 });
const moved = columns(board.map((x) => (x.id === "tfx-5" ? { ...x, status: "working", activity: now } : x)), "status", ["tfx-3"]);
assert.deepEqual(locate(moved, "tfx-5", { c: 1, i: 0 }), { c: 2, i: 0 });
// Its thread gone: the same place in its column, clamped; that column empty: the first card shown.
assert.deepEqual(locate(cols, "tfx-gone", { c: 3, i: 9 }), { c: 3, i: 3 });
assert.deepEqual(locate(moved, "tfx-gone", { c: 1, i: 0 }), { c: 0, i: 0 });
assert.deepEqual(locate(cols, null), { c: 0, i: 0 });
assert.deepEqual(locate(columns([], "status"), "tfx-1", { c: 2, i: 1 }), { c: 2, i: -1 }); // nothing on the board

// h / l: the next column that has a card, same row or its last; at an end, it stays.
const sparse = columns(board.filter((x) => x.status !== "done"), "status", ["tfx-3"]); // done is empty
assert.deepEqual(move(sparse, { c: 0, i: 1 }, "right"), { c: 2, i: 1 }); // skips the empty column
assert.deepEqual(move(sparse, { c: 2, i: 1 }, "left"), { c: 0, i: 1 });
assert.deepEqual(move(sparse, { c: 0, i: 1 }, "left"), { c: 0, i: 1 });
assert.deepEqual(move(sparse, { c: 3, i: 3 }, "right"), { c: 3, i: 3 });
assert.deepEqual(move(cols, { c: 3, i: 3 }, "left"), { c: 2, i: 1 }); // its last row
assert.deepEqual(move(cols, { c: 0, i: 0 }, "right", 2), { c: 2, i: 0 }); // a count: 2l
assert.deepEqual(move(cols, { c: 0, i: 0 }, "tab-next"), { c: 1, i: 0 });
// j / k, gg / G, n / N: inside the column.
assert.deepEqual(move(cols, { c: 3, i: 0 }, "down"), { c: 3, i: 1 });
assert.deepEqual(move(cols, { c: 3, i: 0 }, "bottom"), { c: 3, i: 3 });
assert.deepEqual(move(cols, { c: 3, i: 3 }, "top"), { c: 3, i: 0 });
assert.deepEqual(move(cols, { c: 3, i: 3 }, "down"), { c: 3, i: 3 });
assert.deepEqual(move(cols, { c: 3, i: 2 }, "prev"), { c: 3, i: 1 });
assert.deepEqual(move(cols, { c: 3, i: 0 }, "down", 2), { c: 3, i: 2 }); // 2j
assert.deepEqual(move(columns([], "status"), { c: 0, i: -1 }, "down"), { c: 0, i: -1 });
console.log("kanban: ok");
