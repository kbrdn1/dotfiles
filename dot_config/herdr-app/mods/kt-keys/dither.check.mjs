// bun ~/.config/herdr-app/mods/kt-keys/dither.check.mjs: bandWindows never lets a dot out of a rounded
// corner, leaves no dot inside the arc uncovered (the "missing corner" bug), never slices a dot at an arc,
// and merges the middle into one window. gpui-kit mocked.
import assert from "node:assert/strict";
import { plugin } from "bun";

plugin({ setup(b) { b.module("gpui-kit", () => ({ exports: { div: () => ({}), svg: () => ({}) }, loader: "object" })); } });
const { bandWindows, tiles, BAND_W, TOP, BOTTOM, ALL } = await import("./dither.js");

// Tiling: whole pattern periods, and exactly the tiles a window needs (none missing at a 4K width).
assert.equal(BAND_W % 128, 0);
assert.deepEqual(tiles(0, 400), [0]);
assert.deepEqual(tiles(0, BAND_W), [0]);
assert.deepEqual(tiles(0, BAND_W + 1), [0, 1]);
assert.deepEqual(tiles(BAND_W - 36, 100), [0, 1]);
assert.deepEqual(tiles(0, 3840), [0, 1, 2]);

// Is point (px, py) inside the w × h box with radius r on the given corners?
const inside = (w, h, r, c, px, py) => {
  const corner = (cx, cy) => (px - cx) ** 2 + (py - cy) ** 2 <= r * r + 1e-9;
  if (c.tl && px < r && py < r) return corner(r, r);
  if (c.tr && px > w - r && py < r) return corner(w - r, r);
  if (c.bl && px < r && py > h - r) return corner(r, h - r);
  if (c.br && px > w - r && py > h - r) return corner(w - r, h - r);
  return px >= 0 && px <= w && py >= 0 && py <= h;
};

for (const [w, h, r, c] of [[420, 60, 15, TOP], [331, 60, 15, TOP], [600, 40, 19, TOP], [280, 80, 12, ALL], [517, 60, 15, BOTTOM]]) {
  const win = bandWindows(w, h, r, c);
  const shown = (x, y) => win.some(([a, b, ww, hh]) => x >= a && x + 2 <= a + ww && y >= b && y + 2 <= b + hh);
  const sliced = (x, y) => win.some(([a, b, ww, hh]) => x < a + ww && x + 2 > a && y < b + hh && y + 2 > b) && !shown(x, y);
  for (let y = 0; y + 2 <= h; y += 4) {
    for (let x = 0; x + 2 <= w; x += 4) {
      const fits = [[x, y], [x + 2, y], [x, y + 2], [x + 2, y + 2]].every(([px, py]) => inside(w, h, r, c, px, py));
      if (fits) assert.ok(shown(x, y), `dot ${x},${y} inside the arc is missing (${w}x${h} r${r})`);
      else assert.ok(!shown(x, y), `dot ${x},${y} crosses the arc (${w}x${h} r${r})`);
      // At an arc no dot is half shown (a cut at the straight right edge of an odd width is fine).
      if (x + 2 <= w - 1 || !fits) assert.ok(!sliced(x, y), `dot ${x},${y} sliced (${w}x${h} r${r})`);
    }
  }
  // Every window corner stays inside the rounded box.
  for (const [a, b, ww, hh] of win) for (const [px, py] of [[a, b], [a + ww, b], [a, b + hh], [a + ww, b + hh]])
    assert.ok(inside(w, h, r, c, Math.min(px, w), Math.min(py, h)) || px % 4 === 2 || py % 4 === 2, `window ${a},${b} leaves the card`);
  assert.ok(win.length <= Math.ceil(r / 2) * (c === ALL ? 2 : 1) + 1, `too many windows: ${win.length}`);
}
console.log("ok");
