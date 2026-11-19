// bun ~/.config/herdr-app/mods/kt-keys/panel.check.mjs: panel.js on a mocked layout. Opening shows the
// column at once and sets "in" (no timer); a copy draws its content away with no transition and a cue of that
// opening, whose first layout makes it ready, then glides in. Closing sets "out", ONE timer hides the column
// after 180 ms then says "done". Pressed again while it goes (toggle, or a surface's key: showPanel), it comes
// back and the timer does nothing. Reduced motion: the column at once, "done", no timer. A step over a second
// old, or "done", draws in place. The wrapper keeps one id. herdr and gpui-kit mocked.
import assert from "node:assert/strict";
import { plugin } from "bun";

const store = {};
const ran = [];
let hidden = true;
const el = () => {
  const node = { kids: [], props: {}, trs: {}, on: {} };
  const p = new Proxy(node, {
    get(target, k) {
      if (k in target) return target[k];
      return (...a) => {
        if (k === "child") target.kids.push(a[0]);
        else if (k === "transition") target.trs[a[0]] = a[1];
        else if (k.startsWith("on_")) target.on[k] = a.at(-1);
        else target.props[k] = a;
        return p;
      };
    },
  });
  return p;
};
plugin({
  setup(b) {
    b.module("gpui-kit", () => ({ loader: "object", exports: { div: () => el() } }));
    b.module("herdr", () => ({
      loader: "object",
      exports: {
        shared: (k) => store[k],
        setShared: (k, v) => { store[k] = v; },
        layout: () => ({ id: "root", children: [{ id: "work" }, { id: "panel", hidden }] }),
        run: (name, args) => {
          ran.push(`${name}:${args.id}`);
          if (args.id === "panel") hidden = name === "layout.hide" ? true : name === "layout.show" ? false : !hidden;
        },
      },
    }));
  },
});
const { showPanel, hidePanel, togglePanel, panelOpen, stepOf, panelIn, KEY } = await import("./panel.js");
const { MS } = await import("./motion.js");

// A cx whose one-shot timers wait to be fired by hand.
let timers = [];
const cx = { timer: { after: (ms, f) => timers.push({ ms, f }) } };
const fire = () => { const t = timers; timers = []; t.forEach(({ f }) => f(cx)); return t.map(({ ms }) => ms); };
const s = () => store[KEY];

// Opening: the column at once, the step "in", no timer.
showPanel(cx, false);
assert.deepEqual(ran, ["layout.show:panel"]);
assert.deepEqual([s().dir, s().gen, timers.length], ["in", 1, 0]);
assert.equal(panelOpen(), true);
// A copy not ready for this opening: away, no transition, a cue of its own.
assert.deepEqual(stepOf(s(), s().at, undefined), { x: 12, opacity: 0, easing: null, cue: 1 });
// Ready (the cue laid out): in its place, gliding.
assert.deepEqual(stepOf(s(), s().at + 50, 1), { x: 0, opacity: 1, easing: "ease-out", cue: null });
// Open already: nothing.
showPanel(cx, false);
assert.deepEqual([ran.length, s().gen], [1, 1]);

// Closing: "out" at once, the column waits for its content, ONE timer of 180 ms, then hidden and "done".
hidePanel(cx, false);
assert.equal(s().dir, "out");
assert.deepEqual(stepOf(s(), s().at, 1), { x: 12, opacity: 0, easing: "ease-in", cue: null });
assert.equal(hidden, false);
assert.equal(panelOpen(), false, "on its way out");
hidePanel(cx, false);
assert.equal(timers.length, 1, "going already: no second timer");
assert.deepEqual(fire(), [MS.open]);
assert.equal(ran.at(-1), "layout.hide:panel");
assert.equal(hidden, true);
assert.equal(s().dir, "done");
assert.deepEqual(stepOf(s(), s().at, 1), { x: 0, opacity: 1, easing: null, cue: null }, "done: in place");
hidePanel(cx, false);
assert.equal(timers.length, 0, "hidden: nothing");

// Pressed again while it goes: it comes back, the column stays, the timer does nothing.
togglePanel(cx, false);
assert.equal(s().dir, "in");
togglePanel(cx, false);
assert.equal(s().dir, "out");
togglePanel(cx, false);
assert.equal(s().dir, "in", "back");
const shows = ran.filter((r) => r === "layout.show:panel").length;
fire();
assert.equal(hidden, false, "the close's timer is stale");
assert.equal(s().dir, "in");
// A surface's key while it goes (showPanel): back too, no second layout.show.
hidePanel(cx, false);
showPanel(cx, false);
fire();
assert.equal(hidden, false);
assert.equal(ran.filter((r) => r === "layout.show:panel").length, shows, "shown all along");

// Reduced motion: the column at once, "done", no timer.
togglePanel(cx, true);
assert.deepEqual([hidden, s().dir, timers.length], [true, "done", 0]);
togglePanel(cx, true);
assert.deepEqual([hidden, s().dir, timers.length], [false, "done", 0]);

// Over a second old, or none: in place, whatever it said.
assert.deepEqual(stepOf({ gen: 3, dir: "out", at: 0 }, 5000, 2), { x: 0, opacity: 1, easing: null, cue: null });
assert.deepEqual(stepOf({ gen: 3, dir: "in", at: 0 }, 5000, 2), { x: 0, opacity: 1, easing: null, cue: null });
assert.deepEqual(stepOf(undefined, 5000, undefined), { x: 0, opacity: 1, easing: null, cue: null });

// panelIn: one wrapper with the same id, the root inside; waiting: away, no transition, the cue last.
const m = { reduced: false };
const root = el();
const w = panelIn(m, root, { gen: 9, dir: "in", at: 100 }, 120);
assert.deepEqual(w.props.id, ["kt-panel-motion"]);
assert.equal(w.kids[0], root);
assert.deepEqual([w.props.left, w.props.opacity], [[12], [0]]);
assert.deepEqual(w.trs, {}, "no transition while waiting: it jumps away");
const cue = w.kids[1];
assert.deepEqual(cue.props.id, ["kt-panel-cue-9"]);
assert.ok(cue.props.absolute);
// The cue's first layout: the copy is ready, it redraws; again: nothing.
let notes = 0;
cue.on.on_size_change({ width: 1, height: 1 }, { notify: () => notes++ });
cue.on.on_size_change({ width: 1, height: 1 }, { notify: () => notes++ });
assert.deepEqual([m.panelReady, notes], [9, 1]);
// Then: in place, gliding 180 ms ease-out, no cue.
const w2 = panelIn(m, el(), { gen: 9, dir: "in", at: 100 }, 140);
assert.deepEqual([w2.props.left, w2.props.opacity], [[0], [1]]);
assert.deepEqual(w2.trs.left, { duration: MS.open, delay: 0, easing: "ease-out" });
assert.deepEqual(w2.trs.opacity, { duration: MS.open, delay: 0, easing: "ease-out" });
assert.equal(w2.kids.length, 1);
assert.deepEqual(w2.props.id, ["kt-panel-motion"]);
// Out: away, ease-in.
const w3 = panelIn(m, el(), { gen: 10, dir: "out", at: 100 }, 150);
assert.equal(w3.trs.left.easing, "ease-in");
assert.deepEqual([w3.props.left, w3.props.opacity], [[12], [0]]);
// Reduced motion: the wrapper alone, no move, no transition, no cue.
const still = panelIn({ reduced: true }, el(), { gen: 9, dir: "in", at: 100 }, 120);
assert.deepEqual(still.props.id, ["kt-panel-motion"]);
assert.deepEqual([still.props.left, still.props.opacity, still.kids.length], [undefined, undefined, 1]);
assert.deepEqual(still.trs, {});

console.log("panel: ok");
