// bun ~/.config/herdr-app/mods/kt-kanban/kanban.check.mjs : kanban.js (what the board shows, its fields,
// lanes, sorts and slices, the text filter, the cursor across columns and lanes) and mod.json's options.
// Made-up threads only ("tfx" ids). Not loaded by Herdr.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { OPTIONS, choice, nextChoice, FIELDS, columns, board, slices, sliced, onBoard, locate, move, atCard, tokens, parseQuery, matchQuery,
  costOf, cleanLimits, stepLimit, checkSteps, ciCount, cardMenu, menuStart, takesFocus, SNOOZES, wakeAt, draftsOf, attach, toArchive, archivePlan, DEFAULT_VIEWS, settingsOf, viewsOf, currentView, dirty, saveView, addView, duplicateView, renameView, deleteView, stepView } from "./kanban.js";
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

// What it shows: every project's threads but the archived; with is:archived in the filter, those too
// (the term then keeps only them); -is:archived, as without.
assert.ok(!show.some((x) => x.settled));
assert.equal(show.length, list.length - 1);
assert.equal(onBoard(list, true).length, list.length);
const arch = (text) => { const pq = parseQuery(text); return onBoard(list, pq.archived).filter((x) => matchQuery(x, pq, { now })).map((x) => x.id); };
assert.deepEqual(arch("is:archived"), ["tfx-9"]);
assert.deepEqual(arch("is:archived,pinned"), ["tfx-9"]); // nothing pinned here
assert.deepEqual(arch("-is:archived").length, show.length);
assert.deepEqual(arch("is:archived status:idle"), []); // tfx-9 is done
assert.deepEqual([parseQuery("is:archived").archived, parseQuery("-is:archived").archived, parseQuery("is:snoozed").archived], [true, false, false]);
assert.deepEqual([parseQuery("project:@current").current, parseQuery("-project:@current").current, parseQuery("project:acme").current], [true, false, false]);

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

// The filter (`/`). Free words, as before: every one, over title, project, branch, program, #issue, #PR.
const ctx = { now, current: "p-acme" };
const q = (text) => show.filter((x) => matchQuery(x, parseQuery(text), ctx)).map((x) => x.id);
const ring = list.find((x) => x.id === "tfx-10");
const hit = (x, text) => matchQuery(x, parseQuery(text), ctx);
assert.ok(hit(ring, "") && hit(ring, "ring BETA feat") && hit(ring, "#12") && hit(ring, "#34") && hit(ring, "claude"));
assert.ok(!hit(ring, "ring acme") && !hit(list[0], "#12"));
// Tokens: a field outside quotes only, "quotes" keep spaces, a leading - negates.
assert.deepEqual(tokens('-status:idle project:"my app" "a:b" -word fix-login'), [
  { neg: true, field: "status", value: "idle", quoted: false }, { neg: false, field: "project", value: "my app", quoted: true },
  { neg: false, field: null, value: "a:b", quoted: true }, { neg: true, field: null, value: "word", quoted: false },
  { neg: false, field: null, value: "fix-login", quoted: false }]);
// Fields: status (the board's columns: no status is idle), several values, negation.
assert.deepEqual(q("status:blocked"), ["tfx-2", "tfx-6"]);
assert.deepEqual(q("status:blocked,done"), ["tfx-2", "tfx-5", "tfx-6"]);
assert.deepEqual(q("-status:idle"), ["tfx-1", "tfx-2", "tfx-5", "tfx-6", "tfx-10"]);
assert.deepEqual(q("status:idle"), ["tfx-3", "tfx-4", "tfx-7", "tfx-8"]);
assert.deepEqual(q("phase:ship,close"), ["tfx-2", "tfx-5"]);
assert.deepEqual(q("phase:none -is:snoozed"), ["tfx-4", "tfx-10"]);
assert.deepEqual(q("project:BET"), ["tfx-5", "tfx-6", "tfx-10"]); // in its name, any case
assert.deepEqual(q("project:@current agent:none"), ["tfx-4"]); // the shown project's
assert.deepEqual(q("agent:codex"), ["tfx-5"]);
assert.deepEqual(q("agent:claude -project:beta"), ["tfx-1", "tfx-2", "tfx-3", "tfx-7", "tfx-8"]);
assert.deepEqual(q("branch:feat"), ["tfx-10"]);
assert.deepEqual(q("branch:none status:working"), ["tfx-1"]);
// pr: open (a draft too), draft, merged, closed, none.
const prs = [th("tfx-p1", "idle", 1, { pr: { number: 1, state: "OPEN", draft: true } }), th("tfx-p2", "idle", 1, { pr: { number: 2, state: "OPEN", isDraft: false } }),
  th("tfx-p3", "idle", 1, { pr: { number: 3, state: "MERGED" } }), th("tfx-p4", "idle", 1)];
const qp = (text) => prs.filter((x) => matchQuery(x, parseQuery(text), ctx)).map((x) => x.id);
assert.deepEqual([qp("pr:open"), qp("pr:draft"), qp("pr:merged"), qp("pr:none"), qp("-pr:none"), qp("pr:closed")],
  [["tfx-p1", "tfx-p2"], ["tfx-p1"], ["tfx-p3"], ["tfx-p4"], ["tfx-p1", "tfx-p2", "tfx-p3"], []]);
assert.deepEqual(q("is:pinned"), []); // none pinned in this list
assert.deepEqual(q("is:snoozed"), ["tfx-7", "tfx-8"]);
// Ranges: cost (an unknown cost never matches, its negation does), age since the last activity.
assert.deepEqual(q("cost:>5"), ["tfx-2", "tfx-10"]);
assert.deepEqual(q("cost:>=2 cost:<=9"), ["tfx-1", "tfx-10"]);
assert.deepEqual(q("cost:2..9"), ["tfx-1", "tfx-10"]);
assert.deepEqual(q("cost:..2,5"), ["tfx-1"]);
assert.deepEqual(q("cost:$31"), ["tfx-2"]); // a plain value: that cost
assert.deepEqual(q("-cost:>5").length, show.length - 2);
assert.deepEqual(q("age:<4m"), ["tfx-1", "tfx-4", "tfx-5", "tfx-6", "tfx-7"]); // 3, 1, 2, 1, 2 min
assert.deepEqual(q("age:>20m"), ["tfx-3", "tfx-10"]);
assert.deepEqual(q("age:5m..10m"), ["tfx-2", "tfx-8"]);
assert.deepEqual(q("age:<1h").length, show.length);
assert.deepEqual(q("age:>1j"), []); // j: French days
// Set aside, the rest still filters: an unknown field, an unreadable value; a value not typed yet is quiet.
const bad = parseQuery("foo:bar status:blocked status:zz cost:>abc age:3h phase: is:open");
assert.deepEqual(bad.issues.map((i) => [i.kind, i.field]), [["field", "foo"], ["value", "status"], ["value", "cost"], ["value", "age"], ["value", "is"]]);
assert.deepEqual(bad.terms.map((t) => t.field), ["status"]);
assert.deepEqual(q("foo:bar status:blocked"), ["tfx-2", "tfx-6"]);
assert.deepEqual(parseQuery("http://x.y").issues.map((i) => i.field), ["http"]);
assert.deepEqual(parseQuery('"http://x.y"').issues, []); // quoted: a word

// The columns' figures: the cost together (to the cent), the soft limits (+ / -).
assert.equal(costOf(show), 42);
assert.equal(costOf([{ cost: 0.105 }, { cost: 0.2 }, {}]), 0.31);
assert.deepEqual(cleanLimits({ idle: 2, done: 0, x: -1, y: 1.5, blocked: 1 }), { blocked: 1, idle: 2 });
assert.deepEqual(stepLimit({}, "idle", 1, 4), { idle: 4 }); // + sets it to its cards now
assert.deepEqual(stepLimit({}, "idle", 1, 0), { idle: 1 });
assert.deepEqual(stepLimit({}, "idle", -1, 4), {});
assert.deepEqual(stepLimit({ idle: 4 }, "idle", 1), { idle: 5 });
assert.deepEqual(stepLimit({ idle: 1, done: 2 }, "idle", -1), { done: 2 }); // down to 0: gone

// Saved views: the defaults; checked and complete; the tab's dot; save, add, duplicate, rename, delete.
const vs = viewsOf(null);
assert.deepEqual([vs.current, vs.list.map((v) => [v.id, v.name, v.filter])], ["all", [["all", null, ""], ["blocked", null, "status:blocked"], ["project", null, "project:@current"]]]);
assert.deepEqual(vs.list.map((v) => v.id), DEFAULT_VIEWS.map((v) => v.id));
assert.deepEqual(settingsOf({ column: "weird", slice: "none", pick: "x", filter: "  a ", limits: { idle: 0 } }),
  { column: "status", group: "none", slice: "none", pick: null, sort: "activity", filter: "a", limits: {} });
assert.deepEqual(viewsOf({ current: "gone", list: [{ id: "v1", name: "  " }, { nope: 1 }] }).list.map((v) => [v.id, v.name]), [["v1", null]]);
assert.equal(viewsOf({ current: "gone", list: [{ id: "v1" }] }).current, "v1");
assert.equal(viewsOf({ list: [{ nope: 1 }] }).current, "all"); // nothing usable: the defaults
const live = { column: "phase", group: "none", slice: "project", pick: "p-acme", sort: "cost", filter: "status:blocked", limits: { ship: 2 } };
assert.ok(!dirty(currentView(vs), { filter: " " })); // the same settings, written otherwise
assert.ok(dirty(currentView(vs), live));
assert.ok(dirty(currentView(vs), { limits: { idle: 3 } })); // a limit changed too
const saved = saveView(vs, live);
assert.ok(!dirty(currentView(saved), live));
assert.deepEqual(currentView(saved).name, null); // its name kept
const added = addView(vs, live, "tfx-v1", "Vue 4");
assert.deepEqual([added.current, added.list.map((v) => v.id)], ["tfx-v1", ["all", "tfx-v1", "blocked", "project"]]); // after the current one
assert.ok(!dirty(currentView(added), live));
const dup = duplicateView(vs, "blocked", "tfx-v2", "Bloqués (copie)");
assert.deepEqual([dup.current, dup.list.map((v) => v.id), currentView(dup).filter], ["tfx-v2", ["all", "blocked", "tfx-v2", "project"], "status:blocked"]);
assert.deepEqual(renameView(vs, "blocked", "  À voir ").list[1].name, "À voir");
assert.equal(renameView(vs, "blocked", "  "), vs); // empty: nothing
assert.deepEqual(deleteView(vs, "all"), { current: "blocked", list: vs.list.slice(1) }); // the current one: the next
assert.equal(deleteView({ current: "blocked", list: vs.list }, "project").current, "blocked");
assert.equal(deleteView({ current: "project", list: vs.list }, "project").current, "blocked"); // the last: the one before
assert.equal(deleteView(viewsOf({ list: [{ id: "solo" }] }), "solo").list.length, 1); // the last view stays
assert.deepEqual([stepView(vs, 1), stepView(vs, -1), stepView({ ...vs, current: "project" }, 1)], ["blocked", "project", "all"]);

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
// The drawer: a PR's checks as steps, what failed first, then running, passed, skipped (gh's order inside).
assert.deepEqual(checkSteps([{ name: "lint", bucket: "pass" }, { name: "e2e", bucket: "skipping" }, { name: "test", bucket: "fail" },
  { name: "build", bucket: "pending" }, { name: "deploy", bucket: "cancel" }, { name: "odd", bucket: "weird" }]).map((s) => [s.label, s.state]),
[["test", "failed"], ["deploy", "failed"], ["build", "current"], ["lint", "done"], ["e2e", "skipped"], ["odd", "todo"]]);
assert.deepEqual(checkSteps(null), []);
// The card's CI from the drawer's checks, counted as /me:report's: passed, failing (cancelled too), running.
assert.deepEqual(ciCount([{ bucket: "pass" }, { bucket: "pass" }, { bucket: "fail" }, { bucket: "cancel" }, { bucket: "pending" }, { bucket: "skipping" }]),
  { ok: 2, fail: 2, pending: 1, total: 6 });
assert.equal(ciCount([]), null);
assert.equal(ciCount(undefined), null);
// Snooze, the sidebar's times: an hour; 19:00 tonight (tomorrow's once past); 9:00 tomorrow.
const noon = new Date(2026, 10, 18, 12, 0).getTime(), late = new Date(2026, 10, 18, 21, 0).getTime();
assert.equal(wakeAt("hour", noon), noon + 3600e3);
assert.equal(wakeAt("tonight", noon), new Date(2026, 10, 18, 19, 0).getTime());
assert.equal(wakeAt("tonight", late), new Date(2026, 10, 19, 19, 0).getTime());
assert.equal(wakeAt("tomorrow", noon), new Date(2026, 10, 19, 9, 0).getTime());
assert.equal(wakeAt("tomorrow", late), new Date(2026, 10, 19, 9, 0).getTime());
assert.deepEqual(SNOOZES, ["hour", "tonight", "tomorrow"]);
// Drafts: a card with no agent, flow nor cost: Inactif (status), Sans flow (phase), first in its column;
// an issue from a "#N" title; is:draft; its consigne in the free words; outside the cost.
const drafts = draftsOf([{ id: "tfx-d1", title: "#77 Nouvelle idée", task: "Écrire le\nmodule kanban", project: acme, at: now - 2 * MIN },
  { id: "tfx-d2", title: "Autre", at: now - MIN }, { nope: 1 }, null]);
assert.deepEqual(drafts.map((d) => [d.id, d.draft, d.issue, d.project.key]), [["tfx-d1", true, "77", "p-acme"], ["tfx-d2", true, null, "none"]]);
const withD = [...show, ...drafts];
assert.deepEqual(ids(columns(withD, "status", { pins: ["tfx-3"] })[3]), ["tfx-d2", "tfx-d1", "tfx-3", "tfx-4", "tfx-8", "tfx-7"]);
assert.deepEqual(ids(columns(withD, "phase").at(-1)).slice(0, 2), ["tfx-d2", "tfx-d1"]);
const qd = (text) => withD.filter((x) => matchQuery(x, parseQuery(text), ctx)).map((x) => x.id);
assert.deepEqual(qd("is:draft"), ["tfx-d1", "tfx-d2"]);
assert.deepEqual(qd("module"), ["tfx-d1"]); // its consigne
assert.deepEqual(qd("#77"), ["tfx-d1"]);
assert.equal(costOf(drafts), 0);
assert.deepEqual(draftsOf("torn"), []);

// A launched draft's thread (kt-new's record): by its tab's name, in that space or that worktree's; not
// there yet, or two: null.
const made = [
  { id: "tfx-n1", tab: { name: "Login" }, space: { id: "tfx-s1", folder: "/tfx/acme", machine: null } },
  { id: "tfx-n2", tab: { name: "fix" }, space: { id: "tfx-s5", folder: "/tfx/wt/fix", machine: null } },
  { id: "tfx-n3", tab: { name: "Dup" }, space: { id: "tfx-s1" } }, { id: "tfx-n4", tab: { name: "Dup" }, space: { id: "tfx-s1" } },
];
assert.equal(attach(made, { tab: "Login", space: "tfx-s1" }), "tfx-n1");
assert.equal(attach(made, { tab: "Login", space: "tfx-s2" }), null);
assert.equal(attach(made, { tab: "fix", space: null, folder: "/tfx/wt/fix", machine: null }), "tfx-n2");
assert.equal(attach(made, { tab: "fix", space: null, folder: "/tfx/wt/fix", machine: "vps" }), null);
assert.equal(attach(made, { tab: "Dup", space: "tfx-s1" }), null); // two: no guess
assert.equal(attach(made, null), null);

// Auto-archive: merged, seen (idle, or no agent), quiet N days; never pinned, shown, archived, a draft,
// one already archived once (skip); 0 days: never.
const D = 86400e3;
const arc = [
  th("tfx-a1", "idle", 0, { pr: { state: "MERGED" }, activity: now - 8 * D }),
  th("tfx-a2", "done", 0, { pr: { state: "MERGED" }, activity: now - 8 * D }), // not seen yet
  th("tfx-a3", "idle", 0, { pr: { state: "OPEN" }, activity: now - 8 * D }),
  th("tfx-a4", "idle", 0, { pr: { state: "MERGED" }, activity: now - 2 * D }), // too recent
  th("tfx-a5", null, 0, { pr: { state: "MERGED" }, activity: now - 9 * D }), // no agent: seen
  th("tfx-a6", "idle", 0, { pr: { state: "MERGED" }, activity: now - 9 * D, pinned: true }),
  th("tfx-a7", "idle", 0, { pr: { state: "MERGED" }, activity: now - 9 * D, shown: true }),
  th("tfx-a8", "idle", 0, { pr: { state: "MERGED" }, activity: now - 9 * D, settled: true }),
  th("tfx-a9", "working", 0, { pr: { state: "MERGED" }, activity: now - 9 * D }),
  th("tfx-a10", "idle", 0, { pr: { state: "MERGED" }, activity: now - 9 * D }),
];
assert.deepEqual(toArchive(arc, { days: 7, now, skip: new Set(["tfx-a10"]) }), ["tfx-a1", "tfx-a5"]);
assert.deepEqual(toArchive(arc, { days: 1, now }), ["tfx-a1", "tfx-a4", "tfx-a5", "tfx-a10"]);
assert.deepEqual(toArchive(arc, { days: 0, now }), []);
assert.deepEqual(toArchive([...arc, ...drafts], { days: 1, now }).length, 4);
// What it does: never anything on its own the first time (no memo): all of it proposed. Taken on
// (`since`), only a thread crossing its N days after that goes by itself; one past them before (a PR
// read late, say) is proposed; what it archived or was told to leave (`done`), never again; 0: nothing.
assert.deepEqual(archivePlan(arc, { days: 7, now }), { auto: [], propose: ["tfx-a1", "tfx-a5", "tfx-a10"] });
assert.deepEqual(archivePlan(arc, { days: 7, now, memo: null }).auto, []);
const crossing = [
  th("tfx-c1", "idle", 0, { pr: { state: "MERGED" }, activity: now - 7 * D - 3600e3 }), // crossed an hour ago
  th("tfx-c2", "idle", 0, { pr: { state: "MERGED" }, activity: now - 10 * D }), // crossed three days ago
  th("tfx-c3", "idle", 0, { pr: { state: "MERGED" }, activity: now - 9 * D }), // left once
];
const memo = { since: now - D, done: { "tfx-c3": now - D } };
assert.deepEqual(archivePlan(crossing, { days: 7, now, memo }), { auto: ["tfx-c1"], propose: ["tfx-c2"] });
assert.deepEqual(archivePlan(crossing, { days: 7, now, memo: { since: now - 5 * D, done: {} } }), { auto: ["tfx-c1", "tfx-c2", "tfx-c3"], propose: [] });
assert.deepEqual(archivePlan(crossing, { days: 0, now, memo }), { auto: [], propose: [] });
assert.deepEqual(archivePlan(crossing, { days: 7, now, memo: { done: {} } }).auto, []); // no `since`: as the first time
// The column cost: an option, off by default (the cost belongs to the drawer).
const colCost = declared.find((x) => x.key === "columnCost");
assert.deepEqual([colCost.type, colCost.default], ["bool", false]);
// A card's menu: a blocked agent's choices first (decide.js' options), else « go » first; snooze or
// wake; archive or bring back; the PR, the issue once known; Zed, local only; close last, set apart.
const keys = (items) => items.map((i) => i.key);
const perm = { pending: { kind: "permission", options: [{ key: "accept", label: "Accepter", tone: "positive" }, { key: "refuse", label: "Refuser", tone: "negative" }] } };
const blockedTh = { ...th("tfx-b1", "blocked", 1), cwd: "/tfx/acme", space: { machine: null }, branch: "fix/#9-x" };
const menu1 = cardMenu(blockedTh, { decision: perm, prUrl: "u/9", issueUrl: "u/i9" });
assert.deepEqual(keys(menu1), ["decide:accept", "decide:refuse", "go", "drawer", "pin", "snooze:hour", "snooze:tonight", "snooze:tomorrow", "archive", "openPr", "openIssue", "zed", "copyBranch", "close"]);
assert.deepEqual([menu1[0].option, menu1[0].tone, menu1[1].tone, menu1[2].sep, menu1.at(-1).tone, menu1.at(-1).sep], ["accept", "positive", "negative", true, "danger", true]);
// Its keys (the drawer's, run while the menu shows): one item each, never the menu's own j k q.
const hints = menu1.map((i) => i.hint).filter(Boolean);
assert.deepEqual(hints, ["o", "p", "1", "2", "3", "O", "I", "e"]);
assert.ok(!hints.some((h) => ["j", "k", "q"].includes(h)));
// Arriving on the page, it takes the keyboard only with no overlay open (herdr-app status), still shown,
// not already focused; an unreadable status: never.
const st = (overlays) => ({ overlays, errors: [] });
assert.equal(takesFocus({ visible: true, focused: false, status: st([]) }), true);
assert.equal(takesFocus({ visible: true, focused: false, status: st(["kt-new"]) }), false);
assert.equal(takesFocus({ visible: true, focused: false, status: st([{ mod: "kt-confirm" }]) }), false);
assert.equal(takesFocus({ visible: false, focused: false, status: st([]) }), false);
assert.equal(takesFocus({ visible: true, focused: true, status: st([]) }), false);
assert.equal(takesFocus({ visible: true, focused: false, status: null }), false);
assert.equal(takesFocus({ visible: true, focused: false, status: { errors: [] } }), false);
// Its highlight starts on « go » (m then enter never accepts), on « launch » for a draft.
assert.equal(menuStart(menu1), "go");
assert.equal(menuStart(cardMenu(drafts[0])), "launch");
// A question (no options): no choices, « go » first; a working one: its decision ignored.
assert.equal(cardMenu(blockedTh, { decision: { pending: { kind: "question", options: [] } } })[0].key, "go");
assert.equal(cardMenu({ ...blockedTh, status: "working" }, { decision: perm })[0].key, "go");
// Pinned, snoozed, archived, remote, no branch, nothing known of its PR.
const other = cardMenu({ ...th("tfx-b2", "idle", 1, { pinned: true, asleep: true, settled: true }), cwd: "/tfx/x", space: { machine: "vps" } });
assert.deepEqual(keys(other), ["go", "drawer", "unpin", "wake", "unarchive", "close"]);
// A draft: launch, edit, delete.
assert.deepEqual(keys(cardMenu(drafts[0])), ["launch", "edit", "deleteDraft"]);
// Its option: mod.json's archiveDays, a number from 0 (never), 7 by default.
const days = declared.find((x) => x.key === "archiveDays");
assert.deepEqual([days.type, days.min, days.default], ["number", 0, 7]);
console.log("kanban: ok");
