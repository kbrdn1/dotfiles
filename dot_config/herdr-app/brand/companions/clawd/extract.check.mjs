// bun brand/companions/clawd/extract.check.mjs : 1) the extractor's geometry on a made-up figure (no Clawd
// here either); 2) the poses on this machine: fails if one is missing, has the wrong size, or a pair that must
// move (a swap) came out identical. Without them the runner shows Ember: this check is what says so.
import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "bun";
import { calibrate, window, sample, derive, eyes, rgba, homeOf, POSES, SCALES, OUT } from "./extract.mjs";

let failed = 0;
const ok = (cond, what) => { if (!cond) { failed++; console.error(`FAIL ${what}`); } };

// ---- 0. where the poses go: an empty HERDR_APP_HOME is no home ----
ok(homeOf({ HERDR_APP_HOME: "", HOME: "/h" }) === "/h/.config/herdr-app", "home: an empty HERDR_APP_HOME falls back");
ok(homeOf({ HOME: "/h" }) === "/h/.config/herdr-app", "home: unset");
ok(homeOf({ HERDR_APP_HOME: "/x", HOME: "/h" }) === "/x", "home: set");

// ---- 1. geometry, on a made-up figure: a 24x16-cell block (pitch 10 px) with two 2x2 dark marks ----
{
  const P = 10, w = 400, h = 260, px = new Uint8Array(w * h * 4);
  const fill = (x0, y0, x1, y1, rgb) => { for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) px.set([...rgb, 255], (y * w + x) * 4); };
  const X = 50, Y = 60;
  fill(X, Y, X + 24 * P, Y + 16 * P, [200, 100, 80]);
  fill(X + 6 * P, Y + 2 * P, X + 8 * P, Y + 4 * P, [0, 0, 0]);
  fill(X + 16 * P, Y + 2 * P, X + 18 * P, Y + 4 * P, [0, 0, 0]);
  const frame = { w, h, px };
  const cal = calibrate(frame);
  ok(!cal.error && Math.abs(cal.pitch - P) < 0.01 && cal.ox === X && cal.oy === Y + 16 * P, `calibrate: ${JSON.stringify(cal)}`);
  ok(calibrate({ w: 4, h: 4, px: new Uint8Array(64) }).error, "calibrate: an empty frame is an error");
  const win = window([frame], cal);
  ok(win.cols === 24 && win.rows === 16 && win.anchor[0] === 0 && win.anchor[1] === 16, `window: ${JSON.stringify(win)}`);
  const palette = [[200, 100, 80], [0, 0, 0]];
  const g = sample(frame, win, palette);
  ok(g[2][6] === 1 && g[3][7] === 1 && g[2][5] === 0 && g[0][0] === 0, "sample: marks and body");
  ok(eyes(g, palette).length === 8, "eyes: two 2x2 marks");
  const L = derive(g, palette, "left"), R = derive(g, palette, "right"), C = derive(g, palette, "closed");
  ok(L[2][4] === 1 && L[2][5] === 1 && L[2][6] === 0 && L[2][7] === 0, "derive left: moved by the mark's width");
  ok(R[2][8] === 1 && R[2][9] === 1 && R[2][6] === 0, "derive right");
  ok(C[2][6] === 0 && C[3][6] === 1 && C[3][7] === 1 && C[2][16] === 0 && C[3][17] === 1, "derive closed: the lowest row only");
  const drift = { w, h, px: px.slice() };
  drift.px.set([205, 96, 84, 255], ((Y + 5) * w + X + 5 * P + 5) * 4); // a video's drifting colour lands on the body
  ok(sample(drift, win, palette)[0][5] === 0, "sample: nearest colour");
  const { W, H } = rgba(g, palette, 3);
  ok(W === 72 && H === 48, "rgba: k device px per cell");
}

// ---- 2. the poses on this machine ----
const manifest = existsSync(`${OUT}/manifest.json`) ? JSON.parse(readFileSync(`${OUT}/manifest.json`, "utf8")) : null;
if (!manifest) {
  failed++;
  console.error(`FAIL no poses in ${OUT}: run \`bun brand/companions/clawd/extract.mjs\` (until then the runner shows Ember)`);
} else {
  ok(manifest.complete === true, "manifest: complete");
  const dims = (f) => spawnSync(["magick", "identify", "-format", "%w %h", f]).stdout.toString().split(" ").map(Number);
  for (const p of POSES) {
    const m = manifest.poses?.[p];
    if (!m) { ok(false, `pose ${p}: missing from the manifest`); continue; }
    for (const k of SCALES) {
      const f = `${OUT}/${p}@${k}x.png`;
      if (!existsSync(f)) { ok(false, `pose ${p}@${k}x: missing`); continue; }
      const [w, h] = dims(f);
      ok(w === m.size[0] * k && h === m.size[1] * k, `pose ${p}@${k}x: ${w}x${h}, not ${m.size[0] * k}x${m.size[1] * k}`);
    }
  }
  const same = (a, b) => existsSync(`${OUT}/${a}@1x.png`) && existsSync(`${OUT}/${b}@1x.png`)
    && Buffer.compare(readFileSync(`${OUT}/${a}@1x.png`), readFileSync(`${OUT}/${b}@1x.png`)) === 0;
  for (const [a, b] of [["type-0", "type-1"], ["read-0", "read-1"], ["look-0", "look-1"], ["look-0", "idle"], ["done-0", "done-1"], ["done-1", "done-2"], ["done-2", "done-3"], ["error", "done-0"]])
    ok(!same(a, b), `${a} and ${b} are identical: the source changed, its times need a new reading`);
}

if (failed) { console.error(`${failed} failed`); process.exit(1); }
console.log("clawd: geometry ok, poses ok");
