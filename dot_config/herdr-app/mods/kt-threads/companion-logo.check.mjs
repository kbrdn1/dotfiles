// bun ~/.config/herdr-app/mods/kt-threads/companion-logo.check.mjs: the sub-agents' coiffes (#71).
// variantFor: the same key, the same coiffe; siblings all told apart (up to ten); the bridge's window
// sliding (its oldest gone) never moves one wearing its own hash's coiffe. companion(): a sub-agent's coiffe
// sits in the glyph's box (so it bobs with it) where the build's sheet draws it; a parent has none.
// gpui-kit and herdr mocked. Not loaded by Herdr; herdr-app check does the layout.
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { plugin } from "bun";

const el = (kind, arg) => {
  const node = { kind, arg, kids: [], props: {} };
  const p = new Proxy(node, {
    get(target, k) {
      if (k in target) return target[k];
      return (...a) => {
        if (k === "child") target.kids.push(a[0]);
        else if (k === "when") return a[0] ? a[1](p) : p;
        else target.props[k] = a;
        return p;
      };
    },
  });
  return p;
};
plugin({
  setup(build) {
    build.module("gpui-kit", () => ({ loader: "object", exports: { div: () => el("div"), image: (s) => el("image", s), svg: (s) => el("svg", s) } }));
    build.module("herdr", () => ({ loader: "object", exports: { settings: () => ({ dark: true }), theme: () => ({}), shared: () => undefined } }));
  },
});
const { variantFor, companion } = await import("./companion-logo.js");

const TEN = ["crown", "cap", "bow", "sprout", "wizard", "beanie", "halo", "tophat", "bird", "flower"];
const keys = (n, from = 0) => Array.from({ length: n }, (_, i) => `t9:toolu_${String(from + i).padStart(4, "0")}`);

// the same key, the same coiffe; a known one; none without a key
assert.equal(variantFor("t9:toolu_0001"), variantFor("t9:toolu_0001"));
assert.ok(TEN.includes(variantFor("t9:toolu_0001")));
assert.equal(variantFor(null), null);

// up to ten siblings: all told apart, whatever their keys
for (let from = 0; from < 200; from += 10) {
  const kin = keys(10, from);
  assert.equal(new Set(kin.map((k) => variantFor(k, kin))).size, 10, `siblings ${from}..${from + 9}`);
}
// the eldest keeps its hash's coiffe; a key not in the list is taken as the youngest
const kin = keys(8);
assert.equal(variantFor(kin[0], kin), variantFor(kin[0]));
assert.equal(variantFor("t9:new", kin), variantFor("t9:new", [...kin, "t9:new"]));

// the bridge's window (its last 8): the oldest goes, a 9th comes; a sibling wearing its own hash's
// coiffe keeps it, only one that had been pushed aside may change
let moved = 0;
for (let from = 0; from < 300; from++) {
  const before = keys(8, from);
  const after = keys(8, from + 1);
  for (const k of before.slice(1)) {
    const was = variantFor(k, before);
    if (was === variantFor(k)) assert.equal(variantFor(k, after), was, `${k} lost its own coiffe`);
    else if (variantFor(k, after) !== was) moved++;
  }
}
assert.ok(moved < 300 * 7 * 0.25, `too many moves: ${moved}`);

// companion(): the coiffe is a child of the glyph's box, as the build's sheet places it at 20x16
// (k = 2, dpr 2: left -2, top round(11 x 0.21) - 7 + 1 = -4, 9x7 css)
const program = { key: "claude", icon: "icons/claude.svg", tint: false, tile: "#1c1d21" };
const tile = (o) => companion({ program, state: "working", id: "x", size: 20, height: 16, at: 1, ...o });
const glyphBox = (root) => root.kids[0].kids[0];
const sub = glyphBox(tile({ variant: "crown" }));
const hat = sub.kids.find((c) => c.kind === "image" && c.arg.includes("/var/"));
assert.equal(hat.arg, "brand/companions/out/dark/var/crown@2x.png");
assert.deepEqual([hat.props.left[0], hat.props.top[0], hat.props.w[0], hat.props.h[0]], [-2, -4, 9, 7]);
// a parent, or an unknown coiffe: no coiffe
for (const o of [{}, { variant: null }, { variant: "nope" }]) {
  assert.equal(glyphBox(tile(o)).kids.some((c) => c.kind === "image" && String(c.arg).includes("/var/")), false);
}
// 32 px: k = 3, the coiffe at 1.5 css px per art px
const big = glyphBox(companion({ program, state: "idle", id: "y", size: 32, at: 1, variant: "bird" })).kids.at(-1);
assert.equal(big.arg, "brand/companions/out/dark/var/bird@3x.png");
assert.deepEqual([big.props.w[0], big.props.h[0]], [13.5, 10.5]);
// every coiffe the code can ask for is built (brand/companions/src/build.py)
for (const v of TEN) for (const tone of ["dark", "light"]) for (const k of [2, 3]) {
  const png = `${homedir()}/.config/herdr-app/brand/companions/out/${tone}/var/${v}@${k}x.png`;
  assert.ok(existsSync(png), `${png} is missing: run build.py`);
}
console.log("companion-logo.check: ok");
