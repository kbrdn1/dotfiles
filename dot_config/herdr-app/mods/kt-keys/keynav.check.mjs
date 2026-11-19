// bun ~/.config/herdr-app/mods/kt-keys/keynav.check.mjs: j / k really move the lists (#78), through the
// real path: a mod's own main.js, rendered once, then a KeyEvent shaped as GPUI sends it, handed to the
// on_key_down of the element that holds track_focus. The `<mod>.key:` probes call focusIn() first (the
// keyboard taken, NORMAL forced): they could never show a page arriving in INSERT, k climbing into a
// filter, nor a panel opened without the keyboard.
//
// ponytail: `herdr`, `gpui-kit` and `gpui-base` are stand-ins (a Bun plugin): elements are a Proxy that
// takes any builder call and keeps only track_focus / on_key_down / on_click / on_item_click, no layout.
// Each mod gets the facts its render reads (a space, a layout, its list), set on the instance after init.
import { plugin } from "bun";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

const MODS = join(dirname(fileURLToPath(import.meta.url)), "..");
const SPECS = ["herdr", "gpui-kit", "gpui-base"];

// ---------- the stand-ins ----------

// What a test controls and reads: the app's facts, the commands run, the keyboard's holder.
// `live`: checking() false and cx.spawn runs (a command loop under test), `commands` what nextCommand() gives.
const env = { spaces: [], panes: [], layout: null, shared: {}, ran: [], focus: null, inputFocus: 0, live: false, commands: [], props: {}, files: {} };

// An element: any builder call chains; the few listeners a test needs are kept on it.
const SKIP = new Set(["then", "toJSON", "constructor", "prototype"]);
// Not callable (an object target): skeleton.js' swap() tells content from a builder by `typeof`.
function element(kind = "el") {
  const node = { kind, on: {}, focus: null, kids: [] };
  const p = new Proxy({}, {
    get(_t, k) {
      if (k === "__node") return node;
      if (k === Symbol.toPrimitive) return () => "";
      if (typeof k === "symbol" || SKIP.has(k)) return undefined;
      return (...args) => {
        if (k === "when") { if (args[0]) args[1](p); return p; } // .when(c, (el) => el…): the branch is drawn
        if (k === "track_focus") node.focus = args[0];
        else if (k === "id") node.id = args[0];
        else if (["on_key_down", "on_click", "on_item_click", "on_mouse_down"].includes(k)) node.on[k] = args.at(-1);
        else if (k === "focus") env.inputFocus++; // an InputState / EditorState taking the keyboard
        for (const a of args) if (a?.__node) node.kids.push(a.__node);
        if (Array.isArray(args[0])) for (const a of args[0]) if (a?.__node) node.kids.push(a.__node);
        return k === "value" ? "" : k === "is_focused" ? false : p;
      };
    },
  });
  return p;
}
// A builder export: div() h_flex() image() make an element, Scrollbar.vertical() ScrollHandle.new()
// TextView.markdown() too.
const builder = (name) => new Proxy(function () {}, {
  get: (_t, k) => (typeof k === "symbol" || SKIP.has(k) ? undefined : () => element(`${name}.${k}`)),
  apply: () => element(name),
  construct: () => element(name),
});
class View {}
// A mod's own cache (kt-inbox): empty, nothing kept between copies.
globalThis.localStorage ??= { getItem: () => null, setItem() {}, removeItem() {}, key: () => null, length: 0 };
// The runtime's window global (filters.js and viz.js paint paths through it).
globalThis.window ??= element("window");
const color = new Proxy({}, { get: (_t, k) => (typeof k === "symbol" ? undefined : "#888888") });
const host = {
  spaces: () => env.spaces, panes: () => env.panes, layout: () => env.layout, focused: () => null,
  shared: (k) => env.shared[k], setShared: (k, v) => { env.shared[k] = v; },
  settings: () => ({ dark: true, font_family: "mono" }), theme: () => color,
  run: (name, args) => { env.ran.push(args === undefined ? name : [name, args]); },
  nextCommand: () => (env.commands.length ? Promise.resolve(env.commands.shift()) : new Promise(() => {})), checking: () => !env.live,
  exec: async () => ({ code: 1, stdout: "", stderr: "" }), hc: async () => ({ code: 1, stdout: "", stderr: "" }),
  readTextFile: async (path) => { if (path in env.files) return env.files[path]; throw new Error("no file in a check"); }, writeTextFile: async () => {},
  watchFolder: () => Object.assign(new Promise(() => {}), { cancel() {} }),
  notify() {}, openOverlay: () => "ov", closeOverlay() {}, props: () => env.props, keys: () => [],
  home: () => "/home", appHome: () => "/app", agents: () => [], terminals: () => [], machines: () => [],
  window: () => ({ platform: "macos" }), commands: () => [], layouts: () => [], setAgentOrder() {},
};

// Every name a kt-* mod imports from the three modules, so named imports link.
function importedNames() {
  const names = Object.fromEntries(SPECS.map((s) => [s, new Set()]));
  for (const mod of readdirSync(MODS).filter((m) => /^(kt|kbrdn)-/.test(m))) {
    const dir = join(MODS, mod);
    for (const f of readdirSync(dir).filter((n) => n.endsWith(".js"))) {
      const src = readFileSync(join(dir, f), "utf8");
      for (const m of src.matchAll(/import\s*\{([^}]*)\}\s*from\s*"(herdr|gpui-kit|gpui-base)"/g))
        for (const part of m[1].split(",")) { const n = part.trim().split(/\s+as\s+/)[0]; if (n) names[m[2]].add(n); }
      for (const m of src.matchAll(/import\s*\*\s*as\s+(\w+)\s+from\s*"(herdr|gpui-kit|gpui-base)"/g))
        for (const u of src.matchAll(new RegExp(`\\b${m[1]}\\.(\\w+)`, "g"))) names[m[2]].add(u[1]);
    }
  }
  return names;
}
const NAMES = importedNames();
const exportsOf = (spec) => {
  const out = {};
  for (const n of NAMES[spec]) {
    if (spec === "herdr") out[n] = host[n] ?? (() => undefined);
    else out[n] = n === "View" ? View : builder(n);
  }
  return out;
};
plugin({
  name: "keynav-stand-ins",
  setup(b) {
    for (const spec of SPECS) b.module(spec, () => ({ loader: "object", exports: exportsOf(spec) }));
  },
});

// ---------- driving a mod ----------

const timers = [];
function context() {
  return {
    focus_handle: () => { const h = { focus() { env.focus = h; }, is_focused: () => env.focus === h, release: () => true }; return h; },
    notify() {}, spawn(fn) { if (env.live) fn(this); }, stop_propagation() { this.stopped = true; }, write_to_clipboard() {}, prevent_default() {},
    timer: { every() {}, after(ms, fn) { timers.push(fn); } },
  };
}
// A KeyEvent as GPUI sends it ("j", "G", "ctrl-d", "escape", "/", "space").
const NAMED = new Set(["escape", "enter", "tab", "backspace", "up", "down", "left", "right", "space"]);
function keyEvent(name) {
  const modifiers = { shift: false, control: false, alt: false, platform: false, function: false };
  if (name.startsWith("ctrl-")) return { key: name.slice(5), keystroke: name, modifiers: { ...modifiers, control: true } };
  if (NAMED.has(name)) return { key: name, keystroke: name, key_char: name === "space" ? " " : undefined, modifiers };
  const upper = name !== name.toLowerCase();
  return { key: name.toLowerCase(), keystroke: upper ? `shift-${name.toLowerCase()}` : name, key_char: name, modifiers: { ...modifiers, shift: upper } };
}
const walk = (n, f) => { f(n); for (const k of n.kids) walk(k, f); };

// One copy of a mod: init, render; keys go to the focus element's on_key_down, a render after each.
async function load(mod) {
  const { default: Mod } = await import(join(MODS, mod, "main.js"));
  const cx = context();
  const v = new Mod();
  v.init({}, cx);
  const it = {
    v, cx,
    render() { this.root = v.render(cx).__node; return this; },
    // The element holding the view's keyboard handle, with its key handler.
    focusNode() {
      let hit = null;
      walk(this.root, (n) => { if (!hit && n.focus && n.on.on_key_down) hit = n; });
      assert.ok(hit, `${mod}: no element holds track_focus with on_key_down`);
      return hit;
    },
    keys(...names) {
      for (const name of names.flatMap((s) => s.split(" "))) {
        this.render();
        const c = context();
        this.focusNode().on.on_key_down(keyEvent(name), c);
      }
      return this.render();
    },
    // A click on the element whose listener a test finds by `pick(node)`.
    click(pick, event = { modifiers: {} }) {
      this.render();
      let hit = null;
      walk(this.root, (n) => { if (!hit && pick(n)) hit = n; });
      if (!hit) { const ids = []; walk(this.root, (n) => n.id && ids.push(n.id)); assert.fail(`${mod}: nothing to click among ${ids.slice(0, 40).join(" ")}`); }
      (hit.on.on_click ?? hit.on.on_item_click)(event, context());
      return this.render();
    },
  };
  return it;
}
const panelLayout = (child, hidden = false) => ({ id: "root", children: [{ id: "panel", hidden, children: [{ id: "panel-body", active: child, children: [] }] }] });
const space = (folder) => [{ id: "s1", active: true, machine: null, folder, name: "repo", tabs: [{ id: "t1", active: true, name: "1" }] }];
const failures = [];
const check = async (name, fn) => {
  try { await fn(); } catch (e) { failures.push(`${name}: ${e.message.split("\n")[0]}`); }
};

// ---------- kt-files ----------

await check("kt-files", async () => {
  env.spaces = space("/repo");
  env.layout = panelLayout("files");
  const f = await load("kt-files");
  Object.assign(f.v, { paths: ["a.txt", "b.txt", "c.txt"], root: "/repo", readFor: JSON.stringify([null, "/repo"]) });
  f.render();
  const rows = () => f.v.flat.filter((x) => !x.field).map((x) => x.id);
  assert.deepEqual(rows(), ["f:a.txt", "f:b.txt", "f:c.txt"], "the rows listed");
  f.v.focusIn(); // the "focus" command (pane.go, ctrl-b d, a click on the tab)
  assert.equal(f.v.cur, "f:a.txt", "the keyboard lands on the first row");
  f.keys("j");
  assert.equal(f.v.cur, "f:b.txt", "j moves down");
  f.keys("k");
  assert.equal(f.v.cur, "f:a.txt", "k moves up");
  f.keys("k", "j");
  assert.equal(f.v.query, "", "k on the first row then j: j typed into Search files");
  assert.equal(f.v.cur, "f:b.txt", "k on the first row then j: j came back down");
  f.keys("G");
  assert.equal(f.v.cur, "f:c.txt", "G");
  f.keys("g g");
  assert.equal(f.v.cur, "f:a.txt", "gg");
  // A click on a row from Search files (INSERT): the cursor, the keyboard and NORMAL follow it.
  f.keys("/");
  assert.ok(f.v.vim.insert, "/ types in Search files");
  env.focus = null; // the click came from the terminal
  f.click((n) => n.id === "tf-b.txt" && n.on.on_click);
  assert.equal(f.v.cur, "f:b.txt", "a click takes the cursor");
  assert.ok(f.v.handle.is_focused(), "a click takes the keyboard");
  f.keys("j");
  assert.equal(f.v.cur, "f:c.txt", "j after a click moves from the clicked row");
});

// ---------- the panel's surfaces take the keyboard (kt-head's ctrl-b f/d/y/e/r, kt-panel-head's segments) ----------

const settle = () => new Promise((r) => setTimeout(r, 0));
const runTimers = () => { for (const fn of timers.splice(0)) fn(context()); };
const SURFACE_FOCUS = { files: "kt-files.focus", diff: "kt-diff.focus", history: "kt-history.focus", flow: "kt-flow.focus", crosstalk: "kt-crosstalk.focus", "gwm-panel": "kt-gwm.panel-focus" };
await check("kt-head", async () => {
  env.spaces = space("/repo");
  env.layout = panelLayout("files", true);
  env.props = { part: "crumbs" };
  env.live = true;
  try {
    for (const [child, command] of Object.entries(SURFACE_FOCUS)) {
      env.ran = [];
      timers.length = 0;
      env.commands = [`panel:${child}`];
      await load("kt-head"); // its command loop takes `panel:<child>`, as ctrl-b d sends it
      await settle();
      runTimers();
      assert.ok(env.ran.includes(command), `ctrl-b ${child}: the surface didn't get the keyboard (${command})`);
    }
    // #86 (A1): ctrl-b v / s / z from a page over the Chat face: the thread and its terminals first, then
    // the pane command, never a split nobody sees.
    env.layout = { id: "root", children: [{ id: "view", type: "stack", active: "inbox", children: [
      { id: "thread", children: [{ id: "thread-body", type: "stack", active: "chat", children: [{ id: "main" }, { id: "chat" }] }] }, { id: "inbox" }] }] };
    const shown = [["layout.select", { stack: "view", child: "thread" }], ["layout.select", { stack: "thread-body", child: "main" }]];
    for (const [command, then] of [["split:right", ["pane.split", { direction: "right" }]], ["split:down", ["pane.split", { direction: "down" }]], ["zoom", "pane.zoom"]]) {
      env.ran = [];
      env.commands = [command];
      await load("kt-head");
      await settle();
      assert.deepEqual(env.ran, [...shown, then], `kt-head.${command}: the thread's terminals not on screen before it`);
    }
  } finally {
    env.live = false;
    env.props = {};
  }
});
await check("kt-panel-head", async () => {
  env.layout = panelLayout("files");
  const ph = await load("kt-panel-head");
  for (const [child, command] of Object.entries(SURFACE_FOCUS)) {
    env.ran = [];
    timers.length = 0;
    ph.click((n) => n.id === `ph-${child}` && n.on.on_click);
    runTimers();
    assert.ok(env.ran.includes(command), `a click on ${child}: the surface didn't get the keyboard (${command})`);
    assert.ok(!env.ran.includes("kt-gwm.focus"), "kt-gwm's page copy would take the keyboard");
  }
});

// ---------- kt-diff (Changes) ----------

const file = (path) => ({ path, letter: "M", status: "M", add: 1, del: 0, hunks: [] });
await check("kt-diff", async () => {
  env.spaces = space("/repo");
  env.layout = panelLayout("diff");
  const d = await load("kt-diff");
  Object.assign(d.v, { root: "/repo", branch: "main", staged: [], changes: [file("a.js"), file("b.js")], readFor: JSON.stringify({ cwd: "/repo", on: null }) });
  d.render();
  d.v.focusIn();
  assert.equal(d.v.cur, "changes:a.js", "the keyboard lands on the first file");
  d.keys("j");
  assert.equal(d.v.cur, "changes:b.js", "j moves down");
  const focusedBefore = env.inputFocus;
  d.keys("k k k");
  assert.equal(env.inputFocus, focusedBefore, "k on the first row: the commit message took the keyboard");
  assert.equal(d.v.cur, "h:changes", "k stops on the first row (the section's header)");
  d.keys("j");
  assert.equal(d.v.cur, "changes:a.js", "j comes back down");
  d.keys("/");
  assert.equal(env.inputFocus, focusedBefore + 1, "/ goes to the commit message");
  env.focus = null;
  d.click((n) => n.id === "cg:changes:b.js:row");
  assert.equal(d.v.cur, "changes:b.js", "a click takes the cursor");
  assert.ok(d.v.handle.is_focused(), "a click takes the keyboard");
});

// ---------- kt-history ----------

await check("kt-history", async () => {
  env.spaces = space("/repo");
  env.layout = panelLayout("history");
  const h = await load("kt-history");
  const commit = (hash) => ({ hash, subject: hash, author: "a", at: 0, parents: [] });
  Object.assign(h.v, { root: "/repo", branch: "main", commits: ["c1", "c2", "c3"].map(commit), rows: [], readFor: JSON.stringify({ cwd: "/repo", on: null }) });
  h.render();
  h.v.focusIn();
  h.keys("j");
  assert.equal(h.v.cur, "c2", "j moves down the commits");
  env.focus = null;
  let list = null;
  walk(h.render().root, (n) => { if (n.on.on_item_click) list = n; });
  list.on.on_item_click("c3", context());
  assert.equal(h.v.cur, "c3", "a click on a commit takes the cursor");
  assert.ok(h.v.handle.is_focused(), "a click on a commit takes the keyboard");
  Object.assign(h.v, { sel: "c3", detail: { hash: "c3", loading: false, files: [file("a.js"), file("b.js"), file("c.js")] } });
  env.focus = null;
  h.click((n) => n.id === "hi:b.js:row");
  assert.equal(h.v.zone, "files", "a click on a file goes to the files");
  assert.equal(h.v.fcur, "b.js", "a click on a file takes the files' cursor");
  assert.ok(h.v.handle.is_focused(), "a click on a file takes the keyboard");
  h.keys("j");
  assert.equal(h.v.fcur, "c.js", "j after a click moves from the clicked file");
});

// ---------- kt-flow ----------

await check("kt-flow", async () => {
  env.spaces = space("/repo");
  env.layout = panelLayout("flow");
  const fl = await load("kt-flow");
  fl.v.follow = () => "t1"; // the followed terminal (its agent's flow)
  Object.assign(fl.v, { readFor: "t1", flow: { steps: [
    { id: "issue", label: "Issue", state: "done" }, { id: "branch", label: "Branch", state: "done" },
    { id: "push", label: "Push", state: "current" }, { id: "pr", label: "PR", state: "pending" },
  ] } });
  fl.render();
  fl.v.focusIn();
  const ids = () => fl.v.flat.map((x) => x.id);
  const from = ids().indexOf(fl.v.cur);
  assert.ok(from >= 0 && ids().length > from + 1, "the keyboard lands on a row with one under it");
  fl.keys("j");
  assert.equal(fl.v.cur, ids()[from + 1], "j moves down the timeline");
  fl.keys("k");
  assert.equal(fl.v.cur, ids()[from], "k moves up");
  env.focus = null;
  fl.click((n) => n.id === "kf-p-prep" && n.on.on_click);
  assert.equal(fl.v.cur, "p:prep", "a click on a phase takes the cursor");
  assert.ok(fl.v.handle.is_focused(), "a click on a phase takes the keyboard");
  const at = ids().indexOf("p:prep");
  fl.keys("j");
  assert.equal(fl.v.cur, ids()[at + 1], "j after a click moves from the clicked phase");
});

// ---------- the pages: kt-inbox, kt-gwm, kt-notes ----------

const pageLayout = (child) => ({ id: "root", children: [{ id: "view", active: child, children: [] }] });

await check("kt-inbox", async () => {
  env.spaces = space("/repo");
  env.layout = pageLayout("inbox");
  const ib = await load("kt-inbox");
  const item = (n) => ({ key: `o/r#${n}`, kind: "issue", number: n, title: `item ${n}`, repo: "o/r", labels: [], updatedAt: "2026-01-01T00:00:00Z", url: "" });
  ib.v.items = [1, 2, 3].map(item);
  ib.render();
  env.focus = null;
  ib.v.arrive(); // the page shown: its timer, once the app settled its focus
  assert.ok(ib.v.handle.is_focused(), "the page takes the keyboard");
  assert.ok(!ib.v.vim.insert, "the page arrives in NORMAL (a j would type into the filter)");
  ib.keys("j");
  assert.equal(ib.v.query, "", "j typed into the filter");
  assert.equal(ib.v.cur, "o/r#2", "j moves down");
  ib.keys("k k k");
  assert.ok(!ib.v.vim.insert, "k on the first row climbed into the filter (INSERT)");
  ib.keys("j");
  assert.equal(ib.v.query, "", "k on the first row then j: j typed into the filter");
  assert.equal(ib.v.cur, "o/r#2", "k on the first row then j: j came back down");
  ib.keys("/");
  assert.ok(ib.v.vim.insert, "/ goes to the filter");
  env.focus = null;
  ib.click((n) => n.id === "kti-row-o/r#3" && n.on.on_click);
  assert.ok(!ib.v.vim.insert && ib.v.handle.is_focused(), "a click on a row: the keyboard in NORMAL");
  ib.keys("k");
  assert.equal(ib.v.cur, "o/r#2", "k after a click moves from the clicked row");
});

await check("kt-gwm", async () => {
  env.spaces = space("/repo");
  env.layout = pageLayout("gwm");
  const g = await load("kt-gwm");
  // Its scope comes from gwm's answers (live only): the page drawn on a repo of three worktrees.
  const repo = { common: "/repo", name: "repo", folder: "/repo", slug: null };
  const wt = (path, main = false) => ({ path, name: path.split("/").pop(), branch: main ? "main" : `feat/${path.split("/").pop()}`, is_main: main });
  g.v.data = { "/repo": { rows: [wt("/repo", true), wt("/w/a"), wt("/w/b")], source: "gwm" } };
  const sc = { kind: "repo", repo };
  g.render = function () { g.v.render(g.cx); g.v.sc = sc; this.root = g.v.pageView(color, sc, null, g.cx).__node; return this; };
  g.render();
  env.focus = null;
  g.v.arrive();
  assert.ok(g.v.handle.is_focused(), "the page takes the keyboard");
  assert.ok(!g.v.vim.insert, "the page arrives in NORMAL (a j would type into the filter)");
  const first = g.v.stops()[0].id, second = g.v.stops()[1].id;
  g.keys("g g", "j");
  assert.equal(g.v.query, "", "j typed into the filter");
  assert.equal(g.v.cur, second, "j moves down");
  g.keys("k k k");
  assert.ok(!g.v.vim.insert, "k on the first card climbed into the filter (INSERT)");
  assert.equal(g.v.cur, first, "k stops on the first card");
  g.keys("j");
  assert.equal(g.v.cur, second, "k on the first card then j: j came back down");
  g.keys("/");
  assert.ok(g.v.vim.insert, "/ goes to the filter");
  env.focus = null;
  g.click((n) => n.id === "kg-card-/w/b" && n.on.on_click);
  assert.ok(!g.v.vim.insert && g.v.handle.is_focused(), "a click on a card: the keyboard in NORMAL");
  assert.equal(g.v.cur, "/w/b", "a click on a card takes the cursor");
});

await check("kt-notes", async () => {
  env.spaces = space("/repo");
  env.layout = pageLayout("notes");
  env.files = { "/repo/kbrdn/notes/project.md": "# Projet\n\nUn.\n\nDeux.\n\nTrois." };
  env.live = true; // its arrival runs live: scope, reads and watches stood in below
  try {
    const nt = await load("kt-notes");
    const repo = { id: "r1", common: "/repo", main: "/repo", name: "repo", folder: "/repo", machine: null };
    Object.assign(nt.v, { scope: () => ({ kind: "repo", repo }), reload() {}, watch() {} });
    nt.v.data = { r1: { listed: true, project: { text: env.files["/repo/kbrdn/notes/project.md"], mtime: 1 }, notes: [], branches: [],
      wts: [{ path: "/w/a", name: "a", branch: "feat/a" }, { path: "/w/b", name: "b", branch: "feat/b" }] } };
    env.focus = null;
    timers.length = 0;
    nt.render();
    runTimers(); // the page's arrival, once the app settled its focus
    assert.ok(nt.v.handle.is_focused() && !nt.v.vim.insert, "the page takes the keyboard in NORMAL");
    const ids = nt.v.items().map((x) => x.id);
    nt.keys("j");
    assert.equal(nt.v.cur, ids[1], "j moves down the list (not to its first row)");
    nt.keys("j");
    assert.equal(nt.v.cur, ids[2], "j moves down again");
    nt.keys("k");
    assert.equal(nt.v.cur, ids[1], "k moves up (not to the last row)");
    nt.keys("k k k");
    assert.ok(!nt.v.vim.insert, "k on the first row climbed into the search (INSERT)");
    nt.keys("j");
    assert.equal(nt.v.query, "", "k on the first row then j: j typed into the search");
    assert.equal(nt.v.cur, ids[1], "k on the first row then j: j came back down");
    nt.keys("/");
    env.focus = null;
    nt.click((n) => n.id === "kn-row-project" && n.on.on_click);
    await settle(); // the note read from disk
    nt.render();
    assert.ok(nt.v.handle.is_focused() && !nt.v.vim.insert, "a click on a note: the keyboard in NORMAL");
    assert.equal(nt.v.zone, "note", "a click opens the note");
    assert.ok(nt.v.blocks >= 4, "a note without boxes is cut into blocks");
    nt.keys("j j");
    assert.equal(nt.v.block, 2, "in Aperçu without boxes, j moves block to block");
    nt.keys("k");
    assert.equal(nt.v.block, 1, "k moves back a block");
    nt.keys("G");
    assert.equal(nt.v.block, nt.v.blocks - 1, "G goes to the last block");
  } finally {
    env.live = false;
  }
});

// ---------- kt-menu (the right-click menus) ----------

await check("kt-menu", async () => {
  env.spaces = space("/repo");
  env.panes = [{ pane: "p1", tab: "t1", terminal: "t1", cwd: "/repo", focused: true }];
  env.props = { tab: "pane", target: { pane: "p1", terminal: "t1" }, overlay: "ov" };
  try {
    const mn = await load("kt-menu");
    mn.render();
    let n = 0;
    walk(mn.root, (x) => { if (/^mi-\d+$/.test(x.id ?? "")) n++; });
    assert.ok(n >= 3, `the menu lists its items (${n})`);
    mn.keys("j");
    assert.equal(mn.v.at, 1, "j moves down");
    mn.keys("k k");
    assert.equal(mn.v.at, n - 1, "k from the first item goes round to the last");
    mn.keys("g g");
    assert.equal(mn.v.at, 0, "gg");
    mn.keys("G");
    assert.equal(mn.v.at, n - 1, "G");
  } finally {
    env.props = {};
    env.panes = [];
  }
});

if (failures.length) {
  console.log(`keynav: j / k don't move as they should:\n  ${failures.join("\n  ")}`);
  process.exit(1);
}
console.log("keynav: ok");
