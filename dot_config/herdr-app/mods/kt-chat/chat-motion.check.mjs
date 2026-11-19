// bun ~/.config/herdr-app/mods/kt-chat/chat-motion.check.mjs: #92's motion, what herdr-app check can't
// show (it draws once): the real Chat class, its host modules (gpui-kit, gpui-base, herdr) stubbed by
// recorders of the elements main.js builds, its methods called on a bare instance, on the invented
// session of chat-fixture.jsonl.
// - a turn that arrived live comes in fading and rising 6 px INSIDE a box that clips: no height moves,
//   so the scroll's height doesn't either and a followed bottom stays put (the lead's requirement);
// - a fold just opened opens its items on their height (rows()), except the last turn while the bottom
//   is followed; drawn again later, it lands as it is;
// - the background panel comes in as a popup and fades out before it goes;
// - #81: the completion menu, a popup over the transcript (in and out on its opacity, never a height),
//   a pick's wave under the text in the field's box, and the keys route's Enter only on a prompt that
//   reads the command;
// - reduced motion: none of it, no transition anywhere (fold, turn, panel, menu).
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
// hc and agents() go through these two, which a case may swap (#81's keys route).
let hcFake = async () => ({});
let agentsFake = () => [];
// checking() answers live.checking: true for the Chat (as herdr-app check), false where a timer is the point.
const live = { checking: true };
const host = {
  agents: () => agentsFake(), panes: () => [], spaces: () => [], terminals: () => [], theme: () => ({}), settings: () => ({ dark: true, zoom: 1 }),
  props: () => ({}), shared: () => undefined, layout: () => null, focused: () => null, keys: () => ({}),
  home: () => "/h", appHome: () => "/h/.config/herdr-app", checking: () => live.checking, nextCommand: () => new Promise(() => {}),
  exec: async () => ({ code: 0, stdout: "" }), hc: (a) => hcFake(a), readTextFile: async () => "", writeTextFile: async () => {},
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
    fresh: new Set(), liveItems: null, foldAt: null, going: new Set(), lastLedge: {}, subsKnown: new Map(), drafts: [],
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

// ── #93: a turn's assets are worked out when the turn is built (rebuild()), never in render: render reads
// `turn.assets` (turnAssets over a busy turn's tools and texts made a closed turn ~3x dearer to draw) ──
{
  const c = chat();
  assert.ok(c.turns.every((t) => Array.isArray(t.assets)), "rebuild() gave every turn its assets");
  const t = c.turns[k];
  // What render draws is the field, whatever the turn holds: a made-up asset shows...
  t.assets = [{ id: "t:x:0", key: "s:1:x:0", kind: "image", drawn: true, name: "cap.png", ref: { o: 1, tool: "x", n: 0 } }];
  assert.ok(draw(c, k).some((n) => callsOf(n, "id").some(([v]) => v === `kc-ph-${t.id}-as-0`)), "render draws turn.assets");
  // ...and an empty field shows nothing, though the turn has an image a tool got back and a cited file:
  // were render to work the assets out again, they would show.
  t.assets = [];
  t.blocks = [...t.blocks, { role: "tool", id: "x", kind: "read", input: { path: "/w/proj/cap.png" }, result: { o: 1, ok: true, imgs: [{ n: 0, media: "image/png", bytes: 1 }] } },
    { role: "prose", id: "p:x", text: "voir /w/proj/doc.md", cites: [{ path: "/w/proj/doc.md", abs: "/w/proj/doc.md" }] }];
  assert.ok(!draw(c, k).some((n) => callsOf(n, "id").some(([v]) => String(v).startsWith(`kc-as-${t.id}`))), "render never works the assets out again");
}

// ── #93: the field's pieces. The composer's height changes at once when one comes or goes, never frame
// by frame (it would resize the transcript: areaSized each frame, the followed bottom shaking) ──
const { add } = await import("./attach.js");
const pieceBox = (nodes, p) => nodes.find((n) => n.kids.some((kid) => callsOf(kid.__node, "id").some(([v]) => v === `kc-dr-${p.id}`)));
const pieceOf = (nodes, p) => nodes.find((n) => callsOf(n, "id").some(([v]) => v === `kc-dr-${p.id}`));
const press = (nodes, id, x) => callsOf(nodes.find((n) => callsOf(n, "id").some(([v]) => v === id)), "on_click").at(-1)[0](null, x);
{
  const c = chat();
  c.drafts = add([], ["/p/cap.png", "/p/devis.pdf"], "drop").list;
  const nodes = flat(c.draftView(T, cx()));
  const row = nodes.find((n) => callsOf(n, "id").some(([v]) => v === "kc-drafts"));
  assert.ok(row && !callsOf(row, "h").length && !transitions(nodes).includes("height"), "no height moves: the row takes its height at once");
  for (const p of c.drafts) {
    const piece = pieceOf(nodes, p);
    assert.deepEqual([callsOf(piece, "top").at(-1), callsOf(piece, "opacity").at(-1)], [[6], [0]], `${p.label}: in from 6 px low, faded`);
    assert.ok(transitions([piece]).includes("top") && transitions([piece]).includes("opacity"), "native transitions, on the piece only");
    assert.ok(callsOf(pieceBox(nodes, p), "overflow_hidden").length, "inside a box of its own that clips: it rises over nothing");
  }
  // × : it fades out where it stands (its place kept: the height doesn't move), then ONE timer drops it.
  const x = cx();
  x.stop_propagation = () => {};
  press(nodes, `kc-dx-${c.drafts[1].id}`, x);
  assert.equal(c.drafts.length, 2, "still there while it fades");
  const going = flat(c.draftView(T, cx()));
  assert.deepEqual(callsOf(pieceOf(going, c.drafts[1]), "opacity").at(-1), [0], "fading out");
  assert.ok(!transitions(going).includes("height"), "no height moves while it fades");
  assert.equal(x.timers.length, 1, "ONE one-shot timer");
  x.timers[0][1](cx());
  assert.deepEqual(c.drafts.map((p) => p.label), ["cap.png"], "then it goes: the height changes once");
}
{
  // Reduced motion: no fade, no rise, no timer; × removes it at once.
  const c = chat({ reduced: true });
  c.drafts = add([], ["/p/cap.png", "/p/devis.pdf"], "drop").list;
  const nodes = flat(c.draftView(T, cx()));
  assert.deepEqual(transitions(nodes), [], "the pieces: no transition");
  const x = cx();
  x.stop_propagation = () => {};
  press(nodes, `kc-dx-${c.drafts[0].id}`, x);
  assert.deepEqual([c.drafts.map((p) => p.label), x.timers.length], [["devis.pdf"], 0], "gone at once, no timer");
}

// ── #81: the completion menu. A passing popup over the transcript's bottom (render() puts it in the
// transcript's box, never in the composer): in and out on its opacity, ONE timer after it faded out;
// nothing in it or in the composer moves on a height (the transcript would resize each frame) ──
const field = (text) => {
  const f = { text, wrote: [], value: () => f.text, selected_range: () => ({ start: f.text.length, end: f.text.length }), content: () => ({ text: f.text, tokens: [] }),
    replace_range_with_token(r, tk) { f.wrote.push(["token", r, tk.text]); }, set_selected_range(r) { f.wrote.push(["select", r]); }, replace(s) { f.wrote.push(["replace", s]); },
    focus() {}, set_value() {}, set_auto_grow() {}, on() {} };
  return f;
};
// Kylian types: the field's text, then its change (main.js' handler: draft, then complete()).
const typeIn = (c, text, x = cx()) => { c.composer.text = text; c.draft = text; return c.complete(x); };
const completing = (c, text) => {
  c.composer = field(text);
  c.draft = text;
  c.cpl = { catalog: { commands: [{ name: "me:goal", description: "Sprint", hint: null, kind: "command", category: "workflow" }], tools: [], files: [] },
    at: Date.now(), loading: false, menu: null, last: null, gen: 0, dismissed: null, typedAt: null, route: null, pieces: new Map(), n: 0 };
  c.menuScroll = { scroll_to_item() {} };
  c.vh = 600;
  c.wave = null;
  return c;
};
const menuNode = (c, gen) => flat(c.menuEl(T)).find((n) => callsOf(n, "id").some(([v]) => v === `kc-menu-${gen}`));
{
  const c = completing(chat(), "/go");
  const x = cx();
  assert.equal(c.complete(x), true, "the menu opens: one redraw");
  const wrap = c.menuEl(T).__node;
  assert.ok(callsOf(wrap, "absolute").length && callsOf(wrap, "bottom").at(-1)?.[0] === 8, "over the transcript's bottom, absolute: it moves nothing");
  assert.deepEqual(callsOf(menuNode(c, 1), "opacity").at(-1), [0], "it fades in");
  const nodes = flat(c.menuEl(T)).filter((n) => !callsOf(n, "id").some(([v]) => v === "kc-menu-ink"));
  assert.ok(!transitions(nodes).includes("height"), "no height moves in it (the active row's fill keeps its ROW height)");
  // Esc closes it (until another token), and it fades out: ONE timer lets it go.
  assert.equal(c.menuKey("escape", x), true);
  assert.equal(c.cpl.menu, null);
  assert.deepEqual(callsOf(menuNode(c, 1), "opacity").at(-1), [0], "fading out, its place kept");
  assert.ok(transitions([menuNode(c, 1)]).includes("opacity"));
  assert.equal(x.timers.length, 1, "ONE one-shot timer");
  x.timers[0][1](cx());
  assert.equal(c.menuEl(T), null, "then it goes");
  assert.equal(c.complete(cx()), false, "the same token again: Esc keeps it closed, no redraw");
  assert.equal(typeIn(c, "/goal"), false, "typing on in that token: still closed");
  typeIn(c, "");
  typeIn(c, "/");
  assert.ok(c.cpl.menu, "the field emptied, `/` again: the menu opens again (Esc closed one token, not `/` for good)");
  assert.equal(c.cpl.gen, 2, "a new opening: it fades in anew");
  // The composer, menu or not: no height moving in it.
  const agent = { address: "t9", status: "idle", program: "claude" };
  c.width = 700;
  c.handle = { is_focused: () => false };
  c.runner = null;
  c.m = frame(c.motion, false);
  assert.ok(!transitions(flat(c.composerView(T, { agent }, null, cx()))).includes("height"), "the composer: no height transition");
}
{
  // A pick: the token's range becomes the command and a space (plain text while CHIPS waits for the
  // capture slot), and its wave under the text, in the field's box that clips (a workflow: its rail
  // too); still no height moving in the composer.
  const c = completing(chat(), "/go");
  const x = cx();
  c.complete(x);
  c.accept(0, x);
  assert.deepEqual(c.composer.wrote, [["select", { start: 0, end: 3 }], ["replace", "/me:goal "]], "/go becomes « /me:goal »");
  assert.deepEqual([c.wave.category, c.wave.rail], ["workflow", true], "a workflow: the wave, then its rail");
  Object.assign(c, { width: 700, handle: { is_focused: () => false }, runner: null, m: frame(c.motion, false) });
  const nodes = flat(c.composerView(T, { agent: { address: "t9", status: "idle", program: "claude" } }, null, cx()));
  const box = nodes.find((n) => callsOf(n, "id").some(([v]) => v === "kc-field"));
  const kids = box.kids.map((k) => k.__node);
  assert.deepEqual(kids.slice(0, 4).map((n) => callsOf(n, "id").at(-1)?.[0]), ["kc-wave-1-0", "kc-wave-1-1", "kc-wave-1-2", "kc-wave-1-rail"], "under the text: drawn first");
  assert.equal(kids.at(-1).kind, "Textarea.new", "the text over them");
  assert.ok(callsOf(box, "overflow_hidden").length && callsOf(box, "relative").length, "the field's box clips them");
  assert.ok(!transitions(nodes).includes("height"), "no height moves");
  // The pick's own change (the field now reads "/me:goal "): no second wave.
  typeIn(c, "/me:goal ");
  assert.equal(c.wave.id, "kc-wave-1", "one pick, one wave");
}
{
  // A command typed by hand, then a space: its piece and its wave, once (typing on starts none).
  const c = completing(chat(), "");
  typeIn(c, "/me:goal");
  assert.equal(c.wave, null, "no space yet");
  assert.equal(typeIn(c, "/me:goal "), true, "a redraw for the wave");
  assert.deepEqual([c.wave?.id, c.wave?.category], ["kc-wave-1", "workflow"]);
  typeIn(c, "/me:goal sprint");
  assert.equal(c.wave.id, "kc-wave-1", "typing on: the same wave");
  assert.equal(c.cpl.route, "invoquée par l'agent", "the route line: a skill goes to the agent");
}
{
  // Reduced motion: it shows and goes at once, no transition, no timer.
  const c = completing(chat({ reduced: true }), "/go");
  const x = cx();
  c.complete(x);
  assert.deepEqual(transitions(flat(c.menuEl(T))), [], "no fade, no glide");
  c.closeMenu(x);
  assert.deepEqual([c.menuEl(T), x.timers.length], [null, 0], "gone at once, no timer");
}

// ── #81: a built-in as keys (keysSend): Enter only once the prompt reads exactly the command ──
{
  const RULE = "─".repeat(20);
  const screenOf = (p) => ["⏺ ok", RULE, `❯ ${p}`.trimEnd(), RULE, "  -- INSERT --"].join("\n");
  const run = async ({ status = "idle", before = "", after = "/context" } = {}) => {
    const calls = [];
    let typed = false;
    agentsFake = () => [{ address: "t9", status }];
    hcFake = async (a) => {
      calls.push(a.join(" "));
      if (a[0] === "read") return { code: 0, stdout: screenOf(typed ? after : before) };
      if (a[0] === "keys" && a[2] !== "enter") typed = true;
      return { code: 0, stdout: "" };
    };
    const c = chat();
    const x = cx();
    x.timer.after = (_ms, fn) => fn(); // the screen's catch-up reads, at once
    const res = await c.keysSend(x, "t9", { via: "keys", keys: [..."/context"] }, "/context");
    return { res, calls, enter: calls.includes("keys t9 enter") };
  };
  let r = await run();
  assert.deepEqual([r.res, r.enter], [{ ok: true }, true], "at rest, empty, typed exactly: Enter");
  assert.deepEqual(r.calls, ["read t9", "keys t9 / c o n t e x t", "read t9", "keys t9 enter"]);
  r = await run({ status: "working" });
  assert.deepEqual([r.res.why, r.calls.length], ["keys-busy", 1], "working: nothing typed");
  r = await run({ before: "un brouillon" });
  assert.deepEqual([r.res.why, r.enter, r.calls.some((x) => x.startsWith("keys"))], ["keys-prompt", false, false], "a draft in the prompt: nothing typed");
  r = await run({ after: "x/context" });
  assert.deepEqual([r.res.why, r.enter], ["keys-typed", false], "the prompt doesn't read it: never Enter (typed, left there)");
  hcFake = async () => ({});
  agentsFake = () => [];
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

// ── The runner (Clawd, or Ember / Prompt): no timer ever steps an image (the cold review's P2) ──────
// A one-shot (the jump of « fini », the companion's done and wave) is companion.js once(): each image in
// two boxes whose opacity transitions show it at i * ms and hide it at (i + 1) * ms, armed by one cue (the
// first layout's on_size_change), then the scene after it; the only timer left is the next draw of a
// variant, while the agent works or waits.
{
  live.checking = false;
  const { draw: runner } = await import("./runner.js");
  const { EPOCH, STEP, CLAWD_POSES } = await import("./runner-plan.js");
  const clawd = { complete: true, poses: Object.fromEntries(CLAWD_POSES.map((p) => [p, { size: [24, 30], anchor: [0, 30] }])) };
  const now = 10 * EPOCH + 1000;
  const at = (memo, o) => { const x = cx(); const nodes = flat(runner({ p: { terminal: "tA", program: "claude", since: 0, ...o }, clawd, memo, now, reduced: false, seed: 42, cx: x })); return { x, nodes }; };
  const byId = (nodes, id) => nodes.find((n) => callsOf(n, "id").some(([v]) => v === id));
  const opacityOf = (n) => callsOf(n, "opacity").at(-1)?.[0];
  const delayOf = (n) => callsOf(n, "transition").find(([k]) => k === "opacity")?.[1].delay;

  // Done, just arrived: the jump, once; no timer; the cue on its first layout.
  const memo = {};
  let r = at(memo, { status: "done", doneAt: now });
  assert.equal(r.x.timers.length, 0, "the jump: no timer");
  const jid = `kc-runner-jump-${now}`;
  const once = byId(r.nodes, `${jid}-once`);
  assert.ok(once && callsOf(once, "on_size_change").length === 1, "the jump waits for its cue (first layout)");
  assert.deepEqual([0, 1, 2, 3].map((i) => [opacityOf(byId(r.nodes, `${jid}-in${i}`)), opacityOf(byId(r.nodes, `${jid}-out${i}`))]),
    [[1, 1], [0, 1], [0, 1], [0, 1]], "before the cue: the first pose only");
  // The cue: one render more, then the targets, each with its delay.
  callsOf(once, "on_size_change")[0][0]({}, r.x);
  assert.equal(r.x.notified, 1, "the cue draws once more");
  r = at(memo, { status: "done", doneAt: now });
  assert.equal(r.x.timers.length, 0, "armed: still no timer");
  assert.deepEqual([0, 1, 2, 3].map((i) => [delayOf(byId(r.nodes, `${jid}-in${i}`)), delayOf(byId(r.nodes, `${jid}-out${i}`))]),
    [[0, STEP], [STEP, 2 * STEP], [2 * STEP, 3 * STEP], [3 * STEP, 4 * STEP]], "each pose shown at i x 85 ms, hidden at (i + 1) x 85 ms");
  const after = byId(r.nodes, `${jid}-after`);
  assert.deepEqual([opacityOf(after), delayOf(after)], [1, 4 * STEP], "then the resting scene, for good");
  assert.equal(callsOf(byId(r.nodes, `${jid}-once`), "on_size_change").length, 0, "armed: no cue any more");

  // The draws: a timer while the agent works or waits, none once done.
  assert.deepEqual(["working", "blocked", "done", "error"].map((status) => at({}, { status, action: { tool: "Edit", at: 1 } }).x.timers.map(([ms]) => ms)),
    [[11 * EPOCH - now], [11 * EPOCH - now], [], []], "the next draw's timer: not once done");

  // The companion (Prompt for Codex): its done celebration once, natively; no timer either.
  const cm = {};
  const done = at(cm, { status: "done", program: "codex", since: now });
  assert.deepEqual(done.x.timers.map(([ms]) => ms), [600000 + 5], "the companion's done: no timer steps it, the one timer is falling asleep 10 min later");
  const cid = `kc-runner-tA-done-${now}`;
  assert.ok(byId(done.nodes, `${cid}-once`), "its done is a once()");
  callsOf(byId(done.nodes, `${cid}-once`), "on_size_change")[0][0]({}, done.x);
  const armed = at(cm, { status: "done", program: "codex", since: now });
  assert.deepEqual([delayOf(byId(armed.nodes, `${cid}-in1`)), delayOf(byId(armed.nodes, `${cid}-after`)), delayOf(byId(armed.nodes, `${cid}-held`))],
    [110, 440, 440], "its frames 110 ms apart, then idle, its sparkles gone with them");
  assert.equal(armed.x.timers.length, 0, "armed: no timer");

  // A click's wave on a blocked companion: once, natively, then blocked again with its bang, both in the
  // box shown after the wave (nothing to draw again: no timer).
  const wm = { waveAt: now };
  const wave = at(wm, { status: "blocked", program: "codex", since: now - 1000 });
  const wid = `kc-runner-tA-wave-${now}`;
  assert.equal(wave.x.timers.length, 0, "the wave: no timer");
  callsOf(byId(wave.nodes, `${wid}-once`), "on_size_change")[0][0]({}, wave.x);
  const waved = at(wm, { status: "blocked", program: "codex", since: now - 1000 });
  const box = byId(waved.nodes, `${wid}-after`);
  const under = (n, out = []) => { out.push(n); for (const q of n.kids) under(q.__node, out); return out; };
  const ids = under(box).flatMap((n) => callsOf(n, "id").map(([v]) => v));
  assert.deepEqual([delayOf(box), ids.includes(`${wid}-after-blocked-a`), ids.includes(`${wid}-after-bang-a`)], [4 * 170, true, true],
    "after the wave (4 x 170 ms): blocked and its bang");
  live.checking = true;
}

console.log("chat-motion.check: ok");
