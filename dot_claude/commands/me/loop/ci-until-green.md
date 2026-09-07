---
description: "Loop auto-cadencé — attend la CI de la PR de la branche courante sur le SHA exact de HEAD et corrige la cause racine des jobs rouges jusqu'à ce que tous les checks passent, max 6 itérations"
---

Lance le loop **ci-until-green** dans cette session : lis
`~/.claude/skills/me/loop/ci-until-green/SKILL.md` et applique son **protocole
self-pace** directement (n'appelle PAS le Skill tool sur `me:loop:ci-until-green` —
la commande et la skill partagent ce nom, donc le ré-invoquer reboucle sur ce shim).
Respecte les garde-fous de `me:run-loop`.

Arguments utilisateur : $ARGUMENTS
