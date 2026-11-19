// bun ~/.config/herdr-app/mods/kt-hub/project.check.mjs: the project view's model (project.js): a folder's
// project, the project's week and launches, its year (heat pairs, junction), the week's PRs (gh and the
// reports, the median time to merge), what review and CI caught. Synthetic data, TZ fixed.
process.env.TZ = "Europe/Paris";
import assert from "node:assert/strict";
const P = await import("./project.js");
const M = await import("./model.js");

assert.equal(P.keyOf("/p/a/worktrees/x", ["/p/a", "/p", "/p/ab"]), "/p/a", "the longest, on a path boundary");
assert.equal(P.keyOf("/p/ab", ["/p/a"]), null);

const w = M.week({}, "2026-11-19"); // Monday 16 to Thursday 19
const p = {
  days: {
    "2026-11-16": [2, 600, 3, 1, { "me:merge": 1, chezmoi: 2 }],
    "2026-11-19": [1, 60, 1, 0],
    "2026-11-09": [4, 100, 2, 0, { chezmoi: 1 }],
    "2026-11-13": [9, 9, 9, 9, { x: 9 }], // a Friday: not against this week's Monday to Thursday
  },
  heat: { 2025: [[300, 2]], 2026: [[319, 2], [322, 1], [364, 5]] },
};
const pw = P.projectWeek(p, w);
assert.deepEqual(pw.now, { s: 3, a: 660, p: 4, pr: 1 });
assert.deepEqual(pw.before, { s: 4, a: 100, p: 2, pr: 0 });
assert.deepEqual(pw.launches, [{ name: "chezmoi", n: 2, prev: 1 }, { name: "me:merge", n: 1, prev: 0 }]);

const summary = { first: "2025-10-01", junction: "2026-10-26" };
const y = P.projectYear(p, 2026, summary, "2026-11-19");
assert.deepEqual([y.values[319], y.values[322], y.values[323], y.values[364]], [2, 1, null, null], "nothing after today");
assert.deepEqual([y.split, y.active, y.sessions], [298, 2, 3]);
assert.equal(P.projectYear(p, 2025, summary, "2026-11-19").values[272], null, "before the first day known");
assert.deepEqual(P.projectYears(p, "2026-11-19"), [2025, 2026]);
assert.deepEqual(P.projectYears({}, "2026-11-19"), [2026], "this year, always");

const list = [
  { number: 1, title: "ouverte lundi, mergée mardi", state: "MERGED", createdAt: "2026-11-16T09:00:00Z", mergedAt: "2026-11-17T09:00:00Z", url: "u1" },
  { number: 2, title: "ancienne, mergée mercredi", state: "MERGED", createdAt: "2026-11-01T09:00:00Z", mergedAt: "2026-11-18T09:00:00Z", url: "u2" },
  { number: 3, title: "ancienne, encore ouverte", state: "OPEN", createdAt: "2026-10-01T09:00:00Z", mergedAt: null, url: "u3", isDraft: true },
  { number: 4, title: "fermée avant", state: "CLOSED", createdAt: "2026-10-01T09:00:00Z", mergedAt: null, url: "u4" },
  { number: 5, title: "ouverte jeudi", state: "OPEN", createdAt: "2026-11-19T08:00:00Z", mergedAt: null, url: "u5" },
];
const reports = [{ repo: "o/r", at: Date.parse("2026-11-17T10:00:00Z"), pr: { url: "u1" }, review: { passes: 2, found: 3, fixed: 2, open: 0 }, ci: { ok: 3, fail: 1, pending: 0, total: 4 }, lines: [10, 2] },
  { repo: "o/other", at: Date.parse("2026-11-17T10:00:00Z"), pr: { url: "u2" }, review: { passes: 9, found: 9, fixed: 9 } },
  { repo: "o/r", at: Date.parse("2026-11-10T10:00:00Z"), pr: { url: "u9" }, review: { passes: 1, found: 5, fixed: 0 } }];
const prs = P.weekPrs(list, reports, "o/r", w);
assert.deepEqual(prs.rows.map((x) => x.n), [5, 2, 1, 3], "touched this week or still open, newest first; the closed one out");
assert.deepEqual([prs.opened, prs.merged], [2, 2]);
assert.equal(prs.median, 86400e3, "one day (#1); #2's 17 days is the other half");
assert.deepEqual(prs.rows.find((x) => x.n === 1).review, { passes: 2, found: 3, fixed: 2, open: 0 });
assert.equal(prs.rows.find((x) => x.n === 2).review, null, "another repo's report");
assert.equal(prs.rows.find((x) => x.n === 3).draft, true);
assert.deepEqual(P.weekPrs(null, [], "o/r", w), { rows: [], opened: 0, merged: 0, median: null });

const flows = [{ repo: "o/r", review: 2, ci: 3, seen: Date.parse("2026-11-18T10:00:00Z") }, { repo: "o/r", review: 9, ci: 9, seen: Date.parse("2026-11-01T10:00:00Z") }];
assert.deepEqual(P.weekChecks(reports, flows, "o/r", w), { reports: 1, found: 3, fixed: 2, ciFail: 1, ciOk: 3, reviewRuns: 2, ciRuns: 3 });

const args = P.prListArgs("o/r", "2026-11-09");
assert.ok(args.includes("--repo") && args.includes("o/r") && args.includes("updated:>=2026-11-09"));
console.log("project.check: ok");
