// Which pull request a thread's card shows for its branch. Pure, so pr-pick.check.mjs can test it.

// Branches that live for ever: a PR whose head is one of them is a release or a sync, never the thread's.
export const LONG_LIVED = ["main", "master", "trunk", "develop", "dev", "staging", "preprod", "prod", "production", "release"];

/** No badge on a long-lived branch, nor on the repo's own default branch (gh repo view). */
export function longLived(branch, defaultBranch) {
  return !branch || LONG_LIVED.includes(branch) || (Boolean(defaultBranch) && branch === defaultBranch);
}

/**
 * From `gh pr list --head <branch> --state all --limit 5 --json number,state,url,headRefOid,baseRefName`
 * (newest first): the open one; else the newest merged or closed one, only while its head is still the
 * local HEAD (a branch that moved on, or one reused, shows nothing); else null. A PR into its own head
 * branch is ignored.
 */
export function pickPr(list, branch, head) {
  const prs = (Array.isArray(list) ? list : []).filter((p) => p && p.baseRefName !== branch);
  const open = prs.find((p) => p.state === "OPEN");
  if (open) return open;
  const last = prs.find((p) => p.state === "MERGED" || p.state === "CLOSED");
  return last && head && last.headRefOid === head ? last : null;
}
