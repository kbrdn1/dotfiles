// bun mods/kt-new/gwm.check.mjs: gwm.js against gwm 1.11's real lines (scratch repo, no TTY).
import assert from "node:assert/strict";
import { issueOf, firstMessage, firstTask, startCommand, plan, retry, TRUST, where, explain } from "./gwm.js";

const P = "/tmp/s/repo-worktrees/feat-1-hello-world";
const created = `creating worktree:\n  branch : feat/#1-hello-world\n  path   : ${P}\n✓ worktree created at ${P}\nwarning: [[bootstrap.command]] is deprecated\n  ✓ [post_create] notify`;
const again = `worktree for issue #1 already exists at ${P}\n`;
const there = `\nerror: worktree 'feat-1-hello-world' already exists at ${P}`;
const stale = "creating worktree:\n  path   : /tmp/s/x\nerror: branch 'feat/#2-stale' already exists at cf783bc6dd6cd19ce8e8e2cab55383c91c27affb: pass --reuse-branch to attach the worktree to it, or delete the stale branch first";
const untrusted = "\nerror: .gwm.toml at /tmp/s/repo/.gwm.toml is not in the trust ledger and stdin is not interactive: pass --allow-bootstrap (or set GWM_ALLOW_BOOTSTRAP=1) to bypass, or run interactively to approve";
const noForge = "\nerror: origin '/tmp/s/remote.git' is not a recognised git remote URL";
const closed = "resolving issue #9 on o/r …\nerror: issue #9 is closed. Pass --force to open a worktree for it anyway.";
const labels = "error: issue labels [bug, enhancement] do not separate the branch types they match (feat, fix): pass --type <TYPE> to choose";
// A post_create hook failing (`run = "false"`): exit 1, the worktree stays.
const hook = `creating worktree:\n  branch : feat/#5-boom\n✓ worktree created at ${P}\n  ✗ [post_create] boom\n      exited with exit status: 1\nerror: command failed: hook post_create 'boom' failed: exited with exit status: 1`;

// Where the worktree is.
assert.equal(where(created, 0), P);
assert.equal(where(again, 0), P);
assert.equal(where(there, 1), P);
assert.equal(where(stale, 1), null, "an oid is not a path");
assert.equal(where(hook, 1), null, "a failed hook is a failure, not a worktree to open");
assert.equal(untrusted.match(TRUST)?.[1], "/tmp/s/repo/.gwm.toml");

// The thread's text.
assert.deepEqual(issueOf("#42"), { issue: "42", desc: null });
assert.deepEqual(issueOf(" #42 fix the login "), { issue: "42", desc: "fix the login" });
assert.deepEqual(issueOf("42 fix"), { issue: "42", desc: "fix" });
assert.equal(issueOf("42"), null);
assert.equal(issueOf("#42x"), null);
assert.equal(issueOf("fix the login"), null);
assert.equal(firstMessage("#42 fix"), "Issue #42 fix");
assert.equal(firstMessage("fix the login"), "fix the login");

// What to run, and what next.
const bare = plan({ issue: "42", desc: null }, "feat", false);
assert.deepEqual(bare, { triple: null, first: ["create", "--reuse-branch", "--issue", "42"] });
const desc = plan({ issue: "42", desc: "fix it" }, "fix", false);
assert.deepEqual(desc.first, ["create", "--reuse-branch", "--issue", "42"]);
assert.deepEqual(desc.triple, ["create", "--reuse-branch", "fix", "42", "fix it"]);
assert.deepEqual(plan({ issue: "42", desc: null }, "fix", true).first, ["create", "--reuse-branch", "--issue", "42", "--type", "fix"]);
const picked = plan({ issue: "42", desc: "fix it" }, "fix", true);
assert.equal(picked.first, picked.triple, "a picked type with a description: the triple first");

assert.deepEqual(retry(labels, bare.first, bare, "feat", false), [...bare.first, "--type", "feat"]);
assert.equal(retry(noForge, bare.first, bare, "feat", false), null, "no description: nothing to fall back to");
assert.equal(retry(noForge, desc.first, desc, "fix", false), desc.triple);
assert.equal(retry(closed, desc.first, desc, "fix", false), null, "a closed issue is never bypassed");
assert.equal(retry(untrusted, desc.first, desc, "fix", false), null, "the trust ledger is askTrust's");
assert.equal(retry(stale, desc.triple, desc, "fix", false), null, "the triple is the last try");
assert.equal(retry(labels, picked.first, picked, "fix", true), null);
assert.equal(retry(hook, desc.first, desc, "fix", false), null, "no second worktree after a failed hook");
assert.equal(retry(`✓ fetched issue #42 Fix it\n${stale}`, desc.first, desc, "fix", false), null, "the issue was read: no triple");

// What the refusal is (main.js says it in words, strings.js' gwm.<kind>).
assert.equal(explain(noForge), "notFound");
assert.equal(explain(closed), "closed");
assert.equal(explain(stale), "failed");
assert.equal(explain(hook.split("\n").pop()), "hook");
assert.equal(explain("zsh: command not found: gwm"), "failed");

// The first message: the consigne whole (multi-line, long) when there is one; else the name (Issue #N…),
// plus gwm's title for a bare #N; nothing for the shell.
const consigne = `Reprends le login.\n${"x".repeat(300)}\nPuis ouvre la PR.`;
assert.equal(firstTask({ name: "#42 fix", consigne, prompt: true, title: "Fix it" }), consigne);
assert.equal(firstTask({ name: "#42 fix", consigne: "  \n ", prompt: true }), "Issue #42 fix");
assert.equal(firstTask({ name: "#42", prompt: true, title: "Fix the login" }), "Issue #42 Fix the login");
assert.equal(firstTask({ name: "#42 fix", prompt: true, title: "Fix the login", desc: "fix" }), "Issue #42 fix");
assert.equal(firstTask({ name: "x", consigne, prompt: false }), undefined);
// The command: the agent's own CLI in a tab (current checkout), in the worktree's open space, or a new
// space on it; the consigne as its first message, the name short.
assert.deepEqual(startCommand({ space: "s1", argv: ["claude"], name: "Login", task: consigne }),
  { name: "tab.new", args: { space: "s1", argv: ["claude"], task: consigne, name: "Login" } });
assert.deepEqual(startCommand({ space: "s1", path: P, open: "s9", argv: ["codex"], name: "fix", task: "t" }),
  { name: "tab.new", args: { space: "s9", argv: ["codex"], task: "t", name: "fix" } });
assert.deepEqual(startCommand({ space: "s1", path: P, machine: null, argv: ["vibe"], name: "fix", task: "t" }),
  { name: "space.new", args: { folder: P, tab: "fix", argv: ["vibe"], task: "t", machine: "" } });
assert.deepEqual(startCommand({ space: "s1", argv: null, name: "sh", task: undefined }).args, { space: "s1", argv: undefined, task: undefined, name: "sh" });

console.log("gwm.js: ok");
