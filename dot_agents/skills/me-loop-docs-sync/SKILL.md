---
name: me-loop-docs-sync
description: "Port Codex de /me:loop:docs-sync. Détecte la dérive entre la surface publique (CLI, API, config) et la documentation, met les docs à jour, reboucle jusqu'à zéro écart, max 6 itérations ; check_command par projet. Charge la skill Claude canonique, qui fait foi."
---

# $me-loop-docs-sync (port Codex de /me:loop:docs-sync)

Source canonique, qui fait foi : `~/.claude/skills/me/loop/docs-sync/SKILL.md`, appliquée selon le protocole de `$me-run-loop`. La lire en entier avant d'agir ; si le dépôt a son propre loop (`<repo>/.claude/skills/me/loop/docs-sync/SKILL.md`), c'est lui qui porte le `check_command`. L'appliquer avec la table « Traduction Claude → Codex » de `~/.codex/AGENTS.md`.

Deux passages : brouillon après l'implémentation et avant la PR, final après la review seulement si le code a bougé. Jamais pendant une passe de review. Un dépôt sans gate énumérable saute l'étape en le disant.
