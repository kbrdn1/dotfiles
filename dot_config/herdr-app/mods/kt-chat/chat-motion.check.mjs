// bun ~/.config/herdr-app/mods/kt-chat/chat-motion.check.mjs: #92's motion, what herdr-app check can't
// show (it draws once): the real Chat class, its host modules (gpui-kit, gpui-base, herdr) stubbed by
// recorders of the elements main.js builds, its methods called on a bare instance, on the invented
// session of chat-fixture.jsonl.
// - a turn that arrived live comes in fading and rising 6 px INSIDE a box that clips: no height moves,
//   so the scroll's height doesn't either and a followed bottom stays put (the lead's requirement);
// - a fold just opened opens its items on their height (rows()), except the last turn while the bottom
//   is followed; drawn again later, it lands as it is;
// - the background panel comes in as a popup and fades out before it goes;
// - reduced motion: none of it, no transition anywhere (fold, turn, panel).
import assert from "node:assert/strict";
import { plugin } from "bun";
import { readdirSync, readFileSync } from "node:fs";

// ── The host, recorded ──────────────────────────────────────────────────────
const dir = import.meta.dir;
const names = { "gpui-kit": new Set(), "gpui-base": new Set(), herdr: new Set() };
for (const f of readdirSync(dir).filter((f) => f.endsWith(".js"))) {
  for (const m of readFileSync(`${dir}/${f}`, "utf8").matchAll(/import\s*\{([^}]*)\}\s*from\s*"(gpui-kit|gpui-base|herdr)"/g)) {
    for (const n of m[1].split(",")) if (n.trim()) names[m[2]].add(n.trim().split(/\s+as\s+/)[0]);
  }
}
// An element: every call is recorded (its name and arguments) and gives the element back; child,
// children and when build the tree. Anything else (TextView.markdown, Textarea.new, PathBuilder…) is a
// maker of elements.
const node = (kind) => {
  const n = { kind, calls: [], kids: [] };
  const p = new Proxy(function () {}, {
    get(_t, k) {
      if (k === "__node") return n;
      if (k === "then") return undefined;
      return (...a) => {
        if (k === "child") { if (a[0] != null && typeof a[0] === "object" || typeof a[0] === "function") n.kids.push(a[0]); }
        else if (k === "children") n.kids.push(...(a[0] ?? []).filter((x) => x != null));
        else if (k === "when") return a[0] ? a[1](p) : p;
        else n.calls.push([k, a]);
        return p;
      };
    },
    apply: () => p,
  });
  return p;
};
const maker = (kind) => new Proxy(function () {}, { get: (_t, k) => (k === "then" ? undefined : maker(`${kind}.${String(k)}`)), apply: () => node(kind) });
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
globalThis.window = { paint_path: () => node("path") };
const { default: Chat } = await import("./main.js");
const { ingest } = await import("./chat-model.js");
const { index } = await import("./chat-index.ts");
const { motionState, frame } = await import("./motion.js");
const { mdState } = await import("./markdown.js");

// The tree under an element, flat; a node's calls by name.
const flat = (p, out = []) => { const n = p?.__node; if (!n) return out; out.push(n); for (const k of n.kids) flat(k, out); return out; };
const callsOf = (n, name) => n.calls.filter(([k]) => k === name).map(([, a]) => a);
const transitions = (nodes) => nodes.flatMap((n) => callsOf(n, "transition").map((a) => a[0]));

// ── A bare Chat on the invented session ─────────────────────────────────────
const bytes = new Uint8Array(await Bun.file(new URL("./chat-fixture.jsonl", import.meta.url)).arrayBuffer());
const read = index(bytes, { from: 0, size: bytes.length, path: "/f.jsonl", home: "/w" });
function chat({ reduced = false } = {}) {
  const c = Object.create(Chat.prototype);
  Object.assign(c, {
    turns: [], win: { from: 0, to: 0 }, hts: new Map(), marks: [], builtLive: false, follow: false, cur: -1, queued: [],
    open: new Set(), shownSteps: new Map(), hover: null, copied: null, md: mdState(), att: new Map(), attQ: [],
    fresh: new Set(), liveItems: null, foldAt: null, going: new Set(), lastLedge: {}, subsKnown: new Map(),
    motion: motionState(), bgMenu: false, bgNote: null, bgBusy: new Set(), line: null, state: ingest(null, read),
  });
  c.rebuild(false);
  c.win = { from: 0, to: c.turns.length };
  c.m = frame(c.motion, reduced);
  return c;
}
const cx = () => { const x = { notified: 0, timers: [], notify() { x.notified++; }, spawn() {}, timer: { after: (ms, fn) => x.timers.push([ms, fn]) } }; return x; };
const T = {};
const draw = (c, i, x = cx()) => flat(c.turn(T, x, c.turns[i], i, false));

// The first turn of the fixture has a fold (its work, then the answer).
const base = chat();
const k = base.turns.findIndex((t) => t.fold);
assert.ok(k >= 0, "the fixture has a turn with a fold");
const id = base.turns[k].id;

// ── A turn arrived live: in fading and rising 6 px inside a box that clips, no height moving ──
{
  const c = chat();
  c.fresh.add(id);
  const nodes = draw(c, k);
  const lands = nodes.filter((n) => callsOf(n, "id").some(([v]) => v === `kc-in-t-${id}`));
  assert.equal(lands.length, 1, "the turn's content comes in under one id");
  const land = lands[0];
  assert.deepEqual(callsOf(land, "top").at(-1), [6], "drawn 6 px low at first (DY.row)");
  assert.deepEqual(callsOf(land, "opacity").at(-1), [0], "and faded out");
  assert.ok(transitions([land]).includes("top") && transitions([land]).includes("opacity"), "the rise and the fade are native transitions");
  const box = nodes.find((n) => n.kids.some((kid) => kid.__node === land));
  assert.ok(box && callsOf(box, "overflow_hidden").length, "its box clips: the rise goes over no neighbour");
  assert.ok(!transitions(nodes).includes("height"), "no height moves: the scroll's height stays, a followed bottom stays put");
  // The next render after its first layout: in place, and no longer fresh.
  c.m = frame(c.motion, false);
  c.m.shown.add(`kc-in-t-${id}`);
  const again = draw(c, k).find((n) => callsOf(n, "id").some(([v]) => v === `kc-in-t-${id}`));
  assert.deepEqual(callsOf(again, "top").at(-1), [0], "then at its place");
  assert.ok(!c.fresh.has(id), "it came in: a window change brings it back as it is");
}
// Not arrived live (a first build, an older read, a window change): as it is, no motion.
{
  const c = chat();
  const land = draw(c, k).find((n) => callsOf(n, "id").some(([v]) => v === `kc-in-t-${id}`));
  assert.deepEqual([callsOf(land, "top").at(-1), callsOf(land, "opacity").at(-1)], [[0], [1]], "drawn in place, at once");
}

// ── A fold just opened: its items open on their height, in order (rows()) ──
const foldRows = (nodes) => nodes.filter((n) => callsOf(n, "id").some(([v]) => String(v).startsWith(`kc-fk-${id}:`) && !String(v).endsWith("~in")));
{
  const c = chat();
  c.open.add(`f:${id}`);
  c.foldAt = { id, at: Date.now() };
  c.win = { from: 0, to: c.turns.length + 1 }; // not the last row drawn
  const rows = foldRows(draw(c, k));
  assert.ok(rows.length > 0, "the fold's items, each in its row");
  for (const r of rows) {
    assert.deepEqual(callsOf(r, "h").at(-1), [0], "each starts closed");
    assert.ok(transitions([r]).includes("height"), "and opens on its height");
  }
}
{
  // The last turn while the bottom is followed: it opens at once (the bottom would chase it).
  const c = chat();
  c.open.add(`f:${id}`);
  c.foldAt = { id, at: Date.now() };
  c.follow = true;
  c.win = { from: 0, to: k + 1 };
  const rows = foldRows(draw(c, k));
  assert.ok(!transitions(rows).includes("height"), "the followed bottom's last turn: no height motion");
}
{
  // Drawn again later (no fold just toggled): as it is.
  const c = chat();
  c.open.add(`f:${id}`);
  const rows = foldRows(draw(c, k));
  assert.ok(!transitions(rows).includes("height"), "a fold drawn again lands as it is");
}

// ── The background panel: in as a popup, out fading before it goes ──
const pr = { key: "p", name: "Projet" };
{
  const c = chat();
  c.bgOf = () => null;
  c.bgMenu = true;
  const [, wrap] = c.bgControls(T, pr);
  const nodes = flat(wrap);
  const panel = nodes.find((n) => callsOf(n, "id").some(([v]) => v === "kc-bg-panel"));
  assert.deepEqual([callsOf(panel, "top").at(-1), callsOf(panel, "opacity").at(-1)], [[6], [0]], "it comes in from 6 px low, faded");
  assert.ok(transitions([panel]).includes("top") && transitions([panel]).includes("opacity"));
  const x = cx();
  c.closeBg(x);
  assert.equal(c.bgMenu, true, "closing: still drawn while it fades out");
  const [, wrap2] = c.bgControls(T, pr);
  const out = flat(wrap2).find((n) => callsOf(n, "id").some(([v]) => v === "kc-bg-panel"));
  assert.deepEqual(callsOf(out, "opacity").at(-1), [0], "fading out");
  assert.equal(x.timers.length, 1, "ONE one-shot timer");
  x.timers[0][1](cx());
  assert.equal(c.bgMenu, false, "then it goes");
}

// ── Reduced motion: none of it ──────────────────────────────────────────────
{
  const c = chat({ reduced: true });
  c.fresh.add(id);
  c.open.add(`f:${id}`);
  c.foldAt = { id, at: Date.now() };
  c.win = { from: 0, to: c.turns.length + 1 };
  const nodes = draw(c, k);
  assert.deepEqual(transitions(nodes), [], "a fold just opened and a turn arrived live: no transition at all");
  c.bgOf = () => null;
  c.bgMenu = true;
  assert.deepEqual(transitions(flat(c.bgControls(T, pr)[1])), [], "the background panel: none");
  const x = cx();
  c.closeBg(x);
  assert.equal(c.bgMenu, false, "it closes at once");
  assert.equal(x.timers.length, 0, "no timer");
}

console.log("chat-motion.check: ok");
