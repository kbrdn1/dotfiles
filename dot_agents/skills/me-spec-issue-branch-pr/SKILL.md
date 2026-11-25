---
name: me-spec-issue-branch-pr
description: "Port Codex de /me:spec-issue-branch-pr. Workflow spec-driven Issue → Branche → Spec Kit (specify, plan, tasks, implement) → Commits → PR dans le checkout courant. Charge la skill Claude canonique, qui fait foi."
---

# $me-spec-issue-branch-pr (port Codex de /me:spec-issue-branch-pr)

Source canonique, qui fait foi : `~/.claude/skills/spec-git-flow-branch/SKILL.md` (la commande Claude `~/.claude/commands/me/spec-issue-branch-pr.md` ne fait que l'invoquer). La lire en entier avant d'agir, puis l'appliquer avec la table « Traduction Claude → Codex » de `~/.codex/AGENTS.md`. Les arguments sont le texte écrit après `$me-spec-issue-branch-pr`.

Adaptations propres à cette procédure :
- Les étapes `speckit.*` passent par les skills Codex `$speckit.specify`, `$speckit.plan`, `$speckit.tasks`, `$speckit.implement` (et `$speckit.converge` si présent), avec les mêmes options (`--no-branch --number N`).
- L'hydratation des tâches Claude (TaskCreate) n'existe pas en Codex : suivre `tasks.md` directement.
