// bun mods/kt-usage/summary.check.mjs: the shared "kt.usage.summary" usage-peek reads (summary.js).
import { usageSummary } from "./summary.js";
import { parseOauthUsage, codexReading } from "./data.js";

let failed = 0;
const ok = (cond, what) => { if (!cond) { failed++; console.error("FAIL", what); } };
const AT = 1795004483; // 2026-11-18T12:21:23Z
const MID = AT - 12 * 3600;

const usage = parseOauthUsage({
  limits: [
    { kind: "weekly_all", percent: 78, severity: "normal", resets_at: "2026-11-24T19:00:00+00:00", is_active: true },
    { kind: "weekly_scoped", percent: 3, resets_at: "2026-11-24T19:00:00+00:00", scope: { model: { display_name: "Fable" } }, is_active: false },
  ],
  weekly_scoped_shares: [{ limit_index: 1, used_percent_of_weekly: 1, allowance_percent_of_weekly: 50 }],
}, AT);
const reading = codexReading([JSON.stringify({ timestamp: "2026-11-18T11:00:00Z", payload: { type: "token_count",
  rate_limits: { primary: { used_percent: 76, window_minutes: 300, resets_at: AT - 60 },
    secondary: { used_percent: 12, window_minutes: 10080, resets_at: AT + 5 * 86400 }, plan_type: "plus" } } })]);
const files = [
  { file: "herdr-t1.json", session_id: "a", cost_usd: 10.005, updated_at: AT - 60 },
  { file: "herdr-t2.json", session_id: "b", cost_usd: 2.5, updated_at: AT - 10 },
  { file: "herdr-t3.json", session_id: "c", cost_usd: 99, updated_at: MID - 1 }, // yesterday
];
const d = {
  at: AT, programs: {},
  claude: { present: true, plan: "Ultra", files, quota: { seven_day: { used_percentage: 40, resets_at: AT + 86400 } } },
  api: { at: AT * 1000, usage },
  codex: { present: true, reading, from: "/Users/someone/.codex/sessions/2026/11/18/rollout-x.jsonl", rollouts: 3 },
  others: {},
};
const s = usageSummary(d, MID);
ok(s.v === 1 && s.at === AT, "v 1, at in unix s (d.at)");
ok(s.claude.plan === "Ultra", "plan");
ok(s.claude.week.used === 78 && s.claude.week.severity === "normal" && s.claude.week.resets === 1795546800, "week: the endpoint's over the statusLine's");
ok(s.claude.fable.name === "Fable" && s.claude.fable.used === 3 && s.claude.fable.active === false, "fable");
ok(s.claude.share.name === "Fable" && s.claude.share.used === 1 && s.claude.share.of === 50, "Fable's share");
ok(s.claude.day.usd === 12.51 && s.claude.day.sessions === 2, `today's cost to the cent, yesterday left out (${JSON.stringify(s.claude.day)})`);
ok(s.codex.plan === "plus" && s.codex.at === 1794999600, "codex plan and reading time");
ok(s.codex.five.used === 76 && s.codex.five.resets === AT - 60, "a passed reset keeps its reading (w.last): the reader judges");
ok(s.codex.week.used === 12, "codex week");
const json = JSON.stringify(s);
ok(!/rollout|someone|token|Bearer|herdr-t\d/.test(json), "no path, no file name, no token");

// The statusLine's week when the endpoint failed; nothing invented when nothing is there.
const fb = usageSummary({ ...d, api: { at: AT * 1000, error: "network" }, codex: { present: false, reading: null } }, MID);
ok(fb.claude.week.used === 40 && fb.claude.week.severity === null && fb.claude.fable === null && fb.claude.share === null, "fallback: the statusLine's week only");
ok(fb.codex === null, "no reading: codex null");
const none = usageSummary({ at: AT, claude: { present: true, plan: null, files: [], quota: null }, api: null, codex: null }, MID);
ok(none.claude.week === null && none.claude.day === null && none.claude.plan === null, "no data: nulls");
ok(usageSummary({ at: AT, claude: { present: false }, codex: { reading: null } }, MID).claude === null, "Claude absent: null");

if (failed) process.exit(1);
console.log("summary.check: ok");
