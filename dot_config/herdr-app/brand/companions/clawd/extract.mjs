// bun brand/companions/clawd/extract.mjs : Clawd, the Claude Code mascot (© Anthropic), for the Claude agent's
// runner above the Chat composer. This file holds NO pixel and no table of Clawd: it reads Anthropic's own
// animations on this machine and writes the poses under data/companions/clawd/ (ignored by chezmoi and git,
// never redistributed). See CREDITS.md. Without them the runner falls back on Ember.
//
// Sources (none is copied into the repo):
//   the Claude desktop app: clawd-laptop.webm (it types), clawd-magnifier.gif (it reads);
//   claude.ai: Clawd-JumpingHappy.gif (standing, and the jump of « fini »).
// Each pose is the frame shown at a given time of its source (ms, read on the 2026-11-19 sources), sampled
// on Clawd's own grid: half of one of his pixels (his finest detail), so one cell = one css px in the runner.
// The pitch comes from each source's standing frame, 24 cells wide. Derived poses (look, error) move or
// close the eyes of an extracted pose: geometry, no drawing.
//   bun extract.mjs            extract (keeps the previous poses if a source is missing or changed)
//   bun extract.check.mjs      fails if an expected pose is missing
import { spawnSync } from "bun";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";

const APP = "/Applications/Claude.app/Contents/Resources/ion-dist/images/install-hub";
export const SOURCES = {
  jump: { url: "https://claude.ai/images/clawd/core/Clawd-JumpingHappy.gif", stand: 0 },
  laptop: { file: `${APP}/clawd-laptop.webm`, stand: 0, vp9: true },
  magnifier: { file: `${APP}/clawd-magnifier.gif`, stand: 0 },
};
// pose -> [source, ms]: the frame that starts at that time (ffmpeg's -ss gives the first frame at or after it;
// 5 ms early absorbs the rounding of GIF delays)
export const TAKEN = {
  idle: ["jump", 0],
  // the jump of « fini », in 4: crouched, at the top (happy eyes), coming down, landed
  "done-0": ["jump", 325], "done-1": ["jump", 575], "done-2": ["jump", 995], "done-3": ["jump", 1165],
  "type-0": ["laptop", 1907], "type-1": ["laptop", 2073],
  "read-0": ["magnifier", 2575], "read-1": ["magnifier", 4745],
};
// pose -> [base pose, how]
export const DERIVED = { "look-0": ["idle", "left"], "look-1": ["idle", "right"], error: ["done-0", "closed"] };
export const POSES = [...Object.keys(TAKEN), ...Object.keys(DERIVED)];
export const SCALES = [1, 2, 3, 4];
const STAND_W = 24, STAND_H = 16; // Clawd standing, arms out, in cells

/** The Herdr home: HERDR_APP_HOME when set and not empty (an empty one would aim at the root). */
export const homeOf = (env) => env.HERDR_APP_HOME || `${env.HOME}/.config/herdr-app`;
export const OUT = `${homeOf(process.env)}/data/companions/clawd`;

// ---------- pure: pixels in, cells out ----------

/** The opaque box of an RGBA frame, or null. */
export function bbox({ w, h, px }) {
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (px[(y * w + x) * 4 + 3] >= 128) {
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  return x1 < 0 ? null : { x0, y0, x1, y1 };
}

/** Pitch and anchor from the standing frame: { pitch, ox, oy } (oy: the bottom of the feet), or an error. */
export function calibrate(stand) {
  const b = bbox(stand);
  if (!b) return { error: "standing frame is empty" };
  const pw = (b.x1 + 1 - b.x0) / STAND_W, ph = (b.y1 + 1 - b.y0) / STAND_H;
  if (Math.abs(pw - ph) > pw * 0.04) return { error: `standing frame is not ${STAND_W}x${STAND_H} cells (${pw.toFixed(1)} vs ${ph.toFixed(1)} px)` };
  return { pitch: (pw + ph) / 2, ox: b.x0, oy: b.y1 + 1 };
}

/** The cell window covering all frames, anchored on the standing frame's bottom-left. */
export function window(frames, { pitch, ox, oy }) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const f of frames) { const b = bbox(f); if (b) { x0 = Math.min(x0, b.x0); y0 = Math.min(y0, b.y0); x1 = Math.max(x1, b.x1); y1 = Math.max(y1, b.y1); } }
  const left = Math.max(0, Math.ceil((ox - x0) / pitch - 0.05)), up = Math.max(0, Math.ceil((oy - y0) / pitch - 0.05));
  const right = Math.max(0, Math.ceil((x1 + 1 - ox) / pitch - 0.05)), down = Math.max(0, Math.ceil((y1 + 1 - oy) / pitch - 0.05));
  return { pitch, gx: ox - left * pitch, gy: oy - up * pitch, cols: left + right, rows: up + down, anchor: [left, up] };
}

const dist = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
/** Each cell's centre: -1 transparent, else the index of the nearest palette colour (the video's colours drift). */
export function sample(frame, win, palette) {
  const g = [];
  for (let r = 0; r < win.rows; r++) {
    const row = [];
    for (let c = 0; c < win.cols; c++) {
      const x = Math.floor(win.gx + (c + 0.5) * win.pitch), y = Math.floor(win.gy + (r + 0.5) * win.pitch);
      const i = (y * frame.w + x) * 4;
      if (x < 0 || y < 0 || x >= frame.w || y >= frame.h || frame.px[i + 3] < 128) { row.push(-1); continue; }
      const rgb = [frame.px[i], frame.px[i + 1], frame.px[i + 2]];
      let best = 0;
      for (let k = 1; k < palette.length; k++) if (dist(rgb, palette[k]) < dist(rgb, palette[best])) best = k;
      row.push(best);
    }
    g.push(row);
  }
  return g;
}

/** The colours of clean sources (GIFs), most used first: the body is the first. sets: [[frames, win]]. */
export function paletteOf(sets) {
  const n = new Map();
  for (const [frames, win] of sets) for (const f of frames) for (let r = 0; r < win.rows; r++) for (let c = 0; c < win.cols; c++) {
    const x = Math.floor(win.gx + (c + 0.5) * win.pitch), y = Math.floor(win.gy + (r + 0.5) * win.pitch), i = (y * f.w + x) * 4;
    if (x < 0 || y < 0 || x >= f.w || y >= f.h || f.px[i + 3] < 128) continue;
    const k = (f.px[i] << 16) | (f.px[i + 1] << 8) | f.px[i + 2];
    n.set(k, (n.get(k) ?? 0) + 1);
  }
  return [...n].sort((a, b) => b[1] - a[1]).map(([k]) => [k >> 16, (k >> 8) & 255, k & 255]);
}

const darkest = (palette) => palette.reduce((d, p, i) => (p[0] + p[1] + p[2] < palette[d][0] + palette[d][1] + palette[d][2] ? i : d), 0);

/** The eyes: the darkest colour's cells inside the body's rows (a pose with nothing else dark). */
export function eyes(grid, palette) {
  const d = darkest(palette), out = [];
  grid.forEach((row, r) => row.forEach((v, c) => { if (v === d) out.push([c, r]); }));
  return out;
}

/** Eyes moved by their own width (a glance, as the terminal Clawd does), or closed: the eye becomes body,
 *  its lowest row a dark line. */
export function derive(grid, palette, how) {
  const g = grid.map((row) => [...row]), d = darkest(palette), body = 0, cells = eyes(grid, palette);
  for (const [c, r] of cells) g[r][c] = body;
  if (how === "left" || how === "right") {
    let w = 1; // the width of an eye: its run on its first row
    if (cells.length) { const [c0, r0] = cells[0]; while (cells.some(([c, r]) => r === r0 && c === c0 + w)) w++; }
    const dx = how === "left" ? -w : w;
    for (const [c, r] of cells) if (g[r]?.[c + dx] !== undefined && grid[r][c + dx] !== -1) g[r][c + dx] = d;
  } else if (how === "closed") {
    const low = new Map(); // each eye column: its lowest row
    for (const [c, r] of cells) low.set(c, Math.max(low.get(c) ?? -1, r));
    for (const [c, r] of low) g[r][c] = d;
  } else throw new Error(`unknown derivation ${how}`);
  return g;
}

/** RGBA bytes of a grid at k device px per cell. */
export function rgba(grid, palette, k) {
  const rows = grid.length, cols = grid[0].length, W = cols * k, H = rows * k, buf = new Uint8Array(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const v = grid[Math.floor(y / k)][Math.floor(x / k)];
    if (v >= 0) buf.set([...palette[v], 255], (y * W + x) * 4);
  }
  return { W, H, buf };
}

// ---------- impure: sources, ffmpeg, magick ----------

function run(cmd, opts) {
  const r = spawnSync(cmd, opts);
  if (r.exitCode !== 0) throw new Error(`${cmd[0]}: ${r.stderr.toString().trim().split("\n").pop()}`);
  return r.stdout;
}
function frameAt(file, ms, vp9) {
  const [w, h] = run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0", file]).toString().trim().split(",").map(Number);
  const px = run(["ffmpeg", "-v", "error", ...(vp9 ? ["-c:v", "libvpx-vp9"] : []), "-i", file, "-ss", String(ms / 1000), "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "rgba", "pipe:1"]);
  if (px.length !== w * h * 4) throw new Error(`${file}: frame at ${ms} ms is ${px.length} bytes, not ${w}x${h}`);
  return { w, h, px };
}
async function fetchTo(url, dir) {
  const r = await fetch(url, { headers: { "user-agent": "Mozilla/5.0" } });
  if (!r.ok || !(r.headers.get("content-type") ?? "").startsWith("image/")) throw new Error(`${url}: ${r.status} ${r.headers.get("content-type")}`);
  const f = `${dir}/${url.split("/").pop()}`;
  writeFileSync(f, new Uint8Array(await r.arrayBuffer()));
  return f;
}

async function main() {
  const tmp = mkdtempSync(`${tmpdir()}/clawd-`);
  const missing = [], sources = {}, grids = {};
  try {
    const got = {};
    for (const [name, s] of Object.entries(SOURCES)) {
      try {
        const file = s.file ?? (await fetchTo(s.url, tmp));
        if (!existsSync(file)) throw new Error(`${file} not found (Claude desktop not installed?)`);
        const stand = frameAt(file, s.stand, s.vp9);
        const cal = calibrate(stand);
        if (cal.error) throw new Error(cal.error);
        const takes = Object.entries(TAKEN).filter(([, [src]]) => src === name).map(([pose, [, ms]]) => [pose, frameAt(file, ms, s.vp9)]);
        got[name] = { stand, cal, takes, win: window([stand, ...takes.map(([, f]) => f)], cal), vp9: s.vp9 };
        sources[name] = { from: s.url ?? s.file, sha256: createHash("sha256").update(readFileSync(file)).digest("hex") };
      } catch (e) { missing.push(`${name}: ${e.message}`); }
    }
    // one palette from the clean GIFs, so the video's drifting colours land on Clawd's own
    const clean = Object.entries(got).filter(([n]) => !SOURCES[n].vp9);
    const palette = clean.length ? paletteOf(clean.map(([, g]) => [g.takes.map(([, f]) => f), g.win])) : null;
    if (palette) for (const g of Object.values(got)) for (const [pose, f] of g.takes) grids[pose] = { grid: sample(f, g.win, palette), anchor: g.win.anchor };
    for (const [pose, [base, how]] of Object.entries(DERIVED)) if (grids[base]) grids[pose] = { grid: derive(grids[base].grid, palette, how), anchor: grids[base].anchor };
    for (const p of POSES) if (!grids[p]) missing.push(`pose ${p}`);
    if (missing.length || !palette) {
      console.error(`clawd: incomplete, previous poses kept (the runner shows Ember without them):\n  ${missing.join("\n  ")}`);
      process.exitCode = 1;
      return;
    }
    // written beside, then swapped in: a failed run never leaves half a set
    const next = `${OUT}.next`;
    rmSync(next, { recursive: true, force: true });
    mkdirSync(next, { recursive: true });
    const poses = {};
    for (const p of POSES) {
      const { grid, anchor } = grids[p];
      poses[p] = { size: [grid[0].length, grid.length], anchor };
      for (const k of SCALES) {
        const { W, H, buf } = rgba(grid, palette, k);
        writeFileSync(`${tmp}/raw`, buf);
        run(["magick", "-size", `${W}x${H}`, "-depth", "8", `rgba:${tmp}/raw`, `${next}/${p}@${k}x.png`]);
      }
    }
    writeFileSync(`${next}/manifest.json`, JSON.stringify({ v: 1, complete: true, extracted: new Date().toISOString(), unit: "one cell = half of Clawd's pixel = one css px", scales: SCALES, poses, sources }, null, 1) + "\n");
    rmSync(OUT, { recursive: true, force: true });
    mkdirSync(OUT.replace(/\/[^/]+$/, ""), { recursive: true });
    renameSync(next, OUT);
    console.log(`clawd: ${POSES.length} poses in ${OUT}`);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

if (import.meta.main) await main();
