// gwm.js: what kt-new asks gwm and how it reads the answer. Pure (no herdr, no gpui-kit), so Bun
// checks it against gwm's real lines: `bun mods/kt-new/gwm.check.mjs`.

// "#42" -> { issue: "42", desc: null }; "#42 fix the login" (or "42 fix the login") -> { issue: "42", desc: "fix the login" }.
export function issueOf(name) {
  const m = name.trim().match(/^#(\d+)$|^#?(\d+)\s+(.*\S)/);
  return m ? { issue: m[1] ?? m[2], desc: m[3] ?? null } : null;
}

// The thread as the agent's first message; "#42 …" reads "Issue #42 …" (a leading # is Claude Code's memory key).
export const firstMessage = (name) => (name.startsWith("#") ? `Issue ${name}` : name); // i18n: agent

// gwm's arguments for an issue: `--issue N` (type and description from the issue; `--type`: the
// picked one), or the triple when the type is picked and there's a description; `triple` also backs
// `--issue` up when the forge doesn't know the issue. `--reuse-branch`: a local branch of that name
// without a worktree is taken back, not refused.
export function plan(spec, type, typeChosen) {
  const base = ["create", "--reuse-branch"];
  const triple = spec.desc ? [...base, type, spec.issue, spec.desc] : null;
  return { triple, first: typeChosen && triple ? triple : [...base, "--issue", spec.issue, ...(typeChosen ? ["--type", type] : [])] };
}

// After a failed `gwm create <last>` that printed `all`: the next arguments, or null. The issue's
// labels don't say the type: the Type row's. The forge doesn't know the issue (no GitHub / GitLab
// remote, no such number): the triple, with a description; only when gwm stopped before the issue
// was read and before any worktree was made (a hook failing after `worktree created at` must not
// make a second one). Never for a closed issue (gwm refuses it on purpose) nor the trust ledger.
export function retry(all, last, { first, triple }, type, typeChosen) {
  if (last === first && /pass --type/.test(all) && !typeChosen) return [...first, "--type", type];
  if (triple && last !== triple && !/is closed|trust ledger|✓ fetched issue|worktree created at/.test(all)) return triple;
  return null;
}

// The .gwm.toml gwm won't run untrusted without a terminal.
export const TRUST = /\.gwm\.toml at (.+?) is not in the trust ledger/;

// Where the worktree is, from gwm's answer: made, or already there for that issue (--issue), on
// success; already there at that path (the triple), on its refusal. A failure after "worktree
// created at" (a hook, the bootstrap) is a failure: no path. Anchored: "branch '…' already exists
// at <oid>" is not a path.
export function where(all, code) {
  const m = code === 0
    ? all.match(/^(?:✓ worktree created at|worktree for issue #\d+ already exists at) (.+)$/m)
    : all.match(/^error: worktree '[^']*' already exists at (.+)$/m);
  return m?.[1]?.trim() || null;
}

// What a gwm refusal is: "closed", "hook", "notFound" or "failed". main.js says it in plain words
// (strings.js' gwm.<kind>.title / .text, I18N.md); its raw line is shown under them.
export function explain(raw) {
  if (/is closed/.test(raw)) return "closed";
  if (/hook \S+ '.*' failed/.test(raw)) return "hook";
  if (/recognised git remote|Could not resolve|HTTP 404|gh auth|glab/.test(raw)) return "notFound";
  return "failed";
}
