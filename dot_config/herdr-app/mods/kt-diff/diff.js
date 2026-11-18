// Pure diff logic for kbrdn Threads' diffs (Changes, History, the Inbox's Code
// tab), after DIFF-SPEC: parse a raw git patch (`git diff -M`, `gh pr diff`),
// word spans on the −/+ pairs of a block, the "N lignes inchangées" gaps and
// the 1500-line cap. No imports: `node mods/kt-diff/diff.test.mjs` checks it.
// Source of truth: mods/kt-diff/diff.js. kt-history and kt-inbox hold
// byte-identical copies (a mod can't import from another mod's folder).

export const MAX_LINES = 1500;
export const MAX_WORD = 1000;

// A path as git writes it: "quoted", with C escapes (octal bytes of UTF-8), when odd.
export function unquote(p) {
  if (!p.startsWith('"')) return p;
  const s = p.slice(1, p.lastIndexOf('"'));
  const C = { t: "%09", n: "%0A", r: "%0D", a: "%07", b: "%08", f: "%0C", v: "%0B", '"': "%22", "\\": "%5C" };
  let out = "";
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c !== "\\") { out += encodeURIComponent(c); continue; }
    const o = s.slice(i + 1, i + 4);
    if (/^[0-7]{3}$/.test(o)) { out += "%" + parseInt(o, 8).toString(16).padStart(2, "0"); i += 3; }
    else { out += C[s[i + 1]] ?? encodeURIComponent(s[i + 1] ?? ""); i += 1; }
  }
  try { return decodeURIComponent(out); } catch { return s; }
}

// `--- a/p` / `+++ b/p`: the path, null for /dev/null. Git adds a tab after a name with a space.
function side(rest) {
  const p = unquote(rest.replace(/\t$/, ""));
  return p === "/dev/null" ? null : p.replace(/^[ab]\//, "");
}

// `diff --git a/p b/p`: the b path (the fallback key: binaries, pure renames).
function gitPath(rest) {
  const q = rest.match(/^("(?:[^"\\]|\\.)*"|\S+) ("(?:[^"\\]|\\.)*")$/) ?? rest.match(/^("(?:[^"\\]|\\.)*") (.+)$/);
  if (q) return unquote(q[2]).replace(/^b\//, "");
  if ((rest.length - 1) % 2 === 0) {
    const half = (rest.length - 1) / 2;
    const a = rest.slice(0, half), b = rest.slice(half + 1);
    if (a.slice(2) === b.slice(2)) return b.slice(2);
  }
  const at = rest.lastIndexOf(" b/");
  return at < 0 ? rest : rest.slice(at + 3);
}

/**
 * Files of a raw patch: { path, old, status: A|M|D|R, binary, add, del, hunks, ids }
 * (ids: the `index` line's [old, new] blob hashes, abbreviated, "0000000" for none; null without one).
 * A hunk: { oldStart, oldLen, newStart, newLen, lines }; a line: { k: " "|"+"|"-"|"\\", text, o, n }
 * (o: old number on − and context, n: new number on + and context).
 */
export function parsePatch(text) {
  const files = [];
  let f = null, h = null, oldLeft = 0, newLeft = 0, o = 0, n = 0;
  const done = () => {
    if (!f) return;
    f.path = f.newPath ?? f.oldPath ?? f.gitPath;
    if (!f.newPath && f.oldPath && f.status !== "A") f.status = "D";
    if (!f.oldPath && f.newPath && f.status === "M" && f.hunks.every((x) => x.oldLen === 0)) f.status = "A";
    if (f.status === "M" && f.oldPath && f.newPath && f.oldPath !== f.newPath) { f.status = "R"; f.old = f.oldPath; }
    delete f.newPath; delete f.oldPath; delete f.gitPath;
    files.push(f);
  };
  for (const raw of String(text ?? "").split("\n")) {
    const line = raw.endsWith("\r") ? raw.slice(0, -1) : raw;
    if (oldLeft > 0 || newLeft > 0) {
      const k = line[0] ?? " ";
      const body = line.slice(1).replace(/\t/g, "    ");
      if (k === "\\") { h.lines.push({ k, text: line.slice(2), o: null, n: null }); continue; }
      if (k === "+") { h.lines.push({ k, text: body, o: null, n: n++ }); newLeft--; f.add++; continue; }
      if (k === "-") { h.lines.push({ k, text: body, o: o++, n: null }); oldLeft--; f.del++; continue; }
      if (k === " " || line === "") { h.lines.push({ k: " ", text: body, o: o++, n: n++ }); oldLeft--; newLeft--; continue; }
      oldLeft = newLeft = 0; // a short hunk: fall through to the headers
    }
    if (line.startsWith("diff --git ")) {
      done();
      f = { path: null, old: null, status: "M", binary: false, add: 0, del: 0, hunks: [], ids: null, gitPath: gitPath(line.slice(11)), newPath: null, oldPath: null };
      h = null;
      continue;
    }
    if (!f) continue;
    if (line.startsWith("\\") && h) { h.lines.push({ k: "\\", text: line.slice(2), o: null, n: null }); continue; }
    const m = line.match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
    if (m) {
      h = { oldStart: +m[1], oldLen: m[2] === undefined ? 1 : +m[2], newStart: +m[3], newLen: m[4] === undefined ? 1 : +m[4], lines: [] };
      f.hunks.push(h);
      oldLeft = h.oldLen; newLeft = h.newLen; o = h.oldStart; n = h.newStart;
      continue;
    }
    if (h) continue; // between hunks only "\ No newline" (above) or the next file
    if (line.startsWith("new file mode")) f.status = "A";
    else if (line.startsWith("deleted file mode")) f.status = "D";
    else if (line.startsWith("rename from ") || line.startsWith("copy from ")) { f.old = unquote(line.slice(line.indexOf(" from ") + 6)); f.status = "R"; }
    else if (line.startsWith("rename to ") || line.startsWith("copy to ")) f.newPath = unquote(line.slice(line.indexOf(" to ") + 4));
    else if (line.startsWith("Binary files ") || line === "GIT binary patch") f.binary = true;
    else if (line.startsWith("index ")) { const m = line.match(/^index ([0-9a-f]+)\.\.([0-9a-f]+)/); if (m) f.ids = [m[1], m[2]]; }
    else if (line.startsWith("--- ")) f.oldPath = side(line.slice(4));
    else if (line.startsWith("+++ ")) f.newPath = side(line.slice(4));
  }
  done();
  return files;
}

// Words, runs of space, single other characters.
let WORD;
try { WORD = new RegExp("[\\p{L}\\p{N}_]+|\\s+|[^\\p{L}\\p{N}_\\s]", "gu"); } catch { WORD = /\w+|\s+|[^\w\s]/g; }
const tokens = (s) => s.match(WORD) ?? [];

/** Changed character ranges [[start, end), ...] of `a` and `b`, null when nothing but space is shared. */
export function wordSpans(a, b) {
  if (a.length > MAX_WORD || b.length > MAX_WORD) return null;
  const ta = tokens(a), tb = tokens(b);
  const N = ta.length, M = tb.length;
  if (!N || !M || N * M > 250000) return null;
  // ponytail: plain O(N·M) LCS on tokens, capped above; Myers if long lines matter.
  const L = Array.from({ length: N + 1 }, () => new Int32Array(M + 1));
  for (let i = N - 1; i >= 0; i--) for (let j = M - 1; j >= 0; j--) L[i][j] = ta[i] === tb[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const ka = new Array(N).fill(false), kb = new Array(M).fill(false);
  let shared = 0;
  for (let i = 0, j = 0; i < N && j < M;) {
    if (ta[i] === tb[j]) { ka[i] = kb[j] = true; shared += ta[i].trim().length; i++; j++; }
    else if (L[i + 1][j] >= L[i][j + 1]) i++;
    else j++;
  }
  // Two lines that share little (a "#" and spaces) are a rewrite: fills only, no spans.
  if (shared < 0.3 * Math.min(a.trim().length, b.trim().length) || !shared) return null;
  const ranges = (t, keep) => {
    const out = [];
    let at = 0;
    t.forEach((tok, i) => {
      if (!keep[i]) {
        const last = out[out.length - 1];
        if (last && last[1] === at) last[1] = at + tok.length;
        else out.push([at, at + tok.length]);
      }
      at += tok.length;
    });
    return out;
  };
  return [ranges(ta, ka), ranges(tb, kb)];
}

/** Puts `spans` on the paired −/+ lines of each block of `file`'s hunks, once. */
export function words(file) {
  if (file.worded) return file;
  file.worded = true;
  for (const h of file.hunks) {
    const ls = h.lines;
    for (let i = 0; i < ls.length;) {
      if (ls[i].k !== "-") { i++; continue; }
      let j = i;
      while (j < ls.length && ls[j].k === "-") j++;
      let k = j;
      while (k < ls.length && ls[k].k === "+") k++;
      for (let p = 0; p < Math.min(j - i, k - j); p++) {
        const r = wordSpans(ls[i + p].text, ls[j + p].text);
        if (r) { ls[i + p].spans = r[0]; ls[j + p].spans = r[1]; }
      }
      i = k > j ? k : j;
    }
  }
  return file;
}

// Unmodified lines before a hunk, in old numbering (an insertion's start is the line it follows).
const before = (h) => (h.oldLen === 0 ? h.oldStart : h.oldStart - 1);
const end = (h) => (h.oldLen === 0 ? h.oldStart : h.oldStart + h.oldLen - 1);

/**
 * What to draw for `file`: rows ({ gap: n } before a hunk not at line 1 and between hunks,
 * { line } otherwise) and `hidden`, the hunks the cap left out: past `max` lines, the cut
 * falls before the hunk that would cross it; the first hunk always shows.
 */
export function plan(file, max = MAX_LINES) {
  const rows = [];
  let shown = 0, hidden = 0, prev = null;
  for (const h of file.hunks) {
    if (prev && shown + h.lines.length > max) { hidden = file.hunks.length - file.hunks.indexOf(h); break; }
    const gap = prev ? before(h) - end(prev) : before(h);
    if (gap > 0) rows.push({ gap });
    for (const line of h.lines) rows.push({ line });
    shown += h.lines.length;
    prev = h;
  }
  return { rows, hidden };
}

/** The mini bar's width in % (DIFF-SPEC): log-scaled, 8 to 100. */
export const barWidth = (add, del) => Math.max(8, Math.min(100, Math.log10(add + del + 1) * 40));

/**
 * A line's code to draw: Zed's runs ([text, color, style], ~/.claude/scripts/zed-tokens.ts) cut
 * at the word spans' bounds too, as [{ word, parts: [[text, color, style], …] }] (word: inside a
 * span, whose fill wraps its parts). The runs' tabs become 4 spaces and a final \r goes, as
 * parsePatch writes the line; runs that don't spell `text` (another version of the file) are
 * dropped: plain text then. Null: nothing to cut (no runs, no spans).
 */
export function pieces(text, runs, spans) {
  let rs = runs ? runs.map(([s, c, st]) => [String(s).replace(/\t/g, "    ").replace(/\r$/, ""), c ?? null, st | 0]) : null;
  if (rs && rs.map((r) => r[0]).join("") !== text) rs = null;
  if (!rs && !spans?.length) return null;
  rs ??= [[text, null, 0]];
  const cuts = new Set([0, text.length]), starts = [];
  let at = 0;
  for (const r of rs) { starts.push(at); at += r[0].length; cuts.add(at); }
  for (const [s, e] of spans ?? []) { cuts.add(s); cuts.add(e); }
  const xs = [...cuts].filter((x) => x >= 0 && x <= text.length).sort((a, b) => a - b);
  const out = [];
  let ri = 0, si = 0, last = null, lastSpan = -1;
  for (let i = 0; i + 1 < xs.length; i++) {
    const a = xs[i], b = xs[i + 1];
    while (ri + 1 < rs.length && starts[ri + 1] <= a) ri++;
    while (spans && si < spans.length && spans[si][1] <= a) si++;
    const word = Boolean(spans?.[si] && spans[si][0] <= a);
    const part = [text.slice(a, b), rs[ri][1], rs[ri][2]];
    if (last && last.word === word && (!word || lastSpan === si)) last.parts.push(part);
    else { last = { word, parts: [part] }; out.push(last); }
    lastSpan = word ? si : -1;
  }
  return out;
}

// JSON with comments and trailing commas (Zed's settings), strings untouched: zed-tokens.ts' own reading.
function jsonc(text) {
  let out = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { out += c; if (c === "\\") { out += text[++i] ?? ""; continue; } if (c === '"') q = false; }
    else if (c === '"') { q = true; out += c; }
    else if (text.startsWith("//", i)) { const j = text.indexOf("\n", i); i = j < 0 ? text.length : j - 1; }
    else if (text.startsWith("/*", i)) { const j = text.indexOf("*/", i); i = j < 0 ? text.length : j + 1; }
    else out += c;
  }
  return JSON.parse(out.replace(/,(\s*[}\]])/g, "$1"));
}

/** The Zed theme zed-tokens.ts colors with in `mode`, by the label it gives it: `theme` of Zed's settings.json
 *  (`settings`, its text), a name or { light, dark }; else One Dark Pro / One Light. */
export function zedLabel(settings, mode) {
  let st;
  try { st = jsonc(String(settings ?? "")).theme; } catch { st = undefined; }
  const name = typeof st === "string" ? st : st?.[mode];
  return typeof name === "string" && name ? name : mode === "light" ? "one-light" : "one-dark-pro";
}
