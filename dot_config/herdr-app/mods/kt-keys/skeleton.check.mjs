// bun ~/.config/herdr-app/mods/kt-keys/skeleton.check.mjs: skeleton.js's bricks (widths in px, in share
// and full, the line box kept, the ring, the card with and without its band), the list's bound (8 rows,
// 1 + 5 elements a row), ONE loop for a whole region and none in reduced motion or without a motion
// state, and swap() (net when no skeleton stood there, faded in once after one). gpui-kit mocked.
import assert from "node:assert/strict";
import { plugin } from "bun";

const el = (kind = "div") => {
  const node = { kind, kids: [], props: {}, loops: [], tr: [], on: {} };
  const p = new Proxy(node, {
    get(target, k) {
      if (k in target) return target[k];
      return (...a) => {
        if (k === "child") target.kids.push(a[0]);
        else if (k === "children") target.kids.push(...a[0]);
        else if (k === "when") return a[0] ? a[1](p) : p;
        else if (k === "loop") target.loops.push([a[0], a[1]]);
        else if (k === "transition") target.tr.push(a[0]);
        else if (k.startsWith("on_")) target.on[k] = a.at(-1);
        else target.props[k] = a;
        return p;
      };
    },
  });
  return p;
};
plugin({ setup(b) { b.module("gpui-kit", () => ({ loader: "object", exports: { div: () => el(), svg: () => el("svg") } })); } });
const { skeleton, MAX_ROWS } = await import("./skeleton.js");
const { motionState, frame } = await import("./motion.js");
const { ditherBand } = await import("./dither.js");

const t = { border: "#2a2a2a", raised: "#1c1c1c", foreground: "#e8e8e8ff" };
const count = (n) => (n && typeof n === "object" && "kids" in n ? 1 + n.kids.reduce((s, k) => s + count(k), 0) : 0);
const loops = (n) => (n && typeof n === "object" && "kids" in n ? n.loops.length + n.kids.reduce((s, k) => s + loops(k), 0) : 0);

let m = frame(motionState(), false);
let S = skeleton(t, m);

// Widths: px, a share of the parent, all of it. The bar sits in the line box of its text.
assert.deepEqual(S.line(120).props.w, [120]);
assert.deepEqual(S.line(0.6).props.w, ["60%"]);
assert.ok("w_full" in S.line().props);
const l = S.line(90, { h: 8, lh: 16 });
assert.equal(l.props.h[0] + 2 * l.props.my[0], 16);
assert.deepEqual(l.props.bg, [t.border]);
// A dot is filled, a ring is only its border.
assert.deepEqual(S.circle(32).props.bg, [t.border]);
const ring = S.circle(132, { ring: 12 });
assert.deepEqual(ring.props.border, [12]);
assert.ok(!("bg" in ring.props));
// A card: raised and bordered; no band without ditherBand, nor without a px width.
const card = S.block(320, 120);
assert.deepEqual(card.props.bg, [t.raised]);
assert.equal(card.kids.length, 0);
const SB = skeleton(t, m, { band: ditherBand });
const banded = SB.block(320, 120, { r: 14 });
assert.equal(banded.kids.length, 1);
assert.ok(count(banded) < 40, `band elements: ${count(banded)}`);
assert.equal(SB.block(0.5, 120).kids.length, 0);

// A row: mark + lines, at most 5 elements; the row height is the one given.
const r = S.row({ h: 36, icon: 16, lines: [0.5, 0.3] });
assert.deepEqual(r.props.h, [36]);
assert.ok(count(r) <= 5, `row: ${count(r)}`);
assert.equal(count(S.row({ icon: 0, lines: [0.4] })), 3);
// A list stops at MAX_ROWS, whatever is asked, and varies its widths.
assert.equal(S.list(3).kids.length, 3);
assert.equal(S.list(100).kids.length, MAX_ROWS);
assert.equal(S.list(-1).kids.length, 0);
assert.ok(count(S.list(100)) <= 1 + 5 * MAX_ROWS, `list: ${count(S.list(100))}`);
const w0 = S.list(2).kids[0].kids[1].kids[0].props.w[0];
const w1 = S.list(2).kids[1].kids[1].kids[0].props.w[0];
assert.notEqual(w0, w1);

// Bricks never loop; the region does, once.
assert.equal(loops(S.list(8)), 0);
const region = S.pulse(el().child(S.list(5)).child(S.block(200, 80)));
assert.equal(loops(region), 1);
assert.equal(region.loops[0][0], "opacity");
// Reduced motion, or no motion state: still.
assert.equal(loops(skeleton(t, frame(motionState(), true)).pulse(S.list(5))), 0);
assert.equal(loops(skeleton(t, null).pulse(S.list(5))), 0);

// swap: content at hand from the start shows net (no id, no fade, no box), as before.
m = motionState();
S = skeleton(t, frame(m, false));
const mine = () => el().id("mine");
let out = S.swap("kx", true, mine, () => S.list(3));
assert.deepEqual(out.props.id, ["mine"]);
assert.ok(!("opacity" in out.props));
// While loading: the skeleton, breathing under its own id.
S = skeleton(t, frame(m, false));
out = S.swap("ky", false, mine, () => S.list(3));
assert.equal(loops(out), 1);
assert.deepEqual(out.props.id, ["ky~sk"]);
// Then the content fades in, without rising, once, in a box: its own id kept. `first` on that render.
const firsts = [];
const body = (first) => (firsts.push(first), mine());
S = skeleton(t, frame(m, false));
assert.equal(S.arriving("ky"), true);
assert.equal(S.arriving("kx"), false);
out = S.swap("ky", true, body, () => S.list(3), { grow: true });
assert.deepEqual(out.props.id, ["ky~in"]);
assert.ok("flex_1" in out.props);
assert.deepEqual(out.kids[0].props.id, ["mine"]);
assert.deepEqual(out.props.opacity, [0]);
assert.ok(!("top" in out.props));
out.on.on_size_change({ width: 10, height: 10 }, { notify() {} });
S = skeleton(t, frame(m, false));
assert.equal(S.arriving("ky"), false);
out = S.swap("ky", true, body, () => S.list(3));
assert.deepEqual(out.props.opacity, [1]);
assert.deepEqual(firsts, [true, false]);
// Not drawn for a render: forgotten, so content coming back with its data shows net.
frame(m, false);
S = skeleton(t, frame(m, false));
out = S.swap("ky", true, mine, () => S.list(3));
assert.deepEqual(out.props.id, ["mine"]);

// still(m): rows() lands the list at rest (no h(0) opening) and the next animated render keeps it so.
const { rows } = await import("./motion.js");
const { still } = await import("./skeleton.js");
const ms = motionState();
const cxr = { notify() {}, timer: { after() {} } };
const items = ["a", "b", "c"];
const plain = rows(still(frame(ms, false)), cxr, "kl", items, (x) => x, () => el());
assert.equal(plain.length, 3);
assert.ok(plain.every((r) => !("h" in r.props)));
const next = rows(frame(ms, false), cxr, "kl", items, (x) => x, () => el());
assert.ok(next.every((r) => !("h" in r.props) && r.props.opacity?.[0] === 1), "rows land at rest");
// Without still(): the same first render opens each row from 0 (the jump still() avoids).
const mo = motionState();
assert.ok(rows(frame(mo, false), cxr, "kl", items, (x) => x, () => el()).every((r) => r.props.h?.[0] === 0));
// Reduced motion: the skeleton still, the content net.
const mr = motionState();
S = skeleton(t, frame(mr, true));
assert.equal(loops(S.swap("kz", false, () => el(), () => S.list(3))), 0);
S = skeleton(t, frame(mr, true));
assert.ok(!("opacity" in S.swap("kz", true, () => el(), () => S.list(3)).props));

// readyFor (#42): ready means read for the target followed NOW, not "some data exists".
const { readyFor } = await import("./skeleton.js");
// First opening: nothing read yet, a target: the skeleton.
assert.equal(readyFor(undefined, "t1"), false);
// Another target (thread, branch, worktree, folder): the previous one's data must not show.
assert.equal(readyFor("t1", "t2"), false);
// The same target read again: what is shown stays.
assert.equal(readyFor("t1", "t1"), true);
// A failed read answers too: its target is recorded, no skeleton left standing.
assert.equal(readyFor("t2", "t2"), true);
// No target (no terminal, no folder): nothing to read, the panel says why.
assert.equal(readyFor(undefined, null), true);
assert.equal(readyFor("t1", null), true);
// Composite targets compare as their key strings (JSON of [machine, folder]).
assert.equal(readyFor(JSON.stringify([null, "/a"]), JSON.stringify([null, "/a"])), true);
assert.equal(readyFor(JSON.stringify([null, "/a"]), JSON.stringify([null, "/b"])), false);
// swap across a change of target: ready, then not (the skeleton again), then ready: the content fades in
// again (its fade id was not drawn while the skeleton stood, so it is forgotten).
const mt = motionState();
const cnt = () => el().id("cnt");
S = skeleton(t, frame(mt, false));
S.swap("kt", false, cnt, () => S.list(2));
S = skeleton(t, frame(mt, false));
out = S.swap("kt", true, cnt, () => S.list(2));
assert.deepEqual(out.props.opacity, [0]);
out.on.on_size_change({ width: 10, height: 10 }, { notify() {} });
S = skeleton(t, frame(mt, false));
assert.deepEqual(S.swap("kt", true, cnt, () => S.list(2)).props.opacity, [1]);
S = skeleton(t, frame(mt, false));
assert.deepEqual(S.swap("kt", false, cnt, () => S.list(2)).props.id, ["kt~sk"]);
S = skeleton(t, frame(mt, false));
assert.equal(S.arriving("kt"), true);
assert.deepEqual(S.swap("kt", true, cnt, () => S.list(2)).props.opacity, [0]);
console.log("ok");
