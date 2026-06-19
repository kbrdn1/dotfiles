---
name: spec-git-flow-worktree
description: Spec-driven end-to-end GitHub workflow in an isolated git worktree — opens the issue via `gh`, creates a clean worktree with `gwm`, then runs the full Spec Kit cycle (speckit.specify → speckit.plan → speckit.tasks → speckit.implement) inside it, makes atomic Gitmoji/Conventional commits referencing the issue, pushes, and opens a PR. Issue-first numbering: the GitHub issue number drives the branch (`<type>/#<issue>-<slug>`) AND the spec directory (`<issue>-<slug>`). Triggers on "spec issue worktree PR", "speckit worktree flow", "spec-driven worktree", "specify then worktree then implement", and any request that combines `speckit.specify`/`speckit.implement` with `gwm` + `gh issue`. Use this skill (not `spec-git-flow-branch`) whenever the spec-driven change should live in an isolated worktree rather than the current checkout.
---

# spec-git-flow-worktree — Issue → Worktree → Spec Kit → Commits → PR

End-to-end **spec-driven** automation: open a GitHub issue, spin up a clean worktree with `gwm`, drive the feature through the Spec Kit cycle (`speckit.specify` → `speckit.plan` → `speckit.tasks` → `speckit.implement`) inside the worktree, commit atomically, push, and open a PR — all wired to the local repo's conventions.

This is the **spec-driven, worktree** sibling of [[git-flow-worktree]] (no spec phases) and [[spec-git-flow-branch]] (spec-driven, no worktree). Use it for features worth a written spec/plan/tasks that you also want isolated from your main checkout.

**Issue-first numbering** is the whole design: the GitHub issue `#N` drives both the branch (`<type>/#N-<slug>`, created by `gwm`) and the spec directory (`N-<slug>`, created by `speckit.specify`). Downstream Spec Kit commands resolve the feature by that shared number, so issue = branch = spec.

## When to use

- User says "spec issue → worktree → PR" / "speckit flow in a worktree" / "spec-driven with isolation".
- User wants `speckit.specify`/`speckit.implement` *and* `gwm` *and* a GitHub issue/PR in one flow.
- The feature is substantial enough to deserve a spec + plan + tasks, and CI / parallel PRs need the main checkout free.

Do **not** use when: the user wants the spec-driven change on the current checkout (→ [[spec-git-flow-branch]]); or there is no need for a spec at all (→ [[git-flow-worktree]]).

## Prerequisites

```bash
command -v gh    # GitHub CLI, authenticated (`gh auth status`)
command -v gwm   # https://github.com/kbrdn1/gwm-cli — see [[gwm]] skill
command -v git
test -d .specify # Spec Kit installed in this repo (scripts + templates + config)
```

- If `gwm` is missing, stop and tell the user to install it (`cargo install --path .` from gwm-cli, or a release binary). Do **not** fall back to bare `git worktree add` — the `.gwm.toml` bootstrap is the point.
- If `.specify/` is missing, stop and tell the user to run `/speckit.install` first (see [[speckit.install]]). Do **not** invent the scaffold.

## Workflow

The skill runs **10 steps**. After each, surface the artifact (issue #, branch, worktree path, spec dir, plan/tasks paths, commit SHAs, PR URL) so the user can audit before the next.

### 0. Pre-flight (silent, before step 1)

```bash
ls .github/ISSUE_TEMPLATE/ 2>/dev/null            # issue templates
test -f CONTRIBUTING.md && echo "has-contrib"     # branch/commit conventions
test -f .github/PULL_REQUEST_TEMPLATE.md && echo "has-pr-tpl"
test -f .gwm.toml && echo "has-gwm-config"        # bootstrap will run
test -f .specify/speckit.env && echo "has-speckit-env"
cat .specify/speckit.env 2>/dev/null              # branch/spec patterns, paths
```

Read whichever files exist — they are the source of truth for naming/message conventions. If `CONTRIBUTING.md` is absent, default to **Gitmoji + Conventional Commits** and branch `<type>/#<issue>-<slug>`. If the request is ambiguous (no clear scope/type, multiple interpretations), present a plan **before step 1** and wait.

### 1. Create the GitHub issue

Pick the right template from `.github/ISSUE_TEMPLATE/` (or skip if none fits) and create the issue:

```bash
gh issue create \
  --title "<short imperative title>" \
  --body  "<filled body matching the template>" \
  --label "<type-label>"        # e.g. feature, fix, docs
```

**Capture the issue number `#N`** from the printed URL — it drives the branch *and* the spec directory. The body can stay lean here; step 4a optionally enriches it with the spec summary once `speckit.specify` has run.

### 2. Decide the branch name + a single shared slug

Read `CONTRIBUTING.md` for the exact convention; the default (matches gwm-cli + `SPECKIT_BRANCH_PATTERN`):

```
<type>/#<issue>-<short-kebab-slug>     e.g. feat/#42-user-auth
```

Allowed types (gwm defaults): `feat`, `fix`, `hotfix`, `docs`, `test`, `refactor`, `chore`, `perf`, `ci`, `build`.

**Pick ONE `<slug>` now and reuse it for both `gwm` and `speckit.specify`** so the branch (`feat/#42-user-auth`) and the spec dir (`42-user-auth`) carry the same name. (Resolution only needs the shared number `42`, but a matching slug keeps things clean.)

### 3. Create the worktree with gwm

```bash
gwm create <type> <N> <slug>          # e.g. gwm create feat 42 user-auth
cd "$(gwm path <slug>)"               # work here for ALL subsequent steps
git status                            # MUST be clean
git rev-parse --abbrev-ref HEAD       # MUST be <type>/#<N>-<slug>
```

`gwm` creates the branch + worktree and runs the `.gwm.toml` bootstrap (`copy` / `guard` / `no_symlink` / `command`). If the bootstrap report shows any `✗`, **stop** and surface the failed steps — do not build on a broken bootstrap. See [[gwm]] for the schema and sigils (`✓ · ! ✗`).

> **gwm owns the branch.** It is already created and checked out — Spec Kit must NOT create another. That is why step 4a passes `--no-branch`.

### 4. Spec-driven design (inside the worktree)

#### 4a. Specify

Invoke the **`speckit.specify`** skill (via the Skill tool) with the feature description, and **instruct it that the branch already exists** so it does not touch git. Concretely, `speckit.specify` must run:

```bash
.specify/scripts/bash/create-new-feature.sh --json --no-branch --number <N> --short-name "<slug>" "<feature description>"
```

→ creates `.specify/specs/<N>-<slug>/spec.md` (+ `checklists/requirements.md`) and writes `.specify/feature.json` (the resolution pointer; auto-git-ignored) — **without** running `git checkout -b`. Let it run its spec-quality validation / clarification loop as usual.

**(Optional) Enrich the issue** once the spec exists, so the issue reflects the agreed scope:

```bash
gh issue edit <N> --body "<original body + a short spec summary + link to .specify/specs/<N>-<slug>/spec.md>"
```

#### 4b. Plan

Invoke **`speckit.plan`**. It runs `setup-plan.sh`, resolves the feature dir via the branch prefix `<N>` (falling back to `.specify/feature.json`), and generates `plan.md` (+ `research.md`, `data-model.md`, `contracts/`, `quickstart.md` as applicable).

#### 4c. Tasks

Invoke **`speckit.tasks`**. It generates `tasks.md` (dependency-ordered, by user story) **and hydrates Claude Tasks** + a `sessions.md` entry. Optionally run `speckit.analyze` first for cross-artifact consistency.

### 5. Implement

Invoke **`speckit.implement`**. It executes `tasks.md` phase by phase, syncing each task's status in Claude Tasks and marking `[X]` in `tasks.md` (resume-safe), and finalizes the `sessions.md` log.

> **(Optional) Converge loop.** If you suspect the implementation drifted from the spec, invoke **`speckit.converge`** to append any remaining work as new tasks, then re-run `speckit.implement`. Repeat until converged.

This step **replaces** the freeform "implement" step of [[git-flow-worktree]] — the code is produced by the Spec Kit task plan, not ad hoc.

### 6. Atomic commits grouped by theme

Batch changes **by logical theme**, not by file or chronology. Commit the **Spec Kit artifacts and the code separately**:

- `docs(spec)` — `.specify/specs/<N>-<slug>/` (spec.md, plan.md, tasks.md, research/data-model/contracts), plus `.specify/.gitignore` if `speckit.specify` just created it. *(Note: `.specify/feature.json` is git-ignored — never commit it.)*
- `feat` / `fix` / `refactor` — the implementation itself
- `test` — tests for the new capability
- `docs` — README / CHANGELOG / inline docs

Commit format (gwm-cli — Gitmoji + Conventional Commits):

```
<emoji> <type>(<scope>)<!>: <subject>

<optional body>

refs #N            # intermediate commits
closes #N          # ONLY on the final commit
```

Emoji↔type: ✨ feat · 🐛 fix · ♻️ refactor · ✅ test · 📝 docs · 🔧 chore · 🏗️ build · 👷 ci · ⚡ perf · 🚑️ hotfix · 🔥 chore(remove) · ⬆️ chore(bump) · 🔒 security. Breaking changes: `!` + `BREAKING CHANGE:` footer.

**Formatter drift guard.** If the repo's `format` auto-downloads its formatter (Mago, Prettier, Biome…), it can reformat the **whole repo** when the version differs from the branch's. After formatting: `git status`, and **revert every file you did not touch** (`git add` your real files, then `git checkout -- .`). A pre-commit hook that formats only staged files is the safer source of truth. Never ship unrelated reformats in a feat/fix PR.

Show `git log --oneline @{u}..HEAD` after each commit. Stage hunks deliberately — never `git add -A` if the diff spans multiple themes.

### 7. Push

```bash
git push -u origin "$(git rev-parse --abbrev-ref HEAD)"
```

The `-u` is required on first push (branch created locally by `gwm`).

### 8. Open the PR

Read `.github/PULL_REQUEST_TEMPLATE.md` and fill **every** section honestly (don't tick a test box you didn't run). Reference the spec.

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

### 9. Review the PR

Default review source: the **`/me:loop:codex-review-pr`** loop (local Codex CLI, self-paced — fixes relevant blocking findings P0/P1 until clean). Run it **from inside the worktree**, never the main checkout:

```bash
cd "$(gwm path <slug>)"   # MANDATORY before review
/me:loop:codex-review-pr
```

As a secondary, on-demand step the user triggers `/me:check-reviews [PR#]` manually. Tools that read the working tree must run from the worktree (the main checkout may hold unrelated untracked work → review noise). See [[check-reviews]].

## Output expected at each step

| Step | Surface to user                                          |
|:-----|:---------------------------------------------------------|
| 0    | Detected templates + conventions + speckit.env (one-liner) |
| 1    | Issue URL + `#N`                                          |
| 2    | Branch name + shared slug + convention source            |
| 3    | Worktree path + bootstrap report (verbatim)              |
| 4a   | Spec dir path + checklist result                         |
| 4b   | plan.md path + generated artifacts                       |
| 4c   | tasks.md path + task/hydration summary                   |
| 5    | Implementation summary (phases, tasks completed)         |
| 6    | `git log --oneline @{u}..HEAD`                           |
| 7    | Push confirmation                                        |
| 8    | PR URL                                                   |

## Guardrails

- ⚠️ **Stop and re-plan** if the request is ambiguous — do not invent a scope.
- ⚠️ **gwm owns the branch.** `speckit.specify` MUST run with `--no-branch` — never let it `git checkout -b` a second branch.
- ⚠️ **Issue-first numbering**: pass `--number <N>` (the issue number) to `speckit.specify` so spec dir prefix = branch prefix = `#N`.
- ⚠️ **Never** commit `.specify/feature.json` (git-ignored runtime pointer). **Do** commit `spec.md` / `plan.md` / `tasks.md`.
- ⚠️ `.specify/` missing → stop, run `/speckit.install`. `gwm` missing → stop, install it. Bootstrap `✗` → stop.
- ⚠️ **Never** push to `main`/`master`/`dev` directly; never squash; never delete the source branch on merge.
- ⚠️ Each intermediate commit uses `refs #N`; **only the last** uses `closes #N`.
- ⚠️ A repo-wide `format` can drag unrelated reformats (version drift) — revert them before committing.
- ⚠️ AI review that reads the working tree runs **from the worktree**, never the main checkout.

## Fallbacks when the repo lacks conventions

| Missing                            | Fallback                                                              |
|:-----------------------------------|:---------------------------------------------------------------------|
| `.github/ISSUE_TEMPLATE/`          | Plain `gh issue create --title --body` with a sensible Markdown body |
| `CONTRIBUTING.md`                  | Branch `<type>/#<issue>-<slug>`, Gitmoji + Conventional Commits      |
| `.github/PULL_REQUEST_TEMPLATE.md` | Body = `## Summary` + bullets + `Closes #N` + spec link + test plan  |
| `.gwm.toml`                        | `gwm create` still works (no bootstrap); warn the user it's bare     |
| `.specify/speckit.env`             | Spec Kit defaults (`feat/#{number}-{slug}`, `.specify/specs`, …)     |

## Related skills

- [[git-flow-worktree]] — same worktree flow, **without** the Spec Kit phases.
- [[spec-git-flow-branch]] — same spec-driven flow on the current checkout (no worktree).
- [[gwm]] — the worktree manager: `.gwm.toml` schema, TUI, troubleshooting.
- [[speckit.specify]] · [[speckit.plan]] · [[speckit.tasks]] · [[speckit.implement]] · [[speckit.converge]] — the Spec Kit cycle invoked in steps 4–5.
- [[speckit.install]] — bootstraps `.specify/` into a repo (prerequisite).
- `/me:spec-issue-worktree-pr` — explicit slash command for this exact flow.
