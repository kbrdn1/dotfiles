// bun ~/.config/herdr-app/mods/kt-hub/model.check.mjs: the home page's model (model.js) on a tiny summary:
// the week from Monday against the same days before, the 8 weeks of trends, the deltas, the launches'
// families, the projects' rows (registry, sparkline, order), a year of the heatmap (no square before the
// first day nor after today, the junction's index), what runs now. TZ fixed.
process.env.TZ = "Europe/Paris";
import assert from "node:assert/strict";
const M = await import("./model.js");

assert.equal(M.mondayOf("2026-11-19"), "2026-11-16", "a Thursday's Monday");
assert.equal(M.mondayOf("2026-11-16"), "2026-11-16");
assert.equal(M.mondayOf("2026-11-22"), "2026-11-16", "Sunday ends the week");
assert.equal(M.dayShift("2026-03-28", 2), "2026-03-30", "across the DST change");
assert.equal(M.daysBetween("2026-12-28", "2027-01-04"), 7);
assert.equal(M.delta(12, 10), 20);
assert.equal(M.delta(5, 0), null, "no base: no percent");
assert.equal(M.delta(0, 4), -100);

const b = (o) => ({ s: {}, p: {}, m: 0, o: 0, a: 0, mo: {}, sub: {}, l: {}, pr: 0, mg: 0, ...o });
const days = {
  // This week (Mon 16 to Thu 19).
  "2026-11-16": b({ s: { cli: 2, mono: 1 }, p: { cli: 4 }, a: 3600e3, sub: { Explore: 2 }, l: { "me:loop:claude-review-pr": 2, "me:merge": 1, compact: 3 }, pr: 1 }),
  "2026-11-19": b({ s: { cli: 1 }, p: { cli: 1 }, sub: { "general-purpose": 1 }, l: { chezmoi: 1 }, mg: 2 }),
  // The same days the week before (Mon 9 to Thu 12), and its Friday (not counted against this week).
  "2026-11-09": b({ s: { mono: 2 }, p: { mono: 2 }, l: { "me:merge": 3 }, pr: 2 }),
  "2026-11-13": b({ s: { mono: 9 }, p: { mono: 9 } }),
  // Seven weeks back: the first week of the trend.
  "2026-09-28": b({ s: { hist: 5 } }),
  "2026-09-27": b({ s: { hist: 50 } }), // a Sunday: the week before the trend's first
};
const w = M.week(days, "2026-11-19");
assert.deepEqual([w.from, w.len], ["2026-11-16", 4]);
assert.deepEqual(w.now, { s: 4, p: 5, a: 3600e3, sub: 3, pr: 1, mg: 2 });
assert.deepEqual(w.before, { s: 2, p: 2, a: 0, sub: 0, pr: 2, mg: 0 }, "Monday to Thursday only");
assert.equal(w.trend.length, 8);
assert.deepEqual(w.trend.map((x) => x.s), [5, 0, 0, 0, 0, 0, 11, 4]);

// Launches: this week's, with the same days before; families.
const l = M.ranked(days, w, "l");
assert.deepEqual(l.map((x) => [x.name, x.n, x.prev, x.family]), [
  ["compact", 3, 0, "command"], ["me:loop:claude-review-pr", 2, 0, "loop"], ["chezmoi", 1, 0, "skill"], ["me:merge", 1, 3, "workflow"]]);
assert.deepEqual(M.ranked(days, w, "sub").map((x) => [x.name, x.n, x.family]), [["Explore", 2, null], ["general-purpose", 1, null]]);
assert.equal(M.familyOf("me:issue-worktree-pr"), "workflow");
assert.equal(M.familyOf("me:spec-issue-branch-pr"), "workflow");
assert.equal(M.familyOf("me:goal"), "workflow");
assert.equal(M.familyOf("me:report"), "skill");
assert.equal(M.familyOf("reload-plugins"), "command");

// Projects: this week's most active first; the registry's name and entry by folder; none idle 8 weeks.
const projects = {
  "/p/a": { name: "a", kind: "registry", slug: "o/a", last: 5, days: { "2026-11-16": [1, 60, 2, 1], "2026-11-09": [3, 0, 0, 0] } },
  "/p/b": { name: "b", kind: "repo", slug: "o/b", last: 9, days: { "2026-11-17": [2, 30, 1, 0] } },
  "/p/old": { name: "old", kind: "repo", last: 1, days: { "2026-09-01": [4, 0, 0, 0] } },
  "/home": { name: "Home", kind: "home", last: 2, days: { "2026-11-10": [1, 0, 0, 0] } },
};
const rows = M.projectRows(projects, [{ folder: "/p/a/", name: "Projet A", color: "ansi3" }, { folder: "/p/b", name: "B", machine: "vps" }], w);
assert.deepEqual(rows.map((r) => [r.key, r.name, r.s, r.a, r.p, r.pr]), [["/p/b", "b", 2, 30, 1, 0], ["/p/a", "Projet A", 1, 60, 2, 1], ["/home", "Home", 0, 0, 0, 0]]);
assert.equal(rows[1].entry.color, "ansi3", "its registry entry");
assert.equal(rows[0].entry, null, "another machine's entry is not this folder's");
assert.deepEqual(rows[1].spark, [0, 0, 0, 0, 0, 0, 3, 1]);

// A year: sessions per day from January 1st; nothing before the first day nor after today.
const summary = { first: "2025-10-01", junction: "2026-10-26", years: { 2025: Array(365).fill(1), 2026: Array(365).fill(2) } };
const y26 = M.year(summary, 2026, "2026-11-19");
assert.equal(y26.start, "2026-01-01");
assert.equal(y26.values[322], 2, "today");
assert.equal(y26.values[323], null, "tomorrow");
assert.equal(y26.split, 298, "2026-10-26 is day 299");
assert.equal(y26.active, 323);
const y25 = M.year(summary, 2025, "2026-11-19");
assert.equal(y25.values[272], null, "before the first day known (2025-10-01 is day 274)");
assert.equal(y25.values[273], 1);
assert.equal(y25.split, -1, "the junction is in another year");
assert.equal(M.year(summary, 2024, "2026-11-19"), null);
assert.deepEqual(M.years(summary), [2025, 2026]);

// Now: blocked first, else done, else working.
const ag = [{ address: "t1", status: "working" }, { address: "t2", status: "done" }, { address: "t3", status: "blocked" }, { address: "t4", status: "idle" }];
assert.deepEqual(M.now(ag), { working: 1, blocked: 1, done: 1, go: ag[2] });
assert.equal(M.now([ag[0]]).go, ag[0]);
assert.equal(M.now([]).go, null);

// #66: by machine, from the address's prefix; this computer first, a machine without agents keeps its row.
assert.equal(M.machineOf("vps/t3"), "vps");
assert.equal(M.machineOf("t3"), null);
const mixed = [{ address: "t1", status: "working" }, { address: "vps/t2", status: "blocked" }, { address: "vps/t4", status: "working" }, { address: "box/t9", status: "idle" }];
assert.deepEqual(M.byMachine(mixed, ["vps", "far"]).map((g) => [g.name, g.total, g.working, g.blocked, g.go?.address ?? null]),
  [[null, 1, 1, 0, "t1"], ["vps", 2, 1, 1, "vps/t2"], ["far", 0, 0, 0, null], ["box", 1, 0, 0, null]]);

// #89, Temps agent: a week (Monday to Sunday) or a month, some periods back; the days passed.
const P = M.period("week", 0, "2026-11-19");
assert.deepEqual([P.keys[0], P.keys.at(-1), P.keys.length, P.passed.length], ["2026-11-16", "2026-11-22", 7, 4]);
assert.deepEqual(M.period("week", 2, "2026-11-19").keys[0], "2026-11-02");
const Pm = M.period("month", 0, "2026-11-19");
assert.deepEqual([Pm.keys[0], Pm.keys.at(-1), Pm.passed.length], ["2026-11-01", "2026-11-30", 19]);
assert.deepEqual([M.period("month", 1, "2026-11-19").keys.length, M.period("month", 11, "2026-11-19").keys[0]], [31, "2025-12-01"], "October; back across the year");
assert.equal(M.period("month", 9, "2026-11-19").keys.length, 28, "February 2026");
// Agent time (s): the total and the average over the days passed; each project's; the chart's days.
const tsum = {
  junction: "2026-11-10",
  days: { "2026-11-16": b({ a: 7200e3 }), "2026-11-17": b({ a: 3600e3 }), "2026-11-09": b({ a: 1800e3 }), "2026-11-11": b({ a: 3600e3 }), "2026-11-12": b({ a: 3600e3 }), "2026-11-13": b({ a: 3600e3 }) },
  projects: { "/p/a": { days: { "2026-11-16": [1, 5400], "2026-11-17": [1, 600] } }, "/p/b": { days: { "2026-11-16": [1, 1800], "2026-11-09": [1, 1800] } } },
};
const cur = M.spent(tsum, P);
assert.deepEqual([cur.total, cur.avg, cur.known, cur.cut, cur.partial], [10800, 2700, 4, false, false], "4 days passed, Thursday's included");
assert.deepEqual(cur.by, [{ key: "/p/a", t: 6000 }, { key: "/p/b", t: 1800 }]);
// Cut by the junction (the 10th): the week of the 9th counts from the 10th on; its 9th is left out.
const before = M.spent(tsum, M.period("week", 1, "2026-11-19"));
assert.deepEqual([before.total, before.known, before.cut, before.use.length], [10800, 6, true, 6]);
assert.equal(M.spentDelta(cur, before), 50, "2 700 s a day against 1 800");
assert.equal(M.spentDelta(cur, { ...before, known: 2 }), null, "fewer than 3 days known: no change");
// Entirely before the junction: its days as they are.
const old = M.spent(tsum, M.period("week", 2, "2026-11-19"));
assert.deepEqual([old.total, old.known, old.partial], [0, 0, true]);
const st = M.stacks(tsum, P, "2026-11-19", ["/p/a", "/p/b"]);
assert.deepEqual(st[0], [{ k: "p0", v: 5400 }, { k: "p1", v: 1800 }, { k: "o", v: 0 }]);
assert.deepEqual(st[1], [{ k: "p0", v: 600 }, { k: "p1", v: 0 }, { k: "o", v: 3000 }], "the rest: the day's time less the 5 first's");
assert.deepEqual(st[4], [], "a day to come");
assert.deepEqual(M.periodCounts(days, P.passed, "l"), [["compact", 3], ["me:loop:claude-review-pr", 2], ["chezmoi", 1], ["me:merge", 1]]);
// The registry by key; the plan's limits.
assert.deepEqual(M.projectIndex(projects, [{ folder: "/p/a/", name: "Projet A", color: "ansi3" }]).get("/p/a"), { key: "/p/a", kind: "registry", name: "Projet A", entry: { folder: "/p/a/", name: "Projet A", color: "ansi3" } });
// The plan's limits: the newer of the statusLine's reading and kt-usage's summary (week.at, else at), as usagePeek.
const file = '{"seven_day":{"used_percentage":19.6,"resets_at":1000},"updated_at":200}';
assert.deepEqual(M.planLimits(file, null, 0), { five: null, seven: { used: 20, resets: 1e6, at: 2e5, stale: false } });
assert.deepEqual(M.planLimits(file, { at: 300, claude: { week: { used: 2, resets: 1000 } } }, 0).seven, { used: 2, resets: 1e6, at: 3e5, stale: false }, "the summary, newer");
assert.equal(M.planLimits(file, { at: 300, claude: { week: { used: 2, resets: 1000, at: 100 } } }, 0).seven.used, 20, "its week.at, older, loses");
assert.equal(M.planLimits(file, null, 2e6).seven.stale, true, "reset since it was read");
assert.deepEqual(M.planLimits('{"five_hour":{"used_percentage":7,"resets_at":50},"updated_at":10}', null, 0).five, { used: 7, resets: 5e4, at: 1e4, stale: false });
assert.equal(M.planLimits("{", {}, 0), null);

console.log("model.check: ok");
