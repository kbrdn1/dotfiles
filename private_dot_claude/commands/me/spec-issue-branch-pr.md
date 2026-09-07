---
name: spec-issue-branch-pr
description: "Workflow spec-driven Issue → Branche → Spec Kit (specify/plan/tasks/implement) → Commits → PR (sans worktree)"
category: workflow
complexity: standard
argument-hint: "[description courte de la feature]"
---

Invoke the `spec-git-flow-branch` skill via the Skill tool to handle this request end-to-end.

The skill drives the full **issue-first, spec-driven** flow in the current checkout: open the GitHub issue → cut `<type>/#<issue>-<slug>` from the up-to-date default branch → run `speckit.specify --no-branch` / `speckit.plan` / `speckit.tasks` / `speckit.implement` → atomic Gitmoji/Conventional commits → push → PR → review loop. The issue number drives the branch *and* the spec directory.

Pass along the user's arguments: $ARGUMENTS
