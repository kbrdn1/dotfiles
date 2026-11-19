// bun ask.check.mjs : #79, a blocked agent's request in full (ask.js), and the call read back from
// the transcript (chat-index.ts toolCallOf). Made-up lines, no real session.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { askFile, askOf, askRows, callId, FOLD, OPEN, shownRows } from "./ask.js";
import { toolCallOf } from "./chat-index.ts";

const sign = (rows) => rows.map((r) => r.sign + r.text);

// A command, whole, from the call or else from the bridge's detail.
const bash = { id: "toolu_01A", kind: "permission", tool: "Bash", title: "Autoriser Bash ?", detail: "make test\nmake check" };
assert.deepEqual(sign(askRows(bash, null)), [" make test", " make check"]);
assert.deepEqual(sign(askRows(bash, { name: "Bash", input: { command: "make test && make check" } })), [" make test && make check"]);
assert.equal(askFile(bash, null), null);

// An edit: its diff, the lines out then in, under its file.
const edit = { id: "toolu_01B", kind: "permission", tool: "Edit", title: "Autoriser Edit ?", detail: "/w/a.js" };
const call = { name: "Edit", input: { file_path: "/w/a.js", old_string: "a\nb", new_string: "a\nc\nd" } };
assert.deepEqual(sign(askRows(edit, call)), ["-a", "-b", "+a", "+c", "+d"]);
assert.equal(askFile(edit, call), "/w/a.js");
// The call not read (yet): the path once, above, and no rows (cold review 2, P3: it was shown twice).
assert.deepEqual(askRows(edit, null), []);
assert.deepEqual(askOf(edit, null), { pending: edit, file: "/w/a.js", rows: [] });
assert.deepEqual(askOf(edit, call).rows.map((r) => r.sign + r.text), ["-a", "-b", "+a", "+c", "+d"]);
assert.deepEqual(sign(askRows(edit, { name: "MultiEdit", input: { edits: [{ old_string: "x", new_string: "y" }, { old_string: "", new_string: "z" }] } })), ["-x", "+y", "+z"]);
assert.deepEqual(sign(askRows(edit, { name: "Write", input: { file_path: "/w/n.md", content: "# n\n\nt\n" } })), ["+# n", "+", "+t"]);
assert.deepEqual(askRows({ kind: "permission", tool: "Bash" }, null), []);

// Folded: FOLD rows and the count left out; opened: up to OPEN.
const many = Array.from({ length: 900 }, (_, i) => ({ sign: " ", text: String(i) }));
assert.deepEqual([shownRows(many, false).rows.length, shownRows(many, false).more, shownRows(many, false).foldable], [FOLD, 900 - FOLD, true]);
assert.deepEqual([shownRows(many, true).rows.length, shownRows(many, true).more], [OPEN, 900 - OPEN]);
assert.deepEqual(shownRows(many.slice(0, FOLD), false), { rows: many.slice(0, FOLD), more: 0, foldable: false });

// Only a permission's tool call id is searched for.
assert.equal(callId(edit), "toolu_01B");
assert.equal(callId({ ...edit, kind: "question" }), null);
assert.equal(callId({ ...edit, id: "ask-1795000000000" }), null);
assert.equal(callId({ ...edit, id: 'toolu_01"; rm -rf' }), null);

// The call read back from the transcript's last bytes: the newest line holding it, a cut line skipped,
// the texts capped.
const line = (o) => JSON.stringify(o);
const use = (id, name, input) => line({ type: "assistant", message: { content: [{ type: "tool_use", id, name, input }] } });
const jsonl = [
  use("toolu_01B", "Edit", { file_path: "/w/a.js", old_string: "old", new_string: "older" }),
  line({ type: "user", message: { content: [{ type: "tool_result", tool_use_id: "toolu_01B", content: "ok" }] } }),
  use("toolu_01C", "Edit", { file_path: "/w/b.js", old_string: "x".repeat(50), new_string: "y" }),
  '{"type":"assistant","message":{"content":[{"type":"tool_use","id":"toolu_01D"', // being written
].join("\n");
const bytes = new TextEncoder().encode(jsonl);
assert.deepEqual(toolCallOf(bytes, "toolu_01B"), { name: "Edit", input: { file_path: "/w/a.js", old_string: "old", new_string: "older" }, cut: false });
assert.deepEqual(toolCallOf(bytes, "toolu_01C", 10), { name: "Edit", input: { file_path: "/w/b.js", old_string: "x".repeat(10), new_string: "y" }, cut: true });
assert.equal(toolCallOf(bytes, "toolu_01D"), null);
assert.equal(toolCallOf(bytes, "toolu_09Z"), null);

// The render only reads what askOf worked out (cold review 2, P2: a text up to 32 KB was split in the
// render): main.js calls askOf when the request or its call arrives, never askRows or askFile.
const main = readFileSync(new URL("./main.js", import.meta.url), "utf8");
assert.equal(/\bask(Rows|File)\(/.test(main), false, "main.js must not split a request in its render");
assert.ok(/this\.ask = askOf\(/.test(main), "main.js works the card out with askOf");

console.log("ask: ok");
