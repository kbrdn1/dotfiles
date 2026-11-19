// kt-project-picker's check (bun picker.check.mjs): gpui-kit, gpui-base and herdr mocked; renders
// Home, two machines, a worktree and a closed project, then drives keys, the filter and a drag.
// Not a layout check: herdr-app check does that.
import { plugin } from "bun";

const log = { run: [], open: [], close: [], shared: {} };
let scrolled = null;
const el = (kind) => {
  const node = { kind, kids: [], props: {}, handlers: {} };
  const p = new Proxy(node, {
    get(target, k) {
      if (k in target) return target[k];
      return (...a) => {
        if (k === "child") { if (a[0] != null && a[0] !== false) target.kids.push(a[0]); }
        else if (k === "children") target.kids.push(...a[0].filter((x) => x != null && x !== false));
        else if (k === "when") { if (a[0]) return a[1](p); }
        else if (k === "id") target.props.id = a[0];
        else if (k.startsWith("on_")) target.handlers[k + (typeof a[0] === "string" ? ":" + a[0] : "")] = a.at(-1);
        else target.props[k] = a;
        return p;
      };
    },
  });
  return p;
};
const ROOT = "/Users/x";
let spacesData = [];
plugin({
  setup(build) {
    build.module("gpui-kit", () => ({ loader: "object", exports: { View: class {}, div: () => el("div"), svg: (s) => el("svg:" + s), image: (s) => el("img:" + s) } }));
    build.module("gpui-base", () => ({ loader: "object", exports: { v_flex: () => el("v"), h_flex: () => el("h"), ScrollHandle: { new: () => ({ scroll_to_item: (i) => { scrolled = i; } }) } } }));
    build.module("herdr", () => ({
      loader: "object",
      exports: {
        spaces: () => spacesData,
        run: (n, a) => log.run.push([n, a]),
        theme: () => new Proxy({}, { get: (_t, k) => `#${String(k).padEnd(6, "0").slice(0, 6)}` }),
        // Reduced motion: leave() closes at once (this mock's timer.after never fires).
        shared: (k) => (k === "kt.reducedMotion" ? true : log.shared[k]),
        setShared: (k, v) => { log.shared[k] = v; },
        openOverlay: (o) => { log.open.push(o); return "ov2"; },
        closeOverlay: (id) => log.close.push(id),
        props: () => globalThis.__props,
        home: () => ROOT,
        appHome: () => `${ROOT}/.config/herdr-app`, // projtile.js imports it (no cx in this check: nothing written)
        writeTextFile: async () => null,
        notify: () => {}, // main.js imports it since e4b978d
        pickFolder: async () => "/new/proj",
        checking: () => false,
        exec: async () => ({ code: 1, stdout: "", stderr: "" }), // i18n.js imports it
        nextCommand: () => new Promise(() => {}),
        settings: () => ({ dark: true }),
      },
    }));
  },
});

const assert = (c, m) => { if (!c) { console.error("FAIL:", m); process.exitCode = 1; } else console.log("ok:", m); };
const tab = (status) => ({ status });
spacesData = [
  { id: "s1", name: "~", named: false, folder: ROOT, machine: null, branch: null, active: true, tabs: [tab(null)] },
  { id: "s2", name: "alpha", named: false, folder: "/r/a", machine: null, branch: "main", active: false, tabs: [tab("working"), tab("done")] },
  { id: "s3", name: "alpha", named: false, folder: "/wt/a-feat", machine: null, branch: "feat/x", active: false, tabs: [tab("blocked")] },
  { id: "s4", name: "beta", named: false, folder: "/srv/b", machine: "vps", branch: "dev", active: false, tabs: [tab(null)] },
];
log.shared["kt.projects"] = [
  { id: JSON.stringify([null, "/r/a"]), name: "alpha", folder: "/r/a", machine: null, color: "ansi6", logos: { light: null, dark: null }, order: 0 },
  { id: JSON.stringify(["vps", "/srv/b"]), name: "beta", folder: "/srv/b", machine: "vps", color: null, logos: { light: null, dark: null }, order: 1 },
  { id: JSON.stringify([null, "/r/c"]), name: "cee", folder: "/r/c", machine: null, color: "ansi3", logos: { light: null, dark: null }, order: 2 },
];
log.shared["space.colors"] = { s2: "ansi6", s3: "ansi6", s4: "ansi4" };
globalThis.__props = {
  overlay: "ov1",
  homeReal: ROOT,
  real: { [JSON.stringify([null, ROOT])]: JSON.stringify([null, ROOT]), [JSON.stringify(["vps", "/srv/b"])]: JSON.stringify(["vps", "/srv/b"]) },
  repos: {
    [JSON.stringify([null, ROOT])]: null,
    [JSON.stringify([null, "/r/a"])]: { key: JSON.stringify([null, "/r/a/.git"]), name: "alpha", linked: false },
    [JSON.stringify([null, "/wt/a-feat"])]: { key: JSON.stringify([null, "/r/a/.git"]), name: "alpha", linked: true },
    [JSON.stringify(["vps", "/srv/b"])]: null,
  },
};

const { default: Picker } = await import(new URL("./main.js", import.meta.url).pathname);
const focus = { f: false, focus() { this.f = true; }, is_focused() { return this.f; } };
const cx = { focus_handle: () => focus, timer: { after() {}, every() {} }, spawn: (fn) => fn(cx), stop_propagation() {}, notify() {}, write_to_clipboard() {} };
const v = new Picker();
v.init({}, cx);
const text = (n) => (typeof n === "string" ? n : (n.kids ?? []).map(text).join(" "));
const listOf = (root) => root.kids.find((k) => k.props.id === "pp-list");
const outline = (root) => listOf(root).kids.map((k) => `${k.props.id ?? "eyebrow"}|${text(k).trim()}`);
let root = v.render();
console.log(outline(root).join("\n"));
assert(JSON.stringify(outline(root).map((s) => s.split("|")[0])) === JSON.stringify(["pp-home-s1", "eyebrow", "pp-s2", "pp-s3", "eyebrow", "pp-s4", "eyebrow", "pp-closed-0"]), "order: Home, local, alpha, its worktree, vps, beta, FERMÉS, cee");
const L = listOf(root).kids.filter((k) => k.props.id).length, E = listOf(root).kids.length - L;
console.log(`L=${L} E=${E} height=${118 + 33 * L + 25 * E}`);
assert(v.cur === 0 && v.rows.length === 7, "cursor on the shown project (Home), 7 stops");
assert(root.props.size_full && root.props.rounded[0] === 16, "card fills the popup, radius 16");

const keys = (s) => { for (const k of s.split(" ")) v.act(v.vim.handle(k), cx); root = v.render(); };
keys("escape");
assert(!v.vim.insert && log.close.length === 0, "esc in INSERT: NORMAL, still open");
keys("k");
assert(v.vim.insert, "k on the first line: back to the filter (INSERT)");
keys("escape j j");
assert(v.cur === 2, "j j: worktree line");
const curEl = listOf(root).kids.find((k) => k.props.id === "pp-s3");
assert(curEl.props.border_color[0] === "#accent99", "ring 1 px alpha(accent, 99) on the cursor line");
keys("G");
assert(v.cur === 6, "G: Gérer les projets");
keys("g g");
assert(v.cur === 0, "gg: top");
keys("/ f e a t");
console.log(outline(root).join("\n"));
assert(v.query === "feat" && v.rows.length === 3 && v.cur === 0, "filter 'feat': the worktree only (+ the foot)");
keys("enter");
assert(log.run.some(([n, a]) => n === "space.select" && a.id === "s3") && log.run.some(([n, a]) => n === "layout.select" && a.child === "thread") && log.close.includes("ov1"), "enter: shows the worktree's space, thread, closes");

// Filter by machine, then the closed line.
log.run = []; log.close = [];
v.query = ""; v.cur = null; v.vim.edit(); root = v.render();
keys("v p s");
assert(v.rows.length === 3 && outline(root)[0].startsWith("eyebrow|VPS"), "filter 'vps': beta under its machine header");
v.query = ""; v.cur = null; root = v.render();
keys("c e e enter"); // one batch, no render between: enter must see the filtered lines
assert(log.run.some(([n, a]) => n === "space.new" && a.folder === "/r/c" && a.machine === ""), "closed project: space.new");

// Nouveau projet: closes, then kt-threads asks the folder (it outlives the popup).
log.run = []; log.close = [];
v.query = ""; v.cur = 5; v.vim.normal(); root = v.render();
keys("o");
assert(log.run.some(([n]) => n === "kt-threads.new-project") && log.close.includes("ov1"), "Nouveau projet: closes, kt-threads asks the folder");

// Drag alpha onto cee: the registry's order.
v.cur = 0; root = v.render();
const lineOf = (id) => listOf(root).kids.find((k) => k.props.id === id);
lineOf("pp-s2").handlers["on_mouse_down:left"]();
lineOf("pp-closed-0").handlers["on_mouse_up:left"](null, cx);
assert(JSON.stringify(log.shared["kt.projects"].map((e) => e.name)) === JSON.stringify(["beta", "cee", "alpha"]), "drag alpha onto cee: reordered");
// A press released on itself: a click.
log.run = [];
root = v.render();
lineOf("pp-s4").handlers["on_mouse_down:left"]();
lineOf("pp-s4").handlers["on_mouse_up:left"](null, cx);
assert(log.run.some(([n, a]) => n === "space.select" && a.id === "s4"), "press + release on beta: selects it");
// q closes in NORMAL; an unknown key passes.
log.close = [];
v.vim.normal();
assert(v.act(v.vim.handle("x"), cx) === false, "x (delete) isn't ours: passes");
keys("q");
assert(log.close.includes("ov1"), "q closes");
