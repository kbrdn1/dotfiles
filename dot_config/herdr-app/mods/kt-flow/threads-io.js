// The threads' reads, for threads-model.js' World: herdr-bridge, statusline and claude-flow's caches
// (live), /me:report (reports), git (repos, real), gh (prs, defaults); and for one card's drawer
// (kt-kanban): its PR with its checks, its issue, its diff against its base. The host's functions come in
// as parameters (exec, readTextFile, readdir): no herdr import, so another mod runs them as
// kt-threads does, and a Bun check runs them on fakes. When to read is the mod's call (kt-threads:
// live every 3 s, reports every 15 s, a PR at most every 3 min). Copied byte for byte with
// threads-model.js; checked by threads-model.check.mjs.

import { repoOf, summarizeReport } from "./threads-model.js";
import { longLived, pickPr } from "./pr-pick.js";

export const statuslineDir = (home) => `${home}/.claude/cache/statusline`;

/**
 * Each agent pane's herdr-bridge json (`~/.claude/cache/herdr/<terminal>.json`), Claude's statusline
 * facts (`sl`, and `slAt`: its write time to the minute) and claude-flow's timeline (`flow`), by
 * terminal; the account's 5h / 7d quota when a Claude thread shows. A torn read keeps `prev`'s
 * ({ live, quota }: the last result). Remote terminals ("vps/t7") are skipped.
 */
export async function readLive(panes, { home, readTextFile }, prev = {}) {
  const last = prev.live ?? {};
  const next = {};
  let claude = false;
  for (const p of panes) {
    if (!p.terminal || p.terminal.includes("/") || !p.program?.agent) continue;
    try {
      const s = await readTextFile(`${home}/.claude/cache/herdr/${p.terminal}.json`);
      if (s) next[p.terminal] = JSON.parse(s);
    } catch {
      if (last[p.terminal]) next[p.terminal] = last[p.terminal]; // a torn read keeps the last one
    }
    // Claude's statusline facts (model, context, cache, tokens), for the card's agent rows.
    if (p.app === "claude-code" || p.program?.key === "claude") {
      claude = true;
      try {
        const sl = JSON.parse(await readTextFile(`${statuslineDir(home)}/herdr-${p.terminal}.json`));
        // its write time (to the minute) dates the thread's activity; the rest feeds the card
        if (sl) {
          const slAt = sl.updated_at ? Math.floor(sl.updated_at / 60) * 60e3 : undefined;
          delete sl.updated_at;
          next[p.terminal] = { ...(next[p.terminal] ?? {}), sl, slAt };
        }
      } catch {
        if (last[p.terminal]?.sl) next[p.terminal] = { ...(next[p.terminal] ?? {}), sl: last[p.terminal].sl, slAt: last[p.terminal].slAt };
      }
    }
    // claude-flow's timeline (issue, worktree, commits, PR, review, CI, merge), when it publishes one.
    try {
      const f = await readTextFile(`${home}/.claude/cache/herdr/${p.terminal}.flow.json`);
      if (f) next[p.terminal] = { ...(next[p.terminal] ?? {}), flow: JSON.parse(f) };
    } catch {
      if (last[p.terminal]?.flow) next[p.terminal] = { ...(next[p.terminal] ?? {}), flow: last[p.terminal].flow };
    }
  }
  // The account's 5h / 7d quota: one file, read once a tick when a Claude thread shows it.
  let quota = null;
  if (claude) {
    try { quota = JSON.parse(await readTextFile(`${statuslineDir(home)}/herdr-quota.json`)); if (quota) delete quota.updated_at; } catch { quota = prev.quota; }
  }
  return { live: next, quota };
}

/**
 * /me:report's facts by "<repo>|<branch>", for each local pane on a branch whose repo has a folder in
 * ~/Reports (`<owner>-<repo>/<branch, / and # as ->`): facts.json (the stable contract) first, data.js
 * (the page's own copy) until collect.py writes it. `repos`: the World's.
 */
export async function readReports(panes, repos, { home, readTextFile, readdir }) {
  const next = {};
  let owners = [];
  try { owners = await readdir(`${home}/Reports`); } catch { }
  for (const p of panes) {
    if (!p.terminal || p.terminal.includes("/") || !p.branch || !p.cwd) continue;
    const repo = repos[JSON.stringify([null, p.cwd])]?.name;
    const dir = repo && owners.find((o) => o.endsWith(`-${repo}`));
    const key = `${repo}|${p.branch}`;
    if (!dir || key in next) continue;
    const folder = `${home}/Reports/${dir}/${p.branch.replace(/[/#]+/g, "-")}`;
    try {
      const facts = await readTextFile(`${folder}/facts.json`).catch(() => null);
      if (facts) {
        const d = JSON.parse(facts);
        next[key] = summarizeReport(d.facts ? d : { facts: d, generatedAt: d.generatedAt });
        continue;
      }
      const s = await readTextFile(`${folder}/data.js`);
      if (s) next[key] = summarizeReport(JSON.parse(s.replace(/^\s*window\.__report\s*=\s*/, "").replace(/;\s*$/, "")));
    } catch { }
  }
  return next;
}

// A failed ask (#61). On this computer it's an answer (no such folder): null, kept, as before. On another
// machine it's "couldn't ask" (away, a timeout, a lost link; machines.js guard refuses at once): undefined,
// never kept, asked again once askable(). ponytail: a remote folder really gone is asked again every 30 s;
// tell it apart (exec's message) if that ever costs.
const failed = (on) => (on ? undefined : null);

/** A folder's repo (`location`: JSON [machine, folder]): { key: JSON [machine, git common dir], name,
 *  linked: a linked worktree }, null outside git, undefined when its machine couldn't be asked. A
 *  folder's repo doesn't change: ask once. */
export async function findRepo(location, exec) {
  const [on, f] = JSON.parse(location);
  try {
    const r = await exec("git", ["rev-parse", "--path-format=absolute", "--git-common-dir"], { cwd: f, on });
    const top = await exec("git", ["rev-parse", "--show-toplevel"], { cwd: f, on });
    const key = r.code === 0 ? r.stdout.trim() : null;
    return key && {
      key: JSON.stringify([on, key]),
      name: (key.endsWith("/.git") ? key.slice(0, -5) : key).split("/").pop(),
      linked: key !== `${top.stdout.trim()}/.git`,
    };
  } catch { return failed(on); }
}

/** A folder's real path (`pwd -P`) as the World's `real` keeps it: JSON [machine, path], else null;
 *  undefined when its machine couldn't be asked. */
export async function realOf(location, exec) {
  const [on, folder] = JSON.parse(location);
  try {
    const r = await exec("pwd", ["-P"], { cwd: folder, on });
    return r.code === 0 && r.stdout.trim() ? JSON.stringify([on, r.stdout.trim()]) : null;
  } catch { return failed(on); }
}

/** Whether a place (JSON [machine, folder]) can be asked now: its machine `reachable` (machines.js), and
 *  not failed less than `again` ms ago (`tried`: place -> when it last couldn't be asked). A machine away
 *  is not asked at all; back, its places are asked at once (the render that sees it back). */
export function askable(location, { reachable, tried = {}, now = Date.now(), again = 30e3 }) {
  return reachable(JSON.parse(location)[0]) && !(now - (tried[location] ?? -Infinity) < again);
}

/** Places by machine, this computer first: [[machine, [place, ...]], ...]. One queue per machine, so a
 *  slow machine never holds this computer's places, nor another machine's, back. */
export function queues(locations) {
  const by = new Map();
  for (const l of locations) {
    const on = JSON.parse(l)[0];
    if (!by.has(on)) by.set(on, []);
    by.get(on).push(l);
  }
  return [...by].sort(([a], [b]) => (a === null ? -1 : b === null ? 1 : a.localeCompare(b)));
}

/** Asks `ask(place)` for each place of one queue, in order: an answer (null included) goes into `into`,
 *  a place it couldn't ask (undefined) into `tried` with the time, for askable(). */
export async function drain(queue, ask, into, tried, now = () => Date.now()) {
  for (const l of queue) {
    const r = await ask(l);
    if (r === undefined) tried[l] = now();
    else {
      into[l] = r;
      delete tried[l];
    }
  }
}

const json = (s) => { try { return JSON.parse(s); } catch { return null; } };

/** A PR as a card's drawer (kt-kanban) shows it: { number, title, state, draft, url, base, checks }, else
 *  null. checks: gh pr checks' [{ name, state, link, bucket }]. `at`: { exec, cwd, on } (on: a space's
 *  machine). Asked when the drawer opens, then at most as often as the PR badges (the mod's call). */
export async function readPr(number, { exec, cwd, on }) {
  const [v, c] = await Promise.all([
    exec("gh", ["pr", "view", String(number), "--json", "number,title,state,isDraft,url,baseRefName"], { cwd, on }).catch(() => ({ code: 1 })),
    exec("gh", ["pr", "checks", String(number), "--json", "name,state,link,bucket"], { cwd, on }).catch(() => ({ code: 1 })),
  ]);
  const d = v.code === 0 ? json(v.stdout) : null;
  if (!d?.number) return null;
  // gh pr checks exits non-zero on a failing or pending check, and when there is none: its stdout counts.
  const checks = json(c.stdout ?? "");
  return { number: d.number, title: d.title ?? "", state: d.state ?? "OPEN", draft: Boolean(d.isDraft), url: d.url ?? null,
    base: d.baseRefName ?? null, checks: Array.isArray(checks) ? checks : [] };
}

/** An issue as the drawer shows it: { number, title, state, url }, else null. */
export async function readIssue(number, { exec, cwd, on }) {
  const v = await exec("gh", ["issue", "view", String(number), "--json", "number,title,state,url"], { cwd, on }).catch(() => ({ code: 1 }));
  const d = v.code === 0 ? json(v.stdout) : null;
  return d?.number ? { number: d.number, title: d.title ?? "", state: d.state ?? "OPEN", url: d.url ?? null } : null;
}

/** `git diff --shortstat`'s line read: { files, added, removed } (no change: zeros), null when it isn't one. */
export function shortstat(text) {
  const s = String(text ?? "").trim();
  if (!s) return { files: 0, added: 0, removed: 0 };
  const n = (re) => Number(s.match(re)?.[1] ?? 0);
  return /files? changed/.test(s) ? { files: n(/(\d+) files? changed/), added: n(/(\d+) insertions?\(\+\)/), removed: n(/(\d+) deletions?\(-\)/) } : null;
}

/** A branch against its base (`git diff --shortstat <base>...HEAD`, else against origin/<base>):
 *  shortstat()'s, else null (no such base). */
export async function readDiff(base, { exec, cwd, on }) {
  for (const ref of [base, `origin/${base}`]) {
    const r = await exec("git", ["diff", "--shortstat", `${ref}...HEAD`], { cwd, on }).catch(() => ({ code: 1 }));
    if (r.code === 0) return shortstat(r.stdout);
  }
  return null;
}

/** The PR of a branch (`key`: threads-model's prKey) as pr-pick.js chooses it, else null. Asks gh for
 *  the repo's default branch once (kept in `defaults`); none on a long-lived branch. */
export async function lookupPr(key, { exec, repos, defaults }) {
  const [on, cwd, branch] = JSON.parse(key);
  const repo = repoOf(on, cwd, repos);
  if (!(repo in defaults)) {
    const d = await exec("gh", ["repo", "view", "--json", "defaultBranchRef", "-q", ".defaultBranchRef.name"], { cwd, on }).catch(() => ({ code: 1 }));
    defaults[repo] = d.code === 0 ? d.stdout.trim() || null : null;
  }
  if (longLived(branch, defaults[repo])) return null;
  const [r, h] = await Promise.all([
    exec("gh", ["pr", "list", "--head", branch, "--state", "all", "--limit", "5", "--json", "number,state,url,headRefOid,baseRefName,isDraft"], { cwd, on }).catch(() => ({ code: 1 })),
    exec("git", ["rev-parse", "HEAD"], { cwd, on }).catch(() => ({ code: 1 })),
  ]);
  try {
    const pr = r.code === 0 ? pickPr(JSON.parse(r.stdout), branch, h.code === 0 ? h.stdout.trim() : null) : null;
    return pr && { ...pr, draft: Boolean(pr.isDraft) }; // as /me:report's: draft
  } catch { return null; }
}
