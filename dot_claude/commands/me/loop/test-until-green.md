---
description: "Loop auto-cadencé — relance `npm test` et corrige jusqu'à ce que tous les tests passent (exit 0), max 10 itérations"
---

Lance le loop **test-until-green** dans cette session : lis
`~/.claude/skills/me/loop/test-until-green/SKILL.md` et applique son **protocole
self-pace** directement (n'appelle PAS le Skill tool sur `me:loop:test-until-green` —
la commande et la skill partagent ce nom, donc le ré-invoquer reboucle sur ce shim).
Respecte les garde-fous de `me:run-loop`.

Arguments utilisateur : $ARGUMENTS
