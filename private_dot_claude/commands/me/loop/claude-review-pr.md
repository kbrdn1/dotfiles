---
description: "Loop auto-cadencé — relance une review par agent Claude (spawné depuis la session, effort high minimum) sur la PR de la branche courante et corrige jusqu'à 0 finding bloquant pertinent (P0/P1/P2), max 8 itérations"
---

Lance le loop **claude-review-pr** dans cette session : lis
`~/.claude/skills/me/loop/claude-review-pr/SKILL.md` et applique son **protocole
self-pace** directement (n'appelle PAS le Skill tool sur `me:loop:claude-review-pr` —
la commande et la skill partagent ce nom, donc le ré-invoquer reboucle sur ce shim).
Respecte les garde-fous de `me:run-loop` : jamais dépasser `max_iterations` ; jamais
déclarer succès sans avoir vu `P0P1P2_COUNT=0` dans la sortie réelle de l'étape (C)
du check — le message final de l'agent de review ne fait pas foi, le rapport parsé si.

Arguments utilisateur : $ARGUMENTS
