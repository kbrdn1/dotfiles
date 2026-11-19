// bun ~/.config/herdr-app/mods/kt-chat/scroll-flow.check.mjs: the infinite scroll (#59, lot 2 bis) replayed
// frame by frame as gpui runs it, on made-up sessions whose turns are never as tall as guessed (×0.5 to
// ×1.5). A frame: the wheel event (a trackpad sends one every frame, a notched wheel one every 5), gpui
// moving its offset, the render (main.js lay(), what body() calls), the layout reporting sizes
// (measured(), innerSized()). Checked on every painted frame: the line at the view's top moved by exactly
// the wheel's delta (R1: nothing jumps), an opened fold in the view never changes (R2), the read upward
// lands where the reader is and never runs in a loop (R3). Lot 2 (4f2c503) failed all three on screen.
import assert from "node:assert/strict";
import { plugin } from "bun";
import { readdirSync, readFileSync } from "node:fs";

// ── The host, stubbed (budget.check.mjs's: elements record their calls) ─────
const dir = import.meta.dir;
const names = { "gpui-kit": new Set(), "gpui-base": new Set(), herdr: new Set() };
for (const f of readdirSync(dir).filter((f) => f.endsWith(".js"))) {
  for (const m of readFileSync(`${dir}/${f}`, "utf8").matchAll(/import\s*\{([^}]*)\}\s*from\s*"(gpui-kit|gpui-base|herdr)"/g)) {
    for (const n of m[1].split(",")) if (n.trim()) names[m[2]].add(n.trim().split(/\s+as\s+/)[0]);
  }
}
const node = () => {
  const p = new Proxy(function () {}, {
    get(_t, k) {
      if (k === "then") return undefined;
      return (...a) => (k === "when" ? (a[0] ? a[1](p) : p) : p);
    },
    apply: () => p,
  });
  return p;
};
const maker = () => new Proxy(function () {}, { get: (_t, k) => (k === "then" ? undefined : maker()), apply: () => node() });
const ui = {
  View: class {},
  ScrollHandle: { new: () => ({ scroll_to_item() {} }) },
  VirtualListScrollHandle: { new: () => ({ scroll_to_item() {}, scroll_to_bottom() {} }) },
  TextareaState: { new: () => ({ set_auto_grow() {}, on() {}, value: () => "", set_value() {}, replace() {}, focus() {} }) },
};
const host = {
  agents: () => [], panes: () => [], spaces: () => [], terminals: () => [], theme: () => ({}), settings: () => ({ dark: true, zoom: 1 }),
  props: () => ({}), shared: () => undefined, layout: () => null, focused: () => null, keys: () => ({}),
  home: () => "/h", appHome: () => "/h/.config/herdr-app", checking: () => true, nextCommand: () => new Promise(() => {}),
  exec: async () => ({ code: 0, stdout: "" }), hc: async () => ({}), readTextFile: async () => "", writeTextFile: async () => {},
};
const stub = (set, own, make) => Object.fromEntries([...set].map((n) => [n, n in own ? own[n] : make(n)]));
plugin({
  setup(b) {
    b.module("gpui-kit", () => ({ loader: "object", exports: stub(names["gpui-kit"], ui, maker) }));
    b.module("gpui-base", () => ({ loader: "object", exports: stub(names["gpui-base"], ui, maker) }));
    b.module("herdr", () => ({ loader: "object", exports: stub(names.herdr, host, () => () => null) }));
  },
});
globalThis.window = { paint_path: () => node() };
const { default: Chat } = await import("./main.js");
const { ingest } = await import("./chat-model.js");
const { motionState, frame: motionFrame } = await import("./motion.js");
const { mdState } = await import("./markdown.js");
const { rowPlan } = await import("./turn-band.js");

// ── Made-up sessions ────────────────────────────────────────────────────────
const INSET = 20, T = {};
let VH = 500; // the view's height (R2: a tall window, several opened folds in the band)
let FOLD = [1500, 1000]; // a fold drawn open adds FOLD[0] + FOLD[1] × [0, 1) px
let seed = 7;
const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
const plain = (id, o) => [
  { k: "user", o, uuid: id, at: o, turn: true, text: `question ${id}` },
  { k: "assistant", o: o + 1, uuid: `${id}a`, mid: `${id}m`, at: o + 1, model: "m", blocks: [{ t: "text", text: "mot ".repeat(20 + Math.floor(rnd() * 200)) }] },
];
// A turn whose work folds: 8 phases of 6 calls (a fold's cost ~98 rows: two of them past the budget).
const busy = (id, o, phases = 8) => {
  const e = [{ k: "user", o, uuid: id, at: o, turn: true, text: `tour ${id}` }];
  let k = o + 1;
  for (let p = 0; p < phases; p++) {
    e.push({ k: "assistant", o: k++, uuid: `${id}t${p}`, mid: `${id}m${p}`, at: k, model: "m", blocks: Array.from({ length: 6 }, (_, s) => ({ t: "tool", id: `${id}x${p}${s}`, name: "Read", kind: "read", title: "f", input: { path: "/f" } })) });
    for (let s = 0; s < 6; s++) e.push({ k: "result", o: k++, tool: `${id}x${p}${s}`, at: k, ok: true, text: "" });
    e.push({ k: "assistant", o: k++, uuid: `${id}p${p}`, mid: `${id}n${p}`, at: k, model: "m", blocks: [{ t: "text", text: `phase ${p}` }] });
  }
  e.push({ k: "assistant", o: k++, uuid: `${id}z`, mid: `${id}zm`, at: k, model: "m", blocks: [{ t: "text", text: "fini" }] });
  return e;
};
const out = (start, end, more, entries) => ({ path: "/p", session: "s", start, end, size: 1e7, more, entries, meta: {} });

function chat(entries, { start = 0, more = false } = {}) {
  const c = Object.create(Chat.prototype);
  Object.assign(c, {
    turns: [], win: { from: 0, to: 0 }, hts: new Map(), marks: [], builtLive: false, follow: false, cur: -1, queued: [], olderBusy: false,
    open: new Set(), shownSteps: new Map(), hover: null, copied: null, md: mdState(), att: new Map(), attQ: [],
    fresh: new Set(), liveItems: null, foldAt: null, going: new Set(), lastLedge: {}, subsKnown: new Map(), subRuns: new Map(), drafts: [], assetsOf: new Map(),
    motion: motionState(), bgMenu: false, bgNote: null, bgBusy: new Set(), line: null,
    vh: VH, areaW: 1000, pinned: null, top: null, reveal: null, wheelAt: null, jump: null, tlId: null, tlAbove: false, tlLost: false, bgBtn: false,
    budget: null, settling: false, drawn: new Map(), byState: new Map(), heldNow: new Set(), keepRow: null, pressAt: null, pressMoved: false,
    moveAt: null, placing: false, inBand: new Set(), guesses: new WeakMap(), posed: new Map(),
    shift: 0, clipNow: new Map(), clipped: new Map(), released: new Map(), clipAge: new Map(), held: new Set(), inView: new Set(), wasInView: new Set(),
    steady: new Set(), codeRows: new Map(), codeRowsNow: new Map(),
    pendingRead: null, olderKey: false, readStuck: null, scroll: { scroll_to_item() {} },
  });
  c.state = ingest(null, out(start, 1e6, more, entries));
  c.rebuild(false);
  c.win = { from: Math.max(0, c.turns.length - 10), to: c.turns.length };
  c.m = motionFrame(c.motion, true); // at rest: no motion's own sizes in the way
  return c;
}

// ── gpui, as far as the view's top goes ─────────────────────────────────────
// Each turn's real height: drawn whole, never what was guessed; a fold drawn open adds its work.
const real = new Map();
const realH = (c, t) => {
  if (!real.has(t.id)) real.set(t.id, { base: Math.round(c.guess({ ...t, fold: null }) * (0.5 + rnd())), fold: Math.round(FOLD[0] + FOLD[1] * rnd()) });
  const r = real.get(t.id);
  return r.base + (c.drawn.get(t.id) === "o" ? r.fold : 0);
};
function world(c) {
  const w = { c, O: 0, painted: [], reported: new Map(), inner: new Map(), point: null, renders: 0, timers: [] };
  const cx = { notified: 0, notify() { cx.notified++; }, spawn: (fn) => fn(cx), timer: { after: (ms, fn) => w.timers.push({ at: Date.now() + ms, fn }) } };
  w.cx = cx;
  return w;
}
// The timers due by now (Date.now(), faked where a case needs time to pass), then a render if one is asked.
async function fire(w) {
  const due = w.timers.filter((t) => t.at <= Date.now());
  w.timers = w.timers.filter((t) => t.at > Date.now());
  for (const t of due) t.fn(w.cx);
  for (let k = 0; k < 4; k++) await Promise.resolve();
  if (w.cx.notified) render(w);
}
const end = (w) => INSET + w.painted.reduce((y, [, h]) => y + h, 0) + 1 + 8;
const clampO = (w) => (w.O = Math.max(0, Math.min(w.O, end(w) - VH)));
const topIn = (w, id) => {
  let y = INSET;
  for (const [r, h] of w.painted) {
    if (r === id) return y;
    y += h;
  }
  return null;
};
// The painted row at document y, as its handlers name it (a spacer: its first turn's row) and the y in it.
function rowAt(w, y) {
  const c = w.c, plan = rowPlan(c.turns.length, c.first(), c.end());
  let at = INSET + w.painted[0][1];
  if (y < at) return { id: "kc-head", inRow: y - INSET };
  for (const r of plan) {
    const ids = r.to == null ? [r.i] : Array.from({ length: r.to - r.i }, (_, k) => r.i + k);
    const h = ids.reduce((s, i) => s + w.painted[1 + i][1], 0);
    if (y < at + h) return { id: `kc-turn-${c.turns[r.i].id}`, inRow: y - at };
    at += h;
  }
  return null;
}
// The line at the view's top: its row and how far into it. In the head's row (the read upward's « lecture »,
// which stays at the top whatever comes under it): the first turn's, k negative. In a turn drawn clipped
// (its bottom showing, col()): from its bottom (`end`).
const pointAt = (w) => {
  let y = INSET;
  for (const [id, h] of w.painted) {
    if (w.O < y + h) {
      if (id === "kc-head") return { id: w.painted[1]?.[0], k: w.O - (y + h) };
      return w.c.clipped.has(id) ? { id, k: w.O - (y + h), end: true } : { id, k: w.O - y };
    }
    y += h;
  }
  return null;
};
const heightIn = (w, id) => w.painted.find(([r]) => r === id)?.[1] ?? 0;
const posOf = (w, p) => {
  const top = topIn(w, p.id);
  return top == null ? null : top + (p.end ? heightIn(w, p.id) : 0) + p.k;
};
// One render (body(): pickBand, lay(), the reveal) and its layout (sizes reported when they change).
function render(w) {
  const c = w.c, cx = w.cx;
  w.renders++;
  cx.notified = 0;
  c.win = c.pickBand();
  const r = c.lay(T, cx, false, null);
  const from = c.first(), to = c.end();
  w.painted = [["kc-head", 42]];
  c.turns.forEach((t, i) => {
    const id = `kc-turn-${t.id}`;
    if (i >= from && i < to) w.painted.push([id, c.clipped.get(id) ?? realH(c, t)]);
    else {
      w.painted.push([id, c.boxH(t)]);
      w.reported.delete(id); // a box: the turn's element is gone
      w.inner.delete(id);
    }
  });
  if (r.anchor) w.O = r.anchor.top;
  if (c.reveal != null) {
    w.O = c.reveal === "bottom" ? end(w) : w.O;
    c.reveal = null;
    c.top = null;
    c.shift = 0;
  }
  clampO(w);
  const size = (h) => ({ width: 800, height: h });
  if (w.reported.get("kc-head") !== 42) { w.reported.set("kc-head", 42); c.measured("kc-head", size(42), cx); }
  for (let i = from; i < to; i++) {
    const t = c.turns[i], id = `kc-turn-${t.id}`, state = c.drawn.get(t.id) ?? null;
    const clip = c.clipped.get(id);
    const outer = clip ?? realH(c, t);
    if (w.reported.get(id) !== outer) { w.reported.set(id, outer); c.measured(id, size(outer), cx, null, state); }
    if (clip != null) {
      const h = realH(c, t);
      if (!w.mute && w.inner.get(id) !== h) { w.inner.set(id, h); c.innerSized(id, size(h), cx, state); }
    } else w.inner.delete(id);
  }
}
// The wheel: one event (the row's half, then the area's), gpui moving its offset by it.
function wheel(w, dy, { offRows = false } = {}) {
  const c = w.c, cx = w.cx, y = w.O + VH / 2, at = rowAt(w, y);
  const ev = (local) => ({ delta: { x: 0, y: dy }, position: { x: offRows ? 990 : 5, y: 300 }, local_position: { x: 5, y: local } });
  if (at && !offRows) c.wheel(cx, at.id, ev(at.inRow));
  c.areaWheel(ev(VH / 2), cx);
  w.O -= dy;
  clampO(w);
}
// A run of frames: `dy` a frame (trackpad) or every `every` frames (a notched wheel). Each painted frame:
// the line that was at the view's top before it, where it is now: moved by exactly what the wheel did.
// `across` [a, b]: frames a to b are checked as one (a growth gpui paints before anyone can hold it, and
// the render that puts it back).
async function run(w, frames, { dy = 40, every = 1, onFrame = null, across = null } = {}) {
  const jumps = [];
  let held = null; // { point, moved } from before frame a
  for (let f = 0; f < frames; f++) {
    const before = pointAt(w), O0 = w.O;
    const d = f % every === 0 ? dy : 0;
    if (d) wheel(w, d);
    const moved = O0 - w.O; // what gpui moved by (0 at the head)
    onFrame?.(w, f);
    for (let k = 0; k < 3; k++) await Promise.resolve(); // a read landing (spawn)
    if (w.cx.notified) render(w);
    if (across && f === across[0]) held = { point: before, moved: 0 };
    if (held) held.moved += moved;
    const inSpan = across && f >= across[0] && f < across[1];
    const from = across && f === across[1] ? held.point : inSpan ? null : before;
    const by = across && f === across[1] ? held.moved : moved;
    if (from) {
      const now = posOf(w, from);
      if (now != null) {
        const off = w.O - now + by;
        if (Math.abs(off) > 1) jumps.push({ f, off: Math.round(off), row: from.id });
      }
    }
  }
  return jumps;
}
// Into place: the view at `at` px from the top of the rows, as an event measures it, a render or two.
async function settle(w, at) {
  render(w);
  w.O = at;
  clampO(w);
  wheel(w, 0.0001);
  for (let k = 0; k < 4; k++) render(w);
}

// ── R1: scrolling up through turns never measured, a trackpad's event every frame: nothing jumps ──
for (const every of [1, 5]) {
  seed = 11;
  real.clear();
  const c = chat(Array.from({ length: 60 }, (_, i) => plain(`P${i}`, i * 10)).flat());
  const w = world(c);
  await settle(w, 1e9); // the bottom
  const start = c.turns.findIndex((t) => `kc-turn-${t.id}` === pointAt(w).id);
  const jumps = await run(w, 160 * every, { dy: 40, every });
  assert.deepEqual(jumps, [], `${every === 1 ? "trackpad" : "notched wheel"}: the line at the view's top moves by the wheel alone`);
  const now = c.turns.findIndex((t) => `kc-turn-${t.id}` === pointAt(w).id);
  assert.ok(start - now >= 12, `it went up a long way (turn ${start} to turn ${now}), through turns never measured`);
  assert.ok(w.renders > 20 && c.hts.size > 20, "the band moved, turns were drawn and measured on the way");
}
{
  // A turn above the view grows as painted (a live result): kept apart, put back by the next render,
  // the trackpad's event in between included. The frame that paints it shows it; the next one undoes it.
  seed = 12;
  real.clear();
  const c = chat(Array.from({ length: 30 }, (_, i) => plain(`Q${i}`, i * 10)).flat());
  const w = world(c);
  await settle(w, 1e9);
  await run(w, 40, { dy: 40 });
  const above = c.turns.find((t, i) => i >= c.first() && i < c.end() && topIn(w, `kc-turn-${t.id}`) + w.painted.find(([id]) => id === `kc-turn-${t.id}`)[1] < w.O);
  assert.ok(above, "a turn drawn whole above the view");
  const jumps = await run(w, 10, {
    dy: 40,
    onFrame: (w, f) => {
      if (f !== 2) return;
      real.get(above.id).base += 150;
      w.cx.notify(); // the live tick's rebuild
    },
    across: [2, 3], // frame 2 paints the growth (gpui has nothing to hold it), frame 3 puts it back
  });
  assert.deepEqual(jumps, [], "the frame after puts the reader's line back, the trackpad's event before its render included");
}

{
  // A clipped turn whose inside never reports its size (gpui didn't): drawn whole after three renders,
  // never left cut at its guess.
  seed = 13;
  real.clear();
  const c = chat(Array.from({ length: 30 }, (_, i) => plain(`M${i}`, i * 10)).flat());
  const w = world(c);
  await settle(w, 1e9);
  w.mute = true;
  const clippedFor = new Map();
  let longest = 0, clippedAtAll = 0;
  await run(w, 80, {
    dy: 40,
    onFrame: (w) => {
      w.cx.notify(); // a render every frame (the live tail)
      for (const id of w.c.clipped.keys()) {
        clippedFor.set(id, (clippedFor.get(id) ?? 0) + 1);
        longest = Math.max(longest, clippedFor.get(id));
        clippedAtAll++;
      }
      for (const id of clippedFor.keys()) if (!w.c.clipped.has(id)) clippedFor.delete(id);
    },
  });
  assert.ok(clippedAtAll > 0, "turns were clipped on the way up");
  assert.ok(longest <= 3, `a turn stays clipped three renders at most (${longest})`);
}

// ── R2: opened folds, the band moving under them: none moves in the view ──
{
  // A tall window, turns whose work folds 6 phases (a fold's cost ~78 rows: three of them past the budget),
  // every other one, all opened, short enough that the view holds more of them than the budget pays for.
  seed = 21;
  real.clear();
  VH = 1400;
  FOLD = [80, 80];
  const c = chat(Array.from({ length: 30 }, (_, i) => (i % 2 ? busy(`B${i}`, i * 1000, 6) : plain(`B${i}`, i * 1000))).flat());
  for (const t of c.turns) if (t.fold) c.open.add(`f:${t.id}`);
  const w = world(c);
  await settle(w, 1e9);
  const states = [];
  const flips = [], starved = [];
  let held = 0;
  const jumps = await run(w, 220, {
    dy: 40,
    onFrame: (w) => {
      const c = w.c, now = new Map([...c.inView].map((id) => [id, c.drawn.get(id)]));
      const last = states.at(-1);
      if (last) for (const [id, s] of now) if (last.has(id) && last.get(id) !== s && s !== undefined && last.get(id) !== undefined) flips.push(id);
      // A fold coming into the view held closed while one off the view is drawn open: the budget went
      // to what the reader doesn't look at (A16's promise, the band's edge as the reader's turn).
      const offOpen = c.turns.slice(c.first(), c.end()).some((t) => !c.inView.has(t.id) && c.drawn.get(t.id) === "o");
      for (const id of c.inView) if (last && !last.has(id) && c.held.has(id) && offOpen) starved.push(id);
      states.push(now);
      held = Math.max(held, c.held.size);
    },
  });
  assert.ok(held > 0, "the budget held folds closed on the way (the case is the one Kylian saw)");
  assert.deepEqual(flips, [], "an opened fold in the view keeps how it was drawn");
  assert.deepEqual(starved, [], "a fold comes into the view held only when nothing off the view is drawn open in its place");
  assert.deepEqual(jumps, [], "and nothing above it moves the view (a fold drawn otherwise above it is clipped, then put back)");
  VH = 500;
  FOLD = [1500, 1000];
}

// ── R3: the read upward ──
{
  // Near the head, a read lands; by the wheel, where the reader is; it adds what came above, once.
  seed = 31;
  real.clear();
  const c = chat(Array.from({ length: 20 }, (_, i) => plain(`R${i}`, 1000 + i * 10)).flat(), { start: 1000, more: true });
  const w = world(c);
  let asked = 0, land = null;
  c.index = () => {
    asked++;
    return new Promise((r) => { land = () => r(out(0, 1000, false, Array.from({ length: 12 }, (_, i) => plain(`O${i}`, i * 10)).flat())); });
  };
  await settle(w, 1e9);
  const jumps = await run(w, 140, {
    dy: 60,
    onFrame: (w, f) => {
      if (land && f % 7 === 3) {
        land();
        land = null;
      }
    },
  });
  assert.equal(asked, 1, "one read: it brought the session's start");
  assert.equal(c.turns[0].id, "O0");
  assert.deepEqual(jumps, [], "the reader's line stays where it is when the read lands, and all the way up");
}
{
  // The read lands while the view's top is unknown (the pointer on the timeline's rail): it waits, then
  // lands compensated at the next event; a turn pressed long ago is never revealed (by the wheel).
  seed = 32;
  real.clear();
  const c = chat(Array.from({ length: 8 }, (_, i) => plain(`S${i}`, 1000 + i * 10)).flat(), { start: 1000, more: true });
  const w = world(c);
  let land = null;
  c.index = () => new Promise((r) => { land = () => r(out(0, 1000, false, Array.from({ length: 6 }, (_, i) => plain(`Y${i}`, i * 10)).flat())); });
  await settle(w, 1e9);
  c.cur = c.turns.length - 1; // pressed long ago, at the bottom
  await run(w, 60, { dy: 60 });
  assert.ok(land, "near the head: the read upward asked");
  wheel(w, 10, { offRows: true }); // the rail: no row's half, the top unknown
  assert.equal(c.top, null);
  const before = pointAt(w);
  land();
  for (let k = 0; k < 4; k++) await Promise.resolve();
  if (w.cx.notified) render(w);
  assert.ok(c.pendingRead, "it waits for the view's top");
  assert.equal(c.reveal, null, "no turn revealed");
  assert.equal(posOf(w, before), w.O, "nothing moved");
  const jumps = await run(w, 3, { dy: 10 });
  assert.equal(c.pendingRead, null, "the next event's top lands it");
  assert.deepEqual(jumps, [], "compensated: the reader's line stays");
  assert.equal(c.turns[0].id, "Y0");
}
{
  // A read that brings nothing new (prepend refuses it, or it fails): not asked again, however long
  // the reader stays near the head.
  seed = 33;
  real.clear();
  const c = chat(Array.from({ length: 6 }, (_, i) => plain(`U${i}`, 1000 + i * 10)).flat(), { start: 1000, more: true });
  const w = world(c);
  let asked = 0;
  c.index = async () => { asked++; return out(0, 999, false, []); }; // ends before the state's start: refused
  await settle(w, 1e9);
  await run(w, 80, { dy: 60 });
  await run(w, 40, { dy: -20 });
  await run(w, 40, { dy: 20 });
  assert.equal(asked, 1, "one read, then never again from that start");
}
{
  // A read that fails (an error, a timeout under load) is not « nothing new »: read again after 5 s, then
  // after 30 s, then given up; none in between, however the reader wheels near the head.
  const realNow = Date.now;
  let clock = 1e12;
  Date.now = () => clock;
  try {
    const fails = async (failing) => {
      seed = 34;
      real.clear();
      const c = chat(Array.from({ length: 6 }, (_, i) => plain(`V${i}`, 1000 + i * 10)).flat(), { start: 1000, more: true });
      const w = world(c);
      let asked = 0, left = failing;
      c.index = async () => {
        asked++;
        if (left-- > 0) throw new Error("timeout");
        return out(0, 1000, false, Array.from({ length: 4 }, (_, i) => plain(`W${i}`, i * 10)).flat());
      };
      await settle(w, 1e9);
      await run(w, 60, { dy: 60 }); // up to the head: the read upward
      return { c, w, asked: () => asked };
    };
    {
      const { c, w, asked } = await fails(3);
      assert.equal(asked(), 1, "near the head: one read, it fails");
      await run(w, 20, { dy: -10 });
      await run(w, 20, { dy: 10 });
      assert.equal(asked(), 1, "none while it waits, however the reader wheels");
      clock += 5100;
      await fire(w);
      assert.equal(asked(), 2, "again after 5 s");
      clock += 10000;
      await fire(w);
      await run(w, 10, { dy: 10 });
      assert.equal(asked(), 2, "then a longer wait");
      clock += 20100;
      await fire(w);
      assert.equal(asked(), 3, "again after 30 s");
      clock += 60000;
      await fire(w);
      await run(w, 20, { dy: 10 });
      assert.equal(asked(), 3, "three failures: given up from that start");
      assert.equal(c.readStuck, "/p:1000");
    }
    {
      const { c, w, asked } = await fails(1);
      clock += 5100;
      await fire(w);
      assert.equal(asked(), 2);
      assert.equal(c.turns[0].id, "W0", "a passing error: the next try brings the turns");
      assert.equal(c.readStuck, null);
    }
  } finally {
    Date.now = realNow;
  }
}
console.log("scroll-flow.check: ok");
