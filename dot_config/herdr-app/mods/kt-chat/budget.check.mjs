// bun ~/.config/herdr-app/mods/kt-chat/budget.check.mjs: A16's row budget, as the cold review's P1 asked
// (2026-11-19): what the reader looks at is never starved. The real Chat class, its host modules recorded
// as chat-motion.check.mjs does (every element and its calls), turn() drawn on made-up turns with the
// budget a render starts with (body(): ROW_BUDGET, the reader's turn first), and counted:
// - a live turn of 16 phases, the bottom followed, « … a travaillé » opened: the phase at work under the
//   fold has all its steps, the one running among them, and the fold all of its own;
// - three Bash outputs of 60 lines and more, opened: each has its 60 lines, the third too;
// - two diffs of 120 lines and more, opened: each has its 120 rows;
// - « N étapes de plus » with nothing left in the budget: the steps asked for are drawn;
// - another turn's fold: drawn whole while it fits, else held closed whole (never cut).
import assert from "node:assert/strict";
import { plugin } from "bun";
import { readdirSync, readFileSync } from "node:fs";

// ── The host, recorded (chat-motion.check.mjs' recorder) ────────────────────
const dir = import.meta.dir;
const names = { "gpui-kit": new Set(), "gpui-base": new Set(), herdr: new Set() };
for (const f of readdirSync(dir).filter((f) => f.endsWith(".js"))) {
  for (const m of readFileSync(`${dir}/${f}`, "utf8").matchAll(/import\s*\{([^}]*)\}\s*from\s*"(gpui-kit|gpui-base|herdr)"/g)) {
    for (const n of m[1].split(",")) if (n.trim()) names[m[2]].add(n.trim().split(/\s+as\s+/)[0]);
  }
}
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
const { motionState, frame } = await import("./motion.js");
const { mdState } = await import("./markdown.js");

const flat = (p, out = []) => { const n = p?.__node; if (!n) return out; out.push(n); for (const k of n.kids) flat(k, out); return out; };
const callsOf = (n, name) => n.calls.filter(([k]) => k === name).map(([, a]) => a);
const withId = (nodes, id) => nodes.find((n) => callsOf(n, "id").some(([v]) => v === id));
// A detail's mono blocks (its command, its output, a diff): how many lines each draws.
const monoLines = (nodes) => nodes.filter((n) => callsOf(n, "font_family").length && callsOf(n, "line_height").some(([v]) => v === "20px")).map((n) => n.kids.length);

// ── A bare Chat on made-up turns, drawn as body() starts a render ───────────
const u = (id, o) => ({ k: "user", o, uuid: id, at: o, turn: true, text: `message ${id}` });
const call = (tid, o, extra = {}) => ({ k: "assistant", o, uuid: `a-${tid}`, mid: `m-${tid}`, at: o, model: "m", blocks: [{ t: "tool", id: tid, name: "Bash", kind: "execute", title: `ls ${tid}`, input: { command: `ls ${tid}` }, ...extra }] });
const res = (o, tid, extra = {}) => ({ k: "result", o, tool: tid, at: o, ok: true, text: "ok", ...extra });
const said = (id, o, text = "voilà") => ({ k: "assistant", o, uuid: id, mid: `m-${id}`, at: o, model: "m", blocks: [{ t: "text", text }] });
const many = (n, f) => Array.from({ length: n }, (_, i) => f(i));
function chat(entries, { live = false } = {}) {
  const c = Object.create(Chat.prototype);
  Object.assign(c, {
    turns: [], win: { from: 0, to: 0 }, hts: new Map(), marks: [], builtLive: false, follow: false, cur: -1, queued: [],
    open: new Set(), shownSteps: new Map(), hover: null, copied: null, md: mdState(), att: new Map(), attQ: [],
    fresh: new Set(), liveItems: null, foldAt: null, going: new Set(), lastLedge: {}, subsKnown: new Map(), subRuns: new Map(), drafts: [], assetsOf: new Map(),
    motion: motionState(), bgMenu: false, bgNote: null, bgBusy: new Set(), line: null,
    state: ingest(null, { path: "/f", session: "s", start: 0, end: 1e6, size: 1e6, more: false, entries, meta: {} }),
  });
  c.rebuild(live);
  c.win = { from: 0, to: c.turns.length };
  c.m = frame(c.motion, false); // as on screen: an opened detail drawn under its id (collapse(), kc-sd-<step>)
  return c;
}
const cx = () => ({ notified: 0, notify() {}, spawn() {}, timer: { after() {} } });
// The turns of the window as body() describes them: ROW_BUDGET (190), the reader's turn first.
function render(c, order = null) {
  c.budget = { spans: 600, rows: 240, steps: 190, fresh: true };
  const out = [];
  for (const i of order ?? c.turns.map((_, i) => c.turns.length - 1 - i)) out[i] = flat(c.turn({}, cx(), c.turns[i], i, false));
  c.budget = null;
  return out;
}
// Each scenario on its own: all of them run, the failures listed together.
const fails = [];
const scenario = (name, f) => {
  try {
    f();
  } catch (e) {
    fails.push(`${name}: ${e.message}`);
  }
};

// ── A live turn of 16 phases, the bottom followed, « … a travaillé » opened ──
scenario("live turn, fold opened", () => {
  const e = [u("L", 0)];
  let o = 1;
  for (let p = 0; p < 16; p++) {
    for (let k = 0; k < 6; k++) { e.push(call(`p${p}c${k}`, o++)); e.push(res(o++, `p${p}c${k}`)); }
    e.push(said(`n${p}`, o++, `phase ${p} faite`));
  }
  e.push(call("w0", o++), res(o++, "w0"), call("w1", o++), res(o++, "w1"), call("w2", o++)); // w2: running
  const c = chat(e, { live: true });
  c.follow = true;
  c.open.add("f:L");
  const [nodes] = render(c);
  for (const id of ["w0", "w1", "w2"]) assert.ok(withId(nodes, `kc-st-${id}`), `the phase at work under the fold has its step ${id}`);
  assert.equal(c.turns[0].blocks.find((b) => b.id === "w2").state, "running");
  for (let k = 0; k < 6; k++) assert.ok(withId(nodes, `kc-st-p15c${k}`), "the fold the reader opened has all of its own");
});

// ── Three Bash outputs of 60 lines and more, opened ─────────────────────────
scenario("three Bash outputs", () => {
  // Three phases of 6 calls first (a turn's usual work), then the three outputs, then the answer.
  const out = many(70, (i) => `ligne ${i}`).join("\n");
  const before = many(3, (p) => [...many(6, (k) => [call(`q${p}${k}`, 10 + 20 * p + 2 * k), res(11 + 20 * p + 2 * k, `q${p}${k}`)]).flat(), said(`qn${p}`, 22 + 20 * p)]).flat();
  const c = chat([u("B", 0), ...before, call("b0", 101), res(102, "b0", { text: out }), call("b1", 103), res(104, "b1", { text: out }), call("b2", 105), res(106, "b2", { text: out }), said("bn", 107, "les trois sorties"), said("bz", 108)]);
  c.open.add("f:B");
  for (const id of ["b0", "b1", "b2"]) c.open.add(`s:${id}`);
  const [nodes] = render(c);
  for (const id of ["b0", "b1", "b2"]) {
    const d = withId(nodes, `kc-sd-${id}`);
    assert.ok(d, `the detail of ${id} is drawn`);
    assert.deepEqual(monoLines(flat({ __node: d })), [1, 60], `${id}: its command, and its output's last 60 lines`);
  }
});

// ── Two diffs of 120 lines and more, opened ─────────────────────────────────
scenario("two diffs", () => {
  const diff = [{ lines: many(130, (i) => `+ligne ${i}`) }];
  const edit = (tid, o) => ({ k: "assistant", o, uuid: `a-${tid}`, mid: `m-${tid}`, at: o, model: "m", blocks: [{ t: "tool", id: tid, name: "Edit", kind: "edit", title: "f.js", input: { path: "/w/f.js" } }] });
  const c = chat([u("D", 0), edit("d0", 1), res(2, "d0", { diff }), edit("d1", 3), res(4, "d1", { diff }), said("dz", 5)]);
  c.open.add("f:D");
  c.open.add("s:d0");
  c.open.add("s:d1");
  const [nodes] = render(c);
  for (const id of ["d0", "d1"]) assert.deepEqual(monoLines(flat({ __node: withId(nodes, `kc-sd-${id}`) })), [120], `${id}: its 120 rows`);
});

// ── « N étapes de plus » with nothing left in the budget ────────────────────
scenario("« N étapes de plus »", () => {
  const c = chat([u("M", 0), ...many(40, (k) => [call(`m${k}`, 1 + 2 * k), res(2 + 2 * k, `m${k}`)]).flat(), said("mz", 100)]);
  c.open.add("f:M");
  const act = c.turns[0].items[0];
  assert.equal(act.type, "activity");
  c.shownSteps.set(act.id, 36);
  c.budget = { spans: 600, rows: 240, steps: 0, fresh: true };
  const nodes = flat(c.turn({}, cx(), c.turns[0], 0, false));
  c.budget = null;
  assert.equal(nodes.filter((n) => callsOf(n, "id").some(([v]) => String(v).startsWith("kc-st-m"))).length, 36, "the 36 steps asked for, the budget spent or not");
});

// ── Another turn's fold: whole while it fits, else held closed whole ───────
scenario("another turn's fold", () => {
  const turnOf = (id, o) => [u(id, o), ...many(6, (k) => [call(`${id}${k}`, o + 1 + 2 * k), res(o + 2 + 2 * k, `${id}${k}`)]).flat(), said(`${id}z`, o + 20)];
  const steps = (nodes, id) => nodes.filter((n) => callsOf(n, "id").some(([v]) => String(v).startsWith(`kc-st-${id}`))).length;
  {
    const c = chat([...turnOf("X", 0), ...turnOf("Y", 100)]);
    c.open.add("f:X");
    c.open.add("f:Y");
    const [x, y] = render(c); // Y (the last) first: the reader's
    assert.equal(steps(y, "Y"), 6);
    assert.equal(steps(x, "X"), 6, "another turn's fold that fits: drawn whole");
  }
  {
    const c = chat([...turnOf("X", 0), ...turnOf("Y", 100)]);
    c.open.add("f:X");
    c.open.add("f:Y");
    c.budget = { spans: 600, rows: 240, steps: 5, fresh: true };
    const y = flat(c.turn({}, cx(), c.turns[1], 1, false));
    const x = flat(c.turn({}, cx(), c.turns[0], 0, false));
    c.budget = null;
    assert.equal(steps(y, "Y"), 6, "the reader's turn: whole, whatever the budget");
    assert.equal(steps(x, "X"), 0, "another turn's fold past the budget: held closed, none of its steps");
    assert.ok(withId(x, "kc-fold-X"), "its « … a travaillé » drawn, closed");
  }
});

if (fails.length) {
  console.error(`budget.check: ${fails.length} failed\n${fails.join("\n")}`);
  process.exit(1);
}
console.log("budget.check: ok");
