// kt-hub's project view (#49): what the home page shows for one project, from summary.json (its days, its
// heat, the reports' recaps, the flows) and `gh pr list` (the week's PRs, with when they were merged).
// Pure, no import: project.check.mjs runs it under bun. Days are local "YYYY-MM-DD"; a week starts Monday.

const noon = (d) => {
  const [y, m, dd] = d.split("-").map(Number);
  return new Date(y, m - 1, dd, 12);
};
const localDay = (ms) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const shift = (day, n) => {
  const t = noon(day);
  return localDay(new Date(t.getFullYear(), t.getMonth(), t.getDate() + n, 12).getTime());
};
const between = (a, b) => Math.round((noon(b) - noon(a)) / 864e5);

/** The registry folder, or the summary's project, a folder belongs to (the longest on a path boundary). */
export function keyOf(folder, keys) {
  let best = null;
  for (const k of keys) if ((folder === k || folder?.startsWith(`${k}/`)) && (!best || k.length > best.length)) best = k;
  return best;
}

/** A project's week (`w`: model.js' week): sessions, agent seconds, prompts, linked PRs, against the same
 * days before; its launches ranked (the days' 5th element). */
export function projectWeek(p, w) {
  const sum = (from) => {
    const r = [0, 0, 0, 0];
    for (let i = 0; i < w.len; i++) (p?.days?.[shift(from, i)] ?? []).slice(0, 4).forEach((v, k) => (r[k] += v ?? 0));
    return r;
  };
  const launches = (from) => {
    const r = {};
    for (let i = 0; i < w.len; i++) for (const [n, c] of Object.entries(p?.days?.[shift(from, i)]?.[4] ?? {})) r[n] = (r[n] ?? 0) + c;
    return r;
  };
  const [now, before] = [sum(w.from), sum(shift(w.from, -7))];
  const [l, lp] = [launches(w.from), launches(shift(w.from, -7))];
  return {
    now: { s: now[0], a: now[1], p: now[2], pr: now[3] },
    before: { s: before[0], a: before[1], p: before[2], pr: before[3] },
    launches: Object.entries(l).map(([name, n]) => ({ name, n, prev: lp[name] ?? 0 })).sort((a, b) => b.n - a.n || (a.name < b.name ? -1 : 1)),
  };
}

/** A project's year for its heatmap: sessions per day from January 1st (the `heat` pairs), null before the
 * first day known and after today; `split`: the junction's index in it, -1 when it isn't in this year. */
export function projectYear(p, y, summary, today) {
  const start = `${y}-01-01`;
  const len = new Date(y, 1, 29).getDate() === 29 ? 366 : 365;
  const vals = Array(len).fill(0);
  for (const [i, n] of p?.heat?.[y] ?? []) if (i >= 0 && i < len) vals[i] = n;
  const first = summary?.first ?? start;
  const values = vals.map((v, i) => {
    const d = shift(start, i);
    return d > today || d < first ? null : v;
  });
  const split = summary?.junction?.startsWith(`${y}-`) ? between(start, summary.junction) : -1;
  return { start, values, split, active: values.filter((v) => v > 0).length, sessions: values.reduce((s, v) => s + (v ?? 0), 0) };
}

/** The years a project has sessions in, oldest first (this year always). */
export const projectYears = (p, today) => [...new Set([...Object.keys(p?.heat ?? {}).map(Number), Number(today.slice(0, 4))])].sort((a, b) => a - b);

/** `gh pr list --json number,title,state,isDraft,createdAt,mergedAt,url` and the reports' recaps -> the
 * week's PRs (opened or merged since Monday, or still open), newest first, each with its review and CI
 * when a report has them; and the week's counts: opened, merged, the median time to merge (ms). */
export function weekPrs(list, reports, slug, w) {
  const from = noon(w.from).getTime() - 12 * 3600e3; // Monday, 00:00
  const recaps = new Map((reports ?? []).filter((r) => r?.repo === slug && r.pr?.url).map((r) => [r.pr.url, r]));
  const rows = (Array.isArray(list) ? list : []).map((x) => {
    const created = Date.parse(x.createdAt) || 0;
    const merged = Date.parse(x.mergedAt) || 0;
    const r = recaps.get(x.url);
    return { n: x.number, title: x.title ?? "", state: x.state ?? null, draft: Boolean(x.isDraft), url: x.url, created, merged,
      review: r?.review ?? null, ci: r?.ci ?? null, lines: r?.lines ?? null };
  }).filter((x) => x.created >= from || x.merged >= from || x.state === "OPEN")
    .sort((a, b) => Math.max(b.created, b.merged) - Math.max(a.created, a.merged));
  const merged = rows.filter((x) => x.merged >= from);
  const waits = merged.map((x) => x.merged - x.created).filter((v) => v > 0).sort((a, b) => a - b);
  return { rows, opened: rows.filter((x) => x.created >= from).length, merged: merged.length, median: waits.length ? waits[Math.floor((waits.length - 1) / 2)] : null };
}

/** What the reviews and the CI caught this week in this repo (the reports generated since Monday): the
 * blocking findings found and fixed, the CI's failed and passed checks now, and the flows' attempts (their
 * review and CI iterations). */
export function weekChecks(reports, flows, slug, w) {
  const from = noon(w.from).getTime() - 12 * 3600e3;
  const rs = (reports ?? []).filter((r) => r?.repo === slug && r.at >= from);
  const fs = (flows ?? []).filter((f) => f?.repo === slug && (f.seen ?? 0) >= from);
  return {
    reports: rs.length,
    found: rs.reduce((s, r) => s + (r.review?.found ?? 0), 0),
    fixed: rs.reduce((s, r) => s + (r.review?.fixed ?? 0), 0),
    ciFail: rs.reduce((s, r) => s + (r.ci?.fail ?? 0), 0),
    ciOk: rs.reduce((s, r) => s + (r.ci?.ok ?? 0), 0),
    reviewRuns: fs.reduce((s, f) => s + (f.review ?? 0), 0),
    ciRuns: fs.reduce((s, f) => s + (f.ci ?? 0), 0),
  };
}

/** gh's arguments for a repo's PRs touched since a day (the week's, merged or opened, and the open ones). */
export const prListArgs = (slug, since) => ["pr", "list", "--repo", slug, "--state", "all", "--limit", "40",
  "--search", `updated:>=${since}`, "--json", "number,title,state,isDraft,createdAt,mergedAt,url"];
