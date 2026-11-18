// bun mods/kt-usage/data.check.mjs: the rules of data.js on the shapes really on this machine.
import { windowLabel, claudeWindows, codexReading, codexWindows, dayCost, resetLabel, ago, toUnix, tierLabel, frDate, resetAdvice } from "./data.js";

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


if (failed) process.exit(1);
console.log("data.check: ok");
