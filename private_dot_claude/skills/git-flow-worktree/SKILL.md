---
name: git-flow-worktree
description: End-to-end GitHub workflow with an isolated git worktree — opens the issue via `gh`, creates a clean worktree with `gwm`, makes atomic Gitmoji/Conventional commits referencing the issue, pushes, and opens a PR filled from the repo's PR template. Triggers on "issue + worktree + PR", "gwm create", "isolated worktree workflow", "feat/#", "fix/#", "issue to PR with worktree", "full git flow worktree", "open issue then worktree then PR", and any request that combines `gh issue create` with `gwm`. Auto-detects `.github/ISSUE_TEMPLATE/`, `CONTRIBUTING.md`, and `.github/PULL_REQUEST_TEMPLATE.md` in the current repo and adapts to local conventions; falls back to Gitmoji + Conventional Commits when no convention file is found. Use this skill (not `git-flow-branch`) whenever the user wants the change to live in a worktree rather than a checkout of the current repo.
allowed-tools: Bash, Read, Glob, Write
---

# git-flow-worktree — Issue → Worktree → Commits → PR

End-to-end automation: open a GitHub issue, spin up a clean worktree with `gwm`, implement, commit atomically, push, and open a PR — all wired together with the local repo's conventions (issue templates, `CONTRIBUTING.md`, PR template).

This skill is the worktree-aware sibling of [[git-flow-branch]]. Use it when the user wants the change isolated from their main checkout (typical for long-running features, when CI needs the main checkout free, or when several PRs are in flight in the same repo).

## When to use

- User says "ouvre une issue puis un worktree puis une PR" / "issue → worktree → PR" / "full flow with worktree".
- User mentions `gwm create` together with `gh issue` or a PR.
- User asks for an isolated work environment per issue (so `main` stays untouched).
- User wants the repo's `.github/ISSUE_TEMPLATE/` + `CONTRIBUTING.md` + PR template enforced automatically.

Do **not** use when the user just wants a branch on the current checkout — that is [[git-flow-branch]].

## Prerequisites

```bash
command -v gh    # GitHub CLI, authenticated (`gh auth status`)
command -v gwm   # https://github.com/kbrdn1/gwm-cli — see [[gwm]] skill
command -v git
```

If `gwm` is missing, stop and instruct the user to install it (`cargo install --path .` from the gwm-cli repo, or grab a release binary). Do **not** silently fall back to plain `git worktree add` — the bootstrap (`.gwm.toml`) is the whole point of using the worktree variant.

## Workflow

The skill runs through **steps 0 → 8** (the last one, the vault note, fires only once the PR is merged). After each step, surface the artifact (issue number, branch name, worktree path, commit SHAs, PR URL) so the user can audit before the next step.

### 0. Pre-flight (silent, before step 1)

Detect what the repo provides:

```bash
ls .github/ISSUE_TEMPLATE/ 2>/dev/null            # → issue templates available
test -f CONTRIBUTING.md && echo "has-contrib"     # → branch/commit conventions
test -f .github/PULL_REQUEST_TEMPLATE.md && echo "has-pr-tpl"
test -f .gwm.toml && echo "has-gwm-config"        # → bootstrap will run
```

Read whichever of these files exist. They are the source of truth for naming and message conventions in this repo. If `CONTRIBUTING.md` is absent, default to **Gitmoji + Conventional Commits** and branch pattern `<type>/<#issue>-<slug>`.

If the request is ambiguous (no clear feature scope, no type, multiple plausible interpretations), present a plan **before step 1** and wait for confirmation.

### 1. Create the GitHub issue

Pick the right template from `.github/ISSUE_TEMPLATE/` (or skip the template if none fits). For the gwm-cli-style templates (`bug_report.yml`, `feature_request.yml`, `task.yml`):

```bash
gh issue create \
  --title "<short imperative title>" \
  --body  "<filled body matching the template>" \
  --label "<type-label>"                                # e.g. feature, fix, docs
```

If the template is YAML form-based (`.yml`), prefer `gh issue create --web` only if interactive input is unavoidable; otherwise emit the body in Markdown matching the template's sections.

**Capture the issue number** from the URL printed by `gh` (last segment). All subsequent steps reference `#N`.

### 2. Decide the branch name

Read `CONTRIBUTING.md` for the exact convention. The default (matches gwm-cli's `CONTRIBUTING.md`):

```
<type>/#<issue>-<short-kebab-description>
```

Examples: `feat/#42-tui-search`, `fix/#17-locked-worktree-detection`, `docs/#3-update-readme`.

Allowed types (gwm defaults): `feat`, `fix`, `hotfix`, `docs`, `test`, `refactor`, `chore`, `perf`, `ci`, `build`.

### 3. Create the worktree with gwm

```bash
gwm create <type> <issue-number> <kebab-description>
# example
gwm create feat 42 tui-search
```

`gwm create` does:
1. Creates the branch with the repo's `branch_pattern` (defaults to `<type>/#<issue>-<desc>`).
2. Creates the worktree under `base` (default `~/cc-worktree/<repo>/`) with `path_pattern`.
3. Runs the `.gwm.toml` bootstrap: `[[bootstrap.copy]]` (e.g. `.env.testing` with inline fallback), `[[bootstrap.guard]]` (e.g. AWS RDS deny-list), `[[bootstrap.no_symlink]]` (e.g. `vendor/`, `node_modules/`), then `[[bootstrap.command]]` (e.g. `composer install`, `npm ci`, `direnv allow`).

**Cd into the worktree** for all subsequent commands:

```bash
cd "$(gwm path <kebab-description>)"
git status         # MUST be clean
git rev-parse --abbrev-ref HEAD   # MUST be the new branch
```

If the bootstrap report has any `✗`, stop and surface the failed steps to the user — do **not** start implementing on top of a broken bootstrap.

**Attach this session to the new worktree** (`gwm agents`, gwm ≥ 1.3.0). The session was started from the main checkout — usually on `dev` — so gwm attributes it *there*, and the worktree it actually works in shows no agent. A pin is exactly the case `attach` exists for: it overlays detection when the recorded directory cannot be right.

```bash
# Claude Code exports the exact session id — no guessing from `gwm agents` output.
gwm agents attach <slug> "$CLAUDE_CODE_SESSION_ID"
```

Best-effort: if the variable is empty, skip it — `~/.claude/scripts/statusline.ts` pins the session by itself as soon as it edits a file inside the worktree, so a missed pin costs a turn of visibility in `gwm agents` / the TUI, nothing more. Pins accumulate, so re-running is safe; `gwm agents detach <slug>` clears them.


See the [[gwm]] skill for the full `.gwm.toml` schema, bootstrap sigils (`✓ · ! ✗`), and TUI keys.

### 4. Implement + atomic commits grouped by theme

While implementing, batch changes **by logical theme**, not by file or chronology. One commit per concern:

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

Scopes (gwm-cli): `config`, `naming`, `worktree`, `bootstrap`, `cli`, `tui`, `tests`, `docs`, `ci`, `structure`. Adapt to whatever scopes `CONTRIBUTING.md` lists for the current repo.

Breaking changes use `!` suffix and a `BREAKING CHANGE:` footer.

If `/sc:git` is available and the user wants it, delegate the commit grouping to it. Otherwise, stage hunks deliberately (`git add -p` mentally — never `git add -A` if the diff spans multiple themes) and commit each theme separately.

**Formatter drift guard.** If the repo's format command auto-downloads its formatter (e.g. `composer format` fetching the latest Mago, `bun`/`npm` pulling a newer Prettier/Biome), running it can reformat the **entire repo** — not just your files — whenever that version differs from the one that last formatted the branch. Before committing: run the formatter, then `git status`, and **revert every file you did not actually touch** (`git add` your real files first, then `git checkout -- .`). A `fix`/`feat` PR must never drag dozens of unrelated reformatted files into its diff. Many repos already enforce formatting via a **pre-commit hook** that formats only the staged files — that hook is the safer source of truth, so a manual repo-wide `format` is often redundant *and* riskier. (Seen on `fiches-pedagogiques-api-rest`: `composer format` pulled Mago 1.29 and reformatted 40+ unrelated files.)

### 5. Push

```bash
git push -u origin "$(git rev-parse --abbrev-ref HEAD)"
```

The `-u` is required on first push — the branch was created locally by `gwm`.

### 6. Open the PR

Read `.github/PULL_REQUEST_TEMPLATE.md` and fill **every** section. For the gwm-cli template that means: Description (with `Closes #N`), Type of change (tick the right box), Changes (bullets), Tests (tick the boxes that actually ran), Screenshots/TUI captures (if applicable), Checklist (tick honestly — do not lie about CHANGELOG / README updates), Linked issues, Notes for reviewers.

```bash
gh pr create \
  --title "<emoji> <type>(<scope>): <subject>" \
  --body  "$(cat <<'EOF'
## Description

<short summary>

Closes #N

## Type of change

- [x] ✨ Feature
- [ ] 🐛 Fix
...

## Changes

- <change 1>
- <change 2>

## Tests

- [x] `cargo test` passes locally
- [x] `cargo fmt --check` passes
- [x] `cargo clippy -- -D warnings` passes
- [ ] New tests added under `tests/`

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

**Print the final PR URL** so the user can click through immediately.

### 7. Reviewing the PR (after step 6)

The **default** review source is the **`/me:loop:claude-review-pr`** loop (a Claude agent spawned with **fresh** context, self-paced — fixes relevant blocking findings P0/P1/P2 until clean, max 8 iterations, with convergence analysis). For a sensitive PR, double up with `/me:loop:codex-review-pr` (local Codex CLI — a **third-party** reviewer, different blind spots). Run it **from inside the worktree**, never the main checkout:

```bash
cd "$(gwm path <kebab-description>)"   # MANDATORY before the review
/me:loop:claude-review-pr
```

As a **secondary**, on-demand step, the user manually triggers `/me:check-reviews [PR#]` when needed (its internal cascade is cloud `@codex review` → local CLIs Codex/CodeRabbit → GitHub bots).

### Then: CI green

Once the review loop is clean, run **`/me:loop:ci-until-green`** from the same worktree. It reads the checks for the **exact SHA** of `HEAD` (not "the branch"), so it refuses to conclude while anything is unpushed, and it never reads "zero checks" as a green CI. Do not merge before it reports `CI_FAILED=0 CI_PENDING=0` with `CI_TOTAL ≥ 1`.

The loop and `/me:check-reviews --local` review the **current working directory's** checkout against its base. Launched from the main checkout — which is still on `dev`/`main` and may hold *other* untracked work (audit docs, drafts) — they review the wrong tree and surface noise about files that aren't in your PR. For a base-vs-branch scope, prefer `--base <default-branch>` over free-text scopes. See [[check-reviews]].

### 8. The vault note — **at merge, not at commit**

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
| 0    | Detected templates + conventions (one-liner)           |
| 1    | Issue URL + number `#N`                                |
| 2    | Chosen branch name + the convention source             |
| 3    | Worktree path + bootstrap report (paste verbatim)      |
| 4    | Commit list (`git log --oneline @{u}..HEAD`)           |
| 5    | Push confirmation + remote URL                         |
| 6    | PR URL                                                 |
| 8    | Vault note path + which template was used              |

## Guardrails

- ⚠️ **Stop and re-plan** if the request is ambiguous — do not invent a scope.
- ⚠️ **Never** push to `main` or `master`. The flow requires a feature branch in a worktree.
- ⚠️ **Never** squash, never delete the source branch on merge (gwm-cli `CONTRIBUTING.md` is explicit; many repos share this rule).
- ⚠️ **Never** invent an issue template body — if no template fits, write a clean Markdown body but say so.
- ⚠️ Bootstrap `✗` halts the flow. Diagnose the failing step before coding.
- ⚠️ Each intermediate commit uses `refs #N`; **only the last** uses `closes #N`.
- ⚠️ A repo-wide `format` can reformat files outside your change (formatter version drift) — revert unrelated reformats before committing; never ship them in a fix/feat PR.
- ⚠️ AI review that reads the working tree (`/me:loop:claude-review-pr` loop, `/me:check-reviews --local`, Codex companion, CodeRabbit CLI) must run **from the worktree**, never the main checkout — otherwise it reviews the wrong tree. The loop is now the default post-PR review, so this is the common path, not an edge case.

## Fallbacks when the repo lacks conventions

| Missing                              | Fallback                                                                 |
|:-------------------------------------|:-------------------------------------------------------------------------|
| `.github/ISSUE_TEMPLATE/`            | Plain `gh issue create --title --body` with a sensible Markdown body     |
| `CONTRIBUTING.md`                    | Branch `<type>/#<issue>-<slug>`, Gitmoji + Conventional Commits          |
| `.github/PULL_REQUEST_TEMPLATE.md`   | Body = `## Summary` + bullets + `Closes #N` + `## Test plan` checklist   |
| `.gwm.toml`                          | `gwm create` still works (no bootstrap steps); warn user it's bare       |

## Related skills

- [[gwm]] — the worktree manager itself: schema, TUI, troubleshooting.
- [[git-flow-branch]] — same workflow, branch in the current checkout (no worktree).
- `/issue-worktree-pr` — explicit slash command for this exact flow.
