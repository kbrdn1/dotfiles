// kt-mcp's pure helpers (no herdr import): a server entry from any provider's config,
// with every secret masked, and `claude mcp list`'s states. Checked by
// `node mods/kt-mcp/mcp.test.mjs`.

export const MASK = "•••";
// Names that carry a secret (flags, NAME=value, header names).
const SECRET = /(key|token|secret|passw|pwd|auth|bearer|credential|cookie|session|private)/i;

/** Token-shaped runs in free text: `Bearer x`, vendor prefixes, long letter+digit runs. */
export function maskText(s) {
  return String(s ?? "")
    .replace(/\b(Bearer|Basic|Token)\s+\S+/gi, `$1 ${MASK}`)
    .replace(/\b(?:sk|pk|rk|ghp|gho|ghs|ghu|github_pat|glpat|xox[abprs]|AIza|tvly|hb|mxb)[-_][-_A-Za-z0-9]{6,}/g, MASK)
    // ponytail: heuristic, a 24+ char run with letters and digits is taken for a key (a UUID too).
    .replace(/[A-Za-z0-9_-]{24,}/g, (m) => (/\d/.test(m) && /[A-Za-z]/.test(m) ? MASK : m));
}

/** A URL without its userinfo, query values or fragment. */
export function maskUrl(u) {
  return maskText(String(u ?? "")
    .replace(/^([a-z][\w+.-]*:\/\/)[^/@\s]*@/i, "$1")
    .replace(/([?&][^=&#\s]+)=[^&#\s]*/g, `$1=${MASK}`)
    .replace(/#.*$/, ""));
}

/** Command arguments: the value after a secret flag, secret `NAME=value`, `Header: value`. */
export function maskArgs(args) {
  const out = [];
  let hide = false;
  for (const a of args ?? []) {
    const s = String(a);
    if (hide) { out.push(MASK); hide = false; continue; }
    const kv = s.match(/^(-{0,2}[\w.-]+)=(.*)$/s);
    if (kv && (SECRET.test(kv[1]) || /^[A-Z][A-Z0-9_]+$/.test(kv[1]))) { out.push(`${kv[1]}=${MASK}`); continue; }
    const hd = s.match(/^([\w-]+):\s*(.*)$/s);
    if (hd && SECRET.test(hd[1])) { out.push(`${hd[1]}: ${MASK}`); continue; }
    if (/^--?[\w-]+$/.test(s) && SECRET.test(s)) hide = true;
    out.push(/^[a-z][\w+.-]*:\/\//i.test(s) ? maskUrl(s) : maskText(s));
  }
  return out;
}

/** stdio, http or sse, from `type` (Claude, Cursor, OpenCode's local/remote) or command/url. */
export function transport(v) {
  const t = String(v?.type ?? "").toLowerCase();
  if (t === "sse") return "sse";
  if (t === "stdio" || t === "local") return "stdio";
  if (t === "http" || t === "streamable-http" || t === "remote") return "http";
  return v?.command ? "stdio" : v?.url ? "http" : "?";
}

const names = (x) => (Array.isArray(x) ? x.map(String) : Object.keys(x ?? {}));

/** One server row. Keeps names of env/headers, never their values. `listName`: how
 *  `claude mcp list` names it (`plugin:<plugin>:<name>` for a plugin's). */
export function server(provider, scope, name, v, file, listName = name) {
  v = v ?? {};
  // OpenCode: command is [program, ...args].
  const cmd = Array.isArray(v.command) ? v.command : v.command ? [v.command, ...(v.args ?? [])] : null;
  return {
    key: `${provider}:${scope}:${name}`, provider, scope, name, file, listName,
    transport: transport(v),
    target: cmd?.length ? [maskText(cmd[0]), ...maskArgs(cmd.slice(1))].join(" ") : v.url ? maskUrl(v.url) : "",
    env: [...new Set([...names(v.env), ...names(v.environment)])],
    headers: names(v.headers),
    disabled: v.enabled === false || v.disabled === true,
  };
}

/** `claude mcp list` -> { name: "connected" | "failed" | "auth" | "unknown" }.
 *  A line is `<name>: <command or url> - <status>`; the rest (header, blanks) is skipped.
 *  Only names and states are kept: the echoed commands may hold secrets. */
export function parseList(out) {
  const map = {};
  for (const line of String(out ?? "").split("\n")) {
    const i = line.indexOf(": "), j = line.lastIndexOf(" - ");
    if (i <= 0 || j <= i) continue;
    const s = line.slice(j + 3);
    map[line.slice(0, i).trim()] = /needs auth/i.test(s) ? "auth"
      : /fail|error|✗/i.test(s) ? "failed"
      : /connected|✓/i.test(s) ? "connected" : "unknown";
  }
  return map;
}

/** JSON with comments and trailing commas (opencode.jsonc). */
export function jsonc(text) {
  let out = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      out += c;
      if (c === "\\") out += text[++i] ?? "";
      else if (c === '"') q = false;
    } else if (c === '"') { q = true; out += c; }
    else if (c === "/" && text[i + 1] === "/") { while (i < text.length && text[i] !== "\n") i++; out += "\n"; }
    else if (c === "/" && text[i + 1] === "*") { i = text.indexOf("*/", i + 2); if (i < 0) break; i++; }
    else out += c;
  }
  // ponytail: also drops a ",}" inside a string; none in real configs.
  return JSON.parse(out.replace(/,(\s*[}\]])/g, "$1"));
}
