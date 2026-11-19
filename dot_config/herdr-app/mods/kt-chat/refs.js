// refs.js: the Chat's references (#82): what in a transcript's text names something Herdr can show (an
// issue or a PR, a commit, a file at a line, a branch, a worktree), checked against the thread's repo
// before it becomes a link, and where a click on it goes. Pure but for `ensure`, whose I/O comes in
// (`io.exec`): the check (refs.check.mjs) runs it with fakes.
//
//   scan(text)                 candidates in a prose segment: plain text and whole inline code spans;
//                              never inside a link, an autolink or a bare URL (a GitHub URL there is a
//                              candidate for the chips only: it is a link already)
//   resolve(c, facts)          the reference a candidate names in that repo, or null (ambiguous, absent:
//                              it stays text). Bare #N needs the repo's "owner/name" (Home's guard);
//                              issues aren't checked (no network for that), shas, branches, worktrees
//                              and files are
//   linkify(text, cands, rs)   the segment with each resolved reference as a link [raw](herdr-ref:…), a
//                              code span whole (`` [`dev`](…) ``)
//   refUrl(r) / parseRef(url)  the link's url and back
//   plan(r)                    where a click goes: { key, value, page | panel } (the receivers' shared
//                              keys: kt.inbox.open, kt.history.open, kt.files.open, kt.gwm.open)
//   githubUrl(r)               its page on GitHub (an issue or a PR, a commit), else null
//   refsState() / ensure(…)    the facts per cwd, asked in ONE task per render for what's missing

export const SCHEME = "herdr-ref:";
const SHA = /^[0-9a-f]{7,40}$/;
const isSha = (s) => SHA.test(s) && /[0-9]/.test(s) && /[a-f]/.test(s);
const BRANCH = /^[A-Za-z][\w.+-]*(?:\/[\w.#+-]+)*$/;
const MAX = 40; // candidates looked at in one segment

/** "owner/name" of a GitHub remote url (kt-gwm's, kt-inbox's), else null. */
export function githubRepo(url) {
  const m = String(url ?? "").trim().match(/^(?:(?:https?|ssh|git):\/\/)?(?:[^@/\s]+@)?github\.com(?::\d+)?[:/]([^/\s]+)\/([^/\s]+?)(?:\.git)?\/?$/i);
  return m ? `${m[1]}/${m[2]}` : null;
}
/** Home's guard (kt-hub recent.js): a GitHub repo, the only kind an issue number means something in. */
export const onGitHub = (repo) => /^[\w.-]+\/[\w.-]+$/.test(String(repo ?? ""));

// ---------- scan ----------

// A path, maybe at a line: path:12, path:12-20, path#L12, path#L12-L20.
const LINE = /(?::(\d+)(?:-(\d+))?|#L(\d+)(?:-L?(\d+))?)$/;
function pathOf(s) {
  const m = s.match(LINE);
  const path = m ? s.slice(0, m.index) : s;
  const n = (v) => (v ? Number(v) : null);
  const line = m ? n(m[1] ?? m[3]) : null;
  const to = m ? n(m[2] ?? m[4]) : null;
  return { path, line, to: line && to && to >= line ? to : null };
}
// Something that may be a path: a slash in it, or a file name with an extension; ~ / . / allowed first.
const PATHISH = /^(?:~|\.{1,2})?\/?[\w.@+-]+(?:\/[\w.@+-]+)*\/?$/;
const looksPath = (p) => PATHISH.test(p) && (p.includes("/") || /\.[A-Za-z0-9]{1,8}$/.test(p)) && !/^\.+$/.test(p) && !/^\d+(\.\d+)+$/.test(p);

// What a whole code span or token is a candidate for.
function kindsOf(s, code) {
  const out = [];
  const iss = s.match(/^(?:([\w.-]+\/[\w.-]+))?#(\d{1,5})$/);
  if (iss) return [{ kind: "issue", repo: iss[1] ?? null, number: Number(iss[2]) }];
  if (isSha(s.toLowerCase()) && s === s.toLowerCase()) return [{ kind: "commit", sha: s }];
  const p = pathOf(s);
  if (looksPath(p.path)) out.push({ kind: "path", ...p });
  if (code && BRANCH.test(s) && !/^\d+$/.test(s)) out.push({ kind: "branch", name: s });
  return out;
}

// The parts of a segment no reference is looked for in: links, images, autolinks, bare URLs.
const SKIP = /!?\[[^\]\n]*\]\([^)\n]*\)|<[a-z][\w+.-]*:[^>\s]*>|\bhttps?:\/\/[^\s<>()]+/gi;
const GH_URL = /^<?https?:\/\/github\.com\/([\w.-]+\/[\w.-]+)\/(issues|pull)\/(\d+)/i;
const CODE = /(`+)(?!`)([\s\S]*?[^`])\1(?!`)/g;
// Plain text tokens: owner/repo#N or #N; a sha; a path-like word (a slash or an extension).
const TOKEN = /(?<![\w&/#.-])(?:[\w.-]+\/[\w.-]+)?#\d{1,5}(?![\w-])|(?<![\w./-])[0-9a-f]{7,40}(?![\w/-]|\.\w)|(?<![\w./~:@-])(?:~|\.{1,2})?\/?[\w.@+-]+(?:\/[\w.@+-]+)+(?::\d+(?:-\d+)?|#L\d+(?:-L?\d+)?)?|(?<![\w./~:@-])[\w@+-][\w.@+-]*\.[A-Za-z][A-Za-z0-9]{0,7}(?::\d+(?:-\d+)?)?(?![\w/])/g;

/** Candidates in a prose segment, in order: { start, end, raw, code, url?, kinds: [...] }. */
export function scan(text) {
  const s = String(text ?? "");
  const out = [];
  const skips = [];
  for (const m of s.matchAll(SKIP)) {
    skips.push([m.index, m.index + m[0].length]);
    const g = m[0].replace(/^!?\[[^\]]*\]\(/, "").match(GH_URL);
    if (g) out.push({ start: m.index, end: m.index + m[0].length, raw: m[0], code: false, url: true, kinds: [{ kind: "issue", repo: g[1], number: Number(g[3]) }] });
  }
  const inSkip = (a, b) => skips.some(([x, y]) => a < y && b > x);
  const spans = [];
  for (const m of s.matchAll(CODE)) {
    const a = m.index, b = a + m[0].length;
    if (inSkip(a, b)) continue;
    spans.push([a, b]);
    const inner = m[2].trim();
    if (!inner || inner.includes("\n") || /[[\]()]/.test(inner)) continue;
    const kinds = kindsOf(inner, true);
    if (kinds.length) out.push({ start: a, end: b, raw: m[0], code: true, kinds });
  }
  const covered = (a, b) => inSkip(a, b) || spans.some(([x, y]) => a < y && b > x);
  for (const m of s.matchAll(TOKEN)) {
    let raw = m[0];
    // A sentence's end isn't the path's: "voir main.js." → main.js.
    raw = raw.replace(/[.]+$/, "");
    const a = m.index, b = a + raw.length;
    if (!raw || covered(a, b)) continue;
    const kinds = kindsOf(raw, false);
    if (kinds.length) out.push({ start: a, end: b, raw, code: false, kinds });
  }
  return out.sort((x, y) => x.start - y.start).slice(0, MAX);
}

// ---------- resolve ----------

const norm = (p) => {
  const parts = [];
  for (const x of p.split("/")) {
    if (x === "..") parts.pop();
    else if (x && x !== ".") parts.push(x);
  }
  return `/${parts.join("/")}`;
};
/** The absolute paths a written path can be: absolute, under ~, else from the thread's cwd, then its root. */
export function absOf(path, { cwd, root, home }) {
  const p = path.replace(/\/+$/, "");
  if (p.startsWith("/")) return [norm(p)];
  if (p === "~" || p.startsWith("~/")) return home ? [norm(`${home}/${p.slice(1)}`)] : [];
  return [...new Set([cwd, root].filter(Boolean).map((d) => norm(`${d}/${p}`)))];
}

/**
 * The reference candidate `c` names in the thread's repo, from `facts` = { cwd, root, home, slug,
 * shas: { [written]: full | "ambiguous" | "missing" }, branches: Set, worktrees: Set (absolute),
 * files: Set (absolute, files only) }: { kind, … } or null. A GitHub URL resolves without facts.
 */
export function resolve(c, f) {
  for (const k of c.kinds) {
    if (k.kind === "issue") {
      const repo = k.repo ?? f?.slug ?? null;
      if (onGitHub(repo)) return { kind: "issue", repo, number: k.number };
    } else if (k.kind === "commit") {
      const full = f?.shas?.[k.sha];
      if (full && SHA.test(full)) return { kind: "commit", sha: full, repo: f.slug ?? null };
    } else if (k.kind === "path" && f) {
      for (const abs of absOf(k.path, f)) {
        if (f.worktrees?.has(abs)) return { kind: "worktree", path: abs };
        if (f.files?.has(abs) && f.root && abs.startsWith(`${f.root}/`)) return { kind: "file", path: abs, line: k.line, to: k.to };
      }
    } else if (k.kind === "branch" && f?.branches?.has(k.name)) return { kind: "branch", name: k.name };
  }
  return null;
}

// ---------- links ----------

/** The link a reference becomes in the prose, and back (null: not one of ours). */
export function refUrl(r) {
  const v = r.kind === "issue" ? `${r.repo}#${r.number}`
    : r.kind === "commit" ? r.sha
      : r.kind === "file" ? `${r.path}${r.line ? `:${r.line}${r.to ? `-${r.to}` : ""}` : ""}`
        : r.kind === "branch" ? r.name : r.path;
  return `${SCHEME}${r.kind}/${encodeURIComponent(v)}${r.kind === "commit" && r.repo ? `?repo=${encodeURIComponent(r.repo)}` : ""}`;
}
export function parseRef(url) {
  const m = String(url ?? "").match(/^herdr-ref:(issue|commit|file|branch|worktree)\/([^?]*)(?:\?repo=(.*))?$/);
  if (!m) return null;
  let v;
  try { v = decodeURIComponent(m[2]); } catch { return null; }
  if (m[1] === "issue") {
    const i = v.match(/^([\w.-]+\/[\w.-]+)#(\d+)$/);
    return i ? { kind: "issue", repo: i[1], number: Number(i[2]) } : null;
  }
  if (m[1] === "commit") {
    if (!SHA.test(v)) return null;
    let repo = null;
    try { repo = m[3] ? decodeURIComponent(m[3]) : null; } catch { repo = null; }
    return { kind: "commit", sha: v, repo: onGitHub(repo) ? repo : null };
  }
  if (m[1] === "file") {
    if (!v.startsWith("/")) return null;
    const p = pathOf(v);
    return { kind: "file", path: p.path, line: p.line, to: p.to };
  }
  if (m[1] === "worktree") return v.startsWith("/") ? { kind: "worktree", path: v } : null;
  return BRANCH.test(v) ? { kind: "branch", name: v } : null;
}

/** The segment with its resolved references as links (`rs[i]`: candidate i's reference, or null). */
export function linkify(text, cands, rs) {
  let out = "", at = 0;
  cands.forEach((c, i) => {
    const r = rs[i];
    if (!r || c.url || c.start < at || /[[\]]/.test(c.raw)) return;
    out += text.slice(at, c.start) + `[${c.raw}](${refUrl(r)})`;
    at = c.end;
  });
  return out + text.slice(at);
}

/** A reference's label in a chip. */
export function labelOf(r) {
  if (r.kind === "issue") return `#${r.number}`;
  if (r.kind === "commit") return r.sha.slice(0, 7);
  if (r.kind === "file") return `${r.path.split("/").pop()}${r.line ? `:${r.line}` : ""}`;
  if (r.kind === "worktree") return r.path.split("/").pop();
  return r.name;
}
export const refKey = (r) => refUrl(r);

// ---------- where a click goes ----------

/** The receiver of a reference: its shared key and value, the page (main "view" stack) or the panel's tab. */
export function plan(r, kind = "issue") {
  if (r.kind === "issue") return { key: "kt.inbox.open", value: { repo: r.repo, kind, number: r.number }, page: "inbox" };
  if (r.kind === "commit") return { key: "kt.history.open", value: { sha: r.sha }, panel: "history" };
  if (r.kind === "file") return { key: "kt.files.open", value: { path: r.path, ...(r.line ? { line: r.line } : {}), ...(r.to ? { to: r.to } : {}) }, panel: "files" };
  if (r.kind === "worktree") return { key: "kt.gwm.open", value: { path: r.path }, page: "gwm" };
  return { key: "kt.gwm.open", value: { branch: r.name }, page: "gwm" };
}

/** Its page on GitHub, when it has one: an issue or a PR (GitHub sends /issues/N on to a PR), a commit. */
export function githubUrl(r) {
  if (r.kind === "issue" && onGitHub(r.repo)) return `https://github.com/${r.repo}/issues/${r.number}`;
  if (r.kind === "commit" && onGitHub(r.repo)) return `https://github.com/${r.repo}/commit/${r.sha}`;
  return null;
}

/** An issue's kind from `gh api repos/o/r/issues/N --jq .pull_request` (its stdout): "pr" | "issue". */
export const kindFrom = (stdout) => (/^\s*(null)?\s*$/.test(String(stdout ?? "")) ? "issue" : "pr");

// ---------- the facts, asked once per render ----------

export const refsState = () => ({ facts: new Map(), queue: [], busy: false, v: 0 });

const blank = (cwd) => ({ cwd, root: undefined, home: null, slug: null, shas: {}, branches: null, worktrees: null, files: new Set(), asked: new Set() });

/** The facts known for `cwd` (created empty), and whether candidates `cands` still need some. */
export function factsFor(st, cwd, home) {
  let f = st.facts.get(cwd);
  if (!f) { f = blank(cwd); f.home = home; st.facts.set(cwd, f); }
  return f;
}
/** What `cands` would need that isn't known yet: { root, shas, branches, paths }. */
export function missing(f, cands) {
  const need = { root: f.root === undefined, shas: [], branches: false, paths: [] };
  for (const c of cands) for (const k of c.kinds) {
    if (k.kind === "commit" && !(k.sha in f.shas)) need.shas.push(k.sha);
    if (k.kind === "branch" && !f.branches) need.branches = true;
    if (k.kind === "path") {
      if (!f.worktrees) need.branches = true; // worktrees come with the branches' call
      for (const a of absOf(k.path, f.root === undefined ? { ...f, root: null } : f)) if (!f.asked.has(a)) need.paths.push(a);
    }
  }
  need.shas = [...new Set(need.shas)];
  need.paths = [...new Set(need.paths)];
  return need.root || need.shas.length || need.branches || need.paths.length ? need : null;
}

/**
 * The candidates' missing facts for `cwd`, queued; the render's first miss spawns ONE task (`cx`, after
 * the render): root and slug, then the shas, the branches and worktrees, the files, each in one call,
 * then a redraw. `io.exec(cmd, args)`: herdr's. Nothing while checking (`io.checking()`).
 */
export function ensure(st, cx, cwd, cands, io) {
  if (!cwd || !cands.length || io.checking()) return;
  const f = factsFor(st, cwd, io.home());
  const need = missing(f, cands);
  if (!need) return;
  st.queue.push({ f, cands });
  if (st.busy) return;
  st.busy = true;
  cx.spawn(async (cx) => {
    await null;
    while (st.queue.length) {
      const batch = st.queue.splice(0);
      for (const { f, cands } of batch) await fill(f, cands, io);
    }
    st.busy = false;
    st.v++;
    cx.notify();
  });
}

const run = async (io, cmd, args, opts) => {
  try { const r = await io.exec(cmd, args, { timeout: 5000, ...opts }); return r?.code === 0 ? String(r.stdout ?? "") : null; } catch { return null; }
};

async function fill(f, cands, io) {
  if (f.root === undefined) {
    f.root = (await run(io, "git", ["-C", f.cwd, "rev-parse", "--show-toplevel"]))?.trim() || null;
    f.slug = f.root ? githubRepo((await run(io, "git", ["-C", f.root, "remote", "get-url", "origin"]))?.trim()) : null;
  }
  const need = missing(f, cands);
  if (!need) return;
  if (need.shas.length) {
    if (!f.root) for (const s of need.shas) f.shas[s] = "missing";
    else {
      const out = await run(io, "sh", ["-c", 'printf "%s\\n" "$@" | git cat-file --batch-check', "sh", ...need.shas], { cwd: f.root });
      const lines = (out ?? "").split("\n");
      need.shas.forEach((s, i) => {
        const [full, type] = (lines[i] ?? "").split(" ");
        f.shas[s] = type === "commit" && SHA.test(full ?? "") ? full : type === "ambiguous" || full === "ambiguous" ? "ambiguous" : "missing";
      });
    }
  }
  if (need.branches) {
    f.branches = new Set(f.root ? (await run(io, "git", ["-C", f.root, "for-each-ref", "--format=%(refname:short)", "refs/heads"]) ?? "").split("\n").filter(Boolean) : []);
    f.worktrees = new Set(f.root ? (await run(io, "git", ["-C", f.root, "worktree", "list", "--porcelain"]) ?? "").split("\n")
      .filter((l) => l.startsWith("worktree ")).map((l) => l.slice(9).replace(/\/+$/, "")) : []);
  }
  if (need.paths.length) {
    const out = await run(io, "sh", ["-c", 'for p; do [ -f "$p" ] && printf "%s\\n" "$p"; done; true', "sh", ...need.paths]);
    for (const p of (out ?? "").split("\n").filter(Boolean)) f.files.add(p);
    for (const p of need.paths) f.asked.add(p);
  }
}

/** The references of a segment for this render: [candidates, references (null: stays text)]. */
export function refsOf(st, cwd, text, home) {
  const cands = scan(text);
  const f = cwd ? st.facts.get(cwd) ?? { ...blank(cwd), home } : null;
  return [cands, cands.map((c) => resolve(c, f && f.root !== undefined ? f : null))];
}
