// bun ~/.config/herdr-app/mods/kt-keys/motion.check.mjs: motion.js's mount fade (once per id, again
// once forgotten), its fold (0, then the measured height), ink, fade, pulse, and reduced motion (no
// transition at all), with gpui-kit mocked. Then rows() (cascade in and out from the top, the rows
// going out first, one timer per wave, a row coming back, the 12-row threshold) and sharpen(). Not
// loaded by Herdr; herdr-app check does the layout.
import assert from "node:assert/strict";
import { plugin } from "bun";

// A mock element: records its builder calls (last value per call, plus every transition) and handlers.
const el = (kind = "div") => {
  const node = { kind, kids: [], props: {}, tr: [], trp: {}, on: {} };
  const p = new Proxy(node, {
    get(target, k) {
      if (k in target) return target[k];
      return (...a) => {
        if (k === "child") target.kids.push(a[0]);
        else if (k === "children") target.kids.push(...a[0]);
        else if (k === "transition") { target.tr.push(a[0]); target.trp[a[0]] = a[1]; }
        else if (k.startsWith("on_")) target.on[k] = a.at(-1);
        else target.props[k] = a;
        return p;
      };
    },
  });
  return p;
};
plugin({ setup(build) { build.module("gpui-kit", () => ({ loader: "object", exports: { div: () => el() } })); } });
const M = await import("./motion.js");

let notified = 0;
const cx = { notify: () => notified++ };

// enter: hidden and 6 px down on its first draw, shown after its first layout, once.
const m = M.motionState();
let a = M.enter(M.frame(m, false), el(), "tab-a");
assert.deepEqual(a.props.opacity, [0]);
assert.deepEqual(a.props.top, [6]);
assert.deepEqual(a.tr.sort(), ["opacity", "top"]);
a.on.on_size_change({ width: 10, height: 10 }, cx);
assert.equal(notified, 1);
a.on.on_size_change({ width: 10, height: 12 }, cx);
assert.equal(notified, 1, "a resize does not replay");
a = M.enter(M.frame(m, false), el(), "tab-a");
assert.deepEqual(a.props.opacity, [1]);
assert.deepEqual(a.props.top, [0]);

// Another tab: tab-a is not drawn, so it is forgotten and fades in again when it comes back.
M.enter(M.frame(m, false), el(), "tab-b");
M.frame(m, false);
assert.equal(m.shown.has("tab-a"), false);
assert.deepEqual(M.enter(m, el(), "tab-a").props.opacity, [0]);

// dy 0 leaves the position alone (an absolute block); a delay reaches the policy.
const b = M.enter(M.frame(m, false), el(), "row", { dy: 0, delay: 60 });
assert.equal(b.props.top, undefined);
assert.equal(M.stagger(2, 4), 60);
assert.equal(M.stagger(9, 4), 150, "capped at 5 rows");
assert.equal(M.stagger(2, 40), 0, "no cascade on a long list");

// collapse: null closed; open, 0 then the measured height, re-measured when the content grows.
assert.equal(M.collapse(M.frame(m, false), "f", false, el()), null);
let f = M.collapse(m, "f", true, el());
assert.deepEqual(f.props.h, [0]);
assert.deepEqual(f.props.opacity, [0]);
assert.deepEqual(f.tr.sort(), ["height", "opacity"]);
const inner = f.kids[0];
notified = 0;
inner.on.on_size_change({ width: 100, height: 240 }, cx);
inner.on.on_size_change({ width: 100, height: 240 }, cx);
assert.equal(notified, 1);
f = M.collapse(M.frame(m, false), "f", true, el());
assert.deepEqual(f.props.h, [240]);
assert.deepEqual(f.props.opacity, [1]);
M.collapse(M.frame(m, false), "f", false, el());
assert.deepEqual(M.collapse(M.frame(m, false), "f", true, el()).props.h, [0], "reopening opens again");

// ink glides on its four edges; fade moves its layer's opacity; pulse loops only while loading.
assert.deepEqual(M.ink(M.frame(m, false), el()).tr.sort(), ["height", "left", "top", "width"]);
const on = M.fade(m, el(), true);
assert.deepEqual([on.props.opacity, on.tr], [[1], ["opacity"]]);
assert.ok(M.pulse(m, el(), true).props.loop);
assert.equal(M.pulse(m, el(), false).props.loop, undefined);

// Reduced motion: the final state, no transition, no loop, no extra render.
const r = M.frame(M.motionState(), true);
const e = M.enter(r, el(), "x");
assert.equal(e.props.opacity, undefined);
assert.deepEqual([e.tr, e.on], [[], {}]);
const body = el();
assert.equal(M.collapse(r, "c", true, body), body);
assert.deepEqual(M.ink(r, el()).tr, []);
assert.deepEqual(M.fade(r, el(), false).tr, []);
assert.equal(M.pulse(r, el(), true).props.loop, undefined);

// rows(): a cx whose one-shot timers are kept, to be fired by hand.
const timers = [];
const rcx = { notify: () => notified++, timer: { after: (ms, fn) => timers.push({ ms, fn }) } };
const L = M.motionState();
const draw = (keys, reduced = false) => {
  const out = M.rows(M.frame(L, reduced), rcx, "ls", keys, (k) => k, (k, i) => {
    const r = el();
    r.props.key = [k, i];
    return r;
  });
  const ids = out.map((w) => w.props.id?.[0]).filter(Boolean);
  assert.equal(new Set(ids).size, ids.length, "no id twice");
  return out;
};
const keyOf = (w) => (w.props.key ? w.props.key[0] : w.kids[0].kids[0].props.key[0]);
const idx = (w) => w.kids[0].kids[0].props.key[1];
const measure = (out) => { for (const w of out) w.kids[0].on.on_size_change({ width: 200, height: 26 }, rcx); };

// Mount: every row is new, shut, cascading from the top (0, 30, 60…, capped at 5 rows).
let o = draw(["a", "b", "c", "d", "e", "f", "g"]);
assert.deepEqual(o.map((w) => w.props.h), Array(7).fill([0]));
assert.deepEqual(o.map((w) => w.trp.height.delay), [0, 30, 60, 90, 120, 150, 150]);
assert.deepEqual(o.map((w) => w.props.id[0]), ["ls:a", "ls:b", "ls:c", "ls:d", "ls:e", "ls:f", "ls:g"]);
notified = 0;
measure(o);
assert.ok(notified >= 1);
o = draw(["a", "b", "c", "d", "e", "f", "g"]);
assert.deepEqual(o.map((w) => [w.props.h[0], w.props.opacity[0]]), Array(7).fill([26, 1]));
assert.equal(o[3].trp.height.delay, 90, "a render inside the cascade keeps the row's delay");
assert.equal(timers.length, 0, "no timer without a row going");
draw(["a", "b", "c", "d", "e", "f", "g"]);
assert.equal(timers.length, 0, "the same list again: nothing");

// Exit wave: b, d, f, g go. Still drawn in place, shut, ease-in-out, cascading from the top; ONE timer.
o = draw(["a", "c", "e"]);
assert.deepEqual(o.map(keyOf), ["a", "b", "c", "d", "e", "f", "g"]);
const going = o.filter((w) => w.props.h[0] === 0);
assert.deepEqual(going.map(keyOf), ["b", "d", "f", "g"]);
assert.deepEqual(going.map((w) => w.trp.height.delay), [0, 30, 60, 90], "out from the top");
assert.deepEqual(going.map((w) => [w.props.opacity[0], w.trp.opacity.easing]), Array(4).fill([0, "ease-in-out"]));
assert.deepEqual(going.map(idx), [-1, -1, -1, -1]);
assert.equal(timers.length, 1, "one timer for the wave");
assert.equal(timers[0].ms, 90 + M.MS.open + 40);
draw(["a", "c", "e"]);
assert.equal(timers.length, 1, "a render during the wave starts no other");
notified = 0;
timers.shift().fn(rcx);
assert.equal(notified, 1, "the wave leaves in one render");
o = draw(["a", "c", "e"]);
assert.deepEqual(o.map(keyOf), ["a", "c", "e"]);

// Swap: c goes and x, y come: c leaves at once, the new rows wait HANDOFF, then cascade.
o = draw(["x", "a", "y", "e"]);
assert.deepEqual(o.map(keyOf), ["x", "a", "c", "y", "e"], "c closes right under a, where it was");
const by = Object.fromEntries(o.map((w) => [keyOf(w), w]));
assert.equal(by.c.trp.height.delay, 0);
assert.deepEqual([by.x.trp.height.delay, by.y.trp.height.delay], [M.MS.hover, M.MS.hover + 30], "in after out");
assert.deepEqual([by.x.props.h[0], by.a.props.h[0]], [0, 26]);
measure(o);
timers.shift().fn(rcx);

// A row that comes back while it closes: same id, open again, and its wave's timer drops nothing.
o = draw(["x", "a", "e"]);
assert.equal(timers.length, 1);
assert.equal(o.find((w) => keyOf(w) === "y").props.h[0], 0);
o = draw(["x", "a", "y", "e"]);
assert.deepEqual(o.map(keyOf), ["x", "a", "y", "e"]);
assert.deepEqual(o[2].props.id, ["ls:y"]);
assert.deepEqual([o[2].props.h[0], o[2].props.opacity[0]], [26, 1]);
notified = 0;
timers.shift().fn(rcx);
assert.equal(notified, 0, "nothing left to drop");
assert.deepEqual(draw(["x", "a", "y", "e"]).map(keyOf), ["x", "a", "y", "e"]);

// More than 12 rows, before or after: plain rows, at once, no timer; back under, nothing replays.
const many = "abcdefghijklm".split("");
o = draw(many);
assert.equal(o[0].props.key[0], "a", "plain rows, no wrapper");
o = draw(many.slice(0, 3));
assert.deepEqual(o.map(keyOf), ["a", "b", "c"], "13 to 3: gone at once");
assert.equal(timers.length, 0);
o = draw(many.slice(0, 3));
assert.deepEqual(o.map((w) => [w.props.h, w.props.opacity[0]]), Array(3).fill([undefined, 1]), "no replay");
measure(o);
o = draw([...many.slice(0, 3), "n"]);
assert.deepEqual(o.map((w) => w.props.h[0]), [26, 26, 26, 0], "only the new row opens");

// Reduced motion: plain rows, a removed row is gone at once, no timer.
o = draw(["a", "b"], true);
assert.deepEqual(o.map((w) => w.props.key[0]), ["a", "b"]);
assert.equal(timers.length, 0);

// sharpen(): the sharp text at 0 and four copies 1 px off at 0.22, then sharp; the copies leave
// at the first render after the fade. Reduced: the text alone.
const S = M.motionState();
let s = M.sharpen(M.frame(S, false), "ttl", () => el());
assert.equal(s.kids.length, 5);
assert.deepEqual(s.kids[0].props.opacity, [0]);
assert.deepEqual(s.kids.slice(1).map((k) => [k.props.left[0], k.props.top[0], k.props.opacity[0]]),
  [[-1, 0, 0.22], [1, 0, 0.22], [0, -1, 0.22], [0, 1, 0.22]]);
notified = 0;
s.on.on_size_change({ width: 80, height: 20 }, rcx);
s.on.on_size_change({ width: 80, height: 20 }, rcx);
assert.equal(notified, 1);
s = M.sharpen(M.frame(S, false), "ttl", () => el());
assert.deepEqual([s.kids[0].props.opacity[0], s.kids[1].props.opacity[0], s.kids[1].props.left[0]], [1, 0, 0]);
S.st.set("ttl", Date.now() - 1000);
assert.equal(M.sharpen(M.frame(S, false), "ttl", () => el()).kids.length, 1, "copies gone after the fade");
assert.deepEqual(M.sharpen(M.frame(S, false), "pg", () => el(), { dy: M.DY.page }).props.top, [12]);
const sr = M.sharpen(M.frame(M.motionState(), true), "ttl", () => el());
assert.deepEqual([sr.kids.length, sr.tr, sr.on], [1, [], {}]);

console.log("motion.js: ok");
