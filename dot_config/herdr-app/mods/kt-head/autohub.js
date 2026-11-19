// When the home page (kt-hub, the "hub" child of the "view" stack) shows by itself (#47, Kylian's choice
// of 2026-11-19): at three moments only, never while working in a thread.
// 1. On start, once no machine is still reading its layout: no space shown, or Home shown with nothing
//    running in it.
// 2. The last space closes.
// 3. Home is shown (from another space, or from none) with nothing running in it.
// "Running": an agent of that space working or waiting for you.
// A machine coming or going is nobody closing a space: herdr.d.ts doesn't say whether an unavailable
// machine's spaces leave spaces(), so only the spaces of machines that answer count (this computer, a
// machine whose machines.js status is "ready"), and a render where that set of machines changed shows
// nothing (a network cut that drops the shown space, or moves the view to Home, is no transition).
// Pure: autohub.check.mjs runs it under bun; the crumbs copy of kt-head (always drawn) calls it on each
// render with the world as it is.

/** The facts the rule reads. `machines`: [{ name, status }], machines.js' stateOf status ("local",
 * "ready", "loading", "login", "away"; "loading" too for this computer while its layout is read). */
export function facts({ machines, spaces, agents, home }) {
  const ready = machines.length > 0 && !machines.some((m) => m.status === "loading");
  const up = new Set(machines.filter((m) => m.status === "local" || m.status === "ready").map((m) => m.name ?? ""));
  const shown = spaces.find((s) => s.active) ?? null;
  const isHome = Boolean(shown && !shown.machine && shown.folder === home);
  const busy = Boolean(shown && agents.some((a) => a.space === shown.id && (a.status === "working" || a.status === "blocked")));
  return { ready, up: [...up].sort().join("\n"), count: spaces.filter((s) => up.has(s.machine ?? "")).length, active: shown?.id ?? null, home: isHome, busy };
}

/** Whether to show the home page now, from the facts before (null: none yet) and now. */
export function shouldShow(prev, cur) {
  if (!cur.ready) return false;
  if (!prev?.ready) return cur.active == null || (cur.home && !cur.busy);
  if (prev.up !== cur.up) return false;
  if (prev.count > 0 && cur.count === 0) return true;
  return cur.home && !cur.busy && cur.active !== prev.active;
}
