---
name: me-loop-rgaa-until-clean
description: "Port Codex de /me:loop:rgaa-until-clean. Relance l'audit d'accessibilité automatisé (axe-core, pa11y) sur les routes modifiées, corrige les violations, reboucle jusqu'à 0 violation détectable, max 6 itérations. Charge la skill Claude canonique, qui fait foi."
---

# $me-loop-rgaa-until-clean (port Codex de /me:loop:rgaa-until-clean)

Source canonique, qui fait foi : `~/.claude/skills/me/loop/rgaa-until-clean/SKILL.md`, appliquée selon le protocole de `$me-run-loop`. La lire en entier avant d'agir, puis l'appliquer avec la table « Traduction Claude → Codex » de `~/.codex/AGENTS.md`.

Les corrections passent par `$me-rgaa` (la skill `me:rgaa` de la source). Le `check_command` (axe-core, pa11y) est portable tel quel.

`A11Y_VIOLATIONS=0` ne veut pas dire « RGAA conforme » : un audit opposable reste humain.
