// bun mods/kt-context/said.check.mjs: « Compacter » said yes to while Context is hidden (A.9). Context asks
// (compact.js, kt-confirm opened), kt-confirm's yes runs `kt-context.compact-ok:<id>`, a command that reaches
// shown copies only: it is said in shared too (kt.confirm.said), and Context's timer takes it from there.
// The real kt-confirm and kt-context classes, gpui-kit / gpui-base / herdr stubbed, the run() dropped (hidden).
import assert from "node:assert/strict";
import { plugin } from "bun";
import { readFileSync, readdirSync } from "node:fs";

const dir = import.meta.dir;
const names = { "gpui-kit": new Set(), "gpui-base": new Set(), herdr: new Set() };
const files = (d) => readdirSync(d).filter((f) => f.endsWith(".js")).map((f) => `${d}/${f}`);
for (const f of [...files(dir), ...files(`${dir}/../kt-confirm`)]) {
  for (const m of readFileSync(f, "utf8").matchAll(/import\s*\{([^}]*)\}\s*from\s*"(gpui-kit|gpui-base|herdr)"/g)) {
    for (const n of m[1].split(",")) if (n.trim()) names[m[2]].add(n.trim().split(/\s+as\s+/)[0]);
  }
}
const chain = new Proxy(function () {}, { get: (_t, p) => (p === "then" ? undefined : chain), apply: () => chain });
const store = new Map();
const ran = [];
let overlay = null, shown = {};
const host = {
  View: class {}, PathBuilder: { fill: () => chain, stroke: () => chain }, Background: { linear_gradient: () => ({}) },
  shared: (k) => store.get(k), setShared: (k, v) => { store.set(k, v); return null; },
  commands: () => [{ name: "space.close" }, { name: "tab.close" }, { name: "tab.new" }],
  run: (name) => ran.push(name), // a command to a hidden copy: it goes nowhere
  props: () => shown, openOverlay: (o) => { overlay = o; return "o1"; }, closeOverlay: () => {},
  agents: () => [{ address: "t9", status: "idle" }], checking: () => true, nextCommand: () => new Promise(() => {}),
  theme: () => ({}), settings: () => ({}), home: () => "/h", appHome: () => "/h/.config/herdr-app", spaces: () => [], panes: () => [], terminals: () => [],
  focused: () => ({}), layout: () => ({}), readTextFile: async () => null, writeTextFile: async () => null, exec: async () => ({ code: 0, stdout: "" }), hc: async () => ({}),
};
const stub = (set) => Object.fromEntries([...set].map((n) => [n, n in host ? host[n] : chain]));
plugin({
  setup(b) {
    b.module("gpui-kit", () => ({ loader: "object", exports: stub(names["gpui-kit"]) }));
    b.module("gpui-base", () => ({ loader: "object", exports: stub(names["gpui-base"]) }));
    b.module("herdr", () => ({ loader: "object", exports: stub(names.herdr) }));
  },
});
const { default: Context } = await import(`${dir}/main.js`);
const { Compactor } = await import(`${dir}/compact.js`);
const { default: Confirm, SAID } = await import(`${dir}/../kt-confirm/main.js`);

const confirm = (props) => {
  shown = props;
  const c = Object.create(Confirm.prototype);
  Object.assign(c, { extra: {}, done: null, typed: "" });
  c.dismiss = () => {};
  c.yes({});
};

// Context asks, then is hidden: kt-confirm's yes runs a command nobody receives.
const ctx = Object.create(Context.prototype);
ctx.compactor = new Compactor("kt-context", host);
assert.equal(ctx.compactor.press("t9", "s1"), "asked");
const name = overlay.props.command.name;
assert.ok(name.startsWith("kt-context.compact-ok:"), name);
ctx.saidYes();
assert.equal(ctx.compactor.by.get("t9").phase, "asking", "nothing said yet");
confirm(overlay.props);
assert.deepEqual(ran, [name], "the command still runs (a shown copy takes it at once)");
assert.ok(store.get(SAID)?.[name] > 0, "and it is said in shared");
ctx.saidYes();
assert.equal(ctx.compactor.by.get("t9").phase, "later", "Context's timer takes the yes: /compact goes at rest");
ctx.saidYes();
assert.equal(ctx.compactor.by.get("t9").phase, "later", "said again at the next tick: taken once");

// An app command runs anywhere: nothing said for it.
confirm({ title: "x", detail: "y", command: { name: "tab.close", args: {} } });
assert.equal(store.get(SAID)?.["tab.close"], undefined, "an app command isn't said");

// Kept 10 minutes: an old yes goes when the next is said.
store.set(SAID, { "kt-context.compact-ok:old": Date.now() - 700000 });
confirm({ title: "x", detail: "y", command: { name: "kt-kanban.confirmed", args: {} } });
assert.deepEqual(Object.keys(store.get(SAID)), ["kt-kanban.confirmed"], "the yes said 11 minutes ago is let go");
console.log("said.check: ok");
