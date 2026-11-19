// bun ~/.config/herdr-app/mods/kt-viewer/items.check.mjs: what the viewer is given, normalized (items.js),
// and what it may run with it (a PDF's page, a link, « open »).
import assert from "node:assert/strict";
import { itemsOf, zoomable, textual, pageArgv, clampPage, pageImage, editorLang, capText, webLink, openArgv, MAX_BYTES } from "./items.js";

// Changes, History and Inbox open it with `images` (diffview.js): unchanged, each an image, every
// field kept, in order.
const before = [{ path: "data/kt-diff/a.png", label: "avant", name: "logo.png", w: 64, h: 32, size: 900 }, { path: "data/kt-diff/b.png", label: "après" }];
assert.deepEqual(itemsOf({ images: before, index: 1, compare: true }), before.map((x) => ({ ...x, kind: "image" })));
assert.deepEqual(itemsOf({}), []);
assert.deepEqual(itemsOf(null), []);

// The Chat opens it with `items`: kinds kept, an unknown one is an image, holes dropped.
const chat = itemsOf({ items: [
  { kind: "image", path: "data/kt-chat/att/img-1.png", name: "Image #1" },
  { kind: "pdf", src: "/w/devis.pdf", name: "devis.pdf" },
  { kind: "markdown", src: "/w/NOTES.md", name: "NOTES.md" },
  null,
  { kind: "code", src: "/w/main.ts", name: "main.ts", lang: "ts" },
  { kind: "weird", path: "x.png" },
] });
assert.deepEqual(chat.map((x) => x.kind), ["image", "pdf", "markdown", "code", "image"]);
assert.deepEqual(chat.map(zoomable), [true, true, false, false, true]);
assert.deepEqual(chat.map(textual), [false, false, true, true, false]);

// A PDF's page: the command is BUILT here from the PDF's path and the page (by argv), kt-chat's
// renderer under the app's bun, into its cache; an opener's `render` is ignored; no .pdf path, no
// command (the card « Page indisponible », nothing run).
const env = { home: "/Users/x", appHome: "/Users/x/.config/herdr-app" };
assert.deepEqual(pageArgv(chat[1], 3, env), ["/Users/x/.nix-profile/bin/bun", "/Users/x/.config/herdr-app/mods/kt-chat/chat-att.ts", "pdf", "/w/devis.pdf", "--page", "3", "--out", "/Users/x/.config/herdr-app/data/kt-chat/att"]);
const forged = itemsOf({ items: [{ kind: "pdf", src: "/w/devis.pdf", render: ["/bin/sh", "-c", "rm -rf ~"] }] })[0];
assert.deepEqual(pageArgv(forged, 1, env).slice(0, 3), ["/Users/x/.nix-profile/bin/bun", "/Users/x/.config/herdr-app/mods/kt-chat/chat-att.ts", "pdf"], "an opener's command is never run");
for (const src of ["devis.pdf", "/w/script.sh", "--out", "/w/a.pdf\0x", null]) assert.equal(pageArgv({ kind: "pdf", src }, 1, env), null, String(src));
assert.equal(pageArgv(chat[0], 1, env), null, "not a PDF");
assert.equal(pageArgv(chat[1], 1, {}), null, "no home: nothing to run");
assert.deepEqual([clampPage(0, 5), clampPage(9, 5), clampPage(4, 0)], [1, 5, 4]);
assert.equal(pageImage({ page: "pdf-abcd1234-p3.png", n: 3, pages: 5 }), "data/kt-chat/att/pdf-abcd1234-p3.png");
assert.equal(pageImage({ page: "../../secret.png" }), null);
assert.equal(pageImage({ error: "page" }), null);

// A document's links: http(s) only.
assert.equal(webLink("https://example.invalid/a?b#c"), "https://example.invalid/a?b#c");
assert.equal(webLink("http://example.invalid"), "http://example.invalid");
for (const url of ["file:///etc/passwd", "javascript:alert(1)", "mailto:a@b.invalid", "vscode://file/x", "x-apple.systempreferences:", "https://a b", "", null]) assert.equal(webLink(url), null, String(url));

// « Open »: a picture, a PDF, markdown or text in its app; code and an unknown kind only shown in the
// Finder (a .command, a .sh, an .app never run on a click); no absolute path, nothing.
assert.deepEqual(openArgv({ kind: "pdf", src: "/w/devis.pdf" }), ["/usr/bin/open", "/w/devis.pdf"]);
assert.deepEqual(openArgv({ kind: "markdown", src: "/w/NOTES.md" }), ["/usr/bin/open", "/w/NOTES.md"]);
assert.deepEqual(openArgv({ kind: "other", src: "/w/lance.command" }), ["/usr/bin/open", "-R", "/w/lance.command"]);
assert.deepEqual(openArgv({ kind: "other", src: "/Applications/Truc.app" }), ["/usr/bin/open", "-R", "/Applications/Truc.app"]);
assert.deepEqual(openArgv({ kind: "code", src: "/w/install.sh" }), ["/usr/bin/open", "-R", "/w/install.sh"]);
assert.equal(openArgv({ kind: "other", src: "relatif.txt" }), null);
assert.equal(openArgv({ kind: "image", path: "data/x.png" }), null);

// The readonly editor's grammar, and the size bound.
assert.deepEqual([editorLang(chat[3]), editorLang({ kind: "code", lang: "rs" }), editorLang({ kind: "text" })], ["js", "rs", "txt"]);
assert.deepEqual(capText("abc"), { text: "abc", cut: false });
assert.equal(capText("x".repeat(MAX_BYTES + 5)).text.length, MAX_BYTES);

console.log("kt-viewer items ok");
