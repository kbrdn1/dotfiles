// bun mods/kt-usage/data.check.mjs: the rules of data.js on the shapes really on this machine.
import { windowLabel, claudeWindows, codexReading, codexWindows, dayCost, resetLabel, ago, toUnix, tierLabel, frDate, resetAdvice, parseOauthUsage, moneyLabel } from "./data.js";

let failed = 0;
const ok = (cond, what) => { if (!cond) { failed++; console.error("FAIL", what); } };
const NOW = 1794985005;

// Windows by length, as codex.rs window_kind.
ok(windowLabel(300) === "5h" && windowLabel(299) === "5h" && windowLabel(10079) === "7j", "durations near 5h / 7d");
ok(windowLabel(60) === null && windowLabel(43200) === null, "other lengths skipped");

// Claude: herdr-quota.json today has only seven_day.
const cw = claudeWindows({ seven_day: { used_percentage: 39, resets_at: 1795546800 }, updated_at: NOW }, NOW);
ok(cw[0].label === "5h" && cw[0].missing, "Claude 5h missing, said so");
// 561 795 s = 6.5 days: kbrdn-status's left() says 7j, so does the console.
ok(cw[1].used === 39 && !cw[1].passed && resetLabel(cw[1], NOW) === "reset dans 7 j", "Claude 7j 39 %, reset in 7 days (status bar rounding)");
ok(claudeWindows({ five_hour: { used_percentage: 57, resets_at: "2026-08-15T12:00:00Z" } }, 1)[0].resets === 1786795200, "RFC 3339 reset");
ok(claudeWindows(null, NOW).every((w) => w.missing), "no file: both missing");

// Ultra: five_hour null, only seven_day; a five_hour coming back shows as a window again.
ok(claudeWindows({ five_hour: null, seven_day: { used_percentage: 43 } }, NOW)[0].missing, "Ultra: no 5h");
ok(claudeWindows({ five_hour: { used_percentage: 12, resets_at: NOW + 600 } }, NOW)[0].used === 12, "a returning five_hour shows");
ok(tierLabel("default_claude_max_20x") === "Max 20x" && tierLabel(null) === null, "tier label");

// Reset advice: worth it only above 90 % with the weekly return to zero more than 24 h away.
const wk = (used, inH) => ({ label: "7j", used, resets: NOW + inH * 3600, passed: false });
ok(frDate(1795546800) === "mar. 24 nov. 20:00", `French date (${frDate(1795546800)})`);
ok(resetAdvice({ label: "7j", used: 44, resets: 1795546800 }, NOW).text === "Hebdo 44 %, retour à zéro mar. 24 nov. 20:00 : pas besoin d'un reset maintenant", "44 %: no need");
ok(!resetAdvice(wk(90, 48), NOW).worth, "90 % exactly: no");
ok(resetAdvice(wk(91, 25), NOW).worth && resetAdvice(wk(91, 25), NOW).text.endsWith("un reset vaut le coup"), "91 %, 25 h: worth it");
ok(!resetAdvice(wk(95, 23), NOW).worth, "95 %, 23 h: no, it comes back by itself");
ok(resetAdvice({ label: "7j", missing: true }, NOW).text.startsWith("Conseil impossible"), "missing: no guess");
ok(resetAdvice({ label: "7j", used: null, last: 99, resets: NOW - 10, passed: true }, NOW).text.startsWith("Conseil impossible"), "passed: no guess");

// Codex: the real newest rollout's token_count (17/11): 5h reset since, 7d still running.
const line = JSON.stringify({ timestamp: "2026-11-16T23:20:34.736Z", type: "event_msg", payload: { type: "token_count",
  rate_limits: { limit_id: "codex", primary: { used_percent: 76, window_minutes: 300, resets_at: 1794882798 },
    secondary: { used_percent: 12, window_minutes: 10080, resets_at: 1795469598 }, plan_type: "plus" } } });
const r = codexReading(['{"cut', JSON.stringify({ type: "event_msg", payload: { type: "token_count", rate_limits: null } }), line, '{"type":"response_item"}']);
ok(r && r.plan === "plus" && r.at === toUnix("2026-11-16T23:20:34.736Z"), "newest token_count with rate_limits, plan_type");
const xw = codexWindows(r.limits, NOW);
ok(xw[0].label === "5h" && xw[0].passed && xw[0].used === null && xw[0].last === 76, "5h reset since: unknown, not 76 %");
ok(/^réinitialisée le \d\d\/\d\d à \d\d:\d\d$/.test(resetLabel(xw[0], NOW)), "passed reset label");
ok(xw[1].label === "7j" && xw[1].used === 12 && resetLabel(xw[1], NOW) === "reset dans 6 j", "7j 12 %");
ok(codexWindows({ primary: { used_percent: 11, window_minutes: 10080 }, secondary: null }, NOW)[0].missing, "only 7d: 5h missing");
ok(codexReading(["nope", '{"payload":{"type":"token_count","info":{}}}']) === null, "no rate_limits: null");

// Reset labels.
ok(/^reset \d\d:\d\d$/.test(resetLabel({ resets: NOW + 3600 }, NOW)), "under a day: clock");
ok(resetLabel({ resets: NOW + 30 * 3600 }, NOW) === "reset dans 30 h", "a day and more: hours to 48 h");
ok(resetLabel({ resets: null }, NOW) === "reset non fourni", "no reset");
ok(ago(NOW - 120, NOW) === "il y a 2 min" && ago(NOW - 31 * 3600, NOW) === "il y a 1 j", "ago");

// Day cost: last cost_usd per session, today only, no double count.
const mid = NOW - 7 * 3600;
const c = dayCost([
  { file: "herdr-t1.json", session_id: "a", cost_usd: 10, updated_at: NOW - 60 },
  { file: "herdr-t9.json", session_id: "a", cost_usd: 4, updated_at: NOW - 3600 },  // same session, older
  { file: "herdr-t2.json", session_id: "b", cost_usd: 2.5, updated_at: NOW - 10 },
  { file: "herdr-t3.json", session_id: "c", cost_usd: 99, updated_at: mid - 1 },    // yesterday
  { file: "herdr-t4.json", session_id: "d", cost_usd: null, updated_at: NOW },
  { file: "herdr-t5.json", session_id: "e", cost_usd: 0, updated_at: NOW },
], mid);
ok(c.total === 12.5 && c.sessions === 2, `day cost 12.5 over 2 sessions (got ${c.total} / ${c.sessions})`);


// /api/oauth/usage: a real answer of 2026-11-18 (scratchpad/orch/usage-real.json, no token in it), the
// useful keys only, plus coded internal keys that must not come through. `now` in seconds, as main.js.
const REAL_NOW = 1795004483; // 2026-11-18T12:21:23Z, its seven_day_breakdown.as_of
const real = {
  five_hour: null,
  limits: [
    { kind: "weekly_all", group: "weekly", percent: 60, severity: "normal", resets_at: "2026-11-24T19:00:00.451550+00:00", scope: null, is_active: true },
    { kind: "weekly_scoped", group: "weekly", percent: 0, severity: "normal", resets_at: "2026-11-24T19:00:00+00:00",
      scope: { model: { id: null, display_name: "Fable" }, surface: null }, is_active: false },
  ],
  seven_day_breakdown: { rows: [
    { key: "claude_code", display_name: "Claude Code", percent: 100, percent_of_limit: 60 },
    { key: "chat", display_name: "Chats", percent: 0, percent_of_limit: 0 },
    { key: "cowork", display_name: "Cowork", percent: 0, percent_of_limit: 0 },
    { key: "other", display_name: "Other", percent: 0, percent_of_limit: 0 },
  ] },
  weekly_scoped_shares: [{ limit_index: 1, used_percent_of_weekly: 0, allowance_percent_of_weekly: 50 }],
  extra_usage: { is_enabled: false, monthly_limit: null, used_credits: null, currency: null, disabled_reason: null, user_disabled: true },
  spend: { used: { amount_minor: 0, currency: "USD", exponent: 2 }, limit: null, percent: 0, severity: "normal", enabled: false, disabled_reason: null },
  amber_secret: { a: 1 }, brass_thimble: 7,
};
const u = parseOauthUsage(real, REAL_NOW);
ok(u.week.used === 60 && u.week.severity === "normal" && u.week.active === true && u.week.resets === toUnix("2026-11-24T19:00:00.451550+00:00"), "weekly_all: 60 %, normal, active");
ok(resetLabel(u.week, REAL_NOW) === "reset dans 6 j", `weekly_all reset (${resetLabel(u.week, REAL_NOW)})`);
ok(u.scoped.used === 0 && u.scoped.active === false && u.scoped.name === "Fable", `weekly_scoped: Fable from scope.model (${u.scoped.name})`);
ok(u.rows.map((r) => `${r.label} ${r.value}`).join(", ") === "Claude Code 100, Chats 0, Cowork 0, Other 0", "four surfaces");
ok(u.shares.length === 1 && u.shares[0].label === "Fable" && u.shares[0].value === 50 && u.shares[0].used === 0, "Fable: 50 % of the week allowed, 0 % used (limit_index)");
ok(u.extra.enabled === false && u.extra.byUser === true && u.extra.used === null, "extra usage: off, by the user");
ok(u.spend.enabled === false && u.spend.used.amount === 0 && u.spend.used.currency === "USD" && moneyLabel(u.spend.used) === "0,00 USD", "spend: off, 0,00 USD used");
ok(moneyLabel(parseOauthUsage({ spend: { used: { amount_minor: 1234, currency: "EUR", exponent: 2 } } }, NOW).spend.used) === "12,34 EUR", "minor units / 10^exponent");
ok(!JSON.stringify(u).includes("amber") && !JSON.stringify(u).includes("brass"), "coded keys never come through");
const odd = parseOauthUsage({ limits: [{ kind: "weekly_all", percent: "lots" }], seven_day_breakdown: { rows: "x" }, weekly_scoped_shares: [{ limit_index: 9 }] }, NOW);
ok(odd.week === null && odd.rows.length === 0 && odd.shares.length === 0 && odd.extra === null, "unknown shapes: nothing, not a guess");
ok(parseOauthUsage(null, NOW) === null, "no body");

if (failed) process.exit(1);
console.log("data.check: ok");
