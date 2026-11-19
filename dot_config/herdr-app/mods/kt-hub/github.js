// kt-hub's GitHub year (#48): the contributions calendar of `gh api graphql` (contributionsCollection, one
// request per year shown, ~2 s), kept in data/kt-hub/github-<year>.json by the page. Pure, no import: the
// page runs `gh` and writes the cache; github.check.mjs runs this under bun.

// i18n: tech
export const QUERY = "query($from: DateTime!, $to: DateTime!) { viewer { contributionsCollection(from: $from, to: $to) "
  // i18n: tech
  + "{ restrictedContributionsCount contributionCalendar { totalContributions weeks { contributionDays { date contributionCount contributionLevel } } } } } }";

/** gh's arguments for a year's calendar. */
export const ghArgs = (y) => ["api", "graphql", "-f", `query=${QUERY}`, "-f", `from=${y}-01-01T00:00:00Z`, "-f", `to=${y}-12-31T23:59:59Z`];

const LEVEL = { NONE: 0, FIRST_QUARTILE: 1, SECOND_QUARTILE: 2, THIRD_QUARTILE: 3, FOURTH_QUARTILE: 4 };
const noon = (d) => {
  const [y, m, dd] = d.split("-").map(Number);
  return new Date(y, m - 1, dd, 12).getTime();
};
const index = (y, d) => Math.round((noon(d) - noon(`${y}-01-01`)) / 864e5);
const length = (y) => (new Date(y, 1, 29).getDate() === 29 ? 366 : 365);

/** gh's answer -> the cache: per day from January 1st its count and GitHub's own level (0..4). null when
 * the answer isn't one (an error, another shape). */
export function parseYear(text, y, at) {
  let o;
  try { o = JSON.parse(text); } catch { return null; }
  const c = o?.data?.viewer?.contributionsCollection;
  const weeks = c?.contributionCalendar?.weeks;
  if (!Array.isArray(weeks)) return null;
  const counts = Array(length(y)).fill(0);
  const levels = Array(length(y)).fill(0);
  for (const w of weeks) for (const d of w?.contributionDays ?? []) {
    if (!String(d?.date ?? "").startsWith(`${y}-`)) continue;
    const i = index(y, d.date);
    if (i < 0 || i >= counts.length) continue;
    counts[i] = Number(d.contributionCount) || 0;
    levels[i] = LEVEL[d.contributionLevel] ?? (counts[i] ? 1 : 0);
  }
  return { v: 1, year: y, at, total: Number(c.contributionCalendar.totalContributions) || 0, restricted: Number(c.restrictedContributionsCount) || 0, counts, levels };
}

/** Whether a year's cache needs gh again: none yet, the year now after an hour, a past year after a day
 * (it can still change: a repo made public, a late push). */
export function stale(cache, y, now) {
  if (!cache?.at) return true;
  const thisYear = new Date(now).getFullYear();
  return now - cache.at > (y >= thisYear ? 3600e3 : 86400e3);
}

/** The year to draw: its days from January 1st, nothing after today (no square). */
export function githubYear(cache, today) {
  if (!cache?.counts) return null;
  const y = cache.year;
  const t = index(y, today);
  const values = cache.counts.map((v, i) => (i > t ? null : v));
  return { start: `${y}-01-01`, values, levels: cache.levels.map((v, i) => (i > t ? null : v)), total: cache.total, restricted: cache.restricted,
    active: values.filter((v) => v > 0).length };
}
