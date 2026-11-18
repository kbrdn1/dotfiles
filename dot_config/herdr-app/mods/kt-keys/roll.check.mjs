// bun ~/.config/herdr-app/mods/kt-keys/roll.check.mjs: roll.js's reels (one per digit, 0..9 in a clipped
// one-line window, top at the digit, 240 ms ease-out), the fixed characters, the keys from the right,
// and reduced motion (no transition), with gpui-kit mocked. Not loaded by Herdr.
import assert from "node:assert/strict";
import { plugin } from "bun";

const el = () => {
  const node = { kids: [], props: {}, trp: {} };
  const p = new Proxy(node, {
    get(target, k) {
      if (k in target) return target[k];
      return (...a) => {
        if (k === "child") target.kids.push(a[0]);
        else if (k === "children") target.kids.push(...a[0]);
        else if (k === "transition") target.trp[a[0]] = a[1];
        else target.props[k] = a;
        return p;
      };
    },
  });
  return p;
};
plugin({ setup(build) { build.module("gpui-kit", () => ({ loader: "object", exports: { div: () => el() } })); } });
const { roll, rollText } = await import("./roll.js");

const H = 16;
const on = { reduced: false };
const reels = (r) => r.kids.filter((k) => k.props.overflow_hidden);
const strip = (w) => w.kids[0];

// "42%": two reels and a fixed %, each one line high.
let r = roll(on, "ctx", "42%", H);
assert.equal(r.kids.length, 3);
assert.deepEqual(r.props.h, [H]);
const [four, two] = reels(r);
assert.deepEqual([strip(four).props.id, strip(four).props.top], [["ctx:3"], [-4 * H]]);
assert.deepEqual([strip(two).props.id, strip(two).props.top], [["ctx:2"], [-2 * H]]);
assert.deepEqual(four.props.h, [H], "a window one line high");
assert.equal(strip(four).kids.length, 10, "0..9");
assert.deepEqual(strip(four).kids.map((c) => c.kids[0]), "0123456789".split(""));
assert.deepEqual(strip(four).kids.map((c) => [c.props.h[0], c.props.line_height[0]]), Array(10).fill([H, `${H}px`]));
assert.deepEqual(strip(four).trp.top, { duration: 240, easing: "ease-out" });
const pct = r.kids[2];
assert.deepEqual([pct.kids[0], pct.props.id, pct.props.overflow_hidden], ["%", undefined, undefined], "% stays put");

// $, ., k and a thin space stay put; only the digits roll.
r = roll(on, "cost", "$1 847.42k", H);
assert.deepEqual(r.kids.map((k) => (k.props.overflow_hidden ? "#" : k.kids[0])), ["$", "#", " ", "#", "#", "#", ".", "#", "#", "k"]);

// Keyed from the right: 9 to 10 keeps the units' reel (it rolls 9 to 0), the tens' is new.
const ids = (x) => reels(x).map((w) => strip(w).props.id[0]);
assert.deepEqual(ids(roll(on, "n", "9", H)), ["n:1"]);
assert.deepEqual(ids(roll(on, "n", "10", H)), ["n:2", "n:1"]);
assert.deepEqual(ids(roll(on, "n", "1,5k", H)), ["n:4", "n:2"]);

// snap 2: a cost's cents are fixed text on the same line, the dollars still roll, keyed as before.
r = roll(on, "cost", "$1118.15", H, { snap: 2 });
assert.deepEqual(r.kids.map((k) => (k.props.overflow_hidden ? "#" : k.kids[0])), ["$", "#", "#", "#", "#", ".", "1", "5"]);
assert.deepEqual(ids(r), ["cost:7", "cost:6", "cost:5", "cost:4"]);
assert.deepEqual(r.kids.slice(-2).map((c) => [c.props.h[0], c.props.line_height[0], c.props.id]), [[H, `${H}px`, undefined], [H, `${H}px`, undefined]]);

// Reduced motion: the same reels at their digit, no transition.
const still = roll({ reduced: true }, "ctx", "42%", H);
assert.deepEqual(strip(reels(still)[0]).props.top, [-4 * H]);
assert.deepEqual(reels(still).map((w) => strip(w).trp), [{}, {}]);

// rollText: each run of digits its own roll(), keyed by its rank; the words between are text; a time
// and an #id stay text. A tail that grows (" · 1 alerte") keeps the earlier numbers' reels.
const flat = (x) => x.kids.map((k) => (k.props.flex ? reels(k).map((w) => strip(w).props.id[0]).join(",") : k.kids[0]));
r = rollText(on, "hd", "62 mods · 38 kbrdn · lu à 14:32", H);
assert.deepEqual(flat(r), ["hd-0:2,hd-0:1", " mods · ", "hd-1:2,hd-1:1", " kbrdn · lu à 14:32"]);
assert.deepEqual([r.props.min_w, r.props.overflow_hidden, r.props.h], [[0], [], [H]], "shrinks and clips in a narrow row");
// Narrow: the last words truncate ("…"), the words before them and the reels stay whole, all on h px lines.
assert.deepEqual([r.kids[3].props.min_w, r.kids[3].props.truncate, r.kids[3].props.flex_none], [[0], [], undefined], "the last words end in …");
assert.deepEqual([r.kids[1].props.flex_none, r.kids[1].props.truncate, r.kids[1].props.line_height], [[], undefined, [`${H}px`]]);
assert.deepEqual(rollText(on, "s", "SESSIONS · 4", H).kids.map((k) => Boolean(k.props.truncate)), [true, false], "a number last: the words before it cut");
r = rollText(on, "hd", "62 mods · 39 kbrdn · 1 alerte · lu à 14:33", H);
assert.deepEqual(flat(r).filter((x) => x.startsWith("hd-")), ["hd-0:2,hd-0:1", "hd-1:2,hd-1:1", "hd-2:1"]);
assert.deepEqual(flat(rollText(on, "pr", "PR #165 · 3 checks", H)), ["PR #165 · ", "pr-0:1", " checks"]);
assert.deepEqual(flat(rollText(on, "w", "WORKING", H)), ["WORKING"]);

console.log("roll.js: ok");
