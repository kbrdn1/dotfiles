// bun view.check.mjs: view.js, the thread's Terminal / Chat switch (#54, ctrl-b space): it alternates
// from the active child, picks one by name, brings the thread back on its Chat face from a page that
// covers it, hands the Chat the keyboard (shared kt.chat.focus) and the terminal its focus back, and
// does nothing without the stack.
import assert from "node:assert/strict";
import { view, find } from "./view.js";

// The layout as kbrdn-threads has it: the stack view (thread and the pages), the thread's stack.
const tree = (active, page) => ({ id: "root", children: [{ id: "view", type: "stack", ...(page ? { active: page } : {}), children: [
  { id: "thread", children: [
    { id: "thread-body", type: "stack", ...(active ? { active } : {}), children: [{ id: "main" }, { id: "chat" }] },
    { id: "composer" }] },
  { id: "inbox" }, { id: "skills" }] }] });
function deps(active, page) {
  const calls = [];
  const shared = {};
  return {
    calls, shared,
    layout: () => tree(active, page),
    run: (name, args) => calls.push([name, args]),
    setShared: (k, v) => { shared[k] = v; },
    focused: () => ({ tab: "tab-1" }),
    panes: () => [
      { pane: "p-other", tab: "tab-2", focused: true, terminal: "t9" },
      { pane: "p-1", tab: "tab-1", focused: false, terminal: "t1" },
      { pane: "p-2", tab: "tab-1", focused: true, terminal: "t2" },
    ],
  };
}

assert.equal(find(tree(), "thread-body").type, "stack");

// No active child written: the first (main) is shown, so it goes to the Chat, which gets the keyboard.
let d = deps();
assert.equal(view("", d), "chat");
assert.deepEqual(d.calls, [["layout.select", { stack: "thread-body", child: "chat" }]]);
assert.equal(typeof d.shared["kt.chat.focus"], "number");

// From the Chat: back to the terminal, the shown tab's focused pane focused (not another tab's).
d = deps("chat", "thread");
assert.equal(view("", d), "main");
assert.deepEqual(d.calls, [["layout.select", { stack: "thread-body", child: "main" }], ["pane.focus", { pane: "p-2" }]]);
assert.equal(d.shared["kt.chat.focus"], undefined);

// From a page (Inbox) over the thread: the thread again, on its Chat face, whatever it showed.
for (const was of ["main", "chat"]) {
  d = deps(was, "inbox");
  assert.equal(view("", d), "chat");
  assert.deepEqual(d.calls, [["layout.select", { stack: "view", child: "thread" }], ["layout.select", { stack: "thread-body", child: "chat" }]]);
  assert.equal(typeof d.shared["kt.chat.focus"], "number");
}
// By name from a page: that face.
d = deps("chat", "skills");
assert.equal(view("main", d), "main");
assert.deepEqual(d.calls.map((c) => c[1].child ?? c[1].pane), ["thread", "main", "p-2"]);

// By name, whatever is shown.
d = deps("chat");
assert.equal(view("chat", d), "chat");
d = deps("main");
assert.equal(view("main", d), "main");

// Another layout (no thread-body): nothing at all.
d = deps();
d.layout = () => ({ id: "root", children: [{ id: "main" }] });
assert.equal(view("", d), null);
assert.deepEqual(d.calls, []);

console.log("view ok");
