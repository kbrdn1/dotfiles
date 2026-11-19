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

// The registry (kt.projects) of this computer, by folder.
const registryMap = (registry) => new Map((registry ?? []).filter((r) => r && !r.machine && r.folder).map((r) => [r.folder.replace(/\/+$/, ""), r]));

// Two days of a project: [sessions, agent seconds, prompts, PRs, { launches }], summed.
const addDay = (a = [], b = []) => {
  const n = [0, 1, 2, 3].map((k) => (a[k] ?? 0) + (b[k] ?? 0));
  const l = { ...(a[4] ?? {}) };
  for (const [name, c] of Object.entries(b[4] ?? {})) l[name] = (l[name] ?? 0) + c;
  return Object.keys(l).length ? [...n, l] : n;
};
// Two years of `heat` pairs ([day index, sessions]), summed by day.
const addHeat = (a = [], b = []) => {
  const m = new Map(a.map(([i, n]) => [i, n]));
  for (const [i, n] of b) m.set(i, (m.get(i) ?? 0) + n);
  return [...m].sort((x, y) => x[0] - y[0]);
};

/** #88: the summary with each former folder of a registry entry (kt.projects' `formerly`: k-hub, now
 * kbrdn-hub) folded into the entry's folder: days and heat summed, its last the latest; the entry's own
 * fields kept when it has some activity, else the former's. The same summary when there's nothing to fold;
 * never changed in place. Once per summary and registry. */
export function withFormer(summary, registry) {
  const projects = summary?.projects;
  const into = new Map();
  for (const [folder, e] of registryMap(registry)) for (const f of e.formerly ?? []) into.set(String(f).replace(/\/+$/, ""), folder);
  if (!projects || !Object.keys(projects).some((k) => into.has(k))) return summary;
  const out = Object.fromEntries(Object.entries(projects).filter(([k]) => !into.has(k)));
  for (const [k, p] of Object.entries(projects)) {
    const to = into.get(k);
    if (!to) continue;
    const q = out[to];
    if (!q) { out[to] = p; continue; }
    const days = { ...(q.days ?? {}) };
    for (const [d, v] of Object.entries(p.days ?? {})) days[d] = addDay(days[d], v);
    const heat = { ...(q.heat ?? {}) };
    for (const [y, v] of Object.entries(p.heat ?? {})) heat[y] = addHeat(heat[y], v);
    out[to] = { ...q, days, heat, last: Math.max(q.last ?? 0, p.last ?? 0) };
  }
  return { ...summary, projects: out };
}

/** #89: every project of the summary by its key: its kind, its name (the registry's, else its own), its
 * registry entry (color, logos, archived). */
export function projectIndex(projects, registry) {
  const reg = registryMap(registry);
  return new Map(Object.entries(projects ?? {}).map(([key, p]) => {
    const e = reg.get(key) ?? null;
    return [key, { key, kind: p.kind, name: e?.name ?? p.name, entry: e }];
  }));
}

/** The projects with activity in the last `n` weeks, this week's most active first: their week
 * (sessions, agent seconds, prompts, PRs), their sessions week by week (the sparkline), their last
 * activity, and their registry entry (kt.projects: color, logos) when the folder is one. */
export function projectRows(projects, registry, w, n = 8) {
  const reg = registryMap(registry);
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

// ---------- #89: Temps agent (after Apple's Screen Time) ----------

/** A week (Monday to Sunday) or a month (`kind`), `shift` periods before the one of `today`: its days,
 * and those passed (today included). */
export function period(kind, shift, today) {
  let from = dayShift(mondayOf(today), -7 * shift), n = 7;
  if (kind === "month") {
    const t = noon(today);
    const first = new Date(t.getFullYear(), t.getMonth() - shift, 1, 12);
    from = localDay(first.getTime());
    n = new Date(first.getFullYear(), first.getMonth() + 1, 0, 12).getDate();
  }
  const keys = Array.from({ length: n }, (_, i) => dayShift(from, i));
  return { kind, shift, keys, passed: keys.filter((k) => k <= today) };
}

/** A period's agent time, in seconds: its total and daily average over the days it counts (`use`), each
 * project's ([{ key, t }], most first). Before the junction a day holds only the sessions still on the disk
 * (Claude Code deleted the others): a period with days from the junction counts those (`cut` when it
 * starts before); one entirely before it counts its days as they are (`partial`). */
export function spent(summary, P) {
  const j = summary?.junction ?? "";
  const known = P.passed.filter((k) => k >= j), use = known.length ? known : P.passed;
  const total = use.reduce((s, k) => s + Math.round((summary?.days?.[k]?.a ?? 0) / 1000), 0);
  const by = Object.entries(summary?.projects ?? {}).map(([key, p]) => ({ key, t: use.reduce((s, k) => s + (p.days?.[k]?.[1] ?? 0), 0) }))
    .filter((x) => x.t > 0).sort((a, b) => b.t - a.t || (a.key < b.key ? -1 : 1));
  return { total, avg: use.length ? total / use.length : 0, by, use, known: known.length, cut: known.length > 0 && P.keys[0] < j, partial: !known.length && P.passed.length > 0 };
}

/** The daily average's change against the period before, in percent; null when that one counts fewer than
 * 3 days from the junction, or either is empty. */
export const spentDelta = (cur, before) => (before.known >= 3 && before.avg > 0 && cur.avg > 0 ? Math.round(((cur.avg - before.avg) / before.avg) * 100) : null);

/** The chart's days: for each day of the period, its agent time (s) by the `top` projects' keys (k "p0"..),
 * then the rest ("o"); a day to come, []. */
export function stacks(summary, P, today, top) {
  return P.keys.map((d) => {
    if (d > today) return [];
    const segs = top.map((key, i) => ({ k: `p${i}`, v: summary?.projects?.[key]?.days?.[d]?.[1] ?? 0 }));
    const all = Math.round((summary?.days?.[d]?.a ?? 0) / 1000);
    return [...segs, { k: "o", v: Math.max(0, all - segs.reduce((s, x) => s + x.v, 0)) }];
  });
}

/** A day field's counts over `keys` ("l": launches, "mo": messages by model): [[name, n]], most first. */
export function periodCounts(days, keys, field) {
  const r = {};
  for (const k of keys) for (const [n, c] of Object.entries(days?.[k]?.[field] ?? {})) r[n] = (r[n] ?? 0) + c;
  return Object.entries(r).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1));
}

/** The plan's limits as the bottom bar's peek reads them (kt-threads' usagePeek): the 7 day window from the
 * newer reading of the statusLine's herdr-quota.json (`text`, its updated_at) and kt-usage's summary (shared
 * "kt.usage.summary": its week.at, else its at), the 5 h one from the statusLine (only when Claude Code
 * reports one). Each window: its part used (%), when it resets (ms), when it was read (ms), `stale` when its
 * reset has passed since (kt-usage's rule: no number then). null when neither source has a window. */
export function planLimits(text, summary, nowMs) {
  let q = null;
  try { q = JSON.parse(text ?? ""); } catch {}
  const qAt = (Number(q?.updated_at) || 0) * 1000;
  const win = (used, resets, at) => (Number.isFinite(used) ? { used: Math.round(used), resets: (Number(resets) || 0) * 1000, at, stale: (Number(resets) || 0) * 1000 <= nowMs } : null);
  const w = summary?.claude?.week, sAt = (Number(w?.at ?? summary?.at) || 0) * 1000;
  const fromSum = Number.isFinite(w?.used) && sAt >= qAt;
  const seven = fromSum ? win(w.used, w.resets, sAt) : win(q?.seven_day?.used_percentage, q?.seven_day?.resets_at, qAt);
  const five = win(q?.five_hour?.used_percentage, q?.five_hour?.resets_at, qAt);
  return seven || five ? { five, seven } : null;
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
