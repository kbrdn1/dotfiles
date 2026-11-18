// summary.js: what kt-usage publishes in shared "kt.usage.summary" after a full read (open,
// Rafraîchir), for kt-threads' preview on hover of the Usage button (usage-peek's format, v 1): the
// hover makes no network call, and USAGE_CACHE lives in this mod's module only. Numbers, dates (unix
// s) and names only: no token, no path, nothing from the keychain. `used` is the reading (w.last)
// with its reset: the reader judges a passed reset with its own clock. Any part may be null.
// Pure (Bun: summary.check.mjs). `mid`: today's midnight, unix s (main.js midnight()).
import { claudeWindows, codexWindows, dayCost } from "./data.js";

export function usageSummary(d, mid) {
  const c = d.claude;
  const u = d.api?.usage;
  let claude = null;
  if (c?.present) {
    const week = u?.week ?? claudeWindows(c.quota, d.at)[1]; // as claude(): the endpoint's, else the statusLine's
    const share = (u?.shares ?? []).find((s) => s.used != null && s.value > 0);
    const day = dayCost(c.files ?? [], mid);
    claude = {
      plan: c.plan ?? null,
      week: !week.missing ? { used: week.last, resets: week.resets, severity: week.severity ?? null } : null,
      fable: u?.scoped ? { name: u.scoped.name ?? null, used: u.scoped.last, resets: u.scoped.resets, active: u.scoped.active } : null,
      share: share ? { name: share.label ?? null, used: share.used, of: share.value } : null,
      day: day.sessions ? { usd: Math.round(day.total * 100) / 100, sessions: day.sessions } : null,
    };
  }
  const r = d.codex?.reading;
  let codex = null;
  if (r) {
    const [five, week] = codexWindows(r.limits, d.at);
    codex = {
      plan: r.plan ?? null, at: r.at ?? null,
      five: five.missing ? null : { used: five.last, resets: five.resets },
      week: week.missing ? null : { used: week.last, resets: week.resets },
    };
  }
  return { v: 1, at: d.at, claude, codex };
}
