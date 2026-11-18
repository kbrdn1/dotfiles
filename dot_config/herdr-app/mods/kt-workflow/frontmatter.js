// A SKILL.md / command .md frontmatter reader: the YAML subset these files use,
// top-level keys only. Strings (plain, "double" with escapes, 'single'), block
// scalars (> and | with - / + chomping), inline [a, b] and block - lists (an item
// that is a map reads "k: v, k: v"), nested maps ({ key: "flattened text" }).
// Stops at the first closing ---: bodies quote frontmatter of their own.
// Pure (no imports): node runs it too (frontmatter.test.mjs).

// "a\n\nb" -> "a\nb" (one blank line is one newline), other line breaks -> spaces.
function fold(lines) {
  let out = "";
  for (const l of lines) {
    if (!l.trim()) { out += "\n"; continue; }
    if (out && !out.endsWith("\n")) out += " ";
    out += l.trim();
  }
  return out;
}

function unquote(s) {
  if (s.startsWith('"')) {
    const end = closing(s, '"');
    const inner = end > 0 ? s.slice(1, end) : s.slice(1);
    return inner.replace(/\\(u[0-9a-fA-F]{4}|.)/g, (_m, c) =>
      c.length === 5 ? String.fromCharCode(parseInt(c.slice(1), 16)) : ({ n: "\n", t: "\t", r: "", "0": "" })[c] ?? c);
  }
  if (s.startsWith("'")) {
    const end = closing(s, "'");
    return (end > 0 ? s.slice(1, end) : s.slice(1)).replace(/''/g, "'");
  }
  return s;
}

// Index of the quote closing s[0] (backslash escapes in "…", '' in '…'), or -1.
function closing(s, q) {
  for (let i = 1; i < s.length; i++) {
    if (q === '"' && s[i] === "\\") { i++; continue; }
    if (s[i] !== q) continue;
    if (q === "'" && s[i + 1] === "'") { i++; continue; }
    return i;
  }
  return -1;
}

function scalar(s) {
  s = s.trim();
  return s.startsWith('"') || s.startsWith("'") ? unquote(s) : s;
}

// "[a, 'b, c', d]" -> ["a", "b, c", "d"].
function inlineList(s) {
  const inner = s.trim().replace(/^\[/, "").replace(/\]\s*$/, "");
  const out = [];
  let cur = "", q = null;
  for (const ch of inner) {
    if (q) { if (ch === q) q = null; cur += ch; }
    else if (ch === '"' || ch === "'") { q = ch; cur += ch; }
    else if (ch === ",") { out.push(cur); cur = ""; }
    else cur += ch;
  }
  out.push(cur);
  return out.map(scalar).filter((x) => x !== "");
}

const indent = (l) => l.length - l.trimStart().length;

function value(v, block) {
  if (/^[|>]/.test(v)) {
    const body = block.slice();
    while (body.length && !body[body.length - 1].trim()) body.pop();
    const first = body.find((l) => l.trim());
    if (!first) return "";
    const n = indent(first);
    const lines = body.map((l) => (l.trim() ? l.slice(Math.min(n, indent(l))) : ""));
    return v[0] === ">" ? fold(lines) : lines.join("\n");
  }
  const rest = block.filter((l) => l.trim());
  if (v === "") {
    if (!rest.length) return "";
    const n = indent(rest[0]);
    if (/^-(\s|$)/.test(rest[0].trim())) {
      const items = [];
      for (const l of rest) {
        if (indent(l) === n && /^-(\s|$)/.test(l.trim())) items.push([l.trim().slice(1).trim()]);
        else items[items.length - 1]?.push(l.trim());
      }
      return items.map((parts) => parts.filter(Boolean).map(scalar).join(", "));
    }
    const map = {};
    let key = null;
    for (const l of rest) {
      const m = indent(l) === n && l.trim().match(/^([^:#\s][^:]*?)\s*:(?:\s+(.*))?$/);
      if (m) { key = m[1]; map[key] = m[2] ? scalar(m[2]) : ""; }
      else if (key) map[key] = `${map[key]} ${l.trim()}`.trim();
    }
    return map;
  }
  const text = [v, ...rest.map((l) => l.trim())].join(" ");
  if (text.startsWith("[")) return inlineList(text);
  return scalar(text);
}

/** { meta, body }: meta maps each top-level key to a string, a string list or a { key: string } map. */
export function frontmatter(text) {
  const src = String(text ?? "").replace(/^﻿/, "").replace(/\r\n?/g, "\n");
  const lines = src.split("\n");
  if (lines[0].trim() !== "---") return { meta: {}, body: src };
  const end = lines.findIndex((l, i) => i > 0 && (l.trimEnd() === "---" || l.trimEnd() === "..."));
  if (end < 0) return { meta: {}, body: src };
  const fm = lines.slice(1, end);
  const meta = {};
  for (let i = 0; i < fm.length; ) {
    const k = fm[i].match(/^([^\s#:-][^:]*?)\s*:(?:[ \t]+(.*))?$/);
    i++;
    if (!k) continue;
    const v = (k[2] ?? "").trim();
    const block = [];
    // The key's own lines: indented ones, blanks, and "- item" at column 0 under an empty value.
    while (i < fm.length && (!fm[i].trim() || /^\s/.test(fm[i]) || (v === "" && /^-(\s|$)/.test(fm[i])))) block.push(fm[i++]);
    meta[k[1]] = value(v, block);
  }
  return { meta, body: lines.slice(end + 1).join("\n") };
}
