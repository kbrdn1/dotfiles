// node mods/kt-skills/frontmatter.test.mjs: the shapes found in ~/.claude and ~/.agents skills.
import assert from "node:assert/strict";
import { frontmatter } from "./frontmatter.js";
import { blocks } from "./markdown.js";
import { githubSource } from "./github.js";

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

// The body cut for the viewer: fences (any indent, ``` or ~~~, unclosed runs to the end); tables stay.
const b = blocks(`# T

1. **config.json** :
   \`\`\`json
   { "a": 1 }
     nested
   \`\`\`
2. next

| A | \`b|c\` |
|---|:-:|
| 1 | 2 |

~~~
x
~~~
Inline \`\`\`not a fence\`\`\` here.
\`\`\`sh
unclosed`);
assert.deepEqual(b.map((x) => x.kind), ["md", "code", "md", "code", "md", "code"]);
assert.deepEqual(b[1], { kind: "code", lang: "json", text: '{ "a": 1 }\n  nested' });
assert.ok(b[2].text.startsWith("2. next") && b[2].text.includes("|---|:-:|"));
assert.equal(b[4].text, "Inline ```not a fence``` here.");
assert.deepEqual(b[5], { kind: "code", lang: "sh", text: "unclosed" });
console.log("markdown: ok");

// « Depuis GitHub »: the source's forms; a path never leaves the clone.
const g = (s) => githubSource(s);
assert.deepEqual(g("getsentry/XcodeBuildMCP/skills/xcodebuildmcp"), { owner: "getsentry", repo: "XcodeBuildMCP", ref: null, path: "skills/xcodebuildmcp", url: "https://github.com/getsentry/XcodeBuildMCP.git" });
assert.deepEqual(g("https://github.com/o/r/tree/main/a/b/"), { owner: "o", repo: "r", ref: "main", path: "a/b", url: "https://github.com/o/r.git" });
assert.equal(g("https://github.com/o/r/blob/v1/x/SKILL.md").path, "x");
assert.equal(g("git@github.com:o/r.git").repo, "r");
assert.equal(g("https://github.com/o/r.git").path, "");
for (const bad of ["o/r/../etc", "o/r/./x", "../r", "o", "https://evil.com/o/r", "o/r/a b", "-o/r"]) assert.ok(g(bad).error, bad);
console.log("github: ok");
