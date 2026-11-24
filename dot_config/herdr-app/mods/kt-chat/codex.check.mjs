// bun mods/kt-chat/codex.check.mjs: an anonymized Codex rollout normalized for the existing Chat model,
// plus the safe terminal-to-rollout resolver. No real ~/.codex file is written or copied.
import assert from "node:assert/strict";
import { build } from "./chat-model.js";
import { index, marksOf, pickRollout, rolloutFromLsof } from "./codex-index.ts";
import { CODEX_RECHECK_MS, resolveCodexLink, shouldPollCodex } from "./codex-link.js";

const file = new URL("./codex-fixture.jsonl", import.meta.url);
const all = new Uint8Array(await Bun.file(file).arrayBuffer());
const run = (from = 0, to = all.length, opts = {}) => index(all.subarray(from, to), {
  from, size: all.length, path: file.pathname, lastTurns: 30, budget: 500000, maxEntries: 900, ...opts,
});

const full = run();
assert.equal(full.session, "codex-session-test");
assert.deepEqual(full.meta, { cwd: "/work/project", model: "gpt-test", source: "codex" });
assert.equal(full.bad, 0);
assert.ok(!JSON.stringify(full).includes("NOT-INDEXED"), "encrypted reasoning never leaves the indexer");
for (const e of full.entries) assert.equal(all[e.o - 1] ?? 10, 10, "every entry starts on a JSONL line");

const users = full.entries.filter((e) => e.k === "user");
assert.deepEqual(users.map((e) => [e.uuid, e.turn, e.text]), [
  ["u-1", true, "Corrige le test de café."],
  ["u-2", true, "Ajoute aussi le lint."],
]);
assert.equal(users[1].from.kind, "peer", "hc messages retain their sender classification");

const assistants = full.entries.filter((e) => e.k === "assistant");
assert.ok(assistants.some((e) => e.blocks.some((b) => b.t === "thinking" && b.text === "Je vérifie le test ciblé.")));
const call = assistants.flatMap((e) => e.blocks).find((b) => b.id === "call-1");
assert.deepEqual([call.t, call.name, call.kind, call.title], ["tool", "Bash", "execute", "await tools.exec_command({ cmd: \"bun test coffee\" });"]);
const result = full.entries.find((e) => e.k === "result" && e.tool === "call-1");
assert.equal(result.ok, true);
assert.ok(result.text.includes("1 test passed"));

const turns = build(full.entries);
assert.equal(turns.length, 2);
assert.equal(turns[0].blocks.find((b) => b.id === "call-1").state, "ok", "the result pairs with its call");
assert.ok(turns[0].blocks.some((b) => b.role === "prose" && b.text.includes("Le test passe")));
assert.ok(turns[1].blocks.some((b) => b.id === "call-2" && b.state === "ok"));

// Deltas use byte offsets exactly like chat-index.ts.
const cut = all.indexOf(10, Math.floor(all.length / 2)) + 1;
const a = run(0, cut);
const b = run(a.end);
assert.deepEqual([...a.entries, ...b.entries], full.entries);
assert.equal(b.end, full.end);

const marks = marksOf(all, { from: 0, size: all.length, path: file.pathname });
assert.deepEqual(marks.turns.map((t) => t.uuid), ["u-1", "u-2"]);
assert.deepEqual(marks.marks.map((m) => m.text), ["Corrige le test de café."], "the timeline keeps Kylian's messages, not peer notes");

// A live process gives the exact open rollout. The fallback accepts one unambiguous cwd/time match
// and refuses two candidates started almost together rather than showing the wrong session.
assert.equal(rolloutFromLsof("p12\nn/Users/test/.codex/sessions/2026/11/20/rollout-a.jsonl\n", "/Users/test"),
  "/Users/test/.codex/sessions/2026/11/20/rollout-a.jsonl");
assert.equal(rolloutFromLsof("n/tmp/not-a-rollout.jsonl\n", "/Users/test"), null);
assert.equal(rolloutFromLsof("n/Users/test/.codex/sessions/2026/11/20/rollout-a.jsonl\nn/Users/test/.codex/sessions/2026/11/20/rollout-b.jsonl\n", "/Users/test"), null,
  "two open rollouts are refused rather than guessed");
const made = Date.parse("2026-11-20T10:00:00Z");
const candidates = [
  { path: "/h/.codex/sessions/2026/11/20/rollout-old.jsonl", cwd: "/work/project", timestamp: made - 60000 },
  { path: "/h/.codex/sessions/2026/11/20/rollout-right.jsonl", cwd: "/work/project", timestamp: made + 8000 },
  { path: "/h/.codex/sessions/2026/11/20/rollout-other.jsonl", cwd: "/work/other", timestamp: made + 7000 },
];
assert.equal(pickRollout(candidates, { cwd: "/work/project", createdMs: made })?.path, candidates[1].path);
assert.equal(pickRollout([...candidates, { path: "/h/.codex/sessions/x.jsonl", cwd: "/work/project", timestamp: made + 9000 }],
  { cwd: "/work/project", createdMs: made }), null, "ambiguous starts are refused");

// A terminal address is stable across /new. Revalidate a live PID on a bounded cadence so the
// Chat leaves rollout-a for rollout-b, and invalidate immediately when a restarted PID changes.
const links = new Map();
const terminal = { foreground: { pid: 12 }, created_ms: made, cwd: "/work/project" };
const rollouts = [
  { path: "/h/.codex/sessions/2026/11/20/rollout-a.jsonl", session: "session-a" },
  { path: "/h/.codex/sessions/2026/11/20/rollout-b.jsonl", session: "session-b" },
  { path: "/h/.codex/sessions/2026/11/20/rollout-c.jsonl", session: "session-c" },
];
let resolutions = 0;
const resolve = async () => rollouts[resolutions++];
const firstLink = await resolveCodexLink(links, "t1", terminal, resolve, { now: 1000 });
assert.deepEqual([firstLink.path, firstLink.session, firstLink.checked, resolutions],
  [rollouts[0].path, "session-a", true, 1]);
const cachedLink = await resolveCodexLink(links, "t1", terminal, resolve, { now: 1000 + CODEX_RECHECK_MS - 1 });
assert.deepEqual([cachedLink.path, cachedLink.checked, resolutions], [rollouts[0].path, false, 1]);
const nextLink = await resolveCodexLink(links, "t1", terminal, resolve, { now: 1000 + CODEX_RECHECK_MS });
assert.deepEqual([nextLink.path, nextLink.session, nextLink.changed, resolutions],
  [rollouts[1].path, "session-b", true, 2], "the same PID switches rollout after the bounded recheck");
const restarted = { ...terminal, foreground: { pid: 13 } };
const restartedLink = await resolveCodexLink(links, "t1", restarted, resolve, { now: 1001 + CODEX_RECHECK_MS });
assert.deepEqual([restartedLink.path, restartedLink.session, restartedLink.changed, resolutions],
  [rollouts[2].path, "session-c", true, 3], "a new PID invalidates the address cache immediately");
assert.equal(shouldPollCodex({ shown: true, fixed: false, codex: true, status: "idle" }), true,
  "an idle Codex Chat keeps the bounded rollout recheck alive");
assert.equal(shouldPollCodex({ shown: false, fixed: false, codex: true, status: "idle" }), false);
assert.equal(shouldPollCodex({ shown: true, fixed: false, codex: true, status: "working" }), false,
  "the existing live tail already rechecks a working Codex");
assert.equal(shouldPollCodex({ shown: true, fixed: false, codex: true, status: "done" }), true);
assert.equal(shouldPollCodex({ shown: true, fixed: "/tmp/x.jsonl", codex: true, status: "idle" }), false, "a fixed file has no rollout");
assert.equal(shouldPollCodex({ shown: true, fixed: null, codex: false, status: "idle" }), false, "Claude follows its status line");

// The CLI speaks the same wire format as the mod.
const cli = async (...args) => {
  const p = Bun.spawn([process.execPath, new URL("./codex-index.ts", import.meta.url).pathname, ...args], { stdout: "pipe" });
  return JSON.parse(await new Response(p.stdout).text());
};
const wire = await cli(file.pathname);
assert.deepEqual(wire.entries, JSON.parse(JSON.stringify(full.entries)));
assert.deepEqual((await cli(file.pathname, "--marks")).marks, marks.marks);
assert.deepEqual(await cli("/nonexistent/codex.jsonl"), { error: "missing", path: "/nonexistent/codex.jsonl" });

console.log("codex: ok");
