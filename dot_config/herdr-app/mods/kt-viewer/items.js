// kt-viewer's items (#80): what the viewer was given, normalized. Pure: items.check.mjs.
// Two ways in:
// - `images` (Changes, History, Inbox: [{ path, label, name?, w?, h?, size? }], a path under the app
//   home as image() wants it): read exactly as before, each an image;
// - `items` (the Chat, #80): [{ kind, name, ... }], one per kind:
//     image                  { path (under the app home), w?, h?, size? }
//     pdf                    { src (an absolute path to a .pdf), size? }: its pages are rendered by the
//                            command THIS module builds (pageArgv), never by one the opener passes
//     markdown, code, text   { src (absolute), lang? (code: its extension), size? }
//     other                  { src }: said plainly, with « show it in the Finder » (never opened).

const KINDS = new Set(["image", "pdf", "markdown", "code", "text", "other"]);

export function itemsOf(p) {
  if (Array.isArray(p?.items)) return p.items.filter(Boolean).map((x) => ({ ...x, kind: KINDS.has(x.kind) ? x.kind : "image" }));
  return (Array.isArray(p?.images) ? p.images : []).map((x) => ({ ...x, kind: "image" }));
}

/** Drawn as a picture (zoom, drag, fit): an image, a PDF's page. */
export const zoomable = (it) => it?.kind === "image" || it?.kind === "pdf";

/** Read as text (a file, at most MAX_BYTES of it). */
export const textual = (it) => it?.kind === "markdown" || it?.kind === "code" || it?.kind === "text";
export const MAX_BYTES = 400e3; // kt-files' bound

// Where a PDF's pages are rendered, and by what: kt-chat's chat-att.ts under the app's bun, into its
// bounded cache (data/kt-chat/att, swept there). Built here from the PDF's path and the page alone: an
// opener passes no command (a `render` in the props is ignored), so the viewer runs nothing else.
export const PAGES_DIR = "data/kt-chat/att";
const pdfPath = (src) => typeof src === "string" && src.startsWith("/") && !src.includes("\0") && /\.pdf$/i.test(src);

/** The command rendering page `n` of a PDF item, by its argument vector (never a shell); null: none. */
export function pageArgv(it, n, { home, appHome }) {
  if (it?.kind !== "pdf" || !pdfPath(it.src) || !home || !appHome || !(n >= 1)) return null;
  return [`${home}/.nix-profile/bin/bun`, `${appHome}/mods/kt-chat/chat-att.ts`, "pdf", it.src, "--page", String(Math.floor(n)), "--out", `${appHome}/${PAGES_DIR}`];
}

/** A page number kept inside the document (1 … pages; pages unknown: at least 1). */
export const clampPage = (n, pages) => Math.max(1, pages > 0 ? Math.min(n, pages) : n);

/** The page's image under the app home, from the renderer's answer ({ page, pages } or { error }). */
export const pageImage = (answer) => (typeof answer?.page === "string" && /^[\w.-]+\.png$/.test(answer.page) ? `${PAGES_DIR}/${answer.page}` : null);

// The readonly editor's language (kt-files' LANG: what its grammars call these extensions).
const LANG = { ts: "js", tsx: "js", mts: "js", cts: "js", jsx: "js", mjs: "js", cjs: "js", toml: "yaml", yml: "yaml", jsonc: "json", jsonl: "json", svelte: "html", vue: "html" };
export const editorLang = (it) => (it?.kind === "code" ? LANG[it.lang] ?? it.lang ?? "txt" : "txt");

/** A text cut to MAX_BYTES characters, and whether it was. */
export const capText = (s) => (s.length > MAX_BYTES ? { text: s.slice(0, MAX_BYTES), cut: true } : { text: s, cut: false });

/** A link a document's click may open: http(s) only (not file:, javascript:, mailto:, an app's scheme). */
export const webLink = (url) => (typeof url === "string" && /^https?:\/\/[^\s]+$/i.test(url) ? url : null);

/**
 * How « open » treats an item's file, by its kind: a picture, a PDF, markdown or plain text open in
 * their app (`open <src>`); code (a .sh, a .command…) and anything unknown are only shown in the
 * Finder (`open -R <src>`): a click never runs a file. null: no file to point at.
 */
export function openArgv(it) {
  if (typeof it?.src !== "string" || !it.src.startsWith("/")) return null;
  const run = it.kind === "pdf" || it.kind === "markdown" || it.kind === "text" || it.kind === "image";
  return run ? ["/usr/bin/open", it.src] : ["/usr/bin/open", "-R", it.src];
}
