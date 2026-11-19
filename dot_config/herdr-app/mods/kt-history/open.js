// History opened on a commit by another mod (#82, the Chat's references): shared "kt.history.open" =
// { sha, at }, kt-inbox's "kt.inbox.open" pattern. Pure: open.check.mjs.
//
//   const sha = openRequest(req, Date.now())   // the sha asked for, or null (stale past 30 s, not a sha)
//   wantStep(commits, sha, listed)            // { select: hash } | { wait: true } | { drop: "notListed" }
//
// History is read only: what is asked selects a commit (never toggles it shut) and moves the cursor,
// nothing else.

const STALE = 30e3;

export function openRequest(req, now) {
  if (!req || typeof req !== "object") return null;
  if (!(now - (Number(req.at) || 0) <= STALE)) return null;
  const sha = String(req.sha ?? "").toLowerCase();
  return /^[0-9a-f]{7,40}$/.test(sha) ? sha : null;
}

/**
 * What to do with a sha asked for, against the commits listed: its commit (the full hash: a prefix
 * matches only when it names one commit), or wait for the list (`listed` false: not read yet), or
 * drop it (read, and not among them: older than the last COUNT, or another repo).
 */
export function wantStep(commits, sha, listed) {
  const hits = (commits ?? []).filter((c) => c.hash.startsWith(sha));
  if (hits.length === 1) return { select: hits[0].hash };
  if (hits.length > 1) return { drop: "ambiguous" };
  return listed ? { drop: "notListed" } : { wait: true };
}
