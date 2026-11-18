#!/usr/bin/env bash
# Hooks Claude Code WorktreeCreate et WorktreeRemove branchés sur gwm.
#
# Les worktrees que Claude Code crée lui-même (`claude --worktree`, EnterWorktree, subagent en
# `isolation: "worktree"`, workflows, sessions de fond isolées) naissent par gwm, comme ceux des issues :
# dossier `<repo>-worktrees/`, bootstrap `.gwm.toml` (dépendances, .env, hooks) AVANT que l'agent démarre.
#
# Contrat (code.claude.com/docs/en/hooks, WorktreeCreate / WorktreeRemove) :
# - WorktreeCreate reçoit {name, cwd, ...} et REMPLACE `git worktree add` : le chemin du worktree en dernière
#   ligne de stdout, tout le reste sur stderr ; un code non nul fait échouer la création.
# - WorktreeRemove reçoit {worktree_path} : code 0 = retiré. Claude Code ne supprime jamais la branche d'un
#   worktree créé par hook : on le fait ici. Pas de WorktreeRemove à la fin d'un subagent (son worktree reste).
set -uo pipefail
export PATH="$HOME/.nix-profile/bin:$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"  # hooks hors shell de login

in=$(cat)
field() { printf '%s' "$in" | jq -r --arg k "$1" '.[$k] // empty'; }
nocolor() { sed $'s/\x1b\\[[0-9;]*[A-Za-z]//g'; }
cwd=$(field cwd); [ -n "$cwd" ] && cd "$cwd" 2>/dev/null

case "$(field hook_event_name)" in
  WorktreeCreate)
    name=$(field name)
    [ -n "$name" ] || { echo "worktree-gwm : champ name absent" >&2; exit 1; }
    git rev-parse --is-inside-work-tree >/dev/null 2>&1 || { echo "worktree-gwm : $cwd n'est pas un dépôt git" >&2; exit 1; }
    branch="claude/$name"
    # Bootstrap seulement si le .gwm.toml du dépôt est approuvé (gwm trust add) : hors TTY, gwm refuse un
    # .gwm.toml non approuvé. Dans ce cas, worktree sans bootstrap plutôt qu'exécuter un fichier non approuvé.
    out=$(gwm create --name "$branch" 2>&1 | nocolor)
    if ! printf '%s' "$out" | grep -q 'worktree created at'; then
      echo "worktree-gwm : création avec bootstrap refusée, nouvel essai sans bootstrap" >&2
      out="$out"$'\n'"$(gwm create --name "$branch" --no-bootstrap --reuse-branch 2>&1 | nocolor)"
    fi
    printf '%s\n' "$out" >&2
    path=$(printf '%s\n' "$out" | sed -n 's/.*worktree created at \(.*\)$/\1/p' | tail -1)
    [ -n "$path" ] || path=$(gwm path "$branch" 2>/dev/null | nocolor | tail -1)
    [ -n "$path" ] && [ -d "$path" ] || { echo "worktree-gwm : gwm n'a pas créé $branch" >&2; exit 1; }
    printf '%s\n' "$path"
    ;;
  WorktreeRemove)
    p=$(field worktree_path)
    [ -n "$p" ] && [ -d "$p" ] || exit 0          # déjà parti
    b=$(git -C "$p" branch --show-current 2>/dev/null)
    case "$b" in
      claude/*) ;;                                   # seuls les worktrees créés par ce hook
      *) echo "worktree-gwm : $p (branche ${b:-?}) n'a pas été créé par ce hook, on n'y touche pas" >&2; exit 1 ;;
    esac
    # gwm remove supprime même un worktree sale (vérifié) : la garde est ici. Changements non commités = on
    # garde tout (code 1, Claude Code laisse le worktree sur disque). Branche supprimée seulement si mergée.
    if [ -n "$(git -C "$p" status --porcelain 2>/dev/null)" ]; then
      echo "worktree-gwm : $p a des changements non commités, il reste en place" >&2; exit 1
    fi
    cd "$(git -C "$p" rev-parse --path-format=absolute --git-common-dir)/.." 2>/dev/null
    gwm remove "$(basename "$p")" >&2 2>&1 || exit 1          # gwm cherche le nom du worktree (son dossier)
    git branch -d "$b" >&2 2>&1 || echo "worktree-gwm : branche $b gardée, elle a des commits non mergés" >&2
    ;;
  *)
    echo "worktree-gwm : événement inattendu $(field hook_event_name)" >&2; exit 1 ;;
esac
