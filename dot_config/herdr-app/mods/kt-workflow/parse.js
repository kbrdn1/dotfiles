// parse.js: what kt-workflow reads out of markdown and settings, pure (no imports, no module state),
// so Bun checks it (parse.check.mjs).

// The lines of `md` outside fenced code (``` or ~~~), each with its index.
function prose(lines) {
  const out = [];
  let fence = null;
  lines.forEach((l, i) => {
    const m = /^\s*(```|~~~)/.exec(l);
    if (m) fence = fence ? (m[1] === fence ? null : fence) : m[1];
    else if (!fence) out.push(i);
  });
  return new Set(out);
}

/** The body of the first "## " section whose title contains `needle` (WORKFLOW.md's titles start
 *  with an emoji), up to the next "## " outside code, trimmed; null when there is none. */
export function section(md, needle) {
  const lines = String(md ?? "").split("\n");
  const ok = prose(lines);
  const h2 = (i) => ok.has(i) && /^## /.test(lines[i]);
  const i = lines.findIndex((l, k) => h2(k) && l.includes(needle));
  if (i < 0) return null;
  let j = i + 1;
  while (j < lines.length && !h2(j)) j++;
  return lines.slice(i + 1, j).join("\n").trim();
}

/** A markdown table row's cells: pipes inside `code` or escaped (\|) stay in their cell. */
export function cells(line) {
  const s = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  const out = [];
  let cur = "", code = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === "\\" && s[i + 1] === "|") { cur += "|"; i++; continue; }
    if (c === "`") code = !code;
    if (c === "|" && !code) { out.push(cur.trim()); cur = ""; continue; }
    cur += c;
  }
  out.push(cur.trim());
  return out;
}

/** The first table in `md`: { head, rows } (the separator row dropped), or null. */
export function table(md) {
  const block = [];
  for (const l of String(md ?? "").split("\n")) {
    if (l.trim().startsWith("|")) block.push(l);
    else if (block.length) break;
  }
  if (block.length < 2) return null;
  const sep = (l) => /^\|?[\s:|-]+\|?$/.test(l.trim());
  const [head, ...rest] = block;
  return { head: cells(head), rows: rest.filter((l) => !sep(l)).map(cells) };
}

/** Markdown inline marks out: **bold**, *em*, _em_, `code`, ~~strike~~, [text](url), <br>. */
export function stripMd(s) {
  return String(s ?? "")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\*\*|~~|`/g, "")
    .replace(/(^|[\s(])[*_]([^*_]+)[*_](?=$|[\s).,;:])/g, "$1$2")
    .replace(/\s+/g, " ")
    .trim();
}

/** A loop's "## Définition": { goal, max, exit, check } from its "- **key** (note) : value" lines.
 *  check: "shell" (check_command), "agents" (a `check` run by agents), "par projet" (a check_command
 *  each project writes), or null. */
export function loopDef(md) {
  const body = section(md, "Définition"); // i18n: tech (the loop file's heading)
  if (body == null) return null;
  const d = {};
  for (const l of body.split("\n")) {
    const m = /^- \*\*([\w-]+)\*\*\s*(?:\([^)]*\))?\s*:\s*(.*)$/.exec(l.trim());
    if (m && !(m[1] in d)) d[m[1]] = m[2].trim();
  }
  const cc = d.check_command, ck = d.check;
  const check = cc != null ? (/par projet/i.test(cc) ? "par projet" : "shell") : ck != null ? (/agent/i.test(ck) ? "agents" : "shell") : null; // i18n: tech (a code, said by main.js)
  return { goal: stripMd(d.goal), max: d.max_iterations ? stripMd(d.max_iterations) : null, exit: stripMd(d.exit_when), check };
}

// What looks like a secret in a string shown on the page (hook commands, rules, the status line).
// The deny rule Read(**/*secret*) is not one: a bare word never is, only a value.
const SECRETS = [
  /\b(sk-(?:ant-)?)[A-Za-z0-9_-]{8,}/g, // Anthropic, OpenAI
  /\b(gh[pousr]_)[A-Za-z0-9]{10,}/g, // GitHub
  /\b(github_pat_)[A-Za-z0-9_]{10,}/g,
  /\b(xox[abprs]-)[A-Za-z0-9-]{8,}/g, // Slack
  /\b(AKIA)[0-9A-Z]{12,}/g, // AWS
  /(Bearer\s+)[^\s"'`]+/gi,
  /(Authorization\s*[:=]\s*)(?:"[^"]*"|'[^']*'|[^\s"']+(?:\s+[^\s"']+)?)/gi,
  // NAME_TOKEN=value, API_KEY="value", --password value
  /(\b[A-Za-z0-9_]*(?:TOKEN|SECRET|PASSWORD|PASSWD|API_?KEY|ACCESS_?KEY|PRIVATE_?KEY|CREDENTIALS?)[A-Za-z0-9_]*\s*[=:]\s*)(?:"[^"]*"|'[^']*'|[^\s"']+)/gi,
  /(--(?:token|password|api-key|secret)[=\s]+)[^\s"']+/gi,
];
const MASK = "••••••";

/** `s` with every value that looks like a secret masked (its prefix kept, so one can tell what it
 *  was), and long random-looking runs (base64, hex keys) masked whole. */
export function mask(s) {
  let out = String(s ?? "");
  for (const re of SECRETS) out = out.replace(re, (_m, pre) => `${pre}${MASK}`);
  // ponytail: "long and mixed letters/digits" is a heuristic; a nix store hash gets masked too.
  return out.replace(/[A-Za-z0-9+_=-]{32,}/g, (m) => (/[0-9]/.test(m) && /[A-Za-z]/.test(m) ? MASK : m));
}

/** The date WORKFLOW.md says it was last updated ("Dernière mise à jour : 2026-11-18"), or null. */
export const updatedOn = (md) => /Derni[eè]re mise à jour\s*:\s*\**([0-9]{4}-[0-9]{2}-[0-9]{2})/i.exec(String(md ?? ""))?.[1] ?? null;

/** Whether a command file is a cale for `skill` (CLAUDE.md, « Commandes »): it reads that SKILL.md
 *  and never says to invoke the skill (which loops). */
export function isCale(text, skill) {
  const t = String(text ?? "");
  return t.includes(skill) && !/invoque[rz]? la skill|invoke the `?[\w:.-]+`? skill/i.test(t);
}
