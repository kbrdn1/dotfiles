// bun att-model.check.mjs: attachments' kinds, the index's image refs, the cache's names and bounds.
import assert from "node:assert/strict";
import { attachmentsOf, b64bytes, cacheName, hash8, imageAt, imagesOf, isCacheName, kindOf, photoSize, sweepPlan } from "./att-model.js";

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

console.log("att-model ok");
