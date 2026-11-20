// bun ~/.config/herdr-app/brand/companions/src/cube.check.mjs: the LED cube companions (companion-cube.js).
// The catalog (70 faces 4 LED apart on every grid), identities (a lead's workers in its family, told apart,
// the waiting view included), the ring's bars (straight, one per worker, then shared pro rata with every
// state kept), what cube() draws per state, and companion-logo.js handing over by kt-threads' option.
// gpui-kit and herdr mocked. herdr-app check does the layout.
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
        else if (k === "children") target.kids.push(...a[0]);
        else if (k === "when") return a[0] ? a[1](p) : p;
        else target.props[k] = a;
        return p;
      };
    },
  });
  return p;
};
const SHARED = {};
let TERMS = [];
plugin({
  setup(build) {
    build.module("gpui-kit", () => ({ loader: "object", exports: { div: () => el("div"), image: (s) => el("image", s), svg: (s) => el("svg", s) } }));
    build.module("herdr", () => ({ loader: "object", exports: {
      settings: () => ({ dark: true }), theme: () => ({ blocked: "#ffdf61" }), shared: (k) => SHARED[k], setShared: (k, v) => { SHARED[k] = v; },
      terminals: () => TERMS } }));
  },
});
const C = await import("../companion-cube.js");
const L = await import("../companion-logo.js");
const APP = `${homedir()}/.config/herdr-app`;

// ---- the catalog: 7 x 10 faces, a string per grid, 70 faces at least 4 LED apart on every grid ----
const lit = (ch) => ch === "w" || ch === "b";
const all = [];
for (let f = 0; f < 7; f++) for (let v = 0; v < 10; v++) all.push([f, v]);
for (const N of [4, 5, 6, 7]) {
  assert.ok(existsSync(`${APP}/brand/companions/cube/tex-${N}.svg`), `cube/tex-${N}.svg missing: run src/cube.mjs`);
  let min = Infinity;
  for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) {
    const a = C.faceOf(...all[i], N), b = C.faceOf(...all[j], N);
    assert.equal(a.length, N * N);
    let d = 0; for (let k = 0; k < a.length; k++) d += lit(a[k]) !== lit(b[k]);
    min = Math.min(min, d);
  }
  assert.ok(min >= 4, `grid ${N}: two faces ${min} LED apart`);
}

// ---- identities ----
// an agent without a parent: from its address, the same every time
assert.deepEqual(C.identityOf({ address: "t42" }), C.identityOf({ address: "t42" }));
// a lead's workers: ranked by address; the first nine in the lead's family, all told apart from the lead and each other
TERMS = [{ address: "t1", status: "working" }, ...Array.from({ length: 14 }, (_, i) => ({ address: `t6${(10 + i).toString(36)}`, parent: "t1", status: "working", state: "live" }))];
const lead = C.identityOf({ address: "t1" }, TERMS);
const team = TERMS.slice(1).map((t) => C.identityOf({ address: t.address }, TERMS));
for (const m of team.slice(0, 9)) assert.equal(m[0], lead[0], "the first nine workers share the lead's family");
const keyOf = ([f, v]) => `${f}:${v}`;
assert.equal(new Set([lead, ...team].map(keyOf)).size, 15, "lead and 14 workers: 15 faces");
const wait = ([f, v]) => [...C.faceOf(f, v, 4)].map((ch, i) => (i === 0 || i === 3 || i === 12 || i === 15 || lit(ch) ? 1 : 0));
const tm = [lead, ...team.slice(0, 13)];
for (let i = 0; i < tm.length; i++) for (let j = i + 1; j < tm.length; j++) {
  const d = wait(tm[i]).reduce((s, x, k) => s + (x !== wait(tm[j])[k]), 0);
  assert.ok(d >= 4, `waiting views of ${keyOf(tm[i])} and ${keyOf(tm[j])}: ${d} LED apart`);
}
// pinned at first sight: an elder finishing (gone from terminals()) moves nobody; a newcomer takes a free slot
const pin = (next) => { SHARED[C.PINS] = next; };
const before = TERMS.slice(1, 6).map((t) => C.identityOf({ address: t.address }, TERMS, pin));
TERMS = TERMS.filter((t) => t.address !== TERMS[1].address);
for (const [i, t] of TERMS.slice(1, 5).entries()) assert.deepEqual(C.identityOf({ address: t.address }, TERMS, pin), before[i + 1], `${t.address} kept its face`);
TERMS = [...TERMS, { address: "t9z", parent: "t1", status: "working", state: "live" }];
const fresh = C.identityOf({ address: "t9z" }, TERMS, pin);
const liveFaces = TERMS.slice(1).map((t) => keyOf(C.identityOf({ address: t.address }, TERMS, pin)));
assert.equal(new Set([keyOf(lead), ...liveFaces]).size, TERMS.length, "the newcomer meets no live sibling's face");
assert.ok(liveFaces.includes(keyOf(fresh)));
delete SHARED[C.PINS];
// a bridge sub-agent: its parent's team, from the end, by its coiffe's rank; apart from the hc workers in front
assert.deepEqual(C.identityOf({ parent: "t1", rank: 0, id: "kt-sa" }), C.teamOrder("t1").at(-1));
const hcFaces = TERMS.slice(1, 6).map((t) => keyOf(C.identityOf({ address: t.address }, TERMS)));
for (let r = 0; r < 4; r++) assert.ok(!hcFaces.includes(keyOf(C.identityOf({ parent: "t1", rank: r, id: `kt-sa-${r}` }))), `bridge rank ${r} meets an hc worker`);

// ---- the ring's bars ----
for (const n of [1, 3, 5, 12, 16]) {
  const bars = C.ringBars(Array(n).fill("working"), 20, 0.75, 1.5);
  assert.equal(bars.length, n, `${n} workers: ${n} bars`);
  for (const b of bars) assert.ok(b.b - b.a >= 1.5 - 1e-9 && b.a >= 0 && b.b <= 20 + 1e-9, "a bar stays on its side, at least min long");
}
{
  const ws = [...Array(26).fill("working"), "blocked", ...Array(3).fill("done")];
  const bars = C.ringBars(ws, 12, 0.75, 1.5);
  const m = Math.floor(12 / 2.25); // 5 a side: 20 bars for 30 workers
  assert.ok(ws.length > 4 * m);
  assert.equal(bars.length, 4 * m, "past 4m workers: 4m bars");
  assert.ok(bars.some((b) => b.st === "blocked"), "one waiting worker among thirty keeps a bar");
  assert.equal(bars[0].st, "blocked", "the most urgent first");
}

// ---- cube(): what each state draws ----
const find = (n, pred, out = []) => { if (pred(n)) out.push(n); for (const k of n.kids ?? []) if (k && typeof k === "object") find(k, pred, out); return out; };
const byId = (n, suffix) => find(n, (x) => String(x.props.id?.[0] ?? "").endsWith(suffix));
TERMS = [];
const draw = (o) => C.cube({ id: "x", size: 32, height: 32, at: 1, ...o });
const live = (o) => C.cube({ id: "y", size: 32, height: 32, since: Date.now(), ...o });
// 32 px: a 6x6 face (side 28.2), the texture, 36 holes
let r = draw({ state: "idle", address: "t42" });
assert.equal(byId(r, "-holes")[0].kids.length, 36);
assert.ok(find(r, (x) => x.kind === "image" && x.arg === "brand/companions/cube/tex-6.svg").length === 1);
// 16 px: 4x4, no texture
r = C.cube({ id: "s", size: 16, height: 16, at: 1, state: "idle", address: "t42" });
assert.equal(byId(r, "-holes")[0].kids.length, 16);
assert.equal(find(r, (x) => x.kind === "image").length, 0);
// working, live: one scan layer per column, each a window of a common linear loop
r = live({ state: "working", address: "t42" });
const scans = byId(r, "-in");
assert.equal(scans.length, 6);
for (const s of scans) assert.equal(s.props.loop[1].easing, "linear");
// working as a still (at, or animations off): one lit column
SHARED["kt.reducedMotion"] = true;
r = live({ state: "working", address: "t42" });
assert.equal(byId(r, "-in").length, 0);
assert.equal(byId(r, "-col2").length, 1);
delete SHARED["kt.reducedMotion"];
// blocked: the face in the theme's blocked color, pulsing; the four corners lit
r = live({ state: "blocked", address: "t42" });
assert.equal(byId(r, "-wait")[0].props.loop[0], "opacity");
assert.equal(byId(r, "-corners")[0].kids.length, 4);
// error: a cross, 2N - (N odd) cells
r = draw({ state: "error", address: "t42" });
assert.equal(byId(r, "-cross")[0].kids.length, 12 + 12); // 12 cells at 6x6, a halo each (32 px)
// a lead with workers: the ring, a bar per worker, the waiting one pulsing
TERMS = [{ address: "t1", status: "working" }, { address: "t6a", parent: "t1", status: "blocked", state: "live" }, { address: "t6b", parent: "t1", status: "working", state: "live" }, { address: "t6c", parent: "t1", status: "done", state: "live" }];
r = live({ state: "working", address: "t1" });
const bars = byId(r, "-ring")[0].kids;
assert.equal(bars.length, 3);
assert.equal(bars[0].props.loop[0], "opacity");
TERMS = [];

// ---- cube34(): the 3/4 cube, its body an image, LEDs on both faces, the scan across them ----
TERMS = [];
r = C.cube34({ id: "r", size: 56, height: 56, since: Date.now(), state: "working", address: "t42" });
const N34 = C.gridFor(56 * 0.44);
assert.ok(find(r, (x) => x.kind === "image" && x.arg === `brand/companions/cube/body34-${N34}.svg`).length === 1, "the body image for its grid");
assert.equal(byId(r, "-in").length, 2 * N34, "the scan runs over both faces' columns");
assert.equal(byId(r, "-float")[0].props.loop[0], "top", "it floats");
r = C.cube34({ id: "r", size: 56, height: 56, at: 1, state: "error", address: "t42" });
assert.equal(byId(r, "-cross")[0].kids.length, 2 * (2 * N34 - (N34 % 2)) * 2, "a cross on each face (a halo each at 56 px)");
for (const N of [4, 5, 6, 7]) for (const v of ["", "-ring"]) assert.ok(existsSync(`${APP}/brand/companions/cube/body34-${N}${v}.svg`), `body34-${N}${v}.svg missing`);
TERMS = [{ address: "t1", status: "working" }, ...["blocked", "working", "done", "idle", "working"].map((status, i) => ({ address: `t7${i}`, parent: "t1", status, state: "live" }))];
r = C.cube34({ id: "r", size: 56, height: 56, since: Date.now(), state: "working", address: "t1" });
assert.ok(find(r, (x) => x.kind === "image" && String(x.arg).endsWith("-ring.svg")).length === 1, "a lead: the body with room for its ring");
assert.equal(byId(r, "-ring")[0].kids.length, 5, "a bar per worker down the front frame");
assert.equal(C.shareBars(Array(30).fill("working").concat(["blocked"]), 8).filter((s) => s === "blocked").length, 1, "one waiting worker keeps a bar");
TERMS = [];

// ---- companion-logo.js hands over by kt-threads' option ----
const program = { key: "claude", icon: "icons/claude.svg", tint: false, tile: "#1c1d21" };
r = L.companion({ program, state: "idle", id: "z", size: 24, height: 20, at: 1, address: "t42" });
assert.equal(byId(r, "-holes").length, 1, "default: the cube");
// a thread without a session (no terminal, no parent), or a shell: the program's icon stays
r = L.companion({ program: undefined, state: "idle", id: "z0", size: 24, height: 20, at: 1 });
assert.equal(byId(r, "-holes").length, 0, "no session: the shell icon");
assert.ok(find(r, (x) => x.kind === "svg" && x.arg === "mods/workspace-chrome/terminal.svg").length === 1, "no session: the terminal glyph");
r = L.companion({ program: { key: "shell", shell: true, icon: null }, state: "idle", id: "z1", size: 24, height: 20, at: 1, address: "t42" });
assert.equal(byId(r, "-holes").length, 0, "a shell: its icon");
r = L.companion({ program, state: "working", id: "z2", size: 20, height: 16, at: 1, parent: "t1", variant: "cap" });
assert.equal(byId(r, "-holes").length, 1, "a bridge sub-agent: the cube");
SHARED["kt.opt.kt-threads.companion_style"] = "subscription";
r = L.companion({ program, state: "idle", id: "z", size: 24, height: 20, at: 1, address: "t42" });
assert.equal(byId(r, "-holes").length, 0, "subscription: the logo");
console.log("cube.check: ok");
