---
name: me-dispatch
description: "Port Codex de /me:dispatch. Orchestre un gros chantier avec Herdr Core (hc) : un worker par issue dans son worktree gwm, reprise du travail en cours, plan me:report, merge progressif dans dev. Charge la skill Claude canonique, qui fait foi."
---

# $me-dispatch (port Codex de /me:dispatch)

Source canonique, qui fait foi : `~/.claude/skills/me/dispatch/SKILL.md`. La lire en entier avant d'agir, puis l'appliquer avec la table « Traduction Claude → Codex » de `~/.codex/AGENTS.md`. Les arguments sont le texte écrit après `$me-dispatch`.

Adaptations propres à cette procédure :
- `$CLAUDE_CODE_SESSION_ID` devient `$CODEX_THREAD_ID` (vérifier qu'il n'est pas vide avant de s'en servir).
- Les workers suivent la source (`hc run ... env PATH="$PATH" claude`). Si le quota Claude est épuisé, un worker Codex (`... codex`) suit le même brief ; le dire au lancement.
- `SendUserFile` n'existe pas : donner le chemin absolu du fichier.

Non porté, à savoir :
- La note de reprise du lead est liée aux hooks Claude `handoff.sh` (PreCompact, SessionStart). Ils ne sont pas branchés dans Codex : après une compaction Codex, relire la note de reprise à la main avant toute action.
- Le seuil de contexte des workers lit `ctx_pct` dans `~/.claude/cache/statusline/herdr-<adresse>.json`, écrit par la statusline Claude. Pour un worker Codex ce fichier n'est pas prouvé : demander l'état au worker.
