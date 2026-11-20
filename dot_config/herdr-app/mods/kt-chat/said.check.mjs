// bun mods/kt-chat/said.check.mjs: « Compacter » from the Chat (A.9), what compact.check.mjs can't reach: the
// real Chat class on bare instances, gpui-kit / gpui-base / herdr stubbed, shared kept in a Map. kt-confirm's
// yes said in shared (its command reaches shown copies only) is taken by the Chat's next render or tick; the
// Chat's data timer runs while a compaction it asked for is on its way (hidden, it has no render), one only,
// gone with it; Context's own asks keep Context's timer.
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
let overlay = null, shown = {};
const host = {
  View: class {}, ScrollHandle: { new: () => ({ scroll_to_item() {} }) }, VirtualListScrollHandle: { new: () => ({}) },
  TextareaState: { new: () => ({ set_auto_grow() {}, on() {}, value: () => "", set_value() {}, replace() {}, focus() {} }) },
  shared: (k) => store.get(k), setShared: (k, v) => { store.set(k, v); return null; },
  commands: () => [{ name: "tab.close" }], run: () => {}, props: () => shown, openOverlay: (o) => { overlay = o; return "o1"; }, closeOverlay: () => {},
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
const { default: Chat } = await import(`${dir}/main.js`);
const { Compactor } = await import(`${dir}/compact.js`);
const { default: Confirm } = await import(`${dir}/../kt-confirm/main.js`);
const bare = () => Object.create(Chat.prototype);

// kt-confirm's yes while the Chat is hidden: its command reaches no shown copy, shared carries it.
{
  const c = bare();
  c.compactor = new Compactor("kt-chat", host);
  assert.equal(c.compactor.press("t9", "s1"), "asked");
  const name = overlay.props.command.name;
  assert.ok(name.startsWith("kt-chat.compact-ok:"), name);
  shown = overlay.props;
  const k = Object.create(Confirm.prototype);
  Object.assign(k, { extra: {}, done: null, typed: "" });
  k.dismiss = () => {};
  k.yes({});
  c.saidYes();
  assert.equal(c.compactor.by.get("t9").phase, "later", "the Chat's next render takes the yes");
}

// The Chat's data timer: none with nothing on its way, one 1 s timer while its own ask goes, gone with it.
{
  store.delete("kt.compact");
  const c = bare();
  c.compactor = new Compactor("kt-chat", host);
  const timers = [];
  const cx = { notify() {}, timer: { every: (ms, fn) => { const k = { ms, fn, cancelled: false, cancel() { this.cancelled = true; } }; timers.push(k); return k; } } };
  c.compactTimer(cx);
  assert.equal(timers.length, 0, "nothing on its way: no timer");
  c.compactor.press("t9", "s1");
  c.compactTimer(cx);
  c.compactTimer(cx);
  assert.deepEqual([timers.length, timers[0].ms], [1, 1000], "asked here: one 1 s timer, however many renders");
  c.compactor.by.set("t9", { ...c.compactor.by.get("t9"), phase: "done" });
  c.compactTimer(cx);
  assert.equal(timers[0].cancelled, true, "done: the timer goes");
  store.delete("kt.compact");
  new Compactor("kt-context", host).press("t9", "s1");
  c.compactTimer(cx);
  assert.equal(timers.length, 1, "Context asked: the Chat starts none (Context sends it)");
}
console.log("said.check: ok");
