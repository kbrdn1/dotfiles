// reread.js: when a panel tab (Files, Changes, History) reads its repo again. Written once in
// mods/kt-keys/reread.js and copied byte for byte into kt-diff, kt-history and kt-files (cmp to check).
// Pure, no herdr: reread.check.mjs checks it.

// In render. A new place (another thread, space or worktree: `loc`) always reads at once, whether the
// tab stayed shown or was hidden meanwhile; back on the tab at the same place, only past `stale` ms
// (DATA-SYNC.md). `lastLoc` is the place the last render saw, `readAt` when the last read started.
export function shouldRead({ vis, shown, loc, lastLoc, readAt, now, stale = 10e3 }) {
  if (!vis) return false;
  if (loc !== lastLoc) return true;
  return !shown && now - (readAt ?? 0) > stale;
}
