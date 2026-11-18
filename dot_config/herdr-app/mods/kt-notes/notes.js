// notes.js: the pure half of kt-notes (no herdr, no gpui-kit, no module state), checked by Bun
// (notes.check.mjs). gwm's note store is mirrored here rule for rule, so a note written by this page
// is the file `gwm note show` and the TUI's `N` read, and the other way round:
// - gwm-cli src/notes.rs: `<common dir>/gwm/notes/<branch>.md`, the branch's slashes as folders,
//   a branch name no filesystem can back carries no note (relative_path), presence = non-blank;
// - src/tui/state/note_editor.rs: the text as it goes to disk (text()), the list markers
//   (ListLine::parse) and the box toggle (toggle_checkbox / rewrite_marker);
// - src/doctor.rs check_orphan_notes: an orphan is a note whose BRANCH is gone.
// The project's own note is kbrdn's, not gwm's: `<common dir>/kbrdn/notes/project.md`, outside
// gwm/notes, where `gwm doctor` would call it the orphan note of a branch named "project".

export const NOTE_EXT = ".md";
export const GWM_DIR = "gwm/notes";
export const PROJECT_REL = "kbrdn/notes/project.md";

// src/naming.rs WINDOWS_RESERVED_STEMS, compared on the stem before the first "." (ASCII case).
const RESERVED = ["CON", "PRN", "AUX", "NUL",
  ..."123456789¹²³".split("").map((d) => `COM${d}`), ..."123456789¹²³".split("").map((d) => `LPT${d}`)];
const asciiLower = (s) => String(s).replace(/[A-Z]/g, (c) => c.toLowerCase());

// component_is_portable: one path component of a branch name, as a file on every platform.
function portable(c) {
  if (!c || c === "." || c === "..") return false;
  if (c.endsWith(".") || c.endsWith(" ")) return false;
  if ([...c].some((ch) => /\p{Cc}/u.test(ch) || '/\\:<>"|?*'.includes(ch))) return false;
  const stem = asciiLower(c.split(".")[0]);
  return !RESERVED.some((r) => asciiLower(r) === stem);
}

/** relative_path: "feat/#515-notes" -> "feat/#515-notes.md"; null when the name can't back a file. */
export function relativePath(branch) {
  const parts = String(branch ?? "").split("/");
  if (!parts.every(portable)) return null;
  // A folder ending in .md would meet a note file of the same name (branch `foo` vs `foo.md/bar`).
  if (parts.slice(0, -1).some((p) => asciiLower(p).endsWith(NOTE_EXT))) return null;
  return `${parts.join("/")}${NOTE_EXT}`;
}

/** branch_from_relative: the branch a note file (relative to gwm/notes) belongs to, else null. */
export function branchFromRelative(rel) {
  const parts = String(rel ?? "").split("/");
  if (parts.some((p) => !p || p === "." || p === "..")) return null;
  const last = parts.at(-1);
  if (!last.endsWith(NOTE_EXT) || last.length === NOTE_EXT.length) return null;
  parts[parts.length - 1] = last.slice(0, -NOTE_EXT.length);
  return parts.join("/");
}

/** A worktree note's absolute path, or null (detached, or a name no file can back). */
export const notePath = (common, branch) => {
  const rel = branch ? relativePath(branch) : null;
  return rel ? `${common}/${GWM_DIR}/${rel}` : null;
};
export const projectPath = (common) => `${common}/${PROJECT_REL}`;

/** NoteEditor::text(): what goes to disk, one trailing newline; blank is "" (no note). */
export function normalize(text) {
  const s = String(text ?? "");
  if (!s.trim()) return "";
  return `${s.replace(/\n+$/, "")}\n`;
}

/** gwm's presence predicate (notes::read): a note is there when it is non-blank. */
export const present = (text) => typeof text === "string" && text.trim() !== "";

/** ListLine::parse: { indent, kind: "bullet" | "open" | "done", width } in chars, or null (prose). */
export function parseItem(line) {
  const s = String(line ?? "");
  const body = s.trimStart();
  const indent = [...s.slice(0, s.length - body.length)].length;
  if (!body.startsWith("-")) return null;
  const rest = body.slice(1);
  if (rest.startsWith(" [")) {
    const [k, close, after] = [...rest.slice(2)];
    const kind = k === " " ? "open" : k === "x" || k === "X" ? "done" : null;
    if (!kind || close !== "]") return null;
    if (after === " ") return { indent, kind, width: indent + 6 };
    if (after === undefined) return { indent, kind, width: indent + 5 };
    return null;
  }
  if (rest === "") return { indent, kind: "bullet", width: indent + 1 };
  if (rest.startsWith(" ")) return { indent, kind: "bullet", width: indent + 2 };
  return null;
}

// A fence (kt-skills' markdown.js rule): ``` or ~~~ at any indent; a backtick fence's info has no backtick.
const FENCE = /^(\s*)(`{3,}|~{3,})(.*)$/;

/** Indices of the lines inside a fenced code block (fences included): never tasks. */
export function fenced(lines) {
  const out = new Set();
  let open = null;
  lines.forEach((line, i) => {
    if (open) {
      out.add(i);
      const m = line.trim();
      if (m[0] === open[0] && /^(`+|~+)$/.test(m) && m.length >= open.length) open = null;
      return;
    }
    const f = line.match(FENCE);
    if (f && !(f[2][0] === "`" && f[3].includes("`"))) {
      open = f[2];
      out.add(i);
    }
  });
  return out;
}

/** The note cut for the reader: markdown runs and task lines (their line index, to toggle them).
 *  [{ kind: "md", text } | { kind: "task", line, done, indent, text }] */
export function segments(text) {
  const lines = String(text ?? "").replace(/\r\n?/g, "\n").split("\n");
  const code = fenced(lines);
  const out = [];
  let prose = [];
  const flush = () => {
    const md = prose.join("\n").replace(/^\n+|\n+$/g, "");
    if (md.trim()) out.push({ kind: "md", text: md });
    prose = [];
  };
  lines.forEach((line, i) => {
    const it = code.has(i) ? null : parseItem(line);
    if (!it || it.kind === "bullet") return void prose.push(line);
    flush();
    out.push({ kind: "task", line: i, done: it.kind === "done", indent: it.indent, text: [...line].slice(it.width).join("") });
  });
  flush();
  return out;
}

/** toggle_checkbox on line i, when it is a box: "- [ ] " <-> "- [x] " (rewrite_marker). Else unchanged. */
export function toggleTask(text, i) {
  const lines = String(text ?? "").split("\n");
  const it = parseItem(lines[i]);
  if (!it || it.kind === "bullet") return String(text ?? "");
  const chars = [...lines[i]];
  lines[i] = chars.slice(0, it.indent).join("") + (it.kind === "open" ? "- [x] " : "- [ ] ") + chars.slice(it.width).join("");
  return lines.join("\n");
}

/** The first line worth showing: no heading hashes, list or box markers, quote. */
export function preview(text, max = 140) {
  const line = String(text ?? "").split("\n").map((l) => l.trim()).find(Boolean) ?? "";
  return line.replace(/^#+\s*/, "").replace(/^>\s*/, "").replace(/^-\s+\[[ xX]\]\s*/, "").replace(/^[-*+]\s+/, "").slice(0, max);
}

/** `find … -exec stat` lines ("<mtime> <path relative to the common dir>") -> note files. */
export function parseFind(stdout) {
  const out = [];
  for (const line of String(stdout ?? "").split("\n")) {
    const m = line.match(/^(\d+)\s(.+)$/);
    if (!m) continue;
    const rel = m[2].replace(/^\.\//, "");
    const mtime = Number(m[1]);
    if (rel === PROJECT_REL) out.push({ kind: "project", rel, mtime });
    else if (rel.startsWith(`${GWM_DIR}/`)) {
      const branch = branchFromRelative(rel.slice(GWM_DIR.length + 1));
      if (branch) out.push({ kind: "gwm", rel, branch, mtime });
    }
  }
  return out;
}

/** Worktrees with their note, and the notes left without a worktree.
 *  `notes`: [{ branch, text, mtime, rel }] (gwm's, read); `branches`: the local branches.
 *  An orphan in gwm doctor's sense is `gone` (the branch is deleted); the others only lost their
 *  worktree (gwm remove keeps the branch). Blank files are no note, as everywhere in gwm. */
export function classify(worktrees, notes, branches) {
  const by = new Map(notes.filter((n) => present(n.text)).map((n) => [n.branch, n]));
  const rows = worktrees.map((w) => ({ ...w, note: (w.branch && by.get(w.branch)) || null }));
  const held = new Set(worktrees.map((w) => w.branch).filter(Boolean));
  const alive = new Set(branches);
  const orphans = [...by.values()].filter((n) => !held.has(n.branch)).map((n) => ({ ...n, gone: !alive.has(n.branch) }))
    .sort((a, b) => b.mtime - a.mtime);
  return { rows, orphans };
}

/** notes::prepare's refusal: another live branch equal but for ASCII case shares the note file. */
export const caseRival = (branch, branches) => branches.find((o) => o !== branch && asciiLower(o) === asciiLower(branch)) ?? null;

/** The file changed under an open note (a watch, a reload): what to do.
 *  disk / base: the text on disk now / when last read or written (null: absent); buf: the buffer.
 *  "none": nothing changed; "adopt": the disk says what the buffer says; "reload": the buffer had
 *  nothing of its own, follow the disk; "conflict": both moved, never overwrite (Recharger / Garder). */
export function external(disk, base, buf) {
  if (disk === base) return "none";
  if (normalize(buf) === normalize(disk)) return "adopt";
  if (normalize(buf) === normalize(base)) return "reload";
  return "conflict";
}
