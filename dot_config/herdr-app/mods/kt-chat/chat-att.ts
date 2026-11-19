// The files the Chat draws for its attachments (#80). One JSON line
// on stdout, an `error` field when it can't. The cache is one folder, `--out`, swept to its bounds.
//
//   bun chat-att.ts embedded <jsonl> --at O [--tool ID] --n K --out DIR [--full]
//       the K-th image of the line at byte O (inside that tool_result with --tool), from the
//       transcript itself: a thumbnail, and with --full the decoded image (for the viewer only)
//   bun chat-att.ts file <path> --out DIR [--full]
//       a file on disk: its thumbnail (an image, a PDF's first page); with --full what the viewer
//       opens: a link to the file itself (never a copy), or a PNG when GPUI can't draw it (heic)
//   bun chat-att.ts pdf <path> --page N --out DIR
//       one page of a PDF as a PNG (1600 px on its long side), and the page count
//   bun chat-att.ts sweep --out DIR [--max-bytes B] [--max-files N] [--keep a,b]
//       deletes the least recently used files past the bounds, one by one
//
// Tools by their path: the mods' exec has no ~/.nix-profile in its PATH.
import { existsSync, lstatSync, mkdirSync, readdirSync, symlinkSync, unlinkSync, utimesSync, openSync, readSync, closeSync, statSync } from "node:fs";
import { basename } from "node:path";
import { cacheName, extOf, extOfMedia, imageAt, isCacheName, kindOf, sweepPlan } from "./att-model.js";

const HOME = process.env.HOME ?? "";
const MAGICK = process.env.KT_MAGICK ?? `${HOME}/.nix-profile/bin/magick`;
const PDFTOPPM = process.env.KT_PDFTOPPM ?? "/opt/homebrew/bin/pdftoppm";
const PDFINFO = process.env.KT_PDFINFO ?? "/opt/homebrew/bin/pdfinfo";
const THUMB = 480; // 2x a 240 photo
const PAGE = 1600;
const MAX_LINE = 64 << 20;
const BOUNDS = { maxBytes: 48 << 20, maxFiles: 400 };

const out = (o: unknown) => process.stdout.write(JSON.stringify(o));
const fail = (error: string, extra: Record<string, unknown> = {}) => { out({ error, ...extra }); process.exit(0); };

/** The line starting at byte `at`, read in chunks up to its newline (some carry megabytes of base64). */
function lineAt(path: string, at: number): string {
  const fd = openSync(path, "r");
  try {
    const parts: Buffer[] = [];
    let pos = at;
    let total = 0;
    for (;;) {
      const buf = Buffer.alloc(1 << 20);
      const n = readSync(fd, buf, 0, buf.length, pos);
      if (n <= 0) break;
      const nl = buf.subarray(0, n).indexOf(10);
      parts.push(buf.subarray(0, nl >= 0 ? nl : n));
      total += nl >= 0 ? nl : n;
      if (nl >= 0 || total > MAX_LINE) break;
      pos += n;
    }
    return Buffer.concat(parts).toString("utf8");
  } finally {
    closeSync(fd);
  }
}

const source = (input: string | Uint8Array, format?: string) => (typeof input === "string" ? `${input}[0]` : `${format}:-[0]`);
const stdin = (input: string | Uint8Array) => (typeof input === "string" ? "ignore" : input);

/** The original's size in pixels (its header only), from a path or bytes with their `format`. */
function sizeOf(input: string | Uint8Array, format?: string) {
  const p = Bun.spawnSync([MAGICK, "identify", "-ping", "-format", "%w %h", source(input, format)], { stdin: stdin(input) });
  const [w, h] = p.exitCode === 0 ? p.stdout.toString().trim().split(/\s+/).map(Number) : [];
  return { w: w || null, h: h || null };
}

/** A thumbnail of `input` written to `dest` (webp, 480 px on its long side at most); false when magick can't. */
const thumbnail = (input: string | Uint8Array, dest: string, format?: string) =>
  Bun.spawnSync([MAGICK, source(input, format), "-auto-orient", "-thumbnail", `${THUMB}x${THUMB}>`, "-strip", "-quality", "82", `webp:${dest}`], { stdin: stdin(input) }).exitCode === 0;

/** Marks a cache file used now (the sweep keeps the most recent). */
const touch = (path: string) => { try { const t = new Date(); utimesSync(path, t, t); } catch { /* a link to a file gone */ } };

/** att-model.js sweepPlan() applied: the least recently used files past the bounds, unlinked one by one. */
function sweep(dir: string, maxBytes: number, maxFiles: number, keep: Set<string>) {
  const files = readdirSync(dir).filter(isCacheName).map((name) => {
    const st = lstatSync(`${dir}/${name}`);
    return { name, size: st.isSymbolicLink() ? 0 : st.size, at: st.mtimeMs };
  });
  const gone = sweepPlan(files, { maxBytes, maxFiles, keep });
  for (const name of gone) unlinkSync(`${dir}/${name}`);
  return { gone, left: files.length - gone.length };
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const opt = (flag: string) => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : undefined; };
  const [cmd, target] = args;
  const dir = opt("--out");
  if (!cmd || !dir) fail("usage");
  mkdirSync(dir!, { recursive: true });

  if (cmd === "embedded") {
    const at = Number(opt("--at")), n = Number(opt("--n") ?? 0), tool = opt("--tool");
    if (!target || !Number.isFinite(at)) fail("usage");
    if (!existsSync(target!)) fail("missing", { path: target });
    let o: any;
    try { o = JSON.parse(lineAt(target!, at)); } catch { fail("unreadable", { at }); }
    const img = imageAt(o, n, tool);
    if (!img) fail("no-image", { at, n });
    const key = `${basename(target!, ".jsonl")}:${at}:${tool ?? ""}:${n}`;
    const bytes = Buffer.from(img!.data, "base64");
    const ext = extOfMedia(img!.media);
    const th = cacheName("th", key, "webp");
    if (!existsSync(`${dir}/${th}`) && !thumbnail(bytes, `${dir}/${th}`, ext)) fail("thumbnail");
    touch(`${dir}/${th}`);
    let full: string | null = null;
    if (args.includes("--full")) {
      const drawn = kindOf(null, img!.media).drawn;
      full = cacheName("img", key, drawn ? ext : "png");
      if (!existsSync(`${dir}/${full}`)) {
        if (drawn) await Bun.write(`${dir}/${full}`, bytes);
        else if (Bun.spawnSync([MAGICK, `${ext}:-[0]`, "-auto-orient", `png:${dir}/${full}`], { stdin: bytes }).exitCode !== 0) fail("convert");
      }
      touch(`${dir}/${full}`);
    }
    out({ thumb: th, full, bytes: bytes.length, media: img!.media, ...sizeOf(bytes, ext) });
  } else if (cmd === "file") {
    if (!target || !existsSync(target)) fail("missing", { path: target });
    const st = statSync(target!);
    const key = `${target}:${st.mtimeMs}:${st.size}`;
    const k = kindOf(target);
    if (k.kind !== "image" && k.kind !== "pdf") { out({ kind: k.kind, lang: k.lang ?? null, bytes: st.size }); process.exit(0); }
    const th = cacheName("th", key, "webp");
    // A PDF's thumbnail is its first page's, the page kept: the viewer opens on it.
    const first = k.kind === "pdf" ? `${dir}/${cacheName("pdf", key, "png", 1)}` : target!;
    if (k.kind === "pdf" && !existsSync(first) && Bun.spawnSync([PDFTOPPM, "-png", "-singlefile", "-f", "1", "-l", "1", "-scale-to", String(PAGE), target!, first.replace(/\.png$/, "")]).exitCode !== 0) fail("pdf");
    if (!existsSync(`${dir}/${th}`) && !thumbnail(first, `${dir}/${th}`)) fail("thumbnail");
    touch(`${dir}/${th}`);
    let full: string | null = null;
    if (args.includes("--full") && k.kind === "image") {
      // The file itself, through a link: never a copy. GPUI can't draw heic/avif: a PNG for those.
      full = cacheName(k.drawn ? "src" : "img", key, k.drawn ? extOf(target) : "png");
      if (!existsSync(`${dir}/${full}`)) {
        if (k.drawn) symlinkSync(target!, `${dir}/${full}`);
        else if (Bun.spawnSync([MAGICK, `${target}[0]`, "-auto-orient", `png:${dir}/${full}`]).exitCode !== 0) fail("convert");
      }
      if (!k.drawn) touch(`${dir}/${full}`);
    }
    out({ kind: k.kind, thumb: th, full, bytes: st.size, ...sizeOf(first) });
  } else if (cmd === "pdf") {
    const page = Math.max(1, Number(opt("--page") ?? 1));
    if (!target || !existsSync(target)) fail("missing", { path: target });
    const st = statSync(target!);
    const key = `${target}:${st.mtimeMs}:${st.size}`;
    const info = Bun.spawnSync([PDFINFO, target!]);
    const pages = Number(/^Pages:\s+(\d+)/m.exec(info.stdout.toString())?.[1] ?? 0);
    if (!pages) fail("pdf");
    if (page > pages) fail("page", { pages });
    const name = cacheName("pdf", key, "png", page);
    if (!existsSync(`${dir}/${name}`) && Bun.spawnSync([PDFTOPPM, "-png", "-singlefile", "-f", String(page), "-l", String(page), "-scale-to", String(PAGE), target!, `${dir}/${name}`.replace(/\.png$/, "")]).exitCode !== 0) fail("pdf");
    touch(`${dir}/${name}`);
    out({ page: name, n: page, pages, ...sizeOf(`${dir}/${name}`) });
  } else if (cmd === "sweep") {
    const keep = new Set((opt("--keep") ?? "").split(",").filter(Boolean));
    out(sweep(dir!, Number(opt("--max-bytes") ?? BOUNDS.maxBytes), Number(opt("--max-files") ?? BOUNDS.maxFiles), keep));
  } else fail("usage");
}
