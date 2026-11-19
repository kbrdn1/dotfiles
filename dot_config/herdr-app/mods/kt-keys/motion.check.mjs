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
notified = 0;
measure(o);
assert.equal(notified, 0, "at rest: measured quietly, no render");
o = draw([...many.slice(0, 3), "n"]);
assert.deepEqual(o.map((w) => w.props.h?.[0]), [undefined, undefined, undefined, 0], "only the new row opens, the others rest");

// At rest: once its opening is over, a row lets go of its height (auto) and follows its content with
// no render; leaving, it is pinned at its measured height (no height transition), then folds on the
// next render (one more timer for the wave), then goes.
timers.length = 0;
const RS = M.motionState();
const rdraw = (keys) => M.rows(M.frame(RS, false), rcx, "rs", keys, (k) => k, () => el());
let ro = rdraw(["p", "q"]);
for (const w of ro) w.kids[0].on.on_size_change({ width: 200, height: 40 }, rcx);
ro = rdraw(["p", "q"]);
assert.deepEqual(ro.map((w) => [w.props.h?.[0], w.tr.includes("height")]), [[40, true], [40, true]], "opening: its height");
for (const k of ["p", "q"]) RS.st.get("rs").rest.set(k, Date.now() - 1);
ro = rdraw(["p", "q"]);
assert.deepEqual(ro.map((w) => [w.props.h, w.tr.includes("height"), w.props.opacity[0]]), [[undefined, true, 1], [undefined, true, 1]], "at rest: auto, its height transition still declared");
notified = 0;
ro[0].kids[0].on.on_size_change({ width: 200, height: 90 }, rcx);
assert.deepEqual([notified, RS.h.get("rs:p")], [0, 90], "an inner unfold: followed, measured, no render");
ro = rdraw(["q"]);
const pinned = ro[0];
assert.deepEqual([pinned.props.h, pinned.props.opacity, pinned.tr.sort()], [[90], [0], ["height", "opacity"]], "leaving at rest: pinned at its height, fading, the height transition declared");
assert.deepEqual(timers.map((x) => x.ms), [20, M.MS.open + 40 + 20], "a fold timer and a drop timer for the wave");
notified = 0;
timers.shift().fn(rcx);
assert.equal(notified, 1);
ro = rdraw(["q"]);
assert.deepEqual([ro[0].props.h, ro[0].tr.includes("height")], [[0], true], "then it folds from there");
timers.shift().fn(rcx);
assert.deepEqual(rdraw(["q"]).length, 1, "then it goes");
ro = rdraw(["q", "p"]);
assert.deepEqual(ro[1].props.h, [0], "back later: a new row, opening");

// A sidebar group of 3 threads at rest, folded (its rows become []): gpui animates only the target changes
// that follow a declared transition, so each card declares its height transition on EVERY render
// from rest to gone (at rest, pinned, folding). Without it on the pinned render, the fold to 0 would
// be the transition's first target: the cards would drop at once (the bug of 2026-11-18).
{
  timers.length = 0;
  const G = M.motionState();
  const gdraw = (keys) => M.rows(M.frame(G, false), rcx, "kt-th-p-x", keys, (k) => k, () => el());
  let g = gdraw(["t1", "t2", "t3"]);
  for (const w of g) w.kids[0].on.on_size_change({ width: 260, height: 58 }, rcx);
  g = gdraw(["t1", "t2", "t3"]);
  for (const k of ["t1", "t2", "t3"]) G.st.get("kt-th-p-x").rest.set(k, Date.now() - 1);
  const stages = [gdraw(["t1", "t2", "t3"]), gdraw([])];
  timers.shift().fn(rcx); // the 20 ms one: they fold
  stages.push(gdraw([]));
  assert.deepEqual(stages.map((s) => s.map((w) => w.tr.includes("height"))), [[true, true, true], [true, true, true], [true, true, true]],
    "rest, pinned, folding: the height transition declared on each render");
  assert.deepEqual(stages.map((s) => s.map((w) => w.props.h?.[0])), [[undefined, undefined, undefined], [58, 58, 58], [0, 0, 0]],
    "auto at rest, pinned at 58, then to 0");
  assert.deepEqual(stages[2].map((w) => w.trp?.height?.delay ?? null).length, 3);
  timers.length = 0;
}
timers.length = 0;
for (const w of ro) w.kids[0].on.on_size_change({ width: 200, height: 50 }, rcx);
rdraw(["q", "p"]);
for (const k of ["p", "q"]) RS.st.get("rs").rest.set(k, Date.now() - 1);
rdraw(["q", "p"]);
rdraw(["q"]);
ro = rdraw(["q", "p"]);
assert.deepEqual([ro.map((w) => w.props.id[0]), ro[1].props.h, ro[1].props.opacity, ro[1].tr.includes("height")], [["rs:q", "rs:p"], [50], [1], true],
  "pinned, then back: its height again, under the same id");
for (const x of timers.splice(0)) x.fn(rcx);
assert.equal(rdraw(["q", "p"]).length, 2, "its wave's timers drop nothing");

// Reduced motion: plain rows, a removed row is gone at once, no timer.
o = draw(["a", "b"], true);
assert.deepEqual(o.map((w) => w.props.key[0]), ["a", "b"]);
assert.equal(timers.length, 0);

// rows() builds each row in the order of the children it returns, closing ones included, on its three
// paths (animated with rows closing, plain over 12, reduced): adopters count the index in the row
// callback for scroll_to_item (rows-adopt's invariant).
const order = (m, items, reduced = false) => {
  const built = [];
  const out = M.rows(M.frame(m, reduced), rcx, "OR", items, (x) => x, (x, i) => { built.push([x, i]); return el(); });
  return { built, ids: out.map((w) => w.props.id?.[0]?.split(":")[1]) };
};
const OM = M.motionState();
order(OM, ["a", "b", "c", "d"]);
let ord = order(OM, ["a", "d", "e"]);
assert.deepEqual(ord.built.map(([x]) => x), ord.ids, "animated: built in the children's order");
assert.deepEqual(ord.built, [["a", 0], ["b", -1], ["c", -1], ["d", 1], ["e", 2]]);
timers.length = 0;
const big = Array.from({ length: 14 }, (_, i) => `k${i}`);
assert.deepEqual(order(OM, big).built.map(([, i]) => i), big.map((_, i) => i), "plain: in order");
assert.deepEqual(order(M.motionState(), ["x", "y"], true).built, [["x", 0], ["y", 1]], "reduced: in order");

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

// leave(): the overlay is marked leaving and redrawn, ONE timer closes it after MS.leave, a second call
// does nothing; sheet() gives its veil and card their in and out states. Reduced: closed at once.
const O = M.motionState();
const ocx = { n: 0, timers: [], notify() { this.n++; }, timer: { after: (ms, fn) => ocx.timers.push({ ms, fn }) } };
let closed = 0;
const close = (c) => { assert.ok(c, "close gets a cx"); closed++; };
let sh = M.sheet(M.frame(O, false), "ov", false);
assert.deepEqual([sh.veil(el()).props.opacity, sh.card(el()).props.top], [[0], [6]], "before its first layout: out");
sh = M.sheet(M.frame(O, false), "ov", true);
let v = sh.veil(el());
assert.deepEqual([v.props.opacity, sh.card(el()).props.top, v.trp.opacity], [[1], [0], { duration: M.MS.open, delay: 0, easing: "ease-out" }], "shown: in");
M.leave(O, ocx, "ov", close);
assert.deepEqual([M.leaving(O, "ov"), ocx.n, ocx.timers.map((x) => x.ms), closed], [true, 1, [M.MS.leave], 0]);
M.leave(O, ocx, "ov", close);
assert.deepEqual([ocx.n, ocx.timers.length], [1, 1], "a second leave does nothing");
sh = M.sheet(M.frame(O, false), "ov", true);
v = sh.veil(el());
assert.deepEqual([v.props.opacity, sh.card(el()).props.top, v.trp.opacity], [[0], [6], { duration: 140, delay: 0, easing: "ease-in" }], "leaving: out, ease-in");
ocx.timers.shift().fn(ocx);
assert.equal(closed, 1, "closed once, by the timer");
const R = M.frame(M.motionState(), true);
M.leave(R, ocx, "ov", close);
assert.deepEqual([closed, ocx.timers.length, ocx.n], [2, 0, 1], "reduced: closed at once, no timer, no redraw");
const rsh = M.sheet(R, "ov", false);
assert.deepEqual([rsh.veil(el()).props, rsh.card(el()).props], [{}, {}], "reduced: veil and card as they are");

// collapse() closing: a builder folds to 0 (built once more), ONE timer when cx is given, then null;
// an element (or null) still shuts at once; reopened while closing, it opens again.
const F = M.motionState();
let builds = 0;
const build = () => { builds++; return el(); };
let fo = M.collapse(M.frame(F, false), "fold", true, build);
assert.equal(builds, 1);
fo.kids[0].on.on_size_change({ width: 10, height: 120 }, ocx);
fo = M.collapse(M.frame(F, false), "fold", true, build);
assert.deepEqual(fo.props.h, [120]);
ocx.timers.length = 0;
fo = M.collapse(M.frame(F, false), "fold", false, build, { cx: ocx });
assert.deepEqual([fo.props.h, fo.props.opacity, fo.trp.height.easing, builds], [[0], [0], "ease-in-out", 3], "closing: to 0, the body built again");
assert.deepEqual(ocx.timers.map((x) => x.ms), [M.MS.open + 40]);
fo = M.collapse(M.frame(F, false), "fold", false, build, { cx: ocx });
assert.equal(ocx.timers.length, 1, "one timer for the fold");
assert.deepEqual(fo.props.h, [0]);
F.st.set("fold~shut", Date.now() - 1000);
assert.equal(M.collapse(M.frame(F, false), "fold", false, build, { cx: ocx }), null, "past ms: gone");
assert.equal(F.h.has("fold"), false);
fo = M.collapse(M.frame(F, false), "fold", true, build);
fo.kids[0].on.on_size_change({ width: 10, height: 80 }, ocx);
M.collapse(M.frame(F, false), "fold", true, build);
M.collapse(M.frame(F, false), "fold", false, build);
assert.deepEqual(M.collapse(M.frame(F, false), "fold", true, build).props.h, [80], "reopened while closing: its height again");
assert.equal(M.collapse(M.frame(F, false), "fold", false, el()), null, "an element: shut at once");
assert.equal(M.collapse(M.frame(F, false), "fold2", false, build), null, "never measured: nothing to fold");
assert.equal(M.collapse(M.frame(M.motionState(), true), "fold", false, build), null, "reduced: shut at once");

// sweep(): at `from`, opaque; its first layout sends it to `to` and fades it (left after `delay`,
// opacity after `fadeDelay`, ease-in); gone at the first render past its life, without a timer.
const W = M.motionState();
let w = M.sweep(M.frame(W, false), "wave-1", el(), { from: -24, to: 300, ms: 240, delay: 40, fade: 120, fadeDelay: 80 });
assert.deepEqual([w.props.left, w.props.opacity, w.props.absolute], [[-24], [1], []]);
assert.deepEqual(w.tr.sort(), ["left", "opacity"]);
assert.deepEqual(w.trp.left, { duration: 240, delay: 40, easing: "ease-out" });
assert.deepEqual(w.trp.opacity, { duration: 120, delay: 80, easing: "ease-in" });
const n0 = notified;
w.on.on_size_change({ width: 24, height: 40 }, cx);
w.on.on_size_change({ width: 24, height: 40 }, cx);
assert.equal(notified, n0 + 1, "its first layout redraws, once");
w = M.sweep(M.frame(W, false), "wave-1", el(), { from: -24, to: 300, ms: 240, delay: 40, fade: 120, fadeDelay: 80 });
assert.deepEqual([w.props.left, w.props.opacity], [[300], [0]], "sent across, fading");
W.st.set("wave-1", Date.now() - 400); // its life (40 + 240 + 40) is over
assert.equal(M.sweep(M.frame(W, false), "wave-1", el(), { from: -24, to: 300, ms: 240, delay: 40 }), null, "gone, no timer");
assert.notEqual(M.sweep(M.frame(W, false), "wave-2", el(), { from: -24, to: 300 }), null, "a new wave, a new id");
M.frame(W, false); M.frame(W, false);
assert.equal(W.st.has("wave-1"), false, "frame() forgets it once it isn't drawn");
assert.equal(M.sweep(M.frame(M.motionState(), true), "wave-1", el(), { from: -24, to: 300 }), null, "reduced: nothing drawn");
assert.deepEqual(M.sweep(M.frame(M.motionState(), false), "rail", el(), { from: 8, to: 8, ms: 0, fade: 180, fadeDelay: 300 }).props.left, [8], "from === to: it only fades");

console.log("motion.js: ok");
