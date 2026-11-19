// bun view.check.mjs: view.js, the thread's Chat as a pane (#86, lots 3 and 4; ctrl-b space): the thread
// on screen first, then on an agent's terminal its Chat pane focused or made at its right, on a Chat pane
// back to its agent's terminal, nothing on a shell or without a focused pane, nothing in another layout.
// Which Chat is whose: the registry, only its lines whose pane is there, a kt-chat, in the same tab.
// Fixtures are made up.
import assert from "node:assert/strict";
import { view, find, chatOf } from "./view.js";

const tree = () => ({ id: "root", children: [{ id: "view", type: "stack", children: [
  { id: "thread", children: [{ id: "thread-body" }, { id: "composer" }] }, { id: "inbox" }] }] });
const PANES = [
  { pane: "p-a", tab: "tab-1", terminal: "tA" }, // an agent
  { pane: "p-b", tab: "tab-1", terminal: "tB" }, // another agent, same tab
  { pane: "p-sh", tab: "tab-1", terminal: "tS" }, // a shell
  { pane: "p-ca", tab: "tab-1", terminal: null, mod: "kt-chat" }, // tA's Chat
  { pane: "p-x", tab: "tab-2", terminal: null, mod: "kt-chat" }, // a Chat in another tab
];
function deps({ focus, registry = { "p-ca": "tA" }, panes = PANES, layout = tree } = {}) {
  const calls = [];
  return {
    calls,
    layout,
    run: (name, args) => calls.push([name, args]),
    panes: () => panes,
    focused: () => (focus ? { pane: focus, tab: "tab-1" } : null),
    agents: () => [{ address: "tA" }, { address: "tB" }],
    registry: () => registry,
    toThread: () => calls.push(["toThread"]),
  };
}

assert.equal(find(tree(), "thread").id, "thread");

// On an agent's terminal with a Chat: focus it (after the thread comes on screen).
let d = deps({ focus: "p-a" });
assert.equal(view("", d), "chat");
assert.deepEqual(d.calls, [["toThread"], ["pane.focus", { pane: "p-ca" }]]);
// By name, the same.
d = deps({ focus: "p-a" });
assert.equal(view("chat", d), "chat");
assert.deepEqual(d.calls.at(-1), ["pane.focus", { pane: "p-ca" }]);

// On an agent with no Chat: one made at its right, its terminal in its props.
d = deps({ focus: "p-b" });
assert.equal(view("", d), "chat");
assert.deepEqual(d.calls, [["toThread"], ["pane.split", { direction: "right", pane: "p-b", mod: "kt-chat", props: { terminal: "tB" } }]]);

// On a Chat pane: back to its agent's terminal, nothing closed; by name "chat": stays.
d = deps({ focus: "p-ca" });
assert.equal(view("", d), "main");
assert.deepEqual(d.calls, [["toThread"], ["pane.focus", { terminal: "tA" }]]);
d = deps({ focus: "p-ca" });
assert.equal(view("chat", d), "chat");
assert.deepEqual(d.calls, [["toThread"]]);
// A Chat not registered yet (its first render): nothing to go back to.
d = deps({ focus: "p-ca", registry: {} });
assert.equal(view("", d), null);

// "main" on a terminal: already there.
d = deps({ focus: "p-a" });
assert.equal(view("main", d), "main");
assert.deepEqual(d.calls, [["toThread"]]);

// A shell (no agent), or no pane focused: nothing.
for (const focus of ["p-sh", null]) {
  d = deps({ focus });
  assert.equal(view("", d), null);
  assert.deepEqual(d.calls, [["toThread"]]);
}

// The registry's ghosts: a line whose pane is gone, a Chat of another tab, a pane that isn't a Chat:
// not a Chat of this agent here, so one is made.
for (const registry of [{ "p-gone": "tA" }, { "p-x": "tA" }, { "p-sh": "tA" }]) {
  d = deps({ focus: "p-a", registry });
  assert.equal(view("", d), "chat");
  assert.equal(d.calls.at(-1)[0], "pane.split", JSON.stringify(registry));
}
// Two agents in the tab, each its own Chat.
assert.equal(chatOf({ "p-ca": "tA", "p-cb": "tB" }, [...PANES, { pane: "p-cb", tab: "tab-1", mod: "kt-chat" }], "tB", "tab-1"), "p-cb");
assert.equal(chatOf(null, PANES, "tA", "tab-1"), null);

// Another layout (no thread): nothing at all, not even toThread.
d = deps({ focus: "p-a", layout: () => ({ id: "root", children: [{ id: "main" }] }) });
assert.equal(view("", d), null);
assert.deepEqual(d.calls, []);

console.log("view ok");
