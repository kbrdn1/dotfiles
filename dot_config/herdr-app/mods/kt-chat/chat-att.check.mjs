// bun chat-att.check.mjs: the CLI on a transcript and files made here (invented ids, generated
// images): thumbnails from the transcript and from disk, a link (never a copy) for the viewer, PDF
// pages, the sweep. Cleans up file by file.
import assert from "node:assert/strict";
import { existsSync, lstatSync, lutimesSync, mkdirSync, readdirSync, readlinkSync, rmdirSync, statSync, unlinkSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";

const HOME = process.env.HOME;
const MAGICK = `${HOME}/.nix-profile/bin/magick`;
const here = new URL(".", import.meta.url).pathname;
const work = `${tmpdir()}/kt-chat-att-check-${process.pid}`; // never inside the mod
const out = `${work}/cache`;
mkdirSync(out, { recursive: true });

const cli = (...args) => {
  const p = Bun.spawnSync([process.execPath, `${here}chat-att.ts`, ...args]);
  assert.equal(p.exitCode, 0, p.stderr.toString());
  return JSON.parse(p.stdout.toString());
};
const png = (w, h, color) => Bun.spawnSync([MAGICK, "-size", `${w}x${h}`, `xc:${color}`, "png:-"]).stdout;

try {
  // A transcript: a prompt with a pasted image, then a tool result with one.
  const shot = png(1200, 600, "red");
  const read = png(30, 90, "blue");
  const lines = [
    { type: "user", uuid: "u-test-1", sessionId: "sess-test", imagePasteIds: [1], message: { role: "user", content: [{ type: "text", text: "regarde [Image #1]" }, { type: "image", source: { type: "base64", media_type: "image/png", data: shot.toString("base64") } }] } },
    { type: "user", uuid: "u-test-2", sessionId: "sess-test", message: { role: "user", content: [{ type: "tool_result", tool_use_id: "toolu_test_1", content: [{ type: "image", source: { type: "base64", media_type: "image/png", data: read.toString("base64") } }] }] } },
  ].map((o) => JSON.stringify(o) + "\n");
  const jsonl = `${work}/sess-test.jsonl`;
  writeFileSync(jsonl, lines.join(""));
  const at2 = Buffer.byteLength(lines[0]);

  const a = cli("embedded", jsonl, "--at", "0", "--n", "0", "--out", out);
  assert.deepEqual([a.w, a.h, a.media, a.full], [1200, 600, "image/png", null]);
  assert.match(a.thumb, /^th-[0-9a-f]{8}\.webp$/);
  const tsize = Bun.spawnSync([MAGICK, "identify", "-format", "%w %h", `${out}/${a.thumb}`]).stdout.toString();
  assert.equal(tsize, "480 240", "a thumbnail, 480 on its long side");
  assert.equal(readdirSync(out).length, 1, "the thumbnail only: no decoded copy until the viewer asks");
  // Again: the same file, not a second one.
  assert.equal(cli("embedded", jsonl, "--at", "0", "--n", "0", "--out", out).thumb, a.thumb);
  assert.equal(readdirSync(out).length, 1);
  // --full: the decoded image, for the viewer.
  const af = cli("embedded", jsonl, "--at", "0", "--n", "0", "--out", out, "--full");
  assert.match(af.full, /^img-[0-9a-f]{8}\.png$/);
  assert.deepEqual(Buffer.from(await Bun.file(`${out}/${af.full}`).arrayBuffer()), Buffer.from(shot));
  // Inside a tool_result.
  const b = cli("embedded", jsonl, "--at", String(at2), "--tool", "toolu_test_1", "--n", "0", "--out", out);
  assert.deepEqual([b.w, b.h], [30, 90]);
  assert.notEqual(b.thumb, a.thumb);
  // Not there: said, not thrown.
  assert.equal(cli("embedded", jsonl, "--at", "0", "--n", "5", "--out", out).error, "no-image");
  assert.equal(cli("embedded", `${work}/nope.jsonl`, "--at", "0", "--n", "0", "--out", out).error, "missing");

  // A file on disk: a thumbnail, and for the viewer a link to it, never a copy.
  const disk = `${work}/capture.png`;
  writeFileSync(disk, png(800, 800, "green"));
  const f = cli("file", disk, "--out", out, "--full");
  assert.equal(f.kind, "image");
  assert.match(f.full, /^src-[0-9a-f]{8}\.png$/);
  assert.ok(lstatSync(`${out}/${f.full}`).isSymbolicLink());
  assert.equal(readlinkSync(`${out}/${f.full}`), disk);
  // A document: its kind and size, nothing made.
  const md = `${work}/notes.md`;
  writeFileSync(md, "# Titre\n\ntexte\n");
  const before = readdirSync(out).length;
  assert.deepEqual(cli("file", md, "--out", out), { kind: "markdown", lang: null, bytes: 15 });
  assert.equal(readdirSync(out).length, before);

  // A PDF of two pages: the first as its thumbnail, any page on demand, the count.
  const pdf = `${work}/doc.pdf`;
  assert.equal(Bun.spawnSync([MAGICK, "-size", "300x200", "xc:white", "-size", "300x200", "xc:gray", pdf]).exitCode, 0);
  const p = cli("file", pdf, "--out", out);
  assert.equal(p.kind, "pdf");
  assert.ok(p.w > p.h, "the page's shape");
  const p2 = cli("pdf", pdf, "--page", "2", "--out", out);
  assert.equal(p2.pages, 2);
  assert.match(p2.page, /^pdf-[0-9a-f]{8}-p2\.png$/);
  assert.ok(existsSync(`${out}/${p2.page}`));
  assert.ok(p2.w > 0 && p2.h > 0, "the page's size, for the viewer's fit");
  assert.equal(cli("pdf", pdf, "--page", "3", "--out", out).error, "page");

  // The sweep: the least recently used go first, what's in use stays. The link to the file on disk
  // is made the oldest: it goes (unlink on the LINK), the file it points to stays, untouched.
  const diskBefore = statSync(disk).mtimeMs;
  const link = f.full;
  writeFileSync(`${out}/notes-de-quelqu-un.md`, "pas au cache"); // not the cache's: never swept
  utimesSync(`${out}/notes-de-quelqu-un.md`, new Date(0), new Date(0));
  const names = readdirSync(out).filter((n) => !n.startsWith("notes-")).sort((a, b) => (a === link ? -1 : b === link ? 1 : a.localeCompare(b)));
  names.forEach((n, i) => { const t = new Date(Date.UTC(2026, 0, 1, 0, i)); (lstatSync(`${out}/${n}`).isSymbolicLink() ? lutimesSync : utimesSync)(`${out}/${n}`, t, t); });
  const s = cli("sweep", "--out", out, "--max-files", "3", "--keep", names[1]);
  assert.equal(s.left, 3);
  assert.ok(existsSync(`${out}/${names[1]}`), "kept although among the oldest");
  assert.ok(s.gone.includes(link), "the oldest, a link, swept");
  assert.ok(!existsSync(`${out}/${link}`) && !(() => { try { return lstatSync(`${out}/${link}`); } catch { return null; } })(), "the link itself is gone");
  assert.ok(existsSync(disk), "the file it pointed to stays");
  assert.equal(statSync(disk).mtimeMs, diskBefore, "and is not even touched");
  assert.ok(existsSync(`${out}/notes-de-quelqu-un.md`), "a file outside the motif stays, however old");
} finally {
  // File by file, then the folders: no rm -rf.
  for (const d of [out, work]) {
    if (!existsSync(d)) continue;
    for (const n of readdirSync(d)) { const p = `${d}/${n}`; if (!lstatSync(p).isDirectory()) unlinkSync(p); }
  }
  if (existsSync(out)) rmdirSync(out);
  if (existsSync(work)) rmdirSync(work);
}
console.log("chat-att ok");
