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
const masked = (list) => (list.length ? Object.fromEntries(list.map((n) => [n, MASK])) : undefined);

/** One server row. Keeps names of env/headers, never their values. `listName`: how
 *  `claude mcp list` names it (`plugin:<plugin>:<name>` for a plugin's). `config`: what the
 *  detail shows of its config, every value already masked. */
export function server(provider, scope, name, v, file, listName = name) {
  v = v ?? {};
  // OpenCode: command is [program, ...args].
  const cmd = Array.isArray(v.command) ? v.command : v.command ? [v.command, ...(v.args ?? [])] : null;
  const env = [...new Set([...names(v.env), ...names(v.environment)])];
  const headers = names(v.headers);
  const disabled = v.enabled === false || v.disabled === true;
  const config = {
    type: v.type ?? undefined,
    command: cmd?.length ? maskText(cmd[0]) : undefined,
    args: cmd?.length > 1 ? maskArgs(cmd.slice(1)) : undefined,
    url: v.url ? maskUrl(v.url) : undefined,
    env: masked(env),
    headers: masked(headers),
    enabled: disabled ? false : undefined,
  };
  return {
    key: `${provider}:${scope}:${name}`, provider, scope, name, file, listName,
    transport: transport(v),
    target: cmd?.length ? [maskText(cmd[0]), ...maskArgs(cmd.slice(1))].join(" ") : v.url ? maskUrl(v.url) : "",
    env, headers, disabled,
    config: Object.fromEntries(Object.entries(config).filter(([, x]) => x != null)),
  };
}

/** A status text ("✓ Connected", "! Needs authentication", "✗ Failed to connect") -> a state. */
export const stateOf = (s) => (/needs auth/i.test(s) ? "auth" : /fail|error|✗/i.test(s) ? "failed" : /connected|✓/i.test(s) ? "connected" : "unknown");

/** `claude mcp list` -> { name: "connected" | "failed" | "auth" | "unknown" }.
 *  A line is `<name>: <command or url> - <status>`; the rest (header, blanks) is skipped.
 *  Only names and states are kept: the echoed commands may hold secrets. */
export function parseList(out) {
  const map = {};
  for (const line of String(out ?? "").split("\n")) {
    const i = line.indexOf(": "), j = line.lastIndexOf(" - ");
    if (i <= 0 || j <= i) continue;
    map[line.slice(0, i).trim()] = stateOf(line.slice(j + 3));
  }
  return map;
}

/** `claude mcp get <name>`, masked: it prints env and header values in clear. Lines under
 *  `Environment:` / `Headers:` keep their names only; Args, URL and the rest as a row's. */
export function maskGet(out) {
  let section = null, depth = 0;
  return String(out ?? "").split("\n").map((l) => {
    const indent = l.length - l.trimStart().length;
    if (section && (!l.trim() || indent > depth)) {
      if (!l.trim()) return l;
      const kv = l.match(/^(\s*)([^=:\s]+)\s*([=:])/);
      return kv ? `${kv[1]}${kv[2]}${kv[3] === "=" ? "=" : ": "}${MASK}` : `${" ".repeat(indent)}${MASK}`;
    }
    section = null;
    const head = l.match(/^(\s*)(Environment|Env|Headers)\s*:\s*$/i);
    if (head) { section = head[2]; depth = head[1].length; return l; }
    const args = l.match(/^(\s*Args:\s*)(.*)$/);
    if (args) return args[1] + maskArgs(args[2].split(/\s+/).filter(Boolean)).join(" ");
    const url = l.match(/^(\s*URL:\s*)(\S+)(.*)$/);
    if (url) return url[1] + maskUrl(url[2]) + maskText(url[3]);
    const kv = l.match(/^(\s*)([A-Za-z_][\w.-]*)=(.*)$/);
    if (kv) return `${kv[1]}${kv[2]}=${MASK}`;
    return maskText(l);
  }).join("\n");
}

/** The state `claude mcp get` reports (its `Status:` line), else "unknown". */
export function parseGet(out) {
  const s = String(out ?? "").match(/^\s*Status:\s*(.+)$/m)?.[1];
  return s ? stateOf(s) : "unknown";
}

/** A command line as a shell splits it: spaces, '…' and "…" quotes, \ escapes (no expansion). */
export function splitArgs(s) {
  const out = [];
  let cur = "", q = null, has = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) {
      if (c === q) q = null;
      else if (c === "\\" && q === '"' && i + 1 < s.length) cur += s[++i];
      else cur += c;
    } else if (c === "'" || c === '"') { q = c; has = true; }
    else if (c === "\\" && i + 1 < s.length) { cur += s[++i]; has = true; }
    else if (/\s/.test(c)) { if (cur || has) out.push(cur); cur = ""; has = false; }
    else { cur += c; has = true; }
  }
  if (cur || has) out.push(cur);
  return out;
}

/** One argument as a shell reads it back: bare when it can be, else '…'. */
export const shq = (s) => (/^[\w@%+=:,./-]+$/.test(s) ? s : `'${String(s).replace(/'/g, "'\\''")}'`);

/** A pasted server config with every secret masked, for the confirmation: env and header values,
 *  secret args, URL queries, token-shaped strings anywhere else. */
export function maskJson(o) {
  const walk = (v, key) => {
    if (Array.isArray(v)) return key === "args" ? maskArgs(v) : v.map((x) => walk(x));
    if (v && typeof v === "object") {
      const out = {};
      for (const [k, x] of Object.entries(v)) out[k] = /^(env|environment|headers)$/i.test(k) && x && typeof x === "object" && !Array.isArray(x)
        ? Object.fromEntries(Object.keys(x).map((n) => [n, MASK])) : walk(x, k);
      return out;
    }
    if (typeof v !== "string") return v;
    if (key === "url") return maskUrl(v);
    return SECRET.test(key ?? "") ? MASK : maskText(v);
  };
  return walk(o);
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
