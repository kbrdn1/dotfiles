// Where Flow's buttons and g-keys go (pure, no imports: `bun mods/kt-flow/links.check.mjs`). The flow's
// issue and PR as kt-gwm links them: in Herdr, kt-inbox's page opened on the item (shared "kt.inbox.open"
// = { repo, kind, number, tab?, at }, read once by kt-inbox, which selects it, opens it and shows it in its
// list); on GitHub, the browser. `h` is herdr's { run, exec, setShared, now } (fakes in the check).

/** An issue or a PR (`kind`, its number) of the GitHub repo `gh` ("owner/repo", null off GitHub): { repo,
 *  kind, number, url } (`url`: given, e.g. the report's PR url, else GitHub's), null without a number. */
export function target(gh, kind, number, url) {
  const n = Number(number) || null;
  if (!n) return null;
  return { repo: gh ?? null, kind, number: n, url: url ?? (gh ? `https://github.com/${gh}/${kind === "pr" ? "pull" : "issues"}/${n}` : null) };
}

/** A PR's checks: the Inbox's Checks tab, GitHub's /checks. */
export const checksOf = (pr) => pr && { ...pr, tab: "checks", url: pr.url ? `${pr.url}/checks` : null };

/** A step's item in Herdr (enter / o on its row): "issue", "pr", null for another step. */
export const stepKind = (id) => (id === "issue" || id === "issue-closed" ? "issue" : id === "pr" ? "pr" : null);

/** A step's page on GitHub (its icon, O): the issue's, the PR's, its files with their review comments
 *  (review), its checks (CI); null for another step or without a url. */
export function stepUrl(id, issue, pr) {
  if (stepKind(id) === "issue") return issue?.url ?? null;
  const u = pr?.url;
  return (u && { pr: u, review: `${u}/files`, ci: `${u}/checks` }[id]) ?? null;
}

/** The item in kt-inbox (its page shown): false without its GitHub repo (the caller falls back to the browser). */
export function inHerdr(h, x) {
  if (!x?.repo || !x.number) return false;
  h.setShared("kt.inbox.open", { repo: x.repo, kind: x.kind, number: x.number, ...(x.tab ? { tab: x.tab } : {}), at: h.now() });
  h.run("layout.select", { stack: "view", child: "inbox" });
  return true;
}

/** A url in the browser: false without one. */
export function toBrowser(h, url) {
  if (!url) return false;
  h.exec("open", [url]).catch(() => {});
  return true;
}

/** A page of the main "view" stack (gwm: Worktrees), a tab of the right panel (diff: Changes, history: History). */
export const toPage = (h, child) => h.run("layout.select", { stack: "view", child });
export const toTab = (h, child) => h.run("layout.select", { stack: "panel-body", child });

const WAIT = 600; // vim.js' time between the two keys of gg
const G = { i: ["issue", false], I: ["issue", true], p: ["pr", false], P: ["pr", true] };
/** gi / gI / gp / gP: the key `name` right after vim.js' pending g (`vim`, a vim.js Vim, then back in
 *  NORMAL): { kind: "issue" | "pr", github }, else null (and vim untouched: gg, counts, the rest go on). */
export function gLink(vim, name, now) {
  const k = G[name];
  if (!k || vim.pending !== "g" || now - vim.at > WAIT) return null;
  vim.normal();
  return { kind: k[0], github: k[1] };
}
