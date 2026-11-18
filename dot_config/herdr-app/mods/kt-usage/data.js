// data.js: what kt-usage makes of the files it reads, as pure functions (no herdr, no gpui-kit),
// so Bun checks it (data.check.mjs). The rules are herdr-agent-quota's, transposed:
// src/providers/claude.rs (statusLine rate_limits) and src/providers/codex.rs (window_kind, the
// rollout tail). A window never shows a number it doesn't have: missing stays missing, a window
// whose reset is behind the reading shows "unknown", never its old percent.

const H = 3600;
const D = 86400;
const pad = (n) => String(n).padStart(2, "0");
export const clock = (sec) => { const d = new Date(sec * 1000); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
export const day = (sec) => { const d = new Date(sec * 1000); return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`; };

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

// « mar. 24 nov. 20:00 », by hand (no Intl in the mod's runtime to count on).
const DAYS = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];
const MONTHS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
export const frDate = (sec) => { const d = new Date(sec * 1000); return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]} ${clock(sec)}`; };

// When a limit reset is worth it: the weekly window above 90 % AND its own return to zero more than
// 24 h away. Advice only: it reads the weekly window, it never uses a reset (that's claude.ai's).
export function resetAdvice(week, now) {
  if (!week || week.missing) return { worth: false, text: "Conseil impossible : la limite hebdomadaire n'est pas fournie en ce moment." };
  if (week.passed) return { worth: false, text: "Conseil impossible : la limite hebdomadaire est repassée à zéro depuis la dernière lecture." };
  if (week.resets == null) return { worth: false, text: "Conseil impossible : l'heure du retour à zéro n'est pas fournie." };
  const pct = Math.round(week.used);
  const worth = week.used > 90 && week.resets - now > D;
  return { worth, text: `Hebdo ${pct} %, retour à zéro ${frDate(week.resets)} : ${worth ? "un reset vaut le coup" : "pas besoin d'un reset maintenant"}` };
}

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
  if (w.resets == null) return "reset non fourni";
  if (w.passed) return `réinitialisée le ${day(w.resets)} à ${clock(w.resets)}`;
  const s = w.resets - now;
  if (s < D) return `reset ${clock(w.resets)}`;
  if (s < 2 * D) return `reset dans ${Math.round(s / H)} h`;
  return `reset dans ${Math.round(s / D)} j`;
}

export function ago(sec, now) {
  if (sec == null) return "date inconnue";
  const s = Math.max(0, now - sec);
  if (s < 60) return "à l'instant";
  if (s < H) return `il y a ${Math.round(s / 60)} min`;
  if (s < D) return `il y a ${Math.round(s / H)} h`;
  return `il y a ${Math.round(s / D)} j`;
}
