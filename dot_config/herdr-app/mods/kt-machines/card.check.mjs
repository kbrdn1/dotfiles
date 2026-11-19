// bun ~/.config/herdr-app/mods/kt-machines/card.check.mjs: what kt-machines shows of a machine, on
// invented ones (vps-a connected as root, vps-b needing a login, vps-c away with its reason and its
// programs stopping at logout, vps-d still loading): its login, its warning, what enter does.
import assert from "node:assert/strict";
import { cardOf } from "./card.js";

const a = cardOf({ name: "vps-a", status: "ready", root: true, account: "root", version: "0.1.21", why: null, linger: true });
assert.deepEqual(a, { name: "vps-a", status: "ready", root: true, account: "root", version: "0.1.21", why: null, login: null, linger: false, primary: "project" });

const b = cardOf({ name: "vps-b", status: "login", root: null, account: null, version: "0.1.21", why: null, linger: null });
assert.equal(b.login, "hc machine login vps-b");
assert.equal(b.primary, "login"); // enter copies the command
assert.equal(b.root, null); // not known: no ROOT
assert.equal(b.linger, false); // not known: no warning

const c = cardOf({ name: "vps-c", status: "away", root: false, account: "deploy", version: "0.1.20", why: "connection refused", linger: false });
assert.equal(c.why, "connection refused");
assert.equal(c.linger, true); // stops at logout: the warning
assert.equal(c.primary, null); // nothing to open there now
assert.equal(c.login, null);

const d = cardOf({ name: "vps-d", status: "loading", root: null, account: null, version: null, why: "stale", linger: null });
assert.equal(d.why, null); // a reason only for a machine away
assert.equal(d.primary, null);

console.log("card: ok");
