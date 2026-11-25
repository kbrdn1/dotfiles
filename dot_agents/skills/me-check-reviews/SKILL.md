---
name: me-check-reviews
description: "Port Codex de /me:check-reviews. Analyser et appliquer les reviews IA d'une PR : @codex review en ligne d'abord, puis CLI locaux (Codex, CodeRabbit) et bots GitHub en repli, et maintainers. Charge la skill Claude canonique, qui fait foi."
---

# $me-check-reviews (port Codex de /me:check-reviews)

Source canonique, qui fait foi : `~/.claude/skills/me/check-reviews/SKILL.md`. La lire en entier avant d'agir, puis l'appliquer avec la table « Traduction Claude → Codex » de `~/.codex/AGENTS.md`. Les arguments sont le texte écrit après `$me-check-reviews` (le `$ARGUMENTS` de la source : n° ou URL de PR, flags).

Adaptations propres à cette procédure :
- Les lignes de contexte de la source (`!` suivi d'une commande entre accents graves) sont injectées par Claude Code : les lancer soi-même au début.
- `AskUserQuestion` devient une question courte à Kylian, seulement quand la réponse change ce qui est appliqué.
- Les corrections s'appliquent avec `apply_patch`. Le CLI local `codex` reste un process séparé : le lancer depuis le worktree de la PR, jamais depuis le checkout principal.
