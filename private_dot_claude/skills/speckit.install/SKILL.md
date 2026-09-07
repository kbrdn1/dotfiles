---
name: speckit.install
description: Bootstrap the SpecKit spec-driven development system into any project directory.
---

## User Input

```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty).

## Outline

Install the SpecKit scaffolding into a target project directory. The text the user typed after `/speckit.install` is the **target path**. If empty, use the current working directory.

## Execution Flow

### Step 0: Resolve Target Path

1. If `$ARGUMENTS` is not empty, resolve it as the target path (expand `~`, resolve relative paths to absolute).
2. If `$ARGUMENTS` is empty, use the current working directory.
3. Verify the resolved path **exists and is a directory**. If not, ERROR: "Target path does not exist or is not a directory: `<path>`".
4. Store the resolved absolute path as `TARGET_PATH`.

### Step 1: Verify Scaffold Source

1. Read the scaffold directory at `~/.claude/skills/speckit.install/scaffold/`.
2. Verify all expected files exist:
   - `speckit.env`
   - `scripts/bash/common.sh`
   - `scripts/bash/check-prerequisites.sh`
   - `scripts/bash/create-new-feature.sh`
   - `scripts/bash/setup-plan.sh`
   - `scripts/bash/update-agent-context.sh`
   - `templates/spec-template.md`
   - `templates/plan-template.md`
   - `templates/tasks-template.md`
   - `templates/checklist-template.md`
   - `templates/agent-file-template.md`
   - `memory/constitution.md`
3. If any file is missing, ERROR: "Scaffold incomplete. Missing: `<file>`. Re-install the speckit.install skill."

### Step 2: Detect Existing Installation

1. Check if `$TARGET_PATH/.specify/` directory exists.
2. If it exists, use AskUserQuestion with these options:
   - **Overwrite**: Delete existing `.specify/` contents (except `specs/`) and replace with scaffold
   - **Merge**: Only copy files that don't already exist, skip existing ones
   - **Abort**: Cancel installation
3. If abort is chosen, stop execution.
4. **IMPORTANT**: The `specs/` directory MUST NEVER be deleted regardless of the choice.

### Step 3: Create Directory Structure

Create these directories under `$TARGET_PATH/.specify/`:

```
.specify/
  scripts/bash/
  templates/
  memory/
  specs/
```

### Step 4: Copy Scaffold Files

Copy all 12 files from `~/.claude/skills/speckit.install/scaffold/` to `$TARGET_PATH/.specify/`:

| Source (scaffold/) | Destination (.specify/) |
|---|---|
| `speckit.env` | `speckit.env` |
| `scripts/bash/common.sh` | `scripts/bash/common.sh` |
| `scripts/bash/check-prerequisites.sh` | `scripts/bash/check-prerequisites.sh` |
| `scripts/bash/create-new-feature.sh` | `scripts/bash/create-new-feature.sh` |
| `scripts/bash/setup-plan.sh` | `scripts/bash/setup-plan.sh` |
| `scripts/bash/update-agent-context.sh` | `scripts/bash/update-agent-context.sh` |
| `templates/spec-template.md` | `templates/spec-template.md` |
| `templates/plan-template.md` | `templates/plan-template.md` |
| `templates/tasks-template.md` | `templates/tasks-template.md` |
| `templates/checklist-template.md` | `templates/checklist-template.md` |
| `templates/agent-file-template.md` | `templates/agent-file-template.md` |
| `memory/constitution.md` | `memory/constitution.md` |

**Merge mode**: Skip files that already exist at destination. In merge mode, if `memory/constitution.md` already exists, ALWAYS skip it (user customizations take priority).

**Overwrite mode**: Replace all files. Still skip `memory/constitution.md` if it has been customized (file size differs from scaffold template).

### Step 5: Make Scripts Executable

Run `chmod +x` on all `.sh` files in `$TARGET_PATH/.specify/scripts/bash/`.

### Step 6: Interactive Configuration

Use AskUserQuestion to gather all configuration choices **in a single prompt** with multiple questions:

**Q1: Branch pattern**
- `feat/#{number}-{slug}` (Recommended) -- e.g. `feat/#42-user-auth`
- `{number}-{slug}` -- e.g. `42-user-auth`
- `feature/{number}-{slug}` -- e.g. `feature/42-user-auth`
- `feat/{number}-{slug}` -- e.g. `feat/42-user-auth`

**Q2: Number padding**
- No padding (Recommended) -- `42`, `7`, `128`
- 3 digits -- `042`, `007`, `128`
- 4 digits -- `0042`, `0007`, `0128`

**Q3: Spec directory pattern**
- `{number}-{slug}` (Recommended) -- e.g. `42-user-auth`
- `{slug}` -- e.g. `user-auth` (no number prefix)

### Step 7: Update speckit.env

Based on the user's choices, compute and write the configuration values:

1. **SPECKIT_BRANCH_PATTERN**: Direct from Q1 choice
2. **SPECKIT_BRANCH_PREFIX**: Extract the prefix before `{number}` from the pattern
   - `feat/#{number}-{slug}` -> `feat/#`
   - `{number}-{slug}` -> `` (empty)
   - `feature/{number}-{slug}` -> `feature/`
   - `feat/{number}-{slug}` -> `feat/`
3. **SPECKIT_BRANCH_SEPARATOR**: Always `-`
4. **SPECKIT_BRANCH_REGEX**: Build from prefix
   - If prefix is not empty: `^<escaped_prefix>[0-9]+-` (e.g. `^feat/#[0-9]+-`)
   - If prefix is empty: `^[0-9]+-`
   - Add alternate for standard 3-digit: `|^[0-9]{3}-`
5. **SPECKIT_SPEC_PATTERN**: Direct from Q3 choice
6. **SPECKIT_NUMBER_PADDING**: `0` for no padding, `3` for 3 digits, `4` for 4 digits
7. **SPECKIT_PREFIX_REGEX_STANDARD**: `^([0-9]+)-` (adjusts with padding, e.g. `^([0-9]{3})-` for 3-digit)
8. **SPECKIT_PREFIX_REGEX_PREFIXED**: Build from prefix pattern (e.g. `^[a-z]+/#([0-9]+)-` for `feat/#`)

**Validation**: If the chosen branch pattern does not contain `{number}` or `{slug}`, ERROR and re-ask.

Read the current `speckit.env` file, then write the updated values using Edit tool to replace the placeholder values.

### Step 8: Report

Display a summary:

```
speckit installed at: $TARGET_PATH/.specify/

files installed:
  .specify/speckit.env
  .specify/scripts/bash/common.sh
  .specify/scripts/bash/check-prerequisites.sh
  .specify/scripts/bash/create-new-feature.sh
  .specify/scripts/bash/setup-plan.sh
  .specify/scripts/bash/update-agent-context.sh
  .specify/templates/spec-template.md
  .specify/templates/plan-template.md
  .specify/templates/tasks-template.md
  .specify/templates/checklist-template.md
  .specify/templates/agent-file-template.md
  .specify/memory/constitution.md

configuration:
  branch pattern: <chosen pattern>
  number padding: <chosen padding>
  spec directory: <chosen pattern>

next steps:
  1. run /speckit.constitution to define your project's architectural principles
  2. run /speckit.specify <feature description> to create your first feature spec
  3. for a full Git flow (issue → worktree/branch → spec → plan → tasks → implement → PR),
     use /me:spec-issue-worktree-pr or /me:spec-issue-branch-pr — these create the branch
     via gwm/git first, then call speckit with --no-branch so the spec numbering follows
     the GitHub issue number
```

## Edge Cases

- **Target path doesn't exist**: Error with clear message
- **`.specify/` already present**: Offer overwrite/merge/abort
- **Constitution already customized**: Skip in merge mode, warn in overwrite mode
- **`specs/` directory exists**: Never delete it, always preserve
- **No git repo**: OK, scripts handle non-git repos gracefully
- **Custom pattern without `{number}` or `{slug}`**: Validation error, re-ask
- **Permission denied**: Error with clear message about directory permissions
- **Branch creation is decoupled**: `create-new-feature.sh` accepts `--no-branch` and auto-skips branch creation when already on the computed target branch, so an external owner (a `gwm` worktree, or the `spec-git-flow-worktree` / `spec-git-flow-branch` workflows) can cut `<type>/#<issue>-<slug>` first. Downstream commands then resolve the feature via the prefix-based branch lookup in `common.sh` (the branch always encodes the feature number in issue-first numbering), falling back to `.specify/feature.json` (written by the script and auto-added to `.specify/.gitignore`, since it is a per-checkout runtime pointer) when the branch has no numeric prefix.
