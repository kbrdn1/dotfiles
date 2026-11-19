// summary.js: what kt-usage publishes in shared "kt.usage.summary" after a full read (open,
// Rafraîchir), for kt-threads' preview on hover of the Usage button (usage-peek's format, v 1): the
// hover makes no network call, and USAGE_CACHE lives in this mod's module only. Numbers, dates (unix
// s) and names only: no token, no path, nothing from the keychain. `used` is the reading (w.last)
// with its reset: the reader judges a passed reset with its own clock. Any part may be null. `at`:
// the full read's time; `claude.week.at`: the week's own reading time (freshWeek), which can be older.
// Pure (Bun: summary.check.mjs). `mid`: today's midnight, unix s (main.js midnight()).
import { claudeWindows, codexWindows, dayCost } from "./data.js";

// The weekly window, kt-usage's page and summary alike: the newer of the usage endpoint's answer
// (api.at, ms) and the statusLine's reading (herdr-quota.json's updated_at, unix s), as statusline.ts
// and kt-threads' usagePeek do. A reset on claude.ai lowers the week in the same window, so the newer
// reading wins even when lower; an endpoint answer read before the statusLine's last one loses. A
// statusLine file without updated_at (written before it had one) leaves the endpoint's. `at`: the
// reading's time, unix s (null when unknown). Pure.
export function freshWeek(api, quota, now) {
  const u = api?.usage?.week;
  const sl = claudeWindows(quota, now)[1];
  const apiAt = Number.isFinite(api?.at) ? Math.floor(api.at / 1000) : null;
  const slAt = Number.isFinite(quota?.updated_at) ? quota.updated_at : null;
  if (u && (sl.missing || slAt == null || (apiAt ?? 0) >= slAt)) return { ...u, at: apiAt };
  return sl.missing ? sl : { ...sl, at: slAt };
}

export function usageSummary(d, mid) {
  const c = d.claude;
  const u = d.api?.usage;
  let claude = null;
  if (c?.present) {
    const week = freshWeek(d.api, c.quota, d.at); // as claude(): the newer reading
    const share = (u?.shares ?? []).find((s) => s.used != null && s.value > 0);
    const day = dayCost(c.files ?? [], mid);
    claude = {
      plan: c.plan ?? null,
      week: !week.missing ? { used: week.last, resets: week.resets, severity: week.severity ?? null, at: week.at ?? null } : null,
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
