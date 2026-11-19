// Worktrees opened on a worktree or a branch by another mod (#82, the Chat's references): shared
// "kt.gwm.open" = { path?, branch?, at }, kt-inbox's "kt.inbox.open" pattern. Pure: open.check.mjs.
//
//   const want = openRequest(req, Date.now())   // { path, branch } (one at least) or null
//   matchStop(stops, want)                       // the card's stop ({ id, w }) or null
//
// It only SHOWS a card (the cursor on it, brought into view): nothing here acts on a worktree, and
// nothing reaches the page's remove (`kt-gwm.remove`, shared "kt-gwm.remove"): open.check.mjs reads
// this file and the page's openAsked / applyWant to prove it.

const STALE = 30e3;

export function openRequest(req, now) {
  if (!req || typeof req !== "object" || !(now - (Number(req.at) || 0) <= STALE)) return null;
  const path = typeof req.path === "string" && req.path.startsWith("/") && !req.path.includes("\0") && !req.path.split("/").includes("..") ? req.path.replace(/\/+$/, "") : null;
  const branch = typeof req.branch === "string" && /^[\w.#+/-]{1,200}$/.test(req.branch) && !req.branch.split("/").includes("..") ? req.branch : null;
  return path || branch ? { path, branch } : null;
}

/** The card asked for: by its path first, else by its branch (one card only: two with it, none). */
export function matchStop(stops, want) {
  const all = stops ?? [];
  if (want?.path) {
    const s = all.find((x) => x.w?.path === want.path);
    if (s) return s;
  }
  if (want?.branch) {
    const hits = all.filter((x) => x.w?.branch === want.branch);
    if (hits.length === 1) return hits[0];
  }
  return null;
}
