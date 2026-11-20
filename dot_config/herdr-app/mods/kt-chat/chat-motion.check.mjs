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
        if (k === "child") { if (a[0] != null && typeof a[0] === "object" || typeof a[0] === "function") n.kids.push(a[0]); else n.calls.push(["text", a]); }
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
  // image(src) keeps its src (#93: a card's square reads a pre-rendered tile).
  image: (src) => { const p = node("image"); p.__node.calls.push(["src", [src]]); return p; },
};
// hc, agents(), focused() and openOverlay() go through these, which a case may swap (#81's routes).
let hcFake = async () => ({});
let agentsFake = () => [];
// exec and readTextFile too (a sub-agent's read, a session looked up by its id).
let execFake = async () => ({ code: 0, stdout: "" });
let readFake = async () => "";
let focusedFake = () => null;
let openOverlayFake = () => null;
// checking() answers live.checking: true for the Chat (as herdr-app check), false where a timer is the point.
// style: kt-threads' companion_style, "subscription" (the logos, Clawd) here unless a test asks for the cube.
const live = { checking: true, style: "subscription" };
const host = {
  agents: () => agentsFake(), panes: () => [], spaces: () => [], terminals: () => [], theme: () => ({}), settings: () => ({ dark: true, zoom: 1 }),
  props: () => ({}), shared: (k) => (k === "kt.opt.kt-threads.companion_style" ? live.style : undefined), layout: () => null, focused: () => focusedFake(), keys: () => ({}), openOverlay: (o) => openOverlayFake(o),
  home: () => "/h", appHome: () => "/h/.config/herdr-app", checking: () => live.checking, nextCommand: () => new Promise(() => {}),
  exec: (...a) => execFake(...a), hc: (a) => hcFake(a), readTextFile: (p) => readFake(p), writeTextFile: async () => {},
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
const { Compactor } = await import("./compact.js");

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
    fresh: new Set(), liveItems: null, foldAt: null, going: new Set(), lastLedge: {}, subsKnown: new Map(), subRuns: new Map(), drafts: [],
    motion: motionState(), bgMenu: false, bgNote: null, bgBusy: new Set(), line: null, state: ingest(null, read),
    compactor: new Compactor("kt-chat", host),
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
  // Cold review, point 3: clipped below, not on the sides. The box keeps room left and right, more than
  // a row's own left offset (a sub-agent's head, ml(-6); a copy button, ml(-4)).
  const [room] = callsOf(box, "mx").at(-1) ?? [0];
  assert.ok(room <= -6 && callsOf(box, "px").at(-1)?.[0] === -room, "its box has room on its sides: a row drawn out to the left keeps its edge");
  const holder = nodes.find((n) => n.kids.some((kid) => kid.__node === box));
  assert.equal(holder?.kind, "v_flex", "held by a column flex, which stretches it: its margins widen it (a block would only shift it)");
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
  // More than one image alone: cards (#93), a file on this computer draggable onto a terminal, no motion
  // of their own (they come with their turn: no enter() id, no transition).
  t.assets = [{ id: "c:0", key: "/w/proj/doc.md", kind: "markdown", name: "doc.md", abs: "/w/proj/doc.md" },
    { id: "t:x:0", key: "s:1:x:0", kind: "image", drawn: true, name: "cap.png", ref: { o: 1, tool: "x", n: 0 } }];
  const nodes = draw(c, k);
  const row = flat({ __node: nodes.find((n) => callsOf(n, "id").some(([v]) => v === `kc-as-${t.id}`)) });
  assert.deepEqual(row.flatMap((n) => callsOf(n, "id").map(([v]) => v)).filter((v) => String(v).startsWith("kc-")), [`kc-as-${t.id}`, `kc-pc-${t.id}-as-0`, `kc-pc-${t.id}-as-1`], "two cards, no photo");
  assert.deepEqual(row.flatMap((n) => callsOf(n, "drag_paths")), [[["/w/proj/doc.md"]]], "the file on the disk drags; the embedded image has none");
  assert.deepEqual(transitions(row), [], "no motion of their own");
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
  // × shows on the hovered card only (in its corner, inside the box its rise clips in).
  assert.ok(!nodes.some((n) => callsOf(n, "id").some(([v]) => String(v).startsWith("kc-dx-"))), "no × while no card is hovered");
  c.pieceHover = `kc-pc-${c.drafts[1].id}`;
  const hovered = flat(c.draftView(T, cx()));
  assert.deepEqual(hovered.filter((n) => callsOf(n, "id").some(([v]) => String(v).startsWith("kc-dx-"))).map((n) => callsOf(n, "id")[0][0]), [`kc-dx-${c.drafts[1].id}`], "the hovered card's ×, and only it");
  // × : it fades out where it stands (its place kept: the height doesn't move), then ONE timer drops it.
  const x = cx();
  x.stop_propagation = () => {};
  press(hovered, `kc-dx-${c.drafts[1].id}`, x);
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
  c.pieceHover = `kc-pc-${c.drafts[0].id}`;
  const nodes = flat(c.draftView(T, cx()));
  assert.deepEqual(transitions(nodes), [], "the pieces: no transition");
  const x = cx();
  x.stop_propagation = () => {};
  press(nodes, `kc-dx-${c.drafts[0].id}`, x);
  assert.deepEqual([c.drafts.map((p) => p.label), x.timers.length], [["devis.pdf"], 0], "gone at once, no timer");
}
// « +N »: 10 pieces (DRAFT_MAX) in the field at the column's width hold 4 columns, two rows: 7 cards and
// « +3 ». A click shows all 10 in the same next render: the height changes once, at once (no timer, no
// height transition anywhere, the grid never given a height).
const idsOf = (nodes, prefix) => nodes.flatMap((n) => callsOf(n, "id").map(([v]) => String(v))).filter((v) => v.startsWith(prefix));
const ten = ["/d/logo.png", "/d/capture.png", "/d/photo.jpg", "/d/Compte rendu reunion juin.docx", "/d/notes-de-reunion-2026-08-21.txt",
  "/d/Rapport annuel V2.pdf", "/d/export-4f1c2a9e-77b0.zip", "/d/Devis client.pdf", "/d/PLAN.md", "/d/contacts.csv"];
{
  const c = chat();
  c.width = 900;
  c.drafts = add([], ten, "drop").list;
  const folded = flat(c.draftView(T, cx()));
  assert.equal(idsOf(folded, "kc-pc-").length, 7, "7 cards");
  assert.deepEqual(idsOf(folded, "kc-more-"), ["kc-more-p:drafts"], "then « +3 » in the 8th place");
  const x = cx();
  x.stop_propagation = () => {};
  press(folded, "kc-more-p:drafts", x);
  assert.equal(x.timers.length, 0, "no timer: it opens in one go");
  const opened = flat(c.draftView(T, cx()));
  assert.deepEqual([idsOf(opened, "kc-pc-").length, idsOf(opened, "kc-more-").length], [10, 0], "the next render: all 10, no « +N »");
  assert.ok(!transitions(opened).includes("height") && !opened.some((n) => callsOf(n, "id").some(([v]) => v === "kc-drafts") && callsOf(n, "h").length), "no height moves: one change, at once");
  // Sent, the field's next pieces start on two rows again.
  c.open.delete("p:drafts");
  c.drafts = add([], ten, "drop").list;
  assert.equal(idsOf(flat(c.draftView(T, cx())), "kc-pc-").length, 7);
}
// Each family's square: its pre-rendered tile (tiles/<family>-dark.svg, on the disk), the extension over
// it; render runs nothing to make one (no exec, no task).
{
  const c = chat();
  const runs = [];
  execFake = async (...a) => { runs.push(a); return { code: 0, stdout: "" }; };
  const want = { "a.docx": "doc", "b.pdf": "doc", "c.xlsx": "sheet", "d.csv": "sheet", "e.txt": "text", "f.md": "text", "g.js": "code", "h.webp": "image", "i.zip": "other" };
  c.drafts = add([], Object.keys(want).map((n) => `/d/${n}`), "drop").list;
  c.open.add("p:drafts");
  const x = cx();
  let spawned = 0;
  x.spawn = () => { spawned++; };
  const nodes = flat(c.draftView(T, x));
  for (const p of c.drafts) {
    const card = flat({ __node: nodes.find((n) => callsOf(n, "id").some(([v]) => v === `kc-pc-${p.id}`)) });
    const srcs = card.flatMap((n) => callsOf(n, "src").map(([s]) => s));
    assert.deepEqual(srcs, [`mods/kt-chat/tiles/${want[p.label]}-dark.svg`], `${p.label}: its family's tile`);
    assert.ok(readdirSync(`${dir}/tiles`).includes(`${want[p.label]}-dark.svg`), `${p.label}: the tile is on the disk`);
  }
  assert.deepEqual([runs.length, spawned], [0, 0], "render made no tile and started nothing");
  execFake = async () => ({ code: 0, stdout: "" });
}
// Files dropped anywhere on the face: they join the message; with the background's panel open, an image
// among them goes to the background, and a drop with no image still joins the message.
{
  const c = chat();
  const did = [];
  c.importBg = (_cx, _pr, p) => did.push(["bg", p]);
  c.attach = (_cx, paths) => did.push(["att", paths]);
  c.composerShown = () => true;
  const pr = { key: "proj" };
  c.dropped(cx(), ["/d/a.png", "/d/b.pdf"], pr);
  c.bgMenu = true;
  c.dropped(cx(), ["/d/b.pdf", "/d/a.png"], pr);
  c.dropped(cx(), ["/d/b.pdf"], pr);
  c.bgMenu = false;
  c.composerShown = () => false;
  c.dropped(cx(), ["/d/b.pdf"], pr);
  assert.deepEqual(did, [["att", ["/d/a.png", "/d/b.pdf"]], ["bg", "/d/a.png"], ["att", ["/d/b.pdf"]]], "panel closed: joined; open: the image to the background; no image: joined; no agent: nothing");
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
  // #93, Cmd+V in the field: the composer's card carries the binding's context and takes its action
  // (pasteKey, ahead of the field's own paste). A Finder copy (its names as text, joined by \r: probed)
  // joins its files and types nothing; a text goes in as typed; no text at all: paste()'s way.
  const c = completing(chat(), "");
  Object.assign(c, { width: 700, handle: { is_focused: () => false }, runner: null, m: frame(c.motion, false) });
  const card = flat(c.composerView(T, { agent: { address: "t9", status: "idle", program: "claude" } }, null, cx())).find((n) => callsOf(n, "id").some(([v]) => v === "kc-card"));
  assert.deepEqual([callsOf(card, "key_context"), callsOf(card, "on_action").map(([a]) => a)], [[["KtComposer"]], ["kt_chat_paste"]], "the card: its context, the action");
  const did = [];
  c.attach = (_cx, paths, source) => did.push(["att", paths, source]);
  c.paste = () => did.push(["paste"]);
  const run = async (text, stdout) => {
    const asked = [];
    execFake = async (cmd, args) => { asked.push(args.at(-1)); return { code: 0, stdout }; };
    let task = null;
    const read = typeof text === "function" ? text : () => text;
    const x = { ...cx(), read_from_clipboard: read, spawn: (fn) => { task = fn(x); } };
    c.pasteKey(x);
    await task;
    return asked;
  };
  live.checking = false;
  // gpui gives a Finder copy as its paths (Kylian's capture): the files are read, joined, nothing typed.
  assert.deepEqual(await run("/p/a b.pdf/p/c.csv", "files\n/p/a b.pdf\n/p/c.csv\n"), ["files"], "the files only are read");
  // A text that can't hold files: in at once, no osascript (the 60 to 120 ms stay out of a plain paste).
  assert.deepEqual(await run("un\r\ndeux", "files\n/p/never.pdf\n"), [], "a plain text: nothing read");
  // A text starting with « / » with no file behind it (a path typed somewhere): read, then typed.
  assert.deepEqual(await run("/tmp/build.log", "none\n"), ["files"]);
  assert.deepEqual(await run(undefined, ""), [], "no text: nothing read here");
  // The host refusing the read: the files are still asked for; none, it says so and types nothing.
  assert.deepEqual(await run(() => { throw new Error("not granted"); }, "none\n"), ["files"]);
  live.checking = true;
  execFake = async () => ({ code: 0, stdout: "" });
  assert.deepEqual([...did, ...c.composer.wrote], [["att", ["/p/a b.pdf", "/p/c.csv"], "paste"], ["paste"], ["replace", "un\ndeux"], ["replace", "/tmp/build.log"]],
    "files joined (nothing typed), no text: paste(), the texts typed");
  assert.deepEqual(c.sendErr, { why: "paste" }, "an unreadable clipboard says so");
}
// Cmd+C on a card under the pointer (the keyboard on the Chat): the piece copied as a file, its card says
// « Copié » for a moment (ONE one-shot timer). The pointer on no card: the key goes on.
{
  const c = chat();
  c.width = 900;
  c.drafts = add([], ["/d/Devis client.pdf", "/d/b.md"], "drop").list;
  c.press = () => false; // the Chat's own keys: none of them here
  const id = `kc-pc-${c.drafts[0].id}`;
  const nodes = flat(c.draftView(T, cx()));
  const card = nodes.find((n) => callsOf(n, "id").some(([v]) => v === id));
  const hx = cx();
  callsOf(card, "on_hover").at(-1)[0](true, hx);
  assert.deepEqual([c.pieceHover, c.hoverPiece?.name, hx.notified], [id, "Devis client.pdf", 1], "hovered: kept, the field's card drawn again (its ×)");
  const asked = [];
  execFake = async (cmd, args) => { asked.push([cmd, args.slice(-1)]); return { code: 0, stdout: "ok\n" }; };
  let task = null;
  const kx = { ...cx(), stop_propagation() { kx.stopped = true; }, spawn: (fn) => { task = fn(kx); } };
  live.checking = false;
  c.key({ keystroke: "cmd-c", key: "c", modifiers: { platform: true } }, kx);
  await task;
  live.checking = true;
  execFake = async () => ({ code: 0, stdout: "" });
  assert.deepEqual(asked, [["/usr/bin/osascript", ["/d/Devis client.pdf"]]], "the file itself, by argv");
  assert.equal(kx.stopped, true, "the key stops there");
  assert.equal(c.copied, id);
  const copied = flat({ __node: flat(c.draftView(T, cx())).find((n) => callsOf(n, "id").some(([v]) => v === id)) });
  assert.ok(copied.some((n) => callsOf(n, "text").some(([s]) => s === "Fichier copié")), "its card says so");
  assert.equal(kx.timers.length, 1, "ONE one-shot timer");
  kx.timers[0][1](cx());
  assert.equal(c.copied, null, "then it goes");
  // Leaving the card: Cmd+C no longer copies, the key goes on to press() (not the Chat's: it goes on).
  callsOf(card, "on_hover").at(-1)[0](false, cx());
  const k2 = { ...cx(), stop_propagation() { k2.stopped = true; } };
  c.press = () => { k2.pressed = true; return false; };
  c.key({ keystroke: "cmd-c", key: "c", modifiers: { platform: true } }, k2);
  assert.deepEqual([c.hoverPiece, k2.pressed, k2.stopped], [null, true, undefined], "no card: not ours");
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
  // fail: "before" | "after", the screen read that throws (a timeout) at that step.
  const run = async ({ status = "idle", before = "", after = "/context", fail = null } = {}) => {
    const calls = [];
    let typed = false;
    agentsFake = () => [{ address: "t9", status }];
    hcFake = async (a) => {
      calls.push(a.join(" "));
      if (a[0] === "read" && fail === (typed ? "after" : "before")) throw new Error("hc read: timed out");
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
  // #81 review, P1: a screen that can't be read stops the route; before typing, nothing is typed (the
  // prompt may hold « foo »: Enter would send « foo/compact »), after typing, no Enter.
  r = await run({ before: "foo", fail: "before" });
  assert.deepEqual([r.res.why, r.calls.some((x) => x.startsWith("keys"))], ["keys-read", false], "the first read fails: nothing typed");
  r = await run({ fail: "after" });
  assert.deepEqual([r.res.why, r.enter], ["keys-read", false], "the reads after typing fail: never Enter");
  hcFake = async (a) => (a[0] === "read" ? { code: 1, stdout: "", stderr: "no such terminal" } : { code: 0, stdout: "" });
  agentsFake = () => [{ address: "t9", status: "idle" }];
  assert.equal((await chat().keysSend(cx(), "t9", { via: "keys", keys: ["/"] }, "/")).why, "keys-read", "a read that exits non-zero: unread too");
  hcFake = async () => ({});
  agentsFake = () => [];
}

// ── #81 review, P1: kt-confirm's « yes » runs only the ask it answers, in the copy that asked it ──
{
  const overlays = [];
  openOverlayFake = (o) => { overlays.push(o); return null; };
  const sent = [];
  hcFake = async (a) => { sent.push(a.join(" ")); return { code: 0, stdout: "" }; };
  agentsFake = () => [{ address: "t9", status: "idle", tab: "tab-1", program: { key: "claude" } }];
  focusedFake = () => ({ tab: "tab-1" });
  // Two Chats on the same agent: A asks /clear (then Kylian cancels: no callback), B asks /exit and gets a yes.
  const A = chat();
  const B = chat();
  const route = (keys) => ({ via: "keys", keys: [...keys], confirm: true });
  A.askRoute({ address: "t9" }, route("/clear"), "/clear");
  B.askRoute({ address: "t9" }, route("/exit"), "/exit");
  const ids = overlays.map((o) => o.props.command.name.replace(/^kt-chat\.confirmed:/, ""));
  assert.ok(ids.every((s) => s && !s.startsWith("kt-chat.")) && ids[0] !== ids[1], "each ask carries its own id");
  const x = cx();
  const ran = [];
  x.spawn = (fn) => ran.push(fn);
  A.confirmed(x, ids[1]);
  B.confirmed(x, ids[1]);
  assert.equal(ran.length, 1, "B's yes: B sends; A's cancelled /clear doesn't");
  assert.ok(A.pendingRoute, "A's ask stays its own (cancelled, it never gets a callback)");
  B.confirmed(x, ids[1]);
  assert.equal(ran.length, 1, "a second yes for the same ask: nothing more");
  A.pendingRoute.at -= 10 * 60 * 1000;
  A.confirmed(x, ids[0]);
  assert.equal(ran.length, 1, "an old ask: nothing goes");
  A.confirmed(x, "");
  assert.equal(ran.length, 1);
  openOverlayFake = () => null;
  hcFake = async () => ({});
  agentsFake = () => [];
  focusedFake = () => null;
}

// ── Cold review, point 4: sub-agents launched together, one branch each ─────
{
  const c = chat();
  const run = (k) => ({ role: "tool", id: `tu-${k}`, name: "Agent", kind: "agent", state: "ok", input: { description: `agent ${k}` }, result: { agent: { id: `a${k}`, name: `agent ${k}` } } });
  // A fold made of one group of three runs (chat-model.js items() groups consecutive ones), then the answer.
  const turn = { id: "tg", user: null, blocks: [], live: false, fold: { start: 0, end: 0 },
    items: [{ type: "subagents", id: "sg", runs: [run(1), run(2), run(3)] }, { type: "block", id: "ans", block: { role: "prose", id: "ans", text: "fin" } }] };
  c.turns = [turn];
  c.win = { from: 0, to: 1 };
  // The fold closed (the report's case: only the sub-agents hang under it), then opened.
  for (const opened of [false, true]) {
    if (opened) c.open.add("f:tg");
    const nodes = flat(c.turn(T, cx(), turn, 0, false));
    const bends = nodes.filter((n) => callsOf(n, "rounded_bl").some(([r]) => r === 8));
    assert.equal(bends.length, 3, `three sub-agents, three branches, not one for the group (fold ${opened ? "open" : "closed"})`);
    const below = nodes.filter((n) => callsOf(n, "border_l").length && callsOf(n, "bottom").length && !callsOf(n, "rounded_bl").length && callsOf(n, "top").some(([v]) => v === 10));
    assert.equal(below.length, 2, "the trunk goes on under the first two, ends at the last (the fold's last item)");
  }
}

// ── #58: a sub-agent's line unfolded shows its own transcript once read, its report until then ──
{
  const { build } = await import("./chat-model.js");
  const c = chat();
  c.state = { ...c.state, path: "/p/s.jsonl" };
  const sc = (o) => JSON.stringify({ isSidechain: true, agentId: "a1", sessionId: "s-sc", timestamp: "2026-01-03T10:00:00.000Z", ...o });
  const side = new TextEncoder().encode([
    sc({ type: "user", uuid: "sc-u1", parentUuid: null, message: { role: "user", content: "Lis le module." } }),
    sc({ type: "assistant", uuid: "sc-m1", parentUuid: "sc-u1", message: { id: "m-sc1", role: "assistant", model: "model-x", content: [{ type: "tool_use", id: "sc-t1", name: "Read", input: { file_path: "/w/a.js" } }] } }),
    sc({ type: "user", uuid: "sc-r1", parentUuid: "sc-m1", message: { role: "user", content: [{ type: "tool_result", tool_use_id: "sc-t1", content: "export const a = 1" }] } }),
    sc({ type: "assistant", uuid: "sc-m2", parentUuid: "sc-r1", message: { id: "m-sc2", role: "assistant", model: "model-x", content: [{ type: "text", text: "Il exporte a." }] } }),
  ].join("\n") + "\n");
  const own = build(index(side, { from: 0, size: side.length, side: true, exists: () => false }).entries);
  const b = { role: "tool", id: "tu-9", name: "Agent", kind: "agent", state: "ok", input: { description: "lecteur" }, result: { agent: { id: "a1", name: "lecteur" }, text: "RAPPORT" } };
  const turn = { id: "ts", user: null, blocks: [], live: false, fold: { start: 0, end: 0 },
    items: [{ type: "subagents", id: "ss", runs: [b] }, { type: "block", id: "ans2", block: { role: "prose", id: "ans2", text: "fin" } }] };
  c.turns = [turn];
  c.win = { from: 0, to: 1 };
  c.open.add("f:ts");
  c.open.add("r:tu-9");
  const drawn = () => { const x = cx(); x.spawned = 0; x.spawn = () => { x.spawned++; }; return { x, nodes: flat(c.turn(T, x, turn, 0, false)) }; };
  const ids = (nodes) => nodes.flatMap((n) => callsOf(n, "id").map(([v]) => v));
  // Unfolded, not read yet: its report, and one read of its transcript asked.
  let r = drawn();
  assert.equal(r.x.spawned, 1, "unfolded: its transcript read once (readSub)");
  assert.ok(c.subRuns.get("a1")?.busy, "and marked busy: no second read meanwhile");
  assert.ok(!ids(r.nodes).includes("kc-st-sc-t1"), "until it is read: the report, as before");
  assert.equal(c.itemCost(turn.items[0]), 2, "its cost: its row and its report's one line");
  // Read: its own last items under the rail (its Read step), no new read.
  c.subRuns.set("a1", { turns: own, done: true });
  r = drawn();
  assert.equal(r.x.spawned, 0, "read: nothing asked again");
  assert.ok(ids(r.nodes).includes("kc-st-sc-t1"), "its own work drawn, step by step");
  assert.ok(c.ownOf(b).items.every((it) => it.id.startsWith("sub:a1:")), "its items' ids are its own: none can be one of the session's");
  assert.equal(c.subRuns.get("a1").shown, true, "open: followed while it runs (watchBridge)");
  assert.equal(c.itemCost(turn.items[0]), 1 + 3 + 5, "its cost: its row, then what it shows (a phase of one step, a prose block): the budget sees it");
  // Read without arrivals (drawn before): as it is, no motion.
  const landOf = (nodes, it) => nodes.find((n) => callsOf(n, "id").some(([v]) => v === `kc-in-${it.id}`));
  let items = c.ownOf(b).items;
  assert.deepEqual(items.map((it) => [callsOf(landOf(r.nodes, it), "top").at(-1), callsOf(landOf(r.nodes, it), "opacity").at(-1)]), items.map(() => [[0], [1]]), "nothing arrived: in place, at once");
  // What its read brought (subArrivals): each comes in once, fading and rising 6 px inside a box that
  // clips, as a live turn's items do; no height moves.
  const { subArrivals } = await import("./chat-model.js");
  c.subRuns.set("a1", { turns: own, done: false, fresh: subArrivals(null, own, "a1") });
  c.motion = motionState(); // never drawn yet, as a read's new items are
  c.m = frame(c.motion, false);
  r = drawn();
  items = c.ownOf(b).items;
  for (const it of items) {
    const land = landOf(r.nodes, it);
    assert.deepEqual([callsOf(land, "top").at(-1), callsOf(land, "opacity").at(-1)], [[6], [0]], `${it.type}: in from 6 px low, faded`);
    const box = r.nodes.find((n) => n.kids.some((kid) => kid.__node === land));
    assert.ok(callsOf(box, "overflow_hidden").length, "inside a box that clips");
  }
  assert.ok(!transitions(r.nodes).includes("height"), "no height moves");
  // Its first layout (the cue), then drawn again: in place, and no longer waiting.
  for (const it of items) c.m.shown.add(`kc-in-${it.id}`);
  r = drawn();
  assert.deepEqual(items.map((it) => callsOf(landOf(r.nodes, it), "opacity").at(-1)), items.map(() => [1]), "then at its place");
  assert.equal(c.subRuns.get("a1").fresh.size, 0, "once: folded and unfolded later, it lands as it is");
  // Reduced motion: no transition.
  c.subRuns.set("a1", { turns: own, done: false, fresh: subArrivals(null, own, "a1") });
  c.m = frame(c.motion, true);
  assert.deepEqual(transitions(drawn().nodes), [], "reduced motion: none");
  c.m = frame(c.motion, false);
  // Folded again: not followed any more.
  c.open.delete("r:tu-9");
  drawn();
  assert.equal(c.subRuns.get("a1").shown, false);
}

// ── Cold review 2, point 9: a sub-agent whose transcript can't be read isn't read on forever ──
{
  const c = chat();
  c.state = { ...c.state, path: "/p/s.jsonl" };
  const b = { role: "tool", id: "tu-8", name: "Agent", kind: "agent", state: "running", input: { description: "absent" }, result: { agent: { id: "a8", name: "absent" } } };
  const turn = { id: "tm", user: null, blocks: [], live: false, fold: { start: 0, end: 0 },
    items: [{ type: "subagents", id: "sm", runs: [b] }, { type: "block", id: "ans3", block: { role: "prose", id: "ans3", text: "fin" } }] };
  c.turns = [turn];
  c.win = { from: 0, to: 1 };
  c.open.add("f:tm");
  c.open.add("r:tu-8");
  let reads = 0;
  execFake = async () => { reads++; return { code: 1, stdout: "" }; }; // its file isn't there
  readFake = async () => { throw new Error("missing"); };
  // A cx whose spawned tasks run, awaited.
  const run = async (f) => { const x = cx(); const tasks = []; x.spawn = (g) => tasks.push(g(x)); f(x); await Promise.all(tasks); };
  // A render as body() makes it: the open lines drawn noted, the others not followed after it.
  const render = (drawIt = true) => run((x) => { c.subsNow = new Set(); if (drawIt) flat(c.turn(T, x, turn, 0, false)); c.subsDrawn(); });
  const tick = async (n) => { for (let k = 0; k < n; k++) await run((x) => c.followSubs(x)); };
  await render();
  assert.deepEqual([reads, c.subRuns.get("a8").fails], [1, 1], "unfolded: one read, it fails");
  await tick(6);
  assert.equal(reads, 3, "the timer tries again, 3 failed reads in a row in all (SUB_TRIES), then stops");
  // Folded, unfolded: it tries again, as many times.
  c.open.delete("r:tu-8");
  await render();
  c.open.add("r:tu-8");
  await render();
  assert.deepEqual([reads, c.subRuns.get("a8").fails], [4, 1], "unfolded again: read again");
  await tick(6);
  assert.equal(reads, 6, "and again bounded");
  // Open but not drawn (its turn out of the window): not followed.
  c.subRuns.get("a8").fails = 0;
  await render(false);
  assert.equal(c.subRuns.get("a8").shown, false, "not drawn: shown no more");
  await tick(3);
  assert.equal(reads, 6, "not drawn: never read");
  execFake = async () => ({ code: 0, stdout: "" });
  readFake = async () => "";
}

// ── Cold review 2, point 12: a session looked up by its id only when the id is a plain name ──
{
  const c = chat();
  const asked = [];
  execFake = async (_cmd, args) => { asked.push(args.at(-1)); return { code: 0, stdout: "/h/.claude/projects/-w/s.jsonl\n" }; };
  for (const id of ["../../x", "a*b", "a/b", "a b", "", "x".repeat(200)]) {
    readFake = async () => JSON.stringify({ session_id: id });
    assert.equal(await c.locate("tA"), null, `not a plain name, never put in the glob: ${JSON.stringify(id)}`);
  }
  assert.deepEqual(asked, [], "nothing looked up");
  const uuid = "00000000-0000-4000-8000-000000000001";
  readFake = async () => JSON.stringify({ session_id: uuid });
  assert.equal(await c.locate("tA"), "/h/.claude/projects/-w/s.jsonl", "a uuid: its session found");
  assert.deepEqual(asked, [uuid], "passed as the glob's $1");
  execFake = async () => ({ code: 0, stdout: "" });
  readFake = async () => "";
}

// ── Cold review, point 5: back on an agent, no ledge of its own fades from before its data is read ──
{
  const c = completing(chat(), "");
  Object.assign(c, { width: 700, handle: { is_focused: () => false }, runner: null, bridge: null, plan: null, tasksOpen: new Set(), agentsOpen: new Set() });
  const on = (address) => ({ agent: { address, status: "idle", program: "claude" } });
  const todos = { done: 1, total: 2, current: "B", items: [{ content: "A", status: "completed" }, { content: "B", status: "pending" }] };
  const ledgeOf = (nodes, address) => nodes.find((n) => callsOf(n, "id").some(([v]) => v === `kc-tasks-${address}-ledge`));
  // What readBridge() sets: the data read, and whose it is.
  const read = (address, data) => Object.assign(c, { bridgeFor: address, bridge: data });
  const show = (address) => flat(c.composerView(T, on(address), null, cx()));
  read("tA", { todos });
  assert.ok(ledgeOf(show("tA"), "tA"), "tA's tasks on their ledge");
  // Over to tB (no tasks): its first render still has tA's data (not shown: bridgeOf()), then its own.
  show("tB");
  read("tB", {});
  show("tB");
  // Back on tA: its first render has tB's data, tA's own isn't read yet.
  assert.equal(ledgeOf(show("tA"), "tA"), undefined, "back on tA, its old ledge isn't drawn (it would hold its height, unseen)");
  assert.equal(c.going.size, 0, "and nothing goes out");
  // Its own read, its tasks done meanwhile: still nothing comes, nothing fades from before tB.
  read("tA", {});
  assert.equal(ledgeOf(show("tA"), "tA"), undefined, "tA read, no tasks: no ledge from before tB fades out");
  assert.equal(c.going.size, 0);
  // Witness, the same agent all along (lot B): its tasks come, then go, and the ledge fades out where it stood.
  read("tA", { todos });
  assert.ok(ledgeOf(show("tA"), "tA"));
  read("tA", {});
  assert.ok(ledgeOf(show("tA"), "tA"), "on the same agent, the ledge whose tasks went fades out where it stood");
  assert.ok(c.going.has("kc-tasks-led-tA"));
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
  // the cube style (the app's default): the agent's LED cube stands in the strip, Clawd or not
  live.style = "cube";
  const cubed = at({}, { status: "working", since: now - 1000 });
  assert.ok(byId(cubed.nodes, "companion-kc-runner-tA"), "cube: the agent's cube in the strip");
  assert.ok(!cubed.nodes.some((n) => callsOf(n, "id").some(([v]) => String(v).startsWith("kc-runner-") && v !== "kc-runner" && !String(v).startsWith("kc-runner-tA"))), "cube: no Clawd layer");
  live.style = "subscription";
  live.checking = true;
}

console.log("chat-motion.check: ok");
