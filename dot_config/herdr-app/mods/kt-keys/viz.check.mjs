// bun ~/.config/herdr-app/mods/kt-keys/viz.check.mjs: viz.js's Bayer threshold, its runs (merged across
// and down, covering exactly the inked cells), the gauge's and the donut's angles, the monotone cubic
// (through its points, no overshoot), the round scale, compact, split_delta (Monocode's own tests,
// ported), the width reveal and reduced motion, the memo, and the element budget per visual (< 400),
// with gpui-kit mocked. Prints each visual's elements and painted rectangles.
import assert from "node:assert/strict";
import { plugin } from "bun";

const el = (kind = "div") => {
  const node = { kind, kids: [], props: {}, tr: [], on: {} };
  const p = new Proxy(node, {
    get(target, k) {
      if (k in target) return target[k];
      return (...a) => {
        if (k === "child") target.kids.push(a[0]);
        else if (k === "children") target.kids.push(...a[0]);
        else if (k === "when") return a[0] ? a[1](p) : p;
        else if (k === "transition") target.tr.push(a[0]);
        else if (k.startsWith("on_")) target.on[k] = a.at(-1);
        else target.props[k] = a;
        return p;
      };
    },
  });
  return p;
};
// A path: its commands counted, a rectangle per move_to (what Herdr replays at every render).
const builder = (kind) => {
  const b = { kind, moves: 0, commands: 0 };
  const api = {
    move_to: () => (b.moves++, b.commands++, api),
    line_to: () => (b.commands++, api),
    close: () => (b.commands++, api),
    build: () => b,
  };
  return api;
};
plugin({ setup(build) {
  build.module("gpui-kit", () => ({ loader: "object", exports: {
    div: () => el(),
    svg: () => el(),
    PathBuilder: { fill: () => builder("fill"), stroke: (w) => builder(`stroke${w}`) },
    Background: { linear_gradient: (...a) => ({ gradient: a }) },
  } }));
  // viz.js' words (i18n.js): no language set, a check: French.
  build.module("herdr", () => ({ loader: "object", exports: {
    shared: () => undefined, setShared: () => {}, exec: async () => ({ code: 0, stdout: "" }), checking: () => true,
  } }));
} });
globalThis.window = { paint_path: (path, bg) => { const e = el("paint"); e.path = path; e.bg = bg; return e; } };
const V = await import("./viz.js");
const { motionState, frame } = await import("./motion.js");

const count = (n) => (n && typeof n === "object" && "kids" in n ? 1 + n.kids.reduce((s, k) => s + count(k), 0) : 0);
const find = (n, pred) => (pred(n) ? n : n?.kids?.reduce((r, k) => r ?? find(k, pred), null) ?? null);

// Bayer: tone k/16 inks exactly k cells of a 4×4 tile; 0.25 is a quarter.
for (let k = 0; k <= 16; k++) {
  let n = 0;
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) n += V.inked(x, y, k / 16);
  assert.equal(n, k, `tone ${k}/16`);
}
let quarter = 0;
for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) quarter += V.inked(x, y, 0.25);
assert.equal(quarter, 16, "0.25 inks a quarter of an 8×8 block");

// runs: a run across, an equal run below grows it down, a different one starts a rectangle.
assert.deepEqual(V.runs(4, 3, (c, r) => (r < 2 ? (c < 3 ? "a" : null) : c === 0 ? "a" : "b"), 3),
  [[0, 0, 9, 6, "a"], [0, 6, 3, 3, "a"], [3, 6, 9, 3, "b"]]);
// ...and on a random grid the rectangles cover exactly the inked cells, once, in their key.
let seed = 7;
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const grid = Array.from({ length: 23 }, () => Array.from({ length: 37 }, () => (rand() < 0.4 ? null : rand() < 0.5 ? "x" : 2)));
const cover = new Map();
for (const [x, y, w, h, k] of V.runs(37, 23, (c, r) => grid[r][c], 2))
  for (let r = y / 2; r < (y + h) / 2; r++) for (let c = x / 2; c < (x + w) / 2; c++) {
    assert.ok(!cover.has(`${c},${r}`), "a cell painted twice");
    cover.set(`${c},${r}`, k);
  }
for (let r = 0; r < 23; r++) for (let c = 0; c < 37; c++) assert.equal(cover.get(`${c},${r}`) ?? null, grid[r][c], `cell ${c},${r}`);

// Gauge: 0° at 12 o'clock, clockwise; 270° from -135° (7:30) to 135° (4:30); blocks up to the value.
assert.equal(V.gaugeAngle(0, -1), 0);
assert.equal(V.gaugeAngle(1, 0), 90);
assert.equal(V.gaugeAngle(-1, 0), -90);
assert.ok(Math.abs(V.gaugeAngle(-1, 1) + 135) < 1e-9);
const g = V.gaugeInk(0.44, 220);
assert.equal(g.active, 16, "44 % of 36 blocks: 16 lit, the 16th the head");
for (let row = 0; row < g.rows; row++) for (let col = 0; col < g.cols; col++) {
  const k = g.ink(col, row);
  if (!k) continue;
  const along = V.gaugeAngle((col + 0.5) * 3 - g.c, (row + 0.5) * 3 - g.c) + 135;
  assert.ok(along >= 0 && along < 270, `cell ${col},${row} outside the dial (${along})`);
  if (k === "tint") assert.ok(along < g.active * g.step, `lit beyond the value at ${along}`);
  else assert.ok(along >= (g.active - 1) * g.step, `track before the head at ${along}`);
}
assert.equal(V.gaugeInk(0, 220).active, 0);
assert.equal(V.gaugeInk(1, 220).active, 36);

// Donut: slices from 12 o'clock clockwise, a gap at each edge, nothing in the hole.
assert.equal(V.ringAngle(0, -1), 0);
assert.ok(Math.abs(V.ringAngle(-1, 0) - 1.5 * Math.PI) < 1e-9);
const d = V.donutInk([1, 1, 2], 184);
assert.deepEqual(d.edges.map((e) => +e.toFixed(6)), [0, +(Math.PI / 2).toFixed(6), +Math.PI.toFixed(6)]);
for (let row = 0; row < d.rows; row++) for (let col = 0; col < d.cols; col++) {
  const k = d.ink(col, row);
  if (k == null) continue;
  const [dx, dy] = [(col + 0.5) * 3 - d.half, (row + 0.5) * 3 - d.half];
  const a = V.ringAngle(dx, dy);
  assert.equal(k, a < Math.PI / 2 ? 0 : a < Math.PI ? 1 : 2, `slice of cell ${col},${row}`);
  const r = Math.hypot(dx, dy);
  assert.ok(r >= d.inner && r <= d.outer);
  const edge = Math.min(...d.edges.map((e) => { const x = Math.abs(a - e); return Math.min(x, 2 * Math.PI - x); }));
  assert.ok(edge > Math.PI / 2 || (r * Math.sin(edge)) / 3 >= 0.75, `cell ${col},${row} in an edge's gap`);
}

// Monotone cubic (Monocode's test): through its points, flat between equal ones, never past them.
const curve = new V.Curve([[0, 10], [10, 0], [20, 0], [30, 10]]);
assert.equal(curve.at(10), 0);
for (let x = 10; x <= 20; x++) assert.ok(Math.abs(curve.at(x)) < 1e-4, "flat between equal points");
for (let x = 0; x <= 30; x++) assert.ok(curve.at(x) >= 0 && curve.at(x) <= 10);
for (let n = 0; n < 50; n++) {
  const pts = Array.from({ length: 8 }, (_, i) => [i * 10 + rand() * 4, rand() * 100]);
  const c = new V.Curve(pts);
  for (let k = 0; k < pts.length - 1; k++) {
    const [lo, hi] = [Math.min(pts[k][1], pts[k + 1][1]), Math.max(pts[k][1], pts[k + 1][1])];
    for (let s = 0; s <= 20; s++) {
      const y = c.at(pts[k][0] + ((pts[k + 1][0] - pts[k][0]) * s) / 20);
      assert.ok(y >= lo - 1e-6 && y <= hi + 1e-6, "overshoot");
    }
  }
}
// A line in cells stays joined on a steep slope: each column's rows meet the next one's.
const steep = new V.Curve([[0, 0], [9, 90], [30, 0]]);
const lr = Array.from({ length: 10 }, (_, col) => V.lineRows(steep, col, 3, 40));
for (let col = 0; col < 9; col++) assert.ok(lr[col][1] >= lr[col + 1][0] && lr[col + 1][1] >= lr[col][0], `gap between columns ${col} and ${col + 1}`);

// Round scale and compact numbers (Monocode's tests).
const s = V.Scale.nice([42, 74], true);
assert.deepEqual([s.min, s.max, s.step], [0, 80, 20]);
assert.deepEqual(s.ticks(), [0, 20, 40, 60, 80]);
const flat = V.Scale.nice([5, 5], false);
assert.ok(flat.max > flat.min);
assert.deepEqual(V.Scale.nice([], true).ticks(), [0, 0.25], "no values: a quarter step from 0, as in Rust");
assert.equal(V.compact(48210, 1), "48.2K");
assert.equal(V.compact(0.25, 0.25), "0.25");
assert.equal(V.compact(2500000, 1), "2.5M");
assert.equal(V.compact(12000, 1), "12K");
assert.equal(V.compact(1.5, 0.5), "1.5");

// split_delta (Monocode's test).
assert.deepEqual(V.splitDelta("+12.4% vs last month"), ["+12.4%", "vs last month"]);
assert.deepEqual(V.splitDelta("-3"), ["-3", ""]);
assert.equal(V.splitDelta("requests per day"), null);
assert.equal(V.splitDelta("+ more"), null);

// Tokens: Monocode's names, theme names and #hex.
const t = { background: "#191919d9", foreground: "#e0e0e0", accent: "#d4825d", border: "#2a2a2a", dim: "#666666", muted: "#999999",
  ansi1: "#e06060", ansi2: "#6bc97f", ansi3: "#e6c654", ansi4: "#5aa0e6", ansi5: "#a87ee0", ansi6: "#6fa39c" };
assert.equal(V.color(t, "positive"), t.ansi2);
assert.equal(V.color(t, "faint"), t.dim);
assert.equal(V.color(t, "series1"), t.ansi4);
assert.equal(V.color(t, "#123456"), "#123456");
assert.equal(V.faint("#191919d9", 0.4), "#19191966", "alpha replaced, not stacked");
assert.equal(V.isLight(t), false);

// Reveal: width 0 on the first draw, w after the first layout, once; reduced motion: no transition.
const m = motionState();
let r = V.reveal(frame(m, false), "rv", 200, 9, el());
let clip = r.kids[0];
assert.deepEqual(clip.props.w, [0]);
assert.equal(clip.tr[0], "width");
let notified = 0;
r.on.on_size_change({ width: 200, height: 9 }, { notify: () => notified++ });
r.on.on_size_change({ width: 200, height: 9 }, { notify: () => notified++ });
assert.equal(notified, 1);
assert.deepEqual(V.reveal(frame(m, false), "rv", 200, 9, el()).kids[0].props.w, [200]);
const red = V.reveal(frame(motionState(), true), "rv", 200, 9, el());
assert.deepEqual([red.tr, red.on, red.kids[0].props.w], [[], {}, undefined]);

// The cap: a geometry over MAX_RECTS is rebuilt once with coarser cells, never past twice the cell.
const area = (c) => V.chartGeometry("area", [[12e3, 18e3, 15e3, 32e3, 41e3, 38e3, 52e3, 47e3, 61e3, 58e3]], 10, 568, 220, c);
const fine = area(3);
const capped = V.capped(area, 3);
assert.ok(fine.rects.length > V.MAX_RECTS, "the Monocode-sized area is over the cap at 3 px");
assert.ok(capped.cell > 3 && capped.cell <= 6 && capped.rects.length <= V.MAX_RECTS, `capped to ${capped.cell} px, ${capped.rects.length} rects`);
assert.equal(V.capped(() => ({ rects: [[0, 0, 3, 3, "a"]], cell: 3 }), 3).cell, 3, "under the cap: untouched");
console.log(`area 568×220: ${fine.rects.length} rects at 3 px -> ${capped.rects.length} at ${capped.cell} px`);

// Track under, ink over: a progress bar's track is one rectangle, painted first.
const pg = V.progressGeometry(0.62, 420);
assert.deepEqual(pg.rects[0], [0, 0, 420, 9, "track"]);
assert.ok(pg.rects.slice(1).every((r) => r[4] === "tint" && r[0] + r[2] <= pg.head * 3));

// The visuals at the gallery's sizes: each under the cap, few elements, what a render replays.
const viz = V.viz(t, frame(motionState(), false));
const weeks = Array.from({ length: 7 }, (_, r) => Array.from({ length: 26 }, (_, c) => ((r * 7 + c * 13) % 9) - 1));
const cases = {
  gauge: () => viz.gauge("Quota hebdo", 44, { unit: "%" }),
  donut: () => viz.donut([{ label: "Terminal", value: 42 }, { label: "Threads", value: 27 }, { label: "Diff", value: 14 }, { label: "Files", value: 9 }], { label: "Heures" }),
  progress: () => viz.progress("Quota 5 h", 62, { detail: "reset dans 1 h 40", width: 320 }),
  "chart bar": () => viz.chart("bar", [{ label: "verts", values: [12, 15, 9, 18, 21, 17, 14, 19, 22, 20, 16, 24, 23, 26] }, { label: "rouges", values: [2, 1, 4, 0, 2, 3, 1, 0, 2, 1, 5, 1, 0, 2] }], { labels: Array.from({ length: 14 }, (_, i) => `J${i + 1}`), width: 400, height: 170 }),
  "chart line": () => viz.chart("line", [{ label: "p50", values: [120, 132, 101, 98, 140, 160, 151, 149, 170, 165] }, { label: "p95", values: [320, 410, 380, 300, 520, 610, 480, 450, 700, 640] }], { width: 400, height: 170 }),
  "chart area": () => viz.chart("area", [{ label: "tokens", values: [12e3, 18e3, 15e3, 32e3, 41e3, 38e3, 52e3, 47e3, 61e3, 58e3] }], { width: 400, height: 170 }),
  heatmap: () => viz.heatmap(weeks, { rows: ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"], columns: Array.from({ length: 26 }, (_, i) => ["juin", "juil", "août", "sept", "oct", "nov"][Math.floor(i / 4.4)]), width: 421 }),
  stat: () => viz.stat("Coût du mois", "$412", { detail: "+12.4% vs octobre", trend: [310, 290, 340, 360, 330, 390, 412], better: "lower", width: 220 }),
  steps: () => viz.steps(["Issue", "Worktree", "Implémentation", "PR", "Review", "CI", "Merge"].map((label, i) => ({ label, state: ["done", "done", "skipped", "done", "current", "todo", "todo"][i] })), { width: 420 }),
  "steps tier": () => viz.steps(Array.from({ length: 14 }, (_, i) => ({ label: `S${i}`, group: `P${[0, 0, 0, 0, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3][i]}`,
    state: i < 9 ? "done" : i === 9 ? "current" : "todo" })), { width: 420, id: "steps-tier" }),
};
const report = [];
let total = 0;
for (const [name, make] of Object.entries(cases)) {
  const a = make();
  const n = count(a);
  const paints = [];
  (function walk(x) { if (x?.kind === "paint") paints.push(x); x?.kids?.forEach(walk); })(a);
  assert.ok(paints.length > 0, `${name} paints nothing`);
  // Rectangles (one per run, inside the painted paths) and the commands a render replays.
  const rects = paints.reduce((s, x) => s + (x.path.moves ?? 0), 0);
  const cmds = paints.reduce((s, x) => s + (x.path.commands ?? 0), 0);
  total += rects;
  assert.ok(rects <= V.MAX_RECTS * 1.05, `${name}: ${rects} rects`); // + the few strokes and gradients
  report.push(`${name.padEnd(11)} ${String(n).padStart(3)} elements, ${String(paints.length).padStart(2)} paths, ${String(rects).padStart(4)} rects, ${String(cmds).padStart(4)} commands`);
}
console.log(report.join("\n") + `\ntotal ${total} rects`);

// Without `width`, a visual fills its container: a placeholder until measured, then drawn at the
// measured width, with cells chosen from its area so a 3000 px chart stays under both caps.
const fm = motionState();
const rectsOf = (x) => { const ps = []; (function walk(n) { if (n?.kind === "paint") ps.push(n); n?.kids?.forEach(walk); })(x); return ps.reduce((s, p) => s + (p.path.moves ?? 0), 0); };
const widest = (x) => { let w = 0; (function walk(n) { if (n?.props?.w) w = Math.max(w, n.props.w[0]); n?.kids?.forEach(walk); })(x); return w; };
const wide = [];
for (const [name, make] of [
  ["area", (v) => v.chart("area", [{ values: [12e3, 18e3, 15e3, 32e3, 41e3, 38e3, 52e3, 47e3, 61e3, 58e3] }], { height: 170, id: "w-area" })],
  ["bar", (v) => v.chart("bar", [{ values: [12, 15, 9, 18, 21, 17, 14, 19, 22, 20, 16, 24, 23, 26] }, { values: [2, 1, 4, 0, 2, 3, 1, 0, 2, 1, 5, 1, 0, 2] }], { height: 170, id: "w-bar" })],
  ["progress", (v) => v.progress("Quota", 62, { id: "w-prog" })],
  ["stat", (v) => v.stat("Coût", "$412", { trend: [310, 290, 340, 360, 330, 390, 412], id: "w-stat" })],
]) for (const px of [1904, 3000]) {
  fm.widths?.clear();
  const first = make(V.viz(t, frame(fm, false)));
  assert.equal(rectsOf(first), 0, `${name}: drawn before it was measured`);
  const probe = find(first, (n) => n.on?.on_size_change && n.props.w_full);
  assert.ok(probe, `${name}: no measured wrapper`);
  probe.on.on_size_change({ width: px, height: 10 }, { notify() {} });
  const drawn = make(V.viz(t, frame(fm, false)));
  const r = rectsOf(drawn);
  assert.equal(widest(drawn), px, `${name} at ${px}: not drawn at the measured width`);
  assert.ok(r > 0 && r <= V.MAX_RECTS * 1.05, `${name} at ${px}: ${r} rects`);
  wide.push(`${name} ${px}px ${r}`);
}
const w3000 = V.capped((c) => V.chartGeometry("area", [[12e3, 18e3, 15e3, 32e3, 41e3, 38e3, 52e3, 47e3, 61e3, 58e3]], 10, 3000, 170, c), 3, 3000 * 170);
assert.ok((3000 / w3000.cell) * (170 / w3000.cell) <= V.MAX_CELLS, "cells over MAX_CELLS before the first build");
assert.equal(V.capped((c) => V.chartGeometry("bar", [[1, 2, 3]], 3, 400, 170, c), 3, 400 * 170).cell, 3, "a 400×170 chart keeps 3 px");
console.log(`fluid: ${wide.join(", ")} rects; area 3000×170 at ${w3000.cell} px`);
assert.equal(rectsOf(V.viz(t, null).progress("Q", 50)), rectsOf(V.viz(t, null).progress("Q", 50, { width: 320 })), "no motion state: 320 px");

// Memo: the same input is the same geometry, whatever the theme; colors are applied at paint.
const one = V.viz(t, null);
const p1 = find(one.gauge("Q", 44), (x) => x.kind === "paint");
const p2 = find(V.viz({ ...t, accent: "#a64d2e" }, null).gauge("Q", 44), (x) => x.kind === "paint");
assert.equal(p1.path, p2.path, "geometry rebuilt for a theme change");
assert.notEqual(p1.bg, p2.bg);

// Empty states are said in words.
const said = (x) => find(x, (n) => n.kids?.includes("aucune donnée")) != null;
assert.ok(said(one.chart("line", [{ values: [] }])));
assert.ok(said(one.donut([{ value: 0 }])));
assert.ok(said(one.heatmap([])));
assert.ok(said(one.trend([3])));
assert.ok(said(one.gauge("Q", NaN)));

// steps: a segment per step with a gap between, the tracks painted first, done and failed solid, current
// half inked, skipped hatched, todo the track alone; the labels under the segments, a tooltip each;
// narrow, only the step in front and n / total; current breathes, not under reduced motion.
const ST = ["done", "failed", "current", "skipped", "todo"];
const sg = V.stepsGeometry(ST, 300);
assert.deepEqual(sg.rects.slice(0, 5).map((r) => r[4]), Array(5).fill("track"), "tracks first");
assert.equal(sg.segs.length, 5);
for (let i = 1; i < 5; i++) assert.equal(sg.segs[i][0] - (sg.segs[i - 1][0] + sg.segs[i - 1][1]), 2 * V.CELL, `a gap before step ${i}`);
assert.ok(Math.max(...sg.segs.map((s) => s[1])) - Math.min(...sg.segs.map((s) => s[1])) <= V.CELL, "segments of one width, to a cell");
const inkOf = (key) => sg.rects.filter((r) => r[4] === key).reduce((s, r) => s + r[2] * r[3], 0);
const segArea = (i) => sg.segs[i][1] * 3 * V.CELL;
assert.equal(inkOf("done"), segArea(0), "done: solid");
assert.equal(inkOf("failed"), segArea(1), "failed: solid");
assert.ok(Math.abs(inkOf("current") / segArea(2) - 0.5) < 0.1, "current: half inked");
assert.ok(inkOf("skipped") > 0 && inkOf("skipped") / segArea(3) < 0.4, "skipped: a light hatch");
assert.equal(sg.rects.filter((r) => r[4] !== "track" && r[0] >= sg.segs[4][0]).length, 0, "todo: the track alone");
const sm = motionState();
const flow = ["Issue", "Worktree", "PR", "Review", "CI"].map((label, i) => ({ label, state: ["done", "done", "done", "current", "todo"][i] }));
const stWide = V.viz(t, frame(sm, false)).steps(flow, { width: 400, id: "st" });
const texts = (x) => { const out = []; (function walk(n) { n?.kids?.forEach((k) => (typeof k === "string" ? out.push(k) : walk(k))); })(x); return out; };
assert.deepEqual(texts(stWide), ["Issue", "Worktree", "PR", "Review", "CI"], "a label under each step");
const tips = []; (function walk(n) { if (n?.props?.tooltip) tips.push(n.props.tooltip[0]); n?.kids?.forEach(walk); })(stWide);
assert.deepEqual(tips, ["Issue · fait", "Worktree · fait", "PR · fait", "Review · en cours", "CI · à faire"]);
assert.ok(find(stWide, (n) => n.props?.loop), "current at work");

// #37: the front at work, not a breath: 6 cells twinkling (opacity loops, each its own period) and 1
// drifting (a left loop), on the running step's unlit cells, inside its segment; none without m or reduced.
{
  const loops = (x) => { const out = []; (function walk(n) { if (n?.props?.loop) out.push(n); n?.kids?.forEach(walk); })(x); return out; };
  const sp = loops(stWide);
  const tw = sp.filter((n) => n.props.loop[0] === "opacity");
  const dr = sp.filter((n) => n.props.loop[0] === "left");
  assert.deepEqual([tw.length, dr.length], [6, 1], "6 twinkling cells, 1 drifting");
  assert.equal(new Set(tw.map((n) => n.props.loop[1].period)).size, 6, "each its own period: never in step");
  const seg = V.stepsGeometry(flow.map((s) => s.state), 400).segs[3];
  for (const n of tw) {
    const x = n.props.left[0], y = n.props.top[0], c = n.props.size[0];
    assert.ok(x >= seg[0] && x + c <= seg[0] + seg[1] && y >= 0 && y < 3 * c, "inside the running step's cell");
    assert.equal(V.inked(x / c, y / c, 0.5), false, "on a cell the half trame leaves unlit");
  }
  assert.deepEqual(dr[0].props.loop[1].from, seg[0], "drifts from the segment's start");
  assert.equal(loops(V.viz(t, null).steps(flow, { width: 400, id: "st" })).length, 0, "no motion state: still");
  assert.equal(loops(V.viz(t, frame(motionState(), false)).steps(flow.map((s) => ({ ...s, state: "done" })), { width: 400, id: "st" })).length, 0, "nothing running: still");
  // In tiers, on rows 1 to 3 of the 5.
  const tier = V.viz(t, frame(motionState(), false)).steps(Array.from({ length: 6 }, (_, i) => ({ label: `S${i}`, group: i < 3 ? "A" : "B", state: i < 4 ? "done" : i === 4 ? "current" : "todo" })), { width: 400, id: "tsp" });
  const tt = loops(tier).filter((n) => n.props.loop[0] === "opacity");
  assert.equal(tt.length, 6);
  assert.ok(tt.every((n) => n.props.top[0] >= n.props.size[0] && n.props.top[0] < 4 * n.props.size[0]), "tiers: rows 1 to 3");
  assert.ok(tt.every((n) => !V.inked(n.props.left[0] / n.props.size[0], n.props.top[0] / n.props.size[0], 0.5)), "tiers: on unlit cells, rows counted in the 5");
  // progress: live only, its sparks past the head (the track), its drift across the front; off: still.
  const live = V.viz(t, frame(motionState(), false)).progress("Checks", 40, { width: 300, live: true, id: "pl" });
  const pl = loops(live);
  const head = V.progressGeometry(0.4, 300).head * V.CELL;
  assert.deepEqual([pl.filter((n) => n.props.loop[0] === "opacity").length, pl.filter((n) => n.props.loop[0] === "left").length], [6, 1], "live progress: its front works");
  assert.ok(pl.filter((n) => n.props.loop[0] === "opacity").every((n) => n.props.left[0] >= head), "sparks past the head");
  assert.equal(loops(V.viz(t, frame(motionState(), false)).progress("Quota", 40, { width: 300, id: "pq" })).length, 0, "a reading (not live): still");
  assert.equal(loops(V.viz(t, frame(motionState(), true)).progress("Checks", 40, { width: 300, live: true, id: "pr" })).length, 0, "reduced: still");
  // Folded steps: the bar is live while a step runs.
  assert.ok(loops(V.viz(t, frame(motionState(), false)).steps(Array.from({ length: 30 }, (_, i) => ({ label: `S${i}`, state: i < 9 ? "done" : i === 9 ? "current" : "todo" })), { width: 120, id: "fold" })).length > 0, "folded and running: the bar's front works");
}
const enTips = []; (function walk(n) { if (n?.props?.tooltip) enTips.push(n.props.tooltip[0]); n?.kids?.forEach(walk); })(
  V.viz(t, null).steps(flow, { width: 400, words: { done: "done", current: "running" } }));
assert.deepEqual(enTips.slice(2, 5), ["PR · done", "Review · running", "CI · à faire"], "words replace the names given, French for the rest");
assert.deepEqual(texts(V.viz(t, frame(sm, false)).steps(flow, { width: 150, id: "st" })), ["Review", "3 / 5"], "narrow: the step in front, n / total");
assert.equal(find(V.viz(t, frame(motionState(), true)).steps(flow, { width: 400, id: "st" }), (n) => n.props?.loop), null, "reduced: still");
assert.deepEqual(texts(V.viz(t, null).steps([{ label: "Merge", state: "nope" }], { width: 200 })), ["Merge"], "an unknown state is todo");
assert.ok(said(one.steps([])));

// roll handed in: the gauge's, progress' and stat's figures, and narrow steps' « n / total », go through
// it, under their own ids; without it (or with no options) the output is the same as before.
const tree = (x) => JSON.stringify(x, (k, v) => (k === "path" || k === "bg" ? undefined : v));
const draws = {
  gauge: (v) => v.gauge("Quota hebdo", 44, { unit: "%", id: "rg" }),
  progress: (v) => v.progress("Quota 5 h", 62, { width: 320, id: "rp" }),
  stat: (v) => v.stat("Coût du jour", "$4.12", { width: 220, id: "rs" }),
  steps: (v) => v.steps(flow, { width: 150, id: "rst" }),
};
const calls = [];
const fakeRoll = (mm, id, s, h, o) => { calls.push([id, s, h, mm.reduced, o?.snap ?? 0]); const e = el("roll"); e.props.id = [id]; return e; };
for (const [name, draw] of Object.entries(draws)) {
  assert.equal(tree(draw(V.viz(t, null))), tree(draw(V.viz(t, null, {}))), `${name}: no roll, same output`);
  assert.ok(find(draw(V.viz(t, frame(motionState(), false), { roll: fakeRoll })), (n) => n.kind === "roll"), `${name}: no roll drawn`);
}
assert.deepEqual(calls, [["rg-n", "44%", Math.ceil(Math.round(220 * 0.15) * 1.3), false, 0], ["rp-pct", "62%", 16, false, 0], ["rs-v", "$4.12", 32, false, 0], ["rst-n", "3 / 5", 14, false, 0]]);
calls.length = 0;
V.viz(t, null, { roll: fakeRoll }).stat("Coût du jour", "$4.12", { width: 220, id: "rs", snap: 2 });
assert.equal(calls[0][4], 2, "a stat's snap reaches roll");
calls.length = 0;
draws.gauge(V.viz(t, null, { roll: fakeRoll }));
assert.equal(calls[0][3], false, "no motion state: rolls, not reduced");

// steps without groups: the geometry the flat bar had before groups came (frozen), and a `group` left
// undefined on every step draws the flat bar.
assert.deepEqual(V.stepsGeometry(["done", "current", "skipped", "todo"], 66).rects, [[0, 0, 12, 9, "track"], [18, 0, 12, 9, "track"], [36, 0, 12, 9, "track"], [54, 0, 12, 9, "track"],
  [0, 0, 12, 9, "done"], [18, 0, 3, 3, "current"], [24, 0, 3, 3, "current"], [36, 0, 3, 3, "skipped"], [45, 0, 3, 3, "skipped"], [21, 3, 3, 3, "current"], [27, 3, 3, 3, "current"],
  [42, 3, 3, 3, "skipped"], [18, 6, 3, 3, "current"], [24, 6, 3, 3, "current"], [39, 6, 3, 3, "skipped"]]);
assert.equal(tree(V.viz(t, null).steps(flow.map((s) => ({ ...s, group: undefined })), { width: 400 })), tree(V.viz(t, null).steps(flow, { width: 400 })), "no group: the flat bar");

// steps with groups (kt-flow's phases, t2z's flow): a tier per run of one group, 5 cells high; its band 1
// cell around its steps and between them, tiers 2 cells apart, one width for every step (to a cell) so a
// tier is as wide as its steps; the bands, then the tracks, painted first; the front step's band "hot";
// the ink on rows 1 to 3, inside the cells, done solid; at the panel's width and narrow.
const GS = ["done", "done", "done", "done", "done", "done", "todo", "done", "done", "current", "done", "todo", "todo", "todo"];
const SZ = [4, 3, 4, 3];
for (const w of [420, 160]) {
  const gg = V.stepGroupsGeometry(GS, SZ, w, V.CELL, 2);
  assert.deepEqual([gg.tiers.length, gg.segs.length], [4, 14]);
  const keys = gg.rects.map((r) => r[4]);
  assert.deepEqual(keys.slice(0, 4), ["tier", "tier", "hot", "tier"], "the bands first, the front one hot");
  assert.deepEqual(keys.slice(4, 18), Array(14).fill("track"), "then the tracks");
  let first = 0;
  SZ.forEach((n, k) => {
    const [tx, tw] = gg.tiers[k];
    const mine = gg.segs.slice(first, first + n);
    assert.equal(mine[0][0] - tx, V.CELL, `w ${w}, tier ${k}: its first step a cell in`);
    assert.equal(tx + tw - (mine.at(-1)[0] + mine.at(-1)[1]), V.CELL, `w ${w}, tier ${k}: a cell after its last`);
    for (let j = 1; j < n; j++) assert.equal(mine[j][0] - (mine[j - 1][0] + mine[j - 1][1]), V.CELL, `w ${w}, tier ${k}: a cell between steps`);
    if (k) assert.equal(tx - (gg.tiers[k - 1][0] + gg.tiers[k - 1][1]), 2 * V.CELL, `w ${w}: two cells between tiers`);
    first += n;
  });
  const ws = gg.segs.map((x) => x[1]);
  assert.ok(Math.max(...ws) - Math.min(...ws) <= V.CELL, `w ${w}: one width per step, to a cell`);
  const end = gg.tiers.at(-1)[0] + gg.tiers.at(-1)[1];
  assert.ok(end <= w && w - end < V.CELL, `w ${w}: the tiers fill the width (${end})`);
  for (const [x, y, rw, rh] of gg.rects.slice(18)) {
    assert.ok(y >= V.CELL && y + rh <= 4 * V.CELL, `w ${w}: ink on rows 1 to 3`);
    assert.ok(gg.segs.some(([sx, sw]) => x >= sx && x + rw <= sx + sw), `w ${w}: ink inside a cell`);
  }
  const doneArea = gg.rects.filter((r) => r[4] === "done").reduce((s, r) => s + r[2] * r[3], 0);
  assert.equal(doneArea, gg.segs.filter((_, i) => GS[i] === "done").reduce((s, [, sw]) => s + sw * 3 * V.CELL, 0), `w ${w}: done solid`);
}
const phased = [["Préparation", ["Issue", "Branche", "Worktree", "Pin"]], ["Implémentation", ["Implémentation", "Commits", "Docs"]],
  ["Livraison", ["Push", "PR", "Review", "CI"]], ["Clôture", ["Merge", "Issue fermée", "Note"]]]
  .flatMap(([group, labels]) => labels.map((label) => ({ label, group }))).map((s, i) => ({ ...s, state: GS[i] }));
const tipsOf = (x) => { const out = []; (function walk(n) { if (n?.props?.tooltip) out.push(n.props.tooltip[0]); n?.kids?.forEach(walk); })(x); return out; };
const gm = motionState();
const gw = V.viz(t, frame(gm, false)).steps(phased, { width: 420, id: "gp" });
assert.deepEqual(texts(gw), ["Livraison", "·", "Review", "9 / 14"], "under the tiers: the front step's group and name, n / total");
assert.deepEqual(texts(V.viz(t, frame(gm, false)).steps(phased, { width: 160, id: "gp" })), ["Livraison", "·", "Review", "9 / 14"], "the same line narrow");
const gtips = tipsOf(gw);
assert.equal(gtips.length, 4 + 14, "a tooltip per tier and per step");
assert.equal(gtips[0], "Préparation · 4 / 4 — Issue : fait · Branche : fait · Worktree : fait · Pin : fait");
assert.equal(gtips[2], "Livraison · 3 / 4 — Push : fait · PR : fait · Review : en cours · CI : fait");
assert.equal(gtips[4 + 9], "Review · en cours");
assert.ok(find(gw, (n) => n.kind === "paint" && n.bg === V.faint(t.accent, 0.12)), "the front tier tinted in the running color");
assert.ok(find(gw, (n) => n.props?.loop), "the running step breathes");
assert.ok(find(gw, (n) => n.tr?.includes("width")), "drawn in from the left");
const gred = V.viz(t, frame(motionState(), true)).steps(phased, { width: 420, id: "gp" });
assert.equal(find(gred, (n) => n.props?.loop || n.tr?.length), null, "reduced: still, drawn at once");
assert.ok(!find(V.viz(t, null).steps(phased.map((s) => ({ ...s, state: s.state === "current" ? "done" : s.state })), { width: 420 }),
  (n) => n.kind === "paint" && n.bg === V.faint(t.accent, 0.12)), "nothing running: no tier tinted");
assert.deepEqual(texts(V.viz(t, null).steps([{ label: "A", state: "done", group: "P" }, { label: "B", state: "current" }], { width: 300 })), ["B", "1 / 2"],
  "a step without a group: its own tier, no name");
calls.length = 0;
V.viz(t, frame(motionState(), false), { roll: fakeRoll }).steps(phased, { width: 420, id: "gr" });
assert.deepEqual(calls, [["gr-n", "9 / 14", 14, false, 0]], "grouped: « n / total » rolls at any width");

// Folded: a step under 2 dither cells, flat or in tiers, and the steps are one progress bar (same id): the
// front step (after its group's name), « n / total », no tooltip per step, tinted by the worst state.
// Unfolded, every step gets 2 cells or more, and a width sweep flips once at most.
const long = Array.from({ length: 24 }, (_, i) => ({ label: `S${i}`, state: i < 10 ? "done" : i === 10 ? "current" : "todo" }));
const fl = V.viz(t, frame(motionState(), false)).steps(long, { width: 120, id: "fl" });
assert.deepEqual([texts(fl), tipsOf(fl).length], [["S10", "10 / 24"], 0], "flat, 24 steps at 120 px: one bar");
assert.ok(find(fl, (n) => n.props?.id?.[0] === "fl" && n.kids[0]?.tr?.includes("width")), "the bar draws in under the steps' id");
assert.ok(find(fl, (n) => n.kind === "paint" && n.bg === t.accent), "running: the current tint");
assert.deepEqual(texts(V.viz(t, null).steps(phased, { width: 120, id: "gp" })), ["Livraison · Review", "9 / 14"], "in tiers at 120 px: one bar, the group then the step");
assert.equal(tipsOf(V.viz(t, null).steps(long, { width: 282 })).length, 24, "282 px: 24 steps of 2 cells, not folded");
assert.equal(tipsOf(V.viz(t, null).steps(long, { width: 281 })).length, 0, "281 px: folded");
const KF = { done: "#00ff00", current: "#0000ff", failed: "#ff0000" };
const tintOf = (list) => find(V.viz(t, null).steps(list, { width: 90, colors: KF }), (n) => n.kind === "paint" && Object.values(KF).includes(n.bg))?.bg;
assert.equal(tintOf(long.map((s, i) => (i === 3 ? { ...s, state: "failed" } : s))), KF.failed, "failed and running: the failed color");
assert.equal(tintOf(long), KF.current, "running: the current color");
assert.equal(tintOf(long.map((s) => ({ ...s, state: "done" }))), KF.done, "all done: the done color");
assert.equal(tree(V.viz(t, null).steps(long, { width: 120 })), tree(V.viz(t, null, {}).steps(long, { width: 120 })), "folded, no roll: same output");
calls.length = 0;
V.viz(t, frame(motionState(), false), { roll: fakeRoll }).steps(phased, { width: 120, id: "gr" });
assert.deepEqual(calls, [["gr-pct", "9 / 14", 16, false, 0]], "folded: « n / total » rolls in the bar's reel");
for (const sizes of [null, [4, 3, 4, 3], [6, 6, 6, 6, 6, 6, 4]]) {
  const states = Array.from({ length: sizes ? sizes.reduce((s, n) => s + n, 0) : 24 }, (_, i) => ST[i % 5]);
  const list = states.map((state, i) => ({ label: `S${i}`, state, group: sizes ? `P${sizes.findIndex((_, k) => i < sizes.slice(0, k + 1).reduce((s, n) => s + n, 0))}` : undefined }));
  let flips = 0, was = null;
  for (let w = 40; w <= 700; w++) {
    const on = tipsOf(V.viz(t, null).steps(list, { width: w })).length === 0;
    if (was != null && on !== was) flips++;
    was = on;
    if (on) continue;
    const segs = (sizes ? V.stepGroupsGeometry(states, sizes, w) : V.stepsGeometry(states, w)).segs;
    assert.ok(Math.min(...segs.map((s) => s[1])) >= 2 * V.CELL, `${sizes ?? "flat"} at ${w} px: a step under 2 cells, not folded`);
  }
  assert.equal(flips, 1, `${sizes ?? "flat"}: one flip over the sweep`);
}
// Hysteresis, with a motion state: folded at 281 px, still folded up to 12 px past the edge, unfolded
// beyond; on the way down, unfolded until the edge.
const hm = motionState();
const isFolded = (w) => tipsOf(V.viz(t, frame(hm, false)).steps(long, { width: w, id: "hy" })).length === 0;
assert.deepEqual([281, 282, 293, 294, 282, 281].map(isFolded), [true, true, true, false, false, true]);
// Without `width` (kt-flow): folded at the measured width, inside the steps' one measured wrapper.
const fsm = motionState();
const fprobe = find(V.viz(t, frame(fsm, false)).steps(long, { id: "fm" }), (n) => n.on?.on_size_change && n.props.w_full);
fprobe.on.on_size_change({ width: 120, height: 10 }, { notify() {} });
const fdrawn = V.viz(t, frame(fsm, false)).steps(long, { id: "fm" });
const fids = []; (function walk(n) { if (n?.props?.id) fids.push(n.props.id[0]); n?.kids?.forEach(walk); })(fdrawn);
assert.deepEqual([texts(fdrawn), fids.filter((i) => i === "fm~w").length, new Set(fids).size], [["S10", "10 / 24"], 1, fids.length], "measured: folded, one wrapper, no id twice");

console.log("viz.js: ok");
