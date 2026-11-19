// bun ~/.config/herdr-app/mods/kt-chat/turn-band.check.mjs: turn-band.js (#59, the infinite scroll's lot 2), which
// loaded turns a render draws whole: the band around the view, CAP at most, following the bottom, a
// jump's, and a never drawn turn's estimated height. Made-up heights.
import assert from "node:assert/strict";
import { OVER, layout, band, bottomBand, jumpBand, aroundBand, estimate, rowPlan } from "./turn-band.js";
import { CAP } from "./turn-window.js";

const same = (n, h) => Array.from({ length: n }, () => h);

// ── Where the rows are ───────────────────────────────────────────────────────
assert.deepEqual(layout(40, [100, 200, 300], 20), { at: [60, 160, 360], end: 660 }, "the head's row, then the turns, from the area's padding");

// ── The band around the view ─────────────────────────────────────────────────
assert.equal(OVER, 1);
// Ten turns of 200 (tops 60, 260, …, 1860), a view of 500 at 1000: [500, 2000) meets turns 2 to 9.
assert.deepEqual(band({ head: 40, heights: same(10, 200), inset: 20, top: 1000, vh: 500 }), { from: 2, to: 10 });
assert.deepEqual(band({ head: 40, heights: same(10, 200), inset: 20, top: 0, vh: 500 }), { from: 0, to: 5 }, "at the top: the view and one more below");
// Thirty short turns (50 px): more than CAP meet the band, the ones around the view's middle kept.
const many = band({ head: 40, heights: same(30, 50), inset: 20, top: 600, vh: 500 });
assert.equal(many.to - many.from, CAP);
assert.deepEqual(many, { from: 8, to: 23 }, "the turn at the view's middle (850: turn 15) in the middle of them");
assert.deepEqual(band({ head: 40, heights: same(5, 200), inset: 20, top: 99999, vh: 500 }), { from: 4, to: 5 }, "a view past the rows: the last");
assert.deepEqual(band({ head: 40, heights: [], inset: 20, top: 0, vh: 500 }), { from: 0, to: 0 });

// ── Following the bottom ─────────────────────────────────────────────────────
assert.deepEqual(bottomBand({ heights: same(10, 200), vh: 500 }), { from: 5, to: 10 }, "the view and one more above it");
assert.deepEqual(bottomBand({ heights: same(10, 200), vh: 500, cap: 3 }), { from: 7, to: 10 });
assert.deepEqual(bottomBand({ heights: [3000], vh: 500 }), { from: 0, to: 1 }, "one tall turn");

// ── A jump ───────────────────────────────────────────────────────────────────
assert.deepEqual(jumpBand({ heights: same(10, 200), i: 3, vh: 500 }), { from: 3, to: 8 }, "from the target down: nothing above it changes in that render");
assert.deepEqual(jumpBand({ heights: same(10, 200), i: 9, vh: 500 }), { from: 9, to: 10 });

// ── The rows: the band and near it one each, a spacer a run past that ───────
assert.deepEqual(rowPlan(10, 4, 6, 1), [{ i: 0, to: 3 }, { i: 3 }, { i: 4 }, { i: 5 }, { i: 6 }, { i: 7, to: 10 }]);
assert.deepEqual(rowPlan(3, 0, 3, 1), [{ i: 0 }, { i: 1 }, { i: 2 }], "all near: no spacer");
assert.deepEqual(rowPlan(480, 470, 480).length, 1 + 25, "480 turns at the bottom: one spacer, CAP boxes, the band");
assert.deepEqual(rowPlan(0, 0, 0), []);

// ── The cursor's turn ────────────────────────────────────────────────────────
assert.deepEqual(aroundBand({ head: 40, heights: same(10, 200), inset: 20, i: 5, vh: 500 }), { from: 1, to: 10 }, "around its middle (1160): the view [910, 1410) and one more each side");
assert.deepEqual(aroundBand({ head: 40, heights: [200, 5000, 200], inset: 20, i: 1, vh: 500 }), { from: 1, to: 2 }, "a turn taller than the band: itself");
assert.deepEqual(aroundBand({ head: 40, heights: same(10, 200), inset: 20, i: 0, vh: 500 }).from, 0);

// ── A never drawn turn's height ──────────────────────────────────────────────
const t = (text, answer, { fold = null, live = false } = {}) => ({
  user: { text }, fold, live,
  items: answer ? [{ type: "block", block: { role: "prose", text: answer } }] : [],
  blocks: answer ? [{ role: "prose", text: answer }] : [],
});
const short = estimate(t("salut", "ok"));
assert.ok(short > 100 && short < 220, `a short exchange: about a bubble, a line, the actions (${short})`);
assert.ok(estimate(t("salut", "x".repeat(900))) > short + 200, "a long answer, taller");
assert.equal(estimate(t("salut", "ok", { fold: { start: 0, end: -1 } })) - short, 36, "a fold's « … a travaillé »");
assert.equal(estimate(t("salut", "ok", { live: true })) - short, -38, "a live turn has no actions row yet");
assert.ok(estimate(t("a\nb\nc\nd\ne\nf\ng", "ok")) === estimate(t("a\nb\nc\nd", "ok")), "a bubble folds past 4 lines");

console.log("turn-band.check: ok");
