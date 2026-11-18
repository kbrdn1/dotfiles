// What Flow makes of claude-flow's steps (pure, no imports: `node mods/kt-flow/steps.test.mjs`):
// the workflow's readable name, the steps grouped in phases, and each label's detail as
// pieces to draw (claude-flow's herdrLabel: "<name> <detail>", or the detail alone for
// pin, commits, push, pr and issue-closed).

// claude-flow's own step names, as they start a label.
const RAW = {
  issue: "issue", branch: "branch", worktree: "worktree", pin: "pin", spec: "spec", plan: "plan", tasks: "tasks",
  implement: "implement", commits: "commits", docs: "docs", push: "push", pr: "pr", review: "review", ci: "ci",
  merge: "merge", "issue-closed": "issue closed", note: "note",
};

export const NAMES = {
  issue: "Issue", branch: "Branche", worktree: "Worktree", pin: "Pin", spec: "Spec", plan: "Plan", tasks: "Tâches",
  implement: "Implémentation", commits: "Commits", docs: "Docs", push: "Push", pr: "PR", review: "Review", ci: "CI",
  merge: "Merge", "issue-closed": "Issue fermée", note: "Note",
};

export const PHASES = [
  { id: "prep", label: "Préparation", steps: ["issue", "branch", "worktree", "pin"] },
  { id: "spec", label: "Spec", steps: ["spec", "plan", "tasks"] },
  { id: "impl", label: "Implémentation", steps: ["implement", "commits", "docs"] },
  { id: "ship", label: "Livraison", steps: ["push", "pr", "review", "ci"] },
  { id: "close", label: "Clôture", steps: ["merge", "issue-closed", "note"] },
];

/** `me:spec-issue-worktree-pr` -> "Spec · Issue → Worktree → PR". */
export function workflowName(w) {
  if (!w) return "Flow";
  let s = String(w).replace(/^me:/, "");
  const spec = s.startsWith("spec-");
  if (spec) s = s.slice(5);
  const WORDS = { issue: "Issue", worktree: "Worktree", branch: "Branche", pr: "PR", goal: "Sprint", release: "Release" };
  return (spec ? "Spec · " : "") + s.split("-").map((p) => WORDS[p] ?? p).join(" → ");
}

/** The issue of a `<type>/#N-slug` branch, else null. */
export const issueOf = (branch) => String(branch ?? "").match(/^[\w.-]+\/#(\d+)(?:-|$)/)?.[1] ?? null;

/** The step's phases, empty ones left out; unknown steps go last under "Autres". */
export function phasesOf(steps) {
  const known = new Set(PHASES.flatMap((p) => p.steps));
  const groups = PHASES.map((p) => ({ ...p, steps: steps.filter((s) => p.steps.includes(s.id)) }));
  const other = steps.filter((s) => !known.has(s.id));
  if (other.length) groups.push({ id: "other", label: "Autres", steps: other });
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
      if (e) out.push({ text: `${e[1]} edit${+e[1] > 1 ? "s" : ""}` });
      const add = r.match(/\+(\d+)/), del = r.match(/(?:^|\s)-(\d+)/);
      if (add && +add[1]) out.push({ text: `+${add[1]}`, tone: "ok", mono: true });
      if (del && +del[1]) out.push({ text: `−${del[1]}`, tone: "err", mono: true });
      return out;
    }
    case "review": {
      const out = frac[0] ? [{ text: `passe ${frac[0]}` }] : [];
      const b = r.match(/P0P1P2=(\d+)/);
      if (b) out.push({ text: `${b[1]} bloquant${+b[1] > 1 ? "s" : ""}`, tone: +b[1] ? "err" : "ok" });
      if (/spec skipped/.test(r)) out.push({ text: "spec sautée", tone: "dim" });
      return out;
    }
    case "ci": {
      if (frac.length >= 2) return [{ text: `passe ${frac[0]}` }, { text: `${frac[1]} checks`, tone: full(frac[1]) ? "ok" : "err" }];
      return frac.length ? [{ text: `${frac[0]} checks`, tone: full(frac[0]) ? "ok" : "err" }] : [];
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
  if (s === "fixed") return { text: f.ref ? `corrigé ${String(f.ref).slice(0, 7)}` : "corrigé", tone: "ok" };
  if (["wontfix", "discarded", "rejected", "skipped", "invalid"].includes(s)) return { text: s === "wontfix" ? "wontfix" : "écarté", tone: "dim" };
  return { text: "ouvert", tone: "warn" };
}

/** A finding's `loc` as "path:line" (the first location; "(idem …)" dropped), null without one. */
export const locOf = (loc) => String(loc ?? "").trim().split(/\s+\(|\s+/)[0] || null;

/** What's running, in one line: each current step's label up to its first " · ". */
export const runningLine = (steps) => steps.filter((s) => s.state === "current").map((s) => String(s.label ?? s.id).split(" · ")[0]).join(" · ");
