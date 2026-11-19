// bun chat-bg.ts <image> --out <dir> [--cell N] [--tint #rrggbb]
//
// A project's Chat background (#57), made once: the image, turned and brought to 2048 px at most,
// kept as src-<hash>.png in <dir> (the original may go: later settings re-dither this copy), then
// dithered into bg-<hash>-<cell>-<tint|photo>.png. Prints { src, path, w, h } or { error, message }.
// magick (nix) by its path: exec's PATH has no ~/.nix-profile.
//
// The dither is Monocode's « Dither » (crates/monocode-core/src/project_appearance.rs, effect_pixels),
// adapted: cells of `cell` px sampled at their centre, inked when their tone beats the Bayer 4×4
// threshold of viz.js (inked()); an inked cell takes the photo's hue at full brightness (photo) or the
// project's color (tint), an unlit one is transparent (Monocode: ×0.08, a near-black veil on a light
// theme; the brand assets, brand/dither.py, leave it empty). The fade belongs to the view (kt-chat
// draws it in steps), not to the texture.
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

const hex = (c: string) => {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i.exec(c ?? "");
  return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : null;
};

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

/** The output's name: the source's hash, the cell, the tint (without #) or « photo ». */
export const outName = (hash: string, cell: number, tint: string | null) => `bg-${hash}-${cell}-${tint ? tint.replace("#", "").toLowerCase() : "photo"}.png`;

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
  const image = args.find((a, i) => !a.startsWith("--") && !args[i - 1]?.startsWith("--"));
  const dir = opt("--out");
  const cell = CELLS.includes(Number(opt("--cell"))) ? Number(opt("--cell")) : 2;
  const tint = hex(opt("--tint") ?? "") ? `#${(opt("--tint") ?? "").replace("#", "").slice(0, 6).toLowerCase()}` : null;
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
    const path = `${dir}/${outName(hash, cell, tint)}`;
    if (!(await Bun.file(path).exists())) await run([MAGICK, "-size", `${w}x${h}`, "-depth", "8", "rgba:-", path], ditherRGBA(raw, w, h, { cell, tint }));
    say({ src, path, w, h });
  } catch (e) {
    say({ error: "image", message: String((e as Error)?.message ?? e).slice(0, 300) });
  }
}
