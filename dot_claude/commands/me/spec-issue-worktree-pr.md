---
name: spec-issue-worktree-pr
description: "Workflow spec-driven Issue → Worktree (gwm) → Spec Kit (specify/plan/tasks/implement) → Commits → PR"
category: workflow
complexity: standard
argument-hint: "[description courte de la feature]"
---

Invoke the `spec-git-flow-worktree` skill via the Skill tool to handle this request end-to-end.

The skill drives the full **issue-first, spec-driven** flow: open the GitHub issue → create the `gwm` worktree on `<type>/#<issue>-<slug>` → run `speckit.specify --no-branch` / `speckit.plan` / `speckit.tasks` / `speckit.implement` inside the worktree → atomic Gitmoji/Conventional commits → push → PR → review loop. The issue number drives the branch *and* the spec directory.

Pass along the user's arguments: $ARGUMENTS
