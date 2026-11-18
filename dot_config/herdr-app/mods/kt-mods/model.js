// model.js: kt-mods' pure side, without herdr or gpui. It says what a mod is, where it is used, what can
// be toggled, and how to change a layout's root key with a one-line edit.
// Check: bun mods/kt-mods/model.check.mjs.

// A mod name Herdr can open safely (the lead's rule: [a-z0-9-]+). A dot in the name crashed the window:
// on 2026-11-18, `mod.open zz-ktm-probe.off` overflowed gpui's KeyContext::parse_expr in render_overlays.
// Any other folder is listed with an alert, and never opened, checked, cloned, deleted or offered.
export const SAFE = /^[a-z0-9-]+$/;
// An option's key (mod.json `options`).
export const OPT_KEY = /^[A-Za-z0-9_-]+$/;
// Written by Herdr in every mod folder (about 820 KB each): not the mod's own weight.
export const GENERATED = new Set(["gpui-kit.d.ts", "jsconfig.json"]);
// The shared modules, and the mod that holds the reference copy (copies must match it byte for byte).
export const SHARED = { "vim.js": "kt-keys", "motion.js": "kt-keys", "bus.js": "kt-keys", "dither.js": "kt-keys", "filters.js": "kt-keys", "viz.js": "kt-keys", "i18n.js": "kt-keys", "roll.js": "kt-keys", "skeleton.js": "kt-keys", "fuzzy.js": "kt-picker",
  "levels.js": "kt-keys", "reread.js": "kt-keys", "ring.js": "kt-threads", "companion-logo.js": "kt-threads", "band.js": "kt-gwm", "select.js": "kt-gwm",
  "threads-model.js": "kt-threads", "threads-io.js": "kt-threads", "thread-filter.js": "kt-threads", "pr-pick.js": "kt-threads",
  "viz.strings.js": "kt-keys", "steps.js": "kt-flow", "steps.strings.js": "kt-flow",
  "decide.js": "kbrdn-toast", "decide.strings.js": "kbrdn-toast",
  "diffview.js": "kt-diff", "diff.js": "kt-diff", "icons.js": "kt-diff",
  "markdown.js": "kt-keys", "markdown.strings.js": "kt-keys", "machines.js": "kt-keys", "machines.strings.js": "kt-keys" };
// A layout's root keys, and the shipped mod each one falls back to when unset.
export const ROOTS = { toast: "toast", terminal_menu: "menu" };

// installed.json: the shipped mods by name. The "layout:<name>" keys are layouts, not mods.
export const shippedOf = (installed) => new Set(Object.keys(installed ?? {}).filter((k) => !k.startsWith("layout:")));

export function groupOf(name, shipped) {
  if (shipped.has(name)) return "herdr";
  if (/^(kt|kbrdn)-/.test(name)) return "kbrdn";
  return "other";
}

// The leading `//` comment of a file, as one line.
export function headerOf(js) {
  const out = [];
  for (const line of String(js ?? "").split("\n")) {
    const m = /^\s*\/\/ ?(.*)$/.exec(line);
    if (m) out.push(m[1]);
    else if (out.length || line.trim()) break;
  }
  return out.join(" ");
}

// The first sentence: up to a ". ", "! " or "? ", or the end; at most `max` characters.
export function firstSentence(text, max = 240) {
  const s = String(text ?? "").replace(/\s+/g, " ").trim();
  const m = /^(.+?[.!?])(?=\s|$)/.exec(s);
  const out = m ? m[1] : s;
  return out.length > max ? `${out.slice(0, max - 1).trimEnd()}…` : out;
}

// mod.json's `description`, else the first sentence of main.js's header comment.
export function describe(json, js) {
  const d = typeof json?.description === "string" ? json.description.trim() : "";
  return d || firstSentence(headerOf(js));
}

// Every mod a layout tree names: blocks, floating blocks, headers (a stack's, the tab's pane header),
// and the root keys. An unset toast / terminal_menu is the shipped default, marked `implicit`.
// `hideable`: a block that layout.hide can take. That means a block with an id that is not a stack's
// child (a stack shows one child: use layout.select) and not floating ("no node" for layout.hide).
// `hidden`: the node's own flag. `under`: a node above it is hidden, so it doesn't show either.
export function layoutRefs(name, root) {
  const out = [];
  const add = (mod, role, n, under, extra = {}) => out.push({ layout: name, mod, role, id: n?.id ?? null, hidden: Boolean(n?.hidden), under, hideable: false, ...extra });
  const walk = (n, role, stackChild, under) => {
    if (Array.isArray(n)) return n.forEach((x) => walk(x, role, stackChild, under));
    if (!n || typeof n !== "object") return;
    const mod = n.content?.mod;
    if (typeof mod === "string") add(mod, role, n, under, { hideable: role === "block" && Boolean(n.id) && !stackChild });
    if (typeof n.header === "string" && n.header !== "tabs") add(n.header, "header", n, under);
    const below = under || Boolean(n.hidden);
    for (const [k, v] of Object.entries(n)) {
      if (k === "props" || !v || typeof v !== "object") continue;
      if (k === "children") walk(v, "block", n.type === "stack", below);
      else if (k === "floating") walk(v, "floating", false, below);
      else if (k === "header") walk(v, "header", false, below);
      else walk(v, role, false, below);
    }
  };
  walk(root, "block", false, false);
  for (const [key, def] of Object.entries(ROOTS)) {
    const v = root?.[key];
    const set = typeof v === "string" && v !== "";
    out.push({ layout: name, mod: set ? v : def, role: key, id: null, hidden: false, under: false, hideable: false, implicit: !set });
  }
  return out;
}

// The mods a script opens: openOverlay({ mod: "x" … }) (the first `mod:` of the call, if it is a
// literal), and run("mod.open", { name: "x" }).
export function openersIn(text) {
  const s = String(text ?? "");
  const out = new Set();
  for (let i = s.indexOf("openOverlay("); i >= 0; i = s.indexOf("openOverlay(", i + 1)) {
    const m = /\bmod:\s*([^,}\s]+)/.exec(s.slice(i, i + 400));
    const lit = m && /^["']([^"']+)["']$/.exec(m[1]);
    if (lit) out.add(lit[1]);
  }
  for (const m of s.matchAll(/run\(\s*["']mod\.open["']\s*,\s*\{\s*name:\s*["']([^"']+)["']/g)) out.add(m[1]);
  return out;
}

// keys.json's bindings that reach a mod: `mod.open:x` (or {command: "mod.open", args: {name}}), and
// `x.<command>` where x is a mod and not an app command namespace (`pane.go` is the app's).
export function keyRefs(keysJson, names, appCommands) {
  const out = [];
  const modCmd = (cmd) => {
    const c = String(cmd ?? "").split(":")[0];
    const d = c.indexOf(".");
    const head = d > 0 ? c.slice(0, d) : null;
    return head && names.has(head) && !appCommands.has(c) ? head : null;
  };
  for (const [section, map] of Object.entries(keysJson ?? {})) {
    for (const [keys, a] of Object.entries(map ?? {})) {
      const cmd = typeof a === "string" ? a : a?.command;
      let mod = null;
      let kind = "command";
      if (typeof a === "string" && a.startsWith("mod.open:")) [mod, kind] = [a.slice(9), "open"];
      else if (cmd === "mod.open" && typeof a?.args?.name === "string") [mod, kind] = [a.args.name, "open"];
      else mod = modCmd(cmd);
      if (mod) out.push({ mod, section, keys, kind, action: typeof a === "string" ? a : cmd });
    }
  }
  return out;
}

// The mods a root key can name: the shipped default, then its clones (mod.json's cloned_from).
export function rootChoices(key, mods, current) {
  const def = ROOTS[key];
  const out = [def, ...mods.filter((m) => m.json?.cloned_from?.name === def && SAFE.test(m.name)).map((m) => m.name)];
  if (current && !out.includes(current)) out.push(current);
  return out;
}

// The layout file's text with its root `key` set to `value`. Only that one line changes, or the key
// is added after the root's "id" line: the file is formatted by hand and tracked by chezmoi, so it is
// never re-serialized. Returns null when the edit can't be proven to change only that key, and then
// nothing is written.
export function setRootKey(text, key, value) {
  let before;
  try { before = JSON.parse(text); } catch { return null; }
  const line = new RegExp(`^([ \\t]*)"${key}"\\s*:\\s*"[^"\\n]*"`, "m");
  let next;
  if (line.test(text)) next = text.replace(line, (_all, ind) => `${ind}"${key}": ${JSON.stringify(value)}`);
  else {
    const m = /^([ \t]*)"id"\s*:\s*"[^"\n]*",[ \t]*\n/m.exec(text);
    if (!m) return null;
    const at = m.index + m[0].length;
    next = `${text.slice(0, at)}${m[1]}"${key}": ${JSON.stringify(value)},\n${text.slice(at)}`;
  }
  let after;
  try { after = JSON.parse(next); } catch { return null; }
  if (after?.[key] !== value) return null;
  const rest = (o) => { const c = { ...o }; delete c[key]; return JSON.stringify(c); };
  return rest(before) === rest(after) ? next : null;
}

// The order in which to remove a mod folder: its files deepest first, then its folders deepest first,
// then the folder itself. Every path must sit under `dir`. Returns null otherwise.
export function deletePlan(dir, files, dirs) {
  const pre = `${dir}/`;
  const inside = (p) => p.startsWith(pre) && !p.slice(pre.length).split("/").some((s) => s === ".." || s === "");
  if (!files.every(inside) || !dirs.every(inside)) return null;
  const depth = (p) => p.split("/").length;
  const deep = (a, b) => depth(b) - depth(a) || a.localeCompare(b);
  return { files: [...files].sort(deep), dirs: [...dirs].sort(deep).concat(dir) };
}
