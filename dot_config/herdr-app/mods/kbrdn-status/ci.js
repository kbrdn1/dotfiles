// A PR's CI verdict, with ci-until-green's three false-green guards:
// checks of another commit are "stale", zero checks is "none", pending stays pending.
const OK = new Set(["SUCCESS", "NEUTRAL", "SKIPPED"]);

export function summarize(rollup, headOid, localHead) {
  const checks = rollup ?? [];
  let passed = 0, failed = 0, pending = 0;
  for (const c of checks) {
    const status = c.__typename === "StatusContext";
    const done = status ? !["PENDING", "EXPECTED"].includes(c.state) : c.status === "COMPLETED";
    if (!done) pending++;
    else if (OK.has(status ? c.state : c.conclusion)) passed++;
    else failed++;
  }
  const total = checks.length;
  const state = localHead && headOid && localHead !== headOid ? "stale"
    : total === 0 ? "none"
    : failed ? "fail"
    : pending ? "pending"
    : "pass";
  return { state, passed, failed, pending, total };
}
