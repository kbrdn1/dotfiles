// bun chat-bg.ts <image> --out <dir> [--effect E] [--cell N] [--tint #rrggbb] [--empty] [--rows R] [--ground #rrggbb]
//
// A project's Chat background (#57, #87), made once: the image, turned and brought to 2048 px at most,
// kept as src-<hash>.png in <dir> (the original may go: later settings re-make from this copy), then
// its texture for the effect E (dither by default):
// - dither: bg-<hash>-<cell>-<tint|photo>.png;
// - ascii, halftone, scanlines: fx-<hash>-<effect>.png;
// - haze: fx-<hash>-haze-<empty|session>-<rows>-<ground>.png (it depends on the view: see hazeRGBA).
// Prints { src, path, w, h } or { error, message }. magick (nix) by its path: exec's PATH has no
// ~/.nix-profile. The fade belongs to the view (kt-chat draws it in steps), not to the texture.
//
// The effects are Monocode's (crates/monocode-core/src/project_appearance.rs, effect_pixels, l.391-517,
// at 09d0443; read in the copy chat-research left, scratchpad chat-research/src/project_appearance.rs),
// run at the image's resolution as there (background_texture, l.302-308):
// - the dither, adapted (#57): cells of `cell` px sampled at their centre, inked when their tone beats
//   the Bayer 4×4 threshold of viz.js (inked()); an inked cell takes the photo's hue at full brightness
//   (photo) or the project's color (tint), an unlit one is transparent (Monocode: ×0.08, a near-black
//   veil on a light theme; the brand assets, brand/dither.py, leave it empty);
// - ASCII, Halftone, Scanlines: as written there (asciiRGBA, halftoneRGBA, scanlinesRGBA);
// - Haze: the software path's (l.312-323, 400-423, 491-513). On a Mac, Monocode does it in its Metal
//   compositor against the view, in a shader that isn't in the code read: here it is baked against the
//   rows the view shows (`--rows`, kt-chat's steps of 128), its two blurs made at a quarter of the size
//   by magick (the full blur at σ 18 took 3.2 s on 2048², a quarter 0.4 s, 0.07 % RMSE apart), and it
//   darkens toward `--ground`: Monocode's 23,23,23 in a dark theme, the light theme's own ground there.
//
// Adapted from Monocode (github.com/hardbeat920/monocode, MIT, Copyright (c) 2026 Nick).
// Permission is hereby granted, free of charge, to any person obtaining a copy of this software and
// associated documentation files (the "Software"), to deal in the Software without restriction,
// including without limitation the rights to use, copy, modify, merge, publish, distribute,
// sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions: The above copyright notice and this
// permission notice shall be included in all copies or substantial portions of the Software.
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT
// NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
// NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES
// OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
// CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

/** viz.js' BAYER4 (chat-bg.check.mjs reads it there and compares). */
export const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
/** viz.js' inked(): a tone of 0.25 inks exactly a quarter of the cells. */
export const inked = (col: number, row: number, tone: number) => tone > (BAYER4[(row & 3) * 4 + (col & 3)] + 0.5) / 16;

export const CELLS = [2, 4, 6];
export const MAX = 2048;
export const EFFECTS = ["dither", "ascii", "halftone", "scanlines", "haze"];
/** Monocode's dark ground, the Haze darkens toward it (project_appearance.rs:511). */
export const DARK_GROUND = "#171717";

const hex = (c: string) => {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i.exec(c ?? "");
  return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : null;
};
const u8 = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/**
 * RGBA in, RGBA out, same size. `cell`: the cell's side in px (2, 4, 6). `tint`: "#rrggbb" for the
 * project's color (the tone is then the cell's luminance), null for the photo's own hue (the tone is
 * its brightest channel, as Monocode).
 */
export function ditherRGBA(src: Uint8Array, w: number, h: number, { cell = 2, tint = null as string | null } = {}) {
  const out = new Uint8Array(w * h * 4);
  const ink = tint ? hex(tint) : null;
  const half = cell >> 1;
  for (let cy = 0; cy * cell < h; cy++) {
    for (let cx = 0; cx * cell < w; cx++) {
      const sx = Math.min(w - 1, cx * cell + half), sy = Math.min(h - 1, cy * cell + half);
      const s = (sy * w + sx) * 4;
      const [r, g, b, a] = [src[s], src[s + 1], src[s + 2], src[s + 3]];
      const peak = Math.max(r, g, b);
      const tone = ink ? (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 : peak / 255;
      if (!a || !inked(cx, cy, tone)) continue; // unlit: transparent
      const lift = (c: number) => Math.round((c * 255) / Math.max(peak, 1));
      const px = ink ?? [lift(r), lift(g), lift(b)];
      for (let y = cy * cell; y < Math.min(h, cy * cell + cell); y++) {
        for (let x = cx * cell; x < Math.min(w, cx * cell + cell); x++) {
          const o = (y * w + x) * 4;
          out[o] = px[0];
          out[o + 1] = px[1];
          out[o + 2] = px[2];
          out[o + 3] = a;
        }
      }
    }
  }
  return out;
}

// ── Monocode's other effects (effect_pixels) ────────────────────────────────

/** Where (x, y) is in `src`, clamped to its edges (`sample`, l.442). */
const at = (w: number, h: number, x: number, y: number) => (Math.min(y, h - 1) * w + Math.min(x, w - 1)) * 4;
/** Rec. 709 luma, rounded (l.443-445). */
const luma = (s: Uint8Array, o: number) => Math.round(s[o] * 0.2126 + s[o + 1] * 0.7152 + s[o + 2] * 0.0722);

/** The ASCII ramp (l.430-441): 5×7 bitmaps, a row's bit 4 the left column. Blank . : - = + * # % @. */
export const GLYPHS = [
  [0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 4, 0], [0, 4, 0, 0, 4, 0, 0], [0, 0, 0, 14, 0, 0, 0], [0, 0, 14, 0, 14, 0, 0],
  [0, 4, 4, 31, 4, 4, 0], [0, 21, 14, 31, 14, 21, 0], [10, 10, 31, 10, 31, 10, 10], [17, 2, 4, 4, 8, 16, 17], [14, 17, 23, 21, 23, 16, 14],
];

/**
 * ASCII (l.465-474): 6×8 cells read at their centre (+3, +4); the glyph ⌊√(luma / 255) · 9⌋, its 6th
 * column and 8th row left blank; the image at 0.6, plus 0.4 of the cell's color on the glyph's strokes.
 */
export function asciiRGBA(src: Uint8Array, w: number, h: number) {
  const out = new Uint8Array(src);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = at(w, h, Math.floor(x / 6) * 6 + 3, Math.floor(y / 8) * 8 + 4);
      const glyph = GLYPHS[Math.floor(Math.sqrt(luma(src, p) / 255) * 9)];
      const ink = x % 6 < 5 && y % 8 < 7 && (glyph[y % 8] & (1 << (4 - (x % 6)))) !== 0;
      const o = (y * w + x) * 4;
      for (let c = 0; c < 3; c++) out[o + c] = u8(src[o + c] * 0.6 + (ink ? src[p + c] * 0.4 : 0));
    }
  }
  return out;
}

/**
 * Halftone (l.475-483): 4 px cells, a dot of radius 2 · (0.3 + 0.7 · √(luma / 255)) (the luma at the
 * cell's corner) centred at (1.5, 1.5), its color read at (+2, +2); antialiased over half a pixel,
 * times the color's alpha; the image at 0.6, plus 0.4 of the dot.
 */
export function halftoneRGBA(src: Uint8Array, w: number, h: number) {
  const out = new Uint8Array(src);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const cx = Math.floor(x / 4) * 4, cy = Math.floor(y / 4) * 4;
      const radius = 2 * (0.3 + 0.7 * Math.sqrt(luma(src, at(w, h, cx, cy)) / 255));
      const p = at(w, h, cx + 2, cy + 2);
      const distance = Math.hypot((x % 4) - 1.5, (y % 4) - 1.5);
      const coverage = clamp01(radius + 0.5 - distance) * src[p + 3] / 255;
      const o = (y * w + x) * 4;
      for (let c = 0; c < 3; c++) out[o + c] = u8(src[o + c] * 0.6 + src[p + c] * coverage * 0.4);
    }
  }
  return out;
}

/** Scanlines (l.484-490): one row in three (y % 3 = 0) at 0.52. */
export function scanlinesRGBA(src: Uint8Array, w: number, h: number) {
  const out = new Uint8Array(src);
  for (let y = 0; y < h; y += 3) {
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4;
      for (let c = 0; c < 3; c++) out[o + c] = u8(src[o + c] * 0.52);
    }
  }
  return out;
}

/** The Haze's two blurs, σ in image px (l.400-423): session 5 and 12, an empty conversation 7 and 18. */
export const hazeSigmas = (empty: boolean) => (empty ? [7, 18] : [5, 12]);

/**
 * Haze (l.491-513), from the image and its two blurs (`soft`, `strong`, same size): down the rows the
 * view shows (`rows`: at = y / rows, Monocode's y / height of the view), the soft blur mixes in from
 * 18 %, the strong one after it, and the image darkens toward `ground` (0.70 at most, 0.78 when
 * empty), one row in three more (1 − (1 − darken) · 0.64): its own display lines.
 */
export function hazeRGBA(src: Uint8Array, soft: Uint8Array, strong: Uint8Array, w: number, h: number, { empty = false, rows = h, ground = DARK_GROUND } = {}) {
  const out = new Uint8Array(src);
  const g = hex(ground) ?? [23, 23, 23];
  const span = Math.max(1, rows);
  for (let y = 0; y < h; y++) {
    const t = y / span;
    const softMix = clamp01((t - 0.18) / (empty ? 0.42 : 0.52));
    const strongMix = clamp01((t - (empty ? 0.28 : 0.22)) / (empty ? 0.48 : 0.54));
    const darken = empty ? clamp01((t - 0.16) / 0.59) * 0.78 : clamp01((t - 0.15) / 0.61) * 0.7;
    const mix = y % 3 === 0 ? 1 - (1 - darken) * 0.64 : darken;
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4;
      for (let c = 0; c < 3; c++) {
        const a = src[o + c] * (1 - softMix) + soft[o + c] * softMix;
        const b = a * (1 - strongMix) + strong[o + c] * strongMix;
        out[o + c] = u8(b * (1 - mix) + g[c] * mix);
      }
    }
  }
  return out;
}

/** The output's name: the source's hash, the cell, the tint (without #) or « photo ». */
export const outName = (hash: string, cell: number, tint: string | null) => `bg-${hash}-${cell}-${tint ? tint.replace("#", "").toLowerCase() : "photo"}.png`;

/** An effect's texture name (not the dither's: outName). */
export function fxName(hash: string, effect: string, { empty = false, rows = 0, ground = DARK_GROUND } = {}) {
  if (effect !== "haze") return `fx-${hash}-${effect}.png`;
  return `fx-${hash}-haze-${empty ? "empty" : "session"}-${rows}-${ground.replace("#", "").slice(0, 6).toLowerCase()}.png`;
}

async function run(cmd: string[], stdin?: Uint8Array) {
  const p = Bun.spawn(cmd, { stdin: stdin ? "pipe" : "ignore", stdout: "pipe", stderr: "pipe" });
  if (stdin) {
    p.stdin!.write(stdin);
    await p.stdin!.end();
  }
  const [out, err, code] = await Promise.all([new Response(p.stdout).arrayBuffer(), new Response(p.stderr).text(), p.exited]);
  if (code !== 0) throw new Error(err.trim().split("\n").slice(-2).join(" ") || `exit ${code}`);
  return new Uint8Array(out);
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const opt = (flag: string) => {
    const i = args.indexOf(flag);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const valued = new Set(["--out", "--cell", "--tint", "--effect", "--rows", "--ground"]);
  const image = args.find((a, i) => !a.startsWith("--") && !valued.has(args[i - 1]));
  const dir = opt("--out");
  const effect = EFFECTS.includes(opt("--effect") ?? "") ? opt("--effect")! : "dither";
  const cell = CELLS.includes(Number(opt("--cell"))) ? Number(opt("--cell")) : 2;
  const tint = hex(opt("--tint") ?? "") ? `#${(opt("--tint") ?? "").replace("#", "").slice(0, 6).toLowerCase()}` : null;
  const empty = args.includes("--empty");
  const ground = hex(opt("--ground") ?? "") ? `#${(opt("--ground") ?? "").replace("#", "").slice(0, 6).toLowerCase()}` : DARK_GROUND;
  const say = (o: object) => process.stdout.write(JSON.stringify(o));
  if (!image || !dir) {
    say({ error: "usage" });
    process.exit(2);
  }
  const MAGICK = `${process.env.HOME}/.nix-profile/bin/magick`;
  try {
    // [0]: the first frame (a gif, a pdf page); -auto-orient: a phone's photo upright; 2048 px at most.
    const prep = [`${image}[0]`, "-auto-orient", "-resize", `${MAX}x${MAX}>`];
    const dims = new TextDecoder().decode(await run([MAGICK, ...prep, "-format", "%w %h", "info:"])).trim().split(/\s+/).map(Number);
    const [w, h] = dims;
    if (!(w > 0 && h > 0)) throw new Error("no size");
    const raw = await run([MAGICK, ...prep, "-depth", "8", "rgba:-"]);
    if (raw.length !== w * h * 4) throw new Error(`expected ${w * h * 4} bytes, got ${raw.length}`);
    const hash = new Bun.CryptoHasher("sha1").update(raw).digest("hex").slice(0, 8);
    const src = `${dir}/src-${hash}.png`;
    if (!(await Bun.file(src).exists())) await run([MAGICK, "-size", `${w}x${h}`, "-depth", "8", "rgba:-", src], raw);
    // The view's rows, in image px, never more than the image: at = y / rows.
    const rows = Math.max(1, Math.min(h, Math.round(Number(opt("--rows")) || h)));
    const path = `${dir}/${effect === "dither" ? outName(hash, cell, tint) : fxName(hash, effect, { empty, rows, ground })}`;
    if (!(await Bun.file(path).exists())) {
      let pixels: Uint8Array;
      if (effect === "ascii") pixels = asciiRGBA(raw, w, h);
      else if (effect === "halftone") pixels = halftoneRGBA(raw, w, h);
      else if (effect === "scanlines") pixels = scanlinesRGBA(raw, w, h);
      else if (effect === "haze") {
        // Each blur at a quarter of the size (σ / 4), brought back to w × h: what the full blur gives.
        const blur = (sigma: number) => run([MAGICK, src, "-resize", "25%", "-blur", `0x${sigma / 4}`, "-resize", `${w}x${h}!`, "-depth", "8", "rgba:-"]);
        const [s1, s2] = hazeSigmas(empty);
        const [soft, strong] = await Promise.all([blur(s1), blur(s2)]);
        pixels = hazeRGBA(raw, soft, strong, w, h, { empty, rows, ground });
      } else pixels = ditherRGBA(raw, w, h, { cell, tint });
      await run([MAGICK, "-size", `${w}x${h}`, "-depth", "8", "rgba:-", path], pixels);
    }
    say({ src, path, w, h });
  } catch (e) {
    say({ error: "image", message: String((e as Error)?.message ?? e).slice(0, 300) });
  }
}
