// node mods/kt-skills/frontmatter.test.mjs: the shapes found in ~/.claude and ~/.agents skills.
import assert from "node:assert/strict";
import { frontmatter } from "./frontmatter.js";

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
