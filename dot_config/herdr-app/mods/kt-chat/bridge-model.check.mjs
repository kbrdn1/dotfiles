// bun bridge-model.check.mjs : herdr-bridge 0.6.0's requests answered whole from the Chat
// (bridge-model.js): the questions of an AskUserQuestion, an MCP form, a link. Made-up requests.
import assert from "node:assert/strict";
import { answerOf, answersOf, cardOf, contentOf, dismissedOf, enterRow, extendedOf, fieldsOf, heldOf, inputsOf, MAX_FIELDS, moveCursor, OTHER, previewOf, questionsOf, rowsOf, slotsOf, whoOf } from "./bridge-model.js";

const ONE = { question: "Quelle base ?", header: "Base", options: [{ label: "Postgres" }, { label: "SQLite" }], multiSelect: false };
const MANY = { question: "Quels modules ?", header: "Modules", options: [{ label: "auth" }, { label: "mail" }], multiSelect: true };
const TEXT = { question: "Quel nom ?", header: "Nom", kind: "text", options: [], multiSelect: false };
const NUM = { question: "Combien ?", header: "Nombre", kind: "number", min: 1, max: 9, options: [], multiSelect: false };
const ask = (questions) => ({ id: "toolu_01A", kind: "permission", tool: "AskUserQuestion", title: "Question", options: [], questions });

// An AskUserQuestion's card: all its questions; anything else keeps the card as before.
assert.deepEqual(cardOf(ask([ONE, MANY])), { kind: "questions", questions: [ONE, MANY], extended: false });
assert.equal(cardOf({ id: "toolu_01B", kind: "permission", tool: "Bash", options: [{ key: "yes" }] }), null);
assert.equal(questionsOf(ask([ONE, ONE])), null); // two questions alike: the bridge can't key them
assert.equal(questionsOf(ask([])), null);
assert.equal(inputsOf(cardOf(ask([ONE, MANY, TEXT]))), 3);

// One answer per question, in the form asked.
assert.deepEqual(answerOf(ONE, { pick: "SQLite" }), { label: "SQLite" });
assert.deepEqual(answerOf(ONE, { pick: OTHER, text: "MariaDB" }), { other: "MariaDB" });
assert.equal(answerOf(ONE, { pick: OTHER, text: "  " }), null);
assert.equal(answerOf(ONE, { pick: "MySQL" }), null); // a label not offered
assert.deepEqual(answerOf(MANY, { picks: ["mail", "auth", "mail"] }), { labels: ["mail", "auth"] });
assert.deepEqual(answerOf(MANY, { picks: [], text: "logs" }), { labels: [], other: "logs" });
assert.equal(answerOf(MANY, { picks: [] }), null);
assert.deepEqual(answerOf(TEXT, { text: "atlas" }), { text: "atlas" });
assert.deepEqual(answerOf(NUM, { text: "9" }), { number: 9 });
assert.equal(answerOf(NUM, { text: "10" }), null);
assert.equal(answerOf({ ...NUM, min: 0, max: 2 }, { text: "1,5" }).number, 1.5); // a French comma

// All of them, or nothing; in the extended form a question left empty is skipped.
assert.deepEqual(answersOf([ONE, MANY], { "Quelle base ?": { pick: "SQLite" }, "Quels modules ?": { picks: ["auth"] } }), {
  answers: { "Quelle base ?": { label: "SQLite" }, "Quels modules ?": { labels: ["auth"] } },
});
assert.equal(answersOf([ONE, MANY], { "Quelle base ?": { pick: "SQLite" } }), null);
assert.equal(extendedOf([ONE, TEXT]), true);
assert.deepEqual(answersOf([ONE, TEXT], { "Quelle base ?": { pick: "SQLite" } }).answers["Quel nom ?"], { unanswered: "skipped" });
assert.equal(answersOf([ONE, TEXT], {}), null); // all skipped: nothing to send
assert.deepEqual(dismissedOf([ONE]), { answers: { "Quelle base ?": { unanswered: "dismissed" } } });
// A question named `__proto__` stays a field.
assert.equal(JSON.stringify(answersOf([{ ...ONE, question: "__proto__" }], JSON.parse('{"__proto__":{"pick":"SQLite"}}'))), '{"answers":{"__proto__":{"label":"SQLite"}}}');

// Kylian (2026-11-25): the options one by one, ↑/↓ and Entrée, as Claude Code's dialog. The rows: each
// option, then « Autre » for a choice (a multi-select too), a text or number question's field, « Envoyer ».
const card = cardOf(ask([ONE, MANY, TEXT]));
const rows = rowsOf(card);
assert.deepEqual(rows.map((r) => `${r.q}:${r.kind}${r.label ? `:${r.label}` : ""}`), [
  "0:option:Postgres", "0:option:SQLite", "0:other", "1:option:auth", "1:option:mail", "1:other", "2:input", "-1:send",
]);
assert.deepEqual(rowsOf(cardOf({ ...ask([]), kind: "elicitation", mode: "url", url: "x" })), []); // a link has no rows
// The cursor stays on the rows.
assert.equal(moveCursor(0, -1, rows.length), 0);
assert.equal(moveCursor(6, 1, rows.length), 7);
assert.equal(moveCursor(7, 1, rows.length), 7);
assert.equal(moveCursor(undefined, 1, rows.length), 1);
// Entrée on a single choice picks it and goes on to the next question; on a multi-select it toggles and
// stays; on « Autre » the field takes the keyboard (a single choice picks Other); never a send by itself.
let e = enterRow(card, heldOf(), 1);
assert.deepEqual({ ...e, held: { ...e.held } }, { held: { "Quelle base ?": { pick: "SQLite" } }, focus: false, to: 3 });
e = enterRow(card, e.held, 4);
assert.deepEqual([e.held["Quels modules ?"], e.focus, e.to], [{ picks: ["mail"] }, false, 4]);
e = enterRow(card, e.held, 4);
assert.deepEqual(e.held["Quels modules ?"], { picks: [] });
e = enterRow(card, e.held, 2);
assert.deepEqual([e.held["Quelle base ?"], e.focus, e.to], [{ pick: OTHER }, true, 2]);
assert.equal(enterRow(card, e.held, 5).focus, true);
assert.equal(enterRow(card, e.held, 5).held["Quels modules ?"].pick, undefined); // a multi-select's Other is its text
assert.equal(enterRow(card, e.held, 6).focus, true); // a text question: its field
const sent = enterRow(card, e.held, 7);
assert.deepEqual([sent.held, sent.focus, sent.to], [e.held, false, 7]); // « Envoyer »: the caller sends
// The last question's pick keeps the cursor where it is (nothing after but « Envoyer »).
const last = cardOf(ask([ONE]));
assert.equal(enterRow(last, heldOf(), 0).to, 3);
// The previews (a single choice only): the option under the cursor, else the one picked; "" when it has
// none; null when the question has no column (no preview, a multi-select).
const SHOWN = { ...ONE, options: [{ label: "Postgres", description: "Serveur", preview: "┌ pg ┐\n  port 5432" }, { label: "SQLite" }] };
const pc = cardOf(ask([SHOWN, MANY]));
assert.equal(previewOf(pc, 0, heldOf(), 0), "┌ pg ┐\n  port 5432");
assert.equal(previewOf(pc, 0, heldOf(), 1), ""); // SQLite has none: the column stays, empty
assert.equal(previewOf(pc, 0, { "Quelle base ?": { pick: "Postgres" } }, 4), "┌ pg ┐\n  port 5432"); // cursor elsewhere: the pick
assert.equal(previewOf(pc, 0, heldOf(), 4), "");
assert.equal(previewOf(pc, 1, heldOf(), 3), null); // a multi-select
assert.equal(previewOf(cardOf(ask([ONE])), 0, heldOf(), 0), null); // no preview at all
assert.equal(previewOf(cardOf(ask([{ ...SHOWN, multiSelect: true }])), 0, heldOf(), 0), null);

// An MCP form: its fields, in order, then the content.
const FORM = {
  type: "object",
  properties: {
    name: { type: "string", title: "Nom", maxLength: 5 },
    age: { type: "integer", minimum: 0, maximum: 130 },
    ok: { type: "boolean", default: true },
    plan: { type: "string", enum: ["free", "pro"] },
    tier: { type: "string", oneOf: [{ const: "a", title: "A" }, { const: "b", title: "B" }] },
    langs: { type: "array", items: { anyOf: [{ const: "fr", title: "Français" }, { const: "en", title: "English" }] }, maxItems: 1 },
  },
  required: ["name"],
};
const form = { id: "elicit-1-1", kind: "elicitation", server: "tracker", mode: "form", schema: FORM, options: [], ack: true };
const fields = fieldsOf(FORM);
assert.deepEqual(fields.map((f) => [f.key, f.type, f.required]), [["name", "string", true], ["age", "number", false], ["ok", "boolean", false], ["plan", "choice", false], ["tier", "choice", false], ["langs", "multi", false]]);
assert.deepEqual(fields[4].choices, [{ value: "a", label: "A" }, { value: "b", label: "B" }]);
assert.equal(fields[0].title, "Nom");
assert.deepEqual(cardOf(form), { kind: "form", fields });
assert.equal(inputsOf(cardOf(form)), 2);
const held = heldOf(fields);
assert.deepEqual(held.ok, { pick: true }); // its default
assert.equal(contentOf(fields, held), null); // name is required
held.name = { text: "kim" };
assert.deepEqual(contentOf(fields, held), { name: "kim", ok: true });
Object.assign(held, { age: { text: "30" }, plan: { pick: "pro" }, tier: { pick: "b" }, langs: { picks: ["en"] } });
assert.deepEqual(contentOf(fields, held), { name: "kim", age: 30, ok: true, plan: "pro", tier: "b", langs: ["en"] });
for (const bad of [{ name: { text: "toolong" } }, { age: { text: "1.5" } }, { age: { text: "-1" } }, { langs: { picks: ["en", "fr"] } }]) {
  assert.equal(contentOf(fields, { ...held, ...bad }), null, JSON.stringify(bad));
}
assert.deepEqual(contentOf(fields, { ...held, name: { text: "😀😀😀😀😀" } }).name, "😀😀😀😀😀"); // five characters
// A type the protocol doesn't allow, or too many fields: the terminal.
assert.equal(fieldsOf({ type: "object", properties: { x: { type: "object" } } }), null);
assert.equal(fieldsOf({ type: "object", properties: Object.fromEntries(Array.from({ length: MAX_FIELDS + 1 }, (_, i) => [`f${i}`, { type: "string" }])) }), null);
// Each question types in one input of the pool, a form's string and number fields one each; a field
// named `__proto__` is held as any other.
assert.deepEqual(slotsOf(cardOf(ask([ONE, TEXT]))), { "Quelle base ?": 0, "Quel nom ?": 1 });
assert.deepEqual(slotsOf(cardOf(form)), { name: 0, age: 1 });
const proto = heldOf(fieldsOf(JSON.parse('{"type":"object","properties":{"__proto__":{"type":"string"}},"required":["__proto__"]}')));
proto["__proto__"] = { text: "x" };
assert.equal(JSON.stringify(contentOf(fieldsOf(JSON.parse('{"type":"object","properties":{"__proto__":{"type":"string"}},"required":["__proto__"]}')), proto)), '{"__proto__":"x"}');
// Who asks, when it isn't the lead agent.
assert.equal(whoOf({ agent: { id: "a1", type: "Explore" } }), "Explore");
assert.equal(whoOf({ agent: { id: "a1", name: "scout", type: "Explore" } }), "scout");
assert.equal(whoOf(ask([ONE])), null);
// A link: decline or cancel only.
assert.deepEqual(cardOf({ ...form, mode: "url", url: "https://auth.example.test/x", schema: undefined }), { kind: "link", url: "https://auth.example.test/x" });

console.log("kt-chat bridge-model: ok");
