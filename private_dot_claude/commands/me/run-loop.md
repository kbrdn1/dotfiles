---
name: run-loop
description: "Lance une boucle auto-cadencée jusqu'à une condition de sortie observable, en routant vers la bonne skill me:loop:<name>, via la skill me:run-loop"
argument-hint: "<nom du loop ou description>"
---

# /me:run-loop

Lis `~/.claude/skills/me/run-loop/SKILL.md` en entier avec l'outil Read, puis applique-le à la lettre avec les arguments : `$ARGUMENTS`.

Commande légère : depuis Claude Code 2.1.327, une skill rangée dans `~/.claude/skills/me/<nom>/` n'est plus chargée comme skill dans une nouvelle session. Cette commande la rend invocable par `/me:run-loop`. La skill fait foi.
