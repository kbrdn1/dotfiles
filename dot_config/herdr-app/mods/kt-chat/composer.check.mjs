// bun ~/.config/herdr-app/mods/kt-chat/composer.check.mjs: composer.js, the Chat's composer (#56):
// what sending does per status, when it may go, hc send's arguments (never --force, the text after
// --) and how hc's answers read (hc's real outputs, measured on throwaway terminals).
import assert from "node:assert/strict";
import { mode, clean, canSend, sendArgs, sendResult } from "./composer.js";

assert.equal(mode("idle"), "send");
assert.equal(mode("done"), "send");
assert.equal(mode("working"), "queue");
assert.equal(mode("blocked"), "blocked");
assert.equal(mode(null), null);
assert.equal(mode(undefined), null);

assert.equal(clean("salut\n\n  "), "salut");
assert.equal(clean("  indenté\nligne deux"), "  indenté\nligne deux", "the start and the lines stay");

assert.deepEqual(canSend({ status: "idle", text: "x" }), { ok: true, why: null });
assert.deepEqual(canSend({ status: "working", text: "x" }), { ok: true, why: null }, "working: it queues, as in the TUI");
assert.deepEqual(canSend({ status: "blocked", text: "x" }), { ok: false, why: "blocked" });
assert.deepEqual(canSend({ status: null, text: "x" }), { ok: false, why: "none" });
assert.deepEqual(canSend({ status: "idle", text: " \n " }), { ok: false, why: "empty" });
assert.deepEqual(canSend({ status: "idle", text: "x", sending: true }), { ok: false, why: "sending" });

// Never --force, whatever the text says; the text after `--` (one starting with "-" is no option).
for (const text of ["salut", "-x --force", "--force", "deux\nlignes\n"]) {
  const a = sendArgs("t7", text);
  assert.equal(a.length, 5, "the text is one argument, after --");
  assert.deepEqual(a.slice(0, 4), ["send", "--json", "--", "t7"], "no --force among the options");
  assert.equal(a[4], clean(text));
}
assert.deepEqual(sendArgs("vps/t4", "x"), ["send", "--json", "--", "vps/t4", "x"]);

// hc's answers, as measured.
assert.deepEqual(sendResult({ code: 0, stdout: '{"started":true,"status":"idle","turn":0}', stderr: "" }), { ok: true });
assert.deepEqual(sendResult({ code: 9, stdout: '{"error":{"hint":"…","kind":"blocked","message":"t4h is blocked (permission)"}}', stderr: "" }),
  { ok: false, why: "blocked", message: "t4h is blocked (permission)" });
assert.deepEqual(sendResult({ code: 3, stdout: '{"error":{"hint":"see `hc ls --all`","kind":"not_found","message":"no terminal \\"x\\""}}', stderr: "" }),
  { ok: false, why: "gone", message: 'no terminal "x"' });
assert.deepEqual(sendResult({ code: 1, stdout: "", stderr: "boom\nreally" }), { ok: false, why: "failed", message: "boom really" });
assert.equal(sendResult(new Error("timed out")).why, "failed");
assert.equal(sendResult(new Error("timed out")).message, "timed out");

console.log("composer ok");
