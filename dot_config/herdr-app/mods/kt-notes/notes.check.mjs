// bun mods/kt-notes/notes.check.mjs: gwm's note store as notes.js mirrors it.
import assert from "node:assert/strict";
import { relativePath, branchFromRelative, notePath, projectPath, normalize, present, parseItem, segments, chunks, toggleTask,
  preview, parseFind, classify, caseRival, external } from "./notes.js";

// Paths (notes.rs relative_path / branch_from_relative).
assert.equal(relativePath("feat/#515-notes"), "feat/#515-notes.md");
assert.equal(relativePath("main"), "main.md");
assert.equal(relativePath("foo.md"), "foo.md.md"); // the last component is free
assert.equal(relativePath("foo.md/bar"), null); // a folder ending in .md
assert.equal(relativePath("FOO.MD/bar"), null);
for (const bad of ["", "a//b", "a/./b", "../x", "a/b.", "a ", "x:y", "a<b", "a|b", "q?", "s*", "a\\b", "t\u0007", "CON", "con.txt/x", "lpt¹", "x/NUL.md"])
  assert.equal(relativePath(bad), null, bad);
assert.equal(relativePath("console"), "console.md"); // a stem, not a prefix
assert.equal(branchFromRelative("feat/#515-notes.md"), "feat/#515-notes");
assert.equal(branchFromRelative("foo.md.md"), "foo.md");
assert.equal(branchFromRelative(".md"), null);
assert.equal(branchFromRelative("a/../b.md"), null);
assert.equal(branchFromRelative("readme.txt"), null);
for (const b of ["feat/#1-x", "fix/a/b", "dev"]) assert.equal(branchFromRelative(relativePath(b)), b);
assert.equal(notePath("/r/.git", "feat/#1-x"), "/r/.git/gwm/notes/feat/#1-x.md");
assert.equal(notePath("/r/.git", null), null); // detached
assert.equal(projectPath("/r/.git"), "/r/.git/kbrdn/notes/project.md");

// Disk text (NoteEditor::text) and presence (notes::read).
assert.equal(normalize("a"), "a\n");
assert.equal(normalize("a\n\n\n"), "a\n");
assert.equal(normalize(" \n\t\n"), "");
assert.equal(normalize(null), "");
assert.equal(present(" \n"), false);
assert.equal(present("x"), true);
assert.equal(present(null), false);

// List markers (ListLine::parse).
assert.deepEqual(parseItem("- [ ] a"), { indent: 0, kind: "open", width: 6 });
assert.deepEqual(parseItem("  - [X] c"), { indent: 2, kind: "done", width: 8 });
assert.deepEqual(parseItem("- [x]"), { indent: 0, kind: "done", width: 5 });
assert.deepEqual(parseItem("- item"), { indent: 0, kind: "bullet", width: 2 });
assert.deepEqual(parseItem("-"), { indent: 0, kind: "bullet", width: 1 });
for (const prose of ["-foo", "--flag", "- [a] z", "- [x]z", "* [ ] star", "text"]) assert.equal(parseItem(prose), null, prose);

// The reader's cut: tasks with their line, fenced lines never tasks.
const doc = "# Titre\n\n- [ ] écrire\n- [x] lire\nprose\n```\n- [ ] code\n```\n  - [ ] sous-tâche";
assert.deepEqual(segments(doc), [
  { kind: "md", text: "# Titre" },
  { kind: "task", line: 2, done: false, indent: 0, text: "écrire" },
  { kind: "task", line: 3, done: true, indent: 0, text: "lire" },
  { kind: "md", text: "prose\n```\n- [ ] code\n```" },
  { kind: "task", line: 8, done: false, indent: 2, text: "sous-tâche" },
]);
assert.deepEqual(segments(""), []);

// A note without boxes cut into blocks for the reader's cursor (#78): at a blank line then column 0,
// a list item's indented continuation and a fence's blank lines kept whole.
assert.deepEqual(chunks("# Titre\n\nUn paragraphe\nsur deux lignes.\n\n- a\n\n  suite de a\n- b\n\n```\nx\n\ny\n```\n\nFin"), [
  "# Titre", "Un paragraphe\nsur deux lignes.", "- a\n\n  suite de a\n- b", "```\nx\n\ny\n```", "Fin",
]);
assert.deepEqual(chunks("seul"), ["seul"]);
// The frontmatter whole, a blank line in it or not.
assert.deepEqual(chunks("---\ntitle: x\n\ntags: a\n---\n\nCorps."), ["---\ntitle: x\n\ntags: a\n---", "Corps."]);
// A long note: at most `max` blocks, neighbours joined in order.
const many = Array.from({ length: 10 }, (_, i) => `p${i}`).join("\n\n");
assert.deepEqual(chunks(many, 4), ["p0\n\np1\n\np2", "p3\n\np4\n\np5", "p6\n\np7\n\np8", "p9"]);
assert.equal(chunks(many).length, 10);
assert.deepEqual(chunks("\n\n"), []);

// Toggling (toggle_checkbox + rewrite_marker): only the marker moves, the rest is kept byte for byte.
assert.equal(toggleTask("- [ ] a", 0), "- [x] a");
assert.equal(toggleTask("x\n  - [X] c\ny", 1), "x\n  - [ ] c\ny");
assert.equal(toggleTask("- [x]", 0), "- [ ] ");
assert.equal(toggleTask("- bullet", 0), "- bullet"); // a bullet is not a box here
assert.equal(toggleTask("prose", 0), "prose");
assert.equal(toggleTask(doc, 2).split("\n")[2], "- [x] écrire");

assert.equal(preview("\n## Titre\nsuite"), "Titre");
assert.equal(preview("- [ ] faire ça"), "faire ça");
assert.equal(preview("  \n"), "");

// find + stat output.
assert.deepEqual(parseFind("1700000000 gwm/notes/feat/#1-x.md\n1700000001 kbrdn/notes/project.md\n12 gwm/notes/.md\n9 kbrdn/notes/other.md\n"), [
  { kind: "gwm", rel: "gwm/notes/feat/#1-x.md", branch: "feat/#1-x", mtime: 1700000000 },
  { kind: "project", rel: "kbrdn/notes/project.md", mtime: 1700000001 },
]);

// Worktrees, notes left without one, and gwm doctor's orphans (branch gone).
const { rows, orphans } = classify(
  [{ name: "repo", branch: "main" }, { name: "x", branch: "feat/#1-x" }, { name: "d", branch: null }],
  [{ branch: "feat/#1-x", text: "a\n", mtime: 5 }, { branch: "old", text: "b\n", mtime: 3 }, { branch: "gone", text: "c\n", mtime: 4 }, { branch: "main", text: "  \n", mtime: 1 }],
  ["main", "feat/#1-x", "old"]);
assert.deepEqual(rows.map((r) => r.note?.text ?? null), [null, "a\n", null]); // main's blank file is no note
assert.deepEqual(orphans.map((o) => [o.branch, o.gone]), [["gone", true], ["old", false]]);

assert.equal(caseRival("feat/Foo", ["feat/foo", "main"]), "feat/foo");
assert.equal(caseRival("feat/foo", ["feat/foo", "main"]), null);

// A file changed under an open note.
assert.equal(external("a\n", "a\n", "a\nmine"), "none");
assert.equal(external("b\n", "a\n", "a\n"), "reload"); // nothing typed: follow the disk
assert.equal(external("b\n", "a\n", "b"), "adopt"); // typed the same thing
assert.equal(external("b\n", "a\n", "mine"), "conflict"); // never overwrite
assert.equal(external(null, null, ""), "none");
assert.equal(external("x\n", null, ""), "reload"); // a note appeared elsewhere while this one was empty

console.log("notes.check: ok");
