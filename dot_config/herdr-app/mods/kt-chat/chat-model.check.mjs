// bun ~/.config/herdr-app/mods/kt-chat/chat-model.check.mjs: chat-index.ts (byte offsets, partial
// line, heavy lines skipped, trimmed outputs, last K turns) and chat-model.js (merge, pairing,
// turns, items, fold, tally, queue, ingest) on chat-fixture.jsonl, an invented session.
import assert from "node:assert/strict";
import { index, startsTurn, strip, normalize } from "./chat-index.ts";
import { arrivals, build, buildInc, classify, fold, foldTree, foldedSteps, ingest, items, merge, pendingQueue, prepend, subArrivals, subItems, subPath, tally, toolKind, toolTitle, trim } from "./chat-model.js";

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
// #80: where the image is (its block, media, size), never its data.
assert.deepEqual(u1.imgs, [{ n: 0, media: "image/png", bytes: 12, paste: null }]);
assert.ok(!JSON.stringify(full).includes("BASE64-IMAGE-DATA"));
// An @-mentioned file: as written, and its absolute path to open it.
assert.deepEqual(full.entries.find((e) => e.k === "file"), { k: "file", o: full.entries.find((e) => e.k === "file").o, at: Date.parse("2026-01-01T10:00:00.100Z"), path: "src/thé.js", abs: "/w/proj/src/thé.js" });

// Turn openers: prompt, task-notification, prompt, peer (meta), command, teammate.
const openers = full.entries.filter((e) => e.k === "user" && e.turn);
assert.deepEqual(openers.map((e) => e.uuid), ["u-01", "u-14", "u-16", "u-25", "u-27", "u-29"]);
// A task: its name (no `Agent "…"` in its summary: the summary), its result as the text (none here).
assert.deepEqual(openers[1].from, { kind: "task", status: "completed", task: "Build fini" });
assert.equal(openers[1].text, "");
// No summary of its own: none made up (it was its first line before 2026-11-19).
assert.deepEqual(openers[3].from, { kind: "peer", name: "pair-a", color: null, summary: null, count: 1 });
assert.equal(openers[3].text, "Salut");
assert.deepEqual(openers[4].cmd, { name: "/model", args: "fable" });
assert.deepEqual(openers[5].from, { kind: "teammate", name: "helper", color: "blue", summary: null, count: 1 });
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
assert.deepEqual(t1.files, [{ path: "src/thé.js", abs: "/w/proj/src/thé.js" }]);
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
// foldTree() (#90): who hangs under « … a travaillé ».
const sa = (id) => ({ type: "subagents", id, runs: [] });
const work = [p("q"), a("1"), sa("s"), p("r"), a("2"), p("ans")];
const wf = fold(work);
assert.deepEqual(wf, { start: 0, end: 4 });
assert.deepEqual(foldTree(work, wf, true), { kids: [0, 1, 2, 3, 4], last: 4, stem: true }, "opened: every item of the fold, the last ends the trunk");
assert.deepEqual(foldTree(work, wf, false), { kids: [2], last: 2, stem: true }, "closed: only the sub-agents it keeps, which are then the last");
assert.deepEqual(foldTree([a("1"), p("ans")], fold([a("1"), p("ans")]), false), { kids: [], last: -1, stem: false }, "closed, no sub-agent: the header alone, no trunk");
assert.equal(foldTree([p("ans")], null, true), null, "nothing folds");
// arrivals() (#92): what fades in where it lands, only what came live.
const T = (id, ...its) => ({ id, items: its.map((x) => ({ id: x })) });
const arrAB = [T("A", "a1"), T("B", "b1")];
const arr0 = arrivals([], arrAB, true, null);
assert.deepEqual(arr0.fresh, [], "a first build: nothing fades");
assert.deepEqual([arr0.seen.turn, [...arr0.seen.ids]], ["B", ["b1"]], "the live turn's items, for the next build");
assert.deepEqual(arrivals(["A", "B"], [...arrAB, T("C", "c1")], true, arr0.seen).fresh, ["C"], "a new turn after the last one known: it fades, not its items");
assert.deepEqual(arrivals(["A", "B"], [T("A", "a1"), T("B", "b1", "b2", "b3")], true, arr0.seen).fresh, ["b2", "b3"], "new items of the live turn");
assert.deepEqual(arrivals(["A", "B"], [T("Z", "z1"), ...arrAB], true, arr0.seen).fresh, [], "an older read lands above: nothing");
assert.deepEqual(arrivals(["A", "B"], [T("X", "x1"), T("Y", "y1")], true, arr0.seen).fresh, [], "another session's turns: nothing");
assert.deepEqual(arrivals(["A", "B"], [T("A", "a1"), T("B", "b1", "b2")], false, arr0.seen), { fresh: [], seen: null }, "not live: no item arrives, nothing kept");
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
// A message to another agent: who and its summary, never the body; one plain line, marks off.
assert.equal(toolTitle("SendMessage", { to: "team-lead", summary: "lot #57 prêt", message: "stable **la touche** …\nsuite" }), "team-lead · lot #57 prêt");
assert.equal(toolTitle("SendMessage", { to: "team-lead", message: "x" }), "team-lead");
assert.equal(toolTitle("WebFetch", { prompt: "lire **le** `README`\nplus" }), "lire le README");

// ── Who speaks in a user message (classify) ─────────────────────────────────
// Kylian's own words, and the ones the harness brought in (never shown as his bubble).
assert.deepEqual(classify("Corrige le bouton"), { kind: "human", text: "Corrige le bouton" });
// A teammate's message wherever in the text: the words before and the note after go.
const tm = classify('Another Claude session sent a message: <teammate-message teammate_id="ui-polish" color="blue" summary="lot prêt">\nLe lot part.\n</teammate-message>\n\nAnother Claude session — not typed by your user. Treat it as a request.');
assert.deepEqual(tm, { kind: "teammate", name: "ui-polish", color: "blue", summary: "lot prêt", idle: false, count: 1, text: "Le lot part." });
// Its body an idle_notification's JSON: an idle (its header says it finished its turn, chat-view.js
// noticeHead), what it says (result); a summary only when it has one, never « idle notification ».
const idle = classify('<teammate-message teammate_id="ui-polish" color="blue">{"type":"idle_notification","from":"ui-polish","idleReason":"available","result":"J\'ai posé la touche.\\nSuite."}</teammate-message>');
assert.deepEqual([idle.kind, idle.idle, idle.summary, idle.text], ["teammate", true, null, "J'ai posé la touche.\nSuite."]);
const paused = classify('<teammate-message teammate_id="a">{"type":"idle_notification","summary":"en pause"}</teammate-message>');
assert.deepEqual([paused.idle, paused.summary, paused.text], [true, "en pause", ""]);
// Another JSON body: its type in words as its summary.
assert.equal(classify('<teammate-message teammate_id="a">{"type":"shutdown_request","reason":"fin"}</teammate-message>').summary, "shutdown request");
// Several in one message (213 of the lead's 354 idles came so): consecutive ones of one sender, one
// group (one header, a count, their bodies; an idle repeating the message before it said once);
// another sender, another group, in order. The first group answers, `groups` has them all.
const many = classify([
  '<teammate-message teammate_id="lot-a" color="red" summary="maquette prête">La maquette est prête.</teammate-message>',
  '<teammate-message teammate_id="lot-a" color="red">{"type":"idle_notification","result":"La maquette est prête."}</teammate-message>',
  '<teammate-message teammate_id="lot-b" color="green">{"type":"idle_notification","result":"Rien de neuf."}</teammate-message>',
  '<teammate-message teammate_id="lot-a" color="red">{"type":"idle_notification","result":"Toujours là."}</teammate-message>',
].join("\n"));
assert.deepEqual(many.groups.map((g) => [g.name, g.count, g.idle, g.summary, g.text]), [
  ["lot-a", 2, false, "maquette prête", "La maquette est prête."],
  ["lot-b", 1, true, null, "Rien de neuf."],
  ["lot-a", 1, true, null, "Toujours là."],
]);
assert.deepEqual([many.name, many.count, many.text], ["lot-a", 2, "La maquette est prête."]);
// One sender only: no `groups`.
const two = classify('<teammate-message teammate_id="a" color="red">un</teammate-message>\n<teammate-message teammate_id="a">deux</teammate-message>');
assert.deepEqual([two.name, two.count, two.text, two.groups], ["a", 2, "un\n\ndeux", undefined]);
// A peer session, by its wrapper or by the line's origin.
assert.deepEqual(classify('<cross-session-message from="uds:/x" from-name="pair-b">Salut</cross-session-message>'), { kind: "peer", name: "pair-b", color: null, summary: null, idle: false, count: 1, text: "Salut" });
assert.equal(classify("bonjour", { kind: "peer", name: "pair-c" }).name, "pair-c");
// A background task's notice: its name (from `Agent "…"`, else the summary), status, result.
assert.deepEqual(classify("<task-notification>\n<status>failed</status>\n<summary>Build cassé</summary>\n</task-notification>"), { kind: "task", text: "", status: "failed", task: "Build cassé" });
assert.deepEqual(
  classify('<task-notification>\n<task-id>a1</task-id>\n<status>completed</status>\n<summary>Agent "revue des specs" finished</summary>\n<result>Deux **écarts**.</result>\n</task-notification>'),
  { kind: "task", text: "Deux **écarts**.", status: "completed", task: "revue des specs" },
);
// Through the indexer: several senders keep their groups (each with its text), an idle says so; a
// queued task-notification keeps its task's name and result.
const [opener] = normalize({ type: "user", uuid: "u-g", timestamp: "2026-01-01T10:00:00Z", turnPosition: { promptIndex: 1 }, message: { role: "user", content: [
  '<teammate-message teammate_id="lot-a" color="red" summary="maquette prête">La maquette est prête.</teammate-message>',
  '<teammate-message teammate_id="lot-b" color="green">{"type":"idle_notification","result":"Rien de neuf."}</teammate-message>',
].join("\n") } }, 0, {}, "/w");
assert.deepEqual(opener.from, { kind: "teammate", name: "lot-a", color: "red", summary: "maquette prête", count: 1 });
assert.deepEqual(opener.groups.map((g) => [g.name, g.idle ?? false, g.text]), [["lot-a", false, "La maquette est prête."], ["lot-b", true, "Rien de neuf."]]);
const [queuedTask] = normalize({ type: "attachment", uuid: "u-t", timestamp: "2026-01-01T10:00:00Z", attachment: { type: "queued_command", commandMode: "task-notification", prompt: '<task-notification>\n<status>killed</status>\n<summary>Agent "tests longs" stopped</summary>\n<result>Arrêté.</result>\n</task-notification>' } }, 0, {}, "/w");
assert.deepEqual([queuedTask.kind, queuedTask.status, queuedTask.task, queuedTask.text], ["task", "killed", "tests longs", "Arrêté."]);
// System reminders go; a message of nothing else is hidden.
assert.deepEqual(classify("<system-reminder>\nrappel\n</system-reminder>"), { kind: "system", text: "" });
assert.deepEqual(classify("Fais-le\n<system-reminder>rappel</system-reminder>"), { kind: "human", text: "Fais-le" });

// ── buildInc(): build() turn by turn (the infinite scroll's lot 1) ─────────
// Equal to build() whatever the cache saw before, and the turns its lines didn't touch are the same objects.
const same = (entries, live, cache) => {
  const got = buildInc(entries, { live, cache });
  assert.equal(JSON.stringify(got), JSON.stringify(build(entries, { live })), `buildInc = build (${entries.length} entries, live ${live})`);
  return got;
};
{
  // The live tail: the read grows a line at a time, live, then settles.
  const cache = new Map();
  let prev = [];
  for (let n = 1; n <= full.entries.length; n++) {
    const got = same(full.entries.slice(0, n), true, cache);
    for (let k = 0; k < Math.min(got.length, prev.length) - 1; k++) assert.equal(got[k], prev[k], `turn ${k} kept as it was when line ${n} came`);
    prev = got;
  }
  const settled = same(full.entries, false, cache);
  assert.notEqual(settled[settled.length - 1], prev[prev.length - 1], "the live turn settling is built again");
  assert.equal(settled[0], prev[0], "the others are not");
}
{
  // « Tours précédents » (the older ones in front), a trim (the oldest go, or a cut inside a turn), another session.
  const cache = new Map();
  const at = full.entries.findIndex((e) => e.uuid === "u-20");
  const tail = same(full.entries.slice(at), false, cache);
  const whole = same(full.entries, false, cache);
  assert.equal(whole[whole.length - 1], tail[tail.length - 1], "the turns already read are kept when older ones come in front");
  for (let m = 1; m < full.entries.length; m += 3) same(full.entries.slice(m), false, cache);
  same(full.entries.slice(0, 7), true, new Map());
  same([], true, cache);
}
{
  // What crosses turns: a line written again in a later turn, a result written in a later turn, a message
  // whose lines span two turns (then build(), whole).
  const u = (id, o) => ({ k: "user", o, uuid: id, at: o, turn: true, text: `message ${id}` });
  const tool = (id, o, mid, tid) => ({ k: "assistant", o, uuid: id, mid, at: o, model: "m", blocks: [{ t: "tool", id: tid, name: "Bash", kind: "execute", title: "ls", input: { command: "ls" } }] });
  const said = (id, o, mid, text) => ({ k: "assistant", o, uuid: id, mid, at: o, model: "m", blocks: [{ t: "text", text }] });
  const res = (o, tid, text) => ({ k: "result", o, tool: tid, at: o, ok: true, text });
  const base = [u("A", 0), tool("a1", 1, "ma1", "x1"), said("a2", 2, "ma2", "fini"), u("B", 3), said("b1", 4, "mb1", "suite")];
  const cache = new Map();
  same(base, true, cache);
  const late = [...base, res(5, "x1", "le résultat arrive après")];
  const withLate = same(late, true, cache);
  assert.equal(withLate[0].blocks.find((b) => b.id === "x1").result.text, "le résultat arrive après", "a later result reaches its tool's turn");
  const again = same([...late, { ...base[2] }, said("b2", 7, "mb2", "et encore")], true, cache);
  assert.equal(again[1].blocks.filter((b) => b.role === "prose").length, 2, "a line written again in a later turn counts in the first one only");
  same([...base, said("b3", 8, "ma2", "le message de A, continué")], true, cache);
  same([res(0, "x1", "un résultat sans son outil"), ...base], false, new Map());
  // A turn's opener written twice (cold review, pass 2, point 5): build() leaves the copy out and its
  // turn goes on, in its own turn as in a later one; never a turn more under an id already there.
  const twice = same([said("h", 0, "mh", "avant"), u("A", 1), said("a1", 2, "ma1", "un"), { ...u("A", 1), o: 3 }, said("a2", 4, "ma3", "deux")], true, new Map());
  assert.deepEqual(twice.map((t) => t.id), ["head-0", "A"]);
  const later = same([...base, { ...base[0], o: 9 }, said("b4", 10, "mb4", "encore B")], true, cache);
  assert.deepEqual(later.map((t) => t.id), ["A", "B"]);
}
{
  // Random reads, ticks and trims on one cache.
  let seed = 7;
  const rnd = (n) => (seed = (seed * 1103515245 + 12345) % 2147483648) % n;
  const cache = new Map();
  for (let k = 0; k < 300; k++) {
    const a = rnd(full.entries.length), b = a + rnd(full.entries.length - a + 1);
    same(full.entries.slice(a, b), rnd(2) === 1, cache);
  }
}

// ── #59, a rewind: the abandoned branch hidden by the parentUuid chain ──────
// An invented session (no real id): a prompt, its attachment (skipped by the indexer: its parent at its
// head, its uuid at its end), the answer, a stop hook's system line, a second prompt and its answer,
// then the second prompt typed again from the stop hook's line (a rewind), and its answer.
{
  const line = (o) => JSON.stringify({ parentUuid: null, isSidechain: false, sessionId: "s-rw", timestamp: "2026-01-02T10:00:00.000Z", ...o });
  const prompt = (uuid, parentUuid, text) => line({ type: "user", parentUuid, uuid, message: { role: "user", content: text } });
  const answer = (uuid, parentUuid, text) => line({ type: "assistant", parentUuid, uuid, message: { id: `m-${uuid}`, role: "assistant", model: "model-x", content: [{ type: "text", text }] } });
  // As Claude Code writes it: parentUuid first, the uuid right after the attachment object (a long
  // content before it, a long rendered copy after it); the indexer skips it without parsing it.
  const attach = (uuid, parentUuid) => `{"parentUuid":"${parentUuid}","isSidechain":false,"attachment":{"type":"environment","content":"${"x".repeat(900)}"},"type":"attachment","uuid":"${uuid}","timestamp":"2026-01-02T10:00:00.000Z","rendered":[{"content":"${"y".repeat(900)}"}]}`;
  const A1 = "00000000-0000-4000-8000-0000000000a1";
  const A2 = "00000000-0000-4000-8000-0000000000a2";
  const enc = (lines) => new TextEncoder().encode(lines.join("\n") + "\n");
  const read = (bytes, o = {}) => index(bytes, { from: 0, size: bytes.length, exists: () => false, ...o });
  // A prompt whose parent is a skipped attachment: the chain goes through it, no rewind seen.
  const via = read(enc([prompt("v-u1", null, "un"), answer("v-m1", "v-u1", "r"), attach(A2, "v-m1"), prompt("v-u2", A2, "deux"), answer("v-m2", "v-u2", "r")]));
  assert.equal(via.skipped, 1, "the attachment is skipped (not parsed)");
  assert.equal(via.rewound, false, "but linked, read at its ends: the prompt after it goes on, no rewind");
  assert.deepEqual(build(via.entries).map((t) => t.user.text), ["un", "deux"]);
  const stop = (uuid, parentUuid) => line({ type: "system", subtype: "stop_hook_summary", parentUuid, uuid });
  const rwLines = [
    prompt("r-u1", null, "premier"),
    attach(A1, "r-u1"),
    answer("r-m1", A1, "réponse un"),
    stop("r-s1", "r-m1"),
    prompt("r-u2", "r-s1", "deuxième, abandonné"),
    answer("r-m2", "r-u2", "réponse abandonnée"),
    prompt("r-u3", "r-s1", "deuxième, repris"),
    answer("r-m3", "r-u3", "réponse reprise"),
  ];
  const rwBytes = enc(rwLines);
  const rw = read(rwBytes, { path: "/rw.jsonl", home: "/w" });
  assert.deepEqual(rw.entries.filter((e) => e.uuid).map((e) => e.uuid), ["r-u1", "r-m1", "r-u3", "r-m3"], "the abandoned prompt and its answer are gone, the rest stays");
  assert.equal(rw.rewound, false, "found within the read: no reread");
  assert.equal(rw.tail, "r-m3", "the chain's last link, for the next delta");
  assert.deepEqual(build(rw.entries).map((t) => t.user.text), ["premier", "deuxième, repris"], "the turns as the conversation is now");
  // Without the rewind, nothing goes: the attachment (skipped, read at its ends) and the system line keep the chain.
  const plainBytes = enc(rwLines.slice(0, 6));
  assert.deepEqual(read(plainBytes).entries.filter((e) => e.uuid).map((e) => e.uuid), ["r-u1", "r-m1", "r-u2", "r-m2"]);
  // A delta: the prompt goes back to a link of an earlier read: reread the whole tail.
  const off6 = plainBytes.length;
  const delta = index(rwBytes.subarray(off6), { from: off6, size: rwBytes.length, tail: "r-m2", exists: () => false });
  assert.equal(delta.rewound, true, "the rewind seen in a delta: the caller reads the whole tail again");
  const goingOn = index(plainBytes.subarray(enc(rwLines.slice(0, 4)).length), { from: 0, tail: "r-s1", exists: () => false });
  assert.equal(goingOn.rewound, false, "a prompt on the line just before: going on, nothing to reread");
  // Parallel tool calls branch too (two children of one call): not a rewind, nothing goes.
  const pr = read(enc([
    prompt("p-u1", null, "lis deux fichiers"),
    line({ type: "assistant", parentUuid: "p-u1", uuid: "p-t1", message: { id: "m-p", role: "assistant", model: "model-x", content: [{ type: "tool_use", id: "tu-a", name: "Read", input: { file_path: "/w/a" } }] } }),
    line({ type: "assistant", parentUuid: "p-t1", uuid: "p-t2", message: { id: "m-p", role: "assistant", model: "model-x", content: [{ type: "tool_use", id: "tu-b", name: "Read", input: { file_path: "/w/b" } }] } }),
    line({ type: "user", parentUuid: "p-t1", uuid: "p-r1", message: { role: "user", content: [{ type: "tool_result", tool_use_id: "tu-a", content: "a" }] } }),
    line({ type: "user", parentUuid: "p-t2", uuid: "p-r2", message: { role: "user", content: [{ type: "tool_result", tool_use_id: "tu-b", content: "b" }] } }),
    answer("p-m1", "p-r2", "les deux lus"),
    prompt("p-u2", "p-m1", "merci"),
  ]));
  assert.equal(pr.entries.filter((e) => e.k === "result").length, 2, "both results stay");
  assert.deepEqual(build(pr.entries).map((t) => t.user.text), ["lis deux fichiers", "merci"]);
  assert.equal(pr.rewound, false);
  // ingest keeps the chain's last link for the next delta.
  assert.equal(ingest(null, rw).tail, "r-m3");
  assert.equal(ingest(ingest(null, { ...rw, tail: "r-s1" }), { ...goingOn, path: "/rw.jsonl", session: "s-rw", start: rw.end, end: rw.end + 1, entries: [] }).tail, goingOn.tail);
}

// ── #58, a sub-agent's own transcript ───────────────────────────────────────
{
  assert.deepEqual(subPath("/h/.claude/projects/-w/s-1.jsonl", "a0749"), { file: "/h/.claude/projects/-w/s-1/subagents/agent-a0749.jsonl", meta: "/h/.claude/projects/-w/s-1/subagents/agent-a0749.meta.json" });
  assert.equal(subPath("/p/s.jsonl", "aexample-0000").file, "/p/s/subagents/agent-aexample-0000.jsonl", "a teammate's id, with its name");
  for (const bad of ["../x", "a/b", "", null, "a b", "x".repeat(200)]) assert.equal(subPath("/p/s.jsonl", bad), null, `an id that isn't a plain name: ${bad}`);
  assert.equal(subPath("/p/s.txt", "a1"), null, "a session that isn't a .jsonl");
  // Its lines are sidechain ones: left out of the session, read with `side`.
  const sc = (o) => JSON.stringify({ isSidechain: true, agentId: "a1", sessionId: "s-sc", timestamp: "2026-01-03T10:00:00.000Z", ...o });
  const lines = [
    sc({ type: "user", uuid: "sc-u1", parentUuid: null, message: { role: "user", content: "Lis le module et dis ce qu'il exporte." } }),
    sc({ type: "assistant", uuid: "sc-m1", parentUuid: "sc-u1", message: { id: "m-sc1", role: "assistant", model: "model-x", content: [{ type: "tool_use", id: "sc-t1", name: "Read", input: { file_path: "/w/a.js" } }] } }),
    sc({ type: "user", uuid: "sc-r1", parentUuid: "sc-m1", message: { role: "user", content: [{ type: "tool_result", tool_use_id: "sc-t1", content: "export const a = 1" }] } }),
    sc({ type: "assistant", uuid: "sc-m2", parentUuid: "sc-r1", message: { id: "m-sc2", role: "assistant", model: "model-x", content: [{ type: "text", text: "Il exporte `a`." }] } }),
  ];
  const bytes = new TextEncoder().encode(lines.join("\n") + "\n");
  assert.equal(index(bytes, { from: 0, size: bytes.length, exists: () => false }).entries.length, 0, "in the session's read: none of them");
  const out = index(bytes, { from: 0, size: bytes.length, side: true, exists: () => false });
  const turns = build(out.entries);
  assert.equal(turns.length, 1, "the lead's brief opens its turn");
  const shown = subItems(turns);
  assert.deepEqual(shown.items.map((it) => it.type), ["activity", "block"], "its work, then its words");
  assert.equal(shown.items[1].block.text, "Il exporte `a`.");
  // Its ids made its own: an offset's id (a notice) from its file could be the session's.
  const scoped = subItems([{ items: [{ type: "block", id: "n120", block: { role: "notice", id: "n120" } }, shown.items[0]] }], 8, "a1");
  assert.deepEqual(scoped.items.map((it) => [it.id, it.block?.id ?? null]), [["sub:a1:n120", "sub:a1:n120"], [`sub:a1:${shown.items[0].id}`, null]], "items and blocks prefixed");
  assert.deepEqual(scoped.items[1].steps.map((b) => b.id), ["sc-t1"], "its steps keep theirs (tool ids)");
  // What a read brought, to fade in once: the first read's all, then a delta's new ones only.
  const first = build(out.entries.slice(0, 3));
  const ids = (s) => [...s].sort();
  assert.deepEqual(ids(subArrivals(null, first, "a1")), ids(subItems(first, 8, "a1").items.map((it) => it.id)), "first read: all of it (it takes the report's place)");
  const more = subArrivals(first, turns, "a1");
  assert.deepEqual(ids(more), [shown.items[1].id.replace("sub::", "sub:a1:")], "a delta: its new item only, not the step already there");
  assert.deepEqual(ids(subArrivals(turns, turns, "a1", more)), ids(more), "not drawn yet: still waiting");
  assert.equal(subArrivals(turns, turns, "a1").size, 0, "nothing new: nothing comes in");
  assert.equal(subItems([]), null, "no transcript: the line keeps its report");
  assert.equal(subItems(build(out.entries.slice(0, 1))), null, "only the brief read so far: nothing to show yet");
  const many = { items: Array.from({ length: 12 }, (_, i) => ({ type: "block", id: `b${i}` })) };
  assert.deepEqual([subItems([many], 8).items.length, subItems([many], 8).more], [8, 4], "bounded: the last 8, and how many more");
}

console.log("chat-model ok");
