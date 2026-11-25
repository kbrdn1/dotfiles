---
name: me-goal
description: "Port Codex de /me:goal (workflow sprint, à ne pas confondre avec la commande native /goal). Découpe un objectif en issues avec dépendances, plan me:report vivant, chaque issue débloquée menée en worktree jusqu'au merge progressif dans dev. Charge la skill Claude canonique, qui fait foi."
---

# $me-goal (port Codex de /me:goal)

Source canonique, qui fait foi : `~/.claude/skills/me/goal/SKILL.md`. La lire en entier avant d'agir, puis l'appliquer avec la table « Traduction Claude → Codex » de `~/.codex/AGENTS.md`. Les arguments sont le texte écrit après `$me-goal`.

Adaptations propres à cette procédure :
- `/goal` est une primitive native de Codex (évaluateur qui ne lit que le transcript) : ce n'est pas ce workflow, ne pas la lancer à sa place.
- Le parallèle passe par `$me-dispatch` dans Herdr ; ailleurs, `$me-issue-worktree-pr` une issue après l'autre. Le plan par `$me-report`.
