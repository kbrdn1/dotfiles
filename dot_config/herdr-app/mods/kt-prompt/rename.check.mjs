// bun ~/.config/herdr-app/mods/kt-prompt/rename.check.mjs: no path of ours sends tab.rename or space.rename
// without its `name`, so Herdr never opens its own prompt (English, base look) in kbrdn Threads:
//   - keys.json: in both kbrdn-threads layout sections, no key runs a bare tab.rename / space.rename, and every
//     global key that does (f2, shift-f2) is bound again there, so it never reaches the global one;
//   - the kt-* mods: every run("tab.rename" | "space.rename", …) carries `name`, and none opens Herdr's
//     `prompt`; kt-menu's rename items and kt-head's `rename:` route open kt-prompt;
//   - kt-prompt's own askOf fills tab.rename / space.rename with the id, and save() adds the name (gpui mocked).
// Not loaded by Herdr.
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { plugin } from "bun";

const HOME = join(import.meta.dir, "..", "..");
const MODS = join(HOME, "mods");
const RENAMES = ["tab.rename", "space.rename"];

// keys.json: the action as one word (shortcuts.js' actionKey, inline: a string, or an object's command).
const keys = JSON.parse(readFileSync(join(HOME, "keys.json"), "utf8"));
const bare = (a) => {
  if (typeof a === "string") return RENAMES.includes(a) ? a : null; // "tab.rename:x" sets the id, still no name
  return a && RENAMES.includes(a.command) && !(a.args && "name" in a.args) ? a.command : null;
};
for (const section of ["layout:kbrdn-threads", "layout:kbrdn-threads-glass"]) {
  const own = keys[section] ?? {};
  for (const [k, a] of Object.entries(own)) assert.equal(bare(a), null, `${section}: ${k} runs a bare ${bare(a)}`);
  for (const [k, a] of Object.entries(keys.global ?? {})) {
    if (bare(a)) assert.ok(k in own, `global ${k} (${a}) reaches kbrdn-threads: bind it in ${section}`);
  }
  for (const k of ["ctrl-b shift-t", "f2"]) assert.equal(own[k], "kt-head.rename:tab", `${section}: ${k}`);
  for (const k of ["ctrl-b shift-w", "shift-f2"]) assert.equal(own[k], "kt-head.rename:space", `${section}: ${k}`);
}

// The kt-* mods' code: every run of a rename carries a name; Herdr's prompt is never opened.
const files = readdirSync(MODS).filter((m) => m.startsWith("kt-")).flatMap((m) =>
  readdirSync(join(MODS, m)).filter((f) => f.endsWith(".js") && !f.endsWith(".d.ts")).map((f) => join(MODS, m, f)))
  .filter((f) => statSync(f).isFile());
let runs = 0;
for (const f of files) {
  const src = readFileSync(f, "utf8");
  for (const m of src.matchAll(/run\(\s*"(tab|space)\.rename"\s*(?:,\s*(\{[^}]*\}))?\s*\)/g)) {
    runs++;
    assert.ok(m[2] && /\bname\b/.test(m[2]), `${f}: ${m[0]} without a name`);
  }
  assert.ok(!/mod:\s*"prompt"/.test(src), `${f} opens Herdr's prompt`);
}
assert.ok(runs >= 1, "the scan finds kt-projects' rename (with its name)");
const menu = readFileSync(join(MODS, "kt-menu", "main.js"), "utf8");
assert.ok(/it\[1\] === "tab\.rename"\) openOverlay\(\{ mod: "kt-prompt"/.test(menu), "kt-menu: Renommer (thread) opens kt-prompt");
assert.ok(/it\[1\] === "space\.rename"\) openOverlay\(\{ mod: "kt-prompt"/.test(menu), "kt-menu: Renommer (project) opens kt-prompt");
const head = readFileSync(join(MODS, "kt-head", "main.js"), "utf8");
assert.ok(/name === "rename"[\s\S]{0,400}mod: "kt-prompt"/.test(head), "kt-head: rename: opens kt-prompt");

// kt-prompt itself: askOf and save, with herdr and gpui mocked.
const ran = [];
const chain = () => new Proxy(function () {}, { get: (_t, k) => (k === "then" ? undefined : () => chain()), apply: () => chain() });
let p = {};
const world = [{ id: "s1", name: "proj", named: true, tabs: [{ id: "c1", name: "fix login", named: true }, { id: "c2", name: "2", named: false }] }];
plugin({
  setup(b) {
    b.module("gpui-kit", () => ({ loader: "object", exports: { View: class {}, div: chain, svg: chain, image: chain } }));
    b.module("gpui-base", () => ({ loader: "object", exports: { v_flex: chain, h_flex: chain, Input: { new: chain },
      InputState: { new: ({ value }) => ({ v: value, value() { return this.v; }, set_selected_range() {}, on() {}, focus() {} }) } } }));
    b.module("herdr", () => ({ loader: "object", exports: {
      run: (name, args) => ran.push([name, args]), props: () => p, closeOverlay() {}, theme: () => new Proxy({}, { get: () => "#000000" }),
      settings: () => ({ dark: true }), shared: () => null, spaces: () => world } }));
  },
});
const { askOf, default: Prompt } = await import("./main.js");
assert.deepEqual(askOf({ rename: { tab: "c1" } }, world).command, { name: "tab.rename", args: { id: "c1" } });
assert.equal(askOf({ rename: { tab: "c1" } }, world).value, "fix login", "a named thread: its name to edit");
assert.equal(askOf({ rename: { tab: "c2" } }, world).value, "", "an unnamed one: empty, not its number");
assert.deepEqual(askOf({ rename: { space: "s1" } }, world).command, { name: "space.rename", args: { id: "s1" } });
assert.equal(askOf({ rename: { tab: "gone" } }, world), null, "gone: nothing to run");
const shipped = { title: "Rename tab", hint: "empty: its number", value: "x", command: { name: "tab.rename", args: { id: "c1" } } };
assert.deepEqual(askOf(shipped, world).command, shipped.command, "the shipped contract, as given");
// save(): the command with the typed name, once.
p = { rename: { tab: "c1" }, overlay: "o1" };
const v = new Prompt();
v.init(p, { focus_handle: () => ({}), timer: { after() {} } });
v.input.v = "renamed";
const cx = { notify() {}, timer: { after() {} } };
v.save(cx);
v.save(cx);
assert.deepEqual(ran, [["tab.rename", { id: "c1", name: "renamed" }]], "run once, with the name");

console.log("rename: ok");
