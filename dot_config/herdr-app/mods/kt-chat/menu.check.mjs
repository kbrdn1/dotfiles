// bun menu.check.mjs: menu.js (#81 L4-L5) with gpui mocked: the popup fades in (enter) and out
// (MS.leave, ease-in), a new opening fades in again, the active row's fill sits on its row and glides
// (ink), the rows say their words (complete.strings.js), a press picks, a short transcript shows fewer
// rows; a picked word (tokenMark, fx3): marked by its category for good (dark: the word in its hue; light:
// in foreground, the hue on its line; a workflow: its 8 beads), and once, fresh, its veil going out, its
// line coming, the beads lit 25 ms apart; still after FRESH; reduced motion: marked, still, at once.
// Not a layout check.
import assert from "node:assert/strict";
import { plugin } from "bun";

const el = (kind = "div", arg) => {
  const node = { kind, arg, kids: [], props: {}, tr: [], trp: {}, on: {} };
  const p = new Proxy(node, {
    get(target, k) {
      if (k in target) return target[k];
      return (...a) => {
        if (k === "child") target.kids.push(a[0]);
        else if (k === "children") target.kids.push(...a[0]);
        else if (k === "when") return a[0] ? a[1](p) : p;
        else if (k === "transition") { target.tr.push(a[0]); target.trp[a[0]] = a[1]; }
        else if (k.startsWith("on_")) target.on[k] = a.at(-1);
        else target.props[k] = a;
        return p;
      };
    },
  });
  return p;
};
plugin({
  setup(build) {
    build.module("gpui-kit", () => ({ loader: "object", exports: { div: () => el("div"), svg: (s) => el("svg", s) } }));
    build.module("gpui-base", () => ({ loader: "object", exports: { h_flex: () => el("h"), v_flex: () => el("v") } }));
    build.module("herdr", () => ({ loader: "object", exports: { shared: () => null, checking: () => true } }));
  },
});
const { menuView, tokenMark, routeWords, ROW, ROWS, FRESH } = await import("./menu.js");
const { motionState, frame, MS } = await import("./motion.js");
const { STEPS } = await import("./workflows.js");

const t = { foreground: "#e0e0e0", muted: "#999999", dim: "#666666", background: "#191919", popover: "#242424", ansi3: "#e6c654", ansi4: "#5aa0e6", accent: "#d4825d", ansi5: "#a87ee0", ansi6: "#6fa39c" };
const find = (node, pred, out = []) => { if (!node || typeof node !== "object") return out; if (pred(node)) out.push(node); for (const k of node.kids ?? []) find(k, pred, out); return out; };
const menu = {
  trigger: "/", start: 0, end: 3, query: "go", active: 1,
  rows: [
    { id: "cmd:commit", type: "command", category: "skill", item: { name: "commit", description: "Commit", hint: null, kind: "command" } },
    { id: "cmd:me:goal", type: "command", category: "workflow", item: { name: "me:goal", description: "Sprint", hint: "[obj]", kind: "command" } },
    { id: "cmd:context", type: "command", category: "builtin", item: { name: "context", description: null, hint: null, kind: "builtin" } },
  ],
};
let picked = null;
const opts = { gen: 1, dark: true, onPick: (i) => { picked = i; }, scroll: {} };
const cx = { notify: () => {} };

// Closed, nothing to fade: nothing. Open: in at 0, then 1 after its first layout (enter, 180 ms).
const M = motionState();
assert.equal(menuView(t, frame(M, false), null, opts), null);
let v = menuView(t, frame(M, false), menu, opts);
assert.deepEqual(v.props.id, ["kc-menu-1"]);
assert.deepEqual(v.props.opacity, [0], "fades in");
assert.equal(v.props.h, undefined, "never on its height");
v.on.on_size_change({ width: 600, height: 140 }, cx);
v = menuView(t, frame(M, false), menu, opts);
assert.deepEqual(v.props.opacity, [1]);
assert.equal(v.trp.opacity.duration, MS.open);
const ink = find(v, (n) => n.props?.id?.[0] === "kc-menu-ink")[0];
assert.deepEqual(find(v, (n) => n !== ink && n.tr?.includes("height")), [], "no height moves in it (the fill's is ink()'s, its height a constant ROW)");
assert.deepEqual(ink.props.top, [ROW], "the fill sits on the active row");
assert.ok(ink.tr.includes("top"), "and glides");
assert.deepEqual(ink.props.bg, [`${t.ansi3}24`], "in the active row's hue");
const list = find(v, (n) => n.props?.id?.[0] === "kc-menu-rows")[0];
assert.deepEqual(list.props.max_h, [ROW * ROWS]);
const rows = find(v, (n) => String(n.props?.id?.[0] ?? "").startsWith("kc-menu-cmd:"));
assert.deepEqual(rows.map((r) => r.props.id[0]), ["kc-menu-cmd:commit", "kc-menu-cmd:me:goal", "kc-menu-cmd:context"]);
const texts = (r) => find(r, () => true).flatMap((n) => n.kids.filter((k) => typeof k === "string"));
assert.deepEqual(texts(rows[1]), ["/me:goal", "[obj]", "Sprint", "workflow"]);
assert.deepEqual(texts(rows[2]), ["/context", "Ce qui occupe le contexte", "Claude Code"], "a built-in's words come from complete.strings.js");
rows[2].on.on_mouse_down({}, { stop_propagation: () => {} });
assert.equal(picked, 2, "a press picks (the field keeps the keyboard)");
// A short transcript: fewer rows at once, the popup stays inside it.
const short = menuView(t, frame(M, false), menu, { ...opts, rows: 3 });
assert.deepEqual(find(short, (n) => n.props?.id?.[0] === "kc-menu-rows")[0].props.max_h, [ROW * 3]);
// Closing: the last menu, same id, fading to 0 in MS.leave ease-in (the caller drops it after).
v = menuView(t, frame(M, false), null, { ...opts, last: menu });
assert.deepEqual([v.props.id, v.props.opacity], [["kc-menu-1"], [0]]);
assert.deepEqual(v.trp.opacity, { duration: MS.leave, easing: "ease-in" });
// Opening again: a new id, it fades in again.
assert.deepEqual(menuView(t, frame(M, false), menu, { ...opts, gen: 2 }).props.opacity, [0]);
// Reduced motion: at once, both ways.
const R = motionState();
assert.deepEqual(menuView(t, frame(R, true), menu, opts).props.opacity, undefined, "no fade");
assert.equal(menuView(t, frame(R, true), null, { ...opts, last: menu }), null, "gone at once");

// A picked word (tokenMark, fx3): the token's own element, in the field's line.
{
  const ctx = { line_height: 20 };
  const byId = (n, id) => find(n, (x) => x.props?.id?.[0] === id)[0];
  const textOf = (n) => find(n, (x) => x.kids?.some((k) => typeof k === "string"))[0];
  // Fresh workflow, before its first layout: the veil up, the beads out; then they move, once.
  const now = 10_000;
  const wf = { kind: "command", category: "workflow", text: "/me:goal", at: now - 10, shown: false };
  let w = tokenMark(t, wf, ctx, { id: "tk1", now });
  assert.deepEqual([w.props.id, w.props.h], [["tk1"], [20]], "its own id, the line's height");
  assert.deepEqual(textOf(w).kids, ["/me:goal"], "the text that goes");
  assert.deepEqual(textOf(w).props.text_color, [t.ansi3], "dark: the word in its category's hue");
  const veil = byId(w, "tk1-v");
  assert.deepEqual([veil.props.opacity, veil.trp.opacity.duration], [[1], 420], "the veil, up, going out in 420 ms");
  const beads = find(w, (x) => /^tk1-b\d$/.test(x.props?.id?.[0] ?? ""));
  assert.equal(beads.length, STEPS.length, "a workflow's line: one bead per step");
  assert.deepEqual(beads.map((b) => b.props.opacity[0]), Array(8).fill(0));
  assert.deepEqual(beads.map((b) => b.trp.opacity.delay), [0, 25, 50, 75, 100, 125, 150, 175], "lit left to right, 25 ms apart");
  let notified = 0;
  w.on.on_size_change({}, { notify: () => notified++ });
  assert.deepEqual([wf.shown, notified], [true, 1], "its first layout is the cue (kept on the piece)");
  w = tokenMark(t, wf, ctx, { id: "tk1", now: now + 100 });
  assert.deepEqual([byId(w, "tk1-v").props.opacity, find(w, (x) => x.props?.id?.[0] === "tk1-b7")[0].props.opacity], [[0], [1]], "then the veil out, the beads lit");
  // After FRESH: still, marked, no transition, no veil.
  w = tokenMark(t, wf, ctx, { id: "tk1", now: now + FRESH + 1 });
  assert.equal(byId(w, "tk1-v"), undefined, "no veil");
  assert.deepEqual(find(w, (x) => x.tr?.length), [], "no transition at all");
  assert.deepEqual(find(w, (x) => /^tk1-b\d$/.test(x.props?.id?.[0] ?? "")).map((b) => b.props.opacity[0]), Array(8).fill(1), "the cycle stays");
  // Light: the word in foreground, the hue on its line only (L6d's rule).
  const sk = { kind: "command", category: "skill", text: "/commit" };
  const l = tokenMark(t, sk, ctx, { id: "tk2", dark: false });
  assert.deepEqual(textOf(l).props.text_color, [t.foreground]);
  assert.deepEqual(byId(l, "tk2-u").props.bg, [`${t.ansi4}b3`], "the line in the skill's hue");
  // A file: a neutral line, the word in foreground; an MCP tool: the accent.
  const f = tokenMark(t, { kind: "file", category: "file", text: "@main.js" }, ctx, { id: "tk3" });
  assert.deepEqual([textOf(f).props.text_color, byId(f, "tk3-u").props.bg], [[t.foreground], [`${t.muted}99`]]);
  assert.deepEqual(textOf(tokenMark(t, { kind: "mcp-tool", category: "mcp", text: "mcp__docs__query" }, ctx, { id: "tk4" })).props.text_color, [t.accent]);
  // Reduced motion, or the motion turned off (CHIP_FX false): marked at once, nothing moves.
  for (const o of [{ reduced: true }, { fx: false }]) {
    const z = tokenMark(t, { ...wf, shown: false, at: now - 10 }, ctx, { id: "tk5", now, ...o });
    assert.deepEqual([byId(z, "tk5-v"), find(z, (x) => x.tr?.length).length, z.on.on_size_change], [undefined, 0, undefined], JSON.stringify(o));
  }
}

// The route's words under the card (complete.js routeOf's shapes).
assert.equal(routeWords({ via: "send" }), null, "a message: nothing");
assert.equal(routeWords({ via: "send", by: "agent" }), "invoquée par l'agent");
assert.equal(routeWords({ via: "keys", keys: ["/"], confirm: false }), "tapée au clavier, invite vide");
assert.equal(routeWords({ via: "keys", keys: ["/"], confirm: true }), "tapée au clavier, invite vide · demande une confirmation");
assert.equal(routeWords({ via: "none", why: "untypable" }), "ne peut pas partir au clavier : ni majuscule, ni accent, ni « : »");
assert.equal(routeWords({ via: "say", confirm: false }), null, "the bridge types it as Claude Code would");
assert.equal(routeWords(null), null);

console.log("kt-chat menu: ok");
