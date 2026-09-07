---
name: git-flow-branch
description: End-to-end GitHub workflow on a branch in the current checkout — opens the issue via `gh`, creates a feature branch from the up-to-date default branch, makes atomic Gitmoji/Conventional commits referencing the issue, pushes, and opens a PR filled from the repo's PR template. Triggers on "issue + branch + PR", "full git flow", "issue to PR", "open issue then branch then PR", "create branch and PR", and any request that combines `gh issue create` with a feature branch (NOT a worktree). Auto-detects `.github/ISSUE_TEMPLATE/`, `CONTRIBUTING.md`, and `.github/PULL_REQUEST_TEMPLATE.md` and adapts to local conventions; falls back to Gitmoji + Conventional Commits when no convention file is found. Use this skill (not `git-flow-worktree`) when the user wants the change directly in the current checkout without spinning up a worktree.
allowed-tools: Bash, Read, Glob, Write
---

# git-flow-branch — Issue → Branch → Commits → PR

End-to-end automation in the current checkout: open a GitHub issue, branch from the up-to-date default branch, implement, commit atomically, push, and open a PR — wired to the repo's conventions (issue templates, `CONTRIBUTING.md`, PR template).

This skill is the no-worktree sibling of [[git-flow-worktree]]. Use it when the user wants to work directly in the current checkout (typical for small PRs, hotfixes, docs, or when a worktree would be overkill).

## When to use

- User says "ouvre une issue puis une branche puis une PR" / "issue → branch → PR" / "full flow without worktree".
- User mentions `gh issue` + `git checkout -b` together.
- User wants the change on a branch in the current working tree, not isolated in a worktree.

Do **not** use when the user wants an isolated worktree (with `.gwm.toml` bootstrap, env copies, dep install) — that is [[git-flow-worktree]].

## Prerequisites

```bash
command -v gh    # GitHub CLI, authenticated (`gh auth status`)
command -v git
```

## Workflow

The skill runs **steps 0 → 5** (the last one, the vault note, fires only once the PR is merged). After each, surface the artifact (issue number, branch name, commit SHAs, PR URL) so the user can audit.

### 0. Pre-flight (silent, before step 1)

```bash
ls .github/ISSUE_TEMPLATE/ 2>/dev/null
test -f CONTRIBUTING.md && echo "has-contrib"
test -f .github/PULL_REQUEST_TEMPLATE.md && echo "has-pr-tpl"
git status --short                                   # MUST be clean
git rev-parse --abbrev-ref HEAD                       # current branch
gh repo view --json defaultBranchRef -q .defaultBranchRef.name   # → "main" or "master"
```

Read whichever convention files exist. If `CONTRIBUTING.md` is absent, default to **Gitmoji + Conventional Commits** and branch pattern `<type>/<#issue>-<slug>`.

**If the working tree is dirty, stop** and ask the user to stash / commit / discard before starting the flow — otherwise the new branch will carry unrelated changes.

If the request is ambiguous, present a plan and wait for confirmation before step 1.

### 1. Create the GitHub issue

Pick the right template from `.github/ISSUE_TEMPLATE/` (or skip if none fits):

```bash
gh issue create \
  --title "<short imperative title>" \
  --body  "<filled body matching the template>" \
  --label "<type-label>"
```

For YAML form-based templates that don't translate cleanly to `--body`, prefer crafting a Markdown body that mirrors the template sections. Use `--web` only if interactive input is unavoidable.

**Capture the issue number** from the URL — every subsequent step references `#N`.

### 2. Create the branch

Update the default branch first, then branch from it:

```bash
DEFAULT=$(gh repo view --json defaultBranchRef -q .defaultBranchRef.name)
git fetch origin "$DEFAULT"
git checkout "$DEFAULT"
git pull --ff-only origin "$DEFAULT"

# Convention (gwm-cli default — adapt per CONTRIBUTING.md):
#   <type>/#<issue>-<short-kebab-description>
git checkout -b "<type>/#<N>-<slug>"
```

Allowed types (gwm-cli default — confirm against `CONTRIBUTING.md`): `feat`, `fix`, `hotfix`, `docs`, `test`, `refactor`, `chore`, `perf`, `ci`, `build`.

Some repos use `dev` instead of `main` as the integration branch (the current gwm-cli repo does — see `git log` recent commits on `dev`). Honor whatever `defaultBranchRef` points to.

### 3. Implement + atomic commits grouped by theme

Batch changes **by logical theme**, not by file or chronology. One commit per concern:

- `refactor` — restructuring with no behaviour change
- `feat` — the new capability itself
- `test` — tests for the new capability
- `docs` — README / CHANGELOG / inline doc updates

Commit format (gwm-cli convention — Gitmoji + Conventional Commits):

```
<emoji> <type>(<scope>)<!>: <subject>

<optional body>

refs #N            # for intermediate commits
closes #N          # ONLY on the final commit
```

Emoji ↔ type map (gwm-cli `CONTRIBUTING.md`):

| Emoji | Type       | Emoji | Type             |
|:------|:-----------|:------|:-----------------|
| ✨    | feat       | ♻️    | refactor         |
| 🐛    | fix        | ⚡    | perf             |
| 🚑️   | hotfix     | ✅    | test             |
| 📝    | docs       | 🔧    | chore            |
| 🏗️    | build      | 👷    | ci               |
| 🔥    | chore (remove) | ⬆️ | chore (bump deps) |
| 🔒    | security   |       |                  |

Scopes (gwm-cli): `config`, `naming`, `worktree`, `bootstrap`, `cli`, `tui`, `tests`, `docs`, `ci`, `structure`. Adapt per repo.

Breaking changes use `!` suffix and a `BREAKING CHANGE:` footer.

If `/sc:git` is available and the user wants it, delegate commit grouping to it. Otherwise, stage hunks deliberately — never `git add -A` if the diff spans multiple themes.

**Formatter drift guard.** If the repo's format command auto-downloads its formatter (e.g. `composer format` fetching the latest Mago, `bun`/`npm` pulling a newer Prettier/Biome), running it can reformat the **entire repo** when that version differs from the one that last formatted the branch. After formatting, check `git status` and **revert every file you did not touch** (`git add` your real files, then `git checkout -- .`). A `fix`/`feat` PR must never carry unrelated reformatted files. Prefer the repo's **pre-commit hook** (formats only staged files) over a manual repo-wide `format`.

### 4. Push + open the PR

```bash
git push -u origin "$(git rev-parse --abbrev-ref HEAD)"
```

Read `.github/PULL_REQUEST_TEMPLATE.md` and fill **every** section. Tick boxes honestly — do not claim tests passed if you didn't run them.

```bash
gh pr create \
  --title "<emoji> <type>(<scope>): <subject>" \
  --body  "$(cat <<'EOF'
## Description

<short summary>

Closes #N

## Type of change

- [x] ✨ Feature
...

## Changes

- <change 1>

## Tests

- [x] tests pass locally
...

## Checklist

- [x] Branch follows `<type>/#<issue>-<description>`
- [x] Commits follow Gitmoji + Conventional Commits
- [x] CHANGELOG.md updated under `## [Unreleased]`
...

## Linked issues / docs

- Issue: #N
EOF
)"
```

If the repo's default PR base is not `main` (e.g. gwm-cli targets `dev` for feature PRs — see `.github/dependabot.yml`), add `--base <branch>`:

```bash
gh pr create --base dev --title "..." --body "..."
```

**Print the final PR URL** so the user can click through.

### 4 bis. Review, then CI — *this step was missing from this skill until 2026-09-07*

Every other flow (`git-flow-worktree`, both `spec-git-flow-*`) gates the PR before merge; this one went straight from "PR opened" to "note at merge". It no longer does.

**Review — default source: `/me:loop:claude-review-pr`.** A Claude agent spawned with **fresh** context (never `fork`), self-paced, two non-communicating axes (`standards` / `spec`), fixing relevant blocking findings P0/P1/P2 until clean. In branch mode you are already on the feature branch in the current checkout, so run it directly:

```
/me:loop:claude-review-pr
```

⚠️ The loop reviews the **current working dir** on the **current branch** — stay on the PR branch, no checkout back to `main`/`dev` before launching, or it reviews the wrong tree.

For a **sensitive PR** (security, money, multi-tenant isolation, data migration), double up with `/me:loop:codex-review-pr` (local Codex CLI — a **third-party** reviewer with different blind spots; the Claude reviewer shares mine). As a secondary, on-demand step, the user manually triggers `/me:check-reviews [PR#]`.

**Then CI: `/me:loop:ci-until-green`.** It reads the checks for the **exact SHA** of `HEAD` (not "the branch"), refuses to conclude while anything is unpushed, and never reads "zero checks" as a green CI. Do not merge before `CI_FAILED=0 CI_PENDING=0` with `CI_TOTAL ≥ 1`.

🔴 Never make CI green by disabling a job, adding `continue-on-error`, skipping a test or blind-rerunning — a blind CI is worse than a red one.

### 5. The vault note — **at merge, not at commit**

Once the PR is **merged**, write one note. This is the only moment where the context is fresh
and git does not keep it: why this solution, what the review caught that matters beyond the PR,
what was deferred. `RULES.md` mandates it; nothing else in this flow produces it.

**Which vault** — by subject: Jewely / Flippad / clients → `~/Vault/pro`, personal projects →
`~/Vault/perso`.

**Which template** — the options table decides:

| The PR was… | Template | Where |
|:---|:---|:---|
| an arbitration — options were weighed | `Template — Décision.md` | `<entity>/decisions/` |
| a lesson — no options, something you had not seen | `Template — Retex.md` | `<entity>/decisions/` |

Read the template first (`~/Vault/<vault>/99 - Meta/Template — *.md`) and the vault's
`AGENTS.md` for placement and frontmatter. Write with `Write` at the vault path — do not depend
on the tolaria MCP, its sidecar breaks after every app auto-update.

```bash
VAULT=~/Vault/pro                      # or perso
ls "$VAULT/99 - Meta/"                 # the templates
cat "$VAULT/AGENTS.md"                 # placement + frontmatter rules
```

⛔ **Never** put in the note: the changelog, repo technical documentation, a task, a procedure.
Those already have a place of truth (`changelogs/`, `<repo>/docs/` via graphify, GitHub issues,
`~/.claude/skills/me/*`). The vault died once because it duplicated git. Quote every string
value in the frontmatter — one unquoted value containing `:` or `#` breaks tolaria's YAML parser
across the whole vault.

If the lesson holds **beyond this repo**, it is promoted to `04 - Permanent/` (perso) or one
level up (pro) — the retex stays where it is and links to it.

## Output expected at each step

| Step | Surface to user                                       |
|:-----|:------------------------------------------------------|
| 0    | Detected templates + conventions + default branch     |
| 1    | Issue URL + number `#N`                                |
| 2    | New branch name + base it was cut from                 |
| 3    | Commit list (`git log --oneline @{u}..HEAD`)           |
| 4    | Push confirmation + PR URL                             |
| 5    | Vault note path + which template was used              |

## Guardrails

- ⚠️ **Stop and re-plan** if the request is ambiguous.
- ⚠️ **Never** commit directly to `main` / `master` / `dev` (integration branches). A feature branch is mandatory.
- ⚠️ **Working tree must be clean** at step 0 — refuse to start otherwise.
- ⚠️ **Never** squash, never delete the source branch on merge (gwm-cli `CONTRIBUTING.md` is explicit).
- ⚠️ **Never** invent an issue template body — if no template fits, write a clean Markdown body but say so.
- ⚠️ Each intermediate commit uses `refs #N`; **only the last** uses `closes #N`.
- ⚠️ A repo-wide `format` can reformat files outside your change (formatter version drift) — revert unrelated reformats before committing; never ship them in a fix/feat PR.
- ⚠️ Always branch from the up-to-date default branch (`git pull --ff-only` before `git checkout -b`).

## Fallbacks when the repo lacks conventions

| Missing                              | Fallback                                                                 |
|:-------------------------------------|:-------------------------------------------------------------------------|
| `.github/ISSUE_TEMPLATE/`            | Plain `gh issue create --title --body` with a sensible Markdown body     |
| `CONTRIBUTING.md`                    | Branch `<type>/#<issue>-<slug>`, Gitmoji + Conventional Commits          |
| `.github/PULL_REQUEST_TEMPLATE.md`   | Body = `## Summary` + bullets + `Closes #N` + `## Test plan` checklist   |
| Custom default branch                | Trust `gh repo view --json defaultBranchRef`                              |

## Related skills

- [[git-flow-worktree]] — same workflow, isolated in a `gwm` worktree.
- [[gwm]] — the worktree manager (only relevant if the user switches to the worktree variant).
- `/me:issue-branch-pr` — explicit slash command for this exact flow.
