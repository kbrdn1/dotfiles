// bun view.check.mjs: view.js, the thread's two faces (#54, back with #86; ctrl-b space): the stack
// thread-body on the tab's panes (main) or the Chat (chat). To the Chat: the stamp kt.chat.focus first
// (kt-chat takes the keyboard and fades the face in), then the switch. Back to the panes: the keyboard to
// the agent's pane, a shell focused or not. From a page: the thread again, on its Chat. Another layout,
// or the panes' block of #86 lots 3-4: nothing. Fixtures are made up.
import assert from "node:assert/strict";
import { view, find } from "./view.js";

const tree = (face, page) => ({ id: "root", children: [{ id: "view", type: "stack", ...(page ? { active: page } : {}), children: [
  { id: "thread", children: [{ id: "thread-body", type: "stack", ...(face ? { active: face } : {}), children: [{ id: "main" }, { id: "chat" }] },
    { id: "composer" }] }, { id: "inbox" }] }] });
const PANES = [
  { pane: "p-a", tab: "tab-1", terminal: "tA" }, // an agent
  { pane: "p-b", tab: "tab-1", terminal: "tB" }, // another agent, same tab
  { pane: "p-sh", tab: "tab-1", terminal: "tS" }, // a shell
  { pane: "p-z", tab: "tab-2", terminal: "tZ" }, // another tab's agent
];
const AGENTS = [{ address: "tZ", tab: "tab-2" }, { address: "tA", tab: "tab-1" }, { address: "tB", tab: "tab-1" }];
function deps({ face, page, focus = "p-a", agents = AGENTS, layout } = {}) {
  const calls = [];
  return {
    calls,
    layout: layout ?? (() => tree(face, page)),
    run: (name, args) => calls.push([name, args]),
    setShared: (key, v) => calls.push(["setShared", key, v]),
    panes: () => PANES.map((p) => ({ ...p, focused: p.pane === focus })),
    focused: () => (focus ? { pane: focus, tab: "tab-1" } : { pane: null, tab: "tab-1" }),
    agents: () => agents,
    now: () => 1000,
  };
}
const STAMP = ["setShared", "kt.chat.focus", 1000];
const TO = (child) => ["layout.select", { stack: "thread-body", child }];

assert.equal(find(tree(), "thread").id, "thread");

// The panes shown (main, the default): "" goes to the Chat, the stamp before the switch.
let d = deps();
assert.equal(view("", d), "chat");
assert.deepEqual(d.calls, [STAMP, TO("chat")], "to the Chat: the stamp, then the switch");
// On the Chat: "" back to the panes, the keyboard to the focused pane's agent.
d = deps({ face: "chat", focus: "p-b" });
assert.equal(view("", d), "main");
assert.deepEqual(d.calls, [TO("main"), ["pane.focus", { terminal: "tB" }]], "back: no stamp, tB's pane");
// A shell focused: back to the tab's first agent, never the shell nor another tab's agent.
d = deps({ face: "chat", focus: "p-sh" });
view("", d);
assert.deepEqual(d.calls, [TO("main"), ["pane.focus", { terminal: "tA" }]], "a shell focused: the agent's pane");
// No agent in the tab: the tab's focused pane.
d = deps({ face: "chat", focus: "p-sh", agents: [] });
view("", d);
assert.deepEqual(d.calls, [TO("main"), ["pane.focus", { pane: "p-sh" }]]);
// By name: "chat" on the Chat asks for the keyboard again; "main" on the panes focuses the agent.
d = deps({ face: "chat" });
assert.equal(view("chat", d), "chat");
assert.deepEqual(d.calls, [STAMP, TO("chat")]);
d = deps({ face: "main" });
assert.equal(view("main", d), "main");
assert.deepEqual(d.calls, [TO("main"), ["pane.focus", { terminal: "tA" }]]);
// From a page that covers the thread: the thread again, on its Chat; "main" picks the panes there.
d = deps({ face: "main", page: "inbox" });
assert.equal(view("", d), "chat");
assert.deepEqual(d.calls, [["layout.select", { stack: "view", child: "thread" }], STAMP, TO("chat")]);
d = deps({ face: "chat", page: "inbox" });
assert.equal(view("main", d), "main");
assert.deepEqual(d.calls, [["layout.select", { stack: "view", child: "thread" }], TO("main"), ["pane.focus", { terminal: "tA" }]]);
// Another layout, or the panes' block of #86 lots 3-4: nothing.
d = deps({ layout: () => ({ id: "root", children: [{ id: "view", children: [{ id: "thread" }] }] }) });
assert.deepEqual([view("", d), d.calls], [null, []]);
d = deps({ layout: () => ({ id: "root", children: [{ id: "thread-body", type: "block" }] }) });
assert.deepEqual([view("", d), d.calls], [null, []]);

console.log("view.check: ok");
