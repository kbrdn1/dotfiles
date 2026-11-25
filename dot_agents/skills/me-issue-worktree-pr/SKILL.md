---
name: me-issue-worktree-pr
description: "Port Codex de /me:issue-worktree-pr. Workflow complet Issue → Worktree (gwm) → Commits atomiques → Push → PR, puis review et CI. Charge la commande Claude canonique, qui fait foi."
---

# $me-issue-worktree-pr (port Codex de /me:issue-worktree-pr)

Source canonique, qui fait foi : `~/.claude/commands/me/issue-worktree-pr.md`. La lire en entier avant d'agir, puis l'appliquer avec la table « Traduction Claude → Codex » de `~/.codex/AGENTS.md`. Les arguments sont le texte écrit après `$me-issue-worktree-pr` (le `$ARGUMENTS` de la source).

Adaptations propres à cette procédure :
- Les lignes de contexte de la source (`!` suivi d'une commande entre accents graves) sont injectées par Claude Code : les lancer soi-même au début, ce sont des lectures shell.
- `gwm agents attach <slug> "$CLAUDE_CODE_SESSION_ID"` devient `gwm agents attach <slug> "$CODEX_THREAD_ID"`. Vérifier d'abord que la variable n'est pas vide ; vide ou refus de gwm : le dire et continuer, sans bricoler le worktree.
- Les étapes de review et de CI renvoient aux skills `$me-loop-docs-sync`, `$me-report`, `$me-loop-claude-review-pr`, `$me-loop-codex-review-pr`, `$me-loop-ci-until-green`.
