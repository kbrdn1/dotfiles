// kt-chat (dotfiles #79): a blocked agent's request in full, in the composer's « bloqué » card. The
// command whole, or the edit's diff, folded to its first rows and opened on a click. Pure: ask.check.mjs.
//
// The bridge's `pending` says what is asked (`tool`, `detail`: a command whole, an edit's path). The
// call itself, read from the transcript by its id (chat-index.ts --tool), gives what an edit changes.

export const FOLD = 4; // rows shown folded
export const OPEN = 400; // rows at most, opened (the render's budget)

const split = (s) => String(s ?? "").replace(/\n+$/, "").split("\n");
const rows = (s, sign) => (typeof s === "string" && s !== "" ? split(s).map((text) => ({ sign, text })) : []);
const EDITS = ["Edit", "MultiEdit", "Write", "NotebookEdit"];

/**
 * The request as rows { sign: " " | "-" | "+", text }: an edit's lines out and in, a new file's lines, a
 * command's lines; else the bridge's detail as it is. An edit whose call isn't read (yet) has no rows:
 * its path, the bridge's detail, is already above (askFile). `call`: { name, input } read from the
 * transcript, or null.
 */
export function askRows(pending, call) {
  const tool = call?.name ?? pending?.tool;
  const i = call?.input ?? null;
  if (i && tool === "Edit" && typeof i.old_string === "string") return [...rows(i.old_string, "-"), ...rows(i.new_string, "+")];
  if (i && tool === "MultiEdit" && Array.isArray(i.edits)) return i.edits.flatMap((e) => [...rows(e?.old_string, "-"), ...rows(e?.new_string, "+")]);
  if (i && tool === "Write" && typeof i.content === "string") return rows(i.content, "+");
  if (i && tool === "NotebookEdit" && typeof i.new_source === "string") return rows(i.new_source, "+");
  if (i && typeof i.command === "string") return rows(i.command, " ");
  if (EDITS.includes(tool)) return [];
  return rows(pending?.detail, " ");
}

/** An edit's request says which file above its diff (the bridge's detail is then the path). */
export function askFile(pending, call) {
  const tool = call?.name ?? pending?.tool;
  if (!EDITS.includes(tool)) return null;
  return call?.input?.file_path ?? call?.input?.notebook_path ?? pending?.detail ?? null;
}

/**
 * What the card shows of a request, worked out once, when the request or its call arrives (a text up
 * to 32 KB is split here, never in the render, which only reads it): `pending` (the request it is for),
 * `file`, `rows`.
 */
export const askOf = (pending, call) => ({ pending, file: askFile(pending, call), rows: askRows(pending, call) });

/** What the card shows: FOLD rows folded, up to OPEN opened; `more`, the rows left out; `foldable`, a toggle. */
export function shownRows(all, open) {
  const n = open ? OPEN : FOLD;
  return { rows: all.slice(0, n), more: Math.max(0, all.length - n), foldable: all.length > FOLD };
}

/** A tool call id the transcript can be searched for (the bridge's ids for a permission). */
export const callId = (pending) => (pending?.kind === "permission" && /^toolu_[A-Za-z0-9]+$/.test(String(pending.id)) ? pending.id : null);
