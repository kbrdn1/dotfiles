// bun ~/.config/herdr-app/mods/kt-kanban/decide.check.mjs : the answer path the Kanban uses on a card
// (its pills and its menu), decide.js' own (a byte-identical copy of kbrdn-toast's: the sidebar's and the
// toast's), on fakes: herdr, gpui-kit and gpui-base are mocked; files live in a made-up home; no agent,
// no screen, no real path. Not loaded by Herdr.
import assert from "node:assert/strict";
import { mock } from "bun:test";

const HOME = "/tfx/home";
const files = {}; // path -> text
const writes = []; // [path, text]
const runs = []; // [command, args]
const reads = []; // hc calls
let screen = "";
let blocked = new Set();
let langNow = null; // kt.lang: null is auto (French here)
mock.module("herdr", () => ({
  home: () => HOME,
  agents: () => [...blocked].map((address) => ({ address, status: "blocked" })),
  readTextFile: async (p) => files[p] ?? null,
  writeTextFile: async (p, text) => { writes.push([p, text]); files[p] = text; },
  hc: async (args) => { reads.push(args); return { code: 0, stdout: screen }; },
  run: (name, args) => runs.push([name, args]),
  theme: () => ({}),
  shared: (k) => (k === "kt.lang" ? langNow : null), setShared: () => {}, checking: () => true, exec: async () => ({ code: 1, stdout: "" }),
}));
const chain = () => new Proxy(() => {}, { get: () => chain, apply: () => chain() });
mock.module("gpui-kit", () => ({ div: chain, svg: chain }));
mock.module("gpui-base", () => ({ h_flex: chain, v_flex: chain }));
const { decide, press, pillKeys } = await import("./decide.js");

const cache = (t) => `${HOME}/.claude/cache/herdr/${t}`;
const TOKEN = "test-token-fixture";
const RULE = { type: "addRules", rules: [{ toolName: "Bash", ruleContent: "npm test:*" }], behavior: "allow", destination: "localSettings" };
// What herdr-bridge 0.4.0 publishes for a command: the terminal's choices, and the request's token apart.
const permission = (id) => JSON.stringify({ pending: { id, kind: "permission", tool: "Bash", title: "Autoriser Bash ?", detail: "npm test",
  options: [
    { key: "yes", kind: "yes", tone: "positive", label: "Oui" },
    { key: "yes-note", kind: "yes", tone: "positive", label: "Oui, avec une note", note: true },
    { key: "rule-0", kind: "rule", tone: "positive", label: "Oui, et ne plus demander pour Bash(npm test:*) dans ce dépôt (local)", update: RULE },
    { key: "no", kind: "no", tone: "negative", label: "Non" },
    { key: "no-note", kind: "no", tone: "negative", label: "Non, avec une consigne", note: true },
  ] } });
const ask = (t, id, token = TOKEN) => { files[`${cache(t)}.ask.json`] = JSON.stringify({ id, token }); };

// A card (toast, sidebar, Kanban) shows the plain choices only: Yes and No; the rule and the notes are
// the Chat's. « Oui » writes { id, token, choice } with the token read from the ask file, once; a second
// answer is refused; read again, it has no choices left.
blocked = new Set(["tfx9"]);
files[`${cache("tfx9")}.json`] = permission("tfx-p1");
ask("tfx9", "tfx-p1");
const d = await decide("tfx9");
assert.equal(d.pending.kind, "permission");
assert.deepEqual(pillKeys(d), ["yes", "no"]);
assert.deepEqual(await press(d, "rule-0"), { ok: false, reason: "Rien à répondre ici." }); // not on a card
assert.deepEqual(await press(d, "yes"), { ok: true, note: false });
assert.deepEqual(writes, [[`${cache("tfx9")}.decision.json`, JSON.stringify({ id: "tfx-p1", token: TOKEN, choice: "yes" })]]);
assert.deepEqual(await press(d, "no"), { ok: false, reason: "Déjà répondu." });
assert.equal(writes.length, 1);
assert.deepEqual(pillKeys(await decide("tfx9")), ["open"]); // answered here: only « Ouvrir »

// A session started before the switch still runs herdr-bridge 0.3.1: Accepter / Refuser, no kind, no
// token anywhere. « Accepter » writes { id, choice } as that version reads it, never a token.
const v031 = (id) => JSON.stringify({ pending: { id, kind: "permission", title: "Autoriser Bash", detail: "rm -rf build",
  options: [{ key: "accept", label: "Accepter", tone: "positive" }, { key: "refuse", label: "Refuser", tone: "negative" }] } });
files[`${cache("tfx2")}.json`] = v031("tfx-old");
blocked = new Set(["tfx2"]);
const old = await decide("tfx2");
assert.deepEqual(pillKeys(old), ["accept", "refuse"]);
assert.deepEqual(await press(old, "accept"), { ok: true, note: false });
assert.deepEqual(writes.at(-1), [`${cache("tfx2")}.decision.json`, JSON.stringify({ id: "tfx-old", choice: "accept" })]);
assert.equal(writes.length, 2);

// The Chat gets every choice; one with a note says so, for the caller to send the note as a message.
files[`${cache("tfx4")}.json`] = permission("tfx-p4");
ask("tfx4", "tfx-p4");
const c = await decide("tfx4", { full: true });
assert.deepEqual(pillKeys(c), ["yes", "yes-note", "rule-0", "no", "no-note"]);
assert.deepEqual(await press(c, "no-note"), { ok: true, note: true });
assert.deepEqual(JSON.parse(writes.at(-1)[1]), { id: "tfx-p4", token: TOKEN, choice: "no-note" });
assert.equal(writes.length, 3);

// No token for this request (none yet, another id's, or spent: `{}`): nothing written.
files[`${cache("tfx3")}.json`] = permission("tfx-p5");
blocked = new Set(["tfx3"]);
for (const a of [null, JSON.stringify({ id: "another", token: TOKEN }), "{}", JSON.stringify({ id: "tfx-p5", token: "" })]) {
  if (a === null) delete files[`${cache("tfx3")}.ask.json`];
  else files[`${cache("tfx3")}.ask.json`] = a;
  assert.deepEqual(await press(await decide("tfx3"), "yes"), { ok: false, reason: "La demande n'est plus en attente." });
}
assert.equal(writes.length, 3);

// The request changed between the card and the click: nothing written.
files[`${cache("tfx8")}.json`] = permission("tfx-p2");
ask("tfx8", "tfx-p2");
blocked = new Set(["tfx8"]);
const d8 = await decide("tfx8");
files[`${cache("tfx8")}.json`] = permission("tfx-p3");
assert.deepEqual(await press(d8, "no"), { ok: false, reason: "La demande n'est plus en attente." });
assert.equal(writes.length, 3);

// A question (no choices) and a plain wait (nothing published, nothing held on the screen): only
// « Ouvrir », which goes to the agent (agent.focus), nothing written.
files[`${cache("tfx7")}.json`] = JSON.stringify({ pending: { id: "q1", kind: "question", title: "Quel nom ?", options: [] } });
blocked = new Set(["tfx7", "tfx6"]);
const q = await decide("tfx7");
assert.deepEqual([q.pending.kind, pillKeys(q)], ["question", ["open"]]);
assert.deepEqual(await press(q, "open"), { ok: true });
assert.deepEqual(runs, [["agent.focus", { terminal: "tfx7" }]]);
screen = "some output\n> ";
const w = await decide("tfx6");
assert.deepEqual([w.pending.kind, w.pending.title, pillKeys(w)], ["input", "Attend ta réponse", ["open"]]);
assert.deepEqual(reads, [["read", "tfx6"]]); // the screen read for a blocked agent the plugin says nothing about
// Not blocked, nothing published: nothing waits.
blocked = new Set();
assert.equal((await decide("tfx5")).pending, null);

// Only the made-up home was written.
assert.ok(writes.every(([p]) => p.startsWith(`${HOME}/`)));
assert.equal(writes.length, 3);

// In English, a card has no French word (w-docs, #77: herdr-bridge publishes its title and labels in
// French). Said again from what it publishes as data: the tool, each option's kind, note, update, mode.
const FRENCH = /[àâçéèêëîïôûùœ]|\b(Oui|Non|Autoriser|avec|consigne|passer|plus|demander|pour|dans|dépôt|partout|Plan à|Changer|valide|Attend)\b/;
const MODE = { type: "setMode", mode: "acceptEdits", destination: "session" };
const english = async (t, pending, label) => {
  files[`${cache(t)}.json`] = JSON.stringify({ pending });
  const { pending: p } = await decide(t, { full: true });
  for (const s of [p.title, ...p.options.map((o) => o.label)]) assert.ok(s && !FRENCH.test(s), `${label}: « ${s} »`);
  return p;
};
langNow = "en";
const card = await english("tfx7", { ...JSON.parse(permission("tfx-p7")).pending, options: [...JSON.parse(permission("tfx-p7")).pending.options,
  { key: "mode-1", kind: "mode", tone: "positive", label: "Oui, et passer en édition auto pour la session", mode: "acceptEdits", update: MODE }] }, "permission");
assert.deepEqual([card.title, ...card.options.map((o) => o.label)], ["Allow Bash?", "Yes", "Yes, with a note",
  "Yes, and don't ask again for Bash(npm test:*) in this repo (local)", "No", "No, with instructions", "Yes, and switch to auto-accept edits for this session"]);
const plan = await english("tfx8", { id: "tfx-p8", kind: "permission", tool: "ExitPlanMode", title: "Plan à valider", detail: "1. lire", options: [
  { key: "plan-default", kind: "mode", tone: "positive", label: "Oui, je valide les éditions", mode: "default" },
  { key: "plan-change", kind: "no", tone: "negative", label: "Changer le plan", note: true }] }, "plan");
assert.deepEqual([plan.title, ...plan.options.map((o) => o.label)], ["Plan to approve", "Yes, I'll approve each edit", "Change the plan"]);
assert.equal((await english("tfx6", { id: "tfx-p6", kind: "input", title: "Attend ta réponse", options: [] }, "input")).title, "Waiting for your answer");
// A question's answers are its own words; French again: the bridge's words, as before.
const qn = { id: "tfx-q", kind: "permission", tool: "AskUserQuestion", title: "Question", detail: "Which?", options: [{ key: "answer-0", kind: "answer", tone: "positive", label: "Plan B" }] };
assert.deepEqual((await english("tfx4", qn, "question")).options.map((o) => o.label), ["Plan B"]);
langNow = "fr";
files[`${cache("tfx7")}.json`] = permission("tfx-p7");
assert.deepEqual((await decide("tfx7", { full: true })).pending.options.map((o) => o.label), ["Oui", "Oui, avec une note", "Oui, et ne plus demander pour Bash(npm test:*) dans ce dépôt (local)", "Non", "Non, avec une consigne"]);
console.log("decide (kt-kanban): ok");
