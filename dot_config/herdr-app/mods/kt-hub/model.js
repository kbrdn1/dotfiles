// kt-hub's model: summary.json (index.ts) into what the home page draws. Pure, no import: the page
// derives it once per summary (and when the day changes), never in render; model.check.mjs runs it
// under bun. Days are local "YYYY-MM-DD" strings; a week starts on Monday.

export const sum = (c) => Object.values(c ?? {}).reduce((s, v) => s + (Number(v) || 0), 0);

export function localDay(ms) {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
const noon = (day) => {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d, 12);
};
export const dayShift = (day, n) => {
  const t = noon(day);
  return localDay(new Date(t.getFullYear(), t.getMonth(), t.getDate() + n, 12).getTime());
};
export const daysBetween = (a, b) => Math.round((noon(b) - noon(a)) / 864e5);
export const mondayOf = (day) => dayShift(day, -((noon(day).getDay() + 6) % 7));

// A day's figure: sessions and prompts are kept by origin (cli, mono, sdk, hist), sub-agents by type.
const METRIC = {
  s: (b) => sum(b.s), // active sessions, summed per day (a session three days running counts three)
  p: (b) => sum(b.p),
  a: (b) => b.a ?? 0, // agent time, ms (gaps under 5 min, sub-agents included)
  sub: (b) => sum(b.sub),
  pr: (b) => b.pr ?? 0, // PRs first linked that day
  mg: (b) => b.mg ?? 0, // `gh pr merge` run
};
export const METRICS = Object.keys(METRIC);

function totals(days, from, n) {
  const r = Object.fromEntries(METRICS.map((k) => [k, 0]));
  for (let i = 0; i < n; i++) {
    const b = days?.[dayShift(from, i)];
    if (b) for (const k of METRICS) r[k] += METRIC[k](b);
  }
  return r;
}

/** This week so far (Monday to today) against the same days of the week before, and `n` weeks of each
 * figure for the trends (the last one is this week so far). */
export function week(days, today, n = 8) {
  const from = mondayOf(today);
  const len = daysBetween(from, today) + 1;
  return {
    from,
    len,
    now: totals(days, from, len),
    before: totals(days, dayShift(from, -7), len),
    trend: Array.from({ length: n }, (_, i) => totals(days, dayShift(from, -7 * (n - 1 - i)), i === n - 1 ? len : 7)),
  };
}

/** A change in percent, rounded; null without a base. */
export const delta = (now, before) => (before > 0 ? Math.round(((now - before) / before) * 100) : null);

// Launches by family: the workflows (issue to PR, sprint, dispatch, release, merge), the loops, Claude
// Code's own commands, and the other skills.
const WORKFLOW = /^me:(issue-|spec-issue-|goal$|dispatch$|release$|merge$)/;
const BUILTIN = new Set(["add-dir", "agents", "bashes", "clear", "compact", "config", "context", "cost", "doctor", "effort", "exit", "export",
  "fast", "feedback", "help", "hooks", "ide", "init", "login", "logout", "mcp", "memory", "model", "output-style", "permissions", "plugin",
  "plugins", "privacy-settings", "release-notes", "reload-plugins", "resume", "rewind", "status", "statusline", "terminal-setup", "theme",
  "todos", "upgrade", "usage", "vim"]);
export const familyOf = (name) => (/^me:loop:/.test(name) ? "loop" : WORKFLOW.test(name) ? "workflow" : BUILTIN.has(name) ? "command" : "skill");

function counts(days, from, n, field) {
  const r = {};
  for (let i = 0; i < n; i++) for (const [k, v] of Object.entries(days?.[dayShift(from, i)]?.[field] ?? {})) r[k] = (r[k] ?? 0) + v;
  return r;
}

/** A week's launches (field "l") or sub-agents by type ("sub"): [{ name, n, prev, family }], most first,
 * with the same days of the week before. */
export function ranked(days, w, field) {
  const now = counts(days, w.from, w.len, field);
  const prev = counts(days, dayShift(w.from, -7), w.len, field);
  return Object.entries(now).map(([name, n]) => ({ name, n, prev: prev[name] ?? 0, family: field === "l" ? familyOf(name) : null }))
    .sort((a, b) => b.n - a.n || (a.name < b.name ? -1 : 1));
}

/** The projects with activity in the last `n` weeks, this week's most active first: their week
 * (sessions, agent seconds, prompts, PRs), their sessions week by week (the sparkline), their last
 * activity, and their registry entry (kt.projects: color, logos) when the folder is one. */
export function projectRows(projects, registry, w, n = 8) {
  const reg = new Map((registry ?? []).filter((r) => r && !r.machine && r.folder).map((r) => [r.folder.replace(/\/+$/, ""), r]));
  const rows = [];
  for (const [key, p] of Object.entries(projects ?? {})) {
    const at = (d) => p.days?.[d] ?? [0, 0, 0, 0];
    const wk = [0, 0, 0, 0];
    for (let i = 0; i < w.len; i++) at(dayShift(w.from, i)).forEach((v, k) => (wk[k] += v));
    const spark = Array.from({ length: n }, (_, i) => {
      const from = dayShift(w.from, -7 * (n - 1 - i));
      let s = 0;
      for (let j = 0; j < 7; j++) s += at(dayShift(from, j))[0];
      return s;
    });
    if (!spark.some((v) => v > 0)) continue;
    const e = reg.get(key) ?? null;
    rows.push({ key, kind: p.kind, name: e?.name ?? p.name, slug: p.slug ?? null, entry: e, s: wk[0], a: wk[1], p: wk[2], pr: wk[3], spark, last: p.last ?? 0 });
  }
  return rows.sort((x, y) => y.s - x.s || y.a - x.a || y.last - x.last);
}

/** A year of the heatmap: sessions per day from January 1st, null before the first day known and after
 * today (no square); `split`, the junction's index in it (the two sides count differently: their
 * quartiles are their own), -1 when the whole year is on one side. */
export function year(summary, y, today) {
  const values = summary?.years?.[y];
  if (!values) return null;
  const start = `${y}-01-01`;
  const first = summary.first ?? start;
  const vals = values.map((v, i) => {
    const d = dayShift(start, i);
    return d > today || d < first ? null : v;
  });
  const j = summary.junction?.startsWith(`${y}-`) ? daysBetween(start, summary.junction) : -1;
  return { start, values: vals, split: j, active: vals.filter((v) => v > 0).length, sessions: vals.reduce((s, v) => s + (v ?? 0), 0) };
}

export const years = (summary) => Object.keys(summary?.years ?? {}).map(Number).sort((a, b) => a - b);

/** Now, from the live agents: how many work, wait for you, finished unseen; the one to go to first
 * (blocked, else done, else working). */
export function now(agents) {
  const by = (s) => (agents ?? []).filter((a) => a.status === s);
  const go = by("blocked")[0] ?? by("done")[0] ?? by("working")[0] ?? null;
  return { working: by("working").length, blocked: by("blocked").length, done: by("done").length, go };
}

/** An agent's machine, from its address: "vps/t3" is vps's, a bare "t3" this computer's (null). */
export const machineOf = (address) => (String(address ?? "").includes("/") ? String(address).split("/")[0] : null);

/** #66: Now by machine: this computer first, then `names` (the other machines, in their order), each with
 * now() of its agents; an agent of a machine not named still gets its row. */
export function byMachine(agents, names = []) {
  const groups = new Map([[null, []], ...names.map((n) => [n, []])]);
  for (const a of agents ?? []) {
    const m = machineOf(a.address);
    if (!groups.has(m)) groups.set(m, []);
    groups.get(m).push(a);
  }
  return [...groups].map(([name, list]) => ({ name, total: list.length, ...now(list) }));
}
