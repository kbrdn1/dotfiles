---
name: chezmoi
description: >-
  Use when editing, syncing, or adding ANY config file managed by chezmoi for
  this machine (dotfiles under ~/.config, ~/.claude, ~/.oh-my-zsh, ~/.warp, and
  other home-dir configs) - handles chezmoi prefix mappings (dot_/private_/
  executable_/symlink_/encrypted_), age encryption, the changelog-generator
  .tmpl trap that breaks `chezmoi status/diff/apply`, conflict resolution, and
  pull/apply/push so changes are never lost. Trigger on "chezmoi", "dotfiles",
  "sync my config", "update my dotfiles", or before any `chezmoi status/diff/
  apply/update/add`.
metadata:
  version: 1.0.0
  requires:
    bins:
      - chezmoi
      - git
---

# Working with chezmoi (kbrdn1 config)

## Setup specific to this machine

- **Source dir**: `~/.local/share/chezmoi/`
- **Remote**: `https://github.com/kbrdn1/dotfiles` — branch `main`
- **Binary**: installed via **nix** (`~/.nix-profile/bin/chezmoi`, nixpkgs). Upgrade
  the binary through nix, **never** `chezmoi upgrade`.
- **Encryption**: `age`. Config in `~/.config/chezmoi/chezmoi.toml`:
  - identity `~/.config/age/chezmoi.txt`, recipient `age1j9uw…hs3xl`.
  - Add a secret with `chezmoi add --encrypt <file>` → stored as `encrypted_*`.
- `~/.claude/skills/` is itself managed by chezmoi (`dot_claude/skills/`).
  **This skill lives in the source**, so edit it there and `chezmoi apply` it.

## Core principle

Chezmoi manages dotfiles from a git-backed source dir. The source is the source
of truth — the home file is generated. **Always check for a template first**,
edit the correct source file, respect prefix mappings, and follow the conflict
workflow so nothing is lost.

## CRITICAL #1: the changelog-generator `.tmpl` trap

This repo has exactly two `.tmpl` files and **they are NOT chezmoi templates**:

```
dot_claude/skills/changelog-generator/templates/client.tmpl
dot_claude/skills/changelog-generator/templates/technical.tmpl
```

They are assets of the `changelog-generator` skill (Go templates using custom
funcs like `hasFeatures`). chezmoi tries to render them and **crashes**:

```
chezmoi: ... template: .../client.tmpl:8: function "hasFeatures" not defined
```

This breaks bare `chezmoi status`, `chezmoi diff`, `chezmoi apply`,
`chezmoi update`. **Workaround — exclude the templates entity:**

```bash
chezmoi status  --exclude=templates
chezmoi diff    --exclude=templates
chezmoi apply   --exclude=templates
```

When applying a single subtree (recommended for most edits), target the path so
the bad files are never touched:

```bash
chezmoi apply ~/.claude/skills/chezmoi
chezmoi apply ~/.config/ghostty
```

Do NOT "fix" this by `chezmoi add`-ing the rendered file or deleting the
`.tmpl` — those files must keep the `.tmpl` name for the changelog-generator
skill to load them. The clean long-term fix is to stop chezmoi from templating
that subtree; until then, use `--exclude=templates` or path-scoped applies.

## CRITICAL #2: check for templates before editing

```bash
ls -la ~/.local/share/chezmoi/<prefix_mapped_name>*
```

If a real `.tmpl` exists for the file you want to change:
- Edit the **template source**, not the generated home file.
- **Never** `chezmoi add` a templated file (it strips the `.tmpl` attribute and
  destroys the template logic permanently).
- Copy directly into the source instead.

(Right now only the two changelog-generator files carry `.tmpl`, and those are
the fake-template trap above — but check anyway before assuming.)

## Prefix mappings (real paths in this repo)

| Home file | chezmoi source |
|-----------|----------------|
| `.claude/CLAUDE.md` | `dot_claude/CLAUDE.md` |
| `.claude/skills/<x>/SKILL.md` | `dot_claude/skills/<x>/SKILL.md` |
| `.config/ghostty/config` | `dot_config/ghostty/config` |
| `.config/ghostty/themes/claude-dark` | `dot_config/ghostty/themes/private_claude-dark` |
| `.config/zed/settings.json` | `dot_config/zed/private_settings.json` |
| `.config/zed/keymap.json` | `dot_config/zed/private_keymap.json` |
| `.config/karabiner/karabiner.json` | `dot_config/private_karabiner/private_karabiner.json` |
| `.config/gh/hosts.yml` | `dot_config/gh/private_hosts.yml` |
| `.config/gh/config.yml` | `dot_config/gh/private_config.yml` |
| `.config/tmux/...` | `dot_config/tmux/...` |
| `.oh-my-zsh/custom/...` | `dot_oh-my-zsh/custom/...` |
| `.warp/...` | `dot_warp/...` |

**Pattern:**
- `.` → `dot_`
- private / sensitive → `private_` prefix (file stays plaintext, just marked 0600)
- encrypted secret → `encrypted_` prefix (age-encrypted in the repo)
- executable script → `executable_` prefix
- symlink → `symlink_` prefix (target is the file content)
- templated → `.tmpl` suffix (rendered by chezmoi — see the trap above)

**Top-level source entries:** `dot_claude/`, `dot_config/`, `dot_oh-my-zsh/`,
`dot_warp/`, `nix-config/`, `sketchybar-app-font/`, `tmux_custom_modules/`.
`nix-config/` is versioned in the repo but is **not** a `dot_` home mapping (it
feeds the nix/home-manager setup), so leave it to the nix workflow.

## Ignored / not managed

`.chezmoiignore` excludes machine-local and runtime data — don't try to add
these back:
- Claude runtime: `.claude/logs/`, `.claude/history.jsonl`, `.claude/projects/**`,
  `.claude/todos/`, `.claude/plugins/cache/`, `.claude/statsig/`, caches, `.DS_Store`
- Private Claude projects: `*cv-exporter*`, `*personal*`, `*private*`
- Secret patterns: `**/*secret*`, `**/*password*`, `**/*.pem`, `**/*.key`, `**/id_rsa*`
- Auto-generated: `.config/nvim/lazy-lock.json`, superfile themes, lazysql history,
  sketchybar archives/state, aerospace backups, `.config/opencode/`

If a file you expect to manage isn't showing up, check `.chezmoiignore` first.

## Standard edit workflow

For any managed config file:

1. **Check for a real template**: `ls ~/.local/share/chezmoi/<prefix_mapped_name>*`
2. **Edit the source** (template if one exists, else the source file) — or edit
   the home file then copy it in: `cp ~/<file> ~/.local/share/chezmoi/<prefix_mapped_name>`
3. **Verify**: `chezmoi diff --exclude=templates` (or path-scoped)
4. **Commit**: `cd ~/.local/share/chezmoi && git add -A && git commit -m "msg"`
5. **Push**: `git push`

To go the other direction (deploy source → home): `chezmoi apply <path>`.

## Sync from another machine: `chezmoi update`

`chezmoi update` = `git pull --rebase` + `chezmoi apply`. Because of the
`.tmpl` trap, run it path-scoped or with exclude, and capture local drift first.

```bash
cd ~/.local/share/chezmoi
chezmoi status --exclude=templates        # see drift before pulling
git pull --rebase
chezmoi diff   --exclude=templates        # preview what apply would change
chezmoi apply  --exclude=templates        # or: chezmoi apply <specific paths>
```

## Conflict resolution (local drift + remote changes)

### 1. Capture local drift BEFORE pulling

```bash
chezmoi status --exclude=templates
# MM = modified in both home and source ; M = source only ; A = in source, missing in home
```

For each file to keep: `cp ~/<file> ~/.local/share/chezmoi/<prefix_mapped_name>`,
then `chezmoi diff --exclude=templates` to confirm. Commit (don't push yet):

```bash
cd ~/.local/share/chezmoi && git add -A && git commit -m "capture local config drift"
```

### 2. Pull remote

```bash
git pull --rebase   # resolve any git conflicts in source files
```

### 3. Review & apply

```bash
chezmoi diff --exclude=templates
chezmoi apply --exclude=templates     # remote good → applies
# local should win → already committed in step 1
# need a merge → edit the source file, git commit again
```

### 4. Push the resolved state

```bash
git push
```

## Adding a new config file

```bash
chezmoi add ~/.config/<tool>/config              # plaintext
chezmoi add --encrypt ~/.config/<tool>/token     # age-encrypted → encrypted_*
```

Then mark it private by renaming the source to `private_*` if it holds
credentials but you don't want full encryption. Commit + push.

## Common mistakes

| Mistake | Symptom | Fix |
|---------|---------|-----|
| Bare `chezmoi status/apply` | `hasFeatures` template crash | add `--exclude=templates` or path-scope |
| `chezmoi add` on a template | template logic lost | copy into source directly |
| Edit the home file when a `.tmpl` exists | change overwritten on apply | edit the source template |
| `chezmoi upgrade` | fights the nix-managed binary | upgrade via nix |
| Pull before capturing drift | local edits lost | capture + commit drift first |
| Forget `dot_`/`private_` prefix | "can't find file in source" | use the mapping table |
| Re-add an ignored runtime file | noise / leaks | check `.chezmoiignore` first |

## Red flags — STOP and check

- About to run bare `chezmoi status/diff/apply` → add `--exclude=templates`.
- About to `chezmoi add` → check for a `.tmpl` source first.
- About to edit a dotfile → confirm the source path and whether it's templated.
- Touching a secret → use `--encrypt` / `private_`, never commit plaintext.
- About to `git push` in the source → run `git status` / `chezmoi diff` first.

## When to use

**Use when:** editing anything under `~/.config/`, `~/.claude/`, `~/.oh-my-zsh/`,
`~/.warp/`; the user says "chezmoi", "dotfiles", "sync/update my config";
before any `chezmoi status/diff/apply/update/add`; pulling updates from another
machine; adding a new config file to the repo.

**Don't use for:** files in project directories, temp files, caches, or the
`nix-config/` subtree (that's the nix/home-manager workflow).
