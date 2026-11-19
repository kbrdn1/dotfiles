// bun ~/.config/herdr-app/mods/kt-chat/chat-model.check.mjs: chat-index.ts (byte offsets, partial
// line, heavy lines skipped, trimmed outputs, last K turns) and chat-model.js (merge, pairing,
// turns, items, fold, tally, queue, ingest) on chat-fixture.jsonl, an invented session.
import assert from "node:assert/strict";
import { index, startsTurn, strip, normalize } from "./chat-index.ts";
import { build, fold, foldedSteps, ingest, items, merge, pendingQueue, prepend, tally, toolKind, toolTitle, trim } from "./chat-model.js";

const all = new Uint8Array(await Bun.file(new URL("./chat-fixture.jsonl", import.meta.url)).arrayBuffer());
const run = (from = 0, to = all.length, opts = {}) => index(all.subarray(from, to), { from, size: all.length, path: "/f.jsonl", home: "/w", ...opts });

// ── The indexer ─────────────────────────────────────────────────────────────

const full = run();
const partialStart = all.lastIndexOf(10) + 1;
assert.equal(full.end, partialStart, "the line being written waits: end is after the last newline");
assert.ok(partialStart < all.length);
assert.equal(full.bad, 0);
assert.equal(full.session, "s-test");
assert.equal(full.meta.title, "Réparer le café ☕");
assert.equal(full.meta.permission, "default");
assert.equal(full.meta.cwd, "/w/proj");
assert.equal(full.start, 0);
assert.equal(full.more, false);
const text = JSON.stringify(full);
for (const secret of ["SECRET", "HEAVY", "BASE64-IMAGE-DATA", "META-SKILL-CONTENT", "SIG"]) assert.ok(!text.includes(secret), `${secret} never leaves the indexer`);
assert.ok(full.skipped >= 2, "api-request and deferred_tools_record skipped on their head");
assert.ok(!text.includes("\u001b["), "ANSI codes stripped");

// Byte offsets: an entry's `o` is where its line starts in the file, accents and emoji included.
const dec = new TextDecoder();
for (const e of full.entries) assert.equal(all[e.o - 1] ?? 10, 10, "every offset is a line start");
const first = full.entries.find((e) => e.k === "user");
assert.ok(dec.decode(all.subarray(first.o, first.o + 60)).includes('"u-01"') || dec.decode(all.subarray(first.o, all.indexOf(10, first.o))).includes('"uuid":"u-01"'));

// Cut anywhere (mid-line, mid-emoji): reading up to the cut, then `--from end`, gives the same
// entries as one read.
const emoji = all.indexOf(0xf0); // first byte of 🍵
for (const cut of [emoji + 1, emoji + 2, Math.floor(all.length / 2), partialStart - 1, partialStart + 3]) {
  const a = run(0, cut);
  assert.equal(all[a.end - 1], 10, `cut ${cut}: end after a newline`);
  const b = run(a.end);
  assert.deepEqual([...a.entries, ...b.entries], full.entries, `cut ${cut}: two reads = one read`);
  assert.equal(b.end, full.end);
  const s = ingest(ingest(null, a), b);
  assert.deepEqual(s.entries, full.entries, `cut ${cut}: ingest appends the delta`);
  assert.equal(s.end, full.end);
}

// Trimmed outputs.
const res = (id) => full.entries.find((e) => e.k === "result" && e.tool === id);
assert.deepEqual(res("t1").file, { path: "/w/proj/src/thé.js", lines: 3, start: 1, total: 3 });
assert.equal(res("t1").text, "");
assert.deepEqual(res("t2").diff[0].lines, ["-a", "+a", "+b"]);
assert.equal(res("t2").path, "/w/proj/src/thé.js");
assert.equal(res("t3").text, "ok 3 tests");
assert.deepEqual(res("t4").agent, { id: "a-1", name: "Explorer le dépôt", type: null, color: null, model: "model-y", status: "completed", async: false });
assert.equal(res("t4").text, "Rapport : 2 fichiers");
assert.equal(res("t5"), undefined, "the interrupted call has no result");
const u1 = full.entries.find((e) => e.uuid === "u-01");
assert.equal(u1.text, "Ajoute un bouton « thé » 🍵");
assert.equal(u1.images, 1);
assert.deepEqual(full.entries.find((e) => e.k === "file"), { k: "file", o: full.entries.find((e) => e.k === "file").o, at: Date.parse("2026-01-01T10:00:00.100Z"), path: "src/thé.js" });

// Turn openers: prompt, task-notification, prompt, peer (meta), command, teammate.
const openers = full.entries.filter((e) => e.k === "user" && e.turn);
assert.deepEqual(openers.map((e) => e.uuid), ["u-01", "u-14", "u-16", "u-25", "u-27", "u-29"]);
assert.deepEqual(openers[1].from, { kind: "task", status: "completed" });
assert.equal(openers[1].text, "Build fini");
assert.deepEqual(openers[3].from, { kind: "peer", name: "pair-a", color: null });
assert.equal(openers[3].text, "Salut");
assert.deepEqual(openers[4].cmd, { name: "/model", args: "fable" });
assert.deepEqual(openers[5].from, { kind: "teammate", name: "helper", color: "blue" });
assert.equal(openers[5].text, "Coucou");
assert.ok(!full.entries.some((e) => e.uuid === "u-24"), "isMeta without turnPosition is hidden");
assert.ok(!full.entries.some((e) => e.k === "user" && e.uuid === "u-23"), "the compaction summary is not a turn");

// hc send's and a paste's wrappers come off (#56, seen on a throwaway session): the text inside.
assert.equal(strip('<hc from="t1">Bonjour</hc>'), "Bonjour");
assert.equal(strip('\n\n<pasted_content id="0945">\n<hc from="t1">une\ndeux\n```js\nx\n```</hc>\n</pasted_content id="0945">\n'), "une\ndeux\n```js\nx\n```");
assert.equal(strip('avant <pasted_content id="a">collé</pasted_content id="a"> après'), "avant collé après");
assert.equal(strip("rien à enlever <hc> au milieu"), "rien à enlever <hc> au milieu", "an <hc> that doesn't wrap the whole text stays");
const sent = normalize({ type: "user", uuid: "u-x", timestamp: "2026-01-01T10:00:00Z", turnPosition: {}, message: { content: '<hc from="t1">Envoyé par le Chat</hc>' } }, 0, {}, "");
assert.equal(sent[0].text, "Envoyé par le Chat");
assert.equal(sent[0].turn, true);
const queued = normalize({ type: "queue-operation", operation: "enqueue", content: '<hc from="t1">en file</hc>' }, 0, {}, "");
assert.equal(queued[0].text, "en file");
const handed = normalize({ type: "attachment", uuid: "u-y", attachment: { type: "queued_command", commandMode: "prompt", prompt: '<hc from="t1">pendant</hc>' } }, 0, {}, "");
assert.deepEqual([handed[0].k, handed[0].turn, handed[0].text], ["user", false, "pendant"]);

// Older lines, without turnPosition.
assert.equal(startsTurn({ type: "user", message: { content: "salut" } }, "salut"), true);
assert.equal(startsTurn({ type: "user", isMeta: true, message: { content: "x" } }, "x"), false);
assert.equal(startsTurn({ type: "user", message: { content: [{ type: "tool_result" }] } }, ""), false);
assert.equal(startsTurn({ type: "user", message: { content: "[Request interrupted by user]" } }, "[Request interrupted by user]"), false);

// Last K turns: cut on the opener's line, `more`, then the older page put in front.
const last2 = run(0, all.length, { lastTurns: 2 });
assert.equal(last2.start, openers[4].o);
assert.equal(last2.more, true);
assert.deepEqual(last2.entries.filter((e) => e.k === "user" && e.turn).map((e) => e.uuid), ["u-27", "u-29"]);
const older = run(0, last2.start, { lastTurns: 30 });
assert.equal(older.end, last2.start);
const paged = prepend(ingest(null, last2), older);
assert.deepEqual(paged.entries, full.entries);
assert.equal(paged.more, false);
// The budget cuts too, never below one entry, on a line start.
const tight = run(0, all.length, { budget: 1 });
assert.equal(tight.entries.length, 1);
assert.equal(tight.start, tight.entries[0].o);
const few = run(0, all.length, { maxEntries: 3 });
assert.ok(few.entries.length <= 3 && few.more);

// The CLI: it slices the file itself, starts again from 0 past the end, says a missing file.
const cli = async (...args) => {
  const p = Bun.spawn([process.execPath, new URL("./chat-index.ts", import.meta.url).pathname, ...args], { stdout: "pipe", env: { ...process.env, HOME: "/w" } });
  return JSON.parse(await new Response(p.stdout).text());
};
const fixturePath = new URL("./chat-fixture.jsonl", import.meta.url).pathname;
const wire = (x) => JSON.parse(JSON.stringify(x)); // what the mod gets: no undefined keys
const viaCli = await cli(fixturePath);
assert.deepEqual(viaCli.entries, wire(full.entries));
assert.equal(viaCli.end, full.end);
const mid = await cli(fixturePath, "--from", String(openers0()), "--to", String(full.end));
assert.deepEqual(mid.entries, wire(run(openers0()).entries));
assert.equal((await cli(fixturePath, "--from", "99999999")).from, 0);
assert.deepEqual(await cli("/nonexistent/x.jsonl"), { error: "missing", path: "/nonexistent/x.jsonl" });
function openers0() {
  return full.entries.find((e) => e.uuid === "u-14").o;
}

// ── The model ───────────────────────────────────────────────────────────────

// Merge: the three lines of m1 are one message, in order.
const m1 = merge(full.entries).filter((e) => e.mid === "m1");
assert.equal(m1.length, 1);
assert.deepEqual(m1[0].blocks.map((b) => b.t), ["thinking", "text", "tool"]);
assert.deepEqual(merge([...full.entries, full.entries.find((e) => e.uuid === "u-04")]).filter((e) => e.mid === "m1")[0].blocks.length, 3, "a line written twice counts once");

const turns = build(full.entries);
assert.equal(turns.length, 6);
const [t1, t2, t3, t4, t5, t6] = turns;

// Turn 1: pairing, items, fold, tally, duration, the model that answered.
assert.equal(t1.ms, 65000);
assert.equal(t1.model, "model-x");
assert.deepEqual(t1.files, ["src/thé.js"]);
const read = t1.blocks.find((b) => b.id === "t1");
assert.equal(read.result.file.lines, 3);
assert.equal(read.state, "ok");
assert.equal(read.title, "src/thé.js");
assert.equal(t1.blocks.find((b) => b.id === "t3").title, "bun test");
assert.deepEqual(t1.items.map((i) => i.type), ["activity", "block", "activity", "block"]);
assert.deepEqual(t1.fold, { start: 0, end: 2 }, "the work and its commentary fold, the answer stays");
const t1Steps = foldedSteps(t1.items, t1.fold);
const sum = tally(t1Steps);
assert.deepEqual([sum.reads, sum.edits, sum.runs, sum.searches, sum.thoughts, sum.thinkMs], [1, 1, 1, 0, 1, 4200]);
assert.deepEqual(sum.order, ["research", "edit", "run"]);
assert.equal(sum.kind, "edit", "a tie breaks towards the kind that changed the most");
assert.equal(sum.current, "run");

// Turn 2: the task-notification turn, prose only, nothing to fold.
assert.equal(t2.user.from.kind, "task");
assert.equal(t2.fold, null);

// Turn 3, settled: the sub-agent and the interjection join the work; the call cut short is
// stopped; interruption and compaction keep their rows; no prose, no fold.
assert.equal(t3.blocks.find((b) => b.id === "t5").state, "stopped");
assert.equal(t3.blocks.find((b) => b.id === "t4").result.agent.id, "a-1");
assert.deepEqual(t3.items.map((i) => i.type + (i.block ? ":" + (i.block.kind ?? i.block.role) : "")), ["activity", "block:interrupt", "block:compact"]);
assert.deepEqual(t3.items[0].steps.map((b) => b.role), ["tool", "note", "tool"]);
assert.equal(t3.items[0].steps[1].text, "et le sucre ?");
const compact = t3.items[2].block;
assert.deepEqual([compact.trigger, compact.tokens, compact.text], ["auto", 1000, "Résumé : on a fait X."]);
assert.equal(t3.fold, null);

// Turn 3 live (the session stops after the sub-agent's result): its row stays out of the work,
// the interjection keeps its own row.
const upTo = (uuid) => full.entries.filter((e) => e.o < full.entries.find((x) => x.uuid === uuid).o);
const liveTurns = build(upTo("u-20"), { live: true });
const live3 = liveTurns[liveTurns.length - 1];
assert.equal(live3.live, true);
assert.equal(liveTurns[0].live, false, "only the last turn is live");
assert.deepEqual(live3.items.map((i) => i.type + (i.block ? ":" + i.block.role : "")), ["subagents", "block:note"]);
const running = build(upTo("u-21"), { live: true });
assert.equal(running[running.length - 1].blocks.find((b) => b.id === "t5").state, "running");

// Turns 4 to 6: peer, command with its output, teammate with an API error then prose.
assert.equal(t4.user.meta, true);
assert.equal(t5.items[0].block.kind, "command");
assert.equal(t5.items[0].block.text, "Set model to fable");
assert.deepEqual(t6.items.map((i) => i.block.role + ":" + (i.block.kind ?? "")), ["notice:error", "prose:"]);
assert.equal(t6.items[0].block.code, "rate_limit");

// fold(): a notice stops it; prose before work and after folds the whole run.
const p = (id) => ({ type: "block", id, block: { role: "prose", id, text: id } });
const a = (id) => ({ type: "activity", id, steps: [] });
const n = (id) => ({ type: "block", id, block: { role: "notice", id, kind: "error" } });
assert.deepEqual(fold([p("q"), a("1"), p("r"), a("2"), p("ans")]), { start: 0, end: 3 });
assert.deepEqual(fold([a("1"), n("e"), a("2"), p("ans")]), { start: 2, end: 2 });
assert.equal(fold([a("1"), a("2")]), null, "no answer yet, nothing folds");
assert.equal(fold([p("ans")]), null);
// items(): empty prose is dropped; a failed sub-agent keeps its row even settled.
const failed = { role: "tool", id: "x", kind: "agent", state: "error" };
assert.deepEqual(items([{ role: "prose", id: "e", text: "  " }, failed]).map((i) => i.type), ["subagents"]);

// Queue: FIFO, remove by text, no text and task-notifications left out.
assert.deepEqual(pendingQueue(full.entries).map((q) => q.text), ["deux 🙂"]);

// Another session replaces the state; a delta that doesn't continue it too.
const s1 = ingest(null, full);
assert.equal(ingest(s1, { ...full, session: "s-other", start: full.end, from: full.end, entries: [] }).session, "s-other");
assert.equal(ingest(s1, { ...full, start: full.end, from: full.end, entries: [] }).entries.length, full.entries.length, "same session, continuing delta: appended (nothing new)");
const gap = ingest(s1, { ...last2, start: last2.start + 1 });
assert.equal(gap.entries.length, last2.entries.length, "a delta cut by the budget replaces");
assert.equal(ingest(s1, { ...full, path: "/g.jsonl" }).path, "/g.jsonl");

// The live tail tells « nothing came » by identity: a delta without entries keeps the entries array
// (its end still moves on), trim under the cap keeps the state.
const s0 = ingest(null, run(0, full.entries[5].o));
const quiet = ingest(s0, { ...run(s0.end, s0.end), path: s0.path });
assert.equal(quiet.entries, s0.entries);
assert.equal(trim(quiet, 1000), quiet);
const moved = ingest(s0, run(s0.end));
assert.notEqual(moved.entries, s0.entries);

// Trim: the live tail past `max` entries drops whole turns from the top, then reads them back.
const big = ingest(null, full);
assert.equal(trim(big, 1000), big, "under the cap: untouched");
const cut = trim(big, 12);
assert.ok(cut.entries.length <= 12 && cut.more);
assert.equal(cut.entries[0].k === "user" && cut.entries[0].turn, true, "the cut falls on a turn's opener");
assert.equal(cut.start, cut.entries[0].o);
assert.deepEqual(prepend(cut, run(0, cut.start)).entries, full.entries, "what was trimmed reads back with --to start");
const inside = trim({ ...big, entries: big.entries.filter((e) => !(e.k === "user" && e.turn)) }, 5);
assert.equal(inside.entries.length, 5, "no opener in reach: a cut inside the turn, on a line start");
assert.equal(inside.start, inside.entries[0].o);

// Tool kinds and titles.
assert.deepEqual(["Read", "Edit", "Write", "MultiEdit", "Bash", "Grep", "Glob", "Agent", "Task", "Skill", "TodoWrite", "WebFetch"].map(toolKind), ["read", "edit", "edit", "edit", "execute", "search", "search", "agent", "agent", "skill", "tasks", "other"]);
assert.equal(toolTitle("Grep", { pattern: "foo", path: "/w/proj/src" }, "/w/proj", "/w"), "foo · src");
assert.equal(toolTitle("Read", { file_path: "/w/other/x.md" }, "/w/proj", "/w"), "~/other/x.md");
assert.equal(toolTitle("WebFetch", { url: "https://example.test/a" }), "https://example.test/a");
assert.equal(toolTitle("Bash", { command: "\n\nls -la\nmore" }), "ls -la");

console.log("chat-model ok");
