---
name: me-spec-issue-worktree-pr
description: "Port Codex de /me:spec-issue-worktree-pr. Workflow spec-driven Issue → Worktree (gwm) → Spec Kit (specify, plan, tasks, implement) → Commits → PR, le numéro d'issue pilote branche et dossier de spec. Charge la skill Claude canonique, qui fait foi."
---

# $me-spec-issue-worktree-pr (port Codex de /me:spec-issue-worktree-pr)

Source canonique, qui fait foi : `~/.claude/skills/spec-git-flow-worktree/SKILL.md` (la commande Claude `~/.claude/commands/me/spec-issue-worktree-pr.md` ne fait que l'invoquer). La lire en entier avant d'agir, puis l'appliquer avec la table « Traduction Claude → Codex » de `~/.codex/AGENTS.md`. Les arguments sont le texte écrit après `$me-spec-issue-worktree-pr`.

Adaptations propres à cette procédure :
- Les étapes `speckit.*` passent par les skills Codex `$speckit.specify`, `$speckit.plan`, `$speckit.tasks`, `$speckit.implement` (et `$speckit.converge` si présent), avec les mêmes options (`--no-branch --number N`).
- `gwm agents attach <slug> "$CLAUDE_CODE_SESSION_ID"` devient `gwm agents attach <slug> "$CODEX_THREAD_ID"` ; variable vide ou refus de gwm : le dire et continuer.
- L'hydratation des tâches Claude (TaskCreate) n'existe pas en Codex : suivre `tasks.md` directement.
