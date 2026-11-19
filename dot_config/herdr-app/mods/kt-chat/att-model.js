// A Chat message's attachments (#80): what each one is, where its
// pixels or text come from, and the bounded cache that holds the thumbnails. Pure: the indexer
// (chat-index.ts), the view (main.js) and the CLI that makes the files (chat-att.ts) share it.
// Measured on Monocode (transcript/attachments.rs, theme.rs): chips 36 px, cover, radius 8; a file
// chip padding 4, radius 6, icon 16, its name 11 px at 140 at most; a sent photo whole in a 240
// square, radius 16; decoded images bounded to 32 and 64 MB.

const IMAGE = new Set(["png", "jpg", "jpeg", "gif", "webp", "bmp", "tif", "tiff", "svg", "heic", "heif", "avif"]);
// What GPUI's image loader draws itself (theme.rs, attachments.rs: Png Jpeg Gif Webp Svg Bmp Tiff).
const DRAWN = new Set(["png", "jpg", "jpeg", "gif", "webp", "bmp", "tif", "tiff", "svg"]);
const MARKDOWN = new Set(["md", "markdown", "mdx"]);
const TEXT = new Set(["txt", "log", "csv", "tsv", "ini", "conf", "env", "lock"]);
const CODE = new Set([
  "js", "mjs", "cjs", "jsx", "ts", "mts", "cts", "tsx", "json", "jsonl", "jsonc", "rs", "go", "py", "rb", "php", "sh",
  "bash", "zsh", "fish", "lua", "luau", "toml", "yaml", "yml", "html", "css", "scss", "sql", "swift", "kt", "java",
  "c", "h", "cpp", "hpp", "cs", "nix", "vue", "svelte", "astro", "xml", "graphql", "proto", "dockerfile", "make",
]);
const MEDIA_EXT = { "image/png": "png", "image/jpeg": "jpg", "image/jpg": "jpg", "image/gif": "gif", "image/webp": "webp", "image/svg+xml": "svg", "image/bmp": "bmp", "image/tiff": "tiff", "image/heic": "heic", "image/avif": "avif" };

export const extOf = (name) => (/\.([a-z0-9]+)$/i.exec(String(name ?? ""))?.[1] ?? "").toLowerCase();
export const baseOf = (path) => String(path ?? "").split("/").filter(Boolean).pop() ?? "";
export const extOfMedia = (media) => MEDIA_EXT[String(media ?? "").toLowerCase()] ?? "png";

/**
 * What an attachment is, from its media type or its name: { kind: image | pdf | markdown | code | text
 * | other, lang? (code: its extension, markdown.js langFor() reads it), drawn? (image: GPUI draws it
 * as is; heic, avif: converted first) }.
 */
export function kindOf(name, media) {
  const m = String(media ?? "").toLowerCase();
  const ext = m.startsWith("image/") ? extOfMedia(m) : extOf(name);
  if (m.startsWith("image/") || IMAGE.has(ext)) return { kind: "image", drawn: DRAWN.has(ext) };
  if (m === "application/pdf" || ext === "pdf") return { kind: "pdf" };
  if (MARKDOWN.has(ext)) return { kind: "markdown" };
  if (CODE.has(ext)) return { kind: "code", lang: ext };
  const base = baseOf(name);
  if (/^(Dockerfile|Makefile|Justfile)$/i.test(base)) return { kind: "code", lang: base.toLowerCase() };
  if (TEXT.has(ext) || /^(LICENSE|README|CHANGELOG|AUTHORS)$/i.test(base)) return { kind: "text" };
  return { kind: "other" };
}

/** Bytes a base64 string decodes to. */
export const b64bytes = (d) => (d ? Math.floor((d.length * 3) / 4) - (d.endsWith("==") ? 2 : d.endsWith("=") ? 1 : 0) : 0);

/**
 * A message content's images, for the index: never their data, only what finds it again. `n` counts
 * the image blocks of that content (the CLI takes the n-th), `paste` is Claude Code's « [Image #N] ».
 */
export function imagesOf(content, pasteIds) {
  if (!Array.isArray(content)) return [];
  const out = [];
  for (const p of content) {
    if (p?.type !== "image") continue;
    const s = p.source ?? {};
    const n = out.length;
    out.push({
      n,
      media: s.media_type ?? null,
      bytes: typeof s.data === "string" ? b64bytes(s.data) : 0,
      paste: Array.isArray(pasteIds) ? pasteIds[n] ?? null : null,
      ...(s.type === "url" && typeof s.url === "string" ? { url: s.url } : {}),
    });
  }
  return out;
}

/** The n-th image block's base64 and media type in a parsed line (`tool`: inside that tool_result). */
export function imageAt(o, n, tool) {
  let content = o?.message?.content;
  if (tool) content = Array.isArray(content) ? content.find((p) => p?.type === "tool_result" && p.tool_use_id === tool)?.content : null;
  const img = Array.isArray(content) ? content.filter((p) => p?.type === "image")[n] : null;
  const s = img?.source;
  return s?.type === "base64" && typeof s.data === "string" ? { data: s.data, media: s.media_type ?? "image/png" } : null;
}

/**
 * A turn's attachments, in order: the images pasted with the prompt (in the transcript itself), then
 * the files @-mentioned (on disk: `{ path (as written), abs }`, or a path alone). `session` and the
 * entry offset make an embedded image's key.
 */
export function attachmentsOf(user, files, session) {
  const out = [];
  for (const im of user?.imgs ?? []) {
    out.push({
      id: `${user.o}:${im.n}`,
      key: `${session ?? ""}:${user.o}::${im.n}`,
      kind: "image",
      drawn: kindOf(null, im.media).drawn,
      name: im.paste != null ? `Image #${im.paste}` : `image-${im.n + 1}.${extOfMedia(im.media)}`,
      media: im.media,
      bytes: im.bytes,
      ref: { o: user.o, n: im.n },
    });
  }
  for (const f of files ?? []) {
    const path = typeof f === "string" ? f : f?.path;
    if (!path) continue;
    const abs = typeof f === "string" ? (f.startsWith("/") ? f : null) : f.abs ?? null;
    out.push({ id: `f:${path}`, key: abs ?? path, path, abs, name: baseOf(path), ...kindOf(path) });
  }
  return out;
}

/** 32-bit FNV-1a, hex: the cache's file names (the CLI and the view compute the same one). */
export function hash8(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

/** A cache file's name: `th` a thumbnail, `img` a decoded image, `src` a link to the file on disk, `pdf` a page. */
export const cacheName = (role, key, ext, page) => `${role}-${hash8(key)}${page ? `-p${page}` : ""}.${ext}`;

/** Only what cacheName() makes: the sweep touches nothing else, even in its own folder. */
export const isCacheName = (name) => /^(th|img|src)-[0-9a-f]{8}\.[a-z0-9]{1,5}$|^pdf-[0-9a-f]{8}-p\d{1,5}\.png$/.test(String(name));

/** A sent photo's size, whole in its square (attachments.rs photo_size), unknown: the square. */
export const photoSize = (w, h, side = 240) => (w > 0 && h > 0 ? [Math.round((w * side) / Math.max(w, h)), Math.round((h * side) / Math.max(w, h))] : [side, side]);

/**
 * Which cache files go, so what stays holds in `maxBytes` and `maxFiles`: the ones in use (`keep`)
 * stay whatever their age, then the most recently used first. Returns the names to delete.
 */
export function sweepPlan(files, { maxBytes, maxFiles, keep = new Set() }) {
  let bytes = 0;
  let count = 0;
  for (const f of files) if (keep.has(f.name)) { bytes += f.size; count++; }
  const drop = [];
  for (const f of files.filter((x) => !keep.has(x.name)).sort((a, b) => b.at - a.at)) {
    if (count + 1 > maxFiles || bytes + f.size > maxBytes) drop.push(f.name);
    else { bytes += f.size; count++; }
  }
  return drop;
}
