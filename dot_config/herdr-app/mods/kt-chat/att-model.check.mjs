// bun att-model.check.mjs: attachments' kinds, the index's image refs, the cache's names and bounds.
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmdirSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { attachmentsOf, b64bytes, cacheName, colsFor, FAMILIES, familyOf, gridPlan, gridW, hash8, imageAt, imagesOf, isCacheName, kindOf, photoSize, sweepPlan, tileOf } from "./att-model.js";

// Kinds, from a name or a media type.
assert.deepEqual(kindOf("capture.PNG"), { kind: "image", drawn: true });
assert.deepEqual(kindOf("photo.heic"), { kind: "image", drawn: false });
assert.deepEqual(kindOf(null, "image/jpeg"), { kind: "image", drawn: true });
assert.deepEqual(kindOf("devis.pdf"), { kind: "pdf" });
assert.deepEqual(kindOf("NOTES.md"), { kind: "markdown" });
assert.deepEqual(kindOf("src/main.rs"), { kind: "code", lang: "rs" });
assert.deepEqual(kindOf("/x/Dockerfile"), { kind: "code", lang: "dockerfile" });
assert.deepEqual(kindOf("journal.log"), { kind: "text" });
assert.deepEqual(kindOf("LICENSE"), { kind: "text" });
assert.deepEqual(kindOf("archive.zip"), { kind: "other" });

// base64 sizes.
assert.equal(b64bytes(Buffer.from("abcd").toString("base64")), 4);
assert.equal(b64bytes(Buffer.from("abcde").toString("base64")), 5);
assert.equal(b64bytes(Buffer.from("abcdef").toString("base64")), 6);

// The index keeps where an image is, never its data.
const data = Buffer.from("not really a png, a fixture").toString("base64");
const content = [{ type: "text", text: "voir [Image #3] et [Image #4]" }, { type: "image", source: { type: "base64", media_type: "image/png", data } }, { type: "image", source: { type: "base64", media_type: "image/jpeg", data } }];
const imgs = imagesOf(content, [3, 4]);
assert.deepEqual(imgs, [
  { n: 0, media: "image/png", bytes: 27, paste: 3 },
  { n: 1, media: "image/jpeg", bytes: 27, paste: 4 },
]);
assert.ok(!JSON.stringify(imgs).includes(data), "no base64 in the index");
assert.deepEqual(imagesOf("a string", null), []);
// And the CLI finds the n-th again, in a message or inside one tool_result.
assert.equal(imageAt({ message: { content } }, 1).media, "image/jpeg");
assert.equal(imageAt({ message: { content } }, 2), null);
const tr = { message: { content: [{ type: "tool_result", tool_use_id: "toolu_a", content: [{ type: "text", text: "x" }] }, { type: "tool_result", tool_use_id: "toolu_b", content: [content[1]] }] } };
assert.equal(imageAt(tr, 0, "toolu_b").data, data);
assert.equal(imageAt(tr, 0, "toolu_a"), null);

// A turn's attachments: pasted images first, then the @files.
const atts = attachmentsOf({ o: 1200, imgs }, [{ path: "docs/plan.md", abs: "/proj/docs/plan.md" }, "/proj/shot.webp"], "sess-test");
assert.deepEqual(atts.map((a) => [a.kind, a.name]), [["image", "Image #3"], ["image", "Image #4"], ["markdown", "plan.md"], ["image", "shot.webp"]]);
assert.deepEqual([atts[2].path, atts[2].abs, atts[3].abs], ["docs/plan.md", "/proj/docs/plan.md", "/proj/shot.webp"]);
assert.deepEqual(atts[1].ref, { o: 1200, n: 1 });
assert.equal(atts[0].key, "sess-test:1200::0");
assert.equal(attachmentsOf({ o: 5, imgs: [{ n: 0, media: "image/gif", bytes: 1, paste: null }] }, [], "s")[0].name, "image-1.gif");

// Cache names: stable, distinct, the page in the name.
assert.equal(hash8("a"), hash8("a"));
assert.notEqual(hash8("a"), hash8("b"));
assert.match(cacheName("th", "k", "webp"), /^th-[0-9a-f]{8}\.webp$/);
assert.match(cacheName("pdf", "k", "png", 3), /^pdf-[0-9a-f]{8}-p3\.png$/);
// The sweep's motif: what cacheName() makes, nothing else (a file someone put there, a background).
for (const n of [cacheName("th", "a", "webp"), cacheName("img", "a", "png"), cacheName("src", "a", "jpeg"), cacheName("pdf", "a", "png", 12)]) assert.ok(isCacheName(n), n);
for (const n of ["notes.md", "bg-928868ea-2-photo.png", "src-928868ea.png.bak", "th-xyz.webp", "../th-12345678.webp", ".th-12345678.webp"]) assert.ok(!isCacheName(n), n);

// Photos keep their shape in the 240 square (attachments.rs photo_size's own cases).
assert.deepEqual(photoSize(1920, 1080), [240, 135]);
assert.deepEqual(photoSize(300, 900), [80, 240]);
assert.deepEqual(photoSize(0, 0), [240, 240]);

// The sweep: what's in use stays, then the most recent, within the bounds.
const files = [
  { name: "a", size: 10, at: 1 }, { name: "b", size: 10, at: 2 }, { name: "c", size: 10, at: 3 },
  { name: "d", size: 10, at: 4 }, { name: "e", size: 10, at: 5 },
];
assert.deepEqual(sweepPlan(files, { maxBytes: 1e9, maxFiles: 3 }).sort(), ["a", "b"]);
assert.deepEqual(sweepPlan(files, { maxBytes: 1e9, maxFiles: 3, keep: new Set(["a"]) }).sort(), ["b", "c"]);
assert.deepEqual(sweepPlan(files, { maxBytes: 25, maxFiles: 99 }).sort(), ["a", "b", "c"]);
assert.deepEqual(sweepPlan(files, { maxBytes: 1e9, maxFiles: 99 }), []);

// #93: a piece's family (its card's tile and type), beside kindOf, which stays as it was for a .docx.
const fam = (name, o) => familyOf(name, kindOf(name).kind, o);
assert.deepEqual(fam("Compte rendu reunion juin.docx"), { tile: "doc", type: "doc" });
assert.equal(kindOf("Compte rendu reunion juin.docx").kind, "other", "kindOf unchanged: the viewer's route");
assert.deepEqual(fam("Rapport annuel V2.pdf"), { tile: "doc", type: "pdf" });
assert.deepEqual(fam("contacts.csv"), { tile: "sheet", type: "sheet" }, "a .csv is a spreadsheet's, though kindOf says text");
assert.deepEqual(fam("ventes.xlsx"), { tile: "sheet", type: "sheet" });
assert.deepEqual(fam("PLAN.md"), { tile: "text", type: "markdown" });
assert.deepEqual(fam("notes-de-reunion-2026-08-21.txt"), { tile: "text", type: "text" });
assert.deepEqual(fam("LICENSE"), { tile: "text", type: "text" });
assert.deepEqual(fam("attach.js"), { tile: "code", type: "code" });
assert.deepEqual(fam("photo-plage.jpg"), { tile: "image", type: "image" });
assert.deepEqual(fam("export-4f1c2a9e-77b0.zip"), { tile: "other", type: null, ext: "ZIP" }, "its extension, never « Fichier »");
assert.deepEqual(fam("sans-extension"), { tile: "other", type: "other" });
assert.deepEqual(fam("export-4f1c2a9e-77b0", { dir: true }), { tile: "other", type: "folder" });
assert.deepEqual(fam("export.csv", { dir: true }), { tile: "other", type: "folder" }, "a folder whatever its name");

// The tiles: an asset path, never worked out (render only reads one), one per family and appearance,
// all on the disk, and the same as brand/piece-tiles.py makes them (no drift between the two).
assert.equal(tileOf("sheet", true), "mods/kt-chat/tiles/sheet-dark.svg");
assert.equal(tileOf("sheet", false), "mods/kt-chat/tiles/sheet-light.svg");
const here = new URL(".", import.meta.url).pathname;
const made = mkdtempSync(`${tmpdir()}/kt-chat-tiles-`);
try {
  const gen = Bun.spawnSync(["python3", "-I", `${here}../../brand/piece-tiles.py`, made]);
  assert.equal(gen.exitCode, 0, String(gen.stderr));
  for (const f of FAMILIES) for (const dark of [true, false]) {
    const name = tileOf(f, dark).split("/").pop();
    assert.ok(existsSync(`${here}tiles/${name}`), `${name} pre-rendered`);
    assert.equal(readFileSync(`${here}tiles/${name}`, "utf8"), readFileSync(`${made}/${name}`, "utf8"), `${name}: as the generator makes it`);
  }
  assert.equal(readdirSync(made).length, FAMILIES.length * 2);
} finally {
  for (const n of readdirSync(made)) unlinkSync(`${made}/${n}`);
  rmdirSync(made);
}

// The grid: 188 so that the bubble (576) holds 3; two rows, the last place « +N », all once opened.
assert.equal(colsFor(576), 3);
assert.equal(gridW(3), 576);
assert.equal(colsFor(790), 4, "the field at the column's width");
assert.equal(colsFor(100), 1, "one at least");
assert.deepEqual(gridPlan(10, 4, false), { shown: 7, more: 3 }, "Kylian's 10 pieces in the field: 7 and « +3 »");
assert.deepEqual(gridPlan(10, 4, true), { shown: 10, more: 0 }, "opened: all of them");
assert.deepEqual(gridPlan(8, 4, false), { shown: 8, more: 0 }, "two full rows: no « +N »");
assert.deepEqual(gridPlan(10, 3, false), { shown: 5, more: 5 }, "a sent message (3 columns)");
assert.deepEqual(gridPlan(0, 4, false), { shown: 0, more: 0 });

console.log("att-model ok");
