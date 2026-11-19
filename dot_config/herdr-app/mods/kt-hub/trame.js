// kt-hub's trames (#76): viz.js' dithered visuals (its 3 px Bayer cells, its geometries) for the hub. The
// heavy ones (the year, the six cards' trends, the rows of squares) are written as one SVG each and drawn by
// image(): in paths, a year (~2 200 rectangles) or the six trends (~250 each) took a render past the ~50 ms
// it has; as an image, a visual costs one element. main.js builds them after a render, one per task turn,
// at the measured width and in the theme's own colors, a file per fingerprint (trame/ in data/kt-hub). The
// light ones (a project's weeks) stay paths, as viz.js draws them. Pure but for viz.js (gpui-kit inside):
// trame.check.mjs mocks it.
// Two switches for the captures (main.js' TRAME): `use` (each level's square drawn once in <defs> and
// placed by <use>, else translated rectangles) and `scale` (the SVG's size × scale, its viewBox the same,
// for a Retina that would blur a 1:1 image).
import { runs, inked, Curve, lineRows, progressGeometry, donutInk, CELL } from "./viz.js";

/** "#rrggbbaa" (or "#rrggbb") -> ["#rrggbb", opacity 0..1]. */
export function fillOf(c) {
  const s = String(c ?? "#000000");
  const a = s.length >= 9 ? parseInt(s.slice(7, 9), 16) / 255 : 1;
  return [s.slice(0, 7), Math.round(a * 1000) / 1000];
}

const rectD = (rects) => rects.map(([x, y, w, h]) => `M${x} ${y}h${w}v${h}h${-w}z`).join("");
const head = (w, h, scale, xlink = false) =>
  // i18n: tech
  `<svg xmlns="http://www.w3.org/2000/svg"${xlink ? ' xmlns:xlink="http://www.w3.org/1999/xlink"' : ""} width="${w * scale}" height="${h * scale}" viewBox="0 0 ${w} ${h}" shape-rendering="crispEdges">`;

/** An SVG `w` × `h` px: layers of rectangles ({ rects, color }) or of a line ({ points, color, width }:
 * a trend's halos, round joins and caps, antialiased), painted in order. */
export function svgOf(w, h, layers, scale = 1) {
  const out = [head(w, h, scale)];
  for (const l of layers) {
    const [fill, op] = fillOf(l.color);
    if (l.rects?.length) out.push(`<path fill="${fill}" fill-opacity="${op}" d="${rectD(l.rects)}"/>`); // i18n: tech
    // i18n: tech
    if (l.points?.length > 1) out.push(`<polyline fill="none" stroke="${fill}" stroke-opacity="${op}" stroke-width="${l.width}" stroke-linejoin="round" stroke-linecap="round" shape-rendering="geometricPrecision" points="${l.points.map(([x, y]) => `${Math.round(x * 10) / 10},${Math.round(y * 10) / 10}`).join(" ")}"/>`);
  }
  out.push("</svg>");
  return out.join("");
}

/** A short fingerprint of a string (FNV-1a, 32 bits, base 36): a part of a visual's file name. */
export function hash(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193) >>> 0;
  return h.toString(36);
}

// The calendar: squares of n × n cells with a cell between, a column per week, Monday on top; a level 1..4
// inks a quarter to all of its square through the Bayer matrix (viz.js' heatmap tones), over a track square.
const TONES = [0, 0.25, 0.5, 0.75, 1];
const INK = new Map();
/** A level's square (1..4) of n × n cells: its inked cells as rectangles from (0, 0). */
export function squareInk(level, n = 4, cell = CELL) {
  const k = `${n}|${level}|${cell}`;
  if (!INK.has(k)) INK.set(k, runs(n, n, (x, y) => (inked(x, y, TONES[Math.min(4, level)]) ? "ink" : null), cell).map((r) => r.slice(0, 4)));
  return INK.get(k);
}

/** The square's side in cells for a year `width` px wide: the largest from 7 (21 px) down to 5 (15 px) at
 * which the whole year fits, else 4 (12 px, the latest weeks when even that doesn't). #89: Activité spans
 * the page at every width now; at 1 530 px a 15 px year left ~550 px of nothing around it. */
export const calN = (levels, offset, width, cell = CELL) => {
  const weeks = Math.ceil((offset + levels.length) / 7);
  for (let n = 7; n > 4; n--) if (weeks * (n + 1) * cell - cell <= width) return n;
  return 4;
};

/** The calendar's grid, `levels` (0..4, null outside) from a day of weekday `offset` (Monday 0), squares of
 * `n` cells: its columns (the latest weeks when narrower than the year), the squares in range [x, y, level]. */
export function calendarGrid(levels, offset, width, n = 4, cell = CELL) {
  const sq = n * cell, pitch = sq + cell;
  const all = Math.max(1, Math.ceil((offset + levels.length) / 7));
  const skip = Math.max(0, all - Math.max(1, Math.floor((width + cell) / pitch)));
  const cols = all - skip;
  const days = [];
  for (let c = 0; c < cols; c++) for (let r = 0; r < 7; r++) {
    const d = (c + skip) * 7 + r - offset;
    if (d >= 0 && d < levels.length && levels[d] != null) days.push([c * pitch, r * pitch, levels[d]]);
  }
  return { days, cols, skip, n, pitch, square: sq, width: cols * pitch - cell, height: 7 * pitch - cell };
}

/** The calendar as an SVG: a track square per day, then each day's level square. With `use`, each level is
 * drawn once in <defs> and placed by <use> (365 references: a few ms in Herdr, where the ~1 600 rectangles
 * of runs took 34 to 49 ms); without, its rectangles translated (no runs either). */
export function calendarSvg(levels, offset, width, ink, track, { n = 4, use = true, scale = 1, cell = CELL } = {}) {
  const g = calendarGrid(levels, offset, width, n, cell);
  const [tf, to] = fillOf(track), [inf, ino] = fillOf(ink);
  const sq = g.square;
  const out = [head(g.width, g.height, scale, use)];
  if (use) {
    out.push("<defs>");
    for (let lv = 1; lv <= 4; lv++) out.push(`<path id="l${lv}" d="${rectD(squareInk(lv, n, cell))}"/>`); // i18n: tech
    out.push("</defs>");
  }
  out.push(`<path fill="${tf}" fill-opacity="${to}" d="${g.days.map(([x, y]) => `M${x} ${y}h${sq}v${sq}h${-sq}z`).join("")}"/>`); // i18n: tech
  if (use) {
    out.push(`<g fill="${inf}" fill-opacity="${ino}">`); // i18n: tech
    for (const [x, y, lv] of g.days) if (lv > 0) out.push(`<use xlink:href="#l${Math.min(4, lv)}" x="${x}" y="${y}"/>`); // i18n: tech
    out.push("</g>");
  } else {
    const d = [];
    for (const [x, y, lv] of g.days) if (lv > 0) for (const [rx, ry, rw, rh] of squareInk(lv, n, cell)) d.push(`M${x + rx} ${y + ry}h${rw}v${rh}h${-rw}z`);
    out.push(`<path fill="${inf}" fill-opacity="${ino}" d="${d.join("")}"/>`); // i18n: tech
  }
  out.push("</svg>");
  return { ...g, w: g.width, h: g.height, svg: out.join("") };
}

/** Squares in a row, the calendar's (the legend's five levels, the streak's last days), `gap` px apart. */
export function squaresSvg(levels, gap, ink, track, { n = 4, scale = 1, cell = CELL } = {}) {
  const sq = n * cell, step = sq + gap, w = levels.length * step - gap;
  const inks = levels.flatMap((lv, i) => (lv > 0 ? squareInk(Math.min(4, lv), n, cell).map(([x, y, rw, rh]) => [i * step + x, y, rw, rh]) : []));
  return { w, h: sq, svg: svgOf(w, sq, [{ rects: levels.map((_, i) => [i * step, 0, sq, sq]), color: track }, { rects: inks, color: ink }], scale) };
}

// viz.stat's sparkline, recadrée (#76, the hub's only: viz.js stays as its 11 copies have it): the curve
// ends at the end marker's centre, PAD px inside the box on the right and at the top, so the marker's
// 12 px halo stays inside (in viz.js the line runs to the edge and the halo touches it); the area stops
// there too. Same bands (DEPTH, LEVELS) and line as viz.js' trendGeometry.
export const PAD = 9;
export function trendGeometry(values, width, cell = CELL) {
  const HEIGHT = 56, DEPTH = 7, LEVELS = [10 / 16, 6 / 16, 3 / 16, 1 / 16];
  const cols = Math.floor(width / cell), rows = Math.floor(HEIGHT / cell);
  const [w, h] = [cols * cell, rows * cell];
  const low = Math.min(...values), high = Math.max(...values), range = high > low ? high - low : 1;
  const [top, floor] = [PAD, h * 0.3];
  const span = w - PAD;
  const curve = new Curve(values.map((v, i) => [(i / (values.length - 1)) * span, top + (1 - (v - low) / range) * (h - top - floor)]));
  const line = Array.from({ length: cols }, (_, col) => lineRows(curve, col, cell, rows));
  const ys = Array.from({ length: cols }, (_, col) => curve.at((col + 0.5) * cell));
  const rects = runs(cols, rows, (col, row) => {
    if ((col + 0.5) * cell > span) return null;
    const r = line[col];
    if (r && row >= r[0] && row <= r[1]) return "tint";
    const depth = (row + 0.5) * cell - ys[col];
    return depth >= 0 && inked(col, row, LEVELS[Math.min(Math.floor(depth / DEPTH), LEVELS.length - 1)]) ? "tint" : null;
  }, cell);
  return { rects, samples: curve.samples(4), end: [curve.last, curve.ys.at(-1)], w, h: HEIGHT, cell };
}

/** A trend as an SVG: the line's two halos (strokes 11.5 and 6.5 px at 0.07 and 0.14, × `dim`: viz.js'
 * 0.45 in light), its dithered area and line, its end marker in its halo (0.25). */
export function trendSvg(values, width, color, { dim = 1, scale = 1, cell = CELL } = {}) {
  const g = trendGeometry(values, width, cell);
  const side = 2 * cell, halo = side + 6, [ex, ey] = g.end;
  const [hex] = fillOf(color);
  const a = (x) => `${hex}${Math.round(x * 255).toString(16).padStart(2, "0")}`;
  const box = (n) => [Math.round(ex - n / 2), Math.round(ey - n / 2), n, n];
  return { w: g.w, h: g.h, svg: svgOf(g.w, g.h, [
    { points: g.samples, color: a(0.07 * dim), width: 11.5 },
    { points: g.samples, color: a(0.14 * dim), width: 6.5 },
    { rects: g.rects.map((r) => r.slice(0, 4)), color: hex },
    { rects: [box(halo)], color: a(0.25) },
    { rects: [box(side)], color: hex },
  ], scale) };
}

/** A workflow's funnel (#76): a dithered bar per step (viz.progress' comet over its track, 3 cells high),
 * one under the other `pitch` px apart, each centred in its row; `rows`: [{ ratio, color }]. One image for
 * its 8 bars: in paths, two funnels (~1 600 rectangles) took a render past its budget. */
export function funnelSvg(rows, width, pitch, { scale = 1, cell = CELL } = {}) {
  const w = Math.floor(width / cell) * cell, h = rows.length * pitch, bar = 3 * cell, off = Math.round((pitch - bar) / 2);
  const layers = rows.flatMap(({ ratio, color }, i) => {
    const g = progressGeometry(ratio, w, cell);
    const at = (k) => g.rects.filter((r) => r[4] === k).map(([x, y, rw, rh]) => [x, y + i * pitch + off, rw, rh]);
    const [hex] = fillOf(color);
    return [{ rects: at("track"), color: `${hex}24` }, { rects: at("tint"), color: hex }];
  });
  return { w, h, svg: svgOf(w, h, layers, scale) };
}

/** viz.donut's ring (its legend and figure are the page's), its slices in `colors`: in paths, ~400
 * rectangles on the render that brings the page's data. */
export function donutSvg(values, size, colors, { scale = 1, cell = CELL } = {}) {
  const g = donutInk(values, size, cell);
  const rects = runs(g.cols, g.rows, g.ink, cell);
  const px = g.cols * cell;
  return { w: px, h: px, inner: g.inner, svg: svgOf(px, px, values.map((_, i) => ({ rects: rects.filter((r) => r[4] === i).map((r) => r.slice(0, 4)), color: colors[i] })), scale) };
}

/** #89, Temps agent's chart: a column a day (`days`: [[{ k, v }]] from the bottom; a day to come, []), `max`
 * at the top, a bar of `wide` cells centred in its band. A segment: its top row solid, its body inked at 0.72
 * or 0.42 by its place in the stack (two projects may share a registry color), its bottom row left empty
 * above another. Rectangles keyed by segment. */
// Bar by bar, a segment's rows run by run (runs() over the whole plot, empty columns included, took ~40 ms
// for a month at 1 530 px in Herdr); the same run in the next row grows the rectangle, as runs() does.
export function stackGeometry(days, max, width, height, cell = CELL) {
  const cols = Math.floor(width / cell), rows = Math.floor(height / cell), band = cols / Math.max(1, days.length);
  const wide = Math.max(2, Math.min(Math.floor(band * 0.62), 10));
  const rects = [];
  days.forEach((segs, i) => {
    const start = Math.max(0, Math.round(band * (i + 0.5) - wide / 2)), end = Math.min(cols, start + wide);
    let y = rows, j = 0;
    for (const x of segs) {
      if (!(x.v > 0)) continue;
      const a = Math.max(0, y - Math.max(1, Math.round((x.v / max) * rows))), b = y, tone = j % 2 ? 0.42 : 0.72;
      let above = new Map();
      for (let row = a; row < b; row++) {
        const here = new Map();
        const push = (s, e) => {
          const id = `${s}:${e}`, r = above.get(id);
          if (r) r[3] += cell;
          else rects.push([s * cell, row * cell, (e - s) * cell, cell, x.k]);
          here.set(id, r ?? rects.at(-1));
        };
        if (row === a) push(start, end);
        else if (!(j > 0 && b - a >= 2 && row === b - 1)) {
          let run = -1;
          for (let c = start; c <= end; c++) {
            const on = c < end && inked(c, row, tone);
            if (on && run < 0) run = c;
            else if (!on && run >= 0) { push(run, c); run = -1; }
          }
        }
        above = here;
      }
      y = a;
      j++;
    }
  });
  return { rects, cols, rows, band, wide, w: cols * cell, h: rows * cell };
}

/** The chart as an SVG, a layer per segment key in `colors` ({ key: color }, in stack order). */
export function stackSvg(days, max, width, height, colors, { scale = 1, cell = CELL } = {}) {
  const g = stackGeometry(days, max, width, height, cell);
  return { w: g.w, h: g.h, svg: svgOf(g.w, g.h, Object.entries(colors).map(([k, color]) => ({ rects: g.rects.filter((r) => r[4] === k).map((r) => r.slice(0, 4)), color })), scale) };
}

/** A project's weeks (#76), drawn in paths: a bar per week, 3 cells wide with a cell between, on a one-row
 * track; the past weeks half inked under a solid cap, this week solid. Rectangles keyed track, past, now. */
export function sparkGeometry(values, width, height, cell = CELL) {
  const n = values.length, cols = Math.floor(width / cell), rows = Math.floor(height / cell);
  const band = cols / n, wide = Math.max(1, Math.floor(band) - 1), max = Math.max(1, ...values);
  const top = values.map((v) => (v > 0 ? rows - Math.max(1, Math.round((v / max) * rows)) : rows));
  const rects = runs(cols, rows, (col, row) => {
    const i = Math.floor(col / band);
    if (i >= n || col - Math.round(i * band) >= wide || row < top[i]) return null;
    if (i === n - 1) return "now";
    return row === top[i] || inked(col, row, 0.5) ? "past" : null;
  }, cell);
  const track = values.map((_, i) => [Math.round(i * band) * cell, (rows - 1) * cell, wide * cell, cell, "track"]);
  return { rects: [...track, ...rects], cell, w: cols * cell, h: rows * cell };
}
