// bun ~/.config/herdr-app/brand/companions/src/scene.mjs [--pages <dir>]
//
// The runner's scene (kt-chat's band over the composer): the accessories the cube uses beside it, from the
// catalogue validated by Kylian (carry/mascot/ACTIONS.md), with his reviews of 2026-11-20 applied: the cube
// stands against what it acts on, within reach, the object at its scale; editing is a typewriter, creating a
// printer; a real folder with its tab, a carton with flaps; commit, push and pull read at a glance (the carton
// closed and labelled, leaving for the depot, coming back from it, an arrow for the direction); done is a
// placard held up with a green check; an error, thick smoke; supervision says who does what with whom (its
// workers are small cubes with blue LEDs tied to it by a dotted wire, another session has violet ones);
// colour everywhere, from the interface's palette (themes/kbrdn-dark.json).
//
// Units: the band's css px. Each image is 120 x 36 and lies at -8 from the cube's 28 px box (runner.js), so
// in an image the cube spans x 8..36, y 6..34, its body's right edge near x 35 and its bottom near y 31.
// Objects stand from X0 = 36 (against it) on G = 31; "over" accessories sit above its top (y < 10).
// Writes brand/companions/cube/acc/<action>-<frame>.svg, <action>-fly.svg, scene.json (the table kt-chat's
// scene.js copies), cube/preview34-<state>.svg (the real cube's body and face, for the pages), and with
// --pages, <dir>/scene-data.js (all of it inlined, for carry/mascot's pages).
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";

const BRAND = `${homedir()}/.config/herdr-app/brand/companions`;
const OUT = `${BRAND}/cube/acc`;
const G = 31, X0 = 36, W = 120;
// kbrdn-dark (themes/kbrdn-dark.json), and the cube's own LEDs
const P = { paper: "#e0e0e0", paper2: "#bdbdbd", ink: "#666666", dark: "#242424", darker: "#191919", hole: "#0b0b0b",
  edge: "#3a3a3a", metal: "#808080", metal2: "#a8a8a8", accent: "#d4825d", accent2: "#a8603f", accent3: "#e8a585",
  yellow: "#ffdf61", yellow2: "#e6c654", gold: "#b8962f", green: "#86e89a", green2: "#6bc97f", red: "#ff7a7a", red2: "#e06060",
  blue: "#7ab8ff", blue2: "#5aa0e6", violet: "#c79bff", violet2: "#a87ee0", cyan: "#8abfb8", cyan2: "#6fa39c",
  led: "#eef7ff", ledb: "#8fd0f8", off: "#2e2e2e", smoke: "#5a5a5a", smoke2: "#7a7a7a" };
const CODE = [P.blue, P.violet, P.green, P.accent, P.yellow2]; // a file's lines, as code is coloured

let out = [];
const px = (x, y, w, h, c, a = 1) => out.push(`<rect x="${Math.round(x)}" y="${Math.round(y)}" width="${Math.max(1, Math.round(w))}" height="${Math.max(1, Math.round(h))}" fill="${c}"${a < 1 ? ` fill-opacity="${+a.toFixed(2)}"` : ""}/>`);
const dot = (x, y, c, a = 1) => px(x, y, 1, 1, c, a);
const box = (x, y, w, h, fill, line) => { px(x, y, w, h, fill); px(x, y, w, 1, line); px(x, y + h - 1, w, 1, line); px(x, y, 1, h, line); px(x + w - 1, y, 1, h, line); };
const arrow = (x, y, len, dir, c) => {
  px(x, y, len, 1, c);
  const hx = dir > 0 ? x + len - 1 : x;
  for (let k = 1; k <= 2; k++) { dot(hx - dir * k, y - k, c); dot(hx - dir * k, y + k, c); }
};
const dotted = (x0, x1, y, c, a = 0.9) => { for (let x = x0; x <= x1; x += 2) dot(x, y, c, a); };

// ---- props, at the cube's scale (it is 28 tall) ----
const sheet = (x, y, n = 3, c = P.paper) => { px(x, y, 7, 9, c); for (let k = 0; k < n; k++) px(x + 1 + (k % 2), y + 2 + k * 2, k === n - 1 ? 3 : 4, 1, CODE[k % CODE.length]); };
const pile = (x, n) => { for (let k = 0; k < n; k++) { px(x - (k % 2), G - 2 - k * 2, 9, 2, k % 2 ? P.paper : P.paper2); dot(x - (k % 2) + 7, G - 2 - k * 2, CODE[k % CODE.length]); } };
const ball = (x, y) => { px(x, y, 4, 3, P.paper); dot(x + 1, y + 1, P.paper2); dot(x + 3, y, P.blue); };
// the carton: flaps up when open (its dark inside showing), else taped shut with its label
function carton(x, y, { open = false, label = true, w = 13, h = 10 } = {}) {
  px(x, y, w, h, P.accent);
  px(x + w - 2, y, 2, h, P.accent2); // its side in shade
  px(x, y + h - 1, w, 1, P.accent2);
  if (open) {
    px(x + 1, y, w - 3, 2, "#4a2a1c");
    px(x - 2, y - 3, 4, 1, P.accent3); px(x - 1, y - 2, 3, 1, P.accent3); px(x, y - 1, 2, 1, P.accent3); // left flap
    px(x + w - 2, y - 3, 4, 1, P.accent3); px(x + w - 2, y - 2, 3, 1, P.accent3); px(x + w - 2, y - 1, 2, 1, P.accent3); // right flap
  } else {
    px(x, y, w, 1, P.accent3);
    px(x + Math.floor(w / 2) - 1, y, 3, 4, P.yellow2); // the tape over the seam
    if (label) { px(x + 2, y + 5, 5, 3, P.paper); px(x + 3, y + 6, 3, 1, P.blue2); }
  }
}
// a folder with its tab; open, a sheet shows behind its front
function folder(x, open) {
  const y = G - 12;
  px(x, y, 6, 2, P.yellow2); // the tab
  px(x, y + 2, 16, 10, P.yellow2);
  if (open) { sheet(x + 3, y - 1, 2); px(x + 1, y + 6, 16, 6, P.yellow); px(x + 1, y + 6, 16, 1, P.gold); }
  else { px(x, y + 3, 16, 9, P.yellow); px(x, y + 3, 16, 1, P.gold); px(x + 11, y + 6, 3, 2, P.red2); }
  px(x, G - 1, 16, 1, P.gold);
}
// the typewriter: its paper up in the roller, its keys, a strike on every other frame
function typewriter(x, f) {
  sheet(x + 5 + f, G - 17, 2 + f);
  px(x + 1, G - 9, 17, 2, P.darker); px(x, G - 9, 1, 2, P.metal2); px(x + 18, G - 9, 1, 2, P.metal2); // the roller
  px(x, G - 7, 19, 7, P.accent); px(x, G - 1, 19, 1, P.accent2); px(x + 17, G - 7, 2, 7, P.accent2);
  for (let k = 0; k < 5; k++) px(x + 2 + k * 3, G - 4, 2, 2, k === 1 + f * 2 ? P.yellow : P.darker);
  if (f) px(x + 9, G - 9, 1, 3, P.metal2); // a typebar striking
}
// the printer: the sheet comes out of its top, then lies on the pile beside it
function printer(x, k) {
  px(x, G - 9, 17, 9, "#4a4a4a"); px(x, G - 9, 17, 2, P.metal); px(x + 3, G - 9, 11, 1, P.hole); px(x + 15, G - 9, 2, 9, P.edge);
  px(x + 2, G - 3, 13, 1, P.paper2); px(x + 13, G - 6, 2, 1, k === 2 ? P.off : P.green); px(x + 2, G - 6, 3, 1, P.blue2);
  pile(x + 20, k === 2 ? 3 : 2);
  if (k === 0) px(x + 5, G - 11, 7, 2, P.paper);
  if (k === 1) sheet(x + 5, G - 16, 2);
}
const bin = (x, open) => { px(x + 1, G - 9, 9, 9, P.cyan2); for (let k = 0; k < 3; k++) px(x + 3 + k * 2, G - 8, 1, 7, P.cyan); if (open) px(x + 10, G - 16, 1, 7, P.metal2); else { px(x, G - 10, 11, 1, P.metal2); px(x + 4, G - 11, 3, 1, P.metal2); } };
const depot = (x) => {
  px(x, G - 12, 18, 12, P.edge);
  for (let r = 0; r < 4; r++) px(x - 1 + r, G - 13 - r, 20 - 2 * r, 1, r % 2 ? P.violet : P.violet2);
  px(x + 4, G - 9, 10, 9, P.yellow2); px(x + 5, G - 8, 8, 8, P.hole); px(x + 6, G - 11, 6, 1, P.blue);
};
const belt = (x, w, f) => { px(x, G - 2, w, 2, P.darker); for (let k = 0; k < w; k += 4) dot(x + ((k + f * 2) % w), G - 2, P.yellow2); };
const shelf = (x) => { px(x, G - 14, 18, 1, P.accent2); px(x, G - 1, 18, 1, P.accent2); px(x, G - 14, 1, 14, P.accent2); px(x + 17, G - 14, 1, 14, P.accent2); px(x + 2, G - 13, 6, 3, P.violet2); };
const loupe = (x, y) => { for (let a = 0; a < 12; a++) dot(x + Math.round(Math.cos(a * 0.524) * 4), y + Math.round(Math.sin(a * 0.524) * 4), P.blue); dot(x - 1, y - 1, P.led, 0.7); for (let k = 0; k < 3; k++) px(x + 3 + k, y + 3 + k, 2, 1, P.accent2); };
const term = (x, n, cur) => { box(x, G - 12, 17, 12, P.darker, P.blue2); dot(x + 2, G - 10, P.green); dot(x + 3, G - 9, P.green); dot(x + 2, G - 8, P.green); for (let r = 0; r < n; r++) px(x + 5, G - 10 + r * 3, 4 + r * 3, 1, [P.yellow2, P.cyan, P.violet][r % 3]); if (cur) px(x + 5 + 4 + n * 3, G - 10 + (n - 1) * 3, 2, 1, P.led); };
const lights = (x, cols) => { px(x, G - 7, 18, 7, P.dark); px(x, G - 7, 18, 1, P.edge); cols.forEach((c, k) => px(x + 2 + k * 3, G - 5, 2, 3, c)); };
const gear = (x, y, r, f, c, c2) => { for (let a = 0; a < 12; a++) dot(x + Math.round(Math.cos(a * 0.524) * r), y + Math.round(Math.sin(a * 0.524) * r), (a + f) % 2 === 0 ? c : c2); px(x - 1, y - 1, 3, 3, c2); dot(x, y, P.darker); };
const spark = (x, y) => { dot(x, y, P.yellow); dot(x - 1, y, P.accent, 0.8); dot(x + 1, y, P.accent, 0.8); dot(x, y - 1, P.yellow, 0.7); };
const pkg = (x, y, c) => { px(x, y, 5, 5, c); px(x + 2, y, 1, 5, P.paper, 0.7); px(x, y + 2, 5, 1, P.paper, 0.7); };
const broom = (x, o) => { px(x + 3 + o, G - 14, 1, 11, P.accent2); px(x + 1 + o, G - 4, 5, 4, P.yellow2); for (let k = 0; k < 3; k++) px(x + 2 + o + k * 1.5, G - 2, 1, 2, P.gold); };
const antenna = (n, tip) => { px(21, 2, 1, 8, P.metal2); dot(21, 1, tip ? P.red : P.led); for (let k = 0; k < n; k++) for (let a = -1; a <= 1; a++) dot(24 + k * 2, 2 + a * (1 + k), k % 2 ? P.cyan : P.blue, 0.9); };
const socket = (x, on) => { px(x, G - 9, 6, 9, P.edge); dot(x + 2, G - 6, P.hole); dot(x + 2, G - 3, P.hole); dot(x + 4, G - 8, on ? P.green : P.red2); };
const plug = (x) => { px(x, G - 6, 5, 4, P.accent); px(x + 5, G - 6, 2, 1, P.metal2); px(x + 5, G - 3, 2, 1, P.metal2); px(x - 3, G - 4, 3, 1, P.violet2); };
const book = (x, open) => { if (open) { px(x, G - 8, 8, 7, P.paper); px(x + 8, G - 8, 8, 7, P.paper2); px(x + 7, G - 8, 2, 8, P.violet2); px(x - 1, G - 1, 18, 1, P.violet2); for (let k = 0; k < 3; k++) { px(x + 1, G - 6 + k * 2, 5, 1, CODE[k]); px(x + 10, G - 6 + k * 2, 5, 1, CODE[k + 1]); } } else { px(x + 2, G - 11, 10, 11, P.violet2); px(x + 2, G - 11, 2, 11, P.violet); px(x + 6, G - 8, 4, 1, P.yellow); } };
const notepad = (x, n) => { px(x, G - 12, 11, 12, P.paper); px(x, G - 13, 11, 2, P.red2); for (let k = 0; k < 4; k++) dot(x + 2 + k * 2, G - 13, P.metal2); for (let k = 0; k < 3; k++) { px(x + 4, G - 9 + k * 3, 6, 1, P.blue2); px(x + 1, G - 10 + k * 3, 2, 2, k < n ? P.green : P.paper2); } };
const blueprint = (x, w) => { if (w < 6) { px(x, G - 9, 4, 9, P.blue2); px(x + 1, G - 9, 1, 9, P.blue); } else { px(x, G - 9, w, 9, P.blue2); for (let k = 2; k < w; k += 3) for (let r = 2; r < 9; r += 3) dot(x + k, G - 9 + r, P.led, 0.8); px(x + 4, G - 6, 6, 3, P.yellow2, 0.8); px(x + w - 3, G - 9, 3, 9, P.blue); } };
const bigCube = (x) => { box(x, G - 24, 18, 24, P.darker, P.violet2); for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) if ((r + c) % 3 !== 1) px(x + 3 + c * 4, G - 20 + r * 5, 2, 2, (r + c) % 2 ? P.violet : P.led); };
// a worker: the cube in small, in 3/4 (front, side, top), its LEDs blue; another session's are violet; off: dark
function mini(x, y, leds = P.ledb, f = 0) {
  px(x + 1, y, 9, 2, P.edge); px(x, y + 1, 7, 9, P.dark); px(x + 7, y + 1, 3, 8, P.darker);
  const a = f ? P.led : leds;
  dot(x + 2, y + 4, a); dot(x + 4, y + 4, leds); dot(x + 2, y + 6, leds); dot(x + 4, y + 6, a); dot(x + 8, y + 4, leds, 0.6); dot(x + 8, y + 6, leds, 0.6);
}
const worker = (x, f = 0) => mini(x, G - 10, P.ledb, f);
const peer = (x) => mini(x, G - 10, P.violet);
const wire = (x1, c = P.blue2) => dotted(X0, x1, G - 1, c); // the lead's tie to its worker (hc's parent)
const plane = (x, y, c) => { px(x, y, 7, 1, P.paper); px(x + 2, y - 1, 4, 1, P.paper); px(x + 1, y + 1, 3, 1, c); };
const spyglass = (x, y) => { px(x, y, 11, 3, P.gold); px(x + 3, y, 1, 3, P.yellow2); px(x + 7, y, 1, 3, P.yellow2); px(x + 11, y - 1, 2, 5, P.blue); };
const screen = (x, y) => { box(x, y, 10, 7, P.darker, P.blue2); px(x + 2, y + 2, 5, 1, P.green); px(x + 2, y + 4, 4, 1, P.yellow2); };
const button = (x, on) => { px(x, G - 8, 7, 8, P.dark); px(x, G - 8, 7, 1, P.edge); px(x + 2, on ? G - 11 : G - 10, 3, on ? 3 : 2, on ? P.red : P.red2); };
const bubble = (x, y, on, c) => { box(x, y, 9, 6, on ? P.dark : P.darker, on ? c : P.edge); px(x + 2, y + 2, 5, 1, on ? c : P.edge); dot(x + 2, y + 6, on ? c : P.edge); };
// an error: thick smoke out of its top, sparks
const smoke = (f) => {
  const puffs = [[14, 7, 5, 3], [19, 5, 6, 4], [25, 6, 5, 3], [17, 1, 5, 3], [23, 0, 4, 3]];
  puffs.forEach(([x, y, w, h], k) => { const up = (k + f) % 3; px(x, y - up, w, h, k % 2 ? P.smoke2 : P.smoke, 0.85 - up * 0.15); });
  spark(30, 8 - f); spark(12, 6 + (f % 2)); dot(28, 2 + f, P.red);
};
const hourglass = (x, f) => { px(x, G - 12, 8, 1, P.gold); px(x, G - 1, 8, 1, P.gold); px(x + 1, G - 11, 6, 10, P.edge, 0.6); px(x + 2, f ? G - 5 : G - 10, 4, 4, P.yellow); px(x + 3, G - 6, 2, 1, P.yellow, 0.6); };
const zzz = (n) => { for (let k = 0; k < n; k++) { const x = 26 + k * 3, y = 8 - k * 3; px(x, y, 3, 1, P.blue); dot(x + 1, y + 1, P.blue); px(x, y + 2, 3, 1, P.blue); } };
const sign = (x, y, ch, pole = true) => { if (pole) px(x + 4, y + 8, 1, G - y - 8, P.accent2); box(x, y, 9, 9, P.dark, P.yellow); if (ch === "?") { px(x + 3, y + 2, 3, 1, P.yellow); dot(x + 5, y + 3, P.yellow); dot(x + 4, y + 4, P.yellow); dot(x + 4, y + 6, P.yellow); } else { px(x + 4, y + 2, 1, 4, P.yellow); dot(x + 4, y + 7, P.yellow); } };
// done: a placard brandished at arm's length: a green board, a thick white check, its wooden stick held at
// the cube's side; up and down a little
const placard = (up) => {
  const x = X0 - 6, y = up ? 0 : 1;
  px(x + 7, y + 12, 2, G - 9 - (y + 12), P.accent2); // the stick, down to its "hand"
  px(x + 6, G - 10, 4, 2, P.accent3);
  px(x + 1, y, 15, 12, P.green2); px(x, y + 1, 17, 10, P.green2); // the board, its corners cut
  px(x + 1, y + 11, 15, 1, "#4f9a5f");
  for (const [dx, dy] of [[4, 6], [5, 7], [6, 8], [7, 7], [8, 6], [9, 5], [10, 4], [11, 3], [12, 2]]) px(x + dx, y + dy, 2, 2, P.paper);
};
// the cart: a flat bed on two wheels, its handle behind (left when pushed to the right), the carton on it
const cart = (x, handleRight = false) => {
  px(x, G - 4, 18, 2, P.metal2); px(x, G - 3, 18, 1, P.metal);
  for (const wx of [x + 2, x + 13]) { px(wx, G - 2, 3, 2, P.darker); dot(wx + 1, G - 2, P.metal2); }
  const hx = handleRight ? x + 17 : x;
  px(hx, G - 15, 1, 11, P.metal2); px(handleRight ? hx - 1 : hx, G - 16, 2, 2, P.accent);
  carton(x + 3, G - 14);
};
// the pull request icon (GitHub's: two commits on one branch, the other's arrow coming back), white on green
const prIcon = (x, y) => {
  px(x + 1, y, 13, 15, P.green2); px(x, y + 1, 15, 13, P.green2); // the badge, its corners cut
  const node = (cx, cy) => { px(x + cx - 1, y + cy - 1, 3, 3, P.paper); dot(x + cx, y + cy, P.green2); };
  node(4, 3); node(4, 11); px(x + 4, y + 5, 1, 5, P.paper); // the branch: two commits
  node(10, 11); px(x + 10, y + 4, 1, 6, P.paper); px(x + 7, y + 4, 4, 1, P.paper); // the other comes back...
  dot(x + 7, y + 3, P.paper); dot(x + 7, y + 5, P.paper); dot(x + 6, y + 4, P.paper); // ...its arrow pointing left
};
// CI: the pipeline's jobs in a row on a rail, each lit as it runs (yellow) then passes (green)
const pipeline = (x, cols) => {
  px(x, G - 9, 26, 9, P.dark); px(x, G - 9, 26, 1, P.edge);
  px(x + 3, G - 5, 20, 1, P.metal);
  cols.forEach((c, k) => { px(x + 2 + k * 6, G - 7, 4, 4, c); if (c === P.green) { dot(x + 3 + k * 6, G - 5, P.darker); dot(x + 4 + k * 6, G - 6, P.darker); } });
  px(x + 1, G - 12, 7, 3, P.blue2); px(x + 2, G - 11, 5, 1, P.led); // its tag: the workflow
};
const lever = (x, f) => {
  px(x, G - 3, 8, 1, P.metal2); // the main line, then its two ways
  for (let k = 0; k < 6; k++) dot(x + 8 + k, G - 4 - k, f ? P.metal : P.green);
  px(x + 14, G - 9, 9, 1, f ? P.metal : P.green); px(x + 8, G - 3, 15, 1, f ? P.blue : P.metal);
  px(x + 1, G - 2, 4, 2, P.accent2);
  for (let k = 0; k < 5; k++) dot(x + 3 + (f ? k : -k) * 0.6, G - 3 - k, f ? P.blue : P.green);
};
const check = (x, y) => { dot(x, y + 1, P.green); dot(x + 1, y + 2, P.green); dot(x + 2, y + 1, P.green); dot(x + 3, y, P.green); dot(x + 4, y - 1, P.green); };
const dots3 = (k) => { [P.led, P.blue, P.violet].forEach((c, i) => px(15 + i * 5, 6, 2, 2, c, i === k ? 1 : 0.3)); };

// The actions: frames, a fly (a piece that travels dx in its ms, once per beat), how the cube moves (cube:
// "type" bobs 1 px, "hop" 3 px, "tremble", "sink", "pace" walks to and fro in front of what it waits for,
// "carry" walks with what it holds), look (its face toward the right), over (above its head, not on the ground).
export const ACTIONS = {
  read: { frames: [() => { sheet(X0, G - 9); loupe(X0 + 2, G - 6); }, () => { sheet(X0, G - 9); loupe(X0 + 5, G - 5); }], ms: 1200 },
  search: { frames: [() => { pile(X0 + 1, 4); sheet(X0 + 1, G - 17); px(X0 + 2, G - 13, 5, 1, P.yellow); }, () => { pile(X0 + 1, 4); sheet(X0 + 4, G - 20, 3, P.paper2); }], ms: 600 },
  write: { frames: [0, 1, 2].map((k) => () => printer(X0, k)), ms: 450 },
  edit: { frames: [() => typewriter(X0, 0), () => typewriter(X0, 1)], ms: 300, cube: "type" },
  move: { frames: [() => carton(X0 - 1, G - 16)], cube: "carry" },
  dir: { frames: [() => folder(X0, false), () => folder(X0, true)], ms: 900 },
  rm: { frames: [() => { bin(X0 + 4, true); ball(X0, G - 18); }, () => { bin(X0 + 4, true); ball(X0 + 7, G - 13); }, () => bin(X0 + 4, false)], ms: 600 },
  commit: { frames: [() => { carton(X0, G - 10, { open: true }); sheet(X0 + 3, G - 17, 2); }, () => carton(X0, G - 10)], ms: 1100 },
  push: { frames: [() => { depot(96); arrow(X0 + 8, G - 22, 42, 1, P.green); }], ms: 2600, fly: { piece: () => cart(X0), dx: 42, ms: 2600 } },
  pull: { frames: [() => { depot(96); arrow(X0 + 8, G - 22, 42, -1, P.blue); }], ms: 2600, fly: { piece: () => cart(X0 + 42, true), dx: -42, ms: 2600 } },
  ci: { frames: [() => pipeline(X0, [P.green, P.green, P.yellow, P.off]), () => pipeline(X0, [P.green, P.green, P.green, P.yellow])], ms: 900 },
  merge: { frames: [() => { carton(X0, G - 10); carton(X0 + 18, G - 10); arrow(X0 + 15, G - 14, 8, -1, P.violet); }, () => { carton(X0, G - 10); carton(X0 + 1, G - 20); check(X0 + 16, G - 8); }], ms: 1000 },
  branch: { frames: [() => lever(X0, 0), () => lever(X0, 1)], ms: 900 },
  prcreate: { frames: [() => { carton(X0, G - 10); px(X0 + 17, G - 13, 1, 13, P.accent2); }, () => { carton(X0, G - 10); px(X0 + 17, G - 13, 1, 13, P.accent2); prIcon(X0 + 10, G - 29); }], ms: 1100 },
  review: { frames: [() => { carton(X0, G - 10, { open: true }); loupe(X0 + 4, G - 14); }, () => { carton(X0, G - 10, { open: true }); loupe(X0 + 9, G - 14); }], ms: 1000 },
  prmerge: { frames: [() => { shelf(X0 + 18); check(X0 + 24, G - 18); }], ms: 2200, fly: { piece: () => carton(X0, G - 11), dx: 20, ms: 2200 } },
  bash: { frames: [() => term(X0, 1, true), () => term(X0, 2, false)], ms: 600 },
  tests: { frames: [() => lights(X0, [P.green, P.green, P.yellow, P.off, P.off]), () => lights(X0, [P.green, P.green, P.green, P.green, P.yellow])], ms: 1000 },
  testsOk: { frames: [() => lights(X0, [P.green, P.green, P.green, P.green, P.green])], cube: "hop" },
  testsKo: { frames: [() => lights(X0, [P.green, P.red, P.green, P.red, P.red])], cube: "tremble" },
  build: { frames: [() => { gear(X0 + 5, G - 6, 4, 0, P.yellow2, P.gold); gear(X0 + 13, G - 11, 3, 1, P.cyan, P.cyan2); spark(X0 + 10, G - 15); spark(X0 + 2, G - 13); }, () => { gear(X0 + 5, G - 6, 4, 1, P.yellow2, P.gold); gear(X0 + 13, G - 11, 3, 0, P.cyan, P.cyan2); spark(X0 + 18, G - 6); spark(X0 + 8, G - 17); }], ms: 300 },
  install: { frames: [() => { carton(X0, G - 10, { open: true }); pkg(X0 + 4, G - 19, P.violet); }, () => { carton(X0, G - 10, { open: true }); pkg(X0 + 2, G - 13, P.violet); pkg(X0 + 7, G - 13, P.cyan); }], ms: 700 },
  lint: { frames: [() => { broom(X0, 0); for (const [dx, dy] of [[9, 1], [11, 2], [13, 1], [12, 3]]) dot(X0 + dx, G - dy, P.metal); }, () => { broom(X0, 2); px(X0 + 13, G - 2, 4, 2, P.metal); dot(X0 + 3, G - 6, P.blue); dot(X0 + 1, G - 8, P.led, 0.8); }], ms: 450 },
  web: { frames: [() => antenna(1, false), () => antenna(3, true)], ms: 800, over: 1 },
  mcp: { frames: [() => { socket(X0 + 14, false); plug(X0 + 3); }, () => { socket(X0 + 14, true); plug(X0 + 7); }], ms: 900 },
  skill: { frames: [() => book(X0, false), () => book(X0, true)], ms: 1200 },
  todo: { frames: [() => notepad(X0, 1), () => notepad(X0, 3)], ms: 1200 },
  plan: { frames: [() => blueprint(X0, 4), () => blueprint(X0, 20)], ms: 1500 },
  think: { frames: [0, 1, 2].map((k) => () => dots3(k)), ms: 450, over: 1 },
  advisor: { frames: [() => bigCube(X0 + 2)], look: 1 },
  compact: { frames: [() => { pile(X0 + 2, 6); px(X0, G - 16, 12, 2, P.yellow2); px(X0 + 5, G - 20, 2, 4, P.gold); }, () => { pile(X0 + 2, 2); px(X0, G - 8, 12, 2, P.yellow2); px(X0 + 5, G - 20, 2, 12, P.gold); }], ms: 1500 },
  // supervision: who does what with whom. The lead is the cube; its workers are small blue cubes on its wire.
  spawn: { frames: [() => { px(X0, G - 1, 12, 1, P.blue); px(X0 + 1, G - 2, 10, 1, P.blue2, 0.6); dotted(X0 + 12, X0 + 40, G - 1, P.blue2); }], ms: 2800, fly: { piece: () => worker(X0 + 1), dx: 30, ms: 2800 } },
  send: { frames: [() => { wire(90); worker(91); }, () => { wire(90); worker(91, 1); }], ms: 1200, fly: { piece: () => plane(X0, G - 18, P.blue), dx: 50, ms: 2400 } },
  note: { frames: [() => { wire(90); worker(91, 1); }, () => { wire(90); worker(91); }], ms: 1200, fly: { piece: () => plane(X0 + 50, G - 18, P.green), dx: -50, ms: 2400 } },
  hcread: { frames: [() => { wire(86); worker(87); screen(87, G - 19); spyglass(X0 - 1, G - 18); dotted(X0 + 14, 85, G - 17, P.blue, 0.5); }], look: 1 },
  wait: { frames: [() => { wire(94); worker(78, 0); worker(94, 1); }, () => { wire(94); worker(78, 1); worker(94, 0); }], ms: 700, cube: "pace" },
  workerBlocked: { frames: [() => { dotted(X0, X0 + 20, G - 1, P.yellow); worker(X0 + 21); sign(X0 + 21, G - 21, "!", false); }, () => { dotted(X0, X0 + 20, G - 1, P.yellow); worker(X0 + 21); }], ms: 600, look: 1 },
  kill: { frames: [() => { button(X0, true); wire(X0 + 18); worker(X0 + 19, 1); }, () => { button(X0, false); dotted(X0 + 8, X0 + 18, G - 1, P.edge); mini(X0 + 19, G - 10, P.off); }], ms: 1500 },
  // another session (not its worker): violet, no wire
  message: { frames: [() => peer(94)], ms: 2400, fly: { piece: () => plane(X0, G - 18, P.violet), dx: 52, ms: 2400 } },
  crosstalk: { frames: [() => { peer(X0 + 26); bubble(X0, G - 24, true, P.blue); bubble(X0 + 16, G - 20, false, P.violet); }, () => { peer(X0 + 26); bubble(X0, G - 24, false, P.blue); bubble(X0 + 16, G - 20, true, P.violet); }], ms: 800, look: 1 },
  question: { frames: [() => sign(X0, G - 21, "?")], cube: "hop" },
  permission: { frames: [() => { sheet(X0, G - 11, 2); px(X0 + 1, G - 4, 5, 1, P.ink); px(X0 + 2, G - 8, 1, 4, P.accent); }, () => { sheet(X0, G - 11, 2); px(X0 + 1, G - 4, 5, 1, P.ink); px(X0 + 1, G - 5, 3, 1, P.blue2); px(X0 + 5, G - 8, 1, 4, P.accent); }], ms: 700, cube: "hop" },
  error: { frames: [0, 1, 2].map((k) => () => smoke(k)), ms: 400, over: 1 },
  quota: { frames: [() => hourglass(X0, 0), () => hourglass(X0, 1)], ms: 800, cube: "sink" },
  done: { frames: [() => placard(0), () => placard(2)], ms: 400 },
  idle: { frames: [() => {}] },
  sleep: { frames: [1, 2, 3].map((n) => () => zzz(n)), ms: 600, over: 1 },
};

const svg = (body, w = W) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} 36" width="${w}" height="36" shape-rendering="crispEdges">${body}</svg>\n`;
mkdirSync(OUT, { recursive: true });
const files = {};
for (const [id, a] of Object.entries(ACTIONS)) {
  a.frames.forEach((f, k) => { out = []; f(); files[`${id}-${k}`] = svg(out.join("")); });
  if (a.fly) { out = []; a.fly.piece(); files[`${id}-fly`] = svg(out.join("")); }
}
for (const [name, text] of Object.entries(files)) writeFileSync(`${OUT}/${name}.svg`, text);
// the scene's table for kt-chat's scene.js: frames, period, fly, cube motion, look, over
const table = Object.fromEntries(Object.entries(ACTIONS).map(([id, a]) => [id, {
  n: a.frames.length, ms: a.ms ?? 0, ...(a.fly ? { fly: { dx: a.fly.dx, ms: a.fly.ms ?? a.ms } } : {}), ...(a.cube ? { cube: a.cube } : {}),
  ...(a.look ? { look: a.look } : {}), ...(a.over ? { over: a.over } : {}),
}]));
writeFileSync(`${OUT}/scene.json`, JSON.stringify(table) + "\n");

// The real cube for the pages: its 3/4 body (cube.mjs' body34-4.svg) and its face's LEDs placed as
// companion-cube.js' cube34 places them (front and side plates, N = 4 at 28 px), family 0 variant 0.
const src = readFileSync(`${BRAND}/companion-cube.js`, "utf8");
const DATA = JSON.parse(src.match(/^const DATA = (\{.*\});$/m)[1]);
const body = readFileSync(`${BRAND}/cube/body34-4.svg`, "utf8").replace(/^<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "");
const COL = { w: "#eef7ff", b: "#8fd0f8", v: "#24425a" };
function preview(state) {
  const N = 4, M = DATA.margin, pn = (1 - 2 * M) / N, Gm = DATA.g34, face = DATA.faces[0][0][N];
  const plate = ([tl, tr, bl]) => { const e = Gm.inset, at = (s, t) => [tl[0] + (tr[0] - tl[0]) * s + (bl[0] - tl[0]) * t, tl[1] + (tr[1] - tl[1]) * s + (bl[1] - tl[1]) * t]; return [at(e, e), at(1 - e, e), at(e, 1 - e)]; };
  const plates = [plate(Gm.F), plate(Gm.S)], rl = pn * 0.4 * 0.82;
  const leds = [];
  for (let fi = 0; fi < 2; fi++) for (let i = 0; i < N * N; i++) {
    const [tl, tr, bl] = plates[fi], s = M + ((i % N) + 0.5) * pn, t = M + (Math.floor(i / N) + 0.5) * pn;
    const x = tl[0] + (tr[0] - tl[0]) * s + (bl[0] - tl[0]) * t, y = tl[1] + (tr[1] - tl[1]) * s + (bl[1] - tl[1]) * t;
    const cx = i % N, cy = Math.floor(i / N), ch = face[i];
    let col = null;
    if (state === "error") col = cx === cy || cx === N - 1 - cy ? COL.w : null;
    else if (state === "blocked") col = ch === "w" || ch === "b" || [0, N - 1, N * N - N, N * N - 1].includes(i) ? P.yellow : null;
    else col = COL[ch] ?? null;
    if (col) leds.push(`<ellipse cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" rx="${(rl * Math.abs(tr[0] - tl[0])).toFixed(2)}" ry="${(rl * Math.abs(bl[1] - tl[1])).toFixed(2)}" fill="${col}"${state === "dim" ? ' fill-opacity="0.35"' : ""}/>`);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="28" height="28">${body}${leds.join("")}</svg>\n`;
}
const cubes = Object.fromEntries(["idle", "blocked", "error", "dim"].map((s) => [s, preview(s)]));
for (const [s, text] of Object.entries(cubes)) writeFileSync(`${BRAND}/cube/preview34-${s}.svg`, text);

const at = process.argv.indexOf("--pages");
if (at > 0) {
  const dir = process.argv[at + 1];
  writeFileSync(`${dir}/scene-data.js`, `// written by brand/companions/src/scene.mjs --pages: do not edit by hand\nwindow.SCENE = ${JSON.stringify({ table, acc: files, cube: cubes, geo: { X0, G, cube: [8, 6, 28, 28] } })};\n`);
}
console.log(`scene: ${Object.keys(ACTIONS).length} actions, ${Object.keys(files).length} images, 4 previews${at > 0 ? ", scene-data.js" : ""}`);
