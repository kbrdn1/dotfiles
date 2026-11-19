// bun menu.check.mjs: menu.js (#81 L4-L5) with gpui mocked: the popup fades in (enter) and out
// (MS.leave, ease-in), a new opening fades in again, the active row's fill sits on its row and glides
// (ink), the rows say their words (complete.strings.js), a press picks, a short transcript shows fewer
// rows; the wave's three layers (from, to, cascade, hue) and the rail (one bead per step, 25 ms apart,
// the rail fading at 300 ms: 480 ms); reduced motion draws neither and the popup comes and goes at once.
// motion.js' sweep() has its own check (kt-keys). Not a layout check.
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
const { menuView, wave, rail, routeWords, ROW, ROWS, CREST } = await import("./menu.js");
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

// The wave: three layers from left of the field to its width, 40 ms apart, fainter behind, under the text.
const layers = wave(t, frame(motionState(), false), "kc-wave-1", "workflow", 500);
assert.equal(layers.length, 3);
assert.deepEqual(layers.map((l) => l.props.left[0]), [-24, -32, -40]);
assert.deepEqual(layers.map((l) => l.trp.left.delay), [0, 40, 80]);
assert.deepEqual(layers.map((l) => l.props.text_color[0]), [`${t.ansi3}6b`, `${t.ansi3}48`, `${t.ansi3}24`], "the category's hue, as the bands, fainter behind");
assert.equal(layers[0].arg, CREST);
assert.equal(CREST, "mods/kt-chat/dither-crest.svg", "the crest ships with kt-chat");
assert.deepEqual(wave(t, frame(motionState(), true), "kc-wave-1", "workflow", 500), [], "reduced: no wave");
assert.deepEqual(wave(t, frame(motionState(), false), "w", "mcp", 100, { dark: false })[0].props.text_color, [`${t.accent}4d`]);

// The rail: one bead per step, lit 25 ms apart (120 ms each), the rail fading at 300 ms for 180: 480 ms.
const r = rail(t, frame(motionState(), false), "kc-rail-1", STEPS.length);
assert.equal(r.kids.length, 8);
assert.deepEqual(r.kids.map((b) => b.trp.opacity.delay), [0, 25, 50, 75, 100, 125, 150, 175]);
assert.equal(r.kids[7].trp.opacity.delay + r.kids[7].trp.opacity.duration, 295, "the last bead lit before the rail fades");
assert.equal(r.trp.opacity.delay + r.trp.opacity.duration, 480);
assert.equal(rail(t, frame(motionState(), true), "kc-rail-1", 8), null, "reduced: no rail");

// The route's words under the card (complete.js routeOf's shapes).
assert.equal(routeWords({ via: "send" }), null, "a message: nothing");
assert.equal(routeWords({ via: "send", by: "agent" }), "invoquée par l'agent");
assert.equal(routeWords({ via: "keys", keys: ["/"], confirm: false }), "tapée au clavier, invite vide");
assert.equal(routeWords({ via: "keys", keys: ["/"], confirm: true }), "tapée au clavier, invite vide · demande une confirmation");
assert.equal(routeWords({ via: "none", why: "untypable" }), "ne peut pas partir au clavier : ni majuscule, ni accent, ni « : »");
assert.equal(routeWords({ via: "say", confirm: false }), null, "the bridge types it as Claude Code would");
assert.equal(routeWords(null), null);

console.log("kt-chat menu: ok");
