// projtile.js: a project's tile when it has no logo: the project logos' background (brand/projects-dither.py:
// its colour at the top left to 30 % darker at the bottom right, 4 tones dithered between neighbours, Bayer
// 8x8, the 24 square at rx 6), its initial in white over it, so a project without a logo looks like one.
// Written once in mods/kt-keys/projtile.js and copied byte for byte (cmp) into each mod that draws a project
// mark (kt-mods/model.js SHARED). Check: bun mods/kt-keys/projtile.check.mjs (the same background as the
// script, to the character, on the dithered logos of brand/projects/).
//
// The background is an SVG per colour, written once under data/project-tiles/<hex>-v1.svg (the version in
// the name: image() keeps a path in cache, a new algorithm gets new paths). A colour is resolved by the mod
// (a theme name like ansi3 differs light / dark: one file each). Never image() on a file that isn't there
// yet (outside mods/, a missing image doesn't come back): until its file is known, the tile is the flat
// colour, and every miss of one render goes in ONE task after it (exists, else write), then a redraw.
//
//   init:   this.tiles = tileState();
//   render: tilesFrame(this.tiles, cx);                 // once, at the top: this render's cx, used during it
//           projTile(this.tiles, { color: "#d4825d", size: 20, letter: div().text_size(11)…child("K") })
//           (.opacity(0.4) etc. on what it returns)

import { div, image } from "gpui-kit";
import { appHome, checking, writeTextFile } from "herdr";
import * as fs from "fs/promises";

const B = [[0, 32, 8, 40, 2, 34, 10, 42], [48, 16, 56, 24, 50, 18, 58, 26], [12, 44, 4, 36, 14, 46, 6, 38], [60, 28, 52, 20, 62, 30, 54, 22],
  [3, 35, 11, 43, 1, 33, 9, 41], [51, 19, 59, 27, 49, 17, 57, 25], [15, 47, 7, 39, 13, 45, 5, 37], [63, 31, 55, 23, 61, 29, 53, 21]];
const LEVELS = 4, DEPTH = 0.30;
export const VERSION = 1;
export const DIR = "data/project-tiles";
export const LETTER = "#ffffff"; // the dithered logos' glyph: white in both appearances

// ---------- pure: the background, as brand/projects-dither.py writes it ----------

// Python's round(): a half goes to the even neighbour (Math.round sends it up: 40.5 is 40 in Python).
export function pyRound(x) {
  const f = Math.floor(x);
  const d = x - f;
  return d > 0.5 ? f + 1 : d < 0.5 ? f : f % 2 === 0 ? f : f + 1;
}

// mix(c, to, a): the script's, in the same order of operations (the same floats).
export function mix(c, to, a) {
  const p = (s) => [1, 3, 5].map((i) => parseInt(s.slice(i, i + 2), 16));
  const [cs, ts] = [p(c), p(to)];
  return "#" + cs.map((x, i) => pyRound(x + (ts[i] - x) * a).toString(16).padStart(2, "0")).join("");
}

// The script's background(base, to, uid): the same string, character for character. `to`: the ramp's end
// when a logo names one (data-dither-to, for a dark base); a tile never does: 30 % darker.
export function ditherBody(base, uid, to = null) {
  const tones = [];
  for (let k = 0; k < LEVELS; k++) tones.push(to ? mix(base, to, k / (LEVELS - 1)) : mix(base, "#000000", DEPTH * k / (LEVELS - 1)));
  const rows = [[], [], [], []];
  for (let y = 0; y < 24; y++) {
    let run = null; // [tone, first x] of the current horizontal run
    for (let x = 0; x < 25; x++) {
      let k = -1;
      if (x < 24) {
        const v = (x + y) / 46 * (LEVELS - 1);
        k = Math.floor(v);
        if (k < LEVELS - 1 && v - k > (B[y % 8][x % 8] + 0.5) / 64) k += 1;
      }
      if (run && run[0] !== k) {
        if (run[0] > 0) rows[run[0]].push(`M${run[1]} ${y}h${x - run[1]}v1h-${x - run[1]}z`);
        run = null;
      }
      if (run === null && x < 24) run = [k, x];
    }
  }
  let paths = "";
  for (let k = 1; k < LEVELS; k++) if (rows[k].length) paths += `<path fill="${tones[k]}" d="${rows[k].join("")}"/>`;
  return `<!-- dither ${to ? `${base} ${to}` : base} --><clipPath id="${uid}"><rect width="24" height="24" rx="6"/></clipPath>`
    + `<rect width="24" height="24" rx="6" fill="${tones[0]}"/><g clip-path="url(#${uid})">${paths}</g><!-- /dither -->`;
}

// The background alone, as a file.
export const ditherSvg = (hex) => `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">${ditherBody(hex, "bg")}</svg>\n`;

// A colour as the file's key: #rrggbb, lower case (a theme colour's alpha left out); null when it isn't one.
export const hexOf = (c) => (/^#[0-9a-fA-F]{6}/.test(String(c ?? "")) ? String(c).slice(0, 7).toLowerCase() : null);
export const tilePath = (hex) => `${DIR}/${hex.slice(1)}-v${VERSION}.svg`;

// ---------- the tile ----------

// One per mod copy (init): known: colours whose file is there; busy: asked; queue: this render's misses.
export const tileState = () => ({ known: new Set(), busy: new Set(), queue: [], cx: null });

// At the top of render: the cx projTile's misses spawn their task with (during this render only).
export function tilesFrame(st, cx) {
  st.cx = cx;
  return st;
}

// The tile, `size` px, radius size / 4 (the logos' rx 6 on 24): the dithered background of `color` (a
// resolved colour), else the flat colour while its file is asked; `letter` (an element) over it.
export function projTile(st, { color, size, letter }) {
  const hex = hexOf(color);
  const box = div().size(size).flex_none().relative().rounded(size / 4).overflow_hidden().flex().items_center().justify_center();
  const known = Boolean(hex) && st.known.has(hex);
  if (hex && !known) ask(st, hex);
  return (known ? box.child(image(tilePath(hex)).absolute().left(0).top(0).size(size)) : box.bg(color)).child(letter);
}

// A miss: queued; the render's first one spawns ONE task, after the render (its other misses are queued
// by then): the file there, else written (atomically; a write that loses to another mod's is fine, the
// file is there), then a redraw if one came. A colour whose file can't be written stays busy: flat for
// this copy's life, never asked again (no loop of redraws). Nothing while checking, nor without a cx.
function ask(st, hex) {
  if (st.busy.has(hex) || checking() || !st.cx) return;
  st.busy.add(hex);
  st.queue.push(hex);
  if (st.queue.length > 1) return;
  st.cx.spawn(async (cx) => {
    await null;
    const batch = st.queue.splice(0);
    const dir = `${appHome()}/${DIR}`;
    await fs.mkdir(dir, { recursive: true }).catch(() => {});
    let got = 0;
    for (const h of batch) {
      const abs = `${appHome()}/${tilePath(h)}`;
      const there = await fs.exists(abs).catch(() => false)
        || await writeTextFile(abs, ditherSvg(h), null).then(() => true, () => fs.exists(abs).catch(() => false));
      if (!there) continue;
      st.known.add(h);
      st.busy.delete(h);
      got++;
    }
    if (got) cx.notify();
  });
}
