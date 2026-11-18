// viz.js: Monocode's dithered visuals (its /visualize SDK) for the kt-* / kbrdn-* mods: gauge, donut,
// progress, chart (bar, line, area), heatmap, stat with its trend sparkline, swatch, marker.
//
// Ported from Monocode, crates/monocode-gpui/src/visuals/dither.rs and charts.rs, at commit
// 09d04436babb39ad72198cdf22f735067027fc04 (github.com/hardbeat920/monocode). Its licence:
//
//   MIT License
//
//   Copyright (c) 2026 Nick
//
//   Permission is hereby granted, free of charge, to any person obtaining a copy
//   of this software and associated documentation files (the "Software"), to deal
//   in the Software without restriction, including without limitation the rights
//   to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
//   copies of the Software, and to permit persons to whom the Software is
//   furnished to do so, subject to the following conditions:
//
//   The above copyright notice and this permission notice shall be included in all
//   copies or substantial portions of the Software.
//
//   THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
//   IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
//   FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
//   AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
//   LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
//   OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
//   SOFTWARE.
//
// Written once in mods/kt-keys/viz.js and copied byte for byte into each mod that uses it, with
// motion.js beside it (a mod can't import from another folder): edit here, then copy, then `cmp`.
// No herdr import: the caller hands in theme() and its motion state. Check: bun mods/kt-keys/viz.check.mjs.
//
//   init:   this.motion = motionState();
//   render: const m = frame(this.motion, Boolean(shared("kt.reducedMotion")));
//           const V = viz(theme(), m);
//           V.gauge("Quota hebdo", 44, { unit: "%", id: "q-week" })
//           V.donut([{ label: "Diff", value: 14 }, …], { label: "Heures", size: 184 })
//           V.progress("Quota 5 h", 62, { detail: "reset dans 1 h 40", width: 320 })
//           V.chart("bar" | "line" | "area", [{ label, values: [..], color }], { labels, width, height })
//           V.heatmap(values /* rows of numbers */, { rows: ["Lun", …], columns: ["nov", …], width })
//           V.stat("Coût du mois", "$412", { detail: "+12.4% vs oct.", trend: [..], better: "lower" })
// Colors: Monocode's tokens (ink, muted, faint, accent, positive, negative, warning, series1..6),
// any theme() name, or a #hex. `id`: stable per visual (not per value). gauge, progress, stat and
// donut default it from their label; chart, trend and heatmap from their kind only: give two of a
// kind their own `id`, else they share one entry.
//
// How it draws. A tone in [0, 1] inks that share of `cell` px cells (3, Monocode's) through a 4×4 Bayer
// matrix. The inked cells become rectangles (runs across a row, then equal runs merged down) and each
// color's rectangles are ONE painted path (window.paint_path, as ring.js): a 220 px gauge is ~300
// rectangles, a 400×170 area ~900, so a div each would blow a mod's element budget, at the same cost
// per rectangle (MAX_RECTS below). Geometry and paths are memoized by their inputs, not the theme:
// colors are applied when painting. Entry, once per id: cartesian visuals reveal in width (MS.panel), radial ones
// fade in (enter); kt.reducedMotion draws the final state. Monocode's hover readouts are not ported
// (a render per mouse move): bars and lines get a native tooltip per category instead.

import { div, PathBuilder, Background } from "gpui-kit";
import { enter, MS } from "./motion.js";

export const CELL = 3;
const MONO = "Monaspace Krypton";
const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const TAU = Math.PI * 2;
const DEG = 180 / Math.PI;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

/** Whether the cell at (col, row) is inked for `tone`. A tone of 0.25 inks exactly a quarter. */
export const inked = (col, row, tone) => tone > (BAYER4[(row & 3) * 4 + (col & 3)] + 0.5) / 16;

/**
 * The cells of a cols × rows grid as rectangles [x, y, w, h, key] in px: `ink(col, row)` names a
 * cell's key (a color role: "tint", "track", a series index) or null. Runs of one key across a row,
 * then a run equal to the one right above it grows that rectangle down.
 */
export function runs(cols, rows, ink, cell = CELL) {
  const out = [];
  let above = new Map();
  for (let row = 0; row < rows; row++) {
    const here = new Map();
    let start = 0;
    let key = null;
    for (let col = 0; col <= cols; col++) {
      const k = col < cols ? ink(col, row) ?? null : null;
      if (k === key) continue;
      if (key !== null) {
        const id = `${start}:${col}:${key}`;
        const r = above.get(id);
        if (r) r[3] += cell;
        here.set(id, r ?? out[out.push([start * cell, row * cell, (col - start) * cell, cell, key]) - 1]);
      }
      start = col;
      key = k;
    }
    above = here;
  }
  return out;
}

// ---------------------------------------------------------------- colors

const alpha = (c, a) => `${String(c).slice(0, 7)}${a}`; // replaces any alpha (glass themes are #rrggbbaa)
const hex2 = (a) => Math.round(clamp(a, 0, 1) * 255).toString(16).padStart(2, "0");
/** `c` at opacity `a` (0..1), whatever alpha it had. */
export const faint = (c, a) => alpha(c, hex2(a));
// Series hues: filters.js's TINTS, so a category keeps its hue from one mod to the next.
export const SERIES = ["ansi4", "ansi5", "ansi2", "ansi3", "ansi6", "accent"];
const TOKENS = { ink: "foreground", muted: "muted", faint: "dim", accent: "accent", positive: "ansi2", negative: "ansi1", warning: "ansi3" };

/** A Monocode token, a theme name or a #hex -> a color of `t`. */
export function color(t, name) {
  if (name == null) return t.accent;
  const s = String(name);
  if (s.startsWith("#")) return s;
  const n = /^series([1-6])$/.exec(s);
  return t[n ? SERIES[n[1] - 1] : TOKENS[s] ?? s] ?? t.accent;
}

/** Dark ink on a light surface: glows turn muddy there, so they are softer. */
export function isLight(t) {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i.exec(String(t?.background ?? ""));
  if (!m) return false;
  const [r, g, b] = m.slice(1, 4).map((x) => parseInt(x, 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.5;
}

// ---------------------------------------------------------------- numbers

/** 1.2K, 48K, 3.4M; plain numbers keep `step`'s decimals. */
export function compact(value, step) {
  const trim = (s) => (s.includes(".") ? s.replace(/0+$/, "").replace(/\.$/, "") : s);
  const abs = Math.abs(value);
  if (abs >= 1e9) return `${trim((value / 1e9).toFixed(1))}B`;
  if (abs >= 1e6) return `${trim((value / 1e6).toFixed(1))}M`;
  if (abs >= 1e4) return `${trim((value / 1e3).toFixed(1))}K`;
  let d = 0;
  for (; d < 4; d++) {
    const s = Math.abs(step) * 10 ** d;
    if (Math.abs(s - Math.round(s)) < 1e-6) break;
  }
  return trim(value.toFixed(d));
}
const reading = (v) => compact(v, 0.01);

/** A y domain with round ticks covering every value. */
export class Scale {
  constructor(min, max, step) {
    Object.assign(this, { min, max, step });
  }
  static nice(values, zero) {
    let low = zero ? 0 : Infinity;
    let high = zero ? 0 : -Infinity;
    for (const v of values) if (Number.isFinite(v)) [low, high] = [Math.min(low, v), Math.max(high, v)];
    if (low > high) [low, high] = [0, 1];
    const span = high - low > 0 ? high - low : Math.abs(high) > 0 ? Math.abs(high) : 1;
    const raw = span / 4;
    const magnitude = 10 ** Math.floor(Math.log10(raw));
    const step = ([1, 2, 2.5, 5, 10].find((c) => c * magnitude >= raw) ?? 10) * magnitude;
    const s = new Scale(Math.floor(low / step) * step, Math.ceil(high / step) * step, step);
    if (s.max <= s.min) s.max = s.min + s.step; // a flat series still needs a range
    return s;
  }
  ticks() {
    const n = Math.round((this.max - this.min) / this.step);
    return Array.from({ length: Math.min(n, 12) + 1 }, (_, i) => this.min + this.step * i);
  }
  /** Where `v` falls, 0 at max and 1 at min. */
  depth(v) {
    return (this.max - v) / (this.max - this.min);
  }
  label(v) {
    return compact(v, this.step);
  }
}

/** A smooth curve through points that never overshoots them (monotone cubic, Fritsch–Carlson). */
export class Curve {
  constructor(points) {
    const xs = points.map((p) => p[0]);
    const ys = points.map((p) => p[1]);
    const n = points.length;
    const ms = new Array(n).fill(0);
    if (n >= 2) {
      const d = [];
      for (let k = 0; k < n - 1; k++) d.push((ys[k + 1] - ys[k]) / Math.max(xs[k + 1] - xs[k], 1e-6));
      ms[0] = d[0];
      ms[n - 1] = d[n - 2];
      for (let k = 1; k < n - 1; k++) ms[k] = d[k - 1] * d[k] <= 0 ? 0 : (d[k - 1] + d[k]) / 2;
      for (let k = 0; k < n - 1; k++) {
        if (d[k] === 0) {
          ms[k] = 0;
          ms[k + 1] = 0;
          continue;
        }
        const a = ms[k] / d[k];
        const b = ms[k + 1] / d[k];
        const s = a * a + b * b;
        if (s > 9) {
          const t = 3 / Math.sqrt(s);
          ms[k] = t * a * d[k];
          ms[k + 1] = t * b * d[k];
        }
      }
    }
    Object.assign(this, { xs, ys, ms });
  }
  get first() {
    return this.xs[0] ?? 0;
  }
  get last() {
    return this.xs.at(-1) ?? 0;
  }
  /** The curve's y at `x`, clamped to its ends. */
  at(x) {
    const { xs, ys, ms } = this;
    const n = xs.length;
    if (n === 0) return 0;
    if (n === 1 || x <= xs[0]) return ys[0];
    if (x >= xs[n - 1]) return ys[n - 1];
    let k = xs.findIndex((v) => v > x) - 1;
    k = clamp(k, 0, n - 2);
    const h = Math.max(xs[k + 1] - xs[k], 1e-6);
    const t = (x - xs[k]) / h;
    const [t2, t3] = [t * t, t * t * t];
    return (2 * t3 - 3 * t2 + 1) * ys[k] + (t3 - 2 * t2 + t) * h * ms[k] + (-2 * t3 + 3 * t2) * ys[k + 1] + (t3 - t2) * h * ms[k + 1];
  }
  /** Points along the curve every `step` px. */
  samples(step) {
    if (this.xs.length < 2) return this.xs.map((x, i) => [x, this.ys[i]]);
    const [a, b] = [this.first, this.last];
    const count = Math.max(1, Math.ceil((b - a) / step));
    return Array.from({ length: count + 1 }, (_, i) => {
      const x = a + ((b - a) * i) / count;
      return [x, this.at(x)];
    });
  }
}

/** The rows [top, bottom] a line through `curve` inks in column `col`, or null: every row the curve
 * crosses over the column's span (its ends, middle and any knot inside), so steep slopes stay joined. */
export function lineRows(curve, col, cell, rows) {
  const a = Math.max(col * cell, curve.first);
  const b = Math.min((col + 1) * cell, curve.last);
  if (a > b || curve.xs.length === 0) return null;
  const ys = [curve.at(a), curve.at((a + b) / 2), curve.at(b), ...curve.xs.flatMap((x, i) => (x > a && x < b ? [curve.ys[i]] : []))];
  return [clamp(Math.floor(Math.min(...ys) / cell), 0, rows - 1), clamp(Math.floor(Math.max(...ys) / cell), 0, rows - 1)];
}

/** "+12.4% vs last month" -> ["+12.4%", "vs last month"]; null without a leading signed number. */
export function splitDelta(detail) {
  const s = String(detail ?? "");
  if (!/^[+\-−]\d/.test(s)) return null;
  const i = s.indexOf(" ");
  return i < 0 ? [s, ""] : [s.slice(0, i), s.slice(i + 1).trim()];
}

// ---------------------------------------------------------------- geometry (pure, memoized)

const CACHE = new Map();
// ponytail: cleared whole past 64 entries, LRU if live values churn it.
function memo(key, build) {
  let v = CACHE.get(key);
  if (!v) {
    if (CACHE.size >= 64) CACHE.clear();
    v = build();
    CACHE.set(key, v);
  }
  return v;
}

// One path per key, in the order keys first appear (paint order). Open subpaths: a fill closes them
// (measured identical), so a rectangle is 4 commands. The fill is even-odd: rectangles of one key
// never overlap (runs paints each cell once), else the overlap would be a hole.
const rectPath = (rects) => {
  const by = new Map();
  for (const [x, y, w, h, key] of rects) by.set(key, (by.get(key) ?? PathBuilder.fill()).move_to(x, y).line_to(x + w, y).line_to(x + w, y + h).line_to(x, y + h));
  return new Map([...by].map(([k, b]) => [k, b.build()]));
};

// ponytail: in Herdr's runtime a cell costs 1 to 3 µs to ink, a rectangle 18 to 30 µs once (building
// its path) and 10 to 14 µs at EVERY render (paint_path replays its commands), and a call is
// interrupted near 120 ms. So a wide visual takes coarser cells, chosen from its area (`area` px²)
// BEFORE building: at most MAX_CELLS cells (a 400×170 chart stays at 3 px, 1904 px wide takes 8,
// 3000 px takes 9). If it still paints over MAX_RECTS rectangles, it is rebuilt coarser, up to twice
// that cell. Raise them only with a measured render (viz.check.mjs prints the counts).
export const MAX_RECTS = 1000;
export const MAX_CELLS = 8000;
export function capped(build, cell, area = 0) {
  let c = Math.max(cell, Math.ceil(Math.sqrt(area / MAX_CELLS)));
  const top = 2 * c;
  let g = build(c);
  while (g.rects.length > MAX_RECTS && c < top) {
    c = Math.min(top, Math.max(c + 1, Math.ceil(c * Math.sqrt(g.rects.length / MAX_RECTS))));
    g = build(c);
  }
  g.paths = rectPath(g.rects);
  return g;
}
const polyPath = (points, stroke) => points.reduce((b, [x, y], i) => (i ? b.line_to(x, y) : b.move_to(x, y)), stroke ? PathBuilder.stroke(stroke) : PathBuilder.fill());
// Monocode's glowing_line: two soft halos under the line, wider and fainter.
const halos = (points, width) => (points.length < 2 ? [] : [[polyPath(points, width + 10).build(), 0.07], [polyPath(points, width + 5).build(), 0.14]]);

/** A radial dial of 36 blocks over 270°, from -135° (7:30) clockwise. */
export const gaugeAngle = (dx, dy) => Math.atan2(dx, -dy) * DEG; // 0 at 12 o'clock, clockwise
export function gaugeInk(ratio, size, cell = CELL) {
  const SEGMENTS = 36, SPAN = 270, START = -135;
  const outer = size / 2 - 1 - cell;
  const height = size / 2 + (outer + cell) * Math.SQRT1_2 + 18;
  const c = size / 2;
  const thickness = Math.max(2, Math.round((size * 0.12) / cell)) * cell;
  const inner = outer - thickness;
  const step = SPAN / SEGMENTS;
  const middle = outer - thickness / 2;
  const gap = (2 / middle) * DEG;
  const filled = clamp(ratio, 0, 1) * SEGMENTS;
  const active = Math.max(0, Math.ceil(filled - 1e-6));
  const ink = (col, row) => {
    const dx = (col + 0.5) * cell - c;
    const dy = (row + 0.5) * cell - c;
    const r = Math.hypot(dx, dy);
    if (r < inner || r > outer + cell) return null;
    const along = gaugeAngle(dx, dy) - START;
    if (!(along >= 0 && along < SPAN)) return null;
    const index = Math.floor(along / step);
    const within = along - index * step;
    if (within < gap / 2 || within > step - gap / 2) return null;
    const head = active > 0 && index === active - 1;
    if (r > outer && !head) return null; // the block at the value steps out a cell, like a needle
    if (index >= active) return "track";
    if (head) {
      const part = clamp(filled - index, 0, 1);
      if (within > gap / 2 + (step - gap) * Math.max(part, 0.15)) return r <= outer ? "track" : null;
      return "tint";
    }
    return inked(col, row, Math.max(1 - (active - 1 - index) / 16, 9 / 16)) ? "tint" : null;
  };
  return { ink, cols: Math.floor(size / cell), rows: Math.floor(height / cell), height, c, middle, thickness, step, active };
}

/** Parts of a whole as a ring: the slice index of each cell, sweeping from 12 o'clock. */
export const ringAngle = (dx, dy) => {
  const a = Math.atan2(dx, -dy);
  return a < 0 ? a + TAU : a;
};
export function donutInk(values, size, cell = CELL) {
  const FLOOR = 3 / 16;
  const cols = Math.floor(size / cell);
  const half = (cols * cell) / 2;
  const outer = half - (size >= 64 ? 2 * cell : 0);
  const inner = outer - Math.max(1, Math.round((size * 0.17) / cell)) * cell;
  const total = values.reduce((s, v) => s + Math.max(v, 0), 0);
  let running = 0;
  const edges = values.map((v) => {
    const e = (running / Math.max(total, 1e-9)) * TAU;
    running += Math.max(v, 0);
    return e;
  });
  const live = edges.filter((_, i) => values[i] > 0);
  const ink = (col, row) => {
    const dx = (col + 0.5) * cell - half;
    const dy = (row + 0.5) * cell - half;
    const r = Math.hypot(dx, dy);
    if (r < inner || r > outer) return null;
    const angle = ringAngle(dx, dy);
    let index = -1;
    for (let i = edges.length - 1; i >= 0; i--) if (angle >= edges[i]) { index = i; break; }
    if (index < 0) return null;
    let outline = r > outer - cell || r < inner + cell;
    if (live.length > 1) {
      // Distance in cells from the nearest slice edge: a gap, then a solid rim along it.
      let near = Infinity;
      for (const e of live) {
        let d = Math.abs(angle - e);
        d = Math.min(d, TAU - d);
        if (d <= Math.PI / 2) near = Math.min(near, (r * Math.sin(d)) / cell);
      }
      if (near < 0.75) return null;
      outline ||= near < 1.75;
    }
    const depth = (outer - r) / (outer - inner);
    return outline || inked(col, row, FLOOR + (1 - FLOOR) * (1 - depth) ** 1.4) ? index : null;
  };
  return { ink, cols, rows: cols, half, inner, outer, total, edges };
}

/** A dithered bar: a comet, sparse at the start and solid at the head, over a faint track. The track
 * is one rectangle under the whole bar and the ink is painted over it (opaque): the same picture as
 * Monocode's track-colored gaps, in a fraction of the rectangles. */
export function progressGeometry(ratio, width, cell = CELL) {
  const cols = Math.floor(width / cell);
  const head = Math.round(cols * clamp(ratio, 0, 1));
  const ink = (col, row) => {
    if (col >= head) return null;
    const tone = 0.3 + 0.7 * (col / Math.max(head, 1)) ** 1.5;
    return col >= head - 3 || inked(col, row, tone) ? "tint" : null;
  };
  return { rects: [[0, 0, cols * cell, 3 * cell, "track"], ...runs(cols, 3, ink, cell)], head, cell };
}

// Bars and areas fade from their top edge toward the axis.
const BAR_LEVEL = 0.75, BAR_FLOOR = 0.125, BAR_FADE = 0.7, MAX_BAR = 36;
const AREA_LEVEL = 0.625, AREA_REST = 0.2;
const AREA_BANDS = [[0.05, 1], [0.13, 0.8], [0.25, 0.65], [0.4, 0.5], [0.6, 0.35]]; // [depth, coverage]

/** Bar, line and area: the scale, the plot's place in the box and its painted geometry. */
export function chartGeometry(kind, values, count, width, height, cell = CELL) {
  const bars = kind === "bar";
  const scale = Scale.nice(values.flat(), kind !== "line");
  const ticks = scale.ticks();
  const tickLabels = ticks.map((v) => scale.label(v));
  const left = Math.ceil(Math.max(1, ...tickLabels.map((l) => l.length)) * 6.1) + 10;
  const top = bars ? 16 : 8;
  const cols = Math.max(0, Math.floor((width - (bars ? 0 : 6) - left) / cell));
  const rows = Math.max(1, Math.floor((height - top - 22) / cell));
  const pw = cols * cell;
  const ph = rows * cell;
  const yOf = (v) => scale.depth(v) * ph;
  const band = pw / count;
  const xOf = (i) => (bars ? band * (i + 0.5) : count <= 1 ? pw / 2 : (i * pw) / (count - 1));
  const g = { scale, ticks, tickLabels, left, top, pw, ph, band, xOf, yOf, washes: [], halos: [], markers: [], last: null, cell };
  if (bars) {
    const n = Math.max(values.length, 1);
    const wide = Math.max(1, Math.round(Math.min((band * 0.7 - cell * (n - 1)) / n, MAX_BAR) / cell));
    const group = wide * n + (n - 1);
    const rowOf = (v) => Math.round((scale.depth(v) * ph) / cell);
    const zero = rowOf(Math.min(Math.max(scale.min, 0), scale.max));
    const fade = Math.max(rows * BAR_FADE, 1);
    const columns = new Array(cols).fill(null);
    for (let i = 0; i < count; i++) {
      const start = Math.round((band * (i + 0.5)) / cell - group / 2);
      values.forEach((vs, j) => {
        if (!Number.isFinite(vs[i])) return;
        const end = rowOf(vs[i]);
        const first = start + j * (wide + 1);
        for (let col = Math.max(0, first); col < Math.min(cols, first + wide); col++) columns[col] = [Math.min(end, zero), Math.max(end, zero), j];
        if (i === count - 1) g.last = Math.min(end, zero);
      });
    }
    g.rects = runs(cols, rows, (col, row) => {
      const c = columns[col];
      if (!c || row < c[0] || row >= c[1]) return null;
      const tone = BAR_LEVEL - (BAR_LEVEL - BAR_FLOOR) * Math.min((row - c[0]) / fade, 1);
      return row === c[0] || inked(col, row, tone) ? c[2] : null;
    }, cell);
  } else {
    const points = values.map((vs) => vs.flatMap((v, i) => (Number.isFinite(v) ? [[xOf(i), yOf(v)]] : [])));
    const curves = points.map((p) => new Curve(p));
    const lines = curves.map((c) => Array.from({ length: cols }, (_, col) => lineRows(c, col, cell, rows)));
    // Each curve's y at each column's centre, once (not per cell): null outside the curve.
    const ys = curves.map((c) => Array.from({ length: cols }, (_, col) => {
      const x = (col + 0.5) * cell;
      return c.xs.length >= 2 && x >= c.first && x <= c.last ? c.at(x) : null;
    }));
    const baseline = yOf(Math.max(scale.min, 0));
    const lead = Math.max((2 * cell) / Math.max(ph, 1), AREA_BANDS[0][0]);
    g.rects = runs(cols, rows, (col, row) => {
      for (let j = lines.length - 1; j >= 0; j--) {
        const r = lines[j][col];
        if (r && row >= r[0] && row <= r[1]) return j;
      }
      if (kind !== "area") return null;
      const y = (row + 0.5) * cell;
      if (y > baseline) return null;
      // Later series sit in front, as stacked paper would.
      for (let j = ys.length - 1; j >= 0; j--) {
        const top = ys[j][col];
        if (top == null || y < top) continue;
        const depth = (y - top) / Math.max(ph, 1);
        const share = depth < lead ? 1 : AREA_BANDS.find(([d]) => depth < d)?.[1] ?? AREA_REST;
        return inked(col, row, Math.round(AREA_LEVEL * share * 16) / 16) ? j : null;
      }
      return null;
    }, cell);
    curves.forEach((c, j) => {
      if (!c.xs.length) return;
      // Every 4 px: soft shapes, and each point is a command replayed at every render.
      const s = c.samples(4);
      if (kind === "area" && s.length > 1) g.washes.push([polyPath([...s, [c.last, baseline], [c.first, baseline]]).close().build(), j]);
      for (const [path, a] of halos(s, cell)) g.halos.push([path, a, j]);
      g.markers.push([c.last, c.ys.at(-1), j]);
    });
  }
  return g;
}

/** The sparkline under a stat: a line over bands that step lighter downward. */
export function trendGeometry(values, width, cell = CELL) {
  const HEIGHT = 56, DEPTH = 7, LEVELS = [10 / 16, 6 / 16, 3 / 16, 1 / 16];
  const cols = Math.floor(width / cell);
  const rows = Math.floor(HEIGHT / cell);
  const [w, h] = [cols * cell, rows * cell];
  const low = Math.min(...values);
  const high = Math.max(...values);
  const range = high > low ? high - low : 1;
  const [top, floor] = [6, h * 0.3];
  const curve = new Curve(values.map((v, i) => [(i / (values.length - 1)) * w, top + (1 - (v - low) / range) * (h - top - floor)]));
  const line = Array.from({ length: cols }, (_, col) => lineRows(curve, col, cell, rows));
  const ys = Array.from({ length: cols }, (_, col) => curve.at((col + 0.5) * cell));
  const rects = runs(cols, rows, (col, row) => {
    const r = line[col];
    if (r && row >= r[0] && row <= r[1]) return "tint";
    const depth = (row + 0.5) * cell - ys[col];
    return depth >= 0 && inked(col, row, LEVELS[Math.min(Math.floor(depth / DEPTH), LEVELS.length - 1)]) ? "tint" : null;
  }, cell);
  // The end marker (2 cells + its halo) stays inside the box: the reveal clips at its edge.
  return { rects, halos: halos(curve.samples(4), 1.5), end: [Math.min(curve.last, w - 2 * cell), curve.ys.at(-1)], h: HEIGHT, cell };
}

/** A grid of squares of 4×4 cells on a 5-cell pitch, one Bayer tile each: a track square under
 * each one with a value, the ink over it (opaque), as progress does. */
export function heatmapGeometry(values, width, cell = CELL) {
  const SQUARE = 4, PITCH = 5;
  const n = values[0]?.length ?? 0;
  const high = Math.max(1e-9, ...values.flat().filter(Number.isFinite));
  const cols = Math.floor(width / cell);
  const fits = Math.max(1, Math.floor((cols + PITCH - SQUARE) / PITCH));
  const skip = Math.max(0, n - fits); // a narrow heatmap keeps its latest columns, as calendars do
  const at = (r, c) => values[r]?.[c + skip];
  const tracks = [];
  values.forEach((_, r) => {
    for (let c = 0; c < fits; c++) if (at(r, c) != null) tracks.push([c * PITCH * cell, r * PITCH * cell, SQUARE * cell, SQUARE * cell, "track"]);
  });
  const ink = runs(cols, values.length * PITCH, (col, row) => {
    const [x, y] = [col % PITCH, row % PITCH];
    if (x >= SQUARE || y >= SQUARE || Math.floor(col / PITCH) >= fits) return null;
    const v = at(Math.floor(row / PITCH), Math.floor(col / PITCH));
    return v > 0 && inked(x, y, Math.round((0.25 + 0.75 * (v / high)) * 16) / 16) ? "tint" : null;
  }, cell);
  return { rects: [...tracks, ...ink], height: values.length * PITCH * cell, pitch: PITCH * cell, skip, square: SQUARE * cell, cell };
}

const gaugeGeometry = (ratio, size, cell) => memo(`g|${ratio}|${size}|${cell}`, () => capped((c) => {
  const g = gaugeInk(ratio, size, c);
  return Object.assign(g, { rects: runs(g.cols, g.rows, g.ink, c), cell: c });
}, cell, size * size));
const donutGeometry = (values, size, cell) => memo(`d|${values}|${size}|${cell}`, () => capped((c) => {
  const g = donutInk(values, size, c);
  return Object.assign(g, { rects: runs(g.cols, g.rows, g.ink, c), cell: c });
}, cell, size * size));

// ---------------------------------------------------------------- elements

const paint = (path, c) => globalThis.window.paint_path(path, c).absolute().inset_0();
const RECT = () => PathBuilder.fill().move_to("0%", "0%").line_to("100%", "0%").line_to("100%", "100%").line_to("0%", "100%").close().build();

/** Text with its vertical centre at y, anchored at x on its left, centre or right (Monocode's Label). */
function label(s, x, y, { align = "left", size = 10, color, mono = true, semibold = false, w = 160 } = {}) {
  const h = Math.ceil(size * 1.3);
  const el = div().absolute().left(Math.round(align === "left" ? x : align === "center" ? x - w / 2 : x - w)).top(Math.round(y - h / 2))
    .w(w).h(h).flex().items_center().whitespace_nowrap().text_size(size).text_color(color);
  return (align === "center" ? el.justify_center() : align === "right" ? el.justify_end() : el)
    .when(mono, (e) => e.font_family(MONO)).when(semibold, (e) => e.font_semibold()).child(String(s));
}

/** A legend swatch: a translucent body under a solid cap, like a bar. */
export const swatch = (c) => div().size(10).flex_none().bg(faint(c, 0.4)).child(div().h(2).w_full().bg(c));

/** A square end marker centred on (x, y), in a faint halo of its color. */
export const marker = (x, y, side, c) => [
  div().absolute().left(Math.round(x - (side + 6) / 2)).top(Math.round(y - (side + 6) / 2)).size(side + 6).bg(faint(c, 0.25)),
  div().absolute().left(Math.round(x - side / 2)).top(Math.round(y - side / 2)).size(side).bg(c),
];

/** The "nothing to show" box, said in words; `w` null: as wide as its container. */
const empty = (t, w, h, what = "aucune donnée") => (w == null ? div().w_full() : div().w(w))
  .h(h).flex().items_center().justify_center().rounded(8).border(1).border_color(t.border).text_size(12).text_color(t.dim).child(what);

/**
 * A fixed w × h box whose content draws in from the left once, the first time `id` shows: a clip
 * from width 0 to w (the content keeps its own w × h, so it doesn't reflow). Uses motion.js's state
 * (m.shown / m.used, forgotten by frame() when not drawn); no `m` or reduced motion: drawn at once.
 */
export function reveal(m, id, w, h, child) {
  const box = div().id(id).relative().w(w).h(h).flex_none();
  if (!m || m.reduced) return box.child(child);
  m.used.set(id, m.gen);
  const on = m.shown.has(id);
  return box
    .on_size_change((_size, cx) => {
      if (m.shown.has(id)) return;
      m.shown.add(id);
      cx.notify();
    })
    .child(div().id(`${id}~clip`).absolute().top(0).left(0).h(h).w(on ? w : 0).overflow_hidden()
      .transition("width", { duration: MS.panel, easing: "ease-out" }).child(child));
}

const fadeIn = (m, el, id) => (m ? enter(m, el, id, { dy: 0 }) : el.id(id));
const FLUID_W = 320;

/** The visuals, bound to a theme and a motion state (null: none). Like Monocode's `visual.*`. */
export function viz(t, m = null) {
  const light = isLight(t);
  const content = (a) => faint(t.foreground, a);
  const axis = { size: 10, color: content(0.45) };
  const slug = (s) => String(s).replace(/[^\w-]+/g, "-");

  // Without `width`, a visual is as wide as its container (which needs a definite width): measured on
  // its first layout and whenever that changes, kept in m.widths, drawn at that width from the next
  // render, an `h` px placeholder until then. No `m`: FLUID_W.
  // ponytail: a resize rebuilds the geometry at each new width (memoized), throttle if it shows.
  function fluid(id, width, h, draw) {
    if (width != null) return draw(width);
    if (!m) return draw(FLUID_W);
    const widths = (m.widths ??= new Map());
    const w = widths.get(id);
    return div().id(`${id}~w`).w_full().min_w(0)
      .on_size_change((size, cx) => {
        const next = Math.floor(size.width);
        if (next <= 0 || widths.get(id) === next) return;
        widths.set(id, next);
        cx.notify();
      })
      .child(w ? draw(w) : div().h(h));
  }

  function gauge(name, value, { min = 0, max = 100, unit, color: token = "accent", size = 220, cell = CELL, id = `viz-g-${slug(name)}` } = {}) {
    if (!Number.isFinite(value) || !(max > min)) return empty(t, size, size * 0.85);
    const ratio = clamp((value - min) / (max - min), 0, 1);
    const g = gaugeGeometry(ratio, size, cell);
    const tint = color(t, token);
    const fmt = (v) => (unit === "%" ? `${compact(v, 1)}%` : unit ? `${compact(v, 0.1)} ${unit}` : compact(v, 0.1));
    const ends = g.middle * Math.SQRT1_2;
    return fadeIn(m, div().relative().w(size).h(g.height).flex_none().children([
      ...[...g.paths].map(([k, p]) => paint(p, k === "tint" ? tint : faint(tint, 0.14))),
      label(fmt(value), g.c, g.c - 4, { align: "center", size: Math.round(size * 0.15), color: t.foreground, mono: false, semibold: true, w: size }),
      label(name, g.c, g.c + size * 0.1 + 6, { align: "center", size: 12, color: content(0.6), mono: false, w: size }),
      label(compact(min, 1), g.c - ends, g.c + ends + g.thickness / 2 + 12, { align: "center", ...axis, w: 60 }),
      label(compact(max, 1), g.c + ends, g.c + ends + g.thickness / 2 + 12, { align: "center", ...axis, w: 60 }),
    ]), id);
  }

  function donut(slices, { label: caption, value, size = 184, cell = CELL, legend = size >= 64, id = `viz-d-${slug(caption ?? "donut")}` } = {}) {
    const values = slices.map((s) => (Number.isFinite(s.value) ? s.value : 0));
    const total = values.reduce((s, v) => s + Math.max(v, 0), 0);
    if (!(total > 0)) return empty(t, legend ? size + 160 : size, size);
    const g = donutGeometry(values, size, cell);
    const colors = slices.map((s, i) => color(t, s.color ?? `series${(i % 6) + 1}`));
    let figure = value;
    if (figure == null) figure = total >= 1e4 ? Math.round(total).toString().replace(/\B(?=(\d{3})+$)/g, " ") : compact(total, 0.1);
    const fit = Math.floor(Math.min(26, (g.inner * 2 - 16) / (String(figure).length * 0.62)));
    const ring = div().relative().size(size).flex_none().children([
      ...[...g.paths].map(([k, p]) => paint(p, colors[k])),
      ...(legend && caption ? [label(String(caption).toUpperCase().slice(0, 18), g.half, g.half - 16, { align: "center", ...axis, w: size })] : []),
      ...(legend ? [label(figure, g.half, g.half + (caption ? 4 : 0), { align: "center", size: fit, color: t.foreground, mono: false, semibold: true, w: size })] : []),
    ]);
    if (!legend) return fadeIn(m, ring, id).tooltip(`${caption ?? ""} ${figure}`.trim());
    const rows = slices.map((s, i) => div().flex().items_center().gap(8).text_size(12).children([
      swatch(colors[i]),
      div().flex_1().min_w_0().truncate().text_color(content(0.8)).child(String(s.label ?? "")),
      div().font_family(MONO).text_color(content(0.5)).child(`${compact(values[i], 0.1)} · ${Math.round((values[i] / total) * 100)}%`),
    ]));
    return div().flex().flex_wrap().items_center().gap(24).children([
      fadeIn(m, ring, id),
      div().flex_1().min_w(140).max_w(320).flex().flex_col().gap(8).children(rows),
    ]);
  }

  function progress(name, value, { max = 100, detail, color: token = "accent", width, cell = CELL, id = `viz-p-${slug(name)}` } = {}) {
    const ratio = max > 0 && Number.isFinite(value) ? clamp(value / max, 0, 1) : 0;
    const tint = color(t, token);
    const glow = faint(tint, (light ? 0.4 : 1) * 0.3);
    // Monocode blooms the filled part (a 14 px blurred shadow); gpui has no colored blur, so a 6 px
    // gradient above and below it stands in. The box takes them in, else the reveal's clip cuts them.
    const B = 6;
    const bar = (w) => {
      const g = memo(`p|${ratio}|${w}|${cell}`, () => capped((c) => progressGeometry(ratio, w, c), cell, w * 3 * cell));
      const hpx = 3 * g.cell;
      const bloom = g.head > 0 ? [[0, faint(tint, 0), glow], [B + hpx, glow, faint(tint, 0)]].map(([y, from, to]) =>
        div().absolute().left(0).top(y).w(g.head * g.cell).h(B).child(paint(RECT(), Background.linear_gradient(180, from, to)))) : [];
      const cells = div().absolute().left(0).top(B).w(w).h(hpx).children([...g.paths].map(([k, p]) => paint(p, k === "tint" ? tint : faint(tint, 0.14))));
      return reveal(m, id, w, hpx + 2 * B, div().relative().w(w).h(hpx + 2 * B).children([...bloom, cells]));
    };
    return (width == null ? div().w_full() : div().w(width)).flex().flex_col().gap(8 - B).children([
      div().flex().items_baseline().gap(8).children([
        div().flex_1().min_w_0().truncate().text_size(13).text_color(t.foreground).child(String(name)),
        div().font_family(MONO).text_size(12).text_color(content(0.55)).child(`${Math.round(ratio * 100)}%`),
      ]),
      fluid(id, width, 3 * cell + 2 * B, bar),
      ...(detail ? [div().text_size(12).text_color(content(0.55)).child(String(detail))] : []),
    ]);
  }

  function chart(kind, series, { labels = [], height = 220, width, cell = CELL, id = `viz-c-${kind}` } = {}) {
    const values = series.map((s) => s.values ?? []);
    const count = Math.max(labels.length, ...values.map((v) => v.length), 0);
    if (!count || !values.flat().some(Number.isFinite)) return empty(t, width, height);
    return fluid(id, width, height, (w) => chartAt(kind, series, values, count, labels, height, w, cell, id));
  }

  function chartAt(kind, series, values, count, labels, height, width, cell, id) {
    const g = memo(`c|${kind}|${JSON.stringify(values)}|${count}|${width}|${height}|${cell}`, () => capped((c) => chartGeometry(kind, values, count, width, height, c), cell, width * height));
    const colors = series.map((s, i) => color(t, s.color ?? `series${(i % 6) + 1}`));
    const dim = light ? 0.45 : 1;
    const bars = kind === "bar";
    const marks = div().relative().w(width).h(height).child(div().absolute().left(g.left).top(g.top).w(g.pw).h(g.ph).children([
      ...g.washes.map(([p, j]) => paint(p, faint(colors[j], light ? 0.04 : 0.07))),
      ...g.halos.map(([p, a, j]) => paint(p, faint(colors[j], a * dim))),
      ...[...g.paths].map(([j, p]) => paint(p, colors[j])),
      ...g.markers.flatMap(([x, y, j]) => marker(x, y, 2 * g.cell, colors[j])),
    ]));
    const stride = Math.max(1, Math.ceil(count / Math.max(1, Math.floor(g.pw / 72))));
    const xLabels = labels.flatMap((l, i) => {
      if (i % stride) return [];
      const align = bars ? "center" : i === 0 ? "left" : i === count - 1 ? "right" : "center";
      const s = String(l).length > 12 ? `${String(l).slice(0, 11)}…` : String(l);
      return [label(s, g.left + g.xOf(i), g.top + g.ph + 13, { align, ...axis, w: 90 })];
    });
    // The readout, natively: a tooltip per category (Monocode's follows the pointer and repaints).
    const tipW = bars ? g.band : count > 1 ? g.pw / (count - 1) : g.pw;
    const tips = count > 60 ? [] : Array.from({ length: count }, (_, i) => div().id(`${id}-tip-${i}`).absolute()
      .left(Math.round(g.left + (bars ? g.band * i : g.xOf(i) - tipW / 2))).top(g.top).w(Math.max(1, tipW)).h(g.ph)
      .tooltip(`${labels[i] ?? `#${i + 1}`} · ${series.map((s, j) => `${s.label ?? ""} ${Number.isFinite(values[j][i]) ? reading(values[j][i]) : "–"}`.trim()).join(" · ")}`));
    const lastValue = values[0]?.[count - 1];
    const box = div().relative().w(width).h(height).flex_none().children([
      ...g.ticks.map((v) => div().absolute().left(g.left).top(g.top + Math.round(g.yOf(v))).w(g.pw).h(1).bg(content(0.07))),
      ...g.ticks.map((v, i) => label(g.tickLabels[i], g.left - 10, g.top + Math.round(g.yOf(v)), { align: "right", ...axis, w: g.left })),
      ...xLabels,
      div().absolute().top(0).left(0).child(reveal(m, id, width, height, marks)),
      // With one series, the latest value is written over its bar.
      ...(bars && series.length === 1 && g.last != null && Number.isFinite(lastValue)
        ? [label(compact(lastValue, g.scale.step / 10), g.left + g.band * (count - 0.5), g.top + g.last * g.cell - 9, { align: "center", size: 10, color: content(0.9), w: 80 })]
        : []),
      ...tips,
    ]);
    if (series.length < 2) return box;
    return div().w(width).flex().flex_col().gap(12).children([
      box,
      div().flex().flex_wrap().gap_x(16).gap_y(4).children(series.map((s, i) => div().flex().items_center().gap(6).text_size(11)
        .font_family(MONO).text_color(content(0.6)).children([swatch(colors[i]), div().child(String(s.label ?? `#${i + 1}`))]))),
    ]);
  }

  function trend(values, { color: token = "accent", width, cell = CELL, id = "viz-trend" } = {}) {
    const vs = (values ?? []).filter(Number.isFinite);
    if (vs.length < 2) return empty(t, width, 56);
    const tint = color(t, token);
    const dim = light ? 0.45 : 1;
    return fluid(id, width, 56, (w) => {
      const g = memo(`tr|${vs}|${w}|${cell}`, () => capped((c) => trendGeometry(vs, w, c), cell, w * 56));
      return reveal(m, id, w, g.h, div().relative().w(w).h(g.h).children([
        ...g.halos.map(([p, a]) => paint(p, faint(tint, a * dim))),
        ...[...g.paths].map(([, p]) => paint(p, tint)),
        ...marker(g.end[0], g.end[1], 2 * g.cell, tint),
      ]));
    });
  }

  // As many columns as the width holds (the latest ones), squares of a fixed size: what doesn't fill
  // the width is the data ending, not the drawing. Not capped: its cost is its squares (~5.6
  // rectangles each, a 52×7 year ~2000), not its width, and coarser cells would make it taller.
  function heatmap(values, { rows = [], columns = [], color: token = "accent", width, cell = CELL, id = "viz-heatmap" } = {}) {
    const n = values?.[0]?.length ?? 0;
    const gutter = rows.length ? 34 : 0;
    const top = columns.length ? 18 : 0;
    if (!n || !values.flat().some(Number.isFinite)) return empty(t, width, 120);
    return fluid(id, width, top + values.length * 5 * cell, (w) => heatmapAt(values, rows, columns, token, w, gutter, top, cell, id));
  }

  function heatmapAt(values, rows, columns, token, w, gutter, top, cell, id) {
    const g = memo(`h|${JSON.stringify(values)}|${w - gutter}|${cell}`, () => {
      const h = heatmapGeometry(values, w - gutter, cell);
      return Object.assign(h, { paths: rectPath(h.rects) });
    });
    const tint = color(t, token);
    const rowLabels = rows.flatMap((l, i) => (rows.length > 4 && i % 2 ? [] : [label(l, 0, top + i * g.pitch + g.square / 2, { ...axis, w: gutter })]));
    // Each new column label (a month over its weeks) where it starts, when it clears the one before.
    const colLabels = [];
    let prev = null;
    columns.slice(g.skip).forEach((l, i) => {
      const x = i * g.pitch;
      if (prev && (prev[0] === l || x - prev[1] < 36)) return;
      prev = [l, x];
      colLabels.push(label(l, gutter + x, top / 2, { ...axis, w: 60 }));
    });
    const tiles = div().relative().w(w - gutter).h(g.height).children([...g.paths].map(([k, p]) => paint(p, k === "tint" ? tint : content(0.07))));
    return div().relative().w(w).h(top + g.height).flex_none().children([
      ...rowLabels,
      ...colLabels,
      div().absolute().left(gutter).top(top).child(reveal(m, id, w - gutter, g.height, tiles)),
    ]);
  }

  function stat(name, value, { detail, delta, trend: series, better = "higher", color: token = "accent", width, id = `viz-s-${slug(name)}` } = {}) {
    const split = delta == null ? splitDelta(detail) : [String(delta), detail ?? ""];
    const [change, rest] = split ?? [null, detail];
    const down = change != null && /^[-−]/.test(change);
    const tone = color(t, down !== (better === "lower") ? "negative" : "positive");
    return (width == null ? div().w_full().min_w(0) : div().w(width)).flex().flex_col().gap(4).children([
      div().text_size(12).text_color(content(0.6)).child(String(name)),
      div().text_size(24).font_semibold().text_color(t.foreground).child(String(value)),
      ...(change != null || rest ? [div().flex().items_center().gap(8).children([
        ...(change != null ? [div().flex().items_center().gap(4).flex_none().text_size(12).font_family(MONO).text_color(tone).children([div().child(down ? "▼" : "▲"), div().child(change)])] : []),
        ...(rest ? [div().min_w_0().truncate().text_size(12).text_color(content(0.55)).child(String(rest))] : []),
      ])] : []),
      ...((series ?? []).length >= 2 ? [div().mt(8).child(trend(series, { color: token, width, id: `${id}-trend` }))] : []),
    ]);
  }

  return { gauge, donut, progress, chart, trend, heatmap, stat, swatch, color: (name) => color(t, name) };
}
