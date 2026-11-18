// node mods/kt-diff/diff.test.mjs [repo]: diff.js against hand-made patches and,
// given a repo, against its last commits (counts must match `git diff --numstat`).
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { parsePatch, plan, words, wordSpans, unquote, barWidth, pieces, zedLabel } from "./diff.js";

const patch = `diff --git a/src/a.js b/src/a.js
index 1111111..2222222 100644
--- a/src/a.js
+++ b/src/a.js
@@ -3,4 +3,4 @@ function x() {
 keep one
-const value = 1;
+const value = 2;
 keep two
--- not a header, a deleted line
@@ -40,2 +40,3 @@
 ctx
+added
 ctx2
diff --git a/img.png b/img.png
new file mode 100644
index 0000000..3333333
Binary files /dev/null and b/img.png differ
diff --git a/old name.txt b/new name.txt
similarity index 100%
rename from old name.txt
rename to new name.txt
diff --git a/gone.md b/gone.md
deleted file mode 100644
--- a/gone.md
+++ /dev/null
@@ -1,2 +0,0 @@
-one
-two
\\ No newline at end of file
diff --git "a/caf\\303\\251 \\"q\\".txt" "b/caf\\303\\251 \\"q\\".txt"
new file mode 100644
--- /dev/null
+++ "b/caf\\303\\251 \\"q\\".txt"
@@ -0,0 +1 @@
+hi
`;

const files = parsePatch(patch);
assert.deepEqual(files.map((f) => [f.path, f.status, f.binary, f.add, f.del]), [
  ["src/a.js", "M", false, 2, 2],
  ["img.png", "A", true, 0, 0],
  ["new name.txt", "R", false, 0, 0],
  ["gone.md", "D", false, 0, 2],
  ['café "q".txt', "A", false, 1, 0],
]);
assert.equal(files[2].old, "old name.txt");
const a = files[0];
assert.equal(a.hunks[0].lines[4].k, "-"); // "--- not a header" stays a deletion inside the hunk
assert.deepEqual(a.hunks[0].lines.map((l) => [l.k, l.o, l.n]), [[" ", 3, 3], ["-", 4, null], ["+", null, 4], [" ", 5, 5], ["-", 6, null]]);
assert.equal(files[3].hunks[0].lines[2].k, "\\");

// Gaps: 2 lines before the first hunk, 40-1 - 6 = 33 between; none at line 1.
assert.deepEqual(plan(a).rows.filter((r) => r.gap).map((r) => r.gap), [2, 33]);
assert.deepEqual(plan(files[3]).rows.filter((r) => r.gap), []);
// Cap: the second hunk would cross 6 lines, so it's cut; the first always shows.
assert.deepEqual([plan(a, 6).hidden, plan(a, 1).hidden, plan(a, 99).hidden], [1, 1, 0]);

// Word spans: only "1" / "2" differ.
words(a);
assert.deepEqual(a.hunks[0].lines[1].spans, [[14, 15]]);
assert.deepEqual(a.hunks[0].lines[2].spans, [[14, 15]]);
assert.equal(wordSpans("abc", "xyz"), null);
assert.equal(wordSpans("# ssh-keyscan expire au bout", "# the host key is pinned now"), null); // a rewrite: no spans
assert.equal(unquote('"tab\\there"'), "tab\there");
assert.equal(barWidth(0, 0), 8);
assert.equal(barWidth(999, 0), 100);

// index lines: the blobs' hashes, the cache's key for a PR's files.
assert.deepEqual(files.map((f) => f.ids), [["1111111", "2222222"], ["0000000", "3333333"], null, null, null]);

// pieces: Zed's runs cut at the word spans; tabs as parsePatch writes them; runs of another text dropped.
const R = (t, c) => [t, c, 0];
assert.equal(pieces("x = 1", null, null), null);
assert.deepEqual(pieces("const v = 2;", [R("const ", "#c"), R("v", "#v"), R(" = ", "#o"), R("2", "#n"), R(";", "#o")], [[10, 11]]), [
  { word: false, parts: [R("const ", "#c"), R("v", "#v"), R(" = ", "#o")] },
  { word: true, parts: [R("2", "#n")] },
  { word: false, parts: [R(";", "#o")] },
]);
// A span over two runs: one fill around both, cut where the color changes.
assert.deepEqual(pieces("ab cd", [R("ab ", "#a"), R("cd", "#b")], [[1, 4]]), [
  { word: false, parts: [R("a", "#a")] },
  { word: true, parts: [R("b ", "#a"), R("c", "#b")] },
  { word: false, parts: [R("d", "#b")] },
]);
assert.deepEqual(pieces("    x", [["\tx", "#x", 2]], null), [{ word: false, parts: [["    x", "#x", 2]] }]);
assert.deepEqual(pieces("abc", [R("abd", "#x")], [[1, 2]]), [
  { word: false, parts: [["a", null, 0]] }, { word: true, parts: [["b", null, 0]] }, { word: false, parts: [["c", null, 0]] },
]);
assert.equal(pieces("abc", [R("abd", "#x")], null), null);
assert.deepEqual(pieces("", [], null), [], "an empty line spells itself");
// Zed's settings: comments, trailing commas, a theme per appearance.
const zs = '{\n  // ui\n  "theme": {\n    "mode": "system", "light": "One Light", "dark": "Claude Dark (Pure)", /* x */\n  },\n}';
assert.equal(zedLabel(zs, "dark"), "Claude Dark (Pure)");
assert.equal(zedLabel(zs, "light"), "One Light");
assert.equal(zedLabel('{"theme": "Ayu"}', "light"), "Ayu");
assert.equal(zedLabel(null, "dark"), "one-dark-pro");
assert.equal(zedLabel("{ broken", "light"), "one-light");

// commitmsg.js: the branch's issue, CLAUDE.md's commit section, the reply's cleanup.
const { issueOf, commitSection, cleanMessage, commitPrompt } = await import("./commitmsg.js");
assert.equal(issueOf("feat/#12-greeting"), "12");
assert.equal(issueOf("dev"), null);
assert.equal(commitSection("# A\nx\n## Commits\nGitmoji\n### Sub\ny\n## Next\nz"), "## Commits\nGitmoji\n### Sub\ny");
assert.equal(cleanMessage("```\n✨ feat(x): a — b\n```"), "✨ feat(x): a, b");
// Given a repo with staged changes: secrets are named, never shown.
const staged = process.argv[3];
if (staged) {
  const { readFileSync, readdirSync } = await import("node:fs");
  const git = async (args) => execFileSync("git", ["-C", staged, ...args], { encoding: "utf8" });
  const read = async (p) => { try { return readFileSync(`${staged}/${p}`, "utf8"); } catch { return null; } };
  const list = async (d) => { try { return readdirSync(`${staged}/${d}`); } catch { return []; } };
  const prompt = await commitPrompt(git, read, list);
  assert.match(prompt, /issue #12/);
  assert.match(prompt, /by name only[^\n]*\.env\.local/);
  assert.doesNotMatch(prompt, /SECRET=1/);
  console.log("commit prompt ok");
}

// A real repo: per-file counts equal git's numstat.
const repo = process.argv[2];
if (repo) {
  const git = (...args) => execFileSync("git", ["-C", repo, "-c", "core.quotePath=false", ...args], { encoding: "utf8", maxBuffer: 64e6 });
  for (const sha of git("log", "--format=%H", "-n", "30", "--no-merges").trim().split("\n")) {
    const parsed = parsePatch(git("diff", "-M", "--no-color", "--no-ext-diff", "--src-prefix=a/", "--dst-prefix=b/", `${sha}^`, sha));
    const stat = git("diff", "-M", "--numstat", `${sha}^`, sha).trim().split("\n").filter(Boolean);
    assert.equal(parsed.length, stat.length, sha);
    for (const f of parsed) for (const h of f.hunks) assert.equal(h.lines.filter((l) => l.k !== "-" && l.k !== "\\").length, h.newLen, `${sha} ${f.path}`);
    const sum = (k) => stat.reduce((n, l) => n + (+l.split("\t")[k] || 0), 0);
    assert.deepEqual([parsed.reduce((n, f) => n + f.add, 0), parsed.reduce((n, f) => n + f.del, 0)], [sum(0), sum(1)], sha);
    parsed.forEach(words);
  }
  console.log("repo ok");
}
console.log("diff.js ok");
