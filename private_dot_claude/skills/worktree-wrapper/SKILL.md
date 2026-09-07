---
name: worktree-wrapper
description: Manage git worktrees for fiches-pedagogiques via the local wrapper script tools/worktree-manager.sh (backed by gwq). Use when the user asks to create/list/remove/cleanup worktrees, runs make worktree, mentions gwq, or asks about the bootstrap_worktree_safety logic (.env.testing sqlite, AWS RDS guard, composer install, direnv allow). Triggers on "worktree", "worktree-manager", "gwq", "make worktree", "bootstrap worktree", "post_create".
allowed-tools: Bash, Read, Edit
---

# worktree-wrapper — tools/worktree-manager.sh

Local bash wrapper around `gwq` (https://github.com/d-kuro/gwq) for the **fiches-pedagogiques** projects (API + front). Each project ships its own copy of `tools/worktree-manager.sh`. The wrapper enforces the team branch convention and runs a safety bootstrap (`bootstrap_worktree_safety`) after every new worktree.

## When to use this skill

- User invokes the wrapper directly (`./tools/worktree-manager.sh ...` or `make worktree`)
- User asks how to create/list/remove/cleanup worktrees for these projects
- User mentions `gwq` (the underlying CLI)
- User asks about the safety bootstrap (`.env.testing` sqlite, AWS RDS guard, vendor/ isolation, composer install, direnv allow)
- User refers to the **incident 2026-05-11** (prod DB dropped by RefreshDatabase)

## Prerequisites

```bash
command -v gwq         # required: brew install d-kuro/tap/gwq  (or go install github.com/d-kuro/gwq/cmd/gwq@latest)
command -v direnv      # optional: for Nix flake auto-load
command -v composer    # optional: for auto composer install
```

The wrapper aborts early if `gwq` is missing.

## Project layout

Each project has the wrapper at:

```
fiches-pedagogiques-api-rest/tools/worktree-manager.sh    # Laravel/PHP/Nix variant
fiches-pedagogiques-front/tools/worktree-manager.sh       # Nuxt/Bun/Nix variant (similar shape)
```

Worktrees are stored **outside** the main repo, under:

```
~/cc-worktree/<repo-name>/<type>-<issue>-<desc>/
```

Example: branch `feat/#789-cool-thing` in `fiches-pedagogiques-api-rest` → worktree at `~/cc-worktree/fiches-pedagogiques-api-rest/feat-789-cool-thing/`.

Naming rule: `<type>/#<issue>-<short-description>` on the git side; gwq sanitises slashes/`#` to `-` for the on-disk path.

## Commands reference

### Interactive menu (main entry)

```bash
cd <repo>
./tools/worktree-manager.sh          # full interactive menu
# OR
make worktree                        # same, via Makefile target
```

Menu options:

| n | action |
|---|---|
| 1 | Create new worktree (guided: select type → enter issue → enter description) |
| 2 | Create worktree (gwq fuzzy finder — free-form branch name) |
| 3 | List worktrees (`gwq list -v`) |
| 4 | Navigate to worktree (`gwq cd` — fuzzy picker) |
| 5 | Remove worktree (`gwq remove`, optionally with `-b` to also delete branch) |
| 6 | Monitor worktrees live (`gwq status --watch`) |
| 7 | Cleanup (prune stale refs — `gwq prune`) |
| q | Quit |

### Non-interactive (CLI mode)

```bash
./tools/worktree-manager.sh create <type> <issue> <description>
./tools/worktree-manager.sh list
./tools/worktree-manager.sh cleanup
```

Available `<type>` values (validated against `CONTRIBUTING.md` convention):

```
feat     New feature implementation
fix      Bug fix
hotfix   Critical production bug fix
docs     Documentation changes
test     Test additions or modifications
refactor Code restructuring
chore    Maintenance tasks
perf     Performance improvements
ci       CI/CD configuration
build    Build system changes
```

Example:

```bash
./tools/worktree-manager.sh create feat 789 cool-feature
# → branch: feat/#789-cool-feature
# → worktree: ~/cc-worktree/<repo>/feat-789-cool-feature
# → bootstrap_worktree_safety runs automatically
```

## bootstrap_worktree_safety — the 5-step post-create logic

Called automatically by `create_worktree_guided` and `quick_create` after `gwq add` succeeds. cwd-agnostic; takes the resolved worktree path as `$1`.

### Step 1/5 — `.env.testing` (sqlite :memory: guarantee)

- If `<repo>/.env.testing` exists and is **safe** (no `DB_CONNECTION=mysql`, no `amazonaws.com`, no `.rds.`) → copy it.
- Else → generate inline (`_write_safe_env_testing`) with hardcoded sqlite `:memory:`, `BCRYPT_ROUNDS=4`, `SKIP_PAGINATION_PROVIDER=true`, `SKIP_ELASTICSEARCH_PROVIDER=true`.
- Hard check after: file MUST contain `^DB_CONNECTION=sqlite`. If not → overwrite.

**Why** (incident 2026-05-11): a copied `.env` pointing to AWS RDS caused `php artisan test` to load `.env` (no `.env.testing` present), and `RefreshDatabase` ran `migrate:fresh` against prod, dropping all tables.

### Step 2/5 — `.env` (AWS RDS guard)

- If `<worktree>/.env` exists → leave it.
- Else if `<repo>/.env` contains `amazonaws.com` or `.rds.` → **refuse** to copy, seed from `.env.example` instead, print a warning to edit before use.
- Else if `<repo>/.env` is benign → copy.
- Else → fall back to `.env.example`.
- Else → warn, no `.env`.

### Step 3/5 — `vendor/` isolation

- If `<worktree>/vendor` is a **symlink** → remove it. Reason: `composer dump-autoload` rewrites paths in autoload files, which would corrupt every other worktree sharing the symlinked vendor.
- If `vendor/` missing → flag for step 5.

### Step 4/5 — direnv

- If `<worktree>/.envrc` present and `direnv` installed → `direnv allow <worktree>`. Nix flake / shell will load on `cd`.
- Else → warn and skip.

### Step 5/5 — composer install

- If `composer.json` present and `composer` in PATH → `cd <worktree> && COMPOSER_IGNORE_PLATFORM_REQ=ext-imagick composer install --no-interaction --prefer-dist`.
- Tail of output shown for context. Failures print a manual-fix hint.
- If `composer` not in PATH (direnv not yet loaded) → print manual command.

### Summary

Final block recaps `.env.testing` status, `.env DB_HOST` value, and `vendor/` readiness. Use this to confirm safety before running tests.

## Customising the wrapper

### Branch types

Edit `BRANCH_TYPES` array (lines ~36-47):

```bash
BRANCH_TYPES=(
    "feat:New feature implementation"
    # add/remove here
)
```

### Worktree base location

Default: `~/cc-worktree/<repo>/`. Change `WORKTREE_BASE` at line ~33.

### Safety thresholds

Production-host detection in `bootstrap_worktree_safety` matches `amazonaws\.com|\.rds\.`. To extend (e.g. block other prod hosts like `db.flippad.com`), add patterns to the `grep -qiE` calls in steps 1 and 2.

### Inline `.env.testing` template

`_write_safe_env_testing` (lines ~321-346) writes a hardcoded heredoc. Adjust env vars there if test setup changes — but keep `DB_CONNECTION=sqlite` and `DB_DATABASE=:memory:` non-negotiable.

## Workflows

### New feature on the API repo

```bash
cd ~/Projects/Flippad/fiches-pedagogiques/fiches-pedagogiques-api-rest
make worktree   # menu → option 1 → feat → 789 → cool-thing
# bootstrap runs: .env.testing, .env, direnv allow, composer install
cd $(gwq get feat)   # or:  cd ~/cc-worktree/fiches-pedagogiques-api-rest/feat-789-cool-thing
php artisan test
```

### Quick non-interactive

```bash
./tools/worktree-manager.sh create fix 818 rating-preset-edge
cd ~/cc-worktree/fiches-pedagogiques-api-rest/fix-818-rating-preset-edge
```

### List + navigate

```bash
gwq list -v          # raw gwq
gwq cd               # fuzzy picker
```

### Cleanup after PRs merge

```bash
./tools/worktree-manager.sh cleanup   # gwq prune
```

For removing one specific worktree:

```bash
./tools/worktree-manager.sh
# → option 5 → enter pattern → optionally delete branch too
```

## Underlying gwq commands (for the curious)

If you skip the wrapper:

```bash
gwq add -b "feat/#789-thing"         # create worktree + branch
gwq add -i                           # interactive fuzzy add
gwq list -v                          # list with details
gwq get <fragment>                   # echo path matching fragment
gwq cd                               # fuzzy cd into worktree
gwq remove <pattern>                 # remove worktree
gwq remove -b <pattern>              # remove worktree + branch
gwq prune                            # cleanup stale refs
gwq status --watch                   # live monitor
```

The wrapper adds: branch-naming enforcement, safety bootstrap, interactive menu, validation. Drop to raw `gwq` only for edge cases (e.g. detached HEAD worktree).

## Troubleshooting

**`Error: gwq is not installed`** — `brew install d-kuro/tap/gwq` or `go install github.com/d-kuro/gwq/cmd/gwq@latest`. The wrapper aborts on `check_gwq`.

**`bootstrap_worktree_safety: invalid path`** — wrapper couldn't resolve the worktree path post `gwq add`. Fallback is shown: `cd $(gwq get <type>) && cp <repo>/.env.testing .`. Then re-run the bootstrap manually:

```bash
source tools/worktree-manager.sh
bootstrap_worktree_safety ~/cc-worktree/<repo>/<branch-dir>
```

**`.env.testing shows mysql or AWS host after creation`** — the bootstrap copied from main without the safety check (older script version), or you copied manually after. Overwrite immediately with the safe heredoc:

```bash
source tools/worktree-manager.sh
_write_safe_env_testing ~/cc-worktree/<repo>/<branch-dir>/.env.testing
```

Until fixed, NEVER run `php artisan test` — `RefreshDatabase` will target the configured DB.

**composer install fails inside worktree** — usually direnv not yet active (Nix shell not loaded). `cd` into the worktree once to trigger direnv, then re-run `composer install`. Or run manually with platform req ignored:

```bash
COMPOSER_IGNORE_PLATFORM_REQ=ext-imagick composer install --prefer-dist
```

**vendor/ collision** — never symlink vendor across worktrees. Composer rewrites autoload paths in `vendor/composer/autoload_*.php`, which would point all worktrees to the same paths and break the target of the dump-autoload run.

**`gwq cd` doesn't change my shell directory** — gwq runs as a child process; it prints the path but cannot mutate the parent shell's cwd. Use `cd $(gwq get <fragment>)` instead, or add a shell function wrapping `cd "$(gwq get \"$1\")"`.

## Related

- gwq CLI: https://github.com/d-kuro/gwq
- Script source: `<repo>/tools/worktree-manager.sh`
- Makefile target: `make worktree` (calls `bash tools/worktree-manager.sh`)
- Branch convention: `CONTRIBUTING.md` (per repo)
- Incident reference: 2026-05-11 (production DB dropped by RefreshDatabase) — informs the entire bootstrap_worktree_safety design
