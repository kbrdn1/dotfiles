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
  exec: async (...a) => (globalThis.execStub ? globalThis.execStub(...a) : { code: 0, stdout: "" }), hc: async () => ({}), readTextFile: async () => "", writeTextFile: async () => {},
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
    vh: 0, areaW: 0, pinned: null, top: 120, reveal: null, viewY: null, wheelEst: null, jump: null, tlId: null, tlAbove: false, tlLost: false, bgBtn: false,
    budget: null, shownSteps: new Map(), open: new Set(), settling: false,
    drawn: new Map(), byState: new Map(), heldNow: new Set(), keepRow: null, pressMoved: false,
    ahead: null, aheadTimer: false, lastWheel: 0, reachWait: null, farTo: null,
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
{
  // The engine hands the area the CONTENT's bounds and a local y in the content (journal, 2026-11-20):
  // scrolled 5 000 px down, a press 20 px under the view's top is at 5 020 in the content. Where the
  // button is: the press against the view's top (viewY), not its local y.
  const c = chat(), cx = ctx();
  c.bgBtn = true;
  c.viewSeen({ bounds: { y: 61 } });
  const real = (vy) => ({ position: { x: 990, y: 61 + vy }, local_position: { x: 990, y: 5000 + vy }, bounds: { y: 61 - 5000, width: 1000, height: 9000 } });
  c.areaPress(real(20), cx);
  assert.equal(c.follow, true, "scrolled down, the button is still the button");
  c.areaPress(real(60), cx);
  assert.equal(c.follow, false, "and under it, the bar");
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
    c.viewSeen({ bounds: { y: 61 } }); // the pointer crossed the transcript (kc-view): the view's top in the window
    return c;
  };
  // A press as the engine hands it (journal, 2026-11-20): the view's top at 61 in the window, scrolled
  // 400 px. The row's half: its bounds in the window (B's top 660: 61 + 660 - 400); the area's half: the
  // content's bounds (61 - 400) and a local y in the content.
  const rowHalf = (y) => ({ position: { x: 5, y: 321 + y }, local_position: { x: 5, y }, bounds: { y: 321, width: 1000, height: 300 } });
  const viewHalf = (y) => ({ position: { x: 5, y: 321 + y }, local_position: { x: 500, y: 660 + y }, bounds: { y: 61 - 400, width: 1000, height: 1400 } });
  {
    const c = setup(), cx = ctx();
    // The press: in turn B, 40 px into it, 300 px down the view (B's top 660: the view's top 400).
    c.pressTurn("kc-turn-B", rowHalf(40), cx);
    c.areaPress(viewHalf(40), cx);
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
    c.areaPress(viewHalf(40), cx);
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
    c.areaPress(viewHalf(40), cx);
    assert.equal(c.keepRow, null, "following the bottom, a press doesn't move the reader (the last turn stays first)");
    c.follow = false;
    c.cur = 1;
    c.pressTurn("kc-turn-B", rowHalf(40), cx);
    c.areaPress(viewHalf(40), cx);
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
  // One event as the engine hands the area its half (journal, 2026-11-20): the view's top at 61 in the
  // window, the view 100 px down the content, so the content painted from 61 - 100; a local y in the
  // content. The wheel goes down 10.
  const ev = { delta: { x: 0, y: -10 }, position: { x: 5, y: 361 }, local_position: { x: 5, y: 400 }, bounds: { y: 61 - 100, width: 1000, height: 1010 } };
  c.areaWheel(ev, cx);
  assert.equal(c.top, null, "the view's top in the window not seen yet: unknown, nothing measured");
  c.viewSeen({ bounds: { y: 61 } }); // kc-view under the pointer
  c.areaWheel(ev, cx);
  assert.equal(c.tlLost, false, "a wheel event measured the view: lit again");
  assert.equal(c.top, 110, "the view's top: 100 down, then the wheel's 10");
  assert.equal(c.tlId, "B", "B starts in the view (its top 360, the view's top 110)");
}
{
  // The bottom by the wheel follows again (the live tail's new turns show): the view's top measured at
  // the bottom (the rows' end 1011 + 8 - 500 = 519), going down.
  const c = chat(three(), { start: 0, end: 30 });
  for (const [id, h] of [["kc-head", 40], ["kc-turn-A", 300], ["kc-turn-B", 300], ["kc-turn-C", 300], ["kc-working", 50]]) c.hts.set(id, h);
  c.vh = 500;
  c.follow = false;
  const cx = ctx();
  c.viewSeen({ bounds: { y: 61 } });
  c.areaWheel({ delta: { x: 0, y: -40 }, position: { x: 5, y: 361 }, local_position: { x: 5, y: 800 }, bounds: { y: 61 - 500, width: 1000, height: 1019 } }, cx);
  assert.equal(c.top, 519, "500 down, the wheel's 40 down, clamped at the end");
  assert.equal(c.follow, true, "the bottom reached by the wheel: followed again");
}

// ── #59: the timeline over the whole session (the summary, chat-index.ts --marks): a message far above
// is read up to, in reads the summary bounds, then jumped to ──
{
  const many = (n) => Array.from({ length: n }, (_, k) => turn(`T${k}`, k * 10, `message ${k}`)).flat();
  const summaryOf = (all) => {
    const opened = all.filter((e) => e.turn);
    return { path: "/p", end: all.at(-1).o + 9, turns: opened.map((e) => ({ o: e.o, uuid: e.uuid, at: e.at })), marks: opened.map((e) => ({ o: e.o, uuid: e.uuid, turn: e.uuid, at: e.at, text: e.text, images: 0, note: false })) };
  };
  // The CLI as chat-index.ts slices: [from, to), its last `lim.turns` turns; `more` as it says it,
  // something before its start IN THIS READ (start > from): a read with a --from that fits whole says
  // false with the session's older turns still above (t1, 2026-11-20: the jump that never came).
  const cli = (all, reads, gate = null) => async (path, extra, lim = {}) => {
    const at = extra.indexOf("--from"), from = at < 0 ? 0 : Number(extra[at + 1]), to = Number(extra[extra.indexOf("--to") + 1]);
    reads.push([from, to, lim.turns]);
    if (gate) await gate;
    const opened = all.filter((e) => e.turn && e.o >= from && e.o < to).slice(-(lim.turns ?? 30));
    const start = opened[0]?.o ?? to;
    return out(path, start, to, start > from, all.filter((e) => e.o >= start && e.o < to));
  };
  const spawner = () => {
    const cx = { notified: 0, spawn: (fn) => (cx.p = fn(cx)), notify() { cx.notified++; } };
    return cx;
  };
  {
    // A read far up asks the indexer for more turns a read (FAR); every other read, the usual limits.
    const c = chat();
    let args = null;
    globalThis.execStub = async (_cmd, a) => {
      args = a;
      return { code: 0, stdout: "{}" };
    };
    await c.index("/p", ["--from", "5"], { turns: 90, budget: 7, entries: 9 });
    assert.deepEqual(args.slice(1, 8), ["/p", "--last-turns", "90", "--budget", "7", "--max-entries", "9"]);
    await c.index("/p", ["--marks"]);
    assert.deepEqual(args.slice(2, 8), ["--last-turns", "30", "--budget", "500000", "--max-entries", "900"], "the usual limits by default");
    assert.equal(args.at(-1), "--marks");
    globalThis.execStub = null;
  }
  {
    const all = many(200);
    const c = chat(all.filter((e) => e.o >= 1950), { start: 1950, end: 2000 });
    c.summary = summaryOf(all);
    c.rebuild(true);
    assert.equal(c.marks.length, 200, "every message of the session on the timeline, not the 5 loaded");
    assert.deepEqual(c.marks.slice(0, 195).map((m) => m.i), Array(195).fill(-1), "those above: not loaded");
    const reads = [];
    c.index = cli(all, reads);
    const cx = spawner();
    c.jumpTo(2, cx); // T2, at byte 20
    assert.equal(c.farTo, "T2", "a read toward it");
    assert.equal(c.follow, false, "the bottom left: the live tail's trim keeps what is read");
    assert.equal(c.olderBusy, true, "the head says « lecture… »");
    await cx.p;
    assert.deepEqual(reads, [[1050, 1950, 90], [150, 1050, 90], [20, 150, 90]], "90 turns a read, the last from T2's opener");
    assert.equal(c.state.start, 20);
    assert.equal(c.turns[c.cur].id, "T2", "then the jump, as to a loaded message");
    assert.equal(c.jump, "T2");
    assert.ok(c.first() <= c.cur && c.cur < c.end(), "its turn drawn");
    assert.equal(c.marks.find((m) => m.id === "T2").i, c.cur);
    assert.equal(c.olderBusy, false);
    assert.equal(c.farTo, null);
  }
  {
    // The bottom pressed while it reads: the read in flight lands, no other, no jump.
    const all = many(200);
    const c = chat(all.filter((e) => e.o >= 1950), { start: 1950, end: 2000 });
    c.summary = summaryOf(all);
    c.rebuild(true);
    let open;
    const reads = [];
    c.index = cli(all, reads, new Promise((r) => (open = r)));
    const cx = spawner();
    c.jumpTo(2, cx);
    c.farTo = null; // what the « bas » button and the keys do (bottom button, move())
    open();
    await cx.p;
    assert.equal(reads.length, 1, "no read after it");
    assert.equal(c.jump, null, "no jump");
    assert.equal(c.olderBusy, false);
  }
  {
    // The live tail while it reads: not following, the trim keeps every loaded turn (what the next read
    // continues), where it would keep from the window's first turn otherwise.
    const all = many(700); // 1 400 entries, past KEEP
    for (const why of ["reaching", "ahead", null]) {
      const c = chat(all, { start: 0, end: 7000 });
      c.follow = false;
      c.win = { from: 690, to: 700 };
      c.farTo = why === "reaching" ? "T5" : null;
      c.ahead = why === "ahead" ? { at: Date.now() } : null;
      c.index = async () => out("/p", 7000, 7010, false, turn("N", 7000));
      await c.tail("/p", true);
      assert.equal(c.state.start, why ? 0 : 1010, why ? `${why}: everything stays (rows read above wait to come in)` : "else: KEEP entries (the window's turns among them), the oldest go");
    }
  }
  {
    // A far message clicked while goAhead()'s read is in flight: read toward after it, never dropped.
    const all = many(200);
    const c = chat(all.filter((e) => e.o >= 1950), { start: 1950, end: 2000 });
    c.summary = summaryOf(all);
    c.rebuild(true);
    c.follow = false;
    let open;
    const reads = [];
    c.index = cli(all, reads, new Promise((r) => (open = r)));
    const cx = spawner();
    c.goAhead(cx);
    const auto = cx.p;
    assert.equal(c.olderBusy, true, "goAhead() reads (the head says « lecture… »)");
    c.jumpTo(2, cx);
    assert.equal(c.farTo, "T2", "the click is taken: it waits for the read in flight");
    open();
    await auto;
    await cx.p;
    assert.equal(c.turns[c.cur]?.id, "T2", "then it reads up to its message and jumps");
    assert.equal(c.jump, "T2");
    assert.equal(c.ahead, null, "goAhead()'s rows stay out of a jump");
  }
  {
    // A second far message clicked while the read toward the first is in flight: it is the one reached.
    const all = many(200);
    const c = chat(all.filter((e) => e.o >= 1950), { start: 1950, end: 2000 });
    c.summary = summaryOf(all);
    c.rebuild(true);
    let open;
    const reads = [];
    c.index = cli(all, reads, new Promise((r) => (open = r)));
    const cx = spawner();
    c.jumpTo(2, cx);
    const first = cx.p;
    c.jumpTo(4, cx);
    assert.equal(c.farTo, "T4", "the second click is taken");
    open();
    await first;
    await cx.p;
    assert.equal(c.turns[c.cur]?.id, "T4", "the second one read up to and jumped to");
    assert.equal(c.farTo, null, "nothing left waiting (goAhead() works again)");
    assert.equal(c.olderBusy, false);
  }
}

// ── #59, étape 2: « Tours précédents » by itself near the head, at rest, the reader's rows kept on screen ──
{
  const many = (n) => Array.from({ length: n }, (_, k) => turn(`T${k}`, k * 10, `message ${k}`)).flat();
  // 20 turns loaded, T10..T19 drawn, each 100 high, the head 40: T10's top at 20 + 40 = 60.
  const setup = () => {
    const c = chat(many(20), { start: 0, end: 200 });
    c.win = { from: 10, to: 20 };
    c.follow = false;
    c.vh = 300; // the head near under 450; the bottom at 1111 + 8 - 300 = 819
    c.hts.set("kc-head", 40);
    c.hts.set("kc-working", 50);
    for (let k = 10; k < 20; k++) c.hts.set(`kc-turn-T${k}`, 100);
    c.viewSeen({ bounds: { y: 61 } });
    return c;
  };
  // The area's half of a wheel event: the view's top at 61 in the window, the content painted from 61 - top.
  const up = (top, dy) => ({ delta: { x: 0, y: dy }, position: { x: 5, y: 300 }, local_position: { x: 5, y: top + 239 }, bounds: { y: 61 - top, width: 1000, height: 1060 } });
  {
    const c = setup(), cx = ctx();
    c.areaWheel(up(900, 30), cx);
    assert.equal(c.ahead, null, "going up far from the head (819, over 1.5 views): nothing yet");
    c.areaWheel(up(300, -30), cx);
    assert.equal(c.ahead, null, "going down near it: nothing");
    c.areaWheel(up(200, 30), cx);
    assert.ok(c.ahead, "going up near the head (170): the turns above wait to come in");
    assert.deepEqual(c.aheadRows().map((x) => x.id), ["T5", "T6", "T7", "T8", "T9"], "those « Tours précédents » would draw (the window up to CAP)");
    assert.deepEqual(c.win, { from: 10, to: 20 }, "nothing drawn above yet: nothing moves on screen");
    assert.equal(cx.timers.length, 1, "one timer");
    c.areaWheel(up(170, 30), cx);
    assert.equal(cx.timers.length, 1, "still one, however many events (bursts of 29)");
    assert.equal(c.top, 140, "the view's top the last event leaves");
    c.lastWheel = Date.now() - 1000;
    cx.fire();
    assert.deepEqual(c.win, { from: 10, to: 20 }, "at rest but not measured: they wait");
    assert.equal(cx.timers.length, 1, "the timer again");
    const n = cx.notified;
    for (let k = 5; k < 10; k++) c.measured(`kc-turn-T${k}`, { width: 800, height: 120 }, cx);
    assert.equal(cx.notified, n + 5, "each size measured out of the flow asks a render (the next ones to measure)");
    c.lastWheel = Date.now();
    cx.fire();
    assert.deepEqual(c.win, { from: 10, to: 20 }, "measured, but a wheel event under AHEAD.rest ago: never during a gesture");
    c.m = { shown: new Set(["kc-in-t-T7"]) }; // the box's draw marked T7 shown (landing())
    c.lastWheel = Date.now() - 1000;
    cx.fire();
    assert.deepEqual(c.win, { from: 5, to: 20 }, "at rest and measured: they come in");
    assert.ok(["T5", "T6", "T7", "T8", "T9"].every((id) => c.fresh.has(id)), "they fade in where they land (#92), where the skeleton was");
    assert.equal(c.m.shown.has("kc-in-t-T7"), false, "even T7, which the box drew");
    assert.equal(c.reveal, null, "no scroll_to_item: the smallest scroll would move the reader (it lands on T10's bottom)");
    assert.deepEqual({ id: c.keepRow.id, screen: c.keepRow.screen }, { id: "kc-turn-T10", screen: -80 }, "T10 kept where it is: 80 above the view's top");
    // The render: the view's top moves by what came above (5 x 120); a row under T10 not measured
    // (« Tours suivants » a slide brings, here the working row) only shortens the anchor.
    c.hts.delete("kc-working");
    const k = c.keepY(new Map());
    assert.equal(k?.top, 140 + 600, "the view posed at its top plus the rows that came above, to the px");
    assert.equal(c.keepRow?.correct, true, "kept for a second: a row of another height in the flow corrects it");
    c.measured("kc-turn-T7", { width: 800, height: 150 }, cx);
    assert.equal(c.keepY(new Map())?.top, 140 + 630, "T7 came out 30 higher in the flow: corrected");
    assert.equal(c.ahead, null);
  }
  {
    // The rows read first when none is loaded above: the drawn ones and the cursor stay on their turns.
    const all = many(200);
    const c = chat(all.filter((e) => e.o >= 1950), { start: 1950, end: 2000 });
    c.follow = false;
    c.cur = 3;
    const reads = [];
    c.index = async (path, extra) => {
      reads.push(extra);
      const to = Number(extra[extra.indexOf("--to") + 1]), start = to - 300;
      return out(path, start, to, start > 0, all.filter((e) => e.o >= start && e.o < to));
    };
    const cx = { notified: 0, timers: [], spawn: (fn) => (cx.p = fn(cx)), notify() { cx.notified++; } };
    cx.timer = { after: (ms, fn) => cx.timers.push({ ms, fn }) };
    c.goAhead(cx);
    await cx.p;
    assert.deepEqual(reads, [["--to", "1950"]], "the read « Tours précédents » makes");
    assert.equal(c.state.start, 1650);
    assert.deepEqual(c.turns.slice(c.first(), c.end()).map((x) => x.id), ["T195", "T196", "T197", "T198", "T199"], "the same turns drawn");
    assert.equal(c.turns[c.cur].id, "T198", "the cursor on its turn");
    assert.equal(c.aheadRows().length, 10, "the read turns wait to come in");
    assert.equal(cx.timers.length, 1);
  }
  {
    const c = setup(), cx = ctx();
    c.follow = true;
    c.goAhead(cx);
    assert.equal(c.ahead, null, "following the bottom: nothing");
    c.follow = false;
    c.jump = "T3";
    c.goAhead(cx);
    assert.equal(c.ahead, null, "a jump on its way: nothing");
    c.jump = null;
    c.goAhead(cx);
    c.jump = "T3";
    c.lastWheel = 0;
    cx.fire();
    assert.equal(c.ahead, null, "a jump meanwhile: let go");
  }
  {
    // At CAP the window's bottom goes, never a turn in the view: the view [410, 710] on T13..T16.
    const c = chat(many(30), { start: 0, end: 300 });
    c.win = { from: 10, to: 25 };
    c.follow = false;
    c.builtLive = false;
    c.vh = 300;
    c.hts.set("kc-head", 40);
    c.hts.set("kc-later", 42);
    for (let k = 0; k < 25; k++) c.hts.set(`kc-turn-T${k}`, 100); // T0..T9 as the box measured them
    c.viewSeen({ bounds: { y: 61 } });
    const cx = ctx();
    c.areaWheel(up(440, 30), cx);
    c.lastWheel = Date.now() - 1000;
    cx.fire();
    assert.deepEqual(c.win, { from: 2, to: 17 }, "T16, in the view, stays drawn: 8 come above, not 10");
    assert.equal(c.keepY(new Map())?.top, 410 + 800, "T10 kept on screen");
  }
  {
    // The head's skeleton breathes only while something is on its way above; every way out lets it go.
    const c = setup(), cx = ctx();
    assert.deepEqual([c.loading("head"), c.loading("foot")], [false, false], "at rest: faint, still");
    c.olderBusy = true;
    assert.equal(c.loading("head"), true, "a read in flight: it breathes");
    c.olderBusy = false;
    c.areaWheel(up(200, 30), cx);
    assert.deepEqual([c.loading("head"), c.loading("foot")], [true, false], "rows waiting to come in above: the head, not the foot");
    for (let k = 5; k < 10; k++) c.hts.set(`kc-turn-T${k}`, 120);
    c.lastWheel = Date.now() - 1000;
    cx.fire();
    assert.equal(c.loading("head"), false, "they came in: still again");
    c.areaWheel(up(140, 30), cx);
    c.ahead.at = Date.now() - 20000;
    cx.fire();
    assert.equal(c.loading("head"), false, "let go after AHEAD.give (nothing measures: the Chat hidden)");
    c.goAhead(cx);
    c.older(cx);
    assert.equal(c.loading("head"), false, "« Tours précédents » clicked: its own read says it (olderBusy)");
  }
  {
    // Rows waiting to come in above, then the wheel goes down: let go (what they would cut is where it goes).
    const c = setup(), cx = ctx();
    c.areaWheel(up(200, 30), cx);
    assert.ok(c.ahead);
    c.areaWheel(up(170, -30), cx);
    assert.equal(c.ahead, null, "the wheel the other way: the wait let go");
    c.lastWheel = 0;
    cx.fire();
    assert.deepEqual(c.win, { from: 10, to: 20 }, "nothing comes");
  }
}

// ── #59: the same downward after a jump (« Tours suivants » by itself), then the live tail followed again.
// Measured on t1 (2026-11-20, 03:41:23-28): the window [0,10) of 825 turns loaded, the wheel at its end for
// 5 s, « Tours suivants » under it, nothing came. ──
{
  const many = (n) => Array.from({ length: n }, (_, k) => turn(`T${k}`, k * 10, `message ${k}`)).flat();
  // 30 turns loaded (a jump left the window at their top), the drawn ones 100 high, the head 40, « Tours suivants » 42.
  const setup = (to, tall = {}) => {
    const c = chat(many(30), { start: 0, end: 300 });
    c.win = { from: to - Math.min(to, 15), to };
    c.follow = false;
    c.builtLive = false;
    c.vh = 300;
    c.hts.set("kc-head", 40);
    c.hts.set("kc-later", 42);
    for (let k = c.win.from; k < to; k++) c.hts.set(`kc-turn-T${k}`, tall[k] ?? 100);
    c.viewSeen({ bounds: { y: 61 } });
    return c;
  };
  const down = (top, dy) => ({ delta: { x: 0, y: dy }, position: { x: 5, y: 300 }, local_position: { x: 5, y: top + 239 }, bounds: { y: 61 - top, width: 1000, height: 4000 } });
  {
    // The window under CAP: the turns come at once, under the view (the view doesn't move).
    const c = setup(10), cx = ctx();
    c.areaWheel(down(100, -20), cx);
    assert.deepEqual(c.win, { from: 0, to: 10 }, "going down far from the window's end (420 of 1111): nothing");
    c.areaWheel(down(500, -20), cx);
    assert.deepEqual(c.win, { from: 0, to: 15 }, "near its end: « Tours suivants » by itself, the window grown to CAP");
    assert.ok(["T10", "T11", "T12", "T13", "T14"].every((id) => c.fresh?.has(id)), "they fade in under the view");
    assert.equal(c.ahead, null, "at once: nothing above goes, the view doesn't move");
    assert.equal(c.keepRow, null);
    assert.equal(cx.timers.length, 0);
  }
  {
    // At CAP: the top goes, at rest only, the first turn in the view kept where it is.
    const c = setup(15), cx = ctx();
    c.areaWheel(down(1300, -10), cx);
    assert.deepEqual(c.win, { from: 0, to: 15 }, "the top would go: not during a gesture");
    assert.equal(cx.timers.length, 1);
    c.lastWheel = Date.now();
    cx.fire();
    assert.deepEqual(c.win, { from: 0, to: 15 }, "a wheel event under AHEAD.rest ago: still waiting");
    c.lastWheel = Date.now() - 1000;
    cx.fire();
    assert.deepEqual(c.win, { from: 10, to: 25 }, "at rest: « Tours suivants » (10 down, the 10 at the top gone)");
    assert.ok(c.fresh?.has("T15") && c.fresh.has("T24"), "the turns that came fade in");
    assert.deepEqual({ id: c.keepRow?.id, screen: c.keepRow?.screen }, { id: "kc-turn-T12", screen: -50 }, "T12, the first turn in the view, kept 50 above its top");
    const k = c.keepY(new Map());
    assert.equal(k?.top, 1310 - 1000, "the view's top moved up by the 10 turns gone, the turns under it not measured yet");
  }
  {
    // The foot's skeleton breathes while goBelow()'s turns wait for the rest, and only then.
    const c = setup(15), cx = ctx();
    assert.deepEqual([c.loading("head"), c.loading("foot")], [false, false]);
    c.areaWheel(down(1300, -10), cx);
    assert.deepEqual([c.loading("head"), c.loading("foot")], [false, true], "turns waiting to come in below: the foot breathes, not the head");
    c.lastWheel = Date.now() - 1000;
    cx.fire();
    assert.equal(c.loading("foot"), false, "they came: still again");
    const d = setup(15), dx = ctx();
    d.areaWheel(down(1300, -10), dx);
    d.newer();
    assert.equal(d.loading("foot"), false, "« Tours suivants » clicked: the wait let go");
  }
  {
    // Waiting to go down, the window not at the loaded top: nothing above is measured nor waited for.
    const c = setup(20), cx = ctx();
    c.areaWheel(down(1300, -10), cx);
    assert.equal(c.ahead?.down, true);
    assert.deepEqual(c.aheadRows(), [], "the turns above aren't measured for a move down");
    c.lastWheel = Date.now() - 1000;
    cx.fire();
    assert.deepEqual(c.win, { from: 15, to: 30 }, "the window at the end, T17 (the first in the view) kept");
  }
  {
    // A turn in the view never goes: the cut stops at it (T9, 2 000 high, the view inside it).
    const c = setup(15, { 9: 2000 }), cx = ctx();
    c.areaWheel(down(2910, -10), cx);
    c.lastWheel = Date.now() - 1000;
    cx.fire();
    assert.deepEqual(c.win, { from: 9, to: 24 }, "the window's top stops at T9, in the view");
    assert.equal(c.keepRow?.id, "kc-turn-T9");
  }
  {
    // The window at the end: the wheel at the bottom follows the live tail again.
    const c = setup(30), cx = ctx();
    c.areaWheel(down(1260, -20), cx);
    assert.equal(c.follow, true, "the conversation's end reached: followed again");
    assert.equal(c.ahead, null, "nothing more to bring");
  }
}
console.log("scroll.check: ok");
