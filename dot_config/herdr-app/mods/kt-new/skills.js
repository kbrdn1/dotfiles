// skills.js: what Claude Code can run as `/name`, for the consigne's completion and the workflow
// presets. Pure (no herdr, no gpui-kit), so Bun checks it: `bun mods/kt-new/skills.check.mjs`.
// The scan and the names are kt-skills' (its LIST, roots() and item(), mods/kt-skills/main.js), cut
// to what Claude Code really loads: a command wins over the skill it shims (skills/me/x is only
// reachable as /me:x through commands/me/x.md since 2.1.327), a nested skill without its shim is
// out, and so are `user-invocable: false`, ~/.agents/skills not linked into ~/.claude/skills,
// and the internal bricks (_fragments, _templates).

import { frontmatter } from "./frontmatter.js";

// kt-skills' scan, the same line: each (glob, dir) listed by rg (links followed), then every file's
// mtime and real path (macOS stat: PATH's may be GNU's).
export const LIST = `while [ $# -gt 1 ]; do g=$1; d=$2; shift 2; [ -d "$d" ] && rg --files --follow --no-ignore -g "$g" "$d"; done | tr '\\n' '\\0' | xargs -0 /usr/bin/stat -L -f '%m%t%R%t%N'`;

const parse = (s) => { try { return JSON.parse(s ?? ""); } catch { return null; } };

/** Where to look: ~/.claude/skills first (a skill linked there from ~/.agents/skills keeps that name),
 *  the enabled plugins (settings.json, installed_plugins.json), each local project's .claude, then
 *  ~/.claude/commands. `projects`: the projects' git roots. */
export function roots({ home, settings, installed, projects = [] }) {
  const C = `${home}/.claude`;
  // ~/.agents/skills isn't one: Claude Code sees only what's linked into ~/.claude/skills (rg follows).
  const out = [{ dir: `${C}/skills`, glob: "SKILL.md", kind: "skill", source: "personal" }];
  const inst = parse(installed)?.plugins ?? {};
  for (const [key, on] of Object.entries(parse(settings)?.enabledPlugins ?? {})) {
    // ponytail: kt-skills falls back to the cache's newest version when installed_plugins.json has no
    // entry; every enabled plugin here has one. Add that `ls -t` if one shows up missing.
    const dir = on === true ? (inst[key]?.find((x) => x.scope === "user") ?? inst[key]?.[0])?.installPath : null;
    if (!dir) continue;
    const prefix = key.split("@")[0];
    out.push({ dir: `${dir}/skills`, glob: "SKILL.md", kind: "skill", source: "plugin", prefix });
    out.push({ dir: `${dir}/commands`, glob: "*.md", kind: "command", source: "plugin", prefix });
  }
  for (const p of new Set(projects.filter((p) => p && p !== home))) {
    out.push({ dir: `${p}/.claude/skills`, glob: "SKILL.md", kind: "skill", source: "project", project: p });
    out.push({ dir: `${p}/.claude/commands`, glob: "*.md", kind: "command", source: "project", project: p });
  }
  out.push({ dir: `${C}/commands`, glob: "*.md", kind: "command", source: "personal" });
  return out;
}

/** LIST's lines -> { path, real, mtime, root } (the deepest root holding each file). */
export function files(stdout, rs) {
  const out = [];
  for (const line of String(stdout ?? "").split("\n")) {
    const [mtime, real, path] = line.split("\t");
    if (!path) continue;
    const root = rs.filter((x) => path.startsWith(`${x.dir}/`)).sort((a, b) => b.dir.length - a.dir.length)[0];
    if (root) out.push({ path, real, mtime: Number(mtime), root });
  }
  return out;
}

/** One file as Claude Code names it (kt-skills' item()): skills/me/loop/x/SKILL.md is me:loop:x,
 *  commands/me/x.md is me:x, a plugin's are plugin:x, synced/<id>/x is anthropic-skills:x. `meta`:
 *  its frontmatter (frontmatter.js). */
export function entry(f, meta) {
  const r = f.root;
  const rel = f.path.slice(r.dir.length + 1);
  let parts = r.kind === "skill" ? rel.split("/").slice(0, -1) : rel.replace(/\.md$/i, "").split("/");
  const synced = r.source === "personal" && r.kind === "skill" && parts[0] === "synced" && parts.length > 2;
  if (synced) parts = ["anthropic-skills", ...parts.slice(2)];
  const text = (v) => (Array.isArray(v) ? v.join(", ") : typeof v === "string" ? v : "").trim();
  const off = text(meta?.["user-invocable"]).toLowerCase() === "false";
  return {
    name: [r.prefix, ...parts].filter(Boolean).join(":"),
    description: text(meta?.description),
    category: text(meta?.category),
    kind: r.kind,
    source: r.source,
    project: r.project ?? null,
    // Claude Code loads skills/<x>/SKILL.md one level down only (2.1.327): deeper ones run through
    // their command shim.
    loaded: r.kind === "command" || (!off && (synced || parts.length === 1)),
    internal: Boolean(parts.find((s) => s.startsWith("_"))),
  };
}

/** What `/` completes: one entry per name (the command, its description else the skill's), loaded,
 *  not internal, sorted by name. */
export function invocable(entries) {
  const by = new Map();
  const skill = new Map();
  for (const e of entries) {
    if (e.kind === "skill" && !skill.has(e.name)) skill.set(e.name, e);
    if (!e.loaded || e.internal) continue;
    const had = by.get(e.name);
    if (!had || (had.kind === "skill" && e.kind === "command")) by.set(e.name, e);
  }
  return [...by.values()]
    .map((e) => (e.description || !skill.get(e.name)?.description ? e : { ...e, description: skill.get(e.name).description }))
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
}

/** The whole scan (main.js' loadSkills): roots, one LIST run, each file's frontmatter, then invocable().
 *  `cache` (path -> { mtime, entry }) keeps what was read: a file is re-read only when its mtime moved.
 *  `exec` and `read` are herdr's exec and readTextFile; the check passes its own, on a fake home. */
export async function scan({ home, projects = [], exec, read, cache = new Map() }) {
  const get = (p) => Promise.resolve().then(() => read(p)).catch(() => null);
  const [settings, installed] = await Promise.all([get(`${home}/.claude/settings.json`), get(`${home}/.claude/plugins/installed_plugins.json`)]);
  const rs = roots({ home, settings, installed, projects });
  const r = await exec("sh", ["-c", LIST, "sh", ...rs.flatMap((x) => [x.glob, x.dir])], { timeout: 60e3 });
  const all = await Promise.all(files(r.stdout, rs).map(async (f) => {
    const c = cache.get(f.path);
    if (c?.mtime === f.mtime) return c.entry;
    const e = entry(f, frontmatter((await get(f.path)) ?? "").meta);
    cache.set(f.path, { mtime: f.mtime, entry: e });
    return e;
  }));
  return invocable(all);
}

/** How many completion rows the window leaves room for, START included. `win`: the window's height;
 *  `base`: the card's without the list (with the Workflow row when it shows: `flowShown`); `flow`: that
 *  row with its gap (0: none). Below `min` rows, the Workflow row goes while the list is open; below
 *  that again, `min` rows anyway (the list scrolls). Unknown sizes (a check, the first frame): `max`.
 *  -> { rows, flow } (flow: the Workflow row shows). `chrome`: the list's own gap, border, padding and
 *  foot; `row`: a row and its gap; `margin`: the air kept around the card. */
export function fit({ win, base, flowShown = true, flow = 48, row = 31, chrome = 49, margin = 32, min = 3, max = 6 }) {
  if (!(win > 0 && base > 0)) return { rows: max, flow: true };
  const whole = base + (flowShown ? 0 : flow); // the card with the Workflow row, shown or not: no flip-flop
  const room = (b) => Math.floor((win - margin - b - chrome) / row);
  if (room(whole) >= min) return { rows: Math.min(max, room(whole)), flow: true };
  return { rows: Math.max(min, Math.min(max, room(whole - flow))), flow: false };
}

/** The `/word` being typed at the end of the consigne (its caret is always there), at a line's start or
 *  after a space: the word without its "/", else null ("a/b" is not one). */
export function tokenOf(text) {
  const m = String(text ?? "").match(/(?:^|\s)\/([^\s/]*)$/);
  return m ? m[1] : null;
}

/** The entries `q` names, best first: the name starts with it, then one of its `:` parts, then the name
 *  holds it, then the description; `project`: only that project's own (other projects' are out). */
export function complete(list, q, project = null) {
  const s = String(q ?? "").toLowerCase();
  const rank = (e) => {
    const n = e.name.toLowerCase();
    if (n.startsWith(s)) return 0;
    if (n.split(":").some((p) => p.startsWith(s))) return 1;
    if (n.includes(s)) return 2;
    return e.description.toLowerCase().includes(s) ? 3 : -1;
  };
  return list
    .filter((e) => e.source !== "project" || e.project === project)
    .map((e) => [rank(e), e])
    .filter(([r]) => r >= 0)
    .sort((a, b) => a[0] - b[0] || (a[1].name < b[1].name ? -1 : 1))
    .map(([, e]) => e);
}

/** What the completion shows for the consigne `text` and the agent's command `cmd` ("claude", "codex",
 *  null for the shell): null when no `/word` is typed or esc closed it on this very text (`shut`); else
 *  { q, items, note }, note a code when there's nothing to pick ("other", "shell": not Claude, its
 *  skills don't apply; "loading", "empty"). */
export function suggest(list, text, cmd, { project = null, loading = false, shut = null } = {}) {
  const q = tokenOf(text);
  if (q == null || text === shut) return null;
  if (cmd !== "claude") return { q, items: [], note: cmd ? "other" : "shell" }; // i18n: tech
  const items = complete(list, q, project).slice(0, 50);
  return { q, items, note: items.length ? null : loading && !list.length ? "loading" : "empty" }; // i18n: tech
}

/** The consigne with the `/word` being typed replaced by `/name ` (its caret then after the space). */
export function insert(text, name) {
  return String(text ?? "").replace(/\/[^\s/]*$/, `/${name} `);
}

// The workflow presets, in this order (WORKFLOW.md's): the installed ones among them, then any other
// installed command declaring `category: workflow` (its frontmatter), by name.
export const ORDER = ["me:issue-worktree-pr", "me:issue-branch-pr", "me:spec-issue-worktree-pr", "me:spec-issue-branch-pr", "me:goal"]; // i18n: tech

export function presets(list) {
  const at = (e) => (ORDER.includes(e.name) ? ORDER.indexOf(e.name) : ORDER.length);
  return list.filter((e) => e.source !== "project" && (ORDER.includes(e.name) || e.category === "workflow")).sort((a, b) => at(a) - at(b));
}

/** The preset the consigne starts with (`/name`, then a space or its end), else null. */
export function leading(text, names) {
  const t = String(text ?? "").trimStart();
  return names.find((n) => t === `/${n}` || t.startsWith(`/${n} `) || t.startsWith(`/${n}\n`)) ?? null;
}

/** The consigne with its leading preset swapped for `name`'s (`/name ` first), or taken off (null: libre). */
export function withWorkflow(text, name, names) {
  const t = String(text ?? "");
  const was = leading(t, names);
  const rest = was ? t.trimStart().slice(was.length + 1).replace(/^ /, "") : t;
  return name ? `/${name} ${rest}` : rest;
}

/** Where a preset's thread starts. All of them open their own issue (gh issue create) and the
 *  worktree ones then make it with gwm: kt-new runs no gwm and starts them in the project's main
 *  checkout; its Checkout row says what the workflow will do. "worktree" | "current". */
// ponytail: by name; a `checkout:` frontmatter key if a workflow ever breaks the pattern.
export const checkoutOf = (name) => (/worktree/.test(name) ? "worktree" : "current");
