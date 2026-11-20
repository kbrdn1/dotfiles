// bun ~/.config/herdr-app/mods/kt-chat/timeline.check.mjs: timeline.js (#85), what herdr-app check
// can't reach: which messages get a bar, the stack and its window, the dock's lift, where the turns are
// without a scroll offset, which message is on screen, the jump's anchor and the [ ] step. Fixtures
// are made up (no real session).
import assert from "node:assert/strict";
import { TL, label, marks, barWindow, barStack, barLift, cardTop, offsets, viewTop, wheelAfter, wheelDy, activeAt, atEnd, anchorH, glide, stepMark, ownerOf } from "./timeline.js";

// ── The hover card stays in the transcript's box (never over the composer under it) ─────────
assert.equal(cardTop(100, 200, 600), 40, "room around: centred on its bar (mid - 60)");
assert.equal(cardTop(190, 200, 260) + (260 - 200) / 2 + 120, 260, "near the bottom of a short box: its bottom on the box's");
assert.equal(cardTop(4, 200, 260) + (260 - 200) / 2, 0, "near the top: its top on the box's");

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

// The view's top from what the engine hands the scroll area (journal on t1, 2026-11-20, the view
// following the bottom): the view's top at 61 px in the window, the content painted from -5415: 5476,
// which is the bottom (the rows' end 6295 + 8 of padding - a view of 827).
assert.equal(viewTop({ viewY: 61, contentY: -5415 }), 5476);
assert.equal(viewTop({ viewY: 61, contentY: -5415 }), 6295 + 8 - 827, "the bottom while following");
assert.equal(viewTop({ viewY: 61, contentY: 61 }), 0, "the content from the view's top: the head");
assert.equal(viewTop({ viewY: 122, contentY: -10830, z: 2 }), 5476, "at zoom 2, in design px");
assert.equal(viewTop({ viewY: 61, contentY: 70 }), 0, "never above the head");

// After an event: its delta (> 0 goes up) from the painted top, clamped to [0, max] as gpui clamps it.
let e = wheelAfter(null, { by: -5415, top: 5476, dy: 1, max: 5476 });
assert.deepEqual(e, { by: -5415, top: 5475 });
// The journal's burst: 13 events in 2 ms on the bounds of one paint (-3738: the top 3799), 420 px of
// deltas between them, then the next paint's bounds (-3318: 3379). Each event starts where the last left
// it; the next paint agrees.
const burst = [49, 45, 41, 39, 36, 33, 58, 24, 22, 21, 19, 17, 16];
e = null;
for (const dy of burst) e = wheelAfter(e, { by: -3738, top: viewTop({ viewY: 61, contentY: -3738 }), dy, max: 5476 });
assert.equal(e.top, 3799 - 420, "the burst adds up");
assert.equal(e.top, viewTop({ viewY: 61, contentY: -3318 }), "what the next paint shows");
assert.equal(wheelAfter(e, { by: -3318, top: 3379, dy: 14, max: 5476 }).top, 3365, "new bounds: from them");
// Against the head: gpui stops at 0 at each event, so a turn back down starts from 0.
e = wheelAfter(null, { by: 61, top: 0, dy: 100, max: 5476 });
assert.equal(e.top, 0);
assert.equal(wheelAfter(e, { by: 61, top: 0, dy: -30, max: 5476 }).top, 30, "back down from the head, not from -100");
assert.equal(wheelAfter(null, { by: -5415, top: 5476, dy: -800, max: 5476 }).top, 5476, "the end");
// A14: the area scrolls y only, so a delta of 0 in y moves it by delta.x.
assert.equal(wheelDy({ x: 0, y: -40 }), -40);
assert.equal(wheelDy({ x: 25, y: 0 }), 25, "a sideways swipe scrolls the transcript");
assert.equal(wheelDy({ x: 25, y: -3 }), -3, "a y of its own wins");
assert.equal(wheelDy(undefined), 0);

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
// A window that stops before the end (#59): its bottom is « Tours suivants », not the last message.
assert.deepEqual(at(960, { whole: false }), { k: 3, above: false }, "e starts in the view anyway");
assert.deepEqual(activeAt({ marks: mk, tops: new Map([["a", 60], ["c", 360]]), scrollTop: 900, vh: 500, end: 1410, whole: false }), { k: 1, above: true },
  "e not drawn (after the window): the last above, not the last message");
assert.deepEqual(at(0, { follow: true }), { k: 3, above: false }, "following the bottom: the last");
assert.deepEqual(activeAt({ marks: [], tops, scrollTop: 0, vh: 500, end: 1461 }), { k: -1, above: false });
// Turns not drawn (before `first`) are above; a drawn turn not measured yet ends the walk.
assert.deepEqual(activeAt({ marks: mk, tops: new Map([["e", 1260]]), first: 4, scrollTop: 900, vh: 200, end: 1461 }), { k: 1, above: true });
assert.deepEqual(activeAt({ marks: mk, tops: new Map(), first: 0, scrollTop: 0, vh: 500, end: 9000 }), { k: 0, above: false }, "nothing measured: the first");

// The bottom, where a wheel going down follows it again (#59): within 16 px of a whole window's end.
assert.equal(atEnd({ scrollTop: 945, vh: 500, end: 1461 }), true, "16 px from the end");
assert.equal(atEnd({ scrollTop: 944, vh: 500, end: 1461 }), false, "17 px");
assert.equal(atEnd({ scrollTop: 961, vh: 500, end: 1461, whole: false }), false, "« Tours suivants » below: not the bottom");

// ── The jump ────────────────────────────────────────────────────────────────
// A view tall, so the smallest scroll puts its top at the view's top either way...
assert.equal(anchorH({ y: 360, end: 1461, vh: 500 }), 500);
// ...never past the end: the last turn's anchor stops there (the view then rests at the bottom).
assert.equal(anchorH({ y: 1260, end: 1461, vh: 500 }), 201);
assert.equal(anchorH({ y: 1461, end: 1461, vh: 500 }), 1);

// The glide: where the view lands, and how far off its content starts (end 1461 + 8 under, view 500: max 969).
const gl = (o) => glide({ vh: 500, max: 969, h: 500, ...o });
assert.deepEqual(gl({ y: 360, from: 100 }), { top: 360, dy: 260 }, "down a little: the first image is the view it left, 260 lower");
assert.deepEqual(gl({ y: 360, from: 800 }), { top: 360, dy: -440 }, "up: drawn higher, it slides down");
assert.deepEqual(gl({ y: 1260, h: 201, from: 0 }), { top: 961, dy: 500 }, "far: one view at most, the smallest scroll's landing near the end");
assert.deepEqual(gl({ y: 360, from: 360 }), { top: 360, dy: 0 }, "already there: nothing");
assert.deepEqual(gl({ y: 360, from: 360.4 }), { top: 360, dy: 0 }, "under a pixel: nothing");
assert.deepEqual(gl({ y: 360, dir: 1 }), { top: 360, dy: 360 }, "from unknown, from above: a view, but never above the content's top");
assert.deepEqual(gl({ y: 360, dir: -1 }), { top: 360, dy: -500 }, "from unknown, from below: a view");
assert.deepEqual(gl({ y: 1260, h: 201, dir: -1 }), { top: 969, dy: 0 }, "from below at the bottom: nothing under it to come from");
assert.deepEqual(gl({ y: 360, dir: 0 }), { top: 360, dy: 0 }, "no way to tell: no glide");
assert.deepEqual(gl({ y: 60, dir: 1 }), { top: 60, dy: 60 }, "a far jump down: the window starts at its turn, only the head above (#59): almost a snap");
assert.deepEqual(glide({ y: 100, h: 200, vh: 500, max: -192, from: 0 }), { top: 0, dy: 0 }, "a conversation shorter than the view: no scroll, nothing");
for (const o of [{ y: 900, from: 0 }, { y: 0, from: 969 }, { y: 500, dir: 1 }, { y: 500, dir: -1 }]) {
  const { top, dy } = gl(o);
  assert.ok(top - dy >= 0 && top - dy <= 969 && Math.abs(dy) <= 500, `never past the content, a view at most: ${JSON.stringify(o)}`);
}

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
