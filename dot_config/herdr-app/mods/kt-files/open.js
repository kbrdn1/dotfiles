// Files opened on a file, at a line, by another mod (#82, the Chat's references): shared
// "kt.files.open" = { path, line?, to?, at }, kt-inbox's "kt.inbox.open" pattern. Pure: open.check.mjs.
//
//   const want = openRequest(req, Date.now(), root)  // { path (repo-relative), line, to } or null
//   wantStep(paths, want.path, listed)               // { select: path } | { wait: true } | { drop: "notListed" }
//   lineRange(text, line, to)                        // the editor's selection over those lines (UTF-16)
//
// Files stays read only: what is asked opens a file in the viewer and selects lines, nothing else.

const STALE = 30e3;

export function openRequest(req, now, root) {
  if (!req || typeof req !== "object" || !(now - (Number(req.at) || 0) <= STALE)) return null;
  let path = typeof req.path === "string" ? req.path : "";
  if (path.startsWith("/")) path = root && path.startsWith(`${root}/`) ? path.slice(root.length + 1) : "";
  path = path.replace(/^\.\//, "");
  if (!path || path.includes("\0") || path.split("/").some((s) => s === ".." || s === "")) return null;
  const int = (v) => (Number.isInteger(Number(v)) && Number(v) >= 1 ? Number(v) : null);
  const line = int(req.line);
  const to = line && int(req.to) && int(req.to) >= line ? int(req.to) : null;
  return { path, line, to };
}

/** The file asked for, against the files listed: open it, wait for the list's read, or drop it. */
export function wantStep(paths, path, listed) {
  if ((paths ?? []).includes(path)) return { select: path };
  return listed ? { drop: "notListed" } : { wait: true };
}

/**
 * The selection over lines `line`…`to` (1-based, `to` absent: that line alone) as UTF-16 offsets, as
 * EditorState.set_selected_range wants them (a JS string's indices are UTF-16 already); past the
 * end: the last line.
 */
export function lineRange(text, line, to) {
  const lines = String(text ?? "").split("\n");
  const a = Math.min(Math.max(1, line), lines.length);
  const b = Math.min(Math.max(a, to ?? a), lines.length);
  let start = 0;
  for (let i = 0; i < a - 1; i++) start += lines[i].length + 1;
  let end = start;
  for (let i = a - 1; i < b; i++) end += lines[i].length + (i < b - 1 ? 1 : 0);
  return { start, end };
}
