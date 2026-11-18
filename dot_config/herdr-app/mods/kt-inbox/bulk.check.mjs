// bun ~/.config/herdr-app/mods/kt-inbox/bulk.check.mjs: the Inbox's bulk plans (bulk.js). Not loaded by Herdr.
import assert from "node:assert/strict";
import { planClose, planReview, describe, fitAsked } from "./bulk.js";

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
assert.deepEqual(c.refused.map((r) => [r.item.number, r.why]), [[12, "merged"], [7, "closed"]]);
assert.deepEqual(planClose([]).calls, []);

// gwm review: PRs with a local clone only, never --bootstrap (nor --allow-bootstrap).
const clones = { "o/tv": "/repos/tv" };
const r = planReview(items, (repo) => clones[repo] ?? null);
assert.deepEqual(r.calls, [{ cwd: "/repos/tv", args: ["review", "39"] }, { cwd: "/repos/tv", args: ["review", "12"] }]);
assert.ok(r.calls.every((x) => !x.args.some((a) => a.includes("bootstrap"))));
assert.deepEqual(r.refused.map((x) => [x.item.number, x.why]), [[31, "notPr"], [7, "notPr"], [5, "noClone"]]);

assert.equal(describe(items[0]), "PR #39 · Apple Music");
assert.equal(describe(items[1]), "Issue #31 · Paramètres");

// An item asked by another mod (kt-flow, kt-gwm): the filters that would hide it go, the others stay.
const listed = items.map((x) => ({ ...x, key: `${x.repo}#${x.number}` }));
const lists = { involves: listed, assignee: listed.filter((x) => x.number !== 39) };
const cached = (rel) => lists[rel ?? "involves"];
const matches = (x, q) => x.title.toLowerCase().includes(q.toLowerCase());
const pr39 = { repo: "o/tv", kind: "pr", number: 39 };
// Nothing on: nothing changes; listed, so no re-read.
let a = fitAsked(pr39, { kind: null, rel: null, query: "" }, cached, matches);
assert.deepEqual(a.view, { kind: null, rel: null, query: "" });
assert.equal(a.key, "o/tv#39");
assert.equal(a.item.title, "Apple Music");
assert.equal(a.reread, false);
assert.equal(a.tab, null);
// The Issues pill, a query it misses, a relation without it: all go.
a = fitAsked(pr39, { kind: "issue", rel: "assignee", query: "param" }, cached, matches);
assert.deepEqual(a.view, { kind: null, rel: null, query: "" });
// The PR pill, a query it matches, a relation that has it: kept.
a = fitAsked({ repo: "o/tv", kind: "issue", number: 31 }, { kind: "issue", rel: "assignee", query: "param" }, cached, matches);
assert.deepEqual(a.view, { kind: "issue", rel: "assignee", query: "param" });
// Not listed (merged, closed, just opened): re-read, and a query can't be checked against it: it goes.
a = fitAsked({ repo: "o/tv", kind: "pr", number: 99, tab: "checks" }, { kind: "pr", rel: null, query: "x" }, cached, matches);
assert.deepEqual(a.view, { kind: "pr", rel: null, query: "" });
assert.equal(a.item, null);
assert.equal(a.reread, true);
assert.equal(a.tab, "checks");
// A tab: a PR's known ones only; an issue has none.
assert.equal(fitAsked({ ...pr39, tab: "files" }, { kind: null, rel: null, query: "" }, cached, matches).tab, null);
assert.equal(fitAsked({ repo: "o/tv", kind: "issue", number: 31, tab: "checks" }, { kind: null, rel: null, query: "" }, cached, matches).tab, null);
// No cached list for that relation: dropped (it can't be shown there).
assert.equal(fitAsked(pr39, { kind: null, rel: "mentions", query: "" }, cached, matches).view.rel, null);
console.log("bulk.js: ok");
