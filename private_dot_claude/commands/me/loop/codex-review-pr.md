---
description: "Loop auto-cadencé — relance la review Codex CLI locale sur la PR de la branche courante et corrige jusqu'à 0 finding bloquant pertinent (P0/P1/P2), max 8 itérations"
---

Lance le loop **codex-review-pr** dans cette session : lis
`~/.claude/skills/me/loop/codex-review-pr/SKILL.md` et applique son **protocole
self-pace** directement (n'appelle PAS le Skill tool sur `me:loop:codex-review-pr` —
la commande et la skill partagent ce nom, donc le ré-invoquer reboucle sur ce shim).
Respecte les garde-fous de `me:run-loop` : jamais dépasser `max_iterations` ; jamais
déclarer succès sans avoir vu `P0P1P2_COUNT=0` dans la sortie réelle du `check_command`.

Arguments utilisateur : $ARGUMENTS
