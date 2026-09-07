---
description: "Loop auto-cadencé — détecte la dérive surface publique ↔ docs (CLI/API/config), met à jour, jusqu'à zéro écart, max 6 itérations. check_command PAR PROJET (exemple gwm-cli fourni)"
---

Lance le loop **docs-sync** dans cette session : lis
`~/.claude/skills/me/loop/docs-sync/SKILL.md` et applique son **protocole self-pace**
directement (n'appelle PAS le Skill tool sur `me:loop:docs-sync` — la commande et la
skill partagent ce nom, donc le ré-invoquer reboucle sur ce shim).

⚠️ Le `check_command` est **par projet**. Celui du SKILL.md est l'exemple gwm-cli (clap).
Si le repo courant n'est pas gwm-cli, dériver le check de sa propre surface énumérable
(routes Laravel, OpenAPI, exports d'un package…) avant de boucler — et si la surface
n'est pas énumérable par une commande, le dire et ne pas lancer le loop.

Respecte les garde-fous de `me:run-loop`.

Arguments utilisateur : $ARGUMENTS
