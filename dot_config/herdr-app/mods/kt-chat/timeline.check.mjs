// bun ~/.config/herdr-app/mods/kt-chat/timeline.check.mjs: timeline.js (#85), what herdr-app check
// can't reach: which messages get a bar, the stack and its window, the dock's lift, where the turns are
// without a scroll offset, which message is on screen, the jump's anchor and the [ ] step. Fixtures
// are made up (no real session).
import assert from "node:assert/strict";
import { TL, label, marks, barWindow, barStack, barLift, offsets, pairWheel, wheelTop, activeAt, anchorH, stepMark, ownerOf } from "./timeline.js";

// ── Which messages (classify's verdict, as chat-index.ts leaves it) ─────────
assert.equal(label("\n  fix   the\tbug \nmore"), "fix the bug", "the first non-empty line, spaces collapsed");
assert.equal(label("  \n"), "");
assert.equal(label(null), "");
const turns = [
  { id: "h0", user: null, blocks: [] }, // before the first prompt: no opener
  { id: "a", user: { text: "Fais la chose\nsur deux lignes" }, blocks: [{ role: "prose", id: "p1", text: "ok" }] },
  { id: "b", user: { text: "un pair", from: { kind: "peer", name: "x" } }, blocks: [] }, // another agent: no bar
  { id: "c", user: { text: "", cmd: { name: "/me:goal", args: "sprint" } }, blocks: [
    { role: "note", id: "n1", text: "et aussi ça", from: null }, // typed while it worked: a bar
    { role: "note", id: "n2", text: "un coéquipier", from: { kind: "teammate" } }, // a teammate: none
    { role: "note", id: "n3", text: "   ", from: null }, // nothing to show: none
  ] },
  { id: "d", user: { text: "injecté", meta: true }, blocks: [] }, // the harness's: none
  { id: "e", user: { text: "", images: 2 }, blocks: [] }, // images only: a bar, no text
  { id: "f", user: { text: "sys", from: { kind: "system" } }, blocks: [] },
];
const mk = marks(turns);
assert.deepEqual(mk.map((m) => m.id), ["a", "c", "n1", "e"]);
assert.deepEqual(mk.map((m) => m.i), [1, 3, 3, 5], "a note keeps its turn");
assert.deepEqual(mk.map((m) => m.text), ["Fais la chose", "/me:goal sprint", "et aussi ça", ""]);
assert.equal(mk[2].note, true);
assert.equal(mk[2].turn, "c");
assert.equal(mk[3].images, 2);

// ── The stack (outline.rs's own tests) ──────────────────────────────────────
assert.deepEqual(barWindow(5, -1, 10), [0, 5]);
assert.deepEqual(barWindow(20, -1, 10), [10, 20], "the newest by default");
assert.deepEqual(barWindow(20, 3, 10), [3, 13], "the active one kept inside");
assert.deepEqual(barWindow(20, 18, 10), [10, 20]);
assert.deepEqual(barStack(8, -1, 330), { start: 0, end: 8, gap: 10 });
assert.deepEqual(barStack(100, -1, 330), { start: 0, end: 100, gap: 1 }, "the gap shrinks first");
assert.deepEqual(barStack(200, -1, 330), { start: 90, end: 200, gap: 1 }, "then a window slides");
assert.deepEqual(barStack(1, 0, 330), { start: 0, end: 1, gap: 0 });
// A short pane: the budget is 75 % of its height, never more than 330.
assert.equal(Math.min(TL.STACK_MAX, Math.floor(300 * TL.SHARE)), 225);
assert.deepEqual(barStack(30, 29, 225), { start: 0, end: 30, gap: 5 }, "(225 - 30 × 2) / 29, floored");

// ── The dock's lift ─────────────────────────────────────────────────────────
assert.equal(barLift(4, -1), 0);
assert.equal(barLift(4, 4), 1);
assert.ok(Math.abs(barLift(3, 4) - 2 / 3) < 1e-9);
assert.ok(Math.abs(barLift(6, 4) - 1 / 3) < 1e-9);
assert.equal(barLift(7, 4), 0);
// The widths it gives: 24 on the hovered bar, 11 at rest.
assert.equal(TL.BAR_W + (TL.BAR_LIFT - TL.BAR_W) * barLift(4, 4), 24);
assert.equal(TL.BAR_W + (TL.BAR_LIFT - TL.BAR_W) * barLift(9, 4), 11);

// ── Where the turns are ─────────────────────────────────────────────────────
// The head (40), three turns (300, 900, 200), the end mark (1); the area's top padding 20.
const o = offsets([40, 300, 900, 200, 1], 20);
assert.deepEqual(o.tops, [20, 60, 360, 1260, 1460]);
assert.equal(o.end, 1461);
assert.equal(o.known, true);
assert.equal(offsets([40, undefined, 200], 20).known, false, "a row not measured yet");

// The offset from a wheel event: the pointer 120 px into the turn at 360, 300 px down the view: the
// view's top is at 180; the wheel goes down 50 (delta -50): 230. Up past the top: 0; down past the end: max.
assert.equal(wheelTop({ top: 360, inRow: 120, inView: 300, dy: 0, max: 1000 }), 180);
assert.equal(wheelTop({ top: 360, inRow: 120, inView: 300, dy: -50, max: 1000 }), 230);
assert.equal(wheelTop({ top: 360, inRow: 120, inView: 300, dy: 400, max: 1000 }), 0);
assert.equal(wheelTop({ top: 360, inRow: 120, inView: 300, dy: -2000, max: 1000 }), 1000);

// The two halves of one wheel event, in either order; a half of another event (another pointer) waits.
const row = (y, px = 5, py = 400) => ({ row: "kc-turn-c", px, py, y });
const view = (y, dy, px = 5, py = 400) => ({ row: null, px, py, y, dy });
let w = pairWheel(null, row(120));
assert.equal(w.pair, null);
w = pairWheel(w.keep, view(300, -50));
assert.deepEqual(w, { keep: null, pair: { id: "kc-turn-c", inRow: 120, inView: 300, dy: -50 } }, "the row first");
w = pairWheel(pairWheel(null, view(300, -50)).keep, row(120));
assert.deepEqual(w.pair, { id: "kc-turn-c", inRow: 120, inView: 300, dy: -50 }, "the area first");
w = pairWheel(pairWheel(null, view(300, -50, 5, 380)).keep, row(120));
assert.equal(w.pair, null, "the area's half of an earlier event (the pointer moved) is not this one's");
assert.deepEqual(pairWheel(w.keep, view(300, -20)).pair, { id: "kc-turn-c", inRow: 120, inView: 300, dy: -20 }, "its own half pairs");

// ── The message on screen (measure_active) ──────────────────────────────────
// Turns a (top 60), c (360, with its note n1), e (1260); a view of 500, the content ending at 1461.
const tops = new Map([["h0", 20], ["a", 60], ["c", 360], ["e", 1260]]);
const at = (scrollTop, extra = {}) => activeAt({ marks: mk, tops, scrollTop, vh: 500, end: 1461, ...extra });
assert.deepEqual(at(0), { k: 0, above: false }, "the first whose turn starts in the view");
assert.deepEqual(at(100), { k: 1, above: false }, "a scrolled away, c starts in the view");
assert.deepEqual(at(400), { k: 1, above: true }, "no turn starts in the view: the last above, its first message");
assert.deepEqual(at(400, { cur: 2 }), { k: 2, above: true }, "the note lit now stays lit within its turn");
assert.deepEqual(at(400, { cur: 0 }), { k: 1, above: true }, "but not a message of another turn");
assert.deepEqual(at(960), { k: 3, above: false }, "within 16 px of the end: the last");
assert.deepEqual(at(0, { follow: true }), { k: 3, above: false }, "following the bottom: the last");
assert.deepEqual(activeAt({ marks: [], tops, scrollTop: 0, vh: 500, end: 1461 }), { k: -1, above: false });
// Turns not drawn (before `first`) are above; a drawn turn not measured yet ends the walk.
assert.deepEqual(activeAt({ marks: mk, tops: new Map([["e", 1260]]), first: 4, scrollTop: 900, vh: 200, end: 1461 }), { k: 1, above: true });
assert.deepEqual(activeAt({ marks: mk, tops: new Map(), first: 0, scrollTop: 0, vh: 500, end: 9000 }), { k: 0, above: false }, "nothing measured: the first");

// ── The jump ────────────────────────────────────────────────────────────────
// A view tall, so the smallest scroll puts its top at the view's top either way...
assert.equal(anchorH({ y: 360, end: 1461, vh: 500 }), 500);
// ...never past the end: the last turn's anchor stops there (the view then rests at the bottom).
assert.equal(anchorH({ y: 1260, end: 1461, vh: 500 }), 201);
assert.equal(anchorH({ y: 1461, end: 1461, vh: 500 }), 1);

// ── [ ] ────────────────────────────────────────────────────────────────────
assert.equal(stepMark(4, 1, false, 1), 2);
assert.equal(stepMark(4, 1, false, -1), 0);
assert.equal(stepMark(4, 1, true, -1), 1, "its bubble above the view: back to its own top first (vim's {)");
assert.equal(stepMark(4, 3, true, -1, 2), 2, "a count: that, then one more");
assert.equal(stepMark(4, 3, false, 1, 5), 3, "clamped at the last");
assert.equal(stepMark(4, 0, false, -1, 3), 0, "and at the first");
assert.equal(stepMark(4, -1, false, -1), 2, "none lit: from the last");
assert.equal(stepMark(0, 0, false, 1), -1);

// The message a turn belongs to (the cursor's, after j / k).
assert.equal(ownerOf(mk, 1), 0);
assert.equal(ownerOf(mk, 2), 0, "a peer's turn: the message before it");
assert.equal(ownerOf(mk, 3), 1, "its first message, not its note");
assert.equal(ownerOf(mk, 6), 3);
assert.equal(ownerOf(mk, 0), 0, "before any: the first");

console.log("timeline.check: ok");
