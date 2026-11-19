// bun keysend.check.mjs: keysend.js on invented TUI screens (Claude Code's prompt framed by rules, as
// `hc read` gives it): the prompt read, empty or hinted, what was typed, the step that stops.
import assert from "node:assert/strict";
import { promptLine, promptEmpty, typedOk, blockOf, sayReady, etimeMs, SAY_FAILS, sayFail } from "./keysend.js";
import strings from "./strings.js";

const RULE = "─".repeat(40);
const screen = (prompt, extra = "") => ["⏺ une réponse", "", RULE, `❯ ${prompt}`.trimEnd(), RULE, "  status line", extra].join("\n");

assert.equal(promptLine(screen("")), "");
assert.equal(promptLine(screen('Try "write a test for <filepath>"')), 'Try "write a test for <filepath>"');
assert.equal(promptLine(screen("/compact")), "/compact");
assert.equal(promptLine("❯ loose line\nno rules"), null, "a ❯ without its rules isn't the prompt");
assert.equal(promptLine("a dialog\n❯ 1. Yes\n  2. No"), null, "a dialog's choice isn't the prompt");
assert.equal(promptLine(""), null);
// The command list Claude Code opens while a /command is typed sits ABOVE the prompt, its row indented.
const listed = ["  ❯ /context        Show what fills the context", "    /cleanup         Optimize", RULE, "❯ /context", RULE, "  -- INSERT --"].join("\n");
assert.equal(promptLine(listed), "/context", "the list's chosen row isn't the prompt");
assert.ok(typedOk(listed, "/context"));

assert.ok(promptEmpty(screen("")));
assert.ok(promptEmpty(screen('Try "fix lint errors"')), "a fresh session's hint");
assert.ok(promptEmpty(screen("", "  -- INSERT -- ⏵⏵ bypass permissions on")), "vim's INSERT: letters type");
assert.ok(!promptEmpty(screen("", "  -- NORMAL -- ⏵⏵ bypass permissions on")), "vim's NORMAL: letters would be motions");
assert.ok(!promptEmpty(screen("un brouillon")));
assert.ok(!promptEmpty("no prompt here"));

assert.ok(typedOk(screen("/compact keep tests"), "/compact keep tests"));
assert.ok(!typedOk(screen("brouillon/compact"), "/compact"), "typed after someone's text");
assert.ok(!typedOk(screen("/compac"), "/compact"));

assert.deepEqual(blockOf({ status: "working", text: "/compact" }), { why: "busy" });
assert.deepEqual(blockOf({ status: "blocked", text: "/compact" }), { why: "busy" });
assert.deepEqual(blockOf({ status: "idle", before: screen("brouillon"), text: "/compact" }), { why: "prompt" });
assert.deepEqual(blockOf({ status: "idle", before: screen("", "-- NORMAL --"), text: "/compact" }), { why: "prompt" });
assert.deepEqual(blockOf({ status: "idle", before: screen(""), after: screen("x/compact"), text: "/compact" }), { why: "typed" });
assert.equal(blockOf({ status: "done", before: screen(""), after: screen("/compact"), text: "/compact" }), null);
assert.equal(blockOf({ status: "idle", before: screen('Try "x"') }), null, "before typing");
// A screen that couldn't be read (hc read failed: null) stops the route, before as after typing: never
// Enter on a prompt nobody read (#81 review, P1).
assert.deepEqual(blockOf({ status: "idle", before: null, text: "/compact" }), { why: "read" });
assert.deepEqual(blockOf({ status: "idle", before: undefined, text: "/compact" }), { why: "read" });
assert.deepEqual(blockOf({ status: "idle", before: screen(""), after: null, text: "/compact" }), { why: "read" });
assert.deepEqual(blockOf({ status: "idle", after: null, text: "/compact" }), { why: "read" });

// herdr-bridge's refusals (say.js): each its own words, fr and en, never the raw code (#81 review).
for (const w of SAY_FAILS) {
  for (const lang of ["fr", "en"]) {
    const s = strings[lang][`composer.err.${sayFail(w)}`];
    assert.ok(typeof s === "string" && s && !s.includes("{"), `${lang}: composer.err.say-${w}`);
  }
}
assert.equal(sayFail("whatever-next"), "say-refused", "a code the plugin adds later: refused");
assert.equal(sayFail("timeout"), "say-timeout");
assert.ok(strings.fr["composer.err.keys-read"] && strings.en["composer.err.keys-read"]);

// The bridge's say route: a fresh token of this session only.
const tok = JSON.stringify({ token: "test-token-fixture" });
assert.equal(sayReady(tok, 2000, 1000), true);
assert.equal(sayReady(tok, 2000, 2000), true, "written at the session's start");
assert.equal(sayReady(tok, 900, 1000), true, "within etime's 2 s slack (whole seconds)");
assert.equal(sayReady(tok, 900, 3000), false, "an earlier session's token: stale");
assert.equal(sayReady(JSON.stringify({ token: "" }), 2000, 1000), false);
assert.equal(sayReady(JSON.stringify({}), 2000, 1000), false);
assert.equal(sayReady(null, 2000, 1000), false, "no file: the bridge is absent or older (hc send)");
assert.equal(sayReady("{torn", 2000, 1000), false);

// The process' age (ps -o etime=), its start being the session's: a --resume restarts it.
assert.equal(etimeMs("01-05:20:52"), ((1 * 24 + 5) * 3600 + 20 * 60 + 52) * 1000, "as macOS printed it");
assert.equal(etimeMs("05:20:52"), (5 * 3600 + 20 * 60 + 52) * 1000);
assert.equal(etimeMs("  20:52\n"), (20 * 60 + 52) * 1000);
assert.equal(etimeMs("mer. 18 nov."), null, "lstart's localized form isn't read");
assert.equal(etimeMs(""), null);
const now = 10_000_000;
assert.equal(sayReady(tok, now - 5000, now - etimeMs("00:10")), true, "token written after the process started");
assert.equal(sayReady(tok, now - 60_000, now - etimeMs("00:10")), false, "a resumed session's old token: stale");

console.log("kt-chat keysend: ok");
