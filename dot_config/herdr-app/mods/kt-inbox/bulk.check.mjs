// bun ~/.config/herdr-app/mods/kt-inbox/bulk.check.mjs: the Inbox's bulk plans (bulk.js). Not loaded by Herdr.
import assert from "node:assert/strict";
import { planClose, planReview, describe } from "./bulk.js";

const items = [
  { kind: "pr", number: 39, title: "Apple Music", repo: "o/tv", state: "OPEN" },
  { kind: "issue", number: 31, title: "Paramètres", repo: "o/tv", state: "OPEN" },
  { kind: "pr", number: 12, title: "Old", repo: "o/tv", state: "MERGED" },
  { kind: "issue", number: 7, title: "Done", repo: "o/xt", state: "CLOSED" },
  { kind: "pr", number: 5, title: "Fork", repo: "o/nowhere", state: "OPEN" },
];

// Closing: open ones only, one gh call each, in the list's order; the others told why.
const c = planClose(items);
assert.deepEqual(c.calls, [
  ["pr", "close", "39", "-R", "o/tv"],
  ["issue", "close", "31", "-R", "o/tv"],
  ["pr", "close", "5", "-R", "o/nowhere"],
]);
assert.deepEqual(c.refused.map((r) => [r.item.number, r.why]), [[12, "déjà mergée"], [7, "déjà fermée"]]);
assert.deepEqual(planClose([]).calls, []);

// gwm review: PRs with a local clone only, never --bootstrap (nor --allow-bootstrap).
const clones = { "o/tv": "/repos/tv" };
const r = planReview(items, (repo) => clones[repo] ?? null);
assert.deepEqual(r.calls, [{ cwd: "/repos/tv", args: ["review", "39"] }, { cwd: "/repos/tv", args: ["review", "12"] }]);
assert.ok(r.calls.every((x) => !x.args.some((a) => a.includes("bootstrap"))));
assert.deepEqual(r.refused.map((x) => [x.item.number, x.why]), [[31, "pas une PR"], [7, "pas une PR"], [5, "aucun clone local du dépôt"]]);

assert.equal(describe(items[0]), "PR #39 · Apple Music");
assert.equal(describe(items[1]), "Issue #31 · Paramètres");
console.log("bulk.js: ok");
