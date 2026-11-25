---
name: me-issue-branch-pr
description: "Port Codex de /me:issue-branch-pr. Workflow Issue → Branche → Commits atomiques → Push → PR dans le checkout courant (sans worktree). Charge la commande Claude canonique, qui fait foi."
---

# $me-issue-branch-pr (port Codex de /me:issue-branch-pr)

Source canonique, qui fait foi : `~/.claude/commands/me/issue-branch-pr.md`. La lire en entier avant d'agir, puis l'appliquer avec la table « Traduction Claude → Codex » de `~/.codex/AGENTS.md`. Les arguments sont le texte écrit après `$me-issue-branch-pr` (le `$ARGUMENTS` de la source).

Adaptations propres à cette procédure :
- Les lignes de contexte de la source (`!` suivi d'une commande entre accents graves) sont injectées par Claude Code : les lancer soi-même au début, ce sont des lectures shell.
- Les étapes de review et de CI renvoient aux skills `$me-loop-docs-sync`, `$me-report`, `$me-loop-claude-review-pr`, `$me-loop-codex-review-pr`, `$me-loop-ci-until-green`.
