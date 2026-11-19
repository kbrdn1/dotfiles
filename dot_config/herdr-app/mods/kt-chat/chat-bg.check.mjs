// bun ~/.config/herdr-app/mods/kt-chat/chat-bg.check.mjs: chat-bg.ts, a project's Chat background
// (#57): the Bayer matrix is viz.js', cells are whole blocks of `cell` px, unlit ones transparent,
// the photo's hue at full brightness or the project's tint, and the CLI end to end on a generated
// image (magick) in a temporary folder.
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, readdirSync, rmdirSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { BAYER4, inked, ditherRGBA, outName, CELLS } from "./chat-bg.ts";

// The matrix is viz.js' (kt-keys), not a second one.
const viz = readFileSync(new URL("../kt-keys/viz.js", import.meta.url), "utf8");
assert.deepEqual(JSON.parse(viz.match(/const BAYER4 = (\[[^\]]+\])/)[1]), BAYER4);
let n = 0;
for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) n += inked(c, r, 0.25) ? 1 : 0;
assert.equal(n, 4, "a tone of 0.25 inks a quarter");

const solid = (w, h, rgba) => { const px = new Uint8Array(w * h * 4); for (let i = 0; i < w * h; i++) px.set(rgba, i * 4); return px; };
const at = (px, w, x, y) => Array.from(px.slice((y * w + x) * 4, (y * w + x) * 4 + 4));

// Photo: a mid grey inks half the cells, in white (full brightness, its hue: none); the rest is empty.
for (const cell of CELLS) {
  const w = 8 * cell, h = 8 * cell;
  const out = ditherRGBA(solid(w, h, [128, 128, 128, 255]), w, h, { cell });
  let lit = 0;
  for (let cy = 0; cy < 8; cy++) for (let cx = 0; cx < 8; cx++) {
    const first = at(out, w, cx * cell, cy * cell);
    // A cell is one block: every pixel of it as its first one.
    for (let y = 0; y < cell; y++) for (let x = 0; x < cell; x++) assert.deepEqual(at(out, w, cx * cell + x, cy * cell + y), first);
    if (first[3]) { lit++; assert.deepEqual(first, [255, 255, 255, 255]); } else assert.deepEqual(first, [0, 0, 0, 0], "unlit: transparent");
  }
  assert.equal(lit, 32, `cell ${cell}: half the cells`);
}
// The photo's hue, pushed to full brightness.
assert.deepEqual(at(ditherRGBA(solid(4, 4, [200, 100, 0, 255]), 4, 4, { cell: 2 }), 4, 0, 0), [255, 128, 0, 255]);
// The project's tint: the cells inked take it; the tone is the luminance (a pure blue is dark).
const tinted = ditherRGBA(solid(8, 8, [255, 255, 255, 255]), 8, 8, { cell: 2, tint: "#D4825D" });
assert.deepEqual(at(tinted, 8, 0, 0), [0xd4, 0x82, 0x5d, 255]);
const blue = ditherRGBA(solid(8, 8, [0, 0, 255, 255]), 8, 8, { cell: 2, tint: "#ffffff" });
assert.equal([0, 2, 4, 6].flatMap((x) => [0, 2, 4, 6].map((y) => at(blue, 8, x, y)[3])).filter(Boolean).length, 1, "luminance 0.07: one cell of 16");
// A transparent pixel stays transparent.
assert.deepEqual(at(ditherRGBA(solid(4, 4, [255, 255, 255, 0]), 4, 4, { cell: 2 }), 4, 0, 0), [0, 0, 0, 0]);
// Sizes that are not a multiple of the cell: the last cells are cut, nothing overflows.
assert.equal(ditherRGBA(solid(5, 3, [255, 255, 255, 255]), 5, 3, { cell: 2 }).length, 5 * 3 * 4);

assert.equal(outName("abcd1234", 2, null), "bg-abcd1234-2-photo.png");
assert.equal(outName("abcd1234", 4, "#D4825D"), "bg-abcd1234-4-d4825d.png");

// The CLI, end to end: a 3000×1200 gradient (resized to 2048 px wide), its source copy and its
// dithered PNG, then the same again from the copy (same hash, nothing rewritten), then a tint.
const MAGICK = `${process.env.HOME}/.nix-profile/bin/magick`;
const dir = mkdtempSync(join(tmpdir(), "kt-chat-bg-"));
try {
  const input = join(dir, "in.png");
  assert.equal(Bun.spawnSync([MAGICK, "-size", "3000x1200", "gradient:#204080-#f0c060", input]).exitCode, 0);
  const cli = (...a) => JSON.parse(new TextDecoder().decode(Bun.spawnSync([process.execPath, new URL("./chat-bg.ts", import.meta.url).pathname, ...a]).stdout));
  const a = cli(input, "--out", dir);
  assert.deepEqual([a.w, a.h], [2048, 819]);
  assert.ok(a.src.endsWith(".png") && a.path.endsWith("-2-photo.png"));
  const size = new TextDecoder().decode(Bun.spawnSync([MAGICK, "identify", "-format", "%w %h %[channels]", a.path]).stdout);
  assert.match(size, /^2048 819 srgba/);
  const opaque = Number(new TextDecoder().decode(Bun.spawnSync([MAGICK, a.path, "-alpha", "extract", "-format", "%[fx:mean]", "info:"]).stdout));
  assert.ok(opaque > 0.05 && opaque < 0.95, `some cells lit, some transparent (${opaque})`);
  const b = cli(a.src, "--out", dir);
  assert.equal(b.path, a.path, "the kept copy dithers to the same name (same hash)");
  const c = cli(a.src, "--out", dir, "--cell", "4", "--tint", "#D4825D");
  assert.ok(c.path.endsWith("-4-d4825d.png"));
  assert.equal(readdirSync(dir).filter((f) => f.startsWith("src-")).length, 1, "one source copy");
  assert.deepEqual(cli(join(dir, "missing.png"), "--out", dir).error, "image");
} finally {
  // Its own files, one by one (in.png, src-*, bg-*), then the empty folder: no recursive removal.
  for (const f of readdirSync(dir)) if (f === "in.png" || /^(src|bg)-[0-9a-f]{8}/.test(f)) unlinkSync(join(dir, f));
  rmdirSync(dir);
}

console.log("chat-bg ok");
