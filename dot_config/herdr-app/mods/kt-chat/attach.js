// The Chat's draft attachments (#93): what a drop, a paste or a picked file adds above the field, and
// what goes to the agent with the text. Pure: the view (main.js) runs the commands built here (by argv,
// never a shell) and keeps the list. Checked by attach.check.mjs.
//
// A piece is the one shape #81 (its completions) and #93 (these attachments) share: { id, kind, category,
// label, text, path?, on?, source }, `text` exactly what goes (kt-market's rule: what Kylian sees is what
// is sent). A file goes as mentionText(): `@path` to Claude Code, which reads it itself when the message is
// submitted (measured, 2.1.328 behind hc send: an `attachment` of type "file" after the prompt, an image
// with its pixels, seen without a tool; whitespace needed on both sides, which composer.js clean() keeps
// at the text's ends); no copy of it anywhere. A bare path attaches nothing (Codex: its model opens it
// with a tool). The Chat writes only to a Claude Code of this computer today (main.js: « notClaude »,
// « remote »). A path the text already @-mentions (typed, or completed by #81) goes once.
// A pasted image has no file: the view writes the clipboard's PNG under data/kt-chat/paste (PASTE_JXA),
// where only the PASTE_KEPT newest stay (pasteSweep). A file copied in the Finder pastes as itself.

import { baseOf, kindOf } from "./att-model.js";

/** At most this many files wait above the field. */
export const DRAFT_MAX = 10;
/** Where a pasted image is written, and how many stay (the newest; the disk is nearly full). */
export const PASTE_DIR = "data/kt-chat/paste";
export const PASTE_KEPT = 12;

/**
 * How a file is written in a message for `program` ("claude" | "codex" | anything else): Claude Code
 * reads `@path` itself at submit; the others get the absolute path (Codex attaches an image only when a
 * paste is that path alone: its model opens it). A path with a space is quoted, as text (Claude Code's
 * `@` doesn't take one). #81's `@` completion writes this too: one form for a mention.
 */
export function mentionText(program, path) {
  const p = String(path ?? "");
  if (/\s/.test(p)) return `"${p.replace(/"/g, '\\"')}"`;
  return program === "claude" ? `@${p}` : p;
}

/**
 * A draft attachment for an absolute path (null otherwise), as the one shape of a piece (#81 and #93):
 * { id, kind: "image" | "file", category: "file", label, text (exactly what goes), path, source }, and
 * `doc`, its att-model.js kind (the viewer and the thumbnail read it).
 */
export function draftItem(path, source, program = "claude") {
  const p = String(path ?? "");
  if (!p.startsWith("/") || /[\0\n\r]/.test(p)) return null;
  const doc = kindOf(p);
  return { id: `d:${p}`, kind: doc.kind === "image" ? "image" : "file", category: "file", label: baseOf(p), text: mentionText(program, p), path: p, source: source ?? "drop", doc };
}

/**
 * `list` with `paths` added at its end, once each, DRAFT_MAX at most: { list, added, refused }.
 * refused: the paths left out (not absolute, or past the limit); one already there is neither.
 */
export function add(list, paths, source) {
  const out = [...(list ?? [])];
  const added = [];
  const refused = [];
  for (const p of paths ?? []) {
    const it = draftItem(p, source);
    if (!it) { refused.push(p); continue; }
    if (out.some((a) => a.id === it.id)) continue;
    if (out.length >= DRAFT_MAX) { refused.push(p); continue; }
    out.push(it);
    added.push(it);
  }
  return { list: out, added, refused };
}

export const remove = (list, id) => (list ?? []).filter((a) => a.id !== id);

/** The paths a text @-mentions already: `@path` or `@"a path"`, as written. */
export function mentionsOf(text) {
  const out = new Set();
  for (const m of String(text ?? "").matchAll(/(?:^|\s)@(?:"([^"\n]+)"|(\S+))/g)) out.add(m[1] ?? m[2]);
  return out;
}

/**
 * The message as it goes: the text (trailing blanks off), then a blank line and the pieces' `text`, each
 * once, none the text holds already (its @-mentions, or that very text).
 */
export function promptOf(text, pieces) {
  const body = String(text ?? "").replace(/\s+$/, "");
  const said = mentionsOf(body);
  const refs = [];
  for (const a of pieces ?? []) {
    if (!a?.text || (a.path && said.has(a.path)) || body.includes(a.text) || refs.includes(a.text)) continue;
    refs.push(a.text);
  }
  if (!refs.length) return body;
  return body ? `${body}\n\n${refs.join(" ")}` : refs.join(" ");
}

// A paste the field found no text in (Textarea's « paste_other »), read with osascript -l JavaScript:
// files copied in the Finder first (they carry their icon as an image too), else the clipboard's
// image written as a PNG at argv[0] (PNG data as is, TIFF converted). It says "files" then one path
// per line, "image", "none" or "failed".
// i18n: tech
export const PASTE_JXA = 'function run(argv) { ObjC.import("AppKit"); const pb = $.NSPasteboard.generalPasteboard; const urls = pb.readObjectsForClassesOptions($([$.NSURL]), $({})); const files = []; if (urls && !urls.isNil()) for (let i = 0; i < urls.count; i++) { const u = urls.objectAtIndex(i); if (u.isFileURL) files.push(u.path.js); } if (files.length) return ["files", ...files].join("\\n"); let d = pb.dataForType($.NSPasteboardTypePNG); if (d.isNil()) { const t = pb.dataForType($.NSPasteboardTypeTIFF); if (t.isNil()) return "none"; d = $.NSBitmapImageRep.imageRepWithData(t).representationUsingTypeProperties($.NSBitmapImageFileTypePNG, $({})); } return d.writeToFileAtomically(argv[0], true) ? "image" : "failed"; }';
/** osascript's argv for a paste, an image written at `out` (an absolute path). */
export const pasteArgs = (out) => ["-l", "JavaScript", "-e", PASTE_JXA, out];
/** A pasted image's file name, and whether a name is one (the sweep touches nothing else). */
export const pasteName = (now) => `paste-${Math.floor(now)}.png`;
export const isPasteName = (name) => /^paste-\d{10,16}\.png$/.test(String(name));
/** Of a folder's names, the pasted images that go: past the PASTE_KEPT newest (by the time in their
 *  name), never one in `keep` (waiting above the field); nothing else in the folder. */
export function pasteSweep(names, keep = new Set()) {
  const at = (n) => Number(n.slice(6, -4));
  return (names ?? []).filter(isPasteName).sort((a, b) => at(b) - at(a)).filter((n, i) => i >= PASTE_KEPT && !keep.has(n));
}
/** What the paste script said: { files: [paths] } | { image: true } | { none: true } | { failed: true }. */
export function pasted(r) {
  const [head, ...rest] = String(r?.stdout ?? "").trim().split("\n");
  if (r?.code !== 0) return { failed: true };
  if (head === "files") return { files: rest.map((s) => s.trim()).filter((s) => s.startsWith("/")) };
  if (head === "image") return { image: true };
  if (head === "none") return { none: true };
  return { failed: true };
}

// The system's file chooser (osascript; argv[0] its prompt): POSIX paths, one per line.
// i18n: tech
const PICK = ["on run argv", "activate", "set fs to choose file with prompt (item 1 of argv) with multiple selections allowed",
  'set out to ""', "repeat with f in fs", "set out to out & POSIX path of f & linefeed", "end repeat", "return out", "end run"]; // i18n: tech
export const pickArgs = (prompt) => [...PICK.flatMap((l) => ["-e", l]), String(prompt ?? "")];
/** The chooser's answer: { paths } (none when cancelled: -128) or { error }. */
export function picked(r) {
  if (r?.code === 0) return { paths: String(r.stdout ?? "").split("\n").map((s) => s.trim()).filter((s) => s.startsWith("/")) };
  if (/-128/.test(String(r?.stderr ?? ""))) return { paths: [] };
  return { error: String(r?.stderr ?? r?.message ?? "failed").trim().slice(0, 200) }; // i18n: tech
}

// ---------- quoting a message (« Citer ») ----------

/** A markdown text as read on screen: no markers, links as their text, spaces collapsed. */
export function plainOf(md) {
  return String(md ?? "")
    .replace(/```[^\n]*\n?/g, "")
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^\s{0,3}(#{1,6}\s+|>\s?|[-*+]\s+|\d+[.)]\s+)/gm, "")
    .replace(/[*_~`]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// A selection taken from a message to quote it, told from a copy that only happens to be in its text
// (« dev », a branch, a path copied in a terminal): whole words of the message, at least QUOTE_WORDS
// words and QUOTE_CHARS characters as read. Anything less quotes the whole message.
export const QUOTE_WORDS = 3;
export const QUOTE_CHARS = 12;
// A letter (any script: its cases differ) or a digit: what a word is made of.
const wordChar = (ch) => Boolean(ch) && (ch.toLowerCase() !== ch.toUpperCase() || /[0-9_]/.test(ch));

/** Whether `clip` is a selection of `message` (see above): long enough, and on its words' edges. */
export function selectionOf(message, clip) {
  const c = plainOf(clip);
  if (c.length < QUOTE_CHARS || c.split(" ").length < QUOTE_WORDS) return false;
  const m = plainOf(message);
  for (let i = m.indexOf(c); i >= 0; i = m.indexOf(c, i + 1)) if (!wordChar(m[i - 1]) && !wordChar(m[i + c.length])) return true;
  return false;
}

/**
 * What « Citer » puts in the field: the part of `message` copied last (`clip`, the clipboard, when it is
 * a selection of this message: selectionOf), else the whole message; each line after `> `, then a blank
 * line.
 */
export function quoteOf(message, clip) {
  const c = String(clip ?? "").trim();
  const whole = String(message ?? "").trim();
  const piece = selectionOf(whole, c) ? c : whole;
  if (!piece) return "";
  return `${piece.split("\n").map((l) => (l.trim() ? `> ${l}` : ">")).join("\n")}\n\n`;
}
