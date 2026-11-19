// workflows.js: Kylian's workflow as data (WORKFLOW.md, « Workflow — Worktree »), the one list of its
// entry points, its cycle and its side branches, for kt-workflow (its page) and kt-chat (#81: a
// completion's category, the workflow's dither rail). Moved out of kt-workflow/main.js, unchanged.
// Written once in mods/kt-keys/workflows.js and copied byte for byte (cmp) into each mod that uses it;
// categories.js imports it. Pure: no herdr, no gpui. Checked by categories.check.mjs.

// What a step or a workflow stands on, under ~/.claude. `select`: its name in kt-skills. `skill`: its
// SKILL.md; `command`: its slash command's file; `cale`: that command must be a cale reading the skill
// (only skills/me/** need one: CLAUDE.md, « Commandes »). A command alone is the workflow itself.
export const ME = (x) => ({ select: `me:${x}`, skill: `skills/me/${x}/SKILL.md`, command: `commands/me/${x}.md`, cale: true });
export const LOOP = (x) => ({ select: `me:loop:${x}`, skill: `skills/me/loop/${x}/SKILL.md`, command: `commands/me/loop/${x}.md`, cale: true });
export const REFS = {
  "issue-worktree-pr": { select: "me:issue-worktree-pr", command: "commands/me/issue-worktree-pr.md" },
  "issue-branch-pr": { select: "me:issue-branch-pr", command: "commands/me/issue-branch-pr.md" },
  "spec-issue-worktree-pr": { select: "spec-git-flow-worktree", skill: "skills/spec-git-flow-worktree/SKILL.md", command: "commands/me/spec-issue-worktree-pr.md" },
  "spec-issue-branch-pr": { select: "spec-git-flow-branch", skill: "skills/spec-git-flow-branch/SKILL.md", command: "commands/me/spec-issue-branch-pr.md" },
  gwm: { select: "gwm", skill: "skills/gwm/SKILL.md" },
  ...Object.fromEntries(["goal", "dispatch", "release", "merge", "report", "check-reviews"].map((x) => [x, ME(x)])),
  ...Object.fromEntries(["claude-review-pr", "codex-review-pr", "ci-until-green"].map((x) => [`loop:${x}`, LOOP(x)])),
};
export const refOf = (id) => REFS[id] ?? (id?.startsWith("loop:") ? LOOP(id.slice(5)) : null);

// The cycle, in order (WORKFLOW.md, « Workflow — Worktree »), and its side branches. `title`: the
// French one the intentions quote (they go to Claude); shown, a step reads strings.js' step.<id>.
// `cmd` null: its line is words (cmd.<id>), not a command.
export const STEPS = [
  { id: "issue", icon: "circle-dashed", title: "Issue", cmd: "/me:issue-worktree-pr", ref: "issue-worktree-pr" }, // i18n: agent
  { id: "worktree", icon: "git-branch", title: "Worktree gwm", cmd: "gwm create · attach", ref: "gwm" }, // i18n: agent
  { id: "impl", icon: "git-commit", title: "Implémentation", cmd: null, ref: null }, // i18n: agent
  { id: "report", icon: "file-text", title: "Rapport", cmd: "/me:report", ref: "report" }, // i18n: agent
  { id: "review", icon: "file-diff", title: "Review", cmd: "/me:loop:claude-review-pr", ref: "loop:claude-review-pr", // i18n: agent
    alt: { cmd: "/me:loop:codex-review-pr", ref: "loop:codex-review-pr" } },
  { id: "ci", icon: "circle-check", title: "CI verte", cmd: "/me:loop:ci-until-green", ref: "loop:ci-until-green" }, // i18n: agent
  { id: "merge", icon: "git-merge", title: "Merge", cmd: "/me:merge", ref: "merge" }, // i18n: agent
  { id: "vault", icon: "archive", title: "Note vault", cmd: null, ref: null }, // i18n: agent
];
export const BRANCHES = [
  { id: "goal", icon: "layout-list", title: "Sprint", cmd: "/me:goal", ref: "goal" }, // i18n: agent
  { id: "dispatch", icon: "bot", title: "Orchestration", cmd: "/me:dispatch", ref: "dispatch" }, // i18n: agent
  { id: "release", icon: "git-pull-request", title: "Release", cmd: "/me:release", ref: "release" }, // i18n: agent
];
export const WORKFLOWS = ["issue-worktree-pr", "issue-branch-pr", "spec-issue-worktree-pr", "spec-issue-branch-pr", "goal", "dispatch", "release", "merge", "report", "check-reviews"];

// A slash command's name ("/me:goal", "me:goal") is one of the workflow's entry points: its me: command,
// or the skill a spec flow's command reads (spec-git-flow-worktree).
export function isWorkflow(name) {
  const bare = String(name ?? "").replace(/^\//, "");
  if (bare.startsWith("me:")) return WORKFLOWS.includes(bare.slice(3));
  return WORKFLOWS.some((w) => REFS[w]?.select === bare);
}
