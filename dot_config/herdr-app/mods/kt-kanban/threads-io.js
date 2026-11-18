// The threads' reads, for threads-model.js' World: herdr-bridge, statusline and claude-flow's caches
// (live), /me:report (reports), git (repos, real), gh (prs, defaults). The host's functions come in
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

/** A folder's repo (`location`: JSON [machine, folder]): { key: JSON [machine, git common dir], name,
 *  linked: a linked worktree }, null outside git. A folder's repo doesn't change: ask once. */
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
  } catch { return null; }
}

/** A folder's real path (`pwd -P`) as the World's `real` keeps it: JSON [machine, path], else null. */
export async function realOf(location, exec) {
  const [on, folder] = JSON.parse(location);
  try {
    const r = await exec("pwd", ["-P"], { cwd: folder, on });
    return r.code === 0 && r.stdout.trim() ? JSON.stringify([on, r.stdout.trim()]) : null;
  } catch { return null; }
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
