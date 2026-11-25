---
name: me-rgaa
description: "Port Codex de /me:rgaa. Accessibilité numérique RGAA 4.1.2, WCAG 2.2 AA, WAI-ARIA 1.2 : audite (statique et runtime navigateur), corrige les non-conformités, ou applique un pattern accessible (type de page, thème RGAA, composant), toute stack. Charge la skill Claude canonique, qui fait foi."
---

# $me-rgaa (port Codex de /me:rgaa)

Source canonique, qui fait foi : `~/.claude/skills/me/rgaa/SKILL.md` (un lien vers `~/Projects/Perso/rgaa-skill/skills/me/rgaa/`). La lire en entier avant d'agir ; ses `references/` et `templates/` se résolvent depuis ce dossier. L'appliquer avec la table « Traduction Claude → Codex » de `~/.codex/AGENTS.md`. Les arguments sont le texte écrit après `$me-rgaa` (le `$ARGUMENTS` de la source).

Adaptations propres à cette procédure :
- Les questions groupées (`AskUserQuestion`, jusqu'à trois dans le même appel) deviennent un seul message court à Kylian avec ces questions, un seul aller-retour, comme la source le veut.
- La passe runtime passe par le MCP `playwright` configuré dans `~/.codex/config.toml`.
- Les corrections s'écrivent avec `apply_patch`.
