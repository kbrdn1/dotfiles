// data.js: what kt-usage makes of the files it reads, as pure functions (no herdr, no gpui-kit),
// so Bun checks it (data.check.mjs). The rules are herdr-agent-quota's, transposed:
// src/providers/claude.rs (statusLine rate_limits) and src/providers/codex.rs (window_kind, the
// rollout tail). A window never shows a number it doesn't have: missing stays missing, a window
// whose reset is behind the reading shows "unknown", never its old percent.

import words from "./data.strings.js";

// Its words (I18N.md): French here (Bun, the check), the shown language once main.js has called
// speak(makeT) with i18n.js' (this file stays pure: no herdr import).
const fr = (k, v = {}) => {
  const s = words.fr[k];
  return String(typeof s === "object" ? (v.n < 2 ? s.one : s.other) : s ?? "").replace(/\{(\w+)\}/g, (_, x) => v[x] ?? "");
};
let tr = fr;
export const speak = (makeT) => { tr = makeT(words); };

const H = 3600;
const D = 86400;
const pad = (n) => String(n).padStart(2, "0");
export const clock = (sec) => { const d = new Date(sec * 1000); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
export const day = (sec) => { const d = new Date(sec * 1000); return tr("dm", { d: pad(d.getDate()), m: pad(d.getMonth() + 1) }); };

// Unix seconds from a number or an RFC 3339 string (Claude writes either), else null.
export function toUnix(v) {
  if (Number.isFinite(v)) return v > 1e12 ? Math.floor(v / 1000) : v;
  if (typeof v === "string") { const ms = Date.parse(v); return Number.isFinite(ms) ? Math.floor(ms / 1000) : null; }
  return null;
}

// codex.rs window_kind: 300 ± 60 min is 5h, 10080 ± 180 is 7 days; any other length is skipped.
export function windowLabel(minutes) {
  if (!Number.isFinite(minutes)) return null;
  if (Math.abs(minutes - 300) <= 60) return "5h";
  if (Math.abs(minutes - 10080) <= 180) return "7j";
  return null;
}

// `used`: null when there's no current number. `passed`: the reset is behind us, the reading belongs
// to the window before (kept in `last`, shown as the last reading, not as the usage).
function win(label, used, resets, now) {
  const passed = resets != null && resets <= now;
  return { label, used: passed ? null : used, last: used, resets, passed };
}

// herdr-quota.json (statusline.ts copies Claude Code's rate_limits there): five_hour, seven_day.
// Only Anthropic's windows: on an Ultra account (Max 20x, verified) five_hour is null since late
// October 2026, so the 5h slot comes back missing; should it come back, it shows like any window.
export function claudeWindows(quota, now) {
  return [["five_hour", "5h"], ["seven_day", "7j"]].map(([key, label]) => {
    const w = quota?.[key];
    if (!w || !Number.isFinite(w.used_percentage)) return { label, missing: true };
    return win(label, w.used_percentage, toUnix(w.resets_at), now);
  });
}

// « mar. 24 nov. 20:00 » / "Tue Nov 24 20:00", by hand (no Intl in the mod's runtime to count on).
export const frDate = (sec) => {
  const d = new Date(sec * 1000);
  return tr("date", { day: tr(`day.${d.getDay()}`), d: d.getDate(), month: tr(`month.${d.getMonth()}`), time: clock(sec) });
};

// When a limit reset is worth it: the weekly window above 90 % AND its own return to zero more than
// 24 h away. Advice only: it reads the weekly window, it never uses a reset (that's claude.ai's).
export function resetAdvice(week, now) {
  if (!week || week.missing) return { worth: false, text: tr("advice.missing") };
  if (week.passed) return { worth: false, text: tr("advice.passed") };
  if (week.resets == null) return { worth: false, text: tr("advice.noReset") };
  const pct = Math.round(week.used);
  const worth = week.used > 90 && week.resets - now > D;
  return { worth, text: tr("advice.text", { pct, date: frDate(week.resets), verdict: tr(worth ? "advice.worth" : "advice.no") }) };
}

// GET /api/oauth/usage (Claude Code's /usage), read field by field: only the known keys, so the coded
// internal ones (amber_*, brass_thimble…) never reach the console, and anything unrecognized stays out
// (shown as "non fourni"), never guessed. Shapes from a real answer (data.check.mjs' fixture, 2026-11-18):
//   limits[]: { kind: "weekly_all" | "weekly_scoped", percent, severity, resets_at (ISO), is_active,
//               scope: null | { model: { id, display_name: "Fable" }, surface } }
//   seven_day_breakdown.rows[]: { key, display_name, percent, percent_of_limit }
//   weekly_scoped_shares[]: { limit_index (into limits), used_percent_of_weekly, allowance_percent_of_weekly }
//   extra_usage: { is_enabled, user_disabled, disabled_reason, used_credits, monthly_limit, currency, … }
//   spend: { enabled, disabled_reason, used: { amount_minor, currency, exponent }, limit, … }
const num = (...vs) => { for (const v of vs) { const n = typeof v === "string" ? Number(v) : v; if (Number.isFinite(n)) return n; } return null; };
const text = (...vs) => vs.find((v) => typeof v === "string" && v.trim())?.trim() ?? null;
// A money amount: { amount_minor, exponent, currency } is amount_minor / 10^exponent in that currency;
// a plain number is taken as is (extra_usage's used_credits came null: its unit is unconfirmed).
const money = (v, currency = null) => {
  if (v && typeof v === "object") {
    const minor = num(v.amount_minor);
    const exp = num(v.exponent) ?? 0;
    return minor == null ? null : { amount: minor / 10 ** exp, currency: text(v.currency, currency) };
  }
  const n = num(v);
  return n == null ? null : { amount: n, currency: text(currency) };
};

export function parseOauthUsage(j, now) {
  if (!j || typeof j !== "object") return null;
  const limits = Array.isArray(j.limits) ? j.limits : [];
  const nameOf = (l) => text(l?.scope?.model?.display_name, l?.scope?.surface?.display_name, l?.display_name);
  const limit = (kind) => {
    const l = limits.find((x) => x?.kind === kind);
    const used = num(l?.percent);
    if (!l || used == null) return null;
    const w = win("7j", Math.max(0, Math.min(100, used)), toUnix(l.resets_at), now);
    return { ...w, severity: text(l.severity), active: typeof l.is_active === "boolean" ? l.is_active : null, name: nameOf(l) };
  };
  const rows = (Array.isArray(j.seven_day_breakdown?.rows) ? j.seven_day_breakdown.rows : [])
    .map((r) => ({ label: text(r?.display_name, r?.key), value: num(r?.percent) }))
    .filter((r) => r.label && r.value != null && r.value >= 0);
  // Each share names its limit by index: its allowance of the week, and how much of the week it used.
  const shares = (Array.isArray(j.weekly_scoped_shares) ? j.weekly_scoped_shares : [])
    .map((s) => ({ label: nameOf(limits[num(s?.limit_index)]), value: num(s?.allowance_percent_of_weekly), used: num(s?.used_percent_of_weekly) }))
    .filter((s) => s.value != null);
  const credit = (c, enabled, used, limit) => c && typeof c === "object"
    ? { enabled: typeof enabled === "boolean" ? enabled : null, byUser: c.user_disabled === true, reason: text(c.disabled_reason),
      used: money(used, c.currency), limit: money(limit, c.currency) }
    : null;
  const x = j.extra_usage;
  const sp = j.spend;
  return { week: limit("weekly_all"), scoped: limit("weekly_scoped"), rows, shares,
    extra: credit(x, x?.is_enabled, x?.used_credits, x?.monthly_limit), spend: credit(sp, sp?.enabled, sp?.used, sp?.limit) };
}

// "0,00 USD" (fr) / "0.00 USD" (en), or the amount alone without a currency.
export const moneyLabel = (m) => (m ? `${m.amount.toFixed(2).replace(".", tr("point"))}${m.currency ? ` ${m.currency}` : ""}` : null);

// The rate limit tier as people say it: "default_claude_max_20x" -> "Max 20x"; else null.
export const tierLabel = (tier) => { const m = /max_(\d+)x/i.exec(String(tier ?? "")); return m ? `Max ${m[1]}x` : null; };

// The newest token_count with rate_limits among rollout lines (oldest first). Lines that don't
// parse (the tail's cut first line) are skipped. null: none has rate_limits.
export function codexReading(lines) {
  for (let i = lines.length - 1; i >= 0; i--) {
    let e;
    try { e = JSON.parse(lines[i]); } catch { continue; }
    const p = e?.payload ?? e;
    const rl = p?.type === "token_count" ? (p.rate_limits ?? p.rateLimits) : null;
    if (!rl || typeof rl !== "object") continue;
    return { at: toUnix(e.timestamp), plan: rl.plan_type ?? rl.planType ?? null, limits: rl };
  }
  return null;
}

// primary / secondary, placed by their length (codex.rs: by duration, not position); 5h then 7j,
// a missing one listed as missing.
export function codexWindows(limits, now) {
  const found = {};
  for (const c of [limits?.primary, limits?.secondary]) {
    if (!c) continue;
    const label = windowLabel(c.window_minutes ?? c.windowDurationMins);
    const used = c.used_percent ?? c.usedPercent;
    if (!label || !Number.isFinite(used) || found[label]) continue;
    found[label] = win(label, used, toUnix(c.resets_at ?? c.resetsAt), now);
  }
  return ["5h", "7j"].map((label) => found[label] ?? { label, missing: true });
}

// The day's Claude cost: the last cost_usd of each session (herdr-<terminal>.json files, one per
// session_id, the newest updated_at), written since local midnight. Claude Code's cost_usd is the
// session's running total (API-equivalent), so a session begun yesterday counts whole: an estimate.
export function dayCost(files, midnight) {
  const last = new Map();
  for (const f of files) {
    if (!f || !(f.updated_at >= midnight) || !(f.cost_usd > 0)) continue;
    const key = f.session_id || f.file;
    const seen = last.get(key);
    if (!seen || f.updated_at > seen.updated_at) last.set(key, f);
  }
  let total = 0;
  for (const f of last.values()) total += f.cost_usd;
  return { total, sessions: last.size };
}

// « reset 14:20 » within a day; beyond, kbrdn-status's rounding (hours to 48 h, then days) so the
// console and the status bar say the same thing.
export function resetLabel(w, now) {
  if (w.resets == null) return tr("reset.none");
  if (w.passed) return tr("reset.passed", { day: day(w.resets), time: clock(w.resets) });
  const s = w.resets - now;
  if (s < D) return tr("reset.at", { time: clock(w.resets) });
  if (s < 2 * D) return tr("reset.h", { n: Math.round(s / H) });
  return tr("reset.d", { n: Math.round(s / D) });
}

export function ago(sec, now) {
  if (sec == null) return tr("ago.unknown");
  const s = Math.max(0, now - sec);
  if (s < 60) return tr("ago.now");
  if (s < H) return tr("ago.min", { n: Math.round(s / 60) });
  if (s < D) return tr("ago.h", { n: Math.round(s / H) });
  return tr("ago.d", { n: Math.round(s / D) });
}
