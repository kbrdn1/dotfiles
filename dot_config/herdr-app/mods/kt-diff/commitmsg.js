// The commit message prompt for Changes' ✨ button: the staged diff (capped at
// ~60 000 characters, cut by file; binaries, lockfiles and secret-looking
// files by name only), the last 30 subjects, the branch's issue, and the
// repo's own conventions when it has them (CONTRIBUTING.md, .gitmessage,
// commitlint, the PR template, CLAUDE.md's commit section, .claude/rules
// about commits), each capped at ~6 000. Pure but for `git`, `read` and `list`,
// passed in, so it runs from a node check as well.
// i18n: agent file (the prompt Claude Haiku reads: its words stay as they are, I18N.md)

import { parsePatch } from "./diff.js";

export const DIFF_CAP = 60000;
export const DOC_CAP = 6000;
const LOCK = /(^|\/)(package-lock\.json|npm-shrinkwrap\.json|yarn\.lock|pnpm-lock\.yaml|bun\.lockb?|Cargo\.lock|composer\.lock|Gemfile\.lock|poetry\.lock|uv\.lock|go\.sum|flake\.lock|Podfile\.lock|mix\.lock)$/;
const SECRET = /(^|\/)\.env[^/]*$|\.(pem|key)$|secret/i;

export const SYSTEM = "You write git commit messages. Output only the commit message itself: no preamble, no notes or warnings about the changes, no code fences.";

const DEFAULT_RULES = `Default rules (when the repository's own conventions below don't say otherwise):
- Gitmoji + Conventional Commits: "<gitmoji> <type>(<scope>): <subject>", e.g. "✨ feat(auth): add the login page".
- Subject at most 72 characters, imperative mood, in the language of the recent commits.
- A short body only when it helps (what and why, not how).
- Never use an em dash.
- Reference the issue when there is one.`;

/** The issue number of a `<type>/#N-slug` branch, else null. */
export const issueOf = (branch) => String(branch ?? "").match(/^[\w.-]+\/#(\d+)(?:-|$)/)?.[1] ?? null;

/** The section of a markdown text whose heading mentions commits, up to the next heading as high. */
export function commitSection(md) {
  const lines = String(md ?? "").split("\n");
  const at = lines.findIndex((l) => /^#{1,6}\s.*commit/i.test(l));
  if (at < 0) return null;
  const level = lines[at].match(/^#+/)[0].length;
  let end = lines.findIndex((l, i) => i > at && /^#{1,6}\s/.test(l) && l.match(/^#+/)[0].length <= level);
  if (end < 0) end = lines.length;
  return lines.slice(at, end).join("\n").trim();
}

const cap = (s, n) => (s.length > n ? `${s.slice(0, n)}\n[… cut at ${n} characters]` : s);

/**
 * The prompt for the staged changes of the repo `git` runs in.
 * git(args) -> Promise<string> (stdout); read(relativePath) -> Promise<string|null>; list(relativeDir) -> Promise<string[]>.
 */
export async function commitPrompt(git, read, list) {
  const [stat, numstat, subjects, branch] = await Promise.all([
    git(["diff", "--cached", "--stat"]),
    git(["diff", "--cached", "-M", "--numstat", "-z"]),
    git(["log", "-n", "30", "--format=%s"]),
    git(["branch", "--show-current"]),
  ]);
  // numstat -z: "add\tdel\tpath\0", a rename "add\tdel\t\0old\0new\0".
  const files = [];
  const parts = numstat.split("\0");
  for (let i = 0; i < parts.length; i++) {
    const m = parts[i].match(/^(-|\d+)\t(-|\d+)\t(.*)$/s);
    if (!m) continue;
    const path = m[3] || (i += 2, parts[i]);
    files.push({ path, binary: m[1] === "-" });
  }
  const byName = files.filter((f) => f.binary || LOCK.test(f.path) || SECRET.test(f.path));
  const shown = new Set(files.filter((f) => !byName.includes(f)).map((f) => f.path));
  // One diff for every staged file, split by file: the named-only ones never reach the prompt.
  const all = await git(["diff", "--cached", "-M", "-U2", "--no-color", "--no-ext-diff", "--src-prefix=a/", "--dst-prefix=b/"]);
  let diff = "";
  const cut = [];
  for (const chunk of all.split(/^(?=diff --git )/m).filter(Boolean)) {
    const path = parsePatch(chunk)[0]?.path;
    if (!path || !shown.has(path)) continue;
    if (diff.length + chunk.length > DIFF_CAP && diff.length) cut.push(path);
    else diff += chunk;
  }
  // The repo's conventions, read together.
  const [root, rules] = await Promise.all([list("."), list(".claude/rules")]);
  const wanted = [
    ["Contributing guide", "CONTRIBUTING.md"],
    ["Commit template", ".gitmessage"],
    ...root.filter((n) => /^(commitlint\.config\.[cm]?[jt]s|\.commitlintrc(\.(json|ya?ml|[cm]?js))?)$/.test(n)).map((n) => ["commitlint", n]),
    ["PR template (vocabulary)", ".github/PULL_REQUEST_TEMPLATE.md"],
    ["CLAUDE.md, commits", "CLAUDE.md", commitSection],
    ...rules.filter((n) => /commit|git/i.test(n)).map((n) => ["Rule", `.claude/rules/${n}`]),
  ];
  const texts = await Promise.all(wanted.map(([, path]) => read(path)));
  const docs = wanted.flatMap(([label, path, pick], i) => {
    const v = texts[i] && (pick ? pick(texts[i]) : texts[i]);
    return v ? [`### ${label} (${path})\n${cap(v.trim(), DOC_CAP)}`] : [];
  });
  const issue = issueOf(branch.trim());
  return [
    "Write the commit message for the staged changes below.",
    DEFAULT_RULES,
    issue ? `The branch is "${branch.trim()}": reference issue #${issue}.` : `The branch is "${branch.trim() || "(detached)"}".`,
    docs.length ? `## The repository's conventions\n\n${docs.join("\n\n")}` : "The repository has no written commit convention: follow the default rules and the recent commits.",
    `## Recent commit subjects (the repository's real style)\n${subjects.trim() || "(none yet)"}`,
    `## Staged files\n${stat.trim()}`,
    byName.length ? `Listed by name only (binary, lockfile or possibly secret): ${byName.map((f) => f.path).join(", ")}` : "",
    `## Staged diff${cut.length ? ` (cut at ~${DIFF_CAP} characters: ${cut.length} more file(s) by name only: ${cut.join(", ")})` : ""}\n${diff.trim()}`,
    "Reply with the commit message only.",
  ].filter(Boolean).join("\n\n");
}

/** The model's reply as a message: no fences, no em dash, trimmed. */
export const cleanMessage = (s) => String(s ?? "").replace(/^```[^\n]*\n?/gm, "").replace(/\n?```\s*$/gm, "").replace(/\s*—\s*/g, ", ").trim();
