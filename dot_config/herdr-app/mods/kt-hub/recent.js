// kt-hub's flows, Next and Recent (#50): the claude-flow flows the indexer archives (summary.flows), the
// plans of /me:report --plan (summary.plans), the merges, the vault's notes (summary.notes), the sessions
// (summary.sessions) and `gwm history --all`. Pure, no import: recent.check.mjs runs it under bun.

// A flow's steps in order, as claude-flow's store keeps them; the path shown is the part a task walks.
export const STEPS = ["issue", "branch", "worktree", "pin", "spec", "plan", "tasks", "implement", "commits", "docs", "push", "pr", "review", "ci", "merge", "issue-closed", "note"];
export const PATH = ["issue", "worktree", "implement", "pr", "review", "ci", "merge", "note"];

/** Where a flow is: its last step done (`reached`), the next one to do after it (`next`), whether it
 * merged and has its note. */
export function stage(f) {
  const st = f?.steps ?? {};
  let last = -1;
  STEPS.forEach((s, i) => { if (st[s] === "done") last = i; });
  const active = STEPS.find((s) => st[s] === "active") ?? null;
  const next = active ?? STEPS.slice(last + 1).find((s) => st[s] === "pending") ?? null;
  return { reached: last >= 0 ? STEPS[last] : null, next, merged: st.merge === "done", noted: st.note === "done" };
}

/** A flow's path for viz.steps: done, current (running now), skipped (left behind a later step done), todo. */
export function path(f) {
  const st = f?.steps ?? {};
  const lastDone = Math.max(-1, ...PATH.map((s, i) => (st[s] === "done" ? i : -1)));
  return PATH.map((s, i) => ({ id: s, state: st[s] === "done" ? "done" : st[s] === "active" ? "current" : i < lastDone ? "skipped" : "todo" }));
}

/** The flows seen since `since`, by workflow: how many, merged, noted, and the open ones by the step
 * they reached. */
export function byWorkflow(flows, since) {
  const out = new Map();
  for (const f of flows ?? []) {
    if ((f?.seen ?? 0) < since) continue;
    const g = out.get(f.workflow ?? "") ?? { workflow: f.workflow ?? null, total: 0, merged: 0, noted: 0, open: {} };
    const s = stage(f);
    g.total++;
    if (s.merged) g.merged++;
    if (s.noted) g.noted++;
    if (!s.merged && s.reached) g.open[s.reached] = (g.open[s.reached] ?? 0) + 1;
    out.set(f.workflow ?? "", g);
  }
  return [...out.values()].sort((a, b) => b.total - a.total);
}

/** Next: the open flows (not merged) seen since `since`, the step that comes, the latest first. */
export function nextFlows(flows, since) {
  return (flows ?? []).filter((f) => (f?.seen ?? 0) >= since && !stage(f).merged)
    .map((f) => ({ key: f.key, repo: f.repo, issue: f.issue ?? null, pr: f.pr ?? null, workflow: f.workflow ?? null, next: stage(f).next, seen: f.seen }))
    .sort((a, b) => b.seen - a.seen);
}

/** Next: a plan's issues still to do whose dependencies are done (or closed). */
export function nextPlanIssues(plans) {
  const out = [];
  for (const p of plans ?? []) {
    const issues = p?.issues ?? [];
    const done = new Set(issues.filter((i) => i.status === "done" || i.state === "CLOSED").map((i) => i.n));
    for (const i of issues) {
      if (i.status === "done" || i.state !== "OPEN" || i.status === "blocked") continue;
      if ((i.deps ?? []).every((d) => done.has(Number(d)))) out.push({ plan: p.plan, repo: p.repo, n: i.n, title: i.title ?? "", url: i.url ?? null, pr: i.pr ?? null });
    }
  }
  return out;
}

/** Recent: the merges since `since`, from the flows (when their merge was seen done) and the reports (a
 * merged PR), once each, the latest first. */
export function recentMerges(flows, reports, since) {
  const seen = new Map();
  for (const f of flows ?? []) {
    const at = f?.doneAt?.merge;
    if (at && at >= since && f.repo && f.pr) seen.set(`${f.repo}#${f.pr}`, { repo: f.repo, pr: f.pr, issue: f.issue ?? null, title: null, at });
  }
  for (const r of reports ?? []) {
    if (r?.pr?.state !== "MERGED" || !r.pr.n || (r.at ?? 0) < since) continue;
    const k = `${r.repo}#${r.pr.n}`;
    const was = seen.get(k);
    seen.set(k, { repo: r.repo, pr: r.pr.n, issue: was?.issue ?? r.issue ?? null, title: r.pr.title ?? null, at: was?.at ?? r.at });
  }
  return [...seen.values()].sort((a, b) => b.at - a.at);
}

/** `gwm history --all`: one line per removal, newest first ("11h    remove   feat-1-x") -> [{ age, kind, name }]. */
export function parseHistory(text) {
  return String(text ?? "").split("\n").map((l) => /^\s*(\S+)\s+(\S+)\s+(.+?)\s*$/.exec(l)).filter(Boolean)
    .map(([, age, kind, name]) => ({ age, kind, name }));
}
