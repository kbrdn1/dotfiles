// bun keysend.check.mjs: keysend.js on invented TUI screens (Claude Code's prompt framed by rules, as
// `hc read` gives it): the prompt read, empty or hinted, what was typed, the step that stops.
import assert from "node:assert/strict";
import { promptLine, promptEmpty, typedOk, blockOf, sayReady, etimeMs, SAY_FAILS, sayFail, listChoice, keysSend, sayReadyOf } from "./keysend.js";
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
// The list's chosen row is the one Enter takes: it must name the command itself (another one ranked
// first would run instead).
assert.equal(listChoice(listed), "/context");
assert.equal(listChoice(screen("/compact")), null, "no list on screen");
const ranked = ["  ❯ /compact-notes    Notes", "    /compact          Summarize", RULE, "❯ /compact", RULE].join("\n");
assert.equal(listChoice(ranked), "/compact-notes");
assert.deepEqual(blockOf({ status: "idle", after: ranked, text: "/compact" }), { why: "list" }, "another command chosen: no Enter");
assert.equal(blockOf({ status: "idle", after: listed, text: "/context" }), null, "the command itself chosen: Enter");
assert.equal(blockOf({ status: "idle", after: ["  ❯ /compact   Summarize", RULE, "❯ /compact keep tests", RULE].join("\n"), text: "/compact keep tests" }), null, "its arguments after it");
assert.ok(strings.fr["composer.err.keys-list"] && strings.en["composer.err.keys-list"]);
// As /compact showed it (2.1.328): a description too long goes on under its row, at its column.
const wrapped = [
  " ▝▝   ▝▝   /w/demo · /rc",
  "  ❯ /compact                                             Free up context by summarizing the conversation so",
  "    /autocompact                                         Set how full the context gets before auto-summarizing",
  "    /computer-use                                        Read this skill before the first step of any request",
  "                                                         any desktop app), to look at their screen, or for",
  RULE, "❯ /compact", RULE,
].join("\n");
assert.equal(listChoice(wrapped), "/compact", "its row found over a wrapped description");
assert.equal(listChoice(wrapped.replace("  ❯ /compact", "    /compact").replace("    /autocompact", "  ❯ /autocompact")), "/autocompact");
assert.deepEqual(blockOf({ status: "idle", after: wrapped.replace("  ❯ /compact", "    /compact").replace("    /autocompact", "  ❯ /autocompact"), text: "/compact" }), { why: "list" });
// The prompt's ❯ is followed by a no-break space on a live session (2.1.328): read as nothing typed.
const nbsp = ["⏺ ok", RULE, "❯ ", RULE].join("\n");
assert.equal(promptLine(nbsp), "");
assert.ok(promptEmpty(nbsp));
assert.ok(typedOk(["⏺ ok", RULE, "❯ /compact", RULE].join("\n"), "/compact"));
assert.equal(listChoice(["  ❯ /compact   Summarize", RULE, "❯ /compact", RULE].join("\n")), "/compact");

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

// keysSend (shared since « Compacter », compact.js): its io, the screens it reads, Enter only on the command.
{
  const run = async ({ status = "idle", before = "", after = "/compact", list = null } = {}) => {
    const calls = [];
    let typed = false;
    const screenOf = (p) => [...(list && typed ? [`  ❯ ${list}   Summarize`] : []), RULE, `❯ ${p}`.trimEnd(), RULE].join("\n");
    const io = {
      status: () => status,
      sleep: async () => {},
      hc: async (a) => {
        calls.push(a.join(" "));
        if (a[0] === "read") return { code: 0, stdout: screenOf(typed ? after : before) };
        if (a[0] === "keys" && a[2] !== "enter") typed = true;
        return { code: 0, stdout: "" };
      },
    };
    return { res: await keysSend(io, "t9", [..."/compact"], "/compact"), calls };
  };
  let r = await run();
  assert.deepEqual(r.res, { ok: true });
  assert.deepEqual(r.calls, ["read t9", "keys t9 / c o m p a c t", "read t9", "keys t9 enter"]);
  r = await run({ list: "/compact" });
  assert.deepEqual(r.res, { ok: true }, "its own row chosen in the list");
  r = await run({ list: "/compact-notes" });
  assert.deepEqual([r.res.why, r.calls.includes("keys t9 enter")], ["keys-list", false], "another row chosen: never Enter");
  r = await run({ status: "working" });
  assert.deepEqual([r.res.why, r.calls.length], ["keys-busy", 1]);
  r = await run({ before: "brouillon" });
  assert.deepEqual([r.res.why, r.calls.some((c) => c.startsWith("keys"))], ["keys-prompt", false]);
}
// sayReadyOf: no token file, nothing else asked; a fresh token, ready; an old one, not.
{
  const asked = [];
  const io = (files, { etime = "00:10", mtime = 10_000 } = {}) => ({
    home: "/tfx", now: () => 20_000,
    read: async (p) => { asked.push(`read ${p}`); return files[p] ?? null; },
    mtime: async () => mtime,
    hc: async (a) => { asked.push(a.join(" ")); return { code: 0, stdout: JSON.stringify({ foreground: { pid: 42 } }) }; },
    exec: async (c, a) => { asked.push(`${c} ${a.join(" ")}`); return { code: 0, stdout: etime }; },
  });
  const P = "/tfx/.claude/cache/herdr/t9.saytoken.json";
  assert.equal(await sayReadyOf(io({}), "t9"), false);
  assert.deepEqual(asked, [`read ${P}`], "no token: neither hc get nor ps");
  assert.equal(await sayReadyOf(io({ [P]: tok }), "t9"), true, "a token written after the process started");
  assert.equal(await sayReadyOf(io({ [P]: tok }, { mtime: 1_000 }), "t9"), false, "an older run's token");
  assert.equal(await sayReadyOf(io({ [P]: tok }), "vps/t9"), false, "another machine's agent: never");
}

console.log("kt-chat keysend: ok");
