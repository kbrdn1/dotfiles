// bun assets.check.mjs: a turn's assets (#93), from made-up turns: what its tools got back, read or
// wrote, the paths its answer cites, each once, none the prompt already shows.
import assert from "node:assert/strict";
import { CITED_MAX, citedPaths, citesOf, normalize, resolve, toolAssets, turnAssets } from "./assets.js";

// Paths as written, made absolute.
assert.equal(normalize("/a/./b/../c.png"), "/a/c.png");
assert.equal(normalize("/a/../../c.png"), null, "above the root");
assert.equal(resolve("~/Desktop/x.png", "/p", "/h"), "/h/Desktop/x.png");
assert.equal(resolve("./out/cap.png", "/p/repo", "/h"), "/p/repo/out/cap.png");
assert.equal(resolve("docs/a.md", "/p/repo", "/h"), "/p/repo/docs/a.md");
assert.equal(resolve("docs/a.md", null, "/h"), null, "relative without a cwd");
assert.equal(resolve("~/x.png", "/p", null), null, "~ without a home");

// What an answer cites: link targets, code spans, bare tokens; only what previews; once each.
const prose = [
  "La capture est là : [capture](./out/cap.png), et le devis `~/Desktop/devis.pdf`.",
  "Voir aussi /tmp/x.jpg, puis NOTES.md:12 et docs/guide.md#install.",
  "Pas ceci : https://example.com/a.png, ni *.png, ni main.js, ni `src/main.rs`, ni -f.png.",
  "Encore ./out/cap.png (déjà cité).",
  "```\nherdr-app shot /tmp/dans-un-bloc.png\n```",
].join("\n");
assert.deepEqual(citedPaths(prose), ["./out/cap.png", "~/Desktop/devis.pdf", "/tmp/x.jpg", "NOTES.md", "docs/guide.md"]);
assert.deepEqual(citedPaths(""), []);
assert.deepEqual(citedPaths("capture.png et « rapport.pdf »."), ["capture.png", "rapport.pdf"], "a bare name, in quotes");

// A tool's assets.
const ctx = { session: "s1", cwd: "/p/repo", home: "/h" };
const readImg = { role: "tool", id: "tu1", kind: "read", input: { path: "/p/repo/out/cap.png" }, result: { o: 900, ok: true, imgs: [{ n: 0, media: "image/png", bytes: 1200 }] } };
assert.deepEqual(toolAssets(readImg, ctx), [{
  id: "t:tu1:0", of: "/p/repo/out/cap.png", key: "s1:900:tu1:0", kind: "image", drawn: true, name: "cap.png", media: "image/png", bytes: 1200, ref: { o: 900, tool: "tu1", n: 0 }, from: "read",
}], "a Read of an image: what the model saw, not the file again");
const readPdf = { role: "tool", id: "tu2", kind: "read", input: { path: "docs/devis.pdf" }, result: { o: 950, ok: true } };
assert.deepEqual(toolAssets(readPdf, ctx).map((a) => [a.id, a.abs, a.kind, a.from]), [["f:/p/repo/docs/devis.pdf", "/p/repo/docs/devis.pdf", "pdf", "read"]]);
const wrote = { role: "tool", id: "tu3", kind: "edit", input: { path: "/p/repo/RAPPORT.md" }, result: { o: 990, ok: true } };
assert.deepEqual(toolAssets(wrote, ctx).map((a) => [a.abs, a.kind, a.from]), [["/p/repo/RAPPORT.md", "markdown", "write"]]);
assert.deepEqual(toolAssets({ ...wrote, input: { path: "/p/repo/main.js" } }, ctx), [], "a code file: its tool row says it");
assert.deepEqual(toolAssets({ ...readImg, result: { ...readImg.result, ok: false } }, ctx), [], "a failed tool shows nothing");
const shot = { role: "tool", id: "tu4", kind: "execute", input: { command: "screenshot" }, result: { o: 999, ok: true, imgs: [{ n: 0, media: "image/jpeg", bytes: 10 }] } };
assert.deepEqual(toolAssets(shot, ctx).map((a) => [a.name, a.from, a.ref.tool]), [["image-1.jpg", "tool", "tu4"]], "an image a command gave back");
assert.deepEqual(toolAssets({ role: "tool", id: "tu5", kind: "read", input: { path: "/p/a.png" }, result: null }, ctx).map((a) => a.abs), ["/p/a.png"], "no result yet: the file read");

// The index's cites (citesOf): resolved, only what `exists` finds on the disk, once, at most CITED_MAX.
const on = new Set(["/p/repo/RAPPORT.md", "/p/repo/out/cap.png", "/h/Desktop/maquette.png", "/h/Desktop/devis.pdf"]);
const there = (p) => on.has(p);
assert.deepEqual(citesOf("Voir ./out/cap.png, puis out/cap.png et ~/Desktop/absent.png.", "/p/repo", "/h", there), [{ path: "./out/cap.png", abs: "/p/repo/out/cap.png" }],
  "the same file once; a file not on the disk left out");
assert.equal(citesOf(Array.from({ length: 12 }, (_, i) => `/tmp/f${i}.png`).join(" "), "/p", "/h", () => true).length, CITED_MAX);
assert.deepEqual(citesOf("rien ici", "/p", "/h", () => true), []);

// A turn: tools first, then what the answer cites (its blocks' `cites`); each once; none the prompt shows.
const said = (id, text) => ({ role: "prose", id, text, cites: citesOf(text, "/p/repo", "/h", there) });
const turn = { blocks: [
  readImg,
  said("a:0", "J'ai écrit RAPPORT.md et lu ./out/cap.png ; la maquette est dans `~/Desktop/maquette.png`."),
  wrote,
  said("a:1", "Le devis joint : /h/Desktop/devis.pdf."),
] };
const r = turnAssets(turn, { ...ctx, seen: ["/h/Desktop/devis.pdf"] });
assert.deepEqual(r.all.map((a) => a.id), ["t:tu1:0", "f:/p/repo/RAPPORT.md", "f:/h/Desktop/maquette.png"]);
assert.deepEqual([...r.byTool.keys()], ["tu1", "tu3"]);
assert.deepEqual(r.cited.map((a) => a.path), ["~/Desktop/maquette.png"], "RAPPORT.md written, cap.png read as an image, devis.pdf the prompt's");
assert.deepEqual(citedPaths("b.pdf avant `a.png`, puis [c](c.md)"), ["b.pdf", "a.png", "c.md"], "in the text's order");
// No text is searched there: a prose block without `cites` cites nothing (the regex pass is the
// indexer's, in bun; it was what made a render ~3x dearer).
assert.deepEqual(turnAssets({ blocks: [{ role: "prose", id: "a:0", text: "Voir /h/Desktop/maquette.png" }] }, ctx).all, [], "turnAssets never reads a text");
const many = { blocks: [{ role: "prose", id: "a:0", cites: Array.from({ length: 12 }, (_, i) => ({ path: `/tmp/f${i}.png`, abs: `/tmp/f${i}.png` })) }] };
assert.equal(turnAssets(many, ctx).cited.length, CITED_MAX);
assert.deepEqual(turnAssets(null, ctx).all, []);

// The whole way, on a made-up transcript: the indexer keeps where a tool's image is (never its data),
// the turns hang it on its tool, and the turn's assets find it, then the file the answer cites.
const { index } = await import("./chat-index.ts");
const { build } = await import("./chat-model.js");
const at = (s) => `2026-01-01T10:00:0${s}.000Z`;
const lines = [
  { type: "user", uuid: "u-1", sessionId: "s-a", cwd: "/w/proj", timestamp: at(0), message: { role: "user", content: "Regarde la capture" } },
  { type: "assistant", uuid: "a-1", sessionId: "s-a", cwd: "/w/proj", timestamp: at(1), message: { id: "m1", model: "model-x", role: "assistant", content: [{ type: "tool_use", id: "tu1", name: "Read", input: { file_path: "/w/proj/out/cap.png" } }] } },
  { type: "user", uuid: "u-2", sessionId: "s-a", cwd: "/w/proj", timestamp: at(2), message: { role: "user", content: [{ type: "tool_result", tool_use_id: "tu1", content: [{ type: "image", source: { type: "base64", media_type: "image/png", data: "TOOL-IMAGE-DATA" } }] }] }, toolUseResult: { type: "image", file: { filePath: "/w/proj/out/cap.png", base64: "TOOL-IMAGE-DATA" } } },
  { type: "assistant", uuid: "a-2", sessionId: "s-a", cwd: "/w/proj", timestamp: at(3), message: { id: "m2", model: "model-x", role: "assistant", content: [{ type: "text", text: "Vu. Le rapport est dans `docs/rapport.md`, la capture dans out/cap.png." }] } },
];
const bytes = new TextEncoder().encode(lines.map((l) => JSON.stringify(l)).join("\n") + "\n");
// The disk, made up: docs/rapport.md is there (out/cap.png is the image read: not twice).
const ix = index(bytes, { from: 0, size: bytes.length, path: "/x/s-a.jsonl", home: "/w", exists: (p) => p === "/w/proj/docs/rapport.md" || p === "/w/proj/out/cap.png" });
assert.deepEqual(ix.entries.find((e) => e.k === "assistant" && e.blocks[0].t === "text").blocks[0].cites, [
  { path: "docs/rapport.md", abs: "/w/proj/docs/rapport.md" }, { path: "out/cap.png", abs: "/w/proj/out/cap.png" },
], "the indexer keeps the text's cited files that are on the disk");
assert.ok(!index(bytes, { from: 0, size: bytes.length, path: "/x/s-a.jsonl", home: "/w", exists: () => false }).entries.some((e) => e.blocks?.some((b) => b.cites)), "none on the disk: no cites");
assert.ok(!JSON.stringify(ix).includes("TOOL-IMAGE-DATA"), "no base64 in the index");
const third = new TextEncoder().encode(lines.slice(0, 2).map((l) => JSON.stringify(l) + "\n").join("")).length;
assert.deepEqual(ix.entries.find((e) => e.k === "result").imgs, [{ n: 0, media: "image/png", bytes: 11, paste: null }]);
const [t1] = build(ix.entries).filter((t) => t.user);
const got = turnAssets(t1, { session: ix.session, cwd: "/w/proj", home: "/w" });
assert.deepEqual(got.all.map((a) => [a.id, a.key ?? null, a.ref ? JSON.stringify(a.ref) : a.abs]), [
  ["t:tu1:0", `s-a:${third}:tu1:0`, JSON.stringify({ o: third, tool: "tu1", n: 0 })],
  ["f:/w/proj/docs/rapport.md", "/w/proj/docs/rapport.md", "/w/proj/docs/rapport.md"],
], "chat-att.ts embedded --at <the result's line> --tool tu1 --n 0; out/cap.png is that image");
// The way main.js builds its turns (buildInc, turn by turn): the same assets.
const { buildInc } = await import("./chat-model.js");
const [t2] = buildInc(ix.entries).filter((t) => t.user);
assert.deepEqual(turnAssets(t2, { session: ix.session, cwd: "/w/proj", home: "/w" }).all, got.all, "buildInc's turns carry their tools' results too");

console.log("assets: ok");
