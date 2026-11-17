// bun ~/.config/herdr-app/mods/kbrdn-status/ci.test.js
import { summarize } from "./ci.js";

const run = (status, conclusion) => ({ __typename: "CheckRun", status, conclusion });
const expect = (got, want) => {
  for (const k in want) if (got[k] !== want[k]) throw new Error(`${k}: ${got[k]} !== ${want[k]} in ${JSON.stringify(got)}`);
};

expect(summarize([run("COMPLETED", "SUCCESS"), run("COMPLETED", "SKIPPED")], "a", "a"), { state: "pass", passed: 2, total: 2 });
expect(summarize([], "a", "a"), { state: "none", total: 0 });
expect(summarize(null, "a", "a"), { state: "none" });
expect(summarize([run("COMPLETED", "SUCCESS"), run("IN_PROGRESS", null)], "a", "a"), { state: "pending", pending: 1 });
expect(summarize([run("COMPLETED", "FAILURE"), run("QUEUED", null)], "a", "a"), { state: "fail", failed: 1, pending: 1 });
expect(summarize([run("COMPLETED", "SUCCESS")], "a", "b"), { state: "stale" });
expect(summarize([{ __typename: "StatusContext", state: "PENDING" }], "a", "a"), { state: "pending" });
expect(summarize([{ __typename: "StatusContext", state: "ERROR" }], "a", "a"), { state: "fail" });
console.log("ci.js ok");
