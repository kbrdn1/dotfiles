// The colour hierarchy of Kylian's Claude Code status line (~/.claude/scripts/statusline.ts), for every
// gauge in Herdr: ok purple, warn yellow, alarm red (cost: ok green). The kbrdn themes carry those exact
// colours (dark: ansi13 #C79BFF, ansi11 #FFDF61, ansi9 #FF7A7A, ansi10 green; light: readable variants),
// so a level is a theme token, never a hex. Copied as is where it is used (cmp); check: levels.check.mjs.

// Context tracks performance ("context rot"), not fill: on a 1M window yellow from 20 %, red from 50 %;
// on a 200K-class window yellow from 55 %, red from 75 % (statusline.ts contextColor).
export function ctxLevel(pct, windowSize) {
  if (pct == null) return null;
  const [warn, alarm] = windowSize >= 1_000_000 ? [20, 50] : [55, 75];
  return pct >= alarm ? "alarm" : pct >= warn ? "warn" : "ok";
}

// A rate-limit window (5h, 7j, Fable): the API's own severity when it gives one, else 60 / 85 (the
// thresholds Herdr's rings already used). The status line itself shows no quota.
export function quotaLevel(pct, severity) {
  const s = typeof severity === "string" ? severity.toLowerCase() : "";
  if (/crit|exceed|high|alarm|error/.test(s)) return "alarm";
  if (/warn|medium|approach/.test(s)) return "warn";
  if (pct == null) return null;
  return pct > 85 ? "alarm" : pct >= 60 ? "warn" : "ok";
}

// A session's cost in API-equivalent dollars, scaled to the model's input price (statusline.ts costColor).
export function costLevel(usd, model = "") {
  if (usd == null) return null;
  const m = String(model).toLowerCase();
  const [warn, alarm] = m.includes("opus") ? [5, 25] : m.includes("haiku") ? [1, 5] : [3, 15];
  return usd >= alarm ? "alarm" : usd >= warn ? "warn" : "ok";
}

// The theme colour of a level; `okGreen` for cost, whose calm state is green in the status line.
export function levelColor(t, level, { okGreen = false } = {}) {
  if (level === "alarm") return t.ansi9 ?? t.ansi1;
  if (level === "warn") return t.ansi11 ?? t.ansi3;
  if (level === "ok") return okGreen ? (t.ansi10 ?? t.ansi2) : (t.ansi13 ?? t.ansi5);
  return t.muted;
}
