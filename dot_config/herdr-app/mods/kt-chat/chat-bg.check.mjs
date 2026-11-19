// bun ~/.config/herdr-app/mods/kt-chat/chat-bg.check.mjs: chat-bg.ts, a project's Chat background
// (#57, #87): the Bayer matrix is viz.js', cells are whole blocks of `cell` px, unlit ones transparent,
// the photo's hue at full brightness or the project's tint, the dither unchanged pixel for pixel by
// #87; Monocode's ASCII, Halftone, Scanlines and Haze on made-up images; and the CLI end to end on
// generated images (magick) in a temporary folder.
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, readdirSync, rmdirSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { BAYER4, inked, ditherRGBA, outName, CELLS, GLYPHS, asciiRGBA, halftoneRGBA, scanlinesRGBA, hazeRGBA, hazeSigmas, fxName, EFFECTS, DARK_GROUND } from "./chat-bg.ts";

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

// #87 leaves the dither as it was, pixel for pixel: the hashes of the commit 5c3c124's ditherRGBA on a
// fixed pseudo-random image, each cell and tint.
const noise = (w, h) => { const px = new Uint8Array(w * h * 4); let s = 7; for (let i = 0; i < px.length; i++) { s = (s * 1103515245 + 12345) & 0x7fffffff; px[i] = s >> 23; } return px; };
const sha1 = (px) => new Bun.CryptoHasher("sha1").update(px).digest("hex");
const N = noise(97, 61);
for (const [cell, tint, hash] of [
  [2, null, "a5105f1b9938e83fa33adf03bc6dde0ae9700877"], [4, null, "3ae3e739dbbf72b70523799a95ea319b147a6a94"],
  [6, null, "55fe2bfc86ec2d26578e76250f19823d9b675650"], [2, "#d4825d", "31c27ceeae0b54e92957e839a275a8a55bfff16d"],
  [4, "#ffffff", "0a23fdc4d94e24fc43aa9653c9b6305e11fc3cc4"],
]) assert.equal(sha1(ditherRGBA(N, 97, 61, { cell, tint })), hash, `the dither unchanged, cell ${cell} ${tint ?? "photo"}`);

// ── ASCII (project_appearance.rs:430-441, 465-474) ──────────────────────────
// A grey of v: luma v, the glyph ⌊√(v / 255) · 9⌋; a stroke gives v (0.6 v + 0.4 v), the rest 0.6 v.
assert.equal(GLYPHS.length, 10);
const grey = (w, h, v, a = 255) => solid(w, h, [v, v, v, a]);
const white = asciiRGBA(grey(12, 16, 255), 12, 16);
// « @ » (glyph 9), its first row 01110: columns 1 to 3.
assert.deepEqual([0, 1, 2, 3, 4].map((x) => at(white, 12, x, 0)[0]), [153, 255, 255, 255, 153]);
for (let y = 0; y < 16; y++) assert.equal(at(white, 12, 5, y)[0], 153, "the 6th column: the space between glyphs");
for (let x = 0; x < 12; x++) assert.equal(at(white, 12, x, 7)[0], 153, "the 8th row: the space between lines");
assert.equal(at(white, 12, 6, 8)[0], 153, "the next cell: the same glyph, same place");
assert.equal(at(white, 12, 7, 8)[0], 255);
assert.equal(at(white, 12, 1, 0)[3], 255, "alpha as it was");
// A grey of 64: glyph ⌊√(64/255) · 9⌋ = 4, « = », two strokes on rows 2 and 4.
const g64 = asciiRGBA(grey(6, 8, 64), 6, 8);
for (let y = 0; y < 7; y++) assert.equal(at(g64, 6, 2, y)[0], y === 2 || y === 4 ? 64 : 38, `row ${y}`);
// Black: the blank glyph, all 0.
assert.ok(asciiRGBA(grey(6, 8, 0), 6, 8).every((v, i) => i % 4 === 3 || v === 0));
// The cell's color is read at its centre (+3, +4): a red centre in a blue cell gives red strokes.
const mixed = grey(6, 8, 0);
mixed.set([255, 255, 255, 255], (4 * 6 + 3) * 4);
assert.deepEqual(at(asciiRGBA(mixed, 6, 8), 6, 1, 0), [102, 102, 102, 255], "0.6 × 0 + 0.4 × 255 on a stroke of « @ »");

// ── Halftone (l.475-483) ────────────────────────────────────────────────────
const ht = halftoneRGBA(grey(8, 8, 255), 8, 8);
// White: radius 2. At (1, 1) the dot covers it all (255); at (3, 3), 2.12 from the centre: 0.38.
assert.equal(at(ht, 8, 1, 1)[0], 255);
assert.equal(at(ht, 8, 3, 3)[0], Math.round(153 + 255 * (2.5 - Math.hypot(1.5, 1.5)) * 0.4));
assert.equal(at(ht, 8, 5, 5)[0], 255, "the next cell, the same dot");
// Black: radius 0.6, no color to add.
assert.ok(halftoneRGBA(grey(8, 8, 0), 8, 8).every((v, i) => i % 4 === 3 || v === 0));
// A transparent dot adds nothing: the image at 0.6.
assert.equal(at(halftoneRGBA(grey(4, 4, 200, 0), 4, 4), 4, 1, 1)[0], 120);
// The radius comes from the cell's corner, the color from its (+2, +2).
const corner = grey(4, 4, 0);
corner.set([255, 255, 255, 255], (2 * 4 + 2) * 4);
assert.equal(at(halftoneRGBA(corner, 4, 4), 4, 1, 1)[0], Math.round(255 * Math.min(1, 0.6 + 0.5 - Math.hypot(0.5, 0.5)) * 0.4), "a dark corner: the smallest dot");

// ── Scanlines (l.484-490) ───────────────────────────────────────────────────
const sl = scanlinesRGBA(grey(2, 7, 200), 2, 7);
assert.deepEqual([0, 1, 2, 3, 4, 5, 6].map((y) => at(sl, 2, 1, y)[0]), [104, 200, 200, 104, 200, 200, 104]);
assert.equal(at(sl, 2, 0, 0)[3], 255);

// ── Haze (l.400-423, 491-513) ───────────────────────────────────────────────
assert.deepEqual(hazeSigmas(false), [5, 12]);
assert.deepEqual(hazeSigmas(true), [7, 18]);
// The image 200, its soft blur 100, its strong one 0, 100 rows shown, Monocode's ground (23).
const hz = (opts, h = 100) => hazeRGBA(grey(1, h, 200), grey(1, h, 100), grey(1, h, 0), 1, h, opts);
let hv = hz({ rows: 100 });
assert.equal(at(hv, 1, 0, 1)[0], 200, "at the top: the image");
assert.equal(at(hv, 1, 0, 0)[0], Math.round(200 * 0.64 + 23 * 0.36), "its display lines, even at the top");
assert.equal(at(hv, 1, 0, 98)[0], Math.round(23 * 0.7), "at the bottom: the strong blur, darkened 0.70");
assert.equal(at(hv, 1, 0, 99)[0], Math.round(23 * (1 - 0.3 * 0.64)));
// Halfway (t = 0.5, a session): soft 0.615, strong 0.519, darken 0.402.
const t = 0.5, s1 = (t - 0.18) / 0.52, s2 = (t - 0.22) / 0.54, dk = ((t - 0.15) / 0.61) * 0.7;
assert.equal(at(hv, 1, 0, 50)[0], Math.round(((200 * (1 - s1) + 100 * s1) * (1 - s2)) * (1 - dk) + 23 * dk));
// An empty conversation: the strong blur starts later (0.28), the darkening goes further (0.78).
const he = hz({ rows: 100, empty: true });
assert.ok(at(he, 1, 0, 31)[0] > at(hv, 1, 0, 31)[0], "t = 0.31: less of the strong blur");
assert.equal(at(he, 1, 0, 98)[0], Math.round(23 * 0.78));
// Against the view: 50 rows shown, the bottom of the view is reached at row 50, not 100.
assert.equal(at(hz({ rows: 50 }), 1, 0, 49)[0], at(hv, 1, 0, 98)[0]);
assert.equal(at(hz({ rows: 50 }), 1, 0, 98)[0], at(hv, 1, 0, 98)[0], "below the view: as at its bottom");
// A light theme darkens toward its own ground.
assert.equal(at(hz({ rows: 100, ground: "#f5f5f5" }), 1, 0, 98)[0], Math.round(245 * 0.7));
assert.equal(DARK_GROUND, "#171717", "23, 23, 23");

// Every effect keeps the size and the alpha, and changes the pixels (Monocode's
// effects_keep_cover_dimensions_fade_and_change_pixels).
const grad = new Uint8Array(64 * 48 * 4);
for (let y = 0; y < 48; y++) for (let x = 0; x < 64; x++) grad.set([x * 4, y * 5, 90, 255], (y * 64 + x) * 4);
for (const [name, out] of [["ascii", asciiRGBA(grad, 64, 48)], ["halftone", halftoneRGBA(grad, 64, 48)], ["scanlines", scanlinesRGBA(grad, 64, 48)], ["haze", hazeRGBA(grad, grad, grad, 64, 48)]]) {
  assert.equal(out.length, grad.length, name);
  assert.ok(out.every((v, i) => i % 4 !== 3 || v === 255), `${name}: alpha kept`);
  assert.notDeepEqual(out, grad, name);
}

assert.deepEqual(EFFECTS, ["dither", "ascii", "halftone", "scanlines", "haze"]);
const view = await import("./chat-view.js");
assert.deepEqual(view.EFFECTS, EFFECTS, "the mod's list is chat-bg.ts'");
assert.equal(view.HAZE_DARK, DARK_GROUND, "and its dark ground");
assert.equal(fxName("abcd1234", "ascii"), "fx-abcd1234-ascii.png");
assert.equal(fxName("abcd1234", "haze", { empty: true, rows: 768, ground: "#F5F5F5" }), "fx-abcd1234-haze-empty-768-f5f5f5.png");
assert.equal(fxName("abcd1234", "haze", { rows: 896 }), "fx-abcd1234-haze-session-896-171717.png");

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
  // #87: each effect from the kept copy, its name, the image's size, opaque (the photo kept at 0.6).
  const hash = a.src.match(/src-([0-9a-f]{8})/)[1];
  for (const effect of ["ascii", "halftone", "scanlines"]) {
    const r = cli(a.src, "--out", dir, "--effect", effect);
    assert.equal(r.path, join(dir, `fx-${hash}-${effect}.png`));
    assert.match(new TextDecoder().decode(Bun.spawnSync([MAGICK, "identify", "-format", "%w %h", r.path]).stdout), /^2048 819/);
  }
  const hz1 = cli("--empty", a.src, "--out", dir, "--effect", "haze", "--rows", "640", "--ground", "#F5F5F5");
  assert.equal(hz1.path, join(dir, `fx-${hash}-haze-empty-640-f5f5f5.png`), "a flag before the image is not the image");
  assert.equal(cli(a.src, "--out", dir, "--effect", "haze").path, join(dir, `fx-${hash}-haze-session-819-171717.png`), "no rows: the image's height, Monocode's ground");
  assert.equal(cli(a.src, "--out", dir, "--effect", "haze", "--rows", "99999").path, join(dir, `fx-${hash}-haze-session-819-171717.png`), "never more rows than the image");
  assert.equal(cli(a.src, "--out", dir, "--effect", "nope").path, a.path, "an unknown effect: the dither");
  // The Haze's blurs at a quarter of the size stay within 1 % (RMSE) of the full blur, on a detailed image.
  const plasma = join(dir, "plasma.png"), full = join(dir, "full.png"), quarter = join(dir, "quarter.png");
  Bun.spawnSync([MAGICK, "-size", "512x512", "-seed", "7", "plasma:fractal", "-blur", "0x2", "-depth", "8", plasma]);
  for (const sigma of [5, 12, 18]) {
    Bun.spawnSync([MAGICK, plasma, "-blur", `0x${sigma}`, full]);
    Bun.spawnSync([MAGICK, plasma, "-resize", "25%", "-blur", `0x${sigma / 4}`, "-resize", "512x512!", quarter]);
    const rmse = Number(new TextDecoder().decode(Bun.spawnSync([MAGICK, "compare", "-metric", "RMSE", full, quarter, "null:"]).stderr).match(/\(([\d.e-]+)\)/)?.[1]);
    assert.ok(rmse < 0.01, `σ ${sigma}: a quarter's blur ${(rmse * 100).toFixed(2)} % from the full one`);
  }
} finally {
  // Its own files, one by one (in.png, plasma, full, quarter, src-*, bg-*, fx-*), then the empty
  // folder: no recursive removal.
  for (const f of readdirSync(dir)) if (["in.png", "plasma.png", "full.png", "quarter.png"].includes(f) || /^(src|bg|fx)-[0-9a-f]{8}/.test(f)) unlinkSync(join(dir, f));
  rmdirSync(dir);
}

console.log("chat-bg ok");
