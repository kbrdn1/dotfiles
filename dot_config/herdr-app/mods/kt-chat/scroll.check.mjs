// bun ~/.config/herdr-app/mods/kt-chat/scroll.check.mjs: main.js' scroll, what herdr-app check can't
// reach (events, a read landing late): the real Chat class, its host modules (gpui-kit, gpui-base,
// herdr) stubbed from the names the mod's files import, each method called on a bare instance.
// A1 a press on the scrollbar leaves the bottom; A2 the area shrinks or reflows, or the last row grows
// at rest, under a view that follows: the bottom again; A3 « Tours précédents » lands on the state as
// it is then; A7 the timeline lights what older / newer bring, nothing while the view is lost; A14 a
// sideways swipe scrolls.
import assert from "node:assert/strict";
import { plugin } from "bun";
import { readdirSync, readFileSync } from "node:fs";

// ── The host, stubbed ───────────────────────────────────────────────────────
const dir = import.meta.dir;
const names = { "gpui-kit": new Set(), "gpui-base": new Set(), herdr: new Set() };
for (const f of readdirSync(dir).filter((f) => f.endsWith(".js"))) {
  for (const m of readFileSync(`${dir}/${f}`, "utf8").matchAll(/import\s*\{([^}]*)\}\s*from\s*"(gpui-kit|gpui-base|herdr)"/g)) {
    for (const n of m[1].split(",")) if (n.trim()) names[m[2]].add(n.trim().split(/\s+as\s+/)[0]);
  }
}
// Any element builder: every property and call gives it back (render isn't exercised here).
const chain = new Proxy(function () {}, { get: (_t, p) => (p === "then" ? undefined : chain), apply: () => chain });
const ui = {
  View: class {},
  ScrollHandle: { new: () => ({ scroll_to_item() {} }) },
  VirtualListScrollHandle: { new: () => ({ scroll_to_item() {}, scroll_to_bottom() {} }) },
  TextareaState: { new: () => ({ set_auto_grow() {}, on() {}, value: () => "", set_value() {}, replace() {}, focus() {} }) },
};
const host = {
  agents: () => [], panes: () => [], spaces: () => [], terminals: () => [], theme: () => ({}), settings: () => ({}), props: () => ({}),
  home: () => "/h", appHome: () => "/h/.config/herdr-app", checking: () => true, nextCommand: () => new Promise(() => {}),
  exec: async () => ({ code: 0, stdout: "" }), hc: async () => ({}), readTextFile: async () => "", writeTextFile: async () => {},
};
const stub = (set, own, other) => Object.fromEntries([...set].map((n) => [n, n in own ? own[n] : other]));
plugin({
  setup(b) {
    b.module("gpui-kit", () => ({ loader: "object", exports: stub(names["gpui-kit"], ui, chain) }));
    b.module("gpui-base", () => ({ loader: "object", exports: stub(names["gpui-base"], ui, chain) }));
    b.module("herdr", () => ({ loader: "object", exports: stub(names.herdr, host, () => null) }));
  },
});
const { default: Chat } = await import("./main.js");
const { ingest } = await import("./chat-model.js");

// ── A bare Chat on made-up turns (no real session) ──────────────────────────
const turn = (id, o, text) => [
  { k: "user", o, uuid: id, at: o, turn: true, text },
  { k: "assistant", o: o + 1, uuid: `${id}a`, mid: `${id}m`, at: o + 1, model: "m", blocks: [{ t: "text", text: `réponse ${id}` }] },
];
const out = (path, start, end, more, entries) => ({ path, session: path, start, end, size: end, more, entries, meta: {} });
function chat(entries = turn("B", 100, "lu d'abord"), { path = "/p", start = 100, end = 200 } = {}) {
  const c = Object.create(Chat.prototype);
  Object.assign(c, {
    turns: [], win: { from: 0, to: 0 }, hts: new Map(), marks: [], builtLive: true, follow: true, cur: -1, queued: [], olderBusy: false,
    vh: 0, areaW: 0, pinned: false, top: 120, reveal: null, wheelAt: null, jump: null, tlId: null, tlAbove: false, tlLost: false, bgBtn: false,
  });
  c.state = ingest(null, out(path, start, end, true, entries));
  c.rebuild(true);
  c.win = { from: 0, to: c.turns.length };
  return c;
}
const ctx = () => { const cx = { notified: 0, spawn: (fn) => fn(cx), notify() { cx.notified++; } }; return cx; };
const three = () => [...turn("A", 0, "premier"), ...turn("B", 10, "deuxième"), ...turn("C", 20, "troisième")];

// ── A3: « Tours précédents » lands on the state as it is when the read comes back ──
{
  const c = chat();
  let land;
  c.index = () => new Promise((r) => { land = () => r(out("/p", 0, 100, false, turn("A", 0, "plus ancien"))); });
  const read = c.older(ctx());
  c.state = ingest(c.state, out("/p", 200, 300, false, turn("C", 200, "en direct"))); // tail() meanwhile
  c.rebuild(true);
  land();
  await read;
  assert.deepEqual(c.turns.map((t) => t.id), ["A", "B", "C"], "the older turn in front, the live one kept");
  assert.equal(c.state.end, 300, "the end the live tail reached stays (the next delta reads from there)");
}
{
  const c = chat();
  let land;
  c.index = () => new Promise((r) => { land = () => r(out("/p", 0, 100, false, turn("A", 0, "plus ancien de p"))); });
  const read = c.older(ctx());
  c.state = ingest(null, out("/q", 0, 50, false, turn("Q", 0, "l'autre agent"))); // load() of another agent
  c.rebuild(false, true);
  land();
  await read;
  assert.equal(c.state.path, "/q", "another agent's read meanwhile: the late read is dropped");
  assert.deepEqual(c.turns.map((t) => t.id), ["Q"]);
}

// ── A1: a press on the scrollbar leaves the bottom; on the text, nothing ──
const press = (x, y = 300) => ({ local_position: { x, y }, bounds: { width: 1000, height: 700 } });
{
  const c = chat(), cx = ctx();
  c.areaPress(press(500), cx);
  assert.equal(c.follow, true, "a press on the text leaves the bottom followed");
  assert.equal(c.top, 120);
  c.areaPress(press(990), cx);
  assert.equal(c.follow, false, "a press on the bar: the next live tick no longer pulls the view down");
  assert.equal(c.top, null, "the view's top is unknown");
  assert.equal(c.tlLost, true, "the timeline lights nothing until a wheel measures the view");
  assert.equal(cx.notified, 1, "a redraw: the « bottom » button shows");
  c.areaPress(press(990), cx);
  assert.equal(cx.notified, 1, "nothing changed again, no redraw");
}
{
  const c = chat(), cx = ctx();
  c.bgBtn = true;
  c.areaPress(press(990, 20), cx);
  assert.equal(c.follow, true, "the background's button over the bar's top is not the bar");
  c.areaPress(press(990, 60), cx);
  assert.equal(c.follow, false, "under it, the bar");
}

// ── A2: the area shrinks or reflows under a view that follows: the bottom again ──
{
  const c = chat(), cx = ctx();
  c.areaSized({ width: 1000, height: 600 }, cx);
  assert.equal(c.vh, 600);
  c.reveal = null;
  c.areaSized({ width: 1000, height: 490 }, cx); // the composer grew, a dialog's card or a ledge showed
  assert.equal(c.reveal, "bottom", "shorter, the bottom again");
  c.reveal = null;
  const n = cx.notified;
  c.areaSized({ width: 820, height: 490 }, cx); // a narrower pane: the text reflows, taller
  assert.equal(c.reveal, "bottom", "narrower, the bottom again");
  assert.equal(cx.notified, n + 1, "a redraw to bring it");
  c.reveal = null;
  c.areaSized({ width: 820.3, height: 490.2 }, cx);
  assert.equal(c.reveal, null, "under half a pixel: nothing");
  c.follow = false;
  const m = cx.notified;
  c.areaSized({ width: 900, height: 490 }, cx);
  assert.equal(c.reveal, null, "not following: the view stays where the reader is");
  assert.equal(cx.notified, m, "a width alone redraws nothing then (the card's own size does)");
  c.areaSized({ width: 900, height: 520 }, cx);
  assert.equal(cx.notified, m + 1, "a height does (the rail and the glide use it)");
  assert.equal(c.reveal, null);
}
// ── A2: the last row grows at rest (a fold, « Afficher plus ») under a view that follows ──
{
  const c = chat(three(), { start: 0, end: 30 });
  c.builtLive = false; // at rest: the last row is the last turn's
  const cx = ctx(), size = (h) => ({ width: 800, height: h });
  c.measured("kc-turn-C", size(300), cx);
  assert.equal(c.reveal, null, "a first size isn't a growth");
  c.measured("kc-turn-C", size(420), cx);
  assert.equal(c.reveal, "bottom", "the last row grew: the bottom again");
  assert.equal(cx.notified, 1);
  c.reveal = null;
  c.measured("kc-turn-C", size(500), cx, true);
  assert.equal(c.reveal, null, "a render that brought the bottom itself (the live tail, a send) covers its rows");
  c.measured("kc-turn-A", size(100), cx);
  c.measured("kc-turn-A", size(200), cx);
  assert.equal(c.reveal, null, "another row than the last: the view stays");
  c.measured("kc-turn-C", size(380), cx);
  assert.equal(c.reveal, null, "the last row shorter: gpui keeps the bottom by itself");
  c.follow = false;
  c.measured("kc-turn-C", size(600), cx);
  assert.equal(c.reveal, null, "not following: the view stays where the reader is");
}

// ── A14: a sideways swipe moves the area (it scrolls y only), up leaves the bottom ──
{
  const wheel = (x, y) => ({ delta: { x, y }, position: { x: 5, y: 300 }, local_position: { x: 5, y: 300 } });
  const c = chat(), cx = ctx();
  c.areaWheel(wheel(0, -30), cx);
  assert.equal(c.follow, true, "down: still following");
  c.areaWheel(wheel(25, 0), cx);
  assert.equal(c.follow, false, "a sideways swipe that scrolls up leaves the bottom");
}

// ── A7: older / newer light the message of the turn they bring; a wheel finds the view again ──
{
  const c = chat(three(), { start: 0, end: 30 });
  c.win = { from: 1, to: 3 };
  c.follow = false;
  c.tlId = "C";
  c.tlLost = true;
  c.older(ctx()); // loaded turns above: the window grows up to them, the view brought to B (first drawn before)
  assert.equal(c.tlId, "B", "« Tours précédents » lights the turn the view is brought to, not the one lit before");
  assert.equal(c.tlLost, false);
  c.win = { from: 0, to: 2 };
  c.newer();
  assert.equal(c.tlId, "B", "« Tours suivants » lights the last turn that was drawn, where the view stays");
}
{
  const c = chat(three(), { start: 0, end: 30 });
  for (const [id, h] of [["kc-head", 40], ["kc-turn-A", 300], ["kc-turn-B", 300], ["kc-turn-C", 300], ["kc-working", 50]]) c.hts.set(id, h);
  c.vh = 500;
  c.follow = false;
  c.tlLost = true;
  c.tlId = "C";
  const cx = ctx();
  // One event: the row under the pointer (turn B, 40 px into it) then the area (the pointer 300 px down the view).
  const ev = (y) => ({ delta: { x: 0, y: -10 }, position: { x: 5, y: 400 }, local_position: { x: 5, y } });
  c.wheel(cx, "kc-turn-B", ev(40));
  c.areaWheel(ev(300), cx);
  assert.equal(c.tlLost, false, "a wheel event measured the view: lit again");
  assert.equal(c.tlId, "B", "B starts in the view (its top 360, the view's top 110)");
  assert.equal(c.top, 110);
}
console.log("scroll.check: ok");
