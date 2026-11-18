// bun ~/.config/herdr-app/mods/kt-new/remote.check.mjs: remote.js on invented machines (vps-a): which
// agents a checked machine has, when a launch asks first (an agent on a root machine, never a shell, not
// when root isn't known, not twice for the same confirmed launch), the project chip's label.
import assert from "node:assert/strict";
import { installedOn, okKey, mustConfirm, chipLabel } from "./remote.js";

// knownAgents' shape: programs.json entries with `run`, `installed` per machine.
const list = [
  { key: "claude", name: "Claude Code", run: ["claude"], installed: true },
  { key: "codex", name: "Codex", run: ["codex", "--no-daemon"], installed: false },
];
assert.equal(installedOn(list, ["claude"]), true);
assert.equal(installedOn(list, ["codex"]), false); // matched by its run's program too
assert.equal(installedOn(list, ["vibe"]), null); // not in the list: not known
assert.equal(installedOn(undefined, ["claude"]), null); // not checked
assert.equal(installedOn(undefined, null), true); // the shell always is
assert.equal(installedOn(list, null), true);

// Asks first: an agent on a root machine.
assert.equal(mustConfirm({ machine: "vps-a", argv: ["claude"], root: true }), true);
// Never a shell, never this computer, never when root is false or not known.
assert.equal(mustConfirm({ machine: "vps-a", argv: null, root: true }), false);
assert.equal(mustConfirm({ machine: null, argv: ["claude"], root: true }), false);
assert.equal(mustConfirm({ machine: "vps-a", argv: ["claude"], root: false }), false);
assert.equal(mustConfirm({ machine: "vps-a", argv: ["claude"], root: null }), false);
// Confirmed for this machine and agent: not asked again; another agent or machine asks again.
const ok = okKey("vps-a", ["claude"]);
assert.equal(mustConfirm({ machine: "vps-a", argv: ["claude"], root: true, ok }), false);
assert.equal(mustConfirm({ machine: "vps-a", argv: ["codex"], root: true, ok }), true);
assert.equal(mustConfirm({ machine: "vps-b", argv: ["claude"], root: true, ok }), true);

// The chip: a remote project says its machine.
assert.equal(chipLabel("k-hub", null), "k-hub");
assert.equal(chipLabel("k-hub", "vps-a"), "k-hub · vps-a");

console.log("remote: ok");
