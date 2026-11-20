// bun mods/kt-chat/lang.check.mjs: words retained by Chat in its first language (A.6).
// The real Chat class on a bare instance, gpui-kit / gpui-base / herdr stubbed; the language is
// shared "kt.lang" (i18n.js). TextareaState has no placeholder setter: relang() recreates it in the
// language shown while preserving its content, tokens, selection, events and focus. A blocked
// agent's request is read again after a language change so decide.js can word it again.
import assert from "node:assert/strict";
import { plugin } from "bun";
import { readFileSync, readdirSync } from "node:fs";

const dir = import.meta.dir;
const names = { "gpui-kit": new Set(), "gpui-base": new Set(), herdr: new Set() };
const files = (d) => readdirSync(d).filter((f) => f.endsWith(".js")).map((f) => `${d}/${f}`);
for (const f of files(dir)) {
  for (const m of readFileSync(f, "utf8").matchAll(/import\s*\{([^}]*)\}\s*from\s*"(gpui-kit|gpui-base|herdr)"/g)) {
    for (const n of m[1].split(",")) if (n.trim()) names[m[2]].add(n.trim().split(/\s+as\s+/)[0]);
  }
}
const chain = new Proxy(function () {}, { get: (_t, p) => (p === "then" ? undefined : chain), apply: () => chain });
const store = new Map();
const Field = {
  new: (o = {}) => ({
    placeholder: o.placeholder, events: [], val: { text: "", tokens: [] }, sel: { start: 0, end: 0 }, focused: false, released: false,
    set_auto_grow() {}, on(ev, fn) { this.events.push([ev, fn]); return true; }, value() { return this.val.text; }, content() { return this.val; },
    set_value(v) { this.val = typeof v === "string" ? { text: v, tokens: [] } : v; }, selected_range() { return this.sel; },
    set_selected_range(r) { this.sel = r; }, focus() { this.focused = true; }, release() { this.released = true; return true; }, replace() {},
  }),
};
const host = {
  View: class {}, TextareaState: Field, ScrollHandle: { new: () => ({ scroll_to_item() {} }) }, VirtualListScrollHandle: { new: () => ({}) },
  shared: (k) => store.get(k), setShared: (k, v) => { store.set(k, v); return null; },
  commands: () => [{ name: "tab.close" }], run: () => {}, props: () => ({}), openOverlay: () => "o1", closeOverlay: () => {},
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
const { lang } = await import(`${dir}/i18n.js`);
const bare = () => Object.create(Chat.prototype);

// The field's placeholder follows the language without dropping its retained state.
{
  store.set("kt.lang", "fr");
  const c = bare();
  c.composer = Field.new({ placeholder: "Écrire à l'agent…" });
  c.fieldLang = lang();
  const change = () => {}, submit = () => {};
  c.onField = [["change", change], ["submit", submit]];
  const chip = { range: { start: 6, end: 9 }, token: { id: "p1", text: "[x]" } };
  c.composer.set_value({ text: "salut [x]", tokens: [chip] });
  c.composer.set_selected_range({ start: 2, end: 4 });
  c.typing = true;
  store.set("kt.lang", "en");
  assert.notEqual(c.fieldLang, lang(), "the language changed: composerView recreates the field");
  const was = c.composer;
  c.relang();
  const f = c.composer;
  assert.notEqual(f, was);
  assert.equal(f.placeholder, "Write to the agent…", "its placeholder is now English");
  assert.deepEqual(f.content(), { text: "salut [x]", tokens: [chip] }, "its text and token are retained");
  assert.deepEqual(f.selected_range(), { start: 2, end: 4 }, "its selection is retained");
  assert.deepEqual(f.events, [["change", change], ["submit", submit]], "its handlers are rebound");
  assert.equal(f.focused, true, "it keeps the keyboard when it had it");
  assert.equal(was.released, true, "the old field is released");
  assert.equal(c.fieldLang, "en");
  store.set("kt.lang", "fr");
  c.typing = false;
  c.relang();
  assert.equal(c.composer.placeholder, "Écrire à l'agent…");
  assert.equal(c.composer.focused, false, "an unfocused field stays unfocused");
}

// The blocked request is stale in another language and is read again.
{
  store.set("kt.lang", "fr");
  const c = bare();
  Object.assign(c, { lastStatus: "blocked", decisionFor: "t1", decisionLang: "fr" });
  assert.equal(c.decisionStale("t1"), false, "same blocking, agent and language: read once");
  store.set("kt.lang", "en");
  assert.equal(c.decisionStale("t1"), true, "another language: read again");
  store.set("kt.lang", "fr");
  assert.equal(c.decisionStale("t2"), true, "another agent: read again");
  c.lastStatus = "working";
  assert.equal(c.decisionStale("t1"), true, "a new blocking: read again");
}

console.log("lang.check: ok");
