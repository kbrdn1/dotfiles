// bun ~/.config/herdr-app/mods/kt-keys/projtile.check.mjs: projtile.js. The background against the script's
// own output (brand/projects-dither.py, kept in the dithered logos of brand/projects/), to the character;
// Python's rounding; the file's key; the tile (flat while its file is asked, then the image), its one task
// per render, nothing while checking; and what a render of many tiles costs. gpui and herdr mocked.
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, readdirSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { plugin } from "bun";

const el = (kind = "div") => {
  const node = { kind, kids: [], props: {} };
  const p = new Proxy(node, {
    get(target, k) {
      if (k in target) return target[k];
      return (...a) => {
        if (k === "child") target.kids.push(a[0]);
        else target.props[k] = a;
        return p;
      };
    },
  });
  return p;
};
const home = mkdtempSync(join(tmpdir(), "projtile-check-"));
process.on("exit", () => rmSync(home, { recursive: true, force: true }));
let isChecking = false, writes = 0;
plugin({
  setup(b) {
    b.module("gpui-kit", () => ({ loader: "object", exports: { div: () => el(), image: (path) => { const x = el("image"); x.props.path = [path]; return x; } } }));
    b.module("herdr", () => ({ loader: "object", exports: {
      appHome: () => home, checking: () => isChecking,
      // writeTextFile(path, text, null): creates, rejects when the file is already there.
      writeTextFile: async (path, text, expected) => {
        if (expected === null && existsSync(path)) throw new Error("stale");
        writes++;
        writeFileSync(path, text);
        return null;
      },
    } }));
  },
});
const { pyRound, mix, ditherBody, ditherSvg, hexOf, tilePath, tileState, tilesFrame, projTile, LETTER } = await import("./projtile.js");

// ---------- the background: the script's, to the character ----------
assert.equal(pyRound(40.5), 40, "a half to the even neighbour, as Python");
assert.equal(pyRound(41.5), 42);
assert.equal(pyRound(2.4), 2);
assert.equal(pyRound(2.6), 3);
assert.equal(mix("#2d2d2d", "#000000", 0.1), "#282828", "45 * 0.9 = 40.5: 40 (Math.round would give 41)");
const brandDir = join(dirname(fileURLToPath(import.meta.url)), "../../brand");
const brand = join(brandDir, "projects");
const DONE = /<!-- dither (#[0-9a-f]{6})(?: (#[0-9a-f]{6}))? -->.*?<!-- \/dither -->/s;
const blockOf = (s) => {
  const m = DONE.exec(s);
  return m && { block: m[0], base: m[1], to: m[2] ?? null, uid: /<clipPath id="([^"]+)">/.exec(m[0])[1] };
};
let logos = 0;
for (const f of readdirSync(brand).filter((n) => n.endsWith(".svg")).sort()) {
  const b = blockOf(readFileSync(join(brand, f), "utf8"));
  if (!b) continue;
  assert.equal(ditherBody(b.base, b.uid, b.to), b.block, `${f}: the script's background, to the character`);
  logos++;
}
assert.ok(logos >= 9, `the dithered logos of brand/projects/ (${logos})`);
// More colours than the logos have (3), through the script itself when python3 is there: dark, light,
// greys whose 30 % lands on a half (Python's rounding), and the data-dither-to ramp.
const py = Bun.which("python3");
let more = 0;
if (py) {
  const dir = mkdtempSync(join(tmpdir(), "projtile-py-"));
  const cases = ["#2d2d2d", "#050505", "#ffffff", "#000000", "#d4825d", "#3366cc", "#7f7f7f", "#1a1b26", "#e0af68",
    "#9ece6a", "#f7768e", "#0b1024", "#191919", "#232323", ["#1a1b26", "#3b4261"], ["#000000", "#333333"]];
  const files = cases.map((c, i) => {
    const [base, to] = Array.isArray(c) ? c : [c, null];
    const f = join(dir, `t${i}.svg`);
    writeFileSync(f, `<svg><rect width="24" height="24" rx="6" fill="${base}"${to ? ` data-dither-to="${to}"` : ""}/></svg>`);
    return f;
  });
  const r = Bun.spawnSync([py, join(brandDir, "projects-dither.py"), ...files]);
  assert.equal(r.exitCode, 0, `the script ran (${r.stderr})`);
  for (const f of files) {
    const b = blockOf(readFileSync(f, "utf8"));
    assert.equal(ditherBody(b.base, b.uid, b.to), b.block, `${b.base}${b.to ? ` -> ${b.to}` : ""}: the script's background, to the character`);
    more++;
  }
  rmSync(dir, { recursive: true, force: true });
} else console.log("projtile: no python3, the script's run skipped (the logos still checked)");
const svgDoc = ditherSvg("#d4825d");
assert.ok(svgDoc.startsWith('<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><!-- dither #d4825d -->'));
assert.ok(svgDoc.includes('<clipPath id="bg">') && svgDoc.endsWith("<!-- /dither --></svg>\n"));
console.log(`projtile background: ok (${logos} logos, ${more} colours through the script)`);

// ---------- the file's key ----------
assert.equal(hexOf("#D4825D"), "#d4825d");
assert.equal(hexOf("#0b102466"), "#0b1024", "a theme colour's alpha left out");
assert.equal(hexOf("ansi3"), null, "a theme name: resolved by the mod first");
assert.equal(hexOf(undefined), null);
assert.equal(tilePath("#d4825d"), "data/project-tiles/d4825d-v1.svg");

// ---------- the tile ----------
const tasks = [];
let notified = 0;
const cx = { spawn: (f) => tasks.push(f({ notify: () => notified++ })) };
const letter = () => el().child("K");
const find = (n, pred, out = []) => { if (n && typeof n === "object") { if (pred(n)) out.push(n); for (const k of n.kids ?? []) find(k, pred, out); } return out; };
const st = tileState();
tilesFrame(st, cx);
let tile = projTile(st, { color: "#d4825d", size: 20, letter: letter() });
assert.deepEqual(tile.props.bg, ["#d4825d"], "flat while its file is asked");
assert.equal(find(tile, (x) => x.kind === "image").length, 0, "no image() on a file not there yet");
assert.deepEqual(tile.props.rounded, [5], "radius size / 4: the logos' rx 6 on 24");
projTile(st, { color: "#d4825d", size: 12, letter: letter() });
projTile(st, { color: "#3366cc", size: 12, letter: letter() });
assert.equal(tasks.length, 1, "one task for every miss of a render");
await Promise.all(tasks);
const file = join(home, tilePath("#d4825d"));
assert.equal(readFileSync(file, "utf8"), ditherSvg("#d4825d"), "the file: the background alone");
assert.ok(existsSync(join(home, tilePath("#3366cc"))));
assert.equal(notified, 1, "then a redraw");
tile = projTile(st, { color: "#D4825D", size: 20, letter: letter() });
const img = find(tile, (x) => x.kind === "image");
assert.equal(img.length, 1);
assert.deepEqual(img[0].props.path, ["data/project-tiles/d4825d-v1.svg"]);
assert.deepEqual(img[0].props.size, [20]);
assert.equal(tile.kids.at(-1).kids[0], "K", "the letter over the background");
assert.equal(tile.props.bg, undefined, "no flat colour under it");
assert.equal(LETTER, "#ffffff");
// Another copy (another mod): the file is there, nothing written again.
const before = writes;
tasks.length = 0;
const st2 = tilesFrame(tileState(), cx);
projTile(st2, { color: "#d4825d", size: 16, letter: letter() });
await Promise.all(tasks);
assert.equal(writes, before, "a file already there is not written again");
assert.ok(st2.known.has("#d4825d"));
// Not a colour: flat, nothing asked. While checking: nothing asked either.
tasks.length = 0;
projTile(st2, { color: "ansi3", size: 16, letter: letter() });
isChecking = true;
projTile(tilesFrame(tileState(), cx), { color: "#123456", size: 16, letter: letter() });
isChecking = false;
assert.equal(tasks.length, 0, "no task for a name, nor while checking");
// A colour whose file can't be written: flat for good, no loop of redraws.
const bad = tilesFrame(tileState(), cx);
tasks.length = 0;
notified = 0;
projTile(bad, { color: "#abcdef", size: 16, letter: letter() });
rmSync(join(home, "data"), { recursive: true, force: true });
writeFileSync(join(home, "data"), "a file where the folder should be");
await Promise.all(tasks);
assert.equal(notified, 0, "nothing came: no redraw");
tasks.length = 0;
projTile(bad, { color: "#abcdef", size: 16, letter: letter() });
assert.equal(tasks.length, 0, "never asked again");
rmSync(join(home, "data"), { force: true });
console.log("projtile tile: ok");

// ---------- the cost of a render (kt-kanban: 12 px marks, one per card) ----------
const N = 200;
const warm = tilesFrame(tileState(), cx);
warm.known.add("#d4825d");
let t0 = performance.now();
for (let i = 0; i < N; i++) projTile(warm, { color: "#d4825d", size: 12, letter: letter() });
const perTile = ((performance.now() - t0) * 1000) / N;
t0 = performance.now();
for (let i = 0; i < 20; i++) ditherSvg(`#${(0x203040 + i * 0x0a0b0c).toString(16).padStart(6, "0")}`);
const perSvg = (performance.now() - t0) / 20;
console.log(`projtile cost: ${perTile.toFixed(1)} µs a tile in a render (mocked elements, ${N} tiles), ${perSvg.toFixed(2)} ms an SVG (once a colour, off the render)`);
console.log("projtile: ok");
