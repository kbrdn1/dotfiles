---
name: spec-git-flow-branch
description: Spec-driven end-to-end GitHub workflow on a branch in the current checkout — opens the issue via `gh`, creates a feature branch (`<type>/#<issue>-<slug>`) from the up-to-date default branch, then runs the full Spec Kit cycle (speckit.specify → speckit.plan → speckit.tasks → speckit.implement) on it, makes atomic Gitmoji/Conventional commits referencing the issue, pushes, and opens a PR. Issue-first numbering: the GitHub issue number drives the branch AND the spec directory (`<issue>-<slug>`). Triggers on "spec issue branch PR", "speckit branch flow", "spec-driven branch", "specify then branch then implement", and any request that combines `speckit.specify`/`speckit.implement` with a feature branch (NOT a worktree). Use this skill (not `spec-git-flow-worktree`) when the spec-driven change should live in the current checkout without a worktree.
---

# spec-git-flow-branch — Issue → Branch → Spec Kit → Commits → PR

End-to-end **spec-driven** automation in the current checkout: open a GitHub issue, cut a feature branch from the up-to-date default branch, drive the feature through the Spec Kit cycle (`speckit.specify` → `speckit.plan` → `speckit.tasks` → `speckit.implement`), commit atomically, push, and open a PR — wired to the local repo's conventions.

This is the **spec-driven, branch** sibling of [[git-flow-branch]] (no spec phases) and [[spec-git-flow-worktree]] (spec-driven, isolated worktree). Use it when the spec-driven change should stay in the current checkout.

**Issue-first numbering**: the GitHub issue `#N` drives both the branch (`<type>/#N-<slug>`) and the spec directory (`N-<slug>`). Downstream Spec Kit commands resolve the feature by that shared number, so issue = branch = spec.

## When to use

- User says "spec issue → branch → PR" / "speckit flow on a branch" / "spec-driven, no worktree".
- User wants `speckit.specify`/`speckit.implement` *and* a GitHub issue/PR, directly in the current checkout.
- The feature deserves a written spec/plan/tasks, but isolation (a worktree) is not needed.

Do **not** use when: the user wants isolation in a worktree (→ [[spec-git-flow-worktree]]); or there is no need for a spec (→ [[git-flow-branch]]).

## Prerequisites

```bash
command -v gh    # GitHub CLI, authenticated (`gh auth status`)
command -v git
test -d .specify # Spec Kit installed (scripts + templates + config)
```

If `.specify/` is missing, stop and tell the user to run `/speckit.install` first (see [[speckit.install]]). Do **not** invent the scaffold.

## Workflow

The skill runs **9 steps**. After each, surface the artifact (issue #, branch, spec dir, plan/tasks paths, commit SHAs, PR URL) so the user can audit before the next.

### 0. Pre-flight (silent, before step 1)

```bash
git status --short                                # working tree MUST be clean
git branch --show-current
gh repo view --json defaultBranchRef -q .defaultBranchRef.name   # default branch
ls .github/ISSUE_TEMPLATE/ 2>/dev/null
test -f CONTRIBUTING.md && echo "has-contrib"
test -f .github/PULL_REQUEST_TEMPLATE.md && echo "has-pr-tpl"
test -f .specify/speckit.env && echo "has-speckit-env"
cat .specify/speckit.env 2>/dev/null
```

Read whichever files exist — source of truth for naming/message conventions. If `CONTRIBUTING.md` is absent, default to **Gitmoji + Conventional Commits** and branch `<type>/#<issue>-<slug>`.

**Working tree must be clean.** If dirty, stop and ask the user to stash/commit/discard first — otherwise the new branch drags in unrelated changes. If the request is ambiguous, present a plan **before step 1** and wait.

### 1. Create the GitHub issue

```bash
gh issue create \
  --title "<short imperative title>" \
  --body  "<filled body matching the template>" \
  --label "<type-label>"
```

**Capture the issue number `#N`** — it drives the branch *and* the spec directory. The body can stay lean here; step 3a optionally enriches it with the spec summary once `speckit.specify` has run.

### 2. Create the branch from the up-to-date default branch

Pick ONE `<slug>` (reused for the branch and `speckit.specify`).

```bash
DEFAULT=$(gh repo view --json defaultBranchRef -q .defaultBranchRef.name)
git fetch origin "$DEFAULT"
git checkout "$DEFAULT"
git pull --ff-only origin "$DEFAULT"

# Convention gwm-cli / SPECKIT_BRANCH_PATTERN (adapt to CONTRIBUTING.md):
git checkout -b "<type>/#<N>-<slug>"     # e.g. feat/#42-user-auth
```

⚠️ Some repos integrate on `dev` (gwm-cli) — always honor what `defaultBranchRef` returns. Show the branch name and the base it was cut from.

> **The checkout owns the branch.** It is already created — Spec Kit must NOT create another. That is why step 3a passes `--no-branch`.

### 3. Spec-driven design (on the feature branch)

#### 3a. Specify

Invoke the **`speckit.specify`** skill (via the Skill tool) with the feature description, and **instruct it that the branch already exists** so it does not touch git. Concretely, `speckit.specify` must run:

```bash
.specify/scripts/bash/create-new-feature.sh --json --no-branch --number <N> --short-name "<slug>" "<feature description>"
```

→ creates `.specify/specs/<N>-<slug>/spec.md` (+ `checklists/requirements.md`) and writes `.specify/feature.json` (resolution pointer; auto-git-ignored) — **without** `git checkout -b`. Let it run its spec-quality validation / clarification loop.

**(Optional) Enrich the issue**:

```bash
gh issue edit <N> --body "<original body + short spec summary + link to .specify/specs/<N>-<slug>/spec.md>"
```

#### 3b. Plan

Invoke **`speckit.plan`** → resolves the feature dir via the branch prefix `<N>` (falling back to `.specify/feature.json`), generates `plan.md` (+ `research.md`, `data-model.md`, `contracts/`, `quickstart.md`).

#### 3c. Tasks

Invoke **`speckit.tasks`** → generates `tasks.md` (dependency-ordered, by user story), **hydrates Claude Tasks** + a `sessions.md` entry. Optionally `speckit.analyze` first.

### 4. Implement

Invoke **`speckit.implement`** → executes `tasks.md` phase by phase, syncing each task in Claude Tasks and marking `[X]` in `tasks.md` (resume-safe), finalizing `sessions.md`.

> **(Optional) Converge loop.** Suspect drift from the spec? Invoke **`speckit.converge`** to append remaining work as new tasks, then re-run `speckit.implement`. Repeat until converged.

This step **replaces** the freeform "implement" step of [[git-flow-branch]] — code comes from the Spec Kit task plan.

### 5. Atomic commits grouped by theme

Batch **by logical theme**. Commit the **Spec Kit artifacts and the code separately**:

- `docs(spec)` — `.specify/specs/<N>-<slug>/` (spec.md, plan.md, tasks.md, research/data-model/contracts), plus `.specify/.gitignore` if `speckit.specify` just created it. *(`.specify/feature.json` is git-ignored — never commit it.)*
- `feat` / `fix` / `refactor` — the implementation
- `test` — tests
- `docs` — README / CHANGELOG / inline docs

Commit format (gwm-cli — Gitmoji + Conventional Commits):

```
<emoji> <type>(<scope>)<!>: <subject>

<optional body>

refs #N            # intermediate commits
closes #N          # ONLY on the final commit
```

Emoji↔type: ✨ feat · 🐛 fix · ♻️ refactor · ✅ test · 📝 docs · 🔧 chore · 🏗️ build · 👷 ci · ⚡ perf · 🚑️ hotfix · 🔥 chore(remove) · ⬆️ chore(bump) · 🔒 security. Breaking changes: `!` + `BREAKING CHANGE:` footer.

**Formatter drift guard.** If `format` auto-downloads its formatter, it can reformat the whole repo on version drift. After formatting: `git status`, **revert untouched files** (`git add` your files, then `git checkout -- .`). Prefer the pre-commit hook (staged-only) as the source of truth. Never ship unrelated reformats.

Show `git log --oneline @{u}..HEAD` after each commit. Never `git add -A` across multiple themes.

### 6. Push + open the PR

```bash
git push -u origin "$(git rev-parse --abbrev-ref HEAD)"
```

Read `.github/PULL_REQUEST_TEMPLATE.md` and fill **every** section honestly. Reference the spec.

```bash
gh pr create \
  --title "<emoji> <type>(<scope>): <subject>" \
  --body  "$(cat <<'EOF'
## Description

<short summary>

Closes #N

## Type of change
- [x] ✨ Feature

## Changes
- <change 1>

## Spec Kit artifacts
- Spec / Plan / Tasks: `.specify/specs/<N>-<slug>/`

## Tests
- [x] tests pass locally
- [x] lint OK

## Checklist
- [x] Branch follows `<type>/#<issue>-<slug>`
- [x] Commits follow Gitmoji + Conventional Commits
- [x] Spec / plan / tasks committed under `.specify/specs/<N>-<slug>/`

## Linked issues / docs
- Issue: #N
EOF
)"
```

If the repo targets a non-`main` integration branch (gwm-cli targets `dev`), add `--base <branch>`. **Print the final PR URL.**

### 7. Review the PR

Default review source: the **`/me:loop:codex-review-pr`** loop (local Codex CLI, self-paced — fixes relevant blocking findings P0/P1 until clean). In branch mode you are already on the feature branch in the current checkout — run it directly:

```bash
/me:loop:codex-review-pr
```

⚠️ The loop reviews the **current working dir** on the **current branch**: stay on the PR branch (no checkout back to `main`/`dev`) before launching. As a secondary, on-demand step the user triggers `/me:check-reviews [PR#]` manually. See [[check-reviews]].

## Output expected at each step

| Step | Surface to user                                          |
|:-----|:---------------------------------------------------------|
| 0    | Default branch + conventions + speckit.env (one-liner)   |
| 1    | Issue URL + `#N`                                          |
| 2    | Branch name + base it was cut from                       |
| 3a   | Spec dir path + checklist result                         |
| 3b   | plan.md path + generated artifacts                       |
| 3c   | tasks.md path + task/hydration summary                   |
| 4    | Implementation summary (phases, tasks completed)         |
| 5    | `git log --oneline @{u}..HEAD`                           |
| 6    | Push confirmation + PR URL                               |

## Guardrails

- ⚠️ **Stop and re-plan** if the request is ambiguous.
- ⚠️ **Never** commit directly to `main`/`master`/`dev` — a feature branch is mandatory.
- ⚠️ **Working tree must be clean** at step 0 — refuse to start otherwise.
- ⚠️ Always branch from the up-to-date default branch (`git pull --ff-only` before `git checkout -b`).
- ⚠️ **The checkout owns the branch.** `speckit.specify` MUST run with `--no-branch` — never let it cut a second branch.
- ⚠️ **Issue-first numbering**: pass `--number <N>` so spec dir prefix = branch prefix = `#N`.
- ⚠️ **Never** commit `.specify/feature.json` (git-ignored). **Do** commit `spec.md` / `plan.md` / `tasks.md`.
- ⚠️ `.specify/` missing → stop, run `/speckit.install`.
- ⚠️ Never squash; never delete the source branch on merge.
- ⚠️ Each intermediate commit uses `refs #N`; **only the last** uses `closes #N`.
- ⚠️ A repo-wide `format` can drag unrelated reformats (version drift) — revert them before committing.

## Fallbacks when the repo lacks conventions

| Missing                            | Fallback                                                              |
|:-----------------------------------|:---------------------------------------------------------------------|
| `.github/ISSUE_TEMPLATE/`          | Plain `gh issue create --title --body` with a sensible Markdown body |
| `CONTRIBUTING.md`                  | Branch `<type>/#<issue>-<slug>`, Gitmoji + Conventional Commits      |
| `.github/PULL_REQUEST_TEMPLATE.md` | Body = `## Summary` + bullets + `Closes #N` + spec link + test plan  |
| Custom default branch              | Trust `gh repo view --json defaultBranchRef`                         |
| `.specify/speckit.env`             | Spec Kit defaults (`feat/#{number}-{slug}`, `.specify/specs`, …)     |

## Related skills

- [[git-flow-branch]] — same branch flow, **without** the Spec Kit phases.
- [[spec-git-flow-worktree]] — same spec-driven flow, isolated in a `gwm` worktree.
- [[speckit.specify]] · [[speckit.plan]] · [[speckit.tasks]] · [[speckit.implement]] · [[speckit.converge]] — the Spec Kit cycle invoked in steps 3–4.
- [[speckit.install]] — bootstraps `.specify/` into a repo (prerequisite).
- `/me:spec-issue-branch-pr` — explicit slash command for this exact flow.
