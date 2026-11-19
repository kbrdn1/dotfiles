// bun ~/.config/herdr-app/mods/kt-head/autohub.check.mjs: when the home page shows by itself (autohub.js):
// the start (a machine still loading: never), the last space closing, Home shown with nothing running,
// never while working in a thread, and never because a machine came or went (its spaces with it).
import assert from "node:assert/strict";
const A = await import("./autohub.js");

const H = "/home/k";
const LOCAL = { name: null, status: "local" };
const world = (o = {}) => A.facts({ machines: [LOCAL], spaces: [], agents: [], home: H, ...o });
const sp = (id, folder, active = false, machine = null) => ({ id, folder, active, machine, tabs: [{ id: `${id}-t` }] });

// The start.
assert.equal(A.shouldShow(null, world({ machines: [LOCAL, { name: "vps", status: "loading" }] })), false, "spaces() may be empty while loading");
assert.equal(A.shouldShow(null, world({ machines: [{ name: null, status: "loading" }] })), false, "this computer's layout still read");
assert.equal(A.shouldShow(null, world()), true, "no space at all");
assert.equal(A.shouldShow(null, world({ spaces: [sp("a", "/p/a", true)] })), false, "a project shown");
assert.equal(A.shouldShow(null, world({ spaces: [sp("h", H, true)] })), true, "Home shown, nothing running");
assert.equal(A.shouldShow(null, world({ spaces: [sp("h", H, true)], agents: [{ space: "h", status: "working" }] })), false, "Home with an agent at work");
assert.equal(A.shouldShow(null, world({ spaces: [sp("h", H, true)], agents: [{ space: "h", status: "idle" }] })), true, "an idle agent doesn't run");
assert.equal(A.shouldShow(null, world({ spaces: [sp("h", H, true)], agents: [{ space: "a", status: "blocked" }] })), true, "another space's agent");
assert.equal(A.shouldShow(null, world({ machines: [LOCAL, { name: "vps", status: "away" }] })), true, "an away machine doesn't hold the start");
// The machines finish loading: that render is the start.
assert.equal(A.shouldShow(world({ machines: [LOCAL, { name: "vps", status: "loading" }] }), world({ machines: [LOCAL, { name: "vps", status: "ready" }] })), true);
assert.equal(A.facts({ machines: [], spaces: [], agents: [], home: H }).ready, false, "no machine read yet");

// Later: the last space closes; Home shown again; never while working in a thread.
const two = world({ spaces: [sp("a", "/p/a", true), sp("h", H)] });
assert.equal(A.shouldShow(two, world({ spaces: [sp("h", H, true)] })), true, "to Home");
assert.equal(A.shouldShow(two, world({ spaces: [sp("h", H, true)], agents: [{ space: "h", status: "blocked" }] })), false, "Home waits for you");
assert.equal(A.shouldShow(world({ spaces: [sp("a", "/p/a", true)] }), world()), true, "the last space closed");
assert.equal(A.shouldShow(two, world({ spaces: [sp("a", "/p/a"), sp("h", H)] })), false, "no space shown, but some left");
const home = world({ spaces: [sp("h", H, true)] });
assert.equal(A.shouldShow(home, home), false, "nothing changed: no show (the person left the page)");
assert.equal(A.shouldShow(home, world({ spaces: [sp("h", H, true), sp("b", "/p/b")] })), false, "a space opened beside");
assert.equal(A.shouldShow(two, world({ spaces: [sp("a", "/p/a"), sp("h", H), sp("c", "/p/c", true)] })), false, "another project");

// Another machine: its spaces count while it answers; a cut is no transition, whatever spaces() does.
const vps = { name: "vps", status: "ready" };
const away = { name: "vps", status: "away" };
const onVps = world({ machines: [LOCAL, vps], spaces: [sp("r", "/srv", true, "vps")] });
assert.equal(onVps.count, 1);
assert.equal(A.shouldShow(onVps, world({ machines: [LOCAL, away] })), false, "the machine goes away, its space leaves spaces()");
assert.equal(A.shouldShow(onVps, world({ machines: [LOCAL, away], spaces: [sp("r", "/srv", true, "vps")] })), false, "it goes away, its space stays");
assert.equal(A.shouldShow(world({ machines: [LOCAL, vps], spaces: [sp("r", "/srv", true, "vps"), sp("h", H)] }), world({ machines: [LOCAL, { name: "vps", status: "away" }], spaces: [sp("h", H, true)] })), false,
  "the view moves to Home because the shown machine went: no show");
// Once the set of machines is stable again, a later render changes nothing by itself.
const cut = world({ machines: [LOCAL, away], spaces: [sp("h", H, true)] });
assert.equal(A.shouldShow(cut, cut), false);
// Its last space closed while it answers: that one is a close.
assert.equal(A.shouldShow(onVps, world({ machines: [LOCAL, vps] })), true, "the last space, on the other machine, closed");
// A local space closing while another machine's space stays open: not the last one.
assert.equal(A.shouldShow(world({ machines: [LOCAL, vps], spaces: [sp("a", "/p/a", true), sp("r", "/srv", false, "vps")] }),
  world({ machines: [LOCAL, vps], spaces: [sp("r", "/srv", false, "vps")] })), false);

console.log("autohub.check: ok");
