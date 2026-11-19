// bun ~/.config/herdr-app/mods/kt-hub/trame.check.mjs: the hub's trames (trame.js): colors with alpha, the
// SVG's layers and scale, the fingerprint, the calendar (its square size by width, a track a day, each level
// a quarter more ink, <use> or translated rectangles alike, the latest weeks when narrow), the rows of
// squares, the trend recadrée (its marker inside, nothing right of it, the halos under, dimmed in light), a
// project's weeks. gpui-kit and herdr mocked, as viz.check.mjs does.
import assert from "node:assert/strict";
import { plugin } from "bun";
const builder = () => { const api = { move_to: () => api, line_to: () => api, close: () => api, build: () => ({}) }; return api; };
plugin({ setup(build) {
  build.module("gpui-kit", () => ({ loader: "object", exports: { div: () => ({}), svg: () => ({}), PathBuilder: { fill: builder, stroke: builder }, Background: {} } }));
  build.module("herdr", () => ({ loader: "object", exports: { shared: () => undefined, setShared: () => {}, exec: async () => ({ code: 0, stdout: "" }), checking: () => true } }));
} });
const T = await import("./trame.js");

assert.deepEqual(T.fillOf("#112233"), ["#112233", 1]);
assert.deepEqual(T.fillOf("#11223380"), ["#112233", 0.502]);
const svg = T.svgOf(10, 6, [{ rects: [[0, 0, 3, 3], [3, 3, 3, 3]], color: "#ff000080" }, { rects: [], color: "#000" }]);
assert.ok(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="6" viewBox="0 0 10 6"'));
assert.ok(svg.includes('<path fill="#ff0000" fill-opacity="0.502" d="M0 0h3v3h-3zM3 3h3v3h-3z"/>'));
assert.equal((svg.match(/<path/g) ?? []).length, 1, "an empty layer draws nothing");
assert.ok(T.svgOf(10, 6, [], 2).startsWith('<svg xmlns="http://www.w3.org/2000/svg" width="20" height="12" viewBox="0 0 10 6"'), "scale: the size doubles, not the viewBox");
const line = T.svgOf(20, 10, [{ points: [[0, 1], [10.04, 5.55]], color: "#33669924", width: 6.5 }]);
assert.ok(line.includes('<polyline fill="none" stroke="#336699" stroke-opacity="0.141" stroke-width="6.5"') && line.includes('points="0,1 10,5.6"'));
assert.equal(T.hash("abc"), T.hash("abc"));
assert.notEqual(T.hash("abc"), T.hash("abd"));

// A year from a Thursday (offset 3): 53 columns. 5-cell squares when the year fits (53 × 18 - 3 = 951).
const levels = Array.from({ length: 365 }, (_, i) => (i === 0 ? 4 : i === 1 ? 1 : i === 2 ? 0 : i % 5));
assert.equal(T.calN(levels, 3, 951), 5);
assert.equal(T.calN(levels, 3, 950), 4);
const g = T.calendarGrid(levels, 3, 2000, 4);
assert.equal(g.days.length, 365);
assert.equal(g.cols, 53);
assert.deepEqual([g.pitch, g.square, g.width], [15, 12, 792]);
assert.deepEqual(g.days.slice(0, 3), [[0, 45, 4], [0, 60, 1], [0, 75, 0]], "Thursday 1st on row 3");
const cells = (lv, n) => T.squareInk(lv, n).reduce((s, [, , w, h]) => s + (w / 3) * (h / 3), 0);
assert.deepEqual([1, 2, 3, 4].map((lv) => cells(lv, 4)), [4, 8, 12, 16], "4 cells: a level inks a quarter more");
assert.deepEqual(T.squareInk(4, 4), [[0, 0, 12, 12]], "a full level: one rectangle");
assert.deepEqual(T.squareInk(4, 5), [[0, 0, 15, 15]]);
assert.ok(cells(1, 5) < cells(2, 5) && cells(2, 5) < cells(3, 5) && cells(3, 5) < 25, "5 cells: more ink per level");
const narrow = T.calendarGrid(levels, 3, 300, 4);
assert.ok(narrow.skip > 0 && narrow.width <= 300);
assert.deepEqual(narrow.days.at(-1).slice(0, 2), [(narrow.cols - 1) * 15, ((3 + 364) % 7) * 15], "the last day stays");
const cal = T.calendarSvg(levels, 3, 2000, "#3366ff", "#ffffff12");
assert.ok(cal.svg.includes('<path fill="#ffffff" fill-opacity="0.071" d="M0 45h12v12h-12z'), "the track, a square a day");
assert.ok(cal.svg.includes('<g fill="#3366ff" fill-opacity="1"><use xlink:href="#l4" x="0" y="45"/><use xlink:href="#l1" x="0" y="60"/><use xlink:href="#l3" x="0" y="90"/>'), "a level square a day, none at 0");
assert.equal((cal.svg.match(/<use /g) ?? []).length, levels.filter((l) => l > 0).length);
// Without <use>: the same squares, as rectangles.
const flat = T.calendarSvg(levels, 3, 2000, "#3366ff", "#ffffff12", { use: false });
assert.ok(!flat.svg.includes("<use") && !flat.svg.includes("xlink") && flat.svg.includes('d="M0 45h12v12h-12z'), "level 4 on day 0: its rectangle");
const area = (s) => [...s.matchAll(/h(\d+)v(\d+)h-\d+z/g)].reduce((a, m) => a + Number(m[1]) * Number(m[2]), 0);
const inkOf = (s) => s.slice(s.lastIndexOf("<path"));
const defsInk = levels.reduce((a, lv) => a + (lv > 0 ? cells(lv, 4) * 9 : 0), 0);
assert.equal(area(inkOf(flat.svg)), defsInk, "as much ink as through <use>");
const big = T.calendarSvg(levels, 3, 951, "#3366ff", "#ffffff12", { n: 5, scale: 2 });
assert.ok(big.svg.includes(`width="${951 * 2}" height="${(7 * 18 - 3) * 2}" viewBox="0 0 951 123"`));

const sq = T.squaresSvg([0, 1, 4], 3, "#ff0000", "#ffffff12");
assert.equal(sq.w, 3 * 15 - 3);
assert.ok(sq.svg.includes("M30 0h12v12h-12z"), "level 4: one full square");
assert.equal(T.squaresSvg([0, 4], 3, "#f00", "#fff", { n: 5 }).w, 2 * 18 - 3);

// The trend, recadrée: the highest value last, the marker at the top right, still inside; the line ends there.
const tr = T.trendSvg([3, 5, 2, 8, 6, 9, 4, 7], 300, "#3366ffcc");
assert.deepEqual([tr.w, tr.h], [300, 56]);
const box = [...tr.svg.matchAll(/fill-opacity="0.251" d="M(-?\d+) (-?\d+)h(\d+)v(\d+)/g)][0].slice(1).map(Number);
assert.ok(box[0] >= 0 && box[1] >= 0 && box[0] + box[2] <= tr.w && box[1] + box[3] <= tr.h, `the end marker's halo inside the box: ${box}`);
const g2 = T.trendGeometry([1, 2, 3, 9], 300);
assert.deepEqual(g2.end, [300 - T.PAD, T.PAD]);
assert.ok(g2.rects.every(([x]) => x < 300 - T.PAD), "no cell right of the marker");
const tr2 = T.trendSvg([1, 2, 3, 9], 300, "#3366ff", { dim: 0.45 });
assert.ok(tr2.svg.indexOf("<polyline") < tr2.svg.indexOf("<path"), "the halos under the trame");
assert.ok(tr2.svg.includes('stroke-opacity="0.031" stroke-width="11.5"') && tr2.svg.includes('stroke-opacity="0.063" stroke-width="6.5"'), "the halos dimmed in light");

// A funnel: a bar per step, each in its row (26 px apart, centred: 9 px high at +9), its track then its ink.
const fn = T.funnelSvg([{ ratio: 1, color: "#ff0000" }, { ratio: 0, color: "#00ff00" }], 100, 26);
assert.deepEqual([fn.w, fn.h], [99, 52]);
assert.ok(fn.svg.includes('<path fill="#ff0000" fill-opacity="0.141" d="M0 9h99v9h-99z"/>'), "row 0's track");
assert.ok(fn.svg.includes('<path fill="#00ff00" fill-opacity="0.141" d="M0 35h99v9h-99z"/>'), "row 1's track, 26 px lower");
assert.equal((fn.svg.match(/fill="#00ff00"/g) ?? []).length, 1, "an empty step: its track only");
assert.ok(fn.svg.includes("M60 9h39v3h-39z") && fn.svg.includes("M66 15h33v3h-33z"), "a full step: inked to its end, solid at its head");

// The donut: a layer per slice, in its color, 132 px.
const don = T.donutSvg([3, 2, 1], 132, ["#111111", "#222222", "#333333"]);
assert.deepEqual([don.w, don.h], [132, 132]);
assert.equal((don.svg.match(/<path/g) ?? []).length, 3, "a path per slice");
assert.equal((T.donutSvg([356, 4, 1], 132, ["#111111", "#222222", "#333333"]).svg.match(/<path/g) ?? []).length, 1, "a slice too thin for a cell: none (viz.donut's too)");
assert.ok(don.svg.indexOf('fill="#111111"') < don.svg.indexOf('fill="#222222"'));

// A project's weeks: a track per week, this week (the highest) one solid bar, a past week checkered.
const sp = T.sparkGeometry([0, 2, 0, 4], 48, 18);
assert.deepEqual([sp.w, sp.h], [48, 18]);
assert.equal(sp.rects.filter((r) => r[4] === "track").length, 4);
assert.deepEqual(sp.rects.filter((r) => r[4] === "now"), [[36, 0, 9, 18, "now"]]);
assert.ok(sp.rects.some((r) => r[4] === "past") && !sp.rects.some((r) => r[4] === "past" && r[0] < 12), "the empty week: its track only");

// #89: up to 7 cells when the year fits (53 × 24 - 3 = 1 269), 6 at 1 110.
assert.deepEqual([T.calN(levels, 3, 1269), T.calN(levels, 3, 1268), T.calN(levels, 3, 1110)], [7, 6, 6]);
assert.equal(T.calendarGrid(levels, 3, 1269, 7).width, 1269);

// Temps agent's chart: a bar a day centred in its band, its segments from the bottom; a day to come empty.
const days = [[{ k: "p0", v: 60 }, { k: "o", v: 30 }], [], [{ k: "p0", v: 0 }, { k: "p1", v: 90 }]];
const sg = T.stackGeometry(days, 90, 90, 30);
assert.deepEqual([sg.cols, sg.rows, sg.wide], [30, 10, 6]);
const colsOf = (k) => [...new Set(sg.rects.filter((r) => r[4] === k).map((r) => r[0] / 3))];
assert.ok(colsOf("p0").every((c) => c >= 2 && c < 8) && colsOf("p1").every((c) => c >= 22 && c < 28), "day 0's bar in its band, day 2's in its own");
assert.ok(!sg.rects.some((r) => r[0] >= 30 && r[0] < 60), "nothing on the day to come");
const rowsOf = (k) => sg.rects.filter((r) => r[4] === k).flatMap((r) => Array.from({ length: r[3] / 3 }, (_, i) => r[1] / 3 + i));
assert.ok(Math.min(...rowsOf("p0")) === 3 && Math.max(...rowsOf("p0")) === 9, "60 of 90: the 7 bottom rows (from row 3), its top solid");
assert.ok(Math.min(...rowsOf("o")) === 0 && Math.max(...rowsOf("o")) <= 1, "the rest above it, its bottom row left empty");
assert.ok(Math.min(...rowsOf("p1")) === 0, "90 of 90: the whole column (p0's 0 makes no segment)");
const ss = T.stackSvg(days, 90, 90, 30, { p0: "#ff0000", p1: "#00ff00", o: "#88888880" });
assert.ok(ss.svg.indexOf('fill="#ff0000"') < ss.svg.indexOf('fill="#00ff00"') && ss.svg.includes('fill="#888888" fill-opacity="0.502"'), "a layer per key, in order, with its alpha");

const t0 = performance.now();
for (let i = 0; i < 20; i++) T.calendarSvg(levels, 3, 951, "#3366ff", "#ffffff12", { n: 5 });
console.log(`trame.check: ok (a year: ${big.svg.length} B; ${((performance.now() - t0) / 20).toFixed(2)} ms per year in bun)`);
