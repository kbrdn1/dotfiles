// bun ~/.config/herdr-app/mods/kt-chat/turn-window.check.mjs: turn-window.js (#59), the band's turns
// followed by id when the turns are built again (a read upward, the live tail and its trim), what the
// trim keeps, the order a render describes them in (which band: turn-band.check.mjs). Ids are made up.
import assert from "node:assert/strict";
import { SHOW, CAP, bottom, remap, keepFor, nearFirst } from "./turn-window.js";
import { childOf } from "./chat-view.js";
import { trim } from "./chat-model.js";

const ids = (n, p = "t") => Array.from({ length: n }, (_, i) => `${p}${i}`);

// ── Reading a session ───────────────────────────────────────────────────────
assert.equal(SHOW, 10);
assert.equal(CAP, 15);
assert.ok(CAP > SHOW && CAP < 2 * SHOW, "one step more than a read, never two (the budget)");
assert.deepEqual(bottom(120), { from: 110, to: 120 });
assert.deepEqual(bottom(4), { from: 0, to: 4 });
assert.deepEqual(bottom(0), { from: 0, to: 0 });
assert.equal(childOf(110, 0), 111, "the head is child 0, turn i child i + 1 (#59: every loaded turn is a row)");

// ── The turns built again (remap) ───────────────────────────────────────────
const old = ids(30);
// A read in front (the read upward): 30 older turns, the same band by its ids.
const front = [...ids(30, "o"), ...old];
assert.deepEqual(remap({ from: 0, to: 10 }, old, front, false), { from: 30, to: 40 });
// The live tail, not following the bottom: 5 new turns come below, nothing above moves.
const grown = [...old, ...ids(5, "n")];
assert.deepEqual(remap({ from: 12, to: 22 }, old, grown, false), { from: 12, to: 22 });
assert.deepEqual(remap({ from: 20, to: 30 }, old, grown, false), { from: 20, to: 30 }, "even touching the old end");
// Following it: the window slides with the end, at its size (SHOW to CAP).
assert.deepEqual(remap({ from: 20, to: 30 }, old, grown, true), { from: 25, to: 35 });
assert.deepEqual(remap({ from: 30 - CAP, to: 30 }, old, grown, true), { from: 35 - CAP, to: 35 });
assert.deepEqual(remap({ from: 0, to: 30 }, old, grown, true), { from: 35 - CAP, to: 35 }, "never past CAP");
assert.deepEqual(remap({ from: 0, to: 0 }, [], ids(3), true), { from: 0, to: 3 }, "a first read");
// The live tail's trim: the 8 oldest go; the window keeps its turns at their new place.
const trimmed = old.slice(8).concat(ids(2, "n"));
assert.deepEqual(remap({ from: 12, to: 22 }, old, trimmed, false), { from: 4, to: 14 });
assert.deepEqual(remap({ from: 5, to: 15 }, old, trimmed, false), { from: 0, to: 7 }, "its first turns trimmed: what is left of it");
assert.deepEqual(remap({ from: 0, to: 5 }, old, trimmed, false), bottom(trimmed.length), "none left: the bottom");
// A merged turn (a read that completes the first one: its id changes) keeps the rest.
const merged = ["x0", ...old.slice(1)];
assert.deepEqual(remap({ from: 0, to: 10 }, old, merged, false), { from: 1, to: 10 });

// ── The live tail's trim keeps what is being read (keepFor) ─────────────────
// 40 turns of 50 entries (2 000), KEEP 1 200: following, the 24 last turns stay. Not following, main.js
// passes the first loaded turn: every turn stays (each is a row; one going above the view would move it).
const entries = [];
for (let t = 0; t < 40; t++) for (let k = 0; k < 50; k++) entries.push(k ? { k: "assistant", o: t * 50 + k } : { k: "user", turn: true, uuid: `t${t}`, o: t * 50 });
const state = { entries, start: 0, more: false };
const kept = (st) => st.entries.filter((e) => e.turn).map((e) => e.uuid);
assert.equal(keepFor(entries, null, 1200), 1200, "following the bottom: KEEP");
assert.deepEqual(kept(trim(state, keepFor(entries, null, 1200))).slice(0, 2), ["t16", "t17"]);
assert.equal(keepFor(entries, "t5", 1200), 1750);
assert.deepEqual(kept(trim(state, keepFor(entries, "t5", 1200)))[0], "t5", "the turn given stays, and every one after it");
assert.equal(keepFor(entries, "t0", 1200), 2000, "the first loaded turn: nothing goes");
assert.equal(keepFor(entries, "t30", 1200), 1200, "a window below KEEP: KEEP");
assert.equal(keepFor(entries, "head-0", 1200), 2000, "the read's opening part: everything");
assert.equal(keepFor(entries, "gone", 1200), 1200, "an id not found: KEEP");

// ── A16: the order a render describes its turns in (what it may draw goes to them first) ──
assert.deepEqual(nearFirst(10, 15, 14), [14, 13, 12, 11, 10], "following the bottom: the last first, then up (the code budget's order before)");
assert.deepEqual(nearFirst(10, 15, 12), [12, 13, 11, 14, 10], "the reader's turn, then outwards, the one below first");
assert.deepEqual(nearFirst(10, 15, 3), [10, 11, 12, 13, 14], "a cursor before the window: its first turn");
assert.deepEqual(nearFirst(10, 15, 99), [14, 13, 12, 11, 10]);
assert.deepEqual(nearFirst(4, 4, 4), []);
for (let f = 0; f < 6; f++) assert.deepEqual([...nearFirst(0, 6, f)].sort((a, b) => a - b), [0, 1, 2, 3, 4, 5], "every turn once");

console.log("turn-window.check: ok");
