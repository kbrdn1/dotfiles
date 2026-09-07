---
name: chezmoi
description: >-
  Use when editing, syncing, or adding ANY config file managed by chezmoi for
  this machine (dotfiles under ~/.config, ~/.claude, ~/.oh-my-zsh, ~/.warp, and
  other home-dir configs) - handles chezmoi prefix mappings (dot_/private_/
  executable_/symlink_/encrypted_), age encryption, the `private_dot_claude`
  0700 rule that a bare `chezmoi apply` would break, conflict resolution, and
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
- `~/.claude/skills/` is itself managed by chezmoi (`private_dot_claude/skills/`).
  **This skill lives in the source**, so edit it there and `chezmoi apply` it.

## Core principle

Chezmoi manages dotfiles from a git-backed source dir. The source is the source
of truth — the home file is generated. **Always check for a template first**,
edit the correct source file, respect prefix mappings, and follow the conflict
workflow so nothing is lost.

## CRITICAL #1: `~/.claude` must stay `0700`

The source dir is `private_dot_claude/`, **not** `dot_claude/`. That `private_`
prefix is load-bearing: `~/.claude` holds `.credentials.json` (the claude.ai
OAuth token) and the repo is **public**.

Without the prefix, chezmoi computes a target mode of `0755` and **every**
`chezmoi apply` silently widens the directory. The drift shows up as a harmless
looking `M .claude` line in `chezmoi status`; applying it is the bug.

```bash
stat -f '%Sp' ~/.claude    # must print drwx------
```

If it ever reads `drwxr-xr-x`: `chmod 700 ~/.claude`, then check the source is
still named `private_dot_claude` (`chezmoi chattr private ~/.claude` restores it).

`.credentials.json` is ignored on **both** sides — `.chezmoiignore` for chezmoi,
`.gitignore` for git. One is not enough: they are independent tools.

## CRITICAL #2: check for templates before editing

```bash
ls -la ~/.local/share/chezmoi/<prefix_mapped_name>*
```

If a `.tmpl` exists for the file you want to change:
- Edit the **template source**, not the generated home file.
- **Never** `chezmoi add` a templated file (it strips the `.tmpl` attribute and
  destroys the template logic permanently).
- Copy directly into the source instead.

**There are currently zero `.tmpl` files in the source.** Until 2026-09-07 the
repo carried a dead copy of `changelog-generator` whose `client.tmpl` /
`technical.tmpl` were Go templates (custom funcs like `hasFeatures`), not chezmoi
templates — chezmoi tried to render them and crashed every bare `status`/`diff`/
`apply`, which is why every command in this skill used to carry
`--exclude=templates`. That copy is gone (the live skill ships
`templates/generate_changelog.md` instead), so **the flag is no longer needed**.
Check anyway before assuming — a new `.tmpl` would bring the crash back:

```bash
find ~/.local/share/chezmoi -name '*.tmpl' -not -path '*/.git/*'
```

## Prefix mappings (real paths in this repo)

| Home file | chezmoi source |
|-----------|----------------|
| `.claude/CLAUDE.md` | `private_dot_claude/CLAUDE.md` |
| `.claude/skills/<x>/SKILL.md` | `private_dot_claude/skills/<x>/SKILL.md` |
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

**Top-level source entries:** `private_dot_claude/`, `dot_config/`, `dot_oh-my-zsh/`,
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
3. **Verify**: `chezmoi diff` (or path-scoped)
4. **Commit**: `cd ~/.local/share/chezmoi && git add -A && git commit -m "msg"`
5. **Push**: `git push`

To go the other direction (deploy source → home): `chezmoi apply <path>`.

## Sync from another machine: `chezmoi update`

`chezmoi update` = `git pull --rebase` + `chezmoi apply`. Because of the
`.tmpl` trap, run it path-scoped or with exclude, and capture local drift first.

```bash
cd ~/.local/share/chezmoi
chezmoi status        # see drift before pulling
git pull --rebase
chezmoi diff          # preview what apply would change
chezmoi apply         # or: chezmoi apply <specific paths>
```

## Conflict resolution (local drift + remote changes)

### 1. Capture local drift BEFORE pulling

```bash
chezmoi status
# MM = modified in both home and source ; M = source only ; A = in source, missing in home
```

For each file to keep: `cp ~/<file> ~/.local/share/chezmoi/<prefix_mapped_name>`,
then `chezmoi diff` to confirm. Commit (don't push yet):

```bash
cd ~/.local/share/chezmoi && git add -A && git commit -m "capture local config drift"
```

### 2. Pull remote

```bash
git pull --rebase   # resolve any git conflicts in source files
```

### 3. Review & apply

```bash
chezmoi diff
chezmoi apply     # remote good → applies
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
| `chezmoi apply` on `~/.claude` | dir widened to `0755` with a token inside | `chmod 700`, keep the source named `private_dot_claude` |
| A new `.tmpl` lands in the source | bare `status/diff/apply` crashes on render | it is an asset, not a template → path-scope, or move it out of the source |
| `chezmoi add` on a template | template logic lost | copy into source directly |
| Edit the home file when a `.tmpl` exists | change overwritten on apply | edit the source template |
| `chezmoi upgrade` | fights the nix-managed binary | upgrade via nix |
| Pull before capturing drift | local edits lost | capture + commit drift first |
| Forget `dot_`/`private_` prefix | "can't find file in source" | use the mapping table |
| Re-add an ignored runtime file | noise / leaks | check `.chezmoiignore` first |

## Red flags — STOP and check

- About to `chezmoi apply` without a path → it may widen `~/.claude` to `0755`.
  Path-scope it, and check `stat -f '%Sp' ~/.claude` after.
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
