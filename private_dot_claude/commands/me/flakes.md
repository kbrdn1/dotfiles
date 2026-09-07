---
name: flakes
description: "Detect the project dev stack and manage its Nix flake dev environment (init/update flake.nix + .envrc)"
argument-hint: "<init|show|update> [--empty|--light|--verbose]"
disable-model-invocation: true
allowed-tools: Bash, Read
---

# /me:flakes - Project Stack Detector & Nix Flake Manager

Detect the development environment of the current project, and initialize / update its **Nix flake** dev environment (`flake.nix` + `.envrc`) from the detected stack.

## Invocation

```
/me:flakes [action] [--verbosity]
```

**Actions** (default: `show`):
- `show` - Display the detected stack (read-only, writes nothing)
- `init` - Generate `flake.nix` + `.envrc` from the detected stack (errors if `flake.nix` already exists → use `update`)
- `update` - Regenerate `flake.nix` from the current stack (keeps a `flake.nix.bak` backup)

**Verbosity** (default: `--light`):
- For `show` → controls the detection output (`--empty` silent, `--light` minimal, `--verbose` + CLI helpers).
- For `init`/`update` → controls the **`shellHook` logs inside the generated `flake.nix`**:
  - `--empty` - `shellHook` silencieux (PATH exports seulement)
  - `--light` - résumé versions sur une ligne (`PHP … | Bun … | Node …`)
  - `--verbose` - bannière + versions + liste de commandes

## Execution

Parse the user's arguments. Extract the action (`init`, `show`, or `update`) and the verbosity flag (`--empty`, `--light`, or `--verbose`). If not specified, default to `show` and `--light`.

**Routing** (run from the project's current working directory):

- `show` → run the **detector** and display its raw output verbatim:
  ```bash
  bash ~/.claude/skills/me/flakes/detect.sh show [--verbosity]
  ```
- `init` / `update` → run the **flake generator** and display its raw output verbatim:
  ```bash
  bash ~/.claude/skills/me/flakes/flake.sh <init|update> [--verbosity]
  ```

Display the raw output of the script to the user. Do NOT add any commentary, summary, or extra formatting around it. The script output IS the final result.

## What the generator produces

`flake.sh` follows the house convention (`nixos-unstable` + `flake-utils`, `phpXY.buildEnv` with Laravel extensions + `extraConfig`, grouped `buildInputs`, `shellHook`). It maps the detected stack to Nix packages (PHP/Composer, Node, Bun, DB client, docker-compose, git/curl/jq). It also creates `.envrc` (`use flake` guarded by `has nix`) only if absent. After `init`/`update`, run `direnv allow` (or `nix develop`).

## Examples

```bash
# Show the detected stack (default)
bash ~/.claude/skills/me/flakes/detect.sh show --light

# Initialize the Nix flake with a verbose shellHook
bash ~/.claude/skills/me/flakes/flake.sh init --verbose

# Initialize with a silent shellHook
bash ~/.claude/skills/me/flakes/flake.sh init --empty

# Update the flake, minimal shellHook logs
bash ~/.claude/skills/me/flakes/flake.sh update --light
```
