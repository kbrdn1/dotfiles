---
description: "Loop auto-cadencé — relance l'audit a11y automatisé (axe/pa11y) sur les routes modifiées et corrige via me:rgaa jusqu'à 0 violation détectable, max 6 itérations"
---

Lance le loop **rgaa-until-clean** dans cette session : lis
`~/.claude/skills/me/loop/rgaa-until-clean/SKILL.md` et applique son **protocole
self-pace** directement (n'appelle PAS le Skill tool sur `me:loop:rgaa-until-clean` —
la commande et la skill partagent ce nom, donc le ré-invoquer reboucle sur ce shim).
L'expertise accessibilité vit dans la skill `me:rgaa` ; ce loop porte la cadence et
l'eval gate. Respecte les garde-fous de `me:run-loop`.

Arguments utilisateur : $ARGUMENTS
