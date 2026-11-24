// bun attach.check.mjs: the Chat's draft attachments (#93), with made-up paths: the list, what goes to
// the agent, the paste and chooser commands, « Citer ».
import assert from "node:assert/strict";
import { DRAFT_MAX, PASTE_KEPT, add, copyArgs, draftItem, isPasteName, mentionText, mentionsOf, pasteArgs, pasteChoice, pasteName, pasteSweep, pasted, pickArgs, picked, plainOf, promptOf, quoteOf, remove } from "./attach.js";

// A piece (the shape #81 shares): what shows, exactly what goes, its att-model kind for the viewer.
assert.deepEqual(draftItem("/p/cap.png", "drop"), {
  id: "d:/p/cap.png", kind: "image", category: "file", label: "cap.png", text: "@/p/cap.png", path: "/p/cap.png", source: "drop", doc: { kind: "image", drawn: true },
});
assert.deepEqual([draftItem("/p/devis.pdf", "pick").kind, draftItem("/p/devis.pdf", "pick").doc], ["file", { kind: "pdf" }]);
assert.equal(draftItem("/p/cap.png", "drop", "codex").text, "/p/cap.png", "Codex: the path");
assert.equal(draftItem("cap.png"), null, "relative");
assert.equal(draftItem("/p/a\nb.png"), null, "a newline");
// The list: once each, DRAFT_MAX at most, a removal by id.
let r = add([], ["/p/cap.png", "/p/devis.pdf", "/p/cap.png", "rel.md"], "drop");
assert.deepEqual(r.list.map((a) => a.label), ["cap.png", "devis.pdf"]);
assert.deepEqual(r.refused, ["rel.md"]);
assert.equal(r.added.length, 2);
r = add(r.list, Array.from({ length: 12 }, (_, i) => `/p/f${i}.png`), "pick");
assert.equal(r.list.length, DRAFT_MAX);
assert.equal(r.refused.length, 12 - (DRAFT_MAX - 2));
assert.deepEqual(remove(r.list, "d:/p/cap.png").map((a) => a.label).slice(0, 2), ["devis.pdf", "f0.png"]);

// A mention, one form for #81 and #93: `@path` for Claude Code, the path for the others; a space: quoted.
assert.equal(mentionText("claude", "/p/cap.png"), "@/p/cap.png");
assert.equal(mentionText("codex", "/p/cap.png"), "/p/cap.png");
assert.equal(mentionText("claude", "/p/Mes captures/a.png"), '"/p/Mes captures/a.png"');
// What goes: the text, then each piece's text, once, none the text holds already.
const atts = [draftItem("/p/cap.png"), draftItem("/p/devis.pdf")];
assert.equal(promptOf("Regarde ça  \n\n", atts), "Regarde ça\n\n@/p/cap.png @/p/devis.pdf");
assert.equal(promptOf("", atts), "@/p/cap.png @/p/devis.pdf", "attachments alone");
assert.equal(promptOf("Lis @/p/devis.pdf d'abord", atts), "Lis @/p/devis.pdf d'abord\n\n@/p/cap.png", "a path the text mentions: once");
assert.equal(promptOf("Vois", [...atts, draftItem("/p/cap.png")]), "Vois\n\n@/p/cap.png @/p/devis.pdf", "a piece twice: once");
assert.equal(promptOf("Rien", []), "Rien");
assert.deepEqual([...mentionsOf('voir @/a/b.png et @"/a/c d.png", pas mail@x.fr')], ["/a/b.png", "/a/c d.png"]);

// A paste: the Finder's files first, else the clipboard's image written as a PNG.
const out = "/h/.config/herdr-app/data/kt-chat/paste/paste-1795000000000.png";
const pa = pasteArgs(out);
assert.deepEqual([pa[0], pa[1], pa[2], pa.at(-1)], ["-l", "JavaScript", "-e", out]);
assert.ok(pa[3].indexOf("NSURL") < pa[3].indexOf("NSPasteboardTypePNG"), "files before the image (a file copied carries its icon)");
assert.ok(pa[3].includes("NSPasteboardTypeTIFF"), "TIFF converted");
// Cmd+V with text (pasteKey): the files only, never the image (a text copied with one stays text).
const fo = pasteArgs("", true);
assert.deepEqual(fo.slice(-2), ["", "files"]);
assert.equal(pasteArgs(out).length, 5, "the paste with no text: no « files »");
assert.ok(pa[3].indexOf('argv[1] === "files"') > pa[3].indexOf("files.length") && pa[3].indexOf('argv[1] === "files"') < pa[3].indexOf("NSPasteboardTypePNG"), "after the files, before the image");
// What a Cmd+V does: a Finder copy (6 files, their names as text, joined by \r: probed) joins the files,
// never types the text; a text alone goes in, its line ends as the field's; nothing to read: as typed;
// no text: the paste with no text.
const finder = { files: ["/p/a b.pdf", "/p/c.csv"] };
assert.deepEqual(pasteChoice("a b.pdf\rc.csv", finder), { files: ["/p/a b.pdf", "/p/c.csv"] });
assert.deepEqual(pasteChoice("/p/a b.pdf/p/c.csv", finder), { files: ["/p/a b.pdf", "/p/c.csv"] }, "whatever the text says");
assert.deepEqual(pasteChoice("un\r\ndeux\rtrois", { none: true }), { text: "un\ndeux\ntrois" });
assert.deepEqual(pasteChoice("garde-le", { failed: true }), { text: "garde-le" }, "the read failing never loses a text");
assert.deepEqual(pasteChoice("", { none: true }), { other: true });
assert.deepEqual(pasteChoice(undefined, null), { other: true });
// A piece copied as a file: its URL alone, on a private pasteboard here (never Kylian's), read back.
assert.deepEqual(copyArgs("/p/x.pdf").slice(-1), ["/p/x.pdf"]);
const board = `kt-chat-check-${process.pid}`;
const wrote = Bun.spawnSync(["/usr/bin/osascript", ...copyArgs("/tmp/un fichier.pdf", board)]);
const READ = 'function run(a) { ObjC.import("AppKit"); const pb = $.NSPasteboard.pasteboardWithName(a[0]); const u = pb.readObjectsForClassesOptions($([$.NSURL]), $({})); const p = []; for (let i = 0; u && !u.isNil() && i < u.count; i++) { const x = u.objectAtIndex(i); if (x.isFileURL) p.push(x.path.js); } pb.releaseGlobally; return JSON.stringify(p); }';
const back = Bun.spawnSync(["/usr/bin/osascript", "-l", "JavaScript", "-e", READ, board]);
assert.deepEqual([String(wrote.stdout).trim(), JSON.parse(String(back.stdout))], ["ok", ["/tmp/un fichier.pdf"]], "the file's URL, and only it");
assert.equal(pasteName(1795000000000.7), "paste-1795000000000.png");
assert.ok(isPasteName(pasteName(1795000000000)));
assert.ok(!isPasteName("th-0a1b2c3d.png") && !isPasteName("paste-x.png") && !isPasteName("../paste-1795000000000.png"));
// The folder: the PASTE_KEPT newest stay, one waiting above the field too, nothing else is touched.
const names = [...Array.from({ length: PASTE_KEPT + 3 }, (_, i) => pasteName(1795000000000 + i * 1000)), "notes.txt", "th-0a1b2c3d.png"];
const oldest = pasteName(1795000000000);
assert.deepEqual(pasteSweep(names), [2, 1, 0].map((i) => pasteName(1795000000000 + i * 1000)));
assert.deepEqual(pasteSweep(names, new Set([oldest])), [2, 1].map((i) => pasteName(1795000000000 + i * 1000)), "the one waiting stays");
assert.deepEqual(pasteSweep(["notes.txt"]), []);
assert.deepEqual(pasted({ code: 0, stdout: "files\n/p/a.pdf\n/p/b c.png\n" }), { files: ["/p/a.pdf", "/p/b c.png"] });
assert.deepEqual(pasted({ code: 0, stdout: "image\n" }), { image: true });
assert.deepEqual(pasted({ code: 0, stdout: "none\n" }), { none: true });
assert.deepEqual(pasted({ code: 1, stdout: "" }), { failed: true });
assert.deepEqual(pasted({ code: 0, stdout: "???" }), { failed: true });

// The chooser.
const pk = pickArgs("Joindre");
assert.equal(pk.at(-1), "Joindre");
assert.ok(pk.includes("set fs to choose file with prompt (item 1 of argv) with multiple selections allowed"));
assert.equal(pk.filter((x) => x === "-e").length, (pk.length - 1) / 2, "one -e per line, the prompt last");
assert.deepEqual(picked({ code: 0, stdout: "/p/a.png\n/p/Mes docs/b.pdf\n\n" }), { paths: ["/p/a.png", "/p/Mes docs/b.pdf"] });
assert.deepEqual(picked({ code: 1, stderr: "execution error: User canceled. (-128)" }), { paths: [] }, "cancelled");
assert.ok(picked({ code: 1, stderr: "boom" }).error);

// « Citer »: the selection copied from this message, else the whole message, after `> `.
const msg = "Le **devis** est prêt.\n\nVoir [le fichier](./devis.pdf) et `make check`.";
assert.equal(plainOf(msg), "Le devis est prêt. Voir le fichier et make check.");
assert.equal(quoteOf(msg, "devis est prêt"), "> devis est prêt\n\n", "a selection from it");
assert.equal(quoteOf(msg, "autre chose ailleurs"), "> Le **devis** est prêt.\n>\n> Voir [le fichier](./devis.pdf) et `make check`.\n\n", "not from it: the whole message");
assert.equal(quoteOf(msg, ""), quoteOf(msg, null));
assert.equal(quoteOf("", "x"), "");
// A copy that only happens to be in the message is no selection (cold review, pass 2, point 7): « dev »
// copied in a terminal, then Citer under an answer that says « dev », quotes the answer.
const answer = "La branche dev est à jour : rien à fusionner.";
assert.equal(quoteOf(answer, "dev"), `> ${answer}\n\n`, "« dev »: a banal copy, the whole answer");
assert.equal(quoteOf(answer, "est à"), `> ${answer}\n\n`, "two short words: not enough");
assert.equal(quoteOf(answer, "anche dev est à jour"), `> ${answer}\n\n`, "cut inside a word: no selection");
assert.equal(quoteOf(answer, "branche dev est à jour"), "> branche dev est à jour\n\n", "whole words, long enough: the selection");
assert.equal(quoteOf(msg, "Voir le fichier et make check"), "> Voir le fichier et make check\n\n", "as read on screen: link and code without their marks");
const pose = "Clé déjà posée là-bas";
assert.equal(quoteOf(pose, "éjà posée là-bas"), `> ${pose}\n\n`, "an accented letter is a letter: cut inside a word");
assert.equal(quoteOf(pose, "déjà posée là-bas"), "> déjà posée là-bas\n\n");

console.log("attach: ok");
