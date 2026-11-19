// complete.js: the completions of kt-chat's field (#81), pure: where a trigger sits under the cursor
// (`/` at the head of the message, `@` and `#` at a word's start), the ranking (Monocode's score()), a
// skill's argument hint, its name as Claude Code lists it, the session's MCP tools from its transcript,
// and how each completion leaves (the lead's hybrid route, 2026-11-19):
// - a skill or a skill's command (`/me:goal …`, anything with `:` or accents) goes by `hc send`, as a
//   message: hc wraps it in <hc from=…>, so Claude Code doesn't run it as a command, the agent reads it
//   and invokes the skill itself (Skill tool), as it does for a /skill typed inside a message;
// - a Claude Code built-in (`/compact`, `/context`, `/clear`…: lowercase ASCII that `hc keys` can type,
//   unshifted US keys only) goes as raw keys, at rest, prompt empty, the screen read again before Enter;
//   /clear, /exit and /logout ask kt-confirm first; /model and /effort aren't offered (#81's own menus);
// - `@path` and an MCP tool's real name are words of the message (hc send).
// Written once in mods/kt-keys/complete.js and copied byte for byte (cmp) into kt-chat. No import: the
// caller hands categories.js' classify and ORDER (categories.js draws chips, so it needs gpui, and
// complete-index.ts runs this under bun). complete-index.ts feeds it. Checked by complete.check.mjs.

// ---------- triggers ----------

/**
 * The completion under the cursor: { trigger: "/" | "@" | "#", start, end, query } or null. Offsets are
 * UTF-16, as TextareaState's selected_range(). `/` only at the head of the message (Claude Code runs a
 * slash there only, and paths stay out); `#` bare or before a letter (`# Title`, `#93` stay text).
 */
export function tokenAt(text, cursor) {
  const s = String(text ?? "");
  if (!Number.isInteger(cursor) || cursor < 0 || cursor > s.length) return null;
  let start = cursor;
  while (start > 0 && !/\s/.test(s[start - 1])) start--;
  const frag = s.slice(start, cursor);
  const trigger = frag[0];
  const query = frag.slice(1);
  if (trigger === "/") {
    if (s.slice(0, start).trim() || /[/\\]/.test(query)) return null;
  } else if (trigger === "@") {
    if (query.includes("@")) return null;
  } else if (trigger === "#") {
    if (query && !/^[A-Za-z][\w.-]*(\/[\w.-]*)?$/.test(query)) return null;
  } else return null;
  let end = cursor;
  while (end < s.length && !/\s/.test(s[end])) end++;
  return { trigger, start, end, query };
}

// ---------- ranking ----------

/** Monocode's score() (composer.rs): equal, the leaf's prefix, a substring, a subsequence; null: no match. */
export function score(query, value) {
  const q = String(query ?? "").toLowerCase();
  if (!q) return 0;
  const v = String(value ?? "").toLowerCase();
  if (v === q) return 10000;
  const leaf = v.slice(Math.max(v.lastIndexOf("/"), v.lastIndexOf(":")) + 1); // no array per value: 20 000 paths
  if (leaf.startsWith(q)) return 5000 - v.length;
  const at = v.indexOf(q);
  if (at >= 0) return 3000 - at - v.length;
  let gaps = 0, from = 0;
  for (const ch of q) {
    const i = v.indexOf(ch, from);
    if (i < 0) return null;
    gaps += i - from;
    from = i + 1;
  }
  return 1000 - gaps - v.length;
}

/** The items matching `query`, best first, at most `limit`; ties (and an empty query): by category in
 *  `order` (categories.js' ORDER), then name. `presorted`: the items come in their tie order already
 *  (a project's files, as `git ls-files` sorts them, once per read): the score alone orders them, the
 *  best `limit` kept as they come, the whole list never sorted (20 000 paths at each keystroke). */
export function rank(items, query, { limit = 50, key = (x) => x.name, order = [], presorted = false } = {}) {
  if (presorted) {
    const top = []; // [score, item], best first; an equal score after the ones already in
    for (const x of items ?? []) {
      const sc = score(query, key(x));
      if (sc == null || (top.length >= limit && sc <= top[top.length - 1][0])) continue;
      let i = top.length;
      while (i > 0 && top[i - 1][0] < sc) i--;
      top.splice(i, 0, [sc, x]);
      if (top.length > limit) top.pop();
    }
    return top.map(([, x]) => x);
  }
  const cat = (x) => { const i = order.indexOf(x.category); return i < 0 ? order.length : i; };
  const scored = [];
  for (const x of items ?? []) {
    const sc = score(query, key(x));
    if (sc != null) scored.push([sc, x]);
  }
  scored.sort((a, b) => b[0] - a[0] || cat(a[1]) - cat(b[1]) || key(a[1]).localeCompare(key(b[1])));
  return scored.slice(0, limit).map(([, x]) => x);
}

// ---------- skills and commands, as Claude Code lists them ----------

const list = (v) => (Array.isArray(v) ? v.map(String) : typeof v === "string" ? v.trim().split(/\s+/).filter(Boolean) : []);

/**
 * A skill's or a command's name from its file (kt-skills' rules): a skill is its folder's path, a
 * command its file's, joined with ":", after its plugin's name; ~/.claude/skills/synced/<id>/x is
 * claude.ai's anthropic-skills:x. `rel`: the path under its root.
 */
export function nameOf({ kind, rel, prefix = null, source = "personal" }) {
  let parts = kind === "skill" ? String(rel).split("/").slice(0, -1) : String(rel).replace(/\.md$/i, "").split("/");
  if (source === "personal" && kind === "skill" && parts[0] === "synced" && parts.length > 2) parts = ["anthropic-skills", ...parts.slice(2)];
  return [prefix, ...parts].filter(Boolean).join(":");
}

/** Claude Code loads it as a /command: not under ~/.claude/skills/me/ (CLAUDE.md, « Commandes »: its cale
 *  under commands/me/ is the command), not `user-invocable: false`, not an internal brick (_x). */
export function loads({ kind, rel, source, meta = {} }) {
  if (source === "personal" && kind === "skill" && String(rel).startsWith("me/")) return false;
  if (String(meta["user-invocable"] ?? "").toLowerCase() === "false") return false;
  return !String(rel).split("/").some((p) => p.startsWith("_"));
}

/** What a command expects after its name: `argument-hint`, else its `arguments` as [a] [b], else
 *  [args] when its body reads $ARGUMENTS or $N, else null. */
export function argHint({ meta = {}, body = "" } = {}) {
  const h = meta["argument-hint"];
  // Unquoted `[issue] [branch]` is a YAML flow list to frontmatter.js (["issue] [branch"]): its brackets back.
  if (Array.isArray(h) && h.length) return `[${h.join("] [")}]`.slice(0, 80);
  if (typeof h === "string" && h.trim()) return h.trim().slice(0, 80);
  const named = list(meta.arguments);
  if (named.length) return named.map((a) => `[${a}]`).join(" ").slice(0, 80);
  return /\$ARGUMENTS|\$\d/.test(String(body)) ? "[args]" : null;
}

// ---------- Claude Code's own commands ----------

// Text-output commands only (the doc's list for remote sessions: no picker, no panel to drive): a
// dialog in the TUI would block the agent. /model and /effort write the default into
// ~/.claude/settings.json: #81's own menus, never here. /loop and /schedule are the session's skills.
export const BUILTINS = [
  { name: "compact", args: true },
  { name: "context" },
  { name: "usage" },
  { name: "recap" },
  { name: "reload-plugins" },
  { name: "clear", args: true, confirm: true },
  { name: "exit", confirm: true },
  { name: "logout", confirm: true },
];

// ---------- the session (its transcript) ----------

/** The MCP tools state after one deferred_tools_delta: removed names out, then added ones in, each with
 *  its description line ("name: description"). state: { names: [], lines: {} }. */
export function foldTools(state, delta) {
  const names = new Set(state?.names ?? []);
  const lines = { ...(state?.lines ?? {}) };
  for (const n of delta?.removedNames ?? []) { names.delete(n); delete lines[n]; }
  const added = delta?.addedNames ?? [];
  added.forEach((n, i) => {
    if (typeof n !== "string" || !n.startsWith("mcp__")) return;
    names.add(n);
    const l = delta?.addedLines?.[i];
    if (typeof l === "string" && l.startsWith(`${n}:`)) lines[n] = l.slice(n.length + 1).trim();
  });
  return { names: [...names], lines };
}

/** An MCP tool's real name, split: { server, tool } or null. */
export function toolOf(name) {
  const m = /^mcp__(.+?)__(.+)$/.exec(String(name ?? ""));
  return m ? { server: m[1], tool: m[2] } : null;
}

/** The servers, from their tools' names (mcp_instructions_delta lists only those that send some). */
export const serversOf = (names) => [...new Set((names ?? []).map((n) => toolOf(n)?.server).filter(Boolean))].sort();

/** skill_listing's names and their descriptions ("- name: description" lines). */
export function listingOf(a) {
  const desc = {};
  for (const line of String(a?.content ?? "").split("\n")) {
    const at = line.indexOf(": "); // a name has no ": " (me:loop:x has colons, never a space)
    if (line.startsWith("- ") && at > 2) desc[line.slice(2, at)] = line.slice(at + 2);
  }
  return (a?.names ?? []).filter((n) => typeof n === "string").map((name) => ({ name, description: desc[name] ?? "" }));
}

// ---------- the list ----------

/**
 * One list for `/`: the disk's commands first (they carry argument hints), then the session's skills
 * the disk doesn't have (plugins, claude.ai's), then the built-ins. `live`: in the session's listing.
 * disk: [{ name, description, hint, source }]; listing: [{ name, description }]; classify:
 * categories.js' (name, { builtin }) -> category.
 */
export function merge(disk, listing, classify) {
  const live = new Set((listing ?? []).map((x) => x.name));
  const byName = new Map();
  const out = [];
  for (const x of disk ?? []) {
    const had = byName.get(x.name);
    if (had) { // a skill and a command of the same name: one row, what either one says
      had.hint ??= x.hint;
      had.description ||= x.description;
      continue;
    }
    const row = { ...x, kind: "command", category: classify(x.name), live: live.has(x.name) };
    byName.set(x.name, row);
    out.push(row);
  }
  for (const x of listing ?? []) {
    if (byName.has(x.name)) continue;
    const row = { name: x.name, description: x.description, hint: null, source: "session", kind: "command", category: classify(x.name), live: true };
    byName.set(x.name, row);
    out.push(row);
  }
  for (const b of BUILTINS) {
    if (byName.has(b.name)) continue;
    out.push({ name: b.name, description: null, hint: b.args ? "[args]" : null, source: "builtin", kind: "builtin", category: classify(b.name, { builtin: true }), live: true, confirm: Boolean(b.confirm) });
  }
  return out;
}

/** `git ls-files` output: repo-relative paths, at most `cap`. */
export const filesOf = (stdout, cap = 20000) => String(stdout ?? "").split("\n").map((l) => l.trim()).filter(Boolean).slice(0, cap);

// ---------- pieces (attach.js' shape, #93) ----------

/** A command's piece: what shows is what goes. */
export const commandPiece = (item) => ({ id: `cmd:${item.name}`, kind: "command", category: item.category, label: `/${item.name}`, text: `/${item.name}`, source: "complete" });

/** An MCP tool's piece: « server › tool » shown, its real name sent (the transcript shows it back). */
export function toolPiece(name) {
  const t = toolOf(name);
  return t ? { id: `mcp:${name}`, kind: "mcp-tool", category: "mcp", label: `${t.server} › ${t.tool}`, text: name, source: "complete" } : null;
}

// ---------- the route ----------

// `hc keys` types unshifted US keys only (chat-dev, measured 2026-11-19): no capital, no `:`, `#`, `@`, `_`, é.
const TYPEABLE = /^[a-z0-9 /\-.',[\]\\`=;]*$/;
export const typeable = (text) => TYPEABLE.test(String(text ?? ""));

/** `hc keys` arguments for a text it can type (a space is "space"), else null. Enter is the caller's,
 *  after it read the screen again. */
export const keysOf = (text) => (typeable(text) ? [...String(text)].map((c) => (c === " " ? "space" : c)) : null);

/**
 * How the draft leaves: { via: "send" } (hc send: a message; `by: "agent"` when it opens with a skill
 * the agent invokes itself), { via: "keys", keys, confirm } (a built-in, typed), or { via: "none",
 * why: "untypable" } (a built-in hc keys can't type). builtins: BUILTINS (or the merged list's).
 * say: the agent's herdr-bridge 0.5.0 takes text into its input box, no envelope (kbrdn-herdr#8,
 * merged in 96478dd): then a /command runs natively, accents and ":" included, and the hybrid route
 * goes. The one point to change: the caller passes say once the bridge can, i.e. its
 * <address>.saytoken.json is fresh for this session (main.js reads that, not here).
 */
export function routeOf(draft, { builtins = BUILTINS, say = false } = {}) {
  const text = String(draft ?? "").trim();
  // A command's name, as tokenAt reads one: no `/` or `\` in it (`/tmp/build.log : pourquoi ?` is a
  // message, never typed as a command by the bridge).
  const m = /^\/([^\s/\\]+)(?=\s|$)/.exec(text);
  if (!m) return { via: "send" };
  if (say) return { via: "say", confirm: Boolean(builtins.find((x) => x.name === m[1])?.confirm) };
  const b = builtins.find((x) => x.name === m[1]);
  if (!b) return { via: "send", by: "agent" };
  const keys = keysOf(text);
  return keys ? { via: "keys", keys, confirm: Boolean(b.confirm) } : { via: "none", why: "untypable" };
}
