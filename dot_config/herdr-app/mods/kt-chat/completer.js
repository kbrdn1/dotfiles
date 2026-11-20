// completer.js (kt-chat, #81 L4): the completion menu's state, pure, over complete.js and
// categories.js (kt-keys' copies): which rows show for the text and the cursor, the active row, what a
// pick writes into the field, and a command typed by hand once it is complete and known (fx3: it becomes
// the same marked word as a pick). Checked by completer.check.mjs. main.js keeps the state, calls these
// on `change` (never in render) and draws menu.js.
import { tokenAt, rank, commandPiece, toolPiece, toolOf } from "./complete.js";
import { ORDER } from "./categories.js";

const LIMIT = 50;
const base = (p) => p.slice(p.lastIndexOf("/") + 1);

// The servers as rows, each with its tools' count; the tools of one server as rows.
const servers = (tools) => {
  const n = new Map();
  for (const t of tools ?? []) { const s = toolOf(t.name)?.server; if (s) n.set(s, (n.get(s) ?? 0) + 1); }
  return [...n].map(([name, count]) => ({ name, count }));
};
const toolsOf = (tools, server) => (tools ?? []).map((t) => ({ ...t, ...toolOf(t.name) })).filter((t) => t.server === server);

/**
 * The menu for this text and cursor, or null (closed). catalog: { commands (complete.js' merge),
 * tools [{ name, description }], files [path] }. prev: the last menu (its active row is kept when it
 * still shows). dismissed: the token Esc closed ({ trigger, start }): it stays closed until another one.
 * -> { trigger, query, start, end, rows: [{ id, type, category, ... }], active }
 */
export function menuFor(text, cursor, catalog, { prev = null, dismissed = null } = {}) {
  const tok = tokenAt(text, cursor);
  if (!tok) return null;
  if (dismissed && dismissed.trigger === tok.trigger && dismissed.start === tok.start) return null;
  let rows;
  if (tok.trigger === "/") {
    rows = rank(catalog?.commands ?? [], tok.query, { limit: LIMIT, order: ORDER })
      .map((x) => ({ id: `cmd:${x.name}`, type: "command", category: x.category, item: x }));
  } else if (tok.trigger === "#") {
    const at = tok.query.indexOf("/");
    rows = at < 0
      ? rank(servers(catalog?.tools), tok.query, { limit: LIMIT }).map((s) => ({ id: `srv:${s.name}`, type: "server", category: "mcp", name: s.name, count: s.count }))
      : rank(toolsOf(catalog?.tools, tok.query.slice(0, at)), tok.query.slice(at + 1), { limit: LIMIT, key: (t) => t.tool })
        .map((t) => ({ id: `mcp:${t.name}`, type: "tool", category: "mcp", name: t.name, label: `${t.server} › ${t.tool}`, description: t.description }));
  } else {
    // The project's files come sorted (`git ls-files`, read once per catalog): ranked as they come, the
    // list never mapped nor sorted again at a keystroke (up to 20 000 paths).
    rows = rank(catalog?.files ?? [], tok.query, { limit: LIMIT, key: (p) => p, presorted: true })
      .map((p) => ({ id: `file:${p}`, type: "file", category: "file", path: p }));
  }
  const keep = prev?.rows?.[prev.active]?.id;
  const i = keep ? rows.findIndex((r) => r.id === keep) : -1;
  return { ...tok, rows, active: i >= 0 ? i : 0 };
}

/** The active row moved by `dir` (1 / -1), wrapping. */
export function move(menu, dir) {
  if (!menu?.rows.length) return menu;
  return { ...menu, active: (menu.active + dir + menu.rows.length) % menu.rows.length };
}

/**
 * What picking `row` writes: { start, end, text, piece, reopen }. The token's range [start, end) is
 * replaced by `text`; `piece` (attach.js' shape) is the part of it a chip shows, from `start`, when the
 * field takes tokens. A server only narrows the list (`#server/`, reopen). mention: attach.js'
 * mentionText(program, path) (#93), the one way a file's mention is written.
 */
export function pick(menu, row, { mention = (p) => `@${p}` } = {}) {
  const { start, end } = menu;
  if (row.type === "server") return { start, end, text: `#${row.name}/`, piece: null, reopen: true };
  if (row.type === "command") { const piece = commandPiece(row.item); return { start, end, text: `${piece.text} `, piece, reopen: false }; }
  if (row.type === "tool") { const piece = toolPiece(row.name); return { start, end, text: `${piece.text} `, piece, reopen: false }; }
  const text = mention(row.path);
  return { start, end, text: `${text} `, piece: { id: `file:${row.path}`, kind: "file", category: "file", label: base(row.path), text, source: "complete" }, reopen: false };
}

/** A command typed by hand at the head of the message, complete (a space after it) and known: its
 *  piece, or null (still being typed, or a word the catalog doesn't know: it stays text). */
export function typed(text, commands) {
  const m = /^\s*\/(\S+)\s/.exec(String(text ?? ""));
  const item = m && (commands ?? []).find((x) => x.name === m[1]);
  return item ? { start: m.index + m[0].indexOf("/"), piece: commandPiece(item) } : null;
}
