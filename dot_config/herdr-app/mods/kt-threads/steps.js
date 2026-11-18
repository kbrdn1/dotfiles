// What Flow makes of claude-flow's steps (pure, no imports: `node mods/kt-flow/steps.test.mjs`):
// the workflow's readable name, the steps grouped in phases, and each label's detail as
// pieces to draw (claude-flow's herdrLabel: "<name> <detail>", or the detail alone for
// pin, commits, push, pr and issue-closed).

import words from "./steps.strings.js";

// Its words (I18N.md): French here (node, the check), the shown language once main.js has called
// speak(makeT) with i18n.js' (this file stays pure: no herdr import).
const fr = (k, v = {}) => {
  const s = words.fr[k];
  return String(typeof s === "object" ? (v.n < 2 ? s.one : s.other) : s ?? "").replace(/\{(\w+)\}/g, (_, x) => v[x] ?? "");
};
let tr = fr;
export const speak = (makeT) => { tr = makeT(words); };

// claude-flow's own step names, as they start a label.
const RAW = {
  issue: "issue", branch: "branch", worktree: "worktree", pin: "pin", spec: "spec", plan: "plan", tasks: "tasks",
  implement: "implement", commits: "commits", docs: "docs", push: "push", pr: "pr", review: "review", ci: "ci",
  merge: "merge", "issue-closed": "issue closed", note: "note", // i18n: tech
};

/** A step's shown name (its id when it's not one of claude-flow's). */
export const nameOf = (id) => (id in RAW ? tr(`name.${id}`) : id);

// A phase's label is read when drawn (phasesOf spreads it): the language shown then.
const phase = (id, steps) => ({ id, get label() { return tr(`phase.${id}`); }, steps });
export const PHASES = [
  phase("prep", ["issue", "branch", "worktree", "pin"]),
  phase("spec", ["spec", "plan", "tasks"]),
  phase("impl", ["implement", "commits", "docs"]),
  phase("ship", ["push", "pr", "review", "ci"]),
  phase("close", ["merge", "issue-closed", "note"]),
];

/** `me:spec-issue-worktree-pr` -> "Spec · Issue → Worktree → PR". */
export function workflowName(w) {
  if (!w) return "Flow";
  let s = String(w).replace(/^me:/, "");
  const spec = s.startsWith("spec-");
  if (spec) s = s.slice(5);
  const WORDS = ["issue", "worktree", "branch", "pr", "goal", "release"];
  const name = s.split("-").map((p) => (WORDS.includes(p) ? tr(`wf.${p}`) : p)).join(" → ");
  return spec ? tr("wf.spec", { name }) : name;
}

/** The issue of a `<type>/#N-slug` branch, else null. */
export const issueOf = (branch) => String(branch ?? "").match(/^[\w.-]+\/#(\d+)(?:-|$)/)?.[1] ?? null;

/**
 * The branch the flow works on: its `branch` step's, else its `worktree` step's folder name (gwm
 * names it after the branch, `feat/#61-x` -> `feat-61-x`: /me:report's folder for it), else null.
 * A step still pending (its bare name) or missing gives nothing.
 */
export function flowBranch(steps) {
  const word = (id) => {
    const s = (Array.isArray(steps) ? steps : []).find((x) => x?.id === id);
    return s ? rest(s).trim().split(/\s+/)[0] || null : null;
  };
  return word("branch") ?? word("worktree")?.split("/").filter(Boolean).pop() ?? null;
}

/** The step's phases, empty ones left out; unknown steps go last under "Autres". */
export function phasesOf(steps) {
  const known = new Set(PHASES.flatMap((p) => p.steps));
  const groups = PHASES.map((p) => ({ ...p, steps: steps.filter((s) => p.steps.includes(s.id)) }));
  const other = steps.filter((s) => !known.has(s.id));
  if (other.length) groups.push({ id: "other", label: tr("phase.other"), steps: other });
  return groups.filter((g) => g.steps.length).map((g) => ({
    ...g,
    done: g.steps.filter((s) => s.state === "done").length,
    total: g.steps.length,
    current: g.steps.some((s) => s.state === "current"),
    failed: g.steps.some((s) => s.state === "failed"),
  }));
}

// The label without the step's own name.
function rest(step) {
  const label = String(step.label ?? ""), raw = RAW[step.id];
  if (raw && label === raw) return "";
  if (raw && label.startsWith(`${raw} `)) return label.slice(raw.length + 1);
  return label;
}

/**
 * The label's detail as pieces: { text, tone?: "ok" | "err" | "dim", mono?, pr? (a number) }.
 */
export function details(step) {
  const r = rest(step);
  const frac = r.match(/\d+\/\d+/g) ?? [];
  const full = (f) => { const [a, b] = f.split("/").map(Number); return a === b; };
  switch (step.id) {
    case "implement": {
      const out = [];
      const e = r.match(/(\d+) edits?/);
      if (e) out.push({ text: tr("edits", { n: +e[1] }) });
      const add = r.match(/\+(\d+)/), del = r.match(/(?:^|\s)-(\d+)/);
      if (add && +add[1]) out.push({ text: `+${add[1]}`, tone: "ok", mono: true });
      if (del && +del[1]) out.push({ text: `−${del[1]}`, tone: "err", mono: true });
      return out;
    }
    case "review": {
      const out = frac[0] ? [{ text: tr("pass", { f: frac[0] }) }] : [];
      const b = r.match(/P0P1P2=(\d+)/);
      if (b) out.push({ text: tr("blockers", { n: +b[1] }), tone: +b[1] ? "err" : "ok" });
      if (/spec skipped/.test(r)) out.push({ text: tr("specSkipped"), tone: "dim" });
      return out;
    }
    case "ci": {
      if (frac.length >= 2) return [{ text: tr("pass", { f: frac[0] }) }, { text: tr("checks", { f: frac[1] }), tone: full(frac[1]) ? "ok" : "err" }];
      return frac.length ? [{ text: tr("checks", { f: frac[0] }), tone: full(frac[0]) ? "ok" : "err" }] : [];
    }
    case "pr": {
      const n = r.match(/#(\d+)/)?.[1];
      return n ? [{ text: `#${n}`, pr: +n, mono: true }] : [];
    }
    case "commits": {
      const n = r.match(/(\d+) commits?/)?.[1];
      return n ? [{ text: n, mono: true }] : [];
    }
    case "pin":
    case "push":
      return [];
    case "merge":
      return r && r !== "merged" ? [{ text: r, mono: true }] : [];
    case "issue":
    case "issue-closed": {
      const n = r.match(/#(\d+)/)?.[1];
      return n ? [{ text: `#${n}`, mono: true }] : [];
    }
    default:
      return r ? [{ text: r, mono: true }] : [];
  }
}

/**
 * The /me:report --plan plans covering `issue`: each `<dir>/<slug>/notes.json` whose `issues[].n`
 * holds it, as { slug, title, path (its index.html) }. `dirs`: the plan folders to look in
 * (`<Reports>/<owner>-<repo>/plans`, `<Reports>/_plans`); `list(dir)` and `read(path)` reach the disk.
 */
export async function findPlans(dirs, issue, list, read) {
  if (!issue) return [];
  const out = [];
  for (const dir of dirs) {
    for (const slug of await list(dir)) {
      let notes = null;
      try { notes = JSON.parse((await read(`${dir}/${slug}/notes.json`)) ?? "null"); } catch { notes = null; }
      if (Array.isArray(notes?.issues) && notes.issues.some((i) => Number(i?.n) === Number(issue)))
        out.push({ slug, title: String(notes.title ?? slug), path: `${dir}/${slug}/index.html` });
    }
  }
  return out;
}

// ---------- review passes (/me:report facts.review) ----------

/**
 * One pass: its counts, which axes ran ("ok"; anything else never counts as zero), and
 * `clean`: no P0..P2 with both axes run. { p0, p1, p2, p3, blockers, std, spec, clean }.
 */
export function passOf(p) {
  const std = p?.standards?.state === "ok", spec = p?.spec?.state === "ok";
  const n = (k) => (std ? p.standards[k] ?? 0 : 0) + (spec ? p.spec[k] ?? 0 : 0);
  const c = std || spec ? { p0: n("p0"), p1: n("p1"), p2: n("p2"), p3: n("p3") } : { p0: p?.p0 ?? 0, p1: p?.p1 ?? 0, p2: p?.p2 ?? 0, p3: p?.p3 ?? 0 };
  const blockers = c.p0 + c.p1 + c.p2;
  return { ...c, blockers, std, spec, clean: std && spec && blockers === 0 };
}

/** A finding's decision (review/decisions.tsv): { text, tone: ok | dim | warn }. */
export function decisionOf(f) {
  const s = String(f?.status ?? "").toLowerCase();
  if (s === "fixed") return { text: f.ref ? tr("fixedRef", { ref: String(f.ref).slice(0, 7) }) : tr("fixed"), tone: "ok" };
  if (["wontfix", "discarded", "rejected", "skipped", "invalid"].includes(s)) return { text: s === "wontfix" ? "wontfix" : tr("dropped"), tone: "dim" }; // i18n: tech
  return { text: tr("open"), tone: "warn" };
}

/** A finding's `loc` as "path:line" (the first location; "(idem …)" dropped), null without one. */
export const locOf = (loc) => String(loc ?? "").trim().split(/\s+\(|\s+/)[0] || null;

// ---------- CI (GitHub's check runs, per pushed commit) ----------

const RANK = { fail: 0, pending: 1, ok: 2, skip: 3 };

/** A check run's state: "pending" until completed, then "ok" (success), "skip" (neutral, skipped) or "fail". */
export function checkState(r) {
  if (r?.status !== "completed") return "pending";
  if (r.conclusion === "success") return "ok";
  return r.conclusion === "neutral" || r.conclusion === "skipped" ? "skip" : "fail";
}

/** A check's time, start to end (null while it runs or without times). */
export const checkMs = (r) => {
  const s = Date.parse(r?.started_at ?? ""), e = Date.parse(r?.completed_at ?? "");
  return s && e ? Math.max(0, e - s) : null;
};

/** A commit's checks counted: { ok (skipped ones too: nothing failed), fail, pending, total, ms: first start to last end, null while any runs }. */
export function tally(runs) {
  const n = { ok: 0, fail: 0, pending: 0, total: (runs ?? []).length, ms: null };
  let a = Infinity, b = -Infinity;
  for (const r of runs ?? []) {
    const st = checkState(r);
    n[st === "skip" ? "ok" : st]++;
    const s = Date.parse(r.started_at ?? ""), e = Date.parse(r.completed_at ?? "");
    if (s) a = Math.min(a, s);
    if (e) b = Math.max(b, e);
  }
  if (!n.pending && a < Infinity && b > -Infinity) n.ms = Math.max(0, b - a);
  return n;
}

/** The checks to list: failures first, then running, passed, skipped; by name within. */
export const checkOrder = (runs) => [...(runs ?? [])].sort((x, y) => RANK[checkState(x)] - RANK[checkState(y)] || String(x.name).localeCompare(String(y.name)));

/** "42 s", "3 min 05", "1 h 02"; "" without a time. */
export function duration(ms) {
  if (ms == null || !Number.isFinite(ms)) return "";
  const s = Math.round(ms / 1000);
  if (s < 60) return tr("dur.s", { s });
  const m = Math.floor(s / 60);
  return m < 60 ? tr("dur.m", { m, s: String(s % 60).padStart(2, "0") }) : tr("dur.h", { h: Math.floor(m / 60), m: String(m % 60).padStart(2, "0") });
}

/** The GitHub Actions run of a check (from its html_url, else details_url), null for another app's: only runs have logs. */
export const runIdOf = (r) => [r?.html_url, r?.details_url].map((u) => String(u ?? "").match(/\/actions\/runs\/(\d+)/)?.[1]).find(Boolean) ?? null;

/** The last `n` lines of `gh run view --log-failed` for the job `name` (every job's when none matches), without the job and step columns, timestamps or colors. */
export function logTail(text, name, n = 40) {
  const rows = String(text ?? "").replace(/\x1b\[[0-9;]*m/g, "").split("\n").filter((l) => l.trim()).map((l) => l.split("\t"));
  const mine = rows.filter((p) => p[0] === name);
  return (mine.length ? mine : rows)
    .map((p) => (p.length > 2 ? p.slice(2).join("\t") : p.join("\t")).replace(/^﻿?\d{4}-\d\d-\d\dT[\d:.]+Z ?/, ""))
    .slice(-n);
}

/** The CI's line over the pushed commits (oldest first, each { sha, tally }): "3 runs · 9/9 checks · vert depuis abc1234". */
export function ciLine(pushed) {
  if (!pushed?.length) return tr("noRun");
  const green = (t) => t.total > 0 && !t.fail && !t.pending;
  const last = pushed.at(-1).tally;
  let i = pushed.length;
  while (i > 0 && green(pushed[i - 1].tally)) i--;
  const state = green(last) ? tr("greenSince", { sha: pushed[i].sha.slice(0, 7) }) : last.fail ? tr("failing", { n: last.fail }) : last.pending ? tr("running", { n: last.pending }) : tr("noCheck");
  return tr("ci", { n: pushed.length, ok: last.ok, total: last.total, state });
}

/** What's running, in one line: each current step's label up to its first " · ". */
export const runningLine = (steps) => steps.filter((s) => s.state === "current").map((s) => String(s.label ?? s.id).split(" · ")[0]).join(" · ");
