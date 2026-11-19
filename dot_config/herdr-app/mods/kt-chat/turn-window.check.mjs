// bun ~/.config/herdr-app/mods/kt-chat/turn-window.check.mjs: turn-window.js (#59), the turns the
// Chat draws: never more than CAP, whatever the cursor, a jump, « Tours précédents » / « Tours
// suivants » or the live tail do. Ids are made up.
import assert from "node:assert/strict";
import { SHOW, CAP, bottom, reach, at, older, newer, remap, keepFor, nearFirst } from "./turn-window.js";
import { childOf } from "./chat-view.js";
import { trim } from "./chat-model.js";

const size = (w) => w.to - w.from;
const ids = (n, p = "t") => Array.from({ length: n }, (_, i) => `${p}${i}`);

// ── Reading a session ───────────────────────────────────────────────────────
assert.equal(SHOW, 10);
assert.equal(CAP, 15);
assert.ok(CAP > SHOW && CAP < 2 * SHOW, "one step more than a read, never two (the budget)");
assert.deepEqual(bottom(120), { from: 110, to: 120 });
assert.deepEqual(bottom(4), { from: 0, to: 4 });
assert.deepEqual(bottom(0), { from: 0, to: 0 });
assert.equal(childOf(110, 110), 1, "the head is child 0, the window's first turn child 1");

// ── The cursor (reach) ──────────────────────────────────────────────────────
const w = bottom(120);
assert.deepEqual(reach(w, 120, 115), w, "in the window: unchanged (no redraw of more turns)");
assert.deepEqual(reach(w, 120, 108), { from: 108, to: 120 }, "k above it: grown to it");
assert.deepEqual(reach({ from: 105, to: 120 }, 120, 104), { from: 104, to: 104 + CAP }, "past CAP: the bottom goes");
assert.deepEqual(reach(w, 120, 0), { from: 0, to: CAP }, "gg on 120 turns: CAP drawn, not 120");
assert.deepEqual(reach({ from: 0, to: CAP }, 120, 119), { from: 120 - CAP, to: 120 }, "G from the top: CAP, to the end");
assert.deepEqual(reach({ from: 0, to: CAP }, 120, CAP + 4), { from: 5, to: CAP + 5 }, "ctrl-d past the window");
assert.deepEqual(reach(w, 120, -1), w, "no turn: unchanged");
for (const i of [0, 7, 59, 60, 61, 119]) assert.ok(size(reach({ from: 50, to: 50 + CAP }, 120, i)) <= CAP);

// ── A jump (at): the turn on top, SHOW - 1 under it ─────────────────────────
assert.deepEqual(at(w, 120, 112), w, "drawn already: unchanged");
assert.deepEqual(at(w, 120, 3), { from: 3, to: 13 });
assert.deepEqual(at(w, 120, 0), { from: 0, to: 10 });
assert.deepEqual(at({ from: 0, to: 10 }, 120, 115), { from: 110, to: 120 }, "near the end: the last SHOW");
assert.deepEqual(at(bottom(6), 6, 2), { from: 0, to: 6 });
assert.deepEqual(at({ from: 0, to: 4 }, 30, 25), { from: 20, to: 30 });

// ── « Tours précédents » / « Tours suivants » ───────────────────────────────
// From the bottom (a live session): the window fills up to CAP first, the live turn (119) stays drawn.
assert.deepEqual(older({ from: 110, to: 120 }), { from: 120 - CAP, to: 120 }, "filled up to CAP, nothing cut below");
// At CAP: it slides SHOW up, the bottom goes to « Tours suivants ».
assert.deepEqual(older({ from: 105, to: 120 }), { from: 95, to: 95 + CAP });
assert.deepEqual(older({ from: 4, to: 14 }), { from: 0, to: 14 });
assert.deepEqual(newer({ from: 3, to: 13 }, 120), { from: 3, to: 3 + CAP }, "filled down to CAP first");
assert.deepEqual(newer({ from: 3, to: 3 + CAP }, 120), { from: 13, to: 13 + CAP }, "then SHOW more, the top cut");
assert.deepEqual(newer({ from: 110, to: 120 }, 120), { from: 110, to: 120 }, "at the end: nothing more");
assert.deepEqual(newer({ from: 112, to: 116 }, 120), { from: 112, to: 120 }, "the last ones");
for (const x of [older({ from: 50, to: 50 + CAP }), newer({ from: 50, to: 50 + CAP }, 120), older(w), newer({ from: 3, to: 13 }, 120)]) assert.ok(size(x) <= CAP);
// « Tours précédents » keeps the old first turn in view: it's child 6 after 5 more are drawn.
assert.equal(childOf(110, older(w).from), 1 + 110 - (120 - CAP));

// ── The turns built again (remap) ───────────────────────────────────────────
const old = ids(30);
// A read in front (« Tours précédents » from the file): 30 older turns, the same window by its ids.
const front = [...ids(30, "o"), ...old];
assert.deepEqual(remap({ from: 0, to: 10 }, old, front, false), { from: 30, to: 40 });
assert.deepEqual(older(remap({ from: 0, to: 10 }, old, front, false)), { from: 40 - CAP, to: 40 }, "then some of them, up to CAP");
// The live tail, not following the bottom: 5 new turns wait below, nothing above moves.
const grown = [...old, ...ids(5, "n")];
assert.deepEqual(remap({ from: 12, to: 22 }, old, grown, false), { from: 12, to: 22 });
assert.deepEqual(remap({ from: 20, to: 30 }, old, grown, false), { from: 20, to: 30 }, "even touching the old end: « Tours suivants · 5 »");
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
// 40 turns of 50 entries (2 000), KEEP 1 200: following, the 24 last turns stay. The reader up at turn
// 5 (a « Tours précédents » read while the agent works): turns 5 and after stay, the read ones too.
const entries = [];
for (let t = 0; t < 40; t++) for (let k = 0; k < 50; k++) entries.push(k ? { k: "assistant", o: t * 50 + k } : { k: "user", turn: true, uuid: `t${t}`, o: t * 50 });
const state = { entries, start: 0, more: false };
const kept = (st) => st.entries.filter((e) => e.turn).map((e) => e.uuid);
assert.equal(keepFor(entries, null, 1200), 1200, "following the bottom: KEEP");
assert.deepEqual(kept(trim(state, keepFor(entries, null, 1200))).slice(0, 2), ["t16", "t17"]);
assert.equal(keepFor(entries, "t5", 1200), 1750);
assert.deepEqual(kept(trim(state, keepFor(entries, "t5", 1200)))[0], "t5", "the window's first turn stays, nothing it draws goes");
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
