// bun ~/.config/herdr-app/mods/kt-hub/github.check.mjs: the GitHub year (github.js): gh's answer to the
// cache (a day at its index, GitHub's levels, the totals), a broken answer, when to ask again, the year to
// draw (nothing after today). A synthetic answer, no real account.
process.env.TZ = "Europe/Paris";
import assert from "node:assert/strict";
const G = await import("./github.js");

const args = G.ghArgs(2026);
assert.deepEqual(args.slice(0, 2), ["api", "graphql"]);
assert.ok(args.includes("from=2026-01-01T00:00:00Z") && args.includes("to=2026-12-31T23:59:59Z"));
assert.ok(args.some((a) => a.startsWith("query=") && a.includes("contributionCalendar")));

const day = (date, n, level) => ({ date, contributionCount: n, contributionLevel: level });
const answer = JSON.stringify({ data: { viewer: { contributionsCollection: { restrictedContributionsCount: 7, contributionCalendar: { totalContributions: 42, weeks: [
  { contributionDays: [day("2025-12-29", 9, "FOURTH_QUARTILE"), day("2026-01-01", 3, "SECOND_QUARTILE")] },
  { contributionDays: [day("2026-11-19", 5, "THIRD_QUARTILE"), day("2026-12-31", 0, "NONE")] },
] } } } } });
const c = G.parseYear(answer, 2026, 1000);
assert.equal(c.counts.length, 365);
assert.deepEqual([c.counts[0], c.levels[0]], [3, 2], "January 1st");
assert.deepEqual([c.counts[322], c.levels[322]], [5, 3], "2026-11-19 is day 323");
assert.equal(c.counts.reduce((s, v) => s + v, 0), 8, "the previous year's days left out");
assert.deepEqual([c.total, c.restricted, c.at, c.year], [42, 7, 1000, 2026]);
assert.equal(G.parseYear("{\"message\":\"Bad credentials\"}", 2026, 1), null);
assert.equal(G.parseYear("pas du json", 2026, 1), null);
assert.equal(G.parseYear(answer, 2024, 1).counts.length, 366, "a leap year");

const now = Date.parse("2026-11-19T12:00:00Z");
assert.equal(G.stale(null, 2026, now), true);
assert.equal(G.stale({ at: now - 30 * 60e3 }, 2026, now), false, "this year, half an hour old");
assert.equal(G.stale({ at: now - 2 * 3600e3 }, 2026, now), true, "this year, two hours old");
assert.equal(G.stale({ at: now - 2 * 3600e3 }, 2025, now), false, "a past year, two hours old");
assert.equal(G.stale({ at: now - 2 * 86400e3 }, 2025, now), true);

const y = G.githubYear(c, "2026-11-19");
assert.equal(y.values[322], 5);
assert.equal(y.values[323], null, "tomorrow: no square");
assert.equal(y.levels[364], null);
assert.deepEqual([y.start, y.total, y.restricted, y.active], ["2026-01-01", 42, 7, 2]);
assert.equal(G.githubYear(null, "2026-11-19"), null);

console.log("github.check: ok");
