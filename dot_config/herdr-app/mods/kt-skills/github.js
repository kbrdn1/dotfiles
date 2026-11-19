// A skill's GitHub source, as typed in « Depuis GitHub »: owner/repo[/path],
// https://github.com/owner/repo[/tree|blob/<ref>/<path>], git@github.com:owner/repo.git.
// -> { owner, repo, ref, path, url } or { error }: "source", "parts", "ref" or "path", which add.js
// says in words (strings.js' gh.<error>, I18N.md). The path is normalized and may not leave the
// clone (no "..", no "."), a trailing SKILL.md names its folder. Pure (no imports): node runs it
// (frontmatter.test.mjs).

const PART = /^[A-Za-z0-9_.-]+$/;

export function githubSource(input) {
  const s = String(input ?? "").trim().replace(/\/+$/, "");
  let m = s.match(/^(?:https?:\/\/)?(?:www\.)?github\.com\/([^/\s]+)\/([^/\s]+?)(?:\.git)?(?:\/(?:tree|blob)\/([^/\s]+)(?:\/(\S*))?)?$/i);
  let owner, repo, ref = null, path = "";
  if (m) [, owner, repo, ref = null, path = ""] = m;
  else if ((m = s.match(/^git@github\.com:([^/\s]+)\/([^/\s]+?)(?:\.git)?$/i))) [, owner, repo] = m;
  else if ((m = s.match(/^([^/\s:]+)\/([^/\s:]+)(?:\/(\S*))?$/))) [, owner, repo, path = ""] = m;
  else return { error: "source" }; // i18n: tech
  if (!PART.test(owner) || !PART.test(repo) || !/^[A-Za-z0-9]/.test(owner) || repo.startsWith(".")) return { error: "parts" }; // i18n: tech
  if (ref != null && !/^[A-Za-z0-9_./-]+$/.test(ref)) return { error: "ref" }; // i18n: tech
  const parts = (path ?? "").split("/").filter(Boolean);
  if (parts.at(-1) === "SKILL.md") parts.pop();
  if (parts.some((p) => p === "." || p === ".." || !PART.test(p))) return { error: "path" }; // i18n: tech
  return { owner, repo, ref, path: parts.join("/"), url: `https://github.com/${owner}/${repo}.git` };
}

// git on a repository nobody here wrote (issue #70, the same guards as kt-market's market.mjs): no
// credential prompt, no LFS download, no local-file protocol, symlinks checked out as plain files (the
// folder check then refuses a link leaving the clone), no hooks path, no fsmonitor.
export const GIT_SAFE_ENV = ["GIT_TERMINAL_PROMPT=0", "GIT_LFS_SKIP_SMUDGE=1"];
export const GIT_SAFE_CONFIG = ["-c", "protocol.file.allow=never", "-c", "core.symlinks=false", "-c", "core.hooksPath=/dev/null", "-c", "core.fsmonitor=false"];

/** The shallow clone of a githubSource() into `dest`, as argv for exec("env", …): the variables, then
 *  git, its -c guards and its arguments, each its own argument (no shell). */
export const cloneArgv = (src, dest) =>
  [...GIT_SAFE_ENV, "git", ...GIT_SAFE_CONFIG, "clone", "--depth", "1", ...(src.ref ? ["--branch", src.ref] : []), src.url, dest];
