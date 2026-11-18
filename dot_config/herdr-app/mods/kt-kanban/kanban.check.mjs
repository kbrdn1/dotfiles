// bun ~/.config/herdr-app/mods/kt-kanban/kanban.check.mjs : kanban.js (what the board shows, its fields,
// lanes, sorts and slices, the text filter, the cursor across columns and lanes) and mod.json's options.
// Made-up threads only ("tfx" ids). Not loaded by Herdr.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { OPTIONS, choice, nextChoice, FIELDS, columns, board, slices, sliced, onBoard, matches, locate, move, atCard } from "./kanban.js";
import { byStatus, STATUSES, PHASES as STEP_PHASE } from "./threads-model.js";
import { PHASES } from "./steps.js";

const now = 1_800_000_000_000;
const MIN = 60e3;
const acme = { key: "p-acme", name: "acme", home: false };
const beta = { key: "p-beta", name: "Beta", home: false };
const flow = (at, total = 14) => ({ step: null, phase: null, at, done: 1, total });
const th = (id, status, ago, o = {}) => ({
  id, status, activity: now - ago * MIN, settled: false, asleep: false, snooze: null, title: `T ${id}`,
  project: acme, branch: null, program: { name: "Claude Code" }, agentKey: "claude", issue: null, pr: null, cost: null, flow: null, ...o,
});
const list = [
  th("tfx-1", "working", 3, { cost: 2, flow: flow("impl") }),
  th("tfx-2", "blocked", 9, { cost: 31, flow: flow("ship"), title: "alpha" }),
  th("tfx-3", "idle", 40, { flow: flow(null) }), // a flow with nothing reached: prep
  th("tfx-4", null, 1, { agentKey: null, program: { name: "zsh" } }), // no agent: idle, no flow
  th("tfx-5", "done", 2, { project: beta, program: { name: "Codex" }, agentKey: "codex", flow: flow("close") }),
  th("tfx-6", "blocked", 1, { project: beta, flow: flow("other") }),
  th("tfx-7", "idle", 2, { asleep: true, snooze: { until: now + 60 * MIN } }),
  th("tfx-8", "idle", 5, { asleep: true, snooze: { until: now + 10 * MIN }, flow: flow(null, 0) }), // an empty flow: none
  th("tfx-9", "done", 1, { settled: true }),
  th("tfx-10", "working", 30, { branch: "feat/#12-ring", issue: "12", pr: { number: 34 }, title: "Ring model", project: beta, cost: 9 }),
];
const ids = (c) => c.threads.map((x) => x.id);
const show = onBoard(list);

// The options: each list's first is the default; a stored value out of the list is the default; the
// buttons cycle. mod.json declares the same values and defaults (the kt-mods console reads them).
assert.equal(choice("column", "weird"), "status");
assert.equal(choice("sort", "cost"), "cost");
assert.equal(nextChoice("slice", "program"), "none");
assert.equal(nextChoice("column", null), "phase");
const declared = JSON.parse(readFileSync(new URL("./mod.json", import.meta.url), "utf8")).options;
for (const [key, values] of Object.entries(OPTIONS)) {
  const o = declared.find((x) => x.key === key);
  assert.deepEqual([o.type, o.values, o.default, o.labels.length], ["enum", values, values[0], values.length], key);
}

// What it shows: never an archived thread; the archived view, only those.
assert.ok(!show.some((x) => x.settled));
assert.deepEqual(onBoard(list, true).map((x) => x.id), ["tfx-9"]);

// By status: blocked, done, working, idle, one each even empty; the most recently active first; idle:
// pinned first, a thread without status in it; the snoozed last, soonest due first.
const cols = columns(show, "status", { pins: ["tfx-3"] });
assert.deepEqual(cols.map((c) => c.key), STATUSES);
assert.deepEqual(cols.map(ids), [["tfx-6", "tfx-2"], ["tfx-5"], ["tfx-1", "tfx-10"], ["tfx-3", "tfx-4", "tfx-8", "tfx-7"]]);
const awake = show.filter((x) => !x.asleep);
const ref = byStatus(awake, ["tfx-3"]); // the awake keep threads-model's byStatus order
for (const c of columns(awake, "status", { pins: ["tfx-3"] })) assert.deepEqual(ids(c), ref[c.key].map((x) => x.id));
assert.deepEqual(columns(show, "nope").map((c) => c.key), STATUSES);
assert.deepEqual(columns([], "status").map((c) => c.threads.length), [0, 0, 0, 0]);

// By the flow's phase: kt-flow's phases in order, "other" only while a flow stands out of the table,
// "none" last (no flow, an empty one); started with nothing reached: prep.
const phases = columns(show, "phase");
assert.deepEqual(phases.map((c) => c.key), ["prep", "spec", "impl", "ship", "close", "other", "none"]);
// (inside a column, by need: working before idle)
assert.deepEqual(phases.map(ids), [["tfx-3"], [], ["tfx-1"], ["tfx-2"], ["tfx-5"], ["tfx-6"], ["tfx-10", "tfx-4", "tfx-8", "tfx-7"]]);
assert.ok(!FIELDS.phase.values(show.filter((x) => x.id !== "tfx-6")).includes("other"));
// The phases are kt-flow's, and threads-model files the same steps under the same phases, both ways:
// report (/me:report, between pr and review) in ship on both sides.
assert.deepEqual(PHASES.map((p) => p.id), ["prep", "spec", "impl", "ship", "close"]);
const flowSide = Object.fromEntries(PHASES.flatMap((p) => p.steps.map((s) => [s, p.id])));
assert.deepEqual(flowSide, { ...STEP_PHASE });
assert.equal(flowSide.report, "ship");

// Sorts (ties by need, the snoozed still last): the thread's age (first seen, the oldest first), its
// cost (the dearest first, none last), its title.
const seen = { "tfx-1": now - 500 * MIN, "tfx-10": now - 900 * MIN };
assert.deepEqual(ids(columns(show, "status", { sort: "age", firstSeen: seen })[2]), ["tfx-10", "tfx-1"]);
assert.deepEqual(ids(columns(show, "status", { sort: "activity", firstSeen: seen })[2]), ["tfx-1", "tfx-10"]);
assert.deepEqual(ids(columns(show, "phase", { sort: "cost" })[6]), ["tfx-10", "tfx-4", "tfx-8", "tfx-7"]);
assert.deepEqual(ids(columns(show, "status", { sort: "name" })[0]), ["tfx-2", "tfx-6"]); // "alpha" < "T tfx-6"

// Lanes: none, one ("all"); by project, one per project in projectGroups' order, every lane the same
// columns (the board's), folded ones shut; a project with no thread has no lane.
const flat = board(show, { field: "status", pins: ["tfx-3"] });
assert.deepEqual([flat.lanes.length, flat.lanes[0].key, flat.lanes[0].count, flat.lanes[0].open], [1, "all", 9, true]);
const lanes = board(show, { field: "phase", group: "project", folded: new Set(["p-beta"]) });
assert.deepEqual(lanes.lanes.map((l) => [l.key, l.project.name, l.count, l.open]), [["p-acme", "acme", 6, true], ["p-beta", "Beta", 3, false]]);
assert.deepEqual(lanes.keys, phases.map((c) => c.key)); // "other" from beta's flow
for (const l of lanes.lanes) assert.deepEqual(l.cols.map((c) => c.key), lanes.keys);
assert.deepEqual(board(show.filter((x) => x.project === acme), { group: "project" }).lanes.map((l) => l.key), ["p-acme"]);

// Slice by: the values with their counts (the most used first), the picked one kept at 0; a pick narrows.
assert.deepEqual(slices(show, "project").map((s) => [s.key, s.count]), [["p-acme", 6], ["p-beta", 3]]);
assert.deepEqual(slices(show, "program").map((s) => [s.key, s.name, s.count]), [["claude", "Claude Code", 7], ["codex", "Codex", 1], ["none", null, 1]]);
assert.deepEqual(slices(show, "project", "p-gone").at(-1), { key: "p-gone", name: null, count: 0 });
assert.deepEqual(sliced(show, "program", "codex").map((x) => x.id), ["tfx-5"]);
assert.deepEqual(sliced(show, "program", "none").map((x) => x.id), ["tfx-4"]);
assert.equal(sliced(show, "project", null).length, show.length);

// The text filter: every word, over title, project, branch, program, #issue, #PR; case-insensitive.
const ring = list.find((x) => x.id === "tfx-10");
assert.ok(matches(ring, ""));
assert.ok(matches(ring, "ring BETA feat"));
assert.ok(matches(ring, "#12") && matches(ring, "#34") && matches(ring, "claude"));
assert.ok(!matches(ring, "ring acme"));
assert.ok(!matches(list[0], "#12"));

// The cursor, one lane: where its thread is now (it follows a card into another column).
const one = (threads) => board(threads, { pins: ["tfx-3"] });
const b1 = one(show);
assert.deepEqual(locate(b1, "tfx-5"), { l: 0, c: 1, i: 0 });
const moved = one(show.map((x) => (x.id === "tfx-5" ? { ...x, status: "working", activity: now } : x)));
assert.deepEqual(locate(moved, "tfx-5", { l: 0, c: 1, i: 0 }), { l: 0, c: 2, i: 0 });
// Its thread gone: the same place, clamped; that column empty: the first card shown; nothing at all.
assert.deepEqual(locate(b1, "tfx-gone", { l: 0, c: 3, i: 9 }), { l: 0, c: 3, i: 3 });
assert.deepEqual(locate(moved, "tfx-gone", { l: 0, c: 1, i: 0 }), { l: 0, c: 0, i: 0 });
assert.deepEqual(locate(b1, null), { l: 0, c: 0, i: 0 });
assert.deepEqual(locate(one([]), "tfx-1", { l: 0, c: 2, i: 1 }), { l: 0, c: 2, i: -1 });
assert.equal(atCard(b1, { l: 0, c: 2, i: 1 }).id, "tfx-10");
// h / l: the next column that has a card, same row or its last; at an end, it stays.
const sparse = one(show.filter((x) => x.status !== "done")); // done is empty
assert.deepEqual(move(sparse, { l: 0, c: 0, i: 1 }, "right"), { l: 0, c: 2, i: 1 });
assert.deepEqual(move(sparse, { l: 0, c: 2, i: 1 }, "left"), { l: 0, c: 0, i: 1 });
assert.deepEqual(move(sparse, { l: 0, c: 0, i: 1 }, "left"), { l: 0, c: 0, i: 1 });
assert.deepEqual(move(b1, { l: 0, c: 3, i: 3 }, "left"), { l: 0, c: 2, i: 1 });
assert.deepEqual(move(b1, { l: 0, c: 0, i: 0 }, "right", 2), { l: 0, c: 2, i: 0 });
assert.deepEqual(move(b1, { l: 0, c: 0, i: 0 }, "tab-next"), { l: 0, c: 1, i: 0 });
// j / k, gg / G, n / N, a count: down the column.
assert.deepEqual(move(b1, { l: 0, c: 3, i: 0 }, "down"), { l: 0, c: 3, i: 1 });
assert.deepEqual(move(b1, { l: 0, c: 3, i: 0 }, "bottom"), { l: 0, c: 3, i: 3 });
assert.deepEqual(move(b1, { l: 0, c: 3, i: 3 }, "top"), { l: 0, c: 3, i: 0 });
assert.deepEqual(move(b1, { l: 0, c: 3, i: 3 }, "down"), { l: 0, c: 3, i: 3 });
assert.deepEqual(move(b1, { l: 0, c: 3, i: 2 }, "prev"), { l: 0, c: 3, i: 1 });
assert.deepEqual(move(b1, { l: 0, c: 3, i: 0 }, "down", 2), { l: 0, c: 3, i: 2 });
assert.deepEqual(move(one([]), { l: 0, c: 0, i: -1 }, "down"), { l: 0, c: 0, i: -1 });

// Lanes: j / k go on into the next open lane's same column, a folded lane is skipped and out of reach.
// (both need you and neither is in the registry: in the order first seen, acme then beta)
const two = board(show, { group: "project", pins: ["tfx-3"] });
assert.deepEqual(two.lanes.map((l) => l.key), ["p-acme", "p-beta"]);
assert.deepEqual(locate(two, "tfx-6"), { l: 1, c: 0, i: 0 });
assert.deepEqual(move(two, { l: 0, c: 0, i: 0 }, "down"), { l: 1, c: 0, i: 0 }); // tfx-2 (acme) to tfx-6 (beta)
assert.deepEqual(move(two, { l: 1, c: 0, i: 0 }, "up"), { l: 0, c: 0, i: 0 });
assert.deepEqual(move(two, { l: 0, c: 0, i: 0 }, "bottom"), { l: 1, c: 0, i: 0 });
assert.deepEqual(move(two, { l: 1, c: 0, i: 0 }, "right"), { l: 1, c: 1, i: 0 }); // beta's done
assert.deepEqual(move(two, { l: 0, c: 0, i: 0 }, "right"), { l: 0, c: 2, i: 0 }); // acme has no done
const shut = board(show, { group: "project", pins: ["tfx-3"], folded: new Set(["p-beta"]) });
assert.deepEqual(locate(shut, "tfx-6", { l: 1, c: 0, i: 0 }), { l: 0, c: 0, i: 0 }); // folded: out of reach
assert.deepEqual(move(shut, { l: 0, c: 0, i: 0 }, "down"), { l: 0, c: 0, i: 0 });
console.log("kanban: ok");
