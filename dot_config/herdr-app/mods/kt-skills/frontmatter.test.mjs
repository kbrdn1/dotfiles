// node mods/kt-skills/frontmatter.test.mjs: the shapes found in ~/.claude and ~/.agents skills.
import assert from "node:assert/strict";
import { frontmatter } from "./frontmatter.js";
import { githubSource, cloneArgv } from "./github.js";

const { meta, body } = frontmatter(`---
name: "me:loop:x"
description: >-
  Folded over
  two lines.

  Second paragraph.
allowed-tools: [Bash, 'Read, Write', "Edit"]
model: 'it''s'
user-invocable: false
plain: a: b — lenient like Claude Code
lit: |
  keep
    this
list:
- one
- two: 2
  three: 3
metadata:
  argument-hint: <feature>
  requires:
    bins:
      - spark
esc: "say \\"hi\\"\\n"
---
body
---
name: not frontmatter
`);
assert.equal(meta.name, "me:loop:x");
assert.equal(meta.description, "Folded over two lines.\nSecond paragraph.");
assert.deepEqual(meta["allowed-tools"], ["Bash", "Read, Write", "Edit"]);
assert.equal(meta.model, "it's");
assert.equal(meta["user-invocable"], "false");
assert.equal(meta.plain, "a: b — lenient like Claude Code");
assert.equal(meta.lit, "keep\n  this");
assert.deepEqual(meta.list, ["one", "two: 2, three: 3"]);
assert.deepEqual(meta.metadata, { "argument-hint": "<feature>", requires: "bins: - spark" });
assert.equal(meta.esc, 'say "hi"\n');
assert.equal(body, "body\n---\nname: not frontmatter\n");
assert.deepEqual(frontmatter("# no frontmatter").meta, {});
console.log("frontmatter: ok");
// The viewer's body cut (markdown.js) is checked with it: bun mods/kt-keys/markdown.check.mjs.

// « Depuis GitHub »: the source's forms; a path never leaves the clone.
const g = (s) => githubSource(s);
assert.deepEqual(g("getsentry/XcodeBuildMCP/skills/xcodebuildmcp"), { owner: "getsentry", repo: "XcodeBuildMCP", ref: null, path: "skills/xcodebuildmcp", url: "https://github.com/getsentry/XcodeBuildMCP.git" });
assert.deepEqual(g("https://github.com/o/r/tree/main/a/b/"), { owner: "o", repo: "r", ref: "main", path: "a/b", url: "https://github.com/o/r.git" });
assert.equal(g("https://github.com/o/r/blob/v1/x/SKILL.md").path, "x");
assert.equal(g("git@github.com:o/r.git").repo, "r");
assert.equal(g("https://github.com/o/r.git").path, "");
for (const bad of ["o/r/../etc", "o/r/./x", "../r", "o", "https://evil.com/o/r", "o/r/a b", "-o/r"]) assert.ok(g(bad).error, bad);
// The clone of an untrusted repo: guarded git, argv only (issue #70).
assert.deepEqual(cloneArgv(g("https://github.com/o/r/tree/v1/x"), "/tmp/kt-skill.abc/repo"), ["GIT_TERMINAL_PROMPT=0", "GIT_LFS_SKIP_SMUDGE=1", "git",
  "-c", "protocol.file.allow=never", "-c", "core.symlinks=false", "-c", "core.hooksPath=/dev/null", "-c", "core.fsmonitor=false",
  "clone", "--depth", "1", "--branch", "v1", "https://github.com/o/r.git", "/tmp/kt-skill.abc/repo"]);
assert.ok(!cloneArgv(g("o/r"), "/d").includes("--branch"), "no ref: the default branch");
console.log("github: ok");
