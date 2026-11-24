// A Herdr terminal address survives Codex /new and process restarts. Keep the exact rollout only
// between bounded checks: a changed process fingerprint resolves immediately, and a stable PID is
// re-resolved often enough for the Chat's live tail to notice a newly opened rollout.
export const CODEX_RECHECK_MS = 5000;

const terminalData = (terminal) => ({
  pid: terminal?.foreground?.pid ?? terminal?.pid ?? 0,
  createdMs: terminal?.created_ms ?? 0,
  cwd: terminal?.cwd ?? "",
});

const fingerprintOf = ({ pid, createdMs, cwd }) => JSON.stringify([pid, createdMs, cwd]);

export async function resolveCodexLink(cache, address, terminal, resolve, { now = Date.now(), force = false } = {}) {
  const data = terminalData(terminal);
  const fingerprint = fingerprintOf(data);
  const previous = cache.get(address) ?? null;
  const age = now - (previous?.checkedAt ?? 0);
  if (!force && previous?.fingerprint === fingerprint && age >= 0 && age < CODEX_RECHECK_MS) {
    return { ...previous, checked: false, changed: false };
  }

  let found = null;
  try {
    found = await resolve(data);
  } catch {
    found = null;
  }
  const path = typeof found?.path === "string" && found.path ? found.path : null;
  let next;
  if (path) {
    next = { fingerprint, checkedAt: now, path, session: found?.session ?? null };
  } else if (previous?.fingerprint === fingerprint && previous.path) {
    // A transient lsof ambiguity must not blank a working Chat. Keep the last exact path, but move
    // only the check timestamp: the same PID is tried again after the bounded interval.
    next = { ...previous, checkedAt: now };
  } else {
    // A restarted process must never inherit the previous process' rollout when resolution fails.
    next = { fingerprint, checkedAt: now, path: null, session: null };
  }
  cache.set(address, next);
  return { ...next, checked: true, changed: (previous?.path ?? null) !== next.path };
}

// A shown Codex Chat at rest (idle, done, blocked) still rechecks its rollout every CODEX_RECHECK_MS:
// /new and /resume switch it without any work. A working one already does, through the live tail.
export const shouldPollCodex = ({ shown, fixed, codex, status }) => Boolean(shown) && !fixed && Boolean(codex) && status !== "working";
