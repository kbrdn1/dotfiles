// bun ~/.config/herdr-app/mods/kt-chat/scroll.check.mjs: main.js' scroll, what herdr-app check can't
// reach (events, a read landing late): the real Chat class, its host modules (gpui-kit, gpui-base,
// herdr) stubbed from the names the mod's files import, each method called on a bare instance.
// A1 a press on the scrollbar leaves the bottom; A2 the area shrinks or reflows, or the last row grows
// (at rest, or on its height: once more when it settles) under a view that follows: the bottom again,
// and a row above it growing lets the bottom go; A3 « Tours précédents » lands on the state as it is
// then; A7 the timeline lights what older / newer bring, nothing while the view is lost; A14 a sideways
// swipe scrolls; A16 what a render draws of the folded work goes to the reader's turn first, an opened
// fold of another turn past the budget held closed whole, and a press keeps its row where it is when
// folds above it change (what the reader's turn draws: budget.check.mjs).
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
    vh: 0, areaW: 0, pinned: null, top: 120, reveal: null, wheelAt: null, jump: null, tlId: null, tlAbove: false, tlLost: false, bgBtn: false,
    budget: null, shownSteps: new Map(), open: new Set(), settling: false,
    drawn: new Map(), byState: new Map(), heldNow: new Set(), keepRow: null, pressAt: null, pressMoved: false,
    moveAt: null, placing: false, inBand: new Set(), guesses: new WeakMap(), posed: new Map(),
  });
  c.state = ingest(null, out(path, start, end, true, entries));
  c.rebuild(true);
  c.win = { from: 0, to: c.turns.length };
  return c;
}
// A context: its redraws counted, its one-shot timers kept to be fired by hand (cx.fire()).
const ctx = () => {
  const cx = { notified: 0, timers: [], spawn: (fn) => fn(cx), notify() { cx.notified++; } };
  cx.timer = { after: (ms, fn) => cx.timers.push({ ms, fn }) };
  cx.fire = () => { const due = cx.timers.splice(0); for (const x of due) x.fn(cx); return due.length; };
  return cx;
};
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
  // A motion on its height (rows(), collapse()): a size every frame. The render the reveal brings covers
  // its first one; the frames after it don't each redraw: one timer brings the bottom once settled.
  c.reveal = null;
  const pin = {};
  c.measured("kc-turn-C", size(460), cx, pin);
  assert.equal(c.reveal, null, "a render that brought the bottom itself (the live tail, a send) covers its first size");
  c.measured("kc-turn-C", size(500), cx, pin);
  c.measured("kc-turn-C", size(540), cx, pin);
  assert.equal(c.reveal, null, "the frames of a motion don't each redraw");
  assert.equal(cx.timers.length, 1, "one timer for the motion, however many frames");
  assert.equal(cx.fire(), 1);
  assert.equal(c.reveal, "bottom", "the motion settled: the bottom once more");
  c.reveal = null;
  c.measured("kc-turn-C", size(380), cx);
  assert.equal(c.reveal, null, "the last row shorter: gpui keeps the bottom by itself");
  c.measured("kc-turn-A", size(100), cx);
  c.measured("kc-turn-A", size(200), cx, {});
  assert.equal(c.follow, true, "a row above the last grows in a render that brought the bottom: covered");
  c.measured("kc-turn-A", size(300), cx);
  assert.equal(c.reveal, null, "a row above the last grows with nothing that brought the bottom (a fold opened up there)…");
  assert.equal(c.follow, false, "…what was clicked stays where it is: the bottom isn't followed any more");
  c.measured("kc-turn-C", size(600), cx);
  assert.equal(c.reveal, null, "not following: the view stays where the reader is");
  c.follow = true;
  c.measured("kc-turn-C", size(700), cx);
  c.follow = false;
  c.reveal = null;
  cx.fire();
  assert.equal(c.reveal, null, "left the bottom before the motion settled: nothing more");
}

// ── A16: what a render draws of the folded work goes to the reader's turn first ──
{
  const c = chat([...turn("A", 0, "un"), ...turn("B", 10, "deux"), ...turn("C", 20, "trois"), ...turn("D", 30, "quatre")], { start: 0, end: 40 });
  assert.equal(c.focusTurn(), 3, "following the bottom: the last turn");
  c.follow = false;
  c.cur = 1;
  assert.equal(c.focusTurn(), 1, "else the cursor's");
  const cx = ctx();
  c.heldNow = new Set(["C"]);
  c.pressTurn("kc-turn-C", {}, cx);
  assert.equal(c.cur, 2, "a press in a turn makes it the cursor's");
  assert.equal(c.foldAt?.id, "C", "its fold held closed opens as one opened (rows())");
  assert.equal(cx.notified, 1, "a redraw to serve it first");
  c.pressTurn("kc-turn-C", {}, cx);
  assert.equal(cx.notified, 1, "pressed again: nothing changes");
}
{
  // A fold (two phases of one call, their narration, the answer): another turn's is drawn whole while
  // the budget holds it, else held closed whole; the reader's is outside the budget.
  const tool = (id, o, tid) => ({ k: "assistant", o, uuid: id, mid: `m${id}`, at: o, model: "m", blocks: [{ t: "tool", id: tid, name: "Bash", kind: "execute", title: "ls", input: { command: "ls" } }] });
  const res = (o, tid, text = "ok") => ({ k: "result", o, tool: tid, at: o, ok: true, text });
  const said = (id, o, text) => ({ k: "assistant", o, uuid: id, mid: `m${id}`, at: o, model: "m", blocks: [{ t: "text", text }] });
  const c = chat([{ k: "user", o: 0, uuid: "F", at: 0, turn: true, text: "plie" }, tool("f1", 1, "x1"), res(2, "x1", "a\nb\nc"), said("f2", 3, "je regarde"), tool("f3", 4, "x2"), res(5, "x2"), said("f4", 6, "voilà")], { start: 0, end: 7 });
  const [f] = c.turns;
  assert.deepEqual(f.fold, { start: 0, end: 2 });
  assert.equal(c.foldCost(f), 2 + 1 + 5 + 2 + 1, "two headers and their step each, a prose block");
  c.open.add("s:x1");
  assert.equal(c.foldCost(f), 11 + 1 + 3, "an opened detail counts its lines (the command's, the output's)");
  c.budget = { steps: 100, fresh: false };
  assert.equal(c.holds(f), true);
  assert.equal(c.budget.steps, 85, "another turn's fold drawn: its whole cost spent at once");
  c.budget = { steps: 10, fresh: false };
  assert.equal(c.holds(f), false, "past the budget: held closed, whole");
  assert.equal(c.budget.steps, 10, "held: nothing spent");
  c.budget = { steps: 0, fresh: true };
  assert.equal(c.holds(f), true, "the reader's turn (the first served) is drawn as opened, whatever is left");
  assert.equal(c.budget.steps, 0, "and spends nothing: it is outside the budget");
  c.budget = null;
  assert.equal(c.holds(f), true, "outside a render: as opened");
}
// ── A16: « ce qu'on vient de cliquer ne bouge pas »: a press that moves the reader keeps its row on screen ──
{
  const setup = () => {
    const c = chat(three(), { start: 0, end: 30 });
    for (const [id, h] of [["kc-head", 40], ["kc-turn-A", 600], ["kc-turn-B", 300], ["kc-turn-C", 300], ["kc-working", 50]]) c.hts.set(id, h);
    c.vh = 500;
    c.follow = false;
    c.cur = 2;
    c.drawn = new Map([["A", "o"], ["B", "c"], ["C", "o"]]);
    return c;
  };
  const rowHalf = (y) => ({ position: { x: 5, y: 400 }, local_position: { x: 5, y } });
  const viewHalf = (y) => ({ position: { x: 5, y: 400 }, local_position: { x: 500, y }, bounds: { width: 1000, height: 500 } });
  {
    const c = setup(), cx = ctx();
    // The press: in turn B, 40 px into it, 300 px down the view (B's top 660: the view's top 400).
    c.pressTurn("kc-turn-B", rowHalf(40), cx);
    c.areaPress(viewHalf(300), cx);
    assert.equal(c.cur, 1);
    assert.deepEqual({ id: c.keepRow.id, screen: c.keepRow.screen, top: c.keepRow.top }, { id: "kc-turn-B", screen: 260, top: 400 }, "B kept 260 px down the view");
    // The next render: A, above B, now held closed (its closed height known: 400).
    c.byState.set("kc-turn-A|c", 400);
    const k = c.keepY(new Map([["A", "c"], ["B", "o"], ["C", "c"]]));
    assert.equal(k.top, 200, "the view's top moves by what A lost (200), B stays 260 px down");
    assert.equal(c.keepRow, null, "a known height: done in this render");
  }
  {
    const c = setup(), cx = ctx();
    c.pressTurn("kc-turn-B", rowHalf(40), cx);
    c.areaPress(viewHalf(300), cx);
    // A's closed height never measured: this render guesses (nothing moves), the size A reports corrects it.
    assert.equal(c.keepY(new Map([["A", "c"], ["B", "o"], ["C", "c"]])), null);
    assert.equal(c.keepRow.correct, true);
    c.drawn = new Map([["A", "c"], ["B", "o"], ["C", "c"]]);
    const n = cx.notified;
    c.measured("kc-turn-A", { width: 800, height: 400 }, cx, null, "c");
    assert.equal(cx.notified, n + 1, "A's new size asks a render more");
    assert.equal(c.byState.get("kc-turn-A|c"), 400, "and is kept for the next time A is drawn closed");
    assert.equal(c.keepY(c.drawn).top, 200, "corrected: B back where it was");
    assert.equal(c.keepRow, null);
  }
  {
    const c = setup(), cx = ctx();
    c.follow = true;
    c.pressTurn("kc-turn-B", rowHalf(40), cx);
    c.areaPress(viewHalf(300), cx);
    assert.equal(c.keepRow, null, "following the bottom, a press doesn't move the reader (the last turn stays first)");
    c.follow = false;
    c.cur = 1;
    c.pressTurn("kc-turn-B", rowHalf(40), cx);
    c.areaPress(viewHalf(300), cx);
    assert.equal(c.keepRow, null, "a press in the reader's own turn moves nothing");
  }
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

// ── #59: every loaded turn is a row; the band drawn whole, the others boxes as tall as they were drawn ──
{
  const c = chat(three(), { start: 0, end: 30 });
  c.win = { from: 1, to: 3 }; // A is a box
  c.hts.set("kc-head", 42);
  const g = c.guess(c.turns[0]);
  assert.ok(g > 0, "a turn never drawn: its guess (turn-band.js estimate)");
  assert.deepEqual(c.rowsNow().map(([id, h]) => [id, h]), [["kc-head", 42], ["kc-turn-A", g], ["kc-turn-B", undefined], ["kc-turn-C", undefined], ["kc-working", undefined]]);
  assert.equal(c.geom().known, false, "drawn whole and not measured yet: not known");
  for (const [id, h] of [["kc-turn-B", 300], ["kc-turn-C", 300], ["kc-working", 50]]) c.hts.set(id, h);
  const geo = c.geom();
  assert.equal(geo.known, true, "a box's height is the one it is drawn at: known");
  assert.equal(geo.tops.get("B"), 20 + 42 + g);
  assert.equal(c.lastRow(), "kc-working", "« Tours suivants » is gone: the last row is the conversation's");
  c.hts.set("kc-turn-A", 500);
  assert.equal(c.rowsNow()[1][1], 500, "measured once, its box keeps that height");
}
// ── #59: which band a render draws (pickBand) ──
{
  const c = chat([...Array(12)].flatMap((_, k) => turn(`T${k}`, k * 10, `tour ${k}`)), { start: 0, end: 120 });
  c.vh = 500;
  c.hts.set("kc-head", 42);
  for (const t of c.turns) c.hts.set(`kc-turn-${t.id}`, 200);
  assert.deepEqual(c.pickBand(), { from: 7, to: 12 }, "following: the bottom's (the view and one more above)");
  c.follow = false;
  c.top = 0;
  assert.deepEqual(c.pickBand(), { from: 0, to: 5 }, "the view's top known: around it");
  c.jump = "T8";
  assert.deepEqual(c.pickBand(), { from: 8, to: 12 }, "a jump waiting: from its turn down, nothing above it changes");
  c.jump = null;
  c.top = null;
  c.win = { from: 3, to: 6 };
  assert.deepEqual(c.pickBand(), { from: 3, to: 6 }, "unknown (a key revealed the cursor's turn): as it was");
}
// ── #59: a row wholly above the view changes height: the view's top moves with it (keepAbove) ──
{
  const c = chat(three(), { start: 0, end: 30 }), cx = ctx();
  for (const [id, h] of [["kc-head", 42], ["kc-turn-B", 300], ["kc-turn-C", 300], ["kc-working", 50]]) c.hts.set(id, h);
  c.vh = 500;
  c.follow = false;
  c.win = { from: 0, to: 3 };
  const g = c.guess(c.turns[0]);
  c.top = 62 + g + 100; // A wholly above the view, B 100 px above it
  const top = c.top;
  c.measured("kc-turn-A", { width: 800, height: g + 80 }, cx); // A back from its box: its guess was 80 short
  assert.equal(c.top, top + 80, "what the reader sees stays: the view's top moves by what A grew");
  assert.equal(c.placing, true, "the next render anchors it (body())");
  assert.equal(cx.notified, 1);
  c.placing = false;
  c.measured("kc-turn-B", { width: 800, height: 340 }, cx);
  assert.equal(c.top, top + 80, "a row the view's top is in: nothing moves (its growth is under the top)");
  c.measured("kc-turn-C", { width: 800, height: 900 }, cx);
  assert.equal(c.top, top + 80, "below: nothing");
  assert.equal(c.placing, false);
  c.follow = true;
  c.measured("kc-turn-A", { width: 800, height: g + 20 }, cx);
  assert.equal(c.top, top + 80, "following: the bottom is brought instead (A2)");
}
{
  // Two turns above the view drawn whole for the first time (a jump's band growing upward), boxes at
  // their pose the image before: B reports before A, the view's top still moves by both.
  const c = chat(three(), { start: 0, end: 30 }), cx = ctx();
  for (const [id, h] of [["kc-head", 42], ["kc-turn-C", 300], ["kc-working", 50]]) c.hts.set(id, h);
  c.posed.set("kc-turn-A", 150);
  c.posed.set("kc-turn-B", 170);
  c.vh = 500;
  c.follow = false;
  c.win = { from: 0, to: 3 };
  c.top = 62 + 150 + 170 + 40; // A and B wholly above, 40 px into C
  c.measured("kc-turn-B", { width: 800, height: 230 }, cx);
  c.measured("kc-turn-A", { width: 800, height: 400 }, cx);
  assert.equal(c.top, 62 + 400 + 230 + 40, "C stays 40 px into the view, whatever the order the sizes come in");
}
{
  // A box's height is the one it was drawn at until it is measured: a guess that changes (the width)
  // doesn't move what is under it.
  const long = [{ k: "user", o: 0, uuid: "A", at: 0, turn: true, text: "long" },
    { k: "assistant", o: 1, uuid: "Aa", mid: "Am", at: 1, model: "m", blocks: [{ t: "text", text: "mot ".repeat(200) }] }];
  const c = chat([...long, ...turn("B", 10, "deux"), ...turn("C", 20, "trois")], { start: 0, end: 30 });
  c.win = { from: 2, to: 3 };
  c.areaW = 900;
  const g = c.guess(c.turns[0]);
  c.posed.set("kc-turn-A", g);
  c.areaW = 400; // narrower: its prose would wrap more
  assert.notEqual(c.guess(c.turns[0]), g, "the guess moved");
  assert.equal(c.rowsNow()[1][1], g, "the box didn't");
  assert.equal(c.heights()[0], g, "nor the band's view of it");
}
{
  // Following, a box drawn whole for the first time reports its first size: not a growth (A2 stays).
  const c = chat(three(), { start: 0, end: 30 }), cx = ctx();
  c.win = { from: 2, to: 3 };
  c.measured("kc-turn-A", { width: 800, height: 5000 }, cx);
  assert.equal(c.follow, true, "its guess was never its measure");
  assert.equal(c.reveal, null);
}
// ── #59: the read upward keeps what the reader sees (older(): a read in front, placing) ──
{
  const c = chat(turn("B", 100, "lu d'abord"));
  c.follow = false;
  c.top = 120;
  c.hts.set("kc-head", 42);
  c.hts.set("kc-turn-B", 300);
  c.index = async () => out("/p", 0, 100, false, [...turn("Z", 0, "bien plus ancien"), ...turn("A", 10, "plus ancien")]);
  const cx = ctx();
  await c.older(cx);
  await Promise.resolve();
  assert.deepEqual(c.turns.map((t) => t.id), ["Z", "A", "B"]);
  const above = c.guess(c.turns[0]) + c.guess(c.turns[1]);
  assert.equal(c.top, 120 + above, "the view's top moves by the boxes that came above B");
  assert.equal(c.placing, true, "anchored in the next render, the same lines on screen");
  assert.equal(c.reveal, null);
}
{
  const c = chat(three(), { start: 30, end: 60 });
  c.follow = false;
  c.top = null; // a key brought the view: unknown
  c.cur = 0;
  c.index = async () => out("/p", 0, 30, false, turn("Z", 0, "plus ancien"));
  await c.older(ctx());
  await Promise.resolve();
  assert.equal(c.turns[c.cur].id, "A", "the cursor stays on its turn");
  assert.equal(c.reveal, 2, "the view's top unknown: the cursor's turn revealed (child 2)");
  assert.equal(c.placing, false);
}
{
  // A wheel within a view of the head with more to read: the read upward, on its own.
  const c = chat(three(), { start: 30, end: 60 }), cx = ctx();
  for (const [id, h] of [["kc-head", 42], ["kc-turn-A", 300], ["kc-turn-B", 300], ["kc-turn-C", 300], ["kc-working", 50]]) c.hts.set(id, h);
  c.vh = 500;
  c.follow = false;
  let asked = 0;
  c.index = () => { asked++; return new Promise(() => {}); };
  const ev = (y) => ({ delta: { x: 0, y: 10 }, position: { x: 5, y: 400 }, local_position: { x: 5, y } });
  c.wheel(cx, "kc-turn-C", ev(40));
  c.areaWheel(ev(300), cx); // C's top 662: the view's top 662 + 40 - 300 - 10 = 392 < 500
  assert.equal(c.top, 392);
  assert.equal(asked, 1, "the read upward asked");
  assert.equal(c.olderBusy, true);
  c.wheel(cx, "kc-turn-C", ev(40));
  c.areaWheel(ev(300), cx);
  assert.equal(asked, 1, "once at a time");
}
// ── #59: the scrollbar dragged, the view's top is found again under the pointer (seen()) ──
{
  const c = chat(three(), { start: 0, end: 30 }), cx = ctx();
  for (const [id, h] of [["kc-head", 42], ["kc-turn-A", 300], ["kc-turn-B", 300], ["kc-turn-C", 300], ["kc-working", 50]]) c.hts.set(id, h);
  c.vh = 500;
  c.follow = false;
  c.top = null;
  c.tlLost = true;
  c.state.more = false;
  const mv = (y) => ({ position: { x: 5, y: 400 }, local_position: { x: 5, y } });
  c.seen(cx, "kc-turn-B", mv(40));
  assert.equal(c.top, null, "one half: nothing yet");
  c.seen(cx, null, { position: { x: 6, y: 400 }, local_position: { x: 6, y: 300 } });
  assert.equal(c.top, null, "another pointer: not the same move");
  c.seen(cx, "kc-turn-B", mv(40));
  c.seen(cx, null, mv(300));
  assert.equal(c.top, 362 + 40 - 300, "B's top 362, the pointer 40 into it and 300 down the view");
  assert.equal(c.tlLost, false, "the timeline lights again");
  assert.equal(c.tlId, "B");
  const n = cx.notified;
  c.seen(cx, "kc-turn-C", mv(10));
  c.seen(cx, null, mv(10));
  assert.equal(c.top, 102, "known: a move costs nothing");
  assert.equal(cx.notified, n);
}

// ── A7: a wheel finds the view again ──
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
