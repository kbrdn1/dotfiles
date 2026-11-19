// A turn's assets beyond its prompt's attachments (#93): the images a tool got back (a Read of a
// capture: what the model saw, from the transcript itself), the files a tool read or wrote that
// preview (an image, a PDF, a markdown document), and the files the answer cites by their path. Pure:
// each comes out shaped as att-model.js' attachments, so the view draws and opens them as #80's
// (photo, docChip, openAtts, chat-att.ts). Whether a cited or written file is on the disk is the view's
// to ask (once per path); nothing here reads the disk. Checked by assets.check.mjs.

import { baseOf, extOfMedia, kindOf } from "./att-model.js";

// What a cited or a written path shows as: what previews well. A cited code file is everywhere in an
// answer (main.js:42), and its tool row says it already: left out.
const SHOWN = new Set(["image", "pdf", "markdown"]);
/** At most this many cited files per turn (an answer listing a folder stays readable). */
export const CITED_MAX = 8;

/** `p` with `.` and `..` segments resolved; null when it climbs above the root. */
export function normalize(p) {
  const out = [];
  for (const s of String(p).split("/")) {
    if (!s || s === ".") continue;
    if (s === "..") {
      if (!out.length) return null;
      out.pop();
    } else out.push(s);
  }
  return `/${out.join("/")}`;
}

/** An absolute path for `p` as written: `~/` from `home`, a relative one from `cwd`; null without them. */
export function resolve(p, cwd, home) {
  const s = String(p ?? "").trim();
  if (!s) return null;
  if (s.startsWith("/")) return normalize(s);
  if (s === "~" || s.startsWith("~/")) return home ? normalize(`${home}/${s.slice(2)}`) : null;
  return cwd ? normalize(`${cwd}/${s}`) : null;
}

// A token's end: closing punctuation, a line (main.md:12, :12:4) or an anchor (#part).
const tidy = (s) => s.replace(/[.,;:!?»)\]}'"]+$/, "").replace(/:\d+(?::\d+)?$/, "").replace(/#[^/]*$/, "");
// Not a path: a URL, a glob, a template, a flag.
const notPath = (s) => /:\/\//.test(s) || /[*{}$<>|]/.test(s) || s.startsWith("-");

/**
 * The paths an answer's text cites, in order, once each, as written: markdown link targets, code spans
 * and bare tokens (`/abs`, `~/x`, `./x`, `dir/x.ext`, `x.ext`) whose kind previews (image, pdf,
 * markdown). URLs, globs and flags are not paths.
 */
export function citedPaths(text) {
  const s = String(text ?? "");
  const found = []; // [where it starts in the text, the path]
  const take = (raw, at) => {
    const p = tidy(String(raw).trim());
    if (!p || notPath(p) || /\s/.test(p) || !/\.[A-Za-z0-9]{1,5}$/.test(p)) return;
    if (SHOWN.has(kindOf(p).kind)) found.push([at, p]);
  };
  for (const m of s.matchAll(/\]\(([^)\s]+)\)/g)) take(m[1], m.index);
  for (const m of s.matchAll(/`([^`\n]+)`/g)) take(m[1], m.index);
  // The rest, blanked out to the same length (the positions stay): fenced blocks, code spans, links.
  const blank = (m) => " ".repeat(m.length);
  const bare = s.replace(/```[\s\S]*?```/g, blank).replace(/`[^`\n]*`/g, blank).replace(/\]\([^)\s]*\)/g, blank);
  for (const m of bare.matchAll(/(?:^|[\s(«"'[])((?:~|\.{1,2})?\/[^\s`'"()<>[\]]+|[A-Za-z0-9_@.-]+(?:\/[^\s`'"()<>[\]]+)*)/g)) take(m[1], m.index);
  return [...new Set(found.sort((a, b) => a[0] - b[0]).map(([, p]) => p))];
}

/** A file on the disk as an attachment (att-model.js attachmentsOf's shape), `from`: read | write | cite. */
const fileAsset = (path, abs, from) => ({ id: `f:${abs}`, key: abs, path, abs, name: baseOf(path), from, ...kindOf(path) });

/**
 * A tool's assets: the images its result holds (`result.imgs`, chat-index.ts: where each is, never its
 * data; only when it ran fine), then the file it read or wrote when that previews (a Read of an image
 * is already its embedded image: not twice).
 */
export function toolAssets(block, { session, cwd, home } = {}) {
  const out = [];
  const res = block?.result;
  const input = block?.input ?? {};
  const imgs = res?.ok !== false ? res?.imgs ?? [] : [];
  const read = input.path ? resolve(input.path, cwd, home) : null;
  for (const im of imgs) {
    out.push({
      id: `t:${block.id}:${im.n}`,
      // The file it was read from, when one: a citation of it is this image, not a second asset.
      ...(read ? { of: read } : {}),
      key: `${session ?? ""}:${res.o}:${block.id}:${im.n}`,
      kind: "image",
      drawn: kindOf(null, im.media).drawn,
      name: input.path ? baseOf(input.path) : `image-${im.n + 1}.${extOfMedia(im.media)}`,
      media: im.media ?? null,
      bytes: im.bytes ?? 0,
      ref: { o: res.o, tool: block.id, n: im.n },
      from: block.kind === "read" ? "read" : "tool",
    });
  }
  const from = block?.kind === "read" ? "read" : block?.kind === "edit" ? "write" : null;
  const abs = from ? read : null;
  if (abs && SHOWN.has(kindOf(abs).kind) && res?.ok !== false && !(from === "read" && imgs.length)) out.push(fileAsset(input.path, abs, from));
  return out;
}

/**
 * A turn's assets, in order: its tools' (block by block), then the files its answer cites, at most
 * CITED_MAX; each once (an embedded image by its key, a file by its absolute path), and none the
 * prompt already shows (`seen`: its attachments' keys and absolute paths). { all, byTool, cited }:
 * byTool maps a tool block's id to its own.
 */
export function turnAssets(turn, { session, cwd, home, seen = [] } = {}) {
  const have = new Set(seen.filter(Boolean));
  const byTool = new Map();
  const tools = [];
  const cited = [];
  const fresh = (a) => {
    const k = a.ref ? a.key : a.abs;
    if (!k || have.has(k)) return false;
    have.add(k);
    if (a.of) have.add(a.of); // an image read from a file stands for that file
    return true;
  };
  for (const b of turn?.blocks ?? []) {
    if (b.role !== "tool") continue;
    const own = toolAssets(b, { session, cwd, home }).filter(fresh);
    if (own.length) byTool.set(b.id, own);
    tools.push(...own);
  }
  for (const b of turn?.blocks ?? []) {
    if (b.role !== "prose" || cited.length >= CITED_MAX) continue;
    for (const p of citedPaths(b.text)) {
      const abs = resolve(p, cwd, home);
      const a = abs && fileAsset(p, abs, "cite");
      if (a && fresh(a)) cited.push(a);
      if (cited.length >= CITED_MAX) break;
    }
  }
  return { all: [...tools, ...cited], byTool, cited };
}
