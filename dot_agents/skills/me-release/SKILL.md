---
name: me-release
description: "Port Codex de /me:release. Publier une version : changelog vers changelogs/<version>.md, bump, merge dev vers main, tag après le merge, release GitHub, propagation. Charge la skill Claude canonique, qui fait foi."
---

# $me-release (port Codex de /me:release)

Source canonique, qui fait foi : `~/.claude/skills/me/release/SKILL.md`. La lire en entier avant d'agir, puis l'appliquer avec la table « Traduction Claude → Codex » de `~/.codex/AGENTS.md`. Les arguments sont le texte écrit après `$me-release` (le `$ARGUMENTS` de la source).

Adaptations propres à cette procédure :
- Un `/release` propre au dépôt fait foi sur le protocole générique : le lire dans `<repo>/.claude/commands/release.md` (ou la skill du dépôt) s'il existe.
- Le `/changelog` du projet (étape 1) se lit de même dans `<repo>/.claude/commands/changelog.md`.
