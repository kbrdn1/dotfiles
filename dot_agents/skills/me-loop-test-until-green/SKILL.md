---
name: me-loop-test-until-green
description: "Port Codex de /me:loop:test-until-green. Détecte le runner de tests du projet, le relance et corrige jusqu'à ce que tous les tests passent (exit 0), max 10 itérations. Charge la skill Claude canonique, qui fait foi."
---

# $me-loop-test-until-green (port Codex de /me:loop:test-until-green)

Source canonique, qui fait foi : `~/.claude/skills/me/loop/test-until-green/SKILL.md`, appliquée selon le protocole de `$me-run-loop`. La lire en entier avant d'agir, puis l'appliquer avec la table « Traduction Claude → Codex » de `~/.codex/AGENTS.md`.

Corriger la cause racine : jamais un test désactivé, sauté ou rendu tautologique. Zéro test exécuté n'est pas un succès.
