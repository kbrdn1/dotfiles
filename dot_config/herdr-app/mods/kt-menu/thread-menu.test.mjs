// kt-menu's thread menu (issue #69), which `herdr-app check` doesn't reach (it renders the global menu):
// the copies, their order, the session id read after opening, a copy's clipboard and toast.
// herdr, gpui and motion.js are mocked; the fixtures are made up.
// Run with `bun test` (not plain `bun`, which doesn't know bun:test's mocks): bun test mods/kt-menu/thread-menu.test.mjs
import { test, expect, mock } from "bun:test";

const MOD = import.meta.dir;
const chain = () => new Proxy(function () {}, { get: (_t, k) => (k === "then" ? undefined : () => chain()), apply: () => chain() });
mock.module("gpui-kit", () => ({ View: class {}, div: chain, svg: chain }));
mock.module("gpui-base", () => ({ v_flex: chain, h_flex: chain }));

let props = {};
const toasts = [];
const files = {};
const ran = [];
const opened = [];
const world = {
  spaces: [{ id: "s1", folder: "/fake/proj", machine: null, tabs: [{ id: "c1", name: "1", named: false }, { id: "c2", name: "fix", named: true }] }],
  panes: [
    { pane: "p1", tab: "c1", terminal: "t9", cwd: "/fake/proj/wt", branch: "feat/x", title: "Tidy the menu", focused: true, app: "claude-code", program: { key: "claude", name: "Claude Code", agent: true } },
    { pane: "p2", tab: "c2", terminal: "t8", cwd: null, branch: null, title: "zsh", focused: true, app: null, program: { key: "shell", name: "zsh", agent: false } },
  ],
};
mock.module("herdr", () => ({
  run: (name, args) => ran.push([name, args]), props: () => props, closeOverlay() {}, openOverlay: (o) => opened.push(o), theme: () => new Proxy({}, { get: () => "#000000" }),
  keys: () => [], terminals: () => [], spaces: () => world.spaces, panes: () => world.panes, exec: async () => ({ code: 1 }),
  shared: () => null, notify: (n) => toasts.push(n), home: () => "/fake/home",
  readTextFile: async (p) => files[p] ?? null,
}));
// rows() hands over the items as rendered: [label, command, copied text, rows() key]; it builds each row.
let seen = [];
mock.module(`${MOD}/motion.js`, () => ({
  motionState: () => ({}), frame: () => ({}), sheet: () => ({ card: (x) => x, veil: (x) => x }),
  leave: (_m, _cx, _id, done) => done(), leaving: () => false,
  rows: (_m, _cx, _id, items, keyOf, row) => { seen = items.map((it) => [it[0], it[1], it[2]?.text, keyOf(it)]); return items.map(row); },
}));
// The actions each row asks shortcuts.js for (its choice of key is shortcuts.check.mjs').
let asked = [];
mock.module(`${MOD}/shortcuts.js`, () => ({ shortcut: (_binds, _layout, actions) => (asked.push(actions), ""), kbd: chain }));

const { default: Menu } = await import(`${MOD}/main.js`);
const open = async (target) => {
  props = { tab: "tab", target, overlay: "o1" };
  const m = new Menu();
  const tasks = [];
  m.init(props, { focus_handle: () => ({ focus() {} }), spawn: (f) => tasks.push(f({ notify() {} })) });
  await Promise.all(tasks);
  m.render({});
  return m;
};

test("a Claude thread: name, session, folder, branch, address, between New thread and Close", async () => {
  files["/fake/home/.claude/cache/statusline/herdr-t9.json"] = JSON.stringify({ session_id: "sess-fake" });
  const m = await open({ id: "c1", space: "s1" });
  expect(seen.map((s) => s[1])).toEqual(["tab.rename", "tab.new", "copy", "copy", "copy", "copy", "copy", "tab.close"]);
  expect(seen.filter((s) => s[1] === "copy").map((s) => s[2])).toEqual(["Tidy the menu", "sess-fake", "/fake/proj/wt", "feat/x", "t9"]);
  expect(new Set(seen.map((s) => s[3])).size).toBe(seen.length); // rows() keys unique
  let clip = null;
  m.choose(3, { write_to_clipboard: (s) => (clip = s), notify() {} });
  expect(clip).toBe("sess-fake");
  expect(toasts.at(-1).body).toBe("sess-fake");
});

test("a shell thread: no session, no branch; the space's folder when the pane has none", async () => {
  await open({ id: "c2", space: "s1" });
  expect(seen.filter((s) => s[1] === "copy").map((s) => s[2])).toEqual(["fix", "/fake/proj", "t8"]);
});

test("a Claude thread whose statusline is missing: no session copy", async () => {
  delete files["/fake/home/.claude/cache/statusline/herdr-t9.json"];
  await open({ id: "c1", space: "s1" });
  expect(seen.filter((s) => s[1] === "copy").length).toBe(4);
});

test("each row's key: the layout's command for the same thing first (Close is kt-head's), then the command", async () => {
  asked = [];
  await open({ id: "c1", space: "s1" });
  expect(asked[0]).toEqual(["kt-head.rename:tab", "tab.rename:c1", "tab.rename"]);
  expect(asked[1]).toEqual(["tab.new:s1", "tab.new"]);
  expect(asked.at(-1)).toEqual(["kt-head.close-tab", "tab.close:c1", "tab.close"]);
  expect(asked.length).toBe(seen.length);
});

test("Renommer asks the name in kt-prompt: tab.rename never goes out bare (Herdr's own prompt)", async () => {
  ran.length = 0;
  opened.length = 0;
  const m = await open({ id: "c1", space: "s1" });
  m.choose(0, { write_to_clipboard() {}, notify() {} });
  expect(opened.map((o) => [o.mod, o.props])).toEqual([["kt-prompt", { rename: { tab: "c1" } }]]);
  expect(ran.filter(([name]) => name === "tab.rename")).toEqual([]);
});

test("Touches opens the layout's help (kt-keys), never Herdr's app.help; its key is the one of ctrl-b ?", async () => {
  ran.length = 0;
  asked = [];
  props = { overlay: "o1" }; // the global menu: no thread, no space
  const m = new Menu();
  m.init(props, { focus_handle: () => ({ focus() {} }), spawn() {} });
  m.render({});
  const i = seen.findIndex((s) => s[1] === "mod.open");
  expect(i).toBeGreaterThan(-1);
  expect(seen.some((s) => s[1] === "app.help")).toBe(false);
  expect(asked[i]).toEqual(["mod.open:kt-keys", "mod.open"]);
  m.choose(i, { write_to_clipboard() {}, notify() {} });
  expect(ran).toEqual([["mod.open", { name: "kt-keys" }]]);
});
