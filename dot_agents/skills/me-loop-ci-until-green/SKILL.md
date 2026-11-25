---
name: me-loop-ci-until-green
description: "Port Codex de /me:loop:ci-until-green. Attend la CI de la PR de la branche courante sur le SHA exact de HEAD, corrige la cause racine des jobs rouges et repousse, jusqu'à ce que tous les checks passent, max 6 itérations. Charge la skill Claude canonique, qui fait foi."
---

# $me-loop-ci-until-green (port Codex de /me:loop:ci-until-green)

Source canonique, qui fait foi : `~/.claude/skills/me/loop/ci-until-green/SKILL.md`, appliquée selon le protocole de `$me-run-loop`. La lire en entier avant d'agir ; ses scripts et `_shared/` se résolvent depuis `~/.claude/skills/me/loop/`. L'appliquer avec la table « Traduction Claude → Codex » de `~/.codex/AGENTS.md`.

Le `check_command` est un script shell : il se lance tel quel depuis Codex. Jamais de `continue-on-error`, de job désactivé, de test sauté ni de relance à l'aveugle pour verdir. Zéro check n'est pas une CI verte.
